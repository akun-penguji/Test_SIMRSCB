// Modul Dokumentasi Rapat — bukti pertemuan lintas komite/unit (PMKP, PPI,
// K3RS, SKP, Komite Medik, dst). Satu rapat = judul/unit/tanggal + daftar
// hadir + tindak lanjut (action item) + lampiran (undangan/daftar hadir/
// notulen/dokumentasi foto). Dipakai lintas bab akreditasi, bukan milik satu
// komite — sama posisinya dengan "Audit Edukasi Terintegrasi".
//
// Beda dengan handlers::monev (simrscb_monev_rapat): itu sempit, cuma rapat
// evaluasi perbaikan SIMRS untuk WBK ZI. Modul ini untuk SEMUA rapat RS.
//
// Endpoints:
//   GET    /rapat                      list + filter (unit, status, q, dari/sampai)
//   POST   /rapat                      create
//   GET    /rapat/:id                  detail (rapat + peserta + tindak_lanjut + lampiran)
//   PUT    /rapat/:id                  update
//   DELETE /rapat/:id                  delete (cascade peserta/tindak_lanjut/lampiran)
//   POST   /rapat/:id/peserta          tambah peserta
//   DELETE /rapat/peserta/:id          hapus peserta
//   POST   /rapat/:id/tindak-lanjut    tambah tindak lanjut
//   PUT    /rapat/tindak-lanjut/:id    update (umumnya ganti status)
//   DELETE /rapat/tindak-lanjut/:id    hapus tindak lanjut
//   POST   /rapat/:id/lampiran         upload lampiran (multipart: jenis, keterangan, file)
//   DELETE /rapat/lampiran/:id         hapus lampiran (hapus baris + file disk)
//   GET    /rapat/lampiran/file/:name  serve file (publik, pola sama dgn akreditasi_dokumen)
//   GET    /rapat/stats                ringkasan ?dari=&sampai= (dashboard kecil)

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
    tracing::error!("DB rapat: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data rapat"})))
}
fn validation_err(msg: &str) -> (StatusCode, Json<Value>) {
    (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({"error": msg})))
}

const JENIS_VALID: &[&str] = &["Rutin", "Insidentil", "Rapat Tinjauan Manajemen", "Evaluasi", "Lainnya"];
const STATUS_VALID: &[&str] = &["Terjadwal", "Selesai", "Dibatalkan"];
const HADIR_VALID: &[&str] = &["Hadir", "Tidak Hadir", "Izin"];
const TL_STATUS_VALID: &[&str] = &["Belum", "Proses", "Selesai"];
const LAMPIRAN_JENIS_VALID: &[&str] = &["Undangan", "Daftar Hadir", "Notulen", "Dokumentasi Foto", "Lainnya"];

fn dok_dir() -> String {
    std::env::var("RAPAT_DOKUMEN_DIR")
        .unwrap_or_else(|_| "/var/www/html/webapps/simrscb/rapat".to_string())
}
fn ext_of(name: &str) -> String {
    let e = name.rsplit_once('.').map(|(_, b)| b).unwrap_or("").to_lowercase();
    if !e.is_empty() && e.len() <= 5 && e.chars().all(|c| c.is_ascii_alphanumeric()) { e } else { "bin".to_string() }
}
fn sanitize_stem(s: &str) -> String {
    let stem = s.rsplit_once('.').map(|(a, _)| a).unwrap_or(s);
    let out: String = stem.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect();
    let out: String = out.trim_matches('-').chars().take(60).collect();
    if out.is_empty() { "lampiran".to_string() } else { out }
}
fn content_type(ext: &str) -> &'static str {
    match ext {
        "pdf" => "application/pdf",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "png" => "image/png", "jpg" | "jpeg" => "image/jpeg", "webp" => "image/webp",
        _ => "application/octet-stream",
    }
}

