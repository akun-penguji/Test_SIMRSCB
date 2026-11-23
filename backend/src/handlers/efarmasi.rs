// e-Farmasi — aplikasi web petugas farmasi (mobile). Isi sama dgn edokter
// (SOAPIE/Resep/Lab/Radiologi per pasien) tapi login = PETUGAS (pegawai),
// dan menampilkan SEMUA pasien (farmasi melayani lintas dokter).
//
// Endpoint detail (soapie/resep/lab/rad) memakai kembali handler edokter
// (semua by no_rawat). Di sini hanya identitas petugas + daftar pasien.

use crate::{auth::middleware::AuthUser, handlers::edokter::PasienRow, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB efarmasi: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Gagal akses data efarmasi"})))
}

// ── GET /efarmasi/me — identitas petugas login ───────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct PetugasMe {
    pub nik: String,
    pub nama: String,
    pub jabatan: String,
    pub departemen: String,
}
pub async fn me(user: AuthUser, State(state): State<AppState>)
  -> Result<Json<PetugasMe>, (StatusCode, Json<Value>)> {
    let row: Option<PetugasMe> = sqlx::query_as(
        "SELECT pg.nik, pg.nama, IFNULL(jb.nm_jbtn,'') AS jabatan, IFNULL(dp.nama,'') AS departemen \
         FROM pegawai pg \
         LEFT JOIN jabatan jb ON pg.jbtn = jb.kd_jbtn \
         LEFT JOIN departemen dp ON pg.departemen = dp.dep_id \
         WHERE pg.nik = ?"
    ).bind(&user.0.kode).fetch_optional(&state.pool).await.map_err(db_err)?;
    Ok(Json(row.unwrap_or(PetugasMe {
        nik: user.0.kode.clone(), nama: "Petugas Farmasi".to_string(),
        jabatan: String::new(), departemen: "Farmasi".to_string(),
    })))
}

// ── GET /efarmasi/pasien?jenis=ralan|igd|ranap — SEMUA pasien ────────────────
#[derive(Deserialize)]
pub struct PasienQuery {
    #[serde(default)] pub jenis: Option<String>,
    #[serde(default)] pub cari: Option<String>,
    #[serde(default)] pub tgl_awal: Option<String>,
    #[serde(default)] pub tgl_akhir: Option<String>,
}
pub async fn list_pasien(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<PasienQuery>,
) -> Result<Json<Vec<PasienRow>>, (StatusCode, Json<Value>)> {
    let jenis = q.jenis.unwrap_or_else(|| "ralan".to_string());
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tgl_awal = q.tgl_awal.unwrap_or_else(|| today.clone());
    let tgl_akhir = q.tgl_akhir.unwrap_or_else(|| today.clone());
    let cari_like = format!("%{}%", q.cari.unwrap_or_default());

    let data: Vec<PasienRow> = match jenis.as_str() {
        "ranap" => sqlx::query_as(
            "SELECT rp.no_rawat, rp.no_reg, CAST(ki.tgl_masuk AS CHAR) AS tgl, CAST(ki.jam_masuk AS CHAR) AS jam, \
                    p.no_rkm_medis AS no_rm, p.nm_pasien, p.jk, \
                    CONCAT(IFNULL(rp.umurdaftar,''),' ',IFNULL(rp.sttsumur,'')) AS umur, \
                    CONCAT(IFNULL(b.nm_bangsal,''),' - ',IFNULL(ki.kd_kamar,'')) AS lokasi, \
                    pj.png_jawab, ki.stts_pulang AS status, d.nm_dokter AS dokter \
             FROM kamar_inap ki \
             INNER JOIN reg_periksa rp ON rp.no_rawat = ki.no_rawat \
             INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis \
             LEFT JOIN kamar k ON k.kd_kamar = ki.kd_kamar \
             LEFT JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal \
             LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj \
             LEFT JOIN dokter d ON d.kd_dokter = rp.kd_dokter \
             WHERE ki.stts_pulang IN ('-','Masih Dirawat') \
               AND (p.nm_pasien LIKE ? OR rp.no_rawat LIKE ? OR p.no_rkm_medis LIKE ?) \
             ORDER BY ki.tgl_masuk DESC, ki.jam_masuk DESC LIMIT 300"
        )
        .bind(&cari_like).bind(&cari_like).bind(&cari_like)
        .fetch_all(&state.pool).await.map_err(db_err)?,

        jenis_val => {
            let is_igd = jenis_val == "igd";
            let sql = format!(
                "SELECT r.no_rawat, r.no_reg, CAST(r.tgl_registrasi AS CHAR) AS tgl, CAST(r.jam_reg AS CHAR) AS jam, \
                        p.no_rkm_medis AS no_rm, p.nm_pasien, p.jk, \
                        CONCAT(IFNULL(r.umurdaftar,''),' ',IFNULL(r.sttsumur,'')) AS umur, \
                        po.nm_poli AS lokasi, pj.png_jawab, r.stts AS status, dr.nm_dokter AS dokter \
                 FROM reg_periksa r \
                 INNER JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis \
                 LEFT JOIN poliklinik po ON r.kd_poli = po.kd_poli \
                 LEFT JOIN penjab pj ON r.kd_pj = pj.kd_pj \
                 LEFT JOIN dokter dr ON dr.kd_dokter = r.kd_dokter \
                 WHERE r.kd_poli {} 'IGDK' AND r.tgl_registrasi BETWEEN ? AND ? {} \
                   AND (p.nm_pasien LIKE ? OR r.no_rawat LIKE ? OR p.no_rkm_medis LIKE ?) \
                 ORDER BY r.tgl_registrasi DESC, r.jam_reg DESC LIMIT 300",
                if is_igd { "=" } else { "!=" },
                // Tab Rawat Jalan: hanya pasien rawat jalan murni — kecualikan yang
                // punya baris di kamar_inap (dirawat inap). IGD tidak difilter.
                if is_igd { "" } else { "AND NOT EXISTS (SELECT 1 FROM kamar_inap ki WHERE ki.no_rawat = r.no_rawat)" }
            );
            sqlx::query_as(&sql)
                .bind(&tgl_awal).bind(&tgl_akhir)
                .bind(&cari_like).bind(&cari_like).bind(&cari_like)
                .fetch_all(&state.pool).await.map_err(db_err)?
        }
    };
    Ok(Json(data))
}

