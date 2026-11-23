// Input manual Direktur: Pengadaan (PPK), Aset+Kalibrasi, Belanja BLUD.
// CRUD sederhana + ringkasan untuk dashboard. Admin-only untuk ubah.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Path, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB direktur_input: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data"})))
}
fn adminonly(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if u.0.is_admin { Ok(()) } else { Err((StatusCode::FORBIDDEN, Json(json!({"error": "Hanya admin"})))) }
}

// ── PENGADAAN ────────────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct Pengadaan {
    pub id: i64, pub paket: String, pub vendor: String,
    pub nilai_kontrak: f64, pub realisasi: f64,
    pub tgl_mulai: Option<String>, pub tgl_akhir: Option<String>,
    pub status: String, pub catatan: String,
    pub sisa_hari: Option<i64>,
}
#[derive(Deserialize)]
pub struct PengadaanBody {
    #[serde(default)] pub id: Option<i64>,
    pub paket: String, #[serde(default)] pub vendor: String,
    #[serde(default)] pub nilai_kontrak: f64, #[serde(default)] pub realisasi: f64,
    #[serde(default)] pub tgl_mulai: Option<String>, #[serde(default)] pub tgl_akhir: Option<String>,
    #[serde(default)] pub status: String, #[serde(default)] pub catatan: String,
}

