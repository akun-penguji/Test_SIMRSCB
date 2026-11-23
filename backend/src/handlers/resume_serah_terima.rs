// AKP 4 — Bukti penyerahan resume/ringkasan pulang ke pihak yang melanjutkan
// asuhan (dokter keluarga/FKTP, faskes perujuk, DPJP berikutnya) + pemantauan
// kepatuhan. Bukti: metadata (diserahkan_ke/nama_penerima) + foto & TTD pasien
// (foto/ttd di-capture via /surat/upload jenis "resume_serah_terima").
// Reuse: tabel resume standar `resume_pasien_ranap` (cek resume dibuat),
// kamar_inap/reg_periksa/pasien untuk populasi pasien pulang.
use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB resume_serah_terima: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))
}

// ── GET status per pasien ────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct GetQ { pub no_rawat: String }

pub async fn get(
    _u: AuthUser,
    State(s): State<AppState>,
    Query(q): Query<GetQ>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row: Option<(String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)> =
        sqlx::query_as(
            "SELECT diserahkan_ke, nama_penerima, DATE_FORMAT(tanggal,'%Y-%m-%d %H:%i'), \
                    foto_path, ttd_path, DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i') \
             FROM resume_serah_terima_rscb WHERE no_rawat=? LIMIT 1",
        )
        .bind(&q.no_rawat)
        .fetch_optional(&s.pool)
        .await
        .map_err(db_err)?;
    // Cek resume ranap sudah dibuat.
    let ada_resume: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM resume_pasien_ranap WHERE no_rawat=?)",
    )
    .bind(&q.no_rawat)
    .fetch_one(&s.pool)
    .await
    .map_err(db_err)?;

    let (diserahkan_ke, nama_penerima, tanggal, foto, ttd, upd) =
        row.map(|r| (Some(r.0), r.1, r.2, r.3, r.4, r.5))
            .unwrap_or((None, None, None, None, None, None));
    Ok(Json(json!({
        "ada_resume": ada_resume == 1,
        "diserahkan_ke": diserahkan_ke,
        "nama_penerima": nama_penerima,
        "tanggal": tanggal,
        "ada_foto": foto.as_deref().map(|s| !s.is_empty()).unwrap_or(false),
        "ada_ttd":  ttd.as_deref().map(|s| !s.is_empty()).unwrap_or(false),
        "updated_at": upd,
    })))
}

// ── POST simpan metadata penyerahan ─────────────────────────────────────────
#[derive(Deserialize)]
pub struct SaveBody {
    pub no_rawat: String,
    pub diserahkan_ke: String,
    pub nama_penerima: Option<String>,
}

pub async fn save(
    u: AuthUser,
    State(s): State<AppState>,
    Json(b): Json<SaveBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    // Validasi nilai enum (hindari data liar).
    const VALID: &[&str] = &["Pasien", "Keluarga", "Dokter Keluarga (FKTP)", "Faskes Perujuk", "DPJP Berikutnya"];
    if !VALID.contains(&b.diserahkan_ke.as_str()) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"diserahkan_ke tidak valid"}))));
    }
    sqlx::query(
        "INSERT INTO resume_serah_terima_rscb (no_rawat, diserahkan_ke, nama_penerima, tanggal, nip, updated_at) \
         VALUES (?, ?, ?, NOW(), ?, NOW()) \
         ON DUPLICATE KEY UPDATE diserahkan_ke=VALUES(diserahkan_ke), nama_penerima=VALUES(nama_penerima), \
                                 tanggal=VALUES(tanggal), nip=VALUES(nip), updated_at=NOW()",
    )
    .bind(&b.no_rawat)
    .bind(&b.diserahkan_ke)
    .bind(b.nama_penerima.as_deref().unwrap_or("").trim())
    .bind(&u.0.kode)
    .execute(&s.pool)
    .await
    .map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── GET dashboard pemantauan kepatuhan ──────────────────────────────────────
