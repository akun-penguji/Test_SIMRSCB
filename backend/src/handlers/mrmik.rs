// MRMIK — register/instrumen digital bab Manajemen Rekam Medik & Informasi Kesehatan.
//   #1 Pelepasan Informasi Medis (MRMIK 10 EP2)   → simrscb_pelepasan_informasi
//   #2 Reviu RM Kualitatif terbuka/tertutup (MRMIK 12/7/5) → simrscb_reviu_rm
//   #3 Koreksi Penulisan RME (MRMIK 8 EP3)         → simrscb_koreksi_rme
//   #4 Daftar & Evaluasi Formulir RM (MRMIK 6/7)   → simrscb_formulir_rm
//   #5 Audit Akses & Hak Akses (MRMIK 2.1)         → baca tracker + simrscb_user_permissions

use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB mrmik: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}
fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if u.0.is_admin || has_perm(u, "mrmik_edit") || has_perm(u, "rekam_medis") || has_perm(u, "akreditasi_edit") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Perlu izin mrmik_edit / rekam_medis"})))) }
}

// ── #1 Pelepasan Informasi Medis ─────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct PelepasanRow {
    pub id: i32, pub tanggal: Option<String>, pub no_rkm_medis: Option<String>, pub nama_pasien: Option<String>,
    pub no_rawat: Option<String>, pub pemohon: Option<String>, pub hubungan: Option<String>, pub instansi: Option<String>,
    pub tujuan: Option<String>, pub jenis_dokumen: Option<String>, pub cara_pemberian: Option<String>,
    pub disetujui_oleh: Option<String>, pub status: String, pub tgl_selesai: Option<String>,
    pub petugas_nip: Option<String>, pub catatan: Option<String>, pub created_at: Option<String>,
}
const PEL_COLS: &str = "id, DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, no_rkm_medis, nama_pasien, no_rawat, pemohon, hubungan, instansi, tujuan, jenis_dokumen, cara_pemberian, disetujui_oleh, status, DATE_FORMAT(tgl_selesai,'%Y-%m-%d') tgl_selesai, petugas_nip, catatan, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') created_at";

