// Mobile JKN — Antrean RS: kirim task-id ke BPJS secara event-driven.
//
// Alur: Khanza desktop (atau web) POST /api/mobilejkn/event {no_rawat, taskid, waktu}
//   → resolve kodebooking (nobooking utk Mobile JKN, no_rawat utk onsite)
//   → insert penanda idempotent ke referensi_mobilejkn_bpjs_taskid
//   → POST {BPJS_MOBILEJKN_URL}/antrean/updatewaktu (header HMAC)
//   → kalau gagal (code≠200) rollback penanda; kalau sukses log + broadcast SSE.
//
// Port dari service Java KhanzaHMSServiceMobileJKNERMAgustus2025 (frmUtama), tapi
// dipicu event, bukan polling 5 menit. Kripto HMAC pakai ulang bridging_bpjs.

use crate::auth::middleware::AuthUser;
use crate::handlers::bridging_bpjs::{build_signature, decrypt_response, utc_now_secs};
use crate::AppState;
use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use chrono::{FixedOffset, NaiveDateTime, TimeZone};
use futures::stream::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::convert::Infallible;
use tokio_stream::wrappers::BroadcastStream;

/// Task-id yang valid (loket 1-2, poli 3-7, batal 99).
const VALID_TASKS: &[&str] = &["1", "2", "3", "4", "5", "6", "7", "99"];

// ── Config Antrean (reuse cons/secret/user, base URL berbeda) ───────────────────
pub struct AntreanConfig {
    pub base_url:   String,
    pub cons_id:    String,
    pub secret_key: String,
    pub user_key:   String,
}

impl AntreanConfig {
    pub fn from_env() -> Option<Self> {
        let base_url   = std::env::var("BPJS_MOBILEJKN_URL").ok()?;
        let cons_id    = std::env::var("BPJS_CONS_ID").ok()?;
        let secret_key = std::env::var("BPJS_SECRET_KEY").ok()?;
        // PENTING: Antrean/Mobile JKN pakai user_key BERBEDA dari VClaim.
        // cons_id & secret_key sama, tapi user_key per-layanan. Utamakan
        // BPJS_MOBILEJKN_USER_KEY; fallback ke BPJS_USER_KEY kalau belum di-set.
        let user_key = std::env::var("BPJS_MOBILEJKN_USER_KEY")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| std::env::var("BPJS_USER_KEY").ok())
            .unwrap_or_default();
        if base_url.is_empty() || cons_id.is_empty() || secret_key.is_empty() || user_key.is_empty() {
            return None;
        }
        Some(Self { base_url, cons_id, secret_key, user_key })
    }
}

// ── Event yang dibroadcast ke dashboard (SSE) ───────────────────────────────────
#[derive(Clone, Serialize, Debug)]
pub struct MobileJknEvent {
    pub no_rawat:    String,
    pub kodebooking: String,
    pub taskid:      String,
    pub waktu_ms:    String,
    pub status:      String, // "sukses" | "gagal" | "skip"
    pub code:        String,
    pub message:     String,
    pub nama:        String,
    pub poli:        String,
    pub jam:         String, // waktu server saat diproses
}

// ── Request masuk (dari Khanza / web) ───────────────────────────────────────────
#[derive(Deserialize)]
pub struct EventReq {
    pub no_rawat: String,
    pub taskid:   String,
    /// Waktu kejadian: datetime "YYYY-MM-DD HH:MM:SS" (WIB) ATAU unix-ms string.
    /// Kosong → pakai waktu server sekarang.
    #[serde(default)]
    pub waktu: Option<String>,
    /// Kalau diisi, dipakai langsung. Kalau kosong, di-resolve dari DB.
    #[serde(default)]
    pub kodebooking: Option<String>,
    #[serde(default)]
    pub nama: Option<String>,
    #[serde(default)]
    pub poli: Option<String>,
    #[serde(default)]
    pub tgl_registrasi: Option<String>,
    /// Sumber pemicu: "khanza" | "web". Default "web".
    #[serde(default)]
    pub source: Option<String>,
}

fn bad(msg: &str) -> (StatusCode, Json<Value>) {
    (StatusCode::BAD_REQUEST, Json(json!({ "error": msg })))
}
fn ise(msg: String) -> (StatusCode, Json<Value>) {
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": msg })))
}

