// Klien API resmi SIMGPS (Host-to-Host REST, gps-inventory.com/api/v1).
// Bearer token. Kerangka: config + test + tarik (pull) + kirim (push).
// Dok: ~/Downloads/Web Service API SIMGPS RSUD Cabang Bungin.pdf.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};

fn err(code: StatusCode, msg: impl Into<String>) -> (StatusCode, Json<Value>) {
    (code, Json(json!({"error": msg.into()})))
}
fn adminonly(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if u.0.is_admin { Ok(()) } else { Err(err(StatusCode::FORBIDDEN, "Hanya admin")) }
}
async fn get_cfg(pool: &sqlx::MySqlPool, key: &str, default: &str) -> String {
    crate::handlers::simrscb::get_cfg(pool, key, default).await
}
async fn set_cfg(pool: &sqlx::MySqlPool, key: &str, val: &str) {
    let _ = sqlx::query("INSERT INTO simrscb_config (kunci, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai=VALUES(nilai), updated_at=NOW()")
        .bind(key).bind(val).execute(pool).await;
}

const DEFAULT_BASE: &str = "https://rsudcabangbungin.gps-inventory.com/api/v1";
const DEFAULT_LOGIN: &str = "https://rsudcabangbungin.gps-inventory.com/api/login";

// ── Klien ────────────────────────────────────────────────────────────────────
struct Client { base: String, token: String, http: reqwest::Client }
impl Client {
    // Login ke SIMGPS: POST email+password → token di content.access_token.
    async fn login(http: &reqwest::Client, login_url: &str, email: &str, password: &str)
      -> Result<(String, String), String> {
        let r = http.post(login_url).header("Accept", "application/json")
            .form(&[("email", email), ("password", password)]).send().await.map_err(|e| e.to_string())?;
        let txt = r.text().await.map_err(|e| e.to_string())?;
        let v: Value = serde_json::from_str(&txt)
            .map_err(|_| format!("respons login bukan JSON: {}", txt.chars().take(120).collect::<String>()))?;
        let token = v.pointer("/content/access_token").and_then(|x| x.as_str())
            .ok_or_else(|| format!("login gagal: {}", v.get("msg").and_then(|x| x.as_str()).unwrap_or("access_token tidak ditemukan")))?;
        let name = v.get("user_name").and_then(|x| x.as_str()).unwrap_or("").to_string();
        Ok((token.to_string(), name))
    }

    async fn from_cfg(pool: &sqlx::MySqlPool) -> Result<Self, (StatusCode, Json<Value>)> {
        let base = get_cfg(pool, "simgps_api_base", DEFAULT_BASE).await;
        let mut token = get_cfg(pool, "simgps_api_token", "").await;
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build().map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, format!("http: {e}")))?;
        // Token kosong → coba auto-login bila email & password tersimpan.
        if token.trim().is_empty() {
            let email = get_cfg(pool, "simgps_api_email", "").await;
            let password = get_cfg(pool, "simgps_api_password", "").await;
            if email.trim().is_empty() || password.is_empty() {
                return Err(err(StatusCode::BAD_REQUEST, "Token/kredensial SIMGPS belum diatur. Isi email & password lalu klik Login di menu Integrasi SIMGPS."));
            }
            let login_url = get_cfg(pool, "simgps_login_url", DEFAULT_LOGIN).await;
            let (tok, _name) = Self::login(&http, &login_url, &email, &password).await
                .map_err(|e| err(StatusCode::BAD_GATEWAY, format!("Auto-login SIMGPS gagal: {e}")))?;
            set_cfg(pool, "simgps_api_token", &tok).await;
            token = tok;
        }
        Ok(Client { base: base.trim_end_matches('/').to_string(), token, http })
    }
    fn url(&self, path: &str) -> String { format!("{}/{}", self.base, path.trim_start_matches('/')) }

    async fn get(&self, path: &str) -> Result<Value, String> {
        let r = self.http.get(self.url(path)).bearer_auth(&self.token)
            .header("Accept", "application/json").send().await.map_err(|e| e.to_string())?;
        let status = r.status();
        let txt = r.text().await.map_err(|e| e.to_string())?;
        serde_json::from_str::<Value>(&txt)
            .map_err(|_| format!("HTTP {} — respons bukan JSON (mungkin token salah / redirect login): {}", status, &txt.chars().take(120).collect::<String>()))
    }
    async fn post_form(&self, path: &str, form: &[(&str, String)]) -> Result<Value, String> {
        let r = self.http.post(self.url(path)).bearer_auth(&self.token)
            .header("Accept", "application/json").form(form).send().await.map_err(|e| e.to_string())?;
        let status = r.status();
        let txt = r.text().await.map_err(|e| e.to_string())?;
        serde_json::from_str::<Value>(&txt)
            .map_err(|_| format!("HTTP {} — respons bukan JSON: {}", status, &txt.chars().take(120).collect::<String>()))
    }
}
// Ambil array `datas` dari respons (bisa object tunggal atau array).
fn datas_array(v: &Value) -> Vec<Value> {
    match v.get("datas") {
        Some(Value::Array(a)) => a.clone(),
        Some(Value::Object(_)) => vec![v["datas"].clone()],
        _ => vec![],
    }
}

