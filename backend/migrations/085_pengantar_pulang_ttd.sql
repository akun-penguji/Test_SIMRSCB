-- Tanda tangan pasien untuk Surat Pengantar Pulang (Cara B — TTD digital).
-- File TTD di webapps folder 'suratpengantarpulang' ({ttd|foto}/{no_rawat}.jpg),
-- path relatif dicatat di sini (key no_rawat). Ditampilkan di rptSuratPengantarPulang.
CREATE TABLE IF NOT EXISTS surat_pengantar_pulang_ttd (
  no_rawat    VARCHAR(17) NOT NULL PRIMARY KEY,
  ttd_path    VARCHAR(150) DEFAULT NULL,
  foto_path   VARCHAR(150) DEFAULT NULL,
  updated_at  DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
