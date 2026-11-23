-- RL 3.13 — Rekapitulasi Pelayanan Rehabilitasi Medik (TAHUNAN)
-- Per JUKNIS SIRS 6.3 Bab IV M. 7 kategori parent + 42 leaf = 49 rows.

CREATE TABLE IF NOT EXISTS sirs_rl313_entry (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  tahun        CHAR(4) NOT NULL,
  urutan       DECIMAL(5,2) NOT NULL,
  jenis_kode   VARCHAR(10) NOT NULL,
  jenis_nama   VARCHAR(180) NOT NULL,
  parent_kode  VARCHAR(10) NULL,
  is_parent    TINYINT(1) NOT NULL DEFAULT 0,
  jumlah       INT,
  updated_at   DATETIME,
  updated_by   VARCHAR(20),
  UNIQUE KEY uniq_tahun_jenis (tahun, jenis_kode),
  KEY idx_tahun (tahun)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
