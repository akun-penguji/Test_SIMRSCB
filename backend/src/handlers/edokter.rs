// edokter — API untuk aplikasi web dokter (mobile). Dokter login dengan akun
// user Khanza (username = NIP); NIP = kd_dokter secara konvensi data, sehingga
// semua query pasien di-key ke reg_periksa.kd_dokter = claims.kode.
//
// Tahap 1: read-only (identitas dokter, daftar pasien ralan/igd/ranap, lihat
// SOAPIE, lihat resep). Input SOAPIE/resep menyusul di tahap 2.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error edokter: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}

// ── GET /edokter/me — resolusi dokter yang login ────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct DokterMe {
    pub kd_dokter: String,
    pub nm_dokter: String,
    pub jk:        Option<String>,
    pub kd_sps:    Option<String>,
    pub nm_sps:    Option<String>,
    #[sqlx(default)]
    pub boleh_dokter_lain: bool, // hak akses lihat pasien dokter lain
}

#[derive(Deserialize)]
pub struct MeQuery {
    pub kd_dokter: Option<String>, // hanya dipakai admin (mode uji impersonasi)
}

/// Kode dokter efektif: admin boleh impersonasi lewat ?kd_dokter=, selain itu
/// pakai kode login (= NIP = kd_dokter). None berarti admin belum mengisi kode.
fn kd_efektif(user: &AuthUser, kd_query: &Option<String>) -> Option<String> {
    if user.0.is_admin {
        match kd_query.as_deref() {
            Some(k) if !k.trim().is_empty() => Some(k.trim().to_string()),
            _ => None,
        }
    } else {
        Some(user.0.kode.clone())
    }
}

/// Dokter dengan hak akses "akses dokter lain" (kolom user.akses_dokter_lain_rawat_jalan
/// = 'true') boleh melihat pasien milik dokter lain. Admin selalu boleh.
async fn boleh_dokter_lain(state: &AppState, user: &AuthUser) -> bool {
    if user.0.is_admin { return true; }
    let val: Option<String> = sqlx::query_scalar::<_, Option<String>>(
        "SELECT CAST(akses_dokter_lain_rawat_jalan AS CHAR) FROM user WHERE id_user = AES_ENCRYPT(?, 'nur') LIMIT 1"
    ).bind(&user.0.kode).fetch_optional(&state.pool).await.ok().flatten().flatten();
    matches!(val.as_deref(), Some(v) if v.eq_ignore_ascii_case("true") || v == "1" || v == "-1")
}

pub async fn me(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<MeQuery>,
) -> Result<Json<DokterMe>, (StatusCode, Json<Value>)> {
    let boleh = boleh_dokter_lain(&state, &user).await;
    let kd = match kd_efektif(&user, &q.kd_dokter) {
        Some(k) => k,
        // Admin/superadmin tanpa kode dokter — mode "semua pasien"
        None => return Ok(Json(DokterMe {
            kd_dokter: String::new(),
            nm_dokter: "Superadmin — Semua Pasien".to_string(),
            jk: None, kd_sps: None, nm_sps: Some("Semua Dokter".to_string()),
            boleh_dokter_lain: true,
        })),
    };

    let row: Option<DokterMe> = sqlx::query_as(
        "SELECT d.kd_dokter, d.nm_dokter, d.jk, d.kd_sps, sp.nm_sps \
         FROM dokter d \
         LEFT JOIN spesialis sp ON d.kd_sps = sp.kd_sps \
         WHERE d.kd_dokter = ?"
    )
    .bind(&kd)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;

    match row {
        Some(mut d) => { d.boleh_dokter_lain = boleh; Ok(Json(d)) }
        None if user.0.is_admin => Ok(Json(DokterMe {
            kd_dokter: kd, nm_dokter: "(kode dokter tidak ditemukan)".to_string(),
            jk: None, kd_sps: None, nm_sps: None, boleh_dokter_lain: true,
        })),
        None => Err((StatusCode::FORBIDDEN,
            Json(json!({"error": "Akun ini bukan dokter (kd_dokter tidak ditemukan)"})))),
    }
}

// ── GET /edokter/pasien?jenis=ralan|igd|ranap ───────────────────────────────

#[derive(Deserialize)]
pub struct PasienQuery {
    pub jenis:     Option<String>, // ralan (default) | igd | ranap
    pub tgl_awal:  Option<String>,
    pub tgl_akhir: Option<String>,
    pub cari:      Option<String>,
    pub kd_dokter: Option<String>, // admin: impersonasi mode uji
}

#[derive(Serialize, sqlx::FromRow)]
pub struct PasienRow {
    pub no_rawat:       String,
    pub no_reg:         Option<String>,
    pub tgl:            Option<String>,
    pub jam:            Option<String>,
    pub no_rm:          Option<String>,
    pub nm_pasien:      Option<String>,
    pub jk:             Option<String>,
    pub umur:           Option<String>,
    pub lokasi:         Option<String>, // nm_poli / nm_bangsal-kamar
    pub png_jawab:      Option<String>,
    pub status:         Option<String>, // stts (ralan/igd) / stts_pulang (ranap)
    pub dokter:         Option<String>, // nm_dokter (berguna saat admin lihat semua)
}

pub async fn list_pasien(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<PasienQuery>,
) -> Result<Json<Vec<PasienRow>>, (StatusCode, Json<Value>)> {
    // Admin/superadmin tanpa kode dokter → tampilkan SEMUA pasien (kd kosong = tanpa filter).
    // Admin boleh impersonasi dokter tertentu via ?kd_dokter=. Dokter biasa → hanya miliknya,
    // KECUALI dokter dengan hak "akses dokter lain": default semua, boleh saring ?kd_dokter=.
    let kd = if boleh_dokter_lain(&state, &user).await {
        q.kd_dokter.as_deref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).unwrap_or_default()
    } else {
        user.0.kode.clone()
    };
    let jenis = q.jenis.unwrap_or_else(|| "ralan".to_string());
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tgl_awal  = q.tgl_awal.unwrap_or_else(|| today.clone());
    let tgl_akhir = q.tgl_akhir.unwrap_or_else(|| today.clone());
    let cari_like = format!("%{}%", q.cari.unwrap_or_default());

    let data: Vec<PasienRow> = match jenis.as_str() {
        "ranap" => sqlx::query_as(
            // Rawat inap: seorang dokter dianggap 'pemilik' pasien bila jadi DPJP
            // (dpjp_ranap) ATAU dokter registrasi. Kolom dokter menampilkan DPJP.
            "SELECT rp.no_rawat, rp.no_reg, CAST(ki.tgl_masuk AS CHAR) AS tgl, CAST(ki.jam_masuk AS CHAR) AS jam, \
                    p.no_rkm_medis AS no_rm, p.nm_pasien, p.jk, \
                    CONCAT(IFNULL(rp.umurdaftar,''),' ',IFNULL(rp.sttsumur,'')) AS umur, \
                    CONCAT(IFNULL(b.nm_bangsal,''),' - ',IFNULL(ki.kd_kamar,'')) AS lokasi, \
                    pj.png_jawab, ki.stts_pulang AS status, \
                    IFNULL((SELECT GROUP_CONCAT(DISTINCT dk.nm_dokter SEPARATOR ', ') \
                            FROM dpjp_ranap dp2 JOIN dokter dk ON dk.kd_dokter = dp2.kd_dokter \
                            WHERE dp2.no_rawat = rp.no_rawat), d.nm_dokter) AS dokter \
             FROM kamar_inap ki \
             INNER JOIN reg_periksa rp ON rp.no_rawat = ki.no_rawat \
             INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis \
             LEFT JOIN kamar k ON k.kd_kamar = ki.kd_kamar \
             LEFT JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal \
             LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj \
             LEFT JOIN dokter d ON d.kd_dokter = rp.kd_dokter \
             WHERE (? = '' OR rp.kd_dokter = ? \
                    OR EXISTS(SELECT 1 FROM dpjp_ranap dp WHERE dp.no_rawat = rp.no_rawat AND dp.kd_dokter = ?)) \
               AND ki.stts_pulang IN ('-','Masih Dirawat') \
               AND (p.nm_pasien LIKE ? OR rp.no_rawat LIKE ? OR p.no_rkm_medis LIKE ?) \
             ORDER BY ki.tgl_masuk DESC, ki.jam_masuk DESC LIMIT 200"
        )
        .bind(&kd).bind(&kd).bind(&kd).bind(&cari_like).bind(&cari_like).bind(&cari_like)
        .fetch_all(&state.pool).await.map_err(db_err)?,

        jenis_val => {
            // ralan (kd_poli != IGDK) atau igd (kd_poli = IGDK)
            let is_igd = jenis_val == "igd";
            let sql = format!(
                "SELECT r.no_rawat, r.no_reg, CAST(r.tgl_registrasi AS CHAR) AS tgl, CAST(r.jam_reg AS CHAR) AS jam, \
                        p.no_rkm_medis AS no_rm, p.nm_pasien, p.jk, \
                        CONCAT(IFNULL(r.umurdaftar,''),' ',IFNULL(r.sttsumur,'')) AS umur, \
                        po.nm_poli AS lokasi, pj.png_jawab, r.stts AS status, dr.nm_dokter AS dokter \
                 FROM reg_periksa r \
                 INNER JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis \
                 LEFT JOIN poliklinik po ON r.kd_poli = po.kd_poli \
                 LEFT JOIN penjab pj ON r.kd_pj = pj.kd_pj \
                 LEFT JOIN dokter dr ON dr.kd_dokter = r.kd_dokter \
                 WHERE (? = '' OR r.kd_dokter = ?) AND r.kd_poli {} 'IGDK' \
                   AND r.tgl_registrasi BETWEEN ? AND ? \
                   AND (p.nm_pasien LIKE ? OR r.no_rawat LIKE ? OR p.no_rkm_medis LIKE ?) \
                 ORDER BY r.tgl_registrasi DESC, r.jam_reg DESC LIMIT 200",
                if is_igd { "=" } else { "!=" }
            );
            sqlx::query_as(&sql)
                .bind(&kd).bind(&kd).bind(&tgl_awal).bind(&tgl_akhir)
                .bind(&cari_like).bind(&cari_like).bind(&cari_like)
                .fetch_all(&state.pool).await.map_err(db_err)?
        }
    };

    Ok(Json(data))
}

// ── GET /edokter/soapie?no_rawat=&jenis= ────────────────────────────────────

