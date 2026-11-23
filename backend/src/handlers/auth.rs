use crate::{
    auth::jwt::encode_jwt,
    models::auth::{Claims, LoginRequest, LoginResponse},
    AppState,
};
use axum::{extract::State, http::StatusCode, Json};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

// Rate-limit login (anti credential-stuffing saat online). Per-IP, in-memory.
static LOGIN_ATTEMPTS: LazyLock<Mutex<HashMap<String, (u32, Instant)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
const LOGIN_MAX_FAIL: u32 = 10;
const LOGIN_WINDOW: Duration = Duration::from_secs(300); // 5 menit

fn client_ip(h: &axum::http::HeaderMap) -> String {
    // Di belakang Cloudflare, IP asli ada di CF-Connecting-IP.
    h.get("cf-connecting-ip").and_then(|v| v.to_str().ok()).map(|s| s.trim().to_string())
        .or_else(|| h.get("x-forwarded-for").and_then(|v| v.to_str().ok())
            .and_then(|s| s.split(',').next()).map(|s| s.trim().to_string()))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}
fn login_rate_allowed(key: &str) -> bool {
    let mut m = LOGIN_ATTEMPTS.lock().unwrap();
    let now = Instant::now();
    let e = m.entry(key.to_string()).or_insert((0, now));
    if now.duration_since(e.1) > LOGIN_WINDOW { *e = (0, now); }
    e.0 < LOGIN_MAX_FAIL
}
fn login_rate_fail(key: &str) {
    let mut m = LOGIN_ATTEMPTS.lock().unwrap();
    let now = Instant::now();
    let e = m.entry(key.to_string()).or_insert((0, now));
    if now.duration_since(e.1) > LOGIN_WINDOW { *e = (0, now); }
    e.0 += 1;
}
fn login_rate_reset(key: &str) { LOGIN_ATTEMPTS.lock().unwrap().remove(key); }

// Lockout temporer PER-AKUN setelah 3 kali gagal berturut (BPJS Security
// Self-Assessment aspek 1.4). Dipisah dari rate-limit per-IP karena di RS
// banyak PC berbagi satu IP publik (NAT) — penguncian harus per-user, bukan
// memblokir seluruh klinik. Terkunci 1 menit sejak kegagalan ke-3.
static ACCOUNT_LOCK: LazyLock<Mutex<HashMap<String, (u32, Instant)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
const ACCOUNT_MAX_FAIL: u32 = 3;
const ACCOUNT_LOCK_DUR: Duration = Duration::from_secs(60); // 1 menit

/// Sisa detik lockout bila akun sedang terkunci, else None.
fn account_locked(user: &str) -> Option<u64> {
    let m = ACCOUNT_LOCK.lock().unwrap();
    if let Some((cnt, last)) = m.get(user) {
        if *cnt >= ACCOUNT_MAX_FAIL {
            let elapsed = last.elapsed();
            if elapsed < ACCOUNT_LOCK_DUR {
                return Some((ACCOUNT_LOCK_DUR - elapsed).as_secs());
            }
        }
    }
    None
}
fn account_fail(user: &str) {
    let mut m = ACCOUNT_LOCK.lock().unwrap();
    let now = Instant::now();
    let e = m.entry(user.to_string()).or_insert((0, now));
    // kalau lockout lama sudah kedaluwarsa, mulai hitung dari nol
    if e.0 >= ACCOUNT_MAX_FAIL && now.duration_since(e.1) >= ACCOUNT_LOCK_DUR { *e = (0, now); }
    e.0 += 1;
    e.1 = now;
}
fn account_reset(user: &str) { ACCOUNT_LOCK.lock().unwrap().remove(user); }

// ── CAPTCHA gambar self-hosted (anti-bot login, BPJS SSA 1.3) ───────────────
// Server membuat kode acak + gambar terdistorsi (tahan OCR). Jawaban disimpan
// sementara, bersifat one-time (dihapus saat diverifikasi) & kedaluwarsa 5 menit.
static CAPTCHA_STORE: LazyLock<Mutex<HashMap<String, (String, Instant)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
const CAPTCHA_TTL: Duration = Duration::from_secs(300);

pub async fn captcha() -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    use base64::Engine;
    use rand::Rng;
    // Difficulty::Easy — distorsi lebih ringan agar kode captcha jelas dibaca.
    let c = captcha::gen(captcha::Difficulty::Easy);
    let answer = c.chars_as_string().to_lowercase();
    let png = c.as_png().ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": "Gagal membuat captcha"})),
    ))?;
    let mut r = rand::thread_rng();
    let id: String = (0..24).map(|_| {
        let n: u8 = r.gen_range(0..36);
        if n < 10 { (b'0' + n) as char } else { (b'a' + n - 10) as char }
    }).collect();
    {
        let mut m = CAPTCHA_STORE.lock().unwrap();
        let now = Instant::now();
        m.retain(|_, (_, t)| now.duration_since(*t) < CAPTCHA_TTL);
        m.insert(id.clone(), (answer, now));
    }
    let b64 = base64::engine::general_purpose::STANDARD.encode(&png);
    Ok(Json(json!({ "id": id, "image": format!("data:image/png;base64,{}", b64) })))
}

