-- PMKP — Pelaporan Insiden Keselamatan Pasien (IKP/IRS), sesuai KKP-RS / STARKES.
-- Jenis: KPC (Kondisi Potensial Cedera), KNC (Nyaris Cedera), KTC (Tidak Cedera),
--        KTD (Tidak Diharapkan), Sentinel. Grading = matriks probabilitas x dampak.
CREATE TABLE IF NOT EXISTS simrscb_insiden (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  no_laporan               VARCHAR(30) NULL,
  tanggal_lapor            DATE NOT NULL,
  tanggal_insiden          DATE NULL,
  jam_insiden              VARCHAR(8) NULL,
  jenis_insiden            VARCHAR(10) NOT NULL DEFAULT 'KNC',  -- KPC/KNC/KTC/KTD/Sentinel
  tipe_insiden             VARCHAR(80) NULL,                    -- kategori (medikasi, jatuh, dll)
  judul                    VARCHAR(200) NULL,
  kronologi                TEXT NULL,
  no_rkm_medis             VARCHAR(15) NULL,
  nama_pasien              VARCHAR(100) NULL,
  no_rawat                 VARCHAR(17) NULL,
  unit_terjadi             VARCHAR(80) NULL,
  unit_pelapor             VARCHAR(80) NULL,
  dampak                   VARCHAR(20) NULL,   -- Tidak Signifikan/Minor/Moderat/Mayor/Katastropik
  probabilitas             TINYINT NULL,       -- 1..5
  dampak_nilai             TINYINT NULL,       -- 1..5
  grading                  VARCHAR(10) NULL,   -- Biru/Hijau/Kuning/Merah
  tindakan_segera          TEXT NULL,
  rekomendasi              TEXT NULL,
  metode_investigasi       VARCHAR(30) NULL,   -- Investigasi Sederhana / RCA
  penanggung_jawab         VARCHAR(100) NULL,
  tgl_selesai_investigasi  DATE NULL,
  akar_masalah             TEXT NULL,
  hasil_investigasi        TEXT NULL,
  status                   VARCHAR(20) NOT NULL DEFAULT 'Lapor', -- Lapor/Investigasi/Selesai/Ditutup
  pelapor_nip              VARCHAR(20) NULL,
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME NULL,
  KEY idx_ins_tanggal (tanggal_lapor),
  KEY idx_ins_jenis (jenis_insiden),
  KEY idx_ins_grading (grading)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
