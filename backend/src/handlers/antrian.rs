use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use futures::stream::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::convert::Infallible;
use tokio_stream::wrappers::BroadcastStream;

#[derive(Serialize)]
pub struct AmbilTiketResp {
    pub prefix: String,
    pub nomor:  String,
    pub jam:    String,
    pub sisa:   i64,
}

/// Layanan anjungan → prefix antrian. Selaras dengan DlgAntrian di APMSEPDuaPrinter:
///   A = Pendaftaran Pasien Baru
///   B = Pendaftaran Pasien Rawat Jalan
///   C = Pendaftaran Poli Rawat Inap
#[derive(Deserialize, Default)]
pub struct AmbilTiketReq {
    #[serde(default)]
    pub prefix: Option<String>,
}

/// Normalkan prefix: satu huruf kapital A-Z, default "A" (kompatibel dengan
/// klien lama yang belum mengirim prefix).
fn normalisasi_prefix(p: Option<String>) -> String {
    p.and_then(|v| v.trim().chars().next())
        .map(|c| c.to_ascii_uppercase())
        .filter(|c| c.is_ascii_alphabetic())
        .unwrap_or('A')
        .to_string()
}

pub async fn ambil_tiket(
    State(state): State<AppState>,
    body: Option<Json<AmbilTiketReq>>,
) -> Result<Json<AmbilTiketResp>, (StatusCode, Json<Value>)> {
    let prefix = normalisasi_prefix(body.and_then(|Json(b)| b.prefix));
    let mut tx = state.pool.begin().await.map_err(db_err)?;

    // Deret nomor berjalan PER PREFIX — A dan B punya hitungan sendiri.
    let (next_no,): (i64,) = sqlx::query_as(
        "SELECT CAST(IFNULL(MAX(CAST(nomor AS UNSIGNED)), 0) + 1 AS SIGNED) \
         FROM antripendaftaran_nomor \
         WHERE DATE(jam) = CURRENT_DATE AND prefix = ? FOR UPDATE"
    )
    .bind(&prefix)
    .fetch_one(&mut *tx)
    .await
    .map_err(db_err)?;
    let nomor = next_no.to_string();

    // Kolom `loket` dikosongkan: petugas admisi yang menentukannya di DlgReg.
    sqlx::query(
        "INSERT INTO antripendaftaran_nomor (prefix, nomor, status, jam, loket) \
         VALUES (?, ?, '0', NOW(), '')"
    )
    .bind(&prefix)
    .bind(&nomor)
    .execute(&mut *tx)
    .await
    .map_err(db_err)?;

    let (sisa,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM antripendaftaran_nomor \
         WHERE status = '0' AND DATE(jam) = CURRENT_DATE AND prefix = ?"
    )
    .bind(&prefix)
    .fetch_one(&mut *tx)
    .await
    .map_err(db_err)?;

    tx.commit().await.map_err(db_err)?;

    crate::audit::log_sql(&state.pool, "web", &format!(
        "INSERT INTO antripendaftaran_nomor (prefix, nomor, status, jam, loket) VALUES ({}, {}, '0', NOW(), '')",
        crate::audit::q(&prefix), crate::audit::q(&nomor)
    )).await;

    let jam = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    Ok(Json(AmbilTiketResp { prefix, nomor, jam, sisa }))
}

