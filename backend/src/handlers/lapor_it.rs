// Lapor IT / Helpdesk — pelaporan gangguan IT oleh unit + penanganan tim IT.
// Termasuk impor riwayat dari ekspor chat grup WhatsApp (.txt).

use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{body::Bytes, extract::{Multipart, Path, Query, State}, http::{header, HeaderMap, StatusCode}, response::{IntoResponse, Response}, Json};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Sha256;
type HmacSha256 = Hmac<Sha256>;

// ── Upload & tampil foto laporan ─────────────────────────────────────────────
fn foto_dir() -> String {
    std::env::var("LAPOR_IT_FOTO_DIR").unwrap_or_else(|_| "/var/www/html/webapps/simrscb/lapor_it".to_string())
}
fn ext_of(name: &str) -> String {
    let e = name.rsplit_once('.').map(|(_, b)| b).unwrap_or("").to_lowercase();
    if !e.is_empty() && e.len() <= 5 && e.chars().all(|c| c.is_ascii_alphanumeric()) { e } else { "bin".into() }
}
fn sanitize_stem(s: &str) -> String {
    let stem = s.rsplit_once('.').map(|(a, _)| a).unwrap_or(s);
    let out: String = stem.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect();
    let out: String = out.trim_matches('-').chars().take(50).collect();
    if out.is_empty() { "foto".into() } else { out }
}
fn img_content_type(ext: &str) -> &'static str {
    match ext { "png" => "image/png", "jpg" | "jpeg" => "image/jpeg", "gif" => "image/gif", "webp" => "image/webp", _ => "application/octet-stream" }
}

async fn get_cfg(pool: &sqlx::MySqlPool, key: &str, default: &str) -> String {
    crate::handlers::simrscb::get_cfg(pool, key, default).await
}
async fn set_cfg(pool: &sqlx::MySqlPool, key: &str, val: &str) {
    let _ = sqlx::query("INSERT INTO simrscb_config (kunci, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai=VALUES(nilai)")
        .bind(key).bind(val).execute(pool).await;
}
fn hex_lower(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes { s.push_str(&format!("{:02x}", b)); }
    s
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error lapor_it: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
// Kelola (ubah status / hapus / impor) = tim IT: admin atau izin lapor_it_kelola.
fn require_kelola(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if has_perm(u, "lapor_it_kelola") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya tim IT (izin lapor_it_kelola) yang boleh mengelola laporan."}))))}
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LaporRow {
    pub id:            i32,
    pub no_tiket:      Option<String>,
    pub tanggal_lapor: String,
    pub unit:          Option<String>,
    pub pelapor:       Option<String>,
    pub kontak:        Option<String>,
    pub kategori:      String,
    pub prioritas:     String,
    pub judul:         String,
    pub deskripsi:     Option<String>,
    pub foto:          Option<String>,
    pub foto_tindakan: Option<String>,
    pub status:        String,
    pub pic_nip:       Option<String>,
    pub pic_nama:      Option<String>,
    pub tindakan:      Option<String>,
    pub tanggal_selesai: Option<String>,
    pub tanggal_tanggap: Option<String>,
    pub menit_tanggap: Option<i64>,
    pub sumber:        String,
    pub created_at:    Option<String>,
}

const COLUMNS: &str = "
  id, no_tiket,
  DATE_FORMAT(tanggal_lapor,'%Y-%m-%d %H:%i:%s') AS tanggal_lapor,
  unit, pelapor, kontak, kategori, prioritas, judul, deskripsi, foto, foto_tindakan,
  status, pic_nip, pic_nama, tindakan,
  DATE_FORMAT(tanggal_selesai,'%Y-%m-%d %H:%i:%s') AS tanggal_selesai,
  DATE_FORMAT(tanggal_tanggap,'%Y-%m-%d %H:%i:%s') AS tanggal_tanggap,
  CASE WHEN tanggal_tanggap IS NOT NULL THEN TIMESTAMPDIFF(MINUTE,tanggal_lapor,tanggal_tanggap) END AS menit_tanggap,
  sumber,
  DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at
";

// ── GET /api/lapor-it ────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct ListQuery {
    pub tahun: Option<i32>, pub status: Option<String>, pub kategori: Option<String>,
    pub prioritas: Option<String>, pub unit: Option<String>, pub q: Option<String>,
}
pub async fn list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQuery>)
  -> Result<Json<Vec<LaporRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|s| !s.trim().is_empty()).map(|s| format!("%{}%", s.trim()));
    let sql = format!(
        "SELECT {} FROM simrscb_lapor_it
         WHERE (? IS NULL OR YEAR(tanggal_lapor)=?)
           AND (? IS NULL OR status=?)
           AND (? IS NULL OR kategori=?)
           AND (? IS NULL OR prioritas=?)
           AND (? IS NULL OR unit=?)
           AND (? IS NULL OR judul LIKE ? OR deskripsi LIKE ? OR pelapor LIKE ? OR no_tiket LIKE ?)
         ORDER BY tanggal_lapor DESC, id DESC LIMIT 1000", COLUMNS);
    let rows: Vec<LaporRow> = sqlx::query_as(&sql)
        .bind(q.tahun).bind(q.tahun)
        .bind(&q.status).bind(&q.status)
        .bind(&q.kategori).bind(&q.kategori)
        .bind(&q.prioritas).bind(&q.prioritas)
        .bind(&q.unit).bind(&q.unit)
        .bind(&qs).bind(&qs).bind(&qs).bind(&qs).bind(&qs)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

pub async fn get_one(_u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<LaporRow>, (StatusCode, Json<Value>)> {
    let sql = format!("SELECT {} FROM simrscb_lapor_it WHERE id=?", COLUMNS);
    let row: Option<LaporRow> = sqlx::query_as(&sql).bind(id).fetch_optional(&s.pool).await.map_err(db_err)?;
    row.map(Json).ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"tidak ditemukan"}))))
}

