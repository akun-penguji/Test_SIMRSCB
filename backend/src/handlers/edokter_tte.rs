//! TTE berkas klaim dari eDokter — dokter menandatangani lewat HP/tablet.
//!
//! Padanan web dari `laporan/DlgBerkasKlaim.java`, dengan satu perbedaan
//! mendasar: alur desktop memproses seluruh penanda tangan dalam satu sesi di
//! satu komputer, sedangkan di sini dokter A menandatangani hari ini dari HP-nya
//! dan dokter B besok dari HP-nya sendiri. Karena itu setiap tanda tangan
//! dicatat per penanda tangan di `berkas_klaim_ttd`; tanpa itu sistem tidak tahu
//! siapa yang masih ditunggu, dan dokter yang sudah menandatangani akan terus
//! melihat berkas yang sama di daftar tugasnya.
//!
//! Alur satu tanda tangan:
//!
//! ```text
//!   baca PDF dari disk  (berkasnya ada di server yang sama dengan backend)
//!     → stamp.py --mode tag          cari posisi tanda milik dokter ini
//!     → BSrE /api/v2/sign/pdf        tempel QR + tanda tangan kriptografis
//!     → POST berkasklaim/unggah.php  simpan kembali (backend tidak punya izin
//!                                     tulis langsung; direktori milik www-data)
//!     → catat baris berkas_klaim_ttd
//!     → bila semua penanda tangan selesai, status jadi SUDAH_TTD
//! ```
//!
//! Catatan `no_rawat`: nilainya memuat garis miring (2026/10/01/000085), jadi
//! ia TIDAK pernah dipakai sebagai segmen path URL — Apache menolak %2F dengan
//! 404. Selalu lewat query string atau badan permintaan.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

type Gagal = (StatusCode, Json<Value>);

fn db_err(e: sqlx::Error) -> Gagal {
    tracing::error!("DB edokter_tte: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data"})))
}
fn salah(kode: StatusCode, pesan: impl Into<String>) -> Gagal {
    (kode, Json(json!({ "error": pesan.into() })))
}

fn dir_berkas() -> String {
    std::env::var("BERKASKLAIM_DIR")
        .unwrap_or_else(|_| "/var/www/html/webapps/berkasklaim".to_string())
}
fn url_unggah() -> String {
    std::env::var("BERKASKLAIM_UPLOAD_URL")
        .unwrap_or_else(|_| "http://localhost/webapps/berkasklaim/unggah.php".to_string())
}
fn bin_python() -> String {
    std::env::var("TTE_PYTHON").unwrap_or_else(|_| "scripts/venv/bin/python".to_string())
}
fn skrip_stamp() -> String {
    std::env::var("TTE_STAMP").unwrap_or_else(|_| "scripts/stamp.py".to_string())
}

fn sha256_hex(b: &[u8]) -> String {
    Sha256::digest(b).iter().map(|x| format!("{:02x}", x)).collect()
}

/// Kode penanda tangan yang berlaku untuk permintaan ini.
///
/// Mengikuti konvensi `edokter`: non-admin selalu dirinya sendiri, admin boleh
/// menyebut kode lain untuk keperluan uji. Tidak ada jalan bagi dokter biasa
/// menandatangani atas nama orang lain.
fn kode_penandatangan(user: &AuthUser, kd: &Option<String>) -> Option<String> {
    if user.0.is_admin {
        kd.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(str::to_string)
    } else {
        Some(user.0.kode.clone())
    }
}

// ─────────────────────────────────────────────────────── daftar tugas