#[derive(Serialize)]
pub struct StatusAntrianResp {
    /// Untuk ?prefix=X: milik layanan itu. Tanpa prefix: nilai tertinggi/total.
    pub nomor_terakhir: String,
    pub sisa:           i64,
    pub per_layanan:    Vec<RekapLayanan>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct PanggilanDipanggil {
    pub prefix: String,
    pub nomor:  String,
    pub loket:  String,
    pub jam:    chrono::NaiveDateTime,
}

/// Rekap satu layanan (prefix) untuk hari ini.
#[derive(Serialize, sqlx::FromRow, Clone)]
pub struct RekapLayanan {
    pub prefix:         String,
    /// Nomor terakhir yang SUDAH diambil (0 kalau belum ada).
    pub nomor_terakhir: i64,
    /// Jumlah tiket yang belum dipanggil (status '0').
    pub menunggu:       i64,
}

#[derive(Serialize)]
pub struct DisplayResp {
    pub sekarang: Option<PanggilanDipanggil>,
    pub riwayat:  Vec<PanggilanDipanggil>,
    /// Total seluruh layanan — dipertahankan untuk klien lama.
    pub menunggu: i64,
    /// Rincian per layanan (A/B/C), selalu memuat ketiganya walau nol.
    pub per_layanan: Vec<RekapLayanan>,
}

/// Layanan yang selalu ditampilkan walaupun belum ada tiket hari ini.
const PREFIX_LAYANAN: [&str; 3] = ["A", "B", "C"];

/// Rekap per prefix untuk hari ini. Prefix yang belum punya tiket tetap
/// dikembalikan dengan nilai 0 supaya tampilan tidak berubah-ubah jumlah kolom.
async fn rekap_per_layanan(pool: &sqlx::MySqlPool) -> Result<Vec<RekapLayanan>, sqlx::Error> {
    let baris: Vec<RekapLayanan> = sqlx::query_as(
        "SELECT prefix, \
                CAST(IFNULL(MAX(CAST(nomor AS UNSIGNED)),0) AS SIGNED) AS nomor_terakhir, \
                CAST(SUM(status='0') AS SIGNED) AS menunggu \
           FROM antripendaftaran_nomor \
          WHERE DATE(jam) = CURRENT_DATE \
          GROUP BY prefix"
    )
    .fetch_all(pool)
    .await?;

    Ok(PREFIX_LAYANAN
        .iter()
        .map(|p| {
            baris
                .iter()
                .find(|r| r.prefix == *p)
                .cloned()
                .unwrap_or(RekapLayanan { prefix: p.to_string(), nomor_terakhir: 0, menunggu: 0 })
        })
        .collect())
}

pub async fn display_antrian(
    State(state): State<AppState>,
) -> Result<Json<DisplayResp>, (StatusCode, Json<Value>)> {
    let riwayat: Vec<PanggilanDipanggil> = sqlx::query_as(
        "SELECT prefix, nomor, loket, jam FROM antripendaftaran_nomor \
         WHERE status = '1' AND DATE(jam) = CURRENT_DATE \
         ORDER BY jam DESC LIMIT 5"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    let per_layanan = rekap_per_layanan(&state.pool).await.map_err(db_err)?;
    let menunggu: i64 = per_layanan.iter().map(|r| r.menunggu).sum();

    let sekarang = riwayat.first().map(|p| PanggilanDipanggil {
        prefix: p.prefix.clone(),
        nomor:  p.nomor.clone(),
        loket:  p.loket.clone(),
        jam:    p.jam,
    });

    let riwayat_lain = riwayat.into_iter().skip(1).collect();

    Ok(Json(DisplayResp { sekarang, riwayat: riwayat_lain, menunggu, per_layanan }))
}

#[derive(Deserialize)]
pub struct StatusAntrianQuery {
    /// Batasi ke satu layanan, mis. ?prefix=B. Kosong = rekap seluruh layanan.
    pub prefix: Option<String>,
}

pub async fn status_antrian(
    State(state): State<AppState>,
    Query(q): Query<StatusAntrianQuery>,
) -> Result<Json<StatusAntrianResp>, (StatusCode, Json<Value>)> {
    let per_layanan = rekap_per_layanan(&state.pool).await.map_err(db_err)?;

    // ?prefix=X → angka ringkas milik layanan itu; tanpa prefix → total.
    let (nomor_terakhir, sisa) = match q.prefix.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(p) => {
            let p = p.to_uppercase();
            per_layanan
                .iter()
                .find(|r| r.prefix == p)
                .map(|r| (r.nomor_terakhir, r.menunggu))
                .unwrap_or((0, 0))
        }
        None => (
            per_layanan.iter().map(|r| r.nomor_terakhir).max().unwrap_or(0),
            per_layanan.iter().map(|r| r.menunggu).sum(),
        ),
    };

    Ok(Json(StatusAntrianResp {
        nomor_terakhir: nomor_terakhir.to_string(),
        sisa,
        per_layanan,
    }))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error antrian: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal menyimpan tiket antrian"})))
}

// ── Push real-time pemanggilan antrian (dipanggil DlgReg via HTTP POST) ─────────

#[derive(Clone, Serialize, Debug)]
pub struct PanggilanEvent {
    pub prefix: String,
    pub nomor:  String,
    pub loket:  String,
    pub jam:    String,
}

#[derive(Deserialize)]
pub struct PushPanggilanReq {
    pub nomor: serde_json::Value, // DlgReg kirim integer, jadikan fleksibel
    pub loket: String,
    /// Opsional — klien lama (DlgReg yang belum diperbarui) tidak mengirimnya.
    /// Kalau kosong, display menampilkan nomor apa adanya tanpa huruf.
    #[serde(default)]
    pub prefix: Option<String>,
}

pub async fn push_panggilan(
    State(state): State<AppState>,
    Json(req): Json<PushPanggilanReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let nomor = match req.nomor {
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => s,
        _ => return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "nomor wajib"})))),
    };

    let evt = PanggilanEvent {
        prefix: req.prefix.unwrap_or_default().trim().to_uppercase(),
        nomor,
        loket:  req.loket,
        jam:    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    };

    // Broadcast — abaikan error kalau tidak ada subscriber
    let _ = state.panggilan_tx.send(evt.clone());
    tracing::info!("Pemanggilan antrian: {:?}", evt);

    Ok(Json(json!({"ok": true})))
}

