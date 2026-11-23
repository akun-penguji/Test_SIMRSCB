// Modul SIDOMU (Sistem Dokumen Mutu) — Komite Mutu RSCB. Katalog SOP/dokumen mutu
// (sumber Google Drive) + pemetaan ke EP akreditasi STARKES.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Multipart, Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// ID folder Google Drive "SOP" milik Komite Mutu (untuk embed & tautan).
pub const FOLDER_ID: &str = "1KMsyttCjNowyAFGzVtdbr8EAn4WDuaW1";

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB sidomu: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data SIDOMU"})))
}
fn adminonly(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if u.0.is_admin { Ok(()) } else { Err((StatusCode::FORBIDDEN, Json(json!({"error": "Hanya admin"})))) }
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Sop {
    pub id: i64, pub nama: String, pub kategori: String, pub jenis: String,
    pub drive_id: String, pub link: String, pub keterangan: String, pub urutan: i64,
    pub bab: String,
    pub eps: String, // daftar kd_ep terkait, dipisah koma
}

#[derive(Deserialize)]
pub struct ListQuery {
    #[serde(default)] pub q: Option<String>,
    #[serde(default)] pub kategori: Option<String>,
}
pub async fn list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQuery>)
  -> Result<Json<Vec<Sop>>, (StatusCode, Json<Value>)> {
    let like = format!("%{}%", q.q.as_deref().unwrap_or("").trim());
    let rows = sqlx::query_as::<_, Sop>(
        "SELECT s.id, IFNULL(s.nama,'') nama, IFNULL(s.kategori,'') kategori, IFNULL(s.jenis,'') jenis, \
                IFNULL(s.drive_id,'') drive_id, IFNULL(s.link,'') link, IFNULL(s.keterangan,'') keterangan, IFNULL(s.urutan,0) urutan, \
                IFNULL(s.bab,'') bab, \
                IFNULL((SELECT GROUP_CONCAT(m.kd_ep ORDER BY m.kd_ep SEPARATOR ',') FROM simrscb_sidomu_ep m WHERE m.sop_id=s.id),'') eps \
         FROM simrscb_sidomu_sop s \
         WHERE (? = '%%' OR s.nama LIKE ? OR s.kategori LIKE ? OR s.keterangan LIKE ?) \
           AND (? = '' OR s.kategori = ?) \
         ORDER BY s.kategori ASC, s.urutan ASC, s.nama ASC LIMIT 2000"
    )
    .bind(&like).bind(&like).bind(&like).bind(&like)
    .bind(q.kategori.as_deref().unwrap_or("")).bind(q.kategori.as_deref().unwrap_or(""))
    .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct KV { pub k: String, pub v: i64 }
#[derive(Serialize)]
pub struct Meta { pub folder_id: String, pub total: i64, pub kategori: Vec<KV> }
pub async fn meta(_u: AuthUser, State(s): State<AppState>) -> Json<Meta> {
    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM simrscb_sidomu_sop").fetch_one(&s.pool).await.unwrap_or((0,));
    let kategori: Vec<KV> = sqlx::query_as(
        "SELECT IFNULL(NULLIF(kategori,''),'Lainnya') k, COUNT(*) v FROM simrscb_sidomu_sop GROUP BY kategori ORDER BY v DESC")
        .fetch_all(&s.pool).await.unwrap_or_default();
    Json(Meta { folder_id: FOLDER_ID.to_string(), total: total.0, kategori })
}

#[derive(Deserialize)]
pub struct SaveBody {
    #[serde(default)] pub id: Option<i64>,
    pub nama: String,
    #[serde(default)] pub kategori: String, #[serde(default)] pub jenis: String,
    #[serde(default)] pub drive_id: String, #[serde(default)] pub link: String,
    #[serde(default)] pub keterangan: String, #[serde(default)] pub urutan: i64,
}
pub async fn save(u: AuthUser, State(s): State<AppState>, Json(b): Json<SaveBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    // ekstrak drive_id dari link kalau kosong
    let drive_id = if !b.drive_id.is_empty() { b.drive_id.clone() } else { extract_drive_id(&b.link) };
    match b.id {
        Some(id) => { sqlx::query("UPDATE simrscb_sidomu_sop SET nama=?,kategori=?,jenis=?,drive_id=?,link=?,keterangan=?,urutan=?,updated_by=? WHERE id=?")
            .bind(&b.nama).bind(&b.kategori).bind(&b.jenis).bind(&drive_id).bind(&b.link).bind(&b.keterangan).bind(b.urutan).bind(&u.0.kode).bind(id)
            .execute(&s.pool).await.map_err(db_err)?; }
        None => { sqlx::query("INSERT INTO simrscb_sidomu_sop (nama,kategori,jenis,drive_id,link,keterangan,urutan,updated_by) VALUES (?,?,?,?,?,?,?,?)")
            .bind(&b.nama).bind(&b.kategori).bind(&b.jenis).bind(&drive_id).bind(&b.link).bind(&b.keterangan).bind(b.urutan).bind(&u.0.kode)
            .execute(&s.pool).await.map_err(db_err)?; }
    }
    Ok(Json(json!({"ok": true})))
}
pub async fn del(u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    sqlx::query("DELETE FROM simrscb_sidomu_ep WHERE sop_id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    sqlx::query("DELETE FROM simrscb_sidomu_sop WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Pemetaan SOP ↔ EP akreditasi ─────────────────────────────────────────────
pub async fn by_ep(_u: AuthUser, State(s): State<AppState>, Path(kd_ep): Path<String>)
  -> Result<Json<Vec<Sop>>, (StatusCode, Json<Value>)> {
    // Tampilkan SOP yang: (a) dikaitkan manual ke EP ini, ATAU
    // (b) bab-nya sama dengan bab EP ini (automap per unit).
    let rows = sqlx::query_as::<_, Sop>(
        "SELECT s.id, IFNULL(s.nama,'') nama, IFNULL(s.kategori,'') kategori, IFNULL(s.jenis,'') jenis, \
                IFNULL(s.drive_id,'') drive_id, IFNULL(s.link,'') link, IFNULL(s.keterangan,'') keterangan, IFNULL(s.urutan,0) urutan, \
                IFNULL(s.bab,'') bab, \
                IFNULL((SELECT GROUP_CONCAT(m.kd_ep) FROM simrscb_sidomu_ep m WHERE m.sop_id=s.id AND m.kd_ep=?),'') eps \
         FROM simrscb_sidomu_sop s \
         WHERE s.id IN (SELECT sop_id FROM simrscb_sidomu_ep WHERE kd_ep=?) \
            OR (s.bab <> '' AND s.bab = (SELECT bab FROM starkes_ep WHERE kd_ep=? LIMIT 1) COLLATE utf8mb4_general_ci) \
         ORDER BY s.kategori ASC, s.nama ASC LIMIT 800"
    ).bind(&kd_ep).bind(&kd_ep).bind(&kd_ep).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct LinkBody { pub sop_id: i64, pub kd_ep: String }
pub async fn link_ep(u: AuthUser, State(s): State<AppState>, Json(b): Json<LinkBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    sqlx::query("INSERT IGNORE INTO simrscb_sidomu_ep (sop_id,kd_ep,updated_by) VALUES (?,?,?)")
        .bind(b.sop_id).bind(&b.kd_ep).bind(&u.0.kode).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn unlink_ep(u: AuthUser, State(s): State<AppState>, Json(b): Json<LinkBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    sqlx::query("DELETE FROM simrscb_sidomu_ep WHERE sop_id=? AND kd_ep=?")
        .bind(b.sop_id).bind(&b.kd_ep).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Upload & sajikan file SOP (self-host di server RSCB) ─────────────────────
/// Direktori penyimpanan file (relatif ke cwd backend; override via env).
fn upload_dir() -> String {
    std::env::var("SIDOMU_UPLOAD_DIR").unwrap_or_else(|_| "uploads/sidomu".to_string())
}
fn sanitize_stem(s: &str) -> String {
    let stem = s.rsplit_once('.').map(|(a, _)| a).unwrap_or(s);
    let out: String = stem.chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let out = out.trim_matches('-').to_string();
    let out: String = out.chars().take(60).collect();
    if out.is_empty() { "dokumen".to_string() } else { out }
}
fn ext_of(name: &str) -> String {
    let e = name.rsplit_once('.').map(|(_, b)| b).unwrap_or("").to_lowercase();
    if !e.is_empty() && e.len() <= 5 && e.chars().all(|c| c.is_ascii_alphanumeric()) { e } else { "bin".to_string() }
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

pub async fn upload(u: AuthUser, State(_s): State<AppState>, mut mp: Multipart)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    let dir = upload_dir();
    tokio::fs::create_dir_all(&dir).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("mkdir: {}", e)}))))?;
    while let Some(field) = mp.next_field().await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": format!("multipart: {}", e)}))))? {
        if field.name() == Some("file") {
            let orig = field.file_name().unwrap_or("dokumen").to_string();
            let bytes = field.bytes().await
                .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": format!("baca file: {}", e)}))))?;
            if bytes.is_empty() {
                return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "file kosong"}))));
            }
            let ext = ext_of(&orig);
            let stem = sanitize_stem(&orig);
            let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis()).unwrap_or(0);
            let stored = format!("{}-{}.{}", stem, ts, ext);
            let path = format!("{}/{}", dir, stored);
            tokio::fs::write(&path, &bytes).await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("tulis: {}", e)}))))?;
            let nama = orig.rsplit_once('.').map(|(a, _)| a).unwrap_or(&orig).to_string();
            return Ok(Json(json!({
                "ok": true, "stored": stored, "jenis": ext,
                "nama": nama, "link": format!("/api/sidomu/file/{}", stored),
            })));
        }
    }
    Err((StatusCode::BAD_REQUEST, Json(json!({"error": "tidak ada field 'file'"}))))
}

