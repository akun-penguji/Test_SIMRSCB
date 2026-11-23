// MFK — Manajemen Fasilitas & Keselamatan. Register yang belum ada di Khanza:
// K3RS insiden, Code Blue, Inspeksi APAR, Monitoring Utilitas, HVA/Bencana.
use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB mfk: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if u.0.is_admin || has_perm(u, "mfk_edit") || has_perm(u, "mutu_edit") || has_perm(u, "akreditasi_edit") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Perlu izin mfk_edit / mutu_edit"})))) }
}
fn od(s: &Option<String>) -> Option<String> { s.as_deref().map(|x| x.trim()).filter(|x| x.len() >= 8).map(|x| x.to_string()) }

// ── K3RS Insiden ─────────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct K3Row {
    pub id: i32, pub tanggal: Option<String>, pub nip: Option<String>, pub nama_pegawai: Option<String>, pub unit: Option<String>,
    pub jenis_peristiwa: Option<String>, pub lokasi_kejadian: Option<String>, pub jenis_cidera: Option<String>, pub bagian_tubuh: Option<String>,
    pub penyebab: Option<String>, pub kronologi: Option<String>, pub tindakan: Option<String>, pub tindak_lanjut: Option<String>, pub status: String, pub created_at: Option<String>,
}
const K3_COLS: &str = "id, DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, nip, nama_pegawai, unit, jenis_peristiwa, lokasi_kejadian, jenis_cidera, bagian_tubuh, penyebab, kronologi, tindakan, tindak_lanjut, status, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') created_at";
#[derive(Deserialize)]
pub struct K3ListQ { pub tahun: Option<i32>, pub status: Option<String>, pub q: Option<String> }
pub async fn k3_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<K3ListQ>)
  -> Result<Json<Vec<K3Row>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!("SELECT {K3_COLS} FROM simrscb_k3rs_insiden WHERE (? IS NULL OR YEAR(tanggal)=?) AND (? IS NULL OR status=?) AND (? IS NULL OR nama_pegawai LIKE ? OR unit LIKE ?) ORDER BY tanggal DESC, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql).bind(q.tahun).bind(q.tahun).bind(&q.status).bind(&q.status).bind(&qs).bind(&qs).bind(&qs).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct K3Body {
    pub tanggal: String, #[serde(default)] pub nip: Option<String>, #[serde(default)] pub nama_pegawai: Option<String>, #[serde(default)] pub unit: Option<String>,
    #[serde(default)] pub jenis_peristiwa: Option<String>, #[serde(default)] pub lokasi_kejadian: Option<String>, #[serde(default)] pub jenis_cidera: Option<String>, #[serde(default)] pub bagian_tubuh: Option<String>,
    #[serde(default)] pub penyebab: Option<String>, #[serde(default)] pub kronologi: Option<String>, #[serde(default)] pub tindakan: Option<String>, #[serde(default)] pub tindak_lanjut: Option<String>, #[serde(default)] pub status: Option<String>,
}
pub async fn k3_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<K3Body>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let r = sqlx::query("INSERT INTO simrscb_k3rs_insiden (tanggal,nip,nama_pegawai,unit,jenis_peristiwa,lokasi_kejadian,jenis_cidera,bagian_tubuh,penyebab,kronologi,tindakan,tindak_lanjut,status,pelapor_nip) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.tanggal).bind(&b.nip).bind(&b.nama_pegawai).bind(&b.unit).bind(&b.jenis_peristiwa).bind(&b.lokasi_kejadian).bind(&b.jenis_cidera).bind(&b.bagian_tubuh)
        .bind(&b.penyebab).bind(&b.kronologi).bind(&b.tindakan).bind(&b.tindak_lanjut).bind(b.status.as_deref().unwrap_or("Lapor")).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn k3_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<K3Body>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("UPDATE simrscb_k3rs_insiden SET tanggal=?,nip=?,nama_pegawai=?,unit=?,jenis_peristiwa=?,lokasi_kejadian=?,jenis_cidera=?,bagian_tubuh=?,penyebab=?,kronologi=?,tindakan=?,tindak_lanjut=?,status=COALESCE(?,status),updated_at=NOW() WHERE id=?")
        .bind(&b.tanggal).bind(&b.nip).bind(&b.nama_pegawai).bind(&b.unit).bind(&b.jenis_peristiwa).bind(&b.lokasi_kejadian).bind(&b.jenis_cidera).bind(&b.bagian_tubuh)
        .bind(&b.penyebab).bind(&b.kronologi).bind(&b.tindakan).bind(&b.tindak_lanjut).bind(&b.status).bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn k3_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?; sqlx::query("DELETE FROM simrscb_k3rs_insiden WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?; Ok(Json(json!({"ok": true})))
}

// ── Code Blue ────────────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct CbRow {
    pub id: i32, pub tanggal: Option<String>, pub jam_aktivasi: Option<String>, pub lokasi: Option<String>, pub no_rawat: Option<String>,
    pub no_rkm_medis: Option<String>, pub nama_pasien: Option<String>, pub jam_tim_datang: Option<String>, pub response_menit: Option<i32>,
    pub kondisi_awal: Option<String>, pub tindakan: Option<String>, pub hasil: Option<String>, pub ketua_tim: Option<String>, pub catatan: Option<String>, pub created_at: Option<String>,
}
const CB_COLS: &str = "id, DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, jam_aktivasi, lokasi, no_rawat, no_rkm_medis, nama_pasien, jam_tim_datang, response_menit, kondisi_awal, tindakan, hasil, ketua_tim, catatan, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') created_at";
#[derive(Deserialize)]
pub struct CbListQ { pub tahun: Option<i32>, pub q: Option<String> }
pub async fn cb_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<CbListQ>) -> Result<Json<Vec<CbRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!("SELECT {CB_COLS} FROM simrscb_code_blue WHERE (? IS NULL OR YEAR(tanggal)=?) AND (? IS NULL OR lokasi LIKE ? OR nama_pasien LIKE ?) ORDER BY tanggal DESC, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql).bind(q.tahun).bind(q.tahun).bind(&qs).bind(&qs).bind(&qs).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct CbBody {
    pub tanggal: String, #[serde(default)] pub jam_aktivasi: Option<String>, #[serde(default)] pub lokasi: Option<String>, #[serde(default)] pub no_rawat: Option<String>,
    #[serde(default)] pub no_rkm_medis: Option<String>, #[serde(default)] pub nama_pasien: Option<String>, #[serde(default)] pub jam_tim_datang: Option<String>, #[serde(default)] pub response_menit: Option<i32>,
    #[serde(default)] pub kondisi_awal: Option<String>, #[serde(default)] pub tindakan: Option<String>, #[serde(default)] pub hasil: Option<String>, #[serde(default)] pub ketua_tim: Option<String>, #[serde(default)] pub catatan: Option<String>,
}
pub async fn cb_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<CbBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let r = sqlx::query("INSERT INTO simrscb_code_blue (tanggal,jam_aktivasi,lokasi,no_rawat,no_rkm_medis,nama_pasien,jam_tim_datang,response_menit,kondisi_awal,tindakan,hasil,ketua_tim,catatan,petugas_nip) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.tanggal).bind(&b.jam_aktivasi).bind(&b.lokasi).bind(&b.no_rawat).bind(&b.no_rkm_medis).bind(&b.nama_pasien).bind(&b.jam_tim_datang).bind(b.response_menit)
        .bind(&b.kondisi_awal).bind(&b.tindakan).bind(&b.hasil).bind(&b.ketua_tim).bind(&b.catatan).bind(&u.0.kode).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn cb_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<CbBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("UPDATE simrscb_code_blue SET tanggal=?,jam_aktivasi=?,lokasi=?,no_rawat=?,no_rkm_medis=?,nama_pasien=?,jam_tim_datang=?,response_menit=?,kondisi_awal=?,tindakan=?,hasil=?,ketua_tim=?,catatan=? WHERE id=?")
        .bind(&b.tanggal).bind(&b.jam_aktivasi).bind(&b.lokasi).bind(&b.no_rawat).bind(&b.no_rkm_medis).bind(&b.nama_pasien).bind(&b.jam_tim_datang).bind(b.response_menit)
        .bind(&b.kondisi_awal).bind(&b.tindakan).bind(&b.hasil).bind(&b.ketua_tim).bind(&b.catatan).bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn cb_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?; sqlx::query("DELETE FROM simrscb_code_blue WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?; Ok(Json(json!({"ok": true})))
}

// ── APAR / Hidran ────────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct AparRow {
    pub id: i32, pub tanggal_inspeksi: Option<String>, pub no_apar: Option<String>, pub lokasi: Option<String>, pub jenis: Option<String>,
    pub tekanan_ok: i8, pub segel_ok: i8, pub selang_ok: i8, pub tgl_kadaluarsa: Option<String>, pub kondisi: String, pub tindak_lanjut: Option<String>, pub created_at: Option<String>,
}
const APAR_COLS: &str = "id, DATE_FORMAT(tanggal_inspeksi,'%Y-%m-%d') tanggal_inspeksi, no_apar, lokasi, jenis, tekanan_ok, segel_ok, selang_ok, DATE_FORMAT(tgl_kadaluarsa,'%Y-%m-%d') tgl_kadaluarsa, kondisi, tindak_lanjut, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') created_at";
#[derive(Deserialize)]
pub struct AparListQ { pub tahun: Option<i32>, pub kondisi: Option<String>, pub q: Option<String> }
pub async fn apar_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<AparListQ>) -> Result<Json<Vec<AparRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!("SELECT {APAR_COLS} FROM simrscb_apar WHERE (? IS NULL OR YEAR(tanggal_inspeksi)=?) AND (? IS NULL OR kondisi=?) AND (? IS NULL OR no_apar LIKE ? OR lokasi LIKE ?) ORDER BY tanggal_inspeksi DESC, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql).bind(q.tahun).bind(q.tahun).bind(&q.kondisi).bind(&q.kondisi).bind(&qs).bind(&qs).bind(&qs).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct AparBody {
    pub tanggal_inspeksi: String, #[serde(default)] pub no_apar: Option<String>, #[serde(default)] pub lokasi: Option<String>, #[serde(default)] pub jenis: Option<String>,
    #[serde(default)] pub tekanan_ok: i8, #[serde(default)] pub segel_ok: i8, #[serde(default)] pub selang_ok: i8, #[serde(default)] pub tgl_kadaluarsa: Option<String>, #[serde(default)] pub kondisi: Option<String>, #[serde(default)] pub tindak_lanjut: Option<String>,
}
pub async fn apar_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<AparBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let r = sqlx::query("INSERT INTO simrscb_apar (tanggal_inspeksi,no_apar,lokasi,jenis,tekanan_ok,segel_ok,selang_ok,tgl_kadaluarsa,kondisi,tindak_lanjut,petugas_nip) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.tanggal_inspeksi).bind(&b.no_apar).bind(&b.lokasi).bind(&b.jenis).bind(b.tekanan_ok).bind(b.segel_ok).bind(b.selang_ok).bind(od(&b.tgl_kadaluarsa)).bind(b.kondisi.as_deref().unwrap_or("Baik")).bind(&b.tindak_lanjut).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn apar_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<AparBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("UPDATE simrscb_apar SET tanggal_inspeksi=?,no_apar=?,lokasi=?,jenis=?,tekanan_ok=?,segel_ok=?,selang_ok=?,tgl_kadaluarsa=?,kondisi=COALESCE(?,kondisi),tindak_lanjut=? WHERE id=?")
        .bind(&b.tanggal_inspeksi).bind(&b.no_apar).bind(&b.lokasi).bind(&b.jenis).bind(b.tekanan_ok).bind(b.segel_ok).bind(b.selang_ok).bind(od(&b.tgl_kadaluarsa)).bind(&b.kondisi).bind(&b.tindak_lanjut).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn apar_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?; sqlx::query("DELETE FROM simrscb_apar WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?; Ok(Json(json!({"ok": true})))
}

// ── Utilitas ─────────────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct UtilRow {
    pub id: i32, pub tanggal: Option<String>, pub jam: Option<String>, pub jenis_utilitas: String, pub parameter: Option<String>,
    pub nilai: Option<String>, pub satuan: Option<String>, pub status: String, pub keterangan: Option<String>, pub created_at: Option<String>,
}
const UTIL_COLS: &str = "id, DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, jam, jenis_utilitas, parameter, nilai, satuan, status, keterangan, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') created_at";
#[derive(Deserialize)]
pub struct UtilListQ { pub tahun: Option<i32>, pub bulan: Option<i32>, pub jenis: Option<String>, pub status: Option<String> }
pub async fn util_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<UtilListQ>) -> Result<Json<Vec<UtilRow>>, (StatusCode, Json<Value>)> {
    let sql = format!("SELECT {UTIL_COLS} FROM simrscb_utilitas WHERE (? IS NULL OR YEAR(tanggal)=?) AND (? IS NULL OR MONTH(tanggal)=?) AND (? IS NULL OR jenis_utilitas=?) AND (? IS NULL OR status=?) ORDER BY tanggal DESC, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql).bind(q.tahun).bind(q.tahun).bind(q.bulan).bind(q.bulan).bind(&q.jenis).bind(&q.jenis).bind(&q.status).bind(&q.status).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct UtilBody {
    pub tanggal: String, #[serde(default)] pub jam: Option<String>, #[serde(default)] pub jenis_utilitas: Option<String>, #[serde(default)] pub parameter: Option<String>,
    #[serde(default)] pub nilai: Option<String>, #[serde(default)] pub satuan: Option<String>, #[serde(default)] pub status: Option<String>, #[serde(default)] pub keterangan: Option<String>,
}
pub async fn util_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<UtilBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let r = sqlx::query("INSERT INTO simrscb_utilitas (tanggal,jam,jenis_utilitas,parameter,nilai,satuan,status,keterangan,petugas_nip) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(&b.tanggal).bind(&b.jam).bind(b.jenis_utilitas.as_deref().unwrap_or("Genset")).bind(&b.parameter).bind(&b.nilai).bind(&b.satuan).bind(b.status.as_deref().unwrap_or("Normal")).bind(&b.keterangan).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn util_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<UtilBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("UPDATE simrscb_utilitas SET tanggal=?,jam=?,jenis_utilitas=COALESCE(?,jenis_utilitas),parameter=?,nilai=?,satuan=?,status=COALESCE(?,status),keterangan=? WHERE id=?")
        .bind(&b.tanggal).bind(&b.jam).bind(&b.jenis_utilitas).bind(&b.parameter).bind(&b.nilai).bind(&b.satuan).bind(&b.status).bind(&b.keterangan).bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn util_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?; sqlx::query("DELETE FROM simrscb_utilitas WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?; Ok(Json(json!({"ok": true})))
}

// ── HVA ──────────────────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct HvaRow {
    pub id: i32, pub tahun: i32, pub jenis_bahaya: String, pub kategori: Option<String>, pub probabilitas: i32,
    pub dampak_manusia: i32, pub dampak_properti: i32, pub dampak_bisnis: i32, pub kesiapan: i32, pub skor: Option<f64>, pub mitigasi: Option<String>,
}
const HVA_COLS: &str = "id, tahun, jenis_bahaya, kategori, probabilitas, dampak_manusia, dampak_properti, dampak_bisnis, kesiapan, skor, mitigasi";
#[derive(Deserialize)]
pub struct HvaListQ { pub tahun: Option<i32> }
pub async fn hva_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<HvaListQ>) -> Result<Json<Vec<HvaRow>>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2026));
    let rows = sqlx::query_as(&format!("SELECT {HVA_COLS} FROM simrscb_hva WHERE tahun=? ORDER BY skor DESC, id")).bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct HvaBody {
    pub tahun: i32, pub jenis_bahaya: String, #[serde(default)] pub kategori: Option<String>,
    #[serde(default)] pub probabilitas: i32, #[serde(default)] pub dampak_manusia: i32, #[serde(default)] pub dampak_properti: i32, #[serde(default)] pub dampak_bisnis: i32, #[serde(default)] pub kesiapan: i32, #[serde(default)] pub mitigasi: Option<String>,
}
// Skor risiko relatif ala Kaiser HVA (disederhanakan): prob × (dampak - kesiapan) → %.
fn hva_skor(b: &HvaBody) -> f64 {
    let prob = (b.probabilitas.clamp(0, 3)) as f64 / 3.0;
    let dampak = (b.dampak_manusia.clamp(0, 3) + b.dampak_properti.clamp(0, 3) + b.dampak_bisnis.clamp(0, 3)) as f64 / 9.0;
    let siap = (b.kesiapan.clamp(0, 3)) as f64 / 3.0;
    // severity dipengaruhi kesiapan (makin siap makin rendah); bobot kesiapan 0.3
    let severity = (dampak * 0.7 + (1.0 - siap) * 0.3).clamp(0.0, 1.0);
    prob * severity * 100.0
}
pub async fn hva_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<HvaBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let skor = hva_skor(&b);
    let r = sqlx::query("INSERT INTO simrscb_hva (tahun,jenis_bahaya,kategori,probabilitas,dampak_manusia,dampak_properti,dampak_bisnis,kesiapan,skor,mitigasi,petugas_nip) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(b.tahun).bind(b.jenis_bahaya.trim()).bind(&b.kategori).bind(b.probabilitas).bind(b.dampak_manusia).bind(b.dampak_properti).bind(b.dampak_bisnis).bind(b.kesiapan).bind(skor).bind(&b.mitigasi).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id(), "skor": skor})))
}
pub async fn hva_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<HvaBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let skor = hva_skor(&b);
    sqlx::query("UPDATE simrscb_hva SET tahun=?,jenis_bahaya=?,kategori=?,probabilitas=?,dampak_manusia=?,dampak_properti=?,dampak_bisnis=?,kesiapan=?,skor=?,mitigasi=?,updated_at=NOW() WHERE id=?")
        .bind(b.tahun).bind(b.jenis_bahaya.trim()).bind(&b.kategori).bind(b.probabilitas).bind(b.dampak_manusia).bind(b.dampak_properti).bind(b.dampak_bisnis).bind(b.kesiapan).bind(skor).bind(&b.mitigasi).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "skor": skor})))
}
pub async fn hva_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?; sqlx::query("DELETE FROM simrscb_hva WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?; Ok(Json(json!({"ok": true})))
}