// ── Rapat (induk) ────────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RapatRow {
    pub id: u32, pub judul: String, pub unit: String, pub jenis: String,
    pub tanggal: String,
    pub jam_mulai: Option<String>, pub jam_selesai: Option<String>,
    pub tempat: Option<String>, pub pemimpin_rapat: Option<String>, pub notulis: Option<String>,
    pub status: String, pub dibuat_oleh: Option<String>,
    pub jumlah_peserta: i64, pub jumlah_hadir: i64,
    pub jumlah_tindak_lanjut: i64, pub jumlah_tl_belum: i64,
    pub jumlah_lampiran: i64,
}
const RAPAT_LIST_SQL: &str = "
    SELECT r.id, r.judul, r.unit, r.jenis, CAST(r.tanggal AS CHAR) tanggal,
           CAST(r.jam_mulai AS CHAR) jam_mulai, CAST(r.jam_selesai AS CHAR) jam_selesai,
           r.tempat, r.pemimpin_rapat, r.notulis, r.status, r.dibuat_oleh,
           (SELECT COUNT(*) FROM simrscb_rapat_peserta p WHERE p.rapat_id=r.id) jumlah_peserta,
           (SELECT COUNT(*) FROM simrscb_rapat_peserta p WHERE p.rapat_id=r.id AND p.status_hadir='Hadir') jumlah_hadir,
           (SELECT COUNT(*) FROM simrscb_rapat_tindak_lanjut t WHERE t.rapat_id=r.id) jumlah_tindak_lanjut,
           (SELECT COUNT(*) FROM simrscb_rapat_tindak_lanjut t WHERE t.rapat_id=r.id AND t.status<>'Selesai') jumlah_tl_belum,
           (SELECT COUNT(*) FROM simrscb_rapat_lampiran l WHERE l.rapat_id=r.id) jumlah_lampiran
    FROM simrscb_rapat r";

#[derive(Deserialize)]
pub struct RapatListQ {
    #[serde(default)] pub unit: Option<String>,
    #[serde(default)] pub status: Option<String>,
    #[serde(default)] pub q: Option<String>,
    #[serde(default)] pub dari: Option<String>,
    #[serde(default)] pub sampai: Option<String>,
}
pub async fn list(u: AuthUser, State(s): State<AppState>, Query(q): Query<RapatListQ>)
  -> Result<Json<Vec<RapatRow>>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "rapat_view")?;
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!(
        "{} WHERE (? IS NULL OR r.unit=?) AND (? IS NULL OR r.status=?) \
           AND (? IS NULL OR r.judul LIKE ? OR r.unit LIKE ?) \
           AND (? IS NULL OR r.tanggal >= ?) AND (? IS NULL OR r.tanggal <= ?) \
         ORDER BY r.tanggal DESC, r.jam_mulai DESC, r.id DESC LIMIT 500", RAPAT_LIST_SQL);
    let rows: Vec<RapatRow> = sqlx::query_as(&sql)
        .bind(&q.unit).bind(&q.unit).bind(&q.status).bind(&q.status)
        .bind(&qs).bind(&qs).bind(&qs)
        .bind(&q.dari).bind(&q.dari).bind(&q.sampai).bind(&q.sampai)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Peserta {
    pub id: u32, pub rapat_id: u32, pub nama: String,
    pub jabatan_unit: Option<String>, pub status_hadir: String, pub keterangan: Option<String>,
}
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TindakLanjut {
    pub id: u32, pub rapat_id: u32, pub uraian: String,
    pub penanggung_jawab: Option<String>, pub target_selesai: Option<String>,
    pub status: String, pub keterangan: Option<String>,
}
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Lampiran {
    pub id: u32, pub rapat_id: u32, pub jenis: String,
    pub nama: Option<String>, pub stored_name: String, pub keterangan: Option<String>,
    pub uploaded_by: Option<String>, pub uploaded_at: Option<String>,
}
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RapatDetail {
    pub id: u32, pub judul: String, pub unit: String, pub jenis: String,
    pub tanggal: String, pub jam_mulai: Option<String>, pub jam_selesai: Option<String>,
    pub tempat: Option<String>, pub pemimpin_rapat: Option<String>, pub notulis: Option<String>,
    pub agenda: Option<String>, pub notulen: Option<String>, pub kesimpulan: Option<String>,
    pub status: String, pub dibuat_oleh: Option<String>,
}
#[derive(Serialize)]
pub struct RapatDetailFull {
    #[serde(flatten)] pub rapat: RapatDetail,
    pub peserta: Vec<Peserta>,
    pub tindak_lanjut: Vec<TindakLanjut>,
    pub lampiran: Vec<Lampiran>,
}
pub async fn detail(u: AuthUser, State(s): State<AppState>, Path(id): Path<u32>)
  -> Result<Json<RapatDetailFull>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "rapat_view")?;
    let rapat: RapatDetail = sqlx::query_as(
        "SELECT id, judul, unit, jenis, CAST(tanggal AS CHAR) tanggal, \
                CAST(jam_mulai AS CHAR) jam_mulai, CAST(jam_selesai AS CHAR) jam_selesai, \
                tempat, pemimpin_rapat, notulis, agenda, notulen, kesimpulan, status, dibuat_oleh \
         FROM simrscb_rapat WHERE id=?")
        .bind(id).fetch_optional(&s.pool).await.map_err(db_err)?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error": "Rapat tidak ditemukan"}))))?;
    let peserta: Vec<Peserta> = sqlx::query_as(
        "SELECT id, rapat_id, nama, jabatan_unit, status_hadir, keterangan \
         FROM simrscb_rapat_peserta WHERE rapat_id=? ORDER BY id")
        .bind(id).fetch_all(&s.pool).await.map_err(db_err)?;
    let tindak_lanjut: Vec<TindakLanjut> = sqlx::query_as(
        "SELECT id, rapat_id, uraian, penanggung_jawab, CAST(target_selesai AS CHAR) target_selesai, status, keterangan \
         FROM simrscb_rapat_tindak_lanjut WHERE rapat_id=? ORDER BY FIELD(status,'Belum','Proses','Selesai'), id")
        .bind(id).fetch_all(&s.pool).await.map_err(db_err)?;
    let lampiran: Vec<Lampiran> = sqlx::query_as(
        "SELECT id, rapat_id, jenis, nama, stored_name, keterangan, uploaded_by, CAST(uploaded_at AS CHAR) uploaded_at \
         FROM simrscb_rapat_lampiran WHERE rapat_id=? ORDER BY id")
        .bind(id).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(RapatDetailFull { rapat, peserta, tindak_lanjut, lampiran }))
}

