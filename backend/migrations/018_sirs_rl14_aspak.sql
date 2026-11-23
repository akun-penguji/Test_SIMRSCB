-- ─────────────────────────────────────────────────────────────
-- SIRS RL 1.4 — Sarana Prasarana dan Alat Kesehatan (via ASPAK)
-- Per JUKNIS SIRS 6.3: data dilaporkan via aplikasi ASPAK eksternal
-- (https://aspak.kemkes.go.id). Tabel ini cuma simpan metadata
-- (PIC, terakhir sync, persen pemenuhan) + inventaris ringkas
-- opsional untuk monitoring internal RS.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sirs_rl14_aspak_meta (
  id                  TINYINT      NOT NULL PRIMARY KEY DEFAULT 1,
  aspak_url           VARCHAR(255) NOT NULL DEFAULT 'https://aspak.kemkes.go.id/aplikasi/',
  pic_nama            VARCHAR(150) NULL,
  pic_nik             VARCHAR(20)  NULL,
  pic_email           VARCHAR(100) NULL,
  pic_telp            VARCHAR(40)  NULL,
  pic_jabatan         VARCHAR(100) NULL,
  terakhir_sync       DATE         NULL,             -- terakhir input/update ke ASPAK
  persen_pemenuhan    DECIMAL(5,2) NULL,             -- % pemenuhan terakhir (per akreditasi: min 60%)
  total_alkes         INT          NULL,             -- jumlah alkes tercatat
  total_terkalibrasi  INT          NULL,             -- yang lulus kalibrasi
  catatan             TEXT         NULL,
  updated_at          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by          VARCHAR(20)  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='SIRS RL 1.4 — metadata sync ASPAK + PIC';

INSERT IGNORE INTO sirs_rl14_aspak_meta (id) VALUES (1);

-- Inventaris ringkas per kategori (opsional, untuk monitoring internal)
-- Tidak mengganti ASPAK; cuma overview cepat per kategori.
CREATE TABLE IF NOT EXISTS sirs_rl14_inventaris_kat (
  id                  INT          AUTO_INCREMENT PRIMARY KEY,
  kategori            VARCHAR(80)  NOT NULL,         -- mis. "Bangunan", "Prasarana", "Alkes IGD", "Alkes OK"
  nama_item           VARCHAR(150) NOT NULL,
  jumlah              INT          NOT NULL DEFAULT 0,
  jml_baik            INT          NOT NULL DEFAULT 0,
  jml_rusak_ringan    INT          NOT NULL DEFAULT 0,
  jml_rusak_berat     INT          NOT NULL DEFAULT 0,
  satuan              VARCHAR(20)  NULL DEFAULT 'unit',
  catatan             VARCHAR(200) NULL,
  updated_at          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by          VARCHAR(20)  NULL,
  INDEX idx_kat (kategori),
  CONSTRAINT chk_jumlah_total CHECK (jml_baik + jml_rusak_ringan + jml_rusak_berat <= jumlah),
  CONSTRAINT chk_nonneg CHECK (jumlah >= 0 AND jml_baik >= 0 AND jml_rusak_ringan >= 0 AND jml_rusak_berat >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='SIRS RL 1.4 — inventaris ringkas alkes/sarpras (optional)';

-- Dummy metadata
UPDATE sirs_rl14_aspak_meta SET
  pic_nama         = 'Apt. Siti Rahmawati, S.Farm',
  pic_nik          = 'P000145',
  pic_email        = 'aspak@rsudcabangbungin.go.id',
  pic_telp         = '081234567890',
  pic_jabatan      = 'Koordinator Sarpras & Alkes',
  terakhir_sync    = '2026-05-15',
  persen_pemenuhan = 78.50,
  total_alkes      = 142,
  total_terkalibrasi = 118,
  catatan          = 'Sinkron rutin ASPAK setiap akhir bulan. 24 alkes belum kalibrasi karena vendor kalibrasi pending.'
WHERE id = 1;

-- Dummy inventaris ringkas (5 kategori utama)
INSERT INTO sirs_rl14_inventaris_kat
  (kategori, nama_item, jumlah, jml_baik, jml_rusak_ringan, jml_rusak_berat, satuan, catatan) VALUES
  ('Bangunan',         'Gedung Utama',          1,  1, 0, 0, 'unit',  'Konstruksi 2019, kondisi baik'),
  ('Bangunan',         'Gedung Rawat Inap',     2,  2, 0, 0, 'unit',  NULL),
  ('Bangunan',         'IPAL',                  1,  1, 0, 0, 'unit',  'Insenerator + autoclave'),
  ('Prasarana',        'Genset',                2,  2, 0, 0, 'unit',  '500 kVA + 250 kVA'),
  ('Prasarana',        'Suction Central',       4,  3, 1, 0, 'unit',  NULL),
  ('Prasarana',        'Tabung O2 Sentral',    20, 18, 1, 1, 'tabung', NULL),
  ('Alkes IGD',        'Defibrilator',          2,  2, 0, 0, 'unit',  NULL),
  ('Alkes IGD',        'EKG',                   2,  1, 1, 0, 'unit',  '1 unit perlu kalibrasi'),
  ('Alkes IGD',        'Ventilator',            1,  1, 0, 0, 'unit',  NULL),
  ('Alkes Ranap',      'Bed Pasien',           32, 30, 2, 0, 'unit',  NULL),
  ('Alkes Ranap',      'Infusion Pump',         8,  7, 1, 0, 'unit',  NULL),
  ('Alkes Ranap',      'Syringe Pump',         12, 11, 1, 0, 'unit',  NULL),
  ('Alkes Lab',        'Hematology Analyzer',   1,  1, 0, 0, 'unit',  NULL),
  ('Alkes Lab',        'Mikroskop Binokuler',   3,  3, 0, 0, 'unit',  NULL),
  ('Alkes Lab',        'Centrifuge',            2,  2, 0, 0, 'unit',  NULL),
  ('Alkes Radiologi',  'X-Ray Konvensional',    1,  1, 0, 0, 'unit',  NULL),
  ('Alkes Radiologi',  'USG',                   2,  2, 0, 0, 'unit',  NULL)
ON DUPLICATE KEY UPDATE
  jumlah = VALUES(jumlah);
