-- Per Permenkes 24/2022 Pasal 30: RME wajib disimpan MINIMUM 25 tahun
-- terhitung dari kunjungan terakhir (revisi Permenkes 269/2008 yang 5 tahun
-- hanya untuk RM fisik).

ALTER TABLE simrscb_rm_pemusnahan
  ADD COLUMN retensi_thn_rme INT NOT NULL DEFAULT 25
  AFTER retensi_thn_inaktif;

-- Backfill batch existing: set 25 (default kolom sudah 25, ini eksplisit)
UPDATE simrscb_rm_pemusnahan
SET retensi_thn_rme = 25
WHERE retensi_thn_rme IS NULL OR retensi_thn_rme = 0;
