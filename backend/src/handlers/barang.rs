// Master Data Barang (databarang) — CRUD tanpa harga/barcode, port dari DlgBarang.java.
// + Laporan Darurat Stok (port DlgDaruratStok.java): barang aktif dengan total stok
//   (gudangbarang) di bawah minimal (databarang.stokminimal / override stok_minimal_bangsal).

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB barang: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data barang"})))
}
fn opt(s: &str) -> Option<String> { let t = s.trim(); if t.is_empty() { None } else { Some(t.to_string()) } }

// ── LIST (paginated) ─────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct ListQuery {
    #[serde(default)] pub q: Option<String>,
    #[serde(default)] pub jenis: Option<String>,
    #[serde(default)] pub status: Option<String>, // '1' aktif (default), '0' non, '' semua
    #[serde(default)] pub page: Option<i64>,
    #[serde(default)] pub limit: Option<i64>,
}

#[derive(sqlx::FromRow)]
struct BarangRow {
    kode_brng: String, nama_brng: String, kode_satbesar: String, satbesar: String,
    kode_sat: String, satuan: String, letak_barang: String, stokminimal: f64,
    kdjns: String, jenis: String, isi: f64, kapasitas: f64,
    kode_industri: String, industri: String, kode_kategori: String, kategori: String,
    kode_golongan: String, golongan: String, status: String, stok: f64,
}

fn barang_json(r: &BarangRow) -> Value {
    json!({
        "kode_brng": r.kode_brng, "nama_brng": r.nama_brng,
        "kode_satbesar": r.kode_satbesar, "satbesar": r.satbesar,
        "kode_sat": r.kode_sat, "satuan": r.satuan, "letak_barang": r.letak_barang,
        "stokminimal": r.stokminimal, "kdjns": r.kdjns, "jenis": r.jenis,
        "isi": r.isi, "kapasitas": r.kapasitas,
        "kode_industri": r.kode_industri, "industri": r.industri,
        "kode_kategori": r.kode_kategori, "kategori": r.kategori,
        "kode_golongan": r.kode_golongan, "golongan": r.golongan,
        "status": r.status, "stok": r.stok,
    })
}

const SEL: &str = "\
    d.kode_brng, IFNULL(d.nama_brng,'') nama_brng, \
    IFNULL(d.kode_satbesar,'') kode_satbesar, IFNULL(sb.satuan,'') satbesar, \
    IFNULL(d.kode_sat,'') kode_sat, IFNULL(sk.satuan,'') satuan, IFNULL(d.letak_barang,'') letak_barang, \
    IFNULL(d.stokminimal,0) stokminimal, IFNULL(d.kdjns,'') kdjns, IFNULL(j.nama,'') jenis, \
    IFNULL(d.isi,0) isi, IFNULL(d.kapasitas,0) kapasitas, \
    IFNULL(d.kode_industri,'') kode_industri, IFNULL(inf.nama_industri,'') industri, \
    IFNULL(d.kode_kategori,'') kode_kategori, IFNULL(kt.nama,'') kategori, \
    IFNULL(d.kode_golongan,'') kode_golongan, IFNULL(gl.nama,'') golongan, IFNULL(d.status,'1') status, \
    IFNULL((SELECT SUM(gb.stok) FROM gudangbarang gb INNER JOIN bangsal b ON b.kd_bangsal=gb.kd_bangsal WHERE b.status='1' AND gb.kode_brng=d.kode_brng),0) stok";
const JOINS: &str = "\
    FROM databarang d \
    LEFT JOIN kodesatuan sb ON sb.kode_sat=d.kode_satbesar \
    LEFT JOIN kodesatuan sk ON sk.kode_sat=d.kode_sat \
    LEFT JOIN jenis j ON j.kdjns=d.kdjns \
    LEFT JOIN industrifarmasi inf ON inf.kode_industri=d.kode_industri \
    LEFT JOIN kategori_barang kt ON kt.kode=d.kode_kategori \
    LEFT JOIN golongan_barang gl ON gl.kode=d.kode_golongan";

