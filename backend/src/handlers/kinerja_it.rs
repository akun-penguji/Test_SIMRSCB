// Kinerja IT — dashboard performa tim IT. Menarik metrik dari Lapor IT &
// Permintaan Fitur (otomatis) + catatan aktivitas manual + impor WhatsApp + gambar.

use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB kinerja_it: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn require_kelola(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if has_perm(u, "lapor_it_kelola") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya tim IT (izin lapor_it_kelola)."}))))}
}

// ── Aktivitas manual ─────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AktivitasRow {
    pub id:          i32,
    pub tanggal:     String,
    pub petugas:     Option<String>,
    pub kategori:    String,
    pub judul:       String,
    pub deskripsi:   Option<String>,
    pub durasi_menit: Option<i32>,
    pub foto:        Option<String>,
    pub sumber:      String,
    pub created_at:  Option<String>,
}
const COLS: &str = "
  id, DATE_FORMAT(tanggal,'%Y-%m-%d %H:%i:%s') AS tanggal, petugas, kategori, judul, deskripsi,
  durasi_menit, foto, sumber, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at";

#[derive(Deserialize)]
pub struct ListQuery {
    pub tahun: Option<i32>, pub bulan: Option<i32>, pub kategori: Option<String>,
    pub petugas: Option<String>, pub q: Option<String>,
    #[serde(default)] pub sla_jam: Option<i64>,
}
pub async fn list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQuery>)
  -> Result<Json<Vec<AktivitasRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!(
        "SELECT {} FROM simrscb_kinerja_it
         WHERE (? IS NULL OR YEAR(tanggal)=?)
           AND (? IS NULL OR MONTH(tanggal)=?)
           AND (? IS NULL OR kategori=?)
           AND (? IS NULL OR petugas=?)
           AND (? IS NULL OR judul LIKE ? OR deskripsi LIKE ? OR petugas LIKE ?)
         ORDER BY tanggal DESC, id DESC LIMIT 1000", COLS);
    let rows: Vec<AktivitasRow> = sqlx::query_as(&sql)
        .bind(q.tahun).bind(q.tahun).bind(q.bulan).bind(q.bulan)
        .bind(&q.kategori).bind(&q.kategori).bind(&q.petugas).bind(&q.petugas)
        .bind(&qs).bind(&qs).bind(&qs).bind(&qs)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct CreateBody {
    #[serde(default)] pub tanggal: Option<String>,
    #[serde(default)] pub petugas: Option<String>,
    #[serde(default)] pub kategori: Option<String>,
    pub judul: String,
    #[serde(default)] pub deskripsi: Option<String>,
    #[serde(default)] pub durasi_menit: Option<i32>,
    #[serde(default)] pub foto: Option<String>,
}
pub async fn create(u: AuthUser, State(s): State<AppState>, Json(b): Json<CreateBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_kelola(&u)?;
    if b.judul.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Judul wajib"})))); }
    let tgl = b.tanggal.filter(|x| !x.trim().is_empty());
    let r = sqlx::query(
        "INSERT INTO simrscb_kinerja_it (tanggal, petugas, kategori, judul, deskripsi, durasi_menit, foto, sumber, updated_by)
         VALUES (COALESCE(?, NOW()), ?, ?, ?, ?, ?, ?, 'manual', ?)")
        .bind(&tgl)
        .bind(b.petugas.as_deref().filter(|x| !x.trim().is_empty()).unwrap_or(&u.0.nama))
        .bind(b.kategori.as_deref().unwrap_or("lainnya"))
        .bind(b.judul.trim()).bind(&b.deskripsi).bind(b.durasi_menit).bind(&b.foto).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("INSERT kinerja_it judul={:?}", b.judul)).await;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}

pub async fn update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<CreateBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_kelola(&u)?;
    sqlx::query(
        "UPDATE simrscb_kinerja_it SET tanggal=COALESCE(?,tanggal), petugas=COALESCE(?,petugas),
           kategori=COALESCE(?,kategori), judul=COALESCE(?,judul), deskripsi=COALESCE(?,deskripsi),
           durasi_menit=COALESCE(?,durasi_menit), foto=COALESCE(?,foto), updated_by=? WHERE id=?")
        .bind(b.tanggal.filter(|x| !x.trim().is_empty())).bind(&b.petugas).bind(&b.kategori)
        .bind(if b.judul.trim().is_empty() { None } else { Some(b.judul.trim()) })
        .bind(&b.deskripsi).bind(b.durasi_menit).bind(&b.foto).bind(&u.0.kode).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

pub async fn delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_kelola(&u)?;
    sqlx::query("DELETE FROM simrscb_kinerja_it WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("DELETE kinerja_it id={}", id)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Impor WhatsApp (aktivitas) — reuse parser Lapor IT ───────────────────────
#[derive(Deserialize)]
pub struct ImportBody { pub text: String, #[serde(default)] pub apply: Option<bool>, #[serde(default)] pub kategori: Option<String> }
pub async fn import_wa(u: AuthUser, State(s): State<AppState>, Json(b): Json<ImportBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_kelola(&u)?;
    let msgs = crate::handlers::lapor_it::parse_wa(&b.text);
    let apply = b.apply.unwrap_or(false);
    let kategori = b.kategori.as_deref().unwrap_or("lainnya");
    if !apply {
        let sample: Vec<&crate::handlers::lapor_it::ParsedMsg> = msgs.iter().take(15).collect();
        return Ok(Json(json!({"ok": true, "apply": false, "terdeteksi": msgs.len(), "contoh": sample})));
    }
    let mut baru = 0i64; let mut lewati = 0i64;
    for m in &msgs {
        let dup: Option<(i64,)> = sqlx::query_as(
            "SELECT id FROM simrscb_kinerja_it WHERE sumber='wa_import' AND tanggal=? AND petugas=? AND judul=? LIMIT 1")
            .bind(&m.tanggal).bind(&m.pelapor).bind(&m.judul).fetch_optional(&s.pool).await.ok().flatten();
        if dup.is_some() { lewati += 1; continue; }
        sqlx::query(
            "INSERT INTO simrscb_kinerja_it (tanggal, petugas, kategori, judul, deskripsi, sumber, updated_by)
             VALUES (?, ?, ?, ?, ?, 'wa_import', ?)")
            .bind(&m.tanggal).bind(&m.pelapor).bind(kategori).bind(&m.judul).bind(&m.deskripsi).bind(&u.0.kode)
            .execute(&s.pool).await.map_err(db_err)?;
        baru += 1;
    }
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("IMPORT WA kinerja_it baru={} lewati={}", baru, lewati)).await;
    Ok(Json(json!({"ok": true, "apply": true, "terdeteksi": msgs.len(), "baru": baru, "dilewati_duplikat": lewati})))
}

// ── Ekspor CSV aktivitas (dengan filter sama seperti list) ───────────────────
pub async fn export_csv(_u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQuery>)
  -> Result<axum::response::Response, (StatusCode, Json<Value>)> {
    use axum::response::IntoResponse;
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!(
        "SELECT {} FROM simrscb_kinerja_it
         WHERE (? IS NULL OR YEAR(tanggal)=?)
           AND (? IS NULL OR MONTH(tanggal)=?)
           AND (? IS NULL OR kategori=?)
           AND (? IS NULL OR petugas=?)
           AND (? IS NULL OR judul LIKE ? OR deskripsi LIKE ? OR petugas LIKE ?)
         ORDER BY tanggal DESC, id DESC", COLS);
    let rows: Vec<AktivitasRow> = sqlx::query_as(&sql)
        .bind(q.tahun).bind(q.tahun).bind(q.bulan).bind(q.bulan)
        .bind(&q.kategori).bind(&q.kategori).bind(&q.petugas).bind(&q.petugas)
        .bind(&qs).bind(&qs).bind(&qs).bind(&qs)
        .fetch_all(&s.pool).await.map_err(db_err)?;

    let cell = |v: &str| format!("\"{}\"", v.replace('\r', " ").replace('\n', " ").replace('"', "\"\""));
    let mut csv = String::from("\u{feff}tanggal,petugas,kategori,judul,deskripsi,durasi_menit,sumber\n");
    for r in &rows {
        csv.push_str(&format!("{},{},{},{},{},{},{}\n",
            cell(&r.tanggal), cell(r.petugas.as_deref().unwrap_or("")), cell(&r.kategori),
            cell(&r.judul), cell(r.deskripsi.as_deref().unwrap_or("")),
            r.durasi_menit.map(|x| x.to_string()).unwrap_or_default(), cell(&r.sumber)));
    }
    Ok((
        [(axum::http::header::CONTENT_TYPE, "text/csv; charset=utf-8"),
         (axum::http::header::CONTENT_DISPOSITION, "attachment; filename=\"kinerja_it.csv\"")],
        csv,
    ).into_response())
}

// ── Dashboard: TARIK metrik dari Lapor IT + Permintaan Fitur + aktivitas ─────
pub async fn dashboard(_u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2026));

    // Target SLA penyelesaian tiket (jam). Bisa dioverride lewat ?sla_jam=.
    let sla_jam = q.sla_jam.unwrap_or(24);

    // Tiket (Lapor IT) + SLA: dari tiket yang SUDAH selesai, berapa persen
    // rampung dalam <= target jam. sla_selesai/sla_total dipisah supaya UI bisa
    // menampilkan "12/15 (80%)" alih-alih persen telanjang yang menyesatkan
    // saat sampelnya kecil.
    #[derive(sqlx::FromRow)]
    struct T { total: i64, selesai: i64, diproses: i64, baru: i64, avg_jam: Option<f64>,
               sla_total: i64, sla_tepat: i64 }
    let t: T = sqlx::query_as(
        "SELECT CAST(COUNT(*) AS SIGNED) total,
                CAST(IFNULL(SUM(status='selesai'),0) AS SIGNED) selesai,
                CAST(IFNULL(SUM(status='diproses'),0) AS SIGNED) diproses,
                CAST(IFNULL(SUM(status='baru'),0) AS SIGNED) baru,
                CAST(AVG(CASE WHEN tanggal_selesai IS NOT NULL THEN TIMESTAMPDIFF(HOUR,tanggal_lapor,tanggal_selesai) END) AS DOUBLE) avg_jam,
                CAST(IFNULL(SUM(tanggal_selesai IS NOT NULL),0) AS SIGNED) sla_total,
                CAST(IFNULL(SUM(tanggal_selesai IS NOT NULL AND TIMESTAMPDIFF(HOUR,tanggal_lapor,tanggal_selesai) <= ?),0) AS SIGNED) sla_tepat
         FROM simrscb_lapor_it WHERE YEAR(tanggal_lapor)=?").bind(sla_jam).bind(tahun).fetch_one(&s.pool).await.map_err(db_err)?;
    let sla_persen = if t.sla_total > 0 { (t.sla_tepat as f64 / t.sla_total as f64) * 100.0 } else { 0.0 };

    #[derive(sqlx::FromRow, Serialize)]
    struct PicRow { pic: Option<String>, ditangani: i64, selesai: i64, avg_jam: Option<f64>, avg_menit_tanggap: Option<f64> }
    let per_pic: Vec<PicRow> = sqlx::query_as(
        "SELECT pic_nama pic, CAST(COUNT(*) AS SIGNED) ditangani,
                CAST(IFNULL(SUM(status='selesai'),0) AS SIGNED) selesai,
                CAST(AVG(CASE WHEN tanggal_selesai IS NOT NULL THEN TIMESTAMPDIFF(HOUR,tanggal_lapor,tanggal_selesai) END) AS DOUBLE) avg_jam,
                CAST(AVG(CASE WHEN tanggal_tanggap IS NOT NULL THEN TIMESTAMPDIFF(MINUTE,tanggal_lapor,tanggal_tanggap) END) AS DOUBLE) avg_menit_tanggap
         FROM simrscb_lapor_it WHERE YEAR(tanggal_lapor)=? AND pic_nama IS NOT NULL AND pic_nama<>''
         GROUP BY pic_nama ORDER BY ditangani DESC").bind(tahun).fetch_all(&s.pool).await.unwrap_or_default();

    #[derive(sqlx::FromRow, Serialize)]
    struct Bulan { bulan: i32, masuk: i64, selesai: i64 }
    let per_bulan: Vec<Bulan> = sqlx::query_as(
        "SELECT CAST(MONTH(tanggal_lapor) AS SIGNED) bulan,
                CAST(COUNT(*) AS SIGNED) masuk,
                CAST(IFNULL(SUM(status='selesai'),0) AS SIGNED) selesai
         FROM simrscb_lapor_it WHERE YEAR(tanggal_lapor)=? GROUP BY MONTH(tanggal_lapor) ORDER BY bulan")
        .bind(tahun).fetch_all(&s.pool).await.unwrap_or_default();

    // Aktivitas manual
    #[derive(sqlx::FromRow)]
    struct A { total: i64, menit: Option<i64> }
    let a: A = sqlx::query_as(
        "SELECT CAST(COUNT(*) AS SIGNED) total, CAST(IFNULL(SUM(durasi_menit),0) AS SIGNED) menit
         FROM simrscb_kinerja_it WHERE YEAR(tanggal)=?").bind(tahun).fetch_one(&s.pool).await.map_err(db_err)?;
    #[derive(sqlx::FromRow, Serialize)]
    struct AktPetugas { petugas: Option<String>, jumlah: i64, menit: Option<i64> }
    let akt_per_petugas: Vec<AktPetugas> = sqlx::query_as(
        "SELECT petugas, CAST(COUNT(*) AS SIGNED) jumlah, CAST(IFNULL(SUM(durasi_menit),0) AS SIGNED) menit
         FROM simrscb_kinerja_it WHERE YEAR(tanggal)=? GROUP BY petugas ORDER BY jumlah DESC").bind(tahun)
        .fetch_all(&s.pool).await.unwrap_or_default();
    #[derive(sqlx::FromRow, Serialize)]
    struct KV { k: String, total: i64 }
    let akt_per_kategori: Vec<KV> = sqlx::query_as(
        "SELECT kategori k, CAST(COUNT(*) AS SIGNED) total FROM simrscb_kinerja_it WHERE YEAR(tanggal)=? GROUP BY kategori ORDER BY total DESC")
        .bind(tahun).fetch_all(&s.pool).await.unwrap_or_default();
    #[derive(sqlx::FromRow, Serialize)]
    struct AktBulan { bulan: i32, jumlah: i64, menit: i64 }
    let akt_per_bulan: Vec<AktBulan> = sqlx::query_as(
        "SELECT CAST(MONTH(tanggal) AS SIGNED) bulan, CAST(COUNT(*) AS SIGNED) jumlah,
                CAST(IFNULL(SUM(durasi_menit),0) AS SIGNED) menit
         FROM simrscb_kinerja_it WHERE YEAR(tanggal)=? GROUP BY MONTH(tanggal) ORDER BY bulan")
        .bind(tahun).fetch_all(&s.pool).await.unwrap_or_default();

    // Permintaan Fitur
    #[derive(sqlx::FromRow)]
    struct F { total: i64, selesai: i64, dikerjakan: i64 }
    let f: F = sqlx::query_as(
        "SELECT CAST(COUNT(*) AS SIGNED) total,
                CAST(IFNULL(SUM(status='selesai'),0) AS SIGNED) selesai,
                CAST(IFNULL(SUM(status='dikerjakan'),0) AS SIGNED) dikerjakan
         FROM simrscb_permintaan_fitur WHERE YEAR(tanggal)=?").bind(tahun).fetch_one(&s.pool).await.unwrap_or(F{total:0,selesai:0,dikerjakan:0});

    Ok(Json(json!({
        "tahun": tahun,
        "sla_jam": sla_jam,
        "tiket": {"total": t.total, "selesai": t.selesai, "diproses": t.diproses, "baru": t.baru,
                  "avg_jam": t.avg_jam.unwrap_or(0.0),
                  "sla_persen": sla_persen, "sla_tepat": t.sla_tepat, "sla_total": t.sla_total},
        "tiket_per_pic": per_pic,
        "tiket_per_bulan": per_bulan,
        "aktivitas": {"total": a.total, "total_menit": a.menit.unwrap_or(0)},
        "aktivitas_per_petugas": akt_per_petugas,
        "aktivitas_per_kategori": akt_per_kategori,
        "aktivitas_per_bulan": akt_per_bulan,
        "fitur": {"total": f.total, "selesai": f.selesai, "dikerjakan": f.dikerjakan},
    })))
}

// ── Pencarian pegawai (isian petugas) ────────────────────────────────────────
// Tidak memakai /kepegawaian/pegawai: endpoint itu menanyakan kolom
// jabatan/bagian/status_aktif ke tabel `petugas`, sedangkan skema di sini hanya
// punya nip/nama/kd_jbtn/status — query-nya gagal. Di sini dipakai tabel
// `pegawai` (432 baris) yang memang memuat seluruh karyawan.
#[derive(Deserialize)]
pub struct CariPegawaiQuery { pub q: Option<String> }

#[derive(Serialize, sqlx::FromRow)]
pub struct PegawaiRingkas { pub nik: String, pub nama: String }

pub async fn cari_pegawai(_u: AuthUser, State(s): State<AppState>, Query(q): Query<CariPegawaiQuery>)
  -> Result<Json<Vec<PegawaiRingkas>>, (StatusCode, Json<Value>)> {
    let cari = format!("%{}%", q.q.unwrap_or_default().trim());
    let data: Vec<PegawaiRingkas> = sqlx::query_as(
        "SELECT nik, nama FROM pegawai
         WHERE stts_aktif='AKTIF' AND (nama LIKE ? OR nik LIKE ?)
         ORDER BY nama LIMIT 30")
        .bind(&cari).bind(&cari)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(data))
}

// ── Laporan periode (weekly report) ──────────────────────────────────────────
// Dashboard di atas beragregasi per tahun; rapat mingguan butuh rentang tanggal
// bebas plus pembanding periode sebelumnya agar angkanya punya arti ("naik dari
// berapa?"). Dipisah dari `dashboard` supaya query tahunan yang sudah dipakai
// halaman lain tidak ikut berubah.

#[derive(Deserialize)]
pub struct LaporanQuery {
    pub dari:   String,            // YYYY-MM-DD
    pub sampai: String,            // YYYY-MM-DD, inklusif
    #[serde(default)] pub sla_jam: Option<i64>,
}

/// Batas atas eksklusif: kolom bertipe datetime, jadi `<= sampai` akan memotong
/// kejadian pada hari terakhir yang jamnya di atas 00:00.
fn laporan_err(pesan: &str) -> (StatusCode, Json<Value>) {
    (StatusCode::BAD_REQUEST, Json(json!({ "error": pesan })))
}

pub async fn laporan(_u: AuthUser, State(s): State<AppState>, Query(q): Query<LaporanQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    use chrono::{Duration, NaiveDate};

    let dari = NaiveDate::parse_from_str(&q.dari, "%Y-%m-%d")
        .map_err(|_| laporan_err("Tanggal 'dari' harus format YYYY-MM-DD."))?;
    let sampai = NaiveDate::parse_from_str(&q.sampai, "%Y-%m-%d")
        .map_err(|_| laporan_err("Tanggal 'sampai' harus format YYYY-MM-DD."))?;
    if sampai < dari {
        return Err(laporan_err("Tanggal 'sampai' tidak boleh sebelum 'dari'."));
    }

    let hari = (sampai - dari).num_days() + 1;
    // Pembanding: periode sepanjang ini juga, tepat sebelum `dari`.
    let b_sampai = dari - Duration::days(1);
    let b_dari = b_sampai - Duration::days(hari - 1);

    let akhir   = (sampai + Duration::days(1)).format("%Y-%m-%d").to_string();
    let b_akhir = dari.format("%Y-%m-%d").to_string();
    let b_awal  = b_dari.format("%Y-%m-%d").to_string();
    let sla_jam = q.sla_jam.unwrap_or(24);

    // ── Tiket Lapor IT ───────────────────────────────────────────────────────
    #[derive(sqlx::FromRow)]
    struct Tk { masuk: i64, selesai: i64, baru: i64, diproses: i64,
                avg_jam: Option<f64>, avg_menit_tanggap: Option<f64>,
                sla_total: i64, sla_tepat: i64 }
    const SQL_TIKET: &str =
        "SELECT CAST(COUNT(*) AS SIGNED) masuk,
                CAST(IFNULL(SUM(status='selesai'),0) AS SIGNED) selesai,
                CAST(IFNULL(SUM(status='baru'),0) AS SIGNED) baru,
                CAST(IFNULL(SUM(status='diproses'),0) AS SIGNED) diproses,
                CAST(AVG(CASE WHEN tanggal_selesai IS NOT NULL
                         THEN TIMESTAMPDIFF(HOUR,tanggal_lapor,tanggal_selesai) END) AS DOUBLE) avg_jam,
                CAST(AVG(CASE WHEN tanggal_tanggap IS NOT NULL
                         THEN TIMESTAMPDIFF(MINUTE,tanggal_lapor,tanggal_tanggap) END) AS DOUBLE) avg_menit_tanggap,
                CAST(IFNULL(SUM(tanggal_selesai IS NOT NULL),0) AS SIGNED) sla_total,
                CAST(IFNULL(SUM(tanggal_selesai IS NOT NULL
                         AND TIMESTAMPDIFF(HOUR,tanggal_lapor,tanggal_selesai) <= ?),0) AS SIGNED) sla_tepat
         FROM simrscb_lapor_it WHERE tanggal_lapor >= ? AND tanggal_lapor < ?";

    let t: Tk = sqlx::query_as(SQL_TIKET).bind(sla_jam).bind(&q.dari).bind(&akhir)
        .fetch_one(&s.pool).await.map_err(db_err)?;
    let tb: Tk = sqlx::query_as(SQL_TIKET).bind(sla_jam).bind(&b_awal).bind(&b_akhir)
        .fetch_one(&s.pool).await.map_err(db_err)?;

    let sla_persen = if t.sla_total > 0 {
        (t.sla_tepat as f64 / t.sla_total as f64) * 100.0
    } else { 0.0 };

    // Tiket yang diselesaikan DALAM periode ini — ini yang jadi "capaian minggu
    // ini", berbeda dari tiket yang masuk pada periode yang sama.
    let (tuntas,): (i64,) = sqlx::query_as(
        "SELECT CAST(COUNT(*) AS SIGNED) FROM simrscb_lapor_it
         WHERE tanggal_selesai >= ? AND tanggal_selesai < ?")
        .bind(&q.dari).bind(&akhir).fetch_one(&s.pool).await.unwrap_or((0,));

    #[derive(sqlx::FromRow, Serialize)]
    struct KV { k: Option<String>, total: i64 }
    async fn kelompok(pool: &sqlx::MySqlPool, sql: &str, a: &str, b: &str) -> Vec<KV> {
        sqlx::query_as(sql).bind(a).bind(b).fetch_all(pool).await.unwrap_or_default()
    }

    let tiket_per_kategori = kelompok(&s.pool,
        "SELECT kategori k, CAST(COUNT(*) AS SIGNED) total FROM simrscb_lapor_it
         WHERE tanggal_lapor >= ? AND tanggal_lapor < ? GROUP BY kategori ORDER BY total DESC",
        &q.dari, &akhir).await;
    let tiket_per_unit = kelompok(&s.pool,
        "SELECT unit k, CAST(COUNT(*) AS SIGNED) total FROM simrscb_lapor_it
         WHERE tanggal_lapor >= ? AND tanggal_lapor < ? GROUP BY unit ORDER BY total DESC LIMIT 12",
        &q.dari, &akhir).await;
    let tiket_per_prioritas = kelompok(&s.pool,
        "SELECT prioritas k, CAST(COUNT(*) AS SIGNED) total FROM simrscb_lapor_it
         WHERE tanggal_lapor >= ? AND tanggal_lapor < ? GROUP BY prioritas ORDER BY total DESC",
        &q.dari, &akhir).await;

    #[derive(sqlx::FromRow, Serialize)]
    struct Pic { pic: Option<String>, ditangani: i64, selesai: i64, avg_jam: Option<f64> }
    let per_pic: Vec<Pic> = sqlx::query_as(
        "SELECT pic_nama pic, CAST(COUNT(*) AS SIGNED) ditangani,
                CAST(IFNULL(SUM(status='selesai'),0) AS SIGNED) selesai,
                CAST(AVG(CASE WHEN tanggal_selesai IS NOT NULL
                         THEN TIMESTAMPDIFF(HOUR,tanggal_lapor,tanggal_selesai) END) AS DOUBLE) avg_jam
         FROM simrscb_lapor_it
         WHERE tanggal_lapor >= ? AND tanggal_lapor < ? AND pic_nama IS NOT NULL AND pic_nama<>''
         GROUP BY pic_nama ORDER BY ditangani DESC")
        .bind(&q.dari).bind(&akhir).fetch_all(&s.pool).await.unwrap_or_default();

    // ── Aktivitas manual ─────────────────────────────────────────────────────
    #[derive(sqlx::FromRow)]
    struct Ak { total: i64, menit: i64 }
    const SQL_AKT: &str =
        "SELECT CAST(COUNT(*) AS SIGNED) total, CAST(IFNULL(SUM(durasi_menit),0) AS SIGNED) menit
         FROM simrscb_kinerja_it WHERE tanggal >= ? AND tanggal < ?";
    let a: Ak = sqlx::query_as(SQL_AKT).bind(&q.dari).bind(&akhir)
        .fetch_one(&s.pool).await.map_err(db_err)?;
    let ab: Ak = sqlx::query_as(SQL_AKT).bind(&b_awal).bind(&b_akhir)
        .fetch_one(&s.pool).await.unwrap_or(Ak { total: 0, menit: 0 });

    #[derive(sqlx::FromRow, Serialize)]
    struct AktKat { k: String, total: i64, menit: i64 }
    let akt_per_kategori: Vec<AktKat> = sqlx::query_as(
        "SELECT kategori k, CAST(COUNT(*) AS SIGNED) total,
                CAST(IFNULL(SUM(durasi_menit),0) AS SIGNED) menit
         FROM simrscb_kinerja_it WHERE tanggal >= ? AND tanggal < ?
         GROUP BY kategori ORDER BY total DESC")
        .bind(&q.dari).bind(&akhir).fetch_all(&s.pool).await.unwrap_or_default();

    #[derive(sqlx::FromRow, Serialize)]
    struct AktPet { petugas: Option<String>, jumlah: i64, menit: i64 }
    let akt_per_petugas: Vec<AktPet> = sqlx::query_as(
        "SELECT petugas, CAST(COUNT(*) AS SIGNED) jumlah,
                CAST(IFNULL(SUM(durasi_menit),0) AS SIGNED) menit
         FROM simrscb_kinerja_it WHERE tanggal >= ? AND tanggal < ?
         GROUP BY petugas ORDER BY jumlah DESC")
        .bind(&q.dari).bind(&akhir).fetch_all(&s.pool).await.unwrap_or_default();

    // Deret harian dipakai grafik tren; hari tanpa kejadian tidak muncul di sini
    // dan diisi nol oleh frontend yang memang tahu panjang periodenya.
    #[derive(sqlx::FromRow, Serialize)]
    struct Hari { tanggal: String, jumlah: i64, menit: i64 }
    let akt_per_hari: Vec<Hari> = sqlx::query_as(
        "SELECT DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, CAST(COUNT(*) AS SIGNED) jumlah,
                CAST(IFNULL(SUM(durasi_menit),0) AS SIGNED) menit
         FROM simrscb_kinerja_it WHERE tanggal >= ? AND tanggal < ?
         GROUP BY DATE(tanggal) ORDER BY tanggal")
        .bind(&q.dari).bind(&akhir).fetch_all(&s.pool).await.unwrap_or_default();

    #[derive(sqlx::FromRow, Serialize)]
    struct THari { tanggal: String, masuk: i64, selesai: i64 }
    let tiket_per_hari: Vec<THari> = sqlx::query_as(
        "SELECT DATE_FORMAT(tanggal_lapor,'%Y-%m-%d') tanggal,
                CAST(COUNT(*) AS SIGNED) masuk,
                CAST(IFNULL(SUM(status='selesai'),0) AS SIGNED) selesai
         FROM simrscb_lapor_it WHERE tanggal_lapor >= ? AND tanggal_lapor < ?
         GROUP BY DATE(tanggal_lapor) ORDER BY tanggal")
        .bind(&q.dari).bind(&akhir).fetch_all(&s.pool).await.unwrap_or_default();

    // Daftar rinci untuk slide "apa saja yang dikerjakan".
    let aktivitas_list: Vec<AktivitasRow> = sqlx::query_as(&format!(
        "SELECT {COLS} FROM simrscb_kinerja_it
         WHERE tanggal >= ? AND tanggal < ? ORDER BY tanggal DESC LIMIT 300"))
        .bind(&q.dari).bind(&akhir).fetch_all(&s.pool).await.unwrap_or_default();

    #[derive(sqlx::FromRow, Serialize)]
    struct TiketSelesai { no_tiket: Option<String>, judul: String, unit: Option<String>,
                          pic_nama: Option<String>, prioritas: Option<String>,
                          tanggal_selesai: Option<String>, jam: Option<i64> }
    let tiket_selesai_list: Vec<TiketSelesai> = sqlx::query_as(
        "SELECT no_tiket, judul, unit, pic_nama, prioritas,
                DATE_FORMAT(tanggal_selesai,'%Y-%m-%d %H:%i') tanggal_selesai,
                CAST(TIMESTAMPDIFF(HOUR,tanggal_lapor,tanggal_selesai) AS SIGNED) jam
         FROM simrscb_lapor_it
         WHERE tanggal_selesai >= ? AND tanggal_selesai < ?
         ORDER BY tanggal_selesai DESC LIMIT 300")
        .bind(&q.dari).bind(&akhir).fetch_all(&s.pool).await.unwrap_or_default();

    // ── Permintaan fitur ─────────────────────────────────────────────────────
    #[derive(sqlx::FromRow)]
    struct Ft { masuk: i64, selesai: i64, dikerjakan: i64 }
    let f: Ft = sqlx::query_as(
        "SELECT CAST(COUNT(*) AS SIGNED) masuk,
                CAST(IFNULL(SUM(status='selesai'),0) AS SIGNED) selesai,
                CAST(IFNULL(SUM(status='dikerjakan'),0) AS SIGNED) dikerjakan
         FROM simrscb_permintaan_fitur WHERE tanggal >= ? AND tanggal < ?")
        .bind(&q.dari).bind(&akhir).fetch_one(&s.pool).await
        .unwrap_or(Ft { masuk: 0, selesai: 0, dikerjakan: 0 });

    Ok(Json(json!({
        "periode":  { "dari": q.dari, "sampai": q.sampai, "hari": hari },
        "pembanding": { "dari": b_awal, "sampai": b_sampai.format("%Y-%m-%d").to_string() },
        "tiket": {
            "masuk": t.masuk, "selesai": t.selesai, "baru": t.baru, "diproses": t.diproses,
            "dituntaskan_periode_ini": tuntas,
            "avg_jam": t.avg_jam.unwrap_or(0.0),
            "avg_menit_tanggap": t.avg_menit_tanggap.unwrap_or(0.0),
            "sla_jam": sla_jam, "sla_persen": sla_persen,
            "sla_tepat": t.sla_tepat, "sla_total": t.sla_total,
            "masuk_sebelumnya": tb.masuk, "selesai_sebelumnya": tb.selesai
        },
        "tiket_per_kategori":  tiket_per_kategori,
        "tiket_per_unit":      tiket_per_unit,
        "tiket_per_prioritas": tiket_per_prioritas,
        "tiket_per_pic":       per_pic,
        "tiket_per_hari":      tiket_per_hari,
        "tiket_selesai_list":  tiket_selesai_list,
        "aktivitas": {
            "total": a.total, "total_menit": a.menit,
            "total_sebelumnya": ab.total, "menit_sebelumnya": ab.menit
        },
        "aktivitas_per_kategori": akt_per_kategori,
        "aktivitas_per_petugas":  akt_per_petugas,
        "aktivitas_per_hari":     akt_per_hari,
        "aktivitas_list":         aktivitas_list,
        "fitur": { "masuk": f.masuk, "selesai": f.selesai, "dikerjakan": f.dikerjakan },
    })))
}
