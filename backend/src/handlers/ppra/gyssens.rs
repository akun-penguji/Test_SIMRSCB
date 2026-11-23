//! Surveilans Kualitatif PPRA — audit metode Gyssens (kategori 0..VI).
//! CRUD header (ppra_gyssens_audit) + detail per antibiotik (ppra_gyssens_detail),
//! rekap distribusi kategori, + lookup pasien & antibiotik yang diberikan.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

type ApiErr = (StatusCode, Json<Value>);
fn err500(e: impl std::fmt::Display) -> ApiErr {
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))
}
fn err422(msg: impl Into<String>) -> ApiErr {
    (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({ "error": msg.into() })))
}

const KATEGORI: &[&str] = &[
    "0", "I", "IIA", "IIB", "IIC", "IIIA", "IIIB", "IVA", "IVB", "IVC", "IVD", "V", "VI",
];

// ── LIST ────────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct ListQuery {
    pub tgl_awal: Option<String>,
    pub tgl_akhir: Option<String>,
    pub q: Option<String>,
    pub limit: Option<i64>,
}

#[derive(sqlx::FromRow, serde::Serialize)]
struct AuditRow {
    id: i64,
    no_rawat: String,
    no_rkm_medis: Option<String>,
    tgl_audit: String,
    auditor_nip: Option<String>,
    diagnosis: Option<String>,
    unit_smf: Option<String>,
    jml_antibiotik: i64,
    jml_rasional: i64,
}

/// GET /ppra/gyssens — daftar audit (filter periode + cari).
pub async fn list(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_view")?;
    let limit = q.limit.unwrap_or(200).clamp(1, 1000);
    let from = q.tgl_awal.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "2000-01-01".into());
    let to = q.tgl_akhir.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "2999-12-31".into());
    let like = format!("%{}%", q.q.as_deref().unwrap_or("").trim());
    let rows: Vec<AuditRow> = sqlx::query_as(
        "SELECT a.id, a.no_rawat, a.no_rkm_medis,
                DATE_FORMAT(a.tgl_audit,'%Y-%m-%d') AS tgl_audit,
                a.auditor_nip, a.diagnosis, a.unit_smf,
                CAST(COUNT(d.id) AS SIGNED) AS jml_antibiotik,
                CAST(SUM(CASE WHEN d.kategori_gyssens='0' THEN 1 ELSE 0 END) AS SIGNED) AS jml_rasional
         FROM ppra_gyssens_audit a
         LEFT JOIN ppra_gyssens_detail d ON d.audit_id = a.id
         WHERE a.tgl_audit BETWEEN ? AND ?
           AND (a.no_rawat LIKE ? OR a.no_rkm_medis LIKE ? OR a.diagnosis LIKE ?)
         GROUP BY a.id, a.no_rawat, a.no_rkm_medis, a.tgl_audit, a.auditor_nip, a.diagnosis, a.unit_smf
         ORDER BY a.tgl_audit DESC, a.id DESC
         LIMIT ?",
    )
    .bind(&from).bind(&to).bind(&like).bind(&like).bind(&like).bind(limit)
    .fetch_all(&state.pool)
    .await
    .map_err(err500)?;
    Ok(Json(json!({ "ok": true, "jumlah": rows.len(), "data": rows })))
}

// ── DETAIL ──────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct IdQuery {
    pub id: i64,
}

#[derive(sqlx::FromRow, serde::Serialize)]
struct DetailRow {
    id: i64,
    kode_brng: Option<String>,
    atc_code: Option<String>,
    adm_route: Option<String>,
    dosis: Option<String>,
    interval: Option<String>,
    durasi_hari: Option<i64>,
    ada_kultur: i64,
    hasil_kultur: Option<String>,
    kategori_gyssens: String,
    catatan: Option<String>,
}

