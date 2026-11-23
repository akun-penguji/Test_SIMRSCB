-- ─────────────────────────────────────────────────────────────
-- Sinkronisasi STARKES master EP ke Kepmenkes 1596/2024 +
-- Kepdirjen 47104/2024 (Instrumen Survei Akreditasi RS).
--
-- Perubahan:
--  1. Tambah kolom `maksud_tujuan` (per standar) & `kelengkapan_bukti`
--     (per EP) sesuai struktur tabel di instrumen 47104.
--  2. Tambah kolom `urutan_bab` untuk sortir konsisten di UI.
--  3. Bump default `versi_kepmenkes` ke 1596/2024.
--  4. Update COMMENT tabel ke regulasi terbaru.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE starkes_ep
  ADD COLUMN IF NOT EXISTS maksud_tujuan      TEXT NULL
    AFTER nama_standar,
  ADD COLUMN IF NOT EXISTS kelengkapan_bukti  TEXT NULL
    AFTER deskripsi,
  ADD COLUMN IF NOT EXISTS urutan_bab         SMALLINT NULL
    AFTER bab,
  ADD COLUMN IF NOT EXISTS sumber_seed        VARCHAR(40) NULL
    DEFAULT 'manual' AFTER versi_kepmenkes;

ALTER TABLE starkes_ep
  MODIFY versi_kepmenkes VARCHAR(20) NOT NULL DEFAULT '1596/2024';

ALTER TABLE starkes_ep
  COMMENT = 'Master Elemen Penilaian STARKES (Kepmenkes 1596/2024 + Kepdirjen 47104/2024)';

-- Sortir bab sesuai urutan di instrumen 47104 (BAB II).
-- Manajemen RS: TKRS=1, KPS=2, MFK=3, PMKP=4, MRMIK=5, PPI=6, PPK=7
-- PCC          : AKP=11, HPK=12, PP=13, PAP=14, PAB=15, PKPO=16, KE=17
-- SKP          : SKP=20
-- Prognas      : Prognas=30
UPDATE starkes_ep SET urutan_bab = CASE bab
  WHEN 'TKRS'    THEN 1
  WHEN 'KPS'     THEN 2
  WHEN 'MFK'     THEN 3
  WHEN 'PMKP'    THEN 4
  WHEN 'MRMIK'   THEN 5
  WHEN 'PPI'     THEN 6
  WHEN 'PPK'     THEN 7
  WHEN 'AKP'     THEN 11
  WHEN 'HPK'     THEN 12
  WHEN 'PP'      THEN 13
  WHEN 'PAP'     THEN 14
  WHEN 'PAB'     THEN 15
  WHEN 'PKPO'    THEN 16
  WHEN 'KE'      THEN 17
  WHEN 'SKP'     THEN 20
  WHEN 'Prognas' THEN 30
  ELSE urutan_bab
END
WHERE urutan_bab IS NULL;