#[derive(Deserialize)]
pub struct SoapieQuery {
    pub no_rawat: String,
    pub jenis:    Option<String>, // ranap → pemeriksaan_ranap; selain itu pemeriksaan_ralan
}

#[derive(Serialize, sqlx::FromRow)]
pub struct SoapieRow {
    pub tgl_perawatan: Option<String>,
    pub jam_rawat:     Option<String>,
    pub suhu_tubuh:    Option<String>,
    pub tensi:         Option<String>,
    pub nadi:          Option<String>,
    pub respirasi:     Option<String>,
    pub tinggi:        Option<String>,
    pub berat:         Option<String>,
    pub spo2:          Option<String>,
    pub gcs:           Option<String>,
    pub kesadaran:     Option<String>,
    pub keluhan:       Option<String>,   // S
    pub pemeriksaan:   Option<String>,   // O
    pub penilaian:     Option<String>,   // A
    pub rtl:           Option<String>,   // P
    pub instruksi:     Option<String>,   // I
    pub evaluasi:      Option<String>,   // E
    pub alergi:        Option<String>,
    pub petugas:       Option<String>,
    #[sqlx(default)]
    pub milik:         i64,  // 1 bila catatan milik user login (atau admin) → boleh edit/hapus
}

pub async fn soapie(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<SoapieQuery>,
) -> Result<Json<Vec<SoapieRow>>, (StatusCode, Json<Value>)> {
    let tabel = if q.jenis.as_deref() == Some("ranap") { "pemeriksaan_ranap" } else { "pemeriksaan_ralan" };
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let sql = format!(
        "SELECT CAST(x.tgl_perawatan AS CHAR) AS tgl_perawatan, CAST(x.jam_rawat AS CHAR) AS jam_rawat, \
                x.suhu_tubuh, x.tensi, x.nadi, x.respirasi, \
                x.tinggi, x.berat, x.spo2, x.gcs, x.kesadaran, x.keluhan, x.pemeriksaan, \
                x.penilaian, x.rtl, x.instruksi, x.evaluasi, x.alergi, \
                IFNULL(pg.nama, x.nip) AS petugas, \
                (x.nip = ? OR ? = 1) AS milik \
         FROM {} x \
         LEFT JOIN pegawai pg ON pg.nik = x.nip \
         WHERE x.no_rawat = ? \
         ORDER BY x.tgl_perawatan DESC, x.jam_rawat DESC LIMIT 100",
        tabel
    );
    let data: Vec<SoapieRow> = sqlx::query_as(&sql)
        .bind(&user.0.kode).bind(admin)
        .bind(&q.no_rawat)
        .fetch_all(&state.pool)
        .await
        .map_err(db_err)?;
    Ok(Json(data))
}

// ── GET /edokter/resep?no_rawat= ────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ResepQuery {
    pub no_rawat: String,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct ResepObatDetail {
    pub kode_brng:   String,
    pub nama_brng:   Option<String>,
    pub jml:         Option<String>,
    pub aturan_pakai: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct ResepRacikan {
    pub no_racik:     Option<String>,
    pub nama_racik:   Option<String>,
    pub jml_dr:       Option<String>,
    pub aturan_pakai: Option<String>,
    pub keterangan:   Option<String>,
}

#[derive(Serialize)]
pub struct ResepHeader {
    pub no_resep:      String,
    pub tgl_peresepan: Option<String>,
    pub jam_peresepan: Option<String>,
    pub status:        Option<String>,
    pub obat:          Vec<ResepObatDetail>,
    pub racikan:       Vec<ResepRacikan>,
}

pub async fn resep(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ResepQuery>,
) -> Result<Json<Vec<ResepHeader>>, (StatusCode, Json<Value>)> {
    let headers: Vec<(String, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT no_resep, CAST(tgl_peresepan AS CHAR) AS tgl_peresepan, \
                CAST(jam_peresepan AS CHAR) AS jam_peresepan, status \
         FROM resep_obat WHERE no_rawat = ? \
         ORDER BY tgl_peresepan DESC, jam_peresepan DESC LIMIT 50"
    )
    .bind(&q.no_rawat)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    let mut out: Vec<ResepHeader> = Vec::with_capacity(headers.len());
    for (no_resep, tgl, jam, status) in headers {
        let obat: Vec<ResepObatDetail> = sqlx::query_as(
            "SELECT rd.kode_brng, db.nama_brng, CAST(rd.jml AS CHAR) AS jml, rd.aturan_pakai \
             FROM resep_dokter rd \
             LEFT JOIN databarang db ON rd.kode_brng = db.kode_brng \
             WHERE rd.no_resep = ?"
        )
        .bind(&no_resep)
        .fetch_all(&state.pool)
        .await
        .map_err(db_err)?;

        let racikan: Vec<ResepRacikan> = sqlx::query_as(
            "SELECT no_racik, nama_racik, CAST(jml_dr AS CHAR) AS jml_dr, aturan_pakai, keterangan \
             FROM resep_dokter_racikan WHERE no_resep = ? \
             GROUP BY no_racik, nama_racik, jml_dr, aturan_pakai, keterangan"
        )
        .bind(&no_resep)
        .fetch_all(&state.pool)
        .await
        .map_err(db_err)?;

        out.push(ResepHeader {
            no_resep, tgl_peresepan: tgl, jam_peresepan: jam, status, obat, racikan,
        });
    }

    Ok(Json(out))
}

// ── Tahap 2: INPUT ──────────────────────────────────────────────────────────

// POST /edokter/soapie — simpan catatan pemeriksaan BARU (tidak menimpa).
// Ralan/IGD → pemeriksaan_ralan; ranap → pemeriksaan_ranap. nip = kd_dokter.
#[derive(Deserialize)]
pub struct SoapieInput {
    pub no_rawat:    String,
    pub jenis:       Option<String>,
    pub suhu_tubuh:  Option<String>,
    pub tensi:       Option<String>,
    pub nadi:        Option<String>,
    pub respirasi:   Option<String>,
    pub tinggi:      Option<String>,
    pub berat:       Option<String>,
    pub spo2:        Option<String>,
    pub gcs:         Option<String>,
    pub kesadaran:   Option<String>,
    pub keluhan:     Option<String>,   // S
    pub pemeriksaan: Option<String>,   // O
    pub penilaian:   Option<String>,   // A
    pub rtl:         Option<String>,   // P
    pub instruksi:   Option<String>,   // I
    pub evaluasi:    Option<String>,   // E
    pub alergi:      Option<String>,
    // Waktu bisa diatur manual (kosong = sekarang). Untuk edit, kirim edit_tgl+edit_jam
    // (waktu ASAL baris yang diedit) supaya baris yang tepat di-update.
    pub tgl_perawatan: Option<String>, // target "yyyy-MM-dd"
    pub jam_rawat:     Option<String>, // target "HH:mm:ss"
    pub edit_tgl:      Option<String>, // edit: tgl asli
    pub edit_jam:      Option<String>, // edit: jam asli
}

pub async fn simpan_soapie(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<SoapieInput>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "no_rawat wajib"}))));
    }
    let tabel = if b.jenis.as_deref() == Some("ranap") { "pemeriksaan_ranap" } else { "pemeriksaan_ralan" };
    let kesadaran = match b.kesadaran.as_deref() {
        Some(k) if !k.trim().is_empty() => k.trim().to_string(),
        _ => "Compos Mentis".to_string(),
    };
    let s = |o: &Option<String>| o.clone().unwrap_or_default();
    let tgl_in = s(&b.tgl_perawatan);
    let jam_in = s(&b.jam_rawat);
    let edit_tgl = s(&b.edit_tgl);
    let edit_jam = s(&b.edit_jam);
    let is_edit = !edit_tgl.trim().is_empty() && !edit_jam.trim().is_empty();

    if is_edit {
        // Edit baris yang sudah ada (identifikasi via waktu asal + nip pembuat).
        let sql = format!(
            "UPDATE {} SET tgl_perawatan=COALESCE(NULLIF(?,''),CURDATE()), jam_rawat=COALESCE(NULLIF(?,''),CURTIME()), \
             suhu_tubuh=?, tensi=?, nadi=?, respirasi=?, tinggi=?, berat=?, spo2=?, gcs=?, kesadaran=?, \
             keluhan=?, pemeriksaan=?, alergi=?, penilaian=?, rtl=?, instruksi=?, evaluasi=? \
             WHERE no_rawat=? AND tgl_perawatan=? AND jam_rawat=? AND nip=?",
            tabel
        );
        let res = sqlx::query(&sql)
            .bind(&tgl_in).bind(&jam_in)
            .bind(s(&b.suhu_tubuh)).bind(s(&b.tensi)).bind(s(&b.nadi)).bind(s(&b.respirasi))
            .bind(s(&b.tinggi)).bind(s(&b.berat)).bind(s(&b.spo2)).bind(s(&b.gcs))
            .bind(&kesadaran).bind(s(&b.keluhan)).bind(s(&b.pemeriksaan)).bind(s(&b.alergi))
            .bind(s(&b.penilaian)).bind(s(&b.rtl)).bind(s(&b.instruksi)).bind(s(&b.evaluasi))
            .bind(&b.no_rawat).bind(&edit_tgl).bind(&edit_jam).bind(&user.0.kode)
            .execute(&state.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Hanya bisa diedit oleh dokter yang membuat catatan ini"}))));
        }
        crate::audit::log_sql(&state.pool, &user.0.kode,
            &format!("edokter: EDIT SOAPIE {} no_rawat={} ({} {})", tabel, b.no_rawat, edit_tgl, edit_jam)).await;
        return Ok(Json(json!({"ok": true, "edited": true})));
    }

    let sql = format!(
        "INSERT INTO {} (no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh, tensi, nadi, respirasi, \
         tinggi, berat, spo2, gcs, kesadaran, keluhan, pemeriksaan, alergi, penilaian, rtl, \
         instruksi, evaluasi, nip) \
         VALUES (?, COALESCE(NULLIF(?,''),CURDATE()), COALESCE(NULLIF(?,''),CURTIME()), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        tabel
    );
    sqlx::query(&sql)
        .bind(&b.no_rawat).bind(&tgl_in).bind(&jam_in)
        .bind(s(&b.suhu_tubuh)).bind(s(&b.tensi)).bind(s(&b.nadi)).bind(s(&b.respirasi))
        .bind(s(&b.tinggi)).bind(s(&b.berat)).bind(s(&b.spo2)).bind(s(&b.gcs))
        .bind(&kesadaran).bind(s(&b.keluhan)).bind(s(&b.pemeriksaan)).bind(s(&b.alergi))
        .bind(s(&b.penilaian)).bind(s(&b.rtl)).bind(s(&b.instruksi)).bind(s(&b.evaluasi))
        .bind(&user.0.kode)
        .execute(&state.pool).await.map_err(db_err)?;

    crate::audit::log_sql(&state.pool, &user.0.kode,
        &format!("edokter: SIMPAN SOAPIE {} no_rawat={}", tabel, b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// POST /edokter/soapie/hapus — hapus catatan SOAPIE. Hanya oleh dokter pembuat (nip).
#[derive(Deserialize)]
pub struct SoapieDel {
    pub no_rawat: String,
    pub jenis: Option<String>,
    pub tgl_perawatan: String,
    pub jam_rawat: String,
}
pub async fn hapus_soapie(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<SoapieDel>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tabel = if b.jenis.as_deref() == Some("ranap") { "pemeriksaan_ranap" } else { "pemeriksaan_ralan" };
    let sql = format!("DELETE FROM {} WHERE no_rawat=? AND tgl_perawatan=? AND jam_rawat=? AND nip=?", tabel);
    let res = sqlx::query(&sql)
        .bind(&b.no_rawat).bind(&b.tgl_perawatan).bind(&b.jam_rawat).bind(&user.0.kode)
        .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Hanya bisa dihapus oleh dokter yang membuat catatan ini"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode,
        &format!("edokter: HAPUS SOAPIE {} no_rawat={} ({} {})", tabel, b.no_rawat, b.tgl_perawatan, b.jam_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// GET /edokter/obat?cari= — cari obat/barang aktif untuk resep.
#[derive(Deserialize)]
pub struct ObatQuery { pub cari: Option<String> }

#[derive(Serialize, sqlx::FromRow)]
pub struct ObatRow {
    pub kode_brng: String,
    pub nama_brng: Option<String>,
    pub kode_sat:  Option<String>,
}

pub async fn cari_obat(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ObatQuery>,
) -> Result<Json<Vec<ObatRow>>, (StatusCode, Json<Value>)> {
    let cari = q.cari.unwrap_or_default();
    if cari.trim().len() < 2 { return Ok(Json(vec![])); }
    let like = format!("%{}%", cari.trim());
    let rows: Vec<ObatRow> = sqlx::query_as(
        "SELECT kode_brng, nama_brng, kode_sat FROM databarang \
         WHERE status = '1' AND (nama_brng LIKE ? OR kode_brng LIKE ?) \
         ORDER BY nama_brng LIMIT 30"
    ).bind(&like).bind(&like).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// POST /edokter/resep — buat resep_obat (header) + resep_dokter (detail obat).
// Resep baru: tgl_perawatan='0000-00-00' → status "Belum Terlayani" di apotek.
#[derive(Deserialize)]
pub struct ResepItemIn { pub kode_brng: String, pub jml: String, pub aturan_pakai: Option<String> }

#[derive(Deserialize)]
pub struct ResepInput {
    pub no_rawat: String,
    pub jenis:    Option<String>,
    pub obat:     Vec<ResepItemIn>,
}

pub async fn simpan_resep(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<ResepInput>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "no_rawat wajib"}))));
    }
    let obat: Vec<ResepItemIn> = b.obat.into_iter()
        .filter(|o| !o.kode_brng.trim().is_empty()).collect();
    if obat.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Minimal satu obat"}))));
    }
    let status = if b.jenis.as_deref() == Some("ranap") { "ranap" } else { "ralan" };
    let prefix = if status == "ranap" { "RI" } else { "RJ" };

    let mut tx = state.pool.begin().await.map_err(db_err)?;

    // no_resep = YYYYMMDD + prefix + urutan 4 digit (per tanggal peresepan)
    let (seq,): (i64,) = sqlx::query_as(
        "SELECT IFNULL(MAX(CONVERT(RIGHT(no_resep,4), SIGNED)),0)+1 \
         FROM resep_obat WHERE tgl_peresepan = CURDATE() FOR UPDATE"
    ).fetch_one(&mut *tx).await.map_err(db_err)?;
    let tgl: String = sqlx::query_scalar("SELECT DATE_FORMAT(CURDATE(),'%Y%m%d')")
        .fetch_one(&mut *tx).await.map_err(db_err)?;
    let no_resep = format!("{}{}{:04}", tgl, prefix, seq);

    sqlx::query(
        "INSERT INTO resep_obat (no_resep, tgl_perawatan, jam, no_rawat, kd_dokter, \
         tgl_peresepan, jam_peresepan, status, tgl_penyerahan, jam_penyerahan) \
         VALUES (?, '0000-00-00', '00:00:00', ?, ?, CURDATE(), CURTIME(), ?, '0000-00-00', '00:00:00')"
    )
    .bind(&no_resep).bind(&b.no_rawat).bind(&user.0.kode).bind(status)
    .execute(&mut *tx).await.map_err(db_err)?;

    for o in &obat {
        sqlx::query(
            "INSERT INTO resep_dokter (no_resep, kode_brng, jml, aturan_pakai) VALUES (?, ?, ?, ?)"
        )
        .bind(&no_resep).bind(o.kode_brng.trim()).bind(o.jml.trim())
        .bind(o.aturan_pakai.clone().unwrap_or_default())
        .execute(&mut *tx).await.map_err(db_err)?;
    }

    tx.commit().await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode,
        &format!("edokter: BUAT RESEP {} no_rawat={} ({} obat)", no_resep, b.no_rawat, obat.len())).await;
    Ok(Json(json!({"ok": true, "no_resep": no_resep})))
}

