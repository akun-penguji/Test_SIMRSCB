// Pengendalian Persediaan — implementasi 7 program mitigasi FMEA keterlambatan stok:
//   1. Reorder point & buffer (stok_minimal_bangsal + barang_kritis_rscb)
//   2. Early warning stok (stok <= reorder point)
//   3. Forecasting kebutuhan (mutasibarang: rata2 pemakaian/bulan -> usul pesan)
//   4. Monitoring lead time pengadaan (pemesanan + pemesanan_terima_rscb)
//   5. Evaluasi supplier (pemesanan + datasuplier)
//   6. Stock opname (stok_opname_rscb + detail)
//   7. Buffer stock barang kritis (barang_kritis_rscb)

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Path, Query, State}, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB persediaan: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data persediaan"})))
}
fn opt(s: &str) -> Option<String> { let t = s.trim(); if t.is_empty() { None } else { Some(t.to_string()) } }

// ── (1+2+7) EARLY WARNING + REORDER POINT ────────────────────────────────────
// ROP = consumption_avg * lead_time + stok_minimal (safety). Fallback: stok_minimal.
#[derive(Deserialize)]
pub struct DepoQuery { #[serde(default)] pub kd_bangsal: Option<String> }

#[derive(sqlx::FromRow)]
struct EwRow {
    kode_brng: String, nama_brng: String, satuan: String, jenis: String,
    stok: f64, stok_minimal: f64, stok_maksimal: f64, lead_time: f64, consumption_avg: f64,
    buffer_stock: f64, kritis: i64,
}

pub async fn early_warning(
    _u: AuthUser, State(s): State<AppState>, Query(q): Query<DepoQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let depo = q.kd_bangsal.as_deref().map(|x| x.trim().to_string()).filter(|x| !x.is_empty());
    // stok & minimal per depo (bila dipilih) atau total (semua bangsal aktif).
    let rows: Vec<EwRow> = if let Some(kd) = &depo {
        sqlx::query_as::<_, EwRow>(
            "SELECT d.kode_brng, IFNULL(d.nama_brng,'') nama_brng, IFNULL(sk.satuan,'') satuan, IFNULL(j.nama,'') jenis, \
                    IFNULL(g.stok,0) stok, IFNULL(smb.stok_minimal, d.stokminimal) stok_minimal, \
                    IFNULL(smb.stok_maksimal,0) stok_maksimal, IFNULL(smb.lead_time,0) lead_time, IFNULL(smb.consumption_avg,0) consumption_avg, \
                    IFNULL(bk.buffer_stock,0) buffer_stock, (bk.kode_brng IS NOT NULL) kritis \
             FROM databarang d \
             LEFT JOIN kodesatuan sk ON sk.kode_sat=d.kode_sat \
             LEFT JOIN jenis j ON j.kdjns=d.kdjns \
             LEFT JOIN stok_minimal_bangsal smb ON smb.kode_brng=d.kode_brng AND smb.kd_bangsal=? \
             LEFT JOIN (SELECT kode_brng, SUM(stok) stok FROM gudangbarang WHERE kd_bangsal=? GROUP BY kode_brng) g ON g.kode_brng=d.kode_brng \
             LEFT JOIN barang_kritis_rscb bk ON bk.kode_brng=d.kode_brng \
             WHERE d.status='1' AND IFNULL(smb.stok_minimal,d.stokminimal) > 0 \
               AND IFNULL(g.stok,0) <= (IFNULL(smb.consumption_avg,0)*IFNULL(smb.lead_time,0) + IFNULL(smb.stok_minimal,d.stokminimal)) \
             ORDER BY (IFNULL(smb.consumption_avg,0)*IFNULL(smb.lead_time,0) + IFNULL(smb.stok_minimal,d.stokminimal) - IFNULL(g.stok,0)) DESC LIMIT 1000",
        ).bind(kd).bind(kd).fetch_all(&s.pool).await.map_err(db_err)?
    } else {
        sqlx::query_as::<_, EwRow>(
            "SELECT d.kode_brng, IFNULL(d.nama_brng,'') nama_brng, IFNULL(sk.satuan,'') satuan, IFNULL(j.nama,'') jenis, \
                    IFNULL(g.stok,0) stok, d.stokminimal stok_minimal, 0e0 stok_maksimal, 0e0 lead_time, 0e0 consumption_avg, \
                    IFNULL(bk.buffer_stock,0) buffer_stock, (bk.kode_brng IS NOT NULL) kritis \
             FROM databarang d \
             LEFT JOIN kodesatuan sk ON sk.kode_sat=d.kode_sat \
             LEFT JOIN jenis j ON j.kdjns=d.kdjns \
             LEFT JOIN (SELECT gb.kode_brng, SUM(gb.stok) stok FROM gudangbarang gb INNER JOIN bangsal b ON b.kd_bangsal=gb.kd_bangsal WHERE b.status='1' GROUP BY gb.kode_brng) g ON g.kode_brng=d.kode_brng \
             LEFT JOIN barang_kritis_rscb bk ON bk.kode_brng=d.kode_brng \
             WHERE d.status='1' AND d.stokminimal > 0 AND IFNULL(g.stok,0) <= d.stokminimal \
             ORDER BY (d.stokminimal - IFNULL(g.stok,0)) DESC LIMIT 1000",
        ).fetch_all(&s.pool).await.map_err(db_err)?
    };
    let mut kritis = 0; let mut pesan = 0;
    let data: Vec<Value> = rows.iter().map(|r| {
        let rop = r.consumption_avg * r.lead_time + r.stok_minimal;
        let status = if r.stok <= 0.0 || (r.buffer_stock > 0.0 && r.stok <= r.buffer_stock) { "Kritis" } else { "Perlu Pesan" };
        if status == "Kritis" { kritis += 1; } else { pesan += 1; }
        let usul = (if r.stok_maksimal > 0.0 { r.stok_maksimal } else { rop.max(r.stok_minimal * 2.0) } - r.stok).max(0.0);
        json!({
            "kode_brng": r.kode_brng, "nama_brng": r.nama_brng, "satuan": r.satuan, "jenis": r.jenis,
            "stok": r.stok, "stok_minimal": r.stok_minimal, "stok_maksimal": r.stok_maksimal,
            "lead_time": r.lead_time, "consumption_avg": r.consumption_avg,
            "reorder_point": rop, "buffer_stock": r.buffer_stock, "kritis": r.kritis == 1,
            "status": status, "usul_pesan": usul.ceil(),
        })
    }).collect();
    Ok(Json(json!({ "ringkasan": { "total": rows.len(), "kritis": kritis, "perlu_pesan": pesan }, "data": data })))
}

// (1) Set reorder point per item+depo (upsert stok_minimal_bangsal)
#[derive(Deserialize)]
pub struct ReorderBody {
    pub kode_brng: String, pub kd_bangsal: String,
    #[serde(default)] pub stok_minimal: f64, #[serde(default)] pub stok_maksimal: f64,
    #[serde(default)] pub lead_time: f64, #[serde(default)] pub consumption_avg: f64,
}
pub async fn set_reorder(
    _u: AuthUser, State(s): State<AppState>, Json(b): Json<ReorderBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.kode_brng.trim().is_empty() || b.kd_bangsal.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"kode_brng & kd_bangsal wajib"}))));
    }
    sqlx::query(
        "INSERT INTO stok_minimal_bangsal (kode_brng, kd_bangsal, stok_minimal, stok_maksimal, lead_time, consumption_avg, aktif, tgl_hitung) \
         VALUES (?,?,?,?,?,?,1,CURDATE()) \
         ON DUPLICATE KEY UPDATE stok_minimal=VALUES(stok_minimal), stok_maksimal=VALUES(stok_maksimal), lead_time=VALUES(lead_time), consumption_avg=VALUES(consumption_avg), aktif=1",
    )
    .bind(b.kode_brng.trim()).bind(b.kd_bangsal.trim()).bind(b.stok_minimal).bind(b.stok_maksimal).bind(b.lead_time).bind(b.consumption_avg)
    .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// (7) Set/unset barang kritis + buffer