pub async fn stream_panggilan(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.panggilan_tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|msg| async move {
        match msg {
            Ok(evt) => Event::default().json_data(&evt).ok().map(Ok),
            Err(_) => None, // lagged subscriber — skip
        }
    });
    Sse::new(stream).keep_alive(KeepAlive::default())
}

// ── Panggilan antrian farmasi (penyerahan obat — dipanggil DlgDaftarPermintaanResep) ──

#[derive(Clone, Serialize, Debug)]
pub struct FarmasiPanggilanEvent {
    pub no_resep:     String,
    pub no_rawat:     String,
    pub no_rkm_medis: String,
    pub nama:         String,
    pub jam:          String,
    /// "penyerahan" (panggil pasien) atau "validasi" (masuk daftar disiapkan)
    pub jenis:        String,
    /// 1 = resep racikan, 0 = non-racikan
    #[serde(default)]
    pub racikan:      i8,
}

fn default_jenis() -> String { "penyerahan".to_string() }

#[derive(Deserialize)]
pub struct PushPanggilanFarmasiReq {
    pub no_resep: String,
    #[serde(default)]
    pub no_rawat: String,
    #[serde(default = "default_jenis")]
    pub jenis: String,
}

pub async fn push_panggilan_farmasi(
    State(state): State<AppState>,
    Json(req): Json<PushPanggilanFarmasiReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if req.no_resep.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "no_resep wajib"}))));
    }

    // Display farmasi hanya untuk RAWAT JALAN — resep ranap tidak dibroadcast.
    let status_resep: String = sqlx::query_scalar("SELECT IFNULL(status,'') FROM resep_obat WHERE no_resep = ?")
        .bind(&req.no_resep).fetch_optional(&state.pool).await.map_err(db_err)?.unwrap_or_default();
    if status_resep.eq_ignore_ascii_case("ranap") {
        return Ok(Json(json!({"ok": true, "skipped": "ranap"})));
    }

    // Resolve identitas pasien dari no_rawat (fallback: lewat resep_obat kalau
    // Java hanya mengirim no_resep)
    let no_rawat = if req.no_rawat.trim().is_empty() {
        sqlx::query_as::<_, (String,)>(
            "SELECT no_rawat FROM resep_obat WHERE no_resep = ?"
        )
        .bind(&req.no_resep)
        .fetch_optional(&state.pool)
        .await
        .map_err(db_err)?
        .map(|r| r.0)
        .unwrap_or_default()
    } else {
        req.no_rawat.clone()
    };

    let pasien = sqlx::query_as::<_, (String, String)>(
        "SELECT pasien.no_rkm_medis, pasien.nm_pasien \
         FROM reg_periksa \
         INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis \
         WHERE reg_periksa.no_rawat = ?"
    )
    .bind(&no_rawat)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;

    let (no_rkm_medis, nama) = pasien.unwrap_or_default();

    // Racikan bila resep punya baris di resep_dokter_racikan
    let racikan: i8 = sqlx::query_as::<_, (i8,)>(
        "SELECT EXISTS(SELECT 1 FROM resep_dokter_racikan WHERE no_resep = ?)"
    ).bind(&req.no_resep).fetch_optional(&state.pool).await.ok().flatten().map(|r| r.0).unwrap_or(0);

    let jenis = if req.jenis == "validasi" { "validasi" } else { "penyerahan" };
    let evt = FarmasiPanggilanEvent {
        no_resep: req.no_resep,
        no_rawat,
        no_rkm_medis,
        nama,
        jam: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        jenis: jenis.to_string(),
        racikan,
    };

    // Broadcast — abaikan error kalau tidak ada subscriber
    let _ = state.farmasi_tx.send(evt.clone());
    tracing::info!("Pemanggilan antrian farmasi: {:?}", evt);

    Ok(Json(json!({"ok": true})))
}

