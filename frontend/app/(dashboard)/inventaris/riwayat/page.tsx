"use client";

// Riwayat transaksi aset (Kalibrasi/Maintenance/Inspeksi/Mutasi/Complain) —
// meniru menu terpisah SIMGPS, difilter via ?jenis.

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import InventarisNav from "@/app/(dashboard)/inventaris/InventarisNav";
import { getInvRiwayat, InvTransaksiFull } from "@/lib/api";

const JENIS = ["", "Kalibrasi", "Maintenance", "Inspeksi", "Mutasi", "Complain"];
const badgeJenis: Record<string, string> = {
  Kalibrasi: "bg-amber-100 text-amber-700", Maintenance: "bg-blue-100 text-blue-700",
  Inspeksi: "bg-indigo-100 text-indigo-700", Mutasi: "bg-purple-100 text-purple-700",
  Complain: "bg-rose-100 text-rose-700",
};
const fmtRp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));

function RiwayatInner() {
  const sp = useSearchParams();
  const jenisUrl = sp.get("jenis") || "";
  const [jenis, setJenis] = useState(jenisUrl);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<InvTransaksiFull[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setJenis(jenisUrl); }, [jenisUrl]);

  const load = useCallback(() => {
    setLoading(true);
    getInvRiwayat({ jenis, q }).then(r => setRows(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [jenis, q]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const totalBiaya = rows.reduce((a, b) => a + (b.biaya || 0), 0);

  return (
    <div className="p-6 space-y-5">
      <InventarisNav />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-slate-800">Riwayat {jenis || "Transaksi"}</h1>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari alat/ruangan/vendor/petugas…"
          className="w-full md:w-80 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      {/* Tab jenis */}
      <div className="flex gap-1 flex-wrap">
        {JENIS.map(j => (
          <button key={j} onClick={() => setJenis(j)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg ${jenis === j ? "bg-green-700 text-white" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
            {j || "Semua"}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5 text-left">Tanggal</th>
                <th className="px-3 py-2.5 text-left">Jenis</th>
                <th className="px-3 py-2.5 text-left">Aset</th>
                <th className="px-3 py-2.5 text-left">Ruangan</th>
                <th className="px-3 py-2.5 text-left">Hasil/Status</th>
                <th className="px-3 py-2.5 text-left">Berikutnya</th>
                <th className="px-3 py-2.5 text-right">Biaya</th>
                <th className="px-3 py-2.5 text-left">Vendor/Petugas</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400">Belum ada riwayat.</td></tr>
              ) : rows.map(t => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{t.tanggal ?? "-"}</td>
                  <td className="px-3 py-2"><span className={`text-xs font-semibold rounded px-2 py-0.5 ${badgeJenis[t.jenis] ?? "bg-slate-100 text-slate-600"}`}>{t.jenis}</span></td>
                  <td className="px-3 py-2"><Link href={`/inventaris/${t.inventaris_id}`} className="font-medium text-green-700 hover:underline">{t.nama_alat || `#${t.inventaris_id}`}</Link>
                    {t.barcode && <div className="text-[11px] font-mono text-slate-400">{t.barcode}</div>}</td>
                  <td className="px-3 py-2 text-slate-600">{t.ruangan || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{t.hasil || "-"}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{t.tanggal_berikut ?? "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{t.biaya > 0 ? fmtRp(t.biaya) : "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{[t.vendor, t.petugas].filter(Boolean).join(" / ") || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100 flex justify-between">
          <span>{rows.length} riwayat</span>
          {totalBiaya > 0 && <span>Total biaya: {fmtRp(totalBiaya)}</span>}
        </div>
      </div>
    </div>
  );
}

export default function RiwayatPage() {
  return <Suspense fallback={<div className="p-6 text-slate-400">Memuat…</div>}><RiwayatInner /></Suspense>;
}
