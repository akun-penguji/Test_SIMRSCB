use crate::{
    auth::middleware::AuthUser,
    handlers::simrscb::{ensure_config_table, get_cfg, save_remote, strip_data_url},
    models::log_kinerja::*,
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Deserialize;
use serde_json::{json, Value};

const FOLDER: &str = "logkinerjapegawai";
const MAX_FOTO_PER_LOG: i64 = 10;

// ── GET /api/log-kinerja ─────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct ListQuery {
    pub tanggal: Option<String>,
    pub from:    Option<String>,
    pub to:      Option<String>,
    pub nip:     Option<String>,
}

pub async fn list_logs(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let target_nip = q.nip.clone().filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| user.0.kode.clone());

    // MVP: pegawai hanya boleh lihat log sendiri. Atasan/HRD nanti via permission.
    if target_nip != user.0.kode
        && !user.0.is_admin
        && !user.0.permissions.get("log_kinerja_view_all").copied().unwrap_or(false)
    {
        return Err((StatusCode::FORBIDDEN,
            Json(json!({"error":"Hanya bisa lihat log kinerja sendiri"}))));
    }

    let t  = q.tanggal.clone().filter(|s| !s.trim().is_empty());
    let f  = q.from.clone().filter(|s| !s.trim().is_empty());
    let to = q.to.clone().filter(|s| !s.trim().is_empty());

    let rows: Vec<LogKinerjaRow> = sqlx::query_as(
        "SELECT l.id, l.nip, IFNULL(p.nama,'') AS nama_pegawai,
                DATE_FORMAT(l.tanggal,'%Y-%m-%d')        AS tanggal,
                TIME_FORMAT(l.jam_mulai,'%H:%i')         AS jam_mulai,
                TIME_FORMAT(l.jam_selesai,'%H:%i')       AS jam_selesai,
                l.judul, l.deskripsi, l.lokasi,
                IFNULL((SELECT COUNT(*) FROM log_kinerja_foto f WHERE f.log_id = l.id), 0) AS foto_count
         FROM log_kinerja_pegawai l
         LEFT JOIN pegawai p ON l.nip = p.nik
         WHERE l.nip = ?
           AND (? IS NULL OR l.tanggal = ?)
           AND (? IS NULL OR l.tanggal >= ?)
           AND (? IS NULL OR l.tanggal <= ?)
         ORDER BY l.tanggal DESC, l.jam_mulai DESC"
    )
    .bind(&target_nip)
    .bind(&t).bind(&t)
    .bind(&f).bind(&f)
    .bind(&to).bind(&to)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    Ok(Json(json!({ "data": rows })))
}

// ── GET /api/log-kinerja/:id ─────────────────────────────────────────────────
pub async fn detail_log(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row: Option<LogKinerjaRow> = sqlx::query_as(
        "SELECT l.id, l.nip, IFNULL(p.nama,'') AS nama_pegawai,
                DATE_FORMAT(l.tanggal,'%Y-%m-%d')        AS tanggal,
                TIME_FORMAT(l.jam_mulai,'%H:%i')         AS jam_mulai,
                TIME_FORMAT(l.jam_selesai,'%H:%i')       AS jam_selesai,
                l.judul, l.deskripsi, l.lokasi,
                IFNULL((SELECT COUNT(*) FROM log_kinerja_foto f WHERE f.log_id = l.id), 0) AS foto_count
         FROM log_kinerja_pegawai l
         LEFT JOIN pegawai p ON l.nip = p.nik
         WHERE l.id = ? LIMIT 1"
    )
    .bind(id)
    .fetch_optional(&state.pool).await.map_err(db_err)?;

    let log = row.ok_or_else(|| (StatusCode::NOT_FOUND,
        Json(json!({"error":"Log tidak ditemukan"}))))?;

    if log.nip != user.0.kode
        && !user.0.is_admin
        && !user.0.permissions.get("log_kinerja_view_all").copied().unwrap_or(false)
    {
        return Err((StatusCode::FORBIDDEN,
            Json(json!({"error":"Tidak boleh melihat log pegawai lain"}))));
    }

    let fotos: Vec<LogKinerjaFotoRow> = sqlx::query_as(
        "SELECT id, log_id, url_image, caption,
                DATE_FORMAT(uploaded_at,'%Y-%m-%d %H:%i:%s') AS uploaded_at
         FROM log_kinerja_foto WHERE log_id = ? ORDER BY id ASC"
    )
    .bind(id)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    Ok(Json(json!({ "data": log, "fotos": fotos })))
}