// ── Self-service ambil tiket antrian farmasi (kiosk simrscb) ────────────────
// Pasien memasukkan No.RM / No.KTP / No.BPJS → dicari resep rawat jalan hari ini
// yang belum diserahkan → nomor tiket = 4 digit belakang no_resep (sama dengan
// TiketAntrianFarmasi desktop). Tidak membuat antrean baru — tiket diturunkan
// dari no_resep supaya konsisten dengan pemanggilan penyerahan obat.
#[derive(Deserialize)]
pub struct TiketFarmasiReq {
    pub jenis: String, // "rm" | "ktp" | "bpjs"
    pub nilai: String,
}
#[derive(Serialize)]
pub struct TiketFarmasiResp {
    pub no_antrian:   String,
    pub no_resep:     String,
    pub no_rkm_medis: String,
    pub nama:         String,
    pub nm_poli:      String,
    pub nm_dokter:    String,
    pub tanggal:      String,
    pub jam:          String,
}
pub async fn ambil_tiket_farmasi(
    State(state): State<AppState>,
    Json(req): Json<TiketFarmasiReq>,
) -> Result<Json<TiketFarmasiResp>, (StatusCode, Json<Value>)> {
    let nilai = req.nilai.trim().to_string();
    if nilai.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Masukkan No. RM / No. KTP / No. BPJS."}))));
    }
    // Resolve no_rkm_medis
    let no_rm: String = match req.jenis.as_str() {
        "rm" => nilai.clone(),
        "ktp" => sqlx::query_scalar("SELECT no_rkm_medis FROM pasien WHERE no_ktp=? LIMIT 1")
            .bind(&nilai).fetch_optional(&state.pool).await.map_err(db_err)?.unwrap_or_default(),
        "bpjs" => sqlx::query_scalar("SELECT no_rkm_medis FROM pasien WHERE no_peserta=? LIMIT 1")
            .bind(&nilai).fetch_optional(&state.pool).await.map_err(db_err)?.unwrap_or_default(),
        _ => return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Jenis pencarian tidak dikenal."})))),
    };
    if no_rm.trim().is_empty() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Pasien tidak ditemukan. Periksa kembali No. RM / KTP / BPJS."}))));
    }
    // Resep rawat jalan hari ini yang belum diserahkan (terbaru)
    let row = sqlx::query_as::<_, (String, String, String, String, String, String)>(
        "SELECT ro.no_resep, ps.nm_pasien, ps.no_rkm_medis, \
                IFNULL(po.nm_poli,'') nm_poli, IFNULL(dk.nm_dokter, ro.kd_dokter) nm_dokter, \
                DATE_FORMAT(ro.jam,'%H:%i') jam \
         FROM resep_obat ro \
         INNER JOIN reg_periksa rp ON rp.no_rawat = ro.no_rawat \
         INNER JOIN pasien ps ON ps.no_rkm_medis = rp.no_rkm_medis \
         LEFT JOIN poliklinik po ON po.kd_poli = rp.kd_poli \
         LEFT JOIN dokter dk ON dk.kd_dokter = ro.kd_dokter \
         WHERE ps.no_rkm_medis = ? AND ro.status = 'ralan' AND ro.tgl_perawatan = CURDATE() \
           AND (ro.tgl_penyerahan IS NULL OR ro.tgl_penyerahan = '0000-00-00') \
         ORDER BY ro.jam DESC LIMIT 1"
    )
    .bind(&no_rm)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;

    let Some((no_resep, nama, no_rkm_medis, nm_poli, nm_dokter, jam)) = row else {
        return Err((StatusCode::NOT_FOUND, Json(json!({
            "error": "Belum ada resep rawat jalan yang menunggu penyerahan obat hari ini untuk pasien ini."
        }))));
    };
    // Nomor tiket = 4 digit belakang no_resep
    let no_antrian = if no_resep.len() >= 4 { no_resep[no_resep.len() - 4..].to_string() } else { no_resep.clone() };
    let tanggal = chrono::Local::now().format("%Y-%m-%d").to_string();
    Ok(Json(TiketFarmasiResp { no_antrian, no_resep, no_rkm_medis, nama, nm_poli, nm_dokter, tanggal, jam }))
}

