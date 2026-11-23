-- Penambahan Sedasi (Ringan, Sedang, Dalam) dan Monitoring Nadi pada asesmen_pra_anestesi_rscb
-- Mengikuti form RM.IBS.11.004.2019. REV.01 (Planning Anestesi/Sedasi)
ALTER TABLE `asesmen_pra_anestesi_rscb`
  ADD COLUMN IF NOT EXISTS `teknik_sedasi_ringan` enum('Ya','Tidak') DEFAULT 'Tidak' AFTER `teknik_ga_tiva`,
  ADD COLUMN IF NOT EXISTS `teknik_sedasi_sedang` enum('Ya','Tidak') DEFAULT 'Tidak' AFTER `teknik_sedasi_ringan`,
  ADD COLUMN IF NOT EXISTS `teknik_sedasi_dalam` enum('Ya','Tidak') DEFAULT 'Tidak' AFTER `teknik_sedasi_sedang`,
  ADD COLUMN IF NOT EXISTS `monitoring_nadi` enum('Ya','Tidak') DEFAULT 'Tidak' AFTER `monitoring_ekg`;
