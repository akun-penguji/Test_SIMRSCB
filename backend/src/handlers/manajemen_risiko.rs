// Modul Manajemen Risiko / FMEA (RSCB).
// Register risiko + FMEA: Severity x Occurrence x Detectability = RPN, plus RPN residual
// (pasca-mitigasi), dan rencana mitigasi (Program/Kegiatan/PIC/Target/Status) per risiko.
//
// Tabel:
//   manajemen_risiko_rscb           : header risiko (1 baris = 1 modus kegagalan/risiko)
//   manajemen_risiko_mitigasi_rscb  : rencana mitigasi (1..N per risiko)

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB manajemen_risiko: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data manajemen risiko"})))
}

// Band grading berdasarkan RPN (S x O x D, tiap 1-10 -> 1..1000).
fn grading(rpn: i64) -> &'static str {
    if rpn >= 200 { "Sangat Tinggi" }
    else if rpn >= 100 { "Tinggi" }
    else if rpn >= 40 { "Sedang" }
    else { "Rendah" }
}

fn clamp10(v: i64) -> i64 { v.clamp(1, 10) }
fn opt(s: &str) -> Option<String> { let t = s.trim(); if t.is_empty() { None } else { Some(t.to_string()) } }
fn opt_date(s: &str) -> Option<String> {
    let t = s.trim();
    if t.is_empty() || t.starts_with("0000") { None } else { Some(t[..t.len().min(10)].to_string()) }
}

// ── LIST ─────────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct ListQuery {
    #[serde(default)] pub tahun: Option<i64>,
    #[serde(default)] pub unit: Option<String>,
    #[serde(default)] pub q: Option<String>,
}

#[derive(sqlx::FromRow)]
struct RiskRow {
    id: i64, tahun: Option<i64>, unit: String, kategori: String, proses: String,
    modus_kegagalan: String, penyebab: String, dampak: String,
    severity: i64, occurrence: i64, detectability: i64, rpn: i64,
    severity_residu: Option<i64>, occurrence_residu: Option<i64>, detectability_residu: Option<i64>, rpn_residu: Option<i64>,
    pic: String, target_tanggal: Option<String>, status: String,
    tanggal_identifikasi: Option<String>, keterangan: String,
    jml_mitigasi: i64,
}

fn risk_json(r: &RiskRow) -> Value {
    json!({
        "id": r.id, "tahun": r.tahun, "unit": r.unit, "kategori": r.kategori, "proses": r.proses,
        "modus_kegagalan": r.modus_kegagalan, "penyebab": r.penyebab, "dampak": r.dampak,
        "severity": r.severity, "occurrence": r.occurrence, "detectability": r.detectability,
        "rpn": r.rpn, "grading": grading(r.rpn),
        "severity_residu": r.severity_residu, "occurrence_residu": r.occurrence_residu,
        "detectability_residu": r.detectability_residu, "rpn_residu": r.rpn_residu,
        "grading_residu": r.rpn_residu.map(grading),
        "pic": r.pic, "target_tanggal": r.target_tanggal, "status": r.status,
        "tanggal_identifikasi": r.tanggal_identifikasi, "keterangan": r.keterangan,
        "jml_mitigasi": r.jml_mitigasi,
    })
}

pub async fn list(
    _u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let like = q.q.as_deref().map(|x| format!("%{}%", x.trim())).unwrap_or_else(|| "%".into());
    let unit = q.unit.as_deref().map(|x| x.trim().to_string()).filter(|x| !x.is_empty());
    let rows: Vec<RiskRow> = sqlx::query_as::<_, RiskRow>(
        "SELECT r.id, r.tahun, IFNULL(r.unit,'') unit, IFNULL(r.kategori,'') kategori, IFNULL(r.proses,'') proses, \
                IFNULL(r.modus_kegagalan,'') modus_kegagalan, IFNULL(r.penyebab,'') penyebab, IFNULL(r.dampak,'') dampak, \
                IFNULL(r.severity,1) severity, IFNULL(r.occurrence,1) occurrence, IFNULL(r.detectability,1) detectability, IFNULL(r.rpn,1) rpn, \
                r.severity_residu, r.occurrence_residu, r.detectability_residu, r.rpn_residu, \
                IFNULL(r.pic,'') pic, CAST(r.target_tanggal AS CHAR) target_tanggal, IFNULL(r.status,'') status, \
                CAST(r.tanggal_identifikasi AS CHAR) tanggal_identifikasi, IFNULL(r.keterangan,'') keterangan, \
                (SELECT COUNT(*) FROM manajemen_risiko_mitigasi_rscb m WHERE m.id_risiko=r.id) jml_mitigasi \
         FROM manajemen_risiko_rscb r \
         WHERE (? IS NULL OR r.tahun=?) \
           AND (? IS NULL OR r.unit=?) \
           AND (r.unit LIKE ? OR r.proses LIKE ? OR r.modus_kegagalan LIKE ?) \
         ORDER BY r.rpn DESC, r.id DESC",
    )
    .bind(q.tahun).bind(q.tahun)
    .bind(&unit).bind(&unit)
    .bind(&like).bind(&like).bind(&like)
    .fetch_all(&s.pool).await.map_err(db_err)?;

    let mut band = [0i64; 4]; // Sangat Tinggi, Tinggi, Sedang, Rendah
    for r in &rows {
        match grading(r.rpn) { "Sangat Tinggi" => band[0]+=1, "Tinggi" => band[1]+=1, "Sedang" => band[2]+=1, _ => band[3]+=1 }
    }
    let data: Vec<Value> = rows.iter().map(risk_json).collect();
    Ok(Json(json!({
        "ringkasan": { "total": rows.len(), "sangat_tinggi": band[0], "tinggi": band[1], "sedang": band[2], "rendah": band[3] },
        "data": data
    })))
}

