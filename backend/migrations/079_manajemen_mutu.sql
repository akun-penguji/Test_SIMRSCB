-- Manajemen & Mutu — register belum ada di Khanza:
-- Survei Kepuasan Pasien (PMKP/HPK/INM13), Orientasi Pegawai (KPS), Kontrak & Evaluasi Vendor (TKRS/MFK).

CREATE TABLE IF NOT EXISTS simrscb_kepuasan (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  tanggal        DATE NOT NULL,
  unit           VARCHAR(80) NULL,
  periode        VARCHAR(20) NULL,           -- mis. 2026-Q1 / Jan 2026
  metode         VARCHAR(30) NULL,           -- Kuesioner/IKM/Digital/Kotak Saran
  jml_responden  INT NOT NULL DEFAULT 0,
  nilai_ikm      DOUBLE NULL,               -- indeks kepuasan (%)
  mutu           VARCHAR(4) NULL,           -- A/B/C/D
  keluhan_utama  TEXT NULL,
  tindak_lanjut  TEXT NULL,
  petugas_nip    VARCHAR(20) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NULL,
  KEY idx_kep_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simrscb_orientasi (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nip             VARCHAR(20) NULL,
  nama            VARCHAR(100) NOT NULL,
  jenis           VARCHAR(20) NOT NULL DEFAULT 'Umum', -- Umum/Khusus Unit
  unit            VARCHAR(80) NULL,
  tanggal_mulai   DATE NULL,
  tanggal_selesai DATE NULL,
  materi          TEXT NULL,
  hasil           VARCHAR(20) NULL,          -- Lulus/Mengulang
  nilai           VARCHAR(10) NULL,
  pembimbing      VARCHAR(100) NULL,
  catatan         TEXT NULL,
  petugas_nip     VARCHAR(20) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ori_nip (nip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simrscb_kontrak (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  no_kontrak      VARCHAR(60) NULL,
  nama_vendor     VARCHAR(120) NOT NULL,
  jenis_layanan   VARCHAR(120) NULL,         -- Cleaning/Katering/Laundry/Alkes/Pemeliharaan/dll
  jenis_kontrak   VARCHAR(30) NULL,          -- Klinis/Manajemen
  tanggal_mulai   DATE NULL,
  tanggal_berakhir DATE NULL,
  nilai_kontrak   DOUBLE NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'Aktif', -- Aktif/Berakhir/Perpanjangan/Diputus
  evaluasi        TEXT NULL,
  skor_evaluasi   DOUBLE NULL,               -- % hasil evaluasi kinerja vendor
  rekomendasi     VARCHAR(30) NULL,          -- Lanjut/Perbaikan/Putus
  pic             VARCHAR(100) NULL,
  catatan         TEXT NULL,
  petugas_nip     VARCHAR(20) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NULL,
  KEY idx_kontrak_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
