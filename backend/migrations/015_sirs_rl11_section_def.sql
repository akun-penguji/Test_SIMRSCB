-- ─────────────────────────────────────────────────────────────
-- SIRS RL 1.1 — Section D (Foto), E (Kerja Sama LN), F (Profil SIMRS)
-- Pelengkap migration 014 (yang cover A/B/C saja).
-- ─────────────────────────────────────────────────────────────

-- Section D — 5 foto (path file) + Section F — profil SIMRS dasar
ALTER TABLE sirs_rl11_profil
  ADD COLUMN IF NOT EXISTS foto_tampak_depan       VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS foto_ruang_ralan        VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS foto_ruang_ranap        VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS foto_ruang_igd          VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS foto_alkes              VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS simrs_jenis_vendor      VARCHAR(60)  NULL,
  ADD COLUMN IF NOT EXISTS simrs_nama_developer    VARCHAR(200) NULL,
  ADD COLUMN IF NOT EXISTS simrs_akses_internet    VARCHAR(40)  NULL,
  ADD COLUMN IF NOT EXISTS simrs_pic_nama          VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS simrs_pic_nik           VARCHAR(20)  NULL,
  ADD COLUMN IF NOT EXISTS simrs_pic_email         VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS simrs_pic_telp          VARCHAR(40)  NULL,
  ADD COLUMN IF NOT EXISTS simrs_pic_jabatan       VARCHAR(100) NULL;

