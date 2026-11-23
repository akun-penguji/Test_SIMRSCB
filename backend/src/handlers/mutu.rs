// Indikator Mutu — INM nasional + IMP-RS + IMP-Unit. Master indikator + input
// capaian bulanan per unit (numerator/denominator → capaian %) + rekap/tren + PDSA.
// Terinspirasi model SISMADAK (quality_indicator*), dibangun ulang untuk simrscb.

use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB mutu: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if has_perm(u, "akreditasi_edit") || has_perm(u, "mutu_edit") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Perlu izin akreditasi_edit/mutu_edit"})))) }
}

// ── Lapor ke portal regmutufasyankes ─────────────────────────────────────────
// Juknis SIMAR Kemenkes: laporan INM paling lambat tanggal 10 bulan berikutnya
// pukul 23.59, dan statusnya harus sudah "terkirim" di portal — bukan sekadar
// tersimpan. Baris di bawah ini menyiapkan bahan tempel + jejak sudah/belum.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LaporRow {
    pub indikator_id: i32, pub kode: Option<String>, pub judul: String,
    pub satuan: String, pub target: Option<f64>, pub frekuensi: Option<String>,
    pub numerator: Option<f64>, pub denominator: Option<f64>, pub capaian: Option<f64>,
    pub analisa: Option<String>, pub rtl: Option<String>,
    pub lapor_status: Option<String>, pub lapor_waktu: Option<String>, pub lapor_petugas: Option<String>,
}

