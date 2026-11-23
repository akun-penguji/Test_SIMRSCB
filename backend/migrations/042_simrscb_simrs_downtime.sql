-- Downtime SIMRS — log kejadian waktu henti sistem
-- Per Juknis MRMIK 13.1 STARKES (prosedur + pelatihan + evaluasi pasca downtime).
-- Tabel WEB-ONLY (BUKAN Khanza).

CREATE TABLE IF NOT EXISTS simrscb_simrs_downtime (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  tanggal_mulai       DATETIME NOT NULL,
  tanggal_selesai     DATETIME NULL,
  durasi_menit        INT NULL,            -- auto-computed saat tanggal_selesai diisi
  jenis               ENUM('planned','incident') NOT NULL DEFAULT 'incident',
  kategori            ENUM('jaringan','listrik','aplikasi','server','database','perangkat_keras','lainnya')
                      NOT NULL DEFAULT 'lainnya',
  unit_terdampak      VARCHAR(300) NULL,   -- "Pendaftaran, Rajal, Ranap, Lab"
  judul               VARCHAR(200) NOT NULL,
  dampak              TEXT NULL,           -- pelayanan apa yang terhenti
  prosedur_manual     TEXT NULL,           -- workaround manual yang dipakai selama downtime
  root_cause          TEXT NULL,           -- akar penyebab (diisi setelah RCA)
  tindakan            TEXT NULL,           -- tindakan perbaikan
  evaluasi_pasca      TEXT NULL,           -- evaluasi pasca: apa yang dicegah ke depan
  rca_complete        TINYINT(1) NOT NULL DEFAULT 0,
  staf_terlatih       TINYINT(1) NOT NULL DEFAULT 0,  -- bukti 13.1.b: staf paham peran saat downtime
  status              ENUM('aktif','selesai','dievaluasi') NOT NULL DEFAULT 'aktif',
  pic_nip             VARCHAR(20) NULL,
  pelapor_nip         VARCHAR(20) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by          VARCHAR(20) NULL,
  KEY idx_mulai (tanggal_mulai),
  KEY idx_status (status),
  KEY idx_jenis (jenis),
  KEY idx_kategori (kategori)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Log downtime SIMRS — MRMIK 13.1 STARKES';
