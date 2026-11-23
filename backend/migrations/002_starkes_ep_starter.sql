-- ─────────────────────────────────────────────────────────────
-- STARKES EP Starter Pack (~50 EP prioritas)
-- ─────────────────────────────────────────────────────────────
-- Subset EP yang langsung relate dengan form simrscb existing.
-- Fokus bab: HPK, PP, PAP, KE, SKP, MRMIK, PPI.
--
-- ⚠️ Catatan: teks deskripsi & nomor EP di file ini adalah
-- INTERPRETASI dari Kepmenkes 1128/2022. Sebelum dipakai untuk
-- audit resmi, tim akreditasi RS WAJIB verifikasi terhadap
-- dokumen Kepmenkes asli dan instrumen survey LARS DHP/KARS
-- yang akan dipakai.
--
-- Sumber lengkap akan dimasukkan via parse_kepmenkes.py (Opsi 1).
-- ─────────────────────────────────────────────────────────────

-- Pastikan schema sudah dibuat (jalankan starkes_ep_schema.sql dulu)

INSERT IGNORE INTO starkes_ep (kd_ep, bab, nama_bab, kelompok, standar, nama_standar, nomor_ep,
                         deskripsi, jenis_bukti, prioritas, kategori_bukti) VALUES

-- ═════════════════════════════════════════════════════════════
-- BAB HPK — Hak Pasien dan Keluarga (Kelompok II)
-- ═════════════════════════════════════════════════════════════

('HPK.1.1', 'HPK', 'Hak Pasien dan Keluarga', 2,
 'HPK.1', 'Identifikasi hak pasien dan keluarga', 1,
 'RS menetapkan regulasi tentang hak pasien dan keluarga yang menjadi dasar pemberian layanan.',
 'R,D', 2, 'sop'),

('HPK.1.2', 'HPK', 'Hak Pasien dan Keluarga', 2,
 'HPK.1', 'Identifikasi hak pasien dan keluarga', 2,
 'Staf RS dilatih dan memahami hak pasien dan keluarga.',
 'R,D,W', 3, 'sop'),

('HPK.2.1', 'HPK', 'Hak Pasien dan Keluarga', 2,
 'HPK.2', 'Informasi hak dan kewajiban pasien', 1,
 'Pasien dan keluarga diberikan informasi tertulis tentang hak dan kewajiban pasien saat mendaftar/masuk rawat.',
 'D,O,W', 1, 'consent'),

('HPK.4.1', 'HPK', 'Hak Pasien dan Keluarga', 2,
 'HPK.4', 'Privasi pasien', 1,
 'RS melindungi privasi pasien selama pelayanan, termasuk dalam berbagi data ke pihak ketiga (SATUSEHAT, BPJS, dll.) dengan persetujuan tertulis.',
 'R,D,W', 1, 'consent'),

('HPK.5.1', 'HPK', 'Hak Pasien dan Keluarga', 2,
 'HPK.5', 'Persetujuan Umum (General Consent)', 1,
 'Pasien dan/atau keluarga memberikan persetujuan umum (general consent) yang berisi persetujuan layanan, hak, kewajiban, dan privasi pada awal pelayanan.',
 'D,W', 1, 'consent'),

('HPK.5.2', 'HPK', 'Hak Pasien dan Keluarga', 2,
 'HPK.5', 'Pernyataan biaya & jaminan', 2,
 'Pasien dan/atau keluarga menandatangani pernyataan kesediaan biaya dan/atau jaminan pembayaran.',
 'D', 2, 'consent'),

('HPK.6.1', 'HPK', 'Hak Pasien dan Keluarga', 2,
 'HPK.6', 'Informed consent tindakan', 1,
 'Setiap tindakan medis/diagnostik invasif dilakukan setelah pasien/keluarga diberi penjelasan dan menandatangani persetujuan tindakan (informed consent).',
 'D,O,W', 1, 'consent'),

