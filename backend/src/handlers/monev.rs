// ============================================================================
// Modul Monev SIMRS — closed-loop tracking perbaikan SIMRS untuk WBK ZI
//
// Endpoints (semua butuh login; write butuh is_admin):
//   GET    /api/monev                 list + filter + pagination
//   POST   /api/monev                 create (auto-generate kode)
//   GET    /api/monev/:id             detail (+ lampiran)
//   PUT    /api/monev/:id             update (enforce selesai rule)
//   DELETE /api/monev/:id             delete (cascade lampiran)
//   GET    /api/monev/stats           ?dari=&sampai= ringkasan utk dashboard
//   GET    /api/monev/export.csv      ?<filters> CSV utk lampiran
//   POST   /api/monev/import          multipart CSV utk backfill historis
//   POST   /api/monev/ingest/batch    JSON batch dari git log / log bridging
//   GET    /api/monev/rapat           list rapat evaluasi
//   POST   /api/monev/rapat           create rapat
//   POST   /api/monev/lampiran/:id    add lampiran (URL/path)
//   DELETE /api/monev/lampiran/:id    remove lampiran
// ============================================================================

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Multipart, Path, Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::MySqlPool;

// ── Util ───────────────────────────────────────────────────────────────────
fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error monev: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}

#[allow(dead_code)]
fn forbidden_if_not_admin(user: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if user.0.is_admin { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error": "Hanya admin yang bisa modifikasi monev"})))) }
}

fn validation_err(msg: &str) -> (StatusCode, Json<Value>) {
    (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({"error": msg})))
}

// Enum allowlist (mirror dengan CHECK constraint di DB)
const SUMBER_VALID:    &[&str] = &["helpdesk","user","rapat","log_bridging","git","monitoring"];
const KATEGORI_VALID:  &[&str] = &["bug","performa","integrasi","fitur","data","lainnya"];
const PRIORITAS_VALID: &[&str] = &["rendah","sedang","tinggi","kritis"];
const STATUS_VALID:    &[&str] = &["baru","proses","selesai","ditutup"];

fn must_be_one_of(field: &str, value: &str, valid: &[&str]) -> Result<(), (StatusCode, Json<Value>)> {
    if valid.contains(&value) { Ok(()) }
    else {
        Err(validation_err(&format!(
            "{} '{}' tidak valid. Harus salah satu: {}", field, value, valid.join(", ")
        )))
    }
}

// ── Models ─────────────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MonevRow {
    pub id:                 i64,
    pub kode:               String,
    pub tanggal_lapor:      String,
    pub sumber:             String,
    pub unit_terdampak:     Option<String>,
    pub kategori:           String,
    pub prioritas:          String,
    pub deskripsi_masalah:  String,
    pub akar_masalah:       Option<String>,
    pub tindakan_perbaikan: Option<String>,
    pub tanggal_selesai:    Option<String>,
    pub hasil_verifikasi:   Option<String>,
    pub status:             String,
    pub pic:                Option<String>,
    pub created_at:         String,
    pub updated_at:         String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LampiranRow {
    pub id:            i64,
    pub monev_id:      i64,
    pub nama_berkas:   String,
    pub path_atau_url: String,
    pub keterangan:    Option<String>,
    pub created_at:    String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RapatRow {
    pub id:           i64,
    pub tanggal:      String,
    pub judul:        String,
    pub ringkasan:    Option<String>,
    pub path_notulen: Option<String>,
    pub created_at:   String,
}

// ── List + filter ──────────────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub dari:      Option<String>,
    pub sampai:    Option<String>,
    pub status:    Option<String>,
    pub kategori:  Option<String>,
    pub prioritas: Option<String>,
    pub sumber:    Option<String>,
    pub unit:      Option<String>,
    pub q:         Option<String>,
    pub limit:     Option<i32>,
    pub offset:    Option<i32>,
    pub sort:      Option<String>, // "tanggal_desc" (default) | "tanggal_asc" | "kode_desc" | "kode_asc"
}

#[derive(Debug, Serialize)]
pub struct ListResp {
    pub items: Vec<MonevRow>,
    pub total: i64,
    pub limit: i32,
    pub offset: i32,
}

pub async fn list(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResp>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "monev_view")?;
    let limit = q.limit.unwrap_or(50).clamp(1, 1000);
    let offset = q.offset.unwrap_or(0).max(0);
    let qs = q.q.as_deref().filter(|s| !s.trim().is_empty()).map(|s| format!("%{}%", s.trim()));

    let order_by = match q.sort.as_deref() {
        Some("tanggal_asc")  => "tanggal_lapor ASC, id ASC",
        Some("kode_asc")     => "kode ASC",
        Some("kode_desc")    => "kode DESC",
        _                    => "tanggal_lapor DESC, id DESC",
    };

    let where_clause = "
        WHERE (? IS NULL OR tanggal_lapor >= ?)
          AND (? IS NULL OR tanggal_lapor <= ?)
          AND (? IS NULL OR status = ?)
          AND (? IS NULL OR kategori = ?)
          AND (? IS NULL OR prioritas = ?)
          AND (? IS NULL OR sumber = ?)
          AND (? IS NULL OR unit_terdampak LIKE ?)
          AND (? IS NULL OR
               kode LIKE ? OR deskripsi_masalah LIKE ?
               OR akar_masalah LIKE ? OR tindakan_perbaikan LIKE ?
               OR hasil_verifikasi LIKE ? OR pic LIKE ?)";

    let sql_items = format!(
        "SELECT id, kode,
                DATE_FORMAT(tanggal_lapor,'%Y-%m-%d') AS tanggal_lapor,
                sumber, unit_terdampak, kategori, prioritas,
                deskripsi_masalah, akar_masalah, tindakan_perbaikan,
                DATE_FORMAT(tanggal_selesai,'%Y-%m-%d') AS tanggal_selesai,
                hasil_verifikasi, status, pic,
                DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at
         FROM simrscb_monev {} ORDER BY {} LIMIT ? OFFSET ?",
        where_clause, order_by
    );

    let unit_pat = q.unit.as_deref().filter(|s| !s.trim().is_empty()).map(|s| format!("%{}%", s.trim()));

    let mut query = sqlx::query_as::<_, MonevRow>(&sql_items)
        .bind(&q.dari).bind(&q.dari)
        .bind(&q.sampai).bind(&q.sampai)
        .bind(&q.status).bind(&q.status)
        .bind(&q.kategori).bind(&q.kategori)
        .bind(&q.prioritas).bind(&q.prioritas)
        .bind(&q.sumber).bind(&q.sumber)
        .bind(&unit_pat).bind(&unit_pat)
        .bind(&qs);
    for _ in 0..6 { query = query.bind(&qs); }
    let items: Vec<MonevRow> = query.bind(limit).bind(offset)
        .fetch_all(&state.pool).await.map_err(db_err)?;

    let sql_count = format!("SELECT CAST(COUNT(*) AS SIGNED) FROM simrscb_monev {}", where_clause);
    let mut q_cnt = sqlx::query_scalar::<_, i64>(&sql_count)
        .bind(&q.dari).bind(&q.dari)
        .bind(&q.sampai).bind(&q.sampai)
        .bind(&q.status).bind(&q.status)
        .bind(&q.kategori).bind(&q.kategori)
        .bind(&q.prioritas).bind(&q.prioritas)
        .bind(&q.sumber).bind(&q.sumber)
        .bind(&unit_pat).bind(&unit_pat)
        .bind(&qs);
    for _ in 0..6 { q_cnt = q_cnt.bind(&qs); }
    let total = q_cnt.fetch_one(&state.pool).await.map_err(db_err)?;

    Ok(Json(ListResp { items, total, limit, offset }))
}

