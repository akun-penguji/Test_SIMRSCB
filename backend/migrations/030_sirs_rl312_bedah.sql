-- RL 3.12 — Rekapitulasi Pelayanan Pembedahan (bulanan)
-- Per JUKNIS SIRS 6.3 Bab IV L. 16 spesialisasi × (Khusus/Besar/Sedang/Kecil).
-- Total per row dihitung di render. Kategori manual (ditetapkan oleh kebijakan RS).

CREATE TABLE IF NOT EXISTS sirs_rl312_entry (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  bulan        CHAR(7) NOT NULL,
  urutan       INT NOT NULL,
  jenis_kode   VARCHAR(10) NOT NULL,
  jenis_nama   VARCHAR(120) NOT NULL,
  khusus       INT,
  besar        INT,
  sedang       INT,
  kecil        INT,
  updated_at   DATETIME,
  updated_by   VARCHAR(20),
  UNIQUE KEY uniq_bulan_jenis (bulan, jenis_kode),
  KEY idx_bulan (bulan)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
