use crate::{
    auth::middleware::AuthUser,
    models::registrasi::{Dokter, Penjab, Poli, Registrasi, RegistrasiBaru, RegistrasiListResponse, RegistrasiQuery},
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};

pub async fn list_registrasi(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<RegistrasiQuery>,
) -> Result<Json<RegistrasiListResponse>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "registrasi_view")?;
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(50).min(200);
    let offset = (page - 1) * size;

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    // Jika ada range tgl_awal/tgl_akhir, pakai range; jika tidak, pakai tgl tunggal
    let tgl_awal = q.tgl_awal.clone()
        .or_else(|| q.tgl.clone())
        .unwrap_or_else(|| today.clone());
    let tgl_akhir = q.tgl_akhir.clone()
        .or_else(|| q.tgl.clone())
        .unwrap_or_else(|| today.clone());

    let poli_like   = format!("%{}%", q.poli.unwrap_or_default());
    let dokter_like = format!("%{}%", q.dokter.unwrap_or_default());
    let cari_like   = format!("%{}%", q.cari.unwrap_or_default());

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM reg_periksa r
         LEFT JOIN pasien p   ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN poliklinik po ON r.kd_poli = po.kd_poli
         LEFT JOIN dokter d   ON r.kd_dokter = d.kd_dokter
         LEFT JOIN penjab pj  ON r.kd_pj = pj.kd_pj
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND po.kd_poli <> 'IGDK'
           AND po.nm_poli LIKE ?
           AND d.nm_dokter LIKE ?
           AND (r.no_reg LIKE ? OR r.no_rawat LIKE ? OR p.nm_pasien LIKE ?
                OR po.nm_poli LIKE ? OR d.nm_dokter LIKE ? OR r.stts_daftar LIKE ?
                OR pj.png_jawab LIKE ? OR r.p_jawab LIKE ?)"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .bind(&poli_like).bind(&dokter_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(&cari_like).bind(&cari_like)
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    let data: Vec<Registrasi> = sqlx::query_as(
        "SELECT r.no_rawat, r.tgl_registrasi, r.no_rkm_medis as no_rm, p.nm_pasien,
                r.kd_poli, po.nm_poli, r.kd_dokter, d.nm_dokter,
                r.stts, r.stts_daftar, r.no_reg, r.kd_pj, pj.png_jawab
         FROM reg_periksa r
         LEFT JOIN pasien p   ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN poliklinik po ON r.kd_poli = po.kd_poli
         LEFT JOIN dokter d   ON r.kd_dokter = d.kd_dokter
         LEFT JOIN penjab pj  ON r.kd_pj = pj.kd_pj
         WHERE r.tgl_registrasi BETWEEN ? AND ?
           AND po.kd_poli <> 'IGDK'
           AND po.nm_poli LIKE ?
           AND d.nm_dokter LIKE ?
           AND (r.no_reg LIKE ? OR r.no_rawat LIKE ? OR p.nm_pasien LIKE ?
                OR po.nm_poli LIKE ? OR d.nm_dokter LIKE ? OR r.stts_daftar LIKE ?
                OR pj.png_jawab LIKE ? OR r.p_jawab LIKE ?)
         ORDER BY r.tgl_registrasi, r.no_reg, r.no_rawat
         LIMIT ? OFFSET ?"
    )
    .bind(&tgl_awal).bind(&tgl_akhir)
    .bind(&poli_like).bind(&dokter_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(&cari_like).bind(&cari_like).bind(&cari_like)
    .bind(&cari_like).bind(&cari_like)
    .bind(size).bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(RegistrasiListResponse { data, total: total.0, page, size }))
}

