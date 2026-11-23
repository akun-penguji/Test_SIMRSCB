// KLPCM — Ketidaklengkapan Pengisian Catatan Medis.
// Per Juknis MRMIK 12.b/c/d STARKES.
// Audit RM sampling bulanan oleh komite/tim RM.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error klpcm: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}

// ── Template 24 item per audit (5 kategori) ───────────────────────────────────
fn item_template() -> Vec<(&'static str, i32, &'static str)> {
    vec![
        // Identitas (5)
        ("identitas",  1, "Nama lengkap pasien"),
        ("identitas",  2, "Nomor RM"),
        ("identitas",  3, "Tanggal lahir / umur"),
        ("identitas",  4, "Jenis kelamin"),
        ("identitas",  5, "Alamat / no. KTP"),
        // Anamnesa (5)
        ("anamnesa",   1, "Keluhan utama"),
        ("anamnesa",   2, "Riwayat penyakit sekarang"),
        ("anamnesa",   3, "Riwayat penyakit dahulu"),
        ("anamnesa",   4, "Riwayat keluarga"),
        ("anamnesa",   5, "Riwayat alergi obat"),
        // Pengkajian Awal (5)
        ("pengkajian", 1, "Asesmen awal medis (dokter)"),
        ("pengkajian", 2, "Asesmen awal keperawatan"),
        ("pengkajian", 3, "Vital signs (TD, nadi, suhu, RR)"),
        ("pengkajian", 4, "Diagnosa awal/sementara"),
        ("pengkajian", 5, "Rencana asuhan awal"),
        // DPJP (4)
        ("dpjp",       1, "Nama DPJP tertulis jelas"),
        ("dpjp",       2, "Tanda tangan / paraf DPJP"),
        ("dpjp",       3, "Catatan harian DPJP tiap hari rawat"),
        ("dpjp",       4, "Visit DPJP tercatat tanggal/jam"),
        // Resume Pulang (5)
        ("resume",     1, "Diagnosa akhir"),
        ("resume",     2, "Tindakan medis selama rawat"),
        ("resume",     3, "Hasil pemeriksaan penunjang"),
        ("resume",     4, "Obat pulang"),
        ("resume",     5, "Anjuran kontrol / tindak lanjut"),
        // Informed Consent (4) — Indikator Kamus Mutu F.5. Untuk pasien dengan
        // tindakan medik; bila tidak ada tindakan, tandai N/A sebagai lengkap.
        ("informed_consent", 1, "Lembar informed consent tersedia (bila ada tindakan)"),
        ("informed_consent", 2, "Penjelasan tindakan tercatat"),
        ("informed_consent", 3, "Tanda tangan pasien / keluarga"),
        ("informed_consent", 4, "Tanda tangan dokter & saksi"),
    ]
}

// ── Types ────────────────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AuditRow {
    pub id:               i32,
    pub bulan:            String,
    pub no_rawat:         String,
    pub no_rkm_medis:     Option<String>,
    pub nama_pasien:      Option<String>,
    pub tgl_masuk:        Option<String>,
    pub tgl_keluar:       Option<String>,
    pub bangsal:          Option<String>,
    pub dpjp:             Option<String>,
    pub auditor_nip:      Option<String>,
    pub tanggal_audit:    String,
    pub score_identitas:  f64,
    pub score_anamnesa:   f64,
    pub score_pengkajian: f64,
    pub score_dpjp:       f64,
    pub score_resume:     f64,
    pub score_total:      f64,
    pub status:           String,
    pub catatan:          Option<String>,
    pub created_at:       Option<String>,
    pub updated_at:       Option<String>,
    pub updated_by:       Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TemuanRow {
    pub id:        i32,
    pub audit_id:  i32,
    pub kategori:  String,
    pub urutan:    i32,
    pub item:      String,
    pub lengkap:   i8,
    pub catatan:   Option<String>,
}

// ── POST /api/klpcm/sampling — generate batch dari kamar_inap keluar bulan
#[derive(Deserialize)]
pub struct SamplingQuery {
    pub bulan: Option<String>,  // YYYY-MM (default bulan berjalan)
    pub n:     Option<i32>,     // default 50
}

