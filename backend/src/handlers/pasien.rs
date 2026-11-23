use crate::{
    auth::middleware::AuthUser,
    models::pasien::{Pasien, PasienBaru, PasienListResponse, PasienQuery, PasienRingkas},
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};

pub async fn list_pasien(
    user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<PasienQuery>,
) -> Result<Json<PasienListResponse>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "pasien_view")?;
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(20).min(100);
    let offset = (page - 1) * size;
    let search = q.q.unwrap_or_default();
    let search = search.chars().take(100).collect::<String>(); // max 100 karakter
    let like = format!("%{}%", search);
    let alamat_search = q.alamat.unwrap_or_default();
    let alamat_search = alamat_search.chars().take(100).collect::<String>();
    let alamat_like = format!("%{}%", alamat_search);

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM pasien
         WHERE (nm_pasien LIKE ? OR no_rkm_medis LIKE ? OR no_ktp LIKE ? OR no_peserta LIKE ?)
           AND alamat LIKE ?"
    )
    .bind(&like).bind(&like).bind(&like).bind(&like).bind(&alamat_like)
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    let data: Vec<PasienRingkas> = sqlx::query_as(
        "SELECT no_rkm_medis as no_rm, nm_pasien, tgl_lahir, jk, no_ktp, alamat FROM pasien
         WHERE (nm_pasien LIKE ? OR no_rkm_medis LIKE ? OR no_ktp LIKE ? OR no_peserta LIKE ?)
           AND alamat LIKE ?
         ORDER BY nm_pasien LIMIT ? OFFSET ?"
    )
    .bind(&like).bind(&like).bind(&like).bind(&like).bind(&alamat_like)
    .bind(size).bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(PasienListResponse { data, total: total.0, page, size }))
}

pub async fn get_pasien(
    user: AuthUser,
    State(state): State<AppState>,
    Path(no_rm): Path<String>,
) -> Result<Json<Pasien>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "pasien_view")?;
    let pasien: Option<Pasien> = sqlx::query_as(
        "SELECT p.no_rkm_medis as no_rm, p.nm_pasien, p.tgl_lahir, p.jk, p.alamat,
                p.no_tlp, p.no_ktp, p.agama, p.pnd as pendidikan, p.pekerjaan, p.gol_darah,
                p.tgl_daftar, p.kd_pj, p.namakeluarga as nama_pj, p.keluarga as hub_pj,
                k.nm_kel, kc.nm_kec, kb.nm_kab,
                p.tmp_lahir, p.nm_ibu, p.no_peserta, p.stts_nikah, p.email
         FROM pasien p
         LEFT JOIN kelurahan k  ON p.kd_kel = k.kd_kel
         LEFT JOIN kecamatan kc ON p.kd_kec = kc.kd_kec
         LEFT JOIN kabupaten kb ON p.kd_kab = kb.kd_kab
         WHERE p.no_rkm_medis = ?"
    )
    .bind(&no_rm)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?;

    pasien.map(Json).ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(json!({"error": "Pasien tidak ditemukan"})))
    })
}

