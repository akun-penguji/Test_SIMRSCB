// BPJS VClaim API client.
// Port dari Khanza ApiBPJS / ApiBPJSEnc / ApiBPJSLZString (RSUD Dirgahayu fork).
// Signature: HMAC-SHA256 base64.
// Response: base64 → AES-256-CBC decrypt → LZ-String decompressFromEncodedURIComponent → JSON.

use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyIvInit};
use base64::Engine;
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;
type Aes256CbcDec = cbc::Decryptor<aes::Aes256>;

#[derive(Clone, Debug)]
pub struct BpjsConfig {
    pub vclaim_url: String,
    pub cons_id:    String,
    pub secret_key: String,
    pub user_key:   String,
}

impl BpjsConfig {
    pub fn from_env() -> Option<Self> {
        let vclaim_url = std::env::var("BPJS_VCLAIM_URL").ok()?;
        let cons_id    = std::env::var("BPJS_CONS_ID").ok()?;
        let secret_key = std::env::var("BPJS_SECRET_KEY").ok()?;
        let user_key   = std::env::var("BPJS_USER_KEY").ok()?;
        if vclaim_url.is_empty() || cons_id.is_empty() || secret_key.is_empty() {
            return None;
        }
        Some(Self { vclaim_url, cons_id, secret_key, user_key })
    }
}

pub fn utc_now_secs() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}

/// Generate HMAC-SHA256 signature base64: HMAC(consId + "&" + ts, secretKey)
pub fn build_signature(cons_id: &str, secret_key: &str, ts_secs: i64) -> String {
    let salt = format!("{}&{}", cons_id, ts_secs);
    let mut mac = HmacSha256::new_from_slice(secret_key.as_bytes()).expect("HMAC key invalid");
    mac.update(salt.as_bytes());
    let sig = mac.finalize().into_bytes();
    base64::engine::general_purpose::STANDARD.encode(sig)
}

/// Decrypt response BPJS:
/// 1. SHA-256(consId + secretKey + ts) → 32 byte hash
/// 2. AES-256-CBC decrypt base64(ciphertext) with key=full hash, IV=first 16 bytes
/// 3. LZ-String decompressFromEncodedURIComponent → JSON
pub fn decrypt_response(payload: &str, cons_id: &str, secret_key: &str, ts_secs: i64) -> Result<String, String> {
    // 1. Key derivation
    let seed = format!("{}{}{}", cons_id, secret_key, ts_secs);
    let mut hasher = Sha256::new();
    hasher.update(seed.as_bytes());
    let hash = hasher.finalize();  // 32 bytes
    let key: [u8; 32] = hash.into();
    let mut iv = [0u8; 16];
    iv.copy_from_slice(&key[..16]);

    // 2. AES-256-CBC decrypt
    let ct = base64::engine::general_purpose::STANDARD
        .decode(payload.trim())
        .map_err(|e| format!("base64 decode: {}", e))?;
    let mut buf = ct.clone();
    let pt = Aes256CbcDec::new(&key.into(), &iv.into())
        .decrypt_padded_mut::<Pkcs7>(&mut buf)
        .map_err(|e| format!("AES decrypt: {:?}", e))?;
    let uri_encoded = std::str::from_utf8(pt)
        .map_err(|e| format!("utf8: {}", e))?
        .to_string();

    // 3. LZ-String decompress (input adalah URI-encoded LZ-String — sesuai pattern Khanza ApiBPJSLZString)
    let json = lz_str::decompress_from_encoded_uri_component(&uri_encoded)
        .ok_or_else(|| "LZ-String decompress failed".to_string())?;
    let json_str: String = String::from_utf16(&json)
        .map_err(|e| format!("utf16 → string: {}", e))?;
    Ok(json_str)
}

/// HTTP client helper untuk BPJS API.
pub struct BpjsClient {
    pub config: BpjsConfig,
    pub http:   reqwest::Client,
}

