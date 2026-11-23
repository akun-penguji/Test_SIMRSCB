// Laporan Kendala Pendaftaran — log kendala operasional pendaftaran (online/
// offline) + rekap per bulan & per triwulan. Reuse izin evaluasi_pendaftaran_*.
use crate::{auth::middleware::AuthUser, handlers::web_perms::has_perm, AppState};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB kendala_pendaftaran: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))
}

// Kategori kendala yang dibakukan ("data rapih"). Nilai lain ditolak.
pub const KATEGORI: &[&str] = &[
    "BPJS offline / maintenance (rutin Senin)",
    "Verifikasi wajah gagal (pasien lansia)",
    "Check-in muncul expired",
    "Pasien lama terdeteksi baru",
    "Lainnya",
];

fn require_edit(u: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if has_perm(u, "evaluasi_pendaftaran_edit") || has_perm(u, "akreditasi_edit") {
        Ok(())
    } else {
        Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Perlu izin evaluasi_pendaftaran_edit" }))))
    }
}

pub async fn kategori_list(_u: AuthUser) -> Json<Value> {
    Json(json!({ "kategori": KATEGORI }))
}

// ── Tambah ───────────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct AddBody {
    pub tanggal: String,
    pub kategori: String,
    pub deskripsi: Option<String>,
    pub jumlah_kasus: Option<i64>,
    pub dampak: Option<String>,
    pub tindak_lanjut: Option<String>,
}

pub async fn add(
    u: AuthUser,
    State(s): State<AppState>,
    Json(b): Json<AddBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.tanggal.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"tanggal wajib"}))));
    }
    if !KATEGORI.contains(&b.kategori.as_str()) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"kategori tidak valid"}))));
    }
    let jml = b.jumlah_kasus.filter(|v| *v > 0).unwrap_or(1);
    sqlx::query(
        "INSERT INTO simrscb_kendala_pendaftaran (tanggal, kategori, deskripsi, jumlah_kasus, dampak, tindak_lanjut, nip) \
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&b.tanggal)
    .bind(&b.kategori)
    .bind(b.deskripsi.as_deref().unwrap_or("").trim())
    .bind(jml)
    .bind(b.dampak.as_deref().unwrap_or("").trim())
    .bind(b.tindak_lanjut.as_deref().unwrap_or("").trim())
    .bind(&u.0.kode)
    .execute(&s.pool)
    .await
    .map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Edit ─────────────────────────────────────────────────────────────────────
pub async fn edit(
    u: AuthUser,
    State(s): State<AppState>,
    Path(id): Path<i64>,
    Json(b): Json<AddBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.tanggal.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"tanggal wajib"}))));
    }
    if !KATEGORI.contains(&b.kategori.as_str()) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"kategori tidak valid"}))));
    }
    let jml = b.jumlah_kasus.filter(|v| *v > 0).unwrap_or(1);
    let res = sqlx::query(
        "UPDATE simrscb_kendala_pendaftaran \
         SET tanggal=?, kategori=?, deskripsi=?, jumlah_kasus=?, dampak=?, tindak_lanjut=? WHERE id=?",
    )
    .bind(&b.tanggal)
    .bind(&b.kategori)
    .bind(b.deskripsi.as_deref().unwrap_or("").trim())
    .bind(jml)
    .bind(b.dampak.as_deref().unwrap_or("").trim())
    .bind(b.tindak_lanjut.as_deref().unwrap_or("").trim())
    .bind(id)
    .execute(&s.pool)
    .await
    .map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"entri tidak ditemukan"}))));
    }
    Ok(Json(json!({"ok": true})))
}

