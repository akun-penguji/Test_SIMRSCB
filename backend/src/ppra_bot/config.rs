use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;

const CONFIG_PATH: &str = "ppra_config.json";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PpraBotConfig {
    #[serde(default = "default_username")]
    pub username: String,
    #[serde(default = "default_password")]
    pub password: String,
    #[serde(default = "default_base_url")]
    pub base_url: String,
    #[serde(default)]
    pub session_cookie: String,
    #[serde(default)]
    pub cf_clearance: String,
    #[serde(default = "default_user_agent")]
    pub user_agent: String,
    #[serde(default)]
    pub last_login: String,
}

fn default_username() -> String { String::new() }
// Kredensial portal tidak boleh ada di source; isi lewat POST /ppra/bot/config (tersimpan di ppra_config.json).
fn default_password() -> String { String::new() }
fn default_base_url() -> String { "https://mutufasyankes.kemkes.go.id/ppra".to_string() }
fn default_user_agent() -> String {
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36".to_string()
}

impl Default for PpraBotConfig {
    fn default() -> Self {
        Self {
            username: default_username(),
            password: default_password(),
            base_url: default_base_url(),
            session_cookie: String::new(),
            cf_clearance: String::new(),
            user_agent: default_user_agent(),
            last_login: String::new(),
        }
    }
}

impl PpraBotConfig {
    pub fn load() -> Self {
        if Path::new(CONFIG_PATH).exists() {
            if let Ok(content) = std::fs::read_to_string(CONFIG_PATH) {
                if let Ok(cfg) = serde_json::from_str::<PpraBotConfig>(&content) {
                    return cfg;
                }
            }
        }
        Self::default()
    }

    pub fn save(&self) -> Result<(), String> {
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Gagal serialisasi konfigurasi PPRA: {}", e))?;
        std::fs::write(CONFIG_PATH, json)
            .map_err(|e| format!("Gagal menulis file ppra_config.json: {}", e))?;
        Ok(())
    }
}

pub type SharedConfig = Arc<RwLock<PpraBotConfig>>;

pub fn new_shared_config() -> SharedConfig {
    Arc::new(RwLock::new(PpraBotConfig::load()))
}
