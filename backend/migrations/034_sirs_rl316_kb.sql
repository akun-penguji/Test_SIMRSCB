-- RL 3.16 — Rekapitulasi Pelayanan Keluarga Berencana (TAHUNAN)
-- Per JUKNIS SIRS 6.3 Bab IV P. 8 metode × 7 num field:
-- Pelayanan KB (Pasca Persalinan, Pasca Keguguran, Interval, Total computed)
-- + Komplikasi KB, Kegagalan KB, Efek Samping, Drop Out.

CREATE TABLE IF NOT EXISTS sirs_rl316_entry (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tahun           CHAR(4) NOT NULL,
  urutan          INT NOT NULL,
  jenis_kode      VARCHAR(10) NOT NULL,
  jenis_nama      VARCHAR(180) NOT NULL,
  pasca_persalinan INT,
  pasca_keguguran  INT,
  interval_kb      INT,
  komplikasi       INT,
  kegagalan        INT,
  efek_samping     INT,
  drop_out         INT,
  updated_at      DATETIME,
  updated_by      VARCHAR(20),
  UNIQUE KEY uniq_tahun_jenis (tahun, jenis_kode),
  KEY idx_tahun (tahun)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
