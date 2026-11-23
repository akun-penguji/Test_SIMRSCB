// Port tabel Khanza kosong (di luar pelayanan) — MFK/Kesling:
//   kesling_limbah_b3medis (PK nip,tanggal), pemeliharaan_inventaris (PK no_inventaris,tanggal),
//   pemeliharaan_gedung (PK no_pemeliharaan). Web CRUD di atas struktur Khanza yang ada.
use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB fasilitas: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if u.0.is_admin || has_perm(u, "mfk_edit") || has_perm(u, "kesling_edit") || has_perm(u, "akreditasi_edit") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Perlu izin mfk_edit / kesling_edit"})))) }
}
fn ndt(s: &str) -> String { let s = s.trim().replace('T', " "); if s.len() == 16 { format!("{}:00", s) } else { s.to_string() } }

// ── Limbah B3 Medis (kesling_limbah_b3medis) ─────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct LimbahRow { pub nip: String, pub nama: Option<String>, pub tanggal: String, pub jmllimbah: Option<f64>, pub tujuan_penyerahan: Option<String>, pub bukti_dokumen: Option<String>, pub sisa_di_tps: Option<f64>, pub keterangan: Option<String> }
#[derive(Deserialize)]
pub struct LimbahListQ { pub tahun: Option<i32>, pub bulan: Option<i32> }
pub async fn limbah_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<LimbahListQ>) -> Result<Json<Vec<LimbahRow>>, (StatusCode, Json<Value>)> {
    let sql = "SELECT k.nip, pg.nama, CAST(k.tanggal AS CHAR) tanggal, k.jmllimbah, k.tujuan_penyerahan, k.bukti_dokumen, k.sisa_di_tps, k.keterangan \
        FROM kesling_limbah_b3medis k LEFT JOIN pegawai pg ON pg.nik=k.nip \
        WHERE (? IS NULL OR YEAR(k.tanggal)=?) AND (? IS NULL OR MONTH(k.tanggal)=?) ORDER BY k.tanggal DESC LIMIT 500";
    let rows = sqlx::query_as(sql).bind(q.tahun).bind(q.tahun).bind(q.bulan).bind(q.bulan).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct LimbahBody { pub tanggal: String, #[serde(default)] pub jmllimbah: Option<f64>, #[serde(default)] pub tujuan_penyerahan: Option<String>, #[serde(default)] pub bukti_dokumen: Option<String>, #[serde(default)] pub sisa_di_tps: Option<f64>, #[serde(default)] pub keterangan: Option<String>, #[serde(default)] pub orig_tanggal: Option<String> }
pub async fn limbah_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<LimbahBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    // Edit: hapus baris lama (nip user + orig_tanggal) lalu REPLACE.
    if let Some(ot) = &b.orig_tanggal { if !ot.trim().is_empty() { sqlx::query("DELETE FROM kesling_limbah_b3medis WHERE nip=? AND tanggal=?").bind(&u.0.kode).bind(ndt(ot)).execute(&s.pool).await.ok(); } }
    sqlx::query("REPLACE INTO kesling_limbah_b3medis (nip,tanggal,jmllimbah,tujuan_penyerahan,bukti_dokumen,sisa_di_tps,keterangan) VALUES (?,?,?,?,?,?,?)")
        .bind(&u.0.kode).bind(ndt(&b.tanggal)).bind(b.jmllimbah).bind(&b.tujuan_penyerahan).bind(&b.bukti_dokumen).bind(b.sisa_di_tps).bind(&b.keterangan)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
#[derive(Deserialize)]
pub struct LimbahDel { pub nip: String, pub tanggal: String }
pub async fn limbah_hapus(u: AuthUser, State(s): State<AppState>, Json(b): Json<LimbahDel>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM kesling_limbah_b3medis WHERE nip=? AND tanggal=?").bind(&b.nip).bind(ndt(&b.tanggal)).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Pemeliharaan Alat (pemeliharaan_inventaris) ──────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct PmAlatRow { pub no_inventaris: String, pub tanggal: String, pub uraian_kegiatan: Option<String>, pub nip: Option<String>, pub nama: Option<String>, pub pelaksana: Option<String>, pub biaya: Option<f64>, pub jenis_pemeliharaan: Option<String> }
#[derive(Deserialize)]
pub struct PmListQ { pub tahun: Option<i32>, pub q: Option<String> }
pub async fn pm_alat_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<PmListQ>) -> Result<Json<Vec<PmAlatRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = "SELECT p.no_inventaris, CAST(p.tanggal AS CHAR) tanggal, p.uraian_kegiatan, p.nip, pg.nama, p.pelaksana, p.biaya, p.jenis_pemeliharaan \
        FROM pemeliharaan_inventaris p LEFT JOIN pegawai pg ON pg.nik=p.nip \
        WHERE (? IS NULL OR YEAR(p.tanggal)=?) AND (? IS NULL OR p.no_inventaris LIKE ? OR p.uraian_kegiatan LIKE ?) ORDER BY p.tanggal DESC LIMIT 500";
    let rows = sqlx::query_as(sql).bind(q.tahun).bind(q.tahun).bind(&qs).bind(&qs).bind(&qs).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct PmAlatBody { pub no_inventaris: String, pub tanggal: String, #[serde(default)] pub uraian_kegiatan: Option<String>, #[serde(default)] pub pelaksana: Option<String>, #[serde(default)] pub biaya: Option<f64>, #[serde(default)] pub jenis_pemeliharaan: Option<String>, #[serde(default)] pub orig_no: Option<String>, #[serde(default)] pub orig_tanggal: Option<String> }
pub async fn pm_alat_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<PmAlatBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.no_inventaris.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"No. inventaris wajib"})))); }
    if let (Some(on), Some(ot)) = (&b.orig_no, &b.orig_tanggal) { if !on.trim().is_empty() { sqlx::query("DELETE FROM pemeliharaan_inventaris WHERE no_inventaris=? AND tanggal=?").bind(on).bind(ot.trim()).execute(&s.pool).await.ok(); } }
    sqlx::query("REPLACE INTO pemeliharaan_inventaris (no_inventaris,tanggal,uraian_kegiatan,nip,pelaksana,biaya,jenis_pemeliharaan) VALUES (?,?,?,?,?,?,?)")
        .bind(b.no_inventaris.trim()).bind(b.tanggal.trim()).bind(&b.uraian_kegiatan).bind(&u.0.kode)
        .bind(enum_or_null(&b.pelaksana)).bind(b.biaya).bind(enum_or_null(&b.jenis_pemeliharaan))
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
#[derive(Deserialize)]
pub struct PmAlatDel { pub no_inventaris: String, pub tanggal: String }
pub async fn pm_alat_hapus(u: AuthUser, State(s): State<AppState>, Json(b): Json<PmAlatDel>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM pemeliharaan_inventaris WHERE no_inventaris=? AND tanggal=?").bind(&b.no_inventaris).bind(b.tanggal.trim()).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Pemeliharaan Gedung (pemeliharaan_gedung) ────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct PmGedungRow { pub no_pemeliharaan: String, pub tanggal: Option<String>, pub uraian_kegiatan: Option<String>, pub nip: Option<String>, pub nama: Option<String>, pub pelaksana: Option<String>, pub biaya: Option<f64>, pub jenis_pemeliharaan: Option<String>, pub tindak_lanjut: Option<String> }
pub async fn pm_gedung_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<PmListQ>) -> Result<Json<Vec<PmGedungRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = "SELECT p.no_pemeliharaan, CAST(p.tanggal AS CHAR) tanggal, p.uraian_kegiatan, p.nip, pg.nama, p.pelaksana, p.biaya, p.jenis_pemeliharaan, p.tindak_lanjut \
        FROM pemeliharaan_gedung p LEFT JOIN pegawai pg ON pg.nik=p.nip \
        WHERE (? IS NULL OR YEAR(p.tanggal)=?) AND (? IS NULL OR p.no_pemeliharaan LIKE ? OR p.uraian_kegiatan LIKE ?) ORDER BY p.tanggal DESC LIMIT 500";
    let rows = sqlx::query_as(sql).bind(q.tahun).bind(q.tahun).bind(&qs).bind(&qs).bind(&qs).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct PmGedungBody { pub no_pemeliharaan: String, #[serde(default)] pub tanggal: Option<String>, #[serde(default)] pub uraian_kegiatan: Option<String>, #[serde(default)] pub pelaksana: Option<String>, #[serde(default)] pub biaya: Option<f64>, #[serde(default)] pub jenis_pemeliharaan: Option<String>, #[serde(default)] pub tindak_lanjut: Option<String> }
pub async fn pm_gedung_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<PmGedungBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.no_pemeliharaan.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"No. pemeliharaan wajib"})))); }
    sqlx::query("REPLACE INTO pemeliharaan_gedung (no_pemeliharaan,tanggal,uraian_kegiatan,nip,pelaksana,biaya,jenis_pemeliharaan,tindak_lanjut) VALUES (?,?,?,?,?,?,?,?)")
        .bind(b.no_pemeliharaan.trim()).bind(b.tanggal.as_deref().map(|x| x.trim()).filter(|x| x.len() >= 8)).bind(&b.uraian_kegiatan).bind(&u.0.kode)
        .bind(enum_or_null(&b.pelaksana)).bind(b.biaya).bind(enum_or_null(&b.jenis_pemeliharaan)).bind(&b.tindak_lanjut)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
