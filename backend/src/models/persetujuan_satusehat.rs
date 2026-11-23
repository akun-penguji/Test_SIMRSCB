use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PersetujuanSatusehat {
    pub no_rawat:        String,
    pub no_rkm_medis:    String,
    pub persetujuan:     String,
    pub nip_petugas:     String,
    pub nama_petugas:    String,
    pub tgl_persetujuan: String,
}

#[derive(Debug, Deserialize)]
pub struct SimpanPersetujuanSatusehat {
    pub no_rawat:     String,
    pub persetujuan:  String,
    pub nip_petugas:  Option<String>,
    pub nama_petugas: Option<String>,
}
