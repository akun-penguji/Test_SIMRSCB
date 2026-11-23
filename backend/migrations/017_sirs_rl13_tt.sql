-- ─────────────────────────────────────────────────────────────
-- SIRS RL 1.3 — Ketersediaan dan Keterpakaian Tempat Tidur
-- Update minimal 2x sehari. Format: 1 row = 1 (kelas TT, ruangan).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sirs_rl13_tt (
  id            INT          AUTO_INCREMENT PRIMARY KEY,
  kelas_tt      VARCHAR(60)  NOT NULL,
  ruangan       VARCHAR(100) NOT NULL,
  jml_tersedia  INT          NOT NULL DEFAULT 0,
  jml_terpakai  INT          NOT NULL DEFAULT 0,
  catatan       VARCHAR(200) NULL,
  updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by    VARCHAR(20)  NULL,
  CONSTRAINT chk_terpakai CHECK (jml_terpakai <= jml_tersedia),
  CONSTRAINT chk_nonneg   CHECK (jml_tersedia >= 0 AND jml_terpakai >= 0),
  UNIQUE KEY uniq_kelas_ruangan (kelas_tt, ruangan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='SIRS RL 1.3 — Ketersediaan dan Keterpakaian Tempat Tidur';

-- Dummy seed: RSUD Cabang Bungin kelas D
-- Total ~32 TT (sample, bisa di-update via UI)
INSERT INTO sirs_rl13_tt (kelas_tt, ruangan, jml_tersedia, jml_terpakai, catatan) VALUES
  ('Kelas I',                            'Ruang Anggrek',     4,  2, NULL),
  ('Kelas II',                           'Ruang Mawar',       6,  4, NULL),
  ('Kelas III',                          'Ruang Melati',     12,  8, NULL),
  ('VIP',                                'Ruang Cendana',     2,  1, NULL),
  ('Isolasi',                            'Ruang Isolasi',     2,  0, 'Kosong'),
  ('Perinatologi',                       'Ruang Bayi',        4,  2, NULL),
  ('VK (bu Melahirkan) Non Covid',       'VK',                2,  1, NULL)
ON DUPLICATE KEY UPDATE
  jml_tersedia = VALUES(jml_tersedia),
  jml_terpakai = VALUES(jml_terpakai);
