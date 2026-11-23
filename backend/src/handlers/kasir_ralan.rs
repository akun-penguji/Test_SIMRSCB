use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct KasirRalanQuery {
    pub tgl_awal:      Option<String>,
    pub tgl_akhir:     Option<String>,
    pub status_periksa: Option<String>,
    pub status_bayar:  Option<String>,
    pub poli:          Option<String>,
    pub dokter:        Option<String>,
    pub cari:          Option<String>,
    pub page:          Option<i64>,
    pub size:          Option<i64>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct KasirRalan {
    pub no_rawat:      String,
    pub tgl_registrasi: Option<String>,
    pub jam_reg:       Option<String>,
    pub no_reg:        Option<String>,
    pub no_rm:         String,
    pub nm_pasien:     Option<String>,
    pub no_tlp:        Option<String>,
    pub kd_dokter:     Option<String>,
    pub nm_dokter:     Option<String>,
    pub kd_poli:       Option<String>,
    pub nm_poli:       Option<String>,
    pub kd_pj:         Option<String>,
    pub png_jawab:     Option<String>,
    pub p_jawab:       Option<String>,
    pub almt_pj:       Option<String>,
    pub hubunganpj:    Option<String>,
    pub biaya_reg:     Option<f64>,
    pub stts:          Option<String>,
    pub stts_daftar:   Option<String>,
    pub status_bayar:  Option<String>,
    pub status_poli:   Option<String>,
}

#[derive(Serialize)]
pub struct KasirRalanListResponse {
    pub data:  Vec<KasirRalan>,
    pub total: i64,
    pub page:  i64,
    pub size:  i64,
}

pub async fn list_kasir_ralan(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<KasirRalanQuery>,
) -> Result<Json<KasirRalanListResponse>, (StatusCode, Json<Value>)> {
    let page   = q.page.unwrap_or(1).max(1);
    let size   = q.size.unwrap_or(50).min(200);
    let offset = (page - 1) * size;
    let today  = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tgl_awal  = q.tgl_awal.unwrap_or_else(|| today.clone());
    let tgl_akhir = q.tgl_akhir.unwrap_or_else(|| today.clone());

    let poli_like   = format!("%{}%", q.poli.unwrap_or_default());
    let dokter_like = format!("%{}%", q.dokter.unwrap_or_default());
    let cari_like   = format!("%{}%", q.cari.unwrap_or_default());
    let status_like = match q.status_periksa.as_deref().unwrap_or("Semua") {
        "Semua" => "%".to_string(),
        s       => s.to_string(),
    };
    let bayar_like = match q.status_bayar.as_deref().unwrap_or("Semua") {
        "Semua" => "%".to_string(),
        s       => s.to_string(),
    };

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM reg_periksa r
         LEFT JOIN pasien p      ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN poliklinik po ON r.kd_poli = po.kd_poli
         LEFT JOIN dokter d      ON r.kd_dokter = d.kd_dokter
         LEFT JOIN penjab pj     ON r.kd_pj = pj.kd_pj
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND r.kd_poli != 'IGDK'
           AND po.nm_poli LIKE ?
           AND d.nm_dokter LIKE ?
           AND r.stts LIKE ?
           AND r.status_bayar LIKE ?
           AND (r.no_reg LIKE ? OR r.no_rawat LIKE ? OR p.nm_pasien LIKE ?
                OR po.nm_poli LIKE ? OR d.nm_dokter LIKE ?)"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .bind(&poli_like).bind(&dokter_like)
    .bind(&status_like).bind(&bayar_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(&cari_like).bind(&cari_like)
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    let data: Vec<KasirRalan> = sqlx::query_as(
        "SELECT r.no_rawat,
                DATE_FORMAT(r.tgl_registrasi,'%Y-%m-%d') as tgl_registrasi,
                TIME_FORMAT(r.jam_reg,'%H:%i:%s') as jam_reg,
                r.no_reg,
                r.no_rkm_medis as no_rm, p.nm_pasien, p.no_tlp,
                r.kd_dokter, d.nm_dokter, r.kd_poli, po.nm_poli,
                r.kd_pj, pj.png_jawab, r.p_jawab, r.almt_pj, r.hubunganpj,
                r.biaya_reg, r.stts, r.stts_daftar, r.status_bayar, r.status_poli
         FROM reg_periksa r
         LEFT JOIN pasien p      ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN poliklinik po ON r.kd_poli = po.kd_poli
         LEFT JOIN dokter d      ON r.kd_dokter = d.kd_dokter
         LEFT JOIN penjab pj     ON r.kd_pj = pj.kd_pj
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND r.kd_poli != 'IGDK'
           AND po.nm_poli LIKE ?
           AND d.nm_dokter LIKE ?
           AND r.stts LIKE ?
           AND r.status_bayar LIKE ?
           AND (r.no_reg LIKE ? OR r.no_rawat LIKE ? OR p.nm_pasien LIKE ?
                OR po.nm_poli LIKE ? OR d.nm_dokter LIKE ?)
         ORDER BY r.tgl_registrasi, r.no_reg
         LIMIT ? OFFSET ?"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .bind(&poli_like).bind(&dokter_like)
    .bind(&status_like).bind(&bayar_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(&cari_like).bind(&cari_like)
    .bind(size).bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(KasirRalanListResponse { data, total: total.0, page, size }))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error kasir_ralan: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
