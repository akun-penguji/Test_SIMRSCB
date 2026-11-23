// Downtime SIMRS — log kejadian waktu henti sistem.
// Per Juknis MRMIK 13.1 STARKES.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error downtime: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DowntimeRow {
    pub id:               i32,
    pub tanggal_mulai:    String,
    pub tanggal_selesai:  Option<String>,
    pub durasi_menit:     Option<i32>,
    pub jenis:            String,
    pub kategori:         String,
    pub unit_terdampak:   Option<String>,
    pub judul:            String,
    pub dampak:           Option<String>,
    pub prosedur_manual:  Option<String>,
    pub root_cause:       Option<String>,
    pub tindakan:         Option<String>,
    pub evaluasi_pasca:   Option<String>,
    pub rca_complete:     i8,
    pub staf_terlatih:    i8,
    pub status:           String,
    pub pic_nip:          Option<String>,
    pub pelapor_nip:      Option<String>,
    pub created_at:       Option<String>,
    pub updated_at:       Option<String>,
    pub updated_by:       Option<String>,
}

const COLUMNS: &str = "
  id,
  DATE_FORMAT(tanggal_mulai,'%Y-%m-%d %H:%i:%s') AS tanggal_mulai,
  DATE_FORMAT(tanggal_selesai,'%Y-%m-%d %H:%i:%s') AS tanggal_selesai,
  durasi_menit, jenis, kategori, unit_terdampak, judul, dampak,
  prosedur_manual, root_cause, tindakan, evaluasi_pasca,
  rca_complete, staf_terlatih, status, pic_nip, pelapor_nip,
  DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at,
  DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s') AS updated_at,
  updated_by
";

// ── GET /api/downtime?tahun=YYYY&status=&kategori=&jenis= ─────────────────────
#[derive(Deserialize)]
pub struct ListQuery {
    pub tahun:    Option<i32>,
    pub status:   Option<String>,
    pub kategori: Option<String>,
    pub jenis:    Option<String>,
    pub q:        Option<String>,
}

pub async fn list_downtime(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<DowntimeRow>>, (StatusCode, Json<Value>)> {
    let qs = q.q.as_deref().filter(|s| !s.trim().is_empty()).map(|s| format!("%{}%", s.trim()));
    let sql = format!(
        "SELECT {} FROM simrscb_simrs_downtime
         WHERE (? IS NULL OR YEAR(tanggal_mulai) = ?)
           AND (? IS NULL OR status   = ?)
           AND (? IS NULL OR kategori = ?)
           AND (? IS NULL OR jenis    = ?)
           AND (? IS NULL OR judul LIKE ? OR dampak LIKE ? OR unit_terdampak LIKE ?)
         ORDER BY tanggal_mulai DESC, id DESC
         LIMIT 500",
        COLUMNS
    );
    let rows: Vec<DowntimeRow> = sqlx::query_as(&sql)
        .bind(q.tahun).bind(q.tahun)
        .bind(&q.status).bind(&q.status)
        .bind(&q.kategori).bind(&q.kategori)
        .bind(&q.jenis).bind(&q.jenis)
        .bind(&qs).bind(&qs).bind(&qs).bind(&qs)
        .fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// ── GET /api/downtime/:id ────────────────────────────────────────────────────
pub async fn get_downtime(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<DowntimeRow>, (StatusCode, Json<Value>)> {
    let sql = format!("SELECT {} FROM simrscb_simrs_downtime WHERE id=?", COLUMNS);
    let row: Option<DowntimeRow> = sqlx::query_as(&sql).bind(id)
        .fetch_optional(&state.pool).await.map_err(db_err)?;
    row.map(Json).ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"not found"}))))
}

// ── POST /api/downtime + PUT /api/downtime/:id ───────────────────────────────
#[derive(Deserialize)]
pub struct UpsertBody {
    pub tanggal_mulai:   String,             // "YYYY-MM-DD HH:mm:ss"
    pub tanggal_selesai: Option<String>,
    pub jenis:           Option<String>,     // planned/incident
    pub kategori:        Option<String>,     // jaringan/listrik/...
    pub unit_terdampak:  Option<String>,
    pub judul:           String,
    pub dampak:          Option<String>,
    pub prosedur_manual: Option<String>,
    pub root_cause:      Option<String>,
    pub tindakan:        Option<String>,
    pub evaluasi_pasca:  Option<String>,
    pub rca_complete:    Option<i8>,
    pub staf_terlatih:   Option<i8>,
    pub status:          Option<String>,     // aktif/selesai/dievaluasi
    pub pic_nip:         Option<String>,
    pub pelapor_nip:     Option<String>,
}

fn compute_durasi(mulai: &str, selesai: &Option<String>) -> Option<i32> {
    let m = chrono::NaiveDateTime::parse_from_str(mulai, "%Y-%m-%d %H:%M:%S").ok()?;
    let s = chrono::NaiveDateTime::parse_from_str(selesai.as_deref()?, "%Y-%m-%d %H:%M:%S").ok()?;
    let dur = s.signed_duration_since(m).num_minutes() as i32;
    if dur < 0 { None } else { Some(dur) }
}

