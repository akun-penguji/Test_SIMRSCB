// Laporan Integrasi Data & Informasi Klinis/Non-Klinis (MRMIK 2 EP 2).
// Read-only: mengagregasi metrik dari modul-modul yang sudah ada (RL 3.1, kunjungan,
// 10 besar penyakit, Mutu, PMKP Insiden, PPI HAIs, K3RS/MFK, Kepuasan) per triwulan.
// TIDAK membuat/mengubah tabel — hanya SELECT.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::warn!("mrmik_integrasi db: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Kesalahan database"})))
}

#[derive(Deserialize)]
pub struct Q { pub tahun: Option<i32>, pub triwulan: Option<i32> }

pub async fn laporan(
    _user: AuthUser, State(state): State<AppState>, Query(q): Query<Q>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let now = chrono::Local::now();
    let tahun = q.tahun.unwrap_or_else(|| now.format("%Y").to_string().parse().unwrap_or(2026));
    let tw = q.triwulan.filter(|t| (1..=4).contains(t)).unwrap_or(1);
    let (bln_awal, bln_akhir) = match tw { 1 => (1, 3), 2 => (4, 6), 3 => (7, 9), _ => (10, 12) };
    let tgl_awal = format!("{:04}-{:02}-01", tahun, bln_awal);
    // akhir bulan triwulan
    let (ny, nm) = if bln_akhir == 12 { (tahun + 1, 1) } else { (tahun, bln_akhir + 1) };
    let akhir = chrono::NaiveDate::from_ymd_opt(ny, nm as u32, 1).unwrap() - chrono::Duration::days(1);
    let tgl_akhir = akhir.format("%Y-%m-%d").to_string();
    let awal = chrono::NaiveDate::from_ymd_opt(tahun, bln_awal as u32, 1).unwrap();
    let hari_periode = (akhir - awal).num_days() as f64 + 1.0;
    let bts = format!("{} 23:59:59", tgl_akhir);

    // ── A. Indikator Rawat Inap: BOR / ALOS / TOI / BTO ──────────────────────
    let tt: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM kamar k LEFT JOIN bangsal b ON k.kd_bangsal=b.kd_bangsal \
         WHERE k.statusdata='1' AND IFNULL(b.status,'1')='1'")
        .fetch_one(&state.pool).await.unwrap_or(0);
    let (hari_rawat, pasien_keluar): (f64, i64) = sqlx::query_as(
        "SELECT CAST(IFNULL(SUM(IFNULL(lama,0)),0) AS DOUBLE), \
                CAST(SUM(CASE WHEN stts_pulang NOT IN ('Pindah Kamar','Status Belum Lengkap','-') THEN 1 ELSE 0 END) AS SIGNED) \
         FROM kamar_inap WHERE tgl_keluar BETWEEN ? AND ?")
        .bind(&tgl_awal).bind(&tgl_akhir).fetch_one(&state.pool).await.unwrap_or((0.0, 0));
    let cap_hari = tt as f64 * hari_periode;
    let bor = if cap_hari > 0.0 { hari_rawat / cap_hari * 100.0 } else { 0.0 };
    let alos = if pasien_keluar > 0 { hari_rawat / pasien_keluar as f64 } else { 0.0 };
    let toi = if pasien_keluar > 0 { (cap_hari - hari_rawat) / pasien_keluar as f64 } else { 0.0 };
    let bto = if tt > 0 { pasien_keluar as f64 / tt as f64 } else { 0.0 };

    // ── B. Kunjungan ─────────────────────────────────────────────────────────
    let kunj_ralan: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa WHERE tgl_registrasi BETWEEN ? AND ? AND kd_poli<>'IGDK' AND IFNULL(status_lanjut,'Ralan')='Ralan' AND stts<>'Batal'")
        .bind(&tgl_awal).bind(&tgl_akhir).fetch_one(&state.pool).await.unwrap_or(0);
    let kunj_igd: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reg_periksa WHERE tgl_registrasi BETWEEN ? AND ? AND kd_poli='IGDK' AND stts<>'Batal'")
        .bind(&tgl_awal).bind(&tgl_akhir).fetch_one(&state.pool).await.unwrap_or(0);
    let kunj_ranap: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT no_rawat) FROM kamar_inap WHERE tgl_masuk BETWEEN ? AND ?")
        .bind(&tgl_awal).bind(&tgl_akhir).fetch_one(&state.pool).await.unwrap_or(0);

    // ── B. 10 Besar Penyakit (diagnosa utama dlm periode) ────────────────────
    let peny: Vec<(String, i64)> = sqlx::query_as(
        "SELECT IFNULL(p.nm_penyakit, dp.kd_penyakit) nm, COUNT(*) n \
         FROM diagnosa_pasien dp \
         JOIN reg_periksa rp ON rp.no_rawat=dp.no_rawat \
         LEFT JOIN penyakit p ON p.kd_penyakit=dp.kd_penyakit \
         WHERE rp.tgl_registrasi BETWEEN ? AND ? \
         GROUP BY dp.kd_penyakit ORDER BY n DESC LIMIT 10")
        .bind(&tgl_awal).bind(&tgl_akhir).fetch_all(&state.pool).await.unwrap_or_default();
    let penyakit10: Vec<Value> = peny.into_iter().map(|(nm, n)| json!({"nama": nm, "jumlah": n})).collect();

    // ── C. Capaian Indikator Mutu (INM & IMP) — rata2 triwulan ───────────────
    let mutu: Vec<(String, String, String, String, Option<String>, Option<f64>)> = sqlx::query_as(
        "SELECT i.kode, i.judul, IFNULL(i.jenis,'') jenis, IFNULL(i.target,'') target, i.satuan, \
                CAST(AVG(c.capaian) AS DOUBLE) capaian \
         FROM simrscb_mutu_capaian c JOIN simrscb_mutu_indikator i ON i.id=c.indikator_id \
         WHERE c.tahun=? AND c.bulan BETWEEN ? AND ? \
         GROUP BY c.indikator_id, i.kode, i.judul, i.jenis, i.target, i.satuan \
         ORDER BY i.jenis DESC, i.kode")
        .bind(tahun).bind(bln_awal).bind(bln_akhir).fetch_all(&state.pool).await.map_err(db_err)?;
    let mutu: Vec<Value> = mutu.into_iter().map(|(kode, judul, jenis, target, satuan, cap)| json!({
        "kode": kode, "judul": judul, "jenis": jenis, "target": target,
        "satuan": satuan.unwrap_or_default(), "capaian": cap,
    })).collect();

    // ── D. IKP (KPC/KNC/KTC/KTD/Sentinel) ────────────────────────────────────
    let ikp: Vec<(String, i64)> = sqlx::query_as(
        "SELECT IFNULL(jenis_insiden,'-') j, COUNT(*) n FROM simrscb_insiden \
         WHERE tanggal_insiden BETWEEN ? AND ? GROUP BY jenis_insiden ORDER BY n DESC")
        .bind(&tgl_awal).bind(&tgl_akhir).fetch_all(&state.pool).await.unwrap_or_default();
    let ikp: Vec<Value> = ikp.into_iter().map(|(j, n)| json!({"jenis": j, "jumlah": n})).collect();

    // ── E. Surveilans HAIs (LIVE dari tabel Khanza `data_HAIs`) ───────────────
    // Numerator = SUM tiap kolom infeksi; denominator = SUM hari pemakaian alat
    // (IVL→Phlebitis, UC→ISK, CVL→IADP, ETT→VAP). Rate = num/den*1000 (‰).
    let h: (i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64) = sqlx::query_as(
        "SELECT CAST(IFNULL(SUM(PLEB),0) AS SIGNED), CAST(IFNULL(SUM(ISK),0) AS SIGNED), \
                CAST(IFNULL(SUM(IAD),0) AS SIGNED), CAST(IFNULL(SUM(VAP),0) AS SIGNED), \
                CAST(IFNULL(SUM(HAP),0) AS SIGNED), CAST(IFNULL(SUM(ILO),0) AS SIGNED), \
                CAST(IFNULL(SUM(Tinea),0) AS SIGNED), CAST(IFNULL(SUM(Scabies),0) AS SIGNED), \
                CAST(SUM(CASE WHEN DEKU='IYA' THEN 1 ELSE 0 END) AS SIGNED), \
                CAST(IFNULL(SUM(IVL),0) AS SIGNED), CAST(IFNULL(SUM(UC),0) AS SIGNED), \
                CAST(IFNULL(SUM(CVL),0) AS SIGNED), CAST(IFNULL(SUM(ETT),0) AS SIGNED) \
         FROM data_HAIs WHERE tanggal BETWEEN ? AND ?")
        .bind(&tgl_awal).bind(&tgl_akhir).fetch_one(&state.pool).await
        .unwrap_or((0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0));
    let (pleb, isk, iad, vap, hap, ilo, tinea, scabies, deku, ivl_d, uc_d, cvl_d, ett_d) = h;
    let rate = |num: i64, den: i64| -> Value { if den > 0 { json!(num as f64 / den as f64 * 1000.0) } else { Value::Null } };
    let mut hais: Vec<Value> = vec![
        json!({"jenis": "Phlebitis", "jumlah": pleb, "denominator": ivl_d, "rate": rate(pleb, ivl_d), "ket": "‰ per 1000 hari kateter IV perifer"}),
        json!({"jenis": "ISK (CAUTI)", "jumlah": isk, "denominator": uc_d, "rate": rate(isk, uc_d), "ket": "‰ per 1000 hari kateter urine"}),
        json!({"jenis": "IADP (CLABSI)", "jumlah": iad, "denominator": cvl_d, "rate": rate(iad, cvl_d), "ket": "‰ per 1000 hari CVL"}),
        json!({"jenis": "VAP", "jumlah": vap, "denominator": ett_d, "rate": rate(vap, ett_d), "ket": "‰ per 1000 hari ventilator"}),
        json!({"jenis": "HAP (Pneumonia)", "jumlah": hap, "denominator": Value::Null, "rate": Value::Null, "ket": ""}),
        json!({"jenis": "IDO (ILO)", "jumlah": ilo, "denominator": Value::Null, "rate": Value::Null, "ket": ""}),
        json!({"jenis": "Dekubitus", "jumlah": deku, "denominator": Value::Null, "rate": Value::Null, "ket": ""}),
    ];
    if tinea > 0 { hais.push(json!({"jenis": "Tinea", "jumlah": tinea, "denominator": Value::Null, "rate": Value::Null, "ket": ""})); }
    if scabies > 0 { hais.push(json!({"jenis": "Scabies", "jumlah": scabies, "denominator": Value::Null, "rate": Value::Null, "ket": ""})); }

    // ── F. K3RS ──────────────────────────────────────────────────────────────
    let k3rs: Vec<(String, i64)> = sqlx::query_as(
        "SELECT IFNULL(jenis_peristiwa,'-') j, COUNT(*) n FROM simrscb_k3rs_insiden \
         WHERE tanggal BETWEEN ? AND ? GROUP BY jenis_peristiwa ORDER BY n DESC")
        .bind(&tgl_awal).bind(&bts).fetch_all(&state.pool).await.unwrap_or_default();
    let k3rs: Vec<Value> = k3rs.into_iter().map(|(j, n)| json!({"jenis": j, "jumlah": n})).collect();

    // ── Kepuasan (IKM rata2 tertimbang responden) ────────────────────────────
    let (ikm, responden): (Option<f64>, Option<i64>) = sqlx::query_as(
        "SELECT CAST(AVG(nilai_ikm) AS DOUBLE), CAST(SUM(IFNULL(jml_responden,0)) AS SIGNED) \
         FROM simrscb_kepuasan WHERE tanggal BETWEEN ? AND ?")
        .bind(&tgl_awal).bind(&bts).fetch_one(&state.pool).await.unwrap_or((None, None));

    Ok(Json(json!({
        "periode": {"tahun": tahun, "triwulan": tw, "tgl_awal": tgl_awal, "tgl_akhir": tgl_akhir, "hari": hari_periode},
        "ranap": {"tt": tt, "bor": bor, "alos": alos, "toi": toi, "bto": bto, "hari_rawat": hari_rawat, "pasien_keluar": pasien_keluar},
        "kunjungan": {"ralan": kunj_ralan, "igd": kunj_igd, "ranap": kunj_ranap},
        "penyakit10": penyakit10,
        "mutu": mutu,
        "ikp": ikp,
        "hais": hais,
        "k3rs": k3rs,
        "kepuasan": {"nilai": ikm, "responden": responden.unwrap_or(0)},
    })))
}

