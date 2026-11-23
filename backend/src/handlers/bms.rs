// Modul BIMASAKTI — BMS (Body, Mind & Soul) Index.
// BMS = Body×w_body + Mind×w_mind + Soul×w_soul (semua 0–100).
//   Body = konversi BMI pegawai; Mind = E-Kinerja; Soul = ZI organisasi.
// Bobot & parameter BMI di simrscb_config (bisa di-tuning). Tabel bms_* web-only.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error bms: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
fn forbidden() -> (StatusCode, Json<Value>) {
    (StatusCode::FORBIDDEN, Json(json!({"error": "Hanya admin yang bisa mengubah data ini"})))
}

// ── Konfigurasi (bobot + parameter BMI) ─────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct BmsConfig {
    pub w_body: f64,
    pub w_mind: f64,
    pub w_soul: f64,
    pub bmi_ideal: f64,
    pub bmi_k: f64,
    // Setelan AI (api_key tidak pernah dikembalikan; ai_enabled = siap dipakai)
    pub ai_provider: String,   // claude | gemini | ollama
    pub ai_model:    String,
    pub ai_base_url: String,   // untuk ollama
    pub ai_enabled:  bool,
}

pub struct AiSettings {
    pub provider: String,
    pub model:    String,
    pub api_key:  String,
    pub base_url: String,
}

async fn cfg_val(pool: &sqlx::MySqlPool, kunci: &str) -> String {
    sqlx::query_scalar::<_, String>("SELECT nilai FROM simrscb_config WHERE kunci = ?")
        .bind(kunci).fetch_optional(pool).await.ok().flatten().unwrap_or_default()
}

async fn load_ai(pool: &sqlx::MySqlPool) -> AiSettings {
    let provider = {
        let p = cfg_val(pool, "bms_ai_provider").await;
        if p.is_empty() { "claude".to_string() } else { p }
    };
    let model = {
        let m = cfg_val(pool, "bms_ai_model").await;
        if !m.is_empty() { m } else {
            match provider.as_str() {
                "gemini" => "gemini-2.0-flash".to_string(),
                "ollama" => "gemma2".to_string(),
                _ => "claude-opus-4-8".to_string(),
            }
        }
    };
    // api_key: pakai kunci umum; fallback ke anthropic_api_key lama untuk Claude
    let mut api_key = cfg_val(pool, "bms_ai_api_key").await;
    if api_key.is_empty() && provider == "claude" {
        api_key = cfg_val(pool, "anthropic_api_key").await;
    }
    let base_url = {
        let u = cfg_val(pool, "bms_ai_base_url").await;
        if u.is_empty() { "http://localhost:11434".to_string() } else { u }
    };
    AiSettings { provider, model, api_key, base_url }
}

fn ai_ready(ai: &AiSettings) -> bool {
    match ai.provider.as_str() {
        "ollama" => !ai.base_url.is_empty(),
        _ => !ai.api_key.is_empty(),
    }
}

async fn load_config(pool: &sqlx::MySqlPool) -> Result<BmsConfig, (StatusCode, Json<Value>)> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT kunci, nilai FROM simrscb_config WHERE kunci IN \
         ('bms_w_body','bms_w_mind','bms_w_soul','bms_bmi_ideal','bms_bmi_k')"
    )
    .fetch_all(pool).await.map_err(db_err)?;
    let get = |k: &str, d: f64| rows.iter().find(|(kk, _)| kk == k)
        .and_then(|(_, v)| v.parse::<f64>().ok()).unwrap_or(d);
    Ok(BmsConfig {
        w_body: get("bms_w_body", 0.30),
        w_mind: get("bms_w_mind", 0.40),
        w_soul: get("bms_w_soul", 0.30),
        // Kalibrasi thd angka resmi makalah: BMI 32,335->26,65 & 31,89->31,10
        // => k=10, ideal=25 (batas atas BMI normal WHO). Lihat migrasi 048.
        bmi_ideal: get("bms_bmi_ideal", 25.0),
        bmi_k: get("bms_bmi_k", 10.0),
        ai_provider: String::new(), ai_model: String::new(),
        ai_base_url: String::new(), ai_enabled: false, // diisi di get_config
    })
}

/// BMI → skor 0–100: makin dekat BMI ideal, makin tinggi.
fn body_score(bmi: f64, cfg: &BmsConfig) -> f64 {
    let s = 100.0 - (bmi - cfg.bmi_ideal).abs() * cfg.bmi_k;
    s.clamp(0.0, 100.0)
}