pub async fn list(
    _u: AuthUser, State(s): State<AppState>, Query(q): Query<ListQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let like = q.q.as_deref().map(|x| format!("%{}%", x.trim())).unwrap_or_else(|| "%".into());
    let jenis = q.jenis.as_deref().map(|x| x.trim().to_string()).filter(|x| !x.is_empty());
    let status = q.status.clone().unwrap_or_else(|| "1".into()); // default aktif
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let page = q.page.unwrap_or(1).max(1);
    let offset = (page - 1) * limit;

    let where_sql = "WHERE (d.kode_brng LIKE ? OR d.nama_brng LIKE ?) \
                     AND (? IS NULL OR d.kdjns=?) \
                     AND (? = '' OR d.status=?)";
    let total: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM databarang d {where_sql}"))
        .bind(&like).bind(&like).bind(&jenis).bind(&jenis).bind(&status).bind(&status)
        .fetch_one(&s.pool).await.map_err(db_err)?;

    let sql = format!("SELECT {SEL} {JOINS} {where_sql} ORDER BY d.nama_brng LIMIT ? OFFSET ?");
    let rows: Vec<BarangRow> = sqlx::query_as::<_, BarangRow>(&sql)
        .bind(&like).bind(&like).bind(&jenis).bind(&jenis).bind(&status).bind(&status)
        .bind(limit).bind(offset)
        .fetch_all(&s.pool).await.map_err(db_err)?;
    let data: Vec<Value> = rows.iter().map(barang_json).collect();
    Ok(Json(json!({ "total": total, "page": page, "limit": limit, "data": data })))
}

pub async fn get(
    _u: AuthUser, State(s): State<AppState>, Path(kode): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let sql = format!("SELECT {SEL} {JOINS} WHERE d.kode_brng=? LIMIT 1");
    let row = sqlx::query_as::<_, BarangRow>(&sql).bind(&kode)
        .fetch_optional(&s.pool).await.map_err(db_err)?;
    match row {
        Some(r) => Ok(Json(barang_json(&r))),
        None => Err((StatusCode::NOT_FOUND, Json(json!({"error":"Barang tidak ditemukan"})))),
    }
}

// ── MASTER lookups (untuk dropdown form) ─────────────────────────────────────
pub async fn masters(
    _u: AuthUser, State(s): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    async fn pairs(pool: &sqlx::MySqlPool, sql: &str) -> Result<Vec<Value>, sqlx::Error> {
        let rows: Vec<(String, String)> = sqlx::query_as(sql).fetch_all(pool).await?;
        Ok(rows.into_iter().map(|(k, v)| json!({"kode": k, "nama": v})).collect())
    }
    let satuan = pairs(&s.pool, "SELECT kode_sat, satuan FROM kodesatuan ORDER BY satuan").await.map_err(db_err)?;
    let jenis = pairs(&s.pool, "SELECT kdjns, nama FROM jenis ORDER BY nama").await.map_err(db_err)?;
    let kategori = pairs(&s.pool, "SELECT kode, nama FROM kategori_barang ORDER BY nama").await.map_err(db_err)?;
    let golongan = pairs(&s.pool, "SELECT kode, nama FROM golongan_barang ORDER BY nama").await.map_err(db_err)?;
    let industri = pairs(&s.pool, "SELECT kode_industri, nama_industri FROM industrifarmasi ORDER BY nama_industri").await.map_err(db_err)?;
    Ok(Json(json!({ "satuan": satuan, "jenis": jenis, "kategori": kategori, "golongan": golongan, "industri": industri })))
}

// ── SIMPAN (create / update; tanpa field harga) ──────────────────────────────
#[derive(Deserialize)]
pub struct BarangBody {
    pub kode_brng: String,
    #[serde(default)] pub is_new: bool,
    #[serde(default)] pub nama_brng: String,
    #[serde(default)] pub kode_satbesar: String,
    #[serde(default)] pub kode_sat: String,
    #[serde(default)] pub letak_barang: String,
    #[serde(default)] pub stokminimal: f64,
    #[serde(default)] pub kdjns: String,
    #[serde(default = "one_f")] pub isi: f64,
    #[serde(default = "one_f")] pub kapasitas: f64,
    #[serde(default)] pub kode_industri: String,
    #[serde(default)] pub kode_kategori: String,
    #[serde(default)] pub kode_golongan: String,
}
fn one_f() -> f64 { 1.0 }