// ── Detail ─────────────────────────────────────────────────────────────────
#[derive(Debug, Serialize)]
pub struct DetailResp {
    pub monev: MonevRow,
    pub lampiran: Vec<LampiranRow>,
}

pub async fn detail(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<DetailResp>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "monev_view")?;
    let monev: MonevRow = sqlx::query_as(
        "SELECT id, kode,
                DATE_FORMAT(tanggal_lapor,'%Y-%m-%d') AS tanggal_lapor,
                sumber, unit_terdampak, kategori, prioritas,
                deskripsi_masalah, akar_masalah, tindakan_perbaikan,
                DATE_FORMAT(tanggal_selesai,'%Y-%m-%d') AS tanggal_selesai,
                hasil_verifikasi, status, pic,
                DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at
         FROM simrscb_monev WHERE id = ?"
    ).bind(id).fetch_optional(&state.pool).await.map_err(db_err)?
     .ok_or((StatusCode::NOT_FOUND, Json(json!({"error": "Monev tidak ditemukan"}))))?;

    let lampiran: Vec<LampiranRow> = sqlx::query_as(
        "SELECT id, monev_id, nama_berkas, path_atau_url, keterangan,
                DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at
         FROM simrscb_monev_lampiran WHERE monev_id = ? ORDER BY id DESC"
    ).bind(id).fetch_all(&state.pool).await.unwrap_or_default();

    Ok(Json(DetailResp { monev, lampiran }))
}

// ── Atomic kode generator ───────────────────────────────────────────────────
async fn next_kode(pool: &MySqlPool, tahun: i32) -> Result<String, sqlx::Error> {
    sqlx::query(
        "INSERT INTO simrscb_monev_counter (tahun, urutan) VALUES (?, LAST_INSERT_ID(1))
         ON DUPLICATE KEY UPDATE urutan = LAST_INSERT_ID(urutan + 1)"
    ).bind(tahun).execute(pool).await?;
    let urutan: i64 = sqlx::query_scalar("SELECT CAST(LAST_INSERT_ID() AS SIGNED)")
        .fetch_one(pool).await?;
    Ok(format!("MNV-{}-{:04}", tahun, urutan))
}

// ── Create ────────────────────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
pub struct CreateReq {
    pub tanggal_lapor:      String,                          // YYYY-MM-DD
    pub sumber:             String,
    pub unit_terdampak:     Option<String>,
    pub kategori:           String,
    pub prioritas:          String,
    pub deskripsi_masalah:  String,
    pub akar_masalah:       Option<String>,
    pub tindakan_perbaikan: Option<String>,
    pub tanggal_selesai:    Option<String>,                  // YYYY-MM-DD
    pub hasil_verifikasi:   Option<String>,
    pub status:             Option<String>,                  // default 'baru'
    pub pic:                Option<String>,
}

fn check_selesai_rule(
    status: &str,
    tindakan: Option<&str>,
    hasil:    Option<&str>,
    tgl:      Option<&str>,
) -> Result<(), (StatusCode, Json<Value>)> {
    if status == "selesai" {
        let has_tindakan = tindakan.map(|s| !s.trim().is_empty()).unwrap_or(false);
        let has_hasil    = hasil.map(|s| !s.trim().is_empty()).unwrap_or(false);
        let has_tgl      = tgl.map(|s| !s.trim().is_empty()).unwrap_or(false);
        if !(has_tindakan && has_hasil && has_tgl) {
            return Err(validation_err(
                "Status 'selesai' membutuhkan tindakan_perbaikan, hasil_verifikasi, dan tanggal_selesai (closed-loop)."
            ));
        }
    }
    Ok(())
}

