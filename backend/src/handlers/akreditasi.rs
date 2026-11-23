use crate::AppState;
use axum::{
    extract::{Query, State, Path},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::MySqlPool;

const SCHEMA_SQL:    &str = include_str!("../../migrations/001_starkes_ep_schema.sql");
const EVIDEN_SQL:    &str = include_str!("../../migrations/004_eviden_folder.sql");
const ALTER_1596_SQL:&str = include_str!("../../migrations/009_starkes_ep_1596_2024_alter.sql");
const SEED_1596_SQL: &str = include_str!("../../migrations/012_starkes_all_bab_47104_v2.sql");
const DROP_1128_SQL: &str = include_str!("../../migrations/013_drop_1128_2022_seed.sql");
// Mig 002 (starter 48 EP), 003 (mrmik 48 EP), 005 (form_ep_map seed lama)
// dihentikan — semuanya pakai versi Kepmenkes 1128/2022 yg sudah usang.
// Aktif: 001 → 004 → 009 (ALTER) → 012 (seed 1596/2024) → 013 (drop 1128).

// ─────────────────────────────────────────────────────────────
// Bootstrap — apply schema + seed (idempotent)
// ─────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct BootstrapResp {
    pub schema_statements:    usize,
    pub eviden_statements:    usize,
    pub alter_1596_statements: usize,
    pub seed_1596_statements: usize,
    pub drop_1128_statements: usize,
    pub total_ep:             i64,
    pub total_eviden:         i64,
    pub total_form_map:       i64,
    pub message:              String,
}