pub async fn tambah_pasien(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<PasienBaru>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "pasien_edit")?;
    // Auto-generate no_rm jika tidak disediakan
    let no_rm = match body.no_rm.as_deref().filter(|s| !s.is_empty()) {
        Some(n) => n.to_string(),
        None => {
            let max: (Option<String>,) = sqlx::query_as(
                "SELECT MAX(no_rkm_medis) FROM pasien WHERE no_rkm_medis REGEXP '^[0-9]+$'"
            )
            .fetch_one(&state.pool)
            .await
            .map_err(db_err)?;
            let next = max.0.and_then(|s| s.parse::<u64>().ok()).unwrap_or(0) + 1;
            format!("{:06}", next)
        }
    };

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    sqlx::query(
        "INSERT INTO pasien (no_rkm_medis, nm_pasien, tgl_lahir, tmp_lahir, jk, alamat, no_tlp,
                             no_ktp, no_peserta, agama, pnd, pekerjaan, gol_darah, stts_nikah,
                             nm_ibu, email, kd_pj, namakeluarga, keluarga, tgl_daftar,
                             umur, kd_kel, kd_kec, kd_kab, pekerjaanpj, alamatpj,
                             kelurahanpj, kecamatanpj, kabupatenpj, perusahaan_pasien,
                             suku_bangsa, bahasa_pasien, cacat_fisik, nip, kd_prop, propinsipj)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,0,'','','','','','',0,0,0,'',0,'')"
    )
    .bind(&no_rm)
    .bind(&body.nm_pasien)
    .bind(&body.tgl_lahir)
    .bind(body.tmp_lahir.as_deref().unwrap_or(""))
    .bind(body.jk.as_deref().unwrap_or("L"))
    .bind(body.alamat.as_deref().unwrap_or(""))
    .bind(body.no_tlp.as_deref().unwrap_or(""))
    .bind(body.no_ktp.as_deref().unwrap_or(""))
    .bind(body.no_peserta.as_deref().unwrap_or(""))
    .bind(body.agama.as_deref().unwrap_or(""))
    .bind(body.pendidikan.as_deref().unwrap_or("-"))
    .bind(body.pekerjaan.as_deref().unwrap_or(""))
    .bind(body.gol_darah.as_deref().unwrap_or("-"))
    .bind(body.stts_nikah.as_deref().unwrap_or("BELUM MENIKAH"))
    .bind(body.nm_ibu.as_deref().unwrap_or(""))
    .bind(body.email.as_deref().unwrap_or(""))
    .bind(body.kd_pj.as_deref().unwrap_or("A01"))
    .bind(body.namakeluarga.as_deref().unwrap_or(""))
    .bind(body.keluarga.as_deref())
    .bind(&today)
    .bind("")
    .execute(&state.pool)
    .await
    .map_err(db_err)?;

    let sql = format!(
        "INSERT INTO pasien (no_rkm_medis, nm_pasien, tgl_lahir, tmp_lahir, jk, alamat, no_tlp, \
         no_ktp, no_peserta, agama, pnd, pekerjaan, gol_darah, stts_nikah, nm_ibu, email, kd_pj, \
         namakeluarga, keluarga, tgl_daftar, umur, kd_kel, kd_kec, kd_kab, pekerjaanpj, alamatpj, \
         kelurahanpj, kecamatanpj, kabupatenpj, perusahaan_pasien, suku_bangsa, bahasa_pasien, \
         cacat_fisik, nip, kd_prop, propinsipj) VALUES \
         ({},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},'',0,0,0,'','','','','','',0,0,0,'',0,'')",
        crate::audit::q(&no_rm),
        crate::audit::q(&body.nm_pasien),
        crate::audit::qo(body.tgl_lahir.as_deref()),
        crate::audit::q(body.tmp_lahir.as_deref().unwrap_or("")),
        crate::audit::q(body.jk.as_deref().unwrap_or("L")),
        crate::audit::q(body.alamat.as_deref().unwrap_or("")),
        crate::audit::q(body.no_tlp.as_deref().unwrap_or("")),
        crate::audit::q(body.no_ktp.as_deref().unwrap_or("")),
        crate::audit::q(body.no_peserta.as_deref().unwrap_or("")),
        crate::audit::q(body.agama.as_deref().unwrap_or("")),
        crate::audit::q(body.pendidikan.as_deref().unwrap_or("-")),
        crate::audit::q(body.pekerjaan.as_deref().unwrap_or("")),
        crate::audit::q(body.gol_darah.as_deref().unwrap_or("-")),
        crate::audit::q(body.stts_nikah.as_deref().unwrap_or("BELUM MENIKAH")),
        crate::audit::q(body.nm_ibu.as_deref().unwrap_or("")),
        crate::audit::q(body.email.as_deref().unwrap_or("")),
        crate::audit::q(body.kd_pj.as_deref().unwrap_or("A01")),
        crate::audit::q(body.namakeluarga.as_deref().unwrap_or("")),
        crate::audit::qo(body.keluarga.as_deref()),
        crate::audit::q(&today),
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;
    Ok((StatusCode::CREATED, Json(json!({"message": "Pasien berhasil ditambahkan", "no_rm": no_rm}))))
}