#[derive(Deserialize)]
pub struct PelListQ { pub tahun: Option<i32>, pub bulan: Option<i32>, pub status: Option<String>, pub tujuan: Option<String>, pub q: Option<String> }
pub async fn pel_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<PelListQ>)
  -> Result<Json<Vec<PelepasanRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!("SELECT {PEL_COLS} FROM simrscb_pelepasan_informasi \
        WHERE (? IS NULL OR YEAR(tanggal)=?) AND (? IS NULL OR MONTH(tanggal)=?) \
          AND (? IS NULL OR status=?) AND (? IS NULL OR tujuan=?) \
          AND (? IS NULL OR nama_pasien LIKE ? OR no_rkm_medis LIKE ? OR pemohon LIKE ?) \
        ORDER BY tanggal DESC, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql)
        .bind(q.tahun).bind(q.tahun).bind(q.bulan).bind(q.bulan)
        .bind(&q.status).bind(&q.status).bind(&q.tujuan).bind(&q.tujuan)
        .bind(&qs).bind(&qs).bind(&qs).bind(&qs)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct PelBody {
    pub tanggal: String, #[serde(default)] pub no_rkm_medis: Option<String>, #[serde(default)] pub nama_pasien: Option<String>,
    #[serde(default)] pub no_rawat: Option<String>, #[serde(default)] pub pemohon: Option<String>, #[serde(default)] pub hubungan: Option<String>,
    #[serde(default)] pub instansi: Option<String>, #[serde(default)] pub tujuan: Option<String>, #[serde(default)] pub jenis_dokumen: Option<String>,
    #[serde(default)] pub cara_pemberian: Option<String>, #[serde(default)] pub disetujui_oleh: Option<String>,
    #[serde(default)] pub status: Option<String>, #[serde(default)] pub tgl_selesai: Option<String>, #[serde(default)] pub catatan: Option<String>,
}
pub async fn pel_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<PelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let r = sqlx::query(
        "INSERT INTO simrscb_pelepasan_informasi (tanggal,no_rkm_medis,nama_pasien,no_rawat,pemohon,hubungan,instansi,tujuan,jenis_dokumen,cara_pemberian,disetujui_oleh,status,tgl_selesai,petugas_nip,catatan) \
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.tanggal).bind(&b.no_rkm_medis).bind(&b.nama_pasien).bind(&b.no_rawat).bind(&b.pemohon)
        .bind(&b.hubungan).bind(&b.instansi).bind(&b.tujuan).bind(&b.jenis_dokumen).bind(&b.cara_pemberian)
        .bind(&b.disetujui_oleh).bind(b.status.as_deref().unwrap_or("Diajukan")).bind(opt_date(&b.tgl_selesai)).bind(&u.0.kode).bind(&b.catatan)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn pel_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<PelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query(
        "UPDATE simrscb_pelepasan_informasi SET tanggal=?,no_rkm_medis=?,nama_pasien=?,no_rawat=?,pemohon=?,hubungan=?,instansi=?,tujuan=?,jenis_dokumen=?,cara_pemberian=?,disetujui_oleh=?,status=COALESCE(?,status),tgl_selesai=?,catatan=?,updated_at=NOW() WHERE id=?")
        .bind(&b.tanggal).bind(&b.no_rkm_medis).bind(&b.nama_pasien).bind(&b.no_rawat).bind(&b.pemohon)
        .bind(&b.hubungan).bind(&b.instansi).bind(&b.tujuan).bind(&b.jenis_dokumen).bind(&b.cara_pemberian)
        .bind(&b.disetujui_oleh).bind(&b.status).bind(opt_date(&b.tgl_selesai)).bind(&b.catatan).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn pel_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_pelepasan_informasi WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
#[derive(Deserialize)]
pub struct PelRekapQ { pub tahun: Option<i32> }
pub async fn pel_rekap(_u: AuthUser, State(s): State<AppState>, Query(q): Query<PelRekapQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2026));
    #[derive(sqlx::FromRow)] struct C { k: Option<String>, n: i64 }
    let per_tujuan: Vec<C> = sqlx::query_as("SELECT tujuan k, COUNT(*) n FROM simrscb_pelepasan_informasi WHERE YEAR(tanggal)=? GROUP BY tujuan ORDER BY n DESC")
        .bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    let per_status: Vec<C> = sqlx::query_as("SELECT status k, COUNT(*) n FROM simrscb_pelepasan_informasi WHERE YEAR(tanggal)=? GROUP BY status")
        .bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    #[derive(sqlx::FromRow)] struct M { bulan: i32, n: i64 }
    let per_bulan: Vec<M> = sqlx::query_as("SELECT MONTH(tanggal) bulan, COUNT(*) n FROM simrscb_pelepasan_informasi WHERE YEAR(tanggal)=? GROUP BY MONTH(tanggal)")
        .bind(tahun).fetch_all(&s.pool).await.map_err(db_err)?;
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM simrscb_pelepasan_informasi WHERE YEAR(tanggal)=?").bind(tahun).fetch_one(&s.pool).await.unwrap_or(0);
    Ok(Json(json!({
        "tahun": tahun, "total": total,
        "per_tujuan": per_tujuan.iter().map(|c| json!({"label": c.k, "total": c.n})).collect::<Vec<_>>(),
        "per_status": per_status.iter().map(|c| json!({"label": c.k, "total": c.n})).collect::<Vec<_>>(),
        "per_bulan": per_bulan.iter().map(|m| json!({"bulan": m.bulan, "total": m.n})).collect::<Vec<_>>(),
    })))
}

