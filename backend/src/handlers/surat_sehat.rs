use crate::{
    auth::middleware::AuthUser,
    models::surat_sehat::{SuratSehatPrefill, SuratSehatSimpan, SuratSehatSimpanResponse},
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Deserialize)]
pub struct PrefillQuery {
    pub no_rawat: String,
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub tgl_awal: Option<String>,
    pub tgl_akhir: Option<String>,
    pub q: Option<String>,
    pub page: Option<i64>,
    pub size: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SuratSehatRow {
    pub no_surat: String,
    pub no_rawat: String,
    pub no_rm: String,
    pub nm_pasien: String,
    pub tanggalsurat: String,
    pub kesimpulan: String,
    pub keperluan: String,
    pub kd_dokter: String,
    pub nm_dokter: String,
}

#[derive(Debug, Serialize)]
pub struct SuratSehatListResponse {
    pub data: Vec<SuratSehatRow>,
    pub total: i64,
    pub page: i64,
    pub size: i64,
}

/// Cek hak akses `surat_keterangan_sehat` untuk user. Admin bypass.
fn require_perm(user: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if user.0.is_admin { return Ok(()); }
    let allowed = user.0.permissions.get("surat_keterangan_sehat").copied().unwrap_or(false);
    if !allowed {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "Akses ditolak: tidak punya hak akses Surat Keterangan Sehat"})),
        ));
    }
    Ok(())
}

