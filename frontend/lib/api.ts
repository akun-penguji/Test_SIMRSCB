import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

export const api = axios.create({
  baseURL: API_BASE,
});

// Interceptor: sertakan token dari localStorage di setiap request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("simrscb_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor response: kalau 401 (token expired/invalid), bersihkan session
// dan redirect ke /login agar user tidak terjebak di halaman dengan data kosong.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (typeof window !== "undefined" && err?.response?.status === 401) {
      // Hindari loop saat error 401 datang dari endpoint /auth/login sendiri
      const url: string = err.config?.url || "";
      if (!url.includes("/auth/login")) {
        localStorage.removeItem("simrscb_token");
        localStorage.removeItem("simrscb_session");
        if (!window.location.pathname.startsWith("/login")) {
          const next = window.location.pathname + window.location.search;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
        }
      }
    }
    return Promise.reject(err);
  }
);

// Types
export interface Pasien {
  no_rm: string;
  nm_pasien: string;
  tgl_lahir?: string;
  jk?: string;
  no_ktp?: string;
  alamat?: string;
}

export interface PasienDetail extends Pasien {
  no_tlp?: string;
  agama?: string;
  pendidikan?: string;
  pekerjaan?: string;
  gol_darah?: string;
  tgl_daftar?: string;
  kd_pj?: string;
  nama_pj?: string;
  hub_pj?: string;
  nm_kel?: string;
  nm_kec?: string;
  nm_kab?: string;
  tmp_lahir?: string;
  nm_ibu?: string;
  no_peserta?: string;
  stts_nikah?: string;
  email?: string;
}
// Payload tambah/edit pasien (nama field cocok dengan backend PasienBaru).
export interface PasienInput {
  no_rm?: string; nm_pasien: string; tgl_lahir?: string; jk?: string; tmp_lahir?: string;
  nm_ibu?: string; alamat?: string; no_tlp?: string; no_ktp?: string; no_peserta?: string;
  agama?: string; pendidikan?: string; pekerjaan?: string; gol_darah?: string; stts_nikah?: string;
  email?: string; kd_pj?: string; namakeluarga?: string; keluarga?: string;
}

export interface Registrasi {
  no_rawat: string;
  tgl_registrasi?: string;
  no_rm: string;
  nm_pasien?: string;
  kd_poli?: string;
  nm_poli?: string;
  kd_dokter?: string;
  nm_dokter?: string;
  stts?: string;
  stts_daftar?: string;
  no_reg?: string;
  kd_pj?: string;
  png_jawab?: string;
}

export interface Poli {
  kd_poli: string;
  nm_poli: string;
}

export interface Dokter {
  kd_dokter: string;
  nm_dokter: string;
  kd_poli?: string;
}

export interface Penjab {
  kd_pj: string;
  png_jawab: string;
}

// Auth
export const login = (username: string, password: string, captcha_id: string, captcha: string) =>
  api.post("/auth/login", { username, password, captcha_id, captcha });

export const getCaptcha = () =>
  api.get<{ id: string; image: string }>("/auth/captcha");

// Pasien
export const getPasienList = (q = "", page = 1, size = 20, alamat = "") =>
  api.get<{ data: Pasien[]; total: number; page: number; size: number }>(
    `/pasien?q=${encodeURIComponent(q)}&alamat=${encodeURIComponent(alamat)}&page=${page}&size=${size}`
  );

export const getPasienDetail = (no_rm: string) =>
  api.get<PasienDetail>(`/pasien/${encodeURIComponent(no_rm)}`);

export const tambahPasien = (data: PasienInput) =>
  api.post<{ message: string; no_rm: string }>("/pasien", data);

export const editPasien = (no_rm: string, data: PasienInput) =>
  api.put(`/pasien/${encodeURIComponent(no_rm)}`, data);

// Registrasi
export const getRegistrasiList = (params: {
  tgl?: string; tgl_awal?: string; tgl_akhir?: string;
  poli?: string; dokter?: string; cari?: string;
  page?: number; size?: number;
}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
  return api.get<{ data: Registrasi[]; total: number; page: number; size: number }>(`/registrasi?${p}`);
};

export const getRegistrasiDetail = (no_rawat: string) =>
  api.get<Registrasi>(`/registrasi/${encodeURIComponent(no_rawat)}`);

export const buatRegistrasi = (data: {
  no_rm: string;
  tgl_registrasi: string;
  jam_reg?: string;
  kd_poli: string;
  kd_dokter: string;
  stts_daftar: string;
  kd_pj: string;
  p_jawab?: string;
  almt_pj?: string;
  hubunganpj?: string;
}) => api.post("/registrasi", data);

// Master
export const getPoliList = () => api.get<Poli[]>("/master/poli");
export const getDokterList = (poli = "") =>
  api.get<Dokter[]>(`/master/dokter?poli=${poli}`);
export const getPenjabList = () => api.get<Penjab[]>("/master/penjab");

export interface SettingRS {
  nama_instansi: string;
  alamat_instansi: string;
  kabupaten: string;
  propinsi: string;
  kontak: string;
  email: string;
  website?: string;
}
export const getSetting = () => api.get<SettingRS>("/master/setting");

// Konfigurasi SIMRS CB
export interface SimrscbConfig {
  hosthybridweb_type:   string;   // "local" | "remote"
  hosthybridweb:        string;   // path lokal atau URL PHP companion script
  hosthybridweb_secret: string;   // secret untuk PHP companion script
}
export const getSimrscbConfig  = () => api.get<SimrscbConfig>("/simrscb/config");
export const saveSimrscbConfig = (data: SimrscbConfig) => api.put("/simrscb/config", data);

// Upload foto / TTD surat ke filesystem
export const uploadSuratMedia = (data: {
  jenis:        string;
  no_rawat:     string;
  no_surat?:    string;
  foto_base64?: string;
  ttd_base64?:  string;
  foto_saksi_base64?: string;
  ttd_saksi_base64?:  string;
}) => api.post("/surat/upload", data);

// ── Bukti Penerimaan Pasien (foto + TTD) ────────────────────────────────────
export const getPenerimaanBukti = (no_rawat: string) =>
  api.get<{ ada_foto: boolean; ada_ttd: boolean; updated_at: string | null }>(
    `/penerimaan-ranap/bukti?no_rawat=${encodeURIComponent(no_rawat)}`);
export const getPengantarPulangTtd = (no_rawat: string) =>
  api.get<{ ada_ttd: boolean; updated_at: string | null }>(
    `/pengantar-pulang/ttd?no_rawat=${encodeURIComponent(no_rawat)}`);

// ── AKP 4 — Bukti Serah Terima Resume ke dokter keluarga/berikutnya ──────────
export interface ResumeSerahTerima {
  ada_resume: boolean; diserahkan_ke: string | null; nama_penerima: string | null;
  tanggal: string | null; ada_foto: boolean; ada_ttd: boolean; updated_at: string | null;
}
export const getResumeSerahTerima = (no_rawat: string) =>
  api.get<ResumeSerahTerima>(`/resume-serah-terima?no_rawat=${encodeURIComponent(no_rawat)}`);
export const saveResumeSerahTerima = (b: { no_rawat: string; diserahkan_ke: string; nama_penerima?: string }) =>
  api.post<{ ok: boolean }>("/resume-serah-terima", b);
export interface ResumePulangRow {
  no_rawat: string; no_rkm_medis: string | null; nm_pasien: string | null;
  nm_bangsal: string | null; tgl_keluar: string | null; ada_resume: number;
  diserahkan_ke: string | null; nama_penerima: string | null; tgl_serah: string | null;
  ada_foto: number; ada_ttd: number;
}
export interface ResumeSerahTerimaMonitor {
  ringkasan: {
    total_pulang: number; ada_resume: number; tanpa_resume: number;
    serah_terima_lengkap: number; belum_serah_terima: number;
  };
  pasien: ResumePulangRow[];
}
export const getResumeSerahTerimaMonitor = (f: { dari?: string; sampai?: string } = {}) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v) p.append(k, String(v)); });
  return api.get<ResumeSerahTerimaMonitor>(`/resume-serah-terima/monitor?${p}`);
};

// ── Persetujuan Integrasi SATUSEHAT ─────────────────────────────────────────
export interface PersetujuanSatusehat {
  no_rawat:        string;
  no_rkm_medis:    string;
  persetujuan:     "Setuju" | "Tidak Setuju";
  nip_petugas:     string;
  nama_petugas:    string;
  tgl_persetujuan: string;
}
export const getPersetujuanSatusehat = (no_rawat: string) =>
  api.get<{ data: PersetujuanSatusehat | null }>(
    `/persetujuan-satusehat/${encodeURIComponent(no_rawat)}`
  );
export const simpanPersetujuanSatusehat = (data: {
  no_rawat:      string;
  persetujuan:   "Setuju" | "Tidak Setuju";
  nip_petugas?:  string;
  nama_petugas?: string;
}) => api.post<{ success: boolean; no_rawat: string; persetujuan: string }>(
  "/persetujuan-satusehat", data
);

// ── Persetujuan Umum (General Consent) ───────────────────────────────────────
export interface PersetujuanUmumPrefill {
  no_surat:                  string | null;
  no_rawat:                  string;
  tanggal:                   string | null;
  jam:                       string | null;
  pengobatan_kepada:         string | null;
  nilai_kepercayaan:         string | null;
  nama_pj:                   string | null;
  umur_pj:                   string | null;
  no_ktppj:                  string | null;
  jkpj:                      string | null;
  bertindak_atas:            string | null;
  no_telp:                   string | null;
  nip:                       string | null;
  nama_keluarga_a:           string | null;
  hubungan_pasien_a:         string | null;
  nama_keluarga_b:           string | null;
  hubungan_pasien_b:         string | null;
  nama_keluarga_c:           string | null;
  hubungan_pasien_c:         string | null;
  hubungan_keluarga_a:       string | null;
  detail_hubungan_a:         string | null;
  hubungan_keluarga_b:       string | null;
  detail_hubungan_b:         string | null;
  hubungan_keluarga_c:       string | null;
  detail_hubungan_c:         string | null;
  pilihan_akses_kunjungan:   string | null;
  nama_tidak_diizinkan:      string | null;
  preferensi_perawat:        string | null;
  preferensi_dokter:         string | null;
  nilai_keyakinan:           string | null;
  permintaan_privasi:        string | null;
  kelas_perawatan:           string | null;
  biaya_perkiraan_tindakan:  string | null;
  biaya_administrasi:        string | null;
  biaya_pemeriksaan_penunjang: string | null;
  biaya_farmasi:             string | null;
  biaya_lain_lain:           string | null;
  photo:                     string | null;
  signature_path:            string | null;
  saksi_pasien:              string | null;
  pelayanan_rohani:          string | null;
  pelepasan_informasi:       string | null;
  photo_saksi:               string | null;
  ttd_saksi:                 string | null;
}
export const getPersetujuanUmum = (no_rawat: string) =>
  api.get<{ data: PersetujuanUmumPrefill | null }>(
    `/persetujuan-umum/${encodeURIComponent(no_rawat)}`
  );

export const hapusPersetujuanUmum = (no_rawat: string) =>
  api.delete<{ ok: boolean }>(`/persetujuan-umum/${encodeURIComponent(no_rawat)}`);

export interface PersetujuanUmumListRow {
  no_surat: string;
  no_rawat: string;
  tanggal?: string | null;
  no_rkm_medis?: string | null;
  nm_pasien?: string | null;
  nama_pj?: string | null;
  nip?: string | null;
}
export const getPersetujuanUmumList = (p: { q?: string; tgl_awal?: string; tgl_akhir?: string }) => {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.tgl_awal) sp.set("tgl_awal", p.tgl_awal);
  if (p.tgl_akhir) sp.set("tgl_akhir", p.tgl_akhir);
  return api.get<{ ok: boolean; jumlah: number; data: PersetujuanUmumListRow[] }>(`/persetujuan-umum?${sp}`);
};

// ── Daftar tersimpan: Surat (no_surat) + Edukasi ─────────────────────────────
export interface SuratTersimpanRow {
  no_surat: string;
  no_rawat: string;
  tanggal?: string | null;
  no_rkm_medis?: string | null;
  nm_pasien?: string | null;
  nama_pj?: string | null;
  nip?: string | null;
}
export interface EdukasiTersimpanRow {
  no_rawat: string;
  tanggal?: string | null;
  no_rkm_medis?: string | null;
  nm_pasien?: string | null;
  nama_petugas?: string | null;
}
const listQs = (p: { q?: string; tgl_awal?: string; tgl_akhir?: string }) => {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.tgl_awal) sp.set("tgl_awal", p.tgl_awal);
  if (p.tgl_akhir) sp.set("tgl_akhir", p.tgl_akhir);
  return sp.toString();
};
export const getHakKewajibanList = (p: { q?: string; tgl_awal?: string; tgl_akhir?: string }) =>
  api.get<{ ok: boolean; jumlah: number; data: SuratTersimpanRow[] }>(`/hak-kewajiban?${listQs(p)}`);
export const getPernyataanJaminanList = (p: { q?: string; tgl_awal?: string; tgl_akhir?: string }) =>
  api.get<{ ok: boolean; jumlah: number; data: SuratTersimpanRow[] }>(`/pernyataan-jaminan?${listQs(p)}`);
export const getEdukasiList = (p: { q?: string; tgl_awal?: string; tgl_akhir?: string }) =>
  api.get<{ ok: boolean; jumlah: number; data: EdukasiTersimpanRow[] }>(`/edukasi-pasien?${listQs(p)}`);

export interface SimpanPersetujuanUmumBody {
  no_surat?:                 string;
  no_rawat:                  string;
  tanggal?:                  string;
  jam?:                      string;
  pengobatan_kepada?:        string;
  nilai_kepercayaan?:        string;
  nama_pj:                   string;
  umur_pj:                   string;
  no_ktppj:                  string;
  jkpj:                      string;
  bertindak_atas:            string;
  no_telp:                   string;
  nip:                       string;
  nama_keluarga_a?:          string;
  hubungan_pasien_a?:        string;
  nama_keluarga_b?:          string;
  hubungan_pasien_b?:        string;
  nama_keluarga_c?:          string;
  hubungan_pasien_c?:        string;
  hubungan_keluarga_a?:      string;
  detail_hubungan_a?:        string;
  hubungan_keluarga_b?:      string;
  detail_hubungan_b?:        string;
  hubungan_keluarga_c?:      string;
  detail_hubungan_c?:        string;
  pilihan_akses_kunjungan?:  string;
  nama_tidak_diizinkan?:     string;
  preferensi_perawat?:       string;
  preferensi_dokter?:        string;
  nilai_keyakinan?:          string;
  permintaan_privasi?:       string;
  kelas_perawatan?:          string;
  biaya_perkiraan_tindakan?: string;
  biaya_administrasi?:       string;
  biaya_pemeriksaan_penunjang?: string;
  biaya_farmasi?:            string;
  biaya_lain_lain?:          string;
  saksi_pasien?:             string;
  pelayanan_rohani?:         string;
  pelepasan_informasi?:      string;
}
export const simpanPersetujuanUmum = (data: SimpanPersetujuanUmumBody) =>
  api.post<{ success: boolean; no_surat: string; tanggal: string }>(
    "/persetujuan-umum", data
  );

// Fetch HTML printable, buka di tab baru via blob URL
// ── Simpan generik surat pernyataan (7 jenis: masuk_unit, jaminan_umum, titip_kelas,
//    jamkesda, bersedia_igd, persetujuan_penolakan, pulang_aps) ──────────────────
export const getSuratPernyataan = (no_rawat: string, jenis: string) =>
  api.get<{ no_surat: string | null; tanggal: string | null; data: string | null }>(
    `/surat/pernyataan?no_rawat=${encodeURIComponent(no_rawat)}&jenis=${encodeURIComponent(jenis)}`
  );
export const simpanSuratPernyataan = (b: {
  no_rawat: string; jenis: string; tanggal?: string; no_surat?: string; data: string;
}) => api.post<{ success: boolean; no_surat: string }>("/surat/pernyataan", b);

export const cetakPersetujuanUmum = async (no_rawat: string) => {
  const res = await api.get<string>(
    `/persetujuan-umum/${encodeURIComponent(no_rawat)}/cetak`,
    { responseType: "text", headers: { Accept: "text/html" } }
  );
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── Pernyataan Jaminan Pasien ───────────────────────────────────────────────
export interface PernyataanJaminanPrefill {
  no_surat:          string | null;
  no_rawat:          string;
  tanggal:           string | null;
  nama_pj:           string | null;
  no_ktppj:          string | null;
  tempat_lahirpj:    string | null;
  lahirpj:           string | null;
  jkpj:              string | null;
  alamatpj:          string | null;
  hubungan:          string | null;
  no_telp:           string | null;
  nip:               string | null;
  kd_pj:             string | null;
  png_jawab:         string | null;
  penyakit_diderita: string | null;
  photo:             string | null;
  signature_path:    string | null;
  status_jaminan:    string | null;
  jenis_jaminan:     string | null;
}
export const getPernyataanJaminan = (no_rawat: string) =>
  api.get<{ data: PernyataanJaminanPrefill | null }>(
    `/pernyataan-jaminan/${encodeURIComponent(no_rawat)}`
  );

export interface SimpanPernyataanJaminanBody {
  no_surat?:          string;
  no_rawat:           string;
  tanggal?:           string;
  nama_pj:            string;
  no_ktppj:           string;
  tempat_lahirpj:     string;
  lahirpj:            string;
  jkpj:               string;
  alamatpj:           string;
  hubungan:           string;
  no_telp:            string;
  nip:                string;
  kd_pj:              string;
  penyakit_diderita?: string;
  status_jaminan?:    string;
  jenis_jaminan?:     string;
}
export const simpanPernyataanJaminan = (data: SimpanPernyataanJaminanBody) =>
  api.post<{ success: boolean; no_surat: string; tanggal: string }>(
    "/pernyataan-jaminan", data
  );

export const cetakPernyataanJaminan = async (no_rawat: string) => {
  const res = await api.get<string>(
    `/pernyataan-jaminan/${encodeURIComponent(no_rawat)}/cetak`,
    { responseType: "text", headers: { Accept: "text/html" } }
  );
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── Hak & Kewajiban Pasien ──────────────────────────────────────────────────
export interface HakKewajibanPrefill {
  no_surat: string | null;
  no_rawat: string;
  tanggal: string | null;
  jam: string | null;
  pengobatan_kepada: string | null;
  nama_pj: string | null;
  umur_pj: string | null;
  no_ktppj: string | null;
  jkpj: string | null;
  bertindak_atas: string | null;
  no_telp: string | null;
  nip: string | null;
  photo: string | null;
  tandatangan: string | null;
  keterangan_tambahan: string | null;
  persetujuan_khusus: string | null;
  catatan_petugas: string | null;
  status_persetujuan: string | null;
}
export const getHakKewajiban = (no_rawat: string) =>
  api.get<{ data: HakKewajibanPrefill | null }>(
    `/hak-kewajiban/${encodeURIComponent(no_rawat)}`
  );

export interface SimpanHakKewajibanBody {
  no_surat?: string;
  no_rawat: string;
  tanggal?: string;
  jam?: string;
  pengobatan_kepada?: string;
  nama_pj: string;
  umur_pj: string;
  no_ktppj: string;
  jkpj: string;
  bertindak_atas: string;
  no_telp: string;
  nip: string;
  keterangan_tambahan?: string;
  persetujuan_khusus?: string;
  catatan_petugas?: string;
  status_persetujuan?: string;
}
export const simpanHakKewajiban = (data: SimpanHakKewajibanBody) =>
  api.post<{ success: boolean; no_surat: string; tanggal: string }>(
    "/hak-kewajiban", data
  );
export const cetakHakKewajiban = async (no_rawat: string) => {
  const res = await api.get<string>(
    `/hak-kewajiban/${encodeURIComponent(no_rawat)}/cetak`,
    { responseType: "text", headers: { Accept: "text/html" } }
  );
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── Edukasi Pasien & Keluarga Terintegrasi ──────────────────────────────────
export interface EdukasiPasienData {
  no_rawat: string;
  tanggal: string | null;
  nip: string | null;
  nama_petugas: string | null;
  tinggal_bersama: string | null;
  hambatan: string | null;
  hambatan_pendengaran: string | null;
  hambatan_emosi: string | null;
  hambatan_penglihatan: string | null;
  hambatan_bicara: string | null;
  motivasi_kurang: string | null;
  memori_hilang: string | null;
  fisik_lemah: string | null;
  alkoholik: string | null;
  tidak_mampu_belajar: string | null;
  perokok: string | null;
  edukasi_kepada: string | null;
  kemampuan_bahasa: string | null;
  bahasa_daerah: string | null;
  bahasa_asing: string | null;
  perlu_penerjemah: string | null;
  baca_tulis: string | null;
  kepercayaan_lainnya: string | null;
  kesediaan_menerima_edukasi: string | null;
  cara_edukasi: string | null;
  keb_partisipasi: string | null;
  keb_penunjang: string | null;
  keb_kondisi: string | null;
  keb_informed_concent: string | null;
  keb_diet: string | null;
  keb_obat: string | null;
  keb_alat_medis: string | null;
  keb_nyeri: string | null;
  keb_rehabilitasi: string | null;
  keb_cuci_tangan: string | null;
  keb_merokok: string | null;
  keb_lain_lain: string | null;
  keb_rujukan: string | null;
}
export const getEdukasiPasien = (no_rawat: string) =>
  api.get<{ data: EdukasiPasienData | null }>(
    `/edukasi-pasien/${encodeURIComponent(no_rawat)}`
  );
export const simpanEdukasiPasien = (data: Partial<EdukasiPasienData> & { no_rawat: string; nip: string }) =>
  api.post<{ success: boolean; no_rawat: string }>("/edukasi-pasien", data);

// ── Materi (pelaksanaan) Edukasi ────────────────────────────────────────────
export interface MateriEdukasiRow {
  no_rawat: string;
  tanggal: string;
  jam: string;
  diberikan_pada: string | null;
  penerima_edukasi: string | null;
  profesi: string | null;
  materi_edukasi: string | null;
  kode_leaflet: string | null;
  lama_edukasi: string | null;
  hasil_verifikasi: string | null;
  nip: string | null;
  nama_petugas: string | null;
}
export interface MateriEdukasiTtd {
  no_rawat: string;
  tanggal: string;
  jam: string;
  url_image: string;
}
export const getMateriEdukasi = (no_rawat: string) =>
  api.get<{ data: MateriEdukasiRow[]; ttd: MateriEdukasiTtd[] }>(
    `/edukasi-pasien/${encodeURIComponent(no_rawat)}/materi`
  );

export interface SimpanMateriEdukasiBody {
  no_rawat: string;
  tanggal: string;            // YYYY-MM-DD
  jam: string;                // HH:MM:SS
  diberikan_pada?: string;
  penerima_edukasi?: string;
  profesi?: string;
  materi_edukasi: string;
  kode_leaflet?: string;
  lama_edukasi?: string;
  hasil_verifikasi?: string;
  nip: string;
}
export const simpanMateriEdukasi = (no_rawat: string, data: SimpanMateriEdukasiBody) =>
  api.post<{ success: boolean; no_rawat: string; tanggal: string; jam: string }>(
    `/edukasi-pasien/${encodeURIComponent(no_rawat)}/materi`, data
  );
export const hapusMateriEdukasi = (no_rawat: string, tanggal: string, jam: string) =>
  api.delete<{ success: boolean }>(
    `/edukasi-pasien/${encodeURIComponent(no_rawat)}/materi/${encodeURIComponent(tanggal)}/${encodeURIComponent(jam)}`
  );
export const cetakMateriEdukasi = async (no_rawat: string) => {
  const res = await api.get<string>(
    `/edukasi-pasien/${encodeURIComponent(no_rawat)}/materi/cetak`,
    { responseType: "text", headers: { Accept: "text/html" } }
  );
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardStats {
  kunjungan_hari_ini: number;
  pasien_baru:        number;
  total_pasien:       number;
  pasien_ranap:       number;
  kunjungan_7_hari:   { tgl: string; jumlah: number }[];
  kunjungan_per_poli: { nm_poli: string; jumlah: number }[];
  jaminan:            { png_jawab: string; jumlah: number }[];
}
export const getDashboardStats = () => api.get<DashboardStats>("/dashboard/stats");

// ── Rawat Jalan ──────────────────────────────────────────────────────────────
export interface RawatJalan {
  no_rawat:       string;
  tgl_registrasi?: string;
  jam_reg?:       string;
  no_rm:          string;
  nm_pasien?:     string;
  umur?:          string;
  no_tlp?:        string;
  kd_dokter?:     string;
  nm_dokter?:     string;
  kd_poli?:       string;
  nm_poli?:       string;
  kd_pj?:         string;
  png_jawab?:     string;
  p_jawab?:       string;
  almt_pj?:       string;
  hubunganpj?:    string;
  biaya_reg?:     number;
  stts?:          string;
  stts_daftar?:   string;
  status_bayar?:  string;
  status_poli?:   string;
  no_reg?:        string;
}
export const getRawatJalanList = (params: {
  tgl_awal?: string; tgl_akhir?: string; poli?: string; dokter?: string; cari?: string;
  status?: string; status_bayar?: string; page?: number; size?: number;
}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
  return api.get<{ data: RawatJalan[]; total: number; page: number; size: number }>(`/rawat-jalan?${p}`);
};

// ── Rawat Inap (daftar — port DlgKamarInap) ──────────────────────────────────
export interface RanapRow {
  no_rawat:      string;
  no_rm?:        string;
  nm_pasien?:    string;
  umur?:         string;
  kd_kamar?:     string;
  nm_bangsal?:   string;
  kelas?:        string;
  tgl_masuk?:    string;
  jam_masuk?:    string;
  tgl_keluar?:   string;
  jam_keluar?:   string;
  lama?:         number;
  diagnosa_awal?: string;
  nm_dokter?:    string;
  png_jawab?:    string;
  status_bayar?: string;
  stts_pulang?:  string;
  ttl_biaya?:    number;
}
export const getRawatInapList = (params: {
  tgl_awal?: string; tgl_akhir?: string; status_bayar?: string; status_pulang?: string;
  bangsal?: string; cari?: string; page?: number; size?: number;
}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
  return api.get<{ data: RanapRow[]; total: number; page: number; size: number }>(`/rawat-inap?${p}`);
};

// ── Booking Operasi (daftar — port DlgBookingOperasi) ────────────────────────
export interface BookingOpRow {
  no_rawat:    string;
  no_rm?:      string;
  nm_pasien?:  string;
  umur?:       string;
  jk?:         string;
  tanggal?:    string;
  jam_mulai?:  string;
  jam_selesai?: string;
  operasi?:    string;
  kode_paket?: string;
  kd_dokter?:  string;
  operator?:   string;
  kd_ruang_ok?: string;
  ruang_ok?:   string;
  order_rawat?: string;
  status?:     string;
}
export const getBookingOperasiList = (params: {
  mode?: string; tgl_awal?: string; tgl_akhir?: string; cari?: string; page?: number; size?: number;
}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
  return api.get<{ data: BookingOpRow[]; total: number; page: number; size: number }>(`/booking-operasi?${p}`);
};

// ── IGD ──────────────────────────────────────────────────────────────────────
export interface IgdRow {
  no_rawat:       string;
  no_reg?:        string;
  tgl_registrasi?: string;
  jam_reg?:       string;
  no_rm:          string;
  nm_pasien?:     string;
  jk?:            string;
  tgl_lahir?:     string;
  kd_dokter?:     string;
  nm_dokter?:     string;
  png_jawab?:     string;
  hubunganpj?:    string;
  kd_pj?:         string;
  penjab_nama?:   string;
  stts?:          string;
  stts_daftar?:   string;
  status_bayar?:  string;
}
export const getIgdList = (params: {
  tgl_awal?: string; tgl_akhir?: string; cari?: string;
  status?: string; page?: number; size?: number;
}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
  return api.get<{ data: IgdRow[]; total: number; page: number; size: number }>(`/igd?${p}`);
};

// ── IGD Registrasi (port DlgIGD Fase 1) ──────────────────────────────────────
export interface IgdPasien {
  no_rm: string;
  nm_pasien: string;
  jk?: string | null;
  tgl_lahir?: string | null;
  alamat?: string | null;
  no_tlp?: string | null;
  nama_pj?: string | null;
  hub_pj?: string | null;
  kd_pj_default?: string | null;
}
export const igdCariPasien = (q: string) =>
  api.get<{ ok: boolean; data: IgdPasien[] }>(`/igd/cari-pasien?q=${encodeURIComponent(q)}`);
export const igdListDokter = () =>
  api.get<{ kd_dokter: string; nm_dokter: string }[]>(`/igd/dokter`);
export const igdListPenjab = () =>
  api.get<{ kd_pj: string; png_jawab: string }[]>(`/igd/penjab`);
export interface IgdRegBody {
  no_rm: string; kd_dokter: string; kd_pj: string;
  p_jawab?: string; almt_pj?: string; hubunganpj?: string;
  tgl_registrasi?: string; jam_reg?: string;
}
export const igdRegistrasi = (b: IgdRegBody) =>
  api.post<{ ok: boolean; no_rawat: string; no_reg: string; stts_daftar: string; status_poli: string; biaya_reg: number; message: string }>(`/igd/registrasi`, b);
export const igdEdit = (b: { no_rawat: string; kd_dokter: string; kd_pj: string; p_jawab?: string; almt_pj?: string; hubunganpj?: string }) =>
  api.put<{ ok: boolean; message: string }>(`/igd/edit`, b);
export const igdHapus = (no_rawat: string) =>
  api.delete<{ ok: boolean; message: string }>(`/igd/hapus?no_rawat=${encodeURIComponent(no_rawat)}`);

// ── Kasir Rawat Jalan ────────────────────────────────────────────────────────
export interface KasirRalan {
  no_rawat:       string;
  tgl_registrasi?: string;
  jam_reg?:       string;
  no_reg?:        string;
  no_rm:          string;
  nm_pasien?:     string;
  no_tlp?:        string;
  kd_dokter?:     string;
  nm_dokter?:     string;
  kd_poli?:       string;
  nm_poli?:       string;
  kd_pj?:         string;
  png_jawab?:     string;
  p_jawab?:       string;
  almt_pj?:       string;
  hubunganpj?:    string;
  biaya_reg?:     number;
  stts?:          string;
  stts_daftar?:   string;
  status_bayar?:  string;
  status_poli?:   string;
}
export const getKasirRalanList = (params: {
  tgl_awal?: string; tgl_akhir?: string; status_periksa?: string;
  status_bayar?: string; poli?: string; dokter?: string;
  cari?: string; page?: number; size?: number;
}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
  return api.get<{ data: KasirRalan[]; total: number; page: number; size: number }>(`/kasir/ralan?${p}`);
};

// ── Farmasi ──────────────────────────────────────────────────────────────────
export interface ResepRow {
  no_resep:      string;
  tgl_peresepan?: string;
  jam_peresepan?: string;
  no_rawat?:     string;
  no_rm?:        string;
  nm_pasien?:    string;
  nm_dokter?:    string;
  kd_pj?:        string;
  png_jawab?:    string;
  status?:       string;
}
export const getFarmasiResep = (params: {
  tgl_awal?: string; tgl_akhir?: string; cari?: string; page?: number; size?: number;
}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
  return api.get<{ data: ResepRow[]; total: number; page: number; size: number }>(`/farmasi/resep?${p}`);
};

// ── Laboratorium ─────────────────────────────────────────────────────────────
export interface LabRow {
  no_rawat:      string;
  no_rm:         string;
  nm_pasien?:    string;
  tgl_lahir?:    string;
  jk?:           string;
  tgl_periksa:   string;
  jam_periksa?:  string;
  nm_dokter?:    string;
  dokter_pengirim?: string;
  kd_pj?:        string;
  png_jawab?:    string;
  status?:       string;
  status_lanjut?: string;
}
export const getLabList = (params: {
  tgl_awal?: string; tgl_akhir?: string; cari?: string;
  jenis?: string; page?: number; size?: number;
}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
  return api.get<{ data: LabRow[]; total: number; page: number; size: number }>(`/laboratorium?${p}`);
};

// ── BPJS / SEP ───────────────────────────────────────────────────────────────
export interface SepRow {
  no_sep?:          string;
  no_rawat:         string;
  no_rm?:           string;
  nm_pasien?:       string;
  tgl_sep?:         string;
  tgl_rujuk?:       string;
  no_rujukan?:      string;
  nm_ppk?:          string;
  jenis_rawat?:     string;
  kls_rawat?:       string;
  kd_diagnosa?:     string;
  nm_diagnosa?:     string;
  nm_poli?:         string;
  no_kartu?:        string;
  nm_peserta?:      string;
  nm_dpjp?:         string;
  tujuan_kunjungan?: string;
  status_pulang?:   string;
  tgl_pulang?:      string;
}
export const getSepList = (params: {
  tgl_awal?: string; tgl_akhir?: string; cari?: string; page?: number; size?: number;
}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
  return api.get<{ data: SepRow[]; total: number; page: number; size: number }>(`/bpjs/sep?${p}`);
};

// ── Kepegawaian ───────────────────────────────────────────────────────────────
export interface PegawaiRow {
  nip?:           string;
  nama?:          string;
  jenis_kelamin?: string;
  jabatan?:       string;
  bagian?:        string;
  tmp_lahir?:     string;
  tgl_lahir?:     string;
  tgl_masuk?:     string;
  no_ktp?:        string;
  pendidikan_terakhir?: string;
  no_tlp?:        string;
  status_aktif?:  string;
}
export interface JadwalRow {
  nip?:       string;
  nama?:      string;
  bagian?:    string;
  tgl_kerja?: string;
  jam_masuk?: string;
  jam_keluar?: string;
  keterangan?: string;
}
export const getPegawaiList = (params: {
  cari?: string; status_aktif?: string; page?: number; size?: number;
}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
  return api.get<{ data: PegawaiRow[]; total: number; page: number; size: number }>(`/kepegawaian/pegawai?${p}`);
};
export const getJadwalList = (params: { tgl?: string; cari?: string }) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
  return api.get<{ data: JadwalRow[]; total: number; page: number; size: number }>(`/kepegawaian/jadwal?${p}`);
};

// ── Laporan ───────────────────────────────────────────────────────────────────
export interface LaporanKunjungan {
  per_hari:    { tgl: string; baru: number; lama: number; total: number; sudah: number; batal: number }[];
  per_poli:    { nm_poli: string; baru: number; lama: number; total: number }[];
  per_jaminan: { png_jawab: string; baru: number; lama: number; total: number }[];
  grand_total: number;
}
export const getLaporanKunjunganRalan = (params: { tgl_awal: string; tgl_akhir: string }) =>
  api.get<LaporanKunjungan>(`/laporan/kunjungan-ralan?tgl_awal=${params.tgl_awal}&tgl_akhir=${params.tgl_akhir}`);
export const getLaporanKunjunganIgd = (params: { tgl_awal: string; tgl_akhir: string }) =>
  api.get<LaporanKunjungan>(`/laporan/kunjungan-igd?tgl_awal=${params.tgl_awal}&tgl_akhir=${params.tgl_akhir}`);

// Anjungan — Tiket antrian
export interface TiketAntrian {
  prefix: string;
  nomor: string;
  jam:   string;
  sisa:  number;
}
export interface StatusAntrian {
  nomor_terakhir: string;
  sisa:           number;
  per_layanan?:   RekapLayanan[];
}
export const ambilTiketAntrian = (prefix?: string) =>
  api.post<TiketAntrian>("/anjungan/tiket", prefix ? { prefix } : {});
export const getStatusAntrian = (prefix?: string) =>
  api.get<StatusAntrian>("/anjungan/tiket/status", prefix ? { params: { prefix } } : undefined);

export interface Panggilan {
  /** Prefix layanan: A=Pasien Baru, B=Rawat Jalan, C=Poli Rawat Inap. "" utk data lama. */
  prefix?: string;
  nomor: string;
  loket: string;
  jam:   string;
}
/** Rekap satu layanan (prefix) hari ini. */
export interface RekapLayanan {
  prefix:         string;
  nomor_terakhir: number;
  menunggu:       number;
}
export interface DisplayAntrian {
  sekarang: Panggilan | null;
  riwayat:  Panggilan[];
  /** Total seluruh layanan. */
  menunggu: number;
  /** Rincian per layanan A/B/C — selalu 3 entri walau nol. */
  per_layanan?: RekapLayanan[];
}
export const getDisplayAntrian = () =>
  api.get<DisplayAntrian>("/display/pendaftaran");

// SSE stream URL untuk push panggilan real-time
export const DISPLAY_STREAM_URL = `${API_BASE}/display/stream/pendaftaran`;

// ── Display antrian farmasi (penyerahan obat) ────────────────────────────────
export interface PanggilanFarmasi {
  no_resep:     string;
  no_rawat:     string;
  no_rkm_medis: string;
  nama:         string;
  jam:          string;
  jenis?:       string; // hanya di event SSE: "penyerahan" | "validasi"
  racikan?:     number; // 1 = racikan, 0 = non-racikan
}
export interface DisplayFarmasi {
  sekarang:      PanggilanFarmasi | null;
  riwayat:       PanggilanFarmasi[];
  menunggu:      number;
  menunggu_list: PanggilanFarmasi[];
}
export const getDisplayFarmasi = () =>
  api.get<DisplayFarmasi>("/display/farmasi");
export const FARMASI_STREAM_URL = `${API_BASE}/display/stream/farmasi`;

export interface FarmasiDisplayConfig {
  youtube: string;
  ticker:  string;
  loket:   string;
}
export const getFarmasiDisplayConfig = () =>
  api.get<FarmasiDisplayConfig>("/display/farmasi/config");
export const putFarmasiDisplayConfig = (b: Partial<FarmasiDisplayConfig>) =>
  api.put<{ ok: boolean }>("/anjungan/farmasi/config", b);

// Self-service ambil tiket antrian farmasi (no tiket = 4 digit belakang no_resep)
export interface TiketFarmasi {
  no_antrian: string; no_resep: string; no_rkm_medis: string; nama: string;
  nm_poli: string; nm_dokter: string; tanggal: string; jam: string;
}
export const ambilTiketFarmasi = (jenis: "rm" | "ktp" | "bpjs", nilai: string) =>
  api.post<TiketFarmasi>("/anjungan/farmasi/tiket", { jenis, nilai });

// Display antrian pendaftaran (loket) — youtube, ticker, keterangan loket
export interface PendaftaranDisplayConfig {
  youtube: string;
  ticker:  string;
  loket:   string; // format "1:Pendaftaran Pasien Baru|2:Rawat Jalan|3:Poli Rawat Inap"
}
export const getPendaftaranDisplayConfig = () =>
  api.get<PendaftaranDisplayConfig>("/display/pendaftaran/config");
export const putPendaftaranDisplayConfig = (b: Partial<PendaftaranDisplayConfig>) =>
  api.put<{ ok: boolean }>("/anjungan/pendaftaran/config", b);

// Display jadwal praktek dokter (grid mingguan)
export interface JadwalDokterRow {
  kd_dokter:   string;
  nm_dokter:   string;
  kd_poli:     string;
  nm_poli:     string;
  hari_kerja:  string; // SENIN..SABTU, AKHAD (Minggu)
  jam_mulai:   string | null;
  jam_selesai: string | null;
  kuota:       number | null;
}
export const getJadwalDokterDisplay = () =>
  api.get<JadwalDokterRow[]>("/display/jadwal-dokter");

// ── Display antrian masuk poli ───────────────────────────────────────────────
export interface PanggilanPoli {
  no_rawat:     string;
  no_rkm_medis: string;
  nama:         string;
  no_reg:       string;
  kd_poli:      string;
  nm_poli:      string;
  kd_dokter:    string;
  nm_dokter:    string;
  jam:          string;
}
export interface PoliAntri {
  no_rawat:     string;
  no_rkm_medis: string;
  nama:         string;
  no_reg:       string;
}
export interface DisplayPoli {
  nm_poli:       string;
  sekarang:      PoliAntri | null;
  menunggu:      number;
  menunggu_list: PoliAntri[];
}
export const getDisplayPoli = (kd_poli: string) =>
  api.get<DisplayPoli>(`/display/poli/${encodeURIComponent(kd_poli)}`);
export const POLI_STREAM_URL = `${API_BASE}/display/stream/poli`;

// Mapping display poli (banyak display, tiap display punya set poli)
export interface PoliDisplayMap {
  id:       string;
  nama:     string;
  poli:     string[];
  youtube?: string;
  ticker?:  string;
}
export const getPoliDisplayMap = () =>
  api.get<PoliDisplayMap[]>("/display/poli-map");
export const putPoliDisplayMap = (map: PoliDisplayMap[]) =>
  api.put<{ ok: boolean }>("/anjungan/poli/map", { map });

// ── Anjungan Admin: pause toggle + activity log ──────────────────────────────
export interface AnjunganConfig {
  aktif:           boolean;
  maintenance_msg: string;
}
export const getAnjunganConfig = () =>
  api.get<AnjunganConfig>("/anjungan/config");
export const putAnjunganConfig = (b: { aktif?: boolean; maintenance_msg?: string }) =>
  api.put<{ ok: boolean }>("/anjungan/config", b);

export interface AnjunganLogRow {
  id:            number;
  waktu:         string;
  modul:         string;
  action:        string;
  nik:           string | null;
  no_kartu:      string | null;
  no_rkm_medis:  string | null;
  no_rawat:      string | null;
  no_reg:        string | null;
  no_sep:        string | null;
  sukses:        number;
  error_message: string | null;
  user_kode:     string | null;
}
export const listAnjunganLog = (q: {
  modul?:  string; action?: string;
  sukses?: boolean; tgl?: string; q?: string; limit?: number;
}) => {
  const sp = new URLSearchParams();
  Object.entries(q).forEach(([k,v]) => {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  });
  return api.get<AnjunganLogRow[]>(`/anjungan/log?${sp.toString()}`);
};

export interface AnjunganLogStats {
  tgl:        string;
  total:      number;
  sukses:     number;
  gagal:      number;
  per_modul:  Array<{ name: string; total: number }>;
  per_action: Array<{ name: string; total: number }>;
  per_jam:    Array<{ jam: number; total: number }>;
}
export const getAnjunganLogStats = (tgl?: string) =>
  api.get<AnjunganLogStats>(`/anjungan/log/stats${tgl ? `?tgl=${tgl}` : ""}`);

// ── Anjungan: Pendaftaran Walk-In (Non BPJS) ─────────────────────────────────
export interface AnjunganPasien {
  no_rkm_medis: string;
  nm_pasien:    string;
  no_ktp:       string | null;
  jk:           "L" | "P";
  tgl_lahir:    string | null;
  alamat:       string | null;
  no_tlp:       string | null;
  umur:         string | null;
  nm_kel:       string | null;
  nm_kec:       string | null;
  nm_kab:       string | null;
  pekerjaan:    string | null;
  agama:        string | null;
  namakeluarga: string | null;
  keluarga:     string | null;
  stts_nikah:   string | null;
}
export interface AnjunganCariResp {
  ok:      boolean;
  found:   boolean;
  pasien?: AnjunganPasien;
  message?: string;
}
export interface AnjunganPoli {
  kd_poli:        string;
  nm_poli:        string;
  registrasi:     number;
  registrasilama: number;
}
export interface AnjunganDokter {
  kd_dokter:    string;
  nm_dokter:    string;
  jam_mulai:    string | null;
  jam_selesai:  string | null;
  kuota:        number;
  terisi:       number;
}
export interface AnjunganDaftarResp {
  no_rawat:     string;
  no_reg:       string;
  no_rkm_medis: string;
  nama_pasien:  string;
  kd_poli:      string;
  nm_poli:      string;
  kd_dokter:    string;
  nm_dokter:    string;
  tanggal:      string;
  jam:          string;
  biaya_reg:    number;
  status_poli:  "Lama" | "Baru";
  stts_daftar:  "Lama" | "Baru";
}
export const anjunganCariPasien = (q: { no_ktp?: string; no_rkm_medis?: string }) =>
  api.post<AnjunganCariResp>("/anjungan/walk-in/cari", q);
export const anjunganListPoli = () =>
  api.get<AnjunganPoli[]>("/anjungan/walk-in/poli");
export const anjunganListDokter = (kd_poli: string) =>
  api.get<AnjunganDokter[]>(`/anjungan/walk-in/dokter?kd_poli=${encodeURIComponent(kd_poli)}`);
export const anjunganDaftarWalkIn = (b: {
  no_rkm_medis: string;
  kd_poli: string;
  kd_dokter: string;
  p_jawab?: string | null;
  almt_pj?: string | null;
  hubunganpj?: string | null;
  kd_pj?: string;  // default A01 UMUM; untuk BPJS kirim "BPJ" (backend menormalkan A02/BPJ)
}) => api.post<AnjunganDaftarResp>("/anjungan/walk-in/daftar", b);

// ── Anjungan BPJS (Pendaftaran Rujukan Baru) ────────────────────────────────
export const anjunganBpjsStatus = () =>
  api.get<{ configured: boolean; cons_id: string; vclaim_url: string }>(`/anjungan/bpjs/status`);
export const anjunganBpjsCekPeserta = (q: { nik?: string; nokartu?: string; tgl?: string }) => {
  const sp = new URLSearchParams();
  if (q.nik) sp.set("nik", q.nik);
  if (q.nokartu) sp.set("nokartu", q.nokartu);
  if (q.tgl) sp.set("tgl", q.tgl);
  return api.get<{ ok: boolean; tgl_sep: string; peserta: { peserta: AnjunganBpjsPeserta } }>(
    `/anjungan/bpjs/peserta?${sp}`);
};
export const anjunganBpjsListRujukan = (nokartu: string) =>
  api.get<{ ok: boolean; rujukan: { asalFaskes: string; rujukan: AnjunganBpjsRujukan | AnjunganBpjsRujukan[] | null } }>(
    `/anjungan/bpjs/rujukan/list?nokartu=${encodeURIComponent(nokartu)}`);
export const anjunganBpjsCariLokal = (q: { nik?: string; no_kartu?: string }) => {
  const sp = new URLSearchParams();
  if (q.nik) sp.set("nik", q.nik);
  if (q.no_kartu) sp.set("no_kartu", q.no_kartu);
  return api.get<{ ok: boolean; found: boolean; no_rkm_medis?: string; nm_pasien?: string; jk?: string; message?: string }>(
    `/anjungan/bpjs/cari-lokal?${sp}`);
};
export const anjunganBpjsMapingPoli = (kd_poli_bpjs: string) =>
  api.get<{ ok: boolean; found: boolean; kd_poli_rs?: string; nm_poli?: string }>(
    `/anjungan/bpjs/maping-poli?kd_poli_bpjs=${encodeURIComponent(kd_poli_bpjs)}`);

// Create SEP — POST /SEP/2.0/insert + INSERT bridging_sep
export interface CreateSepBody {
  /** epoch ms saat pasien memasukkan nomor kartu (task 1 Mobile JKN) */
  waktu_task1?: number;
  /** epoch ms saat lembar SEP terbuka (task 2 Mobile JKN) */
  waktu_task2?: number;
  no_rawat:        string;
  no_kartu:        string;
  no_rkm_medis:    string;
  nama_pasien:     string;
  tgl_lahir?:      string;
  jk?:             string;
  no_telp?:        string;
  peserta?:        string;
  hak_kelas?:      string;
  asal_rujukan?:   string;
  tgl_rujukan:     string;
  no_rujukan:      string;
  kd_ppk_rujukan:  string;
  nm_ppk_rujukan:  string;
  diag_kode:       string;
  diag_nama:       string;
  kd_poli_bpjs:    string;
  nm_poli_bpjs:    string;
  kd_poli_rs:      string;
  kd_dokter_rs:    string;
  jns_pelayanan?:  "1" | "2";
  catatan?:        string;
}
export interface CreateSepResp {
  no_sep:       string;
  no_rawat:     string;
  no_rujukan:   string;
  tgl_sep:      string;
  meta_message: string;
}
export const anjunganBpjsCreateSep = (b: CreateSepBody) =>
  api.post<CreateSepResp>("/anjungan/bpjs/sep", b);

// ── Anjungan BPJS Kontrol (Surat Kontrol RS / SKDP) ──────────────────────────
export interface SuratKontrolInfo {
  no_surat:        string;
  no_sep_asal:     string;
  tgl_surat:       string | null;
  tgl_rencana:     string | null;
  kd_dokter_bpjs:  string;
  nm_dokter_bpjs:  string;
  kd_poli_bpjs:    string;
  nm_poli_bpjs:    string;
}
export interface SuratKontrolMapping {
  kd_dokter_rs:  string | null;
  nm_dokter_rs:  string | null;
  kd_poli_rs:    string | null;
  nm_poli_rs:    string | null;
}
export interface SepAsal {
  no_sep:       string;
  diag_kode:    string;
  diag_nama:    string;
  no_kartu:     string | null;
  nama_pasien:  string | null;
  no_rkm_medis: string | null;
  peserta:      string | null;
  no_telp:      string | null;
}
export interface CekSuratKontrolResp {
  ok:            boolean;
  surat_kontrol: SuratKontrolInfo;
  mapping:       SuratKontrolMapping;
  sep_asal:      SepAsal | null;
}
export interface CreateSepKontrolBody {
  /** epoch ms saat pasien memasukkan nomor kartu (task 1 Mobile JKN) */
  waktu_task1?: number;
  /** epoch ms saat lembar SEP terbuka (task 2 Mobile JKN) */
  waktu_task2?: number;
  no_rawat:        string;
  no_surat:        string;
  no_kartu:        string;
  no_rkm_medis:    string;
  nama_pasien:     string;
  tgl_lahir?:      string;
  jk?:             string;
  no_telp?:        string;
  peserta?:        string;
  hak_kelas?:      string;
  tgl_surat:       string;
  diag_kode:       string;
  diag_nama:       string;
  kd_poli_bpjs:    string;
  nm_poli_bpjs:    string;
  kd_poli_rs:      string;
  kd_dokter_rs:    string;
  kd_dokter_bpjs:  string;
  tujuan_kunjungan?: "1" | "2";  // 1=Prosedur Lanjutan, 2=Konsul (default)
  catatan?:        string;
}
export const anjunganBpjsCekSuratKontrol = (q: {
  no_surat?: string; no_kartu?: string; no_rkm_medis?: string; nik?: string;
}) => {
  const sp = new URLSearchParams();
  if (q.no_surat)     sp.set("no_surat", q.no_surat);
  if (q.no_kartu)     sp.set("no_kartu", q.no_kartu);
  if (q.no_rkm_medis) sp.set("no_rkm_medis", q.no_rkm_medis);
  if (q.nik)          sp.set("nik", q.nik);
  return api.get<CekSuratKontrolResp>(`/anjungan/bpjs/surat-kontrol?${sp}`);
};
export const anjunganBpjsCreateSepKontrol = (b: CreateSepKontrolBody) =>
  api.post<CreateSepResp>("/anjungan/bpjs/sep-kontrol", b);

// ── Anjungan BPJS Mobile JKN (Check-in booking dari aplikasi HP) ────────────
export interface MobileJknBooking {
  nobooking:        string;
  no_rawat:         string | null;
  nomorkartu:       string;
  nik:              string | null;
  nohp:             string | null;
  kodepoli:         string;
  norm:             string;
  nama_pasien:      string | null;
  tanggalperiksa:   string | null;
  kodedokter:       string;
  jampraktek:       string | null;
  jeniskunjungan:   string;
  nomorreferensi:   string | null;
  nomorantrean:     string | null;
  angkaantrean:     string | null;
  estimasidilayani: string | null;
  status:           "Belum" | "Checkin" | "Batal" | "Gagal";
}
export interface MobileJknMapping {
  kd_poli_rs:   string | null;
  nm_poli_rs:   string | null;
  kd_dokter_rs: string | null;
  nm_dokter_rs: string | null;
}
export interface CekMobileJknResp {
  ok:                    boolean;
  booking:               MobileJknBooking;
  mapping:               MobileJknMapping;
  sudah_daftar_hari_ini: boolean;
}
export const anjunganBpjsCekMobileJkn = (q: {
  no_kartu?: string; no_rkm_medis?: string; nik?: string;
}) => {
  const sp = new URLSearchParams();
  if (q.no_kartu)     sp.set("no_kartu", q.no_kartu);
  if (q.no_rkm_medis) sp.set("no_rkm_medis", q.no_rkm_medis);
  if (q.nik)          sp.set("nik", q.nik);
  return api.get<CekMobileJknResp>(`/anjungan/bpjs/mobile-jkn?${sp}`);
};
export interface CheckinMobileJknResp {
  ok:         boolean;
  auto_sep:   boolean;
  nobooking:  string;
  norm?:      string;
  no_rawat?:  string;
  no_reg?:    string;
  nm_poli?:   string;
  nm_dokter?: string;
  no_sep?:    string | null;
  sep_error?: string | null;
  message:    string;
  jenis?:     string;
}
export const anjunganBpjsCheckinMobileJkn = (b: {
  nobooking:      string;
  norm:           string;
  nomorkartu:     string;
  kd_poli_rs:     string;
  kd_dokter_rs:   string;
  kode_poli_bpjs: string;
  kode_dokter_bpjs: string;
  jeniskunjungan: string;
  nomorreferensi?: string;
  catatan?:       string;
  tujuan_kunjungan?: string;
  auto_sep?:      boolean;
  waktu_task2?: number;
}) => api.post<CheckinMobileJknResp>("/anjungan/bpjs/mobile-jkn/checkin", b);

export interface PrepareDokter {
  kd_dokter: string; nm_dokter: string;
  jam_mulai: string | null; jam_selesai: string | null;
  kuota: number; terisi: number; kd_dokter_bpjs: string | null;
}
export interface PrepareSepResp {
  ok: boolean; nobooking: string;
  nama: string; tgl_lahir: string; jk: string; no_telp: string;
  hak_kelas: string; peserta: string;
  diag_kode: string; diag_nama: string;
  kd_poli_bpjs: string; nm_poli_bpjs: string; kd_poli_rs: string;
  kd_dokter_bpjs_default: string; nm_dokter_bpjs_default: string;
  daftar_dokter: PrepareDokter[];
  jeniskunjungan: string; nomorreferensi: string;
}
export const anjunganBpjsPrepareMobileJkn = (b: {
  nobooking: string; nomorkartu: string; norm: string;
  kd_poli_rs: string; jeniskunjungan: string; nomorreferensi?: string;
}) => api.post<PrepareSepResp>("/anjungan/bpjs/mobile-jkn/prepare", b);

// ── Helper Agent biometrik (jalan lokal di kiosk Windows) ────────────────────
const HELPER_BASE = "http://127.0.0.1:9999";
export interface HelperInfo {
  ok: boolean;
  version: string;
  finger: { available: boolean; path: string | null; extra_args: string[] };
  frista: { available: boolean; path: string | null; extra_args: string[] };
}
export interface HelperLaunchResp {
  ok: boolean;
  service?: string;
  exe?: string;
  pid?: number;
  started?: string;
  message?: string;
  note?: string;
  error?: string;
}
async function helperFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${HELPER_BASE}${path}`, { ...init, mode: "cors" });
  const data = await r.json();
  if (!r.ok && !data.ok) throw Object.assign(new Error(data.error ?? "Helper error"), { data });
  return data as T;
}
export const helperInfo  = () => helperFetch<HelperInfo>("/info");
export const helperFinger = (noKartu: string, nik?: string) =>
  helperFetch<HelperLaunchResp>(`/finger?no_kartu=${encodeURIComponent(noKartu)}${nik ? `&nik=${encodeURIComponent(nik)}` : ""}`,
    { method: "POST" });
export const helperFrista = (noKartu: string, nik?: string) =>
  helperFetch<HelperLaunchResp>(`/frista?no_kartu=${encodeURIComponent(noKartu)}${nik ? `&nik=${encodeURIComponent(nik)}` : ""}`,
    { method: "POST" });

export interface AnjunganBpjsPeserta {
  nama:    string;
  nik:     string;
  noKartu: string;
  sex:     "L" | "P";
  tglLahir: string;
  hakKelas: { keterangan: string; kode: string };
  jenisPeserta: { keterangan: string; kode: string };
  statusPeserta: { keterangan: string; kode: string };
  provUmum: { kdProvider: string; nmProvider: string };
  mr: { noMR: string; noTelepon: string };
  informasi?: { dinsos?: string | null; noSKTM?: string | null; prolanisPRB?: string | null };
}
export interface AnjunganBpjsRujukan {
  noKunjungan: string;
  tglKunjungan?: string;
  keluhan?: string;
  diagnosa: { kode: string; nama: string };
  pelayanan: { kode: string; nama: string };
  poliRujukan?: { kode: string; nama: string };
  provPerujuk?: { kode: string; nama: string };
  peserta?: AnjunganBpjsPeserta;
}

// ─────────────────────────────────────────────────────────────
// Akreditasi STARKES
// ─────────────────────────────────────────────────────────────
export interface AkreditasiEp {
  kd_ep:             string;
  bab:               string;
  urutan_bab:        number | null;
  nama_bab:          string;
  kelompok:          number;
  standar:           string;
  nama_standar:      string | null;
  maksud_tujuan:     string | null;
  nomor_ep:          number;
  deskripsi:         string;
  kelengkapan_bukti: string | null;
  jenis_bukti:       string;
  bobot:             number;
  prioritas:         number;
  kategori_bukti:    string | null;
  versi_kepmenkes:   string;
  sumber_seed:       string | null;
  status:            string;
}
export interface EditEpBody {
  nama_standar?:      string;
  maksud_tujuan?:     string;
  deskripsi?:         string;
  kelengkapan_bukti?: string;
  jenis_bukti?:       string;
  bobot?:             number;
  prioritas?:         number;
  kategori_bukti?:    string;
  status?:            "aktif" | "non-aktif";
}
export interface AkreditasiStats {
  total_ep:     number;
  per_bab:      { bab: string; nama_bab: string; kelompok: number; total_ep: number; critical: number }[];
  per_kelompok: { kelompok: number; total: number }[];
}
export interface AkreditasiBootstrap {
  schema_statements:  number;
  starter_statements: number;
  total_ep:           number;
  message:            string;
}

export const akreditasiStats     = () => api.get<AkreditasiStats>("/akreditasi/stats");
export const akreditasiBootstrap = () => api.post<AkreditasiBootstrap>("/akreditasi/bootstrap");
export const akreditasiListEp    = (params: {
  bab?: string; kelompok?: number; prioritas?: number; kategori?: string;
  search?: string; limit?: number; offset?: number;
} = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") qs.set(k, String(v)); });
  return api.get<AkreditasiEp[]>(`/akreditasi/ep?${qs.toString()}`);
};
export const akreditasiGetEp  = (kd_ep: string) => api.get<AkreditasiEp>(`/akreditasi/ep/${encodeURIComponent(kd_ep)}`);
export const akreditasiEditEp = (kd_ep: string, body: EditEpBody) =>
  api.put<{ success: boolean; kd_ep: string }>(`/akreditasi/ep/${encodeURIComponent(kd_ep)}`, body);

// Eviden folder (catalog Drive link)
export interface EvidenFolder {
  id:         number;
  judul:      string;
  url_drive:  string;
  bab:        string | null;
  jenis:      string;
  tahun:      number | null;
  deskripsi:  string | null;
  pic_nik:    string | null;
  status:     string;
  ep_count?:  number;
}
export interface EvidenInput {
  judul:      string;
  url_drive:  string;
  bab?:       string | null;
  jenis?:     string;
  tahun?:     number | null;
  deskripsi?: string | null;
  pic_nik?:   string | null;
  kd_ep_list?: string[];
}
export interface EvidenDetail {
  folder:  EvidenFolder;
  ep_list: { kd_ep: string; deskripsi: string; bab: string }[];
}

export const evidenList   = (params: { bab?: string; jenis?: string; status?: string; search?: string } = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
  return api.get<EvidenFolder[]>(`/akreditasi/eviden?${qs.toString()}`);
};
export const evidenGet    = (id: number) => api.get<EvidenDetail>(`/akreditasi/eviden/${id}`);
export const evidenCreate = (body: EvidenInput) => api.post<{ id: number }>(`/akreditasi/eviden`, body);
export const evidenUpdate = (id: number, body: EvidenInput) => api.put(`/akreditasi/eviden/${id}`, body);
export const evidenDelete = (id: number) => api.delete(`/akreditasi/eviden/${id}`);
export const evidenByEp   = (kd_ep: string) => api.get<EvidenFolder[]>(`/akreditasi/ep/${encodeURIComponent(kd_ep)}/eviden`);

// Dokumen bukti per-EP (upload file → webapps / tautan Drive)
export interface AkreditasiDokumen {
  id: number; kd_ep: string; nama: string; jenis: string; link: string;
  keterangan: string; uploaded_by: string; uploaded_at?: string;
}
export const getEpDokumen = (kd_ep: string) =>
  api.get<AkreditasiDokumen[]>(`/akreditasi/ep/${encodeURIComponent(kd_ep)}/dokumen`);
export const addEpDokumenLink = (b: { kd_ep: string; nama: string; link: string; keterangan?: string }) =>
  api.post<{ ok: boolean }>("/akreditasi/dokumen", b);
export const uploadEpDokumen = (kd_ep: string, file: File, keterangan?: string) => {
  const fd = new FormData();
  fd.append("kd_ep", kd_ep);
  if (keterangan) fd.append("keterangan", keterangan);
  fd.append("file", file);
  return api.post<{ ok: boolean; link: string }>("/akreditasi/dokumen/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
};
export const delEpDokumen = (id: number) => api.delete<{ ok: boolean }>(`/akreditasi/dokumen/${id}`);

// Bukti SIMRS untuk EP — sample real-time dari tabel transaksi
export interface BuktiSample {
  primary_key: string;
  no_rawat:    string;
  label:       string;
  tanggal:     string;
  extra:       string | null;
}
export interface BuktiFormDetail {
  nama_form:           string;
  tabel_asal:          string;
  endpoint_api:        string;
  drill_url_template:  string;
  total_records:       number;
  records_30_hari:     number;
  sample:              BuktiSample[];
}
export interface BuktiEpResp {
  kd_ep: string;
  forms: BuktiFormDetail[];
}
export const buktiSimrsForEp = (kd_ep: string) =>
  api.get<BuktiEpResp>(`/akreditasi/ep/${encodeURIComponent(kd_ep)}/bukti-simrs`);

// ── Form ↔ EP mapping admin tools ────────────────────────────────────────────
export interface AutoSeedSample {
  kd_ep:      string;
  nama_form:  string;
  matched_kw: string;
}
export interface AutoSeedResult {
  mode:             "preview" | "applied";
  total_ep_scanned: number;
  matched:          number;
  inserted:         number;
  already_mapped:   number;
  per_form:         Record<string, number>;
  samples:          AutoSeedSample[];
}
export interface FormEpMapOverview {
  total_mappings: number;
  per_form:       Record<string, number>;
}
export const akreditasiFormEpMapOverview = () =>
  api.get<FormEpMapOverview>(`/akreditasi/form-ep-map/overview`);
export const akreditasiAutoSeedFormEpMap = (dry_run: boolean) =>
  api.post<AutoSeedResult>(`/akreditasi/form-ep-map/auto-seed?dry_run=${dry_run}`);

// Laporan Farmasi — stok minimum per depo
export interface StokRow {
  kode_brng:     string;
  nama_brng:     string;
  satuan:        string;
  jenis:         string;
  kd_bangsal:    string;
  nm_bangsal:    string;
  stok_minimal:  number;
  stok_saat_ini: number;
  selisih:       number;
}
export interface StokMinimumResp {
  critical:       StokRow[];
  warning:        StokRow[];
  total_critical: number;
  total_warning:  number;
}
export interface DepoRow {
  kd_bangsal: string;
  nm_bangsal: string;
}
export const getLaporanStokMinimum = (params: { kd_bangsal?: string; ratio?: number; search?: string } = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") qs.set(k, String(v)); });
  return api.get<StokMinimumResp>(`/laporan/farmasi/stok-minimum?${qs.toString()}`);
};
export const getDepoList = () => api.get<DepoRow[]>(`/laporan/farmasi/depo`);

// ── Menu Direktur ────────────────────────────────────────────
export interface DirekturTarget {
  bor_min: number; bor_max: number; alos_max: number; toi_max: number;
  pendapatan_harian: number; pendapatan_bulanan: number; piutang_max: number;
  kepuasan: number; akreditasi: number;
  kepuasan_real: number; akreditasi_real: number;
  inovasi_target: number; inovasi_real: number; sdm_target: number;
}
export interface DirekturAlert { level: "merah" | "kuning"; kategori: string; pesan: string }
export interface DirekturDashboard {
  kunjungan:  { rajal_today: number; igd_today: number; ranap_today: number;
                rajal_mtd: number;   igd_mtd: number;   ranap_mtd: number };
  kamar:      { kapasitas: number; terisi: number; kosong: number; bor_pct: number };
  indikator:  { alos: number; bto: number; toi: number };
  operasi_today: number;
  keuangan:   { pendapatan_today: number; pendapatan_mtd: number; piutang_total: number };
  pegawai:    { total_aktif: number; dokter: number; perawat: number; lain: number };
  antrian:    { menunggu: number; dipanggil_hari_ini: number };
  akreditasi: { total_ep: number; critical: number; eviden: number };
  farmasi:    { stok_kosong: number };
  target:     DirekturTarget;
  alerts:     DirekturAlert[];
}
export interface DirekturBpjsFarmasi {
  farmasi: {
    nilai_persediaan: number; jml_item: number; kosong: number; hampir_habis: number;
    fast_moving: { kode: string; nama: string; jumlah: number }[];
    slow_moving: { kode: string; nama: string; jumlah: number }[];
  };
  bpjs: { sep_mtd: number; sep_today: number; piutang_bpjs: number; piutang_total: number };
}
export const direkturBpjsFarmasi = () => api.get<DirekturBpjsFarmasi>("/direktur/bpjs-farmasi");

// ── Inventaris / Aset (migrasi SIMGPS) ───────────────────────────────────────
export interface Inventaris {
  id: number; nama_alat: string; barcode: string; merk: string; model: string;
  ruangan: string; gedung: string; kategori: string; status_laik: string; kondisi: string;
  no_seri: string; tahun: string; nilai: number; hasil_kalibrasi: string; catatan: string;
  foto: string; no_label: string; vendor: string; wajib_kalibrasi: number;
}
export interface InventarisSummary {
  total: number; laik: number; tidak_laik: number; nilai_total: number;
  per_kategori: { k: string; v: number }[]; per_ruangan: { k: string; v: number }[];
}
export interface InventarisFilters { ruangan: string[]; merk: string[]; kategori: string[] }
export const getInventaris = (p: { q?: string; ruangan?: string; merk?: string; kategori?: string } = {}) => {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.ruangan) sp.set("ruangan", p.ruangan);
  if (p.merk) sp.set("merk", p.merk);
  if (p.kategori) sp.set("kategori", p.kategori);
  return api.get<Inventaris[]>(`/inventaris?${sp}`);
};
export const getInventarisSummary = () => api.get<InventarisSummary>("/inventaris/summary");
export const getInventarisFilters = () => api.get<InventarisFilters>("/inventaris/filters");
export const saveInventaris = (b: Partial<Inventaris>) => api.post<{ ok: boolean }>("/inventaris", b);
export const delInventaris  = (id: number) => api.delete<{ ok: boolean }>(`/inventaris/${id}`);
export const getInventarisDetail = (id: number) => api.get<Inventaris>(`/inventaris/${id}`);

// Transaksi aset: Kalibrasi / Maintenance / Inspeksi / Mutasi / Complain
export interface InvTransaksi {
  id: number; inventaris_id: number; jenis: string;
  tanggal: string | null; tanggal_berikut: string | null;
  hasil: string; keterangan: string; ruangan_asal: string; ruangan_tujuan: string;
  biaya: number; vendor: string; petugas: string;
}
export const getInvTransaksi = (inventaris_id: number) =>
  api.get<InvTransaksi[]>(`/inventaris/transaksi?inventaris_id=${inventaris_id}`);
export const saveInvTransaksi = (b: Partial<InvTransaksi>) =>
  api.post<{ ok: boolean }>("/inventaris/transaksi", b);
export const delInvTransaksi = (id: number) =>
  api.delete<{ ok: boolean }>(`/inventaris/transaksi/${id}`);

// Jadwal kalibrasi (aset wajib kalibrasi + jatuh tempo)
export interface JadwalKalibrasi {
  id: number; nama_alat: string; barcode: string; ruangan: string;
  terakhir: string | null; berikut: string | null; sisa_hari: number | null;
}
export const getJadwalKalibrasi = () => api.get<JadwalKalibrasi[]>("/inventaris/jadwal-kalibrasi");

// Daftar semua transaksi (Kalibrasi/Maintenance/Inspeksi/Mutasi/Complain)
export interface InvTransaksiFull {
  id: number; inventaris_id: number; nama_alat: string; ruangan: string; barcode: string;
  jenis: string; tanggal: string | null; tanggal_berikut: string | null;
  hasil: string; keterangan: string; biaya: number; vendor: string; petugas: string;
}
export const getInvRiwayat = (p: { jenis?: string; q?: string } = {}) => {
  const sp = new URLSearchParams();
  if (p.jenis) sp.set("jenis", p.jenis);
  if (p.q) sp.set("q", p.q);
  return api.get<InvTransaksiFull[]>(`/inventaris/riwayat?${sp}`);
};

// Dashboard inventaris
export interface InvKV { k: string; v: number }
export interface InvDashboard {
  total: number; laik: number; tidak_laik: number; nilai_total: number;
  per_kondisi: InvKV[]; per_gedung: InvKV[]; per_kategori: InvKV[];
  nilai_per_kategori: InvKV[]; per_tahun: InvKV[]; top_ruangan: InvKV[];
  kalibrasi: { wajib: number; overdue: number; due30: number; terjadwal: number; belum: number };
}
export const getInvDashboard = () => api.get<InvDashboard>("/inventaris/dashboard");

// Master ruangan / merk
export const getMasterRuangan = () => api.get<InvKV[]>("/inventaris/master/ruangan");
export const getMasterMerk = () => api.get<InvKV[]>("/inventaris/master/merk");
export type MasterField = "ruangan" | "merk" | "gedung" | "nama_alat" | "kategori";
export const getMasterKolom = (field: MasterField) => api.get<InvKV[]>(`/inventaris/master/kolom?field=${field}`);
export const renameMaster = (field: MasterField, from: string, to: string) =>
  api.post<{ ok: boolean; affected: number }>("/inventaris/master/rename", { field, from, to });

// ── Integrasi SIMGPS (API H2H resmi vendor) ──────────────────────────────────
export interface SimgpsConfig { base: string; email: string; has_password: boolean; has_token: boolean; token_preview: string }
export const getSimgpsConfig = () => api.get<SimgpsConfig>("/simgps/config");
export const setSimgpsConfig = (p: { base?: string; token?: string; email?: string; password?: string }) =>
  api.post<{ ok: boolean }>("/simgps/config", p);
export const loginSimgps = () => api.post<{ ok: boolean; user_name?: string; message?: string }>("/simgps/login");
export const testSimgps = () => api.get<{ ok: boolean; message?: string; jumlah_ruangan?: number }>("/simgps/test");
export const pullSimgps = (apply: boolean) =>
  api.post<{ ok: boolean; apply: boolean; master: Record<string, number>; aset_ditemukan: Record<string, number>; baru: number; diperbarui: number; catatan: string }>(`/simgps/pull${apply ? "?apply=1" : ""}`);
export const pushSimgpsAsset = (id: number) => api.post<Record<string, unknown>>(`/simgps/push-asset/${id}`);

// Stok opname
export interface OpnameItem { inventaris_id: number; status: string; kondisi?: string }
export interface OpnameBody { ruangan: string; tanggal?: string; petugas?: string; catatan?: string; items: OpnameItem[] }
export interface OpnameSesi { tanggal: string | null; ruangan: string; total: number; ada: number; tidak: number; petugas: string }
export const saveOpname = (b: OpnameBody) => api.post<{ ok: boolean; tersimpan: number }>("/inventaris/opname", b);
export const getOpnameHistory = () => api.get<OpnameSesi[]>("/inventaris/opname/history");

// ── Input manual Direktur: Pengadaan / Aset / Belanja BLUD ───────────────────
export interface Pengadaan {
  id: number; paket: string; vendor: string; nilai_kontrak: number; realisasi: number;
  tgl_mulai: string | null; tgl_akhir: string | null; status: string; catatan: string;
  sisa_hari: number | null;
}
export interface Aset {
  id: number; nama: string; kategori: string; kondisi: string; nilai: number;
  perlu_kalibrasi: number; tgl_kalibrasi: string | null; tgl_kalibrasi_berikut: string | null;
  catatan: string; sisa_hari_kalibrasi: number | null;
}
export interface Belanja { id: number; jenis: string; uraian: string; pagu: number; realisasi: number }
export interface DirekturInputSummary {
  pengadaan_paket: number; pengadaan_nilai: number; pengadaan_realisasi: number; kontrak_hampir_habis: number;
  aset_total: number; aset_baik: number; aset_rusak: number; kalibrasi_due: number; aset_nilai: number;
  belanja_pagu: number; belanja_realisasi: number;
}
export const getDirekturInputSummary = () => api.get<DirekturInputSummary>("/direktur/input-summary");
export const getPengadaan  = () => api.get<Pengadaan[]>("/direktur/pengadaan");
export const savePengadaan = (b: Partial<Pengadaan>) => api.post<{ ok: boolean }>("/direktur/pengadaan", b);
export const delPengadaan  = (id: number) => api.delete<{ ok: boolean }>(`/direktur/pengadaan/${id}`);
export const getAset  = () => api.get<Aset[]>("/direktur/aset");
export const saveAset = (b: Partial<Aset>) => api.post<{ ok: boolean }>("/direktur/aset", b);
export const delAset  = (id: number) => api.delete<{ ok: boolean }>(`/direktur/aset/${id}`);
export const getBelanja  = () => api.get<Belanja[]>("/direktur/belanja");
export const saveBelanja = (b: Partial<Belanja>) => api.post<{ ok: boolean }>("/direktur/belanja", b);
export const delBelanja  = (id: number) => api.delete<{ ok: boolean }>(`/direktur/belanja/${id}`);
export const getDirekturTarget = () => api.get<DirekturTarget>("/direktur/target");
export const putDirekturTarget = (key: string, value: number) =>
  api.put<{ ok: boolean }>("/direktur/target", { key, value });
export interface DirekturOperasional {
  trend_12_bulan:  { bulan: string; rajal: number; igd: number; ranap: number }[];
  top_diagnosa:    { kode: string; nama: string; jumlah: number }[];
  top_obat:        { kode: string; nama: string; jumlah: number }[];
  top_tindakan:    { kode: string; nama: string; jumlah: number }[];
  pelayanan_poli:  { kode: string; nama: string; jumlah: number }[];
  bor_bangsal:     { kd_bangsal: string; nm_bangsal: string; kapasitas: number; terisi: number; bor_pct: number }[];
}
export interface DirekturKeuangan {
  pendapatan_per_layanan:   { kategori: string; jumlah: number }[];
  pendapatan_per_penjamin:  { kategori: string; jumlah: number }[];
  piutang_per_penjamin:     { kategori: string; jumlah: number }[];
  trend_pendapatan_30_hari: { tanggal: string; pendapatan: number }[];
}
export interface DirekturSdm {
  total_aktif:          number;
  per_jabatan:          { kategori: string; jumlah: number }[];
  per_pendidikan:       { kategori: string; jumlah: number }[];
  dokter_per_spesialis: { kategori: string; jumlah: number }[];
}
export const direkturDashboard   = () => api.get<DirekturDashboard>("/direktur/dashboard");
export const direkturOperasional = () => api.get<DirekturOperasional>("/direktur/operasional");
export const direkturKeuangan    = () => api.get<DirekturKeuangan>("/direktur/keuangan");
export const direkturSdm         = () => api.get<DirekturSdm>("/direktur/sdm");

// ── SIRS 6.3 ─────────────────────────────────────────────────────────────────
export interface Rl11Profil {
  // Section A
  tahun_berdiri?: number | null;
  nama_direktur?: string | null;
  jenis_rs?: string | null;
  kelas_rs?: string | null;
  status_blu?: string | null;
  kepemilikan?: string | null;
  nama_penyelenggara?: string | null;
  kerjasama_bpjs?: string | null;
  luas_tanah_m2?: number | null;
  luas_bangunan_m2?: number | null;
  no_call_center?: string | null;
  website?: string | null;
  // Section B
  no_sio?: string | null;
  tgl_sio?: string | null;
  tgl_berlaku_sio?: string | null;
  file_sio?: string | null;
  pentahapan_akreditasi?: string | null;
  tgl_penetapan_akreditasi?: string | null;
  tgl_berlaku_akreditasi?: string | null;
  file_akreditasi?: string | null;
  akreditasi_internasional?: string | null;
  rs_pendidikan?: string | null;
  no_sk_pendidikan?: string | null;
  tgl_sk_pendidikan?: string | null;
  no_sk_tt?: string | null;
  tgl_sk_tt?: string | null;
  file_sk_tt?: string | null;
  ipwl?: string | null;
  no_sk_ipwl?: string | null;
  tgl_sk_ipwl?: string | null;
  file_tarif_layanan?: string | null;
  // Section C
  layanan_unggulan?: string | null;
  simrs_kondisi?: string | null;
  pelayanan_darah?: string | null;
  komite_transfusi_darah?: string | null;
  audit_pelayanan_darah?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  nama_ka_ifrs?: string | null;
  telp_ka_ifrs?: string | null;
  email_ka_ifrs?: string | null;
  kerjasama_psef?: string | null;
  kerjasama_fk_fkg?: string | null;
  // Section D — Foto (path file)
  foto_tampak_depan?: string | null;
  foto_ruang_ralan?: string | null;
  foto_ruang_ranap?: string | null;
  foto_ruang_igd?: string | null;
  foto_alkes?: string | null;
  // Section F — SIMRS dasar
  simrs_jenis_vendor?: string | null;
  simrs_nama_developer?: string | null;
  simrs_akses_internet?: string | null;
  simrs_pic_nama?: string | null;
  simrs_pic_nik?: string | null;
  simrs_pic_email?: string | null;
  simrs_pic_telp?: string | null;
  simrs_pic_jabatan?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}
export interface KerjasamaLn {
  id?: number | null;
  nama_institusi: string;
  negara: string;
  area?: string | null;
  output_kerja?: string | null;
  bentuk?: string | null;        // CSV
  keterangan?: string | null;
  tgl_mulai?: string | null;
  tgl_akhir?: string | null;
}
export interface SimrsModul {
  id: number;
  kategori: string;
  sub_kategori: string | null;
  modul: string;
  ada: number;          // 0 / 1
}
export interface Rl11Resp {
  // Read-only dari setting Khanza
  nama_instansi: string | null;
  alamat_instansi: string | null;
  kabupaten: string | null;
  propinsi: string | null;
  kontak: string | null;
  email: string | null;
  data: Rl11Profil | null;
}
export const getSirsRl11  = () => api.get<Rl11Resp>("/sirs/rl/1-1");
export const editSirsRl11 = (body: Rl11Profil) =>
  api.put<{ success: boolean }>("/sirs/rl/1-1", body);

export const listKerjasamaLn   = () => api.get<KerjasamaLn[]>("/sirs/rl/1-1/kerjasama-ln");
export const createKerjasamaLn = (body: KerjasamaLn) =>
  api.post<{ success: boolean; id: number }>("/sirs/rl/1-1/kerjasama-ln", body);
export const updateKerjasamaLn = (id: number, body: KerjasamaLn) =>
  api.put<{ success: boolean }>(`/sirs/rl/1-1/kerjasama-ln/${id}`, body);
export const deleteKerjasamaLn = (id: number) =>
  api.delete<{ success: boolean }>(`/sirs/rl/1-1/kerjasama-ln/${id}`);

export const listSimrsModul   = () => api.get<SimrsModul[]>("/sirs/rl/1-1/modul");
export const toggleSimrsModul = (id: number, ada: boolean) =>
  api.put<{ success: boolean }>(`/sirs/rl/1-1/modul/${id}`, { ada });

export const cetakSirsRl11 = async () => {
  const res = await api.get<string>("/sirs/rl/1-1/cetak",
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 1.2 — Ketersediaan Pelayanan ─────────────────────────────────────────
export interface Rl12Pelayanan {
  id:       number;
  kat_no:   number;
  kat_name: string;
  sub_no:   number;
  sub_name: string;
  ada:      number;   // 0 or 1
}
export const listSirsRl12   = () => api.get<Rl12Pelayanan[]>("/sirs/rl/1-2");
export const toggleSirsRl12 = (id: number, ada: boolean) =>
  api.put<{ success: boolean }>(`/sirs/rl/1-2/${id}`, { ada });
export const cetakSirsRl12  = async () => {
  const res = await api.get<string>("/sirs/rl/1-2/cetak",
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 1.3 — Ketersediaan & Keterpakaian TT ─────────────────────────────────
export interface Rl13Tt {
  id?:           number | null;
  kelas_tt:      string;
  ruangan:       string;
  jml_tersedia:  number;
  jml_terpakai:  number;
  catatan?:      string | null;
  updated_at?:   string | null;
  updated_by?:   string | null;
}
export const listSirsRl13   = () => api.get<Rl13Tt[]>("/sirs/rl/1-3");
export const createSirsRl13 = (body: Rl13Tt) =>
  api.post<{ success: boolean; id: number }>("/sirs/rl/1-3", body);
export const updateSirsRl13 = (id: number, body: Rl13Tt) =>
  api.put<{ success: boolean }>(`/sirs/rl/1-3/${id}`, body);
export const deleteSirsRl13 = (id: number) =>
  api.delete<{ success: boolean }>(`/sirs/rl/1-3/${id}`);
export const cetakSirsRl13  = async () => {
  const res = await api.get<string>("/sirs/rl/1-3/cetak",
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 1.4 — Sarpras & Alkes (ASPAK) ────────────────────────────────────────
export interface Rl14Meta {
  aspak_url?:          string | null;
  pic_nama?:           string | null;
  pic_nik?:            string | null;
  pic_email?:          string | null;
  pic_telp?:           string | null;
  pic_jabatan?:        string | null;
  terakhir_sync?:      string | null;
  persen_pemenuhan?:   number | null;
  total_alkes?:        number | null;
  total_terkalibrasi?: number | null;
  catatan?:            string | null;
  updated_at?:         string | null;
  updated_by?:         string | null;
}
export interface Rl14Inventaris {
  id?:               number | null;
  kategori:          string;
  nama_item:         string;
  jumlah:            number;
  jml_baik:          number;
  jml_rusak_ringan:  number;
  jml_rusak_berat:   number;
  satuan?:           string | null;
  catatan?:          string | null;
  updated_at?:       string | null;
  updated_by?:       string | null;
}
export interface Rl14Resp {
  meta:       Rl14Meta | null;
  inventaris: Rl14Inventaris[];
}
export const getSirsRl14       = () => api.get<Rl14Resp>("/sirs/rl/1-4");
export const editSirsRl14Meta  = (body: Rl14Meta) =>
  api.put<{ success: boolean }>("/sirs/rl/1-4", body);
export const createSirsRl14Inv = (body: Rl14Inventaris) =>
  api.post<{ success: boolean; id: number }>("/sirs/rl/1-4/inventaris", body);
export const updateSirsRl14Inv = (id: number, body: Rl14Inventaris) =>
  api.put<{ success: boolean }>(`/sirs/rl/1-4/inventaris/${id}`, body);
export const deleteSirsRl14Inv = (id: number) =>
  api.delete<{ success: boolean }>(`/sirs/rl/1-4/inventaris/${id}`);
export const cetakSirsRl14     = async () => {
  const res = await api.get<string>("/sirs/rl/1-4/cetak",
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 2 — Data Ketenagaan (SISDMK) ─────────────────────────────────────────
export interface Rl2Meta {
  sisdmk_url?:      string | null;
  pic_nama?:        string | null;
  pic_nik?:         string | null;
  pic_email?:       string | null;
  pic_telp?:        string | null;
  pic_jabatan?:     string | null;
  terakhir_sync?:   string | null;
  total_di_sisdmk?: number | null;
  catatan?:         string | null;
  updated_at?:      string | null;
  updated_by?:      string | null;
}
export interface GroupCount { label: string; jml: number }
export interface Rl2Resp {
  meta:             Rl2Meta | null;
  total_aktif:      number;
  total_cuti:       number;
  total_keluar:     number;
  total_pria:       number;
  total_wanita:     number;
  per_pendidikan:   GroupCount[];
  per_departemen:   GroupCount[];
  per_jabatan:      GroupCount[];
  per_status_kerja: GroupCount[];
}
export const getSirsRl2      = () => api.get<Rl2Resp>("/sirs/rl/2");
export const editSirsRl2Meta = (body: Rl2Meta) =>
  api.put<{ success: boolean }>("/sirs/rl/2", body);
export const cetakSirsRl2    = async () => {
  const res = await api.get<string>("/sirs/rl/2/cetak",
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.1 — Indikator Pelayanan ────────────────────────────────────────────
export interface Rl31Row {
  jenis:          string;
  jml_tt:         number;
  hari_periode:   number;
  hari_perawatan: number;
  pasien_keluar:  number;
  pasien_mati:    number;
  mati_ge48:      number;
  bor:            number;
  alos:           number;
  bto:            number;
  toi:            number;
  ndr:            number;
  gdr:            number;
}
export interface Rl31RataRata {
  bor: number; alos: number; bto: number; toi: number; ndr: number; gdr: number;
}
export interface Rl31Resp {
  bulan:        string;
  bulan_dari:   string;
  bulan_sampai: string;
  hari_periode: number;
  rows:         Rl31Row[];
  rata_rata:    Rl31RataRata;
}
export const getSirsRl31   = (bulan: string) =>
  api.get<Rl31Resp>(`/sirs/rl/3-1${bulan ? `?bulan=${bulan}` : ""}`);
export const cetakSirsRl31 = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/3-1/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.2 — Rekap Rawat Inap ───────────────────────────────────────────────
export interface Rl32Row {
  jenis_pelayanan:    string;
  pasien_masuk:       number;
  pasien_dipindahkan: number;
  pasien_keluar_hidup:number;
  pasien_l_mati_lt48: number;
  pasien_l_mati_ge48: number;
  pasien_p_mati_lt48: number;
  pasien_p_mati_ge48: number;
  lama_dirawat:       number;
  hari_perawatan:     number;
  hari_kelas_utama:   number;
  hari_kelas_1:       number;
  hari_kelas_2:       number;
  hari_kelas_3:       number;
}
export interface Rl32Total extends Omit<Rl32Row, "jenis_pelayanan"> {
  total_mati: number;
}
export interface Rl32Resp {
  bulan:        string;
  bulan_dari:   string;
  bulan_sampai: string;
  hari_periode: number;
  rows:         Rl32Row[];
  total:        Rl32Total;
}
export const getSirsRl32   = (bulan: string) =>
  api.get<Rl32Resp>(`/sirs/rl/3-2${bulan ? `?bulan=${bulan}` : ""}`);
export const cetakSirsRl32 = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/3-2/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.3 — Rawat Darurat (IGD) ────────────────────────────────────────────
export interface Rl33Entry {
  id?:             number | null;
  bulan:           string;
  urutan?:         number | null;
  jenis_kode:      string;
  jenis_nama:      string;
  parent_kode?:    string | null;
  is_parent:       number;
  rujukan:         number;
  non_rujukan:     number;
  dirawat:         number;
  dirujuk:         number;
  pulang:          number;
  mati_l:          number;
  mati_p:          number;
  doa_l:           number;
  doa_p:           number;
  luka_l:          number;
  luka_p:          number;
  false_emergency: number;
  updated_at?:     string | null;
  updated_by?:     string | null;
}
export interface Rl33Khanza {
  total_igd: number; l: number; p: number; baru: number; lama: number;
}
export interface Rl33KhanzaKategori {
  kode_kasus:  string | null;
  macam_kasus: string | null;
  jml:         number;
  rujukan:     number;
  non_rujukan: number;
}
export interface Rl33Resp {
  bulan:               string;
  bulan_dari:          string;
  bulan_sampai:        string;
  entries:             Rl33Entry[];
  khanza:              Rl33Khanza;
  khanza_per_kategori: Rl33KhanzaKategori[];
}
export const getSirsRl33    = (bulan: string) =>
  api.get<Rl33Resp>(`/sirs/rl/3-3${bulan ? `?bulan=${bulan}` : ""}`);
export const updateSirsRl33 = (id: number, body: Rl33Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-3/${id}`, body);
export const cetakSirsRl33  = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/3-3/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.4 Rekapitulasi Pengunjung ───────────────────────────────────────────
export interface Rl34Resp {
  bulan:              string;
  pengunjung_baru_l:  number;
  pengunjung_baru_p:  number;
  pengunjung_lama_l:  number;
  pengunjung_lama_p:  number;
  total_baru:         number;
  total_lama:         number;
  total:              number;
}
export const getSirsRl34   = (bulan: string) =>
  api.get<Rl34Resp>(`/sirs/rl/3-4${bulan ? `?bulan=${bulan}` : ""}`);
export const cetakSirsRl34 = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/3-4/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.5 Rekapitulasi Kunjungan ────────────────────────────────────────────
export interface Rl35Entry {
  id:          number | null;
  bulan:       string;
  urutan:      number;
  jenis_kode:  string;
  jenis_nama:  string;
  dalam_l:     number | null;
  dalam_p:     number | null;
  luar_l:      number | null;
  luar_p:      number | null;
  is_stat:     number;
  stat_value:  number | null;
  updated_at:  string | null;
  updated_by:  string | null;
}
export interface Rl35KhanzaPoli {
  kd_poli:  string | null;
  nm_poli:  string | null;
  dalam_l:  number;
  dalam_p:  number;
  luar_l:   number;
  luar_p:   number;
  total:    number;
}
export interface Rl35Khanza {
  kab_kota_rs:   string;
  total_dalam_l: number;
  total_dalam_p: number;
  total_luar_l:  number;
  total_luar_p:  number;
  total:         number;
  per_poli:      Rl35KhanzaPoli[];
}
export interface Rl35Resp {
  bulan:   string;
  entries: Rl35Entry[];
  khanza:  Rl35Khanza;
}
export const getSirsRl35    = (bulan: string) =>
  api.get<Rl35Resp>(`/sirs/rl/3-5${bulan ? `?bulan=${bulan}` : ""}`);
export const updateSirsRl35 = (id: number, body: Rl35Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-5/${id}`, body);
export const cetakSirsRl35  = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/3-5/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.6 Rekapitulasi Pelayanan Kebidanan ─────────────────────────────────
export interface Rl36Entry {
  id:              number | null;
  bulan:           string;
  urutan:          number | null;
  jenis_kode:      string;
  jenis_nama:      string;
  parent_kode:     string | null;
  is_parent:       number;
  rm_rs:           number | null;
  rm_bidan:        number | null;
  rm_puskes:       number | null;
  rm_faskes_lain:  number | null;
  rm_hidup:        number | null;
  rm_mati:         number | null;
  rnm_hidup:       number | null;
  rnm_mati:        number | null;
  nr_hidup:        number | null;
  nr_mati:         number | null;
  dirujuk:         number | null;
  updated_at:      string | null;
  updated_by:      string | null;
}
export interface Rl36KhanzaPerRow {
  jenis_kode: string;
  count:      number;
  sumber:     string;
}
export interface Rl36Mortality {
  maternal_total: number;
  maternal_icd_o: number;
  doa_perempuan:  number;
}
export interface Rl36Khanza {
  persalinan_khanza: number;
  obstetri_ralan:    number;
  obstetri_ranap:    number;
  kunjungan_obg:     number;
  bayi_baru_lahir:   number;
  ibu_nifas:         number;
  mortality:         Rl36Mortality;
  per_row:           Rl36KhanzaPerRow[];
}
export interface Rl36Resp {
  bulan:   string;
  entries: Rl36Entry[];
  khanza:  Rl36Khanza;
}
export const getSirsRl36    = (bulan: string) =>
  api.get<Rl36Resp>(`/sirs/rl/3-6${bulan ? `?bulan=${bulan}` : ""}`);
export const updateSirsRl36 = (id: number, body: Rl36Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-6/${id}`, body);
export const cetakSirsRl36  = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/3-6/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.7 Rekap Pelayanan Neonatal/Bayi/Balita ──────────────────────────────
export interface Rl37Entry {
  id:              number | null;
  bulan:           string;
  urutan:          number | null;
  jenis_kode:      string;
  jenis_nama:      string;
  parent_kode:     string | null;
  is_parent:       number;
  section:         string | null;
  rm_rs:           number | null;
  rm_bidan:        number | null;
  rm_puskes:       number | null;
  rm_faskes_lain:  number | null;
  rm_hidup:        number | null;
  rm_mati:         number | null;
  rnm_hidup:       number | null;
  rnm_mati:        number | null;
  nr_hidup:        number | null;
  nr_mati:         number | null;
  dirujuk:         number | null;
  updated_at:      string | null;
  updated_by:      string | null;
}
export interface Rl37PasienBayi {
  total:               number;
  bbler_lt1000:        number;
  bblsr_1000_1500:     number;
  bblr_1500_2500:      number;
  bbln_2500_4000:      number;
  bbll_ge4000:         number;
  proses_spontan:      number;
  proses_sc:           number;
  proses_vakum_forceps:number;
  asfiksia_apgar1_lt7: number;
}
export interface Rl37Mortality {
  neonatal_dini_0_7h:    number;
  neonatal_lanjut_8_28h: number;
  lahir_mati:            number;
  bayi_29h_11bl:         number;
  balita_12_59bl:        number;
}
export interface Rl37Khanza {
  pasien_bayi_total_all_time: number;
  pasien_bayi_bulan_ini:      Rl37PasienBayi;
  mortality:                  Rl37Mortality;
  livebirth_z38:              number;
  kunjungan_ralan_bayi:       number;
  bbl_0_28h:                  number;
  bayi_29h_11bl:              number;
  balita_12_59bl:             number;
  neonatus_prematur:          number;
  neonatus_kelainan_bawaan:   number;
  per_row:                    Rl36KhanzaPerRow[];
}
export interface Rl37Resp {
  bulan:   string;
  entries: Rl37Entry[];
  khanza:  Rl37Khanza;
}
export const getSirsRl37    = (bulan: string) =>
  api.get<Rl37Resp>(`/sirs/rl/3-7${bulan ? `?bulan=${bulan}` : ""}`);
export const updateSirsRl37 = (id: number, body: Rl37Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-7/${id}`, body);
export const cetakSirsRl37  = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/3-7/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.8 Rekap Pelayanan Laboratorium ──────────────────────────────────────
export interface Rl38Entry {
  id:          number | null;
  bulan:       string;
  urutan:      number | null;
  jenis_kode:  string;
  jenis_nama:  string;
  parent_kode: string | null;
  is_parent:   number;
  section:     string | null;
  jml_l:       number | null;
  jml_p:       number | null;
  rata_l:      number | null;
  rata_p:      number | null;
  updated_at:  string | null;
  updated_by:  string | null;
}
export interface Rl38KhanzaTop {
  nm_perawatan: string | null;
  kategori:     string | null;
  jml:          number;
  jml_l:        number;
  jml_p:        number;
}
export interface Rl38KhanzaKategori {
  kategori:  string | null;
  jml:       number;
  jml_l:     number;
  jml_p:     number;
  pasien:    number;
}
export interface Rl38Khanza {
  total_pemeriksaan: number;
  total_pasien:      number;
  per_kategori:      Rl38KhanzaKategori[];
  top_jenis:         Rl38KhanzaTop[];
}
export interface Rl38Resp {
  bulan:   string;
  entries: Rl38Entry[];
  khanza:  Rl38Khanza;
}
export const getSirsRl38    = (bulan: string) =>
  api.get<Rl38Resp>(`/sirs/rl/3-8${bulan ? `?bulan=${bulan}` : ""}`);
export const updateSirsRl38 = (id: number, body: Rl38Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-8/${id}`, body);
export const cetakSirsRl38  = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/3-8/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.9 Rekap Pelayanan Radiologi ─────────────────────────────────────────
export interface Rl39Entry {
  id:          number | null;
  bulan:       string;
  urutan:      number | null;
  jenis_kode:  string;
  jenis_nama:  string;
  parent_kode: string | null;
  is_parent:   number;
  jumlah:      number | null;
  updated_at:  string | null;
  updated_by:  string | null;
}
export interface Rl39KhanzaTop {
  nm_perawatan: string | null;
  jumlah:       number;
}
export interface Rl39KhanzaSugesti {
  jenis_kode: string;
  count:      number;
  sumber:     string;
}
export interface Rl39Khanza {
  total_periksa_radiologi: number;
  total_pasien:            number;
  top_jenis:               Rl39KhanzaTop[];
  sugesti_per_row:         Rl39KhanzaSugesti[];
}
export interface Rl39Resp {
  bulan:   string;
  entries: Rl39Entry[];
  khanza:  Rl39Khanza;
}
export const getSirsRl39    = (bulan: string) =>
  api.get<Rl39Resp>(`/sirs/rl/3-9${bulan ? `?bulan=${bulan}` : ""}`);
export const updateSirsRl39 = (id: number, body: Rl39Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-9/${id}`, body);
export const cetakSirsRl39  = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/3-9/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.10 Rekap Pelayanan Rujukan ──────────────────────────────────────────
export interface Rl310Entry {
  id:                       number | null;
  bulan:                    string;
  urutan:                   number;
  jenis_kode:               string;
  jenis_nama:               string;
  rm_in_pus:                number | null;
  rm_in_rs:                 number | null;
  rm_in_faskes:             number | null;
  rm_out_pus:               number | null;
  rm_out_rs:                number | null;
  rm_out_faskes:            number | null;
  rk_pasien_rujukan:        number | null;
  rk_pasien_datang_sendiri: number | null;
  rk_diterima_kembali:      number | null;
  updated_at:               string | null;
  updated_by:               string | null;
}
export interface Rl310KhanzaSpes {
  jenis_kode:         string;
  rm_in_total:        number;
  rm_in_pus_pattern:  number;
  rm_in_rs_pattern:   number;
  rm_in_faskes_other: number;
  rk_total:           number;
}
export interface Rl310Khanza {
  rujuk_masuk_total:      number;
  rujuk_keluar_total:     number;
  rujuk_masuk_pus_pattern: number;
  rujuk_masuk_rs_pattern:  number;
  rujuk_masuk_faskes_other:number;
  rujuk_masuk_kosong:      number;
  per_spesialisasi:        Rl310KhanzaSpes[];
}
export interface Rl310Resp {
  bulan:   string;
  entries: Rl310Entry[];
  khanza:  Rl310Khanza;
}
export const getSirsRl310    = (bulan: string) =>
  api.get<Rl310Resp>(`/sirs/rl/3-10${bulan ? `?bulan=${bulan}` : ""}`);
export const updateSirsRl310 = (id: number, body: Rl310Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-10/${id}`, body);
export const cetakSirsRl310  = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/3-10/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.11 Rekap Pelayanan Gigi dan Mulut (TAHUNAN) ─────────────────────────
export interface Rl311Entry {
  id:          number | null;
  tahun:       string;
  urutan:      number;
  jenis_kode:  string;
  jenis_nama:  string;
  jumlah:      number | null;
  updated_at:  string | null;
  updated_by:  string | null;
}
export interface Rl311KhanzaSugesti {
  jenis_kode: string;
  count:      number;
  sumber:     string;
}
export interface Rl311KhanzaTop {
  nm_perawatan: string | null;
  jumlah:       number;
}
export interface Rl311Khanza {
  kunjungan_poli_gig: number;
  total_tindakan:     number;
  sugesti_per_row:    Rl311KhanzaSugesti[];
  top_tindakan:       Rl311KhanzaTop[];
}
export interface Rl311Resp {
  tahun:   string;
  entries: Rl311Entry[];
  khanza:  Rl311Khanza;
}
export const getSirsRl311    = (tahun: string) =>
  api.get<Rl311Resp>(`/sirs/rl/3-11${tahun ? `?tahun=${tahun}` : ""}`);
export const updateSirsRl311 = (id: number, body: Rl311Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-11/${id}`, body);
export const cetakSirsRl311  = async (tahun: string) => {
  const res = await api.get<string>(`/sirs/rl/3-11/cetak${tahun ? `?tahun=${tahun}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.12 Rekap Pelayanan Pembedahan ───────────────────────────────────────
export interface Rl312Entry {
  id:          number | null;
  bulan:       string;
  urutan:      number;
  jenis_kode:  string;
  jenis_nama:  string;
  khusus:      number | null;
  besar:       number | null;
  sedang:      number | null;
  kecil:       number | null;
  updated_at:  string | null;
  updated_by:  string | null;
}
export interface Rl312KhanzaSugesti {
  jenis_kode: string;
  count:      number;
  sumber:     string;
}
export interface Rl312KhanzaTop {
  kode:       string | null;
  deskripsi:  string | null;
  jumlah:     number;
}
export interface Rl312Khanza {
  total_prosedur_ranap: number;
  total_prosedur_ralan: number;
  sugesti_per_row:      Rl312KhanzaSugesti[];
  top_prosedur:         Rl312KhanzaTop[];
}
export interface Rl312Resp {
  bulan:   string;
  entries: Rl312Entry[];
  khanza:  Rl312Khanza;
}
export const getSirsRl312    = (bulan: string) =>
  api.get<Rl312Resp>(`/sirs/rl/3-12${bulan ? `?bulan=${bulan}` : ""}`);
export const updateSirsRl312 = (id: number, body: Rl312Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-12/${id}`, body);
export const cetakSirsRl312  = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/3-12/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.13 Rekap Pelayanan Rehabilitasi Medik (TAHUNAN) ─────────────────────
export interface Rl313Entry {
  id:          number | null;
  tahun:       string;
  urutan:      number | null;
  jenis_kode:  string;
  jenis_nama:  string;
  parent_kode: string | null;
  is_parent:   number;
  jumlah:      number | null;
  updated_at:  string | null;
  updated_by:  string | null;
}
export interface Rl313KhanzaSugesti {
  jenis_kode: string;
  count:      number;
  sumber:     string;
}
export interface Rl313KhanzaTop {
  nm_perawatan: string | null;
  jumlah:       number;
}
export interface Rl313Khanza {
  total_tindakan_rehab: number;
  sugesti_per_row:      Rl313KhanzaSugesti[];
  top_tindakan:         Rl313KhanzaTop[];
}
export interface Rl313Resp {
  tahun:   string;
  entries: Rl313Entry[];
  khanza:  Rl313Khanza;
}
export const getSirsRl313    = (tahun: string) =>
  api.get<Rl313Resp>(`/sirs/rl/3-13${tahun ? `?tahun=${tahun}` : ""}`);
export const updateSirsRl313 = (id: number, body: Rl313Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-13/${id}`, body);
export const cetakSirsRl313  = async (tahun: string) => {
  const res = await api.get<string>(`/sirs/rl/3-13/cetak${tahun ? `?tahun=${tahun}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.14 Rekap Pelayanan Khusus ───────────────────────────────────────────
export interface Rl314Entry {
  id:          number | null;
  bulan:       string;
  urutan:      number | null;
  jenis_kode:  string;
  jenis_nama:  string;
  parent_kode: string | null;
  is_parent:   number;
  jumlah:      number | null;
  updated_at:  string | null;
  updated_by:  string | null;
}
export interface Rl314KhanzaSugesti {
  jenis_kode: string;
  count:      number;
  sumber:     string;
}
export interface Rl314Khanza {
  sugesti_per_row: Rl314KhanzaSugesti[];
}
export interface Rl314Resp {
  bulan:   string;
  entries: Rl314Entry[];
  khanza:  Rl314Khanza;
}
export const getSirsRl314    = (bulan: string) =>
  api.get<Rl314Resp>(`/sirs/rl/3-14${bulan ? `?bulan=${bulan}` : ""}`);
export const updateSirsRl314 = (id: number, body: Rl314Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-14/${id}`, body);
export const cetakSirsRl314  = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/3-14/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.15 Rekap Pelayanan Kesehatan Jiwa (TAHUNAN) ─────────────────────────
export interface Rl315Entry {
  id:          number | null;
  tahun:       string;
  urutan:      number;
  jenis_kode:  string;
  jenis_nama:  string;
  jml_l:       number | null;
  jml_p:       number | null;
  updated_at:  string | null;
  updated_by:  string | null;
}
export interface Rl315KhanzaDx {
  kd_penyakit: string | null;
  nm_penyakit: string | null;
  jml:         number;
  jml_l:       number;
  jml_p:       number;
}
export interface Rl315Khanza {
  dx_f_total: number;
  dx_f_l:     number;
  dx_f_p:     number;
  top_dx_f:   Rl315KhanzaDx[];
}
export interface Rl315Resp {
  tahun:   string;
  entries: Rl315Entry[];
  khanza:  Rl315Khanza;
}
export const getSirsRl315    = (tahun: string) =>
  api.get<Rl315Resp>(`/sirs/rl/3-15${tahun ? `?tahun=${tahun}` : ""}`);
export const updateSirsRl315 = (id: number, body: Rl315Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-15/${id}`, body);
export const cetakSirsRl315  = async (tahun: string) => {
  const res = await api.get<string>(`/sirs/rl/3-15/cetak${tahun ? `?tahun=${tahun}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.16 Rekap Pelayanan Keluarga Berencana (TAHUNAN) ─────────────────────
export interface Rl316Entry {
  id:              number | null;
  tahun:           string;
  urutan:          number;
  jenis_kode:      string;
  jenis_nama:      string;
  pasca_persalinan: number | null;
  pasca_keguguran:  number | null;
  interval_kb:      number | null;
  komplikasi:       number | null;
  kegagalan:        number | null;
  efek_samping:     number | null;
  drop_out:         number | null;
  updated_at:      string | null;
  updated_by:      string | null;
}
export interface Rl316AkseptorRow {
  metode:           string;
  pasca_persalinan: number;
  pasca_keguguran:  number;
  interval_kb:      number;
  komplikasi:       number;
  kegagalan:        number;
  efek_samping:     number;
  drop_out:         number;
}
export interface Rl316Khanza {
  dx_z30_total:       number;
  prosedur_tubektomi: number;
  prosedur_vasektomi: number;
  prosedur_iud:       number;
  prosedur_implan:    number;
  akseptor_total:        number;
  akseptor_per_metode:   Rl316AkseptorRow[];
}
export interface Rl316Resp {
  tahun:   string;
  entries: Rl316Entry[];
  khanza:  Rl316Khanza;
}
export const getSirsRl316    = (tahun: string) =>
  api.get<Rl316Resp>(`/sirs/rl/3-16${tahun ? `?tahun=${tahun}` : ""}`);
export const updateSirsRl316 = (id: number, body: Rl316Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-16/${id}`, body);
export const cetakSirsRl316  = async (tahun: string) => {
  const res = await api.get<string>(`/sirs/rl/3-16/cetak${tahun ? `?tahun=${tahun}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.17 Farmasi RS Pengadaan Obat (TAHUNAN) ──────────────────────────────
export interface Rl317Entry {
  id:              number | null;
  tahun:           string;
  urutan:          number;
  jenis_kode:      string;
  jenis_nama:      string;
  jumlah_item:     number | null;
  jumlah_tersedia: number | null;
  updated_at:      string | null;
  updated_by:      string | null;
}
export interface Rl317Khanza {
  generik_total:      number;
  non_generik_total:  number;
  tanpa_kategori:     number;
  total_obat_aktif:   number;
}
export interface Rl317Resp {
  tahun:   string;
  entries: Rl317Entry[];
  khanza:  Rl317Khanza;
}
export const getSirsRl317    = (tahun: string) =>
  api.get<Rl317Resp>(`/sirs/rl/3-17${tahun ? `?tahun=${tahun}` : ""}`);
export const updateSirsRl317 = (id: number, body: Rl317Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-17/${id}`, body);
export const cetakSirsRl317  = async (tahun: string) => {
  const res = await api.get<string>(`/sirs/rl/3-17/cetak${tahun ? `?tahun=${tahun}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.18 Farmasi RS Resep (TAHUNAN) ───────────────────────────────────────
export interface Rl318Entry {
  id:          number | null;
  tahun:       string;
  urutan:      number;
  jenis_kode:  string;
  jenis_nama:  string;
  rawat_jalan: number | null;
  igd:         number | null;
  rawat_inap:  number | null;
  updated_at:  string | null;
  updated_by:  string | null;
}
export interface Rl318KhanzaRow {
  lokasi:   string;
  kategori: string | null;
  jml:      number;
}
export interface Rl318Khanza {
  total_resep_items:    number;
  per_lokasi_kategori:  Rl318KhanzaRow[];
}
export interface Rl318Resp {
  tahun:   string;
  entries: Rl318Entry[];
  khanza:  Rl318Khanza;
}
export const getSirsRl318    = (tahun: string) =>
  api.get<Rl318Resp>(`/sirs/rl/3-18${tahun ? `?tahun=${tahun}` : ""}`);
export const updateSirsRl318 = (id: number, body: Rl318Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-18/${id}`, body);
export const cetakSirsRl318  = async (tahun: string) => {
  const res = await api.get<string>(`/sirs/rl/3-18/cetak${tahun ? `?tahun=${tahun}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 3.19 Rekap Cara Bayar (TAHUNAN) ───────────────────────────────────────
export interface Rl319Entry {
  id:           number | null;
  tahun:        string;
  urutan:       number | null;
  jenis_kode:   string;
  jenis_nama:   string;
  parent_kode:  string | null;
  is_parent:    number;
  pasien_keluar:number | null;
  lama_dirawat: number | null;
  ralan_lab:    number | null;
  ralan_rad:    number | null;
  ralan_lain:   number | null;
  updated_at:   string | null;
  updated_by:   string | null;
}
export interface Rl319KhanzaSugesti {
  jenis_kode:    string;
  pasien_keluar: number;
  lama_dirawat:  number;
  ralan_lab:     number;
  ralan_rad:     number;
  ralan_lain:    number;
}
export interface Rl319KhanzaRaw {
  kd_pj:         string | null;
  png_jawab:     string | null;
  pasien_keluar: number;
  lama_dirawat:  number;
  ralan_lab:     number;
  ralan_rad:     number;
  ralan_total:   number;
}
export interface Rl319Khanza {
  raw_per_kd_pj:    Rl319KhanzaRaw[];
  sugesti_per_row:  Rl319KhanzaSugesti[];
}
export interface Rl319Resp {
  tahun:   string;
  entries: Rl319Entry[];
  khanza:  Rl319Khanza;
}
export const getSirsRl319    = (tahun: string) =>
  api.get<Rl319Resp>(`/sirs/rl/3-19${tahun ? `?tahun=${tahun}` : ""}`);
export const updateSirsRl319 = (id: number, body: Rl319Entry) =>
  api.put<{ success: boolean }>(`/sirs/rl/3-19/${id}`, body);
export const cetakSirsRl319  = async (tahun: string) => {
  const res = await api.get<string>(`/sirs/rl/3-19/cetak${tahun ? `?tahun=${tahun}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 4.1 Kompilasi Morbiditas Pasien Rawat Inap (BULANAN, realtime) ────────
export interface Rl41Row {
  kd_penyakit: string;
  nm_penyakit: string;
  cells_l:     number[];   // 25
  cells_p:     number[];   // 25
  mati_l:      number;
  mati_p:      number;
  total_l:     number;
  total_p:     number;
  total:       number;
  total_mati:  number;
}
export interface Rl41Resp {
  bulan:       string;
  umur_labels: string[];
  rows:        Rl41Row[];
  total_pasien_keluar: number;
  total_pasien_mati:   number;
}
export const getSirsRl41   = (bulan: string) =>
  api.get<Rl41Resp>(`/sirs/rl/4-1${bulan ? `?bulan=${bulan}` : ""}`);
export const cetakSirsRl41 = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/4-1/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 4.2 10 Besar Penyakit Ranap (BULANAN, realtime) ───────────────────────
export interface Rl42Row {
  no:          number;
  kd_penyakit: string;
  nm_penyakit: string;
  total_l:     number;
  total_p:     number;
  total:       number;
  mati_l:      number;
  mati_p:      number;
  total_mati:  number;
}
export interface Rl42Resp {
  bulan:       string;
  rows:        Rl42Row[];
  total_pasien_keluar: number;
  total_pasien_mati:   number;
}
export const getSirsRl42   = (bulan: string) =>
  api.get<Rl42Resp>(`/sirs/rl/4-2${bulan ? `?bulan=${bulan}` : ""}`);
export const cetakSirsRl42 = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/4-2/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 4.3 10 Besar Kematian Ranap (BULANAN, realtime) — same shape as Rl42 ──
export const getSirsRl43   = (bulan: string) =>
  api.get<Rl42Resp>(`/sirs/rl/4-3${bulan ? `?bulan=${bulan}` : ""}`);
export const cetakSirsRl43 = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/4-3/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 5.1 Kompilasi Morbiditas Pasien Rawat Jalan (BULANAN, realtime) ───────
export interface Rl51Row {
  kd_penyakit:       string;
  nm_penyakit:       string;
  baru_l_per_umur:   number[];   // 25
  baru_p_per_umur:   number[];   // 25
  total_baru_l:      number;
  total_baru_p:      number;
  total_baru:        number;
  kunjungan_l:       number;
  kunjungan_p:       number;
  kunjungan_total:   number;
}
export interface Rl51Resp {
  bulan:             string;
  umur_labels:       string[];
  rows:              Rl51Row[];
  total_kasus_baru:  number;
  total_kunjungan:   number;
}
export const getSirsRl51   = (bulan: string) =>
  api.get<Rl51Resp>(`/sirs/rl/5-1${bulan ? `?bulan=${bulan}` : ""}`);
export const cetakSirsRl51 = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/5-1/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── RL 5.2 / RL 5.3 — 10 Besar Kasus Baru / Kunjungan Ralan (BULANAN) ────────
export interface Rl52Row {
  no:              number;
  kd_penyakit:     string;
  nm_penyakit:     string;
  total_baru_l:    number;
  total_baru_p:    number;
  total_baru:      number;
  kunjungan_l:     number;
  kunjungan_p:     number;
  kunjungan_total: number;
}
export interface Rl52Resp {
  bulan:             string;
  rows:              Rl52Row[];
  total_kasus_baru:  number;
  total_kunjungan:   number;
}
export const getSirsRl52   = (bulan: string) =>
  api.get<Rl52Resp>(`/sirs/rl/5-2${bulan ? `?bulan=${bulan}` : ""}`);
export const cetakSirsRl52 = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/5-2/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
export const getSirsRl53   = (bulan: string) =>
  api.get<Rl52Resp>(`/sirs/rl/5-3${bulan ? `?bulan=${bulan}` : ""}`);
export const cetakSirsRl53 = async (bulan: string) => {
  const res = await api.get<string>(`/sirs/rl/5-3/cetak${bulan ? `?bulan=${bulan}` : ""}`,
    { responseType: "text", headers: { Accept: "text/html" } });
  const blob = new Blob([res.data], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ── BPJS Aplicare bed sync ───────────────────────────────────────────────────
export interface AplicareLog {
  id:      number | null;
  waktu:   string;       // YYYY-MM-DD HH:mm:ss
  level:   "info" | "success" | "error" | "warning" | string;
  message: string;
}
export interface AplicareConfig {
  aplicare_url: string;
  cons_id:      string;
  kode_ppk:     string;
  interval_min: number;
  jadwal:       string;
}
export const getAplicareLogs    = () => api.get<AplicareLog[]>("/aplicare/logs");
export const triggerAplicareSync = () => api.post<{ ok: boolean; message: string }>("/aplicare/sync");
export const clearAplicareLogs  = () => api.delete<{ ok: boolean; message: string }>("/aplicare/logs");
export const getAplicareStatus  = () => api.get<{ total_logs: number; last_log: AplicareLog | null }>("/aplicare/status");
export const getAplicareConfig  = () => api.get<AplicareConfig>("/aplicare/config");

// Dashboard ketersediaan tempat tidur — angka live, rumus sama dengan yang dikirim ke BPJS
export interface BedRuang {
  kode_kelas: string; kd_bangsal: string; nm_bangsal: string; kelas: string;
  kapasitas: number; tersedia: number;
}
export interface BedKelas { kode_kelas: string; jml_ruang: number; kapasitas: number; tersedia: number }
export interface BedBelumDipetakan {
  kd_bangsal: string; nm_bangsal: string; kelas: string; kapasitas: number; tersedia: number;
}
export interface AplicareBed {
  kapasitas: number; tersedia: number; terisi: number;
  per_kelas: BedKelas[]; per_ruang: BedRuang[];
  belum_dipetakan: BedBelumDipetakan[]; kapasitas_belum_dipetakan: number;
  sync_terakhir: AplicareLog | null;
  interval_min: number; waktu_server: string;
}
export const getAplicareBed = () => api.get<AplicareBed>("/aplicare/bed");

// Layar TV ketersediaan TT — endpoint publik (tanpa login), tanpa data pasien
export interface DisplayBed {
  kapasitas: number; tersedia: number; terisi: number;
  per_kelas: BedKelas[]; per_ruang: BedRuang[]; waktu_server: string;
}
export const getDisplayBed = () => api.get<DisplayBed>("/display/tempat-tidur");

// ── SIRANAP (ketersediaan TT ke RS Online v3 Kemenkes) ───────────────────────
export interface SiranapLog {
  id:      number | null;
  waktu:   string;
  level:   "info" | "success" | "error" | "warning" | string;
  message: string;
}
export interface SiranapConfig {
  siranap_url:  string;
  rs_id:        string;
  interval_min: number;
  jadwal:       string;
}
export const getSiranapLogs    = () => api.get<SiranapLog[]>("/siranap/logs");
export const triggerSiranapSync = () => api.post<{ ok: boolean; message: string }>("/siranap/sync");
export const clearSiranapLogs  = () => api.delete<{ ok: boolean; message: string }>("/siranap/logs");
export const getSiranapStatus  = () => api.get<{ total_logs: number; last_log: SiranapLog | null }>("/siranap/status");
export const getSiranapConfig  = () => api.get<SiranapConfig>("/siranap/config");

// ── SatuSehat (FHIR R4 auto-sync RME) ────────────────────────────────────────
export interface SatuSehatLog {
  id:      number | null;
  waktu:   string;
  level:   "info" | "success" | "error" | "warning" | string;
  message: string;
}
export interface SatuSehatConfig {
  fhir_url:     string;
  org_id:       string;
  interval_min: number;
  window_days:  number;
  jadwal:       string;
}
export const getSatuSehatLogs    = () => api.get<SatuSehatLog[]>("/satusehat/logs");
export const triggerSatuSehatSync = (body?: { resources?: string[]; tgl_awal?: string; tgl_akhir?: string }) => api.post<{ ok: boolean; message: string }>("/satusehat/sync", body ?? {});
export const clearSatuSehatLogs  = () => api.delete<{ ok: boolean; message: string }>("/satusehat/logs");
export const getSatuSehatStatus  = () => api.get<{ total_logs: number; last_log: SatuSehatLog | null }>("/satusehat/status");
export const getSatuSehatConfig  = () => api.get<SatuSehatConfig>("/satusehat/config");

// ── Mobile JKN — Antrean RS: kirim task-id event-driven + dashboard SSE ──────
export interface MobileJknEvent {
  no_rawat:    string;
  kodebooking: string;
  taskid:      string;
  waktu_ms:    string;
  status:      "sukses" | "gagal" | "skip" | string;
  code:        string;
  message:     string;
  nama:        string;
  poli:        string;
  jam:         string;
}
export interface MobileJknLogRow {
  tgl_registrasi: string | null;
  kd_booking:     string | null;
  taskid:         string | null;
  petugas:        string | null;
  waktu:          string | null;
  nama:           string | null;
  no_rawat:       string | null;
  poli:           string | null;
  kode_respon:    string | null;
  respon:         string | null;
}
export const getMobileJknLog = () =>
  api.get<{ data: MobileJknLogRow[] }>("/mobilejkn/log");
export const sendMobileJknEvent = (body: {
  no_rawat: string; taskid: string;
  waktu?: string; kodebooking?: string; nama?: string; poli?: string;
  tgl_registrasi?: string; source?: string;
}) => api.post<{ status: string; code: string; message: string }>("/mobilejkn/event", body);

// SSE stream URL untuk event Mobile JKN task-id
export const MOBILEJKN_STREAM_URL = `${API_BASE}/mobilejkn/stream`;

// ── KLPCM — Ketidaklengkapan Pengisian Catatan Medis (MRMIK 12.b/c/d) ────────
export type KlpcmKategori = "identitas" | "anamnesa" | "pengkajian" | "dpjp" | "resume" | "informed_consent";
export type KlpcmStatus   = "draft" | "final" | "revisi";

export interface KlpcmAudit {
  id:               number;
  bulan:            string;
  no_rawat:         string;
  no_rkm_medis:     string | null;
  nama_pasien:      string | null;
  tgl_masuk:        string | null;
  tgl_keluar:       string | null;
  bangsal:          string | null;
  dpjp:             string | null;
  auditor_nip:      string | null;
  tanggal_audit:    string;
  score_identitas:  number;
  score_anamnesa:   number;
  score_pengkajian: number;
  score_dpjp:       number;
  score_resume:     number;
  score_total:      number;
  status:           KlpcmStatus;
  catatan:          string | null;
  created_at:       string | null;
  updated_at:       string | null;
  updated_by:       string | null;
}
export interface KlpcmTemuan {
  id:        number;
  audit_id:  number;
  kategori:  KlpcmKategori;
  urutan:    number;
  item:      string;
  lengkap:   number;     // 0 | 1
  catatan:   string | null;
}
export interface KlpcmDetail { audit: KlpcmAudit; temuan: KlpcmTemuan[]; }
export interface KlpcmRingkasan {
  total_audit:     number;
  draft:           number; final: number;
  bawah_target_80: number;
  avg_total:       number; avg_identitas: number; avg_anamnesa: number;
  avg_pengkajian:  number; avg_dpjp: number; avg_resume: number;
  target_pct:      number;
  rm_lengkap:       number;
  pct_rm_lengkap:   number;
  rm_tidak_lengkap?:     number;
  pct_ketidaklengkapan?: number;
  target_kamus_100: number;
  ic_audit:         number;
  ic_lengkap:       number;
  pct_ic_lengkap:   number;
}
export interface KlpcmLaporan {
  bulan:           string;
  ringkasan:       KlpcmRingkasan;
  trend_12_bulan:  { bulan: string; total: number; avg_total: number | null }[];
  score_terendah:  { id: number; no_rawat: string; nama_pasien: string | null; bangsal: string | null; score_total: number; status: KlpcmStatus }[];
}

export const klpcmSampling     = (bulan: string, n: number) =>
  api.post<{ ok: boolean; bulan: string; sampled: number; inserted: number; skipped: number; message?: string }>(
    `/klpcm/sampling?bulan=${bulan}&n=${n}`);
export const klpcmListAudit    = (params: { bulan?: string; status?: string; q?: string }) => {
  const sp = new URLSearchParams();
  if (params.bulan)  sp.set("bulan", params.bulan);
  if (params.status) sp.set("status", params.status);
  if (params.q)      sp.set("q", params.q);
  const qs = sp.toString();
  return api.get<KlpcmAudit[]>(`/klpcm/audit${qs ? `?${qs}` : ""}`);
};
export const klpcmDetail       = (id: number) =>
  api.get<KlpcmDetail>(`/klpcm/audit/${id}`);
export const klpcmUpdateTemuan = (audit_id: number, tid: number, body: { lengkap: number; catatan: string | null }) =>
  api.put<{ ok: boolean; score: Record<string, number> }>(`/klpcm/audit/${audit_id}/temuan/${tid}`, body);
export const klpcmUpdateAudit  = (id: number, body: { status?: KlpcmStatus; catatan?: string | null; auditor_nip?: string | null }) =>
  api.put<{ ok: boolean }>(`/klpcm/audit/${id}`, body);
export const klpcmDeleteAudit  = (id: number) =>
  api.delete<{ ok: boolean }>(`/klpcm/audit/${id}`);
export const klpcmLaporan      = (bulan: string) =>
  api.get<KlpcmLaporan>(`/klpcm/laporan?bulan=${bulan}`);

// ── MRMIK 2.2 EP 1 — Keamanan Fisik Ruang RM ────────────────────────────────
export interface MrmikSuhu { id: number; tanggal: string; jam: string | null; suhu: number | null; kelembaban: number | null; status: string; keterangan: string | null; nama_petugas: string | null; }
export interface MrmikApar { id: number; tanggal: string; jam?: string; lokasi: string; jenis: string; tekanan: string; segel: string; selang: string; kondisi_isi: string; tgl_kadaluarsa: string | null; keterangan: string | null; nama_petugas: string | null; }
export interface MrmikCctv { id: number; tanggal: string; jam?: string; lokasi: string; berfungsi: string; kualitas: string; durasi_rekaman_hari: number | null; keterangan: string | null; nama_petugas: string | null; }
export const mrmikSuhuList = (bulan: string) => api.get<{ bulan: string; ringkasan: { total: number; baik: number; perlu_tindakan: number }; data: MrmikSuhu[] }>(`/mrmik/suhu?bulan=${bulan}`);
export const mrmikSuhuCreate = (b: { tanggal: string; jam?: string; suhu?: number; kelembaban?: number; status?: string; keterangan?: string }) => api.post<{ ok: boolean }>("/mrmik/suhu", b);
export const mrmikSuhuDelete = (id: number) => api.delete<{ ok: boolean }>(`/mrmik/suhu/${id}`);
export const mrmikAparList = (bulan: string) => api.get<{ bulan: string; data: MrmikApar[] }>(`/mrmik/apar?bulan=${bulan}`);
export const mrmikAparCreate = (b: { tanggal: string; jam?: string; lokasi: string; jenis?: string; tekanan?: string; segel?: string; selang?: string; kondisi_isi?: string; tgl_kadaluarsa?: string; keterangan?: string }) => api.post<{ ok: boolean }>("/mrmik/apar", b);
export const mrmikAparDelete = (id: number) => api.delete<{ ok: boolean }>(`/mrmik/apar/${id}`);
export const mrmikCctvList = (bulan: string) => api.get<{ bulan: string; data: MrmikCctv[] }>(`/mrmik/cctv?bulan=${bulan}`);
export const mrmikCctvCreate = (b: { tanggal: string; jam?: string; lokasi: string; berfungsi?: string; kualitas?: string; durasi_rekaman_hari?: number; keterangan?: string }) => api.post<{ ok: boolean }>("/mrmik/cctv", b);
export const mrmikCctvDelete = (id: number) => api.delete<{ ok: boolean }>(`/mrmik/cctv/${id}`);

// ── Laporan Integrasi Data MRMIK 2 EP 2 (agregasi lintas modul) ──────────────
export interface MrmikIntegrasi {
  periode: { tahun: number; triwulan: number; tgl_awal: string; tgl_akhir: string; hari: number };
  ranap: { tt: number; bor: number; alos: number; toi: number; bto: number; hari_rawat: number; pasien_keluar: number };
  kunjungan: { ralan: number; igd: number; ranap: number };
  penyakit10: { nama: string; jumlah: number }[];
  mutu: { kode: string; judul: string; jenis: string; target: string; satuan: string; capaian: number | null }[];
  ikp: { jenis: string; jumlah: number }[];
  hais: { jenis: string; jumlah: number; denominator: number | null; rate: number | null; ket?: string }[];
  k3rs: { jenis: string; jumlah: number }[];
  kepuasan: { nilai: number | null; responden: number };
}
export const getMrmikIntegrasi = (tahun: number, triwulan: number) =>
  api.get<MrmikIntegrasi>(`/mrmik/integrasi?tahun=${tahun}&triwulan=${triwulan}`);

// Editan laporan tersimpan di DB (mis. Bagian III MRMIK 2 = "mrmik2_keputusan").
export const getLaporanEditan = (jenis: string, tahun: number, triwulan: number) =>
  api.get<{ konten: unknown }>(`/laporan/editan?jenis=${encodeURIComponent(jenis)}&tahun=${tahun}&triwulan=${triwulan}`);
export const saveLaporanEditan = (jenis: string, tahun: number, triwulan: number, konten: unknown) =>
  api.post<{ ok: boolean }>(`/laporan/editan`, { jenis, tahun, triwulan, konten });

// Laporan Hasil Evaluasi Insiden (IKP) — agregasi dari PMKP Insiden per triwulan.
export interface MrmikIkp {
  periode: { tahun: number; triwulan: number; tgl_awal: string; tgl_akhir: string };
  jumlah_laporan: number;
  per_jenis: { label: string; jumlah: number }[];
  per_grading: { label: string; jumlah: number }[];
  per_tipe: { label: string; jumlah: number }[];
  per_bulan: { label: string; jumlah: number }[];
  per_unit: { label: string; jumlah: number }[];
  ketepatan_2x24: number;
  linelist: { jenis: string; tipe: string; judul: string; kronologi: string; grading: string; tanggal: string }[];
}
export const getMrmikIkp = (tahun: number, triwulan: number) =>
  api.get<MrmikIkp>(`/mrmik/ikp?tahun=${tahun}&triwulan=${triwulan}`);

// ── Keamanan Jaringan & Anti-Malware (MRMIK keamanan informasi) ──────────────
export interface KeamananJaringan {
  id: number;
  tanggal: string;
  jenis: string;             // "Jaringan" | "Anti-Malware"
  kegiatan: string;
  perangkat: string | null;
  ip_address: string | null;
  antivirus: string | null;
  versi_definisi: string | null;
  hasil: string | null;
  temuan: string | null;
  tindak_lanjut: string | null;
  status: string;
  petugas: string | null;
  petugas_nip: string | null;
  keterangan: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
export type KeamananJaringanInput = Omit<KeamananJaringan, "id" | "created_at" | "updated_at">;
export const listKeamananJaringan = (params: { tahun?: number; jenis?: string; status?: string; q?: string } = {}) => {
  const s = new URLSearchParams();
  if (params.tahun) s.set("tahun", String(params.tahun));
  if (params.jenis) s.set("jenis", params.jenis);
  if (params.status) s.set("status", params.status);
  if (params.q) s.set("q", params.q);
  return api.get<KeamananJaringan[]>(`/keamanan-jaringan?${s.toString()}`);
};
export const createKeamananJaringan = (b: Partial<KeamananJaringanInput>) =>
  api.post<{ ok: boolean; id: number }>(`/keamanan-jaringan`, b);
export const updateKeamananJaringan = (id: number, b: Partial<KeamananJaringanInput>) =>
  api.put<{ ok: boolean }>(`/keamanan-jaringan/${id}`, b);
export const deleteKeamananJaringan = (id: number) =>
  api.delete<{ ok: boolean }>(`/keamanan-jaringan/${id}`);
export interface KeamananJaringanLaporan {
  tahun: number; total: number; ada_temuan: number;
  per_jenis: { jenis: string; jumlah: number }[];
  per_bulan: { bulan: number; jumlah: number }[];
}
export const getKeamananJaringanLaporan = (tahun: number) =>
  api.get<KeamananJaringanLaporan>(`/keamanan-jaringan/laporan?tahun=${tahun}`);
export const klpcmAutoCheck    = (id: number) =>
  api.post<{ ok: boolean; items_updated: number; items_ok: number; items_total: number }>(`/klpcm/audit/${id}/autocheck`, {});

// ── Downtime SIMRS (MRMIK 13.1) ──────────────────────────────────────────────
export type DowntimeJenis    = "planned" | "incident";
export type DowntimeKategori = "jaringan" | "listrik" | "aplikasi" | "server" | "database" | "perangkat_keras" | "lainnya";
export type DowntimeStatus   = "aktif" | "selesai" | "dievaluasi";

export interface DowntimeRow {
  id:               number;
  tanggal_mulai:    string;
  tanggal_selesai:  string | null;
  durasi_menit:     number | null;
  jenis:            DowntimeJenis;
  kategori:         DowntimeKategori;
  unit_terdampak:   string | null;
  judul:            string;
  dampak:           string | null;
  prosedur_manual:  string | null;
  root_cause:       string | null;
  tindakan:         string | null;
  evaluasi_pasca:   string | null;
  rca_complete:     number;
  staf_terlatih:    number;
  status:           DowntimeStatus;
  pic_nip:          string | null;
  pelapor_nip:      string | null;
  created_at:       string | null;
  updated_at:       string | null;
  updated_by:       string | null;
}
export interface DowntimeUpsertBody {
  tanggal_mulai:   string;
  tanggal_selesai: string | null;
  jenis:           DowntimeJenis;
  kategori:        DowntimeKategori;
  unit_terdampak:  string | null;
  judul:           string;
  dampak:          string | null;
  prosedur_manual: string | null;
  root_cause:      string | null;
  tindakan:        string | null;
  evaluasi_pasca:  string | null;
  rca_complete:    number;
  staf_terlatih:   number;
  status:          DowntimeStatus;
  pic_nip?:        string | null;
  pelapor_nip?:    string | null;
}
export interface DowntimeLaporan {
  tahun: number;
  ringkasan: {
    total_kejadian: number; aktif: number; selesai: number; dievaluasi: number;
    rca_complete:   number; staf_terlatih: number;
    total_menit:    number; avg_menit: number; max_menit: number;
  };
  per_kategori: { kategori: string; total: number; total_menit: number | null }[];
  per_bulan:    { bulan: number; total: number; total_menit: number | null }[];
}

export const downtimeList = (params: { tahun?: number; status?: string; kategori?: string; jenis?: string; q?: string }) => {
  const sp = new URLSearchParams();
  if (params.tahun)    sp.set("tahun", String(params.tahun));
  if (params.status)   sp.set("status", params.status);
  if (params.kategori) sp.set("kategori", params.kategori);
  if (params.jenis)    sp.set("jenis", params.jenis);
  if (params.q)        sp.set("q", params.q);
  const qs = sp.toString();
  return api.get<DowntimeRow[]>(`/downtime${qs ? `?${qs}` : ""}`);
};
export const downtimeGet     = (id: number) => api.get<DowntimeRow>(`/downtime/${id}`);
export const downtimeCreate  = (b: DowntimeUpsertBody) => api.post<{ ok: boolean; id: number }>(`/downtime`, b);
export const downtimeUpdate  = (id: number, b: DowntimeUpsertBody) => api.put<{ ok: boolean }>(`/downtime/${id}`, b);
export const downtimeDelete  = (id: number) => api.delete<{ ok: boolean }>(`/downtime/${id}`);
export const downtimeLaporan = (tahun: number) => api.get<DowntimeLaporan>(`/downtime/laporan?tahun=${tahun}`);

// ── Retensi & Pemusnahan RM (MRMIK 11.b/c) ───────────────────────────────────
export type PemusnahanStatus = "draft" | "usulan" | "disetujui" | "dilaksanakan" | "selesai";
export type PemusnahanCara   = "dibakar" | "dicacah" | "elektronik" | "alih_media" | "lainnya";
export type JenisBerkas      = "rm_fisik" | "rm_elektronik" | "informed_consent" | "resume" | "radiologi" | "lab" | "lainnya";
export type StatusBerkas     = "akan_dimusnahkan" | "disimpan_lanjutan" | "dimusnahkan" | "batal";

export interface PemusnahanBatch {
  id:                   number;
  no_batch:             string;
  tahun_pelaksanaan:    number;
  tanggal_berita_acara: string | null;
  no_berita_acara:      string | null;
  retensi_thn_aktif:    number;
  retensi_thn_inaktif:  number;
  retensi_thn_rme:      number;
  cara_pemusnahan:      PemusnahanCara;
  judul:                string;
  catatan:              string | null;
  ttd_kepala_rm_nip:    string | null;
  ttd_direktur_nip:     string | null;
  pelaksana_nip:        string | null;
  status:               PemusnahanStatus;
  jumlah_berkas:        number;
  jumlah_dimusnahkan:   number;
  created_at:           string | null;
  updated_at:           string | null;
  updated_by:           string | null;
}
export interface PemusnahanDetail {
  id:                     number;
  batch_id:               number;
  no_rkm_medis:           string;
  nama_pasien:            string | null;
  tgl_kunjungan_terakhir: string | null;
  tgl_lahir:              string | null;
  jenis_berkas:           JenisBerkas;
  status_berkas:          StatusBerkas;
  alasan_disimpan:        string | null;
  catatan:                string | null;
}
export interface PemusnahanUpsertBatchBody {
  no_batch:             string;
  tahun_pelaksanaan:    number;
  tanggal_berita_acara: string | null;
  no_berita_acara:      string | null;
  retensi_thn_aktif?:   number;
  retensi_thn_inaktif?: number;
  retensi_thn_rme?:     number;
  cara_pemusnahan?:     PemusnahanCara;
  judul:                string;
  catatan:              string | null;
  ttd_kepala_rm_nip?:   string | null;
  ttd_direktur_nip?:    string | null;
  pelaksana_nip?:       string | null;
  status?:              PemusnahanStatus;
}
export interface PemusnahanUpsertDetailBody {
  no_rkm_medis:           string;
  nama_pasien?:           string | null;
  tgl_kunjungan_terakhir?: string | null;
  tgl_lahir?:             string | null;
  jenis_berkas?:          JenisBerkas;
  status_berkas?:         StatusBerkas;
  alasan_disimpan?:       string | null;
  catatan?:               string | null;
}
export interface PemusnahanSugestiResp {
  ok:              boolean;
  jenis_berkas?:   JenisBerkas;
  batas_tahun:     number;
  total_kandidat:  number;
  added_to_batch:  number;
  kandidat:        {
    no_rkm_medis:           string;
    nama_pasien:            string | null;
    tgl_lahir:              string | null;
    tgl_kunjungan_terakhir: string | null;
  }[];
}
export interface PemusnahanLaporan {
  tahun: number;
  ringkasan: {
    total_batch: number; total_berkas: number;
    total_dimusnahkan: number; total_disimpan_lanjutan: number;
  };
  per_status: { status: string; total: number }[];
}

export const pemusnahanListBatch = (p: { tahun?: number; status?: string }) => {
  const sp = new URLSearchParams();
  if (p.tahun) sp.set("tahun", String(p.tahun));
  if (p.status) sp.set("status", p.status);
  const qs = sp.toString();
  return api.get<PemusnahanBatch[]>(`/pemusnahan-rm${qs ? `?${qs}` : ""}`);
};
export const pemusnahanGetBatch    = (id: number) => api.get<PemusnahanBatch>(`/pemusnahan-rm/${id}`);
export const pemusnahanCreateBatch = (b: PemusnahanUpsertBatchBody) => api.post<{ ok: boolean; id: number }>(`/pemusnahan-rm`, b);
export const pemusnahanUpdateBatch = (id: number, b: PemusnahanUpsertBatchBody) => api.put<{ ok: boolean }>(`/pemusnahan-rm/${id}`, b);
export const pemusnahanDeleteBatch = (id: number) => api.delete<{ ok: boolean }>(`/pemusnahan-rm/${id}`);
export const pemusnahanListDetail  = (id: number) => api.get<PemusnahanDetail[]>(`/pemusnahan-rm/${id}/detail`);
export const pemusnahanAddDetail   = (id: number, b: PemusnahanUpsertDetailBody) => api.post<{ ok: boolean; id: number }>(`/pemusnahan-rm/${id}/detail`, b);
export const pemusnahanUpdateDetail = (id: number, did: number, b: PemusnahanUpsertDetailBody) => api.put<{ ok: boolean }>(`/pemusnahan-rm/${id}/detail/${did}`, b);
export const pemusnahanDeleteDetail = (id: number, did: number) => api.delete<{ ok: boolean }>(`/pemusnahan-rm/${id}/detail/${did}`);
export const pemusnahanSugesti     = (p: { batch_id?: number; jenis_berkas?: JenisBerkas; batas_tahun?: number; limit?: number; auto_add?: boolean }) => {
  const sp = new URLSearchParams();
  if (p.batch_id)     sp.set("batch_id", String(p.batch_id));
  if (p.jenis_berkas) sp.set("jenis_berkas", p.jenis_berkas);
  if (p.batas_tahun)  sp.set("batas_tahun", String(p.batas_tahun));
  if (p.limit)        sp.set("limit", String(p.limit));
  if (p.auto_add)     sp.set("auto_add", "true");
  return api.get<PemusnahanSugestiResp>(`/pemusnahan-rm/sugesti?${sp}`);
};
export const pemusnahanLaporan     = (tahun: number) => api.get<PemusnahanLaporan>(`/pemusnahan-rm/laporan?tahun=${tahun}`);

// ── Admin: Permission Management ─────────────────────────────────────────────
export interface PermEntry {
  key:      string;
  label:    string;
  kategori: string;
}
export interface PermUser {
  nip:  string;
  nama: string;
}
export interface UserPermRow {
  nip:        string;
  perm_key:   string;
  enabled:    number;
  granted_at: string | null;
  granted_by: string | null;
}

export const getPermRegistry = () =>
  api.get<{ registry: PermEntry[] }>("/admin/permissions/registry");
export const getPermUsers    = () =>
  api.get<{ users: PermUser[] }>("/admin/permissions/users");
export const getUserPerms    = (nip: string) =>
  api.get<{ nip: string; perms: UserPermRow[] }>(`/admin/permissions/user/${encodeURIComponent(nip)}`);
export const setUserPerms    = (nip: string, perms: Record<string, boolean>) =>
  api.put<{ success: boolean; nip: string; count_enabled: number }>(
    `/admin/permissions/user/${encodeURIComponent(nip)}`, { perms });

// ── Pelayanan Keluarga Berencana (transactional per pasien) ──────────────────
export type KbMetode = "Tubektomi" | "Vasektomi" | "Implan" | "IUD" | "Suntik" | "Pil" | "Kondom" | "MAL";
export type KbJenisPelayanan = "Pasca Persalinan" | "Pasca Keguguran" | "Interval";

export interface KbPelayananRow {
  id:                number | null;
  no_rawat:          string | null;
  no_rkm_medis:      string;
  nama_pasien:       string | null;
  tanggal:           string;     // YYYY-MM-DD
  jam:               string | null;
  metode:            KbMetode;
  jenis_pelayanan:   KbJenisPelayanan;
  komplikasi:        number;
  ket_komplikasi:    string | null;
  kegagalan:         number;
  ket_kegagalan:     string | null;
  efek_samping:      number;
  ket_efek_samping:  string | null;
  drop_out:          number;
  ket_drop_out:      string | null;
  catatan:           string | null;
  nip:               string | null;
  created_at:        string | null;
  updated_at:        string | null;
  updated_by:        string | null;
}
export interface KbPasienLookup {
  no_rkm_medis: string;
  nm_pasien:    string | null;
  jk:           string | null;
  tgl_lahir:    string | null;
}
export interface KbAgregatJenis  { metode: KbMetode; jenis_pelayanan: KbJenisPelayanan; jml: number; }
export interface KbAgregatEfek   { metode: KbMetode; komplikasi: number; kegagalan: number; efek_samping: number; drop_out: number; }
export interface KbAgregatResp   { tahun: string; total: number; by_jenis: KbAgregatJenis[]; by_efek: KbAgregatEfek[]; }

export const listKbPelayanan   = (params: { tahun?: string; bulan?: string; metode?: string; no_rkm?: string }) => {
  const sp = new URLSearchParams();
  if (params.tahun)  sp.set("tahun", params.tahun);
  if (params.bulan)  sp.set("bulan", params.bulan);
  if (params.metode) sp.set("metode", params.metode);
  if (params.no_rkm) sp.set("no_rkm", params.no_rkm);
  const qs = sp.toString();
  return api.get<{ data: KbPelayananRow[]; from: string; to: string }>(`/kb-pelayanan${qs ? `?${qs}` : ""}`);
};
export const detailKbPelayanan = (id: number) =>
  api.get<{ data: KbPelayananRow }>(`/kb-pelayanan/${id}`);
export const createKbPelayanan = (body: KbPelayananRow) =>
  api.post<{ success: boolean; id: number }>(`/kb-pelayanan`, body);
export const updateKbPelayanan = (id: number, body: KbPelayananRow) =>
  api.put<{ success: boolean }>(`/kb-pelayanan/${id}`, body);
export const deleteKbPelayanan = (id: number) =>
  api.delete<{ success: boolean }>(`/kb-pelayanan/${id}`);
export const lookupPasienKb    = (q: string) =>
  api.get<{ data: KbPasienLookup[] }>(`/kb-pelayanan/lookup-pasien?q=${encodeURIComponent(q)}`);
export const agregatKbPelayanan = (tahun: string) =>
  api.get<KbAgregatResp>(`/kb-pelayanan/agregat${tahun ? `?tahun=${tahun}` : ""}`);

// ── Log Kinerja Pegawai ──────────────────────────────────────────────────────
export interface LogKinerjaRow {
  id: number;
  nip: string;
  nama_pegawai: string | null;
  tanggal: string;           // YYYY-MM-DD
  jam_mulai: string;         // HH:MM
  jam_selesai: string | null;
  judul: string;
  deskripsi: string | null;
  lokasi: string | null;
  foto_count: number;
}
export interface LogKinerjaFotoRow {
  id: number;
  log_id: number;
  url_image: string;
  caption: string | null;
  uploaded_at: string;
}
export interface SimpanLogKinerjaBody {
  tanggal: string;           // YYYY-MM-DD
  jam_mulai: string;         // HH:MM
  jam_selesai?: string;
  judul: string;
  deskripsi?: string;
  lokasi?: string;
}
export interface RekapHarianRow {
  tanggal: string;
  jumlah_log: number;
  total_menit: number | null;
  judul_list: string | null;
}

export const listLogKinerja = (params: { tanggal?: string; from?: string; to?: string; nip?: string }) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
  return api.get<{ data: LogKinerjaRow[] }>(`/log-kinerja?${p}`);
};
export const detailLogKinerja = (id: number) =>
  api.get<{ data: LogKinerjaRow; fotos: LogKinerjaFotoRow[] }>(`/log-kinerja/${id}`);
export const buatLogKinerja = (data: SimpanLogKinerjaBody) =>
  api.post<{ success: boolean; id: number }>("/log-kinerja", data);
export const editLogKinerja = (id: number, data: SimpanLogKinerjaBody) =>
  api.put<{ success: boolean }>(`/log-kinerja/${id}`, data);
export const hapusLogKinerja = (id: number) =>
  api.delete<{ success: boolean }>(`/log-kinerja/${id}`);
export const uploadLogKinerjaFoto = (id: number, body: { foto_base64: string; caption?: string }) =>
  api.post<{ success: boolean; foto_id: number; url_image: string }>(`/log-kinerja/${id}/foto`, body);
export const hapusLogKinerjaFoto = (id: number, fotoId: number) =>
  api.delete<{ success: boolean }>(`/log-kinerja/${id}/foto/${fotoId}`);
export const rekapLogKinerja = (params: { nip?: string; bulan?: string }) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
  return api.get<{ data: RekapHarianRow[]; bulan: string; nip: string; total_log: number; total_menit: number }>(`/log-kinerja/rekap?${p}`);
};

// ── Monev SIMRS (WBK ZI) ─────────────────────────────────────────────────────
export type MonevSumber    = "helpdesk" | "user" | "rapat" | "log_bridging" | "git" | "monitoring";
export type MonevKategori  = "bug" | "performa" | "integrasi" | "fitur" | "data" | "lainnya";
export type MonevPrioritas = "rendah" | "sedang" | "tinggi" | "kritis";
export type MonevStatus    = "baru" | "proses" | "selesai" | "ditutup";

export interface MonevRow {
  id:                 number;
  kode:               string;
  tanggal_lapor:      string;
  sumber:             MonevSumber;
  unit_terdampak:     string | null;
  kategori:           MonevKategori;
  prioritas:          MonevPrioritas;
  deskripsi_masalah:  string;
  akar_masalah:       string | null;
  tindakan_perbaikan: string | null;
  tanggal_selesai:    string | null;
  hasil_verifikasi:   string | null;
  status:             MonevStatus;
  pic:                string | null;
  created_at:         string;
  updated_at:         string;
}

export interface MonevLampiran {
  id:            number;
  monev_id:      number;
  nama_berkas:   string;
  path_atau_url: string;
  keterangan:    string | null;
  created_at:    string;
}

export interface MonevListResp {
  items:  MonevRow[];
  total:  number;
  limit:  number;
  offset: number;
}

export interface MonevDetailResp {
  monev:    MonevRow;
  lampiran: MonevLampiran[];
}

export interface MonevStats {
  periode:        { dari: string; sampai: string };
  total:          number;
  selesai:        number;
  proses:         number;
  baru:           number;
  ditutup:        number;
  pct_selesai:    number;
  per_kategori:   Array<{ name: string; total: number }>;
  per_prioritas:  Array<{ name: string; total: number }>;
  per_sumber:     Array<{ name: string; total: number }>;
  per_bulan:      Array<{ bulan: string; total: number; selesai: number }>;
  jumlah_rapat:   number;
}

export interface MonevRapat {
  id:           number;
  tanggal:      string;
  judul:        string;
  ringkasan:    string | null;
  path_notulen: string | null;
  created_at:   string;
}

export const listMonev = (q: {
  dari?: string; sampai?: string; status?: MonevStatus; kategori?: MonevKategori;
  prioritas?: MonevPrioritas; sumber?: MonevSumber; unit?: string; q?: string;
  limit?: number; offset?: number; sort?: string;
}) => {
  const sp = new URLSearchParams();
  Object.entries(q).forEach(([k,v]) => {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  });
  return api.get<MonevListResp>(`/monev?${sp.toString()}`);
};

export const detailMonev = (id: number) =>
  api.get<MonevDetailResp>(`/monev/${id}`);

export const createMonev = (b: Partial<MonevRow>) =>
  api.post<MonevRow>("/monev", b);

export const updateMonev = (id: number, b: Partial<MonevRow>) =>
  api.put<MonevRow>(`/monev/${id}`, b);

export const deleteMonev = (id: number) =>
  api.delete<{ ok: boolean }>(`/monev/${id}`);

export const getMonevStats = (dari?: string, sampai?: string) => {
  const sp = new URLSearchParams();
  if (dari) sp.set("dari", dari);
  if (sampai) sp.set("sampai", sampai);
  return api.get<MonevStats>(`/monev/stats?${sp.toString()}`);
};

export const exportMonevCsv = (q: Parameters<typeof listMonev>[0]) => {
  const sp = new URLSearchParams();
  Object.entries(q).forEach(([k,v]) => {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  });
  return `/api/monev/export.csv?${sp.toString()}`;
};

export const ingestMonevBatch = (items: Array<Partial<MonevRow> & {
  tanggal_lapor: string; sumber: MonevSumber; kategori: MonevKategori; deskripsi_masalah: string;
}>) => api.post<{ berhasil: number; gagal: number; errors: string[] }>("/monev/ingest/batch", { items });

export const listMonevRapat = (dari?: string, sampai?: string) => {
  const sp = new URLSearchParams();
  if (dari) sp.set("dari", dari);
  if (sampai) sp.set("sampai", sampai);
  return api.get<MonevRapat[]>(`/monev/rapat?${sp.toString()}`);
};

export const createMonevRapat = (b: {
  tanggal: string; judul: string; ringkasan?: string; path_notulen?: string;
}) => api.post<{ ok: boolean; id: number }>("/monev/rapat", b);

export const deleteMonevRapat = (id: number) =>
  api.delete<{ ok: boolean }>(`/monev/rapat/${id}`);

export const addMonevLampiran = (id: number, b: { nama_berkas: string; path_atau_url: string; keterangan?: string }) =>
  api.post<{ ok: boolean }>(`/monev/${id}/lampiran`, b);

export const deleteMonevLampiran = (id: number) =>
  api.delete<{ ok: boolean }>(`/monev/lampiran/${id}`);

// ── PPRA — Surveilans Antimikroba (DDD/AWaRe + Gyssens) ──────────────────────
export type AdmRoute = "O" | "P" | "R" | "Inhal" | "Instill" | "other";
export type DddSatuan = "g" | "mg" | "MU" | "TU" | "U" | "ml";
export type AwareKategori = "Access" | "Watch" | "Reserve" | "Not_recommended";

export interface PpraAtc {
  atc_code: string;
  adm_route: AdmRoute;
  nama_generik: string;
  ddd: number;
  ddd_satuan: DddSatuan;
  aware_kategori: AwareKategori;
  who_edisi: number;
  keterangan?: string | null;
}
export interface PpraMap {
  kode_brng: string;
  nama_brng?: string | null;
  atc_code: string;
  adm_route: AdmRoute;
  nama_generik?: string | null;
  isi_zat_aktif: number;
  isi_satuan: DddSatuan;
  is_antibiotik: number;
  aktif: number;
  keterangan?: string | null;
}
export interface PpraBarang {
  kode_brng: string;
  nama_brng: string;
  kode_sat?: string | null;
  sudah_dimapping: number;
}

// Master ATC
export const ppraAtcList = (q?: string) =>
  api.get<{ ok: boolean; jumlah: number; data: PpraAtc[] }>(
    `/ppra/atc?q=${encodeURIComponent(q ?? "")}`);
export const ppraAtcUpsert = (b: PpraAtc) => api.post<{ ok: boolean }>(`/ppra/atc`, b);
export const ppraAtcDelete = (atc_code: string, adm_route: string) =>
  api.delete<{ ok: boolean }>(
    `/ppra/atc?atc_code=${encodeURIComponent(atc_code)}&adm_route=${encodeURIComponent(adm_route)}`);
export const ppraAtcImport = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post<{ ok: boolean; masuk: number; dilewati: number; errors: string[]; catatan: string }>(
    `/ppra/atc/import`, fd);
};

// Mapping obat
export const ppraMapList = (q?: string) =>
  api.get<{ ok: boolean; jumlah: number; data: PpraMap[] }>(
    `/ppra/mapping?q=${encodeURIComponent(q ?? "")}`);
export const ppraMapUpsert = (b: {
  kode_brng: string; atc_code: string; adm_route: AdmRoute;
  isi_zat_aktif: number; isi_satuan: DddSatuan;
  is_antibiotik?: boolean; aktif?: boolean; keterangan?: string | null;
}) => api.post<{ ok: boolean }>(`/ppra/mapping`, b);
export const ppraMapDelete = (kode_brng: string) =>
  api.delete<{ ok: boolean }>(`/ppra/mapping?kode_brng=${encodeURIComponent(kode_brng)}`);

// Autocomplete databarang (Khanza read-only)
export const ppraDatabarangCari = (q: string) =>
  api.get<{ ok: boolean; data: PpraBarang[] }>(
    `/ppra/databarang/cari?q=${encodeURIComponent(q)}`);

// Validasi + Kuantitatif
export interface PpraValidasi {
  ok: boolean;
  ada_masalah: boolean;
  v1_mismatch_satuan: { jumlah: number; keterangan: string; data: unknown[] };
  v2_belum_dimapping: { jumlah: number; keterangan: string; data: { kode_brng: string; nama_brng: string }[] };
  v3_mapping_yatim:   { jumlah: number; keterangan: string; data: unknown[] };
}
export const ppraValidasi = () => api.get<PpraValidasi>(`/ppra/validasi`);

export interface PpraKuantitatif {
  ok: boolean;
  periode: { tgl_awal: string; tgl_akhir: string; jenis: string };
  denominator: { label: string; nilai: number };
  ringkasan: {
    total_ddd: number; rasio_label: string; rasio: number;
    aware: {
      access: number; watch: number; reserve: number; not_recommended: number;
      total: number; access_persen: number; target_persen: number; memenuhi_target: boolean;
    };
  };
  per_antibiotik: { atc_code: string; adm_route: string; nama_generik: string;
    aware_kategori: string; konsumsi: number; ddd: number; total_ddd: number }[];
  du90: { atc_code: string; adm_route: string; nama_generik: string;
    total_ddd: number; persen: number; kumulatif_persen: number; dalam_du90: boolean }[];
  disclaimer: string;
}
export const ppraKuantitatif = (p: { tgl_awal?: string; tgl_akhir?: string; jenis?: "ranap" | "ralan" }) => {
  const sp = new URLSearchParams();
  if (p.tgl_awal) sp.set("tgl_awal", p.tgl_awal);
  if (p.tgl_akhir) sp.set("tgl_akhir", p.tgl_akhir);
  if (p.jenis) sp.set("jenis", p.jenis);
  return api.get<PpraKuantitatif>(`/ppra/kuantitatif?${sp}`);
};

// ── PPRA — Gyssens (audit kualitatif) ────────────────────────────────────────
export type KategoriGyssens =
  "0" | "I" | "IIA" | "IIB" | "IIC" | "IIIA" | "IIIB" | "IVA" | "IVB" | "IVC" | "IVD" | "V" | "VI";

export interface GyssensAudit {
  id: number;
  no_rawat: string;
  no_rkm_medis?: string | null;
  tgl_audit: string;
  auditor_nip?: string | null;
  diagnosis?: string | null;
  unit_smf?: string | null;
  jml_antibiotik: number;
  jml_rasional: number;
}
export interface GyssensDetail {
  id?: number;
  kode_brng?: string | null;
  atc_code?: string | null;
  adm_route?: string | null;
  dosis?: string | null;
  interval?: string | null;
  durasi_hari?: number | null;
  ada_kultur: number | boolean;
  hasil_kultur?: string | null;
  kategori_gyssens: KategoriGyssens;
  catatan?: string | null;
}
export interface GyssensSaveBody {
  id?: number;
  no_rawat: string;
  no_rkm_medis?: string | null;
  tgl_audit: string;
  auditor_nip?: string | null;
  diagnosis?: string | null;
  unit_smf?: string | null;
  catatan?: string | null;
  details: Omit<GyssensDetail, "id">[];
}
export interface GyssensPasien {
  ok: boolean;
  no_rawat: string;
  no_rkm_medis?: string | null;
  nm_pasien?: string | null;
  jk?: string | null;
  antibiotik: { kode_brng: string; nama_brng?: string | null; atc_code: string; adm_route: string; nama_generik?: string | null }[];
}
export interface GyssensRekap {
  ok: boolean;
  periode: { tgl_awal: string; tgl_akhir: string };
  distribusi: Record<string, number>;
  total_antibiotik: number;
  rasional: number;
  tidak_rasional: number;
  persen_rasional: number;
}

export const ppraGyssensList = (p: { tgl_awal?: string; tgl_akhir?: string; q?: string }) => {
  const sp = new URLSearchParams();
  if (p.tgl_awal) sp.set("tgl_awal", p.tgl_awal);
  if (p.tgl_akhir) sp.set("tgl_akhir", p.tgl_akhir);
  if (p.q) sp.set("q", p.q);
  return api.get<{ ok: boolean; jumlah: number; data: GyssensAudit[] }>(`/ppra/gyssens?${sp}`);
};
export const ppraGyssensDetail = (id: number) =>
  api.get<{ ok: boolean; header: GyssensAudit; details: GyssensDetail[] }>(`/ppra/gyssens/detail?id=${id}`);
export const ppraGyssensSave = (b: GyssensSaveBody) => api.post<{ ok: boolean; id: number }>(`/ppra/gyssens`, b);
export const ppraGyssensDelete = (id: number) => api.delete<{ ok: boolean }>(`/ppra/gyssens?id=${id}`);
export const ppraGyssensRekap = (p: { tgl_awal?: string; tgl_akhir?: string }) => {
  const sp = new URLSearchParams();
  if (p.tgl_awal) sp.set("tgl_awal", p.tgl_awal);
  if (p.tgl_akhir) sp.set("tgl_akhir", p.tgl_akhir);
  return api.get<GyssensRekap>(`/ppra/gyssens/rekap?${sp}`);
};
export const ppraGyssensPasien = (no_rawat: string) =>
  api.get<GyssensPasien>(`/ppra/gyssens/pasien?no_rawat=${encodeURIComponent(no_rawat)}`);

// ── PPRA — Laporan & ekspor ──────────────────────────────────────────────────
export interface PpraTren {
  ok: boolean;
  jenis: string;
  target_persen: number;
  data: { bulan: string; total_ddd: number; denominator: number; rasio: number; access_persen: number }[];
}
export const ppraTren = (p: { jenis?: "ranap" | "ralan"; bulan?: number }) => {
  const sp = new URLSearchParams();
  if (p.jenis) sp.set("jenis", p.jenis);
  if (p.bulan) sp.set("bulan", String(p.bulan));
  return api.get<PpraTren>(`/ppra/tren?${sp}`);
};
export interface PpraStats { ok: boolean; atc_ref: number; mapping_aktif: number; audit_gyssens: number }
export const ppraStats = () => api.get<PpraStats>(`/ppra/stats`);

/** Unduh CSV kuantitatif (blob, pakai token axios) lalu trigger download di browser. */
export const ppraEksporKuantitatifCsv = async (p: { tgl_awal?: string; tgl_akhir?: string; jenis?: "ranap" | "ralan" }) => {
  const sp = new URLSearchParams();
  if (p.tgl_awal) sp.set("tgl_awal", p.tgl_awal);
  if (p.tgl_akhir) sp.set("tgl_akhir", p.tgl_akhir);
  if (p.jenis) sp.set("jenis", p.jenis);
  const r = await api.get(`/ppra/ekspor/kuantitatif.csv?${sp}`, { responseType: "blob" });
  const url = URL.createObjectURL(r.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ppra_kuantitatif_${p.jenis ?? "ranap"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ── edokter — aplikasi web dokter (mobile), read-only tahap 1 ────────────────
export interface EdokterMe {
  kd_dokter: string;
  nm_dokter: string;
  jk?: string;
  kd_sps?: string;
  nm_sps?: string;
  boleh_dokter_lain?: boolean;
}
export interface EdokterPasien {
  no_rawat:  string;
  no_reg?:   string;
  tgl?:      string;
  jam?:      string;
  no_rm?:    string;
  nm_pasien?: string;
  jk?:       string;
  umur?:     string;
  lokasi?:   string;
  png_jawab?: string;
  status?:   string;
  dokter?:   string;
}
export interface EdokterSoapie {
  tgl_perawatan?: string; jam_rawat?: string;
  suhu_tubuh?: string; tensi?: string; nadi?: string; respirasi?: string;
  tinggi?: string; berat?: string; spo2?: string; gcs?: string; kesadaran?: string;
  keluhan?: string; pemeriksaan?: string; penilaian?: string; rtl?: string;
  instruksi?: string; evaluasi?: string; alergi?: string; petugas?: string; milik?: number;
}
export interface EdokterResepObat {
  kode_brng: string; nama_brng?: string; jml?: string; aturan_pakai?: string;
}
export interface EdokterResepRacikan {
  no_racik?: string; nama_racik?: string; jml_dr?: string; aturan_pakai?: string; keterangan?: string;
}
export interface EdokterResep {
  no_resep: string; tgl_peresepan?: string; jam_peresepan?: string; status?: string;
  obat: EdokterResepObat[]; racikan: EdokterResepRacikan[];
}

export const edokterMe = (kd_dokter?: string) =>
  api.get<EdokterMe>(`/edokter/me${kd_dokter ? `?kd_dokter=${encodeURIComponent(kd_dokter)}` : ""}`);
export const edokterPasien = (p: { jenis: string; tgl_awal?: string; tgl_akhir?: string; cari?: string; kd_dokter?: string }) => {
  const sp = new URLSearchParams();
  sp.set("jenis", p.jenis);
  if (p.tgl_awal) sp.set("tgl_awal", p.tgl_awal);
  if (p.tgl_akhir) sp.set("tgl_akhir", p.tgl_akhir);
  if (p.cari) sp.set("cari", p.cari);
  if (p.kd_dokter) sp.set("kd_dokter", p.kd_dokter);
  return api.get<EdokterPasien[]>(`/edokter/pasien?${sp.toString()}`);
};
// e-Farmasi (petugas farmasi, lihat semua pasien; detail pakai endpoint edokter)
export interface EfarmasiMe { nik: string; nama: string; jabatan: string; departemen: string }
export const efarmasiMe = () => api.get<EfarmasiMe>("/efarmasi/me");
export const efarmasiPasien = (p: { jenis: string; tgl_awal?: string; tgl_akhir?: string; cari?: string }) => {
  const sp = new URLSearchParams();
  sp.set("jenis", p.jenis);
  if (p.tgl_awal) sp.set("tgl_awal", p.tgl_awal);
  if (p.tgl_akhir) sp.set("tgl_akhir", p.tgl_akhir);
  if (p.cari) sp.set("cari", p.cari);
  return api.get<EdokterPasien[]>(`/efarmasi/pasien?${sp.toString()}`);
};

// ── e-Nakes (perawat/tenaga kesehatan) ───────────────────────────────────────
export interface EnakesMe { nik: string; nama: string; jabatan: string; departemen: string }
export const enakesMe = () => api.get<EnakesMe>("/enakes/me");
export const enakesPasien = (p: { jenis: string; tgl_awal?: string; tgl_akhir?: string; cari?: string }) => {
  const sp = new URLSearchParams();
  sp.set("jenis", p.jenis);
  if (p.tgl_awal) sp.set("tgl_awal", p.tgl_awal);
  if (p.tgl_akhir) sp.set("tgl_akhir", p.tgl_akhir);
  if (p.cari) sp.set("cari", p.cari);
  return api.get<EdokterPasien[]>(`/enakes/pasien?${sp.toString()}`);
};
export interface EnakesCatatan {
  tanggal: string | null; jam: string | null; uraian: string;
  td: string; nadi: string; rr: string; suhu: string; spo2: string; petugas: string; milik?: number;
}
export const enakesCatatanList = (no_rawat: string, jenis: string) =>
  api.get<EnakesCatatan[]>(`/enakes/catatan?no_rawat=${encodeURIComponent(no_rawat)}&jenis=${encodeURIComponent(jenis)}`);
export const enakesCatatanSave = (b: {
  no_rawat: string; jenis: string; uraian: string;
  td?: string; nadi?: string; rr?: string; suhu?: string; spo2?: string;
  edit?: boolean; orig_tanggal?: string; orig_jam?: string; waktu?: string;
}) => api.post<{ ok: boolean }>("/enakes/catatan", b);

// ── Monitoring Bundle PPI (IAD/ISK/Phlebitis/VAP/IDO + Audit IDO Peri-Op) ──
export type BundleRow = Record<string, string>;
export const enakesBundleHeader = (bundle: string, no_rawat: string) =>
  api.get<{ rows: BundleRow[] }>(`/enakes/bundle/header?bundle=${encodeURIComponent(bundle)}&no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesBundleDetail = (bundle: string, no_rawat: string, tgl?: string) =>
  api.get<{ rows: BundleRow[] }>(`/enakes/bundle/detail?bundle=${encodeURIComponent(bundle)}&no_rawat=${encodeURIComponent(no_rawat)}${tgl ? `&tgl=${encodeURIComponent(tgl)}` : ""}`);
export const enakesBundleHeaderSave = (b: { bundle: string; no_rawat: string; tgl: string; data: Record<string, string> }) =>
  api.post<{ ok: boolean }>("/enakes/bundle/header", b);
export const enakesBundleDetailSave = (b: { bundle: string; no_rawat: string; tgl: string; tanggal: string; data: Record<string, string> }) =>
  api.post<{ ok: boolean }>("/enakes/bundle/detail", b);
export const enakesBundleHeaderHapus = (b: { bundle: string; no_rawat: string; tgl: string }) =>
  api.post<{ ok: boolean }>("/enakes/bundle/header/hapus", b);
export const enakesBundleDetailHapus = (b: { bundle: string; no_rawat: string; tgl: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/bundle/detail/hapus", b);

export interface EnakesResumeKep {
  no_rawat: string; kd_dokter: string; nm_dokter: string;
  diagnosa_awal: string; alasan: string; masalah_perawatan: string;
  tindakan: string; alih_rawat: string; evaluasi: string; nasihat: string;
  petugas: string;
}
export const enakesResumeKepGet = (no_rawat: string) =>
  api.get<EnakesResumeKep | null>(`/enakes/resume-keperawatan?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesResumeKepSave = (b: {
  no_rawat: string; diagnosa_awal: string; alasan?: string; masalah_perawatan?: string;
  tindakan?: string; alih_rawat?: string; evaluasi?: string; nasihat?: string;
}) => api.post<{ ok: boolean }>("/enakes/resume-keperawatan", b);
export interface KriteriaData { tanggal: string; petugas: string; values: Record<string, string>; }
export const enakesKriteriaGet = (form: string, no_rawat: string) =>
  api.get<KriteriaData | null>(`/enakes/kriteria?form=${encodeURIComponent(form)}&no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesKriteriaSave = (b: { form: string; no_rawat: string; values: Record<string, string> }) =>
  api.post<{ ok: boolean }>("/enakes/kriteria", b);
export interface EnakesMonitoringSingleUse {
  id_msur: number; tanggal: string | null; nama_alat: string;
  ukuran: string; kode_warna: string; petugas: string; nip: string;
}
export const enakesMonitoringSingleUseGet = (no_rawat: string) =>
  api.get<EnakesMonitoringSingleUse[]>(`/enakes/monitoring-single-use?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesMonitoringSingleUseSave = (b: {
  no_rawat: string; nama_alat: string; ukuran?: string; kode_warna?: string;
}) => api.post<{ ok: boolean }>("/enakes/monitoring-single-use", b);
export const enakesMonitoringSingleUseHapus = (id: number) =>
  api.post<{ ok: boolean }>("/enakes/monitoring-single-use/hapus", { id });

// ── Surat Kontrol BPJS (Rencana Kontrol VClaim) ──────────────────────────────
export interface SuratKontrolRow {
  no_surat: string; tgl_surat: string; tgl_rencana: string;
  kd_dokter: string; nm_dokter: string; kd_poli: string; nm_poli: string;
}
export interface SuratKontrolInfo {
  no_sep: string | null; tgl_sep?: string; kd_poli_sep?: string; nm_poli_sep?: string;
  diagnosa?: string; list: SuratKontrolRow[];
}
export interface SkPoli { kode: string; nama: string }
export interface SkDokter { kode: string; nama: string; jadwal: string; hari: string; kapasitas: number; terpakai: number }

export const suratKontrolInfo = (no_rawat: string) =>
  api.get<SuratKontrolInfo>(`/enakes/surat-kontrol?no_rawat=${encodeURIComponent(no_rawat)}`);
export const suratKontrolPoli = (no_sep: string, tgl: string) =>
  api.get<{ poli: SkPoli[] }>(`/enakes/surat-kontrol/poli?no_sep=${encodeURIComponent(no_sep)}&tgl=${encodeURIComponent(tgl)}`);
export const suratKontrolDokter = (kd_poli: string, tgl: string) =>
  api.get<{ dokter: SkDokter[] }>(`/enakes/surat-kontrol/dokter?kd_poli=${encodeURIComponent(kd_poli)}&tgl=${encodeURIComponent(tgl)}`);
export const suratKontrolCreate = (b: {
  no_sep: string; tgl_rencana: string; kd_dokter: string; nm_dokter: string; kd_poli: string; nm_poli: string;
}) => api.post<{ ok: boolean; no_surat: string }>("/enakes/surat-kontrol", b);
export const suratKontrolHapus = (no_surat: string) =>
  api.post<{ ok: boolean }>("/enakes/surat-kontrol/hapus", { no_surat });
export interface EnakesTtv {
  waktu: string; suhu: string; tensi: string; nadi: string; respirasi: string; spo2: string;
}
export const enakesTtv = (no_rawat: string, jenis: string) =>
  api.get<EnakesTtv[]>(`/enakes/ttv?no_rawat=${encodeURIComponent(no_rawat)}&jenis=${encodeURIComponent(jenis)}`);
export interface EnakesRiwayatJatuh {
  instrumen: string; tanggal: string | null; ringkas: string; hasil: string; petugas: string; milik?: number;
}
export const enakesJatuhRiwayat = (no_rawat: string) =>
  api.get<EnakesRiwayatJatuh[]>(`/enakes/jatuh/riwayat?no_rawat=${encodeURIComponent(no_rawat)}`);
export interface EnakesJatuhBody {
  no_rawat: string; instrumen: string;
  skala?: string[]; nilai?: number[]; total?: number; hasil?: string; saran?: string;
  ruangan?: string; cara_berjalan?: string; menopang?: string; hasil_penilaian?: string;
  tindakan_ya?: string; nama_keluarga?: string;
  intervensi?: string[]; edukasi?: string[]; sasaran?: string[]; evaluasi?: string[]; waktu?: string;
}
export const enakesJatuhSave = (b: EnakesJatuhBody) =>
  api.post<{ ok: boolean }>("/enakes/jatuh", b);
export interface EnakesNyeri {
  tanggal: string | null; nyeri: string; skala_nyeri: string; provokes: string; ket_provokes: string;
  quality: string; ket_quality: string; lokasi: string; menyebar: string; durasi: string;
  nyeri_hilang: string; ket_nyeri: string; petugas: string; milik?: number;
}
export const enakesNyeriList = (no_rawat: string) =>
  api.get<EnakesNyeri[]>(`/enakes/nyeri?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesNyeriSave = (b: {
  no_rawat: string; nyeri?: string; provokes?: string; ket_provokes?: string; quality?: string;
  ket_quality?: string; lokasi?: string; menyebar?: string; skala_nyeri?: string; durasi?: string;
  nyeri_hilang?: string; ket_nyeri?: string; edit?: boolean; orig_tanggal?: string; waktu?: string;
}) => api.post<{ ok: boolean }>("/enakes/nyeri", b);
export interface EnakesRiwayatEws {
  instrumen: string; tanggal: string | null; skor_total: string; parameter_total: string; code_blue: string; petugas: string; milik?: number;
}
export const enakesEwsRiwayat = (no_rawat: string) =>
  api.get<EnakesRiwayatEws[]>(`/enakes/ews/riwayat?no_rawat=${encodeURIComponent(no_rawat)}`);
export interface EnakesEwsBody {
  no_rawat: string; instrumen: string;
  parameter?: string[]; skor?: number[]; skor_total?: number; parameter_total?: string; code_blue?: string; waktu?: string;
}
export const enakesEwsSave = (b: EnakesEwsBody) =>
  api.post<{ ok: boolean }>("/enakes/ews", b);
export interface EnakesEdukasi {
  tanggal: string | null; jam: string | null; diberikan_pada: string; penerima_edukasi: string;
  profesi: string; materi_edukasi: string; kode_leaflet: string; lama_edukasi: string;
  hasil_verifikasi: string; petugas: string; milik?: number;
}
export const enakesEdukasiList = (no_rawat: string) =>
  api.get<EnakesEdukasi[]>(`/enakes/edukasi?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesEdukasiSave = (b: {
  no_rawat: string; diberikan_pada?: string; penerima_edukasi?: string; profesi?: string;
  materi_edukasi: string; kode_leaflet?: string; lama_edukasi?: string; hasil_verifikasi?: string;
  edit?: boolean; orig_tanggal?: string; orig_jam?: string; waktu?: string;
}) => api.post<{ ok: boolean }>("/enakes/edukasi", b);
// Cek hak akses (kolom tabel user) utk enable/disable tombol di E-Nakes.
export const enakesCekAkses = (col: string) =>
  api.get<{ granted: boolean }>(`/enakes/cek-akses?col=${encodeURIComponent(col)}`);
// Hapus owner-only (hanya pembuat/Admin) — backend menolak bila bukan pembuat.
export const enakesCatatanHapus = (b: { no_rawat: string; jenis: string; tanggal: string; jam: string }) =>
  api.post<{ ok: boolean }>("/enakes/catatan/hapus", b);
export const enakesNyeriHapus = (b: { no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/nyeri/hapus", b);
export const enakesEdukasiHapus = (b: { no_rawat: string; tanggal: string; jam: string }) =>
  api.post<{ ok: boolean }>("/enakes/edukasi/hapus", b);
export const enakesPhq9Hapus = (b: { no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/phq9/hapus", b);
export const enakesAsqHapus = (b: { no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/asq/hapus", b);
export const enakesKekerasanHapus = (b: { no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/kekerasan/hapus", b);
export const enakesMelarikanHapus = (b: { no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/melarikan/hapus", b);
export const enakesJatuhHapus = (b: { no_rawat: string; tanggal: string; instrumen: string }) =>
  api.post<{ ok: boolean }>("/enakes/jatuh/hapus", b);
export const enakesEwsHapus = (b: { no_rawat: string; tanggal: string; instrumen: string }) =>
  api.post<{ ok: boolean }>("/enakes/ews/hapus", b);
export const enakesResumeKepHapus = (b: { no_rawat: string }) =>
  api.post<{ ok: boolean }>("/enakes/resume-keperawatan/hapus", b);
export const enakesKriteriaHapus = (b: { form: string; no_rawat: string }) =>
  api.post<{ ok: boolean }>("/enakes/kriteria/hapus", b);
export const enakesPengkajianIcuHapus = (b: { no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/pengkajian-icu/hapus", b);

// ── Formulir Tindakan Intubasi & Ventilator ──────────────────────────────────
export interface EnakesIntubasi {
  tanggal: string | null; diagnosa: string; indikasi_pemasangan: string;
  tgl_intubasi: string | null; tgl_pasang_ventilator: string | null;
  tgl_extubasi: string | null; tgl_lepas_ventilator: string | null;
  tekanan_darah: string; nadi: string; respiratory_rate: string; saturasi_o2: string;
  mode_ventilator: string; fio2: string; peep: string; ie_ratio: string;
  dokter: string; petugas: string; milik?: number;
}
export const enakesIntubasiList = (no_rawat: string) =>
  api.get<EnakesIntubasi[]>(`/enakes/intubasi?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesIntubasiSave = (b: { no_rawat: string; edit?: boolean; orig_tanggal?: string; [k: string]: string | boolean | undefined }) =>
  api.post<{ ok: boolean }>("/enakes/intubasi", b);
export const enakesIntubasiHapus = (b: { no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/intubasi/hapus", b);

// ── Transfer Antar Ruang (transfer_internal_rs) ──────────────────────────────
export interface EnakesTransfer {
  tanggal_masuk: string | null; tanggal_pindah: string | null;
  asal_ruang: string; ruang_selanjutnya: string; derajat: string;
  diagnosa_sekarang: string; dpjp: string; petugas: string; milik?: number;
}
export const enakesTransferList = (no_rawat: string) =>
  api.get<EnakesTransfer[]>(`/enakes/transfer?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesTransferDetail = (no_rawat: string, tanggal_masuk: string) =>
  api.get<{ values: Record<string, string>; dapat_edit: boolean } | null>(
    `/enakes/transfer/detail?no_rawat=${encodeURIComponent(no_rawat)}&tanggal_masuk=${encodeURIComponent(tanggal_masuk)}`);
export const enakesTransferSave = (b: { no_rawat: string; values: Record<string, string>; edit?: boolean; orig_tanggal_masuk?: string }) =>
  api.post<{ ok: boolean }>("/enakes/transfer", b);
export const enakesTransferHapus = (b: { no_rawat: string; tanggal_masuk: string }) =>
  api.post<{ ok: boolean }>("/enakes/transfer/hapus", b);

// ── Status Anestesi (parity per-seksi; tiap seksi tabel & waktu sendiri) ───────
export interface EnakesSaRingkas { tanggal: string | null; ringkas: string; petugas: string; milik?: number }
export const enakesStatusAnestesiList = (section: string, no_rawat: string) =>
  api.get<EnakesSaRingkas[]>(`/enakes/status-anestesi?section=${encodeURIComponent(section)}&no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesStatusAnestesiDetail = (section: string, no_rawat: string, tanggal: string) =>
  api.get<{ values: Record<string, string>; dapat_edit: boolean } | null>(
    `/enakes/status-anestesi/detail?section=${encodeURIComponent(section)}&no_rawat=${encodeURIComponent(no_rawat)}&tanggal=${encodeURIComponent(tanggal)}`);
export const enakesStatusAnestesiSave = (b: { section: string; no_rawat: string; tanggal: string; values: Record<string, string>; edit?: boolean; orig_tanggal?: string }) =>
  api.post<{ ok: boolean }>("/enakes/status-anestesi", b);
export const enakesStatusAnestesiHapus = (b: { section: string; no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/status-anestesi/hapus", b);

// ── Monitoring Status Fisiologis Anestesi/Sedasi Diluar Kamar Operasi (RM.IBS.11.011) ──
export interface MonAnesDetail { tgl_perawatan: string; jam_rawat: string; waktu: string; obat: string; dosis: string; tensi: string; nadi: string; rr: string; suhu: string; petugas: string; milik: number }
export interface MonAnesResp { header: (Record<string, string> & { milik: number }) | null; detail: MonAnesDetail[] }
export const monAnesGet = (no_rawat: string) =>
  api.get<MonAnesResp>(`/enakes/monitoring-anestesi?no_rawat=${encodeURIComponent(no_rawat)}`);
export const monAnesHeaderSave = (b: { no_rawat: string; values: Record<string, string> }) =>
  api.post<{ ok: boolean }>("/enakes/monitoring-anestesi/header", b);
export const monAnesDetailAdd = (b: { no_rawat: string; waktu: string; obat: string; dosis: string; tensi: string; nadi: string; rr: string; suhu: string }) =>
  api.post<{ ok: boolean }>("/enakes/monitoring-anestesi/detail", b);
export const monAnesDetailHapus = (b: { no_rawat: string; tgl_perawatan: string; jam_rawat: string }) =>
  api.post<{ ok: boolean }>("/enakes/monitoring-anestesi/detail/hapus", b);

// ── Skor pemulihan perioperatif (Aldrette / Steward / Bromage) ────────────────
export interface PeriopSkorSkala { label: string; options: string[] }
export interface PeriopSkorSection { key: string; label: string; has_total: boolean; skala: PeriopSkorSkala[] }
export interface PeriopSkorRingkas { tanggal: string | null; ringkas: string; petugas: string; milik: number }
export const periopSkorConfig = () => api.get<{ sections: PeriopSkorSection[] }>("/periop/skor/config");
export const periopSkorList = (section: string, no_rawat: string) =>
  api.get<PeriopSkorRingkas[]>(`/periop/skor/list?section=${encodeURIComponent(section)}&no_rawat=${encodeURIComponent(no_rawat)}`);
export const periopSkorDetail = (section: string, no_rawat: string, tanggal: string) =>
  api.get<{ values: Record<string, string>; dapat_edit: boolean } | null>(
    `/periop/skor/detail?section=${encodeURIComponent(section)}&no_rawat=${encodeURIComponent(no_rawat)}&tanggal=${encodeURIComponent(tanggal)}`);
export const periopSkorSave = (b: { section: string; no_rawat: string; tanggal: string; kd_dokter?: string; skala: string[]; keluar?: string; instruksi?: string; edit?: boolean; orig_tanggal?: string }) =>
  api.post<{ ok: boolean; total: number }>("/periop/skor/save", b);
export const periopSkorHapus = (b: { section: string; no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/periop/skor/hapus", b);

// ── Form perioperatif berbasis field (Edukasi Anestesi / SIA General·Regional / Konversi) ──
export interface PeriopFormField { k: string; label: string; typ: string; opts: string[] }
export interface PeriopFormSection { key: string; label: string; fields: PeriopFormField[] }
export interface PeriopFormRingkas { tanggal: string | null; ringkas: string; petugas: string; milik: number }
export const periopFormConfig = () => api.get<{ sections: PeriopFormSection[] }>("/periop/form/config");
export const periopFormList = (section: string, no_rawat: string) =>
  api.get<PeriopFormRingkas[]>(`/periop/form/list?section=${encodeURIComponent(section)}&no_rawat=${encodeURIComponent(no_rawat)}`);
export const periopFormDetail = (section: string, no_rawat: string, tanggal: string) =>
  api.get<{ values: Record<string, string>; dapat_edit: boolean } | null>(
    `/periop/form/detail?section=${encodeURIComponent(section)}&no_rawat=${encodeURIComponent(no_rawat)}&tanggal=${encodeURIComponent(tanggal)}`);
export const periopFormSave = (b: { section: string; no_rawat: string; tanggal: string; kd_dokter?: string; values: Record<string, string>; edit?: boolean; orig_tanggal?: string }) =>
  api.post<{ ok: boolean }>("/periop/form/save", b);
export const periopFormHapus = (b: { section: string; no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/periop/form/hapus", b);

// ── MRMIK — register digital (Pelepasan Informasi / Reviu RM / Koreksi RME / Formulir RM / Audit Akses) ──
export interface MrmikPelepasan {
  id: number; tanggal?: string; no_rkm_medis?: string; nama_pasien?: string; no_rawat?: string;
  pemohon?: string; hubungan?: string; instansi?: string; tujuan?: string; jenis_dokumen?: string;
  cara_pemberian?: string; disetujui_oleh?: string; status: string; tgl_selesai?: string; petugas_nip?: string; catatan?: string; created_at?: string;
}
export const mrmikPelepasanList = (f: { tahun?: number; bulan?: number; status?: string; tujuan?: string; q?: string } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); });
  return api.get<MrmikPelepasan[]>(`/mrmik/pelepasan?${p}`);
};
export const mrmikPelepasanCreate = (b: Partial<MrmikPelepasan>) => api.post<{ ok: boolean; id: number }>("/mrmik/pelepasan", b);
export const mrmikPelepasanUpdate = (id: number, b: Partial<MrmikPelepasan>) => api.put<{ ok: boolean }>(`/mrmik/pelepasan/${id}`, b);
export const mrmikPelepasanDelete = (id: number) => api.delete(`/mrmik/pelepasan/${id}`);
export interface MrmikPelRekap { tahun: number; total: number; per_tujuan: { label?: string; total: number }[]; per_status: { label?: string; total: number }[]; per_bulan: { bulan: number; total: number }[] }
export const mrmikPelepasanRekap = (tahun?: number) => api.get<MrmikPelRekap>(`/mrmik/pelepasan/rekap${tahun ? `?tahun=${tahun}` : ""}`);

export interface MrmikReviu {
  id: number; tanggal?: string; no_rawat?: string; no_rkm_medis?: string; nama_pasien?: string; jenis_reviu: string;
  ketepatan_waktu: number; keterbacaan: number; kelengkapan: number; kesesuaian_isi: number; skor?: number; catatan?: string; reviewer?: string; petugas_nip?: string; created_at?: string;
}
export const mrmikReviuList = (f: { tahun?: number; bulan?: number; jenis_reviu?: string; q?: string } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); });
  return api.get<MrmikReviu[]>(`/mrmik/reviu?${p}`);
};
export const mrmikReviuCreate = (b: Partial<MrmikReviu>) => api.post<{ ok: boolean; id: number; skor: number }>("/mrmik/reviu", b);
export const mrmikReviuUpdate = (id: number, b: Partial<MrmikReviu>) => api.put<{ ok: boolean; skor: number }>(`/mrmik/reviu/${id}`, b);
export const mrmikReviuDelete = (id: number) => api.delete(`/mrmik/reviu/${id}`);
export interface MrmikReviuRekap { tahun: number; total: number; avg_skor?: number; pct_ketepatan_waktu?: number; pct_keterbacaan?: number; pct_kelengkapan?: number; pct_kesesuaian_isi?: number }
export const mrmikReviuRekap = (tahun?: number) => api.get<MrmikReviuRekap>(`/mrmik/reviu/rekap${tahun ? `?tahun=${tahun}` : ""}`);

export interface MrmikKoreksi {
  id: number; tanggal?: string; no_rawat?: string; no_rkm_medis?: string; nama_pasien?: string; jenis_rm: string;
  formulir?: string; isi_lama?: string; isi_baru?: string; alasan?: string; dikoreksi_oleh?: string; petugas_nip?: string; created_at?: string;
}
export const mrmikKoreksiList = (f: { tahun?: number; bulan?: number; jenis_rm?: string; q?: string } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); });
  return api.get<MrmikKoreksi[]>(`/mrmik/koreksi?${p}`);
};
export const mrmikKoreksiCreate = (b: Partial<MrmikKoreksi>) => api.post<{ ok: boolean; id: number }>("/mrmik/koreksi", b);
export const mrmikKoreksiUpdate = (id: number, b: Partial<MrmikKoreksi>) => api.put<{ ok: boolean }>(`/mrmik/koreksi/${id}`, b);
export const mrmikKoreksiDelete = (id: number) => api.delete(`/mrmik/koreksi/${id}`);

export interface MrmikFormulir {
  id: number; kode_form?: string; nama_form: string; unit?: string; versi?: string; tgl_terbit?: string; tgl_reviu?: string;
  status: string; hasil_evaluasi?: string; direview_oleh?: string; catatan?: string;
}
export const mrmikFormulirList = (f: { status?: string; unit?: string; q?: string } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v) p.append(k, String(v)); });
  return api.get<MrmikFormulir[]>(`/mrmik/formulir?${p}`);
};
export const mrmikFormulirCreate = (b: Partial<MrmikFormulir>) => api.post<{ ok: boolean; id: number }>("/mrmik/formulir", b);
export const mrmikFormulirUpdate = (id: number, b: Partial<MrmikFormulir>) => api.put<{ ok: boolean }>(`/mrmik/formulir/${id}`, b);
export const mrmikFormulirDelete = (id: number) => api.delete(`/mrmik/formulir/${id}`);

export interface MrmikLoginRow { nip?: string; nama?: string; tgl_login?: string; jam_login?: string }
export const mrmikAksesLogin = (f: { tgl_awal?: string; tgl_akhir?: string; nip?: string } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v) p.append(k, String(v)); });
  return api.get<{ login: MrmikLoginRow[] }>(`/mrmik/akses/login?${p}`);
};
export interface MrmikHakRow { nip?: string; nama?: string; jml_izin: number; login_terakhir?: string }
export const mrmikAksesHak = () => api.get<{ users: MrmikHakRow[] }>("/mrmik/akses/hak");

// ── PMKP — Insiden Keselamatan Pasien (IKP) ───────────────────────────────────
export interface Insiden {
  id: number; no_laporan?: string; tanggal_lapor?: string; tanggal_insiden?: string; jam_insiden?: string;
  jenis_insiden: string; tipe_insiden?: string; judul?: string; kronologi?: string;
  no_rkm_medis?: string; nama_pasien?: string; no_rawat?: string; unit_terjadi?: string; unit_pelapor?: string;
  dampak?: string; probabilitas?: number; dampak_nilai?: number; grading?: string;
  tindakan_segera?: string; rekomendasi?: string; metode_investigasi?: string; penanggung_jawab?: string;
  tgl_selesai_investigasi?: string; akar_masalah?: string; hasil_investigasi?: string; status: string; pelapor_nip?: string; created_at?: string;
}
export const insidenList = (f: { tahun?: number; bulan?: number; jenis?: string; grading?: string; status?: string; q?: string } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); });
  return api.get<Insiden[]>(`/insiden?${p}`);
};
export const insidenGet = (id: number) => api.get<Insiden>(`/insiden/${id}`);
export const insidenCreate = (b: Partial<Insiden>) => api.post<{ ok: boolean; id: number; grading?: string }>("/insiden", b);
export const insidenUpdate = (id: number, b: Partial<Insiden>) => api.put<{ ok: boolean; grading?: string }>(`/insiden/${id}`, b);
export const insidenDelete = (id: number) => api.delete(`/insiden/${id}`);
export interface InsidenRekap {
  tahun: number; total: number; belum_selesai: number;
  per_jenis: { label?: string; total: number }[]; per_grading: { label?: string; total: number }[];
  per_status: { label?: string; total: number }[]; per_unit: { label?: string; total: number }[]; per_bulan: { bulan: number; total: number }[];
}
export const insidenRekap = (tahun?: number) => api.get<InsidenRekap>(`/insiden/rekap${tahun ? `?tahun=${tahun}` : ""}`);

// ── PPI — Surveilans HAIs / Audit Kepatuhan / Denominator ─────────────────────
export interface PpiSurv {
  id: number; tanggal?: string; no_rawat?: string; no_rkm_medis?: string; nama_pasien?: string; unit?: string; jenis_hais: string;
  tanggal_pasang?: string; tanggal_infeksi?: string; lama_pakai?: number; mikroorganisme?: string; gejala?: string; tindakan?: string; created_at?: string;
}
export const ppiSurvList = (f: { tahun?: number; bulan?: number; jenis?: string; unit?: string; q?: string } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); });
  return api.get<PpiSurv[]>(`/ppi/surveilans?${p}`);
};
export const ppiSurvCreate = (b: Partial<PpiSurv>) => api.post<{ ok: boolean; id: number }>("/ppi/surveilans", b);
export const ppiSurvUpdate = (id: number, b: Partial<PpiSurv>) => api.put<{ ok: boolean }>(`/ppi/surveilans/${id}`, b);
export const ppiSurvDelete = (id: number) => api.delete(`/ppi/surveilans/${id}`);

export interface PpiAudit {
  id: number; tanggal?: string; unit?: string; jenis_audit: string; profesi?: string;
  jml_kesempatan: number; jml_patuh: number; kepatuhan?: number; auditor?: string; catatan?: string; created_at?: string;
}
export const ppiAuditList = (f: { tahun?: number; bulan?: number; jenis?: string; unit?: string } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); });
  return api.get<PpiAudit[]>(`/ppi/audit?${p}`);
};
export const ppiAuditCreate = (b: Partial<PpiAudit>) => api.post<{ ok: boolean; id: number; kepatuhan?: number }>("/ppi/audit", b);
export const ppiAuditUpdate = (id: number, b: Partial<PpiAudit>) => api.put<{ ok: boolean; kepatuhan?: number }>(`/ppi/audit/${id}`, b);
export const ppiAuditDelete = (id: number) => api.delete(`/ppi/audit/${id}`);

export interface PpiDenom { id: number; tahun: number; bulan: number; unit: string; jenis_alat: string; hari_alat: number; hari_rawat: number }
export const ppiDenomList = (tahun?: number) => api.get<PpiDenom[]>(`/ppi/denominator${tahun ? `?tahun=${tahun}` : ""}`);
export const ppiDenomUpsert = (b: Partial<PpiDenom>) => api.post<{ ok: boolean }>("/ppi/denominator", b);
export const ppiDenomDelete = (id: number) => api.delete(`/ppi/denominator/${id}`);

export interface PpiRekap {
  tahun: number; total_kasus: number;
  per_jenis: { label?: string; total: number }[];
  rate: { jenis: string; kasus: number; hari_alat?: number; rate_per_1000?: number }[];
  audit: { jenis: string; kesempatan: number; patuh: number; kepatuhan?: number }[];
  per_bulan: { bulan: number; total: number }[];
}
export const ppiRekap = (tahun?: number) => api.get<PpiRekap>(`/ppi/rekap${tahun ? `?tahun=${tahun}` : ""}`);

// ── KPS — Kredensial/RKK + Diklat staf ────────────────────────────────────────
export interface Kredensial {
  id: number; nip?: string; nama: string; profesi?: string; jenis: string; tanggal_kredensial?: string;
  str_nomor?: string; str_berlaku?: string; sip_nomor?: string; sip_berlaku?: string; rekomendasi?: string;
  rkk?: string; spk_berlaku?: string; status: string; catatan?: string;
}
export const kredList = (f: { profesi?: string; status?: string; q?: string; segera_habis?: number } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); });
  return api.get<Kredensial[]>(`/kps/kredensial?${p}`);
};
export const kredCreate = (b: Partial<Kredensial>) => api.post<{ ok: boolean; id: number }>("/kps/kredensial", b);
export const kredUpdate = (id: number, b: Partial<Kredensial>) => api.put<{ ok: boolean }>(`/kps/kredensial/${id}`, b);
export const kredDelete = (id: number) => api.delete(`/kps/kredensial/${id}`);

export interface Diklat {
  id: number; nip?: string; nama: string; nama_pelatihan: string; penyelenggara?: string; jenis: string;
  tanggal_mulai?: string; tanggal_selesai?: string; jpl?: number; sertifikat_no?: string; berlaku_sampai?: string; catatan?: string;
}
export const diklatList = (f: { tahun?: number; jenis?: string; q?: string } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); });
  return api.get<Diklat[]>(`/kps/diklat?${p}`);
};
export const diklatCreate = (b: Partial<Diklat>) => api.post<{ ok: boolean; id: number }>("/kps/diklat", b);
export const diklatUpdate = (id: number, b: Partial<Diklat>) => api.put<{ ok: boolean }>(`/kps/diklat/${id}`, b);
export const diklatDelete = (id: number) => api.delete(`/kps/diklat/${id}`);

export interface KpsRekap {
  total_kredensial: number; str_segera_habis: number; str_kedaluwarsa: number; sip_segera_habis: number;
  per_profesi: { label?: string; total: number }[]; diklat_tahun: number; jpl_tahun: number; tahun: number;
}
export const kpsRekap = () => api.get<KpsRekap>("/kps/rekap");
export interface Kinerja { id: number; tanggal?: string; nip?: string; nama: string; profesi?: string; jenis: string; periode?: string; nilai?: number; kategori?: string; aspek?: string; rekomendasi?: string; penilai?: string; catatan?: string }
export const kinerjaList = (f: { tahun?: number; jenis?: string; q?: string } = {}) => { const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); }); return api.get<Kinerja[]>(`/kps/kinerja?${p}`); };
export const kinerjaCreate = (b: Partial<Kinerja>) => api.post<{ ok: boolean; id: number; kategori?: string }>("/kps/kinerja", b);
export const kinerjaUpdate = (id: number, b: Partial<Kinerja>) => api.put<{ ok: boolean; kategori?: string }>(`/kps/kinerja/${id}`, b);
export const kinerjaDelete = (id: number) => api.delete(`/kps/kinerja/${id}`);

// ── SKP — audit 6 Sasaran Keselamatan Pasien ──────────────────────────────────
export interface SkpAudit {
  id: number; tanggal?: string; sasaran: number; indikator?: string; unit?: string;
  jml_kesempatan: number; jml_patuh: number; kepatuhan?: number; auditor?: string; catatan?: string; created_at?: string;
}
export const skpList = (f: { tahun?: number; bulan?: number; sasaran?: number; unit?: string } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); });
  return api.get<SkpAudit[]>(`/skp/audit?${p}`);
};
export const skpCreate = (b: Partial<SkpAudit>) => api.post<{ ok: boolean; id: number; kepatuhan?: number }>("/skp/audit", b);
export const skpUpdate = (id: number, b: Partial<SkpAudit>) => api.put<{ ok: boolean; kepatuhan?: number }>(`/skp/audit/${id}`, b);
export const skpDelete = (id: number) => api.delete(`/skp/audit/${id}`);
export interface SkpRekap {
  tahun: number; total_audit: number;
  per_sasaran: { sasaran: number; nama: string; kesempatan: number; patuh: number; kepatuhan?: number }[];
}
export const skpRekap = (tahun?: number) => api.get<SkpRekap>(`/skp/rekap${tahun ? `?tahun=${tahun}` : ""}`);

// ── Prognas — Program Nasional ────────────────────────────────────────────────
export interface Prognas {
  id: number; tanggal?: string; program: string; no_rawat?: string; no_rkm_medis?: string; nama_pasien?: string;
  umur?: string; jenis_kelamin?: string; unit?: string; diagnosa?: string; status_kasus?: string; tindakan?: string; hasil?: string; keterangan?: string; created_at?: string;
}
export const prognasList = (f: { tahun?: number; bulan?: number; program?: string; q?: string } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); });
  return api.get<Prognas[]>(`/prognas?${p}`);
};
export const prognasCreate = (b: Partial<Prognas>) => api.post<{ ok: boolean; id: number }>("/prognas", b);
export const prognasUpdate = (id: number, b: Partial<Prognas>) => api.put<{ ok: boolean }>(`/prognas/${id}`, b);
export const prognasDelete = (id: number) => api.delete(`/prognas/${id}`);
export interface PrognasRekap { tahun: number; total: number; per_program: { label?: string; total: number }[]; per_bulan: { program: string; bulan: number; total: number }[] }
export const prognasRekap = (tahun?: number) => api.get<PrognasRekap>(`/prognas/rekap${tahun ? `?tahun=${tahun}` : ""}`);

// ── MFK — K3RS / Code Blue / APAR / Utilitas / HVA ────────────────────────────
export interface MfkK3 { id: number; tanggal?: string; nip?: string; nama_pegawai?: string; unit?: string; jenis_peristiwa?: string; lokasi_kejadian?: string; jenis_cidera?: string; bagian_tubuh?: string; penyebab?: string; kronologi?: string; tindakan?: string; tindak_lanjut?: string; status: string; created_at?: string }
export const mfkK3List = (f: { tahun?: number; status?: string; q?: string } = {}) => { const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); }); return api.get<MfkK3[]>(`/mfk/k3rs?${p}`); };
export const mfkK3Create = (b: Partial<MfkK3>) => api.post<{ ok: boolean; id: number }>("/mfk/k3rs", b);
export const mfkK3Update = (id: number, b: Partial<MfkK3>) => api.put<{ ok: boolean }>(`/mfk/k3rs/${id}`, b);
export const mfkK3Delete = (id: number) => api.delete(`/mfk/k3rs/${id}`);

export interface MfkCb { id: number; tanggal?: string; jam_aktivasi?: string; lokasi?: string; no_rawat?: string; no_rkm_medis?: string; nama_pasien?: string; jam_tim_datang?: string; response_menit?: number; kondisi_awal?: string; tindakan?: string; hasil?: string; ketua_tim?: string; catatan?: string; created_at?: string }
export const mfkCbList = (f: { tahun?: number; q?: string } = {}) => { const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); }); return api.get<MfkCb[]>(`/mfk/code-blue?${p}`); };
export const mfkCbCreate = (b: Partial<MfkCb>) => api.post<{ ok: boolean; id: number }>("/mfk/code-blue", b);
export const mfkCbUpdate = (id: number, b: Partial<MfkCb>) => api.put<{ ok: boolean }>(`/mfk/code-blue/${id}`, b);
export const mfkCbDelete = (id: number) => api.delete(`/mfk/code-blue/${id}`);

export interface MfkApar { id: number; tanggal_inspeksi?: string; no_apar?: string; lokasi?: string; jenis?: string; tekanan_ok: number; segel_ok: number; selang_ok: number; tgl_kadaluarsa?: string; kondisi: string; tindak_lanjut?: string; created_at?: string }
export const mfkAparList = (f: { tahun?: number; kondisi?: string; q?: string } = {}) => { const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); }); return api.get<MfkApar[]>(`/mfk/apar?${p}`); };
export const mfkAparCreate = (b: Partial<MfkApar>) => api.post<{ ok: boolean; id: number }>("/mfk/apar", b);
export const mfkAparUpdate = (id: number, b: Partial<MfkApar>) => api.put<{ ok: boolean }>(`/mfk/apar/${id}`, b);
export const mfkAparDelete = (id: number) => api.delete(`/mfk/apar/${id}`);

export interface MfkUtil { id: number; tanggal?: string; jam?: string; jenis_utilitas: string; parameter?: string; nilai?: string; satuan?: string; status: string; keterangan?: string; created_at?: string }
export const mfkUtilList = (f: { tahun?: number; bulan?: number; jenis?: string; status?: string } = {}) => { const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); }); return api.get<MfkUtil[]>(`/mfk/utilitas?${p}`); };
export const mfkUtilCreate = (b: Partial<MfkUtil>) => api.post<{ ok: boolean; id: number }>("/mfk/utilitas", b);
export const mfkUtilUpdate = (id: number, b: Partial<MfkUtil>) => api.put<{ ok: boolean }>(`/mfk/utilitas/${id}`, b);
export const mfkUtilDelete = (id: number) => api.delete(`/mfk/utilitas/${id}`);

export interface MfkHva { id: number; tahun: number; jenis_bahaya: string; kategori?: string; probabilitas: number; dampak_manusia: number; dampak_properti: number; dampak_bisnis: number; kesiapan: number; skor?: number; mitigasi?: string }
export const mfkHvaList = (tahun?: number) => api.get<MfkHva[]>(`/mfk/hva${tahun ? `?tahun=${tahun}` : ""}`);
export const mfkHvaCreate = (b: Partial<MfkHva>) => api.post<{ ok: boolean; id: number; skor: number }>("/mfk/hva", b);
export const mfkHvaUpdate = (id: number, b: Partial<MfkHva>) => api.put<{ ok: boolean; skor: number }>(`/mfk/hva/${id}`, b);
export const mfkHvaDelete = (id: number) => api.delete(`/mfk/hva/${id}`);

export interface MfkRekap { tahun: number; k3rs_insiden: number; code_blue: number; code_blue_avg_response?: number; apar_bermasalah: number; utilitas_gangguan: number }
export const mfkRekap = (tahun?: number) => api.get<MfkRekap>(`/mfk/rekap${tahun ? `?tahun=${tahun}` : ""}`);

// ── Manajemen & Mutu — Kepuasan / Orientasi / Kontrak Vendor ──────────────────
export interface MjKepuasan { id: number; tanggal?: string; unit?: string; periode?: string; metode?: string; jml_responden: number; nilai_ikm?: number; mutu?: string; keluhan_utama?: string; tindak_lanjut?: string; created_at?: string }
export const mjKepList = (f: { tahun?: number; unit?: string; q?: string } = {}) => { const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); }); return api.get<MjKepuasan[]>(`/manajemen/kepuasan?${p}`); };
export const mjKepCreate = (b: Partial<MjKepuasan>) => api.post<{ ok: boolean; id: number; mutu?: string }>("/manajemen/kepuasan", b);
export const mjKepUpdate = (id: number, b: Partial<MjKepuasan>) => api.put<{ ok: boolean; mutu?: string }>(`/manajemen/kepuasan/${id}`, b);
export const mjKepDelete = (id: number) => api.delete(`/manajemen/kepuasan/${id}`);

export interface MjOrientasi { id: number; nip?: string; nama: string; jenis: string; unit?: string; tanggal_mulai?: string; tanggal_selesai?: string; materi?: string; hasil?: string; nilai?: string; pembimbing?: string; catatan?: string }
export const mjOriList = (f: { tahun?: number; jenis?: string; q?: string } = {}) => { const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); }); return api.get<MjOrientasi[]>(`/manajemen/orientasi?${p}`); };
export const mjOriCreate = (b: Partial<MjOrientasi>) => api.post<{ ok: boolean; id: number }>("/manajemen/orientasi", b);
export const mjOriUpdate = (id: number, b: Partial<MjOrientasi>) => api.put<{ ok: boolean }>(`/manajemen/orientasi/${id}`, b);
export const mjOriDelete = (id: number) => api.delete(`/manajemen/orientasi/${id}`);

export interface MjKontrak { id: number; no_kontrak?: string; nama_vendor: string; jenis_layanan?: string; jenis_kontrak?: string; tanggal_mulai?: string; tanggal_berakhir?: string; nilai_kontrak?: number; status: string; evaluasi?: string; skor_evaluasi?: number; rekomendasi?: string; pic?: string; catatan?: string }
export const mjKonList = (f: { status?: string; q?: string; segera_habis?: number } = {}) => { const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); }); return api.get<MjKontrak[]>(`/manajemen/kontrak?${p}`); };
export const mjKonCreate = (b: Partial<MjKontrak>) => api.post<{ ok: boolean; id: number }>("/manajemen/kontrak", b);
export const mjKonUpdate = (id: number, b: Partial<MjKontrak>) => api.put<{ ok: boolean }>(`/manajemen/kontrak/${id}`, b);
export const mjKonDelete = (id: number) => api.delete(`/manajemen/kontrak/${id}`);

// ── Fasilitas (port Khanza): Limbah B3, Pemeliharaan Alat & Gedung ────────────
export interface FasLimbah { nip: string; nama?: string; tanggal: string; jmllimbah?: number; tujuan_penyerahan?: string; bukti_dokumen?: string; sisa_di_tps?: number; keterangan?: string }
export const fasLimbahList = (f: { tahun?: number; bulan?: number } = {}) => { const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined) p.append(k, String(v)); }); return api.get<FasLimbah[]>(`/fasilitas/limbah?${p}`); };
export const fasLimbahSave = (b: { tanggal: string; jmllimbah?: number; tujuan_penyerahan?: string; bukti_dokumen?: string; sisa_di_tps?: number; keterangan?: string; orig_tanggal?: string }) => api.post<{ ok: boolean }>("/fasilitas/limbah", b);
export const fasLimbahHapus = (b: { nip: string; tanggal: string }) => api.post<{ ok: boolean }>("/fasilitas/limbah/hapus", b);

export interface FasPmAlat { no_inventaris: string; tanggal: string; uraian_kegiatan?: string; nip?: string; nama?: string; pelaksana?: string; biaya?: number; jenis_pemeliharaan?: string }
export const fasPmAlatList = (f: { tahun?: number; q?: string } = {}) => { const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); }); return api.get<FasPmAlat[]>(`/fasilitas/pemeliharaan-alat?${p}`); };
export const fasPmAlatSave = (b: { no_inventaris: string; tanggal: string; uraian_kegiatan?: string; pelaksana?: string; biaya?: number; jenis_pemeliharaan?: string; orig_no?: string; orig_tanggal?: string }) => api.post<{ ok: boolean }>("/fasilitas/pemeliharaan-alat", b);
export const fasPmAlatHapus = (b: { no_inventaris: string; tanggal: string }) => api.post<{ ok: boolean }>("/fasilitas/pemeliharaan-alat/hapus", b);

export interface FasPmGedung { no_pemeliharaan: string; tanggal?: string; uraian_kegiatan?: string; nip?: string; nama?: string; pelaksana?: string; biaya?: number; jenis_pemeliharaan?: string; tindak_lanjut?: string }
export const fasPmGedungList = (f: { tahun?: number; q?: string } = {}) => { const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); }); return api.get<FasPmGedung[]>(`/fasilitas/pemeliharaan-gedung?${p}`); };
export const fasPmGedungSave = (b: { no_pemeliharaan: string; tanggal?: string; uraian_kegiatan?: string; pelaksana?: string; biaya?: number; jenis_pemeliharaan?: string; tindak_lanjut?: string }) => api.post<{ ok: boolean }>("/fasilitas/pemeliharaan-gedung", b);
export const fasPmGedungHapus = (b: { no_pemeliharaan: string }) => api.post<{ ok: boolean }>("/fasilitas/pemeliharaan-gedung/hapus", b);

export interface FasPcra {
  no_pcra: string; no_proyek?: string; nama_proyek?: string; lokasi_proyek?: string; mulai_proyek?: string; perkiraan_selesai?: string;
  deskripsi_pekerjaan?: string; penangung_jawab_proyek?: string; pelaksana_proyek?: string; deskripsi_lokasi_proyek?: string;
  kode_aktivitas?: string; kode_kelas_risiko?: string; dibutuhkan_icra?: string; rekomendasi_selama_pengerjaan?: string;
  rekomendasi_setelah_pengerjaan?: string; hal_yang_perlu_dimonitor?: string; catatan_tim_ppi_k3_lainnya?: string; tanggal_pengkajian?: string;
}
export const fasPcraList = (f: { tahun?: number; q?: string } = {}) => { const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.append(k, String(v)); }); return api.get<FasPcra[]>(`/fasilitas/pcra?${p}`); };
export const fasPcraSave = (b: Partial<FasPcra>) => api.post<{ ok: boolean }>("/fasilitas/pcra", b);
export const fasPcraHapus = (b: { no_pcra: string }) => api.post<{ ok: boolean }>("/fasilitas/pcra/hapus", b);

// ── Catatan Keperawatan (CPPT keperawatan) — ralan/IGD & ranap ────────────────
export interface CatatanKeperawatan {
  tanggal?: string; jam?: string; td?: string; nadi?: string; rr?: string; suhu?: string; spo2?: string;
  uraian?: string; nip?: string; petugas?: string; milik: number;
}
export const ckList = (jenis: string, no_rawat: string) =>
  api.get<CatatanKeperawatan[]>(`/keperawatan/catatan?jenis=${encodeURIComponent(jenis)}&no_rawat=${encodeURIComponent(no_rawat)}`);
export const ckCreate = (b: { jenis: string; no_rawat: string; tanggal?: string; jam?: string; td?: string; nadi?: string; rr?: string; suhu?: string; spo2?: string; uraian?: string }) =>
  api.post<{ ok: boolean; tanggal: string; jam: string }>("/keperawatan/catatan", b);
export const ckUpdate = (b: { jenis: string; no_rawat: string; tanggal: string; jam: string; td?: string; nadi?: string; rr?: string; suhu?: string; spo2?: string; uraian?: string; orig_tanggal: string; orig_jam: string }) =>
  api.post<{ ok: boolean }>("/keperawatan/catatan/update", b);
export const ckHapus = (b: { jenis: string; no_rawat: string; tanggal: string; jam: string }) =>
  api.post<{ ok: boolean }>("/keperawatan/catatan/hapus", b);
export interface CkCetak {
  jenis: string; no_rawat: string;
  rs?: { nama?: string; alamat?: string; kabupaten?: string; propinsi?: string; kontak?: string; email?: string } | null;
  pasien?: { no_rkm_medis?: string; nama?: string; jk?: string; tgl_lahir?: string; umur?: string } | null;
  entries: { tanggal?: string; jam?: string; td?: string; nadi?: string; rr?: string; suhu?: string; spo2?: string; uraian?: string; petugas?: string }[];
}
export const ckCetak = (jenis: string, no_rawat: string) =>
  api.get<CkCetak>(`/keperawatan/catatan/cetak?jenis=${encodeURIComponent(jenis)}&no_rawat=${encodeURIComponent(no_rawat)}`);

// ── Pengkajian Awal Keperawatan (metadata-driven, semua varian) ──────────────
export interface PengkajianInstrumen { key: string; nama: string }
export interface PengkajianField { name: string; kind: string; options: string[]; nullable: boolean }
export interface PengkajianSkema {
  nama: string; fields: PengkajianField[];
  masalah: boolean; rencana: boolean; masalah_col: string | null; rencana_col: string | null;
}
export interface PengkajianData {
  data: Record<string, string | null> | null; masalah: string[]; rencana: string[];
}
export const enakesPengkajianInstrumen = () =>
  api.get<PengkajianInstrumen[]>("/enakes/pengkajian/instrumen");
export const enakesPengkajianSkema = (instrumen: string) =>
  api.get<PengkajianSkema>(`/enakes/pengkajian/skema?instrumen=${encodeURIComponent(instrumen)}`);
export const enakesPengkajianGet = (instrumen: string, no_rawat: string) =>
  api.get<PengkajianData>(`/enakes/pengkajian?instrumen=${encodeURIComponent(instrumen)}&no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesPengkajianSave = (b: {
  instrumen: string; no_rawat: string; data: Record<string, string>; masalah?: string[]; rencana?: string[];
}) => api.post<{ ok: boolean }>("/enakes/pengkajian", b);
export interface PengkajianMaster { kode: string; nama: string; induk: string }
export const enakesPengkajianMaster = (jenis: "masalah" | "rencana") =>
  api.get<PengkajianMaster[]>(`/enakes/pengkajian/master?jenis=${jenis}`);

// ── Persetujuan / Penolakan Tindakan Kedokteran ──────────────────────────────
export interface EnakesPenolakan {
  no_pernyataan: string; tanggal: string | null; tindakan: string; pernyataan: string; penerima: string; petugas: string; milik?: number;
}
export const enakesPenolakanList = (no_rawat: string) =>
  api.get<EnakesPenolakan[]>(`/enakes/penolakan?no_rawat=${encodeURIComponent(no_rawat)}`);
export interface EnakesPenolakanDetail {
  grid: Record<string, string>; konf: Record<string, boolean>;
  kd_dokter: string; pernyataan: string; penerima_informasi: string; alasan_diwakilkan_penerima_informasi: string;
  jk_penerima_informasi: string; tanggal_lahir_penerima_informasi: string; umur_penerima_informasi: string;
  alamat_penerima_informasi: string; no_hp: string; hubungan_penerima_informasi: string; saksi_keluarga: string;
  dapat_edit: boolean;
}
export const enakesPenolakanDetail = (no_pernyataan: string) =>
  api.get<EnakesPenolakanDetail | null>(`/enakes/penolakan/detail?no_pernyataan=${encodeURIComponent(no_pernyataan)}`);
export const enakesPenolakanHapus = (b: { no_pernyataan: string }) =>
  api.post<{ ok: boolean }>("/enakes/penolakan/hapus", b);
export interface EnakesPenolakanBody {
  no_rawat: string; edit?: boolean; no_pernyataan?: string;
  diagnosa?: string; diagnosa_konfirmasi?: boolean;
  dasar_diagnosa?: string; dasar_diagnosa_konfirmasi?: boolean;
  tindakan?: string; tindakan_konfirmasi?: boolean;
  indikasi_tindakan?: string; indikasi_tindakan_konfirmasi?: boolean;
  tujuan?: string; tujuan_konfirmasi?: boolean;
  risiko?: string; risiko_konfirmasi?: boolean;
  komplikasi?: string; komplikasi_konfirmasi?: boolean;
  prognosis?: string; prognosis_konfirmasi?: boolean;
  alternatif_dan_risikonya?: string; alternatif_konfirmasi?: boolean;
  lain_lain?: string; lain_lain_konfirmasi?: boolean;
  kd_dokter?: string;
  penerima_informasi?: string; alasan_diwakilkan_penerima_informasi?: string;
  jk_penerima_informasi?: string; tanggal_lahir_penerima_informasi?: string; umur_penerima_informasi?: string;
  alamat_penerima_informasi?: string; no_hp?: string; hubungan_penerima_informasi?: string;
  pernyataan?: string; saksi_keluarga?: string;
}
export const enakesPenolakanSave = (b: EnakesPenolakanBody) =>
  api.post<{ ok: boolean; no_pernyataan: string }>("/enakes/penolakan", b);
export const enakesPenolakanBukti = (b: {
  no_pernyataan: string; penerima_foto?: string; penerima_ttd?: string; saksi_foto?: string; saksi_ttd?: string;
}) => api.post<{ ok: boolean }>("/enakes/penolakan/bukti", b);
// Booking Operasi — daftar pasien terjadwal operasi (per tanggal)
export interface EnakesOperasi {
  no_rawat: string; no_rm: string; nm_pasien: string; tanggal: string;
  jam_mulai: string; jam_selesai: string; status: string; dokter: string;
  paket: string; umur: string; jk: string; poli: string; ruang: string; jenis: string;
}
export const enakesOperasi = (p: { tgl?: string; cari?: string }) => {
  const q = new URLSearchParams();
  if (p.tgl) q.set("tgl", p.tgl);
  if (p.cari) q.set("cari", p.cari);
  return api.get<EnakesOperasi[]>(`/enakes/operasi?${q.toString()}`);
};
// Skrining PHQ-9 (Patient Health Questionnaire-9)
export interface EnakesPhq9 {
  tanggal: string | null;
  phq1: number; phq2: number; phq3: number; phq4: number; phq5: number;
  phq6: number; phq7: number; phq8: number; phq9: number;
  total_skor: number; kesimpulan: string; petugas: string; milik?: number;
}
export const enakesPhq9List = (no_rawat: string) =>
  api.get<EnakesPhq9[]>(`/enakes/phq9?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesPhq9Save = (b: { no_rawat: string; nilai: number[]; edit?: boolean; orig_tanggal?: string; waktu?: string }) =>
  api.post<{ ok: boolean; total: number; kesimpulan: string }>("/enakes/phq9", b);
// Skrining ASQ (Ask Suicide-Screening Questions) — RM.103
export interface EnakesAsq {
  tanggal: string | null;
  asq1: string; asq2: string; asq3: string; asq4: string; asq5: string;
  ket4: string; ket5: string; kesimpulan: string; petugas: string; milik?: number;
}
export const enakesAsqList = (no_rawat: string) =>
  api.get<EnakesAsq[]>(`/enakes/asq?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesAsqSave = (b: {
  no_rawat: string; asq1: string; asq2: string; asq3: string; asq4: string; asq5: string; ket4?: string; ket5?: string;
  edit?: boolean; orig_tanggal?: string; waktu?: string;
}) => api.post<{ ok: boolean; kesimpulan: string }>("/enakes/asq", b);
// Asesmen Risiko Kekerasan Fisik & Melarikan Diri (RM.103) — Statik(1)/Dinamis(2)
export interface EnakesRisiko {
  tanggal: string | null; statik_total: number; dinamis_total: number;
  total: number; level: string; pencegahan: string; petugas: string; milik?: number;
}
export type RisikoBody = { no_rawat: string; statik: string[]; dinamis: string[]; pencegahan?: string; edit?: boolean; orig_tanggal?: string; waktu?: string };
export type RisikoDetail = { statik: string[]; dinamis: string[]; pencegahan: string; dapat_edit: boolean } | null;
export const enakesKekerasanList = (no_rawat: string) =>
  api.get<EnakesRisiko[]>(`/enakes/kekerasan?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesKekerasanDetail = (no_rawat: string, tanggal: string) =>
  api.get<RisikoDetail>(`/enakes/kekerasan/detail?no_rawat=${encodeURIComponent(no_rawat)}&tanggal=${encodeURIComponent(tanggal)}`);
export const enakesKekerasanSave = (b: RisikoBody) =>
  api.post<{ ok: boolean; total: number; level: string }>("/enakes/kekerasan", b);
export const enakesMelarikanList = (no_rawat: string) =>
  api.get<EnakesRisiko[]>(`/enakes/melarikan?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesMelarikanDetail = (no_rawat: string, tanggal: string) =>
  api.get<RisikoDetail>(`/enakes/melarikan/detail?no_rawat=${encodeURIComponent(no_rawat)}&tanggal=${encodeURIComponent(tanggal)}`);
export const enakesMelarikanSave = (b: RisikoBody) =>
  api.post<{ ok: boolean; total: number; level: string }>("/enakes/melarikan", b);
// Pengkajian Keperawatan Pasien ICU (Comprehensive Admission Assessment)
export interface EnakesPengkajianIcu { exists: boolean; tanggal?: string; gizi_skor?: number; data?: Record<string, unknown> }
export interface EnakesPengkajianIcuRow { tanggal: string | null; gizi_skor: number; petugas: string; milik?: number }
export const enakesPengkajianIcuGet = (no_rawat: string) =>
  api.get<EnakesPengkajianIcu>(`/enakes/pengkajian-icu?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesPengkajianIcuRiwayat = (no_rawat: string) =>
  api.get<EnakesPengkajianIcuRow[]>(`/enakes/pengkajian-icu/riwayat?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesPengkajianIcuDetail = (no_rawat: string, tanggal: string) =>
  api.get<{ data: Record<string, unknown>; gizi_skor: number; dapat_edit: boolean } | null>(
    `/enakes/pengkajian-icu/detail?no_rawat=${encodeURIComponent(no_rawat)}&tanggal=${encodeURIComponent(tanggal)}`);
export const enakesPengkajianIcuSave = (b: { no_rawat: string; data: Record<string, unknown>; gizi_skor: number; edit?: boolean; orig_tanggal?: string; waktu?: string }) =>
  api.post<{ ok: boolean }>("/enakes/pengkajian-icu", b);
// Kriteria Masuk ICU — REVISI RM.KEP.08.052.2022 (form terpisah)
export interface EnakesKmIcu2022Row { tanggal: string | null; petugas: string; milik?: number }
export const enakesKmIcu2022List = (no_rawat: string) =>
  api.get<EnakesKmIcu2022Row[]>(`/enakes/kriteria-masuk-icu-2022?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesKmIcu2022Detail = (no_rawat: string, tanggal: string) =>
  api.get<{ data: Record<string, unknown>; dapat_edit: boolean } | null>(
    `/enakes/kriteria-masuk-icu-2022/detail?no_rawat=${encodeURIComponent(no_rawat)}&tanggal=${encodeURIComponent(tanggal)}`);
export const enakesKmIcu2022Save = (b: { no_rawat: string; data: Record<string, unknown>; edit?: boolean; orig_tanggal?: string; waktu?: string }) =>
  api.post<{ ok: boolean }>("/enakes/kriteria-masuk-icu-2022", b);
export const enakesKmIcu2022Hapus = (b: { no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/kriteria-masuk-icu-2022/hapus", b);
// Surat Pulang Atas Permintaan Sendiri (APS) — e-Nakes + foto/TTD
export interface EnakesAps {
  exists: boolean; no_surat?: string; tgl_pulang?: string; rs_pilihan?: string; nama_pj?: string;
  lahir?: string; umur?: string; jkpj?: string; alamat?: string; hubungan?: string; saksi_keluarga?: string;
  pembuat_foto?: boolean; pembuat_ttd?: boolean; saksi_foto?: boolean; saksi_ttd?: boolean; dapat_edit?: boolean;
}
export const enakesApsGet = (no_rawat: string) =>
  api.get<EnakesAps>(`/enakes/aps?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesApsSave = (b: {
  no_rawat: string; tgl_pulang?: string; rs_pilihan?: string; nama_pj?: string; lahir?: string;
  umur?: string; jkpj?: string; alamat?: string; hubungan?: string; saksi_keluarga?: string;
  edit?: boolean; no_surat?: string;
}) => api.post<{ ok: boolean; no_surat: string }>("/enakes/aps", b);
export const enakesApsBukti = (b: {
  no_surat: string; pembuat_foto?: string; pembuat_ttd?: string; saksi_foto?: string; saksi_ttd?: string;
}) => api.post<{ ok: boolean }>("/enakes/aps/bukti", b);
// eMAR / Kardek Obat (Jadwal Obat 2) — pencatatan pemberian obat + bukti foto/TTD
export interface EnakesEmarObat {
  no_urut: number; nama_obat: string; kekuatan: string; bentuk_sediaan: string; aturan_pakai: string;
  rute_pemberian: string; section: string; high_alert: string; is_prn: string; nm_dokter: string;
  tgl_mulai: string; tgl_stop: string;
}
export interface EnakesEmarDetail {
  no_urut: number; jam: string; status: string; alasan: string; catatan_klinis: string; petugas: string;
  nama_penerima: string; hubungan_penerima: string; ada_foto: number; ada_ttd: number; waktu_aktual: string; milik?: number;
}
export const enakesEmarGet = (no_rawat: string, tgl: string) =>
  api.get<{ tgl: string; obat: EnakesEmarObat[]; detail: EnakesEmarDetail[] }>(
    `/enakes/emar?no_rawat=${encodeURIComponent(no_rawat)}&tgl=${encodeURIComponent(tgl)}`);
export const enakesEmarTambahObat = (b: {
  no_rawat: string; tgl: string; nama_obat: string; kekuatan?: string; bentuk_sediaan?: string;
  aturan_pakai?: string; rute_pemberian?: string; section?: string; high_alert?: string; is_prn?: string;
}) => api.post<{ ok: boolean; no_urut: number }>("/enakes/emar/obat", b);
export interface EmarBeriItem {
  no_urut: number; status: string; alasan?: string; catatan_klinis?: string;
  nama_penerima?: string; hubungan_penerima?: string; nip_double_check?: string;
}
export const enakesEmarBeri = (b: {
  no_rawat: string; tgl: string; jam: string; waktu_aktual?: string; foto?: string; ttd?: string; items: EmarBeriItem[];
}) => api.post<{ ok: boolean }>("/enakes/emar/beri", b);
// Checklist Keselamatan Operasi — 3 fase terpisah (waktu berbeda, tabel berbeda)
// GET juga mengembalikan `tanggal` record, `nip` penginput, & `dapat_edit`
// (true bila user login = penginput / admin). Edit in-place kirim `edit_tanggal`.
type ChkResp = Record<string, string> & { exists: boolean; dapat_edit?: boolean };
export const enakesSignInGet = (no_rawat: string) =>
  api.get<ChkResp>(`/enakes/signin?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesSignInSave = (b: {
  no_rawat: string; tanggal?: string; edit_tanggal?: string; kd_dokter_bedah?: string; kd_dokter_anestesi?: string; tindakan: string;
  identitas: boolean; penandaan_area_operasi: boolean; mesin_anestesi: boolean; pulse_oximetri: boolean;
  alergi: boolean; gangguan_pernapasan: boolean; resiko_perdarahan: boolean;
  peralatan_khusus: boolean; jenis_peralatan: string;
}) => api.post<{ ok: boolean }>("/enakes/signin", b);
export const enakesSignInHapus = (b: { no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/signin/hapus", b);
export const enakesTimeOutGet = (no_rawat: string) =>
  api.get<ChkResp>(`/enakes/timeout?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesTimeOutSave = (b: {
  no_rawat: string; tanggal?: string; edit_tanggal?: string; kd_dokter_bedah?: string; kd_dokter_anestesi?: string; tindakan: string;
  identitas_perkenalan: boolean; nama_pasien_tindakan_area_insisi: boolean; profilaksis_antibiotik: boolean;
  hal_khusus_bedah: boolean; lama_tindakan: string; antisipasi_perdarahan: boolean; kekhawatiran_anestesi: boolean;
  kesterilan_alat: boolean; kesiapan_peralatan: boolean; hasil_radiologi: boolean;
  tim_asisten?: string; tim_instrumen?: string; tim_sirkuler?: string; tim_penata?: string;
  profilaksis_obat?: string; jumlah_kasa?: string; jumlah_instrumen?: string; jumlah_jarum?: string;
}) => api.post<{ ok: boolean }>("/enakes/timeout", b);
export const enakesTimeOutHapus = (b: { no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/timeout/hapus", b);
export const enakesSignOutGet = (no_rawat: string) =>
  api.get<ChkResp>(`/enakes/signout?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesSignOutSave = (b: {
  no_rawat: string; tanggal?: string; edit_tanggal?: string; kd_dokter_bedah?: string; kd_dokter_anestesi?: string; tindakan: string;
  verbal_tindakan: boolean; verbal_kelengkapan_kasa: boolean; verbal_instrumen: boolean; verbal_alat_tajam: boolean;
  kelengkapan_specimen_label: boolean; perhatian_utama_fase_pemulihan: string;
  jumlah_kasa?: string; jumlah_instrumen?: string; jumlah_jarum?: string;
}) => api.post<{ ok: boolean }>("/enakes/signout", b);
export const enakesSignOutHapus = (b: { no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/signout/hapus", b);
// Asuhan Keperawatan Kamar Bedah (RM.KEP.08.044) — DIPECAH per PERISTIWA
// (waktu berbeda): Pra-Op (data_awal+preop+masalah), Intra-Op (intraop),
// Post-Op (postop+diagnosa). Tiap peristiwa punya tanggal & simpan sendiri.
export interface AsuhanKb {
  exists: boolean; tanggal?: string; nip?: string; dapat_edit?: boolean;
  data_awal?: Record<string, string>; preop?: Record<string, string>; masalah?: Record<string, string>;
  intraop?: Record<string, string>; postop?: Record<string, string>; diagnosa?: Record<string, string>;
}
type AkbSave = { no_rawat: string; tanggal?: string; edit_tanggal?: string } & Partial<Record<
  "data_awal" | "preop" | "masalah" | "intraop" | "postop" | "diagnosa", Record<string, string>>>;
export const enakesAskepPraopGet = (no_rawat: string) =>
  api.get<AsuhanKb>(`/enakes/askep-kb/praop?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesAskepPraopSave = (b: AkbSave) => api.post<{ ok: boolean }>("/enakes/askep-kb/praop", b);
export const enakesAskepPraopHapus = (b: { no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/askep-kb/praop/hapus", b);
export const enakesAskepIntraopGet = (no_rawat: string) =>
  api.get<AsuhanKb>(`/enakes/askep-kb/intraop?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesAskepIntraopSave = (b: AkbSave) => api.post<{ ok: boolean }>("/enakes/askep-kb/intraop", b);
export const enakesAskepIntraopHapus = (b: { no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/askep-kb/intraop/hapus", b);
export const enakesAskepPostopGet = (no_rawat: string) =>
  api.get<AsuhanKb>(`/enakes/askep-kb/postop?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesAskepPostopSave = (b: AkbSave) => api.post<{ ok: boolean }>("/enakes/askep-kb/postop", b);
export const enakesAskepPostopHapus = (b: { no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/askep-kb/postop/hapus", b);

// Anestesi Sedasi (RM.IBS.11.005.A/B REV.01) — 4 fase + 2 monitoring.
// pra/selama/pasca: 1 aktif per pasien (replace saat simpan). monitoring &
// monitoring_pasca: multi-baris (list + tambah + hapus per baris).
export type SedasiRec = Record<string, string> & { exists: boolean };
export type SedasiMonRow = Record<string, string>;
export const enakesSedasiPraGet = (no_rawat: string) => api.get<SedasiRec>(`/enakes/sedasi/pra?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesSedasiPraSave = (b: Record<string, unknown>) => api.post<{ ok: boolean }>("/enakes/sedasi/pra", b);
export const enakesSedasiSelamaGet = (no_rawat: string) => api.get<SedasiRec>(`/enakes/sedasi/selama?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesSedasiSelamaSave = (b: Record<string, unknown>) => api.post<{ ok: boolean }>("/enakes/sedasi/selama", b);
export const enakesSedasiPascaGet = (no_rawat: string) => api.get<SedasiRec>(`/enakes/sedasi/pasca?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesSedasiPascaSave = (b: Record<string, unknown>) => api.post<{ ok: boolean }>("/enakes/sedasi/pasca", b);
export const enakesSedasiMonList = (no_rawat: string) => api.get<SedasiMonRow[]>(`/enakes/sedasi/monitoring?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesSedasiMonSave = (b: Record<string, unknown>) => api.post<{ ok: boolean }>("/enakes/sedasi/monitoring", b);
export const enakesSedasiMonHapus = (b: { no_rawat: string; tanggal: string }) => api.post<{ ok: boolean }>("/enakes/sedasi/monitoring/hapus", b);
export const enakesSedasiMonpList = (no_rawat: string) => api.get<SedasiMonRow[]>(`/enakes/sedasi/monitoring-pasca?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesSedasiMonpSave = (b: Record<string, unknown>) => api.post<{ ok: boolean }>("/enakes/sedasi/monitoring-pasca", b);
export const enakesSedasiMonpHapus = (b: { no_rawat: string; tanggal: string }) => api.post<{ ok: boolean }>("/enakes/sedasi/monitoring-pasca/hapus", b);
// Penandaan Lokasi Operasi — TTD & foto pasien (path + hash, tamper-evidence)
export interface EnakesPenandaan {
  exists: boolean; tanggal?: string; operasi?: string; ruangan?: string; nm_dokter?: string;
  nama_penanda?: string; hubungan?: string; pernyataan?: string;
  foto_ada?: boolean; ttd_ada?: boolean; hash?: string;
  marking_points?: string; penginput_nip?: string; penginput_nama?: string; bisa_hapus?: boolean;
}
export const enakesPenandaanGet = (no_rawat: string) =>
  api.get<EnakesPenandaan>(`/enakes/penandaan?no_rawat=${encodeURIComponent(no_rawat)}`);
export const enakesPenandaanTtdSave = (b: {
  no_rawat: string; tanggal: string; nama_penanda: string; hubungan: string;
  marking_points: string; foto: string; ttd: string;
}) => api.post<{ ok: boolean; hash: string }>("/enakes/penandaan/ttd", b);
export const enakesPenandaanHapus = (b: { no_rawat: string; tanggal: string }) =>
  api.post<{ ok: boolean }>("/enakes/penandaan/hapus", b);
// Telaah Resep (per no_resep)
export interface ResepTelaah { no_resep: string; tgl?: string; jam?: string; jml: number; sudah: number }
export interface Telaah {
  no_resep: string;
  resep_identifikasi_pasien: string; resep_ket_identifikasi_pasien: string;
  resep_tepat_obat: string; resep_ket_tepat_obat: string;
  resep_tepat_dosis: string; resep_ket_tepat_dosis: string;
  resep_tepat_cara_pemberian: string; resep_ket_tepat_cara_pemberian: string;
  resep_tepat_waktu_pemberian: string; resep_ket_tepat_waktu_pemberian: string;
  resep_ada_tidak_duplikasi_obat: string; resep_ket_ada_tidak_duplikasi_obat: string;
  resep_interaksi_obat: string; resep_ket_interaksi_obat: string;
  resep_kontra_indikasi_obat: string; resep_ket_kontra_indikasi_obat: string;
  obat_tepat_pasien: string; obat_tepat_obat: string; obat_tepat_dosis: string;
  obat_tepat_cara_pemberian: string; obat_tepat_waktu_pemberian: string;
}
export const getEfarmasiResepTelaah = (no_rawat: string) =>
  api.get<ResepTelaah[]>(`/efarmasi/resep-telaah?no_rawat=${encodeURIComponent(no_rawat)}`);
export const getEfarmasiTelaah = (no_resep: string) =>
  api.get<Telaah>(`/efarmasi/telaah?no_resep=${encodeURIComponent(no_resep)}`);
export const saveEfarmasiTelaah = (b: Partial<Telaah>) => api.post<{ ok: boolean }>("/efarmasi/telaah", b);
// Alergi
export interface Alergi { tgl?: string; allergy_code: string; category: string; note: string; reactioncode: string; severity: string }
export interface AlergiResp { list: Alergi[]; catatan: string }
export const getEfarmasiAlergi = (no_rawat: string) =>
  api.get<AlergiResp>(`/efarmasi/alergi?no_rawat=${encodeURIComponent(no_rawat)}`);
export const saveEfarmasiAlergi = (b: { no_rawat: string; category?: string; allergy_code?: string; note?: string; reactioncode?: string; severity?: string }) =>
  api.post<{ ok: boolean }>("/efarmasi/alergi", b);
// Asuhan farmasi: Pemberian Obat (e-MAR), PTO, Rekonsiliasi
export interface PemberianObat { tgl?: string; jam?: string; nama: string; jml?: string; status: string; bangsal: string }
export const getEfarmasiPemberianObat = (no_rawat: string) =>
  api.get<PemberianObat[]>(`/efarmasi/pemberian-obat?no_rawat=${encodeURIComponent(no_rawat)}`);
export interface Pto { id: number; nama_obat: string; dosis: string; cara: string; tgl_mulai?: string; jumlah_hari?: number; keterangan: string; status: string }
export const getEfarmasiPto = (no_rawat: string) => api.get<Pto[]>(`/efarmasi/pto?no_rawat=${encodeURIComponent(no_rawat)}`);
export const saveEfarmasiPto = (b: { no_rawat: string; nama_obat: string; jenis_obat?: string; dosis?: string; cara_pemberian?: string; tgl_mulai_terapi?: string; jumlah_hari?: number; keterangan?: string; status?: string }) =>
  api.post<{ ok: boolean }>("/efarmasi/pto", b);
export interface RekDetail { nama_obat: string; dosis_obat: string; frekuensi: string; cara_pemberian: string; tindak_lanjut: string; perubahan_aturan_pakai: string }
export interface Rekonsiliasi { no_rekonsiliasi: string; tanggal?: string; rekonsiliasi_obat_saat: string; alergi_obat: string; manifestasi_alergi: string; detail: RekDetail[] }
export const getEfarmasiRekonsiliasi = (no_rawat: string) => api.get<Rekonsiliasi[]>(`/efarmasi/rekonsiliasi?no_rawat=${encodeURIComponent(no_rawat)}`);
export const saveEfarmasiRekonsiliasi = (b: { no_rawat: string; rekonsiliasi_obat_saat?: string; alergi_obat?: string; manifestasi_alergi?: string; obat: { nama_obat: string; dosis_obat?: string; frekuensi?: string; cara_pemberian?: string; tindak_lanjut?: string }[] }) =>
  api.post<{ ok: boolean; no_rekonsiliasi: string }>("/efarmasi/rekonsiliasi", b);
// ── PTO lengkap — Pemantauan Terapi Obat (formulir apoteker, form fisik RM) ──
export interface PtoRingkas { tanggal: string; ringkas: string; petugas: string; milik: number }
export interface PtoHeader {
  tanggal: string; ruangan: string; tgl_masuk: string; dpjp: string; bb: string; tb: string;
  alergi_obat: string; apoteker: string; keluhan_utama: string;
  riwayat_penyakit_sekarang: string; riwayat_penyakit_terdahulu: string;
  riwayat_keluarga: string; riwayat_sosial: string;
  soap_s: string; soap_o: string; soap_a: string; soap_p: string; nip: string;
}
export interface PtoRiwayatObat { nama_obat: string; rejimen_dosis: string; rute: string; waktu_mulai: string }
export interface PtoPenunjang { tgl_pemeriksaan: string; nama_pemeriksaan: string; hasil: string; satuan: string; nilai_rujukan: string }
export interface PtoObatSaatIni { tgl_mulai_terapi: string; nama_obat: string; rejimen: string; indikasi: string }
export interface PtoPasien { no_rkm_medis: string; nama: string; jk: string; tgl_lahir: string; umur: string }
export interface PtoAwal {
  pasien: PtoPasien | null; ruangan: string; tgl_masuk: string; dpjp: string; bb: string; tb: string;
  alergi_obat: string; apoteker: string;
  obat_saat_ini: { tgl_mulai_terapi: string; nama_obat: string; rejimen: string }[];
  penunjang: PtoPenunjang[];
}
export interface PtoDetail {
  header: PtoHeader; riwayat_obat: PtoRiwayatObat[]; penunjang: PtoPenunjang[];
  obat_saat_ini: PtoObatSaatIni[]; dapat_edit: boolean;
}
export interface PtoCetak {
  no_rawat: string;
  rs: { nama?: string; alamat?: string; kabupaten?: string; propinsi?: string; kontak?: string; email?: string } | null;
  pasien: PtoPasien | null; header: PtoHeader; petugas: string;
  riwayat_obat: PtoRiwayatObat[]; penunjang: PtoPenunjang[]; obat_saat_ini: PtoObatSaatIni[];
}
export interface PtoSimpanBody extends Partial<Omit<PtoHeader, "nip">> {
  no_rawat: string; edit?: boolean; orig_tanggal?: string;
  riwayat_obat: PtoRiwayatObat[]; penunjang: PtoPenunjang[]; obat_saat_ini: PtoObatSaatIni[];
}
export const ptoAwal = (no_rawat: string) => api.get<PtoAwal>(`/pto/awal?no_rawat=${encodeURIComponent(no_rawat)}`);
export const ptoList = (no_rawat: string) => api.get<PtoRingkas[]>(`/pto/list?no_rawat=${encodeURIComponent(no_rawat)}`);
export const ptoDetail = (no_rawat: string, tanggal: string) =>
  api.get<PtoDetail | null>(`/pto/detail?no_rawat=${encodeURIComponent(no_rawat)}&tanggal=${encodeURIComponent(tanggal)}`);
export const ptoSimpan = (b: PtoSimpanBody) => api.post<{ ok: boolean; tanggal: string }>("/pto/simpan", b);
export const ptoHapus = (b: { no_rawat: string; tanggal: string }) => api.post<{ ok: boolean }>("/pto/hapus", b);
export const ptoCetak = (no_rawat: string, tanggal: string) =>
  api.get<PtoCetak>(`/pto/cetak?no_rawat=${encodeURIComponent(no_rawat)}&tanggal=${encodeURIComponent(tanggal)}`);

// Konseling & MESO
export interface Konseling { tanggal?: string; diagnosa: string; obat_pemakaian: string; riwayat_alergi: string; keluhan: string; pernah_datang: string; tindak_lanjut: string }
export const getEfarmasiKonseling = (no_rawat: string) => api.get<Konseling[]>(`/efarmasi/konseling?no_rawat=${encodeURIComponent(no_rawat)}`);
export const saveEfarmasiKonseling = (b: { no_rawat: string; diagnosa?: string; obat_pemakaian?: string; riwayat_alergi?: string; keluhan?: string; pernah_datang?: string; tindak_lanjut?: string }) =>
  api.post<{ ok: boolean }>("/efarmasi/konseling", b);
export const edokterSoapie = (no_rawat: string, jenis: string) =>
  api.get<EdokterSoapie[]>(`/edokter/soapie?no_rawat=${encodeURIComponent(no_rawat)}&jenis=${encodeURIComponent(jenis)}`);
export const edokterResep = (no_rawat: string) =>
  api.get<EdokterResep[]>(`/edokter/resep?no_rawat=${encodeURIComponent(no_rawat)}`);

// ── edokter tahap 2: input ──────────────────────────────────────────────────
export interface EdokterSoapieInput {
  no_rawat: string; jenis: string;
  suhu_tubuh?: string; tensi?: string; nadi?: string; respirasi?: string;
  tinggi?: string; berat?: string; spo2?: string; gcs?: string; kesadaran?: string;
  keluhan?: string; pemeriksaan?: string; penilaian?: string; rtl?: string;
  instruksi?: string; evaluasi?: string; alergi?: string;
  // Waktu bisa diatur manual (kosong = sekarang). Untuk edit, kirim edit_tgl+edit_jam (waktu asal).
  tgl_perawatan?: string; jam_rawat?: string; edit_tgl?: string; edit_jam?: string;
}
export const edokterSimpanSoapie = (b: EdokterSoapieInput) =>
  api.post<{ ok: boolean }>("/edokter/soapie", b);
export const edokterHapusSoapie = (b: { no_rawat: string; jenis: string; tgl_perawatan: string; jam_rawat: string }) =>
  api.post<{ ok: boolean }>("/edokter/soapie/hapus", b);

// ── Asesmen Awal Medis Kritis ICU (e-dokter) ────────────────────────────────
export interface EdokterIcuAktif {
  exists: boolean; id?: number; tanggal?: string | null; tiba_ruangan?: string | null;
  kd_dokter?: string; nm_dokter?: string; created_by?: string; created_at?: string | null;
  data?: Record<string, string>;
}
export interface EdokterIcuHistori {
  id: number; waktu_buat: string | null; created_by: string; tanggal: string | null;
  kesadaran: string; diagnosa_kerja: string; status: string;
  updated_at: string | null; updated_by: string; keterangan_edit: string;
}
const kdq = (kd_dokter?: string) => (kd_dokter ? `&kd_dokter=${encodeURIComponent(kd_dokter)}` : "");
export const edokterIcuGet = (no_rawat: string, kd_dokter?: string) =>
  api.get<EdokterIcuAktif>(`/edokter/icu?no_rawat=${encodeURIComponent(no_rawat)}${kdq(kd_dokter)}`);
export const edokterIcuHistori = (no_rawat: string, kd_dokter?: string) =>
  api.get<EdokterIcuHistori[]>(`/edokter/icu/histori?no_rawat=${encodeURIComponent(no_rawat)}${kdq(kd_dokter)}`);
export const edokterIcuSave = (b: {
  no_rawat: string; kd_dokter?: string; tanggal?: string; tiba_ruangan?: string;
  data: Record<string, string>; keterangan_edit?: string;
}) => api.post<{ ok: boolean; id: number; revised: boolean }>("/edokter/icu", b);
export const edokterIcuBatal = (b: { no_rawat: string; kd_dokter?: string; keterangan_edit?: string }) =>
  api.post<{ ok: boolean; dibatalkan: number }>("/edokter/icu/batal", b);

export interface EdokterApa {
  exists: boolean; tanggal?: string | null; kd_dokter?: string; nm_dokter?: string;
  data?: Record<string, string>;
}
export const edokterAsesmenPraAnestesiGet = (no_rawat: string, kd_dokter?: string) =>
  api.get<EdokterApa>(`/edokter/asesmen-pra-anestesi?no_rawat=${encodeURIComponent(no_rawat)}${kdq(kd_dokter)}`);
export const edokterAsesmenPraAnestesiSave = (b: { no_rawat: string; kd_dokter?: string; data: Record<string, string> }) =>
  api.post<{ ok: boolean }>("/edokter/asesmen-pra-anestesi", b);
export const edokterAsesmenPraAnestesiHapus = (b: { no_rawat: string }) =>
  api.post<{ ok: boolean }>("/edokter/asesmen-pra-anestesi/hapus", b);

// Asesmen Pra Induksi (RM.IBS.11.012.2026) — terpisah dari pra-anestesi.
// GET mengembalikan dokter bedah, nip penginput, & dapat_edit (owner-only).
export interface EdokterPraInduksi {
  exists: boolean; tanggal?: string | null; kd_dokter?: string; nm_dokter?: string;
  kd_dokter_bedah?: string; nm_dokter_bedah?: string; nip?: string; dapat_edit?: boolean;
  data?: Record<string, string>;
}
export const edokterAsesmenPraInduksiGet = (no_rawat: string, kd_dokter?: string) =>
  api.get<EdokterPraInduksi>(`/edokter/asesmen-pra-induksi?no_rawat=${encodeURIComponent(no_rawat)}${kdq(kd_dokter)}`);
export const edokterAsesmenPraInduksiSave = (b: { no_rawat: string; kd_dokter?: string; kd_dokter_bedah?: string; tanggal?: string; data: Record<string, string> }) =>
  api.post<{ ok: boolean }>("/edokter/asesmen-pra-induksi", b);
export const edokterAsesmenPraInduksiHapus = (b: { no_rawat: string }) =>
  api.post<{ ok: boolean }>("/edokter/asesmen-pra-induksi/hapus", b);

// Asesmen Pra Bedah — tabel asesmen_pra_bedah_rscb. Bisa diisi/diedit di E-Dokter & E-Nakes.
export interface EdokterPraBedah {
  exists: boolean; tanggal?: string | null; kd_dokter?: string; nm_dokter?: string;
  nip?: string; data?: Record<string, string>;
}
export const edokterAsesmenPraBedahGet = (no_rawat: string, kd_dokter?: string) =>
  api.get<EdokterPraBedah>(`/edokter/asesmen-pra-bedah?no_rawat=${encodeURIComponent(no_rawat)}${kdq(kd_dokter)}`);
export const edokterAsesmenPraBedahSave = (b: { no_rawat: string; kd_dokter?: string; data: Record<string, string> }) =>
  api.post<{ ok: boolean }>("/edokter/asesmen-pra-bedah", b);
export const edokterAsesmenPraBedahHapus = (b: { no_rawat: string }) =>
  api.post<{ ok: boolean }>("/edokter/asesmen-pra-bedah/hapus", b);

export interface EdokterObat { kode_brng: string; nama_brng?: string; kode_sat?: string; }
export const edokterCariObat = (cari: string) =>
  api.get<EdokterObat[]>(`/edokter/obat?cari=${encodeURIComponent(cari)}`);

export interface EdokterResepItem { kode_brng: string; jml: string; aturan_pakai?: string; }
export const edokterSimpanResep = (b: { no_rawat: string; jenis: string; obat: EdokterResepItem[] }) =>
  api.post<{ ok: boolean; no_resep: string }>("/edokter/resep", b);
export const edokterCopyResep = (b: { no_rawat: string; no_resep: string; jenis: string }) =>
  api.post<{ ok: boolean; no_resep: string }>("/edokter/resep/copy", b);

// ── Pengkajian Medis Ranap & Resume Medis Ranap (dokter) ─────────────────────
export interface EdokterPengkajianMedis { tanggal: string | null; ringkas: string; dokter: string; milik?: number }
const smb = (sumber?: string) => (sumber ? `&sumber=${encodeURIComponent(sumber)}` : "");
export const edokterPengkajianMedisList = (no_rawat: string, sumber?: string) =>
  api.get<EdokterPengkajianMedis[]>(`/edokter/pengkajian-medis?no_rawat=${encodeURIComponent(no_rawat)}${smb(sumber)}`);
export const edokterPengkajianMedisDetail = (no_rawat: string, tanggal: string, sumber?: string) =>
  api.get<Record<string, string>>(`/edokter/pengkajian-medis/detail?no_rawat=${encodeURIComponent(no_rawat)}&tanggal=${encodeURIComponent(tanggal)}${smb(sumber)}`);
export const edokterPengkajianMedisSave = (b: { no_rawat: string; tanggal: string; values: Record<string, string>; sumber?: string }) =>
  api.post<{ ok: boolean; tanggal: string }>("/edokter/pengkajian-medis", b);
export const edokterPengkajianMedisHapus = (b: { no_rawat: string; tanggal: string; sumber?: string }) =>
  api.post<{ ok: boolean }>("/edokter/pengkajian-medis/hapus", b);
export const edokterResumeMedisGet = (no_rawat: string) =>
  api.get<{ ada: boolean; values: Record<string, string> }>(`/edokter/resume-medis?no_rawat=${encodeURIComponent(no_rawat)}`);
export const edokterResumeMedisSave = (b: { no_rawat: string; values: Record<string, string> }) =>
  api.post<{ ok: boolean }>("/edokter/resume-medis", b);

// ── BIMASAKTI — BMS (Body, Mind & Soul) Index ───────────────────────────────
export interface BmsConfig {
  w_body: number; w_mind: number; w_soul: number; bmi_ideal: number; bmi_k: number;
  ai_provider?: string; ai_model?: string; ai_base_url?: string; ai_enabled?: boolean;
}
export interface BmsConfigPut {
  w_body?: number; w_mind?: number; w_soul?: number; bmi_ideal?: number; bmi_k?: number;
  ai_provider?: string; ai_model?: string; ai_base_url?: string; ai_api_key?: string;
}
export interface BmsIntervensi {
  id?: number; kd_periode: number; scope: string; ref_id?: string; nama_ref?: string;
  temuan?: string; pdca_plan?: string; pdca_do?: string; pdca_check?: string; pdca_act?: string;
  status?: string; rekomendasi_ai?: string; tgl?: string;
}
export interface BmsPeriode { kd_periode: number; nama: string; tgl_mulai?: string; tgl_selesai?: string; status: string; }
export interface BmsInputRow { nik: string; nama: string; departemen?: string; nm_dep?: string; bmi?: number; body_index?: number; e_kinerja?: number; }
export interface BmsInputResp { soul_zi?: number; soul_catatan?: string; rows: BmsInputRow[]; }
export interface BmsIndexRow { scope: string; ref_id: string; nama?: string; skor_body?: number; skor_mind?: number; skor_soul?: number; bms_index?: number; kategori?: string; }
export interface BmsTrenRow { nama: string; bms_index?: number; }
export interface BmsDashboard { org?: BmsIndexRow; units: BmsIndexRow[]; tren: BmsTrenRow[]; jml_input_body: number; jml_input_mind: number; jml_pegawai_aktif: number; }

export const bmsGetConfig = () => api.get<BmsConfig>("/bms/config");
export const bmsPutConfig = (b: BmsConfigPut) => api.put<{ ok: boolean }>("/bms/config", b);
export const bmsListIntervensi = (kd_periode: number) => api.get<BmsIntervensi[]>(`/bms/intervensi?kd_periode=${kd_periode}`);
export const bmsSaveIntervensi = (b: BmsIntervensi) => api.post<{ ok: boolean }>("/bms/intervensi", b);
export const bmsHapusIntervensi = (id: number) => api.delete<{ ok: boolean }>("/bms/intervensi", { data: { id } });
export const bmsRekomendasiAi = (b: { kd_periode: number; scope: string; ref_id?: string }) =>
  api.post<{ rekomendasi: string; provider: string; model: string }>("/bms/rekomendasi-ai", b);
export const bmsListPeriode = () => api.get<BmsPeriode[]>("/bms/periode");
export const bmsCreatePeriode = (b: { nama: string; tgl_mulai: string; tgl_selesai: string }) => api.post<{ ok: boolean }>("/bms/periode", b);
export const bmsHapusPeriode = (kd_periode: number) => api.delete<{ ok: boolean }>("/bms/periode", { data: { kd_periode } });
export const bmsInput = (kd_periode: number, cari?: string) =>
  api.get<BmsInputResp>(`/bms/input?kd_periode=${kd_periode}${cari ? `&cari=${encodeURIComponent(cari)}` : ""}`);
export const bmsUpsertBody = (b: { kd_periode: number; nik: string; bmi: number; tgl_ukur?: string }) => api.post<{ ok: boolean; body_index: number }>("/bms/body", b);
export const bmsUpsertMind = (b: { kd_periode: number; nik: string; e_kinerja: number }) => api.post<{ ok: boolean }>("/bms/mind", b);
export const bmsUpsertSoul = (b: { kd_periode: number; zi_index: number; catatan?: string }) => api.post<{ ok: boolean }>("/bms/soul", b);
export const bmsHitung = (kd_periode: number) => api.post<{ ok: boolean }>("/bms/hitung", { kd_periode });
export const bmsDashboard = (kd_periode: number) => api.get<BmsDashboard>(`/bms/dashboard?kd_periode=${kd_periode}`);
export const bmsDashboardUnit = (kd_periode: number, dep: string) => api.get<BmsIndexRow[]>(`/bms/dashboard/unit?kd_periode=${kd_periode}&dep=${encodeURIComponent(dep)}`);

// ── edokter tahap 3: Laboratorium & Radiologi ───────────────────────────────
export interface EdokterJenisPrw { kd_jenis_prw: string; nm_perawatan?: string; }
export interface EdokterPermintaan {
  noorder: string; tgl_permintaan?: string; jam_permintaan?: string; status?: string;
  dokter_perujuk?: string; diagnosa_klinis?: string; pemeriksaan?: string;
}
export interface EdokterHasilLab {
  tgl_periksa?: string; jam?: string; nm_perawatan?: string; pemeriksaan?: string;
  nilai?: string; satuan?: string; nilai_rujukan?: string; keterangan?: string;
}
export interface EdokterHasilRad { tgl_periksa?: string; jam?: string; hasil?: string; jml_gambar: number; }

type BuatPermintaanBody = { no_rawat: string; jenis: string; tests: string[]; diagnosa_klinis?: string; informasi_tambahan?: string; prioritas?: string };

// PP 3 — Waktu tunggu hasil lab (reguler vs cito)
export interface WtLabCell { total: number; avg_menit: number; ontarget: number; pct: number }
export interface WtLab {
  tahun: number; target: { cito: number; rutin: number };
  ringkasan: { rutin: { total: number; ontarget: number; pct: number }; cito: { total: number; ontarget: number; pct: number } };
  bulan_rutin: WtLabCell[]; bulan_cito: WtLabCell[];
}
export const getWaktuTungguLab = (tahun?: number) =>
  api.get<WtLab>(`/waktu-tunggu-lab${tahun ? `?tahun=${tahun}` : ""}`);

export const edokterLabJenis = (cari: string) => api.get<EdokterJenisPrw[]>(`/edokter/lab/jenis?cari=${encodeURIComponent(cari)}`);
export const edokterLabPermintaan = (no_rawat: string) => api.get<EdokterPermintaan[]>(`/edokter/lab/permintaan?no_rawat=${encodeURIComponent(no_rawat)}`);
export const edokterBuatLab = (b: BuatPermintaanBody) => api.post<{ ok: boolean; noorder: string }>("/edokter/lab/permintaan", b);
export const edokterLabHasil = (no_rawat: string) => api.get<EdokterHasilLab[]>(`/edokter/lab/hasil?no_rawat=${encodeURIComponent(no_rawat)}`);

export const edokterRadJenis = (cari: string) => api.get<EdokterJenisPrw[]>(`/edokter/rad/jenis?cari=${encodeURIComponent(cari)}`);
export const edokterRadPermintaan = (no_rawat: string) => api.get<EdokterPermintaan[]>(`/edokter/rad/permintaan?no_rawat=${encodeURIComponent(no_rawat)}`);
export const edokterBuatRad = (b: BuatPermintaanBody) => api.post<{ ok: boolean; noorder: string }>("/edokter/rad/permintaan", b);
export const edokterRadHasil = (no_rawat: string) => api.get<EdokterHasilRad[]>(`/edokter/rad/hasil?no_rawat=${encodeURIComponent(no_rawat)}`);

export interface EdokterGambar { tgl_periksa?: string; jam?: string; lokasi_gambar?: string; }
export const edokterRadGambar = (no_rawat: string) => api.get<EdokterGambar[]>(`/edokter/rad/gambar?no_rawat=${encodeURIComponent(no_rawat)}`);
// Ambil file gambar ter-auth sebagai object URL (img <src> tak membawa token)
export const edokterRadGambarUrl = async (f: string): Promise<string> => {
  const r = await api.get(`/edokter/rad/gambar-file?f=${encodeURIComponent(f)}`, { responseType: "blob" });
  return URL.createObjectURL(r.data as Blob);
};

// ── SIDOMU (Sistem Dokumen Mutu / SOP — Komite Mutu) ─────────────────────────
export interface SidomuSop {
  id: number; nama: string; kategori: string; jenis: string;
  drive_id: string; link: string; keterangan: string; urutan: number; bab: string; eps: string;
}
export interface SidomuMeta { folder_id: string; total: number; kategori: { k: string; v: number }[] }
export const getSidomu = (p: { q?: string; kategori?: string } = {}) => {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.kategori) sp.set("kategori", p.kategori);
  return api.get<SidomuSop[]>(`/sidomu?${sp}`);
};
export const getSidomuMeta = () => api.get<SidomuMeta>("/sidomu/meta");
export const saveSidomu = (b: Partial<SidomuSop>) => api.post<{ ok: boolean }>("/sidomu", b);
export const delSidomu = (id: number) => api.delete<{ ok: boolean }>(`/sidomu/${id}`);
export const getSidomuByEp = (kd_ep: string) => api.get<SidomuSop[]>(`/sidomu/ep/${encodeURIComponent(kd_ep)}`);
export const linkSidomuEp = (sop_id: number, kd_ep: string) => api.post<{ ok: boolean }>("/sidomu/link", { sop_id, kd_ep });
export const unlinkSidomuEp = (sop_id: number, kd_ep: string) => api.post<{ ok: boolean }>("/sidomu/unlink", { sop_id, kd_ep });
export const uploadSidomuFile = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post<{ ok: boolean; stored: string; jenis: string; nama: string; link: string }>(
    "/sidomu/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
};

// ── Lapor IT / Helpdesk ──────────────────────────────────────────────────────
export interface LaporIt {
  id: number; no_tiket?: string; tanggal_lapor: string; unit?: string; pelapor?: string;
  kontak?: string; kategori: string; prioritas: string; judul: string; deskripsi?: string;
  foto?: string; foto_tindakan?: string; status: string; pic_nip?: string; pic_nama?: string; tindakan?: string;
  tanggal_selesai?: string; tanggal_tanggap?: string; menit_tanggap?: number; sumber: string; created_at?: string;
}
export interface LaporItFilter {
  tahun?: number; status?: string; kategori?: string; prioritas?: string; unit?: string; q?: string;
}
export const getLaporIt = (f: LaporItFilter = {}) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== null) p.append(k, String(v)); });
  return api.get<LaporIt[]>(`/lapor-it?${p.toString()}`);
};
export const getLaporItOne = (id: number) => api.get<LaporIt>(`/lapor-it/${id}`);
export const createLaporIt = (b: Partial<LaporIt>) => api.post<{ ok: boolean; id: number }>("/lapor-it", b);
export const updateLaporIt = (id: number, b: Partial<LaporIt>) => api.put<{ ok: boolean }>(`/lapor-it/${id}`, b);
export const deleteLaporIt = (id: number) => api.delete<{ ok: boolean }>(`/lapor-it/${id}`);
export interface LaporItRekap {
  tahun: number;
  ringkasan: { total: number; baru: number; diproses: number; selesai: number; ditolak: number; avg_jam_penyelesaian: number; avg_menit_tanggap: number; sla_menit: number; sla_persen: number; n_tanggap: number };
  per_kategori: { k: string; total: number }[];
  per_unit: { k: string; total: number }[];
}
export const getLaporItRekap = (tahun?: number) => api.get<LaporItRekap>(`/lapor-it/rekap${tahun ? `?tahun=${tahun}` : ""}`);
export interface WaParsed { tanggal: string; pelapor: string; kategori: string; judul: string; deskripsi: string; ada_media: boolean }
export const importWaLaporIt = (text: string, apply: boolean, default_status?: string, default_unit?: string) =>
  api.post<{ ok: boolean; apply: boolean; terdeteksi: number; baru?: number; dilewati_duplikat?: number; contoh?: WaParsed[]; catatan?: string }>(
    "/lapor-it/import-wa", { text, apply, default_status, default_unit });

// Sinkron realtime WA (go-whatsapp-web-multidevice webhook)
export interface WaConfig { group: string; has_secret: boolean; status_default: string; webhook_path: string }
export const getWaConfig = () => api.get<WaConfig>("/lapor-it/wa-config");
export const setWaConfig = (b: { group?: string; secret?: string; status_default?: string }) =>
  api.post<{ ok: boolean }>("/lapor-it/wa-config", b);

export const uploadLaporFoto = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post<{ ok: boolean; url: string }>("/lapor-it/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
};
export const LAPOR_IT_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api").replace(/\/api\/?$/, "");

// ── Permintaan Fitur SIMRS (usulan pengembangan + voting) ────────────────────
export interface PermintaanFitur {
  id: number; no_tiket?: string; tanggal: string; modul: string; judul: string;
  deskripsi?: string; manfaat?: string; prioritas: string; pengusul?: string; unit?: string;
  kontak?: string; foto?: string; status: string; tanggapan?: string; pic_nama?: string;
  target?: string; tanggal_selesai?: string; vote_count: number; sudah_vote: number; created_at?: string;
}
export interface FiturFilter { tahun?: number; status?: string; modul?: string; prioritas?: string; q?: string; sort?: string }
export const getFitur = (f: FiturFilter = {}) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== null) p.append(k, String(v)); });
  return api.get<PermintaanFitur[]>(`/permintaan-fitur?${p.toString()}`);
};
export const createFitur = (b: Partial<PermintaanFitur>) => api.post<{ ok: boolean; id: number }>("/permintaan-fitur", b);
export const updateFitur = (id: number, b: Partial<PermintaanFitur>) => api.put<{ ok: boolean }>(`/permintaan-fitur/${id}`, b);
export const deleteFitur = (id: number) => api.delete<{ ok: boolean }>(`/permintaan-fitur/${id}`);
export const voteFitur = (id: number) => api.post<{ ok: boolean; voted: boolean; vote_count: number }>(`/permintaan-fitur/${id}/vote`);
export interface FiturRekap {
  tahun: number;
  ringkasan: { total: number; baru: number; ditinjau: number; disetujui: number; dikerjakan: number; selesai: number; ditolak: number };
  per_modul: { k: string; total: number }[];
}
export const getFiturRekap = (tahun?: number) => api.get<FiturRekap>(`/permintaan-fitur/rekap${tahun ? `?tahun=${tahun}` : ""}`);

// Import WA untuk Permintaan Fitur
export const importWaFitur = (text: string, apply: boolean, modul?: string) =>
  api.post<{ ok: boolean; apply: boolean; terdeteksi: number; baru?: number; dilewati_duplikat?: number; contoh?: WaParsed[] }>(
    "/permintaan-fitur/import-wa", { text, apply, modul });

// ── Kinerja IT ───────────────────────────────────────────────────────────────
export interface KinerjaAktivitas {
  id: number; tanggal: string; petugas?: string; kategori: string; judul: string;
  deskripsi?: string; durasi_menit?: number; foto?: string; sumber: string; created_at?: string;
}
export interface KinerjaFilter { tahun?: number; bulan?: number; kategori?: string; petugas?: string; q?: string }
export const getKinerjaList = (f: KinerjaFilter = {}) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== null) p.append(k, String(v)); });
  return api.get<KinerjaAktivitas[]>(`/kinerja-it?${p.toString()}`);
};
export const createKinerja = (b: Partial<KinerjaAktivitas>) => api.post<{ ok: boolean; id: number }>("/kinerja-it", b);
export const updateKinerja = (id: number, b: Partial<KinerjaAktivitas>) => api.put<{ ok: boolean }>(`/kinerja-it/${id}`, b);
export const deleteKinerja = (id: number) => api.delete<{ ok: boolean }>(`/kinerja-it/${id}`);
export const importWaKinerja = (text: string, apply: boolean, kategori?: string) =>
  api.post<{ ok: boolean; apply: boolean; terdeteksi: number; baru?: number; dilewati_duplikat?: number; contoh?: WaParsed[] }>(
    "/kinerja-it/import-wa", { text, apply, kategori });
export interface KinerjaDashboard {
  tahun: number;
  sla_jam: number;
  tiket: { total: number; selesai: number; diproses: number; baru: number; avg_jam: number;
    sla_persen: number; sla_tepat: number; sla_total: number };
  tiket_per_pic: { pic?: string; ditangani: number; selesai: number; avg_jam?: number; avg_menit_tanggap?: number }[];
  tiket_per_bulan: { bulan: number; masuk: number; selesai: number }[];
  aktivitas: { total: number; total_menit: number };
  aktivitas_per_petugas: { petugas?: string; jumlah: number; menit?: number }[];
  aktivitas_per_kategori: { k: string; total: number }[];
  aktivitas_per_bulan: { bulan: number; jumlah: number; menit: number }[];
  fitur: { total: number; selesai: number; dikerjakan: number };
}
export const getKinerjaDashboard = (tahun?: number, slaJam?: number) => {
  const p = new URLSearchParams();
  if (tahun) p.append("tahun", String(tahun));
  if (slaJam) p.append("sla_jam", String(slaJam));
  return api.get<KinerjaDashboard>(`/kinerja-it/dashboard?${p.toString()}`);
};
// Pencarian pegawai untuk isian "petugas". Sengaja tidak memakai
// /kepegawaian/pegawai (query-nya menanyakan kolom yang tidak ada di tabel
// `petugas` pada skema ini).
export interface PegawaiRingkas { nik: string; nama: string }
export const cariPegawaiKinerja = (q: string) =>
  api.get<PegawaiRingkas[]>(`/kinerja-it/pegawai?q=${encodeURIComponent(q)}`);

// ── Laporan periode (weekly report) ──────────────────────────────────────────
// Catatan data: `tanggal_selesai` kosong pada seluruh tiket hasil impor WA,
// sehingga sla_total bisa 0 walau ada tiket berstatus selesai. UI harus
// membedakan "belum tersedia" (sla_total === 0) dari "benar-benar 0%".
export interface KinerjaLaporan {
  periode: { dari: string; sampai: string; hari: number };
  pembanding: { dari: string; sampai: string };
  tiket: {
    masuk: number; selesai: number; baru: number; diproses: number;
    dituntaskan_periode_ini: number;
    avg_jam: number; avg_menit_tanggap: number;
    sla_jam: number; sla_persen: number; sla_tepat: number; sla_total: number;
    masuk_sebelumnya: number; selesai_sebelumnya: number;
  };
  tiket_per_kategori:  { k?: string; total: number }[];
  tiket_per_unit:      { k?: string; total: number }[];
  tiket_per_prioritas: { k?: string; total: number }[];
  tiket_per_pic:       { pic?: string; ditangani: number; selesai: number; avg_jam?: number }[];
  tiket_per_hari:      { tanggal: string; masuk: number; selesai: number }[];
  tiket_selesai_list:  { no_tiket?: string; judul: string; unit?: string; pic_nama?: string;
                         prioritas?: string; tanggal_selesai?: string; jam?: number }[];
  aktivitas: { total: number; total_menit: number; total_sebelumnya: number; menit_sebelumnya: number };
  aktivitas_per_kategori: { k: string; total: number; menit: number }[];
  aktivitas_per_petugas:  { petugas?: string; jumlah: number; menit: number }[];
  aktivitas_per_hari:     { tanggal: string; jumlah: number; menit: number }[];
  aktivitas_list: KinerjaAktivitas[];
  fitur: { masuk: number; selesai: number; dikerjakan: number };
}
export const getKinerjaLaporan = (dari: string, sampai: string, slaJam?: number) => {
  const p = new URLSearchParams({ dari, sampai });
  if (slaJam) p.append("sla_jam", String(slaJam));
  return api.get<KinerjaLaporan>(`/kinerja-it/laporan?${p.toString()}`);
};

// URL ekspor CSV (dibuka via anchor href, bawa filter yang sama dengan list).
export const kinerjaExportCsvUrl = (f: KinerjaFilter = {}) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== null) p.append(k, String(v)); });
  return `/api/kinerja-it/export.csv?${p.toString()}`;
};

// ── Self Security Assessment (kredensialing BPJS) ─────────────────────────────
export interface SsaRow {
  id: number; tahun: number; periode?: string; tanggal: string; metode: string;
  penanggung_jawab?: string; tingkat: string; skor_total?: number; dibuat_oleh?: string;
}
export interface SsaItem {
  id: number; urut: number; area: string; kode: string; kontrol: string; status: string; bukti?: string;
}
export interface SsaDetail {
  id: number; tahun: number; periode?: string; tanggal: string; metode: string;
  pihak_ketiga?: string; penanggung_jawab?: string; kesimpulan?: string; tingkat: string; skor_total?: number;
  items: SsaItem[];
}
export const getSsaList = (tahun?: number) => api.get<SsaRow[]>(`/ssa${tahun ? `?tahun=${tahun}` : ""}`);
export const getSsaDetail = (id: number) => api.get<SsaDetail>(`/ssa/${id}`);
export const createSsa = (b: { tahun: number; tanggal: string; periode?: string; metode?: string; penanggung_jawab?: string }) =>
  api.post<{ ok: boolean; id: number }>("/ssa", b);
export const updateSsa = (id: number, b: Partial<{ periode: string; tanggal: string; metode: string; pihak_ketiga: string; penanggung_jawab: string; kesimpulan: string }>) =>
  api.put<{ ok: boolean }>(`/ssa/${id}`, b);
export const deleteSsa = (id: number) => api.delete<{ ok: boolean }>(`/ssa/${id}`);
export const updateSsaItem = (id: number, itemId: number, b: { status: string; bukti?: string }) =>
  api.put<{ ok: boolean; skor_total: number }>(`/ssa/${id}/item/${itemId}`, b);

// ── Generator Dokumen Mutu (SK & SPO) ────────────────────────────────────────
export interface DokGen {
  id: number; jenis: string; nomor?: string; judul: string; tanggal?: string; no_revisi?: string;
  unit?: string; pejabat_nama?: string; pejabat_nip?: string; pejabat_jabatan?: string;
  ttd_img?: string; kd_ep?: string; status: string; data?: Record<string, unknown>;
  updated_at?: string; updated_by?: string;
}
export interface DokFilter { jenis?: string; q?: string; tahun?: number; kd_ep?: string }
export const getDokList = (f: DokFilter = {}) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== null) p.append(k, String(v)); });
  return api.get<DokGen[]>(`/dokumen-gen?${p.toString()}`);
};
export const getDok = (id: number) => api.get<DokGen>(`/dokumen-gen/${id}`);
export const createDok = (b: Partial<DokGen>) => api.post<{ ok: boolean; id: number }>("/dokumen-gen", b);
export const updateDok = (id: number, b: Partial<DokGen>) => api.put<{ ok: boolean }>(`/dokumen-gen/${id}`, b);
export const deleteDok = (id: number) => api.delete<{ ok: boolean }>(`/dokumen-gen/${id}`);
export const nextNomorDok = (jenis: string, extra: Record<string, string> = {}) => {
  const p = new URLSearchParams({ jenis, ...extra });
  return api.get<{ nomor: string }>(`/dokumen-gen/next-nomor?${p.toString()}`);
};
export const previewDok = (id: number) => api.get<string>(`/dokumen-gen/${id}/preview`, { responseType: "text" });
export const exportDok = (id: number, format: "docx" | "pdf") => api.get<Blob>(`/dokumen-gen/${id}/export?format=${format}`, { responseType: "blob" });

export const getOoConfig = (id: number) => api.get<Record<string, unknown>>(`/dokumen-gen/${id}/oo-config`);

// ── Indikator Mutu (INM + IMP) ───────────────────────────────────────────────
export interface MutuIndikator {
  id: number; kode?: string; judul: string; jenis: string; unit?: string; definisi?: string;
  numerator_def?: string; denominator_def?: string; satuan: string; target?: number; standar?: string;
  formula?: string; frekuensi?: string; dimensi?: string; status: string;
}
export const getIndikator = (f: { jenis?: string; unit?: string; q?: string; status?: string } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v) p.append(k, String(v)); });
  return api.get<MutuIndikator[]>(`/mutu/indikator?${p}`);
};
export const createIndikator = (b: Partial<MutuIndikator>) => api.post<{ ok: boolean; id: number }>("/mutu/indikator", b);
export const updateIndikator = (id: number, b: Partial<MutuIndikator>) => api.put<{ ok: boolean }>(`/mutu/indikator/${id}`, b);
export const deleteIndikator = (id: number) => api.delete(`/mutu/indikator/${id}`);
// Lapor ke portal regmutufasyankes — bahan tempel + jejak sudah/belum terkirim.
export interface MutuLaporRow {
  indikator_id: number; kode?: string; judul: string; satuan: string; target?: number; frekuensi?: string;
  numerator?: number; denominator?: number; capaian?: number; analisa?: string; rtl?: string;
  lapor_status?: string; lapor_waktu?: string; lapor_petugas?: string;
}
export const getMutuLapor = (tahun: number, bulan: number, jenis = "inm") =>
  api.get<MutuLaporRow[]>(`/mutu/lapor?tahun=${tahun}&bulan=${bulan}&jenis=${jenis}`);
export const tandaiMutuLapor = (b: { indikator_id: number; tahun: number; bulan: number; terkirim: boolean }) =>
  api.post<{ ok: boolean }>("/mutu/lapor/tandai", b);
export interface MutuCapaian { id: number; indikator_id: number; unit?: string; tahun: number; bulan: number; numerator?: number; denominator?: number; capaian?: number; analisa?: string; rtl?: string; pelapor?: string }
export const getCapaian = (indikator_id: number, tahun: number, unit?: string) => {
  const p = new URLSearchParams({ indikator_id: String(indikator_id), tahun: String(tahun) }); if (unit) p.append("unit", unit);
  return api.get<MutuCapaian[]>(`/mutu/capaian?${p}`);
};
export const upsertCapaian = (b: Partial<MutuCapaian>) => api.post<{ ok: boolean; capaian?: number }>("/mutu/capaian", b);
export interface MutuRekap {
  tahun: number;
  indikator: { id: number; kode?: string; judul: string; jenis: string; unit?: string; satuan: string; target?: number; rata?: number; terisi: number }[];
  bulanan: { indikator_id: number; bulan: number; capaian?: number }[];
}
export const getMutuRekap = (f: { tahun?: number; jenis?: string; unit?: string } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v) p.append(k, String(v)); });
  return api.get<MutuRekap>(`/mutu/rekap?${p}`);
};
// Auto-Capaian dari data Khanza
export interface MutuAutoDef {
  kode: string; judul: string; jenis: string; unit: string; satuan: string; target: number;
  definisi: string; numerator_def: string; denominator_def: string;
}
export interface MutuAutoHasil {
  kode: string; judul: string; indikator_id: number;
  numerator: number; denominator: number; capaian: number | null; satuan: string; target: number;
}
export const getMutuAutoDaftar = () => api.get<{ indikator: MutuAutoDef[] }>("/mutu/auto/daftar");
export const hitungMutuAuto = (b: { tahun: number; bulan: number; kode?: string }) =>
  api.post<{ ok: boolean; tahun: number; bulan: number; hasil: MutuAutoHasil[] }>("/mutu/auto/hitung", b);

// ── Ceklis observasi mutu (input berbasis sampel patuh/tidak) ────────────────
export interface MutuChecklistRow { id: number; indikator_id: number; unit: string; tanggal: string; patuh: number; sampel?: string; keterangan?: string; observer?: string }
export const getMutuChecklist = (indikator_id: number, tahun: number, bulan: number, unit?: string) => {
  const p = new URLSearchParams({ indikator_id: String(indikator_id), tahun: String(tahun), bulan: String(bulan) });
  if (unit) p.set("unit", unit);
  return api.get<MutuChecklistRow[]>(`/mutu/checklist?${p}`);
};
export const addMutuChecklist = (b: { indikator_id: number; unit?: string; tanggal: string; items: { patuh: number; sampel?: string; keterangan?: string }[] }) =>
  api.post<{ ok: boolean; inserted: number }>("/mutu/checklist", b);
export const deleteMutuChecklist = (id: number) => api.delete<{ ok: boolean }>(`/mutu/checklist/${id}`);
export const rekapMutuChecklist = (b: { indikator_id: number; tahun: number; bulan: number; unit?: string }) =>
  api.post<{ ok: boolean; numerator: number; denominator: number; capaian: number }>("/mutu/checklist/rekap", b);

// ── PPS ──────────────────────────────────────────────────────────────────────
export interface Pps {
  id: number; kd_ep?: string; bab?: string; standar?: string; rekomendasi?: string; langkah_pemenuhan?: string;
  metode?: string; indikator_pencapaian?: string; sasaran?: string; pic?: string; waktu_target?: string;
  keterangan?: string; status: string; progres: number; updated_at?: string;
}
export const getPps = (f: { bab?: string; status?: string; q?: string } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v) p.append(k, String(v)); });
  return api.get<Pps[]>(`/pps?${p}`);
};
export const createPps = (b: Partial<Pps>) => api.post<{ ok: boolean; id: number }>("/pps", b);
export const updatePps = (id: number, b: Partial<Pps>) => api.put<{ ok: boolean }>(`/pps/${id}`, b);
export const deletePps = (id: number) => api.delete(`/pps/${id}`);
export interface PpsRekap { total: number; tercapai: number; avg_progres: number; per_bab: { bab?: string; total: number; belum: number; proses: number; tercapai: number; avg_progres?: number }[] }
export const getPpsRekap = () => api.get<PpsRekap>("/pps/rekap");

// ── HSI ──────────────────────────────────────────────────────────────────────
export interface HsiItem { id: number; modul: number; sub_modul?: string; kode?: string; uraian: string; bobot: number; urutan: number }
export const getHsiItems = (modul?: number) => api.get<HsiItem[]>(`/hsi/item${modul ? `?modul=${modul}` : ""}`);
export const createHsiItem = (b: Partial<HsiItem>) => api.post<{ ok: boolean; id: number }>("/hsi/item", b);
export const updateHsiItem = (id: number, b: Partial<HsiItem>) => api.put(`/hsi/item/${id}`, b);
export const deleteHsiItem = (id: number) => api.delete(`/hsi/item/${id}`);
export interface HsiPenilaian { id: number; nama: string; tanggal?: string; penilai?: string; keterangan?: string; indeks?: number; klasifikasi?: string }
export const getHsiPenilaian = () => api.get<HsiPenilaian[]>("/hsi/penilaian");
export const createHsiPenilaian = (b: Partial<HsiPenilaian>) => api.post<{ ok: boolean; id: number }>("/hsi/penilaian", b);
export const deleteHsiPenilaian = (id: number) => api.delete(`/hsi/penilaian/${id}`);
export interface HsiDetail {
  penilaian: HsiPenilaian;
  items: { id: number; modul: number; sub_modul?: string; kode?: string; uraian: string; bobot: number; tingkat?: string; catatan?: string }[];
  per_modul: { modul: number; jml: number; terisi: number }[];
}
export const getHsiDetail = (id: number) => api.get<HsiDetail>(`/hsi/penilaian/${id}`);
export const upsertHsiNilai = (b: { penilaian_id: number; item_id: number; tingkat: string; catatan?: string }) => api.post("/hsi/nilai", b);

// ── Penilaian Mandiri Akreditasi (self-assessment) ───────────────────────────
export interface AkrEvent { id: number; nama: string; jenis: string; tanggal?: string; status: string; keterangan?: string }
export const getAkrEvents = () => api.get<AkrEvent[]>("/penilaian/event");
export const createAkrEvent = (b: Partial<AkrEvent>) => api.post<{ ok: boolean; id: number }>("/penilaian/event", b);
export const updateAkrEvent = (id: number, b: Partial<AkrEvent>) => api.put(`/penilaian/event/${id}`, b);
export const deleteAkrEvent = (id: number) => api.delete(`/penilaian/event/${id}`);
export interface AkrSkor {
  kd_ep: string; standar?: string; nama_standar?: string; deskripsi?: string;
  nilai?: number; tdd: number; fakta_analisa?: string; rekomendasi?: string; catatan?: string; jml_bukti: number;
}
export const getAkrSkor = (event_id: number, bab: string) =>
  api.get<AkrSkor[]>(`/penilaian/skor?event_id=${event_id}&bab=${encodeURIComponent(bab)}`);
export const upsertAkrSkor = (b: { event_id: number; kd_ep: string; nilai?: number; tdd?: number; fakta_analisa?: string; rekomendasi?: string; catatan?: string }) =>
  api.post("/penilaian/skor", b);
export interface AkrRekap {
  event_id: number; capaian_total: number;
  per_bab: { bab?: string; kelompok?: number; nama_bab?: string; total_ep: number; dinilai: number; tdd: number; capaian: number }[];
}
export const getAkrRekap = (event_id: number) => api.get<AkrRekap>(`/penilaian/rekap/${event_id}`);

// ── MedSync SIRS 6.3 Bot Engine ─────────────────────────────────────────────
export interface SirsBotStatus {
  status: boolean;
  message: string;
  data: {
    port: string;
    kode_rs: string;
    nama_rs: string;
    email?: string;
    has_token: boolean;
    token_preview: string;
    hospital_info?: any;
  };
}

export const getSirsBotStatus = () => api.get<SirsBotStatus>("/sirs/bot/status");
export const saveSirsBotConfig = (b: Record<string, any>) => api.post("/sirs/bot/config", b);
export const sirsBotLogin = (email?: string, password?: string) => api.post("/sirs/bot/login", { email, password });
export const sirsBotRefreshToken = () => api.post<{ status: boolean; message: string; access_token: string }>("/sirs/bot/refresh-token");
export const sirsBotSubmit = (form: string, payload: any) => api.post<{ status: boolean; message: string; data?: any }>(`/sirs/bot/submit/${form}`, payload);

// Skoring Indikator Mutu Prioritas (HR/HV/PP → Total = HR*50+HV*30+PP*20)
export interface MutuPrioritasSkor {
  id: number; periode: string; indikator: string;
  hr: number; hv: number; pp: number; keterangan: string; total: number;
}
export const mutuPrioritasList = (periode: string) =>
  api.get<{ periode: string; data: MutuPrioritasSkor[] }>(`/mutu-prioritas?periode=${encodeURIComponent(periode)}`);
export const mutuPrioritasPeriode = () => api.get<{ data: string[] }>(`/mutu-prioritas/periode`);
export const mutuPrioritasSave = (b: { id?: number; periode: string; indikator: string; hr: number; hv: number; pp: number; keterangan?: string }) =>
  api.post<{ ok: boolean; id: number }>(`/mutu-prioritas`, b);
export const mutuPrioritasHapus = (id: number) => api.delete(`/mutu-prioritas/${id}`);

// Laporan Jam Visit Dokter (rawat inap) — sumber pemeriksaan_ranap.jam_rawat (nip=dokter)
export interface JamVisitRow {
  no_rawat: string; tgl_perawatan: string; no_rkm_medis: string; nm_pasien: string;
  kd_dokter: string; nm_dokter: string; spesialisasi: string; kamar: string;
  visit_pertama: string; jml_visit: number; tepat: number;
}
export interface JamVisitResp {
  jam_target: string;
  ringkasan: { total: number; tepat: number; tidak_tepat: number; persen_tepat: number };
  data: JamVisitRow[];
}
export const jamVisitDokter = (p: { tgl_awal: string; tgl_akhir: string; kd_sps?: string; jam_target?: string }) => {
  const q = new URLSearchParams();
  q.set("tgl_awal", p.tgl_awal); q.set("tgl_akhir", p.tgl_akhir);
  if (p.kd_sps) q.set("kd_sps", p.kd_sps);
  if (p.jam_target) q.set("jam_target", p.jam_target);
  return api.get<JamVisitResp>(`/laporan/jam-visit-dokter?${q.toString()}`);
};
export const jamVisitSpesialis = () => api.get<{ data: { kd_sps: string; nm_sps: string }[] }>(`/laporan/jam-visit-dokter/spesialis`);

// Rekap Risiko Jatuh (dari isian awal keperawatan ranap — Morse/Sydney)
export interface RisikoJatuhRow {
  no_rawat: string; tanggal: string; no_rkm_medis: string; nm_pasien: string; kamar: string;
  morse: number; sydney: number; skala: string; skor: number; tingkat: string;
}
export interface RisikoJatuhResp {
  ringkasan: { total: number; rendah: number; sedang: number; tinggi: number };
  data: RisikoJatuhRow[];
}
export const rekapRisikoJatuh = (p: { tgl_awal: string; tgl_akhir: string }) =>
  api.get<RisikoJatuhResp>(`/laporan/risiko-jatuh?tgl_awal=${encodeURIComponent(p.tgl_awal)}&tgl_akhir=${encodeURIComponent(p.tgl_akhir)}`);

// Rekap Kepatuhan Clinical Pathway (item-based: done/total)
export interface CpRekapRow { id_template: number; nama_cp: string; kode_icd10: string; target_los_hari: number; kasus: number; item_done: number; item_total: number; persen: number; }
export interface CpDetailRow { no_rawat: string; tgl_mulai: string; nm_pasien: string; nama_cp: string; item_done: number; item_total: number; persen: number; }
export interface KepatuhanCpResp {
  ringkasan: { kasus: number; item_done: number; item_total: number; persen: number };
  per_cp: CpRekapRow[];
  detail: CpDetailRow[];
}
export const rekapKepatuhanCp = (p: { tgl_awal: string; tgl_akhir: string }) =>
  api.get<KepatuhanCpResp>(`/laporan/kepatuhan-cp?tgl_awal=${encodeURIComponent(p.tgl_awal)}&tgl_akhir=${encodeURIComponent(p.tgl_akhir)}`);

// ── Audit Edukasi Terintegrasi PPA (per pasien/NORM) ─────────────────────────
export interface AuditEdukasiRow {
  no_rawat: string; norm: string; nm_pasien: string; tgl: string;
  lembar_terisi: string; teach_back: string; ttd_lengkap: string;
  edukasi_transfer: string; edukasi_rujukan: string; catatan_auditor: string; jml_materi: number;
}
export interface AuditEdukasiResp {
  ringkasan: {
    pasien: number; lembar_ya: number; teach_ya: number; ttd_ya: number;
    transfer_ya: number; transfer_dari: number; rujukan_ya: number; rujukan_dari: number;
  };
  detail: AuditEdukasiRow[];
}
export const rekapAuditEdukasi = (p: { tgl_awal: string; tgl_akhir: string }) =>
  api.get<AuditEdukasiResp>(`/laporan/audit-edukasi?tgl_awal=${encodeURIComponent(p.tgl_awal)}&tgl_akhir=${encodeURIComponent(p.tgl_akhir)}`);
export const simpanCatatanAuditEdukasi = (b: { no_rawat: string; catatan: string }) =>
  api.post<{ ok: boolean }>("/laporan/audit-edukasi/catatan", b);

// ── Manajemen Risiko / FMEA ──────────────────────────────────────────────────
export interface RisikoRow {
  id: number; tahun: number | null; unit: string; kategori: string; proses: string;
  modus_kegagalan: string; penyebab: string; dampak: string;
  severity: number; occurrence: number; detectability: number; rpn: number; grading: string;
  severity_residu: number | null; occurrence_residu: number | null; detectability_residu: number | null;
  rpn_residu: number | null; grading_residu: string | null;
  pic: string; target_tanggal: string | null; status: string;
  tanggal_identifikasi: string | null; keterangan: string; jml_mitigasi: number;
}
export interface MitigasiRow {
  id: number; program: string; kegiatan: string; pic: string; target: string; status: string; progres: string; urut: number;
}
export interface ManajemenRisikoResp {
  ringkasan: { total: number; sangat_tinggi: number; tinggi: number; sedang: number; rendah: number };
  data: RisikoRow[];
}
export const listManajemenRisiko = (p: { tahun?: number | null; unit?: string; q?: string }) => {
  const s = new URLSearchParams();
  if (p.tahun) s.set("tahun", String(p.tahun));
  if (p.unit) s.set("unit", p.unit);
  if (p.q) s.set("q", p.q);
  return api.get<ManajemenRisikoResp>(`/manajemen-risiko?${s.toString()}`);
};
export const detailManajemenRisiko = (id: number) =>
  api.get<{ mitigasi: MitigasiRow[] }>(`/manajemen-risiko/${id}`);
export type RisikoInput = Partial<Omit<RisikoRow, "rpn" | "grading" | "rpn_residu" | "grading_residu" | "jml_mitigasi">> & { id?: number };
export const simpanManajemenRisiko = (b: RisikoInput) =>
  api.post<{ ok: boolean; id: number; rpn: number; rpn_residu: number | null }>("/manajemen-risiko", b);
export const hapusManajemenRisiko = (id: number) =>
  api.delete<{ ok: boolean }>(`/manajemen-risiko/${id}`);
export const simpanMitigasiRisiko = (b: Partial<MitigasiRow> & { id_risiko: number }) =>
  api.post<{ ok: boolean; id: number }>("/manajemen-risiko/mitigasi", b);
export const hapusMitigasiRisiko = (idm: number) =>
  api.delete<{ ok: boolean }>(`/manajemen-risiko/mitigasi/${idm}`);

// ── Master Data Barang + Darurat Stok ────────────────────────────────────────
export interface BarangRow {
  kode_brng: string; nama_brng: string; kode_satbesar: string; satbesar: string;
  kode_sat: string; satuan: string; letak_barang: string; stokminimal: number;
  kdjns: string; jenis: string; isi: number; kapasitas: number;
  kode_industri: string; industri: string; kode_kategori: string; kategori: string;
  kode_golongan: string; golongan: string; status: string; stok: number;
}
export interface BarangListResp { total: number; page: number; limit: number; data: BarangRow[]; }
export interface KodeNama { kode: string; nama: string; }
export interface BarangMasters { satuan: KodeNama[]; jenis: KodeNama[]; kategori: KodeNama[]; golongan: KodeNama[]; industri: KodeNama[]; }
export interface DaruratRow { kode_brng: string; nama_brng: string; satuan: string; jenis: string; minimal: number; stok: number; kurang: number; }
export interface Bangsal { kd_bangsal: string; nm_bangsal: string; }

export const listBarang = (p: { q?: string; jenis?: string; status?: string; page?: number; limit?: number }) => {
  const s = new URLSearchParams();
  if (p.q) s.set("q", p.q);
  if (p.jenis) s.set("jenis", p.jenis);
  if (p.status !== undefined) s.set("status", p.status);
  if (p.page) s.set("page", String(p.page));
  if (p.limit) s.set("limit", String(p.limit));
  return api.get<BarangListResp>(`/barang?${s.toString()}`);
};
export const getBarang = (kode: string) => api.get<BarangRow>(`/barang/${encodeURIComponent(kode)}`);
export const barangMasters = () => api.get<BarangMasters>("/barang/masters");
export type BarangInput = {
  kode_brng: string; is_new: boolean; nama_brng: string; kode_satbesar: string; kode_sat: string;
  letak_barang: string; stokminimal: number; kdjns: string; isi: number; kapasitas: number;
  kode_industri: string; kode_kategori: string; kode_golongan: string;
};
export const simpanBarang = (b: BarangInput) => api.post<{ ok: boolean; kode_brng: string }>("/barang", b);
export const hapusBarang = (kode: string) => api.delete<{ ok: boolean }>(`/barang/${encodeURIComponent(kode)}`);
export const daruratStok = (kd_bangsal?: string) =>
  api.get<{ total: number; data: DaruratRow[] }>(`/barang/darurat-stok${kd_bangsal ? `?kd_bangsal=${encodeURIComponent(kd_bangsal)}` : ""}`);
export const barangBangsal = () => api.get<{ data: Bangsal[] }>("/barang/bangsal");

// ── Daftar Singkatan & Simbol Rekam Medis ────────────────────────────────────
export interface SingkatanRow { kategori: string; singkatan: string; keterangan: string; misinterpretasi: string; wajib_gunakan: string; }
export const listSingkatan = (p: { q?: string; kategori?: string }) => {
  const s = new URLSearchParams();
  if (p.q) s.set("q", p.q);
  if (p.kategori) s.set("kategori", p.kategori);
  return api.get<{ total: number; data: SingkatanRow[] }>(`/singkatan?${s.toString()}`);
};

// ── Pengendalian Persediaan (7 program mitigasi FMEA) ────────────────────────
export interface EarlyWarnRow {
  kode_brng: string; nama_brng: string; satuan: string; jenis: string;
  stok: number; stok_minimal: number; stok_maksimal: number; lead_time: number; consumption_avg: number;
  reorder_point: number; buffer_stock: number; kritis: boolean; status: string; usul_pesan: number;
}
export const earlyWarning = (kd_bangsal?: string) =>
  api.get<{ ringkasan: { total: number; kritis: number; perlu_pesan: number }; data: EarlyWarnRow[] }>(
    `/persediaan/early-warning${kd_bangsal ? `?kd_bangsal=${encodeURIComponent(kd_bangsal)}` : ""}`);
export const setReorder = (b: { kode_brng: string; kd_bangsal: string; stok_minimal: number; stok_maksimal: number; lead_time: number; consumption_avg: number }) =>
  api.post<{ ok: boolean }>("/persediaan/reorder", b);
export const setKritis = (b: { kode_brng: string; buffer_stock?: number; alasan?: string; hapus?: boolean }) =>
  api.post<{ ok: boolean }>("/persediaan/kritis", b);

export interface ForecastRow {
  kode_brng: string; nama_brng: string; satuan: string; total_keluar: number;
  rata_per_bulan: number; stok: number; proyeksi_bulan_depan: number; usul_pesan: number;
}
export const forecasting = (p: { bulan?: number; q?: string }) => {
  const s = new URLSearchParams();
  if (p.bulan) s.set("bulan", String(p.bulan));
  if (p.q) s.set("q", p.q);
  return api.get<{ bulan: number; data: ForecastRow[] }>(`/persediaan/forecasting?${s.toString()}`);
};

export interface LeadRow {
  no_faktur: string; kode_suplier: string; nama_suplier: string;
  tgl_pesan: string; tgl_faktur: string; tgl_terima: string | null; lead: number; tagihan: number;
  terlambat: boolean; ada_terima: boolean;
}
export const leadTime = (p: { tgl_awal: string; tgl_akhir: string; target?: number }) => {
  const s = new URLSearchParams({ tgl_awal: p.tgl_awal, tgl_akhir: p.tgl_akhir });
  if (p.target) s.set("target", String(p.target));
  return api.get<{ target: number; ringkasan: { total_po: number; dgn_terima: number; avg_lead: number; terlambat: number }; data: LeadRow[] }>(`/persediaan/lead-time?${s.toString()}`);
};
export const setTerima = (b: { no_faktur: string; tgl_terima: string; keterangan?: string }) =>
  api.post<{ ok: boolean }>("/persediaan/lead-time/terima", b);

export interface SupplierRow {
  kode_suplier: string; nama_suplier: string; kota: string;
  jml_po: number; total_nilai: number; dgn_terima: number; avg_lead: number | null; terlambat: number; ketepatan_persen: number | null;
}
export const supplierEval = (p: { tgl_awal: string; tgl_akhir: string; target?: number }) => {
  const s = new URLSearchParams({ tgl_awal: p.tgl_awal, tgl_akhir: p.tgl_akhir });
  if (p.target) s.set("target", String(p.target));
  return api.get<{ target: number; data: SupplierRow[] }>(`/persediaan/supplier-eval?${s.toString()}`);
};

export interface OpnameHdr { id: number; kd_bangsal: string; nm_bangsal: string; tanggal: string; keterangan: string; status: string; jml_item: number; jml_selisih: number; }
export interface OpnameDet { id: number; kode_brng: string; nama_brng: string; satuan: string; stok_sistem: number; stok_fisik: number; selisih: number; keterangan: string; }
export const opnameList = () => api.get<{ data: OpnameHdr[] }>("/persediaan/opname");
export const opnameCreate = (b: { kd_bangsal: string; tanggal?: string; keterangan?: string }) =>
  api.post<{ ok: boolean; id: number }>("/persediaan/opname", b);
export const opnameDetail = (id: number) =>
  api.get<{ id: number; kd_bangsal: string; nm_bangsal: string; status: string; tanggal: string; data: OpnameDet[] }>(`/persediaan/opname/${id}`);
export const opnameSaveItem = (id: number, b: { id_detail: number; stok_fisik: number; keterangan?: string }) =>
  api.post<{ ok: boolean }>(`/persediaan/opname/${id}/item`, b);
export const opnameFinalize = (id: number) => api.post<{ ok: boolean }>(`/persediaan/opname/${id}/finalize`, {});
export const opnameHapus = (id: number) => api.delete<{ ok: boolean }>(`/persediaan/opname/${id}`);

// ── Evaluasi Pendaftaran (AKP 2b) ──────────────────────────────────────────
export interface EvalPendaftaranTrend { tgl: string; total: number; online: number; offline: number; }
export interface EvalPendaftaranRekap {
  dari: string; sampai: string;
  total: number; online: number; offline: number;
  ralan: number; ranap: number; online_pct: number;
  waktu_tunggu_avg: number | null; wt_le60_pct: number | null; wt_n: number;
  trend: EvalPendaftaranTrend[];
}
export const getEvalPendaftaranRekap = (f: { dari?: string; sampai?: string } = {}) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v) p.append(k, String(v)); });
  return api.get<EvalPendaftaranRekap>(`/evaluasi-pendaftaran/rekap?${p}`);
};
export interface EvalPendaftaranCatatan {
  periode: string; ada: boolean;
  analisa?: string; kendala?: string; tindak_lanjut?: string; pelapor?: string; updated_at?: string;
}
export const getEvalPendaftaranCatatan = (periode: string) =>
  api.get<EvalPendaftaranCatatan>(`/evaluasi-pendaftaran/catatan/${periode}`);
export const saveEvalPendaftaranCatatan = (b: {
  periode: string; jml_online: number; jml_offline: number; waktu_tunggu: number | null;
  analisa?: string; kendala?: string; tindak_lanjut?: string;
}) => api.post<{ ok: boolean }>("/evaluasi-pendaftaran/catatan", b);

// Laporan Kendala Pendaftaran (rekap bulan & triwulan)
export interface KendalaRow {
  id: number; tanggal: string; kategori: string; deskripsi: string | null;
  jumlah_kasus: number; dampak: string | null; tindak_lanjut: string | null; nama_petugas: string | null;
}
export interface KendalaRekapKat {
  kategori: string; bulan: number[]; triwulan: number[]; total: number;
}
export interface KendalaRekap {
  tahun: number; per_kategori: KendalaRekapKat[];
  total_bulan: number[]; total_triwulan: number[]; grand_total: number;
}
export const getKendalaKategori = () =>
  api.get<{ kategori: string[] }>("/kendala-pendaftaran/kategori");
export const getKendalaList = (tahun?: number, bulan?: number) => {
  const p = new URLSearchParams();
  if (tahun) p.append("tahun", String(tahun));
  if (bulan) p.append("bulan", String(bulan));
  return api.get<{ kendala: KendalaRow[] }>(`/kendala-pendaftaran?${p}`);
};
export const addKendala = (b: {
  tanggal: string; kategori: string; deskripsi?: string;
  jumlah_kasus?: number; dampak?: string; tindak_lanjut?: string;
}) => api.post<{ ok: boolean }>("/kendala-pendaftaran", b);
export const editKendala = (id: number, b: {
  tanggal: string; kategori: string; deskripsi?: string;
  jumlah_kasus?: number; dampak?: string; tindak_lanjut?: string;
}) => api.put<{ ok: boolean }>(`/kendala-pendaftaran/item/${id}`, b);
export const hapusKendala = (id: number) =>
  api.delete<{ ok: boolean }>(`/kendala-pendaftaran/item/${id}`);
export const getKendalaRekap = (tahun?: number) =>
  api.get<KendalaRekap>(`/kendala-pendaftaran/rekap${tahun ? `?tahun=${tahun}` : ""}`);
export interface KendalaEvaluasi { tahun: number; evaluasi: string; tindak_lanjut: string; kesimpulan: string; updated_at: string | null; }
export const getKendalaEvaluasi = (tahun: number) =>
  api.get<KendalaEvaluasi>(`/kendala-pendaftaran/evaluasi?tahun=${tahun}`);
export const saveKendalaEvaluasi = (b: { tahun: number; evaluasi: string; tindak_lanjut: string; kesimpulan: string }) =>
  api.post<{ ok: boolean }>("/kendala-pendaftaran/evaluasi", b);

// AKP 2.1 — Pengelolaan Alur Pasien (dashboard ketersediaan TT)
export interface AlurBangsal {
  kd_bangsal: string; nm_bangsal: string; kelas: string | null;
  total: number; isi: number; kosong: number;
}
export interface AlurKelas { kelas: string | null; total: number; isi: number; kosong: number; }
export interface AlurPasienStatus {
  ringkasan: {
    total_tt: number; terpakai: number; tersedia: number; bor_persen: number;
    ranap_aktif: number; igd_hari_ini: number; igd_menunggu_tt: number;
  };
  per_kelas: AlurKelas[];
  bangsal: AlurBangsal[];
}
export const getAlurPasienStatus = () =>
  api.get<AlurPasienStatus>("/alur-pasien/status");

// AKP 3 — Info perencanaan & pelayanan terintegrasi berkala ke pasien
export interface InfoTerintegrasiPasien {
  no_rawat: string; no_rkm_medis: string | null; nm_pasien: string | null;
  nm_bangsal: string | null; kelas: string | null; kd_kamar: string | null;
  dpjp: string | null; tgl_masuk: string | null; lama_hari: number | null;
  jml_edukasi: number; terakhir_edukasi: string | null; jam_sejak: number | null;
  jml_cppt: number;
}
export interface InfoTerintegrasiStatus {
  interval_jam: number;
  ringkasan: {
    total_ranap: number; belum_pernah: number; terlambat: number;
    terkini: number; perlu_perhatian: number;
  };
  pasien: InfoTerintegrasiPasien[];
}
export const getInfoTerintegrasiStatus = (interval_jam?: number) =>
  api.get<InfoTerintegrasiStatus>(`/info-terintegrasi/status${interval_jam ? `?interval_jam=${interval_jam}` : ""}`);

// AKP 5.1 — Rekap Pasien Pulang APS berkala
export interface ApsRow {
  no_rawat: string; tgl_pulang: string | null; stts_pulang: string | null;
  no_rkm_medis: string | null; nm_pasien: string | null; nm_bangsal: string | null;
  dpjp: string | null; nama_pj: string | null; hubungan: string | null;
  bln: number; ada_surat: number; ttd_pembuat: number; ttd_saksi: number;
}
export interface ApsRekap {
  tahun: number;
  ringkasan: { total: number; ada_surat: number; tanpa_surat: number; bukti_lengkap: number; belum_lengkap: number };
  per_bulan: number[]; per_triwulan: number[]; pasien: ApsRow[];
}
export const getApsRekap = (tahun?: number) =>
  api.get<ApsRekap>(`/aps-rekap${tahun ? `?tahun=${tahun}` : ""}`);

// ── Dokumentasi Rapat — bukti pertemuan lintas komite/unit ────────────────────
export interface RapatRow {
  id: number; judul: string; unit: string; jenis: string; tanggal: string;
  jam_mulai?: string | null; jam_selesai?: string | null;
  tempat?: string | null; pemimpin_rapat?: string | null; notulis?: string | null;
  status: string; dibuat_oleh?: string | null;
  jumlah_peserta: number; jumlah_hadir: number;
  jumlah_tindak_lanjut: number; jumlah_tl_belum: number; jumlah_lampiran: number;
}
export interface RapatPeserta {
  id: number; rapat_id: number; nama: string;
  jabatan_unit?: string | null; status_hadir: string; keterangan?: string | null;
}
export interface RapatTindakLanjut {
  id: number; rapat_id: number; uraian: string;
  penanggung_jawab?: string | null; target_selesai?: string | null;
  status: string; keterangan?: string | null;
}
export interface RapatLampiran {
  id: number; rapat_id: number; jenis: string;
  nama?: string | null; stored_name: string; keterangan?: string | null;
  uploaded_by?: string | null; uploaded_at?: string | null;
}
export interface RapatDetail {
  id: number; judul: string; unit: string; jenis: string; tanggal: string;
  jam_mulai?: string | null; jam_selesai?: string | null;
  tempat?: string | null; pemimpin_rapat?: string | null; notulis?: string | null;
  agenda?: string | null; notulen?: string | null; kesimpulan?: string | null;
  status: string; dibuat_oleh?: string | null;
  peserta: RapatPeserta[]; tindak_lanjut: RapatTindakLanjut[]; lampiran: RapatLampiran[];
}
export interface RapatInput {
  judul: string; unit: string; jenis?: string; tanggal: string;
  jam_mulai?: string; jam_selesai?: string; tempat?: string;
  pemimpin_rapat?: string; notulis?: string;
  agenda?: string; notulen?: string; kesimpulan?: string; status?: string;
}
export const getRapatList = (f: { unit?: string; status?: string; q?: string; dari?: string; sampai?: string } = {}) => {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v) p.append(k, String(v)); });
  return api.get<RapatRow[]>(`/rapat?${p}`);
};
export const getRapatDetail = (id: number) => api.get<RapatDetail>(`/rapat/${id}`);
export const createRapat = (b: RapatInput) => api.post<{ ok: boolean; id: number }>("/rapat", b);
export const updateRapat = (id: number, b: RapatInput) => api.put<{ ok: boolean }>(`/rapat/${id}`, b);
export const deleteRapat = (id: number) => api.delete<{ ok: boolean }>(`/rapat/${id}`);

export const addRapatPeserta = (rapatId: number, b: { nama: string; jabatan_unit?: string; status_hadir?: string; keterangan?: string }) =>
  api.post<{ ok: boolean; id: number }>(`/rapat/${rapatId}/peserta`, b);
export const deleteRapatPeserta = (id: number) => api.delete<{ ok: boolean }>(`/rapat/peserta/${id}`);

export const addRapatTindakLanjut = (rapatId: number, b: { uraian: string; penanggung_jawab?: string; target_selesai?: string; status?: string; keterangan?: string }) =>
  api.post<{ ok: boolean; id: number }>(`/rapat/${rapatId}/tindak-lanjut`, b);
export const updateRapatTindakLanjut = (id: number, b: { uraian: string; penanggung_jawab?: string; target_selesai?: string; status?: string; keterangan?: string }) =>
  api.put<{ ok: boolean }>(`/rapat/tindak-lanjut/${id}`, b);
export const deleteRapatTindakLanjut = (id: number) => api.delete<{ ok: boolean }>(`/rapat/tindak-lanjut/${id}`);

export const uploadRapatLampiran = (rapatId: number, jenis: string, file: File, keterangan?: string) => {
  const fd = new FormData();
  fd.append("jenis", jenis);
  if (keterangan) fd.append("keterangan", keterangan);
  fd.append("file", file);
  return api.post<{ ok: boolean; id: number; link: string }>(`/rapat/${rapatId}/lampiran`, fd, { headers: { "Content-Type": "multipart/form-data" } });
};
export const deleteRapatLampiran = (id: number) => api.delete<{ ok: boolean }>(`/rapat/lampiran/${id}`);
export const rapatLampiranFileUrl = (storedName: string) => `/api/rapat/lampiran/file/${storedName}`;

export interface RapatStats { total_rapat: number; tindak_lanjut_belum_selesai: number; per_unit: { unit: string; jumlah: number }[] }
export const getRapatStats = (dari?: string, sampai?: string) => {
  const p = new URLSearchParams(); if (dari) p.append("dari", dari); if (sampai) p.append("sampai", sampai);
  return api.get<RapatStats>(`/rapat/stats?${p}`);
};

// ---------------------------------------------------------------- TTE Dokumen/SOP
// Penandatanganan elektronik dokumen & SOP. Dua metode: 'bsre' (PAdES, terbaca
// panel tanda tangan Adobe Reader) dan 'tempel' (gambar saja, tidak terdeteksi
// Adobe — keaslian bersandar pada QR + SHA-256).

export interface TteSpesimen {
  id: number; jenis: "ttd" | "stempel" | "logo";
  pejabat_nik: string; pejabat_nama: string; jabatan: string;
  lebar_px: number; tinggi_px: number; tinggi_mm: number;
  mulai: string; selesai: string | null; dibuat_oleh: string;
}
export const getTteSpesimen = () => api.get<TteSpesimen[]>("/tte-spesimen");
export const delTteSpesimen = (id: number) => api.delete<{ ok: boolean }>(`/tte-spesimen/${id}`);
export const tteSpesimenGambarUrl = (id: number) => `/api/tte-spesimen/${id}/gambar`;
export const simpanTteSpesimen = (b: {
  jenis: string; nik?: string; nama?: string; jabatan?: string;
  mulai: string; selesai?: string; tinggi_mm?: number; file: File;
}) => {
  const fd = new FormData();
  fd.append("jenis", b.jenis);
  if (b.nik) fd.append("nik", b.nik);
  if (b.nama) fd.append("nama", b.nama);
  if (b.jabatan) fd.append("jabatan", b.jabatan);
  fd.append("mulai", b.mulai);
  if (b.selesai) fd.append("selesai", b.selesai);
  if (b.tinggi_mm != null) fd.append("tinggi_mm", String(b.tinggi_mm));
  fd.append("file", b.file);
  return api.post<{ ok: boolean; id: number }>("/tte-spesimen", fd,
    { headers: { "Content-Type": "multipart/form-data" } });
};

export interface TteDokumen {
  id: number; nomor: string; judul: string; status: "draft" | "ditandatangani" | "dicabut";
  halaman: number; penandatangan_nama: string; ditandatangani_oleh: string;
  ditandatangani_pada: string | null; hash_hasil: string;
  diunggah_oleh: string; created_at: string | null;
}
export const getTteDokumen = (status?: string) =>
  api.get<TteDokumen[]>(`/tte-sop${status ? `?status=${encodeURIComponent(status)}` : ""}`);
export const unggahTteDokumen = (b: { nomor: string; judul: string; sop_id?: number; file: File }) => {
  const fd = new FormData();
  fd.append("nomor", b.nomor); fd.append("judul", b.judul);
  if (b.sop_id != null) fd.append("sop_id", String(b.sop_id));
  fd.append("file", b.file);
  return api.post<{ ok: boolean; id: number; temuan: Record<string, unknown[]>; catatan: string }>(
    "/tte-sop/unggah", fd, { headers: { "Content-Type": "multipart/form-data" } });
};
export const tteBerkasUrl = (id: number) => `/api/tte-sop/${id}/berkas`;
export const tandatanganiTte = (id: number, b: {
  metode: "bsre" | "tempel"; passphrase?: string; gaya_ttd?: "qr" | "gambar";
  nik?: string; spesimen_ttd_id?: number; spesimen_stempel_id?: number; qr_di_sudut?: boolean;
}) => api.post<{ ok: boolean; hash: string; nomor: string; qr_url: string; metode: string; catatan: string }>(
  `/tte-sop/${id}/tandatangani`, b);
export const cabutTte = (id: number, alasan: string) =>
  api.post<{ ok: boolean }>(`/tte-sop/${id}/cabut`, { alasan });

export interface TteVerifikasi {
  valid: boolean; status?: string; nomor?: string; judul?: string;
  penandatangan?: string; ditandatangani_pada?: string | null;
  hash?: string; alasan_cabut?: string | null; metode?: string;
  pesan: string; catatan_tte?: string;
}
export const verifikasiTteSop = (id: string) =>
  api.get<TteVerifikasi>(`/tte-sop/verify?id=${encodeURIComponent(id)}`);
export const cocokkanTteSop = (hash: string) =>
  api.post<TteVerifikasi>("/tte-sop/verify/cocokkan", { hash });

// ---------------------------------------------------------------- TTE Berkas Klaim (eDokter)
// no_rawat memuat garis miring (2026/10/01/000085) sehingga TIDAK pernah
// dikirim sebagai segmen path — Apache menolak %2F dengan 404.

export interface EdokterTtePenandatangan {
  kode: string; nama: string; sudah: boolean; pada: string | null;
}
export interface EdokterTteBerkas {
  no_rawat: string; no_rkm_medis: string; nm_pasien: string;
  tgl_upload: string | null; nama_berkas: string; lokasi_file: string;
  status: string | null; penandatangan: EdokterTtePenandatangan[];
}
export const edokterTteDaftar = (p: { kd_dokter?: string; tampilkan?: string } = {}) => {
  const sp = new URLSearchParams();
  if (p.kd_dokter) sp.append("kd_dokter", p.kd_dokter);
  if (p.tampilkan) sp.append("tampilkan", p.tampilkan);
  return api.get<EdokterTteBerkas[]>(`/edokter/tte?${sp}`);
};
export const edokterTteBerkasUrl = (no_rawat: string, kd_dokter?: string) => {
  const sp = new URLSearchParams({ no_rawat });
  if (kd_dokter) sp.append("kd_dokter", kd_dokter);
  return `/api/edokter/tte/berkas?${sp}`;
};
export interface EdokterTteHasil {
  ok: boolean; tag: string; halaman: number; hash: string;
  berkas: string; semua_selesai: boolean; catatan: string;
}
export const edokterTteTandatangani = (b: {
  no_rawat: string; passphrase: string; kd_dokter?: string;
}) => api.post<EdokterTteHasil>("/edokter/tte/tandatangani", b);
