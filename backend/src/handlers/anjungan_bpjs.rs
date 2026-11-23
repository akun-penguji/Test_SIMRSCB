// Anjungan — Pendaftaran BPJS (port APMSEPDuaPrinter Menu 2: BPJS Rujukan Baru).
// Hanya endpoint READ untuk MVP (cek peserta + list rujukan); create SEP nanti.

use crate::{handlers::bridging_bpjs::{BpjsClient, BpjsConfig}, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};

fn err400(msg: &str) -> (StatusCode, Json<Value>) {
    (StatusCode::BAD_REQUEST, Json(json!({"error": msg})))
}
fn err503(msg: &str) -> (StatusCode, Json<Value>) {
    (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"error": msg})))
}
fn err_upstream(e: String) -> (StatusCode, Json<Value>) {
    tracing::warn!("BPJS upstream: {}", e);
    (StatusCode::BAD_GATEWAY, Json(json!({"error": e})))
}

fn client_from_env() -> Result<BpjsClient, (StatusCode, Json<Value>)> {
    BpjsConfig::from_env()
        .map(BpjsClient::new)
        .ok_or_else(|| err503("Konfigurasi BPJS belum diset (BPJS_CONS_ID/SECRET/USER_KEY/URL kosong)"))
}

// ── 1. Cek Peserta by NIK atau No. Kartu ─────────────────────────────────────
#[derive(Deserialize)]
pub struct CekPesertaQuery {
    pub nik:     Option<String>,
    pub nokartu: Option<String>,
    pub tgl:     Option<String>,   // YYYY-MM-DD, default = hari ini
}

pub async fn cek_peserta(
    State(_state): State<AppState>,
    Query(q): Query<CekPesertaQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tgl = q.tgl.clone().unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());
    let by_nik     = q.nik.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty());
    let by_nokartu = q.nokartu.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty());

    let path = match (by_nik, by_nokartu) {
        (None, Some(nokartu)) => format!("Peserta/nokartu/{}/tglSEP/{}", nokartu, tgl),
        (Some(nik), _)        => format!("Peserta/nik/{}/tglSEP/{}", nik, tgl),
        (None, None)          => return Err(err400("Harus diisi salah satu: nik atau nokartu")),
    };

    let client = client_from_env()?;
    let resp = client.get(&path).await.map_err(err_upstream)?;
    Ok(Json(json!({ "ok": true, "tgl_sep": tgl, "peserta": resp })))
}

// ── 2. List Rujukan Peserta (dari Faskes 1 yang masih berlaku) ───────────────
#[derive(Deserialize)]
pub struct ListRujukanQuery { pub nokartu: String }

pub async fn list_rujukan(
    State(_state): State<AppState>,
    Query(q): Query<ListRujukanQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let nokartu = q.nokartu.trim();
    if nokartu.is_empty() {
        return Err(err400("nokartu wajib"));
    }
    let client = client_from_env()?;
    let resp = client.get(&format!("Rujukan/Peserta/{}", nokartu))
        .await.map_err(err_upstream)?;
    Ok(Json(json!({ "ok": true, "rujukan": resp })))
}

// ── 3. Cek Rujukan by Nomor ──────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct CekRujukanQuery { pub nomor: String }

pub async fn cek_rujukan(
    State(_state): State<AppState>,
    Query(q): Query<CekRujukanQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let nomor = q.nomor.trim();
    if nomor.is_empty() {
        return Err(err400("nomor rujukan wajib"));
    }
    let client = client_from_env()?;
    let resp = client.get(&format!("Rujukan/{}", nomor)).await.map_err(err_upstream)?;
    Ok(Json(json!({ "ok": true, "rujukan": resp })))
}

// ── 4. Konfigurasi BPJS aktif? (untuk frontend cek tombol enable/disable) ────
pub async fn status_bpjs(
    State(_state): State<AppState>,
) -> Json<Value> {
    let cfg = BpjsConfig::from_env();
    Json(json!({
        "configured": cfg.is_some(),
        "cons_id":    cfg.as_ref().map(|c| c.cons_id.clone()).unwrap_or_default(),
        "vclaim_url": cfg.as_ref().map(|c| c.vclaim_url.clone()).unwrap_or_default(),
    }))
}

// ── 5. Cari pasien Khanza by NIK (mapping ke no_rkm_medis) ──────────────────
// Setelah cek peserta BPJS, kita butuh no_rkm_medis lokal Khanza untuk INSERT reg_periksa.
// BPJS API memberi info `mr.noMR` tapi tidak guaranteed match — kita cari sendiri di pasien table.
#[derive(Deserialize)]
pub struct CariLokalQuery {
    pub nik:     Option<String>,
    pub no_kartu: Option<String>,
}

pub async fn cari_pasien_lokal(
    State(state): State<AppState>,
    Query(q): Query<CariLokalQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let nik = q.nik.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty());
    let nokartu = q.no_kartu.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty());

    // Coba dulu by no_peserta (BPJS), fallback by no_ktp
    let row: Option<(String, String, Option<String>, Option<String>, String)> = if let Some(nk) = nokartu {
        sqlx::query_as(
            "SELECT no_rkm_medis, nm_pasien, no_ktp, no_peserta, jk
             FROM pasien WHERE no_peserta=? LIMIT 1"
        ).bind(nk).fetch_optional(&state.pool).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
    } else if let Some(n) = nik {
        sqlx::query_as(
            "SELECT no_rkm_medis, nm_pasien, no_ktp, no_peserta, jk
             FROM pasien WHERE no_ktp=? LIMIT 1"
        ).bind(n).fetch_optional(&state.pool).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
    } else {
        return Err(err400("nik atau no_kartu harus diisi"));
    };

    match row {
        Some((rm, nama, nik_db, np, jk)) => Ok(Json(json!({
            "ok": true, "found": true,
            "no_rkm_medis": rm, "nm_pasien": nama,
            "no_ktp": nik_db, "no_peserta": np, "jk": jk,
        }))),
        None => Ok(Json(json!({
            "ok": true, "found": false,
            "message": "Pasien belum terdaftar di RS. Petugas loket akan mendaftarkan dulu."
        }))),
    }
}

// ── 7a. CEK SURAT KONTROL (lokal Khanza bridging_surat_kontrol_bpjs) ────────
// Port dari Java DlgCekSKDPKontrol.isValidSuratKontrol() —
// Cek surat kontrol via 4 mode pencarian:
//   1. no_surat   — langsung lookup specific surat
//   2. no_kartu   — cari latest surat kontrol valid milik peserta BPJS
//   3. no_rkm_medis — cari latest surat kontrol valid milik pasien Khanza
//   4. nik        — resolve ke no_rkm_medis via pasien.no_ktp, lalu sama dengan #3
//
// Priority kalau multiple di-isi: no_surat > no_kartu > no_rkm_medis > nik.
#[derive(Deserialize)]
pub struct CekSuratKontrolQuery {
    pub no_surat:     Option<String>,
    pub no_kartu:     Option<String>,
    pub no_rkm_medis: Option<String>,
    pub nik:          Option<String>,
}

pub async fn cek_surat_kontrol(
    State(state): State<AppState>,
    Query(q): Query<CekSuratKontrolQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let no_surat_input  = q.no_surat.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let no_kartu_input  = q.no_kartu.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let no_rkm_input    = q.no_rkm_medis.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let nik_input       = q.nik.as_deref().map(str::trim).filter(|s| !s.is_empty());

    if no_surat_input.is_none() && no_kartu_input.is_none()
       && no_rkm_input.is_none() && nik_input.is_none() {
        return Err(err400("Salah satu wajib: no_surat / no_kartu / no_rkm_medis / nik"));
    }

    // Resolve no_surat dari identitas pasien (kalau no_surat tidak di-isi langsung)
    let no_surat = if let Some(ns) = no_surat_input {
        ns.to_string()
    } else {
        // Resolve no_rkm_medis dulu dari nik (kalau nik mode)
        let no_rkm_resolved: Option<String> = if let Some(rm) = no_rkm_input {
            Some(rm.to_string())
        } else if let Some(nik) = nik_input {
            sqlx::query_scalar("SELECT no_rkm_medis FROM pasien WHERE no_ktp=? LIMIT 1")
                .bind(nik).fetch_optional(&state.pool).await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
        } else { None };

        // Build query untuk cari latest surat kontrol valid milik pasien:
        // - tgl_rencana <= today (siap dipakai)
        // - belum dipakai untuk daftar hari ini (no_sep belum ada di reg_periksa today)
        // - ambil yang terbaru
        let (sql_filter, bind_val): (&str, String) = if let Some(nk) = no_kartu_input {
            ("bs.no_kartu = ?", nk.to_string())
        } else if let Some(rm) = no_rkm_resolved.as_deref() {
            ("bs.nomr = ?", rm.to_string())
        } else {
            return Err(err400("Identitas tidak valid"));
        };

        let sql = format!(
            "SELECT sk.no_surat FROM bridging_surat_kontrol_bpjs sk
             JOIN bridging_sep bs ON bs.no_sep = sk.no_sep
             WHERE {filter}
               AND sk.tgl_rencana <= CURDATE()
               AND NOT EXISTS (
                 SELECT 1 FROM reg_periksa r
                 WHERE r.no_rkm_medis = bs.nomr
                   AND r.tgl_registrasi = CURDATE()
               )
             ORDER BY sk.tgl_rencana DESC, sk.tgl_surat DESC
             LIMIT 1",
            filter = sql_filter,
        );

        let resolved: Option<String> = sqlx::query_scalar(&sql)
            .bind(&bind_val).fetch_optional(&state.pool).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

        match resolved {
            Some(ns) => ns,
            None => return Err((StatusCode::NOT_FOUND, Json(json!({
                "error": "Tidak ada surat kontrol aktif untuk pasien ini. \
                          Pastikan: (1) surat kontrol sudah dibuat di kunjungan sebelumnya, \
                          (2) tanggal rencana sudah tiba, (3) pasien belum daftar hari ini."
            })))),
        }
    };

    // 1. Cari surat kontrol di Khanza
    #[derive(sqlx::FromRow)]
    struct SkRow {
        no_sep:        String,
        tgl_surat:     Option<String>,
        no_surat:      String,
        tgl_rencana:   Option<String>,
        kd_dokter_bpjs: String,
        nm_dokter_bpjs: String,
        kd_poli_bpjs:   String,
        nm_poli_bpjs:   String,
        days_to_today:  i64,
    }
    let sk: Option<SkRow> = sqlx::query_as(
        "SELECT no_sep, DATE_FORMAT(tgl_surat,'%Y-%m-%d') AS tgl_surat, no_surat,
                DATE_FORMAT(tgl_rencana,'%Y-%m-%d') AS tgl_rencana,
                kd_dokter_bpjs, nm_dokter_bpjs, kd_poli_bpjs, nm_poli_bpjs,
                CAST(DATEDIFF(tgl_rencana, CURDATE()) AS SIGNED) AS days_to_today
         FROM bridging_surat_kontrol_bpjs WHERE no_surat=? LIMIT 1"
    ).bind(&no_surat)
    .fetch_optional(&state.pool).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let Some(sk) = sk else {
        return Err((StatusCode::NOT_FOUND,
            Json(json!({"error": format!("Surat kontrol nomor '{}' tidak ditemukan di sistem", no_surat)}))));
    };

    // 2. Validasi: tgl_rencana <= hari ini (per Java DlgCekSKDPKontrol)
    if sk.days_to_today > 0 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({
            "error": format!("Jadwal kontrol tidak boleh maju. Tgl rencana: {}", sk.tgl_rencana.as_deref().unwrap_or("?")),
            "tgl_rencana": sk.tgl_rencana,
        }))));
    }

    // 3. Cek pasien tidak sudah cekin via Mobile JKN hari yang sama
    let mobilejkn_count: i64 = sqlx::query_scalar(
        "SELECT CAST(COUNT(*) AS SIGNED) FROM referensi_mobilejkn_bpjs
         WHERE (nomorreferensi=? OR norm=?) AND tanggalperiksa=CURDATE()"
    ).bind(&no_surat).bind(&no_surat)
    .fetch_one(&state.pool).await.unwrap_or(0);
    if mobilejkn_count > 0 {
        return Err((StatusCode::CONFLICT, Json(json!({
            "error": "Pasien telah cekin via Mobile JKN hari ini. Gunakan menu Mobile JKN."
        }))));
    }

    // 4. Resolve mapping ke Khanza local
    let poli_rs: Option<(String, String)> = sqlx::query_as(
        "SELECT m.kd_poli_rs, p.nm_poli
         FROM maping_poli_bpjs m
         LEFT JOIN poliklinik p ON p.kd_poli=m.kd_poli_rs
         WHERE m.kd_poli_bpjs=? LIMIT 1"
    ).bind(&sk.kd_poli_bpjs)
    .fetch_optional(&state.pool).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let dokter_rs: Option<(String, String)> = sqlx::query_as(
        "SELECT m.kd_dokter, d.nm_dokter
         FROM maping_dokter_dpjpvclaim m
         LEFT JOIN dokter d ON d.kd_dokter=m.kd_dokter
         WHERE m.kd_dokter_bpjs=? LIMIT 1"
    ).bind(&sk.kd_dokter_bpjs)
    .fetch_optional(&state.pool).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    // 5. Cari diagnosa awal dari SEP sebelumnya (untuk dipakai di SEP kontrol baru)
    let dx_sebelum: Option<(String, String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT bs.no_sep, bs.diagawal, bs.nmdiagnosaawal,
                bs.no_kartu, bs.nama_pasien,
                bs.nomr, bs.peserta, bs.notelep
         FROM bridging_sep bs WHERE bs.no_sep=? LIMIT 1"
    ).bind(&sk.no_sep)
    .fetch_optional(&state.pool).await.ok().flatten();

    // 6. Cek apakah pasien sudah pernah daftar hari ini (block re-register)
    if let Some((_, _, _, _, _, ref nomr, _, _)) = dx_sebelum {
        if let Some(nomr) = nomr {
            let sudah: i64 = sqlx::query_scalar(
                "SELECT CAST(COUNT(*) AS SIGNED) FROM reg_periksa
                 WHERE no_rkm_medis=? AND tgl_registrasi=CURDATE()"
            ).bind(nomr)
            .fetch_one(&state.pool).await.unwrap_or(0);
            if sudah > 0 {
                return Err((StatusCode::CONFLICT, Json(json!({
                    "error": "Pasien sudah terdaftar hari ini. Tidak bisa daftar ulang."
                }))));
            }
        }
    }

    Ok(Json(json!({
        "ok": true,
        "surat_kontrol": {
            "no_surat":       sk.no_surat,
            "no_sep_asal":    sk.no_sep,
            "tgl_surat":      sk.tgl_surat,
            "tgl_rencana":    sk.tgl_rencana,
            "kd_dokter_bpjs": sk.kd_dokter_bpjs,
            "nm_dokter_bpjs": sk.nm_dokter_bpjs,
            "kd_poli_bpjs":   sk.kd_poli_bpjs,
            "nm_poli_bpjs":   sk.nm_poli_bpjs,
        },
        "mapping": {
            "kd_dokter_rs": dokter_rs.as_ref().map(|x| x.0.clone()),
            "nm_dokter_rs": dokter_rs.as_ref().map(|x| x.1.clone()),
            "kd_poli_rs":   poli_rs.as_ref().map(|x| x.0.clone()),
            "nm_poli_rs":   poli_rs.as_ref().map(|x| x.1.clone()),
        },
        "sep_asal": dx_sebelum.map(|(ns, dx_kode, dx_nama, no_kartu, nama, nomr, peserta, notelep)| json!({
            "no_sep":       ns,
            "diag_kode":    dx_kode,
            "diag_nama":    dx_nama,
            "no_kartu":     no_kartu,
            "nama_pasien":  nama,
            "no_rkm_medis": nomr,
            "peserta":      peserta,
            "no_telp":      notelep,
        })),
    })))
}

