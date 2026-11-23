// Anjungan — Pendaftaran Pasien Walk-In (Non BPJS / Umum).
// Adopsi dari APMSEPDuaPrinter DlgRegistrasiWalkIn (RSUD Dirgahayu).
// Khanza-only — TIDAK butuh bridging BPJS.

use crate::AppState;
use axum::{extract::{Query, State}, http::StatusCode, Json};
use chrono::Datelike;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error anjungan_walkin: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}

const KD_PJ_UMUM: &str = "A01";

// ── 1. Cari pasien berdasarkan no_ktp ATAU no_rkm_medis ──────────────────────
#[derive(Deserialize)]
pub struct CariBody {
    #[serde(default)]
    pub no_ktp:       Option<String>,
    #[serde(default)]
    pub no_rkm_medis: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PasienRow {
    pub no_rkm_medis: String,
    pub nm_pasien:    String,
    pub no_ktp:       Option<String>,
    pub jk:           String,
    pub tgl_lahir:    Option<String>,
    pub alamat:       Option<String>,
    pub no_tlp:       Option<String>,
    pub umur:         Option<String>,
    pub nm_kel:       Option<String>,
    pub nm_kec:       Option<String>,
    pub nm_kab:       Option<String>,
    pub pekerjaan:    Option<String>,
    pub agama:        Option<String>,
    pub namakeluarga: Option<String>,
    pub keluarga:     Option<String>,
    pub stts_nikah:   Option<String>,
}

pub async fn cari_pasien(
    State(state): State<AppState>,
    Json(b): Json<CariBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Tentukan mode pencarian: by no_rkm_medis (prioritas) atau by no_ktp
    let by_rm  = b.no_rkm_medis.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty());
    let by_nik = b.no_ktp.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty());

    let (mode, value, label) = match (by_rm, by_nik) {
        (Some(rm), _) => ("no_rkm_medis", rm.to_string(), "No. Rekam Medis"),
        (None, Some(nik)) => {
            if nik.len() < 13 {
                return Err((StatusCode::BAD_REQUEST,
                    Json(json!({"error": "NIK minimal 13 digit"}))));
            }
            ("no_ktp", nik.to_string(), "NIK")
        }
        (None, None) => {
            return Err((StatusCode::BAD_REQUEST,
                Json(json!({"error": "Harus diisi salah satu: no_rkm_medis atau no_ktp"}))));
        }
    };

    let sql = format!(
        "SELECT p.no_rkm_medis, p.nm_pasien, p.no_ktp, p.jk,
                DATE_FORMAT(p.tgl_lahir,'%Y-%m-%d') AS tgl_lahir,
                p.alamat, p.no_tlp, p.umur,
                kel.nm_kel, kec.nm_kec, kab.nm_kab,
                p.pekerjaan, p.agama, p.namakeluarga, p.keluarga, p.stts_nikah
         FROM pasien p
         LEFT JOIN kelurahan kel ON kel.kd_kel=p.kd_kel
         LEFT JOIN kecamatan kec ON kec.kd_kec=p.kd_kec
         LEFT JOIN kabupaten kab ON kab.kd_kab=p.kd_kab
         WHERE p.{} = ?
         LIMIT 1",
        mode
    );

    let row: Option<PasienRow> = sqlx::query_as(&sql)
        .bind(&value)
        .fetch_optional(&state.pool).await.map_err(db_err)?;

    match row {
        Some(p) => Ok(Json(json!({ "ok": true, "found": true, "pasien": p }))),
        None    => Ok(Json(json!({
            "ok": true, "found": false,
            "message": format!("Pasien dengan {} tersebut belum terdaftar di sistem. Silakan menuju loket untuk pendaftaran pasien baru.", label)
        }))),
    }
}

// ── 2. List poli yang punya jadwal hari ini ──────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PoliRow {
    pub kd_poli:       String,
    pub nm_poli:       String,
    pub registrasi:    f64,
    pub registrasilama: f64,
}

