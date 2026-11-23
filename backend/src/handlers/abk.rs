// Analisa Beban Kerja Kesehatan (ABK-Kes, PMK No. 33 Tahun 2015)
use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB ABK-Kes error: {}", e);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": e.to_string() })),
    )
}

// ============================================================================
// STRUCTS
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct AbkUnitRow {
    pub id: i32,
    pub unit: String,
    pub kategori_sdm: String,
    pub tahun: i32,
    pub jumlah_sdm_saat_ini: i32,
    pub hari_kerja: i32,
    pub cuti_hari: i32,
    pub diklat_hari: i32,
    pub libur_nasional_hari: i32,
    pub ketidakhadiran_hari: i32,
    // Di MySQL, DECIMAL dimetakan ke sqlx::types::BigDecimal atau f64 via CAST
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AbkUnit {
    pub id: i32,
    pub unit: String,
    pub kategori_sdm: String,
    pub tahun: i32,
    pub jumlah_sdm_saat_ini: i32,
    pub hari_kerja: i32,
    pub cuti_hari: i32,
    pub diklat_hari: i32,
    pub libur_nasional_hari: i32,
    pub ketidakhadiran_hari: i32,
    pub jam_kerja_hari: f64,
    pub ftp: f64,
    pub keterangan: String,
    // Calculated fields
    pub wkt: f64,
    pub kebutuhan_sdm_abk: f64,
    pub kekurangan: f64,
    pub beban_kerja: Option<Vec<AbkBebanKerja>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AbkBebanKerja {
    pub id: i32,
    pub abk_unit_id: i32,
    pub nama_kegiatan: String,
    pub waktu_rata2_menit: f64,
    pub total_kegiatan: i32,
    pub keterangan: String,
    // Calculated
    pub sbk: f64,
    pub kebutuhan_sdm: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AbkSummary {
    pub total_unit: i32,
    pub kebutuhan_sdm_abk: f64,
    pub sdm_saat_ini: i32,
    pub kekurangan: f64,
}

#[derive(Debug, Deserialize)]
pub struct UnitQuery {
    pub tahun: Option<i32>,
    pub keyword: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUnitBody {
    pub unit: String,
    pub kategori_sdm: String,
    pub tahun: Option<i32>,
    pub jumlah_sdm_saat_ini: Option<i32>,
    pub hari_kerja: Option<i32>,
    pub cuti_hari: Option<i32>,
    pub diklat_hari: Option<i32>,
    pub libur_nasional_hari: Option<i32>,
    pub ketidakhadiran_hari: Option<i32>,
    pub jam_kerja_hari: Option<f64>,
    pub ftp: Option<f64>,
    pub keterangan: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBebanKerjaBody {
    pub nama_kegiatan: String,
    pub waktu_rata2_menit: Option<f64>,
    pub total_kegiatan: Option<i32>,
    pub keterangan: Option<String>,
}

// ============================================================================
// HELPER CALCULATION
// ============================================================================

fn hitung_wkt(
    hari_kerja: i32,
    cuti: i32,
    diklat: i32,
    libur: i32,
    ketidakhadiran: i32,
    jam_kerja: f64,
) -> f64 {
    let hari_efektif = (hari_kerja - cuti - diklat - libur - ketidakhadiran).max(0);
    hari_efektif as f64 * jam_kerja
}

fn hitung_sbk(wkt: f64, waktu_menit: f64) -> f64 {
    if waktu_menit <= 0.0 {
        return 0.0;
    }
    let waktu_jam = waktu_menit / 60.0;
    if waktu_jam <= 0.0 {
        return 0.0;
    }
    wkt / waktu_jam
}

fn hitung_kebutuhan_sdm(beban_list: &[AbkBebanKerja], wkt: f64, ftp: f64) -> f64 {
    let mut total_pokok = 0.0;
    for b in beban_list {
        let sbk = hitung_sbk(wkt, b.waktu_rata2_menit);
        if sbk > 0.0 {
            total_pokok += b.total_kegiatan as f64 / sbk;
        }
    }
    total_pokok * (1.0 + (ftp / 100.0))
}

async fn load_beban_kerja(
    pool: &sqlx::MySqlPool,
    unit_id: i32,
    wkt: f64,
) -> Result<Vec<AbkBebanKerja>, sqlx::Error> {
    #[derive(sqlx::FromRow)]
    struct RawBeban {
        id: i32,
        abk_unit_id: i32,
        nama_kegiatan: String,
        waktu_rata2_menit: f64,
        total_kegiatan: i32,
        keterangan: String,
    }

    let rows: Vec<RawBeban> = sqlx::query_as(
        r#"SELECT id, abk_unit_id, nama_kegiatan,
                  CAST(waktu_rata2_menit AS DOUBLE) AS waktu_rata2_menit,
                  total_kegiatan,
                  IFNULL(keterangan, '') AS keterangan
           FROM abk_beban_kerja
           WHERE abk_unit_id = ?
           ORDER BY id"#,
    )
    .bind(unit_id)
    .fetch_all(pool)
    .await?;

    let mut list = Vec::with_capacity(rows.len());
    for r in rows {
        let sbk = hitung_sbk(wkt, r.waktu_rata2_menit);
        let kebutuhan_sdm = if sbk > 0.0 {
            r.total_kegiatan as f64 / sbk
        } else {
            0.0
        };
        list.push(AbkBebanKerja {
            id: r.id,
            abk_unit_id: r.abk_unit_id,
            nama_kegiatan: r.nama_kegiatan,
            waktu_rata2_menit: r.waktu_rata2_menit,
            total_kegiatan: r.total_kegiatan,
            keterangan: r.keterangan,
            sbk,
            kebutuhan_sdm,
        });
    }

    Ok(list)
}

// ============================================================================
// HANDLERS
// ============================================================================

/// GET /api/abk/summary?tahun=...
pub async fn get_summary(
    State(s): State<AppState>,
    Query(q): Query<UnitQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or(2026);

    #[derive(sqlx::FromRow)]
    struct RawUnit {
        id: i32,
        jumlah_sdm_saat_ini: i32,
        hari_kerja: i32,
        cuti_hari: i32,
        diklat_hari: i32,
        libur_nasional_hari: i32,
        ketidakhadiran_hari: i32,
        jam_kerja_hari: f64,
        ftp: f64,
    }

    let rows: Vec<RawUnit> = sqlx::query_as(
        r#"SELECT id, jumlah_sdm_saat_ini, hari_kerja, cuti_hari, diklat_hari,
                  libur_nasional_hari, ketidakhadiran_hari,
                  CAST(jam_kerja_hari AS DOUBLE) AS jam_kerja_hari,
                  CAST(ftp AS DOUBLE) AS ftp
           FROM abk_unit
           WHERE tahun = ?"#,
    )
    .bind(tahun)
    .fetch_all(&s.pool)
    .await
    .map_err(db_err)?;

    let mut total_unit = 0;
    let mut kebutuhan_sdm_abk = 0.0;
    let mut sdm_saat_ini = 0;

    for u in rows {
        let wkt = hitung_wkt(
            u.hari_kerja,
            u.cuti_hari,
            u.diklat_hari,
            u.libur_nasional_hari,
            u.ketidakhadiran_hari,
            u.jam_kerja_hari,
        );
        let beban = load_beban_kerja(&s.pool, u.id, wkt)
            .await
            .unwrap_or_default();
        let kebutuhan = hitung_kebutuhan_sdm(&beban, wkt, u.ftp);

        total_unit += 1;
        kebutuhan_sdm_abk += kebutuhan;
        sdm_saat_ini += u.jumlah_sdm_saat_ini;
    }

    let kebutuhan_sdm_abk = (kebutuhan_sdm_abk * 100.0).round() / 100.0;
    let kekurangan = ((kebutuhan_sdm_abk - sdm_saat_ini as f64) * 100.0).round() / 100.0;

    Ok(Json(json!({
        "data": AbkSummary {
            total_unit,
            kebutuhan_sdm_abk,
            sdm_saat_ini,
            kekurangan,
        }
    })))
}

/// GET /api/abk/unit?tahun=...&keyword=...
pub async fn get_units(
    State(s): State<AppState>,
    Query(q): Query<UnitQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    #[derive(sqlx::FromRow)]
    struct RawUnitFull {
        id: i32,
        unit: String,
        kategori_sdm: String,
        tahun: i32,
        jumlah_sdm_saat_ini: i32,
        hari_kerja: i32,
        cuti_hari: i32,
        diklat_hari: i32,
        libur_nasional_hari: i32,
        ketidakhadiran_hari: i32,
        jam_kerja_hari: f64,
        ftp: f64,
        keterangan: String,
    }

    let mut sql = String::from(
        r#"SELECT id, unit, kategori_sdm, tahun, jumlah_sdm_saat_ini,
                  hari_kerja, cuti_hari, diklat_hari, libur_nasional_hari, ketidakhadiran_hari,
                  CAST(jam_kerja_hari AS DOUBLE) AS jam_kerja_hari,
                  CAST(ftp AS DOUBLE) AS ftp,
                  IFNULL(keterangan, '') AS keterangan
           FROM abk_unit
           WHERE 1=1"#,
    );

    if q.tahun.is_some() {
        sql.push_str(" AND tahun = ?");
    }
    if let Some(ref kw) = q.keyword {
        if !kw.trim().is_empty() {
            sql.push_str(" AND (unit LIKE ? OR kategori_sdm LIKE ?)");
        }
    }
    sql.push_str(" ORDER BY tahun DESC, unit, kategori_sdm");

    let mut query = sqlx::query_as::<_, RawUnitFull>(&sql);

    if let Some(thn) = q.tahun {
        query = query.bind(thn);
    }
    if let Some(ref kw) = q.keyword {
        if !kw.trim().is_empty() {
            let pattern = format!("%{}%", kw.trim());
            query = query.bind(pattern.clone()).bind(pattern);
        }
    }

    let rows = query.fetch_all(&s.pool).await.map_err(db_err)?;

    let mut result = Vec::with_capacity(rows.len());
    for r in rows {
        let wkt = hitung_wkt(
            r.hari_kerja,
            r.cuti_hari,
            r.diklat_hari,
            r.libur_nasional_hari,
            r.ketidakhadiran_hari,
            r.jam_kerja_hari,
        );
        let beban = load_beban_kerja(&s.pool, r.id, wkt)
            .await
            .unwrap_or_default();
        let kebutuhan_sdm_abk =
            (hitung_kebutuhan_sdm(&beban, wkt, r.ftp) * 100.0).round() / 100.0;
        let kekurangan =
            ((kebutuhan_sdm_abk - r.jumlah_sdm_saat_ini as f64) * 100.0).round() / 100.0;

        result.push(AbkUnit {
            id: r.id,
            unit: r.unit,
            kategori_sdm: r.kategori_sdm,
            tahun: r.tahun,
            jumlah_sdm_saat_ini: r.jumlah_sdm_saat_ini,
            hari_kerja: r.hari_kerja,
            cuti_hari: r.cuti_hari,
            diklat_hari: r.diklat_hari,
            libur_nasional_hari: r.libur_nasional_hari,
            ketidakhadiran_hari: r.ketidakhadiran_hari,
            jam_kerja_hari: r.jam_kerja_hari,
            ftp: r.ftp,
            keterangan: r.keterangan,
            wkt,
            kebutuhan_sdm_abk,
            kekurangan,
            beban_kerja: Some(beban),
        });
    }

    Ok(Json(json!({ "data": result })))
}

/// GET /api/abk/unit/:id
pub async fn get_unit_detail(
    State(s): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    #[derive(sqlx::FromRow)]
    struct RawUnitFull {
        id: i32,
        unit: String,
        kategori_sdm: String,
        tahun: i32,
        jumlah_sdm_saat_ini: i32,
        hari_kerja: i32,
        cuti_hari: i32,
        diklat_hari: i32,
        libur_nasional_hari: i32,
        ketidakhadiran_hari: i32,
        jam_kerja_hari: f64,
        ftp: f64,
        keterangan: String,
    }

    let r: Option<RawUnitFull> = sqlx::query_as(
        r#"SELECT id, unit, kategori_sdm, tahun, jumlah_sdm_saat_ini,
                  hari_kerja, cuti_hari, diklat_hari, libur_nasional_hari, ketidakhadiran_hari,
                  CAST(jam_kerja_hari AS DOUBLE) AS jam_kerja_hari,
                  CAST(ftp AS DOUBLE) AS ftp,
                  IFNULL(keterangan, '') AS keterangan
           FROM abk_unit
           WHERE id = ?"#,
    )
    .bind(id)
    .fetch_optional(&s.pool)
    .await
    .map_err(db_err)?;

    let r = match r {
        Some(v) => v,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Data unit tidak ditemukan" })),
            ))
        }
    };

    let wkt = hitung_wkt(
        r.hari_kerja,
        r.cuti_hari,
        r.diklat_hari,
        r.libur_nasional_hari,
        r.ketidakhadiran_hari,
        r.jam_kerja_hari,
    );
    let beban = load_beban_kerja(&s.pool, r.id, wkt)
        .await
        .unwrap_or_default();
    let kebutuhan_sdm_abk =
        (hitung_kebutuhan_sdm(&beban, wkt, r.ftp) * 100.0).round() / 100.0;
    let kekurangan = ((kebutuhan_sdm_abk - r.jumlah_sdm_saat_ini as f64) * 100.0).round() / 100.0;

    let unit = AbkUnit {
        id: r.id,
        unit: r.unit,
        kategori_sdm: r.kategori_sdm,
        tahun: r.tahun,
        jumlah_sdm_saat_ini: r.jumlah_sdm_saat_ini,
        hari_kerja: r.hari_kerja,
        cuti_hari: r.cuti_hari,
        diklat_hari: r.diklat_hari,
        libur_nasional_hari: r.libur_nasional_hari,
        ketidakhadiran_hari: r.ketidakhadiran_hari,
        jam_kerja_hari: r.jam_kerja_hari,
        ftp: r.ftp,
        keterangan: r.keterangan,
        wkt,
        kebutuhan_sdm_abk,
        kekurangan,
        beban_kerja: Some(beban),
    };

    Ok(Json(json!({ "data": unit })))
}

/// POST /api/abk/unit
pub async fn create_unit(
    _u: AuthUser,
    State(s): State<AppState>,
    Json(b): Json<CreateUnitBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.unit.trim().is_empty() || b.kategori_sdm.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Unit dan kategori SDM wajib diisi" })),
        ));
    }

    let tahun = b.tahun.unwrap_or(2026);
    let jumlah_sdm = b.jumlah_sdm_saat_ini.unwrap_or(0);
    let hari_kerja = b.hari_kerja.unwrap_or(312);
    let cuti = b.cuti_hari.unwrap_or(12);
    let diklat = b.diklat_hari.unwrap_or(6);
    let libur = b.libur_nasional_hari.unwrap_or(19);
    let ketidakhadiran = b.ketidakhadiran_hari.unwrap_or(10);
    let jam_kerja = b.jam_kerja_hari.unwrap_or(6.0);
    let ftp = b.ftp.unwrap_or(1.0);
    let ket = b.keterangan.unwrap_or_default();

    let res = sqlx::query(
        r#"INSERT INTO abk_unit
           (unit, kategori_sdm, tahun, jumlah_sdm_saat_ini,
            hari_kerja, cuti_hari, diklat_hari, libur_nasional_hari, ketidakhadiran_hari,
            jam_kerja_hari, ftp, keterangan)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(b.unit.trim())
    .bind(b.kategori_sdm.trim())
    .bind(tahun)
    .bind(jumlah_sdm)
    .bind(hari_kerja)
    .bind(cuti)
    .bind(diklat)
    .bind(libur)
    .bind(ketidakhadiran)
    .bind(jam_kerja)
    .bind(ftp)
    .bind(ket)
    .execute(&s.pool)
    .await
    .map_err(db_err)?;

    let new_id = res.last_insert_id();

    Ok(Json(json!({
        "success": true,
        "message": "Unit ABK berhasil ditambahkan",
        "id": new_id
    })))
}