#[derive(Deserialize)]
pub struct LaporQ { pub tahun: i32, pub bulan: i32, #[serde(default)] pub jenis: Option<String> }

/// Daftar indikator + capaian bulan itu, untuk layar "Lapor ke Portal".
/// LEFT JOIN supaya indikator yang capaiannya BELUM ada tetap muncul — justru
/// itu yang perlu ditagih sebelum tanggal 10.
pub async fn lapor_daftar(_u: AuthUser, State(s): State<AppState>, Query(q): Query<LaporQ>)
  -> Result<Json<Vec<LaporRow>>, (StatusCode, Json<Value>)> {
    let jenis = q.jenis.unwrap_or_else(|| "inm".into());
    let rows: Vec<LaporRow> = sqlx::query_as(
        "SELECT i.id AS indikator_id, i.kode, i.judul, i.satuan, i.target, i.frekuensi,
                c.numerator, c.denominator, c.capaian, c.analisa, c.rtl,
                c.lapor_status, DATE_FORMAT(c.lapor_waktu,'%Y-%m-%d %H:%i') AS lapor_waktu, c.lapor_petugas
           FROM simrscb_mutu_indikator i
           LEFT JOIN simrscb_mutu_capaian c
             ON c.indikator_id=i.id AND c.tahun=? AND c.bulan=? AND c.unit=''
          WHERE i.jenis=? AND i.status='aktif'
          ORDER BY i.kode, i.id")
        .bind(q.tahun).bind(q.bulan).bind(&jenis)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct LaporTandaiBody {
    pub indikator_id: i32, pub tahun: i32, pub bulan: i32,
    /// true = sudah dikirim di portal, false = batalkan penandaan
    pub terkirim: bool,
}
/// Menandai bahwa capaian bulan itu SUDAH dikirim di portal regmutufasyankes.
/// Penandaan manual — SIMRS tidak bisa tahu sendiri apa yang terjadi di portal.
pub async fn lapor_tandai(u: AuthUser, State(s): State<AppState>, Json(b): Json<LaporTandaiBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let r = sqlx::query(
        "UPDATE simrscb_mutu_capaian
            SET lapor_status = IF(?, 'Terkirim', 'Belum'),
                lapor_waktu  = IF(?, NOW(), NULL),
                lapor_petugas= IF(?, ?, NULL)
          WHERE indikator_id=? AND tahun=? AND bulan=? AND unit=''")
        .bind(b.terkirim).bind(b.terkirim).bind(b.terkirim).bind(&u.0.nama)
        .bind(b.indikator_id).bind(b.tahun).bind(b.bulan)
        .execute(&s.pool).await.map_err(db_err)?;
    if r.rows_affected() == 0 {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error":"Capaian bulan ini belum ada — isi dulu numerator & denominatornya."}))));
    }
    Ok(Json(json!({"ok": true})))
}

// ── Master indikator ─────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Indikator {
    pub id: i32, pub kode: Option<String>, pub judul: String, pub jenis: String,
    pub unit: Option<String>, pub definisi: Option<String>, pub numerator_def: Option<String>,
    pub denominator_def: Option<String>, pub satuan: String, pub target: Option<f64>,
    pub standar: Option<String>, pub formula: Option<String>, pub frekuensi: Option<String>,
    pub dimensi: Option<String>, pub status: String,
}
const ICOLS: &str = "id, kode, judul, jenis, unit, definisi, numerator_def, denominator_def,
  satuan, target, standar, formula, frekuensi, dimensi, status";

#[derive(Deserialize)]
pub struct IndListQ { pub jenis: Option<String>, pub unit: Option<String>, pub q: Option<String>, pub status: Option<String> }
pub async fn ind_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<IndListQ>)
  -> Result<Json<Vec<Indikator>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!(
        "SELECT {} FROM simrscb_mutu_indikator
         WHERE (? IS NULL OR jenis=?) AND (? IS NULL OR unit=?)
           AND (? IS NULL OR status=?) AND (? IS NULL OR judul LIKE ? OR kode LIKE ?)
         ORDER BY jenis, kode, id", ICOLS);
    let rows: Vec<Indikator> = sqlx::query_as(&sql)
        .bind(&q.jenis).bind(&q.jenis).bind(&q.unit).bind(&q.unit)
        .bind(&q.status).bind(&q.status).bind(&qs).bind(&qs).bind(&qs)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct IndBody {
    #[serde(default)] pub kode: Option<String>, pub judul: String, #[serde(default)] pub jenis: Option<String>,
    #[serde(default)] pub unit: Option<String>, #[serde(default)] pub definisi: Option<String>,
    #[serde(default)] pub numerator_def: Option<String>, #[serde(default)] pub denominator_def: Option<String>,
    #[serde(default)] pub satuan: Option<String>, #[serde(default)] pub target: Option<f64>,
    #[serde(default)] pub standar: Option<String>, #[serde(default)] pub formula: Option<String>,
    #[serde(default)] pub frekuensi: Option<String>, #[serde(default)] pub dimensi: Option<String>,
    #[serde(default)] pub status: Option<String>,
}
pub async fn ind_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<IndBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.judul.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Judul wajib"})))); }
    let r = sqlx::query(
        "INSERT INTO simrscb_mutu_indikator (kode,judul,jenis,unit,definisi,numerator_def,denominator_def,satuan,target,standar,formula,frekuensi,dimensi,status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.kode).bind(b.judul.trim()).bind(b.jenis.as_deref().unwrap_or("imp_unit")).bind(&b.unit)
        .bind(&b.definisi).bind(&b.numerator_def).bind(&b.denominator_def)
        .bind(b.satuan.as_deref().unwrap_or("%")).bind(b.target).bind(&b.standar).bind(&b.formula)
        .bind(b.frekuensi.as_deref().unwrap_or("bulanan")).bind(&b.dimensi).bind(b.status.as_deref().unwrap_or("aktif"))
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn ind_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<IndBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query(
        "UPDATE simrscb_mutu_indikator SET kode=?,judul=?,jenis=COALESCE(?,jenis),unit=?,definisi=?,numerator_def=?,denominator_def=?,
           satuan=COALESCE(?,satuan),target=?,standar=?,formula=?,frekuensi=COALESCE(?,frekuensi),dimensi=?,status=COALESCE(?,status) WHERE id=?")
        .bind(&b.kode).bind(b.judul.trim()).bind(&b.jenis).bind(&b.unit).bind(&b.definisi)
        .bind(&b.numerator_def).bind(&b.denominator_def).bind(&b.satuan).bind(b.target).bind(&b.standar)
        .bind(&b.formula).bind(&b.frekuensi).bind(&b.dimensi).bind(&b.status).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn ind_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_mutu_capaian WHERE indikator_id=?").bind(id).execute(&s.pool).await.ok();
    sqlx::query("DELETE FROM simrscb_mutu_indikator WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Capaian bulanan ──────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Capaian {
    pub id: i32, pub indikator_id: i32, pub unit: Option<String>, pub tahun: i32, pub bulan: i32,
    pub numerator: Option<f64>, pub denominator: Option<f64>, pub capaian: Option<f64>,
    pub analisa: Option<String>, pub rtl: Option<String>, pub pelapor: Option<String>,
}
#[derive(Deserialize)]
pub struct CapListQ { pub indikator_id: i32, #[serde(default)] pub unit: Option<String>, pub tahun: Option<i32> }
pub async fn cap_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<CapListQ>)
  -> Result<Json<Vec<Capaian>>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2026));
    let rows: Vec<Capaian> = sqlx::query_as(
        "SELECT id, indikator_id, unit, tahun, bulan, numerator, denominator, capaian, analisa, rtl, pelapor
         FROM simrscb_mutu_capaian WHERE indikator_id=? AND tahun=? AND (? IS NULL OR unit=?) ORDER BY bulan")
        .bind(q.indikator_id).bind(tahun).bind(&q.unit).bind(&q.unit)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct CapBody {
    pub indikator_id: i32, #[serde(default)] pub unit: Option<String>, pub tahun: i32, pub bulan: i32,
    #[serde(default)] pub numerator: Option<f64>, #[serde(default)] pub denominator: Option<f64>,
    #[serde(default)] pub analisa: Option<String>, #[serde(default)] pub rtl: Option<String>,
}
pub async fn cap_upsert(u: AuthUser, State(s): State<AppState>, Json(b): Json<CapBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // satuan indikator utk hitung capaian (% x100 / permil x1000)
    let satuan: Option<(String,)> = sqlx::query_as("SELECT satuan FROM simrscb_mutu_indikator WHERE id=?")
        .bind(b.indikator_id).fetch_optional(&s.pool).await.map_err(db_err)?;
    let mult = if satuan.map(|x| x.0).as_deref() == Some("‰") { 1000.0 } else { 100.0 };
    let capaian = match (b.numerator, b.denominator) {
        (Some(n), Some(d)) if d != 0.0 => Some(n / d * mult),
        _ => None,
    };
    sqlx::query(
        "INSERT INTO simrscb_mutu_capaian (indikator_id,unit,tahun,bulan,numerator,denominator,capaian,analisa,rtl,pelapor)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE numerator=VALUES(numerator),denominator=VALUES(denominator),capaian=VALUES(capaian),
           analisa=VALUES(analisa),rtl=VALUES(rtl),pelapor=VALUES(pelapor)")
        .bind(b.indikator_id).bind(b.unit.as_deref().unwrap_or("")).bind(b.tahun).bind(b.bulan)
        .bind(b.numerator).bind(b.denominator).bind(capaian).bind(&b.analisa).bind(&b.rtl).bind(&u.0.nama)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "capaian": capaian})))
}

// ── Auto-Capaian dari data Khanza ────────────────────────────────────────────
// Registry indikator yang numerator/denominator-nya bisa dihitung langsung dari
// transaksi Khanza (bukan survei). Tiap def punya `kode` stabil sbg penghubung ke
// master simrscb_mutu_indikator (dibuat bila belum ada; kalau sudah ada — mis.
// INM05 — dipakai apa adanya). SQL mengembalikan kolom (num, den) DOUBLE dgn satu
// bind `?` = bulan 'YYYY-MM'. Hasil di-upsert ke simrscb_mutu_capaian TANPA
// menimpa analisa/rtl (input manual tetap aman).
struct AutoDef {
    kode: &'static str, judul: &'static str, jenis: &'static str, unit: &'static str,
    satuan: &'static str, target: f64, definisi: &'static str,
    numerator_def: &'static str, denominator_def: &'static str, sql: &'static str,
}

// Basis pasien keluar ranap: baris kamar_inap TERAKHIR per no_rawat (mengatasi
// pindah kamar / double-count), dg status pulang riil.
const RANAP_BASE: &str = "\
 FROM kamar_inap ki \
 JOIN (SELECT no_rawat, MAX(TIMESTAMP(tgl_keluar,jam_keluar)) mx FROM kamar_inap \
       WHERE tgl_keluar>'2000-01-01' GROUP BY no_rawat) f \
   ON f.no_rawat=ki.no_rawat AND TIMESTAMP(ki.tgl_keluar,ki.jam_keluar)=f.mx \
 WHERE ki.stts_pulang NOT IN ('Pindah Kamar','-','Status Belum Lengkap') \
   AND DATE_FORMAT(ki.tgl_keluar,'%Y-%m') = ?";

fn auto_defs() -> Vec<AutoDef> {
    vec![
        AutoDef {
            kode: "INM05", judul: "Waktu Tunggu Rawat Jalan", jenis: "inm", unit: "Rawat Jalan",
            satuan: "%", target: 80.0,
            definisi: "Waktu tunggu rawat jalan ≤ 60 menit (dari registrasi sampai dilayani DPJP). Auto dari reg_periksa → pemeriksaan_ralan.",
            numerator_def: "Kunjungan ralan dg waktu tunggu ≤ 60 menit",
            denominator_def: "Total kunjungan ralan yang dilayani (punya pemeriksaan_ralan hari yang sama)",
            sql: "SELECT \
                    SUM(CASE WHEN TIMESTAMPDIFF(MINUTE, TIMESTAMP(r.tgl_registrasi,r.jam_reg), p.tp) BETWEEN 0 AND 60 THEN 1e0 ELSE 0e0 END) num, \
                    SUM(1e0) den \
                  FROM reg_periksa r \
                  JOIN (SELECT no_rawat, MIN(TIMESTAMP(tgl_perawatan,jam_rawat)) tp FROM pemeriksaan_ralan GROUP BY no_rawat) p \
                    ON p.no_rawat=r.no_rawat \
                  WHERE r.status_lanjut='Ralan' AND DATE_FORMAT(r.tgl_registrasi,'%Y-%m') = ? \
                    AND TIMESTAMPDIFF(MINUTE, TIMESTAMP(r.tgl_registrasi,r.jam_reg), p.tp) BETWEEN 0 AND 1440",
        },
        AutoDef {
            kode: "IGD-WT", judul: "Waktu Tanggap Pelayanan Dokter di Gawat Darurat", jenis: "imp_unit", unit: "IGD",
            satuan: "menit", target: 5.0,
            definisi: "Rata-rata waktu sejak pasien datang (registrasi IGD) sampai dilayani (triase). Auto dari reg_periksa → data_triase_igd. Target ≤ 5 menit.",
            numerator_def: "Jumlah kumulatif menit registrasi IGD → triase pertama",
            denominator_def: "Jumlah pasien IGD yang tercatat waktu triasenya (bulan tsb)",
            sql: "SELECT \
                    SUM(TIMESTAMPDIFF(MINUTE, TIMESTAMP(r.tgl_registrasi,r.jam_reg), dt.tt) * 1e0) num, \
                    SUM(1e0) den \
                  FROM reg_periksa r \
                  JOIN (SELECT no_rawat, MIN(tgl_kunjungan) tt FROM data_triase_igd GROUP BY no_rawat) dt \
                    ON dt.no_rawat=r.no_rawat \
                  WHERE r.kd_poli IN ('IGD','IGDK') AND DATE_FORMAT(r.tgl_registrasi,'%Y-%m') = ? \
                    AND TIMESTAMPDIFF(MINUTE, TIMESTAMP(r.tgl_registrasi,r.jam_reg), dt.tt) BETWEEN 0 AND 1440",
        },
        AutoDef {
            kode: "RI-APS", judul: "Kejadian Pulang Atas Permintaan Sendiri (APS)", jenis: "imp_unit", unit: "Rawat Inap",
            satuan: "%", target: 5.0,
            definisi: "Persentase pasien ranap yang pulang APS/paksa terhadap seluruh pasien keluar. Makin kecil makin baik (target ≤ 5%).",
            numerator_def: "Pasien pulang dg status APS / Atas Permintaan Sendiri",
            denominator_def: "Seluruh pasien keluar ranap pada bulan tsb",
            sql: "SELECT \
                    SUM(CASE WHEN ki.stts_pulang IN ('APS','Atas Permintaan Sendiri') THEN 1e0 ELSE 0e0 END) num, \
                    SUM(1e0) den",
        },
        AutoDef {
            kode: "RI-NDR", judul: "Angka Kematian ≥ 48 Jam Setelah Dirawat (NDR)", jenis: "imp_unit", unit: "Rawat Inap",
            satuan: "‰", target: 25.0,
            definisi: "Net Death Rate: kematian ≥48 jam per 1000 pasien keluar (hidup+mati). Target ≤ 25‰.",
            numerator_def: "Pasien meninggal dg lama rawat ≥ 48 jam",
            denominator_def: "Seluruh pasien keluar ranap pada bulan tsb",
            sql: "SELECT \
                    SUM(CASE WHEN ki.stts_pulang='Meninggal' AND TIMESTAMPDIFF(HOUR,TIMESTAMP(ki.tgl_masuk,ki.jam_masuk),TIMESTAMP(ki.tgl_keluar,ki.jam_keluar))>=48 THEN 1e0 ELSE 0e0 END) num, \
                    SUM(1e0) den",
        },
        AutoDef {
            kode: "RI-GDR", judul: "Angka Kematian Umum (GDR)", jenis: "imp_unit", unit: "Rawat Inap",
            satuan: "‰", target: 45.0,
            definisi: "Gross Death Rate: seluruh kematian per 1000 pasien keluar. Target ≤ 45‰.",
            numerator_def: "Seluruh pasien meninggal",
            denominator_def: "Seluruh pasien keluar ranap pada bulan tsb",
            sql: "SELECT \
                    SUM(CASE WHEN ki.stts_pulang='Meninggal' THEN 1e0 ELSE 0e0 END) num, \
                    SUM(1e0) den",
        },
        AutoDef {
            kode: "INM08", judul: "Pelaporan Hasil Kritis Laboratorium", jenis: "inm", unit: "Laboratorium",
            satuan: "%", target: 100.0,
            definisi: "Persentase hasil kritis lab yang dilaporkan ke DPJP/unit dalam ≤ 30 menit. Auto dari audit_nilai_kritis + lapor_kritis_rm (KARS PAP 3 / INM08).",
            numerator_def: "Hasil kritis dilaporkan (TBaK) ≤ 30 menit sejak hasil keluar",
            denominator_def: "Seluruh hasil kritis yang wajib dilaporkan (status ≠ Tidak Perlu) pada bulan tsb",
            sql: "SELECT \
                    SUM(CASE WHEN l.waktu_lapor IS NOT NULL AND TIMESTAMPDIFF(MINUTE, TIMESTAMP(a.tgl_kejadian,a.jam_kejadian), l.waktu_lapor) BETWEEN 0 AND 30 THEN 1e0 ELSE 0e0 END) num, \
                    SUM(1e0) den \
                  FROM audit_nilai_kritis a \
                  LEFT JOIN (SELECT id_audit, MIN(waktu_lapor) waktu_lapor FROM lapor_kritis_rm GROUP BY id_audit) l ON l.id_audit=a.id \
                  WHERE a.status_notifikasi <> 'TIDAK_PERLU' AND DATE_FORMAT(a.tgl_kejadian,'%Y-%m') = ?",
        },
    ]
}

// GET daftar indikator auto (metadata) — untuk UI menampilkan apa saja yg bisa dihitung.
pub async fn auto_daftar(_u: AuthUser, State(_s): State<AppState>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let list: Vec<Value> = auto_defs().iter().map(|d| json!({
        "kode": d.kode, "judul": d.judul, "jenis": d.jenis, "unit": d.unit,
        "satuan": d.satuan, "target": d.target, "definisi": d.definisi,
        "numerator_def": d.numerator_def, "denominator_def": d.denominator_def,
    })).collect();
    Ok(Json(json!({"indikator": list})))
}

// Pastikan master indikator ada (match by kode). Bila belum ada → INSERT dg seed.
// Bila sudah ada → pakai id-nya, jangan timpa (hormati konfigurasi yg ada).
async fn ensure_indikator(s: &AppState, d: &AutoDef) -> Result<i32, (StatusCode, Json<Value>)> {
    if let Some((id,)) = sqlx::query_as::<_, (i32,)>("SELECT id FROM simrscb_mutu_indikator WHERE kode=? LIMIT 1")
        .bind(d.kode).fetch_optional(&s.pool).await.map_err(db_err)? {
        return Ok(id);
    }
    let r = sqlx::query(
        "INSERT INTO simrscb_mutu_indikator (kode,judul,jenis,unit,definisi,numerator_def,denominator_def,satuan,target,formula,frekuensi,dimensi,status) \
         VALUES (?,?,?,?,?,?,?,?,?,?,'bulanan','Efektivitas','aktif')")
        .bind(d.kode).bind(d.judul).bind(d.jenis).bind(d.unit).bind(d.definisi)
        .bind(d.numerator_def).bind(d.denominator_def).bind(d.satuan).bind(d.target)
        .bind("(numerator / denominator) x pengali")
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(r.last_insert_id() as i32)
}

#[derive(Deserialize)]
pub struct AutoHitungBody { pub tahun: i32, pub bulan: i32, #[serde(default)] pub kode: Option<String> }
// Hitung ulang & upsert capaian bulan tsb dari data Khanza. Tidak menimpa analisa/rtl.
pub async fn auto_hitung(u: AuthUser, State(s): State<AppState>, Json(b): Json<AutoHitungBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if !(1..=12).contains(&b.bulan) || !(2000..=2100).contains(&b.tahun) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"tahun/bulan tidak valid"}))));
    }
    let bulan_str = format!("{:04}-{:02}", b.tahun, b.bulan);
    let defs = auto_defs();
    let mut hasil: Vec<Value> = Vec::new();
    for d in &defs {
        if let Some(k) = &b.kode { if !k.trim().is_empty() && k != d.kode { continue; } }
        let id = ensure_indikator(&s, d).await?;
        // Query num/den. Basis ranap butuh dua bind (num/den satu tabel dgn WHERE ?);
        // def ranap SQL hanya berisi SELECT → gabungkan dgn RANAP_BASE.
        let full_sql = if d.kode.starts_with("RI-") { format!("{} {}", d.sql, RANAP_BASE) } else { d.sql.to_string() };
        let (num, den): (Option<f64>, Option<f64>) = sqlx::query_as(&full_sql)
            .bind(&bulan_str).fetch_one(&s.pool).await.map_err(db_err)?;
        let num = num.unwrap_or(0.0);
        let den = den.unwrap_or(0.0);
        let mult = match d.satuan { "‰" => 1000.0, "menit" => 1.0, _ => 100.0 };
        let capaian = if den != 0.0 { Some(num / den * mult) } else { None };
        sqlx::query(
            "INSERT INTO simrscb_mutu_capaian (indikator_id,unit,tahun,bulan,numerator,denominator,capaian,pelapor) \
             VALUES (?,?,?,?,?,?,?, '(auto)') \
             ON DUPLICATE KEY UPDATE numerator=VALUES(numerator),denominator=VALUES(denominator),capaian=VALUES(capaian),pelapor='(auto)'")
            .bind(id).bind("").bind(b.tahun).bind(b.bulan)
            .bind(num).bind(den).bind(capaian)
            .execute(&s.pool).await.map_err(db_err)?;
        hasil.push(json!({
            "kode": d.kode, "judul": d.judul, "indikator_id": id,
            "numerator": num, "denominator": den, "capaian": capaian,
            "satuan": d.satuan, "target": d.target,
        }));
    }
    Ok(Json(json!({"ok": true, "tahun": b.tahun, "bulan": b.bulan, "hasil": hasil})))
}

