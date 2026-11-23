-- 098_jam_ttd_persetujuan_hak_kewajiban.sql
-- Tambah jam tanda tangan pasien pada Persetujuan Umum & Hak/Kewajiban.
-- Kolom di AKHIR tabel (positional insert Java desktop tetap aman).
-- Diterapkan ke prod 2026-09-25.
ALTER TABLE surat_persetujuan_umum ADD COLUMN jam TIME NULL DEFAULT NULL AFTER nip;
ALTER TABLE hak_kewajiban_pasien   ADD COLUMN jam TIME NULL DEFAULT NULL AFTER nip;
