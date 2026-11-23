-- Farmasi Klinis (telusur RM tertutup): Rekonsiliasi Obat, Pemantauan Terapi
-- Obat (PTO), dan Monitoring Efek Samping Obat (MESO / Formulir Kuning).
-- Diisi apoteker via e-Nakes (periop_form schema-driven).

-- Rekonsiliasi obat: obat yang dibawa dari rumah (3 bulan terakhir), dikaji
-- apoteker & dikonfirmasi ke DPJP.
CREATE TABLE IF NOT EXISTS rekonsiliasi_obat_rscb (
  no_rawat            VARCHAR(17) NOT NULL,
  tanggal             DATETIME NOT NULL,
  daftar_obat_dibawa  TEXT,
  hasil_kajian        TEXT,
  dilanjutkan         ENUM('Dilanjutkan','Dihentikan','Diganti','Sebagian') NOT NULL DEFAULT 'Dilanjutkan',
  dikonfirmasi_dpjp   ENUM('Tidak','Ya') NOT NULL DEFAULT 'Tidak',
  nip                 VARCHAR(20) DEFAULT NULL,
  PRIMARY KEY (no_rawat, tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Pemantauan Terapi Obat (PTO) — log per kunjungan/visite.
CREATE TABLE IF NOT EXISTS pemantauan_terapi_obat_rscb (
  no_rawat            VARCHAR(17) NOT NULL,
  tanggal             DATETIME NOT NULL,
  nama_obat           VARCHAR(200) DEFAULT NULL,
  problema_medik      VARCHAR(300) DEFAULT NULL,
  rekomendasi         TEXT,
  tindak_lanjut       TEXT,
  nip                 VARCHAR(20) DEFAULT NULL,
  PRIMARY KEY (no_rawat, tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- MESO / Formulir Kuning — monitoring efek samping obat.
CREATE TABLE IF NOT EXISTS meso_rscb (
  no_rawat            VARCHAR(17) NOT NULL,
  tanggal             DATETIME NOT NULL,
  obat_diduga         VARCHAR(200) DEFAULT NULL,
  manifestasi_eso     TEXT,
  saat_mula_reaksi    VARCHAR(100) DEFAULT NULL,
  kesudahan_reaksi    ENUM('Sembuh','Membaik','Belum Sembuh','Meninggal','Tidak Tahu') NOT NULL DEFAULT 'Belum Sembuh',
  tindakan            TEXT,
  keterangan          TEXT,
  nip                 VARCHAR(20) DEFAULT NULL,
  PRIMARY KEY (no_rawat, tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