/// PUT /api/abk/unit/:id
pub async fn update_unit(
    _u: AuthUser,
    State(s): State<AppState>,
    Path(id): Path<i32>,
    Json(b): Json<CreateUnitBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.unit.trim().is_empty() || b.kategori_sdm.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Unit dan kategori SDM wajib diisi" })),
        ));
    }

    let tahun = b.tahun.unwrap_or(2026);
    let jumlah_sdm = b.jumlah_sdm_saat_ini.unwrap_or(0);
    let hari_kerja = b.hari_kerja.unwrap_or(312);
    let cuti = b.cuti_hari.unwrap_or(12);
    let diklat = b.diklat_hari.unwrap_or(6);
    let libur = b.libur_nasional_hari.unwrap_or(19);
    let ketidakhadiran = b.ketidakhadiran_hari.unwrap_or(10);
    let jam_kerja = b.jam_kerja_hari.unwrap_or(6.0);
    let ftp = b.ftp.unwrap_or(1.0);
    let ket = b.keterangan.unwrap_or_default();

    sqlx::query(
        r#"UPDATE abk_unit
           SET unit = ?, kategori_sdm = ?, tahun = ?, jumlah_sdm_saat_ini = ?,
               hari_kerja = ?, cuti_hari = ?, diklat_hari = ?, libur_nasional_hari = ?, ketidakhadiran_hari = ?,
               jam_kerja_hari = ?, ftp = ?, keterangan = ?
           WHERE id = ?"#,
    )
    .bind(b.unit.trim())
    .bind(b.kategori_sdm.trim())
    .bind(tahun)
    .bind(jumlah_sdm)
    .bind(hari_kerja)
    .bind(cuti)
    .bind(diklat)
    .bind(libur)
    .bind(ketidakhadiran)
    .bind(jam_kerja)
    .bind(ftp)
    .bind(ket)
    .bind(id)
    .execute(&s.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(json!({
        "success": true,
        "message": "Unit ABK berhasil diperbarui"
    })))
}

