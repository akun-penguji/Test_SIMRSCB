use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::State, http::StatusCode, Json};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

// Pemetaan jenis surat → nama folder di webappsrscb
const JENIS_FOLDER: &[(&str, &str)] = &[
    ("persetujuan_umum",      "persetujuanumum"),
    ("hak_kewajiban",         "hakdankewajibanpasien"),
    ("jaminan_pasien",        "suratpernyataanjaminan"),
    ("masuk_unit",            "pernyataanmasukunit"),
    ("bersedia_igd",          "pernyataanbersediamenungguigd"),
    ("jamkesda",              "pernyataanjamkesda"),
    ("persetujuan_penolakan", "persetujuantindakan"),
    ("jaminan_umum",          "pernyataanumum"),
    ("titip_kelas",           "pernyataantitipkelas"),
    ("pulang_aps",            "pulangaps"),
    ("edukasi_pasien",        "pelaksanaanedukasi"),
    ("penerimaan_ranap",      "penerimaanorientasiranap"),
    ("pengantar_pulang",      "suratpengantarpulang"),
    ("resume_serah_terima",   "resumeserahterima"),
];

fn jenis_to_folder(jenis: &str) -> Option<&'static str> {
    JENIS_FOLDER.iter().find(|(k, _)| *k == jenis).map(|(_, v)| *v)
}

// ── Inisialisasi tabel konfigurasi ────────────────────────────────────────────

pub(crate) async fn ensure_config_table(pool: &sqlx::MySqlPool) {
    let _ = sqlx::query(
        "CREATE TABLE IF NOT EXISTS simrscb_config (
           kunci      VARCHAR(100) PRIMARY KEY,
           nilai      TEXT,
           updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    )
    .execute(pool)
    .await;
}

pub(crate) async fn get_cfg(pool: &sqlx::MySqlPool, key: &str, default: &str) -> String {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT nilai FROM simrscb_config WHERE kunci = ? LIMIT 1",
    )
    .bind(key)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    row.and_then(|(v,)| if v.is_empty() { None } else { Some(v) })
        .unwrap_or_else(|| default.to_string())
}

async fn set_cfg(pool: &sqlx::MySqlPool, key: &str, val: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO simrscb_config (kunci, nilai) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE nilai = VALUES(nilai), updated_at = NOW()",
    )
    .bind(key)
    .bind(val)
    .execute(pool)
    .await?;
    Ok(())
}

// ── GET /api/simrscb/config ───────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ConfigResponse {
    /// "local" atau "remote"
    hosthybridweb_type:   String,
    /// path lokal atau URL PHP endpoint (tergantung type)
    hosthybridweb:        String,
    /// secret untuk autentikasi ke PHP endpoint (hanya dipakai jika type=remote)
    hosthybridweb_secret: String,
}

pub async fn get_config(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<ConfigResponse>, (StatusCode, Json<Value>)> {
    ensure_config_table(&state.pool).await;
    Ok(Json(ConfigResponse {
        hosthybridweb_type:   get_cfg(&state.pool, "hosthybridweb_type",   "local").await,
        hosthybridweb:        get_cfg(&state.pool, "hosthybridweb",        "/var/www/html/webappsrscb/").await,
        hosthybridweb_secret: get_cfg(&state.pool, "hosthybridweb_secret", "").await,
    }))
}

// ── PUT /api/simrscb/config ───────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct UpdateConfigBody {
    hosthybridweb_type:   String,
    hosthybridweb:        String,
    hosthybridweb_secret: String,
}

pub async fn update_config(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<UpdateConfigBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Hanya admin yang boleh mengubah konfigurasi"}))));
    }
    ensure_config_table(&state.pool).await;

    set_cfg(&state.pool, "hosthybridweb_type",   &body.hosthybridweb_type).await.map_err(db_err)?;
    set_cfg(&state.pool, "hosthybridweb",        &body.hosthybridweb).await.map_err(db_err)?;
    set_cfg(&state.pool, "hosthybridweb_secret", &body.hosthybridweb_secret).await.map_err(db_err)?;

    use crate::audit::q;
    for (key, val) in [
        ("hosthybridweb_type",   &body.hosthybridweb_type),
        ("hosthybridweb",        &body.hosthybridweb),
        ("hosthybridweb_secret", &body.hosthybridweb_secret),
    ] {
        crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
            "INSERT INTO simrscb_config (kunci, nilai) VALUES ({}, {}) ON DUPLICATE KEY UPDATE nilai=VALUES(nilai), updated_at=NOW()",
            q(key), q(val)
        )).await;
    }

    Ok(Json(json!({ "message": "Konfigurasi disimpan" })))
}

