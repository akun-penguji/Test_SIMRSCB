-- Bukti penerimaan pasien (foto + TTD penerima) untuk form Penerimaan & Orientasi.
-- Tabel terpisah (key no_rawat) supaya tidak mengganggu INSERT posisional 35-kolom
-- form Java & tidak tertimpa saat edit. Path relatif ke folder webapps
-- 'penerimaanorientasiranap' ({foto|ttd}/{no_rawat}.jpg).
CREATE TABLE IF NOT EXISTS orientasi_pasien_ranap_bukti (
  no_rawat    VARCHAR(17) NOT NULL PRIMARY KEY,
  foto_path   VARCHAR(150) DEFAULT NULL,
  ttd_path    VARCHAR(150) DEFAULT NULL,
  updated_at  DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
