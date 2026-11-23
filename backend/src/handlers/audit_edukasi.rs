// Rekap Audit Edukasi Terintegrasi PPA (per pasien/NORM).
// Sumber:
//   - materi_edukasi_pasien_keluarga_rscb : baris pelaksanaan edukasi tiap PPA (Lembar Terintegrasi)
//   - edukasi_pasien_keluarga_rscb        : header pengkajian kebutuhan (flag keb_rujukan dll)
//   - edukasipasien_ttd                   : tanda tangan pasien/keluarga (gambar)
//   - transfer_pasien_antar_ruang         : deteksi pasien pernah transfer (untuk logika NA)
//   - audit_edukasi_terintegrasi_rscb     : catatan auditor klinis (input baru)
//
// Pemetaan 6 item audit:
//   1. Keterisian Lembar Edukasi Terintegrasi PPA (Ya/Tidak) -> ada baris materi
//   2. Verifikasi Teach-Back / Pemahaman (Ya/Tidak)          -> hasil_verifikasi terisi semua baris
//   3. Kelengkapan TTD Pasien & Nakes (Ya/Tidak)             -> ada TTD pasien + nip nakes terisi
//   4. Edukasi Transfer Antarruang (Ya/Tidak/NA)             -> materi menyebut "transfer";
//                                                               NA bila pasien tak pernah transfer
//   5. Edukasi Rujukan (Ya/Tidak/NA)                         -> flag keb_rujukan header; NA bila header (-)
//   6. Keterangan & Catatan Auditor Klinis                   -> input auditor (tabel audit_...)

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB audit_edukasi: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data audit edukasi"})))
}

#[derive(Deserialize)]
pub struct RangeQuery {
    pub tgl_awal: String,
    pub tgl_akhir: String,
}

#[derive(sqlx::FromRow)]
struct Raw {
    no_rawat: String,
    norm: String,
    nm_pasien: String,
    tgl: String,
    cnt_materi: i64,
    cnt_verif: i64,
    cnt_nakes: i64,
    cnt_ttd: i64,
    cnt_transfer_edu: i64,
    cnt_transfer: i64,
    keb_rujukan: Option<String>,
    catatan: Option<String>,
}

const SQL: &str = "\
SELECT c.no_rawat, \
       IFNULL(rp.no_rkm_medis,'') norm, \
       IFNULL(ps.nm_pasien,'') nm_pasien, \
       CAST(c.tgl AS CHAR) tgl, \
       (SELECT COUNT(*) FROM materi_edukasi_pasien_keluarga_rscb m WHERE m.no_rawat=c.no_rawat) cnt_materi, \
       (SELECT COUNT(*) FROM materi_edukasi_pasien_keluarga_rscb m WHERE m.no_rawat=c.no_rawat AND IFNULL(m.hasil_verifikasi,'')<>'') cnt_verif, \
       (SELECT COUNT(*) FROM materi_edukasi_pasien_keluarga_rscb m WHERE m.no_rawat=c.no_rawat AND IFNULL(m.nip,'')<>'') cnt_nakes, \
       (SELECT COUNT(*) FROM edukasipasien_ttd t WHERE t.no_rawat=c.no_rawat) cnt_ttd, \
       (SELECT COUNT(*) FROM materi_edukasi_pasien_keluarga_rscb m WHERE m.no_rawat=c.no_rawat AND m.materi_edukasi LIKE '%transfer%') cnt_transfer_edu, \
       (SELECT COUNT(*) FROM transfer_pasien_antar_ruang tr WHERE tr.no_rawat=c.no_rawat) cnt_transfer, \
       (SELECT h.keb_rujukan FROM edukasi_pasien_keluarga_rscb h WHERE h.no_rawat=c.no_rawat ORDER BY h.tanggal DESC LIMIT 1) keb_rujukan, \
       (SELECT a.catatan FROM audit_edukasi_terintegrasi_rscb a WHERE a.no_rawat=c.no_rawat) catatan \
FROM ( \
  SELECT no_rawat, MIN(tgl) tgl FROM ( \
    SELECT no_rawat, tanggal tgl FROM edukasi_pasien_keluarga_rscb WHERE DATE(tanggal) BETWEEN ? AND ? \
    UNION ALL \
    SELECT no_rawat, tanggal tgl FROM materi_edukasi_pasien_keluarga_rscb WHERE DATE(tanggal) BETWEEN ? AND ? \
  ) u GROUP BY no_rawat \
) c \
LEFT JOIN reg_periksa rp ON rp.no_rawat=c.no_rawat \
LEFT JOIN pasien ps ON ps.no_rkm_medis=rp.no_rkm_medis \
ORDER BY c.tgl DESC";