// ── POST /api/log-kinerja ────────────────────────────────────────────────────
pub async fn buat_log(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<SimpanLogKinerja>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    validate_body(&body)?;

    let jam_mulai   = normalize_time(&body.jam_mulai);
    let jam_selesai = body.jam_selesai.as_deref()
        .map(normalize_time).filter(|s| !s.is_empty());

    let res = sqlx::query(
        "INSERT INTO log_kinerja_pegawai
           (nip, tanggal, jam_mulai, jam_selesai, judul, deskripsi, lokasi)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&user.0.kode)
    .bind(&body.tanggal)
    .bind(&jam_mulai)
    .bind(&jam_selesai)
    .bind(body.judul.trim())
    .bind(body.deskripsi.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.lokasi.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .execute(&state.pool).await.map_err(db_err)?;

    let id = res.last_insert_id() as i64;

    let sql = format!(
        "INSERT INTO log_kinerja_pegawai (nip, tanggal, jam_mulai, jam_selesai, judul, deskripsi, \
         lokasi) VALUES ({},{},{},{},{},{},{})",
        crate::audit::q(&user.0.kode),
        crate::audit::q(&body.tanggal),
        crate::audit::q(&jam_mulai),
        crate::audit::qo(jam_selesai.as_deref()),
        crate::audit::q(body.judul.trim()),
        crate::audit::qo(body.deskripsi.as_deref().map(str::trim).filter(|s| !s.is_empty())),
        crate::audit::qo(body.lokasi.as_deref().map(str::trim).filter(|s| !s.is_empty())),
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;

    Ok(Json(json!({ "success": true, "id": id })))
}

// ── PUT /api/log-kinerja/:id ─────────────────────────────────────────────────
pub async fn edit_log(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(body): Json<SimpanLogKinerja>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    validate_body(&body)?;
    ensure_owner(&state.pool, id, &user.0.kode).await?;

    let jam_mulai   = normalize_time(&body.jam_mulai);
    let jam_selesai = body.jam_selesai.as_deref()
        .map(normalize_time).filter(|s| !s.is_empty());

    sqlx::query(
        "UPDATE log_kinerja_pegawai
            SET tanggal=?, jam_mulai=?, jam_selesai=?, judul=?, deskripsi=?, lokasi=?
          WHERE id=? AND nip=?"
    )
    .bind(&body.tanggal)
    .bind(&jam_mulai)
    .bind(&jam_selesai)
    .bind(body.judul.trim())
    .bind(body.deskripsi.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.lokasi.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(id)
    .bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;

    let sql = format!(
        "UPDATE log_kinerja_pegawai SET tanggal={}, jam_mulai={}, jam_selesai={}, judul={}, \
         deskripsi={}, lokasi={} WHERE id={} AND nip={}",
        crate::audit::q(&body.tanggal),
        crate::audit::q(&jam_mulai),
        crate::audit::qo(jam_selesai.as_deref()),
        crate::audit::q(body.judul.trim()),
        crate::audit::qo(body.deskripsi.as_deref().map(str::trim).filter(|s| !s.is_empty())),
        crate::audit::qo(body.lokasi.as_deref().map(str::trim).filter(|s| !s.is_empty())),
        id,
        crate::audit::q(&user.0.kode),
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;

    Ok(Json(json!({ "success": true })))
}

// ── DELETE /api/log-kinerja/:id ──────────────────────────────────────────────
pub async fn hapus_log(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    ensure_owner(&state.pool, id, &user.0.kode).await?;

    // CASCADE akan otomatis hapus log_kinerja_foto rows
    sqlx::query("DELETE FROM log_kinerja_pegawai WHERE id=? AND nip=?")
        .bind(id).bind(&user.0.kode)
        .execute(&state.pool).await.map_err(db_err)?;

    let sql = format!(
        "DELETE FROM log_kinerja_pegawai WHERE id={} AND nip={}",
        id, crate::audit::q(&user.0.kode)
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;

    Ok(Json(json!({ "success": true })))
}

// ── POST /api/log-kinerja/:id/foto ───────────────────────────────────────────
pub async fn upload_foto(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(body): Json<UploadFotoBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    ensure_owner(&state.pool, id, &user.0.kode).await?;

    // Cek limit foto
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM log_kinerja_foto WHERE log_id = ?"
    ).bind(id).fetch_one(&state.pool).await.map_err(db_err)?;
    if count >= MAX_FOTO_PER_LOG {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Maksimal {} foto per log", MAX_FOTO_PER_LOG)}))));
    }

    if body.foto_base64.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Foto kosong"}))));
    }

    ensure_config_table(&state.pool).await;
    let hw_type   = get_cfg(&state.pool, "hosthybridweb_type",   "local").await;
    let hw_val    = get_cfg(&state.pool, "hosthybridweb",        "/var/www/html/webappsrscb/").await;
    let hw_secret = get_cfg(&state.pool, "hosthybridweb_secret", "").await;

    let b64   = strip_data_url(&body.foto_base64);
    let bytes = STANDARD.decode(b64).map_err(|_| {
        (StatusCode::BAD_REQUEST, Json(json!({"error":"base64 foto tidak valid"})))
    })?;

    // Filename: {log_id}_{epoch_ms_no_collision}.jpg
    // Pakai counter sederhana: last_insert_id setelah INSERT placeholder.
    // Lebih simpel: pakai NIP-aman + counter dari (count+1).
    let seq = count + 1;
    let filename = format!("{}_{}", id, seq);
    let rel = format!("{}.jpg", filename);

    if hw_type == "remote" {
        save_remote(&hw_val, &hw_secret, FOLDER, "foto", &filename, b64)
            .await
            .map_err(|e| (StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("Remote upload gagal: {}", e)}))))?;
    } else {
        let base = hw_val.trim_end_matches('/');
        let dir  = format!("{}/{}/foto", base, FOLDER);
        let path = format!("{}/{}.jpg", dir, filename);
        tokio::fs::create_dir_all(&dir).await.map_err(io_err)?;
        let canonical_base = std::fs::canonicalize(base).unwrap_or_else(|_| std::path::PathBuf::from(base));
        let canonical_path = std::fs::canonicalize(&path).unwrap_or_else(|_| std::path::PathBuf::from(&path));
        if !canonical_path.starts_with(&canonical_base) {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Path tidak valid"}))));
        }
        tokio::fs::write(&path, &bytes).await.map_err(io_err)?;
    }

    let url_image = format!("foto/{}.jpg", filename);
    let caption = body.caption.as_deref().map(str::trim).filter(|s| !s.is_empty());

    let res = sqlx::query(
        "INSERT INTO log_kinerja_foto (log_id, url_image, caption) VALUES (?, ?, ?)"
    )
    .bind(id).bind(&url_image).bind(caption)
    .execute(&state.pool).await.map_err(db_err)?;

    let sql = format!(
        "INSERT INTO log_kinerja_foto (log_id, url_image, caption) VALUES ({},{},{})",
        id, crate::audit::q(&url_image), crate::audit::qo(caption)
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;

    Ok(Json(json!({
        "success": true,
        "foto_id": res.last_insert_id() as i64,
        "url_image": url_image,
        "rel": rel,
    })))
}

// ── DELETE /api/log-kinerja/:id/foto/:foto_id ────────────────────────────────
pub async fn hapus_foto(
    user: AuthUser,
    State(state): State<AppState>,
    Path((id, foto_id)): Path<(i64, i64)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    ensure_owner(&state.pool, id, &user.0.kode).await?;

    // Best-effort: ambil url_image dulu untuk hapus file (kalau lokal)
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT url_image FROM log_kinerja_foto WHERE id=? AND log_id=? LIMIT 1"
    ).bind(foto_id).bind(id)
    .fetch_optional(&state.pool).await.map_err(db_err)?;

    let _url_image = row.map(|r| r.0);

    let res = sqlx::query("DELETE FROM log_kinerja_foto WHERE id=? AND log_id=?")
        .bind(foto_id).bind(id)
        .execute(&state.pool).await.map_err(db_err)?;

    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Foto tidak ditemukan"}))));
    }

    let sql = format!(
        "DELETE FROM log_kinerja_foto WHERE id={} AND log_id={}",
        foto_id, id
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;

    // File fisik tidak dihapus (best-effort orphan biar tidak gagalin response).
    // Bisa dibersihkan via cleanup job belakangan.

    Ok(Json(json!({ "success": true })))
}