fn detect_kategori(text: &str) -> &'static str {
    let t = text.to_lowercase();
    let has = |kw: &[&str]| kw.iter().any(|k| t.contains(k));
    if has(&["wifi","internet","jaringan"," lan","koneksi","network","lemot","lambat","putus"]) { "jaringan" }
    else if has(&["print","cetak","toner","tinta","kertas","struk","epson"]) { "printer" }
    else if has(&["simrs","khanza","aplikasi","login","bridging","vclaim","bpjs","error","eror","hang","sistem","antrian","sep"]) { "aplikasi" }
    else if has(&["komputer","pc","laptop","mouse","keyboard","monitor","cpu","layar","mati","restart","booting","hardisk","ram"]) { "hardware" }
    else { "lainnya" }
}
async fn gen_no_tiket(pool: &sqlx::MySqlPool, id: u64) {
    let _ = sqlx::query(
        "UPDATE simrscb_lapor_it SET no_tiket=CONCAT('IT-', DATE_FORMAT(tanggal_lapor,'%Y%m'), '-', LPAD(id,4,'0')) WHERE id=? AND (no_tiket IS NULL OR no_tiket='')")
        .bind(id).execute(pool).await;
}

// ── POST /api/lapor-it (buat laporan — semua user login) ─────────────────────
#[derive(Deserialize)]
pub struct CreateBody {
    #[serde(default)] pub tanggal_lapor: Option<String>,
    #[serde(default)] pub unit: Option<String>,
    #[serde(default)] pub pelapor: Option<String>,
    #[serde(default)] pub kontak: Option<String>,
    #[serde(default)] pub kategori: Option<String>,
    #[serde(default)] pub prioritas: Option<String>,
    pub judul: String,
    #[serde(default)] pub deskripsi: Option<String>,
    #[serde(default)] pub foto: Option<String>,
}
pub async fn create(u: AuthUser, State(s): State<AppState>, Json(b): Json<CreateBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.judul.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Judul wajib diisi"})))); }
    let kategori = b.kategori.filter(|x| !x.trim().is_empty())
        .unwrap_or_else(|| detect_kategori(&format!("{} {}", b.judul, b.deskripsi.as_deref().unwrap_or(""))).to_string());
    let tgl = b.tanggal_lapor.filter(|x| !x.trim().is_empty());
    let r = sqlx::query(
        "INSERT INTO simrscb_lapor_it
         (tanggal_lapor, unit, pelapor, kontak, kategori, prioritas, judul, deskripsi, foto, status, sumber, updated_by)
         VALUES (COALESCE(?, NOW()), ?, ?, ?, ?, ?, ?, ?, ?, 'baru', 'web', ?)")
        .bind(&tgl).bind(&b.unit)
        .bind(b.pelapor.as_deref().filter(|x| !x.trim().is_empty()).unwrap_or(&u.0.nama))
        .bind(&b.kontak).bind(&kategori)
        .bind(b.prioritas.as_deref().unwrap_or("sedang"))
        .bind(b.judul.trim()).bind(&b.deskripsi).bind(&b.foto).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    gen_no_tiket(&s.pool, r.last_insert_id()).await;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("INSERT simrscb_lapor_it judul={:?}", b.judul)).await;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}