// ── 7b. CREATE SEP Kontrol (asalRujukan=2 + SKDP terisi) ────────────────────
#[derive(Deserialize)]
pub struct CreateSepKontrolBody {
    /// Epoch ms saat pasien memasukkan nomor kartu di anjungan (task 1).
    /// Direkam frontend; kalau kosong dipakai jam registrasi.
    #[serde(default)]
    pub waktu_task1:     Option<i64>,
    /// Epoch ms saat lembar SEP terbuka di anjungan (task 2).
    /// Kalau kosong dipakai waktu SEP dibuat.
    #[serde(default)]
    pub waktu_task2:     Option<i64>,
    pub no_rawat:        String,
    pub no_surat:        String,    // no_surat kontrol
    // Data peserta + pasien (dari result cek-surat-kontrol)
    pub no_kartu:        String,
    pub no_rkm_medis:    String,
    pub nama_pasien:     String,
    pub tgl_lahir:       Option<String>,
    pub jk:              Option<String>,
    pub no_telp:         Option<String>,
    pub peserta:         Option<String>,
    pub hak_kelas:       Option<String>,    // dari peserta BPJS API
    // Data kontrol
    pub tgl_surat:       String,            // tgl surat kontrol dibuat
    pub diag_kode:       String,            // dx dari SEP asal
    pub diag_nama:       String,
    pub kd_poli_bpjs:    String,
    pub nm_poli_bpjs:    String,
    pub kd_poli_rs:      String,
    pub kd_dokter_rs:    String,            // dokter Khanza yang dipilih
    pub kd_dokter_bpjs:  String,            // dari mapping/surat kontrol
    pub tujuan_kunjungan: Option<String>,   // "1"=Prosedur lanjutan "2"=Konsul (default 2)
    pub catatan:         Option<String>,
}

// ── Add Antrean BPJS (POST /antrean/add) — dipanggil SEBELUM create SEP ──────
// Port dari APMSEPDuaPrinter SimpanAntrianOnSite(): daftarkan antrean ke BPJS
// Antrean RS. Urutan wajib: add antrean DULU; kalau ditolak (metadata.code != 200)
// SEP TIDAK dibuat. Di-gate flag BPJS_ADD_ANTREAN (default OFF) supaya aman.

/// Nama hari (uppercase Indonesia) sesuai kolom jadwal.hari_kerja Khanza.
fn hari_indo(tgl: &str) -> String {
    use chrono::Datelike;
    let names = ["AKHAD", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
    chrono::NaiveDate::parse_from_str(tgl, "%Y-%m-%d")
        .map(|d| names[d.weekday().num_days_from_sunday() as usize].to_string())
        .unwrap_or_else(|_| "SENIN".to_string())
}

/// estimasidilayani = (tgl + jam_mulai) + angka*10 menit, epoch MILIDETIK (WIB).
fn estimasi_dilayani(tgl: &str, jam_mulai: &str, angka: i64) -> i64 {
    use chrono::TimeZone;
    let wib = chrono::FixedOffset::east_opt(7 * 3600).unwrap();
    let jm = jam_mulai.get(0..8).unwrap_or("08:00:00");
    let s = format!("{} {}", tgl, jm);
    match chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%d %H:%M:%S") {
        Ok(ndt) => wib.from_local_datetime(&ndt).single()
            .map(|dt| dt.timestamp_millis() + angka.max(0) * 10 * 60 * 1000)
            .unwrap_or(0),
        Err(_) => 0,
    }
}

#[allow(clippy::too_many_arguments)]
async fn add_antrean_bpjs(
    pool: &sqlx::MySqlPool,
    no_rawat: &str, no_kartu: &str, no_rkm_medis: &str, nama_pasien: &str, no_telp: &str,
    kd_poli_bpjs: &str, nm_poli_bpjs: &str, kd_poli_rs: &str, kd_dokter_rs: &str,
    kd_dokter_bpjs: &str, nm_dokter_bpjs: &str,
    tgl_periksa: &str, jeniskunjungan: i32, nomorreferensi: &str,
) -> Result<(), (StatusCode, Json<Value>)> {
    // Aktifkan dgn BPJS_ADD_ANTREAN=yes/true/1/on. Default OFF (perilaku lama).
    let on = std::env::var("BPJS_ADD_ANTREAN").ok()
        .map(|s| matches!(s.trim().to_ascii_lowercase().as_str(), "yes" | "true" | "1" | "on"))
        .unwrap_or(false);
    if !on { return Ok(()); }

    let cfg = crate::handlers::mobilejkn::AntreanConfig::from_env()
        .ok_or_else(|| err503("Konfigurasi Antrean BPJS (BPJS_MOBILEJKN_URL/CONS/SECRET/USER_KEY) belum diset"))?;

    let nik: String = sqlx::query_scalar("SELECT IFNULL(no_ktp,'') FROM pasien WHERE no_rkm_medis=? LIMIT 1")
        .bind(no_rkm_medis).fetch_optional(pool).await.ok().flatten().unwrap_or_default();
    let no_reg: String = sqlx::query_scalar("SELECT IFNULL(no_reg,'') FROM reg_periksa WHERE no_rawat=? LIMIT 1")
        .bind(no_rawat).fetch_optional(pool).await.ok().flatten().unwrap_or_default();
    let angka: i64 = no_reg.trim().parse().unwrap_or(0);

    let hari = hari_indo(tgl_periksa);
    let jadwal: Option<(String, String, i64)> = sqlx::query_as(
        "SELECT CAST(jam_mulai AS CHAR), CAST(jam_selesai AS CHAR), CAST(IFNULL(kuota,0) AS SIGNED) \
         FROM jadwal WHERE hari_kerja=? AND kd_poli=? AND kd_dokter=? LIMIT 1"
    ).bind(&hari).bind(kd_poli_rs).bind(kd_dokter_rs)
     .fetch_optional(pool).await.ok().flatten();
    let (jam_mulai, jam_selesai, kuota) =
        jadwal.unwrap_or_else(|| ("08:00:00".into(), "14:00:00".into(), 40));

    let jampraktek = format!("{}-{}",
        jam_mulai.get(0..5).unwrap_or("08:00"), jam_selesai.get(0..5).unwrap_or("14:00"));
    let estimasi_ms = estimasi_dilayani(tgl_periksa, &jam_mulai, angka);
    let nohp = if no_telp.trim().is_empty() { "081111111111".to_string() } else { no_telp.trim().to_string() };
    let sisa = kuota - angka;

    let body = json!({
        "kodebooking": no_rawat, "jenispasien": "JKN", "nomorkartu": no_kartu,
        "nik": nik, "nohp": nohp, "kodepoli": kd_poli_bpjs, "namapoli": nm_poli_bpjs,
        "pasienbaru": 0, "norm": no_rkm_medis, "tanggalperiksa": tgl_periksa,
        "kodedokter": kd_dokter_bpjs, "namadokter": nm_dokter_bpjs, "jampraktek": jampraktek,
        "jeniskunjungan": jeniskunjungan, "nomorreferensi": nomorreferensi,
        "nomorantrean": no_reg, "angkaantrean": angka, "estimasidilayani": estimasi_ms,
        "sisakuotajkn": sisa, "kuotajkn": kuota, "sisakuotanonjkn": sisa, "kuotanonjkn": kuota,
        "keterangan": "Peserta harap 30 menit lebih awal guna pencatatan administrasi. Estimasi pelayanan 10 menit per pasien"
    });

    let url = format!("{}/antrean/add", cfg.base_url.trim_end_matches('/'));
    let (code, message, raw) = crate::handlers::mobilejkn::post_antrean(&cfg, &url, &body).await
        .map_err(|e| err_upstream(format!("Add antrean BPJS gagal (jaringan): {}", e)))?;

    let _ = sqlx::query(
        "INSERT IGNORE INTO log_add_antrian \
         (tgl_registrasi, kd_booking, taskid, petugas, waktu, nama, no_rawat, poli, respon, kode_respon, header, complete_url_request, url) \
         VALUES (CURDATE(), ?, '', 'anjungan', ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(no_rawat).bind(estimasi_ms.to_string()).bind(nama_pasien).bind(no_rawat)
     .bind(nm_poli_bpjs).bind(&raw).bind(&code).bind("").bind(body.to_string()).bind(&url)
     .execute(pool).await;

    if code != "200" {
        return Err(err_upstream(format!("Add antrean BPJS ditolak (code {}): {}", code, message)));
    }
    Ok(())
}

/// Ambil waktu registrasi (reg_periksa) sebagai epoch MILIDETIK (WIB) — proxy
/// "saat pasien mulai" (masukkan no.kartu) untuk task 1. Fallback now kalau kosong.
async fn waktu_registrasi_ms(pool: &sqlx::MySqlPool, no_rawat: &str) -> i64 {
    use chrono::TimeZone;
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT CAST(tgl_registrasi AS CHAR), CAST(jam_reg AS CHAR) FROM reg_periksa WHERE no_rawat=? LIMIT 1")
        .bind(no_rawat).fetch_optional(pool).await.ok().flatten();
    if let Some((tgl, jam)) = row {
        let jj = jam.get(0..8).unwrap_or("00:00:00");
        let s = format!("{} {}", tgl, jj);
        let wib = chrono::FixedOffset::east_opt(7 * 3600).unwrap();
        if let Ok(ndt) = chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%d %H:%M:%S") {
            if let Some(dt) = wib.from_local_datetime(&ndt).single() {
                return dt.timestamp_millis();
            }
        }
    }
    chrono::Local::now().timestamp_millis()
}

/// Kirim task antrean (POST /antrean/updatewaktu) ke BPJS — best-effort.
/// `kodebooking`: untuk Rujukan/Kontrol = no_rawat; untuk Mobile JKN = nobooking (kode app).
/// `no_rawat`: dipakai untuk penanda idempotensi + log lokal.
/// waktu_ms: epoch MILIDETIK; kalau <= 0 pakai now. Tidak menggagalkan SEP.
async fn kirim_task_antrean(pool: &sqlx::MySqlPool, no_rawat: &str, kodebooking: &str, taskid: &str, nama: &str, poli: &str, waktu_ms: i64) {
    let on = std::env::var("BPJS_ADD_ANTREAN").ok()
        .map(|s| matches!(s.trim().to_ascii_lowercase().as_str(), "yes" | "true" | "1" | "on"))
        .unwrap_or(false);
    if !on { return; }
    let Some(cfg) = crate::handlers::mobilejkn::AntreanConfig::from_env() else { return; };

    let waktu_ms = if waktu_ms > 0 { waktu_ms } else { chrono::Local::now().timestamp_millis() };
    let body = json!({ "kodebooking": kodebooking, "taskid": taskid, "waktu": waktu_ms.to_string() });
    let url = format!("{}/antrean/updatewaktu", cfg.base_url.trim_end_matches('/'));
    let (code, _message, raw) = match crate::handlers::mobilejkn::post_antrean(&cfg, &url, &body).await {
        Ok(v) => v,
        Err(e) => { tracing::warn!("Antrean task {} no_rawat={} gagal: {}", taskid, no_rawat, e); return; }
    };
    // Penanda idempotensi (kompat mobilejkn.rs) + log viewer Khanza.
    let _ = sqlx::query("INSERT IGNORE INTO referensi_mobilejkn_bpjs_taskid (no_rawat, taskid, waktu) VALUES (?,?,?)")
        .bind(no_rawat).bind(taskid).bind(waktu_ms.to_string()).execute(pool).await;
    let _ = sqlx::query(
        "INSERT IGNORE INTO log_add_antrian \
         (tgl_registrasi, kd_booking, taskid, petugas, waktu, nama, no_rawat, poli, respon, kode_respon, header, complete_url_request, url) \
         VALUES (CURDATE(), ?, ?, 'anjungan', ?, ?, ?, ?, ?, ?, '', ?, ?)"
    ).bind(no_rawat).bind(taskid).bind(waktu_ms.to_string()).bind(nama).bind(no_rawat).bind(poli)
     .bind(&raw).bind(&code).bind(body.to_string()).bind(&url).execute(pool).await;
    tracing::info!("Antrean task {} no_rawat={} -> {}", taskid, no_rawat, code);
}

/// Guard sebelum buat SEP (port APMSEPDuaPrinter): (1) cegah SEP duplikat hari ini,
/// (2) cek kuota jadwal. Return Err (blokir + pesan) bila gagal. Dipanggil sebelum add antrean.
async fn guard_sebelum_sep(
    pool: &sqlx::MySqlPool,
    no_kartu: &str, jns_pelayanan: &str, nm_poli: &str,
    no_rawat: &str, kd_poli_rs: &str, kd_dokter_rs: &str, tgl: &str,
) -> Result<(), (StatusCode, Json<Value>)> {
    // 1. Duplikat SEP hari ini (kartu + jenis pelayanan sama). Darurat ≥3, lainnya ≥1.
    let is_darurat = nm_poli.to_lowercase().contains("darurat");
    let n_sep: i64 = sqlx::query_scalar(
        "SELECT CAST(COUNT(*) AS SIGNED) FROM bridging_sep \
         WHERE no_kartu=? AND jnspelayanan=? AND tglsep=?"
    ).bind(no_kartu).bind(jns_pelayanan).bind(tgl).fetch_one(pool).await.unwrap_or(0);
    let limit = if is_darurat { 3 } else { 1 };
    if n_sep >= limit {
        return Err(err400(&format!(
            "Sudah ada {} SEP hari ini untuk kartu & jenis pelayanan yang sama. Tidak bisa buat SEP lagi — silakan ke loket bila perlu.",
            n_sep)));
    }

    // 2 & 3. Kuota + window dari jadwal
    let no_reg: String = sqlx::query_scalar("SELECT IFNULL(no_reg,'') FROM reg_periksa WHERE no_rawat=? LIMIT 1")
        .bind(no_rawat).fetch_optional(pool).await.ok().flatten().unwrap_or_default();
    let angka: i64 = no_reg.trim().parse().unwrap_or(0);
    let hari = hari_indo(tgl);
    let jadwal: Option<(String, i64)> = sqlx::query_as(
        "SELECT CAST(jam_mulai AS CHAR), CAST(IFNULL(kuota,0) AS SIGNED) \
         FROM jadwal WHERE hari_kerja=? AND kd_poli=? AND kd_dokter=? LIMIT 1"
    ).bind(&hari).bind(kd_poli_rs).bind(kd_dokter_rs).fetch_optional(pool).await.ok().flatten();
    if let Some((_jam_mulai, kuota)) = jadwal {
        // 2. Kuota penuh (guard window 1 jam sebelum praktek DIHAPUS atas permintaan)
        if kuota > 0 && angka > kuota {
            return Err(err400(&format!("Kuota dokter sudah penuh ({}/{}). Silakan pilih jadwal lain.", angka, kuota)));
        }
    }
    Ok(())
}

