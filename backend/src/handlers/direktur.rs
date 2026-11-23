use crate::AppState;
use axum::{extract::State, http::StatusCode, Json};
use serde::Serialize;
use serde_json::{json, Value};

// ─────────────────────────────────────────────────────────────
// Dashboard Eksekutif — KPI cards untuk landing /direktur
// ─────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct DashboardResp {
    pub kunjungan:  Kunjungan,
    pub kamar:      Kamar,
    pub indikator:  IndikatorRanap,
    pub operasi_today: i64,
    pub keuangan:   KeuanganSummary,
    pub pegawai:    PegawaiSummary,
    pub antrian:    Antrian,
    pub akreditasi: AkreditasiSummary,
    pub farmasi:    FarmasiSummary,
    pub target:     TargetDir,
    pub alerts:     Vec<Alert>,
}

/// Indikator ranap MTD (perkiraan dari kamar_inap pasien pulang bulan ini).
#[derive(Serialize, Default)]
pub struct IndikatorRanap { pub alos: f64, pub bto: f64, pub toi: f64 }
#[derive(Serialize, Default)]
pub struct FarmasiSummary { pub stok_kosong: i64 }

/// Target strategis (diisi Direktur di form setelan). Default masuk akal.
#[derive(Serialize, Clone)]
pub struct TargetDir {
    pub bor_min: f64, pub bor_max: f64,
    pub alos_max: f64, pub toi_max: f64,
    pub pendapatan_harian: f64, pub pendapatan_bulanan: f64,
    pub piutang_max: f64,
    pub kepuasan: f64, pub akreditasi: f64,
    // Realisasi manual (metrik belum ada sumber data otomatis) + target inovasi/SDM
    pub kepuasan_real: f64, pub akreditasi_real: f64,
    pub inovasi_target: f64, pub inovasi_real: f64,
    pub sdm_target: f64,
}
impl Default for TargetDir {
    fn default() -> Self {
        TargetDir {
            bor_min: 60.0, bor_max: 85.0, alos_max: 6.0, toi_max: 3.0,
            pendapatan_harian: 50_000_000.0, pendapatan_bulanan: 1_500_000_000.0,
            piutang_max: 5_000_000_000.0, kepuasan: 85.0, akreditasi: 80.0,
            kepuasan_real: 0.0, akreditasi_real: 0.0,
            inovasi_target: 10.0, inovasi_real: 0.0, sdm_target: 0.0,
        }
    }
}

/// Satu peringatan Early Warning System.
#[derive(Serialize)]
pub struct Alert { pub level: String, pub kategori: String, pub pesan: String }

#[derive(Serialize, Default)]
pub struct Kunjungan { pub rajal_today: i64, pub igd_today: i64, pub ranap_today: i64,
                       pub rajal_mtd: i64, pub igd_mtd: i64, pub ranap_mtd: i64 }
#[derive(Serialize, Default)]
pub struct Kamar { pub kapasitas: i64, pub terisi: i64, pub kosong: i64, pub bor_pct: f64 }
#[derive(Serialize, Default)]
pub struct KeuanganSummary { pub pendapatan_today: f64, pub pendapatan_mtd: f64, pub piutang_total: f64 }
#[derive(Serialize, Default)]
pub struct PegawaiSummary { pub total_aktif: i64, pub dokter: i64, pub perawat: i64, pub lain: i64 }
#[derive(Serialize, Default)]
pub struct Antrian { pub menunggu: i64, pub dipanggil_hari_ini: i64 }
#[derive(Serialize, Default)]
pub struct AkreditasiSummary { pub total_ep: i64, pub critical: i64, pub eviden: i64 }