-- ─────────────────────────────────────────────────────────────
-- Section E — Kerja Sama Luar Negeri (repeatable)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sirs_rl11_kerjasama_ln (
  id              BIGINT       AUTO_INCREMENT PRIMARY KEY,
  nama_institusi  VARCHAR(200) NOT NULL,
  negara          VARCHAR(100) NOT NULL,
  area            VARCHAR(255) NULL,
  output_kerja    TEXT         NULL,
  bentuk          VARCHAR(255) NULL,    -- CSV: Fellowship,Workshop,Training,Co-Branding,KSO,...
  keterangan      TEXT         NULL,
  tgl_mulai       DATE         NULL,
  tgl_akhir       DATE         NULL,
  created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_negara (negara)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='SIRS RL 1.1 section E — Kerja Sama dengan RS Luar Negeri';

-- ─────────────────────────────────────────────────────────────
-- Section F — Profil SIMRS modul checklist
-- 50+ item dari JUKNIS (Tata Kelola, Arsitektur, Konektivitas, Interop)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sirs_rl11_simrs_modul (
  id            INT          NOT NULL PRIMARY KEY,    -- nomor sesuai JUKNIS
  kategori      VARCHAR(50)  NOT NULL,
  sub_kategori  VARCHAR(80)  NULL,
  modul         VARCHAR(255) NOT NULL,
  ada           TINYINT(1)   NOT NULL DEFAULT 0,
  updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_kategori (kategori)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='SIRS RL 1.1 section F — checklist modul SIMRS yang dimiliki RS';

-- Seed master 52 modul (sesuai JUKNIS hal. 5-7).
-- Item 51-54 (Subsystem RS-rumah-sakit lain) bisa ditambah via UI nanti.
INSERT INTO sirs_rl11_simrs_modul (id, kategori, sub_kategori, modul) VALUES
  (1,  'Tata Kelola', 'Unit Pengelola',         'Rumah Sakit memiliki unit/instalasi informasi dan teknologi'),
  (2,  'Tata Kelola', 'SDM',                    'Kepala Instalasi'),
  (3,  'Tata Kelola', 'SDM',                    'Sistem Analis'),
  (4,  'Tata Kelola', 'SDM',                    'Programmer'),
  (5,  'Tata Kelola', 'SDM',                    'Database Administrator'),
  (6,  'Tata Kelola', 'SDM',                    'Implementator (Hardware, Helpdesk dan Maintenance Jaringan)'),
  (7,  'Arsitektur', 'Front Office',            'Pendaftaran online'),
  (8,  'Arsitektur', 'Front Office',            'Pendaftaran offline'),
  (9,  'Arsitektur', 'Front Office',            'Pembayaran'),
  (10, 'Arsitektur', 'Front Office',            'Pelayanan Rawat Jalan'),
  (11, 'Arsitektur', 'Front Office',            'Pelayanan Farmasi/Apotik'),
  (12, 'Arsitektur', 'Front Office',            'Pelayanan Laboratorium'),
  (13, 'Arsitektur', 'Front Office',            'Pelayanan Radiologi'),
  (14, 'Arsitektur', 'Front Office',            'Pelayanan IGD'),
  (15, 'Arsitektur', 'Front Office',            'Pelayanan Gizi'),
  (16, 'Arsitektur', 'Front Office',            'Pelayanan Keperawatan'),
  (17, 'Arsitektur', 'Front Office',            'Admission Rawat Inap'),
  (18, 'Arsitektur', 'Front Office',            'Pelayanan Rawat Inap'),
  (19, 'Arsitektur', 'Front Office',            'Resume Medis Elektronik'),
  (20, 'Arsitektur', 'RME',                     'Rekam Medik Elektronik'),
  (21, 'Arsitektur', 'RME',                     'RME - Pendaftaran'),
  (22, 'Arsitektur', 'RME',                     'RME - Rawat Jalan'),
  (23, 'Arsitektur', 'RME',                     'RME - Rawat Inap'),
  (24, 'Arsitektur', 'RME',                     'RME - IGD'),
  (25, 'Arsitektur', 'RME',                     'RME - Laboratorium'),
  (26, 'Arsitektur', 'RME',                     'RME - Apotek / Farmasi'),
  (27, 'Arsitektur', 'Back Office',             'Keuangan/Akuntansi'),
  (28, 'Arsitektur', 'Back Office',             'Gudang dan Logistik'),
  (29, 'Arsitektur', 'Back Office',             'Dashboard Eksekutif'),
  (30, 'Arsitektur', 'Back Office',             'Kepegawaian (data SDM, Kinerja Pegawai, Remunerasi/Payroll)'),
  (31, 'Konektivitas', 'SATUSEHAT',             'SIMRS/RME sudah terdaftar di SatuSehat'),
  (32, 'Konektivitas', 'SATUSEHAT',             'SIMRS/RME sudah memiliki ID SatuSehat'),
  (33, 'Konektivitas', 'SATUSEHAT Development', 'SatuSehat sudah pada Tahap Development'),
  (34, 'Konektivitas', 'SATUSEHAT Development', 'Usecase 1. Encounter & Condition'),
  (35, 'Konektivitas', 'SATUSEHAT Development', 'Usecase 2. Prosedur, TTV, Edukasi Gizi'),
  (36, 'Konektivitas', 'SATUSEHAT Development', 'Usecase 3. Obat'),
  (37, 'Konektivitas', 'SATUSEHAT Development', 'Usecase 4. Laboratorium'),
  (38, 'Konektivitas', 'SATUSEHAT Production',  'SatuSehat sudah pada Tahap Production'),
  (39, 'Konektivitas', 'SATUSEHAT Production',  'Usecase 1. Encounter & Condition'),
  (40, 'Konektivitas', 'SATUSEHAT Production',  'Usecase 2. Prosedur, TTV, Edukasi Gizi'),
  (41, 'Konektivitas', 'SATUSEHAT Production',  'Usecase 3. Obat'),
  (42, 'Konektivitas', 'SATUSEHAT Production',  'Usecase 4. Laboratorium'),
  (43, 'Interoperabilitas', 'Sistem Informasi', 'Sistem Informasi Manajemen dan Akuntansi Barang Milik Negara (SIMAK BMN)'),
  (44, 'Interoperabilitas', 'Sistem Informasi', 'Pelaporan Sistem Informasi Rumah Sakit (SIRS) dan Dashboard Informasi Pelayanan Kesehatan'),
  (45, 'Interoperabilitas', 'Sistem Informasi', 'E-claim (INA CBG)'),
  (46, 'Interoperabilitas', 'Sistem Informasi', 'V-claim BPJS'),
  (47, 'Interoperabilitas', 'Sistem Informasi', 'Sistem Rujukan Terintegrasi (SISRUTE)'),
  (48, 'Interoperabilitas', 'Sistem Informasi', 'Sistem Rawat Inap (SIRANAP)'),
  (49, 'Interoperabilitas', 'Sistem Informasi', 'Aplikasi Sarana, Prasarana dan Peralatan Kesehatan (ASPAK)'),
  (50, 'Interoperabilitas', 'Sistem Informasi', 'Sistem Informasi Tuberculosis Terpadu (SITT)'),
  (55, 'Interoperabilitas', 'Sistem Informasi', 'E-Kohort KIA'),
  (56, 'Interoperabilitas', 'Sistem Informasi', 'Komdat Kesmas')
ON DUPLICATE KEY UPDATE
  kategori = VALUES(kategori),
  sub_kategori = VALUES(sub_kategori),
  modul = VALUES(modul);
