// Laporan Hasil Evaluasi Insiden (IKP) — agregasi read-only dari modul PMKP Insiden
// (simrscb_insiden) per triwulan, mereproduksi format laporan Komite Mutu:
// jumlah per jenis/tipe/grading/bulan/unit, ketepatan lapor ≤2x24 jam, dan line-list.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::MySqlPool;

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::warn!("mrmik_ikp db: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Kesalahan database"})))
}

async fn grup(pool: &MySqlPool, sql: &str, a: &str, z: &str) -> Vec<Value> {
    sqlx::query_as::<_, (String, i64)>(sql).bind(a).bind(z).fetch_all(pool).await
        .unwrap_or_default().into_iter().map(|(k, n)| json!({"label": k, "jumlah": n})).collect()
}

#[derive(Deserialize)]
pub struct Q { pub tahun: Option<i32>, pub triwulan: Option<i32> }

pub async fn laporan(
    _user: AuthUser, State(state): State<AppState>, Query(q): Query<Q>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let now = chrono::Local::now();
    let tahun = q.tahun.unwrap_or_else(|| now.format("%Y").to_string().parse().unwrap_or(2026));
    let tw = q.triwulan.filter(|t| (1..=4).contains(t)).unwrap_or(1);
    let (bln_awal, bln_akhir) = match tw { 1 => (1, 3), 2 => (4, 6), 3 => (7, 9), _ => (10, 12) };
    let a = format!("{:04}-{:02}-01", tahun, bln_awal);
    let (ny, nm) = if bln_akhir == 12 { (tahun + 1, 1) } else { (tahun, bln_akhir + 1) };
    let z = (chrono::NaiveDate::from_ymd_opt(ny, nm as u32, 1).unwrap() - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
    let p = &state.pool;

    let jumlah: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM simrscb_insiden WHERE tanggal_insiden BETWEEN ? AND ?")
        .bind(&a).bind(&z).fetch_one(p).await.map_err(db_err)?;

    let per_jenis  = grup(p, "SELECT IFNULL(jenis_insiden,'-') k, COUNT(*) n FROM simrscb_insiden WHERE tanggal_insiden BETWEEN ? AND ? GROUP BY jenis_insiden ORDER BY n DESC", &a, &z).await;
    let per_grading = grup(p, "SELECT IFNULL(grading,'-') k, COUNT(*) n FROM simrscb_insiden WHERE tanggal_insiden BETWEEN ? AND ? GROUP BY grading ORDER BY FIELD(grading,'Merah','Kuning','Biru','Hijau')", &a, &z).await;
    let per_tipe   = grup(p, "SELECT IFNULL(NULLIF(tipe_insiden,''),'-') k, COUNT(*) n FROM simrscb_insiden WHERE tanggal_insiden BETWEEN ? AND ? GROUP BY tipe_insiden ORDER BY n DESC", &a, &z).await;
    let per_bulan  = grup(p, "SELECT DATE_FORMAT(tanggal_insiden,'%Y-%m') k, COUNT(*) n FROM simrscb_insiden WHERE tanggal_insiden BETWEEN ? AND ? GROUP BY k ORDER BY k", &a, &z).await;
    let per_unit   = grup(p, "SELECT IFNULL(NULLIF(unit_terjadi,''),'-') k, COUNT(*) n FROM simrscb_insiden WHERE tanggal_insiden BETWEEN ? AND ? GROUP BY unit_terjadi ORDER BY n DESC", &a, &z).await;

    let (tepat, adat): (i64, i64) = sqlx::query_as(
        "SELECT CAST(SUM(CASE WHEN DATEDIFF(tanggal_lapor, tanggal_insiden) <= 2 THEN 1 ELSE 0 END) AS SIGNED), \
                CAST(COUNT(*) AS SIGNED) FROM simrscb_insiden WHERE tanggal_insiden BETWEEN ? AND ?")
        .bind(&a).bind(&z).fetch_one(p).await.unwrap_or((0, 0));
    let ketepatan = if adat > 0 { tepat as f64 / adat as f64 * 100.0 } else { 0.0 };

    let ll: Vec<(String, String, String, String, String, String)> = sqlx::query_as(
        "SELECT IFNULL(jenis_insiden,'-'), IFNULL(NULLIF(tipe_insiden,''),'-'), IFNULL(judul,''), \
                IFNULL(kronologi,''), IFNULL(grading,'-'), CAST(tanggal_insiden AS CHAR) \
         FROM simrscb_insiden WHERE tanggal_insiden BETWEEN ? AND ? ORDER BY jenis_insiden, tanggal_insiden")
        .bind(&a).bind(&z).fetch_all(p).await.map_err(db_err)?;

    Ok(Json(json!({
        "periode": {"tahun": tahun, "triwulan": tw, "tgl_awal": a, "tgl_akhir": z},
        "jumlah_laporan": jumlah,
        "per_jenis": per_jenis, "per_grading": per_grading, "per_tipe": per_tipe,
        "per_bulan": per_bulan, "per_unit": per_unit, "ketepatan_2x24": ketepatan,
        "linelist": ll.into_iter().map(|(jenis, tipe, judul, krono, grad, tgl)| json!({
            "jenis": jenis, "tipe": tipe, "judul": judul, "kronologi": krono, "grading": grad, "tanggal": tgl,
        })).collect::<Vec<_>>(),
    })))
}
