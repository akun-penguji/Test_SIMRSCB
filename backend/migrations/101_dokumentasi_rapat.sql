-- Modul Dokumentasi Rapat — bukti pertemuan untuk tiap komite/unit (PMKP, PPI,
-- K3RS, SKP, Komite Medik, dst). Dipakai lintas bab akreditasi, bukan milik
-- satu komite tertentu, sama seperti "Audit Edukasi Terintegrasi".
--
-- Beda dengan simrscb_monev_rapat (migrasi monev/WBK): tabel itu sempit, cuma
-- untuk rapat evaluasi perbaikan SIMRS. Modul ini untuk SEMUA jenis rapat RS.
--
-- 4 tabel:
--   simrscb_rapat              1 baris = 1 pertemuan
--   simrscb_rapat_peserta      daftar hadir (bisa diisi manual ATAU dari scan)
--   simrscb_rapat_tindak_lanjut  action item hasil rapat, siapa & kapan
--   simrscb_rapat_lampiran     file (undangan/daftar hadir/notulen/dokumentasi foto)

CREATE TABLE IF NOT EXISTS simrscb_rapat (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  judul           VARCHAR(255) NOT NULL,
  unit            VARCHAR(150) NOT NULL,              -- komite/instalasi penyelenggara
  jenis           ENUM('Rutin','Insidentil','Rapat Tinjauan Manajemen','Evaluasi','Lainnya')
                    NOT NULL DEFAULT 'Rutin',
  tanggal         DATE NOT NULL,
  jam_mulai       TIME DEFAULT NULL,
  jam_selesai     TIME DEFAULT NULL,
  tempat          VARCHAR(150) DEFAULT NULL,
  pemimpin_rapat  VARCHAR(120) DEFAULT NULL,
  notulis         VARCHAR(120) DEFAULT NULL,
  agenda          TEXT,                                -- boleh multi-baris, satu poin per baris
  notulen         TEXT,                                -- ringkasan jalannya rapat
  kesimpulan      TEXT,
  status          ENUM('Terjadwal','Selesai','Dibatalkan') NOT NULL DEFAULT 'Terjadwal',
  dibuat_oleh     VARCHAR(20)  DEFAULT NULL,            -- nip pegawai yang entri
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tanggal (tanggal),
  KEY idx_unit (unit),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS simrscb_rapat_peserta (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  rapat_id        INT UNSIGNED NOT NULL,
  nama            VARCHAR(120) NOT NULL,
  jabatan_unit    VARCHAR(150) DEFAULT NULL,
  status_hadir    ENUM('Hadir','Tidak Hadir','Izin') NOT NULL DEFAULT 'Hadir',
  keterangan      VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_rapat (rapat_id),
  CONSTRAINT fk_rapat_peserta_rapat FOREIGN KEY (rapat_id)
    REFERENCES simrscb_rapat(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS simrscb_rapat_tindak_lanjut (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  rapat_id          INT UNSIGNED NOT NULL,
  uraian            TEXT NOT NULL,
  penanggung_jawab  VARCHAR(120) DEFAULT NULL,
  target_selesai    DATE DEFAULT NULL,
  status            ENUM('Belum','Proses','Selesai') NOT NULL DEFAULT 'Belum',
  keterangan        TEXT,
  PRIMARY KEY (id),
  KEY idx_rapat (rapat_id),
  KEY idx_status (status),
  CONSTRAINT fk_rapat_tindak_lanjut_rapat FOREIGN KEY (rapat_id)
    REFERENCES simrscb_rapat(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS simrscb_rapat_lampiran (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  rapat_id      INT UNSIGNED NOT NULL,
  jenis         ENUM('Undangan','Daftar Hadir','Notulen','Dokumentasi Foto','Lainnya')
                  NOT NULL DEFAULT 'Lainnya',
  nama          VARCHAR(255) DEFAULT NULL,   -- nama asli file (tanpa ekstensi, utk tampilan)
  stored_name   VARCHAR(255) NOT NULL,       -- nama file di disk (unik, ada timestamp)
  keterangan    VARCHAR(255) DEFAULT NULL,
  uploaded_by   VARCHAR(20)  DEFAULT NULL,
  uploaded_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rapat (rapat_id),
  CONSTRAINT fk_rapat_lampiran_rapat FOREIGN KEY (rapat_id)
    REFERENCES simrscb_rapat(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