// ── PUT /api/lapor-it/:id (kelola: status/tindakan/pic — tim IT) ──────────────
#[derive(Deserialize)]
pub struct UpdateBody {
    #[serde(default)] pub status: Option<String>,
    #[serde(default)] pub prioritas: Option<String>,
    #[serde(default)] pub kategori: Option<String>,
    #[serde(default)] pub tindakan: Option<String>,
    #[serde(default)] pub pic_nip: Option<String>,
    #[serde(default)] pub pic_nama: Option<String>,
    #[serde(default)] pub unit: Option<String>,
    #[serde(default)] pub judul: Option<String>,
    #[serde(default)] pub deskripsi: Option<String>,
    #[serde(default)] pub foto_tindakan: Option<String>,
}
pub async fn update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<UpdateBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_kelola(&u)?;
    // set tanggal_selesai otomatis saat status jadi selesai
    let set_selesai = b.status.as_deref() == Some("selesai");
    sqlx::query(
        "UPDATE simrscb_lapor_it SET
           status=COALESCE(?, status), prioritas=COALESCE(?, prioritas), kategori=COALESCE(?, kategori),
           tindakan=COALESCE(?, tindakan), pic_nip=COALESCE(?, pic_nip), pic_nama=COALESCE(?, pic_nama),
           unit=COALESCE(?, unit), judul=COALESCE(?, judul), deskripsi=COALESCE(?, deskripsi),
           foto_tindakan=COALESCE(?, foto_tindakan),
           tanggal_tanggap = CASE WHEN tanggal_tanggap IS NULL AND (? IN ('diproses','selesai','ditolak')) THEN NOW() ELSE tanggal_tanggap END,
           tanggal_selesai = CASE WHEN ?=1 AND tanggal_selesai IS NULL THEN NOW()
                                  WHEN ?='selesai' THEN tanggal_selesai ELSE
                                  (CASE WHEN ? IS NOT NULL AND ?<>'selesai' THEN NULL ELSE tanggal_selesai END) END,
           updated_by=?
         WHERE id=?")
        .bind(&b.status).bind(&b.prioritas).bind(&b.kategori)
        .bind(&b.tindakan).bind(&b.pic_nip)
        .bind(b.pic_nama.as_deref().or(if b.pic_nip.is_some() { Some(u.0.nama.as_str()) } else { None }))
        .bind(&b.unit).bind(&b.judul).bind(&b.deskripsi)
        .bind(&b.foto_tindakan)
        .bind(&b.status)
        .bind(if set_selesai {1} else {0})
        .bind(&b.status).bind(&b.status).bind(&b.status)
        .bind(&u.0.kode).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("UPDATE simrscb_lapor_it id={} status={:?}", id, b.status)).await;
    Ok(Json(json!({"ok": true})))
}

