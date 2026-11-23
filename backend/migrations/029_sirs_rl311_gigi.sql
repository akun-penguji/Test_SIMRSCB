-- RL 3.11 — Rekapitulasi Pelayanan Gigi dan Mulut (TAHUNAN)
-- Per JUKNIS SIRS 6.3 Bab IV K. 16 jenis kegiatan + TOTAL.

CREATE TABLE IF NOT EXISTS sirs_rl311_entry (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  tahun        CHAR(4) NOT NULL,
  urutan       INT NOT NULL,
  jenis_kode   VARCHAR(10) NOT NULL,
  jenis_nama   VARCHAR(120) NOT NULL,
  jumlah       INT,
  updated_at   DATETIME,
  updated_by   VARCHAR(20),
  UNIQUE KEY uniq_tahun_jenis (tahun, jenis_kode),
  KEY idx_tahun (tahun)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
