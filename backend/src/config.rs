use anyhow::Context;

pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub port: u16,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let jwt_secret = std::env::var("JWT_SECRET")
            .context("JWT_SECRET harus diset di .env (min 32 karakter)")?;
        // Keamanan: tolak jalan bila secret lemah/placeholder — mencegah token
        // (termasuk token admin) ditempa. Ganti dengan: openssl rand -base64 48
        if jwt_secret.trim().len() < 32 {
            anyhow::bail!("JWT_SECRET terlalu pendek (min 32 karakter). Buat dengan: openssl rand -base64 48");
        }
        if jwt_secret.contains("ganti") || jwt_secret.contains("change") || jwt_secret.to_lowercase().contains("secret_kuat") {
            anyhow::bail!("JWT_SECRET masih memakai nilai placeholder — WAJIB diganti dengan secret acak kuat (openssl rand -base64 48)");
        }
        Ok(Self {
            database_url: std::env::var("DATABASE_URL")
                .context("DATABASE_URL harus diset di .env")?,
            jwt_secret,
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .context("PORT harus berupa angka")?,
        })
    }
}
