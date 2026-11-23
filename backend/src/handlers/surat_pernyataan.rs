// Simpan generik untuk surat pernyataan/persetujuan yang belum punya tabel sendiri
// (masuk_unit, jaminan_umum, titip_kelas, jamkesda, bersedia_igd, persetujuan_penolakan,
// pulang_aps). Field form disimpan sebagai JSON di simrscb_surat_pernyataan, dikunci
// per (no_rawat, jenis). Cetak dilakukan di frontend via window.print (dokumen sudah
// dirender lengkap), jadi backend cukup simpan + prefill.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB surat_pernyataan: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data surat pernyataan"})))
}

#[derive(Deserialize)]
pub struct PrefillQuery {
    pub no_rawat: String,
    pub jenis: String,
}

#[derive(Serialize)]
pub struct PrefillResp {
    pub no_surat: Option<String>,
    pub tanggal: Option<String>,
    pub data: Option<String>, // JSON string FormState tersimpan (null kalau belum ada)
}

/// GET /surat/pernyataan?no_rawat=&jenis= — ambil data tersimpan (untuk prefill form).
pub async fn get_prefill(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<PrefillQuery>,
) -> Result<Json<PrefillResp>, (StatusCode, Json<Value>)> {
    let row: Option<(Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT no_surat, DATE_FORMAT(tanggal,'%Y-%m-%d'), data \
         FROM simrscb_surat_pernyataan WHERE no_rawat = ? AND jenis = ? LIMIT 1"
    )
    .bind(&q.no_rawat)
    .bind(&q.jenis)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;

    let (no_surat, tanggal, data) = row.unwrap_or((None, None, None));
    Ok(Json(PrefillResp { no_surat, tanggal, data }))
}

#[derive(Deserialize)]
pub struct SimpanBody {
    pub no_rawat: String,
    pub jenis: String,
    #[serde(default)]
    pub tanggal: Option<String>,
    #[serde(default)]
    pub no_surat: Option<String>,
    pub data: String, // JSON FormState
}

#[derive(Serialize)]
pub struct SimpanResp {
    pub success: bool,
    pub no_surat: String,
}

/// POST /surat/pernyataan — upsert data form (per no_rawat + jenis).
pub async fn simpan(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<SimpanBody>,
) -> Result<Json<SimpanResp>, (StatusCode, Json<Value>)> {
    if b.no_rawat.trim().is_empty() || b.jenis.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "no_rawat & jenis wajib"}))));
    }

    let no_surat = match b.no_surat.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(s) => s.to_string(),
        None => generate_no_surat(&state, &b.jenis).await?,
    };

    sqlx::query(
        "INSERT INTO simrscb_surat_pernyataan (no_rawat, jenis, no_surat, data, tanggal, updated_by) \
         VALUES (?,?,?,?,?,?) \
         ON DUPLICATE KEY UPDATE no_surat=VALUES(no_surat), data=VALUES(data), \
           tanggal=VALUES(tanggal), updated_by=VALUES(updated_by)"
    )
    .bind(&b.no_rawat)
    .bind(&b.jenis)
    .bind(&no_surat)
    .bind(&b.data)
    .bind(&b.tanggal)
    .bind(&user.0.kode)
    .execute(&state.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(SimpanResp { success: true, no_surat }))
}

/// Nomor surat: PRN/<KODE>/<YYYY>/<NNNN berjalan per jenis per tahun>.
async fn generate_no_surat(state: &AppState, jenis: &str) -> Result<String, (StatusCode, Json<Value>)> {
    let (n,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*)+1 FROM simrscb_surat_pernyataan \
         WHERE jenis = ? AND YEAR(updated_at) = YEAR(CURDATE())"
    )
    .bind(jenis)
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    let kode: String = jenis.chars().filter(|c| c.is_ascii_alphanumeric())
        .take(4).collect::<String>().to_uppercase();
    let tahun = chrono::Local::now().format("%Y").to_string();
    Ok(format!("PRN/{}/{}/{:04}", kode, tahun, n))
}
