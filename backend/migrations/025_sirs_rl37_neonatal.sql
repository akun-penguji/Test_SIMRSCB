-- RL 3.7 — Rekapitulasi Kegiatan Pelayanan Neonatal, Bayi, dan Balita (bulanan)
-- Per JUKNIS SIRS 6.3 Bab IV G.
-- Struktur sama dengan RL 3.6 (RM 6 / RNM 2 / NR 2 / Dirujuk).
-- Section A NEONATAL (1-7), section B BAYI DAN BALITA (8-9).
-- Total 40 baris: 29 leaf + 11 parent/section.

CREATE TABLE IF NOT EXISTS sirs_rl37_entry (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  bulan           CHAR(7) NOT NULL,
  urutan          DECIMAL(6,2) NOT NULL,
  jenis_kode      VARCHAR(10) NOT NULL,
  jenis_nama      VARCHAR(180) NOT NULL,
  parent_kode     VARCHAR(10) NULL,
  is_parent       TINYINT(1) NOT NULL DEFAULT 0,
  section         CHAR(1) NULL,
  rm_rs           INT,
  rm_bidan        INT,
  rm_puskes       INT,
  rm_faskes_lain  INT,
  rm_hidup        INT,
  rm_mati         INT,
  rnm_hidup       INT,
  rnm_mati        INT,
  nr_hidup        INT,
  nr_mati         INT,
  dirujuk         INT,
  updated_at      DATETIME,
  updated_by      VARCHAR(20),
  UNIQUE KEY uniq_bulan_jenis (bulan, jenis_kode),
  KEY idx_bulan (bulan)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Mei 2026 — dummy realistis (Khanza Z38=2 newborn registered, BBL 0-28d=21)
INSERT INTO sirs_rl37_entry (bulan,urutan,jenis_kode,jenis_nama,parent_kode,is_parent,section,
  rm_rs,rm_bidan,rm_puskes,rm_faskes_lain,rm_hidup,rm_mati,
  rnm_hidup,rnm_mati,nr_hidup,nr_mati,dirujuk) VALUES
-- ── A. NEONATAL ──
('2026-05',  1.00, '1',     'Bayi Lahir Hidup',                                    NULL,   1, 'A', NULL,NULL,NULL,NULL,NULL,NULL, NULL,NULL, NULL,NULL, NULL),
('2026-05',  1.10, '1.1',   'Lahir Prematur (< 37 minggu)',                        '1',    1, 'A', NULL,NULL,NULL,NULL,NULL,NULL, NULL,NULL, NULL,NULL, NULL),
('2026-05',  1.11, '1.1.1', '1500 - <2500 gram (BBLR)',                            '1.1',  0, 'A', 0,0,0,0,0,0, 0,0, 2,0,  0),
('2026-05',  1.12, '1.1.2', '1000 - <1500 gram (BBLSR)',                           '1.1',  0, 'A', 0,0,0,0,0,0, 0,0, 1,0,  1),
('2026-05',  1.13, '1.1.3', '<1000 gram (BBLER)',                                  '1.1',  0, 'A', 0,0,0,0,0,0, 0,0, 0,0,  0),
('2026-05',  1.20, '1.2',   'Lahir Non Prematur (≥ 37 - 41 minggu)',               '1',    1, 'A', NULL,NULL,NULL,NULL,NULL,NULL, NULL,NULL, NULL,NULL, NULL),
('2026-05',  1.21, '1.2.1', '1500 - <2500 gram (BBLR)',                            '1.2',  0, 'A', 0,0,0,0,0,0, 0,0, 3,0,  0),
('2026-05',  1.22, '1.2.2', '2500 - <4000 gram (BBLN)',                            '1.2',  0, 'A', 0,0,0,0,0,0, 0,0, 12,0, 0),
('2026-05',  1.23, '1.2.3', '≥4000 gram (BBLL)',                                   '1.2',  0, 'A', 0,0,0,0,0,0, 0,0, 1,0,  0),
('2026-05',  1.30, '1.3',   'Lahir Lebih dari 41 minggu',                          '1',    1, 'A', NULL,NULL,NULL,NULL,NULL,NULL, NULL,NULL, NULL,NULL, NULL),
('2026-05',  1.31, '1.3.1', '1500 - <2500 gram (BBLR)',                            '1.3',  0, 'A', 0,0,0,0,0,0, 0,0, 0,0,  0),
('2026-05',  1.32, '1.3.2', '2500 - <4000 gram (BBLN)',                            '1.3',  0, 'A', 0,0,0,0,0,0, 0,0, 1,0,  0),
('2026-05',  1.33, '1.3.3', '≥4000 gram (BBLL)',                                   '1.3',  0, 'A', 0,0,0,0,0,0, 0,0, 0,0,  0),
('2026-05',  2.00, '2',     'Lahir Mati',                                          NULL,   1, 'A', NULL,NULL,NULL,NULL,NULL,NULL, NULL,NULL, NULL,NULL, NULL),
('2026-05',  2.10, '2.1',   'Lahir Mati Antepartum',                               '2',    0, 'A', 0,0,0,0,0,0, 0,0, 0,0,  0),
('2026-05',  2.20, '2.2',   'Lahir Mati Intrapartum',                              '2',    0, 'A', 0,0,0,0,0,0, 0,0, 0,0,  0),
('2026-05',  3.00, '3',     'Kematian Neonatal dan Perinatal',                     NULL,   1, 'A', NULL,NULL,NULL,NULL,NULL,NULL, NULL,NULL, NULL,NULL, NULL),
('2026-05',  3.10, '3.1',   'Kematian Neonatal Dini (0 - 7 hari)',                 '3',    0, 'A', 0,0,0,0,0,0, 0,0, 0,0,  0),
('2026-05',  3.20, '3.2',   'Kematian Neonatal Lanjut Perinatal (8 - 28 hari)',    '3',    0, 'A', 0,0,0,0,0,0, 0,0, 0,0,  0),
('2026-05',  4.00, '4',     'Komplikasi Neonatal:',                                NULL,   1, 'A', NULL,NULL,NULL,NULL,NULL,NULL, NULL,NULL, NULL,NULL, NULL),
('2026-05',  4.10, '4.1',   'Asfiksia',                                            '4',    0, 'A', 0,0,0,0,0,0, 0,0, 1,0,  1),
('2026-05',  4.20, '4.2',   'Trauma Kelahiran',                                    '4',    0, 'A', 0,0,0,0,0,0, 0,0, 0,0,  0),
('2026-05',  4.30, '4.3',   'BBLR',                                                '4',    0, 'A', 0,0,0,0,0,0, 0,0, 5,0,  1),
('2026-05',  4.40, '4.4',   'Tetanus Neonatorum',                                  '4',    0, 'A', 0,0,0,0,0,0, 0,0, 0,0,  0),
('2026-05',  4.50, '4.5',   'Kelainan Bawaan',                                     '4',    0, 'A', 0,0,0,0,0,0, 0,0, 1,0,  0),
('2026-05',  4.60, '4.6',   'Covid-19',                                            '4',    0, 'A', 0,0,0,0,0,0, 0,0, 0,0,  0),
('2026-05',  4.70, '4.7',   'Infeksi / Sepsis',                                    '4',    0, 'A', 0,0,0,0,0,0, 0,0, 2,0,  0),
('2026-05',  4.80, '4.8',   'Komplikasi lainnya',                                  '4',    0, 'A', 0,0,0,0,0,0, 0,0, 1,0,  0),
('2026-05',  5.00, '5',     'Bayi BBLR yang dilakukan perawatan metode kanguru',   NULL,   0, 'A', 0,0,0,0,0,0, 0,0, 6,0,  0),
('2026-05',  6.00, '6',     'Bayi baru lahir yang dilakukan IMD',                  NULL,   0, 'A', 0,0,0,0,0,0, 0,0, 18,0, 0),
('2026-05',  7.00, '7',     'Bayi baru lahir yang dilakukan Skrining Hipertiroid Kongenital', NULL, 0, 'A', 0,0,0,0,0,0, 0,0, 18,0, 0),
-- ── B. BAYI DAN ANAK BALITA ──
('2026-05',  8.00, '8',     'Bayi dan Anak Balita',                                NULL,   1, 'B', NULL,NULL,NULL,NULL,NULL,NULL, NULL,NULL, NULL,NULL, NULL),
('2026-05',  8.10, '8.1',   'Bayi Baru Lahir (0 – 28 hari)',                       '8',    0, 'B', 0,0,0,0,0,0, 0,0, 21,0, 0),
('2026-05',  8.20, '8.2',   'Bayi (29 hari – 11 bulan)',                           '8',    0, 'B', 0,0,0,0,0,0, 0,0, 35,0, 0),
('2026-05',  8.30, '8.3',   'Anak Balita (12 - 59 bulan)',                         '8',    0, 'B', 0,0,0,0,0,0, 0,0,142,0, 0),
('2026-05',  9.00, '9',     'Balita Gizi Buruk',                                   NULL,   1, 'B', NULL,NULL,NULL,NULL,NULL,NULL, NULL,NULL, NULL,NULL, NULL),
('2026-05',  9.10, '9.1',   'Balita Gizi Buruk usia 0-5 bulan',                    '9',    0, 'B', 0,0,0,0,0,0, 0,0, 0,0,  0),
('2026-05',  9.20, '9.2',   'Balita Gizi Buruk usia 6-59 bulan',                   '9',    0, 'B', 0,0,0,0,0,0, 0,0, 0,0,  0);
