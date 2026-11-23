// Dokumen bukti per-EP akreditasi. Bisa upload file (disimpan di pohon webapps)
// atau tautan Google Drive. File disajikan lewat GET .../dokumen/file/:name.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Multipart, Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB akreditasi_dokumen: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses dokumen akreditasi"})))
}
fn dok_dir() -> String {
    std::env::var("AKREDITASI_DOKUMEN_DIR")
        .unwrap_or_else(|_| "/var/www/html/webapps/simrscb/akreditasi".to_string())
}
fn ext_of(name: &str) -> String {
    let e = name.rsplit_once('.').map(|(_, b)| b).unwrap_or("").to_lowercase();
    if !e.is_empty() && e.len() <= 5 && e.chars().all(|c| c.is_ascii_alphanumeric()) { e } else { "bin".to_string() }
}
fn sanitize_stem(s: &str) -> String {
    let stem = s.rsplit_once('.').map(|(a, _)| a).unwrap_or(s);
    let out: String = stem.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect();
    let out: String = out.trim_matches('-').chars().take(60).collect();
    if out.is_empty() { "dok".to_string() } else { out }
}
fn content_type(ext: &str) -> &'static str {
    match ext {
        "pdf" => "application/pdf",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt" => "application/vnd.ms-powerpoint",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "png" => "image/png", "jpg" | "jpeg" => "image/jpeg",
        _ => "application/octet-stream",
    }
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Dokumen {
    pub id: i64, pub kd_ep: String, pub nama: String, pub jenis: String,
    pub link: String, pub keterangan: String, pub uploaded_by: String, pub uploaded_at: Option<String>,
}
pub async fn list_by_ep(_user: AuthUser, State(state): State<AppState>, Path(kd_ep): Path<String>)
  -> Result<Json<Vec<Dokumen>>, (StatusCode, Json<Value>)> {
    let rows = sqlx::query_as::<_, Dokumen>(
        "SELECT id, kd_ep, IFNULL(nama,'') nama, IFNULL(jenis,'') jenis, IFNULL(link,'') link, \
                IFNULL(keterangan,'') keterangan, IFNULL(uploaded_by,'') uploaded_by, CAST(uploaded_at AS CHAR) uploaded_at \
         FROM simrscb_akreditasi_dokumen WHERE kd_ep=? ORDER BY uploaded_at DESC, id DESC"
    ).bind(&kd_ep).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct LinkBody {
    pub kd_ep: String, pub nama: String, pub link: String,
    #[serde(default)] pub keterangan: String,
}
pub async fn add_link(user: AuthUser, State(state): State<AppState>, Json(b): Json<LinkBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "akreditasi_edit")?;
    if b.nama.trim().is_empty() || b.link.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Nama & link wajib diisi"}))));
    }
    sqlx::query(
        "INSERT INTO simrscb_akreditasi_dokumen (kd_ep, nama, jenis, link, keterangan, uploaded_by) VALUES (?, ?, 'drive', ?, ?, ?)"
    ).bind(&b.kd_ep).bind(&b.nama).bind(&b.link).bind(&b.keterangan).bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("akreditasi dokumen link ep={}", b.kd_ep)).await;
    Ok(Json(json!({"ok": true})))
}

/// POST multipart: field `kd_ep`, `keterangan` (opsional), `file`.
pub async fn upload(user: AuthUser, State(state): State<AppState>, mut mp: Multipart)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "akreditasi_edit")?;
    let dir = dok_dir();
    tokio::fs::create_dir_all(&dir).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("mkdir: {}", e)}))))?;
    let mut kd_ep = String::new();
    let mut keterangan = String::new();
    let mut nama = String::new();
    let mut stored = String::new();
    while let Some(field) = mp.next_field().await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": format!("multipart: {}", e)}))))? {
        match field.name() {
            Some("kd_ep") => { kd_ep = field.text().await.unwrap_or_default(); }
            Some("keterangan") => { keterangan = field.text().await.unwrap_or_default(); }
            Some("file") => {
                let orig = field.file_name().unwrap_or("dokumen").to_string();
                let bytes = field.bytes().await
                    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": format!("baca file: {}", e)}))))?;
                if bytes.is_empty() {
                    return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "file kosong"}))));
                }
                let ext = ext_of(&orig);
                let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis()).unwrap_or(0);
                stored = format!("{}-{}.{}", sanitize_stem(&orig), ts, ext);
                nama = orig.rsplit_once('.').map(|(a, _)| a).unwrap_or(&orig).to_string();
                tokio::fs::write(format!("{}/{}", dir, stored), &bytes).await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("tulis: {}", e)}))))?;
            }
            _ => {}
        }
    }
    if kd_ep.trim().is_empty() || stored.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "kd_ep & file wajib"}))));
    }
    let link = format!("/api/akreditasi/dokumen/file/{}", stored);
    sqlx::query(
        "INSERT INTO simrscb_akreditasi_dokumen (kd_ep, nama, jenis, link, stored_name, keterangan, uploaded_by) VALUES (?, ?, 'file', ?, ?, ?, ?)"
    ).bind(&kd_ep).bind(&nama).bind(&link).bind(&stored).bind(&keterangan).bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("akreditasi dokumen upload ep={} file={}", kd_ep, stored)).await;
    Ok(Json(json!({"ok": true, "link": link})))
}

/// GET file — publik (tanpa auth) agar bisa dibuka via tautan biasa (pola SIDOMU).
pub async fn serve_file(Path(name): Path<String>) -> Result<Response, (StatusCode, Json<Value>)> {
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "nama tidak valid"}))));
    }
    let path = format!("{}/{}", dok_dir(), name);
    let bytes = tokio::fs::read(&path).await
        .map_err(|_| (StatusCode::NOT_FOUND, Json(json!({"error": "file tidak ditemukan"}))))?;
    let ct = content_type(&ext_of(&name));
    Ok((
        [(header::CONTENT_TYPE, ct.to_string()),
         (header::CONTENT_DISPOSITION, format!("inline; filename=\"{}\"", name)),
         (header::CACHE_CONTROL, "private, max-age=3600".to_string())],
        bytes,
    ).into_response())
}

pub async fn del(user: AuthUser, State(state): State<AppState>, Path(id): Path<i64>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "akreditasi_edit")?;
    // Hapus file fisik bila jenis file
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT IFNULL(jenis,''), IFNULL(stored_name,'') FROM simrscb_akreditasi_dokumen WHERE id=?"
    ).bind(id).fetch_optional(&state.pool).await.map_err(db_err)?;
    if let Some((jenis, stored)) = row {
        if jenis == "file" && !stored.is_empty() && !stored.contains('/') && !stored.contains("..") {
            let _ = tokio::fs::remove_file(format!("{}/{}", dok_dir(), stored)).await;
        }
    }
    sqlx::query("DELETE FROM simrscb_akreditasi_dokumen WHERE id=?").bind(id).execute(&state.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