#[derive(Deserialize)]
pub struct CopyResepInput {
    pub no_rawat: String,
    pub no_resep: String, // resep sumber yang disalin
    #[serde(default)] pub jenis: Option<String>,
}

/// Copy Resep: buat resep baru (no_resep baru, hari ini) dengan menyalin seluruh
/// obat + aturan pakai dari resep sumber. Dokter/tanggal peresepan = sekarang.
pub async fn copy_resep(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<CopyResepInput>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_rawat.trim().is_empty() || b.no_resep.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "no_rawat & no_resep wajib"}))));
    }
    // Ambil obat dari resep sumber.
    let src: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT kode_brng, IFNULL(jml,'') , IFNULL(aturan_pakai,'') FROM resep_dokter WHERE no_resep = ?"
    ).bind(&b.no_resep).fetch_all(&state.pool).await.map_err(db_err)?;
    if src.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Resep sumber tidak punya obat untuk disalin"}))));
    }
    let status = if b.jenis.as_deref() == Some("ranap") { "ranap" } else { "ralan" };
    let prefix = if status == "ranap" { "RI" } else { "RJ" };

    let mut tx = state.pool.begin().await.map_err(db_err)?;
    let (seq,): (i64,) = sqlx::query_as(
        "SELECT IFNULL(MAX(CONVERT(RIGHT(no_resep,4), SIGNED)),0)+1 FROM resep_obat WHERE tgl_peresepan = CURDATE() FOR UPDATE"
    ).fetch_one(&mut *tx).await.map_err(db_err)?;
    let tgl: String = sqlx::query_scalar("SELECT DATE_FORMAT(CURDATE(),'%Y%m%d')")
        .fetch_one(&mut *tx).await.map_err(db_err)?;
    let no_resep = format!("{}{}{:04}", tgl, prefix, seq);
    sqlx::query(
        "INSERT INTO resep_obat (no_resep, tgl_perawatan, jam, no_rawat, kd_dokter, \
         tgl_peresepan, jam_peresepan, status, tgl_penyerahan, jam_penyerahan) \
         VALUES (?, '0000-00-00', '00:00:00', ?, ?, CURDATE(), CURTIME(), ?, '0000-00-00', '00:00:00')"
    )
    .bind(&no_resep).bind(&b.no_rawat).bind(&user.0.kode).bind(status)
    .execute(&mut *tx).await.map_err(db_err)?;
    for (kode, jml, aturan) in &src {
        sqlx::query("INSERT INTO resep_dokter (no_resep, kode_brng, jml, aturan_pakai) VALUES (?, ?, ?, ?)")
            .bind(&no_resep).bind(kode).bind(jml).bind(aturan)
            .execute(&mut *tx).await.map_err(db_err)?;
    }
    tx.commit().await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode,
        &format!("edokter: COPY RESEP {} <- {} no_rawat={} ({} obat)", no_resep, b.no_resep, b.no_rawat, src.len())).await;
    Ok(Json(json!({"ok": true, "no_resep": no_resep})))
}

// ── Tahap 3: Laboratorium & Radiologi ───────────────────────────────────────

#[derive(Deserialize)]
pub struct JenisQuery { pub cari: Option<String> }

#[derive(Serialize, sqlx::FromRow)]
pub struct JenisPrw { pub kd_jenis_prw: String, pub nm_perawatan: Option<String> }

