// SatuSehat (Kemenkes FHIR R4) — auto-sync RME dasar (Opsi A core).
// Port dari src/bridging/SatuSehatBundelHelper — HANYA Encounter.
// Condition (ICD-10), Procedure (ICD-9), dan penuntasan Encounter ke
// status `finished` tetap dikerjakan aplikasi Khanza desktop.
// Pola sama aplicare/siranap: config env → cron → run_sync → log persist + SSE.
//
// Alur per no_rawat (kunjungan 'Sudah'):
//   OAuth2 token → resolve IHS pasien (& dokter) → POST Encounter.
//   Idempoten via tabel satu_sehat_encounter.

use crate::{auth::middleware::AuthUser, auth::jwt::decode_jwt, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{sse::{Event, KeepAlive, Sse}, IntoResponse, Response},
    Json,
};
use chrono::DateTime;
use futures::stream::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::MySqlPool;
use std::convert::Infallible;
use tokio_stream::wrappers::BroadcastStream;

// ── Config ────────────────────────────────────────────────────────────────────
#[derive(Clone, Debug)]
pub struct SatuSehatConfig {
    pub url_auth:     String, // https://api-satusehat.kemkes.go.id/oauth2/v1
    pub url_fhir:     String, // https://api-satusehat.kemkes.go.id/fhir-r4/v1
    pub client_id:    String,
    pub secret:       String,
    pub org_id:       String, // IDSATUSEHAT (Organization id)
    pub interval_min: u64,
    pub window_days:  i64,
    pub delay_ms:     u64, // jeda antar request (throttle rate-limit)
    pub d_from:       String, // batas tanggal bawah per-run "YYYY-MM-DD" (dihitung run_sync)
    pub d_to:         String, // batas atas per-run "YYYY-MM-DD 23:59:59"
}

impl SatuSehatConfig {
    pub fn from_env() -> Self {
        Self {
            url_auth: std::env::var("SATUSEHAT_AUTH_URL")
                .unwrap_or_else(|_| "https://api-satusehat.kemkes.go.id/oauth2/v1".to_string()),
            url_fhir: std::env::var("SATUSEHAT_FHIR_URL")
                .unwrap_or_else(|_| "https://api-satusehat.kemkes.go.id/fhir-r4/v1".to_string()),
            client_id:    std::env::var("SATUSEHAT_CLIENT_ID").unwrap_or_default(),
            secret:       std::env::var("SATUSEHAT_SECRET").unwrap_or_default(),
            org_id:       std::env::var("SATUSEHAT_ORG_ID").unwrap_or_default(),
            interval_min: std::env::var("SATUSEHAT_INTERVAL_MIN").ok().and_then(|s| s.parse().ok()).unwrap_or(30),
            window_days:  std::env::var("SATUSEHAT_WINDOW_DAYS").ok().and_then(|s| s.parse().ok()).unwrap_or(7),
            delay_ms:     std::env::var("SATUSEHAT_DELAY_MS").ok().and_then(|s| s.parse().ok()).unwrap_or(1200),
            d_from:       String::new(),
            d_to:         String::new(),
        }
    }
}

// ── Log entry ───────────────────────────────────────────────────────────────
#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct SatuSehatLogEntry {
    pub id:      Option<i64>,
    pub waktu:   String,
    pub level:   String,
    pub message: String,
}

async fn write_log(
    pool: &MySqlPool,
    tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>,
    level: &str,
    message: String,
) {
    let waktu = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let inserted = sqlx::query("INSERT INTO simrscb_satusehat_log (waktu, level, message) VALUES (?, ?, ?)")
        .bind(&waktu).bind(level).bind(&message).execute(pool).await.ok();
    let id = inserted.map(|r| r.last_insert_id() as i64);
    let _ = tx.send(SatuSehatLogEntry { id, waktu, level: level.to_string(), message });
    let _ = sqlx::query(
        "DELETE FROM simrscb_satusehat_log
         WHERE id < (SELECT id FROM (SELECT id FROM simrscb_satusehat_log ORDER BY id DESC LIMIT 1 OFFSET 5000) x)"
    ).execute(pool).await;
}

// ── Util ──────────────────────────────────────────────────────────────────────
/// Konversi datetime WIB (mis. "2026-07-06T09:30:00+07:00") → ISO UTC "…+00:00".
/// Fallback: kembalikan input apa adanya kalau parse gagal.
fn iso_to_utc(wib: &str) -> String {
    match DateTime::parse_from_rfc3339(wib) {
        Ok(dt) => dt.with_timezone(&chrono::Utc).format("%Y-%m-%dT%H:%M:%S+00:00").to_string(),
        Err(_) => wib.to_string(),
    }
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("client build: {}", e))
}

/// Cache token proses-global. Endpoint /accesstoken SatuSehat me-rate-limit
/// (respons OperationOutcome code=throttled) bila token diminta terlalu sering,
/// jadi token (berlaku ~1 jam) dipakai ulang sampai mendekati kedaluwarsa.
struct TokenCache { token: String, expires_at: std::time::Instant }
static TOKEN_CACHE: tokio::sync::OnceCell<tokio::sync::Mutex<Option<TokenCache>>> =
    tokio::sync::OnceCell::const_new();

/// OAuth2 client_credentials → access_token (dengan cache + serialisasi).
async fn get_token(client: &reqwest::Client, cfg: &SatuSehatConfig) -> Result<String, String> {
    let cell = TOKEN_CACHE.get_or_init(|| async { tokio::sync::Mutex::new(None) }).await;
    let mut guard = cell.lock().await; // serialisasi: cegah beberapa request token bersamaan
    if let Some(tc) = guard.as_ref() {
        if !tc.token.is_empty() && tc.expires_at > std::time::Instant::now() {
            return Ok(tc.token.clone());
        }
    }

    let url = format!("{}/accesstoken?grant_type=client_credentials", cfg.url_auth.trim_end_matches('/'));
    let body = format!("client_id={}&client_secret={}", cfg.client_id, cfg.secret);

    // Hingga 3x percobaan; kalau di-throttle SatuSehat, jeda naik lalu ulang.
    let mut text = String::new();
    let mut v = Value::Null;
    let mut tok = String::new();
    for attempt in 0..3u32 {
        let resp = client.post(&url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body.clone())
            .send().await.map_err(|e| format!("token request: {}", e))?;
        text = resp.text().await.map_err(|e| format!("token body: {}", e))?;
        v = serde_json::from_str(&text).map_err(|e| format!("token json: {} ({})", e, &text[..text.len().min(160)]))?;
        tok = v.get("access_token").and_then(|t| t.as_str()).unwrap_or("").to_string();
        if !tok.is_empty() { break; }
        let throttled = text.contains("throttled") || text.contains("TooManyRequests") || text.contains("Spike");
        if throttled && attempt < 2 {
            tokio::time::sleep(std::time::Duration::from_secs(15 * (attempt as u64 + 1))).await;
            continue;
        }
        break;
    }
    if tok.is_empty() { return Err(format!("access_token kosong: {}", &text[..text.len().min(200)])); }

    // expires_in (detik) dari SatuSehat, kurangi buffer 5 menit; default aman 50 menit.
    let ttl = v.get("expires_in")
        .and_then(|e| e.as_str().and_then(|s| s.parse::<u64>().ok()).or_else(|| e.as_u64()))
        .map(|s| s.saturating_sub(300))
        .filter(|s| *s > 60)
        .unwrap_or(3000);
    *guard = Some(TokenCache { token: tok.clone(), expires_at: std::time::Instant::now() + std::time::Duration::from_secs(ttl) });
    Ok(tok)
}

/// Resolve IHS number by NIK (cache-aware). `kind` = "pasien" | "praktisi".
async fn resolve_ihs(
    client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str, pool: &MySqlPool,
    kind: &str, nik: &str,
) -> Option<String> {
    let nik = nik.trim();
    if nik.is_empty() { return None; }
    let (cache_tbl, fhir_res) = if kind == "praktisi" {
        ("satu_sehat_cache_ihs_praktisi", "Practitioner")
    } else {
        ("satu_sehat_cache_ihs_pasien", "Patient")
    };

    // 1) cache lokal
    if let Ok(Some(ihs)) = sqlx::query_scalar::<_, String>(
        &format!("SELECT ihs_number FROM {} WHERE no_ktp=? LIMIT 1", cache_tbl))
        .bind(nik).fetch_optional(pool).await
    {
        if !ihs.is_empty() { return Some(ihs); }
    }

    // 2) GET FHIR search (throttle + retry pada 429)
    let url = format!("{}/{}", cfg.url_fhir.trim_end_matches('/'), fhir_res);
    let ident = format!("https://fhir.kemkes.go.id/id/nik|{}", nik);
    for attempt in 0..3u32 {
        tokio::time::sleep(std::time::Duration::from_millis(cfg.delay_ms)).await;
        let resp = match client.get(&url).query(&[("identifier", ident.as_str())]).bearer_auth(token).send().await {
            Ok(r) => r, Err(_) => continue,
        };
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if status.as_u16() == 429 {
            tokio::time::sleep(std::time::Duration::from_secs(2 * (attempt as u64 + 1))).await;
            continue;
        }
        if !status.is_success() { return None; }
        let ihs = serde_json::from_str::<Value>(&text).ok()
            .and_then(|v| v.pointer("/entry/0/resource/id").and_then(|x| x.as_str()).map(|s| s.to_string()))
            .unwrap_or_default();
        if ihs.is_empty() { return None; }
        let _ = sqlx::query(&format!("INSERT IGNORE INTO {} (no_ktp, ihs_number) VALUES (?, ?)", cache_tbl))
            .bind(nik).bind(&ihs).execute(pool).await;
        return Some(ihs);
    }
    None
}

/// POST 1 resource FHIR, kembalikan id-nya (kosong bila gagal).
async fn post_resource(
    client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str, resource_type: &str, body: &Value,
) -> Result<String, String> {
    let url = format!("{}/{}", cfg.url_fhir.trim_end_matches('/'), resource_type);
    let mut last_err = String::new();
    for attempt in 0..4u32 {
        tokio::time::sleep(std::time::Duration::from_millis(cfg.delay_ms)).await;
        let resp = match client.post(&url)
            .header("Content-Type", "application/json")
            .bearer_auth(token)
            .body(body.to_string())
            .send().await {
            Ok(r) => r, Err(e) => { last_err = format!("request: {}", e); continue; }
        };
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if status.as_u16() == 429 {
            last_err = "HTTP 429 (rate limit)".to_string();
            tokio::time::sleep(std::time::Duration::from_secs(2u64.pow(attempt + 1))).await; // 2,4,8,16 dtk
            continue;
        }
        if !status.is_success() {
            return Err(format!("HTTP {}: {}", status, &text[..text.len().min(300)]));
        }
        let v: Value = serde_json::from_str(&text).map_err(|e| format!("json: {}", e))?;
        return Ok(v.get("id").and_then(|x| x.as_str()).unwrap_or("").to_string());
    }
    Err(format!("gagal setelah retry: {}", last_err))
}

// ── Sync logic ───────────────────────────────────────────────────────────────
#[derive(sqlx::FromRow)]
struct EncCtx {
    nik:      Option<String>,
    nm_pasien: String,
    status_lanjut: Option<String>,
    kd_poli:  Option<String>,
    mulai:    Option<String>,
    ktp_dok:  Option<String>,
    nm_dok:   Option<String>,
    id_enc:   Option<String>,
    id_lokasi: Option<String>,
}

async fn proses_kunjungan(
    client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str,
    pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>, no_rawat: &str,
) {
    // Konteks kunjungan
    let ctx: Option<EncCtx> = sqlx::query_as::<_, EncCtx>(
        "SELECT IFNULL(p.no_ktp,'') AS nik, p.nm_pasien, rp.status_lanjut, rp.kd_poli, \
                CONCAT(rp.tgl_registrasi,'T',rp.jam_reg,'+07:00') AS mulai, \
                IFNULL(pg.no_ktp,'') AS ktp_dok, IFNULL(dr.nm_dokter,'') AS nm_dok, \
                IFNULL(se.id_encounter,'') AS id_enc, \
                IFNULL( \
                  (SELECT llr.id_lokasi_satusehat FROM satu_sehat_mapping_lokasi_ralan llr WHERE llr.kd_poli=rp.kd_poli LIMIT 1), \
                  (SELECT lln.id_lokasi_satusehat FROM satu_sehat_mapping_lokasi_ranap lln \
                     JOIN kamar_inap ki ON ki.kd_kamar=lln.kd_kamar WHERE ki.no_rawat=rp.no_rawat ORDER BY ki.tgl_masuk DESC LIMIT 1) \
                ) AS id_lokasi \
         FROM reg_periksa rp \
         JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         LEFT JOIN dokter dr ON dr.kd_dokter=rp.kd_dokter \
         LEFT JOIN pegawai pg ON pg.nik=rp.kd_dokter \
         LEFT JOIN satu_sehat_encounter se ON se.no_rawat=rp.no_rawat \
         WHERE rp.no_rawat=? LIMIT 1"
    ).bind(no_rawat).fetch_optional(pool).await.ok().flatten();

    let Some(ctx) = ctx else {
        write_log(pool, tx, "warning", format!("{}: data kunjungan tidak ditemukan", no_rawat)).await;
        return;
    };

    let nik = ctx.nik.clone().unwrap_or_default();
    let nama = ctx.nm_pasien.clone();
    let status = ctx.status_lanjut.clone().unwrap_or_default();
    let start_utc = iso_to_utc(&ctx.mulai.clone().unwrap_or_default());

    // Resolve IHS pasien (wajib)
    let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &nik).await {
        Some(x) => x,
        None => {
            write_log(pool, tx, "warning",
                format!("{} ({}): IHS pasien tak ditemukan (NIK {}), dilewati", no_rawat, nama, nik)).await;
            return;
        }
    };

    // ── Encounter (kalau belum) ──
    let mut id_enc = ctx.id_enc.clone().unwrap_or_default();
    if id_enc.is_empty() {
        let is_igd = ctx.kd_poli.as_deref() == Some("IGDK");
        let is_ranap = status == "Ranap";
        let (cc, cd) = if is_igd { ("EMER", "emergency") }
            else if is_ranap { ("IMP", "inpatient encounter") } else { ("AMB", "ambulatory") };

        // Selaras dengan SatuSehatBundelHelper.kirimEncounter di Khanza desktop:
        // ranap di-POST langsung sebagai `in-progress` (pasien sudah dalam
        // pelayanan) dengan riwayat `arrived` yang ditutup di titik yang sama;
        // ralan/IGD berhenti di `arrived`. Penuntasan ke `finished` TIDAK
        // dilakukan di sini — itu wewenang Khanza (finishEncounter) yang punya
        // discharge disposition, periode selesai, dan guard Rule 10457.
        let status_awal = if is_ranap { "in-progress" } else { "arrived" };
        let status_history = if is_ranap {
            json!([
                {"status":"arrived","period":{"start": start_utc, "end": start_utc}},
                {"status":"in-progress","period":{"start": start_utc}}
            ])
        } else {
            json!([{"status":"arrived","period":{"start": start_utc}}])
        };

        let mut enc = json!({
            "resourceType": "Encounter", "status": status_awal,
            "class": {"system":"http://terminology.hl7.org/CodeSystem/v3-ActCode","code":cc,"display":cd},
            "subject": {"reference": format!("Patient/{}", idp), "display": nama},
            "period": {"start": start_utc},
            "statusHistory": status_history,
            "serviceProvider": {"reference": format!("Organization/{}", cfg.org_id)},
            "identifier": [{"system": format!("http://sys-ids.kemkes.go.id/encounter/{}", cfg.org_id), "value": no_rawat}]
        });

        // Location & participant: mengikuti Khanza — kalau belum ter-mapping,
        // Encounter TETAP dikirim tanpa elemen itu (dulu di sini seluruh
        // kunjungan dilewati, sehingga tidak pernah masuk SatuSehat sama sekali).
        let id_lokasi = ctx.id_lokasi.clone().unwrap_or_default();
        if id_lokasi.trim().is_empty() {
            write_log(pool, tx, "warning",
                format!("{} ({}): Location belum di-map (poli {:?}) — Encounter dikirim tanpa location", no_rawat, nama, ctx.kd_poli)).await;
        } else {
            enc["location"] = json!([{"location": {"reference": format!("Location/{}", id_lokasi)}}]);
        }

        let ktp_dok = ctx.ktp_dok.clone().unwrap_or_default();
        let id_dok = if ktp_dok.is_empty() { None }
            else { resolve_ihs(client, cfg, token, pool, "praktisi", &ktp_dok).await };
        match id_dok {
            Some(id_dok) => {
                enc["participant"] = json!([{
                    "type":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/v3-ParticipationType","code":"ATND","display":"attender"}]}],
                    "individual":{"reference": format!("Practitioner/{}", id_dok), "display": ctx.nm_dok.clone().unwrap_or_default()}
                }]);
            }
            None => {
                write_log(pool, tx, "warning",
                    format!("{} ({}): dokter belum punya IHS — Encounter dikirim tanpa participant", no_rawat, nama)).await;
            }
        }

        match post_resource(client, cfg, token, "Encounter", &enc).await {
            Ok(id) if !id.is_empty() => {
                let _ = sqlx::query("REPLACE INTO satu_sehat_encounter (no_rawat, id_encounter) VALUES (?, ?)")
                    .bind(no_rawat).bind(&id).execute(pool).await;
                id_enc = id;
                write_log(pool, tx, "success", format!("{} ({}): Encounter [{}] terkirim, status {}", no_rawat, nama, cc, status_awal)).await;
            }
            Ok(_) => { write_log(pool, tx, "warning", format!("{}: Encounter tanpa id", no_rawat)).await; return; }
            Err(e) => { write_log(pool, tx, "error", format!("{}: Encounter gagal — {}", no_rawat, e)).await; return; }
        }
    }

    // Condition (ICD-10) & Procedure (ICD-9) SENGAJA TIDAK dikirim dari simrscb.
    // Keduanya dikelola aplikasi Khanza desktop (SatuSehatBundelHelper) bersama
    // siklus hidup Encounter sampai status `finished`. Mengirim ganda dari dua
    // aplikasi berisiko duplikat resource di SatuSehat.
    let _ = id_enc;
}

