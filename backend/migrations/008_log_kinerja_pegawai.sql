-- ─────────────────────────────────────────────────────────────
-- Log Kinerja Pegawai Harian
-- Setiap pegawai mencatat kegiatan harian dengan foto bukti (max 10/log).
-- Granularitas: 1 log = 1 kegiatan (bisa banyak log per hari).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS log_kinerja_pegawai (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  nip         VARCHAR(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  tanggal     DATE NOT NULL,
  jam_mulai   TIME NOT NULL,
  jam_selesai TIME NULL,
  judul       VARCHAR(200) NOT NULL,
  deskripsi   TEXT NULL,
  lokasi      VARCHAR(100) NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nip_tgl (nip, tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- NB: tidak ada FK ke pegawai(nik) supaya akun admin/non-pegawai
-- (mis. id_user "admin") juga bisa membuat log.

CREATE TABLE IF NOT EXISTS log_kinerja_foto (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  log_id      BIGINT NOT NULL,
  url_image   VARCHAR(255) NOT NULL,
  caption     VARCHAR(200) NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_log (log_id),
  CONSTRAINT fk_lkf_log FOREIGN KEY (log_id) REFERENCES log_kinerja_pegawai(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