fn kategori(idx: f64) -> &'static str {
    if idx >= 80.0 { "Sangat Baik" }
    else if idx >= 60.0 { "Baik" }
    else if idx >= 40.0 { "Cukup" }
    else { "Perlu Perbaikan" }
}

pub async fn get_config(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<BmsConfig>, (StatusCode, Json<Value>)> {
    let mut cfg = load_config(&state.pool).await?;
    let ai = load_ai(&state.pool).await;
    cfg.ai_provider = ai.provider.clone();
    cfg.ai_model = ai.model.clone();
    cfg.ai_base_url = ai.base_url.clone();
    cfg.ai_enabled = ai_ready(&ai);
    Ok(Json(cfg))
}

#[derive(Deserialize)]
pub struct PutConfigBody {
    pub w_body: Option<f64>, pub w_mind: Option<f64>, pub w_soul: Option<f64>,
    pub bmi_ideal: Option<f64>, pub bmi_k: Option<f64>,
    // Setelan AI (semua opsional; api_key write-only)
    pub ai_provider: Option<String>,
    pub ai_model:    Option<String>,
    pub ai_api_key:  Option<String>,
    pub ai_base_url: Option<String>,
}

pub async fn put_config(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<PutConfigBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin { return Err(forbidden()); }
    let pairs = [
        ("bms_w_body", b.w_body), ("bms_w_mind", b.w_mind), ("bms_w_soul", b.w_soul),
        ("bms_bmi_ideal", b.bmi_ideal), ("bms_bmi_k", b.bmi_k),
    ];
    for (k, v) in pairs {
        if let Some(val) = v {
            sqlx::query(
                "INSERT INTO simrscb_config (kunci, nilai) VALUES (?, ?) \
                 ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)"
            ).bind(k).bind(val.to_string()).execute(&state.pool).await.map_err(db_err)?;
        }
    }
    // Setelan AI teks (provider/model/base_url) — simpan bila ada (boleh dikosongkan)
    let ai_pairs = [
        ("bms_ai_provider", b.ai_provider),
        ("bms_ai_model",    b.ai_model),
        ("bms_ai_base_url", b.ai_base_url),
    ];
    for (k, v) in ai_pairs {
        if let Some(val) = v {
            sqlx::query(
                "INSERT INTO simrscb_config (kunci, nilai) VALUES (?, ?) \
                 ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)"
            ).bind(k).bind(val.trim()).execute(&state.pool).await.map_err(db_err)?;
        }
    }
    // API key AI — hanya tulis jika non-kosong (kosong = biarkan yang lama)
    if let Some(key) = b.ai_api_key {
        if !key.trim().is_empty() {
            sqlx::query(
                "INSERT INTO simrscb_config (kunci, nilai) VALUES ('bms_ai_api_key', ?) \
                 ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)"
            ).bind(key.trim()).execute(&state.pool).await.map_err(db_err)?;
        }
    }
    Ok(Json(json!({"ok": true})))
}

// ── Periode ─────────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct Periode {
    pub kd_periode:  u32,
    pub nama:        String,
    pub tgl_mulai:   Option<String>,
    pub tgl_selesai: Option<String>,
    pub status:      String,
}

pub async fn list_periode(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<Periode>>, (StatusCode, Json<Value>)> {
    let rows: Vec<Periode> = sqlx::query_as(
        "SELECT kd_periode, nama, CAST(tgl_mulai AS CHAR) AS tgl_mulai, \
                CAST(tgl_selesai AS CHAR) AS tgl_selesai, status \
         FROM bms_periode ORDER BY tgl_mulai DESC, kd_periode DESC"
    ).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct NewPeriode { pub nama: String, pub tgl_mulai: String, pub tgl_selesai: String }

pub async fn create_periode(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<NewPeriode>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin { return Err(forbidden()); }
    if b.nama.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "nama periode wajib"}))));
    }
    sqlx::query(
        "INSERT INTO bms_periode (nama, tgl_mulai, tgl_selesai, status) VALUES (?, ?, ?, 'aktif')"
    ).bind(b.nama.trim()).bind(&b.tgl_mulai).bind(&b.tgl_selesai)
     .execute(&state.pool).await
     .map_err(|e| {
        if e.to_string().contains("Duplicate") {
            (StatusCode::BAD_REQUEST, Json(json!({"error": "Nama periode sudah ada"})))
        } else { db_err(e) }
     })?;
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
pub struct HapusPeriode { pub kd_periode: u32 }

