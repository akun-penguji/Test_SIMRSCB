-- Self Security Assessment (penilaian mandiri keamanan SI) untuk kredensialing
-- BPJS (kriteria Sistem poin d). Header per periode + item kontrol.
-- Daftar kontrol di-snapshot ke item saat dibuat (denormalisasi), supaya form
-- cukup membaca item dan riwayat tetap utuh walau daftar kontrol diperbarui.

CREATE TABLE IF NOT EXISTS simrscb_ssa (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tahun           INT NOT NULL,
  periode         VARCHAR(30) DEFAULT NULL,         -- mis. "Triwulan I", "Semester 1"
  tanggal         DATE NOT NULL,
  metode          ENUM('Internal','Pihak Ketiga','Gabungan') NOT NULL DEFAULT 'Internal',
  pihak_ketiga    VARCHAR(150) DEFAULT NULL,
  penanggung_jawab VARCHAR(120) DEFAULT NULL,
  kesimpulan      TEXT,
  tingkat         ENUM('Baik','Cukup','Perlu Perbaikan','') NOT NULL DEFAULT '',
  skor_total      DECIMAL(5,2) DEFAULT NULL,
  dibuat_oleh     VARCHAR(20) DEFAULT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tahun (tahun)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS simrscb_ssa_item (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ssa_id      INT UNSIGNED NOT NULL,
  urut        INT NOT NULL DEFAULT 0,
  area        VARCHAR(80) NOT NULL,
  kode        VARCHAR(10) NOT NULL,
  kontrol     VARCHAR(400) NOT NULL,
  status      ENUM('ada','sebagian','belum','na') NOT NULL DEFAULT 'belum',
  bukti       VARCHAR(400) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_ssa (ssa_id),
  CONSTRAINT fk_ssa_item FOREIGN KEY (ssa_id) REFERENCES simrscb_ssa(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
