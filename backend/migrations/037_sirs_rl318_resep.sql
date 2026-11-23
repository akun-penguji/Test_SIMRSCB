-- RL 3.18 — Rekapitulasi Pelayanan Farmasi RS - Resep (TAHUNAN)
-- Per JUKNIS SIRS 6.3 Bab IV R. 4 golongan obat × 3 lokasi (Rawat Jalan, IGD, Rawat Inap).

CREATE TABLE IF NOT EXISTS sirs_rl318_entry (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tahun       CHAR(4) NOT NULL,
  urutan      INT NOT NULL,
  jenis_kode  VARCHAR(10) NOT NULL,
  jenis_nama  VARCHAR(180) NOT NULL,
  rawat_jalan INT,
  igd         INT,
  rawat_inap  INT,
  updated_at  DATETIME,
  updated_by  VARCHAR(20),
  UNIQUE KEY uniq_tahun_jenis (tahun, jenis_kode),
  KEY idx_tahun (tahun)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