/// Baris mentah dari query — dipisahkan dari bentuk yang dikirim ke peramban
/// karena sqlx tidak bisa men-decode `Vec<T>` sebagai kolom. Memaksakannya
/// lewat atribut hanya memindahkan kerumitan ke tempat yang lebih sulit dibaca.
#[derive(sqlx::FromRow)]
struct BerkasRow {
    no_rawat: String,
    no_rkm_medis: String,
    nm_pasien: String,
    tgl_upload: Option<chrono::NaiveDateTime>,
    // Keduanya nullable di skema produksi, dan `nama_berkas` memang NULL pada
    // 5 dari 7 baris yang ada — DlgBerkasRawat menulis lokasi_file tanpa
    // mengisi nama_berkas. Didecode sebagai Option, bukan String, karena sqlx
    // menggagalkan SELURUH permintaan (500) begitu satu baris NULL ikut
    // terambil, bukan hanya baris itu.
    nama_berkas: Option<String>,
    lokasi_file: Option<String>,
    status: Option<String>,
}

/// Nama berkas untuk ditampilkan: kolom `nama_berkas` bila terisi, kalau tidak
/// diturunkan dari nama file di `lokasi_file` — yang justru selalu ada.
fn nama_tampil(nama: &Option<String>, lokasi: &Option<String>) -> String {
    let bersih = nama.as_deref().map(str::trim).filter(|s| !s.is_empty());
    if let Some(n) = bersih {
        return n.to_string();
    }
    lokasi.as_deref()
        .and_then(|l| l.rsplit('/').next())
        .map(str::to_string)
        .unwrap_or_else(|| "(tanpa nama)".to_string())
}

#[derive(Serialize)]
pub struct BerkasTugas {
    pub no_rawat: String,
    pub no_rkm_medis: String,
    pub nm_pasien: String,
    pub tgl_upload: Option<chrono::NaiveDateTime>,
    pub nama_berkas: String,
    pub lokasi_file: String,
    pub status: Option<String>,
    /// Daftar penanda tangan dokumen ini beserta status masing-masing,
    /// supaya dokter tahu ia menunggu siapa atau ditunggu siapa.
    pub penandatangan: Vec<Penandatangan>,
}

#[derive(Serialize, Clone)]
pub struct Penandatangan {
    pub kode: String,
    pub nama: String,
    pub sudah: bool,
    pub pada: Option<chrono::NaiveDateTime>,
}

#[derive(Deserialize)]
pub struct DaftarQuery {
    pub kd_dokter: Option<String>,
    /// "menunggu" (bawaan) = hanya yang belum saya tandatangani.
    /// "semua" = termasuk yang sudah, untuk penelusuran.
    #[serde(default)]
    pub tampilkan: Option<String>,
}

