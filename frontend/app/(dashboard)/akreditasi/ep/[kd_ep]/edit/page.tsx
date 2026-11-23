"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { akreditasiGetEp, akreditasiEditEp, AkreditasiEp } from "@/lib/api";
import MicButton from "@/components/MicButton";

const JENIS_BUKTI_OPTS = [
  { code: "R", label: "Regulasi" },
  { code: "D", label: "Dokumen bukti" },
  { code: "O", label: "Observasi" },
  { code: "W", label: "Wawancara" },
  { code: "S", label: "Simulasi" },
];

interface Form {
  nama_standar:      string;
  maksud_tujuan:     string;
  deskripsi:         string;
  kelengkapan_bukti: string;
  jenis_bukti:       Set<string>;
  bobot:             number;
  prioritas:         number;
  kategori_bukti:    string;
  status:            "aktif" | "non-aktif";
}

export default function EditEpPage() {
  const params = useParams();
  const router = useRouter();
  const kd_ep = decodeURIComponent(params.kd_ep as string);

  const [origin, setOrigin] = useState<AkreditasiEp | null>(null);
  const [form, setForm]     = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");

  useEffect(() => {
    setLoading(true); setErrMsg("");
    akreditasiGetEp(kd_ep).then(r => {
      const e = r.data;
      setOrigin(e);
      setForm({
        nama_standar:      e.nama_standar || "",
        maksud_tujuan:     e.maksud_tujuan || "",
        deskripsi:         e.deskripsi,
        kelengkapan_bukti: e.kelengkapan_bukti || "",
        jenis_bukti:       new Set((e.jenis_bukti || "").split(",").map(s => s.trim()).filter(Boolean)),
        bobot:             e.bobot,
        prioritas:         e.prioritas,
        kategori_bukti:    e.kategori_bukti || "",
        status:            (e.status === "non-aktif" ? "non-aktif" : "aktif") as Form["status"],
      });
    }).catch(() => setErrMsg("EP tidak ditemukan"))
      .finally(() => setLoading(false));
  }, [kd_ep]);

  const toggleBukti = (code: string) => {
    setForm(f => {
      if (!f) return f;
      const next = new Set(f.jenis_bukti);
      next.has(code) ? next.delete(code) : next.add(code);
      return { ...f, jenis_bukti: next };
    });
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true); setErrMsg(""); setOkMsg("");
    try {
      await akreditasiEditEp(kd_ep, {
        nama_standar:      form.nama_standar.trim() || undefined,
        maksud_tujuan:     form.maksud_tujuan.trim() || undefined,
        deskripsi:         form.deskripsi.trim() || undefined,
        kelengkapan_bukti: form.kelengkapan_bukti.trim() || undefined,
        jenis_bukti:       Array.from(form.jenis_bukti).sort().join(",") || undefined,
        bobot:             form.bobot,
        prioritas:         form.prioritas,
        kategori_bukti:    form.kategori_bukti.trim() || undefined,
        status:            form.status,
      });
      setSaving(false);
      setOkMsg("Tersimpan");
      setTimeout(() => router.push(`/akreditasi/ep/${encodeURIComponent(kd_ep)}`), 800);
    } catch (e: unknown) {
      setSaving(false);
      setErrMsg(e instanceof Error ? e.message : "Gagal simpan");
    }
  };

  if (loading) return <div className="p-6 text-center text-slate-400 text-sm">Memuat...</div>;
  if (!form || !origin) return <div className="p-6 text-center text-red-500 text-sm">{errMsg || "EP tidak ditemukan"}</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/akreditasi/ep/${encodeURIComponent(kd_ep)}`}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-800">Edit EP</h1>
          <p className="text-xs text-slate-500 font-mono">{origin.kd_ep} — {origin.bab} • {origin.standar}</p>
        </div>
        {origin.sumber_seed === "47104-parser" && (
          <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-lg">
            ⚠️ Hasil parser otomatis — perlu review
          </span>
        )}
      </div>

      {errMsg && <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm">{errMsg}</div>}
      {okMsg  && <div className="mb-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-green-800 text-sm">{okMsg}</div>}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <Field label="Judul Standar (nama_standar)" hint="Judul singkat dari standar (1 kalimat). Boleh kosong.">
          <input value={form.nama_standar}
            onChange={(e) => setForm(f => f ? { ...f, nama_standar: e.target.value } : f)}
            placeholder="mis. Struktur organisasi serta wewenang representasi pemilik..."
            className="inp" />
        </Field>

        <Field label="Maksud & Tujuan Standar" hint="Penjelasan latar belakang standar dari instrumen 47104.">
          <div className="relative">
            <textarea rows={6} value={form.maksud_tujuan}
              onChange={(e) => setForm(f => f ? { ...f, maksud_tujuan: e.target.value } : f)}
              className="inp pr-8" />
            <MicButton value={form.maksud_tujuan} onChange={v => setForm(f => f ? { ...f, maksud_tujuan: v } : f)} className="absolute right-1.5 bottom-1.5" />
          </div>
        </Field>

        <hr/>

        <Field label="Deskripsi EP" hint="Teks elemen penilaian (kolom 'Elemen Penilaian' di instrumen).">
          <div className="relative">
            <textarea rows={4} value={form.deskripsi}
              onChange={(e) => setForm(f => f ? { ...f, deskripsi: e.target.value } : f)}
              className="inp pr-8" required />
            <MicButton value={form.deskripsi} onChange={v => setForm(f => f ? { ...f, deskripsi: v } : f)} className="absolute right-1.5 bottom-1.5" />
          </div>
        </Field>

        <Field label="Kelengkapan Bukti" hint="Apa yang harus disiapkan RS (kolom 'Kelengkapan Bukti' di instrumen).">
          <div className="relative">
            <textarea rows={4} value={form.kelengkapan_bukti}
              onChange={(e) => setForm(f => f ? { ...f, kelengkapan_bukti: e.target.value } : f)}
              className="inp pr-8" />
            <MicButton value={form.kelengkapan_bukti} onChange={v => setForm(f => f ? { ...f, kelengkapan_bukti: v } : f)} className="absolute right-1.5 bottom-1.5" />
          </div>
        </Field>

        <Field label="Jenis Bukti (R/D/O/W/S — boleh multi)">
          <div className="flex flex-wrap gap-3 pt-1">
            {JENIS_BUKTI_OPTS.map(opt => (
              <label key={opt.code} className="flex items-center gap-2 cursor-pointer text-sm text-slate-900">
                <input type="checkbox" checked={form.jenis_bukti.has(opt.code)}
                  onChange={() => toggleBukti(opt.code)}
                  className="accent-green-700" />
                <span><span className="font-bold font-mono">{opt.code}</span> — {opt.label}</span>
              </label>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Bobot">
            <input type="number" min={1} max={10} value={form.bobot}
              onChange={(e) => setForm(f => f ? { ...f, bobot: parseInt(e.target.value || "10", 10) } : f)}
              className="inp" />
          </Field>
          <Field label="Prioritas (1=critical, 5=low)">
            <input type="number" min={1} max={5} value={form.prioritas}
              onChange={(e) => setForm(f => f ? { ...f, prioritas: parseInt(e.target.value || "3", 10) } : f)}
              className="inp" />
          </Field>
          <Field label="Status">
            <select value={form.status}
              onChange={(e) => setForm(f => f ? { ...f, status: e.target.value as Form["status"] } : f)}
              className="inp">
              <option value="aktif">aktif</option>
              <option value="non-aktif">non-aktif</option>
            </select>
          </Field>
        </div>

        <Field label="Kategori Bukti (opsional)" hint="mis. consent, asesmen, log, sop, laporan">
          <input value={form.kategori_bukti}
            onChange={(e) => setForm(f => f ? { ...f, kategori_bukti: e.target.value } : f)}
            className="inp" />
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Link href={`/akreditasi/ep/${encodeURIComponent(kd_ep)}`}
            className="px-4 py-2 rounded-xl border border-slate-300 text-sm text-slate-700 hover:bg-slate-50">
            Batal
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl bg-green-700 hover:bg-green-800 disabled:bg-slate-400 text-white text-sm font-medium">
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>

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
        :global(.inp:focus) { outline: none; border-color: rgb(22 163 74); box-shadow: 0 0 0 1px rgb(22 163 74); }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-600 font-semibold block mb-1">{label}</label>
      {hint && <p className="text-[11px] text-slate-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}