pub async fn dashboard(
    user: crate::auth::middleware::AuthUser,
    State(state): State<AppState>,
) -> Result<Json<DashboardResp>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "direktur_view")?;
    let p = &state.pool;

    // Kunjungan today + MTD
    let kunjungan = Kunjungan {
        rajal_today: scalar(p, "SELECT COUNT(*) FROM reg_periksa WHERE tgl_registrasi = CURRENT_DATE AND kd_poli != 'IGDK' AND status_lanjut = 'Ralan'").await,
        igd_today:   scalar(p, "SELECT COUNT(*) FROM reg_periksa WHERE tgl_registrasi = CURRENT_DATE AND kd_poli = 'IGDK'").await,
        ranap_today: scalar(p, "SELECT COUNT(*) FROM reg_periksa WHERE tgl_registrasi = CURRENT_DATE AND status_lanjut = 'Ranap'").await,
        rajal_mtd:   scalar(p, "SELECT COUNT(*) FROM reg_periksa WHERE YEAR(tgl_registrasi)=YEAR(CURRENT_DATE) AND MONTH(tgl_registrasi)=MONTH(CURRENT_DATE) AND kd_poli != 'IGDK' AND status_lanjut = 'Ralan'").await,
        igd_mtd:     scalar(p, "SELECT COUNT(*) FROM reg_periksa WHERE YEAR(tgl_registrasi)=YEAR(CURRENT_DATE) AND MONTH(tgl_registrasi)=MONTH(CURRENT_DATE) AND kd_poli = 'IGDK'").await,
        ranap_mtd:   scalar(p, "SELECT COUNT(*) FROM reg_periksa WHERE YEAR(tgl_registrasi)=YEAR(CURRENT_DATE) AND MONTH(tgl_registrasi)=MONTH(CURRENT_DATE) AND status_lanjut = 'Ranap'").await,
    };

    // Kamar (BOR)
    let kapasitas = scalar(p, "SELECT COUNT(*) FROM kamar WHERE status='ISI' OR status='KOSONG'").await;
    let terisi    = scalar(p, "SELECT COUNT(*) FROM kamar WHERE status='ISI'").await;
    let kosong    = kapasitas - terisi;
    let bor       = if kapasitas > 0 { (terisi as f64 / kapasitas as f64) * 100.0 } else { 0.0 };
    let kamar = Kamar { kapasitas, terisi, kosong, bor_pct: bor };

    // Keuangan summary (kasir_ralan + kasir_ranap)
    let pendapatan_today_ralan = scalar_f64(p, "SELECT IFNULL(SUM(byr_tunai+byr_jaminan),0) FROM nota_jalan WHERE DATE(tanggal) = CURRENT_DATE").await;
    let pendapatan_today_ranap = scalar_f64(p, "SELECT IFNULL(SUM(besar_bayar),0) FROM nota_inap WHERE DATE(tanggal) = CURRENT_DATE").await;
    let pendapatan_mtd_ralan   = scalar_f64(p, "SELECT IFNULL(SUM(byr_tunai+byr_jaminan),0) FROM nota_jalan WHERE YEAR(tanggal)=YEAR(CURRENT_DATE) AND MONTH(tanggal)=MONTH(CURRENT_DATE)").await;
    let pendapatan_mtd_ranap   = scalar_f64(p, "SELECT IFNULL(SUM(besar_bayar),0) FROM nota_inap WHERE YEAR(tanggal)=YEAR(CURRENT_DATE) AND MONTH(tanggal)=MONTH(CURRENT_DATE)").await;
    let piutang = scalar_f64(p, "SELECT IFNULL(SUM(totalpiutang),0) FROM piutang_pasien WHERE status='Belum Lunas'").await;
    let keuangan = KeuanganSummary {
        pendapatan_today: pendapatan_today_ralan + pendapatan_today_ranap,
        pendapatan_mtd:   pendapatan_mtd_ralan + pendapatan_mtd_ranap,
        piutang_total:    piutang,
    };

    // Pegawai
    let total_aktif = scalar(p, "SELECT COUNT(*) FROM pegawai WHERE status='1'").await;
    let dokter      = scalar(p, "SELECT COUNT(*) FROM dokter WHERE status='1'").await;
    let perawat     = scalar(p, "SELECT COUNT(*) FROM pegawai WHERE status='1' AND (jbtn LIKE '%Perawat%' OR jbtn LIKE '%PERAWAT%')").await;
    let pegawai = PegawaiSummary {
        total_aktif, dokter, perawat,
        lain: (total_aktif - dokter - perawat).max(0),
    };

    // Antrian
    let antrian = Antrian {
        menunggu: scalar(p, "SELECT COUNT(*) FROM antripendaftaran_nomor WHERE status='0' AND DATE(jam) = CURRENT_DATE").await,
        dipanggil_hari_ini: scalar(p, "SELECT COUNT(*) FROM antripendaftaran_nomor WHERE status='1' AND DATE(jam) = CURRENT_DATE").await,
    };

    // Akreditasi summary (kalau tabel sudah ada)
    let akreditasi = AkreditasiSummary {
        total_ep: scalar(p, "SELECT IFNULL(COUNT(*),0) FROM starkes_ep WHERE status='aktif'").await,
        critical: scalar(p, "SELECT IFNULL(SUM(CASE WHEN prioritas<=2 THEN 1 ELSE 0 END),0) FROM starkes_ep WHERE status='aktif'").await,
        eviden:   scalar(p, "SELECT IFNULL(COUNT(*),0) FROM eviden_folder").await,
    };

    // Indikator ranap MTD (ALOS/BTO/TOI) dari pasien pulang bulan ini
    let keluar = scalar(p, "SELECT COUNT(*) FROM kamar_inap WHERE tgl_keluar >= DATE_FORMAT(CURRENT_DATE,'%Y-%m-01') AND tgl_keluar <= CURRENT_DATE AND stts_pulang <> '-'").await;
    let hari_rawat = scalar_f64(p, "SELECT IFNULL(SUM(lama),0) FROM kamar_inap WHERE tgl_keluar >= DATE_FORMAT(CURRENT_DATE,'%Y-%m-01') AND tgl_keluar <= CURRENT_DATE AND stts_pulang <> '-'").await;
    let hari_periode = scalar(p, "SELECT DAY(CURRENT_DATE)").await.max(1);
    let indikator = if keluar > 0 {
        let alos = hari_rawat / keluar as f64;
        let bto  = if kapasitas > 0 { keluar as f64 / kapasitas as f64 } else { 0.0 };
        let toi  = if kapasitas > 0 {
            (((kapasitas * hari_periode) as f64 - hari_rawat) / keluar as f64).max(0.0)
        } else { 0.0 };
        IndikatorRanap { alos, bto, toi }
    } else { IndikatorRanap::default() };

    // Operasi hari ini
    let operasi_today = scalar(p, "SELECT COUNT(*) FROM booking_operasi WHERE tanggal = CURRENT_DATE").await;

    // Farmasi — jumlah item aktif tanpa stok (kritis)
    let stok_kosong = scalar(p, "SELECT COUNT(*) FROM databarang d WHERE d.status='1' AND d.kode_brng NOT IN (SELECT kode_brng FROM gudangbarang WHERE stok > 0)").await;
    let farmasi = FarmasiSummary { stok_kosong };

    // Target (setelan Direktur, default kalau belum diisi)
    let target = load_target(p).await;

    // ── Early Warning System ──
    let mut alerts: Vec<Alert> = Vec::new();
    let pusha = |v: &mut Vec<Alert>, level: &str, kat: &str, msg: String|
        v.push(Alert { level: level.into(), kategori: kat.into(), pesan: msg });
    if bor > target.bor_max {
        pusha(&mut alerts, "merah", "Hunian", format!("BOR {:.1}% melebihi ambang aman {:.0}%", bor, target.bor_max));
    } else if bor > 0.0 && bor < target.bor_min {
        pusha(&mut alerts, "kuning", "Hunian", format!("BOR {:.1}% di bawah target {:.0}%", bor, target.bor_min));
    }
    if keuangan.piutang_total > target.piutang_max {
        pusha(&mut alerts, "merah", "Keuangan", format!("Piutang outstanding Rp {:.0} juta melebihi batas", keuangan.piutang_total / 1_000_000.0));
    }
    if target.pendapatan_harian > 0.0 && keuangan.pendapatan_today < target.pendapatan_harian {
        pusha(&mut alerts, "kuning", "Keuangan", format!("Pendapatan hari ini Rp {:.0} jt di bawah target Rp {:.0} jt", keuangan.pendapatan_today / 1_000_000.0, target.pendapatan_harian / 1_000_000.0));
    }
    if stok_kosong > 0 {
        let lvl = if stok_kosong >= 20 { "merah" } else { "kuning" };
        pusha(&mut alerts, lvl, "Farmasi", format!("{} item obat/BHP stok kosong", stok_kosong));
    }
    if indikator.alos > target.alos_max && target.alos_max > 0.0 {
        pusha(&mut alerts, "kuning", "Mutu", format!("ALOS {:.1} hari melebihi target {:.0} hari", indikator.alos, target.alos_max));
    }
    // merah dulu
    alerts.sort_by_key(|a| if a.level == "merah" { 0 } else { 1 });

    Ok(Json(DashboardResp {
        kunjungan, kamar, indikator, operasi_today, keuangan, pegawai,
        antrian, akreditasi, farmasi, target, alerts,
    }))
}