#[derive(Deserialize)]
pub struct RapatBody {
    pub judul: String, pub unit: String,
    #[serde(default)] pub jenis: Option<String>,
    pub tanggal: String,
    #[serde(default)] pub jam_mulai: Option<String>,
    #[serde(default)] pub jam_selesai: Option<String>,
    #[serde(default)] pub tempat: Option<String>,
    #[serde(default)] pub pemimpin_rapat: Option<String>,
    #[serde(default)] pub notulis: Option<String>,
    #[serde(default)] pub agenda: Option<String>,
    #[serde(default)] pub notulen: Option<String>,
    #[serde(default)] pub kesimpulan: Option<String>,
    #[serde(default)] pub status: Option<String>,
}
fn empty_to_none(s: &Option<String>) -> Option<String> {
    s.as_ref().map(|x| x.trim()).filter(|x| !x.is_empty()).map(|x| x.to_string())
}
pub async fn create(u: AuthUser, State(s): State<AppState>, Json(b): Json<RapatBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "rapat_edit")?;
    if b.judul.trim().is_empty() { return Err(validation_err("Judul rapat wajib diisi")); }
    if b.unit.trim().is_empty() { return Err(validation_err("Unit/komite penyelenggara wajib diisi")); }
    if b.tanggal.trim().is_empty() { return Err(validation_err("Tanggal rapat wajib diisi")); }
    let jenis = b.jenis.as_deref().unwrap_or("Rutin");
    if !JENIS_VALID.contains(&jenis) { return Err(validation_err("Jenis rapat tidak dikenal")); }
    let status = b.status.as_deref().unwrap_or("Terjadwal");
    if !STATUS_VALID.contains(&status) { return Err(validation_err("Status rapat tidak dikenal")); }

    let r = sqlx::query(
        "INSERT INTO simrscb_rapat (judul, unit, jenis, tanggal, jam_mulai, jam_selesai, tempat, \
            pemimpin_rapat, notulis, agenda, notulen, kesimpulan, status, dibuat_oleh) \
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(b.judul.trim()).bind(b.unit.trim()).bind(jenis).bind(&b.tanggal)
        .bind(empty_to_none(&b.jam_mulai)).bind(empty_to_none(&b.jam_selesai))
        .bind(empty_to_none(&b.tempat)).bind(empty_to_none(&b.pemimpin_rapat)).bind(empty_to_none(&b.notulis))
        .bind(empty_to_none(&b.agenda)).bind(empty_to_none(&b.notulen)).bind(empty_to_none(&b.kesimpulan))
        .bind(status).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("rapat create judul={}", b.judul)).await;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}