pub async fn sampling(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<SamplingQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let n = q.n.unwrap_or(50).clamp(1, 500);

    let bulan_dari = format!("{}-01", bulan);
    let (yr_s, mo_s) = (&bulan[..4], &bulan[5..7]);
    let yr: i32 = yr_s.parse().unwrap_or(2026);
    let mo: u32 = mo_s.parse().unwrap_or(1);
    let nm_first = if mo == 12 { chrono::NaiveDate::from_ymd_opt(yr+1,1,1).unwrap() }
                   else { chrono::NaiveDate::from_ymd_opt(yr,mo+1,1).unwrap() };
    let bulan_sampai = (nm_first - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    // Ambil sampling random pasien ranap keluar bulan ini
    let candidates: Vec<(String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT DISTINCT ki.no_rawat, r.no_rkm_medis, p.nm_pasien,
                DATE_FORMAT(MIN(ki.tgl_masuk),'%Y-%m-%d') AS tgl_masuk,
                DATE_FORMAT(MAX(ki.tgl_keluar),'%Y-%m-%d') AS tgl_keluar,
                MAX(b.nm_bangsal) AS bangsal,
                MAX(d.nm_dokter) AS dpjp
         FROM kamar_inap ki
         JOIN reg_periksa r ON r.no_rawat=ki.no_rawat
         LEFT JOIN pasien p ON p.no_rkm_medis=r.no_rkm_medis
         LEFT JOIN kamar km ON km.kd_kamar=ki.kd_kamar
         LEFT JOIN bangsal b ON b.kd_bangsal=km.kd_bangsal
         LEFT JOIN dokter d ON d.kd_dokter=r.kd_dokter
         WHERE ki.tgl_keluar BETWEEN ? AND ?
           AND ki.stts_pulang != ''
           AND UPPER(ki.stts_pulang) != 'PINDAH KAMAR'
         GROUP BY ki.no_rawat, r.no_rkm_medis, p.nm_pasien
         ORDER BY RAND()
         LIMIT ?"
    )
    .bind(&bulan_dari).bind(&bulan_sampai).bind(n)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    if candidates.is_empty() {
        return Ok(Json(json!({
            "ok": true, "bulan": bulan, "sampled": 0, "inserted": 0, "skipped": 0,
            "message": "Tidak ada pasien ranap keluar bulan ini di Khanza"
        })));
    }

    let mut inserted = 0i32;
    let mut skipped  = 0i32;

    for (no_rawat, no_rm, nama, tgl_m, tgl_k, bangsal, dpjp) in &candidates {
        // Skip kalau sudah ada audit untuk no_rawat ini
        let exists: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM simrscb_klpcm_audit WHERE no_rawat = ?"
        ).bind(no_rawat).fetch_one(&state.pool).await.unwrap_or(0);
        if exists > 0 { skipped += 1; continue; }

        let result = sqlx::query(
            "INSERT INTO simrscb_klpcm_audit
              (bulan, no_rawat, no_rkm_medis, nama_pasien, tgl_masuk, tgl_keluar, bangsal, dpjp, updated_by)
             VALUES (?,?,?,?,?,?,?,?,?)"
        )
        .bind(&bulan).bind(no_rawat).bind(no_rm).bind(nama)
        .bind(tgl_m).bind(tgl_k).bind(bangsal).bind(dpjp)
        .bind(&user.0.kode)
        .execute(&state.pool).await;

        let audit_id = match result {
            Ok(r) => r.last_insert_id() as i32,
            Err(_) => { skipped += 1; continue; }
        };

        let sql = format!(
            "INSERT INTO simrscb_klpcm_audit (bulan, no_rawat, no_rkm_medis, nama_pasien, tgl_masuk, tgl_keluar, bangsal, dpjp, updated_by) VALUES ({},{},{},{},{},{},{},{},{})",
            crate::audit::q(&bulan),
            crate::audit::q(no_rawat),
            crate::audit::qo(no_rm.as_ref()),
            crate::audit::qo(nama.as_ref()),
            crate::audit::qo(tgl_m.as_ref()),
            crate::audit::qo(tgl_k.as_ref()),
            crate::audit::qo(bangsal.as_ref()),
            crate::audit::qo(dpjp.as_ref()),
            crate::audit::q(&user.0.kode),
        );
        crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;

        // Insert template 24 item, lengkap=0 default
        for (kategori, urutan, item) in item_template() {
            let _ = sqlx::query(
                "INSERT INTO simrscb_klpcm_temuan (audit_id, kategori, urutan, item)
                 VALUES (?,?,?,?)"
            ).bind(audit_id).bind(kategori).bind(urutan).bind(item)
             .execute(&state.pool).await;
        }

        // ── Auto-check Khanza segera setelah template di-insert ───────────────
        if let Err(e) = apply_autocheck(&state.pool, audit_id, no_rawat).await {
            tracing::warn!("autocheck failed for audit {}: {}", audit_id, e);
        }
        let _ = recompute_score(&state.pool, audit_id, &user.0.kode).await;

        inserted += 1;
    }

    Ok(Json(json!({
        "ok": true, "bulan": bulan, "sampled": candidates.len() as i32,
        "inserted": inserted, "skipped": skipped,
    })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-check: scan Khanza untuk no_rawat & no_rkm_medis, set lengkap=1
// untuk item yang datanya sudah ada di RM elektronik. Auditor tetap bisa
// override (uncheck) item yang ternyata datanya ada tapi tidak valid/tidak
// terbaca, atau toggle item-item yang tidak bisa dideteksi otomatis (mis.
// paraf manual).
// ─────────────────────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow, Debug)]
struct AutoCheckFlags {
    nama_ok:        i64,
    tgl_lahir_ok:   i64,
    jk_ok:          i64,
    alamat_ok:      i64,
    has_keluhan:    i64,
    has_rps:        i64,
    has_rpd:        i64,
    has_rpk:        i64,
    has_alergi:     i64,
    has_asesmen_medis:    i64,
    has_asesmen_perawat:  i64,
    has_vital_signs:      i64,
    has_dx_awal:          i64,
    has_rencana:          i64,
    has_dpjp:             i64,
    has_visit_harian:     i64,
    has_dx_akhir:         i64,
    has_tindakan:         i64,
    has_lab_or_rad:       i64,
    has_obat_pulang:      i64,
    has_anjuran:          i64,
}

async fn compute_autocheck(pool: &sqlx::MySqlPool, no_rawat: &str) -> Option<AutoCheckFlags> {
    // Pakai EXISTS dengan no_rawat inline (sebagai literal escaped) supaya tidak
    // perlu bind banyak placeholder. Karena no_rawat datang dari DB sendiri
    // (table simrscb_klpcm_audit.no_rawat) bukan user input langsung, escape
    // dengan single-quote duplication aman dari injection.
    let safe = no_rawat.replace('\'', "''");
    let sql = format!(r#"
        SELECT
          -- Identitas
          CAST((p.nm_pasien IS NOT NULL AND p.nm_pasien != '') AS SIGNED) AS nama_ok,
          CAST((p.tgl_lahir IS NOT NULL AND p.tgl_lahir > '1900-01-01') AS SIGNED) AS tgl_lahir_ok,
          CAST((p.jk IS NOT NULL) AS SIGNED) AS jk_ok,
          CAST(((p.alamat IS NOT NULL AND p.alamat != '')
               OR (p.no_ktp IS NOT NULL AND p.no_ktp != '')) AS SIGNED) AS alamat_ok,
          -- Anamnesa
          CAST(EXISTS(SELECT 1 FROM penilaian_medis_ranap WHERE no_rawat='{nr}' AND keluhan_utama IS NOT NULL AND keluhan_utama != '') AS SIGNED) AS has_keluhan,
          CAST((
            EXISTS(SELECT 1 FROM penilaian_medis_ranap         WHERE no_rawat='{nr}' AND rps IS NOT NULL AND rps != '')
            OR EXISTS(SELECT 1 FROM penilaian_awal_keperawatan_ranap WHERE no_rawat='{nr}' AND rps IS NOT NULL AND rps != '')
          ) AS SIGNED) AS has_rps,
          CAST((
            EXISTS(SELECT 1 FROM penilaian_medis_ranap         WHERE no_rawat='{nr}' AND rpd IS NOT NULL AND rpd != '')
            OR EXISTS(SELECT 1 FROM penilaian_awal_keperawatan_ranap WHERE no_rawat='{nr}' AND rpd IS NOT NULL AND rpd != '')
          ) AS SIGNED) AS has_rpd,
          CAST((
            EXISTS(SELECT 1 FROM penilaian_medis_ranap         WHERE no_rawat='{nr}' AND rpk IS NOT NULL AND rpk != '')
            OR EXISTS(SELECT 1 FROM penilaian_awal_keperawatan_ranap WHERE no_rawat='{nr}' AND rpk IS NOT NULL AND rpk != '')
          ) AS SIGNED) AS has_rpk,
          CAST((
            EXISTS(SELECT 1 FROM penilaian_medis_ranap         WHERE no_rawat='{nr}' AND alergi IS NOT NULL AND alergi != '')
            OR EXISTS(SELECT 1 FROM penilaian_awal_keperawatan_ranap WHERE no_rawat='{nr}' AND riwayat_alergi IS NOT NULL AND riwayat_alergi != '')
          ) AS SIGNED) AS has_alergi,
          -- Pengkajian
          CAST(EXISTS(SELECT 1 FROM penilaian_medis_ranap         WHERE no_rawat='{nr}') AS SIGNED) AS has_asesmen_medis,
          CAST(EXISTS(SELECT 1 FROM penilaian_awal_keperawatan_ranap WHERE no_rawat='{nr}') AS SIGNED) AS has_asesmen_perawat,
          CAST((
            EXISTS(SELECT 1 FROM penilaian_medis_ranap         WHERE no_rawat='{nr}' AND td IS NOT NULL AND td != '')
            OR EXISTS(SELECT 1 FROM penilaian_awal_keperawatan_ranap WHERE no_rawat='{nr}' AND pemeriksaan_td IS NOT NULL AND pemeriksaan_td != '')
          ) AS SIGNED) AS has_vital_signs,
          CAST(EXISTS(SELECT 1 FROM diagnosa_pasien WHERE no_rawat='{nr}' AND status='Ranap') AS SIGNED) AS has_dx_awal,
          CAST(EXISTS(SELECT 1 FROM penilaian_awal_keperawatan_ranap_rencana WHERE no_rawat='{nr}') AS SIGNED) AS has_rencana,
          -- DPJP
          CAST(IFNULL((SELECT (kd_dokter IS NOT NULL AND kd_dokter != '') FROM reg_periksa WHERE no_rawat='{nr}' LIMIT 1),0) AS SIGNED) AS has_dpjp,
          CAST((
            EXISTS(SELECT 1 FROM rawat_inap_dr   WHERE no_rawat='{nr}')
            OR EXISTS(SELECT 1 FROM rawat_inap_drpr WHERE no_rawat='{nr}')
          ) AS SIGNED) AS has_visit_harian,
          -- Resume
          CAST(EXISTS(SELECT 1 FROM diagnosa_pasien WHERE no_rawat='{nr}' AND status='Ranap' AND prioritas=1) AS SIGNED) AS has_dx_akhir,
          CAST((
            EXISTS(SELECT 1 FROM prosedur_pasien WHERE no_rawat='{nr}')
            OR EXISTS(SELECT 1 FROM resume_pasien_ranap WHERE no_rawat='{nr}' AND tindakan_dan_operasi IS NOT NULL AND tindakan_dan_operasi != '')
          ) AS SIGNED) AS has_tindakan,
          CAST((
            EXISTS(SELECT 1 FROM periksa_lab       WHERE no_rawat='{nr}')
            OR EXISTS(SELECT 1 FROM periksa_radiologi WHERE no_rawat='{nr}')
          ) AS SIGNED) AS has_lab_or_rad,
          CAST((
            EXISTS(SELECT 1 FROM resep_obat WHERE no_rawat='{nr}' AND status='ranap')
            OR EXISTS(SELECT 1 FROM resume_pasien_ranap WHERE no_rawat='{nr}' AND obat_pulang IS NOT NULL AND obat_pulang != '')
          ) AS SIGNED) AS has_obat_pulang,
          CAST(EXISTS(SELECT 1 FROM resume_pasien_ranap WHERE no_rawat='{nr}') AS SIGNED) AS has_anjuran
        FROM reg_periksa r
        JOIN pasien p ON p.no_rkm_medis = r.no_rkm_medis
        WHERE r.no_rawat = '{nr}'
        LIMIT 1
    "#, nr = safe);

    match sqlx::query_as::<_, AutoCheckFlags>(&sql).fetch_optional(pool).await {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!("autocheck SQL gagal untuk {}: {}", no_rawat, e);
            None
        }
    }
}

/// Mapping (kategori, urutan, lengkap, source_label).
/// `urutan` cocok dengan `item_template()` so we can do simple bulk update.
fn flags_to_items(f: &AutoCheckFlags) -> Vec<(&'static str, i32, i8, &'static str)> {
    vec![
        // Identitas
        ("identitas",  1, f.nama_ok      as i8, "pasien.nm_pasien"),
        ("identitas",  2, 1                   , "reg_periksa.no_rawat (default OK)"),
        ("identitas",  3, f.tgl_lahir_ok as i8, "pasien.tgl_lahir"),
        ("identitas",  4, f.jk_ok        as i8, "pasien.jk"),
        ("identitas",  5, f.alamat_ok    as i8, "pasien.alamat / no_ktp"),
        // Anamnesa
        ("anamnesa",   1, f.has_keluhan as i8, "penilaian_medis_ranap.keluhan_utama"),
        ("anamnesa",   2, f.has_rps     as i8, "penilaian_*.rps"),
        ("anamnesa",   3, f.has_rpd     as i8, "penilaian_*.rpd"),
        ("anamnesa",   4, f.has_rpk     as i8, "penilaian_*.rpk"),
        ("anamnesa",   5, f.has_alergi  as i8, "penilaian_*.alergi / riwayat_alergi"),
        // Pengkajian
        ("pengkajian", 1, f.has_asesmen_medis  as i8, "penilaian_medis_ranap exists"),
        ("pengkajian", 2, f.has_asesmen_perawat as i8, "penilaian_awal_keperawatan_ranap"),
        ("pengkajian", 3, f.has_vital_signs    as i8, "td/nadi/rr/suhu"),
        ("pengkajian", 4, f.has_dx_awal        as i8, "diagnosa_pasien (Ranap)"),
        ("pengkajian", 5, f.has_rencana        as i8, "penilaian_awal_keperawatan_ranap_rencana"),
        // DPJP
        ("dpjp",       1, f.has_dpjp        as i8, "reg_periksa.kd_dokter"),
        ("dpjp",       2, 0                       , "(manual: paraf tidak terdeteksi)"),
        ("dpjp",       3, f.has_visit_harian as i8, "rawat_inap_dr/drpr"),
        ("dpjp",       4, f.has_visit_harian as i8, "rawat_inap_*.tgl_perawatan"),
        // Resume
        ("resume",     1, f.has_dx_akhir     as i8, "diagnosa_pasien prioritas=1"),
        ("resume",     2, f.has_tindakan     as i8, "prosedur_pasien / resume.tindakan"),
        ("resume",     3, f.has_lab_or_rad   as i8, "periksa_lab / periksa_radiologi"),
        ("resume",     4, f.has_obat_pulang  as i8, "resep_obat ranap / resume.obat_pulang"),
        ("resume",     5, f.has_anjuran      as i8, "resume_pasien_ranap"),
    ]
}

/// Apply autocheck ke audit_id. Logic: HANYA update item dengan lengkap=0 dan
/// catatan IS NULL → biar tidak overwrite penilaian manual auditor.
async fn apply_autocheck(
    pool: &sqlx::MySqlPool,
    audit_id: i32,
    no_rawat: &str,
) -> Result<(i64, i64), sqlx::Error> {
    let Some(flags) = compute_autocheck(pool, no_rawat).await else {
        return Ok((0, 0));
    };
    let items = flags_to_items(&flags);
    let mut updated  = 0i64;
    let mut total_ok = 0i64;

    for (kategori, urutan, lengkap, source) in &items {
        if *lengkap == 1 { total_ok += 1; }
        let catatan = if *lengkap == 1 {
            Some(format!("(auto: {})", source))
        } else { None };

        let r = sqlx::query(
            "UPDATE simrscb_klpcm_temuan
             SET lengkap = ?, catatan = ?
             WHERE audit_id = ? AND kategori = ? AND urutan = ?
               AND (lengkap = 0 OR (lengkap = 1 AND catatan LIKE '(auto:%'))
               AND (catatan IS NULL OR catatan LIKE '(auto:%')"
        )
        .bind(*lengkap).bind(&catatan)
        .bind(audit_id).bind(*kategori).bind(*urutan)
        .execute(pool).await?;
        updated += r.rows_affected() as i64;
    }
    Ok((updated, total_ok))
}

/// Recompute score per kategori + total dari semua temuan untuk audit.
async fn recompute_score(pool: &sqlx::MySqlPool, audit_id: i32, updated_by: &str) -> Result<(), sqlx::Error> {
    let rows: Vec<(String, i64, i64)> = sqlx::query_as(
        "SELECT kategori, CAST(SUM(lengkap) AS SIGNED), CAST(COUNT(*) AS SIGNED)
         FROM simrscb_klpcm_temuan WHERE audit_id=? GROUP BY kategori"
    ).bind(audit_id).fetch_all(pool).await?;

    let (mut s_id, mut s_an, mut s_pk, mut s_dp, mut s_re) = (0.0, 0.0, 0.0, 0.0, 0.0);
    let mut tl = 0.0; let mut ti = 0.0;
    for (kat, lengkap, total) in &rows {
        let pct = if *total > 0 { (*lengkap as f64) * 100.0 / (*total as f64) } else { 0.0 };
        match kat.as_str() {
            "identitas"  => s_id = pct,
            "anamnesa"   => s_an = pct,
            "pengkajian" => s_pk = pct,
            "dpjp"       => s_dp = pct,
            "resume"     => s_re = pct,
            _ => {}
        }
        // Informed consent (F.5) dinilai terpisah — tidak masuk skor F.2 (score_total).
        if kat != "informed_consent" { tl += *lengkap as f64; ti += *total as f64; }
    }
    let s_total = if ti > 0.0 { tl * 100.0 / ti } else { 0.0 };

    sqlx::query(
        "UPDATE simrscb_klpcm_audit SET
           score_identitas=?, score_anamnesa=?, score_pengkajian=?,
           score_dpjp=?, score_resume=?, score_total=?, updated_by=?
         WHERE id=?"
    )
    .bind(s_id).bind(s_an).bind(s_pk).bind(s_dp).bind(s_re).bind(s_total)
    .bind(updated_by).bind(audit_id)
    .execute(pool).await?;

    let sql = format!(
        "UPDATE simrscb_klpcm_audit SET score_identitas={}, score_anamnesa={}, score_pengkajian={}, score_dpjp={}, score_resume={}, score_total={}, updated_by={} WHERE id={}",
        s_id, s_an, s_pk, s_dp, s_re, s_total, crate::audit::q(updated_by), audit_id,
    );
    crate::audit::log_sql(pool, updated_by, &sql).await;
    Ok(())
}

/// POST /api/klpcm/audit/:id/autocheck — re-scan Khanza
pub async fn run_autocheck_endpoint(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Get no_rawat
    let no_rawat: Option<String> = sqlx::query_scalar(
        "SELECT no_rawat FROM simrscb_klpcm_audit WHERE id=?"
    ).bind(id).fetch_optional(&state.pool).await.map_err(db_err)?;
    let Some(no_rawat) = no_rawat else {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"audit tidak ditemukan"}))));
    };

    let (updated, ok) = apply_autocheck(&state.pool, id, &no_rawat).await.map_err(db_err)?;
    recompute_score(&state.pool, id, &user.0.kode).await.map_err(db_err)?;

    Ok(Json(json!({
        "ok": true,
        "items_updated": updated,
        "items_ok":      ok,
        "items_total":   24,
    })))
}

