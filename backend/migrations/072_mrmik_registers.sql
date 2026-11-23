-- MRMIK — register/instrumen digital untuk bab Manajemen Rekam Medik & Informasi Kesehatan.
-- #1 Pelepasan Informasi Medis (MRMIK 10 EP2)
-- #2 Reviu RM Kualitatif terbuka/tertutup (MRMIK 12 EP3, 7, 5 EP4)
-- #3 Koreksi Penulisan RME (MRMIK 8 EP3)
-- #4 Daftar & Evaluasi Formulir RM (MRMIK 6 EP3, 7 EP2)
-- (#5 Audit Akses membaca tabel `tracker` + simrscb_user_permissions — tanpa tabel baru.)

CREATE TABLE IF NOT EXISTS simrscb_pelepasan_informasi (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  tanggal        DATE NOT NULL,
  no_rkm_medis   VARCHAR(15) NULL,
  nama_pasien    VARCHAR(100) NULL,
  no_rawat       VARCHAR(17) NULL,
  pemohon        VARCHAR(100) NULL,
  hubungan       VARCHAR(50) NULL,           -- Pasien Sendiri / Keluarga / Instansi
  instansi       VARCHAR(120) NULL,
  tujuan         VARCHAR(30) NULL,           -- Asuransi / Hukum / BPJS / Visum / Klaim / Pasien / Lainnya
  jenis_dokumen  VARCHAR(150) NULL,          -- Resume / RM Lengkap / Hasil Penunjang / dll
  cara_pemberian VARCHAR(30) NULL,           -- Fotokopi / Elektronik / Lihat di Tempat
  disetujui_oleh VARCHAR(100) NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'Diajukan', -- Diajukan/Disetujui/Ditolak/Selesai
  tgl_selesai    DATE NULL,
  petugas_nip    VARCHAR(20) NULL,
  catatan        TEXT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NULL,
  KEY idx_pel_tanggal (tanggal),
  KEY idx_pel_norm (no_rkm_medis)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simrscb_reviu_rm (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tanggal         DATE NOT NULL,
  no_rawat        VARCHAR(17) NULL,
  no_rkm_medis    VARCHAR(15) NULL,
  nama_pasien     VARCHAR(100) NULL,
  jenis_reviu     VARCHAR(10) NOT NULL DEFAULT 'Tertutup', -- Terbuka / Tertutup
  ketepatan_waktu TINYINT NOT NULL DEFAULT 0,  -- 1=sesuai
  keterbacaan     TINYINT NOT NULL DEFAULT 0,
  kelengkapan     TINYINT NOT NULL DEFAULT 0,
  kesesuaian_isi  TINYINT NOT NULL DEFAULT 0,
  skor            DOUBLE NULL,                 -- (jml sesuai / 4) x 100
  catatan         TEXT NULL,
  reviewer        VARCHAR(100) NULL,
  petugas_nip     VARCHAR(20) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_reviu_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simrscb_koreksi_rme (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  tanggal        DATE NOT NULL,
  no_rawat       VARCHAR(17) NULL,
  no_rkm_medis   VARCHAR(15) NULL,
  nama_pasien    VARCHAR(100) NULL,
  jenis_rm       VARCHAR(20) NOT NULL DEFAULT 'Elektronik', -- Elektronik / Non-Elektronik
  formulir       VARCHAR(150) NULL,           -- formulir / bagian yang dikoreksi
  isi_lama       TEXT NULL,
  isi_baru       TEXT NULL,
  alasan         TEXT NULL,
  dikoreksi_oleh VARCHAR(100) NULL,           -- PPA pelaku koreksi
  petugas_nip    VARCHAR(20) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_koreksi_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simrscb_formulir_rm (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  kode_form      VARCHAR(30) NULL,
  nama_form      VARCHAR(160) NOT NULL,
  unit           VARCHAR(80) NULL,
  versi          VARCHAR(20) NULL,
  tgl_terbit     DATE NULL,
  tgl_reviu      DATE NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'Aktif',  -- Aktif / Revisi / Tidak Berlaku
  hasil_evaluasi TEXT NULL,
  direview_oleh  VARCHAR(100) NULL,
  catatan        TEXT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NULL,
  KEY idx_form_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
