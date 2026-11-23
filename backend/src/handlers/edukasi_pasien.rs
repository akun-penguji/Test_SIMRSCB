use crate::{
    auth::middleware::AuthUser,
    models::edukasi_pasien::{EdukasiPasienPrefill, SimpanEdukasiPasien},
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

// ── GET /api/edukasi-pasien/:no_rawat ────────────────────────────────────────
pub async fn get_by_no_rawat(
    user: AuthUser,
    State(state): State<AppState>,
    Path(no_rawat): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "consent_view")?;
    let row: Option<EdukasiPasienPrefill> = sqlx::query_as(
        "SELECT e.no_rawat,
                DATE_FORMAT(e.tanggal,'%Y-%m-%dT%H:%i') AS tanggal,
                e.nip, IFNULL(p.nama,'') AS nama_petugas,
                e.tinggal_bersama, e.hambatan,
                e.hambatan_pendengaran, e.hambatan_emosi, e.hambatan_penglihatan, e.hambatan_bicara,
                e.motivasi_kurang, e.memori_hilang, e.fisik_lemah, e.alkoholik,
                e.tidak_mampu_belajar, e.perokok,
                e.edukasi_kepada, e.kemampuan_bahasa, e.bahasa_daerah, e.bahasa_asing,
                e.perlu_penerjemah, e.baca_tulis, e.kepercayaan_lainnya,
                e.kesediaan_menerima_edukasi, e.cara_edukasi,
                e.keb_partisipasi, e.keb_penunjang, e.keb_kondisi, e.keb_informed_concent,
                e.keb_diet, e.keb_obat, e.keb_alat_medis, e.keb_nyeri,
                e.keb_rehabilitasi, e.keb_cuci_tangan, e.keb_merokok, e.keb_lain_lain, e.keb_rujukan
         FROM edukasi_pasien_keluarga_rscb e
         LEFT JOIN petugas p ON e.nip = p.nip
         WHERE e.no_rawat = ? LIMIT 1"
    ).bind(&no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;

    Ok(Json(json!({ "data": row })))
}

// ── GET /api/edukasi-pasien (daftar tersimpan) ───────────────────────────────
#[derive(Deserialize)]
pub struct ListQuery {
    pub q: Option<String>,
    pub tgl_awal: Option<String>,
    pub tgl_akhir: Option<String>,
    pub limit: Option<i64>,
}

#[derive(sqlx::FromRow, serde::Serialize)]
struct ListRow {
    no_rawat: String,
    tanggal: Option<String>,
    no_rkm_medis: Option<String>,
    nm_pasien: Option<String>,
    nama_petugas: Option<String>,
}

pub async fn list(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "consent_view")?;
    let limit = q.limit.unwrap_or(100).clamp(1, 500);
    let from = q.tgl_awal.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "2000-01-01".into());
    let to = q.tgl_akhir.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "2999-12-31".into());
    let like = format!("%{}%", q.q.as_deref().unwrap_or("").trim());

    let rows: Vec<ListRow> = sqlx::query_as(
        "SELECT e.no_rawat, DATE_FORMAT(e.tanggal,'%Y-%m-%d') AS tanggal,
                r.no_rkm_medis, p.nm_pasien, IFNULL(pt.nama,'') AS nama_petugas
         FROM edukasi_pasien_keluarga_rscb e
         LEFT JOIN reg_periksa r ON r.no_rawat = e.no_rawat
         LEFT JOIN pasien p ON p.no_rkm_medis = r.no_rkm_medis
         LEFT JOIN petugas pt ON pt.nip = e.nip
         WHERE DATE(e.tanggal) BETWEEN ? AND ?
           AND (e.no_rawat LIKE ? OR p.nm_pasien LIKE ? OR r.no_rkm_medis LIKE ?)
         ORDER BY e.tanggal DESC
         LIMIT ?",
    )
    .bind(&from).bind(&to).bind(&like).bind(&like).bind(&like).bind(limit)
    .fetch_all(&state.pool).await.map_err(db_err)?;

    Ok(Json(json!({ "ok": true, "jumlah": rows.len(), "data": rows })))
}

