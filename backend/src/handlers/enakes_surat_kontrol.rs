// Surat Kontrol BPJS (Rencana Kontrol VClaim) — port dari desktop
// `src/bridging/BPJSSuratKontrol.java` (menu popup DlgReg) ke e-Nakes.
//
// Alur: pasien punya SEP (bridging_sep) → pilih tgl rencana kontrol →
// referensi poli (ListSpesialistik) → referensi dokter (JadwalPraktekDokter)
// → insert RencanaKontrol → simpan ke bridging_surat_kontrol_bpjs.
// VClaim reuse BpjsClient (tanda tangan + AES/LZString decrypt) di bridging_bpjs.rs.

use crate::{handlers::bridging_bpjs::{BpjsClient, BpjsConfig}, auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};

const JNS_KONTROL: &str = "2"; // 1=SPRI, 2=Surat Kontrol

fn err400(msg: &str) -> (StatusCode, Json<Value>) { (StatusCode::BAD_REQUEST, Json(json!({"error": msg}))) }
fn err503(msg: &str) -> (StatusCode, Json<Value>) { (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"error": msg}))) }
fn err_db(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::warn!("surat_kontrol db: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Kesalahan database"})))
}
fn err_upstream(e: String) -> (StatusCode, Json<Value>) {
    tracing::warn!("surat_kontrol BPJS: {}", e);
    (StatusCode::BAD_GATEWAY, Json(json!({"error": e})))
}
fn client_from_env() -> Result<BpjsClient, (StatusCode, Json<Value>)> {
    BpjsConfig::from_env().map(BpjsClient::new)
        .ok_or_else(|| err503("Konfigurasi BPJS belum diset (BPJS_CONS_ID/SECRET/USER_KEY/URL kosong)"))
}

// Ambil "list" dari response VClaim yang bentuknya {"list":[...]} atau langsung array.
fn ambil_list(v: &Value) -> Vec<Value> {
    v.get("list").and_then(|l| l.as_array()).cloned()
        .or_else(|| v.as_array().cloned())
        .unwrap_or_default()
}

// ── 1. Info: SEP pasien + daftar surat kontrol yang sudah ada ───────────────
#[derive(Deserialize)]
pub struct NoRawatQ { pub no_rawat: String }

pub async fn sk_info(
    _user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatQ>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // SEP rawat jalan terakhir untuk no_rawat ini.
    let sep = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>, Option<String>)>(
        "SELECT no_sep, CAST(tglsep AS CHAR) tglsep, IFNULL(kdpolitujuan,'') kdpoli, \
                IFNULL(nmpolitujuan,'') nmpoli, IFNULL(nmdiagnosaawal,'') dx \
         FROM bridging_sep WHERE no_rawat=? ORDER BY tglsep DESC, no_sep DESC LIMIT 1")
        .bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(err_db)?;

    let (no_sep, tgl_sep, kd_poli, nm_poli, dx) = match sep {
        Some(s) => (s.0, s.1.unwrap_or_default(), s.2.unwrap_or_default(), s.3.unwrap_or_default(), s.4.unwrap_or_default()),
        None => return Ok(Json(json!({"no_sep": null, "list": []}))),
    };

    let rows = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)>(
        "SELECT no_surat, CAST(tgl_surat AS CHAR) tgl_surat, CAST(tgl_rencana AS CHAR) tgl_rencana, \
                IFNULL(kd_dokter_bpjs,'') kd_dok, IFNULL(nm_dokter_bpjs,'') nm_dok, \
                IFNULL(kd_poli_bpjs,'') kd_poli, IFNULL(nm_poli_bpjs,'') nm_poli \
         FROM bridging_surat_kontrol_bpjs WHERE no_sep=? ORDER BY tgl_surat DESC, no_surat DESC")
        .bind(&no_sep).fetch_all(&state.pool).await.map_err(err_db)?;

    let list: Vec<Value> = rows.into_iter().map(|r| json!({
        "no_surat": r.0, "tgl_surat": r.1, "tgl_rencana": r.2,
        "kd_dokter": r.3, "nm_dokter": r.4, "kd_poli": r.5, "nm_poli": r.6,
    })).collect();

    Ok(Json(json!({
        "no_sep": no_sep, "tgl_sep": tgl_sep,
        "kd_poli_sep": kd_poli, "nm_poli_sep": nm_poli, "diagnosa": dx,
        "list": list,
    })))
}

