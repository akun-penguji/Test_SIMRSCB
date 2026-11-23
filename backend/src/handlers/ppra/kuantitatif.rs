//! Surveilans Kuantitatif PPRA — query konsumsi antibiotik (Khanza READ-ONLY)
//! + agregasi via engine `surveilans`. Endpoint JSON untuk dashboard/laporan.
//!
//! Read-only: hanya SELECT tabel klinis Khanza (detail_pemberian_obat,
//! resep_obat, resep_dokter, reg_periksa, kamar_inap) + ppra_map_obat/ppra_atc_ref.

use super::surveilans::{
    ddd_per_100_patient_days, ddd_per_1000_populations, du90, rekap_aware, AwareKategori,
    KonsumsiAB,
};
use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use chrono::Datelike;
use serde::Deserialize;
use serde_json::{json, Value};

type ApiErr = (StatusCode, Json<Value>);
fn err500(e: impl std::fmt::Display) -> ApiErr {
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))
}
fn err400(msg: &str) -> ApiErr {
    (StatusCode::BAD_REQUEST, Json(json!({ "error": msg })))
}

const DISCLAIMER: &str = "Nilai DDD mengacu referensi WHO ATC/DDD di ppra_atc_ref. \
    WAJIB verifikasi https://atcddd.fhi.no (edisi terbaru) sebelum dipakai untuk \
    laporan RL 3.19.3 / akreditasi. Obat belum dimapping tidak terhitung.";

#[derive(Deserialize)]
pub struct KuantitatifQuery {
    pub tgl_awal: Option<String>,
    pub tgl_akhir: Option<String>,
    pub jenis: Option<String>, // "ranap" (default) | "ralan"
}

/// Periode default = triwulan berjalan (awal kuartal s/d hari ini).
fn periode_default() -> (String, String) {
    let now = chrono::Local::now().date_naive();
    let q_start_month = ((now.month() - 1) / 3) * 3 + 1;
    let start = chrono::NaiveDate::from_ymd_opt(now.year(), q_start_month, 1).unwrap_or(now);
    (
        start.format("%Y-%m-%d").to_string(),
        now.format("%Y-%m-%d").to_string(),
    )
}

#[derive(sqlx::FromRow)]
struct KonsumsiRow {
    atc_code: String,
    adm_route: String,
    nama_generik: String,
    aware_kategori: String,
    ddd: f64,
    konsumsi: f64,
}

impl KonsumsiRow {
    fn into_ab(self) -> KonsumsiAB {
        KonsumsiAB {
            aware_kategori: AwareKategori::from_db(&self.aware_kategori),
            atc_code: self.atc_code,
            adm_route: self.adm_route,
            nama_generik: self.nama_generik,
            konsumsi: self.konsumsi,
            ddd: self.ddd,
        }
    }
}

/// Konsumsi ranap dari pemberian obat (detail_pemberian_obat).
pub(crate) async fn konsumsi_ranap(
    pool: &sqlx::MySqlPool,
    from: &str,
    to: &str,
) -> Result<Vec<KonsumsiAB>, ApiErr> {
    let rows: Vec<KonsumsiRow> = sqlx::query_as(
        "SELECT a.atc_code, a.adm_route, a.nama_generik, a.aware_kategori,
                CAST(a.ddd AS DOUBLE) AS ddd,
                CAST(SUM(dpo.jml * m.isi_zat_aktif) AS DOUBLE) AS konsumsi
         FROM detail_pemberian_obat dpo
         JOIN ppra_map_obat m ON m.kode_brng = dpo.kode_brng AND m.is_antibiotik = 1 AND m.aktif = 1
         JOIN ppra_atc_ref a ON a.atc_code = m.atc_code AND a.adm_route = m.adm_route
         WHERE dpo.tgl_perawatan BETWEEN ? AND ?
         GROUP BY a.atc_code, a.adm_route, a.nama_generik, a.aware_kategori, a.ddd",
    )
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await
    .map_err(err500)?;
    Ok(rows.into_iter().map(KonsumsiRow::into_ab).collect())
}

/// Konsumsi ralan/IGD dari resep (resep_obat + resep_dokter).
pub(crate) async fn konsumsi_ralan(
    pool: &sqlx::MySqlPool,
    from: &str,
    to: &str,
) -> Result<Vec<KonsumsiAB>, ApiErr> {
    let rows: Vec<KonsumsiRow> = sqlx::query_as(
        "SELECT a.atc_code, a.adm_route, a.nama_generik, a.aware_kategori,
                CAST(a.ddd AS DOUBLE) AS ddd,
                CAST(SUM(rd.jml * m.isi_zat_aktif) AS DOUBLE) AS konsumsi
         FROM resep_obat ro
         JOIN resep_dokter rd ON rd.no_resep = ro.no_resep
         JOIN ppra_map_obat m ON m.kode_brng = rd.kode_brng AND m.is_antibiotik = 1 AND m.aktif = 1
         JOIN ppra_atc_ref a ON a.atc_code = m.atc_code AND a.adm_route = m.adm_route
         JOIN reg_periksa rp ON rp.no_rawat = ro.no_rawat
         WHERE ro.tgl_perawatan BETWEEN ? AND ? AND rp.status_lanjut = 'Ralan'
         GROUP BY a.atc_code, a.adm_route, a.nama_generik, a.aware_kategori, a.ddd",
    )
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await
    .map_err(err500)?;
    Ok(rows.into_iter().map(KonsumsiRow::into_ab).collect())
}

