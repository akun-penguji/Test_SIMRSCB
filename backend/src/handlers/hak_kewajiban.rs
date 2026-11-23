use crate::{
    auth::middleware::AuthUser,
    models::hak_kewajiban::{HakKewajibanPrefill, SimpanHakKewajiban},
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Html,
    Json,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::Deserialize;
use serde_json::{json, Value};

const LOGO_DAERAH_PNG: &[u8] = include_bytes!("../../../frontend/public/logo-daerah.png");
const LOGO_RS_PNG:     &[u8] = include_bytes!("../../../frontend/public/logo-rs.png");

fn logo_daerah_data_url() -> String { format!("data:image/png;base64,{}", B64.encode(LOGO_DAERAH_PNG)) }
fn logo_rs_data_url()     -> String { format!("data:image/png;base64,{}", B64.encode(LOGO_RS_PNG)) }

// ── GET /api/hak-kewajiban/:no_rawat ────────────────────────────────────────
pub async fn get_by_no_rawat(
    user: AuthUser,
    State(state): State<AppState>,
    Path(no_rawat): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "consent_view")?;
    let row: Option<HakKewajibanPrefill> = sqlx::query_as(
        "SELECT h.no_surat, h.no_rawat,
                DATE_FORMAT(h.tanggal,'%Y-%m-%d') AS tanggal,
                TIME_FORMAT(h.jam,'%H:%i') AS jam,
                h.pengobatan_kepada, h.nama_pj, h.umur_pj, h.no_ktppj, h.jkpj,
                h.bertindak_atas, h.no_telp, h.nip,
                p.photo, p.tandatangan,
                d.keterangan_tambahan, d.persetujuan_khusus, d.catatan_petugas, d.status_persetujuan
         FROM hak_kewajiban_pasien h
         LEFT JOIN hak_kewajiban_pasien_pembuat_pernyataan p ON h.no_surat = p.no_surat
         LEFT JOIN hak_kewajiban_pasien_detail              d ON h.no_surat = d.no_surat
         WHERE h.no_rawat = ?
         ORDER BY h.tanggal DESC, h.no_surat DESC LIMIT 1"
    ).bind(&no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;

    Ok(Json(json!({ "data": row })))
}

// ── GET /api/hak-kewajiban (daftar tersimpan) ────────────────────────────────
#[derive(Deserialize)]
pub struct ListQuery {
    pub q: Option<String>,
    pub tgl_awal: Option<String>,
    pub tgl_akhir: Option<String>,
    pub limit: Option<i64>,
}

#[derive(sqlx::FromRow, serde::Serialize)]
struct ListRow {
    no_surat: String,
    no_rawat: String,
    tanggal: Option<String>,
    no_rkm_medis: Option<String>,
    nm_pasien: Option<String>,
    nama_pj: Option<String>,
    nip: Option<String>,
}

pub async fn list(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "consent_view")?;
    let limit = q.limit.unwrap_or(100).clamp(1, 500);
    let from = q.tgl_awal.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "2000-01-01".into());
    let to = q.tgl_akhir.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "2999-12-31".into());
    let like = format!("%{}%", q.q.as_deref().unwrap_or("").trim());

    let rows: Vec<ListRow> = sqlx::query_as(
        "SELECT h.no_surat, h.no_rawat, DATE_FORMAT(h.tanggal,'%Y-%m-%d') AS tanggal,
                r.no_rkm_medis, p.nm_pasien, h.nama_pj, h.nip
         FROM hak_kewajiban_pasien h
         LEFT JOIN reg_periksa r ON r.no_rawat = h.no_rawat
         LEFT JOIN pasien p ON p.no_rkm_medis = r.no_rkm_medis
         WHERE h.tanggal BETWEEN ? AND ?
           AND (h.no_rawat LIKE ? OR h.no_surat LIKE ? OR p.nm_pasien LIKE ? OR r.no_rkm_medis LIKE ?)
         ORDER BY h.tanggal DESC, h.no_surat DESC
         LIMIT ?",
    )
    .bind(&from).bind(&to).bind(&like).bind(&like).bind(&like).bind(&like).bind(limit)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    Ok(Json(json!({ "ok": true, "jumlah": rows.len(), "data": rows })))
}

