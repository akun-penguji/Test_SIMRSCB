use crate::{ppra_bot::{client::PpraClient, config::PpraBotConfig}, AppState};
use axum::{
    extract::{Path as AxumPath, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// Endpoint bot bisa mengirim laporan atas nama RS ke portal Kemenkes dan mengubah kredensialnya.
/// Bila env PPRA_BOT_TOKEN diisi, header X-Ppra-Token wajib cocok (Java: TOKENPPRABOT di database.xml).
fn cek_token(headers: &HeaderMap) -> Result<(), (StatusCode, Json<Value>)> {
    let token = std::env::var("PPRA_BOT_TOKEN").unwrap_or_default();
    if token.trim().is_empty() {
        return Ok(());
    }
    let dikirim = headers.get("x-ppra-token").and_then(|v| v.to_str().ok()).unwrap_or("");
    let sama = dikirim.len() == token.len()
        && dikirim.bytes().zip(token.bytes()).fold(0u8, |acc, (a, b)| acc | (a ^ b)) == 0;
    if sama {
        Ok(())
    } else {
        Err((StatusCode::UNAUTHORIZED, Json(json!({"status": false, "message": "Token bot PPRA tidak valid"}))))
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PpraConfigPayload {
    pub username: Option<String>,
    pub password: Option<String>,
    pub cf_clearance: Option<String>,
    pub user_agent: Option<String>,
}

pub async fn get_status(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let cfg = state.ppra_bot_cfg.read().await;

    Ok(Json(json!({
        "status": true,
        "message": "PPRA Kemenkes Bot Engine Aktif (Native Rust)",
        "data": {
            "username": cfg.username,
            "has_session": !cfg.session_cookie.is_empty(),
            "has_cf_clearance": !cfg.cf_clearance.is_empty(),
            "last_login": cfg.last_login,
            "base_url": cfg.base_url,
        }
    })))
}

pub async fn save_config(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<PpraConfigPayload>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    cek_token(&headers)?;
    let mut cfg = state.ppra_bot_cfg.write().await;
    if let Some(u) = payload.username { cfg.username = u; }
    if let Some(p) = payload.password { cfg.password = p; }
    if let Some(cf) = payload.cf_clearance { cfg.cf_clearance = cf; }
    if let Some(ua) = payload.user_agent { cfg.user_agent = ua; }

    cfg.save().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": false, "message": format!("Gagal simpan konfigurasi PPRA: {}", e)})),
        )
    })?;

    Ok(Json(json!({
        "status": true,
        "message": "Konfigurasi PPRA Bot berhasil diperbarui",
        "data": {
            "username": cfg.username,
            "has_session": !cfg.session_cookie.is_empty(),
            "has_cf_clearance": !cfg.cf_clearance.is_empty(),
        }
    })))
}

pub async fn login_ppra(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    cek_token(&headers)?;
    let mut cfg = state.ppra_bot_cfg.write().await;
    let client = PpraClient::new();

    match client.login(&mut cfg).await {
        Ok(()) => {
            Ok(Json(json!({
                "status": true,
                "message": "Login otomatis ke portal PPRA Kemenkes berhasil!",
                "data": {
                    "username": cfg.username,
                    "last_login": cfg.last_login,
                    "has_session": !cfg.session_cookie.is_empty(),
                }
            })))
        }
        Err(e) => {
            Err((
                StatusCode::BAD_GATEWAY,
                Json(json!({
                    "status": false,
                    "message": format!("Login PPRA gagal: {}", e),
                })),
            ))
        }
    }
}

pub async fn submit_laporan(
    AxumPath(form): AxumPath<String>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    cek_token(&headers)?;
    let mut cfg = state.ppra_bot_cfg.write().await;
    let client = PpraClient::new();

    match client.submit(&mut cfg, &form, &payload).await {
        Ok(res) if !res.get("success").and_then(|v| v.as_bool()).unwrap_or(false) => Err((
            StatusCode::BAD_GATEWAY,
            Json(json!({
                "status": false,
                "form": form,
                "message": format!("Portal PPRA tidak menyimpan sub-laporan {}", form),
                "response": res
            })),
        )),
        Ok(res) => {
            Ok(Json(json!({
                "status": true,
                "form": form,
                "message": format!("Sub-laporan PPRA {} berhasil diproses", form),
                "response": res
            })))
        }
        Err(e) => {
            Err((
                StatusCode::BAD_GATEWAY,
                Json(json!({
                    "status": false,
                    "form": form,
                    "message": format!("Pengiriman PPRA {} gagal: {}", form, e),
                })),
            ))
        }
    }
}

pub async fn delete_laporan(
    AxumPath((form, id)): AxumPath<(String, String)>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    cek_token(&headers)?;
    let mut cfg = state.ppra_bot_cfg.write().await;
    let client = PpraClient::new();

    match client.delete_item(&mut cfg, &form, &id).await {
        Ok(res) => Ok(Json(res)),
        Err(e) => Err((
            StatusCode::BAD_GATEWAY,
            Json(json!({"status": false, "message": e})),
        )),
    }
}