pub async fn delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_kelola(&u)?;
    sqlx::query("DELETE FROM simrscb_lapor_it WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("DELETE simrscb_lapor_it id={}", id)).await;
    Ok(Json(json!({"ok": true})))
}

// ── GET /api/lapor-it/rekap?tahun=YYYY ───────────────────────────────────────
pub async fn rekap(_u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2026));
    let sla: i64 = get_cfg(&s.pool, "lapor_it_sla_tanggap_menit", "15").await.trim().parse().unwrap_or(15);
    #[derive(sqlx::FromRow)]
    struct Ag { total: i64, baru: i64, diproses: i64, selesai: i64, ditolak: i64, avg_jam: Option<f64>,
                avg_menit_tanggap: Option<f64>, n_tanggap: i64, n_sla_ok: i64 }
    let ag: Ag = sqlx::query_as(
        "SELECT CAST(COUNT(*) AS SIGNED) total,
                CAST(IFNULL(SUM(status='baru'),0) AS SIGNED) baru,
                CAST(IFNULL(SUM(status='diproses'),0) AS SIGNED) diproses,
                CAST(IFNULL(SUM(status='selesai'),0) AS SIGNED) selesai,
                CAST(IFNULL(SUM(status='ditolak'),0) AS SIGNED) ditolak,
                CAST(AVG(CASE WHEN tanggal_selesai IS NOT NULL THEN TIMESTAMPDIFF(HOUR,tanggal_lapor,tanggal_selesai) END) AS DOUBLE) avg_jam,
                CAST(AVG(CASE WHEN tanggal_tanggap IS NOT NULL THEN TIMESTAMPDIFF(MINUTE,tanggal_lapor,tanggal_tanggap) END) AS DOUBLE) avg_menit_tanggap,
                CAST(SUM(tanggal_tanggap IS NOT NULL) AS SIGNED) n_tanggap,
                CAST(IFNULL(SUM(tanggal_tanggap IS NOT NULL AND TIMESTAMPDIFF(MINUTE,tanggal_lapor,tanggal_tanggap)<=?),0) AS SIGNED) n_sla_ok
         FROM simrscb_lapor_it WHERE YEAR(tanggal_lapor)=?").bind(sla).bind(tahun)
        .fetch_one(&s.pool).await.map_err(db_err)?;
    let sla_persen = if ag.n_tanggap > 0 { ag.n_sla_ok as f64 / ag.n_tanggap as f64 * 100.0 } else { 0.0 };
    #[derive(sqlx::FromRow, Serialize)]
    struct KV { k: String, total: i64 }
    let per_kategori: Vec<KV> = sqlx::query_as(
        "SELECT kategori k, CAST(COUNT(*) AS SIGNED) total FROM simrscb_lapor_it WHERE YEAR(tanggal_lapor)=? GROUP BY kategori ORDER BY total DESC")
        .bind(tahun).fetch_all(&s.pool).await.unwrap_or_default();
    let per_unit: Vec<KV> = sqlx::query_as(
        "SELECT IFNULL(NULLIF(unit,''),'(tidak diisi)') k, CAST(COUNT(*) AS SIGNED) total FROM simrscb_lapor_it WHERE YEAR(tanggal_lapor)=? GROUP BY unit ORDER BY total DESC LIMIT 15")
        .bind(tahun).fetch_all(&s.pool).await.unwrap_or_default();
    Ok(Json(json!({"tahun": tahun, "ringkasan": {
        "total": ag.total, "baru": ag.baru, "diproses": ag.diproses, "selesai": ag.selesai,
        "ditolak": ag.ditolak, "avg_jam_penyelesaian": ag.avg_jam.unwrap_or(0.0),
        "avg_menit_tanggap": ag.avg_menit_tanggap.unwrap_or(0.0), "sla_menit": sla,
        "sla_persen": sla_persen, "n_tanggap": ag.n_tanggap},
        "per_kategori": per_kategori, "per_unit": per_unit})))
}

