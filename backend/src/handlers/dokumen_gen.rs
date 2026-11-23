// Generator Dokumen Mutu — SK Direktur & SPO/SOP. Isi terstruktur di DB,
// kop + tabel + TTD otomatis, ekspor .docx/.pdf via LibreOffice headless.

use crate::{auth::middleware::AuthUser, handlers::web_perms::require_perm, AppState};
use axum::{extract::{Path, Query, State}, http::{header, StatusCode}, response::{IntoResponse, Response}, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB dokumen_gen: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn foto_dir() -> String {
    std::env::var("LAPOR_IT_FOTO_DIR").unwrap_or_else(|_| "/var/www/html/webapps/simrscb/lapor_it".to_string())
}
fn dok_dir() -> String {
    std::env::var("DOK_GEN_DIR").unwrap_or_else(|_| "/var/www/html/webapps/simrscb/dokumen".to_string())
}
fn dok_file(id: i32) -> String { format!("{}/dok_{}.docx", dok_dir(), id) }
fn soffice_bin() -> &'static str {
    if std::path::Path::new("/usr/bin/soffice").exists() { "/usr/bin/soffice" } else { "soffice" }
}
// Konversi via LibreOffice: input file → format (mengembalikan bytes hasil).
async fn convert_file(in_path: &str, conv: &str, out_ext: &str) -> Result<Vec<u8>, String> {
    let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|x| x.as_nanos()).unwrap_or(0);
    let work = format!("/tmp/dokconv_{}", ts);
    tokio::fs::create_dir_all(&work).await.map_err(|e| e.to_string())?;
    let out = tokio::process::Command::new(soffice_bin())
        .args(["--headless","--norestore", &format!("-env:UserInstallation=file://{}/profile", work),
               "--convert-to", conv, "--outdir", &work, in_path])
        .output().await.map_err(|e| format!("soffice: {}", e))?;
    if !out.status.success() {
        let _ = tokio::fs::remove_dir_all(&work).await;
        return Err(format!("konversi gagal: {}", String::from_utf8_lossy(&out.stderr)));
    }
    let stem = std::path::Path::new(in_path).file_stem().and_then(|x| x.to_str()).unwrap_or("doc");
    let bytes = tokio::fs::read(format!("{}/{}.{}", work, stem, out_ext)).await.map_err(|e| e.to_string());
    let _ = tokio::fs::remove_dir_all(&work).await;
    bytes.map_err(|e| format!("baca hasil: {}", e))
}
// Render template → tulis .docx editable ke dok_file bila belum ada. Kembalikan path.
async fn ensure_docx(pool: &sqlx::MySqlPool, d: &DokRow) -> Result<String, String> {
    let path = dok_file(d.id);
    if tokio::fs::metadata(&path).await.is_ok() { return Ok(path); }
    tokio::fs::create_dir_all(dok_dir()).await.map_err(|e| e.to_string())?;
    let html = render_doc(pool, d, true).await;
    let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|x| x.as_nanos()).unwrap_or(0);
    let work = format!("/tmp/dokgen_{}", ts);
    tokio::fs::create_dir_all(&work).await.map_err(|e| e.to_string())?;
    let in_html = format!("{}/doc.html", work);
    tokio::fs::write(&in_html, html.as_bytes()).await.map_err(|e| e.to_string())?;
    let bytes = convert_file(&in_html, "docx:MS Word 2007 XML", "docx").await;
    let _ = tokio::fs::remove_dir_all(&work).await;
    let bytes = bytes?;
    tokio::fs::write(&path, &bytes).await.map_err(|e| e.to_string())?;
    Ok(path)
}
// JWT untuk OnlyOffice (HS256, secret di simrscb_config).
fn oo_sign(secret: &str, claims: &Value) -> String {
    jsonwebtoken::encode(&jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
        claims, &jsonwebtoken::EncodingKey::from_secret(secret.as_bytes())).unwrap_or_default()
}
fn oo_verify(secret: &str, token: &str) -> Option<Value> {
    let mut v = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
    v.validate_exp = false; v.required_spec_claims.clear();
    jsonwebtoken::decode::<Value>(token, &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes()), &v).ok().map(|d| d.claims)
}
async fn get_cfg(pool: &sqlx::MySqlPool, key: &str, default: &str) -> String {
    crate::handlers::simrscb::get_cfg(pool, key, default).await
}
fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}
fn esc_br(s: &str) -> String { esc(s).replace('\n', "<br>") }

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DokRow {
    pub id: i32, pub jenis: String, pub nomor: Option<String>, pub judul: String,
    pub tanggal: Option<String>, pub no_revisi: Option<String>, pub unit: Option<String>,
    pub pejabat_nama: Option<String>, pub pejabat_nip: Option<String>, pub pejabat_jabatan: Option<String>,
    pub ttd_img: Option<String>, pub kd_ep: Option<String>, pub status: String,
    pub data: Option<Value>, pub updated_at: Option<String>, pub updated_by: Option<String>,
}
const COLS: &str = "id, jenis, nomor, judul, DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal, no_revisi, unit,
  pejabat_nama, pejabat_nip, pejabat_jabatan, ttd_img, kd_ep, status, data,
  DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at, updated_by";