pub async fn run_sync(
    pool: MySqlPool,
    cfg: SatuSehatConfig,
    tx: tokio::sync::broadcast::Sender<SatuSehatLogEntry>,
    only: Option<Vec<String>>, // None = semua; Some(list) = hanya resource terpilih (cron pakai ["encounter"])
    tgl_awal: Option<String>,  // "YYYY-MM-DD" — kalau kosong pakai window_days
    tgl_akhir: Option<String>,
) {
    fn want(only: &Option<Vec<String>>, key: &str) -> bool {
        match only { None => true, Some(v) => v.iter().any(|x| x == key) }
    }
    if cfg.client_id.is_empty() || cfg.secret.is_empty() || cfg.org_id.is_empty() {
        write_log(&pool, &tx, "error",
            "Config SatuSehat belum lengkap (CLIENT_ID / SECRET / ORG_ID kosong).".to_string()).await;
        return;
    }
    // Rentang tanggal efektif: pakai tgl_awal/tgl_akhir bila diberi, else window_days dari hari ini.
    let mut cfg = cfg;
    let to = tgl_akhir.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());
    let from = tgl_awal.filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| (chrono::Local::now() - chrono::Duration::days(cfg.window_days)).format("%Y-%m-%d").to_string());
    cfg.d_from = from;
    cfg.d_to = format!("{} 23:59:59", to);
    let client = match http_client() { Ok(c) => c, Err(e) => { write_log(&pool,&tx,"error",e).await; return; } };

    write_log(&pool, &tx, "info", "Memulai sync SatuSehat (Encounter+Condition+Procedure)".to_string()).await;
    let token = match get_token(&client, &cfg).await {
        Ok(t) => t,
        Err(e) => { write_log(&pool, &tx, "error", format!("OAuth2 gagal: {}", e)).await; return; }
    };

    // Encounter — kunjungan 'Sudah' yang belum punya Encounter.
    if want(&only, "encounter") {
        let list: Vec<(String,)> = sqlx::query_as(
            "SELECT rp.no_rawat FROM reg_periksa rp \
             WHERE rp.stts='Sudah' AND rp.tgl_registrasi BETWEEN ? AND ? \
               AND NOT EXISTS (SELECT 1 FROM satu_sehat_encounter se WHERE se.no_rawat=rp.no_rawat AND se.id_encounter<>'') \
             ORDER BY rp.tgl_registrasi, rp.jam_reg LIMIT 500"
        ).bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(&pool).await.unwrap_or_default();
        if list.is_empty() {
            write_log(&pool, &tx, "info", "Tidak ada kunjungan baru untuk dikirim.".to_string()).await;
        } else {
            write_log(&pool, &tx, "info", format!("{} kunjungan akan diproses.", list.len())).await;
        }
        for (no_rawat,) in list {
            proses_kunjungan(&client, &cfg, &token, &pool, &tx, &no_rawat).await;
        }
    }

    // Resource RME lain — tiap resource bisa dipilih dari frontend (Sync Manual).
    if want(&only, "medication")  { run_sync_medication(&client, &cfg, &token, &pool, &tx).await; }
    if want(&only, "ttv")         { run_sync_ttv(&client, &cfg, &token, &pool, &tx).await; }
    if want(&only, "obat")        { run_sync_obat(&client, &cfg, &token, &pool, &tx).await; }
    if want(&only, "obat_racikan"){ run_sync_obat_racikan(&client, &cfg, &token, &pool, &tx).await; }
    if want(&only, "dispense")    { run_sync_dispense(&client, &cfg, &token, &pool, &tx).await; }
    if want(&only, "lab") {
        run_sync_lab_sr(&client, &cfg, &token, &pool, &tx).await;
        run_sync_lab_specimen(&client, &cfg, &token, &pool, &tx).await;
        run_sync_lab_obs(&client, &cfg, &token, &pool, &tx).await;
        run_sync_lab_dr(&client, &cfg, &token, &pool, &tx).await;
    }
    if want(&only, "radiologi") {
        run_sync_rad_sr(&client, &cfg, &token, &pool, &tx).await;
        run_sync_rad_specimen(&client, &cfg, &token, &pool, &tx).await;
        run_sync_rad_obs(&client, &cfg, &token, &pool, &tx).await;
        run_sync_rad_dr(&client, &cfg, &token, &pool, &tx).await;
    }
    if want(&only, "alergi")      { run_sync_alergi(&client, &cfg, &token, &pool, &tx).await; }
    if want(&only, "clinical_impression") { run_sync_clinical_impression(&client, &cfg, &token, &pool, &tx).await; }
    if want(&only, "careplan")    { run_sync_careplan(&client, &cfg, &token, &pool, &tx).await; }
    if want(&only, "condition")   { run_sync_condition(&client, &cfg, &token, &pool, &tx).await; }
    if want(&only, "procedure")   { run_sync_procedure(&client, &cfg, &token, &pool, &tx).await; }

    write_log(&pool, &tx, "success", "Sync SatuSehat selesai".to_string()).await;
}

// ── Cron loop ─────────────────────────────────────────────────────────────────
pub async fn run_cron_loop(
    pool: MySqlPool,
    cfg: SatuSehatConfig,
    tx: tokio::sync::broadcast::Sender<SatuSehatLogEntry>,
) {
    let interval_secs = cfg.interval_min.max(1) * 60;
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
    ticker.tick().await;
    tracing::info!("[satusehat] cron scheduler aktif, interval {} menit", cfg.interval_min);
    loop {
        ticker.tick().await;
        tracing::info!("[satusehat] cron tick — autorun (Encounter→semua resource, 1 tahun ke belakang)");
        // Autorun otomatis: Encounter dulu, lalu semua resource RME lain (urut
        // dependensi di run_sync), rentang 1 tahun ke belakang s/d hari ini.
        // Dedup memastikan hanya yang belum terkirim yang diproses (backfill
        // bertahap tiap tick karena LIMIT per query, lalu tetap update).
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let year_ago = (chrono::Local::now() - chrono::Duration::days(365)).format("%Y-%m-%d").to_string();
        run_sync(pool.clone(), cfg.clone(), tx.clone(), None, Some(year_ago), Some(today)).await;
    }
}

// ── HTTP handlers ────────────────────────────────────────────────────────────
pub async fn get_logs(
    _user: AuthUser, State(state): State<AppState>,
) -> Result<Json<Vec<SatuSehatLogEntry>>, (StatusCode, Json<Value>)> {
    let rows: Vec<SatuSehatLogEntry> = sqlx::query_as(
        "SELECT id, DATE_FORMAT(waktu, '%Y-%m-%d %H:%i:%s') AS waktu, level, message
         FROM simrscb_satusehat_log ORDER BY id DESC LIMIT 1000"
    ).fetch_all(&state.pool).await
     .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    let mut rev = rows; rev.reverse();
    Ok(Json(rev))
}

#[derive(Deserialize, Default)]
pub struct SyncBody {
    #[serde(default)] pub resources: Vec<String>,
    #[serde(default)] pub tgl_awal: Option<String>,
    #[serde(default)] pub tgl_akhir: Option<String>,
}

pub async fn trigger_sync(
    _user: AuthUser, State(state): State<AppState>, body: Option<Json<SyncBody>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let pool = state.pool.clone();
    let cfg  = state.satusehat_cfg.clone();
    let tx   = state.satusehat_tx.clone();
    // Tanpa body / resources kosong = semua resource. Kalau ada daftar = hanya itu.
    let (only, tgl_awal, tgl_akhir) = match body {
        Some(Json(b)) => (if b.resources.is_empty() { None } else { Some(b.resources) }, b.tgl_awal, b.tgl_akhir),
        None => (None, None, None),
    };
    let pesan = match &only {
        Some(v) => format!("Sync SatuSehat dimulai ({} resource terpilih)", v.len()),
        None => "Sync SatuSehat dimulai (semua resource)".to_string(),
    };
    tokio::spawn(async move { run_sync(pool, cfg, tx, only, tgl_awal, tgl_akhir).await; });
    Ok(Json(json!({"ok": true, "message": pesan})))
}

pub async fn clear_logs(
    user: AuthUser, State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query("DELETE FROM simrscb_satusehat_log").execute(&state.pool).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    crate::audit::log_sql(&state.pool, &user.0.kode, "DELETE FROM simrscb_satusehat_log").await;
    Ok(Json(json!({"ok": true, "message": "Log dikosongkan"})))
}

pub async fn get_status(
    _user: AuthUser, State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_satusehat_log")
        .fetch_one(&state.pool).await.unwrap_or(0);
    let last: Option<SatuSehatLogEntry> = sqlx::query_as(
        "SELECT id, DATE_FORMAT(waktu, '%Y-%m-%d %H:%i:%s') AS waktu, level, message
         FROM simrscb_satusehat_log ORDER BY id DESC LIMIT 1"
    ).fetch_optional(&state.pool).await.ok().flatten();
    Ok(Json(json!({ "total_logs": count, "last_log": last })))
}

pub async fn get_config(
    _user: AuthUser, State(state): State<AppState>,
) -> Json<Value> {
    let cfg = &state.satusehat_cfg;
    Json(json!({
        "fhir_url":     cfg.url_fhir,
        "org_id":       cfg.org_id,
        "interval_min": cfg.interval_min,
        "window_days":  cfg.window_days,
        "jadwal":       format!("setiap {} menit (window {} hari)", cfg.interval_min, cfg.window_days),
    }))
}

#[derive(Deserialize)]
pub struct StreamAuthQ { #[serde(default)] pub token: String }

// SSE dipakai EventSource yang TAK bisa kirim header Authorization → autentikasi
// lewat query ?token=<jwt> (divalidasi manual). Bukan cookie (hindari CSRF).
pub async fn stream_logs(
    State(state): State<AppState>, Query(q): Query<StreamAuthQ>,
) -> Response {
    if q.token.is_empty() || decode_jwt(&q.token, &state.jwt_secret).is_err() {
        return (StatusCode::UNAUTHORIZED, "token tidak valid").into_response();
    }
    let rx = state.satusehat_tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|msg| async move {
        match msg { Ok(evt) => Event::default().json_data(&evt).ok().map(Ok::<Event, Infallible>), Err(_) => None }
    });
    Sse::new(stream).keep_alive(KeepAlive::default()).into_response()
}

// ══════════════════════════════════════════════════════════════════════════════
// Observation TTV (Vital Sign) — port SatuSehatKirimObservationTTV desktop.
// Dedup pakai tabel BERSAMA satu_sehat_observationttv* (PK no_rawat+tgl+jam+status)
// agar tidak dobel dgn desktop selama transisi. Rencana: web jadi pengirim utama.
// ══════════════════════════════════════════════════════════════════════════════
struct VitalDef { tbl: &'static str, loinc: &'static str, display: &'static str, unit: &'static str, ucum: &'static str, teks: &'static str }
const V_SUHU: VitalDef = VitalDef{ tbl:"satu_sehat_observationttvsuhu", loinc:"8310-5", display:"Body temperature", unit:"degree Celsius", ucum:"Cel", teks:"Suhu Badan" };
const V_NADI: VitalDef = VitalDef{ tbl:"satu_sehat_observationttvnadi", loinc:"8867-4", display:"Heart rate", unit:"beats/minute", ucum:"/min", teks:"Nadi" };
const V_RR:   VitalDef = VitalDef{ tbl:"satu_sehat_observationttvrespirasi", loinc:"9279-1", display:"Respiratory rate", unit:"breaths/minute", ucum:"/min", teks:"Respirasi" };
const V_SPO2: VitalDef = VitalDef{ tbl:"satu_sehat_observationttvspo2", loinc:"59408-5", display:"Oxygen saturation in Arterial blood by Pulse oximetry", unit:"%", ucum:"%", teks:"SpO2" };
const V_TB:   VitalDef = VitalDef{ tbl:"satu_sehat_observationttvtb", loinc:"8302-2", display:"Body height", unit:"cm", ucum:"cm", teks:"Tinggi Badan" };
const V_BB:   VitalDef = VitalDef{ tbl:"satu_sehat_observationttvbb", loinc:"29463-7", display:"Body weight", unit:"kg", ucum:"kg", teks:"Berat Badan" };

#[derive(sqlx::FromRow)]
struct TtvRow {
    no_rawat: String, tgl: String, jam: String, status: String,
    suhu: String, tensi: String, nadi: String, respirasi: String, spo2: String, tinggi: String, berat: String,
    id_encounter: String, nik: String, nm_pasien: String, ktp_dok: String,
    sent_suhu: Option<String>, sent_tensi: Option<String>, sent_nadi: Option<String>,
    sent_respirasi: Option<String>, sent_spo2: Option<String>, sent_tinggi: Option<String>, sent_berat: Option<String>,
}