pub async fn get_registrasi(
    user: AuthUser,
    State(state): State<AppState>,
    Path(no_rawat): Path<String>,
) -> Result<Json<Registrasi>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "registrasi_view")?;
    let reg: Option<Registrasi> = sqlx::query_as(
        "SELECT r.no_rawat, r.tgl_registrasi, r.no_rkm_medis as no_rm, p.nm_pasien,
                r.kd_poli, po.nm_poli, r.kd_dokter, d.nm_dokter,
                r.stts, r.stts_daftar, r.no_reg, r.kd_pj, pj.png_jawab
         FROM reg_periksa r
         LEFT JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
         LEFT JOIN poliklinik po ON r.kd_poli = po.kd_poli
         LEFT JOIN dokter d ON r.kd_dokter = d.kd_dokter
         LEFT JOIN penjab pj ON r.kd_pj = pj.kd_pj
         WHERE r.no_rawat = ?"
    )
    .bind(&no_rawat)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;

    reg.map(Json).ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(json!({"error": "Registrasi tidak ditemukan"})))
    })
}

pub async fn buat_registrasi(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<RegistrasiBaru>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "registrasi_edit")?;
    // Generate no_rawat: YYYY/MM/DD/XXXXX
    let no_rawat = match body.no_rawat {
        Some(ref n) if !n.is_empty() => n.clone(),
        _ => {
            let count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM reg_periksa WHERE tgl_registrasi = ?"
            )
            .bind(&body.tgl_registrasi)
            .fetch_one(&state.pool)
            .await
            .map_err(db_err)?;
            let seq = count.0 + 1;
            let tgl = body.tgl_registrasi.replace('-', "/");
            format!("{}/{:05}", tgl, seq)
        }
    };

    // Generate no_reg (daily sequence, 5 chars)
    let daily_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM reg_periksa WHERE tgl_registrasi = ?"
    )
    .bind(&body.tgl_registrasi)
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;
    let no_reg = format!("{:05}", daily_count.0 + 1);

    // Hitung umur pasien
    let umur_result: Option<(Option<i32>, Option<String>)> = sqlx::query_as(
        "SELECT TIMESTAMPDIFF(YEAR, tgl_lahir, CURDATE()), 'Th' FROM pasien WHERE no_rkm_medis = ?"
    )
    .bind(&body.no_rm)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    let (umurdaftar, sttsumur) = umur_result
        .and_then(|(u, s)| Some((u.unwrap_or(0), s.unwrap_or_else(|| "Th".to_string()))))
        .unwrap_or((0, "Th".to_string()));

    let jam = body.jam_reg.as_deref().unwrap_or("00:00:00");
    let status_poli = if body.stts_daftar == "Baru" { "Baru" } else { "Lama" };

    sqlx::query(
        "INSERT INTO reg_periksa
         (no_rawat, no_reg, tgl_registrasi, jam_reg, kd_dokter, no_rkm_medis, kd_poli,
          p_jawab, almt_pj, hubunganpj, stts, stts_daftar, status_lanjut, kd_pj,
          umurdaftar, sttsumur, status_bayar, status_poli, biaya_reg)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Belum', ?, 'Ralan', ?, ?, ?, 'Belum Bayar', ?, 0)"
    )
    .bind(&no_rawat)
    .bind(&no_reg)
    .bind(&body.tgl_registrasi)
    .bind(jam)
    .bind(&body.kd_dokter)
    .bind(&body.no_rm)
    .bind(&body.kd_poli)
    .bind(body.p_jawab.as_deref().unwrap_or(""))
    .bind(body.almt_pj.as_deref().unwrap_or(""))
    .bind(body.hubunganpj.as_deref().unwrap_or(""))
    .bind(&body.stts_daftar)
    .bind(&body.kd_pj)
    .bind(umurdaftar)
    .bind(&sttsumur)
    .bind(status_poli)
    .execute(&state.pool)
    .await
    .map_err(db_err)?;

    let sql = format!(
        "INSERT INTO reg_periksa (no_rawat, no_reg, tgl_registrasi, jam_reg, kd_dokter, \
         no_rkm_medis, kd_poli, p_jawab, almt_pj, hubunganpj, stts, stts_daftar, status_lanjut, \
         kd_pj, umurdaftar, sttsumur, status_bayar, status_poli, biaya_reg) VALUES \
         ({},{},{},{},{},{},{},{},{},{},'Belum',{},'Ralan',{},{},{},'Belum Bayar',{},0)",
        crate::audit::q(&no_rawat),
        crate::audit::q(&no_reg),
        crate::audit::q(&body.tgl_registrasi),
        crate::audit::q(jam),
        crate::audit::q(&body.kd_dokter),
        crate::audit::q(&body.no_rm),
        crate::audit::q(&body.kd_poli),
        crate::audit::q(body.p_jawab.as_deref().unwrap_or("")),
        crate::audit::q(body.almt_pj.as_deref().unwrap_or("")),
        crate::audit::q(body.hubunganpj.as_deref().unwrap_or("")),
        crate::audit::q(&body.stts_daftar),
        crate::audit::q(&body.kd_pj),
        umurdaftar,
        crate::audit::q(&sttsumur),
        crate::audit::q(status_poli),
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;

    Ok((StatusCode::CREATED, Json(json!({
        "message": "Registrasi berhasil",
        "no_rawat": no_rawat,
        "no_reg": no_reg
    }))))
}

