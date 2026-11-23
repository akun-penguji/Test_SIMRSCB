"use client";

// Master data inventaris — Nama Alat / Ruangan / Merk / Tipe Alat (gaya SIMGPS).
// Daftar + jumlah aset + ganti nama massal.

import { useEffect, useState, useCallback } from "react";
import InventarisNav from "@/app/(dashboard)/inventaris/InventarisNav";
import { getMasterKolom, renameMaster, MasterField, InvKV } from "@/lib/api";

const TABS: { field: MasterField; label: string }[] = [
  { field: "nama_alat", label: "Nama Alat" },
  { field: "ruangan", label: "Ruangan" },
  { field: "merk", label: "Merk" },
  { field: "kategori", label: "Tipe Alat" },
];

export default function MasterPage() {
  const [tab, setTab] = useState<MasterField>("nama_alat");
  const [rows, setRows] = useState<InvKV[]>([]);
  const [q, setQ] = useState("");
  const [ren, setRen] = useState<{ from: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const load = useCallback(() => {
    getMasterKolom(tab).then(r => setRows(r.data)).catch(() => {});
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const tabLabel = TABS.find(t => t.field === tab)?.label ?? tab;

  async function simpan() {
    if (!ren || !ren.to.trim() || ren.to === ren.from) { setRen(null); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await renameMaster(tab, ren.from, ren.to.trim());
      setMsg({ ok: true, t: `Berhasil ubah "${ren.from}" → "${ren.to}" (${r.data.affected} aset).` });
      setRen(null); load();
    } catch { setMsg({ ok: false, t: "Gagal (hanya admin yang bisa mengubah)." }); }
    finally { setBusy(false); }
  }

  const filtered = rows.filter(r => !q || r.k.toLowerCase().includes(q.toLowerCase()));
  const totalAset = rows.reduce((a, b) => a + b.v, 0);

  return (
    <div className="p-6 space-y-5">
      <InventarisNav />
      <div>
        <h1 className="text-xl font-bold text-slate-800">Master Data</h1>
        <p className="text-sm text-slate-500">Rapikan penamaan — ganti nama akan memperbarui semua aset terkait.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.field} onClick={() => { setTab(t.field); setQ(""); setMsg(null); }}
            className={`px-4 py-2 text-sm font-semibold rounded-lg ${tab === t.field ? "bg-green-700 text-white" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"}`}>{t.label}</button>
        ))}
      </div>

      {msg && <div className={`text-sm px-4 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.t}</div>}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Cari ${tabLabel}…`}
          className="w-full md:w-80 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 text-left">{tabLabel}</th>
                <th className="px-4 py-2.5 text-right">Jumlah Aset</th>
                <th className="px-4 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.k} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{r.k}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">{r.v}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => { setRen({ from: r.k, to: r.k }); setMsg(null); }} className="text-xs text-green-700 hover:underline">Ganti Nama</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Tidak ada data.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">{filtered.length} {tabLabel.toLowerCase()} · {totalAset} aset</div>
      </div>

      {ren && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setRen(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-1">Ganti Nama {tabLabel}</h2>
            <p className="text-sm text-slate-500 mb-4">Semua aset dengan {tabLabel} <b>&quot;{ren.from}&quot;</b> akan diperbarui.</p>
            <label className="text-xs font-medium text-slate-600 block mb-1">Nama baru</label>
            <input autoFocus value={ren.to} onChange={e => setRen({ ...ren, to: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setRen(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg">Batal</button>
              <button onClick={simpan} disabled={busy} className="px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-50 rounded-lg">{busy ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
