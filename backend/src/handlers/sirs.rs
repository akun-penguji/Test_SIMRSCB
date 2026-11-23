use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Html,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

// ─────────────────────────────────────────────────────────────────────────────
// RL 1.1 — Profil Rumah Sakit
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct Rl11Resp {
    // Dari `setting` Khanza (read-only)
    pub nama_instansi:    Option<String>,
    pub alamat_instansi:  Option<String>,
    pub kabupaten:        Option<String>,
    pub propinsi:         Option<String>,
    pub kontak:           Option<String>,   // → no_telp_call_center (fallback)
    pub email:            Option<String>,

    // Dari `sirs_rl11_profil` (editable)
    pub data: Option<Rl11Profil>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl11Profil {
    // Section A
    pub tahun_berdiri:           Option<i32>,
    pub nama_direktur:           Option<String>,
    pub jenis_rs:                Option<String>,
    pub kelas_rs:                Option<String>,
    pub status_blu:              Option<String>,
    pub kepemilikan:             Option<String>,
    pub nama_penyelenggara:      Option<String>,
    pub kerjasama_bpjs:          Option<String>,
    pub luas_tanah_m2:           Option<i32>,
    pub luas_bangunan_m2:        Option<i32>,
    pub no_call_center:          Option<String>,
    pub website:                 Option<String>,

    // Section B
    pub no_sio:                      Option<String>,
    pub tgl_sio:                     Option<String>,
    pub tgl_berlaku_sio:             Option<String>,
    pub file_sio:                    Option<String>,
    pub pentahapan_akreditasi:       Option<String>,
    pub tgl_penetapan_akreditasi:    Option<String>,
    pub tgl_berlaku_akreditasi:      Option<String>,
    pub file_akreditasi:             Option<String>,
    pub akreditasi_internasional:    Option<String>,
    pub rs_pendidikan:               Option<String>,
    pub no_sk_pendidikan:            Option<String>,
    pub tgl_sk_pendidikan:           Option<String>,
    pub no_sk_tt:                    Option<String>,
    pub tgl_sk_tt:                   Option<String>,
    pub file_sk_tt:                  Option<String>,
    pub ipwl:                        Option<String>,
    pub no_sk_ipwl:                  Option<String>,
    pub tgl_sk_ipwl:                 Option<String>,
    pub file_tarif_layanan:          Option<String>,

    // Section C
    pub layanan_unggulan:        Option<String>,
    pub simrs_kondisi:           Option<String>,
    pub pelayanan_darah:         Option<String>,
    pub komite_transfusi_darah:  Option<String>,
    pub audit_pelayanan_darah:   Option<String>,
    pub latitude:                Option<f64>,
    pub longitude:               Option<f64>,
    pub nama_ka_ifrs:            Option<String>,
    pub telp_ka_ifrs:            Option<String>,
    pub email_ka_ifrs:           Option<String>,
    pub kerjasama_psef:          Option<String>,
    pub kerjasama_fk_fkg:        Option<String>,

    // Section D — Foto
    pub foto_tampak_depan:       Option<String>,
    pub foto_ruang_ralan:        Option<String>,
    pub foto_ruang_ranap:        Option<String>,
    pub foto_ruang_igd:          Option<String>,
    pub foto_alkes:              Option<String>,

    // Section F — Profil SIMRS dasar
    pub simrs_jenis_vendor:      Option<String>,
    pub simrs_nama_developer:    Option<String>,
    pub simrs_akses_internet:    Option<String>,
    pub simrs_pic_nama:          Option<String>,
    pub simrs_pic_nik:           Option<String>,
    pub simrs_pic_email:         Option<String>,
    pub simrs_pic_telp:          Option<String>,
    pub simrs_pic_jabatan:       Option<String>,

    pub updated_at:              Option<String>,
    pub updated_by:              Option<String>,
}

// Section E — Kerja Sama Luar Negeri (repeatable)
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct KerjasamaLn {
    pub id:             Option<i64>,
    pub nama_institusi: String,
    pub negara:         String,
    pub area:           Option<String>,
    pub output_kerja:   Option<String>,
    pub bentuk:         Option<String>,    // CSV
    pub keterangan:     Option<String>,
    pub tgl_mulai:      Option<String>,
    pub tgl_akhir:      Option<String>,
}

// Section F — SIMRS modul checklist
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SimrsModul {
    pub id:           i32,
    pub kategori:     String,
    pub sub_kategori: Option<String>,
    pub modul:        String,
    pub ada:          i8,
}

// Setting Khanza row (dipakai di GET dan cetak)
#[derive(sqlx::FromRow)]
struct SettingRow {
    nama_instansi:   Option<String>,
    alamat_instansi: Option<String>,
    kabupaten:       Option<String>,
    propinsi:        Option<String>,
    kontak:          Option<String>,
    email:           Option<String>,
}

// ── GET /api/sirs/rl/1-1 ─────────────────────────────────────────────────────
pub async fn get_rl11(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Rl11Resp>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let data: Option<Rl11Profil> = sqlx::query_as(
        "SELECT tahun_berdiri, nama_direktur, jenis_rs, kelas_rs, status_blu,
                kepemilikan, nama_penyelenggara, kerjasama_bpjs,
                luas_tanah_m2, luas_bangunan_m2, no_call_center, website,
                no_sio, DATE_FORMAT(tgl_sio,'%Y-%m-%d') AS tgl_sio,
                DATE_FORMAT(tgl_berlaku_sio,'%Y-%m-%d') AS tgl_berlaku_sio,
                file_sio, pentahapan_akreditasi,
                DATE_FORMAT(tgl_penetapan_akreditasi,'%Y-%m-%d') AS tgl_penetapan_akreditasi,
                DATE_FORMAT(tgl_berlaku_akreditasi,'%Y-%m-%d')   AS tgl_berlaku_akreditasi,
                file_akreditasi, akreditasi_internasional, rs_pendidikan,
                no_sk_pendidikan, DATE_FORMAT(tgl_sk_pendidikan,'%Y-%m-%d') AS tgl_sk_pendidikan,
                no_sk_tt, DATE_FORMAT(tgl_sk_tt,'%Y-%m-%d') AS tgl_sk_tt,
                file_sk_tt, ipwl,
                no_sk_ipwl, DATE_FORMAT(tgl_sk_ipwl,'%Y-%m-%d') AS tgl_sk_ipwl,
                file_tarif_layanan,
                layanan_unggulan, simrs_kondisi, pelayanan_darah,
                komite_transfusi_darah, audit_pelayanan_darah,
                CAST(latitude AS DOUBLE) AS latitude, CAST(longitude AS DOUBLE) AS longitude,
                nama_ka_ifrs, telp_ka_ifrs, email_ka_ifrs,
                kerjasama_psef, kerjasama_fk_fkg,
                foto_tampak_depan, foto_ruang_ralan, foto_ruang_ranap,
                foto_ruang_igd, foto_alkes,
                simrs_jenis_vendor, simrs_nama_developer, simrs_akses_internet,
                simrs_pic_nama, simrs_pic_nik, simrs_pic_email,
                simrs_pic_telp, simrs_pic_jabatan,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl11_profil WHERE id = 1 LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    Ok(Json(Rl11Resp {
        nama_instansi:    setting.as_ref().and_then(|s| s.nama_instansi.clone()),
        alamat_instansi:  setting.as_ref().and_then(|s| s.alamat_instansi.clone()),
        kabupaten:        setting.as_ref().and_then(|s| s.kabupaten.clone()),
        propinsi:         setting.as_ref().and_then(|s| s.propinsi.clone()),
        kontak:           setting.as_ref().and_then(|s| s.kontak.clone()),
        email:            setting.as_ref().and_then(|s| s.email.clone()),
        data,
    }))
}

// ── PUT /api/sirs/rl/1-1 ─────────────────────────────────────────────────────
// Section A/B/C/D/F field profil ditangani di sini. Section E (kerjasama_ln)
// dan modul checklist punya endpoint terpisah.
pub async fn edit_rl11(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<Rl11Profil>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Approach: bangun query update dgn semua field. Karena field-nya banyak
    // (54), pakai 1 UPSERT besar. Untuk maintainability, daftarkan kolom di
    // const array.
    sqlx::query(
        "UPDATE sirs_rl11_profil SET
           tahun_berdiri=?, nama_direktur=?, jenis_rs=?, kelas_rs=?, status_blu=?,
           kepemilikan=?, nama_penyelenggara=?, kerjasama_bpjs=?,
           luas_tanah_m2=?, luas_bangunan_m2=?, no_call_center=?, website=?,
           no_sio=?, tgl_sio=?, tgl_berlaku_sio=?, file_sio=?,
           pentahapan_akreditasi=?, tgl_penetapan_akreditasi=?,
           tgl_berlaku_akreditasi=?, file_akreditasi=?,
           akreditasi_internasional=?, rs_pendidikan=?,
           no_sk_pendidikan=?, tgl_sk_pendidikan=?,
           no_sk_tt=?, tgl_sk_tt=?, file_sk_tt=?,
           ipwl=?, no_sk_ipwl=?, tgl_sk_ipwl=?, file_tarif_layanan=?,
           layanan_unggulan=?, simrs_kondisi=?, pelayanan_darah=?,
           komite_transfusi_darah=?, audit_pelayanan_darah=?,
           latitude=?, longitude=?,
           nama_ka_ifrs=?, telp_ka_ifrs=?, email_ka_ifrs=?,
           kerjasama_psef=?, kerjasama_fk_fkg=?,
           foto_tampak_depan=?, foto_ruang_ralan=?, foto_ruang_ranap=?,
           foto_ruang_igd=?, foto_alkes=?,
           simrs_jenis_vendor=?, simrs_nama_developer=?, simrs_akses_internet=?,
           simrs_pic_nama=?, simrs_pic_nik=?, simrs_pic_email=?,
           simrs_pic_telp=?, simrs_pic_jabatan=?,
           updated_by=?
         WHERE id=1"
    )
    .bind(body.tahun_berdiri)
    .bind(body.nama_direktur.as_deref()).bind(body.jenis_rs.as_deref())
    .bind(body.kelas_rs.as_deref()).bind(body.status_blu.as_deref())
    .bind(body.kepemilikan.as_deref()).bind(body.nama_penyelenggara.as_deref())
    .bind(body.kerjasama_bpjs.as_deref())
    .bind(body.luas_tanah_m2).bind(body.luas_bangunan_m2)
    .bind(body.no_call_center.as_deref()).bind(body.website.as_deref())
    .bind(body.no_sio.as_deref()).bind(body.tgl_sio.as_deref())
    .bind(body.tgl_berlaku_sio.as_deref()).bind(body.file_sio.as_deref())
    .bind(body.pentahapan_akreditasi.as_deref())
    .bind(body.tgl_penetapan_akreditasi.as_deref())
    .bind(body.tgl_berlaku_akreditasi.as_deref())
    .bind(body.file_akreditasi.as_deref())
    .bind(body.akreditasi_internasional.as_deref())
    .bind(body.rs_pendidikan.as_deref())
    .bind(body.no_sk_pendidikan.as_deref()).bind(body.tgl_sk_pendidikan.as_deref())
    .bind(body.no_sk_tt.as_deref()).bind(body.tgl_sk_tt.as_deref())
    .bind(body.file_sk_tt.as_deref())
    .bind(body.ipwl.as_deref()).bind(body.no_sk_ipwl.as_deref())
    .bind(body.tgl_sk_ipwl.as_deref()).bind(body.file_tarif_layanan.as_deref())
    .bind(body.layanan_unggulan.as_deref()).bind(body.simrs_kondisi.as_deref())
    .bind(body.pelayanan_darah.as_deref())
    .bind(body.komite_transfusi_darah.as_deref())
    .bind(body.audit_pelayanan_darah.as_deref())
    .bind(body.latitude).bind(body.longitude)
    .bind(body.nama_ka_ifrs.as_deref()).bind(body.telp_ka_ifrs.as_deref())
    .bind(body.email_ka_ifrs.as_deref())
    .bind(body.kerjasama_psef.as_deref()).bind(body.kerjasama_fk_fkg.as_deref())
    // Section D
    .bind(body.foto_tampak_depan.as_deref()).bind(body.foto_ruang_ralan.as_deref())
    .bind(body.foto_ruang_ranap.as_deref()).bind(body.foto_ruang_igd.as_deref())
    .bind(body.foto_alkes.as_deref())
    // Section F
    .bind(body.simrs_jenis_vendor.as_deref()).bind(body.simrs_nama_developer.as_deref())
    .bind(body.simrs_akses_internet.as_deref())
    .bind(body.simrs_pic_nama.as_deref()).bind(body.simrs_pic_nik.as_deref())
    .bind(body.simrs_pic_email.as_deref())
    .bind(body.simrs_pic_telp.as_deref()).bind(body.simrs_pic_jabatan.as_deref())
    .bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;

    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl11_profil SET nama_direktur={}, kelas_rs={}, updated_by={} WHERE id=1",
        crate::audit::qo(body.nama_direktur.as_deref()),
        crate::audit::qo(body.kelas_rs.as_deref()),
        crate::audit::q(&user.0.kode))).await;

    Ok(Json(json!({ "success": true })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Section E — Kerja Sama Luar Negeri CRUD
// ─────────────────────────────────────────────────────────────────────────────

pub async fn list_kerjasama_ln(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<KerjasamaLn>>, (StatusCode, Json<Value>)> {
    let rows: Vec<KerjasamaLn> = sqlx::query_as(
        "SELECT id, nama_institusi, negara, area, output_kerja, bentuk, keterangan,
                DATE_FORMAT(tgl_mulai,'%Y-%m-%d') AS tgl_mulai,
                DATE_FORMAT(tgl_akhir,'%Y-%m-%d') AS tgl_akhir
         FROM sirs_rl11_kerjasama_ln ORDER BY id"
    ).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

pub async fn create_kerjasama_ln(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<KerjasamaLn>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "INSERT INTO sirs_rl11_kerjasama_ln
           (nama_institusi, negara, area, output_kerja, bentuk, keterangan, tgl_mulai, tgl_akhir)
         VALUES (?,?,?,?,?,?,?,?)"
    )
    .bind(&body.nama_institusi).bind(&body.negara)
    .bind(body.area.as_deref()).bind(body.output_kerja.as_deref())
    .bind(body.bentuk.as_deref()).bind(body.keterangan.as_deref())
    .bind(body.tgl_mulai.as_deref()).bind(body.tgl_akhir.as_deref())
    .execute(&state.pool).await.map_err(db_err)?;

    let new_id = res.last_insert_id() as i64;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO sirs_rl11_kerjasama_ln (id, nama_institusi, negara) VALUES ({}, {}, {})",
        crate::audit::q(new_id),
        crate::audit::q(&body.nama_institusi),
        crate::audit::q(&body.negara))).await;

    Ok(Json(json!({ "success": true, "id": new_id })))
}

pub async fn update_kerjasama_ln(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(body): Json<KerjasamaLn>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl11_kerjasama_ln SET
           nama_institusi=?, negara=?, area=?, output_kerja=?, bentuk=?,
           keterangan=?, tgl_mulai=?, tgl_akhir=?
         WHERE id=?"
    )
    .bind(&body.nama_institusi).bind(&body.negara)
    .bind(body.area.as_deref()).bind(body.output_kerja.as_deref())
    .bind(body.bentuk.as_deref()).bind(body.keterangan.as_deref())
    .bind(body.tgl_mulai.as_deref()).bind(body.tgl_akhir.as_deref())
    .bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Kerjasama tidak ditemukan"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl11_kerjasama_ln SET nama_institusi={}, negara={} WHERE id={}",
        crate::audit::q(&body.nama_institusi),
        crate::audit::q(&body.negara),
        crate::audit::q(id))).await;
    Ok(Json(json!({ "success": true })))
}

pub async fn delete_kerjasama_ln(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query("DELETE FROM sirs_rl11_kerjasama_ln WHERE id=?")
        .bind(id).execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Kerjasama tidak ditemukan"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "DELETE FROM sirs_rl11_kerjasama_ln WHERE id={}", crate::audit::q(id))).await;
    Ok(Json(json!({ "success": true })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Section F — SIMRS modul checklist
// ─────────────────────────────────────────────────────────────────────────────

pub async fn list_simrs_modul(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<SimrsModul>>, (StatusCode, Json<Value>)> {
    let rows: Vec<SimrsModul> = sqlx::query_as(
        "SELECT id, kategori, sub_kategori, modul, ada
         FROM sirs_rl11_simrs_modul ORDER BY id"
    ).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct ToggleModulBody { pub ada: bool }

pub async fn toggle_simrs_modul(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<ToggleModulBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query("UPDATE sirs_rl11_simrs_modul SET ada=? WHERE id=?")
        .bind(if body.ada { 1 } else { 0 })
        .bind(id)
        .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Modul tidak ditemukan"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl11_simrs_modul SET ada={} WHERE id={}",
        crate::audit::q(if body.ada { 1 } else { 0 }),
        crate::audit::q(id))).await;
    Ok(Json(json!({ "success": true })))
}

// ─────────────────────────────────────────────────────────────────────────────
// Cetak HTML RL 1.1 (format mirip JUKNIS)
// ─────────────────────────────────────────────────────────────────────────────

pub async fn cetak_rl11(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let data: Option<Rl11Profil> = sqlx::query_as(
        "SELECT tahun_berdiri, nama_direktur, jenis_rs, kelas_rs, status_blu,
                kepemilikan, nama_penyelenggara, kerjasama_bpjs,
                luas_tanah_m2, luas_bangunan_m2, no_call_center, website,
                no_sio, DATE_FORMAT(tgl_sio,'%d-%m-%Y') AS tgl_sio,
                DATE_FORMAT(tgl_berlaku_sio,'%d-%m-%Y') AS tgl_berlaku_sio,
                file_sio, pentahapan_akreditasi,
                DATE_FORMAT(tgl_penetapan_akreditasi,'%d-%m-%Y') AS tgl_penetapan_akreditasi,
                DATE_FORMAT(tgl_berlaku_akreditasi,'%d-%m-%Y')   AS tgl_berlaku_akreditasi,
                file_akreditasi, akreditasi_internasional, rs_pendidikan,
                no_sk_pendidikan, DATE_FORMAT(tgl_sk_pendidikan,'%d-%m-%Y') AS tgl_sk_pendidikan,
                no_sk_tt, DATE_FORMAT(tgl_sk_tt,'%d-%m-%Y') AS tgl_sk_tt,
                file_sk_tt, ipwl,
                no_sk_ipwl, DATE_FORMAT(tgl_sk_ipwl,'%d-%m-%Y') AS tgl_sk_ipwl,
                file_tarif_layanan,
                layanan_unggulan, simrs_kondisi, pelayanan_darah,
                komite_transfusi_darah, audit_pelayanan_darah,
                CAST(latitude AS DOUBLE) AS latitude, CAST(longitude AS DOUBLE) AS longitude,
                nama_ka_ifrs, telp_ka_ifrs, email_ka_ifrs,
                kerjasama_psef, kerjasama_fk_fkg,
                foto_tampak_depan, foto_ruang_ralan, foto_ruang_ranap,
                foto_ruang_igd, foto_alkes,
                simrs_jenis_vendor, simrs_nama_developer, simrs_akses_internet,
                simrs_pic_nama, simrs_pic_nik, simrs_pic_email,
                simrs_pic_telp, simrs_pic_jabatan,
                DATE_FORMAT(updated_at,'%d-%m-%Y %H:%i') AS updated_at,
                updated_by
         FROM sirs_rl11_profil WHERE id=1 LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let kerjasama: Vec<KerjasamaLn> = sqlx::query_as(
        "SELECT id, nama_institusi, negara, area, output_kerja, bentuk, keterangan,
                DATE_FORMAT(tgl_mulai,'%d-%m-%Y') AS tgl_mulai,
                DATE_FORMAT(tgl_akhir,'%d-%m-%Y') AS tgl_akhir
         FROM sirs_rl11_kerjasama_ln ORDER BY id"
    ).fetch_all(&state.pool).await.map_err(db_err)?;

    let moduls: Vec<SimrsModul> = sqlx::query_as(
        "SELECT id, kategori, sub_kategori, modul, ada
         FROM sirs_rl11_simrs_modul ORDER BY id"
    ).fetch_all(&state.pool).await.map_err(db_err)?;

    let html = build_cetak_html(setting.as_ref(), data.as_ref(), &kerjasama, &moduls);
    Ok(Html(html))
}

// Implement SettingFields untuk SettingRow lokal
impl SettingFields for SettingRow {
    fn nama_instansi(&self) -> Option<&str> { self.nama_instansi.as_deref() }
    fn alamat(&self)        -> Option<&str> { self.alamat_instansi.as_deref() }
    fn kabupaten(&self)     -> Option<&str> { self.kabupaten.as_deref() }
    fn propinsi(&self)      -> Option<&str> { self.propinsi.as_deref() }
    fn kontak(&self)        -> Option<&str> { self.kontak.as_deref() }
    fn email(&self)         -> Option<&str> { self.email.as_deref() }
}

fn build_cetak_html(
    setting:  Option<&SettingRow>,
    data:     Option<&Rl11Profil>,
    ks:       &[KerjasamaLn],
    moduls:   &[SimrsModul],
) -> String {
    let n  = |o: Option<&str>| o.unwrap_or("-").to_string();
    let opt_i = |o: Option<i32>| o.map(|v| v.to_string()).unwrap_or_else(|| "-".to_string());
    let opt_f = |o: Option<f64>| o.map(|v| format!("{:.7}", v)).unwrap_or_else(|| "-".to_string());

    let nm = setting.and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let kt = setting.and_then(SettingFields::kontak).unwrap_or("-").to_string();
    let em = setting.and_then(SettingFields::email).unwrap_or("-").to_string();

    let d = data;
    let g = |f: fn(&Rl11Profil) -> Option<&str>| -> String {
        d.and_then(|x| f(x).map(|s| s.to_string())).unwrap_or_else(|| "-".to_string())
    };

    // Section A
    let mut a_rows = String::new();
    a_rows.push_str(&row_tbl(1,  "Nama Fasyankes",     &esc(&nm)));
    a_rows.push_str(&row_tbl(2,  "Tahun Berdiri",      &esc(&d.and_then(|x| x.tahun_berdiri).map(|v| v.to_string()).unwrap_or_else(|| "-".to_string()))));
    a_rows.push_str(&row_tbl(3,  "Nama Direktur",      &esc(&g(|x| x.nama_direktur.as_deref()))));
    a_rows.push_str(&row_tbl(4,  "Jenis RS",           &esc(&g(|x| x.jenis_rs.as_deref()))));
    a_rows.push_str(&row_tbl(5,  "Kelas",              &esc(&g(|x| x.kelas_rs.as_deref()))));
    a_rows.push_str(&row_tbl(6,  "Status BLU",         &esc(&g(|x| x.status_blu.as_deref()))));
    a_rows.push_str(&row_tbl(7,  "Kepemilikan",        &esc(&g(|x| x.kepemilikan.as_deref()))));
    a_rows.push_str(&row_tbl(8,  "Nama Penyelenggara", &esc(&g(|x| x.nama_penyelenggara.as_deref()))));
    a_rows.push_str(&row_tbl(9,  "Kerja sama BPJS",    &esc(&g(|x| x.kerjasama_bpjs.as_deref()))));
    a_rows.push_str(&row_tbl(10, "Alamat RS",          &esc(&al)));
    a_rows.push_str(&row_tbl(11, "Kab/Kota",           &esc(&format!("{}, {}", kb, pr))));
    a_rows.push_str(&row_tbl(12, "Luas Tanah (m²)",    &esc(&opt_i(d.and_then(|x| x.luas_tanah_m2)))));
    a_rows.push_str(&row_tbl(13, "Luas Bangunan (m²)", &esc(&opt_i(d.and_then(|x| x.luas_bangunan_m2)))));
    a_rows.push_str(&row_tbl(14, "Nomor Telepon",      &esc(&{
        let cc = g(|x| x.no_call_center.as_deref());
        if cc == "-" { kt.clone() } else { cc }
    })));
    a_rows.push_str(&row_tbl(15, "Email",              &esc(&em)));
    a_rows.push_str(&row_tbl(16, "Website",            &esc(&g(|x| x.website.as_deref()))));

    // Section B
    let mut b_rows = String::new();
    b_rows.push_str(&row_tbl(1,  "No. Surat Izin Operasional",      &esc(&g(|x| x.no_sio.as_deref()))));
    b_rows.push_str(&row_tbl(2,  "Tanggal Surat Izin Operasional",  &esc(&g(|x| x.tgl_sio.as_deref()))));
    b_rows.push_str(&row_tbl(3,  "Tanggal Berlaku SIO",              &esc(&g(|x| x.tgl_berlaku_sio.as_deref()))));
    b_rows.push_str(&row_tbl(4,  "Dokumen Surat Izin Operasional",  &esc(&g(|x| x.file_sio.as_deref()))));
    b_rows.push_str(&row_tbl(5,  "Pentahapan Akreditasi Nasional",   &esc(&g(|x| x.pentahapan_akreditasi.as_deref()))));
    b_rows.push_str(&row_tbl(6,  "Tanggal Penetapan Akreditasi",     &esc(&g(|x| x.tgl_penetapan_akreditasi.as_deref()))));
    b_rows.push_str(&row_tbl(7,  "Tanggal Berlaku Akreditasi",       &esc(&g(|x| x.tgl_berlaku_akreditasi.as_deref()))));
    b_rows.push_str(&row_tbl(8,  "Dokumen Akreditasi",               &esc(&g(|x| x.file_akreditasi.as_deref()))));
    b_rows.push_str(&row_tbl(9,  "Akreditasi Internasional",         &esc(&g(|x| x.akreditasi_internasional.as_deref()))));
    b_rows.push_str(&row_tbl(10, "RS Pendidikan",                    &esc(&g(|x| x.rs_pendidikan.as_deref()))));
    b_rows.push_str(&row_tbl(11, "No. SK RS Pendidikan",             &esc(&g(|x| x.no_sk_pendidikan.as_deref()))));
    b_rows.push_str(&row_tbl(12, "Tanggal SK RS Pendidikan",         &esc(&g(|x| x.tgl_sk_pendidikan.as_deref()))));
    b_rows.push_str(&row_tbl(13, "Nomor SK Tempat Tidur",            &esc(&g(|x| x.no_sk_tt.as_deref()))));
    b_rows.push_str(&row_tbl(14, "Tanggal SK Tempat Tidur",          &esc(&g(|x| x.tgl_sk_tt.as_deref()))));
    b_rows.push_str(&row_tbl(15, "Dokumen SK Tempat Tidur",          &esc(&g(|x| x.file_sk_tt.as_deref()))));
    b_rows.push_str(&row_tbl(16, "Institusi Penerima Wajib Lapor",   &esc(&g(|x| x.ipwl.as_deref()))));
    b_rows.push_str(&row_tbl(17, "No. SK Menkes IPWL",               &esc(&g(|x| x.no_sk_ipwl.as_deref()))));
    b_rows.push_str(&row_tbl(18, "Tanggal SK IPWL",                  &esc(&g(|x| x.tgl_sk_ipwl.as_deref()))));
    b_rows.push_str(&row_tbl(19, "Dokumen Tarif Layanan RS",         &esc(&g(|x| x.file_tarif_layanan.as_deref()))));

    // Section C
    let mut c_rows = String::new();
    c_rows.push_str(&row_tbl(1,  "Layanan Unggulan",                 &esc(&g(|x| x.layanan_unggulan.as_deref()))));
    c_rows.push_str(&row_tbl(2,  "SIMRS",                            &esc(&g(|x| x.simrs_kondisi.as_deref()))));
    c_rows.push_str(&row_tbl(3,  "Pelayanan Darah",                  &esc(&g(|x| x.pelayanan_darah.as_deref()))));
    c_rows.push_str(&row_tbl(4,  "Komite/Panitia Transfusi Darah",   &esc(&g(|x| x.komite_transfusi_darah.as_deref()))));
    c_rows.push_str(&row_tbl(5,  "Audit Penyelenggaraan Pel. Darah", &esc(&g(|x| x.audit_pelayanan_darah.as_deref()))));
    c_rows.push_str(&row_tbl(6,  "Latitude",                         &esc(&opt_f(d.and_then(|x| x.latitude)))));
    c_rows.push_str(&row_tbl(7,  "Longitude",                        &esc(&opt_f(d.and_then(|x| x.longitude)))));
    c_rows.push_str(&row_tbl(8,  "Nama Kepala Instalasi Farmasi",    &esc(&g(|x| x.nama_ka_ifrs.as_deref()))));
    c_rows.push_str(&row_tbl(9,  "No. Telp / HP Ka. IFRS",           &esc(&g(|x| x.telp_ka_ifrs.as_deref()))));
    c_rows.push_str(&row_tbl(10, "Email Ka. IFRS",                   &esc(&g(|x| x.email_ka_ifrs.as_deref()))));
    c_rows.push_str(&row_tbl(11, "Kerjasama dengan PSEF",            &esc(&g(|x| x.kerjasama_psef.as_deref()))));
    c_rows.push_str(&row_tbl(12, "Kerjasama dgn FK/FKG & Inst. Pendidikan",
        &esc(&g(|x| x.kerjasama_fk_fkg.as_deref())).replace('\n', "<br/>")));

    // Section D — foto thumbnails (preview paths)
    let foto_row = |no: u32, label: &str, path: Option<&str>| -> String {
        let pstr = path.unwrap_or("");
        let img = if pstr.is_empty() {
            "<span style='color:#999'>(belum ada)</span>".to_string()
        } else {
            format!("<span class=\"mono\">{}</span>", esc(pstr))
        };
        format!("<tr><td class=\"no\">{}</td><td class=\"k\">{}</td><td>{}</td></tr>", no, esc(label), img)
    };
    let d_rows = format!("{}{}{}{}{}",
        foto_row(1, "Foto Tampak Depan RS",        d.and_then(|x| x.foto_tampak_depan.as_deref())),
        foto_row(2, "Foto Ruang Pelayanan Ralan",  d.and_then(|x| x.foto_ruang_ralan.as_deref())),
        foto_row(3, "Foto Ruang Ranap",            d.and_then(|x| x.foto_ruang_ranap.as_deref())),
        foto_row(4, "Foto Ruang IGD",              d.and_then(|x| x.foto_ruang_igd.as_deref())),
        foto_row(5, "Foto Alat Kesehatan",         d.and_then(|x| x.foto_alkes.as_deref())),
    );

    // Section E — Kerjasama LN table
    let mut e_rows = String::new();
    if ks.is_empty() {
        e_rows.push_str("<tr><td colspan=\"8\" style=\"text-align:center;color:#999\">Belum ada kerjasama LN tercatat.</td></tr>");
    } else {
        for (i, k) in ks.iter().enumerate() {
            e_rows.push_str(&format!(
                "<tr><td class=\"no\">{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>",
                i + 1, esc(&k.nama_institusi), esc(&k.negara),
                esc(k.area.as_deref().unwrap_or("-")),
                esc(k.output_kerja.as_deref().unwrap_or("-")).replace('\n', "<br/>"),
                esc(k.bentuk.as_deref().unwrap_or("-")),
                {
                    let m = k.tgl_mulai.as_deref().unwrap_or("-");
                    let a = k.tgl_akhir.as_deref().unwrap_or("-");
                    format!("{} s/d {}", esc(m), esc(a))
                },
                esc(k.keterangan.as_deref().unwrap_or("-")),
            ));
        }
    }

    // Section F — Profil SIMRS
    let mut f_rows = String::new();
    f_rows.push_str(&row_tbl_label("Jenis Vendor",          &esc(&g(|x| x.simrs_jenis_vendor.as_deref()))));
    f_rows.push_str(&row_tbl_label("Nama Developer/Pengembang", &esc(&g(|x| x.simrs_nama_developer.as_deref()))));
    f_rows.push_str(&row_tbl_label("Kondisi Akses Internet", &esc(&g(|x| x.simrs_akses_internet.as_deref()))));
    f_rows.push_str(&row_tbl_label("PIC Integrasi SATUSEHAT", &esc(&g(|x| x.simrs_pic_nama.as_deref()))));
    f_rows.push_str(&row_tbl_label("NIK PIC",                &esc(&g(|x| x.simrs_pic_nik.as_deref()))));
    f_rows.push_str(&row_tbl_label("Email Integrasi",        &esc(&g(|x| x.simrs_pic_email.as_deref()))));
    f_rows.push_str(&row_tbl_label("No. Telp / WA PIC",      &esc(&g(|x| x.simrs_pic_telp.as_deref()))));
    f_rows.push_str(&row_tbl_label("Jabatan PIC",            &esc(&g(|x| x.simrs_pic_jabatan.as_deref()))));

    // Modul checklist
    let mut modul_rows = String::new();
    let mut last_kat = String::new();
    let mut last_sub = String::new();
    for m in moduls {
        let kat = if m.kategori != last_kat { last_kat = m.kategori.clone(); &m.kategori } else { "" };
        let sub_default = String::new();
        let sub_val = m.sub_kategori.as_ref().unwrap_or(&sub_default);
        let sub = if *sub_val != last_sub { last_sub = sub_val.clone(); sub_val.as_str() } else { "" };
        let check = if m.ada != 0 { "✓" } else { "" };
        modul_rows.push_str(&format!(
            "<tr><td class=\"no\">{}</td><td>{}</td><td>{}</td><td>{}</td><td class=\"chk\">{}</td></tr>",
            m.id, esc(kat), esc(sub), esc(&m.modul), check
        ));
    }
    let _ = n; // suppress warning

    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();
    let updated = d.and_then(|x| x.updated_at.as_deref()).unwrap_or("(belum disimpan)");
    let updated_by = d.and_then(|x| x.updated_by.as_deref()).unwrap_or("-");

    format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 1.1 Profil RS — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:24px;font-size:11pt}}
  h1{{font-size:14pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:11pt;margin:0 0 16px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:9pt;color:#475569;text-align:center;margin-bottom:18px}}
  table{{width:100%;border-collapse:collapse;margin-top:6px;font-size:10pt}}
  th,td{{border:1px solid #94a3b8;padding:5px 8px;vertical-align:top}}
  th{{background:#f1f5f9;font-size:10pt;text-align:left}}
  td.no{{width:36px;text-align:center;font-weight:bold;background:#f8fafc}}
  td.k{{width:36%;background:#f8fafc;font-weight:600}}
  td.chk{{text-align:center;width:36px;font-weight:bold;color:#16a34a}}
  .section{{margin-top:20px}}
  .sec-title{{display:flex;align-items:center;gap:10px;background:#1e40af;color:#fff;padding:6px 12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:10pt}}
  .sec-title span.tag{{background:#fff;color:#1e40af;padding:2px 8px;border-radius:4px;font-size:9pt}}
  .mono{{font-family:'SF Mono',Menlo,monospace;font-size:9pt}}
  .footer{{margin-top:30px;font-size:9pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:10px}}
  @media print{{
    body{{margin:14mm}}
    .no-print{{display:none}}
    .section{{page-break-inside:avoid}}
  }}
  .toolbar{{position:sticky;top:0;background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 1.1 Profil RS</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 1.1 — Profil Rumah Sakit</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: Update saat ada perubahan ·
  Terakhir diubah {updated} oleh {updated_by} ·
  Tanggal cetak: {now}
</div>

<div class="section">
  <div class="sec-title"><span class="tag">A</span> Profil</div>
  <table><thead><tr><th class="no">No</th><th>Field</th><th>Nilai</th></tr></thead>
    <tbody>{a_rows}</tbody></table>
</div>

<div class="section">
  <div class="sec-title"><span class="tag">B</span> Perizinan dan Akreditasi</div>
  <table><thead><tr><th class="no">No</th><th>Field</th><th>Nilai</th></tr></thead>
    <tbody>{b_rows}</tbody></table>
</div>

<div class="section">
  <div class="sec-title"><span class="tag">C</span> Lainnya</div>
  <table><thead><tr><th class="no">No</th><th>Field</th><th>Nilai</th></tr></thead>
    <tbody>{c_rows}</tbody></table>
</div>

<div class="section">
  <div class="sec-title"><span class="tag">D</span> Photo</div>
  <table><thead><tr><th class="no">No</th><th>Jenis Foto</th><th>Path File</th></tr></thead>
    <tbody>{d_rows}</tbody></table>
</div>

<div class="section">
  <div class="sec-title"><span class="tag">E</span> Kerja Sama Luar Negeri</div>
  <table>
    <thead><tr>
      <th class="no">No</th><th>Institusi/RS LN</th><th>Negara</th>
      <th>Area Kerjasama</th><th>Output</th><th>Bentuk</th>
      <th>Periode</th><th>Keterangan / Kendala</th>
    </tr></thead>
    <tbody>{e_rows}</tbody>
  </table>
</div>

<div class="section">
  <div class="sec-title"><span class="tag">F</span> Profil SIMRS</div>
  <table><thead><tr><th>Field</th><th>Nilai</th></tr></thead>
    <tbody>{f_rows}</tbody></table>

  <table style="margin-top:10px">
    <thead><tr>
      <th class="no">No</th><th>Kategori</th><th>Sub Kategori</th>
      <th>Modul</th><th class="chk">Kondisi</th>
    </tr></thead>
    <tbody>{modul_rows}</tbody>
  </table>
</div>

<div class="footer">
  Dicetak otomatis dari sistem simrscb.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {prov}.<br/>
  Email: {email} · Telepon: {tel}
</div>

</body></html>"#,
        nama       = esc(&nm),
        updated    = esc(updated),
        updated_by = esc(updated_by),
        now        = esc(&now),
        alamat     = esc(&al),
        kab        = esc(&kb),
        prov       = esc(&pr),
        email      = esc(&em),
        tel        = esc(&kt),
        a_rows = a_rows,
        b_rows = b_rows,
        c_rows = c_rows,
        d_rows = d_rows,
        e_rows = e_rows,
        f_rows = f_rows,
        modul_rows = modul_rows,
    )
}

fn row_tbl(no: u32, key: &str, val: &str) -> String {
    format!("<tr><td class=\"no\">{}</td><td class=\"k\">{}</td><td>{}</td></tr>", no, esc(key), val)
}
fn row_tbl_label(key: &str, val: &str) -> String {
    format!("<tr><td class=\"k\">{}</td><td>{}</td></tr>", esc(key), val)
}
fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

// Trait helper utk akses field setting tanpa expose tipe lokal
trait SettingFields {
    fn nama_instansi(&self) -> Option<&str>;
    fn alamat(&self) -> Option<&str>;
    fn kabupaten(&self) -> Option<&str>;
    fn propinsi(&self) -> Option<&str>;
    fn kontak(&self) -> Option<&str>;
    fn email(&self) -> Option<&str>;
}
// Implementor di dalam fn cetak_rl11 — pakai struct lokal SettingRow yg sudah ada
// dalam fungsi tsb. Sederhana: definisikan helper trait di-impl di sini supaya
// build_cetak_html tetap generic. Tapi karena Rust visibility, kita pakai impl
// inline di bawah dgn struct yg sama.

// ── helper ──────────────────────────────────────────────────────────────────
fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error SIRS: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"Database error"})))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 1.2 — Ketersediaan Pelayanan
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl12Pelayanan {
    pub id:       i32,
    pub kat_no:   i8,
    pub kat_name: String,
    pub sub_no:   i8,
    pub sub_name: String,
    pub ada:      i8,
}

pub async fn list_rl12(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<Rl12Pelayanan>>, (StatusCode, Json<Value>)> {
    let rows: Vec<Rl12Pelayanan> = sqlx::query_as(
        "SELECT id, kat_no, kat_name, sub_no, sub_name, ada
         FROM sirs_rl12_pelayanan ORDER BY kat_no, sub_no"
    ).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

pub async fn toggle_rl12(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<ToggleModulBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query("UPDATE sirs_rl12_pelayanan SET ada=? WHERE id=?")
        .bind(if body.ada { 1 } else { 0 })
        .bind(id)
        .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Pelayanan tidak ditemukan"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl12_pelayanan SET ada={} WHERE id={}",
        crate::audit::q(if body.ada { 1 } else { 0 }),
        crate::audit::q(id))).await;
    Ok(Json(json!({ "success": true })))
}

pub async fn cetak_rl12(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let rows: Vec<Rl12Pelayanan> = sqlx::query_as(
        "SELECT id, kat_no, kat_name, sub_no, sub_name, ada
         FROM sirs_rl12_pelayanan ORDER BY kat_no, sub_no"
    ).fetch_all(&state.pool).await.map_err(db_err)?;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let kt = setting.as_ref().and_then(SettingFields::kontak).unwrap_or("-").to_string();
    let em = setting.as_ref().and_then(SettingFields::email).unwrap_or("-").to_string();

    let total = rows.len();
    let total_ada = rows.iter().filter(|r| r.ada != 0).count();

    // Group by kategori
    let mut tbody = String::new();
    let mut last_kat = 0i8;
    for r in &rows {
        if r.kat_no != last_kat {
            last_kat = r.kat_no;
            tbody.push_str(&format!(
                "<tr class=\"kat\"><td class=\"no\">{}</td><td colspan=\"3\"><strong>{}</strong></td></tr>",
                r.kat_no, esc(&r.kat_name)
            ));
        }
        let check = if r.ada != 0 { "✓" } else { "" };
        let cls = if r.ada != 0 { "y" } else { "" };
        tbody.push_str(&format!(
            "<tr class=\"{cls}\"><td></td><td class=\"sub\">{}</td><td>{}</td><td class=\"chk\">{}</td></tr>",
            r.sub_no, esc(&r.sub_name), check
        ));
    }

    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 1.2 Ketersediaan Pelayanan — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:24px;font-size:10.5pt}}
  h1{{font-size:14pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:11pt;margin:0 0 16px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:9pt;color:#475569;text-align:center;margin-bottom:18px}}
  table{{width:100%;border-collapse:collapse;font-size:10pt}}
  th,td{{border:1px solid #94a3b8;padding:4px 8px;vertical-align:top}}
  th{{background:#1e40af;color:#fff;font-size:10pt}}
  tr.kat td{{background:#dbeafe;font-size:10.5pt;color:#1e40af}}
  tr.y td{{background:#ecfdf5}}
  td.no{{width:42px;text-align:center;font-weight:bold}}
  td.sub{{width:48px;text-align:center;color:#64748b}}
  td.chk{{text-align:center;width:60px;font-weight:bold;color:#16a34a;font-size:13pt}}
  .footer{{margin-top:20px;font-size:9pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:10px}}
  @media print{{body{{margin:14mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
  .stat{{display:inline-block;background:#16a34a;color:#fff;padding:4px 12px;border-radius:4px;margin-left:6px}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 1.2 Ketersediaan Pelayanan</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 1.2 — Ketersediaan Pelayanan</h1>
<h2>{nama} <span class="stat">{total_ada}/{total} pelayanan</span></h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: Update saat ada perubahan ·
  Tanggal cetak: {now}
</div>

<table>
  <thead><tr>
    <th class="no">No</th><th class="sub">Sub</th>
    <th>Kategori / Pelayanan</th>
    <th class="chk">Ada</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Dicetak otomatis dari sistem simrscb.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {prov}.<br/>
  Email: {email} · Telepon: {tel}
</div>
</body></html>"#,
        nama = esc(&nm),
        total_ada = total_ada,
        total = total,
        now = esc(&now),
        alamat = esc(&al),
        kab = esc(&kb),
        prov = esc(&pr),
        email = esc(&em),
        tel = esc(&kt),
        tbody = tbody,
    );

    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 1.3 — Ketersediaan dan Keterpakaian Tempat Tidur
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl13Tt {
    pub id:           Option<i32>,
    pub kelas_tt:     String,
    pub ruangan:      String,
    pub jml_tersedia: i32,
    pub jml_terpakai: i32,
    pub catatan:      Option<String>,
    pub updated_at:   Option<String>,
    pub updated_by:   Option<String>,
}

pub async fn list_rl13(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<Rl13Tt>>, (StatusCode, Json<Value>)> {
    let rows: Vec<Rl13Tt> = sqlx::query_as(
        "SELECT id, kelas_tt, ruangan, jml_tersedia, jml_terpakai, catatan,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl13_tt ORDER BY kelas_tt, ruangan"
    ).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

pub async fn create_rl13(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<Rl13Tt>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if body.kelas_tt.trim().is_empty() || body.ruangan.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error":"Kelas TT & ruangan wajib"}))));
    }
    if body.jml_terpakai > body.jml_tersedia {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error":"Terpakai tidak boleh melebihi tersedia"}))));
    }
    if body.jml_tersedia < 0 || body.jml_terpakai < 0 {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error":"Jumlah TT tidak boleh negatif"}))));
    }

    let res = sqlx::query(
        "INSERT INTO sirs_rl13_tt
           (kelas_tt, ruangan, jml_tersedia, jml_terpakai, catatan, updated_by)
         VALUES (?,?,?,?,?,?)"
    )
    .bind(body.kelas_tt.trim())
    .bind(body.ruangan.trim())
    .bind(body.jml_tersedia)
    .bind(body.jml_terpakai)
    .bind(body.catatan.as_deref())
    .bind(&user.0.kode)
    .execute(&state.pool).await
    .map_err(|e| {
        if e.to_string().contains("Duplicate") {
            (StatusCode::CONFLICT,
                Json(json!({"error":"Kombinasi (kelas, ruangan) sudah ada"})))
        } else { db_err(e) }
    })?;

    let new_id = res.last_insert_id() as i64;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO sirs_rl13_tt (id, kelas_tt, ruangan, jml_tersedia, jml_terpakai, updated_by) VALUES ({}, {}, {}, {}, {}, {})",
        crate::audit::q(new_id),
        crate::audit::q(body.kelas_tt.trim()),
        crate::audit::q(body.ruangan.trim()),
        crate::audit::q(body.jml_tersedia),
        crate::audit::q(body.jml_terpakai),
        crate::audit::q(&user.0.kode))).await;

    Ok(Json(json!({ "success": true, "id": new_id })))
}

pub async fn update_rl13(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl13Tt>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if body.jml_terpakai > body.jml_tersedia {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error":"Terpakai tidak boleh melebihi tersedia"}))));
    }
    if body.jml_tersedia < 0 || body.jml_terpakai < 0 {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error":"Jumlah TT tidak boleh negatif"}))));
    }

    let res = sqlx::query(
        "UPDATE sirs_rl13_tt SET
           kelas_tt=?, ruangan=?, jml_tersedia=?, jml_terpakai=?,
           catatan=?, updated_by=?
         WHERE id=?"
    )
    .bind(body.kelas_tt.trim())
    .bind(body.ruangan.trim())
    .bind(body.jml_tersedia)
    .bind(body.jml_terpakai)
    .bind(body.catatan.as_deref())
    .bind(&user.0.kode)
    .bind(id)
    .execute(&state.pool).await.map_err(db_err)?;

    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"TT tidak ditemukan"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl13_tt SET kelas_tt={}, ruangan={}, jml_tersedia={}, jml_terpakai={}, updated_by={} WHERE id={}",
        crate::audit::q(body.kelas_tt.trim()),
        crate::audit::q(body.ruangan.trim()),
        crate::audit::q(body.jml_tersedia),
        crate::audit::q(body.jml_terpakai),
        crate::audit::q(&user.0.kode),
        crate::audit::q(id))).await;
    Ok(Json(json!({ "success": true })))
}

pub async fn delete_rl13(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query("DELETE FROM sirs_rl13_tt WHERE id=?")
        .bind(id).execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"TT tidak ditemukan"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "DELETE FROM sirs_rl13_tt WHERE id={}", crate::audit::q(id))).await;
    Ok(Json(json!({ "success": true })))
}

pub async fn cetak_rl13(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let rows: Vec<Rl13Tt> = sqlx::query_as(
        "SELECT id, kelas_tt, ruangan, jml_tersedia, jml_terpakai, catatan,
                DATE_FORMAT(updated_at,'%d-%m-%Y %H:%i') AS updated_at,
                updated_by
         FROM sirs_rl13_tt ORDER BY kelas_tt, ruangan"
    ).fetch_all(&state.pool).await.map_err(db_err)?;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let kt = setting.as_ref().and_then(SettingFields::kontak).unwrap_or("-").to_string();
    let em = setting.as_ref().and_then(SettingFields::email).unwrap_or("-").to_string();

    let total_tersedia: i32 = rows.iter().map(|r| r.jml_tersedia).sum();
    let total_terpakai: i32 = rows.iter().map(|r| r.jml_terpakai).sum();
    let bor = if total_tersedia > 0 {
        (total_terpakai as f64 / total_tersedia as f64) * 100.0
    } else { 0.0 };

    let mut tbody = String::new();
    for (i, r) in rows.iter().enumerate() {
        let kosong = r.jml_tersedia - r.jml_terpakai;
        let kelas_bor = if r.jml_tersedia > 0 {
            (r.jml_terpakai as f64 / r.jml_tersedia as f64) * 100.0
        } else { 0.0 };
        tbody.push_str(&format!(
            "<tr><td class=\"no\">{}</td><td>{}</td><td>{}</td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td>\
             <td class=\"n\">{:.1}%</td><td>{}</td></tr>",
            i + 1, esc(&r.kelas_tt), esc(&r.ruangan),
            r.jml_tersedia, r.jml_terpakai, kosong, kelas_bor,
            esc(r.catatan.as_deref().unwrap_or("-")),
        ));
    }

    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 1.3 Ketersediaan TT — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:24px;font-size:10.5pt}}
  h1{{font-size:14pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:11pt;margin:0 0 12px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:9pt;color:#475569;text-align:center;margin-bottom:18px}}
  table{{width:100%;border-collapse:collapse;font-size:10pt}}
  th,td{{border:1px solid #94a3b8;padding:6px 8px;vertical-align:top}}
  th{{background:#1e40af;color:#fff;font-size:10pt}}
  td.no{{width:36px;text-align:center;font-weight:bold;background:#f8fafc}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tfoot td{{background:#dbeafe;font-weight:bold;font-size:11pt}}
  .summary{{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}}
  .summary div{{background:#f1f5f9;border-left:4px solid #1e40af;padding:8px 12px;border-radius:0 4px 4px 0}}
  .summary p{{margin:0}}
  .summary .lbl{{font-size:9pt;color:#64748b;text-transform:uppercase;letter-spacing:1px}}
  .summary .val{{font-size:18pt;font-weight:bold;color:#1e40af}}
  .footer{{margin-top:20px;font-size:9pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:10px}}
  @media print{{body{{margin:14mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 1.3 Ketersediaan TT</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 1.3 — Ketersediaan dan Keterpakaian Tempat Tidur</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Update minimal 2x/hari ·
  Tanggal cetak: {now}
</div>

<div class="summary">
  <div><p class="lbl">Total TT Tersedia</p><p class="val">{ts}</p></div>
  <div><p class="lbl">TT Terpakai</p><p class="val">{tp}</p></div>
  <div><p class="lbl">TT Kosong</p><p class="val">{kos}</p></div>
  <div><p class="lbl">BOR Saat Ini</p><p class="val">{bor:.1}%</p></div>
</div>

<table>
  <thead><tr>
    <th class="no">No</th><th>Kelas Tempat Tidur</th><th>Ruangan</th>
    <th>TT Tersedia</th><th>TT Terpakai</th><th>TT Kosong</th>
    <th>BOR (%)</th><th>Catatan</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
  <tfoot><tr>
    <td colspan="3" style="text-align:right">TOTAL</td>
    <td class="n">{ts}</td>
    <td class="n">{tp}</td>
    <td class="n">{kos}</td>
    <td class="n">{bor:.1}%</td>
    <td></td>
  </tr></tfoot>
</table>

<div class="footer">
  Dicetak otomatis dari sistem simrscb.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {prov}.<br/>
  Email: {email} · Telepon: {tel}
</div>
</body></html>"#,
        nama = esc(&nm),
        now = esc(&now),
        ts = total_tersedia,
        tp = total_terpakai,
        kos = total_tersedia - total_terpakai,
        bor = bor,
        tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), prov = esc(&pr),
        email = esc(&em), tel = esc(&kt),
    );

    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 1.4 — Sarana Prasarana & Alkes (via ASPAK)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl14Meta {
    pub aspak_url:          Option<String>,
    pub pic_nama:           Option<String>,
    pub pic_nik:            Option<String>,
    pub pic_email:          Option<String>,
    pub pic_telp:           Option<String>,
    pub pic_jabatan:        Option<String>,
    pub terakhir_sync:      Option<String>,
    pub persen_pemenuhan:   Option<f64>,
    pub total_alkes:        Option<i32>,
    pub total_terkalibrasi: Option<i32>,
    pub catatan:            Option<String>,
    pub updated_at:         Option<String>,
    pub updated_by:         Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl14Inventaris {
    pub id:               Option<i32>,
    pub kategori:         String,
    pub nama_item:        String,
    pub jumlah:           i32,
    pub jml_baik:         i32,
    pub jml_rusak_ringan: i32,
    pub jml_rusak_berat:  i32,
    pub satuan:           Option<String>,
    pub catatan:          Option<String>,
    pub updated_at:       Option<String>,
    pub updated_by:       Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Rl14Resp {
    pub meta:       Option<Rl14Meta>,
    pub inventaris: Vec<Rl14Inventaris>,
}

pub async fn get_rl14(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Rl14Resp>, (StatusCode, Json<Value>)> {
    let meta: Option<Rl14Meta> = sqlx::query_as(
        "SELECT aspak_url, pic_nama, pic_nik, pic_email, pic_telp, pic_jabatan,
                DATE_FORMAT(terakhir_sync,'%Y-%m-%d') AS terakhir_sync,
                CAST(persen_pemenuhan AS DOUBLE) AS persen_pemenuhan,
                total_alkes, total_terkalibrasi, catatan,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl14_aspak_meta WHERE id=1 LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let inventaris: Vec<Rl14Inventaris> = sqlx::query_as(
        "SELECT id, kategori, nama_item, jumlah, jml_baik, jml_rusak_ringan,
                jml_rusak_berat, satuan, catatan,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl14_inventaris_kat ORDER BY kategori, nama_item"
    ).fetch_all(&state.pool).await.map_err(db_err)?;

    Ok(Json(Rl14Resp { meta, inventaris }))
}

pub async fn edit_rl14_meta(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<Rl14Meta>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query(
        "UPDATE sirs_rl14_aspak_meta SET
           aspak_url=?, pic_nama=?, pic_nik=?, pic_email=?, pic_telp=?, pic_jabatan=?,
           terakhir_sync=?, persen_pemenuhan=?, total_alkes=?, total_terkalibrasi=?,
           catatan=?, updated_by=?
         WHERE id=1"
    )
    .bind(body.aspak_url.as_deref())
    .bind(body.pic_nama.as_deref()).bind(body.pic_nik.as_deref())
    .bind(body.pic_email.as_deref()).bind(body.pic_telp.as_deref())
    .bind(body.pic_jabatan.as_deref())
    .bind(body.terakhir_sync.as_deref())
    .bind(body.persen_pemenuhan)
    .bind(body.total_alkes).bind(body.total_terkalibrasi)
    .bind(body.catatan.as_deref())
    .bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;

    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl14_aspak_meta SET persen_pemenuhan={}, total_alkes={}, updated_by={} WHERE id=1",
        crate::audit::qo(body.persen_pemenuhan),
        crate::audit::qo(body.total_alkes),
        crate::audit::q(&user.0.kode))).await;

    Ok(Json(json!({ "success": true })))
}

pub async fn create_rl14_inv(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<Rl14Inventaris>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if body.kategori.trim().is_empty() || body.nama_item.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error":"Kategori & nama item wajib"}))));
    }
    if body.jml_baik + body.jml_rusak_ringan + body.jml_rusak_berat > body.jumlah {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error":"Jumlah baik+rusak ringan+rusak berat tidak boleh melebihi total"}))));
    }

    let res = sqlx::query(
        "INSERT INTO sirs_rl14_inventaris_kat
           (kategori, nama_item, jumlah, jml_baik, jml_rusak_ringan,
            jml_rusak_berat, satuan, catatan, updated_by)
         VALUES (?,?,?,?,?,?,?,?,?)"
    )
    .bind(body.kategori.trim())
    .bind(body.nama_item.trim())
    .bind(body.jumlah)
    .bind(body.jml_baik)
    .bind(body.jml_rusak_ringan)
    .bind(body.jml_rusak_berat)
    .bind(body.satuan.as_deref().unwrap_or("unit"))
    .bind(body.catatan.as_deref())
    .bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;

    let new_id = res.last_insert_id() as i64;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO sirs_rl14_inventaris_kat (id, kategori, nama_item, jumlah, updated_by) VALUES ({}, {}, {}, {}, {})",
        crate::audit::q(new_id),
        crate::audit::q(body.kategori.trim()),
        crate::audit::q(body.nama_item.trim()),
        crate::audit::q(body.jumlah),
        crate::audit::q(&user.0.kode))).await;

    Ok(Json(json!({ "success": true, "id": new_id })))
}

pub async fn update_rl14_inv(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl14Inventaris>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if body.jml_baik + body.jml_rusak_ringan + body.jml_rusak_berat > body.jumlah {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error":"Jumlah baik+rusak melebihi total"}))));
    }
    let res = sqlx::query(
        "UPDATE sirs_rl14_inventaris_kat SET
           kategori=?, nama_item=?, jumlah=?, jml_baik=?, jml_rusak_ringan=?,
           jml_rusak_berat=?, satuan=?, catatan=?, updated_by=?
         WHERE id=?"
    )
    .bind(body.kategori.trim())
    .bind(body.nama_item.trim())
    .bind(body.jumlah)
    .bind(body.jml_baik)
    .bind(body.jml_rusak_ringan)
    .bind(body.jml_rusak_berat)
    .bind(body.satuan.as_deref().unwrap_or("unit"))
    .bind(body.catatan.as_deref())
    .bind(&user.0.kode)
    .bind(id)
    .execute(&state.pool).await.map_err(db_err)?;

    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Item tidak ditemukan"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl14_inventaris_kat SET kategori={}, nama_item={}, jumlah={}, updated_by={} WHERE id={}",
        crate::audit::q(body.kategori.trim()),
        crate::audit::q(body.nama_item.trim()),
        crate::audit::q(body.jumlah),
        crate::audit::q(&user.0.kode),
        crate::audit::q(id))).await;
    Ok(Json(json!({ "success": true })))
}

pub async fn delete_rl14_inv(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query("DELETE FROM sirs_rl14_inventaris_kat WHERE id=?")
        .bind(id).execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Item tidak ditemukan"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "DELETE FROM sirs_rl14_inventaris_kat WHERE id={}", crate::audit::q(id))).await;
    Ok(Json(json!({ "success": true })))
}

pub async fn cetak_rl14(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let meta: Option<Rl14Meta> = sqlx::query_as(
        "SELECT aspak_url, pic_nama, pic_nik, pic_email, pic_telp, pic_jabatan,
                DATE_FORMAT(terakhir_sync,'%d-%m-%Y') AS terakhir_sync,
                CAST(persen_pemenuhan AS DOUBLE) AS persen_pemenuhan,
                total_alkes, total_terkalibrasi, catatan,
                DATE_FORMAT(updated_at,'%d-%m-%Y %H:%i') AS updated_at,
                updated_by
         FROM sirs_rl14_aspak_meta WHERE id=1 LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let inv: Vec<Rl14Inventaris> = sqlx::query_as(
        "SELECT id, kategori, nama_item, jumlah, jml_baik, jml_rusak_ringan,
                jml_rusak_berat, satuan, catatan, NULL AS updated_at, NULL AS updated_by
         FROM sirs_rl14_inventaris_kat ORDER BY kategori, nama_item"
    ).fetch_all(&state.pool).await.map_err(db_err)?;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();

    let m = meta.as_ref();
    let url = m.and_then(|x| x.aspak_url.as_deref()).unwrap_or("https://aspak.kemkes.go.id/aplikasi/");
    let pic_nama = m.and_then(|x| x.pic_nama.as_deref()).unwrap_or("-");
    let pic_nik  = m.and_then(|x| x.pic_nik.as_deref()).unwrap_or("-");
    let pic_email= m.and_then(|x| x.pic_email.as_deref()).unwrap_or("-");
    let pic_telp = m.and_then(|x| x.pic_telp.as_deref()).unwrap_or("-");
    let pic_jab  = m.and_then(|x| x.pic_jabatan.as_deref()).unwrap_or("-");
    let terakhir = m.and_then(|x| x.terakhir_sync.as_deref()).unwrap_or("-");
    let persen   = m.and_then(|x| x.persen_pemenuhan).map(|v| format!("{:.2}", v)).unwrap_or_else(|| "-".to_string());
    let tot      = m.and_then(|x| x.total_alkes).map(|v| v.to_string()).unwrap_or_else(|| "-".to_string());
    let tot_kal  = m.and_then(|x| x.total_terkalibrasi).map(|v| v.to_string()).unwrap_or_else(|| "-".to_string());
    let catatan_meta = m.and_then(|x| x.catatan.as_deref()).unwrap_or("-");

    // Group inventaris by kategori
    let mut tbody = String::new();
    let mut last_kat = String::new();
    for (i, it) in inv.iter().enumerate() {
        if it.kategori != last_kat {
            last_kat = it.kategori.clone();
            tbody.push_str(&format!(
                "<tr class=\"kat\"><td colspan=\"7\"><strong>{}</strong></td></tr>",
                esc(&it.kategori)
            ));
        }
        let rusak = it.jml_rusak_ringan + it.jml_rusak_berat;
        tbody.push_str(&format!(
            "<tr><td class=\"no\">{}</td><td>{}</td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td>\
             <td>{} <span class=\"muted\">{}</span></td></tr>",
            i + 1, esc(&it.nama_item),
            it.jumlah, it.jml_baik, rusak,
            it.satuan.as_deref().unwrap_or("unit"),
            esc(it.catatan.as_deref().unwrap_or("-")),
            esc(it.satuan.as_deref().unwrap_or("")),
        ));
    }

    let total_jumlah: i32 = inv.iter().map(|i| i.jumlah).sum();
    let total_baik: i32   = inv.iter().map(|i| i.jml_baik).sum();
    let total_rusak: i32  = inv.iter().map(|i| i.jml_rusak_ringan + i.jml_rusak_berat).sum();

    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 1.4 Sarpras & Alkes — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:24px;font-size:10.5pt}}
  h1{{font-size:14pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:11pt;margin:0 0 12px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:9pt;color:#475569;text-align:center;margin-bottom:18px}}
  table{{width:100%;border-collapse:collapse;font-size:10pt;margin-top:8px}}
  th,td{{border:1px solid #94a3b8;padding:5px 8px;vertical-align:top}}
  th{{background:#1e40af;color:#fff;font-size:10pt}}
  td.no{{width:36px;text-align:center;background:#f8fafc}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.kat td{{background:#dbeafe;color:#1e40af;font-size:10.5pt}}
  .aspak{{background:#fef3c7;border:2px dashed #f59e0b;padding:14px 18px;border-radius:8px;margin-bottom:14px}}
  .aspak h3{{margin:0 0 6px 0;color:#92400e;font-size:11pt}}
  .aspak a{{color:#1e40af;font-weight:bold;text-decoration:underline}}
  .section{{margin-top:18px}}
  .sec-title{{background:#1e40af;color:#fff;padding:6px 12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:10pt}}
  .grid{{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:8px}}
  .card{{border:1px solid #cbd5e1;border-radius:6px;padding:10px 12px}}
  .card p{{margin:0;font-size:10pt}}
  .card .lbl{{font-size:9pt;color:#64748b}}
  .card .val{{font-weight:bold;color:#0f172a;font-size:11pt;margin-top:2px}}
  .muted{{color:#94a3b8;font-size:9pt}}
  .footer{{margin-top:20px;font-size:9pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:10px}}
  @media print{{body{{margin:14mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 1.4 Sarpras & Alkes (ASPAK)</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 1.4 — Sarana Prasarana dan Alat Kesehatan</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Pelaporan via ASPAK · Tanggal cetak: {now}
</div>

<div class="aspak">
  <h3>🔗 Tautan ASPAK Resmi</h3>
  <p style="margin:0;font-size:10pt">
    Data Sarana, Prasarana, dan Alat Kesehatan dilaporkan melalui aplikasi <strong>ASPAK</strong>
    (Aplikasi Sarana, Prasarana, dan Alat Kesehatan) di:
    <a href="{url}">{url}</a>
  </p>
</div>

<div class="section">
  <div class="sec-title">A. Metadata Sync ASPAK</div>
  <div class="grid">
    <div class="card"><p class="lbl">Terakhir Sync ASPAK</p><p class="val">{terakhir}</p></div>
    <div class="card"><p class="lbl">% Pemenuhan Sarpras-Alkes</p><p class="val">{persen}%</p></div>
    <div class="card"><p class="lbl">Total Alkes Tercatat</p><p class="val">{tot}</p></div>
    <div class="card"><p class="lbl">Terkalibrasi</p><p class="val">{tot_kal}</p></div>
  </div>
</div>

<div class="section">
  <div class="sec-title">B. PIC ASPAK</div>
  <table>
    <tr><td><strong>Nama PIC</strong></td><td>{pic_nama}</td>
        <td><strong>NIK</strong></td><td>{pic_nik}</td></tr>
    <tr><td><strong>Email</strong></td><td>{pic_email}</td>
        <td><strong>Telp/WA</strong></td><td>{pic_telp}</td></tr>
    <tr><td><strong>Jabatan</strong></td><td colspan="3">{pic_jab}</td></tr>
  </table>
  <p style="margin-top:8px;font-size:9.5pt"><strong>Catatan:</strong> {catatan_meta}</p>
</div>

<div class="section">
  <div class="sec-title">C. Inventaris Ringkas (Internal Monitoring)</div>
  <p style="font-size:9pt;color:#64748b;margin:4px 0">
    Catatan: ini ringkasan internal RS. Pelaporan resmi ke Kemenkes dilakukan via ASPAK.
  </p>
  <table>
    <thead><tr>
      <th class="no">No</th><th>Nama Item</th>
      <th>Total</th><th>Baik</th><th>Rusak</th>
      <th>Satuan</th><th>Catatan</th>
    </tr></thead>
    <tbody>{tbody}</tbody>
    <tfoot>
      <tr style="background:#dbeafe;font-weight:bold">
        <td colspan="2" style="text-align:right">TOTAL</td>
        <td class="n">{total_jumlah}</td>
        <td class="n">{total_baik}</td>
        <td class="n">{total_rusak}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>
</div>

<div class="footer">
  Dicetak otomatis dari sistem simrscb.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {prov}.
</div>
</body></html>"#,
        nama = esc(&nm),
        now = esc(&now),
        url = esc(url),
        terakhir = esc(terakhir),
        persen = esc(&persen),
        tot = esc(&tot),
        tot_kal = esc(&tot_kal),
        pic_nama = esc(pic_nama),
        pic_nik = esc(pic_nik),
        pic_email = esc(pic_email),
        pic_telp = esc(pic_telp),
        pic_jab = esc(pic_jab),
        catatan_meta = esc(catatan_meta).replace('\n', "<br/>"),
        tbody = tbody,
        total_jumlah = total_jumlah,
        total_baik = total_baik,
        total_rusak = total_rusak,
        alamat = esc(&al), kab = esc(&kb), prov = esc(&pr),
    );

    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 2 — Data Ketenagaan (via SISDMK + summary realtime Khanza pegawai)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl2Meta {
    pub sisdmk_url:      Option<String>,
    pub pic_nama:        Option<String>,
    pub pic_nik:         Option<String>,
    pub pic_email:       Option<String>,
    pub pic_telp:        Option<String>,
    pub pic_jabatan:     Option<String>,
    pub terakhir_sync:   Option<String>,
    pub total_di_sisdmk: Option<i32>,
    pub catatan:         Option<String>,
    pub updated_at:      Option<String>,
    pub updated_by:      Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct GroupCount {
    pub label: String,
    pub jml:   i64,
}

#[derive(Debug, Serialize)]
pub struct Rl2Resp {
    pub meta:           Option<Rl2Meta>,
    pub total_aktif:    i64,
    pub total_cuti:     i64,
    pub total_keluar:   i64,
    pub total_pria:     i64,
    pub total_wanita:   i64,
    pub per_pendidikan: Vec<GroupCount>,
    pub per_departemen: Vec<GroupCount>,
    pub per_jabatan:    Vec<GroupCount>,
    pub per_status_kerja: Vec<GroupCount>,
}

pub async fn get_rl2(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Rl2Resp>, (StatusCode, Json<Value>)> {
    let meta: Option<Rl2Meta> = sqlx::query_as(
        "SELECT sisdmk_url, pic_nama, pic_nik, pic_email, pic_telp, pic_jabatan,
                DATE_FORMAT(terakhir_sync,'%Y-%m-%d') AS terakhir_sync,
                total_di_sisdmk, catatan,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl2_meta WHERE id=1 LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let aktif: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pegawai WHERE stts_aktif='AKTIF'"
    ).fetch_one(&state.pool).await.map_err(db_err)?;
    let cuti: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pegawai WHERE stts_aktif='CUTI'"
    ).fetch_one(&state.pool).await.unwrap_or(0);
    let keluar: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pegawai WHERE stts_aktif='KELUAR'"
    ).fetch_one(&state.pool).await.unwrap_or(0);
    let pria: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pegawai WHERE stts_aktif='AKTIF' AND jk='Pria'"
    ).fetch_one(&state.pool).await.unwrap_or(0);
    let wanita: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pegawai WHERE stts_aktif='AKTIF' AND jk='Wanita'"
    ).fetch_one(&state.pool).await.unwrap_or(0);

    let per_pendidikan: Vec<GroupCount> = sqlx::query_as(
        "SELECT IFNULL(NULLIF(pendidikan,''),'(tidak terisi)') AS label, COUNT(*) AS jml
         FROM pegawai WHERE stts_aktif='AKTIF'
         GROUP BY pendidikan ORDER BY jml DESC LIMIT 15"
    ).fetch_all(&state.pool).await.unwrap_or_default();

    let per_departemen: Vec<GroupCount> = sqlx::query_as(
        "SELECT IFNULL(NULLIF(p.departemen,''),'(tidak terisi)') AS label, COUNT(*) AS jml
         FROM pegawai p WHERE p.stts_aktif='AKTIF'
         GROUP BY p.departemen ORDER BY jml DESC LIMIT 15"
    ).fetch_all(&state.pool).await.unwrap_or_default();

    let per_jabatan: Vec<GroupCount> = sqlx::query_as(
        "SELECT IFNULL(NULLIF(jbtn,''),'(tidak terisi)') AS label, COUNT(*) AS jml
         FROM pegawai WHERE stts_aktif='AKTIF' AND jbtn != '-'
         GROUP BY jbtn ORDER BY jml DESC LIMIT 15"
    ).fetch_all(&state.pool).await.unwrap_or_default();

    let per_status_kerja: Vec<GroupCount> = sqlx::query_as(
        "SELECT IFNULL(NULLIF(stts_kerja,''),'(tidak terisi)') AS label, COUNT(*) AS jml
         FROM pegawai WHERE stts_aktif='AKTIF'
         GROUP BY stts_kerja ORDER BY jml DESC LIMIT 10"
    ).fetch_all(&state.pool).await.unwrap_or_default();

    Ok(Json(Rl2Resp {
        meta,
        total_aktif: aktif,
        total_cuti: cuti,
        total_keluar: keluar,
        total_pria: pria,
        total_wanita: wanita,
        per_pendidikan,
        per_departemen,
        per_jabatan,
        per_status_kerja,
    }))
}

pub async fn edit_rl2_meta(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<Rl2Meta>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query(
        "UPDATE sirs_rl2_meta SET
           sisdmk_url=?, pic_nama=?, pic_nik=?, pic_email=?, pic_telp=?,
           pic_jabatan=?, terakhir_sync=?, total_di_sisdmk=?, catatan=?,
           updated_by=?
         WHERE id=1"
    )
    .bind(body.sisdmk_url.as_deref())
    .bind(body.pic_nama.as_deref()).bind(body.pic_nik.as_deref())
    .bind(body.pic_email.as_deref()).bind(body.pic_telp.as_deref())
    .bind(body.pic_jabatan.as_deref())
    .bind(body.terakhir_sync.as_deref())
    .bind(body.total_di_sisdmk)
    .bind(body.catatan.as_deref())
    .bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;

    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl2_meta SET total_di_sisdmk={}, updated_by={} WHERE id=1",
        crate::audit::qo(body.total_di_sisdmk),
        crate::audit::q(&user.0.kode))).await;

    Ok(Json(json!({ "success": true })))
}

pub async fn cetak_rl2(
    user: AuthUser,
    State(state): State<AppState>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl2(user, State(state)).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();

    let m = resp.meta.as_ref();
    let url      = m.and_then(|x| x.sisdmk_url.as_deref()).unwrap_or("https://sisdmk.kemkes.go.id/login");
    let pic_nama = m.and_then(|x| x.pic_nama.as_deref()).unwrap_or("-");
    let pic_nik  = m.and_then(|x| x.pic_nik.as_deref()).unwrap_or("-");
    let pic_email= m.and_then(|x| x.pic_email.as_deref()).unwrap_or("-");
    let pic_telp = m.and_then(|x| x.pic_telp.as_deref()).unwrap_or("-");
    let pic_jab  = m.and_then(|x| x.pic_jabatan.as_deref()).unwrap_or("-");
    let terakhir = m.and_then(|x| x.terakhir_sync.as_deref()).unwrap_or("-");
    let tot_sisdmk = m.and_then(|x| x.total_di_sisdmk).map(|v| v.to_string()).unwrap_or_else(|| "-".to_string());
    let catatan = m.and_then(|x| x.catatan.as_deref()).unwrap_or("-");

    let render_group = |title: &str, rows: &[GroupCount]| -> String {
        let mut tbody = String::new();
        for (i, r) in rows.iter().enumerate() {
            tbody.push_str(&format!(
                "<tr><td class=\"no\">{}</td><td>{}</td><td class=\"n\">{}</td></tr>",
                i + 1, esc(&r.label), r.jml
            ));
        }
        format!(
            "<div class=\"section\"><div class=\"sec-title\">{}</div>\
             <table><thead><tr><th class=\"no\">No</th><th>{}</th><th>Jumlah</th></tr></thead>\
             <tbody>{}</tbody></table></div>",
            esc(title), esc(title), tbody
        )
    };

    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();
    let total_aktif = resp.total_aktif;
    let total_cuti = resp.total_cuti;
    let total_keluar = resp.total_keluar;
    let total_pria = resp.total_pria;
    let total_wanita = resp.total_wanita;

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 2 Data Ketenagaan — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:24px;font-size:10.5pt}}
  h1{{font-size:14pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:11pt;margin:0 0 12px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta-c{{font-size:9pt;color:#475569;text-align:center;margin-bottom:18px}}
  table{{width:100%;border-collapse:collapse;font-size:10pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:5px 8px;vertical-align:top}}
  th{{background:#1e40af;color:#fff;font-size:10pt}}
  td.no{{width:36px;text-align:center;background:#f8fafc}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums;font-weight:bold}}
  .sisdmk{{background:#ddd6fe;border:2px dashed #7c3aed;padding:14px 18px;border-radius:8px;margin-bottom:14px}}
  .sisdmk h3{{margin:0 0 6px 0;color:#5b21b6;font-size:11pt}}
  .sisdmk a{{color:#5b21b6;font-weight:bold;text-decoration:underline}}
  .section{{margin-top:18px;page-break-inside:avoid}}
  .sec-title{{background:#1e40af;color:#fff;padding:6px 12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:10pt}}
  .grid{{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:12px 0}}
  .card{{background:#f1f5f9;border-left:4px solid #1e40af;padding:8px 12px;border-radius:0 4px 4px 0}}
  .card .lbl{{font-size:9pt;color:#64748b;text-transform:uppercase;letter-spacing:0.5px}}
  .card .val{{font-size:18pt;font-weight:bold;color:#1e40af;margin:2px 0 0 0}}
  .footer{{margin-top:24px;font-size:9pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:10px}}
  @media print{{body{{margin:14mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 2 Data Ketenagaan (SISDMK)</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 2 — Data Ketenagaan yang Bekerja di Rumah Sakit</h1>
<h2>{nama}</h2>
<div class="meta-c">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Pelaporan via SISDMK · Tanggal cetak: {now}
</div>

<div class="sisdmk">
  <h3>🔗 Tautan SISDMK Resmi</h3>
  <p style="margin:0;font-size:10pt">
    Data Ketenagaan dilaporkan melalui Sistem Informasi Sumber Daya Manusia Kesehatan
    <strong>SISDMK</strong> di: <a href="{url}">{url}</a>
  </p>
</div>

<div class="section">
  <div class="sec-title">A. Ringkasan Status (dari Khanza realtime)</div>
  <div class="grid">
    <div class="card"><p class="lbl">Total Aktif</p><p class="val">{aktif}</p></div>
    <div class="card"><p class="lbl">Cuti</p><p class="val">{cuti}</p></div>
    <div class="card"><p class="lbl">Keluar</p><p class="val">{keluar}</p></div>
    <div class="card"><p class="lbl">Pria</p><p class="val">{pria}</p></div>
    <div class="card"><p class="lbl">Wanita</p><p class="val">{wanita}</p></div>
  </div>
</div>

<div class="section">
  <div class="sec-title">B. Metadata Sync SISDMK</div>
  <table>
    <tr><td><strong>PIC SISDMK</strong></td><td>{pic_nama}</td>
        <td><strong>NIK</strong></td><td>{pic_nik}</td></tr>
    <tr><td><strong>Jabatan</strong></td><td>{pic_jab}</td>
        <td><strong>Telp/WA</strong></td><td>{pic_telp}</td></tr>
    <tr><td><strong>Email</strong></td><td colspan="3">{pic_email}</td></tr>
    <tr><td><strong>Terakhir Sync</strong></td><td>{terakhir}</td>
        <td><strong>Total di SISDMK</strong></td><td>{tot_sisdmk}</td></tr>
  </table>
  <p style="margin-top:8px;font-size:9.5pt"><strong>Catatan:</strong> {catatan}</p>
</div>

{per_pendidikan_html}
{per_departemen_html}
{per_jabatan_html}
{per_status_html}

<div class="footer">
  Dicetak otomatis dari sistem simrscb. Ringkasan ketenagaan di-generate realtime dari tabel pegawai Khanza.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {prov}.
</div>
</body></html>"#,
        nama = esc(&nm),
        now = esc(&now),
        url = esc(url),
        aktif = total_aktif, cuti = total_cuti, keluar = total_keluar,
        pria = total_pria, wanita = total_wanita,
        pic_nama = esc(pic_nama), pic_nik = esc(pic_nik),
        pic_jab = esc(pic_jab), pic_telp = esc(pic_telp),
        pic_email = esc(pic_email),
        terakhir = esc(terakhir), tot_sisdmk = esc(&tot_sisdmk),
        catatan = esc(catatan).replace('\n', "<br/>"),
        per_pendidikan_html = render_group("C. Per Pendidikan",  &resp.per_pendidikan),
        per_departemen_html = render_group("D. Per Departemen",  &resp.per_departemen),
        per_jabatan_html    = render_group("E. Per Jabatan (top)", &resp.per_jabatan),
        per_status_html     = render_group("F. Per Status Kerja", &resp.per_status_kerja),
        alamat = esc(&al), kab = esc(&kb), prov = esc(&pr),
    );

    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.1 — Indikator Pelayanan (BOR/ALOS/BTO/TOI/NDR/GDR per jenis)
// Compute realtime dari Khanza kamar_inap + kamar + bangsal.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct Rl31Row {
    pub jenis:         &'static str,
    pub jml_tt:        i64,
    pub hari_periode:  i32,
    pub hari_perawatan:i64,
    pub pasien_keluar: i64,    // hidup+mati (exclude pindah kamar, status belum lengkap)
    pub pasien_mati:   i64,
    pub mati_ge48:     i64,
    pub bor:           f64,
    pub alos:          f64,
    pub bto:           f64,
    pub toi:           f64,
    pub ndr:           f64,
    pub gdr:           f64,
}

#[derive(Debug, Serialize)]
pub struct Rl31Resp {
    pub bulan:       String,           // YYYY-MM
    pub bulan_dari:  String,           // YYYY-MM-01
    pub bulan_sampai:String,           // YYYY-MM-DD (last day)
    pub hari_periode:i32,
    pub rows:        Vec<Rl31Row>,
    pub rata_rata:   Rl31RataRata,
}

#[derive(Debug, Serialize)]
pub struct Rl31RataRata {
    pub bor:  f64,
    pub alos: f64,
    pub bto:  f64,
    pub toi:  f64,
    pub ndr:  f64,
    pub gdr:  f64,
}

#[derive(Deserialize)]
pub struct Rl31Query {
    pub bulan: Option<String>,  // YYYY-MM
}

// Klasifikasi jenis pelayanan dari nama bangsal (case-insensitive contains).
// Urutan periksa: NICU, PICU, ICCU/ICVCU, RICU, HCU, ICU → sisanya Non Intensif.
fn klasifikasi_jenis(nm_bangsal: &str) -> &'static str {
    let u = nm_bangsal.to_uppercase();
    if u.contains("NICU")                                  { "NICU" }
    else if u.contains("PICU")                             { "PICU" }
    else if u.contains("ICU") && !u.contains("NICU") && !u.contains("PICU") && !u.contains("ICCU") && !u.contains("ICVCU") && !u.contains("RICU") { "ICU" }
    else if u.contains("HCU") || u.contains("ICCU") || u.contains("ICVCU") || u.contains("RICU") { "Intensif lainnya" }
    else                                                    { "Non Intensif" }
}

pub async fn get_rl31(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl31Resp>, (StatusCode, Json<Value>)> {
    // Default bulan = bulan ini
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let bulan_dari = format!("{}-01", bulan);
    // Compute hari periode (jumlah hari di bulan tsb)
    let (year_s, month_s) = (&bulan[..4], &bulan[5..7]);
    let year: i32 = year_s.parse().unwrap_or(2026);
    let month: u32 = month_s.parse().unwrap_or(1);
    let next_month_first = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let first_of_month = chrono::NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let hari_periode = (next_month_first - first_of_month).num_days() as i32;
    let bulan_sampai = (next_month_first - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    // ── Step 1: Hitung total TT per jenis (dari kamar + bangsal, statusdata aktif)
    #[derive(sqlx::FromRow)]
    struct TtRow { nm_bangsal: String, jml_kamar: i64 }
    let tt_rows: Vec<TtRow> = sqlx::query_as(
        "SELECT IFNULL(b.nm_bangsal,'') AS nm_bangsal, COUNT(*) AS jml_kamar
         FROM kamar k LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
         WHERE k.statusdata = '1'
           AND IFNULL(b.status,'1') = '1'
         GROUP BY b.nm_bangsal"
    ).fetch_all(&state.pool).await.unwrap_or_default();

    // ── Step 2: Agregasi pasien per jenis untuk bulan tsb
    #[derive(sqlx::FromRow)]
    struct AggRow {
        nm_bangsal:     String,
        hari_rawat:     Option<f64>,
        pasien_keluar:  i64,
        pasien_mati:    i64,
        mati_ge48:      i64,
    }
    let agg_rows: Vec<AggRow> = sqlx::query_as(
        "SELECT IFNULL(b.nm_bangsal,'') AS nm_bangsal,
                CAST(SUM(IFNULL(ki.lama,0)) AS DOUBLE) AS hari_rawat,
                CAST(SUM(CASE WHEN ki.stts_pulang NOT IN ('Pindah Kamar','Status Belum Lengkap') THEN 1 ELSE 0 END) AS SIGNED) AS pasien_keluar,
                CAST(SUM(CASE WHEN ki.stts_pulang = 'Meninggal' THEN 1 ELSE 0 END) AS SIGNED) AS pasien_mati,
                CAST(SUM(CASE WHEN ki.stts_pulang = 'Meninggal' AND IFNULL(ki.lama,0) >= 2 THEN 1 ELSE 0 END) AS SIGNED) AS mati_ge48
         FROM kamar_inap ki
         INNER JOIN kamar k     ON ki.kd_kamar = k.kd_kamar
         LEFT  JOIN bangsal b   ON k.kd_bangsal = b.kd_bangsal
         WHERE ki.tgl_keluar BETWEEN ? AND ?
         GROUP BY b.nm_bangsal"
    )
    .bind(&bulan_dari).bind(&bulan_sampai)
    .fetch_all(&state.pool).await.unwrap_or_default();

    // ── Step 3: Klasifikasi + akumulasi per jenis
    use std::collections::HashMap;
    let mut tt_by_jenis: HashMap<&'static str, i64> = HashMap::new();
    for t in &tt_rows {
        let j = klasifikasi_jenis(&t.nm_bangsal);
        *tt_by_jenis.entry(j).or_insert(0) += t.jml_kamar;
    }

    let mut hari_by_jenis: HashMap<&'static str, f64> = HashMap::new();
    let mut keluar_by_jenis: HashMap<&'static str, i64> = HashMap::new();
    let mut mati_by_jenis: HashMap<&'static str, i64> = HashMap::new();
    let mut mati48_by_jenis: HashMap<&'static str, i64> = HashMap::new();
    for a in &agg_rows {
        let j = klasifikasi_jenis(&a.nm_bangsal);
        *hari_by_jenis.entry(j).or_insert(0.0) += a.hari_rawat.unwrap_or(0.0);
        *keluar_by_jenis.entry(j).or_insert(0) += a.pasien_keluar;
        *mati_by_jenis.entry(j).or_insert(0) += a.pasien_mati;
        *mati48_by_jenis.entry(j).or_insert(0) += a.mati_ge48;
    }

    // ── Step 4: Hitung indikator per jenis
    let jenis_list = ["Non Intensif", "ICU", "NICU", "PICU", "Intensif lainnya"];
    let mut rows: Vec<Rl31Row> = Vec::with_capacity(5);

    for &j in &jenis_list {
        let jml_tt = *tt_by_jenis.get(j).unwrap_or(&0);
        let hari_rawat = *hari_by_jenis.get(j).unwrap_or(&0.0);
        let keluar = *keluar_by_jenis.get(j).unwrap_or(&0);
        let mati   = *mati_by_jenis.get(j).unwrap_or(&0);
        let mati48 = *mati48_by_jenis.get(j).unwrap_or(&0);

        let denom_tt = (jml_tt as f64) * (hari_periode as f64);
        let bor = if denom_tt > 0.0 { (hari_rawat / denom_tt) * 100.0 } else { 0.0 };
        let alos= if keluar > 0     { hari_rawat / (keluar as f64) } else { 0.0 };
        let bto = if jml_tt > 0     { (keluar as f64) / (jml_tt as f64) } else { 0.0 };
        let toi = if keluar > 0     { (denom_tt - hari_rawat) / (keluar as f64) } else { 0.0 };
        let ndr = if keluar > 0     { (mati48 as f64) / (keluar as f64) * 1000.0 } else { 0.0 };
        let gdr = if keluar > 0     { (mati   as f64) / (keluar as f64) * 1000.0 } else { 0.0 };

        rows.push(Rl31Row {
            jenis: j, jml_tt, hari_periode,
            hari_perawatan: hari_rawat.round() as i64,
            pasien_keluar: keluar, pasien_mati: mati, mati_ge48: mati48,
            bor, alos, bto, toi, ndr, gdr,
        });
    }

    // ── Rata-rata (rata2 dari kolom yang punya nilai non-zero)
    let rata_rata = {
        let mean = |sel: fn(&Rl31Row) -> f64| -> f64 {
            let vals: Vec<f64> = rows.iter().map(sel).filter(|v| *v != 0.0).collect();
            if vals.is_empty() { 0.0 } else { vals.iter().sum::<f64>() / vals.len() as f64 }
        };
        Rl31RataRata {
            bor: mean(|r| r.bor),
            alos: mean(|r| r.alos),
            bto: mean(|r| r.bto),
            toi: mean(|r| r.toi),
            ndr: mean(|r| r.ndr),
            gdr: mean(|r| r.gdr),
        }
    };

    Ok(Json(Rl31Resp {
        bulan: bulan.clone(),
        bulan_dari, bulan_sampai,
        hari_periode, rows, rata_rata,
    }))
}

pub async fn cetak_rl31(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl31(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();

    let mut tbody = String::new();
    for (i, r) in resp.rows.iter().enumerate() {
        tbody.push_str(&format!(
            "<tr><td class=\"no\">{}</td><td><strong>{}</strong></td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td>\
             <td class=\"n\">{:.2}</td><td class=\"n\">{:.2}</td>\
             <td class=\"n\">{:.2}</td><td class=\"n\">{:.2}</td>\
             <td class=\"n\">{:.2}</td><td class=\"n\">{:.2}</td></tr>",
            i + 1, esc(r.jenis),
            r.jml_tt, r.hari_perawatan, r.pasien_keluar,
            r.bor, r.alos, r.bto, r.toi, r.ndr, r.gdr,
        ));
    }
    let rr = &resp.rata_rata;
    tbody.push_str(&format!(
        "<tr class=\"avg\"><td class=\"no\">77</td><td><strong>Rata-rata</strong></td>\
         <td colspan=\"3\"></td>\
         <td class=\"n\"><strong>{:.2}</strong></td><td class=\"n\"><strong>{:.2}</strong></td>\
         <td class=\"n\"><strong>{:.2}</strong></td><td class=\"n\"><strong>{:.2}</strong></td>\
         <td class=\"n\"><strong>{:.2}</strong></td><td class=\"n\"><strong>{:.2}</strong></td></tr>",
        rr.bor, rr.alos, rr.bto, rr.toi, rr.ndr, rr.gdr
    ));

    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();
    let bulan = &resp.bulan;
    let dari  = &resp.bulan_dari;
    let sampai= &resp.bulan_sampai;
    let hari  = resp.hari_periode;

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.1 Indikator Pelayanan — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:24px;font-size:10.5pt}}
  h1{{font-size:14pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:11pt;margin:0 0 12px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:9pt;color:#475569;text-align:center;margin-bottom:18px}}
  table{{width:100%;border-collapse:collapse;font-size:10pt}}
  th,td{{border:1px solid #94a3b8;padding:5px 8px;vertical-align:top}}
  th{{background:#1e40af;color:#fff;font-size:10pt;text-align:center}}
  td.no{{width:36px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.avg td{{background:#dbeafe;font-weight:bold}}
  .formula{{margin-top:16px;padding:10px 14px;background:#f1f5f9;border-left:4px solid #1e40af;font-size:9pt;border-radius:0 4px 4px 0}}
  .formula h4{{margin:0 0 4px 0;color:#1e40af}}
  .formula p{{margin:2px 0}}
  .footer{{margin-top:20px;font-size:9pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:10px}}
  @media print{{body{{margin:14mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.1 Indikator Pelayanan</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.1 — Indikator Pelayanan</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong>
  ({dari} s/d {sampai}, {hari} hari) · Tanggal cetak: {now}
</div>

<table>
  <thead><tr>
    <th class="no">No</th><th>Jenis Pelayanan</th>
    <th>Jml TT</th><th>Hari Perawatan</th><th>Pasien Keluar</th>
    <th>BOR (%)</th><th>ALOS</th><th>BTO</th><th>TOI</th>
    <th>NDR (‰)</th><th>GDR (‰)</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="formula">
  <h4>📐 Formula Indikator (JUKNIS SIRS 6.3)</h4>
  <p><strong>BOR</strong> (Bed Occupancy Rate) = (Jml Hari Perawatan ÷ (Jml TT × Hari Periode)) × 100% — ideal 60–85%</p>
  <p><strong>ALOS</strong> (Average Length of Stay) = Jml Lama Dirawat ÷ Jml Pasien Keluar — ideal 6–9 hari</p>
  <p><strong>BTO</strong> (Bed Turn Over) = Jml Pasien Keluar ÷ Jml TT — ideal 40–50 kali/tahun</p>
  <p><strong>TOI</strong> (Turn Over Interval) = ((Jml TT × Hari Periode) − Hari Perawatan) ÷ Jml Pasien Keluar — ideal 1–3 hari</p>
  <p><strong>NDR</strong> (Net Death Rate) = (Pasien Mati ≥48 jam ÷ Pasien Keluar) × 1000‰ — tolerir &lt;25 per 1000</p>
  <p><strong>GDR</strong> (Gross Death Rate) = (Total Pasien Mati ÷ Pasien Keluar) × 1000‰ — tolerir &lt;45 per 1000</p>
</div>

<div class="footer">
  Compute realtime dari Khanza kamar_inap + kamar + bangsal.<br/>
  Klasifikasi jenis berdasarkan nama bangsal (NICU/PICU/ICU/HCU/ICCU/RICU vs Non Intensif).<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {prov}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now),
        bulan = esc(bulan), dari = esc(dari), sampai = esc(sampai),
        hari = hari,
        tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), prov = esc(&pr),
    );

    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.2 — Rekap Kegiatan Pelayanan Rawat Inap
// Compute realtime per bangsal dari Khanza kamar_inap × kamar × bangsal ×
// reg_periksa × pasien (untuk JK).
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl32Row {
    pub jenis_pelayanan:    String,
    pub pasien_masuk:       i64,
    pub pasien_dipindahkan: i64,    // stts_pulang='Pindah Kamar'
    pub pasien_keluar_hidup:i64,
    pub pasien_l_mati_lt48: i64,
    pub pasien_l_mati_ge48: i64,
    pub pasien_p_mati_lt48: i64,
    pub pasien_p_mati_ge48: i64,
    pub lama_dirawat:       i64,    // SUM lama (hari)
    pub hari_perawatan:     i64,    // = lama_dirawat
    pub hari_kelas_utama:   i64,
    pub hari_kelas_1:       i64,
    pub hari_kelas_2:       i64,
    pub hari_kelas_3:       i64,
}

#[derive(Debug, Serialize)]
pub struct Rl32Total {
    pub pasien_masuk:       i64,
    pub pasien_dipindahkan: i64,
    pub pasien_keluar_hidup:i64,
    pub pasien_l_mati_lt48: i64,
    pub pasien_l_mati_ge48: i64,
    pub pasien_p_mati_lt48: i64,
    pub pasien_p_mati_ge48: i64,
    pub total_mati:         i64,
    pub lama_dirawat:       i64,
    pub hari_perawatan:     i64,
    pub hari_kelas_utama:   i64,
    pub hari_kelas_1:       i64,
    pub hari_kelas_2:       i64,
    pub hari_kelas_3:       i64,
}

#[derive(Debug, Serialize)]
pub struct Rl32Resp {
    pub bulan:        String,
    pub bulan_dari:   String,
    pub bulan_sampai: String,
    pub hari_periode: i32,
    pub rows:         Vec<Rl32Row>,
    pub total:        Rl32Total,
}

pub async fn get_rl32(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl32Resp>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let bulan_dari = format!("{}-01", bulan);
    let (year_s, month_s) = (&bulan[..4], &bulan[5..7]);
    let year: i32 = year_s.parse().unwrap_or(2026);
    let month: u32 = month_s.parse().unwrap_or(1);
    let next_month_first = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let first_of_month = chrono::NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let hari_periode = (next_month_first - first_of_month).num_days() as i32;
    let bulan_sampai = (next_month_first - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    // 1 query besar: per nm_bangsal × bulan tertentu
    // - pasien_masuk: COUNT WHERE tgl_masuk in month
    // - pasien_dipindahkan: COUNT WHERE stts_pulang='Pindah Kamar' AND tgl_keluar in month
    // - pasien_keluar_hidup: COUNT WHERE tgl_keluar in month AND stts_pulang NOT IN ('Meninggal','Pindah Kamar','Status Belum Lengkap')
    // - pasien_l_mati_lt48: COUNT WHERE Meninggal AND lama<2 AND jk='L'
    // - dst
    // - lama_dirawat: SUM(lama) WHERE tgl_keluar in month
    // - hari_kelas_*: SUM(lama) grouped by kamar.kelas
    let rows: Vec<Rl32Row> = sqlx::query_as(
        "SELECT IFNULL(b.nm_bangsal,'(tidak terdaftar)') AS jenis_pelayanan,
                CAST(SUM(CASE WHEN ki.tgl_masuk BETWEEN ? AND ? THEN 1 ELSE 0 END) AS SIGNED) AS pasien_masuk,
                CAST(SUM(CASE WHEN ki.stts_pulang='Pindah Kamar' AND ki.tgl_keluar BETWEEN ? AND ? THEN 1 ELSE 0 END) AS SIGNED) AS pasien_dipindahkan,
                CAST(SUM(CASE WHEN ki.tgl_keluar BETWEEN ? AND ?
                              AND ki.stts_pulang NOT IN ('Meninggal','Pindah Kamar','Status Belum Lengkap')
                         THEN 1 ELSE 0 END) AS SIGNED) AS pasien_keluar_hidup,
                CAST(SUM(CASE WHEN ki.stts_pulang='Meninggal' AND ki.tgl_keluar BETWEEN ? AND ?
                              AND IFNULL(ki.lama,0)<2 AND p.jk='L' THEN 1 ELSE 0 END) AS SIGNED) AS pasien_l_mati_lt48,
                CAST(SUM(CASE WHEN ki.stts_pulang='Meninggal' AND ki.tgl_keluar BETWEEN ? AND ?
                              AND IFNULL(ki.lama,0)>=2 AND p.jk='L' THEN 1 ELSE 0 END) AS SIGNED) AS pasien_l_mati_ge48,
                CAST(SUM(CASE WHEN ki.stts_pulang='Meninggal' AND ki.tgl_keluar BETWEEN ? AND ?
                              AND IFNULL(ki.lama,0)<2 AND p.jk='P' THEN 1 ELSE 0 END) AS SIGNED) AS pasien_p_mati_lt48,
                CAST(SUM(CASE WHEN ki.stts_pulang='Meninggal' AND ki.tgl_keluar BETWEEN ? AND ?
                              AND IFNULL(ki.lama,0)>=2 AND p.jk='P' THEN 1 ELSE 0 END) AS SIGNED) AS pasien_p_mati_ge48,
                CAST(IFNULL(SUM(CASE WHEN ki.tgl_keluar BETWEEN ? AND ? THEN ki.lama ELSE 0 END),0) AS SIGNED) AS lama_dirawat,
                CAST(IFNULL(SUM(CASE WHEN ki.tgl_keluar BETWEEN ? AND ? THEN ki.lama ELSE 0 END),0) AS SIGNED) AS hari_perawatan,
                CAST(IFNULL(SUM(CASE WHEN ki.tgl_keluar BETWEEN ? AND ? AND k.kelas='Kelas Utama' THEN ki.lama ELSE 0 END),0) AS SIGNED) AS hari_kelas_utama,
                CAST(IFNULL(SUM(CASE WHEN ki.tgl_keluar BETWEEN ? AND ? AND k.kelas='Kelas 1'      THEN ki.lama ELSE 0 END),0) AS SIGNED) AS hari_kelas_1,
                CAST(IFNULL(SUM(CASE WHEN ki.tgl_keluar BETWEEN ? AND ? AND k.kelas='Kelas 2'      THEN ki.lama ELSE 0 END),0) AS SIGNED) AS hari_kelas_2,
                CAST(IFNULL(SUM(CASE WHEN ki.tgl_keluar BETWEEN ? AND ? AND k.kelas='Kelas 3'      THEN ki.lama ELSE 0 END),0) AS SIGNED) AS hari_kelas_3
         FROM kamar_inap ki
         INNER JOIN kamar k        ON ki.kd_kamar = k.kd_kamar
         LEFT  JOIN bangsal b      ON k.kd_bangsal = b.kd_bangsal
         LEFT  JOIN reg_periksa rp ON ki.no_rawat = rp.no_rawat
         LEFT  JOIN pasien p       ON rp.no_rkm_medis = p.no_rkm_medis
         WHERE ki.tgl_masuk <= ? AND (ki.tgl_keluar IS NULL OR ki.tgl_keluar >= ?)
         GROUP BY b.nm_bangsal
         HAVING pasien_masuk + pasien_dipindahkan + pasien_keluar_hidup +
                pasien_l_mati_lt48 + pasien_l_mati_ge48 +
                pasien_p_mati_lt48 + pasien_p_mati_ge48 > 0
         ORDER BY pasien_keluar_hidup DESC, jenis_pelayanan ASC"
    )
    // Bind 16 pairs of (bulan_dari, bulan_sampai), then 2 untuk WHERE
    .bind(&bulan_dari).bind(&bulan_sampai)
    .bind(&bulan_dari).bind(&bulan_sampai)
    .bind(&bulan_dari).bind(&bulan_sampai)
    .bind(&bulan_dari).bind(&bulan_sampai)
    .bind(&bulan_dari).bind(&bulan_sampai)
    .bind(&bulan_dari).bind(&bulan_sampai)
    .bind(&bulan_dari).bind(&bulan_sampai)
    .bind(&bulan_dari).bind(&bulan_sampai)
    .bind(&bulan_dari).bind(&bulan_sampai)
    .bind(&bulan_dari).bind(&bulan_sampai)
    .bind(&bulan_dari).bind(&bulan_sampai)
    .bind(&bulan_dari).bind(&bulan_sampai)
    .bind(&bulan_dari).bind(&bulan_sampai)
    .bind(&bulan_sampai).bind(&bulan_dari)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    let total = rows.iter().fold(Rl32Total {
        pasien_masuk: 0, pasien_dipindahkan: 0, pasien_keluar_hidup: 0,
        pasien_l_mati_lt48: 0, pasien_l_mati_ge48: 0,
        pasien_p_mati_lt48: 0, pasien_p_mati_ge48: 0,
        total_mati: 0, lama_dirawat: 0, hari_perawatan: 0,
        hari_kelas_utama: 0, hari_kelas_1: 0, hari_kelas_2: 0, hari_kelas_3: 0,
    }, |mut acc, r| {
        acc.pasien_masuk        += r.pasien_masuk;
        acc.pasien_dipindahkan  += r.pasien_dipindahkan;
        acc.pasien_keluar_hidup += r.pasien_keluar_hidup;
        acc.pasien_l_mati_lt48  += r.pasien_l_mati_lt48;
        acc.pasien_l_mati_ge48  += r.pasien_l_mati_ge48;
        acc.pasien_p_mati_lt48  += r.pasien_p_mati_lt48;
        acc.pasien_p_mati_ge48  += r.pasien_p_mati_ge48;
        acc.lama_dirawat        += r.lama_dirawat;
        acc.hari_perawatan      += r.hari_perawatan;
        acc.hari_kelas_utama    += r.hari_kelas_utama;
        acc.hari_kelas_1        += r.hari_kelas_1;
        acc.hari_kelas_2        += r.hari_kelas_2;
        acc.hari_kelas_3        += r.hari_kelas_3;
        acc
    });
    let total = Rl32Total {
        total_mati: total.pasien_l_mati_lt48 + total.pasien_l_mati_ge48
                  + total.pasien_p_mati_lt48 + total.pasien_p_mati_ge48,
        ..total
    };

    Ok(Json(Rl32Resp {
        bulan, bulan_dari, bulan_sampai, hari_periode,
        rows, total,
    }))
}

pub async fn cetak_rl32(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl32(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();

    let mut tbody = String::new();
    for (i, r) in resp.rows.iter().enumerate() {
        tbody.push_str(&format!(
            "<tr><td class=\"no\">{}</td><td><strong>{}</strong></td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td></tr>",
            i + 1, esc(&r.jenis_pelayanan),
            r.pasien_masuk, r.pasien_dipindahkan, r.pasien_keluar_hidup,
            r.pasien_l_mati_lt48, r.pasien_l_mati_ge48,
            r.pasien_p_mati_lt48, r.pasien_p_mati_ge48,
            r.lama_dirawat, r.hari_perawatan,
            r.hari_kelas_utama, r.hari_kelas_1, r.hari_kelas_2, r.hari_kelas_3,
        ));
    }
    let t = &resp.total;
    let total_row = format!(
        "<tr class=\"avg\"><td class=\"no\">99</td><td><strong>TOTAL</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td></tr>",
        t.pasien_masuk, t.pasien_dipindahkan, t.pasien_keluar_hidup,
        t.pasien_l_mati_lt48, t.pasien_l_mati_ge48,
        t.pasien_p_mati_lt48, t.pasien_p_mati_ge48,
        t.lama_dirawat, t.hari_perawatan,
        t.hari_kelas_utama, t.hari_kelas_1, t.hari_kelas_2, t.hari_kelas_3,
    );

    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();
    let bulan = &resp.bulan;
    let dari = &resp.bulan_dari;
    let sampai = &resp.bulan_sampai;
    let hari = resp.hari_periode;

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.2 Rekap Rawat Inap — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:18mm;font-size:9pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:14px}}
  table{{width:100%;border-collapse:collapse;font-size:8.5pt}}
  th,td{{border:1px solid #94a3b8;padding:3px 4px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;font-size:8pt;text-align:center;writing-mode:horizontal-tb}}
  th.subgrp{{background:#3b82f6}}
  td.no{{width:28px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.avg td{{background:#dbeafe;font-weight:bold}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:10mm}}.no-print{{display:none}}@page{{size:landscape}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.2 Rekap Rawat Inap (cetak landscape)</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.2 — Rekap Kegiatan Pelayanan Rawat Inap</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong>
  ({dari} s/d {sampai}, {hari} hari) · Tanggal cetak: {now}
</div>

<table>
  <thead>
    <tr>
      <th rowspan="2" class="no">No</th>
      <th rowspan="2">Jenis Pelayanan (Bangsal)</th>
      <th rowspan="2">Pasien Masuk</th>
      <th rowspan="2">Dipindahkan</th>
      <th rowspan="2">Keluar Hidup</th>
      <th colspan="2" class="subgrp">L Keluar Mati</th>
      <th colspan="2" class="subgrp">P Keluar Mati</th>
      <th rowspan="2">Lama Dirawat</th>
      <th rowspan="2">Hari Perawatan</th>
      <th colspan="4" class="subgrp">Rincian Hari Perawatan per Kelas</th>
    </tr>
    <tr>
      <th class="subgrp">&lt;48 jam</th><th class="subgrp">≥48 jam</th>
      <th class="subgrp">&lt;48 jam</th><th class="subgrp">≥48 jam</th>
      <th class="subgrp">Utama</th><th class="subgrp">Kls 1</th>
      <th class="subgrp">Kls 2</th><th class="subgrp">Kls 3</th>
    </tr>
  </thead>
  <tbody>{tbody}</tbody>
  <tfoot>{total_row}</tfoot>
</table>

<div class="footer">
  Compute realtime dari Khanza kamar_inap × kamar × bangsal × reg_periksa × pasien.<br/>
  Catatan: kolom "Pasien Awal/Akhir Bulan", "Pasien Pindahan (incoming)", dan "Jumlah alokasi TT awal" per JUKNIS belum termasuk — kolom override manual disediakan untuk koreksi.<br/>
  Kelas Khanza: Utama / 1 / 2 / 3 (VVIP/VIP/Khusus per JUKNIS dimasukkan ke kategori sesuai mapping internal RS).<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {prov}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now),
        bulan = esc(bulan), dari = esc(dari), sampai = esc(sampai),
        hari = hari, tbody = tbody, total_row = total_row,
        alamat = esc(&al), kab = esc(&kb), prov = esc(&pr),
    );

    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.3 — Rekap Kegiatan Pelayanan Rawat Darurat (IGD)
// Manual input per kategori JUKNIS + realtime sanity check IGD count Khanza.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl33Entry {
    pub id:              Option<i32>,
    pub bulan:           String,
    pub urutan:          Option<f64>,
    pub jenis_kode:      String,
    pub jenis_nama:      String,
    pub parent_kode:     Option<String>,
    pub is_parent:       i8,
    pub rujukan:         i32,
    pub non_rujukan:     i32,
    pub dirawat:         i32,
    pub dirujuk:         i32,
    pub pulang:          i32,
    pub mati_l:          i32,
    pub mati_p:          i32,
    pub doa_l:           i32,
    pub doa_p:           i32,
    pub luka_l:          i32,
    pub luka_p:          i32,
    pub false_emergency: i32,
    pub updated_at:      Option<String>,
    pub updated_by:      Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Rl33Khanza {
    pub total_igd:  i64,
    pub l:          i64,
    pub p:          i64,
    pub baru:       i64,
    pub lama:       i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl33KhanzaKategori {
    pub kode_kasus:  Option<String>,
    pub macam_kasus: Option<String>,
    pub jml:         i64,
    pub rujukan:     i64,
    pub non_rujukan: i64,
}

#[derive(Debug, Serialize)]
pub struct Rl33Resp {
    pub bulan:              String,
    pub bulan_dari:         String,
    pub bulan_sampai:       String,
    pub entries:            Vec<Rl33Entry>,
    pub khanza:             Rl33Khanza,
    pub khanza_per_kategori:Vec<Rl33KhanzaKategori>,
}

// Master 13 kategori (untuk auto-seed kalau bulan baru belum punya entry)
fn rl33_kategori_master() -> Vec<(f64, &'static str, &'static str, Option<&'static str>)> {
    vec![
        (1.1, "1.1", "Kecelakaan lalu lintas darat",          Some("1")),
        (1.2, "1.2", "Kecelakaan lalu lintas perairan",       Some("1")),
        (1.3, "1.3", "Kecelakaan lalu lintas udara",          Some("1")),
        (1.4, "1.4", "Bedah lainnya (non kecelakaan)",        Some("1")),
        (2.1, "2.1", "Kekerasan terhadap Perempuan (≥18 thn)",Some("2")),
        (2.2, "2.2", "Kekerasan terhadap Anak (<18 thn)",     Some("2")),
        (2.3, "2.3", "Kekerasan lainnya",                     Some("2")),
        (2.4, "2.4", "Non bedah lainnya",                     Some("2")),
        (3.0, "3",   "Kebidanan",                              None),
        (4.0, "4",   "Psikiatrik",                             None),
        (5.0, "5",   "Bayi (0-11 bulan)",                      None),
        (6.0, "6",   "Anak (1-17 tahun)",                      None),
        (7.0, "7",   "Geriatri",                               None),
    ]
}

pub async fn get_rl33(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl33Resp>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let bulan_dari = format!("{}-01", bulan);
    let (year_s, month_s) = (&bulan[..4], &bulan[5..7]);
    let year: i32 = year_s.parse().unwrap_or(2026);
    let month: u32 = month_s.parse().unwrap_or(1);
    let next_month_first = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let bulan_sampai = (next_month_first - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    // Auto-seed leaf categories kalau bulan ini belum punya entries
    let count_existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sirs_rl33_entry WHERE bulan=?"
    ).bind(&bulan).fetch_one(&state.pool).await.unwrap_or(0);
    if count_existing == 0 {
        for (urutan, kode, nama, parent) in rl33_kategori_master() {
            let _ = sqlx::query(
                "INSERT IGNORE INTO sirs_rl33_entry
                   (bulan, urutan, jenis_kode, jenis_nama, parent_kode, is_parent)
                 VALUES (?,?,?,?,?,0)"
            )
            .bind(&bulan).bind(urutan).bind(kode).bind(nama).bind(parent)
            .execute(&state.pool).await;
        }
    }

    let mut entries: Vec<Rl33Entry> = sqlx::query_as(
        "SELECT id, bulan, CAST(urutan AS DOUBLE) AS urutan,
                jenis_kode, jenis_nama, parent_kode, is_parent,
                rujukan, non_rujukan, dirawat, dirujuk, pulang,
                mati_l, mati_p, doa_l, doa_p, luka_l, luka_p, false_emergency,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl33_entry WHERE bulan=? ORDER BY urutan"
    ).bind(&bulan).fetch_all(&state.pool).await.map_err(db_err)?;

    // ── REALTIME per baris (rowkey) — port Trimitra Rl33Controller ──
    // Klasifikasi bedah/non-bedah/kekerasan/kondisi keluar/luka/false-emergency diambil
    // dari data_triase_igd_sirs (companion); fallback: kode_kasus triase lalu umur.
    // Tindak lanjut: Dirawat=ada kamar_inap, Dirujuk=ada rujuk (bila tak dirawat), sisanya Pulang.
    let rl33_agg: Vec<(String, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64)> =
        sqlx::query_as(
        "SELECT rowkey,
                CAST(SUM(is_rujukan) AS SIGNED) rujukan,
                CAST(SUM(1-is_rujukan) AS SIGNED) non_rujukan,
                CAST(SUM(CASE WHEN is_mati=0 AND is_doa=0 AND has_kamar=1 THEN 1 ELSE 0 END) AS SIGNED) dirawat,
                CAST(SUM(CASE WHEN is_mati=0 AND is_doa=0 AND has_kamar=0 AND has_rujuk=1 THEN 1 ELSE 0 END) AS SIGNED) dirujuk,
                CAST(SUM(CASE WHEN is_mati=0 AND is_doa=0 AND has_kamar=0 AND has_rujuk=0 THEN 1 ELSE 0 END) AS SIGNED) pulang,
                CAST(SUM(CASE WHEN is_mati=1 AND jk='L' THEN 1 ELSE 0 END) AS SIGNED) mati_l,
                CAST(SUM(CASE WHEN is_mati=1 AND jk='P' THEN 1 ELSE 0 END) AS SIGNED) mati_p,
                CAST(SUM(CASE WHEN is_doa=1 AND jk='L' THEN 1 ELSE 0 END) AS SIGNED) doa_l,
                CAST(SUM(CASE WHEN is_doa=1 AND jk='P' THEN 1 ELSE 0 END) AS SIGNED) doa_p,
                CAST(SUM(CASE WHEN is_luka=1 AND jk='L' THEN 1 ELSE 0 END) AS SIGNED) luka_l,
                CAST(SUM(CASE WHEN is_luka=1 AND jk='P' THEN 1 ELSE 0 END) AS SIGNED) luka_p,
                CAST(SUM(is_false) AS SIGNED) fem
         FROM (
            SELECT
                CASE
                    WHEN s.jenis_kasus='Bedah - Kecelakaan Lalu Lintas Darat' THEN '1.1'
                    WHEN s.jenis_kasus='Bedah - Kecelakaan Lalu Lintas Air' THEN '1.2'
                    WHEN s.jenis_kasus='Bedah - Kecelakaan Lalu Lintas Udara' THEN '1.3'
                    WHEN s.jenis_kasus='Bedah - Lainnya' THEN '1.4'
                    WHEN s.jenis_kasus LIKE 'Non Bedah - Kekerasan terhadap Perempuan%' THEN '2.1'
                    WHEN s.jenis_kasus LIKE 'Non Bedah - Kekerasan terhadap Anak%' THEN '2.2'
                    WHEN s.jenis_kasus='Non Bedah - Kekerasan Lainnya' THEN '2.3'
                    WHEN s.jenis_kasus='Non Bedah - Lainnya' THEN '2.4'
                    WHEN s.jenis_kasus='Kebidanan' THEN '3'
                    WHEN s.jenis_kasus='Psikiatrik' THEN '4'
                    WHEN s.jenis_kasus='Bayi' THEN '5'
                    WHEN s.jenis_kasus='Anak' THEN '6'
                    WHEN s.jenis_kasus='Geriatri' THEN '7'
                    WHEN COALESCE(dti.kode_kasus,'')='001' THEN '1.1'
                    WHEN COALESCE(dti.kode_kasus,'')='002' THEN '1.4'
                    WHEN COALESCE(dti.kode_kasus,'')='003' THEN '2.3'
                    WHEN (rp.sttsumur IN ('Hr','Bl')) OR (rp.sttsumur='Th' AND CAST(rp.umurdaftar AS UNSIGNED)<1) THEN '5'
                    WHEN rp.sttsumur='Th' AND CAST(rp.umurdaftar AS UNSIGNED) BETWEEN 1 AND 17 THEN '6'
                    WHEN rp.sttsumur='Th' AND CAST(rp.umurdaftar AS UNSIGNED)>=60 THEN '7'
                    ELSE '2.4'
                END AS rowkey,
                p.jk AS jk,
                (COALESCE(dti.alasan_kedatangan,'')='Rujukan') AS is_rujukan,
                CASE WHEN COALESCE(s.kondisi_keluar,'Hidup')='Mati di IGD'
                       OR (COALESCE(s.kondisi_keluar,'Hidup')='Hidup' AND rp.stts='Meninggal') THEN 1 ELSE 0 END AS is_mati,
                CASE WHEN COALESCE(s.kondisi_keluar,'') LIKE 'DOA%' THEN 1 ELSE 0 END AS is_doa,
                CASE WHEN EXISTS(SELECT 1 FROM kamar_inap ki WHERE ki.no_rawat=rp.no_rawat) THEN 1 ELSE 0 END AS has_kamar,
                CASE WHEN EXISTS(SELECT 1 FROM rujuk rj WHERE rj.no_rawat=rp.no_rawat) THEN 1 ELSE 0 END AS has_rujuk,
                CASE WHEN COALESCE(s.luka_luka,'Tidak')='Ya' THEN 1 ELSE 0 END AS is_luka,
                CASE WHEN COALESCE(s.false_emergency,'Tidak')='Ya' THEN 1 ELSE 0 END AS is_false
            FROM reg_periksa rp
            JOIN pasien p ON p.no_rkm_medis=rp.no_rkm_medis
            LEFT JOIN data_triase_igd dti ON dti.no_rawat=rp.no_rawat
            LEFT JOIN data_triase_igd_sirs s ON s.no_rawat=rp.no_rawat
            WHERE rp.kd_poli IN ('IGD','IGDK') AND rp.stts<>'Batal'
              AND DATE(rp.tgl_registrasi) BETWEEN ? AND ?
         ) v
         GROUP BY rowkey"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_all(&state.pool).await.unwrap_or_default();

    use std::collections::HashMap;
    let mut agg_map: HashMap<String, &(String, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64)> = HashMap::new();
    for row in &rl33_agg { agg_map.insert(row.0.clone(), row); }
    for e in entries.iter_mut() {
        if e.is_parent == 1 { continue; }
        if let Some(a) = agg_map.get(&e.jenis_kode) {
            e.rujukan = a.1 as i32;  e.non_rujukan = a.2 as i32;
            e.dirawat = a.3 as i32;  e.dirujuk = a.4 as i32;  e.pulang = a.5 as i32;
            e.mati_l = a.6 as i32;   e.mati_p = a.7 as i32;
            e.doa_l = a.8 as i32;    e.doa_p = a.9 as i32;
            e.luka_l = a.10 as i32;  e.luka_p = a.11 as i32;
            e.false_emergency = a.12 as i32;
        } else {
            e.rujukan = 0; e.non_rujukan = 0; e.dirawat = 0; e.dirujuk = 0; e.pulang = 0;
            e.mati_l = 0; e.mati_p = 0; e.doa_l = 0; e.doa_p = 0; e.luka_l = 0; e.luka_p = 0;
            e.false_emergency = 0;
        }
    }

    // Realtime Khanza: total kunjungan IGD bulan tsb
    let total_igd: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa
         WHERE kd_poli IN ('IGD','IGDK')
           AND tgl_registrasi BETWEEN ? AND ?"
    ).bind(&bulan_dari).bind(&bulan_sampai)
    .fetch_one(&state.pool).await.unwrap_or(0);

    let l: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa rp
         INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
         WHERE rp.kd_poli IN ('IGD','IGDK')
           AND rp.tgl_registrasi BETWEEN ? AND ?
           AND p.jk = 'L'"
    ).bind(&bulan_dari).bind(&bulan_sampai)
    .fetch_one(&state.pool).await.unwrap_or(0);
    let p: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa rp
         INNER JOIN pasien pa ON rp.no_rkm_medis = pa.no_rkm_medis
         WHERE rp.kd_poli IN ('IGD','IGDK')
           AND rp.tgl_registrasi BETWEEN ? AND ?
           AND pa.jk = 'P'"
    ).bind(&bulan_dari).bind(&bulan_sampai)
    .fetch_one(&state.pool).await.unwrap_or(0);
    let baru: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa
         WHERE kd_poli IN ('IGD','IGDK')
           AND tgl_registrasi BETWEEN ? AND ?
           AND stts_daftar='Baru'"
    ).bind(&bulan_dari).bind(&bulan_sampai)
    .fetch_one(&state.pool).await.unwrap_or(0);
    let lama: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa
         WHERE kd_poli IN ('IGD','IGDK')
           AND tgl_registrasi BETWEEN ? AND ?
           AND stts_daftar='Lama'"
    ).bind(&bulan_dari).bind(&bulan_sampai)
    .fetch_one(&state.pool).await.unwrap_or(0);

    // Per kategori dari data_triase_igd + master_triase_macam_kasus
    let khanza_per_kategori: Vec<Rl33KhanzaKategori> = sqlx::query_as(
        "SELECT dti.kode_kasus,
                mtmk.macam_kasus,
                CAST(COUNT(*) AS SIGNED) AS jml,
                CAST(SUM(CASE WHEN dti.alasan_kedatangan='Rujukan' THEN 1 ELSE 0 END) AS SIGNED) AS rujukan,
                CAST(SUM(CASE WHEN dti.alasan_kedatangan!='Rujukan' THEN 1 ELSE 0 END) AS SIGNED) AS non_rujukan
         FROM data_triase_igd dti
         LEFT JOIN master_triase_macam_kasus mtmk ON dti.kode_kasus = mtmk.kode_kasus
         WHERE dti.tgl_kunjungan BETWEEN ? AND ?
         GROUP BY dti.kode_kasus, mtmk.macam_kasus
         ORDER BY mtmk.kode_kasus"
    )
    .bind(&bulan_dari).bind(&bulan_sampai)
    .fetch_all(&state.pool).await.unwrap_or_default();

    Ok(Json(Rl33Resp {
        bulan,
        bulan_dari, bulan_sampai,
        entries,
        khanza: Rl33Khanza { total_igd, l, p, baru, lama },
        khanza_per_kategori,
    }))
}

pub async fn update_rl33(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl33Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl33_entry SET
           rujukan=?, non_rujukan=?, dirawat=?, dirujuk=?, pulang=?,
           mati_l=?, mati_p=?, doa_l=?, doa_p=?, luka_l=?, luka_p=?,
           false_emergency=?, updated_by=?
         WHERE id=?"
    )
    .bind(body.rujukan).bind(body.non_rujukan)
    .bind(body.dirawat).bind(body.dirujuk).bind(body.pulang)
    .bind(body.mati_l).bind(body.mati_p)
    .bind(body.doa_l).bind(body.doa_p)
    .bind(body.luka_l).bind(body.luka_p)
    .bind(body.false_emergency)
    .bind(&user.0.kode)
    .bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Entry tidak ditemukan"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl33_entry SET rujukan={}, non_rujukan={}, updated_by={} WHERE id={}",
        crate::audit::q(body.rujukan), crate::audit::q(body.non_rujukan),
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;
    Ok(Json(json!({ "success": true })))
}

pub async fn cetak_rl33(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl33(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();

    // Hitung total parent untuk 1 (Bedah) & 2 (Non Bedah)
    let parent_sum = |kode: &str| -> [i32; 12] {
        let mut sum = [0i32; 12];
        for e in resp.entries.iter().filter(|e| e.parent_kode.as_deref() == Some(kode)) {
            sum[0]  += e.rujukan;        sum[1]  += e.non_rujukan;
            sum[2]  += e.dirawat;        sum[3]  += e.dirujuk;        sum[4]  += e.pulang;
            sum[5]  += e.mati_l;         sum[6]  += e.mati_p;
            sum[7]  += e.doa_l;          sum[8]  += e.doa_p;
            sum[9]  += e.luka_l;         sum[10] += e.luka_p;
            sum[11] += e.false_emergency;
        }
        sum
    };
    let sum_bedah     = parent_sum("1");
    let sum_non_bedah = parent_sum("2");

    let mut tbody = String::new();
    // Baris 1. Bedah (induk)
    tbody.push_str(&format!(
        "<tr class=\"kat\"><td class=\"no\">1</td><td colspan=\"13\"><strong>Bedah di Instalasi Gawat Darurat</strong></td></tr>\
         <tr class=\"sum\"><td></td><td><em>Sub-total 1</em></td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td></tr>",
        sum_bedah[0], sum_bedah[1], sum_bedah[2], sum_bedah[3], sum_bedah[4],
        sum_bedah[5], sum_bedah[6], sum_bedah[7], sum_bedah[8],
        sum_bedah[9], sum_bedah[10], sum_bedah[11],
    ));
    for e in resp.entries.iter().filter(|e| e.parent_kode.as_deref() == Some("1")) {
        tbody.push_str(&fmt_rl33_row(e));
    }
    // Baris 2. Non Bedah (induk)
    tbody.push_str(&format!(
        "<tr class=\"kat\"><td class=\"no\">2</td><td colspan=\"13\"><strong>Non Bedah</strong></td></tr>\
         <tr class=\"sum\"><td></td><td><em>Sub-total 2</em></td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td></tr>",
        sum_non_bedah[0], sum_non_bedah[1], sum_non_bedah[2], sum_non_bedah[3], sum_non_bedah[4],
        sum_non_bedah[5], sum_non_bedah[6], sum_non_bedah[7], sum_non_bedah[8],
        sum_non_bedah[9], sum_non_bedah[10], sum_non_bedah[11],
    ));
    for e in resp.entries.iter().filter(|e| e.parent_kode.as_deref() == Some("2")) {
        tbody.push_str(&fmt_rl33_row(e));
    }
    // Standalone (3-7)
    for e in resp.entries.iter().filter(|e| e.parent_kode.is_none()) {
        tbody.push_str(&fmt_rl33_row(e));
    }
    // TOTAL row
    let mut tot = [0i32; 12];
    for e in &resp.entries {
        tot[0]  += e.rujukan;        tot[1]  += e.non_rujukan;
        tot[2]  += e.dirawat;        tot[3]  += e.dirujuk;        tot[4]  += e.pulang;
        tot[5]  += e.mati_l;         tot[6]  += e.mati_p;
        tot[7]  += e.doa_l;          tot[8]  += e.doa_p;
        tot[9]  += e.luka_l;         tot[10] += e.luka_p;
        tot[11] += e.false_emergency;
    }
    tbody.push_str(&format!(
        "<tr class=\"total\"><td class=\"no\">99</td><td><strong>TOTAL</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td></tr>",
        tot[0], tot[1], tot[2], tot[3], tot[4],
        tot[5], tot[6], tot[7], tot[8],
        tot[9], tot[10], tot[11],
    ));

    let total_pasien: i32 = tot[0] + tot[1];
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();
    let bulan = &resp.bulan;
    let kh = &resp.khanza;

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.3 Rawat Darurat — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:14mm;font-size:9pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:12px}}
  table{{width:100%;border-collapse:collapse;font-size:8.5pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:3px 4px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;font-size:8pt;text-align:center}}
  th.subgrp{{background:#3b82f6}}
  td.no{{width:28px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.kat td{{background:#dbeafe;color:#1e40af}}
  tr.sum td{{background:#eff6ff;font-style:italic}}
  tr.total td{{background:#bfdbfe;font-weight:bold}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:9pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:10mm}}.no-print{{display:none}}@page{{size:landscape}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.3 Rawat Darurat</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.3 — Rekap Kegiatan Pelayanan Rawat Darurat (IGD)</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  🔍 <strong>Sanity check</strong> — Khanza reg_periksa IGD bulan {bulan}:
  Total kunjungan = <strong>{khanza_total}</strong> ({khanza_l} L · {khanza_p} P · {khanza_baru} baru · {khanza_lama} lama).
  Total pasien RL 3.3 (rujukan+non-rujukan) = <strong>{total_pasien}</strong>.
  {warning}
</div>

<table>
  <thead><tr>
    <th rowspan="2" class="no">No</th><th rowspan="2">Jenis Pelayanan</th>
    <th colspan="2" class="subgrp">Total Pasien</th>
    <th colspan="3" class="subgrp">Tindak Lanjut Pelayanan</th>
    <th colspan="2" class="subgrp">Mati di IGD</th>
    <th colspan="2" class="subgrp">DOA</th>
    <th colspan="2" class="subgrp">Luka-luka</th>
    <th rowspan="2">False Emergency</th>
  </tr><tr>
    <th class="subgrp">Rujukan</th><th class="subgrp">Non Rujukan</th>
    <th class="subgrp">Dirawat</th><th class="subgrp">Dirujuk</th><th class="subgrp">Pulang</th>
    <th class="subgrp">L</th><th class="subgrp">P</th>
    <th class="subgrp">L</th><th class="subgrp">P</th>
    <th class="subgrp">L</th><th class="subgrp">P</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Compute Sanity Check dari Khanza reg_periksa (kd_poli IGD/IGDK).
  Entry per kategori JUKNIS adalah input manual (tidak auto-compute).<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), bulan = esc(bulan),
        khanza_total = kh.total_igd, khanza_l = kh.l, khanza_p = kh.p,
        khanza_baru = kh.baru, khanza_lama = kh.lama,
        total_pasien = total_pasien,
        warning = if (total_pasien as i64 - kh.total_igd).abs() > 30 {
            "<span style=\"color:#dc2626;font-weight:bold\">⚠️ Selisih cukup besar — perlu review entry per kategori.</span>".to_string()
        } else { "<span style=\"color:#16a34a\">✓ Konsisten dengan Khanza realtime.</span>".to_string() },
        tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );

    Ok(Html(html))
}

fn fmt_rl33_row(e: &Rl33Entry) -> String {
    format!(
        "<tr><td class=\"no\">{}</td><td>{}</td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td>\
         <td class=\"n\">{}</td></tr>",
        esc(&e.jenis_kode), esc(&e.jenis_nama),
        e.rujukan, e.non_rujukan,
        e.dirawat, e.dirujuk, e.pulang,
        e.mati_l, e.mati_p,
        e.doa_l, e.doa_p,
        e.luka_l, e.luka_p,
        e.false_emergency,
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.4 — Rekapitulasi Pengunjung Rumah Sakit (Bulanan)
// Per JUKNIS SIRS 6.3:
//   1. Pengunjung Baru: pertama kali ke RS, dapat nomor RM baru (per orang seumur hidup).
//   2. Pengunjung Lama: pernah berkunjung sebelumnya.
//   3. 1 pasien datang beberapa kali dalam 1 bulan = dihitung 1 (DISTINCT no_rkm_medis).
// Realtime compute dari reg_periksa × pasien (no override — data deterministik).
// ─────────────────────────────────────────────────────────────────────────────

#[derive(serde::Serialize, sqlx::FromRow)]
pub struct Rl34Cell {
    pub jk:  String, // 'L' / 'P'
    pub cnt: i64,
}

#[derive(serde::Serialize)]
pub struct Rl34Resp {
    pub bulan:          String,
    pub pengunjung_baru_l:   i64,
    pub pengunjung_baru_p:   i64,
    pub pengunjung_lama_l:   i64,
    pub pengunjung_lama_p:   i64,
    pub total_baru:          i64,
    pub total_lama:          i64,
    pub total:               i64,
}

pub async fn get_rl34(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl34Resp>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let bulan_dari = format!("{}-01", bulan);
    let (year_s, month_s) = (&bulan[..4], &bulan[5..7]);
    let year: i32 = year_s.parse().unwrap_or(2026);
    let month: u32 = month_s.parse().unwrap_or(1);
    let next_month_first = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let bulan_sampai = (next_month_first - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    // Pengunjung BARU: pasien dengan first ever visit jatuh di bulan ini
    let baru: Vec<Rl34Cell> = sqlx::query_as(
        "SELECT p.jk AS jk, CAST(COUNT(DISTINCT p.no_rkm_medis) AS SIGNED) AS cnt
         FROM pasien p
         JOIN (
            SELECT no_rkm_medis, MIN(tgl_registrasi) AS first_visit
            FROM reg_periksa
            GROUP BY no_rkm_medis
         ) f ON f.no_rkm_medis = p.no_rkm_medis
         WHERE f.first_visit BETWEEN ? AND ?
         GROUP BY p.jk"
    )
    .bind(&bulan_dari).bind(&bulan_sampai)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    // Pengunjung LAMA: pasien yang ada visit di bulan ini DAN first ever visit < awal bulan
    let lama: Vec<Rl34Cell> = sqlx::query_as(
        "SELECT p.jk AS jk, CAST(COUNT(DISTINCT p.no_rkm_medis) AS SIGNED) AS cnt
         FROM pasien p
         JOIN reg_periksa r ON r.no_rkm_medis = p.no_rkm_medis
           AND r.tgl_registrasi BETWEEN ? AND ?
         JOIN (
            SELECT no_rkm_medis, MIN(tgl_registrasi) AS first_visit
            FROM reg_periksa
            GROUP BY no_rkm_medis
         ) f ON f.no_rkm_medis = p.no_rkm_medis
         WHERE f.first_visit < ?
         GROUP BY p.jk"
    )
    .bind(&bulan_dari).bind(&bulan_sampai).bind(&bulan_dari)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    // Pengunjung LAMA tambahan (JUKNIS contoh b): pasien BARU bulan ini yang
    // datang lagi di bulan yang sama dihitung juga 1 pengunjung lama.
    let lama_extra: Vec<Rl34Cell> = sqlx::query_as(
        "SELECT p.jk AS jk, CAST(COUNT(*) AS SIGNED) AS cnt FROM (
            SELECT r.no_rkm_medis
            FROM reg_periksa r
            JOIN (SELECT no_rkm_medis, MIN(tgl_registrasi) AS fv FROM reg_periksa GROUP BY no_rkm_medis) f
              ON f.no_rkm_medis = r.no_rkm_medis
            WHERE f.fv BETWEEN ? AND ? AND r.tgl_registrasi BETWEEN ? AND ?
            GROUP BY r.no_rkm_medis HAVING COUNT(*) >= 2
         ) x JOIN pasien p ON p.no_rkm_medis = x.no_rkm_medis
         GROUP BY p.jk"
    )
    .bind(&bulan_dari).bind(&bulan_sampai).bind(&bulan_dari).bind(&bulan_sampai)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    let pick = |xs: &[Rl34Cell], jk: &str| -> i64 {
        xs.iter().find(|c| c.jk == jk).map(|c| c.cnt).unwrap_or(0)
    };
    let bl = pick(&baru, "L"); let bp = pick(&baru, "P");
    let ll = pick(&lama, "L") + pick(&lama_extra, "L");
    let lp = pick(&lama, "P") + pick(&lama_extra, "P");
    let total_baru = bl + bp;
    let total_lama = ll + lp;
    let total = total_baru + total_lama;

    Ok(Json(Rl34Resp {
        bulan,
        pengunjung_baru_l: bl, pengunjung_baru_p: bp,
        pengunjung_lama_l: ll, pengunjung_lama_p: lp,
        total_baru, total_lama, total,
    }))
}

pub async fn cetak_rl34(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl34(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.4 Rekapitulasi Pengunjung — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:18mm;font-size:10pt}}
  h1{{font-size:14pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:11pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:9pt;color:#475569;text-align:center;margin-bottom:14px}}
  table{{width:100%;border-collapse:collapse;font-size:10pt;margin-top:8px}}
  th,td{{border:1px solid #94a3b8;padding:6px 8px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;text-align:center}}
  th.subgrp{{background:#3b82f6;font-size:9.5pt}}
  td.no{{width:40px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}}
  tr.total td{{background:#bfdbfe;font-weight:bold;font-size:10.5pt}}
  .note{{margin-top:12px;padding:10px 14px;background:#fef3c7;border-left:4px solid #f59e0b;font-size:9pt;color:#78350f}}
  .footer{{margin-top:16px;font-size:9pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:14mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.4 Rekapitulasi Pengunjung</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.4 — Rekapitulasi Pengunjung Rumah Sakit</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong> · Tanggal cetak: {now}
</div>

<table>
  <thead><tr>
    <th rowspan="2" class="no">No</th>
    <th rowspan="2">Jenis Pengunjung</th>
    <th colspan="2" class="subgrp">Jenis Kelamin</th>
    <th rowspan="2">Jumlah</th>
  </tr><tr>
    <th class="subgrp">Laki-laki</th><th class="subgrp">Perempuan</th>
  </tr></thead>
  <tbody>
    <tr><td class="no">1</td><td>Pengunjung Baru</td>
        <td class="n">{bl}</td><td class="n">{bp}</td><td class="n">{tb}</td></tr>
    <tr><td class="no">2</td><td>Pengunjung Lama</td>
        <td class="n">{ll}</td><td class="n">{lp}</td><td class="n">{tl}</td></tr>
    <tr class="total"><td class="no">99</td><td><strong>TOTAL</strong></td>
        <td class="n"><strong>{tot_l}</strong></td>
        <td class="n"><strong>{tot_p}</strong></td>
        <td class="n"><strong>{tot}</strong></td></tr>
  </tbody>
</table>

<div class="note">
  📌 <strong>Definisi (JUKNIS SIRS 6.3):</strong>
  <ol style="margin:6px 0 0 18px;padding:0">
    <li><strong>Pengunjung Baru</strong> — pengunjung yang baru pertama kali datang ke Rumah Sakit dan mendapatkan nomor rekam medis baru. Nomor RM diberikan hanya sekali seumur hidup.</li>
    <li><strong>Pengunjung Lama</strong> — pengunjung yang datang untuk kedua kali dan seterusnya, baik ke poliklinik yang sama maupun berbeda. Tidak mendapat nomor RM lagi.</li>
    <li>Jika 1 pasien datang beberapa kali dalam 1 bulan → dihitung sebagai 1 pengunjung (DISTINCT no_rkm_medis).</li>
  </ol>
</div>

<div class="footer">
  Realtime compute dari Khanza <code>reg_periksa × pasien</code> (first ever visit per no_rkm_medis).<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), bulan = esc(&resp.bulan),
        bl = resp.pengunjung_baru_l, bp = resp.pengunjung_baru_p, tb = resp.total_baru,
        ll = resp.pengunjung_lama_l, lp = resp.pengunjung_lama_p, tl = resp.total_lama,
        tot_l = resp.pengunjung_baru_l + resp.pengunjung_lama_l,
        tot_p = resp.pengunjung_baru_p + resp.pengunjung_lama_p,
        tot = resp.total,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );

    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.5 — Rekapitulasi Kunjungan (Bulanan)
// Per JUKNIS SIRS 6.3 Bab IV E: 34 jenis kegiatan + TOTAL + 2 statistik.
// Manual entry (mapping kd_poli → jenis JUKNIS subjektif), realtime sanity
// dari reg_periksa × pasien × kabupaten Khanza.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl35Entry {
    pub id:          Option<i32>,
    pub bulan:       String,
    pub urutan:      i32,
    pub jenis_kode:  String,
    pub jenis_nama:  String,
    pub dalam_l:     Option<i32>,
    pub dalam_p:     Option<i32>,
    pub luar_l:      Option<i32>,
    pub luar_p:      Option<i32>,
    pub is_stat:     i8,
    pub stat_value:  Option<f64>,
    pub updated_at:  Option<String>,
    pub updated_by:  Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl35KhanzaPoli {
    pub kd_poli:  Option<String>,
    pub nm_poli:  Option<String>,
    pub dalam_l:  i64,
    pub dalam_p:  i64,
    pub luar_l:   i64,
    pub luar_p:   i64,
    pub total:    i64,
}

#[derive(Debug, Serialize)]
pub struct Rl35Khanza {
    pub kab_kota_rs:   String,
    pub total_dalam_l: i64,
    pub total_dalam_p: i64,
    pub total_luar_l:  i64,
    pub total_luar_p:  i64,
    pub total:         i64,
    pub per_poli:      Vec<Rl35KhanzaPoli>,
}

#[derive(Debug, Serialize)]
pub struct Rl35Resp {
    pub bulan:    String,
    pub entries:  Vec<Rl35Entry>,
    pub khanza:   Rl35Khanza,
}

fn rl35_kategori_master() -> Vec<(i32, &'static str, &'static str, bool)> {
    // (urutan, kode, nama, is_stat)
    vec![
        (1,  "1",  "Penyakit Dalam",                       false),
        (2,  "2",  "Bedah",                                false),
        (3,  "3",  "Kesehatan Anak (Neonatal)",            false),
        (4,  "4",  "Kesehatan Anak (Lainnya)",             false),
        (5,  "5",  "Obstetri & Ginekologi (Ibu Hamil)",    false),
        (6,  "6",  "Obstetri & Ginekologi (Lainnya)",      false),
        (7,  "7",  "Keluarga Berencana",                   false),
        (8,  "8",  "Jiwa",                                 false),
        (9,  "9",  "Napza",                                false),
        (10, "10", "Psikologi",                            false),
        (11, "11", "THT",                                  false),
        (12, "12", "Mata",                                 false),
        (13, "13", "Kulit dan Kelamin",                    false),
        (14, "14", "Gigi & Mulut",                         false),
        (15, "15", "Geriatri",                             false),
        (16, "16", "Kardiologi",                           false),
        (17, "17", "Radiologi",                            false),
        (18, "18", "Bedah Orthopedi",                      false),
        (19, "19", "Paru - Paru",                          false),
        (20, "20", "Kanker",                               false),
        (21, "21", "Uronefrologi",                         false),
        (22, "22", "Kusta",                                false),
        (23, "23", "Umum",                                 false),
        (24, "24", "Rawat Darurat",                        false),
        (25, "25", "Rehabilitasi Medik",                   false),
        (26, "26", "Akupungtur Medik",                     false),
        (27, "27", "Konsultasi Gizi",                      false),
        (28, "28", "Day Care",                             false),
        (29, "29", "Medical Check Up",                     false),
        (30, "30", "Bedah Saraf (Stroke)",                 false),
        (31, "31", "Bedah Saraf (Lainnya)",                false),
        (32, "32", "Saraf (Stroke)",                       false),
        (33, "33", "Saraf (Lainnya)",                      false),
        (34, "34", "Lain - Lain",                          false),
        (66, "66", "Rata-Rata Hari Poliklinik Buka",       true),
        (77, "77", "Rata-Rata Kunjungan per Hari",         true),
    ]
}

pub async fn get_rl35(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl35Resp>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let bulan_dari = format!("{}-01", bulan);
    let (year_s, month_s) = (&bulan[..4], &bulan[5..7]);
    let year: i32 = year_s.parse().unwrap_or(2026);
    let month: u32 = month_s.parse().unwrap_or(1);
    let next_month_first = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let bulan_sampai = (next_month_first - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    // Auto-seed kalau bulan baru belum ada entry
    let count_existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sirs_rl35_entry WHERE bulan=?"
    ).bind(&bulan).fetch_one(&state.pool).await.unwrap_or(0);
    if count_existing == 0 {
        for (urutan, kode, nama, is_stat) in rl35_kategori_master() {
            let _ = sqlx::query(
                "INSERT INTO sirs_rl35_entry
                  (bulan,urutan,jenis_kode,jenis_nama,dalam_l,dalam_p,luar_l,luar_p,is_stat,stat_value)
                 VALUES (?,?,?,?,?,?,?,?,?,?)"
            )
            .bind(&bulan).bind(urutan).bind(kode).bind(nama)
            .bind(if is_stat { None } else { Some(0) })
            .bind(if is_stat { None } else { Some(0) })
            .bind(if is_stat { None } else { Some(0) })
            .bind(if is_stat { None } else { Some(0) })
            .bind(if is_stat { 1i8 } else { 0i8 })
            .bind(if is_stat { Some(0.0) } else { None })
            .execute(&state.pool).await;
        }
    }

    let mut entries: Vec<Rl35Entry> = sqlx::query_as(
        "SELECT id, bulan, urutan, jenis_kode, jenis_nama,
                dalam_l, dalam_p, luar_l, luar_p,
                is_stat, CAST(stat_value AS DOUBLE) AS stat_value,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl35_entry WHERE bulan=? ORDER BY urutan"
    ).bind(&bulan).fetch_all(&state.pool).await.map_err(db_err)?;

    // Sanity Khanza per kd_poli (1 hari 1 pasien = 1 kunjungan)
    let kab_kota_rs: Option<String> = sqlx::query_scalar(
        "SELECT kabupaten FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;
    let kab_norm: String = kab_kota_rs.clone().unwrap_or_default()
        .to_uppercase().replace("KAB.", "").replace("KABUPATEN", "")
        .replace("KOTA", "").trim().to_string();
    let kab_like = format!("%{}%", kab_norm);

    // ── REALTIME per jenis (baris JUKNIS) — port Trimitra Rl35Controller ──
    // Poli dipetakan ke jenis lewat sirs_rl35_map_poli; 1 pasien×hari = 1 kunjungan.
    let rl35_agg: Vec<(String, Option<String>, String, i64)> = sqlx::query_as(
        "SELECT jenis, jk, dom, CAST(COUNT(DISTINCT no_rkm_medis, tgl) AS SIGNED) AS cnt FROM (
            SELECT IFNULL(m.jenis_kunjungan,'Lain - Lain') AS jenis,
                   p.jk AS jk,
                   CASE WHEN UPPER(kab.nm_kab) LIKE ? THEN 'D' ELSE 'L' END AS dom,
                   r.no_rkm_medis AS no_rkm_medis, r.tgl_registrasi AS tgl
            FROM reg_periksa r
            JOIN pasien p ON p.no_rkm_medis = r.no_rkm_medis
            LEFT JOIN kabupaten kab ON kab.kd_kab = p.kd_kab
            LEFT JOIN sirs_rl35_map_poli m ON m.kd_poli = r.kd_poli
            WHERE r.tgl_registrasi BETWEEN ? AND ?
         ) v GROUP BY jenis, jk, dom"
    ).bind(&kab_like).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_all(&state.pool).await.unwrap_or_default();

    // Peta jenis -> [dalam_l, dalam_p, luar_l, luar_p]
    let mut jmap: std::collections::HashMap<String, [i32; 4]> = std::collections::HashMap::new();
    for (jenis, jk, dom, cnt) in &rl35_agg {
        let idx = match (dom.as_str(), jk.as_deref().unwrap_or("")) {
            ("D", "L") => 0, ("D", _) => 1, (_, "L") => 2, _ => 3,
        };
        jmap.entry(jenis.clone()).or_insert([0; 4])[idx] += *cnt as i32;
    }
    let mut total_kunjungan = 0i32;
    for e in entries.iter_mut().filter(|e| e.is_stat == 0) {
        let c = jmap.get(&e.jenis_nama).copied().unwrap_or([0; 4]);
        e.dalam_l = Some(c[0]); e.dalam_p = Some(c[1]);
        e.luar_l  = Some(c[2]); e.luar_p  = Some(c[3]);
        total_kunjungan += c[0] + c[1] + c[2] + c[3];
    }
    // Stat: rata-rata hari poliklinik buka & kunjungan per hari
    let hari_buka: f64 = sqlx::query_scalar(
        "SELECT AVG(hari) FROM (
            SELECT kd_poli, COUNT(DISTINCT tgl_registrasi) AS hari
            FROM reg_periksa WHERE tgl_registrasi BETWEEN ? AND ? GROUP BY kd_poli
         ) t"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(Some(0.0)).unwrap_or(0.0);
    let hari_buka = (hari_buka * 10.0).round() / 10.0;
    let kunj_per_hari = if hari_buka > 0.0 { ((total_kunjungan as f64 / hari_buka) * 10.0).round() / 10.0 } else { 0.0 };
    for e in entries.iter_mut().filter(|e| e.is_stat == 1) {
        e.stat_value = Some(match e.jenis_kode.as_str() {
            "66" => hari_buka,
            "77" => kunj_per_hari,
            _ => 0.0,
        });
    }

    let per_poli: Vec<Rl35KhanzaPoli> = sqlx::query_as(
        "SELECT r.kd_poli AS kd_poli, p2.nm_poli AS nm_poli,
                CAST(SUM(CASE WHEN (UPPER(kab.nm_kab) LIKE ?) AND p.jk='L' THEN 1 ELSE 0 END) AS SIGNED) AS dalam_l,
                CAST(SUM(CASE WHEN (UPPER(kab.nm_kab) LIKE ?) AND p.jk='P' THEN 1 ELSE 0 END) AS SIGNED) AS dalam_p,
                CAST(SUM(CASE WHEN (UPPER(kab.nm_kab) NOT LIKE ? OR kab.nm_kab IS NULL) AND p.jk='L' THEN 1 ELSE 0 END) AS SIGNED) AS luar_l,
                CAST(SUM(CASE WHEN (UPPER(kab.nm_kab) NOT LIKE ? OR kab.nm_kab IS NULL) AND p.jk='P' THEN 1 ELSE 0 END) AS SIGNED) AS luar_p,
                CAST(COUNT(DISTINCT r.no_rkm_medis, r.tgl_registrasi, r.kd_poli) AS SIGNED) AS total
         FROM reg_periksa r
         JOIN pasien p ON p.no_rkm_medis = r.no_rkm_medis
         LEFT JOIN kabupaten kab ON kab.kd_kab = p.kd_kab
         LEFT JOIN poliklinik p2 ON p2.kd_poli = r.kd_poli
         WHERE r.tgl_registrasi BETWEEN ? AND ?
         GROUP BY r.kd_poli, p2.nm_poli
         ORDER BY total DESC"
    )
    .bind(&kab_like).bind(&kab_like).bind(&kab_like).bind(&kab_like)
    .bind(&bulan_dari).bind(&bulan_sampai)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    let mut td_l = 0i64; let mut td_p = 0i64;
    let mut tl_l = 0i64; let mut tl_p = 0i64;
    let mut tot = 0i64;
    for p in &per_poli {
        td_l += p.dalam_l; td_p += p.dalam_p;
        tl_l += p.luar_l;  tl_p += p.luar_p;
        tot  += p.total;
    }

    Ok(Json(Rl35Resp {
        bulan,
        entries,
        khanza: Rl35Khanza {
            kab_kota_rs: kab_kota_rs.unwrap_or_default(),
            total_dalam_l: td_l, total_dalam_p: td_p,
            total_luar_l: tl_l,  total_luar_p: tl_p,
            total: tot,
            per_poli,
        },
    }))
}

pub async fn update_rl35(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl35Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl35_entry SET
           dalam_l=?, dalam_p=?, luar_l=?, luar_p=?,
           stat_value=?, updated_by=?
         WHERE id=?"
    )
    .bind(body.dalam_l).bind(body.dalam_p)
    .bind(body.luar_l).bind(body.luar_p)
    .bind(body.stat_value)
    .bind(&user.0.kode)
    .bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl35_entry SET ... updated_by={} WHERE id={}",
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;

    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

pub async fn cetak_rl35(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl35(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    let mut td_l = 0i32; let mut td_p = 0i32;
    let mut tl_l = 0i32; let mut tl_p = 0i32;

    for e in resp.entries.iter().filter(|e| e.is_stat == 0) {
        let dl = e.dalam_l.unwrap_or(0);
        let dp = e.dalam_p.unwrap_or(0);
        let ll = e.luar_l.unwrap_or(0);
        let lp = e.luar_p.unwrap_or(0);
        let total = dl + dp + ll + lp;
        td_l += dl; td_p += dp; tl_l += ll; tl_p += lp;
        tbody.push_str(&format!(
            "<tr><td class=\"no\">{}</td><td>{}</td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td>\
             <td class=\"n\"><strong>{}</strong></td></tr>",
            esc(&e.jenis_kode), esc(&e.jenis_nama), dl, dp, ll, lp, total
        ));
    }
    let tot = td_l + td_p + tl_l + tl_p;
    tbody.push_str(&format!(
        "<tr class=\"total\"><td class=\"no\">99</td><td><strong>TOTAL</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td></tr>",
        td_l, td_p, tl_l, tl_p, tot
    ));
    for e in resp.entries.iter().filter(|e| e.is_stat == 1) {
        tbody.push_str(&format!(
            "<tr class=\"stat\"><td class=\"no\">{}</td><td>{}</td>\
             <td class=\"n\" colspan=\"4\"></td>\
             <td class=\"n\"><strong>{:.2}</strong></td></tr>",
            esc(&e.jenis_kode), esc(&e.jenis_nama), e.stat_value.unwrap_or(0.0)
        ));
    }

    let kh = &resp.khanza;
    let kh_total: i64 = kh.total;
    let diff = (tot as i64 - kh_total).abs();
    let warn = if diff > 200 {
        format!("<span style=\"color:#dc2626;font-weight:bold\">⚠️ Selisih {} kunjungan vs Khanza realtime — review mapping kd_poli.</span>", diff)
    } else {
        "<span style=\"color:#16a34a\">✓ Selisih wajar dengan Khanza realtime.</span>".to_string()
    };

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.5 Rekapitulasi Kunjungan — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:14mm;font-size:9pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:12px}}
  table{{width:100%;border-collapse:collapse;font-size:8.5pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:3px 6px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;font-size:8pt;text-align:center}}
  th.subgrp{{background:#3b82f6}}
  td.no{{width:36px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.total td{{background:#bfdbfe;font-weight:bold}}
  tr.stat td{{background:#fef3c7;font-style:italic}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:9pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:10mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.5 Rekapitulasi Kunjungan</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.5 — Rekapitulasi Kunjungan</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  🔍 <strong>Sanity check</strong> — Khanza reg_periksa × pasien × kabupaten ({kab_rs}):
  Total kunjungan = <strong>{kh_total}</strong>
  ({kh_dl} Dalam-L · {kh_dp} Dalam-P · {kh_ll} Luar-L · {kh_lp} Luar-P).
  Total RL 3.5 (manual) = <strong>{tot}</strong>. {warn}
</div>

<table>
  <thead><tr>
    <th rowspan="2" class="no">No</th><th rowspan="2">Jenis Kegiatan</th>
    <th colspan="2" class="subgrp">Dalam Kab/Kota</th>
    <th colspan="2" class="subgrp">Luar Kab/Kota</th>
    <th rowspan="2">Total Kunjungan</th>
  </tr><tr>
    <th class="subgrp">L</th><th class="subgrp">P</th>
    <th class="subgrp">L</th><th class="subgrp">P</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Compute Sanity Check dari Khanza <code>reg_periksa × pasien × kabupaten</code>
  (1 hari 1 pasien 1 poli = 1 kunjungan).<br/>
  Mapping kd_poli → jenis JUKNIS bersifat manual. Statistik 66/77 diisi manual oleh petugas SIRS.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), bulan = esc(&resp.bulan),
        kab_rs = esc(&kh.kab_kota_rs),
        kh_total = kh_total, kh_dl = kh.total_dalam_l, kh_dp = kh.total_dalam_p,
        kh_ll = kh.total_luar_l, kh_lp = kh.total_luar_p,
        tot = tot, warn = warn, tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );

    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.6 — Rekapitulasi Kegiatan Pelayanan Kebidanan (Bulanan)
// Per JUKNIS SIRS 6.3 Bab IV F. 34 baris (29 leaf + 5 parent), 11 num fields/leaf.
// Manual entry, sanity ringan dari Khanza catatan_persalinan + reg_periksa OBG.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl36Entry {
    pub id:              Option<i32>,
    pub bulan:           String,
    pub urutan:          Option<f64>,
    pub jenis_kode:      String,
    pub jenis_nama:      String,
    pub parent_kode:     Option<String>,
    pub is_parent:       i8,
    pub rm_rs:           Option<i32>,
    pub rm_bidan:        Option<i32>,
    pub rm_puskes:       Option<i32>,
    pub rm_faskes_lain:  Option<i32>,
    pub rm_hidup:        Option<i32>,
    pub rm_mati:         Option<i32>,
    pub rnm_hidup:       Option<i32>,
    pub rnm_mati:        Option<i32>,
    pub nr_hidup:        Option<i32>,
    pub nr_mati:         Option<i32>,
    pub dirujuk:         Option<i32>,
    pub updated_at:      Option<String>,
    pub updated_by:      Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Rl36Mortality {
    pub maternal_total:    i64,  // female 15-49 yg meninggal di bulan ini
    pub maternal_icd_o:    i64,  // di antaranya yang ICD O00-O99
    pub doa_perempuan:     i64,  // temp_meninggal='Lain-lain (Termasuk Doa)' female 15-49
}

#[derive(Debug, Serialize)]
pub struct Rl36Khanza {
    pub persalinan_khanza:  i64,
    pub obstetri_ralan:     i64,
    pub obstetri_ranap:     i64,
    pub kunjungan_obg:      i64,
    pub bayi_baru_lahir:    i64,
    pub ibu_nifas:          i64,
    pub mortality:          Rl36Mortality,
    pub per_row:            Vec<Rl36KhanzaPerRow>,
}

#[derive(Debug, Serialize)]
pub struct Rl36KhanzaPerRow {
    pub jenis_kode: String,
    pub count:      i64,
    pub sumber:     String,
}

#[derive(Debug, Serialize)]
pub struct Rl36Resp {
    pub bulan:   String,
    pub entries: Vec<Rl36Entry>,
    pub khanza:  Rl36Khanza,
}

fn rl36_kategori_master() -> Vec<(f64, &'static str, &'static str, Option<&'static str>, bool)> {
    // (urutan, kode, nama, parent, is_parent)
    vec![
        (1.0,  "1",   "Pemberian Buku KIA pada Ibu Hamil",                                None,      false),
        (2.0,  "2",   "Pelayanan Antenatal",                                              None,      false),
        (3.0,  "3",   "Persalinan:",                                                      None,      true),
        (3.1,  "3.1", "Persalinan pervaginam tanpa penyulit (normal)",                    Some("3"), false),
        (3.2,  "3.2", "Persalinan pervaginam spontan dengan penyulit",                    Some("3"), false),
        (3.3,  "3.3", "Persalinan pervaginam dengan bantuan",                             Some("3"), false),
        (3.4,  "3.4", "Persalinan Sectio caesaria",                                       Some("3"), false),
        (4.0,  "4",   "Komplikasi obstetri pada ibu hamil, bersalin, dan nifas",          None,      true),
        (4.1,  "4.1", "Perdarahan sebelum persalinan",                                    Some("4"), false),
        (4.2,  "4.2", "Perdarahan setelah persalinan",                                    Some("4"), false),
        (4.3,  "4.3", "Pre eklamsia",                                                     Some("4"), false),
        (4.4,  "4.4", "Eklamsia",                                                         Some("4"), false),
        (4.5,  "4.5", "Infeksi",                                                          Some("4"), false),
        (4.6,  "4.6", "Abortus",                                                          Some("4"), false),
        (4.7,  "4.7", "Komplikasi lainnya",                                               Some("4"), false),
        (5.0,  "5",   "Aborsi",                                                           None,      true),
        (5.1,  "5.1", "Aborsi atas indikasi kedaruratan medis",                           Some("5"), false),
        (5.2,  "5.2", "Aborsi atas indikasi kehamilan akibat perkosaan",                  Some("5"), false),
        (6.0,  "6",   "Skrining Status Imunisasi Tetanus",                                None,      false),
        (7.0,  "7",   "Komplikasi non obstetri pada ibu hamil, bersalin, dan nifas",      None,      true),
        (7.1,  "7.1", "HIV",                                                              Some("7"), false),
        (7.2,  "7.2", "Hepatitis B",                                                      Some("7"), false),
        (7.3,  "7.3", "Sifilis",                                                          Some("7"), false),
        (7.4,  "7.4", "Tuberkulosis",                                                     Some("7"), false),
        (7.5,  "7.5", "Penyakit jantung",                                                 Some("7"), false),
        (7.6,  "7.6", "Anemia",                                                           Some("7"), false),
        (7.7,  "7.7", "Diabetes Melitus",                                                 Some("7"), false),
        (7.8,  "7.8", "Terkonfirmasi COVID-19",                                           Some("7"), false),
        (7.9,  "7.9", "Komplikasi lainnya",                                               Some("7"), false),
        (8.0,  "8",   "Ibu Hamil berisiko mempunyai bayi prematur",                       None,      true),
        (8.1,  "8.1", "Diberikan antenatal kortikosteroid",                               Some("8"), false),
        (8.2,  "8.2", "Tidak diberikan antenatal kortikosteroid",                         Some("8"), false),
        (9.0,  "9",   "Pelayanan Nifas",                                                  None,      false),
        (10.0, "10",  "Ibu Nifas mendapat vitamin A",                                     None,      false),
    ]
}

pub async fn get_rl36(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl36Resp>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let bulan_dari = format!("{}-01", bulan);
    let (year_s, month_s) = (&bulan[..4], &bulan[5..7]);
    let year: i32 = year_s.parse().unwrap_or(2026);
    let month: u32 = month_s.parse().unwrap_or(1);
    let next_month_first = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let bulan_sampai = (next_month_first - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
    let bulan_sampai_dt = format!("{} 23:59:59", bulan_sampai);

    let count_existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sirs_rl36_entry WHERE bulan=?"
    ).bind(&bulan).fetch_one(&state.pool).await.unwrap_or(0);
    if count_existing == 0 {
        for (urutan, kode, nama, parent, is_parent) in rl36_kategori_master() {
            let _ = sqlx::query(
                "INSERT INTO sirs_rl36_entry
                  (bulan,urutan,jenis_kode,jenis_nama,parent_kode,is_parent,
                   rm_rs,rm_bidan,rm_puskes,rm_faskes_lain,rm_hidup,rm_mati,
                   rnm_hidup,rnm_mati,nr_hidup,nr_mati,dirujuk)
                 VALUES (?,?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?)"
            )
            .bind(&bulan).bind(urutan).bind(kode).bind(nama).bind(parent)
            .bind(if is_parent { 1i8 } else { 0i8 })
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0i32) })
            .execute(&state.pool).await;
        }
    }

    let mut entries: Vec<Rl36Entry> = sqlx::query_as(
        "SELECT id, bulan, CAST(urutan AS DOUBLE) AS urutan, jenis_kode, jenis_nama,
                parent_kode, is_parent,
                rm_rs, rm_bidan, rm_puskes, rm_faskes_lain, rm_hidup, rm_mati,
                rnm_hidup, rnm_mati, nr_hidup, nr_mati, dirujuk,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl36_entry WHERE bulan=? ORDER BY urutan"
    ).bind(&bulan).fetch_all(&state.pool).await.map_err(db_err)?;

    // REALTIME: nol-kan dulu semua baris leaf; baris ber-spec ditimpa matriks di bawah.
    for e in entries.iter_mut().filter(|e| e.is_parent == 0) {
        e.rm_rs = Some(0); e.rm_bidan = Some(0); e.rm_puskes = Some(0); e.rm_faskes_lain = Some(0);
        e.rm_hidup = Some(0); e.rm_mati = Some(0); e.rnm_hidup = Some(0); e.rnm_mati = Some(0);
        e.nr_hidup = Some(0); e.nr_mati = Some(0); e.dirujuk = Some(0);
    }

    // Sanity Khanza
    let persalinan_khanza: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT no_rawat) FROM catatan_persalinan
         WHERE mulai BETWEEN ? AND ?"
    ).bind(&bulan_dari).bind(&bulan_sampai_dt)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let obstetri_ralan: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT no_rawat) FROM pemeriksaan_obstetri_ralan
         WHERE tgl_perawatan BETWEEN ? AND ?"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let obstetri_ranap: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT no_rawat) FROM pemeriksaan_obstetri_ranap
         WHERE tgl_perawatan BETWEEN ? AND ?"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let kunjungan_obg: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa
         WHERE kd_poli IN ('OBG','OBSGYN','OBGYN') AND tgl_registrasi BETWEEN ? AND ?"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let bayi_baru_lahir: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT no_rawat) FROM penilaian_bayi_baru_lahir
         WHERE tanggal BETWEEN ? AND ?"
    ).bind(&bulan_dari).bind(&bulan_sampai_dt)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let ibu_nifas: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT no_rawat) FROM asesmen_khusus_kebidanan_ibu_nifas
         WHERE tanggal BETWEEN ? AND ?"
    ).bind(&bulan_dari).bind(&bulan_sampai_dt)
     .fetch_one(&state.pool).await.unwrap_or(0);

    // ── Maternal mortality dari pasien_mati ───────────────────────────────
    // Asumsi: perempuan usia 15-49 yang meninggal dalam bulan = candidate maternal
    let maternal_total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pasien_mati pm
         JOIN pasien p ON p.no_rkm_medis=pm.no_rkm_medis
         WHERE pm.tanggal BETWEEN ? AND ?
           AND p.jk='P'
           AND TIMESTAMPDIFF(YEAR, p.tgl_lahir, pm.tanggal) BETWEEN 15 AND 49"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let maternal_icd_o: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pasien_mati pm
         JOIN pasien p ON p.no_rkm_medis=pm.no_rkm_medis
         WHERE pm.tanggal BETWEEN ? AND ?
           AND p.jk='P'
           AND TIMESTAMPDIFF(YEAR, p.tgl_lahir, pm.tanggal) BETWEEN 15 AND 49
           AND (pm.icd1 LIKE 'O%' OR pm.icd2 LIKE 'O%' OR pm.icd3 LIKE 'O%' OR pm.icd4 LIKE 'O%')"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let doa_perempuan: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pasien_mati pm
         JOIN pasien p ON p.no_rkm_medis=pm.no_rkm_medis
         WHERE pm.tanggal BETWEEN ? AND ?
           AND p.jk='P'
           AND TIMESTAMPDIFF(YEAR, p.tgl_lahir, pm.tanggal) BETWEEN 15 AND 49
           AND pm.temp_meninggal='Lain-lain (Termasuk Doa)'"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let mortality = Rl36Mortality { maternal_total, maternal_icd_o, doa_perempuan };

    // Per-row sugesti dari diagnosa_pasien + prosedur_pasien (Mei 2026 sample: SC=9, O14=9, ...)
    // Mapping JUKNIS row → ICD-10/ICD-9 prefix LIKE pattern
    let row_specs: Vec<(&str, &str, Vec<(&str, &str)>)> = vec![
        // (jenis_kode, label_sumber, list of (table, LIKE pattern))
        ("2",   "Diagnosa O00-O99 ralan + USG OBSGYN (88.78)", vec![
            ("d_ralan", "O%"), ("p", "88.78"), ("p", "88.79"),
        ]),
        ("3.1", "Diagnosa O80 (persalinan normal)", vec![("d", "O80%")]),
        ("3.2", "Diagnosa O81/O83 (penyulit pervaginam)", vec![("d", "O81%"), ("d", "O83%")]),
        ("3.3", "Prosedur 72.x (vakum/forceps)", vec![("p", "72%")]),
        ("3.4", "Prosedur 74.x (Cesarean) + dx O82", vec![("p", "74%"), ("d", "O82%")]),
        ("4.1", "Diagnosa O44-O46 (perdarahan antepartum)", vec![("d", "O44%"), ("d", "O45%"), ("d", "O46%")]),
        ("4.2", "Diagnosa O72 (perdarahan postpartum)", vec![("d", "O72%")]),
        ("4.3", "Diagnosa O14 (pre eklamsia)", vec![("d", "O14%")]),
        ("4.4", "Diagnosa O15 (eklamsia)", vec![("d", "O15%")]),
        ("4.5", "Diagnosa O85/O86 (infeksi nifas)", vec![("d", "O85%"), ("d", "O86%")]),
        ("4.6", "Diagnosa O02-O08 (abortus)", vec![("d", "O02%"), ("d", "O03%"), ("d", "O04%"), ("d", "O05%"), ("d", "O06%"), ("d", "O07%"), ("d", "O08%")]),
        ("5.1", "Diagnosa O04 atau prosedur 69.5x", vec![("d", "O04%"), ("p", "69.5%")]),
        ("6",   "Diagnosa Z23 (vaksinasi tetanus)", vec![("d", "Z23%")]),
        // 7.x — strict per JUKNIS "pada ibu hamil/bersalin/nifas" → ICD O98/O99/O24 only
        ("7.1", "Maternal HIV (O98.7)",      vec![("d", "O98.7%")]),
        ("7.2", "Maternal Hep B (O98.4)",    vec![("d", "O98.4%")]),
        ("7.3", "Maternal Sifilis (O98.1)",  vec![("d", "O98.1%")]),
        ("7.4", "Maternal TB (O98.0)",       vec![("d", "O98.0%")]),
        ("7.5", "Maternal jantung (O99.4)",  vec![("d", "O99.4%")]),
        ("7.6", "Maternal anemia (O99.0)",   vec![("d", "O99.0%")]),
        ("7.7", "DM dalam kehamilan (O24)",  vec![("d", "O24%")]),
        ("7.8", "COVID (U07.x)", vec![("d", "U07%")]),
        ("9",   "Pelayanan Nifas: dx Z39 atau O85-O92 lain", vec![("d", "Z39%"), ("d", "O87%"), ("d", "O88%"), ("d", "O89%"), ("d", "O90%"), ("d", "O91%"), ("d", "O92%")]),
    ];

    let mut per_row: Vec<Rl36KhanzaPerRow> = Vec::new();
    for (jenis_kode, sumber, patterns) in &row_specs {
        // Build UNION ALL of COUNT DISTINCT per pattern, then SUM distinct via subquery.
        // Simpler: collect all matching no_rawat into one set via UNION DISTINCT.
        let mut unions: Vec<String> = Vec::new();
        let mut binds: Vec<String> = Vec::new();
        for (tbl, pat) in patterns {
            match *tbl {
                "d" => {
                    unions.push(
                        "SELECT dp.no_rawat FROM diagnosa_pasien dp
                         JOIN reg_periksa r ON r.no_rawat=dp.no_rawat
                         WHERE r.tgl_registrasi BETWEEN ? AND ? AND dp.kd_penyakit LIKE ?".to_string());
                    binds.push(bulan_dari.clone()); binds.push(bulan_sampai.clone()); binds.push((*pat).to_string());
                }
                "d_ralan" => {
                    unions.push(
                        "SELECT dp.no_rawat FROM diagnosa_pasien dp
                         JOIN reg_periksa r ON r.no_rawat=dp.no_rawat
                         WHERE r.tgl_registrasi BETWEEN ? AND ? AND dp.status='Ralan' AND dp.kd_penyakit LIKE ?".to_string());
                    binds.push(bulan_dari.clone()); binds.push(bulan_sampai.clone()); binds.push((*pat).to_string());
                }
                "p" => {
                    unions.push(
                        "SELECT pp.no_rawat FROM prosedur_pasien pp
                         JOIN reg_periksa r ON r.no_rawat=pp.no_rawat
                         WHERE r.tgl_registrasi BETWEEN ? AND ? AND pp.kode LIKE ?".to_string());
                    binds.push(bulan_dari.clone()); binds.push(bulan_sampai.clone()); binds.push((*pat).to_string());
                }
                _ => {}
            }
        }
        if unions.is_empty() { continue; }
        let union_sql = unions.join(" UNION ");
        // Matriks 9 metrik (port Trimitra Rl36Controller::rowMatrix): faskes perujuk dari
        // rujuk_masuk.perujuk / bridging_sep.nmppkrujukan; Mati=reg.stts='Meninggal';
        // Dirujuk=ada rujuk (keluar). Rujukan Non Medis tak dicatat Khanza (=0).
        let matrix_sql = format!(
            "SELECT
                CAST(SUM(rm=1 AND fas='RS') AS SIGNED) AS c0,
                CAST(SUM(rm=1 AND fas='BIDAN') AS SIGNED) AS c1,
                CAST(SUM(rm=1 AND fas='PKM') AS SIGNED) AS c2,
                CAST(SUM(rm=1 AND fas IN ('KESMAS','LAIN')) AS SIGNED) AS c3,
                CAST(SUM(rm=1 AND mati=0) AS SIGNED) AS c4,
                CAST(SUM(rm=1 AND mati=1) AS SIGNED) AS c5,
                CAST(SUM(rm=0 AND mati=0) AS SIGNED) AS c6,
                CAST(SUM(rm=0 AND mati=1) AS SIGNED) AS c7,
                CAST(SUM(dirujuk=1) AS SIGNED) AS c8
             FROM (
                SELECT rm, mati, dirujuk,
                    CASE
                        WHEN rm=0 THEN 'LAIN'
                        WHEN src_rs=1 THEN 'RS'
                        WHEN UPPER(src) REGEXP 'RUMAH SAKIT|RSUD|RSIA|RSU|(^| )RS( |$)' THEN 'RS'
                        WHEN UPPER(src) REGEXP 'BIDAN|BPM|PMB' THEN 'BIDAN'
                        WHEN UPPER(src) REGEXP 'KLINIK|KLNK' THEN 'KESMAS'
                        WHEN UPPER(src) REGEXP 'PUSKESMAS|PKM|PUSTU' THEN 'PKM'
                        ELSE 'PKM'
                    END fas
                FROM (
                    SELECT
                        (EXISTS(SELECT 1 FROM rujuk_masuk rmk WHERE rmk.no_rawat=nr.no_rawat)
                         OR EXISTS(SELECT 1 FROM bridging_sep bs WHERE bs.no_rawat=nr.no_rawat AND bs.no_rujukan IS NOT NULL AND bs.no_rujukan<>'')) AS rm,
                        COALESCE(
                            (SELECT rmk.perujuk FROM rujuk_masuk rmk WHERE rmk.no_rawat=nr.no_rawat LIMIT 1),
                            (SELECT bs.nmppkrujukan FROM bridging_sep bs WHERE bs.no_rawat=nr.no_rawat AND bs.no_rujukan<>'' LIMIT 1),
                            '') AS src,
                        (EXISTS(SELECT 1 FROM bridging_sep bs WHERE bs.no_rawat=nr.no_rawat AND bs.asal_rujukan='2. Faskes 2(RS)')) AS src_rs,
                        (reg.stts='Meninggal') AS mati,
                        EXISTS(SELECT 1 FROM rujuk rk WHERE rk.no_rawat=nr.no_rawat) AS dirujuk
                    FROM (SELECT DISTINCT no_rawat FROM ({}) mm) nr
                    JOIN reg_periksa reg ON reg.no_rawat=nr.no_rawat
                ) a
             ) b", union_sql);
        let mut mq = sqlx::query_as::<_, (i64,i64,i64,i64,i64,i64,i64,i64,i64)>(&matrix_sql);
        for b in &binds { mq = mq.bind(b); }
        let m = mq.fetch_one(&state.pool).await.unwrap_or((0,0,0,0,0,0,0,0,0));
        if let Some(e) = entries.iter_mut().find(|e| &e.jenis_kode == jenis_kode) {
            e.rm_rs = Some(m.0 as i32);     e.rm_bidan = Some(m.1 as i32);
            e.rm_puskes = Some(m.2 as i32); e.rm_faskes_lain = Some(m.3 as i32);
            e.rm_hidup = Some(m.4 as i32);  e.rm_mati = Some(m.5 as i32);
            e.rnm_hidup = Some(0);          e.rnm_mati = Some(0);
            e.nr_hidup = Some(m.6 as i32);  e.nr_mati = Some(m.7 as i32);
            e.dirujuk = Some(m.8 as i32);
        }
        per_row.push(Rl36KhanzaPerRow {
            jenis_kode: jenis_kode.to_string(),
            count: m.4 + m.5 + m.6 + m.7,
            sumber: sumber.to_string(),
        });
    }

    Ok(Json(Rl36Resp {
        bulan,
        entries,
        khanza: Rl36Khanza {
            persalinan_khanza, obstetri_ralan, obstetri_ranap,
            kunjungan_obg, bayi_baru_lahir, ibu_nifas,
            mortality,
            per_row,
        },
    }))
}

pub async fn update_rl36(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl36Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl36_entry SET
           rm_rs=?, rm_bidan=?, rm_puskes=?, rm_faskes_lain=?,
           rm_hidup=?, rm_mati=?,
           rnm_hidup=?, rnm_mati=?,
           nr_hidup=?, nr_mati=?,
           dirujuk=?, updated_by=?
         WHERE id=?"
    )
    .bind(body.rm_rs).bind(body.rm_bidan).bind(body.rm_puskes).bind(body.rm_faskes_lain)
    .bind(body.rm_hidup).bind(body.rm_mati)
    .bind(body.rnm_hidup).bind(body.rnm_mati)
    .bind(body.nr_hidup).bind(body.nr_mati)
    .bind(body.dirujuk)
    .bind(&user.0.kode)
    .bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl36_entry SET ... updated_by={} WHERE id={}",
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;
    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

fn rl36_row_total_rm(e: &Rl36Entry) -> (i32, i32) {
    // (total_rm_sumber, total_rm_status)
    let s = e.rm_rs.unwrap_or(0) + e.rm_bidan.unwrap_or(0)
          + e.rm_puskes.unwrap_or(0) + e.rm_faskes_lain.unwrap_or(0);
    let t = e.rm_hidup.unwrap_or(0) + e.rm_mati.unwrap_or(0);
    (s, t)
}

fn fmt_rl36_row(e: &Rl36Entry) -> String {
    if e.is_parent == 1 {
        return format!(
            "<tr class=\"kat\"><td class=\"no\">{}</td><td colspan=\"15\"><strong>{}</strong></td></tr>",
            esc(&e.jenis_kode), esc(&e.jenis_nama)
        );
    }
    let rm_total = e.rm_hidup.unwrap_or(0) + e.rm_mati.unwrap_or(0);
    let rnm_total = e.rnm_hidup.unwrap_or(0) + e.rnm_mati.unwrap_or(0);
    let nr_total = e.nr_hidup.unwrap_or(0) + e.nr_mati.unwrap_or(0);
    format!(
        "<tr><td class=\"no\">{}</td><td>{}</td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\">{}</td></tr>",
        esc(&e.jenis_kode), esc(&e.jenis_nama),
        e.rm_rs.unwrap_or(0), e.rm_bidan.unwrap_or(0),
        e.rm_puskes.unwrap_or(0), e.rm_faskes_lain.unwrap_or(0),
        e.rm_hidup.unwrap_or(0), e.rm_mati.unwrap_or(0), rm_total,
        e.rnm_hidup.unwrap_or(0), e.rnm_mati.unwrap_or(0), rnm_total,
        e.nr_hidup.unwrap_or(0), e.nr_mati.unwrap_or(0), nr_total,
        e.dirujuk.unwrap_or(0),
    )
}

pub async fn cetak_rl36(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl36(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    // Hitung peringatan validasi (rule 32: sumber rujukan medis = status hidup+mati)
    let mut warn_rules: Vec<String> = Vec::new();
    for e in resp.entries.iter().filter(|e| e.is_parent == 0) {
        let (s, t) = rl36_row_total_rm(e);
        if s != t {
            warn_rules.push(format!("Baris {} ({}): RM sumber {} ≠ RM status {}", e.jenis_kode, e.jenis_nama, s, t));
        }
    }
    let warn_html = if warn_rules.is_empty() {
        "<span style=\"color:#16a34a\">✓ Validasi rujukan medis konsisten.</span>".to_string()
    } else {
        format!("<span style=\"color:#dc2626;font-weight:bold\">⚠️ {} baris RM tidak konsisten:</span> <ul style=\"margin:4px 0 0 16px\">{}</ul>",
            warn_rules.len(),
            warn_rules.iter().take(5).map(|w| format!("<li>{}</li>", esc(w))).collect::<String>())
    };

    let mut tbody = String::new();
    for e in &resp.entries {
        tbody.push_str(&fmt_rl36_row(e));
    }

    let kh = &resp.khanza;

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.6 Pelayanan Kebidanan — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:10mm;font-size:8.5pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:10px}}
  table{{width:100%;border-collapse:collapse;font-size:7.5pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:2px 3px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;font-size:7.5pt;text-align:center}}
  th.subgrp{{background:#3b82f6}}
  th.subgrp2{{background:#6366f1}}
  td.no{{width:32px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.kat td{{background:#dbeafe;color:#1e40af;font-size:8.5pt}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:8.5pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:8mm}}.no-print{{display:none}}@page{{size:landscape}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.6 Pelayanan Kebidanan (landscape)</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.6 — Rekapitulasi Kegiatan Pelayanan Kebidanan</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  🔍 <strong>Sanity Khanza</strong>:
  catatan_persalinan = <strong>{kh_p}</strong> ·
  obstetri ralan = <strong>{kh_or}</strong> · obstetri ranap = <strong>{kh_orw}</strong> ·
  reg_periksa OBG = <strong>{kh_obg}</strong> ·
  bayi baru lahir = <strong>{kh_bbl}</strong> · ibu nifas = <strong>{kh_nf}</strong>.<br/>
  💀 <strong>Maternal mortality (pasien_mati × female 15-49 thn)</strong>:
  total = <strong>{mt_mat}</strong> · ICD O00-O99 = <strong>{mt_mat_o}</strong> · DOA = <strong>{mt_doa}</strong><br/>
  {warn}
</div>

<table>
  <thead><tr>
    <th rowspan="2" class="no">No</th><th rowspan="2">Jenis Kegiatan</th>
    <th colspan="7" class="subgrp">Rujukan Medis</th>
    <th colspan="3" class="subgrp2">Rujukan Non Medis</th>
    <th colspan="3" class="subgrp">Non Rujukan</th>
    <th rowspan="2">Dirujuk</th>
  </tr><tr>
    <th class="subgrp">RS</th><th class="subgrp">Bidan</th>
    <th class="subgrp">Puskes</th><th class="subgrp">Faskes Lain</th>
    <th class="subgrp">Hidup</th><th class="subgrp">Mati</th><th class="subgrp">Total</th>
    <th class="subgrp2">Hidup</th><th class="subgrp2">Mati</th><th class="subgrp2">Total</th>
    <th class="subgrp">Hidup</th><th class="subgrp">Mati</th><th class="subgrp">Total</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Validasi rule 32 JUKNIS: jumlah pasien Rujukan Medis (RS+Bidan+Puskes+Faskes lainnya) harus sama dengan Hidup+Mati pada kolom RM.<br/>
  Manual entry per leaf (29 baris). Khanza catatan_persalinan/obstetri sebagai sanity check tipis (data kebidanan Khanza belum lengkap).<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), bulan = esc(&resp.bulan),
        kh_p = kh.persalinan_khanza, kh_or = kh.obstetri_ralan, kh_orw = kh.obstetri_ranap,
        kh_obg = kh.kunjungan_obg, kh_bbl = kh.bayi_baru_lahir, kh_nf = kh.ibu_nifas,
        mt_mat = kh.mortality.maternal_total,
        mt_mat_o = kh.mortality.maternal_icd_o,
        mt_doa = kh.mortality.doa_perempuan,
        warn = warn_html, tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );

    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.7 — Rekapitulasi Pelayanan Neonatal, Bayi, dan Balita (Bulanan)
// Per JUKNIS SIRS 6.3 Bab IV G. Struktur kolom sama dengan RL 3.6.
// 38 baris: 29 leaf + 9 parent, terbagi section A (Neonatal) + B (Bayi/Balita).
// Sanity: diagnosa P/Q/Z38 + reg_periksa × pasien age breakdown + penilaian_awal_keperawatan_ralan_bayi.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl37Entry {
    pub id:              Option<i32>,
    pub bulan:           String,
    pub urutan:          Option<f64>,
    pub jenis_kode:      String,
    pub jenis_nama:      String,
    pub parent_kode:     Option<String>,
    pub is_parent:       i8,
    pub section:         Option<String>,
    pub rm_rs:           Option<i32>,
    pub rm_bidan:        Option<i32>,
    pub rm_puskes:       Option<i32>,
    pub rm_faskes_lain:  Option<i32>,
    pub rm_hidup:        Option<i32>,
    pub rm_mati:         Option<i32>,
    pub rnm_hidup:       Option<i32>,
    pub rnm_mati:        Option<i32>,
    pub nr_hidup:        Option<i32>,
    pub nr_mati:         Option<i32>,
    pub dirujuk:         Option<i32>,
    pub updated_at:      Option<String>,
    pub updated_by:      Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Rl37PasienBayi {
    pub total:           i64,
    pub bbler_lt1000:    i64,    // <1000g
    pub bblsr_1000_1500: i64,    // 1000-1499g
    pub bblr_1500_2500:  i64,    // 1500-2499g
    pub bbln_2500_4000:  i64,    // 2500-3999g
    pub bbll_ge4000:     i64,    // >=4000g
    pub proses_spontan:  i64,
    pub proses_sc:       i64,
    pub proses_vakum_forceps: i64,
    pub asfiksia_apgar1_lt7:  i64,
}

#[derive(Debug, Serialize)]
pub struct Rl37Mortality {
    pub neonatal_dini_0_7h:   i64,  // age 0-7 hari saat meninggal
    pub neonatal_lanjut_8_28h: i64, // age 8-28 hari saat meninggal
    pub lahir_mati:           i64,  // ICD P95 atau age=0 hari + meninggal hari yang sama
    pub bayi_29h_11bl:        i64,  // 29 hari - 11 bulan (untuk konteks)
    pub balita_12_59bl:       i64,
}

#[derive(Debug, Serialize)]
pub struct Rl37Khanza {
    // ── Patokan utama: pasien_bayi (yang lahir di RS) ──
    pub pasien_bayi_total_all_time: i64,
    pub pasien_bayi_bulan_ini:      Rl37PasienBayi,
    // ── Mortality dari pasien_mati × age ──
    pub mortality:         Rl37Mortality,
    // ── Sanity sekunder ──
    pub livebirth_z38:     i64,
    pub kunjungan_ralan_bayi: i64,
    pub bbl_0_28h:         i64,
    pub bayi_29h_11bl:     i64,
    pub balita_12_59bl:    i64,
    pub neonatus_prematur: i64,
    pub neonatus_kelainan_bawaan: i64,
    pub per_row:           Vec<Rl36KhanzaPerRow>,
}

#[derive(Debug, Serialize)]
pub struct Rl37Resp {
    pub bulan:   String,
    pub entries: Vec<Rl37Entry>,
    pub khanza:  Rl37Khanza,
}

pub async fn get_rl37(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl37Resp>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let bulan_dari = format!("{}-01", bulan);
    let (year_s, month_s) = (&bulan[..4], &bulan[5..7]);
    let year: i32 = year_s.parse().unwrap_or(2026);
    let month: u32 = month_s.parse().unwrap_or(1);
    let next_month_first = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let bulan_sampai = (next_month_first - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
    let bulan_sampai_dt = format!("{} 23:59:59", bulan_sampai);

    let mut entries: Vec<Rl37Entry> = sqlx::query_as(
        "SELECT id, bulan, CAST(urutan AS DOUBLE) AS urutan, jenis_kode, jenis_nama,
                parent_kode, is_parent, section,
                rm_rs, rm_bidan, rm_puskes, rm_faskes_lain, rm_hidup, rm_mati,
                rnm_hidup, rnm_mati, nr_hidup, nr_mati, dirujuk,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl37_entry WHERE bulan=? ORDER BY urutan"
    ).bind(&bulan).fetch_all(&state.pool).await.map_err(db_err)?;

    // ── Patokan utama: pasien_bayi (bayi lahir di RS) ─────────────────────
    // pasien_bayi.no_rkm_medis = ibu's RM, filter ibu yg punya reg_periksa
    // status_lanjut='Ranap' dalam bulan target (asumsi: persalinan event).
    let pasien_bayi_total_all_time: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pasien_bayi"
    ).fetch_one(&state.pool).await.unwrap_or(0);

    let pasien_bayi_bulan_ini: Rl37PasienBayi = {
        let row: (i64, i64, i64, i64, i64, i64, i64, i64, i64, i64) = sqlx::query_as(
            "SELECT
              CAST(COUNT(*) AS SIGNED) AS total,
              CAST(SUM(CASE WHEN CAST(pb.berat_badan AS UNSIGNED)<1000 THEN 1 ELSE 0 END) AS SIGNED) AS bbler,
              CAST(SUM(CASE WHEN CAST(pb.berat_badan AS UNSIGNED) BETWEEN 1000 AND 1499 THEN 1 ELSE 0 END) AS SIGNED) AS bblsr,
              CAST(SUM(CASE WHEN CAST(pb.berat_badan AS UNSIGNED) BETWEEN 1500 AND 2499 THEN 1 ELSE 0 END) AS SIGNED) AS bblr,
              CAST(SUM(CASE WHEN CAST(pb.berat_badan AS UNSIGNED) BETWEEN 2500 AND 3999 THEN 1 ELSE 0 END) AS SIGNED) AS bbln,
              CAST(SUM(CASE WHEN CAST(pb.berat_badan AS UNSIGNED) >= 4000 THEN 1 ELSE 0 END) AS SIGNED) AS bbll,
              CAST(SUM(CASE WHEN UPPER(pb.proses_lahir) LIKE '%SPONTAN%' THEN 1 ELSE 0 END) AS SIGNED) AS spt,
              CAST(SUM(CASE WHEN UPPER(pb.proses_lahir) LIKE '%SC%' OR UPPER(pb.proses_lahir) LIKE '%SECTIO%' THEN 1 ELSE 0 END) AS SIGNED) AS sc,
              CAST(SUM(CASE WHEN UPPER(pb.proses_lahir) LIKE '%VAKUM%' OR UPPER(pb.proses_lahir) LIKE '%VACUUM%' OR UPPER(pb.proses_lahir) LIKE '%FORCEP%' THEN 1 ELSE 0 END) AS SIGNED) AS vk,
              CAST(SUM(CASE WHEN CAST(pb.n1 AS UNSIGNED) < 7 AND CAST(pb.n1 AS UNSIGNED) > 0 THEN 1 ELSE 0 END) AS SIGNED) AS asfiksia
             FROM pasien_bayi pb
             WHERE EXISTS (
               SELECT 1 FROM reg_periksa r
               WHERE r.no_rkm_medis = pb.no_rkm_medis
                 AND r.status_lanjut='Ranap'
                 AND r.tgl_registrasi BETWEEN ? AND ?
             )"
        ).bind(&bulan_dari).bind(&bulan_sampai)
         .fetch_one(&state.pool).await.unwrap_or((0,0,0,0,0,0,0,0,0,0));
        Rl37PasienBayi {
            total: row.0,
            bbler_lt1000: row.1, bblsr_1000_1500: row.2, bblr_1500_2500: row.3,
            bbln_2500_4000: row.4, bbll_ge4000: row.5,
            proses_spontan: row.6, proses_sc: row.7, proses_vakum_forceps: row.8,
            asfiksia_apgar1_lt7: row.9,
        }
    };

    // ── Sanity Khanza (sekunder) ─────────────────────────────────────────────
    let livebirth_z38: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT dp.no_rawat) FROM diagnosa_pasien dp
         JOIN reg_periksa r ON r.no_rawat=dp.no_rawat
         WHERE r.tgl_registrasi BETWEEN ? AND ? AND dp.kd_penyakit LIKE 'Z38%'"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let kunjungan_ralan_bayi: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT no_rawat) FROM penilaian_awal_keperawatan_ralan_bayi
         WHERE tanggal BETWEEN ? AND ?"
    ).bind(&bulan_dari).bind(&bulan_sampai_dt)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let bbl_0_28h: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT r.no_rawat) FROM reg_periksa r
         JOIN pasien p ON p.no_rkm_medis=r.no_rkm_medis
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND TIMESTAMPDIFF(DAY, p.tgl_lahir, r.tgl_registrasi) BETWEEN 0 AND 28"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let bayi_29h_11bl: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT r.no_rawat) FROM reg_periksa r
         JOIN pasien p ON p.no_rkm_medis=r.no_rkm_medis
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND TIMESTAMPDIFF(DAY, p.tgl_lahir, r.tgl_registrasi) BETWEEN 29 AND 334"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let balita_12_59bl: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT r.no_rawat) FROM reg_periksa r
         JOIN pasien p ON p.no_rkm_medis=r.no_rkm_medis
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND TIMESTAMPDIFF(MONTH, p.tgl_lahir, r.tgl_registrasi) BETWEEN 12 AND 59"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let neonatus_prematur: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT b.no_rawat) FROM penilaian_awal_keperawatan_ralan_bayi b
         WHERE b.tanggal BETWEEN ? AND ? AND b.umurkelahiran='Kurang Bulan'"
    ).bind(&bulan_dari).bind(&bulan_sampai_dt)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let neonatus_kelainan_bawaan: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT b.no_rawat) FROM penilaian_awal_keperawatan_ralan_bayi b
         WHERE b.tanggal BETWEEN ? AND ? AND b.kelainanbawaan='Ada'"
    ).bind(&bulan_dari).bind(&bulan_sampai_dt)
     .fetch_one(&state.pool).await.unwrap_or(0);

    // ── Mortality dari pasien_mati × pasien (age) ───────────────────────
    let neonatal_dini_0_7h: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pasien_mati pm
         JOIN pasien p ON p.no_rkm_medis=pm.no_rkm_medis
         WHERE pm.tanggal BETWEEN ? AND ?
           AND TIMESTAMPDIFF(DAY, p.tgl_lahir, pm.tanggal) BETWEEN 0 AND 7"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let neonatal_lanjut_8_28h: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pasien_mati pm
         JOIN pasien p ON p.no_rkm_medis=pm.no_rkm_medis
         WHERE pm.tanggal BETWEEN ? AND ?
           AND TIMESTAMPDIFF(DAY, p.tgl_lahir, pm.tanggal) BETWEEN 8 AND 28"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let lahir_mati: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pasien_mati pm
         JOIN pasien p ON p.no_rkm_medis=pm.no_rkm_medis
         WHERE pm.tanggal BETWEEN ? AND ?
           AND (pm.icd1 LIKE 'P95%' OR pm.icd2 LIKE 'P95%' OR pm.icd3 LIKE 'P95%' OR pm.icd4 LIKE 'P95%'
                OR TIMESTAMPDIFF(DAY, p.tgl_lahir, pm.tanggal) = 0)"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let mortality_bayi_29_11bl: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pasien_mati pm
         JOIN pasien p ON p.no_rkm_medis=pm.no_rkm_medis
         WHERE pm.tanggal BETWEEN ? AND ?
           AND TIMESTAMPDIFF(DAY, p.tgl_lahir, pm.tanggal) BETWEEN 29 AND 334"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let mortality_balita_12_59bl: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pasien_mati pm
         JOIN pasien p ON p.no_rkm_medis=pm.no_rkm_medis
         WHERE pm.tanggal BETWEEN ? AND ?
           AND TIMESTAMPDIFF(MONTH, p.tgl_lahir, pm.tanggal) BETWEEN 12 AND 59"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let mortality = Rl37Mortality {
        neonatal_dini_0_7h, neonatal_lanjut_8_28h, lahir_mati,
        bayi_29h_11bl: mortality_bayi_29_11bl,
        balita_12_59bl: mortality_balita_12_59bl,
    };

    // ── Per-row sugesti ICD ────────────────────────────────────────────────
    // 4.1 Asfiksia P21, 4.2 Trauma P10-P15, 4.3 BBLR P07, 4.4 Tetanus A33,
    // 4.5 Kelainan Bawaan Q00-Q99, 4.6 COVID U07, 4.7 Sepsis P36/P39, 4.8 lain P00-P96 lain
    // 8.x age breakdown (manual via TIMESTAMPDIFF)
    // 9.x Gizi buruk E40-E46
    let row_specs: Vec<(&str, &str, Vec<(&str, &str)>)> = vec![
        ("1.1.1", "Prematur + BBLR (1500-2500): P07.1", vec![("d", "P07.1%")]),
        ("1.1.2", "Prematur + BBLSR (1000-1500): P07.0/P07.1", vec![("d", "P07.0%")]),
        ("1.1.3", "Prematur + BBLER (<1000)", vec![("d", "P07.0%")]),
        ("2.1",   "Lahir Mati Antepartum: P95",       vec![("d", "P95%")]),
        ("2.2",   "Lahir Mati Intrapartum: P95",      vec![("d", "P95%")]),
        ("4.1",   "Asfiksia: P21",                    vec![("d", "P21%")]),
        ("4.2",   "Trauma Kelahiran: P10-P15",        vec![("d", "P10%"), ("d", "P11%"), ("d", "P12%"), ("d", "P13%"), ("d", "P14%"), ("d", "P15%")]),
        ("4.3",   "BBLR: P07",                        vec![("d", "P07%")]),
        ("4.4",   "Tetanus Neonatorum: A33",          vec![("d", "A33%")]),
        ("4.5",   "Kelainan Bawaan: Q00-Q99",         vec![("d", "Q%")]),
        ("4.6",   "Covid-19 neonatal: U07",           vec![("d", "U07%")]),
        ("4.7",   "Infeksi/Sepsis: P36/P39",          vec![("d", "P36%"), ("d", "P39%")]),
        ("9.1",   "Gizi Buruk 0-5 bl: E40-E46",       vec![("d", "E40%"), ("d", "E41%"), ("d", "E42%"), ("d", "E43%"), ("d", "E44%"), ("d", "E45%"), ("d", "E46%")]),
        ("9.2",   "Gizi Buruk 6-59 bl: E40-E46",      vec![("d", "E40%"), ("d", "E41%"), ("d", "E42%"), ("d", "E43%"), ("d", "E44%"), ("d", "E45%"), ("d", "E46%")]),
    ];
    let mut per_row: Vec<Rl36KhanzaPerRow> = Vec::new();
    for (jenis_kode, sumber, patterns) in &row_specs {
        let mut unions: Vec<String> = Vec::new();
        let mut binds: Vec<String> = Vec::new();
        for (tbl, pat) in patterns {
            match *tbl {
                "d" => {
                    unions.push(
                        "SELECT dp.no_rawat FROM diagnosa_pasien dp
                         JOIN reg_periksa r ON r.no_rawat=dp.no_rawat
                         WHERE r.tgl_registrasi BETWEEN ? AND ? AND dp.kd_penyakit LIKE ?".to_string());
                    binds.push(bulan_dari.clone()); binds.push(bulan_sampai.clone()); binds.push((*pat).to_string());
                }
                "p" => {
                    unions.push(
                        "SELECT pp.no_rawat FROM prosedur_pasien pp
                         JOIN reg_periksa r ON r.no_rawat=pp.no_rawat
                         WHERE r.tgl_registrasi BETWEEN ? AND ? AND pp.kode LIKE ?".to_string());
                    binds.push(bulan_dari.clone()); binds.push(bulan_sampai.clone()); binds.push((*pat).to_string());
                }
                _ => {}
            }
        }
        let union_sql = unions.join(" UNION ");
        let sql = format!("SELECT COUNT(*) FROM ({}) x", union_sql);
        let mut q = sqlx::query_scalar(&sql);
        for b in &binds { q = q.bind(b); }
        let cnt: i64 = q.fetch_one(&state.pool).await.unwrap_or(0);
        per_row.push(Rl36KhanzaPerRow {
            jenis_kode: jenis_kode.to_string(),
            count: cnt,
            sumber: sumber.to_string(),
        });
    }
    // Age-based sugesti (direct values)
    per_row.push(Rl36KhanzaPerRow { jenis_kode: "8.1".to_string(), count: bbl_0_28h,      sumber: "Age 0-28 hari di reg_periksa × pasien".to_string() });
    per_row.push(Rl36KhanzaPerRow { jenis_kode: "8.2".to_string(), count: bayi_29h_11bl,  sumber: "Age 29 hari-11 bulan".to_string() });
    per_row.push(Rl36KhanzaPerRow { jenis_kode: "8.3".to_string(), count: balita_12_59bl, sumber: "Age 12-59 bulan".to_string() });

    // ── Patokan utama pasien_bayi → per_row sugesti ──
    let pb = &pasien_bayi_bulan_ini;
    per_row.push(Rl36KhanzaPerRow { jenis_kode: "1".to_string(),     count: pb.total,             sumber: "pasien_bayi (lahir di RS) — patokan utama".to_string() });
    per_row.push(Rl36KhanzaPerRow { jenis_kode: "1.1.1".to_string(), count: pb.bblr_1500_2500,    sumber: "pasien_bayi BB 1500-2499g".to_string() });
    per_row.push(Rl36KhanzaPerRow { jenis_kode: "1.1.2".to_string(), count: pb.bblsr_1000_1500,   sumber: "pasien_bayi BB 1000-1499g".to_string() });
    per_row.push(Rl36KhanzaPerRow { jenis_kode: "1.1.3".to_string(), count: pb.bbler_lt1000,      sumber: "pasien_bayi BB <1000g".to_string() });
    per_row.push(Rl36KhanzaPerRow { jenis_kode: "1.2.2".to_string(), count: pb.bbln_2500_4000,    sumber: "pasien_bayi BB 2500-3999g".to_string() });
    per_row.push(Rl36KhanzaPerRow { jenis_kode: "1.2.3".to_string(), count: pb.bbll_ge4000,       sumber: "pasien_bayi BB ≥4000g".to_string() });
    per_row.push(Rl36KhanzaPerRow { jenis_kode: "4.1".to_string(),   count: pb.asfiksia_apgar1_lt7, sumber: "pasien_bayi Apgar 1' <7 (asfiksia) + dx P21".to_string() });

    // ── Mortality per row sugesti (pasien_mati × age) ──
    per_row.push(Rl36KhanzaPerRow { jenis_kode: "2.1".to_string(),   count: lahir_mati,             sumber: "pasien_mati ICD P95 atau umur=0 hari (lahir mati)".to_string() });
    per_row.push(Rl36KhanzaPerRow { jenis_kode: "3.1".to_string(),   count: neonatal_dini_0_7h,     sumber: "pasien_mati × age 0-7 hari".to_string() });
    per_row.push(Rl36KhanzaPerRow { jenis_kode: "3.2".to_string(),   count: neonatal_lanjut_8_28h,  sumber: "pasien_mati × age 8-28 hari".to_string() });

    // ── Form SIRS neonatal/balita (data_bayi_sirs, key no_rkm_medis) ──
    // Baris 5/6/7/10/11.x dari flag data_bayi_sirs='Ya' + kunjungan bulan ini.
    for (kode, field) in [
        ("5", "metode_kanguru"), ("6", "imd"), ("7", "skrining_hipotiroid"),
        ("10", "buku_kia"), ("11.1", "skr_pertumbuhan"), ("11.2", "skr_perkembangan"),
        ("11.3", "skr_bicara"), ("11.4", "skr_motorik"), ("11.5", "skr_perilaku"),
        ("11.6", "skr_pendengaran"), ("11.7", "skr_penglihatan"),
    ] {
        let sql = format!(
            "SELECT COUNT(DISTINCT db.no_rkm_medis) FROM data_bayi_sirs db
             JOIN reg_periksa r ON r.no_rkm_medis=db.no_rkm_medis AND r.tgl_registrasi BETWEEN ? AND ?
             WHERE db.`{}`='Ya'", field);
        let cnt: i64 = sqlx::query_scalar(&sql).bind(&bulan_dari).bind(&bulan_sampai)
            .fetch_one(&state.pool).await.unwrap_or(0);
        per_row.push(Rl36KhanzaPerRow { jenis_kode: kode.to_string(), count: cnt,
            sumber: format!("data_bayi_sirs {}='Ya'", field) });
    }

    // ── Imunisasi (baris 12.x) best-effort via nama barang/target disease ──
    for (kode, rx) in [
        ("12.1", "HB.?0|HEPATITIS B|EUVAX"), ("12.2", "BCG"),
        ("12.3", "OPV|BOPV|POLIO ORAL|POLIO TETES"), ("12.4", "DPT|DTP|PENTA"),
        ("12.5", "IPV"), ("12.6", "CAMPAK|RUBELLA|MEASLES|(^| )MR( |$)"),
        ("12.7", "VIT.*A|VITAMIN A"),
    ] {
        let cnt: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM imunisasi_pasien ip
             JOIN reg_periksa r ON r.no_rawat=ip.no_rawat
             LEFT JOIN databarang db ON db.kode_brng=ip.kode_brng
             WHERE r.tgl_registrasi BETWEEN ? AND ?
               AND (UPPER(IFNULL(db.nama_brng,'')) REGEXP ? OR UPPER(IFNULL(ip.target_disease_display,'')) REGEXP ?)"
        ).bind(&bulan_dari).bind(&bulan_sampai).bind(rx).bind(rx)
         .fetch_one(&state.pool).await.unwrap_or(0);
        per_row.push(Rl36KhanzaPerRow { jenis_kode: kode.to_string(), count: cnt,
            sumber: format!("imunisasi_pasien best-effort ({})", rx) });
    }

    // ── REALTIME: timpa entries dari peta count per baris ──
    // Baris kematian (lahir mati / kematian neonatal) → kolom Mati; sisanya → Hidup.
    // Kolom faskes & rujukan medis/non-medis tak diklasifikasi Khanza utk neonatal (=0).
    let cnt_map: std::collections::HashMap<&str, i64> =
        per_row.iter().map(|r| (r.jenis_kode.as_str(), r.count)).collect();
    let baris_mati = ["2.1", "2.2", "3.1", "3.2"];
    for e in entries.iter_mut().filter(|e| e.is_parent == 0) {
        let c = cnt_map.get(e.jenis_kode.as_str()).copied().unwrap_or(0) as i32;
        e.rm_rs = Some(0); e.rm_bidan = Some(0); e.rm_puskes = Some(0); e.rm_faskes_lain = Some(0);
        e.rm_hidup = Some(0); e.rm_mati = Some(0); e.rnm_hidup = Some(0); e.rnm_mati = Some(0);
        e.dirujuk = Some(0);
        if baris_mati.contains(&e.jenis_kode.as_str()) {
            e.nr_hidup = Some(0); e.nr_mati = Some(c);
        } else {
            e.nr_hidup = Some(c); e.nr_mati = Some(0);
        }
    }

    Ok(Json(Rl37Resp {
        bulan,
        entries,
        khanza: Rl37Khanza {
            pasien_bayi_total_all_time,
            pasien_bayi_bulan_ini,
            mortality,
            livebirth_z38, kunjungan_ralan_bayi,
            bbl_0_28h, bayi_29h_11bl, balita_12_59bl,
            neonatus_prematur, neonatus_kelainan_bawaan,
            per_row,
        },
    }))
}

pub async fn update_rl37(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl37Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl37_entry SET
           rm_rs=?, rm_bidan=?, rm_puskes=?, rm_faskes_lain=?,
           rm_hidup=?, rm_mati=?,
           rnm_hidup=?, rnm_mati=?,
           nr_hidup=?, nr_mati=?,
           dirujuk=?, updated_by=?
         WHERE id=?"
    )
    .bind(body.rm_rs).bind(body.rm_bidan).bind(body.rm_puskes).bind(body.rm_faskes_lain)
    .bind(body.rm_hidup).bind(body.rm_mati)
    .bind(body.rnm_hidup).bind(body.rnm_mati)
    .bind(body.nr_hidup).bind(body.nr_mati)
    .bind(body.dirujuk)
    .bind(&user.0.kode)
    .bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl37_entry SET ... updated_by={} WHERE id={}",
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;
    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

fn fmt_rl37_row(e: &Rl37Entry) -> String {
    if e.is_parent == 1 {
        return format!(
            "<tr class=\"kat\"><td class=\"no\">{}</td><td colspan=\"15\"><strong>{}</strong></td></tr>",
            esc(&e.jenis_kode), esc(&e.jenis_nama)
        );
    }
    let rm_total = e.rm_hidup.unwrap_or(0) + e.rm_mati.unwrap_or(0);
    let rnm_total = e.rnm_hidup.unwrap_or(0) + e.rnm_mati.unwrap_or(0);
    let nr_total = e.nr_hidup.unwrap_or(0) + e.nr_mati.unwrap_or(0);
    format!(
        "<tr><td class=\"no\">{}</td><td>{}</td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\">{}</td></tr>",
        esc(&e.jenis_kode), esc(&e.jenis_nama),
        e.rm_rs.unwrap_or(0), e.rm_bidan.unwrap_or(0),
        e.rm_puskes.unwrap_or(0), e.rm_faskes_lain.unwrap_or(0),
        e.rm_hidup.unwrap_or(0), e.rm_mati.unwrap_or(0), rm_total,
        e.rnm_hidup.unwrap_or(0), e.rnm_mati.unwrap_or(0), rnm_total,
        e.nr_hidup.unwrap_or(0), e.nr_mati.unwrap_or(0), nr_total,
        e.dirujuk.unwrap_or(0),
    )
}

pub async fn cetak_rl37(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl37(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    let mut prev_section: Option<String> = None;
    for e in &resp.entries {
        // Insert section header when section changes
        if e.section != prev_section {
            if let Some(s) = &e.section {
                let label = if s == "A" { "A. NEONATAL" } else { "B. BAYI DAN ANAK BALITA" };
                tbody.push_str(&format!(
                    "<tr class=\"section\"><td class=\"no\">{}</td><td colspan=\"15\"><strong>{}</strong></td></tr>",
                    s, label
                ));
            }
            prev_section = e.section.clone();
        }
        tbody.push_str(&fmt_rl37_row(e));
    }

    let kh = &resp.khanza;
    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.7 Neonatal/Bayi/Balita — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:10mm;font-size:8.5pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:10px}}
  table{{width:100%;border-collapse:collapse;font-size:7.5pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:2px 3px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;font-size:7.5pt;text-align:center}}
  th.subgrp{{background:#3b82f6}}
  th.subgrp2{{background:#6366f1}}
  td.no{{width:38px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.kat td{{background:#dbeafe;color:#1e40af;font-size:8.5pt}}
  tr.section td{{background:#1e40af;color:#fff;font-size:9pt;letter-spacing:1px}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:8.5pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:8mm}}.no-print{{display:none}}@page{{size:landscape}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.7 Neonatal/Bayi/Balita (landscape)</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.7 — Rekapitulasi Pelayanan Neonatal, Bayi, dan Balita</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  🍼 <strong>Patokan utama — pasien_bayi (lahir di RS) bulan ini</strong>:
  total = <strong>{pb_total}</strong>
  · BBLR (1500-2500g)=<strong>{pb_bblr}</strong> · BBLSR=<strong>{pb_bblsr}</strong> · BBLER=<strong>{pb_bbler}</strong>
  · BBLN=<strong>{pb_bbln}</strong> · BBLL=<strong>{pb_bbll}</strong><br/>
  Proses lahir: Spontan=<strong>{pb_spt}</strong> · SC=<strong>{pb_sc}</strong> · Vakum/Forceps=<strong>{pb_vk}</strong>
  · Asfiksia (Apgar 1' &lt;7)=<strong>{pb_asf}</strong>
  · Total pasien_bayi all-time di DB: {pb_all}<br/>
  💀 <strong>Mortality (pasien_mati × age)</strong>:
  Lahir Mati (P95 atau umur=0)=<strong>{mt_lahir}</strong>
  · Neonatal Dini 0-7h=<strong>{mt_dini}</strong>
  · Neonatal Lanjut 8-28h=<strong>{mt_lanjut}</strong>
  · Bayi 29h-11bl=<strong>{mt_bayi}</strong>
  · Balita 12-59bl=<strong>{mt_balita}</strong><br/>
  <em>Sanity sekunder:</em> Z38={z38} · ralan_bayi={ralan_bayi} · prematur={prematur} · kel.bawaan={kel_bawaan} ·
  age: BBL 0-28h={bbl} · Bayi 29h-11bl={by} · Balita 12-59bl={bal}
</div>

<table>
  <thead><tr>
    <th rowspan="2" class="no">No</th><th rowspan="2">Jenis Kegiatan</th>
    <th colspan="7" class="subgrp">Rujukan Medis</th>
    <th colspan="3" class="subgrp2">Rujukan Non Medis</th>
    <th colspan="3" class="subgrp">Non Rujukan</th>
    <th rowspan="2">Dirujuk</th>
  </tr><tr>
    <th class="subgrp">RS</th><th class="subgrp">Bidan</th>
    <th class="subgrp">Puskes</th><th class="subgrp">Faskes Lain</th>
    <th class="subgrp">Hidup</th><th class="subgrp">Mati</th><th class="subgrp">Total</th>
    <th class="subgrp2">Hidup</th><th class="subgrp2">Mati</th><th class="subgrp2">Total</th>
    <th class="subgrp">Hidup</th><th class="subgrp">Mati</th><th class="subgrp">Total</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Section A (Neonatal): 0-28 hari. Section B (Bayi/Balita): bayi baru lahir hingga 59 bulan.<br/>
  Sanity dari diagnosa_pasien ICD P00-P96/Q00-Q99/Z38, prosedur_pasien, penilaian_awal_keperawatan_ralan_bayi, age dari reg_periksa × pasien.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), bulan = esc(&resp.bulan),
        pb_total = kh.pasien_bayi_bulan_ini.total,
        pb_bblr  = kh.pasien_bayi_bulan_ini.bblr_1500_2500,
        pb_bblsr = kh.pasien_bayi_bulan_ini.bblsr_1000_1500,
        pb_bbler = kh.pasien_bayi_bulan_ini.bbler_lt1000,
        pb_bbln  = kh.pasien_bayi_bulan_ini.bbln_2500_4000,
        pb_bbll  = kh.pasien_bayi_bulan_ini.bbll_ge4000,
        pb_spt   = kh.pasien_bayi_bulan_ini.proses_spontan,
        pb_sc    = kh.pasien_bayi_bulan_ini.proses_sc,
        pb_vk    = kh.pasien_bayi_bulan_ini.proses_vakum_forceps,
        pb_asf   = kh.pasien_bayi_bulan_ini.asfiksia_apgar1_lt7,
        pb_all   = kh.pasien_bayi_total_all_time,
        mt_lahir = kh.mortality.lahir_mati,
        mt_dini  = kh.mortality.neonatal_dini_0_7h,
        mt_lanjut= kh.mortality.neonatal_lanjut_8_28h,
        mt_bayi  = kh.mortality.bayi_29h_11bl,
        mt_balita= kh.mortality.balita_12_59bl,
        z38 = kh.livebirth_z38, ralan_bayi = kh.kunjungan_ralan_bayi,
        prematur = kh.neonatus_prematur, kel_bawaan = kh.neonatus_kelainan_bawaan,
        bbl = kh.bbl_0_28h, by = kh.bayi_29h_11bl, bal = kh.balita_12_59bl,
        tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.8 — Rekapitulasi Pelayanan Laboratorium (Bulanan)
// Per JUKNIS SIRS 6.3 Bab IV H. ~155 baris, section A (PK) / B (MB) / C (Parasit) / D (PA).
// Kolom per leaf: Jml L, Jml P, Rata-rata L, Rata-rata P.
// Sumber Khanza: periksa_lab × jns_perawatan_lab (kategori PK/MB/PA).
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl38Entry {
    pub id:          Option<i32>,
    pub bulan:       String,
    pub urutan:      Option<f64>,
    pub jenis_kode:  String,
    pub jenis_nama:  String,
    pub parent_kode: Option<String>,
    pub is_parent:   i8,
    pub section:     Option<String>,
    pub jml_l:       Option<i32>,
    pub jml_p:       Option<i32>,
    pub rata_l:      Option<f64>,
    pub rata_p:      Option<f64>,
    pub updated_at:  Option<String>,
    pub updated_by:  Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl38KhanzaTop {
    pub nm_perawatan: Option<String>,
    pub kategori:     Option<String>,
    pub jml:          i64,
    pub jml_l:        i64,
    pub jml_p:        i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl38KhanzaKategori {
    pub kategori:  Option<String>,
    pub jml:       i64,
    pub jml_l:     i64,
    pub jml_p:     i64,
    pub pasien:    i64,
}

#[derive(Debug, Serialize)]
pub struct Rl38Khanza {
    pub total_pemeriksaan: i64,
    pub total_pasien:      i64,
    pub per_kategori:      Vec<Rl38KhanzaKategori>,
    pub top_jenis:         Vec<Rl38KhanzaTop>,
}

#[derive(Debug, Serialize)]
pub struct Rl38Resp {
    pub bulan:   String,
    pub entries: Vec<Rl38Entry>,
    pub khanza:  Rl38Khanza,
}

// Master 155 rows (urutan, kode, nama, parent_kode, is_parent, section)
fn rl38_master() -> Vec<(f64, &'static str, &'static str, Option<&'static str>, bool, &'static str)> {
    vec![
        // ── Section A — PATOLOGI KLINIK ──
        (1.00,  "1",    "Hematologi",                                                  None, true, "A"),
        (1.10,  "1.1",  "Kadar Hemoglobin",                                            Some("1"), false, "A"),
        (1.20,  "1.2",  "Nilai Hematokrit",                                            Some("1"), false, "A"),
        (1.30,  "1.3",  "Hitung Lekosit",                                              Some("1"), false, "A"),
        (1.40,  "1.4",  "Hitung Eritrosit",                                            Some("1"), false, "A"),
        (1.50,  "1.5",  "Hitung Eosinophil",                                           Some("1"), false, "A"),
        (1.60,  "1.6",  "Hitung Jenis Lekosit (%/absolut)",                            Some("1"), false, "A"),
        (1.70,  "1.7",  "Laju Endap Darah",                                            Some("1"), false, "A"),
        (1.80,  "1.8",  "Hitung Retikulosit",                                          Some("1"), false, "A"),
        (1.90,  "1.9",  "Hitung Trombosit",                                            Some("1"), false, "A"),
        (2.00,  "2",    "Kimia Klinik",                                                None, true, "A"),
        (2.10,  "2.1",  "Protein Total",                                               Some("2"), false, "A"),
        (2.20,  "2.2",  "Albumin",                                                     Some("2"), false, "A"),
        (2.30,  "2.3",  "Globulin",                                                    Some("2"), false, "A"),
        (2.40,  "2.4",  "Bilirubin Total/Direk/Indirek",                               Some("2"), false, "A"),
        (2.50,  "2.5",  "SGOT/AST",                                                    Some("2"), false, "A"),
        (2.60,  "2.6",  "SGPT/ALT",                                                    Some("2"), false, "A"),
        (2.70,  "2.7",  "Ureum/BUN",                                                   Some("2"), false, "A"),
        (2.80,  "2.8",  "Kreatinin (eGFR)",                                            Some("2"), false, "A"),
        (2.90,  "2.9",  "Asam Urat",                                                   Some("2"), false, "A"),
        (2.100, "2.10", "Trigliserida",                                                Some("2"), false, "A"),
        (2.110, "2.11", "Kolesterol Total",                                            Some("2"), false, "A"),
        (2.120, "2.12", "Kolesterol HDL",                                              Some("2"), false, "A"),
        (2.130, "2.13", "Kolesterol LDL (direk)",                                      Some("2"), false, "A"),
        (2.140, "2.14", "Glukosa Sewaktu/Puasa / 2jam PP",                             Some("2"), false, "A"),
        (2.150, "2.15", "HbA1c",                                                       Some("2"), false, "A"),
        (2.160, "2.16", "Fosfatase alkali",                                            Some("2"), false, "A"),
        (2.170, "2.17", "Gamma GT",                                                    Some("2"), false, "A"),
        (2.180, "2.18", "LDH",                                                         Some("2"), false, "A"),
        (2.190, "2.19", "G 6 PD",                                                      Some("2"), false, "A"),
        (2.200, "2.20", "Amilase",                                                     Some("2"), false, "A"),
        (2.210, "2.21", "Lipase",                                                      Some("2"), false, "A"),
        (2.220, "2.22", "Cholinesterase",                                              Some("2"), false, "A"),
        (2.230, "2.23", "CK Total -CK MB",                                             Some("2"), false, "A"),
        (2.240, "2.24", "SI/TIBC",                                                     Some("2"), false, "A"),
        (2.250, "2.25", "Elektrolit Darah (Na, K, Cl, Ca, Mg, P)",                     Some("2"), false, "A"),
        (2.260, "2.26", "Analisa Gas Darah",                                           Some("2"), false, "A"),
        (3.00,  "3",    "Imunologi Klinik",                                            None, true, "A"),
        (3.10,  "3.1",  "Widal",                                                       Some("3"), false, "A"),
        (3.20,  "3.2",  "Antibodi anti SARS-CoV-2",                                    Some("3"), false, "A"),
        (3.30,  "3.3",  "Antigen SARS-CoV-2",                                          Some("3"), false, "A"),
        (3.40,  "3.4",  "Dengue IgG-IgM",                                              Some("3"), false, "A"),
        (3.50,  "3.5",  "HBs Ag",                                                      Some("3"), false, "A"),
        (3.60,  "3.6",  "Anti HBs",                                                    Some("3"), false, "A"),
        (3.70,  "3.7",  "Anti HBc",                                                    Some("3"), false, "A"),
        (3.80,  "3.8",  "Anti HBe",                                                    Some("3"), false, "A"),
        (3.90,  "3.9",  "Hbe Ag",                                                      Some("3"), false, "A"),
        (3.100, "3.10", "Anti HCV",                                                    Some("3"), false, "A"),
        (3.110, "3.11", "IgM Anti HAV",                                                Some("3"), false, "A"),
        (3.120, "3.12", "Anti HIV",                                                    Some("3"), false, "A"),
        (3.130, "3.13", "NS1 (non structure antigen) Dengue",                          Some("3"), false, "A"),
        (3.140, "3.14", "Tes Antigen Malaria",                                         Some("3"), false, "A"),
        (3.150, "3.15", "T3/T4 total",                                                 Some("3"), false, "A"),
        (3.160, "3.16", "FT3/FT4",                                                     Some("3"), false, "A"),
        (3.170, "3.17", "TSH",                                                         Some("3"), false, "A"),
        (4.00,  "4",    "Urinalisis dan analisis cairan",                              None, true, "A"),
        (4.10,  "4.1",  "Protein/albumin",                                             Some("4"), false, "A"),
        (4.20,  "4.2",  "Urobilinogen",                                                Some("4"), false, "A"),
        (4.30,  "4.3",  "Bilirubin",                                                   Some("4"), false, "A"),
        (4.40,  "4.4",  "Sedimen Urine",                                               Some("4"), false, "A"),
        (4.50,  "4.5",  "NAPZA Skrining",                                              Some("4"), false, "A"),
        (5.00,  "5",    "Hemostasis",                                                  None, true, "A"),
        (5.10,  "5.1",  "Masa perdarahan",                                             Some("5"), false, "A"),
        (5.20,  "5.2",  "Masa pembekuan",                                              Some("5"), false, "A"),
        (5.30,  "5.3",  "Masa prothrombin plasma",                                     Some("5"), false, "A"),
        (5.40,  "5.4",  "Masa tromboplastin partial teraktivasi",                      Some("5"), false, "A"),
        (5.50,  "5.5",  "Masa thrombin",                                               Some("5"), false, "A"),
        (5.60,  "5.6",  "Fibrinogen",                                                  Some("5"), false, "A"),
        (5.70,  "5.7",  "D-dimer",                                                     Some("5"), false, "A"),
        (5.80,  "5.8",  "Lupus anticoagulant",                                         Some("5"), false, "A"),
        // ── Section B — MIKROBIOLOGI KLINIK ──
        (6.00,  "6",    "Pemeriksaan dahak mikroskopis TBC BTA (Mycobakterium TB)",   None, true, "B"),
        (6.10,  "6.1",  "Negatif",                                                     Some("6"), false, "B"),
        (6.20,  "6.2",  "1-9",                                                         Some("6"), false, "B"),
        (6.30,  "6.3",  "1+",                                                          Some("6"), false, "B"),
        (6.40,  "6.4",  "2+",                                                          Some("6"), false, "B"),
        (6.50,  "6.5",  "3+",                                                          Some("6"), false, "B"),
        (6.60,  "6.6",  "Tidak Dilakukan",                                             Some("6"), false, "B"),
        (7.00,  "7",    "Biakan dan identifikasi bakteri aerob + uji kepekaan antibiotik", None, false, "B"),
        (8.00,  "8",    "Biakan virus dan uji kepekaan antivirus",                    None, false, "B"),
        (9.00,  "9",    "Biakan dan identifikasi M. tuberculosis + uji kepekaan OAT", None, false, "B"),
        (10.00, "10",   "PCR/RT-PCR untuk Influenza, SARS-CoV 1/2, HIV",              None, true, "B"),
        (10.10, "10.1", "PCR",                                                         Some("10"), false, "B"),
        (10.20, "10.2", "Real time PCR",                                               Some("10"), false, "B"),
        (10.30, "10.3", "Tes Cepat Molekuler",                                         Some("10"), false, "B"),
        (10.40, "10.4", "Hibridisasi",                                                 Some("10"), false, "B"),
        (10.50, "10.5", "Sekuensing",                                                  Some("10"), false, "B"),
        (10.60, "10.6", "Metode lainnya",                                              Some("10"), false, "B"),
        (11.00, "11",   "TCM TBC dan TBC RO",                                          None, true, "B"),
        (11.10, "11.1", "Negatif",                                                     Some("11"), false, "B"),
        (11.20, "11.2", "Rif Sen",                                                     Some("11"), false, "B"),
        (11.30, "11.3", "Rif Res",                                                     Some("11"), false, "B"),
        (11.40, "11.4", "Rif Indet",                                                   Some("11"), false, "B"),
        (11.50, "11.5", "Invalid",                                                     Some("11"), false, "B"),
        (11.60, "11.6", "Error",                                                       Some("11"), false, "B"),
        (11.70, "11.7", "No Result",                                                   Some("11"), false, "B"),
        (11.80, "11.8", "Tidak Dilakukan",                                             Some("11"), false, "B"),
        (12.00, "12",   "PCR bakteri aerob/anaerob/fastidious",                        None, true, "B"),
        (12.10, "12.1", "PCR",                                                         Some("12"), false, "B"),
        (12.20, "12.2", "Real time PCR",                                               Some("12"), false, "B"),
        (12.30, "12.3", "Tes Cepat Molekuler",                                         Some("12"), false, "B"),
        (12.40, "12.4", "Hibridisasi",                                                 Some("12"), false, "B"),
        (12.50, "12.5", "Sekuensing",                                                  Some("12"), false, "B"),
        (12.60, "12.6", "Metode lainnya",                                              Some("12"), false, "B"),
        (13.00, "13",   "PCR gen resistensi antimikroba",                              None, true, "B"),
        (13.10, "13.1", "PCR",                                                         Some("13"), false, "B"),
        (13.20, "13.2", "Real time PCR",                                               Some("13"), false, "B"),
        (13.30, "13.3", "Tes Cepat Molekuler",                                         Some("13"), false, "B"),
        (13.40, "13.4", "Hibridisasi",                                                 Some("13"), false, "B"),
        (13.50, "13.5", "Sekuensing",                                                  Some("13"), false, "B"),
        (13.60, "13.6", "Metode lainnya",                                              Some("13"), false, "B"),
        (14.00, "14",   "PCR deteksi jamur",                                           None, true, "B"),
        (14.10, "14.1", "PCR",                                                         Some("14"), false, "B"),
        (14.20, "14.2", "Real time PCR",                                               Some("14"), false, "B"),
        (14.30, "14.3", "Tes Cepat Molekuler",                                         Some("14"), false, "B"),
        (14.40, "14.4", "Hibridisasi",                                                 Some("14"), false, "B"),
        (14.50, "14.5", "Sekuensing",                                                  Some("14"), false, "B"),
        (14.60, "14.6", "Metode lainnya",                                              Some("14"), false, "B"),
        // ── Section C — PARASITOLOGI KLINIK ──
        (15.00, "15",   "Pemeriksaan Mikroskopis",                                     None, true, "C"),
        (15.10, "15.1", "Identifikasi cacing, larva/proglottid",                       Some("15"), false, "C"),
        (15.20, "15.2", "Identifikasi arthropoda (tuma, tungau, pinjal, kutu, dll)",   Some("15"), false, "C"),
        (15.30, "15.3", "Identifikasi nyamuk, larva nyamuk",                           Some("15"), false, "C"),
        (15.40, "15.4", "Identifikasi lalat dan larva lalat",                          Some("15"), false, "C"),
        (16.00, "16",   "Pemeriksaan Jamur",                                           None, true, "C"),
        (16.10, "16.1", "Pemeriksaan langsung KOH",                                    Some("16"), false, "C"),
        (16.20, "16.2", "Pemeriksaan langsung LPCB/tinta India",                       Some("16"), false, "C"),
        (16.30, "16.3", "Pemeriksaan jamur dengan pulasan khusus",                     Some("16"), false, "C"),
        (16.40, "16.4", "Kultur dan identifikasi jamur dari spesimen",                 Some("16"), false, "C"),
        (16.50, "16.5", "Identifikasi jamur dari biakan",                              Some("16"), false, "C"),
        (16.60, "16.6", "Uji kepekaan jamur ragi (manual/semiotomatis)",               Some("16"), false, "C"),
        (16.70, "16.7", "Uji kepekaan jamur kapang (manual)",                          Some("16"), false, "C"),
        // ── Section D — PATOLOGI ANATOMI ──
        (17.00, "17",   "Pemeriksaan biopsi aspirasi jarum halus dan tindakan kedokteran lainnya", None, false, "D"),
        (18.00, "18",   "Pemeriksaan Sitopatologi",                                    None, true, "D"),
        (18.10, "18.1", "Pemeriksaan Pap's Smear",                                     Some("18"), false, "D"),
        (18.20, "18.2", "Pemeriksaan sitologi apus non ginekologi",                    Some("18"), false, "D"),
        (18.30, "18.3", "Pemeriksaan sitologi cairan",                                 Some("18"), false, "D"),
        (19.00, "19",   "Pemeriksaan Histopatologi",                                   None, true, "D"),
        (19.10, "19.1", "Pemeriksaan jaringan kecil",                                  Some("19"), false, "D"),
        (19.20, "19.2", "Pemeriksaan jaringan sedang",                                 Some("19"), false, "D"),
        (19.30, "19.3", "Pemeriksaan jaringan besar",                                  Some("19"), false, "D"),
        (20.00, "20",   "Pemeriksaan Imunopatologi",                                   None, true, "D"),
        (20.10, "20.1", "Imunohistokimia Payudara",                                    Some("20"), false, "D"),
        (20.20, "20.2", "Imunohistokimia Limfoma",                                     Some("20"), false, "D"),
        (20.30, "20.3", "Imunohistokimia lanjutan (GIST, PD-L1, ALK, dll)",            Some("20"), false, "D"),
        (20.40, "20.4", "Imunositokimia",                                              Some("20"), false, "D"),
        (20.50, "20.5", "Imunofluoresensi (auto antibodi, kompleks imun, dll)",        Some("20"), false, "D"),
        (21.00, "21",   "Pemeriksaan Patologi Molekuler",                              None, true, "D"),
        (21.10, "21.1", "Deteksi mutasi EGFR",                                         Some("21"), false, "D"),
        (21.20, "21.2", "Deteksi mutasi all-RAS",                                      Some("21"), false, "D"),
        (21.30, "21.3", "Deteksi mutasi BRAF",                                         Some("21"), false, "D"),
        (21.40, "21.4", "Deteksi HPV Genotyping",                                      Some("21"), false, "D"),
        (21.50, "21.5", "ISH",                                                         Some("21"), false, "D"),
        (21.60, "21.6", "CISH",                                                        Some("21"), false, "D"),
        (21.70, "21.7", "FISH",                                                        Some("21"), false, "D"),
        (22.00, "22",   "Pemeriksaan Potong Beku",                                     None, false, "D"),
        (23.00, "23",   "Pemeriksaan Otopsi Klinik",                                   None, false, "D"),
    ]
}

pub async fn get_rl38(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl38Resp>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let bulan_dari = format!("{}-01", bulan);
    let (year_s, month_s) = (&bulan[..4], &bulan[5..7]);
    let year: i32 = year_s.parse().unwrap_or(2026);
    let month: u32 = month_s.parse().unwrap_or(1);
    let next_month_first = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let bulan_sampai = (next_month_first - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    // Auto-seed 155 rows if first time for this bulan
    let count_existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sirs_rl38_entry WHERE bulan=?"
    ).bind(&bulan).fetch_one(&state.pool).await.unwrap_or(0);
    if count_existing == 0 {
        for (urutan, kode, nama, parent, is_parent, section) in rl38_master() {
            let _ = sqlx::query(
                "INSERT INTO sirs_rl38_entry
                  (bulan,urutan,jenis_kode,jenis_nama,parent_kode,is_parent,section,
                   jml_l,jml_p,rata_l,rata_p)
                 VALUES (?,?,?,?,?,?,?, ?,?,?,?)"
            )
            .bind(&bulan).bind(urutan).bind(kode).bind(nama).bind(parent)
            .bind(if is_parent { 1i8 } else { 0i8 })
            .bind(section)
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0.0f64) })
            .bind(if is_parent { None } else { Some(0.0f64) })
            .execute(&state.pool).await;
        }
    }

    let mut entries: Vec<Rl38Entry> = sqlx::query_as(
        "SELECT id, bulan, CAST(urutan AS DOUBLE) AS urutan, jenis_kode, jenis_nama,
                parent_kode, is_parent, section,
                jml_l, jml_p,
                CAST(rata_l AS DOUBLE) AS rata_l,
                CAST(rata_p AS DOUBLE) AS rata_p,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl38_entry WHERE bulan=? ORDER BY urutan"
    ).bind(&bulan).fetch_all(&state.pool).await.map_err(db_err)?;

    // ── REALTIME best-effort: klasifikasi periksa_lab → baris JUKNIS via regex
    // nama tindakan (jns_perawatan_lab.nm_perawatan). Hanya baris lab umum (Sec A)
    // yang terpetakan; baris mikrobiologi/PCR/PA (Sec B+) tetap 0 (jarang & sulit
    // dipetakan andal dari nama). Hitungan per JK. Tak ada referensi Trimitra RL 3.8.
    let rl38_specs: Vec<(&str, &str)> = vec![
        ("1.1", "HEMOGLOBIN|(^| )HB($| |\\.)|HGB"),
        ("1.2", "HEMATOKRIT|(^| )HCT|(^| )HMT|(^| )PCV"),
        ("1.3", "LE(U|)KOSIT|(^| )WBC"),
        ("1.4", "ERITROSIT|(^| )RBC"),
        ("1.5", "EOSINOFIL|EOSINOPHIL"),
        ("1.6", "HITUNG JENIS|DIFF.*COUNT|DIFFERENTIAL|HITUNG LEKOSIT"),
        ("1.7", "LAJU ENDAP|(^| )LED($| )|(^| )ESR"),
        ("1.8", "RETIKULOSIT"),
        ("1.9", "TROMBOSIT|PLATELET|(^| )PLT"),
        ("2.1", "PROTEIN TOTAL"),
        ("2.2", "ALBUMIN"),
        ("2.3", "GLOBULIN"),
        ("2.4", "BILIRUBIN"),
        ("2.5", "SGOT|(^| )AST($| )"),
        ("2.6", "SGPT|(^| )ALT($| )"),
        ("2.7", "UREUM|(^| )BUN"),
        ("2.8", "KREATININ|CREATININ|EGFR"),
        ("2.9", "ASAM URAT|URIC ACID"),
        ("2.10", "TRIGLISERIDA|TRIGLYCERID"),
        ("2.11", "KOLESTEROL TOTAL|CHOLESTEROL TOTAL"),
        ("2.12", "(HDL)"),
        ("2.13", "(LDL)"),
        ("2.14", "GLUKOSA|GLUCOSE|GULA DARAH|(^| )GD(S|P|2)"),
        ("2.15", "HBA1C"),
        ("2.25", "ELEKTROLIT|NATRIUM|KALIUM|KLORIDA|(^| )NA($| )|(^| )K($| )|(^| )CL($| )"),
        ("2.26", "ANALISA GAS DARAH|(^| )AGD|BLOOD GAS"),
        ("3.1", "WIDAL"),
        ("3.2", "ANTIBODI.*SARS|ANTIBODI.*COV|RAPID.*ANTIBODI"),
        ("3.3", "ANTIGEN.*SARS|ANTIGEN.*COV|SWAB ANTIGEN|RAPID ANTIGEN"),
        ("3.4", "DENGUE IG|DENGUE IGG|DENGUE IGM|IGG.*IGM.*DENGUE"),
        ("3.5", "HBSAG|HBS AG"),
        ("3.10", "ANTI.?HCV"),
        ("3.12", "ANTI.?HIV|(^| )HIV($| )"),
        ("3.13", "NS1"),
        ("3.17", "(^| )TSH"),
        ("4.1", "PROTEIN URIN|ALBUMIN URIN"),
        ("4.4", "SEDIMEN"),
        ("4.5", "NAPZA|NARKOBA|AMPHETAMIN"),
        ("5.1", "MASA PERDARAHAN|BLEEDING TIME|(^| )BT($| )"),
        ("5.2", "MASA PEMBEKUAN|CLOTTING TIME|(^| )CT($| )"),
        ("5.3", "PROTHROMBIN|(^| )PT($| )"),
        ("5.4", "TROMBOPLASTIN|(^| )APTT|(^| )PTTK"),
        ("5.7", "D.?DIMER"),
        ("6.1", "(^| )BTA|MIKROSKOPIS TB|DAHAK.*TB"),
    ];
    // Bangun CASE regex tunggal untuk klasifikasi setiap baris periksa_lab.
    let case_arms: String = rl38_specs.iter()
        .map(|(kode, rx)| format!("WHEN UPPER(m.nm_perawatan) REGEXP '{}' THEN '{}'", rx.replace('\'', "''"), kode))
        .collect::<Vec<_>>().join(" ");
    let rl38_sql = format!(
        "SELECT kode,
                CAST(SUM(jk='L') AS SIGNED) AS jml_l,
                CAST(SUM(jk='P') AS SIGNED) AS jml_p
         FROM (
            SELECT CASE {} ELSE NULL END AS kode, p.jk AS jk
            FROM periksa_lab pl
            LEFT JOIN jns_perawatan_lab m ON m.kd_jenis_prw=pl.kd_jenis_prw
            LEFT JOIN reg_periksa r ON r.no_rawat=pl.no_rawat
            LEFT JOIN pasien p ON p.no_rkm_medis=r.no_rkm_medis
            WHERE pl.tgl_periksa BETWEEN ? AND ?
         ) v WHERE kode IS NOT NULL GROUP BY kode", case_arms);
    let rl38_agg: Vec<(String, i64, i64)> = sqlx::query_as(&rl38_sql)
        .bind(&bulan_dari).bind(&bulan_sampai)
        .fetch_all(&state.pool).await.unwrap_or_default();
    let rl38_map: std::collections::HashMap<String, (i64, i64)> =
        rl38_agg.into_iter().map(|(k, l, p)| (k, (l, p))).collect();
    for e in entries.iter_mut().filter(|e| e.is_parent == 0) {
        let (l, p) = rl38_map.get(&e.jenis_kode).copied().unwrap_or((0, 0));
        e.jml_l = Some(l as i32); e.jml_p = Some(p as i32);
    }

    // ── Khanza sanity: per kategori + top jenis ──────────────────────────
    let per_kategori: Vec<Rl38KhanzaKategori> = sqlx::query_as(
        "SELECT pl.kategori AS kategori,
                CAST(COUNT(*) AS SIGNED) AS jml,
                CAST(SUM(CASE WHEN p.jk='L' THEN 1 ELSE 0 END) AS SIGNED) AS jml_l,
                CAST(SUM(CASE WHEN p.jk='P' THEN 1 ELSE 0 END) AS SIGNED) AS jml_p,
                CAST(COUNT(DISTINCT pl.no_rawat) AS SIGNED) AS pasien
         FROM periksa_lab pl
         LEFT JOIN reg_periksa r ON r.no_rawat=pl.no_rawat
         LEFT JOIN pasien p ON p.no_rkm_medis=r.no_rkm_medis
         WHERE pl.tgl_periksa BETWEEN ? AND ?
         GROUP BY pl.kategori
         ORDER BY jml DESC"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_all(&state.pool).await.map_err(db_err)?;

    let top_jenis: Vec<Rl38KhanzaTop> = sqlx::query_as(
        "SELECT m.nm_perawatan AS nm_perawatan, pl.kategori AS kategori,
                CAST(COUNT(*) AS SIGNED) AS jml,
                CAST(SUM(CASE WHEN p.jk='L' THEN 1 ELSE 0 END) AS SIGNED) AS jml_l,
                CAST(SUM(CASE WHEN p.jk='P' THEN 1 ELSE 0 END) AS SIGNED) AS jml_p
         FROM periksa_lab pl
         LEFT JOIN jns_perawatan_lab m ON m.kd_jenis_prw=pl.kd_jenis_prw
         LEFT JOIN reg_periksa r ON r.no_rawat=pl.no_rawat
         LEFT JOIN pasien p ON p.no_rkm_medis=r.no_rkm_medis
         WHERE pl.tgl_periksa BETWEEN ? AND ?
         GROUP BY m.nm_perawatan, pl.kategori
         ORDER BY jml DESC
         LIMIT 30"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_all(&state.pool).await.map_err(db_err)?;

    let total_pemeriksaan: i64 = per_kategori.iter().map(|k| k.jml).sum();
    let total_pasien: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT pl.no_rawat) FROM periksa_lab pl
         WHERE pl.tgl_periksa BETWEEN ? AND ?"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    Ok(Json(Rl38Resp {
        bulan,
        entries,
        khanza: Rl38Khanza { total_pemeriksaan, total_pasien, per_kategori, top_jenis },
    }))
}

pub async fn update_rl38(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl38Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl38_entry SET
           jml_l=?, jml_p=?, rata_l=?, rata_p=?, updated_by=?
         WHERE id=?"
    )
    .bind(body.jml_l).bind(body.jml_p)
    .bind(body.rata_l).bind(body.rata_p)
    .bind(&user.0.kode)
    .bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl38_entry SET ... updated_by={} WHERE id={}",
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;
    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

pub async fn cetak_rl38(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl38(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    let mut prev_section: Option<String> = None;
    for e in &resp.entries {
        if e.section != prev_section {
            if let Some(s) = &e.section {
                let label = match s.as_str() {
                    "A" => "A. PATOLOGI KLINIK",
                    "B" => "B. MIKROBIOLOGI KLINIK",
                    "C" => "C. PARASITOLOGI KLINIK",
                    "D" => "D. PATOLOGI ANATOMI",
                    _   => s.as_str(),
                };
                tbody.push_str(&format!(
                    "<tr class=\"section\"><td class=\"no\">{}</td><td colspan=\"5\"><strong>{}</strong></td></tr>",
                    s, label
                ));
            }
            prev_section = e.section.clone();
        }
        if e.is_parent == 1 {
            tbody.push_str(&format!(
                "<tr class=\"kat\"><td class=\"no\">{}</td><td colspan=\"5\"><strong>{}</strong></td></tr>",
                esc(&e.jenis_kode), esc(&e.jenis_nama)
            ));
        } else {
            tbody.push_str(&format!(
                "<tr><td class=\"no\">{}</td><td>{}</td>\
                 <td class=\"n\">{}</td><td class=\"n\">{}</td>\
                 <td class=\"n\">{:.2}</td><td class=\"n\">{:.2}</td></tr>",
                esc(&e.jenis_kode), esc(&e.jenis_nama),
                e.jml_l.unwrap_or(0), e.jml_p.unwrap_or(0),
                e.rata_l.unwrap_or(0.0), e.rata_p.unwrap_or(0.0),
            ));
        }
    }

    let kh = &resp.khanza;
    let mut sanity_kat = String::new();
    for k in &kh.per_kategori {
        let label = match k.kategori.as_deref() {
            Some("PK") => "PK (Pat. Klinik)",
            Some("MB") => "MB (Mikrobiologi)",
            Some("PA") => "PA (Pat. Anatomi)",
            other      => other.unwrap_or("?"),
        };
        sanity_kat.push_str(&format!("<strong>{}</strong>: {} ({}L+{}P, {} pasien) · ",
            label, k.jml, k.jml_l, k.jml_p, k.pasien));
    }

    let mut top_html = String::new();
    for (i, t) in kh.top_jenis.iter().take(15).enumerate() {
        top_html.push_str(&format!(
            "<tr><td>{}</td><td>{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td>{}</td></tr>",
            i+1, esc(t.nm_perawatan.as_deref().unwrap_or("-")),
            t.jml, t.jml_l, t.jml_p,
            esc(t.kategori.as_deref().unwrap_or("-"))
        ));
    }

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.8 Laboratorium — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:10mm;font-size:9pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:10px}}
  table{{width:100%;border-collapse:collapse;font-size:8pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:3px 5px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;font-size:8pt;text-align:center}}
  th.subgrp{{background:#3b82f6}}
  td.no{{width:42px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.kat td{{background:#dbeafe;color:#1e40af}}
  tr.section td{{background:#1e40af;color:#fff;font-size:9.5pt;letter-spacing:1px}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:8.5pt}}
  .topjenis{{margin-top:14px;font-size:8.5pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:8mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.8 Laboratorium</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.8 — Rekapitulasi Kegiatan Pelayanan Laboratorium</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  🔬 <strong>Sanity Khanza periksa_lab</strong>: total = <strong>{tot}</strong> pemeriksaan / <strong>{tot_p}</strong> pasien<br/>
  {sanity_kat}
</div>

<table>
  <thead><tr>
    <th rowspan="2" class="no">No</th><th rowspan="2">Pemeriksaan</th>
    <th colspan="2" class="subgrp">Jumlah Pemeriksaan</th>
    <th colspan="2" class="subgrp">Nilai Rata-Rata Pemeriksaan</th>
  </tr><tr>
    <th class="subgrp">Laki-laki</th><th class="subgrp">Perempuan</th>
    <th class="subgrp">Laki-laki</th><th class="subgrp">Perempuan</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="topjenis">
  <strong>📊 Top 15 jenis pemeriksaan Khanza periode {bulan}</strong>:
  <table>
    <thead><tr><th>#</th><th>Nama Pemeriksaan (jns_perawatan_lab)</th><th>Total</th><th>L</th><th>P</th><th>Kategori</th></tr></thead>
    <tbody>{top}</tbody>
  </table>
</div>

<div class="footer">
  Manual entry per parameter JUKNIS (~155 baris). Khanza periksa_lab dengan kategori PK/MB/PA sebagai patokan total dan top jenis sebagai bantuan pemetaan ke baris JUKNIS.<br/>
  Nilai rata-rata pemeriksaan = jumlah angka hasil / jumlah pasien yang diperiksa (input manual oleh petugas lab).<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), bulan = esc(&resp.bulan),
        tot = kh.total_pemeriksaan, tot_p = kh.total_pasien,
        sanity_kat = sanity_kat,
        tbody = tbody, top = top_html,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.9 — Rekapitulasi Pelayanan Radiologi (Bulanan)
// Per JUKNIS SIRS 6.3 Bab IV I. 4 section + ~20 leaf.
// Auto-classify dari periksa_radiologi × jns_perawatan_radiologi via nama pattern.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl39Entry {
    pub id:          Option<i32>,
    pub bulan:       String,
    pub urutan:      Option<f64>,
    pub jenis_kode:  String,
    pub jenis_nama:  String,
    pub parent_kode: Option<String>,
    pub is_parent:   i8,
    pub jumlah:      Option<i32>,
    pub updated_at:  Option<String>,
    pub updated_by:  Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl39KhanzaTop {
    pub nm_perawatan: Option<String>,
    pub jumlah:       i64,
}

#[derive(Debug, Serialize)]
pub struct Rl39KhanzaSugesti {
    pub jenis_kode: String,
    pub count:      i64,
    pub sumber:     String,
}

#[derive(Debug, Serialize)]
pub struct Rl39Khanza {
    pub total_periksa_radiologi: i64,
    pub total_pasien:            i64,
    pub top_jenis:               Vec<Rl39KhanzaTop>,
    pub sugesti_per_row:         Vec<Rl39KhanzaSugesti>,
}

#[derive(Debug, Serialize)]
pub struct Rl39Resp {
    pub bulan:   String,
    pub entries: Vec<Rl39Entry>,
    pub khanza:  Rl39Khanza,
}

fn rl39_master() -> Vec<(f64, &'static str, &'static str, Option<&'static str>, bool)> {
    vec![
        (1.0, "1",   "Radiodiagnostik",         None, true),
        (1.1, "1.1", "Foto tanpa bahan kontras",Some("1"), false),
        (1.2, "1.2", "Foto dengan bahan kontras",Some("1"), false),
        (1.3, "1.3", "Foto dengan rol film",    Some("1"), false),
        (1.4, "1.4", "Flouroskopi",             Some("1"), false),
        (1.5, "1.5", "Foto Gigi",               Some("1"), false),
        (1.6, "1.6", "C.T. Scan",               Some("1"), false),
        (1.7, "1.7", "Lymphografi",             Some("1"), false),
        (1.8, "1.8", "Angiograpi",              Some("1"), false),
        (1.9, "1.9", "Lain-Lain",               Some("1"), false),
        (2.0, "2",   "Radioterapi",             None, true),
        (2.1, "2.1", "Radioterapi dengan Linac",       Some("2"), false),
        (2.2, "2.2", "Radioterapi dengan Cobalt",      Some("2"), false),
        (2.3, "2.3", "Radioterapi dengan Brakhiterapi",Some("2"), false),
        (2.4, "2.4", "Lain-Lain",               Some("2"), false),
        (3.0, "3",   "Kedokteran Nuklir",       None, true),
        (3.1, "3.1", "Diagnostik",              Some("3"), false),
        (3.2, "3.2", "Therapi",                 Some("3"), false),
        (3.3, "3.3", "Lain-Lain",               Some("3"), false),
        (4.0, "4",   "Imaging/Pencitraan",      None, true),
        (4.1, "4.1", "USG",                     Some("4"), false),
        (4.2, "4.2", "MRI",                     Some("4"), false),
        (4.3, "4.3", "Lain-lain",               Some("4"), false),
    ]
}

pub async fn get_rl39(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl39Resp>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let bulan_dari = format!("{}-01", bulan);
    let (year_s, month_s) = (&bulan[..4], &bulan[5..7]);
    let year: i32 = year_s.parse().unwrap_or(2026);
    let month: u32 = month_s.parse().unwrap_or(1);
    let next_month_first = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let bulan_sampai = (next_month_first - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    let count_existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sirs_rl39_entry WHERE bulan=?"
    ).bind(&bulan).fetch_one(&state.pool).await.unwrap_or(0);
    if count_existing == 0 {
        for (urutan, kode, nama, parent, is_parent) in rl39_master() {
            let _ = sqlx::query(
                "INSERT INTO sirs_rl39_entry
                  (bulan,urutan,jenis_kode,jenis_nama,parent_kode,is_parent,jumlah)
                 VALUES (?,?,?,?,?,?,?)"
            )
            .bind(&bulan).bind(urutan).bind(kode).bind(nama).bind(parent)
            .bind(if is_parent { 1i8 } else { 0i8 })
            .bind(if is_parent { None } else { Some(0i32) })
            .execute(&state.pool).await;
        }
    }

    let entries: Vec<Rl39Entry> = sqlx::query_as(
        "SELECT id, bulan, CAST(urutan AS DOUBLE) AS urutan, jenis_kode, jenis_nama,
                parent_kode, is_parent, jumlah,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl39_entry WHERE bulan=? ORDER BY urutan"
    ).bind(&bulan).fetch_all(&state.pool).await.map_err(db_err)?;

    // ── Khanza sanity ───────────────────────────────────────────────────
    let total_periksa_radiologi: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM periksa_radiologi WHERE tgl_periksa BETWEEN ? AND ?"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let total_pasien: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT no_rawat) FROM periksa_radiologi
         WHERE tgl_periksa BETWEEN ? AND ?"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let top_jenis: Vec<Rl39KhanzaTop> = sqlx::query_as(
        "SELECT m.nm_perawatan AS nm_perawatan, CAST(COUNT(*) AS SIGNED) AS jumlah
         FROM periksa_radiologi pr
         LEFT JOIN jns_perawatan_radiologi m ON m.kd_jenis_prw=pr.kd_jenis_prw
         WHERE pr.tgl_periksa BETWEEN ? AND ?
         GROUP BY m.nm_perawatan
         ORDER BY jumlah DESC LIMIT 30"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_all(&state.pool).await.map_err(db_err)?;

    // Auto-classify per JUKNIS row via nm_perawatan LIKE pattern
    // (jenis_kode, label, vec of UPPER pattern, vec of exclude UPPER pattern)
    let row_specs: Vec<(&str, &str, Vec<&str>, Vec<&str>)> = vec![
        ("1.6", "CT Scan (nama LIKE 'CT%')",        vec!["CT %", "CT-%", "%C.T.%", "CTSCAN%"], vec![]),
        ("1.5", "Foto Gigi (nm LIKE '%GIGI%' OR 'DENTAL%')", vec!["%GIGI%", "DENTAL%", "PANORAMIC%"], vec![]),
        ("1.4", "Flouroskopi",                      vec!["%FLUOROSC%", "%FLOROSC%"], vec![]),
        ("1.7", "Lymphografi",                      vec!["%LYMPHO%"], vec![]),
        ("1.8", "Angiografi",                       vec!["%ANGIO%"], vec![]),
        ("1.2", "Foto kontras (IVP/BNO/Barium)",    vec!["%CONTRAST%", "%KONTRAS%", "IVP%", "BNO IVP%", "%BARIUM%", "%COLON IN LOOP%"], vec![]),
        ("4.1", "USG",                              vec!["USG%", "ULTRASOUND%"], vec![]),
        ("4.2", "MRI",                              vec!["MRI%", "MAGNETIC RESONANCE%"], vec![]),
        // 1.1 Foto tanpa kontras = sisanya yg X-ray standard (exclude CT/USG/MRI/Gigi/Kontras/Flouro/Angio/Lympho)
        ("1.1", "Foto X-ray standard tanpa kontras (rest)",
         vec!["%"],
         vec!["CT %", "CT-%", "%C.T.%", "CTSCAN%",
              "%GIGI%", "DENTAL%", "PANORAMIC%",
              "%FLUOROSC%", "%FLOROSC%",
              "%LYMPHO%", "%ANGIO%",
              "%CONTRAST%", "%KONTRAS%", "IVP%", "BNO IVP%", "%BARIUM%", "%COLON IN LOOP%",
              "USG%", "ULTRASOUND%",
              "MRI%", "MAGNETIC RESONANCE%"]),
    ];

    let mut sugesti_per_row: Vec<Rl39KhanzaSugesti> = Vec::new();
    for (jenis_kode, sumber, includes, excludes) in &row_specs {
        let mut where_parts: Vec<String> = Vec::new();
        let mut binds: Vec<String> = Vec::new();
        let include_or = includes.iter().map(|_| "UPPER(m.nm_perawatan) LIKE ?").collect::<Vec<_>>().join(" OR ");
        where_parts.push(format!("({})", include_or));
        for p in includes { binds.push((*p).to_string()); }
        for p in excludes {
            where_parts.push("UPPER(m.nm_perawatan) NOT LIKE ?".to_string());
            binds.push((*p).to_string());
        }
        let sql = format!(
            "SELECT COUNT(*) FROM periksa_radiologi pr
             LEFT JOIN jns_perawatan_radiologi m ON m.kd_jenis_prw=pr.kd_jenis_prw
             WHERE pr.tgl_periksa BETWEEN ? AND ? AND {}",
            where_parts.join(" AND ")
        );
        let mut qb = sqlx::query_scalar(&sql);
        qb = qb.bind(&bulan_dari).bind(&bulan_sampai);
        for b in &binds { qb = qb.bind(b); }
        let cnt: i64 = qb.fetch_one(&state.pool).await.unwrap_or(0);
        sugesti_per_row.push(Rl39KhanzaSugesti {
            jenis_kode: jenis_kode.to_string(),
            count: cnt,
            sumber: sumber.to_string(),
        });
    }

    Ok(Json(Rl39Resp {
        bulan,
        entries,
        khanza: Rl39Khanza { total_periksa_radiologi, total_pasien, top_jenis, sugesti_per_row },
    }))
}

pub async fn update_rl39(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl39Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl39_entry SET jumlah=?, updated_by=? WHERE id=?"
    )
    .bind(body.jumlah).bind(&user.0.kode).bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl39_entry SET ... updated_by={} WHERE id={}",
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;
    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

pub async fn cetak_rl39(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl39(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    let mut total_all: i32 = 0;
    for e in &resp.entries {
        if e.is_parent == 1 {
            tbody.push_str(&format!(
                "<tr class=\"kat\"><td class=\"no\">{}</td><td colspan=\"2\"><strong>{}</strong></td></tr>",
                esc(&e.jenis_kode), esc(&e.jenis_nama)
            ));
        } else {
            let v = resp.khanza.sugesti_per_row.iter().find(|s| s.jenis_kode == e.jenis_kode).map(|s| s.count as i32).unwrap_or(0);
            total_all += v;
            tbody.push_str(&format!(
                "<tr><td class=\"no\">{}</td><td>{}</td><td class=\"n\">{}</td></tr>",
                esc(&e.jenis_kode), esc(&e.jenis_nama), v
            ));
        }
    }
    tbody.push_str(&format!(
        "<tr class=\"total\"><td class=\"no\">99</td><td><strong>TOTAL</strong></td><td class=\"n\"><strong>{}</strong></td></tr>",
        total_all
    ));

    let mut top_html = String::new();
    for (i, t) in resp.khanza.top_jenis.iter().take(15).enumerate() {
        top_html.push_str(&format!(
            "<tr><td>{}</td><td>{}</td><td class=\"n\">{}</td></tr>",
            i+1, esc(t.nm_perawatan.as_deref().unwrap_or("-")), t.jumlah
        ));
    }

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.9 Radiologi — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:14mm;font-size:9.5pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:12px}}
  table{{width:100%;border-collapse:collapse;font-size:9pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:4px 6px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;text-align:center}}
  td.no{{width:48px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.kat td{{background:#dbeafe;color:#1e40af}}
  tr.total td{{background:#bfdbfe;font-weight:bold}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:9pt}}
  .topjenis{{margin-top:14px;font-size:9pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:12mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.9 Radiologi</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.9 — Rekapitulasi Kegiatan Pelayanan Radiologi</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  📡 <strong>Khanza periksa_radiologi {bulan}</strong>: total = <strong>{tot}</strong> pemeriksaan / <strong>{tot_p}</strong> pasien.
  Manual entry RL 3.9 total = <strong>{tot_manual}</strong>.
</div>

<table>
  <thead><tr><th class="no">No</th><th>Jenis Kegiatan</th><th>Jumlah</th></tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="topjenis">
  <strong>📊 Top 15 jenis pemeriksaan radiologi Khanza periode {bulan}</strong>:
  <table>
    <thead><tr><th>#</th><th>Nama Pemeriksaan</th><th>Jumlah</th></tr></thead>
    <tbody>{top}</tbody>
  </table>
</div>

<div class="footer">
  Sumber: <code>periksa_radiologi × jns_perawatan_radiologi</code>.
  Klasifikasi otomatis per JUKNIS row via nama-LIKE pattern:
  1.1 X-ray standard (rest setelah exclude CT/USG/MRI/Gigi/Kontras/dll),
  1.5 Gigi, 1.6 CT, 4.1 USG (USG%), 4.2 MRI (MRI%).<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), bulan = esc(&resp.bulan),
        tot = resp.khanza.total_periksa_radiologi, tot_p = resp.khanza.total_pasien,
        tot_manual = total_all, tbody = tbody, top = top_html,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.10 — Rekapitulasi Pelayanan Rujukan (Bulanan)
// Per JUKNIS SIRS 6.3 Bab IV J. 20 spesialisasi × (RM Masuk 3 + RM Dikembalikan 3 + Rujuk Keluar 3).
// Sanity: rujuk_masuk (input, classify perujuk via nama LIKE) + rujuk (output).
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl310Entry {
    pub id:               Option<i32>,
    pub bulan:            String,
    pub urutan:           i32,
    pub jenis_kode:       String,
    pub jenis_nama:       String,
    pub rm_in_pus:        Option<i32>,
    pub rm_in_rs:         Option<i32>,
    pub rm_in_faskes:     Option<i32>,
    pub rm_out_pus:       Option<i32>,
    pub rm_out_rs:        Option<i32>,
    pub rm_out_faskes:    Option<i32>,
    pub rk_pasien_rujukan:        Option<i32>,
    pub rk_pasien_datang_sendiri: Option<i32>,
    pub rk_diterima_kembali:      Option<i32>,
    pub updated_at:       Option<String>,
    pub updated_by:       Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Rl310KhanzaSpes {
    pub jenis_kode:        String,
    pub rm_in_total:       i64,    // total rujuk_masuk klasifikasi spesialisasi via kd_poli
    pub rm_in_pus_pattern: i64,    // perujuk LIKE %PUSKES/PKM%
    pub rm_in_rs_pattern:  i64,    // perujuk LIKE %RUMAH SAKIT/RS/HOSPITAL%
    pub rm_in_faskes_other: i64,
    pub rk_total:          i64,    // total rujuk (keluar)
}

#[derive(Debug, Serialize)]
pub struct Rl310Khanza {
    pub rujuk_masuk_total:    i64,
    pub rujuk_keluar_total:   i64,
    pub rujuk_masuk_pus_pattern:    i64,
    pub rujuk_masuk_rs_pattern:     i64,
    pub rujuk_masuk_faskes_other:   i64,
    pub rujuk_masuk_kosong:         i64,
    pub per_spesialisasi:           Vec<Rl310KhanzaSpes>,
}

#[derive(Debug, Serialize)]
pub struct Rl310Resp {
    pub bulan:   String,
    pub entries: Vec<Rl310Entry>,
    pub khanza:  Rl310Khanza,
}

// (urutan, kode, nama, kd_poli list utk auto-classify dari Khanza)
fn rl310_master() -> Vec<(i32, &'static str, &'static str, Vec<&'static str>)> {
    vec![
        (1,  "1",  "Penyakit Dalam",          vec!["I N T", "INT"]),
        (2,  "2",  "Bedah",                   vec!["BDH"]),
        (3,  "3",  "Kesehatan Anak",          vec!["ANA"]),
        (4,  "4",  "Kesehatan Remaja",        vec![]),
        (5,  "5",  "Obstetri",                vec!["OBG"]),
        (6,  "6",  "Ginekologi",              vec![]),
        (7,  "7",  "Keluarga Berencana",      vec![]),
        (8,  "8",  "Saraf (Non Stroke)",      vec!["SRF"]),
        (9,  "9",  "Jiwa",                    vec!["KJ"]),
        (10, "10", "THT",                     vec!["THT"]),
        (11, "11", "Mata",                    vec!["MAT"]),
        (12, "12", "Kulit dan Kelamin",       vec![]),
        (13, "13", "Gigi dan Mulut",          vec!["GIG"]),
        (14, "14", "Radiologi",               vec!["RAD"]),
        (15, "15", "Paru",                    vec!["PARU"]),
        (16, "16", "Kardiologi",              vec![]),
        (17, "17", "Kanker",                  vec![]),
        (18, "18", "Uronefrologi",            vec![]),
        (19, "19", "Saraf (Stroke)",          vec![]),
        (20, "20", "Spesialisasi Lain",       vec!["PUMM", "IGDK", "IGD", "AMBL", "BRLN", "KMR52", "RRI", "LAB"]),
    ]
}

pub async fn get_rl310(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl310Resp>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let bulan_dari = format!("{}-01", bulan);
    let (year_s, month_s) = (&bulan[..4], &bulan[5..7]);
    let year: i32 = year_s.parse().unwrap_or(2026);
    let month: u32 = month_s.parse().unwrap_or(1);
    let next_month_first = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let bulan_sampai = (next_month_first - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    // Auto-seed
    let count_existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sirs_rl310_entry WHERE bulan=?"
    ).bind(&bulan).fetch_one(&state.pool).await.unwrap_or(0);
    if count_existing == 0 {
        for (urutan, kode, nama, _) in rl310_master() {
            let _ = sqlx::query(
                "INSERT INTO sirs_rl310_entry
                  (bulan,urutan,jenis_kode,jenis_nama,
                   rm_in_pus,rm_in_rs,rm_in_faskes,
                   rm_out_pus,rm_out_rs,rm_out_faskes,
                   rk_pasien_rujukan,rk_pasien_datang_sendiri,rk_diterima_kembali)
                 VALUES (?,?,?,?, 0,0,0, 0,0,0, 0,0,0)"
            )
            .bind(&bulan).bind(urutan).bind(kode).bind(nama)
            .execute(&state.pool).await;
        }
    }

    let mut entries: Vec<Rl310Entry> = sqlx::query_as(
        "SELECT id, bulan, urutan, jenis_kode, jenis_nama,
                rm_in_pus, rm_in_rs, rm_in_faskes,
                rm_out_pus, rm_out_rs, rm_out_faskes,
                rk_pasien_rujukan, rk_pasien_datang_sendiri, rk_diterima_kembali,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl310_entry WHERE bulan=? ORDER BY urutan"
    ).bind(&bulan).fetch_all(&state.pool).await.map_err(db_err)?;

    // ── Sanity Khanza ──────────────────────────────────────────────────
    // rujuk_masuk total Mei 2026
    let rujuk_masuk_total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM rujuk_masuk rm
         JOIN reg_periksa r ON r.no_rawat=rm.no_rawat
         WHERE r.tgl_registrasi BETWEEN ? AND ?"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let rujuk_masuk_pus_pattern: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM rujuk_masuk rm
         JOIN reg_periksa r ON r.no_rawat=rm.no_rawat
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND (UPPER(rm.perujuk) LIKE '%PUSKES%' OR UPPER(rm.perujuk) LIKE 'PKM%' OR UPPER(rm.perujuk) LIKE '%PUSKESMAS%')"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let rujuk_masuk_rs_pattern: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM rujuk_masuk rm
         JOIN reg_periksa r ON r.no_rawat=rm.no_rawat
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND (UPPER(rm.perujuk) LIKE '%RUMAH SAKIT%' OR UPPER(rm.perujuk) LIKE 'RS %' OR UPPER(rm.perujuk) LIKE 'RSU%' OR UPPER(rm.perujuk) LIKE 'RSUD%' OR UPPER(rm.perujuk) LIKE '%HOSPITAL%')"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let rujuk_masuk_kosong: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM rujuk_masuk rm
         JOIN reg_periksa r ON r.no_rawat=rm.no_rawat
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND (rm.perujuk='' OR rm.perujuk IS NULL OR rm.perujuk='-')"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let rujuk_masuk_faskes_other = rujuk_masuk_total
        - rujuk_masuk_pus_pattern - rujuk_masuk_rs_pattern - rujuk_masuk_kosong;

    let rujuk_keluar_total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM rujuk WHERE tgl_rujuk BETWEEN ? AND ?"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    // Per spesialisasi via kd_poli list
    let mut per_spesialisasi: Vec<Rl310KhanzaSpes> = Vec::new();
    for (_, kode, _nama, kd_poli_list) in rl310_master() {
        if kd_poli_list.is_empty() {
            per_spesialisasi.push(Rl310KhanzaSpes {
                jenis_kode: kode.to_string(),
                rm_in_total: 0, rm_in_pus_pattern: 0, rm_in_rs_pattern: 0, rm_in_faskes_other: 0,
                rk_total: 0,
            });
            continue;
        }
        let placeholders = kd_poli_list.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        // rm_in total per spesialisasi
        let sql_total = format!(
            "SELECT COUNT(*) FROM rujuk_masuk rm
             JOIN reg_periksa r ON r.no_rawat=rm.no_rawat
             WHERE r.tgl_registrasi BETWEEN ? AND ? AND r.kd_poli IN ({})",
            placeholders);
        let mut qb = sqlx::query_scalar(&sql_total).bind(&bulan_dari).bind(&bulan_sampai);
        for p in &kd_poli_list { qb = qb.bind(*p); }
        let total: i64 = qb.fetch_one(&state.pool).await.unwrap_or(0);

        // rm_in pus pattern per spesialisasi
        let sql_pus = format!(
            "SELECT COUNT(*) FROM rujuk_masuk rm
             JOIN reg_periksa r ON r.no_rawat=rm.no_rawat
             WHERE r.tgl_registrasi BETWEEN ? AND ? AND r.kd_poli IN ({})
               AND (UPPER(rm.perujuk) LIKE '%PUSKES%' OR UPPER(rm.perujuk) LIKE 'PKM%' OR UPPER(rm.perujuk) LIKE '%PUSKESMAS%')",
            placeholders);
        let mut qb = sqlx::query_scalar(&sql_pus).bind(&bulan_dari).bind(&bulan_sampai);
        for p in &kd_poli_list { qb = qb.bind(*p); }
        let pus: i64 = qb.fetch_one(&state.pool).await.unwrap_or(0);

        let sql_rs = format!(
            "SELECT COUNT(*) FROM rujuk_masuk rm
             JOIN reg_periksa r ON r.no_rawat=rm.no_rawat
             WHERE r.tgl_registrasi BETWEEN ? AND ? AND r.kd_poli IN ({})
               AND (UPPER(rm.perujuk) LIKE '%RUMAH SAKIT%' OR UPPER(rm.perujuk) LIKE 'RS %' OR UPPER(rm.perujuk) LIKE 'RSU%' OR UPPER(rm.perujuk) LIKE 'RSUD%' OR UPPER(rm.perujuk) LIKE '%HOSPITAL%')",
            placeholders);
        let mut qb = sqlx::query_scalar(&sql_rs).bind(&bulan_dari).bind(&bulan_sampai);
        for p in &kd_poli_list { qb = qb.bind(*p); }
        let rs: i64 = qb.fetch_one(&state.pool).await.unwrap_or(0);

        // rujuk_keluar per spesialisasi
        let sql_rk = format!(
            "SELECT COUNT(*) FROM rujuk rj
             JOIN reg_periksa r ON r.no_rawat=rj.no_rawat
             WHERE rj.tgl_rujuk BETWEEN ? AND ? AND r.kd_poli IN ({})",
            placeholders);
        let mut qb = sqlx::query_scalar(&sql_rk).bind(&bulan_dari).bind(&bulan_sampai);
        for p in &kd_poli_list { qb = qb.bind(*p); }
        let rk: i64 = qb.fetch_one(&state.pool).await.unwrap_or(0);

        // rujuk keluar dari pasien yang datang sebagai rujukan (pernah rujuk_masuk)
        let sql_rk_ruj = format!(
            "SELECT COUNT(*) FROM rujuk rj
             JOIN reg_periksa r ON r.no_rawat=rj.no_rawat
             WHERE rj.tgl_rujuk BETWEEN ? AND ? AND r.kd_poli IN ({})
               AND EXISTS(SELECT 1 FROM rujuk_masuk rm WHERE rm.no_rawat=rj.no_rawat)",
            placeholders);
        let mut qb = sqlx::query_scalar(&sql_rk_ruj).bind(&bulan_dari).bind(&bulan_sampai);
        for p in &kd_poli_list { qb = qb.bind(*p); }
        let rk_ruj: i64 = qb.fetch_one(&state.pool).await.unwrap_or(0);
        let faskes_other = (total - pus - rs).max(0);

        // REALTIME: timpa entry baris spesialisasi ini.
        // Rujukan masuk per faskes; dirujuk keluar dipisah rujukan vs datang sendiri.
        // Dikembalikan ke asal & diterima kembali tak dilacak Khanza (=0).
        if let Some(e) = entries.iter_mut().find(|e| e.jenis_kode == kode) {
            e.rm_in_pus = Some(pus as i32);
            e.rm_in_rs = Some(rs as i32);
            e.rm_in_faskes = Some(faskes_other as i32);
            e.rm_out_pus = Some(0); e.rm_out_rs = Some(0); e.rm_out_faskes = Some(0);
            e.rk_pasien_rujukan = Some(rk_ruj as i32);
            e.rk_pasien_datang_sendiri = Some((rk - rk_ruj).max(0) as i32);
            e.rk_diterima_kembali = Some(0);
        }

        per_spesialisasi.push(Rl310KhanzaSpes {
            jenis_kode: kode.to_string(),
            rm_in_total: total,
            rm_in_pus_pattern: pus,
            rm_in_rs_pattern: rs,
            rm_in_faskes_other: faskes_other,
            rk_total: rk,
        });
    }

    Ok(Json(Rl310Resp {
        bulan,
        entries,
        khanza: Rl310Khanza {
            rujuk_masuk_total, rujuk_keluar_total,
            rujuk_masuk_pus_pattern, rujuk_masuk_rs_pattern,
            rujuk_masuk_faskes_other, rujuk_masuk_kosong,
            per_spesialisasi,
        },
    }))
}

pub async fn update_rl310(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl310Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl310_entry SET
           rm_in_pus=?, rm_in_rs=?, rm_in_faskes=?,
           rm_out_pus=?, rm_out_rs=?, rm_out_faskes=?,
           rk_pasien_rujukan=?, rk_pasien_datang_sendiri=?, rk_diterima_kembali=?,
           updated_by=?
         WHERE id=?"
    )
    .bind(body.rm_in_pus).bind(body.rm_in_rs).bind(body.rm_in_faskes)
    .bind(body.rm_out_pus).bind(body.rm_out_rs).bind(body.rm_out_faskes)
    .bind(body.rk_pasien_rujukan).bind(body.rk_pasien_datang_sendiri).bind(body.rk_diterima_kembali)
    .bind(&user.0.kode)
    .bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl310_entry SET ... updated_by={} WHERE id={}",
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;
    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

pub async fn cetak_rl310(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl310(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    let mut tot = [0i32; 11];
    for e in &resp.entries {
        let in_pus = e.rm_in_pus.unwrap_or(0);
        let in_rs  = e.rm_in_rs.unwrap_or(0);
        let in_fk  = e.rm_in_faskes.unwrap_or(0);
        let in_tot = in_pus + in_rs + in_fk;
        let out_pus = e.rm_out_pus.unwrap_or(0);
        let out_rs  = e.rm_out_rs.unwrap_or(0);
        let out_fk  = e.rm_out_faskes.unwrap_or(0);
        let out_tot = out_pus + out_rs + out_fk;
        let rk_ruj = e.rk_pasien_rujukan.unwrap_or(0);
        let rk_sen = e.rk_pasien_datang_sendiri.unwrap_or(0);
        let rk_tot = rk_ruj + rk_sen;
        let rk_kbl = e.rk_diterima_kembali.unwrap_or(0);
        tot[0] += in_pus; tot[1] += in_rs; tot[2] += in_fk;
        tot[3] += out_pus; tot[4] += out_rs; tot[5] += out_fk;
        tot[6] += rk_ruj; tot[7] += rk_sen; tot[8] += rk_kbl;
        tot[9] += in_tot; tot[10] += rk_tot;
        tbody.push_str(&format!(
            "<tr><td class=\"no\">{}</td><td>{}</td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td><td class=\"n\">{}</td></tr>",
            esc(&e.jenis_kode), esc(&e.jenis_nama),
            in_pus, in_rs, in_fk, in_tot,
            out_pus, out_rs, out_fk, out_tot,
            rk_ruj, rk_sen, rk_tot, rk_kbl
        ));
    }
    tbody.push_str(&format!(
        "<tr class=\"total\"><td class=\"no\">99</td><td><strong>TOTAL</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td></tr>",
        tot[0], tot[1], tot[2], tot[9],
        tot[3], tot[4], tot[5], tot[3]+tot[4]+tot[5],
        tot[6], tot[7], tot[10], tot[8]
    ));

    let kh = &resp.khanza;
    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.10 Rujukan — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:10mm;font-size:8.5pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:10px}}
  table{{width:100%;border-collapse:collapse;font-size:7.5pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:2px 4px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;font-size:7.5pt;text-align:center}}
  th.subgrp{{background:#3b82f6}}
  th.subgrp2{{background:#6366f1}}
  th.subgrp3{{background:#8b5cf6}}
  td.no{{width:32px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.total td{{background:#bfdbfe;font-weight:bold}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:8.5pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:8mm}}.no-print{{display:none}}@page{{size:landscape}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.10 Rujukan (landscape)</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.10 — Rekapitulasi Kegiatan Pelayanan Rujukan</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  🔄 <strong>Khanza rujukan {bulan}</strong>:
  rujuk_masuk total = <strong>{rm_tot}</strong> (Pus pattern={rm_pus}, RS pattern={rm_rs}, Faskes lain={rm_fk}, perujuk kosong={rm_zr})
  · rujuk (keluar) = <strong>{rk_tot}</strong>
</div>

<table>
  <thead><tr>
    <th rowspan="2" class="no">No</th><th rowspan="2">Jenis Spesialisasi</th>
    <th colspan="4" class="subgrp">Rujukan Masuk — Diterima Dari</th>
    <th colspan="4" class="subgrp2">Rujukan Masuk — Dikembalikan ke</th>
    <th colspan="4" class="subgrp3">Dirujuk Keluar</th>
  </tr><tr>
    <th class="subgrp">Pus</th><th class="subgrp">RS</th><th class="subgrp">Faskes</th><th class="subgrp">Total</th>
    <th class="subgrp2">Pus</th><th class="subgrp2">RS Asal</th><th class="subgrp2">Faskes</th><th class="subgrp2">Total</th>
    <th class="subgrp3">Pas. Rujukan</th><th class="subgrp3">Pas. Datang Sendiri</th><th class="subgrp3">Total</th><th class="subgrp3">Dit. Kembali</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Validasi JUKNIS: Total dikembalikan ≤ Total RM Diterima · Diterima Kembali ≤ Total Dirujuk Keluar.<br/>
  Sumber: rujuk_masuk (Khanza) + reg_periksa (klasifikasi spesialisasi via kd_poli) + rujuk (keluar).
  Klasifikasi asal perujuk via nama LIKE: Puskesmas (%PUSKES%/PKM%), RS (%RUMAH SAKIT%/RS %/RSU%/RSUD%/HOSPITAL%), sisanya Faskes Lain.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), bulan = esc(&resp.bulan),
        rm_tot = kh.rujuk_masuk_total, rm_pus = kh.rujuk_masuk_pus_pattern,
        rm_rs = kh.rujuk_masuk_rs_pattern, rm_fk = kh.rujuk_masuk_faskes_other,
        rm_zr = kh.rujuk_masuk_kosong, rk_tot = kh.rujuk_keluar_total,
        tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.11 — Rekapitulasi Pelayanan Gigi dan Mulut (TAHUNAN)
// Per JUKNIS SIRS 6.3 Bab IV K. 16 jenis kegiatan + TOTAL.
// Sumber Khanza: rawat_jl_dr + rawat_jl_drpr × jns_perawatan (poli GIG) per nama pattern.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
pub struct Rl311Query {
    pub tahun: Option<String>,  // YYYY
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl311Entry {
    pub id:          Option<i32>,
    pub tahun:       String,
    pub urutan:      i32,
    pub jenis_kode:  String,
    pub jenis_nama:  String,
    pub jumlah:      Option<i32>,
    pub updated_at:  Option<String>,
    pub updated_by:  Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Rl311KhanzaSugesti {
    pub jenis_kode: String,
    pub count:      i64,
    pub sumber:     String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl311KhanzaTop {
    pub nm_perawatan: Option<String>,
    pub jumlah:       i64,
}

#[derive(Debug, Serialize)]
pub struct Rl311Khanza {
    pub kunjungan_poli_gig:  i64,
    pub total_tindakan:      i64,
    pub sugesti_per_row:     Vec<Rl311KhanzaSugesti>,
    pub top_tindakan:        Vec<Rl311KhanzaTop>,
}

#[derive(Debug, Serialize)]
pub struct Rl311Resp {
    pub tahun:   String,
    pub entries: Vec<Rl311Entry>,
    pub khanza:  Rl311Khanza,
}

fn rl311_master() -> Vec<(i32, &'static str, &'static str)> {
    vec![
        (1,  "1",  "Tumpatan Gigi Tetap"),
        (2,  "2",  "Tumpatan Gigi Sulung"),
        (3,  "3",  "Pengobatan Pulpa"),
        (4,  "4",  "Pencabutan Gigi Tetap"),
        (5,  "5",  "Pencabutan Gigi Sulung"),
        (6,  "6",  "Pengobatan Periodontal"),
        (7,  "7",  "Pengobatan Abses"),
        (8,  "8",  "Pembersihan Karang Gigi"),
        (9,  "9",  "Prothese Lengkap"),
        (10, "10", "Prothese Sebagian"),
        (11, "11", "Prothese Cekat"),
        (12, "12", "Orthodonti"),
        (13, "13", "Jacket/Bridge"),
        (14, "14", "Bedah Mulut"),
        (15, "15", "Implan Gigi"),
        (16, "16", "Penyakit Mulut"),
    ]
}

pub async fn get_rl311(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl311Query>,
) -> Result<Json<Rl311Resp>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.clone().filter(|s| s.len() == 4)
        .unwrap_or_else(|| chrono::Local::now().format("%Y").to_string());
    let tahun_dari  = format!("{}-01-01", tahun);
    let tahun_sampai = format!("{}-12-31", tahun);

    let count_existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sirs_rl311_entry WHERE tahun=?"
    ).bind(&tahun).fetch_one(&state.pool).await.unwrap_or(0);
    if count_existing == 0 {
        for (urutan, kode, nama) in rl311_master() {
            let _ = sqlx::query(
                "INSERT INTO sirs_rl311_entry (tahun,urutan,jenis_kode,jenis_nama,jumlah)
                 VALUES (?,?,?,?,0)"
            )
            .bind(&tahun).bind(urutan).bind(kode).bind(nama)
            .execute(&state.pool).await;
        }
    }

    let entries: Vec<Rl311Entry> = sqlx::query_as(
        "SELECT id, tahun, urutan, jenis_kode, jenis_nama, jumlah,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl311_entry WHERE tahun=? ORDER BY urutan"
    ).bind(&tahun).fetch_all(&state.pool).await.map_err(db_err)?;

    // ── Khanza sanity ──
    let kunjungan_poli_gig: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa
         WHERE kd_poli IN (SELECT kd_poli FROM poliklinik WHERE UPPER(nm_poli) REGEXP 'GIGI|MULUT|KONSERVASI') AND tgl_registrasi BETWEEN ? AND ?"
    ).bind(&tahun_dari).bind(&tahun_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    // Total tindakan poli GIG dari kedua tabel rawat_jl_dr + drpr
    let total_tindakan: i64 = sqlx::query_scalar(
        "SELECT
           (SELECT COUNT(*) FROM rawat_jl_dr rj
            JOIN reg_periksa r ON r.no_rawat=rj.no_rawat
            WHERE rj.tgl_perawatan BETWEEN ? AND ? AND r.kd_poli IN (SELECT kd_poli FROM poliklinik WHERE UPPER(nm_poli) REGEXP 'GIGI|MULUT|KONSERVASI') AND UPPER(m.nm_perawatan) NOT LIKE 'JASA PELAYANAN%')
         + (SELECT COUNT(*) FROM rawat_jl_drpr rj
            JOIN reg_periksa r ON r.no_rawat=rj.no_rawat
            WHERE rj.tgl_perawatan BETWEEN ? AND ? AND r.kd_poli IN (SELECT kd_poli FROM poliklinik WHERE UPPER(nm_poli) REGEXP 'GIGI|MULUT|KONSERVASI') AND UPPER(m.nm_perawatan) NOT LIKE 'JASA PELAYANAN%')"
    ).bind(&tahun_dari).bind(&tahun_sampai)
     .bind(&tahun_dari).bind(&tahun_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    // Top tindakan combined
    let top_tindakan: Vec<Rl311KhanzaTop> = sqlx::query_as(
        "SELECT nm_perawatan, CAST(SUM(jml) AS SIGNED) AS jumlah FROM (
           SELECT m.nm_perawatan AS nm_perawatan, COUNT(*) AS jml
             FROM rawat_jl_dr rj
             LEFT JOIN jns_perawatan m ON m.kd_jenis_prw=rj.kd_jenis_prw
             JOIN reg_periksa r ON r.no_rawat=rj.no_rawat
             WHERE rj.tgl_perawatan BETWEEN ? AND ? AND r.kd_poli IN (SELECT kd_poli FROM poliklinik WHERE UPPER(nm_poli) REGEXP 'GIGI|MULUT|KONSERVASI') AND UPPER(m.nm_perawatan) NOT LIKE 'JASA PELAYANAN%'
             GROUP BY m.nm_perawatan
           UNION ALL
           SELECT m.nm_perawatan AS nm_perawatan, COUNT(*) AS jml
             FROM rawat_jl_drpr rj
             LEFT JOIN jns_perawatan m ON m.kd_jenis_prw=rj.kd_jenis_prw
             JOIN reg_periksa r ON r.no_rawat=rj.no_rawat
             WHERE rj.tgl_perawatan BETWEEN ? AND ? AND r.kd_poli IN (SELECT kd_poli FROM poliklinik WHERE UPPER(nm_poli) REGEXP 'GIGI|MULUT|KONSERVASI') AND UPPER(m.nm_perawatan) NOT LIKE 'JASA PELAYANAN%'
             GROUP BY m.nm_perawatan
         ) c GROUP BY nm_perawatan
         ORDER BY jumlah DESC LIMIT 20"
    ).bind(&tahun_dari).bind(&tahun_sampai)
     .bind(&tahun_dari).bind(&tahun_sampai)
     .fetch_all(&state.pool).await.map_err(db_err)?;

    // Auto-classify per JUKNIS row via nama LIKE pattern (UPPER nm_perawatan)
    // (jenis_kode, label_sumber, includes, excludes)
    let row_specs: Vec<(&str, &str, Vec<&str>, Vec<&str>)> = vec![
        ("5",  "Pencabutan Gigi Sulung (Ekstraksi Sulung/Susu)",   vec!["%EKSTRAKSI GIGI SULUNG%", "%EKSTRAKSI GIGI SUSU%"], vec![]),
        ("4",  "Pencabutan Gigi Tetap (Ekstraksi Gigi Tetap)",     vec!["%EKSTRAKSI GIGI TETAP%"],                            vec![]),
        ("2",  "Tumpatan Gigi Sulung (Tambalan Sulung)",           vec!["%TUMPATAN%SULUNG%", "%TAMBALAN%SULUNG%"], vec![]),
        ("1",  "Tumpatan Gigi Tetap (Tambalan/Komposit/GI)",       vec!["%TAMBALAN%", "%KOMPOSIT%", "TUMPATAN%"], vec!["%SEMENTARA%"]),
        ("3",  "Pengobatan Pulpa (pulpa/endodontic/RCT/pulp cap)", vec!["%PULPA%", "%PULPECTOMY%", "%PULPOTOMY%", "%ENDODON%", "%PULP CAP%", "ROOT CANAL%", "RCT%"], vec![]),
        ("6",  "Periodontal (kuretasi/root planning)",             vec!["%PERIODONTAL%", "%KURETAS%", "%ROOT PLANNING%"], vec![]),
        ("7",  "Pengobatan Abses (insisi/abses)",                  vec!["%ABSES%", "%INSISI%"], vec![]),
        ("8",  "Pembersihan Karang Gigi (skeling/scaling/karang)", vec!["%SKELING%", "%SCALING%", "%KARANG%"], vec![]),
        ("9",  "Prothese Lengkap (GT Penuh/Lengkap)",              vec!["%GIGI TIRUAN PENUH%", "%PROTHESE PENUH%", "%GT LENGKAP%", "%GIGI TIRUAN LENGKAP%"], vec![]),
        ("10", "Prothese Sebagian (GT Lepasan)",                   vec!["%GIGI TIRUAN LEPASAN%"], vec!["%PENUH%"]),
        ("11", "Prothese Cekat (GT Cekat/inlay)",                  vec!["%GT CEKAT%", "%PROTHESE CEKAT%", "%INLAY%"], vec![]),
        ("12", "Orthodonti (ortho/braket)",                        vec!["%ORTHO%", "%BRAKET%", "%BRAKE T%"], vec![]),
        ("13", "Jacket/Bridge/Crown",                              vec!["%JACKET%", "%BRIDGE%", "%CROWN%", "%MAHKOTA%"], vec![]),
        ("14", "Bedah Mulut (odontectomy/alveolectomy)",           vec!["%ODONTECTOMY%", "%ALVEOLECTOMY%", "%MARSUPIALISASI%", "%BEDAH MULUT%"], vec![]),
        ("15", "Implan Gigi",                                      vec!["%IMPLAN%", "%IMPLANT%"], vec![]),
    ];

    let mut sugesti_per_row: Vec<Rl311KhanzaSugesti> = Vec::new();
    for (jenis_kode, sumber, includes, excludes) in &row_specs {
        let include_or = includes.iter().map(|_| "UPPER(m.nm_perawatan) LIKE ?").collect::<Vec<_>>().join(" OR ");
        let mut where_clause = format!("({})", include_or);
        for _ in excludes { where_clause.push_str(" AND UPPER(m.nm_perawatan) NOT LIKE ?"); }
        // Combined query rawat_jl_dr + drpr
        let sql = format!(
            "SELECT
              ((SELECT COUNT(*) FROM rawat_jl_dr rj
                LEFT JOIN jns_perawatan m ON m.kd_jenis_prw=rj.kd_jenis_prw
                JOIN reg_periksa r ON r.no_rawat=rj.no_rawat
                WHERE rj.tgl_perawatan BETWEEN ? AND ? AND r.kd_poli IN (SELECT kd_poli FROM poliklinik WHERE UPPER(nm_poli) REGEXP 'GIGI|MULUT|KONSERVASI') AND UPPER(m.nm_perawatan) NOT LIKE 'JASA PELAYANAN%'
                  AND {})
             + (SELECT COUNT(*) FROM rawat_jl_drpr rj
                LEFT JOIN jns_perawatan m ON m.kd_jenis_prw=rj.kd_jenis_prw
                JOIN reg_periksa r ON r.no_rawat=rj.no_rawat
                WHERE rj.tgl_perawatan BETWEEN ? AND ? AND r.kd_poli IN (SELECT kd_poli FROM poliklinik WHERE UPPER(nm_poli) REGEXP 'GIGI|MULUT|KONSERVASI') AND UPPER(m.nm_perawatan) NOT LIKE 'JASA PELAYANAN%'
                  AND {})) AS c", where_clause, where_clause);
        let mut qb = sqlx::query_scalar(&sql);
        // First subquery binds
        qb = qb.bind(&tahun_dari).bind(&tahun_sampai);
        for p in includes { qb = qb.bind(*p); }
        for p in excludes { qb = qb.bind(*p); }
        // Second subquery binds
        qb = qb.bind(&tahun_dari).bind(&tahun_sampai);
        for p in includes { qb = qb.bind(*p); }
        for p in excludes { qb = qb.bind(*p); }
        let cnt: i64 = qb.fetch_one(&state.pool).await.unwrap_or(0);
        sugesti_per_row.push(Rl311KhanzaSugesti {
            jenis_kode: jenis_kode.to_string(),
            count: cnt,
            sumber: sumber.to_string(),
        });
    }

    Ok(Json(Rl311Resp {
        tahun,
        entries,
        khanza: Rl311Khanza { kunjungan_poli_gig, total_tindakan, sugesti_per_row, top_tindakan },
    }))
}

pub async fn update_rl311(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl311Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl311_entry SET jumlah=?, updated_by=? WHERE id=?"
    )
    .bind(body.jumlah).bind(&user.0.kode).bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl311_entry SET ... updated_by={} WHERE id={}",
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;
    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

pub async fn cetak_rl311(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl311Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl311(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    let mut tot: i32 = 0;
    for e in &resp.entries {
        // REALTIME: ambil jumlah dari klasifikasi Khanza (sugesti_per_row), bukan entry manual.
        let v = resp.khanza.sugesti_per_row.iter()
            .find(|s| s.jenis_kode == e.jenis_kode)
            .map(|s| s.count as i32).unwrap_or(0);
        tot += v;
        tbody.push_str(&format!(
            "<tr><td class=\"no\">{}</td><td>{}</td><td class=\"n\">{}</td></tr>",
            esc(&e.jenis_kode), esc(&e.jenis_nama), v
        ));
    }
    tbody.push_str(&format!(
        "<tr class=\"total\"><td class=\"no\">99</td><td><strong>TOTAL</strong></td><td class=\"n\"><strong>{}</strong></td></tr>",
        tot
    ));

    let mut top_html = String::new();
    for (i, t) in resp.khanza.top_tindakan.iter().take(15).enumerate() {
        top_html.push_str(&format!(
            "<tr><td>{}</td><td>{}</td><td class=\"n\">{}</td></tr>",
            i+1, esc(t.nm_perawatan.as_deref().unwrap_or("-")), t.jumlah
        ));
    }

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.11 Gigi & Mulut — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:14mm;font-size:9.5pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:12px}}
  table{{width:100%;border-collapse:collapse;font-size:9pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:4px 6px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;text-align:center}}
  td.no{{width:48px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.total td{{background:#bfdbfe;font-weight:bold}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:9pt}}
  .topjenis{{margin-top:14px;font-size:9pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:12mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.11 Gigi & Mulut (Tahunan)</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.11 — Rekapitulasi Pelayanan Gigi dan Mulut</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>Tahun {tahun}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  🦷 <strong>Khanza poli GIG tahun {tahun}</strong>: kunjungan = <strong>{kunj}</strong>
  · total tindakan (rawat_jl_dr + drpr) = <strong>{tot_tind}</strong>
  · manual RL 3.11 total = <strong>{tot_manual}</strong>
</div>

<table>
  <thead><tr><th class="no">No</th><th>Jenis Kegiatan</th><th>Jumlah</th></tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="topjenis">
  <strong>📊 Top 15 tindakan poli GIG Khanza tahun {tahun}</strong>:
  <table>
    <thead><tr><th>#</th><th>Nama Tindakan</th><th>Jumlah</th></tr></thead>
    <tbody>{top}</tbody>
  </table>
</div>

<div class="footer">
  Sumber: <code>rawat_jl_dr + rawat_jl_drpr × jns_perawatan</code> filter <code>reg_periksa.kd_poli='GIG'</code>.<br/>
  Klasifikasi auto: nama-LIKE pattern (Ekstraksi Tetap/Sulung, Tambalan/Komposit, Pulpa, Periodontal, Abses, Skeling, GT Penuh/Lepasan/Cekat, Ortho, Crown/Bridge, Odontectomy/Alveolectomy, Implan).<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), tahun = esc(&resp.tahun),
        kunj = resp.khanza.kunjungan_poli_gig,
        tot_tind = resp.khanza.total_tindakan,
        tot_manual = tot, tbody = tbody, top = top_html,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.12 — Rekapitulasi Pelayanan Pembedahan (Bulanan)
// Per JUKNIS SIRS 6.3 Bab IV L. 16 spesialisasi × (Khusus/Besar/Sedang/Kecil).
// Sumber Khanza: prosedur_pasien (ICD-9) status='Ranap'. Klasifikasi Khusus/Besar/
// Sedang/Kecil = MANUAL (tidak tercatat di Khanza prosedur_pasien).
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl312Entry {
    pub id:          Option<i32>,
    pub bulan:       String,
    pub urutan:      i32,
    pub jenis_kode:  String,
    pub jenis_nama:  String,
    pub khusus:      Option<i32>,
    pub besar:       Option<i32>,
    pub sedang:      Option<i32>,
    pub kecil:       Option<i32>,
    pub updated_at:  Option<String>,
    pub updated_by:  Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Rl312KhanzaSugesti {
    pub jenis_kode: String,
    pub count:      i64,
    pub sumber:     String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl312KhanzaTop {
    pub kode:         Option<String>,
    pub deskripsi:    Option<String>,
    pub jumlah:       i64,
}

#[derive(Debug, Serialize)]
pub struct Rl312Khanza {
    pub total_prosedur_ranap: i64,
    pub total_prosedur_ralan: i64,
    pub sugesti_per_row:      Vec<Rl312KhanzaSugesti>,
    pub top_prosedur:         Vec<Rl312KhanzaTop>,
}

#[derive(Debug, Serialize)]
pub struct Rl312Resp {
    pub bulan:   String,
    pub entries: Vec<Rl312Entry>,
    pub khanza:  Rl312Khanza,
}

// ICD-9 chapter mapping per JUKNIS spesialisasi (LIKE prefix pattern)
// (urutan, kode, nama, vec of LIKE prefix utk auto-classify)
fn rl312_master() -> Vec<(i32, &'static str, &'static str, Vec<&'static str>)> {
    vec![
        (1,  "1",  "Bedah",                       vec!["40%", "41%", "85%", "86%", "17%"]),
        (2,  "2",  "Obstetri dan Ginekologi",     vec!["65%", "66%", "67%", "68%", "69%", "70%", "71%", "72%", "73%", "74%", "75%"]),
        (3,  "3",  "Bedah Saraf (Non Stroke)",    vec!["01%", "02%", "03%", "04%", "05%"]),
        (4,  "4",  "THT",                         vec!["18%", "19%", "20%", "21%", "22%", "25%", "26%", "27%", "28%", "29%"]),
        (5,  "5",  "Mata",                        vec!["08%", "09%", "10%", "11%", "12%", "13%", "14%", "15%", "16%"]),
        (6,  "6",  "Kulit dan Kelamin",           vec!["64%"]),
        (7,  "7",  "Gigi dan Mulut",              vec!["23%", "24%"]),
        (8,  "8",  "Bedah Anak",                  vec![]),
        (9,  "9",  "Kardiovaskular",              vec!["00.5%", "35%", "36%", "37%", "38%", "39%"]),
        (10, "10", "Bedah Orthopedi",             vec!["76%", "77%", "78%", "79%", "80%", "81%", "82%", "83%", "84%"]),
        (11, "11", "Thoraks",                     vec!["30%", "31%", "32%", "33%", "34%"]),
        (12, "12", "Digestif",                    vec!["42%", "43%", "44%", "45%", "46%", "47%", "48%", "49%", "50%", "51%", "52%", "53%", "54%"]),
        (13, "13", "Urologi",                     vec!["55%", "56%", "57%", "58%", "59%", "60%", "61%", "62%", "63%"]),
        (14, "14", "Bedah Saraf (Stroke)",        vec![]),
        (15, "15", "Kanker",                      vec![]),
        (16, "16", "Lain-lain",                   vec!["06%", "07%"]),
    ]
}

pub async fn get_rl312(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl312Resp>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let bulan_dari = format!("{}-01", bulan);
    let (year_s, month_s) = (&bulan[..4], &bulan[5..7]);
    let year: i32 = year_s.parse().unwrap_or(2026);
    let month: u32 = month_s.parse().unwrap_or(1);
    let next_month_first = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let bulan_sampai = (next_month_first - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    let count_existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sirs_rl312_entry WHERE bulan=?"
    ).bind(&bulan).fetch_one(&state.pool).await.unwrap_or(0);
    if count_existing == 0 {
        for (urutan, kode, nama, _) in rl312_master() {
            let _ = sqlx::query(
                "INSERT INTO sirs_rl312_entry (bulan,urutan,jenis_kode,jenis_nama,khusus,besar,sedang,kecil)
                 VALUES (?,?,?,?,0,0,0,0)"
            )
            .bind(&bulan).bind(urutan).bind(kode).bind(nama)
            .execute(&state.pool).await;
        }
    }

    let mut entries: Vec<Rl312Entry> = sqlx::query_as(
        "SELECT id, bulan, urutan, jenis_kode, jenis_nama,
                khusus, besar, sedang, kecil,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl312_entry WHERE bulan=? ORDER BY urutan"
    ).bind(&bulan).fetch_all(&state.pool).await.map_err(db_err)?;
    let bulan_sampai_dt = format!("{} 23:59:59", bulan_sampai);

    // ── REALTIME: golongan per spesialisasi dari tabel operasi (port Trimitra) ──
    // Golongan (Khusus/Besar/Sedang/Kecil) HANYA ada di operasi.kategori — bila
    // tabel operasi kosong, hasil = 0 (realtime-ready saat data operasi terisi).
    // Spesialisasi diklasifikasi dari prosedur_pasien ICD-9 chapter (<87); fallback
    // paket_operasi (Kebidanan/Sectio→2, Katarak→5); sisanya '16' Lain-lain.
    let icd_case = "CASE
        WHEN LEFT(pp.kode,2) IN ('40','41','85','86','17') THEN '1'
        WHEN LEFT(pp.kode,2) IN ('65','66','67','68','69','70','71','72','73','74','75') THEN '2'
        WHEN LEFT(pp.kode,2) IN ('01','02','03','04','05') THEN '3'
        WHEN LEFT(pp.kode,2) IN ('18','19','20','21','22','25','26','27','28','29') THEN '4'
        WHEN LEFT(pp.kode,2) IN ('08','09','10','11','12','13','14','15','16') THEN '5'
        WHEN LEFT(pp.kode,2) IN ('64') THEN '6'
        WHEN LEFT(pp.kode,2) IN ('23','24') THEN '7'
        WHEN LEFT(pp.kode,2) IN ('35','36','37','38','39') THEN '9'
        WHEN LEFT(pp.kode,2) IN ('76','77','78','79','80','81','82','83','84') THEN '10'
        WHEN LEFT(pp.kode,2) IN ('30','31','32','33','34') THEN '11'
        WHEN LEFT(pp.kode,2) IN ('42','43','44','45','46','47','48','49','50','51','52','53','54') THEN '12'
        WHEN LEFT(pp.kode,2) IN ('55','56','57','58','59','60','61','62','63') THEN '13'
        WHEN LEFT(pp.kode,2) IN ('06','07') THEN '16'
        ELSE '16' END";
    let rl312_agg_sql = format!(
        "SELECT COALESCE(icd_sp, paket_sp, '16') AS sp, golongan, CAST(COUNT(*) AS SIGNED) AS n
         FROM (
            SELECT o.kategori AS golongan,
                (SELECT {} FROM prosedur_pasien pp
                   WHERE pp.no_rawat=o.no_rawat AND pp.kode < '87'
                   ORDER BY pp.kode LIMIT 1) AS icd_sp,
                (SELECT CASE
                    WHEN po.kategori='Kebidanan' OR UPPER(po.nm_perawatan) REGEXP 'SECTIO|CAESAR|SESAR|KURET|CURET|PARTUS' THEN '2'
                    WHEN UPPER(po.nm_perawatan) REGEXP 'KATARAK|PHACO|FACO|LENSA' THEN '5'
                    ELSE NULL END
                   FROM paket_operasi po WHERE po.kode_paket=o.kode_paket) AS paket_sp
            FROM operasi o
            WHERE o.tgl_operasi BETWEEN ? AND ? AND o.kategori IN ('Khusus','Besar','Sedang','Kecil')
         ) x
         GROUP BY sp, golongan", icd_case);
    let rl312_agg: Vec<(String, String, i64)> = sqlx::query_as(&rl312_agg_sql)
        .bind(&bulan_dari).bind(&bulan_sampai_dt)
        .fetch_all(&state.pool).await.unwrap_or_default();
    // map sp -> [khusus, besar, sedang, kecil]
    let mut gmap: std::collections::HashMap<String, [i32; 4]> = std::collections::HashMap::new();
    for (sp, gol, n) in &rl312_agg {
        let idx = match gol.as_str() { "Khusus" => 0, "Besar" => 1, "Sedang" => 2, _ => 3 };
        gmap.entry(sp.clone()).or_insert([0; 4])[idx] += *n as i32;
    }
    for e in entries.iter_mut() {
        let c = gmap.get(&e.jenis_kode).copied().unwrap_or([0; 4]);
        e.khusus = Some(c[0]); e.besar = Some(c[1]); e.sedang = Some(c[2]); e.kecil = Some(c[3]);
    }

    // ── Khanza sanity (status=Ranap = prosedur bedah ranap) ──
    let total_prosedur_ranap: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM prosedur_pasien pp
         JOIN reg_periksa r ON r.no_rawat=pp.no_rawat
         WHERE r.tgl_registrasi BETWEEN ? AND ? AND pp.status='Ranap'"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let total_prosedur_ralan: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM prosedur_pasien pp
         JOIN reg_periksa r ON r.no_rawat=pp.no_rawat
         WHERE r.tgl_registrasi BETWEEN ? AND ? AND pp.status='Ralan'"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let top_prosedur: Vec<Rl312KhanzaTop> = sqlx::query_as(
        "SELECT pp.kode AS kode, ic.deskripsi_panjang AS deskripsi,
                CAST(COUNT(*) AS SIGNED) AS jumlah
         FROM prosedur_pasien pp
         LEFT JOIN icd9 ic ON ic.kode=pp.kode
         JOIN reg_periksa r ON r.no_rawat=pp.no_rawat
         WHERE r.tgl_registrasi BETWEEN ? AND ? AND pp.status='Ranap'
         GROUP BY pp.kode, ic.deskripsi_panjang
         ORDER BY jumlah DESC LIMIT 20"
    ).bind(&bulan_dari).bind(&bulan_sampai)
     .fetch_all(&state.pool).await.map_err(db_err)?;

    // Sugesti per spesialisasi via ICD-9 prefix
    let mut sugesti_per_row: Vec<Rl312KhanzaSugesti> = Vec::new();
    for (_, kode, _, prefixes) in rl312_master() {
        if prefixes.is_empty() {
            sugesti_per_row.push(Rl312KhanzaSugesti {
                jenis_kode: kode.to_string(),
                count: 0,
                sumber: "Tidak ada mapping ICD-9".to_string(),
            });
            continue;
        }
        let or_clause = prefixes.iter().map(|_| "pp.kode LIKE ?").collect::<Vec<_>>().join(" OR ");
        let sql = format!(
            "SELECT COUNT(*) FROM prosedur_pasien pp
             JOIN reg_periksa r ON r.no_rawat=pp.no_rawat
             WHERE r.tgl_registrasi BETWEEN ? AND ? AND pp.status='Ranap'
               AND ({})", or_clause);
        let mut qb = sqlx::query_scalar(&sql).bind(&bulan_dari).bind(&bulan_sampai);
        for p in &prefixes { qb = qb.bind(*p); }
        let cnt: i64 = qb.fetch_one(&state.pool).await.unwrap_or(0);
        let sumber = format!("ICD-9 chapter: {}", prefixes.join(", "));
        sugesti_per_row.push(Rl312KhanzaSugesti {
            jenis_kode: kode.to_string(),
            count: cnt,
            sumber,
        });
    }

    Ok(Json(Rl312Resp {
        bulan,
        entries,
        khanza: Rl312Khanza { total_prosedur_ranap, total_prosedur_ralan, sugesti_per_row, top_prosedur },
    }))
}

pub async fn update_rl312(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl312Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl312_entry SET khusus=?, besar=?, sedang=?, kecil=?, updated_by=? WHERE id=?"
    )
    .bind(body.khusus).bind(body.besar).bind(body.sedang).bind(body.kecil)
    .bind(&user.0.kode).bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl312_entry SET ... updated_by={} WHERE id={}",
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;
    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

pub async fn cetak_rl312(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl312(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    let mut tot = [0i32; 5];
    for e in &resp.entries {
        let kh = e.khusus.unwrap_or(0);
        let bs = e.besar.unwrap_or(0);
        let sd = e.sedang.unwrap_or(0);
        let kc = e.kecil.unwrap_or(0);
        let total = kh + bs + sd + kc;
        tot[0] += kh; tot[1] += bs; tot[2] += sd; tot[3] += kc; tot[4] += total;
        tbody.push_str(&format!(
            "<tr><td class=\"no\">{}</td><td>{}</td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td>\
             <td class=\"n\"><strong>{}</strong></td></tr>",
            esc(&e.jenis_kode), esc(&e.jenis_nama), kh, bs, sd, kc, total
        ));
    }
    tbody.push_str(&format!(
        "<tr class=\"total\"><td class=\"no\">99</td><td><strong>TOTAL</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td></tr>",
        tot[0], tot[1], tot[2], tot[3], tot[4]
    ));

    let mut top_html = String::new();
    for (i, t) in resp.khanza.top_prosedur.iter().take(15).enumerate() {
        top_html.push_str(&format!(
            "<tr><td>{}</td><td>{}</td><td>{}</td><td class=\"n\">{}</td></tr>",
            i+1, esc(t.kode.as_deref().unwrap_or("-")),
            esc(t.deskripsi.as_deref().unwrap_or("-")), t.jumlah
        ));
    }

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.12 Pembedahan — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:12mm;font-size:9pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:12px}}
  table{{width:100%;border-collapse:collapse;font-size:8.5pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:3px 6px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;text-align:center}}
  td.no{{width:42px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.total td{{background:#bfdbfe;font-weight:bold}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:9pt}}
  .topjenis{{margin-top:14px;font-size:8.5pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:10mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.12 Pembedahan</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.12 — Rekapitulasi Kegiatan Pelayanan Pembedahan</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  🔪 <strong>Khanza prosedur_pasien {bulan}</strong>:
  Ranap = <strong>{tot_rn}</strong> · Ralan = <strong>{tot_rl}</strong> ·
  Manual RL 3.12 total = <strong>{tot_manual}</strong>
</div>

<table>
  <thead><tr>
    <th class="no">No</th><th>Spesialisasi</th>
    <th>Khusus</th><th>Besar</th><th>Sedang</th><th>Kecil</th><th>Total</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="topjenis">
  <strong>📊 Top 15 prosedur Khanza periode {bulan} (status=Ranap)</strong>:
  <table>
    <thead><tr><th>#</th><th>ICD-9</th><th>Deskripsi</th><th>Jumlah</th></tr></thead>
    <tbody>{top}</tbody>
  </table>
</div>

<div class="footer">
  Sumber: <code>prosedur_pasien × icd9</code>, filter status='Ranap'.<br/>
  Klasifikasi Khusus/Besar/Sedang/Kecil sesuai kebijakan RS (tidak tercatat di Khanza prosedur_pasien — input manual).
  Sugesti spesialisasi via ICD-9 chapter prefix: 01-05 Saraf, 08-16 Mata, 18-29 THT (kecuali 23-24 Gigi),
  30-34 Thoraks, 35-39 Kardiovaskular, 40-41/85-86 Bedah, 42-54 Digestif, 55-63 Urologi,
  65-75 Obstetri/Ginekologi, 76-84 Orthopedi.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), bulan = esc(&resp.bulan),
        tot_rn = resp.khanza.total_prosedur_ranap, tot_rl = resp.khanza.total_prosedur_ralan,
        tot_manual = tot[4], tbody = tbody, top = top_html,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.13 — Rekapitulasi Pelayanan Rehabilitasi Medik (TAHUNAN)
// Per JUKNIS SIRS 6.3 Bab IV M. 7 parent + 42 leaf.
// Sumber Khanza: rawat_jl_dr/drpr × jns_perawatan (best-effort pattern match).
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl313Entry {
    pub id:          Option<i32>,
    pub tahun:       String,
    pub urutan:      Option<f64>,
    pub jenis_kode:  String,
    pub jenis_nama:  String,
    pub parent_kode: Option<String>,
    pub is_parent:   i8,
    pub jumlah:      Option<i32>,
    pub updated_at:  Option<String>,
    pub updated_by:  Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Rl313KhanzaSugesti {
    pub jenis_kode: String,
    pub count:      i64,
    pub sumber:     String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl313KhanzaTop {
    pub nm_perawatan: Option<String>,
    pub jumlah:       i64,
}

#[derive(Debug, Serialize)]
pub struct Rl313Khanza {
    pub total_tindakan_rehab: i64,
    pub sugesti_per_row:      Vec<Rl313KhanzaSugesti>,
    pub top_tindakan:         Vec<Rl313KhanzaTop>,
}

#[derive(Debug, Serialize)]
pub struct Rl313Resp {
    pub tahun:   String,
    pub entries: Vec<Rl313Entry>,
    pub khanza:  Rl313Khanza,
}

fn rl313_master() -> Vec<(f64, &'static str, &'static str, Option<&'static str>, bool)> {
    vec![
        (1.00, "1",   "Medis",                                                None, true),
        (1.10, "1.1", "Gait Analyzer",                                        Some("1"), false),
        (1.20, "1.2", "E M G",                                                Some("1"), false),
        (1.30, "1.3", "Uro Dinamic",                                          Some("1"), false),
        (1.40, "1.4", "Side Back",                                            Some("1"), false),
        (1.50, "1.5", "E N Tree",                                             Some("1"), false),
        (1.60, "1.6", "Spyrometer",                                           Some("1"), false),
        (1.70, "1.7", "Static Bicycle",                                       Some("1"), false),
        (1.80, "1.8", "Tread Mill",                                           Some("1"), false),
        (1.90, "1.9", "Body Platysmograf",                                    Some("1"), false),
        (1.99, "1.10","Lain-lain",                                            Some("1"), false),
        (2.00, "2",   "Fisioterapi",                                          None, true),
        (2.10, "2.1", "Latihan Fisik",                                        Some("2"), false),
        (2.20, "2.2", "Aktinoterapi",                                         Some("2"), false),
        (2.30, "2.3", "Elektroterapi",                                        Some("2"), false),
        (2.40, "2.4", "Hidroterapi",                                          Some("2"), false),
        (2.50, "2.5", "Traksi Lumbal dan Cervical",                           Some("2"), false),
        (2.60, "2.6", "Fisioterapi Anak",                                     Some("2"), false),
        (2.70, "2.7", "Lain-lain",                                            Some("2"), false),
        (3.00, "3",   "Okupasiterapi",                                        None, true),
        (3.10, "3.1", "Snoosien Room",                                        Some("3"), false),
        (3.20, "3.2", "Sensori Integrasi",                                    Some("3"), false),
        (3.30, "3.3", "Latihan aktivitas kehidupan sehari-hari",              Some("3"), false),
        (3.40, "3.4", "Proper Body Mekanik",                                  Some("3"), false),
        (3.50, "3.5", "Pembuatan Alat Lontar dan Adaptasi Alat",              Some("3"), false),
        (3.60, "3.6", "Analisa Persiapan Kerja",                              Some("3"), false),
        (3.70, "3.7", "Latihan Relaksasi",                                    Some("3"), false),
        (3.80, "3.8", "Analisa dan Intervensi, Persepsi, Kognitif, Psikomotorik", Some("3"), false),
        (3.90, "3.9", "Okupasiterapi Anak",                                   Some("3"), false),
        (3.99, "3.10","Lain-lain",                                            Some("3"), false),
        (4.00, "4",   "Terapi Wicara",                                        None, true),
        (4.10, "4.1", "Fungsi Bicara",                                        Some("4"), false),
        (4.20, "4.2", "Fungsi Bahasa / Laku",                                 Some("4"), false),
        (4.30, "4.3", "Fungsi Menelan",                                       Some("4"), false),
        (4.40, "4.4", "Terapi Wicara Anak",                                   Some("4"), false),
        (4.50, "4.5", "Lain-lain",                                            Some("4"), false),
        (5.00, "5",   "Psikologi",                                            None, true),
        (5.10, "5.1", "Psikologi Anak",                                       Some("5"), false),
        (5.20, "5.2", "Psikologi Dewasa",                                     Some("5"), false),
        (5.30, "5.3", "Lain-lain",                                            Some("5"), false),
        (6.00, "6",   "Sosial Medik",                                         None, true),
        (6.10, "6.1", "Evaluasi Lingkungan Rumah",                            Some("6"), false),
        (6.20, "6.2", "Evaluasi Ekonomi",                                     Some("6"), false),
        (6.30, "6.3", "Evaluasi Pekerjaan",                                   Some("6"), false),
        (6.40, "6.4", "Lain-lain",                                            Some("6"), false),
        (7.00, "7",   "Ortotik Prostetik",                                    None, true),
        (7.10, "7.1", "Pembuatan Alat Bantu",                                 Some("7"), false),
        (7.20, "7.2", "Pembuatan Alat Anggota Tiruan",                        Some("7"), false),
        (7.30, "7.3", "Lain-Lain",                                            Some("7"), false),
    ]
}

pub async fn get_rl313(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl311Query>,
) -> Result<Json<Rl313Resp>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.clone().filter(|s| s.len() == 4)
        .unwrap_or_else(|| chrono::Local::now().format("%Y").to_string());
    let tahun_dari = format!("{}-01-01", tahun);
    let tahun_sampai = format!("{}-12-31", tahun);

    let count_existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sirs_rl313_entry WHERE tahun=?"
    ).bind(&tahun).fetch_one(&state.pool).await.unwrap_or(0);
    if count_existing == 0 {
        for (urutan, kode, nama, parent, is_parent) in rl313_master() {
            let _ = sqlx::query(
                "INSERT INTO sirs_rl313_entry (tahun,urutan,jenis_kode,jenis_nama,parent_kode,is_parent,jumlah)
                 VALUES (?,?,?,?,?,?,?)"
            )
            .bind(&tahun).bind(urutan).bind(kode).bind(nama).bind(parent)
            .bind(if is_parent { 1i8 } else { 0i8 })
            .bind(if is_parent { None } else { Some(0i32) })
            .execute(&state.pool).await;
        }
    }

    let entries: Vec<Rl313Entry> = sqlx::query_as(
        "SELECT id, tahun, CAST(urutan AS DOUBLE) AS urutan, jenis_kode, jenis_nama,
                parent_kode, is_parent, jumlah,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl313_entry WHERE tahun=? ORDER BY urutan"
    ).bind(&tahun).fetch_all(&state.pool).await.map_err(db_err)?;

    // ── Khanza sanity: tindakan rehab via nama LIKE ──
    // Pattern stricter: NOT match EKSTRAKSI (gigi) — gunakan word-boundary
    let total_tindakan_rehab: i64 = sqlx::query_scalar(
        "SELECT
           (SELECT COUNT(*) FROM rawat_jl_dr rj
            LEFT JOIN jns_perawatan m ON m.kd_jenis_prw=rj.kd_jenis_prw
            WHERE rj.tgl_perawatan BETWEEN ? AND ?
              AND UPPER(m.nm_perawatan) NOT LIKE '%EKSTRAKSI%'
              AND (UPPER(m.nm_perawatan) LIKE '%FISIOTERAPI%'
                   OR UPPER(m.nm_perawatan) LIKE '%REHAB%' OR UPPER(m.nm_perawatan) LIKE '%SPIROMETR%'
                   OR UPPER(m.nm_perawatan) LIKE '%TRAKSI LUMBAL%' OR UPPER(m.nm_perawatan) LIKE '%TRAKSI CERVICAL%'
                   OR UPPER(m.nm_perawatan) LIKE '%TENS %' OR UPPER(m.nm_perawatan) LIKE '%TENS%'
                   OR UPPER(m.nm_perawatan) LIKE '%INFRARED%' OR UPPER(m.nm_perawatan) LIKE '%ULTRASOUND THERAPY%'
                   OR UPPER(m.nm_perawatan) LIKE 'EMG%' OR UPPER(m.nm_perawatan) LIKE '%ELEKTROMYOGRAF%'
                   OR UPPER(m.nm_perawatan) LIKE '%GAIT%' OR UPPER(m.nm_perawatan) LIKE '%TREADMILL%'
                   OR UPPER(m.nm_perawatan) LIKE '%PSIKOLOG%'
                   OR UPPER(m.nm_perawatan) LIKE '%TERAPI INHALASI%'
                   OR UPPER(m.nm_perawatan) LIKE '%TERAPI WICARA%'
                   OR UPPER(m.nm_perawatan) LIKE '%LATIHAN FISIK%'
                   OR UPPER(m.nm_perawatan) LIKE '%AKTINOTERAPI%'
                   OR UPPER(m.nm_perawatan) LIKE '%ELEKTROTERAPI%'
                   OR UPPER(m.nm_perawatan) LIKE '%HIDROTERAPI%'
                   OR UPPER(m.nm_perawatan) LIKE '%OKUPASITERAPI%'))
         + (SELECT COUNT(*) FROM rawat_jl_drpr rj
            LEFT JOIN jns_perawatan m ON m.kd_jenis_prw=rj.kd_jenis_prw
            WHERE rj.tgl_perawatan BETWEEN ? AND ?
              AND UPPER(m.nm_perawatan) NOT LIKE '%EKSTRAKSI%'
              AND (UPPER(m.nm_perawatan) LIKE '%FISIOTERAPI%'
                   OR UPPER(m.nm_perawatan) LIKE '%REHAB%' OR UPPER(m.nm_perawatan) LIKE '%SPIROMETR%'
                   OR UPPER(m.nm_perawatan) LIKE '%TRAKSI LUMBAL%' OR UPPER(m.nm_perawatan) LIKE '%TRAKSI CERVICAL%'
                   OR UPPER(m.nm_perawatan) LIKE '%TENS %' OR UPPER(m.nm_perawatan) LIKE '%TENS%'
                   OR UPPER(m.nm_perawatan) LIKE '%INFRARED%' OR UPPER(m.nm_perawatan) LIKE '%ULTRASOUND THERAPY%'
                   OR UPPER(m.nm_perawatan) LIKE 'EMG%' OR UPPER(m.nm_perawatan) LIKE '%ELEKTROMYOGRAF%'
                   OR UPPER(m.nm_perawatan) LIKE '%GAIT%' OR UPPER(m.nm_perawatan) LIKE '%TREADMILL%'
                   OR UPPER(m.nm_perawatan) LIKE '%PSIKOLOG%'
                   OR UPPER(m.nm_perawatan) LIKE '%TERAPI INHALASI%'
                   OR UPPER(m.nm_perawatan) LIKE '%TERAPI WICARA%'
                   OR UPPER(m.nm_perawatan) LIKE '%LATIHAN FISIK%'
                   OR UPPER(m.nm_perawatan) LIKE '%AKTINOTERAPI%'
                   OR UPPER(m.nm_perawatan) LIKE '%ELEKTROTERAPI%'
                   OR UPPER(m.nm_perawatan) LIKE '%HIDROTERAPI%'
                   OR UPPER(m.nm_perawatan) LIKE '%OKUPASITERAPI%'))"
    ).bind(&tahun_dari).bind(&tahun_sampai)
     .bind(&tahun_dari).bind(&tahun_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let top_tindakan: Vec<Rl313KhanzaTop> = sqlx::query_as(
        "SELECT nm_perawatan, CAST(SUM(jml) AS SIGNED) AS jumlah FROM (
           SELECT m.nm_perawatan AS nm_perawatan, COUNT(*) AS jml
             FROM rawat_jl_dr rj
             LEFT JOIN jns_perawatan m ON m.kd_jenis_prw=rj.kd_jenis_prw
             WHERE rj.tgl_perawatan BETWEEN ? AND ?
               AND UPPER(m.nm_perawatan) NOT LIKE '%EKSTRAKSI%'
               AND (UPPER(m.nm_perawatan) LIKE '%FISIOTERAPI%' OR UPPER(m.nm_perawatan) LIKE '%REHAB%'
                    OR UPPER(m.nm_perawatan) LIKE '%SPIROMETR%' OR UPPER(m.nm_perawatan) LIKE '%TRAKSI LUMBAL%'
                    OR UPPER(m.nm_perawatan) LIKE '%TRAKSI CERVICAL%' OR UPPER(m.nm_perawatan) LIKE '%TENS %'
                    OR UPPER(m.nm_perawatan) LIKE '%INFRARED%' OR UPPER(m.nm_perawatan) LIKE '%TREADMILL%'
                    OR UPPER(m.nm_perawatan) LIKE 'EMG%' OR UPPER(m.nm_perawatan) LIKE '%GAIT%'
                    OR UPPER(m.nm_perawatan) LIKE '%PSIKOLOG%' OR UPPER(m.nm_perawatan) LIKE '%TERAPI INHALASI%'
                    OR UPPER(m.nm_perawatan) LIKE '%TERAPI WICARA%' OR UPPER(m.nm_perawatan) LIKE '%LATIHAN FISIK%'
                    OR UPPER(m.nm_perawatan) LIKE '%AKTINOTERAPI%' OR UPPER(m.nm_perawatan) LIKE '%ELEKTROTERAPI%'
                    OR UPPER(m.nm_perawatan) LIKE '%HIDROTERAPI%' OR UPPER(m.nm_perawatan) LIKE '%OKUPASITERAPI%')
             GROUP BY m.nm_perawatan
           UNION ALL
           SELECT m.nm_perawatan AS nm_perawatan, COUNT(*) AS jml
             FROM rawat_jl_drpr rj
             LEFT JOIN jns_perawatan m ON m.kd_jenis_prw=rj.kd_jenis_prw
             WHERE rj.tgl_perawatan BETWEEN ? AND ?
               AND UPPER(m.nm_perawatan) NOT LIKE '%EKSTRAKSI%'
               AND (UPPER(m.nm_perawatan) LIKE '%FISIOTERAPI%' OR UPPER(m.nm_perawatan) LIKE '%REHAB%'
                    OR UPPER(m.nm_perawatan) LIKE '%SPIROMETR%' OR UPPER(m.nm_perawatan) LIKE '%TRAKSI LUMBAL%'
                    OR UPPER(m.nm_perawatan) LIKE '%TRAKSI CERVICAL%' OR UPPER(m.nm_perawatan) LIKE '%TENS %'
                    OR UPPER(m.nm_perawatan) LIKE '%INFRARED%' OR UPPER(m.nm_perawatan) LIKE '%TREADMILL%'
                    OR UPPER(m.nm_perawatan) LIKE 'EMG%' OR UPPER(m.nm_perawatan) LIKE '%GAIT%'
                    OR UPPER(m.nm_perawatan) LIKE '%PSIKOLOG%' OR UPPER(m.nm_perawatan) LIKE '%TERAPI INHALASI%'
                    OR UPPER(m.nm_perawatan) LIKE '%TERAPI WICARA%' OR UPPER(m.nm_perawatan) LIKE '%LATIHAN FISIK%'
                    OR UPPER(m.nm_perawatan) LIKE '%AKTINOTERAPI%' OR UPPER(m.nm_perawatan) LIKE '%ELEKTROTERAPI%'
                    OR UPPER(m.nm_perawatan) LIKE '%HIDROTERAPI%' OR UPPER(m.nm_perawatan) LIKE '%OKUPASITERAPI%')
             GROUP BY m.nm_perawatan
         ) c GROUP BY nm_perawatan ORDER BY jumlah DESC LIMIT 20"
    ).bind(&tahun_dari).bind(&tahun_sampai)
     .bind(&tahun_dari).bind(&tahun_sampai)
     .fetch_all(&state.pool).await.map_err(db_err)?;

    // Per-row sugesti via nm_perawatan pattern (combined rawat_jl_dr + drpr)
    // Patterns stricter dengan word boundary; exclude EKSTRAKSI yang mengandung "TRAKSI"
    let row_specs: Vec<(&str, &str, Vec<&str>, Vec<&str>)> = vec![
        ("1.1", "Gait Analyzer",                vec!["%GAIT%"],                                vec![]),
        ("1.2", "EMG (Elektromyograf)",         vec!["EMG%", "% EMG%", "%ELEKTROMYOGRAF%"],    vec![]),
        ("1.6", "Spirometri",                   vec!["%SPIROMETR%"],                           vec![]),
        ("1.8", "Treadmill",                    vec!["%TREADMILL%", "%TREAD MILL%"],           vec![]),
        ("2.1", "Latihan Fisik",                vec!["%LATIHAN FISIK%"],                       vec![]),
        ("2.2", "Aktinoterapi (Infrared)",      vec!["%INFRARED%", "%AKTINOTERAPI%"],          vec![]),
        ("2.3", "Elektroterapi (TENS)",         vec!["%TENS %", "%ELEKTROTERAPI%"],            vec![]),
        ("2.5", "Traksi Lumbal/Cervical",       vec!["%TRAKSI LUMBAL%", "%TRAKSI CERVICAL%"], vec!["%EKSTRAKSI%"]),
        ("2.6", "Fisioterapi Anak",             vec!["%FISIOTERAPI ANAK%"],                    vec![]),
        ("4.1", "Terapi Wicara/Fungsi Bicara",  vec!["%TERAPI WICARA%", "%FUNGSI BICARA%"],   vec![]),
        ("5.1", "Psikologi Anak",               vec!["%PSIKOLOG%ANAK%"],                       vec![]),
        ("5.2", "Psikologi Dewasa",             vec!["%PSIKOLOG%"],                            vec!["%ANAK%"]),
    ];
    let mut sugesti_per_row: Vec<Rl313KhanzaSugesti> = Vec::new();
    for (kode, sumber, includes, excludes) in &row_specs {
        let or_clause = includes.iter().map(|_| "UPPER(m.nm_perawatan) LIKE ?").collect::<Vec<_>>().join(" OR ");
        let mut where_clause = format!("({})", or_clause);
        for _ in excludes { where_clause.push_str(" AND UPPER(m.nm_perawatan) NOT LIKE ?"); }
        let sql = format!(
            "SELECT
              ((SELECT COUNT(*) FROM rawat_jl_dr rj
                LEFT JOIN jns_perawatan m ON m.kd_jenis_prw=rj.kd_jenis_prw
                WHERE rj.tgl_perawatan BETWEEN ? AND ? AND {})
             + (SELECT COUNT(*) FROM rawat_jl_drpr rj
                LEFT JOIN jns_perawatan m ON m.kd_jenis_prw=rj.kd_jenis_prw
                WHERE rj.tgl_perawatan BETWEEN ? AND ? AND {})) AS c",
            where_clause, where_clause);
        let mut qb = sqlx::query_scalar(&sql);
        qb = qb.bind(&tahun_dari).bind(&tahun_sampai);
        for p in includes { qb = qb.bind(*p); }
        for p in excludes { qb = qb.bind(*p); }
        qb = qb.bind(&tahun_dari).bind(&tahun_sampai);
        for p in includes { qb = qb.bind(*p); }
        for p in excludes { qb = qb.bind(*p); }
        let cnt: i64 = qb.fetch_one(&state.pool).await.unwrap_or(0);
        sugesti_per_row.push(Rl313KhanzaSugesti {
            jenis_kode: kode.to_string(), count: cnt, sumber: sumber.to_string(),
        });
    }

    Ok(Json(Rl313Resp {
        tahun,
        entries,
        khanza: Rl313Khanza { total_tindakan_rehab, sugesti_per_row, top_tindakan },
    }))
}

pub async fn update_rl313(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl313Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl313_entry SET jumlah=?, updated_by=? WHERE id=?"
    )
    .bind(body.jumlah).bind(&user.0.kode).bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl313_entry SET ... updated_by={} WHERE id={}",
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;
    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

pub async fn cetak_rl313(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl311Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl313(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    let mut tot: i32 = 0;
    for e in &resp.entries {
        if e.is_parent == 1 {
            tbody.push_str(&format!(
                "<tr class=\"kat\"><td class=\"no\">{}</td><td colspan=\"2\"><strong>{}</strong></td></tr>",
                esc(&e.jenis_kode), esc(&e.jenis_nama)
            ));
        } else {
            let v = resp.khanza.sugesti_per_row.iter().find(|s| s.jenis_kode == e.jenis_kode).map(|s| s.count as i32).unwrap_or(0);
            tot += v;
            tbody.push_str(&format!(
                "<tr><td class=\"no\">{}</td><td>{}</td><td class=\"n\">{}</td></tr>",
                esc(&e.jenis_kode), esc(&e.jenis_nama), v
            ));
        }
    }
    tbody.push_str(&format!(
        "<tr class=\"total\"><td class=\"no\">99</td><td><strong>TOTAL</strong></td><td class=\"n\"><strong>{}</strong></td></tr>",
        tot
    ));

    let mut top_html = String::new();
    for (i, t) in resp.khanza.top_tindakan.iter().take(15).enumerate() {
        top_html.push_str(&format!(
            "<tr><td>{}</td><td>{}</td><td class=\"n\">{}</td></tr>",
            i+1, esc(t.nm_perawatan.as_deref().unwrap_or("-")), t.jumlah
        ));
    }

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.13 Rehabilitasi Medik — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:14mm;font-size:9pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:12px}}
  table{{width:100%;border-collapse:collapse;font-size:8.5pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:3px 6px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;text-align:center}}
  td.no{{width:48px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.kat td{{background:#dbeafe;color:#1e40af}}
  tr.total td{{background:#bfdbfe;font-weight:bold}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:9pt}}
  .topjenis{{margin-top:14px;font-size:8.5pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:12mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.13 Rehabilitasi Medik (Tahunan)</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.13 — Rekapitulasi Pelayanan Rehabilitasi Medik</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>Tahun {tahun}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  🩺 <strong>Khanza tindakan rehab/terapi {tahun}</strong>: total = <strong>{tot_kh}</strong> · manual RL 3.13 total = <strong>{tot_manual}</strong>
</div>

<table>
  <thead><tr><th class="no">No</th><th>Jenis Tindakan</th><th>Jumlah</th></tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="topjenis">
  <strong>📊 Top 15 tindakan rehab/terapi Khanza {tahun}</strong>:
  <table>
    <thead><tr><th>#</th><th>Nama Tindakan</th><th>Jumlah</th></tr></thead>
    <tbody>{top}</tbody>
  </table>
</div>

<div class="footer">
  Sumber: <code>rawat_jl_dr + rawat_jl_drpr × jns_perawatan</code> filter via UPPER LIKE pattern
  (Fisioterapi/Terapi/Rehab/Spirometri/Traksi/TENS/Infrared/Treadmill/EMG/Gait/Psikolog).<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), tahun = esc(&resp.tahun),
        tot_kh = resp.khanza.total_tindakan_rehab,
        tot_manual = tot, tbody = tbody, top = top_html,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.14 — Rekapitulasi Pelayanan Khusus (Bulanan)
// Per JUKNIS SIRS 6.3 Bab IV N. 18 main + 5 sub (16.x) = 23 rows.
// Sumber Khanza: rawat_jl_dr + rawat_jl_drpr + rawat_inap_dr + rawat_inap_drpr.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl314Entry {
    pub id:          Option<i32>,
    pub bulan:       String,
    pub urutan:      Option<f64>,
    pub jenis_kode:  String,
    pub jenis_nama:  String,
    pub parent_kode: Option<String>,
    pub is_parent:   i8,
    pub jumlah:      Option<i32>,
    pub updated_at:  Option<String>,
    pub updated_by:  Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Rl314KhanzaSugesti {
    pub jenis_kode: String,
    pub count:      i64,
    pub sumber:     String,
}

#[derive(Debug, Serialize)]
pub struct Rl314Khanza {
    pub sugesti_per_row:      Vec<Rl314KhanzaSugesti>,
}

#[derive(Debug, Serialize)]
pub struct Rl314Resp {
    pub bulan:   String,
    pub entries: Vec<Rl314Entry>,
    pub khanza:  Rl314Khanza,
}

fn rl314_master() -> Vec<(f64, &'static str, &'static str, Option<&'static str>, bool)> {
    vec![
        (1.0,  "1",    "Elektro Kardiographi (EKG)",                   None, false),
        (2.0,  "2",    "Elektro Myographi (EMG)",                      None, false),
        (3.0,  "3",    "Echo Cardiographi (ECG)",                      None, false),
        (4.0,  "4",    "Endoskopi (semua bentuk)",                     None, false),
        (5.0,  "5",    "Hemodialisa",                                  None, false),
        (6.0,  "6",    "Densometri Tulang",                            None, false),
        (7.0,  "7",    "Pungsi",                                       None, false),
        (8.0,  "8",    "Spirometri",                                   None, false),
        (9.0,  "9",    "Tes Kulit/Alergi/Histamin",                    None, false),
        (10.0, "10",   "Topometri",                                    None, false),
        (11.0, "11",   "Akupunktur Medik",                             None, false),
        (12.0, "12",   "Akupunktur Tradisional",                       None, false),
        (13.0, "13",   "Akupressur",                                   None, false),
        (14.0, "14",   "Herbal/Jamu",                                  None, false),
        (15.0, "15",   "Pijat Baduta",                                 None, false),
        (16.0, "16",   "Kunjungan Rumah (Homecare)",                   None, true),
        (16.1, "16.1", "Kunjungan Rumah (Homecare) Non Lansia",        Some("16"), false),
        (16.2, "16.2", "Rehabilitasi Medis Lansia",                    Some("16"), false),
        (16.3, "16.3", "Pemeriksaan Medis Umum dan Spesialis Bagi Lansia", Some("16"), false),
        (16.4, "16.4", "Asuhan dan/atau Tindakan Keperawatan Bagi Lansia", Some("16"), false),
        (16.5, "16.5", "Kunjungan Rumah (Homecare) Lansia Lainnya",    Some("16"), false),
        (17.0, "17",   "Tindak lanjut lesi pra Kanker Leher Rahim",    None, false),
        (18.0, "18",   "Lain-Lain",                                    None, false),
    ]
}

pub async fn get_rl314(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl314Resp>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let bulan_dari = format!("{}-01", bulan);
    let (year_s, month_s) = (&bulan[..4], &bulan[5..7]);
    let year: i32 = year_s.parse().unwrap_or(2026);
    let month: u32 = month_s.parse().unwrap_or(1);
    let next_month_first = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let bulan_sampai = (next_month_first - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    let count_existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sirs_rl314_entry WHERE bulan=?"
    ).bind(&bulan).fetch_one(&state.pool).await.unwrap_or(0);
    if count_existing == 0 {
        for (urutan, kode, nama, parent, is_parent) in rl314_master() {
            let _ = sqlx::query(
                "INSERT INTO sirs_rl314_entry (bulan,urutan,jenis_kode,jenis_nama,parent_kode,is_parent,jumlah)
                 VALUES (?,?,?,?,?,?,?)"
            )
            .bind(&bulan).bind(urutan).bind(kode).bind(nama).bind(parent)
            .bind(if is_parent { 1i8 } else { 0i8 })
            .bind(if is_parent { None } else { Some(0i32) })
            .execute(&state.pool).await;
        }
    }

    let entries: Vec<Rl314Entry> = sqlx::query_as(
        "SELECT id, bulan, CAST(urutan AS DOUBLE) AS urutan, jenis_kode, jenis_nama,
                parent_kode, is_parent, jumlah,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl314_entry WHERE bulan=? ORDER BY urutan"
    ).bind(&bulan).fetch_all(&state.pool).await.map_err(db_err)?;

    // ── Khanza sugesti via pattern LIKE (combined 4 tabel: ralan dr+drpr + ranap dr+drpr) ──
    // Pattern strict untuk hindari false-positive
    let row_specs: Vec<(&str, &str, Vec<&str>, Vec<&str>)> = vec![
        ("1",  "EKG (% EKG% atau pemeriksaan EKG)", vec!["%EKG%", "%ELEKTROKARDIO%"],       vec![]),
        ("2",  "EMG (Elektromyograf)",              vec!["EMG%", "% EMG%", "%ELEKTROMYOGRAF%"], vec![]),
        ("3",  "Echo (USG jantung)",                vec!["%ECHOCARDIO%", "%ECG %", "%ECHO %", "%ECHO%JANTUNG%", "USG JANTUNG%"], vec![]),
        ("4",  "Endoskopi (semua bentuk)",          vec!["%ENDOSCOP%", "%ENDOSKOP%", "%NASOFARYNGO%"], vec![]),
        ("5",  "Hemodialisa",                       vec!["%HEMODIA%", "%CUCI DARAH%"],     vec![]),
        ("6",  "Densometri Tulang",                 vec!["%DENSITOMET%", "%BMD%", "%BONE DENSIT%"], vec![]),
        ("7",  "Pungsi (Lumbal/Pleural/Ascites)",   vec!["%PUNGSI %", "%PUNKSI%", "% LP %", "LUMBAR PUNGSI%", "%PLEURAL%", "%ASCITES%"], vec!["%EKSTRAKSI%"]),
        ("8",  "Spirometri",                        vec!["%SPIROMETR%"],                    vec![]),
        ("9",  "Tes Kulit/Alergi",                  vec!["%TES KULIT%", "%SKIN TEST%", "%ALERGI%"], vec![]),
        ("10", "Topometri",                         vec!["%TOPOMETR%"],                     vec![]),
        ("11", "Akupunktur Medik",                  vec!["%AKUPUNK%MEDIK%", "%ACUPUNCTURE%"], vec![]),
        ("12", "Akupunktur Tradisional",            vec!["%AKUPUNK%TRADIS%"],               vec![]),
        ("13", "Akupressur",                        vec!["%AKUPRES%"],                      vec![]),
        ("14", "Herbal/Jamu",                       vec!["%HERBAL%", "%JAMU%"],             vec![]),
        ("15", "Pijat Baduta",                      vec!["%PIJAT BADUTA%", "%BADUTA%"],     vec![]),
        ("16", "Homecare (Total)",                  vec!["%HOMECARE%", "%KUNJUNGAN RUMAH%"], vec![]),
        ("17", "IVA/Pap Smear/Lesi pra-kanker",     vec!["IVA%", "% IVA%", "%PAP SMEAR%", "%PAPSMEAR%", "%KRIOTERAPI%"], vec![]),
    ];

    let mut sugesti_per_row: Vec<Rl314KhanzaSugesti> = Vec::new();
    for (kode, sumber, includes, excludes) in &row_specs {
        let or_clause = includes.iter().map(|_| "UPPER(m.nm_perawatan) LIKE ?").collect::<Vec<_>>().join(" OR ");
        let mut where_clause = format!("({})", or_clause);
        for _ in excludes { where_clause.push_str(" AND UPPER(m.nm_perawatan) NOT LIKE ?"); }
        // Buang pasangan billing "Jasa Pelayanan ..." agar tiap kegiatan tak dobel.
        where_clause.push_str(" AND UPPER(m.nm_perawatan) NOT LIKE 'JASA PELAYANAN%'");
        // Combined query: 4 tables (rawat_jl_dr/drpr + rawat_inap_dr/drpr)
        let sql = format!(
            "SELECT
              ((SELECT COUNT(*) FROM rawat_jl_dr rj
                LEFT JOIN jns_perawatan m ON m.kd_jenis_prw=rj.kd_jenis_prw
                WHERE rj.tgl_perawatan BETWEEN ? AND ? AND {})
             + (SELECT COUNT(*) FROM rawat_jl_drpr rj
                LEFT JOIN jns_perawatan m ON m.kd_jenis_prw=rj.kd_jenis_prw
                WHERE rj.tgl_perawatan BETWEEN ? AND ? AND {})
             + (SELECT COUNT(*) FROM rawat_inap_dr rj
                LEFT JOIN jns_perawatan_inap m ON m.kd_jenis_prw=rj.kd_jenis_prw
                WHERE rj.tgl_perawatan BETWEEN ? AND ? AND {})
             + (SELECT COUNT(*) FROM rawat_inap_drpr rj
                LEFT JOIN jns_perawatan_inap m ON m.kd_jenis_prw=rj.kd_jenis_prw
                WHERE rj.tgl_perawatan BETWEEN ? AND ? AND {})) AS c",
            where_clause, where_clause, where_clause, where_clause);
        let mut qb = sqlx::query_scalar(&sql);
        for _ in 0..4 {
            qb = qb.bind(&bulan_dari).bind(&bulan_sampai);
            for p in includes { qb = qb.bind(*p); }
            for p in excludes { qb = qb.bind(*p); }
        }
        let cnt: i64 = qb.fetch_one(&state.pool).await.unwrap_or(0);
        sugesti_per_row.push(Rl314KhanzaSugesti {
            jenis_kode: kode.to_string(), count: cnt, sumber: sumber.to_string(),
        });
    }

    Ok(Json(Rl314Resp {
        bulan,
        entries,
        khanza: Rl314Khanza { sugesti_per_row },
    }))
}

pub async fn update_rl314(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl314Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl314_entry SET jumlah=?, updated_by=? WHERE id=?"
    )
    .bind(body.jumlah).bind(&user.0.kode).bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl314_entry SET ... updated_by={} WHERE id={}",
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;
    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

pub async fn cetak_rl314(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl314(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    let mut tot: i32 = 0;
    for e in &resp.entries {
        if e.is_parent == 1 {
            tbody.push_str(&format!(
                "<tr class=\"kat\"><td class=\"no\">{}</td><td colspan=\"2\"><strong>{}</strong></td></tr>",
                esc(&e.jenis_kode), esc(&e.jenis_nama)
            ));
        } else {
            let v = resp.khanza.sugesti_per_row.iter().find(|s| s.jenis_kode == e.jenis_kode).map(|s| s.count as i32).unwrap_or(0);
            tot += v;
            tbody.push_str(&format!(
                "<tr><td class=\"no\">{}</td><td>{}</td><td class=\"n\">{}</td></tr>",
                esc(&e.jenis_kode), esc(&e.jenis_nama), v
            ));
        }
    }
    tbody.push_str(&format!(
        "<tr class=\"total\"><td class=\"no\">99</td><td><strong>TOTAL</strong></td><td class=\"n\"><strong>{}</strong></td></tr>",
        tot
    ));

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.14 Pelayanan Khusus — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:14mm;font-size:9.5pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:12px}}
  table{{width:100%;border-collapse:collapse;font-size:9pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:4px 6px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;text-align:center}}
  td.no{{width:48px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.kat td{{background:#dbeafe;color:#1e40af}}
  tr.total td{{background:#bfdbfe;font-weight:bold}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:12mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.14 Pelayanan Khusus</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.14 — Rekapitulasi Pelayanan Khusus</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong> · Tanggal cetak: {now}
</div>

<table>
  <thead><tr><th class="no">No</th><th>Jenis Kegiatan</th><th>Jumlah</th></tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Sumber: <code>rawat_jl_dr + rawat_jl_drpr + rawat_inap_dr + rawat_inap_drpr × jns_perawatan</code>.<br/>
  Klasifikasi auto via nama LIKE pattern (EKG/EMG/Echo/Endoskopi/Hemodialisa/Densometri/Pungsi/Spirometri/Tes Kulit/Akupunktur/Herbal/Homecare/IVA).<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), bulan = esc(&resp.bulan),
        tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.15 — Rekapitulasi Pelayanan Kesehatan Jiwa (TAHUNAN)
// Per JUKNIS SIRS 6.3 Bab IV O. 8 jenis × (L, P). Total = L + P.
// Sumber Khanza: diagnosa_pasien F00-F99 × pasien.jk (sugesti row 1).
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl315Entry {
    pub id:          Option<i32>,
    pub tahun:       String,
    pub urutan:      i32,
    pub jenis_kode:  String,
    pub jenis_nama:  String,
    pub jml_l:       Option<i32>,
    pub jml_p:       Option<i32>,
    pub updated_at:  Option<String>,
    pub updated_by:  Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Rl315Khanza {
    pub dx_f_total:       i64,
    pub dx_f_l:           i64,
    pub dx_f_p:           i64,
    pub top_dx_f:         Vec<Rl315KhanzaDx>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl315KhanzaDx {
    pub kd_penyakit: Option<String>,
    pub nm_penyakit: Option<String>,
    pub jml:         i64,
    pub jml_l:       i64,
    pub jml_p:       i64,
}

#[derive(Debug, Serialize)]
pub struct Rl315Resp {
    pub tahun:   String,
    pub entries: Vec<Rl315Entry>,
    pub khanza:  Rl315Khanza,
}

fn rl315_master() -> Vec<(i32, &'static str, &'static str)> {
    vec![
        (1, "1", "Pemeriksaan Psikiatri"),
        (2, "2", "Penatalaksanaan Medikamentosa"),
        (3, "3", "Psikoterapi"),
        (4, "4", "Konseling"),
        (5, "5", "Elektro Medik"),
        (6, "6", "Terapi Perilaku"),
        (7, "7", "Rehabilitasi Medik Psikiatrik"),
        (8, "8", "Assessment"),
    ]
}

pub async fn get_rl315(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl311Query>,
) -> Result<Json<Rl315Resp>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.clone().filter(|s| s.len() == 4)
        .unwrap_or_else(|| chrono::Local::now().format("%Y").to_string());
    let tahun_dari = format!("{}-01-01", tahun);
    let tahun_sampai = format!("{}-12-31", tahun);

    let count_existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sirs_rl315_entry WHERE tahun=?"
    ).bind(&tahun).fetch_one(&state.pool).await.unwrap_or(0);
    if count_existing == 0 {
        for (urutan, kode, nama) in rl315_master() {
            let _ = sqlx::query(
                "INSERT INTO sirs_rl315_entry (tahun,urutan,jenis_kode,jenis_nama,jml_l,jml_p)
                 VALUES (?,?,?,?,0,0)"
            )
            .bind(&tahun).bind(urutan).bind(kode).bind(nama)
            .execute(&state.pool).await;
        }
    }

    let entries: Vec<Rl315Entry> = sqlx::query_as(
        "SELECT id, tahun, urutan, jenis_kode, jenis_nama, jml_l, jml_p,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl315_entry WHERE tahun=? ORDER BY urutan"
    ).bind(&tahun).fetch_all(&state.pool).await.map_err(db_err)?;

    // Khanza sanity: diagnosa F (mental disorders) × JK
    let (dx_f_total, dx_f_l, dx_f_p): (i64, i64, i64) = sqlx::query_as(
        "SELECT
           CAST(COUNT(DISTINCT dp.no_rawat) AS SIGNED) AS total,
           CAST(SUM(CASE WHEN p.jk='L' THEN 1 ELSE 0 END) AS SIGNED) AS jml_l,
           CAST(SUM(CASE WHEN p.jk='P' THEN 1 ELSE 0 END) AS SIGNED) AS jml_p
         FROM (
           SELECT DISTINCT dp.no_rawat
           FROM diagnosa_pasien dp
           JOIN reg_periksa r ON r.no_rawat=dp.no_rawat
           WHERE r.tgl_registrasi BETWEEN ? AND ? AND dp.kd_penyakit LIKE 'F%'
         ) dp
         JOIN reg_periksa r ON r.no_rawat=dp.no_rawat
         JOIN pasien p ON p.no_rkm_medis=r.no_rkm_medis"
    ).bind(&tahun_dari).bind(&tahun_sampai)
     .fetch_one(&state.pool).await.unwrap_or((0,0,0));

    let top_dx_f: Vec<Rl315KhanzaDx> = sqlx::query_as(
        "SELECT dp.kd_penyakit AS kd_penyakit, pk.nm_penyakit AS nm_penyakit,
                CAST(COUNT(DISTINCT dp.no_rawat) AS SIGNED) AS jml,
                CAST(SUM(CASE WHEN p.jk='L' THEN 1 ELSE 0 END) AS SIGNED) AS jml_l,
                CAST(SUM(CASE WHEN p.jk='P' THEN 1 ELSE 0 END) AS SIGNED) AS jml_p
         FROM diagnosa_pasien dp
         JOIN reg_periksa r ON r.no_rawat=dp.no_rawat
         JOIN pasien p ON p.no_rkm_medis=r.no_rkm_medis
         LEFT JOIN penyakit pk ON pk.kd_penyakit=dp.kd_penyakit
         WHERE r.tgl_registrasi BETWEEN ? AND ? AND dp.kd_penyakit LIKE 'F%'
         GROUP BY dp.kd_penyakit, pk.nm_penyakit
         ORDER BY jml DESC LIMIT 10"
    ).bind(&tahun_dari).bind(&tahun_sampai)
     .fetch_all(&state.pool).await.map_err(db_err)?;

    Ok(Json(Rl315Resp {
        tahun,
        entries,
        khanza: Rl315Khanza { dx_f_total, dx_f_l, dx_f_p, top_dx_f },
    }))
}

pub async fn update_rl315(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl315Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl315_entry SET jml_l=?, jml_p=?, updated_by=? WHERE id=?"
    )
    .bind(body.jml_l).bind(body.jml_p).bind(&user.0.kode).bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl315_entry SET ... updated_by={} WHERE id={}",
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;
    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

pub async fn cetak_rl315(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl311Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl315(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    let mut tot_l: i32 = 0; let mut tot_p: i32 = 0;
    for e in &resp.entries {
        // REALTIME: kunjungan dx jiwa (F) masuk baris "1" Pemeriksaan Psikiatri per JK;
        // jenis kegiatan lain (psikoterapi/konseling/dst) tak tercatat terstruktur → 0.
        let (l, p) = if e.jenis_kode == "1" {
            (resp.khanza.dx_f_l as i32, resp.khanza.dx_f_p as i32)
        } else { (0, 0) };
        let total = l + p;
        tot_l += l; tot_p += p;
        tbody.push_str(&format!(
            "<tr><td class=\"no\">{}</td><td>{}</td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td></tr>",
            esc(&e.jenis_kode), esc(&e.jenis_nama), l, p, total
        ));
    }
    tbody.push_str(&format!(
        "<tr class=\"total\"><td class=\"no\">99</td><td><strong>TOTAL</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td></tr>",
        tot_l, tot_p, tot_l + tot_p
    ));

    let mut topdx = String::new();
    for (i, t) in resp.khanza.top_dx_f.iter().enumerate() {
        topdx.push_str(&format!(
            "<tr><td>{}</td><td>{}</td><td>{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td></tr>",
            i+1, esc(t.kd_penyakit.as_deref().unwrap_or("-")),
            esc(t.nm_penyakit.as_deref().unwrap_or("-")),
            t.jml_l, t.jml_p, t.jml
        ));
    }

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.15 Kesehatan Jiwa — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:14mm;font-size:9.5pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:12px}}
  table{{width:100%;border-collapse:collapse;font-size:9pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:4px 6px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;text-align:center}}
  td.no{{width:48px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.total td{{background:#bfdbfe;font-weight:bold}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:9pt}}
  .topjenis{{margin-top:14px;font-size:9pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:12mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.15 Kesehatan Jiwa (Tahunan)</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.15 — Rekapitulasi Pelayanan Kesehatan Jiwa</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>Tahun {tahun}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  🧠 <strong>Khanza diagnosa F (mental disorders) {tahun}</strong>:
  total = <strong>{dxf}</strong> pasien ({dxfl} L · {dxfp} P).
  Sugesti untuk row 1 Pemeriksaan Psikiatri (input dapat di-overrride).
</div>

<table>
  <thead><tr>
    <th class="no">No</th><th>Jenis Kegiatan</th>
    <th>Laki-laki</th><th>Perempuan</th><th>Jumlah</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="topjenis">
  <strong>📊 Top diagnosa F (ICD-10 Mental & Behavioural Disorders) {tahun}</strong>:
  <table>
    <thead><tr><th>#</th><th>ICD</th><th>Nama Penyakit</th><th>L</th><th>P</th><th>Total</th></tr></thead>
    <tbody>{topdx}</tbody>
  </table>
</div>

<div class="footer">
  Sumber: <code>diagnosa_pasien × penyakit × pasien.jk</code>, filter kd_penyakit LIKE 'F%'.<br/>
  Klasifikasi jenis kegiatan (Pemeriksaan/Medikamentosa/Psikoterapi/Konseling/Elektro/Terapi Perilaku/Rehab/Assessment) input manual oleh petugas poli jiwa.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), tahun = esc(&resp.tahun),
        dxf = resp.khanza.dx_f_total, dxfl = resp.khanza.dx_f_l, dxfp = resp.khanza.dx_f_p,
        tbody = tbody, topdx = topdx,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.16 — Rekapitulasi Pelayanan Keluarga Berencana (TAHUNAN)
// Per JUKNIS SIRS 6.3 Bab IV P. 8 metode × 7 num field.
// Modul KB Khanza belum aktif; sanity tipis via dx Z30 + prosedur 66.x/63.x/69.7.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl316Entry {
    pub id:              Option<i32>,
    pub tahun:           String,
    pub urutan:          i32,
    pub jenis_kode:      String,
    pub jenis_nama:      String,
    pub pasca_persalinan: Option<i32>,
    pub pasca_keguguran:  Option<i32>,
    pub interval_kb:      Option<i32>,
    pub komplikasi:       Option<i32>,
    pub kegagalan:        Option<i32>,
    pub efek_samping:     Option<i32>,
    pub drop_out:         Option<i32>,
    pub updated_at:      Option<String>,
    pub updated_by:      Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl316AkseptorRow {
    pub metode:            String,
    pub pasca_persalinan:  i64,
    pub pasca_keguguran:   i64,
    pub interval_kb:       i64,
    pub komplikasi:        i64,
    pub kegagalan:         i64,
    pub efek_samping:      i64,
    pub drop_out:          i64,
}

#[derive(Debug, Serialize)]
pub struct Rl316Khanza {
    pub dx_z30_total:       i64,
    pub prosedur_tubektomi: i64,
    pub prosedur_vasektomi: i64,
    pub prosedur_iud:       i64,
    pub prosedur_implan:    i64,
    // ── Auto-agregat dari simrscb_kb_pelayanan ──
    pub akseptor_total:     i64,
    pub akseptor_per_metode: Vec<Rl316AkseptorRow>,
}

#[derive(Debug, Serialize)]
pub struct Rl316Resp {
    pub tahun:   String,
    pub entries: Vec<Rl316Entry>,
    pub khanza:  Rl316Khanza,
}

fn rl316_master() -> Vec<(i32, &'static str, &'static str)> {
    vec![
        (1, "1", "Tubektomi/MOW/Sterilisasi wanita"),
        (2, "2", "Vasektomi/MOP/Sterilisasi pria"),
        (3, "3", "Implan"),
        (4, "4", "Alat Kontrasepsi Dalam Rahim (AKDR) / IUD"),
        (5, "5", "Suntik"),
        (6, "6", "Pil"),
        (7, "7", "Kondom"),
        (8, "8", "MAL (Metode Amenore Laktasi)"),
    ]
}

pub async fn get_rl316(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl311Query>,
) -> Result<Json<Rl316Resp>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.clone().filter(|s| s.len() == 4)
        .unwrap_or_else(|| chrono::Local::now().format("%Y").to_string());
    let tahun_dari = format!("{}-01-01", tahun);
    let tahun_sampai = format!("{}-12-31", tahun);

    let count_existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sirs_rl316_entry WHERE tahun=?"
    ).bind(&tahun).fetch_one(&state.pool).await.unwrap_or(0);
    if count_existing == 0 {
        for (urutan, kode, nama) in rl316_master() {
            let _ = sqlx::query(
                "INSERT INTO sirs_rl316_entry
                  (tahun,urutan,jenis_kode,jenis_nama,
                   pasca_persalinan,pasca_keguguran,interval_kb,
                   komplikasi,kegagalan,efek_samping,drop_out)
                 VALUES (?,?,?,?, 0,0,0, 0,0,0,0)"
            )
            .bind(&tahun).bind(urutan).bind(kode).bind(nama)
            .execute(&state.pool).await;
        }
    }

    let entries: Vec<Rl316Entry> = sqlx::query_as(
        "SELECT id, tahun, urutan, jenis_kode, jenis_nama,
                pasca_persalinan, pasca_keguguran, interval_kb,
                komplikasi, kegagalan, efek_samping, drop_out,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl316_entry WHERE tahun=? ORDER BY urutan"
    ).bind(&tahun).fetch_all(&state.pool).await.map_err(db_err)?;

    // Khanza sanity (modul KB belum aktif, semua 0 di RS ini)
    let dx_z30_total: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT dp.no_rawat) FROM diagnosa_pasien dp
         JOIN reg_periksa r ON r.no_rawat=dp.no_rawat
         WHERE r.tgl_registrasi BETWEEN ? AND ? AND dp.kd_penyakit LIKE 'Z30%'"
    ).bind(&tahun_dari).bind(&tahun_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let prosedur_tubektomi: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT pp.no_rawat) FROM prosedur_pasien pp
         JOIN reg_periksa r ON r.no_rawat=pp.no_rawat
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND (pp.kode LIKE '66.2%' OR pp.kode LIKE '66.3%')"
    ).bind(&tahun_dari).bind(&tahun_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let prosedur_vasektomi: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT pp.no_rawat) FROM prosedur_pasien pp
         JOIN reg_periksa r ON r.no_rawat=pp.no_rawat
         WHERE r.tgl_registrasi BETWEEN ? AND ? AND pp.kode LIKE '63.7%'"
    ).bind(&tahun_dari).bind(&tahun_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let prosedur_iud: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT pp.no_rawat) FROM prosedur_pasien pp
         JOIN reg_periksa r ON r.no_rawat=pp.no_rawat
         WHERE r.tgl_registrasi BETWEEN ? AND ? AND pp.kode LIKE '69.7%'"
    ).bind(&tahun_dari).bind(&tahun_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    let prosedur_implan: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT pp.no_rawat) FROM prosedur_pasien pp
         JOIN reg_periksa r ON r.no_rawat=pp.no_rawat
         WHERE r.tgl_registrasi BETWEEN ? AND ? AND pp.kode LIKE '99.23%'"
    ).bind(&tahun_dari).bind(&tahun_sampai)
     .fetch_one(&state.pool).await.unwrap_or(0);

    // ── REALTIME per metode dari prosedur_pasien (ICD-9-CM), port Trimitra Rl316Controller ──
    // metode 1=Tubektomi/MOW(66.2/66.3) 2=Vasektomi/MOP(63.7) 3=Implan(99.23) 4=IUD(69.7).
    // Timing: Pasca Persalinan (PP) bila no_rawat sama ada prosedur persalinan (72/73/74)
    // atau dx O8x/Z39x; Pasca Keguguran (PK) bila dx abortus O03-O08; selain itu Interval (INT).
    // Metode 5-8 (Suntik/Pil/Kondom/MAL) tak tercatat sbg prosedur ICD-9 → 0.
    // Komplikasi/Kegagalan/Efek Samping/Drop Out tak terstruktur di Khanza → 0.
    let akseptor_per_metode: Vec<Rl316AkseptorRow> = sqlx::query_as(
        "SELECT metode,
                CAST(SUM(timing='PP')  AS SIGNED) AS pasca_persalinan,
                CAST(SUM(timing='PK')  AS SIGNED) AS pasca_keguguran,
                CAST(SUM(timing='INT') AS SIGNED) AS interval_kb,
                0 AS komplikasi, 0 AS kegagalan, 0 AS efek_samping, 0 AS drop_out
         FROM (
            SELECT DISTINCT pp.no_rawat AS no_rawat,
                CASE
                  WHEN pp.kode LIKE '66.2%' OR pp.kode LIKE '66.3%' THEN '1'
                  WHEN pp.kode LIKE '63.7%'  THEN '2'
                  WHEN pp.kode LIKE '99.23%' THEN '3'
                  WHEN pp.kode LIKE '69.7%'  THEN '4'
                END AS metode,
                CASE
                  WHEN EXISTS(SELECT 1 FROM prosedur_pasien x WHERE x.no_rawat=pp.no_rawat AND (x.kode LIKE '72%' OR x.kode LIKE '73%' OR x.kode LIKE '74%'))
                    OR EXISTS(SELECT 1 FROM diagnosa_pasien d WHERE d.no_rawat=pp.no_rawat AND (d.kd_penyakit LIKE 'O8%' OR d.kd_penyakit LIKE 'Z39%')) THEN 'PP'
                  WHEN EXISTS(SELECT 1 FROM diagnosa_pasien d WHERE d.no_rawat=pp.no_rawat AND (d.kd_penyakit LIKE 'O03%' OR d.kd_penyakit LIKE 'O04%' OR d.kd_penyakit LIKE 'O05%' OR d.kd_penyakit LIKE 'O06%' OR d.kd_penyakit LIKE 'O07%' OR d.kd_penyakit LIKE 'O08%')) THEN 'PK'
                  ELSE 'INT'
                END AS timing
            FROM prosedur_pasien pp
            JOIN reg_periksa r ON r.no_rawat=pp.no_rawat
            WHERE r.tgl_registrasi BETWEEN ? AND ?
              AND (pp.kode LIKE '66.2%' OR pp.kode LIKE '66.3%'
                OR pp.kode LIKE '63.7%' OR pp.kode LIKE '99.23%' OR pp.kode LIKE '69.7%')
         ) v
         WHERE metode IS NOT NULL
         GROUP BY metode"
    ).bind(&tahun_dari).bind(&tahun_sampai)
     .fetch_all(&state.pool).await.unwrap_or_default();
    let akseptor_total: i64 = akseptor_per_metode.iter()
        .map(|r| r.pasca_persalinan + r.pasca_keguguran + r.interval_kb).sum();

    Ok(Json(Rl316Resp {
        tahun,
        entries,
        khanza: Rl316Khanza {
            dx_z30_total, prosedur_tubektomi, prosedur_vasektomi,
            prosedur_iud, prosedur_implan,
            akseptor_total, akseptor_per_metode,
        },
    }))
}

pub async fn update_rl316(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl316Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl316_entry SET
           pasca_persalinan=?, pasca_keguguran=?, interval_kb=?,
           komplikasi=?, kegagalan=?, efek_samping=?, drop_out=?,
           updated_by=?
         WHERE id=?"
    )
    .bind(body.pasca_persalinan).bind(body.pasca_keguguran).bind(body.interval_kb)
    .bind(body.komplikasi).bind(body.kegagalan).bind(body.efek_samping).bind(body.drop_out)
    .bind(&user.0.kode).bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl316_entry SET ... updated_by={} WHERE id={}",
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;
    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

pub async fn cetak_rl316(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl311Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl316(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    let mut tot = [0i32; 7];
    for e in &resp.entries {
        // REALTIME: ambil per metode dari akseptor_per_metode (prosedur_pasien) via jenis_kode.
        let s = resp.khanza.akseptor_per_metode.iter().find(|a| a.metode == e.jenis_kode);
        let pp = s.map(|a| a.pasca_persalinan as i32).unwrap_or(0);
        let pk = s.map(|a| a.pasca_keguguran as i32).unwrap_or(0);
        let iv = s.map(|a| a.interval_kb as i32).unwrap_or(0);
        let total_pelayanan = pp + pk + iv;
        let kpl = s.map(|a| a.komplikasi as i32).unwrap_or(0);
        let kg = s.map(|a| a.kegagalan as i32).unwrap_or(0);
        let es = s.map(|a| a.efek_samping as i32).unwrap_or(0);
        let dop = s.map(|a| a.drop_out as i32).unwrap_or(0);
        tot[0] += pp; tot[1] += pk; tot[2] += iv;
        tot[3] += kpl; tot[4] += kg; tot[5] += es; tot[6] += dop;
        tbody.push_str(&format!(
            "<tr><td class=\"no\">{}</td><td>{}</td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td>\
             <td class=\"n\"><strong>{}</strong></td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td></tr>",
            esc(&e.jenis_kode), esc(&e.jenis_nama),
            pp, pk, iv, total_pelayanan, kpl, kg, es, dop
        ));
    }
    tbody.push_str(&format!(
        "<tr class=\"total\"><td class=\"no\">99</td><td><strong>TOTAL</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td></tr>",
        tot[0], tot[1], tot[2], tot[0]+tot[1]+tot[2],
        tot[3], tot[4], tot[5], tot[6]
    ));

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.16 KB — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:12mm;font-size:9pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:12px}}
  table{{width:100%;border-collapse:collapse;font-size:8.5pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:3px 5px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;text-align:center}}
  th.subgrp{{background:#3b82f6}}
  td.no{{width:42px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.total td{{background:#bfdbfe;font-weight:bold}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:9pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:10mm}}.no-print{{display:none}}@page{{size:landscape}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.16 KB (Tahunan)</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.16 — Rekapitulasi Pelayanan Keluarga Berencana</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>Tahun {tahun}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  💑 <strong>Khanza sanity {tahun}</strong>: dx Z30 = <strong>{z30}</strong> ·
  prosedur Tubektomi (66.2/66.3) = <strong>{tub}</strong> · Vasektomi (63.7) = <strong>{vas}</strong> ·
  IUD (69.7) = <strong>{iud}</strong> · Implan (99.23) = <strong>{imp}</strong>.<br/>
  📋 <strong>Auto-agregat dari modul Akseptor KB</strong> ({akseptor_total} akseptor terinput) — gunakan tombol "Terapkan Auto-Agregat" di halaman untuk mengisi sel-sel di bawah ini otomatis.
</div>

<table>
  <thead><tr>
    <th rowspan="2" class="no">No</th><th rowspan="2">Jenis Pelayanan KB</th>
    <th colspan="4" class="subgrp">Pelayanan KB</th>
    <th rowspan="2">Komplikasi</th><th rowspan="2">Kegagalan</th>
    <th rowspan="2">Efek Samping</th><th rowspan="2">Drop Out</th>
  </tr><tr>
    <th class="subgrp">Pasca Persalinan</th>
    <th class="subgrp">Pasca Keguguran</th>
    <th class="subgrp">Interval</th>
    <th class="subgrp">Total</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Total Pelayanan = Pasca Persalinan + Pasca Keguguran + Interval (per metode).
  Input manual oleh petugas poli Kebidanan/KB/KIA. Modul KB Khanza belum aktif di RS ini.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), tahun = esc(&resp.tahun),
        z30 = resp.khanza.dx_z30_total,
        tub = resp.khanza.prosedur_tubektomi, vas = resp.khanza.prosedur_vasektomi,
        iud = resp.khanza.prosedur_iud, imp = resp.khanza.prosedur_implan,
        akseptor_total = resp.khanza.akseptor_total,
        tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.17 — Farmasi RS Pengadaan Obat (TAHUNAN)
// Per JUKNIS SIRS 6.3 Bab IV Q. 4 golongan × 2 kolom (jumlah_item + jumlah_tersedia).
// Sumber Khanza: databarang × kategori_barang (Generik/Non Generik).
// Fornas/Non Fornas tidak ada di Khanza → MANUAL split oleh petugas farmasi.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl317Entry {
    pub id:             Option<i32>,
    pub tahun:          String,
    pub urutan:         i32,
    pub jenis_kode:     String,
    pub jenis_nama:     String,
    pub jumlah_item:    Option<i32>,
    pub jumlah_tersedia:Option<i32>,
    pub updated_at:     Option<String>,
    pub updated_by:     Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Rl317Khanza {
    pub generik_total:      i64,
    pub non_generik_total:  i64,
    pub tanpa_kategori:     i64,
    pub total_obat_aktif:   i64,
}

#[derive(Debug, Serialize)]
pub struct Rl317Resp {
    pub tahun:   String,
    pub entries: Vec<Rl317Entry>,
    pub khanza:  Rl317Khanza,
}

fn rl317_master() -> Vec<(i32, &'static str, &'static str)> {
    vec![
        (1, "1", "Obat Generik Formularium Nasional"),
        (2, "2", "Obat Generik Non Formularium Nasional"),
        (3, "3", "Obat Non Generik Formularium Nasional"),
        (4, "4", "Obat Non Generik Non Formularium Nasional"),
    ]
}

pub async fn get_rl317(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl311Query>,
) -> Result<Json<Rl317Resp>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.clone().filter(|s| s.len() == 4)
        .unwrap_or_else(|| chrono::Local::now().format("%Y").to_string());

    let count_existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sirs_rl317_entry WHERE tahun=?"
    ).bind(&tahun).fetch_one(&state.pool).await.unwrap_or(0);
    if count_existing == 0 {
        for (urutan, kode, nama) in rl317_master() {
            let _ = sqlx::query(
                "INSERT INTO sirs_rl317_entry (tahun,urutan,jenis_kode,jenis_nama,jumlah_item,jumlah_tersedia)
                 VALUES (?,?,?,?,0,0)"
            )
            .bind(&tahun).bind(urutan).bind(kode).bind(nama)
            .execute(&state.pool).await;
        }
    }

    let mut entries: Vec<Rl317Entry> = sqlx::query_as(
        "SELECT id, tahun, urutan, jenis_kode, jenis_nama, jumlah_item, jumlah_tersedia,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl317_entry WHERE tahun=? ORDER BY urutan"
    ).bind(&tahun).fetch_all(&state.pool).await.map_err(db_err)?;

    // Khanza sanity: count obat aktif (status='1') × kategori, exclude Alkes/BMHP/Suplemen/Jamu/Herbal
    let generik_total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM databarang db
         LEFT JOIN golongan_barang g ON g.kode=db.kode_golongan
         WHERE db.status='1' AND db.kode_kategori='K01'
           AND (g.nama IS NULL OR g.nama NOT IN ('ALAT KESEHATAN','BMHP','SUPLEMEN MAKANAN','JAMU','HERBAL'))"
    ).fetch_one(&state.pool).await.unwrap_or(0);

    let non_generik_total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM databarang db
         LEFT JOIN golongan_barang g ON g.kode=db.kode_golongan
         WHERE db.status='1' AND db.kode_kategori='K02'
           AND (g.nama IS NULL OR g.nama NOT IN ('ALAT KESEHATAN','BMHP','SUPLEMEN MAKANAN','JAMU','HERBAL'))"
    ).fetch_one(&state.pool).await.unwrap_or(0);

    let tanpa_kategori: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM databarang db
         LEFT JOIN golongan_barang g ON g.kode=db.kode_golongan
         WHERE db.status='1' AND (db.kode_kategori IS NULL OR db.kode_kategori NOT IN ('K01','K02'))
           AND (g.nama IS NULL OR g.nama NOT IN ('ALAT KESEHATAN','BMHP','SUPLEMEN MAKANAN','JAMU','HERBAL'))"
    ).fetch_one(&state.pool).await.unwrap_or(0);

    let total_obat_aktif = generik_total + non_generik_total + tanpa_kategori;

    // ── REALTIME: timpa entries dari databarang aktif ──
    // Khanza tak menandai Formularium Nasional pada satu kolom → split Fornas/Non-Fornas
    // tak dapat diturunkan. Best-effort: generik & non-generik ditaruh pada baris Fornas
    // (1 & 3); obat tanpa kategori generik → baris 4 (Non Generik Non Fornas, catch-all).
    // jumlah_item = jumlah_tersedia (Khanza tak simpan snapshot stok item).
    for e in entries.iter_mut() {
        let v = match e.jenis_kode.as_str() {
            "1" => generik_total as i32,
            "3" => non_generik_total as i32,
            "4" => tanpa_kategori as i32,
            _ => 0,
        };
        e.jumlah_item = Some(v);
        e.jumlah_tersedia = Some(v);
    }

    Ok(Json(Rl317Resp {
        tahun,
        entries,
        khanza: Rl317Khanza { generik_total, non_generik_total, tanpa_kategori, total_obat_aktif },
    }))
}

pub async fn update_rl317(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl317Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl317_entry SET jumlah_item=?, jumlah_tersedia=?, updated_by=? WHERE id=?"
    )
    .bind(body.jumlah_item).bind(body.jumlah_tersedia).bind(&user.0.kode).bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl317_entry SET ... updated_by={} WHERE id={}",
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;
    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

pub async fn cetak_rl317(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl311Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl317(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    let mut tot_item: i32 = 0; let mut tot_tersedia: i32 = 0;
    for e in &resp.entries {
        let ji = e.jumlah_item.unwrap_or(0);
        let jt = e.jumlah_tersedia.unwrap_or(0);
        tot_item += ji; tot_tersedia += jt;
        tbody.push_str(&format!(
            "<tr><td class=\"no\">{}</td><td>{}</td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td></tr>",
            esc(&e.jenis_kode), esc(&e.jenis_nama), ji, jt
        ));
    }
    tbody.push_str(&format!(
        "<tr class=\"total\"><td class=\"no\">99</td><td><strong>Total</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td></tr>",
        tot_item, tot_tersedia
    ));

    let kh = &resp.khanza;
    let consistency = if tot_item == 0 {
        "<em>belum diisi</em>".to_string()
    } else if (kh.generik_total + kh.non_generik_total) > 0 {
        let manual_generik_check = (tot_item - kh.generik_total as i32 - kh.non_generik_total as i32).abs();
        if manual_generik_check < 50 {
            "<span style=\"color:#16a34a\">✓ Konsisten dengan Khanza ±50</span>".to_string()
        } else {
            format!("<span style=\"color:#dc2626\">⚠️ Selisih {} dengan total Khanza ({}+{}={})</span>",
                manual_generik_check, kh.generik_total, kh.non_generik_total,
                kh.generik_total + kh.non_generik_total)
        }
    } else { "—".to_string() };

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.17 Farmasi Pengadaan Obat — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:14mm;font-size:9.5pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:12px}}
  table{{width:100%;border-collapse:collapse;font-size:9.5pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:6px 8px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;text-align:center}}
  td.no{{width:48px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.total td{{background:#bfdbfe;font-weight:bold}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:9pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:12mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.17 Farmasi Pengadaan Obat (Tahunan)</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.17 — Farmasi RS - Pengadaan Obat</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>Tahun {tahun}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  💊 <strong>Khanza databarang aktif (excl. Alkes/BMHP/Suplemen/Jamu/Herbal)</strong>:
  Generik = <strong>{gen}</strong> · Non Generik = <strong>{ngen}</strong> · Tanpa kategori = <strong>{nok}</strong>
  · <strong>Total obat aktif = {tot_kh}</strong>.<br/>
  Manual RL 3.17 total Jumlah Item = <strong>{tot_item}</strong>. {consistency}
</div>

<table>
  <thead><tr>
    <th class="no">No</th><th>Golongan Obat</th>
    <th>Jumlah Item Obat</th><th>Jumlah Item Obat<br/>Tersedia di RS</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Fornas vs Non Fornas tidak tercatat di databarang Khanza — input manual oleh petugas farmasi
  sesuai daftar Formularium Nasional Kemenkes RI yang berlaku.<br/>
  Generik/Non Generik di-derive dari <code>databarang.kode_kategori</code> (K01/K02).<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), tahun = esc(&resp.tahun),
        gen = kh.generik_total, ngen = kh.non_generik_total, nok = kh.tanpa_kategori,
        tot_kh = kh.total_obat_aktif, tot_item = tot_item, consistency = consistency,
        tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.18 — Farmasi RS Resep (TAHUNAN)
// Per JUKNIS SIRS 6.3 Bab IV R. 4 golongan × 3 lokasi (Ralan/IGD/Ranap).
// Sumber Khanza: resep_obat × resep_dokter × databarang × reg_periksa.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl318Entry {
    pub id:          Option<i32>,
    pub tahun:       String,
    pub urutan:      i32,
    pub jenis_kode:  String,
    pub jenis_nama:  String,
    pub rawat_jalan: Option<i32>,
    pub igd:         Option<i32>,
    pub rawat_inap:  Option<i32>,
    pub updated_at:  Option<String>,
    pub updated_by:  Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl318KhanzaRow {
    pub lokasi:    String,    // 'Ralan' | 'IGD' | 'Ranap'
    pub kategori:  Option<String>,  // 'GENERIK' | 'NON GENERIK' | NULL
    pub jml:       i64,
}

#[derive(Debug, Serialize)]
pub struct Rl318Khanza {
    pub total_resep_items:  i64,
    pub per_lokasi_kategori: Vec<Rl318KhanzaRow>,
}

#[derive(Debug, Serialize)]
pub struct Rl318Resp {
    pub tahun:   String,
    pub entries: Vec<Rl318Entry>,
    pub khanza:  Rl318Khanza,
}

fn rl318_master() -> Vec<(i32, &'static str, &'static str)> {
    vec![
        (1, "1", "Obat Generik Formularium Nasional"),
        (2, "2", "Obat Generik Non Formularium Nasional"),
        (3, "3", "Obat Non Generik Formularium Nasional"),
        (4, "4", "Obat Non Generik Non Formularium Nasional"),
    ]
}

pub async fn get_rl318(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl311Query>,
) -> Result<Json<Rl318Resp>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.clone().filter(|s| s.len() == 4)
        .unwrap_or_else(|| chrono::Local::now().format("%Y").to_string());
    let tahun_dari = format!("{}-01-01", tahun);
    let tahun_sampai = format!("{}-12-31", tahun);

    let count_existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sirs_rl318_entry WHERE tahun=?"
    ).bind(&tahun).fetch_one(&state.pool).await.unwrap_or(0);
    if count_existing == 0 {
        for (urutan, kode, nama) in rl318_master() {
            let _ = sqlx::query(
                "INSERT INTO sirs_rl318_entry (tahun,urutan,jenis_kode,jenis_nama,rawat_jalan,igd,rawat_inap)
                 VALUES (?,?,?,?,0,0,0)"
            )
            .bind(&tahun).bind(urutan).bind(kode).bind(nama)
            .execute(&state.pool).await;
        }
    }

    let mut entries: Vec<Rl318Entry> = sqlx::query_as(
        "SELECT id, tahun, urutan, jenis_kode, jenis_nama,
                rawat_jalan, igd, rawat_inap,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl318_entry WHERE tahun=? ORDER BY urutan"
    ).bind(&tahun).fetch_all(&state.pool).await.map_err(db_err)?;

    // Khanza sanity per (lokasi × kategori)
    let per_lokasi_kategori: Vec<Rl318KhanzaRow> = sqlx::query_as(
        "SELECT
           CASE WHEN ro.status='ranap' THEN 'Ranap'
                WHEN rp.kd_poli IN ('IGD','IGDK') THEN 'IGD'
                ELSE 'Ralan' END AS lokasi,
           kb.nama AS kategori,
           CAST(COUNT(*) AS SIGNED) AS jml
         FROM resep_obat ro
         JOIN resep_dokter rd ON rd.no_resep=ro.no_resep
         JOIN databarang db ON db.kode_brng=rd.kode_brng
         LEFT JOIN kategori_barang kb ON kb.kode=db.kode_kategori
         LEFT JOIN reg_periksa rp ON rp.no_rawat=ro.no_rawat
         WHERE ro.tgl_perawatan BETWEEN ? AND ?
         GROUP BY lokasi, kategori
         ORDER BY lokasi, kategori"
    )
    .bind(&tahun_dari).bind(&tahun_sampai)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    let total_resep_items: i64 = per_lokasi_kategori.iter().map(|r| r.jml).sum();

    // ── REALTIME: timpa entries dari resep per (lokasi × kategori) ──
    // Fornas tak tercatat Khanza → Generik masuk baris 1 (Generik Fornas), Non Generik
    // baris 3 (Non Generik Fornas), lainnya/tanpa kategori baris 4 (Non Generik Non Fornas).
    // Kolom: rawat_jalan (Ralan), igd (IGD), rawat_inap (Ranap).
    let mut acc: std::collections::HashMap<&str, [i32; 3]> = std::collections::HashMap::new();
    for r in &per_lokasi_kategori {
        let kat = r.kategori.as_deref().unwrap_or("").to_uppercase();
        let kode = if kat == "GENERIK" { "1" } else if kat == "NON GENERIK" { "3" } else { "4" };
        let col = match r.lokasi.as_str() { "Ralan" => 0, "IGD" => 1, _ => 2 };
        acc.entry(kode).or_insert([0; 3])[col] += r.jml as i32;
    }
    for e in entries.iter_mut() {
        let c = acc.get(e.jenis_kode.as_str()).copied().unwrap_or([0; 3]);
        e.rawat_jalan = Some(c[0]); e.igd = Some(c[1]); e.rawat_inap = Some(c[2]);
    }

    Ok(Json(Rl318Resp {
        tahun,
        entries,
        khanza: Rl318Khanza { total_resep_items, per_lokasi_kategori },
    }))
}

pub async fn update_rl318(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl318Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl318_entry SET rawat_jalan=?, igd=?, rawat_inap=?, updated_by=? WHERE id=?"
    )
    .bind(body.rawat_jalan).bind(body.igd).bind(body.rawat_inap)
    .bind(&user.0.kode).bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl318_entry SET ... updated_by={} WHERE id={}",
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;
    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

pub async fn cetak_rl318(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl311Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl318(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    let mut tot = [0i32; 3];
    for e in &resp.entries {
        let rj = e.rawat_jalan.unwrap_or(0);
        let ig = e.igd.unwrap_or(0);
        let ri = e.rawat_inap.unwrap_or(0);
        tot[0] += rj; tot[1] += ig; tot[2] += ri;
        tbody.push_str(&format!(
            "<tr><td class=\"no\">{}</td><td>{}</td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td></tr>",
            esc(&e.jenis_kode), esc(&e.jenis_nama), rj, ig, ri
        ));
    }
    tbody.push_str(&format!(
        "<tr class=\"total\"><td class=\"no\">99</td><td><strong>Total</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td></tr>",
        tot[0], tot[1], tot[2]
    ));

    let kh = &resp.khanza;
    let mut sanity = String::new();
    let pivot = |lok: &str, kat: &str| -> i64 {
        kh.per_lokasi_kategori.iter()
            .find(|r| r.lokasi == lok && r.kategori.as_deref() == Some(kat))
            .map(|r| r.jml).unwrap_or(0)
    };
    for (lok, label) in [("Ralan","Rawat Jalan"), ("IGD","IGD"), ("Ranap","Rawat Inap")] {
        sanity.push_str(&format!(
            "<strong>{}</strong>: Generik={} · Non Generik={}<br/>",
            label, pivot(lok, "GENERIK"), pivot(lok, "NON GENERIK")
        ));
    }

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.18 Farmasi Resep — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:14mm;font-size:9.5pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:12px}}
  table{{width:100%;border-collapse:collapse;font-size:9.5pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:5px 8px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;text-align:center}}
  td.no{{width:48px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.total td{{background:#bfdbfe;font-weight:bold}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:9pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:12mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.18 Farmasi Resep (Tahunan)</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.18 — Farmasi RS - Resep</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>Tahun {tahun}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  💊 <strong>Khanza R/ items {tahun}</strong>: total <strong>{tot_kh}</strong>.<br/>
  {sanity}
</div>

<table>
  <thead><tr>
    <th class="no">No</th><th>Golongan Obat</th>
    <th>Rawat Jalan</th><th>IGD</th><th>Rawat Inap</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Sumber: <code>resep_obat × resep_dokter × databarang × kategori_barang × reg_periksa</code>.<br/>
  Lokasi: <strong>Ranap</strong> = resep_obat.status='ranap'; <strong>IGD</strong> = status='ralan' AND kd_poli IN (IGD,IGDK);
  <strong>Ralan</strong> = sisanya.<br/>
  Fornas vs Non Fornas tidak tercatat di Khanza — input manual oleh petugas farmasi
  sesuai daftar Formularium Nasional Kemenkes.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), tahun = esc(&resp.tahun),
        tot_kh = kh.total_resep_items, sanity = sanity, tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 3.19 — Rekapitulasi Cara Bayar (TAHUNAN)
// Per JUKNIS SIRS 6.3 Bab IV S. 11 baris (9 leaf + 2 parent).
// Sumber Khanza: reg_periksa × penjab (mapping kd_pj → JUKNIS),
// kamar_inap (pasien ranap keluar + lama dirawat),
// periksa_lab/radiologi (subkolom ralan).
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rl319Entry {
    pub id:           Option<i32>,
    pub tahun:        String,
    pub urutan:       Option<f64>,
    pub jenis_kode:   String,
    pub jenis_nama:   String,
    pub parent_kode:  Option<String>,
    pub is_parent:    i8,
    pub pasien_keluar:Option<i32>,
    pub lama_dirawat: Option<i32>,
    pub ralan_lab:    Option<i32>,
    pub ralan_rad:    Option<i32>,
    pub ralan_lain:   Option<i32>,
    pub updated_at:   Option<String>,
    pub updated_by:   Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Rl319KhanzaSugesti {
    pub jenis_kode:   String,
    pub pasien_keluar:i64,
    pub lama_dirawat: i64,
    pub ralan_lab:    i64,
    pub ralan_rad:    i64,
    pub ralan_lain:   i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl319KhanzaRaw {
    pub kd_pj:        Option<String>,
    pub png_jawab:    Option<String>,
    pub pasien_keluar:i64,
    pub lama_dirawat: i64,
    pub ralan_lab:    i64,
    pub ralan_rad:    i64,
    pub ralan_total:  i64,
}

#[derive(Debug, Serialize)]
pub struct Rl319Khanza {
    pub raw_per_kd_pj:   Vec<Rl319KhanzaRaw>,
    pub sugesti_per_row: Vec<Rl319KhanzaSugesti>,
}

#[derive(Debug, Serialize)]
pub struct Rl319Resp {
    pub tahun:   String,
    pub entries: Vec<Rl319Entry>,
    pub khanza:  Rl319Khanza,
}

fn rl319_master() -> Vec<(f64, &'static str, &'static str, Option<&'static str>, bool)> {
    vec![
        (1.0,  "1",   "Membayar Sendiri",                                None,      false),
        (2.0,  "2",   "Asuransi",                                        None,      true),
        (2.1,  "2.1", "Asuransi JKN (BPJS Kesehatan)",                   Some("2"), false),
        (2.2,  "2.2", "Asuransi Pemerintah Daerah (Jamkesda)",           Some("2"), false),
        (2.3,  "2.3", "Asuransi Pemerintah Lainnya",                     Some("2"), false),
        (2.4,  "2.4", "Asuransi Swasta",                                 Some("2"), false),
        (3.0,  "3",   "Keringanan (Cost Sharing)",                       None,      false),
        (4.0,  "4",   "Gratis",                                          None,      true),
        (4.1,  "4.1", "Kartu Sehat",                                     Some("4"), false),
        (4.2,  "4.2", "Keterangan Tidak Mampu",                          Some("4"), false),
        (4.3,  "4.3", "Lain-Lain",                                       Some("4"), false),
    ]
}

// Mapping kd_pj Khanza → kode JUKNIS RL 3.19
fn rl319_map_kd_pj(kd_pj: &str, png_jawab: &str) -> Option<&'static str> {
    let pj = png_jawab.to_uppercase();
    match kd_pj {
        "A01"               => Some("1"),     // UMUM → Membayar Sendiri
        "A02" | "BPJ"       => Some("2.1"),   // BPJS → JKN ('A02' kode lama, 'BPJ' setelah migrasi)
        "C03"               => Some("2.2"),   // JAMKESDA
        "C06"               => Some("4.1"),   // KARTU SEHAT
        "FRE"               => Some("4.3"),   // GRATIS lain
        "D01" | "D02"       => Some("3"),     // KARYAWAN RSUD → Keringanan
        _ => {
            // Fallback by name
            if pj.contains("JASA RAHARJA") || pj.contains("ASABRI") || pj.contains("POLISI") || pj.contains("POLDA") || pj.contains("KEPOLISIAN") || pj.contains("TNI") || pj.contains("KETENAGAKERJAAN") {
                Some("2.3")
            } else if pj.contains("BPJS") || pj.contains("KIS") || pj.contains("JKN") {
                Some("2.1")
            } else if pj.contains("JAMKESDA") || pj.contains("PEMDA") {
                Some("2.2")
            } else if pj.contains("UMUM") || pj.contains("TUNAI") || pj.contains("MEMBAYAR") {
                Some("1")
            } else if pj.contains("GRATIS") || pj.contains("KARTU SEHAT") {
                Some("4.1")
            } else if pj.contains("SKTM") || pj.contains("TIDAK MAMPU") {
                Some("4.2")
            } else if pj.contains("KARYAWAN") || pj.contains("PEGAWAI") {
                Some("3")
            } else if pj == "-" || pj.is_empty() {
                None
            } else {
                // Default asuransi non-pemerintah → swasta
                Some("2.4")
            }
        }
    }
}

pub async fn get_rl319(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl311Query>,
) -> Result<Json<Rl319Resp>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.clone().filter(|s| s.len() == 4)
        .unwrap_or_else(|| chrono::Local::now().format("%Y").to_string());
    let tahun_dari = format!("{}-01-01", tahun);
    let tahun_sampai = format!("{}-12-31", tahun);

    let count_existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sirs_rl319_entry WHERE tahun=?"
    ).bind(&tahun).fetch_one(&state.pool).await.unwrap_or(0);
    if count_existing == 0 {
        for (urutan, kode, nama, parent, is_parent) in rl319_master() {
            let _ = sqlx::query(
                "INSERT INTO sirs_rl319_entry
                  (tahun,urutan,jenis_kode,jenis_nama,parent_kode,is_parent,
                   pasien_keluar,lama_dirawat,ralan_lab,ralan_rad,ralan_lain)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)"
            )
            .bind(&tahun).bind(urutan).bind(kode).bind(nama).bind(parent)
            .bind(if is_parent { 1i8 } else { 0i8 })
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0i32) })
            .bind(if is_parent { None } else { Some(0i32) })
            .execute(&state.pool).await;
        }
    }

    let entries: Vec<Rl319Entry> = sqlx::query_as(
        "SELECT id, tahun, CAST(urutan AS DOUBLE) AS urutan, jenis_kode, jenis_nama,
                parent_kode, is_parent,
                pasien_keluar, lama_dirawat, ralan_lab, ralan_rad, ralan_lain,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM sirs_rl319_entry WHERE tahun=? ORDER BY urutan"
    ).bind(&tahun).fetch_all(&state.pool).await.map_err(db_err)?;

    // ── Khanza raw breakdown per kd_pj ──
    let raw_ranap: Vec<(Option<String>, Option<String>, i64, i64)> = sqlx::query_as(
        "SELECT p.kd_pj, p.png_jawab,
                CAST(COUNT(*) AS SIGNED) AS keluar,
                CAST(SUM(GREATEST(DATEDIFF(IFNULL(ki.tgl_keluar,CURDATE()), ki.tgl_masuk), 0)) AS SIGNED) AS lama
         FROM kamar_inap ki
         JOIN reg_periksa r ON r.no_rawat=ki.no_rawat
         LEFT JOIN penjab p ON p.kd_pj=r.kd_pj
         WHERE ki.tgl_keluar BETWEEN ? AND ? AND ki.stts_pulang!=''
         GROUP BY p.kd_pj, p.png_jawab"
    )
    .bind(&tahun_dari).bind(&tahun_sampai)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    let raw_ralan: Vec<(Option<String>, Option<String>, i64, i64, i64)> = sqlx::query_as(
        "SELECT p.kd_pj, p.png_jawab,
                CAST(COUNT(DISTINCT CASE WHEN pl.no_rawat IS NOT NULL THEN r.no_rawat END) AS SIGNED) AS lab,
                CAST(COUNT(DISTINCT CASE WHEN pr.no_rawat IS NOT NULL THEN r.no_rawat END) AS SIGNED) AS rad,
                CAST(COUNT(DISTINCT r.no_rawat) AS SIGNED) AS total
         FROM reg_periksa r
         LEFT JOIN penjab p ON p.kd_pj=r.kd_pj
         LEFT JOIN periksa_lab pl ON pl.no_rawat=r.no_rawat AND pl.status='Ralan'
         LEFT JOIN periksa_radiologi pr ON pr.no_rawat=r.no_rawat AND pr.status='Ralan'
         WHERE r.tgl_registrasi BETWEEN ? AND ? AND r.status_lanjut='Ralan'
         GROUP BY p.kd_pj, p.png_jawab"
    )
    .bind(&tahun_dari).bind(&tahun_sampai)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    // Merge raw_ranap + raw_ralan by kd_pj
    use std::collections::BTreeMap;
    let mut by_kd: BTreeMap<String, Rl319KhanzaRaw> = BTreeMap::new();
    for (kd, pj, keluar, lama) in raw_ranap {
        let key = kd.clone().unwrap_or("?".to_string());
        let e = by_kd.entry(key).or_insert(Rl319KhanzaRaw {
            kd_pj: kd, png_jawab: pj, pasien_keluar: 0, lama_dirawat: 0,
            ralan_lab: 0, ralan_rad: 0, ralan_total: 0,
        });
        e.pasien_keluar = keluar;
        e.lama_dirawat = lama;
    }
    for (kd, pj, lab, rad, total) in raw_ralan {
        let key = kd.clone().unwrap_or("?".to_string());
        let e = by_kd.entry(key).or_insert(Rl319KhanzaRaw {
            kd_pj: kd.clone(), png_jawab: pj.clone(),
            pasien_keluar: 0, lama_dirawat: 0,
            ralan_lab: 0, ralan_rad: 0, ralan_total: 0,
        });
        if e.png_jawab.is_none() { e.png_jawab = pj; }
        e.ralan_lab = lab;
        e.ralan_rad = rad;
        e.ralan_total = total;
    }

    // Aggregate per JUKNIS row via mapping
    let mut agg: BTreeMap<String, Rl319KhanzaSugesti> = BTreeMap::new();
    for (_kd_key, raw) in &by_kd {
        let kd = raw.kd_pj.as_deref().unwrap_or("?");
        let pj = raw.png_jawab.as_deref().unwrap_or("");
        let row = rl319_map_kd_pj(kd, pj);
        if let Some(target) = row {
            let lain = (raw.ralan_total - raw.ralan_lab - raw.ralan_rad).max(0);
            let e = agg.entry(target.to_string()).or_insert(Rl319KhanzaSugesti {
                jenis_kode: target.to_string(),
                pasien_keluar: 0, lama_dirawat: 0,
                ralan_lab: 0, ralan_rad: 0, ralan_lain: 0,
            });
            e.pasien_keluar += raw.pasien_keluar;
            e.lama_dirawat  += raw.lama_dirawat;
            e.ralan_lab     += raw.ralan_lab;
            e.ralan_rad     += raw.ralan_rad;
            e.ralan_lain    += lain;
        }
    }

    let raw_per_kd_pj: Vec<Rl319KhanzaRaw> = by_kd.into_values().collect();
    let sugesti_per_row: Vec<Rl319KhanzaSugesti> = agg.into_values().collect();

    Ok(Json(Rl319Resp {
        tahun,
        entries,
        khanza: Rl319Khanza { raw_per_kd_pj, sugesti_per_row },
    }))
}

pub async fn update_rl319(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<Rl319Entry>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE sirs_rl319_entry SET
           pasien_keluar=?, lama_dirawat=?, ralan_lab=?, ralan_rad=?, ralan_lain=?, updated_by=?
         WHERE id=?"
    )
    .bind(body.pasien_keluar).bind(body.lama_dirawat)
    .bind(body.ralan_lab).bind(body.ralan_rad).bind(body.ralan_lain)
    .bind(&user.0.kode).bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE sirs_rl319_entry SET ... updated_by={} WHERE id={}",
        crate::audit::q(&user.0.kode), crate::audit::q(id))).await;
    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

pub async fn cetak_rl319(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl311Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl319(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    let mut tot = [0i32; 6];
    for e in &resp.entries {
        if e.is_parent == 1 {
            tbody.push_str(&format!(
                "<tr class=\"kat\"><td class=\"no\">{}</td><td colspan=\"6\"><strong>{}</strong></td></tr>",
                esc(&e.jenis_kode), esc(&e.jenis_nama)
            ));
        } else {
            // REALTIME: ambil dari klasifikasi Khanza (sugesti_per_row) per jenis_kode.
            let s = resp.khanza.sugesti_per_row.iter().find(|s| s.jenis_kode == e.jenis_kode);
            let pk = s.map(|s| s.pasien_keluar as i32).unwrap_or(0);
            let ld = s.map(|s| s.lama_dirawat as i32).unwrap_or(0);
            let lab = s.map(|s| s.ralan_lab as i32).unwrap_or(0);
            let rad = s.map(|s| s.ralan_rad as i32).unwrap_or(0);
            let lain = s.map(|s| s.ralan_lain as i32).unwrap_or(0);
            let total_ralan = lab + rad + lain;
            tot[0] += pk; tot[1] += ld; tot[2] += total_ralan;
            tot[3] += lab; tot[4] += rad; tot[5] += lain;
            tbody.push_str(&format!(
                "<tr><td class=\"no\">{}</td><td>{}</td>\
                 <td class=\"n\">{}</td><td class=\"n\">{}</td>\
                 <td class=\"n\"><strong>{}</strong></td>\
                 <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\">{}</td></tr>",
                esc(&e.jenis_kode), esc(&e.jenis_nama),
                pk, ld, total_ralan, lab, rad, lain
            ));
        }
    }
    tbody.push_str(&format!(
        "<tr class=\"total\"><td class=\"no\">99</td><td><strong>TOTAL</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td><td class=\"n\"><strong>{}</strong></td>\
         <td class=\"n\"><strong>{}</strong></td></tr>",
        tot[0], tot[1], tot[2], tot[3], tot[4], tot[5]
    ));

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 3.19 Cara Bayar — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:12mm;font-size:9pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:12px}}
  table{{width:100%;border-collapse:collapse;font-size:8.5pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:3px 6px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;text-align:center}}
  th.subgrp{{background:#3b82f6}}
  td.no{{width:38px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  tr.kat td{{background:#dbeafe;color:#1e40af}}
  tr.total td{{background:#bfdbfe;font-weight:bold}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:10mm}}.no-print{{display:none}}@page{{size:landscape}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 3.19 Cara Bayar (Tahunan)</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 3.19 — Rekapitulasi Cara Bayar</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>Tahun {tahun}</strong> · Tanggal cetak: {now}
</div>

<table>
  <thead><tr>
    <th rowspan="2" class="no">No</th><th rowspan="2">Cara Pembayaran</th>
    <th colspan="2" class="subgrp">Pasien Rawat Inap</th>
    <th rowspan="2">Jumlah<br/>Pasien<br/>Rawat Jalan</th>
    <th colspan="3" class="subgrp">Jumlah Pasien Rawat Jalan</th>
  </tr><tr>
    <th class="subgrp">Jumlah Pasien Keluar</th>
    <th class="subgrp">Jumlah Lama Dirawat</th>
    <th class="subgrp">Laboratorium</th>
    <th class="subgrp">Radiologi</th>
    <th class="subgrp">Lain-lain</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Sumber: <code>reg_periksa × penjab × kamar_inap × periksa_lab × periksa_radiologi</code>.<br/>
  Mapping kd_pj → JUKNIS: A01 UMUM→1, BPJS (A02/BPJ)→2.1, C03 JAMKESDA→2.2,
  Polri/Jasa Raharja/ASABRI→2.3, asuransi swasta→2.4, KARYAWAN RSUD→3, KARTU SEHAT→4.1, SKTM→4.2, GRATIS lain→4.3.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), tahun = esc(&resp.tahun),
        tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 4.1 — Kompilasi Penyakit/Morbiditas Pasien Rawat Inap (BULANAN)
// Per JUKNIS SIRS 6.3 Bab V A.
// Per ICD-10 (3 digit) × 25 kelompok umur × JK (L,P) + total + mati.
// REALTIME compute dari diagnosa_pasien (prioritas=1) × kamar_inap × pasien.
// ─────────────────────────────────────────────────────────────────────────────

// 25 kelompok umur per JUKNIS, format (label, low_inclusive, high_inclusive unit)
fn rl4_umur_labels() -> Vec<&'static str> {
    vec![
        "<1 jam", "1-23 jam", "1-7 hari", "8-28 hari", "29 hari-<3 bln",
        "3-<6 bln", "6-11 bln", "1-4 th", "5-9 th", "10-14 th",
        "15-19 th", "20-24 th", "25-29 th", "30-34 th", "35-39 th",
        "40-44 th", "45-49 th", "50-54 th", "55-59 th", "60-64 th",
        "65-69 th", "70-74 th", "75-79 th", "80-84 th", "≥85 th",
    ]
}

// SQL CASE expression untuk klasifikasi umur ke index 0..24
// Param: tgl_lahir col + reference date col
fn rl4_umur_case(tgl_lahir: &str, ref_date: &str) -> String {
    format!(
        "CASE
           WHEN TIMESTAMPDIFF(HOUR, {tl}, {ref}) < 1 THEN 0
           WHEN TIMESTAMPDIFF(DAY, {tl}, {ref}) < 1 THEN 1
           WHEN TIMESTAMPDIFF(DAY, {tl}, {ref}) <= 7 THEN 2
           WHEN TIMESTAMPDIFF(DAY, {tl}, {ref}) <= 28 THEN 3
           WHEN TIMESTAMPDIFF(MONTH, {tl}, {ref}) < 3 THEN 4
           WHEN TIMESTAMPDIFF(MONTH, {tl}, {ref}) < 6 THEN 5
           WHEN TIMESTAMPDIFF(MONTH, {tl}, {ref}) < 12 THEN 6
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 5  THEN 7
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 10 THEN 8
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 15 THEN 9
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 20 THEN 10
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 25 THEN 11
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 30 THEN 12
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 35 THEN 13
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 40 THEN 14
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 45 THEN 15
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 50 THEN 16
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 55 THEN 17
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 60 THEN 18
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 65 THEN 19
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 70 THEN 20
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 75 THEN 21
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 80 THEN 22
           WHEN TIMESTAMPDIFF(YEAR, {tl}, {ref}) < 85 THEN 23
           ELSE 24
         END",
        tl = tgl_lahir, ref = ref_date
    )
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl41Raw {
    pub kd_penyakit: String,
    pub nm_penyakit: Option<String>,
    pub umur_idx:    i32,
    pub jk:          String,
    pub mati:        i32,    // 1 if stts_pulang='Meninggal' else 0
    pub jml:         i64,
}

#[derive(Debug, Serialize)]
pub struct Rl41Row {
    pub kd_penyakit: String,
    pub nm_penyakit: String,
    pub cells_l:     Vec<i64>,  // 25 cells L
    pub cells_p:     Vec<i64>,  // 25 cells P
    pub mati_l:      i64,
    pub mati_p:      i64,
    pub total_l:     i64,
    pub total_p:     i64,
    pub total:       i64,
    pub total_mati:  i64,
}

#[derive(Debug, Serialize)]
pub struct Rl41Resp {
    pub bulan:       String,
    pub umur_labels: Vec<&'static str>,
    pub rows:        Vec<Rl41Row>,
    pub total_pasien_keluar: i64,
    pub total_pasien_mati:   i64,
}

pub async fn get_rl41(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl41Resp>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let bulan_dari = format!("{}-01", bulan);
    let (year_s, month_s) = (&bulan[..4], &bulan[5..7]);
    let year: i32 = year_s.parse().unwrap_or(2026);
    let month: u32 = month_s.parse().unwrap_or(1);
    let next_month_first = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let bulan_sampai = (next_month_first - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    // Query: hanya pasien yang sudah KELUAR RS (exclude Pindah Kamar)
    // Diagnosa utama (prioritas=1, status=Ranap)
    // Group by kd_penyakit (3-digit prefix) × umur × jk × mati flag
    let umur_case = rl4_umur_case("p.tgl_lahir", "ki.tgl_keluar");
    let sql = format!(
        "SELECT LEFT(dp.kd_penyakit,3) AS kd_penyakit,
                MAX(pk.nm_penyakit) AS nm_penyakit,
                CAST({umur_case} AS SIGNED) AS umur_idx,
                p.jk AS jk,
                CAST(CASE WHEN UPPER(ki.stts_pulang)='MENINGGAL' THEN 1 ELSE 0 END AS SIGNED) AS mati,
                CAST(COUNT(DISTINCT ki.no_rawat) AS SIGNED) AS jml
         FROM kamar_inap ki
         JOIN reg_periksa r ON r.no_rawat=ki.no_rawat
         JOIN pasien p ON p.no_rkm_medis=r.no_rkm_medis
         JOIN diagnosa_pasien dp ON dp.no_rawat=ki.no_rawat AND dp.status='Ranap' AND dp.prioritas=1
         LEFT JOIN penyakit pk ON pk.kd_penyakit=dp.kd_penyakit
         WHERE ki.tgl_keluar BETWEEN ? AND ?
           AND ki.stts_pulang!=''
           AND UPPER(ki.stts_pulang)!='PINDAH KAMAR'
         GROUP BY kd_penyakit, umur_idx, jk, mati"
    );
    let raws: Vec<Rl41Raw> = sqlx::query_as(&sql)
        .bind(&bulan_dari).bind(&bulan_sampai)
        .fetch_all(&state.pool).await.map_err(db_err)?;

    // Aggregate into Vec<Rl41Row>
    use std::collections::BTreeMap;
    let mut map: BTreeMap<String, Rl41Row> = BTreeMap::new();
    for r in raws {
        let row = map.entry(r.kd_penyakit.clone()).or_insert(Rl41Row {
            kd_penyakit: r.kd_penyakit.clone(),
            nm_penyakit: r.nm_penyakit.clone().unwrap_or_default(),
            cells_l: vec![0i64; 25],
            cells_p: vec![0i64; 25],
            mati_l: 0, mati_p: 0,
            total_l: 0, total_p: 0, total: 0, total_mati: 0,
        });
        if row.nm_penyakit.is_empty() {
            row.nm_penyakit = r.nm_penyakit.clone().unwrap_or_default();
        }
        let idx = (r.umur_idx as usize).min(24);
        if r.jk == "L" {
            row.cells_l[idx] += r.jml;
            row.total_l += r.jml;
            if r.mati == 1 { row.mati_l += r.jml; }
        } else if r.jk == "P" {
            row.cells_p[idx] += r.jml;
            row.total_p += r.jml;
            if r.mati == 1 { row.mati_p += r.jml; }
        }
        row.total += r.jml;
        if r.mati == 1 { row.total_mati += r.jml; }
    }

    let mut rows: Vec<Rl41Row> = map.into_values().collect();
    rows.sort_by(|a, b| b.total.cmp(&a.total).then(a.kd_penyakit.cmp(&b.kd_penyakit)));

    let total_pasien_keluar: i64 = rows.iter().map(|r| r.total).sum();
    let total_pasien_mati:   i64 = rows.iter().map(|r| r.total_mati).sum();

    Ok(Json(Rl41Resp {
        bulan,
        umur_labels: rl4_umur_labels(),
        rows,
        total_pasien_keluar,
        total_pasien_mati,
    }))
}

pub async fn cetak_rl41(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl41(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let labels = &resp.umur_labels;
    let mut th_l1 = String::new();
    let mut th_l2 = String::new();
    for l in labels {
        th_l1.push_str(&format!("<th colspan=\"2\" class=\"u\">{}</th>", esc(l)));
        th_l2.push_str("<th class=\"j\">L</th><th class=\"j\">P</th>");
    }

    let mut tbody = String::new();
    for r in &resp.rows {
        let mut cells = String::new();
        for i in 0..25 {
            cells.push_str(&format!(
                "<td class=\"n\">{}</td><td class=\"n\">{}</td>",
                if r.cells_l[i] > 0 { r.cells_l[i].to_string() } else { "·".to_string() },
                if r.cells_p[i] > 0 { r.cells_p[i].to_string() } else { "·".to_string() },
            ));
        }
        tbody.push_str(&format!(
            "<tr><td class=\"icd\">{}</td><td>{}</td>{cells}\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td></tr>",
            esc(&r.kd_penyakit), esc(&r.nm_penyakit),
            r.total_l, r.total_p, r.total,
            r.mati_l, r.mati_p, r.total_mati,
            cells = cells
        ));
    }

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 4.1 Morbiditas Ranap — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:8mm;font-size:7pt}}
  h1{{font-size:11pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:9pt;margin:0 0 6px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:7pt;color:#475569;text-align:center;margin-bottom:8px}}
  table{{width:100%;border-collapse:collapse;font-size:6.5pt;margin-top:4px}}
  th,td{{border:1px solid #94a3b8;padding:1px 2px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;font-size:6pt;text-align:center}}
  th.u{{background:#3b82f6;font-size:5.5pt}}
  th.j{{background:#60a5fa;width:14px}}
  td.icd{{font-weight:bold;background:#f8fafc;font-family:monospace}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums;font-size:6.5pt;width:14px}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:6px 10px;margin:8px 0;font-size:8pt}}
  .footer{{margin-top:10px;font-size:6pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:6px}}
  @media print{{body{{margin:5mm}}.no-print{{display:none}}@page{{size:landscape;margin:5mm}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;font-size:9pt}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 4.1 Morbiditas Ranap (landscape)</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 4.1 — Kompilasi Penyakit/Morbiditas Pasien Rawat Inap</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  🏥 <strong>Total pasien rawat inap keluar {bulan}</strong>: <strong>{tot}</strong> pasien
  · Pasien Keluar Mati: <strong>{mati}</strong>
  · Distinct ICD-10 (3-digit): <strong>{nrows}</strong>
</div>

<table>
  <thead>
    <tr>
      <th rowspan="3" class="icd">ICD</th><th rowspan="3">Diagnosa</th>
      <th colspan="50">Jumlah Pasien Keluar Hidup dan Mati Menurut Kelompok Umur & Jenis Kelamin</th>
      <th colspan="3">Pasien Hidup+Mati</th>
      <th colspan="3">Pasien Keluar Mati</th>
    </tr>
    <tr>{th_l1}<th colspan="3" rowspan="2">L · P · Total</th><th colspan="3" rowspan="2">L · P · Total</th></tr>
    <tr>{th_l2}</tr>
  </thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Sumber: <code>diagnosa_pasien (prioritas=1, status='Ranap') × kamar_inap (tgl_keluar, exclude Pindah Kamar) × pasien × penyakit</code>.<br/>
  25 kelompok umur per JUKNIS SIRS 6.3. Pasien mati = stts_pulang='Meninggal'.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), bulan = esc(&resp.bulan),
        tot = resp.total_pasien_keluar, mati = resp.total_pasien_mati,
        nrows = resp.rows.len(),
        th_l1 = th_l1, th_l2 = th_l2, tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 4.2 — 10 Besar Penyakit Rawat Inap (BULANAN)
// Per JUKNIS SIRS 6.3 Bab V B.
// Top 10 dari RL 4.1, urut by total (hidup+mati), exclude O80/O82/R/V/W/X/Y/Z.
// Reuse get_rl41 + filter + LIMIT.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct Rl42Row {
    pub no:          i32,
    pub kd_penyakit: String,
    pub nm_penyakit: String,
    pub total_l:     i64,
    pub total_p:     i64,
    pub total:       i64,
    pub mati_l:      i64,
    pub mati_p:      i64,
    pub total_mati:  i64,
}

#[derive(Debug, Serialize)]
pub struct Rl42Resp {
    pub bulan:       String,
    pub rows:        Vec<Rl42Row>,
    pub total_pasien_keluar: i64,
    pub total_pasien_mati:   i64,
}

fn rl42_is_excluded(kd: &str) -> bool {
    let kd = kd.to_uppercase();
    if kd == "O80" || kd == "O82" { return true; }
    if let Some(c) = kd.chars().next() {
        matches!(c, 'R' | 'V' | 'W' | 'X' | 'Y' | 'Z')
    } else { false }
}

pub async fn get_rl42(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl42Resp>, (StatusCode, Json<Value>)> {
    let resp41 = get_rl41(user, State(state), q).await?.0;

    let mut filtered: Vec<&Rl41Row> = resp41.rows.iter()
        .filter(|r| !rl42_is_excluded(&r.kd_penyakit))
        .collect();
    filtered.sort_by(|a, b| b.total.cmp(&a.total).then(a.kd_penyakit.cmp(&b.kd_penyakit)));

    let rows: Vec<Rl42Row> = filtered.into_iter().take(10).enumerate()
        .map(|(i, r)| Rl42Row {
            no: (i + 1) as i32,
            kd_penyakit: r.kd_penyakit.clone(),
            nm_penyakit: r.nm_penyakit.clone(),
            total_l: r.total_l, total_p: r.total_p, total: r.total,
            mati_l: r.mati_l, mati_p: r.mati_p, total_mati: r.total_mati,
        })
        .collect();

    Ok(Json(Rl42Resp {
        bulan: resp41.bulan,
        rows,
        total_pasien_keluar: resp41.total_pasien_keluar,
        total_pasien_mati:   resp41.total_pasien_mati,
    }))
}

pub async fn cetak_rl42(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl42(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    for r in &resp.rows {
        tbody.push_str(&format!(
            "<tr><td class=\"no\">{}</td><td class=\"icd\">{}</td><td>{}</td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td></tr>",
            r.no, esc(&r.kd_penyakit), esc(&r.nm_penyakit),
            r.total_l, r.total_p, r.total,
            r.mati_l, r.mati_p, r.total_mati
        ));
    }

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 4.2 10 Besar Ranap — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:14mm;font-size:10pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:12px}}
  table{{width:100%;border-collapse:collapse;font-size:10pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:5px 8px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;text-align:center}}
  th.subgrp{{background:#3b82f6}}
  td.no{{width:42px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.icd{{width:60px;text-align:center;font-family:monospace;font-weight:bold;background:#f8fafc}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:9pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:12mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 4.2 10 Besar Penyakit Ranap</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 4.2 — 10 Besar Penyakit Rawat Inap</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  🏥 <strong>Periode {bulan}</strong>: total pasien rawat inap keluar = <strong>{tot}</strong>
  · Pasien Keluar Mati = <strong>{mati}</strong>
  · Sumber: RL 4.1 (ICD 3-digit, urut by Total) — exclude O80, O82, R, V, W, X, Y, Z.
</div>

<table>
  <thead><tr>
    <th rowspan="2" class="no">No</th>
    <th rowspan="2" class="icd">Kelompok<br/>ICD-10</th>
    <th rowspan="2">Kelompok Diagnosis Penyakit</th>
    <th colspan="3" class="subgrp">Jumlah Pasien Keluar (Hidup+Mati)</th>
    <th colspan="3" class="subgrp">Jumlah Pasien Keluar Mati</th>
  </tr><tr>
    <th class="subgrp">L</th><th class="subgrp">P</th><th class="subgrp">Total</th>
    <th class="subgrp">L</th><th class="subgrp">P</th><th class="subgrp">Total</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Kelompok ICD-10 = prefix 3-digit (contoh: A91, J18). Diurut by Total Pasien Keluar (Hidup+Mati) descending.<br/>
  Exclude per JUKNIS Rule 3: kode O80 (single spontaneous delivery), O82 (cesarean),
  R (gejala/tanda tidak terklasifikasi), V/W/X/Y (cause of injury), Z (faktor status kesehatan)
  — bukan kategori penyakit.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), bulan = esc(&resp.bulan),
        tot = resp.total_pasien_keluar, mati = resp.total_pasien_mati,
        tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 4.3 — 10 Besar Kematian Penyakit Rawat Inap (BULANAN)
// Per JUKNIS SIRS 6.3 Bab V C. Reuse get_rl41, filter total_mati > 0,
// sort by total_mati DESC, take 10.
// ─────────────────────────────────────────────────────────────────────────────

pub async fn get_rl43(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl42Resp>, (StatusCode, Json<Value>)> {
    let resp41 = get_rl41(user, State(state), q).await?.0;

    let mut filtered: Vec<&Rl41Row> = resp41.rows.iter()
        .filter(|r| r.total_mati > 0)
        .collect();
    filtered.sort_by(|a, b|
        b.total_mati.cmp(&a.total_mati)
         .then(b.total.cmp(&a.total))
         .then(a.kd_penyakit.cmp(&b.kd_penyakit)));

    let rows: Vec<Rl42Row> = filtered.into_iter().take(10).enumerate()
        .map(|(i, r)| Rl42Row {
            no: (i + 1) as i32,
            kd_penyakit: r.kd_penyakit.clone(),
            nm_penyakit: r.nm_penyakit.clone(),
            total_l: r.total_l, total_p: r.total_p, total: r.total,
            mati_l: r.mati_l, mati_p: r.mati_p, total_mati: r.total_mati,
        })
        .collect();

    Ok(Json(Rl42Resp {
        bulan: resp41.bulan,
        rows,
        total_pasien_keluar: resp41.total_pasien_keluar,
        total_pasien_mati:   resp41.total_pasien_mati,
    }))
}

pub async fn cetak_rl43(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl43(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let mut tbody = String::new();
    if resp.rows.is_empty() {
        tbody.push_str("<tr><td colspan=\"9\" style=\"text-align:center;color:#94a3b8;padding:24px\">Tidak ada kematian di bulan ini</td></tr>");
    } else {
        for r in &resp.rows {
            tbody.push_str(&format!(
                "<tr><td class=\"no\">{}</td><td class=\"icd\">{}</td><td>{}</td>\
                 <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td>\
                 <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td></tr>",
                r.no, esc(&r.kd_penyakit), esc(&r.nm_penyakit),
                r.total_l, r.total_p, r.total,
                r.mati_l, r.mati_p, r.total_mati
            ));
        }
    }

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 4.3 10 Besar Kematian Ranap — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:14mm;font-size:10pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:12px}}
  table{{width:100%;border-collapse:collapse;font-size:10pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:5px 8px;vertical-align:middle}}
  th{{background:#dc2626;color:#fff;text-align:center}}
  th.subgrp{{background:#ef4444}}
  td.no{{width:42px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.icd{{width:60px;text-align:center;font-family:monospace;font-weight:bold;background:#f8fafc}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  .sanity{{background:#fee2e2;border-left:4px solid #dc2626;padding:8px 12px;margin:10px 0;font-size:9pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:12mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 4.3 10 Besar Kematian Penyakit Ranap</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 4.3 — 10 Besar Kematian Penyakit Rawat Inap</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  💀 <strong>Periode {bulan}</strong>: total pasien rawat inap keluar = <strong>{tot}</strong>
  · Pasien Keluar Mati = <strong>{mati}</strong>
  · Sumber: RL 4.1 (ICD 3-digit, urut by Total Pasien Keluar Mati descending).
</div>

<table>
  <thead><tr>
    <th rowspan="2" class="no">No</th>
    <th rowspan="2" class="icd">Kelompok<br/>ICD-10</th>
    <th rowspan="2">Kelompok Diagnosis Penyakit</th>
    <th colspan="3" class="subgrp">Jumlah Pasien (Hidup+Mati)</th>
    <th colspan="3" class="subgrp">Jumlah Pasien Keluar Mati</th>
  </tr><tr>
    <th class="subgrp">L</th><th class="subgrp">P</th><th class="subgrp">Total</th>
    <th class="subgrp">L</th><th class="subgrp">P</th><th class="subgrp">Total</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Kelompok ICD-10 = prefix 3-digit. Hanya ICD dengan jumlah kematian &gt; 0 yang ditampilkan.
  Diurut by Total Pasien Keluar Mati descending, tiebreaker by Total Pasien Keluar (hidup+mati).<br/>
  Sumber: <code>diagnosa_pasien (prioritas=1, status='Ranap') × kamar_inap (stts_pulang='Meninggal')</code>.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), bulan = esc(&resp.bulan),
        tot = resp.total_pasien_keluar, mati = resp.total_pasien_mati,
        tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 5.1 — Kompilasi Morbiditas Pasien Rawat Jalan (BULANAN)
// Per JUKNIS SIRS 6.3 Bab VI A. Format mirip RL 4.1 tapi:
// - Cells (25 umur × L/P) = Kasus BARU (status_penyakit='Baru')
// - Total Kasus Baru per JK + Total Kunjungan per JK (baru + lama)
// - Sumber: diagnosa_pasien (prioritas=1, status='Ralan')
// REALTIME compute.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Rl51Raw {
    pub kd_penyakit: String,
    pub nm_penyakit: Option<String>,
    pub umur_idx:    i32,
    pub jk:          String,
    pub baru:        i64,      // count rows status_penyakit='Baru'
    pub kunjungan:   i64,      // count all rows
}

#[derive(Debug, Serialize)]
pub struct Rl51Row {
    pub kd_penyakit: String,
    pub nm_penyakit: String,
    pub baru_l_per_umur: Vec<i64>,   // 25 cells L (kasus baru)
    pub baru_p_per_umur: Vec<i64>,   // 25 cells P (kasus baru)
    pub total_baru_l:    i64,
    pub total_baru_p:    i64,
    pub total_baru:      i64,
    pub kunjungan_l:     i64,
    pub kunjungan_p:     i64,
    pub kunjungan_total: i64,
}

#[derive(Debug, Serialize)]
pub struct Rl51Resp {
    pub bulan:       String,
    pub umur_labels: Vec<&'static str>,
    pub rows:        Vec<Rl51Row>,
    pub total_kasus_baru: i64,
    pub total_kunjungan:  i64,
}

pub async fn get_rl51(
    _user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl51Resp>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let bulan_dari = format!("{}-01", bulan);
    let (year_s, month_s) = (&bulan[..4], &bulan[5..7]);
    let year: i32 = year_s.parse().unwrap_or(2026);
    let month: u32 = month_s.parse().unwrap_or(1);
    let next_month_first = if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let bulan_sampai = (next_month_first - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    // Reference date untuk umur: reg_periksa.tgl_registrasi
    let umur_case = rl4_umur_case("p.tgl_lahir", "r.tgl_registrasi");
    let sql = format!(
        "SELECT LEFT(dp.kd_penyakit,3) AS kd_penyakit,
                MAX(pk.nm_penyakit) AS nm_penyakit,
                CAST({umur_case} AS SIGNED) AS umur_idx,
                p.jk AS jk,
                CAST(SUM(CASE WHEN dp.status_penyakit='Baru' THEN 1 ELSE 0 END) AS SIGNED) AS baru,
                CAST(COUNT(*) AS SIGNED) AS kunjungan
         FROM diagnosa_pasien dp
         JOIN reg_periksa r ON r.no_rawat=dp.no_rawat
         JOIN pasien p ON p.no_rkm_medis=r.no_rkm_medis
         LEFT JOIN penyakit pk ON pk.kd_penyakit=dp.kd_penyakit
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND dp.status='Ralan' AND dp.prioritas=1
         GROUP BY kd_penyakit, umur_idx, jk"
    );
    let raws: Vec<Rl51Raw> = sqlx::query_as(&sql)
        .bind(&bulan_dari).bind(&bulan_sampai)
        .fetch_all(&state.pool).await.map_err(db_err)?;

    use std::collections::BTreeMap;
    let mut map: BTreeMap<String, Rl51Row> = BTreeMap::new();
    for r in raws {
        let row = map.entry(r.kd_penyakit.clone()).or_insert(Rl51Row {
            kd_penyakit: r.kd_penyakit.clone(),
            nm_penyakit: r.nm_penyakit.clone().unwrap_or_default(),
            baru_l_per_umur: vec![0i64; 25],
            baru_p_per_umur: vec![0i64; 25],
            total_baru_l: 0, total_baru_p: 0, total_baru: 0,
            kunjungan_l: 0, kunjungan_p: 0, kunjungan_total: 0,
        });
        if row.nm_penyakit.is_empty() {
            row.nm_penyakit = r.nm_penyakit.clone().unwrap_or_default();
        }
        let idx = (r.umur_idx as usize).min(24);
        if r.jk == "L" {
            row.baru_l_per_umur[idx] += r.baru;
            row.total_baru_l    += r.baru;
            row.kunjungan_l     += r.kunjungan;
        } else if r.jk == "P" {
            row.baru_p_per_umur[idx] += r.baru;
            row.total_baru_p    += r.baru;
            row.kunjungan_p     += r.kunjungan;
        }
        row.total_baru      += r.baru;
        row.kunjungan_total += r.kunjungan;
    }

    let mut rows: Vec<Rl51Row> = map.into_values().collect();
    rows.sort_by(|a, b| b.kunjungan_total.cmp(&a.kunjungan_total).then(a.kd_penyakit.cmp(&b.kd_penyakit)));

    let total_kasus_baru: i64 = rows.iter().map(|r| r.total_baru).sum();
    let total_kunjungan:  i64 = rows.iter().map(|r| r.kunjungan_total).sum();

    Ok(Json(Rl51Resp {
        bulan,
        umur_labels: rl4_umur_labels(),
        rows,
        total_kasus_baru,
        total_kunjungan,
    }))
}

pub async fn cetak_rl51(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;

    let resp = get_rl51(user, State(state), q).await?.0;

    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();

    let labels = &resp.umur_labels;
    let mut th_l1 = String::new();
    let mut th_l2 = String::new();
    for l in labels {
        th_l1.push_str(&format!("<th colspan=\"2\" class=\"u\">{}</th>", esc(l)));
        th_l2.push_str("<th class=\"j\">L</th><th class=\"j\">P</th>");
    }

    let mut tbody = String::new();
    for r in &resp.rows {
        let mut cells = String::new();
        for i in 0..25 {
            cells.push_str(&format!(
                "<td class=\"n\">{}</td><td class=\"n\">{}</td>",
                if r.baru_l_per_umur[i] > 0 { r.baru_l_per_umur[i].to_string() } else { "·".to_string() },
                if r.baru_p_per_umur[i] > 0 { r.baru_p_per_umur[i].to_string() } else { "·".to_string() },
            ));
        }
        tbody.push_str(&format!(
            "<tr><td class=\"icd\">{}</td><td>{}</td>{cells}\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td>\
             <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td></tr>",
            esc(&r.kd_penyakit), esc(&r.nm_penyakit),
            r.total_baru_l, r.total_baru_p, r.total_baru,
            r.kunjungan_l, r.kunjungan_p, r.kunjungan_total,
            cells = cells
        ));
    }

    let html = format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>RL 5.1 Morbiditas Ralan — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:8mm;font-size:7pt}}
  h1{{font-size:11pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:9pt;margin:0 0 6px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:7pt;color:#475569;text-align:center;margin-bottom:8px}}
  table{{width:100%;border-collapse:collapse;font-size:6.5pt;margin-top:4px}}
  th,td{{border:1px solid #94a3b8;padding:1px 2px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;font-size:6pt;text-align:center}}
  th.u{{background:#3b82f6;font-size:5.5pt}}
  th.j{{background:#60a5fa;width:14px}}
  td.icd{{font-weight:bold;background:#f8fafc;font-family:monospace}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums;font-size:6.5pt;width:14px}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:6px 10px;margin:8px 0;font-size:8pt}}
  .footer{{margin-top:10px;font-size:6pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:6px}}
  @media print{{body{{margin:5mm}}.no-print{{display:none}}@page{{size:landscape;margin:5mm}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;font-size:9pt}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — RL 5.1 Morbiditas Ralan (landscape)</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>RL 5.1 — Kompilasi Penyakit/Morbiditas Pasien Rawat Jalan</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  🏥 <strong>Periode {bulan}</strong>: total kasus baru = <strong>{baru}</strong>
  · Total kunjungan = <strong>{kunj}</strong>
  · Distinct ICD-10 (3-digit) = <strong>{nrows}</strong>
</div>

<table>
  <thead>
    <tr>
      <th rowspan="3" class="icd">ICD</th><th rowspan="3">Diagnosis</th>
      <th colspan="50">Jumlah Kasus Baru × Kelompok Umur × JK</th>
      <th colspan="3">Total Kasus Baru</th>
      <th colspan="3">Total Kunjungan</th>
    </tr>
    <tr>{th_l1}<th colspan="3" rowspan="2">L · P · Total</th><th colspan="3" rowspan="2">L · P · Total</th></tr>
    <tr>{th_l2}</tr>
  </thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Sumber: <code>diagnosa_pasien (prioritas=1, status='Ralan') × reg_periksa × pasien × penyakit</code>.<br/>
  Kasus baru = status_penyakit='Baru' (pertama kali pasien terdiagnosa ICD tersebut).
  Umur dihitung dari pasien.tgl_lahir sampai reg_periksa.tgl_registrasi.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        nama = esc(&nm), now = esc(&now), bulan = esc(&resp.bulan),
        baru = resp.total_kasus_baru, kunj = resp.total_kunjungan,
        nrows = resp.rows.len(),
        th_l1 = th_l1, th_l2 = th_l2, tbody = tbody,
        alamat = esc(&al), kab = esc(&kb), pr = esc(&pr),
    );
    Ok(Html(html))
}

// ─────────────────────────────────────────────────────────────────────────────
// RL 5.2 — 10 Besar Kasus Baru Penyakit Rawat Jalan (BULANAN)
// RL 5.3 — 10 Besar Kunjungan Penyakit Rawat Jalan (BULANAN)
// Per JUKNIS SIRS 6.3 Bab VI B & C.
// Sumber: RL 5.1. Both exclude O80, O82, R, V, W, X, Y, Z (rl42_is_excluded).
// Beda: 5.2 sort by total_baru DESC; 5.3 sort by kunjungan_total DESC.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct Rl52Row {
    pub no:              i32,
    pub kd_penyakit:     String,
    pub nm_penyakit:     String,
    pub total_baru_l:    i64,
    pub total_baru_p:    i64,
    pub total_baru:      i64,
    pub kunjungan_l:     i64,
    pub kunjungan_p:     i64,
    pub kunjungan_total: i64,
}

#[derive(Debug, Serialize)]
pub struct Rl52Resp {
    pub bulan:             String,
    pub rows:              Vec<Rl52Row>,
    pub total_kasus_baru:  i64,
    pub total_kunjungan:   i64,
}

fn rl52_53_build(resp51: Rl51Resp, sort_by_baru: bool) -> Rl52Resp {
    let mut filtered: Vec<&Rl51Row> = resp51.rows.iter()
        .filter(|r| !rl42_is_excluded(&r.kd_penyakit))
        .collect();
    if sort_by_baru {
        filtered.sort_by(|a, b|
            b.total_baru.cmp(&a.total_baru)
             .then(b.kunjungan_total.cmp(&a.kunjungan_total))
             .then(a.kd_penyakit.cmp(&b.kd_penyakit)));
    } else {
        filtered.sort_by(|a, b|
            b.kunjungan_total.cmp(&a.kunjungan_total)
             .then(b.total_baru.cmp(&a.total_baru))
             .then(a.kd_penyakit.cmp(&b.kd_penyakit)));
    }

    let rows: Vec<Rl52Row> = filtered.into_iter().take(10).enumerate()
        .map(|(i, r)| Rl52Row {
            no: (i + 1) as i32,
            kd_penyakit: r.kd_penyakit.clone(),
            nm_penyakit: r.nm_penyakit.clone(),
            total_baru_l: r.total_baru_l, total_baru_p: r.total_baru_p, total_baru: r.total_baru,
            kunjungan_l: r.kunjungan_l, kunjungan_p: r.kunjungan_p, kunjungan_total: r.kunjungan_total,
        })
        .collect();

    Rl52Resp {
        bulan: resp51.bulan,
        rows,
        total_kasus_baru: resp51.total_kasus_baru,
        total_kunjungan:  resp51.total_kunjungan,
    }
}

pub async fn get_rl52(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl52Resp>, (StatusCode, Json<Value>)> {
    let resp51 = get_rl51(user, State(state), q).await?.0;
    Ok(Json(rl52_53_build(resp51, true)))
}

pub async fn get_rl53(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Json<Rl52Resp>, (StatusCode, Json<Value>)> {
    let resp51 = get_rl51(user, State(state), q).await?.0;
    Ok(Json(rl52_53_build(resp51, false)))
}

fn rl5_top_cetak_html(resp: &Rl52Resp, judul: &str, sort_label: &str, nm: &str, al: &str, kb: &str, pr: &str, now: &str) -> String {
    let mut tbody = String::new();
    if resp.rows.is_empty() {
        tbody.push_str("<tr><td colspan=\"9\" style=\"text-align:center;color:#94a3b8;padding:24px\">Tidak ada data</td></tr>");
    } else {
        for r in &resp.rows {
            tbody.push_str(&format!(
                "<tr><td class=\"no\">{}</td><td class=\"icd\">{}</td><td>{}</td>\
                 <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td>\
                 <td class=\"n\">{}</td><td class=\"n\">{}</td><td class=\"n\"><strong>{}</strong></td></tr>",
                r.no, esc(&r.kd_penyakit), esc(&r.nm_penyakit),
                r.total_baru_l, r.total_baru_p, r.total_baru,
                r.kunjungan_l, r.kunjungan_p, r.kunjungan_total
            ));
        }
    }

    format!(r#"<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>{judul} — {nama}</title>
<style>
  *{{box-sizing:border-box;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a}}
  body{{margin:14mm;font-size:10pt}}
  h1{{font-size:13pt;margin:0 0 4px 0;text-align:center;text-transform:uppercase;letter-spacing:1px}}
  h2{{font-size:10pt;margin:0 0 8px 0;text-align:center;font-weight:normal;color:#475569}}
  .meta{{font-size:8pt;color:#475569;text-align:center;margin-bottom:12px}}
  table{{width:100%;border-collapse:collapse;font-size:10pt;margin-top:6px}}
  th,td{{border:1px solid #94a3b8;padding:5px 8px;vertical-align:middle}}
  th{{background:#1e40af;color:#fff;text-align:center}}
  th.subgrp{{background:#3b82f6}}
  td.no{{width:42px;text-align:center;background:#f8fafc;font-weight:bold}}
  td.icd{{width:60px;text-align:center;font-family:monospace;font-weight:bold;background:#f8fafc}}
  td.n{{text-align:right;font-variant-numeric:tabular-nums}}
  .sanity{{background:#fef3c7;border-left:4px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:9pt}}
  .footer{{margin-top:14px;font-size:8pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}}
  @media print{{body{{margin:12mm}}.no-print{{display:none}}}}
  .toolbar{{background:#fef3c7;border:1px solid #facc15;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}}
  .btn-print{{background:#16a34a;color:#fff;border:0;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:bold}}
</style>
</head><body>
<div class="toolbar no-print">
  <span>📄 Pratinjau cetak — {judul}</span>
  <button class="btn-print" onclick="window.print()">🖨️ Cetak</button>
</div>

<h1>{judul}</h1>
<h2>{nama}</h2>
<div class="meta">
  Per JUKNIS SIRS 6.3 (Kepmenkes) · Periode: <strong>{bulan}</strong> · Tanggal cetak: {now}
</div>

<div class="sanity">
  🏥 <strong>Periode {bulan}</strong>: total kasus baru = <strong>{baru}</strong>
  · Total kunjungan = <strong>{kunj}</strong>
  · Sumber: RL 5.1, urut by {sort_label} descending — exclude O80, O82, R, V, W, X, Y, Z.
</div>

<table>
  <thead><tr>
    <th rowspan="2" class="no">No</th>
    <th rowspan="2" class="icd">Kelompok<br/>ICD-10</th>
    <th rowspan="2">Kelompok Diagnosis Penyakit</th>
    <th colspan="3" class="subgrp">Jumlah Kasus Baru</th>
    <th colspan="3" class="subgrp">Jumlah Kunjungan</th>
  </tr><tr>
    <th class="subgrp">L</th><th class="subgrp">P</th><th class="subgrp">Total</th>
    <th class="subgrp">L</th><th class="subgrp">P</th><th class="subgrp">Total</th>
  </tr></thead>
  <tbody>{tbody}</tbody>
</table>

<div class="footer">
  Kelompok ICD-10 = prefix 3-digit. Exclude per JUKNIS: O80, O82, R, V, W, X, Y, Z (bukan kategori penyakit).<br/>
  Sumber: <code>diagnosa_pasien (prioritas=1, status='Ralan') × reg_periksa × pasien × penyakit</code>.<br/>
  Alamat RS: {alamat}, Kab/Kota: {kab}, Provinsi: {pr}.
</div>
</body></html>"#,
        judul = judul, nama = esc(nm),
        bulan = esc(&resp.bulan), now = esc(now),
        baru = resp.total_kasus_baru, kunj = resp.total_kunjungan,
        sort_label = sort_label, tbody = tbody,
        alamat = esc(al), kab = esc(kb), pr = esc(pr),
    )
}

pub async fn cetak_rl52(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;
    let resp = get_rl52(user, State(state), q).await?.0;
    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();
    Ok(Html(rl5_top_cetak_html(&resp,
        "RL 5.2 — 10 Besar Kasus Baru Penyakit Rawat Jalan",
        "Total Kasus Baru",
        &nm, &al, &kb, &pr, &now)))
}

pub async fn cetak_rl53(
    user: AuthUser,
    State(state): State<AppState>,
    q: axum::extract::Query<Rl31Query>,
) -> Result<Html<String>, (StatusCode, Json<Value>)> {
    let setting: Option<SettingRow> = sqlx::query_as(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email
         FROM setting LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(db_err)?;
    let resp = get_rl53(user, State(state), q).await?.0;
    let nm = setting.as_ref().and_then(SettingFields::nama_instansi).unwrap_or("(Belum di-set)").to_string();
    let al = setting.as_ref().and_then(SettingFields::alamat).unwrap_or("-").to_string();
    let kb = setting.as_ref().and_then(SettingFields::kabupaten).unwrap_or("-").to_string();
    let pr = setting.as_ref().and_then(SettingFields::propinsi).unwrap_or("-").to_string();
    let now = chrono::Local::now().format("%d %B %Y, %H:%M:%S").to_string();
    Ok(Html(rl5_top_cetak_html(&resp,
        "RL 5.3 — 10 Besar Kunjungan Penyakit Rawat Jalan",
        "Total Kunjungan",
        &nm, &al, &kb, &pr, &now)))
}

// Stub untuk RL lain — supaya frontend tidak error 404. Implementasi TODO.
pub async fn rl_stub(
    _user: AuthUser,
    Path(kode): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    Ok(Json(json!({
        "kode": kode,
        "message": "Formulir ini belum diimplementasi. Sumber data tersedia di Khanza tetapi belum ada query SQL.",
        "status": "stub"
    })))
}