/// GET /api/edokter/tte
pub async fn daftar(
    user: AuthUser, State(s): State<AppState>, Query(q): Query<DaftarQuery>,
) -> Result<Json<Vec<BerkasTugas>>, Gagal> {
    let kode = kode_penandatangan(&user, &q.kd_dokter)
        .ok_or_else(|| salah(StatusCode::BAD_REQUEST,
            "Akun admin perlu menyebut kd_dokter untuk melihat daftar ini"))?;

    let hanya_menunggu = q.tampilkan.as_deref() != Some("semua");

    // Berkas yang mencantumkan kode ini sebagai penanda tangan, dan — bila
    // disaring — yang belum ia tandatangani. Penyaringan "belum" memakai
    // keberadaan baris di berkas_klaim_ttd, bukan status berkas, karena status
    // hanya berubah setelah SELURUH penanda tangan selesai.
    let rows = sqlx::query_as::<_, BerkasRow>(
        "SELECT b.no_rawat, r.no_rkm_medis, p.nm_pasien, b.tgl_upload, \
                b.nama_berkas, b.lokasi_file, b.status \
         FROM berkas_klaim b \
         JOIN reg_periksa r ON r.no_rawat = b.no_rawat \
         JOIN pasien p ON p.no_rkm_medis = r.no_rkm_medis \
         JOIN berkas_digital_perawatan bd \
           ON bd.no_rawat = b.no_rawat AND TRIM(bd.nip) = ? \
         LEFT JOIN berkas_klaim_ttd t \
           ON t.no_rawat = b.no_rawat AND t.kode_penandatangan = ? \
         WHERE (? = 0 OR (t.id IS NULL AND COALESCE(b.status,'') <> 'SUDAH_TTD')) \
         GROUP BY b.no_rawat \
         ORDER BY b.tgl_upload DESC LIMIT 200")
        .bind(&kode).bind(&kode)
        .bind(if hanya_menunggu { 1 } else { 0 })
        .fetch_all(&s.pool).await.map_err(db_err)?;

    // Lampirkan daftar penanda tangan per berkas. Dilakukan terpisah, bukan
    // lewat GROUP_CONCAT, supaya status "sudah/belum" dan waktunya tetap
    // terstruktur dan tidak perlu diurai ulang di sisi peramban.
    let mut hasil = Vec::with_capacity(rows.len());
    for r in rows {
        // Dipetakan dari tuple, bukan FromRow: `t.id IS NOT NULL` keluar
        // sebagai integer di MySQL dan bukan boolean, jadi konversinya
        // dilakukan di sini secara eksplisit.
        let baris: Vec<(String, String, i64, Option<chrono::NaiveDateTime>)> = sqlx::query_as(
            "SELECT DISTINCT TRIM(bd.nip) AS kode, \
                    COALESCE(d.nm_dokter, pg.nama, TRIM(bd.nip)) AS nama, \
                    (t.id IS NOT NULL) AS sudah, t.ditandatangani_pada AS pada \
             FROM berkas_digital_perawatan bd \
             LEFT JOIN dokter d ON d.kd_dokter = TRIM(bd.nip) \
             LEFT JOIN petugas pg ON pg.nip = TRIM(bd.nip) \
             LEFT JOIN berkas_klaim_ttd t \
               ON t.no_rawat = bd.no_rawat AND t.kode_penandatangan = TRIM(bd.nip) \
             WHERE bd.no_rawat = ? AND TRIM(bd.nip) NOT IN ('', '-') AND bd.nip IS NOT NULL \
             ORDER BY bd.kode")
            .bind(&r.no_rawat)
            .fetch_all(&s.pool).await.map_err(db_err)?;

        hasil.push(BerkasTugas {
            no_rawat: r.no_rawat, no_rkm_medis: r.no_rkm_medis, nm_pasien: r.nm_pasien,
            tgl_upload: r.tgl_upload,
            nama_berkas: nama_tampil(&r.nama_berkas, &r.lokasi_file),
            lokasi_file: r.lokasi_file.unwrap_or_default(),
            status: r.status,
            penandatangan: baris.into_iter().map(|(kode, nama, sudah, pada)| Penandatangan {
                kode, nama, sudah: sudah != 0, pada,
            }).collect(),
        });
    }
    Ok(Json(hasil))
}

// ─────────────────────────────────────────────────────── pratinjau berkas

#[derive(Deserialize)]
pub struct BerkasQuery { pub no_rawat: String, pub kd_dokter: Option<String> }