// GET /edokter/lab/jenis?cari=  — katalog pemeriksaan lab aktif
pub async fn lab_jenis(
    _user: AuthUser, State(state): State<AppState>, Query(q): Query<JenisQuery>,
) -> Result<Json<Vec<JenisPrw>>, (StatusCode, Json<Value>)> {
    let like = format!("%{}%", q.cari.unwrap_or_default());
    let rows: Vec<JenisPrw> = sqlx::query_as(
        "SELECT kd_jenis_prw, nm_perawatan FROM jns_perawatan_lab \
         WHERE status='1' AND (nm_perawatan LIKE ? OR kd_jenis_prw LIKE ?) \
         ORDER BY nm_perawatan LIMIT 40"
    ).bind(&like).bind(&like).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// GET /edokter/rad/jenis?cari=
pub async fn rad_jenis(
    _user: AuthUser, State(state): State<AppState>, Query(q): Query<JenisQuery>,
) -> Result<Json<Vec<JenisPrw>>, (StatusCode, Json<Value>)> {
    let like = format!("%{}%", q.cari.unwrap_or_default());
    let rows: Vec<JenisPrw> = sqlx::query_as(
        "SELECT kd_jenis_prw, nm_perawatan FROM jns_perawatan_radiologi \
         WHERE status='1' AND (nm_perawatan LIKE ? OR kd_jenis_prw LIKE ?) \
         ORDER BY nm_perawatan LIMIT 40"
    ).bind(&like).bind(&like).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct NoRawatQuery { pub no_rawat: String }

// ── Daftar permintaan (lab / rad) ───────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct PermintaanRow {
    pub noorder:        String,
    pub tgl_permintaan: Option<String>,
    pub jam_permintaan: Option<String>,
    pub status:         Option<String>,
    pub dokter_perujuk: Option<String>,
    pub diagnosa_klinis: Option<String>,
    pub pemeriksaan:    Option<String>, // GROUP_CONCAT nama pemeriksaan
}

pub async fn lab_permintaan(
    _user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatQuery>,
) -> Result<Json<Vec<PermintaanRow>>, (StatusCode, Json<Value>)> {
    let rows: Vec<PermintaanRow> = sqlx::query_as(
        "SELECT pl.noorder, CAST(pl.tgl_permintaan AS CHAR) AS tgl_permintaan, \
                CAST(pl.jam_permintaan AS CHAR) AS jam_permintaan, pl.status, pl.dokter_perujuk, \
                pl.diagnosa_klinis, \
                (SELECT GROUP_CONCAT(j.nm_perawatan SEPARATOR ', ') FROM permintaan_pemeriksaan_lab pp \
                 JOIN jns_perawatan_lab j ON j.kd_jenis_prw=pp.kd_jenis_prw WHERE pp.noorder=pl.noorder) AS pemeriksaan \
         FROM permintaan_lab pl WHERE pl.no_rawat=? ORDER BY pl.tgl_permintaan DESC, pl.jam_permintaan DESC LIMIT 50"
    ).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

pub async fn rad_permintaan(
    _user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatQuery>,
) -> Result<Json<Vec<PermintaanRow>>, (StatusCode, Json<Value>)> {
    let rows: Vec<PermintaanRow> = sqlx::query_as(
        "SELECT pr.noorder, CAST(pr.tgl_permintaan AS CHAR) AS tgl_permintaan, \
                CAST(pr.jam_permintaan AS CHAR) AS jam_permintaan, pr.status, pr.dokter_perujuk, \
                pr.diagnosa_klinis, \
                (SELECT GROUP_CONCAT(j.nm_perawatan SEPARATOR ', ') FROM permintaan_pemeriksaan_radiologi pp \
                 JOIN jns_perawatan_radiologi j ON j.kd_jenis_prw=pp.kd_jenis_prw WHERE pp.noorder=pr.noorder) AS pemeriksaan \
         FROM permintaan_radiologi pr WHERE pr.no_rawat=? ORDER BY pr.tgl_permintaan DESC, pr.jam_permintaan DESC LIMIT 50"
    ).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// ── Buat permintaan baru ────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct BuatPermintaan {
    pub no_rawat:        String,
    pub jenis:           Option<String>,          // ralan(default)/igd → 'ralan'; ranap → 'ranap'
    pub tests:           Vec<String>,             // kd_jenis_prw
    pub diagnosa_klinis: Option<String>,
    pub informasi_tambahan: Option<String>,
    #[serde(default)] pub prioritas: Option<String>, // 'Rutin'(default)/'Cito' — lab & radiologi
}

async fn gen_noorder(tx: &mut sqlx::Transaction<'_, sqlx::MySql>, tabel: &str, prefix: &str)
    -> Result<String, (StatusCode, Json<Value>)>
{
    let sql = format!(
        "SELECT IFNULL(MAX(CONVERT(RIGHT(noorder,4),SIGNED)),0)+1 FROM {} \
         WHERE tgl_permintaan = CURDATE() FOR UPDATE", tabel);
    let (seq,): (i64,) = sqlx::query_as(&sql).fetch_one(&mut **tx).await.map_err(db_err)?;
    let tgl: String = sqlx::query_scalar("SELECT DATE_FORMAT(CURDATE(),'%Y%m%d')")
        .fetch_one(&mut **tx).await.map_err(db_err)?;
    Ok(format!("{}{}{:04}", prefix, tgl, seq))
}

// Prioritas Cito/Rutin → tabel companion, meniru Java desktop (upsert-by-delete):
// hapus baris lama untuk noorder, lalu INSERT hanya bila Cito. Bila Rutin baris
// dibiarkan absen (query default 'Rutin' via IFNULL). Best-effort, non-fatal;
// aman walau tabel companion belum ada. Mengembalikan label prioritas terpakai.
async fn set_prioritas(pool: &sqlx::MySqlPool, tabel: &str, noorder: &str, prioritas: Option<&str>, nip: &str) -> &'static str {
    let prio = if prioritas == Some("Cito") { "Cito" } else { "Rutin" };
    let _ = sqlx::query(&format!("DELETE FROM {} WHERE noorder = ?", tabel))
        .bind(noorder).execute(pool).await;
    if prio == "Cito" {
        let _ = sqlx::query(&format!(
            "INSERT INTO {} (noorder, prioritas, nip) VALUES (?, 'Cito', ?)", tabel))
            .bind(noorder).bind(nip).execute(pool).await;
    }
    prio
}

pub async fn buat_lab(
    user: AuthUser, State(state): State<AppState>, Json(b): Json<BuatPermintaan>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tests: Vec<String> = b.tests.into_iter().filter(|t| !t.trim().is_empty()).collect();
    if b.no_rawat.trim().is_empty() || tests.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "no_rawat & minimal satu pemeriksaan wajib"}))));
    }
    // PAP 1.1 — indikasi/diagnosa klinis wajib diisi pada permintaan penunjang.
    if b.diagnosa_klinis.as_deref().map(|s| s.trim().is_empty()).unwrap_or(true) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Indikasi/diagnosa klinis wajib diisi (PAP 1.1)"}))));
    }
    let status = if b.jenis.as_deref() == Some("ranap") { "ranap" } else { "ralan" };
    let mut tx = state.pool.begin().await.map_err(db_err)?;
    let noorder = gen_noorder(&mut tx, "permintaan_lab", "PK").await?;

    sqlx::query(
        "INSERT INTO permintaan_lab (noorder, no_rawat, tgl_permintaan, jam_permintaan, tgl_sampel, \
         jam_sampel, tgl_hasil, jam_hasil, dokter_perujuk, status, informasi_tambahan, diagnosa_klinis) \
         VALUES (?, ?, CURDATE(), CURTIME(), '0000-00-00','00:00:00','0000-00-00','00:00:00', ?, ?, ?, ?)"
    ).bind(&noorder).bind(&b.no_rawat).bind(&user.0.kode).bind(status)
     .bind(b.informasi_tambahan.clone().unwrap_or_default())
     .bind(b.diagnosa_klinis.clone().unwrap_or_default())
     .execute(&mut *tx).await.map_err(db_err)?;

    for kd in &tests {
        sqlx::query("INSERT INTO permintaan_pemeriksaan_lab (noorder, kd_jenis_prw, stts_bayar) VALUES (?, ?, 'Belum')")
            .bind(&noorder).bind(kd).execute(&mut *tx).await.map_err(db_err)?;
        // detail per-template pemeriksaan
        sqlx::query(
            "INSERT INTO permintaan_detail_permintaan_lab (noorder, kd_jenis_prw, id_template, stts_bayar) \
             SELECT ?, kd_jenis_prw, id_template, 'Belum' FROM template_laboratorium WHERE kd_jenis_prw = ?"
        ).bind(&noorder).bind(kd).execute(&mut *tx).await.map_err(db_err)?;
    }
    tx.commit().await.map_err(db_err)?;
    let prio = set_prioritas(&state.pool, "permintaan_lab_prioritas", &noorder, b.prioritas.as_deref(), &user.0.kode).await;
    crate::audit::log_sql(&state.pool, &user.0.kode,
        &format!("edokter: PERMINTAAN LAB {} no_rawat={} ({} pemeriksaan, {})", noorder, b.no_rawat, tests.len(), prio)).await;
    Ok(Json(json!({"ok": true, "noorder": noorder})))
}

pub async fn buat_rad(
    user: AuthUser, State(state): State<AppState>, Json(b): Json<BuatPermintaan>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tests: Vec<String> = b.tests.into_iter().filter(|t| !t.trim().is_empty()).collect();
    if b.no_rawat.trim().is_empty() || tests.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "no_rawat & minimal satu pemeriksaan wajib"}))));
    }
    // PAP 1.1 — indikasi/diagnosa klinis wajib diisi pada permintaan penunjang.
    if b.diagnosa_klinis.as_deref().map(|s| s.trim().is_empty()).unwrap_or(true) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Indikasi/diagnosa klinis wajib diisi (PAP 1.1)"}))));
    }
    let status = if b.jenis.as_deref() == Some("ranap") { "ranap" } else { "ralan" };
    let mut tx = state.pool.begin().await.map_err(db_err)?;
    let noorder = gen_noorder(&mut tx, "permintaan_radiologi", "PR").await?;

    sqlx::query(
        "INSERT INTO permintaan_radiologi (noorder, no_rawat, tgl_permintaan, jam_permintaan, tgl_sampel, \
         jam_sampel, tgl_hasil, jam_hasil, dokter_perujuk, status, informasi_tambahan, diagnosa_klinis) \
         VALUES (?, ?, CURDATE(), CURTIME(), '0000-00-00','00:00:00','0000-00-00','00:00:00', ?, ?, ?, ?)"
    ).bind(&noorder).bind(&b.no_rawat).bind(&user.0.kode).bind(status)
     .bind(b.informasi_tambahan.clone().unwrap_or_default())
     .bind(b.diagnosa_klinis.clone().unwrap_or_default())
     .execute(&mut *tx).await.map_err(db_err)?;

    for kd in &tests {
        sqlx::query("INSERT INTO permintaan_pemeriksaan_radiologi (noorder, kd_jenis_prw, stts_bayar) VALUES (?, ?, 'Belum')")
            .bind(&noorder).bind(kd).execute(&mut *tx).await.map_err(db_err)?;
    }
    tx.commit().await.map_err(db_err)?;
    let prio = set_prioritas(&state.pool, "permintaan_radiologi_prioritas", &noorder, b.prioritas.as_deref(), &user.0.kode).await;
    crate::audit::log_sql(&state.pool, &user.0.kode,
        &format!("edokter: PERMINTAAN RADIOLOGI {} no_rawat={} ({} pemeriksaan, {})", noorder, b.no_rawat, tests.len(), prio)).await;
    Ok(Json(json!({"ok": true, "noorder": noorder})))
}