// ── 2. Referensi poli spesialistik (ListSpesialistik) ───────────────────────
#[derive(Deserialize)]
pub struct PoliQ { pub no_sep: String, pub tgl: String }

pub async fn sk_poli(
    _user: AuthUser, State(_state): State<AppState>, Query(q): Query<PoliQ>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if q.no_sep.trim().is_empty() || q.tgl.trim().is_empty() { return Err(err400("no_sep & tgl wajib")); }
    let client = client_from_env()?;
    let path = format!("RencanaKontrol/ListSpesialistik/JnsKontrol/{}/nomor/{}/TglRencanaKontrol/{}",
        JNS_KONTROL, q.no_sep.trim(), q.tgl.trim());
    let resp = client.get(&path).await.map_err(err_upstream)?;
    let poli: Vec<Value> = ambil_list(&resp).into_iter().map(|p| json!({
        "kode": p.get("kodePoli").and_then(|x| x.as_str()).unwrap_or(""),
        "nama": p.get("namaPoli").and_then(|x| x.as_str()).unwrap_or(""),
    })).collect();
    Ok(Json(json!({"poli": poli})))
}

// ── 3. Referensi jadwal praktek dokter (JadwalPraktekDokter) ────────────────
#[derive(Deserialize)]
pub struct DokterQ { pub kd_poli: String, pub tgl: String }

pub async fn sk_dokter(
    _user: AuthUser, State(_state): State<AppState>, Query(q): Query<DokterQ>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if q.kd_poli.trim().is_empty() || q.tgl.trim().is_empty() { return Err(err400("kd_poli & tgl wajib")); }
    let client = client_from_env()?;
    let path = format!("RencanaKontrol/JadwalPraktekDokter/JnsKontrol/{}/KdPoli/{}/TglRencanaKontrol/{}",
        JNS_KONTROL, q.kd_poli.trim(), q.tgl.trim());
    let resp = client.get(&path).await.map_err(err_upstream)?;
    let dokter: Vec<Value> = ambil_list(&resp).into_iter().map(|d| json!({
        "kode": d.get("kodeDokter").and_then(|x| x.as_str()).map(|s| s.to_string())
                 .or_else(|| d.get("kodeDokter").and_then(|x| x.as_i64()).map(|n| n.to_string())).unwrap_or_default(),
        "nama": d.get("namaDokter").and_then(|x| x.as_str()).unwrap_or(""),
        "jadwal": d.get("jadwalPraktek").and_then(|x| x.as_str()).unwrap_or(""),
        "hari": d.get("namaHari").and_then(|x| x.as_str()).unwrap_or(""),
        "kapasitas": d.get("kapasitas").and_then(|x| x.as_i64()).unwrap_or(0),
        "terpakai": d.get("jumlahPasien").and_then(|x| x.as_i64()).unwrap_or(0),
    })).collect();
    Ok(Json(json!({"dokter": dokter})))
}

// ── 4. Buat surat kontrol (RencanaKontrol/insert) + simpan lokal ────────────
#[derive(Deserialize)]
pub struct CreateBody {
    pub no_sep: String,
    pub tgl_rencana: String,   // YYYY-MM-DD (harus > hari ini)
    pub kd_dokter: String,
    pub nm_dokter: String,
    pub kd_poli: String,
    pub nm_poli: String,
}

