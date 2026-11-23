"use client";

// Kondisi Aset (gaya SIMGPS) — filter per kondisi Baik/Rusak Ringan/Rusak Berat.

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import InventarisNav from "@/app/(dashboard)/inventaris/InventarisNav";
import { getInventaris, Inventaris } from "@/lib/api";

const KOND = ["", "Baik", "Rusak Ringan", "Rusak Berat"];
const kondCls = (k: string) => k === "Baik" ? "bg-emerald-100 text-emerald-700"
  : k === "Rusak Ringan" ? "bg-amber-100 text-amber-700"
  : k === "Rusak Berat" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500";

export default function KondisiPage() {
  const [all, setAll] = useState<Inventaris[]>([]);
  const [kond, setKond] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInventaris().then(r => setAll(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    all.forEach(r => { c[r.kondisi || "-"] = (c[r.kondisi || "-"] || 0) + 1; });
    return c;
  }, [all]);

  const rows = all.filter(r =>
    (!kond || r.kondisi === kond) &&
    (!q || r.nama_alat.toLowerCase().includes(q.toLowerCase()) || (r.barcode || "").includes(q) || (r.ruangan || "").toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="p-6 space-y-5">
      <InventarisNav />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-slate-800">Kondisi Aset</h1>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama/barcode/ruangan…"
          className="w-full md:w-80 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <div className="flex gap-1 flex-wrap">
        {KOND.map(k => (
          <button key={k} onClick={() => setKond(k)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg ${kond === k ? "bg-green-700 text-white" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
            {k || "Semua"} {k && counts[k] ? `(${counts[k]})` : ""}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5 text-left">Nama Alat</th>
                <th className="px-3 py-2.5 text-left">Barcode</th>
                <th className="px-3 py-2.5 text-left">Merk</th>
                <th className="px-3 py-2.5 text-left">Ruangan</th>
                <th className="px-3 py-2.5 text-center">Kondisi</th>
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">Tidak ada data.</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2"><Link href={`/inventaris/${r.id}`} className="font-medium text-green-700 hover:underline">{r.nama_alat}</Link></td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.barcode || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{r.merk || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{r.ruangan || "-"}</td>
                  <td className="px-3 py-2 text-center"><span className={`text-xs font-semibold rounded px-2 py-0.5 ${kondCls(r.kondisi)}`}>{r.kondisi || "—"}</span></td>
                  <td className="px-3 py-2 text-center"><span className={`text-xs font-semibold rounded px-2 py-0.5 ${r.status_laik === "Laik" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{r.status_laik || "-"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100">{rows.length} aset</div>
      </div>
    </div>
  );
}