('HPK.7.1', 'HPK', 'Hak Pasien dan Keluarga', 2,
 'HPK.7', 'Penolakan tindakan & APS', 1,
 'RS memiliki proses untuk menerima penolakan tindakan/pengobatan dan permintaan APS (Atas Permintaan Sendiri) yang terdokumentasi.',
 'R,D,W', 2, 'consent'),


-- ═════════════════════════════════════════════════════════════
-- BAB PP — Pengkajian Pasien (Kelompok II)
-- ═════════════════════════════════════════════════════════════

('PP.1.1', 'PP', 'Pengkajian Pasien', 2,
 'PP.1', 'Asesmen awal rawat inap', 1,
 'Asesmen awal medis pasien rawat inap diselesaikan dalam 24 jam pertama setelah pasien masuk ranap, atau lebih cepat sesuai kondisi pasien.',
 'D,O,W', 1, 'asesmen'),

('PP.1.2', 'PP', 'Pengkajian Pasien', 2,
 'PP.1', 'Asesmen awal keperawatan ranap', 2,
 'Asesmen awal keperawatan pasien rawat inap diselesaikan dalam 24 jam pertama setelah pasien masuk ranap.',
 'D,O,W', 1, 'asesmen'),

('PP.1.3', 'PP', 'Pengkajian Pasien', 2,
 'PP.1', 'Asesmen awal IGD', 3,
 'Asesmen awal pasien IGD dilakukan segera (≤10 menit) setelah triase ditegakkan.',
 'D,O,W', 1, 'asesmen'),

('PP.1.4', 'PP', 'Pengkajian Pasien', 2,
 'PP.1', 'Asesmen awal rawat jalan', 4,
 'Asesmen awal pasien rawat jalan dilakukan pada kunjungan pertama oleh DPJP rajal.',
 'D,O,W', 2, 'asesmen'),

('PP.1.5', 'PP', 'Pengkajian Pasien', 2,
 'PP.1', 'Skrining nyeri', 5,
 'Skrining nyeri dilakukan saat asesmen awal dan diulang sesuai kebutuhan dengan skala nyeri yang divalidasi (NRS, Wong-Baker, FLACC).',
 'D,O,W', 1, 'asesmen'),

('PP.1.6', 'PP', 'Pengkajian Pasien', 2,
 'PP.1', 'Skrining gizi', 6,
 'Skrining gizi awal dilakukan pada semua pasien rawat inap menggunakan instrumen yang divalidasi (mis. MST untuk dewasa, STRONG-Kids untuk anak).',
 'D,O,W', 2, 'asesmen'),

('PP.1.7', 'PP', 'Pengkajian Pasien', 2,
 'PP.1', 'Skrining risiko jatuh', 7,
 'Skrining risiko jatuh dilakukan pada pasien rawat jalan dan rawat inap menggunakan instrumen yang divalidasi (Get Up & Go, Morse, Humpty Dumpty).',
 'D,O,W', 1, 'asesmen'),

('PP.2.1', 'PP', 'Pengkajian Pasien', 2,
 'PP.2', 'Asesmen ulang', 1,
 'Asesmen ulang dilakukan secara berkala sesuai kondisi pasien — minimal sekali per shift untuk pasien ranap, atau lebih sering pada kondisi kritis.',
 'D,O,W', 2, 'asesmen'),


-- ═════════════════════════════════════════════════════════════
-- BAB PAP — Pelayanan dan Asuhan Pasien (Kelompok II)
-- ═════════════════════════════════════════════════════════════

('PAP.1.1', 'PAP', 'Pelayanan dan Asuhan Pasien', 2,
 'PAP.1', 'Rencana asuhan terintegrasi', 1,
 'Rencana asuhan pasien disusun terintegrasi antar PPA (DPJP, perawat, ahli gizi, apoteker, fisioterapis) dalam CPPT dengan format SOAP.',
 'D,O,W', 1, 'asesmen'),

('PAP.1.2', 'PAP', 'Pelayanan dan Asuhan Pasien', 2,
 'PAP.1', 'CPPT', 2,
 'Catatan Perkembangan Pasien Terintegrasi (CPPT) diisi setiap kontak PPA dengan pasien, format SOAP, dengan jam visite DPJP <14:00.',
 'D,O,W', 1, 'asesmen'),