pub async fn bootstrap(
    user: crate::auth::middleware::AuthUser,
    State(state): State<AppState>,
) -> Result<Json<BootstrapResp>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin {
        return Err((StatusCode::FORBIDDEN, Json(serde_json::json!({"error": "Hanya admin yang boleh menjalankan bootstrap DDL"}))));
    }
    let n1 = run_sql_blob(&state.pool, SCHEMA_SQL).await
        .map_err(|e| db_err("schema", e))?;
    let n2 = run_sql_blob(&state.pool, EVIDEN_SQL).await
        .map_err(|e| db_err("eviden", e))?;
    let n3 = run_sql_blob(&state.pool, ALTER_1596_SQL).await
        .map_err(|e| db_err("alter_1596", e))?;
    let n4 = run_sql_blob(&state.pool, SEED_1596_SQL).await
        .map_err(|e| db_err("seed_1596", e))?;
    let n5 = run_sql_blob(&state.pool, DROP_1128_SQL).await
        .map_err(|e| db_err("drop_1128", e))?;

    let (total,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM starkes_ep WHERE versi_kepmenkes='1596/2024'")
        .fetch_one(&state.pool).await
        .map_err(|e| db_err("count", e))?;
    let (total_eviden,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM eviden_folder")
        .fetch_one(&state.pool).await.unwrap_or((0,));
    let (total_form_map,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM form_ep_map")
        .fetch_one(&state.pool).await.unwrap_or((0,));

    Ok(Json(BootstrapResp {
        schema_statements:     n1,
        eviden_statements:     n2,
        alter_1596_statements: n3,
        seed_1596_statements:  n4,
        drop_1128_statements:  n5,
        total_ep:              total,
        total_eviden,
        total_form_map,
        message: format!("Bootstrap akreditasi (Kepmenkes 1596/2024) — {} EP + {} eviden + {} form mapping", total, total_eviden, total_form_map),
    }))
}

async fn run_sql_blob(pool: &MySqlPool, sql: &str) -> Result<usize, sqlx::Error> {
    // Split file menjadi statement individual, skip komentar -- dan baris kosong
    let mut count = 0usize;
    let mut current = String::new();
    for raw in sql.lines() {
        let trimmed = raw.trim();
        if trimmed.is_empty() || trimmed.starts_with("--") { continue; }
        current.push_str(raw);
        current.push('\n');
        if trimmed.ends_with(';') {
            let stmt = current.trim();
            if !stmt.is_empty() {
                sqlx::query(stmt).execute(pool).await?;
                count += 1;
            }
            current.clear();
        }
    }
    Ok(count)
}

// ─────────────────────────────────────────────────────────────
// List EP — dengan filter & search
// ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ListEpQuery {
    pub bab:       Option<String>,
    pub kelompok:  Option<i32>,
    pub prioritas: Option<i32>,
    pub kategori:  Option<String>,
    pub search:    Option<String>,
    pub limit:     Option<i64>,
    pub offset:    Option<i64>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct EpRow {
    pub kd_ep:             String,
    pub bab:               String,
    pub urutan_bab:        Option<i32>,
    pub nama_bab:          String,
    pub kelompok:          i32,
    pub standar:           String,
    pub nama_standar:      Option<String>,
    pub maksud_tujuan:     Option<String>,
    pub nomor_ep:          i32,
    pub deskripsi:         String,
    pub kelengkapan_bukti: Option<String>,
    pub jenis_bukti:       String,
    pub bobot:             i32,
    pub prioritas:         i32,
    pub kategori_bukti:    Option<String>,
    pub versi_kepmenkes:   String,
    pub sumber_seed:       Option<String>,
    pub status:            String,
}

pub async fn list_ep(
    State(state): State<AppState>,
    Query(q):     Query<ListEpQuery>,
) -> Result<Json<Vec<EpRow>>, (StatusCode, Json<Value>)> {
    let mut sql = String::from(
        "SELECT kd_ep, bab, urutan_bab, nama_bab, kelompok, standar, nama_standar, maksud_tujuan, \
                nomor_ep, deskripsi, kelengkapan_bukti, jenis_bukti, bobot, prioritas, \
                kategori_bukti, versi_kepmenkes, sumber_seed, status \
         FROM starkes_ep WHERE status='aktif'"
    );
    let mut binds: Vec<String> = Vec::new();

    if let Some(b) = &q.bab        { sql.push_str(" AND bab = ?");           binds.push(b.clone()); }
    if let Some(k) = q.kelompok    { sql.push_str(" AND kelompok = ?");      binds.push(k.to_string()); }
    if let Some(p) = q.prioritas   { sql.push_str(" AND prioritas = ?");     binds.push(p.to_string()); }
    if let Some(c) = &q.kategori   { sql.push_str(" AND kategori_bukti = ?"); binds.push(c.clone()); }
    if let Some(s) = &q.search     {
        sql.push_str(" AND (kd_ep LIKE ? OR deskripsi LIKE ? OR nama_standar LIKE ?)");
        let like = format!("%{}%", s);
        binds.push(like.clone()); binds.push(like.clone()); binds.push(like);
    }

    sql.push_str(" ORDER BY urutan_bab, bab, CAST(SUBSTRING_INDEX(standar,' ',-1) AS DECIMAL(8,2)), nomor_ep");

    let limit  = q.limit.unwrap_or(500).clamp(1, 2000);
    let offset = q.offset.unwrap_or(0).max(0);
    sql.push_str(&format!(" LIMIT {} OFFSET {}", limit, offset));

    let mut query = sqlx::query_as::<_, EpRow>(&sql);
    for b in &binds { query = query.bind(b); }

    let rows = query.fetch_all(&state.pool).await
        .map_err(|e| db_err("list_ep", e))?;
    Ok(Json(rows))
}

pub async fn get_ep(
    State(state): State<AppState>,
    Path(kd_ep):  Path<String>,
) -> Result<Json<EpRow>, (StatusCode, Json<Value>)> {
    let row: Option<EpRow> = sqlx::query_as(
        "SELECT kd_ep, bab, urutan_bab, nama_bab, kelompok, standar, nama_standar, maksud_tujuan, \
                nomor_ep, deskripsi, kelengkapan_bukti, jenis_bukti, bobot, prioritas, \
                kategori_bukti, versi_kepmenkes, sumber_seed, status \
         FROM starkes_ep WHERE kd_ep = ? LIMIT 1"
    )
    .bind(&kd_ep)
    .fetch_optional(&state.pool).await
    .map_err(|e| db_err("get_ep", e))?;

    match row {
        Some(r) => Ok(Json(r)),
        None    => Err((StatusCode::NOT_FOUND, Json(json!({"error": "EP tidak ditemukan"})))),
    }
}

// ─────────────────────────────────────────────────────────────
// Edit EP — admin cleanup hasil parser PDF (nama_standar, deskripsi,
// kelengkapan_bukti, maksud_tujuan, jenis_bukti, prioritas, kategori_bukti)
// ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct EditEpBody {
    pub nama_standar:      Option<String>,
    pub maksud_tujuan:     Option<String>,
    pub deskripsi:         Option<String>,
    pub kelengkapan_bukti: Option<String>,
    pub jenis_bukti:       Option<String>,
    pub bobot:             Option<i32>,
    pub prioritas:         Option<i32>,
    pub kategori_bukti:    Option<String>,
    pub status:            Option<String>,
}

pub async fn edit_ep(
    State(state): State<AppState>,
    Path(kd_ep):  Path<String>,
    Json(body):   Json<EditEpBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Build dynamic SET clause hanya untuk field yang dikirim.
    let mut set_parts: Vec<&str> = Vec::new();
    let mut binds: Vec<String> = Vec::new();
    // Salinan SET clause dengan nilai inline untuk audit trackersql.
    let mut log_parts: Vec<String> = Vec::new();

    if let Some(v) = body.nama_standar      { set_parts.push("nama_standar = ?");      log_parts.push(format!("nama_standar = {}", crate::audit::q(&v)));      binds.push(v); }
    if let Some(v) = body.maksud_tujuan     { set_parts.push("maksud_tujuan = ?");     log_parts.push(format!("maksud_tujuan = {}", crate::audit::q(&v)));     binds.push(v); }
    if let Some(v) = body.deskripsi         { set_parts.push("deskripsi = ?");         log_parts.push(format!("deskripsi = {}", crate::audit::q(&v)));         binds.push(v); }
    if let Some(v) = body.kelengkapan_bukti { set_parts.push("kelengkapan_bukti = ?"); log_parts.push(format!("kelengkapan_bukti = {}", crate::audit::q(&v))); binds.push(v); }
    if let Some(v) = body.jenis_bukti       { set_parts.push("jenis_bukti = ?");       log_parts.push(format!("jenis_bukti = {}", crate::audit::q(&v)));       binds.push(v); }
    if let Some(v) = body.bobot             { set_parts.push("bobot = ?");             log_parts.push(format!("bobot = {}", v));                              binds.push(v.to_string()); }
    if let Some(v) = body.prioritas         { set_parts.push("prioritas = ?");         log_parts.push(format!("prioritas = {}", v));                          binds.push(v.to_string()); }
    if let Some(v) = body.kategori_bukti    { set_parts.push("kategori_bukti = ?");    log_parts.push(format!("kategori_bukti = {}", crate::audit::q(&v)));    binds.push(v); }
    if let Some(v) = body.status {
        if v != "aktif" && v != "non-aktif" {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"status harus aktif|non-aktif"}))));
        }
        set_parts.push("status = ?");
        log_parts.push(format!("status = {}", crate::audit::q(&v)));
        binds.push(v);
    }
    // sumber_seed update jadi 'manual-edit' (audit trail siapa edit)
    set_parts.push("sumber_seed = 'manual-edit'");
    log_parts.push("sumber_seed = 'manual-edit'".to_string());

    if set_parts.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Tidak ada field yang diubah"}))));
    }

    let sql = format!("UPDATE starkes_ep SET {} WHERE kd_ep = ?", set_parts.join(", "));
    let mut q = sqlx::query(&sql);
    for b in &binds { q = q.bind(b); }
    q = q.bind(&kd_ep);

    let res = q.execute(&state.pool).await.map_err(|e| db_err("edit_ep", e))?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"EP tidak ditemukan"}))));
    }

    let log_sql = format!(
        "UPDATE starkes_ep SET {} WHERE kd_ep = {}",
        log_parts.join(", "), crate::audit::q(&kd_ep)
    );
    crate::audit::log_sql(&state.pool, "web", &log_sql).await;

    Ok(Json(json!({ "success": true, "kd_ep": kd_ep })))
}

