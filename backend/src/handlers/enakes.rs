// e-Nakes — aplikasi web tenaga kesehatan / perawat (mobile). Identitas petugas
// (pegawai, login NIP) + daftar SEMUA pasien. Detail per pasien (SOAPIE, Alergi,
// Resep, Lab, Radiologi) memakai kembali endpoint edokter/efarmasi (semua by
// no_rawat), sehingga di sini cukup /enakes/me + /enakes/pasien.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

// Daftar pasien identik dengan e-Farmasi (semua pasien, lintas dokter).
pub use crate::handlers::efarmasi::list_pasien;

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB enakes: {}", e);
    // Tampilkan pesan DB asli (mis. "Data too long for column 'umur'") supaya
    // petugas/IT langsung tahu penyebabnya, bukan pesan generik yang menutupi.
    let detail = match &e {
        sqlx::Error::Database(db) => db.message().to_string(),
        other => other.to_string(),
    };
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Gagal akses data e-Nakes: {}", detail)})))
}

// Cek hak akses SAMA seperti aplikasi desktop Khanza: kolom enum('true','false')
// di tabel `user` (dibaca desktop via akses.getBoolean). Admin Utama → semua boleh.
// `col` selalu berasal dari peta internal tetap (bukan input user) → aman diinterpolasi.
pub(crate) async fn require_perm(state: &AppState, user: &AuthUser, col: &str)
  -> Result<(), (StatusCode, Json<Value>)> {
    if user.0.is_admin || col.is_empty() { return Ok(()); }
    // Dekode sebagai Option supaya nilai kolom NULL (perm belum diset utk user ini)
    // tidak crash "unexpected null"; NULL diperlakukan sebagai tidak diberi akses.
    let val: Option<String> = sqlx::query_scalar::<_, Option<String>>(
        &format!("SELECT CAST(`{}` AS CHAR) FROM user WHERE id_user = AES_ENCRYPT(?, 'nur') LIMIT 1", col)
    ).bind(&user.0.kode).fetch_optional(&state.pool).await.map_err(db_err)?.flatten();
    let granted = matches!(val.as_deref(), Some(v) if v.eq_ignore_ascii_case("true") || v == "1" || v == "-1");
    if granted { Ok(()) }
    else { Err((StatusCode::FORBIDDEN, Json(json!({"error": format!("Tidak memiliki hak akses ({})", col)})))) }
}

// Versi boolean dari require_perm (tidak melempar error): true bila user Admin
// Utama atau kolom akses `col` di tabel `user` bernilai true. Dipakai untuk
// menentukan apakah user boleh mengedit form milik-bersama (mis. transfer).
pub(crate) async fn perm_granted(state: &AppState, user: &AuthUser, col: &str) -> bool {
    if user.0.is_admin || col.is_empty() { return true; }
    let val: Option<String> = match sqlx::query_scalar::<_, Option<String>>(
        &format!("SELECT CAST(`{}` AS CHAR) FROM user WHERE id_user = AES_ENCRYPT(?, 'nur') LIMIT 1", col)
    ).bind(&user.0.kode).fetch_optional(&state.pool).await {
        Ok(v) => v.flatten(),
        Err(_) => return false,
    };
    matches!(val.as_deref(), Some(v) if v.eq_ignore_ascii_case("true") || v == "1" || v == "-1")
}

// Normalisasi tanggal dari frontend (datetime-local "YYYY-MM-DDTHH:mm") → string
// MySQL "YYYY-MM-DD HH:mm:ss". Bila kosong, pakai NOW() server.
pub(crate) async fn tgl_or_now(state: &AppState, input: &str) -> Result<String, (StatusCode, Json<Value>)> {
    let s = input.trim();
    if s.is_empty() {
        let t: (String,) = sqlx::query_as("SELECT CAST(NOW() AS CHAR)").fetch_one(&state.pool).await.map_err(db_err)?;
        Ok(t.0)
    } else {
        let mut v = s.replace('T', " ");
        if v.len() == 16 { v.push_str(":00"); }
        Ok(v)
    }
}

// ── GET /enakes/me — identitas petugas login ─────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct NakesMe {
    pub nik: String,
    pub nama: String,
    pub jabatan: String,
    pub departemen: String,
}
pub async fn me(user: AuthUser, State(state): State<AppState>)
  -> Result<Json<NakesMe>, (StatusCode, Json<Value>)> {
    let row: Option<NakesMe> = sqlx::query_as(
        "SELECT pg.nik, pg.nama, IFNULL(jb.nm_jbtn,'') AS jabatan, IFNULL(dp.nama,'') AS departemen \
         FROM pegawai pg \
         LEFT JOIN jabatan jb ON pg.jbtn = jb.kd_jbtn \
         LEFT JOIN departemen dp ON pg.departemen = dp.dep_id \
         WHERE pg.nik = ?"
    ).bind(&user.0.kode).fetch_optional(&state.pool).await.map_err(db_err)?;
    Ok(Json(row.unwrap_or(NakesMe {
        nik: user.0.kode.clone(), nama: "Tenaga Kesehatan".to_string(),
        jabatan: String::new(), departemen: "Keperawatan".to_string(),
    })))
}

// ── GET /enakes/cek-akses?col=<kolom> — cek hak akses (utk enable/disable tombol) ─
#[derive(Deserialize)]
pub struct CekAksesQuery { pub col: String }
pub async fn cek_akses(user: AuthUser, State(state): State<AppState>, Query(q): Query<CekAksesQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // hanya identifier aman (huruf kecil/angka/underscore) — cegah SQL injection ke require_perm
    if q.col.is_empty() || !q.col.bytes().all(|b| b.is_ascii_lowercase() || b == b'_' || b.is_ascii_digit()) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"kolom tidak valid"}))));
    }
    let granted = require_perm(&state, &user, &q.col).await.is_ok();
    Ok(Json(json!({"granted": granted})))
}

// ── Catatan Keperawatan (adopsi DlgCatatanKeperawatan / RMDataCatatanKeperawatan) ──
// Ralan & IGD → catatan_keperawatan_ralan (tanggal, jam, no_rawat, uraian, nip)
// Ranap        → catatan_keperawatan_ranap (+ td, nadi, rr, suhu)
#[derive(Deserialize)]
pub struct CatatanQuery {
    pub no_rawat: String,
    #[serde(default)] pub jenis: Option<String>,
}
#[derive(Serialize, sqlx::FromRow)]
pub struct CatatanRow {
    pub tanggal: Option<String>,
    pub jam: Option<String>,
    pub uraian: String,
    pub td: String,
    pub nadi: String,
    pub rr: String,
    pub suhu: String,
    pub spo2: String,
    pub petugas: String,
    #[sqlx(default)] pub milik: i64,
}
pub async fn catatan_list(user: AuthUser, State(state): State<AppState>, Query(q): Query<CatatanQuery>)
  -> Result<Json<Vec<CatatanRow>>, (StatusCode, Json<Value>)> {
    let ranap = q.jenis.as_deref() == Some("ranap");
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let tabel = if ranap { "catatan_keperawatan_ranap" } else { "catatan_keperawatan_ralan" };
    let sql = format!(
        "SELECT CAST(c.tanggal AS CHAR) tanggal, CAST(c.jam AS CHAR) jam, IFNULL(c.uraian,'') uraian, \
                IFNULL(c.td,'') td, IFNULL(c.nadi,'') nadi, IFNULL(c.rr,'') rr, IFNULL(c.suhu,'') suhu, IFNULL(c.spo2,'') spo2, \
                IFNULL(pg.nama, c.nip) petugas, (c.nip = ? OR ? = 1) milik \
         FROM {tabel} c LEFT JOIN pegawai pg ON pg.nik = c.nip \
         WHERE c.no_rawat = ? ORDER BY c.tanggal DESC, c.jam DESC LIMIT 200");
    let rows = sqlx::query_as::<_, CatatanRow>(&sql)
        .bind(&user.0.kode).bind(admin).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct CatatanBody {
    pub no_rawat: String,
    #[serde(default)] pub jenis: String,
    #[serde(default)] pub uraian: String,
    #[serde(default)] pub td: String,
    #[serde(default)] pub nadi: String,
    #[serde(default)] pub rr: String,
    #[serde(default)] pub suhu: String,
    #[serde(default)] pub spo2: String,
    // Edit in-place: bila edit=true, ubah entri lama (identitas orig_tanggal+orig_jam).
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub orig_tanggal: String,
    #[serde(default)] pub orig_jam: String,
    // Tanggal & jam dibuat (datetime-local); kosong → waktu server sekarang.
    #[serde(default)] pub waktu: String,
}
pub async fn catatan_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<CatatanBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, if b.jenis == "ranap" { "catatan_keperawatan_ranap" } else { "catatan_keperawatan_ralan" }).await?;
    if b.uraian.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Uraian wajib diisi"}))));
    }
    let tabel = if b.jenis == "ranap" { "catatan_keperawatan_ranap" } else { "catatan_keperawatan_ralan" };
    let wkt = split_dt(&b.waktu); // Some((tanggal, jam)) bila diisi
    if b.edit {
        // UPDATE entri lama — owner-only (nip=user atau admin). Tanggal/jam ikut diubah bila diisi.
        let admin: i64 = if user.0.is_admin { 1 } else { 0 };
        let (new_tgl, new_jam) = wkt.clone().unwrap_or((b.orig_tanggal.clone(), b.orig_jam.clone()));
        let res = sqlx::query(&format!(
            "UPDATE {tabel} SET tanggal=?, jam=?, td=?, nadi=?, rr=?, suhu=?, spo2=?, uraian=? \
             WHERE no_rawat=? AND tanggal=? AND jam=? AND (nip=? OR ?=1)"))
        .bind(&new_tgl).bind(&new_jam).bind(&b.td).bind(&b.nadi).bind(&b.rr).bind(&b.suhu).bind(&b.spo2).bind(&b.uraian)
        .bind(&b.no_rawat).bind(&b.orig_tanggal).bind(&b.orig_jam).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat mengubah"}))));
        }
        crate::audit::log_sql(&state.pool, &user.0.kode, &format!("UBAH catatan_keperawatan ({}) no_rawat={} {} {}", b.jenis, b.no_rawat, b.orig_tanggal, b.orig_jam)).await;
    } else {
        let tgl_expr = if wkt.is_some() { "?" } else { "CURDATE()" };
        let jam_expr = if wkt.is_some() { "?" } else { "CURTIME()" };
        let sql = format!(
            "INSERT INTO {tabel} (tanggal, jam, no_rawat, td, nadi, rr, suhu, spo2, uraian, nip) \
             VALUES ({tgl_expr}, {jam_expr}, ?, ?, ?, ?, ?, ?, ?, ?)");
        let mut q = sqlx::query(&sql);
        if let Some((d, t)) = &wkt { q = q.bind(d).bind(t); }
        q = q.bind(&b.no_rawat).bind(&b.td).bind(&b.nadi).bind(&b.rr).bind(&b.suhu).bind(&b.spo2).bind(&b.uraian).bind(&user.0.kode);
        q.execute(&state.pool).await.map_err(db_err)?;
        crate::audit::log_sql(&state.pool, &user.0.kode, &format!("catatan_keperawatan ({}) no_rawat={}", b.jenis, b.no_rawat)).await;
    }
    Ok(Json(json!({"ok": true})))
}

// ── Resume Keperawatan (resume_keperawatan, PK no_rawat) ─────────────────────
// Adopsi RMDataResumeKeperawatan (Khanza). Satu resume per no_rawat (upsert).
// kd_dokter (dokter penanggung jawab) diambil otomatis dari reg_periksa.
#[derive(Serialize, sqlx::FromRow)]
pub struct ResumeKepRow {
    pub no_rawat: String,
    pub kd_dokter: String,
    pub nm_dokter: String,
    pub diagnosa_awal: String,
    pub alasan: String,
    pub masalah_perawatan: String,
    pub tindakan: String,
    pub alih_rawat: String,
    pub evaluasi: String,
    pub nasihat: String,
    pub petugas: String,
}
pub async fn resume_kep_get(_user: AuthUser, State(state): State<AppState>, Query(q): Query<CatatanQuery>)
  -> Result<Json<Option<ResumeKepRow>>, (StatusCode, Json<Value>)> {
    let row = sqlx::query_as::<_, ResumeKepRow>(
        "SELECT c.no_rawat, c.kd_dokter, IFNULL(d.nm_dokter,'') nm_dokter, \
                IFNULL(c.diagnosa_awal,'') diagnosa_awal, IFNULL(c.alasan,'') alasan, \
                IFNULL(c.masalah_perawatan,'') masalah_perawatan, IFNULL(c.tindakan,'') tindakan, \
                IFNULL(c.alih_rawat,'') alih_rawat, IFNULL(c.evaluasi,'') evaluasi, IFNULL(c.nasihat,'') nasihat, \
                IFNULL(pg.nama, c.kd_petugas) petugas \
         FROM resume_keperawatan c \
         LEFT JOIN dokter d ON d.kd_dokter = c.kd_dokter \
         LEFT JOIN pegawai pg ON pg.nik = c.kd_petugas \
         WHERE c.no_rawat = ?")
        .bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    Ok(Json(row))
}

#[derive(Deserialize)]
pub struct ResumeKepBody {
    pub no_rawat: String,
    #[serde(default)] pub diagnosa_awal: String,
    #[serde(default)] pub alasan: String,
    #[serde(default)] pub masalah_perawatan: String,
    #[serde(default)] pub tindakan: String,
    #[serde(default)] pub alih_rawat: String,
    #[serde(default)] pub evaluasi: String,
    #[serde(default)] pub nasihat: String,
}
pub async fn resume_kep_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<ResumeKepBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "tindakan_ranap").await?;
    if b.diagnosa_awal.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Diagnosa awal wajib diisi"}))));
    }
    // Guard kepemilikan: tolak bila resume sudah dibuat petugas lain (kecuali admin).
    if !user.0.is_admin {
        let owner: Option<String> = sqlx::query_scalar("SELECT IFNULL(kd_petugas,'') FROM resume_keperawatan WHERE no_rawat = ? LIMIT 1")
            .bind(&b.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
        if let Some(o) = owner {
            if !o.is_empty() && o != user.0.kode {
                return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Resume ini dibuat petugas lain — tidak dapat diubah"}))));
            }
        }
    }
    // kd_dokter (dokter penanggung jawab) diambil dari reg_periksa.
    let kd_dokter: String = sqlx::query_scalar("SELECT kd_dokter FROM reg_periksa WHERE no_rawat = ?")
        .bind(&b.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?
        .unwrap_or_default();
    sqlx::query(
        "INSERT INTO resume_keperawatan \
         (no_rawat, kd_dokter, diagnosa_awal, alasan, masalah_perawatan, tindakan, alih_rawat, evaluasi, nasihat, kd_petugas) \
         VALUES (?,?,?,?,?,?,?,?,?,?) \
         ON DUPLICATE KEY UPDATE kd_dokter=VALUES(kd_dokter), diagnosa_awal=VALUES(diagnosa_awal), \
           alasan=VALUES(alasan), masalah_perawatan=VALUES(masalah_perawatan), tindakan=VALUES(tindakan), \
           alih_rawat=VALUES(alih_rawat), evaluasi=VALUES(evaluasi), nasihat=VALUES(nasihat), kd_petugas=VALUES(kd_petugas)")
        .bind(&b.no_rawat).bind(&kd_dokter).bind(&b.diagnosa_awal).bind(&b.alasan).bind(&b.masalah_perawatan)
        .bind(&b.tindakan).bind(&b.alih_rawat).bind(&b.evaluasi).bind(&b.nasihat).bind(&user.0.kode)
        .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("resume_keperawatan no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Checklist Kriteria Masuk/Keluar ICU/NICU/PICU (generic) ──────────────────
// Adopsi RMChecklistKriteria{Masuk,Keluar}{ICU,NICU,PICU}. form_id memilih tabel +
// daftar kolom. Kriteria enum('Ya','Tidak'); NICU/PICU + keputusan(enum) &
// keterangan(varchar50). Satu checklist aktif per no_rawat (simpan ulang mengganti).
const MASUK_ICU_COLS: &[&str] = &["prioritas1_1","prioritas1_2","prioritas1_3","prioritas1_4","prioritas1_5","prioritas1_6","prioritas2_1","prioritas2_2","prioritas2_3","prioritas2_4","prioritas2_5","prioritas2_6","prioritas2_7","prioritas2_8","prioritas3_1","prioritas3_2","prioritas3_3","prioritas3_4","kriteria_fisiologis_tanda_vital_1","kriteria_fisiologis_tanda_vital_2","kriteria_fisiologis_tanda_vital_3","kriteria_fisiologis_tanda_vital_4","kriteria_fisiologis_tanda_vital_5","kriteria_fisiologis_laborat_1","kriteria_fisiologis_laborat_2","kriteria_fisiologis_laborat_3","kriteria_fisiologis_laborat_4","kriteria_fisiologis_laborat_5","kriteria_fisiologis_laborat_6","kriteria_fisiologis_radiologi_1","kriteria_fisiologis_radiologi_2","kriteria_fisiologis_klinis_1","kriteria_fisiologis_klinis_2","kriteria_fisiologis_klinis_3","kriteria_fisiologis_klinis_4","kriteria_fisiologis_klinis_5","kriteria_fisiologis_klinis_6","kriteria_fisiologis_klinis_7","kriteria_fisiologis_klinis_8"];
const KELUAR_ICU_COLS: &[&str] = &["kriteria1","kriteria2","kriteria3","kriteria4","kriteria5","kriteria6","kriteria7","kriteria8","kriteria9","kriteria10","kriteria11"];
const MASUK_NICU_COLS: &[&str] = &["respirasi1","respirasi2","respirasi3","respirasi4","prematur1","prematur2","prematur3","kardio1","kardio2","kardio3","neuro1","neuro2","neuro3","metabolik1","metabolik2","metabolik3","kondisilain1","kondisilain2","kondisilain3","kondisilain4","keputusan","keterangan"];
const KELUAR_NICU_COLS: &[&str] = &["respirasi1","respirasi2","respirasi3","kardio1","kardio2","nutrisi1","nutrisi2","nutrisi3","suhutubuh1","suhutubuh2","infeksi1","infeksi2","infeksi3","keputusan","keterangan"];
const MASUK_PICU_COLS: &[&str] = &["kriteriaumum1","kriteriaumum2","kriteriaumum3","respirasi1","respirasi2","respirasi3","respirasi4","kardio1","kardio2","kardio3","kardio4","neuro1","neuro2","neuro3","neuro4","bedah1","bedah2","bedah3","kondisilain1","kondisilain2","kondisilain3","keputusan","keterangan"];
const KELUAR_PICU_COLS: &[&str] = &["kondisiklinis1","kondisiklinis2","kondisiklinis3","kondisiklinis4","kondisiklinis5","kondisiklinis6","kebutuhanperawatan1","kebutuhanperawatan2","kebutuhanperawatan3","kebutuhanperawatan4","tindaklanjut1","tindaklanjut2","tindaklanjut3","tindaklanjut4","keputusan","keterangan"];

fn kriteria_form(form: &str) -> Option<(&'static str, &'static [&'static str])> {
    Some(match form {
        "masuk_icu"   => ("checklist_kriteria_masuk_icu", MASUK_ICU_COLS),
        "keluar_icu"  => ("checklist_kriteria_keluar_icu", KELUAR_ICU_COLS),
        "masuk_nicu"  => ("checklist_kriteria_masuk_nicu", MASUK_NICU_COLS),
        "keluar_nicu" => ("checklist_kriteria_keluar_nicu", KELUAR_NICU_COLS),
        "masuk_picu"  => ("checklist_kriteria_masuk_picu", MASUK_PICU_COLS),
        "keluar_picu" => ("checklist_kriteria_keluar_picu", KELUAR_PICU_COLS),
        _ => return None,
    })
}

#[derive(Deserialize)]
pub struct KriteriaQuery { pub form: String, pub no_rawat: String }

pub async fn kriteria_get(_user: AuthUser, State(state): State<AppState>, Query(q): Query<KriteriaQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let (table, cols) = kriteria_form(&q.form)
        .ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"form tidak dikenal"}))))?;
    let sel = cols.iter().map(|c| format!("IFNULL(t.`{c}`,'') AS `{c}`")).collect::<Vec<_>>().join(", ");
    let sql = format!(
        "SELECT CAST(t.tanggal AS CHAR) tanggal, {sel}, IFNULL(pg.nama, t.nik) petugas \
         FROM `{table}` t LEFT JOIN pegawai pg ON pg.nik = t.nik \
         WHERE t.no_rawat = ? ORDER BY t.tanggal DESC LIMIT 1");
    let row = sqlx::query(&sql).bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    let Some(row) = row else { return Ok(Json(Value::Null)); };
    use sqlx::Row;
    let mut values = serde_json::Map::new();
    for c in cols {
        let v: String = row.try_get(*c).unwrap_or_default();
        values.insert((*c).to_string(), Value::String(v));
    }
    let tanggal: String = row.try_get("tanggal").unwrap_or_default();
    let petugas: String = row.try_get("petugas").unwrap_or_default();
    Ok(Json(json!({"tanggal": tanggal, "petugas": petugas, "values": values})))
}