#[derive(Deserialize)]
pub struct ListQuery { pub jenis: Option<String>, pub q: Option<String>, pub tahun: Option<i32>, pub kd_ep: Option<String> }
pub async fn list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQuery>)
  -> Result<Json<Vec<DokRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!(
        "SELECT {} FROM simrscb_dokumen_gen
         WHERE (? IS NULL OR jenis=?) AND (? IS NULL OR YEAR(tanggal)=?)
           AND (? IS NULL OR kd_ep=?) AND (? IS NULL OR judul LIKE ? OR nomor LIKE ?)
         ORDER BY updated_at DESC, id DESC LIMIT 1000", COLS);
    let rows: Vec<DokRow> = sqlx::query_as(&sql)
        .bind(&q.jenis).bind(&q.jenis).bind(q.tahun).bind(q.tahun)
        .bind(&q.kd_ep).bind(&q.kd_ep).bind(&qs).bind(&qs).bind(&qs)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
pub async fn get_one(_u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<DokRow>, (StatusCode, Json<Value>)> {
    let row: Option<DokRow> = sqlx::query_as(&format!("SELECT {} FROM simrscb_dokumen_gen WHERE id=?", COLS))
        .bind(id).fetch_optional(&s.pool).await.map_err(db_err)?;
    row.map(Json).ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"tidak ditemukan"}))))
}

