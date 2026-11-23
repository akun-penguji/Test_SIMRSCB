// e-Nakes — Monitoring Bundle PPI (IAD / ISK / Phlebitis / VAP / IDO + Audit IDO Peri-Op).
// Generic handler config-driven: semua nama tabel/kolom berasal dari registry STATIS
// (bukan input user) → aman diinterpolasi; nilai di-bind sebagai parameter.
// Tabel sama dengan form Khanza desktop (monitoring_*_insersi / _maintenance / _ok).
use crate::{auth::middleware::AuthUser, handlers::enakes::require_perm, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use sqlx::Row;

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB enakes_bundle: {}", e);
    let detail = match &e { sqlx::Error::Database(db) => db.message().to_string(), o => o.to_string() };
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Gagal akses data bundle: {}", detail)})))
}

struct BundleDef {
    perm: &'static str,                 // kolom izin di tabel `user` (gate edit)
    h_table: &'static str,              // tabel header (insersi/preop/flat)
    h_date: &'static str,               // kolom tanggal kunci header: tgl_pemasangan|tgl_operasi|tanggal(flat)
    h_has_waktu: bool,                  // punya kolom waktu_input (header/detail), false utk flat
    h_extra: &'static [&'static str],   // kolom teks tambahan (mis. lokasi_insersi)
    h_ind: &'static [&'static str],     // indikator header
    d_table: &'static str,              // tabel detail (maintenance/postop); "" = flat (tanpa detail)
    d_ind: &'static [&'static str],     // indikator detail
}

fn registry(key: &str) -> Option<BundleDef> {
    Some(match key {
        "iad" => BundleDef { perm: "audit_bundle_iadp", h_table: "monitoring_iad_insersi", h_date: "tgl_pemasangan", h_has_waktu: true,
            h_extra: &["lokasi_insersi"], h_ind: &["insersi_hh","insersi_apd","insersi_lokasi","insersi_disinfeksi"],
            d_table: "monitoring_iad_maintenance", d_ind: &["main_hh","main_apd","main_perawatan","main_disinfeksi_hub","main_dressing","main_ganti_set"] },
        "isk" => BundleDef { perm: "audit_bundle_isk", h_table: "monitoring_isk_insersi", h_date: "tgl_pemasangan", h_has_waktu: true,
            h_extra: &[], h_ind: &["ins_indikasi","ins_apd","ins_hh","ins_steril","ins_balon","ins_fiksasi"],
            d_table: "monitoring_isk_maintenance", d_ind: &["main_hh","main_pemeliharaan","main_pelepasan"] },
        "phlebitis" => BundleDef { perm: "audit_bundle_plabsi", h_table: "monitoring_phlebitis_insersi", h_date: "tgl_pemasangan", h_has_waktu: true,
            h_extra: &["lokasi_insersi"], h_ind: &["ins_hh","ins_apd","ins_lokasi","ins_disinfeksi","ins_dressing","ins_label"],
            d_table: "monitoring_phlebitis_maintenance", d_ind: &["main_hh","main_apd","main_ganti_kateter"] },
        "vap" => BundleDef { perm: "audit_bundle_vap", h_table: "monitoring_vap_insersi", h_date: "tgl_pemasangan", h_has_waktu: true,
            h_extra: &[], h_ind: &["ins_hh","ins_apd","ins_steril"],
            d_table: "monitoring_vap_maintenance", d_ind: &["main_hh","main_apd","main_posisi","main_oralhygiene","main_sekresi","main_profilaksis","main_sedasi"] },
        "ido" => BundleDef { perm: "audit_bundle_ido", h_table: "monitoring_ido_preop", h_date: "tgl_operasi", h_has_waktu: true,
            h_extra: &[], h_ind: &["pre_mandi","pre_hh","pre_cukur","pre_suhu","pre_gula","pre_antibiotik"],
            d_table: "monitoring_ido_postop", d_ind: &["post_perawatan","post_hh","post_penutupan"] },
        "ido_ok" => BundleDef { perm: "audit_bundle_ido", h_table: "monitoring_ido_ok", h_date: "tanggal", h_has_waktu: false,
            h_extra: &[], h_ind: &["peri_hh","peri_apd","peri_antiseptik","peri_suhu_ruang","peri_normothermia"],
            d_table: "", d_ind: &[] },
        _ => return None,
    })
}

fn def_or_404(key: &str) -> Result<BundleDef, (StatusCode, Json<Value>)> {
    registry(key).ok_or((StatusCode::NOT_FOUND, Json(json!({"error": "Bundle tidak dikenal"}))))
}

