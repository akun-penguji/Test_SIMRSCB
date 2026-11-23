use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct IgdQuery {
    pub tgl_awal:  Option<String>,
    pub tgl_akhir: Option<String>,
    pub cari:      Option<String>,
    pub status:    Option<String>,
    pub page:      Option<i64>,
    pub size:      Option<i64>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct IgdRow {
    pub no_rawat:       String,
    pub no_reg:         Option<String>,
    pub tgl_registrasi: Option<String>,
    pub jam_reg:        Option<String>,
    pub no_rm:          String,
    pub nm_pasien:      Option<String>,
    pub jk:             Option<String>,
    pub tgl_lahir:      Option<String>,
    pub kd_dokter:      Option<String>,
    pub nm_dokter:      Option<String>,
    pub png_jawab:      Option<String>,
    pub hubunganpj:     Option<String>,
    pub kd_pj:          Option<String>,
    pub penjab_nama:    Option<String>,
    pub stts:           Option<String>,
    pub stts_daftar:    Option<String>,
    pub status_bayar:   Option<String>,
}

#[derive(Serialize)]
pub struct IgdListResponse {
    pub data:  Vec<IgdRow>,
    pub total: i64,
    pub page:  i64,
    pub size:  i64,
}

pub async fn list_igd(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<IgdQuery>,
) -> Result<Json<IgdListResponse>, (StatusCode, Json<Value>)> {
    let page   = q.page.unwrap_or(1).max(1);
    let size   = q.size.unwrap_or(50).min(200);
    let offset = (page - 1) * size;
    let today  = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tgl_awal  = q.tgl_awal.unwrap_or_else(|| today.clone());
    let tgl_akhir = q.tgl_akhir.unwrap_or_else(|| today.clone());
    let cari_like = format!("%{}%", q.cari.unwrap_or_default());
    let status_like = match q.status.as_deref().unwrap_or("Semua") {
        "Semua" => "%".to_string(),
        s       => s.to_string(),
    };

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM reg_periksa r
         LEFT JOIN pasien p  ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN dokter d  ON r.kd_dokter = d.kd_dokter
         LEFT JOIN penjab pj ON r.kd_pj = pj.kd_pj
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND r.kd_poli = 'IGDK'
           AND r.stts LIKE ?
           AND (r.no_reg LIKE ? OR r.no_rawat LIKE ? OR p.nm_pasien LIKE ?
                OR d.nm_dokter LIKE ?)"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .bind(&status_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    let data: Vec<IgdRow> = sqlx::query_as(
        "SELECT r.no_rawat, r.no_reg,
                DATE_FORMAT(r.tgl_registrasi,'%Y-%m-%d') AS tgl_registrasi,
                TIME_FORMAT(r.jam_reg,'%H:%i:%s') AS jam_reg,
                r.no_rkm_medis as no_rm, p.nm_pasien, p.jk,
                DATE_FORMAT(p.tgl_lahir,'%Y-%m-%d') AS tgl_lahir,
                r.kd_dokter, d.nm_dokter, r.p_jawab as png_jawab, r.hubunganpj,
                r.kd_pj, pj.png_jawab as penjab_nama,
                r.stts, r.stts_daftar, r.status_bayar
         FROM reg_periksa r
         LEFT JOIN pasien p  ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN dokter d  ON r.kd_dokter = d.kd_dokter
         LEFT JOIN penjab pj ON r.kd_pj = pj.kd_pj
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND r.kd_poli = 'IGDK'
           AND r.stts LIKE ?
           AND (r.no_reg LIKE ? OR r.no_rawat LIKE ? OR p.nm_pasien LIKE ?
                OR d.nm_dokter LIKE ?)
         ORDER BY r.tgl_registrasi, r.jam_reg
         LIMIT ? OFFSET ?"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .bind(&status_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(size).bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(IgdListResponse { data, total: total.0, page, size }))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error igd: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}

// ════════════════════════════════════════════════════════════════════════════
//  REGISTRASI IGD (port DlgIGD — Fase 1)
// ════════════════════════════════════════════════════════════════════════════

fn err(status: StatusCode, msg: &str) -> (StatusCode, Json<Value>) {
    (status, Json(json!({ "error": msg })))
}

// ── Cari pasien untuk registrasi IGD ─────────────────────────────────────────
#[derive(Deserialize)]
pub struct CariPasienQuery {
    pub q: String,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct PasienIgd {
    pub no_rm: String,
    pub nm_pasien: String,
    pub jk: Option<String>,
    pub tgl_lahir: Option<String>,
    pub alamat: Option<String>,
    pub no_tlp: Option<String>,
    pub nama_pj: Option<String>,
    pub hub_pj: Option<String>,
    pub kd_pj_default: Option<String>,
}

pub async fn cari_pasien(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<CariPasienQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let term = q.q.trim();
    if term.len() < 2 {
        return Err(err(StatusCode::BAD_REQUEST, "Kata kunci minimal 2 karakter"));
    }
    let like = format!("%{term}%");
    let rows: Vec<PasienIgd> = sqlx::query_as(
        "SELECT p.no_rkm_medis AS no_rm, p.nm_pasien, p.jk,
                DATE_FORMAT(p.tgl_lahir,'%Y-%m-%d') AS tgl_lahir,
                p.alamat, p.no_tlp,
                p.namakeluarga AS nama_pj, p.keluarga AS hub_pj, p.kd_pj AS kd_pj_default
         FROM pasien p
         WHERE p.nm_pasien LIKE ? OR p.no_rkm_medis LIKE ? OR p.no_ktp LIKE ?
         ORDER BY p.nm_pasien
         LIMIT 20",
    )
    .bind(&like).bind(&like).bind(&like)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;
    Ok(Json(json!({ "ok": true, "data": rows })))
}

// ── List dokter & penjab (lookup) ────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct DokterOpt {
    pub kd_dokter: String,
    pub nm_dokter: String,
}
pub async fn list_dokter(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<DokterOpt>>, (StatusCode, Json<Value>)> {
    let rows: Vec<DokterOpt> = sqlx::query_as(
        "SELECT kd_dokter, nm_dokter FROM dokter WHERE status='1' ORDER BY nm_dokter",
    )
    .fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct PenjabOpt {
    pub kd_pj: String,
    pub png_jawab: String,
}
pub async fn list_penjab(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<PenjabOpt>>, (StatusCode, Json<Value>)> {
    let rows: Vec<PenjabOpt> = sqlx::query_as(
        "SELECT kd_pj, png_jawab FROM penjab WHERE status='1' ORDER BY png_jawab",
    )
    .fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// ── Registrasi IGD (INSERT reg_periksa poli IGDK) ────────────────────────────
#[derive(Deserialize)]
pub struct RegIgdBody {
    pub no_rm: String,
    pub kd_dokter: String,
    pub kd_pj: String,
    pub p_jawab: Option<String>,
    pub almt_pj: Option<String>,
    pub hubunganpj: Option<String>,
    pub tgl_registrasi: Option<String>, // default hari ini
    pub jam_reg: Option<String>,        // default jam sekarang (HH:MM:SS)
}

pub async fn registrasi(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<RegIgdBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_rm.trim().is_empty() || b.kd_dokter.trim().is_empty() || b.kd_pj.trim().is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "no_rm, kd_dokter, dan kd_pj wajib"));
    }
    let tgl = b.tgl_registrasi.clone().filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());
    let jam = b.jam_reg.clone().filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| chrono::Local::now().format("%H:%M:%S").to_string());

    // Pastikan pasien ada
    let ada: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pasien WHERE no_rkm_medis=?")
        .bind(&b.no_rm).fetch_one(&state.pool).await.map_err(db_err)?;
    if ada == 0 {
        return Err(err(StatusCode::NOT_FOUND, "Pasien tidak ditemukan"));
    }

    // Tolak bila pasien masih dirawat inap (belum pulang)
    let masih_ranap: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM kamar_inap ki
         JOIN reg_periksa rp ON rp.no_rawat = ki.no_rawat
         WHERE rp.no_rkm_medis = ? AND ki.stts_pulang = '-'",
    ).bind(&b.no_rm).fetch_one(&state.pool).await.map_err(db_err)?;
    if masih_ranap > 0 {
        return Err(err(StatusCode::CONFLICT, "Pasien masih berstatus rawat inap (belum pulang). Selesaikan dulu."));
    }

    // Status Baru/Lama
    let pernah_reg: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM reg_periksa WHERE no_rkm_medis=?")
        .bind(&b.no_rm).fetch_one(&state.pool).await.map_err(db_err)?;
    let pernah_igd: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa WHERE no_rkm_medis=? AND kd_poli='IGDK'")
        .bind(&b.no_rm).fetch_one(&state.pool).await.map_err(db_err)?;
    let stts_daftar = if pernah_reg > 0 { "Lama" } else { "Baru" };
    let status_poli = if pernah_igd > 0 { "Lama" } else { "Baru" };

    // Biaya registrasi dari poliklinik IGDK
    let biaya_row: Option<(f64, f64)> = sqlx::query_as(
        "SELECT CAST(IFNULL(registrasi,0) AS DOUBLE), CAST(IFNULL(registrasilama,0) AS DOUBLE)
         FROM poliklinik WHERE kd_poli='IGDK' LIMIT 1")
        .fetch_optional(&state.pool).await.map_err(db_err)?;
    let biaya_reg = match biaya_row {
        Some((baru, lama)) => if stts_daftar == "Baru" { baru } else { lama },
        None => 0.0,
    };

    // Umur
    let umur: Option<(Option<i32>,)> = sqlx::query_as(
        "SELECT TIMESTAMPDIFF(YEAR, tgl_lahir, ?) FROM pasien WHERE no_rkm_medis=?")
        .bind(&tgl).bind(&b.no_rm).fetch_optional(&state.pool).await.unwrap_or(None);
    let umurdaftar = umur.and_then(|(u,)| u).unwrap_or(0);

    // Generate no_rawat (6 digit, global per tanggal) + no_reg (3 digit, per IGDK per tanggal)
    let mut tx = state.pool.begin().await.map_err(db_err)?;
    let seq_rw: i64 = sqlx::query_scalar(
        "SELECT IFNULL(MAX(CAST(RIGHT(no_rawat,6) AS UNSIGNED)),0)+1 FROM reg_periksa WHERE tgl_registrasi=?")
        .bind(&tgl).fetch_one(&mut *tx).await.map_err(db_err)?;
    let no_rawat = format!("{}/{:06}", tgl.replace('-', "/"), seq_rw);
    let seq_reg: i64 = sqlx::query_scalar(
        "SELECT IFNULL(MAX(CAST(no_reg AS UNSIGNED)),0)+1 FROM reg_periksa WHERE tgl_registrasi=? AND kd_poli='IGDK'")
        .bind(&tgl).fetch_one(&mut *tx).await.map_err(db_err)?;
    let no_reg = format!("{:03}", seq_reg);

    let p_jawab = b.p_jawab.as_deref().unwrap_or("");
    let almt_pj = b.almt_pj.as_deref().unwrap_or("");
    let hubunganpj = b.hubunganpj.as_deref().unwrap_or("");

    sqlx::query(
        "INSERT INTO reg_periksa
         (no_rawat, no_reg, tgl_registrasi, jam_reg, kd_dokter, no_rkm_medis, kd_poli,
          p_jawab, almt_pj, hubunganpj, stts, stts_daftar, status_lanjut, kd_pj,
          umurdaftar, sttsumur, status_bayar, status_poli, biaya_reg)
         VALUES (?,?,?,?,?,?,'IGDK',?,?,?,'Belum',?,'Ralan',?,?,'Th','Belum Bayar',?,?)",
    )
    .bind(&no_rawat).bind(&no_reg).bind(&tgl).bind(&jam).bind(&b.kd_dokter).bind(&b.no_rm)
    .bind(p_jawab).bind(almt_pj).bind(hubunganpj).bind(stts_daftar).bind(&b.kd_pj)
    .bind(umurdaftar).bind(status_poli).bind(biaya_reg)
    .execute(&mut *tx).await.map_err(db_err)?;

    tx.commit().await.map_err(db_err)?;

    use crate::audit::q;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO reg_periksa (no_rawat, no_reg, tgl_registrasi, jam_reg, kd_dokter, no_rkm_medis, kd_poli, p_jawab, almt_pj, hubunganpj, stts, stts_daftar, status_lanjut, kd_pj, umurdaftar, sttsumur, status_bayar, status_poli, biaya_reg) VALUES ({},{},{},{},{},{},'IGDK',{},{},{},'Belum',{},'Ralan',{},{},'Th','Belum Bayar',{},{})",
        q(&no_rawat), q(&no_reg), q(&tgl), q(&jam), q(&b.kd_dokter), q(&b.no_rm),
        q(p_jawab), q(almt_pj), q(hubunganpj), q(stts_daftar), q(&b.kd_pj),
        umurdaftar, q(status_poli), biaya_reg,
    )).await;

    Ok(Json(json!({
        "ok": true, "no_rawat": no_rawat, "no_reg": no_reg,
        "stts_daftar": stts_daftar, "status_poli": status_poli, "biaya_reg": biaya_reg,
        "message": "Registrasi IGD berhasil"
    })))
}

