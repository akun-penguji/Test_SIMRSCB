use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HakKewajibanPrefill {
    pub no_surat:          Option<String>,
    pub no_rawat:          String,
    pub tanggal:           Option<String>,
    pub jam:               Option<String>,
    pub pengobatan_kepada: Option<String>,
    pub nama_pj:           Option<String>,
    pub umur_pj:           Option<String>,
    pub no_ktppj:          Option<String>,
    pub jkpj:              Option<String>,
    pub bertindak_atas:    Option<String>,
    pub no_telp:           Option<String>,
    pub nip:               Option<String>,
    pub photo:             Option<String>,
    pub tandatangan:       Option<String>,
    pub keterangan_tambahan: Option<String>,
    pub persetujuan_khusus: Option<String>,
    pub catatan_petugas:    Option<String>,
    pub status_persetujuan: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SimpanHakKewajiban {
    pub no_surat:          Option<String>,
    pub no_rawat:          String,
    pub tanggal:           Option<String>,
    pub jam:               Option<String>,
    pub pengobatan_kepada: Option<String>,
    pub nama_pj:           String,
    pub umur_pj:           String,
    pub no_ktppj:          String,
    pub jkpj:              String,
    pub bertindak_atas:    String,
    pub no_telp:           String,
    pub nip:               String,
    pub keterangan_tambahan: Option<String>,
    pub persetujuan_khusus: Option<String>,
    pub catatan_petugas:    Option<String>,
    pub status_persetujuan: Option<String>,
}