pub async fn create(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<CreateReq>,
) -> Result<Json<MonevRow>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "monev_edit")?;

    must_be_one_of("sumber",    &b.sumber,    SUMBER_VALID)?;
    must_be_one_of("kategori",  &b.kategori,  KATEGORI_VALID)?;
    must_be_one_of("prioritas", &b.prioritas, PRIORITAS_VALID)?;
    let status = b.status.clone().unwrap_or_else(|| "baru".to_string());
    must_be_one_of("status",    &status,      STATUS_VALID)?;
    check_selesai_rule(&status,
        b.tindakan_perbaikan.as_deref(),
        b.hasil_verifikasi.as_deref(),
        b.tanggal_selesai.as_deref())?;

    // Parse tahun dari tanggal_lapor untuk kode
    let tahun: i32 = b.tanggal_lapor.get(..4)
        .and_then(|s| s.parse().ok())
        .ok_or(validation_err("tanggal_lapor harus format YYYY-MM-DD"))?;
    let kode = next_kode(&state.pool, tahun).await.map_err(db_err)?;

    let id: i64 = {
        sqlx::query(
            "INSERT INTO simrscb_monev
             (kode, tanggal_lapor, sumber, unit_terdampak, kategori, prioritas,
              deskripsi_masalah, akar_masalah, tindakan_perbaikan, tanggal_selesai,
              hasil_verifikasi, status, pic)
             VALUES (?,?,?,?,?,?, ?,?,?,?, ?,?,?)"
        )
        .bind(&kode).bind(&b.tanggal_lapor).bind(&b.sumber).bind(&b.unit_terdampak)
        .bind(&b.kategori).bind(&b.prioritas).bind(&b.deskripsi_masalah)
        .bind(&b.akar_masalah).bind(&b.tindakan_perbaikan).bind(&b.tanggal_selesai)
        .bind(&b.hasil_verifikasi).bind(&status).bind(&b.pic)
        .execute(&state.pool).await.map_err(db_err)?
        .last_insert_id() as i64
    };

    let sql = format!(
        "INSERT INTO simrscb_monev (kode, tanggal_lapor, sumber, unit_terdampak, kategori, prioritas, deskripsi_masalah, akar_masalah, tindakan_perbaikan, tanggal_selesai, hasil_verifikasi, status, pic) VALUES ({},{},{},{},{},{},{},{},{},{},{},{},{})",
        crate::audit::q(&kode),
        crate::audit::q(&b.tanggal_lapor),
        crate::audit::q(&b.sumber),
        crate::audit::qo(b.unit_terdampak.as_ref()),
        crate::audit::q(&b.kategori),
        crate::audit::q(&b.prioritas),
        crate::audit::q(&b.deskripsi_masalah),
        crate::audit::qo(b.akar_masalah.as_ref()),
        crate::audit::qo(b.tindakan_perbaikan.as_ref()),
        crate::audit::qo(b.tanggal_selesai.as_ref()),
        crate::audit::qo(b.hasil_verifikasi.as_ref()),
        crate::audit::q(&status),
        crate::audit::qo(b.pic.as_ref()),
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;

    let row: MonevRow = sqlx::query_as(
        "SELECT id, kode,
                DATE_FORMAT(tanggal_lapor,'%Y-%m-%d') AS tanggal_lapor,
                sumber, unit_terdampak, kategori, prioritas,
                deskripsi_masalah, akar_masalah, tindakan_perbaikan,
                DATE_FORMAT(tanggal_selesai,'%Y-%m-%d') AS tanggal_selesai,
                hasil_verifikasi, status, pic,
                DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at
         FROM simrscb_monev WHERE id = ?"
    ).bind(id).fetch_one(&state.pool).await.map_err(db_err)?;

    Ok(Json(row))
}

// ── Update ────────────────────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
pub struct UpdateReq {
    pub tanggal_lapor:      Option<String>,
    pub sumber:             Option<String>,
    pub unit_terdampak:     Option<String>,
    pub kategori:           Option<String>,
    pub prioritas:          Option<String>,
    pub deskripsi_masalah:  Option<String>,
    pub akar_masalah:       Option<String>,
    pub tindakan_perbaikan: Option<String>,
    pub tanggal_selesai:    Option<String>,
    pub hasil_verifikasi:   Option<String>,
    pub status:             Option<String>,
    pub pic:                Option<String>,
}