/// GET /ppra/gyssens/detail?id= — satu audit + detailnya.
pub async fn detail(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<IdQuery>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_view")?;
    let header: Option<AuditRow> = sqlx::query_as(
        "SELECT a.id, a.no_rawat, a.no_rkm_medis,
                DATE_FORMAT(a.tgl_audit,'%Y-%m-%d') AS tgl_audit,
                a.auditor_nip, a.diagnosis, a.unit_smf,
                CAST(COUNT(d.id) AS SIGNED) AS jml_antibiotik,
                CAST(SUM(CASE WHEN d.kategori_gyssens='0' THEN 1 ELSE 0 END) AS SIGNED) AS jml_rasional
         FROM ppra_gyssens_audit a
         LEFT JOIN ppra_gyssens_detail d ON d.audit_id = a.id
         WHERE a.id = ?
         GROUP BY a.id, a.no_rawat, a.no_rkm_medis, a.tgl_audit, a.auditor_nip, a.diagnosis, a.unit_smf",
    )
    .bind(q.id)
    .fetch_optional(&state.pool)
    .await
    .map_err(err500)?;

    let Some(header) = header else {
        return Err((StatusCode::NOT_FOUND, Json(json!({ "error": "Audit tidak ditemukan" }))));
    };

    let details: Vec<DetailRow> = sqlx::query_as(
        "SELECT id, kode_brng, atc_code, adm_route, dosis, `interval`, durasi_hari,
                CAST(ada_kultur AS SIGNED) AS ada_kultur, hasil_kultur, kategori_gyssens, catatan
         FROM ppra_gyssens_detail WHERE audit_id = ? ORDER BY id",
    )
    .bind(q.id)
    .fetch_all(&state.pool)
    .await
    .map_err(err500)?;

    Ok(Json(json!({ "ok": true, "header": header, "details": details })))
}

// ── SAVE (create / update header + replace details) ─────────────────────────
#[derive(Deserialize)]
pub struct DetailIn {
    pub kode_brng: Option<String>,
    pub atc_code: Option<String>,
    pub adm_route: Option<String>,
    pub dosis: Option<String>,
    pub interval: Option<String>,
    pub durasi_hari: Option<i64>,
    pub ada_kultur: Option<bool>,
    pub hasil_kultur: Option<String>,
    pub kategori_gyssens: String,
    pub catatan: Option<String>,
}

#[derive(Deserialize)]
pub struct SaveIn {
    pub id: Option<i64>,
    pub no_rawat: String,
    pub no_rkm_medis: Option<String>,
    pub tgl_audit: String,
    pub auditor_nip: Option<String>,
    pub diagnosis: Option<String>,
    pub unit_smf: Option<String>,
    pub catatan: Option<String>,
    pub details: Vec<DetailIn>,
}

