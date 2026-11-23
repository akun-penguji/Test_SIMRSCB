use crate::{
    auth::middleware::AuthUser,
    models::persetujuan_umum::{PersetujuanUmumPrefill, SimpanPersetujuanUmum},
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

// Logo PNG di-embed ke binary supaya bisa di-inline sebagai data URL di HTML
const LOGO_DAERAH_PNG: &[u8] = include_bytes!("../../../frontend/public/logo-daerah.png");
const LOGO_RS_PNG:     &[u8] = include_bytes!("../../../frontend/public/logo-rs.png");

fn logo_daerah_data_url() -> String {
    format!("data:image/png;base64,{}", B64.encode(LOGO_DAERAH_PNG))
}
fn logo_rs_data_url() -> String {
    format!("data:image/png;base64,{}", B64.encode(LOGO_RS_PNG))
}

/// Resolve src gambar untuk HTML cetak. Bila `base` berupa URL http(s) (mode
/// hosthybridweb remote), ambil file server-side lalu kembalikan sebagai data URL
/// (base64) supaya tidak terblokir mixed-content saat halaman dibuka via https.
/// Bila `base` path lokal (same-origin), kembalikan URL relatif apa adanya.
async fn resolve_media_src(base: &str, path: Option<&str>) -> String {
    let path = match path { Some(p) if !p.trim().is_empty() => p, _ => return String::new() };
    let full = format!("{}/persetujuanumum/{}", base.trim_end_matches('/'), path);
    if base.starts_with("http") {
        if let Ok(client) = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(6)).build()
        {
            if let Ok(resp) = client.get(&full).send().await {
                if resp.status().is_success() {
                    let ct = resp.headers().get(reqwest::header::CONTENT_TYPE)
                        .and_then(|v| v.to_str().ok()).unwrap_or("image/jpeg").to_string();
                    if let Ok(bytes) = resp.bytes().await {
                        return format!("data:{};base64,{}", ct, B64.encode(&bytes));
                    }
                }
            }
        }
        return html_escape(&full); // gagal ambil → fallback URL asli
    }
    html_escape(&full)
}

// ── GET /api/persetujuan-umum/:no_rawat ──────────────────────────────────────
pub async fn get_by_no_rawat(
    user: AuthUser,
    State(state): State<AppState>,
    Path(no_rawat): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "consent_view")?;
    // Cari baris paling baru milik no_rawat tsb (Java desktop boleh punya beberapa)
    let row: Option<PersetujuanUmumPrefill> = sqlx::query_as(
        "SELECT s.no_surat, s.no_rawat,
                DATE_FORMAT(s.tanggal,'%Y-%m-%d') AS tanggal,
                TIME_FORMAT(s.jam,'%H:%i') AS jam,
                s.pengobatan_kepada, s.nilai_kepercayaan,
                s.nama_pj, s.umur_pj, s.no_ktppj, s.jkpj,
                s.bertindak_atas, s.no_telp, s.nip,
                t.nama_keluarga_a, t.hubungan_pasien_a,
                t.nama_keluarga_b, t.hubungan_pasien_b,
                t.nama_keluarga_c, t.hubungan_pasien_c,
                t.hubungan_keluarga_a, t.detail_hubungan_a,
                t.hubungan_keluarga_b, t.detail_hubungan_b,
                t.hubungan_keluarga_c, t.detail_hubungan_c,
                t.pilihan_akses_kunjungan, t.nama_tidak_diizinkan,
                t.preferensi_perawat, t.preferensi_dokter,
                t.nilai_keyakinan, t.nilai_keyakinan_cetak,
                t.permintaan_privasi, t.permintaan_privasi_cetak,
                t.kelas_perawatan, t.biaya_perkiraan_tindakan,
                t.biaya_administrasi, t.biaya_pemeriksaan_penunjang,
                t.biaya_farmasi, t.biaya_lain_lain,
                p.photo, t.signature_path, t.saksi_pasien, t.photo_saksi, t.ttd_saksi, t.pelayanan_rohani, t.pelepasan_informasi
         FROM surat_persetujuan_umum s
         LEFT JOIN surat_persetujuan_umum_tambahan          t ON s.no_surat = t.no_surat
         LEFT JOIN surat_persetujuan_umum_pembuat_pernyataan p ON s.no_surat = p.no_surat
         WHERE s.no_rawat = ?
         ORDER BY s.tanggal DESC, s.no_surat DESC
         LIMIT 1"
    ).bind(&no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;

    Ok(Json(json!({ "data": row })))
}

// ── GET /api/persetujuan-umum (daftar data tersimpan) ────────────────────────
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
         FROM surat_persetujuan_umum s
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

