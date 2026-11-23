// Pengkajian Awal Keperawatan (e-Nakes) — metadata-driven.
// Tabel Khanza per varian sangat lebar (Ranap 193 kolom). Daripada hardcode
// ribuan field, skema kolom dibaca dari information_schema dan form di-generate
// otomatis; simpan pun dinamis (hanya kolom yang benar-benar ada di tabel).
// Sub-tabel _masalah / _rencana = daftar diagnosis & rencana keperawatan.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::HashMap;

// key, nama, tabel utama, tabel masalah?, tabel rencana?, kolom hak akses (user)
const REG: &[(&str, &str, &str, Option<&str>, Option<&str>, &str)] = &[
    ("ralan", "Ralan Dewasa", "penilaian_awal_keperawatan_ralan",
        Some("penilaian_awal_keperawatan_ralan_masalah"), Some("penilaian_awal_keperawatan_ralan_rencana"), "penilaian_awal_keperawatan_ralan"),
    ("igd", "IGD", "penilaian_awal_keperawatan_igd",
        Some("penilaian_awal_keperawatan_igd_masalah"), Some("penilaian_awal_keperawatan_ralan_rencana_igd"), "penilaian_awal_keperawatan_igd"),
    ("ranap", "Ranap Dewasa", "penilaian_awal_keperawatan_ranap",
        Some("penilaian_awal_keperawatan_ranap_masalah"), Some("penilaian_awal_keperawatan_ranap_rencana"), "penilaian_awal_keperawatan_ranap"),
    ("ralan_bayi", "Ralan Bayi/Anak", "penilaian_awal_keperawatan_ralan_bayi",
        Some("penilaian_awal_keperawatan_ralan_bayi_masalah"), Some("penilaian_awal_keperawatan_ralan_rencana_anak"), "penilaian_awal_keperawatan_anak"),
    ("ranap_bayi", "Ranap Bayi/Anak", "penilaian_awal_keperawatan_ranap_bayi",
        Some("penilaian_awal_keperawatan_ranap_bayi_masalah"), Some("penilaian_awal_keperawatan_ranap_bayi_rencana"), "penilaian_awal_keperawatan_ranap_bayi"),
    ("ranap_neonatus", "Ranap Neonatus", "penilaian_awal_keperawatan_ranap_neonatus",
        Some("penilaian_awal_keperawatan_ranap_neonatus_masalah"), Some("penilaian_awal_keperawatan_ranap_neonatus_rencana"), "penilaian_awal_keperawatan_ranap_neonatus"),
    ("kebidanan", "Kebidanan Ralan", "penilaian_awal_keperawatan_kebidanan", None, None, "penilaian_awal_keperawatan_kebidanan"),
    ("kebidanan_ranap", "Kebidanan Ranap", "penilaian_awal_keperawatan_kebidanan_ranap", None, None, "penilaian_awal_keperawatan_ranapkebidanan"),
    ("geriatri", "Ralan Geriatri", "penilaian_awal_keperawatan_ralan_geriatri",
        Some("penilaian_awal_keperawatan_ralan_masalah_geriatri"), Some("penilaian_awal_keperawatan_ralan_rencana_geriatri"), "penilaian_awal_keperawatan_ralan_geriatri"),
    ("psikiatri", "Ralan Psikiatri", "penilaian_awal_keperawatan_ralan_psikiatri",
        Some("penilaian_awal_keperawatan_ralan_masalah_psikiatri"), Some("penilaian_awal_keperawatan_ralan_rencana_psikiatri"), "penilaian_awal_keperawatan_psikiatri"),
    ("mata", "Mata", "penilaian_awal_keperawatan_mata",
        Some("penilaian_awal_keperawatan_mata_masalah"), None, "penilaian_awal_keperawatan_mata"),
    ("gigi", "Gigi", "penilaian_awal_keperawatan_gigi",
        Some("penilaian_awal_keperawatan_gigi_masalah"), Some("penilaian_awal_keperawatan_ralan_rencana_gigi"), "penilaian_awal_keperawatan_gigi"),
];
type Reg = (&'static str, &'static str, &'static str, Option<&'static str>, Option<&'static str>, &'static str);
fn reg(key: &str) -> Option<&'static Reg> { REG.iter().find(|r| r.0 == key) }

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB pengkajian_kep: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data pengkajian keperawatan"})))
}
// Nama kolom aman (hanya identifier) — pertahanan ekstra selain validasi ke information_schema.
fn ident_ok(s: &str) -> bool { !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') }

#[derive(sqlx::FromRow)]
struct ColMeta { column_name: String, data_type: String, column_type: String, is_nullable: String }

async fn columns(state: &AppState, table: &str) -> Result<Vec<ColMeta>, (StatusCode, Json<Value>)> {
    sqlx::query_as::<_, ColMeta>(
        "SELECT column_name, data_type, column_type, is_nullable \
         FROM information_schema.columns \
         WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position"
    ).bind(table).fetch_all(&state.pool).await.map_err(db_err)
}
// Nama kolom teks pada sub-tabel (selain no_rawat).
async fn subcol(state: &AppState, table: &str) -> Option<String> {
    let cols = columns(state, table).await.ok()?;
    cols.into_iter().map(|c| c.column_name).find(|n| n != "no_rawat")
}
fn parse_enum(column_type: &str) -> Vec<String> {
    // enum('a','b',...) → ["a","b",...]
    let inner = column_type.strip_prefix("enum(").and_then(|s| s.strip_suffix(")"));
    match inner {
        Some(s) => s.split("','").map(|p| p.trim_matches('\'').replace("''", "'")).collect(),
        None => vec![],
    }
}
fn kind_of(dt: &str, ct: &str) -> String {
    match dt {
        "enum" => "enum".into(),
        "tinyint" | "smallint" | "mediumint" | "int" | "bigint" | "decimal" | "float" | "double" => "numeric".into(),
        "date" => "date".into(),
        "time" => "time".into(),
        "datetime" | "timestamp" => "datetime".into(),
        "text" | "mediumtext" | "longtext" => "textarea".into(),
        _ => {
            // varchar panjang → textarea
            if ct.contains("varchar") {
                let len: usize = ct.trim_start_matches("varchar(").trim_end_matches(')').parse().unwrap_or(0);
                if len >= 120 { "textarea".into() } else { "text".into() }
            } else { "text".into() }
        }
    }
}
const SKIP: &[&str] = &["no_rawat", "tanggal", "jam", "nip"];

// ── GET /enakes/pengkajian/skema?instrumen= ──────────────────────────────────
#[derive(Deserialize)]
pub struct SkemaQuery { pub instrumen: String }
pub async fn skema(_user: AuthUser, State(state): State<AppState>, Query(q): Query<SkemaQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let r = reg(&q.instrumen).ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"Instrumen tidak dikenal"}))))?;
    let cols = columns(&state, r.2).await?;
    let fields: Vec<Value> = cols.iter().filter(|c| !SKIP.contains(&c.column_name.as_str())).map(|c| {
        let kind = kind_of(&c.data_type, &c.column_type);
        json!({
            "name": c.column_name,
            "kind": kind,
            "options": if kind == "enum" { parse_enum(&c.column_type) } else { vec![] },
            "nullable": c.is_nullable == "YES",
        })
    }).collect();
    let masalah_col = match r.3 { Some(t) => subcol(&state, t).await, None => None };
    let rencana_col = match r.4 { Some(t) => subcol(&state, t).await, None => None };
    Ok(Json(json!({
        "nama": r.1, "fields": fields,
        "masalah": r.3.is_some(), "rencana": r.4.is_some(),
        "masalah_col": masalah_col, "rencana_col": rencana_col,
    })))
}