/// POST /ppra/gyssens — simpan audit (buat baru / update) + replace detail.
pub async fn save(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<SaveIn>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_edit")?;
    if b.no_rawat.trim().is_empty() {
        return Err(err422("no_rawat wajib"));
    }
    if b.tgl_audit.trim().is_empty() {
        return Err(err422("tgl_audit wajib"));
    }
    for d in &b.details {
        if !KATEGORI.contains(&d.kategori_gyssens.as_str()) {
            return Err(err422(format!("kategori_gyssens '{}' tidak valid", d.kategori_gyssens)));
        }
    }

    let mut tx = state.pool.begin().await.map_err(err500)?;

    let audit_id: i64 = if let Some(id) = b.id {
        sqlx::query(
            "UPDATE ppra_gyssens_audit
             SET no_rawat=?, no_rkm_medis=?, tgl_audit=?, auditor_nip=?, diagnosis=?, unit_smf=?, catatan=?
             WHERE id=?",
        )
        .bind(b.no_rawat.trim()).bind(b.no_rkm_medis.as_deref()).bind(b.tgl_audit.trim())
        .bind(b.auditor_nip.as_deref()).bind(b.diagnosis.as_deref()).bind(b.unit_smf.as_deref())
        .bind(b.catatan.as_deref()).bind(id)
        .execute(&mut *tx).await.map_err(err500)?;
        sqlx::query("DELETE FROM ppra_gyssens_detail WHERE audit_id=?")
            .bind(id).execute(&mut *tx).await.map_err(err500)?;
        id
    } else {
        let r = sqlx::query(
            "INSERT INTO ppra_gyssens_audit
               (no_rawat, no_rkm_medis, tgl_audit, auditor_nip, diagnosis, unit_smf, catatan)
             VALUES (?,?,?,?,?,?,?)",
        )
        .bind(b.no_rawat.trim()).bind(b.no_rkm_medis.as_deref()).bind(b.tgl_audit.trim())
        .bind(b.auditor_nip.as_deref()).bind(b.diagnosis.as_deref()).bind(b.unit_smf.as_deref())
        .bind(b.catatan.as_deref())
        .execute(&mut *tx).await.map_err(err500)?;
        r.last_insert_id() as i64
    };

    for d in &b.details {
        sqlx::query(
            "INSERT INTO ppra_gyssens_detail
               (audit_id, kode_brng, atc_code, adm_route, dosis, `interval`, durasi_hari,
                ada_kultur, hasil_kultur, kategori_gyssens, catatan)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(audit_id)
        .bind(d.kode_brng.as_deref()).bind(d.atc_code.as_deref()).bind(d.adm_route.as_deref())
        .bind(d.dosis.as_deref()).bind(d.interval.as_deref()).bind(d.durasi_hari)
        .bind(d.ada_kultur.unwrap_or(false)).bind(d.hasil_kultur.as_deref())
        .bind(&d.kategori_gyssens).bind(d.catatan.as_deref())
        .execute(&mut *tx).await.map_err(err500)?;
    }

    tx.commit().await.map_err(err500)?;

    // ── Audit trail SQL (trackersql, meniru Khanza) ────────────────────────
    let mut logs: Vec<String> = Vec::new();
    if b.id.is_some() {
        logs.push(format!(
            "UPDATE ppra_gyssens_audit SET no_rawat={}, no_rkm_medis={}, tgl_audit={}, auditor_nip={}, diagnosis={}, unit_smf={}, catatan={} WHERE id={}",
            crate::audit::q(b.no_rawat.trim()), crate::audit::qo(b.no_rkm_medis.as_deref()), crate::audit::q(b.tgl_audit.trim()),
            crate::audit::qo(b.auditor_nip.as_deref()), crate::audit::qo(b.diagnosis.as_deref()), crate::audit::qo(b.unit_smf.as_deref()),
            crate::audit::qo(b.catatan.as_deref()), audit_id,
        ));
        logs.push(format!("DELETE FROM ppra_gyssens_detail WHERE audit_id={}", audit_id));
    } else {
        logs.push(format!(
            "INSERT INTO ppra_gyssens_audit (no_rawat, no_rkm_medis, tgl_audit, auditor_nip, diagnosis, unit_smf, catatan) \
             VALUES ({}, {}, {}, {}, {}, {}, {}) -- id={}",
            crate::audit::q(b.no_rawat.trim()), crate::audit::qo(b.no_rkm_medis.as_deref()), crate::audit::q(b.tgl_audit.trim()),
            crate::audit::qo(b.auditor_nip.as_deref()), crate::audit::qo(b.diagnosis.as_deref()), crate::audit::qo(b.unit_smf.as_deref()),
            crate::audit::qo(b.catatan.as_deref()), audit_id,
        ));
    }
    for d in &b.details {
        logs.push(format!(
            "INSERT INTO ppra_gyssens_detail (audit_id, kode_brng, atc_code, adm_route, dosis, `interval`, durasi_hari, ada_kultur, hasil_kultur, kategori_gyssens, catatan) \
             VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})",
            audit_id, crate::audit::qo(d.kode_brng.as_deref()), crate::audit::qo(d.atc_code.as_deref()), crate::audit::qo(d.adm_route.as_deref()),
            crate::audit::qo(d.dosis.as_deref()), crate::audit::qo(d.interval.as_deref()), crate::audit::qo(d.durasi_hari),
            crate::audit::q(d.ada_kultur.unwrap_or(false) as i32), crate::audit::qo(d.hasil_kultur.as_deref()),
            crate::audit::q(&d.kategori_gyssens), crate::audit::qo(d.catatan.as_deref()),
        ));
    }
    for s in &logs {
        crate::audit::log_sql(&state.pool, &user.0.kode, s).await;
    }

    Ok(Json(json!({ "ok": true, "id": audit_id })))
}

/// DELETE /ppra/gyssens?id= — hapus audit (+ detail via cascade).
pub async fn delete(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<IdQuery>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_edit")?;
    let r = sqlx::query("DELETE FROM ppra_gyssens_audit WHERE id=?")
        .bind(q.id)
        .execute(&state.pool)
        .await
        .map_err(err500)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "DELETE FROM ppra_gyssens_audit WHERE id={}", crate::audit::q(q.id),
    )).await;
    Ok(Json(json!({ "ok": true, "terhapus": r.rows_affected() })))
}