/// Muat target dari simrscb_direktur_target (key-value) di atas default.
async fn load_target(p: &sqlx::MySqlPool) -> TargetDir {
    let mut t = TargetDir::default();
    let rows: Vec<(String, f64)> = sqlx::query_as("SELECT cfg_key, cfg_value FROM simrscb_direktur_target")
        .fetch_all(p).await.unwrap_or_default();
    for (k, v) in rows {
        match k.as_str() {
            "bor_min" => t.bor_min = v,
            "bor_max" => t.bor_max = v,
            "alos_max" => t.alos_max = v,
            "toi_max" => t.toi_max = v,
            "pendapatan_harian" => t.pendapatan_harian = v,
            "pendapatan_bulanan" => t.pendapatan_bulanan = v,
            "piutang_max" => t.piutang_max = v,
            "kepuasan" => t.kepuasan = v,
            "akreditasi" => t.akreditasi = v,
            "kepuasan_real" => t.kepuasan_real = v,
            "akreditasi_real" => t.akreditasi_real = v,
            "inovasi_target" => t.inovasi_target = v,
            "inovasi_real" => t.inovasi_real = v,
            "sdm_target" => t.sdm_target = v,
            _ => {}
        }
    }
    t
}

/// GET /direktur/target — nilai target saat ini (default kalau kosong).
pub async fn get_target(user: crate::auth::middleware::AuthUser, State(state): State<AppState>) -> Result<Json<TargetDir>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "direktur_view")?;
    Ok(Json(load_target(&state.pool).await))
}