// ── Hasil (read-only) ───────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct HasilLabRow {
    pub tgl_periksa:   Option<String>,
    pub jam:           Option<String>,
    pub nm_perawatan:  Option<String>, // nama pemeriksaan (test)
    pub pemeriksaan:   Option<String>, // parameter
    pub nilai:         Option<String>,
    pub satuan:        Option<String>,
    pub nilai_rujukan: Option<String>,
    pub keterangan:    Option<String>,
}

pub async fn lab_hasil(
    _user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatQuery>,
) -> Result<Json<Vec<HasilLabRow>>, (StatusCode, Json<Value>)> {
    let rows: Vec<HasilLabRow> = sqlx::query_as(
        "SELECT CAST(d.tgl_periksa AS CHAR) AS tgl_periksa, CAST(d.jam AS CHAR) AS jam, \
                j.nm_perawatan, t.Pemeriksaan AS pemeriksaan, d.nilai, t.satuan, d.nilai_rujukan, d.keterangan \
         FROM detail_periksa_lab d \
         LEFT JOIN jns_perawatan_lab j ON j.kd_jenis_prw = d.kd_jenis_prw \
         LEFT JOIN template_laboratorium t ON t.kd_jenis_prw = d.kd_jenis_prw AND t.id_template = d.id_template \
         WHERE d.no_rawat = ? \
         ORDER BY d.tgl_periksa DESC, d.jam DESC, j.nm_perawatan, t.urut LIMIT 300"
    ).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct HasilRadRow {
    pub tgl_periksa: Option<String>,
    pub jam:         Option<String>,
    pub hasil:       Option<String>,
    pub jml_gambar:  i64,
}

pub async fn rad_hasil(
    _user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatQuery>,
) -> Result<Json<Vec<HasilRadRow>>, (StatusCode, Json<Value>)> {
    let rows: Vec<HasilRadRow> = sqlx::query_as(
        "SELECT CAST(h.tgl_periksa AS CHAR) AS tgl_periksa, CAST(h.jam AS CHAR) AS jam, h.hasil, \
                (SELECT COUNT(*) FROM gambar_radiologi g WHERE g.no_rawat=h.no_rawat \
                 AND g.tgl_periksa=h.tgl_periksa AND g.jam=h.jam) AS jml_gambar \
         FROM hasil_radiologi h WHERE h.no_rawat = ? \
         ORDER BY h.tgl_periksa DESC, h.jam DESC LIMIT 50"
    ).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// ── Gambar radiologi ────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct GambarRow {
    pub tgl_periksa:   Option<String>,
    pub jam:           Option<String>,
    pub lokasi_gambar: Option<String>,
}

// GET /edokter/rad/gambar?no_rawat= — daftar gambar untuk sebuah no_rawat
pub async fn rad_gambar(
    _user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatQuery>,
) -> Result<Json<Vec<GambarRow>>, (StatusCode, Json<Value>)> {
    let rows: Vec<GambarRow> = sqlx::query_as(
        "SELECT CAST(tgl_periksa AS CHAR) AS tgl_periksa, CAST(jam AS CHAR) AS jam, lokasi_gambar \
         FROM gambar_radiologi WHERE no_rawat = ? ORDER BY tgl_periksa DESC, jam DESC LIMIT 100"
    ).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct GambarFileQuery { pub f: String }

// GET /edokter/rad/gambar-file?f=pages/upload/xxx.jpg — streaming file gambar.
// Base dir dari simrscb_config key 'edokter_radiologi_dir' (default web Apache).
pub async fn rad_gambar_file(
    _user: AuthUser, State(state): State<AppState>, Query(q): Query<GambarFileQuery>,
) -> Result<Response, (StatusCode, Json<Value>)> {
    let rel = q.f.trim().to_string();
    // Anti path traversal: hanya izinkan pages/upload/<file>
    if rel.contains("..") || rel.starts_with('/') || !rel.starts_with("pages/upload/") {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "path gambar tidak valid"}))));
    }
    let base = sqlx::query_scalar::<_, String>(
        "SELECT nilai FROM simrscb_config WHERE kunci='edokter_radiologi_dir'"
    ).fetch_optional(&state.pool).await.ok().flatten()
     .filter(|s| !s.trim().is_empty())
     .unwrap_or_else(|| "/var/www/html/webapps/radiologi".to_string());

    let path = format!("{}/{}", base.trim_end_matches('/'), rel);
    let bytes = tokio::fs::read(&path).await
        .map_err(|_| (StatusCode::NOT_FOUND, Json(json!({"error": "gambar tidak ditemukan"}))))?;
    let low = rel.to_lowercase();
    let ct = if low.ends_with(".png") { "image/png" }
             else if low.ends_with(".webp") { "image/webp" }
             else { "image/jpeg" };
    Ok(([(axum::http::header::CONTENT_TYPE, ct)], bytes).into_response())
}

// ── Asesmen Awal Medis Kritis ICU (diisi dokter) ─────────────────────────────
// Satu tabel dengan versioning: status aktif/revisi/dibatalkan. Seluruh isian
// disimpan sebagai JSON di kolom `data`; kolom ringkas (kesadaran, diagnosa_kerja)
// untuk daftar/cari. Ganti = arsipkan versi aktif → revisi lalu sisipkan versi baru.
#[derive(Deserialize)]
pub struct IcuQuery {
    pub no_rawat: String,
    #[serde(default)] pub kd_dokter: Option<String>,
}
#[derive(sqlx::FromRow)]
struct IcuRec {
    id: i64,
    tanggal: Option<String>,
    tiba_ruangan: Option<String>,
    kd_dokter: String,
    data: String,
    created_by: String,
    created_at: Option<String>,
}
pub async fn get_icu(_user: AuthUser, State(state): State<AppState>, Query(q): Query<IcuQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let rec: Option<IcuRec> = sqlx::query_as(
        "SELECT id, CAST(tanggal AS CHAR) tanggal, CAST(tiba_ruangan AS CHAR) tiba_ruangan, \
                kd_dokter, IFNULL(data,'') data, IFNULL(created_by,'') created_by, CAST(created_at AS CHAR) created_at \
         FROM asesmen_awal_medis_kritis_icu WHERE no_rawat = ? AND status = 'aktif' ORDER BY id DESC LIMIT 1"
    ).bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    match rec {
        None => Ok(Json(json!({"exists": false}))),
        Some(r) => {
            let data: Value = serde_json::from_str(&r.data).unwrap_or_else(|_| json!({}));
            let nm_dokter: Option<String> = sqlx::query_scalar(
                "SELECT nm_dokter FROM dokter WHERE kd_dokter = ?"
            ).bind(&r.kd_dokter).fetch_optional(&state.pool).await.map_err(db_err)?;
            Ok(Json(json!({
                "exists": true, "id": r.id, "tanggal": r.tanggal, "tiba_ruangan": r.tiba_ruangan,
                "kd_dokter": r.kd_dokter, "nm_dokter": nm_dokter.unwrap_or_default(),
                "created_by": r.created_by, "created_at": r.created_at, "data": data
            })))
        }
    }
}