// ── Hapus ────────────────────────────────────────────────────────────────────
pub async fn hapus(
    u: AuthUser,
    State(s): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    sqlx::query("DELETE FROM simrscb_kendala_pendaftaran WHERE id=?")
        .bind(id)
        .execute(&s.pool)
        .await
        .map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

// ── Daftar entri ─────────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct ListQ { pub tahun: Option<i64>, pub bulan: Option<i64> }

#[derive(sqlx::FromRow, Serialize)]
pub struct KendalaRow {
    pub id: i64,
    pub tanggal: String,
    pub kategori: String,
    pub deskripsi: Option<String>,
    pub jumlah_kasus: i64,
    pub dampak: Option<String>,
    pub tindak_lanjut: Option<String>,
    pub nama_petugas: Option<String>,
}

pub async fn list(
    _u: AuthUser,
    State(s): State<AppState>,
    Query(q): Query<ListQ>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = q.tahun.unwrap_or(0);
    let bulan = q.bulan.unwrap_or(0);
    let rows: Vec<KendalaRow> = sqlx::query_as(
        "SELECT k.id AS id, DATE_FORMAT(k.tanggal,'%Y-%m-%d') AS tanggal, k.kategori AS kategori, \
                k.deskripsi AS deskripsi, k.jumlah_kasus AS jumlah_kasus, k.dampak AS dampak, \
                k.tindak_lanjut AS tindak_lanjut, IFNULL(pg.nama,'') AS nama_petugas \
         FROM simrscb_kendala_pendaftaran k \
         LEFT JOIN pegawai pg ON pg.nik = k.nip \
         WHERE (? = 0 OR YEAR(k.tanggal) = ?) AND (? = 0 OR MONTH(k.tanggal) = ?) \
         ORDER BY k.tanggal DESC, k.id DESC",
    )
    .bind(tahun).bind(tahun).bind(bulan).bind(bulan)
    .fetch_all(&s.pool)
    .await
    .map_err(db_err)?;
    Ok(Json(json!({ "kendala": rows })))
}

// ── Rekap per bulan + per triwulan ──────────────────────────────────────────
#[derive(Deserialize)]
pub struct RekapQ { pub tahun: Option<i64> }

pub async fn rekap(
    _u: AuthUser,
    State(s): State<AppState>,
    Query(q): Query<RekapQ>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = match q.tahun.filter(|v| *v > 0) {
        Some(t) => t,
        None => sqlx::query_scalar::<_, i64>("SELECT YEAR(NOW())").fetch_one(&s.pool).await.map_err(db_err)?,
    };
    let rows: Vec<(String, i64, i64)> = sqlx::query_as(
        "SELECT kategori, MONTH(tanggal) AS bln, CAST(SUM(jumlah_kasus) AS SIGNED) AS jml \
         FROM simrscb_kendala_pendaftaran WHERE YEAR(tanggal) = ? \
         GROUP BY kategori, MONTH(tanggal)",
    )
    .bind(tahun)
    .fetch_all(&s.pool)
    .await
    .map_err(db_err)?;

    // Pivot: kategori → [12 bulan]. Kategori mengikuti daftar baku + kategori tak
    // dikenal (jaga-jaga) diselipkan setelahnya.
    let mut order: Vec<String> = KATEGORI.iter().map(|s| s.to_string()).collect();
    for (k, _, _) in &rows {
        if !order.iter().any(|o| o == k) { order.push(k.clone()); }
    }
    let mut per_kat: Vec<Value> = Vec::new();
    let mut total_bulan = [0i64; 12];
    for kat in &order {
        let mut bulan = [0i64; 12];
        for (k, bln, jml) in &rows {
            if k == kat && *bln >= 1 && *bln <= 12 {
                bulan[(*bln - 1) as usize] += *jml;
            }
        }
        let tri = [
            bulan[0] + bulan[1] + bulan[2],
            bulan[3] + bulan[4] + bulan[5],
            bulan[6] + bulan[7] + bulan[8],
            bulan[9] + bulan[10] + bulan[11],
        ];
        let total: i64 = bulan.iter().sum();
        for i in 0..12 { total_bulan[i] += bulan[i]; }
        // Sertakan hanya kategori baku selalu, kategori lain hanya jika ada data.
        if KATEGORI.contains(&kat.as_str()) || total > 0 {
            per_kat.push(json!({
                "kategori": kat, "bulan": bulan, "triwulan": tri, "total": total,
            }));
        }
    }
    let total_tri = [
        total_bulan[0] + total_bulan[1] + total_bulan[2],
        total_bulan[3] + total_bulan[4] + total_bulan[5],
        total_bulan[6] + total_bulan[7] + total_bulan[8],
        total_bulan[9] + total_bulan[10] + total_bulan[11],
    ];
    let grand: i64 = total_bulan.iter().sum();

    Ok(Json(json!({
        "tahun": tahun,
        "per_kategori": per_kat,
        "total_bulan": total_bulan,
        "total_triwulan": total_tri,
        "grand_total": grand,
    })))
}

// ── Evaluasi & Tindak Lanjut (per tahun) ────────────────────────────────────
#[derive(Deserialize)]
pub struct EvalQ { pub tahun: Option<i64> }

pub async fn evaluasi_get(
    _u: AuthUser,
    State(s): State<AppState>,
    Query(q): Query<EvalQ>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tahun = match q.tahun.filter(|v| *v > 0) {
        Some(t) => t,
        None => sqlx::query_scalar::<_, i64>("SELECT YEAR(NOW())").fetch_one(&s.pool).await.map_err(db_err)?,
    };
    let row: Option<(Option<String>, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT evaluasi, tindak_lanjut, kesimpulan, DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i') \
         FROM simrscb_kendala_evaluasi WHERE tahun=?",
    ).bind(tahun).fetch_optional(&s.pool).await.map_err(db_err)?;
    let (evaluasi, tindak_lanjut, kesimpulan, updated_at) =
        row.unwrap_or((None, None, None, None));
    Ok(Json(json!({
        "tahun": tahun, "evaluasi": evaluasi.unwrap_or_default(),
        "tindak_lanjut": tindak_lanjut.unwrap_or_default(),
        "kesimpulan": kesimpulan.unwrap_or_default(), "updated_at": updated_at,
    })))
}

#[derive(Deserialize)]
pub struct EvalBody {
    pub tahun: i64,
    #[serde(default)] pub evaluasi: String,
    #[serde(default)] pub tindak_lanjut: String,
    #[serde(default)] pub kesimpulan: String,
}
pub async fn evaluasi_save(
    u: AuthUser,
    State(s): State<AppState>,
    Json(b): Json<EvalBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_edit(&u)?;
    if b.tahun <= 0 { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"tahun tidak valid"})))); }
    sqlx::query(
        "INSERT INTO simrscb_kendala_evaluasi (tahun, evaluasi, tindak_lanjut, kesimpulan, nip) \
         VALUES (?, ?, ?, ?, ?) \
         ON DUPLICATE KEY UPDATE evaluasi=VALUES(evaluasi), tindak_lanjut=VALUES(tindak_lanjut), \
                                 kesimpulan=VALUES(kesimpulan), nip=VALUES(nip)",
    )
    .bind(b.tahun).bind(b.evaluasi.trim()).bind(b.tindak_lanjut.trim()).bind(b.kesimpulan.trim()).bind(&u.0.kode)
    .execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