pub async fn pengadaan_list(State(s): State<AppState>) -> Result<Json<Vec<Pengadaan>>, (StatusCode, Json<Value>)> {
    let rows = sqlx::query_as::<_, Pengadaan>(
        "SELECT id, IFNULL(paket,'') paket, IFNULL(vendor,'') vendor, nilai_kontrak, realisasi, \
                DATE_FORMAT(tgl_mulai,'%Y-%m-%d') tgl_mulai, DATE_FORMAT(tgl_akhir,'%Y-%m-%d') tgl_akhir, \
                IFNULL(status,'') status, IFNULL(catatan,'') catatan, \
                CASE WHEN tgl_akhir IS NULL THEN NULL ELSE DATEDIFF(tgl_akhir, CURDATE()) END AS sisa_hari \
         FROM simrscb_pengadaan ORDER BY tgl_akhir IS NULL, tgl_akhir ASC, id DESC"
    ).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
pub async fn pengadaan_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<PengadaanBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    let tm = b.tgl_mulai.filter(|x| !x.is_empty());
    let ta = b.tgl_akhir.filter(|x| !x.is_empty());
    match b.id {
        Some(id) => { sqlx::query("UPDATE simrscb_pengadaan SET paket=?,vendor=?,nilai_kontrak=?,realisasi=?,tgl_mulai=?,tgl_akhir=?,status=?,catatan=? WHERE id=?")
            .bind(&b.paket).bind(&b.vendor).bind(b.nilai_kontrak).bind(b.realisasi).bind(&tm).bind(&ta).bind(&b.status).bind(&b.catatan).bind(id)
            .execute(&s.pool).await.map_err(db_err)?; }
        None => { sqlx::query("INSERT INTO simrscb_pengadaan (paket,vendor,nilai_kontrak,realisasi,tgl_mulai,tgl_akhir,status,catatan) VALUES (?,?,?,?,?,?,?,?)")
            .bind(&b.paket).bind(&b.vendor).bind(b.nilai_kontrak).bind(b.realisasi).bind(&tm).bind(&ta).bind(&b.status).bind(&b.catatan)
            .execute(&s.pool).await.map_err(db_err)?; }
    }
    Ok(Json(json!({"ok": true})))
}
pub async fn pengadaan_del(u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    sqlx::query("DELETE FROM simrscb_pengadaan WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── ASET ─────────────────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct Aset {
    pub id: i64, pub nama: String, pub kategori: String, pub kondisi: String, pub nilai: f64,
    pub perlu_kalibrasi: i64, pub tgl_kalibrasi: Option<String>, pub tgl_kalibrasi_berikut: Option<String>,
    pub catatan: String, pub sisa_hari_kalibrasi: Option<i64>,
}
#[derive(Deserialize)]
pub struct AsetBody {
    #[serde(default)] pub id: Option<i64>,
    pub nama: String, #[serde(default)] pub kategori: String,
    #[serde(default)] pub kondisi: String, #[serde(default)] pub nilai: f64,
    #[serde(default)] pub perlu_kalibrasi: i64,
    #[serde(default)] pub tgl_kalibrasi: Option<String>, #[serde(default)] pub tgl_kalibrasi_berikut: Option<String>,
    #[serde(default)] pub catatan: String,
}
pub async fn aset_list(State(s): State<AppState>) -> Result<Json<Vec<Aset>>, (StatusCode, Json<Value>)> {
    let rows = sqlx::query_as::<_, Aset>(
        "SELECT id, IFNULL(nama,'') nama, IFNULL(kategori,'') kategori, IFNULL(kondisi,'') kondisi, nilai, \
                IFNULL(perlu_kalibrasi,0) perlu_kalibrasi, DATE_FORMAT(tgl_kalibrasi,'%Y-%m-%d') tgl_kalibrasi, \
                DATE_FORMAT(tgl_kalibrasi_berikut,'%Y-%m-%d') tgl_kalibrasi_berikut, IFNULL(catatan,'') catatan, \
                CASE WHEN tgl_kalibrasi_berikut IS NULL THEN NULL ELSE DATEDIFF(tgl_kalibrasi_berikut, CURDATE()) END AS sisa_hari_kalibrasi \
         FROM simrscb_aset ORDER BY tgl_kalibrasi_berikut IS NULL, tgl_kalibrasi_berikut ASC, id DESC"
    ).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
pub async fn aset_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<AsetBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    let tk = b.tgl_kalibrasi.filter(|x| !x.is_empty());
    let tkb = b.tgl_kalibrasi_berikut.filter(|x| !x.is_empty());
    match b.id {
        Some(id) => { sqlx::query("UPDATE simrscb_aset SET nama=?,kategori=?,kondisi=?,nilai=?,perlu_kalibrasi=?,tgl_kalibrasi=?,tgl_kalibrasi_berikut=?,catatan=? WHERE id=?")
            .bind(&b.nama).bind(&b.kategori).bind(&b.kondisi).bind(b.nilai).bind(b.perlu_kalibrasi).bind(&tk).bind(&tkb).bind(&b.catatan).bind(id)
            .execute(&s.pool).await.map_err(db_err)?; }
        None => { sqlx::query("INSERT INTO simrscb_aset (nama,kategori,kondisi,nilai,perlu_kalibrasi,tgl_kalibrasi,tgl_kalibrasi_berikut,catatan) VALUES (?,?,?,?,?,?,?,?)")
            .bind(&b.nama).bind(&b.kategori).bind(&b.kondisi).bind(b.nilai).bind(b.perlu_kalibrasi).bind(&tk).bind(&tkb).bind(&b.catatan)
            .execute(&s.pool).await.map_err(db_err)?; }
    }
    Ok(Json(json!({"ok": true})))
}
pub async fn aset_del(u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    sqlx::query("DELETE FROM simrscb_aset WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── BELANJA BLUD ─────────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct Belanja { pub id: i64, pub jenis: String, pub uraian: String, pub pagu: f64, pub realisasi: f64 }
#[derive(Deserialize)]
pub struct BelanjaBody {
    #[serde(default)] pub id: Option<i64>,
    #[serde(default)] pub jenis: String, #[serde(default)] pub uraian: String,
    #[serde(default)] pub pagu: f64, #[serde(default)] pub realisasi: f64,
}
pub async fn belanja_list(State(s): State<AppState>) -> Result<Json<Vec<Belanja>>, (StatusCode, Json<Value>)> {
    let rows = sqlx::query_as::<_, Belanja>(
        "SELECT id, IFNULL(jenis,'') jenis, IFNULL(uraian,'') uraian, pagu, realisasi FROM simrscb_belanja_blud ORDER BY jenis, id DESC"
    ).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
pub async fn belanja_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<BelanjaBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    match b.id {
        Some(id) => { sqlx::query("UPDATE simrscb_belanja_blud SET jenis=?,uraian=?,pagu=?,realisasi=? WHERE id=?")
            .bind(&b.jenis).bind(&b.uraian).bind(b.pagu).bind(b.realisasi).bind(id).execute(&s.pool).await.map_err(db_err)?; }
        None => { sqlx::query("INSERT INTO simrscb_belanja_blud (jenis,uraian,pagu,realisasi) VALUES (?,?,?,?)")
            .bind(&b.jenis).bind(&b.uraian).bind(b.pagu).bind(b.realisasi).execute(&s.pool).await.map_err(db_err)?; }
    }
    Ok(Json(json!({"ok": true})))
}
pub async fn belanja_del(u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    sqlx::query("DELETE FROM simrscb_belanja_blud WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── RINGKASAN (untuk dashboard) ──────────────────────────────────────────────
#[derive(Serialize)]
pub struct InputSummary {
    pub pengadaan_paket: i64, pub pengadaan_nilai: f64, pub pengadaan_realisasi: f64, pub kontrak_hampir_habis: i64,
    pub aset_total: i64, pub aset_baik: i64, pub aset_rusak: i64, pub kalibrasi_due: i64, pub aset_nilai: f64,
    pub belanja_pagu: f64, pub belanja_realisasi: f64,
}
pub async fn input_summary(State(s): State<AppState>) -> Json<InputSummary> {
    let p = &s.pool;
    let sc = |sql: &'static str| async move { let r: (f64,) = sqlx::query_as(sql).fetch_one(p).await.unwrap_or((0.0,)); r.0 };
    let sci = |sql: &'static str| async move { let r: (i64,) = sqlx::query_as(sql).fetch_one(p).await.unwrap_or((0,)); r.0 };
    Json(InputSummary {
        pengadaan_paket: sci("SELECT COUNT(*) FROM simrscb_pengadaan").await,
        pengadaan_nilai: sc("SELECT IFNULL(SUM(nilai_kontrak),0) FROM simrscb_pengadaan").await,
        pengadaan_realisasi: sc("SELECT IFNULL(SUM(realisasi),0) FROM simrscb_pengadaan").await,
        kontrak_hampir_habis: sci("SELECT COUNT(*) FROM simrscb_pengadaan WHERE tgl_akhir IS NOT NULL AND DATEDIFF(tgl_akhir,CURDATE()) BETWEEN 0 AND 30 AND status<>'Selesai'").await,
        aset_total: sci("SELECT COUNT(*) FROM simrscb_aset").await,
        aset_baik: sci("SELECT COUNT(*) FROM simrscb_aset WHERE kondisi='Baik'").await,
        aset_rusak: sci("SELECT COUNT(*) FROM simrscb_aset WHERE kondisi LIKE 'Rusak%'").await,
        kalibrasi_due: sci("SELECT COUNT(*) FROM simrscb_aset WHERE perlu_kalibrasi=1 AND (tgl_kalibrasi_berikut IS NULL OR tgl_kalibrasi_berikut <= CURDATE())").await,
        aset_nilai: sc("SELECT IFNULL(SUM(nilai),0) FROM simrscb_aset").await,
        belanja_pagu: sc("SELECT IFNULL(SUM(pagu),0) FROM simrscb_belanja_blud").await,
        belanja_realisasi: sc("SELECT IFNULL(SUM(realisasi),0) FROM simrscb_belanja_blud").await,
    })
}
