// BPJS Aplicare bed availability sync — port dari simrs-aplicare-web (Go).
// Improvements: persistent log (vs in-memory), SSE (vs WebSocket), JWT-protected endpoints.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::State,
    http::StatusCode,
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use base64::Engine;
use futures::stream::{Stream, StreamExt};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Sha256;
use sqlx::MySqlPool;
use std::convert::Infallible;
use tokio_stream::wrappers::BroadcastStream;

type HmacSha256 = Hmac<Sha256>;

// ── Config ────────────────────────────────────────────────────────────────────
#[derive(Clone, Debug)]
pub struct AplicareConfig {
    pub url:        String,
    pub secret_key: String,
    pub cons_id:    String,
    pub kode_ppk:   String,
    pub interval_min: u64,
}

impl AplicareConfig {
    pub fn from_env() -> Self {
        Self {
            url:          std::env::var("APLICARE_URL").unwrap_or_default(),
            secret_key:   std::env::var("APLICARE_SECRET_KEY").unwrap_or_default(),
            cons_id:      std::env::var("APLICARE_CONS_ID").unwrap_or_default(),
            kode_ppk:     std::env::var("APLICARE_KODE_PPK").unwrap_or_default(),
            interval_min: std::env::var("APLICARE_INTERVAL_MIN")
                .ok().and_then(|s| s.parse().ok()).unwrap_or(10),
        }
    }

    /// Resolve kode_ppk: env override → fallback `setting.kode_ppk`.
    pub async fn resolved_kode_ppk(&self, pool: &MySqlPool) -> String {
        if !self.kode_ppk.is_empty() { return self.kode_ppk.clone(); }
        sqlx::query_scalar::<_, String>("SELECT kode_ppk FROM setting LIMIT 1")
            .fetch_optional(pool).await.ok().flatten().unwrap_or_default()
    }
}

// ── Log entry ────────────────────────────────────────────────────────────────
#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AplicareLogEntry {
    pub id:      Option<i64>,
    pub waktu:   String,
    pub level:   String,
    pub message: String,
}

// ── HMAC helper (BPJS spec) ──────────────────────────────────────────────────
fn generate_signature(cons_id: &str, secret_key: &str) -> (String, i64) {
    let timestamp = chrono::Utc::now().timestamp();
    let salt = format!("{}&{}", cons_id, timestamp);
    let mut mac = HmacSha256::new_from_slice(secret_key.as_bytes())
        .expect("HMAC accepts any key length");
    mac.update(salt.as_bytes());
    let sig = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());
    (sig, timestamp)
}

// ── DB log helpers ───────────────────────────────────────────────────────────
async fn write_log(pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<AplicareLogEntry>,
                    level: &str, message: String) {
    let waktu = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    tracing::info!("[aplicare][{}] {}", level, message);

    let inserted = sqlx::query(
        "INSERT INTO simrscb_aplicare_log (waktu, level, message) VALUES (?, ?, ?)"
    )
    .bind(&waktu).bind(level).bind(&message)
    .execute(pool).await.ok();

    let id = inserted.map(|r| r.last_insert_id() as i64);

    let _ = tx.send(AplicareLogEntry {
        id, waktu, level: level.to_string(), message,
    });

    // Trim: keep last 5000 rows
    let _ = sqlx::query(
        "DELETE FROM simrscb_aplicare_log
         WHERE id < (SELECT id FROM (SELECT id FROM simrscb_aplicare_log ORDER BY id DESC LIMIT 1 OFFSET 5000) x)"
    ).execute(pool).await;
}

// ── Sync logic ───────────────────────────────────────────────────────────────
#[derive(Debug, sqlx::FromRow)]
struct KamarRow {
    kode_kelas_aplicare: String,
    kd_bangsal:          String,
    nm_bangsal:          String,
    kelas:               String,
}