pub async fn edit_pasien(
    user: AuthUser,
    State(state): State<AppState>,
    Path(no_rm): Path<String>,
    Json(body): Json<PasienBaru>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "pasien_edit")?;
    let result = sqlx::query(
        "UPDATE pasien SET nm_pasien=?, tgl_lahir=?, tmp_lahir=?, jk=?, alamat=?, no_tlp=?,
                           no_ktp=?, no_peserta=?, agama=?, pnd=?, pekerjaan=?, gol_darah=?,
                           stts_nikah=?, nm_ibu=?, email=?, kd_pj=?, namakeluarga=?, keluarga=?
         WHERE no_rkm_medis=?"
    )
    .bind(&body.nm_pasien)
    .bind(&body.tgl_lahir)
    .bind(body.tmp_lahir.as_deref().unwrap_or(""))
    .bind(body.jk.as_deref().unwrap_or("L"))
    .bind(body.alamat.as_deref().unwrap_or(""))
    .bind(body.no_tlp.as_deref().unwrap_or(""))
    .bind(body.no_ktp.as_deref().unwrap_or(""))
    .bind(body.no_peserta.as_deref().unwrap_or(""))
    .bind(body.agama.as_deref().unwrap_or(""))
    .bind(body.pendidikan.as_deref().unwrap_or("-"))
    .bind(body.pekerjaan.as_deref().unwrap_or(""))
    .bind(body.gol_darah.as_deref().unwrap_or("-"))
    .bind(body.stts_nikah.as_deref().unwrap_or("BELUM MENIKAH"))
    .bind(body.nm_ibu.as_deref().unwrap_or(""))
    .bind(body.email.as_deref().unwrap_or(""))
    .bind(body.kd_pj.as_deref().unwrap_or("A01"))
    .bind(body.namakeluarga.as_deref().unwrap_or(""))
    .bind(body.keluarga.as_deref())
    .bind(&no_rm)
    .execute(&state.pool)
    .await
    .map_err(db_err)?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Pasien tidak ditemukan"}))));
    }
    let sql = format!(
        "UPDATE pasien SET nm_pasien={}, tgl_lahir={}, tmp_lahir={}, jk={}, alamat={}, no_tlp={}, \
         no_ktp={}, no_peserta={}, agama={}, pnd={}, pekerjaan={}, gol_darah={}, stts_nikah={}, \
         nm_ibu={}, email={}, kd_pj={}, namakeluarga={}, keluarga={} WHERE no_rkm_medis={}",
        crate::audit::q(&body.nm_pasien),
        crate::audit::qo(body.tgl_lahir.as_deref()),
        crate::audit::q(body.tmp_lahir.as_deref().unwrap_or("")),
        crate::audit::q(body.jk.as_deref().unwrap_or("L")),
        crate::audit::q(body.alamat.as_deref().unwrap_or("")),
        crate::audit::q(body.no_tlp.as_deref().unwrap_or("")),
        crate::audit::q(body.no_ktp.as_deref().unwrap_or("")),
        crate::audit::q(body.no_peserta.as_deref().unwrap_or("")),
        crate::audit::q(body.agama.as_deref().unwrap_or("")),
        crate::audit::q(body.pendidikan.as_deref().unwrap_or("-")),
        crate::audit::q(body.pekerjaan.as_deref().unwrap_or("")),
        crate::audit::q(body.gol_darah.as_deref().unwrap_or("-")),
        crate::audit::q(body.stts_nikah.as_deref().unwrap_or("BELUM MENIKAH")),
        crate::audit::q(body.nm_ibu.as_deref().unwrap_or("")),
        crate::audit::q(body.email.as_deref().unwrap_or("")),
        crate::audit::q(body.kd_pj.as_deref().unwrap_or("A01")),
        crate::audit::q(body.namakeluarga.as_deref().unwrap_or("")),
        crate::audit::qo(body.keluarga.as_deref()),
        crate::audit::q(&no_rm),
    );
    crate::audit::log_sql(&state.pool, &user.0.kode, &sql).await;
    Ok(Json(json!({"message": "Data pasien berhasil diperbarui"})))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
}
