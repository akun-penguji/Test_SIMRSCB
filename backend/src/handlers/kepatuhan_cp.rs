// Rekap Kepatuhan Clinical Pathway (item-based).
// Kepatuhan = item CP berstatus 'done' / total item CP, per template (diagnosis) & episode.
// Sumber: cp_template, cp_eksekusi (tgl_mulai), cp_eksekusi_item (status done/pending).

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB kepatuhan_cp: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data kepatuhan CP"})))
}

#[derive(Deserialize)]
pub struct RangeQuery {
    pub tgl_awal: String,
    pub tgl_akhir: String,
}

#[derive(sqlx::FromRow)]
struct SumRaw {
    id_template: i64,
    nama_cp: String,
    kode_icd10: String,
    target_los_hari: i64,
    kasus: i64,
    item_done: i64,
    item_total: i64,
}

#[derive(sqlx::FromRow)]
struct DetRaw {
    no_rawat: String,
    tgl_mulai: String,
    nm_pasien: String,
    nama_cp: String,
    item_done: i64,
    item_total: i64,
}

fn pct(done: i64, total: i64) -> f64 {
    if total > 0 { (done as f64 / total as f64 * 1000.0).round() / 10.0 } else { 0.0 }
}

pub async fn rekap(
    _u: AuthUser,
    State(s): State<AppState>,
    Query(q): Query<RangeQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if q.tgl_awal.trim().is_empty() || q.tgl_akhir.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Tanggal awal & akhir wajib"}))));
    }
    // Ringkasan per CP (template)
    let sums: Vec<SumRaw> = sqlx::query_as::<_, SumRaw>(
        "SELECT t.id_template, t.nama_cp, IFNULL(t.kode_icd10,'') kode_icd10, IFNULL(t.target_los_hari,0) target_los_hari, \
                COUNT(DISTINCT e.id_eksekusi) kasus, \
                IFNULL(SUM(i.status='done'),0) item_done, \
                IFNULL(SUM(i.id_eksi IS NOT NULL),0) item_total \
         FROM cp_template t \
         LEFT JOIN cp_eksekusi e ON e.id_template=t.id_template AND DATE(e.tgl_mulai) BETWEEN ? AND ? \
         LEFT JOIN cp_eksekusi_item i ON i.id_eksekusi=e.id_eksekusi \
         GROUP BY t.id_template \
         HAVING kasus > 0 \
         ORDER BY kasus DESC",
    )
    .bind(&q.tgl_awal).bind(&q.tgl_akhir)
    .fetch_all(&s.pool).await.map_err(db_err)?;

    let per_cp: Vec<Value> = sums.iter().map(|r| json!({
        "id_template": r.id_template, "nama_cp": r.nama_cp, "kode_icd10": r.kode_icd10,
        "target_los_hari": r.target_los_hari, "kasus": r.kasus,
        "item_done": r.item_done, "item_total": r.item_total, "persen": pct(r.item_done, r.item_total),
    })).collect();

    let tot_done: i64 = sums.iter().map(|r| r.item_done).sum();
    let tot_item: i64 = sums.iter().map(|r| r.item_total).sum();
    let tot_kasus: i64 = sums.iter().map(|r| r.kasus).sum();

    // Detail per episode (pasien)
    let dets: Vec<DetRaw> = sqlx::query_as::<_, DetRaw>(
        "SELECT e.no_rawat, CAST(e.tgl_mulai AS CHAR) tgl_mulai, IFNULL(ps.nm_pasien,'') nm_pasien, t.nama_cp, \
                IFNULL(SUM(i.status='done'),0) item_done, IFNULL(COUNT(i.id_eksi),0) item_total \
         FROM cp_eksekusi e \
         INNER JOIN cp_template t ON t.id_template=e.id_template \
         LEFT JOIN cp_eksekusi_item i ON i.id_eksekusi=e.id_eksekusi \
         LEFT JOIN reg_periksa rp ON rp.no_rawat=e.no_rawat \
         LEFT JOIN pasien ps ON ps.no_rkm_medis=rp.no_rkm_medis \
         WHERE DATE(e.tgl_mulai) BETWEEN ? AND ? \
         GROUP BY e.id_eksekusi \
         ORDER BY e.tgl_mulai DESC",
    )
    .bind(&q.tgl_awal).bind(&q.tgl_akhir)
    .fetch_all(&s.pool).await.map_err(db_err)?;

    let detail: Vec<Value> = dets.iter().map(|r| json!({
        "no_rawat": r.no_rawat, "tgl_mulai": r.tgl_mulai, "nm_pasien": r.nm_pasien, "nama_cp": r.nama_cp,
        "item_done": r.item_done, "item_total": r.item_total, "persen": pct(r.item_done, r.item_total),
    })).collect();

    Ok(Json(json!({
        "ringkasan": { "kasus": tot_kasus, "item_done": tot_done, "item_total": tot_item, "persen": pct(tot_done, tot_item) },
        "per_cp": per_cp,
        "detail": detail
    })))
}
