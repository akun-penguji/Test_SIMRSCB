use crate::sirs_bot::config::SirsBotConfig;
use crate::sirs_bot::validator::{validate_rl32, validate_rl33, validate_rl35};
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, CONTENT_TYPE, COOKIE, ORIGIN, REFERER, USER_AGENT};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::Duration;

// RL 4.1 (rawat inap) dan RL 5.1 (rawat jalan) masing-masing punya kamus ICD-10
// sendiri di Kemenkes dengan ID yang TIDAK saling cocok — "A09" di rawat inap
// bisa punya id berbeda dari "A09" di rawat jalan. Dua cache terpisah, berumur
// selama proses backend hidup (kode ICD yang sama terus terpakai tiap bulan).
static ICD_INAP_CACHE: LazyLock<Mutex<HashMap<String, i64>>> = LazyLock::new(|| Mutex::new(HashMap::new()));
static ICD_RAJAL_CACHE: LazyLock<Mutex<HashMap<String, i64>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

const USER_AGENT_STR: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

pub struct SirsClient {
    http: reqwest::Client,
}


fn map_rl38_id(kode: &str) -> Option<i64> {
    match kode {
        "1.1" => Some(1), "1.2" => Some(2), "1.3" => Some(3), "1.4" => Some(4),
        "1.5" => Some(5), "1.6" => Some(6), "1.7" => Some(7), "1.8" => Some(8), "1.9" => Some(9),
        "2.1" => Some(10), "2.2" => Some(11), "2.3" => Some(12), "2.4" => Some(13),
        "2.5" => Some(14), "2.6" => Some(15), "2.7" => Some(16), "2.8" => Some(17),
        "2.9" => Some(18), "2.10" => Some(19), "2.11" => Some(20), "2.12" => Some(21),
        "2.13" => Some(22), "2.14" => Some(23), "2.15" => Some(24), "2.16" => Some(25),
        "2.17" => Some(26), "2.18" => Some(27), "2.19" => Some(28), "2.20" => Some(29),
        "2.21" => Some(30), "2.22" => Some(31), "2.23" => Some(32), "2.24" => Some(33),
        "2.25" => Some(34), "2.26" => Some(35),
        "3.1" => Some(36), "3.2" => Some(37), "3.3" => Some(38), "3.4" => Some(39),
        "3.5" => Some(40), "3.6" => Some(41), "3.7" => Some(42), "3.8" => Some(43),
        "3.9" => Some(44), "3.10" => Some(45), "3.11" => Some(46), "3.12" => Some(47),
        "3.13" => Some(48), "3.14" => Some(49), "3.15" => Some(50), "3.16" => Some(51),
        "3.17" => Some(52),
        "4.1" => Some(53), "4.2" => Some(54), "4.3" => Some(55), "4.4" => Some(56), "4.5" => Some(57),
        "5.1" => Some(58), "5.2" => Some(59), "5.3" => Some(60), "5.4" => Some(61),
        "5.5" => Some(62), "5.6" => Some(63), "5.7" => Some(64), "5.8" => Some(65),
        "6.1" => Some(66), "6.2" => Some(67), "6.3" => Some(68), "6.4" => Some(69),
        "6.5" => Some(70), "6.6" => Some(71),
        "7" | "7.1" => Some(72),
        "8" | "8.1" => Some(73),
        "9" | "9.1" => Some(74),
        "10.1" => Some(75), "10.2" => Some(76), "10.3" => Some(77), "10.4" => Some(78),
        "10.5" => Some(79), "10.6" => Some(80),
        "11.1" => Some(81), "11.2" => Some(82), "11.3" => Some(83), "11.4" => Some(84),
        "11.5" => Some(85), "11.6" => Some(86), "11.7" => Some(87), "11.8" => Some(88),
        "12.1" => Some(89), "12.2" => Some(90), "12.3" => Some(91), "12.4" => Some(92),
        "12.5" => Some(93), "12.6" => Some(94),
        "13.1" => Some(95), "13.2" => Some(96), "13.3" => Some(97), "13.4" => Some(98),
        "13.5" => Some(99), "13.6" => Some(100),
        "14.1" => Some(101), "14.2" => Some(102), "14.3" => Some(103), "14.4" => Some(104),
        "14.5" => Some(105), "14.6" => Some(106),
        "15.1" => Some(107), "15.2" => Some(108), "15.3" => Some(109), "15.4" => Some(110),
        "16.1" => Some(111), "16.2" => Some(112), "16.3" => Some(113), "16.4" => Some(114),
        "16.5" => Some(115), "16.6" => Some(116), "16.7" => Some(117),
        "17" | "17.1" => Some(118),
        "18.1" => Some(120), "18.2" => Some(121), "18.3" => Some(122),
        "19.1" => Some(123), "19.2" => Some(124), "19.3" => Some(125),
        "20.1" => Some(126), "20.2" => Some(127), "20.3" => Some(128), "20.4" => Some(129),
        "20.5" => Some(130),
        "21.1" => Some(131), "21.2" => Some(132), "21.3" => Some(133), "21.4" => Some(134),
        "21.5" => Some(135), "21.6" => Some(136), "21.7" => Some(137),
        "22" | "22.1" => Some(138),
        _ => None,
    }
}


fn map_rl39_id(kode: &str) -> Option<i64> {
    match kode {
        "1.1" => Some(1), "1.2" => Some(2), "1.3" => Some(3), "1.4" => Some(4),
        "1.5" => Some(5), "1.6" => Some(6), "1.7" => Some(7), "1.8" => Some(8), "1.9" => Some(9),
        "2.1" => Some(10), "2.2" => Some(11), "2.3" => Some(12), "2.4" => Some(13),
        "3.1" => Some(14), "3.2" => Some(15), "3.3" => Some(16),
        "4.1" => Some(17), "4.2" => Some(18), "4.3" => Some(19),
        _ => None,
    }
}

