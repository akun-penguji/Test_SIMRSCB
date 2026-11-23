// PTO — Pemantauan Terapi Obat (formulir apoteker, sesuai form fisik RM).
//
// Satu lembar form = satu baris pemantauan_terapi_obat_rscb dengan PK
// (no_rawat, tanggal) + tiga tabel detail berulang:
//   pto_riwayat_obat_rscb     → "Riwayat Penggunaan Obat"
//   pto_penunjang_rscb        → "Hasil Pemeriksaan Penunjang"
//   pto_obat_saat_ini_rscb    → "Penggunaan Obat Saat Ini"
//
// Endpoint /pto/awal menarik data yang sudah ada di Khanza (identitas, ruangan,
// DPJP, BB/TB, alergi, resep berjalan, hasil lab) supaya apoteker tidak
// mengetik ulang. Edit/hapus owner-only (kolom nip) seperti form e-Nakes lain.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB pto: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data PTO"})))
}

#[derive(Deserialize)]
pub struct NoRawatQ { pub no_rawat: String }
#[derive(Deserialize)]
pub struct DetailQ { pub no_rawat: String, pub tanggal: String }

fn norm_dt(s: &str) -> Option<String> {
    let s = s.trim();
    if s.is_empty() { return None; }
    let s = s.replace('T', " ");
    Some(if s.len() == 16 { format!("{}:00", s) } else { s })
}
// String kosong → NULL (kolom DATE tidak boleh diisi '' pada strict mode).
fn or_null(s: &str) -> Option<String> {
    let s = s.trim();
    if s.is_empty() { None } else { Some(s.to_string()) }
}

