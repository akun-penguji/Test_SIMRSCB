use serde_json::Value;

fn get_i64(v: &Value, keys: &[&str]) -> i64 {
    for k in keys {
        if let Some(val) = v.get(*k) {
            if let Some(n) = val.as_i64() {
                return n;
            }
            if let Some(s) = val.as_str() {
                if let Ok(n) = s.trim().parse::<i64>() {
                    return n;
                }
            }
        }
    }
    0
}

/// Validasi formulir RL 3.2 sesuai Petunjuk Teknis SIRS 6.3 Halaman 17-19
pub fn validate_rl32(items: &[Value]) -> Vec<String> {
    let mut errs = Vec::new();

    for (idx, it) in items.iter().enumerate() {
        let awal = get_i64(it, &["pasien_awal_bulan", "pasienAwalBulan", "awal"]);
        let masuk = get_i64(it, &["pasien_masuk", "pasienMasuk", "masuk"]);
        let pindahan = get_i64(it, &["pasien_pindahan", "pasienPindahan", "pindahan"]);
        let dipindahkan = get_i64(it, &["pasien_dipindahkan", "pasienDipindahkan", "dipindahkan"]);
        let keluar_hidup = get_i64(it, &["pasien_keluar_hidup", "pasienKeluarHidup", "keluar_hidup"]);
        
        let mati_l_lt48 = get_i64(it, &["pasien_keluar_mati_kurang_48_l", "pasienKeluarMatiKurang48L", "mati_l_lt48", "mati_kurang_48_l"]);
        let mati_p_lt48 = get_i64(it, &["pasien_keluar_mati_kurang_48_p", "pasienKeluarMatiKurang48P", "mati_p_lt48", "mati_kurang_48_p"]);
        let mati_l_ge48 = get_i64(it, &["pasien_keluar_mati_lebih_48_l", "pasienKeluarMatiLebih48L", "mati_l_ge48", "mati_lebih_48_l"]);
        let mati_p_ge48 = get_i64(it, &["pasien_keluar_mati_lebih_48_p", "pasienKeluarMatiLebih48P", "mati_p_ge48", "mati_lebih_48_p"]);
        let total_mati = mati_l_lt48 + mati_p_lt48 + mati_l_ge48 + mati_p_ge48;

        let akhir = get_i64(it, &["pasien_akhir_bulan", "pasienAkhirBulan", "akhir_bulan"]);
        let lama_dirawat = get_i64(it, &["jumlah_lama_dirawat", "jumlahLamaDirawat", "lama_dirawat"]);
        let total_hp = get_i64(it, &["jumlah_hari_perawatan", "jumlahHariPerawatan", "hari_perawatan"]);
        let tt = get_i64(it, &["alokasi_tempat_tidur", "alokasiTempatTidur", "tt"]);
        let id_pelayanan = get_i64(it, &["jenis_pelayanan_id", "jenisPelayananId", "id"]);

        // Abaikan jika baris kosong total
        let total_aktivitas = awal + masuk + pindahan + keluar_hidup + dipindahkan + total_hp + lama_dirawat;
        if total_aktivitas == 0 && tt == 0 {
            continue;
        }

        // Aturan 1: Pasien Akhir Bulan = (Awal + Masuk + Pindahan) - (Keluar Hidup + Mati + Dipindahkan)
        let expected_akhir = (awal + masuk + pindahan) - (keluar_hidup + total_mati + dipindahkan);
        if akhir != expected_akhir {
            errs.push(format!(
                "Baris {} (ID Pelayanan {}): Pasien Akhir Bulan ({}) tidak sesuai perhitungan matematika. Seharusnya: {} = ({} + {} + {}) - ({} + {} + {})",
                idx + 1, id_pelayanan, akhir, expected_akhir,
                awal, masuk, pindahan,
                keluar_hidup, total_mati, dipindahkan
            ));
        }

        // Aturan 2: Rincian Hari Perawatan
        let vvip = get_i64(it, &["rincian_hari_perawatan_vvip", "rincianHariPerawatanVVIP", "hp_vvip"]);
        let vip = get_i64(it, &["rincian_hari_perawatan_vip", "rincianHariPerawatanVIP", "hp_vip"]);
        let k1 = get_i64(it, &["rincian_hari_perawatan_1", "rincianHariPerawatan1", "hp_i"]);
        let k2 = get_i64(it, &["rincian_hari_perawatan_2", "rincianHariPerawatan2", "hp_ii"]);
        let k3 = get_i64(it, &["rincian_hari_perawatan_3", "rincianHariPerawatan3", "hp_iii"]);
        let khusus = get_i64(it, &["rincian_hari_perawatan_khusus", "rincianHariPerawatanKhusus", "hp_khusus"]);
        let sum_hp = vvip + vip + k1 + k2 + k3 + khusus;

        if total_hp != sum_hp {
            errs.push(format!(
                "Baris {} (ID Pelayanan {}): Jumlah Hari Perawatan ({}) tidak cocok dengan total rincian kelas ({}).",
                idx + 1, id_pelayanan, total_hp, sum_hp
            ));
        }

        // Aturan 3: Hari Perawatan tidak boleh kurang dari Lama Dirawat
        if total_hp < lama_dirawat {
            errs.push(format!(
                "Baris {} (ID Pelayanan {}): Jumlah Hari Perawatan ({}) KURANG DARI Jumlah Lama Dirawat ({}). Sesuai Juknis SIRS 6.3, data tidak dapat disimpan!",
                idx + 1, id_pelayanan, total_hp, lama_dirawat
            ));
        }
    }

    errs
}

