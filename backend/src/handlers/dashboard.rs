use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::State, http::StatusCode, Json};
use serde::Serialize;
use serde_json::{json, Value};

#[derive(Serialize)]
pub struct DashboardStats {
    kunjungan_hari_ini: i64,
    pasien_baru:        i64,
    total_pasien:       i64,
    pasien_ranap:       i64,
    kunjungan_7_hari:   Vec<KunjunganHarian>,
    kunjungan_per_poli: Vec<KunjunganPoli>,
    jaminan:            Vec<JaminanStat>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct KunjunganHarian {
    tgl:    String,
    jumlah: i64,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct KunjunganPoli {
    nm_poli: String,
    jumlah:  i64,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct JaminanStat {
    png_jawab: String,
    jumlah:    i64,
}

pub async fn get_stats(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<DashboardStats>, (StatusCode, Json<Value>)> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // Kunjungan rawat jalan hari ini (exclude IGD)
    let kunjungan_hari_ini: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM reg_periksa WHERE tgl_registrasi = ? AND kd_poli != 'IGDK'"
    )
    .bind(&today)
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    // Pasien baru terdaftar hari ini
    let pasien_baru: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM pasien WHERE tgl_daftar = ?"
    )
    .bind(&today)
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    // Total pasien terdaftar
    let total_pasien: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM pasien"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    // Pasien rawat inap saat ini (tgl_keluar kosong atau 0000-00-00)
    let pasien_ranap: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM kamar_inap WHERE tgl_keluar IS NULL OR tgl_keluar = '0000-00-00'"
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or((0,));

    // Kunjungan 7 hari terakhir (exclude IGD)
    let kunjungan_7_hari: Vec<KunjunganHarian> = sqlx::query_as(
        "SELECT DATE_FORMAT(tgl_registrasi,'%Y-%m-%d') as tgl, COUNT(*) as jumlah
         FROM reg_periksa
         WHERE tgl_registrasi BETWEEN DATE_SUB(?, INTERVAL 6 DAY) AND ?
           AND kd_poli != 'IGDK'
         GROUP BY tgl_registrasi
         ORDER BY tgl_registrasi"
    )
    .bind(&today).bind(&today)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Kunjungan per poli hari ini (top 10, exclude IGD)
    let kunjungan_per_poli: Vec<KunjunganPoli> = sqlx::query_as(
        "SELECT po.nm_poli, COUNT(*) as jumlah
         FROM reg_periksa r
         JOIN poliklinik po ON r.kd_poli = po.kd_poli
         WHERE r.tgl_registrasi = ? AND r.kd_poli != 'IGDK'
         GROUP BY po.nm_poli
         ORDER BY jumlah DESC
         LIMIT 10"
    )
    .bind(&today)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Breakdown jaminan hari ini
    let jaminan: Vec<JaminanStat> = sqlx::query_as(
        "SELECT COALESCE(pj.png_jawab, r.kd_pj) as png_jawab, COUNT(*) as jumlah
         FROM reg_periksa r
         LEFT JOIN penjab pj ON r.kd_pj = pj.kd_pj
         WHERE r.tgl_registrasi = ?
         GROUP BY r.kd_pj
         ORDER BY jumlah DESC"
    )
    .bind(&today)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Ok(Json(DashboardStats {
        kunjungan_hari_ini: kunjungan_hari_ini.0,
        pasien_baru:        pasien_baru.0,
        total_pasien:       total_pasien.0,
        pasien_ranap:       pasien_ranap.0,
        kunjungan_7_hari,
        kunjungan_per_poli,
        jaminan,
    }))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error dashboard: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
