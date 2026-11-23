use crate::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Serialize, sqlx::FromRow)]
pub struct EvidenFolder {
    pub id:           i32,
    pub judul:        String,
    pub url_drive:    String,
    pub bab:          Option<String>,
    pub jenis:        String,
    pub tahun:        Option<i16>,
    pub deskripsi:    Option<String>,
    pub pic_nik:      Option<String>,
    pub status:       String,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct EvidenFolderWithEpCount {
    pub id:           i32,
    pub judul:        String,
    pub url_drive:    String,
    pub bab:          Option<String>,
    pub jenis:        String,
    pub tahun:        Option<i16>,
    pub deskripsi:    Option<String>,
    pub pic_nik:      Option<String>,
    pub status:       String,
    pub ep_count:     i64,
}

#[derive(Deserialize)]
pub struct ListEvidenQuery {
    pub bab:    Option<String>,
    pub jenis:  Option<String>,
    pub status: Option<String>,
    pub search: Option<String>,
}

pub async fn list_eviden(
    user: crate::auth::middleware::AuthUser,
    State(state): State<AppState>,
    Query(q):     Query<ListEvidenQuery>,
) -> Result<Json<Vec<EvidenFolderWithEpCount>>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "akreditasi_view")?;
    let mut sql = String::from(
        "SELECT f.id, f.judul, f.url_drive, f.bab, f.jenis, CAST(f.tahun AS SIGNED) AS tahun, f.deskripsi, f.pic_nik, f.status, \
                COALESCE(m.cnt, 0) AS ep_count \
         FROM eviden_folder f \
         LEFT JOIN (SELECT folder_id, COUNT(*) AS cnt FROM eviden_folder_ep_map GROUP BY folder_id) m \
                ON m.folder_id = f.id \
         WHERE 1=1"
    );
    let mut binds: Vec<String> = Vec::new();

    if let Some(b) = &q.bab    { sql.push_str(" AND f.bab = ?");    binds.push(b.clone()); }
    if let Some(j) = &q.jenis  { sql.push_str(" AND f.jenis = ?");  binds.push(j.clone()); }
    if let Some(s) = &q.status { sql.push_str(" AND f.status = ?"); binds.push(s.clone()); }
    if let Some(s) = &q.search {
        sql.push_str(" AND (f.judul LIKE ? OR f.deskripsi LIKE ?)");
        let like = format!("%{}%", s);
        binds.push(like.clone()); binds.push(like);
    }
    sql.push_str(" ORDER BY f.bab, f.jenis, f.tahun DESC, f.id");

    let mut query = sqlx::query_as::<_, EvidenFolderWithEpCount>(&sql);
    for b in &binds { query = query.bind(b); }

    let rows = query.fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Serialize)]
pub struct EvidenFolderDetail {
    pub folder:   EvidenFolder,
    pub ep_list:  Vec<EpRef>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct EpRef {
    pub kd_ep:     String,
    pub deskripsi: String,
    pub bab:       String,
}

pub async fn get_eviden(
    user: crate::auth::middleware::AuthUser,
    State(state): State<AppState>,
    Path(id):     Path<i32>,
) -> Result<Json<EvidenFolderDetail>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "akreditasi_view")?;
    let folder: Option<EvidenFolder> = sqlx::query_as(
        "SELECT id, judul, url_drive, bab, jenis, CAST(tahun AS SIGNED) AS tahun, deskripsi, pic_nik, status \
         FROM eviden_folder WHERE id = ?"
    )
    .bind(id).fetch_optional(&state.pool).await.map_err(db_err)?;

    let folder = folder.ok_or_else(|| (
        StatusCode::NOT_FOUND, Json(json!({"error": "Folder tidak ditemukan"}))
    ))?;

    let ep_list: Vec<EpRef> = sqlx::query_as(
        "SELECT e.kd_ep, e.deskripsi, e.bab FROM eviden_folder_ep_map m \
         JOIN starkes_ep e ON e.kd_ep = m.kd_ep \
         WHERE m.folder_id = ? ORDER BY e.kelompok, e.bab, e.standar, e.nomor_ep"
    )
    .bind(id).fetch_all(&state.pool).await.unwrap_or_default();

    Ok(Json(EvidenFolderDetail { folder, ep_list }))
}

