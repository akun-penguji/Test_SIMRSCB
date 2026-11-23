use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct BookingQuery {
    pub mode:      Option<String>, // menunggu (default) | proses | jadwal | selesai
    pub tgl_awal:  Option<String>,
    pub tgl_akhir: Option<String>,
    pub cari:      Option<String>,
    pub page:      Option<i64>,
    pub size:      Option<i64>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct BookingRow {
    pub no_rawat:    String,
    pub no_rm:       Option<String>,
    pub nm_pasien:   Option<String>,
    pub umur:        Option<String>,
    pub jk:          Option<String>,
    pub tanggal:     Option<String>,
    pub jam_mulai:   Option<String>,
    pub jam_selesai: Option<String>,
    pub operasi:     Option<String>,
    pub kode_paket:  Option<String>,
    pub kd_dokter:   Option<String>,
    pub operator:    Option<String>,
    pub kd_ruang_ok: Option<String>,
    pub ruang_ok:    Option<String>,
    pub order_rawat: Option<String>,
    pub status:      Option<String>,
}

#[derive(Serialize)]
pub struct BookingListResponse {
    pub data:  Vec<BookingRow>,
    pub total: i64,
    pub page:  i64,
    pub size:  i64,
}

// Daftar Booking Operasi (port DlgBookingOperasi.tampil — daftar saja).
pub async fn list_booking(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<BookingQuery>,
) -> Result<Json<BookingListResponse>, (StatusCode, Json<Value>)> {
    let page   = q.page.unwrap_or(1).max(1);
    let size   = q.size.unwrap_or(200).min(1000);
    let offset = (page - 1) * size;
    let today  = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tgl_awal  = q.tgl_awal.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| today.clone());
    let tgl_akhir = q.tgl_akhir.filter(|s| !s.trim().is_empty()).unwrap_or(today);
    let cari_like = format!("%{}%", q.cari.unwrap_or_default());
    let mode = q.mode.unwrap_or_else(|| "menunggu".to_string());

    let mut cond = String::new();
    let mut binds: Vec<String> = Vec::new();
    match mode.trim() {
        "proses"  => cond.push_str(" AND bo.status='Proses Operasi'"),
        "selesai" => {
            cond.push_str(" AND bo.status='Selesai' AND bo.tanggal BETWEEN ? AND ?");
            binds.push(tgl_awal.clone()); binds.push(tgl_akhir.clone());
        }
        "jadwal"  => {
            cond.push_str(" AND bo.tanggal BETWEEN ? AND ?");
            binds.push(tgl_awal.clone()); binds.push(tgl_akhir.clone());
        }
        _ => cond.push_str(" AND bo.status='Menunggu'"), // menunggu (default)
    }
    cond.push_str(
        " AND (bo.no_rawat LIKE ? OR rp.no_rkm_medis LIKE ? OR p.nm_pasien LIKE ?
             OR bo.status LIKE ? OR d.nm_dokter LIKE ? OR po.nm_perawatan LIKE ?
             OR ro.nm_ruang_ok LIKE ?)",
    );
    for _ in 0..7 { binds.push(cari_like.clone()); }

    const FROM: &str =
        "FROM booking_operasi bo
         JOIN reg_periksa rp     ON rp.no_rawat = bo.no_rawat
         LEFT JOIN pasien p       ON p.no_rkm_medis = rp.no_rkm_medis
         LEFT JOIN paket_operasi po ON po.kode_paket = bo.kode_paket
         LEFT JOIN dokter d       ON d.kd_dokter = bo.kd_dokter
         LEFT JOIN ruang_ok ro    ON ro.kd_ruang_ok = bo.kd_ruang_ok
         WHERE 1=1";

    let count_sql = format!("SELECT COUNT(*) {FROM}{cond}");
    let mut cq = sqlx::query_as::<_, (i64,)>(&count_sql);
    for b in &binds { cq = cq.bind(b); }
    let total = cq.fetch_one(&state.pool).await.map_err(db_err)?;

    let data_sql = format!(
        "SELECT bo.no_rawat, rp.no_rkm_medis AS no_rm, p.nm_pasien,
                CONCAT(IFNULL(rp.umurdaftar,''),' ',IFNULL(rp.sttsumur,'')) AS umur, p.jk,
                DATE_FORMAT(bo.tanggal,'%Y-%m-%d') AS tanggal,
                TIME_FORMAT(bo.jam_mulai,'%H:%i:%s') AS jam_mulai,
                TIME_FORMAT(bo.jam_selesai,'%H:%i:%s') AS jam_selesai,
                po.nm_perawatan AS operasi, bo.kode_paket,
                bo.kd_dokter, d.nm_dokter AS operator,
                bo.kd_ruang_ok, ro.nm_ruang_ok AS ruang_ok,
                rp.status_lanjut AS order_rawat, bo.status
         {FROM}{cond}
         ORDER BY bo.tanggal, bo.jam_mulai
         LIMIT ? OFFSET ?"
    );
    let mut dq = sqlx::query_as::<_, BookingRow>(&data_sql);
    for b in &binds { dq = dq.bind(b); }
    dq = dq.bind(size).bind(offset);
    let data = dq.fetch_all(&state.pool).await.map_err(db_err)?;

    Ok(Json(BookingListResponse { data, total: total.0, page, size }))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error operasi: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
