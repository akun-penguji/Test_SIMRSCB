-- AKP 2.1: keterlibatan MPP dalam pengaturan alur pasien.
-- Reuse tabel mpp_evaluasi (data kosong) — kolom alur ditamb/append di akhir (posisi 11-18)
-- agar insert posisional Java RMSkriningMPPFormA (kolom 1-10) tetap sejajar.
-- Java insert sudah dinaikkan 10->18 (default 'Tidak' x6 + '' x2 untuk kolom alur).
-- Section e-Nakes: muncul otomatis di form "MPP — Evaluasi" (periop_form schema-driven).
ALTER TABLE mpp_evaluasi
  ADD COLUMN koordinasi_tempat_tidur ENUM('Tidak','Ya') NOT NULL DEFAULT 'Tidak',
  ADD COLUMN percepatan_discharge    ENUM('Tidak','Ya') NOT NULL DEFAULT 'Tidak',
  ADD COLUMN penempatan_transit      ENUM('Tidak','Ya') NOT NULL DEFAULT 'Tidak',
  ADD COLUMN koordinasi_transfer     ENUM('Tidak','Ya') NOT NULL DEFAULT 'Tidak',
  ADD COLUMN pemantauan_penumpukan   ENUM('Tidak','Ya') NOT NULL DEFAULT 'Tidak',
  ADD COLUMN koordinasi_penunjang    ENUM('Tidak','Ya') NOT NULL DEFAULT 'Tidak',
  ADD COLUMN hambatan_alur           TEXT,
  ADD COLUMN tindak_lanjut_alur      TEXT;
