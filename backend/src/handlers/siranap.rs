// SIRANAP (ketersediaan tempat tidur) sync ke RS Online v3 Kemenkes.
// Port dari KhanzaHMSServiceSIRSYankes (frmUtama.jalankanUpdateKamar).
// Pola sama dgn aplicare.rs: config env → cron → run_sync → log persist + SSE.
// Endpoint: PUT {url}/Fasyankes, header X-rs-id / X-Timestamp / X-pass.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::State,
    http::StatusCode,
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use futures::stream::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::MySqlPool;
use std::convert::Infallible;
use tokio_stream::wrappers::BroadcastStream;

// ── Config ────────────────────────────────────────────────────────────────────
#[derive(Clone, Debug)]
pub struct SiranapConfig {
    pub url:          String, // base RS Online v3, mis. https://sirs.kemkes.go.id/fo/index.php
    pub rs_id:        String, // IDSIRS (X-rs-id)
    pub pass:         String, // PASSSIRS (X-pass, dikirim mentah)
    pub interval_min: u64,
}

impl SiranapConfig {
    pub fn from_env() -> Self {
        Self {
            url: std::env::var("SIRANAP_URL")
                .unwrap_or_else(|_| "https://sirs.kemkes.go.id/fo/index.php".to_string()),
            rs_id:        std::env::var("SIRANAP_RS_ID").unwrap_or_default(),
            pass:         std::env::var("SIRANAP_PASS").unwrap_or_default(),
            interval_min: std::env::var("SIRANAP_INTERVAL_MIN")
                .ok().and_then(|s| s.parse().ok()).unwrap_or(60),
        }
    }
}

// ── Log entry (sama shape dgn aplicare) ─────────────────────────────────────────
#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct SiranapLogEntry {
    pub id:      Option<i64>,
    pub waktu:   String,
    pub level:   String,
    pub message: String,
}

async fn write_log(
    pool: &MySqlPool,
    tx: &tokio::sync::broadcast::Sender<SiranapLogEntry>,
    level: &str,
    message: String,
) {
    let waktu = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let inserted = sqlx::query(
        "INSERT INTO simrscb_siranap_log (waktu, level, message) VALUES (?, ?, ?)"
    )
    .bind(&waktu).bind(level).bind(&message)
    .execute(pool).await.ok();

    let id = inserted.map(|r| r.last_insert_id() as i64);
    let _ = tx.send(SiranapLogEntry { id, waktu, level: level.to_string(), message });

    // Trim: keep last 5000 rows
    let _ = sqlx::query(
        "DELETE FROM simrscb_siranap_log
         WHERE id < (SELECT id FROM (SELECT id FROM simrscb_siranap_log ORDER BY id DESC LIMIT 1 OFFSET 5000) x)"
    ).execute(pool).await;
}

// ── Sync logic ───────────────────────────────────────────────────────────────
#[derive(Debug, sqlx::FromRow)]
struct KamarSiranapRow {
    id_t_tt:  String,
    tt_kelas: Option<String>,
    ruang:    Option<String>,
    jumlah:   i64,
    terpakai: i64,
}

