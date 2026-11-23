// Penilaian Mandiri Akreditasi (Self-Assessment) — per Event/survei × EP STARKES.
// Skor 10/5/0/TDD + fakta-analisa + rekomendasi + jumlah bukti (dari akreditasi_dokumen).
// Terinspirasi alur SISMADAK (assessment_chapter_instrument), dibangun ulang utk simrscb.

use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB penilaian: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if has_perm(u, "akreditasi_edit") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Perlu izin akreditasi_edit"})))) }
}

// ── Event penilaian ──────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Event { pub id: i32, pub nama: String, pub jenis: String, pub tanggal: Option<String>, pub status: String, pub keterangan: Option<String> }
pub async fn ev_list(_u: AuthUser, State(s): State<AppState>)
  -> Result<Json<Vec<Event>>, (StatusCode, Json<Value>)> {
    let rows: Vec<Event> = sqlx::query_as(
        "SELECT id, nama, jenis, DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal, status, keterangan
         FROM simrscb_akreditasi_event ORDER BY tanggal DESC, id DESC")
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct EvBody { pub nama: String, #[serde(default)] pub jenis: Option<String>, #[serde(default)] pub tanggal: Option<String>, #[serde(default)] pub status: Option<String>, #[serde(default)] pub keterangan: Option<String> }
pub async fn ev_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<EvBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.nama.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Nama wajib"})))); }
    let r = sqlx::query("INSERT INTO simrscb_akreditasi_event (nama,jenis,tanggal,status,keterangan) VALUES (?,?,COALESCE(?,CURDATE()),?,?)")
        .bind(b.nama.trim()).bind(b.jenis.as_deref().unwrap_or("mandiri")).bind(b.tanggal.filter(|x| !x.trim().is_empty()))
        .bind(b.status.as_deref().unwrap_or("aktif")).bind(&b.keterangan)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn ev_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<EvBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("UPDATE simrscb_akreditasi_event SET nama=?, jenis=COALESCE(?,jenis), tanggal=?, status=COALESCE(?,status), keterangan=? WHERE id=?")
        .bind(b.nama.trim()).bind(&b.jenis).bind(b.tanggal.filter(|x| !x.trim().is_empty())).bind(&b.status).bind(&b.keterangan).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn ev_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_akreditasi_skor WHERE event_id=?").bind(id).execute(&s.pool).await.ok();
    sqlx::query("DELETE FROM simrscb_akreditasi_event WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Skor per EP (list by event + bab, join EP + jumlah bukti) ────────────────
#[derive(Deserialize)]
pub struct SkorListQ { pub event_id: i32, pub bab: String }
#[derive(Serialize, sqlx::FromRow)]
pub struct SkorRow {
    pub kd_ep: String, pub standar: Option<String>, pub nama_standar: Option<String>, pub deskripsi: Option<String>,
    pub nilai: Option<i32>, pub tdd: i8, pub fakta_analisa: Option<String>, pub rekomendasi: Option<String>,
    pub catatan: Option<String>, pub jml_bukti: i64,
}
pub async fn skor_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<SkorListQ>)
  -> Result<Json<Vec<SkorRow>>, (StatusCode, Json<Value>)> {
    let rows: Vec<SkorRow> = sqlx::query_as(
        "SELECT e.kd_ep, e.standar, e.nama_standar, e.deskripsi,
                s.nilai, IFNULL(s.tdd,0) AS tdd, s.fakta_analisa, s.rekomendasi, s.catatan,
                (SELECT COUNT(*) FROM simrscb_akreditasi_dokumen d WHERE d.kd_ep=e.kd_ep) AS jml_bukti
         FROM starkes_ep e
         LEFT JOIN simrscb_akreditasi_skor s ON s.kd_ep=e.kd_ep AND s.event_id=?
         WHERE e.bab=? AND e.status='aktif'
         ORDER BY CAST(SUBSTRING_INDEX(e.standar,' ',-1) AS DECIMAL(8,2)), CAST(e.nomor_ep AS UNSIGNED), e.kd_ep")
        .bind(q.event_id).bind(&q.bab).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct SkorBody {
    pub event_id: i32, pub kd_ep: String, #[serde(default)] pub nilai: Option<i32>, #[serde(default)] pub tdd: Option<i8>,
    #[serde(default)] pub fakta_analisa: Option<String>, #[serde(default)] pub rekomendasi: Option<String>, #[serde(default)] pub catatan: Option<String>,
}
pub async fn skor_upsert(u: AuthUser, State(s): State<AppState>, Json(b): Json<SkorBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let tdd = b.tdd.unwrap_or(0);
    let nilai = if tdd == 1 { None } else { b.nilai };
    sqlx::query(
        "INSERT INTO simrscb_akreditasi_skor (event_id,kd_ep,nilai,tdd,fakta_analisa,rekomendasi,catatan,updated_by)
         VALUES (?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE nilai=VALUES(nilai),tdd=VALUES(tdd),fakta_analisa=VALUES(fakta_analisa),
           rekomendasi=VALUES(rekomendasi),catatan=VALUES(catatan),updated_by=VALUES(updated_by)")
        .bind(b.event_id).bind(&b.kd_ep).bind(nilai).bind(tdd).bind(&b.fakta_analisa).bind(&b.rekomendasi).bind(&b.catatan).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Rekap capaian per bab (untuk 1 event) ────────────────────────────────────
pub async fn rekap(_u: AuthUser, State(s): State<AppState>, Path(event_id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    #[derive(sqlx::FromRow, Serialize)]
    struct BabRow {
        bab: Option<String>, kelompok: Option<i32>, nama_bab: Option<String>,
        total_ep: i64, dinilai: i64, tdd: i64, total_skor: i64, maks_skor: i64,
    }
    let per_bab: Vec<BabRow> = sqlx::query_as(
        "SELECT e.bab, MIN(e.kelompok) AS kelompok, MIN(e.nama_bab) AS nama_bab,
                CAST(COUNT(*) AS SIGNED) total_ep,
                CAST(SUM(CASE WHEN IFNULL(s.tdd,0)=0 AND s.nilai IS NOT NULL THEN 1 ELSE 0 END) AS SIGNED) dinilai,
                CAST(SUM(IFNULL(s.tdd,0)) AS SIGNED) tdd,
                CAST(SUM(CASE WHEN IFNULL(s.tdd,0)=1 THEN 0 ELSE IFNULL(s.nilai,0) END) AS SIGNED) total_skor,
                CAST(SUM(CASE WHEN IFNULL(s.tdd,0)=0 AND s.nilai IS NOT NULL THEN 10 ELSE 0 END) AS SIGNED) maks_skor
         FROM starkes_ep e LEFT JOIN simrscb_akreditasi_skor s ON s.kd_ep=e.kd_ep AND s.event_id=?
         WHERE e.status='aktif'
         GROUP BY e.bab
         ORDER BY MIN(e.urutan_bab), e.bab")
        .bind(event_id).fetch_all(&s.pool).await.map_err(db_err)?;
    // total keseluruhan
    let (tot_skor, tot_maks): (i64, i64) = per_bab.iter().fold((0, 0), |(a, b), r| (a + r.total_skor, b + r.maks_skor));
    let capaian_total = if tot_maks > 0 { tot_skor as f64 / tot_maks as f64 * 100.0 } else { 0.0 };
    let out: Vec<Value> = per_bab.iter().map(|r| {
        let cap = if r.maks_skor > 0 { r.total_skor as f64 / r.maks_skor as f64 * 100.0 } else { 0.0 };
        json!({"bab": r.bab, "kelompok": r.kelompok, "nama_bab": r.nama_bab, "total_ep": r.total_ep,
               "dinilai": r.dinilai, "tdd": r.tdd, "capaian": cap})
    }).collect();
    Ok(Json(json!({"event_id": event_id, "capaian_total": capaian_total, "per_bab": out})))
}
