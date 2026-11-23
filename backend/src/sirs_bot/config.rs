use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;

const CONFIG_PATH: &str = "sirs_config.json";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SirsBotConfig {
    #[serde(default = "default_port")]
    pub port: String,
    #[serde(default = "default_sirs_base_url")]
    pub sirs_base_url: String,
    #[serde(default = "default_sso_url")]
    pub sso_url: String,
    #[serde(default)]
    pub access_token: String,
    #[serde(default)]
    pub refresh_token: String,
    #[serde(default)]
    pub cf_clearance: String,
    #[serde(default)]
    pub xsrf_token: String,
    #[serde(default)]
    pub kode_rs: String,
    #[serde(default)]
    pub nama_rs: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub headless: bool,
}

fn default_port() -> String { "8080".to_string() }
fn default_sirs_base_url() -> String { "https://sirs6.kemkes.go.id/apisirs6v2".to_string() }
fn default_sso_url() -> String { "https://akun-yankes.kemkes.go.id".to_string() }

impl Default for SirsBotConfig {
    fn default() -> Self {
        Self {
            port: default_port(),
            sirs_base_url: default_sirs_base_url(),
            sso_url: default_sso_url(),
            access_token: String::new(),
            refresh_token: String::new(),
            cf_clearance: String::new(),
            xsrf_token: String::new(),
            kode_rs: String::new(),
            nama_rs: String::new(),
            email: String::new(),
            password: String::new(),
            headless: true,
        }
    }
}

impl SirsBotConfig {
    pub fn load() -> Self {
        if Path::new(CONFIG_PATH).exists() {
            if let Ok(content) = std::fs::read_to_string(CONFIG_PATH) {
                if let Ok(cfg) = serde_json::from_str::<SirsBotConfig>(&content) {
                    return cfg;
                }
            }
        }
        Self::default()
    }

    pub fn save(&self) -> Result<(), String> {
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Gagal serialisasi konfigurasi: {}", e))?;
        std::fs::write(CONFIG_PATH, json)
            .map_err(|e| format!("Gagal menulis file sirs_config.json: {}", e))?;
        Ok(())
    }
}

pub type SharedConfig = Arc<RwLock<SirsBotConfig>>;

pub fn new_shared_config() -> SharedConfig {
    Arc::new(RwLock::new(SirsBotConfig::load()))
}