/// Konversi waktu event → unix milidetik (i64). Terima datetime WIB atau ms mentah.
fn waktu_to_ms(waktu: &Option<String>) -> i64 {
    let wib = FixedOffset::east_opt(7 * 3600).unwrap();
    if let Some(raw) = waktu {
        let s = raw.trim();
        if !s.is_empty() {
            // Sudah berupa unix-ms? (semua digit, cukup panjang)
            if s.chars().all(|c| c.is_ascii_digit()) && s.len() >= 12 {
                if let Ok(ms) = s.parse::<i64>() {
                    return ms;
                }
            }
            // Datetime "YYYY-MM-DD HH:MM:SS" (toleran pemisah 'T')
            let norm = s.replace('T', " ");
            let norm = norm.split('.').next().unwrap_or(&norm); // buang fraksi detik
            for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"] {
                if let Ok(ndt) = NaiveDateTime::parse_from_str(norm, fmt) {
                    if let Some(dt) = wib.from_local_datetime(&ndt).single() {
                        return dt.timestamp_millis();
                    }
                }
            }
        }
    }
    // Fallback: sekarang (WIB)
    chrono::Local::now().timestamp_millis()
}

/// POST /api/mobilejkn/event — kirim satu task-id ke BPJS.
pub async fn kirim_event(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<EventReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // ── Optional shared-key gating ──
    if let Ok(key) = std::env::var("MOBILEJKN_PUSH_KEY") {
        if !key.is_empty() {
            let got = headers.get("x-push-key").and_then(|v| v.to_str().ok()).unwrap_or("");
            if got != key {
                return Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "push key tidak valid" }))));
            }
        }
    }

    let no_rawat = req.no_rawat.trim().to_string();
    let taskid   = req.taskid.trim().to_string();
    if no_rawat.is_empty() {
        return Err(bad("no_rawat wajib"));
    }
    if !VALID_TASKS.contains(&taskid.as_str()) {
        return Err(bad("taskid tidak valid (1-7 atau 99)"));
    }

    let cfg = AntreanConfig::from_env()
        .ok_or_else(|| ise("BPJS_MOBILEJKN_URL / cons-id / secret belum di-set".into()))?;

    let waktu_ms = waktu_to_ms(&req.waktu);
    let source = req.source.clone().unwrap_or_else(|| "web".into());

    // ── Resolve kodebooking ──
    // Mobile JKN → nobooking; onsite → no_rawat.
    let kodebooking = match req.kodebooking.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(kb) => kb.to_string(),
        None => {
            let nobooking: Option<String> = sqlx::query_scalar(
                "SELECT nobooking FROM referensi_mobilejkn_bpjs WHERE no_rawat = ? LIMIT 1",
            )
            .bind(&no_rawat)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| ise(e.to_string()))?
            .flatten();
            match nobooking.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
                Some(kb) => kb,          // pasien Mobile JKN
                None => no_rawat.clone(), // pasien onsite/walk-in
            }
        }
    };

    // ── Idempotency: cek penanda, insert kalau belum ada ──
    let already: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM referensi_mobilejkn_bpjs_taskid WHERE no_rawat = ? AND taskid = ?",
    )
    .bind(&no_rawat)
    .bind(&taskid)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| ise(e.to_string()))?;

    if already > 0 {
        let evt = mk_event(&no_rawat, &kodebooking, &taskid, waktu_ms, "skip", "", "sudah pernah terkirim", &req);
        let _ = state.mobilejkn_tx.send(evt.clone());
        return Ok(Json(json!({
            "status": "skip", "reason": "duplicate",
            "no_rawat": no_rawat, "taskid": taskid, "kodebooking": kodebooking
        })));
    }

    // Insert penanda dulu (INSERT IGNORE — aman kalau ada unique key & race).
    sqlx::query(
        "INSERT IGNORE INTO referensi_mobilejkn_bpjs_taskid (no_rawat, taskid, waktu) VALUES (?, ?, ?)",
    )
    .bind(&no_rawat)
    .bind(&taskid)
    .bind(waktu_ms.to_string())
    .execute(&state.pool)
    .await
    .map_err(|e| ise(e.to_string()))?;

    // ── Kirim ke BPJS ──
    let url = format!("{}/antrean/updatewaktu", cfg.base_url.trim_end_matches('/'));
    let body = json!({
        "kodebooking": kodebooking,
        "taskid":      taskid,
        "waktu":       waktu_ms.to_string(),
    });
    let (code, message, raw_resp) = match post_antrean(&cfg, &url, &body).await {
        Ok(v) => v,
        Err(e) => {
            // Gagal jaringan → rollback penanda supaya bisa dicoba lagi.
            rollback(&state.pool, &no_rawat, &taskid).await;
            let evt = mk_event(&no_rawat, &kodebooking, &taskid, waktu_ms, "gagal", "", &e, &req);
            let _ = state.mobilejkn_tx.send(evt);
            return Err((StatusCode::BAD_GATEWAY, Json(json!({
                "status": "gagal", "error": e,
                "no_rawat": no_rawat, "taskid": taskid, "kodebooking": kodebooking
            }))));
        }
    };

    let sukses = matches!(code.as_str(), "200" | "208") || message.eq_ignore_ascii_case("ok");
    let status = if sukses { "sukses" } else { "gagal" };

    if !sukses {
        rollback(&state.pool, &no_rawat, &taskid).await;
    }

    // ── Log ke log_add_antrian (kompatibel dgn viewer Khanza) ──
    let header_ringkas = format!("x-cons-id={}; x-timestamp={}", cfg.cons_id, utc_now_secs());
    let _ = sqlx::query(
        "INSERT IGNORE INTO log_add_antrian \
         (tgl_registrasi, kd_booking, taskid, petugas, waktu, nama, no_rawat, poli, respon, kode_respon, header, complete_url_request, url) \
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(req.tgl_registrasi.clone().filter(|s| !s.trim().is_empty())) // NULL kalau kosong (kolom DATE)
    .bind(&kodebooking)
    .bind(&taskid)
    .bind(&source)
    .bind(waktu_ms.to_string())
    .bind(req.nama.clone().unwrap_or_else(|| "-".into()))
    .bind(&no_rawat)
    .bind(req.poli.clone().unwrap_or_else(|| "-".into()))
    .bind(&raw_resp)
    .bind(&code)
    .bind(&header_ringkas)
    .bind(body.to_string())
    .bind(&url)
    .execute(&state.pool)
    .await;

    // ── Audit trackersql ──
    crate::audit::log_sql(&state.pool, &source, &format!(
        "POST /antrean/updatewaktu kodebooking={} taskid={} waktu={} -> {} {}",
        crate::audit::q(&kodebooking), crate::audit::q(&taskid), waktu_ms, code, crate::audit::q(&message),
    )).await;

    // ── Broadcast SSE ──
    let evt = mk_event(&no_rawat, &kodebooking, &taskid, waktu_ms, status, &code, &message, &req);
    let _ = state.mobilejkn_tx.send(evt);

    tracing::info!("MobileJKN task {} no_rawat={} kb={} -> {} {} {}", taskid, no_rawat, kodebooking, status, code, message);

    Ok(Json(json!({
        "status": status,
        "code": code,
        "message": message,
        "no_rawat": no_rawat,
        "taskid": taskid,
        "kodebooking": kodebooking,
        "waktu_ms": waktu_ms.to_string(),
    })))
}