pub async fn run_sync(
    pool: MySqlPool,
    cfg: AplicareConfig,
    tx: tokio::sync::broadcast::Sender<AplicareLogEntry>,
) {
    let kode_ppk = cfg.resolved_kode_ppk(&pool).await;

    if cfg.url.is_empty() || cfg.cons_id.is_empty() || cfg.secret_key.is_empty() || kode_ppk.is_empty() {
        write_log(&pool, &tx, "error",
            "Config Aplicare belum lengkap (URL / Cons-ID / Secret Key / Kode PPK kosong). Set di .env".to_string()
        ).await;
        return;
    }

    write_log(&pool, &tx, "info", "Memulai sync Aplicare".to_string()).await;
    write_log(&pool, &tx, "info",
        format!("URL: {}/rest/bed/update/{} | PPK: {}", cfg.url, kode_ppk, kode_ppk)
    ).await;

    let rows: Vec<KamarRow> = match sqlx::query_as(
        "SELECT akk.kode_kelas_aplicare, akk.kd_bangsal, b.nm_bangsal, akk.kelas
         FROM aplicare_ketersediaan_kamar akk
         INNER JOIN bangsal b ON akk.kd_bangsal = b.kd_bangsal"
    ).fetch_all(&pool).await {
        Ok(r) => r,
        Err(e) => {
            write_log(&pool, &tx, "error", format!("Query kamar gagal: {}", e)).await;
            return;
        }
    };

    // HTTP client dengan TLS 1.2 fixed (BPJS endpoint rewel).
    // Note: InsecureSkipVerify Go → di reqwest pakai danger_accept_invalid_certs.
    // Diaktifkan karena cert chain BPJS sering bermasalah di server Linux baru;
    // dianggap acceptable risk untuk endpoint internal-only.
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .min_tls_version(reqwest::tls::Version::TLS_1_2)
        .max_tls_version(reqwest::tls::Version::TLS_1_2)
        .danger_accept_invalid_certs(true)
        .build();

    let client = match client {
        Ok(c) => c,
        Err(e) => {
            write_log(&pool, &tx, "error", format!("Init HTTP client gagal: {}", e)).await;
            return;
        }
    };

    for kamar in rows {
        let kapasitas: i64 = sqlx::query_scalar(
            "SELECT COUNT(kd_kamar) FROM kamar
             WHERE statusdata='1' AND kelas=? AND kd_bangsal=?"
        ).bind(&kamar.kelas).bind(&kamar.kd_bangsal)
         .fetch_one(&pool).await.unwrap_or(0);

        let tersedia: i64 = sqlx::query_scalar(
            "SELECT COUNT(kd_kamar) FROM kamar
             WHERE statusdata='1' AND kelas=? AND kd_bangsal=? AND status='KOSONG'"
        ).bind(&kamar.kelas).bind(&kamar.kd_bangsal)
         .fetch_one(&pool).await.unwrap_or(0);

        // Pakai serde_json::json! supaya nama bangsal di-escape proper
        // (original Go pakai fmt.Sprintf — rentan injection bila nama mengandung ").
        let body = json!({
            "kodekelas":         kamar.kode_kelas_aplicare,
            "koderuang":         kamar.kd_bangsal,
            "namaruang":         kamar.nm_bangsal,
            "kapasitas":         kapasitas.to_string(),
            "tersedia":          tersedia.to_string(),
            "tersediapria":      tersedia.to_string(),
            "tersediawanita":    tersedia.to_string(),
            "tersediapriawanita":tersedia.to_string(),
        });

        write_log(&pool, &tx, "info",
            format!("Kirim {} {} → {}", kamar.kode_kelas_aplicare, kamar.nm_bangsal, body)
        ).await;

        // Kirim ke BPJS dengan RETRY hingga 5x bila gagal (network error atau code != 200).
        let url = format!("{}/rest/bed/update/{}", cfg.url, kode_ppk);
        let max_retry = 5;
        let mut attempt = 0;
        loop {
            attempt += 1;
            // Signature (X-Timestamp) di-generate ulang tiap percobaan agar tidak kadaluarsa.
            let (sig, ts) = generate_signature(&cfg.cons_id, &cfg.secret_key);
            let resp = client.post(&url)
                .header("Content-Type", "application/json")
                .header("X-Cons-ID", &cfg.cons_id)
                .header("X-Timestamp", ts.to_string())
                .header("X-Signature", &sig)
                .json(&body)
                .send().await;

            let sukses = match resp {
                Err(e) => {
                    write_log(&pool, &tx, "warning",
                        format!("Request gagal {} [percobaan {}/{}]: {}", kamar.kd_bangsal, attempt, max_retry, e)
                    ).await;
                    false
                }
                Ok(r) => {
                    let text = r.text().await.unwrap_or_default();
                    // {"metadata":{"code":"200","message":"OK"},...}
                    let (code, msg) = serde_json::from_str::<Value>(&text).ok()
                        .and_then(|v| v.get("metadata").map(|m| (
                            m.get("code").map(|c| c.as_str().map(|s| s.to_string())
                                .or_else(|| c.as_i64().map(|n| n.to_string())).unwrap_or_default())
                                .unwrap_or_default(),
                            m.get("message").and_then(|x| x.as_str()).unwrap_or("").to_string(),
                        )))
                        .unwrap_or_default();
                    if code == "200" || code == "1" {
                        write_log(&pool, &tx, "success",
                            format!("Respon {}: {} {}", kamar.nm_bangsal, code, msg)
                        ).await;
                        true
                    } else {
                        let detail = if msg.is_empty() { text } else { msg };
                        write_log(&pool, &tx, "warning",
                            format!("Respon {} gagal [percobaan {}/{}]: {} {}", kamar.nm_bangsal, attempt, max_retry, code, detail)
                        ).await;
                        false
                    }
                }
            };

            if sukses { break; }
            if attempt >= max_retry {
                write_log(&pool, &tx, "error",
                    format!("Menyerah kirim {} setelah {} percobaan", kamar.nm_bangsal, max_retry)
                ).await;
                break;
            }
            tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        }
    }

    write_log(&pool, &tx, "success", "Sync Aplicare selesai".to_string()).await;
}