#[derive(Deserialize)]
pub struct KriteriaBody {
    pub form: String,
    pub no_rawat: String,
    #[serde(default)] pub values: std::collections::HashMap<String, String>,
}
pub async fn kriteria_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<KriteriaBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "tindakan_ranap").await?;
    let (table, cols) = kriteria_form(&b.form)
        .ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"form tidak dikenal"}))))?;
    // Guard kepemilikan: tolak bila checklist sudah dibuat petugas lain (kecuali admin).
    if !user.0.is_admin {
        let owner: Option<String> = sqlx::query_scalar(&format!("SELECT IFNULL(nik,'') FROM `{table}` WHERE no_rawat = ? ORDER BY tanggal DESC LIMIT 1"))
            .bind(&b.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
        if let Some(o) = owner {
            if !o.is_empty() && o != user.0.kode {
                return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Checklist ini dibuat petugas lain — tidak dapat diubah"}))));
            }
        }
    }
    let mut tx = state.pool.begin().await.map_err(db_err)?;
    sqlx::query(&format!("DELETE FROM `{table}` WHERE no_rawat = ?"))
        .bind(&b.no_rawat).execute(&mut *tx).await.map_err(db_err)?;
    let collist = cols.iter().map(|c| format!("`{c}`")).collect::<Vec<_>>().join(", ");
    let mut qb = sqlx::QueryBuilder::new(format!("INSERT INTO `{table}` (no_rawat, tanggal, {collist}, nik) VALUES ("));
    qb.push_bind(b.no_rawat.clone()).push(", NOW()");
    for c in cols {
        let raw = b.values.get(*c).map(|s| s.as_str()).unwrap_or("");
        let val: String = match *c {
            "keterangan" => raw.chars().take(50).collect(),
            "keputusan"  => raw.to_string(),
            _ => if raw == "Ya" { "Ya".to_string() } else { "Tidak".to_string() },
        };
        qb.push(", ").push_bind(val);
    }
    qb.push(", ").push_bind(user.0.kode.clone()).push(")");
    qb.build().execute(&mut *tx).await.map_err(db_err)?;
    tx.commit().await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("checklist_kriteria {} no_rawat={}", b.form, b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Grafik TTV — deret waktu tanda vital dari input SOAPIE ────────────────────
// Sumber: pemeriksaan_ralan / pemeriksaan_ranap (kolom suhu_tubuh, tensi, nadi,
// respirasi, spo2). Diurut menaik agar bisa diplot.
#[derive(Serialize, sqlx::FromRow)]
pub struct TtvPoint {
    pub waktu: String,
    pub suhu: String,
    pub tensi: String,
    pub nadi: String,
    pub respirasi: String,
    pub spo2: String,
}
pub async fn ttv_list(_user: AuthUser, State(state): State<AppState>, Query(q): Query<CatatanQuery>)
  -> Result<Json<Vec<TtvPoint>>, (StatusCode, Json<Value>)> {
    let tabel = if q.jenis.as_deref() == Some("ranap") { "pemeriksaan_ranap" } else { "pemeriksaan_ralan" };
    let sql = format!(
        "SELECT CONCAT(CAST(x.tgl_perawatan AS CHAR),' ',LEFT(CAST(x.jam_rawat AS CHAR),5)) AS waktu, \
                IFNULL(x.suhu_tubuh,'') AS suhu, IFNULL(x.tensi,'') AS tensi, IFNULL(x.nadi,'') AS nadi, \
                IFNULL(x.respirasi,'') AS respirasi, IFNULL(x.spo2,'') AS spo2 \
         FROM {tabel} x WHERE x.no_rawat = ? \
           AND (IFNULL(x.suhu_tubuh,'')<>'' OR IFNULL(x.tensi,'')<>'' OR IFNULL(x.nadi,'')<>'' \
                OR IFNULL(x.respirasi,'')<>'' OR IFNULL(x.spo2,'')<>'') \
         ORDER BY x.tgl_perawatan ASC, x.jam_rawat ASC LIMIT 200"
    );
    let rows = sqlx::query_as::<_, TtvPoint>(&sql)
        .bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// ── Risiko Jatuh — asesmen (adopsi form RM Khanza) ───────────────────────────
// Instrumen: getupgo (RJ/IGD), morse (dewasa), humpty (anak), lansia,
// geriatri, neonatus. Skor dihitung di klien (seperti form Swing), backend
// menyimpan ke tabel Khanza asli sesuai instrumen.

#[derive(Deserialize)]
pub struct JatuhBody {
    pub no_rawat: String,
    #[serde(default)] pub instrumen: String,
    // instrumen berskor (morse/humpty/lansia/geriatri): urutan skala & nilai per komponen
    #[serde(default)] pub skala: Vec<String>,
    #[serde(default)] pub nilai: Vec<i32>,
    #[serde(default)] pub total: i32,
    #[serde(default)] pub hasil: String,
    #[serde(default)] pub saran: String,
    // get up & go
    #[serde(default)] pub ruangan: String,
    #[serde(default)] pub cara_berjalan: String,
    #[serde(default)] pub menopang: String,
    #[serde(default)] pub hasil_penilaian: String,
    #[serde(default)] pub tindakan_ya: String,
    #[serde(default)] pub nama_keluarga: String,
    // neonatus (checklist Ya/Tidak)
    #[serde(default)] pub intervensi: Vec<String>,
    #[serde(default)] pub edukasi: Vec<String>,
    #[serde(default)] pub sasaran: Vec<String>,
    #[serde(default)] pub evaluasi: Vec<String>,
    #[serde(default)] pub waktu: String,
}

// Insert instrumen berskor (pola kolom {prefix}_skala{i}/{prefix}_nilai{i} + {prefix}_totalnilai).
async fn simpan_skor(
    state: &AppState, b: &JatuhBody, nip: &str, table: &str, prefix: &str, n: usize,
) -> Result<(), (StatusCode, Json<Value>)> {
    let wkt = dtopt(&b.waktu);
    let mut cols = String::from("no_rawat, tanggal");
    let mut vals = format!("?, {}", if wkt.is_some() { "?" } else { "NOW()" });
    for i in 1..=n {
        cols.push_str(&format!(", {prefix}_skala{i}, {prefix}_nilai{i}"));
        vals.push_str(", ?, ?");
    }
    cols.push_str(&format!(", {prefix}_totalnilai, hasil_skrining, saran, nip"));
    vals.push_str(", ?, ?, ?, ?");
    let sql = format!("INSERT INTO {table} ({cols}) VALUES ({vals})");
    let mut q = sqlx::query(&sql).bind(&b.no_rawat);
    if let Some(t) = &wkt { q = q.bind(t); }
    for i in 0..n {
        let s = b.skala.get(i).cloned().unwrap_or_default();
        let v = b.nilai.get(i).copied().unwrap_or(0);
        q = q.bind(s).bind(v);
    }
    q = q.bind(b.total).bind(&b.hasil).bind(&b.saran).bind(nip);
    q.execute(&state.pool).await.map_err(db_err)?;
    Ok(())
}

pub async fn jatuh_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<JatuhBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Hak akses sama seperti desktop (getupgo tak punya kolom akses → terbuka).
    let perm = match b.instrumen.as_str() {
        "morse" => "penilaian_lanjutan_resiko_jatuh_dewasa",
        "humpty" => "penilaian_lanjutan_resiko_jatuh_anak",
        "lansia" => "penilaian_lanjutan_resiko_jatuh_lansia",
        "geriatri" => "penilaian_lanjutan_resiko_jatuh_geriatri",
        "neonatus" => "penilaian_risiko_jatuh_neonatus",
        _ => "",
    };
    require_perm(&state, &user, perm).await?;
    let nip = user.0.kode.clone();
    match b.instrumen.as_str() {
        "getupgo" => {
            let wkt = dtopt(&b.waktu);
            let tgl_expr = if wkt.is_some() { "?" } else { "NOW()" };
            let sql = format!(
                "INSERT INTO asesmen_risiko_jatuh_getupgo \
                 (no_rawat, tanggal, ruangan, cara_berjalan, menopang, hasil_penilaian, tindakan_ya, nama_keluarga, nip) \
                 VALUES (?, {tgl_expr}, ?, ?, ?, ?, ?, ?, ?)");
            let mut q = sqlx::query(&sql).bind(&b.no_rawat);
            if let Some(t) = &wkt { q = q.bind(t); }
            q = q.bind(&b.ruangan).bind(&b.cara_berjalan).bind(&b.menopang)
                .bind(&b.hasil_penilaian).bind(&b.tindakan_ya).bind(&b.nama_keluarga).bind(&nip);
            q.execute(&state.pool).await.map_err(db_err)?;
        }
        "morse"   => simpan_skor(&state, &b, &nip, "penilaian_lanjutan_resiko_jatuh_dewasa",  "penilaian_jatuhmorse",    6).await?,
        "humpty"  => simpan_skor(&state, &b, &nip, "penilaian_lanjutan_resiko_jatuh_anak",    "penilaian_humptydumpty",  7).await?,
        "lansia"  => simpan_skor(&state, &b, &nip, "penilaian_lanjutan_resiko_jatuh_lansia",  "penilaian_jatuhmorse",    6).await?,
        "geriatri"=> simpan_skor(&state, &b, &nip, "penilaian_lanjutan_resiko_jatuh_geriatri","penilaian_jatuh",        11).await?,
        "neonatus" => {
            let g = |v: &Vec<String>, i: usize| v.get(i).cloned().unwrap_or_else(|| "Tidak".to_string());
            let wkt = dtopt(&b.waktu);
            let mut cols = String::from("no_rawat, tanggal");
            let mut vals = format!("?, {}", if wkt.is_some() { "?" } else { "NOW()" });
            for i in 1..=9 { cols.push_str(&format!(", intervensi{i}")); vals.push_str(", ?"); let _ = i; }
            for i in 1..=5 { cols.push_str(&format!(", edukasi{i}"));    vals.push_str(", ?"); let _ = i; }
            for i in 1..=4 { cols.push_str(&format!(", sasaran{i}"));    vals.push_str(", ?"); let _ = i; }
            for i in 1..=3 { cols.push_str(&format!(", evaluasi{i}"));   vals.push_str(", ?"); let _ = i; }
            cols.push_str(", nip"); vals.push_str(", ?");
            let sql = format!("INSERT INTO penilaian_risiko_jatuh_neonatus ({cols}) VALUES ({vals})");
            let mut q = sqlx::query(&sql).bind(&b.no_rawat);
            if let Some(t) = &wkt { q = q.bind(t); }
            for i in 0..9 { q = q.bind(g(&b.intervensi, i)); }
            for i in 0..5 { q = q.bind(g(&b.edukasi, i)); }
            for i in 0..4 { q = q.bind(g(&b.sasaran, i)); }
            for i in 0..3 { q = q.bind(g(&b.evaluasi, i)); }
            q = q.bind(&nip);
            q.execute(&state.pool).await.map_err(db_err)?;
        }
        _ => return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Instrumen tidak dikenal"})))),
    }
    crate::audit::log_sql(&state.pool, &nip, &format!("risiko_jatuh {} no_rawat={}", b.instrumen, b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// Riwayat gabungan semua instrumen untuk satu pasien.
#[derive(Serialize, sqlx::FromRow)]
pub struct RiwayatJatuh {
    pub instrumen: String,
    pub tanggal: Option<String>,
    pub ringkas: String,
    pub hasil: String,
    pub petugas: String,
    pub milik: i64,
}
pub async fn jatuh_riwayat(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Vec<RiwayatJatuh>>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    // Setiap tabel dipetakan ke bentuk seragam, lalu digabung & diurut menurun.
    let sql =
        "SELECT * FROM ( \
           SELECT 'Get Up & Go' instrumen, CAST(tanggal AS CHAR) tanggal, '' ringkas, IFNULL(hasil_penilaian,'') hasil, nip, (nip=? OR ?=1) milik \
             FROM asesmen_risiko_jatuh_getupgo WHERE no_rawat=? \
           UNION ALL SELECT 'Morse (Dewasa)', CAST(tanggal AS CHAR), CONCAT('Skor ', penilaian_jatuhmorse_totalnilai), IFNULL(hasil_skrining,''), nip, (nip=? OR ?=1) \
             FROM penilaian_lanjutan_resiko_jatuh_dewasa WHERE no_rawat=? \
           UNION ALL SELECT 'Humpty Dumpty (Anak)', CAST(tanggal AS CHAR), CONCAT('Skor ', penilaian_humptydumpty_totalnilai), IFNULL(hasil_skrining,''), nip, (nip=? OR ?=1) \
             FROM penilaian_lanjutan_resiko_jatuh_anak WHERE no_rawat=? \
           UNION ALL SELECT 'Lansia', CAST(tanggal AS CHAR), CONCAT('Skor ', penilaian_jatuhmorse_totalnilai), IFNULL(hasil_skrining,''), nip, (nip=? OR ?=1) \
             FROM penilaian_lanjutan_resiko_jatuh_lansia WHERE no_rawat=? \
           UNION ALL SELECT 'Geriatri', CAST(tanggal AS CHAR), CONCAT('Skor ', penilaian_jatuh_totalnilai), IFNULL(hasil_skrining,''), nip, (nip=? OR ?=1) \
             FROM penilaian_lanjutan_resiko_jatuh_geriatri WHERE no_rawat=? \
           UNION ALL SELECT 'Neonatus', CAST(tanggal AS CHAR), 'Checklist', '', nip, (nip=? OR ?=1) \
             FROM penilaian_risiko_jatuh_neonatus WHERE no_rawat=? \
         ) u ORDER BY tanggal DESC LIMIT 100";
    let mut qb = sqlx::query_as::<_, (String, Option<String>, String, String, String, i64)>(sql);
    for _ in 0..6 { qb = qb.bind(&user.0.kode).bind(admin).bind(&q.no_rawat); }
    let rows = qb.fetch_all(&state.pool).await.map_err(db_err)?;
    // Lengkapi nama petugas via pegawai.
    let mut out = Vec::with_capacity(rows.len());
    for (instrumen, tanggal, ringkas, hasil, nip, milik) in rows {
        let nama: Option<(String,)> = sqlx::query_as("SELECT nama FROM pegawai WHERE nik=? LIMIT 1")
            .bind(&nip).fetch_optional(&state.pool).await.ok().flatten();
        out.push(RiwayatJatuh {
            instrumen, tanggal, ringkas, hasil,
            petugas: nama.map(|n| n.0).unwrap_or(nip), milik,
        });
    }
    Ok(Json(out))
}

#[derive(Deserialize)]
pub struct NoRawatOnly { pub no_rawat: String }

// ── Penilaian Ulang Nyeri (adopsi RMPenilaianUlangNyeri Khanza, PQRST) ───────
#[derive(Serialize, sqlx::FromRow)]
pub struct NyeriRow {
    pub tanggal: Option<String>,
    pub nyeri: String,
    pub skala_nyeri: String,
    pub provokes: String,
    pub ket_provokes: String,
    pub quality: String,
    pub ket_quality: String,
    pub lokasi: String,
    pub menyebar: String,
    pub durasi: String,
    pub nyeri_hilang: String,
    pub ket_nyeri: String,
    pub petugas: String,
    #[sqlx(default)] pub milik: i64,
}
pub async fn nyeri_list(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Vec<NyeriRow>>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let rows = sqlx::query_as::<_, NyeriRow>(
        "SELECT CAST(x.tanggal AS CHAR) tanggal, IFNULL(x.nyeri,'') nyeri, IFNULL(x.skala_nyeri,'') skala_nyeri, \
                IFNULL(x.provokes,'') provokes, IFNULL(x.ket_provokes,'') ket_provokes, IFNULL(x.quality,'') quality, \
                IFNULL(x.ket_quality,'') ket_quality, IFNULL(x.lokasi,'') lokasi, IFNULL(x.menyebar,'') menyebar, \
                IFNULL(x.durasi,'') durasi, IFNULL(x.nyeri_hilang,'') nyeri_hilang, IFNULL(x.ket_nyeri,'') ket_nyeri, \
                IFNULL(pg.nama, x.nip) petugas, (x.nip = ? OR ? = 1) milik \
         FROM penilaian_ulang_nyeri x LEFT JOIN pegawai pg ON pg.nik = x.nip \
         WHERE x.no_rawat = ? ORDER BY x.tanggal DESC LIMIT 200"
    ).bind(&user.0.kode).bind(admin).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct NyeriBody {
    pub no_rawat: String,
    #[serde(default)] pub nyeri: String,
    #[serde(default)] pub provokes: String,
    #[serde(default)] pub ket_provokes: String,
    #[serde(default)] pub quality: String,
    #[serde(default)] pub ket_quality: String,
    #[serde(default)] pub lokasi: String,
    #[serde(default)] pub menyebar: String,
    #[serde(default)] pub skala_nyeri: String,
    #[serde(default)] pub durasi: String,
    #[serde(default)] pub nyeri_hilang: String,
    #[serde(default)] pub ket_nyeri: String,
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub orig_tanggal: String,
    #[serde(default)] pub waktu: String,
}
pub async fn nyeri_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<NyeriBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "penilaian_ulang_nyeri").await?;
    let nyeri = if b.nyeri.is_empty() { "Tidak Ada Nyeri" } else { &b.nyeri };
    let provokes = if b.provokes.is_empty() { "-" } else { &b.provokes };
    let quality = if b.quality.is_empty() { "-" } else { &b.quality };
    let menyebar = if b.menyebar.is_empty() { "Tidak" } else { &b.menyebar };
    let skala = if b.skala_nyeri.is_empty() { "0" } else { &b.skala_nyeri };
    let nyeri_hilang = if b.nyeri_hilang.is_empty() { "-" } else { &b.nyeri_hilang };
    let wkt = dtopt(&b.waktu); // Some("YYYY-MM-DD HH:MM:SS") bila diisi
    if b.edit {
        let admin: i64 = if user.0.is_admin { 1 } else { 0 };
        let new_tgl = wkt.clone().unwrap_or_else(|| b.orig_tanggal.clone());
        let res = sqlx::query(
            "UPDATE penilaian_ulang_nyeri SET tanggal=?, nyeri=?, provokes=?, ket_provokes=?, quality=?, ket_quality=?, lokasi=?, menyebar=?, skala_nyeri=?, durasi=?, nyeri_hilang=?, ket_nyeri=? \
             WHERE no_rawat=? AND tanggal=? AND (nip=? OR ?=1)")
        .bind(&new_tgl).bind(nyeri).bind(provokes).bind(&b.ket_provokes).bind(quality).bind(&b.ket_quality).bind(&b.lokasi)
        .bind(menyebar).bind(skala).bind(&b.durasi).bind(nyeri_hilang).bind(&b.ket_nyeri)
        .bind(&b.no_rawat).bind(&b.orig_tanggal).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat mengubah"}))));
        }
        crate::audit::log_sql(&state.pool, &user.0.kode, &format!("UBAH penilaian_ulang_nyeri no_rawat={} {}", b.no_rawat, b.orig_tanggal)).await;
        return Ok(Json(json!({"ok": true})));
    }
    let tgl_expr = if wkt.is_some() { "?" } else { "NOW()" };
    let sql = format!(
        "INSERT INTO penilaian_ulang_nyeri \
         (no_rawat, tanggal, nyeri, provokes, ket_provokes, quality, ket_quality, lokasi, menyebar, skala_nyeri, durasi, nyeri_hilang, ket_nyeri, nip) \
         VALUES (?, {tgl_expr}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    let mut q = sqlx::query(&sql).bind(&b.no_rawat);
    if let Some(t) = &wkt { q = q.bind(t); }
    q = q.bind(nyeri).bind(provokes).bind(&b.ket_provokes).bind(quality).bind(&b.ket_quality)
        .bind(&b.lokasi).bind(menyebar).bind(skala).bind(&b.durasi).bind(nyeri_hilang).bind(&b.ket_nyeri)
        .bind(&user.0.kode);
    q.execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("penilaian_ulang_nyeri no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// ── EWS — Early Warning Score (adopsi form pemantauan Khanza) ─────────────────
// Instrumen: dewasa (pemantauan_pews_dewasa), anak (pemantauan_pews_anak),
// neonatus (pemantauan_ews_neonatus). Skor dihitung di klien; backend simpan.
#[derive(Deserialize)]
pub struct EwsBody {
    pub no_rawat: String,
    #[serde(default)] pub instrumen: String,
    #[serde(default)] pub parameter: Vec<String>,
    #[serde(default)] pub skor: Vec<i32>,
    #[serde(default)] pub skor_total: i32,
    #[serde(default)] pub parameter_total: String,
    #[serde(default)] pub code_blue: String,
    #[serde(default)] pub waktu: String,
}
async fn simpan_ews(
    state: &AppState, b: &EwsBody, nip: &str, table: &str, suffixes: &[&str], numbered: bool, code_blue: bool,
) -> Result<(), (StatusCode, Json<Value>)> {
    let wkt = dtopt(&b.waktu);
    let mut cols = String::from("no_rawat, tanggal");
    let mut vals = format!("?, {}", if wkt.is_some() { "?" } else { "NOW()" });
    for s in suffixes {
        let (pc, sc) = if numbered { (format!("parameter{s}"), format!("skor{s}")) }
                       else { (format!("parameter_{s}"), format!("skor_{s}")) };
        cols.push_str(&format!(", {pc}, {sc}"));
        vals.push_str(", ?, ?");
    }
    cols.push_str(", skor_total, parameter_total");
    vals.push_str(", ?, ?");
    if code_blue { cols.push_str(", code_blue"); vals.push_str(", ?"); }
    cols.push_str(", nip");
    vals.push_str(", ?");
    let sql = format!("INSERT INTO {table} ({cols}) VALUES ({vals})");
    let mut q = sqlx::query(&sql).bind(&b.no_rawat);
    if let Some(t) = &wkt { q = q.bind(t); }
    for i in 0..suffixes.len() {
        q = q.bind(b.parameter.get(i).cloned().unwrap_or_default())
             .bind(b.skor.get(i).copied().unwrap_or(0).to_string());
    }
    q = q.bind(b.skor_total.to_string()).bind(&b.parameter_total);
    if code_blue { q = q.bind(if b.code_blue.is_empty() { "Tidak".to_string() } else { b.code_blue.clone() }); }
    q = q.bind(nip);
    q.execute(&state.pool).await.map_err(db_err)?;
    Ok(())
}
pub async fn ews_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<EwsBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, match b.instrumen.as_str() {
        "anak" => "pemantauan_pews_anak",
        "neonatus" => "pemantauan_ews_neonatus",
        _ => "pemantauan_pews_dewasa",
    }).await?;
    let nip = user.0.kode.clone();
    match b.instrumen.as_str() {
        "dewasa" => simpan_ews(&state, &b, &nip, "pemantauan_pews_dewasa",
            &["laju_respirasi","saturasi_oksigen","suplemen_oksigen","tekanan_darah_sistolik","laju_jantung","kesadaran","temperatur"], false, false).await?,
        "anak" => simpan_ews(&state, &b, &nip, "pemantauan_pews_anak",
            &["perilaku","crt_atau_warna_kulit","perespirasi"], false, false).await?,
        "neonatus" => simpan_ews(&state, &b, &nip, "pemantauan_ews_neonatus",
            &["1","2","3","4","5","6","7","8"], true, true).await?,
        _ => return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Instrumen EWS tidak dikenal"})))),
    }
    crate::audit::log_sql(&state.pool, &nip, &format!("ews {} no_rawat={}", b.instrumen, b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct RiwayatEws {
    pub instrumen: String,
    pub tanggal: Option<String>,
    pub skor_total: String,
    pub parameter_total: String,
    pub code_blue: String,
    pub petugas: String,
    pub milik: i64,
}
pub async fn ews_riwayat(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Vec<RiwayatEws>>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let sql =
        "SELECT * FROM ( \
           SELECT 'EWS Dewasa' instrumen, CAST(tanggal AS CHAR) tanggal, IFNULL(skor_total,'') skor_total, IFNULL(parameter_total,'') parameter_total, '' code_blue, nip, (nip=? OR ?=1) milik \
             FROM pemantauan_pews_dewasa WHERE no_rawat=? \
           UNION ALL SELECT 'PEWS Anak', CAST(tanggal AS CHAR), IFNULL(skor_total,''), IFNULL(parameter_total,''), '', nip, (nip=? OR ?=1) \
             FROM pemantauan_pews_anak WHERE no_rawat=? \
           UNION ALL SELECT 'EWS Neonatus', CAST(tanggal AS CHAR), IFNULL(skor_total,''), IFNULL(parameter_total,''), IFNULL(code_blue,''), nip, (nip=? OR ?=1) \
             FROM pemantauan_ews_neonatus WHERE no_rawat=? \
         ) u ORDER BY tanggal DESC LIMIT 100";
    let mut qb = sqlx::query_as::<_, (String, Option<String>, String, String, String, String, i64)>(sql);
    for _ in 0..3 { qb = qb.bind(&user.0.kode).bind(admin).bind(&q.no_rawat); }
    let rows = qb.fetch_all(&state.pool).await.map_err(db_err)?;
    let mut out = Vec::with_capacity(rows.len());
    for (instrumen, tanggal, skor_total, parameter_total, code_blue, nip, milik) in rows {
        let nama: Option<(String,)> = sqlx::query_as("SELECT nama FROM pegawai WHERE nik=? LIMIT 1")
            .bind(&nip).fetch_optional(&state.pool).await.ok().flatten();
        out.push(RiwayatEws { instrumen, tanggal, skor_total, parameter_total, code_blue, petugas: nama.map(|n| n.0).unwrap_or(nip), milik });
    }
    Ok(Json(out))
}

// ── Edukasi Pasien & Keluarga — log pelaksanaan (materi_edukasi_pasien_keluarga_rscb) ─
#[derive(Serialize, sqlx::FromRow)]
pub struct EdukasiRow {
    pub tanggal: Option<String>,
    pub jam: Option<String>,
    pub diberikan_pada: String,
    pub penerima_edukasi: String,
    pub profesi: String,
    pub materi_edukasi: String,
    pub kode_leaflet: String,
    pub lama_edukasi: String,
    pub hasil_verifikasi: String,
    pub petugas: String,
    #[sqlx(default)] pub milik: i64,
}
pub async fn edukasi_list(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Vec<EdukasiRow>>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let rows = sqlx::query_as::<_, EdukasiRow>(
        "SELECT CAST(m.tanggal AS CHAR) tanggal, CAST(m.jam AS CHAR) jam, \
                IFNULL(m.diberikan_pada,'') diberikan_pada, IFNULL(m.penerima_edukasi,'') penerima_edukasi, \
                IFNULL(m.profesi,'') profesi, IFNULL(m.materi_edukasi,'') materi_edukasi, \
                IFNULL(m.kode_leaflet,'') kode_leaflet, IFNULL(m.lama_edukasi,'') lama_edukasi, \
                IFNULL(m.hasil_verifikasi,'') hasil_verifikasi, IFNULL(pg.nama, m.nip) petugas, (m.nip = ? OR ? = 1) milik \
         FROM materi_edukasi_pasien_keluarga_rscb m LEFT JOIN pegawai pg ON pg.nik = m.nip \
         WHERE m.no_rawat = ? ORDER BY m.tanggal DESC, m.jam DESC LIMIT 200"
    ).bind(&user.0.kode).bind(admin).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct EdukasiBody {
    pub no_rawat: String,
    #[serde(default)] pub diberikan_pada: String,
    #[serde(default)] pub penerima_edukasi: String,
    #[serde(default)] pub profesi: String,
    #[serde(default)] pub materi_edukasi: String,
    #[serde(default)] pub kode_leaflet: String,
    #[serde(default)] pub lama_edukasi: String,
    #[serde(default)] pub hasil_verifikasi: String,
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub orig_tanggal: String,
    #[serde(default)] pub orig_jam: String,
    #[serde(default)] pub waktu: String,
}
pub async fn edukasi_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<EdukasiBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "pelaksanaan_informasi_edukasi").await?;
    if b.materi_edukasi.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Materi edukasi wajib diisi"}))));
    }
    let diberikan = match b.diberikan_pada.as_str() {
        "Keluarga" => "Keluarga", "Lain-lain" => "Lain-lain", _ => "Pasien",
    };
    let verifikasi = match b.hasil_verifikasi.as_str() {
        "Re - Edukasi" => "Re - Edukasi", "Re - Demonstrasi" => "Re - Demonstrasi", _ => "Sudah Mengerti",
    };
    let penerima = if b.penerima_edukasi.trim().is_empty() { "-".to_string() } else { b.penerima_edukasi.clone() };
    let profesi = if b.profesi.trim().is_empty() { "Perawat".to_string() } else { b.profesi.clone() };
    let wkt = split_dt(&b.waktu);
    if b.edit {
        let admin: i64 = if user.0.is_admin { 1 } else { 0 };
        let (new_tgl, new_jam) = wkt.clone().unwrap_or((b.orig_tanggal.clone(), b.orig_jam.clone()));
        let res = sqlx::query(
            "UPDATE materi_edukasi_pasien_keluarga_rscb SET tanggal=?, jam=?, diberikan_pada=?, penerima_edukasi=?, profesi=?, materi_edukasi=?, kode_leaflet=?, lama_edukasi=?, hasil_verifikasi=? \
             WHERE no_rawat=? AND tanggal=? AND jam=? AND (nip=? OR ?=1)")
        .bind(&new_tgl).bind(&new_jam).bind(diberikan).bind(&penerima).bind(&profesi).bind(&b.materi_edukasi).bind(&b.kode_leaflet).bind(&b.lama_edukasi).bind(verifikasi)
        .bind(&b.no_rawat).bind(&b.orig_tanggal).bind(&b.orig_jam).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat mengubah"}))));
        }
        crate::audit::log_sql(&state.pool, &user.0.kode, &format!("UBAH materi_edukasi no_rawat={} {} {}", b.no_rawat, b.orig_tanggal, b.orig_jam)).await;
        return Ok(Json(json!({"ok": true})));
    }
    // nip harus ada di pegawai (FK); fallback '-'
    let nip_valid: bool = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM pegawai WHERE nik = ?")
        .bind(&user.0.kode).fetch_one(&state.pool).await.map_err(db_err)? > 0;
    let nip = if nip_valid { user.0.kode.clone() } else { "-".to_string() };
    let tgl_expr = if wkt.is_some() { "?" } else { "CURDATE()" };
    let jam_expr = if wkt.is_some() { "?" } else { "CURTIME()" };
    let sql = format!(
        "INSERT INTO materi_edukasi_pasien_keluarga_rscb \
           (no_rawat, tanggal, jam, diberikan_pada, penerima_edukasi, profesi, materi_edukasi, kode_leaflet, lama_edukasi, hasil_verifikasi, nip) \
         VALUES (?, {tgl_expr}, {jam_expr}, ?, ?, ?, ?, ?, ?, ?, ?)");
    let mut q = sqlx::query(&sql).bind(&b.no_rawat);
    if let Some((d, t)) = &wkt { q = q.bind(d).bind(t); }
    q = q.bind(diberikan).bind(&penerima)
        .bind(&profesi).bind(&b.materi_edukasi).bind(&b.kode_leaflet).bind(&b.lama_edukasi)
        .bind(verifikasi).bind(&nip);
    q.execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("materi_edukasi (enakes) no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Hapus owner-only (hanya pembuat / Admin) — Catatan, Nyeri, Edukasi ────────
#[derive(Deserialize)]
pub struct CatatanDelBody { pub no_rawat: String, #[serde(default)] pub jenis: String, pub tanggal: String, pub jam: String }
pub async fn catatan_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<CatatanDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tabel = if b.jenis == "ranap" { "catatan_keperawatan_ranap" } else { "catatan_keperawatan_ralan" };
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let res = sqlx::query(&format!("DELETE FROM {tabel} WHERE no_rawat=? AND tanggal=? AND jam=? AND (nip=? OR ?=1)"))
        .bind(&b.no_rawat).bind(&b.tanggal).bind(&b.jam).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat menghapus catatan ini"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS {} no_rawat={} {} {}", tabel, b.no_rawat, b.tanggal, b.jam)).await;
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
pub struct NyeriDelBody { pub no_rawat: String, pub tanggal: String }
pub async fn nyeri_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<NyeriDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let res = sqlx::query("DELETE FROM penilaian_ulang_nyeri WHERE no_rawat=? AND tanggal=? AND (nip=? OR ?=1)")
        .bind(&b.no_rawat).bind(&b.tanggal).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat menghapus"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS penilaian_ulang_nyeri no_rawat={} {}", b.no_rawat, b.tanggal)).await;
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
pub struct EdukasiDelBody { pub no_rawat: String, pub tanggal: String, pub jam: String }
pub async fn edukasi_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<EdukasiDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let res = sqlx::query("DELETE FROM materi_edukasi_pasien_keluarga_rscb WHERE no_rawat=? AND tanggal=? AND jam=? AND (nip=? OR ?=1)")
        .bind(&b.no_rawat).bind(&b.tanggal).bind(&b.jam).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat menghapus"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS materi_edukasi no_rawat={} {} {}", b.no_rawat, b.tanggal, b.jam)).await;
    Ok(Json(json!({"ok": true})))
}

// Generic hapus by (no_rawat, tanggal) owner-only — dipakai form skrining/risiko
// dengan kolom `nip` + `tanggal` (PHQ-9, ASQ, Kekerasan, Melarikan Diri).
async fn hapus_by_tgl(state: &AppState, user: &AuthUser, table: &str, b: &NyeriDelBody)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let sql = format!("DELETE FROM {table} WHERE no_rawat=? AND tanggal=? AND (nip=? OR ?=1)");
    let res = sqlx::query(&sql)
        .bind(&b.no_rawat).bind(&b.tanggal).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat menghapus"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS {table} no_rawat={} {}", b.no_rawat, b.tanggal)).await;
    Ok(Json(json!({"ok": true})))
}
pub async fn phq9_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<NyeriDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> { hapus_by_tgl(&state, &user, "skrining_phq9", &b).await }
pub async fn asq_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<NyeriDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> { hapus_by_tgl(&state, &user, "skrining_asq", &b).await }
pub async fn kekerasan_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<NyeriDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> { hapus_by_tgl(&state, &user, "penilaian_tambahan_perilaku_kekerasan", &b).await }
pub async fn melarikan_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<NyeriDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> { hapus_by_tgl(&state, &user, "penilaian_tambahan_beresiko_melarikan_diri", &b).await }

// Hapus riwayat Jatuh / EWS — tabel dipilih dari label `instrumen` yang dikirim klien.
#[derive(Deserialize)]
pub struct InstrumenDelBody { pub no_rawat: String, pub tanggal: String, #[serde(default)] pub instrumen: String }
pub async fn jatuh_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<InstrumenDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tabel = match b.instrumen.as_str() {
        "Get Up & Go"          => "asesmen_risiko_jatuh_getupgo",
        "Morse (Dewasa)"       => "penilaian_lanjutan_resiko_jatuh_dewasa",
        "Humpty Dumpty (Anak)" => "penilaian_lanjutan_resiko_jatuh_anak",
        "Lansia"               => "penilaian_lanjutan_resiko_jatuh_lansia",
        "Geriatri"             => "penilaian_lanjutan_resiko_jatuh_geriatri",
        "Neonatus"             => "penilaian_risiko_jatuh_neonatus",
        _ => return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Instrumen jatuh tidak dikenal"})))),
    };
    hapus_by_tgl(&state, &user, tabel, &NyeriDelBody { no_rawat: b.no_rawat, tanggal: b.tanggal }).await
}
pub async fn ews_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<InstrumenDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tabel = match b.instrumen.as_str() {
        "EWS Dewasa"   => "pemantauan_pews_dewasa",
        "PEWS Anak"    => "pemantauan_pews_anak",
        "EWS Neonatus" => "pemantauan_ews_neonatus",
        _ => return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Instrumen EWS tidak dikenal"})))),
    };
    hapus_by_tgl(&state, &user, tabel, &NyeriDelBody { no_rawat: b.no_rawat, tanggal: b.tanggal }).await
}

// Hapus Resume Keperawatan (1 record/no_rawat, owner = kd_petugas).
#[derive(Deserialize)]
pub struct NoRawatDelBody { pub no_rawat: String }
pub async fn resume_kep_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<NoRawatDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let res = sqlx::query("DELETE FROM resume_keperawatan WHERE no_rawat=? AND (kd_petugas=? OR ?=1)")
        .bind(&b.no_rawat).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat menghapus"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS resume_keperawatan no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// Hapus checklist Kriteria (owner = nik), tabel dipilih dari form.
#[derive(Deserialize)]
pub struct KriteriaDelBody { pub form: String, pub no_rawat: String }
pub async fn kriteria_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<KriteriaDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let (table, _) = kriteria_form(&b.form)
        .ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"form tidak dikenal"}))))?;
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let res = sqlx::query(&format!("DELETE FROM `{table}` WHERE no_rawat=? AND (nik=? OR ?=1)"))
        .bind(&b.no_rawat).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat menghapus"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS {table} no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// Hapus satu pengkajian keperawatan ICU (append; owner = nip; key no_rawat+tanggal).
pub async fn pengkajian_icu_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<NyeriDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> { hapus_by_tgl(&state, &user, "pengkajian_keperawatan_icu", &b).await }