// ── Rekap tahunan (12 bulan + rata2 vs target) ──────────────────────────────
#[derive(Deserialize)]
pub struct RekapQ { pub tahun: Option<i32>, pub jenis: Option<String>, pub unit: Option<String> }
pub async fn rekap(_u: AuthUser, State(s): State<AppState>, Query(q): Query<RekapQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2026));
    #[derive(sqlx::FromRow, Serialize)]
    struct Row {
        id: i32, kode: Option<String>, judul: String, jenis: String, unit: Option<String>,
        satuan: String, target: Option<f64>, rata: Option<f64>, terisi: i64,
    }
    let inds: Vec<Row> = sqlx::query_as(
        "SELECT i.id, i.kode, i.judul, i.jenis, i.unit, i.satuan, i.target,
                (SELECT AVG(c.capaian) FROM simrscb_mutu_capaian c WHERE c.indikator_id=i.id AND c.tahun=?) AS rata,
                (SELECT COUNT(*) FROM simrscb_mutu_capaian c WHERE c.indikator_id=i.id AND c.tahun=? AND c.capaian IS NOT NULL) AS terisi
         FROM simrscb_mutu_indikator i
         WHERE i.status='aktif' AND (? IS NULL OR i.jenis=?) AND (? IS NULL OR i.unit=?)
         ORDER BY i.jenis, i.kode, i.id")
        .bind(tahun).bind(tahun).bind(&q.jenis).bind(&q.jenis).bind(&q.unit).bind(&q.unit)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    // capaian per bulan untuk grafik
    #[derive(sqlx::FromRow, Serialize)]
    struct MRow { indikator_id: i32, bulan: i32, capaian: Option<f64> }
    let bulanan: Vec<MRow> = sqlx::query_as(
        "SELECT c.indikator_id, c.bulan, c.capaian FROM simrscb_mutu_capaian c
         JOIN simrscb_mutu_indikator i ON i.id=c.indikator_id
         WHERE c.tahun=? AND (? IS NULL OR i.jenis=?) AND (? IS NULL OR i.unit=?)")
        .bind(tahun).bind(&q.jenis).bind(&q.jenis).bind(&q.unit).bind(&q.unit)
        .fetch_all(&s.pool).await.unwrap_or_default();
    Ok(Json(json!({"tahun": tahun, "indikator": inds, "bulanan": bulanan})))
}

// ── Ceklis observasi mutu (input berbasis sampel patuh/tidak) ────────────────
// Tiap baris = 1 observasi. Rekap bulan: numerator=SUM(patuh), denominator=COUNT.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ChecklistRow {
    pub id: i32, pub indikator_id: i32, pub unit: String, pub tanggal: String,
    pub patuh: i8, pub sampel: Option<String>, pub keterangan: Option<String>, pub observer: Option<String>,
}

