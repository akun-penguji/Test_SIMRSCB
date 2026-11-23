use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Pasien {
    pub no_rm: String,
    pub nm_pasien: String,
    pub tgl_lahir: Option<NaiveDate>,
    pub jk: Option<String>,
    pub alamat: Option<String>,
    pub no_tlp: Option<String>,
    pub no_ktp: Option<String>,
    pub agama: Option<String>,
    pub pendidikan: Option<String>,
    pub pekerjaan: Option<String>,
    pub gol_darah: Option<String>,
    pub tgl_daftar: Option<NaiveDate>,
    pub kd_pj: Option<String>,
    pub nama_pj: Option<String>,
    pub hub_pj: Option<String>,
    pub nm_kel: Option<String>,
    pub nm_kec: Option<String>,
    pub nm_kab: Option<String>,
    #[serde(default)] pub tmp_lahir: Option<String>,
    #[serde(default)] pub nm_ibu: Option<String>,
    #[serde(default)] pub no_peserta: Option<String>,
    #[serde(default)] pub stts_nikah: Option<String>,
    #[serde(default)] pub email: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PasienRingkas {
    pub no_rm: String,
    pub nm_pasien: String,
    pub tgl_lahir: Option<NaiveDate>,
    pub jk: Option<String>,
    pub no_ktp: Option<String>,
    pub alamat: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PasienQuery {
    pub q: Option<String>,
    pub alamat: Option<String>,
    pub page: Option<u32>,
    pub size: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct PasienBaru {
    pub no_rm: Option<String>,      // None = auto-generate
    pub nm_pasien: String,
    pub tgl_lahir: Option<String>,
    pub jk: Option<String>,
    pub tmp_lahir: Option<String>,
    pub nm_ibu: Option<String>,
    pub alamat: Option<String>,
    pub no_tlp: Option<String>,
    pub no_ktp: Option<String>,
    pub no_peserta: Option<String>,
    pub agama: Option<String>,
    pub pendidikan: Option<String>,
    pub pekerjaan: Option<String>,
    pub gol_darah: Option<String>,
    pub stts_nikah: Option<String>,
    pub email: Option<String>,
    pub kd_pj: Option<String>,
    pub namakeluarga: Option<String>,
    pub keluarga: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PasienListResponse {
    pub data: Vec<PasienRingkas>,
    pub total: i64,
    pub page: u32,
    pub size: u32,
}