// ── Persetujuan / Penolakan Tindakan Kedokteran (informed consent) ───────────
#[derive(Serialize, sqlx::FromRow)]
pub struct PenolakanRow {
    pub no_pernyataan: String,
    pub tanggal: Option<String>,
    pub tindakan: String,
    pub pernyataan: String,
    pub penerima: String,
    pub petugas: String,
    #[sqlx(default)] pub milik: i64,
}
pub async fn penolakan_list(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Vec<PenolakanRow>>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let rows = sqlx::query_as::<_, PenolakanRow>(
        "SELECT x.no_pernyataan, CAST(x.tanggal AS CHAR) tanggal, IFNULL(x.tindakan,'') tindakan, \
                IFNULL(x.pernyataan,'') pernyataan, IFNULL(x.penerima_informasi,'') penerima, \
                IFNULL(pg.nama, x.nip) petugas, (x.nip = ? OR ? = 1) milik \
         FROM persetujuan_penolakan_tindakan x LEFT JOIN pegawai pg ON pg.nik = x.nip \
         WHERE x.no_rawat = ? ORDER BY x.tanggal DESC, x.no_pernyataan DESC LIMIT 100"
    ).bind(&user.0.kode).bind(admin).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// Detail satu pernyataan (by no_pernyataan) untuk Edit-in-place.
#[derive(Deserialize)]
pub struct PenolakanDetailQuery { pub no_pernyataan: String }
pub async fn penolakan_detail(user: AuthUser, State(state): State<AppState>, Query(q): Query<PenolakanDetailQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    const TXT: &[&str] = &["diagnosa","dasar_diagnosa","tindakan","indikasi_tindakan","tujuan","risiko","komplikasi","prognosis","alternatif_dan_risikonya","lain_lain"];
    const KF: &[&str] = &["diagnosa_konfirmasi","dasar_diagnosa_konfirmasi","tindakan_konfirmasi","indikasi_tindakan_konfirmasi","tujuan_konfirmasi","risiko_konfirmasi","komplikasi_konfirmasi","prognosis_konfirmasi","alternatif_konfirmasi","lain_lain_konfirmasi"];
    let mut cols: Vec<String> = Vec::new();
    for c in TXT { cols.push(format!("IFNULL(`{c}`,'') AS `{c}`")); }
    for c in KF { cols.push(format!("IFNULL(`{c}`,'false') AS `{c}`")); }
    for c in ["kd_dokter","penerima_informasi","alasan_diwakilkan_penerima_informasi","jk_penerima_informasi","umur_penerima_informasi","alamat_penerima_informasi","no_hp","hubungan_penerima_informasi","pernyataan","saksi_keluarga"] {
        cols.push(format!("IFNULL(`{c}`,'') AS `{c}`"));
    }
    cols.push("CAST(tanggal_lahir_penerima_informasi AS CHAR) tanggal_lahir_penerima_informasi".into());
    cols.push("IFNULL(nip,'') nip".into());
    let sql = format!("SELECT {} FROM persetujuan_penolakan_tindakan WHERE no_pernyataan=? LIMIT 1", cols.join(", "));
    let row = sqlx::query(&sql).bind(&q.no_pernyataan).fetch_optional(&state.pool).await.map_err(db_err)?;
    let Some(row) = row else { return Ok(Json(Value::Null)); };
    use sqlx::Row;
    let mut grid = serde_json::Map::new();
    let mut konf = serde_json::Map::new();
    for c in TXT { grid.insert((*c).into(), Value::String(row.try_get::<String,_>(*c).unwrap_or_default())); }
    for (i, c) in KF.iter().enumerate() {
        let v: String = row.try_get(*c).unwrap_or_default();
        konf.insert(TXT[i].to_string(), Value::Bool(v == "true" || v == "1"));
    }
    let s = |c: &str| -> String { row.try_get::<String,_>(c).unwrap_or_default() };
    let owner = s("nip");
    let dapat_edit = user.0.is_admin || owner == user.0.kode;
    let mut tgl_lahir = row.try_get::<String,_>("tanggal_lahir_penerima_informasi").unwrap_or_default();
    if tgl_lahir.len() >= 10 { tgl_lahir = tgl_lahir[..10].to_string(); }
    Ok(Json(json!({
        "grid": grid, "konf": konf, "kd_dokter": s("kd_dokter"), "pernyataan": s("pernyataan"),
        "penerima_informasi": s("penerima_informasi"), "alasan_diwakilkan_penerima_informasi": s("alasan_diwakilkan_penerima_informasi"),
        "jk_penerima_informasi": s("jk_penerima_informasi"), "tanggal_lahir_penerima_informasi": tgl_lahir,
        "umur_penerima_informasi": s("umur_penerima_informasi"), "alamat_penerima_informasi": s("alamat_penerima_informasi"),
        "no_hp": s("no_hp"), "hubungan_penerima_informasi": s("hubungan_penerima_informasi"), "saksi_keluarga": s("saksi_keluarga"),
        "dapat_edit": dapat_edit
    })))
}
pub async fn penolakan_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<PenolakanDetailQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let res = sqlx::query("DELETE FROM persetujuan_penolakan_tindakan WHERE no_pernyataan=? AND (nip=? OR ?=1)")
        .bind(&b.no_pernyataan).bind(&user.0.kode).bind(admin).execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat menghapus"}))));
    }
    let _ = sqlx::query("DELETE FROM bukti_persetujuan_penolakan_tindakan_penerimainformasi WHERE no_pernyataan=?").bind(&b.no_pernyataan).execute(&state.pool).await;
    let _ = sqlx::query("DELETE FROM bukti_persetujuan_penolakan_tindakan_saksikeluarga WHERE no_pernyataan=?").bind(&b.no_pernyataan).execute(&state.pool).await;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS persetujuan_penolakan_tindakan {}", b.no_pernyataan)).await;
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
pub struct PenolakanBody {
    pub no_rawat: String,
    #[serde(default)] pub diagnosa: String,             #[serde(default)] pub diagnosa_konfirmasi: bool,
    #[serde(default)] pub dasar_diagnosa: String,       #[serde(default)] pub dasar_diagnosa_konfirmasi: bool,
    #[serde(default)] pub tindakan: String,             #[serde(default)] pub tindakan_konfirmasi: bool,
    #[serde(default)] pub indikasi_tindakan: String,    #[serde(default)] pub indikasi_tindakan_konfirmasi: bool,
    #[serde(default)] pub tujuan: String,               #[serde(default)] pub tujuan_konfirmasi: bool,
    #[serde(default)] pub risiko: String,               #[serde(default)] pub risiko_konfirmasi: bool,
    #[serde(default)] pub komplikasi: String,           #[serde(default)] pub komplikasi_konfirmasi: bool,
    #[serde(default)] pub prognosis: String,            #[serde(default)] pub prognosis_konfirmasi: bool,
    #[serde(default)] pub alternatif_dan_risikonya: String, #[serde(default)] pub alternatif_konfirmasi: bool,
    #[serde(default)] pub lain_lain: String,            #[serde(default)] pub lain_lain_konfirmasi: bool,
    #[serde(default)] pub kd_dokter: String,
    #[serde(default)] pub penerima_informasi: String,
    #[serde(default)] pub alasan_diwakilkan_penerima_informasi: String,
    #[serde(default)] pub jk_penerima_informasi: String,     // "L" | "P"
    #[serde(default)] pub tanggal_lahir_penerima_informasi: String,
    #[serde(default)] pub umur_penerima_informasi: String,
    #[serde(default)] pub alamat_penerima_informasi: String,
    #[serde(default)] pub no_hp: String,
    #[serde(default)] pub hubungan_penerima_informasi: String,
    #[serde(default)] pub pernyataan: String,                // "Persetujuan" | "Penolakan" | "Belum Dikonfirmasi"
    #[serde(default)] pub saksi_keluarga: String,
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub no_pernyataan: String,
}
pub async fn penolakan_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<PenolakanBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "persetujuan_penolakan_tindakan").await?;
    if b.tindakan.trim().is_empty() || b.penerima_informasi.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Tindakan & penerima informasi wajib diisi"}))));
    }
    let kf = |v: bool| if v { "true" } else { "false" };
    let jk = if b.jk_penerima_informasi == "P" { "P" } else { "L" };
    // Kolom DATE NOT NULL di Khanza; kosong = '0000-00-00' (bukan NULL).
    let tgl_lahir = if b.tanggal_lahir_penerima_informasi.trim().is_empty() { "0000-00-00".to_string() } else { b.tanggal_lahir_penerima_informasi.clone() };
    let hubungan = match b.hubungan_penerima_informasi.as_str() {
        "Orang Tua" => "Orang Tua", "Anak" => "Anak", "Saudara Kandung" => "Saudara Kandung",
        "Teman" => "Teman", "Lain-lain" => "Lain-lain", _ => "Diri Sendiri",
    };
    let pernyataan = match b.pernyataan.as_str() {
        "Persetujuan" => "Persetujuan", "Penolakan" => "Penolakan", _ => "Belum Dikonfirmasi",
    };
    // Edit-in-place: UPDATE by no_pernyataan (no_pernyataan & tanggal tetap), owner-locked.
    if b.edit && !b.no_pernyataan.trim().is_empty() {
        let admin: i64 = if user.0.is_admin { 1 } else { 0 };
        let res = sqlx::query(
            "UPDATE persetujuan_penolakan_tindakan SET \
             diagnosa=?, diagnosa_konfirmasi=?, dasar_diagnosa=?, dasar_diagnosa_konfirmasi=?, \
             tindakan=?, tindakan_konfirmasi=?, indikasi_tindakan=?, indikasi_tindakan_konfirmasi=?, \
             tujuan=?, tujuan_konfirmasi=?, risiko=?, risiko_konfirmasi=?, komplikasi=?, komplikasi_konfirmasi=?, \
             prognosis=?, prognosis_konfirmasi=?, alternatif_dan_risikonya=?, alternatif_konfirmasi=?, \
             lain_lain=?, lain_lain_konfirmasi=?, kd_dokter=?, penerima_informasi=?, alasan_diwakilkan_penerima_informasi=?, \
             jk_penerima_informasi=?, tanggal_lahir_penerima_informasi=?, umur_penerima_informasi=?, alamat_penerima_informasi=?, \
             no_hp=?, hubungan_penerima_informasi=?, pernyataan=?, saksi_keluarga=? \
             WHERE no_pernyataan=? AND (nip=? OR ?=1)")
            .bind(&b.diagnosa).bind(kf(b.diagnosa_konfirmasi))
            .bind(&b.dasar_diagnosa).bind(kf(b.dasar_diagnosa_konfirmasi))
            .bind(&b.tindakan).bind(kf(b.tindakan_konfirmasi))
            .bind(&b.indikasi_tindakan).bind(kf(b.indikasi_tindakan_konfirmasi))
            .bind(&b.tujuan).bind(kf(b.tujuan_konfirmasi))
            .bind(&b.risiko).bind(kf(b.risiko_konfirmasi))
            .bind(&b.komplikasi).bind(kf(b.komplikasi_konfirmasi))
            .bind(&b.prognosis).bind(kf(b.prognosis_konfirmasi))
            .bind(&b.alternatif_dan_risikonya).bind(kf(b.alternatif_konfirmasi))
            .bind(&b.lain_lain).bind(kf(b.lain_lain_konfirmasi))
            .bind(&b.kd_dokter).bind(&b.penerima_informasi).bind(&b.alasan_diwakilkan_penerima_informasi)
            .bind(jk).bind(&tgl_lahir).bind(&b.umur_penerima_informasi).bind(&b.alamat_penerima_informasi)
            .bind(&b.no_hp).bind(hubungan).bind(pernyataan).bind(&b.saksi_keluarga)
            .bind(&b.no_pernyataan).bind(&user.0.kode).bind(admin)
            .execute(&state.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat mengubah"}))));
        }
        crate::audit::log_sql(&state.pool, &user.0.kode, &format!("UBAH persetujuan_penolakan_tindakan {}", b.no_pernyataan)).await;
        return Ok(Json(json!({"ok": true, "no_pernyataan": b.no_pernyataan})));
    }
    let tgl = chrono::Local::now().format("%Y-%m-%d").to_string();
    let prefix = format!("PM{}", tgl.replace('-', ""));
    let seq: (i64,) = sqlx::query_as(
        "SELECT IFNULL(MAX(CONVERT(RIGHT(no_pernyataan,3),SIGNED)),0)+1 FROM persetujuan_penolakan_tindakan WHERE tanggal = ?"
    ).bind(&tgl).fetch_one(&state.pool).await.map_err(db_err)?;
    let no_pernyataan = format!("{}{:03}", prefix, seq.0);
    sqlx::query(
        "INSERT INTO persetujuan_penolakan_tindakan \
         (no_pernyataan, no_rawat, tanggal, diagnosa, diagnosa_konfirmasi, dasar_diagnosa, dasar_diagnosa_konfirmasi, \
          tindakan, tindakan_konfirmasi, indikasi_tindakan, indikasi_tindakan_konfirmasi, tujuan, tujuan_konfirmasi, \
          risiko, risiko_konfirmasi, komplikasi, komplikasi_konfirmasi, prognosis, prognosis_konfirmasi, \
          alternatif_dan_risikonya, alternatif_konfirmasi, lain_lain, lain_lain_konfirmasi, kd_dokter, nip, \
          penerima_informasi, alasan_diwakilkan_penerima_informasi, jk_penerima_informasi, tanggal_lahir_penerima_informasi, \
          umur_penerima_informasi, alamat_penerima_informasi, no_hp, hubungan_penerima_informasi, pernyataan, saksi_keluarga) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&no_pernyataan).bind(&b.no_rawat).bind(&tgl)
    .bind(&b.diagnosa).bind(kf(b.diagnosa_konfirmasi))
    .bind(&b.dasar_diagnosa).bind(kf(b.dasar_diagnosa_konfirmasi))
    .bind(&b.tindakan).bind(kf(b.tindakan_konfirmasi))
    .bind(&b.indikasi_tindakan).bind(kf(b.indikasi_tindakan_konfirmasi))
    .bind(&b.tujuan).bind(kf(b.tujuan_konfirmasi))
    .bind(&b.risiko).bind(kf(b.risiko_konfirmasi))
    .bind(&b.komplikasi).bind(kf(b.komplikasi_konfirmasi))
    .bind(&b.prognosis).bind(kf(b.prognosis_konfirmasi))
    .bind(&b.alternatif_dan_risikonya).bind(kf(b.alternatif_konfirmasi))
    .bind(&b.lain_lain).bind(kf(b.lain_lain_konfirmasi))
    .bind(&b.kd_dokter).bind(&user.0.kode)
    .bind(&b.penerima_informasi).bind(&b.alasan_diwakilkan_penerima_informasi).bind(jk).bind(&tgl_lahir)
    .bind(&b.umur_penerima_informasi).bind(&b.alamat_penerima_informasi).bind(&b.no_hp).bind(hubungan)
    .bind(pernyataan).bind(&b.saksi_keluarga)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("persetujuan_penolakan_tindakan {} no_rawat={}", no_pernyataan, b.no_rawat)).await;
    Ok(Json(json!({"ok": true, "no_pernyataan": no_pernyataan})))
}

// ── Bukti foto + TTD Penolakan Tindakan (penerima informasi & saksi keluarga) ─
#[derive(Deserialize)]
pub struct PenolakanBuktiBody {
    pub no_pernyataan: String,
    #[serde(default)] pub penerima_foto: String,
    #[serde(default)] pub penerima_ttd: String,
    #[serde(default)] pub saksi_foto: String,
    #[serde(default)] pub saksi_ttd: String,
}
pub async fn penolakan_bukti(user: AuthUser, State(state): State<AppState>, Json(b): Json<PenolakanBuktiBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "persetujuan_penolakan_tindakan").await?;
    if b.no_pernyataan.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_pernyataan wajib"}))));
    }
    let fname: String = b.no_pernyataan.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '_' }).collect();
    use crate::handlers::simrscb::save_webapps_image;

    if !b.penerima_foto.trim().is_empty() || !b.penerima_ttd.trim().is_empty() {
        let rphoto = if !b.penerima_foto.trim().is_empty() {
            save_webapps_image(&state, "persetujuantindakan", "penerima_foto", &fname, &b.penerima_foto).await?
        } else { String::new() };
        let rttd = if !b.penerima_ttd.trim().is_empty() {
            save_webapps_image(&state, "persetujuantindakan", "penerima_ttd", &fname, &b.penerima_ttd).await?
        } else { String::new() };
        sqlx::query(
            "INSERT INTO bukti_persetujuan_penolakan_tindakan_penerimainformasi (no_pernyataan, photo, tandatangan) \
             VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE \
             photo=IF(VALUES(photo)<>'', VALUES(photo), photo), \
             tandatangan=IF(VALUES(tandatangan)<>'', VALUES(tandatangan), tandatangan)"
        ).bind(&b.no_pernyataan).bind(&rphoto).bind(&rttd).execute(&state.pool).await.map_err(db_err)?;
    }
    if !b.saksi_foto.trim().is_empty() || !b.saksi_ttd.trim().is_empty() {
        let rphoto = if !b.saksi_foto.trim().is_empty() {
            save_webapps_image(&state, "persetujuantindakan", "saksi_foto", &fname, &b.saksi_foto).await?
        } else { String::new() };
        let rttd = if !b.saksi_ttd.trim().is_empty() {
            save_webapps_image(&state, "persetujuantindakan", "saksi_ttd", &fname, &b.saksi_ttd).await?
        } else { String::new() };
        sqlx::query(
            "INSERT INTO bukti_persetujuan_penolakan_tindakan_saksikeluarga (no_pernyataan, photo, tandatangan) \
             VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE \
             photo=IF(VALUES(photo)<>'', VALUES(photo), photo), \
             tandatangan=IF(VALUES(tandatangan)<>'', VALUES(tandatangan), tandatangan)"
        ).bind(&b.no_pernyataan).bind(&rphoto).bind(&rttd).execute(&state.pool).await.map_err(db_err)?;
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("bukti penolakan_tindakan no_pernyataan={}", b.no_pernyataan)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Booking Operasi — daftar pasien terjadwal operasi (adopsi DlgBookingOperasi) ─
// Sumber: booking_operasi ⋈ reg_periksa/pasien/paket_operasi/dokter/poliklinik/ruang_ok.
// Filter per-tanggal; default hari ini. Read-only untuk e-Nakes.
#[derive(Deserialize)]
pub struct OperasiQuery {
    #[serde(default)] pub tgl: Option<String>,
    #[serde(default)] pub cari: Option<String>,
}
#[derive(Serialize, sqlx::FromRow)]
pub struct OperasiRow {
    pub no_rawat: String,
    pub no_rm: String,
    pub nm_pasien: String,
    pub tanggal: String,
    pub jam_mulai: String,
    pub jam_selesai: String,
    pub status: String,
    pub dokter: String,
    pub paket: String,
    pub umur: String,
    pub jk: String,
    pub poli: String,
    pub ruang: String,
    pub jenis: String,
}
pub async fn operasi_list(_user: AuthUser, State(state): State<AppState>, Query(q): Query<OperasiQuery>)
  -> Result<Json<Vec<OperasiRow>>, (StatusCode, Json<Value>)> {
    let tgl = q.tgl.filter(|s| !s.trim().is_empty());
    let cari = q.cari.unwrap_or_default();
    let cari = cari.trim();
    let mut sql = String::from(
        "SELECT bo.no_rawat, rp.no_rkm_medis AS no_rm, IFNULL(ps.nm_pasien,'') AS nm_pasien, \
                CAST(bo.tanggal AS CHAR) AS tanggal, LEFT(CAST(bo.jam_mulai AS CHAR),5) AS jam_mulai, \
                LEFT(CAST(bo.jam_selesai AS CHAR),5) AS jam_selesai, IFNULL(bo.status,'') AS status, \
                IFNULL(dk.nm_dokter,'') AS dokter, IFNULL(po.nm_perawatan,'') AS paket, \
                CONCAT(IFNULL(rp.umurdaftar,''),' ',IFNULL(rp.sttsumur,'')) AS umur, \
                IFNULL(ps.jk,'') AS jk, IFNULL(pk.nm_poli,'') AS poli, IFNULL(ro.nm_ruang_ok,'') AS ruang, \
                IF(rp.status_lanjut='Ranap','ranap','ralan') AS jenis \
         FROM booking_operasi bo \
         INNER JOIN reg_periksa rp ON bo.no_rawat = rp.no_rawat \
         INNER JOIN pasien ps ON rp.no_rkm_medis = ps.no_rkm_medis \
         LEFT JOIN paket_operasi po ON bo.kode_paket = po.kode_paket \
         LEFT JOIN dokter dk ON bo.kd_dokter = dk.kd_dokter \
         LEFT JOIN poliklinik pk ON rp.kd_poli = pk.kd_poli \
         LEFT JOIN ruang_ok ro ON bo.kd_ruang_ok = ro.kd_ruang_ok \
         WHERE 1=1"
    );
    if tgl.is_some() { sql.push_str(" AND bo.tanggal = ?"); }
    if !cari.is_empty() {
        sql.push_str(" AND (bo.no_rawat LIKE ? OR rp.no_rkm_medis LIKE ? OR ps.nm_pasien LIKE ? \
                       OR dk.nm_dokter LIKE ? OR po.nm_perawatan LIKE ?)");
    }
    sql.push_str(" ORDER BY bo.tanggal DESC, bo.jam_mulai ASC LIMIT 300");
    let mut query = sqlx::query_as::<_, OperasiRow>(&sql);
    if let Some(t) = &tgl { query = query.bind(t); }
    if !cari.is_empty() {
        let like = format!("%{cari}%");
        for _ in 0..5 { query = query.bind(like.clone()); }
    }
    let rows = query.fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// ── Skrining PHQ-9 (Patient Health Questionnaire-9) ──────────────────────────
// 9 pertanyaan skala 0..3, total 0..27. Keterangan (mengikuti form RS):
//   total ≤14 → Asuhan RBD (rencana bunuh diri); ≥15 → Rujuk psikiater/perawat
//   spesialis jiwa/psikolog klinis. Hak akses memakai skrining_instrumen_srq.
#[derive(Serialize, sqlx::FromRow)]
pub struct Phq9Row {
    pub tanggal: Option<String>,
    pub phq1: i32, pub phq2: i32, pub phq3: i32, pub phq4: i32, pub phq5: i32,
    pub phq6: i32, pub phq7: i32, pub phq8: i32, pub phq9: i32,
    pub total_skor: i32,
    pub kesimpulan: String,
    pub petugas: String,
    #[sqlx(default)] pub milik: i64,
}
pub async fn phq9_list(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Vec<Phq9Row>>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let rows = sqlx::query_as::<_, Phq9Row>(
        "SELECT CAST(s.tanggal AS CHAR) tanggal, s.phq1, s.phq2, s.phq3, s.phq4, s.phq5, \
                s.phq6, s.phq7, s.phq8, s.phq9, s.total_skor, IFNULL(s.kesimpulan,'') kesimpulan, \
                IFNULL(pg.nama, s.nip) petugas, (s.nip = ? OR ? = 1) milik \
         FROM skrining_phq9 s LEFT JOIN pegawai pg ON pg.nik = s.nip \
         WHERE s.no_rawat = ? ORDER BY s.tanggal DESC LIMIT 100"
    ).bind(&user.0.kode).bind(admin).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct Phq9Body {
    pub no_rawat: String,
    #[serde(default)] pub nilai: Vec<i32>,   // 9 nilai (0..3)
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub orig_tanggal: String,
    #[serde(default)] pub waktu: String,
}
pub async fn phq9_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<Phq9Body>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "skrining_instrumen_srq").await?;
    if b.nilai.len() != 9 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Jawaban PHQ-9 harus 9 item"}))));
    }
    let n: Vec<i32> = b.nilai.iter().map(|v| (*v).clamp(0, 3)).collect();
    let total: i32 = n.iter().sum();
    let kesimpulan = if total <= 14 {
        "Asuhan RBD (rencana bunuh diri)".to_string()
    } else {
        "Rujuk ke psikiater/perawat spesialis jiwa/psikolog klinis".to_string()
    };
    let wkt = dtopt(&b.waktu);
    if b.edit {
        let admin: i64 = if user.0.is_admin { 1 } else { 0 };
        let new_tgl = wkt.clone().unwrap_or_else(|| b.orig_tanggal.clone());
        let res = sqlx::query(
            "UPDATE skrining_phq9 SET tanggal=?, phq1=?, phq2=?, phq3=?, phq4=?, phq5=?, phq6=?, phq7=?, phq8=?, phq9=?, total_skor=?, kesimpulan=? \
             WHERE no_rawat=? AND tanggal=? AND (nip=? OR ?=1)")
        .bind(&new_tgl).bind(n[0]).bind(n[1]).bind(n[2]).bind(n[3]).bind(n[4]).bind(n[5]).bind(n[6]).bind(n[7]).bind(n[8])
        .bind(total).bind(&kesimpulan).bind(&b.no_rawat).bind(&b.orig_tanggal).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat mengubah"}))));
        }
        crate::audit::log_sql(&state.pool, &user.0.kode, &format!("UBAH skrining_phq9 no_rawat={} {}", b.no_rawat, b.orig_tanggal)).await;
        return Ok(Json(json!({"ok": true, "total": total, "kesimpulan": kesimpulan})));
    }
    let tgl_expr = if wkt.is_some() { "?" } else { "NOW()" };
    let sql = format!(
        "INSERT INTO skrining_phq9 \
         (no_rawat, tanggal, nip, phq1, phq2, phq3, phq4, phq5, phq6, phq7, phq8, phq9, total_skor, kesimpulan) \
         VALUES (?, {tgl_expr}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    let mut q = sqlx::query(&sql).bind(&b.no_rawat);
    if let Some(t) = &wkt { q = q.bind(t); }
    q = q.bind(&user.0.kode)
        .bind(n[0]).bind(n[1]).bind(n[2]).bind(n[3]).bind(n[4])
        .bind(n[5]).bind(n[6]).bind(n[7]).bind(n[8])
        .bind(total).bind(&kesimpulan);
    q.execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("skrining_phq9 no_rawat={} total={}", b.no_rawat, total)).await;
    Ok(Json(json!({"ok": true, "total": total, "kesimpulan": kesimpulan})))
}

// ── Skrining ASQ (Ask Suicide-Screening Questions) — form RM.103 ─────────────
// 5 pertanyaan Ya/Tidak (Q4 & Q5 disertai deskripsi). Interpretasi:
//   Q1..Q4 semua "Tidak" → Negatif; ada "Ya" & Q5 "Tidak" → Positif Non-Akut;
//   Q5 "Ya" → Positif AKUT. Hak akses memakai penilaian_tambahan_bunuh_diri.
#[derive(Serialize, sqlx::FromRow)]
pub struct AsqRow {
    pub tanggal: Option<String>,
    pub asq1: String, pub asq2: String, pub asq3: String, pub asq4: String, pub asq5: String,
    pub ket4: String, pub ket5: String,
    pub kesimpulan: String,
    pub petugas: String,
    #[sqlx(default)] pub milik: i64,
}
pub async fn asq_list(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Vec<AsqRow>>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let rows = sqlx::query_as::<_, AsqRow>(
        "SELECT CAST(s.tanggal AS CHAR) tanggal, s.asq1, s.asq2, s.asq3, s.asq4, s.asq5, \
                IFNULL(s.asq4_deskripsi,'') ket4, IFNULL(s.asq5_deskripsi,'') ket5, \
                IFNULL(s.kesimpulan,'') kesimpulan, IFNULL(pg.nama, s.nip) petugas, (s.nip = ? OR ? = 1) milik \
         FROM skrining_asq s LEFT JOIN pegawai pg ON pg.nik = s.nip \
         WHERE s.no_rawat = ? ORDER BY s.tanggal DESC LIMIT 100"
    ).bind(&user.0.kode).bind(admin).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct AsqBody {
    pub no_rawat: String,
    #[serde(default)] pub asq1: String,
    #[serde(default)] pub asq2: String,
    #[serde(default)] pub asq3: String,
    #[serde(default)] pub asq4: String,
    #[serde(default)] pub asq5: String,
    #[serde(default)] pub ket4: String,
    #[serde(default)] pub ket5: String,
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub orig_tanggal: String,
    #[serde(default)] pub waktu: String,
}
pub async fn asq_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<AsqBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "penilaian_tambahan_bunuh_diri").await?;
    let ya = |s: &str| s.trim().eq_ignore_ascii_case("Ya");
    let norm = |s: &str| if ya(s) { "Ya".to_string() } else { "Tidak".to_string() };
    let (a1, a2, a3, a4, a5) = (norm(&b.asq1), norm(&b.asq2), norm(&b.asq3), norm(&b.asq4), norm(&b.asq5));
    let positif = ya(&a1) || ya(&a2) || ya(&a3) || ya(&a4);
    let kesimpulan = if !positif {
        "Skrining Negatif (tidak ada risiko bunuh diri saat ini)".to_string()
    } else if ya(&a5) {
        "Positif AKUT - evaluasi keselamatan segera, jangan tinggalkan pasien sendiri".to_string()
    } else {
        "Positif Non-Akut - perlu evaluasi kesehatan jiwa lebih lanjut".to_string()
    };
    let wkt = dtopt(&b.waktu);
    if b.edit {
        let admin: i64 = if user.0.is_admin { 1 } else { 0 };
        let new_tgl = wkt.clone().unwrap_or_else(|| b.orig_tanggal.clone());
        let res = sqlx::query(
            "UPDATE skrining_asq SET tanggal=?, asq1=?, asq2=?, asq3=?, asq4=?, asq4_deskripsi=?, asq5=?, asq5_deskripsi=?, kesimpulan=? \
             WHERE no_rawat=? AND tanggal=? AND (nip=? OR ?=1)")
        .bind(&new_tgl).bind(&a1).bind(&a2).bind(&a3).bind(&a4).bind(&b.ket4).bind(&a5).bind(&b.ket5).bind(&kesimpulan)
        .bind(&b.no_rawat).bind(&b.orig_tanggal).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat mengubah"}))));
        }
        crate::audit::log_sql(&state.pool, &user.0.kode, &format!("UBAH skrining_asq no_rawat={} {}", b.no_rawat, b.orig_tanggal)).await;
        return Ok(Json(json!({"ok": true, "kesimpulan": kesimpulan})));
    }
    let tgl_expr = if wkt.is_some() { "?" } else { "NOW()" };
    let sql = format!(
        "INSERT INTO skrining_asq \
         (no_rawat, tanggal, nip, asq1, asq2, asq3, asq4, asq4_deskripsi, asq5, asq5_deskripsi, kesimpulan) \
         VALUES (?, {tgl_expr}, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    let mut q = sqlx::query(&sql).bind(&b.no_rawat);
    if let Some(t) = &wkt { q = q.bind(t); }
    q = q.bind(&user.0.kode)
        .bind(&a1).bind(&a2).bind(&a3).bind(&a4).bind(&b.ket4).bind(&a5).bind(&b.ket5).bind(&kesimpulan);
    q.execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("skrining_asq no_rawat={} kesimpulan={}", b.no_rawat, kesimpulan)).await;
    Ok(Json(json!({"ok": true, "kesimpulan": kesimpulan})))
}

// ── Asesmen Risiko Kekerasan Fisik & Melarikan Diri (RM.103) ─────────────────
// Faktor Statik (Ya=1) + Dinamis (Ya=2); total & level (Rendah<7/Sedang7-14/
// Tinggi>14) dihitung server. (kolom_nilai, kolom_skor) sesuai tabel Khanza asli
// (termasuk typo kolom skor bawaan). Hak akses per-instrumen.
type RiskCol = (&'static str, &'static str);