/// GET /api/surat/sehat?no_rawat=xxx
/// Mengambil data prefill: pasien, dokter, vital signs, header RS,
/// + record surat_keterangan_sehat (kalau sudah ada).
pub async fn get_prefill(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<PrefillQuery>,
) -> Result<Json<SuratSehatPrefill>, (StatusCode, Json<Value>)> {
    require_perm(&_user)?;
    // Data registrasi+pasien+dokter+alamat
    let row: Option<(
        String, String, String, String, String, Option<String>,
        String, String,
    )> = sqlx::query_as(
        "SELECT r.no_rawat, p.no_rkm_medis, p.nm_pasien, p.jk,
                CONCAT(r.umurdaftar,' ',r.sttsumur) AS umur,
                DATE_FORMAT(p.tgl_lahir,'%Y-%m-%d'),
                IFNULL(d.kd_dokter,''), IFNULL(d.nm_dokter,'')
         FROM reg_periksa r
         INNER JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN dokter d ON r.kd_dokter = d.kd_dokter
         WHERE r.no_rawat = ?
         LIMIT 1"
    )
    .bind(&q.no_rawat)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;

    let (no_rawat, no_rm, nm_pasien, jk, umur, tgl_lahir, kd_dokter, nm_dokter) = match row {
        Some(r) => r,
        None => return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "No. rawat tidak ditemukan"})),
        )),
    };

    // Alamat lengkap (separate query agar JOIN registrasi tidak gagal kalau kelurahan/kecamatan/kabupaten kosong)
    let alamat: String = sqlx::query_as::<_, (String,)>(
        "SELECT CONCAT(IFNULL(p.alamat,''),', ',IFNULL(kel.nm_kel,''),', ',IFNULL(kec.nm_kec,''),', ',IFNULL(kab.nm_kab,''))
         FROM pasien p
         LEFT JOIN kelurahan kel ON p.kd_kel = kel.kd_kel
         LEFT JOIN kecamatan kec ON p.kd_kec = kec.kd_kec
         LEFT JOIN kabupaten kab ON p.kd_kab = kab.kd_kab
         WHERE p.no_rkm_medis = ?
         LIMIT 1"
    )
    .bind(&no_rm)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?
    .map(|t| t.0)
    .unwrap_or_default();

    // Vital signs default dari pemeriksaan_ralan terbaru untuk no_rawat ini
    let vital: Option<(Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT berat, tinggi, tensi, nadi, respirasi, suhu_tubuh
         FROM pemeriksaan_ralan
         WHERE no_rawat = ?
         ORDER BY tgl_perawatan DESC, jam_rawat DESC
         LIMIT 1"
    )
    .bind(&no_rawat)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;

    // Existing surat_keterangan_sehat (kalau sudah pernah disimpan untuk no_rawat ini)
    let existing: Option<(String, String, String, String, String, String, String, String, String, String, String, String)> = sqlx::query_as(
        "SELECT no_surat, DATE_FORMAT(tanggalsurat,'%Y-%m-%d') as tanggalsurat,
                berat, tinggi, tensi, nadi, rr, suhu,
                butawarna, keperluan, kesimpulan, kd_dokter
         FROM surat_keterangan_sehat
         WHERE no_rawat = ?
         ORDER BY tanggalsurat DESC
         LIMIT 1"
    )
    .bind(&no_rawat)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;

    // Header RS dari `setting`
    let setting: Option<(String, String, String, String, String, String)> = sqlx::query_as(
        "SELECT IFNULL(nama_instansi,''), IFNULL(alamat_instansi,''),
                IFNULL(kabupaten,''), IFNULL(propinsi,''),
                IFNULL(kontak,''), IFNULL(email,'')
         FROM setting LIMIT 1"
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;

    let (nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email) =
        setting.unwrap_or_default();

    // Pilih nilai vital signs: existing > pemeriksaan_ralan > ""
    let pick = |from_existing: Option<&str>, from_vital: Option<&str>| -> String {
        from_existing
            .filter(|s| !s.is_empty())
            .or(from_vital.filter(|s| !s.is_empty()))
            .unwrap_or("")
            .to_string()
    };

    let (e_berat, e_tinggi, e_tensi, e_nadi, e_rr, e_suhu);
    let (e_no_surat, e_tanggal, e_butawarna, e_keperluan, e_kesimpulan, e_kd_dokter);
    if let Some(ref e) = existing {
        e_no_surat = Some(e.0.clone());
        e_tanggal = Some(e.1.clone());
        e_berat = Some(e.2.as_str());
        e_tinggi = Some(e.3.as_str());
        e_tensi = Some(e.4.as_str());
        e_nadi = Some(e.5.as_str());
        e_rr = Some(e.6.as_str());
        e_suhu = Some(e.7.as_str());
        e_butawarna = e.8.clone();
        e_keperluan = e.9.clone();
        e_kesimpulan = e.10.clone();
        e_kd_dokter = e.11.clone();
    } else {
        e_no_surat = None;
        e_tanggal = None;
        e_berat = None;
        e_tinggi = None;
        e_tensi = None;
        e_nadi = None;
        e_rr = None;
        e_suhu = None;
        e_butawarna = "Tidak".to_string();
        e_keperluan = String::new();
        e_kesimpulan = "Sehat".to_string();
        e_kd_dokter = kd_dokter.clone();
    }

    let v_berat  = vital.as_ref().and_then(|v| v.0.as_deref());
    let v_tinggi = vital.as_ref().and_then(|v| v.1.as_deref());
    let v_tensi  = vital.as_ref().and_then(|v| v.2.as_deref());
    let v_nadi   = vital.as_ref().and_then(|v| v.3.as_deref());
    let v_rr     = vital.as_ref().and_then(|v| v.4.as_deref());
    let v_suhu   = vital.as_ref().and_then(|v| v.5.as_deref());

    // Dokter: prefer existing, fallback dokter registrasi
    let final_kd_dokter = if e_kd_dokter.is_empty() { kd_dokter.clone() } else { e_kd_dokter.clone() };
    let final_nm_dokter = if final_kd_dokter == kd_dokter {
        nm_dokter.clone()
    } else {
        sqlx::query_as::<_, (String,)>("SELECT nm_dokter FROM dokter WHERE kd_dokter = ?")
            .bind(&final_kd_dokter)
            .fetch_optional(&state.pool)
            .await
            .map_err(db_err)?
            .map(|t| t.0)
            .unwrap_or_default()
    };

    // Finger SHA1 (untuk QR petugas): SELECT sha1(sidikjari.sidikjari) JOIN pegawai by NIK
    let finger: String = sqlx::query_as::<_, (String,)>(
        "SELECT SHA1(sidikjari.sidikjari)
         FROM sidikjari INNER JOIN pegawai ON pegawai.id = sidikjari.id
         WHERE pegawai.nik = ? LIMIT 1"
    )
    .bind(&final_kd_dokter)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?
    .map(|t| t.0)
    .filter(|s| !s.is_empty())
    .unwrap_or_else(|| final_kd_dokter.clone());

    // verify_url hanya valid kalau surat sudah pernah disimpan (no_surat ada).
    // Format & enkripsi mengikuti Java desktop persis (lihat enkripsi_aes.rs):
    //   https://{URLVERIFIKASI}/verify/?id={Base64(AES-CBC("Bar12345Bar12345","sayangsamakhanza", payload))}
    //   payload = "{'x': 'skd', 't':'NO_SURAT'}"
    let verify_url = match &e_no_surat {
        Some(s) => {
            let payload = format!("{{'x': 'skd', 't':'{}'}}", s);
            let encrypted = crate::enkripsi_aes::encrypt(&payload);
            let base = std::env::var("URL_VERIFIKASI").unwrap_or_default();
            // Java assemble pakai "https://" prefix + URLVERIFIKASI; kita biarkan env value full URL apa adanya
            format!("{}/verify/?id={}", base.trim_end_matches('/'), encrypted)
        }
        None => String::new(),
    };

    Ok(Json(SuratSehatPrefill {
        no_rawat,
        no_rm,
        nm_pasien,
        jk,
        umur,
        tgl_lahir,
        alamat,
        kd_dokter: final_kd_dokter,
        nm_dokter: final_nm_dokter,
        berat: pick(e_berat, v_berat),
        tinggi: pick(e_tinggi, v_tinggi),
        tensi: pick(e_tensi, v_tensi),
        nadi: pick(e_nadi, v_nadi),
        rr: pick(e_rr, v_rr),
        suhu: pick(e_suhu, v_suhu),
        no_surat: e_no_surat,
        tanggalsurat: e_tanggal,
        butawarna: e_butawarna,
        keperluan: e_keperluan,
        kesimpulan: e_kesimpulan,
        nama_instansi,
        alamat_instansi,
        kabupaten,
        propinsi,
        kontak,
        email,
        finger,
        verify_url,
    }))
}

