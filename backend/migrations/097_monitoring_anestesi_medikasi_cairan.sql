-- 097_monitoring_anestesi_medikasi_cairan.sql
-- Konsolidasi seksi "Monitoring" form Status Anestesi (RM.IBS.11.005.A) di e-Nakes:
-- tambah kolom medikasi + keluar cairan (perdarahan/urin) ke tabel monitoring.
-- Diterapkan ke prod 2026-09-24.
ALTER TABLE catatan_anestesi_umum_monitoring
  ADD COLUMN medikasi varchar(100) NULL DEFAULT NULL AFTER infus,
  ADD COLUMN keluar_cairan_perdarahan varchar(50) NULL DEFAULT NULL,
  ADD COLUMN keluar_cairan_urin varchar(50) NULL DEFAULT NULL;