const KEKERASAN_STATIK: &[RiskCol] = &[
    ("statik_insiden_kekerasan_baru_ini", "statik_skorinsiden_kekerasan_baru_ini"),
    ("statik_riwayat_penggunaan_senjata", "statik_skorriwayat_penggunaan_senjata"),
    ("statik_laki_laki", "statik_skorlaki_laki"),
    ("statik_usia_dibawah_35", "statik_skorusia_dibawah_35"),
    ("statik_riwayat_kriminal", "statik_skorriwayat_kriminal"),
    ("statik_ide_kekerasan", "statik_skoride_kekerasan"),
    ("statik_kekerasan_anak_anak", "statik_skorkekerasan_anak_anak"),
    ("statik_peran_dalam_hidup", "statik_skorperan_dalam_hidup"),
    ("statik_penggunaan_napza", "statik_skorpenggunaan_napza"),
];
const KEKERASAN_DINAMIS: &[RiskCol] = &[
    ("dinamis_ide_melukai_orang_lain", "dinamis_skoride_melukai_orang_lain"),
    ("dinamis_akses_kekerasan", "dinamis_skorakses_kekerasan"),
    ("dinamis_ide_paranoid", "dinamis_skoride_paranoid"),
    ("dinamis_perintah_halusinasi", "dinamis_skorperintah_halusinasi"),
    ("dinamis_frustasi_agitasi", "dinamis_skorfrustasi_agitasi"),
    ("dinamis_kesenangan_kekerasan", "dinamis_skorkesenangan_kekerasan"),
    ("dinamis_seksual_tidak_wajar", "dinamis_skorseksual_tidak_wajar"),
    ("dinamis_hilangnya_kontrol_diri", "dinamis_skorhilangnya_kontrol_diri"),
    ("dinamis_pengguaan_napza", "dinamis_skorpengguaan_napza"),
];
const MELARIKAN_STATIK: &[RiskCol] = &[
    ("statik_riwayat_melarikan_diri", "statik_skorriwayat_melarikan_diri"),
    ("statik_riwayat_penolakan_pengobatan", "statik_skorriwayat_penolakan_pengobatan"),
    ("statik_usia_dibawah_35", "statik_skorusia_dibawah_35"),
    ("statik_laki_laki", "statik_skorlaki_laki"),
    ("statik_diagnosis_skizofrenia", "statik_skordiagnosis_skizofrenia"),
    ("statik_belum_menikah", "statik_skorbelum_menikah"),
    ("statik_riwayat_penggunaan_napza", "statik_skoriwayat_penggunaan_napza"),
    ("statik_diagnosis_gangguan_kepribadian", "statik_skordiagnosis_gangguan_kepribadian"),
    ("statik_riwayat_kriminal", "statik_skorriwayat_kriminal"),
];
const MELARIKAN_DINAMIS: &[RiskCol] = &[
    ("dinamis_anti_treatment", "dinamis_skoranti_treatment"),
    ("dinamis_penggunaan_napza", "dinamis_skorpenggunaan_napza"),
    ("dinamis_kebosanan", "dinamis_skorkebosanan"),
    ("dinamis_perintah_halusinasi", "dinamis_skorperintah_halusinasi"),
    ("dinamis_hilangnya_kontrol_diri", "dinamis_skorhilangnya_kontrol_diri"),
    ("dinamis_seksual_tidak_wajar", "dinamis_skorseksual_tidak_wajar"),
    ("dinamis_kemarahan_frustasi", "dinamis_skorkemarahan_frustasi"),
    ("dinamis_ketakutan_perawatan", "dinamis_skorketakutan_perawatan"),
];

fn norm_yatidak(s: &str) -> String {
    let t = s.trim();
    if t.eq_ignore_ascii_case("Ya") { "Ya".into() }
    else if t.eq_ignore_ascii_case("Tidak Tahu") { "Tidak Tahu".into() }
    else { "Tidak".into() }
}

#[derive(Serialize, sqlx::FromRow)]
pub struct RiskRow {
    pub tanggal: Option<String>,
    pub statik_total: i32,
    pub dinamis_total: i32,
    pub total: i32,
    pub level: String,
    pub pencegahan: String,
    pub petugas: String,
    #[sqlx(default)] pub milik: i64,
}
async fn risiko_list(state: &AppState, user: &AuthUser, table: &str, no_rawat: &str)
  -> Result<Vec<RiskRow>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let sql = format!(
        "SELECT CAST(s.tanggal AS CHAR) tanggal, IFNULL(s.statik_skortotal,0) statik_total, \
                IFNULL(s.dinamis_skortotal,0) dinamis_total, IFNULL(s.total_skor,0) total, \
                IFNULL(s.level_skor,'') level, IFNULL(s.faktor_faktor_pencegahan,'') pencegahan, \
                IFNULL(pg.nama, s.nip) petugas, (s.nip = ? OR ? = 1) milik \
         FROM {table} s LEFT JOIN pegawai pg ON pg.nik = s.nip \
         WHERE s.no_rawat = ? ORDER BY s.tanggal DESC LIMIT 100"
    );
    sqlx::query_as::<_, RiskRow>(&sql).bind(&user.0.kode).bind(admin).bind(no_rawat).fetch_all(&state.pool).await.map_err(db_err)
}

// Detail satu penilaian risiko (jawaban per pertanyaan) untuk Edit-in-place.
async fn risiko_detail(state: &AppState, user: &AuthUser, table: &str,
    statik: &[RiskCol], dinamis: &[RiskCol], no_rawat: &str, tanggal: &str)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut sel: Vec<String> = Vec::new();
    for (val, _) in statik.iter() { sel.push(format!("IFNULL(`{val}`,'') AS `{val}`")); }
    for (val, _) in dinamis.iter() { sel.push(format!("IFNULL(`{val}`,'') AS `{val}`")); }
    let sql = format!("SELECT {}, IFNULL(faktor_faktor_pencegahan,'') faktor_faktor_pencegahan, IFNULL(nip,'') nip \
                       FROM {table} WHERE no_rawat=? AND tanggal=? LIMIT 1", sel.join(", "));
    let row = sqlx::query(&sql).bind(no_rawat).bind(tanggal).fetch_optional(&state.pool).await.map_err(db_err)?;
    let Some(row) = row else { return Ok(Json(Value::Null)); };
    use sqlx::Row;
    let statik_ans: Vec<Value> = statik.iter().map(|(val, _)| Value::String(row.try_get::<String,_>(*val).unwrap_or_default())).collect();
    let dinamis_ans: Vec<Value> = dinamis.iter().map(|(val, _)| Value::String(row.try_get::<String,_>(*val).unwrap_or_default())).collect();
    let pencegahan: String = row.try_get("faktor_faktor_pencegahan").unwrap_or_default();
    let owner: String = row.try_get("nip").unwrap_or_default();
    let dapat_edit = user.0.is_admin || owner == user.0.kode;
    Ok(Json(json!({"statik": statik_ans, "dinamis": dinamis_ans, "pencegahan": pencegahan, "dapat_edit": dapat_edit})))
}

#[derive(Deserialize)]
pub struct RiskBody {
    pub no_rawat: String,
    #[serde(default)] pub statik: Vec<String>,   // jawaban Ya/Tidak/Tidak Tahu (urut sesuai daftar)
    #[serde(default)] pub dinamis: Vec<String>,
    #[serde(default)] pub pencegahan: String,
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub orig_tanggal: String,
    #[serde(default)] pub waktu: String,
}
#[derive(Deserialize)]
pub struct RiskDetailQuery { pub no_rawat: String, pub tanggal: String }
async fn simpan_risiko(
    state: &AppState, user: &AuthUser, table: &str,
    statik: &[RiskCol], dinamis: &[RiskCol], b: &RiskBody,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let wkt = dtopt(&b.waktu);
    let mut cols = String::from("no_rawat, tanggal, nip");
    let mut ph = format!("?, {}, ?", if wkt.is_some() { "?" } else { "NOW()" });
    // Kumpulkan nilai + skor
    let mut ans_bind: Vec<String> = Vec::new();
    let mut score_bind: Vec<i32> = Vec::new();
    let mut statik_total = 0i32;
    for (i, (val, score)) in statik.iter().enumerate() {
        let a = norm_yatidak(b.statik.get(i).map(|s| s.as_str()).unwrap_or("Tidak"));
        let sc = if a == "Ya" { 1 } else { 0 };
        statik_total += sc;
        cols.push_str(&format!(", {val}, {score}"));
        ph.push_str(", ?, ?");
        ans_bind.push(a); score_bind.push(sc);
    }
    cols.push_str(", statik_skortotal"); ph.push_str(", ?");
    let mut dinamis_total = 0i32;
    let mut ans_bind2: Vec<String> = Vec::new();
    let mut score_bind2: Vec<i32> = Vec::new();
    for (i, (val, score)) in dinamis.iter().enumerate() {
        let a = norm_yatidak(b.dinamis.get(i).map(|s| s.as_str()).unwrap_or("Tidak"));
        let sc = if a == "Ya" { 2 } else { 0 };
        dinamis_total += sc;
        cols.push_str(&format!(", {val}, {score}"));
        ph.push_str(", ?, ?");
        ans_bind2.push(a); score_bind2.push(sc);
    }
    cols.push_str(", dinamis_skortotal, faktor_faktor_pencegahan, total_skor, level_skor");
    ph.push_str(", ?, ?, ?, ?");
    let total = statik_total + dinamis_total;
    let level = if total > 14 { "Tinggi(>14)" } else if total >= 7 { "Sedang(7-14)" } else { "Rendah(<7)" };

    // Edit-in-place: UPDATE baris lama (key no_rawat+tanggal_asli) milik user.
    if b.edit && !b.orig_tanggal.trim().is_empty() {
        let admin: i64 = if user.0.is_admin { 1 } else { 0 };
        let new_tgl = wkt.clone().unwrap_or_else(|| b.orig_tanggal.clone());
        let mut sets: Vec<String> = vec!["tanggal=?".into()];
        for (val, score) in statik.iter() { sets.push(format!("`{val}`=?")); sets.push(format!("`{score}`=?")); }
        sets.push("statik_skortotal=?".into());
        for (val, score) in dinamis.iter() { sets.push(format!("`{val}`=?")); sets.push(format!("`{score}`=?")); }
        sets.push("dinamis_skortotal=?".into());
        sets.push("faktor_faktor_pencegahan=?".into());
        sets.push("total_skor=?".into());
        sets.push("level_skor=?".into());
        let sql = format!("UPDATE {table} SET {} WHERE no_rawat=? AND tanggal=? AND (nip=? OR ?=1)", sets.join(", "));
        let mut q = sqlx::query(&sql).bind(&new_tgl);
        for (a, sc) in ans_bind.iter().zip(score_bind.iter()) { q = q.bind(a).bind(*sc); }
        q = q.bind(statik_total);
        for (a, sc) in ans_bind2.iter().zip(score_bind2.iter()) { q = q.bind(a).bind(*sc); }
        q = q.bind(dinamis_total).bind(&b.pencegahan).bind(total).bind(level);
        q = q.bind(&b.no_rawat).bind(&b.orig_tanggal).bind(&user.0.kode).bind(admin);
        let res = q.execute(&state.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat mengubah"}))));
        }
        crate::audit::log_sql(&state.pool, &user.0.kode, &format!("UBAH {table} no_rawat={} {} total={}", b.no_rawat, b.orig_tanggal, total)).await;
        return Ok(Json(json!({"ok": true, "statik_total": statik_total, "dinamis_total": dinamis_total, "total": total, "level": level})));
    }

    let sql = format!("INSERT INTO {table} ({cols}) VALUES ({ph})");
    let mut q = sqlx::query(&sql).bind(&b.no_rawat);
    if let Some(t) = &wkt { q = q.bind(t); }
    q = q.bind(&user.0.kode);
    for (a, sc) in ans_bind.iter().zip(score_bind.iter()) { q = q.bind(a).bind(*sc); }
    q = q.bind(statik_total);
    for (a, sc) in ans_bind2.iter().zip(score_bind2.iter()) { q = q.bind(a).bind(*sc); }
    q = q.bind(dinamis_total).bind(&b.pencegahan).bind(total).bind(level);
    q.execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("{table} no_rawat={} total={} level={}", b.no_rawat, total, level)).await;
    Ok(Json(json!({"ok": true, "statik_total": statik_total, "dinamis_total": dinamis_total, "total": total, "level": level})))
}

pub async fn kekerasan_list(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Vec<RiskRow>>, (StatusCode, Json<Value>)> {
    Ok(Json(risiko_list(&state, &user, "penilaian_tambahan_perilaku_kekerasan", &q.no_rawat).await?))
}
pub async fn kekerasan_detail(user: AuthUser, State(state): State<AppState>, Query(q): Query<RiskDetailQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    risiko_detail(&state, &user, "penilaian_tambahan_perilaku_kekerasan", KEKERASAN_STATIK, KEKERASAN_DINAMIS, &q.no_rawat, &q.tanggal).await
}
pub async fn kekerasan_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<RiskBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "penilaian_tambahan_perilaku_kekerasan").await?;
    simpan_risiko(&state, &user, "penilaian_tambahan_perilaku_kekerasan", KEKERASAN_STATIK, KEKERASAN_DINAMIS, &b).await
}
pub async fn melarikan_list(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Vec<RiskRow>>, (StatusCode, Json<Value>)> {
    Ok(Json(risiko_list(&state, &user, "penilaian_tambahan_beresiko_melarikan_diri", &q.no_rawat).await?))
}
pub async fn melarikan_detail(user: AuthUser, State(state): State<AppState>, Query(q): Query<RiskDetailQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    risiko_detail(&state, &user, "penilaian_tambahan_beresiko_melarikan_diri", MELARIKAN_STATIK, MELARIKAN_DINAMIS, &q.no_rawat, &q.tanggal).await
}
pub async fn melarikan_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<RiskBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "penilaian_tambahan_beresiko_melarikan_diri").await?;
    simpan_risiko(&state, &user, "penilaian_tambahan_beresiko_melarikan_diri", MELARIKAN_STATIK, MELARIKAN_DINAMIS, &b).await
}

// ── Pengkajian Keperawatan Pasien ICU (Comprehensive Admission Assessment) ────
// Form RM.012 — seksi A..T disimpan sebagai blob JSON di kolom `data`;
// gizi_skor (MST) disimpan terpisah untuk pelaporan. Hak akses checklist_kriteria_masuk_icu.
pub async fn pengkajian_icu_get(_user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row: Option<(String, String, i32)> = sqlx::query_as(
        "SELECT IFNULL(data,'{}'), CAST(tanggal AS CHAR), IFNULL(gizi_skor,0) \
         FROM pengkajian_keperawatan_icu WHERE no_rawat = ? ORDER BY id DESC LIMIT 1"
    ).bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    match row {
        None => Ok(Json(json!({"exists": false}))),
        Some((data, tanggal, gizi)) => {
            let d: Value = serde_json::from_str(&data).unwrap_or_else(|_| json!({}));
            Ok(Json(json!({"exists": true, "tanggal": tanggal, "gizi_skor": gizi, "data": d})))
        }
    }
}

#[derive(Deserialize)]
pub struct PengkajianIcuBody {
    pub no_rawat: String,
    #[serde(default)] pub data: Value,
    #[serde(default)] pub gizi_skor: i32,
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub orig_tanggal: String,
    #[serde(default)] pub waktu: String,
}
pub async fn pengkajian_icu_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<PengkajianIcuBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "checklist_kriteria_masuk_icu").await?;
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    let data_str = serde_json::to_string(&b.data).unwrap_or_else(|_| "{}".into());
    let wkt = dtopt(&b.waktu);
    if b.edit && !b.orig_tanggal.trim().is_empty() {
        let admin: i64 = if user.0.is_admin { 1 } else { 0 };
        let new_tgl = wkt.clone().unwrap_or_else(|| b.orig_tanggal.clone());
        let res = sqlx::query(
            "UPDATE pengkajian_keperawatan_icu SET tanggal=?, data=?, gizi_skor=? WHERE no_rawat=? AND tanggal=? AND (nip=? OR ?=1)")
            .bind(&new_tgl).bind(&data_str).bind(b.gizi_skor).bind(&b.no_rawat).bind(&b.orig_tanggal).bind(&user.0.kode).bind(admin)
            .execute(&state.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat mengubah"}))));
        }
        crate::audit::log_sql(&state.pool, &user.0.kode, &format!("UBAH pengkajian_keperawatan_icu no_rawat={} {}", b.no_rawat, b.orig_tanggal)).await;
        return Ok(Json(json!({"ok": true})));
    }
    let tgl_expr = if wkt.is_some() { "?" } else { "NOW()" };
    let sql = format!(
        "INSERT INTO pengkajian_keperawatan_icu (no_rawat, tanggal, nip, data, gizi_skor, created_at) \
         VALUES (?, {tgl_expr}, ?, ?, ?, NOW())");
    let mut q = sqlx::query(&sql).bind(&b.no_rawat);
    if let Some(t) = &wkt { q = q.bind(t); }
    q = q.bind(&user.0.kode).bind(&data_str).bind(b.gizi_skor);
    q.execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("pengkajian_keperawatan_icu no_rawat={} gizi={}", b.no_rawat, b.gizi_skor)).await;
    Ok(Json(json!({"ok": true})))
}

// Datetime dari input HTML (YYYY-MM-DDTHH:MM) → "YYYY-MM-DD HH:MM:00"; kosong → NULL.
fn dtopt(s: &str) -> Option<String> {
    let t = s.trim();
    if t.is_empty() { return None; }
    let t = t.replace('T', " ");
    Some(if t.len() == 16 { format!("{t}:00") } else { t })
}
// Datetime-local "YYYY-MM-DDTHH:MM[:SS]" → (tanggal "YYYY-MM-DD", jam "HH:MM:SS"); kosong → None.
fn split_dt(s: &str) -> Option<(String, String)> {
    let full = dtopt(s)?;               // "YYYY-MM-DD HH:MM:SS"
    let (d, t) = full.split_once(' ')?;
    Some((d.to_string(), t.to_string()))
}
fn norm_enum(v: &str, opts: &[&str]) -> String {
    if opts.iter().any(|o| *o == v) { v.to_string() } else { opts[0].to_string() }
}

