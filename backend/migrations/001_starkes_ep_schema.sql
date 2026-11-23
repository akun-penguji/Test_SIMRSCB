-- ─────────────────────────────────────────────────────────────
-- STARKES — Master Elemen Penilaian (EP)
-- Referensi: Kepmenkes HK.01.07/MENKES/1128/2022
-- ─────────────────────────────────────────────────────────────
-- Tabel master EP STARKES. Di-seed sekali dari Kepmenkes.
-- Bisa ditambah/diupdate saat ada revisi Kepmenkes.
--
-- Pakai utf8mb4 untuk dukung karakter Indonesia tanpa masalah.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS starkes_ep (
  -- Identifikasi EP
  kd_ep            VARCHAR(20)  NOT NULL,                         -- "HPK.1.1.a" — unik
  bab              VARCHAR(8)   NOT NULL,                         -- "HPK"
  nama_bab         VARCHAR(100) NOT NULL,                         -- "Hak Pasien dan Keluarga"
  kelompok         TINYINT      NOT NULL,                         -- 1..4 (lihat Kepmenkes)
  standar          VARCHAR(20)  NOT NULL,                         -- "HPK.1"
  nama_standar     VARCHAR(300) NULL,                             -- judul singkat standar
  nomor_ep         INT          NOT NULL,                         -- urutan EP dalam standar
  deskripsi        TEXT         NOT NULL,                         -- teks lengkap EP

  -- Jenis bukti yang diharapkan surveyor
  -- Kombinasi: R (Regulasi/SK), D (Dokumen bukti), O (Observasi), S (Simulasi), W (Wawancara)
  -- Contoh: "R,D,W" = surveyor cek regulasi + dokumen + wawancara
  jenis_bukti      VARCHAR(20)  NOT NULL,

  -- Penilaian
  bobot            TINYINT      NOT NULL DEFAULT 10,              -- 10 default (skor 0/5/10)
  prioritas        TINYINT      NOT NULL DEFAULT 3,               -- 1=critical, 5=low
  kategori_bukti   VARCHAR(40)  NULL,                             -- "consent","asesmen","log","sop","laporan"

  -- Metadata versi
  versi_kepmenkes  VARCHAR(20)  NOT NULL DEFAULT '1128/2022',
  status           ENUM('aktif','non-aktif') NOT NULL DEFAULT 'aktif',
  catatan          TEXT         NULL,                             -- catatan interpretasi lokal RS

  -- Audit
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (kd_ep),
  INDEX idx_bab      (bab, kelompok),
  INDEX idx_standar  (standar),
  INDEX idx_status   (status, prioritas),
  INDEX idx_kategori (kategori_bukti)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Master Elemen Penilaian STARKES (Kepmenkes 1128/2022)';


-- ─────────────────────────────────────────────────────────────
-- Mapping form simrscb existing → EP
-- ─────────────────────────────────────────────────────────────
-- Satu form bisa cover banyak EP (1-N). Tabel ini di-seed setelah
-- starkes_ep terisi dan form simrscb sudah teridentifikasi.
--
-- Granularitas: per form (luas) — record ada di form = EP terpenuhi.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS form_ep_map (
  id               INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nama_form        VARCHAR(80)  NOT NULL,                         -- "RMHakKewajiban", "PersetujuanUmum"
  tabel_asal       VARCHAR(80)  NOT NULL,                         -- nama tabel DB simrscb/khanza
  pk_kolom         VARCHAR(80)  NOT NULL DEFAULT 'no_rawat',      -- kolom PK untuk drill bukti
  endpoint_api     VARCHAR(200) NULL,                             -- "/api/hak-kewajiban/:no_rawat"
  kd_ep            VARCHAR(20)  NOT NULL,                         -- FK ke starkes_ep
  catatan          TEXT         NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_form_ep (nama_form, kd_ep),
  INDEX idx_form  (nama_form),
  INDEX idx_ep    (kd_ep)
  -- FK ke starkes_ep di-skip — starkes_ep immutable (status='non-aktif' bukan DELETE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Mapping form simrscb ke EP STARKES (bukti)';


-- ─────────────────────────────────────────────────────────────
-- Compliance checklist per encounter
-- ─────────────────────────────────────────────────────────────
-- Di-instansiasi otomatis saat reg_periksa baru dibuat.
-- Status di-update oleh cron sync periodik (lihat docs/starkes-akreditasi.md §5.2).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_checklist (
  id               BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  no_rawat         VARCHAR(17)  NOT NULL,                         -- FK ke reg_periksa
  kd_ep            VARCHAR(20)  NOT NULL,                         -- FK ke starkes_ep
  jenis_layanan    ENUM('rajal','igd','ranap','odc','operasi') NOT NULL,

  due_at           DATETIME     NOT NULL,                         -- deadline EP wajib selesai
  status           ENUM('pending','done','overdue','waived') NOT NULL DEFAULT 'pending',
  done_at          DATETIME     NULL,                             -- diisi cron saat status='done'
  ref_form         VARCHAR(80)  NULL,                             -- form/tabel sumber bukti
  ref_id           VARCHAR(50)  NULL,                             -- PK record bukti

  -- Waive (untuk kasus khusus: APS, meninggal, dll.)
  waived_by        VARCHAR(20)  NULL,                             -- NIK yang waive
  waived_at        DATETIME     NULL,
  waive_alasan     TEXT         NULL,

  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_rawat_ep (no_rawat, kd_ep),
  INDEX idx_no_rawat   (no_rawat),
  INDEX idx_status_due (status, due_at),
  INDEX idx_ep         (kd_ep),
  -- FK ke reg_periksa & starkes_ep di-skip — validasi di app layer
  INDEX idx_kd_ep_fk   (kd_ep)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Checklist EP STARKES per encounter pasien';


-- ─────────────────────────────────────────────────────────────
-- Rule engine — EP mana yang berlaku per jenis layanan
-- ─────────────────────────────────────────────────────────────
-- Saat reg_periksa baru dibuat, query tabel ini untuk tahu
-- EP mana yang perlu di-instansiasi + SLA-nya.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_rule (
  id               INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  jenis_layanan    ENUM('rajal','igd','ranap','odc','operasi') NOT NULL,
  kd_ep            VARCHAR(20)  NOT NULL,
  sla_minutes      INT          NOT NULL,                         -- batas waktu dalam menit dari masuk
  ulang_per_shift  BOOLEAN      NOT NULL DEFAULT FALSE,           -- TRUE = di-reset per shift (mis. asesmen nyeri)
  aktif            BOOLEAN      NOT NULL DEFAULT TRUE,
  catatan          TEXT         NULL,

  UNIQUE KEY uniq_layanan_ep (jenis_layanan, kd_ep),
  INDEX idx_layanan (jenis_layanan, aktif)
  -- FK ke starkes_ep di-skip — validasi di app layer
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Rule: EP mana berlaku per jenis layanan + SLA';


-- ─────────────────────────────────────────────────────────────
-- Sync log — track cron sync run
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_sync_log (
  id               BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  last_sync_at     DATETIME     NOT NULL,
  durasi_ms        INT          NULL,
  records_updated  INT          NOT NULL DEFAULT 0,
  records_overdue  INT          NOT NULL DEFAULT 0,
  error            TEXT         NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sync_at (last_sync_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Audit log eksekusi cron sync compliance';