// ── DETAIL (risiko + mitigasi) ───────────────────────────────────────────────
#[derive(sqlx::FromRow)]
struct MitRow { id: i64, program: String, kegiatan: String, pic: String, target: String, status: String, progres: String, urut: i64 }

fn mit_json(m: &MitRow) -> Value {
    json!({ "id": m.id, "program": m.program, "kegiatan": m.kegiatan, "pic": m.pic,
            "target": m.target, "status": m.status, "progres": m.progres, "urut": m.urut })
}

pub async fn detail(
    _u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mits: Vec<MitRow> = sqlx::query_as::<_, MitRow>(
        "SELECT id, IFNULL(program,'') program, IFNULL(kegiatan,'') kegiatan, IFNULL(pic,'') pic, \
                IFNULL(target,'') target, IFNULL(status,'') status, IFNULL(progres,'') progres, IFNULL(urut,0) urut \
         FROM manajemen_risiko_mitigasi_rscb WHERE id_risiko=? ORDER BY urut, id",
    ).bind(id).fetch_all(&s.pool).await.map_err(db_err)?;
    let list: Vec<Value> = mits.iter().map(mit_json).collect();
    Ok(Json(json!({ "mitigasi": list })))
}

// ── SIMPAN RISIKO (upsert) ───────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct RiskBody {
    #[serde(default)] pub id: Option<i64>,
    #[serde(default)] pub tahun: Option<i64>,
    #[serde(default)] pub unit: String,
    #[serde(default)] pub kategori: String,
    #[serde(default)] pub proses: String,
    #[serde(default)] pub modus_kegagalan: String,
    #[serde(default)] pub penyebab: String,
    #[serde(default)] pub dampak: String,
    #[serde(default = "one")] pub severity: i64,
    #[serde(default = "one")] pub occurrence: i64,
    #[serde(default = "one")] pub detectability: i64,
    #[serde(default)] pub severity_residu: Option<i64>,
    #[serde(default)] pub occurrence_residu: Option<i64>,
    #[serde(default)] pub detectability_residu: Option<i64>,
    #[serde(default)] pub pic: String,
    #[serde(default)] pub target_tanggal: String,
    #[serde(default)] pub status: String,
    #[serde(default)] pub tanggal_identifikasi: String,
    #[serde(default)] pub keterangan: String,
}
fn one() -> i64 { 1 }

#[derive(Serialize)]
pub struct SimpanResp { pub ok: bool, pub id: i64, pub rpn: i64, pub rpn_residu: Option<i64> }

