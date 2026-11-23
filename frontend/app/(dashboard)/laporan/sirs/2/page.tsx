"use client";
import MicButton from "@/components/MicButton";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getSirsRl2, editSirsRl2Meta, cetakSirsRl2,
  Rl2Meta, Rl2Resp, GroupCount,
} from "@/lib/api";

export default function Rl2Page() {
  const [data, setData] = useState<Rl2Resp | null>(null);
  const [meta, setMeta] = useState<Rl2Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl2().then(r => {
      setData(r.data);
      setMeta(r.data.meta);
    }).catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const upd = <K extends keyof Rl2Meta>(k: K, v: Rl2Meta[K]) =>
    setMeta(m => ({ ...(m || {}), [k]: v }));

  const handleSave = async () => {
    setSaving(true); setErrMsg("");
    try {
      await editSirsRl2Meta(meta || {});
      setOkMsg("Metadata tersimpan");
      setTimeout(() => setOkMsg(""), 2500);
      reload();
    } catch { setErrMsg("Gagal simpan"); }
    finally { setSaving(false); }
  };

  const handleCetak = async () => {
    try { await cetakSirsRl2(); }
    catch { setErrMsg("Gagal cetak"); }
  };

  if (loading) return <div className="p-6 text-center text-slate-400 text-sm">Memuat...</div>;
  if (!data) return <div className="p-6 text-center text-red-600">{errMsg || "Data kosong"}</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <Link href="/laporan/sirs" className="text-xs text-slate-500 hover:text-green-700">
          ← Laporan SIRS 6.3
        </Link>
        <div className="flex items-start gap-3 mt-2">
          <span className="font-mono text-lg font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded">
            RL 2
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800 leading-tight">Data Ketenagaan yang Bekerja di Rumah Sakit</h1>
            <p className="text-xs text-slate-500 mt-1">
              Pelaporan via <span className="font-medium">SISDMK eksternal</span> · Ringkasan realtime dari Khanza
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

      {/* SISDMK link box */}
      <div className="bg-violet-50 border-2 border-dashed border-violet-400 rounded-2xl p-5 mb-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl">🔗</span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-violet-900">Pelaporan via SISDMK</h2>
            <p className="text-sm text-violet-800 mt-1">
              Per JUKNIS SIRS 6.3, data ketenagaan dilaporkan melalui <strong>SISDMK</strong> (Sistem Informasi Sumber Daya Manusia Kesehatan).
            </p>
            <a href={meta?.sisdmk_url || "https://sisdmk.kemkes.go.id/login"}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium">
              Buka SISDMK →
            </a>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Stat label="Total Aktif" value={data.total_aktif} color="text-emerald-700" />
        <Stat label="Cuti" value={data.total_cuti} color="text-amber-700" />
        <Stat label="Keluar" value={data.total_keluar} color="text-slate-600" />
        <Stat label="Pria" value={data.total_pria} color="text-blue-700" />
        <Stat label="Wanita" value={data.total_wanita} color="text-pink-700" />
      </div>

      {/* Meta form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3">PIC & Sync SISDMK</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          <Field label="Nama PIC">
            <input value={meta?.pic_nama ?? ""} onChange={(e) => upd("pic_nama", e.target.value)} className="inp" />
          </Field>
          <Field label="NIK PIC">
            <input value={meta?.pic_nik ?? ""} onChange={(e) => upd("pic_nik", e.target.value)} className="inp" />
          </Field>
          <Field label="Email PIC">
            <input type="email" value={meta?.pic_email ?? ""} onChange={(e) => upd("pic_email", e.target.value)} className="inp" />
          </Field>
          <Field label="Telp/WA PIC">
            <input value={meta?.pic_telp ?? ""} onChange={(e) => upd("pic_telp", e.target.value)} className="inp" />
          </Field>
          <Field label="Jabatan PIC" span>
            <input value={meta?.pic_jabatan ?? ""} onChange={(e) => upd("pic_jabatan", e.target.value)} className="inp" />
          </Field>
          <Field label="URL SISDMK">
            <input value={meta?.sisdmk_url ?? ""} onChange={(e) => upd("sisdmk_url", e.target.value)} className="inp" />
          </Field>
          <Field label="Terakhir Sync ke SISDMK">
            <input type="date" value={meta?.terakhir_sync ?? ""} onChange={(e) => upd("terakhir_sync", e.target.value)} className="inp" />
          </Field>
          <Field label="Total Pegawai di SISDMK">
            <input type="number" min={0} value={meta?.total_di_sisdmk ?? ""}
              onChange={(e) => upd("total_di_sisdmk", e.target.value === "" ? null : parseInt(e.target.value, 10))}
              className="inp" />
            {meta?.total_di_sisdmk != null && Math.abs((meta.total_di_sisdmk || 0) - data.total_aktif) > 0 && (
              <p className="text-[11px] text-amber-700 mt-1">
                ⚠️ Selisih dengan Khanza aktif: {Math.abs((meta.total_di_sisdmk || 0) - data.total_aktif)} orang
              </p>
            )}
          </Field>
          <Field label="Catatan" span>
            <div className="relative">
              <textarea rows={2} value={meta?.catatan ?? ""}
                onChange={(e) => upd("catatan", e.target.value)} className="inp pr-8" />
              <MicButton value={meta?.catatan ?? ""} onChange={v => upd("catatan", v)} className="absolute right-1.5 bottom-1.5" />
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-3 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-400 flex-1">
            {meta?.updated_at && `Terakhir diubah ${meta.updated_at}${meta.updated_by ? ` oleh ${meta.updated_by}` : ""}`}
          </p>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 text-white text-sm font-medium">
            {saving ? "Menyimpan..." : "Simpan Metadata"}
          </button>
        </div>
      </div>

      {/* Realtime breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BreakdownTable title="Per Pendidikan (top 15)" rows={data.per_pendidikan} color="emerald" />
        <BreakdownTable title="Per Departemen (top 15)" rows={data.per_departemen} color="blue" />
        <BreakdownTable title="Per Jabatan (top 15, exclude '-')" rows={data.per_jabatan} color="amber" />
        <BreakdownTable title="Per Status Kerja" rows={data.per_status_kerja} color="violet" />
      </div>

      <p className="mt-4 text-[11px] text-slate-400 italic">
        Ringkasan di-generate realtime dari tabel pegawai Khanza (filter stts_aktif=AKTIF). Pelaporan resmi ke Kemenkes tetap via SISDMK.
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

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function BreakdownTable({ title, rows, color }: { title: string; rows: GroupCount[]; color: string }) {
  const max = Math.max(...rows.map(r => r.jml), 1);
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500",
    blue:    "bg-blue-500",
    amber:   "bg-amber-500",
    violet:  "bg-violet-500",
  };
  const barColor = colorMap[color] || "bg-slate-500";
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="text-sm font-bold text-slate-800 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Tidak ada data.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-mono w-5 text-right">{i + 1}.</span>
              <span className="text-slate-700 flex-1 truncate">{r.label}</span>
              <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className={`h-full ${barColor}`} style={{ width: `${(r.jml / max) * 100}%` }} />
              </div>
              <span className="text-slate-900 font-mono font-bold w-10 text-right">{r.jml}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