// ── POST /api/surat/upload ────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct UploadSuratBody {
    jenis:       String,
    no_rawat:    String,
    no_surat:    Option<String>,
    foto_base64: Option<String>,
    ttd_base64:  Option<String>,
    #[serde(default)] foto_saksi_base64: Option<String>,
    #[serde(default)] ttd_saksi_base64:  Option<String>,
}

pub async fn upload_surat(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<UploadSuratBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    ensure_config_table(&state.pool).await;

    let hw_type  = get_cfg(&state.pool, "hosthybridweb_type",   "local").await;
    let hw_val   = get_cfg(&state.pool, "hosthybridweb",        "/var/www/html/webappsrscb/").await;
    let hw_secret = get_cfg(&state.pool, "hosthybridweb_secret", "").await;

    let folder = jenis_to_folder(&body.jenis).ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({ "error": "Jenis surat tidak dikenal" })))
    })?;

    // Sanitasi no_rawat → nama file: hanya huruf, angka, _ dan -
    // Mencegah path traversal (misal ../../etc/passwd)
    let filename: String = body.no_rawat
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '_' })
        .collect();
    if filename.is_empty() || filename.len() > 50 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "no_rawat tidak valid" }))));
    }

    let mut saved: Vec<String> = vec![];

    let pairs: &[(&Option<String>, &str)] = &[
        (&body.foto_base64, "foto"),
        (&body.ttd_base64,  "ttd"),
        (&body.foto_saksi_base64, "foto_saksi"),
        (&body.ttd_saksi_base64,  "ttd_saksi"),
    ];

    for (raw_opt, media_type) in pairs {
        if let Some(raw) = raw_opt {
            if raw.is_empty() { continue; }
            let b64   = strip_data_url(raw);
            let bytes = STANDARD.decode(b64).map_err(|_| {
                (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("base64 {} tidak valid", media_type) })))
            })?;

            if hw_type == "remote" {
                // ── Upload via HTTP ke PHP companion script ────────────────
                save_remote(&hw_val, &hw_secret, folder, media_type, &filename, b64)
                    .await
                    .map_err(|e| {
                        (StatusCode::BAD_GATEWAY, Json(json!({ "error": format!("Remote upload gagal: {}", e) })))
                    })?;
                saved.push(format!("remote:{}/{}/{}.jpg", folder, media_type, filename));
            } else {
                // ── Tulis langsung ke filesystem lokal ────────────────────
                let base = hw_val.trim_end_matches('/');
                let dir  = format!("{}/{}/{}", base, folder, media_type);
                let path = format!("{}/{}.jpg", dir, filename);

                // Pastikan path tidak keluar dari base directory (path traversal check)
                let canonical_base = std::fs::canonicalize(base).unwrap_or_else(|_| std::path::PathBuf::from(base));
                tokio::fs::create_dir_all(&dir).await.map_err(io_err)?;
                let canonical_path = std::fs::canonicalize(&path).unwrap_or_else(|_| std::path::PathBuf::from(&path));
                if !canonical_path.starts_with(&canonical_base) {
                    return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "Path tidak valid" }))));
                }

                tokio::fs::write(&path, &bytes).await.map_err(io_err)?;
                saved.push(path);
            }

            // ── Link ke tabel SIMRS Khanza ───────────────────────────────────
            let rel = format!("{}/{}.jpg", media_type, filename);
            if body.jenis == "persetujuan_umum" {
                link_persetujuan_umum_media(&state.pool,
                    body.no_surat.as_deref(), &body.no_rawat, media_type, &rel).await;
            } else if body.jenis == "jaminan_pasien" {
                link_pernyataan_jaminan_media(&state.pool,
                    body.no_surat.as_deref(), &body.no_rawat, media_type, &rel).await;
            } else if body.jenis == "hak_kewajiban" {
                link_hak_kewajiban_media(&state.pool,
                    body.no_surat.as_deref(), &body.no_rawat, media_type, &rel).await;
            } else if body.jenis == "edukasi_pasien" {
                link_edukasi_pasien_ttd(&state.pool, &body.no_rawat, &rel).await;
            } else if body.jenis == "penerimaan_ranap" {
                link_penerimaan_ranap_media(&state.pool, &body.no_rawat, media_type, &rel).await;
            } else if body.jenis == "pengantar_pulang" {
                link_media_by_norawat(&state.pool, "surat_pengantar_pulang_ttd", &body.no_rawat, media_type, &rel).await;
            } else if body.jenis == "resume_serah_terima" {
                link_media_by_norawat(&state.pool, "resume_serah_terima_rscb", &body.no_rawat, media_type, &rel).await;
            } else {
                // Jenis surat pernyataan generik (masuk_unit, bersedia_igd, jamkesda,
                // jaminan_umum, titip_kelas, pulang_aps) → tabel *_pembuat_pernyataan.
                link_surat_generic(&state.pool, &body.jenis,
                    body.no_surat.as_deref(), &body.no_rawat, media_type, &rel).await;
            }
        }
    }

    Ok(Json(json!({ "message": "Upload berhasil", "saved": saved })))
}