pub async fn stream_panggilan_farmasi(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.farmasi_tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|msg| async move {
        match msg {
            Ok(evt) => Event::default().json_data(&evt).ok().map(Ok),
            Err(_) => None, // lagged subscriber — skip
        }
    });
    Sse::new(stream).keep_alive(KeepAlive::default())
}

#[derive(Serialize, sqlx::FromRow, Clone)]
pub struct FarmasiPanggilan {
    pub no_resep:     String,
    pub no_rawat:     String,
    pub no_rkm_medis: String,
    pub nama:         String,
    pub jam:          String,
    #[sqlx(default)]
    pub racikan:      i8,
}

#[derive(Serialize)]
pub struct DisplayFarmasiResp {
    pub sekarang:      Option<FarmasiPanggilan>,
    pub riwayat:       Vec<FarmasiPanggilan>,
    pub menunggu:      i64,
    /// Resep tervalidasi hari ini yang belum diserahkan (sedang disiapkan),
    /// urut jam validasi — muncul saat tombol Validasi diklik.
    pub menunggu_list: Vec<FarmasiPanggilan>,
}

/// Data awal display TV farmasi: penyerahan terakhir hari ini + jumlah resep
/// yang sudah divalidasi tapi belum diserahkan (sedang disiapkan).
pub async fn display_farmasi(
    State(state): State<AppState>,
) -> Result<Json<DisplayFarmasiResp>, (StatusCode, Json<Value>)> {
    let riwayat: Vec<FarmasiPanggilan> = sqlx::query_as(
        "SELECT resep_obat.no_resep, resep_obat.no_rawat, pasien.no_rkm_medis, \
                pasien.nm_pasien AS nama, \
                IFNULL(CAST(resep_obat.jam_penyerahan AS CHAR), '') AS jam, \
                EXISTS(SELECT 1 FROM resep_dokter_racikan rr WHERE rr.no_resep = resep_obat.no_resep) AS racikan \
         FROM resep_obat \
         INNER JOIN reg_periksa ON resep_obat.no_rawat = reg_periksa.no_rawat \
         INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis \
         WHERE resep_obat.status = 'ralan' AND resep_obat.tgl_penyerahan = CURRENT_DATE \
         ORDER BY resep_obat.jam_penyerahan DESC LIMIT 5"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    // Resep rawat jalan yang sudah divalidasi hari ini tapi belum diserahkan
    let menunggu_list: Vec<FarmasiPanggilan> = sqlx::query_as(
        "SELECT resep_obat.no_resep, resep_obat.no_rawat, pasien.no_rkm_medis, \
                pasien.nm_pasien AS nama, \
                IFNULL(CAST(resep_obat.jam AS CHAR), '') AS jam, \
                EXISTS(SELECT 1 FROM resep_dokter_racikan rr WHERE rr.no_resep = resep_obat.no_resep) AS racikan \
         FROM resep_obat \
         INNER JOIN reg_periksa ON resep_obat.no_rawat = reg_periksa.no_rawat \
         INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis \
         WHERE resep_obat.status = 'ralan' \
           AND resep_obat.tgl_perawatan = CURRENT_DATE \
           AND resep_obat.tgl_penyerahan = '0000-00-00' \
         ORDER BY resep_obat.jam ASC LIMIT 30"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    let (menunggu,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM resep_obat \
         WHERE status = 'ralan' \
           AND tgl_perawatan = CURRENT_DATE AND tgl_penyerahan = '0000-00-00'"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    let sekarang = riwayat.first().cloned();
    let riwayat_lain = riwayat.into_iter().skip(1).collect();

    Ok(Json(DisplayFarmasiResp { sekarang, riwayat: riwayat_lain, menunggu, menunggu_list }))
}

// ── Panggilan antrian poli (menu "Antrian Masuk Poli" DlgKasirRalan) ────────
// Menggantikan API lama port 8085 (/api/poli/panggil) yang tidak ada pembacanya.

#[derive(Clone, Serialize, Debug)]
pub struct PoliPanggilanEvent {
    pub no_rawat:     String,
    pub no_rkm_medis: String,
    pub nama:         String,
    pub no_reg:       String,
    pub kd_poli:      String,
    pub nm_poli:      String,
    pub kd_dokter:    String,
    pub nm_dokter:    String,
    pub jam:          String,
}

#[derive(Deserialize)]
pub struct PushPanggilanPoliReq {
    pub no_rawat: String,
    #[serde(default)]
    pub kd_poli: String,
    #[serde(default)]
    pub kd_dokter: String,
}

pub async fn push_panggilan_poli(
    State(state): State<AppState>,
    Json(req): Json<PushPanggilanPoliReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if req.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "no_rawat wajib"}))));
    }

    let row = sqlx::query_as::<_, (String, String, String, String, String, String, String)>(
        "SELECT pasien.no_rkm_medis, pasien.nm_pasien, reg_periksa.no_reg, \
                reg_periksa.kd_poli, poliklinik.nm_poli, reg_periksa.kd_dokter, dokter.nm_dokter \
         FROM reg_periksa \
         INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis \
         INNER JOIN poliklinik ON reg_periksa.kd_poli = poliklinik.kd_poli \
         INNER JOIN dokter ON reg_periksa.kd_dokter = dokter.kd_dokter \
         WHERE reg_periksa.no_rawat = ?"
    )
    .bind(&req.no_rawat)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;

    let (no_rkm_medis, nama, no_reg, kd_poli, nm_poli, kd_dokter, nm_dokter) =
        row.unwrap_or((String::new(), String::new(), String::new(),
                       req.kd_poli.clone(), String::new(), req.kd_dokter.clone(), String::new()));

    let evt = PoliPanggilanEvent {
        no_rawat: req.no_rawat,
        no_rkm_medis,
        nama,
        no_reg,
        kd_poli,
        nm_poli,
        kd_dokter,
        nm_dokter,
        jam: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    };

    let _ = state.poli_tx.send(evt.clone());
    tracing::info!("Pemanggilan antrian poli: {:?}", evt);

    Ok(Json(json!({"ok": true})))
}