#[derive(Deserialize)]
pub struct KritisBody {
    pub kode_brng: String, #[serde(default)] pub buffer_stock: f64,
    #[serde(default)] pub alasan: String, #[serde(default)] pub hapus: bool,
}
pub async fn set_kritis(
    u: AuthUser, State(s): State<AppState>, Json(b): Json<KritisBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.kode_brng.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"kode_brng wajib"})))); }
    if b.hapus {
        sqlx::query("DELETE FROM barang_kritis_rscb WHERE kode_brng=?").bind(b.kode_brng.trim()).execute(&s.pool).await.map_err(db_err)?;
    } else {
        sqlx::query(
            "INSERT INTO barang_kritis_rscb (kode_brng, buffer_stock, alasan, ditetapkan_oleh) VALUES (?,?,?,?) \
             ON DUPLICATE KEY UPDATE buffer_stock=VALUES(buffer_stock), alasan=VALUES(alasan)",
        ).bind(b.kode_brng.trim()).bind(b.buffer_stock).bind(opt(&b.alasan)).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    }
    Ok(Json(json!({"ok": true})))
}

// ── (3) FORECASTING dari mutasibarang ────────────────────────────────────────
#[derive(Deserialize)]
pub struct ForecastQuery { #[serde(default)] pub bulan: Option<i64>, #[serde(default)] pub q: Option<String> }

#[derive(sqlx::FromRow)]
struct FcRow { kode_brng: String, nama_brng: String, satuan: String, total_keluar: f64, stok: f64 }

pub async fn forecasting(
    _u: AuthUser, State(s): State<AppState>, Query(q): Query<ForecastQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let bulan = q.bulan.unwrap_or(6).clamp(1, 36);
    let like = q.q.as_deref().map(|x| format!("%{}%", x.trim())).unwrap_or_else(|| "%".into());
    // Pemakaian proxy: total mutasi keluar per barang dalam N bulan terakhir.
    let rows: Vec<FcRow> = sqlx::query_as::<_, FcRow>(
        "SELECT d.kode_brng, IFNULL(d.nama_brng,'') nama_brng, IFNULL(sk.satuan,'') satuan, \
                IFNULL(m.total,0) total_keluar, \
                IFNULL((SELECT SUM(gb.stok) FROM gudangbarang gb INNER JOIN bangsal b ON b.kd_bangsal=gb.kd_bangsal WHERE b.status='1' AND gb.kode_brng=d.kode_brng),0) stok \
         FROM databarang d \
         INNER JOIN (SELECT kode_brng, SUM(jml) total FROM mutasibarang WHERE tanggal >= DATE_SUB(CURDATE(), INTERVAL ? MONTH) GROUP BY kode_brng) m ON m.kode_brng=d.kode_brng \
         LEFT JOIN kodesatuan sk ON sk.kode_sat=d.kode_sat \
         WHERE d.status='1' AND (d.kode_brng LIKE ? OR d.nama_brng LIKE ?) \
         ORDER BY m.total DESC LIMIT 300",
    ).bind(bulan).bind(&like).bind(&like).fetch_all(&s.pool).await.map_err(db_err)?;

    let data: Vec<Value> = rows.iter().map(|r| {
        let per_bulan = r.total_keluar / bulan as f64;
        // Proyeksi kebutuhan 1 bulan ke depan; usul pesan = kebutuhan - stok (bila kurang).
        let proyeksi = per_bulan.ceil();
        let usul = (proyeksi - r.stok).max(0.0);
        json!({
            "kode_brng": r.kode_brng, "nama_brng": r.nama_brng, "satuan": r.satuan,
            "total_keluar": r.total_keluar, "rata_per_bulan": (per_bulan*10.0).round()/10.0,
            "stok": r.stok, "proyeksi_bulan_depan": proyeksi, "usul_pesan": usul.ceil(),
        })
    }).collect();
    Ok(Json(json!({ "bulan": bulan, "data": data })))
}

// ── (4) MONITORING LEAD TIME ─────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct LeadQuery { pub tgl_awal: String, pub tgl_akhir: String, #[serde(default)] pub target: Option<i64> }

#[derive(sqlx::FromRow)]
struct LeadRow {
    no_faktur: String, kode_suplier: String, nama_suplier: String,
    tgl_pesan: String, tgl_faktur: String, tgl_terima: Option<String>, lead: Option<i64>, tagihan: f64,
}

pub async fn lead_time(
    _u: AuthUser, State(s): State<AppState>, Query(q): Query<LeadQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let target = q.target.unwrap_or(7);
    let rows: Vec<LeadRow> = sqlx::query_as::<_, LeadRow>(
        "SELECT p.no_faktur, IFNULL(p.kode_suplier,'') kode_suplier, IFNULL(ds.nama_suplier, p.kode_suplier) nama_suplier, \
                CAST(p.tgl_pesan AS CHAR) tgl_pesan, CAST(p.tgl_faktur AS CHAR) tgl_faktur, \
                CAST(pt.tgl_terima AS CHAR) tgl_terima, \
                DATEDIFF(IFNULL(pt.tgl_terima, p.tgl_faktur), p.tgl_pesan) lead, IFNULL(p.tagihan,0) tagihan \
         FROM pemesanan p \
         LEFT JOIN datasuplier ds ON ds.kode_suplier=p.kode_suplier \
         LEFT JOIN pemesanan_terima_rscb pt ON pt.no_faktur=p.no_faktur \
         WHERE p.tgl_pesan BETWEEN ? AND ? \
         ORDER BY p.tgl_pesan DESC LIMIT 1000",
    ).bind(&q.tgl_awal).bind(&q.tgl_akhir).fetch_all(&s.pool).await.map_err(db_err)?;

    let mut sum = 0i64; let mut n = 0i64; let mut over = 0i64;
    let data: Vec<Value> = rows.iter().map(|r| {
        let lead = r.lead.unwrap_or(0);
        let terlambat = r.tgl_terima.is_some() && lead > target;
        if r.tgl_terima.is_some() { sum += lead; n += 1; if lead > target { over += 1; } }
        json!({
            "no_faktur": r.no_faktur, "kode_suplier": r.kode_suplier, "nama_suplier": r.nama_suplier,
            "tgl_pesan": r.tgl_pesan, "tgl_faktur": r.tgl_faktur, "tgl_terima": r.tgl_terima,
            "lead": lead, "tagihan": r.tagihan, "terlambat": terlambat, "ada_terima": r.tgl_terima.is_some(),
        })
    }).collect();
    let avg = if n > 0 { (sum as f64 / n as f64 * 10.0).round() / 10.0 } else { 0.0 };
    Ok(Json(json!({ "target": target, "ringkasan": { "total_po": rows.len(), "dgn_terima": n, "avg_lead": avg, "terlambat": over }, "data": data })))
}

// (4b) Catat tanggal terima PO
#[derive(Deserialize)]
pub struct TerimaBody { pub no_faktur: String, #[serde(default)] pub tgl_terima: String, #[serde(default)] pub keterangan: String }
pub async fn set_terima(
    u: AuthUser, State(s): State<AppState>, Json(b): Json<TerimaBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.no_faktur.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_faktur wajib"})))); }
    if b.tgl_terima.trim().is_empty() {
        sqlx::query("DELETE FROM pemesanan_terima_rscb WHERE no_faktur=?").bind(b.no_faktur.trim()).execute(&s.pool).await.map_err(db_err)?;
    } else {
        sqlx::query(
            "INSERT INTO pemesanan_terima_rscb (no_faktur, tgl_terima, keterangan, dicatat_oleh) VALUES (?,?,?,?) \
             ON DUPLICATE KEY UPDATE tgl_terima=VALUES(tgl_terima), keterangan=VALUES(keterangan)",
        ).bind(b.no_faktur.trim()).bind(b.tgl_terima.trim()).bind(opt(&b.keterangan)).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    }
    Ok(Json(json!({"ok": true})))
}

// ── (5) EVALUASI SUPPLIER ────────────────────────────────────────────────────
#[derive(sqlx::FromRow)]
struct SupRow {
    kode_suplier: String, nama_suplier: String, kota: String,
    jml_po: i64, total_nilai: f64, dgn_terima: i64, avg_lead: Option<f64>, terlambat: i64,
}
pub async fn supplier_eval(
    _u: AuthUser, State(s): State<AppState>, Query(q): Query<LeadQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let target = q.target.unwrap_or(7);
    let rows: Vec<SupRow> = sqlx::query_as::<_, SupRow>(
        "SELECT IFNULL(p.kode_suplier,'') kode_suplier, IFNULL(ds.nama_suplier,p.kode_suplier) nama_suplier, IFNULL(ds.kota,'') kota, \
                COUNT(*) jml_po, IFNULL(SUM(p.tagihan),0)+0e0 total_nilai, \
                COUNT(pt.tgl_terima) dgn_terima, \
                AVG(CASE WHEN pt.tgl_terima IS NOT NULL THEN DATEDIFF(pt.tgl_terima,p.tgl_pesan) END) avg_lead, \
                COUNT(CASE WHEN pt.tgl_terima IS NOT NULL AND DATEDIFF(pt.tgl_terima,p.tgl_pesan) > ? THEN 1 END) terlambat \
         FROM pemesanan p \
         LEFT JOIN datasuplier ds ON ds.kode_suplier=p.kode_suplier \
         LEFT JOIN pemesanan_terima_rscb pt ON pt.no_faktur=p.no_faktur \
         WHERE p.tgl_pesan BETWEEN ? AND ? \
         GROUP BY p.kode_suplier ORDER BY jml_po DESC LIMIT 500",
    ).bind(target).bind(&q.tgl_awal).bind(&q.tgl_akhir).fetch_all(&s.pool).await.map_err(db_err)?;

    let data: Vec<Value> = rows.iter().map(|r| {
        let ketepatan = if r.dgn_terima > 0 { ((r.dgn_terima - r.terlambat) as f64 / r.dgn_terima as f64 * 1000.0).round() / 10.0 } else { -1.0 };
        json!({
            "kode_suplier": r.kode_suplier, "nama_suplier": r.nama_suplier, "kota": r.kota,
            "jml_po": r.jml_po, "total_nilai": r.total_nilai, "dgn_terima": r.dgn_terima,
            "avg_lead": r.avg_lead.map(|v| (v*10.0).round()/10.0), "terlambat": r.terlambat,
            "ketepatan_persen": if ketepatan < 0.0 { Value::Null } else { json!(ketepatan) },
        })
    }).collect();
    Ok(Json(json!({ "target": target, "data": data })))
}

// ── (6) STOCK OPNAME ─────────────────────────────────────────────────────────
#[derive(sqlx::FromRow)]
struct OpnameHdr { id: i64, kd_bangsal: String, nm_bangsal: String, tanggal: String, keterangan: String, status: String, jml_item: i64, jml_selisih: i64 }

pub async fn opname_list(
    _u: AuthUser, State(s): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let rows: Vec<OpnameHdr> = sqlx::query_as::<_, OpnameHdr>(
        "SELECT o.id, IFNULL(o.kd_bangsal,'') kd_bangsal, IFNULL(b.nm_bangsal,'') nm_bangsal, CAST(o.tanggal AS CHAR) tanggal, \
                IFNULL(o.keterangan,'') keterangan, IFNULL(o.status,'Draft') status, \
                (SELECT COUNT(*) FROM stok_opname_detail_rscb dt WHERE dt.id_opname=o.id) jml_item, \
                (SELECT COUNT(*) FROM stok_opname_detail_rscb dt WHERE dt.id_opname=o.id AND dt.selisih<>0) jml_selisih \
         FROM stok_opname_rscb o LEFT JOIN bangsal b ON b.kd_bangsal=o.kd_bangsal \
         ORDER BY o.id DESC LIMIT 200",
    ).fetch_all(&s.pool).await.map_err(db_err)?;
    let data: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.id, "kd_bangsal": r.kd_bangsal, "nm_bangsal": r.nm_bangsal, "tanggal": r.tanggal,
        "keterangan": r.keterangan, "status": r.status, "jml_item": r.jml_item, "jml_selisih": r.jml_selisih,
    })).collect();
    Ok(Json(json!({ "data": data })))
}

