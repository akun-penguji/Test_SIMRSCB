"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPasienDetail, editPasien, PasienDetail } from "@/lib/api";
import MicButton from "@/components/MicButton";

function formatTgl(tgl?: string): string {
  if (!tgl) return "-";
  const parts = tgl.split("-");
  if (parts.length !== 3) return tgl;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function hitungUsia(tgl?: string): string {
  if (!tgl) return "";
  const diff = Date.now() - new Date(tgl).getTime();
  const age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return `${age} tahun`;
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm text-slate-800 font-medium">{value || "-"}</p>
    </div>
  );
}

function InputField({
  label, name, value, onChange, type = "text",
}: {
  label: string; name: string; value: string;
  onChange: (n: string, v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
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
  label, name, value, onChange, options,
}: {
  label: string; name: string; value: string;
  onChange: (n: string, v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
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

export default function PasienDetailPage() {
  const params = useParams();
  const router = useRouter();
  const no_rm = decodeURIComponent(params.no_rm as string);

  const [pasien, setPasien] = useState<PasienDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    getPasienDetail(no_rm)
      .then((r) => {
        setPasien(r.data);
        setForm({
          nm_pasien: r.data.nm_pasien ?? "",
          tgl_lahir: r.data.tgl_lahir ?? "",
          jk: r.data.jk ?? "L",
          tmp_lahir: (r.data as any).tmp_lahir ?? "",
          agama: r.data.agama ?? "",
          pendidikan: r.data.pendidikan ?? "-",
          pekerjaan: r.data.pekerjaan ?? "",
          gol_darah: r.data.gol_darah ?? "-",
          stts_nikah: (r.data as any).stts_nikah ?? "BELUM MENIKAH",
          nm_ibu: (r.data as any).nm_ibu ?? "",
          no_tlp: r.data.no_tlp ?? "",
          no_ktp: r.data.no_ktp ?? "",
          no_peserta: (r.data as any).no_peserta ?? "",
          email: (r.data as any).email ?? "",
          alamat: r.data.alamat ?? "",
          namakeluarga: (r.data as any).namakeluarga ?? r.data.nama_pj ?? "",
          keluarga: (r.data as any).keluarga ?? r.data.hub_pj ?? "",
          kd_pj: r.data.kd_pj ?? "A01",
        });
      })
      .catch(() => setError("Pasien tidak ditemukan"))
      .finally(() => setLoading(false));
  }, [no_rm]);

  function handleChange(name: string, value: string) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await editPasien(no_rm, {
        nm_pasien: form.nm_pasien,
        tgl_lahir: form.tgl_lahir || undefined,
        jk: form.jk,
        tmp_lahir: form.tmp_lahir || undefined,
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
      // Reload
      const r = await getPasienDetail(no_rm);
      setPasien(r.data);
      setEditMode(false);
      setSuccessMsg("Data pasien berhasil disimpan");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch {
      setError("Gagal menyimpan data pasien");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-20 justify-center">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Memuat data pasien...
      </div>
    );
  }

  if (error && !pasien) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      </div>
    );
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
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">{pasien?.nm_pasien}</h1>
          <p className="text-sm text-slate-500 mt-0.5 font-mono">{no_rm}</p>
        </div>
        {!editMode ? (
          <button
            onClick={() => setEditMode(true)}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { setEditMode(false); setError(""); }}
              className="px-4 py-2 text-sm border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {saving ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              Simpan
            </button>
          </div>
        )}
      </div>

      {/* Notif */}
      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMsg}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>
      )}

      {/* VIEW MODE */}
      {!editMode && pasien && (
        <div className="space-y-4">
          {/* Identitas Utama */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
              <h2 className="text-sm font-semibold text-slate-700">Identitas Pasien</h2>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-5">
              <Field label="No. Rekam Medis" value={pasien.no_rm} />
              <Field label="Nama Pasien" value={pasien.nm_pasien} />
              <Field label="Jenis Kelamin" value={pasien.jk === "L" ? "Laki-laki" : pasien.jk === "P" ? "Perempuan" : "-"} />
              <Field
                label="Tanggal Lahir"
                value={pasien.tgl_lahir ? `${formatTgl(pasien.tgl_lahir)} (${hitungUsia(pasien.tgl_lahir)})` : "-"}
              />
              <Field label="No. KTP" value={pasien.no_ktp} />
              <Field label="No. Telpon" value={pasien.no_tlp} />
              <Field label="Agama" value={pasien.agama} />
              <Field label="Pendidikan" value={pasien.pendidikan} />
              <Field label="Pekerjaan" value={pasien.pekerjaan} />
              <Field label="Gol. Darah" value={pasien.gol_darah} />
              <Field label="Tanggal Daftar" value={formatTgl(pasien.tgl_daftar)} />
            </div>
          </div>

          {/* Alamat */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
              <h2 className="text-sm font-semibold text-slate-700">Alamat</h2>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-5">
              <div className="col-span-2 md:col-span-3">
                <Field label="Alamat" value={pasien.alamat} />
              </div>
              <Field label="Kelurahan" value={pasien.nm_kel} />
              <Field label="Kecamatan" value={pasien.nm_kec} />
              <Field label="Kabupaten/Kota" value={pasien.nm_kab} />
            </div>
          </div>

          {/* Penanggung Jawab */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
              <h2 className="text-sm font-semibold text-slate-700">Penanggung Jawab</h2>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-5">
              <Field label="Jaminan / Cara Bayar" value={pasien.kd_pj} />
              <Field label="Nama PJ" value={pasien.nama_pj} />
              <Field label="Hubungan PJ" value={pasien.hub_pj} />
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODE */}
      {editMode && (
        <div className="space-y-4">
          {/* Identitas Utama */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
              <h2 className="text-sm font-semibold text-slate-700">Identitas Pasien</h2>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2 md:col-span-2">
                <InputField label="Nama Pasien *" name="nm_pasien" value={form.nm_pasien} onChange={handleChange} />
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
              <InputField label="No. KTP" name="no_ktp" value={form.no_ktp} onChange={handleChange} />
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
              <div>
                <label className="block text-xs text-slate-500 mb-1">Alamat</label>
                <div className="relative">
                  <textarea
                    value={form.alamat}
                    onChange={(e) => handleChange("alamat", e.target.value)}
                    rows={2}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm bg-white
                               focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  />
                  <MicButton value={form.alamat} onChange={v => handleChange("alamat", v)} className="absolute right-1.5 bottom-1.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Penanggung Jawab */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
              <h2 className="text-sm font-semibold text-slate-700">Penanggung Jawab</h2>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
              <InputField label="Kode Jaminan (kd_pj)" name="kd_pj" value={form.kd_pj} onChange={handleChange} />
              <InputField label="Nama Penanggung Jawab" name="namakeluarga" value={form.namakeluarga} onChange={handleChange} />
              <InputField label="Hubungan PJ" name="keluarga" value={form.keluarga} onChange={handleChange} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