('PAP.2.1', 'PAP', 'Pelayanan dan Asuhan Pasien', 2,
 'PAP.2', 'Manajemen nyeri', 1,
 'Pasien dengan nyeri dilakukan asesmen ulang nyeri secara periodik (minimal per shift atau lebih sering) dan diberi intervensi sesuai protokol.',
 'D,O,W', 2, 'asesmen'),

('PAP.3.1', 'PAP', 'Pelayanan dan Asuhan Pasien', 2,
 'PAP.3', 'Transfer pasien internal', 1,
 'Transfer pasien antar unit dilakukan dengan handover SBAR terdokumentasi.',
 'D,O,W', 2, 'asesmen'),


-- ═════════════════════════════════════════════════════════════
-- BAB KE — Komunikasi dan Edukasi (Kelompok II)
-- ═════════════════════════════════════════════════════════════

('KE.1.1', 'KE', 'Komunikasi dan Edukasi', 2,
 'KE.1', 'Edukasi pasien dan keluarga', 1,
 'RS menetapkan regulasi tentang edukasi pasien dan keluarga yang terintegrasi.',
 'R,D', 3, 'sop'),

('KE.5.1', 'KE', 'Komunikasi dan Edukasi', 2,
 'KE.5', 'Asesmen kebutuhan edukasi', 1,
 'Asesmen kebutuhan edukasi pasien dan keluarga dilakukan saat masuk dan didokumentasikan (bahasa, kondisi fisik/mental, hambatan komunikasi, dll.).',
 'D,O,W', 1, 'edukasi'),

('KE.5.2', 'KE', 'Komunikasi dan Edukasi', 2,
 'KE.5', 'Pelaksanaan edukasi', 2,
 'Pasien dan keluarga mendapat edukasi sesuai kebutuhan, terdokumentasi (materi, edukator, tanggal), dan dievaluasi pemahamannya.',
 'D,O,W', 1, 'edukasi'),


-- ═════════════════════════════════════════════════════════════
-- BAB SKP — Sasaran Keselamatan Pasien (Kelompok III)
-- ═════════════════════════════════════════════════════════════

('SKP.1.1', 'SKP', 'Sasaran Keselamatan Pasien', 3,
 'SKP.1', 'Identifikasi pasien dengan 2 identifier', 1,
 'Pasien diidentifikasi dengan 2 identifier (nama lengkap + tanggal lahir, atau nama + nomor RM) di setiap touchpoint klinis (pemberian obat, pengambilan sampel lab, transfusi, tindakan).',
 'D,O,W', 1, 'log'),

('SKP.1.2', 'SKP', 'Sasaran Keselamatan Pasien', 3,
 'SKP.1', 'Gelang identifikasi pasien', 2,
 'Setiap pasien rawat inap memakai gelang identifikasi dengan minimal 2 identifier. Warna gelang menunjukkan status (alergi, risiko jatuh, DNR).',
 'O,W', 1, 'log'),

('SKP.2.1', 'SKP', 'Sasaran Keselamatan Pasien', 3,
 'SKP.2', 'Komunikasi efektif SBAR/TBaK', 1,
 'Komunikasi antar PPA menggunakan teknik SBAR (Situation-Background-Assessment-Recommendation) atau TBaK (Tulis-Baca-Konfirmasi) untuk instruksi verbal/telepon.',
 'D,O,W', 1, 'log'),

('SKP.2.2', 'SKP', 'Sasaran Keselamatan Pasien', 3,
 'SKP.2', 'Pelaporan nilai kritis', 2,
 'Hasil pemeriksaan dengan nilai kritis (lab, radiologi) dilaporkan ke DPJP dalam waktu ≤30 menit setelah hasil keluar, dengan TBaK terdokumentasi.',
 'D,O,W', 1, 'log'),