pub async fn create_sep_kontrol(
    State(state): State<AppState>,
    Json(b): Json<CreateSepKontrolBody>,
) -> Result<Json<CreateSepResp>, (StatusCode, Json<Value>)> {
    use crate::handlers::bridging_bpjs::{BpjsClient, BpjsConfig};

    // 1. kode_ppk RS (asal kontrol = RS sendiri, jadi pakai PPK pelayanan)
    let (kd_ppk_pelayanan, nm_ppk_pelayanan): (String, String) = sqlx::query_as(
        "SELECT kode_ppk, nama_instansi FROM setting LIMIT 1"
    ).fetch_one(&state.pool).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("baca setting: {}", e)}))))?;

    // 2. BPJS client
    let cfg = BpjsConfig::from_env()
        .ok_or_else(|| err503("Konfigurasi BPJS belum diset"))?;
    let client = BpjsClient::new(cfg);

    let tgl_sep = chrono::Local::now().format("%Y-%m-%d").to_string();
    let kls_rawat   = b.hak_kelas.as_deref().filter(|s| !s.is_empty()).unwrap_or("3");
    let tujuan_kunj = b.tujuan_kunjungan.as_deref().unwrap_or("2");  // Konsul Dokter
    // tujuanKunj=2 (Konsul Dokter) MEWAJIBKAN assesmentPel=5 (Tujuan Kontrol);
    // tanpa ini BPJS menolak "tujuanKunj tidak sesuai". Samakan dgn APMSEPDuaPrinter
    // (nilai 5 terbukti pd seluruh SEP konsul di produksi).
    let assesment_pel = if tujuan_kunj == "2" { "5" } else { "" };
    // Default catatan SEP: "Anjungan Mandiri" — penanda asal SEP (audit trail)
    let catatan     = b.catatan.clone().filter(|s| !s.trim().is_empty())
                        .unwrap_or_else(|| "Anjungan Mandiri".to_string());
    let no_telp     = b.no_telp.clone().unwrap_or_default();

    // Guard: cegah SEP duplikat + cek kuota + window sebelum add antrean/SEP.
    guard_sebelum_sep(&state.pool, &b.no_kartu, "2", &b.nm_poli_bpjs,
        &b.no_rawat, &b.kd_poli_rs, &b.kd_dokter_rs, &tgl_sep).await?;

    // 2b. ADD ANTREAN BPJS dulu (sebelum SEP). Kontrol → jeniskunjungan=3, referensi=no_surat.
    let nm_dokter_bpjs: String = sqlx::query_scalar(
        "SELECT IFNULL(nm_dokter_bpjs,'') FROM maping_dokter_dpjpvclaim WHERE kd_dokter_bpjs=? LIMIT 1")
        .bind(&b.kd_dokter_bpjs).fetch_optional(&state.pool).await.ok().flatten().unwrap_or_default();
    add_antrean_bpjs(
        &state.pool, &b.no_rawat, &b.no_kartu, &b.no_rkm_medis, &b.nama_pasien, &no_telp,
        &b.kd_poli_bpjs, &b.nm_poli_bpjs, &b.kd_poli_rs, &b.kd_dokter_rs,
        &b.kd_dokter_bpjs, &nm_dokter_bpjs, &tgl_sep, 3, &b.no_surat,
    ).await?;
    // Task 1/2/3 dikirim sekaligus setelah SEP terbit — lihat blok di bawah.

    // 3. Build payload SEP Kontrol
    // Beda dengan SEP Rujukan Baru:
    //   asalRujukan = "2"  (Faskes 2 RS, surat kontrol)
    //   tglRujukan  = tgl_surat
    //   noRujukan   = no_surat
    //   ppkRujukan  = kd_ppk_pelayanan (RS sendiri)
    //   skdp.noSurat = no_surat
    //   skdp.kodeDPJP = kd_dokter_bpjs
    //   tujuanKunj  = "2" Konsul (default) atau "1" Prosedur Lanjutan
    let payload = json!({
        "request": {
            "t_sep": {
                "noKartu":      b.no_kartu,
                "tglSep":       tgl_sep,
                "ppkPelayanan": kd_ppk_pelayanan,
                "jnsPelayanan": "2",
                "klsRawat": {
                    "klsRawatHak":      kls_rawat,
                    "klsRawatNaik":     "",
                    "pembiayaan":       "",
                    "penanggungJawab":  "",
                },
                "noMR": b.no_rkm_medis,
                "rujukan": {
                    "asalRujukan": "2",
                    "tglRujukan":  b.tgl_surat,
                    "noRujukan":   b.no_surat,
                    "ppkRujukan":  kd_ppk_pelayanan,
                },
                "catatan":  catatan,
                "diagAwal": b.diag_kode,
                "poli": {
                    "tujuan":    b.kd_poli_bpjs,
                    "eksekutif": "0",
                },
                "cob":     { "cob": "0" },
                "katarak": { "katarak": "0" },
                "jaminan": {
                    "lakaLantas": "0",
                    "penjamin": {
                        "tglKejadian": "",
                        "keterangan":  "",
                        "suplesi": {
                            "suplesi":     "0",
                            "noSepSuplesi": "",
                            "lokasiLaka": {
                                "kdPropinsi":  "",
                                "kdKabupaten": "",
                                "kdKecamatan": "",
                            }
                        }
                    }
                },
                "tujuanKunj":    tujuan_kunj,
                "flagProcedure": "",
                "kdPenunjang":   "",
                "assesmentPel":  assesment_pel,
                "skdp": {
                    "noSurat":  b.no_surat,
                    "kodeDPJP": b.kd_dokter_bpjs,
                },
                "dpjpLayan":     b.kd_dokter_bpjs,
                "noTelp":        no_telp,
                "user":          b.no_kartu,
            }
        }
    });

    // 4. POST ke BPJS
    let resp = client.post("SEP/2.0/insert", payload).await
        .map_err(|e| err_upstream(e))?;
    let no_sep = resp.pointer("/sep/noSep")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| err_upstream(format!("response BPJS tidak ada noSep: {}", resp)))?;

    // 5. INSERT bridging_sep (52 kolom, sama dengan rujukan baru tapi
    //    asal_rujukan='2. Faskes 2(RS)' + noskdp/kddpjp terisi)
    let user_kode = "anjungan".to_string();  // kiosk publik: tanpa login petugas
    let jk_pasien = b.jk.clone().unwrap_or_default();
    let peserta_str = b.peserta.clone().unwrap_or_default();
    let tgl_lahir = b.tgl_lahir.clone().unwrap_or_else(|| "0000-00-00".to_string());

    sqlx::query(
        "INSERT INTO bridging_sep
         (no_sep, no_rawat, tglsep, tglrujukan, no_rujukan,
          kdppkrujukan, nmppkrujukan, kdppkpelayanan, nmppkpelayanan,
          jnspelayanan, catatan, diagawal, nmdiagnosaawal,
          kdpolitujuan, nmpolitujuan, klsrawat, klsnaik, pembiayaan, pjnaikkelas,
          lakalantas, user, nomr, nama_pasien, tanggal_lahir, peserta, jkel, no_kartu,
          tglpulang, asal_rujukan, eksekutif, cob, notelep, katarak, tglkkl,
          keterangankkl, suplesi, no_sep_suplesi, kdprop, nmprop, kdkab, nmkab,
          kdkec, nmkec, noskdp, kddpjp, nmdpdjp, tujuankunjungan, flagprosedur,
          penunjang, assesmenpel, kddpjplayan, nmdpjplayan)
         VALUES
         (?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          '2', ?, ?, ?,
          ?, ?, ?, '', '', '',
          '0', ?, ?, ?, ?, ?, ?, ?,
          '0000-00-00 00:00:00', '2. Faskes 2(RS)', '0. Tidak', '0. Tidak', ?, '0. Tidak', '0000-00-00',
          '', '0. Tidak', '', '', '', '', '',
          '', '', ?, ?, ?,
          ?, '', '', '', ?, ?)"
    )
    .bind(&no_sep).bind(&b.no_rawat).bind(&tgl_sep).bind(&b.tgl_surat).bind(&b.no_surat)
    .bind(&kd_ppk_pelayanan).bind(&nm_ppk_pelayanan).bind(&kd_ppk_pelayanan).bind(&nm_ppk_pelayanan)
    .bind(&catatan).bind(&b.diag_kode).bind(&b.diag_nama)
    .bind(&b.kd_poli_bpjs).bind(&b.nm_poli_bpjs).bind(kls_rawat)
    .bind(&user_kode).bind(&b.no_rkm_medis).bind(&b.nama_pasien)
    .bind(&tgl_lahir).bind(&peserta_str).bind(&jk_pasien).bind(&b.no_kartu)
    .bind(&no_telp)
    .bind(&b.no_surat).bind(&b.kd_dokter_bpjs).bind("")
    .bind(tujuan_kunj)
    .bind(&b.kd_dokter_bpjs).bind("")
    .execute(&state.pool).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": format!("INSERT bridging_sep gagal: {}", e), "no_sep_dibuat": no_sep}))))?;

    // Audit trail SQL (trackersql, meniru Khanza) — bridging_sep diringkas ke kolom kunci
    crate::audit::log_sql(&state.pool, &user_kode, &format!(
        "INSERT INTO bridging_sep (no_sep, no_rawat, nomr, no_kartu, tglsep, diagawal, kdpolitujuan, noskdp, kddpjplayan) \
         VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}) -- +43 kolom lain (asal_rujukan='2. Faskes 2(RS)')",
        crate::audit::q(&no_sep), crate::audit::q(&b.no_rawat), crate::audit::q(&b.no_rkm_medis), crate::audit::q(&b.no_kartu),
        crate::audit::q(&tgl_sep), crate::audit::q(&b.diag_kode), crate::audit::q(&b.kd_poli_bpjs),
        crate::audit::q(&b.no_surat), crate::audit::q(&b.kd_dokter_bpjs),
    )).await;

    // ── Post-SEP Kontrol steps ────────────────────────────────────────────
    // Untuk Kontrol Ulang: no_balasan = "-" (kontrol RS sendiri bukan
    // rujukan masuk dari Faskes 1) sesuai pattern Java baris kedua menyimpan
    // rujuk_masuk di BridgingSEP.
    let _ = sqlx::query(
        "INSERT INTO rujuk_masuk
         (no_rawat, perujuk, alamat, no_rujuk, jm_perujuk, dokter_perujuk,
          kd_penyakit, kategori_rujuk, keterangan, no_balasan)
         VALUES (?,?,?,?,?,?,?,?,?,?)"
    )
    .bind(&b.no_rawat)
    .bind(&nm_ppk_pelayanan)        // perujuk = RS sendiri (PPK pelayanan)
    .bind("-")
    .bind(&b.no_surat)               // pakai no_surat kontrol sebagai no_rujuk
    .bind(0.0f64)
    .bind(&nm_ppk_pelayanan)
    .bind(&b.diag_kode)
    .bind("-")
    .bind("-")
    .bind("-")                       // no_balasan "-" untuk Kontrol (bukan rujukan masuk)
    .execute(&state.pool).await
    .map_err(|e| tracing::warn!("INSERT rujuk_masuk (kontrol) gagal (non-fatal): {}", e));

    crate::audit::log_sql(&state.pool, &user_kode, &format!(
        "INSERT INTO rujuk_masuk (no_rawat, perujuk, alamat, no_rujuk, jm_perujuk, dokter_perujuk, kd_penyakit, kategori_rujuk, keterangan, no_balasan) \
         VALUES ({}, {}, '-', {}, 0, {}, {}, '-', '-', '-')",
        crate::audit::q(&b.no_rawat), crate::audit::q(&nm_ppk_pelayanan), crate::audit::q(&b.no_surat),
        crate::audit::q(&nm_ppk_pelayanan), crate::audit::q(&b.diag_kode),
    )).await;

    // UPDATE pasien.no_tlp + umur — sama dengan Rujukan Baru
    let _ = sqlx::query(
        "UPDATE pasien SET
           no_tlp = ?,
           umur = CONCAT(
             CONCAT(CONCAT(TIMESTAMPDIFF(YEAR, tgl_lahir, CURDATE()), ' Th '),
                    CONCAT(TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) - ((TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) div 12) * 12), ' Bl ')),
             CONCAT(TIMESTAMPDIFF(DAY,
               DATE_ADD(
                 DATE_ADD(tgl_lahir, INTERVAL TIMESTAMPDIFF(YEAR, tgl_lahir, CURDATE()) YEAR),
                 INTERVAL TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) - ((TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) div 12) * 12) MONTH),
               CURDATE()
             ), ' Hr')
           )
         WHERE no_rkm_medis = ?"
    )
    .bind(&no_telp).bind(&b.no_rkm_medis)
    .execute(&state.pool).await
    .map_err(|e| tracing::warn!("UPDATE pasien no_tlp/umur (kontrol) gagal (non-fatal): {}", e));

    crate::audit::log_sql(&state.pool, &user_kode, &format!(
        "UPDATE pasien SET no_tlp={}, umur=<hitung Th/Bl/Hr dari tgl_lahir> WHERE no_rkm_medis={}",
        crate::audit::q(&no_telp), crate::audit::q(&b.no_rkm_medis),
    )).await;

    let _ = crate::handlers::anjungan_admin::log_activity(
        &state.pool, "bpjs-kontrol", "sep",
        crate::handlers::anjungan_admin::LogActivityFields {
            no_kartu:     Some(b.no_kartu.clone()),
            no_rkm_medis: Some(b.no_rkm_medis.clone()),
            no_rawat:     Some(b.no_rawat.clone()),
            no_sep:       Some(no_sep.clone()),
            sukses:       Some(true),
            ..Default::default()
        }
    ).await;

    // Task 1 = pasien memasukkan nomor kartu, task 2 = lembar SEP terbuka,
    // task 3 = SEP selesai dibuat. Stempel 1 & 2 direkam anjungan karena pada
    // momen itu kodebooking belum ada — BPJS menolak updatewaktu tanpa itu.
    // Semantik sama dengan DlgRegistrasiSEPPertama di APMSEPDuaPrinter.
    let t1 = match b.waktu_task1 {
        Some(v) if v > 0 => v,
        _ => waktu_registrasi_ms(&state.pool, &b.no_rawat).await,
    };
    let sekarang = chrono::Local::now().timestamp_millis();
    let mut t2 = b.waktu_task2.filter(|v| *v > 0).unwrap_or(sekarang);
    if t1 > 0 && t2 <= t1 { t2 = t1 + 1000; }          // BPJS menolak waktu tak menaik
    let t3 = if sekarang <= t2 { t2 + 1000 } else { sekarang };

    kirim_task_antrean(&state.pool, &b.no_rawat, &b.no_rawat, "1", &b.nama_pasien, &b.nm_poli_bpjs, t1).await;
    kirim_task_antrean(&state.pool, &b.no_rawat, &b.no_rawat, "2", &b.nama_pasien, &b.nm_poli_bpjs, t2).await;
    kirim_task_antrean(&state.pool, &b.no_rawat, &b.no_rawat, "3", &b.nama_pasien, &b.nm_poli_bpjs, t3).await;

    Ok(Json(CreateSepResp {
        no_sep, no_rawat: b.no_rawat,
        no_rujukan: b.no_surat, tgl_sep,
        meta_message: "SEP Kontrol berhasil dibuat".into(),
    }))
}

// ── 8. MOBILE JKN — Cek booking + check-in ──────────────────────────────────
// Port dari Java DlgCekinMobileJKN — pasien yang sudah booking via aplikasi
// Mobile JKN di HP, datang ke RS, check-in di kiosk.
// Schema referensi_mobilejkn_bpjs (2,903 rows existing di RSCB).
#[derive(Deserialize)]
pub struct CekMobileJknQuery {
    pub no_kartu:     Option<String>,
    pub no_rkm_medis: Option<String>,
    pub nik:          Option<String>,
}