// ── Kriteria Masuk ICU — REVISI RM.KEP.08.052.2022 (form terpisah, utk review) ──
// Prioritas 1-4 (checkbox) + skor EWS/qSofa/APACHE II + header (asal ruangan, DPJP,
// dokter konsultan, diagnosa). Semua disimpan blob JSON di kriteria_masuk_icu_2022.
// Append per tanggal; owner-only (nip) + Edit-in-place + tanggal/jam dibuat editable.
// Hak akses reuse: checklist_kriteria_masuk_icu.
#[derive(Serialize, sqlx::FromRow)]
pub struct KmIcu2022Row {
    pub tanggal: Option<String>,
    pub petugas: String,
    #[sqlx(default)] pub milik: i64,
}
pub async fn km_icu2022_list(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Vec<KmIcu2022Row>>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let rows = sqlx::query_as::<_, KmIcu2022Row>(
        "SELECT CAST(s.tanggal AS CHAR) tanggal, IFNULL(pg.nama, s.nip) petugas, (s.nip = ? OR ? = 1) milik \
         FROM kriteria_masuk_icu_2022 s LEFT JOIN pegawai pg ON pg.nik = s.nip \
         WHERE s.no_rawat = ? ORDER BY s.id DESC LIMIT 50"
    ).bind(&user.0.kode).bind(admin).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct KmIcu2022DetailQuery { pub no_rawat: String, pub tanggal: String }
pub async fn km_icu2022_detail(user: AuthUser, State(state): State<AppState>, Query(q): Query<KmIcu2022DetailQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT IFNULL(data,'{}'), IFNULL(nip,'') FROM kriteria_masuk_icu_2022 \
         WHERE no_rawat = ? AND tanggal = ? ORDER BY id DESC LIMIT 1"
    ).bind(&q.no_rawat).bind(&q.tanggal).fetch_optional(&state.pool).await.map_err(db_err)?;
    match row {
        None => Ok(Json(Value::Null)),
        Some((data, owner)) => {
            let d: Value = serde_json::from_str(&data).unwrap_or_else(|_| json!({}));
            Ok(Json(json!({"data": d, "dapat_edit": user.0.is_admin || owner == user.0.kode})))
        }
    }
}
#[derive(Deserialize)]
pub struct KmIcu2022Body {
    pub no_rawat: String,
    #[serde(default)] pub data: Value,
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub orig_tanggal: String,
    #[serde(default)] pub waktu: String,
}
pub async fn km_icu2022_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<KmIcu2022Body>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Form dokter (E-Dokter) — cukup autentikasi + owner-lock; tanpa gate kolom perawat.
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    let data_str = serde_json::to_string(&b.data).unwrap_or_else(|_| "{}".into());
    let wkt = dtopt(&b.waktu);
    if b.edit && !b.orig_tanggal.trim().is_empty() {
        let admin: i64 = if user.0.is_admin { 1 } else { 0 };
        let new_tgl = wkt.clone().unwrap_or_else(|| b.orig_tanggal.clone());
        let res = sqlx::query(
            "UPDATE kriteria_masuk_icu_2022 SET tanggal=?, data=? WHERE no_rawat=? AND tanggal=? AND (nip=? OR ?=1)")
            .bind(&new_tgl).bind(&data_str).bind(&b.no_rawat).bind(&b.orig_tanggal).bind(&user.0.kode).bind(admin)
            .execute(&state.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat mengubah"}))));
        }
        crate::audit::log_sql(&state.pool, &user.0.kode, &format!("UBAH kriteria_masuk_icu_2022 no_rawat={} {}", b.no_rawat, b.orig_tanggal)).await;
        return Ok(Json(json!({"ok": true})));
    }
    let tgl_expr = if wkt.is_some() { "?" } else { "NOW()" };
    let sql = format!("INSERT INTO kriteria_masuk_icu_2022 (no_rawat, tanggal, nip, data, created_at) VALUES (?, {tgl_expr}, ?, ?, NOW())");
    let mut qy = sqlx::query(&sql).bind(&b.no_rawat);
    if let Some(t) = &wkt { qy = qy.bind(t); }
    qy = qy.bind(&user.0.kode).bind(&data_str);
    qy.execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("kriteria_masuk_icu_2022 no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}
pub async fn km_icu2022_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<NyeriDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> { hapus_by_tgl(&state, &user, "kriteria_masuk_icu_2022", &b).await }

// ── Formulir Tindakan Intubasi & Ventilator (ICU) ────────────────────────────
// Adopsi RMFormulirIntubasiVentilatorRscb — append log per (no_rawat, tanggal).
#[derive(Serialize, sqlx::FromRow)]
pub struct IntubasiRow {
    pub tanggal: Option<String>,
    pub diagnosa: String,
    pub indikasi_pemasangan: String,
    pub tgl_intubasi: Option<String>,
    pub tgl_pasang_ventilator: Option<String>,
    pub tgl_extubasi: Option<String>,
    pub tgl_lepas_ventilator: Option<String>,
    pub tekanan_darah: String,
    pub nadi: String,
    pub respiratory_rate: String,
    pub saturasi_o2: String,
    pub mode_ventilator: String,
    pub fio2: String,
    pub peep: String,
    pub ie_ratio: String,
    pub dokter: String,
    pub petugas: String,
    #[sqlx(default)] pub milik: i64,
}
pub async fn intubasi_list(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Vec<IntubasiRow>>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let rows = sqlx::query_as::<_, IntubasiRow>(
        "SELECT CAST(f.tanggal AS CHAR) tanggal, IFNULL(f.diagnosa,'') diagnosa, IFNULL(f.indikasi_pemasangan,'') indikasi_pemasangan, \
                CAST(f.tgl_intubasi AS CHAR) tgl_intubasi, CAST(f.tgl_pasang_ventilator AS CHAR) tgl_pasang_ventilator, \
                CAST(f.tgl_extubasi AS CHAR) tgl_extubasi, CAST(f.tgl_lepas_ventilator AS CHAR) tgl_lepas_ventilator, \
                IFNULL(f.tekanan_darah,'') tekanan_darah, IFNULL(f.nadi,'') nadi, IFNULL(f.respiratory_rate,'') respiratory_rate, \
                IFNULL(f.saturasi_o2,'') saturasi_o2, IFNULL(f.mode_ventilator,'') mode_ventilator, IFNULL(f.fio2,'') fio2, \
                IFNULL(f.peep,'') peep, IFNULL(f.ie_ratio,'') ie_ratio, \
                IFNULL(d.nm_dokter,'') dokter, IFNULL(pg.nama, f.nip) petugas, (f.nip = ? OR ? = 1) milik \
         FROM formulir_intubasi_ventilator_rscb f \
         LEFT JOIN dokter d ON d.kd_dokter = f.kd_dokter \
         LEFT JOIN pegawai pg ON pg.nik = f.nip \
         WHERE f.no_rawat = ? ORDER BY f.tanggal DESC LIMIT 100"
    ).bind(&user.0.kode).bind(admin).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct IntubasiBody {
    pub no_rawat: String,
    #[serde(default)] pub diagnosa: String,
    #[serde(default)] pub indikasi_pemasangan: String,
    #[serde(default)] pub tgl_intubasi: String,
    #[serde(default)] pub tgl_pasang_ventilator: String,
    #[serde(default)] pub tgl_extubasi: String,
    #[serde(default)] pub tgl_lepas_ventilator: String,
    #[serde(default)] pub tekanan_darah: String,
    #[serde(default)] pub nadi: String,
    #[serde(default)] pub respiratory_rate: String,
    #[serde(default)] pub saturasi_o2: String,
    #[serde(default)] pub mode_ventilator: String,
    #[serde(default)] pub fio2: String,
    #[serde(default)] pub peep: String,
    #[serde(default)] pub ie_ratio: String,
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub orig_tanggal: String,
    #[serde(default)] pub waktu: String,
}
pub async fn intubasi_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<IntubasiBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "tindakan_ranap").await?;
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    let wkt = dtopt(&b.waktu);
    if b.edit {
        let admin: i64 = if user.0.is_admin { 1 } else { 0 };
        let new_tgl = wkt.clone().unwrap_or_else(|| b.orig_tanggal.clone());
        let res = sqlx::query(
            "UPDATE formulir_intubasi_ventilator_rscb SET tanggal=?, diagnosa=?, indikasi_pemasangan=?, tgl_intubasi=?, tgl_pasang_ventilator=?, tgl_extubasi=?, tgl_lepas_ventilator=?, tekanan_darah=?, nadi=?, respiratory_rate=?, saturasi_o2=?, mode_ventilator=?, fio2=?, peep=?, ie_ratio=? \
             WHERE no_rawat=? AND tanggal=? AND (nip=? OR ?=1)")
        .bind(&new_tgl).bind(&b.diagnosa).bind(&b.indikasi_pemasangan)
        .bind(dtopt(&b.tgl_intubasi)).bind(dtopt(&b.tgl_pasang_ventilator)).bind(dtopt(&b.tgl_extubasi)).bind(dtopt(&b.tgl_lepas_ventilator))
        .bind(&b.tekanan_darah).bind(&b.nadi).bind(&b.respiratory_rate).bind(&b.saturasi_o2)
        .bind(&b.mode_ventilator).bind(&b.fio2).bind(&b.peep).bind(&b.ie_ratio)
        .bind(&b.no_rawat).bind(&b.orig_tanggal).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat mengubah"}))));
        }
        crate::audit::log_sql(&state.pool, &user.0.kode, &format!("UBAH formulir_intubasi_ventilator no_rawat={} {}", b.no_rawat, b.orig_tanggal)).await;
        return Ok(Json(json!({"ok": true})));
    }
    let kd_dokter: String = sqlx::query_scalar("SELECT kd_dokter FROM reg_periksa WHERE no_rawat = ?")
        .bind(&b.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?.unwrap_or_default();
    let tgl_expr = if wkt.is_some() { "?" } else { "NOW()" };
    let sql = format!(
        "INSERT INTO formulir_intubasi_ventilator_rscb \
         (no_rawat, tanggal, diagnosa, kd_dokter, indikasi_pemasangan, tgl_intubasi, tgl_pasang_ventilator, \
          tgl_extubasi, tgl_lepas_ventilator, tekanan_darah, nadi, respiratory_rate, saturasi_o2, \
          mode_ventilator, fio2, peep, ie_ratio, nip) \
         VALUES (?, {tgl_expr}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    let mut q = sqlx::query(&sql).bind(&b.no_rawat);
    if let Some(t) = &wkt { q = q.bind(t); }
    q = q.bind(&b.diagnosa).bind(&kd_dokter).bind(&b.indikasi_pemasangan)
        .bind(dtopt(&b.tgl_intubasi)).bind(dtopt(&b.tgl_pasang_ventilator))
        .bind(dtopt(&b.tgl_extubasi)).bind(dtopt(&b.tgl_lepas_ventilator))
        .bind(&b.tekanan_darah).bind(&b.nadi).bind(&b.respiratory_rate).bind(&b.saturasi_o2)
        .bind(&b.mode_ventilator).bind(&b.fio2).bind(&b.peep).bind(&b.ie_ratio).bind(&user.0.kode);
    q.execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("formulir_intubasi_ventilator no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}
pub async fn intubasi_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<NyeriDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let res = sqlx::query("DELETE FROM formulir_intubasi_ventilator_rscb WHERE no_rawat=? AND tanggal=? AND (nip=? OR ?=1)")
        .bind(&b.no_rawat).bind(&b.tanggal).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat menghapus"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS formulir_intubasi_ventilator no_rawat={} {}", b.no_rawat, b.tanggal)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Transfer Antar Ruang (transfer_internal_rs) ──────────────────────────────
// Adopsi RMTransferInternalRs — append log per (no_rawat, tanggal_masuk).
const KESADARAN: &[&str] = &["Compos Mentis", "Gelisah", "Delirium", "Koma"];
const DERAJAT: &[&str] = &["Derajat 0", "Derajat 1", "Derajat 2", "Derajat 3"];
#[derive(Serialize, sqlx::FromRow)]
pub struct TransferRow {
    pub tanggal_masuk: Option<String>,
    pub tanggal_pindah: Option<String>,
    pub asal_ruang: String,
    pub ruang_selanjutnya: String,
    pub derajat: String,
    pub diagnosa_sekarang: String,
    pub dpjp: String,
    pub petugas: String,
    #[sqlx(default)] pub milik: i64,
}
pub async fn transfer_list(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Vec<TransferRow>>, (StatusCode, Json<Value>)> {
    // Transfer antar ruang = dokumen milik-bersama: siapa pun dengan akses
    // tindakan_ranap boleh edit (mis. perawat penerima di ruang tujuan), bukan
    // hanya pembuat/penerima yang tercatat.
    let can_edit: i64 = if perm_granted(&state, &user, "tindakan_ranap").await { 1 } else { 0 };
    let rows = sqlx::query_as::<_, TransferRow>(
        "SELECT CAST(t.tanggal_masuk AS CHAR) tanggal_masuk, CAST(t.tanggal_pindah AS CHAR) tanggal_pindah, \
                IFNULL(t.asal_ruang,'') asal_ruang, IFNULL(t.ruang_selanjutnya,'') ruang_selanjutnya, \
                IFNULL(t.derajat,'') derajat, IFNULL(t.diagnosa_sekarang,'') diagnosa_sekarang, \
                IFNULL(d.nm_dokter, t.dpjp) dpjp, IFNULL(pg.nama, t.nip_menyerahkan) petugas, \
                (t.nip_menyerahkan = ? OR t.nip_menerima = ? OR ? = 1) milik \
         FROM transfer_internal_rs t \
         LEFT JOIN dokter d ON d.kd_dokter = t.dpjp \
         LEFT JOIN pegawai pg ON pg.nik = t.nip_menyerahkan \
         WHERE t.no_rawat = ? ORDER BY t.tanggal_masuk DESC LIMIT 100"
    ).bind(&user.0.kode).bind(&user.0.kode).bind(can_edit).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// Detail satu transfer (untuk Edit-in-place): semua kolom form + dapat_edit.
#[derive(Deserialize)]
pub struct TransferDetailQuery { pub no_rawat: String, pub tanggal_masuk: String }
pub async fn transfer_detail(user: AuthUser, State(state): State<AppState>, Query(q): Query<TransferDetailQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    const COLS: &[&str] = &["asal_ruang","ruang_selanjutnya","dpjp","konsulen","diagnosa_masuk","diagnosa_sekarang","alergi","derajat","pendamping",
        "keadaan_umum_sebelum_transfer","keadaan_umum_sesudah_transfer","kesadaran_sebelum_transfer","kesadaran_sesudah_transfer",
        "td_sebelum_transfer","td_sesudah_transfer","nadi_sebelum_transfer","nadi_sesudah_transfer","suhu_sebelum_transfer","suhu_sesudah_transfer",
        "pernapasan_sebelum_transfer","pernapasan_sesudah_transfer","saturasi_sebelum_transfer","saturasi_sesudah_transfer","catatan_sebelum_transfer","catatan_sesudah_transfer",
        "diet","keseimbangan_cairan","mobilisasi","perawatan_luka","iv","oksigen","kateter","syring","ngt","dekubitus",
        "infus","cvp","drain","lain","lab","radiologi","ctscan","obat_infus","injeksi","oral","rekammedis","nip_menerima"];
    let sel = COLS.iter().map(|c| format!("IFNULL(`{c}`,'') AS `{c}`")).collect::<Vec<_>>().join(", ");
    let sql = format!("SELECT {sel}, CAST(tanggal_pindah AS CHAR) tanggal_pindah, IFNULL(nip_menyerahkan,'') nip_menyerahkan \
                       FROM transfer_internal_rs WHERE no_rawat = ? AND tanggal_masuk = ? LIMIT 1");
    let row = sqlx::query(&sql).bind(&q.no_rawat).bind(&q.tanggal_masuk).fetch_optional(&state.pool).await.map_err(db_err)?;
    let Some(row) = row else { return Ok(Json(Value::Null)); };
    use sqlx::Row;
    let mut values = serde_json::Map::new();
    for c in COLS {
        let v: String = row.try_get(*c).unwrap_or_default();
        values.insert((*c).to_string(), Value::String(v));
    }
    let tgl_pindah: String = row.try_get("tanggal_pindah").unwrap_or_default();
    values.insert("tanggal_pindah".to_string(), Value::String(tgl_pindah));
    let owner: String = row.try_get("nip_menyerahkan").unwrap_or_default();
    let penerima: String = row.try_get("nip_menerima").unwrap_or_default();
    let dapat_edit = perm_granted(&state, &user, "tindakan_ranap").await
        || owner == user.0.kode || penerima == user.0.kode;
    Ok(Json(json!({"values": values, "dapat_edit": dapat_edit})))
}
#[derive(Deserialize)]
pub struct TransferBody {
    pub no_rawat: String,
    #[serde(default)] pub values: std::collections::HashMap<String, String>,
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub orig_tanggal_masuk: String,
}
pub async fn transfer_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<TransferBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "tindakan_ranap").await?;
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    let g = |k: &str| b.values.get(k).map(|s| s.trim().to_string()).unwrap_or_default();
    let derajat = norm_enum(&g("derajat"), DERAJAT);
    let kes_seb = norm_enum(&g("kesadaran_sebelum_transfer"), KESADARAN);
    let kes_ses = norm_enum(&g("kesadaran_sesudah_transfer"), KESADARAN);
    let rekammedis = norm_enum(&g("rekammedis"), &["Tidak", "Ada"]);
    let wkt = dtopt(&g("waktu")); // tanggal_masuk (dibuat) dari input, opsional
    if b.edit {
        // Sudah lolos require_perm(tindakan_ranap) di atas → boleh edit walau bukan
        // pembuat/penerima (transfer = dokumen milik-bersama).
        let can_edit: i64 = 1;
        let new_tgl = wkt.clone().unwrap_or_else(|| b.orig_tanggal_masuk.clone());
        let res = sqlx::query(
            "UPDATE transfer_internal_rs SET tanggal_masuk=?, tanggal_pindah=?, asal_ruang=?, ruang_selanjutnya=?, dpjp=?, konsulen=?, \
             diagnosa_masuk=?, diagnosa_sekarang=?, alergi=?, derajat=?, pendamping=?, \
             keadaan_umum_sebelum_transfer=?, keadaan_umum_sesudah_transfer=?, kesadaran_sebelum_transfer=?, kesadaran_sesudah_transfer=?, \
             td_sebelum_transfer=?, td_sesudah_transfer=?, nadi_sebelum_transfer=?, nadi_sesudah_transfer=?, \
             suhu_sebelum_transfer=?, suhu_sesudah_transfer=?, pernapasan_sebelum_transfer=?, pernapasan_sesudah_transfer=?, \
             saturasi_sebelum_transfer=?, saturasi_sesudah_transfer=?, catatan_sebelum_transfer=?, catatan_sesudah_transfer=?, \
             diet=?, keseimbangan_cairan=?, mobilisasi=?, perawatan_luka=?, iv=?, oksigen=?, kateter=?, syring=?, ngt=?, dekubitus=?, \
             infus=?, cvp=?, drain=?, lain=?, lab=?, radiologi=?, ctscan=?, obat_infus=?, injeksi=?, oral=?, rekammedis=?, nip_menerima=? \
             WHERE no_rawat=? AND tanggal_masuk=? AND (nip_menyerahkan=? OR nip_menerima=? OR ?=1)")
            .bind(&new_tgl).bind(dtopt(&g("tanggal_pindah")))
            .bind(g("asal_ruang")).bind(g("ruang_selanjutnya")).bind(g("dpjp")).bind(g("konsulen"))
            .bind(g("diagnosa_masuk")).bind(g("diagnosa_sekarang")).bind(g("alergi")).bind(&derajat).bind(g("pendamping"))
            .bind(g("keadaan_umum_sebelum_transfer")).bind(g("keadaan_umum_sesudah_transfer")).bind(&kes_seb).bind(&kes_ses)
            .bind(g("td_sebelum_transfer")).bind(g("td_sesudah_transfer")).bind(g("nadi_sebelum_transfer")).bind(g("nadi_sesudah_transfer"))
            .bind(g("suhu_sebelum_transfer")).bind(g("suhu_sesudah_transfer")).bind(g("pernapasan_sebelum_transfer")).bind(g("pernapasan_sesudah_transfer"))
            .bind(g("saturasi_sebelum_transfer")).bind(g("saturasi_sesudah_transfer")).bind(g("catatan_sebelum_transfer")).bind(g("catatan_sesudah_transfer"))
            .bind(g("diet")).bind(g("keseimbangan_cairan")).bind(g("mobilisasi")).bind(g("perawatan_luka"))
            .bind(g("iv")).bind(g("oksigen")).bind(g("kateter")).bind(g("syring")).bind(g("ngt")).bind(g("dekubitus"))
            .bind(g("infus")).bind(g("cvp")).bind(g("drain")).bind(g("lain")).bind(g("lab")).bind(g("radiologi")).bind(g("ctscan"))
            .bind(g("obat_infus")).bind(g("injeksi")).bind(g("oral")).bind(&rekammedis).bind(g("nip_menerima"))
            .bind(&b.no_rawat).bind(&b.orig_tanggal_masuk).bind(&user.0.kode).bind(&user.0.kode).bind(can_edit)
            .execute(&state.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Data transfer tidak ditemukan / tidak berubah"}))));
        }
        crate::audit::log_sql(&state.pool, &user.0.kode, &format!("UBAH transfer_internal_rs no_rawat={} {}", b.no_rawat, b.orig_tanggal_masuk)).await;
        return Ok(Json(json!({"ok": true})));
    }
    let tglm_expr = if wkt.is_some() { "?" } else { "NOW()" };
    let ins_sql = format!(
        "INSERT INTO transfer_internal_rs \
         (no_rawat, tanggal_masuk, tanggal_pindah, asal_ruang, ruang_selanjutnya, dpjp, konsulen, \
          diagnosa_masuk, diagnosa_sekarang, alergi, derajat, pendamping, \
          keadaan_umum_sebelum_transfer, keadaan_umum_sesudah_transfer, kesadaran_sebelum_transfer, kesadaran_sesudah_transfer, \
          td_sebelum_transfer, td_sesudah_transfer, nadi_sebelum_transfer, nadi_sesudah_transfer, \
          suhu_sebelum_transfer, suhu_sesudah_transfer, pernapasan_sebelum_transfer, pernapasan_sesudah_transfer, \
          saturasi_sebelum_transfer, saturasi_sesudah_transfer, catatan_sebelum_transfer, catatan_sesudah_transfer, \
          diet, keseimbangan_cairan, mobilisasi, perawatan_luka, iv, oksigen, kateter, syring, ngt, dekubitus, \
          infus, cvp, drain, lain, lab, radiologi, ctscan, obat_infus, injeksi, oral, rekammedis, nip_menyerahkan, nip_menerima) \
         VALUES (?, {tglm_expr}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    let mut q = sqlx::query(&ins_sql).bind(&b.no_rawat);
    if let Some(t) = &wkt { q = q.bind(t); }
    q = q.bind(dtopt(&g("tanggal_pindah")))
    .bind(g("asal_ruang")).bind(g("ruang_selanjutnya")).bind(g("dpjp")).bind(g("konsulen"))
    .bind(g("diagnosa_masuk")).bind(g("diagnosa_sekarang")).bind(g("alergi")).bind(derajat).bind(g("pendamping"))
    .bind(g("keadaan_umum_sebelum_transfer")).bind(g("keadaan_umum_sesudah_transfer")).bind(kes_seb).bind(kes_ses)
    .bind(g("td_sebelum_transfer")).bind(g("td_sesudah_transfer")).bind(g("nadi_sebelum_transfer")).bind(g("nadi_sesudah_transfer"))
    .bind(g("suhu_sebelum_transfer")).bind(g("suhu_sesudah_transfer")).bind(g("pernapasan_sebelum_transfer")).bind(g("pernapasan_sesudah_transfer"))
    .bind(g("saturasi_sebelum_transfer")).bind(g("saturasi_sesudah_transfer")).bind(g("catatan_sebelum_transfer")).bind(g("catatan_sesudah_transfer"))
    .bind(g("diet")).bind(g("keseimbangan_cairan")).bind(g("mobilisasi")).bind(g("perawatan_luka"))
    .bind(g("iv")).bind(g("oksigen")).bind(g("kateter")).bind(g("syring")).bind(g("ngt")).bind(g("dekubitus"))
    .bind(g("infus")).bind(g("cvp")).bind(g("drain")).bind(g("lain")).bind(g("lab")).bind(g("radiologi")).bind(g("ctscan"))
    .bind(g("obat_infus")).bind(g("injeksi")).bind(g("oral")).bind(rekammedis).bind(&user.0.kode).bind(g("nip_menerima"));
    q.execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("transfer_internal_rs no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}
#[derive(Deserialize)]
pub struct TransferDelBody { pub no_rawat: String, pub tanggal_masuk: String }
pub async fn transfer_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<TransferDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Transfer = dokumen milik-bersama: cukup punya akses tindakan_ranap.
    require_perm(&state, &user, "tindakan_ranap").await?;
    let res = sqlx::query("DELETE FROM transfer_internal_rs WHERE no_rawat=? AND tanggal_masuk=? AND (nip_menyerahkan=? OR nip_menerima=? OR ?=1)")
        .bind(&b.no_rawat).bind(&b.tanggal_masuk).bind(&user.0.kode).bind(&user.0.kode).bind(1_i64)
        .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Data transfer tidak ditemukan"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS transfer_internal_rs no_rawat={} {}", b.no_rawat, b.tanggal_masuk)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Status Anestesi (adopsi RMStatusAnestesiNoDesign) — parity per-seksi ──────
// Tiap seksi = tabel catatan_anestesi_* sendiri, disimpan INDEPENDEN dengan
// tanggal (waktu kejadian) yang dipilih petugas — bisa beda antar seksi
// (persis desktop: tiap tab tombol Simpan sendiri + kontrol tanggal/jam).
// Hak akses: laporan_anestesi (khusus anestesi).
fn enum_opt(v: &str, opts: &[&str]) -> Option<String> {
    if opts.iter().any(|o| *o == v) { Some(v.to_string()) } else { None }
}
fn sopt(s: &str) -> Option<String> {
    let t = s.trim();
    if t.is_empty() { None } else { Some(t.to_string()) }
}
// section -> (tabel, ekspresi ringkas utk daftar)
fn sa_section(section: &str) -> Option<(&'static str, &'static str)> {
    Some(match section {
        "data_awal"        => ("catatan_anestesi_data_awal", "CONCAT_WS(' · ', NULLIF(jenis_anestesi,''), LEFT(IFNULL(diagnosa_prabedah,''),40))"),
        "pra_induksi"      => ("catatan_anestesi_pra_induksi", "CONCAT('ASA ', IFNULL(asa,'-'), ' · GCS ', IFNULL(gcs,'-'), ' · TD ', IFNULL(tensi,'-'))"),
        "premedikasi"      => ("catatan_anestesi_premedikasi", "CONCAT_WS(' · ', NULLIF(jenis_anestesi,''), NULLIF(nama_obat_anestesi,''))"),
        "umum_data_awal"   => ("catatan_anestesi_umum_data_awal", "CONCAT_WS(' · ', NULLIF(induksi,''), NULLIF(pengaturan_nafas,''))"),
        "umum_monitoring"  => ("catatan_anestesi_umum_monitoring", "CONCAT('TD ', IFNULL(tekanan_darah,'-'), ' · N ', IFNULL(nadi,'-'), ' · SpO2 ', IFNULL(spo2,'-'))"),
        "umum_keterangan"  => ("catatan_anestesi_umum_keterangan", "LEFT(IFNULL(tindakan,''),60)"),
        "blokade_regional" => ("catatan_anestesi_blokade_regional", "CONCAT_WS(' · ', NULLIF(teknik,''), NULLIF(anestesi_lokal,''))"),
        "keadaan_operasi"  => ("catatan_anestesi_keadaan_operasi", "CONCAT_WS(' · ', NULLIF(letak_penderita,''), NULLIF(airway,''), CONCAT('Op ', IFNULL(lama_operasi,'-')))"),
        "sectio_caesaria"  => ("catatan_anestesi_sectio_caesaria", "CONCAT('Bayi ', IFNULL(keadaan_bayi,'-'), ' · ', IFNULL(jenis_kelamin,'-'), ' · APGAR ', IFNULL(apgar_1_menit,'-'), '/', IFNULL(apgar_5_menit,'-'))"),
        "pasca_masuk_kamar"=> ("catatan_anestesi_pasca_anestesi_masuk_kamar", "CONCAT(IFNULL(kesadaran,'-'), ' · TD ', IFNULL(tensi,'-'), ' · SpO2 ', IFNULL(spo2,'-'))"),
        "pasca_monitoring" => ("catatan_anestesi_pasca_anestesi_monitoring", "CONCAT('TD ', IFNULL(tekanan_darah,'-'), ' · N ', IFNULL(nadi,'-'), ' · S ', IFNULL(suhu,'-'))"),
        "monitoring"       => ("catatan_anestesi_monitoring", "CONCAT('TD ', IFNULL(tekanan_darah,'-'), ' · N ', IFNULL(nadi,'-'), ' · SpO2 ', IFNULL(spo2,'-'))"),
        "catatan"          => ("catatan_anestesi_catatan", "CONCAT_WS(' · ', LEFT(IFNULL(diagnosa_pasca_bedah,''),40), CONCAT('Op ', IFNULL(lama_operasi,'-')))"),
        "masuk_kamar"      => ("catatan_anestesi_masuk_kamar", "CONCAT('Masuk ', IFNULL(jam_masuk,'-'), ' · ', IFNULL(kesadaran,'-'), ' · Bromage ', IFNULL(skor_bromage,'-'))"),
        "observasi_kamar"  => ("catatan_anestesi_observasi_kamar", "CONCAT('TD ', IFNULL(tekanan_darah,'-'), ' · N ', IFNULL(nadi,'-'), ' · VAS ', IFNULL(vas,'-'))"),
        "keluar_kamar"     => ("catatan_anestesi_keluar_kamar", "CONCAT('Keluar ', IFNULL(jam_keluar,'-'), ' → ', IFNULL(pindah_ke,'-'))"),
        "instruksi_pasca"  => ("catatan_anestesi_instruksi_pasca", "CONCAT('Pantau nadi ', IFNULL(pemantauan_nadi,'-'), ' selama ', IFNULL(selama,'-'))"),
        _ => return None,
    })
}
#[derive(Serialize, sqlx::FromRow)]
pub struct SaRingkasRow { pub tanggal: Option<String>, pub ringkas: String, pub petugas: String, #[sqlx(default)] pub milik: i64 }
#[derive(Deserialize)]
pub struct SaListQuery { pub section: String, pub no_rawat: String }
pub async fn status_anestesi_list(user: AuthUser, State(state): State<AppState>, Query(q): Query<SaListQuery>)
  -> Result<Json<Vec<SaRingkasRow>>, (StatusCode, Json<Value>)> {
    let (table, ringkas) = sa_section(&q.section)
        .ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"seksi tidak dikenal"}))))?;
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let sql = format!(
        "SELECT CAST(t.tanggal AS CHAR) tanggal, IFNULL({ringkas},'') ringkas, IFNULL(pg.nama, t.kd_petugas) petugas, \
                (t.kd_petugas = ? OR ? = 1) milik \
         FROM {table} t LEFT JOIN pegawai pg ON pg.nik = t.kd_petugas \
         WHERE t.no_rawat = ? ORDER BY t.tanggal DESC LIMIT 100");
    let rows = sqlx::query_as::<_, SaRingkasRow>(&sql).bind(&user.0.kode).bind(admin).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// Detail satu baris status anestesi (generik, CAST semua kolom → CHAR) untuk Edit-in-place.
#[derive(Deserialize)]
pub struct SaDetailQuery { pub section: String, pub no_rawat: String, pub tanggal: String }
pub async fn status_anestesi_detail(user: AuthUser, State(state): State<AppState>, Query(q): Query<SaDetailQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let (table, _) = sa_section(&q.section)
        .ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"seksi tidak dikenal"}))))?;
    let cols: Vec<(String,)> = sqlx::query_as(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS \
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? \
           AND COLUMN_NAME NOT IN ('no_rawat','tanggal','kd_petugas','id')")
        .bind(table).fetch_all(&state.pool).await.map_err(db_err)?;
    if cols.is_empty() { return Ok(Json(Value::Null)); }
    let sel = cols.iter().map(|c| format!("IFNULL(CAST(`{0}` AS CHAR),'') AS `{0}`", c.0)).collect::<Vec<_>>().join(", ");
    let sql = format!("SELECT {sel}, IFNULL(kd_petugas,'') kd_petugas FROM `{table}` WHERE no_rawat=? AND tanggal=? LIMIT 1");
    let row = sqlx::query(&sql).bind(&q.no_rawat).bind(&q.tanggal).fetch_optional(&state.pool).await.map_err(db_err)?;
    let Some(row) = row else { return Ok(Json(Value::Null)); };
    use sqlx::Row;
    let mut values = serde_json::Map::new();
    for c in &cols {
        let v: String = row.try_get(c.0.as_str()).unwrap_or_default();
        values.insert(c.0.clone(), Value::String(v));
    }
    let owner: String = row.try_get("kd_petugas").unwrap_or_default();
    let dapat_edit = user.0.is_admin || owner == user.0.kode;
    Ok(Json(json!({"values": values, "dapat_edit": dapat_edit})))
}
#[derive(Deserialize)]
pub struct StatusAnestesiBody {
    pub section: String,
    pub no_rawat: String,
    #[serde(default)] pub tanggal: String,
    #[serde(default)] pub values: std::collections::HashMap<String, String>,
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub orig_tanggal: String,
}
pub async fn status_anestesi_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<StatusAnestesiBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "laporan_anestesi").await?;
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    let Some((sa_table, _)) = sa_section(&b.section) else {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"seksi tidak dikenal"}))));
    };
    // Edit-in-place: hapus baris lama milik user (key no_rawat+tanggal_asli), lalu INSERT ulang.
    // Kunci tanggal dipertahankan bila tidak diubah → efek sama dengan UPDATE.
    if b.edit && !b.orig_tanggal.trim().is_empty() {
        let admin: i64 = if user.0.is_admin { 1 } else { 0 };
        let res = sqlx::query(&format!("DELETE FROM {sa_table} WHERE no_rawat=? AND tanggal=? AND (kd_petugas=? OR ?=1)"))
            .bind(&b.no_rawat).bind(&b.orig_tanggal).bind(&user.0.kode).bind(admin)
            .execute(&state.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat mengubah"}))));
        }
    }
    let g = |k: &str| b.values.get(k).map(|s| s.trim().to_string()).unwrap_or_default();
    let yn = |k: &str| norm_enum(&g(k), &["Tidak", "Ya"]);
    // tanggal kejadian: dari input; kosong -> NOW()
    let tanggal: String = match dtopt(&b.tanggal) {
        Some(t) => t,
        None => sqlx::query_scalar("SELECT DATE_FORMAT(NOW(),'%Y-%m-%d %H:%i:%s')").fetch_one(&state.pool).await.map_err(db_err)?,
    };
    let kd = &user.0.kode;
    match b.section.as_str() {
        "data_awal" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_data_awal (no_rawat, tanggal, kd_petugas, kd_dokter_anestesi, kd_dokter_bedah, kd_asisten_anestesi, kd_asisten_bedah, medikasi_prabedah, jenis_anestesi, diagnosa_prabedah, informed_consent, obat_anestesi, tatalaksana_jalan_nafas, mesin_anestesi, obat_emergensi, check_monitoring, suction_aparatus) \
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(kd)
            .bind(g("kd_dokter_anestesi")).bind(g("kd_dokter_bedah")).bind(g("kd_asisten_anestesi")).bind(g("kd_asisten_bedah"))
            .bind(g("medikasi_prabedah")).bind(g("jenis_anestesi")).bind(g("diagnosa_prabedah"))
            .bind(yn("informed_consent")).bind(yn("obat_anestesi")).bind(yn("tatalaksana_jalan_nafas")).bind(yn("mesin_anestesi")).bind(yn("obat_emergensi")).bind(yn("check_monitoring")).bind(yn("suction_aparatus"))
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "pra_induksi" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_pra_induksi (no_rawat, tanggal, kd_petugas, kesadaran, gcs, airway, tensi, nadi, support1, support2, respirasi, rr, kanul_nasal, o2, spo2, bb, puasa_jam, laboratorium, ekg, thorax_foto, tfp, pemeriksaan_lain, sistem_saraf, sistem_respirasi, sistem_gastro, sistem_urinaria, sistem_muskuloskeletal, sistem_metabolik, lain_lain, asa, alergi) \
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(kd)
            .bind(g("kesadaran")).bind(g("gcs")).bind(enum_opt(&g("airway"), &["Terintubasi", "Tidak Terintubasi"]))
            .bind(g("tensi")).bind(g("nadi")).bind(g("support1")).bind(g("support2"))
            .bind(enum_opt(&g("respirasi"), &["Spontan", "Bantuan", "Terkontrol"])).bind(g("rr"))
            .bind(enum_opt(&g("kanul_nasal"), &["SM", "SMNR"])).bind(g("o2")).bind(g("spo2")).bind(g("bb")).bind(g("puasa_jam"))
            .bind(g("laboratorium")).bind(g("ekg")).bind(g("thorax_foto")).bind(g("tfp")).bind(g("pemeriksaan_lain"))
            .bind(g("sistem_saraf")).bind(g("sistem_respirasi")).bind(g("sistem_gastro")).bind(g("sistem_urinaria"))
            .bind(g("sistem_muskuloskeletal")).bind(g("sistem_metabolik")).bind(g("lain_lain"))
            .bind(enum_opt(&g("asa"), &["I", "II", "III", "IV", "V", "E"]))
            .bind(enum_opt(&g("alergi"), &["Ya", "Tidak", "Tidak Diketahui"]))
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "premedikasi" => {
            let jenis_anes = norm_enum(&g("jenis_anestesi"), &["Anestesi umum", "Spinal", "Kaudal", "Blok perifer", "Epidural", "Lain-lain"]);
            sqlx::query(
                "INSERT INTO catatan_anestesi_premedikasi (no_rawat, tanggal, kd_petugas, jenis_premedikasi, nm_obat_premedikasi, dosis, jenis_anestesi, nama_obat_anestesi) \
                 VALUES (?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(kd)
            .bind(enum_opt(&g("jenis_premedikasi"), &["Oral", "IM", "IV", "Rektal"]))
            .bind(g("nm_obat_premedikasi")).bind(g("dosis")).bind(jenis_anes).bind(g("nama_obat_anestesi"))
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "umum_data_awal" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_umum_data_awal (no_rawat, tanggal, kd_petugas, induksi, induksi_ket, pengaturan_nafas, tidal_volum, rr, ie_ratio, peep, pip, fio2, teknik_khusus, teknik_khusus_ket) \
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(kd)
            .bind(enum_opt(&g("induksi"), &["Sempurna", "Eksistas", "Muntah", "Batuk", "Spasme", "Lainnya"]))
            .bind(g("induksi_ket")).bind(enum_opt(&g("pengaturan_nafas"), &["Spontan", "Assist", "Bantuan"]))
            .bind(g("tidal_volum")).bind(g("rr")).bind(g("ie_ratio")).bind(g("peep")).bind(g("pip")).bind(g("fio2"))
            .bind(enum_opt(&g("teknik_khusus"), &["Hipotermi", "Hipotensi", "Bypass", "Ventilasi satu paru"])).bind(g("teknik_khusus_ket"))
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "umum_monitoring" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_umum_monitoring (no_rawat, tanggal, kd_petugas, o2, n2o, air, volatile, sevofluran, infus, medikasi, suhu, respirasi, nadi, tekanan_darah, spo2, ekg, lain_lain, keluar_cairan_perdarahan, keluar_cairan_urin) \
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(kd)
            .bind(g("o2")).bind(g("n2o")).bind(g("air")).bind(g("volatile")).bind(g("sevofluran")).bind(g("infus")).bind(g("medikasi"))
            .bind(g("suhu")).bind(g("respirasi")).bind(g("nadi")).bind(g("tekanan_darah")).bind(g("spo2")).bind(g("ekg")).bind(g("lain_lain"))
            .bind(g("keluar_cairan_perdarahan")).bind(g("keluar_cairan_urin"))
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "umum_keterangan" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_umum_keterangan (no_rawat, tanggal, kd_petugas, medikasi, pemberian_cairan, masalah_durante_operasi, tindakan) \
                 VALUES (?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(kd)
            .bind(g("medikasi")).bind(g("pemberian_cairan")).bind(g("masalah_durante_operasi")).bind(g("tindakan"))
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "blokade_regional" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_blokade_regional (no_rawat, tanggal, kd_petugas, teknik, lokasi_tusukan, analgesia_setinggi_segmen, anestesi_lokal, konsentrasi_jumlah, obat_tambahan, dosis, vasokonstriktor, konsentrasi, waktu_mulai_suntik_jam, analgesia_jam, lamanya, lamanya_menit_analgesi, operasi_jam, lamanya_jam_operasi, lamanya_jam_menit, tindakan_anestesi_tambahan) \
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(kd)
            .bind(enum_opt(&g("teknik"), &["Caudal", "Saddle block", "Intravenous regional", "Epidural", "Spinal"]))
            .bind(g("lokasi_tusukan")).bind(g("analgesia_setinggi_segmen")).bind(g("anestesi_lokal")).bind(g("konsentrasi_jumlah"))
            .bind(g("obat_tambahan")).bind(g("dosis"))
            .bind(enum_opt(&g("vasokonstriktor"), &["Adrenalin", "Noradrenalin", "Tidak pakai"]))
            .bind(g("konsentrasi")).bind(g("waktu_mulai_suntik_jam")).bind(g("analgesia_jam")).bind(g("lamanya")).bind(g("lamanya_menit_analgesi"))
            .bind(g("operasi_jam")).bind(g("lamanya_jam_operasi")).bind(g("lamanya_jam_menit")).bind(g("tindakan_anestesi_tambahan"))
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "keadaan_operasi" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_keadaan_operasi (no_rawat, tanggal, kd_petugas, letak_penderita, airway, ukuran, balon, lama_operasi, lama_anestesi, kristaloid, perdarahan, koloid, diuresis, darah, cairan_lain, komponen_darah) \
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(kd)
            .bind(enum_opt(&g("letak_penderita"), &["Supine", "Prone", "Litotomi", "Semi sitting", "Flowler", "Lateral dekubitus", "Right dekubitus", "Left dekubitus", "Trendelenberg", "Knee-chest", "Jask-knife"]))
            .bind(enum_opt(&g("airway"), &["Face mask", "LMA", "Single lumen ETT", "Singke lumen spiral ETT", "Double lumen ETT R", "Double lumen ETT L", "Nasal kanul"]))
            .bind(g("ukuran")).bind(enum_opt(&g("balon"), &["Balon", "Tanpa balon"]))
            .bind(g("lama_operasi")).bind(g("lama_anestesi")).bind(g("kristaloid")).bind(g("perdarahan")).bind(g("koloid"))
            .bind(g("diuresis")).bind(g("darah")).bind(g("cairan_lain")).bind(g("komponen_darah"))
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "sectio_caesaria" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_sectio_caesaria (no_rawat, tanggal, kd_petugas, keadaan_bayi, jenis_kelamin, apgar_1_menit, apgar_5_menit, apgar_10_menit) \
                 VALUES (?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(kd)
            .bind(enum_opt(&g("keadaan_bayi"), &["Hidup", "Mati dalam kandungan"]))
            .bind(enum_opt(&g("jenis_kelamin"), &["L", "P"]))
            .bind(g("apgar_1_menit")).bind(g("apgar_5_menit")).bind(g("apgar_10_menit"))
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "pasca_masuk_kamar" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_pasca_anestesi_masuk_kamar (no_rawat, tanggal, kd_petugas, jam_masuk_kamar_pulih, kesadaran, tensi, nadi, rr, support1, support2, respirasi, kanul_nasal, o2, spo2, skor_nyeri, penyulit_intra_operasi, airway, nadi_reg) \
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(kd)
            .bind(dtopt(&g("jam_masuk_kamar_pulih")))
            .bind(enum_opt(&g("kesadaran"), &["Sadar", "Belum sadar", "Tidur dalam"]))
            .bind(g("tensi")).bind(g("nadi")).bind(g("rr")).bind(g("support1")).bind(g("support2"))
            .bind(enum_opt(&g("respirasi"), &["Spontan", "Bantuan", "Terkontrol"]))
            .bind(enum_opt(&g("kanul_nasal"), &["SM", "RM", "NRM", "SMNR"]))
            .bind(g("o2")).bind(g("spo2")).bind(g("skor_nyeri")).bind(g("penyulit_intra_operasi"))
            .bind(enum_opt(&g("airway"), &["Terintubasi", "Tidak Terintubasi"]))
            .bind(enum_opt(&g("nadi_reg"), &["Regular", "Irregular"]))
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "pasca_monitoring" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_pasca_anestesi_monitoring (no_rawat, tanggal, kd_petugas, suhu, rr, nadi, tekanan_darah) \
                 VALUES (?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(kd)
            .bind(g("suhu")).bind(g("rr")).bind(g("nadi")).bind(g("tekanan_darah"))
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "monitoring" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_monitoring (no_rawat, tanggal, o2, n2o, air, isofluran, lain_lain, sevofluran, infus, barbiturat, relaksan_depol, relaksan_nindipol, analgetika, neuroleptik, lain_lain_obat, respirasi, nadi, tekanan_darah, perdarahan, spo2, kd_petugas) \
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal)
            .bind(g("o2")).bind(g("n2o")).bind(g("air")).bind(g("isofluran")).bind(g("lain_lain")).bind(g("sevofluran")).bind(g("infus"))
            .bind(g("barbiturat")).bind(g("relaksan_depol")).bind(g("relaksan_nindipol")).bind(g("analgetika")).bind(g("neuroleptik")).bind(g("lain_lain_obat"))
            .bind(g("respirasi")).bind(g("nadi")).bind(g("tekanan_darah")).bind(g("perdarahan")).bind(g("spo2")).bind(kd)
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "catatan" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_catatan (no_rawat, tanggal, diagnosa_pasca_bedah, lama_operasi, lama_anestesi, cairan_masuk, jumlah_cairan_masuk, cairan_keluar, jumlah_cairan_keluar, kd_petugas) \
                 VALUES (?,?,?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal)
            .bind(g("diagnosa_pasca_bedah")).bind(g("lama_operasi")).bind(g("lama_anestesi"))
            .bind(g("cairan_masuk")).bind(g("jumlah_cairan_masuk")).bind(g("cairan_keluar")).bind(g("jumlah_cairan_keluar")).bind(kd)
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "masuk_kamar" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_masuk_kamar (no_rawat, tanggal, jam_masuk, jalan_nafas, pernapasan, bila_spontan, kesadaran, aktifitas_masuk, sirkulasi_masuk, pernapasan_masuk, kesadaran_masuk, warna_kulit_masuk, total_masuk, skor_bromage, kd_petugas) \
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(sopt(&g("jam_masuk"))).bind(g("jalan_nafas"))
            .bind(enum_opt(&g("pernapasan"), &["Spontan", "Assisted", "Controlled"])).bind(g("bila_spontan"))
            .bind(enum_opt(&g("kesadaran"), &["Sadar", "Somnolen", "Sopor", "Koma"]))
            .bind(g("aktifitas_masuk")).bind(g("sirkulasi_masuk")).bind(g("pernapasan_masuk")).bind(g("kesadaran_masuk")).bind(g("warna_kulit_masuk"))
            .bind(g("total_masuk")).bind(g("skor_bromage")).bind(kd)
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "observasi_kamar" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_observasi_kamar (no_rawat, tanggal, tvs, rr, nadi, tekanan_darah, vas, kd_petugas) \
                 VALUES (?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal)
            .bind(g("tvs")).bind(g("rr")).bind(g("nadi")).bind(g("tekanan_darah")).bind(g("vas")).bind(kd)
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "keluar_kamar" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_keluar_kamar (no_rawat, tanggal, jam_keluar, aktifitas_keluar, sirkulasi_keluar, pernapasan_keluar, kesadaran_keluar, warna_kulit_keluar, total_keluar, skor_bromage_keluar, pindah_ke, catatan_khusus, kd_petugas) \
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal).bind(sopt(&g("jam_keluar")))
            .bind(g("aktifitas_keluar")).bind(g("sirkulasi_keluar")).bind(g("pernapasan_keluar")).bind(g("kesadaran_keluar")).bind(g("warna_kulit_keluar"))
            .bind(g("total_keluar")).bind(g("skor_bromage_keluar")).bind(g("pindah_ke")).bind(g("catatan_khusus")).bind(kd)
            .execute(&state.pool).await.map_err(db_err)?;
        }
        "instruksi_pasca" => {
            sqlx::query(
                "INSERT INTO catatan_anestesi_instruksi_pasca (no_rawat, tanggal, bila_kesakitan, bila_mual_muntah, antibiotika, obat_lain, infus, minum, pemantauan_nadi, selama, kd_petugas) \
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)")
            .bind(&b.no_rawat).bind(&tanggal)
            .bind(g("bila_kesakitan")).bind(g("bila_mual_muntah")).bind(g("antibiotika")).bind(g("obat_lain")).bind(g("infus")).bind(g("minum"))
            .bind(g("pemantauan_nadi")).bind(g("selama")).bind(kd)
            .execute(&state.pool).await.map_err(db_err)?;
        }
        _ => {}
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("status_anestesi {} no_rawat={} {}", b.section, b.no_rawat, tanggal)).await;
    Ok(Json(json!({"ok": true})))
}
#[derive(Deserialize)]
pub struct SaDelBody { pub section: String, pub no_rawat: String, pub tanggal: String }
pub async fn status_anestesi_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<SaDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let (table, _) = sa_section(&b.section)
        .ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"seksi tidak dikenal"}))))?;
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let res = sqlx::query(&format!("DELETE FROM {table} WHERE no_rawat=? AND tanggal=? AND (kd_petugas=? OR ?=1)"))
        .bind(&b.no_rawat).bind(&b.tanggal).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat menghapus"}))));
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS {table} no_rawat={} {}", b.no_rawat, b.tanggal)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Surat Pulang Atas Permintaan Sendiri (APS) — e-Nakes + foto/TTD ───────────
// Surat pernyataan pasien/keluarga pulang APS. no_surat = APS+yyyymmdd+seq per
// tgl_pulang. Foto & tanda tangan pembuat pernyataan (pasien/PJ) + saksi keluarga
// disimpan ke folder webapps "pulangaps" (dibaca form Java untuk cetak).
const HUB_VALID: &[&str] = &["Suami", "Istri", "Anak", "Ayah", "Ibu", "Saudara", "Keponakan"];

