use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct LaporanQuery {
    pub tgl_awal:  Option<String>,
    pub tgl_akhir: Option<String>,
    pub jenis:     Option<String>, // kunjungan-ralan, kunjungan-igd, kunjungan-ranap
}

#[derive(Serialize, sqlx::FromRow)]
pub struct KunjunganHarian {
    pub tgl:        String,
    pub baru:       i64,
    pub lama:       i64,
    pub total:      i64,
    pub sudah:      i64,
    pub batal:      i64,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct KunjunganPoli {
    pub nm_poli:  String,
    pub baru:     i64,
    pub lama:     i64,
    pub total:    i64,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct KunjunganJaminan {
    pub png_jawab: String,
    pub baru:      i64,
    pub lama:      i64,
    pub total:     i64,
}

#[derive(Serialize)]
pub struct LaporanKunjungan {
    pub per_hari:    Vec<KunjunganHarian>,
    pub per_poli:    Vec<KunjunganPoli>,
    pub per_jaminan: Vec<KunjunganJaminan>,
    pub grand_total: i64,
}

pub async fn laporan_kunjungan_ralan(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<LaporanQuery>,
) -> Result<Json<LaporanKunjungan>, (StatusCode, Json<Value>)> {
    let today     = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tgl_awal  = q.tgl_awal.unwrap_or_else(|| today.clone());
    let tgl_akhir = q.tgl_akhir.unwrap_or_else(|| today.clone());
    let poli_excl = match q.jenis.as_deref().unwrap_or("ralan") {
        "igd"   => "IGDK",
        _       => "----", // exclude nothing for igd filter
    };
    let poli_incl = match q.jenis.as_deref().unwrap_or("ralan") {
        "igd"   => "IGDK",
        _       => "",
    };

    let per_hari: Vec<KunjunganHarian> = sqlx::query_as(
        "SELECT DATE_FORMAT(tgl_registrasi,'%Y-%m-%d') as tgl,
                SUM(CASE WHEN stts_daftar = 'Baru' THEN 1 ELSE 0 END) as baru,
                SUM(CASE WHEN stts_daftar = 'Lama' THEN 1 ELSE 0 END) as lama,
                COUNT(*) as total,
                SUM(CASE WHEN stts = 'Sudah' THEN 1 ELSE 0 END) as sudah,
                SUM(CASE WHEN stts = 'Batal' THEN 1 ELSE 0 END) as batal
         FROM reg_periksa
         WHERE tgl_registrasi BETWEEN ? AND ?
           AND kd_poli != 'IGDK'
         GROUP BY tgl_registrasi
         ORDER BY tgl_registrasi"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let per_poli: Vec<KunjunganPoli> = sqlx::query_as(
        "SELECT po.nm_poli,
                SUM(CASE WHEN r.stts_daftar = 'Baru' THEN 1 ELSE 0 END) as baru,
                SUM(CASE WHEN r.stts_daftar = 'Lama' THEN 1 ELSE 0 END) as lama,
                COUNT(*) as total
         FROM reg_periksa r
         JOIN poliklinik po ON r.kd_poli = po.kd_poli
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND r.kd_poli != 'IGDK'
         GROUP BY po.nm_poli
         ORDER BY total DESC"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let per_jaminan: Vec<KunjunganJaminan> = sqlx::query_as(
        "SELECT COALESCE(pj.png_jawab, r.kd_pj) as png_jawab,
                SUM(CASE WHEN r.stts_daftar = 'Baru' THEN 1 ELSE 0 END) as baru,
                SUM(CASE WHEN r.stts_daftar = 'Lama' THEN 1 ELSE 0 END) as lama,
                COUNT(*) as total
         FROM reg_periksa r
         LEFT JOIN penjab pj ON r.kd_pj = pj.kd_pj
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND r.kd_poli != 'IGDK'
         GROUP BY r.kd_pj
         ORDER BY total DESC"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let grand_total: i64 = per_hari.iter().map(|r| r.total).sum();

    let _ = poli_excl;
    let _ = poli_incl;

    Ok(Json(LaporanKunjungan { per_hari, per_poli, per_jaminan, grand_total }))
}

pub async fn laporan_kunjungan_igd(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<LaporanQuery>,
) -> Result<Json<LaporanKunjungan>, (StatusCode, Json<Value>)> {
    let today     = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tgl_awal  = q.tgl_awal.unwrap_or_else(|| today.clone());
    let tgl_akhir = q.tgl_akhir.unwrap_or_else(|| today.clone());

    let per_hari: Vec<KunjunganHarian> = sqlx::query_as(
        "SELECT DATE_FORMAT(tgl_registrasi,'%Y-%m-%d') as tgl,
                SUM(CASE WHEN stts_daftar = 'Baru' THEN 1 ELSE 0 END) as baru,
                SUM(CASE WHEN stts_daftar = 'Lama' THEN 1 ELSE 0 END) as lama,
                COUNT(*) as total,
                SUM(CASE WHEN stts = 'Sudah' THEN 1 ELSE 0 END) as sudah,
                SUM(CASE WHEN stts = 'Batal' THEN 1 ELSE 0 END) as batal
         FROM reg_periksa
         WHERE tgl_registrasi BETWEEN ? AND ?
           AND kd_poli = 'IGDK'
         GROUP BY tgl_registrasi
         ORDER BY tgl_registrasi"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let per_poli: Vec<KunjunganPoli> = vec![];

    let per_jaminan: Vec<KunjunganJaminan> = sqlx::query_as(
        "SELECT COALESCE(pj.png_jawab, r.kd_pj) as png_jawab,
                SUM(CASE WHEN r.stts_daftar = 'Baru' THEN 1 ELSE 0 END) as baru,
                SUM(CASE WHEN r.stts_daftar = 'Lama' THEN 1 ELSE 0 END) as lama,
                COUNT(*) as total
         FROM reg_periksa r
         LEFT JOIN penjab pj ON r.kd_pj = pj.kd_pj
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND r.kd_poli = 'IGDK'
         GROUP BY r.kd_pj
         ORDER BY total DESC"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let grand_total: i64 = per_hari.iter().map(|r| r.total).sum();

    Ok(Json(LaporanKunjungan { per_hari, per_poli, per_jaminan, grand_total }))
}

fn _db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error laporan: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
