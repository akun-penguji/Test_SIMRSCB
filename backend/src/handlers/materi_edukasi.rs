use crate::{
    auth::middleware::AuthUser,
    models::materi_edukasi::{MateriEdukasiRow, SimpanMateriEdukasi},
    AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Html,
    Json,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::Serialize;
use serde_json::{json, Value};

const LOGO_DAERAH_PNG: &[u8] = include_bytes!("../../../frontend/public/logo-daerah.png");
const LOGO_RS_PNG:     &[u8] = include_bytes!("../../../frontend/public/logo-rs.png");

fn logo_daerah_data_url() -> String { format!("data:image/png;base64,{}", B64.encode(LOGO_DAERAH_PNG)) }
fn logo_rs_data_url()     -> String { format!("data:image/png;base64,{}", B64.encode(LOGO_RS_PNG)) }

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TtdImageRow {
    pub no_rawat:  String,
    pub tanggal:   String,
    pub jam:       String,
    pub url_image: String,
}

// ── GET /api/edukasi-pasien/:no_rawat/materi ────────────────────────────────
pub async fn list_materi(
    user: AuthUser,
    State(state): State<AppState>,
    Path(no_rawat): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "consent_view")?;
    let rows: Vec<MateriEdukasiRow> = sqlx::query_as(
        "SELECT m.no_rawat,
                DATE_FORMAT(m.tanggal,'%Y-%m-%d') AS tanggal,
                TIME_FORMAT(m.jam,'%H:%i:%s')    AS jam,
                m.diberikan_pada, m.penerima_edukasi, m.profesi,
                m.materi_edukasi, m.kode_leaflet, m.lama_edukasi,
                m.hasil_verifikasi,
                m.nip, IFNULL(p.nama,'') AS nama_petugas
         FROM materi_edukasi_pasien_keluarga_rscb m
         LEFT JOIN petugas p ON m.nip = p.nip
         WHERE m.no_rawat = ?
         ORDER BY m.tanggal DESC, m.jam DESC"
    ).bind(&no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;

    let ttds: Vec<TtdImageRow> = sqlx::query_as(
        "SELECT no_rawat,
                DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal,
                TIME_FORMAT(jam,'%H:%i:%s')    AS jam,
                url_image
         FROM edukasipasien_ttd WHERE no_rawat = ?
         ORDER BY tanggal DESC, jam DESC"
    ).bind(&no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;

    Ok(Json(json!({ "data": rows, "ttd": ttds })))
}

// ── POST /api/edukasi-pasien/:no_rawat/materi ───────────────────────────────
pub async fn simpan_materi(
    user: AuthUser,
    State(state): State<AppState>,
    Path(no_rawat): Path<String>,
    Json(body): Json<SimpanMateriEdukasi>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_consent_edit(&user)?;
    if body.materi_edukasi.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Materi edukasi wajib diisi"}))));
    }
    if body.nip.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"NIP petugas wajib"}))));
    }
    if body.tanggal.trim().is_empty() || body.jam.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Tanggal & jam wajib diisi"}))));
    }
    if body.no_rawat != no_rawat {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat tidak konsisten"}))));
    }

    let diberikan_pada   = normalize_enum(&body.diberikan_pada, &["Pasien","Keluarga","Lain-lain"], "Pasien");
    let hasil_verifikasi = normalize_enum_opt(&body.hasil_verifikasi,
        &["Sudah Mengerti","Re - Edukasi","Re - Demonstrasi"]);

    // Validasi NIP terhadap FK pegawai.nik — fallback ke '-' kalau tidak ada
    let nip_valid: bool = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM pegawai WHERE nik = ?"
    ).bind(&body.nip).fetch_one(&state.pool).await.map_err(db_err)? > 0;
    let nip_resolved = if nip_valid { body.nip.clone() } else { "-".to_string() };
    if !nip_valid {
        tracing::warn!("simpan_materi: NIP '{}' tidak ada di pegawai, fallback ke '-'", body.nip);
    }

    let mut tx = state.pool.begin().await.map_err(db_err)?;

    // UPSERT materi (header)
    let profesi_val = body.profesi.as_deref().map(str::trim).filter(|s| !s.is_empty());
    sqlx::query(
        "INSERT INTO materi_edukasi_pasien_keluarga_rscb
           (no_rawat, tanggal, jam, diberikan_pada, penerima_edukasi, profesi,
            materi_edukasi, kode_leaflet, lama_edukasi, hasil_verifikasi, nip)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           diberikan_pada=VALUES(diberikan_pada),
           penerima_edukasi=VALUES(penerima_edukasi),
           profesi=VALUES(profesi),
           materi_edukasi=VALUES(materi_edukasi),
           kode_leaflet=VALUES(kode_leaflet),
           lama_edukasi=VALUES(lama_edukasi),
           hasil_verifikasi=VALUES(hasil_verifikasi),
           nip=VALUES(nip)"
    )
    .bind(&body.no_rawat).bind(&body.tanggal).bind(&body.jam)
    .bind(&diberikan_pada)
    .bind(body.penerima_edukasi.as_deref().unwrap_or("-"))
    .bind(profesi_val)
    .bind(&body.materi_edukasi)
    .bind(body.kode_leaflet.as_deref().unwrap_or(""))
    .bind(body.lama_edukasi.as_deref().unwrap_or(""))
    .bind(hasil_verifikasi)
    .bind(&nip_resolved)
    .execute(&mut *tx).await.map_err(|e| db_err_msg(e, "INSERT materi_edukasi"))?;

    tx.commit().await.map_err(db_err)?;

    use crate::audit::{q, qo};
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO materi_edukasi_pasien_keluarga_rscb (no_rawat, tanggal, jam, diberikan_pada, penerima_edukasi, profesi, materi_edukasi, kode_leaflet, lama_edukasi, hasil_verifikasi, nip) VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})",
        q(&body.no_rawat), q(&body.tanggal), q(&body.jam),
        q(diberikan_pada),
        q(body.penerima_edukasi.as_deref().unwrap_or("-")),
        qo(profesi_val),
        q(&body.materi_edukasi),
        q(body.kode_leaflet.as_deref().unwrap_or("")),
        q(body.lama_edukasi.as_deref().unwrap_or("")),
        qo(hasil_verifikasi),
        q(&nip_resolved)
    )).await;

    Ok(Json(json!({
        "success": true,
        "no_rawat": body.no_rawat,
        "tanggal":  body.tanggal,
        "jam":      body.jam,
    })))
}