pub async fn sk_create(
    user: AuthUser, State(state): State<AppState>, Json(b): Json<CreateBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_sep.trim().is_empty() { return Err(err400("SEP pasien kosong")); }
    if b.kd_dokter.trim().is_empty() { return Err(err400("Dokter belum dipilih")); }
    if b.kd_poli.trim().is_empty() { return Err(err400("Poli belum dipilih")); }
    // Tanggal kontrol harus SETELAH hari ini (aturan sama dgn desktop).
    let hari_ini = chrono::Local::now().format("%Y-%m-%d").to_string();
    if b.tgl_rencana.trim() <= hari_ini.as_str() {
        return Err(err400("Tanggal rencana kontrol harus setelah hari ini"));
    }

    let client = client_from_env()?;
    let usr = user.0.kode.replace(' ', "");
    let usr = if usr.len() > 12 { usr[..12].to_string() } else { usr };
    let body = json!({"request": {
        "noSEP": b.no_sep.trim(),
        "kodeDokter": b.kd_dokter.trim(),
        "poliKontrol": b.kd_poli.trim(),
        "tglRencanaKontrol": b.tgl_rencana.trim(),
        "user": usr,
    }});
    let resp = client.post("RencanaKontrol/insert", body).await.map_err(err_upstream)?;
    let no_surat = resp.get("noSuratKontrol").and_then(|x| x.as_str()).unwrap_or("").to_string();
    if no_surat.is_empty() {
        return Err(err_upstream(format!("Respons BPJS tanpa noSuratKontrol: {}", resp)));
    }

    // Simpan lokal (idempoten: no_surat = PK).
    sqlx::query(
        "INSERT INTO bridging_surat_kontrol_bpjs \
         (no_sep, tgl_surat, no_surat, tgl_rencana, kd_dokter_bpjs, nm_dokter_bpjs, kd_poli_bpjs, nm_poli_bpjs) \
         VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?) \
         ON DUPLICATE KEY UPDATE tgl_rencana=VALUES(tgl_rencana), kd_dokter_bpjs=VALUES(kd_dokter_bpjs), \
         nm_dokter_bpjs=VALUES(nm_dokter_bpjs), kd_poli_bpjs=VALUES(kd_poli_bpjs), nm_poli_bpjs=VALUES(nm_poli_bpjs)")
        .bind(&b.no_sep).bind(&no_surat).bind(&b.tgl_rencana)
        .bind(&b.kd_dokter).bind(&b.nm_dokter).bind(&b.kd_poli).bind(&b.nm_poli)
        .execute(&state.pool).await.map_err(err_db)?;

    crate::audit::log_sql(&state.pool, &user.0.kode,
        &format!("surat_kontrol_bpjs insert no_surat={} no_sep={}", no_surat, b.no_sep)).await;

    Ok(Json(json!({"ok": true, "no_surat": no_surat})))
}

// ── 5. Hapus (RencanaKontrol/Delete) + hapus lokal ──────────────────────────
#[derive(Deserialize)]
pub struct DeleteBody { pub no_surat: String }

pub async fn sk_delete(
    user: AuthUser, State(state): State<AppState>, Json(b): Json<DeleteBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_surat.trim().is_empty() { return Err(err400("no_surat kosong")); }
    let client = client_from_env()?;
    let usr = user.0.kode.replace(' ', "");
    let body = json!({"request": {"noSuratKontrol": b.no_surat.trim(), "user": usr}});
    client.post("RencanaKontrol/Delete", body).await.map_err(err_upstream)?;

    sqlx::query("DELETE FROM bridging_surat_kontrol_bpjs WHERE no_surat=?")
        .bind(&b.no_surat).execute(&state.pool).await.map_err(err_db)?;
    crate::audit::log_sql(&state.pool, &user.0.kode,
        &format!("surat_kontrol_bpjs delete no_surat={}", b.no_surat)).await;
    Ok(Json(json!({"ok": true})))
}