// ── POST /api/persetujuan-umum ───────────────────────────────────────────────
// ── DELETE /api/persetujuan-umum/:no_rawat ───────────────────────────────────
pub async fn hapus(
    user: AuthUser,
    State(state): State<AppState>,
    Path(no_rawat): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_consent_edit(&user)?;
    let mut tx = state.pool.begin().await.map_err(db_err)?;
    sqlx::query(
        "DELETE t FROM surat_persetujuan_umum_tambahan t \
         JOIN surat_persetujuan_umum h ON h.no_surat = t.no_surat \
         WHERE h.no_rawat = ?"
    ).bind(&no_rawat).execute(&mut *tx).await.map_err(db_err)?;
    let res = sqlx::query("DELETE FROM surat_persetujuan_umum WHERE no_rawat = ?")
        .bind(&no_rawat).execute(&mut *tx).await.map_err(db_err)?;
    tx.commit().await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Data tidak ditemukan"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS persetujuan_umum no_rawat={}", no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// Render checklist (Nilai & Keyakinan / Permintaan Privasi) untuk CETAK jasper:
// SEMUA item ditampilkan dengan tanda pilihan Ya / Tidak sesuai isian pasien,
// mengikuti formulir PDF resmi. Input JSON: [{"label":"...","ya":bool,"d":"detail"}]
fn render_checklist_cetak(json: &Option<String>) -> String {
    let raw = match json { Some(s) if !s.trim().is_empty() => s.as_str(), _ => return String::new() };
    let items: Vec<serde_json::Value> = serde_json::from_str(raw).unwrap_or_default();
    let esc = |s: &str| s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");
    let ck = "&#9745;"; let uc = "&#9744;";
    let mut out = String::new();
    for it in &items {
        let ya = it.get("ya").and_then(|v| v.as_bool()).unwrap_or(false)
            || it.get("ya").and_then(|v| v.as_str()).map(|s| s.eq_ignore_ascii_case("ya") || s == "true").unwrap_or(false);
        let label = it.get("label").and_then(|v| v.as_str()).unwrap_or("").trim();
        if label.is_empty() { continue; }
        let d = it.get("d").and_then(|v| v.as_str()).unwrap_or("").trim();
        let mark = if ya { format!("{ck} Ya {uc} Tidak") } else { format!("{uc} Ya {ck} Tidak") };
        if d.is_empty() {
            out.push_str(&format!("{} &nbsp; {}<br/>", mark, esc(label)));
        } else {
            out.push_str(&format!("{} &nbsp; {}: {}<br/>", mark, esc(label), esc(d)));
        }
    }
    out
}

// Render checklist Ya/Tidak untuk CETAK format PDF resmi: SEMUA item ditampilkan
// dengan kolom centang Ya & Tidak (bukan hanya item "Ya").
fn render_checklist_yt(json: &Option<String>) -> String {
    let raw = match json { Some(s) if !s.trim().is_empty() => s.as_str(), _ => return String::new() };
    let items: Vec<serde_json::Value> = serde_json::from_str(raw).unwrap_or_default();
    if items.is_empty() { return String::new(); }
    let esc = |s: &str| s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");
    let ck = "&#9745;"; let uc = "&#9744;";
    let mut out = String::from("<table style=\"width:100%;border-collapse:collapse;font-size:10px;margin-top:3px\">");
    out.push_str("<tr><td style=\"width:34px;text-align:center;font-weight:700\">Ya</td><td style=\"width:40px;text-align:center;font-weight:700\">Tidak</td><td></td></tr>");
    for it in &items {
        let ya = it.get("ya").and_then(|v| v.as_bool()).unwrap_or(false)
            || it.get("ya").and_then(|v| v.as_str()).map(|s| s.eq_ignore_ascii_case("ya") || s == "true").unwrap_or(false);
        let label = it.get("label").and_then(|v| v.as_str()).unwrap_or("").trim();
        if label.is_empty() { continue; }
        let d = it.get("d").and_then(|v| v.as_str()).unwrap_or("").trim();
        let label_full = if d.is_empty() { esc(label) } else { format!("{} : {}", esc(label), esc(d)) };
        out.push_str(&format!(
            "<tr><td style=\"text-align:center;font-size:12px\">{}</td><td style=\"text-align:center;font-size:12px\">{}</td><td>{}</td></tr>",
            if ya {ck} else {uc}, if ya {uc} else {ck}, label_full));
    }
    out.push_str("</table>");
    out
}

pub async fn simpan(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<SimpanPersetujuanUmum>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_consent_edit(&user)?;
    if body.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib diisi"}))));
    }

    // Tanggal default = hari ini
    let tanggal = body.tanggal.clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());
    // Jam TTD pasien: pakai isian, default jam sekarang (HH:MM:SS)
    let jam = body.jam.clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| chrono::Local::now().format("%H:%M:%S").to_string());

    // 1) Resolve no_surat: ambil yg sudah ada milik no_rawat ini, atau generate baru
    let no_surat = match body.no_surat.as_deref().filter(|s| !s.trim().is_empty()) {
        Some(s) => s.to_string(),
        None => {
            let existing: Option<(String,)> = sqlx::query_as(
                "SELECT no_surat FROM surat_persetujuan_umum
                 WHERE no_rawat = ? ORDER BY tanggal DESC, no_surat DESC LIMIT 1"
            ).bind(&body.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
            match existing {
                Some(e) => e.0,
                None => generate_no_surat(&state, &tanggal).await?,
            }
        }
    };

    // Sanitasi nilai enum yang ketat (kolom Java pakai ENUM — ditolak kalau tidak match)
    let pengobatan = normalize_pengobatan_kepada(body.pengobatan_kepada.as_deref());
    let bertindak  = normalize_bertindak_atas(&body.bertindak_atas);
    let jkpj_norm  = match body.jkpj.trim().chars().next() {
        Some('L') | Some('l') => "L",
        Some('P') | Some('p') => "P",
        _ => "L",
    };
    let nilai_keprc = body.nilai_kepercayaan.unwrap_or_default();

    let mut tx = state.pool.begin().await.map_err(db_err)?;

    // 2) UPSERT header surat_persetujuan_umum
    sqlx::query(
        "INSERT INTO surat_persetujuan_umum
           (no_surat, no_rawat, tanggal, jam, pengobatan_kepada, nilai_kepercayaan,
            nama_pj, umur_pj, no_ktppj, jkpj, bertindak_atas, no_telp, nip)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           no_rawat=VALUES(no_rawat), tanggal=VALUES(tanggal), jam=VALUES(jam),
           pengobatan_kepada=VALUES(pengobatan_kepada), nilai_kepercayaan=VALUES(nilai_kepercayaan),
           nama_pj=VALUES(nama_pj), umur_pj=VALUES(umur_pj), no_ktppj=VALUES(no_ktppj),
           jkpj=VALUES(jkpj), bertindak_atas=VALUES(bertindak_atas),
           no_telp=VALUES(no_telp), nip=VALUES(nip)"
    )
    .bind(&no_surat).bind(&body.no_rawat).bind(&tanggal).bind(&jam)
    .bind(&pengobatan).bind(&nilai_keprc)
    .bind(&body.nama_pj).bind(&body.umur_pj).bind(&body.no_ktppj)
    .bind(jkpj_norm).bind(&bertindak).bind(&body.no_telp).bind(&body.nip)
    .execute(&mut *tx).await.map_err(|e| db_err_msg(e, "INSERT surat_persetujuan_umum"))?;

    // 3) UPSERT surat_persetujuan_umum_tambahan
    let pilihan_akses = normalize_pilihan_akses(body.pilihan_akses_kunjungan.as_deref());
    // Snapshot HTML utk cetak: hanya item yang dipilih "Ya" yang ditampilkan.
    let nilai_keyakinan_cetak = render_checklist_cetak(&body.nilai_keyakinan);
    let permintaan_privasi_cetak = render_checklist_cetak(&body.permintaan_privasi);
    sqlx::query(
        "INSERT INTO surat_persetujuan_umum_tambahan
           (no_surat,
            nama_keluarga_a, hubungan_pasien_a,
            nama_keluarga_b, hubungan_pasien_b,
            nama_keluarga_c, hubungan_pasien_c,
            hubungan_keluarga_a, detail_hubungan_a,
            hubungan_keluarga_b, detail_hubungan_b,
            hubungan_keluarga_c, detail_hubungan_c,
            pilihan_akses_kunjungan, nama_tidak_diizinkan,
            preferensi_perawat, preferensi_dokter,
            nilai_keyakinan, nilai_keyakinan_cetak,
            permintaan_privasi, permintaan_privasi_cetak,
            kelas_perawatan,
            biaya_perkiraan_tindakan, biaya_administrasi,
            biaya_pemeriksaan_penunjang, biaya_farmasi, biaya_lain_lain, saksi_pasien, pelayanan_rohani, pelepasan_informasi)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           nilai_keyakinan=VALUES(nilai_keyakinan), nilai_keyakinan_cetak=VALUES(nilai_keyakinan_cetak),
           permintaan_privasi=VALUES(permintaan_privasi), permintaan_privasi_cetak=VALUES(permintaan_privasi_cetak),
           nama_keluarga_a=VALUES(nama_keluarga_a), hubungan_pasien_a=VALUES(hubungan_pasien_a),
           nama_keluarga_b=VALUES(nama_keluarga_b), hubungan_pasien_b=VALUES(hubungan_pasien_b),
           nama_keluarga_c=VALUES(nama_keluarga_c), hubungan_pasien_c=VALUES(hubungan_pasien_c),
           hubungan_keluarga_a=VALUES(hubungan_keluarga_a), detail_hubungan_a=VALUES(detail_hubungan_a),
           hubungan_keluarga_b=VALUES(hubungan_keluarga_b), detail_hubungan_b=VALUES(detail_hubungan_b),
           hubungan_keluarga_c=VALUES(hubungan_keluarga_c), detail_hubungan_c=VALUES(detail_hubungan_c),
           pilihan_akses_kunjungan=VALUES(pilihan_akses_kunjungan),
           nama_tidak_diizinkan=VALUES(nama_tidak_diizinkan),
           preferensi_perawat=VALUES(preferensi_perawat),
           preferensi_dokter=VALUES(preferensi_dokter),
           kelas_perawatan=VALUES(kelas_perawatan),
           biaya_perkiraan_tindakan=VALUES(biaya_perkiraan_tindakan),
           biaya_administrasi=VALUES(biaya_administrasi),
           biaya_pemeriksaan_penunjang=VALUES(biaya_pemeriksaan_penunjang),
           biaya_farmasi=VALUES(biaya_farmasi),
           biaya_lain_lain=VALUES(biaya_lain_lain),
           saksi_pasien=VALUES(saksi_pasien),
           pelayanan_rohani=VALUES(pelayanan_rohani),
           pelepasan_informasi=VALUES(pelepasan_informasi)"
    )
    .bind(&no_surat)
    .bind(&body.nama_keluarga_a).bind(&body.hubungan_pasien_a)
    .bind(&body.nama_keluarga_b).bind(&body.hubungan_pasien_b)
    .bind(&body.nama_keluarga_c).bind(&body.hubungan_pasien_c)
    .bind(&body.hubungan_keluarga_a).bind(&body.detail_hubungan_a)
    .bind(&body.hubungan_keluarga_b).bind(&body.detail_hubungan_b)
    .bind(&body.hubungan_keluarga_c).bind(&body.detail_hubungan_c)
    .bind(&pilihan_akses).bind(&body.nama_tidak_diizinkan)
    .bind(&body.preferensi_perawat).bind(&body.preferensi_dokter)
    .bind(&body.nilai_keyakinan).bind(&nilai_keyakinan_cetak)
    .bind(&body.permintaan_privasi).bind(&permintaan_privasi_cetak)
    .bind(&body.kelas_perawatan)
    .bind(&body.biaya_perkiraan_tindakan).bind(&body.biaya_administrasi)
    .bind(&body.biaya_pemeriksaan_penunjang)
    .bind(&body.biaya_farmasi).bind(&body.biaya_lain_lain)
    .bind(&body.saksi_pasien)
    .bind(&body.pelayanan_rohani)
    .bind(&body.pelepasan_informasi)
    .execute(&mut *tx).await.map_err(|e| db_err_msg(e, "INSERT surat_persetujuan_umum_tambahan"))?;

    // 4) Audit cetak — log_cetak_surat_persetujuan_umum
    sqlx::query(
        "INSERT INTO log_cetak_surat_persetujuan_umum
           (no_surat, no_rawat, jenis_surat, kd_user, tanggal, jam)
         VALUES (?,?, 'PERSETUJUAN UMUM', ?, current_date(), current_time())"
    )
    .bind(&no_surat).bind(&body.no_rawat).bind(&user.0.kode)
    .execute(&mut *tx).await.map_err(|e| db_err_msg(e, "INSERT log_cetak_surat_persetujuan_umum"))?;

    tx.commit().await.map_err(db_err)?;

    use crate::audit::{q, qo};
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO surat_persetujuan_umum (no_surat, no_rawat, tanggal, pengobatan_kepada, nilai_kepercayaan, nama_pj, umur_pj, no_ktppj, jkpj, bertindak_atas, no_telp, nip) VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})",
        q(&no_surat), q(&body.no_rawat), q(&tanggal), q(&pengobatan), q(&nilai_keprc),
        q(&body.nama_pj), q(&body.umur_pj), q(&body.no_ktppj), q(jkpj_norm), q(&bertindak),
        q(&body.no_telp), q(&body.nip)
    )).await;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO surat_persetujuan_umum_tambahan (no_surat, nama_keluarga_a, hubungan_pasien_a, nama_keluarga_b, hubungan_pasien_b, nama_keluarga_c, hubungan_pasien_c, hubungan_keluarga_a, detail_hubungan_a, hubungan_keluarga_b, detail_hubungan_b, hubungan_keluarga_c, detail_hubungan_c, pilihan_akses_kunjungan, nama_tidak_diizinkan, preferensi_perawat, preferensi_dokter, kelas_perawatan, biaya_perkiraan_tindakan, biaya_administrasi, biaya_pemeriksaan_penunjang, biaya_farmasi, biaya_lain_lain, saksi_pasien) VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})",
        q(&no_surat),
        qo(body.nama_keluarga_a.as_ref()), qo(body.hubungan_pasien_a.as_ref()),
        qo(body.nama_keluarga_b.as_ref()), qo(body.hubungan_pasien_b.as_ref()),
        qo(body.nama_keluarga_c.as_ref()), qo(body.hubungan_pasien_c.as_ref()),
        qo(body.hubungan_keluarga_a.as_ref()), qo(body.detail_hubungan_a.as_ref()),
        qo(body.hubungan_keluarga_b.as_ref()), qo(body.detail_hubungan_b.as_ref()),
        qo(body.hubungan_keluarga_c.as_ref()), qo(body.detail_hubungan_c.as_ref()),
        qo(pilihan_akses.as_ref()), qo(body.nama_tidak_diizinkan.as_ref()),
        qo(body.preferensi_perawat.as_ref()), qo(body.preferensi_dokter.as_ref()),
        qo(body.kelas_perawatan.as_ref()),
        qo(body.biaya_perkiraan_tindakan.as_ref()), qo(body.biaya_administrasi.as_ref()),
        qo(body.biaya_pemeriksaan_penunjang.as_ref()),
        qo(body.biaya_farmasi.as_ref()), qo(body.biaya_lain_lain.as_ref()),
        qo(body.saksi_pasien.as_ref())
    )).await;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO log_cetak_surat_persetujuan_umum (no_surat, no_rawat, jenis_surat, kd_user, tanggal, jam) VALUES ({}, {}, 'PERSETUJUAN UMUM', {}, current_date(), current_time())",
        q(&no_surat), q(&body.no_rawat), q(&user.0.kode)
    )).await;

    Ok(Json(json!({
        "success":  true,
        "no_surat": no_surat,
        "tanggal":  tanggal,
    })))
}

