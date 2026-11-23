-- RL 3.19 — Rekapitulasi Cara Bayar (TAHUNAN)
-- Per JUKNIS SIRS 6.3 Bab IV S. 11 baris (9 leaf + 2 parent).
-- 5 kolom angka per leaf: pasien_keluar (ranap), lama_dirawat (ranap),
-- ralan_lab, ralan_rad, ralan_lain. Total ralan = lab+rad+lain (computed).

CREATE TABLE IF NOT EXISTS sirs_rl319_entry (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tahun           CHAR(4) NOT NULL,
  urutan          DECIMAL(5,2) NOT NULL,
  jenis_kode      VARCHAR(10) NOT NULL,
  jenis_nama      VARCHAR(180) NOT NULL,
  parent_kode     VARCHAR(10) NULL,
  is_parent       TINYINT(1) NOT NULL DEFAULT 0,
  pasien_keluar   INT,
  lama_dirawat    INT,
  ralan_lab       INT,
  ralan_rad       INT,
  ralan_lain      INT,
  updated_at      DATETIME,
  updated_by      VARCHAR(20),
  UNIQUE KEY uniq_tahun_jenis (tahun, jenis_kode),
  KEY idx_tahun (tahun)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
