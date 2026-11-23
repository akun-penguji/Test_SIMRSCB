-- RL 3.10 — Rekapitulasi Kegiatan Pelayanan Rujukan (bulanan)
-- Per JUKNIS SIRS 6.3 Bab IV J.
-- 20 spesialisasi + TOTAL. Kolom: RM Diterima Dari (Pus/RS/Faskes), RM Dikembalikan ke (Pus/RS Asal/Faskes),
-- Dirujuk Keluar (Pasien Rujukan, Pasien Datang Sendiri, Diterima Kembali).
-- Total per grup dihitung di render.

CREATE TABLE IF NOT EXISTS sirs_rl310_entry (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  bulan        CHAR(7) NOT NULL,
  urutan       INT NOT NULL,
  jenis_kode   VARCHAR(10) NOT NULL,
  jenis_nama   VARCHAR(120) NOT NULL,
  -- Rujukan Masuk diterima dari
  rm_in_pus     INT,
  rm_in_rs      INT,
  rm_in_faskes  INT,
  -- Rujukan Masuk dikembalikan ke
  rm_out_pus    INT,
  rm_out_rs     INT,
  rm_out_faskes INT,
  -- Dirujuk Keluar
  rk_pasien_rujukan       INT,
  rk_pasien_datang_sendiri INT,
  rk_diterima_kembali     INT,
  updated_at   DATETIME,
  updated_by   VARCHAR(20),
  UNIQUE KEY uniq_bulan_jenis (bulan, jenis_kode),
  KEY idx_bulan (bulan)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
