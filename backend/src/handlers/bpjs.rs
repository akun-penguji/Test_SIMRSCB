use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct BpjsQuery {
    pub tgl_awal:  Option<String>,
    pub tgl_akhir: Option<String>,
    pub cari:      Option<String>,
    pub page:      Option<i64>,
    pub size:      Option<i64>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct SepRow {
    pub no_sep:         Option<String>,
    pub no_rawat:       String,
    pub no_rm:          Option<String>,
    pub nm_pasien:      Option<String>,
    pub tgl_sep:        Option<String>,
    pub tgl_rujuk:      Option<String>,
    pub no_rujukan:     Option<String>,
    pub nm_ppk:         Option<String>,
    pub jenis_rawat:    Option<String>,
    pub kls_rawat:      Option<String>,
    pub kd_diagnosa:    Option<String>,
    pub nm_diagnosa:    Option<String>,
    pub nm_poli:        Option<String>,
    pub no_kartu:       Option<String>,
    pub nm_peserta:     Option<String>,
    pub nm_dpjp:        Option<String>,
    pub tujuan_kunjungan: Option<String>,
    pub status_pulang:  Option<String>,
    pub tgl_pulang:     Option<String>,
}

#[derive(Serialize)]
pub struct BpjsListResponse {
    pub data:  Vec<SepRow>,
    pub total: i64,
    pub page:  i64,
    pub size:  i64,
}

pub async fn list_sep(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<BpjsQuery>,
) -> Result<Json<BpjsListResponse>, (StatusCode, Json<Value>)> {
    let page   = q.page.unwrap_or(1).max(1);
    let size   = q.size.unwrap_or(50).min(200);
    let offset = (page - 1) * size;
    let today  = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tgl_awal  = q.tgl_awal.unwrap_or_else(|| today.clone());
    let tgl_akhir = q.tgl_akhir.unwrap_or_else(|| today.clone());
    let cari_like = format!("%{}%", q.cari.unwrap_or_default());

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM sep s
         LEFT JOIN pasien p ON s.no_rkm_medis = p.no_rkm_medis
         WHERE s.tgl_sep BETWEEN ? AND ?
           AND (s.no_sep LIKE ? OR s.no_rawat LIKE ? OR s.no_rkm_medis LIKE ?
                OR p.nm_pasien LIKE ? OR s.no_kartu LIKE ?)"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(&cari_like).bind(&cari_like)
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    let data: Vec<SepRow> = sqlx::query_as(
        "SELECT s.no_sep, s.no_rawat, s.no_rkm_medis as no_rm, p.nm_pasien,
                DATE_FORMAT(s.tgl_sep,'%Y-%m-%d') AS tgl_sep,
                DATE_FORMAT(s.tgl_rujuk,'%Y-%m-%d') AS tgl_rujuk, s.no_rujukan, s.nm_ppk,
                s.jenis_rawat, s.kls_rawat,
                s.kd_diagnosa, s.nm_diagnosa,
                s.nm_poli, s.no_kartu, s.nm_peserta,
                d.nm_dokter as nm_dpjp,
                s.tujuan_kunjungan, s.status_pulang,
                DATE_FORMAT(s.tgl_pulang,'%Y-%m-%d') AS tgl_pulang
         FROM sep s
         LEFT JOIN pasien p ON s.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN dokter d ON s.kd_dokter = d.kd_dokter
         WHERE s.tgl_sep BETWEEN ? AND ?
           AND (s.no_sep LIKE ? OR s.no_rawat LIKE ? OR s.no_rkm_medis LIKE ?
                OR p.nm_pasien LIKE ? OR s.no_kartu LIKE ?)
         ORDER BY s.tgl_sep DESC
         LIMIT ? OFFSET ?"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(&cari_like).bind(&cari_like)
    .bind(size).bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(BpjsListResponse { data, total: total.0, page, size }))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error bpjs: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
