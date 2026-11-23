//! Master data PPRA — CRUD referensi ATC/DDD (ppra_atc_ref) & mapping obat
//! (ppra_map_obat) + autocomplete databarang (Khanza read-only) + import CSV.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Multipart, Query, State},
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

const ROUTES: &[&str] = &["O", "P", "R", "Inhal", "Instill", "other"];
const SATUAN: &[&str] = &["g", "mg", "MU", "TU", "U", "ml"];
const AWARE: &[&str] = &["Access", "Watch", "Reserve", "Not_recommended"];

fn cek_enum(field: &str, val: &str, valid: &[&str]) -> Result<(), ApiErr> {
    if valid.contains(&val) {
        Ok(())
    } else {
        Err(err422(format!("{field} '{val}' tidak valid (harus salah satu: {})", valid.join(", "))))
    }
}

// ══════════════════════════════ ATC REF ════════════════════════════════════

#[derive(Deserialize)]
pub struct AtcQuery {
    pub q: Option<String>,
    pub limit: Option<i64>,
}

#[derive(sqlx::FromRow, serde::Serialize)]
struct AtcRow {
    atc_code: String,
    adm_route: String,
    nama_generik: String,
    ddd: f64,
    ddd_satuan: String,
    aware_kategori: String,
    who_edisi: i64,
    keterangan: Option<String>,
}

/// GET /ppra/atc?q=&limit= — daftar referensi ATC/DDD.
pub async fn atc_list(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<AtcQuery>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_view")?;
    let limit = q.limit.unwrap_or(500).clamp(1, 2000);
    let like = format!("%{}%", q.q.as_deref().unwrap_or("").trim());
    let rows: Vec<AtcRow> = sqlx::query_as(
        "SELECT atc_code, adm_route, nama_generik, CAST(ddd AS DOUBLE) AS ddd,
                ddd_satuan, aware_kategori, CAST(who_edisi AS SIGNED) AS who_edisi, keterangan
         FROM ppra_atc_ref
         WHERE atc_code LIKE ? OR nama_generik LIKE ?
         ORDER BY nama_generik, adm_route
         LIMIT ?",
    )
    .bind(&like)
    .bind(&like)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .map_err(err500)?;
    Ok(Json(json!({ "ok": true, "jumlah": rows.len(), "data": rows })))
}

#[derive(Deserialize)]
pub struct AtcUpsert {
    pub atc_code: String,
    pub adm_route: String,
    pub nama_generik: String,
    pub ddd: f64,
    pub ddd_satuan: String,
    pub aware_kategori: String,
    pub who_edisi: Option<i64>,
    pub keterangan: Option<String>,
}

