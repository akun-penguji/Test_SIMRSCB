// Anjungan Admin — pause toggle + activity log queries
//
// Endpoint:
//   GET  /api/anjungan/config         — public (kiosk cek status saat mount)
//   PUT  /api/anjungan/config         — admin only (toggle pause)
//   GET  /api/anjungan/log            — admin only (list activity log filter)
//   GET  /api/anjungan/log/stats      — admin only (counter ringkasan)
//
// Helper:
//   log_activity()                    — INSERT row di simrscb_anjungan_log,
//                                       di-call dari handler kiosk lain

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::MySqlPool;

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error anjungan_admin: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}

fn forbidden_if_not_admin(user: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if user.0.is_admin { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error": "Hanya admin yang bisa akses"})))) }
}

// ── Config (pause toggle + maintenance message) ─────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ConfigResp {
    pub aktif:           bool,
    pub maintenance_msg: String,
}

pub async fn get_config(
    State(state): State<AppState>,
) -> Result<Json<ConfigResp>, (StatusCode, Json<Value>)> {
    // Public endpoint — frontend kiosk cek saat mount
    let aktif_str: Option<String> = sqlx::query_scalar(
        "SELECT cfg_value FROM simrscb_anjungan_config WHERE cfg_key='aktif'"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;
    let maint_str: Option<String> = sqlx::query_scalar(
        "SELECT cfg_value FROM simrscb_anjungan_config WHERE cfg_key='maintenance_msg'"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;
    Ok(Json(ConfigResp {
        aktif: aktif_str.as_deref().unwrap_or("1") == "1",
        maintenance_msg: maint_str.unwrap_or_default(),
    }))
}

#[derive(Deserialize)]
pub struct PutConfigBody {
    pub aktif:           Option<bool>,
    pub maintenance_msg: Option<String>,
}

pub async fn put_config(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<PutConfigBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    forbidden_if_not_admin(&user)?;
    let kode = user.0.kode.clone();

    if let Some(aktif) = b.aktif {
        sqlx::query(
            "INSERT INTO simrscb_anjungan_config (cfg_key, cfg_value, updated_by)
             VALUES ('aktif', ?, ?)
             ON DUPLICATE KEY UPDATE cfg_value=VALUES(cfg_value), updated_by=VALUES(updated_by)"
        )
        .bind(if aktif { "1" } else { "0" })
        .bind(&kode)
        .execute(&state.pool).await.map_err(db_err)?;
        crate::audit::log_sql(&state.pool, &kode, &format!(
            "INSERT INTO simrscb_anjungan_config (cfg_key, cfg_value, updated_by) VALUES ('aktif', {}, {}) \
             ON DUPLICATE KEY UPDATE cfg_value=VALUES(cfg_value), updated_by=VALUES(updated_by)",
            crate::audit::q(if aktif { "1" } else { "0" }), crate::audit::q(&kode),
        )).await;

        // Log juga aksi pause/resume
        let action = if aktif { "resume" } else { "pause" };
        let _ = log_activity(&state.pool, "config", action,
            LogActivityFields { user_kode: Some(kode.clone()), ..Default::default() }).await;
    }

    if let Some(msg) = b.maintenance_msg {
        sqlx::query(
            "INSERT INTO simrscb_anjungan_config (cfg_key, cfg_value, updated_by)
             VALUES ('maintenance_msg', ?, ?)
             ON DUPLICATE KEY UPDATE cfg_value=VALUES(cfg_value), updated_by=VALUES(updated_by)"
        )
        .bind(&msg).bind(&kode)
        .execute(&state.pool).await.map_err(db_err)?;
        crate::audit::log_sql(&state.pool, &kode, &format!(
            "INSERT INTO simrscb_anjungan_config (cfg_key, cfg_value, updated_by) VALUES ('maintenance_msg', {}, {}) \
             ON DUPLICATE KEY UPDATE cfg_value=VALUES(cfg_value), updated_by=VALUES(updated_by)",
            crate::audit::q(&msg), crate::audit::q(&kode),
        )).await;
    }

    Ok(Json(json!({"ok": true})))
}

// ── Activity Log ───────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LogRow {
    pub id:            i32,
    pub waktu:         String,
    pub modul:         String,
    pub action:        String,
    pub nik:           Option<String>,
    pub no_kartu:      Option<String>,
    pub no_rkm_medis:  Option<String>,
    pub no_rawat:      Option<String>,
    pub no_reg:        Option<String>,
    pub no_sep:        Option<String>,
    pub sukses:        i8,
    pub error_message: Option<String>,
    pub user_kode:     Option<String>,
}

#[derive(Deserialize)]
pub struct LogQuery {
    pub modul:  Option<String>,
    pub action: Option<String>,
    pub sukses: Option<bool>,
    pub tgl:    Option<String>,   // YYYY-MM-DD, default hari ini
    pub q:      Option<String>,   // cari di nik/no_kartu/no_rkm_medis
    pub limit:  Option<i32>,
}

pub async fn list_log(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<LogQuery>,
) -> Result<Json<Vec<LogRow>>, (StatusCode, Json<Value>)> {
    forbidden_if_not_admin(&user)?;
    let limit = q.limit.unwrap_or(200).clamp(1, 1000);
    let tgl = q.tgl.clone().unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());
    let sukses_int: Option<i8> = q.sukses.map(|b| if b { 1 } else { 0 });
    let qs = q.q.as_deref().filter(|s| !s.trim().is_empty()).map(|s| format!("%{}%", s.trim()));

    let rows: Vec<LogRow> = sqlx::query_as(
        "SELECT id,
                DATE_FORMAT(waktu,'%Y-%m-%d %H:%i:%s') AS waktu,
                modul, action,
                nik, no_kartu, no_rkm_medis, no_rawat, no_reg, no_sep,
                sukses, error_message, user_kode
         FROM simrscb_anjungan_log
         WHERE DATE(waktu) = ?
           AND (? IS NULL OR modul = ?)
           AND (? IS NULL OR action = ?)
           AND (? IS NULL OR sukses = ?)
           AND (? IS NULL OR nik LIKE ? OR no_kartu LIKE ? OR no_rkm_medis LIKE ?)
         ORDER BY id DESC
         LIMIT ?"
    )
    .bind(&tgl)
    .bind(&q.modul).bind(&q.modul)
    .bind(&q.action).bind(&q.action)
    .bind(sukses_int).bind(sukses_int)
    .bind(&qs).bind(&qs).bind(&qs).bind(&qs)
    .bind(limit)
    .fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

pub async fn log_stats(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<LogQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    forbidden_if_not_admin(&user)?;
    let tgl = q.tgl.clone().unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());

    #[derive(sqlx::FromRow)]
    struct Total { total: i64, sukses: i64, gagal: i64 }
    let tot: Total = sqlx::query_as(
        "SELECT
           CAST(COUNT(*) AS SIGNED) AS total,
           CAST(IFNULL(SUM(sukses=1),0) AS SIGNED) AS sukses,
           CAST(IFNULL(SUM(sukses=0),0) AS SIGNED) AS gagal
         FROM simrscb_anjungan_log WHERE DATE(waktu)=?"
    ).bind(&tgl).fetch_one(&state.pool).await.map_err(db_err)?;

    #[derive(sqlx::FromRow, Serialize)]
    struct Bucket { name: String, total: i64 }

    let per_modul: Vec<Bucket> = sqlx::query_as(
        "SELECT modul AS name, CAST(COUNT(*) AS SIGNED) AS total
         FROM simrscb_anjungan_log WHERE DATE(waktu)=?
         GROUP BY modul ORDER BY total DESC"
    ).bind(&tgl).fetch_all(&state.pool).await.unwrap_or_default();

    let per_action: Vec<Bucket> = sqlx::query_as(
        "SELECT action AS name, CAST(COUNT(*) AS SIGNED) AS total
         FROM simrscb_anjungan_log WHERE DATE(waktu)=?
         GROUP BY action ORDER BY total DESC"
    ).bind(&tgl).fetch_all(&state.pool).await.unwrap_or_default();

    // Per jam (untuk peak hour)
    #[derive(sqlx::FromRow, Serialize)]
    struct HourBucket { jam: i32, total: i64 }
    let per_jam: Vec<HourBucket> = sqlx::query_as(
        "SELECT CAST(HOUR(waktu) AS SIGNED) AS jam, CAST(COUNT(*) AS SIGNED) AS total
         FROM simrscb_anjungan_log WHERE DATE(waktu)=?
         GROUP BY HOUR(waktu) ORDER BY jam"
    ).bind(&tgl).fetch_all(&state.pool).await.unwrap_or_default();

    Ok(Json(json!({
        "tgl": tgl,
        "total":  tot.total,
        "sukses": tot.sukses,
        "gagal":  tot.gagal,
        "per_modul":  per_modul,
        "per_action": per_action,
        "per_jam":    per_jam,
    })))
}