/// Validasi formulir RL 3.3 sesuai Petunjuk Teknis SIRS 6.3 Halaman 20-21
pub fn validate_rl33(items: &[Value]) -> Vec<String> {
    let mut errs = Vec::new();

    for (idx, it) in items.iter().enumerate() {
        let rujukan = get_i64(it, &["total_pasien_rujukan", "totalPasienRujukan", "rujukan"]);
        let non_rujukan = get_i64(it, &["total_pasien_non_rujukan", "totalPasienNonRujukan", "non_rujukan"]);
        let total_pasien = rujukan + non_rujukan;

        let rawat = get_i64(it, &["tindak_lanjut_dirawat", "tindakLanjutDirawat", "dirawat"]);
        let rujuk = get_i64(it, &["tindak_lanjut_dirujuk", "tindakLanjutDirujuk", "dirujuk"]);
        let pulang = get_i64(it, &["tindak_lanjut_pulang", "tindakLanjutPulang", "pulang"]);
        let mati = get_i64(it, &["mati_di_igd", "matiDiIgd", "mati"]);
        let doa = get_i64(it, &["doa", "DOA"]);
        let luka = get_i64(it, &["luka_luka", "lukaLuka", "luka"]);
        let id_pelayanan = get_i64(it, &["jenis_pelayanan_id", "jenisPelayananId", "id"]);

        if total_pasien == 0 && rawat == 0 && rujuk == 0 && pulang == 0 {
            continue;
        }

        let total_tindak_lanjut = rawat + rujuk + pulang + mati + doa;
        if total_pasien != total_tindak_lanjut {
            errs.push(format!(
                "Baris {} (ID {}): Total Pasien ({}) tidak sama dengan akumulasi tindak lanjut + mati + doa ({}). Rincian: [Rujukan={}, NonRujukan={}] vs [Rawat={}, Rujuk={}, Pulang={}, Mati={}, DOA={}]",
                idx + 1, id_pelayanan, total_pasien, total_tindak_lanjut,
                rujukan, non_rujukan,
                rawat, rujuk, pulang, mati, doa
            ));
        }

        if luka > total_pasien {
            errs.push(format!(
                "Baris {} (ID {}): Jumlah luka-luka ({}) melebihi total pasien ({}).",
                idx + 1, id_pelayanan, luka, total_pasien
            ));
        }
    }

    errs
}

/// Validasi formulir RL 3.5 sesuai Petunjuk Teknis SIRS 6.3 Halaman 23-26
pub fn validate_rl35(items: &[Value]) -> Vec<String> {
    let mut errs = Vec::new();

    for (idx, it) in items.iter().enumerate() {
        let id = get_i64(it, &["jenis_kegiatan_id", "jenisKegiatanId", "id"]);
        if id == 66 || id == 77 {
            continue;
        }

        let dlm_l = get_i64(it, &["kunjungan_pasien_dalam_kabkota_laki", "kunjunganPasienDalamKabKotaLaki", "dlm_l"]);
        let dlm_p = get_i64(it, &["kunjungan_pasien_dalam_kabkota_perempuan", "kunjunganPasienDalamKabKotaPerempuan", "dlm_p"]);
        let luar_l = get_i64(it, &["kunjungan_pasien_luar_kabkota_laki", "kunjunganPasienLuarKabKotaLaki", "luar_l"]);
        let luar_p = get_i64(it, &["kunjungan_pasien_luar_kabkota_perempuan", "kunjunganPasienLuarKabKotaPerempuan", "luar_p"]);
        let total = get_i64(it, &["total_kunjungan", "totalKunjungan", "total"]);

        let sum = dlm_l + dlm_p + luar_l + luar_p;
        if total != sum && (total > 0 || sum > 0) {
            errs.push(format!(
                "Baris {} (ID Kegiatan {}): Total Kunjungan ({}) tidak sama dengan penjumlahan rincian gender & domisili ({}).",
                idx + 1, id, total, sum
            ));
        }
    }

    errs
}
