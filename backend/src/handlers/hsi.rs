// HSI — Hospital Safety Index (penilaian keamanan RS terhadap bencana).
// Kerangka: item checklist (modul 1 struktural / 2 non-struktural / 3 manajemen) →
// sesi penilaian → nilai per item (rendah/sedang/tinggi + bobot) → index & klasifikasi A/B/C.

use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB hsi: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if has_perm(u, "akreditasi_edit") || has_perm(u, "mutu_edit") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Perlu izin akreditasi_edit/mutu_edit"})))) }
}
fn nilai_tingkat(t: &str) -> f64 { match t { "tinggi" => 1.0, "sedang" => 0.5, _ => 0.0 } }
fn klasifikasi(idx: f64) -> &'static str {
    if idx >= 0.66 { "A" } else if idx >= 0.36 { "B" } else { "C" }
}

// ── Master item ──────────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Item { pub id: i32, pub modul: i32, pub sub_modul: Option<String>, pub kode: Option<String>, pub uraian: String, pub bobot: f64, pub urutan: i32 }
pub async fn item_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<std::collections::HashMap<String,String>>)
  -> Result<Json<Vec<Item>>, (StatusCode, Json<Value>)> {
    let modul = q.get("modul").and_then(|x| x.parse::<i32>().ok());
    let rows: Vec<Item> = sqlx::query_as(
        "SELECT id, modul, sub_modul, kode, uraian, bobot, urutan FROM simrscb_hsi_item
         WHERE (? IS NULL OR modul=?) ORDER BY modul, urutan, id")
        .bind(modul).bind(modul).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct ItemBody { pub modul: i32, #[serde(default)] pub sub_modul: Option<String>, #[serde(default)] pub kode: Option<String>, pub uraian: String, #[serde(default)] pub bobot: Option<f64>, #[serde(default)] pub urutan: Option<i32> }
pub async fn item_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<ItemBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let r = sqlx::query("INSERT INTO simrscb_hsi_item (modul,sub_modul,kode,uraian,bobot,urutan) VALUES (?,?,?,?,?,?)")
        .bind(b.modul).bind(&b.sub_modul).bind(&b.kode).bind(b.uraian.trim()).bind(b.bobot.unwrap_or(1.0)).bind(b.urutan.unwrap_or(0))
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn item_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<ItemBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("UPDATE simrscb_hsi_item SET modul=?,sub_modul=?,kode=?,uraian=?,bobot=?,urutan=? WHERE id=?")
        .bind(b.modul).bind(&b.sub_modul).bind(&b.kode).bind(b.uraian.trim()).bind(b.bobot.unwrap_or(1.0)).bind(b.urutan.unwrap_or(0)).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn item_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_hsi_item WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Sesi penilaian ───────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Penilaian { pub id: i32, pub nama: String, pub tanggal: Option<String>, pub penilai: Option<String>, pub keterangan: Option<String>, pub indeks: Option<f64>, pub klasifikasi: Option<String> }
pub async fn pen_list(_u: AuthUser, State(s): State<AppState>)
  -> Result<Json<Vec<Penilaian>>, (StatusCode, Json<Value>)> {
    let rows: Vec<Penilaian> = sqlx::query_as(
        "SELECT id, nama, DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal, penilai, keterangan, indeks, klasifikasi
         FROM simrscb_hsi_penilaian ORDER BY tanggal DESC, id DESC")
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct PenBody { pub nama: String, #[serde(default)] pub tanggal: Option<String>, #[serde(default)] pub penilai: Option<String>, #[serde(default)] pub keterangan: Option<String> }
pub async fn pen_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<PenBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let r = sqlx::query("INSERT INTO simrscb_hsi_penilaian (nama,tanggal,penilai,keterangan) VALUES (?,COALESCE(?,CURDATE()),?,?)")
        .bind(b.nama.trim()).bind(b.tanggal.filter(|x| !x.trim().is_empty()))
        .bind(b.penilai.as_deref().filter(|x| !x.trim().is_empty()).unwrap_or(&u.0.nama)).bind(&b.keterangan)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn pen_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_hsi_nilai WHERE penilaian_id=?").bind(id).execute(&s.pool).await.ok();
    sqlx::query("DELETE FROM simrscb_hsi_penilaian WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Nilai per item (upsert) + hitung ulang index ────────────────────────────
#[derive(Deserialize)]
pub struct NilaiBody { pub penilaian_id: i32, pub item_id: i32, pub tingkat: String, #[serde(default)] pub catatan: Option<String> }
pub async fn nilai_upsert(u: AuthUser, State(s): State<AppState>, Json(b): Json<NilaiBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query(
        "INSERT INTO simrscb_hsi_nilai (penilaian_id,item_id,tingkat,catatan) VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE tingkat=VALUES(tingkat), catatan=VALUES(catatan)")
        .bind(b.penilaian_id).bind(b.item_id).bind(&b.tingkat).bind(&b.catatan)
        .execute(&s.pool).await.map_err(db_err)?;
    recompute(&s.pool, b.penilaian_id).await;
    Ok(Json(json!({"ok": true})))
}
async fn recompute(pool: &sqlx::MySqlPool, pid: i32) {
    let rows: Vec<(f64, String)> = sqlx::query_as(
        "SELECT i.bobot, n.tingkat FROM simrscb_hsi_nilai n JOIN simrscb_hsi_item i ON i.id=n.item_id WHERE n.penilaian_id=?")
        .bind(pid).fetch_all(pool).await.unwrap_or_default();
    let (mut num, mut den) = (0.0f64, 0.0f64);
    for (bobot, t) in &rows { num += bobot * nilai_tingkat(t); den += bobot; }
    let idx = if den > 0.0 { num / den } else { 0.0 };
    let _ = sqlx::query("UPDATE simrscb_hsi_penilaian SET indeks=?, klasifikasi=? WHERE id=?")
        .bind(idx).bind(klasifikasi(idx)).bind(pid).execute(pool).await;
}

// ── Detail + rekap sesi ──────────────────────────────────────────────────────
pub async fn pen_detail(_u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let pen: Option<Penilaian> = sqlx::query_as(
        "SELECT id, nama, DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal, penilai, keterangan, indeks, klasifikasi FROM simrscb_hsi_penilaian WHERE id=?")
        .bind(id).fetch_optional(&s.pool).await.map_err(db_err)?;
    let pen = pen.ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"tidak ditemukan"}))))?;
    #[derive(sqlx::FromRow, Serialize)]
    struct IR { id: i32, modul: i32, sub_modul: Option<String>, kode: Option<String>, uraian: String, bobot: f64, tingkat: Option<String>, catatan: Option<String> }
    let items: Vec<IR> = sqlx::query_as(
        "SELECT i.id, i.modul, i.sub_modul, i.kode, i.uraian, i.bobot, n.tingkat, n.catatan
         FROM simrscb_hsi_item i LEFT JOIN simrscb_hsi_nilai n ON n.item_id=i.id AND n.penilaian_id=?
         ORDER BY i.modul, i.urutan, i.id")
        .bind(id).fetch_all(&s.pool).await.map_err(db_err)?;
    // rekap per modul
    #[derive(sqlx::FromRow, Serialize)]
    struct MR { modul: i32, jml: i64, terisi: i64 }
    let per_modul: Vec<MR> = sqlx::query_as(
        "SELECT i.modul, CAST(COUNT(*) AS SIGNED) jml,
                CAST(SUM(CASE WHEN n.tingkat IS NOT NULL THEN 1 ELSE 0 END) AS SIGNED) terisi
         FROM simrscb_hsi_item i LEFT JOIN simrscb_hsi_nilai n ON n.item_id=i.id AND n.penilaian_id=?
         GROUP BY i.modul ORDER BY i.modul")
        .bind(id).fetch_all(&s.pool).await.unwrap_or_default();
    Ok(Json(json!({"penilaian": pen, "items": items, "per_modul": per_modul})))
}
