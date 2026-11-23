// Rekap Risiko Jatuh — diambil dari isian awal keperawatan rawat inap
// (penilaian_awal_keperawatan_ranap): skor Morse (dewasa) & Sydney (geriatri).
// Ambang: Morse 0-24 Rendah / 25-44 Sedang / >=45 Tinggi.
//         Sydney 0-5 Rendah / 6-16 Sedang / >=17 Tinggi.
// Tingkat pasien = risiko tertinggi dari skala yang terisi.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB risiko_jatuh: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data risiko jatuh"})))
}

#[derive(sqlx::FromRow)]
struct Raw {
    no_rawat: String,
    tanggal: String,
    no_rkm_medis: String,
    nm_pasien: String,
    kamar: String,
    morse: String,
    sydney: String,
}

#[derive(Serialize)]
pub struct JatuhRow {
    pub no_rawat: String,
    pub tanggal: String,
    pub no_rkm_medis: String,
    pub nm_pasien: String,
    pub kamar: String,
    pub morse: i64,
    pub sydney: i64,
    pub skala: String,   // "Morse" / "Sydney" / "-"
    pub skor: i64,       // skor skala terpakai
    pub tingkat: String, // Rendah / Sedang / Tinggi
}

#[derive(Deserialize)]
pub struct RangeQuery {
    pub tgl_awal: String,
    pub tgl_akhir: String,
}

fn parse_i(s: &str) -> i64 { s.trim().parse::<i64>().unwrap_or(0) }
fn level_morse(v: i64) -> u8 { if v >= 45 { 2 } else if v >= 25 { 1 } else { 0 } }
fn level_sydney(v: i64) -> u8 { if v >= 17 { 2 } else if v >= 6 { 1 } else { 0 } }
fn label(l: u8) -> &'static str { match l { 2 => "Tinggi", 1 => "Sedang", _ => "Rendah" } }

pub async fn rekap(
    _u: AuthUser,
    State(s): State<AppState>,
    Query(q): Query<RangeQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if q.tgl_awal.trim().is_empty() || q.tgl_akhir.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Tanggal awal & akhir wajib"}))));
    }
    let raws: Vec<Raw> = sqlx::query_as::<_, Raw>(
        "SELECT p.no_rawat, CAST(p.tanggal AS CHAR) tanggal, ps.no_rkm_medis, ps.nm_pasien, \
                IFNULL(ki.kd_kamar,'') kamar, \
                IFNULL(p.penilaian_jatuhmorse_totalnilai,'0') morse, \
                IFNULL(p.penilaian_jatuhsydney_totalnilai,'0') sydney \
         FROM penilaian_awal_keperawatan_ranap p \
         INNER JOIN reg_periksa rp ON rp.no_rawat = p.no_rawat \
         INNER JOIN pasien ps ON ps.no_rkm_medis = rp.no_rkm_medis \
         LEFT JOIN kamar_inap ki ON ki.no_rawat = p.no_rawat AND ki.tgl_keluar = '0000-00-00' \
         WHERE DATE(p.tanggal) BETWEEN ? AND ? \
         ORDER BY p.tanggal DESC",
    )
    .bind(&q.tgl_awal)
    .bind(&q.tgl_akhir)
    .fetch_all(&s.pool)
    .await
    .map_err(db_err)?;

    let mut rows: Vec<JatuhRow> = Vec::with_capacity(raws.len());
    let (mut rendah, mut sedang, mut tinggi) = (0i64, 0i64, 0i64);
    for r in &raws {
        let m = parse_i(&r.morse);
        let sy = parse_i(&r.sydney);
        // Tingkat = risiko tertinggi dari skala yang terisi.
        let lv = level_morse(m).max(level_sydney(sy));
        // Skala terpakai: yang menghasilkan level menentukan; default Morse bila keduanya 0.
        let (skala, skor) = if level_sydney(sy) > level_morse(m) {
            ("Sydney".to_string(), sy)
        } else if m > 0 {
            ("Morse".to_string(), m)
        } else if sy > 0 {
            ("Sydney".to_string(), sy)
        } else {
            ("Morse".to_string(), m)
        };
        match lv { 2 => tinggi += 1, 1 => sedang += 1, _ => rendah += 1 }
        rows.push(JatuhRow {
            no_rawat: r.no_rawat.clone(),
            tanggal: r.tanggal.clone(),
            no_rkm_medis: r.no_rkm_medis.clone(),
            nm_pasien: r.nm_pasien.clone(),
            kamar: r.kamar.clone(),
            morse: m,
            sydney: sy,
            skala,
            skor,
            tingkat: label(lv).to_string(),
        });
    }
    let total = rows.len() as i64;
    Ok(Json(json!({
        "ringkasan": { "total": total, "rendah": rendah, "sedang": sedang, "tinggi": tinggi },
        "data": rows
    })))
}
