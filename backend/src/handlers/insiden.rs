// PMKP — Pelaporan Insiden Keselamatan Pasien (IKP). CRUD + grading matriks + rekap.
use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB insiden: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if u.0.is_admin || has_perm(u, "insiden_edit") || has_perm(u, "mutu_edit") || has_perm(u, "akreditasi_edit") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Perlu izin insiden_edit / mutu_edit"})))) }
}

// Matriks risiko KKP-RS: band dari probabilitas(1-5) x dampak(1-5).
fn grading_band(prob: i32, dampak: i32) -> &'static str {
    let s = prob * dampak;
    if s >= 15 { "Merah" } else if s >= 8 { "Kuning" } else if s >= 4 { "Hijau" } else if s >= 1 { "Biru" } else { "" }
}

#[derive(Serialize, sqlx::FromRow)]
pub struct InsidenRow {
    pub id: i32, pub no_laporan: Option<String>, pub tanggal_lapor: Option<String>, pub tanggal_insiden: Option<String>,
    pub jam_insiden: Option<String>, pub jenis_insiden: String, pub tipe_insiden: Option<String>, pub judul: Option<String>,
    pub kronologi: Option<String>, pub no_rkm_medis: Option<String>, pub nama_pasien: Option<String>, pub no_rawat: Option<String>,
    pub unit_terjadi: Option<String>, pub unit_pelapor: Option<String>, pub dampak: Option<String>,
    pub probabilitas: Option<i32>, pub dampak_nilai: Option<i32>, pub grading: Option<String>,
    pub tindakan_segera: Option<String>, pub rekomendasi: Option<String>, pub metode_investigasi: Option<String>,
    pub penanggung_jawab: Option<String>, pub tgl_selesai_investigasi: Option<String>, pub akar_masalah: Option<String>,
    pub hasil_investigasi: Option<String>, pub status: String, pub pelapor_nip: Option<String>, pub created_at: Option<String>,
}
const COLS: &str = "id, no_laporan, DATE_FORMAT(tanggal_lapor,'%Y-%m-%d') tanggal_lapor, DATE_FORMAT(tanggal_insiden,'%Y-%m-%d') tanggal_insiden, \
  jam_insiden, jenis_insiden, tipe_insiden, judul, kronologi, no_rkm_medis, nama_pasien, no_rawat, unit_terjadi, unit_pelapor, \
  dampak, probabilitas, dampak_nilai, grading, tindakan_segera, rekomendasi, metode_investigasi, penanggung_jawab, \
  DATE_FORMAT(tgl_selesai_investigasi,'%Y-%m-%d') tgl_selesai_investigasi, akar_masalah, hasil_investigasi, status, pelapor_nip, \
  DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') created_at";

#[derive(Deserialize)]
pub struct ListQ { pub tahun: Option<i32>, pub bulan: Option<i32>, pub jenis: Option<String>, pub grading: Option<String>, pub status: Option<String>, pub q: Option<String> }
pub async fn list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQ>)
  -> Result<Json<Vec<InsidenRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!("SELECT {COLS} FROM simrscb_insiden \
        WHERE (? IS NULL OR YEAR(tanggal_lapor)=?) AND (? IS NULL OR MONTH(tanggal_lapor)=?) \
          AND (? IS NULL OR jenis_insiden=?) AND (? IS NULL OR grading=?) AND (? IS NULL OR status=?) \
          AND (? IS NULL OR judul LIKE ? OR nama_pasien LIKE ? OR unit_terjadi LIKE ?) \
        ORDER BY tanggal_lapor DESC, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql)
        .bind(q.tahun).bind(q.tahun).bind(q.bulan).bind(q.bulan)
        .bind(&q.jenis).bind(&q.jenis).bind(&q.grading).bind(&q.grading).bind(&q.status).bind(&q.status)
        .bind(&qs).bind(&qs).bind(&qs).bind(&qs)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
pub async fn get_one(_u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<InsidenRow>, (StatusCode, Json<Value>)> {
    let row: Option<InsidenRow> = sqlx::query_as(&format!("SELECT {COLS} FROM simrscb_insiden WHERE id=?"))
        .bind(id).fetch_optional(&s.pool).await.map_err(db_err)?;
    row.map(Json).ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"not found"}))))
}

