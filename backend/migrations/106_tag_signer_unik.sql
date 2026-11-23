-- Tanda posisi tanda tangan yang unik per penanda tangan.
--
-- MASALAH
-- DlgBerkasCasemix sudah memvalidasi tag dengan pola ^#[A-Za-z0-9_]+#$ sebelum
-- memakainya sebagai parameter Jasper `finger`. Tapi isi kolomnya di produksi
-- adalah '#', '%', '&', '*', '1', dan NULL — seluruhnya gagal validasi kecuali
-- satu baris yang kebetulan berisi '#1A#'. Akibatnya kode selalu jatuh ke
-- default literal "#", sehingga SETIAP penanda tangan pada SETIAP dokumen
-- memakai tanda yang sama.
--
-- Dampaknya nyata: pada dokumen dengan beberapa penanda tangan, tanda tangan
-- penanda tangan kedua dapat mendarat di posisi yang pertama, dan '#' telanjang
-- juga bertabrakan dengan '#' yang muncul sebagai teks biasa di badan dokumen.
--
-- BENTUK TANDA: #<urut>A#
-- Dipilih karena bentuk ini SUDAH dikenali daftar format cadangan di
-- DlgBerkasKlaim ("#%dA#"), sehingga cocok baik lewat pencocokan tag_signer
-- maupun lewat jalur cadangan. Panjangnya 4-5 karakter, jauh lebih aman
-- terhadap kolom tanda tangan template Jasper yang selama ini hanya memuat
-- satu karakter dibanding bentuk panjang seperti #Sp.Rad001#.
--
-- Penomoran berlanjut dari dokter ke petugas dalam satu deret, supaya tidak
-- ada tanda yang sama dipakai dua orang. Keterbacaan dikembalikan lewat:
--   SELECT kd_dokter, nm_dokter, tag_signer FROM dokter  WHERE tag_signer=?
--   SELECT nip, nama, tag_signer        FROM petugas WHERE tag_signer=?

-- 1. petugas belum punya kolomnya sama sekali, padahal 16 petugas tercatat
--    sebagai penanda tangan berkas.
ALTER TABLE petugas ADD COLUMN IF NOT EXISTS tag_signer VARCHAR(50) NULL;

-- 2. Cadangkan nilai lama sebelum ditimpa.
CREATE TABLE IF NOT EXISTS tag_signer_cadangan (
    sumber      ENUM('dokter','petugas') NOT NULL,
    kode        VARCHAR(20) NOT NULL,
    tag_lama    VARCHAR(50) NULL,
    dicadangkan TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sumber, kode)
);

INSERT IGNORE INTO tag_signer_cadangan (sumber, kode, tag_lama)
SELECT 'dokter', kd_dokter, tag_signer FROM dokter;

INSERT IGNORE INTO tag_signer_cadangan (sumber, kode, tag_lama)
SELECT 'petugas', nip, tag_signer FROM petugas;

-- 3. Isi tanda unik. Urutan diturunkan dari kode agar hasilnya stabil bila
--    skrip dijalankan ulang — penomoran acak akan mengubah tanda dokumen yang
--    sedang menunggu tanda tangan.
-- Memakai ROW_NUMBER(), bukan pola @n := @n + 1 di dalam derived table.
-- MariaDB tidak menjamin urutan evaluasi variabel pengguna di sana, sehingga
-- penomoran bisa keluar acak atau bahkan berulang — dan nomor yang berulang
-- berarti dua orang memakai tanda yang sama, yaitu persis cacat yang sedang
-- diperbaiki. Window function tersedia sejak MariaDB 10.2; produksi 10.11.
UPDATE dokter d
JOIN (
    SELECT kd_dokter, ROW_NUMBER() OVER (ORDER BY kd_dokter) AS urut
    FROM dokter
) s ON s.kd_dokter = d.kd_dokter
SET d.tag_signer = CONCAT('#', s.urut, 'A#');

-- Petugas melanjutkan deret yang sama, bukan mulai dari 1, agar tidak bentrok
-- dengan tanda milik dokter.
UPDATE petugas p
JOIN (
    SELECT nip,
           ROW_NUMBER() OVER (ORDER BY nip) + (SELECT COUNT(*) FROM dokter) AS urut
    FROM petugas
) s ON s.nip = p.nip
SET p.tag_signer = CONCAT('#', s.urut, 'A#');

-- 4. Pemeriksaan setelah migrasi — jalankan manual:
--
--    -- tidak boleh ada tanda ganda, baik di dalam maupun lintas tabel
--    SELECT tag_signer, COUNT(*) FROM (
--        SELECT tag_signer FROM dokter
--        UNION ALL
--        SELECT tag_signer FROM petugas
--    ) z WHERE tag_signer IS NOT NULL
--      GROUP BY tag_signer HAVING COUNT(*) > 1;
--
--    -- semua harus lolos validasi DlgBerkasCasemix
--    SELECT COUNT(*) FROM dokter  WHERE tag_signer NOT REGEXP '^#[A-Za-z0-9_]+#$';
--    SELECT COUNT(*) FROM petugas WHERE tag_signer NOT REGEXP '^#[A-Za-z0-9_]+#$';
--
-- Pemulihan bila perlu:
--    UPDATE dokter d  JOIN tag_signer_cadangan c
--      ON c.sumber='dokter'  AND c.kode=d.kd_dokter SET d.tag_signer=c.tag_lama;
--    UPDATE petugas p JOIN tag_signer_cadangan c
--      ON c.sumber='petugas' AND c.kode=p.nip       SET p.tag_signer=c.tag_lama;