// ── Rekap MFK ────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct RekapQ { pub tahun: Option<i32> }
pub async fn rekap(_u: AuthUser, State(s): State<AppState>, Query(q): Query<RekapQ>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2026));
    let k3: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_k3rs_insiden WHERE YEAR(tanggal)=?").bind(tahun).fetch_one(&s.pool).await.unwrap_or(0);
    let cb: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_code_blue WHERE YEAR(tanggal)=?").bind(tahun).fetch_one(&s.pool).await.unwrap_or(0);
    let cb_resp: Option<f64> = sqlx::query_scalar("SELECT AVG(response_menit) FROM simrscb_code_blue WHERE YEAR(tanggal)=? AND response_menit IS NOT NULL").bind(tahun).fetch_one(&s.pool).await.unwrap_or(None);
    let apar_rusak: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_apar WHERE kondisi<>'Baik'").fetch_one(&s.pool).await.unwrap_or(0);
    let util_gangguan: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_utilitas WHERE YEAR(tanggal)=? AND status='Gangguan'").bind(tahun).fetch_one(&s.pool).await.unwrap_or(0);
    Ok(Json(json!({"tahun": tahun, "k3rs_insiden": k3, "code_blue": cb, "code_blue_avg_response": cb_resp, "apar_bermasalah": apar_rusak, "utilitas_gangguan": util_gangguan})))
}