// Format Java: PSU<YYYYMMDD><3-digit>, per-tanggal sequential
async fn generate_no_surat(
    state: &AppState,
    tanggal_iso: &str,
) -> Result<String, (StatusCode, Json<Value>)> {
    let prefix = {
        let d = tanggal_iso.replace('-', "");
        format!("PSU{}", d) // YYYYMMDD
    };
    let max: Option<(String,)> = sqlx::query_as(
        "SELECT no_surat FROM surat_persetujuan_umum
         WHERE no_surat LIKE CONCAT(?, '%')
         ORDER BY no_surat DESC LIMIT 1"
    ).bind(&prefix).fetch_optional(&state.pool).await.map_err(db_err)?;

    let next = max
        .and_then(|(s,)| s.get(prefix.len()..).and_then(|t| t.parse::<u32>().ok()))
        .map(|n| n + 1)
        .unwrap_or(1);
    Ok(format!("{}{:03}", prefix, next))
}

// ENUM kolom `pengobatan_kepada`:
//   'Suami','Istri','Anak','Ayah','Ibu','Saudara','Keponakan','Adik','Kakak',
//   'Orang Tua','Diri Sendiri','-'
fn normalize_pengobatan_kepada(s: Option<&str>) -> String {
    let allowed = ["Suami","Istri","Anak","Ayah","Ibu","Saudara","Keponakan",
                   "Adik","Kakak","Orang Tua","Diri Sendiri","-"];
    match s.map(str::trim).filter(|v| !v.is_empty()) {
        Some(v) if allowed.contains(&v) => v.to_string(),
        Some(v) if v.eq_ignore_ascii_case("pasien sendiri") => "Diri Sendiri".to_string(),
        _ => "-".to_string(),
    }
}