// ── Edit registrasi IGD (dokter/penjab/PJ) ───────────────────────────────────
#[derive(Deserialize)]
pub struct EditIgdBody {
    pub no_rawat: String,
    pub kd_dokter: String,
    pub kd_pj: String,
    pub p_jawab: Option<String>,
    pub almt_pj: Option<String>,
    pub hubunganpj: Option<String>,
}
pub async fn edit(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<EditIgdBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_rawat.trim().is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "no_rawat wajib"));
    }
    let p_jawab = b.p_jawab.as_deref().unwrap_or("");
    let almt_pj = b.almt_pj.as_deref().unwrap_or("");
    let hubunganpj = b.hubunganpj.as_deref().unwrap_or("");
    let r = sqlx::query(
        "UPDATE reg_periksa SET kd_dokter=?, kd_pj=?, p_jawab=?, almt_pj=?, hubunganpj=?
         WHERE no_rawat=? AND kd_poli='IGDK'",
    )
    .bind(&b.kd_dokter).bind(&b.kd_pj).bind(p_jawab).bind(almt_pj).bind(hubunganpj).bind(&b.no_rawat)
    .execute(&state.pool).await.map_err(db_err)?;
    if r.rows_affected() == 0 {
        return Err(err(StatusCode::NOT_FOUND, "Registrasi IGD tidak ditemukan"));
    }
    use crate::audit::q;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE reg_periksa SET kd_dokter={}, kd_pj={}, p_jawab={}, almt_pj={}, hubunganpj={} WHERE no_rawat={} AND kd_poli='IGDK'",
        q(&b.kd_dokter), q(&b.kd_pj), q(p_jawab), q(almt_pj), q(hubunganpj), q(&b.no_rawat),
    )).await;
    Ok(Json(json!({ "ok": true, "message": "Registrasi IGD diperbarui" })))
}