// ── Impor ekspor WhatsApp ────────────────────────────────────────────────────
#[derive(Serialize)]
pub struct ParsedMsg {
    pub(crate) tanggal: String, pub(crate) pelapor: String, pub(crate) kategori: String,
    pub(crate) judul: String, pub(crate) deskripsi: String, pub(crate) ada_media: bool,
}

// Parse cap waktu WA → "YYYY-MM-DD HH:MM:SS". Dukung "8/6/26 14.30", "08/06/2026, 2:30 PM",
// "8/6/2026 14.30.15". Asumsi urutan tanggal D/M/Y (locale Indonesia).
fn parse_stamp(s: &str) -> Option<String> {
    let s = s.trim().trim_end_matches(',');
    let norm = s.replace(',', " ");
    let parts: Vec<&str> = norm.split_whitespace().collect(); // split_whitespace juga menangani U+202F
    if parts.len() < 2 { return None; }
    let dsep: Vec<&str> = parts[0].split(|c| c == '/' || c == '.' || c == '-').collect();
    if dsep.len() != 3 { return None; }
    let d: i32 = dsep[0].trim().parse().ok()?;
    let mo: i32 = dsep[1].trim().parse().ok()?;
    let mut y: i32 = dsep[2].trim().parse().ok()?;
    if y < 100 { y += 2000; }
    let tsep: Vec<&str> = parts[1].split(|c| c == ':' || c == '.').collect();
    if tsep.len() < 2 { return None; }
    let mut hh: i32 = tsep[0].trim().parse().ok()?;
    let mi: i32 = tsep[1].trim().parse().ok()?;
    let ss: i32 = tsep.get(2).and_then(|x| x.trim().parse().ok()).unwrap_or(0);
    if let Some(ap) = parts.get(2) {
        if ap.eq_ignore_ascii_case("PM") && hh < 12 { hh += 12; }
        if ap.eq_ignore_ascii_case("AM") && hh == 12 { hh = 0; }
    }
    if !(1..=31).contains(&d) || !(1..=12).contains(&mo) || !(0..=23).contains(&hh) || !(0..=59).contains(&mi) { return None; }
    Some(format!("{:04}-{:02}-{:02} {:02}:{:02}:{:02}", y, mo, d, hh, mi, ss))
}
// Deteksi baris awal pesan → (tanggal, "Nama: pesan"). None = baris lanjutan.
fn parse_head(line: &str) -> Option<(String, String)> {
    let l = line.trim_start();
    if let Some(rest) = l.strip_prefix('[') {           // iOS: [tanggal waktu] Nama: pesan
        let end = rest.find(']')?;
        let dt = parse_stamp(&rest[..end])?;
        return Some((dt, rest[end + 1..].trim_start().to_string()));
    }
    let idx = l.find(" - ")?;                           // Android: tanggal waktu - Nama: pesan
    let dt = parse_stamp(&l[..idx])?;
    Some((dt, l[idx + 3..].to_string()))
}

