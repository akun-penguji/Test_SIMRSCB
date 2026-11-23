-- ─────────────────────────────────────────────────────────────
-- Seed form_ep_map: mapping form simrscb existing → EP STARKES
-- ─────────────────────────────────────────────────────────────
-- 6 form yang sudah punya handler di backend Rust simrscb.
-- Klik EP di halaman akreditasi → muncul daftar form dengan
-- sample 10 record terbaru + drill ke detail form.
-- ─────────────────────────────────────────────────────────────

INSERT IGNORE INTO form_ep_map (nama_form, tabel_asal, pk_kolom, endpoint_api, kd_ep, catatan) VALUES

-- HPK.2.1: Hak & Kewajiban Pasien
('hak_kewajiban_pasien', 'hak_kewajiban_pasien', 'no_rawat',
 '/api/hak-kewajiban/:no_rawat', 'HPK.2.1',
 'Form Hak & Kewajiban yang ditandatangani pasien/keluarga'),

-- HPK.5.1: Persetujuan Umum (General Consent)
('persetujuan_umum', 'surat_persetujuan_umum', 'no_rawat',
 '/api/persetujuan-umum/:no_rawat', 'HPK.5.1',
 'Surat persetujuan umum (general consent) pasien'),

-- HPK.5.2: Pernyataan Biaya & Jaminan
('pernyataan_jaminan', 'surat_pernyataan_jaminan_pasien', 'no_rawat',
 '/api/pernyataan-jaminan/:no_rawat', 'HPK.5.2',
 'Surat pernyataan jaminan/biaya pasien'),

-- HPK.4.1: Privasi & sharing data SATUSEHAT
('persetujuan_satusehat', 'simrscb_persetujuan_satusehat', 'no_rawat',
 '/api/persetujuan-satusehat/:no_rawat', 'HPK.4.1',
 'Persetujuan integrasi data ke SATUSEHAT'),

-- KE.5.1: Asesmen kebutuhan edukasi
('edukasi_pasien', 'edukasi_pasien_keluarga_rscb', 'no_rawat',
 '/api/edukasi-pasien/:no_rawat', 'KE.5.1',
 'Asesmen kebutuhan edukasi pasien & keluarga'),

-- KE.5.2: Pelaksanaan edukasi
('materi_edukasi', 'materi_edukasi_pasien_keluarga_rscb', 'no_rawat',
 '/api/edukasi-pasien/:no_rawat/materi', 'KE.5.2',
 'Pelaksanaan materi edukasi pasien & keluarga');
