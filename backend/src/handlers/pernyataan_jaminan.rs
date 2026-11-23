use crate::{
    auth::middleware::AuthUser,
    models::pernyataan_jaminan::{PernyataanJaminanPrefill, SimpanPernyataanJaminan},
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

// Logo PNG di-embed (sama dengan persetujuan_umum)
const LOGO_DAERAH_PNG: &[u8] = include_bytes!("../../../frontend/public/logo-daerah.png");
const LOGO_RS_PNG:     &[u8] = include_bytes!("../../../frontend/public/logo-rs.png");

fn logo_daerah_data_url() -> String {
    format!("data:image/png;base64,{}", B64.encode(LOGO_DAERAH_PNG))
}
fn logo_rs_data_url() -> String {
    format!("data:image/png;base64,{}", B64.encode(LOGO_RS_PNG))
}

// ── GET /api/pernyataan-jaminan/:no_rawat ───────────────────────────────────
pub async fn get_by_no_rawat(
    user: AuthUser,
    State(state): State<AppState>,
    Path(no_rawat): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "consent_view")?;
    let row: Option<PernyataanJaminanPrefill> = sqlx::query_as(
        "SELECT s.no_surat, s.no_rawat,
                DATE_FORMAT(s.tanggal,'%Y-%m-%d') AS tanggal,
                s.nama_pj, s.no_ktppj, s.tempat_lahirpj,
                DATE_FORMAT(s.lahirpj,'%Y-%m-%d') AS lahirpj,
                s.jkpj, s.alamatpj, s.hubungan, s.no_telp, s.nip,
                s.kd_pj, IFNULL(pj.png_jawab,'') AS png_jawab,
                s.penyakit_diderita,
                p.photo, sg.signature_path, sg.status_jaminan, sg.jenis_jaminan
         FROM surat_pernyataan_jaminan_pasien s
         LEFT JOIN penjab pj                                          ON s.kd_pj = pj.kd_pj
         LEFT JOIN surat_pernyataan_jaminan_pasien_pembuat_pernyataan p ON s.no_surat = p.no_surat
         LEFT JOIN surat_pernyataan_jaminan_pasien_signature          sg ON s.no_surat = sg.no_surat
         WHERE s.no_rawat = ?
         ORDER BY s.tanggal DESC, s.no_surat DESC
         LIMIT 1"
    ).bind(&no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;

    Ok(Json(json!({ "data": row })))
}

// ── GET /api/pernyataan-jaminan (daftar tersimpan) ───────────────────────────
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
        "SELECT s.no_surat, s.no_rawat, DATE_FORMAT(s.tanggal,'%Y-%m-%d') AS tanggal,
                r.no_rkm_medis, p.nm_pasien, s.nama_pj, s.nip
         FROM surat_pernyataan_jaminan_pasien s
         LEFT JOIN reg_periksa r ON r.no_rawat = s.no_rawat
         LEFT JOIN pasien p ON p.no_rkm_medis = r.no_rkm_medis
         WHERE s.tanggal BETWEEN ? AND ?
           AND (s.no_rawat LIKE ? OR s.no_surat LIKE ? OR p.nm_pasien LIKE ? OR r.no_rkm_medis LIKE ?)
         ORDER BY s.tanggal DESC, s.no_surat DESC
         LIMIT ?",
    )
    .bind(&from).bind(&to).bind(&like).bind(&like).bind(&like).bind(&like).bind(limit)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    Ok(Json(json!({ "ok": true, "jumlah": rows.len(), "data": rows })))
}

