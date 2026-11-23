// MRMIK 2.2 EP 1 — keamanan fisik ruang penyimpanan RM: monitoring suhu &
// kelembaban, pemeriksaan APAR, dan pemeriksaan CCTV.
use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB mrmik_keamanan: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))
}
fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if u.0.is_admin || has_perm(u, "mrmik_edit") || has_perm(u, "rekam_medis") || has_perm(u, "akreditasi_edit") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Perlu izin mrmik_edit / rekam_medis"})))) }
}

#[derive(Deserialize)]
pub struct BulanQ { pub bulan: Option<String> } // 'YYYY-MM'
fn bulan_or_now(b: &Option<String>) -> String {
    b.clone().filter(|s| s.len() == 7).unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string())
}

// ── Suhu & Kelembaban ────────────────────────────────────────────────────────
#[derive(sqlx::FromRow, Serialize)]
pub struct SuhuRow {
    pub id: i64, pub tanggal: String, pub jam: Option<String>,
    pub suhu: Option<f64>, pub kelembaban: Option<f64>,
    pub status: String, pub keterangan: Option<String>, pub nama_petugas: Option<String>,
}
pub async fn suhu_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<BulanQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let bln = bulan_or_now(&q.bulan);
    let rows: Vec<SuhuRow> = sqlx::query_as(
        "SELECT k.id AS id, DATE_FORMAT(k.tanggal,'%Y-%m-%d') AS tanggal, TIME_FORMAT(k.jam,'%H:%i') AS jam, \
                CAST(k.suhu AS DOUBLE) AS suhu, CAST(k.kelembaban AS DOUBLE) AS kelembaban, \
                k.status AS status, k.keterangan AS keterangan, IFNULL(pg.nama,'') AS nama_petugas \
         FROM mrmik_suhu_kelembaban k LEFT JOIN pegawai pg ON pg.nik=k.nip \
         WHERE DATE_FORMAT(k.tanggal,'%Y-%m')=? ORDER BY k.tanggal DESC, k.jam DESC",
    ).bind(&bln).fetch_all(&s.pool).await.map_err(db_err)?;
    // Rekap kepatuhan standar (18-28 C / 40-60 %RH).
    let total = rows.len() as i64;
    let baik = rows.iter().filter(|r| r.status == "Baik").count() as i64;
    Ok(Json(json!({ "bulan": bln, "ringkasan": {"total": total, "baik": baik, "perlu_tindakan": total - baik}, "data": rows })))
}
#[derive(Deserialize)]
pub struct SuhuBody {
    pub tanggal: String, #[serde(default)] pub jam: String,
    pub suhu: Option<f64>, pub kelembaban: Option<f64>,
    #[serde(default)] pub status: String, #[serde(default)] pub keterangan: String,
}
pub async fn suhu_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<SuhuBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.tanggal.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"tanggal wajib"})))); }
    let jam = if b.jam.trim().is_empty() { "08:00:00".to_string() } else { b.jam.clone() };
    let status = if b.status == "Perlu Tindakan" { "Perlu Tindakan" } else { "Baik" };
    sqlx::query("INSERT INTO mrmik_suhu_kelembaban (tanggal, jam, suhu, kelembaban, status, keterangan, nip) VALUES (?,?,?,?,?,?,?)")
        .bind(&b.tanggal).bind(&jam).bind(b.suhu).bind(b.kelembaban).bind(status).bind(b.keterangan.trim()).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn suhu_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM mrmik_suhu_kelembaban WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── APAR ─────────────────────────────────────────────────────────────────────