('SKP.3.1', 'SKP', 'Sasaran Keselamatan Pasien', 3,
 'SKP.3', 'Keamanan obat high-alert', 1,
 'Obat high-alert (heparin, KCl, insulin, narkotika, dll.) dikelola dengan penyimpanan terpisah, label khusus, dan double-check sebelum pemberian.',
 'R,D,O', 1, 'sop'),

('SKP.3.2', 'SKP', 'Sasaran Keselamatan Pasien', 3,
 'SKP.3', 'Obat LASA', 2,
 'Obat Look-Alike Sound-Alike (LASA) diberi penanda khusus dan disimpan tidak berdampingan untuk mencegah salah ambil.',
 'O', 2, 'sop'),

('SKP.4.1', 'SKP', 'Sasaran Keselamatan Pasien', 3,
 'SKP.4', 'Sign-In sebelum induksi anestesi', 1,
 'Sebelum induksi anestesi, tim operasi melakukan Sign-In: konfirmasi identitas pasien, prosedur, lokasi operasi, persetujuan, alergi.',
 'D,O,W', 1, 'asesmen'),

('SKP.4.2', 'SKP', 'Sasaran Keselamatan Pasien', 3,
 'SKP.4', 'Time-Out sebelum insisi', 2,
 'Sebelum insisi, tim melakukan Time-Out: konfirmasi tim, pasien, prosedur, lokasi insisi (site marking), antibiotik profilaksis.',
 'D,O,W', 1, 'asesmen'),

('SKP.4.3', 'SKP', 'Sasaran Keselamatan Pasien', 3,
 'SKP.4', 'Sign-Out sebelum keluar OK', 3,
 'Sebelum pasien keluar OK, tim melakukan Sign-Out: konfirmasi prosedur, hitung instrumen/kassa, spesimen, masalah peralatan.',
 'D,O,W', 1, 'asesmen'),

('SKP.4.4', 'SKP', 'Sasaran Keselamatan Pasien', 3,
 'SKP.4', 'Site marking', 4,
 'Lokasi operasi ditandai (site marking) oleh dokter operator dengan persetujuan pasien sebelum pasien masuk ruang operasi.',
 'D,O', 2, 'asesmen'),

('SKP.5.1', 'SKP', 'Sasaran Keselamatan Pasien', 3,
 'SKP.5', 'Hand hygiene 5 moments', 1,
 'Staf RS melakukan hand hygiene sesuai 5 moments WHO dengan kepatuhan dimonitor periodik.',
 'D,O,W', 1, 'log'),

('SKP.5.2', 'SKP', 'Sasaran Keselamatan Pasien', 3,
 'SKP.5', 'Bundle pencegahan infeksi', 2,
 'RS menerapkan bundle pencegahan infeksi (IADP, ISK, VAP, IDO, PLABSI) dengan audit periodik.',
 'D,O', 1, 'log'),

('SKP.6.1', 'SKP', 'Sasaran Keselamatan Pasien', 3,
 'SKP.6', 'Skrining risiko jatuh awal', 1,
 'Skrining risiko jatuh dilakukan saat asesmen awal pada semua pasien rawat jalan dan rawat inap.',
 'D,O,W', 1, 'asesmen'),

('SKP.6.2', 'SKP', 'Sasaran Keselamatan Pasien', 3,
 'SKP.6', 'Skrining ulang risiko jatuh', 2,
 'Skrining risiko jatuh ulang dilakukan pada pasien rawat inap minimal per shift atau saat ada perubahan kondisi.',
 'D,O,W', 2, 'asesmen'),


-- ═════════════════════════════════════════════════════════════
-- BAB MRMIK — Manajemen Rekam Medis (Kelompok I)
-- ═════════════════════════════════════════════════════════════

('MRMIK.1.1', 'MRMIK', 'Manajemen Rekam Medis & Informasi Kesehatan', 1,
 'MRMIK.1', 'Regulasi RM', 1,
 'RS menetapkan regulasi tentang penyelenggaraan rekam medis (manual/elektronik) sesuai PMK 24/2022.',
 'R', 3, 'sop'),