// ── GET /api/log-kinerja/rekap?nip=&bulan=YYYY-MM ────────────────────────────
#[derive(Deserialize)]
pub struct RekapQuery {
    pub nip:   Option<String>,
    pub bulan: Option<String>,  // YYYY-MM
}

pub async fn rekap_bulanan(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<RekapQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let target_nip = q.nip.clone().filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| user.0.kode.clone());

    if target_nip != user.0.kode
        && !user.0.is_admin
        && !user.0.permissions.get("log_kinerja_view_all").copied().unwrap_or(false)
    {
        return Err((StatusCode::FORBIDDEN,
            Json(json!({"error":"Hanya bisa lihat rekap sendiri"}))));
    }

    let bulan = q.bulan.clone().filter(|s| s.len() == 7)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m").to_string());
    let bulan_from = format!("{}-01", bulan);

    // Ambil semua row per bulan, agregat di Rust (hindari konflik DECIMAL/Float sqlx).
    #[derive(sqlx::FromRow)]
    struct RawRow {
        tanggal:     String,
        judul:       String,
        durasi_menit: Option<i64>,
    }
    let raw: Vec<RawRow> = sqlx::query_as(
        "SELECT DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal,
                judul,
                CASE WHEN jam_selesai IS NOT NULL
                  THEN TIMESTAMPDIFF(MINUTE, jam_mulai, jam_selesai)
                  ELSE NULL END AS durasi_menit
         FROM log_kinerja_pegawai
         WHERE nip = ?
           AND tanggal >= ?
           AND tanggal < DATE_ADD(?, INTERVAL 1 MONTH)
         ORDER BY tanggal DESC, jam_mulai ASC"
    )
    .bind(&target_nip)
    .bind(&bulan_from)
    .bind(&bulan_from)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    // Group by tanggal (input sudah ORDER BY tanggal DESC)
    let mut rows: Vec<RekapHarianRow> = Vec::new();
    for r in raw {
        let dur = r.durasi_menit.unwrap_or(0).max(0);
        if let Some(last) = rows.last_mut() {
            if last.tanggal == r.tanggal {
                last.jumlah_log += 1;
                last.total_menit += dur;
                if let Some(ref mut jl) = last.judul_list {
                    jl.push_str(" | ");
                    jl.push_str(&r.judul);
                }
                continue;
            }
        }
        rows.push(RekapHarianRow {
            tanggal:     r.tanggal,
            jumlah_log:  1,
            total_menit: dur,
            judul_list:  Some(r.judul),
        });
    }

    let totals = rows.iter().fold((0i64, 0i64), |(c, m), r| {
        (c + r.jumlah_log, m + r.total_menit)
    });

    Ok(Json(json!({
        "data": rows,
        "bulan": bulan,
        "nip":   target_nip,
        "total_log":   totals.0,
        "total_menit": totals.1,
    })))
}

