// PP 3 — Waktu tunggu hasil lab (turnaround time) reguler vs cito.
// TAT = menit dari permintaan sampai hasil keluar. Prioritas dari companion
// permintaan_lab_prioritas (default Rutin). Target: Cito ≤60, Rutin ≤140 menit.
use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB waktu_tunggu_lab: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))
}

const TARGET_CITO: i64 = 60;
const TARGET_RUTIN: i64 = 140;

#[derive(Deserialize)]
pub struct Q { pub tahun: Option<i64> }

#[derive(sqlx::FromRow)]
struct Row { bln: i64, prioritas: String, total: i64, avg_menit: Option<f64>, ontarget: i64 }

pub async fn rekap(
    _u: AuthUser,
    State(s): State<AppState>,
    Query(q): Query<Q>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = match q.tahun.filter(|v| *v > 0) {
        Some(t) => t,
        None => sqlx::query_scalar::<_, i64>("SELECT YEAR(NOW())").fetch_one(&s.pool).await.map_err(db_err)?,
    };
    let rows: Vec<Row> = sqlx::query_as(
        "SELECT CAST(MONTH(pl.tgl_permintaan) AS SIGNED) AS bln, \
                IFNULL(plp.prioritas,'Rutin') AS prioritas, \
                CAST(COUNT(*) AS SIGNED) AS total, \
                AVG(TIMESTAMPDIFF(MINUTE, TIMESTAMP(pl.tgl_permintaan,pl.jam_permintaan), TIMESTAMP(pl.tgl_hasil,pl.jam_hasil))) AS avg_menit, \
                CAST(SUM(CASE WHEN TIMESTAMPDIFF(MINUTE, TIMESTAMP(pl.tgl_permintaan,pl.jam_permintaan), TIMESTAMP(pl.tgl_hasil,pl.jam_hasil)) \
                              <= (CASE WHEN IFNULL(plp.prioritas,'Rutin')='Cito' THEN ? ELSE ? END) THEN 1 ELSE 0 END) AS SIGNED) AS ontarget \
         FROM permintaan_lab pl \
         LEFT JOIN permintaan_lab_prioritas plp ON plp.noorder = pl.noorder \
         WHERE pl.tgl_hasil <> '0000-00-00' AND pl.tgl_hasil IS NOT NULL \
           AND pl.jam_hasil <> '00:00:00' AND YEAR(pl.tgl_permintaan) = ? \
         GROUP BY MONTH(pl.tgl_permintaan), IFNULL(plp.prioritas,'Rutin')",
    )
    .bind(TARGET_CITO).bind(TARGET_RUTIN).bind(tahun)
    .fetch_all(&s.pool).await.map_err(db_err)?;

    // Pivot per bulan × prioritas.
    #[derive(Default, Serialize, Clone)]
    struct Cell { total: i64, avg_menit: f64, ontarget: i64, pct: f64 }
    let mut bulan_rutin: Vec<Cell> = vec![Cell::default(); 12];
    let mut bulan_cito: Vec<Cell> = vec![Cell::default(); 12];
    let (mut t_rutin, mut ot_rutin, mut t_cito, mut ot_cito) = (0i64, 0i64, 0i64, 0i64);
    for r in &rows {
        if r.bln < 1 || r.bln > 12 { continue; }
        let cell = Cell {
            total: r.total,
            avg_menit: (r.avg_menit.unwrap_or(0.0) * 10.0).round() / 10.0,
            ontarget: r.ontarget,
            pct: if r.total > 0 { (r.ontarget as f64) * 100.0 / (r.total as f64) } else { 0.0 },
        };
        if r.prioritas == "Cito" {
            t_cito += r.total; ot_cito += r.ontarget; bulan_cito[(r.bln - 1) as usize] = cell;
        } else {
            t_rutin += r.total; ot_rutin += r.ontarget; bulan_rutin[(r.bln - 1) as usize] = cell;
        }
    }
    let pct = |ot: i64, t: i64| if t > 0 { (ot as f64) * 100.0 / (t as f64) } else { 0.0 };

    Ok(Json(json!({
        "tahun": tahun,
        "target": { "cito": TARGET_CITO, "rutin": TARGET_RUTIN },
        "ringkasan": {
            "rutin": { "total": t_rutin, "ontarget": ot_rutin, "pct": pct(ot_rutin, t_rutin) },
            "cito":  { "total": t_cito,  "ontarget": ot_cito,  "pct": pct(ot_cito, t_cito) },
        },
        "bulan_rutin": bulan_rutin,
        "bulan_cito": bulan_cito,
    })))
}
