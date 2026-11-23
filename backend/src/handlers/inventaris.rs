// Modul Inventaris/Aset (migrasi dari SIMGPS). Daftar aset + master filter +
// ringkasan. CRUD admin-only untuk ubah.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// Direktori foto aset (di pohon webapps; override via env). Disajikan lewat
/// GET /api/inventaris/foto/:name agar tak bentrok dgn route halaman /inventaris.
fn foto_dir() -> String {
    std::env::var("INVENTARIS_FOTO_DIR").unwrap_or_else(|_| "uploads/inventaris".to_string())
}
pub async fn foto_serve(Path(name): Path<String>) -> Result<Response, (StatusCode, Json<Value>)> {
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "nama tidak valid"}))));
    }
    let path = format!("{}/{}", foto_dir(), name);
    let bytes = tokio::fs::read(&path).await
        .map_err(|_| (StatusCode::NOT_FOUND, Json(json!({"error": "foto tidak ditemukan"}))))?;
    let ct = match name.rsplit_once('.').map(|(_, e)| e.to_lowercase()).as_deref() {
        Some("png") => "image/png", Some("webp") => "image/webp", _ => "image/jpeg",
    };
    Ok((
        [(header::CONTENT_TYPE, ct.to_string()),
         (header::CACHE_CONTROL, "public, max-age=86400".to_string())],
        bytes,
    ).into_response())
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB inventaris: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data inventaris"})))
}
fn adminonly(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if u.0.is_admin { Ok(()) } else { Err((StatusCode::FORBIDDEN, Json(json!({"error": "Hanya admin"})))) }
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Inventaris {
    pub id: i64, pub nama_alat: String, pub barcode: String, pub merk: String, pub model: String,
    pub ruangan: String, pub gedung: String, pub kategori: String, pub status_laik: String,
    pub kondisi: String, pub no_seri: String, pub tahun: String, pub nilai: f64,
    pub hasil_kalibrasi: String, pub catatan: String,
    pub foto: String, pub no_label: String, pub vendor: String, pub wajib_kalibrasi: i64,
}

#[derive(Deserialize)]
pub struct ListQuery {
    #[serde(default)] pub q: Option<String>,
    #[serde(default)] pub ruangan: Option<String>,
    #[serde(default)] pub merk: Option<String>,
    #[serde(default)] pub kategori: Option<String>,
}

pub async fn list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQuery>)
  -> Result<Json<Vec<Inventaris>>, (StatusCode, Json<Value>)> {
    let like = format!("%{}%", q.q.as_deref().unwrap_or("").trim());
    let rows = sqlx::query_as::<_, Inventaris>(
        "SELECT id, IFNULL(nama_alat,'') nama_alat, IFNULL(barcode,'') barcode, IFNULL(merk,'') merk, \
                IFNULL(model,'') model, IFNULL(ruangan,'') ruangan, IFNULL(gedung,'') gedung, \
                IFNULL(kategori,'') kategori, IFNULL(status_laik,'') status_laik, IFNULL(kondisi,'') kondisi, \
                IFNULL(no_seri,'') no_seri, IFNULL(tahun,'') tahun, IFNULL(nilai,0) nilai, \
                IFNULL(hasil_kalibrasi,'') hasil_kalibrasi, IFNULL(catatan,'') catatan, \
                IFNULL(foto,'') foto, IFNULL(no_label,'') no_label, IFNULL(vendor,'') vendor, IFNULL(wajib_kalibrasi,0) wajib_kalibrasi \
         FROM simrscb_inventaris \
         WHERE (? = '%%' OR nama_alat LIKE ? OR barcode LIKE ? OR merk LIKE ? OR model LIKE ? OR no_seri LIKE ?) \
           AND (? = '' OR ruangan = ?) AND (? = '' OR merk = ?) AND (? = '' OR kategori = ?) \
         ORDER BY nama_alat ASC, id ASC LIMIT 5000"
    )
    .bind(&like).bind(&like).bind(&like).bind(&like).bind(&like).bind(&like)
    .bind(q.ruangan.as_deref().unwrap_or("")).bind(q.ruangan.as_deref().unwrap_or(""))
    .bind(q.merk.as_deref().unwrap_or("")).bind(q.merk.as_deref().unwrap_or(""))
    .bind(q.kategori.as_deref().unwrap_or("")).bind(q.kategori.as_deref().unwrap_or(""))
    .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Serialize)]