// ── POST /api/pernyataan-jaminan ────────────────────────────────────────────
pub async fn simpan(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<SimpanPernyataanJaminan>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_consent_edit(&user)?;
    if body.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib diisi"}))));
    }
    if body.nama_pj.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Nama penanggung jawab wajib diisi"}))));
    }
    if body.kd_pj.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Cara bayar wajib dipilih"}))));
    }

    let tanggal = body.tanggal.clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());

    // Resolve no_surat: existing milik no_rawat ini atau generate baru
    let no_surat = match body.no_surat.as_deref().filter(|s| !s.trim().is_empty()) {
        Some(s) => s.to_string(),
        None => {
            let existing: Option<(String,)> = sqlx::query_as(
                "SELECT no_surat FROM surat_pernyataan_jaminan_pasien
                 WHERE no_rawat = ? ORDER BY tanggal DESC, no_surat DESC LIMIT 1"
            ).bind(&body.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
            match existing {
                Some(e) => e.0,
                None => generate_no_surat(&state, &tanggal).await?,
            }
        }
    };

    let hubungan_norm = normalize_hubungan(&body.hubungan);
    let jkpj_norm = match body.jkpj.trim().chars().next() {
        Some('L') | Some('l') => "L",
        Some('P') | Some('p') => "P",
        _ => "L",
    };
    // lahirpj wajib (kolom NOT NULL date di tabel)
    let lahirpj = if body.lahirpj.trim().is_empty() { "1970-01-01".to_string() } else { body.lahirpj.clone() };

    // Validasi NIP terhadap FK petugas.nip — kalau tidak ada, fallback ke '-' (placeholder default Khanza)
    let nip_valid: bool = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM petugas WHERE nip = ?"
    ).bind(&body.nip).fetch_one(&state.pool).await.map_err(db_err)? > 0;
    let nip_resolved = if nip_valid { body.nip.clone() } else { "-".to_string() };
    if !nip_valid {
        tracing::warn!("simpan jaminan: NIP '{}' tidak ada di petugas, fallback ke '-'", body.nip);
    }

    let mut tx = state.pool.begin().await.map_err(db_err)?;

    // 1) UPSERT header
    sqlx::query(
        "INSERT INTO surat_pernyataan_jaminan_pasien
           (no_surat, no_rawat, tanggal, nama_pj, no_ktppj,
            tempat_lahirpj, lahirpj, jkpj, alamatpj, hubungan,
            no_telp, nip, kd_pj, penyakit_diderita)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           no_rawat=VALUES(no_rawat), tanggal=VALUES(tanggal),
           nama_pj=VALUES(nama_pj), no_ktppj=VALUES(no_ktppj),
           tempat_lahirpj=VALUES(tempat_lahirpj), lahirpj=VALUES(lahirpj),
           jkpj=VALUES(jkpj), alamatpj=VALUES(alamatpj),
           hubungan=VALUES(hubungan), no_telp=VALUES(no_telp),
           nip=VALUES(nip), kd_pj=VALUES(kd_pj),
           penyakit_diderita=VALUES(penyakit_diderita)"
    )
    .bind(&no_surat).bind(&body.no_rawat).bind(&tanggal)
    .bind(&body.nama_pj).bind(&body.no_ktppj)
    .bind(&body.tempat_lahirpj).bind(&lahirpj)
    .bind(jkpj_norm).bind(&body.alamatpj).bind(hubungan_norm)
    .bind(&body.no_telp).bind(&nip_resolved).bind(&body.kd_pj)
    .bind(&body.penyakit_diderita)
    .execute(&mut *tx).await.map_err(|e| db_err_msg(e, "INSERT surat_pernyataan_jaminan_pasien"))?;

    // 2) UPSERT signature (opsional: simpan status_jaminan & jenis_jaminan kalau di-set)
    let status_norm = body.status_jaminan.as_deref()
        .filter(|v| matches!(*v, "TIDAK MEMILIKI"|"TIDAK MENGGUNAKAN"));
    let jenis_norm = body.jenis_jaminan.as_deref()
        .filter(|v| matches!(*v, "BPJS"|"KIS"|"Perusahaan"));
    if status_norm.is_some() || jenis_norm.is_some() {
        sqlx::query(
            "INSERT INTO surat_pernyataan_jaminan_pasien_signature
               (no_surat, status_jaminan, jenis_jaminan)
             VALUES (?,?,?)
             ON DUPLICATE KEY UPDATE
               status_jaminan = VALUES(status_jaminan),
               jenis_jaminan  = VALUES(jenis_jaminan)"
        )
        .bind(&no_surat).bind(status_norm).bind(jenis_norm)
        .execute(&mut *tx).await.map_err(|e| db_err_msg(e, "INSERT signature"))?;
    }

    // 3) Audit cetak
    sqlx::query(
        "INSERT INTO log_cetak_surat_pernyataan_jaminan_pasien
           (no_surat, no_rawat, jenis_surat, kd_user, tanggal, jam)
         VALUES (?,?, 'PERNYATAAN JAMINAN PASIEN', ?, current_date(), current_time())"
    )
    .bind(&no_surat).bind(&body.no_rawat).bind(&user.0.kode)
    .execute(&mut *tx).await.map_err(|e| db_err_msg(e, "INSERT log_cetak"))?;

    tx.commit().await.map_err(db_err)?;

    use crate::audit::{q, qo};
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO surat_pernyataan_jaminan_pasien (no_surat, no_rawat, tanggal, nama_pj, no_ktppj, tempat_lahirpj, lahirpj, jkpj, alamatpj, hubungan, no_telp, nip, kd_pj, penyakit_diderita) VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})",
        q(&no_surat), q(&body.no_rawat), q(&tanggal), q(&body.nama_pj), q(&body.no_ktppj),
        q(&body.tempat_lahirpj), q(&lahirpj), q(jkpj_norm), q(&body.alamatpj), q(hubungan_norm),
        q(&body.no_telp), q(&nip_resolved), q(&body.kd_pj), qo(body.penyakit_diderita.as_ref())
    )).await;
    if status_norm.is_some() || jenis_norm.is_some() {
        crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
            "INSERT INTO surat_pernyataan_jaminan_pasien_signature (no_surat, status_jaminan, jenis_jaminan) VALUES ({}, {}, {})",
            q(&no_surat), qo(status_norm), qo(jenis_norm)
        )).await;
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO log_cetak_surat_pernyataan_jaminan_pasien (no_surat, no_rawat, jenis_surat, kd_user, tanggal, jam) VALUES ({}, {}, 'PERNYATAAN JAMINAN PASIEN', {}, current_date(), current_time())",
        q(&no_surat), q(&body.no_rawat), q(&user.0.kode)
    )).await;

    Ok(Json(json!({
        "success":  true,
        "no_surat": no_surat,
        "tanggal":  tanggal,
    })))
}