/// Konfigurasi tabel target per jenis surat pernyataan generik.
/// (base = tabel utk resolve no_surat dari no_rawat; ptable = tabel foto;
///  ttd_col=true → kolom `tandatangan` di ptable; sig_table → tabel TTD terpisah)
struct SuratTgt {
    base: &'static str,
    ptable: &'static str,
    ttd_col: bool,
    sig_table: &'static str,
}
fn surat_generic_cfg(jenis: &str) -> Option<SuratTgt> {
    Some(match jenis {
        "masuk_unit"   => SuratTgt { base: "form_masuk_unit", ptable: "form_masuk_unit_pembuat_pernyataan", ttd_col: true, sig_table: "" },
        "bersedia_igd" => SuratTgt { base: "surat_pernyataan_menunggu_igd", ptable: "surat_pernyataan_menunggu_igd_pembuat_pernyataan", ttd_col: true, sig_table: "" },
        "jamkesda"     => SuratTgt { base: "surat_pernyataan_jamkesda", ptable: "surat_pernyataan_jamkesda_pembuat_pernyataan", ttd_col: false, sig_table: "" },
        "jaminan_umum" => SuratTgt { base: "surat_pernyataan_pasien_umum", ptable: "surat_pernyataan_pasien_umum_pembuat_pernyataan", ttd_col: false, sig_table: "surat_pernyataan_pasien_umum_signature" },
        "titip_kelas"  => SuratTgt { base: "surat_pernyataan_titip_kelas", ptable: "surat_pernyataan_titip_kelas_pembuat_pernyataan", ttd_col: false, sig_table: "" },
        "pulang_aps"   => SuratTgt { base: "surat_pulang_atas_permintaan_sendiri", ptable: "surat_pulang_atas_permintaan_sendiri_pembuat_pernyataan", ttd_col: false, sig_table: "" },
        _ => return None,
    })
}

/// Link foto/TTD generik untuk surat pernyataan yang tabelnya berpola
/// `{x}_pembuat_pernyataan(no_surat, photo[, tandatangan])`. Nama tabel berasal
/// dari daftar statik (bukan input user) sehingga aman diformat ke SQL.
async fn link_surat_generic(
    pool: &sqlx::MySqlPool,
    jenis: &str,
    no_surat: Option<&str>,
    no_rawat: &str,
    media_type: &str,
    rel_path: &str,
) {
    let cfg = match surat_generic_cfg(jenis) { Some(c) => c, None => return };
    // Resolve no_surat (dari body, atau cari terbaru milik no_rawat)
    let resolved: Option<String> = match no_surat.filter(|s| !s.trim().is_empty()) {
        Some(s) => Some(s.to_string()),
        None => {
            let q = format!("SELECT no_surat FROM {} WHERE no_rawat = ? ORDER BY tanggal DESC, no_surat DESC LIMIT 1", cfg.base);
            sqlx::query_scalar::<_, String>(&q).bind(no_rawat).fetch_optional(pool).await.ok().flatten()
        }
    };
    let Some(no_surat) = resolved else {
        tracing::warn!("link_surat_generic: no_surat belum ada utk jenis={} no_rawat={}", jenis, no_rawat);
        return;
    };
    let res = if media_type == "foto" {
        let sql = format!("INSERT INTO {} (no_surat, photo) VALUES (?, ?) ON DUPLICATE KEY UPDATE photo = VALUES(photo)", cfg.ptable);
        sqlx::query(&sql).bind(&no_surat).bind(rel_path).execute(pool).await
    } else if !cfg.sig_table.is_empty() {
        let sql = format!("INSERT INTO {} (no_surat, signature_path) VALUES (?, ?) ON DUPLICATE KEY UPDATE signature_path = VALUES(signature_path)", cfg.sig_table);
        sqlx::query(&sql).bind(&no_surat).bind(rel_path).execute(pool).await
    } else if cfg.ttd_col {
        let sql = format!("INSERT INTO {} (no_surat, tandatangan) VALUES (?, ?) ON DUPLICATE KEY UPDATE tandatangan = VALUES(tandatangan)", cfg.ptable);
        sqlx::query(&sql).bind(&no_surat).bind(rel_path).execute(pool).await
    } else {
        return; // jenis ini tak punya tempat simpan TTD
    };
    if let Err(e) = res {
        tracing::error!("link_surat_generic gagal ({} {}): {}", jenis, media_type, e);
    }
}

