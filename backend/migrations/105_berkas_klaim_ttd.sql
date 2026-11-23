-- TTE berkas klaim dari eDokter (dokter menandatangani lewat HP/tablet).
--
-- Tabel `berkas_klaim` yang ada hanya punya status MENUNGGU_TTD / SUDAH_TTD
-- untuk seluruh berkas, tanpa jejak siapa yang sudah menandatangani. Itu cukup
-- untuk alur desktop, yang memproses seluruh penanda tangan dalam satu sesi.
--
-- Di eDokter alurnya terputus: dokter A menandatangani hari ini dari HP-nya,
-- dokter B besok. Tanpa pelacakan per penanda tangan, sistem tidak tahu siapa
-- yang masih ditunggu, dan dokter yang sudah menandatangani akan terus melihat
-- berkas itu di daftar tugasnya.

CREATE TABLE IF NOT EXISTS berkas_klaim_ttd (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    no_rawat        VARCHAR(20)  NOT NULL,
    -- Kode penanda tangan: kd_dokter ATAU nip petugas. Keduanya muncul sebagai
    -- berkas_digital_perawatan.nip, jadi kolom ini mengikuti nilai di sana.
    kode_penandatangan VARCHAR(20) NOT NULL,
    nama_penandatangan VARCHAR(100) NOT NULL DEFAULT '',
    nik             VARCHAR(16)  NOT NULL DEFAULT '',
    -- Tanda yang benar-benar dipakai sebagai titik tempel, beserta koordinat
    -- yang terpakai. Disimpan supaya bila hasilnya meleset, bisa ditelusuri
    -- tanpa menebak-nebak.
    tag             VARCHAR(40)  NOT NULL DEFAULT '',
    halaman         INT          NOT NULL DEFAULT 1,
    pos_x           DECIMAL(8,2) NOT NULL DEFAULT 0,
    pos_y           DECIMAL(8,2) NOT NULL DEFAULT 0,
    -- Sidik berkas sebelum dan sesudah tanda tangan ini dibubuhkan. Pada
    -- estafet, hash_sesudah satu baris akan sama dengan hash_sebelum baris
    -- berikutnya — sehingga urutan tanda tangan bisa dibuktikan.
    hash_sebelum    CHAR(64)     NOT NULL DEFAULT '',
    hash_sesudah    CHAR(64)     NOT NULL DEFAULT '',
    berkas_hasil    VARCHAR(200) NOT NULL DEFAULT '',
    sumber          ENUM('edokter','desktop') NOT NULL DEFAULT 'edokter',
    remote_addr     VARCHAR(45)  NOT NULL DEFAULT '',
    ditandatangani_pada DATETIME NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Satu penanda tangan hanya boleh sekali per berkas. Tanpa ini, menekan
    -- tombol dua kali di HP yang lambat akan menghasilkan dua tanda tangan.
    UNIQUE KEY uq_berkas_penandatangan (no_rawat, kode_penandatangan),
    KEY idx_no_rawat (no_rawat),
    KEY idx_kode (kode_penandatangan)
);

-- Catatan tentang dokter.tag_signer:
--
-- Seluruh dokter saat ini memiliki tag_signer = '#', sehingga pencocokan
-- "tanda milik siapa" tidak membedakan siapa pun. Pada dokumen dengan beberapa
-- penanda tangan, tanda tangan dokter kedua dapat mendarat di posisi dokter
-- pertama. Pengisian tanda unik dilakukan terpisah lewat skrip, BUKAN di
-- migrasi ini, karena perubahannya memengaruhi dokumen yang sedang menunggu
-- tanda tangan di alur desktop dan perlu dijalankan secara terkendali.