// ── Config (admin) ───────────────────────────────────────────────────────────
pub async fn config_get(u: AuthUser, State(s): State<AppState>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    let base = get_cfg(&s.pool, "simgps_api_base", DEFAULT_BASE).await;
    let token = get_cfg(&s.pool, "simgps_api_token", "").await;
    let email = get_cfg(&s.pool, "simgps_api_email", "").await;
    let has_pass = !get_cfg(&s.pool, "simgps_api_password", "").await.is_empty();
    Ok(Json(json!({"base": base, "email": email, "has_password": has_pass,
        "has_token": !token.trim().is_empty(),
        "token_preview": if token.len() > 8 { format!("{}…{}", &token[..4], &token[token.len()-4..]) } else if token.is_empty() { "".into() } else { "••••".into() }})))
}
#[derive(Deserialize)]
pub struct ConfigBody {
    #[serde(default)] pub base: Option<String>,
    #[serde(default)] pub token: Option<String>,
    #[serde(default)] pub email: Option<String>,
    #[serde(default)] pub password: Option<String>,
}
pub async fn config_set(u: AuthUser, State(s): State<AppState>, Json(b): Json<ConfigBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    if let Some(base) = b.base.filter(|x| !x.trim().is_empty()) { set_cfg(&s.pool, "simgps_api_base", base.trim()).await; }
    if let Some(token) = b.token { set_cfg(&s.pool, "simgps_api_token", token.trim()).await; }
    if let Some(email) = b.email { set_cfg(&s.pool, "simgps_api_email", email.trim()).await; }
    if let Some(password) = b.password.filter(|x| !x.is_empty()) { set_cfg(&s.pool, "simgps_api_password", &password).await; }
    Ok(Json(json!({"ok": true})))
}

// ── Login manual (admin): ambil token baru dari email+password, simpan ───────
pub async fn login(u: AuthUser, State(s): State<AppState>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    let email = get_cfg(&s.pool, "simgps_api_email", "").await;
    let password = get_cfg(&s.pool, "simgps_api_password", "").await;
    if email.trim().is_empty() || password.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "Isi & simpan email dan password SIMGPS dulu."));
    }
    let login_url = get_cfg(&s.pool, "simgps_login_url", DEFAULT_LOGIN).await;
    let http = reqwest::Client::builder().timeout(std::time::Duration::from_secs(30))
        .build().map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, format!("http: {e}")))?;
    match Client::login(&http, &login_url, &email, &password).await {
        Ok((tok, name)) => {
            set_cfg(&s.pool, "simgps_api_token", &tok).await;
            crate::audit::log_sql(&s.pool, &u.0.kode, "SIMGPS login (token diperbarui)").await;
            Ok(Json(json!({"ok": true, "user_name": name, "message": "Login berhasil, token tersimpan."})))
        }
        Err(e) => Err(err(StatusCode::BAD_GATEWAY, e)),
    }
}

// ── Test koneksi (admin) ─────────────────────────────────────────────────────
pub async fn test(u: AuthUser, State(s): State<AppState>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    let c = Client::from_cfg(&s.pool).await?;
    match c.get("room/lists").await {
        Ok(v) => Ok(Json(json!({"ok": true, "status": v.get("status"), "message": v.get("message"), "jumlah_ruangan": datas_array(&v).len()}))),
        Err(e) => Err(err(StatusCode::BAD_GATEWAY, e)),
    }
}