#[derive(Deserialize)]
pub struct EvidenInput {
    pub judul:     String,
    pub url_drive: String,
    pub bab:       Option<String>,
    pub jenis:     Option<String>,
    pub tahun:     Option<i16>,
    pub deskripsi: Option<String>,
    pub pic_nik:   Option<String>,
    pub kd_ep_list: Option<Vec<String>>,
}

pub async fn create_eviden(
    user: crate::auth::middleware::AuthUser,
    State(state): State<AppState>,
    Json(req):    Json<EvidenInput>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "akreditasi_edit")?;
    if req.judul.trim().is_empty() || req.url_drive.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error": "judul & url_drive wajib"}))));
    }

    let mut tx = state.pool.begin().await.map_err(db_err)?;

    let res = sqlx::query(
        "INSERT INTO eviden_folder (judul, url_drive, bab, jenis, tahun, deskripsi, pic_nik) \
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&req.judul)
    .bind(&req.url_drive)
    .bind(&req.bab)
    .bind(req.jenis.as_deref().unwrap_or("lainnya"))
    .bind(req.tahun)
    .bind(&req.deskripsi)
    .bind(&req.pic_nik)
    .execute(&mut *tx).await.map_err(db_err)?;

    let id = res.last_insert_id() as i32;

    if let Some(eps) = &req.kd_ep_list {
        for kd in eps {
            sqlx::query("INSERT IGNORE INTO eviden_folder_ep_map (folder_id, kd_ep) VALUES (?, ?)")
                .bind(id).bind(kd).execute(&mut *tx).await.map_err(db_err)?;
        }
    }

    tx.commit().await.map_err(db_err)?;

    let sql = format!(
        "INSERT INTO eviden_folder (id, judul, url_drive, bab, jenis, tahun, deskripsi, pic_nik) VALUES ({},{},{},{},{},{},{},{})",
        id,
        crate::audit::q(&req.judul),
        crate::audit::q(&req.url_drive),
        crate::audit::qo(req.bab.as_ref()),
        crate::audit::q(req.jenis.as_deref().unwrap_or("lainnya")),
        crate::audit::qo(req.tahun),
        crate::audit::qo(req.deskripsi.as_ref()),
        crate::audit::qo(req.pic_nik.as_ref()),
    );
    crate::audit::log_sql(&state.pool, "web", &sql).await;
    if let Some(eps) = &req.kd_ep_list {
        for kd in eps {
            let sql = format!(
                "INSERT IGNORE INTO eviden_folder_ep_map (folder_id, kd_ep) VALUES ({},{})",
                id, crate::audit::q(kd)
            );
            crate::audit::log_sql(&state.pool, "web", &sql).await;
        }
    }
    Ok(Json(json!({"id": id, "ok": true})))
}

