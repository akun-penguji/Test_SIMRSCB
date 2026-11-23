use crate::{
    auth::middleware::AuthUser,
    models::persetujuan_satusehat::{PersetujuanSatusehat, SimpanPersetujuanSatusehat},
    AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};

async fn ensure_table(pool: &sqlx::MySqlPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS simrscb_persetujuan_satusehat (
           no_rawat        VARCHAR(17)  NOT NULL PRIMARY KEY,
           no_rkm_medis    VARCHAR(15)  NOT NULL,
           persetujuan     ENUM('Setuju','Tidak Setuju') NOT NULL DEFAULT 'Setuju',
           nip_petugas     VARCHAR(40)  NOT NULL DEFAULT '',
           nama_petugas    VARCHAR(100) NOT NULL DEFAULT '',
           tgl_persetujuan DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
           INDEX idx_no_rm (no_rkm_medis),
           INDEX idx_tgl   (tgl_persetujuan)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    ).execute(pool).await?;
    Ok(())
}

pub async fn get_by_no_rawat(
    user: AuthUser,
    State(state): State<AppState>,
    Path(no_rawat): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "consent_view")?;
    ensure_table(&state.pool).await.map_err(db_err)?;

    let row: Option<PersetujuanSatusehat> = sqlx::query_as(
        "SELECT no_rawat, no_rkm_medis, persetujuan, nip_petugas, nama_petugas,
                DATE_FORMAT(tgl_persetujuan,'%Y-%m-%d %H:%i:%s') AS tgl_persetujuan
         FROM simrscb_persetujuan_satusehat
         WHERE no_rawat = ? LIMIT 1"
    ).bind(&no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;

    Ok(Json(json!({ "data": row })))
}

pub async fn simpan(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<SimpanPersetujuanSatusehat>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_consent_edit(&user)?;
    ensure_table(&state.pool).await.map_err(db_err)?;

    if body.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error": "no_rawat wajib diisi"}))));
    }
    let persetujuan = match body.persetujuan.as_str() {
        "Setuju" | "Tidak Setuju" => body.persetujuan.as_str(),
        _ => return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error": "persetujuan harus 'Setuju' atau 'Tidak Setuju'"})))),
    };

    let no_rkm_medis: String = sqlx::query_as::<_, (String,)>(
        "SELECT no_rkm_medis FROM reg_periksa WHERE no_rawat = ? LIMIT 1"
    ).bind(&body.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?
     .map(|t| t.0)
     .ok_or_else(|| (StatusCode::NOT_FOUND,
         Json(json!({"error": "no_rawat tidak ditemukan di reg_periksa"}))))?;

    let nip  = body.nip_petugas.unwrap_or_else(|| user.0.kode.clone());
    let nama = body.nama_petugas.unwrap_or_else(|| user.0.nama.clone());

    sqlx::query(
        "INSERT INTO simrscb_persetujuan_satusehat
         (no_rawat, no_rkm_medis, persetujuan, nip_petugas, nama_petugas, tgl_persetujuan)
         VALUES (?,?,?,?,?, NOW())
         ON DUPLICATE KEY UPDATE
           persetujuan     = VALUES(persetujuan),
           nip_petugas     = VALUES(nip_petugas),
           nama_petugas    = VALUES(nama_petugas),
           tgl_persetujuan = NOW()"
    )
    .bind(&body.no_rawat).bind(&no_rkm_medis).bind(persetujuan)
    .bind(&nip).bind(&nama)
    .execute(&state.pool).await.map_err(db_err)?;

    use crate::audit::q;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO simrscb_persetujuan_satusehat (no_rawat, no_rkm_medis, persetujuan, nip_petugas, nama_petugas, tgl_persetujuan) VALUES ({}, {}, {}, {}, {}, NOW())",
        q(&body.no_rawat), q(&no_rkm_medis), q(persetujuan), q(&nip), q(&nama)
    )).await;

    Ok(Json(json!({
        "success": true,
        "no_rawat": body.no_rawat,
        "persetujuan": persetujuan
    })))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error persetujuan_satusehat: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
