// Daftar Singkatan, Simbol & Kode dalam Rekam Medis (read-only).
// Sumber: master_singkatan_rscb (SK Direktur No.400.7.31/112/RSUD-CB/2026).

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB singkatan: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses daftar singkatan"})))
}

#[derive(Deserialize)]
pub struct ListQuery {
    #[serde(default)] pub q: Option<String>,
    #[serde(default)] pub kategori: Option<String>, // Diperbolehkan/Dilarang/Simbol; kosong=semua
}

#[derive(sqlx::FromRow)]
struct Row {
    kategori: String, singkatan: String, keterangan: String,
    misinterpretasi: String, wajib_gunakan: String,
}

pub async fn list(
    _u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let like = q.q.as_deref().map(|x| format!("%{}%", x.trim())).unwrap_or_else(|| "%".into());
    let kat = q.kategori.as_deref().map(|x| x.trim().to_string()).filter(|x| !x.is_empty());
    let rows: Vec<Row> = sqlx::query_as::<_, Row>(
        "SELECT kategori, singkatan, IFNULL(keterangan,'') keterangan, \
                IFNULL(misinterpretasi,'') misinterpretasi, IFNULL(wajib_gunakan,'') wajib_gunakan \
         FROM master_singkatan_rscb \
         WHERE (singkatan LIKE ? OR keterangan LIKE ?) AND (? IS NULL OR kategori=?) \
         ORDER BY (kategori='Dilarang') DESC, singkatan",
    )
    .bind(&like).bind(&like).bind(&kat).bind(&kat)
    .fetch_all(&s.pool).await.map_err(db_err)?;

    let data: Vec<Value> = rows.iter().map(|r| json!({
        "kategori": r.kategori, "singkatan": r.singkatan, "keterangan": r.keterangan,
        "misinterpretasi": r.misinterpretasi, "wajib_gunakan": r.wajib_gunakan,
    })).collect();
    Ok(Json(json!({ "total": data.len(), "data": data })))
}