fn mk_event(
    no_rawat: &str, kodebooking: &str, taskid: &str, waktu_ms: i64,
    status: &str, code: &str, message: &str, req: &EventReq,
) -> MobileJknEvent {
    MobileJknEvent {
        no_rawat:    no_rawat.to_string(),
        kodebooking: kodebooking.to_string(),
        taskid:      taskid.to_string(),
        waktu_ms:    waktu_ms.to_string(),
        status:      status.to_string(),
        code:        code.to_string(),
        message:     message.to_string(),
        nama:        req.nama.clone().unwrap_or_default(),
        poli:        req.poli.clone().unwrap_or_default(),
        jam:         chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    }
}

async fn rollback(pool: &sqlx::MySqlPool, no_rawat: &str, taskid: &str) {
    let _ = sqlx::query("DELETE FROM referensi_mobilejkn_bpjs_taskid WHERE no_rawat = ? AND taskid = ?")
        .bind(no_rawat)
        .bind(taskid)
        .execute(pool)
        .await;
}

/// POST ke endpoint Antrean, kembalikan (code, message, raw_body).
/// Response Antrean pakai `metadata` (huruf kecil), beda dari VClaim `metaData`.
pub(crate) async fn post_antrean(
    cfg: &AntreanConfig,
    url: &str,
    body: &Value,
) -> Result<(String, String, String), String> {
    let ts = utc_now_secs();
    let sig = build_signature(&cfg.cons_id, &cfg.secret_key, ts);
    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("client build: {}", e))?;

    let resp = http
        .post(url)
        .header("x-cons-id", &cfg.cons_id)
        .header("x-timestamp", ts.to_string())
        .header("x-signature", &sig)
        .header("user_key", &cfg.user_key)
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .map_err(|e| format!("request: {}", e))?;

    let http_status = resp.status();
    let text = resp.text().await.map_err(|e| format!("read body: {}", e))?;
    if !http_status.is_success() {
        return Err(format!("HTTP {}: {}", http_status, text));
    }

    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("parse json: {} (body: {})", e, &text[..text.len().min(200)]))?;

    // Antrean: metadata.code bisa integer atau string.
    let code = raw
        .pointer("/metadata/code")
        .and_then(|v| v.as_str().map(|s| s.to_string()).or_else(|| v.as_i64().map(|n| n.to_string())))
        .unwrap_or_default();
    let message = raw
        .pointer("/metadata/message")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    Ok((code, message, text))
}