// ── GET /pto/awal — prefill dari data Khanza ─────────────────────────────────
#[derive(sqlx::FromRow)]
struct AwalPasien {
    no_rkm_medis: String, nm_pasien: String, jk: String, tgl_lahir: String,
    umur: String, dpjp: String, tgl_registrasi: String,
}
#[derive(Serialize, sqlx::FromRow)]
pub struct ObatResep { pub tgl_mulai_terapi: String, pub nama_obat: String, pub rejimen: String }
#[derive(Serialize, sqlx::FromRow)]
pub struct HasilLab {
    pub tgl_pemeriksaan: String, pub nama_pemeriksaan: String,
    pub hasil: String, pub satuan: String, pub nilai_rujukan: String,
}
pub async fn awal(user: AuthUser, State(s): State<AppState>, Query(q): Query<NoRawatQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let pas: Option<AwalPasien> = sqlx::query_as(
        "SELECT p.no_rkm_medis, p.nm_pasien, IF(p.jk='L','Laki-laki','Perempuan') jk, \
                DATE_FORMAT(p.tgl_lahir,'%d-%m-%Y') tgl_lahir, CONCAT(r.umurdaftar,' ',r.sttsumur) umur, \
                IFNULL(d.nm_dokter,'') dpjp, CAST(r.tgl_registrasi AS CHAR) tgl_registrasi \
         FROM reg_periksa r JOIN pasien p ON p.no_rkm_medis=r.no_rkm_medis \
         LEFT JOIN dokter d ON d.kd_dokter=r.kd_dokter WHERE r.no_rawat=? LIMIT 1")
        .bind(&q.no_rawat).fetch_optional(&s.pool).await.map_err(db_err)?;

    // Ruangan & tgl masuk: bangsal terakhir (ranap), fallback poliklinik (ralan).
    let kamar: Option<(String, String)> = sqlx::query_as(
        "SELECT IFNULL(b.nm_bangsal,''), CAST(ki.tgl_masuk AS CHAR) \
         FROM kamar_inap ki JOIN kamar k ON k.kd_kamar=ki.kd_kamar \
         LEFT JOIN bangsal b ON b.kd_bangsal=k.kd_bangsal \
         WHERE ki.no_rawat=? ORDER BY ki.tgl_masuk DESC, ki.jam_masuk DESC LIMIT 1")
        .bind(&q.no_rawat).fetch_optional(&s.pool).await.map_err(db_err)?;
    let poli: Option<(String,)> = if kamar.is_none() {
        sqlx::query_as("SELECT IFNULL(pk.nm_poli,'') FROM reg_periksa r LEFT JOIN poliklinik pk ON pk.kd_poli=r.kd_poli WHERE r.no_rawat=? LIMIT 1")
            .bind(&q.no_rawat).fetch_optional(&s.pool).await.map_err(db_err)?
    } else { None };

    // BB / TB / alergi dari pemeriksaan terakhir (ranap dulu, lalu ralan).
    #[derive(sqlx::FromRow)]
    struct Ttv { berat: String, tinggi: String, alergi: String }
    let ttv: Option<Ttv> = sqlx::query_as(
        "SELECT IFNULL(berat,'') berat, IFNULL(tinggi,'') tinggi, IFNULL(alergi,'') alergi FROM ( \
            SELECT berat, tinggi, alergi, tgl_perawatan, jam_rawat FROM pemeriksaan_ranap WHERE no_rawat=? \
            UNION ALL \
            SELECT berat, tinggi, alergi, tgl_perawatan, jam_rawat FROM pemeriksaan_ralan WHERE no_rawat=? \
         ) x ORDER BY tgl_perawatan DESC, jam_rawat DESC LIMIT 1")
        .bind(&q.no_rawat).bind(&q.no_rawat).fetch_optional(&s.pool).await.map_err(db_err)?;

    // Obat yang sedang berjalan (resep dokter, non-racikan).
    let obat: Vec<ObatResep> = sqlx::query_as(
        "SELECT CAST(ro.tgl_peresepan AS CHAR) tgl_mulai_terapi, IFNULL(db.nama_brng,rd.kode_brng) nama_obat, \
                IFNULL(rd.aturan_pakai,'') rejimen \
         FROM resep_obat ro JOIN resep_dokter rd ON rd.no_resep=ro.no_resep \
         LEFT JOIN databarang db ON db.kode_brng=rd.kode_brng \
         WHERE ro.no_rawat=? ORDER BY ro.tgl_peresepan DESC, ro.jam_peresepan DESC LIMIT 40")
        .bind(&q.no_rawat).fetch_all(&s.pool).await.map_err(db_err)?;

    // Hasil lab terakhir.
    let lab: Vec<HasilLab> = sqlx::query_as(
        "SELECT CAST(dpl.tgl_periksa AS CHAR) tgl_pemeriksaan, IFNULL(tl.Pemeriksaan,'') nama_pemeriksaan, \
                IFNULL(dpl.nilai,'') hasil, IFNULL(tl.satuan,'') satuan, IFNULL(dpl.nilai_rujukan,'') nilai_rujukan \
         FROM detail_periksa_lab dpl \
         LEFT JOIN template_laboratorium tl ON tl.id_template=dpl.id_template \
         WHERE dpl.no_rawat=? AND IFNULL(dpl.nilai,'')<>'' \
         ORDER BY dpl.tgl_periksa DESC, dpl.jam DESC LIMIT 40")
        .bind(&q.no_rawat).fetch_all(&s.pool).await.map_err(db_err)?;

    let apoteker: Option<(String,)> = sqlx::query_as("SELECT nama FROM pegawai WHERE nik=? LIMIT 1")
        .bind(&user.0.kode).fetch_optional(&s.pool).await.map_err(db_err)?;

    Ok(Json(json!({
        "pasien": pas.as_ref().map(|p| json!({
            "no_rkm_medis": p.no_rkm_medis, "nama": p.nm_pasien, "jk": p.jk,
            "tgl_lahir": p.tgl_lahir, "umur": p.umur })),
        "ruangan": kamar.as_ref().map(|k| k.0.clone())
            .or_else(|| poli.as_ref().map(|p| p.0.clone())).unwrap_or_default(),
        "tgl_masuk": kamar.as_ref().map(|k| k.1.clone())
            .or_else(|| pas.as_ref().map(|p| p.tgl_registrasi.clone())).unwrap_or_default(),
        "dpjp": pas.as_ref().map(|p| p.dpjp.clone()).unwrap_or_default(),
        "bb": ttv.as_ref().map(|t| t.berat.clone()).unwrap_or_default(),
        "tb": ttv.as_ref().map(|t| t.tinggi.clone()).unwrap_or_default(),
        "alergi_obat": ttv.as_ref().map(|t| t.alergi.clone()).unwrap_or_default(),
        "apoteker": apoteker.map(|a| a.0).unwrap_or_default(),
        "obat_saat_ini": obat,
        "penunjang": lab,
    })))
}

