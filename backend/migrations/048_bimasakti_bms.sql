-- ============================================================================
-- Modul BIMASAKTI — BMS (Body, Mind & Soul) Index
-- Basis: Makalah Anugerah ASN 2026 "BIMASAKTI", RSUD Cabang Bungin.
--
-- BMS Index = Body×30% + Mind×40% + Soul×30% (semua indikator skala 0–100).
--   Body = konversi BMI pegawai   (per-pegawai)
--   Mind = nilai E-Kinerja        (per-pegawai)
--   Soul = self-assessment ZI     (organisasi — satu nilai/periode)
--
-- Tabel WEB-ONLY (bukan Khanza) — prefix bms_*. File ADDITIVE.
-- Bobot & parameter konversi BMI disimpan di simrscb_config (bisa di-tuning
-- tanpa ubah kode): bms_w_body, bms_w_mind, bms_w_soul, bms_bmi_ideal, bms_bmi_k.
-- ============================================================================

-- ── 1. Periode penilaian (tahunan / triwulan / bulanan) --------------------
CREATE TABLE IF NOT EXISTS bms_periode (
  kd_periode   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama         VARCHAR(40)  NOT NULL,                 -- "2025" / "2025-Q3" / "2025-08"
  tgl_mulai    DATE         NOT NULL,
  tgl_selesai  DATE         NOT NULL,
  status       VARCHAR(10)  NOT NULL DEFAULT 'aktif', -- aktif | selesai
  dibuat_pada  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (kd_periode),
  UNIQUE KEY uq_bms_periode_nama (nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 2. Body — BMI per pegawai ---------------------------------------------
CREATE TABLE IF NOT EXISTS bms_body (
  kd_periode  INT UNSIGNED  NOT NULL,
  nik         VARCHAR(20)   NOT NULL,                 -- pegawai.nik
  bmi         DECIMAL(6,2)  NOT NULL,                 -- Body Mass Index
  body_index  DECIMAL(6,2)  NOT NULL,                 -- BMI → skala 0–100 (dihitung server)
  tgl_ukur    DATE          NULL,
  PRIMARY KEY (kd_periode, nik),
  KEY idx_bms_body_periode (kd_periode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. Mind — E-Kinerja per pegawai ---------------------------------------
CREATE TABLE IF NOT EXISTS bms_mind (
  kd_periode  INT UNSIGNED  NOT NULL,
  nik         VARCHAR(20)   NOT NULL,
  e_kinerja   DECIMAL(6,2)  NOT NULL,                 -- 0–100
  sumber      VARCHAR(20)   NULL DEFAULT 'manual',    -- manual | ekinerja | skp
  PRIMARY KEY (kd_periode, nik),
  KEY idx_bms_mind_periode (kd_periode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. Soul — ZI organisasi (satu nilai per periode) ----------------------
CREATE TABLE IF NOT EXISTS bms_soul_zi (
  kd_periode  INT UNSIGNED  NOT NULL,
  zi_index    DECIMAL(6,2)  NOT NULL,                 -- 0–100
  catatan     VARCHAR(255)  NULL,
  PRIMARY KEY (kd_periode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 5. Hasil skoring BMS Index (org / unit / pegawai) ---------------------
CREATE TABLE IF NOT EXISTS bms_index (
  kd_periode    INT UNSIGNED  NOT NULL,
  scope         VARCHAR(10)   NOT NULL,               -- ORG | UNIT | PEGAWAI
  ref           VARCHAR(30)   NOT NULL DEFAULT '',    -- dep_id (UNIT) / nik (PEGAWAI) / '' (ORG)
  skor_body     DECIMAL(6,2)  NULL,
  skor_mind     DECIMAL(6,2)  NULL,
  skor_soul     DECIMAL(6,2)  NULL,
  bms_index     DECIMAL(6,2)  NULL,
  kategori      VARCHAR(20)   NULL,                   -- Sangat Baik | Baik | Cukup | Perlu Perbaikan
  dihitung_pada TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (kd_periode, scope, ref),
  KEY idx_bms_index_periode (kd_periode),
  KEY idx_bms_index_scope (scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 6. Intervensi / Improvement Cycle (PDCA) — dipakai fase lanjut --------
CREATE TABLE IF NOT EXISTS bms_intervensi (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kd_periode      INT UNSIGNED  NOT NULL,
  scope           VARCHAR(10)   NOT NULL,             -- ORG | UNIT | PEGAWAI
  ref             VARCHAR(30)   NOT NULL DEFAULT '',
  temuan          TEXT          NULL,
  pdca_plan       TEXT          NULL,
  pdca_do         TEXT          NULL,
  pdca_check      TEXT          NULL,
  pdca_act        TEXT          NULL,
  status          VARCHAR(12)   NOT NULL DEFAULT 'rencana', -- rencana|proses|selesai
  rekomendasi_ai  TEXT          NULL,
  tgl             DATE          NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bms_interv_periode (kd_periode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 7. Seed konfigurasi (idempotent) --------------------------------------
-- Konversi Body: body_index = clamp(100 - |BMI - bms_bmi_ideal| * bms_bmi_k, 0, 100)
-- Konstanta di-kalibrasi agar PERSIS mereproduksi angka resmi makalah:
--   BMI 32,335 (2024) -> 26,65   |  BMI 31,890 (2025) -> 31,10
--   k     = (31,10-26,65) / (32,335-31,890) = 4,45 / 0,445 = 10
--   ideal : 26,65 = 100 - (32,335 - ideal)*10                = 25
-- Hasil: BMS Index 2024 = 70,40 dan 2025 = 76,11 (sama persis dgn makalah).
-- ideal=25 juga batas atas BMI normal (WHO); k=10 = 10 poin per unit BMI.
INSERT INTO simrscb_config (kunci, nilai) VALUES
  ('bms_w_body',     '0.30'),
  ('bms_w_mind',     '0.40'),
  ('bms_w_soul',     '0.30'),
  ('bms_bmi_ideal',  '25'),
  ('bms_bmi_k',      '10')
ON DUPLICATE KEY UPDATE kunci = kunci;   -- jangan timpa kalau sudah ada