pub async fn delete_periode(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<HapusPeriode>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin { return Err(forbidden()); }
    // Hapus seluruh data terkait periode lalu periodenya
    for t in ["bms_body", "bms_mind", "bms_soul_zi", "bms_index", "bms_intervensi", "bms_periode"] {
        let sql = format!("DELETE FROM {} WHERE kd_periode = ?", t);
        sqlx::query(&sql).bind(b.kd_periode).execute(&state.pool).await.map_err(db_err)?;
    }
    Ok(Json(json!({"ok": true})))
}

// ── Input grid: pegawai + body/mind untuk satu periode + soul org ───────────

#[derive(Serialize, sqlx::FromRow)]
pub struct InputRow {
    pub nik:        String,
    pub nama:       String,
    pub departemen: Option<String>,
    pub nm_dep:     Option<String>,
    pub bmi:        Option<f64>,
    pub body_index: Option<f64>,
    pub e_kinerja:  Option<f64>,
}

#[derive(Deserialize)]
pub struct InputQuery { pub kd_periode: u32, pub cari: Option<String> }

#[derive(Serialize)]
pub struct InputResponse {
    pub soul_zi: Option<f64>,
    pub soul_catatan: Option<String>,
    pub rows: Vec<InputRow>,
}

pub async fn input_list(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<InputQuery>,
) -> Result<Json<InputResponse>, (StatusCode, Json<Value>)> {
    let cari = format!("%{}%", q.cari.unwrap_or_default());
    let rows: Vec<InputRow> = sqlx::query_as(
        "SELECT p.nik, p.nama, p.departemen, d.nama AS nm_dep, \
                CAST(b.bmi AS DOUBLE) AS bmi, CAST(b.body_index AS DOUBLE) AS body_index, \
                CAST(m.e_kinerja AS DOUBLE) AS e_kinerja \
         FROM pegawai p \
         LEFT JOIN departemen d ON p.departemen = d.dep_id \
         LEFT JOIN bms_body b ON b.nik = p.nik AND b.kd_periode = ? \
         LEFT JOIN bms_mind m ON m.nik = p.nik AND m.kd_periode = ? \
         WHERE p.stts_aktif = 'AKTIF' AND (p.nama LIKE ? OR p.nik LIKE ?) \
         ORDER BY d.nama, p.nama LIMIT 1000"
    )
    .bind(q.kd_periode).bind(q.kd_periode).bind(&cari).bind(&cari)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    let soul: Option<(f64, Option<String>)> = sqlx::query_as(
        "SELECT CAST(zi_index AS DOUBLE), catatan FROM bms_soul_zi WHERE kd_periode = ?"
    ).bind(q.kd_periode).fetch_optional(&state.pool).await.map_err(db_err)?;

    Ok(Json(InputResponse {
        soul_zi: soul.as_ref().map(|s| s.0),
        soul_catatan: soul.and_then(|s| s.1),
        rows,
    }))
}

// ── Upsert Body / Mind / Soul ───────────────────────────────────────────────

#[derive(Deserialize)]
pub struct BodyInput { pub kd_periode: u32, pub nik: String, pub bmi: f64, pub tgl_ukur: Option<String> }

pub async fn upsert_body(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<BodyInput>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin { return Err(forbidden()); }
    let cfg = load_config(&state.pool).await?;
    let idx = body_score(b.bmi, &cfg);
    sqlx::query(
        "INSERT INTO bms_body (kd_periode, nik, bmi, body_index, tgl_ukur) VALUES (?, ?, ?, ?, ?) \
         ON DUPLICATE KEY UPDATE bmi = VALUES(bmi), body_index = VALUES(body_index), tgl_ukur = VALUES(tgl_ukur)"
    ).bind(b.kd_periode).bind(&b.nik).bind(b.bmi).bind(idx).bind(&b.tgl_ukur)
     .execute(&state.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "body_index": idx})))
}

#[derive(Deserialize)]
pub struct MindInput { pub kd_periode: u32, pub nik: String, pub e_kinerja: f64 }