fn bulan_romawi(m: u32) -> &'static str {
    ["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"].get(m as usize).copied().unwrap_or("")
}
// Saran nomor otomatis (bisa diedit user).
#[derive(Deserialize)]
pub struct NextQuery { pub jenis: String, #[serde(default)] pub unit: Option<String>, #[serde(default)] pub sub: Option<String>, #[serde(default)] pub klas: Option<String> }
pub async fn next_nomor(_u: AuthUser, State(s): State<AppState>, Query(q): Query<NextQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let now = chrono::Local::now();
    let (y, m): (i32, u32) = (now.format("%Y").to_string().parse().unwrap_or(2026), now.format("%m").to_string().parse().unwrap_or(1));
    let cnt: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM simrscb_dokumen_gen WHERE jenis=? AND YEAR(IFNULL(tanggal,NOW()))=?")
        .bind(&q.jenis).bind(y).fetch_one(&s.pool).await.unwrap_or((0,));
    let urut = cnt.0 + 1;
    let nomor = if q.jenis == "spo" {
        let unit = q.unit.as_deref().filter(|x| !x.trim().is_empty()).unwrap_or("TU");
        let sub = q.sub.as_deref().filter(|x| !x.trim().is_empty()).unwrap_or("UMUM");
        format!("SPO/{}/{}/{:03}", unit.to_uppercase(), sub.to_uppercase(), urut)
    } else {
        let klas = q.klas.as_deref().filter(|x| !x.trim().is_empty()).unwrap_or("KP.03.01");
        format!("{}/{:03}/RSUD-CB/{}/{}", klas, urut, bulan_romawi(m), y)
    };
    Ok(Json(json!({"nomor": nomor})))
}

#[derive(Deserialize)]
pub struct SaveBody {
    pub jenis: String, #[serde(default)] pub nomor: Option<String>, pub judul: String,
    #[serde(default)] pub tanggal: Option<String>, #[serde(default)] pub no_revisi: Option<String>,
    #[serde(default)] pub unit: Option<String>, #[serde(default)] pub pejabat_nama: Option<String>,
    #[serde(default)] pub pejabat_nip: Option<String>, #[serde(default)] pub pejabat_jabatan: Option<String>,
    #[serde(default)] pub ttd_img: Option<String>, #[serde(default)] pub kd_ep: Option<String>,
    #[serde(default)] pub status: Option<String>, #[serde(default)] pub data: Option<Value>,
}
pub async fn create(u: AuthUser, State(s): State<AppState>, Json(b): Json<SaveBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&u, "akreditasi_edit")?;
    if b.judul.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Judul/Tentang wajib"})))); }
    let r = sqlx::query(
        "INSERT INTO simrscb_dokumen_gen (jenis, nomor, judul, tanggal, no_revisi, unit, pejabat_nama, pejabat_nip, pejabat_jabatan, ttd_img, kd_ep, status, data, updated_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.jenis).bind(&b.nomor).bind(b.judul.trim()).bind(b.tanggal.filter(|x| !x.trim().is_empty()))
        .bind(&b.no_revisi).bind(&b.unit).bind(&b.pejabat_nama).bind(&b.pejabat_nip)
        .bind(b.pejabat_jabatan.as_deref().unwrap_or("Direktur RSUD Cabangbungin"))
        .bind(&b.ttd_img).bind(&b.kd_ep).bind(b.status.as_deref().unwrap_or("draft")).bind(&b.data).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("INSERT dokumen_gen jenis={} judul={:?}", b.jenis, b.judul)).await;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<SaveBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&u, "akreditasi_edit")?;
    sqlx::query(
        "UPDATE simrscb_dokumen_gen SET nomor=?, judul=?, tanggal=?, no_revisi=?, unit=?, pejabat_nama=?, pejabat_nip=?, pejabat_jabatan=?, ttd_img=?, kd_ep=?, status=?, data=?, updated_by=? WHERE id=?")
        .bind(&b.nomor).bind(b.judul.trim()).bind(b.tanggal.filter(|x| !x.trim().is_empty()))
        .bind(&b.no_revisi).bind(&b.unit).bind(&b.pejabat_nama).bind(&b.pejabat_nip)
        .bind(b.pejabat_jabatan.as_deref().unwrap_or("Direktur RSUD Cabangbungin"))
        .bind(&b.ttd_img).bind(&b.kd_ep).bind(b.status.as_deref().unwrap_or("draft")).bind(&b.data).bind(&u.0.kode).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&u, "akreditasi_edit")?;
    sqlx::query("DELETE FROM simrscb_dokumen_gen WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("DELETE dokumen_gen id={}", id)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Render HTML ──────────────────────────────────────────────────────────────
fn arr(data: &Option<Value>, key: &str) -> Vec<String> {
    data.as_ref().and_then(|d| d.get(key)).and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect()).unwrap_or_default()
}
fn field(data: &Option<Value>, key: &str) -> String {
    data.as_ref().and_then(|d| d.get(key)).and_then(|v| v.as_str()).unwrap_or("").to_string()
}
// Ubah url /api/lapor-it/foto/NAME → file:///.../NAME utk soffice; atau biarkan http utk preview.
fn img_src(url: &str, for_export: bool) -> String {
    if !for_export { return url.to_string(); }
    if let Some(name) = url.rsplit('/').next() {
        if !name.is_empty() && !name.contains("..") { return format!("file://{}/{}", foto_dir(), name); }
    }
    url.to_string()
}
async fn kop_html(pool: &sqlx::MySqlPool, for_export: bool) -> String {
    let l1 = get_cfg(pool, "dokumen_kop_logo_kiri", "").await;
    let l2 = get_cfg(pool, "dokumen_kop_logo_kanan", "").await;
    let img = |u: &str| if u.trim().is_empty() { String::new() } else { format!("<img src=\"{}\" style=\"height:70px\">", img_src(u, for_export)) };
    format!(r#"<table style="width:100%;border:none;border-collapse:collapse"><tr>
        <td style="border:none;width:80px;text-align:center">{}</td>
        <td style="border:none;text-align:center">
          <div style="font-size:13pt">DINAS KESEHATAN KABUPATEN BEKASI</div>
          <div style="font-size:17pt;font-weight:bold">RUMAH SAKIT UMUM DAERAH CABANGBUNGIN</div>
          <div style="font-size:8pt">Kp. Bojong RT 004/RW 001 Ds. Jayalaksana Kec. Cabangbungin Kab. Bekasi 17720</div>
          <div style="font-size:8pt">Telp. (021) 85923366 &middot; Email: rsud.cabangbungin@gmail.com</div>
        </td>
        <td style="border:none;width:80px;text-align:center">{}</td>
      </tr></table><hr style="border:1px solid #000;margin:2px 0 12px">"#, img(&l1), img(&l2))
}
fn ttd_block(d: &DokRow, for_export: bool) -> String {
    let ttd = d.ttd_img.as_deref().filter(|x| !x.trim().is_empty())
        .map(|u| format!("<img src=\"{}\" style=\"height:90px\"><br>", img_src(u, for_export))).unwrap_or_else(|| "<br><br><br><br>".into());
    let nama = esc(d.pejabat_nama.as_deref().unwrap_or(""));
    let pangkat = esc(&field(&d.data, "pejabat_pangkat"));
    let nip = esc(d.pejabat_nip.as_deref().unwrap_or(""));
    format!("{}<u><b>{}</b></u>{}{}", ttd, nama,
        if pangkat.is_empty() { String::new() } else { format!("<br>{}", pangkat) },
        if nip.is_empty() { String::new() } else { format!("<br>NIP. {}", nip) })
}

async fn render_sk(pool: &sqlx::MySqlPool, d: &DokRow, for_export: bool) -> String {
    let kop = kop_html(pool, for_export).await;
    // items: penanda a/b/c (alpha) atau 1/2/3 (numeric)
    let li = |items: &[String], numeric: bool| {
        let mut out = String::new();
        for (i, it) in items.iter().enumerate() {
            let mark = if numeric { format!("{}.", i + 1) } else { format!("{}.", (b'a' + (i as u8)) as char) };
            out.push_str(&format!("<tr><td style=\"border:none;vertical-align:top;width:24px\">{}</td><td style=\"border:none;text-align:justify\">{}</td></tr>", mark, esc_br(it)));
        }
        format!("<table style=\"border:none;border-collapse:collapse\">{}</table>", out)
    };
    let baris = |label: &str, isi: String| format!(
        "<tr><td style=\"border:none;vertical-align:top;width:120px\">{}</td><td style=\"border:none;width:14px;vertical-align:top\">:</td><td style=\"border:none;text-align:justify\">{}</td></tr>", label, isi);
    // Gaya diktum: 'kesatu' (default) atau 'pertama'
    let gaya = field(&d.data, "diktum_gaya");
    let labels: [&str; 7] = if gaya == "pertama" {
        ["PERTAMA","KEDUA","KETIGA","KEEMPAT","KELIMA","KEENAM","KETUJUH"]
    } else {
        ["KESATU","KEDUA","KETIGA","KEEMPAT","KELIMA","KEENAM","KETUJUH"]
    };
    let diktum: Vec<String> = arr(&d.data, "diktum");
    let mut diktum_html = String::new();
    for (i, dk) in diktum.iter().enumerate() {
        diktum_html.push_str(&baris(labels.get(i).copied().unwrap_or("SELANJUTNYA"), format!("<div style=\"text-align:justify\">{}</div>", esc_br(dk))));
    }
    let kota = field(&d.data, "kota"); let kota = if kota.is_empty() { "Bekasi".into() } else { kota };
    let tgl = d.tanggal.clone().unwrap_or_default();
    // Lampiran opsional (teks bebas), tampil di halaman baru
    let lampiran = field(&d.data, "lampiran");
    let lampiran_html = if lampiran.trim().is_empty() { String::new() } else {
        format!(r#"<div style="page-break-before:always"></div>
          <div style="text-align:right;margin-bottom:8px">Lampiran Surat Keputusan Direktur<br>Nomor : {}<br>Tanggal : {}<br>Tentang : {}</div>
          <div style="text-align:justify">{}</div>"#, esc(d.nomor.as_deref().unwrap_or("-")), esc(&tgl), esc_br(&d.judul), esc_br(&lampiran))
    };
    format!(r#"<div style="font-family:'Times New Roman',serif;font-size:12pt">{kop}
      <div style="text-align:center;font-weight:bold;line-height:1.4">
        SURAT KEPUTUSAN DIREKTUR<br>RUMAH SAKIT UMUM DAERAH CABANGBUNGIN<br>NOMOR : {nomor}
      </div>
      <div style="text-align:center;margin:10px 0">TENTANG</div>
      <div style="text-align:center;font-weight:bold;margin-bottom:10px">{tentang}</div>
      <div style="text-align:center;font-weight:bold;margin-bottom:14px">DIREKTUR RUMAH SAKIT UMUM DAERAH CABANGBUNGIN</div>
      <table style="border:none;border-collapse:collapse;width:100%">{menimbang}{mengingat}</table>
      <div style="text-align:center;font-weight:bold;margin:12px 0">MEMUTUSKAN</div>
      <table style="border:none;border-collapse:collapse;width:100%">{menetapkan}{diktum_html}</table>
      <table style="border:none;width:100%;margin-top:26px"><tr>
        <td style="border:none;width:52%"></td>
        <td style="border:none;text-align:left">
          Ditetapkan di : {kota}<br>Pada Tanggal : {tgl}<br>{jabatan}<br>{ttd}
        </td></tr></table>
      {lampiran_html}
    </div>"#,
        kop=kop, nomor=esc(d.nomor.as_deref().unwrap_or("-")), tentang=esc_br(&d.judul),
        menimbang=baris("Menimbang", li(&arr(&d.data,"menimbang"), false)),
        mengingat=baris("Mengingat", li(&arr(&d.data,"mengingat"), true)),
        menetapkan=baris("Menetapkan", format!("<div style=\"text-align:justify\">{}</div>", esc_br(&field(&d.data,"menetapkan")))),
        diktum_html=diktum_html, kota=esc(&kota), tgl=esc(&tgl),
        jabatan=esc(d.pejabat_jabatan.as_deref().unwrap_or("DIREKTUR RUMAH SAKIT UMUM DAERAH CABANGBUNGIN KABUPATEN BEKASI")),
        ttd=ttd_block(d, for_export), lampiran_html=lampiran_html)
}

async fn render_spo(pool: &sqlx::MySqlPool, d: &DokRow, for_export: bool) -> String {
    let logo = get_cfg(pool, "dokumen_kop_logo_kanan", "").await;
    let logo_html = if logo.trim().is_empty() { "RSUD<br>CABANGBUNGIN".to_string() } else { format!("<img src=\"{}\" style=\"height:55px\">", img_src(&logo, for_export)) };
    let cell = "border:1px solid #000;padding:5px;vertical-align:top";
    let sect = |label: &str, isi: String| format!("<tr><td style=\"{c};width:150px;font-weight:bold\">{l}</td><td style=\"{c}\">{i}</td></tr>", c=cell, l=label, i=isi);
    // 1 item → paragraf tanpa nomor; banyak item → bernomor
    let numbered = |items: &[String]| {
        let items: Vec<&String> = items.iter().filter(|x| !x.trim().is_empty()).collect();
        if items.is_empty() { return String::new(); }
        if items.len() == 1 { return esc_br(items[0]); }
        let mut o = String::new();
        for (i, it) in items.iter().enumerate() { o.push_str(&format!("{}. {}<br>", i+1, esc_br(it))); }
        o
    };
    let ttd = ttd_block(d, for_export);
    format!(r#"<div style="font-family:'Times New Roman',serif;font-size:11pt">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="{c};width:120px;text-align:center;font-weight:bold" rowspan="2">{logo}</td>
          <td style="{c};text-align:center;font-weight:bold;font-size:13pt" colspan="3">{judul}</td>
        </tr>
        <tr>
          <td style="{c}">No. Dokumen<br>{nomor}</td>
          <td style="{c}">No. Revisi<br>{rev}</td>
          <td style="{c}">Halaman<br>1 dari 1</td>
        </tr>
        <tr>
          <td style="{c};text-align:center;font-weight:bold">STANDAR PROSEDUR OPERASIONAL (SPO)</td>
          <td style="{c}">Tanggal terbit<br>{tgl}</td>
          <td style="{c};text-align:center" colspan="2">Ditetapkan,<br>{jabatan}<br>{ttd}</td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse">
        {pengertian}{tujuan}{kebijakan}{prosedur}{unit}
      </table>
    </div>"#,
        c=cell, logo=logo_html, judul=esc(&d.judul), nomor=esc(d.nomor.as_deref().unwrap_or("-")),
        rev=esc(d.no_revisi.as_deref().unwrap_or("00")), tgl=esc(d.tanggal.as_deref().unwrap_or("")),
        jabatan=esc(d.pejabat_jabatan.as_deref().unwrap_or("Direktur RSUD Cabangbungin")), ttd=ttd,
        pengertian=sect("PENGERTIAN", numbered(&arr(&d.data,"pengertian"))),
        tujuan=sect("TUJUAN", numbered(&arr(&d.data,"tujuan"))),
        kebijakan=sect("KEBIJAKAN", esc_br(&field(&d.data,"kebijakan"))),
        prosedur=sect("PROSEDUR", numbered(&arr(&d.data,"prosedur"))),
        unit=sect("UNIT TERKAIT", esc_br(&field(&d.data,"unit_terkait"))))
}

async fn render_doc(pool: &sqlx::MySqlPool, d: &DokRow, for_export: bool) -> String {
    let body = if d.jenis == "spo" { render_spo(pool, d, for_export).await } else { render_sk(pool, d, for_export).await };
    format!("<!doctype html><html><head><meta charset=\"utf-8\"><style>@page{{size:A4;margin:2cm}}body{{margin:0}}table{{font-size:inherit}}</style></head><body>{}</body></html>", body)
}

pub async fn preview(_u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Response, (StatusCode, Json<Value>)> {
    let d: DokRow = sqlx::query_as(&format!("SELECT {} FROM simrscb_dokumen_gen WHERE id=?", COLS))
        .bind(id).fetch_optional(&s.pool).await.map_err(db_err)?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"tidak ditemukan"}))))?;
    // Bila sudah pernah diedit di Word (file .docx ada) → tampilkan dari file
    let html = if tokio::fs::metadata(dok_file(id)).await.is_ok() {
        match convert_file(&dok_file(id), "html:HTML (StarWriter)", "html").await {
            Ok(b) => String::from_utf8_lossy(&b).to_string(),
            Err(_) => render_doc(&s.pool, &d, false).await,
        }
    } else { render_doc(&s.pool, &d, false).await };
    Ok(([(header::CONTENT_TYPE, "text/html; charset=utf-8")], html).into_response())
}

