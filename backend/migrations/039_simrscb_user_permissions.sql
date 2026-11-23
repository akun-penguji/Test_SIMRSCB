-- Permission system web (di luar permission Khanza yang sudah ada di tabel `user`).
-- Key-value untuk fleksibilitas (tidak perlu ALTER tabel saat tambah fitur baru).
-- nip = Claims.kode (= user.id_user Khanza encrypted blob, atau "Admin Utama").
-- Admin Utama TIDAK perlu entri di tabel ini — login handler kasih ALL_PERMISSIONS otomatis.

CREATE TABLE IF NOT EXISTS simrscb_user_permissions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nip         VARCHAR(50) NOT NULL,
  perm_key    VARCHAR(64) NOT NULL,
  enabled     TINYINT(1) NOT NULL DEFAULT 0,
  granted_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  granted_by  VARCHAR(50) NULL,
  UNIQUE KEY uniq_nip_perm (nip, perm_key),
  KEY idx_nip (nip),
  KEY idx_perm_key (perm_key)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
