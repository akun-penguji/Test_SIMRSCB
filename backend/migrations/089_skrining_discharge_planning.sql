-- PP 1 / AKP 5: Skrining Perencanaan Pulang (discharge planning) SEJAK asesmen
-- awal masuk — identifikasi kebutuhan khusus sedini mungkin (memicu MPP).
-- Diisi via e-Nakes (periop_form schema-driven). Beda dari perencanaan_pemulangan
-- (form lengkap saat pulang).
CREATE TABLE IF NOT EXISTS skrining_discharge_planning_rscb (
  no_rawat                      VARCHAR(17) NOT NULL,
  tanggal                       DATETIME NOT NULL,
  usia_lanjut                   ENUM('Tidak','Ya') NOT NULL DEFAULT 'Tidak',
  keterbatasan_mobilitas        ENUM('Tidak','Ya') NOT NULL DEFAULT 'Tidak',
  perawatan_berkelanjutan       ENUM('Tidak','Ya') NOT NULL DEFAULT 'Tidak',
  alat_bantu_medis_di_rumah     ENUM('Tidak','Ya') NOT NULL DEFAULT 'Tidak',
  keterbatasan_dukungan_keluarga ENUM('Tidak','Ya') NOT NULL DEFAULT 'Tidak',
  penyakit_kronis_terminal      ENUM('Tidak','Ya') NOT NULL DEFAULT 'Tidak',
  risiko_jatuh_tinggi           ENUM('Tidak','Ya') NOT NULL DEFAULT 'Tidak',
  perlu_discharge_planning      ENUM('Tidak','Ya') NOT NULL DEFAULT 'Tidak',
  rencana_awal_pemulangan       TEXT,
  nip                           VARCHAR(20) DEFAULT NULL,
  PRIMARY KEY (no_rawat, tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