pub async fn stream_panggilan_poli(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.poli_tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|msg| async move {
        match msg {
            Ok(evt) => Event::default().json_data(&evt).ok().map(Ok),
            Err(_) => None, // lagged subscriber — skip
        }
    });
    Sse::new(stream).keep_alive(KeepAlive::default())
}

#[derive(Serialize, sqlx::FromRow, Clone)]
pub struct PoliAntri {
    pub no_rawat:     String,
    pub no_rkm_medis: String,
    pub nama:         String,
    pub no_reg:       String,
}

#[derive(Serialize)]
pub struct DisplayPoliResp {
    pub nm_poli:       String,
    /// Pasien yang terakhir dipanggil masuk (dari tabel antripoli)
    pub sekarang:      Option<PoliAntri>,
    pub menunggu:      i64,
    /// Pasien terdaftar hari ini yang belum dilayani, urut no_reg
    pub menunggu_list: Vec<PoliAntri>,
}

pub async fn display_poli(
    State(state): State<AppState>,
    Path(kd_poli): Path<String>,
) -> Result<Json<DisplayPoliResp>, (StatusCode, Json<Value>)> {
    let nm_poli: Option<String> = sqlx::query_scalar(
        "SELECT nm_poli FROM poliklinik WHERE kd_poli = ?"
    )
    .bind(&kd_poli)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;

    let sekarang: Option<PoliAntri> = sqlx::query_as(
        "SELECT antripoli.no_rawat, pasien.no_rkm_medis, pasien.nm_pasien AS nama, \
                reg_periksa.no_reg \
         FROM antripoli \
         INNER JOIN reg_periksa ON antripoli.no_rawat = reg_periksa.no_rawat \
         INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis \
         WHERE antripoli.kd_poli = ? LIMIT 1"
    )
    .bind(&kd_poli)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;

    let menunggu_list: Vec<PoliAntri> = sqlx::query_as(
        "SELECT reg_periksa.no_rawat, pasien.no_rkm_medis, pasien.nm_pasien AS nama, \
                reg_periksa.no_reg \
         FROM reg_periksa \
         INNER JOIN pasien ON reg_periksa.no_rkm_medis = pasien.no_rkm_medis \
         WHERE reg_periksa.kd_poli = ? \
           AND reg_periksa.tgl_registrasi = CURRENT_DATE \
           AND reg_periksa.stts = 'Belum' \
         ORDER BY reg_periksa.no_reg ASC LIMIT 30"
    )
    .bind(&kd_poli)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    let (menunggu,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM reg_periksa \
         WHERE kd_poli = ? AND tgl_registrasi = CURRENT_DATE AND stts = 'Belum'"
    )
    .bind(&kd_poli)
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(DisplayPoliResp {
        nm_poli: nm_poli.unwrap_or_else(|| kd_poli.clone()),
        sekarang,
        menunggu,
        menunggu_list,
    }))
}