// ── Helper: log_activity ───────────────────────────────────────────────────
// Di-call dari handler kiosk lain saat ada aksi penting.
#[derive(Default)]
pub struct LogActivityFields {
    pub nik:           Option<String>,
    pub no_kartu:      Option<String>,
    pub no_rkm_medis:  Option<String>,
    pub no_rawat:      Option<String>,
    pub no_reg:        Option<String>,
    pub no_sep:        Option<String>,
    pub sukses:        Option<bool>,
    pub error_message: Option<String>,
    pub meta:          Option<Value>,
    pub user_kode:     Option<String>,
}

pub async fn log_activity(
    pool: &MySqlPool,
    modul: &str,
    action: &str,
    f: LogActivityFields,
) -> Result<(), sqlx::Error> {
    let meta_str = f.meta.as_ref().map(|v| v.to_string());
    sqlx::query(
        "INSERT INTO simrscb_anjungan_log
         (modul, action, nik, no_kartu, no_rkm_medis,
          no_rawat, no_reg, no_sep,
          sukses, error_message, meta, user_kode)
         VALUES (?,?,?,?,?, ?,?,?, ?,?,?,?)"
    )
    .bind(modul).bind(action)
    .bind(&f.nik).bind(&f.no_kartu).bind(&f.no_rkm_medis)
    .bind(&f.no_rawat).bind(&f.no_reg).bind(&f.no_sep)
    .bind(if f.sukses.unwrap_or(true) { 1i8 } else { 0i8 })
    .bind(&f.error_message)
    .bind(&meta_str)
    .bind(&f.user_kode)
    .execute(pool).await?;
    Ok(())
}
