// Security Self-Assessment SIM Faskes — form resmi BPJS Kesehatan
// SPPTI-SEC-FORM-001 v1.1 (kredensialing/integrasi bridging). Header per periode +
// 15 aspek (10 Frontend + 5 Backend). Status: ada=PASS, sebagian=sebagian memenuhi,
// belum=NOT PASS, na=dikecualikan.
// Skor%: ada=2, sebagian=1, belum=0, na=dikecualikan → nilai/(berlaku*2)*100.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB ssa: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Gagal akses data SSA: {}", match &e {
        sqlx::Error::Database(d) => d.message().to_string(), o => o.to_string() })})))
}

// Daftar aspek kanonik (di-snapshot ke item saat SSA dibuat). Mengacu PERSIS pada
// form resmi BPJS Kesehatan "SECURITY SELF-ASSESSMENT SIM FASKES"
// (SPPTI-SEC-FORM-001 v1.1): 10 aspek Frontend + 5 aspek Backend/Server.
const KONTROL: &[(&str, &str, &str)] = &[
    ("1. Frontend (Aplikasi SIM Faskes)", "1.1", "Memastikan tidak ada celah XSS (cross site scripting) pada setiap form inputan"),
    ("1. Frontend (Aplikasi SIM Faskes)", "1.2", "Memastikan tidak ada celah SQL Injection pada setiap form inputan"),
    ("1. Frontend (Aplikasi SIM Faskes)", "1.3", "Ada mekanisme untuk membatasi upaya login berkali-kali (CAPTCHA, delay time, dll) yang tidak dapat di-bypass/OCR/reuse"),
    ("1. Frontend (Aplikasi SIM Faskes)", "1.4", "Lock out login temporer setelah 3 kali salah percobaan login"),
    ("1. Frontend (Aplikasi SIM Faskes)", "1.5", "Memunculkan pesan warning \"Gagal Login\""),
    ("1. Frontend (Aplikasi SIM Faskes)", "1.6", "Pesan warning \"Gagal Login\" tidak membedakan username salah atau password salah"),
    ("1. Frontend (Aplikasi SIM Faskes)", "1.7", "Kompleksitas password minimal: panjang ≥ 8, kombinasi huruf besar, huruf kecil, angka, dan karakter khusus"),
    ("1. Frontend (Aplikasi SIM Faskes)", "1.8", "Menu hanya bisa diakses sesuai peruntukan (menu admin tidak bisa diakses petugas walau URL dimasukkan)"),
    ("1. Frontend (Aplikasi SIM Faskes)", "1.9", "Tidak ada celah broken access control (non-user akses data user, atau user A akses data user B)"),
    ("1. Frontend (Aplikasi SIM Faskes)", "1.10", "Tidak menggunakan library yang vulnerable (misalnya bootstrap, jQuery, dsb)"),
    ("2. Backend / Server", "2.1", "Server terinstall antivirus"),
    ("2. Backend / Server", "2.2", "Firewall diaktifkan dan hanya menerima port HTTPS untuk inbound"),
    ("2. Backend / Server", "2.3", "Versi TLS minimal adalah 1.2"),
    ("2. Backend / Server", "2.4", "Memastikan versi webserver (apache, nginx, IIS) tidak memiliki celah keamanan"),
    ("2. Backend / Server", "2.5", "Memastikan versi framework/bahasa pemrograman tidak memiliki celah keamanan"),
];

#[derive(Serialize, sqlx::FromRow)]
pub struct SsaRow {
    pub id: u32, pub tahun: i32, pub periode: Option<String>, pub tanggal: String,
    pub metode: String, pub penanggung_jawab: Option<String>,
    pub tingkat: String, pub skor_total: Option<f64>, pub dibuat_oleh: Option<String>,
}
#[derive(Deserialize)]
pub struct ListQ { #[serde(default)] pub tahun: Option<i32> }
pub async fn list(u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQ>)
  -> Result<Json<Vec<SsaRow>>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "ssa_view")?;
    let rows: Vec<SsaRow> = sqlx::query_as(
        "SELECT id, tahun, periode, CAST(tanggal AS CHAR) tanggal, metode, penanggung_jawab, tingkat, skor_total, dibuat_oleh \
         FROM simrscb_ssa WHERE (? IS NULL OR tahun=?) ORDER BY tahun DESC, tanggal DESC, id DESC")
        .bind(q.tahun).bind(q.tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct ItemRow {
    pub id: u32, pub urut: i32, pub area: String, pub kode: String,
    pub kontrol: String, pub status: String, pub bukti: Option<String>,
}
#[derive(Serialize, sqlx::FromRow)]
pub struct SsaDetail {
    pub id: u32, pub tahun: i32, pub periode: Option<String>, pub tanggal: String,
    pub metode: String, pub pihak_ketiga: Option<String>, pub penanggung_jawab: Option<String>,
    pub kesimpulan: Option<String>, pub tingkat: String, pub skor_total: Option<f64>,
}
#[derive(Serialize)]
pub struct DetailFull { #[serde(flatten)] pub header: SsaDetail, pub items: Vec<ItemRow> }

pub async fn detail(u: AuthUser, State(s): State<AppState>, Path(id): Path<u32>)
  -> Result<Json<DetailFull>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "ssa_view")?;
    let header: SsaDetail = sqlx::query_as(
        "SELECT id, tahun, periode, CAST(tanggal AS CHAR) tanggal, metode, pihak_ketiga, penanggung_jawab, kesimpulan, tingkat, skor_total \
         FROM simrscb_ssa WHERE id=?").bind(id).fetch_optional(&s.pool).await.map_err(db_err)?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"Tidak ditemukan"}))))?;
    let items: Vec<ItemRow> = sqlx::query_as(
        "SELECT id, urut, area, kode, kontrol, status, bukti FROM simrscb_ssa_item WHERE ssa_id=? ORDER BY urut, id")
        .bind(id).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(DetailFull { header, items }))
}