/// GET /api/edokter/tte/berkas?no_rawat=...
///
/// Hanya penanda tangan dokumen itu yang boleh membukanya. Tanpa pemeriksaan
/// ini, siapa pun yang login sebagai dokter bisa mengunduh berkas klaim pasien
/// mana pun hanya dengan menebak nomor rawat.
pub async fn berkas(
    user: AuthUser, State(s): State<AppState>, Query(q): Query<BerkasQuery>,
) -> Result<Response, Gagal> {
    let kode = kode_penandatangan(&user, &q.kd_dokter)
        .ok_or_else(|| salah(StatusCode::BAD_REQUEST, "kd_dokter wajib untuk akun admin"))?;

    let boleh: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM berkas_digital_perawatan \
         WHERE no_rawat = ? AND TRIM(nip) = ?")
        .bind(&q.no_rawat).bind(&kode)
        .fetch_one(&s.pool).await.map_err(db_err)?;
    if boleh == 0 && !user.0.is_admin {
        return Err(salah(StatusCode::FORBIDDEN,
            "Anda bukan penanda tangan berkas ini"));
    }

    // Option ganda: baris bisa tidak ada, DAN kolomnya nullable. Keduanya
    // dibedakan pesannya karena penyebabnya berbeda bagi yang memperbaiki.
    let nama: String = sqlx::query_scalar::<_, Option<String>>(
        "SELECT lokasi_file FROM berkas_klaim WHERE no_rawat = ?")
        .bind(&q.no_rawat)
        .fetch_optional(&s.pool).await.map_err(db_err)?
        .ok_or_else(|| salah(StatusCode::NOT_FOUND, "Berkas klaim tidak ditemukan"))?
        .ok_or_else(|| salah(StatusCode::UNPROCESSABLE_ENTITY,
            "Baris berkas klaim ada tapi lokasi filenya kosong"))?;

    let bersih = nama.rsplit('/').next().unwrap_or("").to_string();
    if bersih.is_empty() || bersih.contains("..") {
        return Err(salah(StatusCode::BAD_REQUEST, "Nama berkas tidak valid"));
    }
    let isi = tokio::fs::read(format!("{}/{}", dir_berkas(), bersih)).await
        .map_err(|_| salah(StatusCode::NOT_FOUND, "Berkas tidak ada di server"))?;

    Ok(([(header::CONTENT_TYPE, "application/pdf".to_string()),
         (header::CONTENT_DISPOSITION, format!("inline; filename=\"{}\"", bersih)),
         (header::CACHE_CONTROL, "no-store".to_string())], isi).into_response())
}

// ─────────────────────────────────────────────────────── penandatanganan

#[derive(Deserialize)]
pub struct TandaTanganBody {
    pub no_rawat: String,
    pub passphrase: String,
    pub kd_dokter: Option<String>,
}

#[derive(Serialize)]
pub struct HasilTtd {
    pub ok: bool,
    pub tag: String,
    pub halaman: i32,
    pub hash: String,
    pub berkas: String,
    pub semua_selesai: bool,
    pub catatan: String,
}