#[derive(Deserialize)]
pub struct OpnameBody { pub kd_bangsal: String, #[serde(default)] pub tanggal: String, #[serde(default)] pub keterangan: String }
pub async fn opname_create(
    u: AuthUser, State(s): State<AppState>, Json(b): Json<OpnameBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.kd_bangsal.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Depo wajib"})))); }
    let tanggal = if b.tanggal.trim().is_empty() { None } else { Some(b.tanggal.trim().to_string()) };
    let res = sqlx::query("INSERT INTO stok_opname_rscb (kd_bangsal, tanggal, keterangan, status, dibuat_oleh) VALUES (?, IFNULL(?,CURDATE()), ?, 'Draft', ?)")
        .bind(b.kd_bangsal.trim()).bind(&tanggal).bind(opt(&b.keterangan)).bind(&u.0.kode)
        .execute(&s.pool).await.map_err(db_err)?;
    let id = res.last_insert_id() as i64;
    // Muat stok sistem dari gudangbarang depo tsb ke detail (stok_fisik awal = sistem).
    sqlx::query(
        "INSERT INTO stok_opname_detail_rscb (id_opname, kode_brng, stok_sistem, stok_fisik, selisih) \
         SELECT ?, gb.kode_brng, SUM(gb.stok), SUM(gb.stok), 0 FROM gudangbarang gb \
         INNER JOIN databarang d ON d.kode_brng=gb.kode_brng AND d.status='1' \
         WHERE gb.kd_bangsal=? GROUP BY gb.kode_brng",
    ).bind(id).bind(b.kd_bangsal.trim()).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "id": id})))
}