pub async fn simpan(
    u: AuthUser, State(s): State<AppState>, Json(b): Json<RiskBody>,
) -> Result<Json<SimpanResp>, (StatusCode, Json<Value>)> {
    if b.modus_kegagalan.trim().is_empty() && b.proses.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Proses atau modus kegagalan wajib diisi"}))));
    }
    let sev = clamp10(b.severity); let occ = clamp10(b.occurrence); let det = clamp10(b.detectability);
    let rpn = sev * occ * det;
    let (sr, or_, dr) = (b.severity_residu, b.occurrence_residu, b.detectability_residu);
    let rpn_residu: Option<i64> = match (sr, or_, dr) {
        (Some(a), Some(bb), Some(c)) => Some(clamp10(a) * clamp10(bb) * clamp10(c)),
        _ => None,
    };
    let status = if b.status.trim().is_empty() { "Identifikasi".to_string() } else { b.status.trim().to_string() };

    let id = match b.id {
        Some(id) if id > 0 => {
            sqlx::query(
                "UPDATE manajemen_risiko_rscb SET tahun=?, unit=?, kategori=?, proses=?, modus_kegagalan=?, penyebab=?, dampak=?, \
                        severity=?, occurrence=?, detectability=?, rpn=?, \
                        severity_residu=?, occurrence_residu=?, detectability_residu=?, rpn_residu=?, \
                        pic=?, target_tanggal=?, status=?, tanggal_identifikasi=?, keterangan=? WHERE id=?",
            )
            .bind(b.tahun).bind(opt(&b.unit)).bind(opt(&b.kategori)).bind(opt(&b.proses))
            .bind(opt(&b.modus_kegagalan)).bind(opt(&b.penyebab)).bind(opt(&b.dampak))
            .bind(sev).bind(occ).bind(det).bind(rpn)
            .bind(sr.map(clamp10)).bind(or_.map(clamp10)).bind(dr.map(clamp10)).bind(rpn_residu)
            .bind(opt(&b.pic)).bind(opt_date(&b.target_tanggal)).bind(&status).bind(opt_date(&b.tanggal_identifikasi)).bind(opt(&b.keterangan))
            .bind(id)
            .execute(&s.pool).await.map_err(db_err)?;
            id
        }
        _ => {
            let res = sqlx::query(
                "INSERT INTO manajemen_risiko_rscb (tahun, unit, kategori, proses, modus_kegagalan, penyebab, dampak, \
                        severity, occurrence, detectability, rpn, severity_residu, occurrence_residu, detectability_residu, rpn_residu, \
                        pic, target_tanggal, status, tanggal_identifikasi, keterangan, dibuat_oleh) \
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            )
            .bind(b.tahun).bind(opt(&b.unit)).bind(opt(&b.kategori)).bind(opt(&b.proses))
            .bind(opt(&b.modus_kegagalan)).bind(opt(&b.penyebab)).bind(opt(&b.dampak))
            .bind(sev).bind(occ).bind(det).bind(rpn)
            .bind(sr.map(clamp10)).bind(or_.map(clamp10)).bind(dr.map(clamp10)).bind(rpn_residu)
            .bind(opt(&b.pic)).bind(opt_date(&b.target_tanggal)).bind(&status).bind(opt_date(&b.tanggal_identifikasi)).bind(opt(&b.keterangan))
            .bind(&u.0.kode)
            .execute(&s.pool).await.map_err(db_err)?;
            res.last_insert_id() as i64
        }
    };
    Ok(Json(SimpanResp { ok: true, id, rpn, rpn_residu }))
}

pub async fn hapus(
    _u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query("DELETE FROM manajemen_risiko_mitigasi_rscb WHERE id_risiko=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    sqlx::query("DELETE FROM manajemen_risiko_rscb WHERE id=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── MITIGASI (upsert & hapus) ────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct MitBody {
    #[serde(default)] pub id: Option<i64>,
    pub id_risiko: i64,
    #[serde(default)] pub program: String,
    #[serde(default)] pub kegiatan: String,
    #[serde(default)] pub pic: String,
    #[serde(default)] pub target: String,
    #[serde(default)] pub status: String,
    #[serde(default)] pub progres: String,
    #[serde(default)] pub urut: i64,
}

pub async fn mitigasi_simpan(
    _u: AuthUser, State(s): State<AppState>, Json(b): Json<MitBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.id_risiko <= 0 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "id_risiko wajib"}))));
    }
    let status = if b.status.trim().is_empty() { "Rencana".to_string() } else { b.status.trim().to_string() };
    let id = match b.id {
        Some(id) if id > 0 => {
            sqlx::query("UPDATE manajemen_risiko_mitigasi_rscb SET program=?, kegiatan=?, pic=?, target=?, status=?, progres=?, urut=? WHERE id=?")
                .bind(opt(&b.program)).bind(opt(&b.kegiatan)).bind(opt(&b.pic)).bind(opt(&b.target)).bind(&status).bind(opt(&b.progres)).bind(b.urut).bind(id)
                .execute(&s.pool).await.map_err(db_err)?;
            id
        }
        _ => {
            let res = sqlx::query("INSERT INTO manajemen_risiko_mitigasi_rscb (id_risiko, program, kegiatan, pic, target, status, progres, urut) VALUES (?,?,?,?,?,?,?,?)")
                .bind(b.id_risiko).bind(opt(&b.program)).bind(opt(&b.kegiatan)).bind(opt(&b.pic)).bind(opt(&b.target)).bind(&status).bind(opt(&b.progres)).bind(b.urut)
                .execute(&s.pool).await.map_err(db_err)?;
            res.last_insert_id() as i64
        }
    };
    Ok(Json(json!({"ok": true, "id": id})))
}

pub async fn mitigasi_hapus(
    _u: AuthUser, State(s): State<AppState>, Path(idm): Path<i64>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query("DELETE FROM manajemen_risiko_mitigasi_rscb WHERE id=?").bind(idm).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
