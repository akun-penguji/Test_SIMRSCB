-- ─────────────────────────────────────────────────────────────
-- Tambah kolom `profesi` ke materi_edukasi_pasien_keluarga_rscb
-- Sesuai PDF form RM.ADM.05.001.A.2019 kolom "Profesi/Perihal"
-- (Dokter / Perawat-Bidan / Apoteker / Ahli Gizi / Lainnya)
-- ─────────────────────────────────────────────────────────────
-- ⚠️ DAMPAK KHANZA: aplikasi desktop Java pakai positional INSERT
--    di RMMateriEdukasiPasienKeluargaRSCB.java:593 — pattern
--    "?,?,?,?,?,?,?,?,?,?,?" (11 ?). Setelah ALTER ini, INSERT
--    desktop akan gagal sampai pattern diubah jadi 12 ? + tambah
--    parameter `profesi` di array. UPDATE (line 616) aman karena
--    pakai named set clause.

ALTER TABLE materi_edukasi_pasien_keluarga_rscb
  ADD COLUMN profesi VARCHAR(30) NULL DEFAULT NULL
  AFTER penerima_edukasi;
