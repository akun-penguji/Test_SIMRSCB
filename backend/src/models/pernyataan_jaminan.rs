use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PernyataanJaminanPrefill {
    pub no_surat:          Option<String>,
    pub no_rawat:          String,
    pub tanggal:           Option<String>,
    pub nama_pj:           Option<String>,
    pub no_ktppj:          Option<String>,
    pub tempat_lahirpj:    Option<String>,
    pub lahirpj:           Option<String>,
    pub jkpj:              Option<String>,
    pub alamatpj:          Option<String>,
    pub hubungan:          Option<String>,
    pub no_telp:           Option<String>,
    pub nip:               Option<String>,
    pub kd_pj:             Option<String>,
    pub png_jawab:         Option<String>,
    pub penyakit_diderita: Option<String>,
    pub photo:             Option<String>,
    pub signature_path:    Option<String>,
    pub status_jaminan:    Option<String>,
    pub jenis_jaminan:     Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SimpanPernyataanJaminan {
    pub no_surat:          Option<String>,
    pub no_rawat:          String,
    pub tanggal:           Option<String>,   // YYYY-MM-DD
    pub nama_pj:           String,
    pub no_ktppj:          String,
    pub tempat_lahirpj:    String,
    pub lahirpj:           String,           // YYYY-MM-DD
    pub jkpj:              String,           // "L" | "P"
    pub alamatpj:          String,
    pub hubungan:          String,           // enum Khanza
    pub no_telp:           String,
    pub nip:               String,
    pub kd_pj:             String,           // cara bayar (penjab.kd_pj)
    pub penyakit_diderita: Option<String>,
    pub status_jaminan:    Option<String>,   // "TIDAK MEMILIKI" | "TIDAK MENGGUNAKAN"
    pub jenis_jaminan:     Option<String>,   // "BPJS" | "KIS" | "Perusahaan"
}
