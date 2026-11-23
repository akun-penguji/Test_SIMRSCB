"use client";
import MicButton from "@/components/MicButton";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getSirsRl11, editSirsRl11, cetakSirsRl11,
  listKerjasamaLn, createKerjasamaLn, updateKerjasamaLn, deleteKerjasamaLn,
  listSimrsModul, toggleSimrsModul,
  Rl11Profil, Rl11Resp, KerjasamaLn, SimrsModul,
} from "@/lib/api";

const VENDOR_OPTS = [
  "Pemerintah/Kemenkes",
  "Mandiri/Fasyankes",
  "Swasta/PSE",
  "Belum punya SIMRS",
] as const;
const INTERNET_OPTS = ["Tidak ada akses", "Akses minim", "Akses cukup", "Akses baik"] as const;
const BENTUK_OPTS = [
  "Fellowship", "Workshop", "Training", "Co-Branding",
  "KSO", "Penelitian Klinis", "Investasi",
  "Pertukaran Ahli", "Rujukan Pasien", "Lainnya",
] as const;

const KELAS_OPTS = ["A", "B", "C", "D", "D Pratama"] as const;
const JENIS_RS_OPTS = ["Umum", "Khusus"] as const;
const BLU_OPTS = ["Non BLU/BLUD", "BLU", "BLUD"] as const;
const KEPEMILIKAN_OPTS = [
  "Pemerintah Pusat / Kementerian",
  "Pemerintah Provinsi",
  "Pemerintah Kabupaten / Kota",
  "TNI", "POLRI", "BUMN",
  "Swasta", "Yayasan", "Organisasi Keagamaan", "Lainnya",
] as const;
const YA_TIDAK = ["Ya", "Tidak"] as const;
const AKR_OPTS = [
  "Lulus Perdana", "Tingkat Dasar", "Tingkat Madya",
  "Tingkat Utama", "Tingkat Paripurna", "Proses Akreditasi",
] as const;
const SIMRS_OPTS = [
  "Berfungsi Front Office, Back Office",
  "Berfungsi Front Office",
  "Tidak Berfungsi",
  "Tidak Ada",
] as const;
const PD_OPTS = ["BDRS", "UTD", "Tidak ada"] as const;
const ADA_OPTS = ["Ada", "Tidak ada"] as const;
const AUDIT_OPTS = ["Dilakukan", "Tidak dilakukan"] as const;

type FormState = Rl11Profil;

const EMPTY: FormState = {
  tahun_berdiri: null, nama_direktur: "", jenis_rs: "", kelas_rs: "",
  status_blu: "", kepemilikan: "", nama_penyelenggara: "",
  kerjasama_bpjs: "Ya", luas_tanah_m2: null, luas_bangunan_m2: null,
  no_call_center: "", website: "",
  no_sio: "", tgl_sio: "", tgl_berlaku_sio: "", file_sio: "",
  pentahapan_akreditasi: "", tgl_penetapan_akreditasi: "",
  tgl_berlaku_akreditasi: "", file_akreditasi: "",
  akreditasi_internasional: "Tidak", rs_pendidikan: "Tidak",
  no_sk_pendidikan: "", tgl_sk_pendidikan: "",
  no_sk_tt: "", tgl_sk_tt: "", file_sk_tt: "",
  ipwl: "Tidak", no_sk_ipwl: "", tgl_sk_ipwl: "", file_tarif_layanan: "",
  layanan_unggulan: "", simrs_kondisi: "", pelayanan_darah: "",
  komite_transfusi_darah: "", audit_pelayanan_darah: "",
  latitude: null, longitude: null,
  nama_ka_ifrs: "", telp_ka_ifrs: "", email_ka_ifrs: "",
  kerjasama_psef: "Tidak", kerjasama_fk_fkg: "",
  foto_tampak_depan: "", foto_ruang_ralan: "", foto_ruang_ranap: "",
  foto_ruang_igd: "", foto_alkes: "",
  simrs_jenis_vendor: "", simrs_nama_developer: "", simrs_akses_internet: "",
  simrs_pic_nama: "", simrs_pic_nik: "", simrs_pic_email: "",
  simrs_pic_telp: "", simrs_pic_jabatan: "",
};

