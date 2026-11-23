-- Modul Pelayanan Keluarga Berencana (KB) — transactional per-pasien
-- Tabel web (BUKAN Khanza). Feed agregat ke RL 3.16.

CREATE TABLE IF NOT EXISTS simrscb_kb_pelayanan (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  no_rawat          VARCHAR(17) NULL,
  no_rkm_medis      VARCHAR(15) NOT NULL,
  nama_pasien       VARCHAR(100) NULL,
  tanggal           DATE NOT NULL,
  jam               TIME NULL,
  metode            ENUM('Tubektomi','Vasektomi','Implan','IUD','Suntik','Pil','Kondom','MAL') NOT NULL,
  jenis_pelayanan   ENUM('Pasca Persalinan','Pasca Keguguran','Interval') NOT NULL,
  komplikasi        TINYINT(1) NOT NULL DEFAULT 0,
  ket_komplikasi    VARCHAR(200) NULL,
  kegagalan         TINYINT(1) NOT NULL DEFAULT 0,
  ket_kegagalan     VARCHAR(200) NULL,
  efek_samping      TINYINT(1) NOT NULL DEFAULT 0,
  ket_efek_samping  VARCHAR(200) NULL,
  drop_out          TINYINT(1) NOT NULL DEFAULT 0,
  ket_drop_out      VARCHAR(200) NULL,
  catatan           TEXT NULL,
  nip               VARCHAR(20) NULL,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by        VARCHAR(20) NULL,
  KEY idx_tanggal (tanggal),
  KEY idx_no_rkm_medis (no_rkm_medis),
  KEY idx_metode (metode),
  KEY idx_no_rawat (no_rawat)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