pub async fn upsert_mind(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<MindInput>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin { return Err(forbidden()); }
    sqlx::query(
        "INSERT INTO bms_mind (kd_periode, nik, e_kinerja, sumber) VALUES (?, ?, ?, 'manual') \
         ON DUPLICATE KEY UPDATE e_kinerja = VALUES(e_kinerja)"
    ).bind(b.kd_periode).bind(&b.nik).bind(b.e_kinerja)
     .execute(&state.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
pub struct SoulInput { pub kd_periode: u32, pub zi_index: f64, pub catatan: Option<String> }

pub async fn upsert_soul(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<SoulInput>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin { return Err(forbidden()); }
    sqlx::query(
        "INSERT INTO bms_soul_zi (kd_periode, zi_index, catatan) VALUES (?, ?, ?) \
         ON DUPLICATE KEY UPDATE zi_index = VALUES(zi_index), catatan = VALUES(catatan)"
    ).bind(b.kd_periode).bind(b.zi_index).bind(&b.catatan)
     .execute(&state.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Hitung BMS Index (ORG / UNIT / PEGAWAI) ─────────────────────────────────

#[derive(Deserialize)]
pub struct HitungBody { pub kd_periode: u32 }

pub async fn hitung(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<HitungBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin { return Err(forbidden()); }
    let kp = b.kd_periode;
    let cfg = load_config(&state.pool).await?;

    let zi: f64 = sqlx::query_as::<_, (Option<f64>,)>(
        "SELECT CAST(zi_index AS DOUBLE) FROM bms_soul_zi WHERE kd_periode = ?"
    ).bind(kp).fetch_optional(&state.pool).await.map_err(db_err)?
     .and_then(|r| r.0).unwrap_or(0.0);

    let combine = |body: Option<f64>, mind: Option<f64>| -> (Option<f64>, Option<f64>, f64, String) {
        // Soul selalu ada (zi org). Body/Mind bisa kosong → dianggap 0 kontribusinya.
        let bo = body.unwrap_or(0.0);
        let mi = mind.unwrap_or(0.0);
        let idx = cfg.w_body * bo + cfg.w_mind * mi + cfg.w_soul * zi;
        (body, mind, idx, kategori(idx).to_string())
    };

    // Bersihkan hasil lama periode ini
    sqlx::query("DELETE FROM bms_index WHERE kd_periode = ?").bind(kp)
        .execute(&state.pool).await.map_err(db_err)?;

    // ORG: rata-rata seluruh pegawai
    let (org_body,): (Option<f64>,) = sqlx::query_as(
        "SELECT AVG(CAST(body_index AS DOUBLE)) FROM bms_body WHERE kd_periode = ?"
    ).bind(kp).fetch_one(&state.pool).await.map_err(db_err)?;
    let (org_mind,): (Option<f64>,) = sqlx::query_as(
        "SELECT AVG(CAST(e_kinerja AS DOUBLE)) FROM bms_mind WHERE kd_periode = ?"
    ).bind(kp).fetch_one(&state.pool).await.map_err(db_err)?;
    let (sb, sm, idx, kat) = combine(org_body, org_mind);
    sqlx::query(
        "INSERT INTO bms_index (kd_periode, scope, ref, skor_body, skor_mind, skor_soul, bms_index, kategori) \
         VALUES (?, 'ORG', '', ?, ?, ?, ?, ?)"
    ).bind(kp).bind(sb).bind(sm).bind(zi).bind(idx).bind(&kat)
     .execute(&state.pool).await.map_err(db_err)?;

    // UNIT: rata-rata per departemen
    let unit_body: Vec<(String, f64)> = sqlx::query_as(
        "SELECT p.departemen, AVG(CAST(b.body_index AS DOUBLE)) \
         FROM bms_body b JOIN pegawai p ON p.nik = b.nik \
         WHERE b.kd_periode = ? AND p.departemen IS NOT NULL AND p.departemen <> '' \
         GROUP BY p.departemen"
    ).bind(kp).fetch_all(&state.pool).await.map_err(db_err)?;
    let unit_mind: Vec<(String, f64)> = sqlx::query_as(
        "SELECT p.departemen, AVG(CAST(m.e_kinerja AS DOUBLE)) \
         FROM bms_mind m JOIN pegawai p ON p.nik = m.nik \
         WHERE m.kd_periode = ? AND p.departemen IS NOT NULL AND p.departemen <> '' \
         GROUP BY p.departemen"
    ).bind(kp).fetch_all(&state.pool).await.map_err(db_err)?;
    let mut deps: std::collections::BTreeMap<String, (Option<f64>, Option<f64>)> = Default::default();
    for (d, v) in unit_body { deps.entry(d).or_default().0 = Some(v); }
    for (d, v) in unit_mind { deps.entry(d).or_default().1 = Some(v); }
    for (dep, (bo, mi)) in deps {
        let (sb, sm, idx, kat) = combine(bo, mi);
        sqlx::query(
            "INSERT INTO bms_index (kd_periode, scope, ref, skor_body, skor_mind, skor_soul, bms_index, kategori) \
             VALUES (?, 'UNIT', ?, ?, ?, ?, ?, ?)"
        ).bind(kp).bind(&dep).bind(sb).bind(sm).bind(zi).bind(idx).bind(&kat)
         .execute(&state.pool).await.map_err(db_err)?;
    }

    // PEGAWAI: gabungan body+mind per nik (yang punya minimal salah satu)
    let peg: Vec<(String, Option<f64>, Option<f64>)> = sqlx::query_as(
        "SELECT p.nik, CAST(b.body_index AS DOUBLE), CAST(m.e_kinerja AS DOUBLE) \
         FROM pegawai p \
         LEFT JOIN bms_body b ON b.nik = p.nik AND b.kd_periode = ? \
         LEFT JOIN bms_mind m ON m.nik = p.nik AND m.kd_periode = ? \
         WHERE p.stts_aktif = 'AKTIF' AND (b.nik IS NOT NULL OR m.nik IS NOT NULL)"
    ).bind(kp).bind(kp).fetch_all(&state.pool).await.map_err(db_err)?;
    for (nik, bo, mi) in peg {
        let (sb, sm, idx, kat) = combine(bo, mi);
        sqlx::query(
            "INSERT INTO bms_index (kd_periode, scope, ref, skor_body, skor_mind, skor_soul, bms_index, kategori) \
             VALUES (?, 'PEGAWAI', ?, ?, ?, ?, ?, ?)"
        ).bind(kp).bind(&nik).bind(sb).bind(sm).bind(zi).bind(idx).bind(&kat)
         .execute(&state.pool).await.map_err(db_err)?;
    }

    Ok(Json(json!({"ok": true})))
}

// ── Dashboard ───────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct IndexRow {
    pub scope:     String,
    pub ref_id:    String,
    pub nama:      Option<String>,
    pub skor_body: Option<f64>,
    pub skor_mind: Option<f64>,
    pub skor_soul: Option<f64>,
    pub bms_index: Option<f64>,
    pub kategori:  Option<String>,
}

#[derive(Serialize)]
pub struct TrenRow { pub nama: String, pub bms_index: Option<f64> }

#[derive(Serialize)]
pub struct Dashboard {
    pub org:   Option<IndexRow>,
    pub units: Vec<IndexRow>,
    pub tren:  Vec<TrenRow>,
    pub jml_input_body: i64,
    pub jml_input_mind: i64,
    pub jml_pegawai_aktif: i64,
}

#[derive(Deserialize)]
pub struct DashQuery { pub kd_periode: u32 }

pub async fn dashboard(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<DashQuery>,
) -> Result<Json<Dashboard>, (StatusCode, Json<Value>)> {
    let kp = q.kd_periode;

    let org: Option<IndexRow> = sqlx::query_as(
        "SELECT scope, ref AS ref_id, NULL AS nama, \
                CAST(skor_body AS DOUBLE) AS skor_body, CAST(skor_mind AS DOUBLE) AS skor_mind, \
                CAST(skor_soul AS DOUBLE) AS skor_soul, CAST(bms_index AS DOUBLE) AS bms_index, kategori \
         FROM bms_index WHERE kd_periode = ? AND scope = 'ORG'"
    ).bind(kp).fetch_optional(&state.pool).await.map_err(db_err)?;

    let units: Vec<IndexRow> = sqlx::query_as(
        "SELECT bi.scope, bi.ref AS ref_id, d.nama AS nama, \
                CAST(bi.skor_body AS DOUBLE) AS skor_body, CAST(bi.skor_mind AS DOUBLE) AS skor_mind, \
                CAST(bi.skor_soul AS DOUBLE) AS skor_soul, CAST(bi.bms_index AS DOUBLE) AS bms_index, bi.kategori \
         FROM bms_index bi LEFT JOIN departemen d ON bi.ref = d.dep_id \
         WHERE bi.kd_periode = ? AND bi.scope = 'UNIT' \
         ORDER BY bi.bms_index DESC"
    ).bind(kp).fetch_all(&state.pool).await.map_err(db_err)?;

    let tren: Vec<TrenRow> = sqlx::query_as::<_, (String, Option<f64>)>(
        "SELECT pr.nama, CAST(bi.bms_index AS DOUBLE) \
         FROM bms_periode pr \
         LEFT JOIN bms_index bi ON bi.kd_periode = pr.kd_periode AND bi.scope = 'ORG' \
         ORDER BY pr.tgl_mulai ASC LIMIT 24"
    ).fetch_all(&state.pool).await.map_err(db_err)?
     .into_iter().map(|(nama, bms_index)| TrenRow { nama, bms_index }).collect();

    let (jb,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bms_body WHERE kd_periode = ?")
        .bind(kp).fetch_one(&state.pool).await.map_err(db_err)?;
    let (jm,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bms_mind WHERE kd_periode = ?")
        .bind(kp).fetch_one(&state.pool).await.map_err(db_err)?;
    let (ja,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM pegawai WHERE stts_aktif = 'AKTIF'")
        .fetch_one(&state.pool).await.map_err(db_err)?;

    Ok(Json(Dashboard {
        org, units, tren,
        jml_input_body: jb, jml_input_mind: jm, jml_pegawai_aktif: ja,
    }))
}

#[derive(Deserialize)]
pub struct UnitQuery { pub kd_periode: u32, pub dep: String }

pub async fn dashboard_unit(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<UnitQuery>,
) -> Result<Json<Vec<IndexRow>>, (StatusCode, Json<Value>)> {
    let rows: Vec<IndexRow> = sqlx::query_as(
        "SELECT bi.scope, bi.ref AS ref_id, p.nama AS nama, \
                CAST(bi.skor_body AS DOUBLE) AS skor_body, CAST(bi.skor_mind AS DOUBLE) AS skor_mind, \
                CAST(bi.skor_soul AS DOUBLE) AS skor_soul, CAST(bi.bms_index AS DOUBLE) AS bms_index, bi.kategori \
         FROM bms_index bi \
         JOIN pegawai p ON p.nik = bi.ref \
         WHERE bi.kd_periode = ? AND bi.scope = 'PEGAWAI' AND p.departemen = ? \
         ORDER BY bi.bms_index DESC"
    ).bind(q.kd_periode).bind(&q.dep).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// ── Improvement Cycle (PDCA) — bms_intervensi ───────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct Intervensi {
    pub id:             u64,
    pub kd_periode:     u32,
    pub scope:          String,
    pub ref_id:         String,
    pub nama_ref:       Option<String>,
    pub temuan:         Option<String>,
    pub pdca_plan:      Option<String>,
    pub pdca_do:        Option<String>,
    pub pdca_check:     Option<String>,
    pub pdca_act:       Option<String>,
    pub status:         String,
    pub rekomendasi_ai: Option<String>,
    pub tgl:            Option<String>,
}

#[derive(Deserialize)]
pub struct IntervensiQuery { pub kd_periode: u32 }

pub async fn list_intervensi(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<IntervensiQuery>,
) -> Result<Json<Vec<Intervensi>>, (StatusCode, Json<Value>)> {
    let rows: Vec<Intervensi> = sqlx::query_as(
        "SELECT i.id, i.kd_periode, i.scope, i.ref AS ref_id, \
                COALESCE(d.nama, p.nama) AS nama_ref, \
                i.temuan, i.pdca_plan, i.pdca_do, i.pdca_check, i.pdca_act, \
                i.status, i.rekomendasi_ai, CAST(i.tgl AS CHAR) AS tgl \
         FROM bms_intervensi i \
         LEFT JOIN departemen d ON i.scope = 'UNIT' AND i.ref = d.dep_id \
         LEFT JOIN pegawai p ON i.scope = 'PEGAWAI' AND i.ref = p.nik \
         WHERE i.kd_periode = ? ORDER BY i.id DESC"
    ).bind(q.kd_periode).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct IntervensiBody {
    pub id:         Option<u64>,
    pub kd_periode: u32,
    pub scope:      Option<String>,
    pub ref_id:     Option<String>,
    pub temuan:     Option<String>,
    pub pdca_plan:  Option<String>,
    pub pdca_do:    Option<String>,
    pub pdca_check: Option<String>,
    pub pdca_act:   Option<String>,
    pub status:     Option<String>,
    pub rekomendasi_ai: Option<String>,
    pub tgl:        Option<String>,
}

pub async fn save_intervensi(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<IntervensiBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin { return Err(forbidden()); }
    let scope = b.scope.unwrap_or_else(|| "ORG".to_string());
    let status = b.status.unwrap_or_else(|| "rencana".to_string());
    if let Some(id) = b.id {
        sqlx::query(
            "UPDATE bms_intervensi SET scope=?, ref=?, temuan=?, pdca_plan=?, pdca_do=?, \
             pdca_check=?, pdca_act=?, status=?, rekomendasi_ai=?, tgl=? WHERE id=?"
        )
        .bind(&scope).bind(b.ref_id.unwrap_or_default()).bind(&b.temuan)
        .bind(&b.pdca_plan).bind(&b.pdca_do).bind(&b.pdca_check).bind(&b.pdca_act)
        .bind(&status).bind(&b.rekomendasi_ai).bind(&b.tgl).bind(id)
        .execute(&state.pool).await.map_err(db_err)?;
    } else {
        sqlx::query(
            "INSERT INTO bms_intervensi (kd_periode, scope, ref, temuan, pdca_plan, pdca_do, \
             pdca_check, pdca_act, status, rekomendasi_ai, tgl) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(b.kd_periode).bind(&scope).bind(b.ref_id.unwrap_or_default()).bind(&b.temuan)
        .bind(&b.pdca_plan).bind(&b.pdca_do).bind(&b.pdca_check).bind(&b.pdca_act)
        .bind(&status).bind(&b.rekomendasi_ai).bind(&b.tgl)
        .execute(&state.pool).await.map_err(db_err)?;
    }
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
pub struct HapusIntervensi { pub id: u64 }

pub async fn hapus_intervensi(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<HapusIntervensi>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin { return Err(forbidden()); }
    sqlx::query("DELETE FROM bms_intervensi WHERE id = ?")
        .bind(b.id).execute(&state.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Rekomendasi AI (Claude API) ─────────────────────────────────────────────
// Kirim konteks skor BMS ke Claude → rekomendasi intervensi pembinaan.

#[derive(Deserialize)]
pub struct AiBody {
    pub kd_periode: u32,
    pub scope:      String,          // ORG | UNIT | PEGAWAI
    pub ref_id:     Option<String>,  // dep_id / nik
}

pub async fn rekomendasi_ai(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<AiBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin { return Err(forbidden()); }
    let ai = load_ai(&state.pool).await;
    if !ai_ready(&ai) {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error": "Setelan AI belum lengkap (isi API key / base URL di Pengaturan)"}))));
    }

    let refv = b.ref_id.clone().unwrap_or_default();
    // Ambil skor dari bms_index
    let idx: Option<(Option<f64>, Option<f64>, Option<f64>, Option<f64>, Option<String>)> =
        sqlx::query_as(
            "SELECT CAST(skor_body AS DOUBLE), CAST(skor_mind AS DOUBLE), \
                    CAST(skor_soul AS DOUBLE), CAST(bms_index AS DOUBLE), kategori \
             FROM bms_index WHERE kd_periode=? AND scope=? AND ref=?"
        ).bind(b.kd_periode).bind(&b.scope).bind(&refv)
         .fetch_optional(&state.pool).await.map_err(db_err)?;
    let (sb, sm, ss, idxv, kat) = idx.unwrap_or((None, None, None, None, None));

    let periode: String = sqlx::query_scalar("SELECT nama FROM bms_periode WHERE kd_periode=?")
        .bind(b.kd_periode).fetch_optional(&state.pool).await.map_err(db_err)?
        .unwrap_or_default();
    let sasaran = match b.scope.as_str() {
        "UNIT" => sqlx::query_scalar::<_, String>("SELECT nama FROM departemen WHERE dep_id=?")
            .bind(&refv).fetch_optional(&state.pool).await.ok().flatten()
            .map(|n| format!("Unit {}", n)).unwrap_or_else(|| "Unit".to_string()),
        "PEGAWAI" => sqlx::query_scalar::<_, String>("SELECT nama FROM pegawai WHERE nik=?")
            .bind(&refv).fetch_optional(&state.pool).await.ok().flatten()
            .map(|n| format!("Pegawai {}", n)).unwrap_or_else(|| "Pegawai".to_string()),
        _ => "Organisasi (seluruh RS)".to_string(),
    };

    let nama_rs = sqlx::query_scalar::<_, Option<String>>("SELECT nama_instansi FROM setting LIMIT 1")
        .fetch_optional(&state.pool).await.ok().flatten().flatten()
        .filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "rumah sakit".to_string());
    let f = |v: Option<f64>| v.map(|x| format!("{:.2}", x)).unwrap_or_else(|| "-".to_string());
    let konteks = format!(
        "Konteks BMS Index (Body-Mind-Soul), {nama_rs}, periode {periode}.\n\
         Sasaran: {sasaran}.\n\
         - Body (indeks BMI, 0-100): {}\n\
         - Mind (nilai E-Kinerja, 0-100): {}\n\
         - Soul (self-assessment Zona Integritas, 0-100): {}\n\
         - BMS Index gabungan: {} (kategori: {})\n\n\
         Program pendukung yang tersedia: Body (GESIT/turun berat badan, PETARO/berhenti \
         merokok, stretching, MCU); Mind (Talent DNA, pembinaan E-Kinerja); Soul (pembinaan \
         Zona Integritas, ESQ).",
        f(sb), f(sm), f(ss), f(idxv), kat.unwrap_or_else(|| "-".to_string())
    );
    let system = "Anda konsultan pengembangan SDM rumah sakit. Berdasarkan skor BMS Index, \
        beri rekomendasi intervensi pembinaan yang ringkas, konkret, dan dapat ditindaklanjuti \
        dalam siklus PDCA. Fokus pada dimensi dengan skor terendah. Jawab dalam Bahasa Indonesia, \
        maksimal ~180 kata, dengan bagian: Prioritas, Rencana (Plan), Langkah (Do), lalu saran \
        indikator untuk Check. Jangan mengarang data di luar konteks.";

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    let gw = |e: String| (StatusCode::BAD_GATEWAY, Json(json!({"error": e})));

    // Dispatch per provider — bangun request + parsing sesuai formatnya
    let teks = match ai.provider.as_str() {
        // ── Google Gemini ──────────────────────────────────────────────────
        "gemini" => {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                ai.model, ai.api_key
            );
            let payload = json!({
                "system_instruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": konteks}]}],
                "generationConfig": {"maxOutputTokens": 1024}
            });
            let resp = client.post(&url).json(&payload).send().await
                .map_err(|e| gw(format!("Gagal memanggil Gemini: {e}")))?;
            let st = resp.status();
            let body: Value = resp.json().await.map_err(|e| gw(format!("Respons Gemini tidak valid: {e}")))?;
            if !st.is_success() {
                let msg = body.pointer("/error/message").and_then(|m| m.as_str()).unwrap_or("error");
                return Err(gw(format!("Gemini API: {msg}")));
            }
            body.pointer("/candidates/0/content/parts")
                .and_then(|p| p.as_array())
                .map(|arr| arr.iter().filter_map(|x| x.get("text").and_then(|t| t.as_str()))
                    .collect::<Vec<_>>().join("\n"))
                .unwrap_or_default()
        }
        // ── Ollama (lokal, mis. gemma) ─────────────────────────────────────
        "ollama" => {
            let url = format!("{}/api/chat", ai.base_url.trim_end_matches('/'));
            let payload = json!({
                "model": ai.model,
                "stream": false,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": konteks}
                ]
            });
            let resp = client.post(&url).json(&payload).send().await
                .map_err(|e| gw(format!("Gagal memanggil Ollama: {e}")))?;
            let st = resp.status();
            let body: Value = resp.json().await.map_err(|e| gw(format!("Respons Ollama tidak valid: {e}")))?;
            if !st.is_success() {
                let msg = body.get("error").and_then(|m| m.as_str()).unwrap_or("error");
                return Err(gw(format!("Ollama: {msg}")));
            }
            body.pointer("/message/content").and_then(|t| t.as_str()).unwrap_or_default().to_string()
        }
        // ── Anthropic Claude (default) ─────────────────────────────────────
        _ => {
            let payload = json!({
                "model": ai.model,
                "max_tokens": 1024,
                "system": system,
                "messages": [{"role": "user", "content": konteks}]
            });
            let resp = client.post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &ai.api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&payload).send().await
                .map_err(|e| gw(format!("Gagal memanggil Claude: {e}")))?;
            let st = resp.status();
            let body: Value = resp.json().await.map_err(|e| gw(format!("Respons Claude tidak valid: {e}")))?;
            if !st.is_success() {
                let msg = body.pointer("/error/message").and_then(|m| m.as_str()).unwrap_or("error");
                return Err(gw(format!("Claude API: {msg}")));
            }
            body.get("content").and_then(|c| c.as_array())
                .map(|arr| arr.iter()
                    .filter(|blk| blk.get("type").and_then(|t| t.as_str()) == Some("text"))
                    .filter_map(|blk| blk.get("text").and_then(|t| t.as_str()))
                    .collect::<Vec<_>>().join("\n"))
                .unwrap_or_default()
        }
    };

    Ok(Json(json!({"rekomendasi": teks, "provider": ai.provider, "model": ai.model})))
}