// ── TARIK (pull): master + aset non-medis/sparepart/tools → simrscb ───────────
#[derive(Deserialize)]
pub struct PullQuery { #[serde(default)] pub apply: Option<String> }
pub async fn pull(u: AuthUser, State(s): State<AppState>, Query(q): Query<PullQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    let c = Client::from_cfg(&s.pool).await?;
    let apply = q.apply.as_deref() == Some("1");

    // Master (untuk info + mapping)
    let rooms = c.get("room/lists").await.map(|v| datas_array(&v)).unwrap_or_default();
    let brands = c.get("brand/lists").await.map(|v| datas_array(&v)).unwrap_or_default();

    // Aset non-medis/sparepart/tools
    let mut ringkas = serde_json::Map::new();
    let mut total_new = 0i64;
    let mut total_upd = 0i64;
    for (path, kategori) in [
        ("asset/list_non_medis", "Non-Medis/IT"),
        ("asset/list_sparepart_disposible", "Sparepart"),
        ("asset/list_tools_meter", "Tools"),
    ] {
        let items = c.get(path).await.map(|v| datas_array(&v)).unwrap_or_default();
        ringkas.insert(path.to_string(), json!(items.len()));
        if apply {
            for it in &items {
                let sid = it.get("id").and_then(|x| x.as_i64());
                let barcode = it.get("barcode").and_then(|x| x.as_str()).unwrap_or("").trim().to_string();
                let nama = it.get("nama_alat").and_then(|x| x.as_str()).unwrap_or("").trim().to_string();
                let merk = it.get("merk").and_then(|x| x.as_str()).unwrap_or("").trim().to_string();
                let model = it.get("model").and_then(|x| x.as_str()).unwrap_or("").trim().to_string();
                let ruangan = it.get("ruangan").and_then(|x| x.as_str()).unwrap_or("").trim().to_string();
                let gedung = it.get("gedung").and_then(|x| x.as_str()).unwrap_or("").trim().to_string();
                if nama.is_empty() { continue; }
                // Match by simgps_id dulu, lalu barcode
                let existing: Option<(i64,)> = if let Some(id) = sid {
                    sqlx::query_as("SELECT id FROM simrscb_inventaris WHERE simgps_id=? LIMIT 1").bind(id).fetch_optional(&s.pool).await.ok().flatten()
                } else { None };
                let existing = match existing {
                    Some(x) => Some(x),
                    None if !barcode.is_empty() => sqlx::query_as::<_, (i64,)>("SELECT id FROM simrscb_inventaris WHERE barcode=? LIMIT 1").bind(&barcode).fetch_optional(&s.pool).await.ok().flatten(),
                    None => None,
                };
                match existing {
                    Some((id,)) => {
                        let _ = sqlx::query("UPDATE simrscb_inventaris SET simgps_id=?, nama_alat=?, barcode=?, merk=?, model=?, ruangan=?, gedung=?, kategori=? WHERE id=?")
                            .bind(sid).bind(&nama).bind(&barcode).bind(&merk).bind(&model).bind(&ruangan).bind(&gedung).bind(kategori).bind(id).execute(&s.pool).await;
                        total_upd += 1;
                    }
                    None => {
                        let _ = sqlx::query("INSERT INTO simrscb_inventaris (simgps_id, nama_alat, barcode, merk, model, ruangan, gedung, kategori, status_laik, kondisi) VALUES (?,?,?,?,?,?,?,?,'Laik','Baik')")
                            .bind(sid).bind(&nama).bind(&barcode).bind(&merk).bind(&model).bind(&ruangan).bind(&gedung).bind(kategori).execute(&s.pool).await;
                        total_new += 1;
                    }
                }
            }
        }
    }
    Ok(Json(json!({
        "ok": true, "apply": apply,
        "master": {"ruangan": rooms.len(), "brand": brands.len()},
        "aset_ditemukan": ringkas,
        "baru": total_new, "diperbarui": total_upd,
        "catatan": if apply { "Data non-medis/sparepart/tools disinkron ke simrscb_inventaris." } else { "Pratinjau saja — tamb/ ?apply=1 untuk menerapkan." }
    })))
}

// ── KIRIM (push): passthrough ke endpoint SIMGPS ─────────────────────────────
// Body = payload sesuai dok SIMGPS (field mentah). resource menentukan endpoint.
fn resource_path(resource: &str) -> Option<&'static str> {
    Some(match resource {
        "asset" => "asset/store",
        "kalibrasi" => "record/store",
        "complain" => "complain-repair/store_complain",
        "response" => "complain-repair/store_response",
        "mutasi" => "mutasi/store",
        "mutasi-approve" => "mutasi/approve",
        "mutasi-update" => "mutasi/update",
        "device" => "device/store",
        "identity" => "identity/store",
        "room" => "room/store",
        "brand" => "brand/store",
        "ownership" => "ownership/store",
        "source-of-funds" => "source_of_funds/store",
        _ => return None,
    })
}
pub async fn push(u: AuthUser, State(s): State<AppState>, Path(resource): Path<String>, Json(body): Json<Value>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    let path = resource_path(&resource).ok_or_else(|| err(StatusCode::BAD_REQUEST, format!("resource '{}' tidak dikenal", resource)))?;
    let c = Client::from_cfg(&s.pool).await?;
    // body object → form fields (string)
    let form: Vec<(&str, String)> = match body.as_object() {
        Some(m) => m.iter().map(|(k, v)| (k.as_str(), match v { Value::String(x) => x.clone(), _ => v.to_string() })).collect(),
        None => return Err(err(StatusCode::BAD_REQUEST, "body harus objek JSON")),
    };
    match c.post_form(path, &form).await {
        Ok(v) => {
            crate::audit::log_sql(&s.pool, &u.0.kode, &format!("SIMGPS push {} → {:?}", resource, v.get("status"))).await;
            Ok(Json(v))
        }
        Err(e) => Err(err(StatusCode::BAD_GATEWAY, e)),
    }
}

