use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct LabQuery {
    pub tgl_awal:  Option<String>,
    pub tgl_akhir: Option<String>,
    pub cari:      Option<String>,
    pub jenis:     Option<String>, // Rawat Jalan / Rawat Inap / IGD
    pub page:      Option<i64>,
    pub size:      Option<i64>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct LabRow {
    pub no_rawat:     String,
    pub no_rm:        String,
    pub nm_pasien:    Option<String>,
    pub tgl_lahir:    Option<String>,
    pub jk:           Option<String>,
    pub tgl_periksa:  String,
    pub jam_periksa:  Option<String>,
    pub nm_dokter:    Option<String>,
    pub dokter_pengirim: Option<String>,
    pub kd_pj:        Option<String>,
    pub png_jawab:    Option<String>,
    pub status:       Option<String>,
    pub status_lanjut: Option<String>,
}

#[derive(Serialize)]
pub struct LabListResponse {
    pub data:  Vec<LabRow>,
    pub total: i64,
    pub page:  i64,
    pub size:  i64,
}

pub async fn list_lab(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<LabQuery>,
) -> Result<Json<LabListResponse>, (StatusCode, Json<Value>)> {
    let page   = q.page.unwrap_or(1).max(1);
    let size   = q.size.unwrap_or(50).min(200);
    let offset = (page - 1) * size;
    let today  = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tgl_awal  = q.tgl_awal.unwrap_or_else(|| today.clone());
    let tgl_akhir = q.tgl_akhir.unwrap_or_else(|| today.clone());
    let cari_like = format!("%{}%", q.cari.unwrap_or_default());
    let jenis_like = match q.jenis.as_deref().unwrap_or("Semua") {
        "Semua" => "%".to_string(),
        "Rawat Jalan" => "Ralan".to_string(),
        "Rawat Inap"  => "Ranap".to_string(),
        "IGD"         => "IGD".to_string(),
        s => s.to_string(),
    };

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM tbl_periksa_lab lab
         LEFT JOIN pasien p  ON lab.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN dokter d  ON lab.kd_dokter = d.kd_dokter
         LEFT JOIN penjab pj ON lab.kd_pj = pj.kd_pj
         LEFT JOIN reg_periksa r ON lab.no_rawat = r.no_rawat
         WHERE lab.tgl_periksa BETWEEN ? AND ?
           AND r.status_lanjut LIKE ?
           AND (lab.no_rawat LIKE ? OR p.nm_pasien LIKE ?
                OR lab.no_rkm_medis LIKE ? OR d.nm_dokter LIKE ?)"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .bind(&jenis_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    let data: Vec<LabRow> = sqlx::query_as(
        "SELECT lab.no_rawat, lab.no_rkm_medis as no_rm, p.nm_pasien,
                DATE_FORMAT(p.tgl_lahir,'%Y-%m-%d') AS tgl_lahir, p.jk,
                DATE_FORMAT(lab.tgl_periksa,'%Y-%m-%d') AS tgl_periksa,
                TIME_FORMAT(lab.jam_periksa,'%H:%i:%s') AS jam_periksa,
                d.nm_dokter, lab.dokter_pengirim,
                lab.kd_pj, pj.png_jawab,
                lab.status, r.status_lanjut
         FROM tbl_periksa_lab lab
         LEFT JOIN pasien p  ON lab.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN dokter d  ON lab.kd_dokter = d.kd_dokter
         LEFT JOIN penjab pj ON lab.kd_pj = pj.kd_pj
         LEFT JOIN reg_periksa r ON lab.no_rawat = r.no_rawat
         WHERE lab.tgl_periksa BETWEEN ? AND ?
           AND r.status_lanjut LIKE ?
           AND (lab.no_rawat LIKE ? OR p.nm_pasien LIKE ?
                OR lab.no_rkm_medis LIKE ? OR d.nm_dokter LIKE ?)
         ORDER BY lab.tgl_periksa, lab.jam_periksa
         LIMIT ? OFFSET ?"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .bind(&jenis_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(size).bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(LabListResponse { data, total: total.0, page, size }))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error laboratorium: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
