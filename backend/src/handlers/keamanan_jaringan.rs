// Pemeliharaan Keamanan Jaringan & Pembaruan Anti-Malware Perangkat.
// Register/log kegiatan keamanan informasi (MRMIK — keamanan data & informasi):
// pemeliharaan jaringan (firewall, monitoring, patch, backup) + pembaruan anti-malware
// per perangkat (versi definisi, hasil scan). CRUD sederhana + ringkasan.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error keamanan_jaringan: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Row {
    pub id:             i32,
    pub tanggal:        String,
    pub jenis:          String,
    pub kegiatan:       String,
    pub perangkat:      Option<String>,
    pub ip_address:     Option<String>,
    pub antivirus:      Option<String>,
    pub versi_definisi: Option<String>,
    pub hasil:          Option<String>,
    pub temuan:         Option<String>,
    pub tindak_lanjut:  Option<String>,
    pub status:         String,
    pub petugas:        Option<String>,
    pub petugas_nip:    Option<String>,
    pub keterangan:     Option<String>,
    pub created_at:     Option<String>,
    pub updated_at:     Option<String>,
}

const COLUMNS: &str = "
  id, DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal, jenis, kegiatan, perangkat, ip_address,
  antivirus, versi_definisi, hasil, temuan, tindak_lanjut, status, petugas, petugas_nip, keterangan,
  DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at,
  DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at
";

// ── GET /api/keamanan-jaringan?tahun=&jenis=&status=&q= ───────────────────────
#[derive(Deserialize)]
pub struct ListQuery {
    pub tahun:  Option<i32>,
    pub jenis:  Option<String>,
    pub status: Option<String>,
    pub q:      Option<String>,
}

pub async fn list(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Row>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|s| !s.trim().is_empty()).map(|s| format!("%{}%", s.trim()));
    let sql = format!(
        "SELECT {} FROM simrscb_keamanan_jaringan
         WHERE (? IS NULL OR YEAR(tanggal) = ?)
           AND (? IS NULL OR jenis  = ?)
           AND (? IS NULL OR status = ?)
           AND (? IS NULL OR kegiatan LIKE ? OR perangkat LIKE ? OR hasil LIKE ? OR antivirus LIKE ?)
         ORDER BY tanggal DESC, id DESC
         LIMIT 1000",
        COLUMNS
    );
    let rows: Vec<Row> = sqlx::query_as(&sql)
        .bind(q.tahun).bind(q.tahun)
        .bind(&q.jenis).bind(&q.jenis)
        .bind(&q.status).bind(&q.status)
        .bind(&qs).bind(&qs).bind(&qs).bind(&qs).bind(&qs)
        .fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// ── GET /api/keamanan-jaringan/:id ───────────────────────────────────────────
pub async fn get_one(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<Row>, (StatusCode, Json<Value>)> {
    let sql = format!("SELECT {} FROM simrscb_keamanan_jaringan WHERE id=?", COLUMNS);
    let row: Option<Row> = sqlx::query_as(&sql).bind(id)
        .fetch_optional(&state.pool).await.map_err(db_err)?;
    row.map(Json).ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"not found"}))))
}

// ── POST + PUT ───────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct UpsertBody {
    pub tanggal:        String,           // "YYYY-MM-DD"
    pub jenis:          Option<String>,   // Jaringan | Anti-Malware
    pub kegiatan:       String,
    pub perangkat:      Option<String>,
    pub ip_address:     Option<String>,
    pub antivirus:      Option<String>,
    pub versi_definisi: Option<String>,
    pub hasil:          Option<String>,
    pub temuan:         Option<String>,
    pub tindak_lanjut:  Option<String>,
    pub status:         Option<String>,
    pub petugas:        Option<String>,
    pub petugas_nip:    Option<String>,
    pub keterangan:     Option<String>,
}