// ── GET /enakes/pengkajian?instrumen=&no_rawat= (rekaman terakhir) ────────────
#[derive(Deserialize)]
pub struct GetQuery { pub instrumen: String, pub no_rawat: String }
pub async fn get_latest(_user: AuthUser, State(state): State<AppState>, Query(q): Query<GetQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let r = reg(&q.instrumen).ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"Instrumen tidak dikenal"}))))?;
    let cols = columns(&state, r.2).await?;
    let has_tanggal = cols.iter().any(|c| c.column_name == "tanggal");
    // SELECT semua kolom sebagai CHAR agar bisa dibaca seragam sebagai string.
    let sel: Vec<String> = cols.iter().filter(|c| ident_ok(&c.column_name))
        .map(|c| format!("CAST(`{0}` AS CHAR) `{0}`", c.column_name)).collect();
    if sel.is_empty() { return Ok(Json(json!({"data": null}))); }
    let order = if has_tanggal { "ORDER BY tanggal DESC" } else { "" };
    let sql = format!("SELECT {} FROM `{}` WHERE no_rawat = ? {} LIMIT 1", sel.join(", "), r.2, order);
    let row = sqlx::query(&sql).bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    let data = match row {
        None => Value::Null,
        Some(row) => {
            use sqlx::Row;
            let mut m = Map::new();
            for c in &cols {
                if !ident_ok(&c.column_name) { continue; }
                let v: Option<String> = row.try_get(c.column_name.as_str()).unwrap_or(None);
                m.insert(c.column_name.clone(), v.map(Value::String).unwrap_or(Value::Null));
            }
            Value::Object(m)
        }
    };
    let masalah = if let Some(t) = r.3 { load_sub(&state, t, &q.no_rawat).await } else { vec![] };
    let rencana = if let Some(t) = r.4 { load_sub(&state, t, &q.no_rawat).await } else { vec![] };
    Ok(Json(json!({"data": data, "masalah": masalah, "rencana": rencana})))
}
async fn load_sub(state: &AppState, table: &str, no_rawat: &str) -> Vec<String> {
    let col = match subcol(state, table).await { Some(c) if ident_ok(&c) => c, _ => return vec![] };
    let sql = format!("SELECT CAST(`{0}` AS CHAR) FROM `{1}` WHERE no_rawat = ?", col, table);
    sqlx::query_as::<_, (Option<String>,)>(&sql).bind(no_rawat)
        .fetch_all(&state.pool).await.map(|rows| rows.into_iter().filter_map(|r| r.0).filter(|s| !s.is_empty()).collect())
        .unwrap_or_default()
}