// ── Hapus/Batal registrasi IGD ───────────────────────────────────────────────
#[derive(Deserialize)]
pub struct HapusIgdQuery {
    pub no_rawat: String,
}
pub async fn hapus(
    user: AuthUser,
    State(state): State<AppState>,
    Query(qp): Query<HapusIgdQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if qp.no_rawat.trim().is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "no_rawat wajib"));
    }
    // Guard: tolak bila sudah ada rekam medis/transaksi turunan (aman utk Fase 1)
    let ada_triase: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM penilaian_medis_igd WHERE no_rawat=?")
        .bind(&qp.no_rawat).fetch_one(&state.pool).await.unwrap_or(0);
    if ada_triase > 0 {
        return Err(err(StatusCode::CONFLICT, "Sudah ada asesmen medis IGD — tidak bisa dihapus dari sini."));
    }
    let r = sqlx::query("DELETE FROM reg_periksa WHERE no_rawat=? AND kd_poli='IGDK'")
        .bind(&qp.no_rawat).execute(&state.pool).await.map_err(db_err)?;
    if r.rows_affected() == 0 {
        return Err(err(StatusCode::NOT_FOUND, "Registrasi IGD tidak ditemukan"));
    }
    use crate::audit::q;
    crate::audit::log_sql(&state.pool, &user.0.kode,
        &format!("DELETE FROM reg_periksa WHERE no_rawat={} AND kd_poli='IGDK'", q(&qp.no_rawat))).await;
    Ok(Json(json!({ "ok": true, "message": "Registrasi IGD dihapus" })))
}
