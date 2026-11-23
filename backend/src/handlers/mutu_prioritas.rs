// Skoring Indikator Mutu Prioritas — metode High Risk / High Volume / Problem Prone.
// Total = HR*50 + HV*30 + PP*20. Diurutkan menurun untuk memilih 5 (atau N) besar.
// Skor HR/HV/PP (1-5) di-input manual oleh Komite Mutu (bukan otomatis dari SIMRS).

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB mutu_prioritas: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data skoring mutu prioritas"})))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Skor {
    pub id: i64,
    pub periode: String,
    pub indikator: String,
    pub hr: i32,
    pub hv: i32,
    pub pp: i32,
    pub keterangan: String,
    pub total: i64, // hr*50 + hv*30 + pp*20 (dihitung di SQL)
}

#[derive(Deserialize)]
pub struct ListQuery {
    #[serde(default)]
    pub periode: Option<String>,
}

/// Daftar indikator satu periode, terurut Total menurun (siap diberi ranking).
pub async fn list(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let periode = q.periode.unwrap_or_default();
    let rows: Vec<Skor> = sqlx::query_as::<_, Skor>(
        "SELECT id, periode, indikator, hr, hv, pp, keterangan, (hr*50 + hv*30 + pp*20) AS total \
         FROM mutu_indikator_prioritas WHERE periode = ? ORDER BY total DESC, indikator ASC",
    )
    .bind(&periode)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;
    Ok(Json(json!({ "periode": periode, "data": rows })))
}

/// Daftar periode yang pernah dibuat (untuk dropdown).
pub async fn periode_list(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let periods: Vec<String> = sqlx::query_scalar(
        "SELECT DISTINCT periode FROM mutu_indikator_prioritas ORDER BY periode DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;
    Ok(Json(json!({ "data": periods })))
}

#[derive(Deserialize)]
pub struct SaveBody {
    #[serde(default)]
    pub id: Option<i64>,
    pub periode: String,
    pub indikator: String,
    #[serde(default)]
    pub hr: i32,
    #[serde(default)]
    pub hv: i32,
    #[serde(default)]
    pub pp: i32,
    #[serde(default)]
    pub keterangan: String,
}

fn clamp05(v: i32) -> i32 {
    v.clamp(0, 5)
}

/// Tambah (id kosong) atau ubah (id ada) satu baris indikator.
pub async fn save(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<SaveBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.periode.trim().is_empty() || b.indikator.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Periode & indikator wajib diisi"}))));
    }
    let (hr, hv, pp) = (clamp05(b.hr), clamp05(b.hv), clamp05(b.pp));
    match b.id {
        Some(id) if id > 0 => {
            sqlx::query(
                "UPDATE mutu_indikator_prioritas SET periode=?, indikator=?, hr=?, hv=?, pp=?, keterangan=?, nip=? WHERE id=?",
            )
            .bind(&b.periode).bind(&b.indikator).bind(hr).bind(hv).bind(pp)
            .bind(&b.keterangan).bind(&user.0.kode).bind(id)
            .execute(&state.pool).await.map_err(db_err)?;
            Ok(Json(json!({ "ok": true, "id": id })))
        }
        _ => {
            let res = sqlx::query(
                "INSERT INTO mutu_indikator_prioritas (periode, indikator, hr, hv, pp, keterangan, nip) VALUES (?,?,?,?,?,?,?)",
            )
            .bind(&b.periode).bind(&b.indikator).bind(hr).bind(hv).bind(pp)
            .bind(&b.keterangan).bind(&user.0.kode)
            .execute(&state.pool).await.map_err(db_err)?;
            Ok(Json(json!({ "ok": true, "id": res.last_insert_id() })))
        }
    }
}

pub async fn del(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query("DELETE FROM mutu_indikator_prioritas WHERE id=?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(db_err)?;
    Ok(Json(json!({ "ok": true })))
}