// ── Kirim aset dari simrscb (bangun payload + resolusi id master) ─────────────
pub async fn push_asset_from_inventaris(u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    adminonly(&u)?;
    let c = Client::from_cfg(&s.pool).await?;
    let a: Option<(String, String, String, String, String, String)> = sqlx::query_as(
        "SELECT IFNULL(nama_alat,''), IFNULL(barcode,''), IFNULL(no_seri,''), IFNULL(merk,''), IFNULL(ruangan,''), IFNULL(kategori,'') FROM simrscb_inventaris WHERE id=?"
    ).bind(id).fetch_optional(&s.pool).await.map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let (nama, barcode, serial, _merk, ruangan, kategori) = a.ok_or_else(|| err(StatusCode::NOT_FOUND, "Aset tidak ditemukan"))?;

    // resolusi room_id & device_id dari master (match nama)
    let rooms = c.get("room/lists").await.map(|v| datas_array(&v)).unwrap_or_default();
    let room_id = rooms.iter().find(|r| r.get("room_name").and_then(|x| x.as_str()).map(|n| n.eq_ignore_ascii_case(ruangan.trim())).unwrap_or(false))
        .and_then(|r| r.get("id").and_then(|x| x.as_i64()));
    let devices = c.get("device/lists_medis").await.map(|v| datas_array(&v)).unwrap_or_default();
    let device_id = devices.iter().find(|d| d.get("standard_name").and_then(|x| x.as_str()).map(|n| n.eq_ignore_ascii_case(nama.trim())).unwrap_or(false))
        .and_then(|d| d.get("id").and_then(|x| x.as_i64()));

    let typ = match kategori.as_str() {
        "Medis" => "Medical Equipment", "Tools" => "Tools & Meter", "Sparepart" => "Sparepart & Disposable",
        _ => "Non Medical Equipment",
    };
    let mut form: Vec<(&str, String)> = vec![
        ("barcode", barcode), ("serial", serial), ("type", typ.to_string()), ("risk_level", "Low Risk".to_string()),
    ];
    if let Some(rid) = room_id { form.push(("room_id", rid.to_string())); }
    if let Some(did) = device_id { form.push(("device_id", did.to_string())); }

    if room_id.is_none() || device_id.is_none() {
        return Err(err(StatusCode::BAD_REQUEST, format!(
            "Tidak bisa memetakan ke SIMGPS: {}{}. Buat dulu master-nya di SIMGPS atau lengkapi (device_id/room_id).",
            if device_id.is_none() { format!("nama alat '{}' belum ada di master SIMGPS", nama) } else { String::new() },
            if room_id.is_none() { format!("{}ruangan '{}' belum ada di master SIMGPS", if device_id.is_none() {"; "} else {""}, ruangan) } else { String::new() },
        )));
    }
    match c.post_form("asset/store", &form).await {
        Ok(v) => { crate::audit::log_sql(&s.pool, &u.0.kode, &format!("SIMGPS push asset inv={}", id)).await; Ok(Json(v)) }
        Err(e) => Err(err(StatusCode::BAD_GATEWAY, e)),
    }
}