#[derive(sqlx::FromRow)]
struct OpnameDet { id: i64, kode_brng: String, nama_brng: String, satuan: String, stok_sistem: f64, stok_fisik: f64, selisih: f64, keterangan: String }
pub async fn opname_detail(
    _u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let hdr: Option<(String, String, String, String)> = sqlx::query_as(
        "SELECT IFNULL(o.kd_bangsal,''), IFNULL(b.nm_bangsal,''), IFNULL(o.status,'Draft'), CAST(o.tanggal AS CHAR) \
         FROM stok_opname_rscb o LEFT JOIN bangsal b ON b.kd_bangsal=o.kd_bangsal WHERE o.id=?",
    ).bind(id).fetch_optional(&s.pool).await.map_err(db_err)?;
    let (kd, nm, status, tgl) = hdr.ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"Opname tidak ditemukan"}))))?;
    let rows: Vec<OpnameDet> = sqlx::query_as::<_, OpnameDet>(
        "SELECT dt.id, dt.kode_brng, IFNULL(d.nama_brng,'') nama_brng, IFNULL(sk.satuan,'') satuan, \
                IFNULL(dt.stok_sistem,0) stok_sistem, IFNULL(dt.stok_fisik,0) stok_fisik, IFNULL(dt.selisih,0) selisih, IFNULL(dt.keterangan,'') keterangan \
         FROM stok_opname_detail_rscb dt \
         LEFT JOIN databarang d ON d.kode_brng=dt.kode_brng \
         LEFT JOIN kodesatuan sk ON sk.kode_sat=d.kode_sat \
         WHERE dt.id_opname=? ORDER BY d.nama_brng",
    ).bind(id).fetch_all(&s.pool).await.map_err(db_err)?;
    let data: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.id, "kode_brng": r.kode_brng, "nama_brng": r.nama_brng, "satuan": r.satuan,
        "stok_sistem": r.stok_sistem, "stok_fisik": r.stok_fisik, "selisih": r.selisih, "keterangan": r.keterangan,
    })).collect();
    Ok(Json(json!({ "id": id, "kd_bangsal": kd, "nm_bangsal": nm, "status": status, "tanggal": tgl, "data": data })))
}

#[derive(Deserialize)]
pub struct OpnameItemBody { pub id_detail: i64, pub stok_fisik: f64, #[serde(default)] pub keterangan: String }
pub async fn opname_save_item(
    _u: AuthUser, State(s): State<AppState>, Path(_id): Path<i64>, Json(b): Json<OpnameItemBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query("UPDATE stok_opname_detail_rscb SET stok_fisik=?, selisih=?-stok_sistem, keterangan=? WHERE id=?")
        .bind(b.stok_fisik).bind(b.stok_fisik).bind(opt(&b.keterangan)).bind(b.id_detail)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

pub async fn opname_finalize(
    _u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query("UPDATE stok_opname_rscb SET status='Final', finalized_at=NOW() WHERE id=?").bind(id)
        .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

pub async fn opname_hapus(
    _u: AuthUser, State(s): State<AppState>, Path(id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query("DELETE FROM stok_opname_detail_rscb WHERE id_opname=?").bind(id).execute(&s.pool).await.map_err(db_err)?;
    sqlx::query("DELETE FROM stok_opname_rscb WHERE id=? AND status<>'Final'").bind(id).execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
