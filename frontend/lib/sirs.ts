// ─────────────────────────────────────────────────────────────────────────────
// Master daftar formulir SIRS 6.3 (Kemenkes RI, JUKNIS 15 Nov 2024)
// ─────────────────────────────────────────────────────────────────────────────

export type RlPeriode = "Update" | "Bulanan" | "Tahunan";

export interface RlForm {
  kode:     string;       // "1-1", "3-2", "4-1" — URL slug
  display:  string;       // "RL 1.1"
  grup:     string;       // "RL 1"
  judul:    string;
  periode:  RlPeriode;
  sistem:   "RS Online" | "SIRS Online";
  sumber:   string;       // tabel/sumber data
  status:   "implemented" | "siap" | "perlu_field_tambahan" | "belum_pasti";
}

export const RL_FORMS: RlForm[] = [
  // ── RL 1 — Identitas (RS Online, non-periodik) ────────────────────────────
  { kode: "1-1", display: "RL 1.1", grup: "RL 1", judul: "Profil Rumah Sakit",
    periode: "Update", sistem: "RS Online",
    sumber: "setting Khanza + sirs_rl11_profil + sirs_rl11_kerjasama_ln + sirs_rl11_simrs_modul",
    status: "implemented" },
  { kode: "1-2", display: "RL 1.2", grup: "RL 1", judul: "Ketersediaan Pelayanan",
    periode: "Update", sistem: "RS Online",
    sumber: "sirs_rl12_pelayanan (35 kategori, 298 pelayanan)",
    status: "implemented" },
  { kode: "1-3", display: "RL 1.3", grup: "RL 1", judul: "Ketersediaan dan Keterpakaian Tempat Tidur",
    periode: "Update", sistem: "RS Online",
    sumber: "sirs_rl13_tt (20 kelas TT × ruangan)",
    status: "implemented" },
  { kode: "1-4", display: "RL 1.4", grup: "RL 1", judul: "Sarana Prasarana dan Alat Kesehatan",
    periode: "Update", sistem: "RS Online",
    sumber: "sirs_rl14_aspak_meta + sirs_rl14_inventaris_kat (pelaporan resmi via ASPAK)",
    status: "implemented" },

  // ── RL 2 — Ketenagaan (RS Online, non-periodik) ───────────────────────────
  { kode: "2", display: "RL 2", grup: "RL 2", judul: "Data Ketenagaan",
    periode: "Update", sistem: "RS Online",
    sumber: "sirs_rl2_meta + pegawai Khanza (realtime summary, pelaporan resmi via SISDMK)",
    status: "implemented" },

  // ── RL 3 — Rekapitulasi Pelayanan (SIRS Online, bulanan) ─────────────────
  { kode: "3-1", display: "RL 3.1", grup: "RL 3", judul: "Indikator Pelayanan (BOR/ALOS/BTO/TOI/NDR/GDR)",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "kamar_inap × kamar × bangsal Khanza (realtime compute)",
    status: "implemented" },
  { kode: "3-2", display: "RL 3.2", grup: "RL 3", judul: "Rekapitulasi Kegiatan Pelayanan Rawat Inap",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "kamar_inap × kamar × bangsal × pasien Khanza (realtime per bangsal)",
    status: "implemented" },
  { kode: "3-3", display: "RL 3.3", grup: "RL 3", judul: "Rekapitulasi Kegiatan Pelayanan Rawat Darurat",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "sirs_rl33_entry (manual) + data_triase_igd × master_triase_macam_kasus (sanity)",
    status: "implemented" },
  { kode: "3-4", display: "RL 3.4", grup: "RL 3", judul: "Rekapitulasi Pengunjung",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "reg_periksa × pasien Khanza (realtime, first-ever-visit per no_rkm_medis)",
    status: "implemented" },
  { kode: "3-5", display: "RL 3.5", grup: "RL 3", judul: "Rekapitulasi Kunjungan",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "sirs_rl35_entry (manual 34 kategori + 2 stat) + reg_periksa × pasien × kabupaten (sanity)",
    status: "implemented" },
  { kode: "3-6", display: "RL 3.6", grup: "RL 3", judul: "Rekapitulasi Kegiatan Pelayanan Kebidanan",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "sirs_rl36_entry (manual 29 leaf + 5 parent) + catatan_persalinan + pemeriksaan_obstetri (sanity tipis)",
    status: "implemented" },
  { kode: "3-7", display: "RL 3.7", grup: "RL 3", judul: "Rekapitulasi Pelayanan Neonatal, Bayi, dan Balita",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "sirs_rl37_entry (manual 29 leaf + 9 parent) + pasien_bayi (patokan) + diagnosa P/Q/Z38 + penilaian_ralan_bayi + age reg_periksa",
    status: "implemented" },
  { kode: "3-8", display: "RL 3.8", grup: "RL 3", judul: "Rekapitulasi Kegiatan Pelayanan Laboratorium",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "sirs_rl38_entry (manual ~155 parameter JUKNIS) + periksa_lab × jns_perawatan_lab (sanity PK/MB/PA + top 30)",
    status: "implemented" },
  { kode: "3-9", display: "RL 3.9", grup: "RL 3", judul: "Rekapitulasi Kegiatan Pelayanan Radiologi",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "sirs_rl39_entry (manual 23 baris) + periksa_radiologi auto-klasifikasi (CT/USG/MRI/Gigi/Kontras/X-ray)",
    status: "implemented" },
  { kode: "3-10", display: "RL 3.10", grup: "RL 3", judul: "Rekapitulasi Kegiatan Pelayanan Rujukan",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "sirs_rl310_entry (manual 20 spesialisasi) + rujuk_masuk × kd_poli (sanity) + rujuk (keluar)",
    status: "implemented" },
  { kode: "3-11", display: "RL 3.11", grup: "RL 3", judul: "Rekapitulasi Pelayanan Gigi dan Mulut",
    periode: "Tahunan", sistem: "SIRS Online",
    sumber: "sirs_rl311_entry (manual 16 jenis) + rawat_jl_dr/drpr × jns_perawatan (auto-klasifikasi via nama pattern)",
    status: "implemented" },
  { kode: "3-12", display: "RL 3.12", grup: "RL 3", judul: "Rekapitulasi Kegiatan Pelayanan Pembedahan",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "sirs_rl312_entry (manual K/B/S/K) + prosedur_pasien × icd9 status=Ranap (sugesti per ICD-9 chapter)",
    status: "implemented" },
  { kode: "3-13", display: "RL 3.13", grup: "RL 3", judul: "Rekapitulasi Pelayanan Rehabilitasi Medik",
    periode: "Tahunan", sistem: "SIRS Online",
    sumber: "sirs_rl313_entry (manual 42 leaf) + rawat_jl_dr/drpr × jns_perawatan (sugesti via nama LIKE Fisioterapi/Spirometri/Traksi/TENS/dll)",
    status: "implemented" },
  { kode: "3-14", display: "RL 3.14", grup: "RL 3", judul: "Rekapitulasi Kegiatan Pelayanan Khusus",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "sirs_rl314_entry (manual 23 baris) + 4 tabel rawat_jl/inap × jns_perawatan (sugesti EKG/Echo/Endoskopi/HD/Spirometri/Pungsi/Akupunktur/Homecare/IVA)",
    status: "implemented" },
  { kode: "3-15", display: "RL 3.15", grup: "RL 3", judul: "Rekapitulasi Pelayanan Kesehatan Jiwa",
    periode: "Tahunan", sistem: "SIRS Online",
    sumber: "sirs_rl315_entry (manual 8 jenis × L/P) + diagnosa_pasien F00-F99 × pasien.jk (sugesti)",
    status: "implemented" },
  { kode: "3-16", display: "RL 3.16", grup: "RL 3", judul: "Rekapitulasi Pelayanan Keluarga Berencana",
    periode: "Tahunan", sistem: "SIRS Online",
    sumber: "sirs_rl316_entry (manual 8 metode × 7 kolom) + sanity Z30/ICD-9 KB (modul KB Khanza belum aktif)",
    status: "implemented" },
  { kode: "3-17", display: "RL 3.17", grup: "RL 3", judul: "Farmasi RS — Pengadaan Obat",
    periode: "Tahunan", sistem: "SIRS Online",
    sumber: "sirs_rl317_entry (manual 4 golongan) + databarang × kategori_barang (sanity Generik/Non Generik aktif)",
    status: "implemented" },
  { kode: "3-18", display: "RL 3.18", grup: "RL 3", judul: "Farmasi RS — Resep",
    periode: "Tahunan", sistem: "SIRS Online",
    sumber: "sirs_rl318_entry (manual 4×3) + resep_obat × resep_dokter × databarang × reg_periksa (sanity per Ralan/IGD/Ranap × Generik/Non Generik)",
    status: "implemented" },
  { kode: "3-19", display: "RL 3.19", grup: "RL 3", judul: "Rekapitulasi Cara Bayar",
    periode: "Tahunan", sistem: "SIRS Online",
    sumber: "sirs_rl319_entry (manual 11 rows) + reg_periksa × penjab × kamar_inap × periksa_lab/radiologi (auto-mapping kd_pj → JUKNIS row)",
    status: "implemented" },

  // ── RL 4 — Morbiditas Ranap (SIRS Online, bulanan) ───────────────────────
  { kode: "4-1", display: "RL 4.1", grup: "RL 4", judul: "Kompilasi Penyakit / Morbiditas Pasien Rawat Inap",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "diagnosa_pasien (prioritas=1, status=Ranap) × kamar_inap (tgl_keluar, exclude Pindah Kamar) × pasien × penyakit (REALTIME)",
    status: "implemented" },
  { kode: "4-2", display: "RL 4.2", grup: "RL 4", judul: "10 Besar Penyakit Rawat Inap",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "REALTIME dari RL 4.1 (top 10 by Total, exclude O80/O82/R/V/W/X/Y/Z)",
    status: "implemented" },
  { kode: "4-3", display: "RL 4.3", grup: "RL 4", judul: "10 Besar Kematian Penyakit Rawat Inap",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "REALTIME dari RL 4.1 (top 10 by Total Mati DESC, filter total_mati > 0)",
    status: "implemented" },

  // ── RL 5 — Morbiditas Ralan (SIRS Online, bulanan) ───────────────────────
  { kode: "5-1", display: "RL 5.1", grup: "RL 5", judul: "Kompilasi Morbiditas Pasien Rawat Jalan",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "REALTIME diagnosa_pasien (prioritas=1, status=Ralan) × pasien × reg_periksa × penyakit (cells=kasus baru, total=baru+kunjungan)",
    status: "implemented" },
  { kode: "5-2", display: "RL 5.2", grup: "RL 5", judul: "10 Besar Kasus Baru Penyakit Rawat Jalan",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "REALTIME dari RL 5.1 (top 10 by Total Kasus Baru, exclude O80/O82/R/V/W/X/Y/Z)",
    status: "implemented" },
  { kode: "5-3", display: "RL 5.3", grup: "RL 5", judul: "10 Besar Kunjungan Penyakit Rawat Jalan",
    periode: "Bulanan", sistem: "SIRS Online",
    sumber: "REALTIME dari RL 5.1 (top 10 by Total Kunjungan, exclude O80/O82/R/V/W/X/Y/Z)",
    status: "implemented" },
];

