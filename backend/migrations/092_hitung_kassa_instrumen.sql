-- PAB 7: register penghitungan kassa & instrumen bedah (sebelum insisi & sebelum
-- menutup rongga tubuh) — sebagai buku register digital, bukan lembar lepas.
-- Diisi via e-Nakes (periop_form schema-driven).
CREATE TABLE IF NOT EXISTS hitung_kassa_instrumen_rscb (
  no_rawat                    VARCHAR(17) NOT NULL,
  tanggal                     DATETIME NOT NULL,
  kassa_sebelum_insisi        INT DEFAULT NULL,
  kassa_sebelum_tutup         INT DEFAULT NULL,
  instrumen_sebelum_insisi    INT DEFAULT NULL,
  instrumen_sebelum_tutup     INT DEFAULT NULL,
  jarum_sebelum_insisi        INT DEFAULT NULL,
  jarum_sebelum_tutup         INT DEFAULT NULL,
  jumlah_sesuai               ENUM('Ya','Tidak') NOT NULL DEFAULT 'Ya',
  tindakan_bila_tidak_sesuai  TEXT,
  perawat_instrumen           VARCHAR(100) DEFAULT NULL,
  perawat_sirkuler            VARCHAR(100) DEFAULT NULL,
  nip                         VARCHAR(20) DEFAULT NULL,
  PRIMARY KEY (no_rawat, tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