// Pisah ekspor chat WA jadi pesan-pesan (dukung format Android & iOS, ID & EN).
pub(crate) fn parse_wa(text: &str) -> Vec<ParsedMsg> {
    let sys_kw = ["end-to-end encrypted","end-to-end terenkripsi","created group","membuat grup",
        "added","menambahkan","left","keluar","removed","mengeluarkan","changed the subject","mengubah subjek",
        "changed this group","mengubah ikon","changed their phone number","security code","kode keamanan",
        "this message was deleted","pesan ini telah dihapus","you deleted this message","menghapus pesan ini",
        "changed to","messages you send"];
    let media_kw = ["<media omitted>","<media tidak disertakan>","(file terlampir)","(file attached)","image omitted","gambar tidak disertakan"];

    let mut out: Vec<ParsedMsg> = Vec::new();
    let mut cur: Option<(String, String, String)> = None; // (tanggal, pelapor, body)
    let flush = |cur: &Option<(String,String,String)>, out: &mut Vec<ParsedMsg>| {
        if let Some((tgl, pelapor, body)) = cur {
            let low = body.to_lowercase();
            if sys_kw.iter().any(|k| low.contains(k)) { return; }
            let ada_media = media_kw.iter().any(|k| low.contains(k));
            let clean: String = body.lines().map(|l| l.trim()).collect::<Vec<_>>().join(" ");
            let clean = clean.trim().to_string();
            if clean.is_empty() && !ada_media { return; }
            let judul: String = clean.chars().take(70).collect();
            out.push(ParsedMsg {
                tanggal: tgl.clone(), pelapor: pelapor.clone(),
                kategori: detect_kategori(&format!("{} {}", pelapor, body)).to_string(),
                judul: if judul.is_empty() { "(media)".into() } else { judul },
                deskripsi: if clean.is_empty() { "[berisi media/gambar]".into() } else { clean },
                ada_media,
            });
        }
    };
    for raw in text.lines() {
        let line = raw.trim_end_matches('\r');
        if let Some((tgl, rest)) = parse_head(line) {
            flush(&cur, &mut out);
            // rest = "Nama: pesan"; tanpa ": " → notifikasi sistem (lewati)
            match rest.split_once(": ") {
                Some((nama, msg)) => cur = Some((tgl, nama.trim().to_string(), msg.to_string())),
                None => cur = None,
            }
        } else if let Some((_, _, body)) = cur.as_mut() {
            body.push('\n'); body.push_str(line); // baris lanjutan multi-baris
        }
    }
    flush(&cur, &mut out);
    out
}

#[derive(Deserialize)]
pub struct ImportBody {
    pub text: String,
    #[serde(default)] pub apply: Option<bool>,
    #[serde(default)] pub default_status: Option<String>, // status utk data lama (default 'selesai')
    #[serde(default)] pub default_unit: Option<String>,
}
pub async fn import_wa(u: AuthUser, State(s): State<AppState>, Json(b): Json<ImportBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_kelola(&u)?;
    let msgs = parse_wa(&b.text);
    let apply = b.apply.unwrap_or(false);
    let status = b.default_status.as_deref().unwrap_or("selesai");
    if !apply {
        let sample: Vec<&ParsedMsg> = msgs.iter().take(15).collect();
        return Ok(Json(json!({"ok": true, "apply": false, "terdeteksi": msgs.len(), "contoh": sample,
            "catatan": "Pratinjau — kirim apply=true untuk menyimpan."})));
    }
    let mut baru = 0i64; let mut lewati = 0i64;
    for m in &msgs {
        // dedup: sumber wa_import + tanggal + pelapor + judul sama → lewati
        let dup: Option<(i64,)> = sqlx::query_as(
            "SELECT id FROM simrscb_lapor_it WHERE sumber='wa_import' AND tanggal_lapor=? AND pelapor=? AND judul=? LIMIT 1")
            .bind(&m.tanggal).bind(&m.pelapor).bind(&m.judul)
            .fetch_optional(&s.pool).await.ok().flatten();
        if dup.is_some() { lewati += 1; continue; }
        let r = sqlx::query(
            "INSERT INTO simrscb_lapor_it
             (tanggal_lapor, unit, pelapor, kategori, prioritas, judul, deskripsi, status, sumber, updated_by)
             VALUES (?,?,?,?,'sedang',?,?,?, 'wa_import', ?)")
            .bind(&m.tanggal)
            .bind(b.default_unit.as_deref().filter(|x| !x.trim().is_empty()))
            .bind(&m.pelapor).bind(&m.kategori).bind(&m.judul).bind(&m.deskripsi)
            .bind(status).bind(&u.0.kode)
            .execute(&s.pool).await.map_err(db_err)?;
        gen_no_tiket(&s.pool, r.last_insert_id()).await;
        baru += 1;
    }
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("IMPORT WA simrscb_lapor_it baru={} lewati={}", baru, lewati)).await;
    Ok(Json(json!({"ok": true, "apply": true, "terdeteksi": msgs.len(), "baru": baru, "dilewati_duplikat": lewati})))
}

