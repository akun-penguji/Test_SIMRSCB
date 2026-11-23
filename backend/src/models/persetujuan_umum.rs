use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PersetujuanUmumPrefill {
    pub no_surat:                  Option<String>,
    pub no_rawat:                  String,
    pub tanggal:                   Option<String>,
    pub jam:                       Option<String>,
    pub pengobatan_kepada:         Option<String>,
    pub nilai_kepercayaan:         Option<String>,
    pub nama_pj:                   Option<String>,
    pub umur_pj:                   Option<String>,
    pub no_ktppj:                  Option<String>,
    pub jkpj:                      Option<String>,
    pub bertindak_atas:            Option<String>,
    pub no_telp:                   Option<String>,
    pub nip:                       Option<String>,
    // tambahan
    pub nama_keluarga_a:           Option<String>,
    pub hubungan_pasien_a:         Option<String>,
    pub nama_keluarga_b:           Option<String>,
    pub hubungan_pasien_b:         Option<String>,
    pub nama_keluarga_c:           Option<String>,
    pub hubungan_pasien_c:         Option<String>,
    pub hubungan_keluarga_a:       Option<String>,
    pub detail_hubungan_a:         Option<String>,
    pub hubungan_keluarga_b:       Option<String>,
    pub detail_hubungan_b:         Option<String>,
    pub hubungan_keluarga_c:       Option<String>,
    pub detail_hubungan_c:         Option<String>,
    pub pilihan_akses_kunjungan:   Option<String>,
    pub nama_tidak_diizinkan:      Option<String>,
    pub preferensi_perawat:        Option<String>,
    pub preferensi_dokter:         Option<String>,
    #[serde(default)] #[sqlx(default)] pub nilai_keyakinan:          Option<String>,   // JSON (reload input)
    #[serde(default)] #[sqlx(default)] pub nilai_keyakinan_cetak:    Option<String>,   // HTML (cetak; hanya item "Ya")
    #[serde(default)] #[sqlx(default)] pub permintaan_privasi:       Option<String>,
    #[serde(default)] #[sqlx(default)] pub permintaan_privasi_cetak: Option<String>,
    pub kelas_perawatan:           Option<String>,
    pub biaya_perkiraan_tindakan:  Option<String>,
    pub biaya_administrasi:        Option<String>,
    pub biaya_pemeriksaan_penunjang: Option<String>,
    pub biaya_farmasi:             Option<String>,
    pub biaya_lain_lain:           Option<String>,
    pub photo:                     Option<String>,
    pub signature_path:            Option<String>,
    pub saksi_pasien:              Option<String>,
    pub photo_saksi:               Option<String>,
    pub ttd_saksi:                 Option<String>,
    #[serde(default)] #[sqlx(default)] pub pelayanan_rohani: Option<String>,
    #[serde(default)] #[sqlx(default)] pub pelepasan_informasi: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SimpanPersetujuanUmum {
    pub no_surat:                  Option<String>,
    pub no_rawat:                  String,
    pub tanggal:                   Option<String>,            // YYYY-MM-DD
    pub jam:                       Option<String>,            // HH:MM (jam TTD pasien)
    pub pengobatan_kepada:         Option<String>,
    pub nilai_kepercayaan:         Option<String>,
    pub nama_pj:                   String,
    pub umur_pj:                   String,
    pub no_ktppj:                  String,
    pub jkpj:                      String,                    // "L" | "P"
    pub bertindak_atas:            String,
    pub no_telp:                   String,
    pub nip:                       String,
    // tambahan (semua optional — boleh kosong)
    pub nama_keluarga_a:           Option<String>,
    pub hubungan_pasien_a:         Option<String>,
    pub nama_keluarga_b:           Option<String>,
    pub hubungan_pasien_b:         Option<String>,
    pub nama_keluarga_c:           Option<String>,
    pub hubungan_pasien_c:         Option<String>,
    pub hubungan_keluarga_a:       Option<String>,
    pub detail_hubungan_a:         Option<String>,
    pub hubungan_keluarga_b:       Option<String>,
    pub detail_hubungan_b:         Option<String>,
    pub hubungan_keluarga_c:       Option<String>,
    pub detail_hubungan_c:         Option<String>,
    pub pilihan_akses_kunjungan:   Option<String>,            // "Mengizinkan" | "Tidak Mengizinkan"
    pub nama_tidak_diizinkan:      Option<String>,
    pub preferensi_perawat:        Option<String>,            // "Laki-laki" | "Perempuan" | "Tidak keberatan"
    pub preferensi_dokter:         Option<String>,
    #[serde(default)] pub nilai_keyakinan:    Option<String>, // JSON array [{k,label,ya,d}]
    #[serde(default)] pub permintaan_privasi: Option<String>, // JSON array [{k,label,ya,d}]
    pub kelas_perawatan:           Option<String>,
    pub biaya_perkiraan_tindakan:  Option<String>,
    pub biaya_administrasi:        Option<String>,
    pub biaya_pemeriksaan_penunjang: Option<String>,
    pub biaya_farmasi:             Option<String>,
    pub biaya_lain_lain:           Option<String>,
    pub saksi_pasien:              Option<String>,
    #[serde(default)] pub pelayanan_rohani: Option<String>,
    #[serde(default)] pub pelepasan_informasi: Option<String>,
}
