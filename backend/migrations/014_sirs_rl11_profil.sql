-- ─────────────────────────────────────────────────────────────
-- SIRS RL 1.1 — Profil Rumah Sakit (per JUKNIS Kemenkes 6.3)
-- Tabel singleton (1 row, id=1). Shared field seperti nama_instansi
-- tetap dipakai dari `setting` Khanza (read-only); tabel ini cover
-- ~45 field tambahan dari section A/B/C JUKNIS.
-- Section D (foto), E (kerja sama LN repeatable), F (profil SIMRS
-- detail) ditangani terpisah (TODO).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sirs_rl11_profil (
  id                          TINYINT      NOT NULL PRIMARY KEY DEFAULT 1,

  -- ── Section A — Profil ──────────────────────────────────────
  tahun_berdiri               INT          NULL,
  nama_direktur               VARCHAR(150) NULL,
  jenis_rs                    VARCHAR(60)  NULL,             -- mis. "Umum", "Khusus"
  kelas_rs                    VARCHAR(10)  NULL,             -- "A", "B", "C", "D", "D Pratama"
  status_blu                  ENUM('Non BLU/BLUD','BLU','BLUD') NULL,
  kepemilikan                 VARCHAR(80)  NULL,             -- mis. "Pemerintah Kabupaten/Kota"
  nama_penyelenggara          VARCHAR(200) NULL,
  kerjasama_bpjs              ENUM('Ya','Tidak') NULL DEFAULT 'Ya',
  luas_tanah_m2               INT          NULL,
  luas_bangunan_m2            INT          NULL,
  no_call_center              VARCHAR(40)  NULL,
  website                     VARCHAR(150) NULL,

  -- ── Section B — Perizinan dan Akreditasi ────────────────────
  no_sio                      VARCHAR(60)  NULL,             -- Surat Izin Operasional
  tgl_sio                     DATE         NULL,
  tgl_berlaku_sio             DATE         NULL,
  file_sio                    VARCHAR(255) NULL,             -- path PDF
  pentahapan_akreditasi       ENUM('Lulus Perdana','Tingkat Dasar','Tingkat Madya','Tingkat Utama','Tingkat Paripurna','Proses Akreditasi') NULL,
  tgl_penetapan_akreditasi    DATE         NULL,
  tgl_berlaku_akreditasi      DATE         NULL,
  file_akreditasi             VARCHAR(255) NULL,
  akreditasi_internasional    ENUM('Ya','Tidak') NULL DEFAULT 'Tidak',
  rs_pendidikan               ENUM('Ya','Tidak') NULL DEFAULT 'Tidak',
  no_sk_pendidikan            VARCHAR(60)  NULL,
  tgl_sk_pendidikan           DATE         NULL,
  no_sk_tt                    VARCHAR(60)  NULL,             -- SK Tempat Tidur
  tgl_sk_tt                   DATE         NULL,
  file_sk_tt                  VARCHAR(255) NULL,
  ipwl                        ENUM('Ya','Tidak') NULL DEFAULT 'Tidak',
  no_sk_ipwl                  VARCHAR(60)  NULL,
  tgl_sk_ipwl                 DATE         NULL,
  file_tarif_layanan          VARCHAR(255) NULL,

  -- ── Section C — Lainnya ─────────────────────────────────────
  layanan_unggulan            TEXT         NULL,
  simrs_kondisi               ENUM('Berfungsi Front Office, Back Office','Berfungsi Front Office','Tidak Berfungsi','Tidak Ada') NULL,
  pelayanan_darah             ENUM('BDRS','UTD','Tidak ada') NULL,
  komite_transfusi_darah      ENUM('Ada','Tidak ada') NULL,
  audit_pelayanan_darah       ENUM('Dilakukan','Tidak dilakukan') NULL,
  latitude                    DECIMAL(10,7) NULL,
  longitude                   DECIMAL(10,7) NULL,
  nama_ka_ifrs                VARCHAR(150) NULL,
  telp_ka_ifrs                VARCHAR(40)  NULL,
  email_ka_ifrs               VARCHAR(100) NULL,
  kerjasama_psef              ENUM('Ya','Tidak') NULL DEFAULT 'Tidak',
  kerjasama_fk_fkg            TEXT         NULL,             -- daftar institusi (bebas multi-line)

  updated_at                  DATETIME     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by                  VARCHAR(20)  NULL                -- NIK petugas yg edit terakhir
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='SIRS RL 1.1 — field tambahan Profil RS (selain setting Khanza)';

-- Seed singleton row
INSERT IGNORE INTO sirs_rl11_profil (id) VALUES (1);
