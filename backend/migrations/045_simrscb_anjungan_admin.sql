-- Anjungan Admin: pause mode + activity log
-- Tabel WEB-ONLY (BUKAN Khanza).

-- Konfigurasi kiosk (key-value, single row per key).
-- Initial value: aktif=1 (kiosk on), maintenance_msg default kosong.
CREATE TABLE IF NOT EXISTS simrscb_anjungan_config (
  cfg_key             VARCHAR(40)  NOT NULL PRIMARY KEY,
  cfg_value           VARCHAR(200) NULL,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by          VARCHAR(20)  NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Konfigurasi anjungan kiosk (pause, maintenance message, dll.)';

-- Seed initial config
INSERT IGNORE INTO simrscb_anjungan_config (cfg_key, cfg_value)
VALUES
  ('aktif',           '1'),
  ('maintenance_msg', 'Mohon maaf, kiosk anjungan sementara tidak tersedia. Silakan menuju loket pendaftaran.');

-- Activity log: catat semua aksi yang dilakukan di kiosk anjungan
-- untuk audit + analytics (jam peak, jenis kunjungan, error rate, dst).
CREATE TABLE IF NOT EXISTS simrscb_anjungan_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  waktu           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  /* Modul yang lakukan: 'walkin','bpjs-rujukan','bpjs-kontrol','bpjs-mobilejkn','antrian','config' */
  modul           VARCHAR(32) NOT NULL,
  /* Action yang dilakukan: 'cari','daftar','sep','checkin','tiket','pause','resume','dst' */
  action          VARCHAR(40) NOT NULL,
  /* Identitas (optional, untuk audit — bisa NULL kalau aksi anonim seperti tiket) */
  nik             VARCHAR(20)  NULL,
  no_kartu        VARCHAR(25)  NULL,
  no_rkm_medis    VARCHAR(15)  NULL,
  /* Hasil */
  no_rawat        VARCHAR(17)  NULL,
  no_reg          VARCHAR(8)   NULL,
  no_sep          VARCHAR(40)  NULL,
  /* Status */
  sukses          TINYINT(1)   NOT NULL DEFAULT 1,
  error_message   VARCHAR(500) NULL,
  /* Extra metadata JSON */
  meta            TEXT NULL,
  /* User Khanza yang trigger (kalau via login petugas), atau NULL kalau anonim kiosk */
  user_kode       VARCHAR(20)  NULL,
  KEY idx_waktu       (waktu),
  KEY idx_modul       (modul),
  KEY idx_action      (action),
  KEY idx_no_rkm      (no_rkm_medis),
  KEY idx_sukses      (sukses)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Activity log anjungan kiosk untuk audit + analytics';