// ── DELETE /api/edukasi-pasien/:no_rawat/materi/:tanggal/:jam ───────────────
pub async fn hapus_materi(
    user: AuthUser,
    State(state): State<AppState>,
    Path((no_rawat, tanggal, jam)): Path<(String, String, String)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_consent_edit(&user)?;
    let mut tx = state.pool.begin().await.map_err(db_err)?;
    sqlx::query("DELETE FROM materi_edukasi_pasien_keluarga_rscb WHERE no_rawat=? AND tanggal=? AND jam=?")
        .bind(&no_rawat).bind(&tanggal).bind(&jam)
        .execute(&mut *tx).await.map_err(db_err)?;
    sqlx::query("DELETE FROM edukasi_pasien_keluarga_detail WHERE no_rawat=? AND tanggal=? AND jam=?")
        .bind(&no_rawat).bind(&tanggal).bind(&jam)
        .execute(&mut *tx).await.map_err(db_err)?;
    tx.commit().await.map_err(db_err)?;

    use crate::audit::q;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "DELETE FROM materi_edukasi_pasien_keluarga_rscb WHERE no_rawat={} AND tanggal={} AND jam={}",
        q(&no_rawat), q(&tanggal), q(&jam)
    )).await;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "DELETE FROM edukasi_pasien_keluarga_detail WHERE no_rawat={} AND tanggal={} AND jam={}",
        q(&no_rawat), q(&tanggal), q(&jam)
    )).await;
    Ok(Json(json!({"success": true})))
}

