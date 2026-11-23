-- Laporan Kendala Pendaftaran (online/offline) — log kendala operasional
-- pendaftaran + rekap per bulan & per triwulan. AKP 2b (pelengkap Evaluasi
-- Pendaftaran). Kategori dirapikan (allowlist di backend).
CREATE TABLE IF NOT EXISTS simrscb_kendala_pendaftaran (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  tanggal        DATE NOT NULL,
  kategori       VARCHAR(60) NOT NULL,
  deskripsi      VARCHAR(300) DEFAULT NULL,
  jumlah_kasus   INT NOT NULL DEFAULT 1,
  dampak         VARCHAR(200) DEFAULT NULL,
  tindak_lanjut  VARCHAR(300) DEFAULT NULL,
  nip            VARCHAR(20) DEFAULT NULL,
  created_at     DATETIME DEFAULT NOW(),
  KEY idx_tanggal (tanggal),
  KEY idx_kategori (kategori)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
