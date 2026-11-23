-- ─────────────────────────────────────────────────────────────
-- Drop tabel simrscb_edukasi_kepercayaan
-- Form fisik RM.ADM.05.001.A.2019 hanya minta "Kepercayaan
-- Lainnya: Ada/Tidak + text bebas". Text bebas disimpan langsung
-- ke kolom edukasi_pasien_keluarga_rscb.kepercayaan_lainnya
-- (varchar 100) yang sudah dipakai Khanza desktop.
-- ─────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS simrscb_edukasi_kepercayaan;
