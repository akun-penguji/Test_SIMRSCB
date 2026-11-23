//! Engine perhitungan surveilans PPRA — murni (tanpa DB) supaya mudah diuji.
//!
//! Metrik:
//!   - Total DDD  = Σ(qty × isi_zat_aktif) / DDD_WHO       (per antibiotik)
//!   - DDD/100 patient-days   (rawat inap)  = ΣDDD / hari_rawat  × 100
//!   - DDD/1000 populations   (rawat jalan) = ΣDDD / kunjungan   × 1000
//!   - AWaRe%   : proporsi ΣDDD per kategori Access/Watch/Reserve (target Access ≥ 60%)
//!   - DU90%    : segmen antibiotik (urut desc) yang menyumbang 90% total DDD
//!
//! Acuan: PMK 8/2015 (ATC/DDD), WHO ATC/DDD Index, AWaRe 2023.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AwareKategori {
    Access,
    Watch,
    Reserve,
    NotRecommended,
}

impl AwareKategori {
    /// Map dari nilai ENUM DB (`ppra_atc_ref.aware_kategori`).
    pub fn from_db(s: &str) -> AwareKategori {
        match s {
            "Access" => AwareKategori::Access,
            "Watch" => AwareKategori::Watch,
            "Reserve" => AwareKategori::Reserve,
            _ => AwareKategori::NotRecommended,
        }
    }
}

/// Konsumsi satu antibiotik (per pasangan atc_code + adm_route) pada satu periode.
#[derive(Debug, Clone, Serialize)]
pub struct KonsumsiAB {
    pub atc_code: String,
    pub adm_route: String,
    pub nama_generik: String,
    pub aware_kategori: AwareKategori,
    /// Σ(qty × isi_zat_aktif) dalam satuan DDD (mis. gram).
    pub konsumsi: f64,
    /// Nilai DDD WHO untuk atc_code+rute ini.
    pub ddd: f64,
}

impl KonsumsiAB {
    /// Total DDD = konsumsi / DDD. Guard DDD ≤ 0 → 0 (hindari div-by-zero / mapping salah).
    pub fn total_ddd(&self) -> f64 {
        if self.ddd > 0.0 {
            self.konsumsi / self.ddd
        } else {
            0.0
        }
    }
}

/// DDD/100 patient-days (rawat inap). `hari_rawat` = Σ kamar_inap.lama pada periode.
pub fn ddd_per_100_patient_days(total_ddd: f64, hari_rawat: f64) -> f64 {
    if hari_rawat > 0.0 {
        total_ddd / hari_rawat * 100.0
    } else {
        0.0
    }
}

/// DDD/1000 patient-populations (rawat jalan). `kunjungan` = jumlah kunjungan ralan.
pub fn ddd_per_1000_populations(total_ddd: f64, kunjungan: f64) -> f64 {
    if kunjungan > 0.0 {
        total_ddd / kunjungan * 1000.0
    } else {
        0.0
    }
}

/// Rekap total DDD per kategori AWaRe + evaluasi target Access.
#[derive(Debug, Clone, Serialize)]
pub struct AwareRekap {
    pub access: f64,
    pub watch: f64,
    pub reserve: f64,
    pub not_recommended: f64,
    pub total: f64,
    pub access_persen: f64,
    pub target_persen: f64,
    pub memenuhi_target: bool,
}

pub fn rekap_aware(items: &[KonsumsiAB], target_persen: f64) -> AwareRekap {
    let (mut access, mut watch, mut reserve, mut notr) = (0.0, 0.0, 0.0, 0.0);
    for it in items {
        let d = it.total_ddd();
        match it.aware_kategori {
            AwareKategori::Access => access += d,
            AwareKategori::Watch => watch += d,
            AwareKategori::Reserve => reserve += d,
            AwareKategori::NotRecommended => notr += d,
        }
    }
    let total = access + watch + reserve + notr;
    let access_persen = if total > 0.0 { access / total * 100.0 } else { 0.0 };
    AwareRekap {
        access,
        watch,
        reserve,
        not_recommended: notr,
        total,
        access_persen,
        target_persen,
        memenuhi_target: access_persen >= target_persen,
    }
}

/// Satu baris hasil DU90%.
#[derive(Debug, Clone, Serialize)]
pub struct Du90Row {
    pub atc_code: String,
    pub adm_route: String,
    pub nama_generik: String,
    pub total_ddd: f64,
    pub persen: f64,
    pub kumulatif_persen: f64,
    pub dalam_du90: bool,
}

