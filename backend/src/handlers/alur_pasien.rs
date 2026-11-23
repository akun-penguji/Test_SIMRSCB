// Pengelolaan Alur Pasien (AKP 2.1) — dashboard read-only untuk memantau
// ketersediaan tempat tidur & mencegah penumpukan pasien.
// Sumber data live Khanza: kamar/bangsal (status ISI/KOSONG), kamar_inap
// (sensus ranap aktif), reg_periksa (kunjungan IGD hari ini).
use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::State, http::StatusCode, Json};
use serde::Serialize;
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB alur_pasien: {}", e);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": e.to_string() })),
    )
}

#[derive(sqlx::FromRow, Serialize)]
pub struct BangsalRow {
    pub kd_bangsal: String,
    pub nm_bangsal: String,
    pub kelas: Option<String>,
    pub total: i64,
    pub isi: i64,
    pub kosong: i64,
}

pub async fn status(
    _u: AuthUser,
    State(s): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Ketersediaan TT per bangsal (hanya kamar aktif statusdata='1').
    let bangsal: Vec<BangsalRow> = sqlx::query_as(
        "SELECT b.kd_bangsal AS kd_bangsal, b.nm_bangsal AS nm_bangsal, k.kelas AS kelas, \
                CAST(COUNT(k.kd_kamar) AS SIGNED) AS total, \
                CAST(SUM(CASE WHEN k.status='ISI' THEN 1 ELSE 0 END) AS SIGNED) AS isi, \
                CAST(SUM(CASE WHEN k.status='KOSONG' THEN 1 ELSE 0 END) AS SIGNED) AS kosong \
         FROM kamar k \
         INNER JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal \
         WHERE k.statusdata='1' \
         GROUP BY b.kd_bangsal, b.nm_bangsal, k.kelas \
         ORDER BY b.nm_bangsal, k.kelas",
    )
    .fetch_all(&s.pool)
    .await
    .map_err(db_err)?;

    let total_tt: i64 = bangsal.iter().map(|b| b.total).sum();
    let terpakai: i64 = bangsal.iter().map(|b| b.isi).sum();
    let tersedia: i64 = bangsal.iter().map(|b| b.kosong).sum();
    let bor = if total_tt > 0 {
        (terpakai as f64) * 100.0 / (total_tt as f64)
    } else {
        0.0
    };

    // Rekap per kelas.
    #[derive(sqlx::FromRow, Serialize)]
    struct KelasRow {
        kelas: Option<String>,
        total: i64,
        isi: i64,
        kosong: i64,
    }
    let per_kelas: Vec<KelasRow> = sqlx::query_as(
        "SELECT k.kelas AS kelas, \
                CAST(COUNT(k.kd_kamar) AS SIGNED) AS total, \
                CAST(SUM(CASE WHEN k.status='ISI' THEN 1 ELSE 0 END) AS SIGNED) AS isi, \
                CAST(SUM(CASE WHEN k.status='KOSONG' THEN 1 ELSE 0 END) AS SIGNED) AS kosong \
         FROM kamar k \
         WHERE k.statusdata='1' \
         GROUP BY k.kelas ORDER BY k.kelas",
    )
    .fetch_all(&s.pool)
    .await
    .map_err(db_err)?;

    // Sensus ranap aktif (belum keluar).
    let ranap_aktif: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM kamar_inap WHERE tgl_keluar='0000-00-00' OR tgl_keluar IS NULL",
    )
    .fetch_one(&s.pool)
    .await
    .map_err(db_err)?;

    // Kunjungan IGD hari ini (indikator beban gawat darurat).
    let igd_hari_ini: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa \
         WHERE kd_poli IN ('IGD','IGDK') AND tgl_registrasi=CURDATE() AND stts <> 'Batal'",
    )
    .fetch_one(&s.pool)
    .await
    .map_err(db_err)?;

    // Pasien IGD hari ini yang diarahkan ranap tapi belum dapat TT (proxy boarding/penumpukan):
    // registrasi IGD hari ini, status ranap, belum ada baris kamar_inap.
    let igd_menunggu_tt: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa r \
         WHERE r.kd_poli IN ('IGD','IGDK') AND r.tgl_registrasi=CURDATE() AND r.stts <> 'Batal' \
           AND r.status_lanjut='Ranap' \
           AND NOT EXISTS (SELECT 1 FROM kamar_inap ki WHERE ki.no_rawat=r.no_rawat)",
    )
    .fetch_one(&s.pool)
    .await
    .unwrap_or(0);

    Ok(Json(json!({
        "ringkasan": {
            "total_tt": total_tt,
            "terpakai": terpakai,
            "tersedia": tersedia,
            "bor_persen": (bor * 10.0).round() / 10.0,
            "ranap_aktif": ranap_aktif,
            "igd_hari_ini": igd_hari_ini,
            "igd_menunggu_tt": igd_menunggu_tt,
        },
        "per_kelas": per_kelas,
        "bangsal": bangsal,
    })))
}
