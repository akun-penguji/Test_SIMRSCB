-- TTE internal untuk SOP / dokumen mutu.
--
-- Penandatanganan kriptografis dilakukan BSrE (PAdES, terbaca Adobe Reader);
-- stempel RS dan QR verifikasi ditempel sendiri SEBELUM dikirim ke BSrE --
-- mengubah PDF setelah ditandatangani akan merusak tanda tangannya.

-- Spesimen gambar: tanda tangan pejabat, stempel RS, dan logo di tengah QR.
--
-- Gambar disimpan terenkripsi di kolom, BUKAN sebagai berkas di uploads/:
-- spesimen tanda tangan tidak bisa dirotasi kalau bocor, tidak seperti
-- passphrase. Siapa pun yang bisa membaca direktori tidak boleh otomatis
-- bisa mengambilnya. Logo sebenarnya tidak rahasia, tapi ikut satu jalur
-- supaya tidak ada cabang kode kedua yang harus ikut dirawat.
CREATE TABLE IF NOT EXISTS simrscb_tte_spesimen (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    jenis           ENUM('ttd','stempel','logo') NOT NULL,
    pejabat_nik     VARCHAR(16)  NOT NULL DEFAULT '',  -- NIK BSrE; kosong untuk stempel
    pejabat_nama    VARCHAR(100) NOT NULL DEFAULT '',
    jabatan         VARCHAR(100) NOT NULL DEFAULT '',
    gambar_terenkripsi MEDIUMTEXT NOT NULL,            -- iv:hmac:ciphertext, lihat spesimen.rs
    lebar_px        INT NOT NULL DEFAULT 0,
    tinggi_px       INT NOT NULL DEFAULT 0,
    tinggi_mm       DECIMAL(5,1) NOT NULL DEFAULT 16,  -- tinggi cetak default
    -- Periode jabatan, bukan sekadar aktif/nonaktif: saat Direktur berganti,
    -- spesimen lama ditutup tanggalnya. Dokumen lama tetap terverifikasi
    -- dengan spesimen yang berlaku saat itu, tapi tidak bisa dipakai lagi.
    mulai           DATE NOT NULL,
    selesai         DATE NULL,
    dibuat_oleh     VARCHAR(20) NOT NULL DEFAULT '',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_jenis_aktif (jenis, selesai)
);

-- Satu baris per dokumen yang ditandatangani. Tidak pernah di-UPDATE kecuali
-- untuk pencabutan -- baris ini adalah catatan audit, bukan state mutable.
CREATE TABLE IF NOT EXISTS simrscb_tte_dokumen (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    sop_id          BIGINT NULL,                       -- kait ke simrscb_sidomu_sop
    nomor           VARCHAR(100) NOT NULL,
    judul           VARCHAR(255) NOT NULL,
    file_asli       VARCHAR(255) NOT NULL DEFAULT '',
    file_hasil      VARCHAR(255) NOT NULL DEFAULT '',
    -- hash_asli dipakai menolak unggahan ganda: PDF yang sudah ditandatangani
    -- masih memuat teks penanda #TTD# (white-out hanya menutup secara visual),
    -- jadi tanpa penjagaan ini ia bisa diunggah ulang dan ditempel dua kali.
    hash_asli       CHAR(64) NOT NULL DEFAULT '',
    hash_hasil      CHAR(64) NOT NULL DEFAULT '',
    spesimen_ttd_id     INT NULL,
    spesimen_stempel_id INT NULL,
    halaman         INT NOT NULL DEFAULT 1,
    pos_x           DECIMAL(8,2) NOT NULL DEFAULT 0,
    pos_y           DECIMAL(8,2) NOT NULL DEFAULT 0,
    status          ENUM('draft','ditandatangani','dicabut') NOT NULL DEFAULT 'draft',
    -- 'bsre'   : ditandatangani kriptografis oleh BSrE (PAdES) — terbaca panel
    --            tanda tangan Adobe Reader.
    -- 'tempel' : hanya gambar tanda tangan + stempel + QR yang ditempel sistem.
    --            Adobe TIDAK akan mendeteksi apa pun; keaslian sepenuhnya
    --            bersandar pada QR dan SHA-256 di tabel ini. Dicatat supaya
    --            halaman verifikasi tidak mengklaim lebih dari yang terjadi.
    metode          ENUM('tempel','bsre') NOT NULL DEFAULT 'bsre',
    penandatangan_nik   VARCHAR(16) NOT NULL DEFAULT '',
    penandatangan_nama  VARCHAR(100) NOT NULL DEFAULT '',
    ditandatangani_oleh VARCHAR(20) NOT NULL DEFAULT '', -- kode user simrscb
    ditandatangani_pada DATETIME NULL,
    remote_addr     VARCHAR(45) NOT NULL DEFAULT '',
    alasan_cabut    TEXT NULL,
    dicabut_pada    DATETIME NULL,
    diunggah_oleh   VARCHAR(20) NOT NULL DEFAULT '',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_nomor (nomor),
    KEY idx_hash_asli (hash_asli),
    KEY idx_hash_hasil (hash_hasil),
    KEY idx_status (status)
);

-- Hanya percobaan gagal & penolakan. Keberhasilan sudah tercatat sebagai baris
-- di simrscb_tte_dokumen, jadi tidak perlu digandakan di sini.
CREATE TABLE IF NOT EXISTS simrscb_tte_log (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    dokumen_id  INT NULL,
    nomor       VARCHAR(100) NOT NULL DEFAULT '',
    pesan       TEXT NOT NULL,
    status_code VARCHAR(10) NOT NULL DEFAULT 'ERR',
    oleh        VARCHAR(20) NOT NULL DEFAULT '',
    remote_addr VARCHAR(45) NOT NULL DEFAULT '',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_created (created_at)
);

-- Konfigurasi BSrE. Nilai diambil dari setting/database.xml Khanza yang sudah
-- terbukti jalan; kredensial diisi manual lewat Pengaturan, tidak di-seed di sini.
INSERT IGNORE INTO simrscb_config (kunci, nilai) VALUES
    ('tte_bsre_url',      'http://10.5.55.79/api/v2/sign/pdf'),
    ('tte_bsre_user',     ''),
    ('tte_bsre_pass',     ''),
    ('tte_verifikasi_host', 'simrs.rsudcabangbungin.id');
