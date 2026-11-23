//! Replikasi `AESsecurity.EnkripsiAES` dari SIMRS Khanza desktop (Java).
//!
//! Spesifikasi (sama persis dengan Java):
//! - Algoritma: AES-128-CBC dengan PKCS#5 (= PKCS#7) padding
//! - Output: Base64 standard (with padding)
//!
//! Dipakai untuk membuat dan memverifikasi link verifikasi surat, agar URL yang
//! dihasilkan desktop maupun web bisa diverifikasi oleh endpoint yang sama.
//!
//! Kunci dibaca dari env `AES_KEY` / `AES_IV` (lihat `.env`), bukan ditanam di
//! source — menanamnya di sini akan ikut ter-commit dan mengulang temuan ITSA
//! BSSN "hardcoded key". Bila env tidak diset, dipakai kunci bawaan Khanza,
//! sama seperti perilaku Java sebelum rotasi.
//!
//! `decrypt` mencoba kunci aktif lebih dulu, lalu jatuh ke kunci bawaan. Fallback
//! ini menjaga QR surat yang terbit sebelum rotasi kunci (2026-10-25) tetap bisa
//! diverifikasi; boleh dicabut setelah surat-surat tersebut tidak lagi beredar.

use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use aes::Aes128;
use base64::{engine::general_purpose::STANDARD, Engine};
use cbc::{Decryptor, Encryptor};
use std::sync::OnceLock;

/// Kunci bawaan Khanza. Sudah tersebar publik, jadi tidak ada nilai rahasia yang
/// hilang dengan menuliskannya; hanya dipakai sebagai fallback dekripsi.
const LEGACY_KEY: [u8; 16] = *b"Bar12345Bar12345";
const LEGACY_IV: [u8; 16] = *b"sayangsamakhanza";

type Aes128CbcEnc = Encryptor<Aes128>;
type Aes128CbcDec = Decryptor<Aes128>;

/// Kunci aktif, dibaca sekali dari environment.
fn active() -> ([u8; 16], [u8; 16]) {
    static ACTIVE: OnceLock<([u8; 16], [u8; 16])> = OnceLock::new();
    *ACTIVE.get_or_init(|| {
        (
            env_key("AES_KEY").unwrap_or(LEGACY_KEY),
            env_key("AES_IV").unwrap_or(LEGACY_IV),
        )
    })
}

/// AES-128 mewajibkan kunci tepat 16 byte. Panjang lain diabaikan dengan peringatan
/// agar salah ketik di `.env` tidak diam-diam melumpuhkan verifikasi surat.
fn env_key(name: &str) -> Option<[u8; 16]> {
    let raw = std::env::var(name).ok()?;
    if raw.len() != 16 {
        eprintln!(
            "[enkripsi_aes] {name} diabaikan: panjang {} byte, wajib tepat 16. Memakai kunci bawaan.",
            raw.len()
        );
        return None;
    }
    let mut out = [0u8; 16];
    out.copy_from_slice(raw.as_bytes());
    Some(out)
}

pub fn encrypt(plain: &str) -> String {
    let (key, iv) = active();
    let cipher = Aes128CbcEnc::new(&key.into(), &iv.into());
    STANDARD.encode(cipher.encrypt_padded_vec_mut::<Pkcs7>(plain.as_bytes()))
}

pub fn decrypt(b64: &str) -> Option<String> {
    let ct = STANDARD.decode(b64).ok()?;
    let (key, iv) = active();

    if let Some(plain) = decrypt_with(&ct, &key, &iv) {
        return Some(plain);
    }
    // QR terbitan sebelum rotasi kunci.
    if (key, iv) != (LEGACY_KEY, LEGACY_IV) {
        return decrypt_with(&ct, &LEGACY_KEY, &LEGACY_IV);
    }
    None
}

fn decrypt_with(ct: &[u8], key: &[u8; 16], iv: &[u8; 16]) -> Option<String> {
    let cipher = Aes128CbcDec::new(key.into(), iv.into());
    let pt = cipher.decrypt_padded_vec_mut::<Pkcs7>(ct).ok()?;
    String::from_utf8(pt).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip() {
        let s = "{'x': 'skd', 't':'SKS-20260427-001'}";
        assert_eq!(s, decrypt(&encrypt(s)).unwrap());
    }

    /// QR lama (kunci bawaan) harus tetap terbaca walau kunci aktif sudah dirotasi.
    #[test]
    fn fallback_membaca_ciphertext_kunci_lama() {
        let plain = "{'x': 'skd', 't':'SKS-LAMA-001'}";

        let legacy = Aes128CbcEnc::new(&LEGACY_KEY.into(), &LEGACY_IV.into());
        let legacy_ct = STANDARD.encode(legacy.encrypt_padded_vec_mut::<Pkcs7>(plain.as_bytes()));

        assert_eq!(decrypt(&legacy_ct).as_deref(), Some(plain));
    }

    /// Kunci dengan panjang salah diabaikan, tidak membuat panic.
    #[test]
    fn panjang_kunci_salah_diabaikan() {
        assert_eq!(env_key("AES_KEY_TIDAK_ADA_DI_ENV"), None);
    }

    /// Known-answer test lintas bahasa: ciphertext di bawah dibuat oleh
    /// `javax.crypto` (AES/CBC/PKCS5Padding) dengan kunci dummy. Kalau tes ini
    /// gagal, QR terbitan desktop Java tidak akan terbaca di sini — itu kegagalan
    /// yang membuat semua surat tidak terverifikasi, jadi pastikan tetap hijau.
    /// Kunci dummy sengaja dipakai agar kunci produksi tidak masuk repo.
    #[test]
    fn cocok_dengan_ciphertext_java() {
        const JAVA_KEY: [u8; 16] = *b"TestKey123456789";
        const JAVA_IV: [u8; 16] = *b"TestIV1234567890";
        const JAVA_CT: &str =
            "ogin5oIzk1ZhNAnv1sTtLLVqQsFczq8/9X4FrEhEE839PiQ8gDm8Qug2IxrNSu1f";

        let ct = STANDARD.decode(JAVA_CT).expect("base64 valid");
        assert_eq!(
            decrypt_with(&ct, &JAVA_KEY, &JAVA_IV).as_deref(),
            Some("{'x': 'skd', 't':'SKS-20261025-007'}")
        );
    }
}