// ── Sinkron Otomatis Realtime via go-whatsapp-web-multidevice ────────────────
// go-whatsapp kirim POST tiap pesan grup masuk → langsung jadi tiket.
// Verifikasi header X-Hub-Signature-256: sha256=<hmac_sha256(body, secret)>.

// Config (admin): set group JID yg dipantau + secret webhook.
pub async fn wa_config_get(u: AuthUser, State(s): State<AppState>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !u.0.is_admin { return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya admin"})))); }
    let group = get_cfg(&s.pool, "lapor_it_wa_group", "").await;
    let has_secret = !get_cfg(&s.pool, "lapor_it_wa_secret", "").await.is_empty();
    let status_default = get_cfg(&s.pool, "lapor_it_wa_status", "baru").await;
    Ok(Json(json!({"group": group, "has_secret": has_secret, "status_default": status_default,
        "webhook_path": "/api/lapor-it/webhook-wa"})))
}
#[derive(Deserialize)]
pub struct WaConfigBody {
    #[serde(default)] pub group: Option<String>,
    #[serde(default)] pub secret: Option<String>,
    #[serde(default)] pub status_default: Option<String>,
}
pub async fn wa_config_set(u: AuthUser, State(s): State<AppState>, Json(b): Json<WaConfigBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !u.0.is_admin { return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya admin"})))); }
    if let Some(g) = b.group { set_cfg(&s.pool, "lapor_it_wa_group", g.trim()).await; }
    if let Some(sec) = b.secret.filter(|x| !x.is_empty()) { set_cfg(&s.pool, "lapor_it_wa_secret", sec.trim()).await; }
    if let Some(st) = b.status_default { set_cfg(&s.pool, "lapor_it_wa_status", st.trim()).await; }
    Ok(Json(json!({"ok": true})))
}

// Webhook PUBLIC (tanpa AuthUser) — diamankan oleh HMAC secret.
pub async fn webhook_wa(State(s): State<AppState>, headers: HeaderMap, body: Bytes)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let secret = get_cfg(&s.pool, "lapor_it_wa_secret", "").await;
    if secret.is_empty() {
        return Err((StatusCode::SERVICE_UNAVAILABLE, Json(json!({"error":"webhook WA belum dikonfigurasi (secret kosong)"}))));
    }
    // Verifikasi signature
    let sig_hdr = headers.get("X-Hub-Signature-256").and_then(|v| v.to_str().ok()).unwrap_or("");
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"hmac"}))))?;
    mac.update(&body);
    let expected = format!("sha256={}", hex_lower(&mac.finalize().into_bytes()));
    if sig_hdr != expected {
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error":"signature tidak cocok"}))));
    }
    // Parse payload
    let v: Value = serde_json::from_slice(&body).map_err(|_| (StatusCode::BAD_REQUEST, Json(json!({"error":"body bukan JSON"}))))?;
    if v.get("event").and_then(|x| x.as_str()) != Some("message") {
        return Ok(Json(json!({"ok": true, "ignored": "bukan event message"})));
    }
    let p = &v["payload"];
    let chat_id = p.get("chat_id").and_then(|x| x.as_str()).unwrap_or("");
    let is_from_me = p.get("is_from_me").and_then(|x| x.as_bool()).unwrap_or(false);
    let text = p.get("body").and_then(|x| x.as_str()).unwrap_or("").trim().to_string();
    let msg_id = p.get("id").and_then(|x| x.as_str()).unwrap_or("").to_string();
    let sender = p.get("from_name").and_then(|x| x.as_str())
        .or_else(|| p.get("sender_display_name").and_then(|x| x.as_str()))
        .unwrap_or("").to_string();
    let ts = p.get("timestamp").and_then(|x| x.as_str()).unwrap_or("");

    // Hanya pesan GRUP, bukan dari bot sendiri, isi tak kosong
    if !chat_id.ends_with("@g.us") || is_from_me || text.is_empty() {
        return Ok(Json(json!({"ok": true, "ignored": "bukan pesan grup masuk / kosong"})));
    }
    // Filter grup (opsional, comma-separated)
    let allow = get_cfg(&s.pool, "lapor_it_wa_group", "").await;
    if !allow.trim().is_empty() && !allow.split(',').any(|g| g.trim() == chat_id) {
        return Ok(Json(json!({"ok": true, "ignored": "grup tidak dipantau"})));
    }
    // Dedup by wa_msg_id
    if !msg_id.is_empty() {
        let dup: Option<(i64,)> = sqlx::query_as("SELECT id FROM simrscb_lapor_it WHERE wa_msg_id=? LIMIT 1")
            .bind(&msg_id).fetch_optional(&s.pool).await.ok().flatten();
        if dup.is_some() { return Ok(Json(json!({"ok": true, "ignored": "duplikat"}))); }
    }
    // Waktu: RFC3339 (UTC) → WIB
    let tgl = chrono::DateTime::parse_from_rfc3339(ts).ok()
        .map(|dt| dt.with_timezone(&chrono::FixedOffset::east_opt(7*3600).unwrap()).format("%Y-%m-%d %H:%M:%S").to_string());
    let kategori = detect_kategori(&text);
    let judul: String = text.chars().take(70).collect();
    let status = get_cfg(&s.pool, "lapor_it_wa_status", "baru").await;

    let r = sqlx::query(
        "INSERT INTO simrscb_lapor_it
         (tanggal_lapor, pelapor, kategori, prioritas, judul, deskripsi, status, sumber, wa_msg_id, updated_by)
         VALUES (COALESCE(?, NOW()), ?, ?, 'sedang', ?, ?, ?, 'wa_webhook', ?, 'wa-bot')")
        .bind(&tgl).bind(&sender).bind(kategori).bind(&judul).bind(&text)
        .bind(if status.is_empty() {"baru"} else {status.as_str()}).bind(&msg_id)
        .execute(&s.pool).await.map_err(db_err)?;
    gen_no_tiket(&s.pool, r.last_insert_id()).await;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}