// ── GET /api/klpcm/audit?bulan=YYYY-MM&status=&q=
#[derive(Deserialize)]
pub struct ListQuery {
    pub bulan:  Option<String>,
    pub status: Option<String>,
    pub q:      Option<String>,
}

pub async fn list_audit(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<AuditRow>>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7);
    let status = q.status.clone().filter(|s| !s.is_empty());
    let qs = q.q.clone().filter(|s| !s.trim().is_empty()).map(|s| format!("%{}%", s.trim()));

    let rows: Vec<AuditRow> = sqlx::query_as(
        "SELECT id, bulan, no_rawat, no_rkm_medis, nama_pasien,
                DATE_FORMAT(tgl_masuk,'%Y-%m-%d') AS tgl_masuk,
                DATE_FORMAT(tgl_keluar,'%Y-%m-%d') AS tgl_keluar,
                bangsal, dpjp, auditor_nip,
                DATE_FORMAT(tanggal_audit,'%Y-%m-%d') AS tanggal_audit,
                CAST(score_identitas AS DOUBLE) AS score_identitas,
                CAST(score_anamnesa AS DOUBLE) AS score_anamnesa,
                CAST(score_pengkajian AS DOUBLE) AS score_pengkajian,
                CAST(score_dpjp AS DOUBLE) AS score_dpjp,
                CAST(score_resume AS DOUBLE) AS score_resume,
                CAST(score_total AS DOUBLE) AS score_total,
                status, catatan,
                DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM simrscb_klpcm_audit
         WHERE (? IS NULL OR bulan = ?)
           AND (? IS NULL OR status = ?)
           AND (? IS NULL OR nama_pasien LIKE ? OR no_rawat LIKE ? OR no_rkm_medis LIKE ?)
         ORDER BY tanggal_audit DESC, id DESC
         LIMIT 500"
    )
    .bind(&bulan).bind(&bulan)
    .bind(&status).bind(&status)
    .bind(&qs).bind(&qs).bind(&qs).bind(&qs)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    Ok(Json(rows))
}