#[derive(Deserialize)]
pub struct Body {
    pub tanggal_lapor: String,
    #[serde(default)] pub no_laporan: Option<String>, #[serde(default)] pub tanggal_insiden: Option<String>, #[serde(default)] pub jam_insiden: Option<String>,
    #[serde(default)] pub jenis_insiden: Option<String>, #[serde(default)] pub tipe_insiden: Option<String>, #[serde(default)] pub judul: Option<String>,
    #[serde(default)] pub kronologi: Option<String>, #[serde(default)] pub no_rkm_medis: Option<String>, #[serde(default)] pub nama_pasien: Option<String>, #[serde(default)] pub no_rawat: Option<String>,
    #[serde(default)] pub unit_terjadi: Option<String>, #[serde(default)] pub unit_pelapor: Option<String>, #[serde(default)] pub dampak: Option<String>,
    #[serde(default)] pub probabilitas: Option<i32>, #[serde(default)] pub dampak_nilai: Option<i32>,
    #[serde(default)] pub tindakan_segera: Option<String>, #[serde(default)] pub rekomendasi: Option<String>, #[serde(default)] pub metode_investigasi: Option<String>,
    #[serde(default)] pub penanggung_jawab: Option<String>, #[serde(default)] pub tgl_selesai_investigasi: Option<String>, #[serde(default)] pub akar_masalah: Option<String>,
    #[serde(default)] pub hasil_investigasi: Option<String>, #[serde(default)] pub status: Option<String>,
}
fn grading_of(b: &Body) -> Option<String> {
    match (b.probabilitas, b.dampak_nilai) {
        (Some(p), Some(d)) if p >= 1 && d >= 1 => { let g = grading_band(p, d); if g.is_empty() { None } else { Some(g.to_string()) } }
        _ => None,
    }
}
fn od(s: &Option<String>) -> Option<String> { s.as_deref().map(|x| x.trim()).filter(|x| x.len() >= 8).map(|x| x.to_string()) }

