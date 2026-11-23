-- RL 3.5 — Rekapitulasi Kunjungan (bulanan)
-- Per JUKNIS SIRS 6.3 Bab IV E:
-- 34 jenis kegiatan + TOTAL(99) + 2 statistik (66 rata hari poli buka, 77 rata kunjungan/hari)
-- Sumber: Instalasi Rawat Jalan, IGD, Medical Check Up, Day Care
-- Breakdown: Dalam Kab/Kota (L,P) + Luar Kab/Kota (L,P) + Total Kunjungan
-- 1 pasien datang ke beberapa unit pada hari yang sama = dihitung 1 kunjungan
-- Manual entry (mapping kd_poli → jenis JUKNIS subjektif), Khanza sanity check

CREATE TABLE IF NOT EXISTS sirs_rl35_entry (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  bulan       CHAR(7) NOT NULL,
  urutan      INT NOT NULL,
  jenis_kode  VARCHAR(10) NOT NULL,
  jenis_nama  VARCHAR(120) NOT NULL,
  dalam_l     INT,
  dalam_p     INT,
  luar_l      INT,
  luar_p      INT,
  is_stat     TINYINT(1) NOT NULL DEFAULT 0,
  stat_value  DECIMAL(8,2),
  updated_at  DATETIME,
  updated_by  VARCHAR(20),
  UNIQUE KEY uniq_bulan_jenis (bulan, jenis_kode),
  KEY idx_bulan (bulan)
);

-- Seed Mei 2026 — dummy realistis berdasarkan distribusi kd_poli Khanza
-- (Total kunjungan Mei 2026 ~2.191; dialokasikan ke jenis JUKNIS yang relevan)
INSERT INTO sirs_rl35_entry (bulan,urutan,jenis_kode,jenis_nama,dalam_l,dalam_p,luar_l,luar_p,is_stat,stat_value) VALUES
('2026-05', 1, '1',  'Penyakit Dalam',                       95, 145, 35, 50, 0, NULL),
('2026-05', 2, '2',  'Bedah',                                25, 18,  10,  8, 0, NULL),
('2026-05', 3, '3',  'Kesehatan Anak (Neonatal)',             5,  4,   2,  1, 0, NULL),
('2026-05', 4, '4',  'Kesehatan Anak (Lainnya)',             45, 38,  15, 10, 0, NULL),
('2026-05', 5, '5',  'Obstetri & Ginekologi (Ibu Hamil)',     0, 55,   0, 20, 0, NULL),
('2026-05', 6, '6',  'Obstetri & Ginekologi (Lainnya)',       0, 45,   0, 16, 0, NULL),
('2026-05', 7, '7',  'Keluarga Berencana',                    0, 12,   0,  4, 0, NULL),
('2026-05', 8, '8',  'Jiwa',                                  0,  0,   0,  0, 0, NULL),
('2026-05', 9, '9',  'Napza',                                 0,  0,   0,  0, 0, NULL),
('2026-05',10, '10', 'Psikologi',                             0,  0,   0,  0, 0, NULL),
('2026-05',11, '11', 'THT',                                  15, 18,   6,  5, 0, NULL),
('2026-05',12, '12', 'Mata',                                 35, 40,  10,  4, 0, NULL),
('2026-05',13, '13', 'Kulit dan Kelamin',                     0,  0,   0,  0, 0, NULL),
('2026-05',14, '14', 'Gigi & Mulut',                          5,  6,   1,  1, 0, NULL),
('2026-05',15, '15', 'Geriatri',                              0,  0,   0,  0, 0, NULL),
('2026-05',16, '16', 'Kardiologi',                            0,  0,   0,  0, 0, NULL),
('2026-05',17, '17', 'Radiologi',                            18, 16,   5,  3, 0, NULL),
('2026-05',18, '18', 'Bedah Orthopedi',                       0,  0,   0,  0, 0, NULL),
('2026-05',19, '19', 'Paru - Paru',                           3,  2,   1,  1, 0, NULL),
('2026-05',20, '20', 'Kanker',                                0,  0,   0,  0, 0, NULL),
('2026-05',21, '21', 'Uronefrologi',                          0,  0,   0,  0, 0, NULL),
('2026-05',22, '22', 'Kusta',                                 0,  0,   0,  0, 0, NULL),
('2026-05',23, '23', 'Umum',                                 30, 38,  12, 11, 0, NULL),
('2026-05',24, '24', 'Rawat Darurat',                       340, 415, 80, 72, 0, NULL),
('2026-05',25, '25', 'Rehabilitasi Medik',                    0,  0,   0,  0, 0, NULL),
('2026-05',26, '26', 'Akupungtur Medik',                      0,  0,   0,  0, 0, NULL),
('2026-05',27, '27', 'Konsultasi Gizi',                       0,  0,   0,  0, 0, NULL),
('2026-05',28, '28', 'Day Care',                              0,  0,   0,  0, 0, NULL),
('2026-05',29, '29', 'Medical Check Up',                      8,  6,   2,  2, 0, NULL),
('2026-05',30, '30', 'Bedah Saraf (Stroke)',                  0,  0,   0,  0, 0, NULL),
('2026-05',31, '31', 'Bedah Saraf (Lainnya)',                 0,  0,   0,  0, 0, NULL),
('2026-05',32, '32', 'Saraf (Stroke)',                       12, 15,   4,  3, 0, NULL),
('2026-05',33, '33', 'Saraf (Lainnya)',                      30, 35,  10,  8, 0, NULL),
('2026-05',34, '34', 'Lain - Lain',                          10, 12,   3,  4, 0, NULL),
('2026-05',66, '66', 'Rata-Rata Hari Poliklinik Buka',     NULL,NULL,NULL,NULL, 1, 25.0),
('2026-05',77, '77', 'Rata-Rata Kunjungan per Hari',       NULL,NULL,NULL,NULL, 1, 73.0);