/// Total hari rawat (patient-days) pada periode: overlap lama inap dgn [from,to].
/// Konvensi DATEDIFF (sesuai handler SIRS existing). Stay ongoing pakai CURDATE().
pub(crate) async fn total_hari_rawat(pool: &sqlx::MySqlPool, from: &str, to: &str) -> Result<f64, ApiErr> {
    let v: Option<f64> = sqlx::query_scalar(
        "SELECT CAST(SUM(GREATEST(
                    DATEDIFF(
                      LEAST(IFNULL(NULLIF(ki.tgl_keluar,'0000-00-00'), CURDATE()), ?),
                      GREATEST(ki.tgl_masuk, ?)
                    ), 0)) AS DOUBLE)
         FROM kamar_inap ki
         WHERE ki.tgl_masuk <= ?
           AND IFNULL(NULLIF(ki.tgl_keluar,'0000-00-00'), CURDATE()) >= ?",
    )
    .bind(to)
    .bind(from)
    .bind(to)
    .bind(from)
    .fetch_one(pool)
    .await
    .map_err(err500)?;
    Ok(v.unwrap_or(0.0))
}

/// Jumlah kunjungan ralan (denominator DDD/1000).
pub(crate) async fn total_kunjungan_ralan(pool: &sqlx::MySqlPool, from: &str, to: &str) -> Result<f64, ApiErr> {
    let n: i64 = sqlx::query_scalar(
        "SELECT CAST(COUNT(DISTINCT no_rawat) AS SIGNED)
         FROM reg_periksa
         WHERE tgl_registrasi BETWEEN ? AND ? AND status_lanjut = 'Ralan'",
    )
    .bind(from)
    .bind(to)
    .fetch_one(pool)
    .await
    .map_err(err500)?;
    Ok(n as f64)
}

/// Ambang Access% dari ppra_config (default 60).
pub(crate) async fn ambang_access(pool: &sqlx::MySqlPool) -> f64 {
    let v: Option<String> = sqlx::query_scalar(
        "SELECT cfg_value FROM ppra_config WHERE cfg_key = 'ambang_access_persen' LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    v.and_then(|s| s.trim().parse::<f64>().ok()).unwrap_or(60.0)
}

/// GET /ppra/kuantitatif?tgl_awal&tgl_akhir&jenis=ranap|ralan
pub async fn kuantitatif(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<KuantitatifQuery>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_view")?;
    let (def_awal, def_akhir) = periode_default();
    let from = q.tgl_awal.filter(|s| !s.trim().is_empty()).unwrap_or(def_awal);
    let to = q.tgl_akhir.filter(|s| !s.trim().is_empty()).unwrap_or(def_akhir);
    let jenis = q.jenis.unwrap_or_else(|| "ranap".to_string());
    if jenis != "ranap" && jenis != "ralan" {
        return Err(err400("jenis harus 'ranap' atau 'ralan'"));
    }

    let items = if jenis == "ranap" {
        konsumsi_ranap(&state.pool, &from, &to).await?
    } else {
        konsumsi_ralan(&state.pool, &from, &to).await?
    };

    let target = ambang_access(&state.pool).await;
    let aware = rekap_aware(&items, target);
    let total_ddd = aware.total;

    // Denominator + rasio utama sesuai jenis
    let (denominator_label, denominator_val, rasio_label, rasio_val) = if jenis == "ranap" {
        let hr = total_hari_rawat(&state.pool, &from, &to).await?;
        ("hari_rawat", hr, "ddd_per_100_patient_days", ddd_per_100_patient_days(total_ddd, hr))
    } else {
        let kj = total_kunjungan_ralan(&state.pool, &from, &to).await?;
        ("kunjungan", kj, "ddd_per_1000_populations", ddd_per_1000_populations(total_ddd, kj))
    };

    let per_ab: Vec<Value> = items
        .iter()
        .map(|it| {
            json!({
                "atc_code": it.atc_code,
                "adm_route": it.adm_route,
                "nama_generik": it.nama_generik,
                "aware_kategori": it.aware_kategori,
                "konsumsi": it.konsumsi,
                "ddd": it.ddd,
                "total_ddd": it.total_ddd(),
            })
        })
        .collect();

    Ok(Json(json!({
        "ok": true,
        "periode": { "tgl_awal": from, "tgl_akhir": to, "jenis": jenis },
        "denominator": { "label": denominator_label, "nilai": denominator_val },
        "ringkasan": {
            "total_ddd": total_ddd,
            "rasio_label": rasio_label,
            "rasio": rasio_val,
            "aware": aware,
        },
        "per_antibiotik": per_ab,
        "du90": du90(&items),
        "disclaimer": DISCLAIMER,
    })))
}