// ── POST /api/hak-kewajiban ─────────────────────────────────────────────────
pub async fn simpan(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<SimpanHakKewajiban>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_consent_edit(&user)?;
    if body.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib diisi"}))));
    }

    let tanggal = body.tanggal.clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());
    // Jam TTD pasien: pakai isian, default jam sekarang
    let jam = body.jam.clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| chrono::Local::now().format("%H:%M:%S").to_string());

    let no_surat = match body.no_surat.as_deref().filter(|s| !s.trim().is_empty()) {
        Some(s) => s.to_string(),
        None => {
            let existing: Option<(String,)> = sqlx::query_as(
                "SELECT no_surat FROM hak_kewajiban_pasien
                 WHERE no_rawat = ? ORDER BY tanggal DESC, no_surat DESC LIMIT 1"
            ).bind(&body.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
            match existing {
                Some(e) => e.0,
                None => generate_no_surat(&state, &tanggal).await?,
            }
        }
    };

    // ENUM normalize
    let pengobatan = normalize_enum(body.pengobatan_kepada.as_deref(),
        &["Suami","Istri","Anak","Ayah","Ibu","Saudara","Keponakan","Adik","Kakak","Orang Tua","Diri Sendiri","-"],
        "-");
    let bertindak = normalize_enum(Some(&body.bertindak_atas),
        &["Suami","Istri","Anak","Ayah","Ibu","Saudara","Keponakan","Diri Sendiri","Kakak","Adik","Cucu","Nenek","Kakek","Kaka","Kerabat","Teman"],
        "Diri Sendiri");
    let jkpj = match body.jkpj.trim().chars().next() {
        Some('L') | Some('l') => "L",
        Some('P') | Some('p') => "P",
        _ => "L",
    };
    let status = body.status_persetujuan.as_deref()
        .filter(|v| matches!(*v, "Disetujui"|"Ditolak"|"Pending"))
        .unwrap_or("Disetujui");

    let mut tx = state.pool.begin().await.map_err(db_err)?;

    // 1) UPSERT header
    sqlx::query(
        "INSERT INTO hak_kewajiban_pasien
           (no_surat, no_rawat, tanggal, jam, pengobatan_kepada,
            nama_pj, umur_pj, no_ktppj, jkpj, bertindak_atas, no_telp, nip)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           no_rawat=VALUES(no_rawat), tanggal=VALUES(tanggal), jam=VALUES(jam),
           pengobatan_kepada=VALUES(pengobatan_kepada),
           nama_pj=VALUES(nama_pj), umur_pj=VALUES(umur_pj),
           no_ktppj=VALUES(no_ktppj), jkpj=VALUES(jkpj),
           bertindak_atas=VALUES(bertindak_atas),
           no_telp=VALUES(no_telp), nip=VALUES(nip)"
    )
    .bind(&no_surat).bind(&body.no_rawat).bind(&tanggal).bind(&jam)
    .bind(&pengobatan).bind(&body.nama_pj).bind(&body.umur_pj)
    .bind(&body.no_ktppj).bind(jkpj).bind(&bertindak)
    .bind(&body.no_telp).bind(&body.nip)
    .execute(&mut *tx).await.map_err(|e| db_err_msg(e, "INSERT hak_kewajiban_pasien"))?;

    // 2) UPSERT detail
    sqlx::query(
        "INSERT INTO hak_kewajiban_pasien_detail
           (no_surat, keterangan_tambahan, persetujuan_khusus, catatan_petugas, status_persetujuan)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           keterangan_tambahan=VALUES(keterangan_tambahan),
           persetujuan_khusus=VALUES(persetujuan_khusus),
           catatan_petugas=VALUES(catatan_petugas),
           status_persetujuan=VALUES(status_persetujuan)"
    )
    .bind(&no_surat)
    .bind(body.keterangan_tambahan.as_deref().unwrap_or(""))
    .bind(body.persetujuan_khusus.as_deref().unwrap_or(""))
    .bind(body.catatan_petugas.as_deref().unwrap_or(""))
    .bind(status)
    .execute(&mut *tx).await.map_err(|e| db_err_msg(e, "INSERT hak_kewajiban_pasien_detail"))?;

    tx.commit().await.map_err(db_err)?;

    use crate::audit::q;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO hak_kewajiban_pasien (no_surat, no_rawat, tanggal, pengobatan_kepada, nama_pj, umur_pj, no_ktppj, jkpj, bertindak_atas, no_telp, nip) VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})",
        q(&no_surat), q(&body.no_rawat), q(&tanggal), q(pengobatan),
        q(&body.nama_pj), q(&body.umur_pj), q(&body.no_ktppj), q(jkpj), q(bertindak),
        q(&body.no_telp), q(&body.nip)
    )).await;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO hak_kewajiban_pasien_detail (no_surat, keterangan_tambahan, persetujuan_khusus, catatan_petugas, status_persetujuan) VALUES ({}, {}, {}, {}, {})",
        q(&no_surat),
        q(body.keterangan_tambahan.as_deref().unwrap_or("")),
        q(body.persetujuan_khusus.as_deref().unwrap_or("")),
        q(body.catatan_petugas.as_deref().unwrap_or("")),
        q(status)
    )).await;

    Ok(Json(json!({ "success": true, "no_surat": no_surat, "tanggal": tanggal })))
}