// ── Mapping display poli (banyak display, tiap display punya set poli) ──────
// Disimpan sebagai JSON array di simrscb_anjungan_config key 'poli_display_map'.
// Bentuk: [{"id","nama","poli":[..],"youtube","ticker"}]

pub async fn get_poli_map(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Public — display TV resolve saat mount
    let raw = cfg_get(&state.pool, "poli_display_map").await?;
    let parsed: Value = serde_json::from_str(&raw).unwrap_or_else(|_| json!([]));
    Ok(Json(parsed))
}

#[derive(Deserialize)]
pub struct PutPoliMapBody {
    pub map: Value, // array of display objects
}

pub async fn put_poli_map(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<PutPoliMapBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Hanya admin yang bisa akses"}))));
    }
    if !b.map.is_array() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "map harus array"}))));
    }
    let kode = user.0.kode.clone();
    let raw = serde_json::to_string(&b.map).unwrap_or_else(|_| "[]".to_string());

    sqlx::query(
        "INSERT INTO simrscb_anjungan_config (cfg_key, cfg_value, updated_by) \
         VALUES ('poli_display_map', ?, ?) \
         ON DUPLICATE KEY UPDATE cfg_value=VALUES(cfg_value), updated_by=VALUES(updated_by)"
    )
    .bind(&raw)
    .bind(&kode)
    .execute(&state.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(json!({"ok": true})))
}

// ── Config display farmasi (link YouTube, ticker, nama loket) ───────────────
// Disimpan di simrscb_anjungan_config dengan prefix cfg_key "farmasi_display_".

#[derive(Serialize)]
pub struct FarmasiConfigResp {
    pub youtube: String,
    pub ticker:  String,
    pub loket:   String,
}

async fn cfg_get(pool: &sqlx::MySqlPool, key: &str) -> Result<String, (StatusCode, Json<Value>)> {
    let v: Option<String> = sqlx::query_scalar(
        "SELECT cfg_value FROM simrscb_anjungan_config WHERE cfg_key = ?"
    )
    .bind(key)
    .fetch_optional(pool)
    .await
    .map_err(db_err)?;
    Ok(v.unwrap_or_default())
}

pub async fn get_farmasi_config(
    State(state): State<AppState>,
) -> Result<Json<FarmasiConfigResp>, (StatusCode, Json<Value>)> {
    // Public — display TV baca saat mount + tiap polling
    Ok(Json(FarmasiConfigResp {
        youtube: cfg_get(&state.pool, "farmasi_display_youtube").await?,
        ticker:  cfg_get(&state.pool, "farmasi_display_ticker").await?,
        loket:   cfg_get(&state.pool, "farmasi_display_loket").await?,
    }))
}

#[derive(Deserialize)]
pub struct PutFarmasiConfigBody {
    pub youtube: Option<String>,
    pub ticker:  Option<String>,
    pub loket:   Option<String>,
}

