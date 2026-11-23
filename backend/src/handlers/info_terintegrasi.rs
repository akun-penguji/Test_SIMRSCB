// Info Perencanaan & Pelayanan Terintegrasi ke Pasien secara Berkala (AKP 3).
// Dashboard read-only: pantau pemberian informasi/edukasi terintegrasi berkala
// ke pasien-keluarga pada seluruh pasien ranap AKTIF, agar tidak ada yang bolong.
// Sumber data live (reuse, tanpa tabel baru):
//   - materi_edukasi_pasien_keluarga_rscb  → catatan info/edukasi (per tanggal/jam)
//   - catatan_keperawatan_ranap            → indikator asuhan terintegrasi (CPPT)
//   - kamar_inap/reg_periksa/pasien/kamar/bangsal/dpjp_ranap/dokter
use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB info_terintegrasi: {}", e);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": e.to_string() })),
    )
}

#[derive(Deserialize)]
pub struct StatusQ {
    // Interval "berkala" dalam jam (default 24). Info terakhir lebih lama dari ini = terlambat.
    pub interval_jam: Option<i64>,
}

#[derive(sqlx::FromRow, Serialize)]
pub struct PasienRow {
    pub no_rawat: String,
    pub no_rkm_medis: Option<String>,
    pub nm_pasien: Option<String>,
    pub nm_bangsal: Option<String>,
    pub kelas: Option<String>,
    pub kd_kamar: Option<String>,
    pub dpjp: Option<String>,
    pub tgl_masuk: Option<String>,
    pub lama_hari: Option<i64>,
    pub jml_edukasi: i64,
    pub terakhir_edukasi: Option<String>,
    pub jam_sejak: Option<i64>,
    pub jml_cppt: i64,
}

pub async fn status(
    _u: AuthUser,
    State(s): State<AppState>,
    Query(q): Query<StatusQ>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let interval = q.interval_jam.filter(|v| *v > 0).unwrap_or(24);

    let pasien: Vec<PasienRow> = sqlx::query_as(
        "SELECT ki.no_rawat AS no_rawat, \
                r.no_rkm_medis AS no_rkm_medis, \
                ps.nm_pasien AS nm_pasien, \
                b.nm_bangsal AS nm_bangsal, \
                k.kelas AS kelas, \
                ki.kd_kamar AS kd_kamar, \
                (SELECT GROUP_CONCAT(DISTINCT d.nm_dokter SEPARATOR ', ') \
                   FROM dpjp_ranap dp JOIN dokter d ON d.kd_dokter = dp.kd_dokter \
                   WHERE dp.no_rawat = ki.no_rawat) AS dpjp, \
                DATE_FORMAT(ki.tgl_masuk,'%Y-%m-%d') AS tgl_masuk, \
                CAST(DATEDIFF(CURDATE(), ki.tgl_masuk) AS SIGNED) AS lama_hari, \
                (SELECT CAST(COUNT(*) AS SIGNED) FROM materi_edukasi_pasien_keluarga_rscb m \
                   WHERE m.no_rawat = ki.no_rawat) AS jml_edukasi, \
                (SELECT DATE_FORMAT(MAX(TIMESTAMP(m.tanggal, m.jam)),'%Y-%m-%d %H:%i') \
                   FROM materi_edukasi_pasien_keluarga_rscb m WHERE m.no_rawat = ki.no_rawat) AS terakhir_edukasi, \
                (SELECT TIMESTAMPDIFF(HOUR, MAX(TIMESTAMP(m.tanggal, m.jam)), NOW()) \
                   FROM materi_edukasi_pasien_keluarga_rscb m WHERE m.no_rawat = ki.no_rawat) AS jam_sejak, \
                (SELECT CAST(COUNT(*) AS SIGNED) FROM catatan_keperawatan_ranap c \
                   WHERE c.no_rawat = ki.no_rawat) AS jml_cppt \
         FROM kamar_inap ki \
         JOIN reg_periksa r ON r.no_rawat = ki.no_rawat \
         JOIN pasien ps ON ps.no_rkm_medis = r.no_rkm_medis \
         LEFT JOIN kamar k ON k.kd_kamar = ki.kd_kamar \
         LEFT JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal \
         WHERE ki.tgl_keluar = '0000-00-00' \
         ORDER BY (jam_sejak IS NULL) DESC, jam_sejak DESC, ki.tgl_masuk ASC",
    )
    .fetch_all(&s.pool)
    .await
    .map_err(db_err)?;

    // Klasifikasi status per pasien.
    let total = pasien.len() as i64;
    let mut belum_pernah = 0i64; // belum ada info sama sekali
    let mut terlambat = 0i64; // pernah, tapi > interval jam
    let mut terkini = 0i64; // ada info dalam interval
    for p in &pasien {
        match p.jam_sejak {
            None => belum_pernah += 1,
            Some(j) if j > interval => terlambat += 1,
            Some(_) => terkini += 1,
        }
    }

    Ok(Json(json!({
        "interval_jam": interval,
        "ringkasan": {
            "total_ranap": total,
            "belum_pernah": belum_pernah,
            "terlambat": terlambat,
            "terkini": terkini,
            "perlu_perhatian": belum_pernah + terlambat,
        },
        "pasien": pasien,
    })))
}
