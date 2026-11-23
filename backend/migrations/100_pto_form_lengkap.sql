-- PTO — Pemantauan Terapi Obat, versi LENGKAP sesuai formulir fisik RM
-- ("PEMANTAUAN TERAPI OBAT": deskripsi pasien, keluhan utama, riwayat penyakit
-- sekarang/terdahulu/keluarga/sosial, riwayat penggunaan obat, hasil pemeriksaan
-- penunjang, penggunaan obat saat ini, dan SOAP).
--
-- Tabel pemantauan_terapi_obat_rscb (migrasi 091) masih kosong → di-ALTER
-- (kolom ditambahkan di belakang) alih-alih bikin tabel baru. Kolom lama
-- (nama_obat, problema_medik, rekomendasi, tindak_lanjut) tetap dipertahankan.
-- PK tetap (no_rawat, tanggal) = waktu pemantauan; 1 lembar form = 1 baris.

ALTER TABLE pemantauan_terapi_obat_rscb
  ADD COLUMN IF NOT EXISTS ruangan                   VARCHAR(80)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tgl_masuk                 DATE         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dpjp                      VARCHAR(120) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bb                        VARCHAR(15)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tb                        VARCHAR(15)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS alergi_obat               VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS apoteker                  VARCHAR(120) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS keluhan_utama             TEXT,
  ADD COLUMN IF NOT EXISTS riwayat_penyakit_sekarang TEXT,
  ADD COLUMN IF NOT EXISTS riwayat_penyakit_terdahulu TEXT,
  ADD COLUMN IF NOT EXISTS riwayat_keluarga          TEXT,
  ADD COLUMN IF NOT EXISTS riwayat_sosial            TEXT,
  ADD COLUMN IF NOT EXISTS soap_s                    TEXT,
  ADD COLUMN IF NOT EXISTS soap_o                    TEXT,
  ADD COLUMN IF NOT EXISTS soap_a                    TEXT,
  ADD COLUMN IF NOT EXISTS soap_p                    TEXT;

-- Tabel "Riwayat Penggunaan Obat" (obat sebelum/di luar RS).
CREATE TABLE IF NOT EXISTS pto_riwayat_obat_rscb (
  no_rawat      VARCHAR(17)  NOT NULL,
  tanggal       DATETIME     NOT NULL,
  urut          INT          NOT NULL,
  nama_obat     VARCHAR(200) DEFAULT NULL,
  rejimen_dosis VARCHAR(120) DEFAULT NULL,
  rute          VARCHAR(80)  DEFAULT NULL,
  waktu_mulai   VARCHAR(80)  DEFAULT NULL,
  PRIMARY KEY (no_rawat, tanggal, urut)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Tabel "Hasil Pemeriksaan Penunjang" (lab/penunjang yang dipantau apoteker).
CREATE TABLE IF NOT EXISTS pto_penunjang_rscb (
  no_rawat         VARCHAR(17)  NOT NULL,
  tanggal          DATETIME     NOT NULL,
  urut             INT          NOT NULL,
  tgl_pemeriksaan  DATE         DEFAULT NULL,
  nama_pemeriksaan VARCHAR(150) DEFAULT NULL,
  hasil            VARCHAR(100) DEFAULT NULL,
  satuan           VARCHAR(50)  DEFAULT NULL,
  nilai_rujukan    VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (no_rawat, tanggal, urut)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Tabel "Penggunaan Obat Saat Ini" (terapi yang sedang berjalan).
CREATE TABLE IF NOT EXISTS pto_obat_saat_ini_rscb (
  no_rawat         VARCHAR(17)  NOT NULL,
  tanggal          DATETIME     NOT NULL,
  urut             INT          NOT NULL,
  tgl_mulai_terapi DATE         DEFAULT NULL,
  nama_obat        VARCHAR(200) DEFAULT NULL,
  rejimen          VARCHAR(120) DEFAULT NULL,
  indikasi         VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (no_rawat, tanggal, urut)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
