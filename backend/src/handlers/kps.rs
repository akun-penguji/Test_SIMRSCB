// KPS — Kredensial & Kewenangan Klinis (RKK/SPK) + Diklat Staf. CRUD + rekap + alert kedaluwarsa.
use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB kps: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if u.0.is_admin || has_perm(u, "kps_edit") || has_perm(u, "kepegawaian_edit") || has_perm(u, "akreditasi_edit") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Perlu izin kps_edit / kepegawaian_edit"})))) }
}
fn od(s: &Option<String>) -> Option<String> { s.as_deref().map(|x| x.trim()).filter(|x| x.len() >= 8).map(|x| x.to_string()) }

// ── Kredensial ───────────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct KredRow {
    pub id: i32, pub nip: Option<String>, pub nama: String, pub profesi: Option<String>, pub jenis: String,
    pub tanggal_kredensial: Option<String>, pub str_nomor: Option<String>, pub str_berlaku: Option<String>,
    pub sip_nomor: Option<String>, pub sip_berlaku: Option<String>, pub rekomendasi: Option<String>,
    pub rkk: Option<String>, pub spk_berlaku: Option<String>, pub status: String, pub catatan: Option<String>,
}
const KRED_COLS: &str = "id, nip, nama, profesi, jenis, DATE_FORMAT(tanggal_kredensial,'%Y-%m-%d') tanggal_kredensial, str_nomor, DATE_FORMAT(str_berlaku,'%Y-%m-%d') str_berlaku, sip_nomor, DATE_FORMAT(sip_berlaku,'%Y-%m-%d') sip_berlaku, rekomendasi, rkk, DATE_FORMAT(spk_berlaku,'%Y-%m-%d') spk_berlaku, status, catatan";
#[derive(Deserialize)]
pub struct KredListQ { pub profesi: Option<String>, pub status: Option<String>, pub q: Option<String>, pub segera_habis: Option<i32> }
pub async fn kred_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<KredListQ>)
  -> Result<Json<Vec<KredRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let segera = q.segera_habis.unwrap_or(0);
    let sql = format!("SELECT {KRED_COLS} FROM simrscb_kredensial \
        WHERE (? IS NULL OR profesi=?) AND (? IS NULL OR status=?) AND (? IS NULL OR nama LIKE ? OR nip LIKE ?) \
          AND (?=0 OR (str_berlaku IS NOT NULL AND str_berlaku <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)) OR (sip_berlaku IS NOT NULL AND sip_berlaku <= DATE_ADD(CURDATE(), INTERVAL 90 DAY))) \
        ORDER BY nama LIMIT 1000");
    let rows = sqlx::query_as(&sql).bind(&q.profesi).bind(&q.profesi).bind(&q.status).bind(&q.status).bind(&qs).bind(&qs).bind(&qs).bind(segera)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct KredBody {
    pub nama: String, #[serde(default)] pub nip: Option<String>, #[serde(default)] pub profesi: Option<String>, #[serde(default)] pub jenis: Option<String>,
    #[serde(default)] pub tanggal_kredensial: Option<String>, #[serde(default)] pub str_nomor: Option<String>, #[serde(default)] pub str_berlaku: Option<String>,
    #[serde(default)] pub sip_nomor: Option<String>, #[serde(default)] pub sip_berlaku: Option<String>, #[serde(default)] pub rekomendasi: Option<String>,
    #[serde(default)] pub rkk: Option<String>, #[serde(default)] pub spk_berlaku: Option<String>, #[serde(default)] pub status: Option<String>, #[serde(default)] pub catatan: Option<String>,
}
pub async fn kred_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<KredBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.nama.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Nama wajib"})))); }
    let r = sqlx::query("INSERT INTO simrscb_kredensial (nip,nama,profesi,jenis,tanggal_kredensial,str_nomor,str_berlaku,sip_nomor,sip_berlaku,rekomendasi,rkk,spk_berlaku,status,catatan,petugas_nip) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.nip).bind(b.nama.trim()).bind(&b.profesi).bind(b.jenis.as_deref().unwrap_or("Kredensial Awal"))
        .bind(od(&b.tanggal_kredensial)).bind(&b.str_nomor).bind(od(&b.str_berlaku)).bind(&b.sip_nomor).bind(od(&b.sip_berlaku))
        .bind(&b.rekomendasi).bind(&b.rkk).bind(od(&b.spk_berlaku)).bind(b.status.as_deref().unwrap_or("Aktif")).bind(&b.catatan).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn kred_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<KredBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("UPDATE simrscb_kredensial SET nip=?,nama=?,profesi=?,jenis=COALESCE(?,jenis),tanggal_kredensial=?,str_nomor=?,str_berlaku=?,sip_nomor=?,sip_berlaku=?,rekomendasi=?,rkk=?,spk_berlaku=?,status=COALESCE(?,status),catatan=?,updated_at=NOW() WHERE id=?")
        .bind(&b.nip).bind(b.nama.trim()).bind(&b.profesi).bind(&b.jenis)
        .bind(od(&b.tanggal_kredensial)).bind(&b.str_nomor).bind(od(&b.str_berlaku)).bind(&b.sip_nomor).bind(od(&b.sip_berlaku))
        .bind(&b.rekomendasi).bind(&b.rkk).bind(od(&b.spk_berlaku)).bind(&b.status).bind(&b.catatan).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn kred_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_kredensial WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Diklat ───────────────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct DiklatRow {
    pub id: i32, pub nip: Option<String>, pub nama: String, pub nama_pelatihan: String, pub penyelenggara: Option<String>,
    pub jenis: String, pub tanggal_mulai: Option<String>, pub tanggal_selesai: Option<String>, pub jpl: Option<i32>,
    pub sertifikat_no: Option<String>, pub berlaku_sampai: Option<String>, pub catatan: Option<String>,
}
const DIK_COLS: &str = "id, nip, nama, nama_pelatihan, penyelenggara, jenis, DATE_FORMAT(tanggal_mulai,'%Y-%m-%d') tanggal_mulai, DATE_FORMAT(tanggal_selesai,'%Y-%m-%d') tanggal_selesai, jpl, sertifikat_no, DATE_FORMAT(berlaku_sampai,'%Y-%m-%d') berlaku_sampai, catatan";
#[derive(Deserialize)]
pub struct DikListQ { pub tahun: Option<i32>, pub jenis: Option<String>, pub q: Option<String> }
pub async fn dik_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<DikListQ>)
  -> Result<Json<Vec<DiklatRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!("SELECT {DIK_COLS} FROM simrscb_diklat \
        WHERE (? IS NULL OR YEAR(tanggal_mulai)=?) AND (? IS NULL OR jenis=?) AND (? IS NULL OR nama LIKE ? OR nama_pelatihan LIKE ?) \
        ORDER BY tanggal_mulai DESC, id DESC LIMIT 1000");
    let rows = sqlx::query_as(&sql).bind(q.tahun).bind(q.tahun).bind(&q.jenis).bind(&q.jenis).bind(&qs).bind(&qs)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct DikBody {
    pub nama: String, pub nama_pelatihan: String, #[serde(default)] pub nip: Option<String>, #[serde(default)] pub penyelenggara: Option<String>,
    #[serde(default)] pub jenis: Option<String>, #[serde(default)] pub tanggal_mulai: Option<String>, #[serde(default)] pub tanggal_selesai: Option<String>,
    #[serde(default)] pub jpl: Option<i32>, #[serde(default)] pub sertifikat_no: Option<String>, #[serde(default)] pub berlaku_sampai: Option<String>, #[serde(default)] pub catatan: Option<String>,
}
pub async fn dik_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<DikBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.nama.trim().is_empty() || b.nama_pelatihan.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Nama & pelatihan wajib"})))); }
    let r = sqlx::query("INSERT INTO simrscb_diklat (nip,nama,nama_pelatihan,penyelenggara,jenis,tanggal_mulai,tanggal_selesai,jpl,sertifikat_no,berlaku_sampai,catatan,petugas_nip) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.nip).bind(b.nama.trim()).bind(b.nama_pelatihan.trim()).bind(&b.penyelenggara).bind(b.jenis.as_deref().unwrap_or("Internal"))
        .bind(od(&b.tanggal_mulai)).bind(od(&b.tanggal_selesai)).bind(b.jpl).bind(&b.sertifikat_no).bind(od(&b.berlaku_sampai)).bind(&b.catatan).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn dik_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<DikBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("UPDATE simrscb_diklat SET nip=?,nama=?,nama_pelatihan=?,penyelenggara=?,jenis=COALESCE(?,jenis),tanggal_mulai=?,tanggal_selesai=?,jpl=?,sertifikat_no=?,berlaku_sampai=?,catatan=? WHERE id=?")
        .bind(&b.nip).bind(b.nama.trim()).bind(b.nama_pelatihan.trim()).bind(&b.penyelenggara).bind(&b.jenis)
        .bind(od(&b.tanggal_mulai)).bind(od(&b.tanggal_selesai)).bind(b.jpl).bind(&b.sertifikat_no).bind(od(&b.berlaku_sampai)).bind(&b.catatan).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn dik_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_diklat WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Penilaian Kinerja (OPPE/FPPE) ────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct KinerjaRow {
    pub id: i32, pub tanggal: Option<String>, pub nip: Option<String>, pub nama: String, pub profesi: Option<String>,
    pub jenis: String, pub periode: Option<String>, pub nilai: Option<f64>, pub kategori: Option<String>,
    pub aspek: Option<String>, pub rekomendasi: Option<String>, pub penilai: Option<String>, pub catatan: Option<String>,
}
const KIN_COLS: &str = "id, DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, nip, nama, profesi, jenis, periode, nilai, kategori, aspek, rekomendasi, penilai, catatan";
#[derive(Deserialize)]
pub struct KinListQ { pub tahun: Option<i32>, pub jenis: Option<String>, pub q: Option<String> }
pub async fn kin_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<KinListQ>)
  -> Result<Json<Vec<KinerjaRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!("SELECT {KIN_COLS} FROM simrscb_penilaian_kinerja \
        WHERE (? IS NULL OR YEAR(tanggal)=?) AND (? IS NULL OR jenis=?) AND (? IS NULL OR nama LIKE ? OR nip LIKE ?) \
        ORDER BY tanggal DESC, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql).bind(q.tahun).bind(q.tahun).bind(&q.jenis).bind(&q.jenis).bind(&qs).bind(&qs).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct KinBody {
    pub tanggal: String, pub nama: String, #[serde(default)] pub nip: Option<String>, #[serde(default)] pub profesi: Option<String>,
    #[serde(default)] pub jenis: Option<String>, #[serde(default)] pub periode: Option<String>, #[serde(default)] pub nilai: Option<f64>,
    #[serde(default)] pub aspek: Option<String>, #[serde(default)] pub rekomendasi: Option<String>, #[serde(default)] pub penilai: Option<String>, #[serde(default)] pub catatan: Option<String>,
}
fn kategori_of(n: Option<f64>) -> Option<String> {
    n.map(|v| if v >= 85.0 { "Baik Sekali" } else if v >= 70.0 { "Baik" } else if v >= 55.0 { "Cukup" } else { "Kurang" }.to_string())
}
pub async fn kin_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<KinBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.nama.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Nama wajib"})))); }
    let kat = kategori_of(b.nilai);
    let r = sqlx::query("INSERT INTO simrscb_penilaian_kinerja (tanggal,nip,nama,profesi,jenis,periode,nilai,kategori,aspek,rekomendasi,penilai,catatan,petugas_nip) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.tanggal).bind(&b.nip).bind(b.nama.trim()).bind(&b.profesi).bind(b.jenis.as_deref().unwrap_or("OPPE")).bind(&b.periode).bind(b.nilai).bind(&kat).bind(&b.aspek).bind(&b.rekomendasi).bind(&b.penilai).bind(&b.catatan).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id(), "kategori": kat})))
}
pub async fn kin_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<KinBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let kat = kategori_of(b.nilai);
    sqlx::query("UPDATE simrscb_penilaian_kinerja SET tanggal=?,nip=?,nama=?,profesi=?,jenis=COALESCE(?,jenis),periode=?,nilai=?,kategori=?,aspek=?,rekomendasi=?,penilai=?,catatan=?,updated_at=NOW() WHERE id=?")
        .bind(&b.tanggal).bind(&b.nip).bind(b.nama.trim()).bind(&b.profesi).bind(&b.jenis).bind(&b.periode).bind(b.nilai).bind(&kat).bind(&b.aspek).bind(&b.rekomendasi).bind(&b.penilai).bind(&b.catatan).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "kategori": kat})))
}
pub async fn kin_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?; sqlx::query("DELETE FROM simrscb_penilaian_kinerja WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?; Ok(Json(json!({"ok": true})))
}

