"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tambahPasien } from "@/lib/api";
import MicButton from "@/components/MicButton";

function InputField({
  label, name, value, onChange, type = "text", required = false,
}: {
  label: string; name: string; value: string;
  onChange: (n: string, v: string) => void;
  type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white
                   focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
      />
    </div>
  );
}

function SelectField({
  label, name, value, onChange, options, required = false,
}: {
  label: string; name: string; value: string;
  onChange: (n: string, v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white
                   focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

const JK_OPTIONS = [
  { value: "L", label: "Laki-laki" },
  { value: "P", label: "Perempuan" },
];

const GOL_DARAH_OPTIONS = [
  { value: "-", label: "-" },
  { value: "A", label: "A" }, { value: "B", label: "B" },
  { value: "AB", label: "AB" }, { value: "O", label: "O" },
  { value: "A+", label: "A+" }, { value: "A-", label: "A-" },
  { value: "B+", label: "B+" }, { value: "B-", label: "B-" },
  { value: "AB+", label: "AB+" }, { value: "AB-", label: "AB-" },
  { value: "O+", label: "O+" }, { value: "O-", label: "O-" },
];

const STTS_NIKAH_OPTIONS = [
  { value: "BELUM MENIKAH", label: "Belum Menikah" },
  { value: "MENIKAH", label: "Menikah" },
  { value: "CERAI", label: "Cerai" },
  { value: "JANDA/DUDA", label: "Janda/Duda" },
];

const AGAMA_OPTIONS = [
  { value: "", label: "- Pilih -" },
  { value: "ISLAM", label: "Islam" },
  { value: "KRISTEN", label: "Kristen" },
  { value: "KATHOLIK", label: "Katholik" },
  { value: "HINDU", label: "Hindu" },
  { value: "BUDHA", label: "Budha" },
  { value: "KONGHUCU", label: "Konghucu" },
];

const PENDIDIKAN_OPTIONS = [
  { value: "-", label: "-" },
  { value: "SD", label: "SD" }, { value: "SMP", label: "SMP" },
  { value: "SMA", label: "SMA" }, { value: "D1", label: "D1" },
  { value: "D2", label: "D2" }, { value: "D3", label: "D3" },
  { value: "S1", label: "S1" }, { value: "S2", label: "S2" },
  { value: "S3", label: "S3" },
];

const initForm = {
  no_rm: "",
  nm_pasien: "",
  tgl_lahir: "",
  jk: "L",
  tmp_lahir: "",
  nm_ibu: "",
  agama: "",
  pendidikan: "-",
  pekerjaan: "",
  gol_darah: "-",
  stts_nikah: "BELUM MENIKAH",
  no_tlp: "",
  no_ktp: "",
  no_peserta: "",
  email: "",
  alamat: "",
  kd_pj: "A01",
  namakeluarga: "",
  keluarga: "",
};

export default function PasienBaruPage() {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>(initForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleChange(name: string, value: string) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nm_pasien.trim()) {
      setError("Nama pasien wajib diisi");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await tambahPasien({
        no_rm: form.no_rm || undefined,
        nm_pasien: form.nm_pasien,
        tgl_lahir: form.tgl_lahir || undefined,
        jk: form.jk,
        tmp_lahir: form.tmp_lahir || undefined,
        nm_ibu: form.nm_ibu || undefined,
        agama: form.agama || undefined,
        pendidikan: form.pendidikan || undefined,
        pekerjaan: form.pekerjaan || undefined,
        gol_darah: form.gol_darah || undefined,
        no_tlp: form.no_tlp || undefined,
        no_ktp: form.no_ktp || undefined,
        no_peserta: form.no_peserta || undefined,
        email: form.email || undefined,
        alamat: form.alamat || undefined,
        kd_pj: form.kd_pj || undefined,
        namakeluarga: form.namakeluarga || undefined,
        keluarga: form.keluarga || undefined,
      } as any);
      const no_rm = res.data?.no_rm;
      if (no_rm) {
        router.push(`/pasien/${encodeURIComponent(no_rm)}`);
      } else {
        router.push("/pasien");
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Gagal menyimpan data pasien");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Pasien Baru</h1>
          <p className="text-sm text-slate-500 mt-0.5">Daftarkan pasien baru ke sistem</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* No. RM */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
            <h2 className="text-sm font-semibold text-slate-700">No. Rekam Medis</h2>
          </div>
          <div className="p-5">
            <div className="max-w-xs">
              <label className="block text-xs text-slate-500 mb-1">No. RM</label>
              <input
                value={form.no_rm}
                onChange={(e) => handleChange("no_rm", e.target.value)}
                placeholder="Otomatis jika kosong"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                           placeholder:text-slate-400 font-mono"
              />
              <p className="text-xs text-slate-400 mt-1">Kosongkan untuk generate otomatis (format 6 digit)</p>
            </div>
          </div>
        </div>

        {/* Identitas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
            <h2 className="text-sm font-semibold text-slate-700">Identitas Pasien</h2>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="col-span-2">
              <InputField label="Nama Pasien" name="nm_pasien" value={form.nm_pasien} onChange={handleChange} required />
            </div>
            <SelectField label="Jenis Kelamin" name="jk" value={form.jk} onChange={handleChange} options={JK_OPTIONS} />
            <InputField label="Tanggal Lahir" name="tgl_lahir" value={form.tgl_lahir} onChange={handleChange} type="date" />
            <InputField label="Tempat Lahir" name="tmp_lahir" value={form.tmp_lahir} onChange={handleChange} />
            <SelectField label="Agama" name="agama" value={form.agama} onChange={handleChange} options={AGAMA_OPTIONS} />
            <SelectField label="Pendidikan" name="pendidikan" value={form.pendidikan} onChange={handleChange} options={PENDIDIKAN_OPTIONS} />
            <InputField label="Pekerjaan" name="pekerjaan" value={form.pekerjaan} onChange={handleChange} />
            <SelectField label="Gol. Darah" name="gol_darah" value={form.gol_darah} onChange={handleChange} options={GOL_DARAH_OPTIONS} />
            <SelectField label="Status Nikah" name="stts_nikah" value={form.stts_nikah} onChange={handleChange} options={STTS_NIKAH_OPTIONS} />
            <InputField label="Nama Ibu Kandung" name="nm_ibu" value={form.nm_ibu} onChange={handleChange} />
          </div>
        </div>

        {/* Kontak */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
            <h2 className="text-sm font-semibold text-slate-700">Kontak & Identitas</h2>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
            <InputField label="No. Telpon" name="no_tlp" value={form.no_tlp} onChange={handleChange} />
            <InputField label="No. KTP / NIK" name="no_ktp" value={form.no_ktp} onChange={handleChange} />
            <InputField label="No. Peserta (BPJS)" name="no_peserta" value={form.no_peserta} onChange={handleChange} />
            <InputField label="Email" name="email" value={form.email} onChange={handleChange} type="email" />
          </div>
        </div>

        {/* Alamat */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
            <h2 className="text-sm font-semibold text-slate-700">Alamat</h2>
          </div>
          <div className="p-5">
            <label className="block text-xs text-slate-500 mb-1">Alamat</label>
            <div className="relative">
              <textarea
                value={form.alamat}
                onChange={(e) => handleChange("alamat", e.target.value)}
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
              <MicButton value={form.alamat} onChange={(v) => handleChange("alamat", v)} className="absolute right-1.5 bottom-1.5" />
            </div>
          </div>
        </div>

        {/* Penanggung Jawab */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
            <h2 className="text-sm font-semibold text-slate-700">Penanggung Jawab / Jaminan</h2>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
            <InputField label="Kode Jaminan (kd_pj)" name="kd_pj" value={form.kd_pj} onChange={handleChange} />
            <InputField label="Nama Penanggung Jawab" name="namakeluarga" value={form.namakeluarga} onChange={handleChange} />
            <InputField label="Hubungan PJ" name="keluarga" value={form.keluarga} onChange={handleChange} />
          </div>
        </div>

        {/* Tombol */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-6 py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Menyimpan...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Simpan Pasien
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