pub async fn rekap(
    _u: AuthUser,
    State(s): State<AppState>,
    Query(q): Query<RangeQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if q.tgl_awal.trim().is_empty() || q.tgl_akhir.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Tanggal awal & akhir wajib"}))));
    }
    let rows: Vec<Raw> = sqlx::query_as::<_, Raw>(SQL)
        .bind(&q.tgl_awal).bind(&q.tgl_akhir)
        .bind(&q.tgl_awal).bind(&q.tgl_akhir)
        .fetch_all(&s.pool).await.map_err(db_err)?;

    // Hitung ringkasan (jumlah "Ya" per item, dari populasi non-NA untuk item ber-NA).
    let mut n = 0i64;
    let (mut ya1, mut ya2, mut ya3, mut ya4, mut den4, mut ya5, mut den5) =
        (0i64, 0i64, 0i64, 0i64, 0i64, 0i64, 0i64);

    let detail: Vec<Value> = rows.iter().map(|r| {
        n += 1;
        let lembar = r.cnt_materi > 0;
        let teach = r.cnt_materi > 0 && r.cnt_verif == r.cnt_materi;
        let ttd = r.cnt_ttd > 0 && r.cnt_nakes > 0;
        // Transfer: NA bila tak pernah transfer
        let transfer = if r.cnt_transfer == 0 { "NA" }
                       else if r.cnt_transfer_edu > 0 { "Ya" } else { "Tidak" };
        // Rujukan: dari flag keb_rujukan; NA bila header tak ada
        let rujukan = match r.keb_rujukan.as_deref() {
            None => "NA",
            Some(v) if v.trim().is_empty() => "NA",
            Some("Ya") => "Ya",
            Some(_) => "Tidak",
        };
        if lembar { ya1 += 1; }
        if teach { ya2 += 1; }
        if ttd { ya3 += 1; }
        if transfer != "NA" { den4 += 1; if transfer == "Ya" { ya4 += 1; } }
        if rujukan != "NA" { den5 += 1; if rujukan == "Ya" { ya5 += 1; } }

        json!({
            "no_rawat": r.no_rawat,
            "norm": r.norm,
            "nm_pasien": r.nm_pasien,
            "tgl": r.tgl,
            "lembar_terisi": if lembar { "Ya" } else { "Tidak" },
            "teach_back":    if teach { "Ya" } else { "Tidak" },
            "ttd_lengkap":   if ttd { "Ya" } else { "Tidak" },
            "edukasi_transfer": transfer,
            "edukasi_rujukan":  rujukan,
            "catatan_auditor":  r.catatan.clone().unwrap_or_default(),
            "jml_materi": r.cnt_materi,
        })
    }).collect();

    Ok(Json(json!({
        "ringkasan": {
            "pasien": n,
            "lembar_ya": ya1, "teach_ya": ya2, "ttd_ya": ya3,
            "transfer_ya": ya4, "transfer_dari": den4,
            "rujukan_ya": ya5, "rujukan_dari": den5,
        },
        "detail": detail
    })))
}

#[derive(Deserialize)]
pub struct CatatanBody {
    pub no_rawat: String,
    #[serde(default)]
    pub catatan: String,
}

pub async fn simpan_catatan(
    u: AuthUser,
    State(s): State<AppState>,
    Json(b): Json<CatatanBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "no_rawat wajib"}))));
    }
    sqlx::query(
        "INSERT INTO audit_edukasi_terintegrasi_rscb (no_rawat, catatan, nik, tgl_audit) \
         VALUES (?, ?, ?, NOW()) \
         ON DUPLICATE KEY UPDATE catatan=VALUES(catatan), nik=VALUES(nik), tgl_audit=NOW()",
    )
    .bind(&b.no_rawat)
    .bind(b.catatan.trim())
    .bind(&u.0.kode)
    .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