pub async fn cek_booking_mobilejkn(
    State(state): State<AppState>,
    Query(q): Query<CekMobileJknQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let no_kartu = q.no_kartu.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let no_rkm   = q.no_rkm_medis.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let nik      = q.nik.as_deref().map(str::trim).filter(|s| !s.is_empty());

    if no_kartu.is_none() && no_rkm.is_none() && nik.is_none() {
        return Err(err400("Salah satu wajib: no_kartu / no_rkm_medis / nik"));
    }

    // Resolve filter SQL
    let (sql_filter, bind_val): (&str, String) = if let Some(nk) = no_kartu {
        ("mj.nomorkartu = ?", nk.to_string())
    } else if let Some(rm) = no_rkm {
        ("mj.norm = ?", rm.to_string())
    } else {
        // nik → resolve dulu ke no_rkm
        let nik = nik.unwrap();
        let resolved: Option<String> = sqlx::query_scalar(
            "SELECT no_rkm_medis FROM pasien WHERE no_ktp=? LIMIT 1"
        ).bind(nik).fetch_optional(&state.pool).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
        let Some(rm) = resolved else {
            return Err((StatusCode::NOT_FOUND, Json(json!({
                "error": "NIK tidak terdaftar di sistem pasien"
            }))));
        };
        ("mj.norm = ?", rm)
    };

    // Cari booking aktif hari ini
    #[derive(sqlx::FromRow)]
    struct BookingRow {
        nobooking:        String,
        no_rawat:         Option<String>,
        nomorkartu:       String,
        nik:              Option<String>,
        nohp:             Option<String>,
        kodepoli:         String,
        norm:             String,
        tanggalperiksa:   Option<String>,
        kodedokter:       String,
        jampraktek:       Option<String>,
        jeniskunjungan:   String,
        nomorreferensi:   Option<String>,
        nomorantrean:     Option<String>,
        angkaantrean:     Option<String>,
        estimasidilayani: Option<String>,
        status:           String,
    }

    let sql = format!(
        "SELECT mj.nobooking, mj.no_rawat, mj.nomorkartu, mj.nik, mj.nohp,
                mj.kodepoli, mj.norm,
                DATE_FORMAT(mj.tanggalperiksa,'%Y-%m-%d') AS tanggalperiksa,
                mj.kodedokter, mj.jampraktek, mj.jeniskunjungan,
                mj.nomorreferensi, mj.nomorantrean, mj.angkaantrean,
                mj.estimasidilayani, mj.status
         FROM referensi_mobilejkn_bpjs mj
         WHERE {} AND mj.tanggalperiksa=CURDATE()
           AND mj.status IN ('Belum','Checkin')
         ORDER BY mj.jampraktek ASC
         LIMIT 1",
        sql_filter,
    );

    let booking: Option<BookingRow> = sqlx::query_as(&sql)
        .bind(&bind_val)
        .fetch_optional(&state.pool).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let Some(bk) = booking else {
        return Err((StatusCode::NOT_FOUND, Json(json!({
            "error": "Tidak ada booking Mobile JKN aktif hari ini untuk pasien tersebut. \
                      Pastikan: (1) booking sudah dibuat via aplikasi Mobile JKN HP, \
                      (2) tanggal periksa = hari ini, (3) belum di-batalkan."
        }))));
    };

    // Resolve mapping ke Khanza local
    let poli_rs: Option<(String, String)> = sqlx::query_as(
        "SELECT m.kd_poli_rs, p.nm_poli
         FROM maping_poli_bpjs m
         LEFT JOIN poliklinik p ON p.kd_poli=m.kd_poli_rs
         WHERE m.kd_poli_bpjs=? LIMIT 1"
    ).bind(&bk.kodepoli)
    .fetch_optional(&state.pool).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let dokter_rs: Option<(String, String)> = sqlx::query_as(
        "SELECT m.kd_dokter, d.nm_dokter
         FROM maping_dokter_dpjpvclaim m
         LEFT JOIN dokter d ON d.kd_dokter=m.kd_dokter
         WHERE m.kd_dokter_bpjs=? LIMIT 1"
    ).bind(&bk.kodedokter)
    .fetch_optional(&state.pool).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    // Cari nama pasien dari pasien table (booking tidak simpan nama)
    let nama_pasien: Option<String> = sqlx::query_scalar(
        "SELECT nm_pasien FROM pasien WHERE no_rkm_medis=? LIMIT 1"
    ).bind(&bk.norm).fetch_optional(&state.pool).await.unwrap_or(None);

    // Cek apakah pasien sudah daftar reg_periksa hari ini
    let sudah_daftar: i64 = sqlx::query_scalar(
        "SELECT CAST(COUNT(*) AS SIGNED) FROM reg_periksa
         WHERE no_rkm_medis=? AND tgl_registrasi=CURDATE()"
    ).bind(&bk.norm).fetch_one(&state.pool).await.unwrap_or(0);

    Ok(Json(json!({
        "ok": true,
        "booking": {
            "nobooking":        bk.nobooking,
            "no_rawat":         bk.no_rawat,
            "nomorkartu":       bk.nomorkartu,
            "nik":              bk.nik,
            "nohp":             bk.nohp,
            "kodepoli":         bk.kodepoli,
            "norm":             bk.norm,
            "nama_pasien":      nama_pasien,
            "tanggalperiksa":   bk.tanggalperiksa,
            "kodedokter":       bk.kodedokter,
            "jampraktek":       bk.jampraktek,
            "jeniskunjungan":   bk.jeniskunjungan,
            "nomorreferensi":   bk.nomorreferensi,
            "nomorantrean":     bk.nomorantrean,
            "angkaantrean":     bk.angkaantrean,
            "estimasidilayani": bk.estimasidilayani,
            "status":           bk.status,
        },
        "mapping": {
            "kd_poli_rs":   poli_rs.as_ref().map(|x| x.0.clone()),
            "nm_poli_rs":   poli_rs.as_ref().map(|x| x.1.clone()),
            "kd_dokter_rs": dokter_rs.as_ref().map(|x| x.0.clone()),
            "nm_dokter_rs": dokter_rs.as_ref().map(|x| x.1.clone()),
        },
        "sudah_daftar_hari_ini": sudah_daftar > 0,
    })))
}

// POST checkin: UPDATE status + Auto SEP dispatch by jeniskunjungan
//   "1 (Rujukan FKTP)"     → fetch rujukan BPJS API → create SEP rujukan baru
//   "2 (Rujukan Internal)" → fallback kontrol (no_rujuk = nomorreferensi pakai logic kontrol)
//   "3 (Kontrol)"          → lookup surat kontrol Khanza → create SEP kontrol
//   "4 (Rujukan Antar RS)" → fetch rujukan BPJS API → create SEP rujukan baru
#[derive(Deserialize)]
pub struct CheckinMobileJknBody {
    /// Epoch ms saat lembar SEP terbuka di anjungan (task 2).
    /// Task 1 pasien Mobile JKN memakai jam check-in (kolom validasi).
    #[serde(default)]
    pub waktu_task2:    Option<i64>,
    pub nobooking:      String,
    pub norm:           String,
    pub nomorkartu:     String,
    pub kd_poli_rs:     String,
    pub kd_dokter_rs:   String,
    pub kode_poli_bpjs: String,
    pub kode_dokter_bpjs: String,
    pub jeniskunjungan: String,            // "1" / "2" / "3" / "4" + label
    pub nomorreferensi: Option<String>,    // no rujukan FKTP atau no surat kontrol
    pub catatan:        Option<String>,
    #[serde(default)]
    pub tujuan_kunjungan: Option<String>,  // "1" Prosedur / "2" Konsul (kontrol) — dari form
    /// Default true — backend otomatis register reg_periksa + create SEP setelah check-in.
    /// Set false untuk MVP compat (check-in only).
    #[serde(default = "default_true")]
    pub auto_sep:       bool,
}
fn default_true() -> bool { true }

#[derive(Deserialize)]
pub struct PrepareSepBody {
    pub nobooking:      String,
    pub nomorkartu:     String,
    pub norm:           String,
    pub kd_poli_rs:     String,
    pub jeniskunjungan: String,            // "1".."4" (+label)
    pub nomorreferensi: Option<String>,
}

/// Tandai booking Checkin + siapkan data FORM SEP (peserta, diagnosa dari rujukan/surat
/// kontrol, daftar dokter untuk poli). TIDAK membuat reg_periksa/SEP. Frontend tampilkan
/// form; saat tombol "Buat SEP" -> POST /mobile-jkn/checkin (auto_sep=true) untuk buat SEP.
pub async fn prepare_sep_mobilejkn(
    State(state): State<AppState>,
    Json(b): Json<PrepareSepBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    use crate::handlers::bridging_bpjs::{BpjsClient, BpjsConfig};

    // 1. Tandai Checkin (belum buat reg_periksa/SEP)
    let _ = sqlx::query(
        "UPDATE referensi_mobilejkn_bpjs SET status='Checkin', validasi=NOW() \
         WHERE nobooking=? AND tanggalperiksa=CURDATE() AND status IN ('Belum','Checkin')"
    ).bind(&b.nobooking).execute(&state.pool).await;

    let cfg = BpjsConfig::from_env().ok_or_else(|| err503("Konfigurasi BPJS belum diset"))?;
    let client = BpjsClient::new(cfg);
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // 2. Peserta (hakKelas, tgl lahir, jk, no telp)
    let peserta_resp = client.get(&format!("Peserta/nokartu/{}/tglSEP/{}", b.nomorkartu, today))
        .await.map_err(err_upstream)?;
    let p = peserta_resp.pointer("/peserta").unwrap_or(&peserta_resp);
    let nama = p.pointer("/nama").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let tgl_lahir = p.pointer("/tglLahir").and_then(|v| v.as_str()).unwrap_or("0000-00-00").to_string();
    let jk = p.pointer("/sex").and_then(|v| v.as_str()).unwrap_or("L").to_string();
    let no_telp = p.pointer("/mr/noTelepon").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let hak_kelas = p.pointer("/hakKelas/kode").and_then(|v| v.as_str()).unwrap_or("3").to_string();
    let peserta_ket = p.pointer("/jenisPeserta/keterangan").and_then(|v| v.as_str()).unwrap_or("").to_string();

    // 3. Diagnosa + poli (+ dokter default) sesuai jenis
    let jenis_code = b.jeniskunjungan.chars().next().unwrap_or('?');
    let refno = b.nomorreferensi.clone().unwrap_or_default();
    let (diag_kode, diag_nama, kd_poli_bpjs, nm_poli_bpjs, kd_dpjp_def, nm_dpjp_def) =
    if jenis_code == '3' {
        let sk: Option<(String, String, String, String, String)> = sqlx::query_as(
            "SELECT no_sep, kd_dokter_bpjs, IFNULL(nm_dokter_bpjs,''), kd_poli_bpjs, IFNULL(nm_poli_bpjs,'') \
             FROM bridging_surat_kontrol_bpjs WHERE no_surat=? LIMIT 1"
        ).bind(&refno).fetch_optional(&state.pool).await.ok().flatten();
        if let Some((no_sep_asal, kdd, nmd, kdp, nmp)) = sk {
            let dx: Option<(String, String)> = sqlx::query_as(
                "SELECT diagawal, nmdiagnosaawal FROM bridging_sep WHERE no_sep=? LIMIT 1"
            ).bind(&no_sep_asal).fetch_optional(&state.pool).await.ok().flatten();
            let (dk, dn) = dx.unwrap_or_else(|| (String::new(), String::new()));
            (dk, dn, kdp, nmp, kdd, nmd)
        } else {
            (String::new(), String::new(), String::new(), String::new(), String::new(), String::new())
        }
    } else {
        match client.get(&format!("Rujukan/{}", refno)).await {
            Ok(resp) => {
                let ruj = resp.pointer("/rujukan").cloned().unwrap_or(resp);
                let dk = ruj.pointer("/diagnosa/kode").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let dn = ruj.pointer("/diagnosa/nama").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let kp = ruj.pointer("/poliRujukan/kode").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let np = ruj.pointer("/poliRujukan/nama").and_then(|v| v.as_str()).unwrap_or("").to_string();
                (dk, dn, kp, np, String::new(), String::new())
            }
            Err(_) => (String::new(), String::new(), String::new(), String::new(), String::new(), String::new()),
        }
    };

    // 4. Daftar dokter poli RS hari ini (dropdown editable)
    let hari = hari_indo(&today);
    let dokter: Vec<(String, String, Option<String>, Option<String>, i64, i64, Option<String>)> = sqlx::query_as(
        "SELECT d.kd_dokter, d.nm_dokter, TIME_FORMAT(j.jam_mulai,'%H:%i'), TIME_FORMAT(j.jam_selesai,'%H:%i'), \
                CAST(IFNULL(j.kuota,0) AS SIGNED), \
                CAST((SELECT COUNT(*) FROM reg_periksa r WHERE r.tgl_registrasi=CURDATE() AND r.kd_poli=? AND r.kd_dokter=d.kd_dokter) AS SIGNED), \
                (SELECT m.kd_dokter_bpjs FROM maping_dokter_dpjpvclaim m WHERE m.kd_dokter=d.kd_dokter LIMIT 1) \
         FROM jadwal j JOIN dokter d ON d.kd_dokter=j.kd_dokter \
         WHERE j.kd_poli=? AND j.hari_kerja=? AND d.status='1' ORDER BY d.nm_dokter"
    ).bind(&b.kd_poli_rs).bind(&b.kd_poli_rs).bind(&hari).fetch_all(&state.pool).await.unwrap_or_default();
    let daftar: Vec<Value> = dokter.iter().map(|(kd, nm, jm, js, ku, te, kb)| json!({
        "kd_dokter": kd, "nm_dokter": nm, "jam_mulai": jm, "jam_selesai": js,
        "kuota": ku, "terisi": te, "kd_dokter_bpjs": kb,
    })).collect();

    Ok(Json(json!({
        "ok": true, "nobooking": b.nobooking,
        "nama": nama, "tgl_lahir": tgl_lahir, "jk": jk, "no_telp": no_telp,
        "hak_kelas": hak_kelas, "peserta": peserta_ket,
        "diag_kode": diag_kode, "diag_nama": diag_nama,
        "kd_poli_bpjs": kd_poli_bpjs, "nm_poli_bpjs": nm_poli_bpjs, "kd_poli_rs": b.kd_poli_rs,
        "kd_dokter_bpjs_default": kd_dpjp_def, "nm_dokter_bpjs_default": nm_dpjp_def,
        "daftar_dokter": daftar,
        "jeniskunjungan": b.jeniskunjungan, "nomorreferensi": refno,
    })))
}