pub struct Summary {
    pub total: i64, pub laik: i64, pub tidak_laik: i64, pub nilai_total: f64,
    pub per_kategori: Vec<KV>, pub per_ruangan: Vec<KV>,
}
#[derive(Serialize, sqlx::FromRow)]
pub struct KV { pub k: String, pub v: i64 }

pub async fn summary(_u: AuthUser, State(s): State<AppState>) -> Json<Summary> {
    let p = &s.pool;
    let sci = |sql: &'static str| async move { let r:(i64,)=sqlx::query_as(sql).fetch_one(p).await.unwrap_or((0,)); r.0 };
    let scf = |sql: &'static str| async move { let r:(f64,)=sqlx::query_as(sql).fetch_one(p).await.unwrap_or((0.0,)); r.0 };
    let per_kategori: Vec<KV> = sqlx::query_as("SELECT IFNULL(NULLIF(kategori,''),'Lainnya') k, COUNT(*) v FROM simrscb_inventaris GROUP BY kategori ORDER BY v DESC")
        .fetch_all(p).await.unwrap_or_default();
    let per_ruangan: Vec<KV> = sqlx::query_as("SELECT IFNULL(NULLIF(ruangan,''),'-') k, COUNT(*) v FROM simrscb_inventaris GROUP BY ruangan ORDER BY v DESC LIMIT 12")
        .fetch_all(p).await.unwrap_or_default();
    Json(Summary {
        total: sci("SELECT COUNT(*) FROM simrscb_inventaris").await,
        laik: sci("SELECT COUNT(*) FROM simrscb_inventaris WHERE status_laik='Laik'").await,
        tidak_laik: sci("SELECT COUNT(*) FROM simrscb_inventaris WHERE status_laik LIKE 'Tidak%'").await,
        nilai_total: scf("SELECT IFNULL(SUM(nilai),0) FROM simrscb_inventaris").await,
        per_kategori, per_ruangan,
    })
}

#[derive(Serialize)]
pub struct Filters { pub ruangan: Vec<String>, pub merk: Vec<String>, pub kategori: Vec<String> }
pub async fn filters(_u: AuthUser, State(s): State<AppState>) -> Json<Filters> {
    let p = &s.pool;
    let col = |sql: &'static str| async move {
        let r: Vec<(String,)> = sqlx::query_as(sql).fetch_all(p).await.unwrap_or_default();
        r.into_iter().map(|x| x.0).filter(|x| !x.is_empty()).collect::<Vec<_>>()
    };
    Json(Filters {
        ruangan: col("SELECT DISTINCT ruangan FROM simrscb_inventaris WHERE ruangan<>'' ORDER BY ruangan").await,
        merk: col("SELECT DISTINCT merk FROM simrscb_inventaris WHERE merk<>'' ORDER BY merk").await,
        kategori: col("SELECT DISTINCT kategori FROM simrscb_inventaris WHERE kategori<>'' ORDER BY kategori").await,
    })
}

