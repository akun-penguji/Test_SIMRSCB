-- 099_pasca_masuk_kamar_airway_nadireg.sql
-- Form Status Anestesi — sub-tab Pemulihan "Masuk Kamar": tambah Airway & Nadi reg,
-- kanul_nasal enum SM/RM/NRM. Diterapkan ke prod 2026-09-25.
ALTER TABLE catatan_anestesi_pasca_anestesi_masuk_kamar
  ADD COLUMN airway varchar(30) NULL DEFAULT NULL,
  ADD COLUMN nadi_reg varchar(15) NULL DEFAULT NULL;
ALTER TABLE catatan_anestesi_pasca_anestesi_masuk_kamar
  MODIFY COLUMN kanul_nasal enum('SM','RM','NRM','SMNR') NULL DEFAULT NULL;