pub async fn run_sync(
    pool: MySqlPool,
    cfg: SiranapConfig,
    tx: tokio::sync::broadcast::Sender<SiranapLogEntry>,
) {
    if cfg.url.is_empty() || cfg.rs_id.is_empty() || cfg.pass.is_empty() {
        write_log(&pool, &tx, "error",
            "Config SIRANAP belum lengkap (SIRANAP_URL / SIRANAP_RS_ID / SIRANAP_PASS kosong). Set di .env".to_string()
        ).await;
        return;
    }

    let endpoint = format!("{}/Fasyankes", cfg.url.trim_end_matches('/'));
    write_log(&pool, &tx, "info", "Memulai sync SIRANAP (ketersediaan TT)".to_string()).await;
    write_log(&pool, &tx, "info", format!("URL: {} | RS: {}", endpoint, cfg.rs_id)).await;

    // Agregasi per id_t_tt (1 id_t_tt = gabungan beberapa bangsal sekelas SIRANAP).
    let rows: Vec<KamarSiranapRow> = match sqlx::query_as(
        "SELECT m.id_t_tt AS id_t_tt, m.tt_kelas AS tt_kelas, \
                GROUP_CONCAT(DISTINCT b.nm_bangsal ORDER BY b.nm_bangsal SEPARATOR ', ') AS ruang, \
                CAST(COUNT(k.kd_kamar) AS SIGNED) AS jumlah, \
                CAST(SUM(CASE WHEN k.status='ISI' THEN 1 ELSE 0 END) AS SIGNED) AS terpakai \
         FROM kamar k \
         INNER JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal \
         INNER JOIN sirs_mapping_kamar m ON m.kd_bangsal = k.kd_bangsal \
         WHERE k.statusdata='1' AND m.id_t_tt IS NOT NULL AND m.id_t_tt <> '' \
         GROUP BY m.id_t_tt, m.tt_kelas"
    ).fetch_all(&pool).await {
        Ok(r) => r,
        Err(e) => {
            write_log(&pool, &tx, "error", format!("Query kamar SIRANAP gagal: {}", e)).await;
            return;
        }
    };

    if rows.is_empty() {
        write_log(&pool, &tx, "warning",
            "Tidak ada data (cek tabel sirs_mapping_kamar / id_t_tt).".to_string()).await;
    }

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .danger_accept_invalid_certs(true) // Java pakai trust-all SSL
        .build() {
        Ok(c) => c,
        Err(e) => { write_log(&pool, &tx, "error", format!("Init HTTP client gagal: {}", e)).await; return; }
    };

    for kamar in rows {
        let ruang = kamar.ruang.clone()
            .filter(|s| !s.trim().is_empty())
            .or_else(|| kamar.tt_kelas.clone())
            .unwrap_or_default();

        let body = json!({
            "id_t_tt":             kamar.id_t_tt,
            "ruang":               ruang,
            "jumlah":              kamar.jumlah,
            "terpakai":            kamar.terpakai,
            "jumlah_ruang":        "0",
            "terpakai_suspek":     "0",
            "terpakai_konfirmasi": "0",
            "antrian":             "0",
            "prepare":             "0",
            "prepare_plan":        "0",
            "covid":               0,
            "terpakai_dbd":        "0",
            "terpakai_dbd_anak":   "0",
            "jumlah_dbd":          "0",
        });

        write_log(&pool, &tx, "info",
            format!("Kirim id_t_tt={} ({}) jumlah={} terpakai={}", kamar.id_t_tt, ruang, kamar.jumlah, kamar.terpakai)
        ).await;

        // Retry hingga 3x (jeda 3 detik) — sesuai service Java.
        let max_retry = 3;
        let mut attempt = 0;
        loop {
            attempt += 1;
            let ts = chrono::Utc::now().timestamp().to_string();
            let resp = client.put(&endpoint)
                .header("Content-Type", "application/json")
                .header("X-rs-id", &cfg.rs_id)
                .header("X-Timestamp", &ts)
                .header("X-pass", &cfg.pass)
                .body(body.to_string())
                .send().await;

            let sukses = match resp {
                Err(e) => {
                    write_log(&pool, &tx, "warning",
                        format!("Request gagal {} [percobaan {}/{}]: {}", kamar.id_t_tt, attempt, max_retry, e)
                    ).await;
                    false
                }
                Ok(r) => {
                    let status = r.status();
                    let text = r.text().await.unwrap_or_default();
                    // Sukses = HTTP 2xx; ambil message dari response.fasyankes[0].message bila ada.
                    if status.is_success() {
                        let msg = serde_json::from_str::<Value>(&text).ok()
                            .and_then(|v| v.pointer("/fasyankes/0/message")
                                .and_then(|m| m.as_str()).map(|s| s.to_string()))
                            .unwrap_or_else(|| if text.is_empty() { "OK (no content)".into() } else { text.clone() });
                        write_log(&pool, &tx, "success", format!("{} → {}", ruang, msg)).await;
                        true
                    } else {
                        write_log(&pool, &tx, "warning",
                            format!("Respon {} gagal [percobaan {}/{}]: HTTP {} {}", ruang, attempt, max_retry, status, text)
                        ).await;
                        false
                    }
                }
            };

            if sukses { break; }
            if attempt >= max_retry {
                write_log(&pool, &tx, "error",
                    format!("Menyerah kirim {} setelah {} percobaan", ruang, max_retry)
                ).await;
                break;
            }
            tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        }

        // Jeda antar data (3 detik, sesuai service Java).
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
    }

    write_log(&pool, &tx, "success", "Sync SIRANAP selesai".to_string()).await;
}