async fn upsert_atc(pool: &sqlx::MySqlPool, kode: &str, b: &AtcUpsert) -> Result<(), ApiErr> {
    cek_enum("adm_route", &b.adm_route, ROUTES)?;
    cek_enum("ddd_satuan", &b.ddd_satuan, SATUAN)?;
    cek_enum("aware_kategori", &b.aware_kategori, AWARE)?;
    if b.atc_code.trim().is_empty() {
        return Err(err422("atc_code wajib"));
    }
    if b.ddd <= 0.0 {
        return Err(err422("ddd harus > 0"));
    }
    sqlx::query(
        "INSERT INTO ppra_atc_ref
           (atc_code, adm_route, nama_generik, ddd, ddd_satuan, aware_kategori, who_edisi, keterangan)
         VALUES (?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           nama_generik=VALUES(nama_generik), ddd=VALUES(ddd), ddd_satuan=VALUES(ddd_satuan),
           aware_kategori=VALUES(aware_kategori), who_edisi=VALUES(who_edisi), keterangan=VALUES(keterangan)",
    )
    .bind(b.atc_code.trim())
    .bind(&b.adm_route)
    .bind(b.nama_generik.trim())
    .bind(b.ddd)
    .bind(&b.ddd_satuan)
    .bind(&b.aware_kategori)
    .bind(b.who_edisi.unwrap_or(2025))
    .bind(b.keterangan.as_deref())
    .execute(pool)
    .await
    .map_err(err500)?;
    let sql = format!(
        "INSERT INTO ppra_atc_ref (atc_code, adm_route, nama_generik, ddd, ddd_satuan, aware_kategori, who_edisi, keterangan) \
         VALUES ({}, {}, {}, {}, {}, {}, {}, {}) \
         ON DUPLICATE KEY UPDATE nama_generik={}, ddd={}, ddd_satuan={}, aware_kategori={}, who_edisi={}, keterangan={}",
        crate::audit::q(b.atc_code.trim()), crate::audit::q(&b.adm_route), crate::audit::q(b.nama_generik.trim()),
        crate::audit::q(b.ddd), crate::audit::q(&b.ddd_satuan), crate::audit::q(&b.aware_kategori),
        crate::audit::q(b.who_edisi.unwrap_or(2025)), crate::audit::qo(b.keterangan.as_deref()),
        crate::audit::q(b.nama_generik.trim()), crate::audit::q(b.ddd), crate::audit::q(&b.ddd_satuan),
        crate::audit::q(&b.aware_kategori), crate::audit::q(b.who_edisi.unwrap_or(2025)), crate::audit::qo(b.keterangan.as_deref()),
    );
    crate::audit::log_sql(pool, kode, &sql).await;
    Ok(())
}

/// POST /ppra/atc — upsert satu referensi ATC.
pub async fn atc_upsert(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<AtcUpsert>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_edit")?;
    upsert_atc(&state.pool, &user.0.kode, &b).await?;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct AtcKey {
    pub atc_code: String,
    pub adm_route: String,
}

/// DELETE /ppra/atc?atc_code=&adm_route= — hapus referensi ATC.
pub async fn atc_delete(
    user: AuthUser,
    State(state): State<AppState>,
    Query(k): Query<AtcKey>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_edit")?;
    let r = sqlx::query("DELETE FROM ppra_atc_ref WHERE atc_code=? AND adm_route=?")
        .bind(k.atc_code.trim())
        .bind(k.adm_route.trim())
        .execute(&state.pool)
        .await
        .map_err(|e| {
            // FK: masih dipakai ppra_map_obat
            if e.to_string().contains("foreign key") || e.to_string().contains("1451") {
                err422("Tidak bisa dihapus — masih dipakai mapping obat. Hapus/ubah mapping dulu.")
            } else {
                err500(e)
            }
        })?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "DELETE FROM ppra_atc_ref WHERE atc_code={} AND adm_route={}",
        crate::audit::q(k.atc_code.trim()), crate::audit::q(k.adm_route.trim()),
    )).await;
    Ok(Json(json!({ "ok": true, "terhapus": r.rows_affected() })))
}

/// POST /ppra/atc/import — import CSV multipart (field "file").
/// Header: atc_code,adm_route,nama_generik,ddd,ddd_satuan,aware_kategori,who_edisi
/// Kolom lain (confidence, sumber) diabaikan. Baris ddd kosong dilewati.
pub async fn atc_import(
    user: AuthUser,
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_edit")?;
    let mut bytes: Option<Vec<u8>> = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("multipart: {e}") }))))?
    {
        if field.name() == Some("file") {
            bytes = Some(
                field
                    .bytes()
                    .await
                    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("read: {e}") }))))?
                    .to_vec(),
            );
        }
    }
    let bytes = bytes.ok_or_else(|| err422("Field 'file' wajib"))?;
    let text = String::from_utf8_lossy(&bytes).to_string();

    let mut lines = text.lines();
    let header = lines.next().ok_or_else(|| err422("CSV kosong"))?;
    let headers: Vec<String> = parse_csv_line(header).iter().map(|s| s.trim().to_lowercase()).collect();
    let idx = |n: &str| headers.iter().position(|h| h == n);
    let (i_atc, i_route, i_nama, i_ddd, i_sat, i_aware) = (
        idx("atc_code").ok_or_else(|| err422("Header 'atc_code' wajib"))?,
        idx("adm_route").ok_or_else(|| err422("Header 'adm_route' wajib"))?,
        idx("nama_generik").ok_or_else(|| err422("Header 'nama_generik' wajib"))?,
        idx("ddd").ok_or_else(|| err422("Header 'ddd' wajib"))?,
        idx("ddd_satuan").ok_or_else(|| err422("Header 'ddd_satuan' wajib"))?,
        idx("aware_kategori").ok_or_else(|| err422("Header 'aware_kategori' wajib"))?,
    );
    let i_edisi = idx("who_edisi");

    let mut masuk = 0u32;
    let mut lewat = 0u32;
    let mut errors: Vec<String> = Vec::new();
    for (n, line) in lines.enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let c = parse_csv_line(line);
        let get = |i: usize| c.get(i).map(|s| s.trim().to_string()).unwrap_or_default();
        let ddd_raw = get(i_ddd);
        let ddd: f64 = match ddd_raw.parse() {
            Ok(v) if v > 0.0 => v,
            _ => {
                lewat += 1;
                continue; // ddd kosong/invalid → dilewati (kolom NOT NULL)
            }
        };
        let b = AtcUpsert {
            atc_code: get(i_atc),
            adm_route: get(i_route),
            nama_generik: get(i_nama),
            ddd,
            ddd_satuan: get(i_sat),
            aware_kategori: get(i_aware),
            who_edisi: i_edisi.and_then(|i| get(i).parse().ok()),
            keterangan: None,
        };
        match upsert_atc(&state.pool, &user.0.kode, &b).await {
            Ok(_) => masuk += 1,
            Err((_, j)) => {
                if errors.len() < 50 {
                    errors.push(format!("baris {}: {}", n + 2, j.0.get("error").and_then(|v| v.as_str()).unwrap_or("gagal")));
                }
                lewat += 1;
            }
        }
    }

    Ok(Json(json!({
        "ok": true, "masuk": masuk, "dilewati": lewat, "errors": errors,
        "catatan": "Baris dengan ddd kosong/invalid dilewati (kolom DDD NOT NULL)."
    })))
}