pub async fn create(u: AuthUser, State(s): State<AppState>, Json(b): Json<Body>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let grading = grading_of(&b);
    let r = sqlx::query(
        "INSERT INTO simrscb_insiden (no_laporan,tanggal_lapor,tanggal_insiden,jam_insiden,jenis_insiden,tipe_insiden,judul,kronologi,no_rkm_medis,nama_pasien,no_rawat,unit_terjadi,unit_pelapor,dampak,probabilitas,dampak_nilai,grading,tindakan_segera,rekomendasi,metode_investigasi,penanggung_jawab,tgl_selesai_investigasi,akar_masalah,hasil_investigasi,status,pelapor_nip) \
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.no_laporan).bind(&b.tanggal_lapor).bind(od(&b.tanggal_insiden)).bind(&b.jam_insiden)
        .bind(b.jenis_insiden.as_deref().unwrap_or("KNC")).bind(&b.tipe_insiden).bind(&b.judul).bind(&b.kronologi)
        .bind(&b.no_rkm_medis).bind(&b.nama_pasien).bind(&b.no_rawat).bind(&b.unit_terjadi).bind(&b.unit_pelapor)
        .bind(&b.dampak).bind(b.probabilitas).bind(b.dampak_nilai).bind(&grading)
        .bind(&b.tindakan_segera).bind(&b.rekomendasi).bind(&b.metode_investigasi).bind(&b.penanggung_jawab)
        .bind(od(&b.tgl_selesai_investigasi)).bind(&b.akar_masalah).bind(&b.hasil_investigasi)
        .bind(b.status.as_deref().unwrap_or("Lapor")).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    // no_laporan otomatis bila kosong: IKP/YYYY/000ID
    let id = r.last_insert_id();
    if b.no_laporan.as_deref().map(|x| x.trim().is_empty()).unwrap_or(true) {
        let no = format!("IKP/{}/{:04}", &b.tanggal_lapor.get(0..4).unwrap_or("2026"), id);
        sqlx::query("UPDATE simrscb_insiden SET no_laporan=? WHERE id=?").bind(&no).bind(id).execute(&s.pool).await.ok();
    }
    Ok(Json(json!({"ok": true, "id": id, "grading": grading})))
}
pub async fn update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<Body>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let grading = grading_of(&b);
    sqlx::query(
        "UPDATE simrscb_insiden SET no_laporan=?,tanggal_lapor=?,tanggal_insiden=?,jam_insiden=?,jenis_insiden=COALESCE(?,jenis_insiden),tipe_insiden=?,judul=?,kronologi=?,no_rkm_medis=?,nama_pasien=?,no_rawat=?,unit_terjadi=?,unit_pelapor=?,dampak=?,probabilitas=?,dampak_nilai=?,grading=?,tindakan_segera=?,rekomendasi=?,metode_investigasi=?,penanggung_jawab=?,tgl_selesai_investigasi=?,akar_masalah=?,hasil_investigasi=?,status=COALESCE(?,status),updated_at=NOW() WHERE id=?")
        .bind(&b.no_laporan).bind(&b.tanggal_lapor).bind(od(&b.tanggal_insiden)).bind(&b.jam_insiden)
        .bind(&b.jenis_insiden).bind(&b.tipe_insiden).bind(&b.judul).bind(&b.kronologi)
        .bind(&b.no_rkm_medis).bind(&b.nama_pasien).bind(&b.no_rawat).bind(&b.unit_terjadi).bind(&b.unit_pelapor)
        .bind(&b.dampak).bind(b.probabilitas).bind(b.dampak_nilai).bind(&grading)
        .bind(&b.tindakan_segera).bind(&b.rekomendasi).bind(&b.metode_investigasi).bind(&b.penanggung_jawab)
        .bind(od(&b.tgl_selesai_investigasi)).bind(&b.akar_masalah).bind(&b.hasil_investigasi)
        .bind(&b.status).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "grading": grading})))
}
pub async fn delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_insiden WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
pub struct RekapQ { pub tahun: Option<i32> }
pub async fn rekap(_u: AuthUser, State(s): State<AppState>, Query(q): Query<RekapQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2026));
    #[derive(sqlx::FromRow)] struct C { k: Option<String>, n: i64 }
    let per_jenis: Vec<C> = sqlx::query_as("SELECT jenis_insiden k, COUNT(*) n FROM simrscb_insiden WHERE YEAR(tanggal_lapor)=? GROUP BY jenis_insiden ORDER BY n DESC").bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    let per_grading: Vec<C> = sqlx::query_as("SELECT IFNULL(grading,'-') k, COUNT(*) n FROM simrscb_insiden WHERE YEAR(tanggal_lapor)=? GROUP BY grading").bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    let per_status: Vec<C> = sqlx::query_as("SELECT status k, COUNT(*) n FROM simrscb_insiden WHERE YEAR(tanggal_lapor)=? GROUP BY status").bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    let per_unit: Vec<C> = sqlx::query_as("SELECT IFNULL(unit_terjadi,'-') k, COUNT(*) n FROM simrscb_insiden WHERE YEAR(tanggal_lapor)=? GROUP BY unit_terjadi ORDER BY n DESC LIMIT 10").bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    #[derive(sqlx::FromRow)] struct M { bulan: i32, n: i64 }
    let per_bulan: Vec<M> = sqlx::query_as("SELECT MONTH(tanggal_lapor) bulan, COUNT(*) n FROM simrscb_insiden WHERE YEAR(tanggal_lapor)=? GROUP BY MONTH(tanggal_lapor)").bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_insiden WHERE YEAR(tanggal_lapor)=?").bind(tahun).fetch_one(&s.pool).await.unwrap_or(0);
    let belum_selesai: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_insiden WHERE YEAR(tanggal_lapor)=? AND status NOT IN ('Selesai','Ditutup')").bind(tahun).fetch_one(&s.pool).await.unwrap_or(0);
    let cv = |v: Vec<C>| v.iter().map(|c| json!({"label": c.k, "total": c.n})).collect::<Vec<_>>();
    Ok(Json(json!({
        "tahun": tahun, "total": total, "belum_selesai": belum_selesai,
        "per_jenis": cv(per_jenis), "per_grading": cv(per_grading), "per_status": cv(per_status), "per_unit": cv(per_unit),
        "per_bulan": per_bulan.iter().map(|m| json!({"bulan": m.bulan, "total": m.n})).collect::<Vec<_>>(),
    })))
}
