-- Analisa Beban Kerja Kesehatan (ABK-Kes, PMK 33/2015)
CREATE TABLE IF NOT EXISTS abk_unit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unit VARCHAR(100) NOT NULL,
    kategori_sdm VARCHAR(100) NOT NULL,
    tahun INT NOT NULL,
    jumlah_sdm_saat_ini INT DEFAULT 0,
    hari_kerja INT DEFAULT 312,
    cuti_hari INT DEFAULT 12,
    diklat_hari INT DEFAULT 6,
    libur_nasional_hari INT DEFAULT 19,
    ketidakhadiran_hari INT DEFAULT 10,
    jam_kerja_hari DECIMAL(4,1) DEFAULT 6,
    ftp DECIMAL(5,2) DEFAULT 1,
    keterangan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS abk_beban_kerja (
    id INT AUTO_INCREMENT PRIMARY KEY,
    abk_unit_id INT NOT NULL,
    nama_kegiatan VARCHAR(200) NOT NULL,
    waktu_rata2_menit DECIMAL(8,2) NOT NULL DEFAULT 30,
    total_kegiatan INT NOT NULL DEFAULT 0,
    keterangan TEXT,
    FOREIGN KEY (abk_unit_id) REFERENCES abk_unit(id) ON DELETE CASCADE
);
