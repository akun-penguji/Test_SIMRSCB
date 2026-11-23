-- Status pelaporan capaian mutu ke portal regmutufasyankes.
--
-- Juknis SIMAR Kemenkes: laporan INM paling lambat tanggal 10 bulan berikutnya
-- pukul 23.59, DAN statusnya harus sudah "terkirim" — bukan sekadar tersimpan
-- di form. Selama ini SIMRS tidak menyimpan jejak apakah suatu bulan sudah
-- dilaporkan, jadi tidak ada yang bisa dipantau.
--
-- Aman dijalankan berulang.

SET @t := 'simrscb_mutu_capaian';

SET @s := (SELECT IF(COUNT(*)=0,
  "ALTER TABLE simrscb_mutu_capaian ADD COLUMN lapor_status ENUM('Belum','Terkirim') NOT NULL DEFAULT 'Belum' AFTER pelapor",
  'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@t AND COLUMN_NAME='lapor_status');
PREPARE x FROM @s; EXECUTE x; DEALLOCATE PREPARE x;

SET @s := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE simrscb_mutu_capaian ADD COLUMN lapor_waktu DATETIME DEFAULT NULL AFTER lapor_status',
  'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@t AND COLUMN_NAME='lapor_waktu');
PREPARE x FROM @s; EXECUTE x; DEALLOCATE PREPARE x;

SET @s := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE simrscb_mutu_capaian ADD COLUMN lapor_petugas VARCHAR(150) DEFAULT NULL AFTER lapor_waktu',
  'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@t AND COLUMN_NAME='lapor_petugas');
PREPARE x FROM @s; EXECUTE x; DEALLOCATE PREPARE x;

SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='simrscb_mutu_capaian'
   AND COLUMN_NAME IN ('lapor_status','lapor_waktu','lapor_petugas')
 ORDER BY ORDINAL_POSITION;