#[derive(Serialize)]
pub struct SimpanResp { pub ok: bool, pub kode_brng: String }

pub async fn simpan(
    u: AuthUser, State(s): State<AppState>, Json(b): Json<BarangBody>,
) -> Result<Json<SimpanResp>, (StatusCode, Json<Value>)> {
    let kode = b.kode_brng.trim().to_string();
    if kode.is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Kode barang wajib"})))); }
    if b.nama_brng.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Nama barang wajib"})))); }
    if b.kode_satbesar.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Satuan besar wajib"})))); }

    if b.is_new {
        // Cegah duplikat kode
        let ada: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM databarang WHERE kode_brng=?")
            .bind(&kode).fetch_one(&s.pool).await.map_err(db_err)?;
        if ada > 0 { return Err((StatusCode::CONFLICT, Json(json!({"error":"Kode barang sudah ada"})))); }
        // Insert; semua field harga default 0, status aktif.
        sqlx::query(
            "INSERT INTO databarang (kode_brng, nama_brng, kode_satbesar, kode_sat, letak_barang, \
                dasar, h_beli, ralan, kelas1, kelas2, kelas3, utama, vip, vvip, beliluar, jualbebas, karyawan, \
                stokminimal, kdjns, isi, kapasitas, status, kode_industri, kode_kategori, kode_golongan) \
             VALUES (?,?,?,?,?, 0,0,0,0,0,0,0,0,0,0,0,0, ?,?,?,?, '1', ?,?,?)",
        )
        .bind(&kode).bind(opt(&b.nama_brng)).bind(b.kode_satbesar.trim()).bind(opt(&b.kode_sat)).bind(opt(&b.letak_barang))
        .bind(b.stokminimal).bind(opt(&b.kdjns)).bind(b.isi).bind(b.kapasitas)
        .bind(opt(&b.kode_industri)).bind(opt(&b.kode_kategori)).bind(opt(&b.kode_golongan))
        .execute(&s.pool).await.map_err(db_err)?;
    } else {
        // Update; TIDAK menyentuh kolom harga (dasar/h_beli/kelas.. tetap).
        sqlx::query(
            "UPDATE databarang SET nama_brng=?, kode_satbesar=?, kode_sat=?, letak_barang=?, \
                    stokminimal=?, kdjns=?, isi=?, kapasitas=?, kode_industri=?, kode_kategori=?, kode_golongan=? \
             WHERE kode_brng=?",
        )
        .bind(opt(&b.nama_brng)).bind(b.kode_satbesar.trim()).bind(opt(&b.kode_sat)).bind(opt(&b.letak_barang))
        .bind(b.stokminimal).bind(opt(&b.kdjns)).bind(b.isi).bind(b.kapasitas)
        .bind(opt(&b.kode_industri)).bind(opt(&b.kode_kategori)).bind(opt(&b.kode_golongan))
        .bind(&kode)
        .execute(&s.pool).await.map_err(db_err)?;
    }
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("databarang simpan {}", kode)).await;
    Ok(Json(SimpanResp { ok: true, kode_brng: kode }))
}

// Nonaktifkan barang (status='0'), seperti DlgBarang (tidak hapus fisik).
pub async fn hapus(
    u: AuthUser, State(s): State<AppState>, Path(kode): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query("UPDATE databarang SET status='0' WHERE kode_brng=?").bind(&kode)
        .execute(&s.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&s.pool, &u.0.kode, &format!("databarang nonaktif {}", kode)).await;
    Ok(Json(json!({"ok": true})))
}

// ── DARURAT STOK (port DlgDaruratStok) ───────────────────────────────────────
#[derive(Deserialize)]
pub struct DaruratQuery {
    #[serde(default)] pub kd_bangsal: Option<String>, // kosong = semua depo
}

