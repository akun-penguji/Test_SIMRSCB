use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))
}

// ── Row struct ────────────────────────────────────────────────────────────────
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct KbPelayananRow {
    pub id:                Option<i32>,
    pub no_rawat:          Option<String>,
    pub no_rkm_medis:      String,
    pub nama_pasien:       Option<String>,
    pub tanggal:           String,    // YYYY-MM-DD
    pub jam:               Option<String>,
    pub metode:            String,
    pub jenis_pelayanan:   String,
    pub komplikasi:        i8,
    pub ket_komplikasi:    Option<String>,
    pub kegagalan:         i8,
    pub ket_kegagalan:     Option<String>,
    pub efek_samping:      i8,
    pub ket_efek_samping:  Option<String>,
    pub drop_out:          i8,
    pub ket_drop_out:      Option<String>,
    pub catatan:           Option<String>,
    pub nip:               Option<String>,
    pub created_at:        Option<String>,
    pub updated_at:        Option<String>,
    pub updated_by:        Option<String>,
}

// ── GET /api/kb-pelayanan ─────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct ListQuery {
    pub tahun:    Option<String>,   // YYYY (default current year)
    pub bulan:    Option<String>,   // YYYY-MM (overrides tahun)
    pub metode:   Option<String>,
    pub no_rkm:   Option<String>,
    pub no_rawat: Option<String>,
}

pub async fn list_kb(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let (from, to) = match q.bulan.as_deref().filter(|s| s.len() == 7) {
        Some(b) => {
            let (yr_s, mo_s) = (&b[..4], &b[5..7]);
            let yr: i32 = yr_s.parse().unwrap_or(2026);
            let mo: u32 = mo_s.parse().unwrap_or(1);
            let nm = if mo == 12 { chrono::NaiveDate::from_ymd_opt(yr+1,1,1).unwrap() }
                     else { chrono::NaiveDate::from_ymd_opt(yr,mo+1,1).unwrap() };
            let to = (nm - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
            (format!("{}-01", b), to)
        }
        None => {
            let yr = q.tahun.as_deref().filter(|s| s.len() == 4)
                .unwrap_or(&chrono::Local::now().format("%Y").to_string()).to_string();
            (format!("{}-01-01", yr), format!("{}-12-31", yr))
        }
    };

    let metode = q.metode.clone().filter(|s| !s.trim().is_empty());
    let no_rkm = q.no_rkm.clone().filter(|s| !s.trim().is_empty());
    let no_rawat = q.no_rawat.clone().filter(|s| !s.trim().is_empty());

    let rows: Vec<KbPelayananRow> = sqlx::query_as(
        "SELECT id, no_rawat, no_rkm_medis, nama_pasien,
                DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal,
                TIME_FORMAT(jam,'%H:%i') AS jam,
                metode, jenis_pelayanan,
                komplikasi, ket_komplikasi,
                kegagalan, ket_kegagalan,
                efek_samping, ket_efek_samping,
                drop_out, ket_drop_out,
                catatan, nip,
                DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM simrscb_kb_pelayanan
         WHERE tanggal BETWEEN ? AND ?
           AND (? IS NULL OR metode = ?)
           AND (? IS NULL OR no_rkm_medis = ?)
           AND (? IS NULL OR no_rawat = ?)
         ORDER BY tanggal DESC, jam DESC"
    )
    .bind(&from).bind(&to)
    .bind(&metode).bind(&metode)
    .bind(&no_rkm).bind(&no_rkm)
    .bind(&no_rawat).bind(&no_rawat)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    Ok(Json(json!({ "data": rows, "from": from, "to": to })))
}

pub async fn detail_kb(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row: Option<KbPelayananRow> = sqlx::query_as(
        "SELECT id, no_rawat, no_rkm_medis, nama_pasien,
                DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal,
                TIME_FORMAT(jam,'%H:%i') AS jam,
                metode, jenis_pelayanan,
                komplikasi, ket_komplikasi,
                kegagalan, ket_kegagalan,
                efek_samping, ket_efek_samping,
                drop_out, ket_drop_out,
                catatan, nip,
                DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at,
                updated_by
         FROM simrscb_kb_pelayanan WHERE id=?"
    )
    .bind(id)
    .fetch_optional(&state.pool).await.map_err(db_err)?;
    match row {
        Some(r) => Ok(Json(json!({ "data": r }))),
        None    => Err((StatusCode::NOT_FOUND, Json(json!({ "error": "tidak ditemukan" })))),
    }
}

pub async fn create_kb(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<KbPelayananRow>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Validasi minimal
    if body.no_rkm_medis.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "no_rkm_medis wajib diisi" }))));
    }
    if body.tanggal.len() != 10 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "tanggal harus format YYYY-MM-DD" }))));
    }

    let res = sqlx::query(
        "INSERT INTO simrscb_kb_pelayanan
          (no_rawat, no_rkm_medis, nama_pasien, tanggal, jam, metode, jenis_pelayanan,
           komplikasi, ket_komplikasi, kegagalan, ket_kegagalan,
           efek_samping, ket_efek_samping, drop_out, ket_drop_out,
           catatan, nip, updated_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    )
    .bind(&body.no_rawat)
    .bind(&body.no_rkm_medis)
    .bind(&body.nama_pasien)
    .bind(&body.tanggal)
    .bind(&body.jam)
    .bind(&body.metode)
    .bind(&body.jenis_pelayanan)
    .bind(body.komplikasi)
    .bind(&body.ket_komplikasi)
    .bind(body.kegagalan)
    .bind(&body.ket_kegagalan)
    .bind(body.efek_samping)
    .bind(&body.ket_efek_samping)
    .bind(body.drop_out)
    .bind(&body.ket_drop_out)
    .bind(&body.catatan)
    .bind(&body.nip)
    .bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;

    use crate::audit::{q, qo};
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO simrscb_kb_pelayanan (no_rawat, no_rkm_medis, nama_pasien, tanggal, jam, metode, jenis_pelayanan, komplikasi, ket_komplikasi, kegagalan, ket_kegagalan, efek_samping, ket_efek_samping, drop_out, ket_drop_out, catatan, nip, updated_by) VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})",
        qo(body.no_rawat.as_ref()), q(&body.no_rkm_medis), qo(body.nama_pasien.as_ref()), q(&body.tanggal), qo(body.jam.as_ref()),
        q(&body.metode), q(&body.jenis_pelayanan),
        body.komplikasi, qo(body.ket_komplikasi.as_ref()), body.kegagalan, qo(body.ket_kegagalan.as_ref()),
        body.efek_samping, qo(body.ket_efek_samping.as_ref()), body.drop_out, qo(body.ket_drop_out.as_ref()),
        qo(body.catatan.as_ref()), qo(body.nip.as_ref()), q(&user.0.kode)
    )).await;

    Ok(Json(json!({ "success": true, "id": res.last_insert_id() })))
}

