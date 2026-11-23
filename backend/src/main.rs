mod audit;
mod auth;
mod config;
mod db;
mod enkripsi_aes;
mod handlers;
mod models;
mod routes;
mod sirs_bot;
mod ppra_bot;

use axum::{http::{HeaderValue, Method}, Router};
use sqlx::MySqlPool;
use tower_http::{
    cors::CorsLayer,
    set_header::SetResponseHeaderLayer,
};
use axum::http::header::{
    X_CONTENT_TYPE_OPTIONS, X_FRAME_OPTIONS, CACHE_CONTROL, STRICT_TRANSPORT_SECURITY,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Clone)]
pub struct AppState {
    pub pool: MySqlPool,
    pub jwt_secret: String,
    pub panggilan_tx: tokio::sync::broadcast::Sender<crate::handlers::antrian::PanggilanEvent>,
    pub farmasi_tx: tokio::sync::broadcast::Sender<crate::handlers::antrian::FarmasiPanggilanEvent>,
    pub poli_tx: tokio::sync::broadcast::Sender<crate::handlers::antrian::PoliPanggilanEvent>,
    pub aplicare_cfg: crate::handlers::aplicare::AplicareConfig,
    pub aplicare_tx: tokio::sync::broadcast::Sender<crate::handlers::aplicare::AplicareLogEntry>,
    pub mobilejkn_tx: tokio::sync::broadcast::Sender<crate::handlers::mobilejkn::MobileJknEvent>,
    pub siranap_cfg: crate::handlers::siranap::SiranapConfig,
    pub siranap_tx: tokio::sync::broadcast::Sender<crate::handlers::siranap::SiranapLogEntry>,
    pub satusehat_cfg: crate::handlers::satusehat::SatuSehatConfig,
    pub satusehat_tx: tokio::sync::broadcast::Sender<crate::handlers::satusehat::SatuSehatLogEntry>,
    pub sirs_bot_cfg: crate::sirs_bot::SharedConfig,
    pub sirs_bot_tx: tokio::sync::broadcast::Sender<crate::handlers::sirs_bot::SirsBotLogEntry>,
    pub ppra_bot_cfg: crate::ppra_bot::SharedConfig,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "simrscb_backend=info,tower_http=warn".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    dotenvy::dotenv().ok();

    let cfg = config::Config::from_env()?;
    let pool = db::create_pool(&cfg.database_url).await?;