pub async fn checkin_mobilejkn(
    State(state): State<AppState>,
    Json(b): Json<CheckinMobileJknBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // ── 1. UPDATE status booking → 'Checkin'
    let res = sqlx::query(
        "UPDATE referensi_mobilejkn_bpjs SET status='Checkin', validasi=NOW()
         WHERE nobooking=? AND tanggalperiksa=CURDATE() AND status IN ('Belum','Checkin')"
    ).bind(&b.nobooking).execute(&state.pool).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({
            "error": "Booking tidak ditemukan atau sudah selesai / batal"
        }))));
    }

    // Audit trail SQL (trackersql, meniru Khanza) — kiosk publik: kode "anjungan"
    crate::audit::log_sql(&state.pool, "anjungan", &format!(
        "UPDATE referensi_mobilejkn_bpjs SET status='Checkin', validasi=NOW() \
         WHERE nobooking={} AND tanggalperiksa=CURDATE() AND status IN ('Belum','Checkin')",
        crate::audit::q(&b.nobooking),
    )).await;

    // Mode compat — check-in only (no auto SEP)
    if !b.auto_sep {
        return Ok(Json(json!({
            "ok": true,
            "auto_sep": false,
            "message": "Check-in saja. Lanjutkan ke loket untuk reg_periksa + SEP.",
            "nobooking": b.nobooking,
        })));
    }

    // ── 2. AUTO SEP DISPATCH ───────────────────────────────────────────
    let user_kode = "anjungan".to_string();  // kiosk publik: tanpa login petugas
    let jenis = &b.jeniskunjungan;

    // Cek pasien belum daftar hari ini (sudah dicek di GET cek-booking, tapi cek lagi
    // untuk safety karena ada race condition)
    let sudah_daftar: i64 = sqlx::query_scalar(
        "SELECT CAST(COUNT(*) AS SIGNED) FROM reg_periksa
         WHERE no_rkm_medis=? AND tgl_registrasi=CURDATE()"
    ).bind(&b.norm).fetch_one(&state.pool).await.unwrap_or(0);
    if sudah_daftar > 0 {
        return Ok(Json(json!({
            "ok": true,
            "auto_sep": false,
            "message": "Pasien sudah daftar hari ini — check-in OK tapi reg_periksa tidak dibuat ulang.",
            "nobooking": b.nobooking,
        })));
    }

    // ── 2a. Fetch peserta BPJS (untuk hakKelas, no_telp, jk, dst)
    let cfg = match BpjsConfig::from_env() {
        Some(c) => c, None => return Err(err503("Konfigurasi BPJS belum diset")),
    };
    let client = crate::handlers::bridging_bpjs::BpjsClient::new(cfg.clone());
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let peserta_resp = client
        .get(&format!("Peserta/nokartu/{}/tglSEP/{}", b.nomorkartu, today))
        .await.map_err(err_upstream)?;
    let p = peserta_resp.pointer("/peserta").unwrap_or(&peserta_resp);

    let nama_pasien = p.pointer("/nama").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let tgl_lahir   = p.pointer("/tglLahir").and_then(|v| v.as_str())
        .map(|s| s.to_string()).unwrap_or_else(|| "0000-00-00".to_string());
    let jk          = p.pointer("/sex").and_then(|v| v.as_str()).unwrap_or("L").to_string();
    let no_telp     = p.pointer("/mr/noTelepon").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let hak_kelas   = p.pointer("/hakKelas/kode").and_then(|v| v.as_str()).unwrap_or("3").to_string();
    let peserta_str = p.pointer("/jenisPeserta/keterangan").and_then(|v| v.as_str()).unwrap_or("").to_string();

    // ── 2b. INSERT reg_periksa (sama pattern dengan walk-in tapi kd_pj BPJS)
    let (no_rawat, no_reg) = match register_pasien_bpjs(
        &state.pool, &b.norm, &b.kd_poli_rs, &b.kd_dokter_rs, &no_telp
    ).await {
        Ok(t) => t,
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Insert reg_periksa: {}", e)})))),
    };

    let nm_poli: String = sqlx::query_scalar("SELECT nm_poli FROM poliklinik WHERE kd_poli=?")
        .bind(&b.kd_poli_rs).fetch_optional(&state.pool).await.unwrap_or(None).unwrap_or_default();
    let nm_dokter: String = sqlx::query_scalar("SELECT nm_dokter FROM dokter WHERE kd_dokter=?")
        .bind(&b.kd_dokter_rs).fetch_optional(&state.pool).await.unwrap_or(None).unwrap_or_default();

    // ── 2c. Dispatch by jenis_kunjungan
    let jenis_code = jenis.chars().next().unwrap_or('?');
    let (no_sep_opt, sep_error_opt, sep_meta_msg): (Option<String>, Option<String>, String) =
    match jenis_code {
        '3' => {
            // KONTROL — lookup surat kontrol di Khanza
            if let Some(no_surat) = b.nomorreferensi.as_deref().filter(|s| !s.is_empty()) {
                match auto_sep_kontrol(&state, &client, &user_kode,
                    no_surat, &b.norm, &b.nomorkartu, &nama_pasien, &tgl_lahir, &jk, &no_telp,
                    &peserta_str, &hak_kelas, &no_rawat, &b.kd_poli_rs, &b.kode_poli_bpjs,
                    &b.kode_dokter_bpjs, b.catatan.as_deref(), b.tujuan_kunjungan.as_deref()).await
                {
                    Ok(no_sep) => (Some(no_sep), None,
                        format!("SEP Kontrol Mobile JKN berhasil dibuat (jenis {})", jenis)),
                    Err(e) => (None, Some(e),
                        "Reg_periksa berhasil, SEP Kontrol gagal — lanjut loket".into()),
                }
            } else {
                (None, Some("nomorreferensi (no surat kontrol) kosong di booking".into()),
                 "Reg_periksa OK, SEP gagal — booking tidak ada nomorreferensi".into())
            }
        }
        '1' | '4' => {
            // RUJUKAN FKTP atau ANTAR RS — fetch rujukan dari BPJS API
            if let Some(no_rujukan) = b.nomorreferensi.as_deref().filter(|s| !s.is_empty()) {
                match auto_sep_rujukan(&state, &client, &user_kode,
                    no_rujukan, &b.norm, &b.nomorkartu, &nama_pasien, &tgl_lahir, &jk, &no_telp,
                    &peserta_str, &hak_kelas, &no_rawat, &b.kd_poli_rs, &b.kode_poli_bpjs,
                    &b.kode_dokter_bpjs, b.catatan.as_deref()).await
                {
                    Ok(no_sep) => (Some(no_sep), None,
                        format!("SEP Rujukan Mobile JKN berhasil dibuat (jenis {})", jenis)),
                    Err(e) => (None, Some(e),
                        "Reg_periksa berhasil, SEP Rujukan gagal — lanjut loket".into()),
                }
            } else {
                (None, Some("nomorreferensi (no rujukan) kosong di booking".into()),
                 "Reg_periksa OK, SEP gagal — booking tidak ada nomorreferensi".into())
            }
        }
        '2' => {
            // INTERNAL — coba treat sebagai Kontrol (kalau ada surat kontrol), fallback skip
            if let Some(ref_no) = b.nomorreferensi.as_deref().filter(|s| !s.is_empty()) {
                match auto_sep_kontrol(&state, &client, &user_kode,
                    ref_no, &b.norm, &b.nomorkartu, &nama_pasien, &tgl_lahir, &jk, &no_telp,
                    &peserta_str, &hak_kelas, &no_rawat, &b.kd_poli_rs, &b.kode_poli_bpjs,
                    &b.kode_dokter_bpjs, b.catatan.as_deref(), b.tujuan_kunjungan.as_deref()).await
                {
                    Ok(no_sep) => (Some(no_sep), None,
                        "SEP Internal dibuat sebagai Kontrol (fallback)".into()),
                    Err(e) => (None, Some(e),
                        "Reg_periksa OK, SEP Internal gagal — lanjut loket".into()),
                }
            } else {
                (None, Some("Jenis Internal tanpa nomorreferensi tidak didukung auto SEP".into()),
                 "Reg_periksa OK, SEP Internal perlu manual di loket".into())
            }
        }
        _ => (None, Some(format!("Jenis kunjungan '{}' tidak dikenali", jenis)),
              format!("Reg_periksa OK, SEP jenis '{}' tidak otomatis", jenis)),
    };

    // Kirim task antrean Mobile JKN — kodebooking = NOBOOKING (antrean dibuat app
    // saat booking), BUKAN no_rawat, dan TANPA add antrean (sudah ada).
    //   Task 1 = jam check-in pasien (kolom validasi), baik dari aplikasi JKN
    //            maupun hasil check-in di anjungan ini beberapa baris di atas.
    //   Task 2 = lembar SEP terbuka (stempel dari anjungan).
    //   Task 3 = SEP selesai dibuat.
    // Dulu task 1 tidak pernah dikirim dengan asumsi aplikasi JKN sudah
    // mengirimnya saat booking — padahal yang dicatat BPJS untuk task 1 adalah
    // kedatangan pasien di faskes, bukan waktu booking.
    if no_sep_opt.is_some() {
        let validasi: Option<String> = sqlx::query_scalar(
            "SELECT CAST(validasi AS CHAR) FROM referensi_mobilejkn_bpjs WHERE nobooking=? LIMIT 1")
            .bind(&b.nobooking).fetch_optional(&state.pool).await.ok().flatten();
        let t1 = validasi
            .filter(|v| !v.trim().is_empty() && !v.starts_with("0000-00-00"))
            .and_then(|v| chrono::NaiveDateTime::parse_from_str(v.trim(), "%Y-%m-%d %H:%M:%S").ok())
            .and_then(|ndt| chrono::FixedOffset::east_opt(7 * 3600)
                .and_then(|wib| { use chrono::TimeZone; wib.from_local_datetime(&ndt).single() })
                .map(|dt| dt.timestamp_millis()))
            .unwrap_or(0);

        let sekarang = chrono::Local::now().timestamp_millis();
        let mut t2 = b.waktu_task2.filter(|v| *v > 0).unwrap_or(sekarang);
        if t1 > 0 && t2 <= t1 { t2 = t1 + 1000; }
        let t3 = if sekarang <= t2 { t2 + 1000 } else { sekarang };

        if t1 > 0 {
            kirim_task_antrean(&state.pool, &no_rawat, &b.nobooking, "1", &nama_pasien, &nm_poli, t1).await;
        }
        kirim_task_antrean(&state.pool, &no_rawat, &b.nobooking, "2", &nama_pasien, &nm_poli, t2).await;
        kirim_task_antrean(&state.pool, &no_rawat, &b.nobooking, "3", &nama_pasien, &nm_poli, t3).await;
    }

    let _ = crate::handlers::anjungan_admin::log_activity(
        &state.pool, "bpjs-mobilejkn", "checkin",
        crate::handlers::anjungan_admin::LogActivityFields {
            no_kartu:     Some(b.nomorkartu.clone()),
            no_rkm_medis: Some(b.norm.clone()),
            no_rawat:     Some(no_rawat.clone()),
            no_reg:       Some(no_reg.clone()),
            no_sep:       no_sep_opt.clone(),
            sukses:       Some(sep_error_opt.is_none()),
            error_message: sep_error_opt.clone(),
            meta:         Some(json!({"jenis": b.jeniskunjungan, "nobooking": b.nobooking})),
            ..Default::default()
        }
    ).await;

    Ok(Json(json!({
        "ok":         true,
        "auto_sep":   true,
        "nobooking":  b.nobooking,
        "no_rawat":   no_rawat,
        "no_reg":     no_reg,
        "nm_poli":    nm_poli,
        "nm_dokter":  nm_dokter,
        "no_sep":     no_sep_opt,
        "sep_error":  sep_error_opt,
        "message":    sep_meta_msg,
        "checkin_by": user_kode,
        "jenis":      b.jeniskunjungan,
    })))
}

// ── Helper: INSERT reg_periksa BPJS (sama pattern dengan walk-in) ──────────
async fn register_pasien_bpjs(
    pool: &sqlx::MySqlPool,
    no_rkm_medis: &str,
    kd_poli: &str,
    kd_dokter: &str,
    no_telp: &str,
) -> Result<(String, String), String> {
    use chrono::Datelike;

    // Snapshot pasien
    let pasien: Option<(String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT nm_pasien, DATE_FORMAT(tgl_lahir,'%Y-%m-%d'), jk, namakeluarga, alamat, keluarga
         FROM pasien WHERE no_rkm_medis=? LIMIT 1"
    ).bind(no_rkm_medis).fetch_optional(pool).await.map_err(|e| e.to_string())?;
    let Some((_nama, tgl_lahir, _jk, namakeluarga, alamat, keluarga)) = pasien
        else { return Err("Pasien tidak ditemukan".into()); };

    let poli: Option<(String, f64, f64)> = sqlx::query_as(
        "SELECT nm_poli, CAST(registrasi AS DOUBLE), CAST(registrasilama AS DOUBLE)
         FROM poliklinik WHERE kd_poli=? AND status='1' LIMIT 1"
    ).bind(kd_poli).fetch_optional(pool).await.map_err(|e| e.to_string())?;
    let Some((_nm_poli, biaya_baru, biaya_lama)) = poli
        else { return Err("Poli tidak ditemukan / nonaktif".into()); };

    let _dokter: Option<(String,)> = sqlx::query_as(
        "SELECT nm_dokter FROM dokter WHERE kd_dokter=? AND status='1' LIMIT 1"
    ).bind(kd_dokter).fetch_optional(pool).await.map_err(|e| e.to_string())?;

    let pernah_daftar: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa WHERE no_rkm_medis=?"
    ).bind(no_rkm_medis).fetch_one(pool).await.unwrap_or(0);
    let stts_daftar = if pernah_daftar > 0 { "Lama" } else { "Baru" };

    let pernah_poli: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa WHERE no_rkm_medis=? AND kd_poli=?"
    ).bind(no_rkm_medis).bind(kd_poli).fetch_one(pool).await.unwrap_or(0);
    let status_poli = if pernah_poli > 0 { "Lama" } else { "Baru" };
    let biaya_reg = if pernah_poli > 0 { biaya_lama } else { biaya_baru };

    let (umurdaftar, sttsumur) = match tgl_lahir.as_deref().and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()) {
        Some(tl) => {
            let today = chrono::Local::now().naive_local().date();
            let years = today.years_since(tl).unwrap_or(0) as i32;
            if years >= 1 { (years, "Th") }
            else {
                let months = ((today.year() - tl.year()) * 12 + (today.month() as i32 - tl.month() as i32)) as i32;
                if months >= 1 { (months, "Bl") }
                else { (((today - tl).num_days() as i32).max(0), "Hr") }
            }
        }
        None => (0, "Th"),
    };

    let next_global: i64 = sqlx::query_scalar(
        "SELECT CAST(IFNULL(MAX(CAST(SUBSTRING(no_rawat,12,6) AS UNSIGNED)),0)+1 AS SIGNED)
         FROM reg_periksa WHERE tgl_registrasi=CURDATE()"
    ).fetch_one(pool).await.map_err(|e| e.to_string())?;
    let next_per_poli: i64 = sqlx::query_scalar(
        "SELECT CAST(IFNULL(MAX(CAST(no_reg AS UNSIGNED)),0)+1 AS SIGNED)
         FROM reg_periksa WHERE tgl_registrasi=CURDATE() AND kd_poli=?"
    ).bind(kd_poli).fetch_one(pool).await.map_err(|e| e.to_string())?;
    let today = chrono::Local::now().format("%Y/%m/%d").to_string();
    let no_rawat = format!("{}/{:06}", today, next_global);
    let no_reg = format!("{:03}", next_per_poli);

    let pj_nama = namakeluarga.unwrap_or_default();
    let pj_almt = alamat.unwrap_or_default();
    let pj_hbg = keluarga.unwrap_or_else(|| "DIRI SENDIRI".to_string());

    // Kode penjab BPJS diambil dari tabel penjab, bukan hardcode — lihat
    // crate::handlers::kd_pj_bpjs (toleran migrasi 'A02' → 'BPJ').
    let kd_pj = crate::handlers::kd_pj_bpjs(pool).await;

    sqlx::query(
        "INSERT INTO reg_periksa
          (no_reg, no_rawat, tgl_registrasi, jam_reg, kd_dokter, no_rkm_medis, kd_poli,
           p_jawab, almt_pj, hubunganpj, biaya_reg, stts, stts_daftar, status_lanjut,
           kd_pj, umurdaftar, sttsumur, status_bayar, status_poli)
         VALUES (?, ?, CURDATE(), CURTIME(), ?, ?, ?, ?, ?, ?, ?, 'Belum', ?, 'Ralan',
                 ?, ?, ?, 'Belum Bayar', ?)"
    )
    .bind(&no_reg).bind(&no_rawat).bind(kd_dokter).bind(no_rkm_medis).bind(kd_poli)
    .bind(&pj_nama).bind(&pj_almt).bind(&pj_hbg).bind(biaya_reg)
    .bind(stts_daftar).bind(&kd_pj).bind(umurdaftar).bind(sttsumur).bind(status_poli)
    .execute(pool).await.map_err(|e| e.to_string())?;

    // Audit trail SQL (trackersql, meniru Khanza) — kiosk publik: kode "anjungan"
    crate::audit::log_sql(pool, "anjungan", &format!(
        "INSERT INTO reg_periksa (no_reg, no_rawat, tgl_registrasi, jam_reg, kd_dokter, no_rkm_medis, kd_poli, \
         p_jawab, almt_pj, hubunganpj, biaya_reg, stts, stts_daftar, status_lanjut, kd_pj, umurdaftar, sttsumur, status_bayar, status_poli) \
         VALUES ({}, {}, CURDATE(), CURTIME(), {}, {}, {}, {}, {}, {}, {}, 'Belum', {}, 'Ralan', {}, {}, {}, 'Belum Bayar', {})",
        crate::audit::q(&no_reg), crate::audit::q(&no_rawat), crate::audit::q(kd_dokter),
        crate::audit::q(no_rkm_medis), crate::audit::q(kd_poli),
        crate::audit::q(&pj_nama), crate::audit::q(&pj_almt), crate::audit::q(&pj_hbg), crate::audit::q(biaya_reg),
        crate::audit::q(stts_daftar), crate::audit::q(&kd_pj),
        crate::audit::q(umurdaftar), crate::audit::q(sttsumur), crate::audit::q(status_poli),
    )).await;

    // Update no_telp di reg_periksa? Tidak ada kolom — sudah di pasien.no_tlp (update setelah SEP)
    let _ = no_telp; // suppress unused warning
    Ok((no_rawat, no_reg))
}