fn ttv_select(tbl: &str, stat: &str) -> String {
    // NB: kolom & alias identik utk ralan/ranap → dipakai di UNION
    format!(
    "SELECT pr.no_rawat, DATE_FORMAT(pr.tgl_perawatan,'%Y-%m-%d') tgl, TIME_FORMAT(pr.jam_rawat,'%H:%i:%s') jam, '{stat}' status, \
            IFNULL(pr.suhu_tubuh,'') suhu, IFNULL(pr.tensi,'') tensi, IFNULL(pr.nadi,'') nadi, IFNULL(pr.respirasi,'') respirasi, \
            IFNULL(pr.spo2,'') spo2, IFNULL(pr.tinggi,'') tinggi, IFNULL(pr.berat,'') berat, \
            se.id_encounter, IFNULL(p.no_ktp,'') nik, p.nm_pasien, IFNULL(pg.no_ktp,'') ktp_dok, \
            s1.id_observation sent_suhu, s2.id_observation sent_tensi, s3.id_observation sent_nadi, \
            s4.id_observation sent_respirasi, s5.id_observation sent_spo2, s6.id_observation sent_tinggi, s7.id_observation sent_berat \
     FROM {tbl} pr \
     JOIN satu_sehat_encounter se ON se.no_rawat=pr.no_rawat AND se.id_encounter<>'' \
     JOIN reg_periksa rp ON rp.no_rawat=pr.no_rawat \
     JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
     LEFT JOIN pegawai pg ON pg.nik=pr.nip \
     LEFT JOIN satu_sehat_observationttvsuhu      s1 ON s1.no_rawat=pr.no_rawat AND s1.tgl_perawatan=pr.tgl_perawatan AND s1.jam_rawat=pr.jam_rawat AND s1.status='{stat}' \
     LEFT JOIN satu_sehat_observationttvtensi     s2 ON s2.no_rawat=pr.no_rawat AND s2.tgl_perawatan=pr.tgl_perawatan AND s2.jam_rawat=pr.jam_rawat AND s2.status='{stat}' \
     LEFT JOIN satu_sehat_observationttvnadi      s3 ON s3.no_rawat=pr.no_rawat AND s3.tgl_perawatan=pr.tgl_perawatan AND s3.jam_rawat=pr.jam_rawat AND s3.status='{stat}' \
     LEFT JOIN satu_sehat_observationttvrespirasi s4 ON s4.no_rawat=pr.no_rawat AND s4.tgl_perawatan=pr.tgl_perawatan AND s4.jam_rawat=pr.jam_rawat AND s4.status='{stat}' \
     LEFT JOIN satu_sehat_observationttvspo2      s5 ON s5.no_rawat=pr.no_rawat AND s5.tgl_perawatan=pr.tgl_perawatan AND s5.jam_rawat=pr.jam_rawat AND s5.status='{stat}' \
     LEFT JOIN satu_sehat_observationttvtb        s6 ON s6.no_rawat=pr.no_rawat AND s6.tgl_perawatan=pr.tgl_perawatan AND s6.jam_rawat=pr.jam_rawat AND s6.status='{stat}' \
     LEFT JOIN satu_sehat_observationttvbb        s7 ON s7.no_rawat=pr.no_rawat AND s7.tgl_perawatan=pr.tgl_perawatan AND s7.jam_rawat=pr.jam_rawat AND s7.status='{stat}' \
     WHERE pr.tgl_perawatan BETWEEN ? AND ? \
       AND (s1.id_observation IS NULL OR s2.id_observation IS NULL OR s3.id_observation IS NULL OR s4.id_observation IS NULL OR s5.id_observation IS NULL OR s6.id_observation IS NULL OR s7.id_observation IS NULL)")
}

async fn simpan_ttv(pool: &MySqlPool, tbl: &str, no_rawat: &str, tgl: &str, jam: &str, status: &str, id: &str) {
    let _ = sqlx::query(&format!(
        "REPLACE INTO {} (no_rawat, tgl_perawatan, jam_rawat, status, id_observation) VALUES (?,?,?,?,?)", tbl))
        .bind(no_rawat).bind(tgl).bind(jam).bind(status).bind(id).execute(pool).await;
}

#[allow(clippy::too_many_arguments)]
async fn kirim_vital(
    client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str, pool: &MySqlPool,
    tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>, def: &VitalDef, r: &TtvRow,
    idp: &str, id_dok: &Option<String>, eff: &str, ruang: &str, raw_value: &str,
) {
    let val = raw_value.trim().replace(',', ".");
    let num: f64 = match val.parse() { Ok(n) => n, Err(_) => return }; // non-numerik → lewati
    if num <= 0.0 { return; }
    let mut obs = json!({
        "resourceType":"Observation","status":"final",
        "category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"vital-signs","display":"Vital Signs"}]}],
        "code":{"coding":[{"system":"http://loinc.org","code":def.loinc,"display":def.display}]},
        "subject":{"reference": format!("Patient/{}", idp)},
        "encounter":{"reference": format!("Encounter/{}", r.id_encounter),
            "display": format!("Pemeriksaan Fisik {} di {}, Pasien {} Pada Tanggal {} Jam {}", def.teks, ruang, r.nm_pasien, r.tgl, r.jam)},
        "effectiveDateTime": eff, "issued": eff,
        "valueQuantity":{"value": num, "unit": def.unit, "system":"http://unitsofmeasure.org", "code": def.ucum}
    });
    if let Some(d) = id_dok { obs["performer"] = json!([{"reference": format!("Practitioner/{}", d)}]); }
    match post_resource(client, cfg, token, "Observation", &obs).await {
        Ok(id) if !id.is_empty() => {
            simpan_ttv(pool, def.tbl, &r.no_rawat, &r.tgl, &r.jam, &r.status, &id).await;
            write_log(pool, tx, "success", format!("{} ({}): TTV {} = {} terkirim", r.no_rawat, r.nm_pasien, def.teks, val)).await;
        }
        Ok(_) => {}
        Err(e) => write_log(pool, tx, "error", format!("{}: TTV {} gagal — {}", r.no_rawat, def.teks, e)).await,
    }
}

async fn kirim_tensi(
    client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str, pool: &MySqlPool,
    tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>, r: &TtvRow,
    idp: &str, id_dok: &Option<String>, eff: &str, ruang: &str,
) {
    let parts: Vec<&str> = r.tensi.split('/').collect();
    if parts.len() < 2 { return; }
    let sis: f64 = match parts[0].trim().parse() { Ok(n) => n, Err(_) => return };
    let dia: f64 = match parts[1].trim().parse() { Ok(n) => n, Err(_) => return };
    if sis <= 0.0 || dia <= 0.0 { return; }
    let mut obs = json!({
        "resourceType":"Observation","status":"final",
        "category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"vital-signs","display":"Vital Signs"}]}],
        "code":{"coding":[{"system":"http://loinc.org","code":"85354-9","display":"Blood pressure panel with all children optional"}],"text":"Blood pressure systolic & diastolic"},
        "subject":{"reference": format!("Patient/{}", idp)},
        "encounter":{"reference": format!("Encounter/{}", r.id_encounter),
            "display": format!("Pemeriksaan Fisik Tensi di {}, Pasien {} Pada Tanggal {} Jam {}", ruang, r.nm_pasien, r.tgl, r.jam)},
        "effectiveDateTime": eff, "issued": eff,
        "component":[
            {"code":{"coding":[{"system":"http://loinc.org","code":"8480-6","display":"Systolic blood pressure"}]},
             "valueQuantity":{"value": sis, "unit":"mmHg","system":"http://unitsofmeasure.org","code":"mm[Hg]"}},
            {"code":{"coding":[{"system":"http://loinc.org","code":"8462-4","display":"Diastolic blood pressure"}]},
             "valueQuantity":{"value": dia, "unit":"mmHg","system":"http://unitsofmeasure.org","code":"mm[Hg]"}}
        ]
    });
    if let Some(d) = id_dok { obs["performer"] = json!([{"reference": format!("Practitioner/{}", d)}]); }
    match post_resource(client, cfg, token, "Observation", &obs).await {
        Ok(id) if !id.is_empty() => {
            simpan_ttv(pool, "satu_sehat_observationttvtensi", &r.no_rawat, &r.tgl, &r.jam, &r.status, &id).await;
            write_log(pool, tx, "success", format!("{} ({}): TTV Tensi = {} terkirim", r.no_rawat, r.nm_pasien, r.tensi)).await;
        }
        Ok(_) => {}
        Err(e) => write_log(pool, tx, "error", format!("{}: TTV Tensi gagal — {}", r.no_rawat, e)).await,
    }
}

async fn run_sync_ttv(
    client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str,
    pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>,
) {
    let sql = format!("{} UNION ALL {} ORDER BY tgl, jam LIMIT 1000",
        ttv_select("pemeriksaan_ralan", "Ralan"), ttv_select("pemeriksaan_ranap", "Ranap"));
    let rows: Vec<TtvRow> = sqlx::query_as(&sql)
        .bind(&cfg.d_from).bind(&cfg.d_to).bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "TTV: tidak ada tanda vital baru untuk dikirim.".to_string()).await; return; }
    write_log(pool, tx, "info", format!("TTV: {} pemeriksaan akan diperiksa.", rows.len())).await;

    for r in &rows {
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await {
            Some(i) if !i.is_empty() => i,
            _ => { write_log(pool, tx, "warning", format!("{} ({}): TTV dilewati — pasien belum punya IHS", r.no_rawat, r.nm_pasien)).await; continue; }
        };
        let id_dok = if r.ktp_dok.trim().is_empty() { None }
            else { resolve_ihs(client, cfg, token, pool, "praktisi", &r.ktp_dok).await.filter(|x| !x.is_empty()) };
        let eff = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let ruang = if r.status == "Ranap" { "Rawat Inap" } else { "Rawat Jalan/IGD" };

        if r.sent_suhu.as_deref().unwrap_or("").is_empty() { kirim_vital(client,cfg,token,pool,tx,&V_SUHU,r,&idp,&id_dok,&eff,ruang,&r.suhu).await; }
        if r.sent_tensi.as_deref().unwrap_or("").is_empty() { kirim_tensi(client,cfg,token,pool,tx,r,&idp,&id_dok,&eff,ruang).await; }
        if r.sent_nadi.as_deref().unwrap_or("").is_empty() { kirim_vital(client,cfg,token,pool,tx,&V_NADI,r,&idp,&id_dok,&eff,ruang,&r.nadi).await; }
        if r.sent_respirasi.as_deref().unwrap_or("").is_empty() { kirim_vital(client,cfg,token,pool,tx,&V_RR,r,&idp,&id_dok,&eff,ruang,&r.respirasi).await; }
        if r.sent_spo2.as_deref().unwrap_or("").is_empty() { kirim_vital(client,cfg,token,pool,tx,&V_SPO2,r,&idp,&id_dok,&eff,ruang,&r.spo2).await; }
        if r.sent_tinggi.as_deref().unwrap_or("").is_empty() { kirim_vital(client,cfg,token,pool,tx,&V_TB,r,&idp,&id_dok,&eff,ruang,&r.tinggi).await; }
        if r.sent_berat.as_deref().unwrap_or("").is_empty() { kirim_vital(client,cfg,token,pool,tx,&V_BB,r,&idp,&id_dok,&eff,ruang,&r.berat).await; }
    }
    write_log(pool, tx, "success", "TTV: sync tanda vital selesai".to_string()).await;
}

// ══════════════════════════════════════════════════════════════════════════════
// MedicationRequest (obat non-racikan) — port SatuSehatKirimMedicationRequest.
// Dedup tabel BERSAMA satu_sehat_medicationrequest (PK no_resep+kode_brng).
// KFA dari satu_sehat_mapping_obat. Racikan & MedicationDispense menyusul.
// ══════════════════════════════════════════════════════════════════════════════
#[derive(sqlx::FromRow)]
struct ObatRow {
    no_resep: String, kode_brng: String,
    obat_code: Option<String>, obat_system: String, obat_display: Option<String>,
    form_code: Option<String>, form_system: Option<String>, form_display: Option<String>,
    route_code: Option<String>, route_system: Option<String>, route_display: Option<String>,
    denominator_code: Option<String>, denominator_system: Option<String>,
    jml: Option<String>, aturan_pakai: String, status: Option<String>,
    tgl: String, jam: String,
    id_encounter: String, nik: String, nm_pasien: String, ktp_dok: String, nm_dok: String,
    no_rawat: String,
}

fn parse_signa(s: &str) -> f64 {
    let t = s.trim();
    let end = t.find(|c: char| !(c.is_ascii_digit() || c == '.')).unwrap_or(t.len());
    t[..end].parse().unwrap_or(1.0)
}

async fn run_sync_obat(
    client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str,
    pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>,
) {
    let rows: Vec<ObatRow> = sqlx::query_as(
        "SELECT ro.no_resep, rd.kode_brng, sm.obat_code, sm.obat_system, sm.obat_display, \
                sm.form_code, sm.form_system, sm.form_display, sm.route_code, sm.route_system, sm.route_display, \
                sm.denominator_code, sm.denominator_system, \
                CAST(rd.jml AS CHAR) jml, IFNULL(rd.aturan_pakai,'') aturan_pakai, ro.status, \
                DATE_FORMAT(ro.tgl_peresepan,'%Y-%m-%d') tgl, TIME_FORMAT(ro.jam_peresepan,'%H:%i:%s') jam, \
                se.id_encounter, IFNULL(p.no_ktp,'') nik, p.nm_pasien, IFNULL(pg.no_ktp,'') ktp_dok, IFNULL(pg.nama,'') nm_dok, \
                ro.no_rawat \
         FROM resep_obat ro \
         JOIN reg_periksa rp ON rp.no_rawat=ro.no_rawat \
         JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN pegawai pg ON pg.nik=ro.kd_dokter \
         JOIN satu_sehat_encounter se ON se.no_rawat=ro.no_rawat AND se.id_encounter<>'' \
         JOIN resep_dokter rd ON rd.no_resep=ro.no_resep \
         JOIN satu_sehat_mapping_obat sm ON sm.kode_brng=rd.kode_brng \
         LEFT JOIN satu_sehat_medicationrequest mr ON mr.no_resep=rd.no_resep AND mr.kode_brng=rd.kode_brng \
         WHERE ro.tgl_peresepan BETWEEN ? AND ? \
           AND (mr.id_medicationrequest IS NULL OR mr.id_medicationrequest='') \
         ORDER BY ro.tgl_peresepan, ro.jam_peresepan LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "Obat: tidak ada resep baru untuk dikirim.".to_string()).await; return; }
    write_log(pool, tx, "info", format!("Obat: {} item resep akan diperiksa.", rows.len())).await;

    for r in &rows {
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await {
            Some(i) if !i.is_empty() => i,
            _ => { write_log(pool, tx, "warning", format!("{} ({}): resep dilewati — pasien belum punya IHS", r.no_rawat, r.nm_pasien)).await; continue; }
        };
        let id_dok = match if r.ktp_dok.trim().is_empty() { None } else { resolve_ihs(client, cfg, token, pool, "praktisi", &r.ktp_dok).await } {
            Some(d) if !d.is_empty() => d,
            _ => { write_log(pool, tx, "warning", format!("{}: resep {} dilewati — dokter belum punya IHS", r.no_rawat, r.no_resep)).await; continue; }
        };
        let parts: Vec<&str> = r.aturan_pakai.split('x').collect();
        let dose = if !parts.is_empty() { parse_signa(parts[0]) } else { 1.0 };
        let freq = if parts.len() > 1 { parse_signa(parts[1]) } else { 1.0 };
        let jml: f64 = r.jml.as_deref().unwrap_or("0").trim().parse().unwrap_or(0.0);
        let is_ranap = r.status.as_deref() == Some("ranap");
        let (cat_code, cat_disp) = if is_ranap { ("inpatient", "Inpatient") } else { ("outpatient", "Outpatient") };
        let authored = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let unit = r.denominator_code.clone().unwrap_or_default();
        let unit_sys = r.denominator_system.clone().unwrap_or_default();

        let mr = json!({
            "resourceType":"MedicationRequest",
            "contained":[{
                "resourceType":"Medication","id": format!("med-{}", r.kode_brng),
                "identifier":[{"system": format!("http://sys-ids.kemkes.go.id/medication/{}", cfg.org_id),"use":"official","value": r.kode_brng}],
                "extension":[{"url":"https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType",
                    "valueCodeableConcept":{"coding":[{"system":"http://terminology.kemkes.go.id/CodeSystem/medication-type","code":"NC","display":"Non-compound"}]}}],
                "code":{"coding":[{"system": r.obat_system, "code": r.obat_code.clone().unwrap_or_default(), "display": r.obat_display.clone().unwrap_or_default()}]},
                "form":{"coding":[{"system": r.form_system.clone().unwrap_or_default(), "code": r.form_code.clone().unwrap_or_default(), "display": r.form_display.clone().unwrap_or_default()}]}
            }],
            "identifier":[
                {"system": format!("http://sys-ids.kemkes.go.id/prescription/{}", cfg.org_id),"use":"official","value": r.no_resep},
                {"system": format!("http://sys-ids.kemkes.go.id/prescription-item/{}", cfg.org_id),"use":"official","value": r.kode_brng}
            ],
            "status":"completed","intent":"order",
            "category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/medicationrequest-category","code":cat_code,"display":cat_disp}]}],
            "medicationReference":{"reference": format!("#med-{}", r.kode_brng), "display": r.obat_display.clone().unwrap_or_default()},
            "subject":{"reference": format!("Patient/{}", idp), "display": r.nm_pasien},
            "encounter":{"reference": format!("Encounter/{}", r.id_encounter)},
            "authoredOn": authored,
            "requester":{"reference": format!("Practitioner/{}", id_dok), "display": r.nm_dok},
            "dosageInstruction":[{
                "sequence":1,"patientInstruction": r.aturan_pakai,
                "timing":{"repeat":{"frequency": freq,"period":1,"periodUnit":"d"}},
                "route":{"coding":[{"system": r.route_system.clone().unwrap_or_default(),"code": r.route_code.clone().unwrap_or_default(),"display": r.route_display.clone().unwrap_or_default()}]},
                "doseAndRate":[{"doseQuantity":{"value": dose,"unit": unit,"system": unit_sys,"code": unit}}]
            }],
            "dispenseRequest":{"quantity":{"value": jml,"unit": unit,"system": unit_sys,"code": unit},
                "performer":{"reference": format!("Organization/{}", cfg.org_id)}}
        });
        match post_resource(client, cfg, token, "MedicationRequest", &mr).await {
            Ok(id) if !id.is_empty() => {
                let _ = sqlx::query("REPLACE INTO satu_sehat_medicationrequest (no_resep, kode_brng, id_medicationrequest) VALUES (?,?,?)")
                    .bind(&r.no_resep).bind(&r.kode_brng).bind(&id).execute(pool).await;
                write_log(pool, tx, "success", format!("{} ({}): Obat {} [{}] terkirim", r.no_rawat, r.nm_pasien, r.obat_display.clone().unwrap_or_default(), r.no_resep)).await;
            }
            Ok(_) => {}
            Err(e) => write_log(pool, tx, "error", format!("{}: Obat {} gagal — {}", r.no_rawat, r.kode_brng, e)).await,
        }
    }
    write_log(pool, tx, "success", "Obat: sync MedicationRequest selesai".to_string()).await;
}

// ══════════════════════════════════════════════════════════════════════════════
// ServiceRequest Lab PK (permintaan lab) — port SatuSehatKirimServiceRequestLabPK.
// Link pertama rantai lab: ServiceRequest → (Specimen → Observation →
// DiagnosticReport menyusul). Dedup tabel BERSAMA satu_sehat_servicerequest_lab
// (PK noorder+kd_jenis_prw+id_template). LOINC dari satu_sehat_mapping_lab.
// ══════════════════════════════════════════════════════════════════════════════
#[derive(sqlx::FromRow)]
struct LabSrRow {
    no_rawat: String, no_rkm_medis: String, nm_pasien: String, nik: String,
    nm_dok: String, ktp_dok: String, id_encounter: String,
    noorder: String, tgl: String, jam: String, diagnosa: String, pemeriksaan: String,
    code: Option<String>, system: String, display: Option<String>,
    id_template: i32, kd_jenis_prw: String,
}