// ENUM kolom `bertindak_atas`:
//   'Suami','Istri','Anak','Ayah','Ibu','Saudara','Keponakan','Adik','Kakak',
//   'Orang Tua','Diri Sendiri','-','Cucu','Nenek','Kakek','Kerabat','Teman'
fn normalize_bertindak_atas(s: &str) -> String {
    let allowed = ["Suami","Istri","Anak","Ayah","Ibu","Saudara","Keponakan",
                   "Adik","Kakak","Orang Tua","Diri Sendiri","-",
                   "Cucu","Nenek","Kakek","Kerabat","Teman"];
    let v = s.trim();
    if allowed.contains(&v) { v.to_string() }
    else if v.eq_ignore_ascii_case("pasien sendiri") { "Diri Sendiri".to_string() }
    else { "-".to_string() }
}

fn normalize_pilihan_akses(s: Option<&str>) -> Option<String> {
    s.map(|v| v.trim())
        .filter(|v| !v.is_empty())
        .map(|v| match v {
            "Mengizinkan" | "Tidak Mengizinkan" => v.to_string(),
            _ => "Mengizinkan".to_string(),
        })
}

// ── GET /api/persetujuan-umum/:no_rawat/cetak ───────────────────────────────
// Generate HTML printable persetujuan umum, isinya 100% dari DB
pub async fn cetak_html(
    user: AuthUser,
    State(state): State<AppState>,
    Path(no_rawat): Path<String>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "consent_view")?;
    // Header + tambahan + photo + signature
    let pu: Option<PersetujuanUmumPrefill> = sqlx::query_as(
        "SELECT s.no_surat, s.no_rawat,
                DATE_FORMAT(s.tanggal,'%Y-%m-%d') AS tanggal,
                TIME_FORMAT(s.jam,'%H:%i') AS jam,
                s.pengobatan_kepada, s.nilai_kepercayaan,
                s.nama_pj, s.umur_pj, s.no_ktppj, s.jkpj,
                s.bertindak_atas, s.no_telp, s.nip,
                t.nama_keluarga_a, t.hubungan_pasien_a,
                t.nama_keluarga_b, t.hubungan_pasien_b,
                t.nama_keluarga_c, t.hubungan_pasien_c,
                t.hubungan_keluarga_a, t.detail_hubungan_a,
                t.hubungan_keluarga_b, t.detail_hubungan_b,
                t.hubungan_keluarga_c, t.detail_hubungan_c,
                t.pilihan_akses_kunjungan, t.nama_tidak_diizinkan,
                t.preferensi_perawat, t.preferensi_dokter,
                t.nilai_keyakinan, t.nilai_keyakinan_cetak,
                t.permintaan_privasi, t.permintaan_privasi_cetak,
                t.kelas_perawatan, t.biaya_perkiraan_tindakan,
                t.biaya_administrasi, t.biaya_pemeriksaan_penunjang,
                t.biaya_farmasi, t.biaya_lain_lain,
                p.photo, t.signature_path, t.saksi_pasien, t.photo_saksi, t.ttd_saksi, t.pelayanan_rohani, t.pelepasan_informasi
         FROM surat_persetujuan_umum s
         LEFT JOIN surat_persetujuan_umum_tambahan          t ON s.no_surat = t.no_surat
         LEFT JOIN surat_persetujuan_umum_pembuat_pernyataan p ON s.no_surat = p.no_surat
         WHERE s.no_rawat = ?
         ORDER BY s.tanggal DESC, s.no_surat DESC
         LIMIT 1"
    ).bind(&no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;

    let Some(pu) = pu else {
        return Err((StatusCode::NOT_FOUND,
            Json(json!({"error":"Persetujuan belum tersimpan untuk no_rawat ini"}))));
    };

    // Pasien
    let pasien: Option<(String, String, String, String, String, String)> = sqlx::query_as(
        "SELECT p.no_rkm_medis, p.nm_pasien, p.jk,
                DATE_FORMAT(p.tgl_lahir,'%Y-%m-%d') AS tgl_lahir,
                CONCAT(r.umurdaftar,' ',r.sttsumur), IFNULL(p.agama,'')
         FROM reg_periksa r
         INNER JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
         WHERE r.no_rawat = ? LIMIT 1"
    ).bind(&no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    let (no_rm, nm_pasien, jk, tgl_lahir, umur, agama) = pasien.unwrap_or_default();

    // Setting RS
    let setting: Option<(String, String, String, String)> = sqlx::query_as(
        "SELECT IFNULL(nama_instansi,''), IFNULL(alamat_instansi,''),
                IFNULL(kabupaten,''),     IFNULL(kontak,'')
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;
    let (nama_rs, alamat_rs, kabupaten, kontak) = setting.unwrap_or_default();

    // Persetujuan SATUSEHAT — best effort
    let satusehat: Option<(String,)> = sqlx::query_as(
        "SELECT persetujuan FROM simrscb_persetujuan_satusehat WHERE no_rawat = ? LIMIT 1"
    ).bind(&no_rawat).fetch_optional(&state.pool).await.unwrap_or(None);
    let consent_ss = satusehat.map(|t| t.0).unwrap_or_else(|| "Setuju".into());

    // Petugas (nama dari NIP)
    let nama_petugas: String = sqlx::query_as::<_, (String,)>(
        "SELECT nama FROM petugas WHERE nip = ? LIMIT 1"
    ).bind(pu.nip.as_deref().unwrap_or(""))
     .fetch_optional(&state.pool).await.ok().flatten()
     .map(|t| t.0).unwrap_or_default();

    // URL base foto/TTD dari hosthybridweb config
    let hw_val = sqlx::query_as::<_, (String,)>(
        "SELECT nilai FROM simrscb_config WHERE kunci = 'hosthybridweb' LIMIT 1"
    ).fetch_optional(&state.pool).await.ok().flatten().map(|t| t.0).unwrap_or_default();
    // Untuk display di HTML: bila berbentuk URL (mode remote dengan companion .php),
    // ambil base directory + "/persetujuanumum"
    let base_media = if hw_val.starts_with("http") {
        // strip filename (.../simrscb-upload.php) → dapatkan folder webapps
        hw_val.rsplit_once('/').map(|(d,_)| d.to_string()).unwrap_or(hw_val.clone())
    } else {
        format!("/{}", hw_val.trim_start_matches('/').trim_end_matches('/'))
    };

    // Resolve src foto/TTD: bila media di host http (webapps), ambil server-side lalu
    // embed sebagai data URL agar tidak terblokir mixed-content saat halaman cetak https.
    let photo_src       = resolve_media_src(&base_media, pu.photo.as_deref()).await;
    let ttd_src         = resolve_media_src(&base_media, pu.signature_path.as_deref()).await;
    let saksi_photo_src = resolve_media_src(&base_media, pu.photo_saksi.as_deref()).await;
    let saksi_ttd_src   = resolve_media_src(&base_media, pu.ttd_saksi.as_deref()).await;

    let html = render_html(
        &pu, &consent_ss, &nama_petugas,
        &no_rm, &nm_pasien, &jk, &tgl_lahir, &umur, &agama,
        &nama_rs, &alamat_rs, &kabupaten, &kontak,
        &base_media,
        &photo_src, &ttd_src, &saksi_photo_src, &saksi_ttd_src,
    );

    Ok(Html(html))
}

#[allow(clippy::too_many_arguments)]
fn render_html(
    pu:          &PersetujuanUmumPrefill,
    consent_ss:  &str,
    nama_petugas: &str,
    no_rm:       &str, nm_pasien: &str, jk: &str, tgl_lahir: &str, umur: &str, agama: &str,
    nama_rs:     &str, alamat_rs: &str, kabupaten: &str, kontak: &str,
    base_media:  &str,
    photo_src:   &str, ttd_src: &str, saksi_photo_src: &str, saksi_ttd_src: &str,
) -> String {
    let _ = base_media; // src foto/TTD kini sudah di-resolve (embed base64) oleh caller
    let esc = html_escape;
    let opt = |o: &Option<String>| esc(o.as_deref().unwrap_or(""));
    let or_dash = |o: &Option<String>| {
        let v = o.as_deref().unwrap_or("");
        if v.is_empty() { "—".to_string() } else { esc(v) }
    };
    let kabupaten_kop = kabupaten.to_uppercase().replace("KAB.", "KABUPATEN").replace("KAB ", "KABUPATEN ");
    let kabupaten_kop = if kabupaten_kop.is_empty() { String::new() } else { format!("PEMERINTAH {}", kabupaten_kop) };
    let nama_rs_kop = if nama_rs.is_empty() { "RSUD CABANG BUNGIN".to_string() } else { nama_rs.to_uppercase() };
    let alamat_kop = {
        let mut parts: Vec<String> = vec![];
        if !alamat_rs.is_empty() { parts.push(esc(alamat_rs)); }
        if !kontak.is_empty()    { parts.push(format!("Telp. {}", esc(kontak))); }
        parts.join(" — ")
    };
    let photo_html = if photo_src.is_empty() { String::new() } else {
        format!(r#"<img src="{src}" alt="Foto PJ" style="width:120px;height:120px;object-fit:cover;border:1px solid #cbd5e1;border-radius:4px;"/>"#, src=photo_src) };
    let ttd_html = if ttd_src.is_empty() { String::new() } else {
        format!(r#"<img src="{src}" alt="TTD" style="width:160px;height:60px;object-fit:contain;"/>"#, src=ttd_src) };
    let saksi_photo_html = if saksi_photo_src.is_empty() { String::new() } else {
        format!(r#"<img src="{src}" alt="Foto Saksi" style="width:120px;height:120px;object-fit:cover;border:1px solid #cbd5e1;border-radius:4px;"/>"#, src=saksi_photo_src) };
    let saksi_ttd_html = if saksi_ttd_src.is_empty() { String::new() } else {
        format!(r#"<img src="{src}" alt="TTD Saksi" style="width:160px;height:60px;object-fit:contain;"/>"#, src=saksi_ttd_src) };
    let qr_payload = format!("NIP:{}|Nama:{}|Tgl:{}",
        opt(&pu.nip), esc(nama_petugas), opt(&pu.tanggal));
    let qr_url = crate::handlers::qr::qr_data_uri(&qr_payload);
    let consent_text = if consent_ss == "Tidak Setuju" { "TIDAK MEMBERIKAN" } else { "MEMBERIKAN" };

    // "mengizinkan / tidak mengizinkan" dengan coretan sesuai pilihan
    let akses_pilihan = pu.pilihan_akses_kunjungan.as_deref().unwrap_or("Mengizinkan");
    let akses_choice = if akses_pilihan == "Tidak Mengizinkan" {
        "<span style=\"text-decoration:line-through;color:#94a3b8\">mengizinkan</span> / <span>tidak mengizinkan</span>".to_string()
    } else {
        "<span>mengizinkan</span> / <span style=\"text-decoration:line-through;color:#94a3b8\">tidak mengizinkan</span>".to_string()
    };

    // Seksi checklist (SEMUA item, kolom Ya/Tidak) sesuai form cetak PDF resmi.
    let nilai_section = {
        let c = render_checklist_yt(&pu.nilai_keyakinan);
        format!("<div style=\"margin-top:6px\"><b>HAK PASIEN TERKAIT NILAI DAN KEYAKINAN</b>{}</div>",
            if c.is_empty() { "<div style=\"color:#94a3b8\">(tidak ada catatan khusus)</div>".to_string() } else { c })
    };
    let privasi_section = {
        let c = render_checklist_yt(&pu.permintaan_privasi);
        format!("<div style=\"margin-top:6px\"><b>PERMINTAAN PRIVASI</b>{}</div>",
            if c.is_empty() { "<div style=\"color:#94a3b8\">(tidak ada permintaan khusus)</div>".to_string() } else { c })
    };

    format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>Persetujuan Umum — {no_surat}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:24px;font-size:11px;line-height:1.45}}
  .kop{{display:flex;align-items:center;gap:16px;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:14px}}
  .kop img{{width:64px;height:64px;object-fit:contain}}
  .kop .ctr{{flex:1;text-align:center}}
  .kop .kab{{font-size:11px;font-weight:700;letter-spacing:.4px}}
  .kop .rs{{font-size:18px;font-weight:800;margin-top:2px}}
  .kop .al{{font-size:10px;color:#475569}}
  .kop .ju{{font-size:13px;font-weight:700;margin-top:6px;letter-spacing:2px}}
  table.id{{width:100%;border-collapse:collapse;margin-bottom:10px}}
  table.id td{{padding:2px 4px;vertical-align:top}}
  table.id td:first-child{{width:140px;color:#475569}}
  h3{{font-size:11px;background:#f1f5f9;border-left:4px solid #1e40af;padding:5px 8px;margin:10px 0 6px}}
  .box{{border:1px solid #cbd5e1;padding:8px;border-radius:4px;margin-bottom:6px}}
  ul{{margin:4px 0 4px 18px}}
  .ttd{{display:flex;justify-content:space-around;align-items:flex-end;margin-top:20px;text-align:center}}
  .ttd .col{{min-width:160px}}
  .ttd .foto-ttd{{display:flex;gap:10px;align-items:center;justify-content:center;min-height:120px}}
  .ttd .foto-ttd img{{vertical-align:middle}}
  .ttd .nm{{border-top:1px solid #94a3b8;padding-top:3px;margin-top:6px;font-size:11px}}
  .meta{{font-size:10px;color:#64748b;text-align:right;margin-bottom:6px}}
  table.idb{{width:100%;border-collapse:collapse;margin-bottom:4px}}
  table.idb td{{border:1px solid #000;padding:3px 6px;vertical-align:top}}
  table.idb td:first-child{{width:170px}}
  table.tarif{{border-collapse:collapse;margin:6px 0}}
  table.tarif td,table.tarif th{{border:1px solid #000;padding:3px 10px;font-size:10px}}
  table.tarif th{{background:#e8e8e8;text-align:left}}
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
  <div style="border:1px solid #000;padding:4px 6px;font-size:9px;font-weight:700;white-space:nowrap">{kode_form}</div>
</div>

<table style="width:100%;border-collapse:collapse;margin-bottom:8px">
  <tr>
    <td style="border:1px solid #000;padding:8px;font-size:14px;font-weight:800;width:52%">FORMULIR PERSETUJUAN UMUM<br/><i>(GENERAL CONSENT)</i></td>
    <td style="border:1px solid #000;padding:6px;font-size:10px;line-height:1.6">
      No. RM &nbsp;: {no_rm}<br/>Nama &nbsp;&nbsp;&nbsp;: {nm_pasien}<br/>Tanggal Lahir : {tgl_lahir}<br/>Ruangan &nbsp;: {ruangan}
    </td>
  </tr>
</table>

<div style="margin:6px 0 3px">Yang bertanda tangan dibawah ini :</div>
<table class="idb">
  <tr><td>Nama</td><td>: {nama_pj}</td></tr>
  <tr><td>Umur</td><td>: {umur_pj}</td></tr>
  <tr><td>Alamat</td><td>: {alamat_pj}</td></tr>
  <tr><td></td><td>Telepon : {no_telp}</td></tr>
</table>
<div style="margin:4px 0">Diri Saya/ Istri/ Suami/ Ayah/ Ibu/ Anak/ Kakak/ Adik/ Teman/ Kerabat ( <b>{bertindak}</b> ) dari pasien :</div>
<table class="idb">
  <tr><td>Nama</td><td>: {nm_pasien}</td></tr>
  <tr><td>Tempat/Tanggal Lahir</td><td>: {tgl_lahir}</td></tr>
  <tr><td>No. RM</td><td>: {no_rm}</td></tr>
  <tr><td>Jenis kelamin</td><td>: {jk_l} Laki-Laki &nbsp;&nbsp;&nbsp; {jk_p} Perempuan</td></tr>
</table>
<div style="text-align:right;font-size:9px;color:#64748b;margin-bottom:4px">No. Surat: {no_surat} &nbsp;|&nbsp; Tanggal: {tanggal}</div>
<div style="margin:4px 0 6px;font-weight:700">Dengan ini menyatakan persetujuan terhadap:</div>

<h3>1. PERSETUJUAN UNTUK PERAWATAN DAN PENGOBATAN</h3>
<div class="box">
  <p>Saya menyetujui untuk perawatan di <b>{rs}</b> sebagai pasien Rawat Jalan atau Rawat Inap tergantung kepada kebutuhan medis. Pengobatan dapat meliputi pemeriksaan x-ray/radiologi, tes darah, perawatan rutin dan prosedur seperti cairan infus atau suntikan dan evaluasi (contohnya wawancara dan pemeriksaan fisik). Persetujuan ini juga termasuk pemeriksaan Skrining Hipotiroid Kongenital (SHK) pada setiap bayi baru lahir. Persetujuan yang saya berikan tidak termasuk persetujuan untuk prosedur/tindakan invasif (misalnya operasi) atau tindakan yang mempunyai risiko tinggi. Jika saya memutuskan untuk menghentikan perawatan medis untuk diri saya sendiri, saya memahami dan menyadari bahwa {rs} atau dokter tidak bertanggungjawab atas hasil yang merugikan saya.</p>
  <p style="margin-top:6px">Saya memberikan wewenang kepada rumah sakit untuk memberikan kewenangan untuk terlibat dalam pengambilan keputusan mengenai perawatan saya, data dan informasi mengenai diri saya, dan keadaan kesehatan saya termasuk dalam situasi tertentu, misalnya keadaan kritis dll, kepada keluarga saya, yaitu:</p>
  <table class="id" style="margin-top:4px">
    <tr><th align="left" style="width:24px"></th><th align="left">Nama</th><th align="left">Hubungan dengan Pasien</th></tr>
    <tr><td>a.</td><td>{nama_kel_a}</td><td>{hub_pas_a}</td></tr>
    <tr><td>b.</td><td>{nama_kel_b}</td><td>{hub_pas_b}</td></tr>
    <tr><td>c.</td><td>{nama_kel_c}</td><td>{hub_pas_c}</td></tr>
  </table>
</div>

<h3>2. PERSETUJUAN PELEPASAN INFORMASI</h3>
<div class="box">
  <p>Saya memahami informasi yang ada di dalam diri saya, termasuk diagnosis, hasil laboratorium dan hasil tes diagnostik yang akan digunakan untuk perawatan medis, {rs} akan menjamin kerahasiaannya. Saya memberi wewenang kepada rumah sakit untuk memberikan informasi tentang rahasia kedokteran saya bila diperlukan untuk memproses klaim asuransi termasuk namun tidak terbatas pada BPJS, asuransi kesehatan lainnya, jamkesda, pihak pembayar, perusahaan dan atau lembaga pemerintah lainnya. Saya <b>{lepas_choice}</b> wewenang kepada rumah sakit untuk memberikan tentang data dan informasi kesehatan saya kepada keluarga terdekat saya, yaitu:</p>
  <table class="id" style="margin-top:4px">
    <tr><th align="left" style="width:24px"></th><th align="left">Nama</th><th align="left">Hubungan dengan Pasien</th></tr>
    <tr><td>a.</td><td>{hub_kel_a}</td><td>{det_a}</td></tr>
    <tr><td>b.</td><td>{hub_kel_b}</td><td>{det_b}</td></tr>
    <tr><td>c.</td><td>{hub_kel_c}</td><td>{det_c}</td></tr>
  </table>
</div>

<h3>3. HAK DAN TANGGUNG JAWAB PASIEN</h3>
<div class="box">
  Saya memiliki hak untuk mengambil bagian dalam keputusan mengenai penyakit saya dan dalam hal perawatan medis dan rencana pengobatan. Saya telah mendapat informasi tentang &ldquo;Hak dan tanggung jawab pasien&rdquo; di {rs} melalui banner dan formulir yang disediakan oleh petugas. Saya memahami bahwa {rs} tidak bertanggung jawab atas kehilangan barang pribadi dan barang berharga yang dibawa ke Rumah Sakit.
  <p style="margin-top:6px">Saya berhak menyampaikan preferensi jenis kelamin dokter (DPJP), perawat dan bidan yang merawat saya, dan Rumah Sakit akan berupaya memenuhinya sepanjang memungkinkan sesuai ketersediaan tenaga dan kondisi pelayanan.</p>
  <table class="id" style="margin-top:4px">
    <tr><td>Preferensi jenis kelamin <b>dokter</b> yang merawat</td><td>: {pref_dokter}</td></tr>
    <tr><td>Preferensi jenis kelamin <b>perawat &amp; bidan</b> yang merawat</td><td>: {pref_perawat}</td></tr>
    <tr><td>Nilai kepercayaan yang perlu dihormati</td><td>: {nilai_keprc}</td></tr>
  </table>
  {nilai_section}
</div>

<h3>4. INFORMASI RAWAT INAP</h3>
<div class="box">
  <p>Saya telah memahami bahwa rumah sakit tidak bertanggung jawab atas semua kehilangan barang-barang milik saya dan saya secara pribadi bertanggung jawab atas barang-barang berharga yang saya miliki termasuk namun tidak terbatas pada uang, perhiasan, buku cek, kartu kredit, handphone atau barang lainnya. <b>Dan apabila saya membutuhkan maka saya dapat menitipkan barang-barang tersebut kepada rumah sakit.</b> Saya juga mengerti bahwa saya harus memberitahu/menitipkan pada rumah sakit jika saya memiliki gigi palsu, kacamata, lensa kontak, prostetik atau barang lainnya yang saya butuhkan untuk diamankan.</p>
  <p style="margin-top:6px">Saya telah menerima informasi tentang peraturan yang diberlakukan oleh rumah sakit dan saya beserta keluarga bersedia untuk mematuhinya, termasuk akan mematuhi jam berkunjung pasien sesuai dengan aturan di rumah sakit. Anggota keluarga saya akan menunggu saya dan bersedia untuk selalu memakai tanda pengenal khusus yang diberikan oleh rumah sakit, dan demi keamanan seluruh pasien setiap keluarga dan siapapun yang akan mengunjungi saya di luar jam berkunjung, bersedia untuk diminta/diperiksa identitasnya dan memakai identitias yang diberikan oleh rumah sakit.</p>
</div>

<h3>5. PRIVASI</h3>
<div class="box">
  Saya <b>{akses_choice}</b><span style="color:#94a3b8">*</span> Rumah Sakit memberi akses bagi keluarga dan orang &ndash; orang yang akan menjenguk saya <i>(sebutkan nama bila ada permintaan khusus yang tidak diizinkan)</i> : {nama_tidak}
  <div style="color:#94a3b8;font-size:10px;margin-top:4px">*coret salah satu</div>
  {privasi_section}
</div>

<h3>6. INFORMASI BIAYA</h3>
<div class="box">
  <p>Saya memahami tentang informasi biaya kamar inap per malam (rincian tarif pada tabel dibawah), belum termasuk biaya pengobatan, biaya tindakan, dan jasa dokter, sedangkan bagi pengguna BPJS &ldquo;Gratis&rdquo;, yang dijelaskan oleh petugas rumah sakit. Bila pasien sudah dinyatakan boleh pulang oleh DPJP maka pasien/keluarga pasien menyelesaikan transaksi pembayaran keuangan melaui kasir, sedangkan untuk pasien BPJS harus sudah menyelesaikan administrasi sesuai peraturan BPJS.</p>
  <table class="tarif">
    <tr><th>Kelas Perawatan</th><th>Tarif Kamar/Malam</th></tr>
    <tr><td>Kelas I</td><td>Rp.300.000</td></tr>
    <tr><td>Kelas II</td><td>Rp.280.000</td></tr>
    <tr><td>Kelas III</td><td>Rp.150.000</td></tr>
    <tr><td>HCU</td><td>Rp.450.000</td></tr>
    <tr><td>ICU</td><td>Rp.1.050.000</td></tr>
  </table>
  <p style="margin-top:6px">Saya memahami tentang informasi biaya yang telah dijelaskan oleh petugas rumah sakit sesuai dengan perencanaan:</p>
  <table class="id" style="margin-top:4px">
    <tr><td>a. Kelas perawatan</td><td>: {kelas}</td></tr>
    <tr><td>b. Biaya perkiraan tindakan</td><td>: {b_tindakan}</td></tr>
    <tr><td>c. Biaya administrasi</td><td>: {b_adm}</td></tr>
    <tr><td>d. Biaya pemeriksaan penunjang sesuai dengan kebutuhan</td><td>: {b_penunjang}</td></tr>
    <tr><td>e. Biaya farmasi</td><td>: {b_farmasi}</td></tr>
    <tr><td>f. Biaya lain &ndash; lain</td><td>: {b_lain}</td></tr>
  </table>
  <p style="margin-top:6px">Bila pasien sudah dinyatakan boleh pulang oleh DPJP maka pasien/keluarga pasien menyelesaikan transaksi pembayaran keuangan melaui kasir, Setelah transaksi keuangan selesai diberi toleransi waktu 2 jam untuk persiapan pulang. Bila melewati waktu yang sudah ditentukan, maka akan dikenakan tambahan biaya kamar.</p>
</div>

<h3>7. PELAYANAN ROHANI</h3>
<div class="box">
  <p>Saya memahami bahwa Rumah Sakit menyediakan pelayanan Rohani sesuai agama dan kepercayaan pasien apabila diperlukan.</p>
  <div style="margin-top:4px;font-size:12px">{rohani_ya}<span style="font-size:11px"> Saya bersedia mendapatkan pelayanan rohani</span></div>
  <div style="font-size:12px">{rohani_tidak}<span style="font-size:11px"> Saya tidak bersedia mendapatkan pelayanan rohani</span></div>
  <div style="margin-top:6px">Agama/Kepercayaan Pasien : <b>{agama}</b></div>
</div>

<h3>SAYA TELAH MEMBACA</h3>
<div class="box">
  Dan sepenuhnya setuju dengan setiap pertanyaan pada formulir ini dan menandatangani tanpa paksaan dan dengan
  kesadaran penuh. Demikian ini saya buat dengan sesungguhnya tanpa paksaan dari pihak manapun, karena saya paham
  dan mengerti bahwa hal ini diperlukan dalam proses perawatan saya/keluarga saya di {rs}, serta melalui pernyataan
  ini saya menjamin bahwa pasien telah membaca dan <b>{consent_text}</b> menyetujui pembukaan data dari SATU SEHAT.
</div>

<div style="text-align:right;margin-top:10px">Bekasi, {tanggal} &nbsp;&nbsp; pukul : ................</div>
<div class="ttd">
  <div class="col">
    <div class="foto-ttd"><img src="{qr_url}" alt="QR Petugas"/></div>
    <div class="nm">Mengetahui,<br/>Admisi<br/><b>{nama_petugas}</b><br/><span style="font-size:9px;color:#64748b">NIP. {nip}</span></div>
  </div>
  <div class="col">
    <div class="foto-ttd">
      {photo_saksi}
      {ttd_saksi}
    </div>
    <div class="nm">Saksi Pasien<br/><b>{saksi_nama}</b></div>
  </div>
  <div class="col">
    <div class="foto-ttd">
      {photo}
      {ttd}
    </div>
    <div class="nm">Yang Menyatakan,<br/><b>{nama_pj}</b><br/><span style="font-size:9px;color:#64748b">Pasien/Keluarga (*Wali jika pasien &lt; 18 tahun)</span></div>
  </div>
</div>
<div style="font-size:9px;color:#64748b;margin-top:6px">Keterangan: *Coret pada tulisan yang tidak dipilih.</div>

</body></html>
"#,
        logo_daerah = logo_daerah_data_url(),
        logo_rs     = logo_rs_data_url(),
        no_surat   = opt(&pu.no_surat),
        kab        = esc(&kabupaten_kop),
        rs         = esc(&nama_rs_kop),
        al         = alamat_kop,
        tanggal    = opt(&pu.tanggal),
        no_rm      = esc(no_rm),
        nm_pasien  = esc(nm_pasien),
        tgl_lahir  = esc(tgl_lahir),
        nama_pj    = opt(&pu.nama_pj),
        umur_pj    = opt(&pu.umur_pj),
        no_telp    = opt(&pu.no_telp),
        bertindak  = opt(&pu.bertindak_atas),
        kode_form  = "RM.KEP.08.004.A.2019",
        ruangan    = "-",
        alamat_pj  = "-",
        jk_l       = if jk.to_uppercase().starts_with('L') {"&#9745;"} else {"&#9744;"},
        jk_p       = if jk.to_uppercase().starts_with('P') {"&#9745;"} else {"&#9744;"},
        agama      = esc(agama),
        rohani_ya  = if pu.pelayanan_rohani.as_deref() == Some("Bersedia") {"&#9745;"} else {"&#9744;"},
        rohani_tidak = if pu.pelayanan_rohani.as_deref() == Some("Tidak Bersedia") {"&#9745;"} else {"&#9744;"},
        nama_kel_a = or_dash(&pu.nama_keluarga_a),
        hub_pas_a  = or_dash(&pu.hubungan_pasien_a),
        nama_kel_b = or_dash(&pu.nama_keluarga_b),
        hub_pas_b  = or_dash(&pu.hubungan_pasien_b),
        nama_kel_c = or_dash(&pu.nama_keluarga_c),
        hub_pas_c  = or_dash(&pu.hubungan_pasien_c),
        lepas_choice = if pu.pelepasan_informasi.as_deref() == Some("Tidak Memberikan") {"tidak memberikan"} else {"memberikan"},
        hub_kel_a  = or_dash(&pu.hubungan_keluarga_a),
        det_a      = or_dash(&pu.detail_hubungan_a),
        hub_kel_b  = or_dash(&pu.hubungan_keluarga_b),
        det_b      = or_dash(&pu.detail_hubungan_b),
        hub_kel_c  = or_dash(&pu.hubungan_keluarga_c),
        det_c      = or_dash(&pu.detail_hubungan_c),
        akses_choice = akses_choice,
        nama_tidak = or_dash(&pu.nama_tidak_diizinkan),
        pref_perawat = or_dash(&pu.preferensi_perawat),
        pref_dokter  = or_dash(&pu.preferensi_dokter),
        nilai_section = nilai_section,
        privasi_section = privasi_section,
        nilai_keprc  = or_dash(&pu.nilai_kepercayaan),
        kelas      = or_dash(&pu.kelas_perawatan),
        b_tindakan = or_dash(&pu.biaya_perkiraan_tindakan),
        b_adm      = or_dash(&pu.biaya_administrasi),
        b_penunjang= or_dash(&pu.biaya_pemeriksaan_penunjang),
        b_farmasi  = or_dash(&pu.biaya_farmasi),
        b_lain     = or_dash(&pu.biaya_lain_lain),
        consent_text = consent_text,
        photo      = photo_html,
        ttd        = ttd_html,
        photo_saksi = saksi_photo_html,
        ttd_saksi   = saksi_ttd_html,
        saksi_nama  = or_dash(&pu.saksi_pasien),
        qr_url     = esc(&qr_url),
        nama_petugas = esc(nama_petugas),
        nip        = opt(&pu.nip),
    )
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
     .replace('"', "&quot;").replace('\'', "&#39;")
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

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error persetujuan_umum: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"Database error"})))
}

fn db_err_msg(e: sqlx::Error, ctx: &str) -> (StatusCode, Json<Value>) {
    // Detail lengkap (termasuk nama kolom/constraint) hanya ke log server —
    // JANGAN dibocorkan ke klien online (kebocoran skema). Ke UI: pesan
    // terkategori yang membantu tanpa mengungkap struktur DB.
    tracing::error!("DB error {}: {}", ctx, e);
    let msg = match &e {
        sqlx::Error::Database(dbe) => {
            let m = dbe.message().to_lowercase();
            if m.contains("too long") { "Ada isian yang melebihi batas panjang. Persingkat lalu simpan ulang." }
            else if m.contains("duplicate") { "Data sudah ada (duplikat)." }
            else if m.contains("foreign key") { "Data terkait tidak valid/ditemukan." }
            else if m.contains("cannot be null") || m.contains("doesn't have a default") { "Ada isian wajib yang belum diisi." }
            else if m.contains("incorrect") && m.contains("value") { "Ada isian dengan format tidak valid." }
            else { "Gagal menyimpan data. Cek kembali isian." }
        }
        _ => "Gagal menyimpan data. Cek kembali isian.",
    };
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": msg})))
}