    // CORS — daftar origin yang diizinkan, dipisahkan koma di CORS_ORIGIN.
    // Contoh: "http://192.168.8.49:3000,http://100.89.218.55:3000,https://192.168.8.49"
    // Khusus nilai "*" → izinkan semua origin (development only).
    let cors_origin_raw = std::env::var("CORS_ORIGIN")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());
    let cors_allow = if cors_origin_raw.trim() == "*" {
        tower_http::cors::AllowOrigin::any()
    } else {
        let origins: Vec<HeaderValue> = cors_origin_raw
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(|s| s.parse::<HeaderValue>()
                .unwrap_or_else(|_| panic!("CORS_ORIGIN entry tidak valid: {}", s)))
            .collect();
        tracing::info!("CORS origins yang diizinkan: {:?}", origins);
        tower_http::cors::AllowOrigin::list(origins)
    };
    let cors = CorsLayer::new()
        .allow_origin(cors_allow)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
        ]);

    // Request body size limit — 2 MB maksimum
    let body_limit = axum::extract::DefaultBodyLimit::max(2 * 1024 * 1024);

    // Broadcast channel untuk push pemanggilan antrian (kapasitas 64)
    let (panggilan_tx, _) = tokio::sync::broadcast::channel::<crate::handlers::antrian::PanggilanEvent>(64);

    // Broadcast channel untuk pemanggilan antrian farmasi (penyerahan obat)
    let (farmasi_tx, _) = tokio::sync::broadcast::channel::<crate::handlers::antrian::FarmasiPanggilanEvent>(64);

    // Broadcast channel untuk pemanggilan antrian masuk poli (DlgKasirRalan)
    let (poli_tx, _) = tokio::sync::broadcast::channel::<crate::handlers::antrian::PoliPanggilanEvent>(64);

    // Broadcast channel untuk event Mobile JKN task-id (dashboard SSE, kapasitas 256)
    let (mobilejkn_tx, _) = tokio::sync::broadcast::channel::<crate::handlers::mobilejkn::MobileJknEvent>(256);

    // ── BPJS Aplicare bed sync ──────────────────────────────────────────────
    let aplicare_cfg = crate::handlers::aplicare::AplicareConfig::from_env();
    let (aplicare_tx, _) = tokio::sync::broadcast::channel::<crate::handlers::aplicare::AplicareLogEntry>(256);
    if !aplicare_cfg.url.is_empty() && !aplicare_cfg.cons_id.is_empty() {
        let p = pool.clone(); let c = aplicare_cfg.clone(); let t = aplicare_tx.clone();
        tokio::spawn(async move {
            crate::handlers::aplicare::run_cron_loop(p, c, t).await;
        });
    } else {
        tracing::warn!("Aplicare cron tidak dispawn — APLICARE_URL / APLICARE_CONS_ID belum di-set");
    }

    // ── SIRANAP (ketersediaan TT) sync ke RS Online v3 Kemenkes ─────────────
    let siranap_cfg = crate::handlers::siranap::SiranapConfig::from_env();
    let (siranap_tx, _) = tokio::sync::broadcast::channel::<crate::handlers::siranap::SiranapLogEntry>(256);
    if !siranap_cfg.rs_id.is_empty() && !siranap_cfg.pass.is_empty() {
        let p = pool.clone(); let c = siranap_cfg.clone(); let t = siranap_tx.clone();
        tokio::spawn(async move {
            crate::handlers::siranap::run_cron_loop(p, c, t).await;
        });
    } else {
        tracing::warn!("SIRANAP cron tidak dispawn — SIRANAP_RS_ID / SIRANAP_PASS belum di-set");
    }

    // ── SatuSehat (FHIR R4) auto-sync RME dasar ─────────────────────────────
    let satusehat_cfg = crate::handlers::satusehat::SatuSehatConfig::from_env();
    let (satusehat_tx, _) = tokio::sync::broadcast::channel::<crate::handlers::satusehat::SatuSehatLogEntry>(256);
    if !satusehat_cfg.client_id.is_empty() && !satusehat_cfg.secret.is_empty() && !satusehat_cfg.org_id.is_empty() {
        let p = pool.clone(); let c = satusehat_cfg.clone(); let t = satusehat_tx.clone();
        tokio::spawn(async move {
            crate::handlers::satusehat::run_cron_loop(p, c, t).await;
        });
    } else {
        tracing::warn!("SatuSehat cron tidak dispawn — SATUSEHAT_CLIENT_ID / SECRET / ORG_ID belum di-set");
    }

    // ── SIRS 6.3 Bot Engine (Native Rust) ──────────────────────────────────
    let sirs_bot_cfg = crate::sirs_bot::new_shared_config();
    let (sirs_bot_tx, _) = tokio::sync::broadcast::channel::<crate::handlers::sirs_bot::SirsBotLogEntry>(256);
    let ppra_bot_cfg = crate::ppra_bot::new_shared_config();

    let app = Router::new()
        .nest("/api", routes::api_router(
            pool.clone(),
            cfg.jwt_secret.clone(),
            panggilan_tx.clone(),
            farmasi_tx.clone(),
            poli_tx.clone(),
            aplicare_cfg.clone(),
            aplicare_tx.clone(),
            mobilejkn_tx.clone(),
            siranap_cfg.clone(),
            siranap_tx.clone(),
            satusehat_cfg.clone(),
            satusehat_tx.clone(),
            sirs_bot_cfg.clone(),
            sirs_bot_tx.clone(),
            ppra_bot_cfg.clone(),
        ))
        .layer(body_limit)
        .layer(cors)
        // Security headers
        .layer(SetResponseHeaderLayer::if_not_present(
            X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            X_FRAME_OPTIONS, HeaderValue::from_static("SAMEORIGIN"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            CACHE_CONTROL, HeaderValue::from_static("no-store"),
        ))
        // HSTS — paksa HTTPS (aman di belakang Cloudflare/Apache TLS).
        .layer(SetResponseHeaderLayer::if_not_present(
            STRICT_TRANSPORT_SECURITY, HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        ));

    let addr = format!("0.0.0.0:{}", cfg.port);
    tracing::info!("simrscb backend listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