async fn run_sync_lab_sr(
    client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str,
    pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>,
) {
    let rows: Vec<LabSrRow> = sqlx::query_as(
        "SELECT pl.no_rawat, rp.no_rkm_medis, p.nm_pasien, IFNULL(p.no_ktp,'') nik, \
                IFNULL(pg.nama,'') nm_dok, IFNULL(pg.no_ktp,'') ktp_dok, se.id_encounter, \
                pl.noorder, DATE_FORMAT(pl.tgl_permintaan,'%Y-%m-%d') tgl, TIME_FORMAT(pl.jam_permintaan,'%H:%i:%s') jam, \
                IFNULL(pl.diagnosa_klinis,'') diagnosa, tl.Pemeriksaan pemeriksaan, sml.code, sml.system, sml.display, \
                dpl.id_template, dpl.kd_jenis_prw \
         FROM permintaan_lab pl \
         JOIN reg_periksa rp ON rp.no_rawat=pl.no_rawat \
         JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN pegawai pg ON pg.nik=rp.kd_dokter \
         JOIN satu_sehat_encounter se ON se.no_rawat=pl.no_rawat AND se.id_encounter<>'' \
         JOIN permintaan_detail_permintaan_lab dpl ON dpl.noorder=pl.noorder \
         JOIN template_laboratorium tl ON tl.id_template=dpl.id_template \
         JOIN satu_sehat_mapping_lab sml ON sml.id_template=tl.id_template \
         LEFT JOIN satu_sehat_servicerequest_lab sr ON sr.noorder=dpl.noorder AND sr.id_template=dpl.id_template AND sr.kd_jenis_prw=dpl.kd_jenis_prw \
         WHERE pl.tgl_permintaan BETWEEN ? AND ? \
           AND (sr.id_servicerequest IS NULL OR sr.id_servicerequest='') \
         ORDER BY pl.tgl_permintaan, pl.jam_permintaan LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "Lab: tidak ada permintaan baru untuk dikirim.".to_string()).await; return; }
    write_log(pool, tx, "info", format!("Lab: {} item permintaan akan diperiksa.", rows.len())).await;

    for r in &rows {
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await {
            Some(i) if !i.is_empty() => i,
            _ => { write_log(pool, tx, "warning", format!("{} ({}): lab dilewati — pasien belum punya IHS", r.no_rawat, r.nm_pasien)).await; continue; }
        };
        let id_dok = match if r.ktp_dok.trim().is_empty() { None } else { resolve_ihs(client, cfg, token, pool, "praktisi", &r.ktp_dok).await } {
            Some(d) if !d.is_empty() => d,
            _ => { write_log(pool, tx, "warning", format!("{}: lab {} dilewati — dokter belum punya IHS", r.no_rawat, r.noorder)).await; continue; }
        };
        let order_dt = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let sr = json!({
            "resourceType":"ServiceRequest",
            "identifier":[{"system": format!("http://sys-ids.kemkes.go.id/servicerequest/{}", cfg.org_id),
                "value": format!("{}.{}", r.noorder, r.id_template)}],
            "status":"active","intent":"order",
            "category":[{"coding":[{"system":"http://snomed.info/sct","code":"108252007","display":"Laboratory procedure"}]}],
            "code":{"coding":[{"system": r.system, "code": r.code.clone().unwrap_or_default(), "display": r.display.clone().unwrap_or_default()}], "text": r.pemeriksaan},
            "subject":{"reference": format!("Patient/{}", idp)},
            "encounter":{"reference": format!("Encounter/{}", r.id_encounter),
                "display": format!("Permintaan {} atas nama pasien {} No.RM {} No.Rawat {}, pada tanggal {} {}", r.pemeriksaan, r.nm_pasien, r.no_rkm_medis, r.no_rawat, r.tgl, r.jam)},
            "occurrenceDateTime": order_dt, "authoredOn": order_dt,
            "requester":{"reference": format!("Practitioner/{}", id_dok), "display": r.nm_dok},
            "performer":[{"reference": format!("Organization/{}", cfg.org_id), "display":"Ruang Laborat/Petugas Laborat"}],
            "reasonCode":[{"text": r.diagnosa}]
        });
        match post_resource(client, cfg, token, "ServiceRequest", &sr).await {
            Ok(id) if !id.is_empty() => {
                let _ = sqlx::query("REPLACE INTO satu_sehat_servicerequest_lab (noorder, kd_jenis_prw, id_template, id_servicerequest) VALUES (?,?,?,?)")
                    .bind(&r.noorder).bind(&r.kd_jenis_prw).bind(r.id_template).bind(&id).execute(pool).await;
                write_log(pool, tx, "success", format!("{} ({}): Lab {} [{}] terkirim", r.no_rawat, r.nm_pasien, r.pemeriksaan, r.noorder)).await;
            }
            Ok(_) => {}
            Err(e) => write_log(pool, tx, "error", format!("{}: Lab {} gagal — {}", r.no_rawat, r.noorder, e)).await,
        }
    }
    write_log(pool, tx, "success", "Lab: sync ServiceRequest selesai".to_string()).await;
}

// ── Specimen Lab PK (rantai lab #2) — port SatuSehatKirimSpecimenLabPK ─────────
// Butuh ServiceRequest sudah terkirim + tgl_sampel terisi. Dedup satu_sehat_specimen_lab.
#[derive(sqlx::FromRow)]
struct LabSpecRow {
    no_rawat: String, nm_pasien: String, nik: String, noorder: String,
    tgl: String, jam: String, sampel_code: String, sampel_system: String, sampel_display: String,
    id_servicerequest: String, id_template: i32, kd_jenis_prw: String,
}

async fn run_sync_lab_specimen(
    client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str,
    pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>,
) {
    let rows: Vec<LabSpecRow> = sqlx::query_as(
        "SELECT pl.no_rawat, p.nm_pasien, IFNULL(p.no_ktp,'') nik, pl.noorder, \
                DATE_FORMAT(pl.tgl_sampel,'%Y-%m-%d') tgl, TIME_FORMAT(pl.jam_sampel,'%H:%i:%s') jam, \
                sml.sampel_code, sml.sampel_system, sml.sampel_display, \
                sr.id_servicerequest, dpl.id_template, dpl.kd_jenis_prw \
         FROM permintaan_lab pl \
         JOIN reg_periksa rp ON rp.no_rawat=pl.no_rawat \
         JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN permintaan_detail_permintaan_lab dpl ON dpl.noorder=pl.noorder \
         JOIN satu_sehat_mapping_lab sml ON sml.id_template=dpl.id_template \
         JOIN satu_sehat_servicerequest_lab sr ON sr.noorder=dpl.noorder AND sr.id_template=dpl.id_template AND sr.kd_jenis_prw=dpl.kd_jenis_prw AND sr.id_servicerequest<>'' \
         LEFT JOIN satu_sehat_specimen_lab sp ON sp.noorder=dpl.noorder AND sp.id_template=dpl.id_template AND sp.kd_jenis_prw=dpl.kd_jenis_prw \
         WHERE pl.tgl_permintaan BETWEEN ? AND ? \
           AND pl.tgl_sampel > '2000-01-01' \
           AND (sp.id_specimen IS NULL OR sp.id_specimen='') \
         ORDER BY pl.tgl_sampel, pl.jam_sampel LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "Lab: tidak ada spesimen baru untuk dikirim.".to_string()).await; return; }
    write_log(pool, tx, "info", format!("Lab: {} spesimen akan diperiksa.", rows.len())).await;

    for r in &rows {
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await {
            Some(i) if !i.is_empty() => i,
            _ => continue,
        };
        let dt = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let sp = json!({
            "resourceType":"Specimen",
            "identifier":[{"system": format!("http://sys-ids.kemkes.go.id/specimen/{}", cfg.org_id), "value": format!("{}.{}", r.noorder, r.id_template)}],
            "status":"available",
            "type":{"coding":[{"system": r.sampel_system, "code": r.sampel_code, "display": r.sampel_display}]},
            "subject":{"reference": format!("Patient/{}", idp), "display": r.nm_pasien},
            "request":[{"reference": format!("ServiceRequest/{}", r.id_servicerequest)}],
            "collection":{"collectedDateTime": dt},
            "receivedTime": dt
        });
        match post_resource(client, cfg, token, "Specimen", &sp).await {
            Ok(id) if !id.is_empty() => {
                let _ = sqlx::query("REPLACE INTO satu_sehat_specimen_lab (noorder, kd_jenis_prw, id_template, id_specimen) VALUES (?,?,?,?)")
                    .bind(&r.noorder).bind(&r.kd_jenis_prw).bind(r.id_template).bind(&id).execute(pool).await;
                write_log(pool, tx, "success", format!("{} ({}): Spesimen lab {} terkirim", r.no_rawat, r.nm_pasien, r.noorder)).await;
            }
            Ok(_) => {}
            Err(e) => write_log(pool, tx, "error", format!("{}: Spesimen lab {} gagal — {}", r.no_rawat, r.noorder, e)).await,
        }
    }
    write_log(pool, tx, "success", "Lab: sync Specimen selesai".to_string()).await;
}

// ── Observation Lab PK (rantai lab #3, hasil valueString) — port ObservationLabPK ─
#[derive(sqlx::FromRow)]
struct LabObsRow {
    no_rawat: String, no_rkm_medis: String, nm_pasien: String, nik: String, noorder: String,
    tgl: String, jam: String, pemeriksaan: String,
    code: Option<String>, system: String, display: Option<String>,
    nilai: String, rujukan: String, keterangan: String, satuan: String,
    id_template: i32, id_specimen: String, ktp_dok: String, nm_dok: String,
    id_encounter: String, kd_jenis_prw: String, id_servicerequest: String,
}

async fn run_sync_lab_obs(
    client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str,
    pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>,
) {
    let rows: Vec<LabObsRow> = sqlx::query_as(
        "SELECT pl.no_rawat, rp.no_rkm_medis, p.nm_pasien, IFNULL(p.no_ktp,'') nik, pl.noorder, \
                DATE_FORMAT(pl.tgl_hasil,'%Y-%m-%d') tgl, TIME_FORMAT(pl.jam_hasil,'%H:%i:%s') jam, \
                tl.Pemeriksaan pemeriksaan, sml.code, sml.system, sml.display, \
                IFNULL(dp.nilai,'') nilai, IFNULL(dp.nilai_rujukan,'') rujukan, IFNULL(dp.keterangan,'') keterangan, IFNULL(tl.satuan,'') satuan, \
                dpl.id_template, sp.id_specimen, IFNULL(pg.no_ktp,'') ktp_dok, IFNULL(pg.nama,'') nm_dok, \
                se.id_encounter, dpl.kd_jenis_prw, sr.id_servicerequest \
         FROM permintaan_lab pl \
         JOIN reg_periksa rp ON rp.no_rawat=pl.no_rawat \
         JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN permintaan_detail_permintaan_lab dpl ON dpl.noorder=pl.noorder \
         JOIN template_laboratorium tl ON tl.id_template=dpl.id_template \
         JOIN satu_sehat_mapping_lab sml ON sml.id_template=tl.id_template \
         JOIN satu_sehat_specimen_lab sp ON sp.noorder=dpl.noorder AND sp.id_template=dpl.id_template AND sp.kd_jenis_prw=dpl.kd_jenis_prw AND sp.id_specimen<>'' \
         JOIN satu_sehat_servicerequest_lab sr ON sr.noorder=dpl.noorder AND sr.id_template=dpl.id_template AND sr.kd_jenis_prw=dpl.kd_jenis_prw AND sr.id_servicerequest<>'' \
         JOIN periksa_lab plx ON plx.no_rawat=pl.no_rawat AND plx.tgl_periksa=pl.tgl_hasil AND plx.jam=pl.jam_hasil AND plx.dokter_perujuk=pl.dokter_perujuk \
         JOIN detail_periksa_lab dp ON dp.no_rawat=plx.no_rawat AND dp.tgl_periksa=plx.tgl_periksa AND dp.jam=plx.jam AND dp.id_template=dpl.id_template \
         JOIN satu_sehat_encounter se ON se.no_rawat=pl.no_rawat AND se.id_encounter<>'' \
         JOIN pegawai pg ON pg.nik=plx.kd_dokter \
         LEFT JOIN satu_sehat_observation_lab o ON o.noorder=dpl.noorder AND o.id_template=dpl.id_template AND o.kd_jenis_prw=dpl.kd_jenis_prw \
         WHERE pl.tgl_hasil > '2000-01-01' AND pl.tgl_hasil BETWEEN ? AND ? \
           AND (o.id_observation IS NULL OR o.id_observation='') \
         ORDER BY pl.tgl_hasil, pl.jam_hasil LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "Lab: tidak ada hasil baru untuk dikirim.".to_string()).await; return; }
    write_log(pool, tx, "info", format!("Lab: {} hasil akan diperiksa.", rows.len())).await;

    for r in &rows {
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await { Some(i) if !i.is_empty() => i, _ => continue };
        let id_dok = match if r.ktp_dok.trim().is_empty() { None } else { resolve_ihs(client, cfg, token, pool, "praktisi", &r.ktp_dok).await } {
            Some(d) if !d.is_empty() => d, _ => { write_log(pool, tx, "warning", format!("{}: hasil lab {} dilewati — petugas belum punya IHS", r.no_rawat, r.noorder)).await; continue; }
        };
        let dt = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let mut value_text = format!("Hasil Lab : {} {}, Nilai Rujukan : {}", r.nilai, r.satuan, r.rujukan);
        if !r.keterangan.trim().is_empty() { value_text.push_str(&format!(", Keterangan : {}", r.keterangan)); }
        let value_text = value_text.replace(['\r', '\n'], "<br>").replace('\t', " ");
        let obs = json!({
            "resourceType":"Observation",
            "identifier":[{"system": format!("http://sys-ids.kemkes.go.id/observation/{}", cfg.org_id), "value": format!("{}.{}", r.noorder, r.id_template)}],
            "status":"final",
            "basedOn":[{"reference": format!("ServiceRequest/{}", r.id_servicerequest)}],
            "category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"laboratory","display":"Laboratory"}]}],
            "code":{"coding":[{"system": r.system, "code": r.code.clone().unwrap_or_default(), "display": r.display.clone().unwrap_or_default()}]},
            "subject":{"reference": format!("Patient/{}", idp)},
            "performer":[{"reference": format!("Practitioner/{}", id_dok)}],
            "encounter":{"reference": format!("Encounter/{}", r.id_encounter),
                "display": format!("Hasil Pemeriksaan Lab {} No.Rawat {}, Atas Nama Pasien {}, No.RM {}, Pada Tanggal {} {}", r.pemeriksaan, r.no_rawat, r.nm_pasien, r.no_rkm_medis, r.tgl, r.jam)},
            "specimen":{"reference": format!("Specimen/{}", r.id_specimen)},
            "effectiveDateTime": dt, "issued": dt,
            "valueString": value_text
        });
        match post_resource(client, cfg, token, "Observation", &obs).await {
            Ok(id) if !id.is_empty() => {
                let _ = sqlx::query("REPLACE INTO satu_sehat_observation_lab (noorder, kd_jenis_prw, id_template, id_observation) VALUES (?,?,?,?)")
                    .bind(&r.noorder).bind(&r.kd_jenis_prw).bind(r.id_template).bind(&id).execute(pool).await;
                write_log(pool, tx, "success", format!("{} ({}): Hasil lab {} [{}] terkirim", r.no_rawat, r.nm_pasien, r.pemeriksaan, r.noorder)).await;
            }
            Ok(_) => {}
            Err(e) => write_log(pool, tx, "error", format!("{}: Hasil lab {} gagal — {}", r.no_rawat, r.noorder, e)).await,
        }
    }
    write_log(pool, tx, "success", "Lab: sync Observation hasil selesai".to_string()).await;
}

// ── DiagnosticReport Lab PK (rantai lab #4, penutup) — port DiagnosticReportLabPK ─
#[derive(sqlx::FromRow)]
struct LabDrRow {
    no_rawat: String, nm_pasien: String, nik: String, noorder: String,
    tgl: String, jam: String, pemeriksaan: String,
    code: Option<String>, system: String, display: Option<String>,
    nilai: String, rujukan: String, keterangan: String, satuan: String,
    id_template: i32, kd_jenis_prw: String, id_encounter: String, ktp_dok: String,
    id_servicerequest: String, id_specimen: String, id_observation: String,
}

async fn run_sync_lab_dr(
    client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str,
    pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>,
) {
    let rows: Vec<LabDrRow> = sqlx::query_as(
        "SELECT pl.no_rawat, p.nm_pasien, IFNULL(p.no_ktp,'') nik, pl.noorder, \
                DATE_FORMAT(pl.tgl_hasil,'%Y-%m-%d') tgl, TIME_FORMAT(pl.jam_hasil,'%H:%i:%s') jam, \
                tl.Pemeriksaan pemeriksaan, sml.code, sml.system, sml.display, \
                IFNULL(dp.nilai,'') nilai, IFNULL(dp.nilai_rujukan,'') rujukan, IFNULL(dp.keterangan,'') keterangan, IFNULL(tl.satuan,'') satuan, \
                dpl.id_template, dpl.kd_jenis_prw, se.id_encounter, IFNULL(pg.no_ktp,'') ktp_dok, \
                sr.id_servicerequest, sp.id_specimen, o.id_observation \
         FROM permintaan_lab pl \
         JOIN reg_periksa rp ON rp.no_rawat=pl.no_rawat \
         JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN permintaan_detail_permintaan_lab dpl ON dpl.noorder=pl.noorder \
         JOIN template_laboratorium tl ON tl.id_template=dpl.id_template \
         JOIN satu_sehat_mapping_lab sml ON sml.id_template=tl.id_template \
         JOIN satu_sehat_servicerequest_lab sr ON sr.noorder=dpl.noorder AND sr.id_template=dpl.id_template AND sr.kd_jenis_prw=dpl.kd_jenis_prw AND sr.id_servicerequest<>'' \
         JOIN satu_sehat_specimen_lab sp ON sp.noorder=dpl.noorder AND sp.id_template=dpl.id_template AND sp.kd_jenis_prw=dpl.kd_jenis_prw AND sp.id_specimen<>'' \
         JOIN satu_sehat_observation_lab o ON o.noorder=dpl.noorder AND o.id_template=dpl.id_template AND o.kd_jenis_prw=dpl.kd_jenis_prw AND o.id_observation<>'' \
         JOIN periksa_lab plx ON plx.no_rawat=pl.no_rawat AND plx.tgl_periksa=pl.tgl_hasil AND plx.jam=pl.jam_hasil AND plx.dokter_perujuk=pl.dokter_perujuk \
         JOIN detail_periksa_lab dp ON dp.no_rawat=plx.no_rawat AND dp.tgl_periksa=plx.tgl_periksa AND dp.jam=plx.jam AND dp.id_template=dpl.id_template \
         JOIN satu_sehat_encounter se ON se.no_rawat=pl.no_rawat AND se.id_encounter<>'' \
         JOIN pegawai pg ON pg.nik=plx.kd_dokter \
         LEFT JOIN satu_sehat_diagnosticreport_lab d ON d.noorder=dpl.noorder AND d.id_template=dpl.id_template AND d.kd_jenis_prw=dpl.kd_jenis_prw \
         WHERE pl.tgl_hasil > '2000-01-01' AND pl.tgl_hasil BETWEEN ? AND ? \
           AND (d.id_diagnosticreport IS NULL OR d.id_diagnosticreport='') \
         ORDER BY pl.tgl_hasil, pl.jam_hasil LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "Lab: tidak ada laporan hasil baru untuk dikirim.".to_string()).await; return; }
    write_log(pool, tx, "info", format!("Lab: {} laporan (DiagnosticReport) akan diperiksa.", rows.len())).await;

    for r in &rows {
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await { Some(i) if !i.is_empty() => i, _ => continue };
        let id_dok = match if r.ktp_dok.trim().is_empty() { None } else { resolve_ihs(client, cfg, token, pool, "praktisi", &r.ktp_dok).await } {
            Some(d) if !d.is_empty() => d, _ => continue
        };
        let dt = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let mut concl = format!("Hasil Lab : {} {}, Nilai Rujukan : {}", r.nilai, r.satuan, r.rujukan);
        if !r.keterangan.trim().is_empty() { concl.push_str(&format!(", Keterangan : {}", r.keterangan)); }
        let concl = concl.replace(['\r', '\n'], "<br>").replace('\t', " ");
        let dr = json!({
            "resourceType":"DiagnosticReport",
            "identifier":[{"system": format!("http://sys-ids.kemkes.go.id/diagnostic/{}/lab", cfg.org_id), "use":"official", "value": format!("{}.{}", r.noorder, r.id_template)}],
            "status":"final",
            "category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/v2-0074","code":"LAB","display":"Laboratory"}]}],
            "code":{"coding":[{"code": r.code.clone().unwrap_or_default(), "display": r.display.clone().unwrap_or_default(), "system": r.system}]},
            "subject":{"reference": format!("Patient/{}", idp)},
            "encounter":{"reference": format!("Encounter/{}", r.id_encounter)},
            "effectiveDateTime": dt, "issued": dt,
            "performer":[{"reference": format!("Organization/{}", cfg.org_id)}],
            "resultsInterpreter":[{"reference": format!("Practitioner/{}", id_dok)}],
            "specimen":[{"reference": format!("Specimen/{}", r.id_specimen)}],
            "result":[{"reference": format!("Observation/{}", r.id_observation)}],
            "basedOn":[{"reference": format!("ServiceRequest/{}", r.id_servicerequest)}],
            "conclusion": concl
        });
        match post_resource(client, cfg, token, "DiagnosticReport", &dr).await {
            Ok(id) if !id.is_empty() => {
                let _ = sqlx::query("REPLACE INTO satu_sehat_diagnosticreport_lab (noorder, kd_jenis_prw, id_template, id_diagnosticreport) VALUES (?,?,?,?)")
                    .bind(&r.noorder).bind(&r.kd_jenis_prw).bind(r.id_template).bind(&id).execute(pool).await;
                write_log(pool, tx, "success", format!("{} ({}): Laporan lab {} [{}] terkirim", r.no_rawat, r.nm_pasien, r.pemeriksaan, r.noorder)).await;
            }
            Ok(_) => {}
            Err(e) => write_log(pool, tx, "error", format!("{}: Laporan lab {} gagal — {}", r.no_rawat, r.noorder, e)).await,
        }
    }
    write_log(pool, tx, "success", "Lab: sync DiagnosticReport selesai".to_string()).await;
}

