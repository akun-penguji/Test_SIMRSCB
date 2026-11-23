use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Registrasi {
    pub no_rawat: String,
    pub tgl_registrasi: Option<NaiveDate>,
    pub no_rm: String,
    pub nm_pasien: Option<String>,
    pub kd_poli: Option<String>,
    pub nm_poli: Option<String>,
    pub kd_dokter: Option<String>,
    pub nm_dokter: Option<String>,
    pub stts: Option<String>,
    pub stts_daftar: Option<String>,
    pub no_reg: Option<String>,
    pub kd_pj: Option<String>,
    pub png_jawab: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RegistrasiQuery {
    pub tgl: Option<String>,
    pub tgl_awal: Option<String>,
    pub tgl_akhir: Option<String>,
    pub poli: Option<String>,
    pub dokter: Option<String>,
    pub cari: Option<String>,
    pub page: Option<u32>,
    pub size: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct RegistrasiBaru {
    pub no_rm: String,
    pub tgl_registrasi: String,
    pub jam_reg: Option<String>,
    pub kd_poli: String,
    pub kd_dokter: String,
    pub stts_daftar: String,
    pub kd_pj: String,
    pub p_jawab: Option<String>,
    pub almt_pj: Option<String>,
    pub hubunganpj: Option<String>,
    pub no_rawat: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Poli {
    pub kd_poli: String,
    pub nm_poli: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Dokter {
    pub kd_dokter: String,
    pub nm_dokter: String,
    pub kd_poli: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Penjab {
    pub kd_pj: String,
    pub png_jawab: String,
}

#[derive(Debug, Serialize)]
pub struct RegistrasiListResponse {
    pub data: Vec<Registrasi>,
    pub total: i64,
    pub page: u32,
    pub size: u32,
}