/// POST /api/edokter/tte/tandatangani
pub async fn tandatangani(
    user: AuthUser, State(s): State<AppState>, Json(b): Json<TandaTanganBody>,
) -> Result<Json<HasilTtd>, Gagal> {
    let kode = kode_penandatangan(&user, &b.kd_dokter)
        .ok_or_else(|| salah(StatusCode::BAD_REQUEST, "kd_dokter wajib untuk akun admin"))?;
    if b.passphrase.trim().is_empty() {
        return Err(salah(StatusCode::BAD_REQUEST, "Passphrase BSrE wajib diisi"));
    }

    // ── Siapa penanda tangannya, dan apakah ia memang ditunjuk ──────────────
    let daftar: Vec<(String,)> = sqlx::query_as(
        "SELECT DISTINCT TRIM(nip) FROM berkas_digital_perawatan \
         WHERE no_rawat = ? AND TRIM(nip) NOT IN ('','-') AND nip IS NOT NULL \
         ORDER BY kode")
        .bind(&b.no_rawat).fetch_all(&s.pool).await.map_err(db_err)?;
    let urutan = daftar.iter().position(|(n,)| *n == kode)
        .ok_or_else(|| salah(StatusCode::FORBIDDEN,
            "Anda tidak tercantum sebagai penanda tangan berkas ini"))?;

    let sudah: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM berkas_klaim_ttd WHERE no_rawat = ? AND kode_penandatangan = ?")
        .bind(&b.no_rawat).bind(&kode)
        .fetch_one(&s.pool).await.map_err(db_err)?;
    if sudah > 0 {
        return Err(salah(StatusCode::CONFLICT, "Anda sudah menandatangani berkas ini"));
    }

    // Berkas yang diselesaikan lewat DlgBerkasKlaim di desktop TIDAK menulis
    // baris `berkas_klaim_ttd` — tabel itu baru ada sejak alur eDokter. Jadi
    // pemeriksaan di atas tidak melihatnya, dan tanpa penjagaan status ini
    // dokumen yang sudah bertanda tangan lengkap akan ditandatangani ulang:
    // QR kedua tertempel di atas yang pertama dan BSrE menandatangani PDF yang
    // sudah ber-PAdES. Status 'SUDAH_TTD' bersifat kolektif, jadi hanya dipakai
    // sebagai palang di sini — bukan untuk menyaring per penanda tangan.
    let status: Option<String> = sqlx::query_scalar(
        "SELECT status FROM berkas_klaim WHERE no_rawat = ?")
        .bind(&b.no_rawat)
        .fetch_optional(&s.pool).await.map_err(db_err)?.flatten();
    if status.as_deref() == Some("SUDAH_TTD") {
        return Err(salah(StatusCode::CONFLICT,
            "Berkas ini sudah bertanda tangan lengkap (kemungkinan lewat aplikasi \
             desktop). Tidak ditandatangani ulang agar tanda tangan yang ada \
             tidak tertimpa."));
    }

    // Nama & NIK. NIK diambil dari pegawai.no_ktp dengan pegawai.nik sebagai
    // kode penanda tangan — konvensi yang sama dipakai SuratSakit.java dan
    // DlgBerkasKlaim.java.
    let nama: String = sqlx::query_scalar(
        "SELECT COALESCE((SELECT nm_dokter FROM dokter WHERE kd_dokter = ?), \
                         (SELECT nama FROM petugas WHERE nip = ?), ?)")
        .bind(&kode).bind(&kode).bind(&kode)
        .fetch_one(&s.pool).await.map_err(db_err)?;

    let nik: String = sqlx::query_scalar::<_, Option<String>>(
        "SELECT no_ktp FROM pegawai WHERE nik = ?")
        .bind(&kode).fetch_optional(&s.pool).await.map_err(db_err)?
        .flatten().unwrap_or_default();
    if nik.len() != 16 || !nik.chars().all(|c| c.is_ascii_digit()) {
        return Err(salah(StatusCode::UNPROCESSABLE_ENTITY, format!(
            "NIK pada data kepegawaian tidak valid 16 digit untuk kode {kode}. \
             Perbaiki dulu di data pegawai — BSrE menolak NIK yang tidak sesuai.")));
    }

    // ── Berkas ──────────────────────────────────────────────────────────────
    let lokasi: String = sqlx::query_scalar::<_, Option<String>>(
        "SELECT lokasi_file FROM berkas_klaim WHERE no_rawat = ?")
        .bind(&b.no_rawat).fetch_optional(&s.pool).await.map_err(db_err)?
        .ok_or_else(|| salah(StatusCode::NOT_FOUND, "Berkas klaim tidak ditemukan"))?
        .ok_or_else(|| salah(StatusCode::UNPROCESSABLE_ENTITY,
            "Baris berkas klaim ada tapi lokasi filenya kosong"))?;
    let nama_berkas = lokasi.rsplit('/').next().unwrap_or("").to_string();
    if nama_berkas.is_empty() || nama_berkas.contains("..") {
        return Err(salah(StatusCode::BAD_REQUEST, "Nama berkas tidak valid"));
    }
    let jalur = format!("{}/{}", dir_berkas(), nama_berkas);
    let pdf = tokio::fs::read(&jalur).await
        .map_err(|_| salah(StatusCode::NOT_FOUND, "Berkas tidak ada di server"))?;
    let hash_sebelum = sha256_hex(&pdf);

    // ── Posisi tanda tangan ─────────────────────────────────────────────────
    let tag_saya: Option<String> = sqlx::query_scalar::<_, Option<String>>(
        "SELECT COALESCE((SELECT tag_signer FROM dokter WHERE kd_dokter = ?), \
                         (SELECT tag_signer FROM petugas WHERE nip = ?))")
        .bind(&kode).bind(&kode)
        .fetch_optional(&s.pool).await.map_err(db_err)?.flatten();

    let temuan = jalankan_stamp("tag", &json!({ "pdf_masuk": jalur })).await
        .map_err(|e| salah(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    let posisi = pilih_posisi(&temuan, tag_saya.as_deref(), urutan)
        .ok_or_else(|| salah(StatusCode::UNPROCESSABLE_ENTITY, format!(
            "Tidak ditemukan posisi tanda tangan untuk Anda di berkas ini. \
             Berkas perlu dibuat ulang lewat Berkas Casemix agar memuat tanda \
             posisi {}.", tag_saya.as_deref().unwrap_or("penanda tangan"))))?;

    // ── BSrE ────────────────────────────────────────────────────────────────
    let hasil = crate::handlers::tte_sop::tanda_tangan_bsre_qr(
        &s.pool, &pdf, &nik, &b.passphrase, &nama,
        posisi.halaman + 1, posisi.x, posisi.y_bawah,   // BSrE menghitung halaman dari 1
    ).await.map_err(|e| salah(StatusCode::BAD_GATEWAY, e))?;

    let hash_sesudah = sha256_hex(&hasil);

    // ── Simpan kembali ──────────────────────────────────────────────────────
    // Lewat unggah.php, bukan tulis langsung: direktori berkasklaim milik
    // www-data dan backend berjalan sebagai pengguna lain.
    unggah_kembali(&hasil, &nama_berkas, &b.no_rawat).await
        .map_err(|e| salah(StatusCode::BAD_GATEWAY, e))?;

    // ── Catat ───────────────────────────────────────────────────────────────
    sqlx::query(
        "INSERT INTO berkas_klaim_ttd \
         (no_rawat, kode_penandatangan, nama_penandatangan, nik, tag, halaman, \
          pos_x, pos_y, hash_sebelum, hash_sesudah, berkas_hasil, sumber, \
          ditandatangani_pada) \
         VALUES (?,?,?,?,?,?,?,?,?,?,?,'edokter',NOW())")
        .bind(&b.no_rawat).bind(&kode).bind(&nama).bind(&nik)
        .bind(&posisi.tag).bind(posisi.halaman + 1)
        .bind(posisi.x).bind(posisi.y_bawah)
        .bind(&hash_sebelum).bind(&hash_sesudah).bind(&nama_berkas)
        .execute(&s.pool).await.map_err(db_err)?;

    // Status berubah hanya ketika SELURUH penanda tangan selesai — itulah arti
    // SUDAH_TTD pada alur desktop, dan mengubahnya lebih awal akan membuat
    // berkas hilang dari antrean penanda tangan berikutnya.
    let selesai: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM berkas_klaim_ttd WHERE no_rawat = ?")
        .bind(&b.no_rawat).fetch_one(&s.pool).await.map_err(db_err)?;
    let semua_selesai = selesai as usize >= daftar.len();
    if semua_selesai {
        sqlx::query("UPDATE berkas_klaim SET status='SUDAH_TTD' WHERE no_rawat=?")
            .bind(&b.no_rawat).execute(&s.pool).await.map_err(db_err)?;
    }

    Ok(Json(HasilTtd {
        ok: true,
        tag: posisi.tag,
        halaman: posisi.halaman + 1,
        hash: hash_sesudah,
        berkas: nama_berkas,
        semua_selesai,
        catatan: if semua_selesai {
            "Seluruh penanda tangan selesai; berkas ditandai SUDAH_TTD.".into()
        } else {
            format!("Tanda tangan Anda tersimpan. Menunggu {} penanda tangan lain.",
                    daftar.len() - selesai as usize)
        },
    }))
}

// ─────────────────────────────────────────────────────── pembantu

struct Posisi { tag: String, halaman: i32, x: f32, y_bawah: f32 }

/// Pilih titik tempel tanda tangan.
///
/// Urutan percobaan sengaja begini:
///
/// 1. Tanda milik penanda tangan ini (mis. `#12A#`). Ini satu-satunya cara yang
///    benar-benar menjamin tiap orang menandatangani di tempatnya sendiri.
/// 2. Bila dokumen tidak memuatnya, dipakai '#' polos ke-N sesuai urutan
///    penanda tangan. Dokumen lama dibuat sebelum tanda unik terpasang dan
///    seluruh tandanya '#'; urutan kemunculan adalah satu-satunya dasar yang
///    tersisa. Pendekatan ini tetap bisa meleset bila tata letak dokumen tidak
///    mengurutkan kolom tanda tangan sesuai urutan penanda tangan — karena itu
///    hanya dipakai sebagai cadangan, bukan jalur utama.
///
/// Tidak ada posisi baku bila keduanya gagal: menempelkan tanda tangan di
/// koordinat tebakan pada berkas klaim berisiko menimpa isi dokumen.
fn pilih_posisi(temuan: &Value, tag_saya: Option<&str>, urutan: usize) -> Option<Posisi> {
    let ambil = |v: &Value| Posisi {
        tag: v.get("tag").and_then(|x| x.as_str()).unwrap_or("#").to_string(),
        halaman: v["halaman"].as_i64().unwrap_or(0) as i32,
        x: v["x"].as_f64().unwrap_or(0.0) as f32,
        y_bawah: v["y_bawah"].as_f64().unwrap_or(0.0) as f32,
    };

    if let Some(tag) = tag_saya.map(str::trim).filter(|t| !t.is_empty()) {
        if let Some(arr) = temuan.get("tag").and_then(|x| x.as_array()) {
            if let Some(v) = arr.iter().find(|v| v.get("tag")
                    .and_then(|x| x.as_str()).map(|t| t.eq_ignore_ascii_case(tag))
                    .unwrap_or(false)) {
                return Some(ambil(v));
            }
        }
    }

    let polos = temuan.get("polos").and_then(|x| x.as_array())?;
    polos.get(urutan).map(|v| {
        let mut p = ambil(v);
        p.tag = "#".to_string();
        p
    })
}

async fn jalankan_stamp(mode: &str, spek: &Value) -> Result<Value, String> {
    use tokio::io::AsyncWriteExt;
    let mut anak = tokio::process::Command::new(bin_python())
        .arg(skrip_stamp()).arg("--mode").arg(mode)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn().map_err(|e| format!("tidak bisa menjalankan stamp.py: {e}"))?;
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
    serde_json::from_str(&stdout).map_err(|e| format!("keluaran stamp.py tidak terbaca: {e}"))
}

/// Simpan PDF hasil ke direktori berkasklaim lewat endpoint unggah.
async fn unggah_kembali(pdf: &[u8], nama: &str, no_rawat: &str) -> Result<(), String> {
    let bagian = reqwest::multipart::Part::bytes(pdf.to_vec())
        .file_name(nama.to_string())
        .mime_str("application/pdf").map_err(|e| e.to_string())?;
    let form = reqwest::multipart::Form::new()
        .text("no_rawat", no_rawat.to_string())
        .part("file", bagian);

    let klien = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build().map_err(|e| format!("klien HTTP: {e}"))?;
    let resp = klien.post(url_unggah()).multipart(form).send().await
        .map_err(|e| format!("gagal mengunggah hasil: {e}"))?;
    let kode = resp.status();
    let teks = resp.text().await.unwrap_or_default();
    if !kode.is_success() || teks.contains("ERROR") {
        return Err(format!("unggah hasil ditolak ({kode}): {}",
                           teks.chars().take(120).collect::<String>()));
    }
    Ok(())
}