// ── Helper: Auto SEP Kontrol via Mobile JKN ────────────────────────────────
#[allow(clippy::too_many_arguments)]
async fn auto_sep_kontrol(
    state: &AppState,
    client: &crate::handlers::bridging_bpjs::BpjsClient,
    user_kode: &str,
    no_surat: &str,
    no_rkm_medis: &str,
    no_kartu: &str,
    nama_pasien: &str,
    tgl_lahir: &str,
    jk: &str,
    no_telp: &str,
    peserta_str: &str,
    hak_kelas: &str,
    no_rawat: &str,
    _kd_poli_rs: &str,
    kd_poli_bpjs: &str,
    kd_dokter_bpjs: &str,
    catatan_opt: Option<&str>,
    tujuan_opt: Option<&str>,
) -> Result<String, String> {
    // 1. Lookup surat kontrol di Khanza
    #[derive(sqlx::FromRow)]
    struct SkRow {
        no_sep:         String,
        tgl_surat:      Option<String>,
        kd_dokter_bpjs: String,
        nm_dokter_bpjs: String,
        kd_poli_bpjs:   String,
        nm_poli_bpjs:   String,
    }
    let sk: Option<SkRow> = sqlx::query_as(
        "SELECT no_sep, DATE_FORMAT(tgl_surat,'%Y-%m-%d') AS tgl_surat,
                kd_dokter_bpjs, nm_dokter_bpjs, kd_poli_bpjs, nm_poli_bpjs
         FROM bridging_surat_kontrol_bpjs WHERE no_surat=? LIMIT 1"
    ).bind(no_surat).fetch_optional(&state.pool).await
    .map_err(|e| format!("query surat kontrol: {}", e))?;
    let Some(sk) = sk else { return Err(format!("Surat kontrol {} tidak ditemukan", no_surat)); };

    // 2. Lookup diagnosa dari SEP asal
    let dx: Option<(String, String)> = sqlx::query_as(
        "SELECT diagawal, nmdiagnosaawal FROM bridging_sep WHERE no_sep=? LIMIT 1"
    ).bind(&sk.no_sep).fetch_optional(&state.pool).await.ok().flatten();
    let (diag_kode, diag_nama) = dx.unwrap_or_else(|| ("Z00.0".into(), "General checkup".into()));

    // 3. Get kode_ppk RS
    let (kd_ppk_pelayanan, nm_ppk_pelayanan): (String, String) = sqlx::query_as(
        "SELECT kode_ppk, nama_instansi FROM setting LIMIT 1"
    ).fetch_one(&state.pool).await.map_err(|e| format!("setting: {}", e))?;

    // Pakai dokter dari surat kontrol (lebih akurat dari mapping)
    let _ = (kd_poli_bpjs, kd_dokter_bpjs); // dari booking — kontrol pakai sk
    let kd_dpjp_bpjs = sk.kd_dokter_bpjs.clone();
    let nm_dpjp_bpjs = sk.nm_dokter_bpjs.clone();
    let kd_poli_bpjs_use = sk.kd_poli_bpjs.clone();
    let nm_poli_bpjs_use = sk.nm_poli_bpjs.clone();
    let tgl_surat = sk.tgl_surat.clone().unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());
    let tgl_sep = chrono::Local::now().format("%Y-%m-%d").to_string();
    let catatan = catatan_opt.filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string()).unwrap_or_else(|| "Anjungan Mandiri".to_string());

    // 4. Build payload SEP Kontrol
    // tujuanKunj=2 (Konsul Dokter) MEWAJIBKAN assesmentPel=5 — samakan dgn APMSEPDuaPrinter.
    let tujuan_kunj = tujuan_opt.map(|s| s.trim()).filter(|s| !s.is_empty()).unwrap_or("2");
    let assesment_pel = if tujuan_kunj == "2" { "5" } else { "" };
    let payload = json!({
        "request": { "t_sep": {
            "noKartu": no_kartu, "tglSep": tgl_sep,
            "ppkPelayanan": kd_ppk_pelayanan, "jnsPelayanan": "2",
            "klsRawat": {"klsRawatHak": hak_kelas, "klsRawatNaik":"","pembiayaan":"","penanggungJawab":""},
            "noMR": no_rkm_medis,
            "rujukan": {
                "asalRujukan":"2", "tglRujukan": tgl_surat,
                "noRujukan": no_surat, "ppkRujukan": kd_ppk_pelayanan,
            },
            "catatan": catatan, "diagAwal": diag_kode,
            "poli": {"tujuan": kd_poli_bpjs_use, "eksekutif":"0"},
            "cob":{"cob":"0"}, "katarak":{"katarak":"0"},
            "jaminan": {"lakaLantas":"0", "penjamin": {
                "tglKejadian":"", "keterangan":"",
                "suplesi":{"suplesi":"0","noSepSuplesi":"",
                  "lokasiLaka":{"kdPropinsi":"","kdKabupaten":"","kdKecamatan":""}}
            }},
            "tujuanKunj": tujuan_kunj,
            "flagProcedure":"", "kdPenunjang":"", "assesmentPel": assesment_pel,
            "skdp":{"noSurat": no_surat, "kodeDPJP": kd_dpjp_bpjs},
            "dpjpLayan": kd_dpjp_bpjs, "noTelp": no_telp, "user": no_kartu,
        }}
    });

    // 5. POST SEP
    let resp = client.post("SEP/2.0/insert", payload).await
        .map_err(|e| format!("BPJS POST SEP/2.0/insert: {}", e))?;
    let no_sep = resp.pointer("/sep/noSep").and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("response noSep kosong: {}", resp))?;

    // 6. INSERT bridging_sep (Kontrol)
    let _ = sqlx::query(
        "INSERT INTO bridging_sep
         (no_sep, no_rawat, tglsep, tglrujukan, no_rujukan,
          kdppkrujukan, nmppkrujukan, kdppkpelayanan, nmppkpelayanan,
          jnspelayanan, catatan, diagawal, nmdiagnosaawal,
          kdpolitujuan, nmpolitujuan, klsrawat, klsnaik, pembiayaan, pjnaikkelas,
          lakalantas, user, nomr, nama_pasien, tanggal_lahir, peserta, jkel, no_kartu,
          tglpulang, asal_rujukan, eksekutif, cob, notelep, katarak, tglkkl,
          keterangankkl, suplesi, no_sep_suplesi, kdprop, nmprop, kdkab, nmkab,
          kdkec, nmkec, noskdp, kddpjp, nmdpdjp, tujuankunjungan, flagprosedur,
          penunjang, assesmenpel, kddpjplayan, nmdpjplayan)
         VALUES
         (?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          '2', ?, ?, ?,
          ?, ?, ?, '', '', '',
          '0', ?, ?, ?, ?, ?, ?, ?,
          '0000-00-00 00:00:00', '2. Faskes 2(RS)', '0. Tidak', '0. Tidak', ?, '0. Tidak', '0000-00-00',
          '', '0. Tidak', '', '', '', '', '',
          '', '', ?, ?, ?,
          '2', '', '', '', ?, ?)"
    )
    .bind(&no_sep).bind(no_rawat).bind(&tgl_sep).bind(&tgl_surat).bind(no_surat)
    .bind(&kd_ppk_pelayanan).bind(&nm_ppk_pelayanan).bind(&kd_ppk_pelayanan).bind(&nm_ppk_pelayanan)
    .bind(&catatan).bind(&diag_kode).bind(&diag_nama)
    .bind(&kd_poli_bpjs_use).bind(&nm_poli_bpjs_use).bind(hak_kelas)
    .bind(user_kode).bind(no_rkm_medis).bind(nama_pasien)
    .bind(tgl_lahir).bind(peserta_str).bind(jk).bind(no_kartu)
    .bind(no_telp)
    .bind(no_surat).bind(&kd_dpjp_bpjs).bind("")
    .bind(&kd_dpjp_bpjs).bind(&nm_dpjp_bpjs)
    .execute(&state.pool).await
    .map_err(|e| format!("INSERT bridging_sep: {} (no_sep_dibuat={})", e, no_sep));

    // Audit trail SQL (trackersql, meniru Khanza) — bridging_sep diringkas ke kolom kunci
    crate::audit::log_sql(&state.pool, user_kode, &format!(
        "INSERT INTO bridging_sep (no_sep, no_rawat, nomr, no_kartu, tglsep, diagawal, kdpolitujuan, noskdp, kddpjplayan) \
         VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}) -- +43 kolom lain (Kontrol Mobile JKN)",
        crate::audit::q(&no_sep), crate::audit::q(no_rawat), crate::audit::q(no_rkm_medis), crate::audit::q(no_kartu),
        crate::audit::q(&tgl_sep), crate::audit::q(&diag_kode), crate::audit::q(&kd_poli_bpjs_use),
        crate::audit::q(no_surat), crate::audit::q(&kd_dpjp_bpjs),
    )).await;

    // 7. Post-SEP: INSERT rujuk_masuk + UPDATE pasien (best-effort)
    let _ = sqlx::query(
        "INSERT INTO rujuk_masuk
         (no_rawat, perujuk, alamat, no_rujuk, jm_perujuk, dokter_perujuk,
          kd_penyakit, kategori_rujuk, keterangan, no_balasan)
         VALUES (?,?,?,?,?,?,?,?,?,?)"
    )
    .bind(no_rawat).bind(&nm_ppk_pelayanan).bind("-").bind(no_surat).bind(0.0f64)
    .bind(&nm_ppk_pelayanan).bind(&diag_kode).bind("-").bind("-").bind("-")
    .execute(&state.pool).await;
    crate::audit::log_sql(&state.pool, user_kode, &format!(
        "INSERT INTO rujuk_masuk (no_rawat, perujuk, alamat, no_rujuk, jm_perujuk, dokter_perujuk, kd_penyakit, kategori_rujuk, keterangan, no_balasan) \
         VALUES ({}, {}, '-', {}, 0, {}, {}, '-', '-', '-')",
        crate::audit::q(no_rawat), crate::audit::q(&nm_ppk_pelayanan), crate::audit::q(no_surat),
        crate::audit::q(&nm_ppk_pelayanan), crate::audit::q(&diag_kode),
    )).await;

    let _ = sqlx::query(
        "UPDATE pasien SET no_tlp = ?,
           umur = CONCAT(
             CONCAT(CONCAT(TIMESTAMPDIFF(YEAR, tgl_lahir, CURDATE()), ' Th '),
                    CONCAT(TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) - ((TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) div 12) * 12), ' Bl ')),
             CONCAT(TIMESTAMPDIFF(DAY,
               DATE_ADD(DATE_ADD(tgl_lahir, INTERVAL TIMESTAMPDIFF(YEAR, tgl_lahir, CURDATE()) YEAR),
                 INTERVAL TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) - ((TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) div 12) * 12) MONTH),
               CURDATE()), ' Hr'))
         WHERE no_rkm_medis = ?"
    ).bind(no_telp).bind(no_rkm_medis).execute(&state.pool).await;
    crate::audit::log_sql(&state.pool, user_kode, &format!(
        "UPDATE pasien SET no_tlp={}, umur=<hitung Th/Bl/Hr dari tgl_lahir> WHERE no_rkm_medis={}",
        crate::audit::q(no_telp), crate::audit::q(no_rkm_medis),
    )).await;

    Ok(no_sep)
}

