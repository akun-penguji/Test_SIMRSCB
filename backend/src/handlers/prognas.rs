// Prognas — Program Nasional (PONEK/TB/HIV/Stunting/Geriatri/KB). Register kasus + rekap.
use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB prognas: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if u.0.is_admin || has_perm(u, "prognas_edit") || has_perm(u, "mutu_edit") || has_perm(u, "akreditasi_edit") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Perlu izin prognas_edit / mutu_edit"})))) }
}

#[derive(Serialize, sqlx::FromRow)]
pub struct PrognasRow {
    pub id: i32, pub tanggal: Option<String>, pub program: String, pub no_rawat: Option<String>, pub no_rkm_medis: Option<String>,
    pub nama_pasien: Option<String>, pub umur: Option<String>, pub jenis_kelamin: Option<String>, pub unit: Option<String>,
    pub diagnosa: Option<String>, pub status_kasus: Option<String>, pub tindakan: Option<String>, pub hasil: Option<String>, pub keterangan: Option<String>, pub created_at: Option<String>,
}
const COLS: &str = "id, DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, program, no_rawat, no_rkm_medis, nama_pasien, umur, jenis_kelamin, unit, diagnosa, status_kasus, tindakan, hasil, keterangan, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') created_at";
#[derive(Deserialize)]
pub struct ListQ { pub tahun: Option<i32>, pub bulan: Option<i32>, pub program: Option<String>, pub q: Option<String> }
pub async fn list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQ>)
  -> Result<Json<Vec<PrognasRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!("SELECT {COLS} FROM simrscb_prognas \
        WHERE (? IS NULL OR YEAR(tanggal)=?) AND (? IS NULL OR MONTH(tanggal)=?) AND (? IS NULL OR program=?) \
          AND (? IS NULL OR nama_pasien LIKE ? OR diagnosa LIKE ?) ORDER BY tanggal DESC, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql).bind(q.tahun).bind(q.tahun).bind(q.bulan).bind(q.bulan).bind(&q.program).bind(&q.program).bind(&qs).bind(&qs).bind(&qs)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct Body {
    pub tanggal: String, #[serde(default)] pub program: Option<String>, #[serde(default)] pub no_rawat: Option<String>, #[serde(default)] pub no_rkm_medis: Option<String>,
    #[serde(default)] pub nama_pasien: Option<String>, #[serde(default)] pub umur: Option<String>, #[serde(default)] pub jenis_kelamin: Option<String>, #[serde(default)] pub unit: Option<String>,
    #[serde(default)] pub diagnosa: Option<String>, #[serde(default)] pub status_kasus: Option<String>, #[serde(default)] pub tindakan: Option<String>, #[serde(default)] pub hasil: Option<String>, #[serde(default)] pub keterangan: Option<String>,
}
pub async fn create(u: AuthUser, State(s): State<AppState>, Json(b): Json<Body>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let r = sqlx::query("INSERT INTO simrscb_prognas (tanggal,program,no_rawat,no_rkm_medis,nama_pasien,umur,jenis_kelamin,unit,diagnosa,status_kasus,tindakan,hasil,keterangan,petugas_nip) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.tanggal).bind(b.program.as_deref().unwrap_or("TB")).bind(&b.no_rawat).bind(&b.no_rkm_medis).bind(&b.nama_pasien)
        .bind(&b.umur).bind(&b.jenis_kelamin).bind(&b.unit).bind(&b.diagnosa).bind(&b.status_kasus).bind(&b.tindakan).bind(&b.hasil).bind(&b.keterangan).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<Body>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("UPDATE simrscb_prognas SET tanggal=?,program=COALESCE(?,program),no_rawat=?,no_rkm_medis=?,nama_pasien=?,umur=?,jenis_kelamin=?,unit=?,diagnosa=?,status_kasus=?,tindakan=?,hasil=?,keterangan=?,updated_at=NOW() WHERE id=?")
        .bind(&b.tanggal).bind(&b.program).bind(&b.no_rawat).bind(&b.no_rkm_medis).bind(&b.nama_pasien)
        .bind(&b.umur).bind(&b.jenis_kelamin).bind(&b.unit).bind(&b.diagnosa).bind(&b.status_kasus).bind(&b.tindakan).bind(&b.hasil).bind(&b.keterangan).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_prognas WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
#[derive(Deserialize)]
pub struct RekapQ { pub tahun: Option<i32> }
pub async fn rekap(_u: AuthUser, State(s): State<AppState>, Query(q): Query<RekapQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2026));
    #[derive(sqlx::FromRow)] struct C { k: Option<String>, n: i64 }
    let per_program: Vec<C> = sqlx::query_as("SELECT program k, COUNT(*) n FROM simrscb_prognas WHERE YEAR(tanggal)=? GROUP BY program ORDER BY n DESC").bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    #[derive(sqlx::FromRow)] struct M { program: String, bulan: i32, n: i64 }
    let per_bulan: Vec<M> = sqlx::query_as("SELECT program, MONTH(tanggal) bulan, COUNT(*) n FROM simrscb_prognas WHERE YEAR(tanggal)=? GROUP BY program, MONTH(tanggal)").bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_prognas WHERE YEAR(tanggal)=?").bind(tahun).fetch_one(&s.pool).await.unwrap_or(0);
    Ok(Json(json!({
        "tahun": tahun, "total": total,
        "per_program": per_program.iter().map(|c| json!({"label": c.k, "total": c.n})).collect::<Vec<_>>(),
        "per_bulan": per_bulan.iter().map(|m| json!({"program": m.program, "bulan": m.bulan, "total": m.n})).collect::<Vec<_>>(),
    })))
}