// ══════════════════════════════ MAP OBAT ═══════════════════════════════════

#[derive(Deserialize)]
pub struct MapQuery {
    pub q: Option<String>,
    pub limit: Option<i64>,
}

#[derive(sqlx::FromRow, serde::Serialize)]
struct MapRow {
    kode_brng: String,
    nama_brng: Option<String>,
    atc_code: String,
    adm_route: String,
    nama_generik: Option<String>,
    isi_zat_aktif: f64,
    isi_satuan: String,
    is_antibiotik: i64,
    aktif: i64,
    keterangan: Option<String>,
}

/// GET /ppra/mapping?q= — daftar mapping + nama obat Khanza + generik ATC.
pub async fn map_list(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<MapQuery>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_view")?;
    let limit = q.limit.unwrap_or(500).clamp(1, 2000);
    let like = format!("%{}%", q.q.as_deref().unwrap_or("").trim());
    let rows: Vec<MapRow> = sqlx::query_as(
        "SELECT m.kode_brng, d.nama_brng, m.atc_code, m.adm_route, a.nama_generik,
                CAST(m.isi_zat_aktif AS DOUBLE) AS isi_zat_aktif, m.isi_satuan,
                CAST(m.is_antibiotik AS SIGNED) AS is_antibiotik,
                CAST(m.aktif AS SIGNED) AS aktif, m.keterangan
         FROM ppra_map_obat m
         LEFT JOIN databarang d ON d.kode_brng = m.kode_brng
         LEFT JOIN ppra_atc_ref a ON a.atc_code = m.atc_code AND a.adm_route = m.adm_route
         WHERE m.kode_brng LIKE ? OR d.nama_brng LIKE ? OR m.atc_code LIKE ?
         ORDER BY d.nama_brng, m.kode_brng
         LIMIT ?",
    )
    .bind(&like)
    .bind(&like)
    .bind(&like)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .map_err(err500)?;
    Ok(Json(json!({ "ok": true, "jumlah": rows.len(), "data": rows })))
}

#[derive(Deserialize)]
pub struct MapUpsert {
    pub kode_brng: String,
    pub atc_code: String,
    pub adm_route: String,
    pub isi_zat_aktif: f64,
    pub isi_satuan: String,
    pub is_antibiotik: Option<bool>,
    pub aktif: Option<bool>,
    pub keterangan: Option<String>,
}

