// SKP — audit kepatuhan 6 Sasaran Keselamatan Pasien. CRUD + dashboard per sasaran.
// SKP5 (Kebersihan Tangan) juga menarik data audit dari modul PPI bila ada.
use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB skp: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if u.0.is_admin || has_perm(u, "skp_edit") || has_perm(u, "mutu_edit") || has_perm(u, "akreditasi_edit") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Perlu izin skp_edit / mutu_edit"})))) }
}

#[derive(Serialize, sqlx::FromRow)]
pub struct SkpRow {
    pub id: i32, pub tanggal: Option<String>, pub sasaran: i32, pub indikator: Option<String>, pub unit: Option<String>,
    pub jml_kesempatan: i32, pub jml_patuh: i32, pub kepatuhan: Option<f64>, pub auditor: Option<String>, pub catatan: Option<String>, pub created_at: Option<String>,
}
const COLS: &str = "id, DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, sasaran, indikator, unit, jml_kesempatan, jml_patuh, kepatuhan, auditor, catatan, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') created_at";
#[derive(Deserialize)]
pub struct ListQ { pub tahun: Option<i32>, pub bulan: Option<i32>, pub sasaran: Option<i32>, pub unit: Option<String> }
pub async fn list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQ>)
  -> Result<Json<Vec<SkpRow>>, (StatusCode, Json<Value>)> {
    let sql = format!("SELECT {COLS} FROM simrscb_skp_audit \
        WHERE (? IS NULL OR YEAR(tanggal)=?) AND (? IS NULL OR MONTH(tanggal)=?) AND (? IS NULL OR sasaran=?) AND (? IS NULL OR unit=?) \
        ORDER BY tanggal DESC, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql).bind(q.tahun).bind(q.tahun).bind(q.bulan).bind(q.bulan).bind(q.sasaran).bind(q.sasaran).bind(&q.unit).bind(&q.unit)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct Body {
    pub tanggal: String, #[serde(default)] pub sasaran: i32, #[serde(default)] pub indikator: Option<String>, #[serde(default)] pub unit: Option<String>,
    #[serde(default)] pub jml_kesempatan: i32, #[serde(default)] pub jml_patuh: i32, #[serde(default)] pub auditor: Option<String>, #[serde(default)] pub catatan: Option<String>,
}
fn kepatuhan(b: &Body) -> Option<f64> { if b.jml_kesempatan > 0 { Some(b.jml_patuh as f64 * 100.0 / b.jml_kesempatan as f64) } else { None } }
pub async fn create(u: AuthUser, State(s): State<AppState>, Json(b): Json<Body>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let k = kepatuhan(&b);
    let sasaran = if (1..=6).contains(&b.sasaran) { b.sasaran } else { 1 };
    let r = sqlx::query("INSERT INTO simrscb_skp_audit (tanggal,sasaran,indikator,unit,jml_kesempatan,jml_patuh,kepatuhan,auditor,catatan,petugas_nip) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.tanggal).bind(sasaran).bind(&b.indikator).bind(&b.unit).bind(b.jml_kesempatan).bind(b.jml_patuh).bind(k).bind(&b.auditor).bind(&b.catatan).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id(), "kepatuhan": k})))
}
pub async fn update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<Body>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let k = kepatuhan(&b);
    let sasaran = if (1..=6).contains(&b.sasaran) { b.sasaran } else { 1 };
    sqlx::query("UPDATE simrscb_skp_audit SET tanggal=?,sasaran=?,indikator=?,unit=?,jml_kesempatan=?,jml_patuh=?,kepatuhan=?,auditor=?,catatan=? WHERE id=?")
        .bind(&b.tanggal).bind(sasaran).bind(&b.indikator).bind(&b.unit).bind(b.jml_kesempatan).bind(b.jml_patuh).bind(k).bind(&b.auditor).bind(&b.catatan).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "kepatuhan": k})))
}
pub async fn delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_skp_audit WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// Dashboard: kepatuhan per sasaran (tertimbang), + SKP5 gabung data PPI hand hygiene.
#[derive(Deserialize)]
pub struct RekapQ { pub tahun: Option<i32> }
pub async fn rekap(_u: AuthUser, State(s): State<AppState>, Query(q): Query<RekapQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2026));
    #[derive(sqlx::FromRow)] struct SR { sasaran: i32, kesempatan: Option<i64>, patuh: Option<i64> }
    let mut agg: Vec<SR> = sqlx::query_as("SELECT sasaran, SUM(jml_kesempatan) kesempatan, SUM(jml_patuh) patuh FROM simrscb_skp_audit WHERE YEAR(tanggal)=? GROUP BY sasaran")
        .bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    // SKP5 (Kebersihan Tangan) — tambah dari simrscb_ppi_audit bila tabel ada.
    let ppi: Option<(Option<i64>, Option<i64>)> = sqlx::query_as(
        "SELECT SUM(jml_kesempatan), SUM(jml_patuh) FROM simrscb_ppi_audit WHERE YEAR(tanggal)=? AND jenis_audit='Kebersihan Tangan'")
        .bind(tahun).fetch_optional(&s.pool).await.unwrap_or(None);
    if let Some((kes, pat)) = ppi {
        if kes.unwrap_or(0) > 0 {
            if let Some(r5) = agg.iter_mut().find(|r| r.sasaran == 5) {
                r5.kesempatan = Some(r5.kesempatan.unwrap_or(0) + kes.unwrap_or(0));
                r5.patuh = Some(r5.patuh.unwrap_or(0) + pat.unwrap_or(0));
            } else {
                agg.push(SR { sasaran: 5, kesempatan: kes, patuh: pat });
            }
        }
    }
    let nama = ["", "Identifikasi Pasien", "Komunikasi Efektif", "Keamanan Obat High Alert", "Tepat Lokasi-Prosedur-Pasien Operasi", "Kebersihan Tangan", "Risiko Jatuh"];
    let per_sasaran: Vec<Value> = (1..=6).map(|i| {
        let row = agg.iter().find(|r| r.sasaran == i);
        let kes = row.and_then(|r| r.kesempatan).unwrap_or(0);
        let pat = row.and_then(|r| r.patuh).unwrap_or(0);
        let pct = if kes > 0 { Some(pat as f64 * 100.0 / kes as f64) } else { None };
        json!({"sasaran": i, "nama": nama[i as usize], "kesempatan": kes, "patuh": pat, "kepatuhan": pct})
    }).collect();
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_skp_audit WHERE YEAR(tanggal)=?").bind(tahun).fetch_one(&s.pool).await.unwrap_or(0);
    Ok(Json(json!({"tahun": tahun, "total_audit": total, "per_sasaran": per_sasaran})))
}
