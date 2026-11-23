-- SKP — Sasaran Keselamatan Pasien: audit kepatuhan 6 sasaran (STARKES SKP).
-- SKP1 Identifikasi, SKP2 Komunikasi Efektif (TBaK/SBAR), SKP3 High Alert,
-- SKP4 Tepat Lokasi-Prosedur-Pasien Operasi, SKP5 Kebersihan Tangan, SKP6 Risiko Jatuh.
CREATE TABLE IF NOT EXISTS simrscb_skp_audit (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  tanggal        DATE NOT NULL,
  sasaran        TINYINT NOT NULL DEFAULT 1,   -- 1..6
  indikator      VARCHAR(160) NULL,            -- nama indikator/momen yg diaudit
  unit           VARCHAR(80) NULL,
  jml_kesempatan INT NOT NULL DEFAULT 0,
  jml_patuh      INT NOT NULL DEFAULT 0,
  kepatuhan      DOUBLE NULL,                  -- patuh/kesempatan x 100
  auditor        VARCHAR(100) NULL,
  catatan        TEXT NULL,
  petugas_nip    VARCHAR(20) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_skp_tanggal (tanggal),
  KEY idx_skp_sasaran (sasaran)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
