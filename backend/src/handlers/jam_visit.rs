// Laporan Jam Visit Dokter (rawat inap). Sumber: pemeriksaan_ranap.jam_rawat untuk
// baris yang nip-nya = kode dokter (SOAP oleh dokter). "Visit pertama" = MIN(jam_rawat)
// per pasien per hari per dokter. Bisa difilter spesialisasi + jam target (mis. 14:00)
// untuk indikator mutu "ketepatan jam visite dokter".
//
// Catatan akurasi: jam_rawat = jam SOAP di-input ke SIMRS; akurat sebagai jam visit
// hanya bila dokter input real-time.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB jam_visit: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data jam visit dokter"})))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct VisitRow {
    pub no_rawat: String,
    pub tgl_perawatan: String,
    pub no_rkm_medis: String,
    pub nm_pasien: String,
    pub kd_dokter: String,
    pub nm_dokter: String,
    pub spesialisasi: String,
    pub kamar: String,
    pub visit_pertama: String,
    pub jml_visit: i64,
    pub tepat: i64, // 1 = visit_pertama <= jam_target
}

#[derive(Deserialize)]
pub struct VisitQuery {
    pub tgl_awal: String,
    pub tgl_akhir: String,
    #[serde(default)] pub kd_sps: Option<String>,
    #[serde(default)] pub jam_target: Option<String>, // "HH:MM" atau "HH:MM:SS"
}

/// Daftar jam visit pertama dokter per pasien-hari + ringkasan ketepatan.
pub async fn laporan(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<VisitQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if q.tgl_awal.trim().is_empty() || q.tgl_akhir.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Tanggal awal & akhir wajib"}))));
    }
    // Normalisasi jam target ke HH:MM:SS (default 14:00:00).
    let mut jam_target = q.jam_target.clone().unwrap_or_default();
    jam_target = jam_target.trim().to_string();
    if jam_target.is_empty() { jam_target = "14:00".to_string(); }
    if jam_target.len() == 5 { jam_target.push_str(":00"); } // HH:MM -> HH:MM:SS

    let kd_sps = q.kd_sps.clone().unwrap_or_default();
    let filter_sps = if kd_sps.trim().is_empty() { String::new() } else { " AND d.kd_sps = ? ".to_string() };

    let sql = format!(
        "SELECT pr.no_rawat, CAST(pr.tgl_perawatan AS CHAR) tgl_perawatan, ps.no_rkm_medis, ps.nm_pasien, \
                d.kd_dokter, d.nm_dokter, IFNULL(sp.nm_sps,'') spesialisasi, IFNULL(ki.kd_kamar,'') kamar, \
                CAST(MIN(pr.jam_rawat) AS CHAR) visit_pertama, COUNT(*) jml_visit, \
                (MIN(pr.jam_rawat) <= ?) tepat \
         FROM pemeriksaan_ranap pr \
         INNER JOIN dokter d ON d.kd_dokter = pr.nip \
         LEFT JOIN spesialis sp ON sp.kd_sps = d.kd_sps \
         INNER JOIN reg_periksa rp ON rp.no_rawat = pr.no_rawat \
         INNER JOIN pasien ps ON ps.no_rkm_medis = rp.no_rkm_medis \
         LEFT JOIN kamar_inap ki ON ki.no_rawat = pr.no_rawat AND ki.tgl_keluar = '0000-00-00' \
         WHERE pr.tgl_perawatan BETWEEN ? AND ? {filter_sps} \
         GROUP BY pr.no_rawat, pr.tgl_perawatan, d.kd_dokter \
         ORDER BY pr.tgl_perawatan DESC, visit_pertama ASC"
    );

    let mut query = sqlx::query_as::<_, VisitRow>(&sql)
        .bind(&jam_target)
        .bind(&q.tgl_awal)
        .bind(&q.tgl_akhir);
    if !kd_sps.trim().is_empty() { query = query.bind(&kd_sps); }
    let rows = query.fetch_all(&state.pool).await.map_err(db_err)?;

    let total = rows.len() as i64;
    let tepat: i64 = rows.iter().filter(|r| r.tepat == 1).count() as i64;
    let persen = if total > 0 { (tepat as f64 / total as f64 * 100.0 * 10.0).round() / 10.0 } else { 0.0 };

    Ok(Json(json!({
        "jam_target": jam_target,
        "ringkasan": { "total": total, "tepat": tepat, "tidak_tepat": total - tepat, "persen_tepat": persen },
        "data": rows
    })))
}

/// Daftar spesialisasi (untuk dropdown filter).
pub async fn spesialis_list(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    #[derive(Serialize, sqlx::FromRow)]
    struct Sps { kd_sps: String, nm_sps: String }
    let rows: Vec<Sps> = sqlx::query_as::<_, Sps>(
        "SELECT kd_sps, nm_sps FROM spesialis ORDER BY nm_sps",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;
    Ok(Json(json!({ "data": rows })))
}