// ── helpers ──────────────────────────────────────────────────────────────────

async fn ensure_owner(
    pool: &sqlx::MySqlPool,
    id:   i64,
    nip:  &str,
) -> Result<(), (StatusCode, Json<Value>)> {
    let owner: Option<(String,)> = sqlx::query_as(
        "SELECT nip FROM log_kinerja_pegawai WHERE id = ? LIMIT 1"
    ).bind(id).fetch_optional(pool).await.map_err(db_err)?;

    match owner {
        None => Err((StatusCode::NOT_FOUND, Json(json!({"error":"Log tidak ditemukan"})))),
        Some((n,)) if n == nip => Ok(()),
        Some(_) => Err((StatusCode::FORBIDDEN,
            Json(json!({"error":"Bukan log Anda"})))),
    }
}

fn validate_body(b: &SimpanLogKinerja) -> Result<(), (StatusCode, Json<Value>)> {
    if b.tanggal.len() != 10 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Tanggal wajib (YYYY-MM-DD)"}))));
    }
    if b.jam_mulai.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Jam mulai wajib"}))));
    }
    if b.judul.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Judul kegiatan wajib"}))));
    }
    if b.judul.len() > 200 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Judul terlalu panjang (max 200)"}))));
    }
    Ok(())
}

fn normalize_time(s: &str) -> String {
    let s = s.trim();
    if s.len() == 5 { format!("{}:00", s) } else { s.to_string() }
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error log_kinerja: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"Database error"})))
}

fn io_err(e: std::io::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("IO error log_kinerja: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("IO error: {}", e)})))
}
