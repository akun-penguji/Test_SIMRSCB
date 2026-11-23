-- ─────────────────────────────────────────────────────────────
-- Catalog folder eviden akreditasi (link ke Google Drive/SharePoint)
-- ─────────────────────────────────────────────────────────────
-- Strategi: catalog FOLDER, bukan file individual. Tim akreditasi
-- RSUD CB sudah simpan dokumen di Drive — kita link saja.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS eviden_folder (
  id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  judul         VARCHAR(200) NOT NULL,                    -- "EVIDEN MRMIK"
  url_drive     VARCHAR(500) NOT NULL,                    -- https://drive.google.com/drive/folders/...
  bab           VARCHAR(8)   NULL,                        -- "MRMIK" (NULL = lintas-bab)
  jenis         ENUM('eviden_bab','sk','pedoman','panduan','spo','laporan','lainnya') NOT NULL DEFAULT 'lainnya',
  tahun         YEAR         NULL,
  deskripsi     TEXT         NULL,
  pic_nik       VARCHAR(20)  NULL,                        -- penanggung jawab
  status        ENUM('aktif','arsip') NOT NULL DEFAULT 'aktif',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bab    (bab, status),
  INDEX idx_jenis  (jenis),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catalog folder eviden akreditasi (link Drive)';


-- Mapping folder ↔ EP STARKES (many-to-many)
CREATE TABLE IF NOT EXISTS eviden_folder_ep_map (
  folder_id   INT          NOT NULL,
  kd_ep       VARCHAR(20)  NOT NULL,
  catatan     TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (folder_id, kd_ep),
  INDEX idx_ep (kd_ep)
  -- FK ke starkes_ep di-skip — validasi di app
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Mapping folder eviden ke EP STARKES';


-- ─────────────────────────────────────────────────────────────
-- Seed 3 folder existing yang ditemukan dari Google Drive RSUD CB
-- ─────────────────────────────────────────────────────────────

INSERT IGNORE INTO eviden_folder (id, judul, url_drive, bab, jenis, tahun, deskripsi) VALUES
(1, 'GD SIDOKAR',
   'https://drive.google.com/drive/folders/1WJ9RUScuajgpyozTuZ4BjIxTeRFWPH96',
   NULL, 'pedoman', NULL,
   'Panduan Pengelolaan Data & Informasi RSUD CB, Pedoman Kerja Teknologi Informasi'),

(2, 'EVIDEN MRMIK',
   'https://drive.google.com/drive/folders/14bItUYJJKmHV8SV_CXLtoJYUwvJ9GB6x',
   'MRMIK', 'eviden_bab', NULL,
   'Bukti pelaksanaan bab MRMIK (Manajemen Rekam Medis & Informasi Kesehatan)'),

(3, 'SPO 2023',
   'https://drive.google.com/drive/folders/1iXpwIx8vrPBufhE0Q1m50pAsXZPDQCdR',
   NULL, 'spo', 2023,
   'Standar Prosedur Operasional tahun 2023');

-- Tag awal: SIDOKAR & EVIDEN MRMIK → terkait EP MRMIK.1.1 (regulasi pengelolaan info)
INSERT IGNORE INTO eviden_folder_ep_map (folder_id, kd_ep) VALUES
(1, 'MRMIK.1.1'),
(2, 'MRMIK.1.1'),
(2, 'MRMIK.1.2'),
(2, 'MRMIK.1.3');
