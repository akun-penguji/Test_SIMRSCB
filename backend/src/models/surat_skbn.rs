use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct SuratSkbnPrefill {
    pub no_rawat: String,
    pub no_rm: String,
    pub nm_pasien: String,
    pub jk: String,
    pub umur: String,
    pub tgl_lahir: Option<String>,
    pub alamat: String,
    pub kd_dokter: String,
    pub nm_dokter: String,
    pub no_surat: Option<String>,
    pub tanggalsurat: Option<String>,
    pub kategori: String,    // 'UMUM' | 'POLRI' | 'TNI'
    pub keperluan: String,
    pub opiat: String,       // 'NEGATIF' | 'POSITIF'
    pub ganja: String,
    pub amphetamin: String,
    pub methamphetamin: String,
    pub benzodiazepin: String,
    pub cocain: String,
    pub nama_instansi: String,
    pub alamat_instansi: String,
    pub kabupaten: String,
    pub propinsi: String,
    pub kontak: String,
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct SuratSkbnSimpan {
    pub no_surat: Option<String>,
    pub no_rawat: String,
    pub tanggalsurat: String,
    pub kategori: String,
    pub kd_dokter: String,
    pub keperluan: String,
    pub opiat: String,
    pub ganja: String,
    pub amphetamin: String,
    pub methamphetamin: String,
    pub benzodiazepin: String,
    pub cocain: String,
}

#[derive(Debug, Serialize)]
pub struct SuratSkbnSimpanResponse {
    pub success: bool,
    pub no_surat: String,
    pub message: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SuratSkbnRow {
    pub no_surat: String,
    pub no_rawat: String,
    pub no_rm: String,
    pub nm_pasien: String,
    pub tanggalsurat: String,
    pub kategori: String,
    pub keperluan: String,
    pub kd_dokter: String,
    pub nm_dokter: String,
}

#[derive(Debug, Serialize)]
pub struct SuratSkbnListResponse {
    pub data: Vec<SuratSkbnRow>,
    pub total: i64,
    pub page: i64,
    pub size: i64,
}