// ══════════════════════════════════════════════════════════════════════════════
// AllergyIntolerance (terstruktur) — port SatuSehatKirimAllergyIntolerance.
// HANYA kode SNOMED numerik dari alergi_pasien (kode kustom AL* butuh mapping
// eksternal → dilewati). Dedup satu_sehat_allergy_intolerance (PK no_rawat+tgl+
// jam+status); PK tak mengandung allergy_code → guard 1 alergi per key per run.
// ══════════════════════════════════════════════════════════════════════════════
#[derive(sqlx::FromRow)]
struct AlergiRow {
    no_rawat: String, tgl: String, jam: String, allergy_code: String, category: String,
    note: String, nik: String, nm_pasien: String, id_encounter: String,
    ktp_petugas: String, nm_petugas: String, status: String,
}

fn map_kategori_alergi(k: &str) -> &'static str {
    let s = k.to_lowercase();
    if s.contains("makan") || s.contains("food") { "food" }
    else if s.contains("obat") || s.contains("medic") { "medication" }
    else if s.contains("lingkung") || s.contains("environ") { "environment" }
    else if s.contains("biolog") { "biologic" }
    else { "food" }
}

async fn run_sync_alergi(
    client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str,
    pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>,
) {
    let rows: Vec<AlergiRow> = sqlx::query_as(
        "SELECT ap.no_rawat, DATE_FORMAT(ap.tgl_perawatan,'%Y-%m-%d') tgl, DATE_FORMAT(ap.tgl_perawatan,'%H:%i:%s') jam, \
                ap.allergy_code, ap.category, IFNULL(ap.note,'') note, IFNULL(p.no_ktp,'') nik, p.nm_pasien, \
                se.id_encounter, IFNULL(pg.no_ktp,'') ktp_petugas, IFNULL(pg.nama,'') nm_petugas, \
                IFNULL(rp.status_lanjut,'Ralan') status \
         FROM alergi_pasien ap \
         JOIN reg_periksa rp ON rp.no_rawat=ap.no_rawat \
         JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN satu_sehat_encounter se ON se.no_rawat=ap.no_rawat AND se.id_encounter<>'' \
         LEFT JOIN pegawai pg ON pg.nik=ap.nippetugas \
         LEFT JOIN satu_sehat_allergy_intolerance sa ON sa.no_rawat=ap.no_rawat AND sa.tgl_perawatan=DATE(ap.tgl_perawatan) AND sa.jam_rawat=TIME(ap.tgl_perawatan) \
         WHERE ap.tgl_perawatan BETWEEN ? AND ? AND ap.allergy_code REGEXP '^[0-9]+$' \
           AND (sa.id_allergy_intolerance IS NULL OR sa.id_allergy_intolerance='') \
         ORDER BY ap.tgl_perawatan LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "Alergi: tidak ada alergi (SNOMED) baru untuk dikirim.".to_string()).await; return; }
    write_log(pool, tx, "info", format!("Alergi: {} data akan diperiksa.", rows.len())).await;

    let mut sudah: std::collections::HashSet<(String,String,String,String)> = std::collections::HashSet::new();
    for r in &rows {
        let key = (r.no_rawat.clone(), r.tgl.clone(), r.jam.clone(), r.status.clone());
        if sudah.contains(&key) { continue; } // 1 alergi per (no_rawat,tgl,jam,status) per run
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await { Some(i) if !i.is_empty() => i, _ => continue };
        let id_petugas = if r.ktp_petugas.trim().is_empty() { None } else { resolve_ihs(client, cfg, token, pool, "praktisi", &r.ktp_petugas).await.filter(|x| !x.is_empty()) };
        let recorded = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let teks = if r.note.trim().is_empty() || r.note.contains("Migrasi") { r.category.clone() } else { r.note.clone() };
        let mut ai = json!({
            "resourceType":"AllergyIntolerance",
            "identifier":[{"system": format!("http://sys-ids.kemkes.go.id/allergy/{}", cfg.org_id), "value": r.no_rawat}],
            "clinicalStatus":{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical","code":"active","display":"Active"}]},
            "verificationStatus":{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/allergyintolerance-verification","code":"confirmed","display":"Confirmed"}]},
            "category":[map_kategori_alergi(&r.category)],
            "code":{"coding":[{"system":"http://snomed.info/sct","code": r.allergy_code, "display": teks}], "text": teks},
            "patient":{"reference": format!("Patient/{}", idp), "display": r.nm_pasien},
            "encounter":{"reference": format!("Encounter/{}", r.id_encounter),
                "display": format!("Kunjungan {} pada tanggal {} dengan nomor kunjungan {}", r.nm_pasien, r.tgl, r.no_rawat)},
            "recordedDate": recorded
        });
        if let Some(pid) = id_petugas { ai["recorder"] = json!({"reference": format!("Practitioner/{}", pid), "display": r.nm_petugas}); }
        match post_resource(client, cfg, token, "AllergyIntolerance", &ai).await {
            Ok(id) if !id.is_empty() => {
                let _ = sqlx::query("REPLACE INTO satu_sehat_allergy_intolerance (no_rawat, tgl_perawatan, jam_rawat, status, id_allergy_intolerance) VALUES (?,?,?,?,?)")
                    .bind(&r.no_rawat).bind(&r.tgl).bind(&r.jam).bind(&r.status).bind(&id).execute(pool).await;
                sudah.insert(key);
                write_log(pool, tx, "success", format!("{} ({}): Alergi {} terkirim", r.no_rawat, r.nm_pasien, teks)).await;
            }
            Ok(_) => {}
            Err(e) => write_log(pool, tx, "error", format!("{}: Alergi gagal — {}", r.no_rawat, e)).await,
        }
    }
    write_log(pool, tx, "success", "Alergi: sync AllergyIntolerance selesai".to_string()).await;
}

// ══════════════════════════════════════════════════════════════════════════════
// Radiologi — rantai ServiceRequest → Specimen → Observation → DiagnosticReport.
// Pola Lab PK, tapi kunci (noorder, kd_jenis_prw) (tanpa id_template), mapping
// satu_sehat_mapping_radiologi by kd_jenis_prw, hasil = hasil_radiologi.hasil.
// Identifier value = noorder(tanpa "PR") + kd_jenis_prw.
// ══════════════════════════════════════════════════════════════════════════════
fn rad_ident(noorder: &str, kd: &str) -> String { format!("{}{}", noorder.replace("PR", ""), kd) }

#[derive(sqlx::FromRow)]
struct RadSrRow {
    no_rawat: String, no_rkm_medis: String, nm_pasien: String, nik: String, nm_dok: String, ktp_dok: String,
    id_encounter: String, noorder: String, tgl: String, jam: String, diagnosa: String, pemeriksaan: String,
    code: Option<String>, system: String, display: Option<String>, kd_jenis_prw: String,
}

async fn run_sync_rad_sr(client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str, pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>) {
    let rows: Vec<RadSrRow> = sqlx::query_as(
        "SELECT pr.no_rawat, rp.no_rkm_medis, p.nm_pasien, IFNULL(p.no_ktp,'') nik, IFNULL(pg.nama,'') nm_dok, IFNULL(pg.no_ktp,'') ktp_dok, \
                se.id_encounter, pr.noorder, DATE_FORMAT(pr.tgl_permintaan,'%Y-%m-%d') tgl, TIME_FORMAT(pr.jam_permintaan,'%H:%i:%s') jam, \
                IFNULL(pr.diagnosa_klinis,'') diagnosa, jp.nm_perawatan pemeriksaan, sm.code, sm.system, sm.display, ppr.kd_jenis_prw \
         FROM permintaan_radiologi pr \
         JOIN reg_periksa rp ON rp.no_rawat=pr.no_rawat JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN pegawai pg ON pg.nik=rp.kd_dokter \
         JOIN satu_sehat_encounter se ON se.no_rawat=pr.no_rawat AND se.id_encounter<>'' \
         JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder=pr.noorder \
         JOIN jns_perawatan_radiologi jp ON jp.kd_jenis_prw=ppr.kd_jenis_prw \
         JOIN satu_sehat_mapping_radiologi sm ON sm.kd_jenis_prw=jp.kd_jenis_prw \
         LEFT JOIN satu_sehat_servicerequest_radiologi sr ON sr.noorder=ppr.noorder AND sr.kd_jenis_prw=ppr.kd_jenis_prw \
         WHERE pr.tgl_permintaan BETWEEN ? AND ? AND (sr.id_servicerequest IS NULL OR sr.id_servicerequest='') \
         ORDER BY pr.tgl_permintaan, pr.jam_permintaan LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "Radiologi: tidak ada permintaan baru.".to_string()).await; return; }
    write_log(pool, tx, "info", format!("Radiologi: {} permintaan akan diperiksa.", rows.len())).await;
    for r in &rows {
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await { Some(i) if !i.is_empty() => i, _ => continue };
        let id_dok = match if r.ktp_dok.trim().is_empty() { None } else { resolve_ihs(client, cfg, token, pool, "praktisi", &r.ktp_dok).await } { Some(d) if !d.is_empty() => d, _ => continue };
        let dt = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let sr = json!({
            "resourceType":"ServiceRequest",
            "identifier":[{"system": format!("http://sys-ids.kemkes.go.id/servicerequest/{}", cfg.org_id), "value": rad_ident(&r.noorder, &r.kd_jenis_prw)}],
            "status":"active","intent":"order",
            "category":[{"coding":[{"system":"http://snomed.info/sct","code":"363679005","display":"Imaging"}]}],
            "code":{"coding":[{"system": r.system, "code": r.code.clone().unwrap_or_default(), "display": r.display.clone().unwrap_or_default()}], "text": r.pemeriksaan},
            "subject":{"reference": format!("Patient/{}", idp)},
            "encounter":{"reference": format!("Encounter/{}", r.id_encounter), "display": format!("Permintaan {} atas nama pasien {} No.RM {} No.Rawat {}, pada tanggal {} {}", r.pemeriksaan, r.nm_pasien, r.no_rkm_medis, r.no_rawat, r.tgl, r.jam)},
            "occurrenceDateTime": dt, "authoredOn": dt,
            "requester":{"reference": format!("Practitioner/{}", id_dok), "display": r.nm_dok},
            "performer":[{"reference": format!("Organization/{}", cfg.org_id), "display":"Ruang Radiologi/Petugas Radiologi"}],
            "reasonCode":[{"text": r.diagnosa}]
        });
        match post_resource(client, cfg, token, "ServiceRequest", &sr).await {
            Ok(id) if !id.is_empty() => { let _ = sqlx::query("REPLACE INTO satu_sehat_servicerequest_radiologi (noorder, kd_jenis_prw, id_servicerequest) VALUES (?,?,?)").bind(&r.noorder).bind(&r.kd_jenis_prw).bind(&id).execute(pool).await;
                write_log(pool, tx, "success", format!("{} ({}): Radiologi {} [{}] terkirim", r.no_rawat, r.nm_pasien, r.pemeriksaan, r.noorder)).await; }
            Ok(_) => {}, Err(e) => write_log(pool, tx, "error", format!("{}: Radiologi {} gagal — {}", r.no_rawat, r.noorder, e)).await,
        }
    }
    write_log(pool, tx, "success", "Radiologi: sync ServiceRequest selesai".to_string()).await;
}

#[derive(sqlx::FromRow)]
struct RadSpecRow { no_rawat: String, nm_pasien: String, nik: String, noorder: String, tgl: String, jam: String, sampel_code: String, sampel_system: String, sampel_display: String, id_servicerequest: String, kd_jenis_prw: String }

async fn run_sync_rad_specimen(client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str, pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>) {
    let rows: Vec<RadSpecRow> = sqlx::query_as(
        "SELECT pr.no_rawat, p.nm_pasien, IFNULL(p.no_ktp,'') nik, pr.noorder, \
                DATE_FORMAT(pr.tgl_sampel,'%Y-%m-%d') tgl, TIME_FORMAT(pr.jam_sampel,'%H:%i:%s') jam, \
                sm.sampel_code, sm.sampel_system, sm.sampel_display, sr.id_servicerequest, ppr.kd_jenis_prw \
         FROM permintaan_radiologi pr JOIN reg_periksa rp ON rp.no_rawat=pr.no_rawat JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder=pr.noorder \
         JOIN jns_perawatan_radiologi jp ON jp.kd_jenis_prw=ppr.kd_jenis_prw \
         JOIN satu_sehat_mapping_radiologi sm ON sm.kd_jenis_prw=jp.kd_jenis_prw \
         JOIN satu_sehat_servicerequest_radiologi sr ON sr.noorder=ppr.noorder AND sr.kd_jenis_prw=ppr.kd_jenis_prw AND sr.id_servicerequest<>'' \
         LEFT JOIN satu_sehat_specimen_radiologi sp ON sp.noorder=ppr.noorder AND sp.kd_jenis_prw=ppr.kd_jenis_prw \
         WHERE pr.tgl_permintaan BETWEEN ? AND ? AND pr.tgl_sampel > '2000-01-01' AND (sp.id_specimen IS NULL OR sp.id_specimen='') \
         ORDER BY pr.tgl_sampel LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "Radiologi: tidak ada spesimen baru.".to_string()).await; return; }
    for r in &rows {
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await { Some(i) if !i.is_empty() => i, _ => continue };
        let dt = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let sp = json!({"resourceType":"Specimen",
            "identifier":[{"system": format!("http://sys-ids.kemkes.go.id/specimen/{}", cfg.org_id), "value": rad_ident(&r.noorder, &r.kd_jenis_prw)}],
            "status":"available","type":{"coding":[{"system": r.sampel_system, "code": r.sampel_code, "display": r.sampel_display}]},
            "subject":{"reference": format!("Patient/{}", idp), "display": r.nm_pasien},
            "request":[{"reference": format!("ServiceRequest/{}", r.id_servicerequest)}],
            "collection":{"collectedDateTime": dt}, "receivedTime": dt});
        match post_resource(client, cfg, token, "Specimen", &sp).await {
            Ok(id) if !id.is_empty() => { let _ = sqlx::query("REPLACE INTO satu_sehat_specimen_radiologi (noorder, kd_jenis_prw, id_specimen) VALUES (?,?,?)").bind(&r.noorder).bind(&r.kd_jenis_prw).bind(&id).execute(pool).await;
                write_log(pool, tx, "success", format!("{} ({}): Spesimen radiologi {} terkirim", r.no_rawat, r.nm_pasien, r.noorder)).await; }
            Ok(_) => {}, Err(e) => write_log(pool, tx, "error", format!("{}: Spesimen radiologi {} gagal — {}", r.no_rawat, r.noorder, e)).await,
        }
    }
    write_log(pool, tx, "success", "Radiologi: sync Specimen selesai".to_string()).await;
}

#[derive(sqlx::FromRow)]
struct RadObsRow { no_rawat: String, no_rkm_medis: String, nm_pasien: String, nik: String, noorder: String, tgl: String, jam: String, pemeriksaan: String, code: Option<String>, system: String, display: Option<String>, hasil: String, kd_jenis_prw: String, id_specimen: String, ktp_dok: String, id_encounter: String, id_servicerequest: String }

async fn run_sync_rad_obs(client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str, pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>) {
    let rows: Vec<RadObsRow> = sqlx::query_as(
        "SELECT pr.no_rawat, rp.no_rkm_medis, p.nm_pasien, IFNULL(p.no_ktp,'') nik, pr.noorder, \
                DATE_FORMAT(pr.tgl_hasil,'%Y-%m-%d') tgl, TIME_FORMAT(pr.jam_hasil,'%H:%i:%s') jam, \
                jp.nm_perawatan pemeriksaan, sm.code, sm.system, sm.display, IFNULL(hr.hasil,'') hasil, ppr.kd_jenis_prw, \
                sp.id_specimen, IFNULL(pg.no_ktp,'') ktp_dok, se.id_encounter, sr.id_servicerequest \
         FROM permintaan_radiologi pr JOIN reg_periksa rp ON rp.no_rawat=pr.no_rawat JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder=pr.noorder \
         JOIN jns_perawatan_radiologi jp ON jp.kd_jenis_prw=ppr.kd_jenis_prw \
         JOIN satu_sehat_mapping_radiologi sm ON sm.kd_jenis_prw=jp.kd_jenis_prw \
         JOIN satu_sehat_servicerequest_radiologi sr ON sr.noorder=ppr.noorder AND sr.kd_jenis_prw=ppr.kd_jenis_prw AND sr.id_servicerequest<>'' \
         JOIN satu_sehat_specimen_radiologi sp ON sp.noorder=ppr.noorder AND sp.kd_jenis_prw=ppr.kd_jenis_prw AND sp.id_specimen<>'' \
         JOIN periksa_radiologi px ON px.no_rawat=pr.no_rawat AND px.tgl_periksa=pr.tgl_hasil AND px.jam=pr.jam_hasil AND px.dokter_perujuk=pr.dokter_perujuk \
         JOIN hasil_radiologi hr ON hr.no_rawat=px.no_rawat AND hr.tgl_periksa=px.tgl_periksa AND hr.jam=px.jam \
         JOIN satu_sehat_encounter se ON se.no_rawat=pr.no_rawat AND se.id_encounter<>'' \
         JOIN pegawai pg ON pg.nik=px.kd_dokter \
         LEFT JOIN satu_sehat_observation_radiologi o ON o.noorder=ppr.noorder AND o.kd_jenis_prw=ppr.kd_jenis_prw \
         WHERE pr.tgl_hasil > '2000-01-01' AND pr.tgl_hasil BETWEEN ? AND ? AND (o.id_observation IS NULL OR o.id_observation='') \
         ORDER BY pr.tgl_hasil LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "Radiologi: tidak ada hasil baru.".to_string()).await; return; }
    for r in &rows {
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await { Some(i) if !i.is_empty() => i, _ => continue };
        let id_dok = match if r.ktp_dok.trim().is_empty() { None } else { resolve_ihs(client, cfg, token, pool, "praktisi", &r.ktp_dok).await } { Some(d) if !d.is_empty() => d, _ => continue };
        let dt = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let value = r.hasil.replace(['\r', '\n'], "<br>").replace('\t', " ");
        let obs = json!({"resourceType":"Observation",
            "identifier":[{"system": format!("http://sys-ids.kemkes.go.id/observation/{}", cfg.org_id), "value": rad_ident(&r.noorder, &r.kd_jenis_prw)}],
            "status":"final","basedOn":[{"reference": format!("ServiceRequest/{}", r.id_servicerequest)}],
            "category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"imaging","display":"Imaging"}]}],
            "code":{"coding":[{"system": r.system, "code": r.code.clone().unwrap_or_default(), "display": r.display.clone().unwrap_or_default()}]},
            "subject":{"reference": format!("Patient/{}", idp)},
            "performer":[{"reference": format!("Practitioner/{}", id_dok)}],
            "encounter":{"reference": format!("Encounter/{}", r.id_encounter), "display": format!("Hasil Pemeriksaan Radiologi {} No.Rawat {}, Atas Nama Pasien {}, No.RM {}, Pada Tanggal {} {}", r.pemeriksaan, r.no_rawat, r.nm_pasien, r.no_rkm_medis, r.tgl, r.jam)},
            "specimen":{"reference": format!("Specimen/{}", r.id_specimen)},
            "effectiveDateTime": dt, "issued": dt, "valueString": value});
        match post_resource(client, cfg, token, "Observation", &obs).await {
            Ok(id) if !id.is_empty() => { let _ = sqlx::query("REPLACE INTO satu_sehat_observation_radiologi (noorder, kd_jenis_prw, id_observation) VALUES (?,?,?)").bind(&r.noorder).bind(&r.kd_jenis_prw).bind(&id).execute(pool).await;
                write_log(pool, tx, "success", format!("{} ({}): Hasil radiologi {} [{}] terkirim", r.no_rawat, r.nm_pasien, r.pemeriksaan, r.noorder)).await; }
            Ok(_) => {}, Err(e) => write_log(pool, tx, "error", format!("{}: Hasil radiologi {} gagal — {}", r.no_rawat, r.noorder, e)).await,
        }
    }
    write_log(pool, tx, "success", "Radiologi: sync Observation selesai".to_string()).await;
}

async fn run_sync_rad_dr(client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str, pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>) {
    let rows: Vec<RadObsRow> = sqlx::query_as(
        "SELECT pr.no_rawat, rp.no_rkm_medis, p.nm_pasien, IFNULL(p.no_ktp,'') nik, pr.noorder, \
                DATE_FORMAT(pr.tgl_hasil,'%Y-%m-%d') tgl, TIME_FORMAT(pr.jam_hasil,'%H:%i:%s') jam, \
                jp.nm_perawatan pemeriksaan, sm.code, sm.system, sm.display, IFNULL(hr.hasil,'') hasil, ppr.kd_jenis_prw, \
                sp.id_specimen, IFNULL(pg.no_ktp,'') ktp_dok, se.id_encounter, sr.id_servicerequest \
         FROM permintaan_radiologi pr JOIN reg_periksa rp ON rp.no_rawat=pr.no_rawat JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder=pr.noorder \
         JOIN jns_perawatan_radiologi jp ON jp.kd_jenis_prw=ppr.kd_jenis_prw \
         JOIN satu_sehat_mapping_radiologi sm ON sm.kd_jenis_prw=jp.kd_jenis_prw \
         JOIN satu_sehat_servicerequest_radiologi sr ON sr.noorder=ppr.noorder AND sr.kd_jenis_prw=ppr.kd_jenis_prw AND sr.id_servicerequest<>'' \
         JOIN satu_sehat_specimen_radiologi sp ON sp.noorder=ppr.noorder AND sp.kd_jenis_prw=ppr.kd_jenis_prw AND sp.id_specimen<>'' \
         JOIN satu_sehat_observation_radiologi o ON o.noorder=ppr.noorder AND o.kd_jenis_prw=ppr.kd_jenis_prw AND o.id_observation<>'' \
         JOIN periksa_radiologi px ON px.no_rawat=pr.no_rawat AND px.tgl_periksa=pr.tgl_hasil AND px.jam=pr.jam_hasil AND px.dokter_perujuk=pr.dokter_perujuk \
         JOIN hasil_radiologi hr ON hr.no_rawat=px.no_rawat AND hr.tgl_periksa=px.tgl_periksa AND hr.jam=px.jam \
         JOIN satu_sehat_encounter se ON se.no_rawat=pr.no_rawat AND se.id_encounter<>'' \
         JOIN pegawai pg ON pg.nik=px.kd_dokter \
         LEFT JOIN satu_sehat_diagnosticreport_radiologi d ON d.noorder=ppr.noorder AND d.kd_jenis_prw=ppr.kd_jenis_prw \
         WHERE pr.tgl_hasil > '2000-01-01' AND pr.tgl_hasil BETWEEN ? AND ? AND (d.id_diagnosticreport IS NULL OR d.id_diagnosticreport='') \
         ORDER BY pr.tgl_hasil LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "Radiologi: tidak ada laporan baru.".to_string()).await; return; }
    for r in &rows {
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await { Some(i) if !i.is_empty() => i, _ => continue };
        let id_dok = match if r.ktp_dok.trim().is_empty() { None } else { resolve_ihs(client, cfg, token, pool, "praktisi", &r.ktp_dok).await } { Some(d) if !d.is_empty() => d, _ => continue };
        let dt = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let concl = r.hasil.replace(['\r', '\n'], "<br>").replace('\t', " ");
        // Observation id perlu untuk result[]; ambil dari dedup
        let obs_id: String = sqlx::query_scalar("SELECT IFNULL(id_observation,'') FROM satu_sehat_observation_radiologi WHERE noorder=? AND kd_jenis_prw=?")
            .bind(&r.noorder).bind(&r.kd_jenis_prw).fetch_optional(pool).await.ok().flatten().unwrap_or_default();
        let dr = json!({"resourceType":"DiagnosticReport",
            "identifier":[{"system": format!("http://sys-ids.kemkes.go.id/diagnostic/{}/rad", cfg.org_id), "use":"official", "value": rad_ident(&r.noorder, &r.kd_jenis_prw)}],
            "status":"final","category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/v2-0074","code":"RAD","display":"Radiology"}]}],
            "code":{"coding":[{"code": r.code.clone().unwrap_or_default(), "display": r.display.clone().unwrap_or_default(), "system": r.system}]},
            "subject":{"reference": format!("Patient/{}", idp)},
            "encounter":{"reference": format!("Encounter/{}", r.id_encounter)},
            "effectiveDateTime": dt, "issued": dt,
            "performer":[{"reference": format!("Organization/{}", cfg.org_id)}],
            "resultsInterpreter":[{"reference": format!("Practitioner/{}", id_dok)}],
            "specimen":[{"reference": format!("Specimen/{}", r.id_specimen)}],
            "result":[{"reference": format!("Observation/{}", obs_id)}],
            "basedOn":[{"reference": format!("ServiceRequest/{}", r.id_servicerequest)}],
            "conclusion": concl});
        match post_resource(client, cfg, token, "DiagnosticReport", &dr).await {
            Ok(id) if !id.is_empty() => { let _ = sqlx::query("REPLACE INTO satu_sehat_diagnosticreport_radiologi (noorder, kd_jenis_prw, id_diagnosticreport) VALUES (?,?,?)").bind(&r.noorder).bind(&r.kd_jenis_prw).bind(&id).execute(pool).await;
                write_log(pool, tx, "success", format!("{} ({}): Laporan radiologi {} [{}] terkirim", r.no_rawat, r.nm_pasien, r.pemeriksaan, r.noorder)).await; }
            Ok(_) => {}, Err(e) => write_log(pool, tx, "error", format!("{}: Laporan radiologi {} gagal — {}", r.no_rawat, r.noorder, e)).await,
        }
    }
    write_log(pool, tx, "success", "Radiologi: sync DiagnosticReport selesai".to_string()).await;
}

// ══════════════════════════════════════════════════════════════════════════════
// Medication (master, standalone) — port SatuSehatKirimMedication. Prasyarat
// MedicationDispense. Dedup satu_sehat_medication (kode_brng → id_medication).
// ══════════════════════════════════════════════════════════════════════════════
#[derive(sqlx::FromRow)]
struct MedRow { obat_code: String, obat_system: String, kode_brng: String, obat_display: Option<String>,
    form_code: Option<String>, form_system: Option<String>, form_display: Option<String>, status: Option<String> }

async fn run_sync_medication(client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str, pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>) {
    let rows: Vec<MedRow> = sqlx::query_as(
        "SELECT sm.obat_code, sm.obat_system, sm.kode_brng, sm.obat_display, sm.form_code, sm.form_system, sm.form_display, CAST(db.status AS CHAR) status \
         FROM satu_sehat_mapping_obat sm JOIN databarang db ON db.kode_brng=sm.kode_brng \
         LEFT JOIN satu_sehat_medication m ON m.kode_brng=sm.kode_brng \
         WHERE (m.id_medication IS NULL OR m.id_medication='') AND sm.obat_code<>'' LIMIT 1000")
        .fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { return; }
    write_log(pool, tx, "info", format!("Medication: {} obat master akan dikirim.", rows.len())).await;
    for r in &rows {
        let status = if r.status.as_deref() == Some("0") { "inactive" } else { "active" };
        let med = json!({
            "resourceType":"Medication",
            "meta":{"profile":["https://fhir.kemkes.go.id/r4/StructureDefinition/Medication"]},
            "identifier":[{"system": format!("http://sys-ids.kemkes.go.id/medication/{}", cfg.org_id), "use":"official", "value": r.kode_brng}],
            "code":{"coding":[{"system": r.obat_system, "code": r.obat_code, "display": r.obat_display.clone().unwrap_or_default()}]},
            "status": status,
            "form":{"coding":[{"system": r.form_system.clone().unwrap_or_default(), "code": r.form_code.clone().unwrap_or_default(), "display": r.form_display.clone().unwrap_or_default()}]},
            "extension":[{"url":"https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType",
                "valueCodeableConcept":{"coding":[{"system":"http://terminology.kemkes.go.id/CodeSystem/medication-type","code":"NC","display":"Non-compound"}]}}]
        });
        match post_resource(client, cfg, token, "Medication", &med).await {
            Ok(id) if !id.is_empty() => { let _ = sqlx::query("REPLACE INTO satu_sehat_medication (kode_brng, id_medication) VALUES (?,?)").bind(&r.kode_brng).bind(&id).execute(pool).await;
                write_log(pool, tx, "success", format!("Medication {} ({}) terkirim", r.kode_brng, r.obat_display.clone().unwrap_or_default())).await; }
            Ok(_) => {}, Err(e) => write_log(pool, tx, "error", format!("Medication {} gagal — {}", r.kode_brng, e)).await,
        }
    }
    write_log(pool, tx, "success", "Medication: sync master obat selesai".to_string()).await;
}

// ── MedicationDispense (penyerahan obat) — port SatuSehatKirimMedicationDispense ─
fn to_v3_form(k: &str) -> &'static str {
    match k.to_uppercase().trim() {
        "TAB" | "ENTAB" => "TAB", "CAP" => "CAP", "INJ" => "INJ", "AMP" => "AMP",
        "ORALSOL" | "SOL" => "SOL", "SYR" => "SYR", "SUSP" => "SUSP", "SUPP" | "SUP" => "SUPP",
        "CRM" | "CREAM" => "CRM", "GEL" => "GEL", "OINT" => "OINT", "DRP" | "DROP" => "DRP",
        "PWDR" | "POWDER" => "PWDR", "INH" | "INHALER" => "INH", "LOZ" => "LOZ", "PAT" | "PATCH" => "PAT",
        "AEROS" | "AEROSOL" => "AEROS", "EMUL" => "EMUL", _ => "TAB",
    }
}

#[derive(sqlx::FromRow)]
struct DispRow {
    no_rawat: String, nm_pasien: String, nik: String, nm_dok: String, ktp_dok: String, id_encounter: String,
    kode_brng: String, obat_display: Option<String>, route_code: Option<String>, route_system: Option<String>, route_display: Option<String>,
    denominator_code: Option<String>, tgl_resep: String, jam_resep: String, jml: Option<String>, aturan: String, no_resep: String,
    no_batch: String, no_faktur: String, tgl_serah: String, jam_serah: String, id_lokasi: String, nm_bangsal: String,
    id_medicationrequest: String, id_medication: String,
}

async fn run_sync_dispense(client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str, pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>) {
    let rows: Vec<DispRow> = sqlx::query_as(
        "SELECT ro.no_rawat, p.nm_pasien, IFNULL(p.no_ktp,'') nik, IFNULL(pg.nama,'') nm_dok, IFNULL(pg.no_ktp,'') ktp_dok, se.id_encounter, \
                dpo.kode_brng, sm.obat_display, sm.route_code, sm.route_system, sm.route_display, sm.denominator_code, \
                DATE_FORMAT(ro.tgl_peresepan,'%Y-%m-%d') tgl_resep, TIME_FORMAT(ro.jam_peresepan,'%H:%i:%s') jam_resep, \
                CAST(dpo.jml AS CHAR) jml, IFNULL(ap.aturan,'') aturan, ro.no_resep, \
                dpo.no_batch, dpo.no_faktur, DATE_FORMAT(dpo.tgl_perawatan,'%Y-%m-%d') tgl_serah, TIME_FORMAT(dpo.jam,'%H:%i:%s') jam_serah, \
                IFNULL(dl.id_lokasi_satusehat,'') id_lokasi, IFNULL(b.nm_bangsal,'') nm_bangsal, \
                mr.id_medicationrequest, med.id_medication \
         FROM resep_obat ro \
         JOIN reg_periksa rp ON rp.no_rawat=ro.no_rawat JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN pegawai pg ON pg.nik=ro.kd_dokter \
         JOIN satu_sehat_encounter se ON se.no_rawat=ro.no_rawat AND se.id_encounter<>'' \
         JOIN detail_pemberian_obat dpo ON dpo.no_rawat=ro.no_rawat AND dpo.tgl_perawatan=ro.tgl_perawatan AND dpo.jam=ro.jam \
         JOIN aturan_pakai ap ON ap.no_rawat=dpo.no_rawat AND ap.tgl_perawatan=dpo.tgl_perawatan AND ap.jam=dpo.jam AND ap.kode_brng=dpo.kode_brng \
         JOIN satu_sehat_medicationrequest mr ON mr.no_resep=ro.no_resep AND mr.kode_brng=dpo.kode_brng AND mr.id_medicationrequest<>'' \
         JOIN satu_sehat_medication med ON med.kode_brng=dpo.kode_brng AND med.id_medication<>'' \
         JOIN satu_sehat_mapping_obat sm ON sm.kode_brng=dpo.kode_brng \
         JOIN bangsal b ON b.kd_bangsal=dpo.kd_bangsal \
         LEFT JOIN satu_sehat_mapping_lokasi_depo_farmasi dl ON dl.kd_bangsal=dpo.kd_bangsal \
         LEFT JOIN satu_sehat_medicationdispense sd ON sd.no_rawat=ro.no_rawat AND sd.tgl_perawatan=dpo.tgl_perawatan AND sd.jam=dpo.jam AND sd.kode_brng=dpo.kode_brng AND sd.no_batch=dpo.no_batch AND sd.no_faktur=dpo.no_faktur \
         WHERE ro.tgl_penyerahan BETWEEN ? AND ? AND ro.tgl_penyerahan>'2000-01-01' \
           AND (sd.id_medicationdispanse IS NULL OR sd.id_medicationdispanse='') \
         ORDER BY ro.tgl_penyerahan LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "Obat: tidak ada penyerahan baru untuk dikirim.".to_string()).await; return; }
    write_log(pool, tx, "info", format!("Obat: {} penyerahan (Dispense) akan diperiksa.", rows.len())).await;
    for r in &rows {
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await { Some(i) if !i.is_empty() => i, _ => continue };
        let id_dok = match if r.ktp_dok.trim().is_empty() { None } else { resolve_ihs(client, cfg, token, pool, "praktisi", &r.ktp_dok).await } { Some(d) if !d.is_empty() => d, _ => continue };
        let parts: Vec<&str> = r.aturan.split('x').collect();
        let dose = if !parts.is_empty() { parse_signa(parts[0]) } else { 1.0 };
        let freq = if parts.len() > 1 { parse_signa(parts[1]) } else { 1.0 };
        let jml: f64 = r.jml.as_deref().unwrap_or("0").trim().parse().unwrap_or(0.0);
        let unit = r.denominator_code.clone().unwrap_or_default();
        let vform = to_v3_form(&unit);
        let when_prep = iso_to_utc(&format!("{}T{}+07:00", r.tgl_resep, r.jam_resep));
        let when_hand = iso_to_utc(&format!("{}T{}+07:00", r.tgl_serah, r.jam_serah));
        let mut md = json!({
            "resourceType":"MedicationDispense",
            "identifier":[
                {"system": format!("http://sys-ids.kemkes.go.id/prescription/{}", cfg.org_id), "use":"official", "value": r.no_resep},
                {"system": format!("http://sys-ids.kemkes.go.id/prescription-item/{}", cfg.org_id), "use":"official", "value": r.kode_brng}
            ],
            "status":"completed",
            "medicationReference":{"reference": format!("Medication/{}", r.id_medication), "display": r.obat_display.clone().unwrap_or_default()},
            "subject":{"reference": format!("Patient/{}", idp), "display": r.nm_pasien},
            "context":{"reference": format!("Encounter/{}", r.id_encounter)},
            "performer":[{"actor":{"reference": format!("Practitioner/{}", id_dok), "display": r.nm_dok}}],
            "authorizingPrescription":[{"reference": format!("MedicationRequest/{}", r.id_medicationrequest)}],
            "quantity":{"value": jml, "unit": unit, "system":"http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm", "code": vform},
            "whenPrepared": when_prep, "whenHandedOver": when_hand,
            "dosageInstruction":[{"sequence":1,"text": r.aturan,
                "timing":{"repeat":{"frequency": freq,"period":1,"periodUnit":"d"}},
                "route":{"coding":[{"system": r.route_system.clone().unwrap_or_default(),"code": r.route_code.clone().unwrap_or_default(),"display": r.route_display.clone().unwrap_or_default()}]},
                "doseAndRate":[{"doseQuantity":{"value": dose,"unit": unit,"system":"http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm","code": vform}}]}],
            "substitution":{"wasSubstituted": false}
        });
        if !r.id_lokasi.trim().is_empty() { md["location"] = json!({"reference": format!("Location/{}", r.id_lokasi), "display": r.nm_bangsal}); }
        match post_resource(client, cfg, token, "MedicationDispense", &md).await {
            Ok(id) if !id.is_empty() => {
                let _ = sqlx::query("REPLACE INTO satu_sehat_medicationdispense (no_rawat, tgl_perawatan, jam, kode_brng, no_batch, no_faktur, id_medicationdispanse) VALUES (?,?,?,?,?,?,?)")
                    .bind(&r.no_rawat).bind(&r.tgl_serah).bind(&r.jam_serah).bind(&r.kode_brng).bind(&r.no_batch).bind(&r.no_faktur).bind(&id).execute(pool).await;
                write_log(pool, tx, "success", format!("{} ({}): Penyerahan obat {} terkirim", r.no_rawat, r.nm_pasien, r.obat_display.clone().unwrap_or_default())).await;
            }
            Ok(_) => {}, Err(e) => write_log(pool, tx, "error", format!("{}: Penyerahan obat {} gagal — {}", r.no_rawat, r.kode_brng, e)).await,
        }
    }
    write_log(pool, tx, "success", "Obat: sync MedicationDispense selesai".to_string()).await;
}

// ── MedicationRequest RACIKAN (tiap bahan = 1 MR NC) — port bagian racikan ─────
#[derive(sqlx::FromRow)]
struct ObatRacikRow {
    no_resep: String, kode_brng: String,
    obat_code: Option<String>, obat_system: String, obat_display: Option<String>,
    form_code: Option<String>, form_system: Option<String>, form_display: Option<String>,
    route_code: Option<String>, route_system: Option<String>, route_display: Option<String>,
    denominator_code: Option<String>, denominator_system: Option<String>,
    jml: Option<String>, aturan_pakai: String, status: Option<String>,
    tgl: String, jam: String, id_encounter: String, nik: String, nm_pasien: String,
    ktp_dok: String, nm_dok: String, no_rawat: String, no_racik: String,
}

async fn run_sync_obat_racikan(client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str, pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>) {
    let rows: Vec<ObatRacikRow> = sqlx::query_as(
        "SELECT ro.no_resep, rdd.kode_brng, sm.obat_code, sm.obat_system, sm.obat_display, \
                sm.form_code, sm.form_system, sm.form_display, sm.route_code, sm.route_system, sm.route_display, \
                sm.denominator_code, sm.denominator_system, \
                CAST(rdd.jml AS CHAR) jml, IFNULL(rdr.aturan_pakai,'') aturan_pakai, ro.status, \
                DATE_FORMAT(ro.tgl_peresepan,'%Y-%m-%d') tgl, TIME_FORMAT(ro.jam_peresepan,'%H:%i:%s') jam, \
                se.id_encounter, IFNULL(p.no_ktp,'') nik, p.nm_pasien, IFNULL(pg.no_ktp,'') ktp_dok, IFNULL(pg.nama,'') nm_dok, \
                ro.no_rawat, rdd.no_racik \
         FROM resep_obat ro \
         JOIN reg_periksa rp ON rp.no_rawat=ro.no_rawat JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN pegawai pg ON pg.nik=ro.kd_dokter \
         JOIN satu_sehat_encounter se ON se.no_rawat=ro.no_rawat AND se.id_encounter<>'' \
         JOIN resep_dokter_racikan rdr ON rdr.no_resep=ro.no_resep \
         JOIN resep_dokter_racikan_detail rdd ON rdd.no_resep=rdr.no_resep AND rdd.no_racik=rdr.no_racik \
         JOIN satu_sehat_mapping_obat sm ON sm.kode_brng=rdd.kode_brng \
         LEFT JOIN satu_sehat_medicationrequest_racikan mr ON mr.no_resep=rdd.no_resep AND mr.kode_brng=rdd.kode_brng AND mr.no_racik=rdd.no_racik \
         WHERE ro.tgl_peresepan BETWEEN ? AND ? \
           AND (mr.id_medicationrequest IS NULL OR mr.id_medicationrequest='') \
         ORDER BY ro.tgl_peresepan LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { return; }
    write_log(pool, tx, "info", format!("Obat racikan: {} bahan akan diperiksa.", rows.len())).await;
    for r in &rows {
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await { Some(i) if !i.is_empty() => i, _ => continue };
        let id_dok = match if r.ktp_dok.trim().is_empty() { None } else { resolve_ihs(client, cfg, token, pool, "praktisi", &r.ktp_dok).await } { Some(d) if !d.is_empty() => d, _ => continue };
        let parts: Vec<&str> = r.aturan_pakai.split('x').collect();
        let dose = if !parts.is_empty() { parse_signa(parts[0]) } else { 1.0 };
        let freq = if parts.len() > 1 { parse_signa(parts[1]) } else { 1.0 };
        let jml: f64 = r.jml.as_deref().unwrap_or("0").trim().parse().unwrap_or(0.0);
        let is_ranap = r.status.as_deref() == Some("ranap");
        let (cat_code, cat_disp) = if is_ranap { ("inpatient", "Inpatient") } else { ("outpatient", "Outpatient") };
        let authored = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let unit = r.denominator_code.clone().unwrap_or_default();
        let unit_sys = r.denominator_system.clone().unwrap_or_default();
        let med_id = format!("med-{}-{}", r.kode_brng, r.no_racik);
        let mr = json!({
            "resourceType":"MedicationRequest",
            "contained":[{
                "resourceType":"Medication","id": med_id,
                "identifier":[{"system": format!("http://sys-ids.kemkes.go.id/medication/{}", cfg.org_id),"use":"official","value": r.kode_brng}],
                "extension":[{"url":"https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType",
                    "valueCodeableConcept":{"coding":[{"system":"http://terminology.kemkes.go.id/CodeSystem/medication-type","code":"NC","display":"Non-compound"}]}}],
                "code":{"coding":[{"system": r.obat_system, "code": r.obat_code.clone().unwrap_or_default(), "display": r.obat_display.clone().unwrap_or_default()}]},
                "form":{"coding":[{"system": r.form_system.clone().unwrap_or_default(), "code": r.form_code.clone().unwrap_or_default(), "display": r.form_display.clone().unwrap_or_default()}]}
            }],
            "identifier":[
                {"system": format!("http://sys-ids.kemkes.go.id/prescription/{}", cfg.org_id),"use":"official","value": r.no_resep},
                {"system": format!("http://sys-ids.kemkes.go.id/prescription-item/{}", cfg.org_id),"use":"official","value": format!("{}-{}", r.kode_brng, r.no_racik)}
            ],
            "status":"completed","intent":"order",
            "category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/medicationrequest-category","code":cat_code,"display":cat_disp}]}],
            "medicationReference":{"reference": format!("#{}", med_id), "display": r.obat_display.clone().unwrap_or_default()},
            "subject":{"reference": format!("Patient/{}", idp), "display": r.nm_pasien},
            "encounter":{"reference": format!("Encounter/{}", r.id_encounter)},
            "authoredOn": authored,
            "requester":{"reference": format!("Practitioner/{}", id_dok), "display": r.nm_dok},
            "dosageInstruction":[{"sequence":1,"patientInstruction": r.aturan_pakai,
                "timing":{"repeat":{"frequency": freq,"period":1,"periodUnit":"d"}},
                "route":{"coding":[{"system": r.route_system.clone().unwrap_or_default(),"code": r.route_code.clone().unwrap_or_default(),"display": r.route_display.clone().unwrap_or_default()}]},
                "doseAndRate":[{"doseQuantity":{"value": dose,"unit": unit,"system": unit_sys,"code": unit}}]}],
            "dispenseRequest":{"quantity":{"value": jml,"unit": unit,"system": unit_sys,"code": unit},
                "performer":{"reference": format!("Organization/{}", cfg.org_id)}}
        });
        match post_resource(client, cfg, token, "MedicationRequest", &mr).await {
            Ok(id) if !id.is_empty() => {
                let _ = sqlx::query("REPLACE INTO satu_sehat_medicationrequest_racikan (no_resep, kode_brng, no_racik, id_medicationrequest) VALUES (?,?,?,?)")
                    .bind(&r.no_resep).bind(&r.kode_brng).bind(&r.no_racik).bind(&id).execute(pool).await;
                write_log(pool, tx, "success", format!("{} ({}): Obat racikan {} [{}] terkirim", r.no_rawat, r.nm_pasien, r.obat_display.clone().unwrap_or_default(), r.no_resep)).await;
            }
            Ok(_) => {}, Err(e) => write_log(pool, tx, "error", format!("{}: Obat racikan {} gagal — {}", r.no_rawat, r.kode_brng, e)).await,
        }
    }
    write_log(pool, tx, "success", "Obat racikan: sync selesai".to_string()).await;
}

