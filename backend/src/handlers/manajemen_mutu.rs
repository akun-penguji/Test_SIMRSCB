// Manajemen & Mutu — Kepuasan Pasien, Orientasi Pegawai, Kontrak & Evaluasi Vendor.
use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB manajemen_mutu: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if u.0.is_admin || has_perm(u, "manajemen_edit") || has_perm(u, "mutu_edit") || has_perm(u, "akreditasi_edit") || has_perm(u, "kepegawaian_edit") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Perlu izin manajemen_edit / mutu_edit"})))) }
}
fn od(s: &Option<String>) -> Option<String> { s.as_deref().map(|x| x.trim()).filter(|x| x.len() >= 8).map(|x| x.to_string()) }

// ── Kepuasan Pasien ──────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct KepRow {
    pub id: i32, pub tanggal: Option<String>, pub unit: Option<String>, pub periode: Option<String>, pub metode: Option<String>,
    pub jml_responden: i32, pub nilai_ikm: Option<f64>, pub mutu: Option<String>, pub keluhan_utama: Option<String>, pub tindak_lanjut: Option<String>, pub created_at: Option<String>,
}
const KEP_COLS: &str = "id, DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, unit, periode, metode, jml_responden, nilai_ikm, mutu, keluhan_utama, tindak_lanjut, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') created_at";
#[derive(Deserialize)]
pub struct KepListQ { pub tahun: Option<i32>, pub unit: Option<String>, pub q: Option<String> }
pub async fn kep_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<KepListQ>) -> Result<Json<Vec<KepRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!("SELECT {KEP_COLS} FROM simrscb_kepuasan WHERE (? IS NULL OR YEAR(tanggal)=?) AND (? IS NULL OR unit=?) AND (? IS NULL OR unit LIKE ? OR periode LIKE ?) ORDER BY tanggal DESC, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql).bind(q.tahun).bind(q.tahun).bind(&q.unit).bind(&q.unit).bind(&qs).bind(&qs).bind(&qs).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
fn mutu_of(ikm: Option<f64>) -> Option<String> {
    ikm.map(|v| if v >= 88.31 { "A" } else if v >= 76.61 { "B" } else if v >= 65.0 { "C" } else { "D" }.to_string())
}
#[derive(Deserialize)]
pub struct KepBody {
    pub tanggal: String, #[serde(default)] pub unit: Option<String>, #[serde(default)] pub periode: Option<String>, #[serde(default)] pub metode: Option<String>,
    #[serde(default)] pub jml_responden: i32, #[serde(default)] pub nilai_ikm: Option<f64>, #[serde(default)] pub keluhan_utama: Option<String>, #[serde(default)] pub tindak_lanjut: Option<String>,
}
pub async fn kep_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<KepBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let mutu = mutu_of(b.nilai_ikm);
    let r = sqlx::query("INSERT INTO simrscb_kepuasan (tanggal,unit,periode,metode,jml_responden,nilai_ikm,mutu,keluhan_utama,tindak_lanjut,petugas_nip) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.tanggal).bind(&b.unit).bind(&b.periode).bind(&b.metode).bind(b.jml_responden).bind(b.nilai_ikm).bind(&mutu).bind(&b.keluhan_utama).bind(&b.tindak_lanjut).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id(), "mutu": mutu})))
}
pub async fn kep_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<KepBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let mutu = mutu_of(b.nilai_ikm);
    sqlx::query("UPDATE simrscb_kepuasan SET tanggal=?,unit=?,periode=?,metode=?,jml_responden=?,nilai_ikm=?,mutu=?,keluhan_utama=?,tindak_lanjut=?,updated_at=NOW() WHERE id=?")
        .bind(&b.tanggal).bind(&b.unit).bind(&b.periode).bind(&b.metode).bind(b.jml_responden).bind(b.nilai_ikm).bind(&mutu).bind(&b.keluhan_utama).bind(&b.tindak_lanjut).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "mutu": mutu})))
}
pub async fn kep_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?; sqlx::query("DELETE FROM simrscb_kepuasan WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?; Ok(Json(json!({"ok": true})))
}