const EMPTY_KS: KerjasamaLn = {
  nama_institusi: "", negara: "", area: "", output_kerja: "",
  bentuk: "", keterangan: "", tgl_mulai: "", tgl_akhir: "",
};

export default function Rl11Page() {
  const [meta, setMeta]     = useState<Rl11Resp | null>(null);
  const [form, setForm]     = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [tab, setTab] = useState<"A" | "B" | "C" | "D" | "E" | "F">("A");

  // Section E + F state
  const [ksList, setKsList] = useState<KerjasamaLn[]>([]);
  const [ksForm, setKsForm] = useState<KerjasamaLn>(EMPTY_KS);
  const [ksEditId, setKsEditId] = useState<number | null>(null);
  const [moduls, setModuls] = useState<SimrsModul[]>([]);

  const reloadKs = useCallback(() => {
    listKerjasamaLn().then(r => setKsList(r.data)).catch(() => {});
  }, []);
  const reloadModul = useCallback(() => {
    listSimrsModul().then(r => setModuls(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getSirsRl11().then(r => {
      setMeta(r.data);
      setForm({ ...EMPTY, ...(r.data.data || {}) });
    }).catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
    reloadKs();
    reloadModul();
  }, [reloadKs, reloadModul]);

  const ksToggleBentuk = (b: string) => {
    const cur = (ksForm.bentuk || "").split(",").map(s => s.trim()).filter(Boolean);
    const next = cur.includes(b) ? cur.filter(x => x !== b) : [...cur, b];
    setKsForm(f => ({ ...f, bentuk: next.join(",") }));
  };
  const ksHasBentuk = (b: string) =>
    (ksForm.bentuk || "").split(",").map(s => s.trim()).includes(b);

  const ksReset = () => { setKsForm(EMPTY_KS); setKsEditId(null); };
  const ksLoadEdit = (k: KerjasamaLn) => {
    setKsForm({ ...EMPTY_KS, ...k });
    setKsEditId(k.id || null);
  };
  const ksSave = async () => {
    if (!ksForm.nama_institusi.trim() || !ksForm.negara.trim()) {
      setErrMsg("Nama institusi & negara wajib diisi"); return;
    }
    try {
      if (ksEditId) {
        await updateKerjasamaLn(ksEditId, ksForm);
      } else {
        await createKerjasamaLn(ksForm);
      }
      ksReset();
      reloadKs();
      setOkMsg("Kerjasama LN tersimpan");
      setTimeout(() => setOkMsg(""), 2500);
    } catch { setErrMsg("Gagal simpan kerjasama LN"); }
  };
  const ksDelete = async (id: number) => {
    if (!confirm("Hapus kerjasama ini?")) return;
    try {
      await deleteKerjasamaLn(id);
      reloadKs();
    } catch { setErrMsg("Gagal hapus"); }
  };

  const modulToggle = async (m: SimrsModul) => {
    const newAda = !(m.ada !== 0);
    // Optimistic update
    setModuls(ms => ms.map(x => x.id === m.id ? { ...x, ada: newAda ? 1 : 0 } : x));
    try {
      await toggleSimrsModul(m.id, newAda);
    } catch {
      // Revert
      setModuls(ms => ms.map(x => x.id === m.id ? { ...x, ada: m.ada } : x));
      setErrMsg("Gagal update modul");
    }
  };

  const handleCetak = async () => {
    try { await cetakSirsRl11(); }
    catch { setErrMsg("Gagal membuka pratinjau cetak"); }
  };

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setErrMsg(""); setOkMsg("");
    try {
      // Clean empty strings to null sebelum kirim
      const payload: FormState = {};
      (Object.keys(form) as (keyof FormState)[]).forEach(k => {
        const v = form[k];
        if (v === "" || v === undefined) (payload as Record<string, unknown>)[k] = null;
        else (payload as Record<string, unknown>)[k] = v;
      });
      await editSirsRl11(payload);
      setSaving(false);
      setOkMsg("Tersimpan");
      setTimeout(() => setOkMsg(""), 3000);
    } catch (e: unknown) {
      setSaving(false);
      setErrMsg(e instanceof Error ? e.message : "Gagal simpan");
    }
  };

  if (loading) return <div className="p-6 text-center text-slate-400 text-sm">Memuat...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <Link href="/laporan/sirs" className="text-xs text-slate-500 hover:text-green-700">
          ← Laporan SIRS 6.3
        </Link>
        <div className="flex items-start gap-3 mt-2">
          <span className="font-mono text-lg font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded">
            RL 1.1
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800 leading-tight">Profil Rumah Sakit</h1>
            <p className="text-xs text-slate-500 mt-1">
              RL 1 · RS Online · Periode: <span className="font-medium">Update saat ada perubahan</span>
            </p>
          </div>
          <button onClick={handleCetak}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Cetak
          </button>
        </div>
      </div>

      {errMsg && <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm">{errMsg}</div>}
      {okMsg  && <div className="mb-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-green-800 text-sm">{okMsg}</div>}

      {/* Read-only setting Khanza */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
        <p className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-2">
          Data dari Setting RS (read-only)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <Info label="Nama Fasyankes"  value={meta?.nama_instansi || "-"} />
          <Info label="Alamat RS"       value={meta?.alamat_instansi || "-"} />
          <Info label="Kab/Kota"        value={meta?.kabupaten || "-"} />
          <Info label="Provinsi"        value={meta?.propinsi || "-"} />
          <Info label="Telepon"         value={meta?.kontak || "-"} />
          <Info label="Email"           value={meta?.email || "-"} />
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Untuk ubah field-field ini, gunakan menu Pengaturan → Setting Rumah Sakit (Khanza desktop).
        </p>
      </div>

      {/* Tabs A/B/C/D/E/F */}
      <div className="border-b border-slate-200 mb-4 flex gap-1 flex-wrap">
        {[
          { id: "A" as const, label: "A. Profil"                 },
          { id: "B" as const, label: "B. Perizinan & Akreditasi" },
          { id: "C" as const, label: "C. Lainnya"                },
          { id: "D" as const, label: "D. Foto"                   },
          { id: "E" as const, label: `E. Kerjasama LN (${ksList.length})` },
          { id: "F" as const, label: `F. Profil SIMRS (${moduls.filter(m => m.ada).length}/${moduls.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === t.id ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        {tab === "A" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Tahun Berdiri">
              <input type="number" min={1900} max={2099} value={form.tahun_berdiri ?? ""}
                onChange={(e) => upd("tahun_berdiri", e.target.value === "" ? null : parseInt(e.target.value, 10))}
                className="inp" />
            </Field>
            <Field label="Nama Direktur Utama/Direktur">
              <input value={form.nama_direktur ?? ""}
                onChange={(e) => upd("nama_direktur", e.target.value)}
                placeholder="dr. ..." className="inp" />
            </Field>
            <Field label="Jenis RS">
              <Sel value={form.jenis_rs ?? ""} onChange={(v) => upd("jenis_rs", v)} options={JENIS_RS_OPTS} />
            </Field>
            <Field label="Kelas RS">
              <Sel value={form.kelas_rs ?? ""} onChange={(v) => upd("kelas_rs", v)} options={KELAS_OPTS} />
            </Field>
            <Field label="Status BLU/BLUD">
              <Sel value={form.status_blu ?? ""} onChange={(v) => upd("status_blu", v)} options={BLU_OPTS} />
            </Field>
            <Field label="Kepemilikan">
              <Sel value={form.kepemilikan ?? ""} onChange={(v) => upd("kepemilikan", v)} options={KEPEMILIKAN_OPTS} />
            </Field>
            <Field label="Nama Penyelenggara" span>
              <input value={form.nama_penyelenggara ?? ""}
                onChange={(e) => upd("nama_penyelenggara", e.target.value)}
                placeholder="Nama instansi/perorangan penyelenggara RS" className="inp" />
            </Field>
            <Field label="Kerja sama BPJS">
              <Sel value={form.kerjasama_bpjs ?? ""} onChange={(v) => upd("kerjasama_bpjs", v)} options={YA_TIDAK} />
            </Field>
            <Field label="Luas Tanah (m²)">
              <input type="number" min={0} value={form.luas_tanah_m2 ?? ""}
                onChange={(e) => upd("luas_tanah_m2", e.target.value === "" ? null : parseInt(e.target.value, 10))}
                className="inp" />
            </Field>
            <Field label="Luas Bangunan (m²)">
              <input type="number" min={0} value={form.luas_bangunan_m2 ?? ""}
                onChange={(e) => upd("luas_bangunan_m2", e.target.value === "" ? null : parseInt(e.target.value, 10))}
                className="inp" />
            </Field>
            <Field label="Nomor Telepon (call center)">
              <input value={form.no_call_center ?? ""}
                onChange={(e) => upd("no_call_center", e.target.value)}
                placeholder="Nomor yang bisa dihubungi 24 jam" className="inp" />
            </Field>
            <Field label="Alamat Website">
              <input type="url" value={form.website ?? ""}
                onChange={(e) => upd("website", e.target.value)}
                placeholder="https://..." className="inp" />
            </Field>
          </div>
        )}

        {tab === "B" && (
          <div className="space-y-5">
            <fieldset className="border border-slate-200 rounded-xl p-4">
              <legend className="px-2 text-xs font-semibold uppercase text-slate-500">Surat Izin Operasional</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <Field label="No. SIO">
                  <input value={form.no_sio ?? ""} onChange={(e) => upd("no_sio", e.target.value)} className="inp" />
                </Field>
                <Field label="Tanggal SIO">
                  <input type="date" value={form.tgl_sio ?? ""}
                    onChange={(e) => upd("tgl_sio", e.target.value)} className="inp" />
                </Field>
                <Field label="Tanggal Berlaku SIO (akhir)">
                  <input type="date" value={form.tgl_berlaku_sio ?? ""}
                    onChange={(e) => upd("tgl_berlaku_sio", e.target.value)} className="inp" />
                </Field>
                <Field label="File SIO (path PDF, opsional)">
                  <input value={form.file_sio ?? ""} onChange={(e) => upd("file_sio", e.target.value)}
                    placeholder="upload file fitur belum tersedia" className="inp" />
                </Field>
              </div>
            </fieldset>

            <fieldset className="border border-slate-200 rounded-xl p-4">
              <legend className="px-2 text-xs font-semibold uppercase text-slate-500">Akreditasi</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Pentahapan Akreditasi Nasional">
                  <Sel value={form.pentahapan_akreditasi ?? ""}
                    onChange={(v) => upd("pentahapan_akreditasi", v)} options={AKR_OPTS} />
                </Field>
                <Field label="Akreditasi Internasional">
                  <Sel value={form.akreditasi_internasional ?? ""}
                    onChange={(v) => upd("akreditasi_internasional", v)} options={YA_TIDAK} />
                </Field>
                <Field label="Tanggal Penetapan Akreditasi">
                  <input type="date" value={form.tgl_penetapan_akreditasi ?? ""}
                    onChange={(e) => upd("tgl_penetapan_akreditasi", e.target.value)} className="inp" />
                </Field>
                <Field label="Tanggal Berlaku Akreditasi">
                  <input type="date" value={form.tgl_berlaku_akreditasi ?? ""}
                    onChange={(e) => upd("tgl_berlaku_akreditasi", e.target.value)} className="inp" />
                </Field>
                <Field label="File Akreditasi (path PDF, opsional)" span>
                  <input value={form.file_akreditasi ?? ""}
                    onChange={(e) => upd("file_akreditasi", e.target.value)}
                    placeholder="upload file fitur belum tersedia" className="inp" />
                </Field>
              </div>
            </fieldset>

            <fieldset className="border border-slate-200 rounded-xl p-4">
              <legend className="px-2 text-xs font-semibold uppercase text-slate-500">RS Pendidikan</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <Field label="RS Pendidikan?">
                  <Sel value={form.rs_pendidikan ?? ""} onChange={(v) => upd("rs_pendidikan", v)} options={YA_TIDAK} />
                </Field>
                <span />
                <Field label="No. SK RS Pendidikan">
                  <input value={form.no_sk_pendidikan ?? ""}
                    onChange={(e) => upd("no_sk_pendidikan", e.target.value)} className="inp" />
                </Field>
                <Field label="Tanggal SK RS Pendidikan">
                  <input type="date" value={form.tgl_sk_pendidikan ?? ""}
                    onChange={(e) => upd("tgl_sk_pendidikan", e.target.value)} className="inp" />
                </Field>
              </div>
            </fieldset>

            <fieldset className="border border-slate-200 rounded-xl p-4">
              <legend className="px-2 text-xs font-semibold uppercase text-slate-500">SK Tempat Tidur</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <Field label="No. SK Tempat Tidur">
                  <input value={form.no_sk_tt ?? ""} onChange={(e) => upd("no_sk_tt", e.target.value)} className="inp" />
                </Field>
                <Field label="Tanggal SK Tempat Tidur">
                  <input type="date" value={form.tgl_sk_tt ?? ""}
                    onChange={(e) => upd("tgl_sk_tt", e.target.value)} className="inp" />
                </Field>
                <Field label="File SK Tempat Tidur (path PDF, opsional)" span>
                  <input value={form.file_sk_tt ?? ""}
                    onChange={(e) => upd("file_sk_tt", e.target.value)}
                    placeholder="upload file fitur belum tersedia" className="inp" />
                </Field>
              </div>
            </fieldset>

            <fieldset className="border border-slate-200 rounded-xl p-4">
              <legend className="px-2 text-xs font-semibold uppercase text-slate-500">IPWL & Tarif</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Institusi Penerima Wajib Lapor (IPWL)?">
                  <Sel value={form.ipwl ?? ""} onChange={(v) => upd("ipwl", v)} options={YA_TIDAK} />
                </Field>
                <span />
                <Field label="No. SK Menkes IPWL">
                  <input value={form.no_sk_ipwl ?? ""}
                    onChange={(e) => upd("no_sk_ipwl", e.target.value)} className="inp" />
                </Field>
                <Field label="Tanggal SK IPWL">
                  <input type="date" value={form.tgl_sk_ipwl ?? ""}
                    onChange={(e) => upd("tgl_sk_ipwl", e.target.value)} className="inp" />
                </Field>
                <Field label="File Tarif Layanan (path PDF, opsional)" span>
                  <input value={form.file_tarif_layanan ?? ""}
                    onChange={(e) => upd("file_tarif_layanan", e.target.value)}
                    placeholder="upload file fitur belum tersedia" className="inp" />
                </Field>
              </div>
            </fieldset>
          </div>
        )}

        {tab === "C" && (
          <div className="space-y-5">
            <Field label="Layanan Unggulan" span>
              <div className="relative">
                <textarea rows={2} value={form.layanan_unggulan ?? ""}
                  onChange={(e) => upd("layanan_unggulan", e.target.value)}
                  placeholder="Sebutkan layanan unggulan RS, spesifik" className="inp pr-8" />
                <MicButton value={form.layanan_unggulan ?? ""} onChange={v => upd("layanan_unggulan", v)} className="absolute right-1.5 bottom-1.5" />
              </div>
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <Field label="SIMRS">
                <Sel value={form.simrs_kondisi ?? ""}
                  onChange={(v) => upd("simrs_kondisi", v)} options={SIMRS_OPTS} />
              </Field>
              <Field label="Pelayanan Darah">
                <Sel value={form.pelayanan_darah ?? ""}
                  onChange={(v) => upd("pelayanan_darah", v)} options={PD_OPTS} />
              </Field>
              <Field label="Komite/Panitia Transfusi Darah">
                <Sel value={form.komite_transfusi_darah ?? ""}
                  onChange={(v) => upd("komite_transfusi_darah", v)} options={ADA_OPTS} />
              </Field>
              <Field label="Audit Penyelenggaraan Pelayanan Darah">
                <Sel value={form.audit_pelayanan_darah ?? ""}
                  onChange={(v) => upd("audit_pelayanan_darah", v)} options={AUDIT_OPTS} />
              </Field>
              <Field label="Latitude">
                <input type="number" step="any" value={form.latitude ?? ""}
                  onChange={(e) => upd("latitude", e.target.value === "" ? null : parseFloat(e.target.value))}
                  placeholder="mis. -6.218" className="inp" />
              </Field>
              <Field label="Longitude">
                <input type="number" step="any" value={form.longitude ?? ""}
                  onChange={(e) => upd("longitude", e.target.value === "" ? null : parseFloat(e.target.value))}
                  placeholder="mis. 106.832" className="inp" />
              </Field>
            </div>

            <fieldset className="border border-slate-200 rounded-xl p-4">
              <legend className="px-2 text-xs font-semibold uppercase text-slate-500">Kepala Instalasi Farmasi RS</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Nama Ka. IFRS">
                  <input value={form.nama_ka_ifrs ?? ""}
                    onChange={(e) => upd("nama_ka_ifrs", e.target.value)} className="inp" />
                </Field>
                <Field label="No. Telp / HP Ka. IFRS">
                  <input value={form.telp_ka_ifrs ?? ""}
                    onChange={(e) => upd("telp_ka_ifrs", e.target.value)} className="inp" />
                </Field>
                <Field label="Email Ka. IFRS" span>
                  <input type="email" value={form.email_ka_ifrs ?? ""}
                    onChange={(e) => upd("email_ka_ifrs", e.target.value)} className="inp" />
                </Field>
              </div>
            </fieldset>

            <Field label="Kerjasama dengan PSEF (Penyelenggara Sistem Elektronik Farmasi)">
              <Sel value={form.kerjasama_psef ?? ""}
                onChange={(v) => upd("kerjasama_psef", v)} options={YA_TIDAK} />
            </Field>

            <Field label="Kerjasama dengan FK/FKG dan Institusi Pendidikan Kesehatan lainnya" span>
              <div className="relative">
                <textarea rows={3} value={form.kerjasama_fk_fkg ?? ""}
                  onChange={(e) => upd("kerjasama_fk_fkg", e.target.value)}
                  placeholder="Sebut nama institusi (bisa lebih dari satu, pisah baris baru)" className="inp pr-8" />
                <MicButton value={form.kerjasama_fk_fkg ?? ""} onChange={v => upd("kerjasama_fk_fkg", v)} className="absolute right-1.5 bottom-1.5" />
              </div>
            </Field>
          </div>
        )}

        {tab === "D" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Per JUKNIS: upload file *.jpg ukuran &lt;5 MB. Untuk sekarang isi <em>path file</em> manual (uploader akan ditambah di iterasi berikutnya).
            </p>
            {[
              { k: "foto_tampak_depan" as const, label: "1. Foto Tampak Depan RS" },
              { k: "foto_ruang_ralan"  as const, label: "2. Foto Ruang Pelayanan Rawat Jalan" },
              { k: "foto_ruang_ranap"  as const, label: "3. Foto Ruang Rawat Inap" },
              { k: "foto_ruang_igd"    as const, label: "4. Foto Ruang IGD" },
              { k: "foto_alkes"        as const, label: "5. Foto Alat Kesehatan" },
            ].map(item => (
              <Field key={item.k} label={item.label}>
                <input value={form[item.k] ?? ""}
                  onChange={(e) => upd(item.k, e.target.value)}
                  placeholder="mis. sirs_rl11/foto_xxx.jpg" className="inp" />
              </Field>
            ))}
          </div>
        )}

        {tab === "E" && (
          <div className="space-y-5">
            {/* List existing kerjasama */}
            {ksList.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">Daftar Kerjasama Tersimpan</p>
                {ksList.map(k => (
                  <div key={k.id} className="border border-slate-200 rounded-xl p-3 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">
                          {k.nama_institusi} <span className="text-slate-500 font-normal">— {k.negara}</span>
                        </p>
                        <p className="text-xs text-slate-600 mt-1">{k.area || "-"}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(k.bentuk || "").split(",").filter(Boolean).map(b => (
                            <span key={b} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{b.trim()}</span>
                          ))}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {k.tgl_mulai || "?"} s/d {k.tgl_akhir || "?"}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => ksLoadEdit(k)}
                          className="text-xs px-3 py-1 rounded-lg border border-slate-300 hover:bg-slate-100">Edit</button>
                        <button onClick={() => k.id && ksDelete(k.id)}
                          className="text-xs px-3 py-1 rounded-lg border border-red-300 text-red-700 hover:bg-red-50">Hapus</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Belum ada kerjasama LN tercatat.</p>
            )}

            {/* Form add/edit */}
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 bg-slate-50">
              <p className="text-xs font-semibold text-slate-700 mb-3">
                {ksEditId ? `Edit Kerjasama #${ksEditId}` : "Tambah Kerjasama Baru"}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                <Field label="Nama Institusi/RS LN">
                  <input value={ksForm.nama_institusi}
                    onChange={(e) => setKsForm(f => ({ ...f, nama_institusi: e.target.value }))}
                    className="inp" />
                </Field>
                <Field label="Negara">
                  <input value={ksForm.negara}
                    onChange={(e) => setKsForm(f => ({ ...f, negara: e.target.value }))}
                    placeholder="mis. Singapura" className="inp" />
                </Field>
                <Field label="Area Kerjasama" span>
                  <input value={ksForm.area ?? ""}
                    onChange={(e) => setKsForm(f => ({ ...f, area: e.target.value }))}
                    className="inp" />
                </Field>
                <Field label="Output Kerjasama" span>
                  <div className="relative">
                    <textarea rows={2} value={ksForm.output_kerja ?? ""}
                      onChange={(e) => setKsForm(f => ({ ...f, output_kerja: e.target.value }))}
                      className="inp pr-8" />
                    <MicButton value={ksForm.output_kerja ?? ""} onChange={v => setKsForm(f => ({ ...f, output_kerja: v }))} className="absolute right-1.5 bottom-1.5" />
                  </div>
                </Field>
                <Field label="Bentuk Kerjasama (boleh multi)" span>
                  <div className="flex flex-wrap gap-2">
                    {BENTUK_OPTS.map(b => (
                      <label key={b} className="flex items-center gap-1.5 text-xs px-2 py-1 border border-slate-300 rounded-lg cursor-pointer hover:bg-white">
                        <input type="checkbox" checked={ksHasBentuk(b)}
                          onChange={() => ksToggleBentuk(b)} className="accent-emerald-700" />
                        <span>{b}</span>
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Tanggal Mulai">
                  <input type="date" value={ksForm.tgl_mulai ?? ""}
                    onChange={(e) => setKsForm(f => ({ ...f, tgl_mulai: e.target.value }))} className="inp" />
                </Field>
                <Field label="Tanggal Akhir">
                  <input type="date" value={ksForm.tgl_akhir ?? ""}
                    onChange={(e) => setKsForm(f => ({ ...f, tgl_akhir: e.target.value }))} className="inp" />
                </Field>
                <Field label="Keterangan / Kendala" span>
                  <div className="relative">
                    <textarea rows={2} value={ksForm.keterangan ?? ""}
                      onChange={(e) => setKsForm(f => ({ ...f, keterangan: e.target.value }))}
                      className="inp pr-8" />
                    <MicButton value={ksForm.keterangan ?? ""} onChange={v => setKsForm(f => ({ ...f, keterangan: v }))} className="absolute right-1.5 bottom-1.5" />
                  </div>
                </Field>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                {ksEditId && (
                  <button onClick={ksReset}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-sm text-slate-700">
                    Batal
                  </button>
                )}
                <button onClick={ksSave}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium">
                  {ksEditId ? "Update" : "Tambah"}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "F" && (
          <div className="space-y-5">
            <fieldset className="border border-slate-200 rounded-xl p-4">
              <legend className="px-2 text-xs font-semibold uppercase text-slate-500">Informasi SIMRS Dasar</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                <Field label="Jenis Vendor">
                  <Sel value={form.simrs_jenis_vendor ?? ""} onChange={(v) => upd("simrs_jenis_vendor", v)} options={VENDOR_OPTS} />
                </Field>
                <Field label="Nama Developer/Pengembang">
                  <input value={form.simrs_nama_developer ?? ""}
                    onChange={(e) => upd("simrs_nama_developer", e.target.value)} className="inp" />
                </Field>
                <Field label="Kondisi Akses Internet">
                  <Sel value={form.simrs_akses_internet ?? ""} onChange={(v) => upd("simrs_akses_internet", v)} options={INTERNET_OPTS} />
                </Field>
                <span />
              </div>
            </fieldset>

            <fieldset className="border border-slate-200 rounded-xl p-4">
              <legend className="px-2 text-xs font-semibold uppercase text-slate-500">Kontak PIC Integrasi SATUSEHAT</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                <Field label="Nama PIC">
                  <input value={form.simrs_pic_nama ?? ""}
                    onChange={(e) => upd("simrs_pic_nama", e.target.value)} className="inp" />
                </Field>
                <Field label="NIK PIC">
                  <input value={form.simrs_pic_nik ?? ""}
                    onChange={(e) => upd("simrs_pic_nik", e.target.value)} className="inp" />
                </Field>
                <Field label="Email Integrasi SATUSEHAT">
                  <input type="email" value={form.simrs_pic_email ?? ""}
                    onChange={(e) => upd("simrs_pic_email", e.target.value)} className="inp" />
                </Field>
                <Field label="No. Telp / WA PIC">
                  <input value={form.simrs_pic_telp ?? ""}
                    onChange={(e) => upd("simrs_pic_telp", e.target.value)} className="inp" />
                </Field>
                <Field label="Jabatan PIC" span>
                  <input value={form.simrs_pic_jabatan ?? ""}
                    onChange={(e) => upd("simrs_pic_jabatan", e.target.value)} className="inp" />
                </Field>
              </div>
            </fieldset>

            <div className="border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase text-slate-500 mb-3">
                Modul SIMRS / RME yang Dimiliki RS ({moduls.filter(m => m.ada).length}/{moduls.length} aktif)
              </p>
              <div className="space-y-2">
                {Array.from(new Set(moduls.map(m => m.kategori))).map(kat => {
                  const items = moduls.filter(m => m.kategori === kat);
                  return (
                    <details key={kat} className="border border-slate-200 rounded-lg" open>
                      <summary className="cursor-pointer px-3 py-2 bg-slate-50 text-sm font-semibold text-slate-800 hover:bg-slate-100">
                        {kat} ({items.filter(m => m.ada).length}/{items.length})
                      </summary>
                      <div className="p-3 space-y-1">
                        {items.map(m => (
                          <label key={m.id} className="flex items-start gap-2 cursor-pointer text-xs text-slate-700 hover:bg-slate-50 p-1.5 rounded">
                            <input type="checkbox" checked={m.ada !== 0}
                              onChange={() => modulToggle(m)} className="mt-0.5 accent-emerald-700" />
                            <span className="font-mono text-slate-400 min-w-[28px]">#{m.id}</span>
                            <div className="flex-1">
                              {m.sub_kategori && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded mr-2">{m.sub_kategori}</span>}
                              <span>{m.modul}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Save bar */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <p className="text-[11px] text-slate-400">
            {form.updated_at && `Terakhir diubah ${form.updated_at}`}
            {form.updated_by && ` oleh ${form.updated_by}`}
          </p>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 text-white text-sm font-medium">
            {saving ? "Menyimpan..." : "Simpan Profil RS"}
          </button>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-slate-400 italic">
        Section A/B/C/D/F disimpan via tombol &quot;Simpan Profil RS&quot;. Section E (kerjasama LN) &amp; F-modul checklist disimpan otomatis saat klik tombol/centang.
      </p>

      <style jsx>{`
        :global(.inp) {
          width: 100%;
          border: 1px solid rgb(226 232 240);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: rgb(15 23 42);
          background: white;
        }
        :global(.inp:focus) { outline: none; border-color: rgb(16 185 129); box-shadow: 0 0 0 1px rgb(16 185 129); }
      `}</style>
    </div>
  );
}

function Field({ label, children, span = false }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? "md:col-span-2" : ""}>
      <label className="text-xs text-slate-600 font-semibold block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="inp">
      <option value="">— pilih —</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-500 min-w-[110px]">{label}</span>
      <span className="text-slate-400">:</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}