// ── Rekap ────────────────────────────────────────────────────────────────────
pub async fn rekap(_u: AuthUser, State(s): State<AppState>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let total_kred: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_kredensial").fetch_one(&s.pool).await.unwrap_or(0);
    let str_segera: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_kredensial WHERE str_berlaku IS NOT NULL AND str_berlaku BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)").fetch_one(&s.pool).await.unwrap_or(0);
    let str_habis: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_kredensial WHERE str_berlaku IS NOT NULL AND str_berlaku < CURDATE()").fetch_one(&s.pool).await.unwrap_or(0);
    let sip_segera: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_kredensial WHERE sip_berlaku IS NOT NULL AND sip_berlaku BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)").fetch_one(&s.pool).await.unwrap_or(0);
    #[derive(sqlx::FromRow)] struct C { k: Option<String>, n: i64 }
    let per_profesi: Vec<C> = sqlx::query_as("SELECT IFNULL(profesi,'-') k, COUNT(*) n FROM simrscb_kredensial GROUP BY profesi ORDER BY n DESC").fetch_all(&s.pool).await.map_err(db_err)?;
    let tahun = chrono::Local::now().format("%Y").to_string().parse::<i32>().unwrap_or(2026);
    let diklat_tahun: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_diklat WHERE YEAR(tanggal_mulai)=?").bind(tahun).fetch_one(&s.pool).await.unwrap_or(0);
    let jpl_tahun: i64 = sqlx::query_scalar("SELECT IFNULL(SUM(jpl),0) FROM simrscb_diklat WHERE YEAR(tanggal_mulai)=?").bind(tahun).fetch_one(&s.pool).await.unwrap_or(0);
    Ok(Json(json!({
        "total_kredensial": total_kred, "str_segera_habis": str_segera, "str_kedaluwarsa": str_habis, "sip_segera_habis": sip_segera,
        "per_profesi": per_profesi.iter().map(|c| json!({"label": c.k, "total": c.n})).collect::<Vec<_>>(),
        "diklat_tahun": diklat_tahun, "jpl_tahun": jpl_tahun, "tahun": tahun,
    })))
}