#[derive(serde::Deserialize)]
pub struct TargetBody { pub key: String, pub value: f64 }

/// PUT /direktur/target — set satu target (admin).
pub async fn put_target(
    user: crate::auth::middleware::AuthUser,
    State(state): State<AppState>,
    Json(b): Json<TargetBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Hanya admin"}))));
    }
    sqlx::query(
        "INSERT INTO simrscb_direktur_target (cfg_key, cfg_value, updated_by) VALUES (?,?,?) \
         ON DUPLICATE KEY UPDATE cfg_value=VALUES(cfg_value), updated_by=VALUES(updated_by)"
    )
    .bind(&b.key).bind(b.value).bind(&user.0.kode)
    .execute(&state.pool).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
    Ok(Json(json!({"ok": true})))
}

// ─────────────────────────────────────────────────────────────
// Dashboard BPJS & Klaim + Farmasi
// ─────────────────────────────────────────────────────────────
#[derive(Serialize)]
pub struct BpjsFarmasiResp { pub farmasi: FarmasiDetail, pub bpjs: BpjsDetail }
#[derive(Serialize, Default)]
pub struct FarmasiDetail {
    pub nilai_persediaan: f64, pub jml_item: i64, pub kosong: i64, pub hampir_habis: i64,
    pub fast_moving: Vec<TopItem>, pub slow_moving: Vec<TopItem>,
}
#[derive(Serialize, Default)]
pub struct BpjsDetail { pub sep_mtd: i64, pub sep_today: i64, pub piutang_bpjs: f64, pub piutang_total: f64 }