/// Link foto/TTD bukti penerimaan pasien ke tabel orientasi_pasien_ranap_bukti
/// (key no_rawat). Dipakai form "Penerimaan & Orientasi Pasien Baru Rawat Inap".
async fn link_penerimaan_ranap_media(
    pool: &sqlx::MySqlPool,
    no_rawat: &str,
    media_type: &str,
    rel_path: &str,
) {
    let col = if media_type == "foto" { "foto_path" }
              else if media_type == "ttd" { "ttd_path" }
              else { return };
    let sql = format!(
        "INSERT INTO orientasi_pasien_ranap_bukti (no_rawat, {c}, updated_at) VALUES (?, ?, NOW()) \
         ON DUPLICATE KEY UPDATE {c} = VALUES({c}), updated_at = NOW()", c = col);
    if let Err(e) = sqlx::query(&sql).bind(no_rawat).bind(rel_path).execute(pool).await {
        tracing::error!("link_penerimaan_ranap_media gagal ({}): {}", media_type, e);
    }
}

/// Link foto/TTD generik ke tabel `{table}(no_rawat PK, foto_path, ttd_path, updated_at)`.
/// `table` berasal dari daftar statik di kode (bukan input user) → aman diformat.
async fn link_media_by_norawat(
    pool: &sqlx::MySqlPool,
    table: &str,
    no_rawat: &str,
    media_type: &str,
    rel_path: &str,
) {
    let col = if media_type == "foto" { "foto_path" }
              else if media_type == "ttd" { "ttd_path" }
              else { return };
    let sql = format!(
        "INSERT INTO {t} (no_rawat, {c}, updated_at) VALUES (?, ?, NOW()) \
         ON DUPLICATE KEY UPDATE {c} = VALUES({c}), updated_at = NOW()", t = table, c = col);
    if let Err(e) = sqlx::query(&sql).bind(no_rawat).bind(rel_path).execute(pool).await {
        tracing::error!("link_media_by_norawat gagal ({} {}): {}", table, media_type, e);
    }
}

/// GET /api/pengantar-pulang/ttd?no_rawat= — status TTD surat pengantar pulang.
pub async fn pengantar_pulang_ttd_get(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<BuktiQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row: Option<(Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT ttd_path, DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i') \
         FROM surat_pengantar_pulang_ttd WHERE no_rawat=? LIMIT 1",
    )
    .bind(&q.no_rawat)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;
    let (ttd, upd) = row.unwrap_or((None, None));
    Ok(Json(json!({
        "ada_ttd": ttd.as_deref().map(|s| !s.is_empty()).unwrap_or(false),
        "updated_at": upd,
    })))
}

/// GET /api/penerimaan-ranap/bukti?no_rawat= — status bukti foto/TTD penerimaan.
#[derive(Deserialize)]
pub struct BuktiQuery { pub no_rawat: String }
pub async fn penerimaan_bukti_get(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<BuktiQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row: Option<(Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT foto_path, ttd_path, DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i') \
         FROM orientasi_pasien_ranap_bukti WHERE no_rawat=? LIMIT 1",
    )
    .bind(&q.no_rawat)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;
    let (foto, ttd, upd) = row.unwrap_or((None, None, None));
    Ok(Json(json!({
        "ada_foto": foto.as_deref().map(|s| !s.is_empty()).unwrap_or(false),
        "ada_ttd":  ttd.as_deref().map(|s| !s.is_empty()).unwrap_or(false),
        "updated_at": upd,
    })))
}