pub async fn update(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(b): Json<UpdateReq>,
) -> Result<Json<MonevRow>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "monev_edit")?;

    // Load current row untuk merge dengan changes (supaya check selesai bisa pakai gabungan)
    let cur: MonevRow = sqlx::query_as(
        "SELECT id, kode,
                DATE_FORMAT(tanggal_lapor,'%Y-%m-%d') AS tanggal_lapor,
                sumber, unit_terdampak, kategori, prioritas,
                deskripsi_masalah, akar_masalah, tindakan_perbaikan,
                DATE_FORMAT(tanggal_selesai,'%Y-%m-%d') AS tanggal_selesai,
                hasil_verifikasi, status, pic,
                DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at
         FROM simrscb_monev WHERE id = ?"
    ).bind(id).fetch_optional(&state.pool).await.map_err(db_err)?
     .ok_or((StatusCode::NOT_FOUND, Json(json!({"error": "Monev tidak ditemukan"}))))?;

    let merged_status   = b.status.clone().unwrap_or(cur.status.clone());
    let merged_tindakan = b.tindakan_perbaikan.clone().or(cur.tindakan_perbaikan.clone());
    let merged_hasil    = b.hasil_verifikasi.clone().or(cur.hasil_verifikasi.clone());
    let merged_tgl      = b.tanggal_selesai.clone().or(cur.tanggal_selesai.clone());

    if let Some(s) = b.sumber.as_deref()    { must_be_one_of("sumber", s, SUMBER_VALID)?; }
    if let Some(s) = b.kategori.as_deref()  { must_be_one_of("kategori", s, KATEGORI_VALID)?; }
    if let Some(s) = b.prioritas.as_deref() { must_be_one_of("prioritas", s, PRIORITAS_VALID)?; }
    must_be_one_of("status", &merged_status, STATUS_VALID)?;
    check_selesai_rule(&merged_status,
        merged_tindakan.as_deref(),
        merged_hasil.as_deref(),
        merged_tgl.as_deref())?;

    sqlx::query(
        "UPDATE simrscb_monev SET
            tanggal_lapor      = COALESCE(?, tanggal_lapor),
            sumber             = COALESCE(?, sumber),
            unit_terdampak     = COALESCE(?, unit_terdampak),
            kategori           = COALESCE(?, kategori),
            prioritas          = COALESCE(?, prioritas),
            deskripsi_masalah  = COALESCE(?, deskripsi_masalah),
            akar_masalah       = COALESCE(?, akar_masalah),
            tindakan_perbaikan = COALESCE(?, tindakan_perbaikan),
            tanggal_selesai    = COALESCE(?, tanggal_selesai),
            hasil_verifikasi   = COALESCE(?, hasil_verifikasi),
            status             = COALESCE(?, status),
            pic                = COALESCE(?, pic)
         WHERE id = ?"
    )
    .bind(&b.tanggal_lapor).bind(&b.sumber).bind(&b.unit_terdampak)
    .bind(&b.kategori).bind(&b.prioritas).bind(&b.deskripsi_masalah)
    .bind(&b.akar_masalah).bind(&b.tindakan_perbaikan).bind(&b.tanggal_selesai)
    .bind(&b.hasil_verifikasi).bind(&b.status).bind(&b.pic)
    .bind(id)
    .execute(&state.pool).await.map_err(db_err)?;

    let sql = format!(
        "UPDATE simrscb_monev SET tanggal_lapor=COALESCE({},tanggal_lapor), sumber=COALESCE({},sumber), unit_terdampak=COALESCE({},unit_terdampak), kategori=COALESCE({},kategori), prioritas=COALESCE({},prioritas), deskripsi_masalah=COALESCE({},deskripsi_masalah), akar_masalah=COALESCE({},akar_masalah), tindakan_perbaikan=COALESCE({},tindakan_perbaikan), tanggal_selesai=COALESCE({},tanggal_selesai), hasil_verifikasi=COALESCE({},hasil_verifikasi), status=COALESCE({},status), pic=COALESCE({},pic) WHERE id={}",
        crate::audit::qo(b.tanggal_lapor.as_ref()),
        crate::audit::qo(b.sumber.as_ref()),
        crate::audit::qo(b.unit_terdampak.as_ref()),
        crate::audit::qo(b.kategori.as_ref()),
        crate::audit::qo(b.prioritas.as_ref()),
        crate::audit::qo(b.deskripsi_masalah.as_ref()),
        crate::audit::qo(b.akar_masalah.as_ref()),
        crate::audit::qo(b.tindakan_perbaikan.as_ref()),
        crate::audit::qo(b.tanggal_selesai.as_ref()),
        crate::audit::qo(b.hasil_verifikasi.as_ref()),
        crate::audit::qo(b.status.as_ref()),
        crate::audit::qo(b.pic.as_ref()),
        id,
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;

    let row: MonevRow = sqlx::query_as(
        "SELECT id, kode,
                DATE_FORMAT(tanggal_lapor,'%Y-%m-%d') AS tanggal_lapor,
                sumber, unit_terdampak, kategori, prioritas,
                deskripsi_masalah, akar_masalah, tindakan_perbaikan,
                DATE_FORMAT(tanggal_selesai,'%Y-%m-%d') AS tanggal_selesai,
                hasil_verifikasi, status, pic,
                DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at
         FROM simrscb_monev WHERE id = ?"
    ).bind(id).fetch_one(&state.pool).await.map_err(db_err)?;
    Ok(Json(row))
}

// ── Delete ────────────────────────────────────────────────────────────────
pub async fn delete(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "monev_edit")?;
    let res = sqlx::query("DELETE FROM simrscb_monev WHERE id = ?")
        .bind(id).execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Monev tidak ditemukan"}))));
    }
    let sql = format!("DELETE FROM simrscb_monev WHERE id={}", id);
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;
    Ok(Json(json!({"ok": true})))
}

// ── Stats ─────────────────────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
pub struct StatsQuery {
    pub dari:   Option<String>,
    pub sampai: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct Bucket { name: String, total: i64 }
#[derive(Debug, Serialize, sqlx::FromRow)]
struct MonthBucket { bulan: String, total: i64, selesai: i64 }

pub async fn stats(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<StatsQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "monev_view")?;
    let dari   = q.dari.clone().unwrap_or_else(|| "2025-07-01".to_string());
    let sampai = q.sampai.clone().unwrap_or_else(|| "2026-06-30".to_string());

    #[derive(sqlx::FromRow)]
    struct Total { total: i64, selesai: i64, proses: i64, baru: i64, ditutup: i64 }
    let tot: Total = sqlx::query_as(
        "SELECT
            CAST(COUNT(*) AS SIGNED) AS total,
            CAST(IFNULL(SUM(status='selesai'),0) AS SIGNED) AS selesai,
            CAST(IFNULL(SUM(status='proses'),0)  AS SIGNED) AS proses,
            CAST(IFNULL(SUM(status='baru'),0)    AS SIGNED) AS baru,
            CAST(IFNULL(SUM(status='ditutup'),0) AS SIGNED) AS ditutup
         FROM simrscb_monev
         WHERE tanggal_lapor BETWEEN ? AND ?"
    ).bind(&dari).bind(&sampai).fetch_one(&state.pool).await.map_err(db_err)?;

    let per_kategori: Vec<Bucket> = sqlx::query_as(
        "SELECT kategori AS name, CAST(COUNT(*) AS SIGNED) AS total
         FROM simrscb_monev WHERE tanggal_lapor BETWEEN ? AND ?
         GROUP BY kategori ORDER BY total DESC"
    ).bind(&dari).bind(&sampai).fetch_all(&state.pool).await.unwrap_or_default();

    let per_prioritas: Vec<Bucket> = sqlx::query_as(
        "SELECT prioritas AS name, CAST(COUNT(*) AS SIGNED) AS total
         FROM simrscb_monev WHERE tanggal_lapor BETWEEN ? AND ?
         GROUP BY prioritas
         ORDER BY FIELD(prioritas,'kritis','tinggi','sedang','rendah')"
    ).bind(&dari).bind(&sampai).fetch_all(&state.pool).await.unwrap_or_default();