// ── POST /enakes/pengkajian ──────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct SaveBody {
    pub instrumen: String,
    pub no_rawat: String,
    #[serde(default)] pub data: HashMap<String, String>,
    #[serde(default)] pub masalah: Vec<String>,
    #[serde(default)] pub rencana: Vec<String>,
}
pub async fn save(user: AuthUser, State(state): State<AppState>, Json(b): Json<SaveBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let r = reg(&b.instrumen).ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"Instrumen tidak dikenal"}))))?;
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    // Hak akses sama seperti aplikasi desktop (kolom di tabel user).
    crate::handlers::enakes::require_perm(&state, &user, r.5).await?;
    let cols = columns(&state, r.2).await?;
    let meta: HashMap<&str, (&str, bool)> = cols.iter()
        .map(|c| (c.column_name.as_str(), (c.data_type.as_str(), c.is_nullable == "YES"))).collect();
    let has_tanggal = meta.contains_key("tanggal");
    let has_nip = meta.contains_key("nip");

    // Kolom yang diisi user (hanya yang benar-benar ada di tabel & bukan kolom sistem).
    let mut names: Vec<String> = Vec::new();
    let mut binds: Vec<Option<String>> = Vec::new();
    for (k, v) in &b.data {
        if SKIP.contains(&k.as_str()) || !ident_ok(k) { continue; }
        let Some((dt, nullable)) = meta.get(k.as_str()).copied() else { continue };
        names.push(k.clone());
        binds.push(coerce(v, dt, nullable));
    }
    // Bagian INSERT + kolom sistem.
    let mut col_sql: Vec<String> = names.iter().map(|n| format!("`{}`", n)).collect();
    let mut val_sql: Vec<String> = names.iter().map(|_| "?".to_string()).collect();
    col_sql.push("`no_rawat`".into()); val_sql.push("?".into());
    if has_tanggal { col_sql.push("`tanggal`".into()); val_sql.push("NOW()".into()); }
    if has_nip { col_sql.push("`nip`".into()); val_sql.push("?".into()); }
    let updates: Vec<String> = names.iter().map(|n| format!("`{0}`=VALUES(`{0}`)", n)).collect();
    let update_clause = if updates.is_empty() { "no_rawat=VALUES(no_rawat)".to_string() } else { updates.join(", ") };
    let sql = format!(
        "INSERT INTO `{}` ({}) VALUES ({}) ON DUPLICATE KEY UPDATE {}",
        r.2, col_sql.join(", "), val_sql.join(", "), update_clause
    );
    let mut qy = sqlx::query(&sql);
    for v in &binds { qy = qy.bind(v); }
    qy = qy.bind(&b.no_rawat);
    if has_nip { qy = qy.bind(&user.0.kode); }
    qy.execute(&state.pool).await.map_err(db_err)?;

    // Sub-tabel: DELETE lalu INSERT (list per no_rawat).
    if let Some(t) = r.3 { save_sub(&state, t, &b.no_rawat, &b.masalah).await?; }
    if let Some(t) = r.4 { save_sub(&state, t, &b.no_rawat, &b.rencana).await?; }

    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("pengkajian_kep {} no_rawat={}", b.instrumen, b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}