// Ambil nilai string indikator dari body.data (default 'NA'); validasi enum.
fn ind_val(data: &Value, col: &str) -> String {
    let v = data.get(col).and_then(|x| x.as_str()).unwrap_or("NA").trim();
    match v { "Ya" | "Tidak" | "NA" => v.to_string(), _ => "NA".to_string() }
}
fn text_val(data: &Value, col: &str) -> String {
    data.get(col).and_then(|x| x.as_str()).unwrap_or("").trim().to_string()
}

// ── GET header (insersi/preop/flat) list by no_rawat ──────────────────────────
#[derive(Deserialize)]
pub struct ListQ { pub bundle: String, pub no_rawat: String, #[serde(default)] pub tgl: Option<String> }

pub async fn header_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let d = def_or_404(&q.bundle)?;
    let mut out_cols: Vec<String> = vec![format!("CAST(m.`{}` AS CHAR) `tgl`", d.h_date)];
    for c in d.h_extra { out_cols.push(format!("IFNULL(m.`{c}`,'') `{c}`")); }
    for c in d.h_ind { out_cols.push(format!("IFNULL(m.`{c}`,'') `{c}`")); }
    out_cols.push("IFNULL(m.kd_petugas,'') `kd_petugas`".into());
    out_cols.push("IFNULL(pg.nama,'') `nm_petugas`".into());
    let sql = format!(
        "SELECT {} FROM `{}` m LEFT JOIN petugas pg ON m.kd_petugas=pg.nip \
         WHERE m.no_rawat=? ORDER BY m.`{}` DESC",
        out_cols.join(", "), d.h_table, d.h_date);
    let rows = sqlx::query(&sql).bind(&q.no_rawat).fetch_all(&s.pool).await.map_err(db_err)?;
    let mut keys: Vec<&str> = vec!["tgl"];
    keys.extend(d.h_extra.iter().copied());
    keys.extend(d.h_ind.iter().copied());
    keys.push("kd_petugas"); keys.push("nm_petugas");
    Ok(Json(json!({ "rows": rows_to_json(&rows, &keys) })))
}

// ── GET detail (maintenance/postop) list by no_rawat (+opsional tgl header) ───
pub async fn detail_list(_u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let d = def_or_404(&q.bundle)?;
    if d.d_table.is_empty() { return Ok(Json(json!({ "rows": [] }))); }
    let mut out_cols: Vec<String> = vec![
        "CAST(m.`tanggal` AS CHAR) `tanggal`".into(),
        format!("CAST(m.`{}` AS CHAR) `tgl`", d.h_date),
    ];
    for c in d.d_ind { out_cols.push(format!("IFNULL(m.`{c}`,'') `{c}`")); }
    out_cols.push("IFNULL(m.kd_petugas,'') `kd_petugas`".into());
    out_cols.push("IFNULL(pg.nama,'') `nm_petugas`".into());
    let mut sql = format!(
        "SELECT {} FROM `{}` m LEFT JOIN petugas pg ON m.kd_petugas=pg.nip WHERE m.no_rawat=?",
        out_cols.join(", "), d.d_table);
    if q.tgl.is_some() { sql.push_str(&format!(" AND m.`{}`=?", d.h_date)); }
    sql.push_str(" ORDER BY m.`tanggal` DESC");
    let mut qy = sqlx::query(&sql).bind(&q.no_rawat);
    if let Some(t) = &q.tgl { qy = qy.bind(t); }
    let rows = qy.fetch_all(&s.pool).await.map_err(db_err)?;
    let mut keys: Vec<&str> = vec!["tanggal", "tgl"];
    keys.extend(d.d_ind.iter().copied());
    keys.push("kd_petugas"); keys.push("nm_petugas");
    Ok(Json(json!({ "rows": rows_to_json(&rows, &keys) })))
}

fn rows_to_json(rows: &[sqlx::mysql::MySqlRow], keys: &[&str]) -> Vec<Value> {
    rows.iter().map(|r| {
        let mut m = Map::new();
        for k in keys {
            let v: String = r.try_get::<Option<String>, _>(*k).ok().flatten().unwrap_or_default();
            m.insert((*k).to_string(), Value::String(v));
        }
        Value::Object(m)
    }).collect()
}