impl BpjsClient {
    pub fn new(config: BpjsConfig) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            // BPJS API kadang sertifikat TLS-nya tidak match (per Khanza ApiBPJS.getRest yang accept-all)
            .danger_accept_invalid_certs(true)
            .build()
            .expect("reqwest client build");
        Self { config, http }
    }

    /// POST request ke BPJS VClaim endpoint dengan body JSON (form-urlencoded
    /// Content-Type tapi body raw JSON — sesuai pattern Java APMSEPDuaPrinter).
    pub async fn post(&self, path: &str, body: serde_json::Value) -> Result<serde_json::Value, String> {
        let ts = utc_now_secs();
        let sig = build_signature(&self.config.cons_id, &self.config.secret_key, ts);
        let url = format!("{}/{}", self.config.vclaim_url.trim_end_matches('/'), path.trim_start_matches('/'));

        let body_str = body.to_string();

        let resp = self.http.post(&url)
            .header("X-cons-id", &self.config.cons_id)
            .header("X-timestamp", ts.to_string())
            .header("X-signature", &sig)
            .header("user_key", &self.config.user_key)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body_str)
            .send().await
            .map_err(|e| format!("request: {}", e))?;

        let status = resp.status();
        let text = resp.text().await.map_err(|e| format!("read body: {}", e))?;
        if !status.is_success() {
            return Err(format!("HTTP {}: {}", status, text));
        }

        let raw: serde_json::Value = serde_json::from_str(&text)
            .map_err(|e| format!("parse json: {} (body: {})", e, &text[..text.len().min(200)]))?;

        let meta_code = raw.pointer("/metaData/code")
            .and_then(|v| v.as_str().map(|s| s.to_string()).or_else(|| v.as_i64().map(|n| n.to_string())))
            .unwrap_or_default();
        let meta_msg = raw.pointer("/metaData/message")
            .and_then(|v| v.as_str()).unwrap_or("").to_string();

        if !matches!(meta_code.as_str(), "200" | "1") {
            return Err(format!("BPJS {}: {}", meta_code, meta_msg));
        }

        let response_field = raw.get("response").cloned().unwrap_or(serde_json::Value::Null);
        if let Some(enc) = response_field.as_str() {
            let json = decrypt_response(enc, &self.config.cons_id, &self.config.secret_key, ts)?;
            let v: serde_json::Value = serde_json::from_str(&json)
                .map_err(|e| format!("decrypted json parse: {}", e))?;
            Ok(v)
        } else {
            Ok(response_field)
        }
    }

    /// GET request ke BPJS VClaim endpoint. Path harus tidak ada leading slash.
    pub async fn get(&self, path: &str) -> Result<serde_json::Value, String> {
        let ts = utc_now_secs();
        let sig = build_signature(&self.config.cons_id, &self.config.secret_key, ts);
        let url = format!("{}/{}", self.config.vclaim_url.trim_end_matches('/'), path.trim_start_matches('/'));

        let resp = self.http.get(&url)
            .header("X-cons-id", &self.config.cons_id)
            .header("X-timestamp", ts.to_string())
            .header("X-signature", &sig)
            .header("user_key", &self.config.user_key)
            .header("Accept", "application/json")
            .send().await
            .map_err(|e| format!("request: {}", e))?;

        let status = resp.status();
        let body = resp.text().await.map_err(|e| format!("read body: {}", e))?;
        if !status.is_success() {
            return Err(format!("HTTP {}: {}", status, body));
        }

        // Response shape: { "response": "<encrypted>", "metaData": {"code":"200","message":"OK"} }
        let raw: serde_json::Value = serde_json::from_str(&body)
            .map_err(|e| format!("parse json: {} (body: {})", e, &body[..body.len().min(200)]))?;

        let meta_code = raw.pointer("/metaData/code")
            .and_then(|v| v.as_str().map(|s| s.to_string()).or_else(|| v.as_i64().map(|n| n.to_string())))
            .unwrap_or_default();
        let meta_msg = raw.pointer("/metaData/message")
            .and_then(|v| v.as_str()).unwrap_or("").to_string();

        // Code "200" / "1" tergantung endpoint; non-200 → return error dengan pesan BPJS
        if !matches!(meta_code.as_str(), "200" | "1") {
            return Err(format!("BPJS {}: {}", meta_code, meta_msg));
        }

        // response bisa string (encrypted) atau langsung object (kalau endpoint tertentu)
        let response_field = raw.get("response").cloned().unwrap_or(serde_json::Value::Null);
        if let Some(enc) = response_field.as_str() {
            // Decrypt + LZ-String
            let json = decrypt_response(enc, &self.config.cons_id, &self.config.secret_key, ts)?;
            let v: serde_json::Value = serde_json::from_str(&json)
                .map_err(|e| format!("decrypted json parse: {}", e))?;
            Ok(v)
        } else {
            // Plaintext object
            Ok(response_field)
        }
    }
}
