-- HPK 2: Formulir Permohonan Pendapat Kedua (Second Opinion).
-- Diisi via e-Nakes (periop_form schema-driven).
CREATE TABLE IF NOT EXISTS permohonan_second_opinion_rscb (
  no_rawat            VARCHAR(17) NOT NULL,
  tanggal             DATETIME NOT NULL,
  pemohon             ENUM('Pasien','Keluarga') NOT NULL DEFAULT 'Pasien',
  nama_pemohon        VARCHAR(100) DEFAULT NULL,
  hubungan            VARCHAR(50) DEFAULT NULL,
  alasan_permohonan   TEXT,
  dokter_diminta      VARCHAR(100) DEFAULT NULL,
  tanggapan           TEXT,
  status              ENUM('Diajukan','Dijawab','Dibatalkan') NOT NULL DEFAULT 'Diajukan',
  nip                 VARCHAR(20) DEFAULT NULL,
  PRIMARY KEY (no_rawat, tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