// ─────────────────────────────────────────────────────────────
// Stats per bab — untuk landing dashboard akreditasi
// ─────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct StatsBab {
    pub bab:       String,
    pub nama_bab:  String,
    pub kelompok:  i32,
    pub total_ep:  i64,
    pub critical:  i64,
}

#[derive(Serialize)]
pub struct StatsResp {
    pub total_ep:    i64,
    pub per_bab:     Vec<StatsBab>,
    pub per_kelompok: Vec<KelompokStat>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct KelompokStat {
    pub kelompok: i32,
    pub total:    i64,
}

pub async fn stats(
    State(state): State<AppState>,
) -> Result<Json<StatsResp>, (StatusCode, Json<Value>)> {
    // Cek apakah tabel sudah ada (belum bootstrap)
    let tabel_ada: Option<(String,)> = sqlx::query_as(
        "SELECT TABLE_NAME FROM information_schema.TABLES \
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'starkes_ep' LIMIT 1"
    )
    .fetch_optional(&state.pool).await
    .map_err(|e| db_err("check_table", e))?;

    if tabel_ada.is_none() {
        return Ok(Json(StatsResp { total_ep: 0, per_bab: vec![], per_kelompok: vec![] }));
    }

    let (total,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM starkes_ep WHERE status='aktif'")
        .fetch_one(&state.pool).await.unwrap_or((0,));

    let per_bab: Vec<StatsBab> = sqlx::query_as(
        "SELECT bab, nama_bab, kelompok, COUNT(*) AS total_ep, \
                CAST(SUM(CASE WHEN prioritas <= 2 THEN 1 ELSE 0 END) AS SIGNED) AS critical \
         FROM starkes_ep WHERE status='aktif' \
         GROUP BY bab, nama_bab, kelompok \
         ORDER BY kelompok, bab"
    )
    .fetch_all(&state.pool).await
    .map_err(|e| db_err("stats_per_bab", e))?;

    let per_kelompok: Vec<KelompokStat> = sqlx::query_as(
        "SELECT kelompok, COUNT(*) AS total FROM starkes_ep WHERE status='aktif' \
         GROUP BY kelompok ORDER BY kelompok"
    )
    .fetch_all(&state.pool).await.unwrap_or_default();

    Ok(Json(StatsResp { total_ep: total, per_bab, per_kelompok }))
}

fn db_err(label: &str, e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error akreditasi {}: {}", label, e);
    (StatusCode::INTERNAL_SERVER_ERROR,
     Json(json!({"error": format!("Database error: {}", label), "detail": e.to_string()})))
}
