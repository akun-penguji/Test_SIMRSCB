use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Jadwal {
    pub kd_dokter: String,
    pub nm_dokter: Option<String>,
    pub hari_kerja: String,
    pub jam_mulai: String,
    pub jam_selesai: Option<String>,
    pub kd_poli: Option<String>,
    pub nm_poli: Option<String>,
    pub kuota: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct JadwalBaru {
    pub kd_dokter: String,
    pub hari_kerja: String,
    pub jam_mulai: String,
    pub jam_selesai: String,
    pub kd_poli: String,
    pub kuota: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct JadwalQuery {
    pub hari: Option<String>,
    pub kd_poli: Option<String>,
}
