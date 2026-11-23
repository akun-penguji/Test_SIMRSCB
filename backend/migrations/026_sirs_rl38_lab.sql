-- RL 3.8 — Rekapitulasi Kegiatan Pelayanan Laboratorium (bulanan)
-- Per JUKNIS SIRS 6.3 Bab IV H.
-- ~155 baris (4 section A/B/C/D + parent + leaf). Master di Rust, auto-seed.
-- Kolom: Jml Pemeriksaan L/P + Nilai Rata-Rata Pemeriksaan L/P.

CREATE TABLE IF NOT EXISTS sirs_rl38_entry (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  bulan        CHAR(7) NOT NULL,
  urutan       DECIMAL(6,2) NOT NULL,
  jenis_kode   VARCHAR(10) NOT NULL,
  jenis_nama   VARCHAR(220) NOT NULL,
  parent_kode  VARCHAR(10) NULL,
  is_parent    TINYINT(1) NOT NULL DEFAULT 0,
  section      CHAR(1) NULL,         -- 'A' PK, 'B' MB, 'C' Parasit, 'D' PA
  jml_l        INT,
  jml_p        INT,
  rata_l       DECIMAL(10,3),
  rata_p       DECIMAL(10,3),
  updated_at   DATETIME,
  updated_by   VARCHAR(20),
  UNIQUE KEY uniq_bulan_jenis (bulan, jenis_kode),
  KEY idx_bulan (bulan)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
