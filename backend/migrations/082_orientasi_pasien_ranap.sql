-- Orientasi Pasien Baru Rawat Inap (AKP 2d) — dipakai bersama Khanza Java
-- (RMOrientasiPasienRanap) & simrscb e-Nakes (periop_form section "orientasi_ranap").
-- URUTAN KOLOM harus tetap = urutan INSERT posisional di form Java (24 kolom).
CREATE TABLE IF NOT EXISTS orientasi_pasien_ranap_rscb (
  no_rawat        VARCHAR(17) NOT NULL,
  tanggal         DATETIME NOT NULL,
  ruang           VARCHAR(60)  DEFAULT NULL,
  penerima        ENUM('Pasien','Keluarga') DEFAULT 'Pasien',
  nama_penerima   VARCHAR(100) DEFAULT NULL,
  hubungan        VARCHAR(50)  DEFAULT NULL,
  o_petugas       ENUM('Tidak','Ya') DEFAULT 'Tidak',
  o_jam_visite    ENUM('Tidak','Ya') DEFAULT 'Tidak',
  o_tempat_tidur  ENUM('Tidak','Ya') DEFAULT 'Tidak',
  o_bel           ENUM('Tidak','Ya') DEFAULT 'Tidak',
  o_kamar_mandi   ENUM('Tidak','Ya') DEFAULT 'Tidak',
  o_lemari        ENUM('Tidak','Ya') DEFAULT 'Tidak',
  o_listrik       ENUM('Tidak','Ya') DEFAULT 'Tidak',
  o_jam_besuk     ENUM('Tidak','Ya') DEFAULT 'Tidak',
  o_merokok       ENUM('Tidak','Ya') DEFAULT 'Tidak',
  o_barang        ENUM('Tidak','Ya') DEFAULT 'Tidak',
  o_gelang        ENUM('Tidak','Ya') DEFAULT 'Tidak',
  o_jatuh         ENUM('Tidak','Ya') DEFAULT 'Tidak',
  o_cuci_tangan   ENUM('Tidak','Ya') DEFAULT 'Tidak',
  o_evakuasi      ENUM('Tidak','Ya') DEFAULT 'Tidak',
  o_hak_kewajiban ENUM('Tidak','Ya') DEFAULT 'Tidak',
  o_komplain      ENUM('Tidak','Ya') DEFAULT 'Tidak',
  keterangan      TEXT,
  nip             VARCHAR(20)  DEFAULT NULL,
  PRIMARY KEY (no_rawat, tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
