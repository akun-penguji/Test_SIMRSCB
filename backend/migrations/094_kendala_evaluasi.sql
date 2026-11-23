-- Evaluasi & tindak lanjut kendala pendaftaran (per tahun) — untuk laporan
-- AKP 2b. Muncul di bawah rekap Kendala Pendaftaran & ikut tercetak (PDF).
CREATE TABLE IF NOT EXISTS simrscb_kendala_evaluasi (
  tahun         INT NOT NULL PRIMARY KEY,
  evaluasi      TEXT,
  tindak_lanjut TEXT,
  kesimpulan    TEXT,
  nip           VARCHAR(20) DEFAULT NULL,
  updated_at    DATETIME DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
