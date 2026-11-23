-- ============================================================================
-- Modul Monev SIMRS (Monitoring & Evaluasi)
-- Tujuan : Closed-loop tracking perbaikan SIMRS untuk bukti dukung Zona
--          Integritas WBK RSUD Cabang Bungin.
--
-- Periode penilaian aktif : 1 Juli 2025 – 30 Juni 2026.
-- Tabel WEB-ONLY (BUKAN Khanza) — prefix simrscb_*.
--
-- Catatan: file ini ADDITIVE — tidak mengubah atau menghapus tabel existing.
-- ============================================================================

-- ── 1. Tabel utama temuan / monev -----------------------------------------
CREATE TABLE IF NOT EXISTS simrscb_monev (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kode               VARCHAR(20)  NOT NULL,                          -- MNV-2026-0001
  tanggal_lapor      DATE         NOT NULL,
  /* Sumber data: 'helpdesk','user','rapat','log_bridging','git','monitoring' */
  sumber             VARCHAR(20)  NOT NULL,
  unit_terdampak     VARCHAR(100) NULL,                              -- free-text dulu (data legacy)
  /* Kategori: 'bug','performa','integrasi','fitur','data','lainnya' */
  kategori           VARCHAR(20)  NOT NULL,
  /* Prioritas: 'rendah','sedang','tinggi','kritis' */
  prioritas          VARCHAR(10)  NOT NULL,
  deskripsi_masalah  TEXT         NOT NULL,
  akar_masalah       TEXT         NULL,
  tindakan_perbaikan TEXT         NULL,
  tanggal_selesai    DATE         NULL,
  hasil_verifikasi   TEXT         NULL,                              -- isi before/after / hasil retest
  /* Status: 'baru','proses','selesai','ditutup' */
  status             VARCHAR(10)  NOT NULL DEFAULT 'baru',
  pic                VARCHAR(100) NULL,                              -- nama / kode pegawai (free-text)
  created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_monev_kode (kode),
  KEY idx_monev_tanggal (tanggal_lapor),
  KEY idx_monev_status (status),
  KEY idx_monev_kategori (kategori),
  KEY idx_monev_sumber (sumber),
  KEY idx_monev_prioritas (prioritas),
  /* CHECK constraint untuk enforce enum di DB level (MariaDB ≥10.2) */
  CONSTRAINT chk_monev_sumber    CHECK (sumber    IN ('helpdesk','user','rapat','log_bridging','git','monitoring')),
  CONSTRAINT chk_monev_kategori  CHECK (kategori  IN ('bug','performa','integrasi','fitur','data','lainnya')),
  CONSTRAINT chk_monev_prioritas CHECK (prioritas IN ('rendah','sedang','tinggi','kritis')),
  CONSTRAINT chk_monev_status    CHECK (status    IN ('baru','proses','selesai','ditutup')),
  /* Closed-loop guard: status 'selesai' WAJIB punya tindakan + verifikasi + tanggal */
  CONSTRAINT chk_monev_selesai CHECK (
    status <> 'selesai' OR (
      tindakan_perbaikan IS NOT NULL AND TRIM(tindakan_perbaikan) <> ''
      AND hasil_verifikasi IS NOT NULL AND TRIM(hasil_verifikasi) <> ''
      AND tanggal_selesai IS NOT NULL
    )
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Monev SIMRS — closed-loop tracking perbaikan SIMRS (bukti dukung WBK)';

-- ── 2. Counter atomik untuk auto-generate kode MNV-YYYY-NNNN -------------
CREATE TABLE IF NOT EXISTS simrscb_monev_counter (
  tahun  SMALLINT UNSIGNED NOT NULL,
  urutan INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (tahun)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Counter atomik untuk generate kode monev (race-safe via LAST_INSERT_ID trick)';

-- ── 3. Lampiran (bukti screenshot / dokumen / link) ----------------------
CREATE TABLE IF NOT EXISTS simrscb_monev_lampiran (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  monev_id      BIGINT UNSIGNED NOT NULL,
  nama_berkas   VARCHAR(255) NOT NULL,
  path_atau_url VARCHAR(500) NOT NULL,
  keterangan    VARCHAR(255) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_monev_lampiran (monev_id),
  CONSTRAINT fk_monev_lampiran FOREIGN KEY (monev_id)
    REFERENCES simrscb_monev (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lampiran bukti monev: screenshot, dokumen, link issue tracker';

-- ── 4. Rapat / pertemuan evaluasi (untuk rekap di laporan) ---------------
CREATE TABLE IF NOT EXISTS simrscb_monev_rapat (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tanggal      DATE NOT NULL,
  judul        VARCHAR(255) NOT NULL,
  ringkasan    TEXT NULL,
  path_notulen VARCHAR(500) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_monev_rapat_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Rapat evaluasi SIMRS triwulan / insidental (referenced di laporan WBK)';

-- ============================================================================
-- DOWN (manual rollback — JANGAN execute kecuali memang mau drop modul ini)
-- ============================================================================
-- DROP TABLE IF EXISTS simrscb_monev_lampiran;
-- DROP TABLE IF EXISTS simrscb_monev_rapat;
-- DROP TABLE IF EXISTS simrscb_monev_counter;
-- DROP TABLE IF EXISTS simrscb_monev;