// ── Telaah Resep (telaah_farmasi, per no_resep) ──────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct ResepTelaah {
    pub no_resep: String, pub tgl: Option<String>, pub jam: Option<String>,
    pub jml: i64, pub sudah: i64,
}
#[derive(Deserialize)]
pub struct NoRawatQuery { pub no_rawat: String }
pub async fn resep_telaah_list(_user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatQuery>)
  -> Result<Json<Vec<ResepTelaah>>, (StatusCode, Json<Value>)> {
    let rows = sqlx::query_as::<_, ResepTelaah>(
        "SELECT ro.no_resep, CAST(ro.tgl_perawatan AS CHAR) tgl, CAST(ro.jam AS CHAR) jam, \
                (SELECT COUNT(*) FROM resep_dokter rd WHERE rd.no_resep=ro.no_resep) \
                 + (SELECT COUNT(*) FROM resep_dokter_racikan rr WHERE rr.no_resep=ro.no_resep) AS jml, \
                (SELECT COUNT(*) FROM telaah_farmasi t WHERE t.no_resep=ro.no_resep) AS sudah \
         FROM resep_obat ro WHERE ro.no_rawat=? ORDER BY ro.tgl_peresepan DESC, ro.jam DESC LIMIT 100"
    ).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

#[derive(Serialize, sqlx::FromRow, Deserialize, Default)]
pub struct Telaah {
    #[serde(default)] pub no_resep: String,
    #[serde(default)] pub resep_identifikasi_pasien: String, #[serde(default)] pub resep_ket_identifikasi_pasien: String,
    #[serde(default)] pub resep_tepat_obat: String, #[serde(default)] pub resep_ket_tepat_obat: String,
    #[serde(default)] pub resep_tepat_dosis: String, #[serde(default)] pub resep_ket_tepat_dosis: String,
    #[serde(default)] pub resep_tepat_cara_pemberian: String, #[serde(default)] pub resep_ket_tepat_cara_pemberian: String,
    #[serde(default)] pub resep_tepat_waktu_pemberian: String, #[serde(default)] pub resep_ket_tepat_waktu_pemberian: String,
    #[serde(default)] pub resep_ada_tidak_duplikasi_obat: String, #[serde(default)] pub resep_ket_ada_tidak_duplikasi_obat: String,
    #[serde(default)] pub resep_interaksi_obat: String, #[serde(default)] pub resep_ket_interaksi_obat: String,
    #[serde(default)] pub resep_kontra_indikasi_obat: String, #[serde(default)] pub resep_ket_kontra_indikasi_obat: String,
    #[serde(default)] pub obat_tepat_pasien: String, #[serde(default)] pub obat_tepat_obat: String,
    #[serde(default)] pub obat_tepat_dosis: String, #[serde(default)] pub obat_tepat_cara_pemberian: String,
    #[serde(default)] pub obat_tepat_waktu_pemberian: String,
}
#[derive(Deserialize)]
pub struct NoResepQuery { pub no_resep: String }
pub async fn telaah_get(_user: AuthUser, State(state): State<AppState>, Query(q): Query<NoResepQuery>)
  -> Result<Json<Telaah>, (StatusCode, Json<Value>)> {
    let row: Option<Telaah> = sqlx::query_as(
        "SELECT no_resep, resep_identifikasi_pasien, resep_ket_identifikasi_pasien, resep_tepat_obat, resep_ket_tepat_obat, \
         resep_tepat_dosis, resep_ket_tepat_dosis, resep_tepat_cara_pemberian, resep_ket_tepat_cara_pemberian, \
         resep_tepat_waktu_pemberian, resep_ket_tepat_waktu_pemberian, resep_ada_tidak_duplikasi_obat, resep_ket_ada_tidak_duplikasi_obat, \
         resep_interaksi_obat, resep_ket_interaksi_obat, resep_kontra_indikasi_obat, resep_ket_kontra_indikasi_obat, \
         obat_tepat_pasien, obat_tepat_obat, obat_tepat_dosis, obat_tepat_cara_pemberian, obat_tepat_waktu_pemberian \
         FROM telaah_farmasi WHERE no_resep=?"
    ).bind(&q.no_resep).fetch_optional(&state.pool).await.map_err(db_err)?;
    Ok(Json(row.unwrap_or_default()))
}
pub async fn telaah_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<Telaah>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let d = |s: &str| if s == "Tidak" { "Tidak" } else { "Ya" }.to_string();
    sqlx::query(
        "INSERT INTO telaah_farmasi (no_resep, resep_identifikasi_pasien, resep_ket_identifikasi_pasien, resep_tepat_obat, resep_ket_tepat_obat, \
         resep_tepat_dosis, resep_ket_tepat_dosis, resep_tepat_cara_pemberian, resep_ket_tepat_cara_pemberian, \
         resep_tepat_waktu_pemberian, resep_ket_tepat_waktu_pemberian, resep_ada_tidak_duplikasi_obat, resep_ket_ada_tidak_duplikasi_obat, \
         resep_interaksi_obat, resep_ket_interaksi_obat, resep_kontra_indikasi_obat, resep_ket_kontra_indikasi_obat, \
         obat_tepat_pasien, obat_tepat_obat, obat_tepat_dosis, obat_tepat_cara_pemberian, obat_tepat_waktu_pemberian, nip) \
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) \
         ON DUPLICATE KEY UPDATE resep_identifikasi_pasien=VALUES(resep_identifikasi_pasien), resep_ket_identifikasi_pasien=VALUES(resep_ket_identifikasi_pasien), \
         resep_tepat_obat=VALUES(resep_tepat_obat), resep_ket_tepat_obat=VALUES(resep_ket_tepat_obat), resep_tepat_dosis=VALUES(resep_tepat_dosis), resep_ket_tepat_dosis=VALUES(resep_ket_tepat_dosis), \
         resep_tepat_cara_pemberian=VALUES(resep_tepat_cara_pemberian), resep_ket_tepat_cara_pemberian=VALUES(resep_ket_tepat_cara_pemberian), \
         resep_tepat_waktu_pemberian=VALUES(resep_tepat_waktu_pemberian), resep_ket_tepat_waktu_pemberian=VALUES(resep_ket_tepat_waktu_pemberian), \
         resep_ada_tidak_duplikasi_obat=VALUES(resep_ada_tidak_duplikasi_obat), resep_ket_ada_tidak_duplikasi_obat=VALUES(resep_ket_ada_tidak_duplikasi_obat), \
         resep_interaksi_obat=VALUES(resep_interaksi_obat), resep_ket_interaksi_obat=VALUES(resep_ket_interaksi_obat), \
         resep_kontra_indikasi_obat=VALUES(resep_kontra_indikasi_obat), resep_ket_kontra_indikasi_obat=VALUES(resep_ket_kontra_indikasi_obat), \
         obat_tepat_pasien=VALUES(obat_tepat_pasien), obat_tepat_obat=VALUES(obat_tepat_obat), obat_tepat_dosis=VALUES(obat_tepat_dosis), \
         obat_tepat_cara_pemberian=VALUES(obat_tepat_cara_pemberian), obat_tepat_waktu_pemberian=VALUES(obat_tepat_waktu_pemberian), nip=VALUES(nip)"
    )
    .bind(&b.no_resep)
    .bind(d(&b.resep_identifikasi_pasien)).bind(&b.resep_ket_identifikasi_pasien)
    .bind(d(&b.resep_tepat_obat)).bind(&b.resep_ket_tepat_obat)
    .bind(d(&b.resep_tepat_dosis)).bind(&b.resep_ket_tepat_dosis)
    .bind(d(&b.resep_tepat_cara_pemberian)).bind(&b.resep_ket_tepat_cara_pemberian)
    .bind(d(&b.resep_tepat_waktu_pemberian)).bind(&b.resep_ket_tepat_waktu_pemberian)
    .bind(d(&b.resep_ada_tidak_duplikasi_obat)).bind(&b.resep_ket_ada_tidak_duplikasi_obat)
    .bind(d(&b.resep_interaksi_obat)).bind(&b.resep_ket_interaksi_obat)
    .bind(d(&b.resep_kontra_indikasi_obat)).bind(&b.resep_ket_kontra_indikasi_obat)
    .bind(d(&b.obat_tepat_pasien)).bind(d(&b.obat_tepat_obat)).bind(d(&b.obat_tepat_dosis))
    .bind(d(&b.obat_tepat_cara_pemberian)).bind(d(&b.obat_tepat_waktu_pemberian))
    .bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("telaah_farmasi no_resep={}", b.no_resep)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Alergi Pasien ────────────────────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct Alergi {
    pub tgl: Option<String>, pub allergy_code: String, pub category: String,
    pub note: String, pub reactioncode: String, pub severity: String,
}
#[derive(Serialize)]
pub struct AlergiResp { pub list: Vec<Alergi>, pub catatan: String }
pub async fn alergi_get(_user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatQuery>)
  -> Result<Json<AlergiResp>, (StatusCode, Json<Value>)> {
    let list = sqlx::query_as::<_, Alergi>(
        "SELECT CAST(tgl_perawatan AS CHAR) tgl, IFNULL(allergy_code,'') allergy_code, IFNULL(category,'') category, \
                IFNULL(note,'') note, IFNULL(reactioncode,'') reactioncode, IFNULL(severity,'') severity \
         FROM alergi_pasien WHERE no_rawat=? ORDER BY tgl_perawatan DESC"
    ).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    let catatan: Option<(String,)> = sqlx::query_as(
        "SELECT IFNULL(cpa.catatan,'') FROM catatan_pasien_alergi cpa \
         INNER JOIN reg_periksa rp ON rp.no_rkm_medis=cpa.no_rkm_medis WHERE rp.no_rawat=? LIMIT 1"
    ).bind(&q.no_rawat).fetch_optional(&state.pool).await.map_err(db_err)?;
    Ok(Json(AlergiResp { list, catatan: catatan.map(|c| c.0).unwrap_or_default() }))
}
#[derive(Deserialize)]
pub struct AlergiBody {
    pub no_rawat: String,
    #[serde(default)] pub category: String, #[serde(default)] pub allergy_code: String,
    #[serde(default)] pub note: String, #[serde(default)] pub reactioncode: String, #[serde(default)] pub severity: String,
}
pub async fn alergi_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<AlergiBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.allergy_code.trim().is_empty() && b.note.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Isi alergi/keterangan"}))));
    }
    sqlx::query(
        "INSERT INTO alergi_pasien (no_rawat, tgl_perawatan, allergy_code, category, nippetugas, note, reactioncode, severity) \
         VALUES (?, NOW(), ?, ?, ?, ?, ?, ?)"
    )
    .bind(&b.no_rawat).bind(&b.allergy_code).bind(&b.category).bind(&user.0.kode)
    .bind(&b.note).bind(&b.reactioncode).bind(&b.severity)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("alergi_pasien no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Pemberian Obat (e-MAR, view) ─────────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct PemberianObat {
    pub tgl: Option<String>, pub jam: Option<String>, pub nama: String,
    pub jml: Option<String>, pub status: String, pub bangsal: String,
}
pub async fn pemberian_obat_list(_user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatQuery>)
  -> Result<Json<Vec<PemberianObat>>, (StatusCode, Json<Value>)> {
    let rows = sqlx::query_as::<_, PemberianObat>(
        "SELECT CAST(dpo.tgl_perawatan AS CHAR) tgl, CAST(dpo.jam AS CHAR) jam, IFNULL(db.nama_brng,dpo.kode_brng) nama, \
                CAST(dpo.jml AS CHAR) jml, IFNULL(dpo.status,'') status, IFNULL(b.nm_bangsal,'') bangsal \
         FROM detail_pemberian_obat dpo \
         LEFT JOIN databarang db ON db.kode_brng=dpo.kode_brng \
         LEFT JOIN bangsal b ON b.kd_bangsal=dpo.kd_bangsal \
         WHERE dpo.no_rawat=? ORDER BY dpo.tgl_perawatan DESC, dpo.jam DESC LIMIT 400"
    ).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}

