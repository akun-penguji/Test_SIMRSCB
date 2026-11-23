-- PPI — Surveilans HAIs & Audit Kepatuhan (Pencegahan & Pengendalian Infeksi, STARKES).
-- HAIs: ILO/IDO (luka operasi), ISK (kateter urin), IADP/PLABSI (CVC), VAP (ventilator),
--       Phlebitis (infus perifer). Rate = kasus / hari-alat x 1000.

CREATE TABLE IF NOT EXISTS simrscb_ppi_surveilans (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tanggal       DATE NOT NULL,                -- tgl ditemukan infeksi
  no_rawat      VARCHAR(17) NULL,
  no_rkm_medis  VARCHAR(15) NULL,
  nama_pasien   VARCHAR(100) NULL,
  unit          VARCHAR(80) NULL,
  jenis_hais    VARCHAR(20) NOT NULL DEFAULT 'Phlebitis', -- ILO/ISK/IADP/PLABSI/VAP/Phlebitis/Lainnya
  tanggal_pasang DATE NULL,
  tanggal_infeksi DATE NULL,
  lama_pakai    INT NULL,                     -- hari pemakaian alat
  mikroorganisme VARCHAR(120) NULL,
  gejala        TEXT NULL,
  tindakan      TEXT NULL,
  petugas_nip   VARCHAR(20) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ppi_tanggal (tanggal),
  KEY idx_ppi_jenis (jenis_hais)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simrscb_ppi_audit (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tanggal       DATE NOT NULL,
  unit          VARCHAR(80) NULL,
  jenis_audit   VARCHAR(40) NOT NULL DEFAULT 'Kebersihan Tangan', -- Kebersihan Tangan/APD/Penyuntikan Aman/Dekontaminasi/dll
  profesi       VARCHAR(40) NULL,             -- Dokter/Perawat/Bidan/Nakes lain
  jml_kesempatan INT NOT NULL DEFAULT 0,       -- opportunities
  jml_patuh     INT NOT NULL DEFAULT 0,
  kepatuhan     DOUBLE NULL,                  -- patuh/kesempatan x 100
  auditor       VARCHAR(100) NULL,
  catatan       TEXT NULL,
  petugas_nip   VARCHAR(20) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ppiaudit_tanggal (tanggal),
  KEY idx_ppiaudit_jenis (jenis_audit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Denominator hari-alat & hari-rawat per bulan-unit-jenis (untuk hitung rate HAIs).
CREATE TABLE IF NOT EXISTS simrscb_ppi_denominator (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tahun         INT NOT NULL,
  bulan         INT NOT NULL,
  unit          VARCHAR(80) NOT NULL DEFAULT '',
  jenis_alat    VARCHAR(30) NOT NULL,         -- Kateter Urin/Ventilator/CVC/Infus Perifer
  hari_alat     INT NOT NULL DEFAULT 0,       -- device-days
  hari_rawat    INT NOT NULL DEFAULT 0,       -- patient-days
  petugas_nip   VARCHAR(20) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_denom (tahun,bulan,unit,jenis_alat)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