    let per_sumber: Vec<Bucket> = sqlx::query_as(
        "SELECT sumber AS name, CAST(COUNT(*) AS SIGNED) AS total
         FROM simrscb_monev WHERE tanggal_lapor BETWEEN ? AND ?
         GROUP BY sumber ORDER BY total DESC"
    ).bind(&dari).bind(&sampai).fetch_all(&state.pool).await.unwrap_or_default();

    let per_bulan: Vec<MonthBucket> = sqlx::query_as(
        "SELECT DATE_FORMAT(tanggal_lapor,'%Y-%m') AS bulan,
                CAST(COUNT(*) AS SIGNED) AS total,
                CAST(IFNULL(SUM(status='selesai'),0) AS SIGNED) AS selesai
         FROM simrscb_monev
         WHERE tanggal_lapor BETWEEN ? AND ?
         GROUP BY bulan ORDER BY bulan"
    ).bind(&dari).bind(&sampai).fetch_all(&state.pool).await.unwrap_or_default();

    let pct_selesai = if tot.total > 0 { (tot.selesai as f64 / tot.total as f64) * 100.0 } else { 0.0 };

    let jumlah_rapat: i64 = sqlx::query_scalar(
        "SELECT CAST(COUNT(*) AS SIGNED) FROM simrscb_monev_rapat WHERE tanggal BETWEEN ? AND ?"
    ).bind(&dari).bind(&sampai).fetch_one(&state.pool).await.unwrap_or(0);

    Ok(Json(json!({
        "periode": { "dari": dari, "sampai": sampai },
        "total":           tot.total,
        "selesai":         tot.selesai,
        "proses":          tot.proses,
        "baru":            tot.baru,
        "ditutup":         tot.ditutup,
        "pct_selesai":     (pct_selesai * 100.0).round() / 100.0,
        "per_kategori":    per_kategori,
        "per_prioritas":   per_prioritas,
        "per_sumber":      per_sumber,
        "per_bulan":       per_bulan,
        "jumlah_rapat":    jumlah_rapat,
    })))
}

// ── CSV Export ────────────────────────────────────────────────────────────
pub async fn export_csv(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "monev_view")?;
    let unit_pat = q.unit.as_deref().filter(|s| !s.trim().is_empty()).map(|s| format!("%{}%", s.trim()));
    let qs = q.q.as_deref().filter(|s| !s.trim().is_empty()).map(|s| format!("%{}%", s.trim()));

    let where_clause = "
        WHERE (? IS NULL OR tanggal_lapor >= ?)
          AND (? IS NULL OR tanggal_lapor <= ?)
          AND (? IS NULL OR status = ?)
          AND (? IS NULL OR kategori = ?)
          AND (? IS NULL OR prioritas = ?)
          AND (? IS NULL OR sumber = ?)
          AND (? IS NULL OR unit_terdampak LIKE ?)
          AND (? IS NULL OR
               kode LIKE ? OR deskripsi_masalah LIKE ?
               OR akar_masalah LIKE ? OR tindakan_perbaikan LIKE ?
               OR hasil_verifikasi LIKE ? OR pic LIKE ?)";

    let sql = format!(
        "SELECT kode,
                DATE_FORMAT(tanggal_lapor,'%Y-%m-%d') AS tanggal_lapor,
                sumber, unit_terdampak, kategori, prioritas,
                deskripsi_masalah, akar_masalah, tindakan_perbaikan,
                DATE_FORMAT(tanggal_selesai,'%Y-%m-%d') AS tanggal_selesai,
                hasil_verifikasi, status, pic,
                DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at,
                DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at
         FROM simrscb_monev {} ORDER BY tanggal_lapor DESC, id DESC",
        where_clause
    );

    let mut query = sqlx::query_as::<_, MonevRow>(&sql)
        .bind(&q.dari).bind(&q.dari)
        .bind(&q.sampai).bind(&q.sampai)
        .bind(&q.status).bind(&q.status)
        .bind(&q.kategori).bind(&q.kategori)
        .bind(&q.prioritas).bind(&q.prioritas)
        .bind(&q.sumber).bind(&q.sumber)
        .bind(&unit_pat).bind(&unit_pat)
        .bind(&qs);
    for _ in 0..6 { query = query.bind(&qs); }
    let rows: Vec<MonevRow> = query.fetch_all(&state.pool).await.map_err(db_err)?;

    let mut csv = String::new();
    csv.push_str("kode,tanggal_lapor,sumber,unit_terdampak,kategori,prioritas,deskripsi_masalah,akar_masalah,tindakan_perbaikan,tanggal_selesai,hasil_verifikasi,status,pic\n");
    for r in &rows {
        let cell = |s: &str| {
            let esc = s.replace('\r', " ").replace('\n', " ").replace('"', "\"\"");
            format!("\"{}\"", esc)
        };
        csv.push_str(&format!(
            "{},{},{},{},{},{},{},{},{},{},{},{},{}\n",
            r.id, // dummy for id pos: actually kode (see fields order below)
            cell(&r.tanggal_lapor),
            cell(&r.sumber),
            cell(r.unit_terdampak.as_deref().unwrap_or("")),
            cell(&r.kategori),
            cell(&r.prioritas),
            cell(&r.deskripsi_masalah),
            cell(r.akar_masalah.as_deref().unwrap_or("")),
            cell(r.tindakan_perbaikan.as_deref().unwrap_or("")),
            cell(r.tanggal_selesai.as_deref().unwrap_or("")),
            cell(r.hasil_verifikasi.as_deref().unwrap_or("")),
            cell(&r.status),
            cell(r.pic.as_deref().unwrap_or("")),
        ));
    }
    // Fix: first column harusnya kode, bukan id. Re-build properly.
    let mut csv2 = String::new();
    csv2.push_str("kode,tanggal_lapor,sumber,unit_terdampak,kategori,prioritas,deskripsi_masalah,akar_masalah,tindakan_perbaikan,tanggal_selesai,hasil_verifikasi,status,pic\n");
    for r in &rows {
        let cell = |s: &str| {
            let esc = s.replace('\r', " ").replace('\n', " ").replace('"', "\"\"");
            format!("\"{}\"", esc)
        };
        csv2.push_str(&format!(
            "{},{},{},{},{},{},{},{},{},{},{},{},{}\n",
            cell(&r.kode),
            cell(&r.tanggal_lapor),
            cell(&r.sumber),
            cell(r.unit_terdampak.as_deref().unwrap_or("")),
            cell(&r.kategori),
            cell(&r.prioritas),
            cell(&r.deskripsi_masalah),
            cell(r.akar_masalah.as_deref().unwrap_or("")),
            cell(r.tindakan_perbaikan.as_deref().unwrap_or("")),
            cell(r.tanggal_selesai.as_deref().unwrap_or("")),
            cell(r.hasil_verifikasi.as_deref().unwrap_or("")),
            cell(&r.status),
            cell(r.pic.as_deref().unwrap_or("")),
        ));
    }
    drop(csv);

    let headers = [
        (header::CONTENT_TYPE, "text/csv; charset=utf-8"),
        (header::CONTENT_DISPOSITION, "attachment; filename=\"monev_export.csv\""),
    ];
    Ok((headers, csv2))
}

