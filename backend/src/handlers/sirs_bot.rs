use crate::{auth::middleware::AuthUser, sirs_bot::{client::SirsClient, config::SirsBotConfig}, AppState};
use axum::{
    extract::{Path as AxumPath, State},
    http::StatusCode,
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use futures::stream::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::convert::Infallible;
use tokio_stream::wrappers::BroadcastStream;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SirsBotLogEntry {
    pub waktu: String,
    pub level: String,
    pub message: String,
}

pub fn broadcast_log(
    tx: &tokio::sync::broadcast::Sender<SirsBotLogEntry>,
    level: &str,
    message: String,
) {
    let waktu = chrono::Local::now().format("%H:%M:%S").to_string();
    let _ = tx.send(SirsBotLogEntry {
        waktu,
        level: level.to_string(),
        message,
    });
}

// ── Status & Profil ───────────────────────────────────────────────────────────
pub async fn get_status(
    _user: Option<AuthUser>,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let cfg = state.sirs_bot_cfg.read().await;
    let client = SirsClient::new();

    let hosp_info = if !cfg.kode_rs.is_empty() && !cfg.access_token.is_empty() {
        client.get_hospital_info(&cfg, &cfg.kode_rs).await.ok()
    } else {
        None
    };

    let masked_token = if cfg.access_token.len() > 15 {
        format!("{}...{}", &cfg.access_token[..6], &cfg.access_token[cfg.access_token.len()-6..])
    } else {
        String::new()
    };

    Ok(Json(json!({
        "status": true,
        "message": "SIRS 6.3 Bot Engine Aktif (Native Rust)",
        "data": {
            "port": cfg.port,
            "kode_rs": cfg.kode_rs,
            "nama_rs": cfg.nama_rs,
            "email": cfg.email,
            "has_token": !cfg.access_token.is_empty(),
            "token_preview": masked_token,
            "hospital_info": hosp_info,
        }
    })))
}

// ── Konfigurasi ───────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct ConfigBody {
    #[serde(default)] pub access_token: String,
    #[serde(default)] pub refresh_token: String,
    #[serde(default)] pub cf_clearance: String,
    #[serde(default)] pub xsrf_token: String,
    #[serde(default)] pub kode_rs: String,
    #[serde(default)] pub nama_rs: String,
    #[serde(default)] pub email: String,
    #[serde(default)] pub password: String,
}

pub async fn save_config(
    _user: Option<AuthUser>,
    State(state): State<AppState>,
    Json(b): Json<ConfigBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut cfg = state.sirs_bot_cfg.write().await;
    if !b.access_token.is_empty() { cfg.access_token = b.access_token; }
    if !b.refresh_token.is_empty() { cfg.refresh_token = b.refresh_token; }
    if !b.cf_clearance.is_empty() { cfg.cf_clearance = b.cf_clearance; }
    if !b.xsrf_token.is_empty() { cfg.xsrf_token = b.xsrf_token; }
    if !b.kode_rs.is_empty() { cfg.kode_rs = b.kode_rs; }
    if !b.nama_rs.is_empty() { cfg.nama_rs = b.nama_rs; }
    if !b.email.is_empty() { cfg.email = b.email; }
    if !b.password.is_empty() { cfg.password = b.password; }

    cfg.save().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"status": false, "message": e}))))?;
    broadcast_log(&state.sirs_bot_tx, "success", "Konfigurasi token SIRS 6.3 berhasil disimpan.".to_string());

    Ok(Json(json!({
        "status": true,
        "message": "Konfigurasi SIRS 6.3 berhasil disimpan"
    })))
}

// ── Login SSO ─────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct LoginBody {
    pub email: Option<String>,
    pub password: Option<String>,
}

pub async fn login_sso(
    _user: Option<AuthUser>,
    State(state): State<AppState>,
    Json(b): Json<LoginBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut cfg = state.sirs_bot_cfg.write().await;
    let email = b.email.unwrap_or_else(|| cfg.email.clone());
    let password = b.password.unwrap_or_else(|| cfg.password.clone());

    if email.is_empty() || password.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({
            "status": false,
            "message": "Email dan password SSO Yankes Kemenkes wajib diisi"
        }))));
    }

    broadcast_log(&state.sirs_bot_tx, "info", format!("Melakukan login SSO Yankes untuk {}", email));
    let client = SirsClient::new();
    let res = client.login_sso(&mut cfg, &email, &password).await
        .map_err(|e| {
            broadcast_log(&state.sirs_bot_tx, "error", format!("Login SSO gagal: {}", e));
            (StatusCode::BAD_REQUEST, Json(json!({"status": false, "message": e})))
        })?;

    broadcast_log(&state.sirs_bot_tx, "success", "Login SSO & pertukaran token sesi SIRS 6.3 Kemenkes berhasil!".to_string());
    Ok(Json(res))
}

// ── Refresh Token ─────────────────────────────────────────────────────────────
pub async fn refresh_token(
    _user: Option<AuthUser>,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut cfg = state.sirs_bot_cfg.write().await;
    let client = SirsClient::new();

    broadcast_log(&state.sirs_bot_tx, "info", "Memperbarui token sesi SIRS 6.3 Kemenkes...".to_string());
    let new_token = client.refresh_token(&mut cfg).await
        .map_err(|e| {
            broadcast_log(&state.sirs_bot_tx, "error", format!("Refresh token gagal: {}", e));
            (StatusCode::BAD_REQUEST, Json(json!({"status": false, "message": e})))
        })?;

    broadcast_log(&state.sirs_bot_tx, "success", "Access token SIRS 6.3 berhasil diperbarui!".to_string());
    Ok(Json(json!({
        "status": true,
        "message": "Token berhasil diperbarui",
        "access_token": new_token
    })))
}

// ── Submit Laporan RL ─────────────────────────────────────────────────────────
pub async fn submit_laporan(
    State(state): State<AppState>,
    AxumPath(form): AxumPath<String>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let form_upper = form.to_uppercase();
    broadcast_log(&state.sirs_bot_tx, "info", format!("[SIMRS -> SIRS 6] Menerima permintaan submit formulir {}...", form_upper));

    let mut cfg = state.sirs_bot_cfg.write().await;
    let client = SirsClient::new();

    let res = client.submit_rl(&mut cfg, &form, &payload).await
        .map_err(|e| {
            broadcast_log(&state.sirs_bot_tx, "warn", format!("[SIRS 6] Pengiriman {} ditolak: {}", form_upper, e));
            (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({
                "status": false,
                "message": e,
            })))
        })?;

    broadcast_log(&state.sirs_bot_tx, "success", format!("[SIRS 6 -> Kemenkes] Formulir {} berhasil dikirim dan tersimpan di server Kemenkes!", form_upper));
    Ok(Json(json!({
        "status": true,
        "message": format!("Formulir {} berhasil dikirim ke Kemenkes RI", form_upper),
        "data": res
    })))
}

// ── Stream Logs (SSE) ─────────────────────────────────────────────────────────
pub async fn stream_logs(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.sirs_bot_tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|msg| async move {
        match msg {
            Ok(evt) => Event::default().json_data(&evt).ok().map(Ok),
            Err(_) => None,
        }
    });
    Sse::new(stream).keep_alive(KeepAlive::default())
}
