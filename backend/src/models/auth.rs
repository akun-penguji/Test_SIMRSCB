use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
    #[serde(default)]
    pub captcha_id: String,
    #[serde(default)]
    pub captcha: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub kode: String,
    pub nama: String,
    pub is_admin: bool,
    pub permissions: HashMap<String, bool>,
    pub exp: usize,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub kode: String,
    pub nama: String,
    pub is_admin: bool,
    pub permissions: HashMap<String, bool>,
}