#[derive(Deserialize)]
pub struct PmGedungDel { pub no_pemeliharaan: String }
pub async fn pm_gedung_hapus(u: AuthUser, State(s): State<AppState>, Json(b): Json<PmGedungDel>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM pemeliharaan_gedung WHERE no_pemeliharaan=?").bind(b.no_pemeliharaan.trim()).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── ICRA/PCRA Prakonstruksi (pcra_icra_pengkajian_risiko_prakonstruksi) ───────
#[derive(Serialize, sqlx::FromRow)]
pub struct PcraRow {
    pub no_pcra: String, pub no_proyek: Option<String>, pub nama_proyek: Option<String>, pub lokasi_proyek: Option<String>,
    pub mulai_proyek: Option<String>, pub perkiraan_selesai: Option<String>, pub deskripsi_pekerjaan: Option<String>,
    pub penangung_jawab_proyek: Option<String>, pub pelaksana_proyek: Option<String>, pub deskripsi_lokasi_proyek: Option<String>,
    pub kode_aktivitas: Option<String>, pub kode_kelas_risiko: Option<String>, pub dibutuhkan_icra: Option<String>,
    pub rekomendasi_selama_pengerjaan: Option<String>, pub rekomendasi_setelah_pengerjaan: Option<String>,
    pub hal_yang_perlu_dimonitor: Option<String>, pub catatan_tim_ppi_k3_lainnya: Option<String>, pub tanggal_pengkajian: Option<String>,
}
const PCRA_COLS: &str = "no_pcra, no_proyek, nama_proyek, lokasi_proyek, DATE_FORMAT(mulai_proyek,'%Y-%m-%d') mulai_proyek, DATE_FORMAT(perkiraan_selesai,'%Y-%m-%d') perkiraan_selesai, deskripsi_pekerjaan, penangung_jawab_proyek, pelaksana_proyek, deskripsi_lokasi_proyek, kode_aktivitas, kode_kelas_risiko, dibutuhkan_icra, rekomendasi_selama_pengerjaan, rekomendasi_setelah_pengerjaan, hal_yang_perlu_dimonitor, catatan_tim_ppi_k3_lainnya, CAST(tanggal_pengkajian AS CHAR) tanggal_pengkajian";
pub async fn pcra_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<PmListQ>) -> Result<Json<Vec<PcraRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!("SELECT {PCRA_COLS} FROM pcra_icra_pengkajian_risiko_prakonstruksi WHERE (? IS NULL OR YEAR(tanggal_pengkajian)=?) AND (? IS NULL OR nama_proyek LIKE ? OR no_pcra LIKE ?) ORDER BY tanggal_pengkajian DESC, no_pcra DESC LIMIT 500");
    let rows = sqlx::query_as(&sql).bind(q.tahun).bind(q.tahun).bind(&qs).bind(&qs).bind(&qs).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct PcraBody {
    pub no_pcra: String, #[serde(default)] pub no_proyek: Option<String>, #[serde(default)] pub nama_proyek: Option<String>, #[serde(default)] pub lokasi_proyek: Option<String>,
    #[serde(default)] pub mulai_proyek: Option<String>, #[serde(default)] pub perkiraan_selesai: Option<String>, #[serde(default)] pub deskripsi_pekerjaan: Option<String>,
    #[serde(default)] pub penangung_jawab_proyek: Option<String>, #[serde(default)] pub pelaksana_proyek: Option<String>, #[serde(default)] pub deskripsi_lokasi_proyek: Option<String>,
    #[serde(default)] pub kode_aktivitas: Option<String>, #[serde(default)] pub kode_kelas_risiko: Option<String>, #[serde(default)] pub dibutuhkan_icra: Option<String>,
    #[serde(default)] pub rekomendasi_selama_pengerjaan: Option<String>, #[serde(default)] pub rekomendasi_setelah_pengerjaan: Option<String>,
    #[serde(default)] pub hal_yang_perlu_dimonitor: Option<String>, #[serde(default)] pub catatan_tim_ppi_k3_lainnya: Option<String>, #[serde(default)] pub tanggal_pengkajian: Option<String>,
}
fn od8(s: &Option<String>) -> Option<String> { s.as_deref().map(|x| x.trim()).filter(|x| x.len() >= 8).map(|x| x.replace('T', " ")) }
pub async fn pcra_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<PcraBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.no_pcra.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"No. PCRA wajib"})))); }
    sqlx::query("REPLACE INTO pcra_icra_pengkajian_risiko_prakonstruksi (no_pcra,no_proyek,nama_proyek,lokasi_proyek,mulai_proyek,perkiraan_selesai,deskripsi_pekerjaan,penangung_jawab_proyek,pelaksana_proyek,deskripsi_lokasi_proyek,kode_aktivitas,kode_kelas_risiko,dibutuhkan_icra,rekomendasi_selama_pengerjaan,rekomendasi_setelah_pengerjaan,hal_yang_perlu_dimonitor,catatan_tim_ppi_k3_lainnya,tanggal_pengkajian,nik_timk3) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(b.no_pcra.trim()).bind(&b.no_proyek).bind(&b.nama_proyek).bind(&b.lokasi_proyek).bind(od8(&b.mulai_proyek)).bind(od8(&b.perkiraan_selesai)).bind(&b.deskripsi_pekerjaan)
        .bind(&b.penangung_jawab_proyek).bind(&b.pelaksana_proyek).bind(&b.deskripsi_lokasi_proyek).bind(enum_or_null(&b.kode_aktivitas)).bind(enum_or_null(&b.kode_kelas_risiko)).bind(enum_or_null(&b.dibutuhkan_icra))
        .bind(&b.rekomendasi_selama_pengerjaan).bind(&b.rekomendasi_setelah_pengerjaan).bind(&b.hal_yang_perlu_dimonitor).bind(&b.catatan_tim_ppi_k3_lainnya).bind(od8(&b.tanggal_pengkajian)).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
#[derive(Deserialize)]
pub struct PcraDel { pub no_pcra: String }
pub async fn pcra_hapus(u: AuthUser, State(s): State<AppState>, Json(b): Json<PcraDel>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM pcra_icra_pengkajian_risiko_prakonstruksi WHERE no_pcra=?").bind(b.no_pcra.trim()).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// Enum kosong → NULL (agar tak melanggar kolom enum Khanza).
fn enum_or_null(s: &Option<String>) -> Option<String> { s.as_deref().map(|x| x.trim()).filter(|x| !x.is_empty()).map(|x| x.to_string()) }