fn coerce(v: &str, dt: &str, nullable: bool) -> Option<String> {
    let empty = v.trim().is_empty();
    match dt {
        "date" | "time" | "datetime" | "timestamp" => if empty { None } else { Some(v.to_string()) },
        "tinyint" | "smallint" | "mediumint" | "int" | "bigint" | "decimal" | "float" | "double" =>
            if empty { if nullable { None } else { Some("0".to_string()) } } else { Some(v.to_string()) },
        _ => Some(v.to_string()),
    }
}
async fn save_sub(state: &AppState, table: &str, no_rawat: &str, items: &[String])
  -> Result<(), (StatusCode, Json<Value>)> {
    let col = match subcol(state, table).await { Some(c) if ident_ok(&c) => c, _ => return Ok(()) };
    sqlx::query(&format!("DELETE FROM `{}` WHERE no_rawat = ?", table)).bind(no_rawat)
        .execute(&state.pool).await.map_err(db_err)?;
    for it in items.iter().filter(|s| !s.trim().is_empty()) {
        sqlx::query(&format!("INSERT INTO `{}` (no_rawat, `{}`) VALUES (?, ?)", table, col))
            .bind(no_rawat).bind(it).execute(&state.pool).await.map_err(db_err)?;
    }
    Ok(())
}

// Daftar instrumen (untuk dropdown frontend).
#[derive(Serialize)]
pub struct InstrItem { pub key: String, pub nama: String }
pub async fn daftar(_user: AuthUser) -> Json<Vec<InstrItem>> {
    Json(REG.iter().map(|r| InstrItem { key: r.0.to_string(), nama: r.1.to_string() }).collect())
}

// ── GET /enakes/pengkajian/master?jenis=masalah|rencana ──────────────────────
// Master diagnosa & rencana keperawatan (untuk picker). Rencana punya induk
// kode_masalah sehingga bisa difilter per masalah terpilih.
#[derive(Deserialize)]
pub struct MasterQuery { pub jenis: String }
#[derive(Serialize, sqlx::FromRow)]
pub struct MasterItem { pub kode: String, pub nama: String, pub induk: String }
pub async fn master(_user: AuthUser, State(state): State<AppState>, Query(q): Query<MasterQuery>)
  -> Result<Json<Vec<MasterItem>>, (StatusCode, Json<Value>)> {
    let sql = if q.jenis == "rencana" {
        "SELECT kode_rencana AS kode, IFNULL(rencana_keperawatan,'') AS nama, IFNULL(kode_masalah,'') AS induk \
         FROM master_rencana_keperawatan ORDER BY kode_masalah, kode_rencana"
    } else {
        "SELECT kode_masalah AS kode, IFNULL(nama_masalah,'') AS nama, '' AS induk \
         FROM master_masalah_keperawatan ORDER BY kode_masalah"
    };
    let rows = sqlx::query_as::<_, MasterItem>(sql).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
