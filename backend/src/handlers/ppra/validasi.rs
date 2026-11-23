//! Validasi mapping PPRA (V1/V2/V3 dari ppra_master_mapping.sql).
//! Dijalankan sebelum generate laporan; hasil ditampilkan sebagai banner di UI.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::State, http::StatusCode, Json};
use serde_json::{json, Value};

type ApiErr = (StatusCode, Json<Value>);
fn err500(e: impl std::fmt::Display) -> ApiErr {
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))
}

// V1: mapping yang isi_satuan-nya BEDA dengan ddd_satuan → hasil DDD salah.
#[derive(sqlx::FromRow, serde::Serialize)]
struct V1Row {
    kode_brng: String,
    atc_code: String,
    adm_route: String,
    isi_satuan: String,
    ddd_satuan: String,
}

// V2: item databarang yang kemungkinan antibiotik tapi BELUM dimapping.
#[derive(sqlx::FromRow, serde::Serialize)]
struct V2Row {
    kode_brng: String,
    nama_brng: String,
}

// V3: mapping "yatim" (atc_code tidak ada di referensi) → harusnya kosong (ada FK).
#[derive(sqlx::FromRow, serde::Serialize)]
struct V3Row {
    kode_brng: String,
    atc_code: String,
    adm_route: String,
}

/// GET /ppra/validasi — jalankan V1/V2/V3, kembalikan temuan + status.
pub async fn validasi(
    user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_view")?;
    let pool = &state.pool;

    // V1 — mismatch satuan
    let v1: Vec<V1Row> = sqlx::query_as(
        "SELECT m.kode_brng, m.atc_code, m.adm_route, m.isi_satuan, r.ddd_satuan
         FROM ppra_map_obat m
         JOIN ppra_atc_ref r ON r.atc_code = m.atc_code AND r.adm_route = m.adm_route
         WHERE m.isi_satuan <> r.ddd_satuan",
    )
    .fetch_all(pool)
    .await
    .map_err(err500)?;

    // V2 — antibiotik (heuristik nama) belum dimapping
    let v2: Vec<V2Row> = sqlx::query_as(
        "SELECT d.kode_brng, d.nama_brng
         FROM databarang d
         LEFT JOIN ppra_map_obat m ON m.kode_brng = d.kode_brng
         WHERE m.kode_brng IS NULL
           AND (d.nama_brng LIKE '%cef%'      OR d.nama_brng LIKE '%cipro%'
             OR d.nama_brng LIKE '%amox%'     OR d.nama_brng LIKE '%ampi%'
             OR d.nama_brng LIKE '%mero%'     OR d.nama_brng LIKE '%metronidazol%'
             OR d.nama_brng LIKE '%levoflox%' OR d.nama_brng LIKE '%gentamic%'
             OR d.nama_brng LIKE '%vanco%'    OR d.nama_brng LIKE '%clindamycin%')
         ORDER BY d.nama_brng
         LIMIT 500",
    )
    .fetch_all(pool)
    .await
    .map_err(err500)?;

    // V3 — mapping yatim
    let v3: Vec<V3Row> = sqlx::query_as(
        "SELECT m.kode_brng, m.atc_code, m.adm_route
         FROM ppra_map_obat m
         LEFT JOIN ppra_atc_ref r ON r.atc_code = m.atc_code AND r.adm_route = m.adm_route
         WHERE r.atc_code IS NULL",
    )
    .fetch_all(pool)
    .await
    .map_err(err500)?;

    let ada_masalah = !v1.is_empty() || !v3.is_empty();

    Ok(Json(json!({
        "ok": true,
        "ada_masalah": ada_masalah,
        "v1_mismatch_satuan": {
            "jumlah": v1.len(),
            "keterangan": "Mapping dgn isi_satuan != ddd_satuan (hasil DDD salah). Perbaiki mapping.",
            "data": v1,
        },
        "v2_belum_dimapping": {
            "jumlah": v2.len(),
            "keterangan": "Item databarang terindikasi antibiotik tapi belum dimapping (max 500).",
            "data": v2,
        },
        "v3_mapping_yatim": {
            "jumlah": v3.len(),
            "keterangan": "Mapping menunjuk ATC yang tidak ada di referensi (harusnya kosong krn FK).",
            "data": v3,
        },
    })))
}