// ── READ-ONLY: cek status task sebuah booking asli (getlisttask) ────────────────
// TIDAK mengubah apa pun di BPJS — hanya membaca daftar task yang sudah terkirim.
#[derive(Deserialize)]
pub struct CekBookingQuery {
    pub kodebooking: String,
}

/// POST BPJS /antrean/getlisttask (read-only), balikan (code, message, tasks_array).
async fn antrean_getlisttask(cfg: &AntreanConfig, kodebooking: &str) -> Result<(String, String, Value), String> {
    let ts = utc_now_secs();
    let sig = build_signature(&cfg.cons_id, &cfg.secret_key, ts);
    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("client build: {}", e))?;

    let url = format!("{}/antrean/getlisttask", cfg.base_url.trim_end_matches('/'));
    let body = json!({ "kodebooking": kodebooking }).to_string();

    let resp = http
        .post(&url)
        .header("x-cons-id", &cfg.cons_id)
        .header("x-timestamp", ts.to_string())
        .header("x-signature", &sig)
        .header("user_key", &cfg.user_key)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("request: {}", e))?;

    let http_status = resp.status();
    let text = resp.text().await.map_err(|e| format!("read body: {}", e))?;
    if !http_status.is_success() {
        return Err(format!("HTTP {}: {}", http_status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("parse json: {}", e))?;
    let code = raw.pointer("/metadata/code")
        .and_then(|v| v.as_str().map(|s| s.to_string()).or_else(|| v.as_i64().map(|n| n.to_string())))
        .unwrap_or_default();
    let message = raw.pointer("/metadata/message").and_then(|v| v.as_str()).unwrap_or("").to_string();

    // response terenkripsi (AES-256-CBC + LZString) — dekripsi kalau code 200 & string.
    let tasks = match raw.get("response") {
        Some(Value::String(enc)) if code == "200" && !enc.is_empty() => {
            let dec = decrypt_response(enc, &cfg.cons_id, &cfg.secret_key, ts)?;
            serde_json::from_str::<Value>(&dec).unwrap_or(Value::Null)
        }
        Some(v) => v.clone(),
        None => Value::Null,
    };
    Ok((code, message, tasks))
}

/// GET /api/mobilejkn/getlisttask?kodebooking=XXX — cek booking asli (read-only).
pub async fn cek_booking(
    _user: AuthUser,
    State(_state): State<AppState>,
    Query(q): Query<CekBookingQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let kb = q.kodebooking.trim();
    if kb.is_empty() {
        return Err(bad("kodebooking wajib"));
    }
    let cfg = AntreanConfig::from_env()
        .ok_or_else(|| ise("BPJS_MOBILEJKN_URL / cons-id / secret / user_key belum di-set".into()))?;
    match antrean_getlisttask(&cfg, kb).await {
        Ok((code, message, tasks)) => Ok(Json(json!({
            "kodebooking": kb, "code": code, "message": message, "tasks": tasks
        }))),
        Err(e) => Err((StatusCode::BAD_GATEWAY, Json(json!({ "error": e, "kodebooking": kb })))),
    }
}

/// GET /api/mobilejkn/stream — SSE realtime untuk dashboard.
pub async fn stream_mobilejkn(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.mobilejkn_tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|msg| async move {
        match msg {
            Ok(evt) => Event::default().json_data(&evt).ok().map(Ok),
            Err(_) => None,
        }
    });
    Sse::new(stream).keep_alive(KeepAlive::default())
}

/// GET /api/mobilejkn/log — riwayat pengiriman task-id terbaru (untuk dashboard).
#[derive(Serialize, sqlx::FromRow)]
pub struct LogRow {
    pub tgl_registrasi: Option<String>,
    pub kd_booking:     Option<String>,
    pub taskid:         Option<String>,
    pub petugas:        Option<String>,
    pub waktu:          Option<String>,
    pub nama:           Option<String>,
    pub no_rawat:       Option<String>,
    pub poli:           Option<String>,
    pub kode_respon:    Option<String>,
    pub respon:         Option<String>,
}

pub async fn list_log(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // tgl_registrasi bertipe DATE → CAST ke CHAR agar decode ke String; PK = `no`.
    let rows = sqlx::query_as::<_, LogRow>(
        "SELECT DATE_FORMAT(tgl_registrasi,'%Y-%m-%d') AS tgl_registrasi, kd_booking, taskid, petugas, waktu, nama, no_rawat, poli, kode_respon, respon \
         FROM log_add_antrian ORDER BY no DESC LIMIT 200",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| ise(e.to_string()))?;
    Ok(Json(json!({ "data": rows })))
}
