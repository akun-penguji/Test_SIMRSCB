"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLaporanStokMinimum, StokMinimumResp } from "@/lib/api";

export default function DirekturFarmasiPage() {
  const [data, setData] = useState<StokMinimumResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLaporanStokMinimum({ ratio: 1.5 })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-slate-500 py-20">Memuat...</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-green-700 font-semibold">Farmasi</p>
        <h1 className="text-2xl font-bold text-slate-800">Ringkasan Stok & Pengadaan</h1>
      </div>

      {/* Alert critical */}
      <div className="bg-gradient-to-br from-rose-500/20 to-rose-700/10 border border-rose-500/30 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-rose-700 font-semibold mb-1">Alert Stok Minimum</p>
            <p className="text-5xl font-black text-slate-800">{data?.total_critical ?? 0}</p>
            <p className="text-sm text-rose-700 mt-2">obat di bawah/mentok stok minimum</p>
            <p className="text-xs text-slate-500 mt-1">+{data?.total_warning ?? 0} mendekati minimum (warning)</p>
          </div>
          <Link href="/laporan/farmasi/stok-minimum"
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium transition shrink-0">
            Lihat Detail →
          </Link>
        </div>
      </div>

      {/* Top critical preview */}
      {(data?.critical?.length ?? 0) > 0 && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold mb-3">Top 15 Critical — Perlu Pengadaan Segera</p>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left py-2">Obat</th>
                <th className="text-left py-2">Depo</th>
                <th className="text-right py-2 w-24">Minimal</th>
                <th className="text-right py-2 w-24">Stok</th>
                <th className="text-right py-2 w-24">Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data!.critical.slice(0, 15).map((r, i) => (
                <tr key={i}>
                  <td className="py-2 text-slate-700 truncate max-w-xs">{r.nama_brng}</td>
                  <td className="py-2 text-slate-400">{r.nm_bangsal}</td>
                  <td className="py-2 text-right text-slate-400 tabular-nums">{r.stok_minimal.toFixed(0)}</td>
                  <td className="py-2 text-right text-rose-700 font-bold tabular-nums">{r.stok_saat_ini.toFixed(0)}</td>
                  <td className="py-2 text-right text-rose-400 font-bold tabular-nums">{r.selisih.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 shadow-sm border-dashed rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">Slow Moving (Coming Soon)</p>
          <p className="text-sm text-slate-500">Obat dengan turnover lambat — risiko expired & deadstock.</p>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm border-dashed rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">Kepatuhan Fornas (Coming Soon)</p>
          <p className="text-sm text-slate-500">Persentase resep yang sesuai Formularium Nasional.</p>
        </div>
      </div>
    </div>
  );
}