// ── PTO — Pemantauan Terapi Obat (view + add) ────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct Pto {
    pub id: i64, pub nama_obat: String, pub dosis: String, pub cara: String,
    pub tgl_mulai: Option<String>, pub jumlah_hari: Option<i64>, pub keterangan: String, pub status: String,
}
pub async fn pto_list(_user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatQuery>)
  -> Result<Json<Vec<Pto>>, (StatusCode, Json<Value>)> {
    let rows = sqlx::query_as::<_, Pto>(
        "SELECT id, IFNULL(nama_obat,'') nama_obat, IFNULL(dosis,'') dosis, IFNULL(cara_pemberian,'') cara, \
                CAST(tgl_mulai_terapi AS CHAR) tgl_mulai, jumlah_hari, IFNULL(keterangan,'') keterangan, IFNULL(status,'') status \
         FROM pemantauan_terapi_obat WHERE no_rawat=? ORDER BY tgl_mulai_terapi DESC, id DESC LIMIT 200"
    ).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct PtoBody {
    pub no_rawat: String,
    #[serde(default)] pub nama_obat: String, #[serde(default)] pub jenis_obat: String,
    #[serde(default)] pub dosis: String, #[serde(default)] pub cara_pemberian: String,
    #[serde(default)] pub tgl_mulai_terapi: Option<String>, #[serde(default)] pub jumlah_hari: Option<i64>,
    #[serde(default)] pub keterangan: String, #[serde(default)] pub status: String,
}
pub async fn pto_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<PtoBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if b.nama_obat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"Nama obat wajib diisi"}))));
    }
    let tgl = b.tgl_mulai_terapi.filter(|s| !s.is_empty());
    sqlx::query(
        "INSERT INTO pemantauan_terapi_obat (no_rawat, kd_obat, nama_obat, jenis_obat, dosis, cara_pemberian, \
         tgl_mulai_terapi, jumlah_hari, keterangan, status, nip_petugas, waktu_simpan) \
         VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())"
    )
    .bind(&b.no_rawat).bind(&b.nama_obat).bind(&b.jenis_obat).bind(&b.dosis).bind(&b.cara_pemberian)
    .bind(&tgl).bind(b.jumlah_hari.unwrap_or(0)).bind(&b.keterangan)
    .bind(if b.status.is_empty() { "Aktif".to_string() } else { b.status.clone() }).bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("pemantauan_terapi_obat no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}

// ── Rekonsiliasi Obat (view + add) ───────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct RekDetail {
    pub nama_obat: String, pub dosis_obat: String, pub frekuensi: String,
    pub cara_pemberian: String, pub tindak_lanjut: String, pub perubahan_aturan_pakai: String,
}
#[derive(Serialize)]
pub struct Rekonsiliasi {
    pub no_rekonsiliasi: String, pub tanggal: Option<String>, pub rekonsiliasi_obat_saat: String,
    pub alergi_obat: String, pub manifestasi_alergi: String, pub detail: Vec<RekDetail>,
}
#[derive(sqlx::FromRow)]
struct RekHead {
    no_rekonsiliasi: String, tanggal: Option<String>, rekonsiliasi_obat_saat: String,
    alergi_obat: String, manifestasi_alergi: String,
}
pub async fn rekonsiliasi_list(_user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatQuery>)
  -> Result<Json<Vec<Rekonsiliasi>>, (StatusCode, Json<Value>)> {
    let heads = sqlx::query_as::<_, RekHead>(
        "SELECT no_rekonsiliasi, CAST(tanggal_wawancara AS CHAR) tanggal, IFNULL(rekonsiliasi_obat_saat,'') rekonsiliasi_obat_saat, \
                IFNULL(alergi_obat,'') alergi_obat, IFNULL(manifestasi_alergi,'') manifestasi_alergi \
         FROM rekonsiliasi_obat WHERE no_rawat=? ORDER BY tanggal_wawancara DESC LIMIT 50"
    ).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    let mut out = Vec::new();
    for h in heads {
        let detail = sqlx::query_as::<_, RekDetail>(
            "SELECT IFNULL(nama_obat,'') nama_obat, IFNULL(dosis_obat,'') dosis_obat, IFNULL(frekuensi,'') frekuensi, \
                    IFNULL(cara_pemberian,'') cara_pemberian, IFNULL(tindak_lanjut,'') tindak_lanjut, IFNULL(perubahan_aturan_pakai,'') perubahan_aturan_pakai \
             FROM rekonsiliasi_obat_detail_obat WHERE no_rekonsiliasi=?"
        ).bind(&h.no_rekonsiliasi).fetch_all(&state.pool).await.map_err(db_err)?;
        out.push(Rekonsiliasi {
            no_rekonsiliasi: h.no_rekonsiliasi, tanggal: h.tanggal, rekonsiliasi_obat_saat: h.rekonsiliasi_obat_saat,
            alergi_obat: h.alergi_obat, manifestasi_alergi: h.manifestasi_alergi, detail,
        });
    }
    Ok(Json(out))
}
#[derive(Deserialize)]
pub struct RekDetailIn {
    #[serde(default)] pub nama_obat: String, #[serde(default)] pub dosis_obat: String,
    #[serde(default)] pub frekuensi: String, #[serde(default)] pub cara_pemberian: String,
    #[serde(default)] pub tindak_lanjut: String,
}
#[derive(Deserialize)]
pub struct RekBody {
    pub no_rawat: String,
    #[serde(default)] pub rekonsiliasi_obat_saat: String,
    #[serde(default)] pub alergi_obat: String, #[serde(default)] pub manifestasi_alergi: String,
    #[serde(default)] pub obat: Vec<RekDetailIn>,
}
pub async fn rekonsiliasi_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<RekBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let tgl = chrono::Local::now();
    let prefix = format!("RK{}", tgl.format("%Y%m%d"));
    let seq: (i64,) = sqlx::query_as(
        "SELECT IFNULL(MAX(CAST(RIGHT(no_rekonsiliasi,4) AS UNSIGNED)),0)+1 FROM rekonsiliasi_obat WHERE no_rekonsiliasi LIKE ?"
    ).bind(format!("{}%", prefix)).fetch_one(&state.pool).await.map_err(db_err)?;
    let no_rek = format!("{}{:04}", prefix, seq.0);
    sqlx::query(
        "INSERT INTO rekonsiliasi_obat (no_rekonsiliasi, no_rawat, tanggal_wawancara, rekonsiliasi_obat_saat, alergi_obat, manifestasi_alergi, dampak_alergi, nip) \
         VALUES (?, ?, NOW(), ?, ?, ?, '', ?)"
    )
    .bind(&no_rek).bind(&b.no_rawat).bind(&b.rekonsiliasi_obat_saat).bind(&b.alergi_obat).bind(&b.manifestasi_alergi).bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;
    for o in b.obat.iter().filter(|o| !o.nama_obat.trim().is_empty()) {
        sqlx::query(
            "INSERT INTO rekonsiliasi_obat_detail_obat (no_rekonsiliasi, nama_obat, dosis_obat, frekuensi, cara_pemberian, waktu_pemberian_terakhir, tindak_lanjut, perubahan_aturan_pakai) \
             VALUES (?, ?, ?, ?, ?, '', ?, '')"
        ).bind(&no_rek).bind(&o.nama_obat).bind(&o.dosis_obat).bind(&o.frekuensi).bind(&o.cara_pemberian).bind(&o.tindak_lanjut)
        .execute(&state.pool).await.map_err(db_err)?;
    }
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("rekonsiliasi_obat {} no_rawat={}", no_rek, b.no_rawat)).await;
    Ok(Json(json!({"ok": true, "no_rekonsiliasi": no_rek})))
}