// ── REKAP distribusi kategori ───────────────────────────────────────────────
#[derive(Deserialize)]
pub struct RekapQuery {
    pub tgl_awal: Option<String>,
    pub tgl_akhir: Option<String>,
}

/// GET /ppra/gyssens/rekap — distribusi kategori 0..VI + %rasional.
pub async fn rekap(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<RekapQuery>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_view")?;
    let from = q.tgl_awal.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "2000-01-01".into());
    let to = q.tgl_akhir.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "2999-12-31".into());

    let rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT d.kategori_gyssens, CAST(COUNT(*) AS SIGNED)
         FROM ppra_gyssens_detail d
         JOIN ppra_gyssens_audit a ON a.id = d.audit_id
         WHERE a.tgl_audit BETWEEN ? AND ?
         GROUP BY d.kategori_gyssens",
    )
    .bind(&from).bind(&to)
    .fetch_all(&state.pool)
    .await
    .map_err(err500)?;

    let mut dist = serde_json::Map::new();
    for k in KATEGORI {
        dist.insert((*k).to_string(), json!(0));
    }
    let mut total = 0i64;
    let mut rasional = 0i64;
    for (kat, n) in &rows {
        dist.insert(kat.clone(), json!(n));
        total += n;
        if kat == "0" {
            rasional += n;
        }
    }
    let persen_rasional = if total > 0 { rasional as f64 / total as f64 * 100.0 } else { 0.0 };

    Ok(Json(json!({
        "ok": true,
        "periode": { "tgl_awal": from, "tgl_akhir": to },
        "distribusi": dist,
        "total_antibiotik": total,
        "rasional": rasional,
        "tidak_rasional": total - rasional,
        "persen_rasional": persen_rasional,
    })))
}

// ── LOOKUP pasien + antibiotik yang diberikan (bantu isi form) ──────────────
#[derive(Deserialize)]
pub struct PasienQuery {
    pub no_rawat: String,
}

#[derive(sqlx::FromRow, serde::Serialize)]
struct AbDiberikan {
    kode_brng: String,
    nama_brng: Option<String>,
    atc_code: String,
    adm_route: String,
    nama_generik: Option<String>,
}

/// GET /ppra/gyssens/pasien?no_rawat= — data pasien + antibiotik yg diterima.
pub async fn pasien_lookup(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<PasienQuery>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_view")?;
    let no_rawat = q.no_rawat.trim();
    if no_rawat.is_empty() {
        return Err(err422("no_rawat wajib"));
    }

    let pasien: Option<(String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT rp.no_rkm_medis, ps.nm_pasien, ps.jk
         FROM reg_periksa rp
         LEFT JOIN pasien ps ON ps.no_rkm_medis = rp.no_rkm_medis
         WHERE rp.no_rawat = ? LIMIT 1",
    )
    .bind(no_rawat)
    .fetch_optional(&state.pool)
    .await
    .map_err(err500)?;

    let Some((no_rkm_medis, nm_pasien, jk)) = pasien else {
        return Err((StatusCode::NOT_FOUND, Json(json!({ "error": "No. rawat tidak ditemukan" }))));
    };

    // Antibiotik yang diberikan (pemberian ranap + resep) yang sudah dimapping
    let ab: Vec<AbDiberikan> = sqlx::query_as(
        "SELECT DISTINCT m.kode_brng, d.nama_brng, m.atc_code, m.adm_route, a.nama_generik
         FROM (
              SELECT kode_brng FROM detail_pemberian_obat WHERE no_rawat = ?
              UNION
              SELECT rd.kode_brng
                FROM resep_obat ro JOIN resep_dokter rd ON rd.no_resep = ro.no_resep
                WHERE ro.no_rawat = ?
         ) x
         JOIN ppra_map_obat m ON m.kode_brng = x.kode_brng AND m.is_antibiotik = 1
         LEFT JOIN databarang d ON d.kode_brng = m.kode_brng
         LEFT JOIN ppra_atc_ref a ON a.atc_code = m.atc_code AND a.adm_route = m.adm_route",
    )
    .bind(no_rawat)
    .bind(no_rawat)
    .fetch_all(&state.pool)
    .await
    .map_err(err500)?;

    Ok(Json(json!({
        "ok": true,
        "no_rawat": no_rawat,
        "no_rkm_medis": no_rkm_medis,
        "nm_pasien": nm_pasien,
        "jk": jk,
        "antibiotik": ab,
    })))
}
