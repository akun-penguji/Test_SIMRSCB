use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use crate::AppState;

#[derive(Deserialize)]
pub struct VerifyQuery {
    pub id: Option<String>,
}

#[derive(Deserialize)]
pub struct DownloadBody {
    pub id: String,
    pub tgl_lahir: String,
}

#[derive(Deserialize)]
struct TokenPayload {
    x: String,
    t: String,
}

#[derive(Serialize)]
pub struct VerifyResponse {
    pub valid: bool,
    pub tipe: String,
    pub judul: String,
    pub no_surat: String,
    pub no_rawat: String,
    pub tanggal: String,
    pub pasien: PasienVerifyInfo,
    pub penandatangan: PenandatanganVerifyInfo,
    pub keterangan: Option<String>,
    pub status_tte: String,
    pub has_pdf: bool,
}

#[derive(Serialize)]
pub struct PasienVerifyInfo {
    pub nama_masked: String,
    pub no_rm_masked: String,
    pub lama_sakit: Option<String>,
    pub periode: Option<String>,
}

#[derive(Serialize)]
pub struct PenandatanganVerifyInfo {
    pub nama: String,
    pub sip: String,
    pub nik_masked: String,
    pub instansi: String,
    pub otoritas_sertifikat: String,
}

fn mask_name(name: &str) -> String {
    let parts: Vec<&str> = name.split_whitespace().collect();
    let mut masked_parts = Vec::new();
    for p in parts {
        let chars: Vec<char> = p.chars().collect();
        if chars.len() <= 2 {
            masked_parts.push(p.to_string());
        } else if chars.len() <= 4 {
            let first = chars[0];
            let stars = "*".repeat(chars.len() - 1);
            masked_parts.push(format!("{}{}", first, stars));
        } else {
            let first_two: String = chars[0..2].iter().collect();
            let last: char = chars[chars.len() - 1];
            let stars = "*".repeat(chars.len() - 3);
            masked_parts.push(format!("{}{}{}", first_two, stars, last));
        }
    }
    masked_parts.join(" ")
}

fn mask_rm(rm: &str) -> String {
    let len = rm.len();
    if len <= 3 {
        rm.to_string()
    } else {
        format!("***{}", &rm[len - 3..])
    }
}

fn mask_nik(nik: &str) -> String {
    let len = nik.len();
    if len >= 12 {
        format!("{}********{}", &nik[..4], &nik[len - 4..])
    } else if len > 6 {
        format!("{}****{}", &nik[..2], &nik[len - 2..])
    } else {
        nik.to_string()
    }
}

fn matches_tgl_lahir(db_tgl: &str, user_input: &str) -> bool {
    let clean_user: String = user_input.chars().filter(|c| c.is_ascii_digit()).collect();
    let clean_db: String = db_tgl.chars().filter(|c| c.is_ascii_digit()).collect();

    if clean_user.is_empty() || clean_db.len() < 8 {
        return false;
    }

    // Direct match (e.g. 19801017 == 19801017)
    if clean_user == clean_db {
        return true;
    }

    // DB: YYYYMMDD -> clean_db[0..4]=YYYY, clean_db[4..6]=MM, clean_db[6..8]=DD
    let db_dmy = format!("{}{}{}", &clean_db[6..8], &clean_db[4..6], &clean_db[0..4]);
    if clean_user == db_dmy {
        return true;
    }

    false
}

fn parse_token(id_raw: &str) -> Result<TokenPayload, String> {
    let id_clean = id_raw.replace(' ', "+");
    let decrypted = crate::enkripsi_aes::decrypt(&id_clean)
        .ok_or_else(|| "Gagal mendekripsi token TTE. Format token tidak valid.".to_string())?;

    let json_clean = decrypted.replace('\'', "\"");
    serde_json::from_str::<TokenPayload>(&json_clean)
        .map_err(|e| format!("Gagal membaca payload token TTE: {}", e))
}

