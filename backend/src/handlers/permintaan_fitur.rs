// Permintaan Fitur SIMRS — usulan pengembangan dari unit + kelola tim pengembang.
// Voting (dukungan) antar-user. Kelola pakai izin lapor_it_kelola.

use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB permintaan_fitur: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn require_kelola(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if has_perm(u, "lapor_it_kelola") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pengelola (izin lapor_it_kelola)."}))))}
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FiturRow {
    pub id:            i32,
    pub no_tiket:      Option<String>,
    pub tanggal:       String,
    pub modul:         String,
    pub judul:         String,
    pub deskripsi:     Option<String>,
    pub manfaat:       Option<String>,
    pub prioritas:     String,
    pub pengusul:      Option<String>,
    pub unit:          Option<String>,
    pub kontak:        Option<String>,
    pub foto:          Option<String>,
    pub status:        String,
    pub tanggapan:     Option<String>,
    pub pic_nama:      Option<String>,
    pub target:        Option<String>,
    pub tanggal_selesai: Option<String>,
    pub vote_count:    i64,
    pub sudah_vote:    i64,
    pub created_at:    Option<String>,
}

fn columns(user_kode: &str) -> String {
    let k = user_kode.replace('\'', "''"); // kode dari JWT; escape kutip
    format!("
      f.id, f.no_tiket,
      DATE_FORMAT(f.tanggal,'%Y-%m-%d %H:%i:%s') AS tanggal,
      f.modul, f.judul, f.deskripsi, f.manfaat, f.prioritas, f.pengusul, f.unit, f.kontak, f.foto,
      f.status, f.tanggapan, f.pic_nama, f.target,
      DATE_FORMAT(f.tanggal_selesai,'%Y-%m-%d %H:%i:%s') AS tanggal_selesai,
      CAST(f.vote_count AS SIGNED) AS vote_count,
      CAST(EXISTS(SELECT 1 FROM simrscb_permintaan_fitur_vote v WHERE v.fitur_id=f.id AND v.user_kode='{k}') AS SIGNED) AS sudah_vote,
      DATE_FORMAT(f.created_at,'%Y-%m-%d %H:%i:%s') AS created_at
    ")
}

#[derive(Deserialize)]
pub struct ListQuery {
    pub tahun: Option<i32>, pub status: Option<String>, pub modul: Option<String>,
    pub prioritas: Option<String>, pub q: Option<String>, pub sort: Option<String>,
}
pub async fn list(u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQuery>)
  -> Result<Json<Vec<FiturRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|s| !s.trim().is_empty()).map(|s| format!("%{}%", s.trim()));
    let order = match q.sort.as_deref() {
        Some("populer") => "f.vote_count DESC, f.tanggal DESC",
        _ => "f.tanggal DESC, f.id DESC",
    };
    let sql = format!(
        "SELECT {} FROM simrscb_permintaan_fitur f
         WHERE (? IS NULL OR YEAR(f.tanggal)=?)
           AND (? IS NULL OR f.status=?)
           AND (? IS NULL OR f.modul=?)
           AND (? IS NULL OR f.prioritas=?)
           AND (? IS NULL OR f.judul LIKE ? OR f.deskripsi LIKE ? OR f.pengusul LIKE ? OR f.no_tiket LIKE ?)
         ORDER BY {} LIMIT 1000", columns(&u.0.kode), order);
    let rows: Vec<FiturRow> = sqlx::query_as(&sql)
        .bind(q.tahun).bind(q.tahun)
        .bind(&q.status).bind(&q.status)
        .bind(&q.modul).bind(&q.modul)
        .bind(&q.prioritas).bind(&q.prioritas)
        .bind(&qs).bind(&qs).bind(&qs).bind(&qs).bind(&qs)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

pub async fn get_one(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<FiturRow>, (StatusCode, Json<Value>)> {
    let sql = format!("SELECT {} FROM simrscb_permintaan_fitur f WHERE f.id=?", columns(&u.0.kode));
    let row: Option<FiturRow> = sqlx::query_as(&sql).bind(id).fetch_optional(&s.pool).await.map_err(db_err)?;
    row.map(Json).ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"tidak ditemukan"}))))
}

async fn gen_no_tiket(pool: &sqlx::MySqlPool, id: u64) {
    let _ = sqlx::query(
        "UPDATE simrscb_permintaan_fitur SET no_tiket=CONCAT('FR-', DATE_FORMAT(tanggal,'%Y%m'), '-', LPAD(id,4,'0')) WHERE id=? AND (no_tiket IS NULL OR no_tiket='')")
        .bind(id).execute(pool).await;
}