// ── Cron loop (spawn di main.rs) ─────────────────────────────────────────────
pub async fn run_cron_loop(
    pool: MySqlPool,
    cfg: AplicareConfig,
    tx: tokio::sync::broadcast::Sender<AplicareLogEntry>,
) {
    let interval_secs = cfg.interval_min.max(1) * 60;
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
    // Skip first tick (which fires immediately) to delay first run by interval
    ticker.tick().await;
    tracing::info!("[aplicare] cron scheduler aktif, interval {} menit", cfg.interval_min);
    loop {
        ticker.tick().await;
        tracing::info!("[aplicare] cron tick — memulai sync");
        run_sync(pool.clone(), cfg.clone(), tx.clone()).await;
    }
}

// ── HTTP handlers ────────────────────────────────────────────────────────────
pub async fn get_logs(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<AplicareLogEntry>>, (StatusCode, Json<Value>)> {
    let rows: Vec<AplicareLogEntry> = sqlx::query_as(
        "SELECT id, DATE_FORMAT(waktu, '%Y-%m-%d %H:%i:%s') AS waktu, level, message
         FROM simrscb_aplicare_log
         ORDER BY id DESC LIMIT 1000"
    ).fetch_all(&state.pool).await
     .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    // Return newest-first reversed → oldest-first untuk konsumsi UI append-only
    let mut rev = rows;
    rev.reverse();
    Ok(Json(rev))
}

pub async fn trigger_sync(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let pool = state.pool.clone();
    let cfg  = state.aplicare_cfg.clone();
    let tx   = state.aplicare_tx.clone();
    tokio::spawn(async move { run_sync(pool, cfg, tx).await; });
    Ok(Json(json!({"ok": true, "message": "Sync dimulai"})))
}

pub async fn clear_logs(
    user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query("DELETE FROM simrscb_aplicare_log")
        .execute(&state.pool).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    crate::audit::log_sql(&state.pool, &user.0.kode, "DELETE FROM simrscb_aplicare_log").await;

    Ok(Json(json!({"ok": true, "message": "Log dikosongkan"})))
}

pub async fn get_status(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM simrscb_aplicare_log"
    ).fetch_one(&state.pool).await.unwrap_or(0);

    let last: Option<AplicareLogEntry> = sqlx::query_as(
        "SELECT id, DATE_FORMAT(waktu, '%Y-%m-%d %H:%i:%s') AS waktu, level, message
         FROM simrscb_aplicare_log ORDER BY id DESC LIMIT 1"
    ).fetch_optional(&state.pool).await.ok().flatten();

    Ok(Json(json!({ "total_logs": count, "last_log": last })))
}