pub async fn list_poli(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<Poli>>, (StatusCode, Json<Value>)> {
    let data: Vec<Poli> = sqlx::query_as(
        "SELECT kd_poli, nm_poli FROM poliklinik WHERE status = '1' ORDER BY nm_poli"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;
    Ok(Json(data))
}

pub async fn list_dokter(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<Dokter>>, (StatusCode, Json<Value>)> {
    let poli = q.get("poli").cloned().unwrap_or_default();

    let data: Vec<Dokter> = if poli.is_empty() {
        sqlx::query_as(
            "SELECT kd_dokter, nm_dokter, NULL as kd_poli FROM dokter WHERE status = '1' ORDER BY nm_dokter"
        )
        .fetch_all(&state.pool)
        .await
        .map_err(db_err)?
    } else {
        sqlx::query_as(
            "SELECT DISTINCT d.kd_dokter, d.nm_dokter, j.kd_poli
             FROM dokter d
             JOIN jadwal j ON d.kd_dokter = j.kd_dokter
             WHERE j.kd_poli = ? AND d.status = '1'
             ORDER BY d.nm_dokter"
        )
        .bind(&poli)
        .fetch_all(&state.pool)
        .await
        .map_err(db_err)?
    };
    Ok(Json(data))
}

pub async fn list_penjab(
    _user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<Penjab>>, (StatusCode, Json<Value>)> {
    let data: Vec<Penjab> = sqlx::query_as(
        "SELECT kd_pj, png_jawab FROM penjab ORDER BY png_jawab"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;
    Ok(Json(data))
}

pub async fn get_setting(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    use sqlx::Row;
    let row = sqlx::query(
        "SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email FROM setting LIMIT 1"
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;

    // Website tidak ada di tabel setting Khanza — disimpan di simrscb_config
    let website = sqlx::query_scalar::<_, String>(
        "SELECT nilai FROM simrscb_config WHERE kunci = 'website_instansi'"
    ).fetch_optional(&state.pool).await.ok().flatten().unwrap_or_default();

    match row {
        Some(r) => {
            let get = |col: &str| -> String {
                r.try_get::<Option<String>, _>(col).ok().flatten().unwrap_or_default()
            };
            Ok(Json(json!({
                "nama_instansi": get("nama_instansi"),
                "alamat_instansi": get("alamat_instansi"),
                "kabupaten": get("kabupaten"),
                "propinsi": get("propinsi"),
                "kontak": get("kontak"),
                "email": get("email"),
                "website": website,
            })))
        },
        None => Ok(Json(json!({
            "nama_instansi": "Rumah Sakit",
            "alamat_instansi": "",
            "kabupaten": "",
            "propinsi": "",
            "kontak": "",
            "email": "",
            "website": website,
        }))),
    }
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
