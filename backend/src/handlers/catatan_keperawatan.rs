// Catatan Keperawatan (CPPT keperawatan) — port tabel Khanza:
//   catatan_keperawatan_ralan (rawat jalan + IGD), catatan_keperawatan_ranap (rawat inap).
// Log append per no_rawat (tanpa PK) — key operasi = (no_rawat, tanggal, jam). Owner = nip.
use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB catatan_keperawatan: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn tabel(jenis: &str) -> &'static str {
    if jenis == "ranap" { "catatan_keperawatan_ranap" } else { "catatan_keperawatan_ralan" }
}

#[derive(Serialize, sqlx::FromRow)]
pub struct CkRow {
    pub tanggal: Option<String>, pub jam: Option<String>, pub td: Option<String>, pub nadi: Option<String>,
    pub rr: Option<String>, pub suhu: Option<String>, pub spo2: Option<String>, pub uraian: Option<String>,
    pub nip: Option<String>, pub petugas: Option<String>, pub milik: i64,
}
#[derive(Deserialize)]
pub struct ListQ { pub jenis: String, pub no_rawat: String }
pub async fn list(user: AuthUser, State(s): State<AppState>, Query(q): Query<ListQ>)
  -> Result<Json<Vec<CkRow>>, (StatusCode, Json<Value>)> {
    let t = tabel(&q.jenis);
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let sql = format!(
        "SELECT DATE_FORMAT(c.tanggal,'%Y-%m-%d') tanggal, TIME_FORMAT(c.jam,'%H:%i:%s') jam, c.td, c.nadi, c.rr, c.suhu, c.spo2, c.uraian, \
                c.nip, IFNULL(pg.nama, c.nip) petugas, (c.nip = ? OR ? = 1) milik \
         FROM {t} c LEFT JOIN pegawai pg ON pg.nik = c.nip WHERE c.no_rawat = ? ORDER BY c.tanggal DESC, c.jam DESC LIMIT 500");
    let rows = sqlx::query_as(&sql).bind(&user.0.kode).bind(admin).bind(&q.no_rawat).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct CkBody {
    pub jenis: String, pub no_rawat: String,
    #[serde(default)] pub tanggal: String, #[serde(default)] pub jam: String,
    #[serde(default)] pub td: Option<String>, #[serde(default)] pub nadi: Option<String>, #[serde(default)] pub rr: Option<String>,
    #[serde(default)] pub suhu: Option<String>, #[serde(default)] pub spo2: Option<String>, #[serde(default)] pub uraian: Option<String>,
    #[serde(default)] pub edit: bool, #[serde(default)] pub orig_tanggal: String, #[serde(default)] pub orig_jam: String,
}
pub async fn create(user: AuthUser, State(s): State<AppState>, Json(b): Json<CkBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let t = tabel(&b.jenis);
    if b.no_rawat.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"})))); }
    // tanggal/jam: dari input; kosong -> sekarang
    let (tgl, jam): (String, String) = if b.tanggal.trim().is_empty() || b.jam.trim().is_empty() {
        sqlx::query_as("SELECT DATE_FORMAT(NOW(),'%Y-%m-%d'), DATE_FORMAT(NOW(),'%H:%i:%s')").fetch_one(&s.pool).await.map_err(db_err)?
    } else { (b.tanggal.trim().to_string(), b.jam.trim().to_string()) };
    sqlx::query(&format!("INSERT INTO {t} (tanggal,jam,no_rawat,td,nadi,rr,suhu,spo2,uraian,nip) VALUES (?,?,?,?,?,?,?,?,?,?)"))
        .bind(&tgl).bind(&jam).bind(&b.no_rawat).bind(&b.td).bind(&b.nadi).bind(&b.rr).bind(&b.suhu).bind(&b.spo2).bind(&b.uraian).bind(&user.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "tanggal": tgl, "jam": jam})))
}
pub async fn update(user: AuthUser, State(s): State<AppState>, Json(b): Json<CkBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let t = tabel(&b.jenis);
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    if b.orig_tanggal.trim().is_empty() || b.orig_jam.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"kunci lama wajib"}))));
    }
    let res = sqlx::query(&format!(
        "UPDATE {t} SET tanggal=?,jam=?,td=?,nadi=?,rr=?,suhu=?,spo2=?,uraian=? \
         WHERE no_rawat=? AND tanggal=? AND jam=? AND (nip=? OR ?=1)"))
        .bind(b.tanggal.trim()).bind(b.jam.trim()).bind(&b.td).bind(&b.nadi).bind(&b.rr).bind(&b.suhu).bind(&b.spo2).bind(&b.uraian)
        .bind(&b.no_rawat).bind(b.orig_tanggal.trim()).bind(b.orig_jam.trim()).bind(&user.0.kode).bind(admin)
        .execute(&s.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 { return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Bukan milik Anda / data tak ditemukan"})))); }
    Ok(Json(json!({"ok": true})))
}
#[derive(Deserialize)]
pub struct CkDel { pub jenis: String, pub no_rawat: String, pub tanggal: String, pub jam: String }
pub async fn hapus(user: AuthUser, State(s): State<AppState>, Json(b): Json<CkDel>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let t = tabel(&b.jenis);
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let res = sqlx::query(&format!("DELETE FROM {t} WHERE no_rawat=? AND tanggal=? AND jam=? AND (nip=? OR ?=1)"))
        .bind(&b.no_rawat).bind(b.tanggal.trim()).bind(b.jam.trim()).bind(&user.0.kode).bind(admin)
        .execute(&s.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 { return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Bukan milik Anda / data tak ditemukan"})))); }
    Ok(Json(json!({"ok": true})))
}

// Data untuk cetak: header pasien + RS + daftar entri (urut naik).
#[derive(Deserialize)]
pub struct CetakQ { pub jenis: String, pub no_rawat: String }
pub async fn cetak(_user: AuthUser, State(s): State<AppState>, Query(q): Query<CetakQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let t = tabel(&q.jenis);
    #[derive(sqlx::FromRow)]
    struct Pasien { no_rkm_medis: Option<String>, nm_pasien: Option<String>, jk: Option<String>, tgl_lahir: Option<String>, umur: Option<String> }
    let pas: Option<Pasien> = sqlx::query_as(
        "SELECT p.no_rkm_medis, p.nm_pasien, IF(p.jk='L','Laki-Laki','Perempuan') jk, DATE_FORMAT(p.tgl_lahir,'%d-%m-%Y') tgl_lahir, \
                CONCAT(r.umurdaftar,' ',r.sttsumur) umur \
         FROM reg_periksa r JOIN pasien p ON p.no_rkm_medis=r.no_rkm_medis WHERE r.no_rawat=? LIMIT 1")
        .bind(&q.no_rawat).fetch_optional(&s.pool).await.map_err(db_err)?;
    #[derive(sqlx::FromRow)]
    struct Rs { nama_instansi: Option<String>, alamat_instansi: Option<String>, kabupaten: Option<String>, propinsi: Option<String>, kontak: Option<String>, email: Option<String> }
    let rs: Option<Rs> = sqlx::query_as("SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email FROM setting LIMIT 1")
        .fetch_optional(&s.pool).await.ok().flatten();
    #[derive(sqlx::FromRow)]
    struct E { tanggal: Option<String>, jam: Option<String>, td: Option<String>, nadi: Option<String>, rr: Option<String>, suhu: Option<String>, spo2: Option<String>, uraian: Option<String>, petugas: Option<String> }
    let entries: Vec<E> = sqlx::query_as(&format!(
        "SELECT DATE_FORMAT(c.tanggal,'%d-%m-%Y') tanggal, TIME_FORMAT(c.jam,'%H:%i') jam, c.td, c.nadi, c.rr, c.suhu, c.spo2, c.uraian, IFNULL(pg.nama,c.nip) petugas \
         FROM {t} c LEFT JOIN pegawai pg ON pg.nik=c.nip WHERE c.no_rawat=? ORDER BY c.tanggal, c.jam"))
        .bind(&q.no_rawat).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({
        "jenis": q.jenis, "no_rawat": q.no_rawat,
        "rs": rs.map(|r| json!({"nama": r.nama_instansi, "alamat": r.alamat_instansi, "kabupaten": r.kabupaten, "propinsi": r.propinsi, "kontak": r.kontak, "email": r.email})),
        "pasien": pas.map(|p| json!({"no_rkm_medis": p.no_rkm_medis, "nama": p.nm_pasien, "jk": p.jk, "tgl_lahir": p.tgl_lahir, "umur": p.umur})),
        "entries": entries.iter().map(|e| json!({"tanggal": e.tanggal, "jam": e.jam, "td": e.td, "nadi": e.nadi, "rr": e.rr, "suhu": e.suhu, "spo2": e.spo2, "uraian": e.uraian, "petugas": e.petugas})).collect::<Vec<_>>(),
    })))
}
