use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LogKinerjaRow {
    pub id:           i64,
    pub nip:          String,
    pub nama_pegawai: Option<String>,
    pub tanggal:      String,            // YYYY-MM-DD
    pub jam_mulai:    String,            // HH:MM
    pub jam_selesai:  Option<String>,    // HH:MM
    pub judul:        String,
    pub deskripsi:    Option<String>,
    pub lokasi:       Option<String>,
    pub foto_count:   i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LogKinerjaFotoRow {
    pub id:          i64,
    pub log_id:      i64,
    pub url_image:   String,
    pub caption:     Option<String>,
    pub uploaded_at: String,
}

#[derive(Debug, Deserialize)]
pub struct SimpanLogKinerja {
    pub tanggal:     String,             // YYYY-MM-DD
    pub jam_mulai:   String,             // HH:MM atau HH:MM:SS
    pub jam_selesai: Option<String>,     // HH:MM atau HH:MM:SS
    pub judul:       String,
    pub deskripsi:   Option<String>,
    pub lokasi:      Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UploadFotoBody {
    pub foto_base64: String,             // data URL atau base64 saja
    pub caption:     Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RekapHarianRow {
    pub tanggal:     String,             // YYYY-MM-DD
    pub jumlah_log:  i64,
    pub total_menit: i64,                // total menit per hari (agregat di handler)
    pub judul_list:  Option<String>,     // gabungan judul kegiatan
}