/// Verifikasi captcha (one-time, hapus apapun hasilnya untuk cegah brute-force).
fn verify_captcha(id: &str, input: &str) -> bool {
    let mut m = CAPTCHA_STORE.lock().unwrap();
    match m.remove(id) {
        Some((ans, t)) => Instant::now().duration_since(t) < CAPTCHA_TTL
            && ans == input.trim().to_lowercase(),
        None => false,
    }
}

pub async fn login(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, (StatusCode, Json<Value>)> {
    let ip = client_ip(&headers);
    if !login_rate_allowed(&ip) {
        return Err((StatusCode::TOO_MANY_REQUESTS,
            Json(json!({"error": "Terlalu banyak percobaan login gagal. Coba lagi dalam beberapa menit."}))));
    }
    // Lockout per-akun setelah 3 kali gagal (BPJS SSA 1.4) — terkunci 1 menit.
    if let Some(sisa) = account_locked(&req.username) {
        return Err((StatusCode::TOO_MANY_REQUESTS, Json(json!({
            "error": format!("Terlalu banyak percobaan gagal. Akun terkunci sementara, coba lagi dalam {} detik.", sisa)
        }))));
    }

    // Verifikasi CAPTCHA (anti-bot, BPJS SSA 1.3) — wajib & one-time.
    if !verify_captcha(&req.captcha_id, &req.captcha) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({
            "error": "Kode captcha salah atau kedaluwarsa. Muat ulang captcha lalu coba lagi.",
            "captcha_error": true
        }))));
    }
    let err_invalid = || {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "ID User atau password salah"})),
        )
    };

    // 1. Cek admin — BCrypt pada tabel `admins`. Tidak ada fallback ke AES.
    let is_admin = check_admin_bcrypt(&state.pool, &req.username, &req.password).await
        .map_err(|e| {
            tracing::error!("DB error cek admin: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
        })?;

    if is_admin {
        // Admin Utama — semua akses true (Khanza + Web)
        let mut permissions = HashMap::new();
        for perm in ALL_PERMISSIONS {
            permissions.insert(perm.to_string(), true);
        }
        for (key, _, _) in crate::handlers::web_perms::WEB_PERMISSIONS {
            permissions.insert(key.to_string(), true);
        }
        let exp = chrono::Utc::now().timestamp() as usize + 14400; // 4 jam
        let claims = Claims {
            sub: req.username.clone(),
            kode: "Admin Utama".to_string(),
            nama: "Admin Utama".to_string(),
            is_admin: true,
            permissions,
            exp,
        };
        let token = encode_jwt(&claims, &state.jwt_secret).map_err(|_| {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal buat token"})))
        })?;
        login_rate_reset(&ip);
        account_reset(&req.username);
        crate::audit::log_login(&state.pool, &claims.kode).await;
        return Ok(Json(LoginResponse {
            token,
            kode: claims.kode,
            nama: claims.nama,
            is_admin: true,
            permissions: claims.permissions,
        }));
    }

    // 2. Cek user — BCrypt pada tabel `users`. Tidak ada fallback ke AES.
    // Hak akses juga dibaca dari `users`, bukan tabel `user` lama.
    let user_row: Option<UserRow> = check_user_bcrypt(&state.pool, &req.username, &req.password).await
        .map_err(|e| {
            tracing::error!("DB error cek user: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
        })?;

    match user_row {
        None => { login_rate_fail(&ip); account_fail(&req.username); Err(err_invalid()) }
        Some(u) => {
            // enum('true','false') di MariaDB → diambil sbg String, bandingkan eq "true"
            let to_bool = |v: &str| v == "true";
            let mut permissions = HashMap::new();
            permissions.insert("registrasi".to_string(), to_bool(&u.registrasi));
            permissions.insert("edit_registrasi".to_string(), to_bool(&u.edit_registrasi));
            permissions.insert("kasir_ralan".to_string(), to_bool(&u.kasir_ralan));
            permissions.insert("igd".to_string(), to_bool(&u.igd));
            permissions.insert("periksa_lab".to_string(), to_bool(&u.periksa_lab));
            permissions.insert("periksa_radiologi".to_string(), to_bool(&u.periksa_radiologi));
            permissions.insert("kamar_inap".to_string(), to_bool(&u.kamar_inap));
            permissions.insert("tindakan_ranap".to_string(), to_bool(&u.tindakan_ranap));
            permissions.insert("billing_ralan".to_string(), to_bool(&u.billing_ralan));
            permissions.insert("billing_ranap".to_string(), to_bool(&u.billing_ranap));
            permissions.insert("penjualan_obat".to_string(), to_bool(&u.penjualan_obat));
            permissions.insert("resep_obat".to_string(), to_bool(&u.resep_obat));
            permissions.insert("resep_dokter".to_string(), to_bool(&u.resep_dokter));
            permissions.insert("beri_obat".to_string(), to_bool(&u.beri_obat));
            permissions.insert("permintaan_lab".to_string(), to_bool(&u.permintaan_lab));
            permissions.insert("permintaan_radiologi".to_string(), to_bool(&u.permintaan_radiologi));
            permissions.insert("operasi".to_string(), to_bool(&u.operasi));
            permissions.insert("pasien".to_string(), to_bool(&u.pasien));
            permissions.insert("dokter".to_string(), to_bool(&u.dokter));
            permissions.insert("petugas".to_string(), to_bool(&u.petugas));
            permissions.insert("obat".to_string(), to_bool(&u.obat));
            permissions.insert("satu_sehat_mapping_radiologi".to_string(), to_bool(&u.satu_sehat_mapping_radiologi));
            permissions.insert("surat_persetujuan_umum".to_string(), to_bool(&u.surat_persetujuan_umum));
            permissions.insert("surat_pernyataan_pasien_umum".to_string(), to_bool(&u.surat_pernyataan_pasien_umum));
            permissions.insert("surat_keterangan_sehat".to_string(), to_bool(&u.surat_keterangan_sehat));
            permissions.insert("surat_bebas_narkoba".to_string(), to_bool(&u.surat_bebas_narkoba));

            // Merge web permissions dari simrscb_user_permissions.
            // Identifier yang dipakai: req.username (= NIP plain text yang diketik user).
            // Ini lebih stabil daripada `u.id_user` yang encrypted blob.
            let web_perms = crate::handlers::web_perms::load_web_perms_for(
                &state.pool,
                &req.username,
            ).await;
            for (key, val) in web_perms {
                permissions.insert(key, val);
            }

            let exp = chrono::Utc::now().timestamp() as usize + 14400; // 4 jam
            let claims = Claims {
                sub: req.username.clone(),
                // kode = NIP plaintext yang diketik user. JANGAN pakai u.id_user —
                // itu blob AES_ENCRYPT (tampil sbg NIP garbage di form surat).
                kode: req.username.clone(),
                nama: u.nama.clone(),
                is_admin: false,
                permissions,
                exp,
            };
            let token = encode_jwt(&claims, &state.jwt_secret).map_err(|_| {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal buat token"})))
            })?;
            login_rate_reset(&ip);
            account_reset(&req.username);
            crate::audit::log_login(&state.pool, &claims.kode).await;
            Ok(Json(LoginResponse {
                token,
                kode: claims.kode,
                nama: claims.nama,
                is_admin: false,
                permissions: claims.permissions,
            }))
        }
    }
}

pub async fn logout() -> Json<Value> {
    Json(json!({"message": "Logout berhasil"}))
}

#[derive(sqlx::FromRow)]
struct UserRow {
    #[allow(dead_code)] // dipilih di SQL utk fallback IFNULL(p.nama, u.id_user); tak dibaca di Rust
    id_user: String,
    nama: String,
    registrasi: String,
    edit_registrasi: String,
    kasir_ralan: String,
    igd: String,
    periksa_lab: String,
    periksa_radiologi: String,
    kamar_inap: String,
    tindakan_ranap: String,
    billing_ralan: String,
    billing_ranap: String,
    penjualan_obat: String,
    resep_obat: String,
    resep_dokter: String,
    beri_obat: String,
    permintaan_lab: String,
    permintaan_radiologi: String,
    operasi: String,
    pasien: String,
    dokter: String,
    petugas: String,
    obat: String,
    satu_sehat_mapping_radiologi: String,
    surat_persetujuan_umum: String,
    surat_pernyataan_pasien_umum: String,
    surat_keterangan_sehat: String,
    surat_bebas_narkoba: String,
}

// ── BCrypt-only auth (ITSA BSSN hardening) ──────────────────────────────────
// Prasyarat: jalankan MigrasiBcrypt.java dulu untuk mengisi tabel users/admins.
// Tabel lama user/admin tetap utuh untuk Khanza desktop versi lama.

/// Cek admin: BCrypt di tabel admins.
async fn check_admin_bcrypt(pool: &sqlx::MySqlPool, username: &str, password: &str) -> Result<bool, sqlx::Error> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT password_hash FROM admins WHERE username = ? LIMIT 1"
    ).bind(username).fetch_optional(pool).await?;

    match row {
        Some((hash,)) => Ok(bcrypt::verify(password, &hash).unwrap_or(false)),
        None => Ok(false),
    }
}