pub async fn aps_get(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row: Option<(String, String, String, String, String, String, String, String, String, String, i64, i64, i64, i64, String)> = sqlx::query_as(
        "SELECT s.no_surat, CAST(s.tgl_pulang AS CHAR), IFNULL(s.rs_pilihan,''), IFNULL(s.nama_pj,''), \
                CAST(s.lahir AS CHAR), IFNULL(s.umur,''), IFNULL(s.jkpj,''), IFNULL(s.alamat,''), \
                IFNULL(s.hubungan,''), IFNULL(s.saksi_keluarga,''), \
                (IFNULL(pb.photo,'')<>''), (IFNULL(pb.tandatangan,'')<>''), \
                (IFNULL(sk.photo,'')<>''), (IFNULL(sk.tandatangan,'')<>''), IFNULL(s.nip,'') \
         FROM surat_pulang_atas_permintaan_sendiri s \
         LEFT JOIN surat_pulang_atas_permintaan_sendiri_pembuat_pernyataan pb ON pb.no_surat = s.no_surat \
         LEFT JOIN surat_pulang_atas_permintaan_sendiri_saksi_keluarga sk ON sk.no_surat = s.no_surat \
         WHERE s.no_rawat = ? ORDER BY s.no_surat DESC LIMIT 1"
    ).bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    match row {
        None => Ok(Json(json!({"exists": false}))),
        Some(r) => {
            let dapat_edit = user.0.is_admin || r.14 == user.0.kode;
            Ok(Json(json!({
                "exists": true, "no_surat": r.0, "tgl_pulang": r.1, "rs_pilihan": r.2, "nama_pj": r.3,
                "lahir": r.4, "umur": r.5, "jkpj": r.6, "alamat": r.7, "hubungan": r.8, "saksi_keluarga": r.9,
                "pembuat_foto": r.10 != 0, "pembuat_ttd": r.11 != 0, "saksi_foto": r.12 != 0, "saksi_ttd": r.13 != 0,
                "dapat_edit": dapat_edit
            })))
        }
    }
}

#[derive(Deserialize)]
pub struct ApsBody {
    pub no_rawat: String,
    #[serde(default)] pub tgl_pulang: String,
    #[serde(default)] pub rs_pilihan: String,
    #[serde(default)] pub nama_pj: String,
    #[serde(default)] pub lahir: String,
    #[serde(default)] pub umur: String,
    #[serde(default)] pub jkpj: String,
    #[serde(default)] pub alamat: String,
    #[serde(default)] pub hubungan: String,
    #[serde(default)] pub saksi_keluarga: String,
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub no_surat: String,
}
pub async fn aps_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<ApsBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "surat_pulang_atas_permintaan_sendiri").await?;
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    let tgl = if b.tgl_pulang.trim().is_empty() {
        let t: (String,) = sqlx::query_as("SELECT CAST(CURDATE() AS CHAR)").fetch_one(&state.pool).await.map_err(db_err)?;
        t.0
    } else { b.tgl_pulang.clone() };
    let jkpj = if b.jkpj.eq_ignore_ascii_case("P") { "P" } else { "L" };
    let hub = if HUB_VALID.contains(&b.hubungan.as_str()) { b.hubungan.clone() } else { "Anak".to_string() };
    let lahir = if b.lahir.trim().is_empty() { "2000-01-01".to_string() } else { b.lahir.clone() };
    // Edit-in-place: perbarui surat yang sudah ada (no_surat tetap), owner-locked.
    if b.edit && !b.no_surat.trim().is_empty() {
        let admin: i64 = if user.0.is_admin { 1 } else { 0 };
        let res = sqlx::query(
            "UPDATE surat_pulang_atas_permintaan_sendiri SET tgl_pulang=?, rs_pilihan=?, nama_pj=?, lahir=?, umur=?, jkpj=?, alamat=?, hubungan=?, saksi_keluarga=? \
             WHERE no_surat=? AND (nip=? OR ?=1)")
            .bind(&tgl).bind(&b.rs_pilihan).bind(&b.nama_pj).bind(&lahir).bind(&b.umur).bind(jkpj).bind(&b.alamat).bind(&hub).bind(&b.saksi_keluarga)
            .bind(&b.no_surat).bind(&user.0.kode).bind(admin)
            .execute(&state.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat mengubah"}))));
        }
        crate::audit::log_sql(&state.pool, &user.0.kode, &format!("UBAH surat_pulang_aps {} no_rawat={}", b.no_surat, b.no_rawat)).await;
        return Ok(Json(json!({"ok": true, "no_surat": b.no_surat})));
    }
    let digits: String = tgl.chars().filter(|c| c.is_ascii_digit()).collect();
    let seq: (i64,) = sqlx::query_as(
        "SELECT IFNULL(MAX(CONVERT(RIGHT(no_surat,3),SIGNED)),0)+1 FROM surat_pulang_atas_permintaan_sendiri WHERE tgl_pulang = ?"
    ).bind(&tgl).fetch_one(&state.pool).await.map_err(db_err)?;
    let no_surat = format!("APS{}{:03}", digits, seq.0);
    sqlx::query(
        "INSERT INTO surat_pulang_atas_permintaan_sendiri \
         (no_surat, no_rawat, tgl_pulang, rs_pilihan, nama_pj, lahir, umur, jkpj, alamat, hubungan, saksi_keluarga, nip) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&no_surat).bind(&b.no_rawat).bind(&tgl).bind(&b.rs_pilihan).bind(&b.nama_pj)
    .bind(&lahir).bind(&b.umur).bind(jkpj).bind(&b.alamat).bind(&hub).bind(&b.saksi_keluarga).bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("surat_pulang_aps {} no_rawat={}", no_surat, b.no_rawat)).await;
    Ok(Json(json!({"ok": true, "no_surat": no_surat})))
}

#[derive(Deserialize)]
pub struct ApsBuktiBody {
    pub no_surat: String,
    #[serde(default)] pub pembuat_foto: String,
    #[serde(default)] pub pembuat_ttd: String,
    #[serde(default)] pub saksi_foto: String,
    #[serde(default)] pub saksi_ttd: String,
}
pub async fn aps_bukti(user: AuthUser, State(state): State<AppState>, Json(b): Json<ApsBuktiBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "surat_pulang_atas_permintaan_sendiri").await?;
    if b.no_surat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_surat wajib"}))));
    }
    let fname: String = b.no_surat.chars().map(|c| if c.is_alphanumeric() || c == '-' { c } else { '_' }).collect();
    use crate::handlers::simrscb::save_webapps_image;
    if !b.pembuat_foto.trim().is_empty() || !b.pembuat_ttd.trim().is_empty() {
        let rphoto = if !b.pembuat_foto.trim().is_empty() {
            save_webapps_image(&state, "pulangaps", "pembuat_foto", &fname, &b.pembuat_foto).await?
        } else { String::new() };
        let rttd = if !b.pembuat_ttd.trim().is_empty() {
            save_webapps_image(&state, "pulangaps", "pembuat_ttd", &fname, &b.pembuat_ttd).await?
        } else { String::new() };
        sqlx::query(
            "INSERT INTO surat_pulang_atas_permintaan_sendiri_pembuat_pernyataan (no_surat, photo, tandatangan) \
             VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE \
             photo=IF(VALUES(photo)<>'', VALUES(photo), photo), \
             tandatangan=IF(VALUES(tandatangan)<>'', VALUES(tandatangan), tandatangan)"
        ).bind(&b.no_surat).bind(&rphoto).bind(&rttd).execute(&state.pool).await.map_err(db_err)?;
    }
    if !b.saksi_foto.trim().is_empty() || !b.saksi_ttd.trim().is_empty() {
        let rphoto = if !b.saksi_foto.trim().is_empty() {
            save_webapps_image(&state, "pulangaps", "saksi_foto", &fname, &b.saksi_foto).await?
        } else { String::new() };
        let rttd = if !b.saksi_ttd.trim().is_empty() {
            save_webapps_image(&state, "pulangaps", "saksi_ttd", &fname, &b.saksi_ttd).await?
        } else { String::new() };
        sqlx::query(
            "INSERT INTO surat_pulang_atas_permintaan_sendiri_saksi_keluarga (no_surat, photo, tandatangan) \
             VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE \
             photo=IF(VALUES(photo)<>'', VALUES(photo), photo), \
             tandatangan=IF(VALUES(tandatangan)<>'', VALUES(tandatangan), tandatangan)"
        ).bind(&b.no_surat).bind(&rphoto).bind(&rttd).execute(&state.pool).await.map_err(db_err)?;
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("bukti surat_pulang_aps no_surat={}", b.no_surat)).await;
    Ok(Json(json!({"ok": true})))
}

// ── eMAR / Kardek Obat (Jadwal Obat 2) — e-Nakes pencatatan pemberian obat ────
// kardek_obat_rscb (order) + kardek_obat_rscb_detail (pemberian per jam).
// Tiap pemberian menyimpan bukti foto + tanda tangan (kolom photo/tandatangan).
// Obat high-alert wajib double-check perawat ke-2; obat PRN wajib nama penerima.
#[derive(Deserialize)]
pub struct EmarQuery { pub no_rawat: String, #[serde(default)] pub tgl: String }

#[derive(Serialize, sqlx::FromRow)]
pub struct EmarObat {
    pub no_urut: i32, pub nama_obat: String, pub kekuatan: String, pub bentuk_sediaan: String,
    pub aturan_pakai: String, pub rute_pemberian: String, pub section: String,
    pub high_alert: String, pub is_prn: String, pub nm_dokter: String,
    pub tgl_mulai: String, pub tgl_stop: String,
}
#[derive(Serialize, sqlx::FromRow)]
pub struct EmarDetail {
    pub no_urut: i32, pub jam: String, pub status: String, pub alasan: String, pub catatan_klinis: String,
    pub petugas: String, pub nama_penerima: String, pub hubungan_penerima: String,
    pub ada_foto: i64, pub ada_ttd: i64, pub waktu_aktual: String,
    #[sqlx(default)] pub milik: i64,
}
pub async fn emar_get(user: AuthUser, State(state): State<AppState>, Query(q): Query<EmarQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tgl = if q.tgl.trim().is_empty() {
        let t: (String,) = sqlx::query_as("SELECT CAST(CURDATE() AS CHAR)").fetch_one(&state.pool).await.map_err(db_err)?;
        t.0
    } else { q.tgl.clone() };
    let obat = sqlx::query_as::<_, EmarObat>(
        "SELECT no_urut, IFNULL(nama_obat,'') nama_obat, IFNULL(kekuatan,'') kekuatan, IFNULL(bentuk_sediaan,'') bentuk_sediaan, \
                IFNULL(aturan_pakai,'') aturan_pakai, IFNULL(rute_pemberian,'') rute_pemberian, IFNULL(section,'') section, \
                IFNULL(high_alert,'Tidak') high_alert, IFNULL(is_prn,'Tidak') is_prn, IFNULL(nm_dokter,'') nm_dokter, \
                IFNULL(CAST(tgl_mulai AS CHAR),'') tgl_mulai, IFNULL(CAST(tgl_stop AS CHAR),'') tgl_stop \
         FROM kardek_obat_rscb WHERE no_rawat = ? AND tgl_observasi = ? ORDER BY FIELD(section,'Parenteral','Oral','Lain-lain'), no_urut"
    ).bind(&q.no_rawat).bind(&tgl).fetch_all(&state.pool).await.map_err(db_err)?;
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let detail = sqlx::query_as::<_, EmarDetail>(
        "SELECT d.no_urut, d.jam, IFNULL(d.status,'') status, IFNULL(d.alasan,'') alasan, IFNULL(d.catatan_klinis,'') catatan_klinis, \
                IFNULL(pg.nama, d.nip_petugas) petugas, IFNULL(d.nama_penerima,'') nama_penerima, IFNULL(d.hubungan_penerima,'') hubungan_penerima, \
                (IFNULL(d.photo,'')<>'') ada_foto, (IFNULL(d.tandatangan,'')<>'') ada_ttd, IFNULL(CAST(d.waktu_aktual AS CHAR),'') waktu_aktual, \
                (IFNULL(d.nip_petugas,'')='' OR d.nip_petugas=? OR ?=1) milik \
         FROM kardek_obat_rscb_detail d LEFT JOIN pegawai pg ON pg.nik = d.nip_petugas \
         WHERE d.no_rawat = ? AND d.tgl_observasi = ? AND IFNULL(d.is_corrected,'Tidak')='Tidak'"
    ).bind(&user.0.kode).bind(admin).bind(&q.no_rawat).bind(&tgl).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(json!({"tgl": tgl, "obat": obat, "detail": detail})))
}

#[derive(Deserialize)]
pub struct EmarObatBody {
    pub no_rawat: String, #[serde(default)] pub tgl: String,
    #[serde(default)] pub nama_obat: String, #[serde(default)] pub kekuatan: String,
    #[serde(default)] pub bentuk_sediaan: String, #[serde(default)] pub aturan_pakai: String,
    #[serde(default)] pub rute_pemberian: String, #[serde(default)] pub section: String,
    #[serde(default)] pub high_alert: String, #[serde(default)] pub is_prn: String,
}
pub async fn emar_obat(user: AuthUser, State(state): State<AppState>, Json(b): Json<EmarObatBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "catatan_keperawatan_ranap").await?;
    if b.no_rawat.trim().is_empty() || b.nama_obat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat & nama obat wajib"}))));
    }
    let tgl = if b.tgl.trim().is_empty() {
        let t: (String,) = sqlx::query_as("SELECT CAST(CURDATE() AS CHAR)").fetch_one(&state.pool).await.map_err(db_err)?;
        t.0
    } else { b.tgl.clone() };
    let seq: (i64,) = sqlx::query_as(
        "SELECT IFNULL(MAX(no_urut),0)+1 FROM kardek_obat_rscb WHERE no_rawat = ? AND tgl_observasi = ?"
    ).bind(&b.no_rawat).bind(&tgl).fetch_one(&state.pool).await.map_err(db_err)?;
    let section = match b.section.as_str() { "Parenteral" => "Parenteral", "Lain-lain" => "Lain-lain", _ => "Oral" };
    let ha = if b.high_alert.eq_ignore_ascii_case("Ya") { "Ya" } else { "Tidak" };
    let prn = if b.is_prn.eq_ignore_ascii_case("Ya") { "Ya" } else { "Tidak" };
    sqlx::query(
        "INSERT INTO kardek_obat_rscb \
         (no_rawat, tgl_observasi, no_urut, kd_dokter, nm_dokter, nama_obat, kekuatan, bentuk_sediaan, aturan_pakai, rute_pemberian, kode_ab, tgl_mulai, nip, section, high_alert, is_prn) \
         VALUES (?, ?, ?, '', '', ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?)"
    )
    .bind(&b.no_rawat).bind(&tgl).bind(seq.0)
    .bind(&b.nama_obat).bind(&b.kekuatan).bind(&b.bentuk_sediaan).bind(&b.aturan_pakai).bind(&b.rute_pemberian)
    .bind(&tgl).bind(&user.0.kode).bind(section).bind(ha).bind(prn)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("kardek_obat_rscb tambah no_rawat={} obat={}", b.no_rawat, b.nama_obat)).await;
    Ok(Json(json!({"ok": true, "no_urut": seq.0})))
}