// ── Konseling Farmasi (view + add) ───────────────────────────────────────────
#[derive(Serialize, sqlx::FromRow)]
pub struct Konseling {
    pub tanggal: Option<String>, pub diagnosa: String, pub obat_pemakaian: String,
    pub riwayat_alergi: String, pub keluhan: String, pub pernah_datang: String, pub tindak_lanjut: String,
}
pub async fn konseling_list(_user: AuthUser, State(state): State<AppState>, Query(q): Query<NoRawatQuery>)
  -> Result<Json<Vec<Konseling>>, (StatusCode, Json<Value>)> {
    let rows = sqlx::query_as::<_, Konseling>(
        "SELECT CAST(tanggal AS CHAR) tanggal, IFNULL(diagnosa,'') diagnosa, IFNULL(obat_pemakaian,'') obat_pemakaian, \
                IFNULL(riwayat_alergi,'') riwayat_alergi, IFNULL(keluhan,'') keluhan, IFNULL(pernah_datang,'') pernah_datang, IFNULL(tindak_lanjut,'') tindak_lanjut \
         FROM konseling_farmasi WHERE no_rawat=? ORDER BY tanggal DESC LIMIT 100"
    ).bind(&q.no_rawat).fetch_all(&state.pool).await.map_err(db_err)?;
    Ok(Json(rows))
}
#[derive(Deserialize)]
pub struct KonselingBody {
    pub no_rawat: String,
    #[serde(default)] pub diagnosa: String, #[serde(default)] pub obat_pemakaian: String,
    #[serde(default)] pub riwayat_alergi: String, #[serde(default)] pub keluhan: String,
    #[serde(default)] pub pernah_datang: String, #[serde(default)] pub tindak_lanjut: String,
}
pub async fn konseling_save(user: AuthUser, State(state): State<AppState>, Json(b): Json<KonselingBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let pd = if b.pernah_datang == "Ya" { "Ya" } else { "Tidak" };
    sqlx::query(
        "INSERT INTO konseling_farmasi (no_rawat, tanggal, diagnosa, obat_pemakaian, riwayat_alergi, keluhan, pernah_datang, tindak_lanjut, nip) \
         VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&b.no_rawat).bind(&b.diagnosa).bind(&b.obat_pemakaian).bind(&b.riwayat_alergi)
    .bind(&b.keluhan).bind(pd).bind(&b.tindak_lanjut).bind(&user.0.kode)
    .execute(&state.pool).await.map_err(db_err)?;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!("konseling_farmasi no_rawat={}", b.no_rawat)).await;
    Ok(Json(json!({"ok": true})))
}
