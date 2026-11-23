// PPI — Surveilans HAIs, Audit Kepatuhan, Denominator hari-alat. CRUD + rekap + rate.
use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB ppi: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if u.0.is_admin || has_perm(u, "ppi_edit") || has_perm(u, "mutu_edit") || has_perm(u, "akreditasi_edit") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Perlu izin ppi_edit / mutu_edit"})))) }
}
fn od(s: &Option<String>) -> Option<String> { s.as_deref().map(|x| x.trim()).filter(|x| x.len() >= 8).map(|x| x.to_string()) }

// ── Surveilans HAIs ──────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct SurvRow {
    pub id: i32, pub tanggal: Option<String>, pub no_rawat: Option<String>, pub no_rkm_medis: Option<String>,
    pub nama_pasien: Option<String>, pub unit: Option<String>, pub jenis_hais: String,
    pub tanggal_pasang: Option<String>, pub tanggal_infeksi: Option<String>, pub lama_pakai: Option<i32>,
    pub mikroorganisme: Option<String>, pub gejala: Option<String>, pub tindakan: Option<String>, pub created_at: Option<String>,
}
const SURV_COLS: &str = "id, DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, no_rawat, no_rkm_medis, nama_pasien, unit, jenis_hais, DATE_FORMAT(tanggal_pasang,'%Y-%m-%d') tanggal_pasang, DATE_FORMAT(tanggal_infeksi,'%Y-%m-%d') tanggal_infeksi, lama_pakai, mikroorganisme, gejala, tindakan, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') created_at";
#[derive(Deserialize)]
pub struct SurvListQ { pub tahun: Option<i32>, pub bulan: Option<i32>, pub jenis: Option<String>, pub unit: Option<String>, pub q: Option<String> }
pub async fn surv_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<SurvListQ>)
  -> Result<Json<Vec<SurvRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!("SELECT {SURV_COLS} FROM simrscb_ppi_surveilans \
        WHERE (? IS NULL OR YEAR(tanggal)=?) AND (? IS NULL OR MONTH(tanggal)=?) AND (? IS NULL OR jenis_hais=?) AND (? IS NULL OR unit=?) \
          AND (? IS NULL OR nama_pasien LIKE ? OR unit LIKE ?) ORDER BY tanggal DESC, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql).bind(q.tahun).bind(q.tahun).bind(q.bulan).bind(q.bulan)
        .bind(&q.jenis).bind(&q.jenis).bind(&q.unit).bind(&q.unit).bind(&qs).bind(&qs).bind(&qs)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct SurvBody {
    pub tanggal: String, #[serde(default)] pub no_rawat: Option<String>, #[serde(default)] pub no_rkm_medis: Option<String>,
    #[serde(default)] pub nama_pasien: Option<String>, #[serde(default)] pub unit: Option<String>, #[serde(default)] pub jenis_hais: Option<String>,
    #[serde(default)] pub tanggal_pasang: Option<String>, #[serde(default)] pub tanggal_infeksi: Option<String>, #[serde(default)] pub lama_pakai: Option<i32>,
    #[serde(default)] pub mikroorganisme: Option<String>, #[serde(default)] pub gejala: Option<String>, #[serde(default)] pub tindakan: Option<String>,
}
pub async fn surv_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<SurvBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let r = sqlx::query("INSERT INTO simrscb_ppi_surveilans (tanggal,no_rawat,no_rkm_medis,nama_pasien,unit,jenis_hais,tanggal_pasang,tanggal_infeksi,lama_pakai,mikroorganisme,gejala,tindakan,petugas_nip) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.tanggal).bind(&b.no_rawat).bind(&b.no_rkm_medis).bind(&b.nama_pasien).bind(&b.unit)
        .bind(b.jenis_hais.as_deref().unwrap_or("Phlebitis")).bind(od(&b.tanggal_pasang)).bind(od(&b.tanggal_infeksi)).bind(b.lama_pakai)
        .bind(&b.mikroorganisme).bind(&b.gejala).bind(&b.tindakan).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn surv_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<SurvBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("UPDATE simrscb_ppi_surveilans SET tanggal=?,no_rawat=?,no_rkm_medis=?,nama_pasien=?,unit=?,jenis_hais=COALESCE(?,jenis_hais),tanggal_pasang=?,tanggal_infeksi=?,lama_pakai=?,mikroorganisme=?,gejala=?,tindakan=? WHERE id=?")
        .bind(&b.tanggal).bind(&b.no_rawat).bind(&b.no_rkm_medis).bind(&b.nama_pasien).bind(&b.unit)
        .bind(&b.jenis_hais).bind(od(&b.tanggal_pasang)).bind(od(&b.tanggal_infeksi)).bind(b.lama_pakai)
        .bind(&b.mikroorganisme).bind(&b.gejala).bind(&b.tindakan).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn surv_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_ppi_surveilans WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Audit Kepatuhan ──────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct AuditRow {
    pub id: i32, pub tanggal: Option<String>, pub unit: Option<String>, pub jenis_audit: String, pub profesi: Option<String>,
    pub jml_kesempatan: i32, pub jml_patuh: i32, pub kepatuhan: Option<f64>, pub auditor: Option<String>, pub catatan: Option<String>, pub created_at: Option<String>,
}
const AUD_COLS: &str = "id, DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, unit, jenis_audit, profesi, jml_kesempatan, jml_patuh, kepatuhan, auditor, catatan, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') created_at";
#[derive(Deserialize)]
pub struct AudListQ { pub tahun: Option<i32>, pub bulan: Option<i32>, pub jenis: Option<String>, pub unit: Option<String> }
pub async fn aud_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<AudListQ>)
  -> Result<Json<Vec<AuditRow>>, (StatusCode, Json<Value>)> {
    let sql = format!("SELECT {AUD_COLS} FROM simrscb_ppi_audit \
        WHERE (? IS NULL OR YEAR(tanggal)=?) AND (? IS NULL OR MONTH(tanggal)=?) AND (? IS NULL OR jenis_audit=?) AND (? IS NULL OR unit=?) \
        ORDER BY tanggal DESC, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql).bind(q.tahun).bind(q.tahun).bind(q.bulan).bind(q.bulan).bind(&q.jenis).bind(&q.jenis).bind(&q.unit).bind(&q.unit)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct AudBody {
    pub tanggal: String, #[serde(default)] pub unit: Option<String>, #[serde(default)] pub jenis_audit: Option<String>, #[serde(default)] pub profesi: Option<String>,
    #[serde(default)] pub jml_kesempatan: i32, #[serde(default)] pub jml_patuh: i32, #[serde(default)] pub auditor: Option<String>, #[serde(default)] pub catatan: Option<String>,
}
fn kepatuhan(b: &AudBody) -> Option<f64> { if b.jml_kesempatan > 0 { Some(b.jml_patuh as f64 * 100.0 / b.jml_kesempatan as f64) } else { None } }
pub async fn aud_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<AudBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let k = kepatuhan(&b);
    let r = sqlx::query("INSERT INTO simrscb_ppi_audit (tanggal,unit,jenis_audit,profesi,jml_kesempatan,jml_patuh,kepatuhan,auditor,catatan,petugas_nip) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.tanggal).bind(&b.unit).bind(b.jenis_audit.as_deref().unwrap_or("Kebersihan Tangan")).bind(&b.profesi)
        .bind(b.jml_kesempatan).bind(b.jml_patuh).bind(k).bind(&b.auditor).bind(&b.catatan).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id(), "kepatuhan": k})))
}
pub async fn aud_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<AudBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let k = kepatuhan(&b);
    sqlx::query("UPDATE simrscb_ppi_audit SET tanggal=?,unit=?,jenis_audit=COALESCE(?,jenis_audit),profesi=?,jml_kesempatan=?,jml_patuh=?,kepatuhan=?,auditor=?,catatan=? WHERE id=?")
        .bind(&b.tanggal).bind(&b.unit).bind(&b.jenis_audit).bind(&b.profesi).bind(b.jml_kesempatan).bind(b.jml_patuh).bind(k).bind(&b.auditor).bind(&b.catatan).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "kepatuhan": k})))
}
pub async fn aud_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_ppi_audit WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Denominator hari-alat ────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct DenomRow { pub id: i32, pub tahun: i32, pub bulan: i32, pub unit: String, pub jenis_alat: String, pub hari_alat: i32, pub hari_rawat: i32 }
#[derive(Deserialize)]
pub struct DenomListQ { pub tahun: Option<i32> }
pub async fn denom_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<DenomListQ>)
  -> Result<Json<Vec<DenomRow>>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2026));
    let rows = sqlx::query_as("SELECT id,tahun,bulan,unit,jenis_alat,hari_alat,hari_rawat FROM simrscb_ppi_denominator WHERE tahun=? ORDER BY bulan,unit,jenis_alat")
        .bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct DenomBody { pub tahun: i32, pub bulan: i32, #[serde(default)] pub unit: Option<String>, pub jenis_alat: String, #[serde(default)] pub hari_alat: i32, #[serde(default)] pub hari_rawat: i32 }
pub async fn denom_upsert(u: AuthUser, State(s): State<AppState>, Json(b): Json<DenomBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("INSERT INTO simrscb_ppi_denominator (tahun,bulan,unit,jenis_alat,hari_alat,hari_rawat,petugas_nip) VALUES (?,?,?,?,?,?,?) \
        ON DUPLICATE KEY UPDATE hari_alat=VALUES(hari_alat),hari_rawat=VALUES(hari_rawat),petugas_nip=VALUES(petugas_nip)")
        .bind(b.tahun).bind(b.bulan).bind(b.unit.as_deref().unwrap_or("")).bind(&b.jenis_alat).bind(b.hari_alat).bind(b.hari_rawat).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn denom_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_ppi_denominator WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Rekap gabungan ───────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct RekapQ { pub tahun: Option<i32> }
pub async fn rekap(_u: AuthUser, State(s): State<AppState>, Query(q): Query<RekapQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2026));
    #[derive(sqlx::FromRow)] struct C { k: Option<String>, n: i64 }
    let per_jenis: Vec<C> = sqlx::query_as("SELECT jenis_hais k, COUNT(*) n FROM simrscb_ppi_surveilans WHERE YEAR(tanggal)=? GROUP BY jenis_hais ORDER BY n DESC").bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    // rate per jenis HAIs = kasus / hari-alat x 1000 (mapping jenis→alat)
    #[derive(sqlx::FromRow)] struct RRow { jenis: String, kasus: i64, hari_alat: Option<i64> }
    let rates: Vec<RRow> = sqlx::query_as(
        "SELECT m.jenis, m.kasus, d.hari_alat FROM \
           (SELECT jenis_hais jenis, COUNT(*) kasus FROM simrscb_ppi_surveilans WHERE YEAR(tanggal)=? GROUP BY jenis_hais) m \
         LEFT JOIN ( \
           SELECT CASE jenis_alat WHEN 'Kateter Urin' THEN 'ISK' WHEN 'Ventilator' THEN 'VAP' WHEN 'CVC' THEN 'IADP' WHEN 'Infus Perifer' THEN 'Phlebitis' END jenis, \
                  SUM(hari_alat) hari_alat FROM simrscb_ppi_denominator WHERE tahun=? GROUP BY jenis \
         ) d ON d.jenis = m.jenis").bind(tahun).bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    // audit kepatuhan per jenis (rata-rata tertimbang)
    #[derive(sqlx::FromRow)] struct ARow { jenis_audit: String, kesempatan: Option<i64>, patuh: Option<i64> }
    let audit: Vec<ARow> = sqlx::query_as("SELECT jenis_audit, SUM(jml_kesempatan) kesempatan, SUM(jml_patuh) patuh FROM simrscb_ppi_audit WHERE YEAR(tanggal)=? GROUP BY jenis_audit").bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    #[derive(sqlx::FromRow)] struct M { bulan: i32, n: i64 }
    let per_bulan: Vec<M> = sqlx::query_as("SELECT MONTH(tanggal) bulan, COUNT(*) n FROM simrscb_ppi_surveilans WHERE YEAR(tanggal)=? GROUP BY MONTH(tanggal)").bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_ppi_surveilans WHERE YEAR(tanggal)=?").bind(tahun).fetch_one(&s.pool).await.unwrap_or(0);
    Ok(Json(json!({
        "tahun": tahun, "total_kasus": total,
        "per_jenis": per_jenis.iter().map(|c| json!({"label": c.k, "total": c.n})).collect::<Vec<_>>(),
        "rate": rates.iter().map(|r| {
            let rate = match r.hari_alat { Some(h) if h > 0 => Some(r.kasus as f64 * 1000.0 / h as f64), _ => None };
            json!({"jenis": r.jenis, "kasus": r.kasus, "hari_alat": r.hari_alat, "rate_per_1000": rate})
        }).collect::<Vec<_>>(),
        "audit": audit.iter().map(|a| {
            let kes = a.kesempatan.unwrap_or(0); let pat = a.patuh.unwrap_or(0);
            let pct = if kes > 0 { Some(pat as f64 * 100.0 / kes as f64) } else { None };
            json!({"jenis": a.jenis_audit, "kesempatan": kes, "patuh": pat, "kepatuhan": pct})
        }).collect::<Vec<_>>(),
        "per_bulan": per_bulan.iter().map(|m| json!({"bulan": m.bulan, "total": m.n})).collect::<Vec<_>>(),
    })))
}