// Catat pemberian BATCH per jam: satu foto + satu tanda tangan untuk semua obat
// pada jam (jadwal) yang sama; bukti disalin ke tiap baris detail jam tsb.
#[derive(Deserialize)]
pub struct EmarItem {
    pub no_urut: i32,
    #[serde(default)] pub status: String,
    #[serde(default)] pub alasan: String,
    #[serde(default)] pub catatan_klinis: String,
    #[serde(default)] pub nama_penerima: String,
    #[serde(default)] pub hubungan_penerima: String,
    #[serde(default)] pub nip_double_check: String,
}
#[derive(Deserialize)]
pub struct EmarBeriBody {
    pub no_rawat: String, pub tgl: String, pub jam: String,
    #[serde(default)] pub waktu_aktual: String,
    #[serde(default)] pub foto: String, #[serde(default)] pub ttd: String,
    #[serde(default)] pub items: Vec<EmarItem>,
}
pub async fn emar_beri(user: AuthUser, State(state): State<AppState>, Json(b): Json<EmarBeriBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "catatan_keperawatan_ranap").await?;
    if b.items.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Tidak ada obat untuk dicatat"}))));
    }
    // Validasi high-alert / PRN per obat yang diberikan (status 'o')
    for it in &b.items {
        if it.status != "o" { continue; }
        let sifat: Option<(String, String)> = sqlx::query_as(
            "SELECT IFNULL(high_alert,'Tidak'), IFNULL(is_prn,'Tidak') FROM kardek_obat_rscb WHERE no_rawat=? AND tgl_observasi=? AND no_urut=?"
        ).bind(&b.no_rawat).bind(&b.tgl).bind(it.no_urut).fetch_optional(&state.pool).await.map_err(db_err)?;
        let (high_alert, is_prn) = sifat.unwrap_or_else(|| ("Tidak".into(), "Tidak".into()));
        if high_alert == "Ya" && it.nip_double_check.trim().is_empty() {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Obat HIGH-ALERT wajib double-check (NIP perawat ke-2)"}))));
        }
        if is_prn == "Ya" && it.nama_penerima.trim().is_empty() {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Obat PRN wajib mengisi nama penerima"}))));
        }
    }
    // Owner-lock: catatan pemberian pada jam ini yang sudah diinput perawat lain
    // tidak boleh ditimpa (kecuali admin). Perawat yang sama boleh mengoreksi.
    if !user.0.is_admin {
        for it in &b.items {
            let owner: Option<String> = sqlx::query_scalar(
                "SELECT IFNULL(nip_petugas,'') FROM kardek_obat_rscb_detail \
                 WHERE no_rawat=? AND tgl_observasi=? AND no_urut=? AND jam=? AND IFNULL(is_corrected,'Tidak')='Tidak' LIMIT 1"
            ).bind(&b.no_rawat).bind(&b.tgl).bind(it.no_urut).bind(&b.jam)
             .fetch_optional(&state.pool).await.map_err(db_err)?;
            if let Some(o) = owner {
                if !o.is_empty() && o != user.0.kode {
                    return Err((StatusCode::FORBIDDEN, Json(json!({
                        "error": format!("Pemberian obat jam {} sudah dicatat perawat lain — hanya pembuat (atau Admin) yang dapat mengubah", b.jam)
                    }))));
                }
            }
        }
    }
    // Simpan bukti SEKALI untuk jam ini
    let fname: String = format!("{}_{}_{}", b.no_rawat, b.tgl, b.jam)
        .chars().map(|c| if c.is_alphanumeric() || c == '-' { c } else { '_' }).collect();
    use crate::handlers::simrscb::save_webapps_image;
    let rphoto = if !b.foto.trim().is_empty() {
        save_webapps_image(&state, "pemberianobat", "foto", &fname, &b.foto).await?
    } else { String::new() };
    let rttd = if !b.ttd.trim().is_empty() {
        save_webapps_image(&state, "pemberianobat", "ttd", &fname, &b.ttd).await?
    } else { String::new() };
    // Upsert tiap obat pada jam tsb, bukti sama disalin ke semua baris
    for it in &b.items {
        sqlx::query(
            "INSERT INTO kardek_obat_rscb_detail \
             (no_rawat, tgl_observasi, no_urut, jam, status, alasan, catatan_klinis, nip_petugas, nama_penerima, hubungan_penerima, nip_double_check, waktu_aktual, photo, tandatangan) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(NULLIF(?,''), NOW()), ?, ?) \
             ON DUPLICATE KEY UPDATE status=VALUES(status), alasan=VALUES(alasan), catatan_klinis=VALUES(catatan_klinis), \
               nip_petugas=VALUES(nip_petugas), nama_penerima=VALUES(nama_penerima), hubungan_penerima=VALUES(hubungan_penerima), \
               nip_double_check=VALUES(nip_double_check), waktu_aktual=VALUES(waktu_aktual), \
               photo=IF(VALUES(photo)<>'', VALUES(photo), photo), tandatangan=IF(VALUES(tandatangan)<>'', VALUES(tandatangan), tandatangan)"
        )
        .bind(&b.no_rawat).bind(&b.tgl).bind(it.no_urut).bind(&b.jam).bind(&it.status)
        .bind(&it.alasan).bind(&it.catatan_klinis).bind(&user.0.kode).bind(&it.nama_penerima).bind(&it.hubungan_penerima)
        .bind(&it.nip_double_check).bind(&b.waktu_aktual).bind(&rphoto).bind(&rttd)
        .execute(&state.pool).await.map_err(db_err)?;
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("kardek_obat_rscb_detail beri no_rawat={} jam={} ({} obat)", b.no_rawat, b.jam, b.items.len())).await;
    Ok(Json(json!({"ok": true})))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct PengkajianIcuRow {
    pub tanggal: Option<String>,
    pub gizi_skor: i32,
    pub petugas: String,
    #[sqlx(default)] pub milik: i64,
}
pub async fn pengkajian_icu_list(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Vec<PengkajianIcuRow>>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let rows = sqlx::query_as::<_, PengkajianIcuRow>(
        "SELECT CAST(s.tanggal AS CHAR) tanggal, IFNULL(s.gizi_skor,0) gizi_skor, IFNULL(pg.nama, s.nip) petugas, \
                (s.nip = ? OR ? = 1) milik \
         FROM pengkajian_keperawatan_icu s LEFT JOIN pegawai pg ON pg.nik = s.nip \
         WHERE s.no_rawat = ? ORDER BY s.id DESC LIMIT 50"
    ).bind(&user.0.kode).bind(admin).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// Detail satu pengkajian ICU (data blob) berdasarkan tanggal, untuk Edit-in-place.
#[derive(Deserialize)]
pub struct PengkajianIcuDetailQuery { pub no_rawat: String, pub tanggal: String }
pub async fn pengkajian_icu_detail(user: AuthUser, State(state): State<AppState>, Query(q): Query<PengkajianIcuDetailQuery>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row: Option<(String, i32, String)> = sqlx::query_as(
        "SELECT IFNULL(data,'{}'), IFNULL(gizi_skor,0), IFNULL(nip,'') \
         FROM pengkajian_keperawatan_icu WHERE no_rawat = ? AND tanggal = ? ORDER BY id DESC LIMIT 1"
    ).bind(&q.no_rawat).bind(&q.tanggal).fetch_optional(&state.pool).await.map_err(db_err)?;
    match row {
        None => Ok(Json(Value::Null)),
        Some((data, gizi, owner)) => {
            let d: Value = serde_json::from_str(&data).unwrap_or_else(|_| json!({}));
            let dapat_edit = user.0.is_admin || owner == user.0.kode;
            Ok(Json(json!({"data": d, "gizi_skor": gizi, "dapat_edit": dapat_edit})))
        }
    }
}

// ── Checklist Keselamatan Operasi (WHO) — 3 fase TERPISAH (waktu berbeda) ──────
// signin_sebelum_anestesi / timeout_sebelum_insisi / signout_sebelum_menutup_luka
// Tiap fase = 1 tabel + `tanggal` sendiri (stempel NOW saat disimpan).
// Item implan Sign In disimpan di tabel samping signin_sebelum_anestesi_implan
// (agar tidak menyentuh INSERT positional form desktop). nip_perawat_ok = login.

// Cek kepemilikan sebuah record (no_rawat, tanggal) sebelum edit/hapus.
// Ok(true)  = baris ada & milik user (atau user admin) → boleh lanjut.
// Ok(false) = baris tak ada → tak ada yg diubah/dihapus.
// Err 403   = baris milik petugas lain → tolak.
async fn chk_owner_guard(state: &AppState, user: &AuthUser, table: &str, nip_col: &str, no_rawat: &str, tanggal: &str)
  -> Result<bool, (StatusCode, Json<Value>)> {
    let row: Option<(Option<String>,)> = sqlx::query_as(
        &format!("SELECT `{}` FROM {} WHERE no_rawat=? AND tanggal=? LIMIT 1", nip_col, table))
        .bind(no_rawat).bind(tanggal).fetch_optional(&state.pool).await.map_err(db_err)?;
    match row {
        None => Ok(false),
        Some((owner,)) => {
            let owner = owner.unwrap_or_default();
            if user.0.is_admin || owner == user.0.kode { Ok(true) }
            else { Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya bisa diubah/dihapus oleh petugas yang menginput"})))) }
        }
    }
}

// Body untuk hapus record checklist/askep berbasis (no_rawat, tanggal).
#[derive(Deserialize)]
pub struct ChkDelBody { pub no_rawat: String, pub tanggal: String }

// ---- SIGN IN (sebelum induksi anestesi) ----
pub async fn signin_get(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT JSON_OBJECT('tanggal', CAST(s.tanggal AS CHAR), 'tindakan', IFNULL(s.tindakan,''), \
            'nip', IFNULL(s.nip_perawat_ok,''), \
            'kd_dokter_bedah', IFNULL(s.kd_dokter_bedah,''), 'kd_dokter_anestesi', IFNULL(s.kd_dokter_anestesi,''), \
            'nm_dokter_bedah', IFNULL(db.nm_dokter,''), 'nm_dokter_anestesi', IFNULL(da.nm_dokter,''), \
            'identitas', s.identitas, 'penandaan_area_operasi', s.penandaan_area_operasi, 'mesin_anestesi', s.mesin_anestesi, \
            'pulse_oximetri', s.pulse_oximetri, 'alergi', s.alergi, 'gangguan_pernapasan', s.gangguan_pernapasan, \
            'resiko_perdarahan', s.resiko_perdarahan, \
            'peralatan_khusus', IFNULL(im.peralatan_khusus,'Tidak'), 'jenis_peralatan', IFNULL(im.jenis,'')) \
         FROM signin_sebelum_anestesi s \
         LEFT JOIN signin_sebelum_anestesi_implan im ON im.no_rawat=s.no_rawat AND im.tanggal=s.tanggal \
         LEFT JOIN dokter db ON db.kd_dokter=s.kd_dokter_bedah \
         LEFT JOIN dokter da ON da.kd_dokter=s.kd_dokter_anestesi \
         WHERE s.no_rawat=? ORDER BY s.tanggal DESC LIMIT 1"
    ).bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    match row {
        None => Ok(Json(json!({"exists": false}))),
        Some(r) => { let mut v: Value = serde_json::from_str(&r.0).unwrap_or_else(|_| json!({})); if let Some(o)=v.as_object_mut(){o.insert("exists".into(), json!(true)); let nip=o.get("nip").and_then(|x|x.as_str()).unwrap_or("").to_string(); o.insert("dapat_edit".into(), json!(user.0.is_admin || nip==user.0.kode));} Ok(Json(v)) }
    }
}
#[derive(Deserialize)]
pub struct SignInBody {
    pub no_rawat: String,
    #[serde(default)] pub tanggal: String,
    #[serde(default)] pub edit_tanggal: String,
    #[serde(default)] pub tindakan: String,
    #[serde(default)] pub kd_dokter_bedah: String,
    #[serde(default)] pub kd_dokter_anestesi: String,
    #[serde(default)] pub identitas: bool,
    #[serde(default)] pub penandaan_area_operasi: bool,
    #[serde(default)] pub mesin_anestesi: bool,
    #[serde(default)] pub pulse_oximetri: bool,
    #[serde(default)] pub alergi: bool,
    #[serde(default)] pub gangguan_pernapasan: bool,
    #[serde(default)] pub resiko_perdarahan: bool,
    #[serde(default)] pub peralatan_khusus: bool,
    #[serde(default)] pub jenis_peralatan: String,
}
pub async fn signin_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<SignInBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "signin_sebelum_anestesi").await?;
    if b.no_rawat.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"})))); }
    // kd_dokter_bedah/anestesi NOT NULL + FK ke dokter → wajib pilih dokter valid.
    if b.kd_dokter_bedah.trim().is_empty() || b.kd_dokter_anestesi.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Pilih dokter bedah & dokter anestesi terlebih dahulu"}))));
    }
    let yn=|x:bool| if x {"Ya"} else {"Tidak"};
    // Edit in-place: hapus record lama (guard kepemilikan) lalu insert ulang dgn tanggal/jam baru.
    if !b.edit_tanggal.trim().is_empty() {
        chk_owner_guard(&state, &user, "signin_sebelum_anestesi", "nip_perawat_ok", &b.no_rawat, &b.edit_tanggal).await?;
        sqlx::query("DELETE FROM signin_sebelum_anestesi WHERE no_rawat=? AND tanggal=?").bind(&b.no_rawat).bind(&b.edit_tanggal).execute(&state.pool).await.map_err(db_err)?;
        sqlx::query("DELETE FROM signin_sebelum_anestesi_implan WHERE no_rawat=? AND tanggal=?").bind(&b.no_rawat).bind(&b.edit_tanggal).execute(&state.pool).await.map_err(db_err)?;
    }
    let tgl = tgl_or_now(&state, &b.tanggal).await?;
    sqlx::query(
        "INSERT INTO signin_sebelum_anestesi (no_rawat, tanggal, tindakan, kd_dokter_bedah, kd_dokter_anestesi, \
          identitas, penandaan_area_operasi, mesin_anestesi, pulse_oximetri, alergi, gangguan_pernapasan, resiko_perdarahan, nip_perawat_ok) \
         VALUES (?, ?, ?, ?, ?, ?,?,?,?,?,?,?, ?)"
    ).bind(&b.no_rawat).bind(&tgl).bind(&b.tindakan).bind(&b.kd_dokter_bedah).bind(&b.kd_dokter_anestesi)
    .bind(yn(b.identitas)).bind(yn(b.penandaan_area_operasi)).bind(yn(b.mesin_anestesi)).bind(yn(b.pulse_oximetri))
    .bind(yn(b.alergi)).bind(yn(b.gangguan_pernapasan)).bind(yn(b.resiko_perdarahan)).bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;
    sqlx::query("INSERT INTO signin_sebelum_anestesi_implan (no_rawat, tanggal, peralatan_khusus, jenis) VALUES (?, ?, ?, ?)")
    .bind(&b.no_rawat).bind(&tgl).bind(if b.peralatan_khusus {"Ada"} else {"Tidak"}).bind(&b.jenis_peralatan)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("signin_sebelum_anestesi no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}
pub async fn signin_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<ChkDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !chk_owner_guard(&state, &user, "signin_sebelum_anestesi", "nip_perawat_ok", &b.no_rawat, &b.tanggal).await? {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Data tidak ditemukan"}))));
    }
    sqlx::query("DELETE FROM signin_sebelum_anestesi WHERE no_rawat=? AND tanggal=?").bind(&b.no_rawat).bind(&b.tanggal).execute(&state.pool).await.map_err(db_err)?;
    sqlx::query("DELETE FROM signin_sebelum_anestesi_implan WHERE no_rawat=? AND tanggal=?").bind(&b.no_rawat).bind(&b.tanggal).execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS signin_sebelum_anestesi no_rawat={} tgl={}", b.no_rawat, b.tanggal)).await;
    Ok(Json(json!({"ok": true})))
}

// ---- TIME OUT (sebelum insisi) ----
pub async fn timeout_get(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT JSON_OBJECT('tanggal', CAST(t.tanggal AS CHAR), 'tindakan', IFNULL(t.tindakan,''), \
            'nip', IFNULL(t.nip_perawat_ok,''), \
            'kd_dokter_bedah', IFNULL(t.kd_dokter_bedah,''), 'kd_dokter_anestesi', IFNULL(t.kd_dokter_anestesi,''), \
            'nm_dokter_bedah', IFNULL(db.nm_dokter,''), 'nm_dokter_anestesi', IFNULL(da.nm_dokter,''), \
            'identitas_perkenalan', t.identitas_perkenalan, 'nama_pasien_tindakan_area_insisi', t.nama_pasien_tindakan_area_insisi, \
            'tim_asisten', IFNULL(t.tim_asisten,''), 'tim_instrumen', IFNULL(t.tim_instrumen,''), \
            'tim_sirkuler', IFNULL(t.tim_sirkuler,''), 'tim_penata', IFNULL(t.tim_penata,''), \
            'profilaksis_antibiotik', t.profilaksis_antibiotik, 'profilaksis_obat', IFNULL(t.profilaksis_obat,''), 'hal_khusus_bedah', t.hal_khusus_bedah, 'lama_tindakan', IFNULL(t.lama_tindakan,''), \
            'antisipasi_perdarahan', t.antisipasi_perdarahan, 'kekhawatiran_anestesi', t.kekhawatiran_anestesi, \
            'jumlah_kasa', IFNULL(t.jumlah_kasa,''), 'jumlah_instrumen', IFNULL(t.jumlah_instrumen,''), 'jumlah_jarum', IFNULL(t.jumlah_jarum,''), \
            'kesterilan_alat', t.kesterilan_alat, 'kesiapan_peralatan', t.kesiapan_peralatan, 'hasil_radiologi', t.hasil_radiologi) \
         FROM timeout_sebelum_insisi t \
         LEFT JOIN dokter db ON db.kd_dokter=t.kd_dokter_bedah \
         LEFT JOIN dokter da ON da.kd_dokter=t.kd_dokter_anestesi \
         WHERE t.no_rawat=? ORDER BY t.tanggal DESC LIMIT 1"
    ).bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    match row {
        None => Ok(Json(json!({"exists": false}))),
        Some(r) => { let mut v: Value = serde_json::from_str(&r.0).unwrap_or_else(|_| json!({})); if let Some(o)=v.as_object_mut(){o.insert("exists".into(), json!(true)); let nip=o.get("nip").and_then(|x|x.as_str()).unwrap_or("").to_string(); o.insert("dapat_edit".into(), json!(user.0.is_admin || nip==user.0.kode));} Ok(Json(v)) }
    }
}
#[derive(Deserialize)]
pub struct TimeOutBody {
    pub no_rawat: String,
    #[serde(default)] pub tanggal: String,
    #[serde(default)] pub edit_tanggal: String,
    #[serde(default)] pub tindakan: String,
    #[serde(default)] pub kd_dokter_bedah: String,
    #[serde(default)] pub kd_dokter_anestesi: String,
    #[serde(default)] pub identitas_perkenalan: bool,
    #[serde(default)] pub tim_asisten: String,
    #[serde(default)] pub tim_instrumen: String,
    #[serde(default)] pub tim_sirkuler: String,
    #[serde(default)] pub tim_penata: String,
    #[serde(default)] pub nama_pasien_tindakan_area_insisi: bool,
    #[serde(default)] pub profilaksis_antibiotik: bool,
    #[serde(default)] pub profilaksis_obat: String,
    #[serde(default)] pub hal_khusus_bedah: bool,
    #[serde(default)] pub lama_tindakan: String,
    #[serde(default)] pub antisipasi_perdarahan: bool,
    #[serde(default)] pub kekhawatiran_anestesi: bool,
    #[serde(default)] pub jumlah_kasa: String,
    #[serde(default)] pub jumlah_instrumen: String,
    #[serde(default)] pub jumlah_jarum: String,
    #[serde(default)] pub kesterilan_alat: bool,
    #[serde(default)] pub kesiapan_peralatan: bool,
    #[serde(default)] pub hasil_radiologi: bool,
}
pub async fn timeout_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<TimeOutBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "timeout_sebelum_insisi").await?;
    if b.no_rawat.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"})))); }
    let yn=|x:bool| if x {"Ya"} else {"Tidak"};
    if !b.edit_tanggal.trim().is_empty() {
        chk_owner_guard(&state, &user, "timeout_sebelum_insisi", "nip_perawat_ok", &b.no_rawat, &b.edit_tanggal).await?;
        sqlx::query("DELETE FROM timeout_sebelum_insisi WHERE no_rawat=? AND tanggal=?").bind(&b.no_rawat).bind(&b.edit_tanggal).execute(&state.pool).await.map_err(db_err)?;
    }
    let tgl = tgl_or_now(&state, &b.tanggal).await?;
    sqlx::query(
        "INSERT INTO timeout_sebelum_insisi (no_rawat, tanggal, tindakan, kd_dokter_bedah, kd_dokter_anestesi, \
          identitas_perkenalan, tim_asisten, tim_instrumen, tim_sirkuler, tim_penata, nama_pasien_tindakan_area_insisi, profilaksis_antibiotik, profilaksis_obat, hal_khusus_bedah, lama_tindakan, \
          antisipasi_perdarahan, kekhawatiran_anestesi, jumlah_kasa, jumlah_instrumen, jumlah_jarum, kesterilan_alat, kesiapan_peralatan, hasil_radiologi, nip_perawat_ok) \
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(&b.no_rawat).bind(&tgl).bind(&b.tindakan).bind(&b.kd_dokter_bedah).bind(&b.kd_dokter_anestesi)
    .bind(yn(b.identitas_perkenalan)).bind(&b.tim_asisten).bind(&b.tim_instrumen).bind(&b.tim_sirkuler).bind(&b.tim_penata).bind(yn(b.nama_pasien_tindakan_area_insisi)).bind(yn(b.profilaksis_antibiotik)).bind(&b.profilaksis_obat).bind(yn(b.hal_khusus_bedah)).bind(&b.lama_tindakan)
    .bind(yn(b.antisipasi_perdarahan)).bind(yn(b.kekhawatiran_anestesi)).bind(&b.jumlah_kasa).bind(&b.jumlah_instrumen).bind(&b.jumlah_jarum).bind(yn(b.kesterilan_alat)).bind(yn(b.kesiapan_peralatan)).bind(yn(b.hasil_radiologi)).bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("timeout_sebelum_insisi no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}
pub async fn timeout_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<ChkDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !chk_owner_guard(&state, &user, "timeout_sebelum_insisi", "nip_perawat_ok", &b.no_rawat, &b.tanggal).await? {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Data tidak ditemukan"}))));
    }
    sqlx::query("DELETE FROM timeout_sebelum_insisi WHERE no_rawat=? AND tanggal=?").bind(&b.no_rawat).bind(&b.tanggal).execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS timeout_sebelum_insisi no_rawat={} tgl={}", b.no_rawat, b.tanggal)).await;
    Ok(Json(json!({"ok": true})))
}

// ---- SIGN OUT (sebelum menutup luka) ----
pub async fn signout_get(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT JSON_OBJECT('tanggal', CAST(s.tanggal AS CHAR), 'tindakan', IFNULL(s.tindakan,''), \
            'nip', IFNULL(s.nip_perawat_ok,''), \
            'kd_dokter_bedah', IFNULL(s.kd_dokter_bedah,''), 'kd_dokter_anestesi', IFNULL(s.kd_dokter_anestesi,''), \
            'nm_dokter_bedah', IFNULL(db.nm_dokter,''), 'nm_dokter_anestesi', IFNULL(da.nm_dokter,''), \
            'verbal_tindakan', s.verbal_tindakan, 'verbal_kelengkapan_kasa', s.verbal_kelengkapan_kasa, 'verbal_instrumen', s.verbal_instrumen, \
            'jumlah_kasa', IFNULL(s.jumlah_kasa,''), 'jumlah_instrumen', IFNULL(s.jumlah_instrumen,''), 'jumlah_jarum', IFNULL(s.jumlah_jarum,''), \
            'verbal_alat_tajam', s.verbal_alat_tajam, 'kelengkapan_specimen_label', s.kelengkapan_specimen_label, \
            'perhatian_utama_fase_pemulihan', IFNULL(s.perhatian_utama_fase_pemulihan,'')) \
         FROM signout_sebelum_menutup_luka s \
         LEFT JOIN dokter db ON db.kd_dokter=s.kd_dokter_bedah \
         LEFT JOIN dokter da ON da.kd_dokter=s.kd_dokter_anestesi \
         WHERE s.no_rawat=? ORDER BY s.tanggal DESC LIMIT 1"
    ).bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    match row {
        None => Ok(Json(json!({"exists": false}))),
        Some(r) => { let mut v: Value = serde_json::from_str(&r.0).unwrap_or_else(|_| json!({})); if let Some(o)=v.as_object_mut(){o.insert("exists".into(), json!(true)); let nip=o.get("nip").and_then(|x|x.as_str()).unwrap_or("").to_string(); o.insert("dapat_edit".into(), json!(user.0.is_admin || nip==user.0.kode));} Ok(Json(v)) }
    }
}
#[derive(Deserialize)]
pub struct SignOutBody {
    pub no_rawat: String,
    #[serde(default)] pub tanggal: String,
    #[serde(default)] pub edit_tanggal: String,
    #[serde(default)] pub tindakan: String,
    #[serde(default)] pub kd_dokter_bedah: String,
    #[serde(default)] pub kd_dokter_anestesi: String,
    #[serde(default)] pub verbal_tindakan: bool,
    #[serde(default)] pub verbal_kelengkapan_kasa: bool,
    #[serde(default)] pub verbal_instrumen: bool,
    #[serde(default)] pub jumlah_kasa: String,
    #[serde(default)] pub jumlah_instrumen: String,
    #[serde(default)] pub jumlah_jarum: String,
    #[serde(default)] pub verbal_alat_tajam: bool,
    #[serde(default)] pub kelengkapan_specimen_label: bool,
    #[serde(default)] pub perhatian_utama_fase_pemulihan: String,
}
pub async fn signout_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<SignOutBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "signout_sebelum_menutup_luka").await?;
    if b.no_rawat.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"})))); }
    let yn=|x:bool| if x {"Ya"} else {"Tidak"};
    if !b.edit_tanggal.trim().is_empty() {
        chk_owner_guard(&state, &user, "signout_sebelum_menutup_luka", "nip_perawat_ok", &b.no_rawat, &b.edit_tanggal).await?;
        sqlx::query("DELETE FROM signout_sebelum_menutup_luka WHERE no_rawat=? AND tanggal=?").bind(&b.no_rawat).bind(&b.edit_tanggal).execute(&state.pool).await.map_err(db_err)?;
    }
    let tgl = tgl_or_now(&state, &b.tanggal).await?;
    sqlx::query(
        "INSERT INTO signout_sebelum_menutup_luka (no_rawat, tanggal, tindakan, kd_dokter_bedah, kd_dokter_anestesi, \
          verbal_tindakan, verbal_kelengkapan_kasa, verbal_instrumen, jumlah_kasa, jumlah_instrumen, jumlah_jarum, verbal_alat_tajam, kelengkapan_specimen_label, perhatian_utama_fase_pemulihan, nip_perawat_ok) \
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(&b.no_rawat).bind(&tgl).bind(&b.tindakan).bind(&b.kd_dokter_bedah).bind(&b.kd_dokter_anestesi)
    .bind(yn(b.verbal_tindakan)).bind(yn(b.verbal_kelengkapan_kasa)).bind(yn(b.verbal_instrumen)).bind(&b.jumlah_kasa).bind(&b.jumlah_instrumen).bind(&b.jumlah_jarum).bind(yn(b.verbal_alat_tajam)).bind(yn(b.kelengkapan_specimen_label))
    .bind(&b.perhatian_utama_fase_pemulihan).bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("signout_sebelum_menutup_luka no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}
pub async fn signout_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<ChkDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !chk_owner_guard(&state, &user, "signout_sebelum_menutup_luka", "nip_perawat_ok", &b.no_rawat, &b.tanggal).await? {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Data tidak ditemukan"}))));
    }
    sqlx::query("DELETE FROM signout_sebelum_menutup_luka WHERE no_rawat=? AND tanggal=?").bind(&b.no_rawat).bind(&b.tanggal).execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS signout_sebelum_menutup_luka no_rawat={} tgl={}", b.no_rawat, b.tanggal)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Asuhan Keperawatan Kamar Bedah (RM.KEP.08.044) — e-Nakes full 6 seksi ─────
// 6 tabel dgn (no_rawat, tanggal) berbagi. Tiap simpan = 1 tanggal (NOW) untuk
// semua tabel, nip=login. Nilai tiap kolom disimpan sbg string apa adanya
// (komposit gcs/penunjang/diagnosa dirakit di frontend). INSERT dinamis dgn
// whitelist kolom per tabel (tabel & kolom hardcoded → tak ada injeksi).
const AKB_DATA_AWAL: &[&str] = &["tindakan","jenis_anestesi","catatan"];
const AKB_PREOP: &[&str] = &["puasa","informed_consent","identitas_pasien","lavamen","isolasi","marking","alergi","waktu_pengukuran","verifikasi_tindakan","kondisi_kulit","preop_kesadaran","gcs","gangguan_sensorik","muskuloskeletal","protesa","edema","riwayat_asma","respirasi","ekg","foto_thorax","riwayat_hepatitis","penyakit_lain","kesimpulan","kondisi_psikologis","data_penunjang","laboratorium"];
const AKB_MASALAH: &[&str] = &["masalah_preop_kecemasan","cemas_tingkat","intervensi_cemas","masalah_preop_nyeri","intervensi_nyeri","kaji_ttv_menit"];
const AKB_INTRAOP: &[&str] = &["aseptik_antiseptik","aseptik_oleh","lain_resti_infeksi","klasifikasi_luka","kulit_preop_utuh","kateter","kateter_no","kateter_urine_cc","kateter_oleh","drain_intraop","drain_intraop_jenis","drain_intraop_cc","tampon_intraop","tampon_intraop_jenis","tampon_intraop_lokasi","gips","gips_jenis","gips_lokasi","matras_penghangat","hipo_oleh","cairan_iv_hangat","irigasi_hangat","hipo_lain","posisi_operasi","posisi_lain","alat_posisi","alat_posisi_lain","bantalan","sabuk_pengaman","sabuk_pada","plat_grounding","plate_pada","plate_oleh","kulit_setelah_plate","elektrokauter_koagulasi","elektrokauter_cutting","tourniquet_waktu","tourniquet_tekanan","tourniquet_pada","tourniquet_oleh","tourniquet_inflate","tourniquet_deflate","hitung_xray","hitung_xray_keterangan","cairan_infus","cairan_infus_jenis","urine","ngt","cairan_ngt_cc","cairan_lain_cc","pemberian_darah","spinal_anastesi","pengeluaran_cairan"];
const AKB_POSTOP: &[&str] = &["jam_masuk_rr","td","hr","spo2","rr","jenis_anestesi_postop","kulit_postop","respirasi_postop","kesadaran","posisi_pasien","lama_anestesi","lama_operasi","diagnosa_postop","drain","tampon","pa"];
const AKB_DIAGNOSA: &[&str] = &["efektifitas_jalan_nafas","hipotermi_postop","nip_perawat_rr","nip_perawat_ruangan"];
// Askep Kamar Bedah dipecah per PERISTIWA (waktu berbeda) — tiap peristiwa
// punya tanggal sendiri & disimpan terpisah:
//  Pra-Op  = data_awal + preop + masalah
//  Intra-Op = intraop
//  Post-Op = postop + diagnosa
const AKB_EV_PRAOP: &[(&str, &[&str], &str)] = &[
    ("asuhan_keperawatan_kamar_bedah_data_awal", AKB_DATA_AWAL, "data_awal"),
    ("askep_kb_preop", AKB_PREOP, "preop"),
    ("askep_kb_masalah", AKB_MASALAH, "masalah"),
];
const AKB_EV_INTRAOP: &[(&str, &[&str], &str)] = &[
    ("askep_kb_intraop", AKB_INTRAOP, "intraop"),
];
const AKB_EV_POSTOP: &[(&str, &[&str], &str)] = &[
    ("askep_kb_postop", AKB_POSTOP, "postop"),
    ("askep_kb_diagnosa", AKB_DIAGNOSA, "diagnosa"),
];

#[derive(Deserialize)]
pub struct AsuhanKbBody {
    pub no_rawat: String,
    #[serde(default)] pub tanggal: String,
    #[serde(default)] pub edit_tanggal: String,
    #[serde(default)] pub data_awal: Value,
    #[serde(default)] pub preop: Value,
    #[serde(default)] pub masalah: Value,
    #[serde(default)] pub intraop: Value,
    #[serde(default)] pub postop: Value,
    #[serde(default)] pub diagnosa: Value,
}

// Ambil seksi Value dari body berdasarkan key.
fn akb_section<'a>(b: &'a AsuhanKbBody, key: &str) -> &'a Value {
    match key {
        "data_awal" => &b.data_awal, "preop" => &b.preop, "masalah" => &b.masalah,
        "intraop" => &b.intraop, "postop" => &b.postop, "diagnosa" => &b.diagnosa, _ => &Value::Null,
    }
}

async fn askep_event_get(state: &AppState, user: &AuthUser, no_rawat: &str, tables: &[(&str, &[&str], &str)])
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let primary = tables[0].0;
    let row: Option<(String, Option<String>)> = sqlx::query_as(
        &format!("SELECT CAST(tanggal AS CHAR), nip FROM {} WHERE no_rawat=? ORDER BY tanggal DESC LIMIT 1", primary)
    ).bind(no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    let (tgl, nip) = match row { None => return Ok(Json(json!({"exists": false}))), Some(t) => (t.0, t.1.unwrap_or_default()) };
    let dapat_edit = user.0.is_admin || nip == user.0.kode;
    let mut out = json!({"exists": true, "tanggal": tgl, "nip": nip, "dapat_edit": dapat_edit});
    for (table, cols, key) in tables {
        let json_expr = cols.iter().map(|c| format!("'{}', IFNULL(`{}`,'')", c, c)).collect::<Vec<_>>().join(", ");
        let sql = format!("SELECT JSON_OBJECT({}) FROM {} WHERE no_rawat=? AND tanggal=? LIMIT 1", json_expr, table);
        let row: Option<(String,)> = sqlx::query_as(&sql).bind(no_rawat).bind(&tgl).fetch_optional(&state.pool).await.map_err(db_err)?;
        let section: Value = match row { Some(r) => serde_json::from_str(&r.0).unwrap_or_else(|_| json!({})), None => json!({}) };
        out[*key] = section;
    }
    Ok(Json(out))
}