#[derive(Deserialize)]
pub struct CreateBody {
    pub judul: String,
    #[serde(default)] pub modul: Option<String>,
    #[serde(default)] pub deskripsi: Option<String>,
    #[serde(default)] pub manfaat: Option<String>,
    #[serde(default)] pub prioritas: Option<String>,
    #[serde(default)] pub pengusul: Option<String>,
    #[serde(default)] pub unit: Option<String>,
    #[serde(default)] pub kontak: Option<String>,
    #[serde(default)] pub foto: Option<String>,
}
pub async fn create(u: AuthUser, State(s): State<AppState>, Json(b): Json<CreateBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.judul.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Judul wajib diisi"})))); }
    let r = sqlx::query(
        "INSERT INTO simrscb_permintaan_fitur
         (tanggal, modul, judul, deskripsi, manfaat, prioritas, pengusul, unit, kontak, foto, status, updated_by)
         VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'baru', ?)")
        .bind(b.modul.as_deref().filter(|x| !x.trim().is_empty()).unwrap_or("lainnya"))
        .bind(b.judul.trim()).bind(&b.deskripsi).bind(&b.manfaat)
        .bind(b.prioritas.as_deref().unwrap_or("sedang"))
        .bind(b.pengusul.as_deref().filter(|x| !x.trim().is_empty()).unwrap_or(&u.0.nama))
        .bind(&b.unit).bind(&b.kontak).bind(&b.foto).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    gen_no_tiket(&s.pool, r.last_insert_id()).await;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("INSERT permintaan_fitur judul={:?}", b.judul)).await;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}

#[derive(Deserialize)]
pub struct UpdateBody {
    #[serde(default)] pub status: Option<String>,
    #[serde(default)] pub prioritas: Option<String>,
    #[serde(default)] pub modul: Option<String>,
    #[serde(default)] pub tanggapan: Option<String>,
    #[serde(default)] pub pic_nama: Option<String>,
    #[serde(default)] pub target: Option<String>,
    #[serde(default)] pub judul: Option<String>,
    #[serde(default)] pub deskripsi: Option<String>,
    #[serde(default)] pub manfaat: Option<String>,
}
pub async fn update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<UpdateBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_kelola(&u)?;
    let set_selesai = b.status.as_deref() == Some("selesai");
    sqlx::query(
        "UPDATE simrscb_permintaan_fitur SET
           status=COALESCE(?, status), prioritas=COALESCE(?, prioritas), modul=COALESCE(?, modul),
           tanggapan=COALESCE(?, tanggapan), pic_nama=COALESCE(?, pic_nama), target=COALESCE(?, target),
           judul=COALESCE(?, judul), deskripsi=COALESCE(?, deskripsi), manfaat=COALESCE(?, manfaat),
           tanggal_selesai = CASE WHEN ?=1 AND tanggal_selesai IS NULL THEN NOW()
                                  WHEN ? IS NOT NULL AND ?<>'selesai' THEN NULL ELSE tanggal_selesai END,
           updated_by=?
         WHERE id=?")
        .bind(&b.status).bind(&b.prioritas).bind(&b.modul)
        .bind(&b.tanggapan)
        .bind(b.pic_nama.as_deref().or(Some(u.0.nama.as_str())))
        .bind(&b.target).bind(&b.judul).bind(&b.deskripsi).bind(&b.manfaat)
        .bind(if set_selesai {1} else {0})
        .bind(&b.status).bind(&b.status)
        .bind(&u.0.kode).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("UPDATE permintaan_fitur id={} status={:?}", id, b.status)).await;
    Ok(Json(json!({"ok": true})))
}

pub async fn delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_kelola(&u)?;
    sqlx::query("DELETE FROM simrscb_permintaan_fitur_vote WHERE fitur_id=?").bind(id).execute(&s.pool).await.ok();
    sqlx::query("DELETE FROM simrscb_permintaan_fitur WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("DELETE permintaan_fitur id={}", id)).await;
    Ok(Json(json!({"ok": true})))
}

// Toggle vote (dukungan) — semua user login, 1x per usulan.
pub async fn vote(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let exists: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM simrscb_permintaan_fitur_vote WHERE fitur_id=? AND user_kode=? LIMIT 1")
        .bind(id).bind(&u.0.kode).fetch_optional(&s.pool).await.map_err(db_err)?;
    let voted;
    if exists.is_some() {
        sqlx::query("DELETE FROM simrscb_permintaan_fitur_vote WHERE fitur_id=? AND user_kode=?")
            .bind(id).bind(&u.0.kode).execute(&s.pool).await.map_err(db_err)?;
        voted = false;
    } else {
        sqlx::query("INSERT INTO simrscb_permintaan_fitur_vote (fitur_id, user_kode) VALUES (?, ?)")
            .bind(id).bind(&u.0.kode).execute(&s.pool).await.map_err(db_err)?;
        voted = true;
    }
    // sinkron vote_count
    sqlx::query(
        "UPDATE simrscb_permintaan_fitur SET vote_count=(SELECT COUNT(*) FROM simrscb_permintaan_fitur_vote WHERE fitur_id=?) WHERE id=?")
        .bind(id).bind(id).execute(&s.pool).await.map_err(db_err)?;
    let cnt: (i64,) = sqlx::query_as("SELECT CAST(vote_count AS SIGNED) FROM simrscb_permintaan_fitur WHERE id=?")
        .bind(id).fetch_one(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "voted": voted, "vote_count": cnt.0})))
}