/// DU90%: urutkan antibiotik desc by total DDD, hitung kumulatif %, tandai
/// segmen sampai kumulatif mencapai 90%. Baris yang *melewati* ambang 90%
/// tetap termasuk (definisi DU90 inklusif); baris setelahnya di luar segmen.
pub fn du90(items: &[KonsumsiAB]) -> Vec<Du90Row> {
    let total: f64 = items.iter().map(|i| i.total_ddd()).sum();

    let mut ordered: Vec<(&KonsumsiAB, f64)> =
        items.iter().map(|i| (i, i.total_ddd())).collect();
    ordered.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let mut kum = 0.0;
    let mut out = Vec::with_capacity(ordered.len());
    for (it, d) in ordered {
        let persen = if total > 0.0 { d / total * 100.0 } else { 0.0 };
        let sebelum = kum; // kumulatif SEBELUM baris ini
        kum += persen;
        out.push(Du90Row {
            atc_code: it.atc_code.clone(),
            adm_route: it.adm_route.clone(),
            nama_generik: it.nama_generik.clone(),
            total_ddd: d,
            persen,
            kumulatif_persen: kum,
            dalam_du90: sebelum < 90.0, // termasuk baris yang menembus 90%
        });
    }
    out
}

// ============================================================================
//  UNIT TEST — fixture dummy, hasil dicocokkan hitungan manual (toleransi 1e-6)
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;

    fn approx(a: f64, b: f64) {
        assert!((a - b).abs() < 1e-6, "expected {b}, got {a}");
    }

    /// Fixture 3 antibiotik:
    ///   Ceftriaxone P : konsumsi 200 g, ddd 2.0 → total_ddd 100  (Watch)
    ///   Amoxicillin O : konsumsi 150 g, ddd 1.5 → total_ddd 100  (Access)
    ///   Ciprofloxacin O: konsumsi 20 g, ddd 1.0 → total_ddd  20  (Watch)
    /// ΣDDD = 220.
    fn fixture() -> Vec<KonsumsiAB> {
        vec![
            KonsumsiAB {
                atc_code: "J01DD04".into(),
                adm_route: "P".into(),
                nama_generik: "Ceftriaxone".into(),
                aware_kategori: AwareKategori::Watch,
                konsumsi: 200.0,
                ddd: 2.0,
            },
            KonsumsiAB {
                atc_code: "J01CA04".into(),
                adm_route: "O".into(),
                nama_generik: "Amoxicillin".into(),
                aware_kategori: AwareKategori::Access,
                konsumsi: 150.0,
                ddd: 1.5,
            },
            KonsumsiAB {
                atc_code: "J01MA02".into(),
                adm_route: "O".into(),
                nama_generik: "Ciprofloxacin".into(),
                aware_kategori: AwareKategori::Watch,
                konsumsi: 20.0,
                ddd: 1.0,
            },
        ]
    }

    #[test]
    fn total_ddd_per_item() {
        let f = fixture();
        approx(f[0].total_ddd(), 100.0);
        approx(f[1].total_ddd(), 100.0);
        approx(f[2].total_ddd(), 20.0);
    }

    #[test]
    fn ddd_guard_ddd_nol() {
        let it = KonsumsiAB {
            atc_code: "X".into(),
            adm_route: "P".into(),
            nama_generik: "Salah mapping".into(),
            aware_kategori: AwareKategori::Watch,
            konsumsi: 500.0,
            ddd: 0.0,
        };
        approx(it.total_ddd(), 0.0);
    }

    #[test]
    fn rasio_denominator() {
        let total_ddd: f64 = fixture().iter().map(|i| i.total_ddd()).sum();
        approx(total_ddd, 220.0);
        // ranap: 220 / 500 hari × 100 = 44.0
        approx(ddd_per_100_patient_days(total_ddd, 500.0), 44.0);
        // ralan: 220 / 1100 kunjungan × 1000 = 200.0
        approx(ddd_per_1000_populations(total_ddd, 1100.0), 200.0);
        // guard denominator 0
        approx(ddd_per_100_patient_days(total_ddd, 0.0), 0.0);
        approx(ddd_per_1000_populations(total_ddd, 0.0), 0.0);
    }

    #[test]
    fn aware_persen_dan_target() {
        let r = rekap_aware(&fixture(), 60.0);
        approx(r.access, 100.0);
        approx(r.watch, 120.0);
        approx(r.reserve, 0.0);
        approx(r.total, 220.0);
        // Access% = 100/220×100 = 45.4545...
        approx(r.access_persen, 100.0 / 220.0 * 100.0);
        assert!(!r.memenuhi_target, "45% < target 60% harus gagal");
    }

    #[test]
    fn du90_segmen() {
        let rows = du90(&fixture());
        // urut desc: Ceftriaxone 100 (45.45%), Amoxicillin 100 (kum 90.9%), Cipro 20 (kum 100%)
        assert_eq!(rows[0].nama_generik, "Ceftriaxone");
        assert!(rows[0].dalam_du90);
        assert!(rows[1].dalam_du90); // menembus 90% → masih termasuk
        assert!(!rows[2].dalam_du90); // di luar segmen DU90
        approx(rows[2].kumulatif_persen, 100.0);
        let jml_du90 = rows.iter().filter(|r| r.dalam_du90).count();
        assert_eq!(jml_du90, 2);
    }

    #[test]
    fn kosong_tidak_panik() {
        let empty: Vec<KonsumsiAB> = vec![];
        let r = rekap_aware(&empty, 60.0);
        approx(r.total, 0.0);
        approx(r.access_persen, 0.0);
        assert!(du90(&empty).is_empty());
    }
}