// ── Helper: Auto SEP Rujukan via Mobile JKN (Jenis 1 FKTP / 4 Antar RS) ────
#[allow(clippy::too_many_arguments)]
async fn auto_sep_rujukan(
    state: &AppState,
    client: &crate::handlers::bridging_bpjs::BpjsClient,
    user_kode: &str,
    no_rujukan: &str,
    no_rkm_medis: &str,
    no_kartu: &str,
    nama_pasien: &str,
    tgl_lahir: &str,
    jk: &str,
    no_telp: &str,
    peserta_str: &str,
    hak_kelas: &str,
    no_rawat: &str,
    _kd_poli_rs: &str,
    kd_poli_bpjs: &str,
    kd_dokter_bpjs: &str,
    catatan_opt: Option<&str>,
) -> Result<String, String> {
    // 1. Fetch detail rujukan dari BPJS
    let resp = client.get(&format!("Rujukan/{}", no_rujukan)).await
        .map_err(|e| format!("BPJS GET Rujukan/{}: {}", no_rujukan, e))?;

    let rujukan = resp.pointer("/rujukan").unwrap_or(&resp);
    let asal_rujukan_str = resp.pointer("/asalFaskes").and_then(|v| v.as_str())
        .unwrap_or("1").to_string();
    let asal_rujukan = if asal_rujukan_str == "2" { "2" } else { "1" };
    let asal_label = if asal_rujukan == "1" { "1. Faskes 1" } else { "2. Faskes 2(RS)" };

    let tgl_rujukan = rujukan.pointer("/tglKunjungan").and_then(|v| v.as_str())
        .map(|s| s.to_string()).unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());
    let kd_ppk_rujukan = rujukan.pointer("/provPerujuk/kode").and_then(|v| v.as_str())
        .unwrap_or("").to_string();
    let nm_ppk_rujukan = rujukan.pointer("/provPerujuk/nama").and_then(|v| v.as_str())
        .unwrap_or("").to_string();
    let diag_kode = rujukan.pointer("/diagnosa/kode").and_then(|v| v.as_str())
        .unwrap_or("Z00.0").to_string();
    let diag_nama = rujukan.pointer("/diagnosa/nama").and_then(|v| v.as_str())
        .unwrap_or("General checkup").to_string();
    let kd_poli_bpjs_use = rujukan.pointer("/poliRujukan/kode").and_then(|v| v.as_str())
        .map(|s| s.to_string()).unwrap_or_else(|| kd_poli_bpjs.to_string());
    let nm_poli_bpjs_use = rujukan.pointer("/poliRujukan/nama").and_then(|v| v.as_str())
        .unwrap_or("").to_string();

    // 2. Get kode_ppk RS
    let (kd_ppk_pelayanan, nm_ppk_pelayanan): (String, String) = sqlx::query_as(
        "SELECT kode_ppk, nama_instansi FROM setting LIMIT 1"
    ).fetch_one(&state.pool).await.map_err(|e| format!("setting: {}", e))?;

    // Resolve mapping kd_dokter_bpjs (booking) → nama via DB
    let nm_dpjp_bpjs: String = sqlx::query_scalar(
        "SELECT nm_dokter_bpjs FROM maping_dokter_dpjpvclaim WHERE kd_dokter_bpjs=? LIMIT 1"
    ).bind(kd_dokter_bpjs).fetch_optional(&state.pool).await.ok().flatten().unwrap_or_default();

    let tgl_sep = chrono::Local::now().format("%Y-%m-%d").to_string();
    let catatan = catatan_opt.filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string()).unwrap_or_else(|| "Anjungan Mandiri".to_string());

    // 3. Build payload SEP Rujukan
    let payload = json!({
        "request": { "t_sep": {
            "noKartu": no_kartu, "tglSep": tgl_sep,
            "ppkPelayanan": kd_ppk_pelayanan, "jnsPelayanan": "2",
            "klsRawat": {"klsRawatHak": hak_kelas, "klsRawatNaik":"","pembiayaan":"","penanggungJawab":""},
            "noMR": no_rkm_medis,
            "rujukan": {
                "asalRujukan": asal_rujukan, "tglRujukan": tgl_rujukan,
                "noRujukan": no_rujukan, "ppkRujukan": kd_ppk_rujukan,
            },
            "catatan": catatan, "diagAwal": diag_kode,
            "poli": {"tujuan": kd_poli_bpjs_use, "eksekutif":"0"},
            "cob":{"cob":"0"}, "katarak":{"katarak":"0"},
            "jaminan": {"lakaLantas":"0", "penjamin": {
                "tglKejadian":"", "keterangan":"",
                "suplesi":{"suplesi":"0","noSepSuplesi":"",
                  "lokasiLaka":{"kdPropinsi":"","kdKabupaten":"","kdKecamatan":""}}
            }},
            "tujuanKunj":"0", "flagProcedure":"", "kdPenunjang":"", "assesmentPel":"",
            "skdp":{"noSurat":"", "kodeDPJP":""},
            "dpjpLayan": kd_dokter_bpjs, "noTelp": no_telp, "user": no_kartu,
        }}
    });

    let resp = client.post("SEP/2.0/insert", payload).await
        .map_err(|e| format!("BPJS POST SEP/2.0/insert: {}", e))?;
    let no_sep = resp.pointer("/sep/noSep").and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("response noSep kosong: {}", resp))?;

    // INSERT bridging_sep (Rujukan) — pattern sama dengan handler create_sep
    let _ = sqlx::query(
        "INSERT INTO bridging_sep
         (no_sep, no_rawat, tglsep, tglrujukan, no_rujukan,
          kdppkrujukan, nmppkrujukan, kdppkpelayanan, nmppkpelayanan,
          jnspelayanan, catatan, diagawal, nmdiagnosaawal,
          kdpolitujuan, nmpolitujuan, klsrawat, klsnaik, pembiayaan, pjnaikkelas,
          lakalantas, user, nomr, nama_pasien, tanggal_lahir, peserta, jkel, no_kartu,
          tglpulang, asal_rujukan, eksekutif, cob, notelep, katarak, tglkkl,
          keterangankkl, suplesi, no_sep_suplesi, kdprop, nmprop, kdkab, nmkab,
          kdkec, nmkec, noskdp, kddpjp, nmdpdjp, tujuankunjungan, flagprosedur,
          penunjang, assesmenpel, kddpjplayan, nmdpjplayan)
         VALUES
         (?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          '2', ?, ?, ?,
          ?, ?, ?, '', '', '',
          '0', ?, ?, ?, ?, ?, ?, ?,
          '0000-00-00 00:00:00', ?, '0. Tidak', '0. Tidak', ?, '0. Tidak', '0000-00-00',
          '', '0. Tidak', '', '', '', '', '',
          '', '', '', ?, ?,
          '0', '', '', '', ?, ?)"
    )
    .bind(&no_sep).bind(no_rawat).bind(&tgl_sep).bind(&tgl_rujukan).bind(no_rujukan)
    .bind(&kd_ppk_rujukan).bind(&nm_ppk_rujukan).bind(&kd_ppk_pelayanan).bind(&nm_ppk_pelayanan)
    .bind(&catatan).bind(&diag_kode).bind(&diag_nama)
    .bind(&kd_poli_bpjs_use).bind(&nm_poli_bpjs_use).bind(hak_kelas)
    .bind(user_kode).bind(no_rkm_medis).bind(nama_pasien)
    .bind(tgl_lahir).bind(peserta_str).bind(jk).bind(no_kartu)
    .bind(asal_label).bind(no_telp)
    .bind(kd_dokter_bpjs).bind(&nm_dpjp_bpjs)
    .bind(kd_dokter_bpjs).bind(&nm_dpjp_bpjs)
    .execute(&state.pool).await
    .map_err(|e| format!("INSERT bridging_sep: {} (no_sep_dibuat={})", e, no_sep));

    // Audit trail SQL (trackersql, meniru Khanza) — bridging_sep diringkas ke kolom kunci
    crate::audit::log_sql(&state.pool, user_kode, &format!(
        "INSERT INTO bridging_sep (no_sep, no_rawat, nomr, no_kartu, tglsep, diagawal, kdpolitujuan, no_rujukan, kddpjplayan) \
         VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}) -- +43 kolom lain (Rujukan Mobile JKN, asal_rujukan={})",
        crate::audit::q(&no_sep), crate::audit::q(no_rawat), crate::audit::q(no_rkm_medis), crate::audit::q(no_kartu),
        crate::audit::q(&tgl_sep), crate::audit::q(&diag_kode), crate::audit::q(&kd_poli_bpjs_use),
        crate::audit::q(no_rujukan), crate::audit::q(kd_dokter_bpjs), crate::audit::q(asal_label),
    )).await;

    // Post-SEP: rujuk_masuk + UPDATE pasien
    let next_br: i64 = sqlx::query_scalar(
        "SELECT CAST(IFNULL(MAX(CAST(SUBSTRING_INDEX(rm.no_balasan,'/',-1) AS UNSIGNED)),0)+1 AS SIGNED)
         FROM rujuk_masuk rm
         JOIN reg_periksa r ON r.no_rawat=rm.no_rawat
         WHERE r.tgl_registrasi=CURDATE() AND rm.no_balasan LIKE 'BR/%'"
    ).fetch_one(&state.pool).await.unwrap_or(1);
    let no_rujuk_masuk = format!("BR/{}/{:04}",
        chrono::Local::now().format("%d-%m-%Y"), next_br);

    let _ = sqlx::query(
        "INSERT INTO rujuk_masuk
         (no_rawat, perujuk, alamat, no_rujuk, jm_perujuk, dokter_perujuk,
          kd_penyakit, kategori_rujuk, keterangan, no_balasan)
         VALUES (?,?,?,?,?,?,?,?,?,?)"
    )
    .bind(no_rawat).bind(&nm_ppk_rujukan).bind("-").bind(no_rujukan).bind(0.0f64)
    .bind(&nm_ppk_rujukan).bind(&diag_kode).bind("-").bind("-").bind(&no_rujuk_masuk)
    .execute(&state.pool).await;
    crate::audit::log_sql(&state.pool, user_kode, &format!(
        "INSERT INTO rujuk_masuk (no_rawat, perujuk, alamat, no_rujuk, jm_perujuk, dokter_perujuk, kd_penyakit, kategori_rujuk, keterangan, no_balasan) \
         VALUES ({}, {}, '-', {}, 0, {}, {}, '-', '-', {})",
        crate::audit::q(no_rawat), crate::audit::q(&nm_ppk_rujukan), crate::audit::q(no_rujukan),
        crate::audit::q(&nm_ppk_rujukan), crate::audit::q(&diag_kode), crate::audit::q(&no_rujuk_masuk),
    )).await;

    let _ = sqlx::query(
        "UPDATE pasien SET no_tlp = ?,
           umur = CONCAT(
             CONCAT(CONCAT(TIMESTAMPDIFF(YEAR, tgl_lahir, CURDATE()), ' Th '),
                    CONCAT(TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) - ((TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) div 12) * 12), ' Bl ')),
             CONCAT(TIMESTAMPDIFF(DAY,
               DATE_ADD(DATE_ADD(tgl_lahir, INTERVAL TIMESTAMPDIFF(YEAR, tgl_lahir, CURDATE()) YEAR),
                 INTERVAL TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) - ((TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) div 12) * 12) MONTH),
               CURDATE()), ' Hr'))
         WHERE no_rkm_medis = ?"
    ).bind(no_telp).bind(no_rkm_medis).execute(&state.pool).await;
    crate::audit::log_sql(&state.pool, user_kode, &format!(
        "UPDATE pasien SET no_tlp={}, umur=<hitung Th/Bl/Hr dari tgl_lahir> WHERE no_rkm_medis={}",
        crate::audit::q(no_telp), crate::audit::q(no_rkm_medis),
    )).await;

    Ok(no_sep)
}

// ── 7. CREATE SEP (POST /SEP/2.0/insert) + INSERT bridging_sep ──────────────
//
// Port dari Java APMSEPDuaPrinter BridgingSEP.insertSEP() (~150 baris).
// Setelah BPJS response 200, decrypt response.sep.noSep + INSERT bridging_sep
// (52 kolom). Reg_periksa SUDAH ter-insert di step sebelumnya (via walk-in/daftar
// kd_pj BPJS) — handler ini hanya tambah SEP-nya.
#[derive(Deserialize)]
pub struct CreateSepBody {
    /// Epoch ms saat pasien memasukkan nomor kartu di anjungan (task 1).
    /// Direkam frontend; kalau kosong dipakai jam registrasi.
    #[serde(default)]
    pub waktu_task1:     Option<i64>,
    /// Epoch ms saat lembar SEP terbuka di anjungan (task 2).
    /// Kalau kosong dipakai waktu SEP dibuat.
    #[serde(default)]
    pub waktu_task2:     Option<i64>,
    pub no_rawat:        String,
    pub no_kartu:        String,
    pub no_rkm_medis:    String,
    pub nama_pasien:     String,
    pub tgl_lahir:       Option<String>,    // YYYY-MM-DD
    pub jk:              Option<String>,    // L / P
    pub no_telp:         Option<String>,
    pub peserta:         Option<String>,    // jenisPeserta.keterangan
    pub hak_kelas:       Option<String>,    // "1" / "2" / "3"
    // Rujukan
    pub asal_rujukan:    Option<String>,    // "1" (Faskes 1) atau "2"
    pub tgl_rujukan:     String,
    pub no_rujukan:      String,
    pub kd_ppk_rujukan:  String,
    pub nm_ppk_rujukan:  String,
    pub diag_kode:       String,
    pub diag_nama:       String,
    pub kd_poli_bpjs:    String,
    pub nm_poli_bpjs:    String,
    pub kd_poli_rs:      String,
    pub kd_dokter_rs:    String,
    // Opsional / default
    pub jns_pelayanan:   Option<String>,    // "1"=Ranap "2"=Ralan, default 2
    pub catatan:         Option<String>,
    pub eksekutif:       Option<String>,    // "0"
    pub katarak:         Option<String>,    // "0"
    pub laka_lantas:     Option<String>,    // "0"
    pub tujuan_kunjungan: Option<String>,   // "0"=Normal "1"=Prosedur Lanjutan "2"=Konsul Dokter
    pub user_input:      Option<String>,    // default = no_kartu
}

#[derive(serde::Serialize)]
pub struct CreateSepResp {
    pub no_sep:      String,
    pub no_rawat:    String,
    pub no_rujukan:  String,
    pub tgl_sep:     String,
    pub meta_message: String,
}

