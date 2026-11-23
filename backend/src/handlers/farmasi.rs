use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct FarmasiQuery {
    pub tgl_awal:  Option<String>,
    pub tgl_akhir: Option<String>,
    pub cari:      Option<String>,
    pub page:      Option<i64>,
    pub size:      Option<i64>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct ResepRow {
    pub no_resep:       String,
    pub tgl_peresepan:  Option<String>,
    pub jam_peresepan:  Option<String>,
    pub no_rawat:       Option<String>,
    pub no_rm:          Option<String>,
    pub nm_pasien:      Option<String>,
    pub nm_dokter:      Option<String>,
    pub kd_pj:          Option<String>,
    pub png_jawab:      Option<String>,
    pub status:         Option<String>,
}

#[derive(Serialize)]
pub struct FarmasiListResponse {
    pub data:  Vec<ResepRow>,
    pub total: i64,
    pub page:  i64,
    pub size:  i64,
}

/// Daftar resep apotek RAWAT JALAN saja (`resep_obat.status='ralan'`); resep
/// ranap ditangani depo/ruangan, jadi tidak ikut ditampilkan di sini.
pub async fn list_resep(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<FarmasiQuery>,
) -> Result<Json<FarmasiListResponse>, (StatusCode, Json<Value>)> {
    let page   = q.page.unwrap_or(1).max(1);
    let size   = q.size.unwrap_or(50).min(200);
    let offset = (page - 1) * size;
    let today  = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tgl_awal  = q.tgl_awal.unwrap_or_else(|| today.clone());
    let tgl_akhir = q.tgl_akhir.unwrap_or_else(|| today.clone());
    let cari_like = format!("%{}%", q.cari.unwrap_or_default());

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM resep_obat ro
         LEFT JOIN pasien p  ON ro.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN dokter d  ON ro.kd_dokter = d.kd_dokter
         LEFT JOIN penjab pj ON ro.kd_pj = pj.kd_pj
         WHERE ro.status = 'ralan'
           AND ro.tgl_peresepan BETWEEN ? AND ?
           AND (ro.no_resep LIKE ? OR ro.no_rawat LIKE ?
                OR p.nm_pasien LIKE ? OR d.nm_dokter LIKE ?)"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    let data: Vec<ResepRow> = sqlx::query_as(
        "SELECT ro.no_resep, ro.tgl_peresepan, ro.jam_peresepan,
                ro.no_rawat, ro.no_rkm_medis as no_rm, p.nm_pasien,
                d.nm_dokter, ro.kd_pj, pj.png_jawab,
                ro.status
         FROM resep_obat ro
         LEFT JOIN pasien p  ON ro.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN dokter d  ON ro.kd_dokter = d.kd_dokter
         LEFT JOIN penjab pj ON ro.kd_pj = pj.kd_pj
         WHERE ro.status = 'ralan'
           AND ro.tgl_peresepan BETWEEN ? AND ?
           AND (ro.no_resep LIKE ? OR ro.no_rawat LIKE ?
                OR p.nm_pasien LIKE ? OR d.nm_dokter LIKE ?)
         ORDER BY ro.tgl_peresepan DESC, ro.jam_peresepan DESC
         LIMIT ? OFFSET ?"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(size).bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(FarmasiListResponse { data, total: total.0, page, size }))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error farmasi: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
