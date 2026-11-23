// PPS — Perencanaan Perbaikan Strategis (pasca-survei / self-assessment).
// Per rekomendasi EP STARKES: langkah pemenuhan, metode, indikator, PIC, waktu, progres.

use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB pps: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if has_perm(u, "akreditasi_edit") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Perlu izin akreditasi_edit"})))) }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Pps {
    pub id: i32, pub kd_ep: Option<String>, pub bab: Option<String>, pub standar: Option<String>,
    pub rekomendasi: Option<String>, pub langkah_pemenuhan: Option<String>, pub metode: Option<String>,
    pub indikator_pencapaian: Option<String>, pub sasaran: Option<String>, pub pic: Option<String>,
    pub waktu_target: Option<String>, pub keterangan: Option<String>, pub status: String,
    pub progres: i32, pub updated_at: Option<String>,
}
const COLS: &str = "id, kd_ep, bab, standar, rekomendasi, langkah_pemenuhan, metode, indikator_pencapaian,
  sasaran, pic, DATE_FORMAT(waktu_target,'%Y-%m-%d') AS waktu_target, keterangan, status, progres,
  DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at";

#[derive(Deserialize)]
pub struct ListQ { pub bab: Option<String>, pub status: Option<String>, pub q: Option<String> }
pub async fn list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQ>)
  -> Result<Json<Vec<Pps>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!(
        "SELECT {} FROM simrscb_pps
         WHERE (? IS NULL OR bab=?) AND (? IS NULL OR status=?)
           AND (? IS NULL OR kd_ep LIKE ? OR rekomendasi LIKE ? OR langkah_pemenuhan LIKE ?)
         ORDER BY bab, kd_ep, id", COLS);
    let rows: Vec<Pps> = sqlx::query_as(&sql)
        .bind(&q.bab).bind(&q.bab).bind(&q.status).bind(&q.status)
        .bind(&qs).bind(&qs).bind(&qs).bind(&qs)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
pub async fn get_one(_u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Pps>, (StatusCode, Json<Value>)> {
    let row: Option<Pps> = sqlx::query_as(&format!("SELECT {} FROM simrscb_pps WHERE id=?", COLS))
        .bind(id).fetch_optional(&s.pool).await.map_err(db_err)?;
    row.map(Json).ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"tidak ditemukan"}))))
}

#[derive(Deserialize)]
pub struct Body {
    #[serde(default)] pub kd_ep: Option<String>, #[serde(default)] pub bab: Option<String>,
    #[serde(default)] pub standar: Option<String>, #[serde(default)] pub rekomendasi: Option<String>,
    #[serde(default)] pub langkah_pemenuhan: Option<String>, #[serde(default)] pub metode: Option<String>,
    #[serde(default)] pub indikator_pencapaian: Option<String>, #[serde(default)] pub sasaran: Option<String>,
    #[serde(default)] pub pic: Option<String>, #[serde(default)] pub waktu_target: Option<String>,
    #[serde(default)] pub keterangan: Option<String>, #[serde(default)] pub status: Option<String>,
    #[serde(default)] pub progres: Option<i32>,
}
pub async fn create(u: AuthUser, State(s): State<AppState>, Json(b): Json<Body>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    // auto-isi bab/standar dari kd_ep bila ada
    let (mut bab, mut standar) = (b.bab.clone(), b.standar.clone());
    if bab.is_none() {
        if let Some(kd) = b.kd_ep.as_deref() {
            if let Ok(Some(r)) = sqlx::query_as::<_, (Option<String>, Option<String>)>(
                "SELECT bab, standar FROM starkes_ep WHERE kd_ep=? LIMIT 1").bind(kd).fetch_optional(&s.pool).await {
                bab = r.0; standar = r.1;
            }
        }
    }
    let r = sqlx::query(
        "INSERT INTO simrscb_pps (kd_ep,bab,standar,rekomendasi,langkah_pemenuhan,metode,indikator_pencapaian,sasaran,pic,waktu_target,keterangan,status,progres,updated_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.kd_ep).bind(&bab).bind(&standar).bind(&b.rekomendasi).bind(&b.langkah_pemenuhan)
        .bind(&b.metode).bind(&b.indikator_pencapaian).bind(&b.sasaran).bind(&b.pic)
        .bind(b.waktu_target.filter(|x| !x.trim().is_empty())).bind(&b.keterangan)
        .bind(b.status.as_deref().unwrap_or("belum")).bind(b.progres.unwrap_or(0)).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<Body>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query(
        "UPDATE simrscb_pps SET kd_ep=?,bab=?,standar=?,rekomendasi=?,langkah_pemenuhan=?,metode=?,indikator_pencapaian=?,
           sasaran=?,pic=?,waktu_target=?,keterangan=?,status=COALESCE(?,status),progres=COALESCE(?,progres),updated_by=? WHERE id=?")
        .bind(&b.kd_ep).bind(&b.bab).bind(&b.standar).bind(&b.rekomendasi).bind(&b.langkah_pemenuhan)
        .bind(&b.metode).bind(&b.indikator_pencapaian).bind(&b.sasaran).bind(&b.pic)
        .bind(b.waktu_target.filter(|x| !x.trim().is_empty())).bind(&b.keterangan)
        .bind(&b.status).bind(b.progres).bind(&u.0.kode).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_pps WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

pub async fn rekap(_u: AuthUser, State(s): State<AppState>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    #[derive(sqlx::FromRow, Serialize)]
    struct BabRow { bab: Option<String>, total: i64, belum: i64, proses: i64, tercapai: i64, avg_progres: Option<f64> }
    let per_bab: Vec<BabRow> = sqlx::query_as(
        "SELECT bab, CAST(COUNT(*) AS SIGNED) total,
                CAST(IFNULL(SUM(status='belum'),0) AS SIGNED) belum,
                CAST(IFNULL(SUM(status='proses'),0) AS SIGNED) proses,
                CAST(IFNULL(SUM(status='tercapai'),0) AS SIGNED) tercapai,
                CAST(AVG(progres) AS DOUBLE) avg_progres
         FROM simrscb_pps GROUP BY bab ORDER BY bab")
        .fetch_all(&s.pool).await.map_err(db_err)?;
    #[derive(sqlx::FromRow)]
    struct Tot { total: i64, tercapai: i64, avg: Option<f64> }
    let t: Tot = sqlx::query_as(
        "SELECT CAST(COUNT(*) AS SIGNED) total, CAST(IFNULL(SUM(status='tercapai'),0) AS SIGNED) tercapai, CAST(AVG(progres) AS DOUBLE) avg FROM simrscb_pps")
        .fetch_one(&s.pool).await.unwrap_or(Tot{total:0,tercapai:0,avg:None});
    Ok(Json(json!({"total": t.total, "tercapai": t.tercapai, "avg_progres": t.avg.unwrap_or(0.0), "per_bab": per_bab})))
}
