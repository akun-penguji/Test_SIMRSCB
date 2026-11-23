//! Ekspor & agregasi laporan PPRA: CSV kuantitatif, tren DDD/100 bulanan,
//! dan statistik ringkas untuk dashboard.

use super::kuantitatif::{
    ambang_access, konsumsi_ralan, konsumsi_ranap, total_hari_rawat, total_kunjungan_ralan,
};
use super::surveilans::{ddd_per_100_patient_days, ddd_per_1000_populations, rekap_aware};
use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::{Datelike, NaiveDate};
use serde::Deserialize;
use serde_json::{json, Value};

type ApiErr = (StatusCode, Json<Value>);

fn periode_default() -> (String, String) {
    let now = chrono::Local::now().date_naive();
    let qm = ((now.month() - 1) / 3) * 3 + 1;
    let start = NaiveDate::from_ymd_opt(now.year(), qm, 1).unwrap_or(now);
    (start.format("%Y-%m-%d").to_string(), now.format("%Y-%m-%d").to_string())
}

fn resolve_periode(a: Option<String>, b: Option<String>) -> (String, String) {
    let (da, db) = periode_default();
    (
        a.filter(|s| !s.trim().is_empty()).unwrap_or(da),
        b.filter(|s| !s.trim().is_empty()).unwrap_or(db),
    )
}

fn csv_field(s: &str) -> String {
    if s.contains([',', '"', '\n']) {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

#[derive(Deserialize)]
pub struct EksporQuery {
    pub tgl_awal: Option<String>,
    pub tgl_akhir: Option<String>,
    pub jenis: Option<String>,
}

/// GET /ppra/ekspor/kuantitatif.csv — CSV per antibiotik (siap olah RL 3.19.3).
pub async fn ekspor_kuantitatif_csv(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<EksporQuery>,
) -> Result<impl IntoResponse, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_view")?;
    let (from, to) = resolve_periode(q.tgl_awal, q.tgl_akhir);
    let jenis = q.jenis.unwrap_or_else(|| "ranap".into());
    let items = if jenis == "ralan" {
        konsumsi_ralan(&state.pool, &from, &to).await?
    } else {
        konsumsi_ranap(&state.pool, &from, &to).await?
    };

    let target = ambang_access(&state.pool).await;
    let aware = rekap_aware(&items, target);
    let (denom_label, denom, rasio) = if jenis == "ralan" {
        let kj = total_kunjungan_ralan(&state.pool, &from, &to).await?;
        ("kunjungan", kj, ddd_per_1000_populations(aware.total, kj))
    } else {
        let hr = total_hari_rawat(&state.pool, &from, &to).await?;
        ("hari_rawat", hr, ddd_per_100_patient_days(aware.total, hr))
    };

    let mut csv = String::new();
    csv.push_str(&format!("# Laporan Kuantitatif PPRA ({jenis}) periode {from} s/d {to}\n"));
    csv.push_str(&format!(
        "# Total DDD={:.4}; {denom_label}={:.0}; rasio={:.4}; Access%={:.2} (target {:.0})\n",
        aware.total, denom, rasio, aware.access_persen, aware.target_persen
    ));
    csv.push_str("atc_code,adm_route,nama_generik,aware_kategori,konsumsi,ddd,total_ddd\n");
    for it in &items {
        csv.push_str(&format!(
            "{},{},{},{:?},{:.4},{:.4},{:.4}\n",
            csv_field(&it.atc_code),
            csv_field(&it.adm_route),
            csv_field(&it.nama_generik),
            it.aware_kategori,
            it.konsumsi,
            it.ddd,
            it.total_ddd(),
        ));
    }

    let fname = format!("ppra_kuantitatif_{jenis}_{from}_sd_{to}.csv");
    Ok((
        [
            (header::CONTENT_TYPE, "text/csv; charset=utf-8".to_string()),
            (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{fname}\"")),
        ],
        csv,
    ))
}

#[derive(Deserialize)]
pub struct TrenQuery {
    pub jenis: Option<String>,
    pub bulan: Option<i64>,
}

/// GET /ppra/tren?jenis&bulan — DDD/100 (atau /1000) per bulan, N bulan terakhir.
pub async fn tren(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<TrenQuery>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_view")?;
    let jenis = q.jenis.unwrap_or_else(|| "ranap".into());
    let n = q.bulan.unwrap_or(6).clamp(1, 24);
    let target = ambang_access(&state.pool).await;
    let now = chrono::Local::now().date_naive();

    let mut out: Vec<Value> = Vec::new();
    for i in (0..n).rev() {
        // bulan = current month - i
        let mut y = now.year();
        let mut m = now.month() as i64 - i;
        while m <= 0 {
            m += 12;
            y -= 1;
        }
        let m = m as u32;
        let from = NaiveDate::from_ymd_opt(y, m, 1).unwrap();
        // akhir bulan = hari sebelum awal bulan berikutnya; cap ke hari ini utk bulan berjalan
        let (ny, nm) = if m == 12 { (y + 1, 1) } else { (y, m + 1) };
        let mut to = NaiveDate::from_ymd_opt(ny, nm, 1).unwrap().pred_opt().unwrap();
        if to > now {
            to = now;
        }
        let (fs, ts) = (from.format("%Y-%m-%d").to_string(), to.format("%Y-%m-%d").to_string());

        let items = if jenis == "ralan" {
            konsumsi_ralan(&state.pool, &fs, &ts).await?
        } else {
            konsumsi_ranap(&state.pool, &fs, &ts).await?
        };
        let aware = rekap_aware(&items, target);
        let (denom, rasio) = if jenis == "ralan" {
            let kj = total_kunjungan_ralan(&state.pool, &fs, &ts).await?;
            (kj, ddd_per_1000_populations(aware.total, kj))
        } else {
            let hr = total_hari_rawat(&state.pool, &fs, &ts).await?;
            (hr, ddd_per_100_patient_days(aware.total, hr))
        };
        out.push(json!({
            "bulan": from.format("%Y-%m").to_string(),
            "total_ddd": aware.total,
            "denominator": denom,
            "rasio": rasio,
            "access_persen": aware.access_persen,
        }));
    }

    Ok(Json(json!({ "ok": true, "jenis": jenis, "target_persen": target, "data": out })))
}

/// GET /ppra/stats — hitung ringkas untuk dashboard.
pub async fn stats(
    user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_view")?;
    let err500 = |e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })));
    let atc_ref: i64 = sqlx::query_scalar("SELECT CAST(COUNT(*) AS SIGNED) FROM ppra_atc_ref")
        .fetch_one(&state.pool).await.map_err(err500)?;
    let mapping_aktif: i64 = sqlx::query_scalar(
        "SELECT CAST(COUNT(*) AS SIGNED) FROM ppra_map_obat WHERE is_antibiotik=1 AND aktif=1")
        .fetch_one(&state.pool).await.map_err(err500)?;
    let audit_gyssens: i64 = sqlx::query_scalar("SELECT CAST(COUNT(*) AS SIGNED) FROM ppra_gyssens_audit")
        .fetch_one(&state.pool).await.map_err(err500)?;
    Ok(Json(json!({
        "ok": true,
        "atc_ref": atc_ref,
        "mapping_aktif": mapping_aktif,
        "audit_gyssens": audit_gyssens,
    })))
}