('MRMIK.10.1', 'MRMIK', 'Manajemen Rekam Medis & Informasi Kesehatan', 1,
 'MRMIK.10', 'Hak akses RM elektronik', 1,
 'Hak akses RM elektronik diatur per role (DPJP, perawat, farmasi, dll.) dan tercatat dalam audit trail.',
 'R,D,O', 2, 'log'),

('MRMIK.12.1', 'MRMIK', 'Manajemen Rekam Medis & Informasi Kesehatan', 1,
 'MRMIK.12', 'Resume medis pulang', 1,
 'Resume medis pasien pulang dibuat oleh DPJP, berisi diagnosis akhir, prosedur, kondisi pulang, obat pulang, dan instruksi follow-up.',
 'D,O,W', 1, 'laporan'),


-- ═════════════════════════════════════════════════════════════
-- BAB PPI — Pencegahan dan Pengendalian Infeksi (Kelompok I)
-- ═════════════════════════════════════════════════════════════

('PPI.1.1', 'PPI', 'Pencegahan dan Pengendalian Infeksi', 1,
 'PPI.1', 'Program PPI', 1,
 'RS menetapkan program PPI dengan IPCN (Infection Prevention Control Nurse) dan IPCO (Infection Prevention Control Officer).',
 'R,D', 3, 'sop'),

('PPI.7.1', 'PPI', 'Pencegahan dan Pengendalian Infeksi', 1,
 'PPI.7', 'Bundle IADP', 1,
 'RS menerapkan bundle pencegahan IADP (Infeksi Aliran Darah Primer) dengan audit periodik.',
 'D,O', 2, 'log'),

('PPI.7.2', 'PPI', 'Pencegahan dan Pengendalian Infeksi', 1,
 'PPI.7', 'Bundle VAP', 2,
 'RS menerapkan bundle pencegahan VAP (Ventilator Associated Pneumonia).',
 'D,O', 2, 'log'),

('PPI.7.3', 'PPI', 'Pencegahan dan Pengendalian Infeksi', 1,
 'PPI.7', 'Bundle ISK', 3,
 'RS menerapkan bundle pencegahan ISK (Infeksi Saluran Kemih) terkait pemasangan kateter.',
 'D,O', 2, 'log'),

('PPI.7.4', 'PPI', 'Pencegahan dan Pengendalian Infeksi', 1,
 'PPI.7', 'Bundle IDO', 4,
 'RS menerapkan bundle pencegahan IDO (Infeksi Daerah Operasi) dengan antibiotik profilaksis tepat.',
 'D,O', 2, 'log'),


-- ═════════════════════════════════════════════════════════════
-- BAB PKPO — Pelayanan Kefarmasian dan Penggunaan Obat (Kelompok II)
-- ═════════════════════════════════════════════════════════════

('PKPO.4.1', 'PKPO', 'Pelayanan Kefarmasian dan Penggunaan Obat', 2,
 'PKPO.4', 'Rekonsiliasi obat', 1,
 'Rekonsiliasi obat dilakukan saat pasien masuk RS, transfer antar unit, dan pulang — terdokumentasi.',
 'D,O,W', 1, 'asesmen'),

('PKPO.7.1', 'PKPO', 'Pelayanan Kefarmasian dan Penggunaan Obat', 2,
 'PKPO.7', 'Pemantauan terapi obat (PTO)', 1,
 'PTO dilakukan oleh apoteker untuk pasien risiko tinggi (polifarmasi, geriatri, ginjal/hepar, obat sempit) dengan dokumentasi intervensi.',
 'D,O,W', 2, 'asesmen'),

('PKPO.8.1', 'PKPO', 'Pelayanan Kefarmasian dan Penggunaan Obat', 2,
 'PKPO.8', 'Efek Samping Obat (ESO)', 1,
 'Setiap kejadian ESO dilaporkan ke Tim Farmasi & Terapi dan ditindaklanjuti.',
 'D,W', 2, 'laporan');
