//! TTE internal untuk SOP / dokumen mutu, lewat BSrE.
//!
//! Alur, dan urutannya tidak boleh dibalik:
//!
//! ```text
//!   unggah .docx/.pdf  →  (soffice: docx→pdf)  →  stamp.py --mode deteksi
//!        → status 'draft', koordinat #TTD# tersimpan
//!   tanda tangani      →  stamp.py --mode tempel  (stempel RS + QR + tutup penanda)
//!                      →  BSrE /api/v2/sign/pdf   (gambar TTD + PAdES)
//!                      → status 'ditandatangani', SHA-256 tersimpan
//! ```
//!
//! Stempel dan QR WAJIB ditempel sebelum BSrE menandatangani. Mengubah PDF
//! sesudahnya -- bahkan sekadar menambah gambar -- membuat Adobe Reader
//! menampilkan tanda tangannya sebagai tidak sah.
//!
//! Yang membuat Adobe mengenali tanda tangan ini adalah BSrE, bukan kita:
//! ia menanamkan PKCS#7/CMS di dalam PDF. Gambar tidak pernah terdeteksi
//! Adobe, semirip apa pun dengan tanda tangan basah.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Multipart, Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

type Gagal = (StatusCode, Json<Value>);

fn db_err(e: sqlx::Error) -> Gagal {
    tracing::error!("DB tte_sop: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data TTE"})))
}
fn salah(kode: StatusCode, pesan: impl Into<String>) -> Gagal {
    (kode, Json(json!({ "error": pesan.into() })))
}
fn adminonly(u: &AuthUser) -> Result<(), Gagal> {
    if u.0.is_admin { Ok(()) } else { Err(salah(StatusCode::FORBIDDEN, "Hanya admin")) }
}
/// Yang boleh menandatangani: admin, atau pemegang hak `tte_sop`.
fn boleh_tandatangan(u: &AuthUser) -> Result<(), Gagal> {
    if u.0.is_admin || *u.0.permissions.get("tte_sop").unwrap_or(&false) {
        Ok(())
    } else {
        Err(salah(StatusCode::FORBIDDEN, "Tidak punya hak menandatangani SOP"))
    }
}

fn dir_tte() -> String {
    std::env::var("TTE_DIR")
        .unwrap_or_else(|_| "/var/www/html/webapps/simrscb/tte".to_string())
}
fn bin_python() -> String {
    std::env::var("TTE_PYTHON").unwrap_or_else(|_| "scripts/venv/bin/python".to_string())
}
fn skrip_stamp() -> String {
    std::env::var("TTE_STAMP").unwrap_or_else(|_| "scripts/stamp.py".to_string())
}
fn bin_soffice() -> String {
    std::env::var("SOFFICE_BIN").unwrap_or_else(|_| "soffice".to_string())
}

fn sha256_hex(b: &[u8]) -> String {
    Sha256::digest(b).iter().map(|x| format!("{:02x}", x)).collect()
}

async fn cfg(pool: &sqlx::MySqlPool, kunci: &str) -> String {
    sqlx::query_scalar::<_, String>("SELECT nilai FROM simrscb_config WHERE kunci = ? LIMIT 1")
        .bind(kunci)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .unwrap_or_default()
}

async fn catat_gagal(pool: &sqlx::MySqlPool, dokumen_id: Option<i32>, nomor: &str,
                     pesan: &str, kode: &str, oleh: &str) {
    let _ = sqlx::query(
        "INSERT INTO simrscb_tte_log (dokumen_id, nomor, pesan, status_code, oleh) \
         VALUES (?,?,?,?,?)")
        .bind(dokumen_id).bind(nomor).bind(pesan).bind(kode).bind(oleh)
        .execute(pool).await;
}

// ---------------------------------------------------------------- spesimen

/// Enkripsi gambar spesimen.
///
/// Sengaja TIDAK memakai `crate::enkripsi_aes`: modul itu wajib memakai IV tetap
/// dan jatuh ke kunci bawaan Khanza yang sudah tersebar publik, karena harus
/// kompatibel dengan QR terbitan desktop Java. Itu pantas untuk token verifikasi,
/// tapi tidak untuk gambar tanda tangan Direktur -- benda yang tidak bisa
/// dirotasi kalau bocor.
///
/// Format tersimpan: `base64(iv) : base64(hmac) : base64(ciphertext)`.
/// HMAC melindungi dari penggantian diam-diam gambar spesimen di level DB.
mod spesimen_kripto {
    use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, BlockEncryptMut, KeyIvInit};
    use aes::Aes128;
    use base64::{engine::general_purpose::STANDARD, Engine};
    use hmac::{Hmac, Mac};
    use rand::RngCore;
    use sha2::Sha256;

    type Enc = cbc::Encryptor<Aes128>;
    type Dec = cbc::Decryptor<Aes128>;

    /// Kunci wajib dari env. Tidak ada kunci bawaan: lebih baik fitur menolak
    /// bekerja daripada diam-diam melindungi tanda tangan Direktur dengan kunci
    /// yang bisa ditebak siapa pun.
    fn kunci() -> Result<[u8; 16], String> {
        let raw = std::env::var("TTE_SPESIMEN_KEY").map_err(|_| {
            "TTE_SPESIMEN_KEY belum diset di environment backend. \
             Spesimen tanda tangan tidak akan disimpan tanpa kunci enkripsi.".to_string()
        })?;
        if raw.len() != 16 {
            return Err(format!(
                "TTE_SPESIMEN_KEY harus tepat 16 karakter, saat ini {}.", raw.len()));
        }
        let mut k = [0u8; 16];
        k.copy_from_slice(raw.as_bytes());
        Ok(k)
    }

    fn mac(k: &[u8; 16], iv: &[u8], ct: &[u8]) -> Vec<u8> {
        let mut m = <Hmac<Sha256>>::new_from_slice(k).expect("hmac menerima kunci 16 byte");
        m.update(iv);
        m.update(ct);
        m.finalize().into_bytes().to_vec()
    }

    pub fn enkripsi(data: &[u8]) -> Result<String, String> {
        let k = kunci()?;
        let mut iv = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut iv);
        let ct = Enc::new(&k.into(), &iv.into()).encrypt_padded_vec_mut::<Pkcs7>(data);
        Ok(format!("{}:{}:{}", STANDARD.encode(iv),
                   STANDARD.encode(mac(&k, &iv, &ct)), STANDARD.encode(&ct)))
    }

    pub fn dekripsi(simpan: &str) -> Result<Vec<u8>, String> {
        let k = kunci()?;
        let bagian: Vec<&str> = simpan.splitn(3, ':').collect();
        if bagian.len() != 3 {
            return Err("Format spesimen tersimpan tidak dikenali".into());
        }
        let iv = STANDARD.decode(bagian[0]).map_err(|_| "IV spesimen rusak")?;
        let tag = STANDARD.decode(bagian[1]).map_err(|_| "HMAC spesimen rusak")?;
        let ct = STANDARD.decode(bagian[2]).map_err(|_| "Ciphertext spesimen rusak")?;

        // Perbandingan HMAC sebelum dekripsi, dan dalam waktu tetap.
        let harap = mac(&k, &iv, &ct);
        if harap.len() != tag.len()
            || harap.iter().zip(&tag).fold(0u8, |a, (x, y)| a | (x ^ y)) != 0
        {
            return Err("Spesimen gagal diverifikasi — isinya berubah atau kunci berbeda".into());
        }
        let ivb: [u8; 16] = iv.try_into().map_err(|_| "Panjang IV spesimen salah")?;
        Dec::new(&k.into(), &ivb.into())
            .decrypt_padded_vec_mut::<Pkcs7>(&ct)
            .map_err(|_| "Gagal mendekripsi spesimen".into())
    }
}

