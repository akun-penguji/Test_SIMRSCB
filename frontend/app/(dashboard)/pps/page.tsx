"use client";

// PPS — Perencanaan Perbaikan Strategis (per EP STARKES).

import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import { getPps, createPps, updatePps, deletePps, getPpsRekap, Pps, PpsRekap } from "@/lib/api";

const STATUS: Record<string, string> = { belum: "bg-amber-100 text-amber-700", proses: "bg-blue-100 text-blue-700", tercapai: "bg-green-100 text-green-700" };

export default function PpsPage() {
  const isEdit = hasPerm("akreditasi_edit");
  const [rows, setRows] = useState<Pps[]>([]);
  const [rekap, setRekap] = useState<PpsRekap | null>(null);
  const [bab, setBab] = useState(""); const [status, setStatus] = useState(""); const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Partial<Pps> | null>(null);
  const load = useCallback(() => {
    getPps({ bab, status, q }).then(r => setRows(r.data)).catch(() => {});
    getPpsRekap().then(r => setRekap(r.data)).catch(() => {});
  }, [bab, status, q]);
  useEffect(() => { load(); }, [load]);
  async function hapus(id: number) { if (!confirm("Hapus PPS ini?")) return; await deletePps(id); load(); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">🎯 PPS — Perencanaan Perbaikan Strategis</h1>
          <p className="text-sm text-slate-500">Rencana perbaikan per rekomendasi EP STARKES + progres.</p>
        </div>
        {isEdit && <button onClick={() => setEdit({ status: "belum", progres: 0 })} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700">+ Tambah PPS</button>}
      </div>

      {rekap && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[["Total", rekap.total, "text-slate-700"], ["Tercapai", rekap.tercapai, "text-green-600"], ["Belum tercapai", rekap.total - rekap.tercapai, "text-amber-600"], ["Rata² progres", `${Math.round(rekap.avg_progres)}%`, "text-blue-600"]].map(([l, v, c], i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-xs text-slate-500">{l}</div><div className={`text-2xl font-bold ${c}`}>{v}</div></div>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari EP / rekomendasi…" className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px]" />
        <input value={bab} onChange={e => setBab(e.target.value)} placeholder="Bab (mis. PP)" className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm w-32" />
        <select value={status} onChange={e => setStatus(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Semua status</option><option value="belum">Belum</option><option value="proses">Proses</option><option value="tercapai">Tercapai</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left"><tr>
            <th className="px-3 py-2">EP / Bab</th><th className="px-3 py-2">Langkah Pemenuhan</th><th className="px-3 py-2">PIC</th>
            <th className="px-3 py-2">Target</th><th className="px-3 py-2">Progres</th><th className="px-3 py-2">Status</th>{isEdit && <th></th>}
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2"><span className="font-mono text-xs">{r.kd_ep || r.bab || "-"}</span></td>
                <td className="px-3 py-2 max-w-[320px]"><div className="truncate" title={r.langkah_pemenuhan}>{r.langkah_pemenuhan || r.rekomendasi || "-"}</div></td>
                <td className="px-3 py-2 text-slate-500">{r.pic || "-"}</td>
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.waktu_target || "-"}</td>
                <td className="px-3 py-2"><div className="w-24 bg-slate-100 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${r.progres}%` }} /></div><span className="text-xs text-slate-400">{r.progres}%</span></td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs ${STATUS[r.status] || ""}`}>{r.status}</span></td>
                {isEdit && <td className="px-3 py-2 whitespace-nowrap text-xs space-x-2"><button onClick={() => setEdit(r)} className="text-green-700 hover:underline">edit</button><button onClick={() => hapus(r.id)} className="text-slate-400 hover:text-red-600">hapus</button></td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Belum ada PPS.</td></tr>}
          </tbody>
        </table>
      </div>

      {edit && <FormPps init={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function FormPps({ init, onClose, onSaved }: { init: Partial<Pps>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<Pps>>(init);
  const set = (k: keyof Pps, v: string | number) => setF(p => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);
  async function simpan() {
    setBusy(true);
    try { if (f.id) await updatePps(f.id, f); else await createPps(f); onSaved(); } catch { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between px-5 py-3 border-b border-slate-200"><h3 className="font-semibold">{f.id ? "Edit" : "Tambah"} PPS</h3><button onClick={onClose} className="text-slate-400 text-xl">×</button></div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={f.kd_ep || ""} onChange={e => set("kd_ep", e.target.value)} placeholder="Kode EP (mis. PP.1.1.a)" className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
            <input value={f.bab || ""} onChange={e => set("bab", e.target.value)} placeholder="Bab (auto dari EP)" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <textarea value={f.rekomendasi || ""} onChange={e => set("rekomendasi", e.target.value)} rows={2} placeholder="Rekomendasi / temuan surveior" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <textarea value={f.langkah_pemenuhan || ""} onChange={e => set("langkah_pemenuhan", e.target.value)} rows={2} placeholder="Langkah pemenuhan EP" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={f.metode || ""} onChange={e => set("metode", e.target.value)} placeholder="Metode perbaikan" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <input value={f.indikator_pencapaian || ""} onChange={e => set("indikator_pencapaian", e.target.value)} placeholder="Indikator pencapaian" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input value={f.pic || ""} onChange={e => set("pic", e.target.value)} placeholder="PIC" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={f.waktu_target || ""} onChange={e => set("waktu_target", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <input value={f.sasaran || ""} onChange={e => set("sasaran", e.target.value)} placeholder="Sasaran" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2 items-center">
            <select value={f.status} onChange={e => set("status", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm"><option value="belum">Belum</option><option value="proses">Proses</option><option value="tercapai">Tercapai</option></select>
            <label className="text-sm flex items-center gap-2">Progres <input type="number" min={0} max={100} value={f.progres ?? 0} onChange={e => set("progres", Number(e.target.value))} className="w-20 border border-slate-300 rounded px-2 py-1" />%</label>
          </div>
          <div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-slate-100">Batal</button><button onClick={simpan} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white">{busy ? "…" : "Simpan"}</button></div>
        </div>
      </div>
    </div>
  );
}