// POST multipart field `file` — upload 1 gambar, kembalikan url. Semua user login.
pub async fn upload_foto(_u: AuthUser, State(s): State<AppState>, mut mp: Multipart)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let _ = &s;
    let dir = foto_dir();
    tokio::fs::create_dir_all(&dir).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("mkdir: {}", e)}))))?;
    while let Some(field) = mp.next_field().await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": format!("multipart: {}", e)}))))? {
        if field.name() == Some("file") {
            let orig = field.file_name().unwrap_or("foto").to_string();
            let bytes = field.bytes().await
                .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": format!("baca file: {}", e)}))))?;
            if bytes.is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "file kosong"})))); }
            if bytes.len() > 8 * 1024 * 1024 { return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "maks 8MB"})))); }
            let ext = ext_of(&orig);
            if img_content_type(&ext) == "application/octet-stream" {
                return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "hanya gambar (jpg/png/gif/webp)"}))));
            }
            let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
            let stored = format!("{}-{}.{}", sanitize_stem(&orig), ts, ext);
            tokio::fs::write(format!("{}/{}", dir, stored), &bytes).await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("tulis: {}", e)}))))?;
            let url = format!("/api/lapor-it/foto/{}", stored);
            return Ok(Json(json!({"ok": true, "url": url})));
        }
    }
    Err((StatusCode::BAD_REQUEST, Json(json!({"error": "field 'file' wajib"}))))
}

// GET foto — publik (dibuka via <img src>).
pub async fn foto_serve(Path(name): Path<String>) -> Result<Response, (StatusCode, Json<Value>)> {
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "nama tidak valid"}))));
    }
    let path = format!("{}/{}", foto_dir(), name);
    let bytes = tokio::fs::read(&path).await
        .map_err(|_| (StatusCode::NOT_FOUND, Json(json!({"error": "tidak ditemukan"}))))?;
    let ct = img_content_type(&ext_of(&name));
    Ok(([(header::CONTENT_TYPE, ct.to_string()),
         (header::CACHE_CONTROL, "private, max-age=86400".to_string())], bytes).into_response())
}