pub async fn put_farmasi_config(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<PutFarmasiConfigBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Hanya admin yang bisa akses"}))));
    }
    let kode = user.0.kode.clone();

    let pairs = [
        ("farmasi_display_youtube", b.youtube),
        ("farmasi_display_ticker",  b.ticker),
        ("farmasi_display_loket",   b.loket),
    ];
    for (key, val) in pairs {
        if let Some(v) = val {
            sqlx::query(
                "INSERT INTO simrscb_anjungan_config (cfg_key, cfg_value, updated_by) \
                 VALUES (?, ?, ?) \
                 ON DUPLICATE KEY UPDATE cfg_value=VALUES(cfg_value), updated_by=VALUES(updated_by)"
            )
            .bind(key)
            .bind(v.trim())
            .bind(&kode)
            .execute(&state.pool)
            .await
            .map_err(db_err)?;
        }
    }

    Ok(Json(json!({"ok": true})))
}

// ── Config display antrian PENDAFTARAN (link YouTube, ticker, keterangan loket) ──
// Disimpan di simrscb_anjungan_config dengan prefix cfg_key "pendaftaran_display_".
// Bentuk sama dgn farmasi (youtube/ticker/loket) — `loket` = keterangan legenda
// loket, format "1:Pendaftaran Pasien Baru|2:Rawat Jalan|3:Poli Rawat Inap".

pub async fn get_pendaftaran_config(
    State(state): State<AppState>,
) -> Result<Json<FarmasiConfigResp>, (StatusCode, Json<Value>)> {
    // Public — display TV baca saat mount + tiap polling
    Ok(Json(FarmasiConfigResp {
        youtube: cfg_get(&state.pool, "pendaftaran_display_youtube").await?,
        ticker:  cfg_get(&state.pool, "pendaftaran_display_ticker").await?,
        loket:   cfg_get(&state.pool, "pendaftaran_display_loket").await?,
    }))
}

pub async fn put_pendaftaran_config(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<PutFarmasiConfigBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Hanya admin yang bisa akses"}))));
    }
    let kode = user.0.kode.clone();

    let pairs = [
        ("pendaftaran_display_youtube", b.youtube),
        ("pendaftaran_display_ticker",  b.ticker),
        ("pendaftaran_display_loket",   b.loket),
    ];
    for (key, val) in pairs {
        if let Some(v) = val {
            sqlx::query(
                "INSERT INTO simrscb_anjungan_config (cfg_key, cfg_value, updated_by) \
                 VALUES (?, ?, ?) \
                 ON DUPLICATE KEY UPDATE cfg_value=VALUES(cfg_value), updated_by=VALUES(updated_by)"
            )
            .bind(key)
            .bind(v.trim())
            .bind(&kode)
            .execute(&state.pool)
            .await
            .map_err(db_err)?;
        }
    }

    Ok(Json(json!({"ok": true})))
}

// ── Display JADWAL PRAKTEK DOKTER (public, tanpa auth) ───────────────────────
// Semua jadwal (7 hari) join dokter + poliklinik. Frontend memutar jadi grid
// mingguan sehingga jadwal hari lain juga terlihat (permintaan BPJS).
// TIME_FORMAT → string, hindari masalah decode TIME.
#[derive(Serialize, sqlx::FromRow)]
pub struct JadwalDokterRow {
    pub kd_dokter:   String,
    pub nm_dokter:   String,
    pub kd_poli:     String,
    pub nm_poli:     String,
    pub hari_kerja:  String,
    pub jam_mulai:   Option<String>,
    pub jam_selesai: Option<String>,
    pub kuota:       Option<i32>,
}

pub async fn jadwal_dokter_display(
    State(state): State<AppState>,
) -> Result<Json<Vec<JadwalDokterRow>>, (StatusCode, Json<Value>)> {
    let rows = sqlx::query_as::<_, JadwalDokterRow>(
        "SELECT d.kd_dokter, d.nm_dokter, j.kd_poli, p.nm_poli, j.hari_kerja, \
                TIME_FORMAT(j.jam_mulai, '%H:%i')   AS jam_mulai, \
                TIME_FORMAT(j.jam_selesai, '%H:%i') AS jam_selesai, \
                j.kuota \
         FROM jadwal j \
         JOIN dokter d ON d.kd_dokter = j.kd_dokter \
         JOIN poliklinik p ON p.kd_poli = j.kd_poli \
         ORDER BY p.nm_poli, d.nm_dokter, \
                  FIELD(j.hari_kerja,'SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU','AKHAD')"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;
    Ok(Json(rows))
}
