"use client";

// Stok Opname — audit fisik per ruangan. Scan/centang aset yang ditemukan,
// simpan → tercatat mana yang Ada / Tidak Ditemukan.

import { useEffect, useState, useRef, useCallback } from "react";
import InventarisNav from "@/app/(dashboard)/inventaris/InventarisNav";
import Link from "next/link";
import {
  getInventaris, getInventarisFilters, saveOpname, getOpnameHistory,
  Inventaris, InventarisFilters, OpnameSesi,
} from "@/lib/api";

export default function OpnamePage() {
  const [filters, setFilters] = useState<InventarisFilters | null>(null);
  const [ruangan, setRuangan] = useState("");
  const [rows, setRows] = useState<Inventaris[]>([]);
  const [found, setFound] = useState<Set<number>>(new Set());
  const [petugas, setPetugas] = useState("");
  const [scan, setScan] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [hist, setHist] = useState<OpnameSesi[]>([]);
  const scanRef = useRef<HTMLInputElement>(null);

  const loadHist = useCallback(() => { getOpnameHistory().then(r => setHist(r.data)).catch(() => {}); }, []);
  useEffect(() => { getInventarisFilters().then(r => setFilters(r.data)).catch(() => {}); loadHist(); }, [loadHist]);

  useEffect(() => {
    if (!ruangan) { setRows([]); setFound(new Set()); return; }
    getInventaris({ ruangan }).then(r => { setRows(r.data); setFound(new Set()); }).catch(() => {});
    setTimeout(() => scanRef.current?.focus(), 100);
  }, [ruangan]);

  function markScan() {
    const k = scan.trim();
    if (!k) return;
    const hit = rows.find(r => (r.barcode && r.barcode.toLowerCase() === k.toLowerCase()) || r.no_label === k);
    if (hit) { setFound(s => new Set(s).add(hit.id)); setMsg({ ok: true, t: `✓ ${hit.nama_alat} ditemukan` }); }
    else setMsg({ ok: false, t: `Barcode "${k}" tidak ada di ruangan ini` });
    setScan("");
  }
  const toggle = (id: number) => setFound(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function simpan() {
    if (!ruangan || rows.length === 0) return;
    if (!confirm(`Simpan opname ${ruangan}? Ditemukan ${found.size}/${rows.length}.`)) return;
    setBusy(true); setMsg(null);
    try {
      await saveOpname({
        ruangan, petugas, tanggal: new Date().toISOString().slice(0, 10),
        items: rows.map(r => ({ inventaris_id: r.id, status: found.has(r.id) ? "Ada" : "Tidak Ditemukan" })),
      });
      setMsg({ ok: true, t: `Opname ${ruangan} tersimpan (${found.size} ada, ${rows.length - found.size} tidak ditemukan).` });
      loadHist();
    } catch { setMsg({ ok: false, t: "Gagal menyimpan (hanya admin)." }); }
    finally { setBusy(false); }
  }

  const missing = rows.length - found.size;

  return (
    <div className="p-6 space-y-5">
      <InventarisNav />
      <h1 className="text-xl font-bold text-slate-800">Stok Opname (Audit Fisik)</h1>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Ruangan</label>
          <select value={ruangan} onChange={e => setRuangan(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
            <option value="">— pilih ruangan —</option>
            {(filters?.ruangan ?? []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Petugas</label>
          <input value={petugas} onChange={e => setPetugas(e.target.value)} placeholder="Nama petugas"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Scan Barcode</label>
          <input ref={scanRef} value={scan} onChange={e => setScan(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") markScan(); }} disabled={!ruangan}
            placeholder="scan / ketik lalu Enter"
            className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-slate-50" />
        </div>
      </div>

      {msg && <div className={`text-sm px-4 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.t}</div>}

      {ruangan && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-3 text-sm">
              <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600">Total <b>{rows.length}</b></span>
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700">Ditemukan <b>{found.size}</b></span>
              <span className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700">Belum <b>{missing}</b></span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setFound(new Set(rows.map(r => r.id)))} className="px-3 py-2 text-sm text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg">Centang Semua</button>
              <button onClick={simpan} disabled={busy || rows.length === 0} className="px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-50 rounded-lg">{busy ? "Menyimpan…" : "Simpan Opname"}</button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2.5 text-left w-12">Ada</th>
                    <th className="px-3 py-2.5 text-left">Nama Alat</th>
                    <th className="px-3 py-2.5 text-left">Barcode</th>
                    <th className="px-3 py-2.5 text-left">Merk</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const ok = found.has(r.id);
                    return (
                      <tr key={r.id} className={`border-t border-slate-100 cursor-pointer ${ok ? "bg-emerald-50/50" : "hover:bg-slate-50"}`} onClick={() => toggle(r.id)}>
                        <td className="px-3 py-2"><input type="checkbox" checked={ok} onChange={() => toggle(r.id)} onClick={e => e.stopPropagation()} /></td>
                        <td className="px-3 py-2 font-medium text-slate-800">{r.nama_alat}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.barcode || "-"}</td>
                        <td className="px-3 py-2 text-slate-600">{r.merk}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs font-semibold rounded px-2 py-0.5 ${ok ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{ok ? "Ada" : "—"}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Tidak ada aset di ruangan ini.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Riwayat opname */}
      <div>
        <h2 className="font-bold text-slate-800 mb-2">Riwayat Opname</h2>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5 text-left">Tanggal</th>
                  <th className="px-4 py-2.5 text-left">Ruangan</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5 text-right">Ada</th>
                  <th className="px-4 py-2.5 text-right">Tidak</th>
                  <th className="px-4 py-2.5 text-left">Petugas</th>
                </tr>
              </thead>
              <tbody>
                {hist.map((h, i) => (
                  <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{h.tanggal ?? "-"}</td>
                    <td className="px-4 py-2 font-medium text-slate-800">{h.ruangan || "-"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">{h.total}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{h.ada}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-rose-600">{h.tidak}</td>
                    <td className="px-4 py-2 text-slate-600">{h.petugas || "-"}</td>
                  </tr>
                ))}
                {hist.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Belum ada riwayat opname.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