pub async fn create(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<UpsertBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let r = sqlx::query(
        "INSERT INTO simrscb_keamanan_jaringan
         (tanggal, jenis, kegiatan, perangkat, ip_address, antivirus, versi_definisi,
          hasil, temuan, tindak_lanjut, status, petugas, petugas_nip, keterangan, updated_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    )
    .bind(&b.tanggal)
    .bind(b.jenis.as_deref().unwrap_or("Jaringan"))
    .bind(&b.kegiatan).bind(&b.perangkat).bind(&b.ip_address)
    .bind(&b.antivirus).bind(&b.versi_definisi)
    .bind(&b.hasil).bind(&b.temuan).bind(&b.tindak_lanjut)
    .bind(b.status.as_deref().unwrap_or("Selesai"))
    .bind(&b.petugas)
    .bind(b.petugas_nip.as_ref().or(Some(&user.0.kode)))
    .bind(&b.keterangan)
    .bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}

pub async fn update(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(b): Json<UpsertBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query(
        "UPDATE simrscb_keamanan_jaringan SET
           tanggal=?, jenis=COALESCE(?, jenis), kegiatan=?, perangkat=?, ip_address=?,
           antivirus=?, versi_definisi=?, hasil=?, temuan=?, tindak_lanjut=?,
           status=COALESCE(?, status), petugas=?, petugas_nip=COALESCE(?, petugas_nip),
           keterangan=?, updated_by=?
         WHERE id=?"
    )
    .bind(&b.tanggal).bind(&b.jenis).bind(&b.kegiatan).bind(&b.perangkat).bind(&b.ip_address)
    .bind(&b.antivirus).bind(&b.versi_definisi).bind(&b.hasil).bind(&b.temuan).bind(&b.tindak_lanjut)
    .bind(&b.status).bind(&b.petugas).bind(&b.petugas_nip)
    .bind(&b.keterangan).bind(&user.0.kode).bind(id)
    .execute(&state.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

pub async fn delete(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query("DELETE FROM simrscb_keamanan_jaringan WHERE id=?")
        .bind(id).execute(&state.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── GET /api/keamanan-jaringan/laporan?tahun= ────────────────────────────────
#[derive(Deserialize)]
pub struct LaporanQuery { pub tahun: Option<i32> }

pub async fn laporan(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<LaporanQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let now = chrono::Local::now();
    let tahun = q.tahun.unwrap_or_else(|| now.format("%Y").to_string().parse().unwrap_or(2025));

    let per_jenis: Vec<(String, i64)> = sqlx::query_as(
        "SELECT jenis, COUNT(*) n FROM simrscb_keamanan_jaringan WHERE YEAR(tanggal)=? GROUP BY jenis ORDER BY n DESC")
        .bind(tahun).fetch_all(&state.pool).await.map_err(db_err)?;
    let per_bulan: Vec<(i32, i64)> = sqlx::query_as(
        "SELECT MONTH(tanggal) b, COUNT(*) n FROM simrscb_keamanan_jaringan WHERE YEAR(tanggal)=? GROUP BY b ORDER BY b")
        .bind(tahun).fetch_all(&state.pool).await.map_err(db_err)?;
    let (total, ada_temuan): (i64, i64) = sqlx::query_as(
        "SELECT CAST(COUNT(*) AS SIGNED), CAST(SUM(CASE WHEN temuan IS NOT NULL AND temuan<>'' THEN 1 ELSE 0 END) AS SIGNED) \
         FROM simrscb_keamanan_jaringan WHERE YEAR(tanggal)=?")
        .bind(tahun).fetch_one(&state.pool).await.unwrap_or((0, 0));

    Ok(Json(json!({
        "tahun": tahun,
        "total": total,
        "ada_temuan": ada_temuan,
        "per_jenis": per_jenis.into_iter().map(|(j, n)| json!({"jenis": j, "jumlah": n})).collect::<Vec<_>>(),
        "per_bulan": per_bulan.into_iter().map(|(b, n)| json!({"bulan": b, "jumlah": n})).collect::<Vec<_>>(),
    })))
}
