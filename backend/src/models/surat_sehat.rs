use serde::{Deserialize, Serialize};

/// Detail data yang dibutuhkan halaman Surat Keterangan Sehat:
/// gabungan registrasi+pasien+dokter+RS+vital signs (kalau ada di pemeriksaan_ralan)
/// + record surat_keterangan_sehat (kalau pernah disimpan untuk no_rawat ini)
#[derive(Debug, Serialize)]
pub struct SuratSehatPrefill {
    // Registrasi & pasien
    pub no_rawat: String,
    pub no_rm: String,
    pub nm_pasien: String,
    pub jk: String,
    pub umur: String,
    pub tgl_lahir: Option<String>,
    pub alamat: String,

    // Dokter
    pub kd_dokter: String,
    pub nm_dokter: String,

    // Vital signs (default dari pemeriksaan_ralan, fallback existing surat)
    pub berat: String,
    pub tinggi: String,
    pub tensi: String,
    pub nadi: String,
    pub rr: String,
    pub suhu: String,

    // Existing surat (kalau sudah ada)
    pub no_surat: Option<String>,
    pub tanggalsurat: Option<String>,
    pub butawarna: String,
    pub keperluan: String,
    pub kesimpulan: String,

    // Header RS
    pub nama_instansi: String,
    pub alamat_instansi: String,
    pub kabupaten: String,
    pub propinsi: String,
    pub kontak: String,
    pub email: String,

    // Verifikasi & TTD elektronik
    pub finger: String,        // SHA1 sidik jari dokter, fallback kd_dokter (sama dgn Java)
    pub verify_url: String,    // URL verifikasi keaslian surat (kosong = belum disimpan)
}

#[derive(Debug, Deserialize)]
pub struct SuratSehatSimpan {
    pub no_surat: Option<String>, // null = generate auto
    pub no_rawat: String,
    pub tanggalsurat: String, // YYYY-MM-DD
    pub berat: String,
    pub tinggi: String,
    pub tensi: String,
    pub nadi: String,
    pub rr: String,
    pub suhu: String,
    pub butawarna: String,  // "Ya" | "Tidak"
    pub keperluan: String,
    pub kesimpulan: String, // "Sehat" | "Sehat Jasmani dan Rohani" | "Tidak Sehat"
    pub kd_dokter: String,
}

#[derive(Debug, Serialize)]
pub struct SuratSehatSimpanResponse {
    pub success: bool,
    pub no_surat: String,
    pub message: String,
}