// ── GET /api/pernyataan-jaminan/:no_rawat/cetak ─────────────────────────────
pub async fn cetak_html(
    user: AuthUser,
    State(state): State<AppState>,
    Path(no_rawat): Path<String>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "consent_view")?;
    let pj: Option<PernyataanJaminanPrefill> = sqlx::query_as(
        "SELECT s.no_surat, s.no_rawat,
                DATE_FORMAT(s.tanggal,'%Y-%m-%d') AS tanggal,
                s.nama_pj, s.no_ktppj, s.tempat_lahirpj,
                DATE_FORMAT(s.lahirpj,'%Y-%m-%d') AS lahirpj,
                s.jkpj, s.alamatpj, s.hubungan, s.no_telp, s.nip,
                s.kd_pj, IFNULL(pjt.png_jawab,'') AS png_jawab,
                s.penyakit_diderita,
                p.photo, sg.signature_path, sg.status_jaminan, sg.jenis_jaminan
         FROM surat_pernyataan_jaminan_pasien s
         LEFT JOIN penjab pjt                                          ON s.kd_pj = pjt.kd_pj
         LEFT JOIN surat_pernyataan_jaminan_pasien_pembuat_pernyataan p ON s.no_surat = p.no_surat
         LEFT JOIN surat_pernyataan_jaminan_pasien_signature          sg ON s.no_surat = sg.no_surat
         WHERE s.no_rawat = ?
         ORDER BY s.tanggal DESC, s.no_surat DESC
         LIMIT 1"
    ).bind(&no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;

    let Some(pj) = pj else {
        return Err((StatusCode::NOT_FOUND,
            Json(json!({"error":"Pernyataan jaminan belum tersimpan untuk no_rawat ini"}))));
    };

    // Identitas pasien dari reg_periksa/pasien
    let pasien: Option<(String, String, String, String, String, String, String)> = sqlx::query_as(
        "SELECT p.no_rkm_medis, p.nm_pasien, IFNULL(p.tmp_lahir,''),
                DATE_FORMAT(p.tgl_lahir,'%d-%m-%Y') AS tgl_lahir,
                CONCAT(IFNULL(p.alamat,''),', ',IFNULL(kel.nm_kel,''),', ',IFNULL(kec.nm_kec,''),', ',IFNULL(kab.nm_kab,'')) AS alamat,
                DATE_FORMAT(r.tgl_registrasi,'%d-%m-%Y') AS tgl_masuk,
                IFNULL(p.no_tlp,'') AS no_tlp
         FROM reg_periksa r
         INNER JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN kelurahan kel ON p.kd_kel = kel.kd_kel
         LEFT JOIN kecamatan kec ON p.kd_kec = kec.kd_kec
         LEFT JOIN kabupaten kab ON p.kd_kab = kab.kd_kab
         WHERE r.no_rawat = ? LIMIT 1"
    ).bind(&no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    let (no_rm, nm_pasien, tmp_lahir_p, tgl_lahir_p, alamat_p, tgl_masuk, _no_tlp_p) = pasien.unwrap_or_default();
    let ttl_pasien = if tmp_lahir_p.is_empty() && tgl_lahir_p.is_empty() {
        String::new()
    } else if tmp_lahir_p.is_empty() {
        tgl_lahir_p.clone()
    } else if tgl_lahir_p.is_empty() {
        tmp_lahir_p.clone()
    } else {
        format!("{}, {}", tmp_lahir_p, tgl_lahir_p)
    };

    // Setting RS
    let setting: Option<(String, String, String, String, String)> = sqlx::query_as(
        "SELECT IFNULL(nama_instansi,''), IFNULL(alamat_instansi,''),
                IFNULL(kabupaten,''),     IFNULL(kontak,''), IFNULL(email,'')
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;
    let (nama_rs, alamat_rs, kabupaten, kontak, email) = setting.unwrap_or_default();

    // Nama petugas (dari NIP penanggung jawab — opsional)
    let nama_petugas: String = sqlx::query_as::<_, (String,)>(
        "SELECT nama FROM petugas WHERE nip = ? LIMIT 1"
    ).bind(pj.nip.as_deref().unwrap_or(""))
     .fetch_optional(&state.pool).await.ok().flatten()
     .map(|t| t.0).unwrap_or_default();

    // URL base foto/TTD
    let hw_val = sqlx::query_as::<_, (String,)>(
        "SELECT nilai FROM simrscb_config WHERE kunci = 'hosthybridweb' LIMIT 1"
    ).fetch_optional(&state.pool).await.ok().flatten().map(|t| t.0).unwrap_or_default();
    let base_media = if hw_val.starts_with("http") {
        hw_val.rsplit_once('/').map(|(d, _)| d.to_string()).unwrap_or(hw_val.clone())
    } else {
        format!("/{}", hw_val.trim_start_matches('/').trim_end_matches('/'))
    };

    let html = render_html(
        &pj, &nama_petugas,
        &no_rm, &nm_pasien, &ttl_pasien, &alamat_p, &tgl_masuk,
        &nama_rs, &alamat_rs, &kabupaten, &kontak, &email,
        &base_media,
    );
    Ok(Html(html))
}

#[allow(clippy::too_many_arguments)]
fn render_html(
    pj:           &PernyataanJaminanPrefill,
    nama_petugas: &str,
    no_rm:        &str, nm_pasien: &str, ttl_pasien: &str, alamat_p: &str, tgl_masuk: &str,
    nama_rs:      &str, alamat_rs: &str, kabupaten: &str, kontak: &str, email: &str,
    base_media:   &str,
) -> String {
    let esc = html_escape;
    let opt = |o: &Option<String>| esc(o.as_deref().unwrap_or(""));

    let kabupaten_kop = kabupaten.to_uppercase().replace("KAB.", "KABUPATEN").replace("KAB ", "KABUPATEN ");
    let kabupaten_kop = if kabupaten_kop.is_empty() { String::new() } else { format!("PEMERINTAH {}", kabupaten_kop) };
    let nama_rs_kop = if nama_rs.is_empty() { "RUMAH SAKIT UMUM DAERAH CABANGBUNGIN".to_string() } else { nama_rs.to_uppercase() };

    let mut alamat_baris1 = String::new();
    if !alamat_rs.is_empty() { alamat_baris1.push_str(&esc(alamat_rs)); }
    let mut alamat_baris2 = String::new();
    if !kontak.is_empty() { alamat_baris2.push_str(&format!("Tlp. {}", esc(kontak))); }
    if !email.is_empty() {
        if !alamat_baris2.is_empty() { alamat_baris2.push_str(" — "); }
        alamat_baris2.push_str(&format!("email: {}", esc(email)));
    }

    // Foto & TTD
    let photo_html = pj.photo.as_deref().filter(|s| !s.is_empty())
        .map(|p| format!(
            r#"<img src="{base}/suratpernyataanjaminan/{path}" alt="Foto PJ" style="width:100px;height:100px;object-fit:cover;border:1px solid #cbd5e1;border-radius:4px;"/>"#,
            base=esc(base_media), path=esc(p)))
        .unwrap_or_default();
    let ttd_html = pj.signature_path.as_deref().filter(|s| !s.is_empty())
        .map(|p| format!(
            r#"<img src="{base}/suratpernyataanjaminan/{path}" alt="TTD" style="width:160px;height:60px;object-fit:contain;"/>"#,
            base=esc(base_media), path=esc(p)))
        .unwrap_or_default();

    // QR code untuk Petugas Pendaftaran (NIP|Nama|Tgl)
    let qr_payload = format!("NIP:{}|Nama:{}|Tgl:{}",
        pj.nip.as_deref().unwrap_or(""), nama_petugas, pj.tanggal.as_deref().unwrap_or(""));
    let qr_url = crate::handlers::qr::qr_data_uri(&qr_payload);

    // Daftar 1-6 cara bayar — yang dipilih (sesuai nama png_jawab) di-bold
    let png = pj.png_jawab.as_deref().unwrap_or("").to_uppercase();
    let pick = |label: &str| -> &'static str {
        let l = label.to_uppercase();
        // Cek apakah png_jawab match (longgar — substring match agar BPJS/KIS-BPJS/dll terdeteksi)
        if !png.is_empty() && (l.contains(&png) || png.contains(&l)
            || (l == "AKSES SOSIAL/PNS" && (png.contains("PNS") || png.contains("AKSES SOSIAL")))
            || (l == "KIS/BPJS" && (png.contains("KIS") || png.contains("BPJS") || png.contains("KARTU SEHAT")))
            || (l == "JAMINAN PERUSAHAAN" && png.contains("PERUSAHAAN"))
            || (l == "TUNAI (PRIBADI)" && (png.contains("UMUM") || png.contains("PRIBADI") || png.contains("TUNAI"))))
        {
            "font-weight:700;color:#0f172a"
        } else { "color:#475569" }
    };
    // Khusus "Lain-lain" — dipilih hanya kalau png_jawab tidak match item 1-5
    let lain_dipilih = !png.is_empty() && !png.contains("UMUM") && !png.contains("PRIBADI") && !png.contains("TUNAI")
        && !png.contains("PNS") && !png.contains("AKSES SOSIAL") && !png.contains("KIS") && !png.contains("BPJS")
        && !png.contains("KARTU SEHAT") && !png.contains("PERUSAHAAN") && !png.contains("JAMKESDA");
    let lain_style = if lain_dipilih { "font-weight:700;color:#0f172a" } else { "color:#475569" };
    let lain_text = if lain_dipilih { esc(&png) } else { "..................................".to_string() };

    format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>Surat Pernyataan Jaminan — {no_surat}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:24px;font-size:11px;line-height:1.55}}
  .kop{{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:14px;position:relative}}
  .kop img{{width:60px;height:60px;object-fit:contain}}
  .kop .ctr{{flex:1;text-align:center}}
  .kop .kab{{font-size:11px;font-weight:700}}
  .kop .rs{{font-size:14px;font-weight:800}}
  .kop .al{{font-size:10px;color:#334155}}
  .kop .nm{{position:absolute;top:0;right:0;border:1px solid #0f172a;padding:2px 6px;font-size:9px}}
  .judul{{text-align:center;font-weight:800;font-size:13px;margin:4px 0}}
  .judul u{{text-decoration:underline}}
  table.id{{width:100%;border-collapse:collapse;margin:8px 0}}
  table.id td{{padding:2px 4px;vertical-align:top}}
  table.id td.lbl{{width:170px}}
  table.id td.sep{{width:6px}}
  table.id td.val{{border-bottom:1px dotted #94a3b8}}
  ol.bayar{{margin:6px 0 6px 32px;padding:0}}
  ol.bayar li{{margin:1px 0}}
  .ttd{{display:flex;justify-content:space-between;margin-top:20px}}
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
    <div class="al">{alamat1}</div>
    <div class="al">{alamat2}</div>
  </div>
  <img src="{logo_rs}" alt="logo rs"/>
  <div class="nm">RM.ADM.05.006.2019</div>
</div>

<div class="judul">SURAT PERNYATAAN<br/><u>STATUS JAMINAN PASIEN</u></div>

<p style="margin:8px 0 4px">Yang bertandatangan dibawah ini :</p>
<table class="id">
  <tr><td class="lbl">Nama</td><td class="sep">:</td><td class="val">{nama_pj}</td></tr>
  <tr><td class="lbl">Alamat Tempat Tinggal</td><td class="sep">:</td><td class="val">{alamat_pj}</td></tr>
  <tr><td class="lbl">Adalah</td><td class="sep">:</td><td class="val">{hubungan} dari pasien</td></tr>
  <tr><td class="lbl">Nomor Rekam Medik</td><td class="sep">:</td><td class="val">{no_rm}</td></tr>
  <tr><td class="lbl">Nama Pasien</td><td class="sep">:</td><td class="val">{nm_pasien}</td></tr>
  <tr><td class="lbl">Tempat Tanggal Lahir</td><td class="sep">:</td><td class="val">{ttl_pasien}</td></tr>
  <tr><td class="lbl">Alamat Tempat Tinggal</td><td class="sep">:</td><td class="val">{alamat_p}</td></tr>
  <tr><td class="lbl">Penyakit Yang Diderita</td><td class="sep">:</td><td class="val">{penyakit}</td></tr>
  <tr><td class="lbl">Tanggal Masuk Berobat</td><td class="sep">:</td><td class="val">{tgl_masuk}</td></tr>
</table>

<p style="margin-top:6px">Dengan ini menyatakan bahwa pasien tersebut diatas menjadi tanggung jawab saya dan semua biaya yang dibebankan pada pasien selama mendapatkan pelayanan kesehatan di {rs_inline} seluruh akan dibayar secara :</p>

<ol class="bayar">
  <li style="{s1}">Tunai (Pribadi)</li>
  <li style="{s2}">Akses Sosial/PNS</li>
  <li style="{s3}">KIS/BPJS</li>
  <li style="{s4}">Jaminan Perusahaan</li>
  <li style="{s5}">JAMKESDA</li>
  <li style="{slain}">Dan Lain-lain, Sebutkan: {lain_text}</li>
</ol>

<p style="margin-top:8px">Demikian pernyataan ini dibuat dengan sebenarnya dalam keadaan sadar tidak dalam tekanan. Apabila dikemudian hari terjadi pelanggaran dalam pembayaran akibat ketidak sesuaian dengan pernyataan yang tertulis dalam surat pernyataan ini, maka sebagai penanggung jawab, saya bersedia diproses sesuai hukum yang berlaku.</p>

<div class="ttd">
  <div class="col">
    <div>Mengetahui,<br/>Petugas Pendaftaran</div>
    <div class="img"><img src="{qr_url}" alt="QR Petugas" style="width:80px;height:80px"/></div>
    <div class="nm">{nama_petugas}</div>
    <div style="font-size:10px;color:#64748b">NIP. {nip}</div>
  </div>
  <div class="col">
    <div>Bekasi, {tanggal}</div>
    <div>Penanggung Jawab</div>
    <div class="img">{photo}{ttd}</div>
    <div class="nm">{nama_pj}</div>
  </div>
</div>

</body></html>
"#,
        logo_daerah = logo_daerah_data_url(),
        logo_rs     = logo_rs_data_url(),
        no_surat    = opt(&pj.no_surat),
        kab         = esc(&kabupaten_kop),
        rs          = esc(&nama_rs_kop),
        rs_inline   = esc(nama_rs.trim()),
        alamat1     = alamat_baris1,
        alamat2     = alamat_baris2,
        nama_pj     = opt(&pj.nama_pj),
        alamat_pj   = opt(&pj.alamatpj),
        hubungan    = opt(&pj.hubungan),
        no_rm       = esc(no_rm),
        nm_pasien   = esc(nm_pasien),
        ttl_pasien  = esc(&ttl_pasien),
        alamat_p    = esc(alamat_p),
        penyakit    = opt(&pj.penyakit_diderita),
        tgl_masuk   = esc(tgl_masuk),
        tanggal     = opt(&pj.tanggal),
        s1          = pick("Tunai (Pribadi)"),
        s2          = pick("Akses Sosial/PNS"),
        s3          = pick("KIS/BPJS"),
        s4          = pick("Jaminan Perusahaan"),
        s5          = pick("JAMKESDA"),
        slain       = lain_style,
        lain_text   = lain_text,
        nama_petugas = esc(nama_petugas),
        nip         = opt(&pj.nip),
        qr_url      = esc(&qr_url),
        photo       = photo_html,
        ttd         = ttd_html,
    )
}

// Format Java: PSJ<YYYYMMDD><3-digit>
async fn generate_no_surat(
    state: &AppState,
    tanggal_iso: &str,
) -> Result<String, (StatusCode, Json<Value>)> {
    let prefix = format!("PSJ{}", tanggal_iso.replace('-', ""));
    let max: Option<(String,)> = sqlx::query_as(
        "SELECT no_surat FROM surat_pernyataan_jaminan_pasien
         WHERE no_surat LIKE CONCAT(?, '%')
         ORDER BY no_surat DESC LIMIT 1"
    ).bind(&prefix).fetch_optional(&state.pool).await.map_err(db_err)?;

    let next = max
        .and_then(|(s,)| s.get(prefix.len()..).and_then(|t| t.parse::<u32>().ok()))
        .map(|n| n + 1)
        .unwrap_or(1);
    Ok(format!("{}{:03}", prefix, next))
}

// ENUM `hubungan` di Khanza: 'Suami','Istri','Anak','Ayah','Ibu','Saudara','Keponakan'
fn normalize_hubungan(s: &str) -> &str {
    let allowed = ["Suami","Istri","Anak","Ayah","Ibu","Saudara","Keponakan"];
    let t = s.trim();
    if allowed.contains(&t) { t } else { "Saudara" }
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
    tracing::error!("DB error pernyataan_jaminan: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"Database error"})))
}

fn db_err_msg(e: sqlx::Error, ctx: &str) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error {}: {}", ctx, e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Database error: {}", ctx)})))
}