/// POST /api/surat/sehat
/// Upsert surat_keterangan_sehat. no_surat opsional — auto-generate kalau kosong.
pub async fn simpan(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<SuratSehatSimpan>,
) -> Result<Json<SuratSehatSimpanResponse>, (StatusCode, Json<Value>)> {
    require_perm(&_user)?;
    let no_surat = match body.no_surat.as_deref().filter(|s| !s.trim().is_empty()) {
        Some(s) => s.to_string(),
        None => generate_no_surat(&state).await?,
    };

    // Upsert: INSERT ... ON DUPLICATE KEY UPDATE
    sqlx::query(
        "INSERT INTO surat_keterangan_sehat
         (no_surat, no_rawat, tanggalsurat, berat, tinggi, tensi, nadi, rr, suhu,
          butawarna, keperluan, kesimpulan, kd_dokter)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           no_rawat=VALUES(no_rawat), tanggalsurat=VALUES(tanggalsurat),
           berat=VALUES(berat), tinggi=VALUES(tinggi), tensi=VALUES(tensi),
           nadi=VALUES(nadi), rr=VALUES(rr), suhu=VALUES(suhu),
           butawarna=VALUES(butawarna), keperluan=VALUES(keperluan),
           kesimpulan=VALUES(kesimpulan), kd_dokter=VALUES(kd_dokter)"
    )
    .bind(&no_surat)
    .bind(&body.no_rawat)
    .bind(&body.tanggalsurat)
    .bind(&body.berat)
    .bind(&body.tinggi)
    .bind(&body.tensi)
    .bind(&body.nadi)
    .bind(&body.rr)
    .bind(&body.suhu)
    .bind(&body.butawarna)
    .bind(&body.keperluan)
    .bind(&body.kesimpulan)
    .bind(&body.kd_dokter)
    .execute(&state.pool)
    .await
    .map_err(db_err)?;

    use crate::audit::q;
    crate::audit::log_sql(&state.pool, &_user.0.kode, &format!(
        "INSERT INTO surat_keterangan_sehat (no_surat, no_rawat, tanggalsurat, berat, tinggi, tensi, nadi, rr, suhu, butawarna, keperluan, kesimpulan, kd_dokter) VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})",
        q(&no_surat), q(&body.no_rawat), q(&body.tanggalsurat), q(&body.berat), q(&body.tinggi),
        q(&body.tensi), q(&body.nadi), q(&body.rr), q(&body.suhu), q(&body.butawarna),
        q(&body.keperluan), q(&body.kesimpulan), q(&body.kd_dokter)
    )).await;

    Ok(Json(SuratSehatSimpanResponse {
        success: true,
        no_surat,
        message: "Surat keterangan sehat berhasil disimpan".to_string(),
    }))
}