// ── GET /api/edukasi-pasien/:no_rawat/materi/cetak ──────────────────────────
pub async fn cetak_html(
    user: AuthUser,
    State(state): State<AppState>,
    Path(no_rawat): Path<String>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "consent_view")?;
    let rows: Vec<MateriEdukasiRow> = sqlx::query_as(
        "SELECT m.no_rawat,
                DATE_FORMAT(m.tanggal,'%Y-%m-%d') AS tanggal,
                TIME_FORMAT(m.jam,'%H:%i')        AS jam,
                m.diberikan_pada, m.penerima_edukasi, m.profesi,
                m.materi_edukasi, m.kode_leaflet, m.lama_edukasi,
                m.hasil_verifikasi,
                m.nip, IFNULL(p.nama,'') AS nama_petugas
         FROM materi_edukasi_pasien_keluarga_rscb m
         LEFT JOIN pegawai p ON m.nip = p.nik
         WHERE m.no_rawat = ?
         ORDER BY m.tanggal ASC, m.jam ASC"
    ).bind(&no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;

    let ttds: Vec<TtdImageRow> = sqlx::query_as(
        "SELECT no_rawat,
                DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal,
                TIME_FORMAT(jam,'%H:%i:%s')     AS jam,
                url_image
         FROM edukasipasien_ttd WHERE no_rawat = ?
         ORDER BY tanggal DESC, jam DESC"
    ).bind(&no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;

    // Identitas pasien
    let pasien: Option<(String, String, String, String)> = sqlx::query_as(
        "SELECT p.no_rkm_medis, p.nm_pasien, p.jk,
                DATE_FORMAT(p.tgl_lahir,'%d-%m-%Y') AS tgl_lahir
         FROM reg_periksa r
         INNER JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
         WHERE r.no_rawat = ? LIMIT 1"
    ).bind(&no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    let (no_rm, nm_pasien, jk, tgl_lahir) = pasien.unwrap_or_default();

    // Setting RS
    let setting: Option<(String, String, String, String)> = sqlx::query_as(
        "SELECT IFNULL(nama_instansi,''), IFNULL(alamat_instansi,''),
                IFNULL(kabupaten,''),     IFNULL(kontak,'')
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;
    let (nama_rs, alamat_rs, kabupaten, kontak) = setting.unwrap_or_default();

    // Base URL media
    let hw_val = sqlx::query_as::<_, (String,)>(
        "SELECT nilai FROM simrscb_config WHERE kunci = 'hosthybridweb' LIMIT 1"
    ).fetch_optional(&state.pool).await.ok().flatten().map(|t| t.0).unwrap_or_default();
    let base_media = if hw_val.starts_with("http") {
        hw_val.rsplit_once('/').map(|(d, _)| d.to_string()).unwrap_or(hw_val.clone())
    } else {
        format!("/{}", hw_val.trim_start_matches('/').trim_end_matches('/'))
    };

    // Petugas pertama dari materi (untuk QR) — fallback empty
    let (nip_petugas, nama_petugas) = rows.first()
        .map(|r| (r.nip.clone().unwrap_or_default(), r.nama_petugas.clone().unwrap_or_default()))
        .unwrap_or_default();

    // Resolve src gambar gallery: kalau base_media http, inline sebagai data-URI
    // (hindari mixed-content di halaman https + hostname internal webapps).
    // File tersimpan di webapps/pelaksanaanedukasi/{foto,ttd}/xxx.jpg.
    let mut gallery_items: Vec<(String, String, String)> = Vec::new();
    for t in &ttds {
        let full = format!("{}/pelaksanaanedukasi/{}", base_media.trim_end_matches('/'), t.url_image);
        let src = if base_media.starts_with("http") {
            fetch_data_uri(&full).await.unwrap_or(full)
        } else { full };
        gallery_items.push((src, t.tanggal.clone(), t.jam.clone()));
    }

    let html = render_cetak(
        &no_rawat, &rows, &gallery_items,
        &no_rm, &nm_pasien, &jk, &tgl_lahir,
        &nama_rs, &alamat_rs, &kabupaten, &kontak,
        &nip_petugas, &nama_petugas,
    );
    Ok(Html(html))
}

/// Ambil gambar dari URL internal (http webapps) → data: URI base64,
/// supaya cetak self-contained (tanpa request gambar eksternal).
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
    Some(format!("data:{};base64,{}", ct, B64.encode(&bytes)))
}

#[allow(clippy::too_many_arguments)]
fn render_cetak(
    no_rawat:    &str,
    rows:        &[MateriEdukasiRow],
    gallery_items: &[(String, String, String)],
    no_rm: &str, nm_pasien: &str, jk: &str, tgl_lahir: &str,
    nama_rs: &str, alamat_rs: &str, kabupaten: &str, kontak: &str,
    nip_petugas: &str, nama_petugas: &str,
) -> String {
    let esc = html_escape;
    let opt = |s: Option<&str>| esc(s.unwrap_or(""));
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

    // QR petugas
    let qr_payload = format!("NIP:{}|Nama:{}|Tgl:{}",
        nip_petugas, nama_petugas, chrono::Local::now().format("%Y-%m-%d"));
    let qr_url = crate::handlers::qr::qr_data_uri(&qr_payload);

    // Tabel materi
    let or_dash = |o: Option<&str>| {
        let v = o.unwrap_or("").trim();
        if v.is_empty() { "-".to_string() } else { esc(v) }
    };
    let mut materi_tbody = String::new();
    if rows.is_empty() {
        materi_tbody.push_str(r#"<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:8px">Belum ada materi tersimpan.</td></tr>"#);
    } else {
        for r in rows {
            // Untuk row lama: kalau profesi NULL, coba parse dari prefix '[Profesi] ...'
            let (profesi_disp, materi_disp): (String, String) = {
                let p_col = r.profesi.as_deref().map(str::trim).filter(|s| !s.is_empty());
                let m_raw = r.materi_edukasi.as_deref().unwrap_or("");
                if let Some(p) = p_col {
                    (p.to_string(), m_raw.to_string())
                } else if let Some(rest) = m_raw.strip_prefix('[').and_then(|s| s.split_once(']')) {
                    (rest.0.trim().to_string(), rest.1.trim().to_string())
                } else {
                    (String::new(), m_raw.to_string())
                }
            };
            materi_tbody.push_str(&format!(
                "<tr>\
                 <td>{tgl}</td><td>{jam}</td>\
                 <td>{penerima_edu}<br/><span class=\"sub\">{diberikan}</span></td>\
                 <td>{profesi}</td>\
                 <td>{materi}<br/><span class=\"sub\">{leaflet}</span></td>\
                 <td>{lama}</td>\
                 <td>{hasil}</td>\
                 <td>{nama_p}<br/><span class=\"sub\">{nip}</span></td>\
                 </tr>",
                tgl          = esc(&r.tanggal),
                jam          = esc(&r.jam),
                penerima_edu = or_dash(r.penerima_edukasi.as_deref()),
                diberikan    = or_dash(r.diberikan_pada.as_deref()),
                profesi      = if profesi_disp.is_empty() { "-".to_string() } else { esc(&profesi_disp) },
                materi       = if materi_disp.is_empty() { "-".to_string() } else { esc(&materi_disp) },
                leaflet      = or_dash(r.kode_leaflet.as_deref()),
                lama         = or_dash(r.lama_edukasi.as_deref()),
                hasil        = or_dash(r.hasil_verifikasi.as_deref()),
                nama_p       = or_dash(r.nama_petugas.as_deref()),
                nip          = or_dash(r.nip.as_deref()),
            ));
        }
    }

    // Gallery foto/TTD
    let mut gallery = String::new();
    if !gallery_items.is_empty() {
        gallery.push_str(r#"<h3>Foto & Tanda Tangan Penerima Edukasi</h3><div class="gal">"#);
        for (src, tgl, jam) in gallery_items {
            gallery.push_str(&format!(
                r#"<div class="gal-item"><img src="{src}" alt="edukasi"/><div class="cap">{tgl} {jam}</div></div>"#,
                src = src, tgl = esc(tgl), jam = esc(jam),
            ));
        }
        gallery.push_str("</div>");
    }

    format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>Pelaksanaan Materi Edukasi — {no_rawat}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:24px;font-size:11px;line-height:1.45}}
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
  h3{{font-size:11px;background:#f1f5f9;border-left:4px solid #1e40af;padding:5px 8px;margin:12px 0 6px}}
  table.mt{{width:100%;border-collapse:collapse;font-size:10px}}
  table.mt th, table.mt td{{border:1px solid #cbd5e1;padding:4px;text-align:left;vertical-align:top}}
  table.mt th{{background:#f1f5f9;font-weight:700}}
  .sub{{color:#64748b;font-size:9px}}
  .gal{{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}}
  .gal-item{{border:1px solid #cbd5e1;padding:4px;text-align:center}}
  .gal-item img{{width:100%;height:100px;object-fit:contain;background:#f8fafc}}
  .gal-item .cap{{font-size:9px;color:#64748b;margin-top:3px}}
  .ttd{{display:flex;justify-content:flex-end;margin-top:20px}}
  .ttd .col{{text-align:center;width:200px}}
  .ttd .col .img{{min-height:100px;display:flex;align-items:center;justify-content:center}}
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

<div class="judul">FORMULIR PELAKSANAAN MATERI EDUKASI PASIEN &amp; KELUARGA</div>

<h3>Identitas Pasien</h3>
<table class="id">
  <tr><td class="lbl">No. Rekam Medis</td><td>: {no_rm}</td><td class="lbl">No. Rawat</td><td>: {no_rawat}</td></tr>
  <tr><td class="lbl">Nama Pasien</td><td>: {nm_pasien}</td><td class="lbl">Jenis Kelamin</td><td>: {jk}</td></tr>
  <tr><td class="lbl">Tgl Lahir</td><td>: {tgl_lahir}</td><td class="lbl">Total Sesi</td><td>: {total_sesi}</td></tr>
</table>

<h3>Daftar Materi Edukasi</h3>
<table class="mt">
  <thead><tr>
    <th>Tanggal</th><th>Jam</th><th>Penerima</th><th>Profesi</th><th>Materi</th>
    <th>Lama (mnt)</th><th>Hasil Verifikasi</th><th>Pemberi Edukasi</th>
  </tr></thead>
  <tbody>{materi_tbody}</tbody>
</table>

{gallery}

<div class="ttd">
  <div class="col">
    <div>Mengetahui,<br/>Petugas Edukator</div>
    <div class="img"><img src="{qr_url}" alt="QR Petugas" style="width:80px;height:80px"/></div>
    <div class="nm">{nama_petugas}</div>
    <div style="font-size:10px;color:#64748b">NIP. {nip_petugas}</div>
  </div>
</div>

</body></html>
"#,
        logo_daerah  = logo_daerah_data_url(),
        logo_rs      = logo_rs_data_url(),
        kab          = esc(&kab_kop),
        rs           = esc(&rs_kop),
        al           = alamat_baris,
        no_rm        = esc(no_rm),
        no_rawat     = esc(no_rawat),
        nm_pasien    = esc(nm_pasien),
        jk           = esc(jk),
        tgl_lahir    = esc(tgl_lahir),
        total_sesi   = rows.len(),
        materi_tbody = materi_tbody,
        gallery      = gallery,
        qr_url       = esc(&qr_url),
        nama_petugas = esc(nama_petugas),
        nip_petugas  = esc(nip_petugas),
    )
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

fn normalize_enum(v: &Option<String>, allowed: &[&str], default: &str) -> String {
    v.as_deref().map(str::trim).filter(|s| !s.is_empty())
        .filter(|s| allowed.contains(s))
        .map(String::from)
        .unwrap_or_else(|| default.to_string())
}

fn normalize_enum_opt<'a>(v: &'a Option<String>, allowed: &[&'a str]) -> Option<&'a str> {
    v.as_deref().map(str::trim).filter(|s| !s.is_empty())
        .and_then(|s| allowed.iter().copied().find(|a| *a == s))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error materi_edukasi: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"Database error"})))
}

fn db_err_msg(e: sqlx::Error, ctx: &str) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error {}: {}", ctx, e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Database error: {}", ctx)})))
}