/// DELETE /api/abk/unit/:id
pub async fn delete_unit(
    _u: AuthUser,
    State(s): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query("DELETE FROM abk_unit WHERE id = ?")
        .bind(id)
        .execute(&s.pool)
        .await
        .map_err(db_err)?;

    Ok(Json(json!({
        "success": true,
        "message": "Unit ABK berhasil dihapus"
    })))
}

/// GET /api/abk/beban-kerja/unit/:unit_id
pub async fn get_beban_kerja_by_unit(
    State(s): State<AppState>,
    Path(unit_id): Path<i32>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    #[derive(sqlx::FromRow)]
    struct WktRow {
        hari_kerja: i32,
        cuti_hari: i32,
        diklat_hari: i32,
        libur_nasional_hari: i32,
        ketidakhadiran_hari: i32,
        jam_kerja_hari: f64,
    }

    let wkt_data: Option<WktRow> = sqlx::query_as(
        r#"SELECT hari_kerja, cuti_hari, diklat_hari, libur_nasional_hari, ketidakhadiran_hari,
                  CAST(jam_kerja_hari AS DOUBLE) AS jam_kerja_hari
           FROM abk_unit WHERE id = ?"#,
    )
    .bind(unit_id)
    .fetch_optional(&s.pool)
    .await
    .map_err(db_err)?;

    let wkt = if let Some(w) = wkt_data {
        hitung_wkt(
            w.hari_kerja,
            w.cuti_hari,
            w.diklat_hari,
            w.libur_nasional_hari,
            w.ketidakhadiran_hari,
            w.jam_kerja_hari,
        )
    } else {
        0.0
    };

    let list = load_beban_kerja(&s.pool, unit_id, wkt)
        .await
        .map_err(db_err)?;

    Ok(Json(json!({ "data": list })))
}