pub async fn create_downtime(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<UpsertBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let durasi = compute_durasi(&b.tanggal_mulai, &b.tanggal_selesai);
    let r = sqlx::query(
        "INSERT INTO simrscb_simrs_downtime
         (tanggal_mulai, tanggal_selesai, durasi_menit, jenis, kategori, unit_terdampak,
          judul, dampak, prosedur_manual, root_cause, tindakan, evaluasi_pasca,
          rca_complete, staf_terlatih, status, pic_nip, pelapor_nip, updated_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    )
    .bind(&b.tanggal_mulai).bind(&b.tanggal_selesai).bind(durasi)
    .bind(b.jenis.as_deref().unwrap_or("incident"))
    .bind(b.kategori.as_deref().unwrap_or("lainnya"))
    .bind(&b.unit_terdampak).bind(&b.judul).bind(&b.dampak)
    .bind(&b.prosedur_manual).bind(&b.root_cause).bind(&b.tindakan).bind(&b.evaluasi_pasca)
    .bind(b.rca_complete.unwrap_or(0)).bind(b.staf_terlatih.unwrap_or(0))
    .bind(b.status.as_deref().unwrap_or(if b.tanggal_selesai.is_some() { "selesai" } else { "aktif" }))
    .bind(&b.pic_nip).bind(b.pelapor_nip.as_ref().or(Some(&user.0.kode)))
    .bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;

    use crate::audit::{q, qo};
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO simrscb_simrs_downtime (tanggal_mulai, tanggal_selesai, durasi_menit, jenis, kategori, unit_terdampak, judul, dampak, prosedur_manual, root_cause, tindakan, evaluasi_pasca, rca_complete, staf_terlatih, status, pic_nip, pelapor_nip, updated_by) VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})",
        q(&b.tanggal_mulai), qo(b.tanggal_selesai.as_ref()), qo(durasi),
        q(b.jenis.as_deref().unwrap_or("incident")), q(b.kategori.as_deref().unwrap_or("lainnya")),
        qo(b.unit_terdampak.as_ref()), q(&b.judul), qo(b.dampak.as_ref()),
        qo(b.prosedur_manual.as_ref()), qo(b.root_cause.as_ref()), qo(b.tindakan.as_ref()), qo(b.evaluasi_pasca.as_ref()),
        b.rca_complete.unwrap_or(0), b.staf_terlatih.unwrap_or(0),
        q(b.status.as_deref().unwrap_or(if b.tanggal_selesai.is_some() { "selesai" } else { "aktif" })),
        qo(b.pic_nip.as_ref()), q(b.pelapor_nip.as_deref().unwrap_or(user.0.kode.as_str())), q(&user.0.kode)
    )).await;

    Ok(Json(json!({"ok": true, "id": r.last_insert_id()})))
}

pub async fn update_downtime(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
    Json(b): Json<UpsertBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let durasi = compute_durasi(&b.tanggal_mulai, &b.tanggal_selesai);
    sqlx::query(
        "UPDATE simrscb_simrs_downtime SET
           tanggal_mulai=?, tanggal_selesai=?, durasi_menit=?,
           jenis=COALESCE(?, jenis), kategori=COALESCE(?, kategori),
           unit_terdampak=?, judul=?, dampak=?, prosedur_manual=?,
           root_cause=?, tindakan=?, evaluasi_pasca=?,
           rca_complete=COALESCE(?, rca_complete),
           staf_terlatih=COALESCE(?, staf_terlatih),
           status=COALESCE(?, status),
           pic_nip=?, pelapor_nip=COALESCE(?, pelapor_nip),
           updated_by=?
         WHERE id=?"
    )
    .bind(&b.tanggal_mulai).bind(&b.tanggal_selesai).bind(durasi)
    .bind(&b.jenis).bind(&b.kategori)
    .bind(&b.unit_terdampak).bind(&b.judul).bind(&b.dampak).bind(&b.prosedur_manual)
    .bind(&b.root_cause).bind(&b.tindakan).bind(&b.evaluasi_pasca)
    .bind(b.rca_complete).bind(b.staf_terlatih).bind(&b.status)
    .bind(&b.pic_nip).bind(&b.pelapor_nip)
    .bind(&user.0.kode).bind(id)
    .execute(&state.pool).await.map_err(db_err)?;

    use crate::audit::{q, qo};
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "UPDATE simrscb_simrs_downtime SET tanggal_mulai={}, tanggal_selesai={}, durasi_menit={}, jenis=COALESCE({}, jenis), kategori=COALESCE({}, kategori), unit_terdampak={}, judul={}, dampak={}, prosedur_manual={}, root_cause={}, tindakan={}, evaluasi_pasca={}, rca_complete=COALESCE({}, rca_complete), staf_terlatih=COALESCE({}, staf_terlatih), status=COALESCE({}, status), pic_nip={}, pelapor_nip=COALESCE({}, pelapor_nip), updated_by={} WHERE id={}",
        q(&b.tanggal_mulai), qo(b.tanggal_selesai.as_ref()), qo(durasi),
        qo(b.jenis.as_ref()), qo(b.kategori.as_ref()),
        qo(b.unit_terdampak.as_ref()), q(&b.judul), qo(b.dampak.as_ref()),
        qo(b.prosedur_manual.as_ref()), qo(b.root_cause.as_ref()), qo(b.tindakan.as_ref()), qo(b.evaluasi_pasca.as_ref()),
        qo(b.rca_complete), qo(b.staf_terlatih), qo(b.status.as_ref()),
        qo(b.pic_nip.as_ref()), qo(b.pelapor_nip.as_ref()), q(&user.0.kode), id
    )).await;

    Ok(Json(json!({"ok": true})))
}