#[derive(Deserialize)]
pub struct IcuBody {
    pub no_rawat: String,
    #[serde(default)] pub kd_dokter: Option<String>,
    #[serde(default)] pub tanggal: String,        // "yyyy-MM-dd HH:mm:ss" atau ""
    #[serde(default)] pub tiba_ruangan: String,   // idem, "" = NULL
    #[serde(default)] pub data: Value,
    #[serde(default)] pub keterangan_edit: String,
}
pub async fn save_icu(user: AuthUser, State(state): State<AppState>, Json(b): Json<IcuBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let kd = kd_efektif(&user, &b.kd_dokter).ok_or((
        StatusCode::BAD_REQUEST, Json(json!({"error":"Admin harus mengisi kode dokter"}))))?;
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    let data_str = serde_json::to_string(&b.data).unwrap_or_else(|_| "{}".into());
    let get = |k: &str, n: usize| b.data.get(k).and_then(|v| v.as_str()).unwrap_or("").chars().take(n).collect::<String>();
    let kesadaran = get("kesadaran", 50);
    let diagnosa = get("diagnosis_kerja", 255);

    // Ganti versi aktif → revisi (bila ada)
    let active_id: Option<i64> = sqlx::query_scalar(
        "SELECT id FROM asesmen_awal_medis_kritis_icu WHERE no_rawat = ? AND status = 'aktif' ORDER BY id DESC LIMIT 1"
    ).bind(&b.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    if let Some(old) = active_id {
        sqlx::query(
            "UPDATE asesmen_awal_medis_kritis_icu SET status='revisi', updated_by=?, updated_at=NOW(), keterangan_edit=? WHERE id=?"
        ).bind(&user.0.kode).bind(&b.keterangan_edit).bind(old).execute(&state.pool).await.map_err(db_err)?;
    }
    let res = sqlx::query(
        "INSERT INTO asesmen_awal_medis_kritis_icu \
         (no_rawat, tanggal, tiba_ruangan, kesadaran, diagnosa_kerja, data, kd_dokter, status, created_by, created_at) \
         VALUES (?, COALESCE(NULLIF(?,''), NOW()), NULLIF(?,''), ?, ?, ?, ?, 'aktif', ?, NOW())"
    )
    .bind(&b.no_rawat).bind(&b.tanggal).bind(&b.tiba_ruangan)
    .bind(&kesadaran).bind(&diagnosa).bind(&data_str).bind(&kd).bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("asesmen_awal_medis_kritis_icu {} no_rawat={} (revisi={})", if active_id.is_some() {"ganti"} else {"baru"}, b.no_rawat, active_id.is_some())).await;
    Ok(Json(json!({"ok": true, "id": res.last_insert_id(), "revised": active_id.is_some()})))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct IcuHistori {
    pub id: i64,
    pub waktu_buat: Option<String>,
    pub created_by: String,
    pub tanggal: Option<String>,
    pub kesadaran: String,
    pub diagnosa_kerja: String,
    pub status: String,
    pub updated_at: Option<String>,
    pub updated_by: String,
    pub keterangan_edit: String,
}
pub async fn histori_icu(_user: AuthUser, State(state): State<AppState>, Query(q): Query<IcuQuery>)
  -> Result<Json<Vec<IcuHistori>>, (StatusCode, Json<Value>)> {
    let rows = sqlx::query_as::<_, IcuHistori>(
        "SELECT id, CAST(created_at AS CHAR) waktu_buat, IFNULL(created_by,'') created_by, \
                CAST(tanggal AS CHAR) tanggal, IFNULL(kesadaran,'') kesadaran, IFNULL(diagnosa_kerja,'') diagnosa_kerja, \
                IFNULL(status,'') status, CAST(updated_at AS CHAR) updated_at, IFNULL(updated_by,'') updated_by, \
                IFNULL(keterangan_edit,'') keterangan_edit \
         FROM asesmen_awal_medis_kritis_icu WHERE no_rawat = ? ORDER BY id DESC LIMIT 50"
    ).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

pub async fn batal_icu(user: AuthUser, State(state): State<AppState>, Json(b): Json<IcuBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    kd_efektif(&user, &b.kd_dokter).ok_or((
        StatusCode::BAD_REQUEST, Json(json!({"error":"Admin harus mengisi kode dokter"}))))?;
    let res = sqlx::query(
        "UPDATE asesmen_awal_medis_kritis_icu SET status='dibatalkan', updated_by=?, updated_at=NOW(), keterangan_edit=? \
         WHERE no_rawat = ? AND status = 'aktif'"
    ).bind(&user.0.kode).bind(&b.keterangan_edit).bind(&b.no_rawat).execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("asesmen_awal_medis_kritis_icu batal no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true, "dibatalkan": res.rows_affected()})))
}

// ── Asesmen Pra Anestesi/Sedasi (RM.IBS.11.004.2019) — tabel asesmen_pra_anestesi_rscb ──
const APA_COLS: &[&str] = &[
    "ruangan","diagnosa","tindakan_bedah","bb","tb","anamnesi","riwayat_asma","alergi","diabetes",
    "hipertensi","riwayat_operasi","jenis_anestesi_riwayat","komplikasi_riwayat","pemeriksaan_fisik",
    "keadaan_umum","gcs","td","nadi","rr","suhu","gerakan_leher","methohyoid","mallampati","thorax",
    "abdomen","ekstremitas","laboratorium","ekg","ro_thorax","lain_lain","asa","premedikasi","puasa",
    "penyulit","teknik_ga_lma","teknik_ga_ett","teknik_ga_tiva","teknik_ga_facemask",
    "teknik_sedasi_ringan","teknik_sedasi_sedang","teknik_sedasi_dalam",
    "teknik_spinal","teknik_epidural",
    "teknik_kaudal","teknik_blok_perifer","persediaan_darah","teknik_khusus_hipotensi",
    "teknik_khusus_ventilasi","teknik_khusus_lain","monitoring_ekg","monitoring_nadi","monitoring_spo2","monitoring_nibp",
    "monitoring_temp","monitoring_lain","monitoring_cvp","monitoring_arteri","monitoring_etco2","perawatan_pasca",
];

pub async fn get_asesmen_pra_anestesi(_user: AuthUser, State(state): State<AppState>, Query(q): Query<IcuQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    use sqlx::Row;
    let cols_sel = APA_COLS.iter().map(|c| format!("IFNULL({c},'') `{c}`")).collect::<Vec<_>>().join(", ");
    let sql = format!(
        "SELECT CAST(tanggal AS CHAR) tanggal, kd_dokter, {cols_sel} \
         FROM asesmen_pra_anestesi_rscb WHERE no_rawat = ? ORDER BY tanggal DESC LIMIT 1"
    );
    let row = sqlx::query(&sql).bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    match row {
        None => Ok(Json(json!({"exists": false}))),
        Some(r) => {
            let mut data = serde_json::Map::new();
            for c in APA_COLS {
                data.insert((*c).to_string(), Value::String(r.try_get::<String, _>(*c).unwrap_or_default()));
            }
            let tanggal: Option<String> = r.try_get("tanggal").ok();
            let kd_dokter: String = r.try_get("kd_dokter").unwrap_or_default();
            let nm_dokter: Option<String> = sqlx::query_scalar("SELECT nm_dokter FROM dokter WHERE kd_dokter = ?")
                .bind(&kd_dokter).fetch_optional(&state.pool).await.map_err(db_err)?;
            Ok(Json(json!({
                "exists": true, "tanggal": tanggal, "kd_dokter": kd_dokter,
                "nm_dokter": nm_dokter.unwrap_or_default(), "data": Value::Object(data)
            })))
        }
    }
}

#[derive(Deserialize)]
pub struct ApaBody {
    pub no_rawat: String,
    #[serde(default)] pub kd_dokter: Option<String>,
    #[serde(default)] pub data: Value,
}
pub async fn save_asesmen_pra_anestesi(user: AuthUser, State(state): State<AppState>, Json(b): Json<ApaBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let kd = kd_efektif(&user, &b.kd_dokter).ok_or((
        StatusCode::BAD_REQUEST, Json(json!({"error":"Admin harus mengisi kode dokter"}))))?;
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    // Guard kepemilikan: bila sudah ada asesmen milik petugas lain → tolak (kecuali admin).
    if !user.0.is_admin {
        let owner: Option<String> = sqlx::query_scalar("SELECT IFNULL(nip,'') FROM asesmen_pra_anestesi_rscb WHERE no_rawat = ? ORDER BY tanggal DESC LIMIT 1")
            .bind(&b.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
        if let Some(o) = owner {
            if !o.is_empty() && o != user.0.kode {
                return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Asesmen ini dibuat petugas lain — tidak dapat diubah"}))));
            }
        }
    }
    // Satu asesmen aktif per pasien: hapus lama lalu insert baru.
    sqlx::query("DELETE FROM asesmen_pra_anestesi_rscb WHERE no_rawat = ?")
        .bind(&b.no_rawat).execute(&state.pool).await.map_err(db_err)?;
    let cols = APA_COLS.iter().map(|c| format!("`{c}`")).collect::<Vec<_>>().join(", ");
    let placeholders = APA_COLS.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let sql = format!(
        "INSERT INTO asesmen_pra_anestesi_rscb (no_rawat, tanggal, {cols}, kd_dokter, nip) VALUES (?, NOW(), {placeholders}, ?, ?)"
    );
    let vals: Vec<String> = APA_COLS.iter()
        .map(|c| b.data.get(*c).and_then(|v| v.as_str()).unwrap_or("").to_string())
        .collect();
    let mut qy = sqlx::query(&sql).bind(&b.no_rawat);
    for v in &vals { qy = qy.bind(v); }
    qy = qy.bind(&kd).bind(&user.0.kode);
    qy.execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("asesmen_pra_anestesi_rscb no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Asesmen Pra Induksi (RM.IBS.11.012.2026) — tabel asesmen_pra_induksi_rscb ──
// Terpisah dari pra-anestesi (PAB 4). Satu asesmen aktif per pasien; edit =
// simpan ulang (overwrite), hanya boleh oleh penginput (nip) atau admin.
const PRI_COLS: &[&str] = &[
    "diagnosa_prabedah","tindakan_bedah","asisten_bedah","penata_anestesi",
    "alergi","alergi_ket","kesulitan_jalan_nafas","kesulitan_jalan_nafas_ket",
    "resiko_perdarahan","sedia_darah","sedia_darah_jenis","sedia_darah_ml",
    "mallampati","buka_mulut","pergerakan_leher","asa",
    "rencana_ga","rencana_ra","puasa","puasa_terakhir",
];

pub async fn get_asesmen_pra_induksi(user: AuthUser, State(state): State<AppState>, Query(q): Query<IcuQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    use sqlx::Row;
    let cols_sel = PRI_COLS.iter().map(|c| format!("IFNULL({c},'') `{c}`")).collect::<Vec<_>>().join(", ");
    let sql = format!(
        "SELECT CAST(tanggal AS CHAR) tanggal, IFNULL(kd_dokter,'') kd_dokter, IFNULL(kd_dokter_bedah,'') kd_dokter_bedah, IFNULL(nip,'') nip, {cols_sel} \
         FROM asesmen_pra_induksi_rscb WHERE no_rawat = ? ORDER BY tanggal DESC LIMIT 1"
    );
    let row = sqlx::query(&sql).bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    match row {
        None => Ok(Json(json!({"exists": false}))),
        Some(r) => {
            let mut data = serde_json::Map::new();
            for c in PRI_COLS {
                data.insert((*c).to_string(), Value::String(r.try_get::<String, _>(*c).unwrap_or_default()));
            }
            let tanggal: Option<String> = r.try_get("tanggal").ok();
            let kd_dokter: String = r.try_get("kd_dokter").unwrap_or_default();
            let kd_dokter_bedah: String = r.try_get("kd_dokter_bedah").unwrap_or_default();
            let nip: String = r.try_get("nip").unwrap_or_default();
            // kd_dokter (anestesi) kini menyimpan NIK pegawai (dokter/penata anestesi);
            // resolusi nama dari pegawai dulu, fallback ke dokter untuk data lama.
            let nm_dokter: Option<String> = sqlx::query_scalar(
                "SELECT COALESCE((SELECT nama FROM pegawai WHERE nik = ?),(SELECT nm_dokter FROM dokter WHERE kd_dokter = ?))")
                .bind(&kd_dokter).bind(&kd_dokter).fetch_optional(&state.pool).await.map_err(db_err)?;
            let nm_dokter_bedah: Option<String> = sqlx::query_scalar("SELECT nm_dokter FROM dokter WHERE kd_dokter = ?")
                .bind(&kd_dokter_bedah).fetch_optional(&state.pool).await.map_err(db_err)?;
            let dapat_edit = user.0.is_admin || nip == user.0.kode;
            Ok(Json(json!({
                "exists": true, "tanggal": tanggal, "kd_dokter": kd_dokter,
                "nm_dokter": nm_dokter.unwrap_or_default(), "kd_dokter_bedah": kd_dokter_bedah,
                "nm_dokter_bedah": nm_dokter_bedah.unwrap_or_default(), "nip": nip,
                "dapat_edit": dapat_edit, "data": Value::Object(data)
            })))
        }
    }
}

#[derive(Deserialize)]
pub struct PriBody {
    pub no_rawat: String,
    #[serde(default)] pub kd_dokter: Option<String>,
    #[serde(default)] pub kd_dokter_bedah: String,
    #[serde(default)] pub tanggal: String,
    #[serde(default)] pub data: Value,
}
pub async fn save_asesmen_pra_induksi(user: AuthUser, State(state): State<AppState>, Json(b): Json<PriBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let kd = kd_efektif(&user, &b.kd_dokter).ok_or((
        StatusCode::BAD_REQUEST, Json(json!({"error":"Admin harus mengisi kode dokter"}))))?;
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    // Guard kepemilikan: bila sudah ada asesmen milik petugas lain → tolak (kecuali admin).
    let owner: Option<String> = sqlx::query_scalar("SELECT IFNULL(nip,'') FROM asesmen_pra_induksi_rscb WHERE no_rawat = ? ORDER BY tanggal DESC LIMIT 1")
        .bind(&b.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    if let Some(o) = owner {
        if !user.0.is_admin && !o.is_empty() && o != user.0.kode {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya bisa diubah oleh petugas yang menginput"}))));
        }
    }
    // Satu asesmen aktif per pasien: hapus lama lalu insert baru (tanggal/jam bisa diedit).
    sqlx::query("DELETE FROM asesmen_pra_induksi_rscb WHERE no_rawat = ?")
        .bind(&b.no_rawat).execute(&state.pool).await.map_err(db_err)?;
    let cols = PRI_COLS.iter().map(|c| format!("`{c}`")).collect::<Vec<_>>().join(", ");
    let placeholders = PRI_COLS.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let tgl_expr = if b.tanggal.trim().is_empty() { "NOW()".to_string() } else { "?".to_string() };
    let sql = format!(
        "INSERT INTO asesmen_pra_induksi_rscb (no_rawat, tanggal, {cols}, kd_dokter, kd_dokter_bedah, nip) VALUES (?, {tgl_expr}, {placeholders}, ?, ?, ?)"
    );
    let vals: Vec<String> = PRI_COLS.iter()
        .map(|c| b.data.get(*c).and_then(|v| v.as_str()).unwrap_or("").to_string())
        .collect();
    let mut qy = sqlx::query(&sql).bind(&b.no_rawat);
    if !b.tanggal.trim().is_empty() { qy = qy.bind(b.tanggal.replace('T', " ")); }
    for v in &vals { qy = qy.bind(v); }
    qy = qy.bind(&kd).bind(&b.kd_dokter_bedah).bind(&user.0.kode);
    qy.execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("asesmen_pra_induksi_rscb no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}
pub async fn hapus_asesmen_pra_induksi(user: AuthUser, State(state): State<AppState>, Json(b): Json<IcuQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    let res = if user.0.is_admin {
        sqlx::query("DELETE FROM asesmen_pra_induksi_rscb WHERE no_rawat = ?").bind(&b.no_rawat)
            .execute(&state.pool).await.map_err(db_err)?
    } else {
        sqlx::query("DELETE FROM asesmen_pra_induksi_rscb WHERE no_rawat = ? AND nip = ?").bind(&b.no_rawat).bind(&user.0.kode)
            .execute(&state.pool).await.map_err(db_err)?
    };
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya bisa dihapus oleh petugas yang menginput"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS asesmen_pra_induksi_rscb no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

pub async fn hapus_asesmen_pra_anestesi(user: AuthUser, State(state): State<AppState>, Json(b): Json<IcuQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    let res = if user.0.is_admin {
        sqlx::query("DELETE FROM asesmen_pra_anestesi_rscb WHERE no_rawat = ?").bind(&b.no_rawat)
            .execute(&state.pool).await.map_err(db_err)?
    } else {
        sqlx::query("DELETE FROM asesmen_pra_anestesi_rscb WHERE no_rawat = ? AND nip = ?").bind(&b.no_rawat).bind(&user.0.kode)
            .execute(&state.pool).await.map_err(db_err)?
    };
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya bisa dihapus oleh petugas yang menginput"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS asesmen_pra_anestesi_rscb no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Asesmen Pra Bedah (RM.KEP...) — tabel asesmen_pra_bedah_rscb ──
// Bisa diisi/diedit dari E-Dokter maupun E-Nakes (owner-locked via nip).
const PRB_COLS: &[&str] = &[
    "ruangan","diagnosa","tindakan_bedah","bb","tb","anamnesi","riwayat_asma","alergi","diabetes",
    "hipertensi","riwayat_operasi","jenis_anestesi_riwayat","komplikasi_riwayat","pemeriksaan_fisik",
    "keadaan_umum","gcs","td","nadi","rr","suhu","gerakan_leher","methohyoid","mallampati","thorax",
    "abdomen","ekstremitas","laboratorium","ekg","ro_thorax","lain_lain","premedikasi","puasa",
    "diagnosa_pra_bedah","rencana_tindakan","persediaan_darah",
];

pub async fn get_asesmen_pra_bedah(_user: AuthUser, State(state): State<AppState>, Query(q): Query<IcuQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    use sqlx::Row;
    let cols_sel = PRB_COLS.iter().map(|c| format!("IFNULL({c},'') `{c}`")).collect::<Vec<_>>().join(", ");
    let sql = format!(
        "SELECT CAST(tanggal AS CHAR) tanggal, IFNULL(kd_dokter,'') kd_dokter, IFNULL(nip,'') nip, {cols_sel} \
         FROM asesmen_pra_bedah_rscb WHERE no_rawat = ? ORDER BY tanggal DESC LIMIT 1"
    );
    let row = sqlx::query(&sql).bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    match row {
        None => Ok(Json(json!({"exists": false}))),
        Some(r) => {
            let mut data = serde_json::Map::new();
            for c in PRB_COLS {
                data.insert((*c).to_string(), Value::String(r.try_get::<String, _>(*c).unwrap_or_default()));
            }
            let tanggal: Option<String> = r.try_get("tanggal").ok();
            let kd_dokter: String = r.try_get("kd_dokter").unwrap_or_default();
            let nip: String = r.try_get("nip").unwrap_or_default();
            // kd_dokter bisa dokter atau petugas (pegawai); resolve nama dari pegawai dulu.
            let nm_dokter: Option<String> = sqlx::query_scalar(
                "SELECT COALESCE((SELECT nama FROM pegawai WHERE nik = ?),(SELECT nm_dokter FROM dokter WHERE kd_dokter = ?))")
                .bind(&kd_dokter).bind(&kd_dokter).fetch_optional(&state.pool).await.map_err(db_err)?;
            Ok(Json(json!({
                "exists": true, "tanggal": tanggal, "kd_dokter": kd_dokter,
                "nm_dokter": nm_dokter.unwrap_or_default(), "nip": nip, "data": Value::Object(data)
            })))
        }
    }
}

pub async fn save_asesmen_pra_bedah(user: AuthUser, State(state): State<AppState>, Json(b): Json<ApaBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let kd = kd_efektif(&user, &b.kd_dokter).ok_or((
        StatusCode::BAD_REQUEST, Json(json!({"error":"Admin harus mengisi kode dokter"}))))?;
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    if !user.0.is_admin {
        let owner: Option<String> = sqlx::query_scalar("SELECT IFNULL(nip,'') FROM asesmen_pra_bedah_rscb WHERE no_rawat = ? ORDER BY tanggal DESC LIMIT 1")
            .bind(&b.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
        if let Some(o) = owner {
            if !o.is_empty() && o != user.0.kode {
                return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Asesmen ini dibuat petugas lain — tidak dapat diubah"}))));
            }
        }
    }
    sqlx::query("DELETE FROM asesmen_pra_bedah_rscb WHERE no_rawat = ?")
        .bind(&b.no_rawat).execute(&state.pool).await.map_err(db_err)?;
    let cols = PRB_COLS.iter().map(|c| format!("`{c}`")).collect::<Vec<_>>().join(", ");
    let placeholders = PRB_COLS.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let sql = format!(
        "INSERT INTO asesmen_pra_bedah_rscb (no_rawat, tanggal, {cols}, kd_dokter, nip) VALUES (?, NOW(), {placeholders}, ?, ?)"
    );
    let vals: Vec<String> = PRB_COLS.iter()
        .map(|c| b.data.get(*c).and_then(|v| v.as_str()).unwrap_or("").to_string())
        .collect();
    let mut qy = sqlx::query(&sql).bind(&b.no_rawat);
    for v in &vals { qy = qy.bind(v); }
    qy = qy.bind(&kd).bind(&user.0.kode);
    qy.execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("asesmen_pra_bedah_rscb no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

pub async fn hapus_asesmen_pra_bedah(user: AuthUser, State(state): State<AppState>, Json(b): Json<IcuQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    let res = if user.0.is_admin {
        sqlx::query("DELETE FROM asesmen_pra_bedah_rscb WHERE no_rawat = ?").bind(&b.no_rawat)
            .execute(&state.pool).await.map_err(db_err)?
    } else {
        sqlx::query("DELETE FROM asesmen_pra_bedah_rscb WHERE no_rawat = ? AND nip = ?").bind(&b.no_rawat).bind(&user.0.kode)
            .execute(&state.pool).await.map_err(db_err)?
    };
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya bisa dihapus oleh petugas yang menginput"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS asesmen_pra_bedah_rscb no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// ══════════════════════════════════════════════════════════════════════════
// Pengkajian Medis Ranap (penilaian_medis_ranap) — append per (no_rawat,tanggal)
// & Resume Medis Ranap (resume_pasien_ranap) — upsert per no_rawat. Dokter web.
// ══════════════════════════════════════════════════════════════════════════

const PM_COLS: &[&str] = &[
    "anamnesis","hubungan","keluhan_utama","rps","rpd","rpk","rpo","alergi","keadaan","gcs","kesadaran",
    "td","nadi","rr","suhu","spo","bb","tb","kepala","mata","gigi","tht","thoraks","jantung","paru","abdomen",
    "genital","ekstremitas","kulit","ket_fisik","ket_lokalis","lab","rad","penunjang","diagnosis","tata","edukasi","status_lokalis",
];
// Awal Medis IGD (penilaian_medis_igd) — kolom sedikit beda dari ranap.
const PM_IGD_COLS: &[&str] = &[
    "anamnesis","hubungan","keluhan_utama","rps","rpd","rpk","rpo","alergi","keadaan","gcs","kesadaran",
    "td","nadi","rr","suhu","spo","bb","tb","kepala","mata","gigi","leher","thoraks","abdomen",
    "genital","ekstremitas","ket_fisik","ket_lokalis","ekg","rad","lab","diagnosis","tata","status_lokalis",
];
/// Pilih (tabel, kolom) berdasarkan sumber ("igd" → IGD, selain itu ranap).
fn pm_src(sumber: &Option<String>) -> (&'static str, &'static [&'static str]) {
    if sumber.as_deref() == Some("igd") { ("penilaian_medis_igd", PM_IGD_COLS) }
    else { ("penilaian_medis_ranap", PM_COLS) }
}
// Enum di penilaian_medis_ranap semuanya NOT NULL → kolom enum yang kosong/invalid
// diisi nilai default valid (bukan NULL); kolom teks apa adanya (string kosong OK).
fn pm_norm(col: &str, v: &str) -> Option<String> {
    let (opts, def): (Option<&[&str]>, &str) = match col {
        "anamnesis" => (Some(&["Autoanamnesis","Alloanamnesis"]), "Autoanamnesis"),
        "keadaan"   => (Some(&["Sehat","Sakit Ringan","Sakit Sedang","Sakit Berat"]), "Sakit Ringan"),
        "kesadaran" => (Some(&["Compos Mentis","Apatis","Somnolen","Sopor","Koma"]), "Compos Mentis"),
        "kepala"|"mata"|"gigi"|"tht"|"leher"|"thoraks"|"jantung"|"paru"|"abdomen"|"genital"|"ekstremitas"|"kulit"
                    => (Some(&["Normal","Abnormal","Tidak Diperiksa"]), "Tidak Diperiksa"),
        _ => (None, ""),
    };
    match opts {
        Some(o) => Some(if o.contains(&v) { v.to_string() } else { def.to_string() }),
        None => Some(v.to_string()),
    }
}

#[derive(Serialize, sqlx::FromRow)]
pub struct PengkajianMedisRow { pub tanggal: Option<String>, pub ringkas: String, pub dokter: String, #[sqlx(default)] pub milik: i64 }
#[derive(Deserialize)]
pub struct NoRawatQ { pub no_rawat: String, #[serde(default)] pub sumber: Option<String> }
pub async fn pengkajian_medis_list(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatQ>)
  -> Result<Json<Vec<PengkajianMedisRow>>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let (table, _) = pm_src(&q.sumber);
    let sql = format!(
        "SELECT CAST(m.tanggal AS CHAR) tanggal, \
                CONCAT_WS(' · ', NULLIF(LEFT(IFNULL(m.keluhan_utama,''),50),''), NULLIF(m.diagnosis,'')) ringkas, \
                IFNULL(d.nm_dokter, m.kd_dokter) dokter, (m.kd_dokter = ? OR ? = 1) milik \
         FROM {table} m LEFT JOIN dokter d ON d.kd_dokter = m.kd_dokter \
         WHERE m.no_rawat = ? ORDER BY m.tanggal DESC LIMIT 100"
    );
    let rows = sqlx::query_as::<_, PengkajianMedisRow>(&sql)
        .bind(&user.0.kode).bind(admin).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct PmGetQ { pub no_rawat: String, pub tanggal: String, #[serde(default)] pub sumber: Option<String> }
pub async fn pengkajian_medis_get(_user: AuthUser, State(state): State<AppState>, Query(q): Query<PmGetQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    use sqlx::Row;
    let (table, cols) = pm_src(&q.sumber);
    let sel = cols.iter().map(|c| format!("IFNULL(CAST(`{c}` AS CHAR),'') `{c}`")).collect::<Vec<_>>().join(", ");
    let sql = format!("SELECT {sel} FROM {table} WHERE no_rawat=? AND tanggal=? LIMIT 1");
    let row = sqlx::query(&sql).bind(&q.no_rawat).bind(&q.tanggal).fetch_optional(&state.pool).await.map_err(db_err)?;
    let mut map = serde_json::Map::new();
    if let Some(row) = row {
        for c in cols { map.insert((*c).to_string(), Value::String(row.try_get(*c).unwrap_or_default())); }
    }
    Ok(Json(Value::Object(map)))
}
#[derive(Deserialize)]
pub struct PmSaveBody { pub no_rawat: String, #[serde(default)] pub tanggal: String, #[serde(default)] pub values: std::collections::HashMap<String,String>, #[serde(default)] pub sumber: Option<String> }
pub async fn pengkajian_medis_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<PmSaveBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    let (table, cols) = pm_src(&b.sumber);
    let g = |k: &str| b.values.get(k).map(|s| s.trim().to_string()).unwrap_or_default();
    let tanggal: String = {
        let t = b.tanggal.trim().replace('T', " ");
        if t.is_empty() { sqlx::query_scalar("SELECT DATE_FORMAT(NOW(),'%Y-%m-%d %H:%i:%s')").fetch_one(&state.pool).await.map_err(db_err)? }
        else if t.len() == 16 { format!("{t}:00") } else { t }
    };
    let collist = cols.iter().map(|c| format!("`{c}`")).collect::<Vec<_>>().join(", ");
    let mut qb = sqlx::QueryBuilder::new(format!("INSERT INTO {table} (no_rawat, tanggal, kd_dokter, {collist}) VALUES ("));
    qb.push_bind(b.no_rawat.clone()).push(", ").push_bind(tanggal.clone()).push(", ").push_bind(user.0.kode.clone());
    for c in cols { qb.push(", ").push_bind(pm_norm(c, &g(c))); }
    qb.push(") ON DUPLICATE KEY UPDATE kd_dokter=VALUES(kd_dokter)");
    for c in cols { qb.push(format!(", `{c}`=VALUES(`{c}`)")); }
    qb.build().execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("{table} no_rawat={} {}", b.no_rawat, tanggal)).await;
    Ok(Json(json!({"ok": true, "tanggal": tanggal})))
}
#[derive(Deserialize)]
pub struct PmDelBody { pub no_rawat: String, pub tanggal: String, #[serde(default)] pub sumber: Option<String> }
pub async fn pengkajian_medis_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<PmDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let (table, _) = pm_src(&b.sumber);
    let sql = format!("DELETE FROM {table} WHERE no_rawat=? AND tanggal=? AND (kd_dokter=? OR ?=1)");
    let res = sqlx::query(&sql)
        .bind(&b.no_rawat).bind(&b.tanggal).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat menghapus"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS {table} no_rawat={} {}", b.no_rawat, b.tanggal)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Resume Medis Ranap (resume_pasien_ranap, upsert per no_rawat) ────────────
const RM_COLS: &[&str] = &[
    "diagnosa_awal","alasan","keluhan_utama","pemeriksaan_fisik","jalannya_penyakit","pemeriksaan_penunjang","hasil_laborat",
    "tindakan_dan_operasi","obat_di_rs","diagnosa_utama","kd_diagnosa_utama","diagnosa_sekunder","kd_diagnosa_sekunder",
    "diagnosa_sekunder2","kd_diagnosa_sekunder2","diagnosa_sekunder3","kd_diagnosa_sekunder3","diagnosa_sekunder4","kd_diagnosa_sekunder4",
    "prosedur_utama","kd_prosedur_utama","prosedur_sekunder","kd_prosedur_sekunder","prosedur_sekunder2","kd_prosedur_sekunder2",
    "prosedur_sekunder3","kd_prosedur_sekunder3","alergi","diet","lab_belum","edukasi","cara_keluar","ket_keluar","keadaan",
    "ket_keadaan","dilanjutkan","ket_dilanjutkan","kontrol","obat_pulang",
];
// Enum resume_pasien_ranap (cara_keluar/keadaan/dilanjutkan) NOT NULL → default valid.
// kontrol datetime nullable → NULL bila kosong.
fn rm_norm(col: &str, v: &str) -> Option<String> {
    let ev = |opts: &[&str], def: &str| Some(if opts.contains(&v) { v.to_string() } else { def.to_string() });
    match col {
        "cara_keluar"  => ev(&["Atas Izin Dokter","Pindah RS","Pulang Atas Permintaan Sendiri","Lainnya"], "Atas Izin Dokter"),
        "keadaan"      => ev(&["Membaik","Sembuh","Keadaan Khusus","Meninggal"], "Membaik"),
        "dilanjutkan"  => ev(&["Kembali Ke RS","RS Lain","Dokter Luar","Puskesmes","Lainnya"], "Kembali Ke RS"),
        "kontrol"      => { let t = v.trim().replace('T'," "); if t.is_empty() { None } else if t.len()==16 { Some(format!("{t}:00")) } else { Some(t) } },
        _ => Some(v.to_string()),
    }
}
pub async fn resume_medis_get(_user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    use sqlx::Row;
    let sel = RM_COLS.iter().map(|c| format!("IFNULL(CAST(`{c}` AS CHAR),'') `{c}`")).collect::<Vec<_>>().join(", ");
    let sql = format!("SELECT {sel}, IFNULL(d.nm_dokter, r.kd_dokter) dokter FROM resume_pasien_ranap r LEFT JOIN dokter d ON d.kd_dokter=r.kd_dokter WHERE r.no_rawat=? LIMIT 1");
    let row = sqlx::query(&sql).bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    let mut map = serde_json::Map::new();
    let mut ada = false;
    if let Some(row) = row {
        ada = true;
        for c in RM_COLS { map.insert((*c).to_string(), Value::String(row.try_get(*c).unwrap_or_default())); }
        map.insert("dokter".to_string(), Value::String(row.try_get("dokter").unwrap_or_default()));
    }
    Ok(Json(json!({"ada": ada, "values": map})))
}
#[derive(Deserialize)]
pub struct RmSaveBody { pub no_rawat: String, #[serde(default)] pub values: std::collections::HashMap<String,String> }
pub async fn resume_medis_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<RmSaveBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    let g = |k: &str| b.values.get(k).map(|s| s.trim().to_string()).unwrap_or_default();
    let collist = RM_COLS.iter().map(|c| format!("`{c}`")).collect::<Vec<_>>().join(", ");
    let mut qb = sqlx::QueryBuilder::new(format!("INSERT INTO resume_pasien_ranap (no_rawat, kd_dokter, {collist}) VALUES ("));
    qb.push_bind(b.no_rawat.clone()).push(", ").push_bind(user.0.kode.clone());
    for c in RM_COLS { qb.push(", ").push_bind(rm_norm(c, &g(c))); }
    qb.push(") ON DUPLICATE KEY UPDATE kd_dokter=VALUES(kd_dokter)");
    for c in RM_COLS { qb.push(format!(", `{c}`=VALUES(`{c}`)")); }
    qb.build().execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("resume_pasien_ranap no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}