/// Format: SKS-YYYYMMDD-NNN (NNN = urutan harian)
async fn generate_no_surat(state: &AppState) -> Result<String, (StatusCode, Json<Value>)> {
    let today = chrono::Local::now().format("%Y%m%d").to_string();
    let prefix = format!("SKS-{}-", today);
    let like = format!("{}%", prefix);

    let max: Option<(String,)> = sqlx::query_as(
        "SELECT no_surat FROM surat_keterangan_sehat
         WHERE no_surat LIKE ?
         ORDER BY no_surat DESC LIMIT 1"
    )
    .bind(&like)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;

    let next_seq = max
        .and_then(|(s,)| s.rsplit('-').next().and_then(|n| n.parse::<u32>().ok()))
        .map(|n| n + 1)
        .unwrap_or(1);

    Ok(format!("{}{:03}", prefix, next_seq))
}

/// GET /api/surat/sehat/list?tgl_awal=&tgl_akhir=&q=&page=&size=
pub async fn list(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<SuratSehatListResponse>, (StatusCode, Json<Value>)> {
    require_perm(&_user)?;
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(50).clamp(1, 200);
    let offset = (page - 1) * size;

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tgl_awal = q.tgl_awal.unwrap_or_else(|| today.clone());
    let tgl_akhir = q.tgl_akhir.unwrap_or_else(|| today.clone());
    let cari_like = format!("%{}%", q.q.unwrap_or_default());

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)
         FROM surat_keterangan_sehat sks
         INNER JOIN reg_periksa r ON sks.no_rawat = r.no_rawat
         INNER JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN dokter d ON sks.kd_dokter = d.kd_dokter
         WHERE sks.tanggalsurat BETWEEN ? AND ?
           AND (sks.no_surat LIKE ? OR sks.no_rawat LIKE ? OR p.nm_pasien LIKE ?
                OR p.no_rkm_medis LIKE ? OR sks.keperluan LIKE ?
                OR d.nm_dokter LIKE ?)"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    let data: Vec<SuratSehatRow> = sqlx::query_as(
        "SELECT sks.no_surat, sks.no_rawat,
                p.no_rkm_medis as no_rm, p.nm_pasien,
                DATE_FORMAT(sks.tanggalsurat,'%Y-%m-%d') as tanggalsurat,
                sks.kesimpulan, sks.keperluan,
                sks.kd_dokter, IFNULL(d.nm_dokter,'') as nm_dokter
         FROM surat_keterangan_sehat sks
         INNER JOIN reg_periksa r ON sks.no_rawat = r.no_rawat
         INNER JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN dokter d ON sks.kd_dokter = d.kd_dokter
         WHERE sks.tanggalsurat BETWEEN ? AND ?
           AND (sks.no_surat LIKE ? OR sks.no_rawat LIKE ? OR p.nm_pasien LIKE ?
                OR p.no_rkm_medis LIKE ? OR sks.keperluan LIKE ?
                OR d.nm_dokter LIKE ?)
         ORDER BY sks.tanggalsurat DESC, sks.no_surat DESC
         LIMIT ? OFFSET ?"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(size).bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(SuratSehatListResponse { data, total: total.0, page, size }))
}

/// DELETE /api/surat/sehat/:no_surat
pub async fn hapus(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(no_surat): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&_user)?;
    let res = sqlx::query("DELETE FROM surat_keterangan_sehat WHERE no_surat = ?")
        .bind(&no_surat)
        .execute(&state.pool)
        .await
        .map_err(db_err)?;

    if res.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Surat tidak ditemukan"})),
        ));
    }

    crate::audit::log_sql(&state.pool, &_user.0.kode, &format!(
        "DELETE FROM surat_keterangan_sehat WHERE no_surat={}", crate::audit::q(&no_surat)
    )).await;

    Ok(Json(json!({"success": true, "no_surat": no_surat})))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error surat_sehat: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