// ══════════════════════════════════════════════════════════════════════════════
// ClinicalImpression (asesmen SOAP + diagnosis) — port SatuSehatKirimClinicalImpression.
// Sumber pemeriksaan_ralan (penilaian) + satu_sehat_condition (ICD-10 + id_condition
// dari desktop) + prognosa. Dedup satu_sehat_clinicalimpression (no_rawat+tgl+jam+status).
// Guard HashSet 1 CI per SOAP/run (join condition bisa gandakan baris per diagnosis).
// ══════════════════════════════════════════════════════════════════════════════
#[derive(sqlx::FromRow)]
struct CiRow {
    no_rawat: String, tgl_reg: String, nm_pasien: String, nik: String, id_encounter: String, ktp_dok: String,
    tgl: String, jam: String, keluhan: String, penilaian: String,
    kd_penyakit: String, nm_penyakit: String, id_condition: String,
    kd_prognosa: String, display_prognosa: String, status: String,
}

async fn run_sync_clinical_impression(client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str, pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>) {
    let rows: Vec<CiRow> = sqlx::query_as(
        "SELECT pr.no_rawat, DATE_FORMAT(rp.tgl_registrasi,'%Y-%m-%d') tgl_reg, p.nm_pasien, IFNULL(p.no_ktp,'') nik, \
                se.id_encounter, IFNULL(pg.no_ktp,'') ktp_dok, \
                DATE_FORMAT(pr.tgl_perawatan,'%Y-%m-%d') tgl, TIME_FORMAT(pr.jam_rawat,'%H:%i:%s') jam, \
                IFNULL(pr.keluhan,'') keluhan, IFNULL(pr.penilaian,'') penilaian, \
                sc.kd_penyakit, py.nm_penyakit, sc.id_condition, \
                IFNULL(pp.kd_prognosa,'PR000001') kd_prognosa, IFNULL(srp.display,'Prognosis baik') display_prognosa, 'Ralan' status \
         FROM reg_periksa rp \
         JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN satu_sehat_encounter se ON se.no_rawat=rp.no_rawat AND se.id_encounter<>'' \
         JOIN satu_sehat_condition sc ON sc.no_rawat=rp.no_rawat AND sc.status='Ralan' AND sc.id_condition<>'' \
         JOIN penyakit py ON py.kd_penyakit=sc.kd_penyakit \
         JOIN pemeriksaan_ralan pr ON pr.no_rawat=rp.no_rawat \
         JOIN pegawai pg ON pg.nik=pr.nip \
         LEFT JOIN satu_sehat_clinicalimpression ci ON ci.no_rawat=pr.no_rawat AND ci.tgl_perawatan=pr.tgl_perawatan AND ci.jam_rawat=pr.jam_rawat AND ci.status='Ralan' \
         LEFT JOIN prognosa_pasien pp ON pp.no_rawat=pr.no_rawat AND pp.tgl_perawatan=pr.tgl_perawatan AND pp.jam_rawat=pr.jam_rawat AND pp.status='Ralan' \
         LEFT JOIN satu_sehat_ref_prognosa srp ON srp.kode=pp.kd_prognosa \
         WHERE pr.penilaian<>'' AND pr.tgl_perawatan BETWEEN ? AND ? \
           AND (ci.id_clinicalimpression IS NULL OR ci.id_clinicalimpression='') \
         ORDER BY pr.tgl_perawatan, pr.jam_rawat LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "ClinicalImpression: tidak ada asesmen baru.".to_string()).await; return; }
    write_log(pool, tx, "info", format!("ClinicalImpression: {} asesmen akan diperiksa.", rows.len())).await;
    let mut sudah: std::collections::HashSet<(String,String,String,String)> = std::collections::HashSet::new();
    for r in &rows {
        let key = (r.no_rawat.clone(), r.tgl.clone(), r.jam.clone(), r.status.clone());
        if sudah.contains(&key) { continue; }
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await { Some(i) if !i.is_empty() => i, _ => continue };
        let id_dok = match if r.ktp_dok.trim().is_empty() { None } else { resolve_ihs(client, cfg, token, pool, "praktisi", &r.ktp_dok).await } { Some(d) if !d.is_empty() => d, _ => continue };
        let dt = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let ci = json!({
            "resourceType":"ClinicalImpression","status":"completed",
            "description": r.keluhan,
            "subject":{"reference": format!("Patient/{}", idp), "display": r.nm_pasien},
            "encounter":{"reference": format!("Encounter/{}", r.id_encounter), "display": format!("Kunjungan {} pada tanggal {} dengan nomor kunjungan {}", r.nm_pasien, r.tgl_reg, r.no_rawat)},
            "effectiveDateTime": dt, "date": dt,
            "assessor":{"reference": format!("Practitioner/{}", id_dok)},
            "summary": r.penilaian,
            "finding":[{"itemCodeableConcept":{"coding":[{"system":"http://hl7.org/fhir/sid/icd-10","code": r.kd_penyakit, "display": r.nm_penyakit}]},
                       "itemReference":{"reference": format!("Condition/{}", r.id_condition)}}],
            "prognosisCodeableConcept":[{"coding":[{"system":"http://terminology.kemkes.go.id/CodeSystem/clinical-term","code": r.kd_prognosa, "display": r.display_prognosa}]}]
        });
        match post_resource(client, cfg, token, "ClinicalImpression", &ci).await {
            Ok(id) if !id.is_empty() => {
                let _ = sqlx::query("REPLACE INTO satu_sehat_clinicalimpression (no_rawat, tgl_perawatan, jam_rawat, status, id_clinicalimpression) VALUES (?,?,?,?,?)")
                    .bind(&r.no_rawat).bind(&r.tgl).bind(&r.jam).bind(&r.status).bind(&id).execute(pool).await;
                sudah.insert(key);
                write_log(pool, tx, "success", format!("{} ({}): Asesmen (ClinicalImpression) terkirim", r.no_rawat, r.nm_pasien)).await;
            }
            Ok(_) => {}, Err(e) => write_log(pool, tx, "error", format!("{}: ClinicalImpression gagal — {}", r.no_rawat, e)).await,
        }
    }
    write_log(pool, tx, "success", "ClinicalImpression: sync selesai".to_string()).await;
}

// ── CarePlan (rencana tindak lanjut / instruksi) — port SatuSehatKirimCarePlan ──
#[derive(sqlx::FromRow)]
struct CpRow { no_rawat: String, tgl_reg: String, nm_pasien: String, nik: String, id_encounter: String, rtl: String, nm_dok: String, ktp_dok: String, tgl: String, jam: String, status: String }

async fn run_sync_careplan(client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str, pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>) {
    let rows: Vec<CpRow> = sqlx::query_as(
        "SELECT pr.no_rawat, DATE_FORMAT(rp.tgl_registrasi,'%Y-%m-%d') tgl_reg, p.nm_pasien, IFNULL(p.no_ktp,'') nik, \
                se.id_encounter, IFNULL(pr.rtl,'') rtl, IFNULL(pg.nama,'') nm_dok, IFNULL(pg.no_ktp,'') ktp_dok, \
                DATE_FORMAT(pr.tgl_perawatan,'%Y-%m-%d') tgl, TIME_FORMAT(pr.jam_rawat,'%H:%i:%s') jam, 'Ralan' status \
         FROM reg_periksa rp JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN satu_sehat_encounter se ON se.no_rawat=rp.no_rawat AND se.id_encounter<>'' \
         JOIN pemeriksaan_ralan pr ON pr.no_rawat=rp.no_rawat \
         JOIN pegawai pg ON pg.nik=pr.nip \
         LEFT JOIN satu_sehat_careplan cp ON cp.no_rawat=pr.no_rawat AND cp.tgl_perawatan=pr.tgl_perawatan AND cp.jam_rawat=pr.jam_rawat AND cp.status='Ralan' \
         WHERE pr.rtl<>'' AND pr.tgl_perawatan BETWEEN ? AND ? AND (cp.id_careplan IS NULL OR cp.id_careplan='') \
         ORDER BY pr.tgl_perawatan, pr.jam_rawat LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "CarePlan: tidak ada rencana baru.".to_string()).await; return; }
    write_log(pool, tx, "info", format!("CarePlan: {} rencana akan diperiksa.", rows.len())).await;
    for r in &rows {
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await { Some(i) if !i.is_empty() => i, _ => continue };
        let id_dok = match if r.ktp_dok.trim().is_empty() { None } else { resolve_ihs(client, cfg, token, pool, "praktisi", &r.ktp_dok).await } { Some(d) if !d.is_empty() => d, _ => continue };
        let created = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let is_ranap = r.status == "Ranap";
        let (cat_code, cat_disp) = if is_ranap { ("736353004", "Inpatient care plan") } else { ("736271009", "Outpatient care plan") };
        let cp = json!({
            "resourceType":"CarePlan",
            "identifier":[{"system": format!("http://sys-ids.kemkes.go.id/careplan/{}/", cfg.org_id), "use":"official", "value": r.no_rawat}],
            "title":"Instruksi Medik dan Keperawatan Pasien","status":"active",
            "category":[{"coding":[{"system":"http://snomed.info/sct","code":cat_code,"display":cat_disp}]}],
            "intent":"plan","description": r.rtl,
            "subject":{"reference": format!("Patient/{}", idp), "display": r.nm_pasien},
            "encounter":{"reference": format!("Encounter/{}", r.id_encounter), "display": format!("Kunjungan {} pada tanggal {} dengan nomor kunjungan {}", r.nm_pasien, r.tgl_reg, r.no_rawat)},
            "created": created,
            "author":{"reference": format!("Practitioner/{}", id_dok), "display": r.nm_dok}
        });
        match post_resource(client, cfg, token, "CarePlan", &cp).await {
            Ok(id) if !id.is_empty() => {
                let _ = sqlx::query("REPLACE INTO satu_sehat_careplan (no_rawat, tgl_perawatan, jam_rawat, status, id_careplan) VALUES (?,?,?,?,?)")
                    .bind(&r.no_rawat).bind(&r.tgl).bind(&r.jam).bind(&r.status).bind(&id).execute(pool).await;
                write_log(pool, tx, "success", format!("{} ({}): Rencana (CarePlan) terkirim", r.no_rawat, r.nm_pasien)).await;
            }
            Ok(_) => {}, Err(e) => write_log(pool, tx, "error", format!("{}: CarePlan gagal — {}", r.no_rawat, e)).await,
        }
    }
    write_log(pool, tx, "success", "CarePlan: sync selesai".to_string()).await;
}

// ══════════════════════════════════════════════════════════════════════════════
// Condition (diagnosis ICD-10) & Procedure (ICD-9) — port SatuSehatKirim{Condition,Procedure}.
// Web jadi pengirim (dulu desktop). Sumber diagnosa_pasien / prosedur_pasien.
// Dedup satu_sehat_condition (no_rawat+kd_penyakit+status) / satu_sehat_procedure
// (no_rawat+kode+status). Procedure.category diomit (opsional; hindari kategorisasi salah).
// ══════════════════════════════════════════════════════════════════════════════
#[derive(sqlx::FromRow)]
struct CondRow { no_rawat: String, tgl: String, jam: String, nm_pasien: String, nik: String, id_encounter: String, kd_penyakit: String, nm_penyakit: String, status: String }

async fn run_sync_condition(client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str, pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>) {
    let rows: Vec<CondRow> = sqlx::query_as(
        "SELECT dp.no_rawat, DATE_FORMAT(rp.tgl_registrasi,'%Y-%m-%d') tgl, TIME_FORMAT(rp.jam_reg,'%H:%i:%s') jam, p.nm_pasien, IFNULL(p.no_ktp,'') nik, \
                se.id_encounter, dp.kd_penyakit, IFNULL(py.nm_penyakit,'') nm_penyakit, dp.status \
         FROM reg_periksa rp JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN satu_sehat_encounter se ON se.no_rawat=rp.no_rawat AND se.id_encounter<>'' \
         JOIN diagnosa_pasien dp ON dp.no_rawat=rp.no_rawat \
         JOIN penyakit py ON py.kd_penyakit=dp.kd_penyakit \
         LEFT JOIN satu_sehat_condition sc ON sc.no_rawat=dp.no_rawat AND sc.kd_penyakit=dp.kd_penyakit AND sc.status=dp.status \
         WHERE rp.tgl_registrasi BETWEEN ? AND ? AND (sc.id_condition IS NULL OR sc.id_condition='') \
         ORDER BY rp.tgl_registrasi LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "Condition: tidak ada diagnosis baru.".to_string()).await; return; }
    write_log(pool, tx, "info", format!("Condition: {} diagnosis akan diperiksa.", rows.len())).await;
    for r in &rows {
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await { Some(i) if !i.is_empty() => i, _ => continue };
        let dt = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let cond = json!({
            "resourceType":"Condition",
            "clinicalStatus":{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/condition-clinical","code":"active","display":"Active"}]},
            "category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/condition-category","code":"encounter-diagnosis","display":"Encounter Diagnosis"}]}],
            "code":{"coding":[{"system":"http://hl7.org/fhir/sid/icd-10","code": r.kd_penyakit, "display": r.nm_penyakit}]},
            "subject":{"reference": format!("Patient/{}", idp), "display": r.nm_pasien},
            "encounter":{"reference": format!("Encounter/{}", r.id_encounter), "display": format!("Diagnosa {} pada kunjungan {}", r.nm_pasien, r.no_rawat)},
            "recordedDate": dt
        });
        match post_resource(client, cfg, token, "Condition", &cond).await {
            Ok(id) if !id.is_empty() => { let _ = sqlx::query("REPLACE INTO satu_sehat_condition (no_rawat, kd_penyakit, status, id_condition) VALUES (?,?,?,?)").bind(&r.no_rawat).bind(&r.kd_penyakit).bind(&r.status).bind(&id).execute(pool).await;
                write_log(pool, tx, "success", format!("{} ({}): Diagnosis {} terkirim", r.no_rawat, r.nm_pasien, r.kd_penyakit)).await; }
            Ok(_) => {}, Err(e) => write_log(pool, tx, "error", format!("{}: Condition {} gagal — {}", r.no_rawat, r.kd_penyakit, e)).await,
        }
    }
    write_log(pool, tx, "success", "Condition: sync selesai".to_string()).await;
}

