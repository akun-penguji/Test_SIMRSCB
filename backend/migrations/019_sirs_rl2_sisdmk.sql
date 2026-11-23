-- ─────────────────────────────────────────────────────────────
-- SIRS RL 2 — Data Ketenagaan (via SISDMK)
-- Per JUKNIS SIRS 6.3: data ketenagaan dilaporkan via aplikasi
-- SISDMK eksternal (https://sisdmk.kemkes.go.id). Tabel ini cuma
-- simpan metadata + PIC + summary tracking.
-- Untuk overview realtime, backend query langsung tabel `pegawai`
-- Khanza (read-only).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sirs_rl2_meta (
  id                  TINYINT      NOT NULL PRIMARY KEY DEFAULT 1,
  sisdmk_url          VARCHAR(255) NOT NULL DEFAULT 'https://sisdmk.kemkes.go.id/login',
  pic_nama            VARCHAR(150) NULL,
  pic_nik             VARCHAR(20)  NULL,
  pic_email           VARCHAR(100) NULL,
  pic_telp            VARCHAR(40)  NULL,
  pic_jabatan         VARCHAR(100) NULL,
  terakhir_sync       DATE         NULL,
  total_di_sisdmk     INT          NULL,         -- total tenaga yg sudah ter-input di SISDMK
  catatan             TEXT         NULL,
  updated_at          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by          VARCHAR(20)  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='SIRS RL 2 — metadata sync SISDMK + PIC';

INSERT IGNORE INTO sirs_rl2_meta (id) VALUES (1);

-- Dummy metadata
UPDATE sirs_rl2_meta SET
  pic_nama        = 'Bambang Hartono, S.E',
  pic_nik         = 'P000180',
  pic_email       = 'sdm@rsudcabangbungin.go.id',
  pic_telp        = '081298765432',
  pic_jabatan     = 'Kepala Bagian Kepegawaian',
  terakhir_sync   = '2026-06-01',
  total_di_sisdmk = 374,
  catatan         = 'Sinkron rutin awal bulan. Data dasar dari tabel pegawai Khanza (374 aktif). 25 pegawai baru perlu di-input ke SISDMK.'
WHERE id = 1;