pub async fn bpjs_farmasi(user: crate::auth::middleware::AuthUser, State(state): State<AppState>) -> Result<Json<BpjsFarmasiResp>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "direktur_view")?;
    let p = &state.pool;

    let farmasi = FarmasiDetail {
        nilai_persediaan: scalar_f64(p, "SELECT IFNULL(SUM(g.stok*d.dasar),0) FROM gudangbarang g JOIN databarang d ON d.kode_brng=g.kode_brng WHERE d.status='1'").await,
        jml_item: scalar(p, "SELECT COUNT(*) FROM databarang WHERE status='1'").await,
        kosong: scalar(p, "SELECT COUNT(*) FROM databarang d WHERE d.status='1' AND d.kode_brng NOT IN (SELECT kode_brng FROM gudangbarang WHERE stok>0)").await,
        hampir_habis: scalar(p, "SELECT COUNT(*) FROM (SELECT d.kode_brng FROM databarang d JOIN gudangbarang g ON g.kode_brng=d.kode_brng WHERE d.status='1' AND d.stokminimal>0 GROUP BY d.kode_brng, d.stokminimal HAVING SUM(g.stok) BETWEEN 1 AND d.stokminimal) x").await,
        // Fast moving: obat/BHP paling banyak diresepkan bulan ini (resep_dokter = detail, resep_obat = header/tgl)
        fast_moving: top_list(p,
            "SELECT rd.kode_brng, d.nama_brng, CAST(SUM(rd.jml) AS SIGNED) \
             FROM resep_dokter rd \
             JOIN resep_obat ro ON ro.no_resep=rd.no_resep \
             JOIN databarang d ON d.kode_brng=rd.kode_brng \
             WHERE YEAR(ro.tgl_perawatan)=YEAR(CURDATE()) AND MONTH(ro.tgl_perawatan)=MONTH(CURDATE()) \
             GROUP BY rd.kode_brng, d.nama_brng ORDER BY SUM(rd.jml) DESC LIMIT 10").await,
        // Slow moving: punya stok besar tapi TIDAK diresepkan bulan ini
        slow_moving: top_list(p,
            "SELECT d.kode_brng, d.nama_brng, CAST(SUM(g.stok) AS SIGNED) \
             FROM databarang d JOIN gudangbarang g ON g.kode_brng=d.kode_brng \
             WHERE d.status='1' AND d.kode_brng NOT IN ( \
               SELECT rd.kode_brng FROM resep_dokter rd JOIN resep_obat ro ON ro.no_resep=rd.no_resep \
               WHERE YEAR(ro.tgl_perawatan)=YEAR(CURDATE()) AND MONTH(ro.tgl_perawatan)=MONTH(CURDATE())) \
             GROUP BY d.kode_brng, d.nama_brng HAVING SUM(g.stok)>0 ORDER BY SUM(g.stok) DESC LIMIT 10").await,
    };

    let bpjs = BpjsDetail {
        sep_mtd: scalar(p, "SELECT COUNT(*) FROM bridging_sep WHERE YEAR(tglsep)=YEAR(CURDATE()) AND MONTH(tglsep)=MONTH(CURDATE())").await,
        sep_today: scalar(p, "SELECT COUNT(*) FROM bridging_sep WHERE tglsep=CURDATE()").await,
        // Piutang BPJS berjalan (12 bulan terakhir) — hindari akumulasi historis
        piutang_bpjs: scalar_f64(p, "SELECT IFNULL(SUM(pp.sisapiutang),0) FROM piutang_pasien pp JOIN reg_periksa r ON r.no_rawat=pp.no_rawat WHERE pp.status='Belum Lunas' AND r.kd_pj='BPJ' AND pp.tgl_piutang >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)").await,
        piutang_total: scalar_f64(p, "SELECT IFNULL(SUM(sisapiutang),0) FROM piutang_pasien WHERE status='Belum Lunas'").await,
    };

    Ok(Json(BpjsFarmasiResp { farmasi, bpjs }))
}