#[derive(sqlx::FromRow)]
struct ProcRow { no_rawat: String, tgl: String, jam: String, nm_pasien: String, nik: String, ktp_dok: String, id_encounter: String, kode: String, deskripsi: String, status: String }

async fn run_sync_procedure(client: &reqwest::Client, cfg: &SatuSehatConfig, token: &str, pool: &MySqlPool, tx: &tokio::sync::broadcast::Sender<SatuSehatLogEntry>) {
    let rows: Vec<ProcRow> = sqlx::query_as(
        "SELECT pp.no_rawat, DATE_FORMAT(rp.tgl_registrasi,'%Y-%m-%d') tgl, TIME_FORMAT(rp.jam_reg,'%H:%i:%s') jam, p.nm_pasien, IFNULL(p.no_ktp,'') nik, \
                IFNULL(pg.no_ktp,'') ktp_dok, se.id_encounter, pp.kode, IFNULL(i9.deskripsi_panjang,'') deskripsi, pp.status \
         FROM reg_periksa rp JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis \
         JOIN satu_sehat_encounter se ON se.no_rawat=rp.no_rawat AND se.id_encounter<>'' \
         JOIN prosedur_pasien pp ON pp.no_rawat=rp.no_rawat \
         JOIN icd9 i9 ON i9.kode=pp.kode \
         LEFT JOIN pegawai pg ON pg.nik=rp.kd_dokter \
         LEFT JOIN satu_sehat_procedure sp ON sp.no_rawat=pp.no_rawat AND sp.kode=pp.kode AND sp.status=pp.status \
         WHERE rp.tgl_registrasi BETWEEN ? AND ? AND (sp.id_procedure IS NULL OR sp.id_procedure='') \
         ORDER BY rp.tgl_registrasi LIMIT 1000")
        .bind(&cfg.d_from).bind(&cfg.d_to).fetch_all(pool).await.unwrap_or_default();
    if rows.is_empty() { write_log(pool, tx, "info", "Procedure: tidak ada prosedur baru.".to_string()).await; return; }
    write_log(pool, tx, "info", format!("Procedure: {} prosedur akan diperiksa.", rows.len())).await;
    for r in &rows {
        if r.nik.trim().is_empty() { continue; }
        let idp = match resolve_ihs(client, cfg, token, pool, "pasien", &r.nik).await { Some(i) if !i.is_empty() => i, _ => continue };
        let dt = iso_to_utc(&format!("{}T{}+07:00", r.tgl, r.jam));
        let mut proc = json!({
            "resourceType":"Procedure","status":"completed",
            "code":{"coding":[{"system":"http://hl7.org/fhir/sid/icd-9-cm","code": r.kode, "display": r.deskripsi}]},
            "subject":{"reference": format!("Patient/{}", idp), "display": r.nm_pasien},
            "encounter":{"reference": format!("Encounter/{}", r.id_encounter), "display": format!("Prosedur {} pada kunjungan {}", r.nm_pasien, r.no_rawat)},
            "performedDateTime": dt
        });
        if !r.ktp_dok.trim().is_empty() {
            if let Some(id_dok) = resolve_ihs(client, cfg, token, pool, "praktisi", &r.ktp_dok).await.filter(|x| !x.is_empty()) {
                proc["performer"] = json!([{"actor":{"reference": format!("Practitioner/{}", id_dok)}}]);
            }
        }
        match post_resource(client, cfg, token, "Procedure", &proc).await {
            Ok(id) if !id.is_empty() => { let _ = sqlx::query("REPLACE INTO satu_sehat_procedure (no_rawat, kode, status, id_procedure) VALUES (?,?,?,?)").bind(&r.no_rawat).bind(&r.kode).bind(&r.status).bind(&id).execute(pool).await;
                write_log(pool, tx, "success", format!("{} ({}): Prosedur {} terkirim", r.no_rawat, r.nm_pasien, r.kode)).await; }
            Ok(_) => {}, Err(e) => write_log(pool, tx, "error", format!("{}: Procedure {} gagal — {}", r.no_rawat, r.kode, e)).await,
        }
    }
    write_log(pool, tx, "success", "Procedure: sync selesai".to_string()).await;
}
