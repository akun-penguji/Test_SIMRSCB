// Evaluasi Pendaftaran (AKP 2b) — auto-hitung online vs offline + waktu tunggu
// dari data Khanza, plus catatan analisa/kendala/tindak lanjut per periode.
use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB evaluasi_pendaftaran: {}", e);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": e.to_string() })),
    )
}

fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if has_perm(u, "evaluasi_pendaftaran_edit") || has_perm(u, "akreditasi_edit") {
        Ok(())
    } else {
        Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Perlu izin evaluasi_pendaftaran_edit" })),
        ))
    }
}

// ── REKAP AUTO ────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct RekapQ {
    pub dari: Option<String>,   // 'YYYY-MM-DD'
    pub sampai: Option<String>, // 'YYYY-MM-DD'
}

#[derive(Serialize)]
pub struct TrendPoint {
    pub tgl: String,
    pub total: i64,
    pub online: i64,
    pub offline: i64,
}

pub async fn rekap(
    _u: AuthUser,
    State(s): State<AppState>,
    Query(q): Query<RekapQ>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let dari_opt = q.dari.filter(|x| !x.trim().is_empty());
    let sampai_opt = q.sampai.filter(|x| !x.trim().is_empty());

    // Resolusi rentang (default: awal bulan berjalan s/d hari ini) — hindari chrono.
    let (dari, sampai): (String, String) = sqlx::query_as(
        "SELECT CAST(COALESCE(?, DATE_FORMAT(CURRENT_DATE,'%Y-%m-01')) AS CHAR), \
                CAST(COALESCE(?, CURRENT_DATE) AS CHAR)",
    )
    .bind(&dari_opt)
    .bind(&sampai_opt)
    .fetch_one(&s.pool)
    .await
    .map_err(db_err)?;

    // Jumlah: total, online (Mobile JKN/booking), ralan, ranap.
    let (total, online, ralan, ranap): (i64, i64, i64, i64) = sqlx::query_as(
        "SELECT CAST(COUNT(*) AS SIGNED), \
                CAST(COALESCE(SUM(CASE WHEN EXISTS(SELECT 1 FROM referensi_mobilejkn_bpjs mj WHERE mj.no_rawat=r.no_rawat) THEN 1 ELSE 0 END),0) AS SIGNED), \
                CAST(COALESCE(SUM(CASE WHEN r.status_lanjut='Ralan' THEN 1 ELSE 0 END),0) AS SIGNED), \
                CAST(COALESCE(SUM(CASE WHEN r.status_lanjut='Ranap' THEN 1 ELSE 0 END),0) AS SIGNED) \
         FROM reg_periksa r WHERE r.tgl_registrasi BETWEEN ? AND ?",
    )
    .bind(&dari)
    .bind(&sampai)
    .fetch_one(&s.pool)
    .await
    .map_err(db_err)?;
    let offline = total - online;

    // Waktu tunggu rawat jalan (registrasi -> pemeriksaan_ralan pertama), menit.
    let (sum_mnt, le60, n_wt): (i64, i64, i64) = sqlx::query_as(
        "SELECT CAST(COALESCE(SUM(w.mnt),0) AS SIGNED), \
                CAST(COALESCE(SUM(CASE WHEN w.mnt BETWEEN 0 AND 60 THEN 1 ELSE 0 END),0) AS SIGNED), \
                CAST(COUNT(*) AS SIGNED) \
         FROM ( \
           SELECT TIMESTAMPDIFF(MINUTE, TIMESTAMP(r.tgl_registrasi,r.jam_reg), p.tp) mnt \
           FROM reg_periksa r \
           JOIN (SELECT no_rawat, MIN(TIMESTAMP(tgl_perawatan,jam_rawat)) tp FROM pemeriksaan_ralan GROUP BY no_rawat) p \
             ON p.no_rawat=r.no_rawat \
           WHERE r.status_lanjut='Ralan' AND r.tgl_registrasi BETWEEN ? AND ? \
             AND TIMESTAMPDIFF(MINUTE, TIMESTAMP(r.tgl_registrasi,r.jam_reg), p.tp) BETWEEN 0 AND 1440 \
         ) w",
    )
    .bind(&dari)
    .bind(&sampai)
    .fetch_one(&s.pool)
    .await
    .map_err(db_err)?;
    let wt_avg = if n_wt > 0 {
        Some((sum_mnt as f64) / (n_wt as f64))
    } else {
        None
    };
    let wt_le60_pct = if n_wt > 0 {
        Some((le60 as f64) * 100.0 / (n_wt as f64))
    } else {
        None
    };

    // Tren harian.
    let rows: Vec<(String, i64, i64)> = sqlx::query_as(
        "SELECT DATE_FORMAT(r.tgl_registrasi,'%Y-%m-%d'), \
                CAST(COUNT(*) AS SIGNED), \
                CAST(COALESCE(SUM(CASE WHEN EXISTS(SELECT 1 FROM referensi_mobilejkn_bpjs mj WHERE mj.no_rawat=r.no_rawat) THEN 1 ELSE 0 END),0) AS SIGNED) \
         FROM reg_periksa r WHERE r.tgl_registrasi BETWEEN ? AND ? \
         GROUP BY r.tgl_registrasi ORDER BY r.tgl_registrasi",
    )
    .bind(&dari)
    .bind(&sampai)
    .fetch_all(&s.pool)
    .await
    .map_err(db_err)?;
    let trend: Vec<TrendPoint> = rows
        .into_iter()
        .map(|(tgl, tot, onl)| TrendPoint {
            tgl,
            total: tot,
            online: onl,
            offline: tot - onl,
        })
        .collect();

    Ok(Json(json!({
        "dari": dari,
        "sampai": sampai,
        "total": total,
        "online": online,
        "offline": offline,
        "ralan": ralan,
        "ranap": ranap,
        "online_pct": if total > 0 { (online as f64) * 100.0 / (total as f64) } else { 0.0 },
        "waktu_tunggu_avg": wt_avg,
        "wt_le60_pct": wt_le60_pct,
        "wt_n": n_wt,
        "trend": trend,
    })))
}

