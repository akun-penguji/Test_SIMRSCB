-- Gabung Penerimaan + Orientasi Pasien Baru Rawat Inap (AKP 2 & 2d).
-- Recreate tabel (masih kosong) dgn urutan kolom logis: header -> penerimaan
-- -> orientasi checklist. URUTAN KOLOM = urutan INSERT posisional form Java (35 kolom).
DROP TABLE IF EXISTS orientasi_pasien_ranap_rscb;
CREATE TABLE orientasi_pasien_ranap_rscb (
  no_rawat        VARCHAR(17) NOT NULL,
  tanggal         DATETIME NOT NULL,
  ruang           VARCHAR(60)  DEFAULT NULL,
  -- Penerimaan pasien baru
  cara_masuk      ENUM('IGD','Poliklinik','Rujukan','Datang Sendiri','Pindahan Ruangan') DEFAULT 'IGD',
  cara_datang     ENUM('Jalan','Kursi Roda','Brankar') DEFAULT 'Jalan',
  kondisi_masuk   VARCHAR(200) DEFAULT NULL,
  diagnosa_masuk  VARCHAR(200) DEFAULT NULL,
  dpjp            VARCHAR(100) DEFAULT NULL,
  pj_nama         VARCHAR(100) DEFAULT NULL,
  pj_hubungan     VARCHAR(50)  DEFAULT NULL,
  alergi          ENUM('Tidak','Ya') DEFAULT 'Tidak',
  alergi_ket      VARCHAR(150) DEFAULT NULL,
  general_consent ENUM('Belum','Sudah') DEFAULT 'Belum',
  barang_bawaan   VARCHAR(200) DEFAULT NULL,
  -- Orientasi: penerima edukasi
  penerima        ENUM('Pasien','Keluarga') DEFAULT 'Pasien',
  nama_penerima   VARCHAR(100) DEFAULT NULL,
  hubungan        VARCHAR(50)  DEFAULT NULL,
  -- Checklist orientasi
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