// ─────────────────────────────────────────────────────────────
// Operasional — trend + top 10
// ─────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct TrendBulanan { pub bulan: String, pub rajal: i64, pub igd: i64, pub ranap: i64 }
#[derive(Serialize, sqlx::FromRow)]
pub struct TopItem { pub kode: String, pub nama: String, pub jumlah: i64 }
#[derive(Serialize, sqlx::FromRow)]
pub struct BorBangsal { pub kd_bangsal: String, pub nm_bangsal: String, pub kapasitas: i64, pub terisi: i64, pub bor_pct: f64 }

#[derive(Serialize)]
pub struct OperasionalResp {
    pub trend_12_bulan:  Vec<TrendBulanan>,
    pub top_diagnosa:    Vec<TopItem>,
    pub top_obat:        Vec<TopItem>,
    pub top_tindakan:    Vec<TopItem>,
    pub pelayanan_poli:  Vec<TopItem>,
    pub bor_bangsal:     Vec<BorBangsal>,
}

pub async fn operasional(
    user: crate::auth::middleware::AuthUser,
    State(state): State<AppState>,
) -> Result<Json<OperasionalResp>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "direktur_view")?;
    let p = &state.pool;

    let trend: Vec<TrendBulanan> = sqlx::query_as(
        "SELECT DATE_FORMAT(tgl_registrasi,'%Y-%m') AS bulan, \
                SUM(CASE WHEN status_lanjut='Ralan' AND kd_poli != 'IGDK' THEN 1 ELSE 0 END) AS rajal, \
                SUM(CASE WHEN kd_poli = 'IGDK' THEN 1 ELSE 0 END) AS igd, \
                SUM(CASE WHEN status_lanjut='Ranap' THEN 1 ELSE 0 END) AS ranap \
         FROM reg_periksa \
         WHERE tgl_registrasi >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH) \
         GROUP BY DATE_FORMAT(tgl_registrasi,'%Y-%m') \
         ORDER BY bulan"
    ).fetch_all(p).await.unwrap_or_default();

    let top_diagnosa: Vec<TopItem> = sqlx::query_as(
        "SELECT dp.kd_penyakit AS kode, IFNULL(pn.nm_penyakit, dp.kd_penyakit) AS nama, COUNT(*) AS jumlah \
         FROM diagnosa_pasien dp \
         LEFT JOIN penyakit pn ON pn.kd_penyakit = dp.kd_penyakit \
         JOIN reg_periksa r ON r.no_rawat = dp.no_rawat \
         WHERE r.tgl_registrasi >= DATE_SUB(CURRENT_DATE, INTERVAL 90 DAY) \
         GROUP BY dp.kd_penyakit, pn.nm_penyakit \
         ORDER BY jumlah DESC LIMIT 10"
    ).fetch_all(p).await.unwrap_or_default();

    let top_obat: Vec<TopItem> = sqlx::query_as(
        "SELECT dpo.kode_brng AS kode, IFNULL(db.nama_brng, dpo.kode_brng) AS nama, SUM(dpo.jml) AS jumlah \
         FROM detail_pemberian_obat dpo \
         LEFT JOIN databarang db ON db.kode_brng = dpo.kode_brng \
         WHERE dpo.tgl_perawatan >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY) \
         GROUP BY dpo.kode_brng, db.nama_brng \
         ORDER BY jumlah DESC LIMIT 10"
    ).fetch_all(p).await.unwrap_or_default();

    let top_tindakan: Vec<TopItem> = sqlx::query_as(
        "SELECT rjp.kode AS kode, IFNULL(jp.nm_perawatan, rjp.kode) AS nama, COUNT(*) AS jumlah \
         FROM rawat_jl_pr rjp \
         LEFT JOIN jns_perawatan jp ON jp.kd_jenis_prw = rjp.kode \
         JOIN reg_periksa r ON r.no_rawat = rjp.no_rawat \
         WHERE r.tgl_registrasi >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY) \
         GROUP BY rjp.kode, jp.nm_perawatan \
         ORDER BY jumlah DESC LIMIT 10"
    ).fetch_all(p).await.unwrap_or_default();

    let pelayanan_poli: Vec<TopItem> = sqlx::query_as(
        "SELECT r.kd_poli AS kode, IFNULL(po.nm_poli, r.kd_poli) AS nama, COUNT(*) AS jumlah \
         FROM reg_periksa r \
         LEFT JOIN poliklinik po ON po.kd_poli = r.kd_poli \
         WHERE r.tgl_registrasi >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY) AND r.kd_poli != 'IGDK' \
         GROUP BY r.kd_poli, po.nm_poli \
         ORDER BY jumlah DESC LIMIT 10"
    ).fetch_all(p).await.unwrap_or_default();

    let bor_bangsal: Vec<BorBangsal> = sqlx::query_as(
        "SELECT k.kd_bangsal, b.nm_bangsal, \
                COUNT(*) AS kapasitas, \
                SUM(CASE WHEN k.status='ISI' THEN 1 ELSE 0 END) AS terisi, \
                CAST(SUM(CASE WHEN k.status='ISI' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*),0) AS DOUBLE) AS bor_pct \
         FROM kamar k JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal \
         WHERE b.status='1' AND k.status IN ('ISI','KOSONG') \
         GROUP BY k.kd_bangsal, b.nm_bangsal \
         ORDER BY bor_pct DESC LIMIT 20"
    ).fetch_all(p).await.unwrap_or_default();

    Ok(Json(OperasionalResp {
        trend_12_bulan: trend,
        top_diagnosa, top_obat, top_tindakan, pelayanan_poli, bor_bangsal,
    }))
}