pub async fn update(u: AuthUser, State(s): State<AppState>, Path(id): Path<u32>, Json(b): Json<RapatBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "rapat_edit")?;
    if b.judul.trim().is_empty() { return Err(validation_err("Judul rapat wajib diisi")); }
    if b.unit.trim().is_empty() { return Err(validation_err("Unit/komite penyelenggara wajib diisi")); }
    let jenis = b.jenis.as_deref().unwrap_or("Rutin");
    if !JENIS_VALID.contains(&jenis) { return Err(validation_err("Jenis rapat tidak dikenal")); }
    let status = b.status.as_deref().unwrap_or("Terjadwal");
    if !STATUS_VALID.contains(&status) { return Err(validation_err("Status rapat tidak dikenal")); }

    let r = sqlx::query(
        "UPDATE simrscb_rapat SET judul=?, unit=?, jenis=?, tanggal=?, jam_mulai=?, jam_selesai=?, \
            tempat=?, pemimpin_rapat=?, notulis=?, agenda=?, notulen=?, kesimpulan=?, status=? WHERE id=?")
        .bind(b.judul.trim()).bind(b.unit.trim()).bind(jenis).bind(&b.tanggal)
        .bind(empty_to_none(&b.jam_mulai)).bind(empty_to_none(&b.jam_selesai))
        .bind(empty_to_none(&b.tempat)).bind(empty_to_none(&b.pemimpin_rapat)).bind(empty_to_none(&b.notulis))
        .bind(empty_to_none(&b.agenda)).bind(empty_to_none(&b.notulen)).bind(empty_to_none(&b.kesimpulan))
        .bind(status).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    if r.rows_affected() == 0 { return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Rapat tidak ditemukan"})))); }
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("rapat update id={}", id)).await;
    Ok(Json(json!({"ok": true})))
}