#[derive(Deserialize)]
pub struct MonitorQ {
    pub dari: Option<String>,   // YYYY-MM-DD
    pub sampai: Option<String>, // YYYY-MM-DD
}

#[derive(sqlx::FromRow, Serialize)]
pub struct PulangRow {
    pub no_rawat: String,
    pub no_rkm_medis: Option<String>,
    pub nm_pasien: Option<String>,
    pub nm_bangsal: Option<String>,
    pub tgl_keluar: Option<String>,
    pub ada_resume: i64,
    pub diserahkan_ke: Option<String>,
    pub nama_penerima: Option<String>,
    pub tgl_serah: Option<String>,
    pub ada_foto: i64,
    pub ada_ttd: i64,
}

pub async fn monitor(
    _u: AuthUser,
    State(s): State<AppState>,
    Query(q): Query<MonitorQ>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let dari = q.dari.filter(|v| !v.trim().is_empty()).unwrap_or_else(|| "2000-01-01".into());
    let sampai = q.sampai.filter(|v| !v.trim().is_empty()).unwrap_or_else(|| "2999-12-31".into());

    let rows: Vec<PulangRow> = sqlx::query_as(
        "SELECT ki.no_rawat AS no_rawat, r.no_rkm_medis AS no_rkm_medis, ps.nm_pasien AS nm_pasien, \
                b.nm_bangsal AS nm_bangsal, DATE_FORMAT(ki.tgl_keluar,'%Y-%m-%d') AS tgl_keluar, \
                CAST(EXISTS(SELECT 1 FROM resume_pasien_ranap rr WHERE rr.no_rawat=ki.no_rawat) AS SIGNED) AS ada_resume, \
                st.diserahkan_ke AS diserahkan_ke, st.nama_penerima AS nama_penerima, \
                DATE_FORMAT(st.tanggal,'%Y-%m-%d %H:%i') AS tgl_serah, \
                CAST(IFNULL(st.foto_path,'')<>'' AS SIGNED) AS ada_foto, \
                CAST(IFNULL(st.ttd_path,'')<>'' AS SIGNED) AS ada_ttd \
         FROM kamar_inap ki \
         JOIN reg_periksa r ON r.no_rawat = ki.no_rawat \
         JOIN pasien ps ON ps.no_rkm_medis = r.no_rkm_medis \
         LEFT JOIN kamar k ON k.kd_kamar = ki.kd_kamar \
         LEFT JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal \
         LEFT JOIN resume_serah_terima_rscb st ON st.no_rawat = ki.no_rawat \
         WHERE ki.tgl_keluar <> '0000-00-00' \
           AND ki.tgl_keluar BETWEEN ? AND ? \
           AND ki.tgl_keluar = (SELECT MAX(k2.tgl_keluar) FROM kamar_inap k2 WHERE k2.no_rawat = ki.no_rawat) \
         ORDER BY ki.tgl_keluar DESC, ki.no_rawat DESC",
    )
    .bind(&dari)
    .bind(&sampai)
    .fetch_all(&s.pool)
    .await
    .map_err(db_err)?;

    let total = rows.len() as i64;
    let mut ada_resume = 0i64;
    let mut lengkap = 0i64;       // resume + foto + ttd
    let mut belum_serah = 0i64;   // resume ada tapi bukti belum lengkap
    for r in &rows {
        if r.ada_resume == 1 { ada_resume += 1; }
        let bukti_lengkap = r.ada_foto == 1 && r.ada_ttd == 1;
        if r.ada_resume == 1 && bukti_lengkap { lengkap += 1; }
        else if r.ada_resume == 1 { belum_serah += 1; }
    }
    Ok(Json(json!({
        "ringkasan": {
            "total_pulang": total,
            "ada_resume": ada_resume,
            "tanpa_resume": total - ada_resume,
            "serah_terima_lengkap": lengkap,
            "belum_serah_terima": belum_serah,
        },
        "pasien": rows,
    })))
}