/// POST /ppra/mapping — upsert mapping obat.
pub async fn map_upsert(
    user: AuthUser,
    State(state): State<AppState>,
    Json(b): Json<MapUpsert>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_edit")?;
    cek_enum("adm_route", &b.adm_route, ROUTES)?;
    cek_enum("isi_satuan", &b.isi_satuan, SATUAN)?;
    if b.kode_brng.trim().is_empty() {
        return Err(err422("kode_brng wajib"));
    }
    if b.isi_zat_aktif <= 0.0 {
        return Err(err422("isi_zat_aktif harus > 0"));
    }
    sqlx::query(
        "INSERT INTO ppra_map_obat
           (kode_brng, atc_code, adm_route, isi_zat_aktif, isi_satuan, is_antibiotik, aktif, keterangan)
         VALUES (?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           atc_code=VALUES(atc_code), adm_route=VALUES(adm_route), isi_zat_aktif=VALUES(isi_zat_aktif),
           isi_satuan=VALUES(isi_satuan), is_antibiotik=VALUES(is_antibiotik), aktif=VALUES(aktif),
           keterangan=VALUES(keterangan)",
    )
    .bind(b.kode_brng.trim())
    .bind(b.atc_code.trim())
    .bind(&b.adm_route)
    .bind(b.isi_zat_aktif)
    .bind(&b.isi_satuan)
    .bind(b.is_antibiotik.unwrap_or(true))
    .bind(b.aktif.unwrap_or(true))
    .bind(b.keterangan.as_deref())
    .execute(&state.pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("foreign key") || e.to_string().contains("1452") {
            err422("atc_code + adm_route belum ada di referensi ATC. Tambahkan dulu di /atc.")
        } else {
            err500(e)
        }
    })?;
    let sql = format!(
        "INSERT INTO ppra_map_obat (kode_brng, atc_code, adm_route, isi_zat_aktif, isi_satuan, is_antibiotik, aktif, keterangan) \
         VALUES ({}, {}, {}, {}, {}, {}, {}, {}) \
         ON DUPLICATE KEY UPDATE atc_code={}, adm_route={}, isi_zat_aktif={}, isi_satuan={}, is_antibiotik={}, aktif={}, keterangan={}",
        crate::audit::q(b.kode_brng.trim()), crate::audit::q(b.atc_code.trim()), crate::audit::q(&b.adm_route),
        crate::audit::q(b.isi_zat_aktif), crate::audit::q(&b.isi_satuan),
        crate::audit::q(b.is_antibiotik.unwrap_or(true) as i32), crate::audit::q(b.aktif.unwrap_or(true) as i32),
        crate::audit::qo(b.keterangan.as_deref()),
        crate::audit::q(b.atc_code.trim()), crate::audit::q(&b.adm_route), crate::audit::q(b.isi_zat_aktif),
        crate::audit::q(&b.isi_satuan), crate::audit::q(b.is_antibiotik.unwrap_or(true) as i32),
        crate::audit::q(b.aktif.unwrap_or(true) as i32), crate::audit::qo(b.keterangan.as_deref()),
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct MapKey {
    pub kode_brng: String,
}

/// DELETE /ppra/mapping?kode_brng= — hapus mapping.
pub async fn map_delete(
    user: AuthUser,
    State(state): State<AppState>,
    Query(k): Query<MapKey>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_edit")?;
    let r = sqlx::query("DELETE FROM ppra_map_obat WHERE kode_brng=?")
        .bind(k.kode_brng.trim())
        .execute(&state.pool)
        .await
        .map_err(err500)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "DELETE FROM ppra_map_obat WHERE kode_brng={}", crate::audit::q(k.kode_brng.trim()),
    )).await;
    Ok(Json(json!({ "ok": true, "terhapus": r.rows_affected() })))
}

// ═══════════════════════ AUTOCOMPLETE DATABARANG (RO) ═══════════════════════

#[derive(Deserialize)]
pub struct CariQuery {
    pub q: String,
    pub limit: Option<i64>,
}

#[derive(sqlx::FromRow, serde::Serialize)]
struct BarangRow {
    kode_brng: String,
    nama_brng: String,
    kode_sat: Option<String>,
    sudah_dimapping: i64,
}

/// GET /ppra/databarang/cari?q= — autocomplete obat Khanza (read-only) +
/// tanda apakah sudah dimapping.
pub async fn databarang_cari(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<CariQuery>,
) -> Result<Json<Value>, ApiErr> {
    crate::handlers::web_perms::require_perm(&user, "ppra_view")?;
    let term = q.q.trim();
    if term.len() < 2 {
        return Err(err422("Kata kunci minimal 2 karakter"));
    }
    let limit = q.limit.unwrap_or(30).clamp(1, 100);
    let like = format!("%{term}%");
    let rows: Vec<BarangRow> = sqlx::query_as(
        "SELECT d.kode_brng, d.nama_brng, d.kode_sat,
                CAST(CASE WHEN m.kode_brng IS NULL THEN 0 ELSE 1 END AS SIGNED) AS sudah_dimapping
         FROM databarang d
         LEFT JOIN ppra_map_obat m ON m.kode_brng = d.kode_brng
         WHERE d.nama_brng LIKE ? OR d.kode_brng LIKE ?
         ORDER BY d.nama_brng
         LIMIT ?",
    )
    .bind(&like)
    .bind(&like)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .map_err(err500)?;
    Ok(Json(json!({ "ok": true, "data": rows })))
}

// ─────────────────────────── util CSV parser ───────────────────────────────
fn parse_csv_line(line: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut buf = String::new();
    let mut in_quote = false;
    let mut chars = line.chars().peekable();
    while let Some(c) = chars.next() {
        if in_quote {
            if c == '"' {
                if chars.peek() == Some(&'"') {
                    buf.push('"');
                    chars.next();
                } else {
                    in_quote = false;
                }
            } else {
                buf.push(c);
            }
        } else {
            match c {
                '"' => in_quote = true,
                ',' => out.push(std::mem::take(&mut buf)),
                _ => buf.push(c),
            }
        }
    }
    out.push(buf);
    out
}