// ─────────────────────────────────────────────────────────────
// Keuangan — pendapatan per layanan/penjamin + klaim BPJS
// ─────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct AggValue { pub kategori: String, pub jumlah: f64 }

#[derive(Serialize)]
pub struct KeuanganResp {
    pub pendapatan_per_layanan: Vec<AggValue>,
    pub pendapatan_per_penjamin: Vec<AggValue>,
    pub piutang_per_penjamin:    Vec<AggValue>,
    pub trend_pendapatan_30_hari: Vec<TrendHarian>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct TrendHarian { pub tanggal: String, pub pendapatan: f64 }

pub async fn keuangan(
    user: crate::auth::middleware::AuthUser,
    State(state): State<AppState>,
) -> Result<Json<KeuanganResp>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "direktur_view")?;
    let p = &state.pool;

    let layanan: Vec<AggValue> = sqlx::query_as(
        "SELECT 'Rawat Jalan' AS kategori, CAST(IFNULL(SUM(byr_tunai+byr_jaminan),0) AS DOUBLE) AS jumlah \
         FROM nota_jalan WHERE YEAR(tanggal)=YEAR(CURRENT_DATE) AND MONTH(tanggal)=MONTH(CURRENT_DATE) \
         UNION ALL \
         SELECT 'Rawat Inap', CAST(IFNULL(SUM(besar_bayar),0) AS DOUBLE) \
         FROM nota_inap WHERE YEAR(tanggal)=YEAR(CURRENT_DATE) AND MONTH(tanggal)=MONTH(CURRENT_DATE)"
    ).fetch_all(p).await.unwrap_or_default();

    let penjamin: Vec<AggValue> = sqlx::query_as(
        "SELECT IFNULL(pj.png_jawab, r.kd_pj) AS kategori, \
                CAST(IFNULL(SUM(b.totalbiaya),0) AS DOUBLE) AS jumlah \
         FROM billing b \
         JOIN reg_periksa r ON r.no_rawat = b.no_rawat \
         LEFT JOIN penjab pj ON pj.kd_pj = r.kd_pj \
         WHERE YEAR(b.tgl_byr)=YEAR(CURRENT_DATE) AND MONTH(b.tgl_byr)=MONTH(CURRENT_DATE) \
         GROUP BY r.kd_pj, pj.png_jawab \
         ORDER BY jumlah DESC LIMIT 10"
    ).fetch_all(p).await.unwrap_or_default();

    let piutang: Vec<AggValue> = sqlx::query_as(
        "SELECT IFNULL(pj.png_jawab, pp.kd_pj) AS kategori, \
                CAST(IFNULL(SUM(pp.totalpiutang),0) AS DOUBLE) AS jumlah \
         FROM piutang_pasien pp \
         LEFT JOIN penjab pj ON pj.kd_pj = pp.kd_pj \
         WHERE pp.status='Belum Lunas' \
         GROUP BY pp.kd_pj, pj.png_jawab \
         ORDER BY jumlah DESC LIMIT 10"
    ).fetch_all(p).await.unwrap_or_default();

    let trend: Vec<TrendHarian> = sqlx::query_as(
        "SELECT DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal, \
                CAST(IFNULL(SUM(byr_tunai+byr_jaminan),0) AS DOUBLE) AS pendapatan \
         FROM nota_jalan \
         WHERE tanggal >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY) \
         GROUP BY DATE_FORMAT(tanggal,'%Y-%m-%d') \
         ORDER BY tanggal"
    ).fetch_all(p).await.unwrap_or_default();

    Ok(Json(KeuanganResp {
        pendapatan_per_layanan: layanan,
        pendapatan_per_penjamin: penjamin,
        piutang_per_penjamin: piutang,
        trend_pendapatan_30_hari: trend,
    }))
}

