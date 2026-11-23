-- Profil Indikator Nasional Mutu (INM) Rumah Sakit — PMK 30/2022.
--
-- Sebelum ini kolom definisi, numerator_def, denominator_def, formula dan
-- standar KOSONG untuk ketiga belas INM; yang terisi cuma dimensi & frekuensi.
-- Padahal profil indikator adalah syarat pelaporan: tanpa itu petugas tidak
-- punya acuan apa yang dihitung, dan surveior akreditasi menanyakannya.
--
-- Isi mengikuti PMK 30/2022. Dimensi, frekuensi, satuan dan target TIDAK
-- disentuh — yang sudah ada sudah benar.
--
-- Aman dijalankan berulang (UPDATE by kode).

-- `standar` bawaan cuma VARCHAR(100), tidak muat untuk metode + ketentuan
-- khusus (mis. syarat denominator >200 pada kebersihan tangan). Dilebarkan —
-- hanya memperbesar, data lama tidak terpengaruh.
ALTER TABLE simrscb_mutu_indikator MODIFY COLUMN `standar` VARCHAR(500) DEFAULT NULL;

START TRANSACTION;

UPDATE simrscb_mutu_indikator SET
  definisi = 'Kepatuhan kebersihan tangan adalah ketaatan petugas melakukan kebersihan tangan sesuai lima indikasi dan enam langkah dari WHO.',
  numerator_def = 'Jumlah tindakan kebersihan tangan yang dilakukan',
  denominator_def = 'Jumlah total peluang kebersihan tangan yang seharusnya dilakukan',
  formula = '(Numerator / Denominator) x 100%',
  standar = 'Metode observasi. Denominator WAJIB minimal lebih dari 200 peluang per bulan (ketentuan aplikasi INM).'
WHERE kode='INM01';

UPDATE simrscb_mutu_indikator SET
  definisi = 'Kepatuhan penggunaan alat pelindung diri adalah ketaatan petugas memakai APD dengan tepat sesuai indikasi ketika melakukan tindakan.',
  numerator_def = 'Jumlah petugas yang patuh menggunakan APD sesuai indikasi',
  denominator_def = 'Jumlah seluruh petugas yang terindikasi menggunakan APD',
  formula = '(Numerator / Denominator) x 100%',
  standar = 'Metode observasi.'
WHERE kode='INM02';

UPDATE simrscb_mutu_indikator SET
  definisi = 'Identifikasi pasien dilakukan memakai minimal dua penanda identitas — nama lengkap, tanggal lahir, nomor rekam medis, atau NIK — dan tidak boleh memakai nomor kamar atau lokasi pasien.',
  numerator_def = 'Jumlah pemberi pelayanan yang melakukan identifikasi pasien secara benar',
  denominator_def = 'Jumlah pemberi pelayanan yang diobservasi',
  formula = '(Numerator / Denominator) x 100%',
  standar = 'Metode observasi.'
WHERE kode='INM03';

UPDATE simrscb_mutu_indikator SET
  definisi = 'Seksio sesarea emergensi kategori I adalah tindakan yang bertujuan menyelamatkan ibu dan/atau bayi dan tidak dapat ditunda. Waktu tanggap dihitung sejak keputusan tindakan sampai insisi.',
  numerator_def = 'Jumlah pasien seksio sesarea emergensi kategori I yang mendapat tindakan kurang dari atau sama dengan 30 menit',
  denominator_def = 'Jumlah pasien yang diputuskan tindakan seksio sesarea emergensi kategori I',
  formula = '(Numerator / Denominator) x 100%',
  standar = 'Metode retrospektif. Bila tidak ada kasus pada bulan berjalan, numerator dan denominator diisi 0 disertai keterangan pada Analisa Capaian.'
WHERE kode='INM04';

UPDATE simrscb_mutu_indikator SET
  definisi = 'Waktu tunggu rawat jalan adalah rentang sejak pasien kontak dengan pendaftaran sampai dilayani oleh dokter atau dokter gigi.',
  numerator_def = 'Jumlah pasien rawat jalan dengan waktu tunggu kurang dari atau sama dengan 60 menit',
  denominator_def = 'Jumlah pasien rawat jalan yang diobservasi',
  formula = '(Numerator / Denominator) x 100%',
  standar = 'Metode retrospektif. Di SIMRS dihitung otomatis dari jam registrasi (reg_periksa.jam_reg) sampai jam pemeriksaan pertama (pemeriksaan_ralan).'
WHERE kode='INM05';

UPDATE simrscb_mutu_indikator SET
  definisi = 'Penundaan operasi elektif adalah tindakan operasi terencana yang tertunda lebih dari 1 jam dari jadwal yang telah ditentukan.',
  numerator_def = 'Jumlah pasien yang jadwal operasi elektifnya tertunda lebih dari 1 jam',
  denominator_def = 'Jumlah pasien operasi elektif',
  formula = '(Numerator / Denominator) x 100%',
  standar = 'Metode retrospektif. PERHATIAN: arah indikator ini TERBALIK — semakin KECIL semakin baik, target kurang dari atau sama dengan 5%.'
WHERE kode='INM06';