#[derive(sqlx::FromRow, Serialize)]
pub struct AparRow {
    pub id: i64, pub tanggal: String, pub jam: Option<String>, pub lokasi: String, pub jenis: String,
    pub tekanan: String, pub segel: String, pub selang: String, pub kondisi_isi: String,
    pub tgl_kadaluarsa: Option<String>, pub keterangan: Option<String>, pub nama_petugas: Option<String>,
}
pub async fn apar_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<BulanQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let bln = bulan_or_now(&q.bulan);
    let rows: Vec<AparRow> = sqlx::query_as(
        "SELECT a.id AS id, DATE_FORMAT(a.tanggal,'%Y-%m-%d') AS tanggal, TIME_FORMAT(a.jam,'%H:%i') AS jam, a.lokasi AS lokasi, a.jenis AS jenis, \
                a.tekanan AS tekanan, a.segel AS segel, a.selang AS selang, a.kondisi_isi AS kondisi_isi, \
                DATE_FORMAT(a.tgl_kadaluarsa,'%Y-%m-%d') AS tgl_kadaluarsa, a.keterangan AS keterangan, IFNULL(pg.nama,'') AS nama_petugas \
         FROM mrmik_apar a LEFT JOIN pegawai pg ON pg.nik=a.nip \
         WHERE DATE_FORMAT(a.tanggal,'%Y-%m')=? ORDER BY a.tanggal DESC, a.lokasi",
    ).bind(&bln).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({ "bulan": bln, "data": rows })))
}
#[derive(Deserialize)]
pub struct AparBody {
    pub tanggal: String, #[serde(default)] pub jam: Option<String>, pub lokasi: String, #[serde(default)] pub jenis: String,
    #[serde(default)] pub tekanan: String, #[serde(default)] pub segel: String,
    #[serde(default)] pub selang: String, #[serde(default)] pub kondisi_isi: String,
    #[serde(default)] pub tgl_kadaluarsa: String, #[serde(default)] pub keterangan: String,
}
fn one_of<'a>(v: &'a str, allowed: &[&'a str], default: &'a str) -> &'a str {
    if allowed.contains(&v) { v } else { default }
}
pub async fn apar_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<AparBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.tanggal.trim().is_empty() || b.lokasi.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"tanggal & lokasi wajib"}))));
    }
    let jenis = one_of(&b.jenis, &["Powder ABC","CO2","Foam","Air"], "Powder ABC");
    let tekanan = one_of(&b.tekanan, &["Hijau","Kuning","Merah"], "Hijau");
    let segel = one_of(&b.segel, &["Baik","Rusak"], "Baik");
    let selang = one_of(&b.selang, &["Baik","Rusak"], "Baik");
    let isi = one_of(&b.kondisi_isi, &["Terisi","Kosong"], "Terisi");
    let kad = if b.tgl_kadaluarsa.trim().is_empty() { None } else { Some(b.tgl_kadaluarsa.clone()) };
    let jam = b.jam.as_deref().map(|j| j.trim()).filter(|j| !j.is_empty()).unwrap_or("08:00");
    sqlx::query("INSERT INTO mrmik_apar (tanggal, jam, lokasi, jenis, tekanan, segel, selang, kondisi_isi, tgl_kadaluarsa, keterangan, nip) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.tanggal).bind(jam).bind(b.lokasi.trim()).bind(jenis).bind(tekanan).bind(segel).bind(selang).bind(isi).bind(kad).bind(b.keterangan.trim()).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn apar_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM mrmik_apar WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── CCTV ─────────────────────────────────────────────────────────────────────
#[derive(sqlx::FromRow, Serialize)]
pub struct CctvRow {
    pub id: i64, pub tanggal: String, pub jam: Option<String>, pub lokasi: String, pub berfungsi: String,
    pub kualitas: String, pub durasi_rekaman_hari: Option<i64>,
    pub keterangan: Option<String>, pub nama_petugas: Option<String>,
}
pub async fn cctv_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<BulanQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let bln = bulan_or_now(&q.bulan);
    let rows: Vec<CctvRow> = sqlx::query_as(
        "SELECT c.id AS id, DATE_FORMAT(c.tanggal,'%Y-%m-%d') AS tanggal, TIME_FORMAT(c.jam,'%H:%i') AS jam, c.lokasi AS lokasi, c.berfungsi AS berfungsi, \
                c.kualitas AS kualitas, CAST(c.durasi_rekaman_hari AS SIGNED) AS durasi_rekaman_hari, \
                c.keterangan AS keterangan, IFNULL(pg.nama,'') AS nama_petugas \
         FROM mrmik_cctv c LEFT JOIN pegawai pg ON pg.nik=c.nip \
         WHERE DATE_FORMAT(c.tanggal,'%Y-%m')=? ORDER BY c.tanggal DESC, c.lokasi",
    ).bind(&bln).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({ "bulan": bln, "data": rows })))
}
#[derive(Deserialize)]
pub struct CctvBody {
    pub tanggal: String, #[serde(default)] pub jam: Option<String>, pub lokasi: String, #[serde(default)] pub berfungsi: String,
    #[serde(default)] pub kualitas: String, pub durasi_rekaman_hari: Option<i64>,
    #[serde(default)] pub keterangan: String,
}
pub async fn cctv_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<CctvBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.tanggal.trim().is_empty() || b.lokasi.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"tanggal & lokasi wajib"}))));
    }
    let berfungsi = one_of(&b.berfungsi, &["Ya","Tidak"], "Ya");
    let kualitas = one_of(&b.kualitas, &["Baik","Cukup","Buruk"], "Baik");
    let jam = b.jam.as_deref().map(|j| j.trim()).filter(|j| !j.is_empty()).unwrap_or("08:00");
    sqlx::query("INSERT INTO mrmik_cctv (tanggal, jam, lokasi, berfungsi, kualitas, durasi_rekaman_hari, keterangan, nip) VALUES (?,?,?,?,?,?,?,?)")
        .bind(&b.tanggal).bind(jam).bind(b.lokasi.trim()).bind(berfungsi).bind(kualitas).bind(b.durasi_rekaman_hari).bind(b.keterangan.trim()).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn cctv_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM mrmik_cctv WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