/// Update tabel SIMRS Khanza dengan path foto/TTD yang baru di-upload.
/// - foto → INSERT/UPDATE surat_persetujuan_umum_pembuat_pernyataan(no_surat, photo)
/// - ttd  → UPDATE surat_persetujuan_umum_tambahan SET signature_path
async fn link_persetujuan_umum_media(
    pool:       &sqlx::MySqlPool,
    no_surat:   Option<&str>,
    no_rawat:   &str,
    media_type: &str,
    rel_path:   &str,
) {
    // Resolve no_surat: gunakan dari body, atau cari latest milik no_rawat
    let resolved: Option<String> = match no_surat.filter(|s| !s.trim().is_empty()) {
        Some(s) => Some(s.to_string()),
        None => {
            sqlx::query_as::<_, (String,)>(
                "SELECT no_surat FROM surat_persetujuan_umum
                 WHERE no_rawat = ? ORDER BY tanggal DESC, no_surat DESC LIMIT 1"
            )
            .bind(no_rawat)
            .fetch_optional(pool).await.ok().flatten().map(|t| t.0)
        }
    };

    let Some(no_surat) = resolved else {
        tracing::warn!("link_persetujuan_umum_media: no_surat belum ada untuk no_rawat={}", no_rawat);
        return;
    };

    let res = match media_type {
        "foto" => sqlx::query(
            "INSERT INTO surat_persetujuan_umum_pembuat_pernyataan (no_surat, photo)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE photo = VALUES(photo)"
        ).bind(&no_surat).bind(rel_path).execute(pool).await,
        "ttd" => sqlx::query(
            "INSERT INTO surat_persetujuan_umum_tambahan (no_surat, signature_path)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE signature_path = VALUES(signature_path)"
        ).bind(&no_surat).bind(rel_path).execute(pool).await,
        "foto_saksi" => sqlx::query(
            "INSERT INTO surat_persetujuan_umum_tambahan (no_surat, photo_saksi)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE photo_saksi = VALUES(photo_saksi)"
        ).bind(&no_surat).bind(rel_path).execute(pool).await,
        "ttd_saksi" => sqlx::query(
            "INSERT INTO surat_persetujuan_umum_tambahan (no_surat, ttd_saksi)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE ttd_saksi = VALUES(ttd_saksi)"
        ).bind(&no_surat).bind(rel_path).execute(pool).await,
        _ => return,
    };
    if let Err(e) = res {
        tracing::error!("link_persetujuan_umum_media gagal ({}): {}", media_type, e);
    } else {
        use crate::audit::q;
        let sql = match media_type {
            "foto" => format!("INSERT INTO surat_persetujuan_umum_pembuat_pernyataan (no_surat, photo) VALUES ({}, {}) ON DUPLICATE KEY UPDATE photo=VALUES(photo)", q(&no_surat), q(rel_path)),
            "ttd"  => format!("INSERT INTO surat_persetujuan_umum_tambahan (no_surat, signature_path) VALUES ({}, {}) ON DUPLICATE KEY UPDATE signature_path=VALUES(signature_path)", q(&no_surat), q(rel_path)),
            "foto_saksi" => format!("INSERT INTO surat_persetujuan_umum_tambahan (no_surat, photo_saksi) VALUES ({}, {}) ON DUPLICATE KEY UPDATE photo_saksi=VALUES(photo_saksi)", q(&no_surat), q(rel_path)),
            "ttd_saksi"  => format!("INSERT INTO surat_persetujuan_umum_tambahan (no_surat, ttd_saksi) VALUES ({}, {}) ON DUPLICATE KEY UPDATE ttd_saksi=VALUES(ttd_saksi)", q(&no_surat), q(rel_path)),
            _ => String::new(),
        };
        crate::audit::log_sql(pool, "web", &sql).await;
    }
}