// ─────────────────────────────────────────────────────────────
// SDM — komposisi pegawai + presensi ringkas
// ─────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct KompItem { pub kategori: String, pub jumlah: i64 }

#[derive(Serialize)]
pub struct SdmResp {
    pub total_aktif:          i64,
    pub per_jabatan:          Vec<KompItem>,
    pub per_pendidikan:       Vec<KompItem>,
    pub dokter_per_spesialis: Vec<KompItem>,
}

pub async fn sdm(
    user: crate::auth::middleware::AuthUser,
    State(state): State<AppState>,
) -> Result<Json<SdmResp>, (StatusCode, Json<Value>)> {
    crate::handlers::web_perms::require_perm(&user, "direktur_view")?;
    let p = &state.pool;

    let total_aktif = scalar(p, "SELECT COUNT(*) FROM pegawai WHERE status='1'").await;

    let per_jabatan: Vec<KompItem> = sqlx::query_as(
        "SELECT IFNULL(jbtn,'-') AS kategori, COUNT(*) AS jumlah \
         FROM pegawai WHERE status='1' \
         GROUP BY jbtn ORDER BY jumlah DESC LIMIT 15"
    ).fetch_all(p).await.unwrap_or_default();

    let per_pendidikan: Vec<KompItem> = sqlx::query_as(
        "SELECT IFNULL(pendidikan,'-') AS kategori, COUNT(*) AS jumlah \
         FROM pegawai WHERE status='1' \
         GROUP BY pendidikan ORDER BY jumlah DESC LIMIT 15"
    ).fetch_all(p).await.unwrap_or_default();

    let dokter_spesialis: Vec<KompItem> = sqlx::query_as(
        "SELECT IFNULL(s.nm_sps, 'Lainnya') AS kategori, COUNT(*) AS jumlah \
         FROM dokter d \
         LEFT JOIN spesialis s ON s.kd_sps = d.kd_sps \
         WHERE d.status='1' \
         GROUP BY d.kd_sps, s.nm_sps ORDER BY jumlah DESC LIMIT 15"
    ).fetch_all(p).await.unwrap_or_default();

    Ok(Json(SdmResp {
        total_aktif,
        per_jabatan,
        per_pendidikan,
        dokter_per_spesialis: dokter_spesialis,
    }))
}

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────

async fn scalar(pool: &sqlx::MySqlPool, sql: &str) -> i64 {
    let row: (i64,) = sqlx::query_as(sql).fetch_one(pool).await.unwrap_or((0,));
    row.0
}

async fn scalar_f64(pool: &sqlx::MySqlPool, sql: &str) -> f64 {
    let row: (f64,) = sqlx::query_as(sql).fetch_one(pool).await.unwrap_or((0.0,));
    row.0
}

async fn top_list(pool: &sqlx::MySqlPool, sql: &str) -> Vec<TopItem> {
    let rows: Vec<(String, String, i64)> = sqlx::query_as(sql).fetch_all(pool).await.unwrap_or_default();
    rows.into_iter().map(|(kode, nama, jumlah)| TopItem { kode, nama, jumlah }).collect()
}
