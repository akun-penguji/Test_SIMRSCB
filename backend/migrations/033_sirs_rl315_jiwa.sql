-- RL 3.15 — Rekapitulasi Pelayanan Kesehatan Jiwa (TAHUNAN)
-- Per JUKNIS SIRS 6.3 Bab IV O. 8 jenis × (L, P). Jumlah = L + P (computed).

CREATE TABLE IF NOT EXISTS sirs_rl315_entry (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  tahun        CHAR(4) NOT NULL,
  urutan       INT NOT NULL,
  jenis_kode   VARCHAR(10) NOT NULL,
  jenis_nama   VARCHAR(120) NOT NULL,
  jml_l        INT,
  jml_p        INT,
  updated_at   DATETIME,
  updated_by   VARCHAR(20),
  UNIQUE KEY uniq_tahun_jenis (tahun, jenis_kode),
  KEY idx_tahun (tahun)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