// ── #2 Reviu RM Kualitatif ───────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct ReviuRow {
    pub id: i32, pub tanggal: Option<String>, pub no_rawat: Option<String>, pub no_rkm_medis: Option<String>,
    pub nama_pasien: Option<String>, pub jenis_reviu: String, pub ketepatan_waktu: i8, pub keterbacaan: i8,
    pub kelengkapan: i8, pub kesesuaian_isi: i8, pub skor: Option<f64>, pub catatan: Option<String>,
    pub reviewer: Option<String>, pub petugas_nip: Option<String>, pub created_at: Option<String>,
}
const REV_COLS: &str = "id, DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, no_rawat, no_rkm_medis, nama_pasien, jenis_reviu, ketepatan_waktu, keterbacaan, kelengkapan, kesesuaian_isi, skor, catatan, reviewer, petugas_nip, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') created_at";
#[derive(Deserialize)]
pub struct RevListQ { pub tahun: Option<i32>, pub bulan: Option<i32>, pub jenis_reviu: Option<String>, pub q: Option<String> }
pub async fn rev_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<RevListQ>)
  -> Result<Json<Vec<ReviuRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!("SELECT {REV_COLS} FROM simrscb_reviu_rm \
        WHERE (? IS NULL OR YEAR(tanggal)=?) AND (? IS NULL OR MONTH(tanggal)=?) AND (? IS NULL OR jenis_reviu=?) \
          AND (? IS NULL OR nama_pasien LIKE ? OR no_rawat LIKE ?) ORDER BY tanggal DESC, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql)
        .bind(q.tahun).bind(q.tahun).bind(q.bulan).bind(q.bulan).bind(&q.jenis_reviu).bind(&q.jenis_reviu)
        .bind(&qs).bind(&qs).bind(&qs).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct RevBody {
    pub tanggal: String, #[serde(default)] pub no_rawat: Option<String>, #[serde(default)] pub no_rkm_medis: Option<String>,
    #[serde(default)] pub nama_pasien: Option<String>, #[serde(default)] pub jenis_reviu: Option<String>,
    #[serde(default)] pub ketepatan_waktu: i8, #[serde(default)] pub keterbacaan: i8, #[serde(default)] pub kelengkapan: i8, #[serde(default)] pub kesesuaian_isi: i8,
    #[serde(default)] pub catatan: Option<String>, #[serde(default)] pub reviewer: Option<String>,
}
fn rev_skor(b: &RevBody) -> f64 {
    let n = (b.ketepatan_waktu.min(1).max(0) + b.keterbacaan.min(1).max(0) + b.kelengkapan.min(1).max(0) + b.kesesuaian_isi.min(1).max(0)) as f64;
    n / 4.0 * 100.0
}
pub async fn rev_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<RevBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let skor = rev_skor(&b);
    let r = sqlx::query(
        "INSERT INTO simrscb_reviu_rm (tanggal,no_rawat,no_rkm_medis,nama_pasien,jenis_reviu,ketepatan_waktu,keterbacaan,kelengkapan,kesesuaian_isi,skor,catatan,reviewer,petugas_nip) \
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.tanggal).bind(&b.no_rawat).bind(&b.no_rkm_medis).bind(&b.nama_pasien)
        .bind(b.jenis_reviu.as_deref().unwrap_or("Tertutup"))
        .bind(b.ketepatan_waktu).bind(b.keterbacaan).bind(b.kelengkapan).bind(b.kesesuaian_isi).bind(skor)
        .bind(&b.catatan).bind(&b.reviewer).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id(), "skor": skor})))
}
pub async fn rev_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<RevBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let skor = rev_skor(&b);
    sqlx::query(
        "UPDATE simrscb_reviu_rm SET tanggal=?,no_rawat=?,no_rkm_medis=?,nama_pasien=?,jenis_reviu=COALESCE(?,jenis_reviu),ketepatan_waktu=?,keterbacaan=?,kelengkapan=?,kesesuaian_isi=?,skor=?,catatan=?,reviewer=? WHERE id=?")
        .bind(&b.tanggal).bind(&b.no_rawat).bind(&b.no_rkm_medis).bind(&b.nama_pasien).bind(&b.jenis_reviu)
        .bind(b.ketepatan_waktu).bind(b.keterbacaan).bind(b.kelengkapan).bind(b.kesesuaian_isi).bind(skor)
        .bind(&b.catatan).bind(&b.reviewer).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "skor": skor})))
}
pub async fn rev_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_reviu_rm WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
#[derive(Deserialize)]
pub struct RevRekapQ { pub tahun: Option<i32> }
pub async fn rev_rekap(_u: AuthUser, State(s): State<AppState>, Query(q): Query<RevRekapQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2026));
    #[derive(sqlx::FromRow)] struct Agg { total: i64, avg_skor: Option<f64>,
        p_ketepatan: Option<f64>, p_keterbacaan: Option<f64>, p_kelengkapan: Option<f64>, p_isi: Option<f64> }
    let a: Agg = sqlx::query_as(
        "SELECT COUNT(*) total, AVG(skor) avg_skor, \
                AVG(ketepatan_waktu)*100 p_ketepatan, AVG(keterbacaan)*100 p_keterbacaan, \
                AVG(kelengkapan)*100 p_kelengkapan, AVG(kesesuaian_isi)*100 p_isi \
         FROM simrscb_reviu_rm WHERE YEAR(tanggal)=?")
        .bind(tahun).fetch_one(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"tahun": tahun, "total": a.total, "avg_skor": a.avg_skor,
        "pct_ketepatan_waktu": a.p_ketepatan, "pct_keterbacaan": a.p_keterbacaan,
        "pct_kelengkapan": a.p_kelengkapan, "pct_kesesuaian_isi": a.p_isi})))
}

