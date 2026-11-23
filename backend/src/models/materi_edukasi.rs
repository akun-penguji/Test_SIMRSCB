use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MateriEdukasiRow {
    pub no_rawat:         String,
    pub tanggal:          String,
    pub jam:              String,
    pub diberikan_pada:   Option<String>,
    pub penerima_edukasi: Option<String>,
    pub profesi:          Option<String>,
    pub materi_edukasi:   Option<String>,
    pub kode_leaflet:     Option<String>,
    pub lama_edukasi:     Option<String>,
    pub hasil_verifikasi: Option<String>,
    pub nip:              Option<String>,
    pub nama_petugas:     Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SimpanMateriEdukasi {
    pub no_rawat:         String,
    pub tanggal:          String,   // YYYY-MM-DD
    pub jam:              String,   // HH:MM:SS
    pub diberikan_pada:   Option<String>,
    pub penerima_edukasi: Option<String>,
    pub profesi:          Option<String>,
    pub materi_edukasi:   String,
    pub kode_leaflet:     Option<String>,
    pub lama_edukasi:     Option<String>,
    pub hasil_verifikasi: Option<String>,
    pub nip:              String,
}