impl SirsClient {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .unwrap_or_default();
        Self { http }
    }

    /// Login SSO Yankes Kemenkes dan tukar token ke sesi SIRS 6
    pub async fn login_sso(
        &self,
        cfg: &mut SirsBotConfig,
        email: &str,
        password: &str,
    ) -> Result<Value, String> {
        // 1. Post login ke akun-yankes.kemkes.go.id
        let sso_url = format!("{}/sso/v1/login", cfg.sso_url.trim_end_matches('/'));
        let login_body = json!({
            "email": email,
            "password": password,
        });

        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(ACCEPT, HeaderValue::from_static("application/json, text/plain, */*"));
        headers.insert(ORIGIN, HeaderValue::from_static("https://akun-yankes.kemkes.go.id"));
        headers.insert(REFERER, HeaderValue::from_static("https://akun-yankes.kemkes.go.id/?continued=https://sirs6.kemkes.go.id/v3/"));
        headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_STR));

        let res = self.http.post(&sso_url)
            .headers(headers)
            .json(&login_body)
            .send().await
            .map_err(|e| format!("Koneksi login SSO Yankes gagal: {}", e))?;

        let status = res.status();
        let sso_val: Value = res.json().await
            .map_err(|e| format!("Gagal membaca response SSO: {}", e))?;

        if !status.is_success() || !sso_val.get("status").and_then(|v| v.as_bool()).unwrap_or(false) {
            let msg = sso_val.get("message").and_then(|v| v.as_str()).unwrap_or("Login SSO ditolak");
            return Err(format!("Login SSO gagal (HTTP {}): {}", status, msg));
        }

        let sso_token = sso_val.get("token").and_then(|v| v.as_str())
            .ok_or_else(|| "Token login SSO kosong".to_string())?;

        // 2. Tukar token SSO ke session SIRS 6
        let exchange_url = format!("{}/login?token={}", cfg.sirs_base_url.trim_end_matches('/'), sso_token);
        let mut ex_headers = HeaderMap::new();
        ex_headers.insert(ACCEPT, HeaderValue::from_static("application/json, text/plain, */*"));
        ex_headers.insert(REFERER, HeaderValue::from_static("https://sirs6.kemkes.go.id/v3/"));
        ex_headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_STR));

        let ex_res = self.http.get(&exchange_url)
            .headers(ex_headers)
            .send().await
            .map_err(|e| format!("Koneksi pertukaran token SIRS 6 gagal: {}", e))?;

        // Ekstrak Set-Cookie refreshToken
        let mut refresh_token = String::new();
        for cookie in ex_res.headers().get_all(reqwest::header::SET_COOKIE) {
            if let Ok(c_str) = cookie.to_str() {
                if c_str.starts_with("refreshToken=") {
                    if let Some(val) = c_str.split(';').next() {
                        refresh_token = val.trim_start_matches("refreshToken=").to_string();
                    }
                }
            }
        }

        let ex_status = ex_res.status();
        let ex_val: Value = ex_res.json().await
            .map_err(|e| format!("Gagal membaca response pertukaran token: {}", e))?;

        if !ex_status.is_success() || !ex_val.get("status").and_then(|v| v.as_bool()).unwrap_or(false) {
            let msg = ex_val.get("message").and_then(|v| v.as_str()).unwrap_or("Pertukaran token ditolak");
            return Err(format!("Gagal menukar token SIRS (HTTP {}): {}", ex_status, msg));
        }

        let access_token = ex_val.pointer("/data/access_token")
            .and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let csrf_token = ex_val.pointer("/data/csrfToken")
            .and_then(|v| v.as_str()).unwrap_or_default().to_string();

        if access_token.is_empty() {
            return Err("Access token SIRS kosong dari Kemenkes".to_string());
        }

        cfg.access_token = access_token;
        if !refresh_token.is_empty() {
            cfg.refresh_token = refresh_token;
        }
        if !csrf_token.is_empty() {
            cfg.xsrf_token = csrf_token;
        }
        cfg.email = email.to_string();
        cfg.password = password.to_string();
        let _ = cfg.save();

        // Ambil info profil RS jika kode_rs terisi
        let hosp_info = if !cfg.kode_rs.is_empty() {
            self.get_hospital_info(cfg, &cfg.kode_rs).await.ok()
        } else {
            None
        };

        Ok(json!({
            "status": true,
            "message": "Login SSO dan pertukaran token SIRS 6 berhasil",
            "hospital_info": hosp_info
        }))
    }

    /// Refresh token memanggil /token untuk memperbarui access_token
    pub async fn refresh_token(&self, cfg: &mut SirsBotConfig) -> Result<String, String> {
        let token_url = format!("{}/token", cfg.sirs_base_url.trim_end_matches('/'));

        let cookie_str = format!(
            "refreshToken={}; cf_clearance={}; XSRF-TOKEN={}",
            cfg.refresh_token, cfg.cf_clearance, cfg.xsrf_token
        );

        let mut headers = HeaderMap::new();
        headers.insert(ACCEPT, HeaderValue::from_static("application/json, text/plain, */*"));
        headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_STR));
        headers.insert(REFERER, HeaderValue::from_static("https://sirs6.kemkes.go.id/v3/"));
        if let Ok(v) = HeaderValue::from_str(&cookie_str) {
            headers.insert(COOKIE, v);
        }
        if !cfg.xsrf_token.is_empty() {
            if let Ok(v) = HeaderValue::from_str(&cfg.xsrf_token) {
                headers.insert("XSRF-TOKEN", v);
            }
        }

        let res = self.http.get(&token_url)
            .headers(headers)
            .send().await
            .map_err(|e| format!("Koneksi refresh token SIRS gagal: {}", e))?;

        let status = res.status();
        let val: Value = res.json().await
            .map_err(|e| format!("Gagal parse response refresh token: {}", e))?;

        if !status.is_success() {
            return Err(format!("Gagal refresh token (HTTP {}): {}", status, val));
        }

        if let Some(new_token) = val.get("accessToken").or_else(|| val.pointer("/data/accessToken")).and_then(|v| v.as_str()) {
            cfg.access_token = new_token.to_string();
            let _ = cfg.save();
            return Ok(new_token.to_string());
        }

        Err("Response refresh token tidak mengandung accessToken".to_string())
    }

    /// Mengambil profil rumah sakit dari SIRS Kemenkes
    pub async fn get_hospital_info(&self, cfg: &SirsBotConfig, satker_id: &str) -> Result<Value, String> {
        let endpoint = format!("/rumahsakit/{}", satker_id);
        self.do_request(cfg, "GET", &endpoint, None).await
    }

    /// Request internal dengan autentikasi dan cookie
    pub async fn do_request(
        &self,
        cfg: &SirsBotConfig,
        method: &str,
        endpoint: &str,
        body: Option<&Value>,
    ) -> Result<Value, String> {
        let url = format!("{}{}", cfg.sirs_base_url.trim_end_matches('/'), endpoint);

        let cookie_str = format!(
            "refreshToken={}; cf_clearance={}; XSRF-TOKEN={}",
            cfg.refresh_token, cfg.cf_clearance, cfg.xsrf_token
        );

        let mut headers = HeaderMap::new();
        headers.insert(ACCEPT, HeaderValue::from_static("application/json, text/plain, */*"));
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_STR));
        headers.insert(REFERER, HeaderValue::from_static("https://sirs6.kemkes.go.id/v3/"));

        if !cfg.access_token.is_empty() {
            if let Ok(v) = HeaderValue::from_str(&format!("Bearer {}", cfg.access_token)) {
                headers.insert(AUTHORIZATION, v);
            }
        }
        if let Ok(v) = HeaderValue::from_str(&cookie_str) {
            headers.insert(COOKIE, v);
        }
        if !cfg.xsrf_token.is_empty() {
            if let Ok(v) = HeaderValue::from_str(&cfg.xsrf_token) {
                headers.insert("XSRF-TOKEN", v.clone());
                // Angular (frontend SIRS v6) mengirim X-XSRF-TOKEN; Laravel/server
                // memvalidasi header ini terhadap cookie XSRF-TOKEN pada request yang
                // mengubah data (POST). Tanpa ini POST ditolak 403 Forbidden meski GET
                // lolos (GET tidak dicek CSRF). Harus sama persis dengan bot Go referensi.
                headers.insert("X-XSRF-TOKEN", v);
            }
        }

        let mut req = match method {
            "POST" => self.http.post(&url),
            "PUT" => self.http.put(&url),
            "DELETE" => self.http.delete(&url),
            _ => self.http.get(&url),
        };

        req = req.headers(headers);
        if let Some(b) = body {
            req = req.json(b);
        }

        let res = req.send().await
            .map_err(|e| format!("Koneksi ke endpoint SIRS ({}) gagal: {}", endpoint, e))?;

        let status = res.status();
        let text = res.text().await
            .map_err(|e| format!("Gagal membaca body response: {}", e))?;

        let val: Value = serde_json::from_str(&text)
            .unwrap_or_else(|_| json!({ "raw_body": text }));

        if !status.is_success() {
            let msg = val.get("message").and_then(|v| v.as_str()).unwrap_or(&text);
            return Err(format!("SIRS Kemenkes menolak request (HTTP {}): {}", status, msg));
        }

        Ok(val)
    }

    /// Cari ID numerik ICD-10 di master data Kemenkes. RL 4.1 dan RL 5.1 adalah
    /// SATU-SATUNYA formulir SIRS yang tidak menerima kode ICD ("A09") langsung
    /// — mereka minta `icdId`, ID baris di tabel ICD milik Kemenkes sendiri, yang
    /// cuma bisa didapat lewat endpoint pencarian ini. Tanpa langkah ini Kemenkes
    /// menolak dengan "data[0].icdId is required" walau kode ICD-nya benar.
    ///
    /// Dicache per kode per proses: laporan bulan berikutnya memakai kode ICD
    /// yang sama berulang-ulang, dan lookup ini memanggil Kemenkes satu per satu.
    async fn lookup_icd(
        &self,
        cfg: &SirsBotConfig,
        cache: &LazyLock<Mutex<HashMap<String, i64>>>,
        endpoint: &str,
        kode: &str,
    ) -> Result<i64, String> {
        let kode = kode.trim().to_string();
        if kode.is_empty() {
            return Err("kode ICD kosong".to_string());
        }
        if let Some(id) = cache.lock().unwrap().get(&kode) {
            return Ok(*id);
        }

        let enc = utf8_percent_encode(&kode, NON_ALPHANUMERIC).to_string();
        let val = self.do_request(cfg, "GET", &format!("{}?search={}", endpoint, enc), None).await?;

        let data = val.get("data").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        if data.is_empty() {
            return Err(format!("kode ICD '{}' tidak ditemukan di database Kemenkes", kode));
        }

        // Pencarian Kemenkes bersifat "contains", jadi bisa membalas beberapa
        // baris — ambil yang kodenya PERSIS sama, kalau tidak ada baru pakai
        // baris pertama sebagai fallback.
        let mut match_id = data[0].get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        for it in &data {
            let code = it.get("icd_code").and_then(|v| v.as_str()).unwrap_or("");
            let group = it.get("icd_code_group").and_then(|v| v.as_str()).unwrap_or("");
            if code.eq_ignore_ascii_case(&kode) || group.eq_ignore_ascii_case(&kode) {
                match_id = it.get("id").and_then(|v| v.as_i64()).unwrap_or(match_id);
                break;
            }
        }
        if match_id <= 0 {
            return Err(format!("kode ICD '{}' ditemukan tapi id-nya tidak valid", kode));
        }

        cache.lock().unwrap().insert(kode, match_id);
        Ok(match_id)
    }

    async fn lookup_icd_rawat_inap(&self, cfg: &SirsBotConfig, kode: &str) -> Result<i64, String> {
        self.lookup_icd(cfg, &ICD_INAP_CACHE, "/icd/rawat_inap/find", kode).await
    }
    async fn lookup_icd_rawat_jalan(&self, cfg: &SirsBotConfig, kode: &str) -> Result<i64, String> {
        self.lookup_icd(cfg, &ICD_RAJAL_CACHE, "/icd/rawat_jalan/find", kode).await
    }

    /// Submit laporan ke formulir RL Kemenkes
    pub async fn submit_rl(
        &self,
        cfg: &mut SirsBotConfig,
        form: &str,
        payload: &Value,
    ) -> Result<Value, String> {
        let mut form_clean = form.to_lowercase().replace('.', "");
        if !form_clean.starts_with("rl") {
            form_clean = format!("rl{}", form_clean);
        }

        // Validasi matematika Juknis 6.3
        let empty_vec = Vec::new();
        let data_slice = payload.get("data").and_then(|v| v.as_array()).unwrap_or(&empty_vec);

        let val_errs = match form_clean.as_str() {
            "rl32" => validate_rl32(data_slice),
            "rl33" => validate_rl33(data_slice),
            "rl35" => validate_rl35(data_slice),
            _ => Vec::new(),
        };

        // RL 4.1 (rawat inap) & RL 5.1 (rawat jalan): jalur terpisah, bukan
        // sekadar format-lalu-POST. Dua hal yang membuatnya beda dari formulir
        // RL lain — lihat submit_rl_icd_per_row untuk rinciannya.
        if form_clean == "rl41" || form_clean == "rl51" {
            return self.submit_rl_icd_per_row(cfg, &form_clean, payload).await;
        }

        if !val_errs.is_empty() {
            return Err(format!(
                "Validasi Juknis SIRS 6.3 tidak terpenuhi:\n• {}",
                val_errs.join("\n• ")
            ));
        }

        // Mapping endpoint resmi SIRS 6.3 Kemenkes
        let endpoint = match form_clean.as_str() {
            "rl32" => "/rltigatitikdua",
            "rl33" => "/rltigatitiktiga",
            "rl34" => "/rltigatitikempat",
            "rl35" => "/rltigatitiklima",
            "rl36" => "/rltigatitikenam",
            "rl37" => "/rltigatitiktujuh",
            "rl38" => "/rltigatitikdelapan",
            "rl39" => "/rltigatitiksembilan",
            "rl310" => "/rltigatitiksepuluh",
            "rl311" => "/rltigatitiksebelas",
            "rl312" => "/rltigatitikduabelas",
            "rl313" => "/rltigatitiktigabelas",
            "rl314" => "/rltigatitikempatbelas",
            "rl315" => "/rltigatitiklimabelas",
            "rl316" => "/rltigatitikenambelas",
            "rl317" => "/rltigatitiktujuhbelas",
            "rl318" => "/rltigatitikdelapanbelas",
            "rl319" => "/rltigatitiksembilanbelas",
            // rl41/rl51 TIDAK lewat sini — ditangkap lebih awal di atas dan
            // dikirim lewat submit_rl_icd_per_row (endpointnya dipakai ulang
            // di sana). Baris ini praktis mati, dibiarkan supaya endpoint
            // keduanya tetap terdokumentasi di satu tempat.
            "rl41" => "/rlempattitiksatu",
            "rl51" => "/rllimatitiksatu",
            other => return Err(format!("Formulir '{}' belum didukung untuk submit otomatis", other)),
        };

        // Format payload Kemenkes
        let kemenkes_payload = self.format_kemenkes_payload(&form_clean, payload)?;

        // Eksekusi request ke Kemenkes
        let res = self.do_request(cfg, "POST", endpoint, Some(&kemenkes_payload)).await;

        // Jika unauthorized atau forbidden (token expired / sesi habis), coba re-autentikasi otomatis
        if let Err(ref e) = res {
            let is_auth_err = e.contains("401") || e.contains("403")
                || e.to_lowercase().contains("unauthorized")
                || e.to_lowercase().contains("forbidden");

            if is_auth_err {
                let mut reauth_ok = self.refresh_token(cfg).await.is_ok();
                if !reauth_ok && !cfg.email.is_empty() && !cfg.password.is_empty() {
                    let email = cfg.email.clone();
                    let password = cfg.password.clone();
                    if self.login_sso(cfg, &email, &password).await.is_ok() {
                        reauth_ok = true;
                    }
                }
                if reauth_ok {
                    return self.do_request(cfg, "POST", endpoint, Some(&kemenkes_payload)).await;
                }
            }
        }

        res
    }

    /// Kirim RL 4.1 / RL 5.1 — dua hal yang membuatnya beda dari formulir RL
    /// lain di `submit_rl`:
    ///
    /// 1. Tiap baris wajib `icdId` (ID numerik ICD-10 Kemenkes), bukan kode
    ///    ICD ("A09") yang kita simpan — dicari dulu lewat lookup_icd_*.
    /// 2. Kemenkes menerimanya SATU BARIS per request, bukan sekaligus. Jadi
    ///    dikirim satu-satu di sini: satu kode ICD yang tidak dikenal Kemenkes
    ///    (typo, kode lama yang sudah dicabut, dst.) tidak menggagalkan seluruh
    ///    laporan bulan itu — baris lain tetap terkirim, yang bermasalah
    ///    dilaporkan terpisah di ringkasan supaya petugas tahu mana yang perlu
    ///    dibetulkan manual.
    async fn submit_rl_icd_per_row(
        &self,
        cfg: &mut SirsBotConfig,
        form: &str,
        payload: &Value,
    ) -> Result<Value, String> {
        let endpoint = if form == "rl41" { "/rlempattitiksatu" } else { "/rllimatitiksatu" };
        let rawat_inap = form == "rl41";

        let rows = payload.get("data").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        if rows.is_empty() {
            return Err(format!("Tidak ada baris diagnosa untuk dikirim ({})", form.to_uppercase()));
        }

        let periode_tahun = payload.get("periodeTahun").or_else(|| payload.get("tahun"))
            .and_then(|v| v.as_i64()).unwrap_or(2026);
        let periode_bulan = payload.get("periodeBulan").or_else(|| payload.get("bulan"))
            .and_then(|v| v.as_i64()).unwrap_or(1);

        // Segarkan sesi di AWAL batch. access_token SIRS hidup ~15 menit, dan hanya
        // cf_clearance yang diperbarui otomatis (cron 20 menit) — bukan access_token.
        // Kalau token sudah basi saat submit dimulai, SEMUA lookup ICD balas 403 dan
        // masuk daftar "dilewati"; re-auth di dalam loop hanya terpicu oleh kegagalan
        // POST, jadi tak pernah jalan. Refresh dulu (ringan), fallback login SSO penuh.
        if self.refresh_token(cfg).await.is_err()
            && !cfg.email.is_empty() && !cfg.password.is_empty() {
            let email = cfg.email.clone();
            let password = cfg.password.clone();
            let _ = self.login_sso(cfg, &email, &password).await;
        }

        let mut sukses = 0i32;
        let mut dilewati: Vec<String> = Vec::new(); // kode ICD tak dikenal Kemenkes
        let mut gagal: Vec<String> = Vec::new();     // ditolak Kemenkes sebab lain
        let mut reauth_tried = false;

        for row in &rows {
            let kode_icd = row.get("icd_code").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
            if kode_icd.is_empty() {
                continue;
            }

            let icd_id = if rawat_inap {
                self.lookup_icd_rawat_inap(cfg, &kode_icd).await
            } else {
                self.lookup_icd_rawat_jalan(cfg, &kode_icd).await
            };
            let icd_id = match icd_id {
                Ok(id) => id,
                Err(e) => { dilewati.push(format!("{}: {}", kode_icd, e)); continue; }
            };

            // Baris Java apa adanya, minus icd_code (bukan field resmi Kemenkes),
            // plus icdId hasil lookup.
            let mut row_obj = row.clone();
            if let Some(obj) = row_obj.as_object_mut() {
                obj.remove("icd_code");
                obj.insert("icdId".to_string(), json!(icd_id));
            }

            let kemenkes_payload = json!({
                "periodeBulan": periode_bulan,
                "periodeTahun": periode_tahun,
                "data": [row_obj],
            });

            let mut res = self.do_request(cfg, "POST", endpoint, Some(&kemenkes_payload)).await;

            // Sesi token habis bisa muncul di tengah baris ke-N — re-auth sekali
            // untuk seluruh batch, bukan per baris (hindari membanjiri SSO).
            if let Err(ref e) = res {
                let is_auth_err = e.contains("401") || e.contains("403")
                    || e.to_lowercase().contains("unauthorized") || e.to_lowercase().contains("forbidden");
                if is_auth_err && !reauth_tried {
                    reauth_tried = true;
                    let mut reauth_ok = self.refresh_token(cfg).await.is_ok();
                    if !reauth_ok && !cfg.email.is_empty() && !cfg.password.is_empty() {
                        let email = cfg.email.clone();
                        let password = cfg.password.clone();
                        if self.login_sso(cfg, &email, &password).await.is_ok() {
                            reauth_ok = true;
                        }
                    }
                    if reauth_ok {
                        res = self.do_request(cfg, "POST", endpoint, Some(&kemenkes_payload)).await;
                    }
                }
            }

            match res {
                Ok(_) => sukses += 1,
                Err(e) => gagal.push(format!("{}: {}", kode_icd, e)),
            }
        }

        if sukses == 0 {
            let contoh = gagal.first().or_else(|| dilewati.first()).cloned()
                .unwrap_or_else(|| "tidak ada rincian".to_string());
            return Err(format!(
                "Semua {} baris {} ditolak/dilewati. Contoh: {}",
                rows.len(), form.to_uppercase(), contoh
            ));
        }

        Ok(json!({
            "ringkasan": format!("Berhasil {} dari {} diagnosa {} tersimpan di Kemenkes",
                sukses, rows.len(), form.to_uppercase()),
            "sukses": sukses,
            "total": rows.len(),
            "dilewati_kode_tak_dikenal": dilewati,
            "gagal_ditolak_kemenkes": gagal,
        }))
    }

    fn format_kemenkes_payload(&self, form: &str, p: &Value) -> Result<Value, String> {
        let tahun = p.get("periodeTahun").or_else(|| p.get("tahun")).and_then(|v| v.as_i64()).unwrap_or(2026);
        let tahun_dan_bulan = p.get("tahunDanBulan").and_then(|v| v.as_str()).unwrap_or("2026-08-01");
        let bulan = p.get("periodeBulan").or_else(|| p.get("bulan")).and_then(|v| v.as_i64()).unwrap_or_else(|| {
            if tahun_dan_bulan.len() >= 7 {
                tahun_dan_bulan[5..7].parse::<i64>().unwrap_or(8)
            } else {
                8
            }
        });

        let data = p.get("data").and_then(|v| v.as_array());

        match form {
            "rl32" => {
                let mut items = Vec::new();
                if let Some(rows) = data {
                    for it in rows {
                        let total_hp = it.get("jumlah_hari_perawatan").and_then(|v| v.as_i64()).unwrap_or(0);
                        let sum_hp = it.get("rincian_hari_perawatan_vvip").and_then(|v| v.as_i64()).unwrap_or(0)
                            + it.get("rincian_hari_perawatan_vip").and_then(|v| v.as_i64()).unwrap_or(0)
                            + it.get("rincian_hari_perawatan_1").and_then(|v| v.as_i64()).unwrap_or(0)
                            + it.get("rincian_hari_perawatan_2").and_then(|v| v.as_i64()).unwrap_or(0)
                            + it.get("rincian_hari_perawatan_3").and_then(|v| v.as_i64()).unwrap_or(0)
                            + it.get("rincian_hari_perawatan_khusus").and_then(|v| v.as_i64()).unwrap_or(0);
                        let final_hp = total_hp.max(sum_hp);
                        if final_hp < 1 {
                            continue;
                        }

                        items.push(json!({
                            "rlTigaTitikDuaJenisPelayananId": it.get("jenis_pelayanan_id").or_else(|| it.get("id")),
                            "pasienAwalBulan": it.get("pasien_awal_bulan").unwrap_or(&json!(0)),
                            "pasienMasuk": it.get("pasien_masuk").unwrap_or(&json!(0)),
                            "pasienPindahan": it.get("pasien_pindahan").unwrap_or(&json!(0)),
                            "pasienDipindahkan": it.get("pasien_dipindahkan").unwrap_or(&json!(0)),
                            "pasienKeluarHidup": it.get("pasien_keluar_hidup").unwrap_or(&json!(0)),
                            "pasienKeluarMatiKurangDari48Jam": it.get("pasien_keluar_mati_kurang_48_l").unwrap_or(&json!(0)),
                            "pasienKeluarMatiLebihDariAtauSamaDengan48Jam": it.get("pasien_keluar_mati_lebih_48_l").unwrap_or(&json!(0)),
                            "pasienWanitaKeluarMatiKurangDari48Jam": it.get("pasien_keluar_mati_kurang_48_p").unwrap_or(&json!(0)),
                            "pasienWanitaKeluarMatiLebihDariAtauSamaDengan48Jam": it.get("pasien_keluar_mati_lebih_48_p").unwrap_or(&json!(0)),
                            "jumlahLamaDirawat": it.get("jumlah_lama_dirawat").unwrap_or(&json!(0)),
                            "rincianHariPerawatanKelasVVIP": it.get("rincian_hari_perawatan_vvip").unwrap_or(&json!(0)),
                            "rincianHariPerawatanKelasVIP": it.get("rincian_hari_perawatan_vip").unwrap_or(&json!(0)),
                            "rincianHariPerawatanKelas1": it.get("rincian_hari_perawatan_1").unwrap_or(&json!(0)),
                            "rincianHariPerawatanKelas2": it.get("rincian_hari_perawatan_2").unwrap_or(&json!(0)),
                            "rincianHariPerawatanKelas3": it.get("rincian_hari_perawatan_3").unwrap_or(&json!(0)),
                            "rincianHariPerawatanKelasKhusus": it.get("rincian_hari_perawatan_khusus").unwrap_or(&json!(0)),
                            "jumlahAlokasiTempatTidurAwalBulan": it.get("alokasi_tempat_tidur").or_else(|| it.get("jumlah_alokasi_tempat_tidur")).unwrap_or(&json!(0)),
                        }));
                    }
                }
                Ok(json!({
                    "periodeTahun": tahun,
                    "periodeBulan": bulan,
                    "data": items,
                }))
            },
            "rl33" => {
                let mut items = Vec::new();
                if let Some(rows) = data {
                    for it in rows {
                        let total = it.get("total_pasien_rujukan").and_then(|v| v.as_i64()).unwrap_or(0)
                            + it.get("total_pasien_non_rujukan").and_then(|v| v.as_i64()).unwrap_or(0);
                        if total < 1 && it.get("tindak_lanjut_dirawat").and_then(|v| v.as_i64()).unwrap_or(0) < 1 {
                            continue;
                        }

                        items.push(json!({
                            "jenisPelayananTigaTitikTigaId": it.get("jenis_pelayanan_id").or_else(|| it.get("id")),
                            "total_pasien_rujukan": it.get("total_pasien_rujukan").unwrap_or(&json!(0)),
                            "total_pasien_non_rujukan": it.get("total_pasien_non_rujukan").unwrap_or(&json!(0)),
                            "tlp_dirawat": it.get("tindak_lanjut_dirawat").unwrap_or(&json!(0)),
                            "tlp_dirujuk": it.get("tindak_lanjut_dirujuk").unwrap_or(&json!(0)),
                            "tlp_pulang": it.get("tindak_lanjut_pulang").unwrap_or(&json!(0)),
                            "m_igd_laki": it.get("mati_di_igd").unwrap_or(&json!(0)),
                            "m_igd_perempuan": 0,
                            "doa_laki": it.get("doa").unwrap_or(&json!(0)),
                            "doa_perempuan": 0,
                            "luka_laki": it.get("luka_luka").unwrap_or(&json!(0)),
                            "luka_perempuan": 0,
                            "false_emergency": it.get("false_emergency").unwrap_or(&json!(0)),
                        }));
                    }
                }
                Ok(json!({
                    "tahun": tahun,
                    "bulan": bulan,
                    "data": items,
                }))
            },
            "rl34" => {
                let mut items = Vec::new();
                if let Some(rows) = data {
                    for it in rows {
                        let id = it.get("jenis_pengunjung_id").or_else(|| it.get("id")).and_then(|v| v.as_i64()).unwrap_or(0);
                        let jml = it.get("jumlah").and_then(|v| v.as_i64()).unwrap_or(0);
                        if id > 0 {
                            items.push(json!({
                                "jenisPengunjungId": id,
                                "jumlah": jml,
                            }));
                        }
                    }
                }
                Ok(json!({
                    "tahun": tahun,
                    "tahunDanBulan": tahun_dan_bulan,
                    "data": items,
                }))
            },
            "rl39" => {
                let mut items = Vec::new();
                if let Some(rows) = data {
                    for it in rows {
                        let id = it.get("jenisKegiatanId")
                            .or_else(|| it.get("jenis_kegiatan_id"))
                            .or_else(|| it.get("id"))
                            .and_then(|v| v.as_i64())
                            .or_else(|| {
                                it.get("kode_kegiatan")
                                    .or_else(|| it.get("no"))
                                    .or_else(|| it.get("kode"))
                                    .and_then(|v| v.as_str())
                                    .and_then(map_rl39_id)
                            })
                            .unwrap_or(0);

                        let jml = it.get("jumlah").and_then(|v| v.as_i64()).unwrap_or(0);
                        if id > 0 {
                            items.push(json!({
                                "jenisKegiatanId": id,
                                "jumlah": jml,
                            }));
                        }
                    }
                } else if let Some(raw_rows) = p.get("raw_rows").and_then(|v| v.as_array()) {
                    for row in raw_rows {
                        if let Some(r) = row.as_array() {
                            if r.len() >= 3 {
                                let no = r[0].as_str().unwrap_or("").trim();
                                if let Some(id) = map_rl39_id(no) {
                                    let jml = r[2].as_i64().or_else(|| r[2].as_str().and_then(|s| s.parse::<i64>().ok())).unwrap_or(0);
                                    items.push(json!({
                                        "jenisKegiatanId": id,
                                        "jumlah": jml,
                                    }));
                                }
                            }
                        }
                    }
                }

                if items.is_empty() {
                    for i in 1..=19 {
                        items.push(json!({
                            "jenisKegiatanId": i,
                            "jumlah": 0,
                        }));
                    }
                }

                Ok(json!({
                    "periodeTahun": tahun,
                    "periodeBulan": bulan,
                    "data": items,
                }))
            },
            "rl38" => {
                let mut items = Vec::new();
                if let Some(rows) = data {
                    for it in rows {
                        let id = it.get("rLTigaTitikDelapanPemeriksaanId")
                            .or_else(|| it.get("pemeriksaan_id"))
                            .or_else(|| it.get("id"))
                            .and_then(|v| v.as_i64())
                            .or_else(|| {
                                it.get("kode_pemeriksaan")
                                    .or_else(|| it.get("no"))
                                    .and_then(|v| v.as_str())
                                    .and_then(map_rl38_id)
                            })
                            .unwrap_or(0);

                        let jml_l = it.get("jumlahLaki").or_else(|| it.get("jumlah_laki")).and_then(|v| v.as_i64()).unwrap_or(0);
                        let jml_p = it.get("jumlahPerempuan").or_else(|| it.get("jumlah_perempuan")).and_then(|v| v.as_i64()).unwrap_or(0);
                        let rata_l = it.get("rataLaki").or_else(|| it.get("rata_laki")).map(|v| {
                            if let Some(s) = v.as_str() { json!(s) }
                            else if let Some(n) = v.as_f64() { json!(format!("{:.2}", n)) }
                            else { json!("0.00") }
                        }).unwrap_or(json!("0.00"));
                        let rata_p = it.get("rataPerempuan").or_else(|| it.get("rata_perempuan")).map(|v| {
                            if let Some(s) = v.as_str() { json!(s) }
                            else if let Some(n) = v.as_f64() { json!(format!("{:.2}", n)) }
                            else { json!("0.00") }
                        }).unwrap_or(json!("0.00"));

                        if id > 0 {
                            items.push(json!({
                                "rLTigaTitikDelapanPemeriksaanId": id,
                                "jumlahLaki": jml_l,
                                "jumlahPerempuan": jml_p,
                                "rataLaki": rata_l,
                                "rataPerempuan": rata_p,
                            }));
                        }
                    }
                } else if let Some(raw_rows) = p.get("raw_rows").and_then(|v| v.as_array()) {
                    for row in raw_rows {
                        if let Some(r) = row.as_array() {
                            if r.len() >= 6 {
                                let no = r[0].as_str().unwrap_or("").trim();
                                if let Some(id) = map_rl38_id(no) {
                                    let jml_l = r[2].as_i64().or_else(|| r[2].as_str().and_then(|s| s.parse::<i64>().ok())).unwrap_or(0);
                                    let jml_p = r[3].as_i64().or_else(|| r[3].as_str().and_then(|s| s.parse::<i64>().ok())).unwrap_or(0);
                                    let rata_l = r[4].as_str().unwrap_or("0.00");
                                    let rata_p = r[5].as_str().unwrap_or("0.00");
                                    if jml_l > 0 || jml_p > 0 {
                                        items.push(json!({
                                            "rLTigaTitikDelapanPemeriksaanId": id,
                                            "jumlahLaki": jml_l,
                                            "jumlahPerempuan": jml_p,
                                            "rataLaki": rata_l,
                                            "rataPerempuan": rata_p,
                                        }));
                                    }
                                }
                            }
                        }
                    }
                }
                Ok(json!({
                    "periodeTahun": tahun,
                    "periodeBulan": bulan,
                    "data": items,
                }))
            },
            "rl37" => {
                let mut items = Vec::new();
                if let Some(rows) = data {
                    for it in rows {
                        let id = it.get("jenis_kegiatan_id").or_else(|| it.get("id")).and_then(|v| v.as_i64()).unwrap_or(0);
                        if id > 0 {
                            items.push(json!({
                                "jenisKegiatanId": id,
                                "rmRumahSakit": it.get("rm_rumah_sakit").unwrap_or(&json!(0)),
                                "rmBidan": it.get("rm_bidan").unwrap_or(&json!(0)),
                                "rmPuskesmas": it.get("rm_puskesmas").unwrap_or(&json!(0)),
                                "rmFaskesLainnya": it.get("rm_faskes_lainnya").unwrap_or(&json!(0)),
                                "rmHidup": it.get("rm_hidup").unwrap_or(&json!(0)),
                                "rmMati": it.get("rm_mati").unwrap_or(&json!(0)),
                                "rmTotal": it.get("rm_total").unwrap_or(&json!(0)),
                                "rnmHidup": it.get("rnm_hidup").unwrap_or(&json!(0)),
                                "rnmMati": it.get("rnm_mati").unwrap_or(&json!(0)),
                                "rnmTotal": it.get("rnm_total").unwrap_or(&json!(0)),
                                "nrHidup": it.get("nr_hidup").unwrap_or(&json!(0)),
                                "nrMati": it.get("nr_mati").unwrap_or(&json!(0)),
                                "nrTotal": it.get("nr_total").unwrap_or(&json!(0)),
                                "dirujuk": it.get("dirujuk").unwrap_or(&json!(0)),
                            }));
                        }
                    }
                }
                Ok(json!({
                    "tahun": tahun,
                    "tahunDanBulan": tahun_dan_bulan,
                    "data": items,
                }))
            },
            "rl36" => {
                let mut items = Vec::new();
                if let Some(rows) = data {
                    for it in rows {
                        let id = it.get("jenis_kegiatan_id").or_else(|| it.get("id")).and_then(|v| v.as_i64()).unwrap_or(0);
                        if id > 0 {
                            items.push(json!({
                                "jenisKegiatanId": id,
                                "rmRumahSakit": it.get("rm_rumah_sakit").unwrap_or(&json!(0)),
                                "rmBidan": it.get("rm_bidan").unwrap_or(&json!(0)),
                                "rmPuskesmas": it.get("rm_puskesmas").unwrap_or(&json!(0)),
                                "rmFaskesLainnya": it.get("rm_faskes_lainnya").unwrap_or(&json!(0)),
                                "rmHidup": it.get("rm_hidup").unwrap_or(&json!(0)),
                                "rmMati": it.get("rm_mati").unwrap_or(&json!(0)),
                                "rmTotal": it.get("rm_total").unwrap_or(&json!(0)),
                                "rnmHidup": it.get("rnm_hidup").unwrap_or(&json!(0)),
                                "rnmMati": it.get("rnm_mati").unwrap_or(&json!(0)),
                                "rnmTotal": it.get("rnm_total").unwrap_or(&json!(0)),
                                "nrHidup": it.get("nr_hidup").unwrap_or(&json!(0)),
                                "nrMati": it.get("nr_mati").unwrap_or(&json!(0)),
                                "nrTotal": it.get("nr_total").unwrap_or(&json!(0)),
                                "dirujuk": it.get("dirujuk").unwrap_or(&json!(0)),
                            }));
                        }
                    }
                }
                Ok(json!({
                    "tahun": tahun,
                    "tahunDanBulan": tahun_dan_bulan,
                    "data": items,
                }))
            },
            "rl35" => {
                let mut items = Vec::new();
                if let Some(rows) = data {
                    for it in rows {
                        let tot = it.get("total_kunjungan").and_then(|v| v.as_i64()).unwrap_or(0);
                        if tot < 1 {
                            continue;
                        }
                        items.push(json!({
                            "jenisKegiatanId": it.get("jenis_kegiatan_id").or_else(|| it.get("id")),
                            "kunjungan_pasien_dalam_kabkota_laki": it.get("kunjungan_pasien_dalam_kabkota_laki").unwrap_or(&json!(0)),
                            "kunjungan_pasien_dalam_kabkota_perempuan": it.get("kunjungan_pasien_dalam_kabkota_perempuan").unwrap_or(&json!(0)),
                            "kunjungan_pasien_luar_kabkota_laki": it.get("kunjungan_pasien_luar_kabkota_laki").unwrap_or(&json!(0)),
                            "kunjungan_pasien_luar_kabkota_perempuan": it.get("kunjungan_pasien_luar_kabkota_perempuan").unwrap_or(&json!(0)),
                            "total_kunjungan": tot,
                        }));
                    }
                }
                Ok(json!({
                    "tahun": tahun,
                    "tahunDanBulan": tahun_dan_bulan,
                    "data": items,
                }))
            },
            "rl310" => {
                Ok(json!({
                    "tahun": tahun,
                    "bulan": bulan,
                    "data": data.cloned().unwrap_or_default(),
                }))
            },
            "rl311" => {
                Ok(json!({
                    "tahun": tahun,
                    "data": data.cloned().unwrap_or_default(),
                }))
            },
            "rl312" => {
                Ok(json!({
                    "periodeTahun": tahun,
                    "periodeBulan": bulan,
                    "data": data.cloned().unwrap_or_default(),
                }))
            },
            "rl313" => {
                Ok(json!({
                    "tahun": tahun,
                    "data": data.cloned().unwrap_or_default(),
                }))
            },
            "rl314" => {
                Ok(json!({
                    "tahun": tahun,
                    "tahunDanBulan": tahun_dan_bulan,
                    "data": data.cloned().unwrap_or_default(),
                }))
            },
            "rl315" => {
                Ok(json!({
                    "tahun": tahun,
                    "data": data.cloned().unwrap_or_default(),
                }))
            },
            "rl316" => {
                Ok(json!({
                    "tahun": tahun,
                    "data": data.cloned().unwrap_or_default(),
                }))
            },
            "rl317" => {
                Ok(json!({
                    "periodeTahun": tahun,
                    "data": data.cloned().unwrap_or_default(),
                }))
            },
            "rl318" => {
                Ok(json!({
                    "periodeTahun": tahun,
                    "data": data.cloned().unwrap_or_default(),
                }))
            },
            "rl319" => {
                Ok(json!({
                    "tahun": tahun,
                    "data": data.cloned().unwrap_or_default(),
                }))
            },
            _ => Ok(p.clone()),
        }
    }
}
