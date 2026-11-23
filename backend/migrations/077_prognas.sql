-- Prognas — Program Nasional (STARKES): register kasus PONEK/TB/HIV/Stunting/Geriatri/KB.
CREATE TABLE IF NOT EXISTS simrscb_prognas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tanggal       DATE NOT NULL,
  program       VARCHAR(20) NOT NULL DEFAULT 'TB',   -- PONEK/TB/HIV/Stunting/Geriatri/KB/Lainnya
  no_rawat      VARCHAR(17) NULL,
  no_rkm_medis  VARCHAR(15) NULL,
  nama_pasien   VARCHAR(100) NULL,
  umur          VARCHAR(20) NULL,
  jenis_kelamin VARCHAR(2) NULL,
  unit          VARCHAR(80) NULL,
  diagnosa      VARCHAR(200) NULL,
  status_kasus  VARCHAR(60) NULL,   -- mis. TB: Terkonfirmasi/Klinis; HIV: Reaktif/ARV; Stunting: Stunting/Wasting
  tindakan      TEXT NULL,
  hasil         TEXT NULL,
  keterangan    TEXT NULL,
  petugas_nip   VARCHAR(20) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NULL,
  KEY idx_prognas_tanggal (tanggal),
  KEY idx_prognas_program (program)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