// ── Orientasi Pegawai ────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct OriRow {
    pub id: i32, pub nip: Option<String>, pub nama: String, pub jenis: String, pub unit: Option<String>,
    pub tanggal_mulai: Option<String>, pub tanggal_selesai: Option<String>, pub materi: Option<String>, pub hasil: Option<String>, pub nilai: Option<String>, pub pembimbing: Option<String>, pub catatan: Option<String>,
}
const ORI_COLS: &str = "id, nip, nama, jenis, unit, DATE_FORMAT(tanggal_mulai,'%Y-%m-%d') tanggal_mulai, DATE_FORMAT(tanggal_selesai,'%Y-%m-%d') tanggal_selesai, materi, hasil, nilai, pembimbing, catatan";
#[derive(Deserialize)]
pub struct OriListQ { pub tahun: Option<i32>, pub jenis: Option<String>, pub q: Option<String> }
pub async fn ori_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<OriListQ>) -> Result<Json<Vec<OriRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!("SELECT {ORI_COLS} FROM simrscb_orientasi WHERE (? IS NULL OR YEAR(tanggal_mulai)=?) AND (? IS NULL OR jenis=?) AND (? IS NULL OR nama LIKE ? OR nip LIKE ?) ORDER BY tanggal_mulai DESC, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql).bind(q.tahun).bind(q.tahun).bind(&q.jenis).bind(&q.jenis).bind(&qs).bind(&qs).bind(&qs).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct OriBody {
    pub nama: String, #[serde(default)] pub nip: Option<String>, #[serde(default)] pub jenis: Option<String>, #[serde(default)] pub unit: Option<String>,
    #[serde(default)] pub tanggal_mulai: Option<String>, #[serde(default)] pub tanggal_selesai: Option<String>, #[serde(default)] pub materi: Option<String>, #[serde(default)] pub hasil: Option<String>, #[serde(default)] pub nilai: Option<String>, #[serde(default)] pub pembimbing: Option<String>, #[serde(default)] pub catatan: Option<String>,
}
pub async fn ori_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<OriBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.nama.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Nama wajib"})))); }
    let r = sqlx::query("INSERT INTO simrscb_orientasi (nip,nama,jenis,unit,tanggal_mulai,tanggal_selesai,materi,hasil,nilai,pembimbing,catatan,petugas_nip) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.nip).bind(b.nama.trim()).bind(b.jenis.as_deref().unwrap_or("Umum")).bind(&b.unit).bind(od(&b.tanggal_mulai)).bind(od(&b.tanggal_selesai)).bind(&b.materi).bind(&b.hasil).bind(&b.nilai).bind(&b.pembimbing).bind(&b.catatan).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn ori_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<OriBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("UPDATE simrscb_orientasi SET nip=?,nama=?,jenis=COALESCE(?,jenis),unit=?,tanggal_mulai=?,tanggal_selesai=?,materi=?,hasil=?,nilai=?,pembimbing=?,catatan=? WHERE id=?")
        .bind(&b.nip).bind(b.nama.trim()).bind(&b.jenis).bind(&b.unit).bind(od(&b.tanggal_mulai)).bind(od(&b.tanggal_selesai)).bind(&b.materi).bind(&b.hasil).bind(&b.nilai).bind(&b.pembimbing).bind(&b.catatan).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn ori_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?; sqlx::query("DELETE FROM simrscb_orientasi WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?; Ok(Json(json!({"ok": true})))
}

// ── Kontrak & Evaluasi Vendor ────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct KontrakRow {
    pub id: i32, pub no_kontrak: Option<String>, pub nama_vendor: String, pub jenis_layanan: Option<String>, pub jenis_kontrak: Option<String>,
    pub tanggal_mulai: Option<String>, pub tanggal_berakhir: Option<String>, pub nilai_kontrak: Option<f64>, pub status: String,
    pub evaluasi: Option<String>, pub skor_evaluasi: Option<f64>, pub rekomendasi: Option<String>, pub pic: Option<String>, pub catatan: Option<String>,
}
const KON_COLS: &str = "id, no_kontrak, nama_vendor, jenis_layanan, jenis_kontrak, DATE_FORMAT(tanggal_mulai,'%Y-%m-%d') tanggal_mulai, DATE_FORMAT(tanggal_berakhir,'%Y-%m-%d') tanggal_berakhir, nilai_kontrak, status, evaluasi, skor_evaluasi, rekomendasi, pic, catatan";
#[derive(Deserialize)]
pub struct KonListQ { pub status: Option<String>, pub q: Option<String>, pub segera_habis: Option<i32> }
pub async fn kon_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<KonListQ>) -> Result<Json<Vec<KontrakRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let segera = q.segera_habis.unwrap_or(0);
    let sql = format!("SELECT {KON_COLS} FROM simrscb_kontrak WHERE (? IS NULL OR status=?) AND (? IS NULL OR nama_vendor LIKE ? OR jenis_layanan LIKE ?) AND (?=0 OR (tanggal_berakhir IS NOT NULL AND tanggal_berakhir <= DATE_ADD(CURDATE(), INTERVAL 90 DAY))) ORDER BY tanggal_berakhir, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql).bind(&q.status).bind(&q.status).bind(&qs).bind(&qs).bind(&qs).bind(segera).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct KonBody {
    pub nama_vendor: String, #[serde(default)] pub no_kontrak: Option<String>, #[serde(default)] pub jenis_layanan: Option<String>, #[serde(default)] pub jenis_kontrak: Option<String>,
    #[serde(default)] pub tanggal_mulai: Option<String>, #[serde(default)] pub tanggal_berakhir: Option<String>, #[serde(default)] pub nilai_kontrak: Option<f64>, #[serde(default)] pub status: Option<String>,
    #[serde(default)] pub evaluasi: Option<String>, #[serde(default)] pub skor_evaluasi: Option<f64>, #[serde(default)] pub rekomendasi: Option<String>, #[serde(default)] pub pic: Option<String>, #[serde(default)] pub catatan: Option<String>,
}
pub async fn kon_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<KonBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.nama_vendor.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Nama vendor wajib"})))); }
    let r = sqlx::query("INSERT INTO simrscb_kontrak (no_kontrak,nama_vendor,jenis_layanan,jenis_kontrak,tanggal_mulai,tanggal_berakhir,nilai_kontrak,status,evaluasi,skor_evaluasi,rekomendasi,pic,catatan,petugas_nip) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.no_kontrak).bind(b.nama_vendor.trim()).bind(&b.jenis_layanan).bind(&b.jenis_kontrak).bind(od(&b.tanggal_mulai)).bind(od(&b.tanggal_berakhir)).bind(b.nilai_kontrak).bind(b.status.as_deref().unwrap_or("Aktif")).bind(&b.evaluasi).bind(b.skor_evaluasi).bind(&b.rekomendasi).bind(&b.pic).bind(&b.catatan).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn kon_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<KonBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("UPDATE simrscb_kontrak SET no_kontrak=?,nama_vendor=?,jenis_layanan=?,jenis_kontrak=?,tanggal_mulai=?,tanggal_berakhir=?,nilai_kontrak=?,status=COALESCE(?,status),evaluasi=?,skor_evaluasi=?,rekomendasi=?,pic=?,catatan=?,updated_at=NOW() WHERE id=?")
        .bind(&b.no_kontrak).bind(b.nama_vendor.trim()).bind(&b.jenis_layanan).bind(&b.jenis_kontrak).bind(od(&b.tanggal_mulai)).bind(od(&b.tanggal_berakhir)).bind(b.nilai_kontrak).bind(&b.status).bind(&b.evaluasi).bind(b.skor_evaluasi).bind(&b.rekomendasi).bind(&b.pic).bind(&b.catatan).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn kon_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?; sqlx::query("DELETE FROM simrscb_kontrak WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?; Ok(Json(json!({"ok": true})))
}