// Impor usulan dari ekspor WhatsApp (reuse parser Lapor IT).
#[derive(Deserialize)]
pub struct ImportBody { pub text: String, #[serde(default)] pub apply: Option<bool>, #[serde(default)] pub modul: Option<String> }
pub async fn import_wa(u: AuthUser, State(s): State<AppState>, Json(b): Json<ImportBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_kelola(&u)?;
    let msgs = crate::handlers::lapor_it::parse_wa(&b.text);
    let apply = b.apply.unwrap_or(false);
    let modul = b.modul.as_deref().unwrap_or("lainnya");
    if !apply {
        let sample: Vec<&crate::handlers::lapor_it::ParsedMsg> = msgs.iter().take(15).collect();
        return Ok(Json(json!({"ok": true, "apply": false, "terdeteksi": msgs.len(), "contoh": sample})));
    }
    let mut baru = 0i64; let mut lewati = 0i64;
    for m in &msgs {
        let dup: Option<(i64,)> = sqlx::query_as(
            "SELECT id FROM simrscb_permintaan_fitur WHERE tanggal=? AND pengusul=? AND judul=? LIMIT 1")
            .bind(&m.tanggal).bind(&m.pelapor).bind(&m.judul).fetch_optional(&s.pool).await.ok().flatten();
        if dup.is_some() { lewati += 1; continue; }
        let r = sqlx::query(
            "INSERT INTO simrscb_permintaan_fitur (tanggal, modul, judul, deskripsi, prioritas, pengusul, status, updated_by)
             VALUES (?, ?, ?, ?, 'sedang', ?, 'baru', ?)")
            .bind(&m.tanggal).bind(modul).bind(&m.judul).bind(&m.deskripsi).bind(&m.pelapor).bind(&u.0.kode)
            .execute(&s.pool).await.map_err(db_err)?;
        gen_no_tiket(&s.pool, r.last_insert_id()).await;
        baru += 1;
    }
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("IMPORT WA permintaan_fitur baru={} lewati={}", baru, lewati)).await;
    Ok(Json(json!({"ok": true, "apply": true, "terdeteksi": msgs.len(), "baru": baru, "dilewati_duplikat": lewati})))
}

pub async fn rekap(_u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2026));
    #[derive(sqlx::FromRow)]
    struct Ag { total: i64, baru: i64, ditinjau: i64, disetujui: i64, dikerjakan: i64, selesai: i64, ditolak: i64 }
    let ag: Ag = sqlx::query_as(
        "SELECT CAST(COUNT(*) AS SIGNED) total,
                CAST(IFNULL(SUM(status='baru'),0) AS SIGNED) baru,
                CAST(IFNULL(SUM(status='ditinjau'),0) AS SIGNED) ditinjau,
                CAST(IFNULL(SUM(status='disetujui'),0) AS SIGNED) disetujui,
                CAST(IFNULL(SUM(status='dikerjakan'),0) AS SIGNED) dikerjakan,
                CAST(IFNULL(SUM(status='selesai'),0) AS SIGNED) selesai,
                CAST(IFNULL(SUM(status='ditolak'),0) AS SIGNED) ditolak
         FROM simrscb_permintaan_fitur WHERE YEAR(tanggal)=?").bind(tahun)
        .fetch_one(&s.pool).await.map_err(db_err)?;
    #[derive(sqlx::FromRow, Serialize)]
    struct KV { k: String, total: i64 }
    let per_modul: Vec<KV> = sqlx::query_as(
        "SELECT modul k, CAST(COUNT(*) AS SIGNED) total FROM simrscb_permintaan_fitur WHERE YEAR(tanggal)=? GROUP BY modul ORDER BY total DESC")
        .bind(tahun).fetch_all(&s.pool).await.unwrap_or_default();
    Ok(Json(json!({"tahun": tahun, "ringkasan": {
        "total": ag.total, "baru": ag.baru, "ditinjau": ag.ditinjau, "disetujui": ag.disetujui,
        "dikerjakan": ag.dikerjakan, "selesai": ag.selesai, "ditolak": ag.ditolak},
        "per_modul": per_modul})))
}
