use crate::AppState;
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct StokMinimumQuery {
    pub kd_bangsal: Option<String>,   // filter per depo; kosong = semua depo aktif
    pub ratio:      Option<f64>,       // threshold: 1.0 = critical only, 1.5 = +50% buffer (default 1.5)
    pub search:     Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct StokRow {
    pub kode_brng:     String,
    pub nama_brng:     String,
    pub satuan:        String,
    pub jenis:         String,
    pub kd_bangsal:    String,
    pub nm_bangsal:    String,
    pub stok_minimal:  f64,
    pub stok_saat_ini: f64,
    pub selisih:       f64,        // stok_saat_ini - stok_minimal
}

#[derive(Serialize)]
pub struct StokMinimumResp {
    pub critical:  Vec<StokRow>,   // stok <= minimal (sudah mentok / negatif)
    pub warning:   Vec<StokRow>,   // stok > minimal AND stok <= minimal * ratio
    pub total_critical: usize,
    pub total_warning:  usize,
}

pub async fn list_stok_minimum(
    _u: crate::auth::middleware::AuthUser,
    State(state): State<AppState>,
    Query(q):     Query<StokMinimumQuery>,
) -> Result<Json<StokMinimumResp>, (StatusCode, Json<Value>)> {
    let ratio = q.ratio.unwrap_or(1.5).clamp(1.0, 5.0);
    let search_like = format!("%{}%", q.search.as_deref().unwrap_or(""));

    // Query satu kali pakai aggregate SUM(gb.stok).
    // IFNULL(smb.stok_minimal, d.stokminimal) → override per depo > master.
    // HAVING: hanya tampilkan yang stok <= minimal × ratio AND minimal > 0.
    let sql = "\
        SELECT \
          d.kode_brng,                            \
          d.nama_brng,                            \
          IFNULL(ks.satuan,'') AS satuan,         \
          IFNULL(j.nama,'')    AS jenis,          \
          b.kd_bangsal,                           \
          b.nm_bangsal,                           \
          CAST(IFNULL(smb.stok_minimal, d.stokminimal) AS DOUBLE) AS stok_minimal, \
          CAST(IFNULL(SUM(gb.stok), 0)                  AS DOUBLE) AS stok_saat_ini, \
          CAST(IFNULL(SUM(gb.stok), 0) - IFNULL(smb.stok_minimal, d.stokminimal) AS DOUBLE) AS selisih \
        FROM databarang d \
        INNER JOIN bangsal b ON b.status='1' AND b.kd_bangsal <> '-' \
        LEFT JOIN kodesatuan ks ON d.kode_sat = ks.kode_sat \
        LEFT JOIN jenis j       ON d.kdjns    = j.kdjns \
        LEFT JOIN stok_minimal_bangsal smb \
          ON smb.kode_brng=d.kode_brng AND smb.kd_bangsal=b.kd_bangsal AND smb.aktif=1 \
        LEFT JOIN gudangbarang gb \
          ON gb.kode_brng=d.kode_brng AND gb.kd_bangsal=b.kd_bangsal \
        WHERE d.status='1' \
          AND (? = '' OR b.kd_bangsal = ?) \
          AND (d.nama_brng LIKE ? OR d.kode_brng LIKE ?) \
        GROUP BY d.kode_brng, d.nama_brng, ks.satuan, j.nama, b.kd_bangsal, b.nm_bangsal, smb.stok_minimal, d.stokminimal \
        HAVING IFNULL(smb.stok_minimal, d.stokminimal) > 0 \
           AND IFNULL(SUM(gb.stok), 0) <= IFNULL(smb.stok_minimal, d.stokminimal) * ? \
        ORDER BY b.nm_bangsal, (IFNULL(SUM(gb.stok), 0) - IFNULL(smb.stok_minimal, d.stokminimal)), d.nama_brng \
        LIMIT 2000";

    let kd_depo = q.kd_bangsal.unwrap_or_default();
    let rows: Vec<StokRow> = sqlx::query_as(sql)
        .bind(&kd_depo).bind(&kd_depo)
        .bind(&search_like).bind(&search_like)
        .bind(ratio)
        .fetch_all(&state.pool).await
        .map_err(db_err)?;

    let mut critical = Vec::new();
    let mut warning  = Vec::new();
    for r in rows {
        if r.stok_saat_ini <= r.stok_minimal { critical.push(r); }
        else                                   { warning.push(r); }
    }

    Ok(Json(StokMinimumResp {
        total_critical: critical.len(),
        total_warning:  warning.len(),
        critical,
        warning,
    }))
}

// List depo aktif untuk filter dropdown
#[derive(Serialize, sqlx::FromRow)]
pub struct DepoRow {
    pub kd_bangsal: String,
    pub nm_bangsal: String,
}

pub async fn list_depo(
    _u: crate::auth::middleware::AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<DepoRow>>, (StatusCode, Json<Value>)> {
    let rows: Vec<DepoRow> = sqlx::query_as(
        "SELECT kd_bangsal, nm_bangsal FROM bangsal \
         WHERE status='1' AND kd_bangsal <> '-' \
         ORDER BY nm_bangsal"
    )
    .fetch_all(&state.pool).await
    .map_err(db_err)?;
    Ok(Json(rows))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error laporan_farmasi: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR,
     Json(json!({"error": "Database error", "detail": e.to_string()})))
}