// ── POST /api/edukasi-pasien ─────────────────────────────────────────────────
pub async fn simpan(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<SimpanEdukasiPasien>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_consent_edit(&user)?;
    if body.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib diisi"}))));
    }
    if body.nip.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"NIP petugas wajib diisi"}))));
    }

    let tanggal = body.tanggal.clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string())
        .replace('T', " ");
    let tanggal = if tanggal.len() == 16 { format!("{}:00", tanggal) } else { tanggal };

    // Default helpers: kalau client tidak kirim, pakai "Tidak"
    let def_tidak = |o: &Option<String>| o.clone().unwrap_or_else(|| "Tidak".to_string());
    let def_str  = |o: &Option<String>, d: &str| o.clone().unwrap_or_else(|| d.to_string());

    let mut tx = state.pool.begin().await.map_err(db_err)?;

    // 1) Upsert tabel utama Khanza
    sqlx::query(
        "INSERT INTO edukasi_pasien_keluarga_rscb
           (no_rawat, tanggal, nip,
            tinggal_bersama, hambatan,
            hambatan_pendengaran, hambatan_emosi, hambatan_penglihatan, hambatan_bicara,
            motivasi_kurang, memori_hilang, fisik_lemah, alkoholik,
            tidak_mampu_belajar, perokok,
            edukasi_kepada, kemampuan_bahasa, bahasa_daerah, bahasa_asing,
            perlu_penerjemah, baca_tulis, kepercayaan_lainnya,
            kesediaan_menerima_edukasi, cara_edukasi,
            keb_partisipasi, keb_penunjang, keb_kondisi, keb_informed_concent,
            keb_diet, keb_obat, keb_alat_medis, keb_nyeri,
            keb_rehabilitasi, keb_cuci_tangan, keb_merokok, keb_lain_lain, keb_rujukan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           tanggal=VALUES(tanggal), nip=VALUES(nip),
           tinggal_bersama=VALUES(tinggal_bersama), hambatan=VALUES(hambatan),
           hambatan_pendengaran=VALUES(hambatan_pendengaran), hambatan_emosi=VALUES(hambatan_emosi),
           hambatan_penglihatan=VALUES(hambatan_penglihatan), hambatan_bicara=VALUES(hambatan_bicara),
           motivasi_kurang=VALUES(motivasi_kurang), memori_hilang=VALUES(memori_hilang),
           fisik_lemah=VALUES(fisik_lemah), alkoholik=VALUES(alkoholik),
           tidak_mampu_belajar=VALUES(tidak_mampu_belajar), perokok=VALUES(perokok),
           edukasi_kepada=VALUES(edukasi_kepada), kemampuan_bahasa=VALUES(kemampuan_bahasa),
           bahasa_daerah=VALUES(bahasa_daerah), bahasa_asing=VALUES(bahasa_asing),
           perlu_penerjemah=VALUES(perlu_penerjemah), baca_tulis=VALUES(baca_tulis),
           kepercayaan_lainnya=VALUES(kepercayaan_lainnya),
           kesediaan_menerima_edukasi=VALUES(kesediaan_menerima_edukasi),
           cara_edukasi=VALUES(cara_edukasi),
           keb_partisipasi=VALUES(keb_partisipasi), keb_penunjang=VALUES(keb_penunjang),
           keb_kondisi=VALUES(keb_kondisi), keb_informed_concent=VALUES(keb_informed_concent),
           keb_diet=VALUES(keb_diet), keb_obat=VALUES(keb_obat),
           keb_alat_medis=VALUES(keb_alat_medis), keb_nyeri=VALUES(keb_nyeri),
           keb_rehabilitasi=VALUES(keb_rehabilitasi), keb_cuci_tangan=VALUES(keb_cuci_tangan),
           keb_merokok=VALUES(keb_merokok), keb_lain_lain=VALUES(keb_lain_lain),
           keb_rujukan=VALUES(keb_rujukan)"
    )
    .bind(&body.no_rawat).bind(&tanggal).bind(&body.nip)
    .bind(def_str(&body.tinggal_bersama, "")).bind(def_tidak(&body.hambatan))
    .bind(def_tidak(&body.hambatan_pendengaran)).bind(def_tidak(&body.hambatan_emosi))
    .bind(def_tidak(&body.hambatan_penglihatan)).bind(def_tidak(&body.hambatan_bicara))
    .bind(def_tidak(&body.motivasi_kurang)).bind(def_tidak(&body.memori_hilang))
    .bind(def_tidak(&body.fisik_lemah)).bind(def_tidak(&body.alkoholik))
    .bind(def_tidak(&body.tidak_mampu_belajar)).bind(def_tidak(&body.perokok))
    .bind(def_str(&body.edukasi_kepada, ""))
    .bind(def_str(&body.kemampuan_bahasa, "Indonesia"))
    .bind(body.bahasa_daerah.as_deref().unwrap_or(""))
    .bind(body.bahasa_asing.as_deref().unwrap_or(""))
    .bind(def_str(&body.perlu_penerjemah, "Tidak"))
    .bind(def_str(&body.baca_tulis, "Bisa"))
    .bind(body.kepercayaan_lainnya.as_deref().unwrap_or("Tidak"))
    .bind(def_str(&body.kesediaan_menerima_edukasi, "Ya"))
    .bind(def_str(&body.cara_edukasi, "Lisan"))
    .bind(def_tidak(&body.keb_partisipasi)).bind(def_tidak(&body.keb_penunjang))
    .bind(def_tidak(&body.keb_kondisi)).bind(def_tidak(&body.keb_informed_concent))
    .bind(def_tidak(&body.keb_diet)).bind(def_tidak(&body.keb_obat))
    .bind(def_tidak(&body.keb_alat_medis)).bind(def_tidak(&body.keb_nyeri))
    .bind(def_tidak(&body.keb_rehabilitasi)).bind(def_tidak(&body.keb_cuci_tangan))
    .bind(def_tidak(&body.keb_merokok))
    .bind(body.keb_lain_lain.as_deref().unwrap_or(""))
    .bind(def_tidak(&body.keb_rujukan))
    .execute(&mut *tx).await.map_err(|e| db_err_msg(e, "INSERT edukasi_pasien_keluarga_rscb"))?;

    tx.commit().await.map_err(db_err)?;

    use crate::audit::q;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "INSERT INTO edukasi_pasien_keluarga_rscb (no_rawat, tanggal, nip, tinggal_bersama, hambatan, hambatan_pendengaran, hambatan_emosi, hambatan_penglihatan, hambatan_bicara, motivasi_kurang, memori_hilang, fisik_lemah, alkoholik, tidak_mampu_belajar, perokok, edukasi_kepada, kemampuan_bahasa, bahasa_daerah, bahasa_asing, perlu_penerjemah, baca_tulis, kepercayaan_lainnya, kesediaan_menerima_edukasi, cara_edukasi, keb_partisipasi, keb_penunjang, keb_kondisi, keb_informed_concent, keb_diet, keb_obat, keb_alat_medis, keb_nyeri, keb_rehabilitasi, keb_cuci_tangan, keb_merokok, keb_lain_lain, keb_rujukan) VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})",
        q(&body.no_rawat), q(&tanggal), q(&body.nip),
        q(def_str(&body.tinggal_bersama, "")), q(def_tidak(&body.hambatan)),
        q(def_tidak(&body.hambatan_pendengaran)), q(def_tidak(&body.hambatan_emosi)),
        q(def_tidak(&body.hambatan_penglihatan)), q(def_tidak(&body.hambatan_bicara)),
        q(def_tidak(&body.motivasi_kurang)), q(def_tidak(&body.memori_hilang)),
        q(def_tidak(&body.fisik_lemah)), q(def_tidak(&body.alkoholik)),
        q(def_tidak(&body.tidak_mampu_belajar)), q(def_tidak(&body.perokok)),
        q(def_str(&body.edukasi_kepada, "")),
        q(def_str(&body.kemampuan_bahasa, "Indonesia")),
        q(body.bahasa_daerah.as_deref().unwrap_or("")),
        q(body.bahasa_asing.as_deref().unwrap_or("")),
        q(def_str(&body.perlu_penerjemah, "Tidak")),
        q(def_str(&body.baca_tulis, "Bisa")),
        q(body.kepercayaan_lainnya.as_deref().unwrap_or("Tidak")),
        q(def_str(&body.kesediaan_menerima_edukasi, "Ya")),
        q(def_str(&body.cara_edukasi, "Lisan")),
        q(def_tidak(&body.keb_partisipasi)), q(def_tidak(&body.keb_penunjang)),
        q(def_tidak(&body.keb_kondisi)), q(def_tidak(&body.keb_informed_concent)),
        q(def_tidak(&body.keb_diet)), q(def_tidak(&body.keb_obat)),
        q(def_tidak(&body.keb_alat_medis)), q(def_tidak(&body.keb_nyeri)),
        q(def_tidak(&body.keb_rehabilitasi)), q(def_tidak(&body.keb_cuci_tangan)),
        q(def_tidak(&body.keb_merokok)),
        q(body.keb_lain_lain.as_deref().unwrap_or("")),
        q(def_tidak(&body.keb_rujukan))
    )).await;

    Ok(Json(json!({ "success": true, "no_rawat": body.no_rawat })))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error edukasi_pasien: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"Database error"})))
}

fn db_err_msg(e: sqlx::Error, ctx: &str) -> (StatusCode, Json<Value>) {
    // Detail lengkap hanya ke log server; ke UI pesan terkategori tanpa skema.
    tracing::error!("DB error {}: {}", ctx, e);
    let msg = match &e {
        sqlx::Error::Database(dbe) => {
            let m = dbe.message().to_lowercase();
            if m.contains("too long") { "Ada isian yang melebihi batas panjang. Persingkat lalu simpan ulang." }
            else if m.contains("duplicate") { "Data sudah ada (duplikat)." }
            else if m.contains("foreign key") { "Data terkait tidak valid/ditemukan." }
            else if m.contains("cannot be null") || m.contains("doesn't have a default") { "Ada isian wajib yang belum diisi." }
            else if m.contains("incorrect") && m.contains("value") { "Ada isian dengan format tidak valid." }
            else { "Gagal menyimpan data. Cek kembali isian." }
        }
        _ => "Gagal menyimpan data. Cek kembali isian.",
    };
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": msg})))
}