// ── GET /api/klpcm/audit/:id — detail + temuan
pub async fn detail_audit(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let audit: Option<AuditRow> = sqlx::query_as(
        "SELECT id, bulan, no_rawat, no_rkm_medis, nama_pasien,
                DATE_FORMAT(tgl_masuk,'%Y-%m-%d') AS tgl_masuk,
                DATE_FORMAT(tgl_keluar,'%Y-%m-%d') AS tgl_keluar,
                bangsal, dpjp, auditor_nip,
                DATE_FORMAT(tanggal_audit,'%Y-%m-%d') AS tanggal_audit,
                CAST(score_identitas AS DOUBLE) AS score_identitas,
                CAST(score_anamnesa AS DOUBLE) AS score_anamnesa,
                CAST(score_pengkajian AS DOUBLE) AS score_pengkajian,
                CAST(score_dpjp AS DOUBLE) AS score_dpjp,
                CAST(score_resume AS DOUBLE) AS score_resume,
                CAST(score_total AS DOUBLE) AS score_total,
                status, catatan,
                DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM simrscb_klpcm_audit WHERE id=?"
    ).bind(id).fetch_optional(&state.pool).await.map_err(db_err)?;

    let Some(audit) = audit else {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"audit tidak ditemukan"}))));
    };

    let temuan: Vec<TemuanRow> = sqlx::query_as(
        "SELECT id, audit_id, kategori, urutan, item, lengkap, catatan
         FROM simrscb_klpcm_temuan
         WHERE audit_id=? ORDER BY FIELD(kategori,'identitas','anamnesa','pengkajian','dpjp','resume'), urutan"
    ).bind(id).fetch_all(&state.pool).await.map_err(db_err)?;

    Ok(Json(json!({ "audit": audit, "temuan": temuan })))
}