pub async fn update_eviden(
    user: crate::auth::middleware::AuthUser,
    State(state): State<AppState>,
    Path(id):     Path<i32>,
    Json(req):    Json<EvidenInput>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "akreditasi_edit")?;
    let mut tx = state.pool.begin().await.map_err(db_err)?;

    sqlx::query(
        "UPDATE eviden_folder SET judul=?, url_drive=?, bab=?, jenis=?, tahun=?, deskripsi=?, pic_nik=? \
         WHERE id = ?"
    )
    .bind(&req.judul).bind(&req.url_drive).bind(&req.bab)
    .bind(req.jenis.as_deref().unwrap_or("lainnya"))
    .bind(req.tahun).bind(&req.deskripsi).bind(&req.pic_nik)
    .bind(id).execute(&mut *tx).await.map_err(db_err)?;

    if let Some(eps) = &req.kd_ep_list {
        sqlx::query("DELETE FROM eviden_folder_ep_map WHERE folder_id = ?")
            .bind(id).execute(&mut *tx).await.map_err(db_err)?;
        for kd in eps {
            sqlx::query("INSERT IGNORE INTO eviden_folder_ep_map (folder_id, kd_ep) VALUES (?, ?)")
                .bind(id).bind(kd).execute(&mut *tx).await.map_err(db_err)?;
        }
    }

    tx.commit().await.map_err(db_err)?;

    let sql = format!(
        "UPDATE eviden_folder SET judul={}, url_drive={}, bab={}, jenis={}, tahun={}, deskripsi={}, pic_nik={} WHERE id={}",
        crate::audit::q(&req.judul),
        crate::audit::q(&req.url_drive),
        crate::audit::qo(req.bab.as_ref()),
        crate::audit::q(req.jenis.as_deref().unwrap_or("lainnya")),
        crate::audit::qo(req.tahun),
        crate::audit::qo(req.deskripsi.as_ref()),
        crate::audit::qo(req.pic_nik.as_ref()),
        id,
    );
    crate::audit::log_sql(&state.pool, "web", &sql).await;
    if let Some(eps) = &req.kd_ep_list {
        let sql = format!("DELETE FROM eviden_folder_ep_map WHERE folder_id={}", id);
        crate::audit::log_sql(&state.pool, "web", &sql).await;
        for kd in eps {
            let sql = format!(
                "INSERT IGNORE INTO eviden_folder_ep_map (folder_id, kd_ep) VALUES ({},{})",
                id, crate::audit::q(kd)
            );
            crate::audit::log_sql(&state.pool, "web", &sql).await;
        }
    }
    Ok(Json(json!({"ok": true})))
}

pub async fn delete_eviden(
    user: crate::auth::middleware::AuthUser,
    State(state): State<AppState>,
    Path(id):     Path<i32>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "akreditasi_edit")?;
    let mut tx = state.pool.begin().await.map_err(db_err)?;
    sqlx::query("DELETE FROM eviden_folder_ep_map WHERE folder_id = ?")
        .bind(id).execute(&mut *tx).await.map_err(db_err)?;
    sqlx::query("DELETE FROM eviden_folder WHERE id = ?")
        .bind(id).execute(&mut *tx).await.map_err(db_err)?;
    tx.commit().await.map_err(db_err)?;
    let sql = format!("DELETE FROM eviden_folder_ep_map WHERE folder_id={}", id);
    crate::audit::log_sql(&state.pool, "web", &sql).await;
    let sql = format!("DELETE FROM eviden_folder WHERE id={}", id);
    crate::audit::log_sql(&state.pool, "web", &sql).await;
    Ok(Json(json!({"ok": true})))
}

// List folder yang ter-tag ke EP tertentu (dipakai halaman detail EP)
pub async fn list_eviden_by_ep(
    user: crate::auth::middleware::AuthUser,
    State(state): State<AppState>,
    Path(kd_ep):  Path<String>,
) -> Result<Json<Vec<EvidenFolder>>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "akreditasi_view")?;
    let rows: Vec<EvidenFolder> = sqlx::query_as(
        "SELECT f.id, f.judul, f.url_drive, f.bab, f.jenis, CAST(f.tahun AS SIGNED) AS tahun, f.deskripsi, f.pic_nik, f.status \
         FROM eviden_folder f \
         JOIN eviden_folder_ep_map m ON m.folder_id = f.id \
         WHERE m.kd_ep = ? AND f.status = 'aktif' \
         ORDER BY f.bab, f.jenis"
    )
    .bind(&kd_ep).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error eviden: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR,
     Json(json!({"error": "Database error", "detail": e.to_string()})))
}
