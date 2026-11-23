use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct SuratRohaniPrefill {
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
    pub keperluan: String,
    pub kesimpulan: String, // 'Sehat Rohani' | 'Tidak Sehat Rohani'
    pub nama_instansi: String,
    pub alamat_instansi: String,
    pub kabupaten: String,
    pub propinsi: String,
    pub kontak: String,
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct SuratRohaniSimpan {
    pub no_surat: Option<String>,
    pub no_rawat: String,
    pub tanggalsurat: String,
    pub keperluan: String,
    pub kesimpulan: String,
}

#[derive(Debug, Serialize)]
pub struct SuratRohaniSimpanResponse {
    pub success: bool,
    pub no_surat: String,
    pub message: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SuratRohaniRow {
    pub no_surat: String,
    pub no_rawat: String,
    pub no_rm: String,
    pub nm_pasien: String,
    pub tanggalsurat: String,
    pub keperluan: String,
    pub kesimpulan: String,
}

#[derive(Debug, Serialize)]
pub struct SuratRohaniListResponse {
    pub data: Vec<SuratRohaniRow>,
    pub total: i64,
    pub page: i64,
    pub size: i64,
}