// ── Editan laporan (Bagian III keputusan, rekomendasi IKP, dll) tersimpan DB ──
#[derive(Deserialize)]
pub struct EditanQ { pub jenis: String, pub tahun: i32, pub triwulan: i32 }

pub async fn editan_get(
    _user: AuthUser, State(state): State<AppState>, Query(q): Query<EditanQ>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let konten: Option<String> = sqlx::query_scalar(
        "SELECT konten FROM simrscb_laporan_editan WHERE jenis_laporan=? AND tahun=? AND triwulan=?")
        .bind(&q.jenis).bind(q.tahun).bind(q.triwulan)
        .fetch_optional(&state.pool).await.map_err(db_err)?.flatten();
    let v: Value = konten.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or(Value::Null);
    Ok(Json(json!({"konten": v})))
}

#[derive(Deserialize)]
pub struct EditanBody { pub jenis: String, pub tahun: i32, pub triwulan: i32, pub konten: Value }

pub async fn editan_save(
    user: AuthUser, State(state): State<AppState>, Json(b): Json<EditanBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let konten = b.konten.to_string();
    sqlx::query(
        "INSERT INTO simrscb_laporan_editan (jenis_laporan, tahun, triwulan, konten, nip) VALUES (?,?,?,?,?) \
         ON DUPLICATE KEY UPDATE konten=VALUES(konten), nip=VALUES(nip)")
        .bind(&b.jenis).bind(b.tahun).bind(b.triwulan).bind(&konten).bind(&user.0.kode)
        .execute(&state.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}
