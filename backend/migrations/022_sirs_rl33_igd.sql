-- ─────────────────────────────────────────────────────────────
-- SIRS RL 3.3 — Rekap Kegiatan Pelayanan Rawat Darurat (IGD)
-- Per JUKNIS: data per kategori JUKNIS (bedah/non bedah/dst).
-- Auto-compute total IGD realtime dari reg_periksa Khanza
-- (sebagai sanity check), per-kategori entry manual.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sirs_rl33_entry (
  id              INT          AUTO_INCREMENT PRIMARY KEY,
  bulan           CHAR(7)      NOT NULL,             -- YYYY-MM
  urutan          DECIMAL(4,1) NOT NULL,             -- 1, 1.1, 1.2, ..., 99
  jenis_kode      VARCHAR(10)  NOT NULL,             -- "1.1", "2.3", "99"
  jenis_nama      VARCHAR(120) NOT NULL,             -- "Kecelakaan lalu lintas darat"
  parent_kode     VARCHAR(10)  NULL,                 -- NULL untuk top-level/leaf langsung
  is_parent       TINYINT(1)   NOT NULL DEFAULT 0,   -- 1 = baris induk (1=Bedah, 2=Non Bedah)
  rujukan         INT          NOT NULL DEFAULT 0,
  non_rujukan     INT          NOT NULL DEFAULT 0,
  dirawat         INT          NOT NULL DEFAULT 0,
  dirujuk         INT          NOT NULL DEFAULT 0,
  pulang          INT          NOT NULL DEFAULT 0,
  mati_l          INT          NOT NULL DEFAULT 0,
  mati_p          INT          NOT NULL DEFAULT 0,
  doa_l           INT          NOT NULL DEFAULT 0,
  doa_p           INT          NOT NULL DEFAULT 0,
  luka_l          INT          NOT NULL DEFAULT 0,
  luka_p          INT          NOT NULL DEFAULT 0,
  false_emergency INT          NOT NULL DEFAULT 0,
  updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by      VARCHAR(20)  NULL,
  UNIQUE KEY uniq_bulan_jenis (bulan, jenis_kode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='SIRS RL 3.3 — entry per kategori JUKNIS IGD';

-- Dummy: seed kategori standar + sample data Mei 2026
-- Total kunjungan IGD Mei 2026 di Khanza = 907 (sebagai referensi)
INSERT INTO sirs_rl33_entry
  (bulan, urutan, jenis_kode, jenis_nama, parent_kode, is_parent,
   rujukan, non_rujukan, dirawat, dirujuk, pulang, mati_l, mati_p,
   doa_l, doa_p, luka_l, luka_p, false_emergency)
VALUES
  -- Bedah di IGD (kode 1.x)
  ('2026-05', 1.1, '1.1', 'Kecelakaan lalu lintas darat',          '1', 0, 12,  88,  20,  4, 75, 0, 0, 0, 0, 35, 45, 0),
  ('2026-05', 1.2, '1.2', 'Kecelakaan lalu lintas perairan',       '1', 0,  0,   0,   0,  0,  0, 0, 0, 0, 0,  0,  0, 0),
  ('2026-05', 1.3, '1.3', 'Kecelakaan lalu lintas udara',          '1', 0,  0,   0,   0,  0,  0, 0, 0, 0, 0,  0,  0, 0),
  ('2026-05', 1.4, '1.4', 'Bedah lainnya (non kecelakaan)',        '1', 0,  5,  42,  18,  2, 26, 0, 0, 0, 0,  3,  4, 0),
  -- Non Bedah (kode 2.x)
  ('2026-05', 2.1, '2.1', 'Kekerasan terhadap Perempuan (≥18 thn)','2', 0,  0,   2,   0,  0,  2, 0, 0, 0, 0,  0,  2, 0),
  ('2026-05', 2.2, '2.2', 'Kekerasan terhadap Anak (<18 thn)',     '2', 0,  0,   3,   1,  0,  2, 0, 0, 0, 0,  2,  1, 0),
  ('2026-05', 2.3, '2.3', 'Kekerasan lainnya',                     '2', 0,  0,   1,   0,  0,  1, 0, 0, 0, 0,  0,  0, 0),
  ('2026-05', 2.4, '2.4', 'Non bedah lainnya',                     '2', 0, 65, 380,  92,  8,340, 2, 3, 1, 0,  0,  0, 35),
  -- Standalone (3-7)
  ('2026-05', 3.0, '3',   'Kebidanan',                              NULL, 0,  8,  55,  35,  3, 25, 0, 0, 0, 0,  0,  0, 2),
  ('2026-05', 4.0, '4',   'Psikiatrik',                             NULL, 0,  2,   8,   2,  1,  7, 0, 0, 0, 0,  0,  0, 1),
  ('2026-05', 5.0, '5',   'Bayi (0-11 bulan)',                      NULL, 0,  4,  28,   8,  0, 24, 0, 0, 0, 0,  0,  0, 0),
  ('2026-05', 6.0, '6',   'Anak (1-17 tahun)',                      NULL, 0,  6,  55,  10,  1, 50, 0, 0, 0, 0,  3,  2, 4),
  ('2026-05', 7.0, '7',   'Geriatri',                               NULL, 0, 18,  85,  35,  4, 64, 0, 0, 0, 0,  0,  0, 6)
ON DUPLICATE KEY UPDATE
  jenis_nama   = VALUES(jenis_nama),
  parent_kode  = VALUES(parent_kode);
