-- ─────────────────────────────────────────────────────────────
-- SIRS RL 3.2 — Rekap Kegiatan Pelayanan Rawat Inap
-- Dilaporkan bulanan. Auto-compute realtime dari Khanza kamar_inap
-- × kamar × bangsal × reg_periksa × pasien.
-- Tabel ini hanya simpan override manual per (bulan, jenis).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sirs_rl32_override (
  id              INT          AUTO_INCREMENT PRIMARY KEY,
  bulan           CHAR(7)      NOT NULL,             -- YYYY-MM
  jenis           VARCHAR(80)  NOT NULL,             -- nm_bangsal
  pasien_awal     INT          NULL,
  tt_awal         INT          NULL,
  catatan         VARCHAR(255) NULL,
  updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by      VARCHAR(20)  NULL,
  UNIQUE KEY uniq_bulan_jenis (bulan, jenis)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='SIRS RL 3.2 — override manual pasien_awal & TT_awal per bulan/jenis';