async fn askep_event_save(state: &AppState, user: &AuthUser, b: &AsuhanKbBody, tables: &[(&str, &[&str], &str)], ev: &str)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(state, user, "pengkajian_askep").await?;
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    // Edit in-place: guard kepemilikan (tabel primer) lalu hapus semua tabel peristiwa
    // utk (no_rawat, edit_tanggal); insert ulang di bawah dgn tanggal/jam baru.
    if !b.edit_tanggal.trim().is_empty() {
        chk_owner_guard(state, user, tables[0].0, "nip", &b.no_rawat, &b.edit_tanggal).await?;
        for (table, _, _) in tables {
            sqlx::query(&format!("DELETE FROM {} WHERE no_rawat=? AND tanggal=?", table))
                .bind(&b.no_rawat).bind(&b.edit_tanggal).execute(&state.pool).await.map_err(db_err)?;
        }
    }
    let tgl = tgl_or_now(state, &b.tanggal).await?;
    let empty = serde_json::Map::new();
    for (table, allowed, key) in tables {
        let obj = akb_section(b, key).as_object().unwrap_or(&empty);
        let cols: Vec<&str> = allowed.iter().copied().filter(|c| obj.contains_key(*c)).collect();
        let col_sql: String = cols.iter().map(|c| format!(", `{}`", c)).collect();
        let ph_sql: String = cols.iter().map(|_| ", ?").collect();
        let sql = format!("INSERT INTO {} (no_rawat, tanggal, nip{}) VALUES (?, ?, ?{})", table, col_sql, ph_sql);
        let mut qb = sqlx::query(&sql).bind(&b.no_rawat).bind(&tgl).bind(&user.0.kode);
        for c in &cols {
            let val = obj.get(*c).map(|v| match v { Value::String(s) => s.clone(), Value::Null => String::new(), other => other.to_string() }).unwrap_or_default();
            qb = qb.bind(val);
        }
        qb.execute(&state.pool).await.map_err(db_err)?;
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("askep_kb_{} no_rawat={}", ev, b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// Hapus semua tabel sebuah peristiwa askep utk (no_rawat, tanggal), guard kepemilikan.
async fn askep_event_hapus(state: &AppState, user: &AuthUser, b: &ChkDelBody, tables: &[(&str, &[&str], &str)])
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !chk_owner_guard(state, user, tables[0].0, "nip", &b.no_rawat, &b.tanggal).await? {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Data tidak ditemukan"}))));
    }
    for (table, _, _) in tables {
        sqlx::query(&format!("DELETE FROM {} WHERE no_rawat=? AND tanggal=?", table))
            .bind(&b.no_rawat).bind(&b.tanggal).execute(&state.pool).await.map_err(db_err)?;
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS askep_kb {} no_rawat={} tgl={}", tables[0].0, b.no_rawat, b.tanggal)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Pra-Op ──
pub async fn askep_praop_get(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> { askep_event_get(&state, &user, &q.no_rawat, AKB_EV_PRAOP).await }
pub async fn askep_praop_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<AsuhanKbBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> { askep_event_save(&state, &user, &b, AKB_EV_PRAOP, "praop").await }
pub async fn askep_praop_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<ChkDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> { askep_event_hapus(&state, &user, &b, AKB_EV_PRAOP).await }

// ── Intra-Op ──
pub async fn askep_intraop_get(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> { askep_event_get(&state, &user, &q.no_rawat, AKB_EV_INTRAOP).await }
pub async fn askep_intraop_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<AsuhanKbBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> { askep_event_save(&state, &user, &b, AKB_EV_INTRAOP, "intraop").await }
pub async fn askep_intraop_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<ChkDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> { askep_event_hapus(&state, &user, &b, AKB_EV_INTRAOP).await }

// ── Post-Op ── (nip perawat ruang pulih/ruangan auto = petugas login)
pub async fn askep_postop_get(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> { askep_event_get(&state, &user, &q.no_rawat, AKB_EV_POSTOP).await }
pub async fn askep_postop_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<ChkDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> { askep_event_hapus(&state, &user, &b, AKB_EV_POSTOP).await }
pub async fn askep_postop_save(user: AuthUser, State(state): State<AppState>, Json(mut b): Json<AsuhanKbBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !b.diagnosa.is_object() { b.diagnosa = json!({}); }
    if let Some(obj) = b.diagnosa.as_object_mut() {
        obj.insert("nip_perawat_rr".into(), json!(user.0.kode));
        obj.insert("nip_perawat_ruangan".into(), json!(user.0.kode));
    }
    askep_event_save(&state, &user, &b, AKB_EV_POSTOP, "postop").await
}

// ── Penandaan Lokasi Operasi — TTD & foto pasien via e-Nakes (HP petugas) ─────
// Foto/TTD disimpan sebagai FILE (save_webapps_image → path), bukan base64 di DB.
// hash_dokumen = SHA-256 pengikat (identitas + dokumen + isi TTD/foto) sebagai
// bukti tamper-evidence (syarat TTE tidak tersertifikasi — UU ITE Ps.11,
// PP 71/2019 Ps.60 ayat 4). Menyatu ke penandaan_area_operasi via (no_rawat, tanggal).
pub async fn penandaan_get(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row: Option<(String, String, String, String, String, String, String, i64, i64, String, String, String, String)> = sqlx::query_as(
        "SELECT CAST(p.tanggal AS CHAR), IFNULL(p.operasi,''), IFNULL(p.ruangan,''), IFNULL(dk.nm_dokter,''), \
                IFNULL(t.nama_penanda,''), IFNULL(t.hubungan,''), IFNULL(t.pernyataan,''), \
                (IFNULL(t.foto_pasien,'')<>''), (IFNULL(t.tandatangan_pasien,'')<>''), IFNULL(t.hash_dokumen,''), \
                IFNULL(t.marking_points,''), IFNULL(t.nip,''), IFNULL(pt.nama, IFNULL(t.nip,'')) \
         FROM penandaan_area_operasi p \
         LEFT JOIN dokter dk ON dk.kd_dokter = p.kd_dokter \
         LEFT JOIN penandaan_area_operasi_ttd t ON t.no_rawat=p.no_rawat AND t.tanggal=p.tanggal \
         LEFT JOIN petugas pt ON pt.nip = t.nip \
         WHERE p.no_rawat=? ORDER BY p.tanggal DESC LIMIT 1"
    ).bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    match row {
        None => Ok(Json(json!({"exists": false}))),
        Some(r) => {
            let ttd_ada = r.8 != 0;
            let creator = r.11.clone();
            let bisa_hapus = ttd_ada && (user.0.is_admin || (!creator.is_empty() && creator == user.0.kode));
            Ok(Json(json!({
                "exists": true, "tanggal": r.0, "operasi": r.1, "ruangan": r.2, "nm_dokter": r.3,
                "nama_penanda": r.4, "hubungan": r.5, "pernyataan": r.6,
                "foto_ada": r.7 != 0, "ttd_ada": ttd_ada, "hash": r.9,
                "marking_points": r.10, "penginput_nip": r.11, "penginput_nama": r.12,
                "bisa_hapus": bisa_hapus
            })))
        }
    }
}

#[derive(Deserialize)]
pub struct PenandaanTtdBody {
    pub no_rawat: String,
    #[serde(default)] pub tanggal: String,
    #[serde(default)] pub nama_penanda: String,
    #[serde(default)] pub hubungan: String,
    #[serde(default)] pub marking_points: String,
    #[serde(default)] pub foto: String,
    #[serde(default)] pub ttd: String,
}
pub async fn penandaan_ttd_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<PenandaanTtdBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "checklist_pre_operasi").await?;
    if b.no_rawat.trim().is_empty() || b.tanggal.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat & tanggal wajib (pilih penandaan dulu)"}))));
    }
    if b.nama_penanda.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Nama penanda tangan wajib diisi"}))));
    }
    // marking (klik lokasi) & TTD & foto bersifat opsional, tapi minimal harus ada
    // salah satu penanda (marking atau tanda tangan) yang disimpan.
    if b.marking_points.trim().is_empty() && b.ttd.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Isi minimal penandaan lokasi (klik gambar) atau tanda tangan"}))));
    }
    use crate::handlers::simrscb::save_webapps_image;
    let fname: String = format!("{}_{}", b.no_rawat, b.tanggal).chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' }).collect();
    let rfoto = if !b.foto.trim().is_empty() {
        save_webapps_image(&state, "penandaanoperasi", "foto_pasien", &fname, &b.foto).await?
    } else { String::new() };
    let rttd = if !b.ttd.trim().is_empty() {
        save_webapps_image(&state, "penandaanoperasi", "ttd_pasien", &fname, &b.ttd).await?
    } else { String::new() };
    let hash = {
        use sha2::{Digest, Sha256};
        let mut h = Sha256::new();
        for part in [&b.no_rawat, &b.tanggal, &b.nama_penanda, &b.hubungan, &b.marking_points, &b.ttd, &b.foto] {
            h.update(part.as_bytes());
        }
        format!("{:x}", h.finalize())
    };
    sqlx::query(
        "INSERT INTO penandaan_area_operasi_ttd \
         (no_rawat, tanggal, nama_penanda, hubungan, marking_points, foto_pasien, tandatangan_pasien, nip, hash_dokumen, pernyataan, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ya', NOW()) \
         ON DUPLICATE KEY UPDATE nama_penanda=VALUES(nama_penanda), hubungan=VALUES(hubungan), \
           marking_points=VALUES(marking_points), \
           foto_pasien=IF(VALUES(foto_pasien)<>'', VALUES(foto_pasien), foto_pasien), \
           tandatangan_pasien=IF(VALUES(tandatangan_pasien)<>'', VALUES(tandatangan_pasien), tandatangan_pasien), \
           nip=VALUES(nip), hash_dokumen=VALUES(hash_dokumen), pernyataan='Ya', updated_at=NOW()"
    ).bind(&b.no_rawat).bind(&b.tanggal).bind(&b.nama_penanda).bind(&b.hubungan)
     .bind(&b.marking_points).bind(&rfoto).bind(&rttd).bind(&user.0.kode).bind(&hash)
     .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode,
        &format!("penandaan_ttd no_rawat={} tgl={} penanda={} hash={}", b.no_rawat, b.tanggal, b.nama_penanda, &hash[..hash.len().min(16)])).await;
    Ok(Json(json!({"ok": true, "hash": hash})))
}

// Hapus TTD/marking penandaan — HANYA oleh user penginput (nip) atau admin.
#[derive(Deserialize)]
pub struct PenandaanDelBody { pub no_rawat: String, #[serde(default)] pub tanggal: String }
pub async fn penandaan_ttd_delete(user: AuthUser, State(state): State<AppState>, Json(b): Json<PenandaanDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "checklist_pre_operasi").await?;
    if b.no_rawat.trim().is_empty() || b.tanggal.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat & tanggal wajib"}))));
    }
    let owner: Option<(String,)> = sqlx::query_as(
        "SELECT IFNULL(nip,'') FROM penandaan_area_operasi_ttd WHERE no_rawat=? AND tanggal=?"
    ).bind(&b.no_rawat).bind(&b.tanggal).fetch_optional(&state.pool).await.map_err(db_err)?;
    let owner = match owner { Some(o) => o.0, None => return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Data tidak ditemukan"})))) };
    if !user.0.is_admin && owner != user.0.kode {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya bisa dihapus oleh petugas yang menginput"}))));
    }
    sqlx::query("DELETE FROM penandaan_area_operasi_ttd WHERE no_rawat=? AND tanggal=?")
        .bind(&b.no_rawat).bind(&b.tanggal).execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("penandaan_ttd DELETE no_rawat={} tgl={}", b.no_rawat, b.tanggal)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Monitoring Peralatan Single Use yang di Reuse (Penata Anestesi) ──────────
// Tiap baris = satu alat. Sinkron dengan form desktop RMMonitoringPeralatanSingleUseReuse.
#[derive(Serialize, sqlx::FromRow)]
pub struct MonitoringSingleUseRow {
    pub id_msur: i64,
    pub tanggal: Option<String>,
    pub nama_alat: String,
    pub ukuran: String,
    pub kode_warna: String,
    pub petugas: String,
    pub nip: String,
}
pub async fn monitoring_single_use_get(_user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Vec<MonitoringSingleUseRow>>, (StatusCode, Json<Value>)> {
    let rows = sqlx::query_as::<_, MonitoringSingleUseRow>(
        "SELECT m.id_msur, CAST(m.tanggal AS CHAR) tanggal, IFNULL(m.nama_alat,'') nama_alat, \
                IFNULL(m.ukuran,'') ukuran, IFNULL(m.kode_warna,'') kode_warna, \
                IFNULL(pg.nama, m.nip) petugas, IFNULL(m.nip,'') nip \
         FROM monitoring_peralatan_single_use_reuse m LEFT JOIN pegawai pg ON pg.nik = m.nip \
         WHERE m.no_rawat = ? ORDER BY m.id_msur"
    ).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct MonitoringSingleUseBody {
    pub no_rawat: String,
    #[serde(default)] pub nama_alat: String,
    #[serde(default)] pub ukuran: String,
    #[serde(default)] pub kode_warna: String,
}
pub async fn monitoring_single_use_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<MonitoringSingleUseBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "checklist_pre_operasi").await?;
    if b.nama_alat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Nama alat wajib diisi"}))));
    }
    sqlx::query(
        "INSERT INTO monitoring_peralatan_single_use_reuse (no_rawat, tanggal, nama_alat, ukuran, kode_warna, nip) \
         VALUES (?, NOW(), ?, ?, ?, ?)"
    ).bind(&b.no_rawat).bind(&b.nama_alat).bind(&b.ukuran).bind(&b.kode_warna).bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("monitoring_single_use no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}
#[derive(Deserialize)]
pub struct MonitoringSingleUseDel { pub id: i64 }
pub async fn monitoring_single_use_delete(user: AuthUser, State(state): State<AppState>, Json(b): Json<MonitoringSingleUseDel>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "checklist_pre_operasi").await?;
    let owner: Option<(String,)> = sqlx::query_as(
        "SELECT IFNULL(nip,'') FROM monitoring_peralatan_single_use_reuse WHERE id_msur=?"
    ).bind(b.id).fetch_optional(&state.pool).await.map_err(db_err)?;
    let owner = match owner { Some(o) => o.0, None => return Err((StatusCode::NOT_FOUND, Json(json!({"error":"Data tidak ditemukan"})))) };
    if !user.0.is_admin && owner != user.0.kode {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya bisa dihapus oleh petugas yang menginput"}))));
    }
    sqlx::query("DELETE FROM monitoring_peralatan_single_use_reuse WHERE id_msur=?")
        .bind(b.id).execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("hapus monitoring_single_use id={}", b.id)).await;
    Ok(Json(json!({"ok": true})))
}

// ═══ Anestesi Sedasi (RM.IBS.11.005.A/B REV.01) — e-Nakes ════════════════════
// 4 fase: pra/selama/pasca = 1 aktif per pasien (replace saat simpan); monitoring
// & monitoring_pasca = multi-baris (tiap simpan = titik pantau baru). Tabel
// catatan_sedasi_* dipakai bersama form Java Khanza. Kolom di-whitelist (aman).
const SED_PRA: &[&str] = &["kd_dokter","kd_penata","asisten","diagnosis","tindakan","jam_awal","jenis_sedasi",
    "cl_informed_consent","cl_obat_anestesi","cl_tatalaksana_napas","cl_mesin_anestesi","cl_obat_emergensi","cl_monitoring","cl_suction",
    "kesadaran","gcs_e","gcs_v","gcs_m","airway","td","nadi","nadi_reg","rr","kanul","o2","spo2"];
const SED_SELAMA: &[&str] = &["letak","airway","lama_sedasi","lama_tindakan","jam_akhir","medikasi"];
const SED_PASCA: &[&str] = &["kd_perawat_ruangan","kesadaran","airway","td","nadi","nadi_reg","rr","kanul","o2","spo2","aldrete",
    "keluar_jam","pindah_ke","ins_pemantauan","ins_posisi","ins_nyeri","ins_mual_muntah","ins_diet","ins_obat_lain","ins_lain"];
const SED_MON: &[&str] = &["o2","spo2","infus","sistol","diastol","nadi","rr","suhu","keterangan","medikasi","perdarahan","urine"];

fn sed_json_expr(cols: &[&str]) -> String {
    let mut s = String::from("'tanggal', CAST(tanggal AS CHAR), 'nip', IFNULL(nip,'')");
    for c in cols { s.push_str(&format!(", '{}', IFNULL(`{}`,'')", c, c)); }
    s
}
async fn sed_get_one(state: &AppState, user: &AuthUser, no_rawat: &str, table: &str, cols: &[&str])
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let sql = format!("SELECT JSON_OBJECT({}, 'milik', (nip = ? OR ? = 1)) FROM {} WHERE no_rawat=? ORDER BY tanggal DESC LIMIT 1", sed_json_expr(cols), table);
    let row: Option<(String,)> = sqlx::query_as(&sql).bind(&user.0.kode).bind(admin).bind(no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    match row {
        None => Ok(Json(json!({"exists": false}))),
        Some(r) => { let mut v: Value = serde_json::from_str(&r.0).unwrap_or_else(|_| json!({})); if let Some(o)=v.as_object_mut(){o.insert("exists".into(), json!(true));} Ok(Json(v)) }
    }
}
async fn sed_list(state: &AppState, user: &AuthUser, no_rawat: &str, table: &str, cols: &[&str])
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let sql = format!("SELECT IFNULL(JSON_ARRAYAGG(JSON_OBJECT({}, 'milik', (nip = ? OR ? = 1))),'[]') FROM (SELECT * FROM {} WHERE no_rawat=? ORDER BY tanggal) t", sed_json_expr(cols), table);
    let row: (String,) = sqlx::query_as(&sql).bind(&user.0.kode).bind(admin).bind(no_rawat).fetch_one(&state.pool).await.map_err(db_err)?;
    Ok(Json(serde_json::from_str(&row.0).unwrap_or_else(|_| json!([]))))
}
async fn sed_save(state: &AppState, user: &AuthUser, table: &str, allowed: &[&str], replace: bool, b: &Value)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let no_rawat = b.get("no_rawat").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
    if no_rawat.is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"})))); }
    let tgl_in = b.get("tanggal").and_then(|v| v.as_str()).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let is_edit = b.get("edit").and_then(|v| v.as_bool()).unwrap_or(false);
    let orig_tgl = b.get("orig_tanggal").and_then(|v| v.as_str()).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let empty = serde_json::Map::new();
    let obj = b.as_object().unwrap_or(&empty);
    let cols: Vec<&str> = allowed.iter().copied().filter(|c| obj.contains_key(*c)).collect();
    if replace {
        // form tunggal per no_rawat: tolak bila milik petugas lain, lalu ganti.
        let owner: Option<String> = sqlx::query_scalar(&format!("SELECT IFNULL(nip,'') FROM {} WHERE no_rawat=? ORDER BY tanggal DESC LIMIT 1", table))
            .bind(&no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
        if let Some(o) = owner { if !o.is_empty() && !user.0.is_admin && o != user.0.kode {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Data ini dibuat petugas lain — tidak dapat diubah"}))));
        }}
        sqlx::query(&format!("DELETE FROM {} WHERE no_rawat=?", table)).bind(&no_rawat).execute(&state.pool).await.map_err(db_err)?;
    } else if is_edit {
        // append log: edit-in-place → hapus baris lama milik user lalu INSERT ulang.
        let Some(ot) = &orig_tgl else { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"orig_tanggal wajib untuk edit"})))); };
        let res = sqlx::query(&format!("DELETE FROM {} WHERE no_rawat=? AND tanggal=? AND (nip=? OR ?=1)", table))
            .bind(&no_rawat).bind(ot).bind(&user.0.kode).bind(admin).execute(&state.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat mengubah"}))));
        }
    }
    let col_sql: String = cols.iter().map(|c| format!(", `{}`", c)).collect();
    let ph: String = cols.iter().map(|_| ", ?").collect();
    let tgl_expr = if tgl_in.is_some() { "?" } else { "NOW()" };
    let sql = format!("INSERT INTO {} (no_rawat, tanggal, nip{}) VALUES (?, {}, ?{})", table, col_sql, tgl_expr, ph);
    let mut q = sqlx::query(&sql).bind(&no_rawat);
    if let Some(t) = &tgl_in { q = q.bind(t.replace('T', " ")); }
    q = q.bind(&user.0.kode);
    for c in &cols {
        let val = obj.get(*c).map(|v| match v {
            Value::String(s) => s.clone(),
            Value::Bool(x) => if *x { "Ya".to_string() } else { "Tidak".to_string() },
            Value::Null => String::new(),
            other => other.to_string(),
        }).unwrap_or_default();
        q = q.bind(val);
    }
    q.execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("{} no_rawat={}", table, no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}
async fn sed_hapus(state: &AppState, user: &AuthUser, table: &str, b: &ChkDelBody)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let res = sqlx::query(&format!("DELETE FROM {} WHERE no_rawat=? AND tanggal=? AND (nip=? OR ?=1)", table))
        .bind(&b.no_rawat).bind(&b.tanggal).bind(&user.0.kode).bind(admin).execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 { return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat menghapus"})))); }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("HAPUS {} no_rawat={} tgl={}", table, b.no_rawat, b.tanggal)).await;
    Ok(Json(json!({"ok": true})))
}
// ── endpoints ──
pub async fn sedasi_pra_get(u: AuthUser, State(s): State<AppState>, Query(q): Query<NoRawatOnly>) -> Result<Json<Value>, (StatusCode, Json<Value>)> { sed_get_one(&s, &u, &q.no_rawat, "catatan_sedasi_pra", SED_PRA).await }
pub async fn sedasi_pra_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<Value>) -> Result<Json<Value>, (StatusCode, Json<Value>)> { sed_save(&s, &u, "catatan_sedasi_pra", SED_PRA, true, &b).await }
pub async fn sedasi_selama_get(u: AuthUser, State(s): State<AppState>, Query(q): Query<NoRawatOnly>) -> Result<Json<Value>, (StatusCode, Json<Value>)> { sed_get_one(&s, &u, &q.no_rawat, "catatan_sedasi_selama", SED_SELAMA).await }
pub async fn sedasi_selama_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<Value>) -> Result<Json<Value>, (StatusCode, Json<Value>)> { sed_save(&s, &u, "catatan_sedasi_selama", SED_SELAMA, true, &b).await }
pub async fn sedasi_pasca_get(u: AuthUser, State(s): State<AppState>, Query(q): Query<NoRawatOnly>) -> Result<Json<Value>, (StatusCode, Json<Value>)> { sed_get_one(&s, &u, &q.no_rawat, "catatan_sedasi_pasca", SED_PASCA).await }
pub async fn sedasi_pasca_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<Value>) -> Result<Json<Value>, (StatusCode, Json<Value>)> { sed_save(&s, &u, "catatan_sedasi_pasca", SED_PASCA, true, &b).await }
pub async fn sedasi_mon_list(u: AuthUser, State(s): State<AppState>, Query(q): Query<NoRawatOnly>) -> Result<Json<Value>, (StatusCode, Json<Value>)> { sed_list(&s, &u, &q.no_rawat, "catatan_sedasi_monitoring", SED_MON).await }
pub async fn sedasi_mon_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<Value>) -> Result<Json<Value>, (StatusCode, Json<Value>)> { sed_save(&s, &u, "catatan_sedasi_monitoring", SED_MON, false, &b).await }
pub async fn sedasi_mon_hapus(u: AuthUser, State(s): State<AppState>, Json(b): Json<ChkDelBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> { sed_hapus(&s, &u, "catatan_sedasi_monitoring", &b).await }
pub async fn sedasi_monp_list(u: AuthUser, State(s): State<AppState>, Query(q): Query<NoRawatOnly>) -> Result<Json<Value>, (StatusCode, Json<Value>)> { sed_list(&s, &u, &q.no_rawat, "catatan_sedasi_monitoring_pasca", SED_MON).await }
pub async fn sedasi_monp_save(u: AuthUser, State(s): State<AppState>, Json(b): Json<Value>) -> Result<Json<Value>, (StatusCode, Json<Value>)> { sed_save(&s, &u, "catatan_sedasi_monitoring_pasca", SED_MON, false, &b).await }
pub async fn sedasi_monp_hapus(u: AuthUser, State(s): State<AppState>, Json(b): Json<ChkDelBody>) -> Result<Json<Value>, (StatusCode, Json<Value>)> { sed_hapus(&s, &u, "catatan_sedasi_monitoring_pasca", &b).await }

// ── Monitoring Status Fisiologis Anestesi/Sedasi Diluar Kamar Operasi (RM.IBS.11.011) ──
//    Header: monitoring_anestesirscb (1 baris per no_rawat). Detail: monitoring_anestesirscb_detail (banyak).
//    Semua kolom NOT NULL tanpa default → selalu bind string (default '').
const MON_ANES_H: &[&str] = &["diagnosa","tindakan","ruangan","keadaanumum","kesadaran","anamnesis","gcs","bb","tb","lain"];

pub async fn mon_anes_get(user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatOnly>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    use sqlx::Row;
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let sel_h = MON_ANES_H.iter().map(|c| format!("IFNULL(`{c}`,'') `{c}`")).collect::<Vec<_>>().join(", ");
    let hsql = format!("SELECT {sel_h}, (nip=? OR ?=1) milik FROM monitoring_anestesirscb WHERE no_rawat=? LIMIT 1");
    let header = match sqlx::query(&hsql).bind(&user.0.kode).bind(admin).bind(&q.no_rawat)
        .fetch_optional(&state.pool).await.map_err(db_err)? {
        Some(r) => {
            let mut m = serde_json::Map::new();
            for c in MON_ANES_H { m.insert((*c).to_string(), Value::String(r.try_get::<String,_>(*c).unwrap_or_default())); }
            m.insert("milik".to_string(), Value::from(r.try_get::<i64,_>("milik").unwrap_or(0)));
            Value::Object(m)
        }
        None => Value::Null,
    };
    let drows = sqlx::query(
        "SELECT CAST(tgl_perawatan AS CHAR) tgl_perawatan, CAST(jam_rawat AS CHAR) jam_rawat, IFNULL(waktu,'') waktu, \
         IFNULL(obat,'') obat, IFNULL(dosis,'') dosis, IFNULL(tensi,'') tensi, IFNULL(nadi,'') nadi, IFNULL(rr,'') rr, IFNULL(suhu,'') suhu, \
         IFNULL(pg.nama, d.nip) petugas, (d.nip=? OR ?=1) milik \
         FROM monitoring_anestesirscb_detail d LEFT JOIN pegawai pg ON pg.nik=d.nip \
         WHERE d.no_rawat=? ORDER BY d.tgl_perawatan, d.jam_rawat")
        .bind(&user.0.kode).bind(admin).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    let detail: Vec<Value> = drows.iter().map(|r| json!({
        "tgl_perawatan": r.try_get::<String,_>("tgl_perawatan").unwrap_or_default(),
        "jam_rawat": r.try_get::<String,_>("jam_rawat").unwrap_or_default(),
        "waktu": r.try_get::<String,_>("waktu").unwrap_or_default(),
        "obat": r.try_get::<String,_>("obat").unwrap_or_default(),
        "dosis": r.try_get::<String,_>("dosis").unwrap_or_default(),
        "tensi": r.try_get::<String,_>("tensi").unwrap_or_default(),
        "nadi": r.try_get::<String,_>("nadi").unwrap_or_default(),
        "rr": r.try_get::<String,_>("rr").unwrap_or_default(),
        "suhu": r.try_get::<String,_>("suhu").unwrap_or_default(),
        "petugas": r.try_get::<String,_>("petugas").unwrap_or_default(),
        "milik": r.try_get::<i64,_>("milik").unwrap_or(0),
    })).collect();
    Ok(Json(json!({"header": header, "detail": detail})))
}

#[derive(Deserialize)]
pub struct MonAnesHeaderBody { pub no_rawat: String, #[serde(default)] pub values: std::collections::HashMap<String, String> }
pub async fn mon_anes_header_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<MonAnesHeaderBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "tindakan_ranap").await?;
    if b.no_rawat.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"})))); }
    let owner: Option<String> = sqlx::query_scalar("SELECT IFNULL(nip,'') FROM monitoring_anestesirscb WHERE no_rawat=? LIMIT 1")
        .bind(&b.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    if let Some(o) = owner { if !o.is_empty() && !user.0.is_admin && o != user.0.kode {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Data ini dibuat petugas lain — tidak dapat diubah"}))));
    }}
    sqlx::query("DELETE FROM monitoring_anestesirscb WHERE no_rawat=?").bind(&b.no_rawat).execute(&state.pool).await.map_err(db_err)?;
    let g = |k: &str| b.values.get(k).map(|s| s.trim().to_string()).unwrap_or_default();
    let cols_sql = MON_ANES_H.iter().map(|c| format!(", `{c}`")).collect::<String>();
    let ph = MON_ANES_H.iter().map(|_| ", ?").collect::<String>();
    let sql = format!("INSERT INTO monitoring_anestesirscb (no_rawat, tgl_perawatan, jam_rawat, nip{cols_sql}) VALUES (?, CURDATE(), CURTIME(), ?{ph})");
    let mut qq = sqlx::query(&sql).bind(&b.no_rawat).bind(&user.0.kode);
    for c in MON_ANES_H { qq = qq.bind(g(c)); }
    qq.execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("monitoring_anestesirscb no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
pub struct MonAnesDetailBody {
    pub no_rawat: String,
    #[serde(default)] pub waktu: String, #[serde(default)] pub obat: String, #[serde(default)] pub dosis: String,
    #[serde(default)] pub tensi: String, #[serde(default)] pub nadi: String, #[serde(default)] pub rr: String, #[serde(default)] pub suhu: String,
}
pub async fn mon_anes_detail_add(user: AuthUser, State(state): State<AppState>, Json(b): Json<MonAnesDetailBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "tindakan_ranap").await?;
    if b.no_rawat.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"})))); }
    let waktu = norm_enum(&b.waktu, &["Pre Anestesi","Durante Anestesi","Post Anestesi"]);
    sqlx::query("INSERT INTO monitoring_anestesirscb_detail (no_rawat, tgl_perawatan, jam_rawat, nip, obat, dosis, waktu, tensi, nadi, rr, suhu) VALUES (?, CURDATE(), CURTIME(), ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&b.no_rawat).bind(&user.0.kode)
        .bind(b.obat.trim()).bind(b.dosis.trim()).bind(&waktu)
        .bind(b.tensi.trim()).bind(b.nadi.trim()).bind(b.rr.trim()).bind(b.suhu.trim())
        .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("monitoring_anestesirscb_detail no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
pub struct MonAnesDetailDel { pub no_rawat: String, pub tgl_perawatan: String, pub jam_rawat: String }
pub async fn mon_anes_detail_hapus(user: AuthUser, State(state): State<AppState>, Json(b): Json<MonAnesDetailDel>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    require_perm(&state, &user, "tindakan_ranap").await?;
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let res = sqlx::query("DELETE FROM monitoring_anestesirscb_detail WHERE no_rawat=? AND tgl_perawatan=? AND jam_rawat=? AND (nip=? OR ?=1)")
        .bind(&b.no_rawat).bind(&b.tgl_perawatan).bind(&b.jam_rawat).bind(&user.0.kode).bind(admin)
        .execute(&state.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 { return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Tidak dapat menghapus (bukan pembuat / tidak ditemukan)"})))); }
    Ok(Json(json!({"ok": true})))
}