#[derive(Deserialize)]
pub struct SaveBody {
    #[serde(default)] pub id: Option<i64>,
    pub nama_alat: String,
    #[serde(default)] pub barcode: String, #[serde(default)] pub merk: String, #[serde(default)] pub model: String,
    #[serde(default)] pub ruangan: String, #[serde(default)] pub gedung: String, #[serde(default)] pub kategori: String,
    #[serde(default)] pub status_laik: String, #[serde(default)] pub kondisi: String,
    #[serde(default)] pub no_seri: String, #[serde(default)] pub tahun: String, #[serde(default)] pub nilai: f64,
    #[serde(default)] pub hasil_kalibrasi: String, #[serde(default)] pub catatan: String,
    #[serde(default)] pub vendor: String, #[serde(default)] pub wajib_kalibrasi: i64,
}
pub async fn save(u: AuthUser, State(s): State<AppState>, Json(b): Json<SaveBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    match b.id {
        Some(id) => { sqlx::query(
            "UPDATE simrscb_inventaris SET nama_alat=?,barcode=?,merk=?,model=?,ruangan=?,gedung=?,kategori=?,status_laik=?,kondisi=?,no_seri=?,tahun=?,nilai=?,hasil_kalibrasi=?,catatan=?,vendor=?,wajib_kalibrasi=? WHERE id=?")
            .bind(&b.nama_alat).bind(&b.barcode).bind(&b.merk).bind(&b.model).bind(&b.ruangan).bind(&b.gedung).bind(&b.kategori)
            .bind(&b.status_laik).bind(&b.kondisi).bind(&b.no_seri).bind(&b.tahun).bind(b.nilai).bind(&b.hasil_kalibrasi).bind(&b.catatan).bind(&b.vendor).bind(b.wajib_kalibrasi).bind(id)
            .execute(&s.pool).await.map_err(db_err)?; }
        None => { sqlx::query(
            "INSERT INTO simrscb_inventaris (nama_alat,barcode,merk,model,ruangan,gedung,kategori,status_laik,kondisi,no_seri,tahun,nilai,hasil_kalibrasi,catatan,vendor,wajib_kalibrasi) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(&b.nama_alat).bind(&b.barcode).bind(&b.merk).bind(&b.model).bind(&b.ruangan).bind(&b.gedung).bind(&b.kategori)
            .bind(&b.status_laik).bind(&b.kondisi).bind(&b.no_seri).bind(&b.tahun).bind(b.nilai).bind(&b.hasil_kalibrasi).bind(&b.catatan).bind(&b.vendor).bind(b.wajib_kalibrasi)
            .execute(&s.pool).await.map_err(db_err)?; }
    }
    Ok(Json(json!({"ok": true})))
}
pub async fn del(u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    sqlx::query("DELETE FROM simrscb_inventaris WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Detail 1 aset ────────────────────────────────────────────────────────────
pub async fn detail(_u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>)
  -> Result<Json<Inventaris>, (StatusCode, Json<Value>)> {
    let r = sqlx::query_as::<_, Inventaris>(
        "SELECT id, IFNULL(nama_alat,'') nama_alat, IFNULL(barcode,'') barcode, IFNULL(merk,'') merk, \
                IFNULL(model,'') model, IFNULL(ruangan,'') ruangan, IFNULL(gedung,'') gedung, \
                IFNULL(kategori,'') kategori, IFNULL(status_laik,'') status_laik, IFNULL(kondisi,'') kondisi, \
                IFNULL(no_seri,'') no_seri, IFNULL(tahun,'') tahun, IFNULL(nilai,0) nilai, \
                IFNULL(hasil_kalibrasi,'') hasil_kalibrasi, IFNULL(catatan,'') catatan, \
                IFNULL(foto,'') foto, IFNULL(no_label,'') no_label, IFNULL(vendor,'') vendor, IFNULL(wajib_kalibrasi,0) wajib_kalibrasi \
         FROM simrscb_inventaris WHERE id=? LIMIT 1"
    ).bind(id).fetch_optional(&s.pool).await.map_err(db_err)?;
    match r { Some(x) => Ok(Json(x)), None => Err((StatusCode::NOT_FOUND, Json(json!({"error":"Aset tidak ditemukan"})))) }
}

// ── Transaksi (Kalibrasi/Maintenance/Inspeksi/Mutasi/Complain) ────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct Transaksi {
    pub id: i64, pub inventaris_id: i64, pub jenis: String,
    pub tanggal: Option<String>, pub tanggal_berikut: Option<String>,
    pub hasil: String, pub keterangan: String,
    pub ruangan_asal: String, pub ruangan_tujuan: String,
    pub biaya: f64, pub vendor: String, pub petugas: String,
}
#[derive(Deserialize)]
pub struct TransaksiQuery { pub inventaris_id: i64 }
pub async fn transaksi_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<TransaksiQuery>)
  -> Result<Json<Vec<Transaksi>>, (StatusCode, Json<Value>)> {
    let rows = sqlx::query_as::<_, Transaksi>(
        "SELECT id, inventaris_id, IFNULL(jenis,'') jenis, DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, \
                DATE_FORMAT(tanggal_berikut,'%Y-%m-%d') tanggal_berikut, IFNULL(hasil,'') hasil, \
                IFNULL(keterangan,'') keterangan, IFNULL(ruangan_asal,'') ruangan_asal, IFNULL(ruangan_tujuan,'') ruangan_tujuan, \
                IFNULL(biaya,0) biaya, IFNULL(vendor,'') vendor, IFNULL(petugas,'') petugas \
         FROM simrscb_inventaris_transaksi WHERE inventaris_id=? ORDER BY tanggal DESC, id DESC"
    ).bind(q.inventaris_id).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct TransaksiBody {
    #[serde(default)] pub id: Option<i64>,
    pub inventaris_id: i64, pub jenis: String,
    #[serde(default)] pub tanggal: Option<String>, #[serde(default)] pub tanggal_berikut: Option<String>,
    #[serde(default)] pub hasil: String, #[serde(default)] pub keterangan: String,
    #[serde(default)] pub ruangan_asal: String, #[serde(default)] pub ruangan_tujuan: String,
    #[serde(default)] pub biaya: f64, #[serde(default)] pub vendor: String, #[serde(default)] pub petugas: String,
}
pub async fn transaksi_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<TransaksiBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    let t = b.tanggal.filter(|x| !x.is_empty());
    let tb = b.tanggal_berikut.filter(|x| !x.is_empty());
    match b.id {
        Some(id) => { sqlx::query("UPDATE simrscb_inventaris_transaksi SET jenis=?,tanggal=?,tanggal_berikut=?,hasil=?,keterangan=?,ruangan_asal=?,ruangan_tujuan=?,biaya=?,vendor=?,petugas=?,updated_by=? WHERE id=?")
            .bind(&b.jenis).bind(&t).bind(&tb).bind(&b.hasil).bind(&b.keterangan).bind(&b.ruangan_asal).bind(&b.ruangan_tujuan).bind(b.biaya).bind(&b.vendor).bind(&b.petugas).bind(&u.0.kode).bind(id)
            .execute(&s.pool).await.map_err(db_err)?; }
        None => { sqlx::query("INSERT INTO simrscb_inventaris_transaksi (inventaris_id,jenis,tanggal,tanggal_berikut,hasil,keterangan,ruangan_asal,ruangan_tujuan,biaya,vendor,petugas,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(b.inventaris_id).bind(&b.jenis).bind(&t).bind(&tb).bind(&b.hasil).bind(&b.keterangan).bind(&b.ruangan_asal).bind(&b.ruangan_tujuan).bind(b.biaya).bind(&b.vendor).bind(&b.petugas).bind(&u.0.kode)
            .execute(&s.pool).await.map_err(db_err)?;
            // Mutasi juga pindahkan ruangan aset; Kalibrasi update status
            if b.jenis == "Mutasi" && !b.ruangan_tujuan.is_empty() {
                let _ = sqlx::query("UPDATE simrscb_inventaris SET ruangan=? WHERE id=?").bind(&b.ruangan_tujuan).bind(b.inventaris_id).execute(&s.pool).await;
            }
        }
    }
    Ok(Json(json!({"ok": true})))
}
pub async fn transaksi_del(u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    sqlx::query("DELETE FROM simrscb_inventaris_transaksi WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Jadwal Kalibrasi (aset wajib kalibrasi + status jatuh tempo) ──────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct JadwalKalibrasi {
    pub id: i64, pub nama_alat: String, pub barcode: String, pub ruangan: String,
    pub terakhir: Option<String>, pub berikut: Option<String>, pub sisa_hari: Option<i64>,
}
pub async fn jadwal_kalibrasi(_u: AuthUser, State(s): State<AppState>)
  -> Result<Json<Vec<JadwalKalibrasi>>, (StatusCode, Json<Value>)> {
    let rows = sqlx::query_as::<_, JadwalKalibrasi>(
        "SELECT i.id, IFNULL(i.nama_alat,'') nama_alat, IFNULL(i.barcode,'') barcode, IFNULL(i.ruangan,'') ruangan, \
                DATE_FORMAT((SELECT MAX(t.tanggal) FROM simrscb_inventaris_transaksi t WHERE t.inventaris_id=i.id AND t.jenis='Kalibrasi'),'%Y-%m-%d') AS terakhir, \
                DATE_FORMAT((SELECT t.tanggal_berikut FROM simrscb_inventaris_transaksi t WHERE t.inventaris_id=i.id AND t.jenis='Kalibrasi' ORDER BY t.tanggal DESC, t.id DESC LIMIT 1),'%Y-%m-%d') AS berikut, \
                DATEDIFF((SELECT t.tanggal_berikut FROM simrscb_inventaris_transaksi t WHERE t.inventaris_id=i.id AND t.jenis='Kalibrasi' ORDER BY t.tanggal DESC, t.id DESC LIMIT 1), CURDATE()) AS sisa_hari \
         FROM simrscb_inventaris i WHERE i.wajib_kalibrasi=1 \
         ORDER BY sisa_hari IS NULL, sisa_hari ASC LIMIT 2000"
    ).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// ── Dashboard Inventaris ─────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct KVf { pub k: String, pub v: f64 }
#[derive(Serialize)]
pub struct KalStat { pub wajib: i64, pub overdue: i64, pub due30: i64, pub terjadwal: i64, pub belum: i64 }
#[derive(Serialize)]
pub struct Dashboard {
    pub total: i64, pub laik: i64, pub tidak_laik: i64, pub nilai_total: f64,
    pub per_kondisi: Vec<KV>, pub per_gedung: Vec<KV>, pub per_kategori: Vec<KV>,
    pub nilai_per_kategori: Vec<KVf>, pub per_tahun: Vec<KV>,
    pub top_ruangan: Vec<KV>, pub kalibrasi: KalStat,
}
pub async fn dashboard(_u: AuthUser, State(s): State<AppState>) -> Json<Dashboard> {
    let p = &s.pool;
    let sci = |sql: &'static str| async move { let r:(i64,)=sqlx::query_as(sql).fetch_one(p).await.unwrap_or((0,)); r.0 };
    let scf = |sql: &'static str| async move { let r:(f64,)=sqlx::query_as(sql).fetch_one(p).await.unwrap_or((0.0,)); r.0 };
    let kv = |sql: &'static str| async move { sqlx::query_as::<_, KV>(sql).fetch_all(p).await.unwrap_or_default() };
    let kvf = |sql: &'static str| async move { sqlx::query_as::<_, KVf>(sql).fetch_all(p).await.unwrap_or_default() };
    // status kalibrasi per aset wajib (sisa hari ke jadwal berikut)
    let sisa: Vec<(Option<i64>,)> = sqlx::query_as(
        "SELECT DATEDIFF((SELECT t.tanggal_berikut FROM simrscb_inventaris_transaksi t WHERE t.inventaris_id=i.id AND t.jenis='Kalibrasi' ORDER BY t.tanggal DESC, t.id DESC LIMIT 1), CURDATE()) \
         FROM simrscb_inventaris i WHERE i.wajib_kalibrasi=1"
    ).fetch_all(p).await.unwrap_or_default();
    let mut k = KalStat { wajib: sisa.len() as i64, overdue: 0, due30: 0, terjadwal: 0, belum: 0 };
    for (d,) in &sisa { match d { None => k.belum += 1, Some(x) if *x < 0 => k.overdue += 1, Some(x) if *x <= 30 => k.due30 += 1, _ => k.terjadwal += 1 } }
    Json(Dashboard {
        total: sci("SELECT COUNT(*) FROM simrscb_inventaris").await,
        laik: sci("SELECT COUNT(*) FROM simrscb_inventaris WHERE status_laik='Laik'").await,
        tidak_laik: sci("SELECT COUNT(*) FROM simrscb_inventaris WHERE status_laik LIKE 'Tidak%'").await,
        nilai_total: scf("SELECT IFNULL(SUM(nilai),0) FROM simrscb_inventaris").await,
        per_kondisi: kv("SELECT IFNULL(NULLIF(kondisi,''),'(tidak diisi)') k, COUNT(*) v FROM simrscb_inventaris GROUP BY kondisi ORDER BY v DESC").await,
        per_gedung: kv("SELECT IFNULL(NULLIF(gedung,''),'-') k, COUNT(*) v FROM simrscb_inventaris GROUP BY gedung ORDER BY v DESC LIMIT 10").await,
        per_kategori: kv("SELECT IFNULL(NULLIF(kategori,''),'Lainnya') k, COUNT(*) v FROM simrscb_inventaris GROUP BY kategori ORDER BY v DESC").await,
        nilai_per_kategori: kvf("SELECT IFNULL(NULLIF(kategori,''),'Lainnya') k, IFNULL(SUM(nilai),0) v FROM simrscb_inventaris GROUP BY kategori ORDER BY v DESC").await,
        per_tahun: kv("SELECT IFNULL(NULLIF(tahun,''),'-') k, COUNT(*) v FROM simrscb_inventaris WHERE tahun<>'' GROUP BY tahun ORDER BY k DESC LIMIT 12").await,
        top_ruangan: kv("SELECT IFNULL(NULLIF(ruangan,''),'-') k, COUNT(*) v FROM simrscb_inventaris GROUP BY ruangan ORDER BY v DESC LIMIT 12").await,
        kalibrasi: k,
    })
}

// ── Master ruangan / merk (daftar + jumlah, rename massal) ────────────────────
pub async fn master_ruangan(_u: AuthUser, State(s): State<AppState>) -> Json<Vec<KV>> {
    Json(sqlx::query_as::<_, KV>("SELECT ruangan k, COUNT(*) v FROM simrscb_inventaris WHERE ruangan<>'' GROUP BY ruangan ORDER BY ruangan").fetch_all(&s.pool).await.unwrap_or_default())
}
pub async fn master_merk(_u: AuthUser, State(s): State<AppState>) -> Json<Vec<KV>> {
    Json(sqlx::query_as::<_, KV>("SELECT merk k, COUNT(*) v FROM simrscb_inventaris WHERE merk<>'' GROUP BY merk ORDER BY merk").fetch_all(&s.pool).await.unwrap_or_default())
}
#[derive(Deserialize)]
pub struct RenameBody { pub field: String, pub from: String, pub to: String }
pub async fn master_rename(u: AuthUser, State(s): State<AppState>, Json(b): Json<RenameBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    let sql = match b.field.as_str() {
        "ruangan" => "UPDATE simrscb_inventaris SET ruangan=? WHERE ruangan=?",
        "merk" => "UPDATE simrscb_inventaris SET merk=? WHERE merk=?",
        "gedung" => "UPDATE simrscb_inventaris SET gedung=? WHERE gedung=?",
        "nama_alat" => "UPDATE simrscb_inventaris SET nama_alat=? WHERE nama_alat=?",
        "kategori" => "UPDATE simrscb_inventaris SET kategori=? WHERE kategori=?",
        _ => return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"field tidak valid"})))),
    };
    let r = sqlx::query(sql).bind(&b.to).bind(&b.from).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "affected": r.rows_affected()})))
}