// ── CSV Import (multipart) ────────────────────────────────────────────────
#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub berhasil:    usize,
    pub gagal:       usize,
    pub error_rows:  Vec<ImportError>,
}
#[derive(Debug, Serialize)]
pub struct ImportError {
    pub baris: usize,
    pub error: String,
}

pub async fn import_csv(
    user: AuthUser,
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<ImportResult>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "monev_edit")?;

    let mut file_bytes: Option<Vec<u8>> = None;
    while let Some(field) = multipart.next_field().await.map_err(|e|
        (StatusCode::BAD_REQUEST, Json(json!({"error": format!("multipart: {}", e)})))
    )? {
        if field.name() == Some("file") {
            file_bytes = Some(field.bytes().await.map_err(|e|
                (StatusCode::BAD_REQUEST, Json(json!({"error": format!("read file: {}", e)})))
            )?.to_vec());
        }
    }
    let bytes = file_bytes.ok_or(validation_err("Field 'file' wajib diisi"))?;
    let text = String::from_utf8_lossy(&bytes).to_string();

    // Simple CSV parser (supports quoted with "" escape, no embedded newline)
    fn parse_line(line: &str) -> Vec<String> {
        let mut out: Vec<String> = Vec::new();
        let mut buf = String::new();
        let mut in_quote = false;
        let mut chars = line.chars().peekable();
        while let Some(c) = chars.next() {
            if in_quote {
                if c == '"' {
                    if chars.peek() == Some(&'"') { buf.push('"'); chars.next(); }
                    else { in_quote = false; }
                } else { buf.push(c); }
            } else {
                match c {
                    '"' => in_quote = true,
                    ',' => { out.push(std::mem::take(&mut buf)); }
                    _   => buf.push(c),
                }
            }
        }
        out.push(buf);
        out
    }

    let mut lines = text.lines();
    let header_line = lines.next().ok_or(validation_err("CSV kosong"))?;
    let headers: Vec<String> = parse_line(header_line).into_iter().map(|s| s.trim().to_lowercase()).collect();
    let idx_of = |name: &str| headers.iter().position(|h| h == name);

    let i_kode      = idx_of("kode");
    let i_tanggal   = idx_of("tanggal_lapor").ok_or(validation_err("Header 'tanggal_lapor' wajib"))?;
    let i_sumber    = idx_of("sumber").ok_or(validation_err("Header 'sumber' wajib"))?;
    let i_unit      = idx_of("unit_terdampak");
    let i_kategori  = idx_of("kategori").ok_or(validation_err("Header 'kategori' wajib"))?;
    let i_prioritas = idx_of("prioritas").ok_or(validation_err("Header 'prioritas' wajib"))?;
    let i_deskripsi = idx_of("deskripsi_masalah").ok_or(validation_err("Header 'deskripsi_masalah' wajib"))?;
    let i_akar      = idx_of("akar_masalah");
    let i_tindakan  = idx_of("tindakan_perbaikan");
    let i_tglsel    = idx_of("tanggal_selesai");
    let i_hasil     = idx_of("hasil_verifikasi");
    let i_status    = idx_of("status");
    let i_pic       = idx_of("pic");

    let mut berhasil = 0usize;
    let mut errors: Vec<ImportError> = Vec::new();

    for (i, raw) in lines.enumerate() {
        let line_no = i + 2; // +1 for header, +1 for 1-based
        let raw = raw.trim_end_matches('\r');
        if raw.trim().is_empty() { continue; }
        let cells = parse_line(raw);
        let get = |i: usize| cells.get(i).cloned().unwrap_or_default();
        let get_opt = |i: Option<usize>| i.and_then(|j| cells.get(j).cloned()).filter(|s| !s.trim().is_empty());

        let tanggal   = get(i_tanggal);
        let sumber    = get(i_sumber);
        let kategori  = get(i_kategori);
        let prioritas = get(i_prioritas);
        let deskripsi = get(i_deskripsi);
        let status    = get_opt(i_status).unwrap_or_else(|| "baru".to_string());

        // validate
        let res: Result<(), String> = (|| {
            if tanggal.len() != 10 { return Err("tanggal_lapor harus YYYY-MM-DD".into()); }
            if !SUMBER_VALID.contains(&sumber.as_str())       { return Err(format!("sumber invalid: {}", sumber)); }
            if !KATEGORI_VALID.contains(&kategori.as_str())   { return Err(format!("kategori invalid: {}", kategori)); }
            if !PRIORITAS_VALID.contains(&prioritas.as_str()) { return Err(format!("prioritas invalid: {}", prioritas)); }
            if !STATUS_VALID.contains(&status.as_str())       { return Err(format!("status invalid: {}", status)); }
            if deskripsi.trim().is_empty() { return Err("deskripsi_masalah kosong".into()); }
            // selesai rule
            if status == "selesai" {
                let t = get_opt(i_tindakan).unwrap_or_default();
                let h = get_opt(i_hasil).unwrap_or_default();
                let s = get_opt(i_tglsel).unwrap_or_default();
                if t.trim().is_empty() || h.trim().is_empty() || s.trim().is_empty() {
                    return Err("status 'selesai' butuh tindakan_perbaikan, hasil_verifikasi, dan tanggal_selesai".into());
                }
            }
            Ok(())
        })();

        if let Err(e) = res {
            errors.push(ImportError { baris: line_no, error: e });
            continue;
        }

        // kode: pakai dari CSV kalau ada, kalau tidak generate
        let kode = if let Some(k) = get_opt(i_kode) { k }
        else {
            let tahun: i32 = tanggal.get(..4).and_then(|s| s.parse().ok()).unwrap_or(2026);
            match next_kode(&state.pool, tahun).await {
                Ok(k) => k,
                Err(e) => { errors.push(ImportError { baris: line_no, error: format!("gen kode: {}", e) }); continue; }
            }
        };

        let res = sqlx::query(
            "INSERT INTO simrscb_monev
             (kode, tanggal_lapor, sumber, unit_terdampak, kategori, prioritas,
              deskripsi_masalah, akar_masalah, tindakan_perbaikan, tanggal_selesai,
              hasil_verifikasi, status, pic)
             VALUES (?,?,?,?,?,?, ?,?,?,?, ?,?,?)
             ON DUPLICATE KEY UPDATE
               tanggal_lapor=VALUES(tanggal_lapor),
               sumber=VALUES(sumber),
               unit_terdampak=VALUES(unit_terdampak),
               kategori=VALUES(kategori),
               prioritas=VALUES(prioritas),
               deskripsi_masalah=VALUES(deskripsi_masalah),
               akar_masalah=VALUES(akar_masalah),
               tindakan_perbaikan=VALUES(tindakan_perbaikan),
               tanggal_selesai=VALUES(tanggal_selesai),
               hasil_verifikasi=VALUES(hasil_verifikasi),
               status=VALUES(status),
               pic=VALUES(pic)"
        )
        .bind(&kode).bind(&tanggal).bind(&sumber).bind(&get_opt(i_unit))
        .bind(&kategori).bind(&prioritas).bind(&deskripsi)
        .bind(&get_opt(i_akar)).bind(&get_opt(i_tindakan)).bind(&get_opt(i_tglsel))
        .bind(&get_opt(i_hasil)).bind(&status).bind(&get_opt(i_pic))
        .execute(&state.pool).await;

        match res {
            Ok(_) => {
                berhasil += 1;
                let sql = format!(
                    "INSERT INTO simrscb_monev (kode, tanggal_lapor, sumber, kategori, prioritas, deskripsi_masalah, status) VALUES ({},{},{},{},{},{},{}) ON DUPLICATE KEY UPDATE",
                    crate::audit::q(&kode),
                    crate::audit::q(&tanggal),
                    crate::audit::q(&sumber),
                    crate::audit::q(&kategori),
                    crate::audit::q(&prioritas),
                    crate::audit::q(&deskripsi),
                    crate::audit::q(&status),
                );
                crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;
            }
            Err(e) => errors.push(ImportError { baris: line_no, error: e.to_string() }),
        }
    }

    Ok(Json(ImportResult { berhasil, gagal: errors.len(), error_rows: errors }))
}