// ── #3 Koreksi Penulisan RME ─────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct KoreksiRow {
    pub id: i32, pub tanggal: Option<String>, pub no_rawat: Option<String>, pub no_rkm_medis: Option<String>,
    pub nama_pasien: Option<String>, pub jenis_rm: String, pub formulir: Option<String>,
    pub isi_lama: Option<String>, pub isi_baru: Option<String>, pub alasan: Option<String>,
    pub dikoreksi_oleh: Option<String>, pub petugas_nip: Option<String>, pub created_at: Option<String>,
}
const KOR_COLS: &str = "id, DATE_FORMAT(tanggal,'%Y-%m-%d') tanggal, no_rawat, no_rkm_medis, nama_pasien, jenis_rm, formulir, isi_lama, isi_baru, alasan, dikoreksi_oleh, petugas_nip, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') created_at";
#[derive(Deserialize)]
pub struct KorListQ { pub tahun: Option<i32>, pub bulan: Option<i32>, pub jenis_rm: Option<String>, pub q: Option<String> }
pub async fn kor_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<KorListQ>)
  -> Result<Json<Vec<KoreksiRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!("SELECT {KOR_COLS} FROM simrscb_koreksi_rme \
        WHERE (? IS NULL OR YEAR(tanggal)=?) AND (? IS NULL OR MONTH(tanggal)=?) AND (? IS NULL OR jenis_rm=?) \
          AND (? IS NULL OR nama_pasien LIKE ? OR no_rawat LIKE ? OR formulir LIKE ?) ORDER BY tanggal DESC, id DESC LIMIT 500");
    let rows = sqlx::query_as(&sql)
        .bind(q.tahun).bind(q.tahun).bind(q.bulan).bind(q.bulan).bind(&q.jenis_rm).bind(&q.jenis_rm)
        .bind(&qs).bind(&qs).bind(&qs).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct KorBody {
    pub tanggal: String, #[serde(default)] pub no_rawat: Option<String>, #[serde(default)] pub no_rkm_medis: Option<String>,
    #[serde(default)] pub nama_pasien: Option<String>, #[serde(default)] pub jenis_rm: Option<String>, #[serde(default)] pub formulir: Option<String>,
    #[serde(default)] pub isi_lama: Option<String>, #[serde(default)] pub isi_baru: Option<String>, #[serde(default)] pub alasan: Option<String>,
    #[serde(default)] pub dikoreksi_oleh: Option<String>,
}
pub async fn kor_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<KorBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    let r = sqlx::query(
        "INSERT INTO simrscb_koreksi_rme (tanggal,no_rawat,no_rkm_medis,nama_pasien,jenis_rm,formulir,isi_lama,isi_baru,alasan,dikoreksi_oleh,petugas_nip) \
         VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.tanggal).bind(&b.no_rawat).bind(&b.no_rkm_medis).bind(&b.nama_pasien)
        .bind(b.jenis_rm.as_deref().unwrap_or("Elektronik")).bind(&b.formulir).bind(&b.isi_lama).bind(&b.isi_baru).bind(&b.alasan)
        .bind(&b.dikoreksi_oleh).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn kor_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<KorBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query(
        "UPDATE simrscb_koreksi_rme SET tanggal=?,no_rawat=?,no_rkm_medis=?,nama_pasien=?,jenis_rm=COALESCE(?,jenis_rm),formulir=?,isi_lama=?,isi_baru=?,alasan=?,dikoreksi_oleh=? WHERE id=?")
        .bind(&b.tanggal).bind(&b.no_rawat).bind(&b.no_rkm_medis).bind(&b.nama_pasien).bind(&b.jenis_rm)
        .bind(&b.formulir).bind(&b.isi_lama).bind(&b.isi_baru).bind(&b.alasan).bind(&b.dikoreksi_oleh).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn kor_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_koreksi_rme WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── #4 Daftar & Evaluasi Formulir RM ─────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct FormulirRow {
    pub id: i32, pub kode_form: Option<String>, pub nama_form: String, pub unit: Option<String>,
    pub versi: Option<String>, pub tgl_terbit: Option<String>, pub tgl_reviu: Option<String>,
    pub status: String, pub hasil_evaluasi: Option<String>, pub direview_oleh: Option<String>, pub catatan: Option<String>,
}
const FRM_COLS: &str = "id, kode_form, nama_form, unit, versi, DATE_FORMAT(tgl_terbit,'%Y-%m-%d') tgl_terbit, DATE_FORMAT(tgl_reviu,'%Y-%m-%d') tgl_reviu, status, hasil_evaluasi, direview_oleh, catatan";
#[derive(Deserialize)]
pub struct FrmListQ { pub status: Option<String>, pub unit: Option<String>, pub q: Option<String> }
pub async fn frm_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<FrmListQ>)
  -> Result<Json<Vec<FormulirRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    let sql = format!("SELECT {FRM_COLS} FROM simrscb_formulir_rm \
        WHERE (? IS NULL OR status=?) AND (? IS NULL OR unit=?) \
          AND (? IS NULL OR nama_form LIKE ? OR kode_form LIKE ?) ORDER BY nama_form LIMIT 1000");
    let rows = sqlx::query_as(&sql)
        .bind(&q.status).bind(&q.status).bind(&q.unit).bind(&q.unit).bind(&qs).bind(&qs).bind(&qs)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct FrmBody {
    #[serde(default)] pub kode_form: Option<String>, pub nama_form: String, #[serde(default)] pub unit: Option<String>,
    #[serde(default)] pub versi: Option<String>, #[serde(default)] pub tgl_terbit: Option<String>, #[serde(default)] pub tgl_reviu: Option<String>,
    #[serde(default)] pub status: Option<String>, #[serde(default)] pub hasil_evaluasi: Option<String>, #[serde(default)] pub direview_oleh: Option<String>, #[serde(default)] pub catatan: Option<String>,
}
pub async fn frm_create(u: AuthUser, State(s): State<AppState>, Json(b): Json<FrmBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.nama_form.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Nama formulir wajib"})))); }
    let r = sqlx::query(
        "INSERT INTO simrscb_formulir_rm (kode_form,nama_form,unit,versi,tgl_terbit,tgl_reviu,status,hasil_evaluasi,direview_oleh,catatan) \
         VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(&b.kode_form).bind(b.nama_form.trim()).bind(&b.unit).bind(&b.versi)
        .bind(opt_date(&b.tgl_terbit)).bind(opt_date(&b.tgl_reviu)).bind(b.status.as_deref().unwrap_or("Aktif"))
        .bind(&b.hasil_evaluasi).bind(&b.direview_oleh).bind(&b.catatan)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}
pub async fn frm_update(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>, Json(b): Json<FrmBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query(
        "UPDATE simrscb_formulir_rm SET kode_form=?,nama_form=?,unit=?,versi=?,tgl_terbit=?,tgl_reviu=?,status=COALESCE(?,status),hasil_evaluasi=?,direview_oleh=?,catatan=?,updated_at=NOW() WHERE id=?")
        .bind(&b.kode_form).bind(b.nama_form.trim()).bind(&b.unit).bind(&b.versi)
        .bind(opt_date(&b.tgl_terbit)).bind(opt_date(&b.tgl_reviu)).bind(&b.status)
        .bind(&b.hasil_evaluasi).bind(&b.direview_oleh).bind(&b.catatan).bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
pub async fn frm_delete(u: AuthUser, State(s): State<AppState>, Path(id): Path<i32>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_formulir_rm WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── #5 Audit Akses & Hak Akses (baca-saja) ───────────────────────────────────
fn require_view_akses(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if u.0.is_admin || has_perm(u, "mrmik_edit") { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Perlu Admin / izin mrmik_edit"})))) }
}
#[derive(Deserialize)]
pub struct LoginQ { pub tgl_awal: Option<String>, pub tgl_akhir: Option<String>, pub nip: Option<String> }
pub async fn akses_login(u: AuthUser, State(s): State<AppState>, Query(q): Query<LoginQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_view_akses(&u)?;
    let nipq = q.nip.as_deref().filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim()));
    #[derive(sqlx::FromRow)] struct L { nip: Option<String>, nama: Option<String>, tgl_login: Option<String>, jam_login: Option<String> }
    let rows: Vec<L> = sqlx::query_as(
        "SELECT t.nip, pg.nama, DATE_FORMAT(t.tgl_login,'%Y-%m-%d') tgl_login, TIME_FORMAT(t.jam_login,'%H:%i:%s') jam_login \
         FROM tracker t LEFT JOIN pegawai pg ON pg.nik = t.nip \
         WHERE (? IS NULL OR t.tgl_login >= ?) AND (? IS NULL OR t.tgl_login <= ?) AND (? IS NULL OR t.nip LIKE ?) \
         ORDER BY t.tgl_login DESC, t.jam_login DESC LIMIT 500")
        .bind(opt_date(&q.tgl_awal)).bind(opt_date(&q.tgl_awal))
        .bind(opt_date(&q.tgl_akhir)).bind(opt_date(&q.tgl_akhir))
        .bind(&nipq).bind(&nipq)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    let list: Vec<Value> = rows.iter().map(|r| json!({"nip": r.nip, "nama": r.nama, "tgl_login": r.tgl_login, "jam_login": r.jam_login})).collect();
    Ok(Json(json!({"login": list})))
}
// Daftar hak akses: user + jumlah izin web aktif (simrscb_user_permissions).
pub async fn akses_hak(u: AuthUser, State(s): State<AppState>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_view_akses(&u)?;
    #[derive(sqlx::FromRow)] struct HR { nip: Option<String>, nama: Option<String>, jml_izin: i64, terakhir: Option<String> }
    let rows: Vec<HR> = sqlx::query_as(
        "SELECT nik nip, nama, \
                (SELECT COUNT(*) FROM simrscb_user_permissions up WHERE up.nip=x.nik AND up.enabled=1) jml_izin, \
                (SELECT DATE_FORMAT(MAX(tgl_login),'%Y-%m-%d') FROM tracker t WHERE t.nip=x.nik) terakhir \
         FROM (SELECT CAST(AES_DECRYPT(u.id_user,'nur') AS CHAR) nik, p.nama nama \
               FROM user u LEFT JOIN pegawai p ON p.nik = CAST(AES_DECRYPT(u.id_user,'nur') AS CHAR)) x \
         WHERE x.nik IS NOT NULL AND x.nik<>'' ORDER BY x.nama LIMIT 1000")
        .fetch_all(&s.pool).await.map_err(db_err)?;
    let list: Vec<Value> = rows.iter().map(|r| json!({"nip": r.nip, "nama": r.nama, "jml_izin": r.jml_izin, "login_terakhir": r.terakhir})).collect();
    Ok(Json(json!({"users": list})))
}

// 'YYYY-MM-DD' (atau kosong) → Option; kosong/invalid → None supaya kolom tetap NULL.
fn opt_date(s: &Option<String>) -> Option<String> {
    s.as_deref().map(|x| x.trim()).filter(|x| x.len() >= 8).map(|x| x.to_string())
}