/// Cek user: BCrypt dan hak akses sama-sama dari tabel `users`.
///
/// Hak akses sengaja TIDAK dibaca dari tabel `user` lama. Sejak DlgUpdateUser
/// (Khanza desktop) menulis hak akses ke `users`, membaca dari `user` akan
/// menampilkan izin basi — perubahan yang dibuat admin lewat desktop tidak
/// akan terlihat di web. Tabel lama juga dijadwalkan di-drop, yang akan
/// mematikan login web bila masih di-JOIN di sini.
async fn check_user_bcrypt(pool: &sqlx::MySqlPool, username: &str, password: &str) -> Result<Option<UserRow>, sqlx::Error> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT password_hash FROM users WHERE username = ? LIMIT 1"
    ).bind(username).fetch_optional(pool).await?;

    let ok = match row {
        Some((hash,)) => bcrypt::verify(password, &hash).unwrap_or(false),
        None => false,
    };

    if !ok { return Ok(None); }

    // Password cocok — ambil hak akses (tanpa cek password lagi).
    // `username` sudah plaintext, jadi JOIN ke pegawai cukup lewat users.nik
    // tanpa AES_DECRYPT seperti pada tabel lama.
    let user_row: Option<UserRow> = sqlx::query_as(
        "SELECT u.username as id_user, IFNULL(p.nama, u.username) as nama,
                u.registrasi, u.edit_registrasi, u.kasir_ralan, u.igd, u.periksa_lab, u.periksa_radiologi,
                u.kamar_inap, u.tindakan_ranap, u.billing_ralan, u.billing_ranap,
                u.penjualan_obat, u.resep_obat, u.resep_dokter, u.beri_obat,
                u.permintaan_lab, u.permintaan_radiologi, u.operasi,
                u.pasien, u.dokter, u.petugas, u.obat,
                IFNULL(u.satu_sehat_mapping_radiologi,'false') as satu_sehat_mapping_radiologi,
                IFNULL(u.surat_persetujuan_umum,'false') as surat_persetujuan_umum,
                IFNULL(u.surat_pernyataan_pasien_umum,'false') as surat_pernyataan_pasien_umum,
                IFNULL(u.surat_keterangan_sehat,'false') as surat_keterangan_sehat,
                IFNULL(u.surat_bebas_narkoba,'false') as surat_bebas_narkoba
         FROM users u
         LEFT JOIN pegawai p ON p.nik = u.nik
         WHERE u.username = ? LIMIT 1"
    ).bind(username).fetch_optional(pool).await?;

    Ok(user_row)
}