pub async fn delete_rapat(u: AuthUser, State(s): State<AppState>, Path(id): Path<u32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "rapat_edit")?;
    // Hapus file lampiran di disk dulu sebelum baris DB-nya ikut lenyap lewat cascade.
    let files: Vec<(String,)> = sqlx::query_as("SELECT stored_name FROM simrscb_rapat_lampiran WHERE rapat_id=?")
        .bind(id).fetch_all(&s.pool).await.map_err(db_err)?;
    let dir = dok_dir();
    for (name,) in &files {
        let _ = tokio::fs::remove_file(format!("{}/{}", dir, name)).await;
    }
    let r = sqlx::query("DELETE FROM simrscb_rapat WHERE id=?").bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    if r.rows_affected() == 0 { return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Rapat tidak ditemukan"})))); }
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("rapat delete id={}", id)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Peserta (daftar hadir) ───────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct PesertaBody {
    pub nama: String,
    #[serde(default)] pub jabatan_unit: Option<String>,
    #[serde(default)] pub status_hadir: Option<String>,
    #[serde(default)] pub keterangan: Option<String>,
}
pub async fn add_peserta(u: AuthUser, State(s): State<AppState>, Path(rapat_id): Path<u32>, Json(b): Json<PesertaBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "rapat_edit")?;
    if b.nama.trim().is_empty() { return Err(validation_err("Nama peserta wajib diisi")); }
    let hadir = b.status_hadir.as_deref().unwrap_or("Hadir");
    if !HADIR_VALID.contains(&hadir) { return Err(validation_err("Status hadir tidak dikenal")); }
    ensure_rapat_exists(&s, rapat_id).await?;
    let r = sqlx::query(
        "INSERT INTO simrscb_rapat_peserta (rapat_id, nama, jabatan_unit, status_hadir, keterangan) VALUES (?,?,?,?,?)")
        .bind(rapat_id).bind(b.nama.trim()).bind(empty_to_none(&b.jabatan_unit)).bind(hadir).bind(empty_to_none(&b.keterangan))
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn delete_peserta(u: AuthUser, State(s): State<AppState>, Path(id): Path<u32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "rapat_edit")?;
    sqlx::query("DELETE FROM simrscb_rapat_peserta WHERE id=?").bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Tindak lanjut ────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct TindakLanjutBody {
    pub uraian: String,
    #[serde(default)] pub penanggung_jawab: Option<String>,
    #[serde(default)] pub target_selesai: Option<String>,
    #[serde(default)] pub status: Option<String>,
    #[serde(default)] pub keterangan: Option<String>,
}
pub async fn add_tindak_lanjut(u: AuthUser, State(s): State<AppState>, Path(rapat_id): Path<u32>, Json(b): Json<TindakLanjutBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "rapat_edit")?;
    if b.uraian.trim().is_empty() { return Err(validation_err("Uraian tindak lanjut wajib diisi")); }
    let status = b.status.as_deref().unwrap_or("Belum");
    if !TL_STATUS_VALID.contains(&status) { return Err(validation_err("Status tindak lanjut tidak dikenal")); }
    ensure_rapat_exists(&s, rapat_id).await?;
    let r = sqlx::query(
        "INSERT INTO simrscb_rapat_tindak_lanjut (rapat_id, uraian, penanggung_jawab, target_selesai, status, keterangan) \
         VALUES (?,?,?,?,?,?)")
        .bind(rapat_id).bind(b.uraian.trim()).bind(empty_to_none(&b.penanggung_jawab))
        .bind(empty_to_none(&b.target_selesai)).bind(status).bind(empty_to_none(&b.keterangan))
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn update_tindak_lanjut(u: AuthUser, State(s): State<AppState>, Path(id): Path<u32>, Json(b): Json<TindakLanjutBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "rapat_edit")?;
    if b.uraian.trim().is_empty() { return Err(validation_err("Uraian tindak lanjut wajib diisi")); }
    let status = b.status.as_deref().unwrap_or("Belum");
    if !TL_STATUS_VALID.contains(&status) { return Err(validation_err("Status tindak lanjut tidak dikenal")); }
    let r = sqlx::query(
        "UPDATE simrscb_rapat_tindak_lanjut SET uraian=?, penanggung_jawab=?, target_selesai=?, status=?, keterangan=? WHERE id=?")
        .bind(b.uraian.trim()).bind(empty_to_none(&b.penanggung_jawab))
        .bind(empty_to_none(&b.target_selesai)).bind(status).bind(empty_to_none(&b.keterangan)).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    if r.rows_affected() == 0 { return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Tindak lanjut tidak ditemukan"})))); }
    Ok(Json(json!({"ok": true})))
}
pub async fn delete_tindak_lanjut(u: AuthUser, State(s): State<AppState>, Path(id): Path<u32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "rapat_edit")?;
    sqlx::query("DELETE FROM simrscb_rapat_tindak_lanjut WHERE id=?").bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

async fn ensure_rapat_exists(s: &AppState, rapat_id: u32) -> Result<(), (StatusCode, Json<Value>)> {
    let ada: Option<(u32,)> = sqlx::query_as("SELECT id FROM simrscb_rapat WHERE id=?")
        .bind(rapat_id).fetch_optional(&s.pool).await.map_err(db_err)?;
    if ada.is_none() { return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Rapat tidak ditemukan"})))); }
    Ok(())
}

// ── Lampiran ──────────────────────────────────────────────────────────────────
/// POST multipart: field `jenis`, `keterangan` (opsional), `file`.
pub async fn upload_lampiran(u: AuthUser, State(s): State<AppState>, Path(rapat_id): Path<u32>, mut mp: Multipart)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "rapat_edit")?;
    ensure_rapat_exists(&s, rapat_id).await?;
    let dir = dok_dir();
    tokio::fs::create_dir_all(&dir).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("mkdir: {}", e)}))))?;

    let mut jenis = String::from("Lainnya");
    let mut keterangan = String::new();
    let mut nama = String::new();
    let mut stored = String::new();
    while let Some(field) = mp.next_field().await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": format!("multipart: {}", e)}))))? {
        match field.name() {
            Some("jenis") => { jenis = field.text().await.unwrap_or_default(); }
            Some("keterangan") => { keterangan = field.text().await.unwrap_or_default(); }
            Some("file") => {
                let orig = field.file_name().unwrap_or("lampiran").to_string();
                let bytes = field.bytes().await
                    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": format!("baca file: {}", e)}))))?;
                if bytes.is_empty() { return Err(validation_err("File kosong")); }
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
    if !LAMPIRAN_JENIS_VALID.contains(&jenis.as_str()) { jenis = "Lainnya".to_string(); }
    if stored.is_empty() { return Err(validation_err("File wajib diunggah")); }

    let r = sqlx::query(
        "INSERT INTO simrscb_rapat_lampiran (rapat_id, jenis, nama, stored_name, keterangan, uploaded_by) \
         VALUES (?,?,?,?,?,?)")
        .bind(rapat_id).bind(&jenis).bind(&nama).bind(&stored)
        .bind(if keterangan.trim().is_empty() { None } else { Some(keterangan.trim()) })
        .bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("rapat lampiran upload rapat_id={} file={}", rapat_id, stored)).await;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id(), "link": format!("/api/rapat/lampiran/file/{}", stored)})))
}