// ── Cron loop (spawn di main.rs) ─────────────────────────────────────────────
pub async fn run_cron_loop(
    pool: MySqlPool,
    cfg: SiranapConfig,
    tx: tokio::sync::broadcast::Sender<SiranapLogEntry>,
) {
    let interval_secs = cfg.interval_min.max(1) * 60;
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
    ticker.tick().await; // skip tick pertama (langsung) — tunda sync pertama 1 interval
    tracing::info!("[siranap] cron scheduler aktif, interval {} menit", cfg.interval_min);
    loop {
        ticker.tick().await;
        tracing::info!("[siranap] cron tick — memulai sync");
        run_sync(pool.clone(), cfg.clone(), tx.clone()).await;
    }
}

// ── HTTP handlers ────────────────────────────────────────────────────────────
pub async fn get_logs(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<SiranapLogEntry>>, (StatusCode, Json<Value>)> {
    let rows: Vec<SiranapLogEntry> = sqlx::query_as(
        "SELECT id, DATE_FORMAT(waktu, '%Y-%m-%d %H:%i:%s') AS waktu, level, message
         FROM simrscb_siranap_log ORDER BY id DESC LIMIT 1000"
    ).fetch_all(&state.pool).await
     .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    let mut rev = rows;
    rev.reverse();
    Ok(Json(rev))
}

pub async fn trigger_sync(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let pool = state.pool.clone();
    let cfg  = state.siranap_cfg.clone();
    let tx   = state.siranap_tx.clone();
    tokio::spawn(async move { run_sync(pool, cfg, tx).await; });
    Ok(Json(json!({"ok": true, "message": "Sync SIRANAP dimulai"})))
}

pub async fn clear_logs(
    user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query("DELETE FROM simrscb_siranap_log")
        .execute(&state.pool).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    crate::audit::log_sql(&state.pool, &user.0.kode, "DELETE FROM simrscb_siranap_log").await;
    Ok(Json(json!({"ok": true, "message": "Log dikosongkan"})))
}

pub async fn get_status(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_siranap_log")
        .fetch_one(&state.pool).await.unwrap_or(0);
    let last: Option<SiranapLogEntry> = sqlx::query_as(
        "SELECT id, DATE_FORMAT(waktu, '%Y-%m-%d %H:%i:%s') AS waktu, level, message
         FROM simrscb_siranap_log ORDER BY id DESC LIMIT 1"
    ).fetch_optional(&state.pool).await.ok().flatten();
    Ok(Json(json!({ "total_logs": count, "last_log": last })))
}

pub async fn get_config(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Json<Value> {
    let cfg = &state.siranap_cfg;
    Json(json!({
        "siranap_url":  cfg.url,
        "rs_id":        cfg.rs_id,
        "interval_min": cfg.interval_min,
        "jadwal":       format!("setiap {} menit", cfg.interval_min),
    }))
}

pub async fn stream_logs(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.siranap_tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|msg| async move {
        match msg {
            Ok(evt) => Event::default().json_data(&evt).ok().map(Ok),
            Err(_) => None,
        }
    });
    Sse::new(stream).keep_alive(KeepAlive::default())
}
