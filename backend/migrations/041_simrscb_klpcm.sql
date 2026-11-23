-- KLPCM — Ketidaklengkapan Pengisian Catatan Medis
-- Per Juknis MRMIK 12.b/c/d STARKES. Tabel WEB-ONLY (BUKAN Khanza).
-- Audit sampling RM bulanan: petugas/komite RM cek kelengkapan 24 item per 5 kategori.

CREATE TABLE IF NOT EXISTS simrscb_klpcm_audit (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  bulan               CHAR(7) NOT NULL,          -- YYYY-MM (bulan keluar pasien)
  no_rawat            VARCHAR(17) NOT NULL,
  no_rkm_medis        VARCHAR(15) NULL,
  nama_pasien         VARCHAR(100) NULL,
  tgl_masuk           DATE NULL,
  tgl_keluar          DATE NULL,
  bangsal             VARCHAR(80) NULL,
  dpjp                VARCHAR(60) NULL,          -- nama dokter penanggung jawab
  -- Auditor
  auditor_nip         VARCHAR(20) NULL,
  tanggal_audit       DATE NOT NULL DEFAULT (CURRENT_DATE),
  -- Skor per kategori (% kelengkapan 0-100)
  score_identitas     DECIMAL(5,2) NOT NULL DEFAULT 0,
  score_anamnesa      DECIMAL(5,2) NOT NULL DEFAULT 0,
  score_pengkajian    DECIMAL(5,2) NOT NULL DEFAULT 0,
  score_dpjp          DECIMAL(5,2) NOT NULL DEFAULT 0,
  score_resume        DECIMAL(5,2) NOT NULL DEFAULT 0,
  score_total         DECIMAL(5,2) NOT NULL DEFAULT 0,
  -- Status workflow
  status              ENUM('draft','final','revisi') NOT NULL DEFAULT 'draft',
  catatan             TEXT NULL,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by          VARCHAR(20) NULL,
  UNIQUE KEY uniq_no_rawat (no_rawat),
  KEY idx_bulan (bulan),
  KEY idx_tgl_audit (tanggal_audit),
  KEY idx_status (status)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='KLPCM audit header per RM pasien pulang';

CREATE TABLE IF NOT EXISTS simrscb_klpcm_temuan (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  audit_id  INT NOT NULL,
  kategori  ENUM('identitas','anamnesa','pengkajian','dpjp','resume') NOT NULL,
  urutan    INT NOT NULL DEFAULT 0,
  item      VARCHAR(150) NOT NULL,
  lengkap   TINYINT(1) NOT NULL DEFAULT 0,
  catatan   VARCHAR(300) NULL,
  KEY idx_audit (audit_id),
  KEY idx_kategori (kategori),
  CONSTRAINT fk_temuan_audit FOREIGN KEY (audit_id)
    REFERENCES simrscb_klpcm_audit(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Temuan per item (24 default) per audit KLPCM';