pub async fn get_config(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Json<Value> {
    let cfg = &state.aplicare_cfg;
    let kode_ppk = cfg.resolved_kode_ppk(&state.pool).await;
    Json(json!({
        "aplicare_url": cfg.url,
        "cons_id":      cfg.cons_id,
        "kode_ppk":     kode_ppk,
        "interval_min": cfg.interval_min,
        "jadwal":       format!("setiap {} menit", cfg.interval_min),
    }))
}

pub async fn stream_logs(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.aplicare_tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|msg| async move {
        match msg {
            Ok(evt) => Event::default().json_data(&evt).ok().map(Ok),
            Err(_) => None,
        }
    });
    Sse::new(stream).keep_alive(KeepAlive::default())
}

// ── Dashboard ketersediaan tempat tidur ──────────────────────────────────────
// Angka dihitung LIVE dari tabel `kamar` dengan rumus yang SAMA PERSIS dengan
// run_sync (statusdata='1', status='KOSONG'), supaya yang tampil di dashboard =
// yang dikirim ke BPJS. Kolom kapasitas/tersedia di aplicare_ketersediaan_kamar
// sengaja tidak dipakai — run_sync pun tidak menulisinya, jadi isinya bisa basi.

#[derive(Serialize, sqlx::FromRow)]
pub struct BedRuang {
    pub kode_kelas: String,
    pub kd_bangsal: String,
    pub nm_bangsal: String,
    pub kelas:      String,
    pub kapasitas:  i64,
    pub tersedia:   i64,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct BedBelumDipetakan {
    pub kd_bangsal: String,
    pub nm_bangsal: String,
    pub kelas:      String,
    pub kapasitas:  i64,
    pub tersedia:   i64,
}

#[derive(Serialize)]
pub struct BedKelas {
    pub kode_kelas: String,
    pub jml_ruang:  i64,
    pub kapasitas:  i64,
    pub tersedia:   i64,
}

/// Hitung ketersediaan TT. Dipakai dua endpoint: /aplicare/bed (dashboard staf,
/// perlu login) dan /display/tempat-tidur (layar TV, publik).
struct BedData {
    per_ruang: Vec<BedRuang>,
    per_kelas: Vec<BedKelas>,
    belum_dipetakan: Vec<BedBelumDipetakan>,
    kapasitas: i64,
    tersedia: i64,
}

async fn hitung_bed(state: &AppState) -> Result<BedData, (StatusCode, Json<Value>)> {
    let db_err = |e: sqlx::Error| {
        tracing::error!("DB aplicare bed: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal membaca data kamar"})))
    };

    let per_ruang: Vec<BedRuang> = sqlx::query_as(
        "SELECT akk.kode_kelas_aplicare AS kode_kelas, akk.kd_bangsal, b.nm_bangsal, akk.kelas,
                COUNT(k.kd_kamar) AS kapasitas,
                CAST(IFNULL(SUM(k.status='KOSONG'),0) AS SIGNED) AS tersedia
         FROM aplicare_ketersediaan_kamar akk
         INNER JOIN bangsal b ON b.kd_bangsal = akk.kd_bangsal
         LEFT JOIN kamar k ON k.kd_bangsal = akk.kd_bangsal
                          AND k.kelas = akk.kelas AND k.statusdata = '1'
         GROUP BY akk.kode_kelas_aplicare, akk.kd_bangsal, akk.kelas, b.nm_bangsal
         ORDER BY akk.kode_kelas_aplicare, b.nm_bangsal"
    ).fetch_all(&state.pool).await.map_err(db_err)?;

    // Bangsal/kelas yang punya kamar aktif tapi tidak ada di tabel pemetaan →
    // tempat tidurnya TIDAK pernah dilaporkan ke BPJS.
    let belum_dipetakan: Vec<BedBelumDipetakan> = sqlx::query_as(
        "SELECT k.kd_bangsal, b.nm_bangsal, k.kelas,
                COUNT(*) AS kapasitas,
                CAST(IFNULL(SUM(k.status='KOSONG'),0) AS SIGNED) AS tersedia
         FROM kamar k
         INNER JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal
         WHERE k.statusdata = '1'
           AND NOT EXISTS (SELECT 1 FROM aplicare_ketersediaan_kamar a
                           WHERE a.kd_bangsal = k.kd_bangsal AND a.kelas = k.kelas)
         GROUP BY k.kd_bangsal, k.kelas, b.nm_bangsal
         ORDER BY b.nm_bangsal"
    ).fetch_all(&state.pool).await.map_err(db_err)?;

    // Rekap per kode kelas Aplicare (KL1/KL2/KL3/ICU/HCU/NIC/PIC …)
    let mut per_kelas: Vec<BedKelas> = Vec::new();
    for r in &per_ruang {
        match per_kelas.iter_mut().find(|k| k.kode_kelas == r.kode_kelas) {
            Some(k) => { k.jml_ruang += 1; k.kapasitas += r.kapasitas; k.tersedia += r.tersedia; }
            None => per_kelas.push(BedKelas {
                kode_kelas: r.kode_kelas.clone(), jml_ruang: 1,
                kapasitas: r.kapasitas, tersedia: r.tersedia,
            }),
        }
    }

    let kapasitas: i64 = per_ruang.iter().map(|r| r.kapasitas).sum();
    let tersedia:  i64 = per_ruang.iter().map(|r| r.tersedia).sum();

    Ok(BedData { per_ruang, per_kelas, belum_dipetakan, kapasitas, tersedia })
}