const ALL_PERMISSIONS: &[&str] = &[
    "registrasi", "edit_registrasi", "kasir_ralan", "igd", "periksa_lab", "periksa_radiologi",
    "kamar_inap", "tindakan_ranap", "billing_ralan", "billing_ranap",
    "penjualan_obat", "resep_obat", "resep_dokter", "beri_obat",
    "permintaan_lab", "permintaan_radiologi", "operasi",
    "pasien", "dokter", "petugas", "obat",
];

#[cfg(test)]
mod tests {
    /// Hash di tabel `users`/`admins` dibuat oleh jBCrypt (Java), tetapi yang
    /// memverifikasi saat login adalah crate `bcrypt` (Rust). Kalau kedua
    /// pustaka tidak sepakat, TIDAK ADA yang bisa login — jadi kompatibilitas
    /// itu dikunci di sini. Vektor di bawah dihasilkan jBCrypt 0.4 gensalt(12),
    /// cost yang sama dengan seeding. Password uji, bukan kredensial nyata.
    #[test]
    fn verifikasi_hash_buatan_jbcrypt() {
        const PASSWORD: &str = "uji-lintas-pustaka-2026";
        const HASH_JBCRYPT: &str =
            "$2a$12$4bZgy/cKKTOJJAXIgXARzurgRgiL0kcuhMrlu9MH4rjNk8J16TbFO";

        assert!(bcrypt::verify(PASSWORD, HASH_JBCRYPT).unwrap(),
                "crate bcrypt gagal memverifikasi hash jBCrypt — login akan mati");
        assert!(!bcrypt::verify("password-salah", HASH_JBCRYPT).unwrap(),
                "password salah justru diterima");
    }
}