pub async fn delete_lampiran(u: AuthUser, State(s): State<AppState>, Path(id): Path<u32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "rapat_edit")?;
    let row: Option<(String,)> = sqlx::query_as("SELECT stored_name FROM simrscb_rapat_lampiran WHERE id=?")
        .bind(id).fetch_optional(&s.pool).await.map_err(db_err)?;
    let Some((stored,)) = row else {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Lampiran tidak ditemukan"}))));
    };
    sqlx::query("DELETE FROM simrscb_rapat_lampiran WHERE id=?").bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    let _ = tokio::fs::remove_file(format!("{}/{}", dok_dir(), stored)).await;
    Ok(Json(json!({"ok": true})))
}

/// GET file — publik (tanpa auth), pola sama dengan akreditasi_dokumen & SIDOMU.
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

// ── Ringkasan ────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct StatsQ { #[serde(default)] pub dari: Option<String>, #[serde(default)] pub sampai: Option<String> }
pub async fn stats(u: AuthUser, State(s): State<AppState>, Query(q): Query<StatsQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "rapat_view")?;
    let dari = q.dari.unwrap_or_else(|| "1970-01-01".to_string());
    let sampai = q.sampai.unwrap_or_else(|| "2999-12-31".to_string());
    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM simrscb_rapat WHERE tanggal BETWEEN ? AND ?")
        .bind(&dari).bind(&sampai).fetch_one(&s.pool).await.map_err(db_err)?;
    let per_unit: Vec<(String, i64)> = sqlx::query_as(
        "SELECT unit, COUNT(*) n FROM simrscb_rapat WHERE tanggal BETWEEN ? AND ? GROUP BY unit ORDER BY n DESC")
        .bind(&dari).bind(&sampai).fetch_all(&s.pool).await.map_err(db_err)?;
    let tl_belum: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM simrscb_rapat_tindak_lanjut t JOIN simrscb_rapat r ON r.id=t.rapat_id \
         WHERE t.status<>'Selesai' AND r.tanggal BETWEEN ? AND ?")
        .bind(&dari).bind(&sampai).fetch_one(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({
        "total_rapat": total.0,
        "tindak_lanjut_belum_selesai": tl_belum.0,
        "per_unit": per_unit.into_iter().map(|(unit, n)| json!({"unit": unit, "jumlah": n})).collect::<Vec<_>>(),
    })))
}