pub async fn delete_downtime(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query("DELETE FROM simrscb_simrs_downtime WHERE id=?")
        .bind(id).execute(&state.pool).await.map_err(db_err)?;

    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "DELETE FROM simrscb_simrs_downtime WHERE id={}", id
    )).await;

    Ok(Json(json!({"ok": true})))
}

// ── GET /api/downtime/laporan?tahun=YYYY ─────────────────────────────────────
pub async fn laporan(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or_else(|| chrono::Local::now().format("%Y").to_string().parse().unwrap_or(2026));

    #[derive(sqlx::FromRow)]
    struct Ag {
        total:          i64,
        n_aktif:        i64,
        n_selesai:      i64,
        n_dievaluasi:   i64,
        n_rca_complete: i64,
        n_staf_terlatih: i64,
        total_menit:    Option<i64>,
        avg_menit:      Option<f64>,
        max_menit:      Option<i32>,
    }
    let ag: Ag = sqlx::query_as(
        "SELECT
           CAST(COUNT(*) AS SIGNED) AS total,
           CAST(IFNULL(SUM(status='aktif'),0) AS SIGNED) AS n_aktif,
           CAST(IFNULL(SUM(status='selesai'),0) AS SIGNED) AS n_selesai,
           CAST(IFNULL(SUM(status='dievaluasi'),0) AS SIGNED) AS n_dievaluasi,
           CAST(IFNULL(SUM(rca_complete=1),0) AS SIGNED) AS n_rca_complete,
           CAST(IFNULL(SUM(staf_terlatih=1),0) AS SIGNED) AS n_staf_terlatih,
           CAST(IFNULL(SUM(durasi_menit),0) AS SIGNED) AS total_menit,
           CAST(AVG(durasi_menit) AS DOUBLE) AS avg_menit,
           CAST(MAX(durasi_menit) AS SIGNED) AS max_menit
         FROM simrscb_simrs_downtime WHERE YEAR(tanggal_mulai) = ?"
    ).bind(tahun).fetch_one(&state.pool).await.map_err(db_err)?;

    #[derive(sqlx::FromRow, Serialize)]
    struct CatRow { kategori: String, total: i64, total_menit: Option<i64> }
    let per_kategori: Vec<CatRow> = sqlx::query_as(
        "SELECT kategori, CAST(COUNT(*) AS SIGNED) AS total,
                CAST(IFNULL(SUM(durasi_menit),0) AS SIGNED) AS total_menit
         FROM simrscb_simrs_downtime
         WHERE YEAR(tanggal_mulai) = ?
         GROUP BY kategori
         ORDER BY total DESC"
    ).bind(tahun).fetch_all(&state.pool).await.unwrap_or_default();

    #[derive(sqlx::FromRow, Serialize)]
    struct MonthRow { bulan: i32, total: i64, total_menit: Option<i64> }
    let per_bulan: Vec<MonthRow> = sqlx::query_as(
        "SELECT CAST(MONTH(tanggal_mulai) AS SIGNED) AS bulan,
                CAST(COUNT(*) AS SIGNED) AS total,
                CAST(IFNULL(SUM(durasi_menit),0) AS SIGNED) AS total_menit
         FROM simrscb_simrs_downtime
         WHERE YEAR(tanggal_mulai) = ?
         GROUP BY MONTH(tanggal_mulai)
         ORDER BY bulan"
    ).bind(tahun).fetch_all(&state.pool).await.unwrap_or_default();

    Ok(Json(json!({
        "tahun": tahun,
        "ringkasan": {
            "total_kejadian":  ag.total,
            "aktif":           ag.n_aktif,
            "selesai":         ag.n_selesai,
            "dievaluasi":      ag.n_dievaluasi,
            "rca_complete":    ag.n_rca_complete,
            "staf_terlatih":   ag.n_staf_terlatih,
            "total_menit":     ag.total_menit.unwrap_or(0),
            "avg_menit":       ag.avg_menit.unwrap_or(0.0),
            "max_menit":       ag.max_menit.unwrap_or(0),
        },
        "per_kategori": per_kategori,
        "per_bulan":    per_bulan,
    })))
}
