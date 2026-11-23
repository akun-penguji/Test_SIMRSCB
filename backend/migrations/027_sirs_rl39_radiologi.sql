-- RL 3.9 — Rekapitulasi Pelayanan Radiologi (bulanan)
-- Per JUKNIS SIRS 6.3 Bab IV I.
-- 4 section (1 Radiodiagnostik, 2 Radioterapi, 3 Kedokteran Nuklir, 4 Imaging)
-- ~20 leaf + 4 parent. Master di Rust auto-seed. 1 angka per leaf (Jumlah).

CREATE TABLE IF NOT EXISTS sirs_rl39_entry (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  bulan        CHAR(7) NOT NULL,
  urutan       DECIMAL(5,1) NOT NULL,
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
