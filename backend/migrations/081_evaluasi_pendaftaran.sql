-- Evaluasi Pendaftaran (AKP 2b): catatan analisa/kendala/tindak lanjut per periode.
-- Angka online/offline & waktu tunggu dihitung otomatis dari Khanza; kolom di sini
-- menyimpan snapshot + catatan manual petugas saat evaluasi.
CREATE TABLE IF NOT EXISTS simrscb_evaluasi_pendaftaran (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  periode       VARCHAR(20) NOT NULL,          -- 'YYYY-MM'
  jml_online    INT NOT NULL DEFAULT 0,
  jml_offline   INT NOT NULL DEFAULT 0,
  waktu_tunggu  DOUBLE NULL,                    -- rata-rata menit (rawat jalan)
  analisa       TEXT NULL,
  kendala       TEXT NULL,
  tindak_lanjut TEXT NULL,
  pelapor       VARCHAR(100) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NULL,
  UNIQUE KEY uq_periode (periode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