// ── GET /pto/list — daftar lembar pemantauan pasien ini ──────────────────────
#[derive(sqlx::FromRow)]
struct Ringkas { tanggal: String, ringkas: String, petugas: String, milik: i64 }
pub async fn list(user: AuthUser, State(s): State<AppState>, Query(q): Query<NoRawatQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let rows: Vec<Ringkas> = sqlx::query_as(
        "SELECT CAST(t.tanggal AS CHAR) tanggal, \
                IFNULL(LEFT(IF(IFNULL(t.keluhan_utama,'')<>'', t.keluhan_utama, IFNULL(t.soap_a,'')),80),'') ringkas, \
                IFNULL(pg.nama, IFNULL(t.apoteker, IFNULL(t.nip,''))) petugas, (t.nip=? OR ?=1) milik \
         FROM pemantauan_terapi_obat_rscb t LEFT JOIN pegawai pg ON pg.nik=t.nip \
         WHERE t.no_rawat=? ORDER BY t.tanggal DESC LIMIT 100")
        .bind(&user.0.kode).bind(admin).bind(&q.no_rawat)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!(rows.iter().map(|r| json!({
        "tanggal": r.tanggal, "ringkas": r.ringkas, "petugas": r.petugas, "milik": r.milik
    })).collect::<Vec<_>>())))
}

// ── GET /pto/detail — satu lembar + tabel detailnya ──────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct Header {
    pub tanggal: String, pub ruangan: String, pub tgl_masuk: String, pub dpjp: String,
    pub bb: String, pub tb: String, pub alergi_obat: String, pub apoteker: String,
    pub keluhan_utama: String, pub riwayat_penyakit_sekarang: String,
    pub riwayat_penyakit_terdahulu: String, pub riwayat_keluarga: String, pub riwayat_sosial: String,
    pub soap_s: String, pub soap_o: String, pub soap_a: String, pub soap_p: String,
    pub nip: String,
}
#[derive(Serialize, sqlx::FromRow)]
pub struct RiwayatObat { pub nama_obat: String, pub rejimen_dosis: String, pub rute: String, pub waktu_mulai: String }
#[derive(Serialize, sqlx::FromRow)]
pub struct Penunjang {
    pub tgl_pemeriksaan: String, pub nama_pemeriksaan: String,
    pub hasil: String, pub satuan: String, pub nilai_rujukan: String,
}
#[derive(Serialize, sqlx::FromRow)]
pub struct ObatSaatIni { pub tgl_mulai_terapi: String, pub nama_obat: String, pub rejimen: String, pub indikasi: String }

const SEL_HEAD: &str =
    "SELECT CAST(tanggal AS CHAR) tanggal, IFNULL(ruangan,'') ruangan, IFNULL(CAST(tgl_masuk AS CHAR),'') tgl_masuk, \
            IFNULL(dpjp,'') dpjp, IFNULL(bb,'') bb, IFNULL(tb,'') tb, IFNULL(alergi_obat,'') alergi_obat, \
            IFNULL(apoteker,'') apoteker, IFNULL(keluhan_utama,'') keluhan_utama, \
            IFNULL(riwayat_penyakit_sekarang,'') riwayat_penyakit_sekarang, \
            IFNULL(riwayat_penyakit_terdahulu,'') riwayat_penyakit_terdahulu, \
            IFNULL(riwayat_keluarga,'') riwayat_keluarga, IFNULL(riwayat_sosial,'') riwayat_sosial, \
            IFNULL(soap_s,'') soap_s, IFNULL(soap_o,'') soap_o, IFNULL(soap_a,'') soap_a, IFNULL(soap_p,'') soap_p, \
            IFNULL(nip,'') nip FROM pemantauan_terapi_obat_rscb WHERE no_rawat=? AND tanggal=? LIMIT 1";