pub async fn get_bed(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let d = hitung_bed(&state).await?;

    let sync_terakhir: Option<AplicareLogEntry> = sqlx::query_as(
        "SELECT id, DATE_FORMAT(waktu, '%Y-%m-%d %H:%i:%s') AS waktu, level, message
         FROM simrscb_aplicare_log
         WHERE message LIKE 'Sync Aplicare selesai%' OR level = 'error'
         ORDER BY id DESC LIMIT 1"
    ).fetch_optional(&state.pool).await.ok().flatten();

    Ok(Json(json!({
        "kapasitas":       d.kapasitas,
        "tersedia":        d.tersedia,
        "terisi":          d.kapasitas - d.tersedia,
        "per_kelas":       d.per_kelas,
        "per_ruang":       d.per_ruang,
        "belum_dipetakan": d.belum_dipetakan,
        "kapasitas_belum_dipetakan": d.belum_dipetakan.iter().map(|r| r.kapasitas).sum::<i64>(),
        "sync_terakhir":   sync_terakhir,
        "interval_min":    state.aplicare_cfg.interval_min,
        "waktu_server":    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })))
}

/// GET /display/tempat-tidur — untuk layar TV, TANPA login.
/// Isinya hanya jumlah tempat tidur per ruang/kelas: tidak ada data pasien,
/// tidak ada log sync, dan tidak ada daftar "belum dipetakan" (itu urusan
/// internal, bukan tontonan pengunjung).
pub async fn display_bed(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let d = hitung_bed(&state).await?;
    Ok(Json(json!({
        "kapasitas":    d.kapasitas,
        "tersedia":     d.tersedia,
        "terisi":       d.kapasitas - d.tersedia,
        "per_kelas":    d.per_kelas,
        "per_ruang":    d.per_ruang,
        "waktu_server": chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })))
}