// ── Stok Opname ──────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct OpnameItem { pub inventaris_id: i64, pub status: String, #[serde(default)] pub kondisi: String }
#[derive(Deserialize)]
pub struct OpnameBody {
    pub ruangan: String, #[serde(default)] pub tanggal: Option<String>,
    #[serde(default)] pub petugas: String, #[serde(default)] pub catatan: String,
    pub items: Vec<OpnameItem>,
}
pub async fn opname_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<OpnameBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    let tgl = b.tanggal.filter(|x| !x.is_empty());
    let mut n = 0u64;
    for it in &b.items {
        sqlx::query("INSERT INTO simrscb_inventaris_opname (inventaris_id,tanggal,ruangan,status,kondisi,petugas,catatan,updated_by) VALUES (?,?,?,?,?,?,?,?)")
            .bind(it.inventaris_id).bind(&tgl).bind(&b.ruangan).bind(&it.status).bind(&it.kondisi).bind(&b.petugas).bind(&b.catatan).bind(&u.0.kode)
            .execute(&s.pool).await.map_err(db_err)?;
        // update kondisi aset bila diisi
        if !it.kondisi.is_empty() {
            let _ = sqlx::query("UPDATE simrscb_inventaris SET kondisi=? WHERE id=?").bind(&it.kondisi).bind(it.inventaris_id).execute(&s.pool).await;
        }
        n += 1;
    }
    Ok(Json(json!({"ok": true, "tersimpan": n})))
}
#[derive(Serialize, sqlx::FromRow)]
pub struct OpnameSesi {
    pub tanggal: Option<String>, pub ruangan: String,
    pub total: i64, pub ada: i64, pub tidak: i64, pub petugas: String,
}
pub async fn opname_history(_u: AuthUser, State(s): State<AppState>) -> Json<Vec<OpnameSesi>> {
    Json(sqlx::query_as::<_, OpnameSesi>(
        "SELECT DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, IFNULL(ruangan,'') ruangan, COUNT(*) total, \
                SUM(status='Ada') ada, SUM(status<>'Ada') tidak, IFNULL(MAX(petugas),'') petugas \
         FROM simrscb_inventaris_opname GROUP BY tanggal, ruangan ORDER BY tanggal DESC, ruangan LIMIT 100"
    ).fetch_all(&s.pool).await.unwrap_or_default())
}

