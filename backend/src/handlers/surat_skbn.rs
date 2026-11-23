use crate::{
    auth::middleware::AuthUser,
    models::surat_skbn::{
        SuratSkbnListResponse, SuratSkbnPrefill, SuratSkbnRow, SuratSkbnSimpan,
        SuratSkbnSimpanResponse,
    },
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Deserialize)]
pub struct PrefillQuery { pub no_rawat: String }

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub tgl_awal: Option<String>,
    pub tgl_akhir: Option<String>,
    pub q: Option<String>,
    pub page: Option<i64>,
    pub size: Option<i64>,
}

fn require_perm(user: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if user.0.is_admin { return Ok(()); }
    let allowed = user.0.permissions.get("surat_bebas_narkoba").copied().unwrap_or(false);
    if !allowed {
        return Err((StatusCode::FORBIDDEN,
            Json(json!({"error": "Akses ditolak: tidak punya hak akses Surat Bebas Narkoba"}))));
    }
    Ok(())
}

pub async fn get_prefill(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<PrefillQuery>,
) -> Result<Json<SuratSkbnPrefill>, (StatusCode, Json<Value>)> {
    require_perm(&_user)?;

    let row: Option<(String, String, String, String, String, Option<String>, String, String)> = sqlx::query_as(
        "SELECT r.no_rawat, p.no_rkm_medis, p.nm_pasien, p.jk,
                CONCAT(r.umurdaftar,' ',r.sttsumur) AS umur,
                DATE_FORMAT(p.tgl_lahir,'%Y-%m-%d'),
                IFNULL(d.kd_dokter,''), IFNULL(d.nm_dokter,'')
         FROM reg_periksa r
         INNER JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN dokter d ON r.kd_dokter = d.kd_dokter
         WHERE r.no_rawat = ? LIMIT 1"
    ).bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;

    let (no_rawat, no_rm, nm_pasien, jk, umur, tgl_lahir, kd_dokter_reg, nm_dokter_reg) = match row {
        Some(r) => r,
        None => return Err((StatusCode::NOT_FOUND, Json(json!({"error": "No. rawat tidak ditemukan"})))),
    };

    let alamat: String = sqlx::query_as::<_, (String,)>(
        "SELECT CONCAT(IFNULL(p.alamat,''),', ',IFNULL(kel.nm_kel,''),', ',IFNULL(kec.nm_kec,''),', ',IFNULL(kab.nm_kab,''))
         FROM pasien p
         LEFT JOIN kelurahan kel ON p.kd_kel = kel.kd_kel
         LEFT JOIN kecamatan kec ON p.kd_kec = kec.kd_kec
         LEFT JOIN kabupaten kab ON p.kd_kab = kab.kd_kab
         WHERE p.no_rkm_medis = ? LIMIT 1"
    ).bind(&no_rm).fetch_optional(&state.pool).await.map_err(db_err)?
     .map(|t| t.0).unwrap_or_default();

    let existing: Option<(String, String, String, String, String, String, String, String, String, String, String)> = sqlx::query_as(
        "SELECT no_surat, DATE_FORMAT(tanggalsurat,'%Y-%m-%d'), kategori, kd_dokter, keperluan,
                opiat, ganja, amphetamin, methamphetamin, benzodiazepin, cocain
         FROM surat_skbn
         WHERE no_rawat = ? ORDER BY tanggalsurat DESC LIMIT 1"
    ).bind(&no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;

    let setting: Option<(String, String, String, String, String, String)> = sqlx::query_as(
        "SELECT IFNULL(nama_instansi,''), IFNULL(alamat_instansi,''),
                IFNULL(kabupaten,''), IFNULL(propinsi,''),
                IFNULL(kontak,''), IFNULL(email,'')
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;
    let (nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email) = setting.unwrap_or_default();

    let (no_surat, tanggalsurat, kategori, kd_dokter, keperluan, opiat, ganja, amphetamin, methamphetamin, benzodiazepin, cocain) =
        match existing {
            Some(e) => (Some(e.0), Some(e.1), e.2, e.3, e.4, e.5, e.6, e.7, e.8, e.9, e.10),
            None => (None, None, "UMUM".to_string(), kd_dokter_reg.clone(), String::new(),
                "NEGATIF".into(), "NEGATIF".into(), "NEGATIF".into(),
                "NEGATIF".into(), "NEGATIF".into(), "NEGATIF".into()),
        };

    let nm_dokter = if kd_dokter == kd_dokter_reg { nm_dokter_reg } else {
        sqlx::query_as::<_, (String,)>("SELECT nm_dokter FROM dokter WHERE kd_dokter=?")
            .bind(&kd_dokter).fetch_optional(&state.pool).await.map_err(db_err)?
            .map(|t| t.0).unwrap_or_default()
    };

    Ok(Json(SuratSkbnPrefill {
        no_rawat, no_rm, nm_pasien, jk, umur, tgl_lahir, alamat,
        kd_dokter, nm_dokter,
        no_surat, tanggalsurat, kategori, keperluan,
        opiat, ganja, amphetamin, methamphetamin, benzodiazepin, cocain,
        nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email,
    }))
}

pub async fn simpan(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<SuratSkbnSimpan>,
) -> Result<Json<SuratSkbnSimpanResponse>, (StatusCode, Json<Value>)> {
    require_perm(&_user)?;

    let no_surat = match body.no_surat.as_deref().filter(|s| !s.trim().is_empty()) {
        Some(s) => s.to_string(),
        None => generate_no_surat(&state).await?,
    };

    sqlx::query(
        "INSERT INTO surat_skbn
         (no_surat, no_rawat, tanggalsurat, kategori, kd_dokter, keperluan,
          opiat, ganja, amphetamin, methamphetamin, benzodiazepin, cocain)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           no_rawat=VALUES(no_rawat), tanggalsurat=VALUES(tanggalsurat),
           kategori=VALUES(kategori), kd_dokter=VALUES(kd_dokter),
           keperluan=VALUES(keperluan),
           opiat=VALUES(opiat), ganja=VALUES(ganja),
           amphetamin=VALUES(amphetamin), methamphetamin=VALUES(methamphetamin),
           benzodiazepin=VALUES(benzodiazepin), cocain=VALUES(cocain)"
    )
    .bind(&no_surat).bind(&body.no_rawat).bind(&body.tanggalsurat)
    .bind(&body.kategori).bind(&body.kd_dokter).bind(&body.keperluan)
    .bind(&body.opiat).bind(&body.ganja)
    .bind(&body.amphetamin).bind(&body.methamphetamin)
    .bind(&body.benzodiazepin).bind(&body.cocain)
    .execute(&state.pool).await.map_err(db_err)?;

    use crate::audit::q;
    crate::audit::log_sql(&state.pool, &_user.0.kode, &format!(
        "INSERT INTO surat_skbn (no_surat, no_rawat, tanggalsurat, kategori, kd_dokter, keperluan, opiat, ganja, amphetamin, methamphetamin, benzodiazepin, cocain) VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})",
        q(&no_surat), q(&body.no_rawat), q(&body.tanggalsurat), q(&body.kategori), q(&body.kd_dokter),
        q(&body.keperluan), q(&body.opiat), q(&body.ganja), q(&body.amphetamin),
        q(&body.methamphetamin), q(&body.benzodiazepin), q(&body.cocain)
    )).await;

    Ok(Json(SuratSkbnSimpanResponse {
        success: true, no_surat,
        message: "Surat keterangan bebas narkoba berhasil disimpan".to_string(),
    }))
}

pub async fn list(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<SuratSkbnListResponse>, (StatusCode, Json<Value>)> {
    require_perm(&_user)?;
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(50).clamp(1, 200);
    let offset = (page - 1) * size;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tgl_awal = q.tgl_awal.unwrap_or_else(|| today.clone());
    let tgl_akhir = q.tgl_akhir.unwrap_or_else(|| today.clone());
    let cari_like = format!("%{}%", q.q.unwrap_or_default());

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM surat_skbn s
         INNER JOIN reg_periksa r ON s.no_rawat = r.no_rawat
         INNER JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN dokter d ON s.kd_dokter = d.kd_dokter
         WHERE s.tanggalsurat BETWEEN ? AND ?
           AND (s.no_surat LIKE ? OR s.no_rawat LIKE ? OR p.nm_pasien LIKE ?
                OR p.no_rkm_medis LIKE ? OR s.keperluan LIKE ? OR d.nm_dokter LIKE ?)"
    ).bind(&tgl_awal).bind(&tgl_akhir)
     .bind(&cari_like).bind(&cari_like).bind(&cari_like)
     .bind(&cari_like).bind(&cari_like).bind(&cari_like)
     .fetch_one(&state.pool).await.map_err(db_err)?;

    let data: Vec<SuratSkbnRow> = sqlx::query_as(
        "SELECT s.no_surat, s.no_rawat,
                p.no_rkm_medis as no_rm, p.nm_pasien,
                DATE_FORMAT(s.tanggalsurat,'%Y-%m-%d') as tanggalsurat,
                s.kategori, s.keperluan,
                s.kd_dokter, IFNULL(d.nm_dokter,'') as nm_dokter
         FROM surat_skbn s
         INNER JOIN reg_periksa r ON s.no_rawat = r.no_rawat
         INNER JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN dokter d ON s.kd_dokter = d.kd_dokter
         WHERE s.tanggalsurat BETWEEN ? AND ?
           AND (s.no_surat LIKE ? OR s.no_rawat LIKE ? OR p.nm_pasien LIKE ?
                OR p.no_rkm_medis LIKE ? OR s.keperluan LIKE ? OR d.nm_dokter LIKE ?)
         ORDER BY s.tanggalsurat DESC, s.no_surat DESC
         LIMIT ? OFFSET ?"
    ).bind(&tgl_awal).bind(&tgl_akhir)
     .bind(&cari_like).bind(&cari_like).bind(&cari_like)
     .bind(&cari_like).bind(&cari_like).bind(&cari_like)
     .bind(size).bind(offset)
     .fetch_all(&state.pool).await.map_err(db_err)?;

    Ok(Json(SuratSkbnListResponse { data, total: total.0, page, size }))
}

pub async fn hapus(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(no_surat): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&_user)?;
    let res = sqlx::query("DELETE FROM surat_skbn WHERE no_surat = ?")
        .bind(&no_surat).execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Surat tidak ditemukan"}))));
    }
    crate::audit::log_sql(&state.pool, &_user.0.kode, &format!(
        "DELETE FROM surat_skbn WHERE no_surat={}", crate::audit::q(&no_surat)
    )).await;
    Ok(Json(json!({"success": true, "no_surat": no_surat})))
}

async fn generate_no_surat(state: &AppState) -> Result<String, (StatusCode, Json<Value>)> {
    let today = chrono::Local::now().format("%Y%m%d").to_string();
    let prefix = format!("SKBN-{}-", today);
    let like = format!("{}%", prefix);
    let max: Option<(String,)> = sqlx::query_as(
        "SELECT no_surat FROM surat_skbn
         WHERE no_surat LIKE ? ORDER BY no_surat DESC LIMIT 1"
    ).bind(&like).fetch_optional(&state.pool).await.map_err(db_err)?;
    let next = max.and_then(|(s,)| s.rsplit('-').next().and_then(|n| n.parse::<u32>().ok()))
        .map(|n| n + 1).unwrap_or(1);
    Ok(format!("{}{:03}", prefix, next))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error surat_skbn: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
