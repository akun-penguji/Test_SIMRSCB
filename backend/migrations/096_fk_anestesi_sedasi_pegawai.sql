-- 096_fk_anestesi_sedasi_pegawai.sql
-- Foreign key kolom peng-input form Status Sedasi (RM.IBS.11.005.B) &
-- Status Anestesi (RM.IBS.11.005.A) di e-Nakes → pegawai(nik).
-- Peng-input bisa dokter atau penata anestesi, keduanya pegawai.
-- catatan_sedasi_* pakai kolom nip; catatan_anestesi_* pakai kd_petugas.
-- 17 tabel anestesi dikonversi MyISAM→InnoDB + kd_petugas ke latin1_swedish_ci
-- (agar cocok pegawai.nik). Nilai sampah/kosong di-NULL-kan sebelum FK.
-- Diterapkan langsung ke prod 2026-09-24.

ALTER TABLE `catatan_sedasi_pra` MODIFY `nip` varchar(20) COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_sedasi_pra` SET nip=NULL WHERE nip='' OR nip NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_sedasi_pra` ADD CONSTRAINT `fk_catatan_sedasi_pra_peg` FOREIGN KEY (`nip`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_sedasi_selama` MODIFY `nip` varchar(20) COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_sedasi_selama` SET nip=NULL WHERE nip='' OR nip NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_sedasi_selama` ADD CONSTRAINT `fk_catatan_sedasi_selama_peg` FOREIGN KEY (`nip`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_sedasi_pasca` MODIFY `nip` varchar(20) COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_sedasi_pasca` SET nip=NULL WHERE nip='' OR nip NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_sedasi_pasca` ADD CONSTRAINT `fk_catatan_sedasi_pasca_peg` FOREIGN KEY (`nip`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_sedasi_monitoring` MODIFY `nip` varchar(20) COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_sedasi_monitoring` SET nip=NULL WHERE nip='' OR nip NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_sedasi_monitoring` ADD CONSTRAINT `fk_catatan_sedasi_monitoring_peg` FOREIGN KEY (`nip`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_sedasi_monitoring_pasca` MODIFY `nip` varchar(20) COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_sedasi_monitoring_pasca` SET nip=NULL WHERE nip='' OR nip NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_sedasi_monitoring_pasca` ADD CONSTRAINT `fk_catatan_sedasi_monitoring_pasca_peg` FOREIGN KEY (`nip`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_blokade_regional` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_blokade_regional` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_blokade_regional` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_blokade_regional` ADD CONSTRAINT `fk_catatan_anestesi_blokade_regional_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_catatan` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_catatan` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_catatan` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_catatan` ADD CONSTRAINT `fk_catatan_anestesi_catatan_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_data_awal` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_data_awal` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_data_awal` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_data_awal` ADD CONSTRAINT `fk_catatan_anestesi_data_awal_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_instruksi_pasca` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_instruksi_pasca` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_instruksi_pasca` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_instruksi_pasca` ADD CONSTRAINT `fk_catatan_anestesi_instruksi_pasca_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_keadaan_operasi` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_keadaan_operasi` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_keadaan_operasi` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_keadaan_operasi` ADD CONSTRAINT `fk_catatan_anestesi_keadaan_operasi_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_keluar_kamar` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_keluar_kamar` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_keluar_kamar` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_keluar_kamar` ADD CONSTRAINT `fk_catatan_anestesi_keluar_kamar_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_masuk_kamar` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_masuk_kamar` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_masuk_kamar` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_masuk_kamar` ADD CONSTRAINT `fk_catatan_anestesi_masuk_kamar_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_monitoring` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_monitoring` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_monitoring` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_monitoring` ADD CONSTRAINT `fk_catatan_anestesi_monitoring_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_observasi_kamar` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_observasi_kamar` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_observasi_kamar` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_observasi_kamar` ADD CONSTRAINT `fk_catatan_anestesi_observasi_kamar_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_pasca_anestesi_masuk_kamar` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_pasca_anestesi_masuk_kamar` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_pasca_anestesi_masuk_kamar` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_pasca_anestesi_masuk_kamar` ADD CONSTRAINT `fk_catatan_anestesi_pasca_anestesi_masuk_kamar_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_pasca_anestesi_monitoring` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_pasca_anestesi_monitoring` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_pasca_anestesi_monitoring` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_pasca_anestesi_monitoring` ADD CONSTRAINT `fk_catatan_anestesi_pasca_anestesi_monitoring_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_pra_induksi` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_pra_induksi` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_pra_induksi` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_pra_induksi` ADD CONSTRAINT `fk_catatan_anestesi_pra_induksi_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_premedikasi` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_premedikasi` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_premedikasi` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_premedikasi` ADD CONSTRAINT `fk_catatan_anestesi_premedikasi_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_sectio_caesaria` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_sectio_caesaria` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_sectio_caesaria` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_sectio_caesaria` ADD CONSTRAINT `fk_catatan_anestesi_sectio_caesaria_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_umum_data_awal` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_umum_data_awal` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_umum_data_awal` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_umum_data_awal` ADD CONSTRAINT `fk_catatan_anestesi_umum_data_awal_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_umum_keterangan` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_umum_keterangan` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_umum_keterangan` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_umum_keterangan` ADD CONSTRAINT `fk_catatan_anestesi_umum_keterangan_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `catatan_anestesi_umum_monitoring` ENGINE=InnoDB;
ALTER TABLE `catatan_anestesi_umum_monitoring` MODIFY `kd_petugas` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL;
UPDATE `catatan_anestesi_umum_monitoring` SET kd_petugas=NULL WHERE kd_petugas='' OR kd_petugas NOT IN (SELECT nik FROM pegawai);
ALTER TABLE `catatan_anestesi_umum_monitoring` ADD CONSTRAINT `fk_catatan_anestesi_umum_monitoring_peg` FOREIGN KEY (`kd_petugas`) REFERENCES `pegawai`(`nik`) ON UPDATE CASCADE ON DELETE RESTRICT;
