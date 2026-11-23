-- RL 3.17 — Rekapitulasi Pelayanan Farmasi RS - Pengadaan Obat (TAHUNAN)
-- Per JUKNIS SIRS 6.3 Bab IV Q. 4 golongan obat × 2 kolom:
-- Jumlah Item Obat (yang dibutuhkan) + Jumlah Item Obat Yang Tersedia di RS

CREATE TABLE IF NOT EXISTS sirs_rl317_entry (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tahun           CHAR(4) NOT NULL,
  urutan          INT NOT NULL,
  jenis_kode      VARCHAR(10) NOT NULL,
  jenis_nama      VARCHAR(180) NOT NULL,
  jumlah_item     INT,
  jumlah_tersedia INT,
  updated_at      DATETIME,
  updated_by      VARCHAR(20),
  UNIQUE KEY uniq_tahun_jenis (tahun, jenis_kode),
  KEY idx_tahun (tahun)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