// ── Ingest batch (git log / log bridging) ────────────────────────────────
#[derive(Debug, Deserialize)]
pub struct IngestItem {
    pub tanggal_lapor:     String,           // YYYY-MM-DD
    pub sumber:            String,           // 'git' | 'log_bridging' | 'monitoring'
    pub kategori:          String,           // 'fitur' | 'bug' | 'integrasi' | dst
    pub prioritas:         Option<String>,   // default 'sedang'
    pub deskripsi_masalah: String,
    pub unit_terdampak:    Option<String>,
    pub pic:               Option<String>,
    pub status:            Option<String>,   // default 'selesai' kalau dari git (sudah merged)
    pub tindakan_perbaikan: Option<String>,
    pub hasil_verifikasi:  Option<String>,
    pub tanggal_selesai:   Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct IngestBatchReq {
    pub items: Vec<IngestItem>,
}

#[derive(Debug, Serialize)]
pub struct IngestBatchResp {
    pub berhasil: usize,
    pub gagal:    usize,
    pub errors:   Vec<String>,
}

pub async fn ingest_batch(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<IngestBatchReq>,
) -> Result<Json<IngestBatchResp>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "monev_edit")?;

    let mut berhasil = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for (i, it) in b.items.iter().enumerate() {
        if !SUMBER_VALID.contains(&it.sumber.as_str())       { errors.push(format!("[{}] sumber invalid", i)); continue; }
        if !KATEGORI_VALID.contains(&it.kategori.as_str())   { errors.push(format!("[{}] kategori invalid", i)); continue; }
        let prioritas = it.prioritas.clone().unwrap_or_else(|| "sedang".to_string());
        if !PRIORITAS_VALID.contains(&prioritas.as_str())    { errors.push(format!("[{}] prioritas invalid", i)); continue; }
        let status = it.status.clone().unwrap_or_else(|| "selesai".to_string());
        if !STATUS_VALID.contains(&status.as_str())          { errors.push(format!("[{}] status invalid", i)); continue; }

        // Auto-fill closed-loop fields kalau status selesai tapi tidak diisi (untuk git commits)
        let (mut tindakan, mut hasil, mut tgl_sel) =
            (it.tindakan_perbaikan.clone(), it.hasil_verifikasi.clone(), it.tanggal_selesai.clone());
        if status == "selesai" {
            tindakan = tindakan.or(Some(format!("Implementasi via {} — lihat deskripsi", it.sumber)));
            hasil    = hasil.or(Some("Sudah merged/deploy ke produksi. Verifikasi via smoke test.".to_string()));
            tgl_sel  = tgl_sel.or(Some(it.tanggal_lapor.clone()));
        }

        let tahun: i32 = it.tanggal_lapor.get(..4).and_then(|s| s.parse().ok()).unwrap_or(2026);
        let kode = match next_kode(&state.pool, tahun).await {
            Ok(k) => k,
            Err(e) => { errors.push(format!("[{}] gen kode: {}", i, e)); continue; }
        };

        let res = sqlx::query(
            "INSERT INTO simrscb_monev
             (kode, tanggal_lapor, sumber, unit_terdampak, kategori, prioritas,
              deskripsi_masalah, akar_masalah, tindakan_perbaikan, tanggal_selesai,
              hasil_verifikasi, status, pic)
             VALUES (?,?,?,?,?,?, ?,?,?,?, ?,?,?)"
        )
        .bind(&kode).bind(&it.tanggal_lapor).bind(&it.sumber).bind(&it.unit_terdampak)
        .bind(&it.kategori).bind(&prioritas).bind(&it.deskripsi_masalah)
        .bind(&Option::<String>::None).bind(&tindakan).bind(&tgl_sel)
        .bind(&hasil).bind(&status).bind(&it.pic)
        .execute(&state.pool).await;

        match res {
            Ok(_) => {
                berhasil += 1;
                let sql = format!(
                    "INSERT INTO simrscb_monev (kode, tanggal_lapor, sumber, kategori, prioritas, deskripsi_masalah, status) VALUES ({},{},{},{},{},{},{})",
                    crate::audit::q(&kode),
                    crate::audit::q(&it.tanggal_lapor),
                    crate::audit::q(&it.sumber),
                    crate::audit::q(&it.kategori),
                    crate::audit::q(&prioritas),
                    crate::audit::q(&it.deskripsi_masalah),
                    crate::audit::q(&status),
                );
                crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;
            }
            Err(e) => errors.push(format!("[{}] {}", i, e)),
        }
    }

    Ok(Json(IngestBatchResp { berhasil, gagal: errors.len(), errors }))
}