/// POST /api/abk/beban-kerja/unit/:unit_id
pub async fn create_beban_kerja(
    _u: AuthUser,
    State(s): State<AppState>,
    Path(unit_id): Path<i32>,
    Json(b): Json<CreateBebanKerjaBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.nama_kegiatan.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Nama kegiatan wajib diisi" })),
        ));
    }

    let waktu = b.waktu_rata2_menit.unwrap_or(30.0);
    let total = b.total_kegiatan.unwrap_or(0);
    let ket = b.keterangan.unwrap_or_default();

    let res = sqlx::query(
        r#"INSERT INTO abk_beban_kerja
           (abk_unit_id, nama_kegiatan, waktu_rata2_menit, total_kegiatan, keterangan)
           VALUES (?, ?, ?, ?, ?)"#,
    )
    .bind(unit_id)
    .bind(b.nama_kegiatan.trim())
    .bind(waktu)
    .bind(total)
    .bind(ket)
    .execute(&s.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(json!({
        "success": true,
        "message": "Kegiatan pokok berhasil ditambahkan",
        "id": res.last_insert_id()
    })))
}

/// PUT /api/abk/beban-kerja/:id
pub async fn update_beban_kerja(
    _u: AuthUser,
    State(s): State<AppState>,
    Path(id): Path<i32>,
    Json(b): Json<CreateBebanKerjaBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.nama_kegiatan.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Nama kegiatan wajib diisi" })),
        ));
    }

    let waktu = b.waktu_rata2_menit.unwrap_or(30.0);
    let total = b.total_kegiatan.unwrap_or(0);
    let ket = b.keterangan.unwrap_or_default();

    sqlx::query(
        r#"UPDATE abk_beban_kerja
           SET nama_kegiatan = ?, waktu_rata2_menit = ?, total_kegiatan = ?, keterangan = ?
           WHERE id = ?"#,
    )
    .bind(b.nama_kegiatan.trim())
    .bind(waktu)
    .bind(total)
    .bind(ket)
    .bind(id)
    .execute(&s.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(json!({
        "success": true,
        "message": "Kegiatan pokok berhasil diperbarui"
    })))
}

/// DELETE /api/abk/beban-kerja/:id
pub async fn delete_beban_kerja(
    _u: AuthUser,
    State(s): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query("DELETE FROM abk_beban_kerja WHERE id = ?")
        .bind(id)
        .execute(&s.pool)
        .await
        .map_err(db_err)?;

    Ok(Json(json!({
        "success": true,
        "message": "Kegiatan pokok berhasil dihapus"
    })))
}