#[derive(Deserialize)]
pub struct CreateBody {
    pub tahun: i32, pub tanggal: String,
    #[serde(default)] pub periode: Option<String>,
    #[serde(default)] pub metode: Option<String>,
    #[serde(default)] pub penanggung_jawab: Option<String>,
}
pub async fn create(u: AuthUser, State(s): State<AppState>, Json(b): Json<CreateBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "ssa_edit")?;
    if b.tanggal.trim().is_empty() { return Err((StatusCode::UNPROCESSABLE_ENTITY, Json(json!({"error":"Tanggal wajib"})))); }
    let metode = b.metode.as_deref().filter(|m| ["Internal","Pihak Ketiga","Gabungan"].contains(m)).unwrap_or("Internal");
    let r = sqlx::query(
        "INSERT INTO simrscb_ssa (tahun, periode, tanggal, metode, penanggung_jawab, dibuat_oleh) VALUES (?,?,?,?,?,?)")
        .bind(b.tahun).bind(b.periode.as_deref().filter(|x|!x.trim().is_empty())).bind(&b.tanggal)
        .bind(metode).bind(b.penanggung_jawab.as_deref().filter(|x|!x.trim().is_empty())).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    let id = r.last_insert_id();
    // Seed item dari daftar kontrol kanonik.
    for (i, (area, kode, kontrol)) in KONTROL.iter().enumerate() {
        sqlx::query("INSERT INTO simrscb_ssa_item (ssa_id, urut, area, kode, kontrol, status) VALUES (?,?,?,?,?, 'belum')")
            .bind(id).bind(i as i32).bind(area).bind(kode).bind(kontrol)
            .execute(&s.pool).await.map_err(db_err)?;
    }
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("SSA create id={} tahun={}", id, b.tahun)).await;
    Ok(Json(json!({"ok": true, "id": id})))
}

#[derive(Deserialize)]
pub struct UpdateBody {
    #[serde(default)] pub periode: Option<String>,
    #[serde(default)] pub tanggal: Option<String>,
    #[serde(default)] pub metode: Option<String>,
    #[serde(default)] pub pihak_ketiga: Option<String>,
    #[serde(default)] pub penanggung_jawab: Option<String>,
    #[serde(default)] pub kesimpulan: Option<String>,
}
pub async fn update(u: AuthUser, State(s): State<AppState>, Path(id): Path<u32>, Json(b): Json<UpdateBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "ssa_edit")?;
    sqlx::query(
        "UPDATE simrscb_ssa SET periode=COALESCE(?,periode), tanggal=COALESCE(?,tanggal), \
         metode=COALESCE(?,metode), pihak_ketiga=?, penanggung_jawab=COALESCE(?,penanggung_jawab), \
         kesimpulan=COALESCE(?,kesimpulan) WHERE id=?")
        .bind(&b.periode).bind(b.tanggal.as_deref().filter(|x|!x.trim().is_empty()))
        .bind(b.metode.as_deref().filter(|m| ["Internal","Pihak Ketiga","Gabungan"].contains(m)))
        .bind(&b.pihak_ketiga).bind(&b.penanggung_jawab).bind(&b.kesimpulan).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    recalc(&s, id).await?;
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
pub struct ItemBody { pub status: String, #[serde(default)] pub bukti: Option<String> }
pub async fn update_item(u: AuthUser, State(s): State<AppState>, Path((id, item_id)): Path<(u32,u32)>, Json(b): Json<ItemBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "ssa_edit")?;
    let st = if ["ada","sebagian","belum","na"].contains(&b.status.as_str()) { b.status.as_str() } else { "belum" };
    sqlx::query("UPDATE simrscb_ssa_item SET status=?, bukti=? WHERE id=? AND ssa_id=?")
        .bind(st).bind(b.bukti.as_deref().filter(|x|!x.trim().is_empty())).bind(item_id).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    let skor = recalc(&s, id).await?;
    Ok(Json(json!({"ok": true, "skor_total": skor})))
}

pub async fn delete_ssa(u: AuthUser, State(s): State<AppState>, Path(id): Path<u32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&u, "ssa_edit")?;
    sqlx::query("DELETE FROM simrscb_ssa WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("SSA delete id={}", id)).await;
    Ok(Json(json!({"ok": true})))
}

// Hitung ulang skor total + tingkat dari item (ada=2, sebagian=1, belum=0, na dikecualikan).
async fn recalc(s: &AppState, id: u32) -> Result<f64, (StatusCode, Json<Value>)> {
    let (nilai, berlaku): (Option<i64>, Option<i64>) = sqlx::query_as(
        "SELECT CAST(SUM(CASE status WHEN 'ada' THEN 2 WHEN 'sebagian' THEN 1 ELSE 0 END) AS SIGNED), \
                CAST(SUM(status<>'na') AS SIGNED) FROM simrscb_ssa_item WHERE ssa_id=?")
        .bind(id).fetch_one(&s.pool).await.map_err(db_err)?;
    let berlaku = berlaku.unwrap_or(0);
    let skor = if berlaku > 0 { (nilai.unwrap_or(0) as f64) / (berlaku as f64 * 2.0) * 100.0 } else { 0.0 };
    let tingkat = if berlaku == 0 { "" } else if skor >= 80.0 { "Baik" } else if skor >= 60.0 { "Cukup" } else { "Perlu Perbaikan" };
    sqlx::query("UPDATE simrscb_ssa SET skor_total=?, tingkat=? WHERE id=?")
        .bind(skor).bind(tingkat).bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok((skor * 100.0).round() / 100.0)
}
