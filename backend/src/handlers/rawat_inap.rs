use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct RanapQuery {
    pub tgl_awal:      Option<String>,
    pub tgl_akhir:     Option<String>,
    pub status_bayar:  Option<String>,
    pub status_pulang: Option<String>, // "Masih Dirawat" (default) / "Semua" / nilai stts_pulang
    pub bangsal:       Option<String>,
    pub cari:          Option<String>,
    pub page:          Option<i64>,
    pub size:          Option<i64>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct RanapRow {
    pub no_rawat:     String,
    pub no_rm:        Option<String>,
    pub nm_pasien:    Option<String>,
    pub umur:         Option<String>,
    pub kd_kamar:     Option<String>,
    pub nm_bangsal:   Option<String>,
    pub kelas:        Option<String>,
    pub tgl_masuk:    Option<String>,
    pub jam_masuk:    Option<String>,
    pub tgl_keluar:   Option<String>,
    pub jam_keluar:   Option<String>,
    pub lama:         Option<i64>,
    pub diagnosa_awal: Option<String>,
    pub nm_dokter:    Option<String>,
    pub png_jawab:    Option<String>,
    pub status_bayar: Option<String>,
    pub stts_pulang:  Option<String>,
    pub ttl_biaya:    Option<f64>,
}

#[derive(Serialize)]
pub struct RanapListResponse {
    pub data:  Vec<RanapRow>,
    pub total: i64,
    pub page:  i64,
    pub size:  i64,
}

// Daftar pasien Rawat Inap (port DlgKamarInap.tampil — daftar saja).
pub async fn list_rawat_inap(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<RanapQuery>,
) -> Result<Json<RanapListResponse>, (StatusCode, Json<Value>)> {
    let page   = q.page.unwrap_or(1).max(1);
    let size   = q.size.unwrap_or(100).min(500);
    let offset = (page - 1) * size;
    let today  = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tgl_awal  = q.tgl_awal.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| today.clone());
    let tgl_akhir = q.tgl_akhir.filter(|s| !s.trim().is_empty()).unwrap_or(today);

    let status_pulang = q.status_pulang.unwrap_or_else(|| "Masih Dirawat".to_string());
    // Default & "Masih Dirawat" → hanya yang belum pulang (stts_pulang='-'), abaikan rentang tgl.
    let dirawat = matches!(status_pulang.trim(), "" | "Masih Dirawat");

    let bayar_like = match q.status_bayar.as_deref().unwrap_or("Semua") {
        "Semua" | "" => "%".to_string(),
        s => format!("%{s}%"),
    };
    let bangsal_like = format!("%{}%", q.bangsal.unwrap_or_default());
    let cari_like = format!("%{}%", q.cari.unwrap_or_default());
    let pulang_like = if status_pulang.trim() == "Semua" { "%".to_string() } else { format!("%{}%", status_pulang.trim()) };

    // Susun WHERE + urutan bind
    let mut cond = String::new();
    let mut binds: Vec<String> = Vec::new();
    if dirawat {
        cond.push_str(" AND ki.stts_pulang='-'");
    } else {
        cond.push_str(" AND ki.tgl_masuk BETWEEN ? AND ? AND ki.stts_pulang LIKE ?");
        binds.push(tgl_awal.clone());
        binds.push(tgl_akhir.clone());
        binds.push(pulang_like);
    }
    cond.push_str(" AND rp.status_bayar LIKE ? AND b.nm_bangsal LIKE ?");
    binds.push(bayar_like);
    binds.push(bangsal_like);
    cond.push_str(
        " AND (ki.no_rawat LIKE ? OR rp.no_rkm_medis LIKE ? OR p.nm_pasien LIKE ?
             OR ki.kd_kamar LIKE ? OR b.nm_bangsal LIKE ? OR ki.diagnosa_awal LIKE ?
             OR d.nm_dokter LIKE ? OR ki.stts_pulang LIKE ? OR pj.png_jawab LIKE ?)",
    );
    for _ in 0..9 { binds.push(cari_like.clone()); }

    const FROM: &str =
        "FROM kamar_inap ki
         JOIN reg_periksa rp ON rp.no_rawat = ki.no_rawat
         LEFT JOIN pasien p  ON p.no_rkm_medis = rp.no_rkm_medis
         LEFT JOIN kamar k   ON k.kd_kamar = ki.kd_kamar
         LEFT JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal
         LEFT JOIN dokter d  ON d.kd_dokter = rp.kd_dokter
         LEFT JOIN penjab pj ON pj.kd_pj = rp.kd_pj
         WHERE 1=1";

    let count_sql = format!("SELECT COUNT(*) {FROM}{cond}");
    let mut cq = sqlx::query_as::<_, (i64,)>(&count_sql);
    for b in &binds { cq = cq.bind(b); }
    let total = cq.fetch_one(&state.pool).await.map_err(db_err)?;

    let data_sql = format!(
        "SELECT ki.no_rawat, rp.no_rkm_medis AS no_rm, p.nm_pasien,
                CONCAT(IFNULL(rp.umurdaftar,''),' ',IFNULL(rp.sttsumur,'')) AS umur,
                ki.kd_kamar, b.nm_bangsal, k.kelas,
                DATE_FORMAT(ki.tgl_masuk,'%Y-%m-%d') AS tgl_masuk,
                TIME_FORMAT(ki.jam_masuk,'%H:%i:%s') AS jam_masuk,
                IF(ki.tgl_keluar='0000-00-00','',DATE_FORMAT(ki.tgl_keluar,'%Y-%m-%d')) AS tgl_keluar,
                IF(ki.jam_keluar='00:00:00','',TIME_FORMAT(ki.jam_keluar,'%H:%i:%s')) AS jam_keluar,
                CAST(IF(ki.tgl_keluar='0000-00-00' OR ki.tgl_keluar IS NULL,
                        DATEDIFF(CURDATE(), ki.tgl_masuk),
                        IFNULL(ki.lama,0)) AS SIGNED) AS lama,
                ki.diagnosa_awal, d.nm_dokter, pj.png_jawab,
                rp.status_bayar, ki.stts_pulang,
                CAST(IFNULL(ki.ttl_biaya,0) AS DOUBLE) AS ttl_biaya
         {FROM}{cond}
         ORDER BY b.nm_bangsal, ki.tgl_masuk, ki.jam_masuk
         LIMIT ? OFFSET ?"
    );
    let mut dq = sqlx::query_as::<_, RanapRow>(&data_sql);
    for b in &binds { dq = dq.bind(b); }
    dq = dq.bind(size).bind(offset);
    let data = dq.fetch_all(&state.pool).await.map_err(db_err)?;

    Ok(Json(RanapListResponse { data, total: total.0, page, size }))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error rawat_inap: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