pub async fn list_poli_hari_ini(
    State(state): State<AppState>,
) -> Result<Json<Vec<PoliRow>>, (StatusCode, Json<Value>)> {
    // Khanza pakai "AKHAD" untuk Minggu — translate DAYNAME ke enum mereka
    let rows: Vec<PoliRow> = sqlx::query_as(
        "SELECT DISTINCT p.kd_poli, p.nm_poli,
                CAST(p.registrasi AS DOUBLE) AS registrasi,
                CAST(p.registrasilama AS DOUBLE) AS registrasilama
         FROM poliklinik p
         JOIN jadwal j ON j.kd_poli = p.kd_poli
         JOIN dokter d ON d.kd_dokter = j.kd_dokter
         WHERE p.status='1' AND d.status='1'
           AND UPPER(j.hari_kerja) =
               CASE UPPER(DAYNAME(CURDATE()))
                 WHEN 'SUNDAY'    THEN 'AKHAD'
                 WHEN 'MONDAY'    THEN 'SENIN'
                 WHEN 'TUESDAY'   THEN 'SELASA'
                 WHEN 'WEDNESDAY' THEN 'RABU'
                 WHEN 'THURSDAY'  THEN 'KAMIS'
                 WHEN 'FRIDAY'    THEN 'JUMAT'
                 WHEN 'SATURDAY'  THEN 'SABTU'
               END
         ORDER BY p.nm_poli"
    )
    .fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// ── 3. List dokter di poli tertentu yang praktek hari ini ───────────────────
#[derive(Deserialize)]
pub struct DokterQuery { pub kd_poli: String }

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DokterRow {
    pub kd_dokter:    String,
    pub nm_dokter:    String,
    pub jam_mulai:    Option<String>,
    pub jam_selesai:  Option<String>,
    pub kuota:        i32,
    pub terisi:       i64,
}

pub async fn list_dokter_hari_ini(
    State(state): State<AppState>,
    Query(q): Query<DokterQuery>,
) -> Result<Json<Vec<DokterRow>>, (StatusCode, Json<Value>)> {
    let rows: Vec<DokterRow> = sqlx::query_as(
        "SELECT d.kd_dokter, d.nm_dokter,
                TIME_FORMAT(j.jam_mulai,'%H:%i')   AS jam_mulai,
                TIME_FORMAT(j.jam_selesai,'%H:%i') AS jam_selesai,
                j.kuota,
                CAST((SELECT COUNT(*) FROM reg_periksa r
                      WHERE r.tgl_registrasi=CURDATE()
                        AND r.kd_dokter = d.kd_dokter
                        AND r.kd_poli = j.kd_poli) AS SIGNED) AS terisi
         FROM dokter d
         JOIN jadwal j ON j.kd_dokter = d.kd_dokter
         WHERE d.status='1' AND j.kd_poli = ?
           AND UPPER(j.hari_kerja) =
               CASE UPPER(DAYNAME(CURDATE()))
                 WHEN 'SUNDAY'    THEN 'AKHAD'
                 WHEN 'MONDAY'    THEN 'SENIN'
                 WHEN 'TUESDAY'   THEN 'SELASA'
                 WHEN 'WEDNESDAY' THEN 'RABU'
                 WHEN 'THURSDAY'  THEN 'KAMIS'
                 WHEN 'FRIDAY'    THEN 'JUMAT'
                 WHEN 'SATURDAY'  THEN 'SABTU'
               END
         ORDER BY d.nm_dokter"
    )
    .bind(&q.kd_poli)
    .fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// ── 4. Daftar (INSERT reg_periksa) ───────────────────────────────────────────
#[derive(Deserialize)]
pub struct DaftarBody {
    pub no_rkm_medis: String,
    pub kd_poli:      String,
    pub kd_dokter:    String,
    pub p_jawab:      Option<String>,     // default = namakeluarga pasien
    pub almt_pj:      Option<String>,     // default = alamat pasien
    pub hubunganpj:   Option<String>,     // default = keluarga pasien
    /// Override kd_pj (cara bayar). Default "A01" UMUM. Untuk BPJS kirim "BPJ"
    /// atau "A02" — keduanya dinormalkan ke kode BPJS yang eksis di tabel penjab.
    pub kd_pj:        Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct DaftarResult {
    pub no_rawat:     String,
    pub no_reg:       String,
    pub no_rkm_medis: String,
    pub nama_pasien:  String,
    pub kd_poli:      String,
    pub nm_poli:      String,
    pub kd_dokter:    String,
    pub nm_dokter:    String,
    pub tanggal:      String,
    pub jam:          String,
    pub biaya_reg:    f64,
    pub status_poli:  String,
    pub stts_daftar:  String,
}

pub async fn daftar(
    State(state): State<AppState>,
    Json(b): Json<DaftarBody>,
) -> Result<Json<DaftarResult>, (StatusCode, Json<Value>)> {
    // 1. Validasi pasien + ambil data umur
    let pasien: Option<(String, Option<String>, String, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT nm_pasien, DATE_FORMAT(tgl_lahir,'%Y-%m-%d'), jk,
                namakeluarga, alamat, keluarga
         FROM pasien WHERE no_rkm_medis=? LIMIT 1"
    ).bind(&b.no_rkm_medis).fetch_optional(&state.pool).await.map_err(db_err)?;

    let Some((nama, tgl_lahir, _jk, namakeluarga, alamat, keluarga)) = pasien else {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"no_rkm_medis tidak ditemukan"}))));
    };

    // 2. Validasi poli & dokter aktif + jadwal hari ini
    let poli: Option<(String, f64, f64)> = sqlx::query_as(
        "SELECT nm_poli, CAST(registrasi AS DOUBLE), CAST(registrasilama AS DOUBLE)
         FROM poliklinik WHERE kd_poli=? AND status='1' LIMIT 1"
    ).bind(&b.kd_poli).fetch_optional(&state.pool).await.map_err(db_err)?;
    let Some((nm_poli, biaya_baru, biaya_lama)) = poli else {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"poli tidak ditemukan / nonaktif"}))));
    };

    let dokter: Option<(String,)> = sqlx::query_as(
        "SELECT nm_dokter FROM dokter WHERE kd_dokter=? AND status='1' LIMIT 1"
    ).bind(&b.kd_dokter).fetch_optional(&state.pool).await.map_err(db_err)?;
    let Some((nm_dokter,)) = dokter else {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"dokter tidak ditemukan / nonaktif"}))));
    };

    // 3. Tentukan stts_daftar (Lama/Baru) — pernah daftar sebelumnya?
    let pernah_daftar: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa WHERE no_rkm_medis=?"
    ).bind(&b.no_rkm_medis).fetch_one(&state.pool).await.unwrap_or(0);
    let stts_daftar = if pernah_daftar > 0 { "Lama" } else { "Baru" };

    // 4. Tentukan status_poli (Lama/Baru) — pernah ke poli ini sebelumnya?
    let pernah_poli: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa WHERE no_rkm_medis=? AND kd_poli=?"
    ).bind(&b.no_rkm_medis).bind(&b.kd_poli)
     .fetch_one(&state.pool).await.unwrap_or(0);
    let status_poli = if pernah_poli > 0 { "Lama" } else { "Baru" };
    let biaya_reg = if pernah_poli > 0 { biaya_lama } else { biaya_baru };

    // 5. Hitung umur dari tgl_lahir
    let (umurdaftar, sttsumur) = match tgl_lahir.as_deref().and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()) {
        Some(tl) => {
            let today = chrono::Local::now().naive_local().date();
            let years = today.years_since(tl).unwrap_or(0) as i32;
            if years >= 1 {
                (years, "Th")
            } else {
                let months = ((today.year() - tl.year()) * 12 + (today.month() as i32 - tl.month() as i32)) as i32;
                if months >= 1 { (months, "Bl") }
                else {
                    let days = (today - tl).num_days() as i32;
                    (days.max(0), "Hr")
                }
            }
        },
        None => (0, "Th"),
    };

    // 6. Cek apakah pasien sudah daftar hari ini di poli yang sama → tolak
    let sudah_hari_ini: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa
         WHERE no_rkm_medis=? AND tgl_registrasi=CURDATE() AND kd_poli=?"
    ).bind(&b.no_rkm_medis).bind(&b.kd_poli)
     .fetch_one(&state.pool).await.unwrap_or(0);
    if sudah_hari_ini > 0 {
        return Err((StatusCode::CONFLICT,
            Json(json!({"error": "Pasien sudah terdaftar di poli ini hari ini"}))));
    }

    // 7. Cek kuota dokter
    let kuota: Option<(i32, i64)> = sqlx::query_as(
        "SELECT j.kuota,
                CAST((SELECT COUNT(*) FROM reg_periksa r
                      WHERE r.tgl_registrasi=CURDATE() AND r.kd_dokter=? AND r.kd_poli=?) AS SIGNED) AS terisi
         FROM jadwal j WHERE j.kd_dokter=? AND j.kd_poli=? LIMIT 1"
    ).bind(&b.kd_dokter).bind(&b.kd_poli)
     .bind(&b.kd_dokter).bind(&b.kd_poli)
     .fetch_optional(&state.pool).await.map_err(db_err)?;
    if let Some((k, t)) = kuota {
        if t >= k as i64 {
            return Err((StatusCode::CONFLICT,
                Json(json!({"error": format!("Kuota dokter penuh ({}/{}) untuk hari ini", t, k)}))));
        }
    }

    // 8. Generate no_rawat (daily counter global) + no_reg (per poli)
    let next_global: i64 = sqlx::query_scalar(
        "SELECT CAST(IFNULL(MAX(CAST(SUBSTRING(no_rawat,12,6) AS UNSIGNED)),0)+1 AS SIGNED)
         FROM reg_periksa WHERE tgl_registrasi=CURDATE()"
    ).fetch_one(&state.pool).await.map_err(db_err)?;
    let next_per_poli: i64 = sqlx::query_scalar(
        "SELECT CAST(IFNULL(MAX(CAST(no_reg AS UNSIGNED)),0)+1 AS SIGNED)
         FROM reg_periksa WHERE tgl_registrasi=CURDATE() AND kd_poli=?"
    ).bind(&b.kd_poli).fetch_one(&state.pool).await.map_err(db_err)?;

    let today = chrono::Local::now().format("%Y/%m/%d").to_string();
    let no_rawat = format!("{}/{:06}", today, next_global);
    let no_reg   = format!("{:03}", next_per_poli);

    // 9. Default p_jawab/almt_pj/hubunganpj dari pasien kalau tidak di-isi
    let pj_nama   = b.p_jawab.as_deref().filter(|s| !s.trim().is_empty())
                    .map(|s| s.to_string())
                    .or(namakeluarga.clone())
                    .unwrap_or_else(|| "".to_string());
    let pj_almt   = b.almt_pj.as_deref().filter(|s| !s.trim().is_empty())
                    .map(|s| s.to_string())
                    .or(alamat.clone())
                    .unwrap_or_else(|| "".to_string());
    let pj_hbg    = b.hubunganpj.as_deref().filter(|s| !s.trim().is_empty())
                    .map(|s| s.to_string())
                    .or(keluarga.clone())
                    .unwrap_or_else(|| "DIRI SENDIRI".to_string());

    // 10. INSERT reg_periksa
    //
    // Normalkan kode BPJS: klien lama mengirim "A02", klien baru "BPJ". Yang
    // dipakai adalah kode yang benar-benar ada di tabel penjab, supaya INSERT
    // tidak kena FK error sebelum maupun sesudah migrasi kode penjab.
    let kd_pj_final: String = match b.kd_pj.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        None => KD_PJ_UMUM.to_string(),
        Some(k) if k.eq_ignore_ascii_case("A02") || k.eq_ignore_ascii_case("BPJ") =>
            crate::handlers::kd_pj_bpjs(&state.pool).await,
        Some(k) => k.to_string(),
    };

    sqlx::query(
        "INSERT INTO reg_periksa
          (no_reg, no_rawat, tgl_registrasi, jam_reg, kd_dokter, no_rkm_medis, kd_poli,
           p_jawab, almt_pj, hubunganpj, biaya_reg, stts, stts_daftar, status_lanjut,
           kd_pj, umurdaftar, sttsumur, status_bayar, status_poli)
         VALUES (?, ?, CURDATE(), CURTIME(), ?, ?, ?, ?, ?, ?, ?, 'Belum', ?, 'Ralan',
                 ?, ?, ?, 'Belum Bayar', ?)"
    )
    .bind(&no_reg).bind(&no_rawat).bind(&b.kd_dokter).bind(&b.no_rkm_medis).bind(&b.kd_poli)
    .bind(&pj_nama).bind(&pj_almt).bind(&pj_hbg).bind(biaya_reg)
    .bind(stts_daftar)
    .bind(&kd_pj_final)
    .bind(umurdaftar).bind(sttsumur).bind(status_poli)
    .execute(&state.pool).await.map_err(db_err)?;

    // Audit trail SQL (trackersql, meniru Khanza) — kiosk publik: kode "anjungan"
    crate::audit::log_sql(&state.pool, "anjungan", &format!(
        "INSERT INTO reg_periksa (no_reg, no_rawat, tgl_registrasi, jam_reg, kd_dokter, no_rkm_medis, kd_poli, \
         p_jawab, almt_pj, hubunganpj, biaya_reg, stts, stts_daftar, status_lanjut, kd_pj, umurdaftar, sttsumur, status_bayar, status_poli) \
         VALUES ({}, {}, CURDATE(), CURTIME(), {}, {}, {}, {}, {}, {}, {}, 'Belum', {}, 'Ralan', {}, {}, {}, 'Belum Bayar', {})",
        crate::audit::q(&no_reg), crate::audit::q(&no_rawat), crate::audit::q(&b.kd_dokter),
        crate::audit::q(&b.no_rkm_medis), crate::audit::q(&b.kd_poli),
        crate::audit::q(&pj_nama), crate::audit::q(&pj_almt), crate::audit::q(&pj_hbg), crate::audit::q(biaya_reg),
        crate::audit::q(stts_daftar),
        crate::audit::q(&kd_pj_final),
        crate::audit::q(umurdaftar), crate::audit::q(sttsumur), crate::audit::q(status_poli),
    )).await;

    let now_jam = chrono::Local::now().format("%H:%M:%S").to_string();
    let tanggal = chrono::Local::now().format("%Y-%m-%d").to_string();

    // Log activity
    let _ = crate::handlers::anjungan_admin::log_activity(
        &state.pool, "walkin", "daftar",
        crate::handlers::anjungan_admin::LogActivityFields {
            no_rkm_medis: Some(b.no_rkm_medis.clone()),
            no_rawat:     Some(no_rawat.clone()),
            no_reg:       Some(no_reg.clone()),
            sukses:       Some(true),
            ..Default::default()
        }
    ).await;

    Ok(Json(DaftarResult {
        no_rawat, no_reg, no_rkm_medis: b.no_rkm_medis.clone(),
        nama_pasien: nama, kd_poli: b.kd_poli.clone(), nm_poli,
        kd_dokter: b.kd_dokter.clone(), nm_dokter,
        tanggal, jam: now_jam, biaya_reg,
        status_poli: status_poli.into(),
        stts_daftar: stts_daftar.into(),
    }))
}