#[derive(Deserialize)]
pub struct CkListQ { pub indikator_id: i32, pub tahun: i32, pub bulan: i32, #[serde(default)] pub unit: Option<String> }

pub async fn ck_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<CkListQ>)
  -> Result<Json<Vec<ChecklistRow>>, (StatusCode, Json<Value>)> {
    let bulan = format!("{:04}-{:02}", q.tahun, q.bulan);
    let unit = q.unit.filter(|x| !x.trim().is_empty());
    let rows = sqlx::query_as::<_, ChecklistRow>(
        "SELECT id, indikator_id, unit, DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, patuh, sampel, keterangan, observer \
         FROM simrscb_mutu_checklist WHERE indikator_id=? AND DATE_FORMAT(tanggal,'%Y-%m')=? \
         AND (? IS NULL OR unit=?) ORDER BY tanggal, id")
        .bind(q.indikator_id).bind(&bulan).bind(&unit).bind(&unit)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct CkItem { pub patuh: i8, #[serde(default)] pub sampel: Option<String>, #[serde(default)] pub keterangan: Option<String> }
#[derive(Deserialize)]
pub struct CkAddBody { pub indikator_id: i32, #[serde(default)] pub unit: Option<String>, pub tanggal: String, pub items: Vec<CkItem> }

pub async fn ck_add(u: AuthUser, State(s): State<AppState>, Json(b): Json<CkAddBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.items.is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Tidak ada observasi"})))); }
    let unit = b.unit.as_deref().unwrap_or("");
    let mut n = 0i32;
    for it in &b.items {
        sqlx::query("INSERT INTO simrscb_mutu_checklist (indikator_id,unit,tanggal,patuh,sampel,keterangan,observer) VALUES (?,?,?,?,?,?,?)")
            .bind(b.indikator_id).bind(unit).bind(&b.tanggal).bind(if it.patuh != 0 { 1i8 } else { 0i8 })
            .bind(&it.sampel).bind(&it.keterangan).bind(&u.0.nama)
            .execute(&s.pool).await.map_err(db_err)?;
        n += 1;
    }
    Ok(Json(json!({"ok": true, "inserted": n})))
}

pub async fn ck_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_mutu_checklist WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
pub struct CkRekapBody { pub indikator_id: i32, pub tahun: i32, pub bulan: i32, #[serde(default)] pub unit: Option<String> }

// Rekap observasi 1 bulan → simrscb_mutu_capaian (numerator/denominator/capaian).
// TIDAK menimpa analisa/rtl (kolom itu tak disentuh saat upsert).
pub async fn ck_rekap(u: AuthUser, State(s): State<AppState>, Json(b): Json<CkRekapBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let bulan = format!("{:04}-{:02}", b.tahun, b.bulan);
    let unit = b.unit.as_deref().unwrap_or("");
    let (num, den): (Option<f64>, Option<f64>) = sqlx::query_as(
        "SELECT SUM(patuh)*1e0, COUNT(*)*1e0 FROM simrscb_mutu_checklist \
         WHERE indikator_id=? AND DATE_FORMAT(tanggal,'%Y-%m')=? AND unit=?")
        .bind(b.indikator_id).bind(&bulan).bind(unit).fetch_one(&s.pool).await.map_err(db_err)?;
    let num = num.unwrap_or(0.0);
    let den = den.unwrap_or(0.0);
    if den == 0.0 { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Belum ada observasi bulan ini untuk unit tsb"})))); }
    let satuan: Option<(String,)> = sqlx::query_as("SELECT satuan FROM simrscb_mutu_indikator WHERE id=?")
        .bind(b.indikator_id).fetch_optional(&s.pool).await.map_err(db_err)?;
    let mult = if satuan.map(|x| x.0).as_deref() == Some("‰") { 1000.0 } else { 100.0 };
    let capaian = num / den * mult;
    sqlx::query(
        "INSERT INTO simrscb_mutu_capaian (indikator_id,unit,tahun,bulan,numerator,denominator,capaian,pelapor) \
         VALUES (?,?,?,?,?,?,?,?) \
         ON DUPLICATE KEY UPDATE numerator=VALUES(numerator),denominator=VALUES(denominator),capaian=VALUES(capaian),pelapor=VALUES(pelapor)")
        .bind(b.indikator_id).bind(unit).bind(b.tahun).bind(b.bulan)
        .bind(num).bind(den).bind(capaian).bind(&u.0.nama)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "numerator": num, "denominator": den, "capaian": capaian})))
}