// ── GET /api/hak-kewajiban/:no_rawat/cetak ──────────────────────────────────
pub async fn cetak_html(
    user: AuthUser,
    State(state): State<AppState>,
    Path(no_rawat): Path<String>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "consent_view")?;
    let h: Option<HakKewajibanPrefill> = sqlx::query_as(
        "SELECT h.no_surat, h.no_rawat,
                DATE_FORMAT(h.tanggal,'%Y-%m-%d') AS tanggal,
                TIME_FORMAT(h.jam,'%H:%i') AS jam,
                h.pengobatan_kepada, h.nama_pj, h.umur_pj, h.no_ktppj, h.jkpj,
                h.bertindak_atas, h.no_telp, h.nip,
                p.photo, p.tandatangan,
                d.keterangan_tambahan, d.persetujuan_khusus, d.catatan_petugas, d.status_persetujuan
         FROM hak_kewajiban_pasien h
         LEFT JOIN hak_kewajiban_pasien_pembuat_pernyataan p ON h.no_surat = p.no_surat
         LEFT JOIN hak_kewajiban_pasien_detail              d ON h.no_surat = d.no_surat
         WHERE h.no_rawat = ?
         ORDER BY h.tanggal DESC, h.no_surat DESC LIMIT 1"
    ).bind(&no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;

    let Some(h) = h else {
        return Err((StatusCode::NOT_FOUND,
            Json(json!({"error":"Hak & kewajiban belum tersimpan untuk no_rawat ini"}))));
    };

    // Pasien
    let pasien: Option<(String, String, String, String, String)> = sqlx::query_as(
        "SELECT p.no_rkm_medis, p.nm_pasien, p.jk,
                DATE_FORMAT(p.tgl_lahir,'%d-%m-%Y') AS tgl_lahir,
                CONCAT(IFNULL(p.alamat,''),', ',IFNULL(kel.nm_kel,''),', ',IFNULL(kec.nm_kec,''),', ',IFNULL(kab.nm_kab,'')) AS alamat
         FROM reg_periksa r
         INNER JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN kelurahan kel ON p.kd_kel = kel.kd_kel
         LEFT JOIN kecamatan kec ON p.kd_kec = kec.kd_kec
         LEFT JOIN kabupaten kab ON p.kd_kab = kab.kd_kab
         WHERE r.no_rawat = ? LIMIT 1"
    ).bind(&no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    let (no_rm, nm_pasien, jk, tgl_lahir, alamat_p) = pasien.unwrap_or_default();

    let setting: Option<(String, String, String, String)> = sqlx::query_as(
        "SELECT IFNULL(nama_instansi,''), IFNULL(alamat_instansi,''),
                IFNULL(kabupaten,''),     IFNULL(kontak,'')
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;
    let (nama_rs, alamat_rs, kabupaten, kontak) = setting.unwrap_or_default();

    let nama_petugas: String = sqlx::query_as::<_, (String,)>(
        "SELECT nama FROM petugas WHERE nip = ? LIMIT 1"
    ).bind(h.nip.as_deref().unwrap_or(""))
     .fetch_optional(&state.pool).await.ok().flatten()
     .map(|t| t.0).unwrap_or_default();

    let hw_val = sqlx::query_as::<_, (String,)>(
        "SELECT nilai FROM simrscb_config WHERE kunci = 'hosthybridweb' LIMIT 1"
    ).fetch_optional(&state.pool).await.ok().flatten().map(|t| t.0).unwrap_or_default();
    let base_media = if hw_val.starts_with("http") {
        hw_val.rsplit_once('/').map(|(d, _)| d.to_string()).unwrap_or(hw_val.clone())
    } else {
        format!("/{}", hw_val.trim_start_matches('/').trim_end_matches('/'))
    };

    // Bangun src gambar. Kalau base_media http (webapps remote), inline sebagai
    // data: URI supaya cetak self-contained — menghindari mixed-content (gambar
    // http di halaman https) dan masalah hostname internal (webapps-rscb) di tablet.
    let resolve_src = |path_opt: Option<&str>| -> Option<String> {
        path_opt.filter(|s| !s.is_empty())
            .map(|p| format!("{}/hakdankewajibanpasien/{}", base_media.trim_end_matches('/'), p))
    };
    let photo_src = match resolve_src(h.photo.as_deref()) {
        Some(full) if base_media.starts_with("http") => fetch_data_uri(&full).await.unwrap_or(full),
        Some(full) => full,
        None => String::new(),
    };
    let ttd_src = match resolve_src(h.tandatangan.as_deref()) {
        Some(full) if base_media.starts_with("http") => fetch_data_uri(&full).await.unwrap_or(full),
        Some(full) => full,
        None => String::new(),
    };

    let html = render_html(&h, &nama_petugas, &no_rm, &nm_pasien, &jk, &tgl_lahir, &alamat_p,
        &nama_rs, &alamat_rs, &kabupaten, &kontak, &photo_src, &ttd_src);
    Ok(Html(html))
}

/// Ambil gambar dari URL internal (http webapps) → data: URI base64.
/// Membuat cetak HTML self-contained (tanpa request gambar eksternal).
async fn fetch_data_uri(url: &str) -> Option<String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_secs(10))
        .build().ok()?;
    let resp = client.get(url).send().await.ok()?;
    if !resp.status().is_success() { return None; }
    let ct = resp.headers().get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok()).unwrap_or("image/jpeg").to_string();
    let bytes = resp.bytes().await.ok()?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Some(format!("data:{};base64,{}", ct, b64))
}