// ── PUT /api/klpcm/audit/:id/temuan/:tid — toggle lengkap/catatan + auto-score
#[derive(Deserialize)]
pub struct UpdateTemuanBody {
    pub lengkap: i8,
    pub catatan: Option<String>,
}

pub async fn update_temuan(
    user: AuthUser,
    State(state): State<AppState>,
    Path((audit_id, tid)): Path<(i32, i32)>,
    Json(body): Json<UpdateTemuanBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Update temuan
    let res = sqlx::query(
        "UPDATE simrscb_klpcm_temuan SET lengkap=?, catatan=? WHERE id=? AND audit_id=?"
    )
    .bind(body.lengkap).bind(&body.catatan).bind(tid).bind(audit_id)
    .execute(&state.pool).await.map_err(db_err)?;

    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"temuan tidak ditemukan"}))));
    }

    let sql = format!(
        "UPDATE simrscb_klpcm_temuan SET lengkap={}, catatan={} WHERE id={} AND audit_id={}",
        body.lengkap, crate::audit::qo(body.catatan.as_ref()), tid, audit_id,
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;

    // Recompute score per kategori dari semua temuan untuk audit ini
    let score_rows: Vec<(String, i64, i64)> = sqlx::query_as(
        "SELECT kategori, CAST(SUM(lengkap) AS SIGNED), CAST(COUNT(*) AS SIGNED)
         FROM simrscb_klpcm_temuan WHERE audit_id=? GROUP BY kategori"
    ).bind(audit_id).fetch_all(&state.pool).await.map_err(db_err)?;

    let (mut s_id, mut s_an, mut s_pk, mut s_dp, mut s_re) = (0.0, 0.0, 0.0, 0.0, 0.0);
    let mut total_lengkap = 0.0; let mut total_item = 0.0;
    for (kat, lengkap, total) in &score_rows {
        let pct = if *total > 0 { (*lengkap as f64) * 100.0 / (*total as f64) } else { 0.0 };
        match kat.as_str() {
            "identitas"  => s_id = pct,
            "anamnesa"   => s_an = pct,
            "pengkajian" => s_pk = pct,
            "dpjp"       => s_dp = pct,
            "resume"     => s_re = pct,
            _ => {}
        }
        // Informed consent (F.5) dinilai terpisah — tidak masuk skor F.2 (score_total).
        if kat != "informed_consent" {
            total_lengkap += *lengkap as f64;
            total_item    += *total as f64;
        }
    }
    let s_total = if total_item > 0.0 { total_lengkap * 100.0 / total_item } else { 0.0 };

    sqlx::query(
        "UPDATE simrscb_klpcm_audit
         SET score_identitas=?, score_anamnesa=?, score_pengkajian=?,
             score_dpjp=?, score_resume=?, score_total=?, updated_by=?
         WHERE id=?"
    )
    .bind(s_id).bind(s_an).bind(s_pk).bind(s_dp).bind(s_re).bind(s_total)
    .bind(&user.0.kode).bind(audit_id)
    .execute(&state.pool).await.map_err(db_err)?;

    let sql = format!(
        "UPDATE simrscb_klpcm_audit SET score_identitas={}, score_anamnesa={}, score_pengkajian={}, score_dpjp={}, score_resume={}, score_total={}, updated_by={} WHERE id={}",
        s_id, s_an, s_pk, s_dp, s_re, s_total, crate::audit::q(&user.0.kode), audit_id,
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;

    Ok(Json(json!({
        "ok": true,
        "score": { "identitas": s_id, "anamnesa": s_an, "pengkajian": s_pk,
                   "dpjp": s_dp, "resume": s_re, "total": s_total }
    })))
}

// ── PUT /api/klpcm/audit/:id — update header (status, catatan, auditor)
#[derive(Deserialize)]
pub struct UpdateAuditBody {
    pub status:      Option<String>,
    pub catatan:     Option<String>,
    pub auditor_nip: Option<String>,
}

pub async fn update_audit(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<UpdateAuditBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query(
        "UPDATE simrscb_klpcm_audit SET
           status=COALESCE(?, status),
           catatan=COALESCE(?, catatan),
           auditor_nip=COALESCE(?, auditor_nip),
           updated_by=?
         WHERE id=?"
    )
    .bind(&body.status).bind(&body.catatan).bind(&body.auditor_nip)
    .bind(&user.0.kode).bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    let sql = format!(
        "UPDATE simrscb_klpcm_audit SET status=COALESCE({},status), catatan=COALESCE({},catatan), auditor_nip=COALESCE({},auditor_nip), updated_by={} WHERE id={}",
        crate::audit::qo(body.status.as_ref()),
        crate::audit::qo(body.catatan.as_ref()),
        crate::audit::qo(body.auditor_nip.as_ref()),
        crate::audit::q(&user.0.kode),
        id,
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;
    Ok(Json(json!({"ok": true})))
}

// ── DELETE /api/klpcm/audit/:id
pub async fn delete_audit(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query("DELETE FROM simrscb_klpcm_audit WHERE id=?")
        .bind(id).execute(&state.pool).await.map_err(db_err)?;
    let sql = format!("DELETE FROM simrscb_klpcm_audit WHERE id={}", id);
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;
    Ok(Json(json!({"ok": true})))
}

// ── GET /api/klpcm/laporan?bulan=YYYY-MM — agregat bulanan
pub async fn laporan(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());

    #[derive(sqlx::FromRow)]
    struct AgRow {
        total:        i64,
        avg_id:       Option<f64>,
        avg_an:       Option<f64>,
        avg_pk:       Option<f64>,
        avg_dp:       Option<f64>,
        avg_re:       Option<f64>,
        avg_tot:      Option<f64>,
        n_final:      i64,
        n_draft:      i64,
        n_bawah_80:   i64,
        rm_lengkap:   i64,
    }
    let ag: AgRow = sqlx::query_as(
        "SELECT
           CAST(COUNT(*) AS SIGNED) AS total,
           CAST(AVG(score_identitas)  AS DOUBLE) AS avg_id,
           CAST(AVG(score_anamnesa)   AS DOUBLE) AS avg_an,
           CAST(AVG(score_pengkajian) AS DOUBLE) AS avg_pk,
           CAST(AVG(score_dpjp)       AS DOUBLE) AS avg_dp,
           CAST(AVG(score_resume)     AS DOUBLE) AS avg_re,
           CAST(AVG(score_total)      AS DOUBLE) AS avg_tot,
           CAST(IFNULL(SUM(CASE WHEN status='final' THEN 1 ELSE 0 END), 0) AS SIGNED) AS n_final,
           CAST(IFNULL(SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END), 0) AS SIGNED) AS n_draft,
           CAST(IFNULL(SUM(CASE WHEN score_total < 80 THEN 1 ELSE 0 END), 0) AS SIGNED) AS n_bawah_80,
           CAST(IFNULL(SUM(CASE WHEN score_total >= 99.99 THEN 1 ELSE 0 END), 0) AS SIGNED) AS rm_lengkap
         FROM simrscb_klpcm_audit WHERE bulan=?"
    ).bind(&bulan).fetch_one(&state.pool).await.map_err(db_err)?;
    // Indikator Kamus Mutu F.2: % RM lengkap (semua item lengkap) / RM disurvei; target 100%.
    let pct_rm_lengkap = if ag.total > 0 { (ag.rm_lengkap as f64) * 100.0 / (ag.total as f64) } else { 0.0 };

    // Indikator Kamus Mutu F.5: Kelengkapan Informed Consent.
    // Numerator = audit dgn semua item informed_consent lengkap; Denominator = audit
    // yang memiliki komponen informed_consent (audit baru); target 100%.
    #[derive(sqlx::FromRow)]
    struct IcRow { ic_audit: i64, ic_lengkap: i64 }
    let ic: IcRow = sqlx::query_as(
        "SELECT CAST(COUNT(*) AS SIGNED) AS ic_audit,
                CAST(IFNULL(SUM(CASE WHEN lgk = cnt THEN 1 ELSE 0 END),0) AS SIGNED) AS ic_lengkap
         FROM (
            SELECT t.audit_id, SUM(t.lengkap) lgk, COUNT(*) cnt
            FROM simrscb_klpcm_temuan t
            JOIN simrscb_klpcm_audit a ON a.id=t.audit_id
            WHERE a.bulan=? AND t.kategori='informed_consent'
            GROUP BY t.audit_id
         ) x"
    ).bind(&bulan).fetch_one(&state.pool).await.unwrap_or(IcRow { ic_audit: 0, ic_lengkap: 0 });
    let pct_ic_lengkap = if ic.ic_audit > 0 { (ic.ic_lengkap as f64) * 100.0 / (ic.ic_audit as f64) } else { 0.0 };

    // Trend 12 bulan terakhir
    #[derive(sqlx::FromRow, Serialize)]
    struct TrendRow {
        bulan:      String,
        total:      i64,
        avg_total:  Option<f64>,
    }
    let trend: Vec<TrendRow> = sqlx::query_as(
        "SELECT bulan, CAST(COUNT(*) AS SIGNED) AS total,
                CAST(AVG(score_total) AS DOUBLE) AS avg_total
         FROM simrscb_klpcm_audit
         GROUP BY bulan ORDER BY bulan DESC LIMIT 12"
    ).fetch_all(&state.pool).await.unwrap_or_default();

    // Top 10 audit dengan score terendah bulan ini (focus area)
    #[derive(sqlx::FromRow, Serialize)]
    struct LowScore {
        id:          i32,
        no_rawat:    String,
        nama_pasien: Option<String>,
        bangsal:     Option<String>,
        score_total: f64,
        status:      String,
    }
    let low: Vec<LowScore> = sqlx::query_as(
        "SELECT id, no_rawat, nama_pasien, bangsal,
                CAST(score_total AS DOUBLE) AS score_total, status
         FROM simrscb_klpcm_audit
         WHERE bulan=?
         ORDER BY score_total ASC LIMIT 10"
    ).bind(&bulan).fetch_all(&state.pool).await.unwrap_or_default();

    // Indikator inti KLPCM: KETIDAKlengkapan = kebalikan kelengkapan (turunan aritmetika).
    let rm_tidak_lengkap = ag.total - ag.rm_lengkap;
    let pct_ketidaklengkapan = if ag.total > 0 { (rm_tidak_lengkap as f64) * 100.0 / (ag.total as f64) } else { 0.0 };

    Ok(Json(json!({
        "bulan": bulan,
        "ringkasan": {
            "total_audit": ag.total,
            "draft": ag.n_draft, "final": ag.n_final,
            "bawah_target_80": ag.n_bawah_80,
            // KLPCM (Ketidaklengkapan Pengisian Catatan Medis): jumlah & % RM tidak lengkap.
            "rm_tidak_lengkap":     rm_tidak_lengkap,
            "pct_ketidaklengkapan": pct_ketidaklengkapan,
            "avg_total":      ag.avg_tot.unwrap_or(0.0),
            "avg_identitas":  ag.avg_id.unwrap_or(0.0),
            "avg_anamnesa":   ag.avg_an.unwrap_or(0.0),
            "avg_pengkajian": ag.avg_pk.unwrap_or(0.0),
            "avg_dpjp":       ag.avg_dp.unwrap_or(0.0),
            "avg_resume":     ag.avg_re.unwrap_or(0.0),
            "target_pct":     80.0,
            // Indikator resmi Kamus Mutu Unit Kerja F.2 (Kelengkapan Pengisian RM 24 Jam)
            "rm_lengkap":       ag.rm_lengkap,
            "pct_rm_lengkap":   pct_rm_lengkap,
            "target_kamus_100": 100.0,
            // Indikator resmi Kamus Mutu Unit Kerja F.5 (Kelengkapan Informed Consent)
            "ic_audit":         ic.ic_audit,
            "ic_lengkap":       ic.ic_lengkap,
            "pct_ic_lengkap":   pct_ic_lengkap,
        },
        "trend_12_bulan": trend,
        "score_terendah":  low,
    })))
}