/// GET /api/verify?id=<encrypted_token>
pub async fn verify_dokumen(
    State(state): State<AppState>,
    Query(query): Query<VerifyQuery>,
) -> Result<Json<VerifyResponse>, (StatusCode, Json<serde_json::Value>)> {
    let id = query.id.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "valid": false, "error": "Parameter id tidak ditemukan" })),
        )
    })?;

    let payload = parse_token(&id).map_err(|err| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "valid": false, "error": err })),
        )
    })?;

    match payload.x.as_str() {
        "sakit" => {
            let row = sqlx::query(
                r#"
                SELECT 
                  s.no_surat,
                  s.no_rawat,
                  DATE_FORMAT(s.tanggalawal, '%d-%m-%Y') as tgl_awal,
                  DATE_FORMAT(s.tanggalakhir, '%d-%m-%Y') as tgl_akhir,
                  s.lamasakit,
                  DATE_FORMAT(rp.tgl_registrasi, '%d-%m-%Y') as tgl_surat,
                  p.nm_pasien,
                  p.no_rkm_medis,
                  DATE_FORMAT(p.tgl_lahir, '%Y-%m-%d') as tgl_lahir,
                  d.nm_dokter,
                  IFNULL(d.no_ijn_praktek, '-') as sip,
                  IFNULL(pg.no_ktp, '') as nik_dokter,
                  IFNULL((SELECT b.lokasi_file FROM berkas_digital_perawatan b 
                          WHERE b.no_rawat = s.no_rawat AND b.kode = '064' LIMIT 1), '') as file_berkas
                FROM suratsakit s
                INNER JOIN reg_periksa rp ON s.no_rawat = rp.no_rawat
                INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
                INNER JOIN dokter d ON rp.kd_dokter = d.kd_dokter
                LEFT JOIN pegawai pg ON d.kd_dokter = pg.nik
                WHERE s.no_surat = ?
                "#,
            )
            .bind(&payload.t)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "valid": false, "error": format!("Database error: {}", e) })),
                )
            })?;

            if let Some(r) = row {
                let no_surat: String = r.get("no_surat");
                let no_rawat: String = r.get("no_rawat");
                let tgl_awal: String = r.get("tgl_awal");
                let tgl_akhir: String = r.get("tgl_akhir");
                let lamasakit: String = r.get("lamasakit");
                let tgl_surat: String = r.get("tgl_surat");
                let nm_pasien: String = r.get("nm_pasien");
                let no_rm: String = r.get("no_rkm_medis");
                let nm_dokter: String = r.get("nm_dokter");
                let sip: String = r.get("sip");
                let nik_dok: String = r.get("nik_dokter");
                let file_berkas: String = r.get("file_berkas");

                let has_pdf = !file_berkas.is_empty();

                Ok(Json(VerifyResponse {
                    valid: true,
                    tipe: "sakit".to_string(),
                    judul: "Surat Keterangan Sakit".to_string(),
                    no_surat,
                    no_rawat,
                    tanggal: tgl_surat,
                    pasien: PasienVerifyInfo {
                        nama_masked: mask_name(&nm_pasien),
                        no_rm_masked: mask_rm(&no_rm),
                        lama_sakit: Some(format!("{} Hari", lamasakit)),
                        periode: Some(format!("{} s.d. {}", tgl_awal, tgl_akhir)),
                    },
                    penandatangan: PenandatanganVerifyInfo {
                        nama: nm_dokter,
                        sip,
                        nik_masked: mask_nik(&nik_dok),
                        instansi: "RSUD Cabangbungin Kab. Bekasi".to_string(),
                        otoritas_sertifikat: "Balai Besar Sertifikasi Elektronik (BSrE), Badan Siber dan Sandi Negara".to_string(),
                    },
                    keterangan: Some(format!("Pasien diberikan izin istirahat sakit selama {} hari terhitung {} sampai dengan {}.", lamasakit, tgl_awal, tgl_akhir)),
                    status_tte: "Ditandatangani secara elektronik (TTE) menggunakan sertifikat elektronik resmi BSrE BSSN".to_string(),
                    has_pdf,
                }))
            } else {
                Err((
                    StatusCode::NOT_FOUND,
                    Json(json!({ "valid": false, "error": "Data Surat Keterangan Sakit tidak ditemukan dalam database." })),
                ))
            }
        }
        "skd" => {
            let row = sqlx::query(
                r#"
                SELECT 
                  s.no_surat,
                  s.no_rawat,
                  DATE_FORMAT(rp.tgl_registrasi, '%d-%m-%Y') as tgl_surat,
                  p.nm_pasien,
                  p.no_rkm_medis,
                  DATE_FORMAT(p.tgl_lahir, '%Y-%m-%d') as tgl_lahir,
                  d.nm_dokter,
                  IFNULL(d.no_ijn_praktek, '-') as sip,
                  IFNULL(pg.no_ktp, '') as nik_dokter
                FROM surat_keterangan_sehat s
                INNER JOIN reg_periksa rp ON s.no_rawat = rp.no_rawat
                INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
                INNER JOIN dokter d ON rp.kd_dokter = d.kd_dokter
                LEFT JOIN pegawai pg ON d.kd_dokter = pg.nik
                WHERE s.no_surat = ?
                "#,
            )
            .bind(&payload.t)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "valid": false, "error": format!("Database error: {}", e) })),
                )
            })?;

            if let Some(r) = row {
                let no_surat: String = r.get("no_surat");
                let no_rawat: String = r.get("no_rawat");
                let tgl_surat: String = r.get("tgl_surat");
                let nm_pasien: String = r.get("nm_pasien");
                let no_rm: String = r.get("no_rkm_medis");
                let nm_dokter: String = r.get("nm_dokter");
                let sip: String = r.get("sip");
                let nik_dok: String = r.get("nik_dokter");

                Ok(Json(VerifyResponse {
                    valid: true,
                    tipe: "skd".to_string(),
                    judul: "Surat Keterangan Sehat".to_string(),
                    no_surat,
                    no_rawat,
                    tanggal: tgl_surat,
                    pasien: PasienVerifyInfo {
                        nama_masked: mask_name(&nm_pasien),
                        no_rm_masked: mask_rm(&no_rm),
                        lama_sakit: None,
                        periode: None,
                    },
                    penandatangan: PenandatanganVerifyInfo {
                        nama: nm_dokter,
                        sip,
                        nik_masked: mask_nik(&nik_dok),
                        instansi: "RSUD Cabangbungin Kab. Bekasi".to_string(),
                        otoritas_sertifikat: "Balai Besar Sertifikasi Elektronik (BSrE), Badan Siber dan Sandi Negara".to_string(),
                    },
                    keterangan: Some("Pemeriksaan kesehatan telah selesai dilakukan oleh dokter yang bersangkutan.".to_string()),
                    status_tte: "Ditandatangani secara elektronik (TTE) menggunakan sertifikat elektronik resmi BSrE BSSN".to_string(),
                    has_pdf: false,
                }))
            } else {
                Err((
                    StatusCode::NOT_FOUND,
                    Json(json!({ "valid": false, "error": "Data Surat Keterangan Sehat tidak ditemukan." })),
                ))
            }
        }
        "rj" | "ri" => {
            let is_ranap = payload.x == "ri";
            let tbl_resume = if is_ranap { "resume_pasien_ranap" } else { "resume_pasien" };
            let sql = format!(
                r#"
                SELECT 
                  rm.no_rawat,
                  DATE_FORMAT(rp.tgl_registrasi, '%d-%m-%Y') as tgl_surat,
                  p.nm_pasien,
                  p.no_rkm_medis,
                  DATE_FORMAT(p.tgl_lahir, '%Y-%m-%d') as tgl_lahir,
                  d.nm_dokter,
                  IFNULL(d.no_ijn_praktek, '-') as sip,
                  IFNULL(pg.no_ktp, '') as nik_dokter
                FROM {} rm
                INNER JOIN reg_periksa rp ON rm.no_rawat = rp.no_rawat
                INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
                INNER JOIN dokter d ON rm.kd_dokter = d.kd_dokter
                LEFT JOIN pegawai pg ON d.kd_dokter = pg.nik
                WHERE rm.no_rawat = ?
                "#,
                tbl_resume
            );

            let row = sqlx::query(&sql)
                .bind(&payload.t)
                .fetch_optional(&state.pool)
                .await
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "valid": false, "error": format!("Database error: {}", e) })),
                    )
                })?;

            if let Some(r) = row {
                let no_rawat: String = r.get("no_rawat");
                let tgl_surat: String = r.get("tgl_surat");
                let nm_pasien: String = r.get("nm_pasien");
                let no_rm: String = r.get("no_rkm_medis");
                let nm_dokter: String = r.get("nm_dokter");
                let sip: String = r.get("sip");
                let nik_dok: String = r.get("nik_dokter");

                let judul = if is_ranap { "Resume Medis Rawat Inap" } else { "Resume Medis Rawat Jalan" };

                Ok(Json(VerifyResponse {
                    valid: true,
                    tipe: payload.x.clone(),
                    judul: judul.to_string(),
                    no_surat: no_rawat.clone(),
                    no_rawat,
                    tanggal: tgl_surat,
                    pasien: PasienVerifyInfo {
                        nama_masked: mask_name(&nm_pasien),
                        no_rm_masked: mask_rm(&no_rm),
                        lama_sakit: None,
                        periode: None,
                    },
                    penandatangan: PenandatanganVerifyInfo {
                        nama: nm_dokter,
                        sip,
                        nik_masked: mask_nik(&nik_dok),
                        instansi: "RSUD Cabangbungin Kab. Bekasi".to_string(),
                        otoritas_sertifikat: "Balai Besar Sertifikasi Elektronik (BSrE), Badan Siber dan Sandi Negara".to_string(),
                    },
                    keterangan: Some("Resume medis elektronik pasien.".to_string()),
                    status_tte: "Ditandatangani secara elektronik (TTE) menggunakan sertifikat elektronik resmi BSrE BSSN".to_string(),
                    has_pdf: false,
                }))
            } else {
                Err((
                    StatusCode::NOT_FOUND,
                    Json(json!({ "valid": false, "error": "Data resume medis tidak ditemukan." })),
                ))
            }
        }
        _ => Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "valid": false, "error": format!("Tipe dokumen '{}' tidak didukung.", payload.x) })),
        )),
    }
}

