use crate::ppra_bot::config::PpraBotConfig;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, CONTENT_TYPE, COOKIE, REFERER, USER_AGENT};
use serde_json::{json, Value};
use std::time::Duration;

pub struct PpraClient {
    http: reqwest::Client,
}

impl PpraClient {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .redirect(reqwest::redirect::Policy::limited(5))
            .build()
            .unwrap_or_default();
        Self { http }
    }

    fn build_headers(&self, cfg: &PpraBotConfig, referer: Option<&str>) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_str(&cfg.user_agent)
                .unwrap_or_else(|_| HeaderValue::from_static("Mozilla/5.0")),
        );
        headers.insert(
            ACCEPT,
            HeaderValue::from_static("text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"),
        );
        if let Some(r) = referer {
            if let Ok(val) = HeaderValue::from_str(r) {
                headers.insert(REFERER, val);
            }
        }

        let mut cookie_parts = Vec::new();
        if !cfg.cf_clearance.is_empty() {
            cookie_parts.push(format!("cf_clearance={}", cfg.cf_clearance));
        }
        if !cfg.session_cookie.is_empty() {
            cookie_parts.push(format!("ppra_session={}", cfg.session_cookie));
        }
        cookie_parts.push("language=english".to_string());

        if !cookie_parts.is_empty() {
            let cookie_str = cookie_parts.join("; ");
            if let Ok(val) = HeaderValue::from_str(&cookie_str) {
                headers.insert(COOKIE, val);
            }
        }
        headers
    }

    fn parse_captcha(&self, html: &str) -> Option<i64> {
        if let Some(pos) = html.find("class=\"captcha-question\"") {
            let rest = &html[pos..];
            if let Some(start) = rest.find('>') {
                let after_tag = &rest[start + 1..];
                if let Some(end) = after_tag.find('<') {
                    let question = after_tag[..end].trim();
                    let clean = question.replace('?', "").replace('=', "");
                    for op in ['+', '-', '*'] {
                        if clean.contains(op) {
                            let parts: Vec<&str> = clean.split(op).collect();
                            if parts.len() == 2 {
                                if let (Ok(a), Ok(b)) = (parts[0].trim().parse::<i64>(), parts[1].trim().parse::<i64>()) {
                                    return match op {
                                        '+' => Some(a + b),
                                        '-' => Some(a - b),
                                        '*' => Some(a * b),
                                        _ => None,
                                    };
                                }
                            }
                        }
                    }
                }
            }
        }
        None
    }

    fn extract_cookie(&self, resp: &reqwest::Response, name: &str) -> Option<String> {
        for val in resp.headers().get_all("set-cookie") {
            if let Ok(s) = val.to_str() {
                if let Some(pos) = s.find(&format!("{}=", name)) {
                    let cookie_sub = &s[pos + name.len() + 1..];
                    let end_pos = cookie_sub.find(';').unwrap_or(cookie_sub.len());
                    return Some(cookie_sub[..end_pos].trim().to_string());
                }
            }
        }
        None
    }

    pub async fn login(&self, cfg: &mut PpraBotConfig) -> Result<(), String> {
        let base = cfg.base_url.trim_end_matches('/');
        let login_url = format!("{}/administrator/login", base);

        // 1. GET Login Page untuk ambil cookie & captcha
        let headers = self.build_headers(cfg, None);
        let resp = self.http.get(&login_url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Koneksi ke halaman login PPRA gagal: {}", e))?;

        if let Some(sess) = self.extract_cookie(&resp, "ppra_session") {
            cfg.session_cookie = sess;
        }
        if let Some(cf) = self.extract_cookie(&resp, "cf_clearance") {
            cfg.cf_clearance = cf;
        }

        let html = resp.text().await.unwrap_or_default();
        let captcha_ans = self.parse_captcha(&html)
            .ok_or_else(|| "Gagal menemukan atau membaca captcha matematika pada halaman login PPRA.".to_string())?;

        // 2. POST Login Form
        let mut post_headers = self.build_headers(cfg, Some(&login_url));
        post_headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/x-www-form-urlencoded"));

        let params = [
            ("username", cfg.username.as_str()),
            ("password", cfg.password.as_str()),
            ("captcha_answer", &captcha_ans.to_string()),
        ];

        let post_resp = self.http.post(&login_url)
            .headers(post_headers)
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("Pengiriman form login PPRA gagal: {}", e))?;

        if let Some(sess) = self.extract_cookie(&post_resp, "ppra_session") {
            cfg.session_cookie = sess;
        }
        if let Some(cf) = self.extract_cookie(&post_resp, "cf_clearance") {
            cfg.cf_clearance = cf;
        }

        // 3. Verifikasi apakah login berhasil
        let dash_url = format!("{}/administrator/dashboard", base);
        let dash_headers = self.build_headers(cfg, Some(&login_url));
        let dash_resp = self.http.get(&dash_url)
            .headers(dash_headers)
            .send()
            .await
            .map_err(|e| format!("Verifikasi dashboard PPRA gagal: {}", e))?;

        let dash_body = dash_resp.text().await.unwrap_or_default();
        if dash_body.contains("Dashboard") || dash_body.contains("RL3 Pelayanan") || dash_body.contains("RL 3.19") {
            cfg.last_login = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
            let _ = cfg.save();
            Ok(())
        } else {
            Err("Autentikasi PPRA tidak berhasil (kredensial salah atau captcha tidak diterima portal).".to_string())
        }
    }

    async fn post_single_form(
        &self,
        cfg: &mut PpraBotConfig,
        endpoint: &str,
        referer: &str,
        fields: &[(String, String)],
    ) -> Result<Value, String> {
        let mut headers = self.build_headers(cfg, Some(referer));
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/x-www-form-urlencoded; charset=UTF-8"));
        headers.insert("X-Requested-With", HeaderValue::from_static("XMLHttpRequest"));
        headers.insert(ACCEPT, HeaderValue::from_static("application/json, text/javascript, */*; q=0.01"));

        let resp = self.http.post(endpoint)
            .headers(headers.clone())
            .form(fields)
            .send()
            .await
            .map_err(|e| format!("Pengiriman ke PPRA {} gagal: {}", endpoint, e))?;

        let body_text = resp.text().await.unwrap_or_default();

        // Cek sesi expired
        if body_text.contains("form_login") || body_text.contains("captcha-question") {
            self.login(cfg).await?;
            let mut retry_headers = self.build_headers(cfg, Some(referer));
            retry_headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/x-www-form-urlencoded; charset=UTF-8"));
            retry_headers.insert("X-Requested-With", HeaderValue::from_static("XMLHttpRequest"));
            retry_headers.insert(ACCEPT, HeaderValue::from_static("application/json, text/javascript, */*; q=0.01"));

            let retry_resp = self.http.post(endpoint)
                .headers(retry_headers)
                .form(fields)
                .send()
                .await
                .map_err(|e| format!("Retry POST ke PPRA {} gagal: {}", endpoint, e))?;

            let retry_body = retry_resp.text().await.unwrap_or_default();
            return Ok(hasil_portal(&retry_body));
        }

        Ok(hasil_portal(&body_text))
    }

    pub async fn delete_item(
        &self,
        cfg: &mut PpraBotConfig,
        form: &str,
        id: &str,
    ) -> Result<Value, String> {
        if cfg.session_cookie.is_empty() {
            self.login(cfg).await?;
        }

        let base = cfg.base_url.trim_end_matches('/');
        let form_clean = form.trim().to_lowercase();

        let table = match form_clean.as_str() {
            "3.19.1" | "1" | "kegiatan" => "t_ppra",
            "3.19.2" | "2" | "pasien_antibiotik" => "t_pasien_mendapatkan_antibiotik",
            "3.19.3" | "3" | "kuantitas" => "t_kuantitas_penggunaan_antibiotik_pasien",
            "3.19.4" | "4" | "gyssens" => "t_pengunaan_antibiotik",
            "3.19.5" | "5" | "pola_bakteri" => "t_pola_bakteri",
            "3.19.6" | "6" | "kepekaan" => "t_kepekaan_bakteri_v2",
            "3.19.7" | "7" | "mdro" => "t_mdro",
            "3.19.8" | "8" | "empirik" => "t_ab_siestemik_empirik",
            other => return Err(format!("Kode formulir PPRA tidak dikenali: {}", other)),
        };

        let endpoint = format!("{}/administrator/{}/delete/{}", base, table, id);
        let referer = format!("{}/administrator/{}", base, table);

        let headers = self.build_headers(cfg, Some(&referer));
        let resp = self.http.get(&endpoint)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Request delete ke PPRA gagal: {}", e))?;

        let status = resp.status().as_u16();
        Ok(json!({
            "success": status >= 200 && status < 400,
            "status_code": status,
            "message": format!("Item ID {} berhasil dihapus dari portal PPRA Kemenkes.", id),
            "id": id,
            "table": table
        }))
    }

    pub async fn submit(
        &self,
        cfg: &mut PpraBotConfig,
        form: &str,
        payload: &Value,
    ) -> Result<Value, String> {
        if cfg.session_cookie.is_empty() {
            self.login(cfg).await?;
        }

        let base = cfg.base_url.trim_end_matches('/');
        let form_clean = form.trim().to_lowercase();

        let (endpoint, referer) = match form_clean.as_str() {
            "3.19.1" | "1" | "kegiatan" => (
                format!("{}/administrator/t_ppra/add_save", base),
                format!("{}/administrator/t_ppra/add", base),
            ),
            "3.19.2" | "2" | "pasien_antibiotik" => (
                format!("{}/administrator/t_pasien_mendapatkan_antibiotik/add_save", base),
                format!("{}/administrator/t_pasien_mendapatkan_antibiotik/add", base),
            ),
            "3.19.3" | "3" | "kuantitas" => (
                format!("{}/administrator/t_kuantitas_penggunaan_antibiotik_pasien/add_save", base),
                format!("{}/administrator/t_kuantitas_penggunaan_antibiotik_pasien/add", base),
            ),
            "3.19.4" | "4" | "gyssens" => (
                format!("{}/administrator/t_pengunaan_antibiotik/add_save", base),
                format!("{}/administrator/t_pengunaan_antibiotik/add", base),
            ),
            "3.19.5" | "5" | "pola_bakteri" => (
                format!("{}/administrator/t_pola_bakteri/add_save", base),
                format!("{}/administrator/t_pola_bakteri/add", base),
            ),
            "3.19.6" | "6" | "kepekaan" => (
                format!("{}/administrator/t_kepekaan_bakteri_v2/add_save", base),
                format!("{}/administrator/t_kepekaan_bakteri_v2/add", base),
            ),
            "3.19.7" | "7" | "mdro" => (
                format!("{}/administrator/t_mdro/add_save", base),
                format!("{}/administrator/t_mdro/add", base),
            ),
            "3.19.8" | "8" | "empirik" => (
                format!("{}/administrator/t_ab_siestemik_empirik/add_save", base),
                format!("{}/administrator/t_ab_siestemik_empirik/add", base),
            ),
            other => return Err(format!("Kode formulir PPRA tidak dikenali: {}", other)),
        };

        // ── Penanganan Khusus Sub-Laporan 3.19.2 (Pasien Mendapatkan Antibiotik) ──
        if form_clean == "3.19.2" || form_clean == "2" || form_clean == "pasien_antibiotik" {
            let tahun = payload.get("tahun").and_then(|v| v.as_str()).unwrap_or("2024");
            let triwulan_raw = payload.get("triwulan").and_then(|v| v.as_str()).unwrap_or("1");
            let periode = format!("Triwulan {}", triwulan_raw);
            let rawat_raw = payload.get("rawat").and_then(|v| v.as_str()).unwrap_or("2");
            let id_rawat = if rawat_raw == "Rawat Jalan" || rawat_raw == "1" { "1" } else { "2" };

            let poliklinik = payload.get("poliklinik").and_then(|v| v.as_array());
            let poliklinik_sebutkan = payload.get("poliklinik_sebutkan").and_then(|v| v.as_array());
            let jumlah_sampel = payload.get("jumlah_sampel").and_then(|v| v.as_array());
            let jumlah_pasien_antibiotik = payload.get("jumlah_pasien_antibiotik").and_then(|v| v.as_array());

            if let (Some(polis), Some(sampels), Some(abs)) = (poliklinik, jumlah_sampel, jumlah_pasien_antibiotik) {
                let n = polis.len().min(sampels.len()).min(abs.len());
                let mut results = Vec::new();
                let mut saved_count = 0;

                for i in 0..n {
                    let smf_id = polis[i].as_str().unwrap_or("1");
                    let smf_drop = match smf_id {
                        "1" => "1",
                        "2" => "2",
                        "3" => "3",
                        "4" => "4",
                        "5" => "5",
                        _ => "6",
                    };
                    // Untuk dropdown 6 (Lain-lain), portal membedakan tiap unit lewat
                    // kolom "sebutkan". Pakai label yang dikirim dari Java (mis. "IGD",
                    // "Lain-lain", "Pulmonologi..."); fallback "Lain-lain" bila kosong.
                    let smf_sebutkan: String = if smf_drop == "6" {
                        let s = poliklinik_sebutkan
                            .and_then(|a| a.get(i))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .trim()
                            .to_string();
                        if s.is_empty() { "Lain-lain".to_string() } else { s }
                    } else {
                        String::new()
                    };
                    let sampel = sampels[i].as_i64().unwrap_or(0);
                    let ab = abs[i].as_i64().unwrap_or(0);
                    let persen = if sampel > 0 { format!("{:.2}", (ab as f64 / sampel as f64) * 100.0) } else { "0.00".to_string() };

                    let form_fields = vec![
                        ("tahun".to_string(), tahun.to_string()),
                        ("periode_pengambilan_data".to_string(), periode.clone()),
                        ("id_jenis_perawatan".to_string(), id_rawat.to_string()),
                        ("id_smf_instalasi_poliklinik".to_string(), smf_drop.to_string()),
                        ("id_smf_instalasi_poliklinik_sebutkan".to_string(), smf_sebutkan.to_string()),
                        ("jumlah_sampel_periode_survei".to_string(), sampel.to_string()),
                        ("pasien_mendapatkan_antibiotik_jumlah".to_string(), ab.to_string()),
                        ("pasien_mendapatkan_antibiotik_persen".to_string(), persen),
                        ("save_type".to_string(), "stay".to_string()),
                    ];

                    let post_res = self.post_single_form(cfg, &endpoint, &referer, &form_fields).await;
                    match post_res {
                        Ok(val) => {
                            if val.get("success").and_then(|s| s.as_bool()).unwrap_or(false) {
                                saved_count += 1;
                            }
                            results.push(val);
                        },
                        Err(e) => {
                            results.push(json!({"success": false, "error": e, "smf": smf_id}));
                        }
                    }
                }

                return Ok(json!({
                    "success": saved_count > 0,
                    "saved_count": saved_count,
                    "total_rows": n,
                    "message": format!("Berhasil mengirim {} dari {} data SMF ke portal PPRA Kemenkes.", saved_count, n),
                    "details": results
                }));
            }
        }

        // ── Penanganan Default / Sub-Laporan Lainnya ──
        let mut form_fields: Vec<(String, String)> = Vec::new();
        if let Some(obj) = payload.as_object() {
            for (key, val) in obj {
                match val {
                    Value::Array(arr) => {
                        let field_name = if key.ends_with("[]") { key.clone() } else { format!("{}[]", key) };
                        for item in arr {
                            let s = match item {
                                Value::String(st) => st.clone(),
                                Value::Number(num) => num.to_string(),
                                Value::Bool(b) => if *b { "1".to_string() } else { "0".to_string() },
                                _ => item.to_string(),
                            };
                            form_fields.push((field_name.clone(), s));
                        }
                    }
                    Value::String(st) => form_fields.push((key.clone(), st.clone())),
                    Value::Number(num) => form_fields.push((key.clone(), num.to_string())),
                    Value::Bool(b) => form_fields.push((key.clone(), if *b { "1".to_string() } else { "0".to_string() })),
                    _ => form_fields.push((key.clone(), val.to_string())),
                }
            }
        }

        if !form_fields.iter().any(|(k, _)| k == "save_type") {
            form_fields.push(("save_type".to_string(), "stay".to_string()));
        }

        self.post_single_form(cfg, &endpoint, &referer, &form_fields).await
    }
}

/// Respons add_save portal berupa JSON {"success": .., "message": ..}. Respons lain (halaman
/// HTML login/error/Cloudflare) dulu dianggap sukses, sehingga petugas mengira laporan terkirim
/// padahal portal tidak menyimpannya. Sekarang hanya JSON dengan success=true yang dianggap sukses.
fn hasil_portal(body: &str) -> Value {
    match serde_json::from_str::<Value>(body) {
        Ok(v) if v.get("success").is_some() => v,
        Ok(v) => json!({"success": false, "message": "Respons portal tanpa status success", "raw_response": v}),
        Err(_) => {
            let cuplikan: String = body.chars().take(300).collect();
            json!({
                "success": false,
                "message": "Respons portal bukan JSON (kemungkinan sesi habis, captcha/Cloudflare, atau error portal)",
                "raw_response": cuplikan
            })
        }
    }
}