UPDATE simrscb_mutu_indikator SET
  definisi = 'Visite dokter adalah kunjungan dokter penanggung jawab pelayanan untuk melihat perkembangan pasien rawat inap yang menjadi tanggung jawabnya.',
  numerator_def = 'Jumlah pasien yang di-visite dokter pada pukul 06.00 sampai 14.00',
  denominator_def = 'Jumlah pasien yang diobservasi',
  formula = '(Numerator / Denominator) x 100%',
  standar = 'Metode retrospektif.'
WHERE kode='INM07';

UPDATE simrscb_mutu_indikator SET
  definisi = 'Pelaporan hasil kritis laboratorium adalah waktu sejak hasil pemeriksaan keluar dan dibaca sampai dilaporkan kepada dokter yang meminta.',
  numerator_def = 'Jumlah hasil kritis laboratorium yang dilaporkan kurang dari atau sama dengan 30 menit',
  denominator_def = 'Jumlah hasil kritis laboratorium yang diobservasi',
  formula = '(Numerator / Denominator) x 100%',
  standar = 'Metode retrospektif. Di SIMRS dihitung otomatis dari tabel audit_nilai_kritis dan lapor_kritis_rm (modul Nilai Kritis Lab).'
WHERE kode='INM08';

UPDATE simrscb_mutu_indikator SET
  definisi = 'Kepatuhan penggunaan formularium nasional adalah peresepan obat oleh DPJP yang sesuai dengan daftar obat Formularium Nasional bagi pasien jaminan kesehatan.',
  numerator_def = 'Jumlah resep yang sesuai dengan Formularium Nasional',
  denominator_def = 'Jumlah seluruh resep yang diobservasi',
  formula = '(Numerator / Denominator) x 100%',
  standar = 'Metode retrospektif. Berlaku untuk pasien jaminan kesehatan nasional.'
WHERE kode='INM09';

UPDATE simrscb_mutu_indikator SET
  definisi = 'Kepatuhan terhadap alur klinis adalah proses pelayanan terintegrasi oleh Profesional Pemberi Asuhan yang sesuai dengan clinical pathway yang telah ditetapkan rumah sakit.',
  numerator_def = 'Jumlah pelayanan yang sesuai dengan clinical pathway',
  denominator_def = 'Jumlah seluruh pelayanan pada clinical pathway yang diobservasi',
  formula = '(Numerator / Denominator) x 100%',
  standar = 'Metode retrospektif. Clinical pathway yang dipantau ditetapkan oleh rumah sakit.'
WHERE kode='INM10';

UPDATE simrscb_mutu_indikator SET
  definisi = 'Upaya pencegahan risiko jatuh mencakup tiga hal sekaligus: asesmen awal risiko jatuh, asesmen ulang, dan intervensi pencegahan pada pasien rawat inap berisiko tinggi.',
  numerator_def = 'Jumlah pasien rawat inap berisiko tinggi jatuh yang mendapat KETIGA upaya pencegahan',
  denominator_def = 'Jumlah pasien rawat inap berisiko tinggi jatuh yang diobservasi',
  formula = '(Numerator / Denominator) x 100%',
  standar = 'Metode retrospektif. Ketiga upaya harus lengkap — bila salah satu tidak dilakukan, pasien dihitung tidak patuh.'
WHERE kode='INM11';

UPDATE simrscb_mutu_indikator SET
  definisi = 'Kecepatan waktu tanggap komplain adalah tanggapan terhadap komplain sesuai grading risiko: merah maksimal 1x24 jam, kuning maksimal 3 hari, hijau maksimal 7 hari.',
  numerator_def = 'Jumlah komplain yang ditanggapi sesuai batas waktu grading risikonya',
  denominator_def = 'Jumlah seluruh komplain yang disurvei',
  formula = '(Numerator / Denominator) x 100%',
  standar = 'Metode retrospektif. Grading: merah 1x24 jam, kuning 3 hari, hijau 7 hari.'
WHERE kode='INM12';

UPDATE simrscb_mutu_indikator SET
  definisi = 'Kepuasan pasien adalah persepsi pasien terhadap pelayanan yang diterimanya, diukur melalui survei kepuasan masyarakat.',
  numerator_def = 'Tidak memakai numerator — hasilnya berupa Indeks Kepuasan Masyarakat',
  denominator_def = 'Tidak memakai denominator — hasilnya berupa Indeks Kepuasan Masyarakat',
  formula = 'Indeks Kepuasan Masyarakat (IKM) hasil survei',
  standar = 'Metode survei. DILAPORKAN PER SEMESTER — di aplikasi INM hanya muncul pada bulan 6 dan 12, jangan diisi tiap bulan.'
WHERE kode='INM13';

COMMIT;

SELECT kode,
       IF(definisi IS NULL OR definisi='','-','ada')        definisi,
       IF(numerator_def IS NULL OR numerator_def='','-','ada')   num,
       IF(denominator_def IS NULL OR denominator_def='','-','ada') den,
       IF(formula IS NULL OR formula='','-','ada')          formula,
       IF(standar IS NULL OR standar='','-','ada')          standar,
       frekuensi, target, satuan
  FROM simrscb_mutu_indikator WHERE jenis='inm' ORDER BY kode;
