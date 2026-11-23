use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct PegawaiQuery {
    pub cari:        Option<String>,
    pub status_aktif: Option<String>,
    pub page:        Option<i64>,
    pub size:        Option<i64>,
}

#[derive(Deserialize)]
pub struct JadwalQuery {
    pub tgl:  Option<String>,
    pub cari: Option<String>,
    pub page: Option<i64>,
    pub size: Option<i64>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct PegawaiRow {
    pub nip:         Option<String>,
    pub nama:        Option<String>,
    pub jenis_kelamin: Option<String>,
    pub jabatan:     Option<String>,
    pub bagian:      Option<String>,
    pub tmp_lahir:   Option<String>,
    pub tgl_lahir:   Option<String>,
    pub tgl_masuk:   Option<String>,
    pub no_ktp:      Option<String>,
    pub pendidikan_terakhir: Option<String>,
    pub no_tlp:      Option<String>,
    pub status_aktif: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct JadwalRow {
    pub nip:       Option<String>,
    pub nama:      Option<String>,
    pub bagian:    Option<String>,
    pub tgl_kerja: Option<String>,
    pub jam_masuk: Option<String>,
    pub jam_keluar: Option<String>,
    pub keterangan: Option<String>,
}

#[derive(Serialize)]
pub struct PegawaiListResponse {
    pub data:  Vec<PegawaiRow>,
    pub total: i64,
    pub page:  i64,
    pub size:  i64,
}

#[derive(Serialize)]
pub struct JadwalListResponse {
    pub data:  Vec<JadwalRow>,
    pub total: i64,
    pub page:  i64,
    pub size:  i64,
}

pub async fn list_pegawai(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<PegawaiQuery>,
) -> Result<Json<PegawaiListResponse>, (StatusCode, Json<Value>)> {
    let page   = q.page.unwrap_or(1).max(1);
    let size   = q.size.unwrap_or(50).min(200);
    let offset = (page - 1) * size;
    let cari_like = format!("%{}%", q.cari.unwrap_or_default());
    let status_like = match q.status_aktif.as_deref().unwrap_or("Semua") {
        "Semua" => "%".to_string(),
        s       => s.to_string(),
    };

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM petugas
         WHERE status_aktif LIKE ?
           AND (nip LIKE ? OR nama LIKE ? OR jabatan LIKE ? OR bagian LIKE ?)"
    )
    .bind(&status_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    let data: Vec<PegawaiRow> = sqlx::query_as(
        "SELECT nip, nama, jenis_kelamin, jabatan, bagian,
                tmp_lahir,
                DATE_FORMAT(tgl_lahir,'%Y-%m-%d') AS tgl_lahir,
                DATE_FORMAT(tgl_masuk,'%Y-%m-%d') AS tgl_masuk, no_ktp,
                pendidikan_terakhir, no_tlp, status_aktif
         FROM petugas
         WHERE status_aktif LIKE ?
           AND (nip LIKE ? OR nama LIKE ? OR jabatan LIKE ? OR bagian LIKE ?)
         ORDER BY nama
         LIMIT ? OFFSET ?"
    )
    .bind(&status_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(size).bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(PegawaiListResponse { data, total: total.0, page, size }))
}

pub async fn list_jadwal(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<JadwalQuery>,
) -> Result<Json<JadwalListResponse>, (StatusCode, Json<Value>)> {
    let page   = q.page.unwrap_or(1).max(1);
    let size   = q.size.unwrap_or(100).min(500);
    let offset = (page - 1) * size;
    let today  = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tgl    = q.tgl.unwrap_or(today);
    let cari_like = format!("%{}%", q.cari.unwrap_or_default());

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM jadwal_pegawai jp
         LEFT JOIN petugas pt ON jp.nip = pt.nip
         WHERE jp.tgl_kerja = ?
           AND (jp.nip LIKE ? OR pt.nama LIKE ? OR jp.bagian LIKE ?)"
    )
    .bind(&tgl)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .fetch_one(&state.pool)
    .await
    .unwrap_or((0,));

    let data: Vec<JadwalRow> = sqlx::query_as(
        "SELECT jp.nip, pt.nama, jp.bagian,
                DATE_FORMAT(jp.tgl_kerja,'%Y-%m-%d') AS tgl_kerja,
                TIME_FORMAT(jp.jam_masuk,'%H:%i:%s') AS jam_masuk,
                TIME_FORMAT(jp.jam_keluar,'%H:%i:%s') AS jam_keluar, jp.keterangan
         FROM jadwal_pegawai jp
         LEFT JOIN petugas pt ON jp.nip = pt.nip
         WHERE jp.tgl_kerja = ?
           AND (jp.nip LIKE ? OR pt.nama LIKE ? OR jp.bagian LIKE ?)
         ORDER BY pt.nama
         LIMIT ? OFFSET ?"
    )
    .bind(&tgl)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(size).bind(offset)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Ok(Json(JadwalListResponse { data, total: total.0, page, size }))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error kepegawaian: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