#[allow(clippy::too_many_arguments)]
fn render_html(
    h:            &HakKewajibanPrefill,
    nama_petugas: &str,
    no_rm: &str, nm_pasien: &str, jk: &str, tgl_lahir: &str, alamat_p: &str,
    nama_rs: &str, alamat_rs: &str, kabupaten: &str, kontak: &str,
    photo_src: &str, ttd_src: &str,
) -> String {
    let esc = html_escape;
    let opt = |o: &Option<String>| esc(o.as_deref().unwrap_or(""));
    let kab_kop = if kabupaten.is_empty() { String::new() }
        else { format!("PEMERINTAH {}", kabupaten.to_uppercase().replace("KAB.", "KABUPATEN").replace("KAB ", "KABUPATEN ")) };
    let rs_kop = if nama_rs.is_empty() { "RUMAH SAKIT UMUM DAERAH CABANGBUNGIN".to_string() } else { nama_rs.to_uppercase() };
    let alamat_baris = {
        let mut s = String::new();
        if !alamat_rs.is_empty() { s.push_str(&esc(alamat_rs)); }
        if !kontak.is_empty() {
            if !s.is_empty() { s.push_str(" — "); }
            s.push_str(&format!("Telp. {}", esc(kontak)));
        }
        s
    };

    let photo_html = if photo_src.is_empty() { String::new() } else {
        format!(r#"<img src="{src}" alt="Foto PJ" style="width:100px;height:100px;object-fit:cover;border:1px solid #cbd5e1;border-radius:4px;"/>"#, src=photo_src)
    };
    let ttd_html = if ttd_src.is_empty() { String::new() } else {
        format!(r#"<img src="{src}" alt="TTD" style="width:160px;height:60px;object-fit:contain;"/>"#, src=ttd_src)
    };

    // QR code untuk Petugas RS (NIP|Nama|Tgl)
    let qr_payload = format!("NIP:{}|Nama:{}|Tgl:{}",
        h.nip.as_deref().unwrap_or(""), nama_petugas, h.tanggal.as_deref().unwrap_or(""));
    let qr_url = crate::handlers::qr::qr_data_uri(&qr_payload);

    format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>Hak & Kewajiban Pasien — {no_surat}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:24px;font-size:11px;line-height:1.5}}
  .kop{{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:12px}}
  .kop img{{width:60px;height:60px;object-fit:contain}}
  .kop .ctr{{flex:1;text-align:center}}
  .kop .kab{{font-size:11px;font-weight:700}}
  .kop .rs{{font-size:14px;font-weight:800}}
  .kop .al{{font-size:10px;color:#334155}}
  .judul{{text-align:center;font-weight:800;font-size:13px;margin:6px 0;letter-spacing:1.5px}}
  table.id{{width:100%;border-collapse:collapse;margin:6px 0}}
  table.id td{{padding:2px 4px;vertical-align:top}}
  table.id td.lbl{{width:160px;color:#475569}}
  h3{{font-size:11px;background:#f1f5f9;border-left:4px solid #1e40af;padding:5px 8px;margin:8px 0 4px}}
  .box{{border:1px solid #cbd5e1;padding:8px;border-radius:4px;margin-bottom:6px}}
  ol{{margin:4px 0 4px 18px;padding:0}}
  ol li{{margin:1px 0}}
  .ttd{{display:flex;justify-content:space-between;margin-top:18px}}
  .ttd .col{{text-align:center;width:46%}}
  .ttd .col .img{{min-height:120px;display:flex;align-items:center;justify-content:center;gap:10px}}
  .ttd .col .nm{{margin-top:4px;font-weight:600}}
  @media print{{ body{{margin:14px}} .no-print{{display:none}} }}
</style>
</head><body>
<div class="no-print" style="margin-bottom:10px;text-align:right">
  <button onclick="window.print()" style="background:#15803d;color:#fff;border:0;padding:8px 14px;border-radius:6px;cursor:pointer">Cetak / Simpan PDF</button>
</div>

<div class="kop">
  <img src="{logo_daerah}" alt="logo daerah"/>
  <div class="ctr">
    <div class="kab">{kab}</div>
    <div class="rs">{rs}</div>
    <div class="al">{al}</div>
  </div>
  <img src="{logo_rs}" alt="logo rs"/>
</div>

<div class="judul">HAK DAN KEWAJIBAN PASIEN</div>
<div style="text-align:right;font-size:10px;color:#64748b;margin-bottom:6px">No. Surat: <b>{no_surat}</b> &nbsp;|&nbsp; Tanggal: {tanggal}</div>

<h3>Identitas</h3>
<table class="id">
  <tr><td class="lbl">No. Rekam Medis</td><td>: {no_rm}</td><td class="lbl">No. Rawat</td><td>: {no_rawat}</td></tr>
  <tr><td class="lbl">Nama Pasien</td><td>: {nm_pasien}</td><td class="lbl">Jenis Kelamin</td><td>: {jk}</td></tr>
  <tr><td class="lbl">Tgl Lahir</td><td>: {tgl_lahir}</td><td class="lbl">Alamat</td><td>: {alamat_p}</td></tr>
  <tr><td class="lbl">Penanggung Jawab</td><td>: {nama_pj}</td><td class="lbl">Hubungan</td><td>: {bertindak}</td></tr>
  <tr><td class="lbl">Umur PJ</td><td>: {umur_pj} tahun</td><td class="lbl">No. KTP</td><td>: {no_ktp}</td></tr>
</table>

<p style="font-style:italic;font-size:10px;color:#444;margin:2px 0 6px">Berdasarkan Pasal 276 dan Pasal 277 Undang-Undang Nomor 17 Tahun 2023 tentang Kesehatan jo. Peraturan Pemerintah Nomor 28 Tahun 2024.</p>

<h3>HAK PASIEN <span style="font-weight:normal;font-size:10px">(Pasal 276 UU No. 17 Tahun 2023)</span></h3>
<div class="box">
<p style="margin:0 0 2px">Setiap pasien berhak untuk:</p>
<ol>
  <li>Mendapatkan informasi mengenai kesehatan dirinya.</li>
  <li>Mendapatkan penjelasan yang memadai mengenai pelayanan kesehatan yang diterima.</li>
  <li>Mendapatkan pelayanan kesehatan sesuai dengan kebutuhan medis, standar profesi, dan pelayanan kesehatan yang bermutu.</li>
  <li>Menyetujui atau menolak sebagian atau seluruh tindakan medis yang akan dilakukan setelah menerima dan memahami informasi mengenai tindakan tersebut secara lengkap, kecuali tindakan medis yang wajib dilakukan dalam rangka pencegahan penyakit dan penanganan Kejadian Luar Biasa dan/atau wabah.</li>
  <li>Mendapatkan akses terhadap informasi yang terdapat di dalam rekam medis.</li>
  <li>Meminta pendapat Tenaga Medis atau Tenaga Kesehatan lain (second opinion).</li>
  <li>Mendapatkan hak lain sesuai dengan ketentuan peraturan perundang-undangan.</li>
</ol>
</div>

<h3>KEWAJIBAN PASIEN <span style="font-weight:normal;font-size:10px">(Pasal 277 UU No. 17 Tahun 2023)</span></h3>
<div class="box">
<p style="margin:0 0 2px">Setiap pasien berkewajiban untuk:</p>
<ol>
  <li>Memberikan informasi yang lengkap dan jujur tentang masalah kesehatannya.</li>
  <li>Mematuhi nasihat dan petunjuk Tenaga Medis dan Tenaga Kesehatan.</li>
  <li>Mematuhi ketentuan yang berlaku pada Fasilitas Pelayanan Kesehatan ({rs_inline}).</li>
  <li>Memberikan imbalan jasa atas pelayanan yang diterima.</li>
</ol>
</div>

<p style="margin-top:6px">Dengan ini menyatakan telah memahami dan benar telah mendapatkan penjelasan mengenai hak dan kewajiban pasien dan diberikan kesempatan untuk bertanya.</p>

<div class="ttd">
  <div class="col">
    <div>Mengetahui,<br/>Petugas RS</div>
    <div class="img"><img src="{qr_url}" alt="QR Petugas" style="width:80px;height:80px"/></div>
    <div class="nm">{nama_petugas}</div>
    <div style="font-size:10px;color:#64748b">NIP. {nip}</div>
  </div>
  <div class="col">
    <div>Bekasi, {tanggal}</div>
    <div>Yang Menyatakan</div>
    <div class="img">{photo}{ttd}</div>
    <div class="nm">{nama_pj}</div>
  </div>
</div>

</body></html>
"#,
        logo_daerah = logo_daerah_data_url(),
        logo_rs     = logo_rs_data_url(),
        no_surat    = opt(&h.no_surat),
        kab         = esc(&kab_kop),
        rs          = esc(&rs_kop),
        rs_inline   = esc(nama_rs.trim()),
        al          = alamat_baris,
        tanggal     = opt(&h.tanggal),
        no_rm       = esc(no_rm),
        no_rawat    = esc(&h.no_rawat),
        nm_pasien   = esc(nm_pasien),
        jk          = esc(jk),
        tgl_lahir   = esc(tgl_lahir),
        alamat_p    = esc(alamat_p),
        nama_pj     = opt(&h.nama_pj),
        bertindak   = opt(&h.bertindak_atas),
        umur_pj     = opt(&h.umur_pj),
        no_ktp      = opt(&h.no_ktppj),
        nama_petugas = esc(nama_petugas),
        nip         = opt(&h.nip),
        qr_url      = esc(&qr_url),
        photo       = photo_html,
        ttd         = ttd_html,
    )
}

async fn generate_no_surat(
    state: &AppState,
    tanggal_iso: &str,
) -> Result<String, (StatusCode, Json<Value>)> {
    let prefix = format!("HKP{}", tanggal_iso.replace('-', ""));
    let max: Option<(String,)> = sqlx::query_as(
        "SELECT no_surat FROM hak_kewajiban_pasien
         WHERE no_surat LIKE CONCAT(?, '%')
         ORDER BY no_surat DESC LIMIT 1"
    ).bind(&prefix).fetch_optional(&state.pool).await.map_err(db_err)?;
    let next = max.and_then(|(s,)| s.get(prefix.len()..).and_then(|t| t.parse::<u32>().ok()))
        .map(|n| n + 1).unwrap_or(1);
    Ok(format!("{}{:03}", prefix, next))
}

fn normalize_enum(s: Option<&str>, allowed: &[&str], default: &str) -> String {
    s.map(str::trim).filter(|v| !v.is_empty())
        .filter(|v| allowed.contains(v))
        .map(String::from)
        .unwrap_or_else(|| default.to_string())
}

fn urlencoding_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for b in s.as_bytes() {
        match *b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(*b as char),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
     .replace('"', "&quot;").replace('\'', "&#39;")
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error hak_kewajiban: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"Database error"})))
}

fn db_err_msg(e: sqlx::Error, ctx: &str) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error {}: {}", ctx, e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Database error: {}", ctx)})))
}