// ── Ekspor via LibreOffice ───────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct ExportQuery { #[serde(default)] pub format: Option<String> }
pub async fn export(_u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Query(q): Query<ExportQuery>)
  -> Result<Response, (StatusCode, Json<Value>)> {
    let d: DokRow = sqlx::query_as(&format!("SELECT {} FROM simrscb_dokumen_gen WHERE id=?", COLS))
        .bind(id).fetch_optional(&s.pool).await.map_err(db_err)?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"tidak ditemukan"}))))?;
    let fmt = q.format.as_deref().unwrap_or("docx");
    let has_file = tokio::fs::metadata(dok_file(id)).await.is_ok();
    let (ct, ext) = match fmt {
        "pdf" => ("application/pdf", "pdf"),
        _ => ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
    };
    // Sumber: file .docx hasil edit Word bila ada, jika tidak render dari template.
    let bytes: Vec<u8> = if has_file {
        if fmt == "pdf" {
            convert_file(&dok_file(id), "pdf", "pdf").await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e}))))?
        } else {
            tokio::fs::read(dok_file(id)).await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
        }
    } else {
        let html = render_doc(&s.pool, &d, true).await;
        let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|x| x.as_nanos()).unwrap_or(0);
        let work = format!("/tmp/dokgen_{}", ts);
        let _ = tokio::fs::create_dir_all(&work).await;
        let in_html = format!("{}/doc.html", work);
        tokio::fs::write(&in_html, html.as_bytes()).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("tulis: {}", e)}))))?;
        let conv = if fmt == "pdf" { "pdf" } else { "docx:MS Word 2007 XML" };
        let r = convert_file(&in_html, conv, ext).await;
        let _ = tokio::fs::remove_dir_all(&work).await;
        r.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e}))))?
    };
    let fname = format!("{}-{}.{}", d.jenis.to_uppercase(),
        d.nomor.as_deref().unwrap_or(&d.id.to_string()).replace(['/', ' ', '\\'], "_"), ext);
    Ok(([(header::CONTENT_TYPE, ct.to_string()),
         (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", fname))], bytes).into_response())
}

// ── Integrasi OnlyOffice (editor Word embed) ─────────────────────────────────
// Config editor (AuthUser) — frontend memuat api.js dari :8444 lalu pakai config ini.
pub async fn oo_config(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&u, "akreditasi_edit")?;
    let d: DokRow = sqlx::query_as(&format!("SELECT {} FROM simrscb_dokumen_gen WHERE id=?", COLS))
        .bind(id).fetch_optional(&s.pool).await.map_err(db_err)?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"tidak ditemukan"}))))?;
    // pastikan file docx editable sudah ada
    ensure_docx(&s.pool, &d).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e}))))?;
    let secret = get_cfg(&s.pool, "onlyoffice_jwt_secret", "").await;
    if secret.is_empty() { return Err((StatusCode::SERVICE_UNAVAILABLE, Json(json!({"error":"OnlyOffice belum dikonfigurasi"})))); }
    let mtime = tokio::fs::metadata(dok_file(id)).await.ok()
        .and_then(|m| m.modified().ok()).and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs()).unwrap_or(0);
    let key = format!("dok{}-{}", id, mtime);
    let exp = (chrono::Local::now().timestamp() + 24 * 3600) as usize;
    let t = oo_sign(&secret, &json!({"id": id, "exp": exp}));
    let base = get_cfg(&s.pool, "backend_internal_url", "http://172.17.0.1:8088").await;
    let cfg = json!({
        "document": {
            "fileType": "docx",
            "title": format!("{}.docx", d.judul.chars().take(80).collect::<String>()),
            "key": key,
            "url": format!("{}/api/dokumen-gen/{}/raw?t={}", base, id, t),
            "permissions": {"edit": true, "download": true, "print": true}
        },
        "documentType": "word",
        "editorConfig": {
            "mode": "edit", "lang": "id",
            "callbackUrl": format!("{}/api/dokumen-gen/{}/oo-callback?t={}", base, id, t),
            "user": {"id": u.0.kode, "name": u.0.nama},
            "customization": {"forcesave": true, "compactHeader": false}
        }
    });
    let token = oo_sign(&secret, &cfg);
    let mut out = cfg;
    out["token"] = json!(token);
    Ok(Json(out))
}

