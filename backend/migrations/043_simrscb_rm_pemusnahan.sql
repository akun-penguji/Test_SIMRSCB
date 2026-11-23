-- Retensi & Pemusnahan RM — MRMIK 11.b/c STARKES.
-- Per Permenkes 269/2008: RM aktif disimpan 5 thn setelah kunjungan terakhir.
-- Tabel WEB-ONLY (BUKAN Khanza).

CREATE TABLE IF NOT EXISTS simrscb_rm_pemusnahan (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  no_batch            VARCHAR(40) NOT NULL,         -- "BATCH-2026-01"
  tahun_pelaksanaan   YEAR NOT NULL,
  tanggal_berita_acara DATE NULL,
  no_berita_acara     VARCHAR(80) NULL,             -- "001/BA-RM/RSCB/VI/2026"
  retensi_thn_aktif   INT NOT NULL DEFAULT 5,       -- standar 5 thn
  retensi_thn_inaktif INT NOT NULL DEFAULT 2,       -- standar 2 thn setelah aktif
  cara_pemusnahan     ENUM('dibakar','dicacah','elektronik','alih_media','lainnya')
                      NOT NULL DEFAULT 'dicacah',
  judul               VARCHAR(200) NOT NULL,        -- "Pemusnahan RM Inactive ≥ 2020"
  catatan             TEXT NULL,
  ttd_kepala_rm_nip   VARCHAR(20) NULL,
  ttd_direktur_nip    VARCHAR(20) NULL,
  pelaksana_nip       VARCHAR(20) NULL,
  status              ENUM('draft','usulan','disetujui','dilaksanakan','selesai')
                      NOT NULL DEFAULT 'draft',
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by          VARCHAR(20) NULL,
  UNIQUE KEY uniq_batch (no_batch),
  KEY idx_tahun (tahun_pelaksanaan),
  KEY idx_status (status)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Batch pemusnahan RM — MRMIK 11.b/c';

CREATE TABLE IF NOT EXISTS simrscb_rm_pemusnahan_detail (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  batch_id                 INT NOT NULL,
  no_rkm_medis             VARCHAR(15) NOT NULL,
  nama_pasien              VARCHAR(100) NULL,
  tgl_kunjungan_terakhir   DATE NULL,
  tgl_lahir                DATE NULL,
  jenis_berkas             ENUM('rm_fisik','rm_elektronik','informed_consent','resume','radiologi','lab','lainnya')
                           NOT NULL DEFAULT 'rm_fisik',
  status_berkas            ENUM('akan_dimusnahkan','disimpan_lanjutan','dimusnahkan','batal')
                           NOT NULL DEFAULT 'akan_dimusnahkan',
  alasan_disimpan          VARCHAR(300) NULL,
  catatan                  VARCHAR(300) NULL,
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_batch (batch_id),
  KEY idx_rm (no_rkm_medis),
  KEY idx_status_berkas (status_berkas),
  CONSTRAINT fk_detail_batch FOREIGN KEY (batch_id)
    REFERENCES simrscb_rm_pemusnahan(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_batch_rm (batch_id, no_rkm_medis, jenis_berkas)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Detail RM dalam batch pemusnahan';