// ── Daftar semua transaksi (untuk menu Kalibrasi/Maintenance/Mutasi/Complain) ─
#[derive(Serialize, sqlx::FromRow)]
pub struct TransaksiFull {
    pub id: i64, pub inventaris_id: i64, pub nama_alat: String, pub ruangan: String, pub barcode: String,
    pub jenis: String, pub tanggal: Option<String>, pub tanggal_berikut: Option<String>,
    pub hasil: String, pub keterangan: String, pub biaya: f64, pub vendor: String, pub petugas: String,
}
#[derive(Deserialize)]
pub struct TransaksiAllQuery {
    #[serde(default)] pub jenis: Option<String>,
    #[serde(default)] pub q: Option<String>,
}
pub async fn transaksi_all(_u: AuthUser, State(s): State<AppState>, Query(q): Query<TransaksiAllQuery>)
  -> Result<Json<Vec<TransaksiFull>>, (StatusCode, Json<Value>)> {
    let like = format!("%{}%", q.q.as_deref().unwrap_or("").trim());
    let jenis = q.jenis.as_deref().unwrap_or("");
    let rows = sqlx::query_as::<_, TransaksiFull>(
        "SELECT t.id, t.inventaris_id, IFNULL(i.nama_alat,'') nama_alat, IFNULL(i.ruangan,'') ruangan, IFNULL(i.barcode,'') barcode, \
                IFNULL(t.jenis,'') jenis, DATE_FORMAT(t.tanggal,'%Y-%m-%d') tanggal, DATE_FORMAT(t.tanggal_berikut,'%Y-%m-%d') tanggal_berikut, \
                IFNULL(t.hasil,'') hasil, IFNULL(t.keterangan,'') keterangan, IFNULL(t.biaya,0) biaya, IFNULL(t.vendor,'') vendor, IFNULL(t.petugas,'') petugas \
         FROM simrscb_inventaris_transaksi t LEFT JOIN simrscb_inventaris i ON i.id=t.inventaris_id \
         WHERE (? = '' OR t.jenis = ?) \
           AND (? = '%%' OR i.nama_alat LIKE ? OR i.ruangan LIKE ? OR i.barcode LIKE ? OR t.vendor LIKE ? OR t.petugas LIKE ?) \
         ORDER BY t.tanggal DESC, t.id DESC LIMIT 3000"
    ).bind(jenis).bind(jenis)
     .bind(&like).bind(&like).bind(&like).bind(&like).bind(&like).bind(&like)
     .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// ── Master generik (kolom apa saja dari whitelist) ───────────────────────────
#[derive(Deserialize)]
pub struct KolomQuery { pub field: String }
pub async fn master_kolom(_u: AuthUser, State(s): State<AppState>, Query(q): Query<KolomQuery>)
  -> Result<Json<Vec<KV>>, (StatusCode, Json<Value>)> {
    let col = match q.field.as_str() {
        "ruangan" | "merk" | "gedung" | "nama_alat" | "kategori" => q.field.as_str(),
        _ => return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"field tidak valid"})))),
    };
    // col dari whitelist → aman diformat
    let sql = format!("SELECT {c} k, COUNT(*) v FROM simrscb_inventaris WHERE {c}<>'' GROUP BY {c} ORDER BY {c}", c = col);
    let rows = sqlx::query_as::<_, KV>(&sql).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