#[derive(sqlx::FromRow)]
struct DaruratRow {
    kode_brng: String, nama_brng: String, satuan: String, jenis: String, minimal: f64, stok: f64,
}

pub async fn bangsal_list(
    _u: AuthUser, State(s): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT kd_bangsal, nm_bangsal FROM bangsal WHERE status='1' ORDER BY nm_bangsal",
    ).fetch_all(&s.pool).await.map_err(db_err)?;
    let data: Vec<Value> = rows.into_iter().map(|(k, v)| json!({"kd_bangsal": k, "nm_bangsal": v})).collect();
    Ok(Json(json!({ "data": data })))
}

pub async fn darurat_stok(
    _u: AuthUser, State(s): State<AppState>, Query(q): Query<DaruratQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let depo = q.kd_bangsal.as_deref().map(|x| x.trim().to_string()).filter(|x| !x.is_empty());
    let rows: Vec<DaruratRow> = if let Some(kd) = &depo {
        // Per depo: minimal pakai override stok_minimal_bangsal (fallback stokminimal); stok = gudang depo tsb.
        sqlx::query_as::<_, DaruratRow>(
            "SELECT d.kode_brng, IFNULL(d.nama_brng,'') nama_brng, IFNULL(sk.satuan,'') satuan, IFNULL(j.nama,'') jenis, \
                    IFNULL(smb.stok_minimal, d.stokminimal) minimal, IFNULL(g.stok,0) stok \
             FROM databarang d \
             LEFT JOIN kodesatuan sk ON sk.kode_sat=d.kode_sat \
             LEFT JOIN jenis j ON j.kdjns=d.kdjns \
             LEFT JOIN stok_minimal_bangsal smb ON smb.kode_brng=d.kode_brng AND smb.kd_bangsal=? \
             LEFT JOIN (SELECT kode_brng, SUM(stok) stok FROM gudangbarang WHERE kd_bangsal=? GROUP BY kode_brng) g \
                    ON g.kode_brng=d.kode_brng \
             WHERE d.status='1' AND IFNULL(smb.stok_minimal, d.stokminimal) > 0 \
                   AND IFNULL(g.stok,0) < IFNULL(smb.stok_minimal, d.stokminimal) \
             ORDER BY (IFNULL(smb.stok_minimal, d.stokminimal) - IFNULL(g.stok,0)) DESC LIMIT 1000",
        ).bind(kd).bind(kd).fetch_all(&s.pool).await.map_err(db_err)?
    } else {
        // Semua depo aktif: minimal = databarang.stokminimal; stok = total seluruh bangsal aktif.
        sqlx::query_as::<_, DaruratRow>(
            "SELECT d.kode_brng, IFNULL(d.nama_brng,'') nama_brng, IFNULL(sk.satuan,'') satuan, IFNULL(j.nama,'') jenis, \
                    d.stokminimal minimal, IFNULL(g.stok,0) stok \
             FROM databarang d \
             LEFT JOIN kodesatuan sk ON sk.kode_sat=d.kode_sat \
             LEFT JOIN jenis j ON j.kdjns=d.kdjns \
             LEFT JOIN (SELECT gb.kode_brng, SUM(gb.stok) stok FROM gudangbarang gb \
                        INNER JOIN bangsal b ON b.kd_bangsal=gb.kd_bangsal WHERE b.status='1' GROUP BY gb.kode_brng) g \
                    ON g.kode_brng=d.kode_brng \
             WHERE d.status='1' AND d.stokminimal > 0 AND IFNULL(g.stok,0) < d.stokminimal \
             ORDER BY (d.stokminimal - IFNULL(g.stok,0)) DESC LIMIT 1000",
        ).fetch_all(&s.pool).await.map_err(db_err)?
    };
    let data: Vec<Value> = rows.iter().map(|r| json!({
        "kode_brng": r.kode_brng, "nama_brng": r.nama_brng, "satuan": r.satuan, "jenis": r.jenis,
        "minimal": r.minimal, "stok": r.stok, "kurang": (r.minimal - r.stok).max(0.0),
    })).collect();
    Ok(Json(json!({ "total": data.len(), "data": data })))
}