pub async fn update_kb(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(body): Json<KbPelayananRow>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query(
        "UPDATE simrscb_kb_pelayanan SET
           no_rawat=?, no_rkm_medis=?, nama_pasien=?, tanggal=?, jam=?,
           metode=?, jenis_pelayanan=?,
           komplikasi=?, ket_komplikasi=?, kegagalan=?, ket_kegagalan=?,
           efek_samping=?, ket_efek_samping=?, drop_out=?, ket_drop_out=?,
           catatan=?, nip=?, updated_by=?
         WHERE id=?"
    )
    .bind(&body.no_rawat)
    .bind(&body.no_rkm_medis)
    .bind(&body.nama_pasien)
    .bind(&body.tanggal)
    .bind(&body.jam)
    .bind(&body.metode)
    .bind(&body.jenis_pelayanan)
    .bind(body.komplikasi)
    .bind(&body.ket_komplikasi)
    .bind(body.kegagalan)
    .bind(&body.ket_kegagalan)
    .bind(body.efek_samping)
    .bind(&body.ket_efek_samping)
    .bind(body.drop_out)
    .bind(&body.ket_drop_out)
    .bind(&body.catatan)
    .bind(&body.nip)
    .bind(&user.0.kode)
    .bind(id)
    .execute(&state.pool).await.map_err(db_err)?;

    use crate::audit::{q, qo};
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE simrscb_kb_pelayanan SET no_rawat={}, no_rkm_medis={}, nama_pasien={}, tanggal={}, jam={}, metode={}, jenis_pelayanan={}, komplikasi={}, ket_komplikasi={}, kegagalan={}, ket_kegagalan={}, efek_samping={}, ket_efek_samping={}, drop_out={}, ket_drop_out={}, catatan={}, nip={}, updated_by={} WHERE id={}",
        qo(body.no_rawat.as_ref()), q(&body.no_rkm_medis), qo(body.nama_pasien.as_ref()), q(&body.tanggal), qo(body.jam.as_ref()),
        q(&body.metode), q(&body.jenis_pelayanan),
        body.komplikasi, qo(body.ket_komplikasi.as_ref()), body.kegagalan, qo(body.ket_kegagalan.as_ref()),
        body.efek_samping, qo(body.ket_efek_samping.as_ref()), body.drop_out, qo(body.ket_drop_out.as_ref()),
        qo(body.catatan.as_ref()), qo(body.nip.as_ref()), q(&user.0.kode), id
    )).await;

    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