async fn ambil_detail(s: &AppState, no_rawat: &str, tanggal: &str)
  -> Result<(Vec<RiwayatObat>, Vec<Penunjang>, Vec<ObatSaatIni>), (StatusCode, Json<Value>)> {
    let riwayat: Vec<RiwayatObat> = sqlx::query_as(
        "SELECT IFNULL(nama_obat,'') nama_obat, IFNULL(rejimen_dosis,'') rejimen_dosis, \
                IFNULL(rute,'') rute, IFNULL(waktu_mulai,'') waktu_mulai \
         FROM pto_riwayat_obat_rscb WHERE no_rawat=? AND tanggal=? ORDER BY urut")
        .bind(no_rawat).bind(tanggal).fetch_all(&s.pool).await.map_err(db_err)?;
    let penunjang: Vec<Penunjang> = sqlx::query_as(
        "SELECT IFNULL(CAST(tgl_pemeriksaan AS CHAR),'') tgl_pemeriksaan, IFNULL(nama_pemeriksaan,'') nama_pemeriksaan, \
                IFNULL(hasil,'') hasil, IFNULL(satuan,'') satuan, IFNULL(nilai_rujukan,'') nilai_rujukan \
         FROM pto_penunjang_rscb WHERE no_rawat=? AND tanggal=? ORDER BY urut")
        .bind(no_rawat).bind(tanggal).fetch_all(&s.pool).await.map_err(db_err)?;
    let obat: Vec<ObatSaatIni> = sqlx::query_as(
        "SELECT IFNULL(CAST(tgl_mulai_terapi AS CHAR),'') tgl_mulai_terapi, IFNULL(nama_obat,'') nama_obat, \
                IFNULL(rejimen,'') rejimen, IFNULL(indikasi,'') indikasi \
         FROM pto_obat_saat_ini_rscb WHERE no_rawat=? AND tanggal=? ORDER BY urut")
        .bind(no_rawat).bind(tanggal).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok((riwayat, penunjang, obat))
}

pub async fn detail(user: AuthUser, State(s): State<AppState>, Query(q): Query<DetailQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let head: Option<Header> = sqlx::query_as(SEL_HEAD)
        .bind(&q.no_rawat).bind(&q.tanggal).fetch_optional(&s.pool).await.map_err(db_err)?;
    let Some(head) = head else { return Ok(Json(Value::Null)); };
    let (riwayat, penunjang, obat) = ambil_detail(&s, &q.no_rawat, &q.tanggal).await?;
    let dapat_edit = user.0.is_admin || head.nip == user.0.kode;
    Ok(Json(json!({
        "header": head, "riwayat_obat": riwayat, "penunjang": penunjang,
        "obat_saat_ini": obat, "dapat_edit": dapat_edit,
    })))
}

// ── POST /pto/simpan ─────────────────────────────────────────────────────────
#[derive(Deserialize, Default)]
pub struct RiwayatObatIn {
    #[serde(default)] pub nama_obat: String, #[serde(default)] pub rejimen_dosis: String,
    #[serde(default)] pub rute: String, #[serde(default)] pub waktu_mulai: String,
}
#[derive(Deserialize, Default)]
pub struct PenunjangIn {
    #[serde(default)] pub tgl_pemeriksaan: String, #[serde(default)] pub nama_pemeriksaan: String,
    #[serde(default)] pub hasil: String, #[serde(default)] pub satuan: String,
    #[serde(default)] pub nilai_rujukan: String,
}
#[derive(Deserialize, Default)]
pub struct ObatSaatIniIn {
    #[serde(default)] pub tgl_mulai_terapi: String, #[serde(default)] pub nama_obat: String,
    #[serde(default)] pub rejimen: String, #[serde(default)] pub indikasi: String,
}
#[derive(Deserialize)]
pub struct SimpanBody {
    pub no_rawat: String,
    #[serde(default)] pub tanggal: String,
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub orig_tanggal: String,
    #[serde(default)] pub ruangan: String, #[serde(default)] pub tgl_masuk: String,
    #[serde(default)] pub dpjp: String, #[serde(default)] pub bb: String, #[serde(default)] pub tb: String,
    #[serde(default)] pub alergi_obat: String, #[serde(default)] pub apoteker: String,
    #[serde(default)] pub keluhan_utama: String,
    #[serde(default)] pub riwayat_penyakit_sekarang: String,
    #[serde(default)] pub riwayat_penyakit_terdahulu: String,
    #[serde(default)] pub riwayat_keluarga: String,
    #[serde(default)] pub riwayat_sosial: String,
    #[serde(default)] pub soap_s: String, #[serde(default)] pub soap_o: String,
    #[serde(default)] pub soap_a: String, #[serde(default)] pub soap_p: String,
    #[serde(default)] pub riwayat_obat: Vec<RiwayatObatIn>,
    #[serde(default)] pub penunjang: Vec<PenunjangIn>,
    #[serde(default)] pub obat_saat_ini: Vec<ObatSaatIniIn>,
}

