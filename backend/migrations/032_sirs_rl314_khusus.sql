-- RL 3.14 — Rekapitulasi Pelayanan Khusus (BULANAN)
-- Per JUKNIS SIRS 6.3 Bab IV N. 18 main + 5 sub (16.x) = 23 rows.

CREATE TABLE IF NOT EXISTS sirs_rl314_entry (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  bulan        CHAR(7) NOT NULL,
  urutan       DECIMAL(5,2) NOT NULL,
  jenis_kode   VARCHAR(10) NOT NULL,
  jenis_nama   VARCHAR(180) NOT NULL,
  parent_kode  VARCHAR(10) NULL,
  is_parent    TINYINT(1) NOT NULL DEFAULT 0,
  jumlah       INT,
  updated_at   DATETIME,
  updated_by   VARCHAR(20),
  UNIQUE KEY uniq_bulan_jenis (bulan, jenis_kode),
  KEY idx_bulan (bulan)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