// ── POST header (upsert insersi/preop/flat) ──────────────────────────────────
#[derive(Deserialize)]
pub struct HeaderBody { pub bundle: String, pub no_rawat: String, pub tgl: String, #[serde(default)] pub data: Value }

pub async fn header_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<HeaderBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let d = def_or_404(&b.bundle)?;
    require_perm(&s, &u, d.perm).await?;
    if b.no_rawat.trim().is_empty() || b.tgl.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "No.Rawat & tanggal wajib diisi"}))));
    }
    // kolom + placeholder/ekspresi
    let mut cols: Vec<String> = vec!["no_rawat".into(), d.h_date.to_string()];
    let mut exprs: Vec<String> = vec!["?".into(), "?".into()];
    if d.h_has_waktu { cols.push("waktu_input".into()); exprs.push("NOW()".into()); }
    for c in d.h_extra { cols.push((*c).into()); exprs.push("?".into()); }
    for c in d.h_ind { cols.push((*c).into()); exprs.push("?".into()); }
    cols.push("kd_petugas".into()); exprs.push("?".into());
    let colsq = cols.iter().map(|c| format!("`{c}`")).collect::<Vec<_>>().join(", ");
    let sql = format!("REPLACE INTO `{}` ({}) VALUES ({})", d.h_table, colsq, exprs.join(", "));
    let mut qy = sqlx::query(&sql).bind(&b.no_rawat).bind(&b.tgl);
    for c in d.h_extra { qy = qy.bind(text_val(&b.data, c)); }
    for c in d.h_ind { qy = qy.bind(ind_val(&b.data, c)); }
    qy = qy.bind(&u.0.kode);
    qy.execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("bundle {} header no_rawat={} tgl={}", b.bundle, b.no_rawat, b.tgl)).await;
    Ok(Json(json!({ "ok": true })))
}

// ── POST detail (upsert maintenance/postop) ──────────────────────────────────
#[derive(Deserialize)]
pub struct DetailBody { pub bundle: String, pub no_rawat: String, pub tgl: String, pub tanggal: String, #[serde(default)] pub data: Value }

pub async fn detail_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<DetailBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let d = def_or_404(&b.bundle)?;
    if d.d_table.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Bundle ini tidak punya bagian harian"}))));
    }
    require_perm(&s, &u, d.perm).await?;
    if b.no_rawat.trim().is_empty() || b.tgl.trim().is_empty() || b.tanggal.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "No.Rawat, tanggal operasi/pemasangan & tanggal harian wajib"}))));
    }
    let mut cols: Vec<String> = vec!["no_rawat".into(), d.h_date.to_string(), "tanggal".into()];
    let mut exprs: Vec<String> = vec!["?".into(), "?".into(), "?".into()];
    for c in d.d_ind { cols.push((*c).into()); exprs.push("?".into()); }
    cols.push("kd_petugas".into()); exprs.push("?".into());
    let colsq = cols.iter().map(|c| format!("`{c}`")).collect::<Vec<_>>().join(", ");
    let sql = format!("REPLACE INTO `{}` ({}) VALUES ({})", d.d_table, colsq, exprs.join(", "));
    let mut qy = sqlx::query(&sql).bind(&b.no_rawat).bind(&b.tgl).bind(&b.tanggal);
    for c in d.d_ind { qy = qy.bind(ind_val(&b.data, c)); }
    qy = qy.bind(&u.0.kode);
    qy.execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("bundle {} detail no_rawat={} tgl={} tanggal={}", b.bundle, b.no_rawat, b.tgl, b.tanggal)).await;
    Ok(Json(json!({ "ok": true })))
}

// ── POST hapus ───────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct DelBody { pub bundle: String, pub no_rawat: String, pub tgl: String, #[serde(default)] pub tanggal: Option<String> }

pub async fn header_hapus(u: AuthUser, State(s): State<AppState>, Json(b): Json<DelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let d = def_or_404(&b.bundle)?;
    require_perm(&s, &u, d.perm).await?;
    let sql = format!("DELETE FROM `{}` WHERE no_rawat=? AND `{}`=?", d.h_table, d.h_date);
    let r = sqlx::query(&sql).bind(&b.no_rawat).bind(&b.tgl).execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("HAPUS bundle {} header no_rawat={} tgl={}", b.bundle, b.no_rawat, b.tgl)).await;
    Ok(Json(json!({ "ok": true, "deleted": r.rows_affected() })))
}

pub async fn detail_hapus(u: AuthUser, State(s): State<AppState>, Json(b): Json<DelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let d = def_or_404(&b.bundle)?;
    if d.d_table.is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Bundle tanpa bagian harian"})))); }
    require_perm(&s, &u, d.perm).await?;
    let tanggal = b.tanggal.unwrap_or_default();
    let sql = format!("DELETE FROM `{}` WHERE no_rawat=? AND `{}`=? AND tanggal=?", d.d_table, d.h_date);
    let r = sqlx::query(&sql).bind(&b.no_rawat).bind(&b.tgl).bind(&tanggal).execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("HAPUS bundle {} detail no_rawat={} tgl={} tanggal={}", b.bundle, b.no_rawat, b.tgl, tanggal)).await;
    Ok(Json(json!({ "ok": true, "deleted": r.rows_affected() })))
}
