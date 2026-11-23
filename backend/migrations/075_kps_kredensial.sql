-- KPS — Kredensial & Kewenangan Klinis (RKK/SPK) + Diklat Staf (STARKES KPS).
CREATE TABLE IF NOT EXISTS simrscb_kredensial (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  nip              VARCHAR(20) NULL,
  nama             VARCHAR(100) NOT NULL,
  profesi          VARCHAR(40) NULL,          -- Dokter/Dokter Spesialis/Perawat/Bidan/Nakes Lain
  jenis            VARCHAR(30) NOT NULL DEFAULT 'Kredensial Awal', -- Kredensial Awal/Rekredensial
  tanggal_kredensial DATE NULL,
  str_nomor        VARCHAR(50) NULL,
  str_berlaku      DATE NULL,
  sip_nomor        VARCHAR(50) NULL,
  sip_berlaku      DATE NULL,
  rekomendasi      VARCHAR(30) NULL,          -- Disetujui/Dengan Supervisi/Ditolak
  rkk              TEXT NULL,                 -- rincian kewenangan klinis
  spk_berlaku      DATE NULL,                 -- masa berlaku SPK
  status           VARCHAR(20) NOT NULL DEFAULT 'Aktif', -- Aktif/Kedaluwarsa/Dicabut
  catatan          TEXT NULL,
  petugas_nip      VARCHAR(20) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NULL,
  KEY idx_kred_nip (nip),
  KEY idx_kred_profesi (profesi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simrscb_diklat (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  nip              VARCHAR(20) NULL,
  nama             VARCHAR(100) NOT NULL,
  nama_pelatihan   VARCHAR(200) NOT NULL,
  penyelenggara    VARCHAR(120) NULL,
  jenis            VARCHAR(20) NOT NULL DEFAULT 'Internal', -- Internal/Eksternal
  tanggal_mulai    DATE NULL,
  tanggal_selesai  DATE NULL,
  jpl              INT NULL,                  -- jam pelajaran
  sertifikat_no    VARCHAR(60) NULL,
  berlaku_sampai   DATE NULL,
  catatan          TEXT NULL,
  petugas_nip      VARCHAR(20) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_diklat_nip (nip),
  KEY idx_diklat_tgl (tanggal_mulai)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