pub async fn serve_file(Path(name): Path<String>) -> Result<Response, (StatusCode, Json<Value>)> {
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "nama tidak valid"}))));
    }
    let path = format!("{}/{}", upload_dir(), name);
    let bytes = tokio::fs::read(&path).await
        .map_err(|_| (StatusCode::NOT_FOUND, Json(json!({"error": "file tidak ditemukan"}))))?;
    let ext = ext_of(&name);
    let ct = content_type(&ext);
    // Hanya PDF/gambar yang boleh inline (preview). Tipe lain (html/svg/xml/office)
    // dipaksa attachment untuk mencegah stored-XSS bila ada file yang di-render browser.
    let disp = match ext.as_str() {
        "pdf" | "png" | "jpg" | "jpeg" | "gif" | "webp" => "inline",
        _ => "attachment",
    };
    Ok((
        [
            (header::CONTENT_TYPE, ct.to_string()),
            (header::CONTENT_DISPOSITION, format!("{}; filename=\"{}\"", disp, name)),
            (header::CACHE_CONTROL, "public, max-age=86400".to_string()),
        ],
        bytes,
    ).into_response())
}

fn extract_drive_id(link: &str) -> String {
    // .../file/d/<ID>/view  atau  ...?id=<ID>  atau  .../folders/<ID>
    for pat in ["/file/d/", "/folders/", "id="] {
        if let Some(i) = link.find(pat) {
            let rest = &link[i + pat.len()..];
            let id: String = rest.chars().take_while(|c| c.is_alphanumeric() || *c == '-' || *c == '_').collect();
            if !id.is_empty() { return id; }
        }
    }
    String::new()
}