// ── CATATAN EVALUASI (analisa / kendala / tindak lanjut) per periode ───────
pub async fn catatan_get(
    _u: AuthUser,
    State(s): State<AppState>,
    Path(periode): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row: Option<(Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)> =
        sqlx::query_as(
            "SELECT analisa, kendala, tindak_lanjut, pelapor, DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i') \
             FROM simrscb_evaluasi_pendaftaran WHERE periode=? LIMIT 1",
        )
        .bind(&periode)
        .fetch_optional(&s.pool)
        .await
        .map_err(db_err)?;
    match row {
        Some((analisa, kendala, tindak_lanjut, pelapor, updated_at)) => Ok(Json(json!({
            "periode": periode, "ada": true,
            "analisa": analisa, "kendala": kendala, "tindak_lanjut": tindak_lanjut,
            "pelapor": pelapor, "updated_at": updated_at,
        }))),
        None => Ok(Json(json!({ "periode": periode, "ada": false }))),
    }
}

#[derive(Deserialize)]
pub struct CatatanBody {
    pub periode: String,
    #[serde(default)]
    pub jml_online: i64,
    #[serde(default)]
    pub jml_offline: i64,
    #[serde(default)]
    pub waktu_tunggu: Option<f64>,
    #[serde(default)]
    pub analisa: Option<String>,
    #[serde(default)]
    pub kendala: Option<String>,
    #[serde(default)]
    pub tindak_lanjut: Option<String>,
}

pub async fn catatan_save(
    u: AuthUser,
    State(s): State<AppState>,
    Json(b): Json<CatatanBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.periode.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "periode wajib diisi (YYYY-MM)" })),
        ));
    }
    sqlx::query(
        "INSERT INTO simrscb_evaluasi_pendaftaran \
           (periode,jml_online,jml_offline,waktu_tunggu,analisa,kendala,tindak_lanjut,pelapor,updated_at) \
         VALUES (?,?,?,?,?,?,?,?,NOW()) \
         ON DUPLICATE KEY UPDATE jml_online=VALUES(jml_online),jml_offline=VALUES(jml_offline), \
           waktu_tunggu=VALUES(waktu_tunggu),analisa=VALUES(analisa),kendala=VALUES(kendala), \
           tindak_lanjut=VALUES(tindak_lanjut),pelapor=VALUES(pelapor),updated_at=NOW()",
    )
    .bind(&b.periode)
    .bind(b.jml_online)
    .bind(b.jml_offline)
    .bind(b.waktu_tunggu)
    .bind(&b.analisa)
    .bind(&b.kendala)
    .bind(&b.tindak_lanjut)
    .bind(&u.0.nama)
    .execute(&s.pool)
    .await
    .map_err(db_err)?;
    Ok(Json(json!({ "ok": true })))
}
