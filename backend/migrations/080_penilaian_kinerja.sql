-- KPS — Penilaian Kinerja Staf (OPPE/FPPE/penilaian perawat-bidan). Tabel Khanza
-- evaluasi/pencapaian_kinerja_pegawai hanya master kode → butuh tabel transaksi baru.
CREATE TABLE IF NOT EXISTS simrscb_penilaian_kinerja (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tanggal       DATE NOT NULL,
  nip           VARCHAR(20) NULL,
  nama          VARCHAR(100) NOT NULL,
  profesi       VARCHAR(40) NULL,          -- Dokter/Dokter Spesialis/Perawat/Bidan/Nakes Lain
  jenis         VARCHAR(20) NOT NULL DEFAULT 'OPPE', -- OPPE/FPPE/Penilaian Kinerja
  periode       VARCHAR(20) NULL,          -- mis. 2026-S1
  nilai         DOUBLE NULL,               -- 0-100
  kategori      VARCHAR(20) NULL,          -- Baik Sekali/Baik/Cukup/Kurang
  aspek         TEXT NULL,                 -- ringkasan aspek yang dinilai
  rekomendasi   VARCHAR(60) NULL,          -- Lanjut/Pembinaan/Kewenangan Dikurangi/dll
  penilai       VARCHAR(100) NULL,
  catatan       TEXT NULL,
  petugas_nip   VARCHAR(20) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NULL,
  KEY idx_pk_nip (nip),
  KEY idx_pk_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
