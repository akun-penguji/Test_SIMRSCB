-- ============================================================================
--  PPRA :: SEED STARTER (OPSIONAL — jalankan manual bila diperlukan)
-- ----------------------------------------------------------------------------
--  BUKAN bagian migration otomatis. Struktur tabel ada di 047_ppra_schema.sql.
--  Isi:
--    1) ppra_config  — parameter default aplikasi (aman diisi)
--    2) ppra_atc_ref — 25 baris CONTOH untuk mancing struktur
--
--  PERINGATAN: nilai DDD di bawah adalah CONTOH. DDD WHO berubah tiap edisi →
--  WAJIB verifikasi https://atcddd.fhi.no sebelum dipakai laporan RL 3.19.3 /
--  akreditasi. Untuk dataset J01 lebih lengkap lihat seed/ppra_atc_ref_j01.csv
--  (import lewat halaman /atc) atau isi sendiri dari sumber resmi WHO/AWaRe.
--
--  Cara load (contoh):
--    mysql -u <user> -p <db_khanza> < backend/migrations/seed/ppra_seed_starter.sql
-- ============================================================================

SET NAMES latin1;

-- 1) Config default aplikasi
INSERT INTO ppra_config (cfg_key, cfg_value, keterangan) VALUES
  ('ambang_access_persen', '60',              'Target minimal proporsi AWaRe Access (%)'),
  ('who_edisi_aktif',      '2025',            'Edisi WHO ATC/DDD Index yang dipakai'),
  ('sumber_patient_days',  'kamar_inap.lama', 'Sumber denominator hari rawat (ranap)'),
  ('zona_waktu',           'Asia/Jakarta',    'Zona waktu perhitungan'),
  ('periode_default',      'triwulan',        'Periode default laporan')
ON DUPLICATE KEY UPDATE cfg_value=VALUES(cfg_value), keterangan=VALUES(keterangan);

-- 2) Referensi ATC/DDD + AWaRe (CONTOH — verifikasi WHO sebelum produksi)
INSERT INTO ppra_atc_ref
  (atc_code, adm_route, nama_generik,             ddd,    ddd_satuan, aware_kategori, who_edisi) VALUES
  ('J01CA04','O','Amoxicillin',                   1.5000, 'g','Access', 2025),
  ('J01CA04','P','Amoxicillin',                   3.0000, 'g','Access', 2025),
  ('J01CR02','O','Amoxicillin+Asam Klavulanat',   1.5000, 'g','Access', 2025),
  ('J01CR02','P','Amoxicillin+Asam Klavulanat',   3.0000, 'g','Access', 2025),
  ('J01CA01','O','Ampicillin',                    2.0000, 'g','Access', 2025),
  ('J01CA01','P','Ampicillin',                    6.0000, 'g','Access', 2025),
  ('J01DB05','O','Cefadroxil',                    2.0000, 'g','Access', 2025),
  ('J01DC02','O','Cefuroxime',                    0.5000, 'g','Watch',  2025),
  ('J01DC02','P','Cefuroxime',                    3.0000, 'g','Watch',  2025),
  ('J01DD01','P','Cefotaxime',                    4.0000, 'g','Watch',  2025),
  ('J01DD02','P','Ceftazidime',                   4.0000, 'g','Watch',  2025),
  ('J01DD04','P','Ceftriaxone',                   2.0000, 'g','Watch',  2025),
  ('J01DD08','O','Cefixime',                      0.4000, 'g','Watch',  2025),
  ('J01DH02','P','Meropenem',                     3.0000, 'g','Watch',  2025),
  ('J01GB03','P','Gentamicin',                    0.2400, 'g','Access', 2025),
  ('J01GB06','P','Amikacin',                      1.0000, 'g','Access', 2025),
  ('J01MA02','O','Ciprofloxacin',                 1.0000, 'g','Watch',  2025),
  ('J01MA02','P','Ciprofloxacin',                 0.8000, 'g','Watch',  2025),
  ('J01MA12','O','Levofloxacin',                  0.5000, 'g','Watch',  2025),
  ('J01MA12','P','Levofloxacin',                  0.5000, 'g','Watch',  2025),
  ('J01XD01','P','Metronidazole (IV)',            1.5000, 'g','Access', 2025),
  ('J01FF01','O','Clindamycin',                   1.2000, 'g','Access', 2025),
  ('J01FF01','P','Clindamycin',                   1.8000, 'g','Access', 2025),
  ('J01XA01','P','Vancomycin',                    2.0000, 'g','Watch',  2025),
  ('J01EE01','O','Kotrimoksazol',                 1.9200, 'g','Access', 2025)
ON DUPLICATE KEY UPDATE
  nama_generik=VALUES(nama_generik), ddd=VALUES(ddd), ddd_satuan=VALUES(ddd_satuan),
  aware_kategori=VALUES(aware_kategori), who_edisi=VALUES(who_edisi);