/// Update tabel SIMRS Khanza untuk Surat Pernyataan Jaminan Pasien.
/// - foto → INSERT/UPDATE surat_pernyataan_jaminan_pasien_pembuat_pernyataan(no_surat, photo)
/// - ttd  → INSERT/UPDATE surat_pernyataan_jaminan_pasien_signature(no_surat, signature_path)
async fn link_pernyataan_jaminan_media(
    pool:       &sqlx::MySqlPool,
    no_surat:   Option<&str>,
    no_rawat:   &str,
    media_type: &str,
    rel_path:   &str,
) {
    let resolved: Option<String> = match no_surat.filter(|s| !s.trim().is_empty()) {
        Some(s) => Some(s.to_string()),
        None => {
            sqlx::query_as::<_, (String,)>(
                "SELECT no_surat FROM surat_pernyataan_jaminan_pasien
                 WHERE no_rawat = ? ORDER BY tanggal DESC, no_surat DESC LIMIT 1"
            )
            .bind(no_rawat)
            .fetch_optional(pool).await.ok().flatten().map(|t| t.0)
        }
    };

    let Some(no_surat) = resolved else {
        tracing::warn!("link_pernyataan_jaminan_media: no_surat belum ada untuk no_rawat={}", no_rawat);
        return;
    };

    let res = match media_type {
        "foto" => sqlx::query(
            "INSERT INTO surat_pernyataan_jaminan_pasien_pembuat_pernyataan (no_surat, photo)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE photo = VALUES(photo)"
        ).bind(&no_surat).bind(rel_path).execute(pool).await,
        "ttd" => sqlx::query(
            "INSERT INTO surat_pernyataan_jaminan_pasien_signature (no_surat, signature_path)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE signature_path = VALUES(signature_path)"
        ).bind(&no_surat).bind(rel_path).execute(pool).await,
        _ => return,
    };
    if let Err(e) = res {
        tracing::error!("link_pernyataan_jaminan_media gagal ({}): {}", media_type, e);
    } else {
        use crate::audit::q;
        let sql = match media_type {
            "foto" => format!("INSERT INTO surat_pernyataan_jaminan_pasien_pembuat_pernyataan (no_surat, photo) VALUES ({}, {}) ON DUPLICATE KEY UPDATE photo=VALUES(photo)", q(&no_surat), q(rel_path)),
            "ttd"  => format!("INSERT INTO surat_pernyataan_jaminan_pasien_signature (no_surat, signature_path) VALUES ({}, {}) ON DUPLICATE KEY UPDATE signature_path=VALUES(signature_path)", q(&no_surat), q(rel_path)),
            _ => String::new(),
        };
        crate::audit::log_sql(pool, "web", &sql).await;
    }
}

/// Link foto/TTD untuk Hak & Kewajiban Pasien.
/// Tabel `hak_kewajiban_pasien_pembuat_pernyataan` punya kolom `photo` & `tandatangan`
/// dalam satu row per `no_surat`.
async fn link_hak_kewajiban_media(
    pool:       &sqlx::MySqlPool,
    no_surat:   Option<&str>,
    no_rawat:   &str,
    media_type: &str,
    rel_path:   &str,
) {
    let resolved: Option<String> = match no_surat.filter(|s| !s.trim().is_empty()) {
        Some(s) => Some(s.to_string()),
        None => {
            sqlx::query_as::<_, (String,)>(
                "SELECT no_surat FROM hak_kewajiban_pasien
                 WHERE no_rawat = ? ORDER BY tanggal DESC, no_surat DESC LIMIT 1"
            )
            .bind(no_rawat)
            .fetch_optional(pool).await.ok().flatten().map(|t| t.0)
        }
    };

    let Some(no_surat) = resolved else {
        tracing::warn!("link_hak_kewajiban_media: no_surat belum ada untuk no_rawat={}", no_rawat);
        return;
    };

    let res = match media_type {
        "foto" => sqlx::query(
            "INSERT INTO hak_kewajiban_pasien_pembuat_pernyataan (no_surat, photo)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE photo = VALUES(photo)"
        ).bind(&no_surat).bind(rel_path).execute(pool).await,
        "ttd" => sqlx::query(
            "INSERT INTO hak_kewajiban_pasien_pembuat_pernyataan (no_surat, tandatangan)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE tandatangan = VALUES(tandatangan)"
        ).bind(&no_surat).bind(rel_path).execute(pool).await,
        _ => return,
    };
    if let Err(e) = res {
        tracing::error!("link_hak_kewajiban_media gagal ({}): {}", media_type, e);
    } else {
        use crate::audit::q;
        let sql = match media_type {
            "foto" => format!("INSERT INTO hak_kewajiban_pasien_pembuat_pernyataan (no_surat, photo) VALUES ({}, {}) ON DUPLICATE KEY UPDATE photo=VALUES(photo)", q(&no_surat), q(rel_path)),
            "ttd"  => format!("INSERT INTO hak_kewajiban_pasien_pembuat_pernyataan (no_surat, tandatangan) VALUES ({}, {}) ON DUPLICATE KEY UPDATE tandatangan=VALUES(tandatangan)", q(&no_surat), q(rel_path)),
            _ => String::new(),
        };
        crate::audit::log_sql(pool, "web", &sql).await;
    }
}

