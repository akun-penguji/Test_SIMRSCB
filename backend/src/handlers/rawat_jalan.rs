use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct RawatJalanQuery {
    pub tgl_awal:     Option<String>,
    pub tgl_akhir:    Option<String>,
    pub poli:         Option<String>,
    pub dokter:       Option<String>,
    pub cari:         Option<String>,
    pub status:       Option<String>, // stts
    pub status_bayar: Option<String>, // status_bayar
    pub page:         Option<i64>,
    pub size:         Option<i64>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct RawatJalan {
    pub no_rawat:        String,
    pub tgl_registrasi:  Option<String>,
    pub jam_reg:         Option<String>,
    pub no_rm:           String,
    pub nm_pasien:       Option<String>,
    pub umur:            Option<String>,
    pub no_tlp:          Option<String>,
    pub kd_dokter:       Option<String>,
    pub nm_dokter:       Option<String>,
    pub kd_poli:         Option<String>,
    pub nm_poli:         Option<String>,
    pub kd_pj:           Option<String>,
    pub png_jawab:       Option<String>,
    pub p_jawab:         Option<String>,
    pub almt_pj:         Option<String>,
    pub hubunganpj:      Option<String>,
    pub biaya_reg:       Option<f64>,
    pub stts:            Option<String>,
    pub stts_daftar:     Option<String>,
    pub status_bayar:    Option<String>,
    pub status_poli:     Option<String>,
    pub no_reg:          Option<String>,
}

#[derive(Serialize)]
pub struct RawatJalanListResponse {
    pub data:  Vec<RawatJalan>,
    pub total: i64,
    pub page:  i64,
    pub size:  i64,
}

// Daftar pasien Rawat Jalan (port DlgKasirRalan.tampilkasir — daftar saja).
// Filter: rentang tgl_registrasi + status_lanjut='Ralan' (kecuali IGDK — IGD punya halaman sendiri).
pub async fn list_rawat_jalan(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<RawatJalanQuery>,
) -> Result<Json<RawatJalanListResponse>, (StatusCode, Json<Value>)> {
    let page   = q.page.unwrap_or(1).max(1);
    let size   = q.size.unwrap_or(50).min(500);
    let offset = (page - 1) * size;
    let today  = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tgl_awal  = q.tgl_awal.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| today.clone());
    let tgl_akhir = q.tgl_akhir.filter(|s| !s.trim().is_empty()).unwrap_or(today);

    let poli_like   = format!("%{}%", q.poli.unwrap_or_default());
    let dokter_like = format!("%{}%", q.dokter.unwrap_or_default());
    let cari_like   = format!("%{}%", q.cari.unwrap_or_default());
    let status_like = match q.status.as_deref().unwrap_or("Semua") {
        "Semua" | "" => "%".to_string(),
        s => s.to_string(),
    };
    let bayar_like = match q.status_bayar.as_deref().unwrap_or("Semua") {
        "Semua" | "" => "%".to_string(),
        s => s.to_string(),
    };

    const FROM_WHERE: &str =
        "FROM reg_periksa r
         LEFT JOIN pasien p      ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN poliklinik po ON r.kd_poli = po.kd_poli
         LEFT JOIN dokter d      ON r.kd_dokter = d.kd_dokter
         LEFT JOIN penjab pj     ON r.kd_pj = pj.kd_pj
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND r.status_lanjut = 'Ralan'
           AND r.kd_poli != 'IGDK'
           AND po.nm_poli LIKE ?
           AND d.nm_dokter LIKE ?
           AND r.stts LIKE ?
           AND r.status_bayar LIKE ?
           AND (r.no_reg LIKE ? OR r.no_rawat LIKE ? OR p.nm_pasien LIKE ?
                OR po.nm_poli LIKE ? OR d.nm_dokter LIKE ? OR r.p_jawab LIKE ?
                OR pj.png_jawab LIKE ?)";

    let total: (i64,) = sqlx::query_as(&format!("SELECT COUNT(*) {FROM_WHERE}"))
        .bind(&tgl_awal).bind(&tgl_akhir)
        .bind(&poli_like).bind(&dokter_like).bind(&status_like).bind(&bayar_like)
        .bind(&cari_like).bind(&cari_like).bind(&cari_like)
        .bind(&cari_like).bind(&cari_like).bind(&cari_like).bind(&cari_like)
        .fetch_one(&state.pool)
        .await
        .map_err(db_err)?;

    let data: Vec<RawatJalan> = sqlx::query_as(&format!(
        "SELECT r.no_rawat,
                DATE_FORMAT(r.tgl_registrasi,'%Y-%m-%d') AS tgl_registrasi,
                TIME_FORMAT(r.jam_reg,'%H:%i:%s') AS jam_reg,
                r.no_rkm_medis AS no_rm, p.nm_pasien,
                CONCAT(IFNULL(r.umurdaftar,''),' ',IFNULL(r.sttsumur,'')) AS umur,
                p.no_tlp,
                r.kd_dokter, d.nm_dokter, r.kd_poli, po.nm_poli,
                r.kd_pj, pj.png_jawab, r.p_jawab, r.almt_pj, r.hubunganpj,
                CAST(IFNULL(r.biaya_reg,0) AS DOUBLE) AS biaya_reg,
                r.stts, r.stts_daftar, r.status_bayar, r.status_poli, r.no_reg
         {FROM_WHERE}
         ORDER BY r.tgl_registrasi DESC, r.no_reg, r.no_rawat
         LIMIT ? OFFSET ?"
    ))
    .bind(&tgl_awal).bind(&tgl_akhir)
    .bind(&poli_like).bind(&dokter_like).bind(&status_like).bind(&bayar_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(size).bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(RawatJalanListResponse { data, total: total.0, page, size }))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error rawat_jalan: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
