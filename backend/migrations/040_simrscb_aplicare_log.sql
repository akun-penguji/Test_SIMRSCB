-- Log persisten untuk fitur BPJS Aplicare bed sync (port dari simrs-aplicare-web).
-- Original versi Go menyimpan log in-memory only (hilang saat restart) — di-improve di sini.

CREATE TABLE IF NOT EXISTS simrscb_aplicare_log (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  waktu     DATETIME DEFAULT CURRENT_TIMESTAMP,
  level     VARCHAR(16) NOT NULL,    -- info | success | error | warning
  message   TEXT NOT NULL,
  KEY idx_waktu (waktu),
  KEY idx_level (level)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
