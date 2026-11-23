// AKP 5.1 — Rekapitulasi Pasien Pulang Atas Permintaan Sendiri (APS) secara
// berkala (per bulan & triwulan) + status kelengkapan bukti (TTD pembuat &
// saksi). Read-only, sumber: surat_pulang_atas_permintaan_sendiri (+ companion
// pembuat_pernyataan / saksi_keluarga), reg_periksa/pasien.
use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB aps_rekap: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))
}

#[derive(Deserialize)]
pub struct RekapQ { pub tahun: Option<i64> }

#[derive(sqlx::FromRow, Serialize)]
pub struct ApsRow {
    pub no_rawat: String,
    pub tgl_pulang: Option<String>,
    pub stts_pulang: Option<String>,
    pub no_rkm_medis: Option<String>,
    pub nm_pasien: Option<String>,
    pub nm_bangsal: Option<String>,
    pub dpjp: Option<String>,
    pub nama_pj: Option<String>,
    pub hubungan: Option<String>,
    pub bln: i64,
    pub ada_surat: i64,
    pub ttd_pembuat: i64,
    pub ttd_saksi: i64,
}

pub async fn rekap(
    _u: AuthUser,
    State(s): State<AppState>,
    Query(q): Query<RekapQ>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = match q.tahun.filter(|v| *v > 0) {
        Some(t) => t,
        None => sqlx::query_scalar::<_, i64>("SELECT YEAR(NOW())").fetch_one(&s.pool).await.map_err(db_err)?,
    };

    // Populasi = pasien pulang dengan status APS (Atas Permintaan Sendiri / APS /
    // Pulang Paksa) di kamar_inap. Surat pernyataan & TTD di-LEFT JOIN utk cek
    // kelengkapan dokumentasi.
    let rows: Vec<ApsRow> = sqlx::query_as(
        "SELECT ki.no_rawat AS no_rawat, \
                DATE_FORMAT(ki.tgl_keluar,'%Y-%m-%d') AS tgl_pulang, \
                ki.stts_pulang AS stts_pulang, \
                r.no_rkm_medis AS no_rkm_medis, ps.nm_pasien AS nm_pasien, \
                b.nm_bangsal AS nm_bangsal, \
                (SELECT GROUP_CONCAT(DISTINCT d.nm_dokter SEPARATOR ', ') FROM dpjp_ranap dp \
                   JOIN dokter d ON d.kd_dokter=dp.kd_dokter WHERE dp.no_rawat=ki.no_rawat) AS dpjp, \
                IFNULL(sp.nama_pj,'') AS nama_pj, IFNULL(sp.hubungan,'') AS hubungan, \
                CAST(MONTH(ki.tgl_keluar) AS SIGNED) AS bln, \
                CAST((sp.no_surat IS NOT NULL) AS SIGNED) AS ada_surat, \
                CAST((IFNULL(pb.tandatangan,'')<>'') AS SIGNED) AS ttd_pembuat, \
                CAST((IFNULL(sk.tandatangan,'')<>'') AS SIGNED) AS ttd_saksi \
         FROM kamar_inap ki \
         JOIN reg_periksa r ON r.no_rawat = ki.no_rawat \
         JOIN pasien ps ON ps.no_rkm_medis = r.no_rkm_medis \
         LEFT JOIN kamar k ON k.kd_kamar = ki.kd_kamar \
         LEFT JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal \
         LEFT JOIN surat_pulang_atas_permintaan_sendiri sp ON sp.no_rawat = ki.no_rawat \
         LEFT JOIN surat_pulang_atas_permintaan_sendiri_pembuat_pernyataan pb ON pb.no_surat = sp.no_surat \
         LEFT JOIN surat_pulang_atas_permintaan_sendiri_saksi_keluarga sk ON sk.no_surat = sp.no_surat \
         WHERE ki.stts_pulang IN ('Atas Permintaan Sendiri','APS','Pulang Paksa') \
           AND ki.tgl_keluar <> '0000-00-00' AND YEAR(ki.tgl_keluar) = ? \
         ORDER BY ki.tgl_keluar DESC, ki.no_rawat DESC",
    )
    .bind(tahun)
    .fetch_all(&s.pool)
    .await
    .map_err(db_err)?;

    // Rekap per bulan & triwulan.
    let mut per_bulan = [0i64; 12];
    let mut lengkap = 0i64;   // surat + TTD pembuat + TTD saksi lengkap
    let mut ada_surat = 0i64; // punya surat pernyataan APS
    for r in &rows {
        if r.bln >= 1 && r.bln <= 12 { per_bulan[(r.bln - 1) as usize] += 1; }
        if r.ada_surat == 1 { ada_surat += 1; }
        if r.ada_surat == 1 && r.ttd_pembuat == 1 && r.ttd_saksi == 1 { lengkap += 1; }
    }
    let per_triwulan = [
        per_bulan[0] + per_bulan[1] + per_bulan[2],
        per_bulan[3] + per_bulan[4] + per_bulan[5],
        per_bulan[6] + per_bulan[7] + per_bulan[8],
        per_bulan[9] + per_bulan[10] + per_bulan[11],
    ];
    let total = rows.len() as i64;

    Ok(Json(json!({
        "tahun": tahun,
        "ringkasan": {
            "total": total,
            "ada_surat": ada_surat,
            "tanpa_surat": total - ada_surat,
            "bukti_lengkap": lengkap,
            "belum_lengkap": total - lengkap,
        },
        "per_bulan": per_bulan,
        "per_triwulan": per_triwulan,
        "pasien": rows,
    })))
}
