-- ─────────────────────────────────────────────────────────────
-- SIRS RL 3.1 — Indikator Pelayanan (BOR/ALOS/BTO/TOI/NDR/GDR)
-- Dilaporkan bulanan, data bersumber dari RL 3.2 (Rawat Inap).
--
-- Compute realtime dari Khanza kamar_inap + kamar + bangsal.
-- Tabel ini hanya untuk override manual (kalau user mau koreksi
-- hasil auto-compute).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sirs_rl31_override (
  id             INT          AUTO_INCREMENT PRIMARY KEY,
  bulan          CHAR(7)      NOT NULL,    -- "YYYY-MM"
  jenis          ENUM('Non Intensif','ICU','NICU','PICU','Intensif lainnya') NOT NULL,
  bor            DECIMAL(6,2) NULL,        -- override BOR (%)
  alos           DECIMAL(6,2) NULL,        -- override ALOS (hari)
  bto            DECIMAL(6,2) NULL,        -- override BTO (kali)
  toi            DECIMAL(6,2) NULL,        -- override TOI (hari)
  ndr            DECIMAL(6,2) NULL,        -- override NDR (per mil)
  gdr            DECIMAL(6,2) NULL,        -- override GDR (per mil)
  catatan        VARCHAR(255) NULL,
  updated_at     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by     VARCHAR(20)  NULL,
  UNIQUE KEY uniq_bulan_jenis (bulan, jenis)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='SIRS RL 3.1 — override manual indikator pelayanan (per bulan, per jenis)';
