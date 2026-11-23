-- AKP 4: bukti penyerahan resume/ringkasan pulang ke pihak yang melanjutkan
-- asuhan (dokter keluarga/FKTP, faskes perujuk, atau DPJP berikutnya).
-- Tabel companion (resume_pasien_ranap_rscb sudah ada isinya → tidak diubah).
-- foto_path/ttd_path diisi via /surat/upload (link_media_by_norawat); metadata
-- (diserahkan_ke, nama_penerima, nip) via POST /resume-serah-terima.
CREATE TABLE IF NOT EXISTS resume_serah_terima_rscb (
  no_rawat       VARCHAR(17) NOT NULL PRIMARY KEY,
  diserahkan_ke  ENUM('Pasien','Keluarga','Dokter Keluarga (FKTP)','Faskes Perujuk','DPJP Berikutnya') NOT NULL DEFAULT 'Pasien',
  nama_penerima  VARCHAR(100) DEFAULT NULL,
  tanggal        DATETIME DEFAULT NULL,
  foto_path      VARCHAR(255) DEFAULT NULL,
  ttd_path       VARCHAR(255) DEFAULT NULL,
  nip            VARCHAR(20)  DEFAULT NULL,
  updated_at     DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