/// POST /api/verify/download
/// Verifikasi kecocokan tanggal lahir pasien, jika cocok: stream file PDF dokumen asli hasil TTE
pub async fn download_dokumen_asli(
    State(state): State<AppState>,
    Json(body): Json<DownloadBody>,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let payload = parse_token(&body.id).map_err(|err| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": err })),
        )
    })?;

    // Hanya tipe 'sakit' yang saat ini memiliki file PDF TTE di berkas_digital_perawatan
    if payload.x != "sakit" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Unduh dokumen PDF saat ini baru tersedia untuk Surat Keterangan Sakit." })),
        ));
    }

    let row = sqlx::query(
        r#"
        SELECT 
          s.no_surat,
          s.no_rawat,
          p.nm_pasien,
          DATE_FORMAT(p.tgl_lahir, '%Y-%m-%d') as tgl_lahir,
          IFNULL((SELECT b.lokasi_file FROM berkas_digital_perawatan b 
                  WHERE b.no_rawat = s.no_rawat AND b.kode = '064' LIMIT 1), '') as file_berkas
        FROM suratsakit s
        INNER JOIN reg_periksa rp ON s.no_rawat = rp.no_rawat
        INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        WHERE s.no_surat = ?
        "#,
    )
    .bind(&payload.t)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Database error: {}", e) })),
        )
    })?;

    let r = row.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Surat Sakit tidak ditemukan." })),
        )
    })?;

    let tgl_lahir_db: String = r.get("tgl_lahir");
    let no_surat: String = r.get("no_surat");
    let no_rawat: String = r.get("no_rawat");
    let file_berkas: String = r.get("file_berkas");

    // Validasi Tanggal Lahir
    if !matches_tgl_lahir(&tgl_lahir_db, &body.tgl_lahir) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Tanggal lahir tidak sesuai dengan data rekam medis pasien. Akses unduh dokumen ditolak demi keamanan privasi." })),
        ));
    }

    // Nama file PDF
    let clean_rawat = no_rawat.replace(['/', '-', ' '], "_");
    let clean_surat = no_surat.replace(['/', '-', ' '], "_");
    let default_filename = format!("SuratSakit_{}_{}.pdf", clean_rawat, clean_surat);

    // Cari file di beberapa kandidat lokasi
    let candidates = vec![
        format!("/var/www/html/webapps/berkasrawat/{}", file_berkas),
        format!("/var/www/html/berkasrawat/{}", file_berkas),
        format!("/Users/salimmulyana/development/java/rsudcabangbungin2026/tmpPDF/{}", default_filename),
        format!("./tmpPDF/{}", default_filename),
        format!("../rsudcabangbungin2026/tmpPDF/{}", default_filename),
        format!("/Users/salimmulyana/development/java/rsudcabangbungin2026/webappsrscb/berkasrawat/{}", file_berkas),
        format!("/Users/salimmulyana/development/java/rsudcabangbungin2026/webappsrscb/{}", file_berkas),
    ];

    let mut pdf_bytes: Option<Vec<u8>> = None;
    for path in &candidates {
        if let Ok(bytes) = tokio::fs::read(path).await {
            pdf_bytes = Some(bytes);
            break;
        }
    }

    let bytes = pdf_bytes.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "File dokumen PDF TTE belum tersedia pada penyimpanan server berkas rawat." })),
        )
    })?;

    let disposition = format!("inline; filename=\"{}.pdf\"", clean_surat);

    Ok((
        [
            (header::CONTENT_TYPE, "application/pdf"),
            (header::CONTENT_DISPOSITION, &disposition),
        ],
        bytes,
    )
        .into_response())
}