/// Insert path foto/TTD ke tabel edukasipasien_ttd (multi-image per no_rawat).
/// PK gabungan (no_rawat, url_image) — kalau path sama, UPDATE timestamp saja.
async fn link_edukasi_pasien_ttd(
    pool:     &sqlx::MySqlPool,
    no_rawat: &str,
    rel_path: &str,
) {
    let now = chrono::Local::now();
    let tgl = now.format("%Y-%m-%d").to_string();
    let jam = now.format("%H:%M:%S").to_string();

    let res = sqlx::query(
        "INSERT INTO edukasipasien_ttd (no_rawat, tanggal, jam, url_image)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE tanggal = VALUES(tanggal), jam = VALUES(jam)"
    ).bind(no_rawat).bind(&tgl).bind(&jam).bind(rel_path)
     .execute(pool).await;
    if let Err(e) = res {
        tracing::error!("link_edukasi_pasien_ttd gagal: {}", e);
    } else {
        use crate::audit::q;
        crate::audit::log_sql(pool, "web", &format!(
            "INSERT INTO edukasipasien_ttd (no_rawat, tanggal, jam, url_image) VALUES ({}, {}, {}, {}) ON DUPLICATE KEY UPDATE tanggal=VALUES(tanggal), jam=VALUES(jam)",
            q(no_rawat), q(&tgl), q(&jam), q(rel_path)
        )).await;
    }
}

/// POST multipart ke PHP companion script di server lain
pub(crate) async fn save_remote(
    url:        &str,
    secret:     &str,
    folder:     &str,
    media_type: &str,
    filename:   &str,
    b64:        &str,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client.post(url)
        .form(&[
            ("secret",   secret),
            ("folder",   folder),
            ("type",     media_type),
            ("filename", filename),
            ("base64",   b64),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let status = res.status();
        let body   = res.text().await.unwrap_or_default();
        return Err(format!("HTTP {} — {}", status, body));
    }
    Ok(())
}

/// Simpan satu gambar base64 ke webapps (lokal/remote) di {folder}/{media_type}/{filename}.jpg.
/// Mengembalikan rel path "{media_type}/{filename}.jpg" untuk disimpan ke tabel bukti.
pub(crate) async fn save_webapps_image(
    state: &AppState, folder: &str, media_type: &str, filename: &str, base64: &str,
) -> Result<String, (StatusCode, Json<Value>)> {
    ensure_config_table(&state.pool).await;
    let hw_type   = get_cfg(&state.pool, "hosthybridweb_type",   "local").await;
    let hw_val    = get_cfg(&state.pool, "hosthybridweb",        "/var/www/html/webappsrscb/").await;
    let hw_secret = get_cfg(&state.pool, "hosthybridweb_secret", "").await;
    let b64 = strip_data_url(base64);
    let bytes = STANDARD.decode(b64).map_err(|_|
        (StatusCode::BAD_REQUEST, Json(json!({"error":"base64 tidak valid"}))))?;
    if hw_type == "remote" {
        save_remote(&hw_val, &hw_secret, folder, media_type, filename, b64).await
            .map_err(|e| (StatusCode::BAD_GATEWAY, Json(json!({"error": format!("Remote upload gagal: {}", e)}))))?;
    } else {
        let base = hw_val.trim_end_matches('/');
        let dir  = format!("{}/{}/{}", base, folder, media_type);
        let path = format!("{}/{}.jpg", dir, filename);
        tokio::fs::create_dir_all(&dir).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("IO: {}", e)}))))?;
        tokio::fs::write(&path, &bytes).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("IO: {}", e)}))))?;
    }
    Ok(format!("{}/{}.jpg", media_type, filename))
}

pub(crate) fn strip_data_url(s: &str) -> &str {
    if let Some(pos) = s.find(',') { &s[pos + 1..] } else { s }
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": "Database error" })))
}

fn io_err(e: std::io::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("IO error: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("IO error: {}", e) })))
}