pub async fn delete_kb(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let res = sqlx::query("DELETE FROM simrscb_kb_pelayanan WHERE id=?")
        .bind(id)
        .execute(&state.pool).await.map_err(db_err)?;

    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "DELETE FROM simrscb_kb_pelayanan WHERE id={}", id
    )).await;

    Ok(Json(json!({ "success": res.rows_affected() > 0 })))
}

// ── GET /api/kb-pelayanan/lookup-pasien?q=X — search Khanza pasien by RM/nama
#[derive(Deserialize)]
pub struct LookupQuery {
    pub q: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PasienLookupRow {
    pub no_rkm_medis: String,
    pub nm_pasien:    Option<String>,
    pub jk:           Option<String>,
    pub tgl_lahir:    Option<String>,
}

pub async fn lookup_pasien(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<LookupQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let qs = q.q.unwrap_or_default();
    if qs.trim().len() < 2 {
        return Ok(Json(json!({ "data": [] })));
    }
    let like = format!("%{}%", qs.trim());
    let rows: Vec<PasienLookupRow> = sqlx::query_as(
        "SELECT no_rkm_medis, nm_pasien, jk,
                DATE_FORMAT(tgl_lahir,'%Y-%m-%d') AS tgl_lahir
         FROM pasien
         WHERE no_rkm_medis = ? OR no_rkm_medis LIKE ? OR nm_pasien LIKE ?
         ORDER BY no_rkm_medis DESC LIMIT 20"
    )
    .bind(&qs).bind(&like).bind(&like)
    .fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(json!({ "data": rows })))
}

// ── GET /api/kb-pelayanan/agregat?tahun=YYYY — per-metode/jenis aggregation
// Untuk feed RL 3.16
#[derive(Deserialize)]
pub struct AgregatQuery {
    pub tahun: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct KbAgregatRow {
    pub metode:           String,
    pub jenis_pelayanan:  String,
    pub jml:              i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct KbAgregatEfekRow {
    pub metode:        String,
    pub komplikasi:    i64,
    pub kegagalan:     i64,
    pub efek_samping:  i64,
    pub drop_out:      i64,
}

pub async fn agregat_kb(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<AgregatQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.clone().filter(|s| s.len() == 4)
        .unwrap_or_else(|| chrono::Local::now().format("%Y").to_string());
    let from = format!("{}-01-01", tahun);
    let to   = format!("{}-12-31", tahun);

    let by_jenis: Vec<KbAgregatRow> = sqlx::query_as(
        "SELECT metode, jenis_pelayanan, CAST(COUNT(*) AS SIGNED) AS jml
         FROM simrscb_kb_pelayanan
         WHERE tanggal BETWEEN ? AND ?
         GROUP BY metode, jenis_pelayanan"
    )
    .bind(&from).bind(&to)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    let by_efek: Vec<KbAgregatEfekRow> = sqlx::query_as(
        "SELECT metode,
                CAST(SUM(komplikasi)   AS SIGNED) AS komplikasi,
                CAST(SUM(kegagalan)    AS SIGNED) AS kegagalan,
                CAST(SUM(efek_samping) AS SIGNED) AS efek_samping,
                CAST(SUM(drop_out)     AS SIGNED) AS drop_out
         FROM simrscb_kb_pelayanan
         WHERE tanggal BETWEEN ? AND ?
         GROUP BY metode"
    )
    .bind(&from).bind(&to)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM simrscb_kb_pelayanan WHERE tanggal BETWEEN ? AND ?"
    ).bind(&from).bind(&to)
     .fetch_one(&state.pool).await.unwrap_or(0);

    Ok(Json(json!({
        "tahun": tahun,
        "total": total,
        "by_jenis": by_jenis,
        "by_efek": by_efek,
    })))
}