#[derive(Serialize, sqlx::FromRow)]
pub struct SpesimenRow {
    pub id: i32,
    pub jenis: String,
    pub pejabat_nik: String,
    pub pejabat_nama: String,
    pub jabatan: String,
    pub lebar_px: i32,
    pub tinggi_px: i32,
    pub tinggi_mm: f32,
    pub mulai: chrono::NaiveDate,
    pub selesai: Option<chrono::NaiveDate>,
    pub dibuat_oleh: String,
}

/// GET /api/tte-spesimen — daftar spesimen. Gambarnya TIDAK ikut: daftar ini
/// dipakai untuk memilih, dan mengirim gambar tanda tangan ke setiap pemuatan
/// halaman adalah penyebaran yang tidak perlu.
pub async fn spesimen_list(u: AuthUser, State(s): State<AppState>)
  -> Result<Json<Vec<SpesimenRow>>, Gagal> {
    adminonly(&u)?;
    let rows = sqlx::query_as::<_, SpesimenRow>(
        "SELECT id, jenis, pejabat_nik, pejabat_nama, jabatan, lebar_px, tinggi_px, \
                tinggi_mm, mulai, selesai, dibuat_oleh \
         FROM simrscb_tte_spesimen ORDER BY jenis, selesai IS NOT NULL, mulai DESC")
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

/// GET /api/tte-spesimen/:id/gambar — pratinjau. Dilayani sebagai PNG dengan
/// `no-store`: pratinjau tidak boleh mengendap di cache browser atau proxy.
pub async fn spesimen_gambar(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Response, Gagal> {
    adminonly(&u)?;
    let simpan = sqlx::query_scalar::<_, String>(
        "SELECT gambar_terenkripsi FROM simrscb_tte_spesimen WHERE id=?")
        .bind(id).fetch_optional(&s.pool).await.map_err(db_err)?
        .ok_or_else(|| salah(StatusCode::NOT_FOUND, "Spesimen tidak ditemukan"))?;
    let png = spesimen_kripto::dekripsi(&simpan)
        .map_err(|e| salah(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(([(header::CONTENT_TYPE, "image/png"),
         (header::CACHE_CONTROL, "no-store")], png).into_response())
}

/// POST /api/tte-spesimen — unggah spesimen baru (multipart).
pub async fn spesimen_simpan(u: AuthUser, State(s): State<AppState>, mut mp: Multipart)
  -> Result<Json<Value>, Gagal> {
    adminonly(&u)?;

    let (mut jenis, mut nik, mut nama, mut jabatan) =
        (String::new(), String::new(), String::new(), String::new());
    let (mut mulai, mut selesai, mut tinggi_mm) = (String::new(), String::new(), 16.0f32);
    let mut png: Vec<u8> = Vec::new();

    while let Some(f) = mp.next_field().await
        .map_err(|e| salah(StatusCode::BAD_REQUEST, format!("multipart: {e}")))? {
        match f.name().unwrap_or("") {
            "file" => png = f.bytes().await
                .map_err(|e| salah(StatusCode::BAD_REQUEST, format!("baca file: {e}")))?.to_vec(),
            "jenis"     => jenis = f.text().await.unwrap_or_default(),
            "nik"       => nik = f.text().await.unwrap_or_default(),
            "nama"      => nama = f.text().await.unwrap_or_default(),
            "jabatan"   => jabatan = f.text().await.unwrap_or_default(),
            "mulai"     => mulai = f.text().await.unwrap_or_default(),
            "selesai"   => selesai = f.text().await.unwrap_or_default(),
            "tinggi_mm" => tinggi_mm = f.text().await.unwrap_or_default().parse().unwrap_or(16.0),
            _ => {}
        }
    }

    if !matches!(jenis.as_str(), "ttd" | "stempel" | "logo") {
        return Err(salah(StatusCode::BAD_REQUEST, "Jenis harus 'ttd', 'stempel' atau 'logo'"));
    }
    if png.is_empty() {
        return Err(salah(StatusCode::BAD_REQUEST, "Berkas gambar kosong"));
    }
    // PNG wajib, dan harus benar-benar punya kanal alfa. JPG tidak punya
    // transparansi, jadi tanda tangannya akan tercetak sebagai kotak putih yang
    // menutupi teks di bawahnya -- kesalahan yang nyaris pasti terjadi kalau
    // tidak dicegah di sini, dan baru ketahuan setelah dokumen ditandatangani.
    let (lebar, tinggi, punya_alfa) = periksa_png(&png)
        .map_err(|e| salah(StatusCode::BAD_REQUEST, e))?;
    if !punya_alfa {
        return Err(salah(StatusCode::BAD_REQUEST,
            "PNG ini tidak punya kanal transparansi. Tanda tangan akan tercetak \
             sebagai kotak putih yang menutupi teks di bawahnya. Simpan ulang \
             sebagai PNG berlatar transparan."));
    }

    if nik.is_empty() && jenis == "ttd" {
        return Err(salah(StatusCode::BAD_REQUEST, "NIK wajib untuk spesimen tanda tangan"));
    }
    if jenis == "ttd" && (nik.len() != 16 || !nik.chars().all(|c| c.is_ascii_digit())) {
        return Err(salah(StatusCode::BAD_REQUEST, "NIK harus 16 digit angka"));
    }
    if mulai.is_empty() {
        return Err(salah(StatusCode::BAD_REQUEST, "Tanggal mulai berlaku wajib diisi"));
    }

    let terenkripsi = spesimen_kripto::enkripsi(&png)
        .map_err(|e| salah(StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // Satu spesimen aktif per jenis per pejabat: yang lama ditutup, tidak dihapus.
    // Dokumen yang sudah ditandatangani harus tetap bisa menunjuk spesimen yang
    // berlaku saat itu.
    sqlx::query(
        "UPDATE simrscb_tte_spesimen SET selesai = DATE_SUB(?, INTERVAL 1 DAY) \
         WHERE jenis=? AND pejabat_nik=? AND selesai IS NULL")
        .bind(&mulai).bind(&jenis).bind(&nik)
        .execute(&s.pool).await.map_err(db_err)?;

    let r = sqlx::query(
        "INSERT INTO simrscb_tte_spesimen \
         (jenis, pejabat_nik, pejabat_nama, jabatan, gambar_terenkripsi, \
          lebar_px, tinggi_px, tinggi_mm, mulai, selesai, dibuat_oleh) \
         VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&jenis).bind(&nik).bind(&nama).bind(&jabatan).bind(&terenkripsi)
        .bind(lebar as i32).bind(tinggi as i32).bind(tinggi_mm).bind(&mulai)
        .bind(if selesai.is_empty() { None } else { Some(selesai) })
        .bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;

    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}

/// DELETE /api/tte-spesimen/:id — hanya untuk spesimen yang belum pernah dipakai.
pub async fn spesimen_hapus(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, Gagal> {
    adminonly(&u)?;
    let dipakai: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM simrscb_tte_dokumen \
         WHERE spesimen_ttd_id=? OR spesimen_stempel_id=?")
        .bind(id).bind(id).fetch_one(&s.pool).await.map_err(db_err)?;
    if dipakai > 0 {
        return Err(salah(StatusCode::CONFLICT, format!(
            "Spesimen ini sudah dipakai pada {dipakai} dokumen dan tidak bisa dihapus. \
             Tutup masa berlakunya dengan mengisi tanggal selesai.")));
    }
    sqlx::query("DELETE FROM simrscb_tte_spesimen WHERE id=?")
        .bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

/// Dimensi + ada-tidaknya kanal alfa, dibaca dari header IHDR PNG.
///
/// Dibaca manual alih-alih menarik crate `image`: yang dibutuhkan hanya 26 byte
/// pertama, dan menambah dependensi sebesar itu untuk satu pemeriksaan tidak
/// sebanding.
fn periksa_png(b: &[u8]) -> Result<(u32, u32, bool), String> {
    const TANDA: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];
    if b.len() < 26 || b[..8] != TANDA {
        return Err("Berkas harus PNG. JPG tidak punya kanal transparansi.".into());
    }
    if &b[12..16] != b"IHDR" {
        return Err("Struktur PNG tidak dikenali (IHDR tidak di awal)".into());
    }
    let lebar = u32::from_be_bytes([b[16], b[17], b[18], b[19]]);
    let tinggi = u32::from_be_bytes([b[20], b[21], b[22], b[23]]);
    // color type: 4 = grayscale+alpha, 6 = RGB+alpha, 3 = palette (bisa punya tRNS)
    let jenis_warna = b[25];
    let alfa = jenis_warna == 4
        || jenis_warna == 6
        || (jenis_warna == 3 && b.windows(4).any(|w| w == b"tRNS"));
    Ok((lebar, tinggi, alfa))
}

// ---------------------------------------------------------------- dokumen

#[derive(Serialize, sqlx::FromRow)]
pub struct DokumenRow {
    pub id: i32,
    pub nomor: String,
    pub judul: String,
    pub status: String,
    pub halaman: i32,
    pub penandatangan_nama: String,
    pub ditandatangani_oleh: String,
    pub ditandatangani_pada: Option<chrono::NaiveDateTime>,
    pub hash_hasil: String,
    pub diunggah_oleh: String,
    pub created_at: Option<chrono::NaiveDateTime>,
}

#[derive(Deserialize)]
pub struct ListQuery {
    #[serde(default)] pub status: Option<String>,
}

/// GET /api/tte-sop
pub async fn list(u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQuery>)
  -> Result<Json<Vec<DokumenRow>>, Gagal> {
    let _ = &u;
    let status = q.status.unwrap_or_default();
    let rows = sqlx::query_as::<_, DokumenRow>(
        "SELECT id, nomor, judul, status, halaman, penandatangan_nama, \
                ditandatangani_oleh, ditandatangani_pada, hash_hasil, diunggah_oleh, created_at \
         FROM simrscb_tte_dokumen \
         WHERE (? = '' OR status = ?) ORDER BY id DESC LIMIT 300")
        .bind(&status).bind(&status)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

/// Jalankan stamp.py. Spesifikasi lewat stdin supaya gambar spesimen tidak
/// pernah muncul di daftar proses maupun menyentuh disk.
async fn jalankan_stamp(mode: &str, spek: &Value) -> Result<Value, String> {
    use tokio::io::AsyncWriteExt;

    let mut anak = tokio::process::Command::new(bin_python())
        .arg(skrip_stamp()).arg("--mode").arg(mode)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("tidak bisa menjalankan stamp.py: {e}"))?;

    anak.stdin.as_mut().ok_or("stdin stamp.py tidak tersedia")?
        .write_all(spek.to_string().as_bytes()).await
        .map_err(|e| format!("kirim spesifikasi: {e}"))?;
    anak.stdin.take();

    let out = anak.wait_with_output().await.map_err(|e| format!("stamp.py: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    if stdout.trim().is_empty() {
        return Err(format!("stamp.py tidak memberi keluaran. stderr: {}",
                           String::from_utf8_lossy(&out.stderr)));
    }
    serde_json::from_str::<Value>(&stdout)
        .map_err(|e| format!("keluaran stamp.py tidak terbaca: {e}"))
}

/// Konversi .docx → .pdf lewat LibreOffice headless.
///
/// Dipakai sebagai jalur yang disarankan, bukan sekadar kemudahan: PDF hasil
/// LibreOffice selalu punya lapisan teks, jadi penanda #TTD# pasti bisa
/// ditemukan. PDF hasil pindai tidak punya lapisan teks sama sekali.
async fn docx_ke_pdf(masuk: &str, keluar_dir: &str) -> Result<String, String> {
    let out = tokio::process::Command::new(bin_soffice())
        .args(["--headless", "--norestore",
               &format!("-env:UserInstallation=file://{keluar_dir}/profile"),
               "--convert-to", "pdf", "--outdir", keluar_dir, masuk])
        .output().await.map_err(|e| format!("soffice: {e}"))?;
    if !out.status.success() {
        return Err(format!("konversi dokumen gagal: {}", String::from_utf8_lossy(&out.stderr)));
    }
    let stem = std::path::Path::new(masuk).file_stem().and_then(|x| x.to_str()).unwrap_or("dok");
    Ok(format!("{keluar_dir}/{stem}.pdf"))
}

/// POST /api/tte-sop/unggah — multipart: file, nomor, judul, sop_id?
pub async fn unggah(u: AuthUser, State(s): State<AppState>, mut mp: Multipart)
  -> Result<Json<Value>, Gagal> {
    let (mut nomor, mut judul, mut sop_id) = (String::new(), String::new(), None::<i64>);
    let (mut isi, mut nama_asli) = (Vec::new(), String::new());

    while let Some(f) = mp.next_field().await
        .map_err(|e| salah(StatusCode::BAD_REQUEST, format!("multipart: {e}")))? {
        match f.name().unwrap_or("") {
            "file" => {
                nama_asli = f.file_name().unwrap_or("dokumen").to_string();
                isi = f.bytes().await
                    .map_err(|e| salah(StatusCode::BAD_REQUEST, format!("baca file: {e}")))?.to_vec();
            }
            "nomor"  => nomor = f.text().await.unwrap_or_default(),
            "judul"  => judul = f.text().await.unwrap_or_default(),
            "sop_id" => sop_id = f.text().await.ok().and_then(|x| x.parse().ok()),
            _ => {}
        }
    }
    if isi.is_empty() { return Err(salah(StatusCode::BAD_REQUEST, "Berkas kosong")); }
    if nomor.trim().is_empty() || judul.trim().is_empty() {
        return Err(salah(StatusCode::BAD_REQUEST, "Nomor dan judul wajib diisi"));
    }

    let hash_asli = sha256_hex(&isi);

    // Penjagaan terhadap penandatanganan ganda. Ini perlu karena white-out pada
    // penanda hanya menutup secara visual -- teks "#TTD#" masih ada di dalam
    // PDF hasil, jadi dokumen yang sudah ditandatangani tetap akan lolos deteksi
    // kalau diunggah ulang.
    if let Some(n) = sqlx::query_scalar::<_, String>(
        "SELECT nomor FROM simrscb_tte_dokumen WHERE hash_asli=? OR hash_hasil=? LIMIT 1")
        .bind(&hash_asli).bind(&hash_asli).fetch_optional(&s.pool).await.map_err(db_err)? {
        return Err(salah(StatusCode::CONFLICT,
            format!("Berkas ini sudah pernah didaftarkan dengan nomor {n}.")));
    }

    let dir = dir_tte();
    tokio::fs::create_dir_all(&dir).await
        .map_err(|e| salah(StatusCode::INTERNAL_SERVER_ERROR, format!("mkdir: {e}")))?;

    let ext = nama_asli.rsplit_once('.').map(|(_, b)| b.to_lowercase()).unwrap_or_default();
    if ext != "pdf" && ext != "docx" && ext != "doc" {
        return Err(salah(StatusCode::BAD_REQUEST, "Hanya .pdf, .docx atau .doc"));
    }
    let ts = chrono::Utc::now().timestamp_millis();
    let dasar = format!("{dir}/draft-{ts}");
    let simpan_awal = format!("{dasar}.{ext}");
    tokio::fs::write(&simpan_awal, &isi).await
        .map_err(|e| salah(StatusCode::INTERNAL_SERVER_ERROR, format!("tulis: {e}")))?;

    let pdf_draft = if ext == "pdf" {
        simpan_awal.clone()
    } else {
        let p = docx_ke_pdf(&simpan_awal, &dir).await
            .map_err(|e| salah(StatusCode::UNPROCESSABLE_ENTITY, e))?;
        let tujuan = format!("{dasar}.pdf");
        let _ = tokio::fs::rename(&p, &tujuan).await;
        tujuan
    };

    let hasil = jalankan_stamp("deteksi", &json!({ "pdf_masuk": pdf_draft })).await
        .map_err(|e| salah(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    let temuan = hasil.get("temuan").cloned().unwrap_or(json!({}));
    let ttd: Vec<Value> = temuan.get("#TTD#").and_then(|v| v.as_array()).cloned().unwrap_or_default();

    if ttd.len() != 1 {
        let pesan = if ttd.is_empty() {
            "Penanda #TTD# tidak ditemukan. Kalau dokumen ini hasil pindai, ia tidak \
             punya lapisan teks — unggah versi .docx-nya.".to_string()
        } else {
            format!("Penanda #TTD# ditemukan {} kali, harus tepat satu.", ttd.len())
        };
        let _ = tokio::fs::remove_file(&simpan_awal).await;
        catat_gagal(&s.pool, None, &nomor, &pesan, "DETEKSI", &u.0.kode).await;
        return Err(salah(StatusCode::UNPROCESSABLE_ENTITY, pesan));
    }

    let t = &ttd[0];
    let r = sqlx::query(
        "INSERT INTO simrscb_tte_dokumen \
         (sop_id, nomor, judul, file_asli, hash_asli, halaman, pos_x, pos_y, \
          status, diunggah_oleh) VALUES (?,?,?,?,?,?,?,?,'draft',?)")
        .bind(sop_id).bind(&nomor).bind(&judul)
        .bind(pdf_draft.rsplit('/').next().unwrap_or(""))
        .bind(&hash_asli)
        .bind(t["halaman"].as_i64().unwrap_or(0) as i32 + 1)
        .bind(t["x"].as_f64().unwrap_or(0.0))
        .bind(t["y_bawah"].as_f64().unwrap_or(0.0))
        .bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;

    Ok(Json(json!({
        "ok": true, "id": r.last_insert_id(), "temuan": temuan,
        "catatan": "Periksa pratinjau sebelum menandatangani — pastikan posisi \
                    tanda tangan tidak menimpa teks."
    })))
}

/// GET /api/tte-sop/:id/berkas — draft atau hasil, tergantung status.
pub async fn berkas(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Response, Gagal> {
    let _ = &u;
    let row = sqlx::query_as::<_, (String, String, String)>(
        "SELECT file_asli, file_hasil, nomor FROM simrscb_tte_dokumen WHERE id=?")
        .bind(id).fetch_optional(&s.pool).await.map_err(db_err)?
        .ok_or_else(|| salah(StatusCode::NOT_FOUND, "Dokumen tidak ditemukan"))?;

    let nama = if row.1.is_empty() { row.0 } else { row.1 };
    kirim_pdf(&nama, &row.2).await
}

async fn kirim_pdf(nama_berkas: &str, nomor: &str) -> Result<Response, Gagal> {
    if nama_berkas.is_empty()
        || nama_berkas.contains('/') || nama_berkas.contains('\\') || nama_berkas.contains("..") {
        return Err(salah(StatusCode::BAD_REQUEST, "Nama berkas tidak valid"));
    }
    let bytes = tokio::fs::read(format!("{}/{}", dir_tte(), nama_berkas)).await
        .map_err(|_| salah(StatusCode::NOT_FOUND, "Berkas tidak ditemukan di server"))?;
    let unduh = format!("inline; filename=\"{}.pdf\"", nomor.replace(['/', '"', '\\'], "-"));
    Ok(([(header::CONTENT_TYPE, "application/pdf".to_string()),
         (header::CONTENT_DISPOSITION, unduh)], bytes).into_response())
}

/// Apa yang digambar BSrE di posisi penanda tanda tangan.
///
/// `qr` adalah bawaan dan mengikuti konvensi SPBE yang sudah dipakai surat
/// dinas RS (lihat Surat Permohonan Uji Bridging TTE): yang tampak sebagai
/// tanda tangan justru QR berlogo, bukan goresan tangan. `gambar` dipakai
/// untuk dokumen yang memang menghendaki tanda tangan basah, seperti SOP
/// dengan blok "Ditetapkan oleh" beserta stempel.
fn gaya_default() -> String { "qr".to_string() }
fn metode_default() -> String { "bsre".to_string() }

#[derive(Deserialize)]
pub struct TandaTanganBody {
    /// `bsre`   — BSrE menandatangani secara kriptografis (PAdES). Adobe Reader
    ///            akan menampilkan panel tanda tangan. Butuh passphrase.
    /// `tempel` — sistem hanya menempelkan gambar tanda tangan, stempel dan QR.
    ///            Tidak butuh passphrase maupun sertifikat, tapi Adobe tidak
    ///            akan mendeteksi apa pun; keaslian bersandar pada QR + SHA-256.
    #[serde(default = "metode_default")] pub metode: String,
    #[serde(default)] pub passphrase: String,
    /// Wajib hanya bila `gaya_ttd` = "gambar".
    #[serde(default)] pub spesimen_ttd_id: Option<i32>,
    #[serde(default)] pub spesimen_stempel_id: Option<i32>,
    #[serde(default)] pub qr_di_sudut: bool,
    #[serde(default = "gaya_default")] pub gaya_ttd: String,
    /// NIK penandatangan; wajib bila gaya "qr" (tanpa spesimen tidak ada
    /// sumber NIK lain).
    #[serde(default)] pub nik: Option<String>,
}

/// POST /api/tte-sop/:id/tandatangani
///
/// Passphrase BSrE berfungsi sekaligus sebagai otentikasi ulang: hanya pemilik
/// sertifikat yang mengetahuinya, jadi sesi login yang kebetulan terbuka tidak
/// cukup untuk menandatangani.
pub async fn tandatangani(
    u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<TandaTanganBody>,
) -> Result<Json<Value>, Gagal> {
    boleh_tandatangan(&u)?;

    if !matches!(b.metode.as_str(), "bsre" | "tempel") {
        return Err(salah(StatusCode::BAD_REQUEST, "Metode harus 'bsre' atau 'tempel'"));
    }
    let pakai_bsre = b.metode == "bsre";
    if pakai_bsre && b.passphrase.trim().is_empty() {
        return Err(salah(StatusCode::BAD_REQUEST, "Passphrase BSrE wajib diisi"));
    }

    let dok = sqlx::query_as::<_, (String, String, String, String, i32, f32, f32)>(
        "SELECT nomor, judul, status, file_asli, halaman, pos_x, pos_y \
         FROM simrscb_tte_dokumen WHERE id=?")
        .bind(id).fetch_optional(&s.pool).await.map_err(db_err)?
        .ok_or_else(|| salah(StatusCode::NOT_FOUND, "Dokumen tidak ditemukan"))?;
    let (nomor, _judul, status, file_asli, halaman, pos_x, pos_y) = dok;

    if status != "draft" {
        return Err(salah(StatusCode::CONFLICT,
            format!("Dokumen berstatus '{status}', hanya draft yang bisa ditandatangani.")));
    }

    // --- spesimen tanda tangan ---
    //
    // Pada gaya "qr" tidak ada gambar tanda tangan sama sekali: yang tampak
    // adalah QR berlogo, dan identitas penandatangan diambil dari NIK yang
    // dikirim. Spesimen hanya dibutuhkan pada gaya "gambar".
    // Metode 'tempel' selalu butuh gambar: tanpa BSrE, tidak ada pihak lain
    // yang akan menggambar apa pun di posisi penanda.
    let gaya_gambar = !pakai_bsre || b.gaya_ttd == "gambar";
    let (ttd_png_opsi, nik, nama_pejabat, jabatan, ttd_tinggi_mm) = if gaya_gambar {
        let sid = b.spesimen_ttd_id.ok_or_else(|| salah(
            StatusCode::BAD_REQUEST, "Spesimen tanda tangan wajib dipilih untuk gaya 'gambar'"))?;
        let r = sqlx::query_as::<_, (String, String, String, String, f32)>(
            "SELECT gambar_terenkripsi, pejabat_nik, pejabat_nama, jabatan, tinggi_mm \
             FROM simrscb_tte_spesimen \
             WHERE id=? AND jenis='ttd' AND mulai <= CURDATE() \
               AND (selesai IS NULL OR selesai >= CURDATE())")
            .bind(sid).fetch_optional(&s.pool).await.map_err(db_err)?
            .ok_or_else(|| salah(StatusCode::UNPROCESSABLE_ENTITY,
                "Spesimen tanda tangan tidak ditemukan atau masa berlakunya sudah lewat"))?;
        let png = spesimen_kripto::dekripsi(&r.0)
            .map_err(|e| salah(StatusCode::INTERNAL_SERVER_ERROR, e))?;
        (Some(png), r.1, r.2, r.3, r.4)
    } else {
        let nik = b.nik.clone().unwrap_or_default();
        if nik.len() != 16 || !nik.chars().all(|c| c.is_ascii_digit()) {
            return Err(salah(StatusCode::BAD_REQUEST,
                "NIK penandatangan (16 digit) wajib diisi untuk gaya 'qr'"));
        }
        // Nama & jabatan diambil dari spesimen ber-NIK sama bila ada, supaya
        // kolom audit tidak kosong walau gambarnya tidak dipakai.
        let info = sqlx::query_as::<_, (String, String)>(
            "SELECT pejabat_nama, jabatan FROM simrscb_tte_spesimen \
             WHERE pejabat_nik=? ORDER BY selesai IS NULL DESC, mulai DESC LIMIT 1")
            .bind(&nik).fetch_optional(&s.pool).await.map_err(db_err)?
            .unwrap_or_default();
        (None, nik, info.0, info.1, 20.0f32)
    };

    let stempel_b64 = match b.spesimen_stempel_id {
        Some(sid) => {
            let simpan = sqlx::query_scalar::<_, String>(
                "SELECT gambar_terenkripsi FROM simrscb_tte_spesimen WHERE id=? AND jenis='stempel'")
                .bind(sid).fetch_optional(&s.pool).await.map_err(db_err)?
                .ok_or_else(|| salah(StatusCode::UNPROCESSABLE_ENTITY, "Spesimen stempel tidak ditemukan"))?;
            Some(STANDARD.encode(spesimen_kripto::dekripsi(&simpan)
                .map_err(|e| salah(StatusCode::INTERNAL_SERVER_ERROR, e))?))
        }
        None => None,
    };

    // --- langkah 1: stempel + QR, SEBELUM BSrE ---
    //
    // Urutan ini wajib. Menambah gambar ke PDF setelah BSrE menandatangani akan
    // membuat Adobe Reader menyatakan tanda tangannya tidak sah.
    let dir = dir_tte();
    let pra = format!("{dir}/pra-{id}-{}.pdf", chrono::Utc::now().timestamp_millis());
    let host = {
        let h = cfg(&s.pool, "tte_verifikasi_host").await;
        if h.is_empty() { "simrs.rsudcabangbungin.id".to_string() } else { h }
    };
    let token = crate::enkripsi_aes::encrypt(&format!("{{'x': 'sop', 't':'{nomor}'}}"));
    let qr_url = format!("https://{host}/verify-sop?id={}", urlencoding(&token));

    // Logo di tengah QR, mengikuti tampilan QR desktop. Opsional: tanpa logo,
    // QR tetap sah, hanya kurang seragam dengan surat dinas yang sudah terbit.
    let logo_b64 = sqlx::query_scalar::<_, String>(
        "SELECT gambar_terenkripsi FROM simrscb_tte_spesimen \
         WHERE jenis='logo' AND mulai <= CURDATE() \
           AND (selesai IS NULL OR selesai >= CURDATE()) ORDER BY mulai DESC LIMIT 1")
        .fetch_optional(&s.pool).await.map_err(db_err)?
        .and_then(|simpan| spesimen_kripto::dekripsi(&simpan).ok())
        .map(|png| STANDARD.encode(png));

    let mut spek = json!({
        "pdf_masuk": format!("{dir}/{file_asli}"),
        "pdf_keluar": pra,
        "qr_url": qr_url,
        "qr_tinggi_mm": 20,
        "qr_sudut_bila_tanpa_penanda": b.qr_di_sudut,
        // Keterangan "ditandatangani ... oleh BSrE" hanya boleh muncul kalau
        // BSrE memang yang menandatangani.
        "disclaimer_bssn": pakai_bsre,
        "wajib": ["#TTD#"],
    });
    if let Some(sb) = &stempel_b64 {
        spek["stempel_b64"] = json!(sb);
    }
    if let Some(lb) = &logo_b64 {
        spek["qr_logo_b64"] = json!(lb);
    }
    // Pada metode 'tempel', skrip yang menggambar tanda tangan. Pada 'bsre',
    // kunci ini sengaja tidak dikirim supaya areanya tetap kosong untuk BSrE.
    if !pakai_bsre {
        if let Some(png) = &ttd_png_opsi {
            spek["ttd_b64"] = json!(STANDARD.encode(png));
            spek["ttd_tinggi_mm"] = json!(ttd_tinggi_mm);
        }
    }

    let hasil = jalankan_stamp("tempel", &spek).await.map_err(|e| {
        salah(StatusCode::INTERNAL_SERVER_ERROR, e)
    })?;
    if !hasil["ok"].as_bool().unwrap_or(false) {
        let pesan = hasil["error"].as_str().unwrap_or("stamp.py gagal").to_string();
        catat_gagal(&s.pool, Some(id), &nomor, &pesan, "STAMP", &u.0.kode).await;
        return Err(salah(StatusCode::UNPROCESSABLE_ENTITY, pesan));
    }

    // --- langkah 2: BSrE menempel TTD + menandatangani ---
    let pdf_pra = tokio::fs::read(&pra).await
        .map_err(|e| salah(StatusCode::INTERNAL_SERVER_ERROR, format!("baca pra-TTE: {e}")))?;

    let pdf_hasil = if !pakai_bsre {
        // Metode 'tempel': hasil penempelan sudah final. Tidak ada tanda tangan
        // kriptografis, dan tidak ada yang berpura-pura ada.
        let _ = tokio::fs::remove_file(&pra).await;
        pdf_pra
    } else {
        // Gambar yang digambar BSrE: QR berlogo (konvensi SPBE) atau spesimen
        // tanda tangan. QR dibuat lewat stamp.py agar hanya ada satu
        // implementasi QR di seluruh sistem.
        let gambar_bsre = if gaya_gambar {
            ttd_png_opsi.clone().ok_or_else(|| salah(
                StatusCode::BAD_REQUEST, "Spesimen tanda tangan wajib untuk gaya 'gambar'"))?
        } else {
            let mut spek_qr = json!({ "qr_url": qr_url });
            if let Some(lb) = &logo_b64 { spek_qr["qr_logo_b64"] = json!(lb); }
            let r = jalankan_stamp("qr", &spek_qr).await
                .map_err(|e| salah(StatusCode::INTERNAL_SERVER_ERROR, e))?;
            STANDARD.decode(r["png_b64"].as_str().unwrap_or_default())
                .map_err(|e| salah(StatusCode::INTERNAL_SERVER_ERROR, format!("QR: {e}")))?
        };

        let ditandatangani = kirim_ke_bsre(
            &s.pool, &pdf_pra, &nik, &b.passphrase, &gambar_bsre,
            halaman, pos_x, pos_y, ttd_tinggi_mm, &jabatan,
        ).await;

        let _ = tokio::fs::remove_file(&pra).await;

        match ditandatangani {
            Ok(v) => v,
            Err(e) => {
                catat_gagal(&s.pool, Some(id), &nomor, &e, "BSRE", &u.0.kode).await;
                return Err(salah(StatusCode::BAD_GATEWAY, e));
            }
        }
    };

    let nama_hasil = format!("tte-{id}-{}.pdf", chrono::Utc::now().timestamp_millis());
    tokio::fs::write(format!("{dir}/{nama_hasil}"), &pdf_hasil).await
        .map_err(|e| salah(StatusCode::INTERNAL_SERVER_ERROR, format!("tulis hasil: {e}")))?;

    let hash_hasil = sha256_hex(&pdf_hasil);
    sqlx::query(
        "UPDATE simrscb_tte_dokumen SET file_hasil=?, hash_hasil=?, status='ditandatangani', \
            metode=?, spesimen_ttd_id=?, spesimen_stempel_id=?, penandatangan_nik=?, \
            penandatangan_nama=?, ditandatangani_oleh=?, ditandatangani_pada=NOW(), \
            remote_addr=? \
         WHERE id=?")
        .bind(&nama_hasil).bind(&hash_hasil).bind(&b.metode)
        .bind(b.spesimen_ttd_id).bind(b.spesimen_stempel_id)
        .bind(&nik).bind(&nama_pejabat).bind(&u.0.kode).bind("")
        .bind(id)
        .execute(&s.pool).await.map_err(db_err)?;

    Ok(Json(json!({
        "ok": true, "hash": hash_hasil, "nomor": nomor, "qr_url": qr_url,
        "metode": b.metode,
        "catatan": if pakai_bsre {
            "Tanda tangan kriptografis BSrE tertanam di PDF — panel tanda tangan \
             Adobe Reader akan menampilkannya."
        } else {
            "Dokumen ditempel tanpa sertifikat BSrE. Adobe Reader tidak akan \
             menampilkan panel tanda tangan; keaslian diperiksa lewat QR."
        },
    })))
}

/// Persen-encoding untuk token di query string. Token AES base64 memuat `+`,
/// `/` dan `=` yang akan salah terbaca kalau diteruskan apa adanya.
fn urlencoding(s: &str) -> String {
    s.bytes().map(|b| match b {
        b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
        _ => format!("%{:02X}", b),
    }).collect()
}

/// Panggil BSrE V2 `sign/pdf`.
///
/// Kontraknya disalin dari `bridging/EsignServiceV2.java` di Khanza yang sudah
/// terbukti jalan: payload sama, auth Basic sama, dan respons bisa datang dalam
/// dua bentuk (array base64, atau objek dengan kunci `file`).
#[allow(clippy::too_many_arguments)]
async fn kirim_ke_bsre(
    pool: &sqlx::MySqlPool, pdf: &[u8], nik: &str, passphrase: &str, ttd_png: &[u8],
    halaman: i32, x: f32, y: f32, tinggi_mm: f32, jabatan: &str,
) -> Result<Vec<u8>, String> {
    let url = cfg(pool, "tte_bsre_url").await;
    let user = cfg(pool, "tte_bsre_user").await;
    let pass = cfg(pool, "tte_bsre_pass").await;
    if url.is_empty() || user.is_empty() || pass.is_empty() {
        return Err("Konfigurasi BSrE belum lengkap (tte_bsre_url / user / pass).".into());
    }

    let mm = 72.0 / 25.4;
    let tinggi_pt = tinggi_mm * mm;
    // Lebar mengikuti rasio gambar supaya tanda tangan tidak gepeng.
    let (pw, ph) = png_dimensi(ttd_png).unwrap_or((600, 260));
    let lebar_pt = tinggi_pt * pw as f32 / ph as f32;

    let payload = json!({
        "nik": nik,
        "passphrase": passphrase,
        "signatureProperties": [{
            "imageBase64": STANDARD.encode(ttd_png),
            "tampilan": "VISIBLE",
            "page": halaman,
            // Koordinat penanda adalah sudut kiri-bawahnya; gambar dipusatkan
            // padanya, sama seperti perlakuan Khanza.
            "originX": (x - (lebar_pt / 2.0) + 2.0).max(0.0),
            "originY": (y - (tinggi_pt / 2.0) + 2.0).max(0.0),
            "width": lebar_pt,
            "height": tinggi_pt,
            "location": "Bekasi",
            "reason": if jabatan.is_empty() {
                "Dokumen ini telah disahkan dengan Tanda Tangan Elektronik".to_string()
            } else {
                format!("Disahkan oleh {jabatan} dengan Tanda Tangan Elektronik")
            },
            "contactInfo": "",
        }],
        "file": [STANDARD.encode(pdf)],
        "targetUrl": url,
    });

    let klien = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build().map_err(|e| format!("klien HTTP: {e}"))?;

    let resp = klien.post(&url)
        .basic_auth(&user, Some(&pass))
        .json(&payload)
        .send().await
        .map_err(|e| format!("tidak bisa menghubungi BSrE: {e}"))?;

    let kode = resp.status();
    let teks = resp.text().await.unwrap_or_default();
    let teks = teks.trim_start_matches('\u{feff}');

    if !kode.is_success() {
        let v: Value = serde_json::from_str(teks).unwrap_or(json!({}));
        let pesan = v["error"].as_str()
            .or_else(|| v["message"].as_str())
            .or_else(|| v["pesan"].as_str())
            .unwrap_or(if teks.is_empty() { "tidak ada pesan dari BSrE" } else { teks });
        return Err(format!("BSrE menolak ({kode}): {pesan}"));
    }

    let v: Value = serde_json::from_str(teks)
        .map_err(|e| format!("respons BSrE tidak terbaca: {e}"))?;
    let b64 = if let Some(a) = v.as_array() {
        a.first().and_then(|x| x.as_str()).unwrap_or_default().to_string()
    } else {
        v["file"].as_array().and_then(|a| a.first()).and_then(|x| x.as_str())
            .unwrap_or_default().to_string()
    };
    if b64.is_empty() {
        return Err("BSrE menjawab sukses tetapi tidak mengirim berkas.".into());
    }
    STANDARD.decode(b64).map_err(|e| format!("berkas BSrE tidak bisa didekode: {e}"))
}

/// Tanda tangan BSrE bergaya QR, untuk dokumen yang tidak memakai gambar
/// tanda tangan — seperti berkas klaim pada alur desktop DlgBerkasKlaim.
///
/// `halaman` di sini WAJIB berbasis 1, mengikuti hitungan BSrE. `stamp.py`
/// mengembalikan halaman berbasis 0, jadi pemanggil harus menambah satu.
/// Kesalahan di titik ini tidak menimbulkan galat apa pun — tanda tangan hanya
/// mendarat di halaman yang salah, dan itu baru ketahuan setelah dokumen
/// terlanjur terbit.
pub async fn tanda_tangan_bsre_qr(
    pool: &sqlx::MySqlPool, pdf: &[u8], nik: &str, passphrase: &str, nama: &str,
    halaman: i32, x: f32, y_bawah: f32,
) -> Result<Vec<u8>, String> {
    let host = {
        let h = cfg(pool, "tte_verifikasi_host").await;
        if h.is_empty() { "simrs.rsudcabangbungin.id".to_string() } else { h }
    };
    let tanggal = chrono::Local::now().format("%d-%m-%Y").to_string();
    let teks = format!(
        "Ditandatangani secara elektronik oleh {nama}\n\
         Sertifikat diterbitkan BSrE - BSSN\n{tanggal}\nhttps://{host}");

    // Logo di tengah QR, bila spesimen logo tersedia.
    let logo_b64 = sqlx::query_scalar::<_, String>(
        "SELECT gambar_terenkripsi FROM simrscb_tte_spesimen \
         WHERE jenis='logo' AND mulai <= CURDATE() \
           AND (selesai IS NULL OR selesai >= CURDATE()) ORDER BY mulai DESC LIMIT 1")
        .fetch_optional(pool).await.ok().flatten()
        .and_then(|simpan| spesimen_kripto::dekripsi(&simpan).ok())
        .map(|png| STANDARD.encode(png));

    let mut spek = json!({ "qr_url": teks });
    if let Some(lb) = &logo_b64 { spek["qr_logo_b64"] = json!(lb); }
    let r = jalankan_stamp("qr", &spek).await?;
    let qr = STANDARD.decode(r["png_b64"].as_str().unwrap_or_default())
        .map_err(|e| format!("QR tidak bisa didekode: {e}"))?;

    // 21mm ≈ 60pt, ukuran yang sama dipakai alur desktop.
    kirim_ke_bsre(pool, pdf, nik, passphrase, &qr, halaman, x, y_bawah, 21.0, "").await
}

fn png_dimensi(b: &[u8]) -> Option<(u32, u32)> {
    if b.len() < 24 { return None; }
    Some((u32::from_be_bytes([b[16], b[17], b[18], b[19]]),
          u32::from_be_bytes([b[20], b[21], b[22], b[23]])))
}

#[derive(Deserialize)]
pub struct CabutBody { pub alasan: String }

/// POST /api/tte-sop/:id/cabut — untuk SOP yang direvisi.
///
/// Tanpa ini, SOP revisi 1 yang sudah ditarik akan selamanya terverifikasi
/// sebagai berlaku.
pub async fn cabut(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>,
                   Json(b): Json<CabutBody>) -> Result<Json<Value>, Gagal> {
    adminonly(&u)?;
    if b.alasan.trim().is_empty() {
        return Err(salah(StatusCode::BAD_REQUEST, "Alasan pencabutan wajib diisi"));
    }
    let n = sqlx::query(
        "UPDATE simrscb_tte_dokumen SET status='dicabut', alasan_cabut=?, dicabut_pada=NOW() \
         WHERE id=? AND status='ditandatangani'")
        .bind(&b.alasan).bind(id).execute(&s.pool).await.map_err(db_err)?;
    if n.rows_affected() == 0 {
        return Err(salah(StatusCode::CONFLICT, "Hanya dokumen yang sudah ditandatangani bisa dicabut"));
    }
    Ok(Json(json!({"ok": true})))
}

// ---------------------------------------------------------------- verifikasi publik

#[derive(Deserialize)]
pub struct VerifyQuery { pub id: Option<String> }

/// GET /api/tte-sop/verify?id=<token> — PUBLIK, tanpa auth.
pub async fn verify(State(s): State<AppState>, Query(q): Query<VerifyQuery>)
  -> Result<Json<Value>, Gagal> {
    let id = q.id.ok_or_else(|| salah(StatusCode::BAD_REQUEST, "Parameter id tidak ada"))?;
    // Spasi muncul karena sebagian pemindai QR menerjemahkan '+' sebagai spasi.
    let token = crate::enkripsi_aes::decrypt(&id.replace(' ', "+"))
        .ok_or_else(|| salah(StatusCode::BAD_REQUEST, "Token tidak valid"))?;
    let v: Value = serde_json::from_str(&token.replace('\'', "\""))
        .map_err(|_| salah(StatusCode::BAD_REQUEST, "Isi token tidak terbaca"))?;
    if v["x"].as_str() != Some("sop") {
        return Err(salah(StatusCode::BAD_REQUEST, "Token ini bukan untuk dokumen SOP"));
    }
    let nomor = v["t"].as_str().unwrap_or_default();
    jawab_verifikasi(&s.pool, "nomor", nomor).await
}

#[derive(Deserialize)]
pub struct CocokkanBody { pub hash: String }

/// POST /api/tte-sop/verify/cocokkan — PUBLIK. Cocokkan SHA-256 berkas.
///
/// Ini pembuktian yang paling kuat di modul ini. QR hanya membuktikan bahwa
/// dokumen bernomor itu pernah ditandatangani; pencocokan hash membuktikan
/// bahwa berkas yang ada di tangan pemeriksa persis berkas tersebut. Hash
/// dihitung di sisi peramban, jadi dokumennya sendiri tidak perlu diunggah.
pub async fn cocokkan(State(s): State<AppState>, Json(b): Json<CocokkanBody>)
  -> Result<Json<Value>, Gagal> {
    let h = b.hash.trim().to_lowercase();
    if h.len() != 64 || !h.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(salah(StatusCode::BAD_REQUEST, "Hash harus 64 karakter heksadesimal"));
    }
    jawab_verifikasi(&s.pool, "hash_hasil", &h).await
}

async fn jawab_verifikasi(pool: &sqlx::MySqlPool, kolom: &str, nilai: &str)
  -> Result<Json<Value>, Gagal> {
    let sql = format!(
        "SELECT nomor, judul, status, penandatangan_nama, ditandatangani_pada, \
                hash_hasil, alasan_cabut, metode \
         FROM simrscb_tte_dokumen WHERE {kolom}=? AND status<>'draft' LIMIT 1");
    let row = sqlx::query_as::<_, (String, String, String, String,
                                   Option<chrono::NaiveDateTime>, String, Option<String>, String)>(&sql)
        .bind(nilai).fetch_optional(pool).await.map_err(db_err)?;

    let Some((nomor, judul, status, nama, pada, hash, alasan, metode)) = row else {
        return Ok(Json(json!({
            "valid": false,
            "pesan": "Dokumen tidak ditemukan. Berkas ini tidak terdaftar sebagai \
                      dokumen yang ditandatangani di SIMRS RSUD Cabang Bungin."
        })));
    };

    Ok(Json(json!({
        "valid": status == "ditandatangani",
        "status": status,
        "nomor": nomor,
        "judul": judul,
        "penandatangan": nama,
        "ditandatangani_pada": pada,
        "hash": hash,
        "alasan_cabut": alasan,
        "metode": metode,
        "pesan": if status == "dicabut" {
            "Dokumen ini SUDAH DICABUT dan tidak berlaku lagi. Biasanya karena \
             sudah diganti revisi yang lebih baru."
        } else {
            "Dokumen terdaftar dan ditandatangani secara elektronik."
        },
        // Dibedakan dengan sengaja: menyebut "sertifikat BSrE" pada dokumen yang
        // hanya ditempel adalah klaim yang tidak bisa dipertanggungjawabkan.
        "catatan_tte": if metode == "bsre" {
            "Ditandatangani dengan sertifikat elektronik yang diterbitkan Balai Besar \
             Sertifikasi Elektronik (BSrE), BSSN. Tanda tangan dapat diperiksa langsung \
             di Adobe Reader melalui panel tanda tangan."
        } else {
            "Dokumen ini disahkan secara internal oleh RSUD Cabang Bungin tanpa sertifikat \
             elektronik BSrE, sehingga tidak muncul di panel tanda tangan Adobe Reader. \
             Keasliannya diperiksa melalui halaman ini dan pencocokan sidik dokumen."
        },
    })))
}