// Unduh dokumen utk Document Server (divalidasi token t; tanpa AuthUser).
#[derive(Deserialize)]
pub struct TQuery { pub t: Option<String> }
pub async fn raw(State(s): State<AppState>, Path(id): Path<i32>, Query(q): Query<TQuery>)
  -> Result<Response, (StatusCode, Json<Value>)> {
    let secret = get_cfg(&s.pool, "onlyoffice_jwt_secret", "").await;
    let ok = q.t.as_deref().and_then(|t| oo_verify(&secret, t))
        .and_then(|c| c.get("id").and_then(|x| x.as_i64())).map(|x| x as i32) == Some(id);
    if !ok { return Err((StatusCode::UNAUTHORIZED, Json(json!({"error":"token tidak valid"})))); }
    let d: DokRow = sqlx::query_as(&format!("SELECT {} FROM simrscb_dokumen_gen WHERE id=?", COLS))
        .bind(id).fetch_optional(&s.pool).await.map_err(db_err)?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"tidak ditemukan"}))))?;
    let path = ensure_docx(&s.pool, &d).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e}))))?;
    let bytes = tokio::fs::read(&path).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    Ok(([(header::CONTENT_TYPE, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")], bytes).into_response())
}

// Callback simpan dari Document Server (validasi token t).
pub async fn oo_callback(State(s): State<AppState>, Path(id): Path<i32>, Query(q): Query<TQuery>, body: axum::body::Bytes)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let secret = get_cfg(&s.pool, "onlyoffice_jwt_secret", "").await;
    // Keamanan: tanpa JWT secret, token & payload callback bisa ditempa siapa pun
    // → SSRF (server GET URL bebas) + timpa isi dokumen. Nonaktifkan bila belum diset.
    if secret.trim().is_empty() {
        return Err((StatusCode::SERVICE_UNAVAILABLE, Json(json!({"error":"OnlyOffice callback nonaktif: onlyoffice_jwt_secret belum dikonfigurasi"}))));
    }
    let ok = q.t.as_deref().and_then(|t| oo_verify(&secret, t))
        .and_then(|c| c.get("id").and_then(|x| x.as_i64())).map(|x| x as i32) == Some(id);
    if !ok { return Ok(Json(json!({"error": 1}))); }
    let v: Value = serde_json::from_slice(&body).unwrap_or(json!({}));
    // payload bisa ada di dalam token (JWT) bila JWT aktif
    let payload = v.get("token").and_then(|x| x.as_str()).and_then(|t| oo_verify(&secret, t)).unwrap_or(v.clone());
    let status = payload.get("status").and_then(|x| x.as_i64()).unwrap_or(0);
    if status == 2 || status == 6 { // MustSave / ForceSave
        if let Some(url) = payload.get("url").and_then(|x| x.as_str()).filter(|u| u.starts_with("http://") || u.starts_with("https://")) {
            let client = reqwest::Client::builder().danger_accept_invalid_certs(true)
                .timeout(std::time::Duration::from_secs(60)).build()
                .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"http"}))))?;
            if let Ok(resp) = client.get(url).send().await {
                if let Ok(bytes) = resp.bytes().await {
                    let _ = tokio::fs::create_dir_all(dok_dir()).await;
                    let _ = tokio::fs::write(dok_file(id), &bytes).await;
                    let _ = sqlx::query("UPDATE simrscb_dokumen_gen SET updated_at=NOW() WHERE id=?").bind(id).execute(&s.pool).await;
                }
            }
        }
    }
    Ok(Json(json!({"error": 0})))
}