export const RL_GROUPS = [
  { key: "RL 1", title: "Identitas Rumah Sakit", system: "RS Online",
    color: "from-blue-500 to-blue-600",
    deskripsi: "Profil, ketersediaan pelayanan, tempat tidur, sarpras & alkes — update saat ada perubahan." },
  { key: "RL 2", title: "Ketenagaan", system: "RS Online",
    color: "from-purple-500 to-purple-600",
    deskripsi: "Data SDM yang bekerja di RS — update saat ada perubahan." },
  { key: "RL 3", title: "Rekapitulasi Kegiatan Pelayanan", system: "SIRS Online",
    color: "from-emerald-500 to-emerald-600",
    deskripsi: "19 sub-formulir kegiatan klinis & farmasi — dilaporkan bulanan / tahunan." },
  { key: "RL 4", title: "Morbiditas Rawat Inap", system: "SIRS Online",
    color: "from-amber-500 to-amber-600",
    deskripsi: "Kompilasi ICD-10 × umur × JK + 10 besar penyakit & kematian — bulanan." },
  { key: "RL 5", title: "Morbiditas Rawat Jalan", system: "SIRS Online",
    color: "from-rose-500 to-rose-600",
    deskripsi: "Kompilasi + 10 besar kasus baru + 10 besar kunjungan — bulanan." },
] as const;

export function formsInGroup(grup: string): RlForm[] {
  return RL_FORMS.filter(f => f.grup === grup);
}

export function findForm(kode: string): RlForm | undefined {
  return RL_FORMS.find(f => f.kode === kode);
}