pub async fn create_sep(
    State(state): State<AppState>,
    Json(b): Json<CreateSepBody>,
) -> Result<Json<CreateSepResp>, (StatusCode, Json<Value>)> {
    use crate::handlers::bridging_bpjs::{BpjsClient, BpjsConfig};

    // 1. Get kode_ppk RS dari setting
    let (kd_ppk_pelayanan, nm_ppk_pelayanan): (String, String) = sqlx::query_as(
        "SELECT kode_ppk, nama_instansi FROM setting LIMIT 1"
    ).fetch_one(&state.pool).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("baca setting: {}", e)}))))?;

    // 2. Resolve kd_dokter_bpjs dari maping_dokter_dpjpvclaim
    let mapping_dokter: Option<(String, String)> = sqlx::query_as(
        "SELECT kd_dokter_bpjs, nm_dokter_bpjs FROM maping_dokter_dpjpvclaim WHERE kd_dokter=? LIMIT 1"
    ).bind(&b.kd_dokter_rs)
    .fetch_optional(&state.pool).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("baca maping dokter: {}", e)}))))?;
    let Some((kd_dpjp_bpjs, nm_dpjp_bpjs)) = mapping_dokter else {
        return Err(err400(&format!("Dokter {} belum punya mapping BPJS (maping_dokter_dpjpvclaim)", b.kd_dokter_rs)));
    };

    // 3. Build payload sesuai BPJS /SEP/2.0/insert spec
    let cfg = BpjsConfig::from_env()
        .ok_or_else(|| err503("Konfigurasi BPJS belum diset"))?;
    let client = BpjsClient::new(cfg);

    let tgl_sep = chrono::Local::now().format("%Y-%m-%d").to_string();
    let jns_pelayanan = b.jns_pelayanan.as_deref().filter(|s| !s.is_empty()).unwrap_or("2");
    let asal_rujukan  = b.asal_rujukan.as_deref().filter(|s| !s.is_empty()).unwrap_or("1");
    let kls_rawat     = b.hak_kelas.as_deref().filter(|s| !s.is_empty()).unwrap_or("3");
    let eksekutif     = b.eksekutif.as_deref().unwrap_or("0");
    let katarak       = b.katarak.as_deref().unwrap_or("0");
    let laka_lantas   = b.laka_lantas.as_deref().unwrap_or("0");
    let tujuan_kunj   = b.tujuan_kunjungan.as_deref().unwrap_or("0");
    let user_input    = b.user_input.clone().unwrap_or_else(|| b.no_kartu.clone());
    // Default catatan SEP: "Anjungan Mandiri" — kalau frontend tidak kirim/kosong.
    // Penanda asal SEP (audit trail) — beda dengan SEP dari loket atau Mobile JKN.
    let catatan       = b.catatan.clone().filter(|s| !s.trim().is_empty())
                          .unwrap_or_else(|| "Anjungan Mandiri".to_string());
    let no_telp       = b.no_telp.clone().unwrap_or_default();

    // 2b. ADD ANTREAN BPJS dulu (sebelum SEP). Rujukan FKTP→jeniskunjungan=1, FKRTL(asal="2")→4.
    // Guard: cegah SEP duplikat + cek kuota + window sebelum add antrean/SEP.
    guard_sebelum_sep(&state.pool, &b.no_kartu, jns_pelayanan, &b.nm_poli_bpjs,
        &b.no_rawat, &b.kd_poli_rs, &b.kd_dokter_rs, &tgl_sep).await?;

    let jenis_kunj_antrean = if asal_rujukan == "2" { 4 } else { 1 };
    add_antrean_bpjs(
        &state.pool, &b.no_rawat, &b.no_kartu, &b.no_rkm_medis, &b.nama_pasien, &no_telp,
        &b.kd_poli_bpjs, &b.nm_poli_bpjs, &b.kd_poli_rs, &b.kd_dokter_rs,
        &kd_dpjp_bpjs, &nm_dpjp_bpjs, &tgl_sep, jenis_kunj_antrean, &b.no_rujukan,
    ).await?;
    // Task 1/2/3 dikirim sekaligus setelah SEP terbit — lihat blok di bawah.

    let payload = json!({
        "request": {
            "t_sep": {
                "noKartu":      b.no_kartu,
                "tglSep":       tgl_sep,
                "ppkPelayanan": kd_ppk_pelayanan,
                "jnsPelayanan": jns_pelayanan,
                "klsRawat": {
                    "klsRawatHak":      kls_rawat,
                    "klsRawatNaik":     "",
                    "pembiayaan":       "",
                    "penanggungJawab":  "",
                },
                "noMR": b.no_rkm_medis,
                "rujukan": {
                    "asalRujukan": asal_rujukan,
                    "tglRujukan":  b.tgl_rujukan,
                    "noRujukan":   b.no_rujukan,
                    "ppkRujukan":  b.kd_ppk_rujukan,
                },
                "catatan":  catatan,
                "diagAwal": b.diag_kode,
                "poli": {
                    "tujuan":    b.kd_poli_bpjs,
                    "eksekutif": eksekutif,
                },
                "cob":     { "cob": "0" },
                "katarak": { "katarak": katarak },
                "jaminan": {
                    "lakaLantas": laka_lantas,
                    "penjamin": {
                        "tglKejadian": "",
                        "keterangan":  "",
                        "suplesi": {
                            "suplesi":     "0",
                            "noSepSuplesi": "",
                            "lokasiLaka": {
                                "kdPropinsi":  "",
                                "kdKabupaten": "",
                                "kdKecamatan": "",
                            }
                        }
                    }
                },
                "tujuanKunj":    tujuan_kunj,
                "flagProcedure": "",
                "kdPenunjang":   "",
                "assesmentPel":  "",
                "skdp": { "noSurat": "", "kodeDPJP": "" },
                "dpjpLayan":     kd_dpjp_bpjs,
                "noTelp":        no_telp,
                "user":          user_input,
            }
        }
    });

    // 4. POST ke BPJS
    let resp = client.post("SEP/2.0/insert", payload).await
        .map_err(|e| err_upstream(e))?;

    // 5. Ambil noSep dari response.sep.noSep
    let no_sep = resp.pointer("/sep/noSep")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| err_upstream(format!("response BPJS tidak ada noSep: {}", resp)))?;

    // 6. INSERT bridging_sep (52 kolom — sesuai Java BridgingSEP.menyimpan bridging_sep)
    let user_kode = "anjungan".to_string();  // kiosk publik: tanpa login petugas
    let jk_pasien = b.jk.clone().unwrap_or_default();
    let peserta_str = b.peserta.clone().unwrap_or_default();
    let tgl_lahir = b.tgl_lahir.clone().unwrap_or_else(|| "0000-00-00".to_string());

    let asal_rujukan_label = if asal_rujukan == "1" { "1. Faskes 1" } else { "2. Faskes 2(RS)" };

    sqlx::query(
        "INSERT INTO bridging_sep
         (no_sep, no_rawat, tglsep, tglrujukan, no_rujukan,
          kdppkrujukan, nmppkrujukan, kdppkpelayanan, nmppkpelayanan,
          jnspelayanan, catatan, diagawal, nmdiagnosaawal,
          kdpolitujuan, nmpolitujuan, klsrawat, klsnaik, pembiayaan, pjnaikkelas,
          lakalantas, user, nomr, nama_pasien, tanggal_lahir, peserta, jkel, no_kartu,
          tglpulang, asal_rujukan, eksekutif, cob, notelep, katarak, tglkkl,
          keterangankkl, suplesi, no_sep_suplesi, kdprop, nmprop, kdkab, nmkab,
          kdkec, nmkec, noskdp, kddpjp, nmdpdjp, tujuankunjungan, flagprosedur,
          penunjang, assesmenpel, kddpjplayan, nmdpjplayan)
         VALUES
         (?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, '', '', '',
          ?, ?, ?, ?, ?, ?, ?, ?,
          '0000-00-00 00:00:00', ?, '0. Tidak', '0. Tidak', ?, '0. Tidak', '0000-00-00',
          '', '0. Tidak', '', '', '', '', '',
          '', '', '', '', ?,
          ?, '', '', '', ?, ?)"
    )
    .bind(&no_sep).bind(&b.no_rawat).bind(&tgl_sep).bind(&b.tgl_rujukan).bind(&b.no_rujukan)
    .bind(&b.kd_ppk_rujukan).bind(&b.nm_ppk_rujukan).bind(&kd_ppk_pelayanan).bind(&nm_ppk_pelayanan)
    .bind(jns_pelayanan).bind(&catatan).bind(&b.diag_kode).bind(&b.diag_nama)
    .bind(&b.kd_poli_bpjs).bind(&b.nm_poli_bpjs).bind(kls_rawat)
    .bind(laka_lantas).bind(&user_kode).bind(&b.no_rkm_medis).bind(&b.nama_pasien)
    .bind(&tgl_lahir).bind(&peserta_str).bind(&jk_pasien).bind(&b.no_kartu)
    .bind(asal_rujukan_label).bind(&no_telp)
    .bind("")                                  // nmdpdjp (SKDP DPJP) — kosong utk rujukan baru
    .bind(tujuan_kunj)                          // tujuankunjungan
    .bind(&kd_dpjp_bpjs).bind(&nm_dpjp_bpjs)    // kddpjplayan, nmdpjplayan
    .execute(&state.pool).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": format!("INSERT bridging_sep gagal: {}", e), "no_sep_dibuat": no_sep}))))?;

    // Audit trail SQL (trackersql, meniru Khanza) — bridging_sep diringkas ke kolom kunci
    crate::audit::log_sql(&state.pool, &user_kode, &format!(
        "INSERT INTO bridging_sep (no_sep, no_rawat, nomr, no_kartu, tglsep, diagawal, kdpolitujuan, no_rujukan, kddpjplayan) \
         VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}) -- +43 kolom lain (asal_rujukan={})",
        crate::audit::q(&no_sep), crate::audit::q(&b.no_rawat), crate::audit::q(&b.no_rkm_medis), crate::audit::q(&b.no_kartu),
        crate::audit::q(&tgl_sep), crate::audit::q(&b.diag_kode), crate::audit::q(&b.kd_poli_bpjs),
        crate::audit::q(&b.no_rujukan), crate::audit::q(&kd_dpjp_bpjs), crate::audit::q(asal_rujukan_label),
    )).await;

    // ── Post-SEP steps (port Java BridgingSEP.insertSEP lines 2200+) ───────
    //
    // 1) Generate NoRujukMasuk: "BR/dd-MM-YYYY/NNNN" — counter daily
    //    Khanza pakai untuk audit trail rujukan masuk dari Faskes 1.
    let next_br: i64 = sqlx::query_scalar(
        "SELECT CAST(IFNULL(MAX(CAST(SUBSTRING_INDEX(rm.no_balasan,'/',-1) AS UNSIGNED)),0)+1 AS SIGNED)
         FROM rujuk_masuk rm
         JOIN reg_periksa r ON r.no_rawat=rm.no_rawat
         WHERE r.tgl_registrasi=CURDATE() AND rm.no_balasan LIKE 'BR/%'"
    ).fetch_one(&state.pool).await.unwrap_or(1);
    let no_rujuk_masuk = format!("BR/{}/{:04}",
        chrono::Local::now().format("%d-%m-%Y"), next_br);

    // 2) INSERT rujuk_masuk (10 kolom — port Java pattern)
    //    Schema: no_rawat, perujuk, alamat, no_rujuk, jm_perujuk, dokter_perujuk,
    //            kd_penyakit, kategori_rujuk, keterangan, no_balasan
    let _ = sqlx::query(
        "INSERT INTO rujuk_masuk
         (no_rawat, perujuk, alamat, no_rujuk, jm_perujuk, dokter_perujuk,
          kd_penyakit, kategori_rujuk, keterangan, no_balasan)
         VALUES (?,?,?,?,?,?,?,?,?,?)"
    )
    .bind(&b.no_rawat)
    .bind(&b.nm_ppk_rujukan)        // perujuk = nama Faskes 1
    .bind("-")                       // alamat (Khanza default "-")
    .bind(&b.no_rujukan)
    .bind(0.0f64)                    // jm_perujuk
    .bind(&b.nm_ppk_rujukan)        // dokter_perujuk (Khanza pattern: pakai nama Faskes lagi)
    .bind(&b.diag_kode)
    .bind("-")                       // kategori_rujuk default "-"
    .bind("-")                       // keterangan
    .bind(&no_rujuk_masuk)
    .execute(&state.pool).await
    .map_err(|e| tracing::warn!("INSERT rujuk_masuk gagal (non-fatal): {}", e));

    crate::audit::log_sql(&state.pool, &user_kode, &format!(
        "INSERT INTO rujuk_masuk (no_rawat, perujuk, alamat, no_rujuk, jm_perujuk, dokter_perujuk, kd_penyakit, kategori_rujuk, keterangan, no_balasan) \
         VALUES ({}, {}, '-', {}, 0, {}, {}, '-', '-', {})",
        crate::audit::q(&b.no_rawat), crate::audit::q(&b.nm_ppk_rujukan), crate::audit::q(&b.no_rujukan),
        crate::audit::q(&b.nm_ppk_rujukan), crate::audit::q(&b.diag_kode), crate::audit::q(&no_rujuk_masuk),
    )).await;

    // 3) UPDATE pasien.no_tlp + umur dengan format Khanza yang aneh tapi konsisten
    //    "XX Th YY Bl ZZ Hr" — sesuai Java Sequel.mengedit("pasien", ...)
    let _ = sqlx::query(
        "UPDATE pasien SET
           no_tlp = ?,
           umur = CONCAT(
             CONCAT(CONCAT(TIMESTAMPDIFF(YEAR, tgl_lahir, CURDATE()), ' Th '),
                    CONCAT(TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) - ((TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) div 12) * 12), ' Bl ')),
             CONCAT(TIMESTAMPDIFF(DAY,
               DATE_ADD(
                 DATE_ADD(tgl_lahir, INTERVAL TIMESTAMPDIFF(YEAR, tgl_lahir, CURDATE()) YEAR),
                 INTERVAL TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) - ((TIMESTAMPDIFF(MONTH, tgl_lahir, CURDATE()) div 12) * 12) MONTH),
               CURDATE()
             ), ' Hr')
           )
         WHERE no_rkm_medis = ?"
    )
    .bind(&no_telp).bind(&b.no_rkm_medis)
    .execute(&state.pool).await
    .map_err(|e| tracing::warn!("UPDATE pasien no_tlp/umur gagal (non-fatal): {}", e));

    crate::audit::log_sql(&state.pool, &user_kode, &format!(
        "UPDATE pasien SET no_tlp={}, umur=<hitung Th/Bl/Hr dari tgl_lahir> WHERE no_rkm_medis={}",
        crate::audit::q(&no_telp), crate::audit::q(&b.no_rkm_medis),
    )).await;

    let _ = crate::handlers::anjungan_admin::log_activity(
        &state.pool, "bpjs-rujukan", "sep",
        crate::handlers::anjungan_admin::LogActivityFields {
            no_kartu:     Some(b.no_kartu.clone()),
            no_rkm_medis: Some(b.no_rkm_medis.clone()),
            no_rawat:     Some(b.no_rawat.clone()),
            no_sep:       Some(no_sep.clone()),
            sukses:       Some(true),
            ..Default::default()
        }
    ).await;

    // Task 1 = pasien memasukkan nomor kartu, task 2 = lembar SEP terbuka,
    // task 3 = SEP selesai dibuat. Stempel 1 & 2 direkam anjungan karena pada
    // momen itu kodebooking belum ada — BPJS menolak updatewaktu tanpa itu.
    // Semantik sama dengan DlgRegistrasiSEPPertama di APMSEPDuaPrinter.
    let t1 = match b.waktu_task1 {
        Some(v) if v > 0 => v,
        _ => waktu_registrasi_ms(&state.pool, &b.no_rawat).await,
    };
    let sekarang = chrono::Local::now().timestamp_millis();
    let mut t2 = b.waktu_task2.filter(|v| *v > 0).unwrap_or(sekarang);
    if t1 > 0 && t2 <= t1 { t2 = t1 + 1000; }          // BPJS menolak waktu tak menaik
    let t3 = if sekarang <= t2 { t2 + 1000 } else { sekarang };

    kirim_task_antrean(&state.pool, &b.no_rawat, &b.no_rawat, "1", &b.nama_pasien, &b.nm_poli_bpjs, t1).await;
    kirim_task_antrean(&state.pool, &b.no_rawat, &b.no_rawat, "2", &b.nama_pasien, &b.nm_poli_bpjs, t2).await;
    kirim_task_antrean(&state.pool, &b.no_rawat, &b.no_rawat, "3", &b.nama_pasien, &b.nm_poli_bpjs, t3).await;

    Ok(Json(CreateSepResp {
        no_sep, no_rawat: b.no_rawat,
        no_rujukan: b.no_rujukan, tgl_sep,
        meta_message: "SEP berhasil dibuat".into(),
    }))
}

// ── 6. Mapping poli BPJS → kd_poli Khanza ───────────────────────────────────
#[derive(Deserialize)]
pub struct MapingPoliQuery { pub kd_poli_bpjs: String }

pub async fn maping_poli(
    State(state): State<AppState>,
    Query(q): Query<MapingPoliQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let kd = q.kd_poli_bpjs.trim();
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT m.kd_poli_rs, p.nm_poli
         FROM maping_poli_bpjs m
         LEFT JOIN poliklinik p ON p.kd_poli=m.kd_poli_rs
         WHERE m.kd_poli_bpjs=? LIMIT 1"
    ).bind(kd)
    .fetch_optional(&state.pool).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    match row {
        Some((rs, nm)) => Ok(Json(json!({"ok": true, "found": true, "kd_poli_rs": rs, "nm_poli": nm}))),
        None => Ok(Json(json!({"ok": true, "found": false}))),
    }
}