async fn hapus_baris(s: &AppState, user: &AuthUser, no_rawat: &str, tanggal: &str)
  -> Result<u64, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let res = sqlx::query("DELETE FROM pemantauan_terapi_obat_rscb WHERE no_rawat=? AND tanggal=? AND (nip=? OR ?=1)")
        .bind(no_rawat).bind(tanggal).bind(&user.0.kode).bind(admin)
        .execute(&s.pool).await.map_err(db_err)?;
    if res.rows_affected() > 0 {
        for t in ["pto_riwayat_obat_rscb", "pto_penunjang_rscb", "pto_obat_saat_ini_rscb"] {
            sqlx::query(&format!("DELETE FROM {t} WHERE no_rawat=? AND tanggal=?"))
                .bind(no_rawat).bind(tanggal).execute(&s.pool).await.map_err(db_err)?;
        }
    }
    Ok(res.rows_affected())
}

pub async fn simpan(user: AuthUser, State(s): State<AppState>, Json(b): Json<SimpanBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    // Edit in-place: baris lama dihapus dulu (owner-guard), lalu ditulis ulang.
    if b.edit && !b.orig_tanggal.trim().is_empty() {
        if hapus_baris(&s, &user, &b.no_rawat, b.orig_tanggal.trim()).await? == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Data tidak ditemukan / bukan milik Anda"}))));
        }
    }
    let tanggal: String = match norm_dt(&b.tanggal) {
        Some(t) => t,
        None => sqlx::query_scalar("SELECT DATE_FORMAT(NOW(),'%Y-%m-%d %H:%i:%s')")
            .fetch_one(&s.pool).await.map_err(db_err)?,
    };
    // REPLACE: menyimpan ulang pada jam yang sama = menimpa lembar itu.
    sqlx::query(
        "REPLACE INTO pemantauan_terapi_obat_rscb \
         (no_rawat, tanggal, ruangan, tgl_masuk, dpjp, bb, tb, alergi_obat, apoteker, keluhan_utama, \
          riwayat_penyakit_sekarang, riwayat_penyakit_terdahulu, riwayat_keluarga, riwayat_sosial, \
          soap_s, soap_o, soap_a, soap_p, nip) \
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.no_rawat).bind(&tanggal).bind(b.ruangan.trim()).bind(or_null(&b.tgl_masuk))
        .bind(b.dpjp.trim()).bind(b.bb.trim()).bind(b.tb.trim()).bind(b.alergi_obat.trim())
        .bind(b.apoteker.trim()).bind(b.keluhan_utama.trim())
        .bind(b.riwayat_penyakit_sekarang.trim()).bind(b.riwayat_penyakit_terdahulu.trim())
        .bind(b.riwayat_keluarga.trim()).bind(b.riwayat_sosial.trim())
        .bind(b.soap_s.trim()).bind(b.soap_o.trim()).bind(b.soap_a.trim()).bind(b.soap_p.trim())
        .bind(&user.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;

    // Tabel detail ditulis ulang penuh (baris kosong dibuang).
    for t in ["pto_riwayat_obat_rscb", "pto_penunjang_rscb", "pto_obat_saat_ini_rscb"] {
        sqlx::query(&format!("DELETE FROM {t} WHERE no_rawat=? AND tanggal=?"))
            .bind(&b.no_rawat).bind(&tanggal).execute(&s.pool).await.map_err(db_err)?;
    }
    let mut urut = 0i32;
    for r in b.riwayat_obat.iter().filter(|r| !r.nama_obat.trim().is_empty()) {
        urut += 1;
        sqlx::query("INSERT INTO pto_riwayat_obat_rscb (no_rawat, tanggal, urut, nama_obat, rejimen_dosis, rute, waktu_mulai) VALUES (?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(urut)
            .bind(r.nama_obat.trim()).bind(r.rejimen_dosis.trim()).bind(r.rute.trim()).bind(r.waktu_mulai.trim())
            .execute(&s.pool).await.map_err(db_err)?;
    }
    let mut urut = 0i32;
    for p in b.penunjang.iter().filter(|p| !p.nama_pemeriksaan.trim().is_empty()) {
        urut += 1;
        sqlx::query("INSERT INTO pto_penunjang_rscb (no_rawat, tanggal, urut, tgl_pemeriksaan, nama_pemeriksaan, hasil, satuan, nilai_rujukan) VALUES (?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(urut).bind(or_null(&p.tgl_pemeriksaan))
            .bind(p.nama_pemeriksaan.trim()).bind(p.hasil.trim()).bind(p.satuan.trim()).bind(p.nilai_rujukan.trim())
            .execute(&s.pool).await.map_err(db_err)?;
    }
    let mut urut = 0i32;
    for o in b.obat_saat_ini.iter().filter(|o| !o.nama_obat.trim().is_empty()) {
        urut += 1;
        sqlx::query("INSERT INTO pto_obat_saat_ini_rscb (no_rawat, tanggal, urut, tgl_mulai_terapi, nama_obat, rejimen, indikasi) VALUES (?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(urut).bind(or_null(&o.tgl_mulai_terapi))
            .bind(o.nama_obat.trim()).bind(o.rejimen.trim()).bind(o.indikasi.trim())
            .execute(&s.pool).await.map_err(db_err)?;
    }
    crate::audit::log_sql(&s.pool, &user.0.kode,
        &format!("pemantauan_terapi_obat_rscb no_rawat={} tanggal={}", b.no_rawat, tanggal)).await;
    Ok(Json(json!({"ok": true, "tanggal": tanggal})))
}

// ── POST /pto/hapus ──────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct HapusBody { pub no_rawat: String, pub tanggal: String }
pub async fn hapus(user: AuthUser, State(s): State<AppState>, Json(b): Json<HapusBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if hapus_baris(&s, &user, &b.no_rawat, &b.tanggal).await? == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Data tidak ditemukan / bukan milik Anda"}))));
    }
    crate::audit::log_sql(&s.pool, &user.0.kode,
        &format!("hapus pemantauan_terapi_obat_rscb no_rawat={} tanggal={}", b.no_rawat, b.tanggal)).await;
    Ok(Json(json!({"ok": true})))
}

// ── GET /pto/cetak — data lembar untuk halaman cetak ─────────────────────────
pub async fn cetak(_user: AuthUser, State(s): State<AppState>, Query(q): Query<DetailQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    #[derive(sqlx::FromRow)]
    struct Pasien { no_rkm_medis: String, nm_pasien: String, jk: String, tgl_lahir: String, umur: String }
    let pas: Option<Pasien> = sqlx::query_as(
        "SELECT p.no_rkm_medis, p.nm_pasien, IF(p.jk='L','Laki-laki','Perempuan') jk, \
                DATE_FORMAT(p.tgl_lahir,'%d-%m-%Y') tgl_lahir, CONCAT(r.umurdaftar,' ',r.sttsumur) umur \
         FROM reg_periksa r JOIN pasien p ON p.no_rkm_medis=r.no_rkm_medis WHERE r.no_rawat=? LIMIT 1")
        .bind(&q.no_rawat).fetch_optional(&s.pool).await.map_err(db_err)?;
    #[derive(sqlx::FromRow)]
    struct Rs { nama_instansi: Option<String>, alamat_instansi: Option<String>, kabupaten: Option<String>,
                propinsi: Option<String>, kontak: Option<String>, email: Option<String> }
    let rs: Option<Rs> = sqlx::query_as("SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email FROM setting LIMIT 1")
        .fetch_optional(&s.pool).await.ok().flatten();
    let head: Option<Header> = sqlx::query_as(SEL_HEAD)
        .bind(&q.no_rawat).bind(&q.tanggal).fetch_optional(&s.pool).await.map_err(db_err)?;
    let Some(head) = head else {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Lembar PTO tidak ditemukan"}))));
    };
    let petugas: Option<(String,)> = sqlx::query_as("SELECT nama FROM pegawai WHERE nik=? LIMIT 1")
        .bind(&head.nip).fetch_optional(&s.pool).await.map_err(db_err)?;
    let (riwayat, penunjang, obat) = ambil_detail(&s, &q.no_rawat, &q.tanggal).await?;
    Ok(Json(json!({
        "no_rawat": q.no_rawat,
        "rs": rs.map(|r| json!({"nama": r.nama_instansi, "alamat": r.alamat_instansi, "kabupaten": r.kabupaten,
                                "propinsi": r.propinsi, "kontak": r.kontak, "email": r.email})),
        "pasien": pas.map(|p| json!({"no_rkm_medis": p.no_rkm_medis, "nama": p.nm_pasien, "jk": p.jk,
                                     "tgl_lahir": p.tgl_lahir, "umur": p.umur})),
        "header": head,
        "petugas": petugas.map(|p| p.0).unwrap_or_default(),
        "riwayat_obat": riwayat, "penunjang": penunjang, "obat_saat_ini": obat,
    })))
}