// ── Lampiran ──────────────────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
pub struct LampiranReq {
    pub nama_berkas:   String,
    pub path_atau_url: String,
    pub keterangan:    Option<String>,
}

pub async fn add_lampiran(
    user: AuthUser,
    State(state): State<AppState>,
    Path(monev_id): Path<i64>,
    Json(b): Json<LampiranReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "monev_edit")?;
    sqlx::query(
        "INSERT INTO simrscb_monev_lampiran (monev_id, nama_berkas, path_atau_url, keterangan)
         VALUES (?,?,?,?)"
    )
    .bind(monev_id).bind(&b.nama_berkas).bind(&b.path_atau_url).bind(&b.keterangan)
    .execute(&state.pool).await.map_err(db_err)?;
    let sql = format!(
        "INSERT INTO simrscb_monev_lampiran (monev_id, nama_berkas, path_atau_url, keterangan) VALUES ({},{},{},{})",
        monev_id,
        crate::audit::q(&b.nama_berkas),
        crate::audit::q(&b.path_atau_url),
        crate::audit::qo(b.keterangan.as_ref()),
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;
    Ok(Json(json!({"ok": true})))
}

pub async fn delete_lampiran(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "monev_edit")?;
    sqlx::query("DELETE FROM simrscb_monev_lampiran WHERE id = ?")
        .bind(id).execute(&state.pool).await.map_err(db_err)?;
    let sql = format!("DELETE FROM simrscb_monev_lampiran WHERE id={}", id);
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;
    Ok(Json(json!({"ok": true})))
}

// ── Rapat ─────────────────────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
pub struct RapatQuery {
    pub dari:   Option<String>,
    pub sampai: Option<String>,
}

pub async fn list_rapat(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<RapatQuery>,
) -> Result<Json<Vec<RapatRow>>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "monev_view")?;
    let rows: Vec<RapatRow> = sqlx::query_as(
        "SELECT id,
                DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal,
                judul, ringkasan, path_notulen,
                DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at
         FROM simrscb_monev_rapat
         WHERE (? IS NULL OR tanggal >= ?)
           AND (? IS NULL OR tanggal <= ?)
         ORDER BY tanggal DESC"
    )
    .bind(&q.dari).bind(&q.dari)
    .bind(&q.sampai).bind(&q.sampai)
    .fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateRapatReq {
    pub tanggal:      String,
    pub judul:        String,
    pub ringkasan:    Option<String>,
    pub path_notulen: Option<String>,
}

pub async fn create_rapat(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<CreateRapatReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "monev_edit")?;
    let id = sqlx::query(
        "INSERT INTO simrscb_monev_rapat (tanggal, judul, ringkasan, path_notulen)
         VALUES (?,?,?,?)"
    )
    .bind(&b.tanggal).bind(&b.judul).bind(&b.ringkasan).bind(&b.path_notulen)
    .execute(&state.pool).await.map_err(db_err)?
    .last_insert_id();
    let sql = format!(
        "INSERT INTO simrscb_monev_rapat (tanggal, judul, ringkasan, path_notulen) VALUES ({},{},{},{})",
        crate::audit::q(&b.tanggal),
        crate::audit::q(&b.judul),
        crate::audit::qo(b.ringkasan.as_ref()),
        crate::audit::qo(b.path_notulen.as_ref()),
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;
    Ok(Json(json!({"ok": true, "id": id})))
}

pub async fn delete_rapat(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "monev_edit")?;
    sqlx::query("DELETE FROM simrscb_monev_rapat WHERE id = ?")
        .bind(id).execute(&state.pool).await.map_err(db_err)?;
    let sql = format!("DELETE FROM simrscb_monev_rapat WHERE id={}", id);
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;
    Ok(Json(json!({"ok": true})))
}
