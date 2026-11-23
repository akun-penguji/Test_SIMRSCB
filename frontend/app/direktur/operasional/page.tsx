"use client";

import { useEffect, useState } from "react";
import { direkturOperasional, DirekturOperasional } from "@/lib/api";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

function TopList({ title, items, color = "amber" }: {
  title: string;
  items: { kode: string; nama: string; jumlah: number }[];
  color?: string;
}) {
  const max = Math.max(1, ...items.map(i => i.jumlah));
  const colorMap: Record<string, string> = {
    amber:   "from-amber-500 to-amber-700",
    blue:    "from-blue-500 to-blue-700",
    emerald: "from-emerald-500 to-emerald-700",
    violet:  "from-violet-500 to-violet-700",
    rose:    "from-rose-500 to-rose-700",
  };
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
      <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold mb-3">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 italic">Tidak ada data.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((it, i) => {
            const pct = (it.jumlah / max) * 100;
            return (
              <li key={i} className="text-sm">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-slate-700 truncate flex-1">
                    <span className="text-slate-500 mr-2">{i + 1}.</span>{it.nama}
                  </span>
                  <span className="text-amber-700 font-bold tabular-nums">{fmt(it.jumlah)}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${colorMap[color]}`} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default function DirekturOperasionalPage() {
  const [data, setData] = useState<DirekturOperasional | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    direkturOperasional().then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-slate-500 py-20">Memuat...</div>;
  if (!data)   return <div className="text-center text-rose-600 py-20">Gagal memuat.</div>;

  const maxTotal = Math.max(1, ...data.trend_12_bulan.map(b => b.rajal + b.igd + b.ranap));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-green-700 font-semibold">Operasional</p>
        <h1 className="text-2xl font-bold text-slate-800">Trend Pelayanan & Top 10 Klinis</h1>
      </div>

      {/* Trend 12 bulan stacked bars */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold">Trend Kunjungan 12 Bulan</p>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-500" />Rajal</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-500" />IGD</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-violet-500" />Ranap</span>
          </div>
        </div>
        <div className="flex items-end gap-2 h-48">
          {data.trend_12_bulan.map((b, i) => {
            const total = b.rajal + b.igd + b.ranap;
            const h = (total / maxTotal) * 100;
            const rajalH  = total > 0 ? (b.rajal / total) * 100 : 0;
            const igdH    = total > 0 ? (b.igd / total) * 100 : 0;
            const ranapH  = total > 0 ? (b.ranap / total) * 100 : 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center group relative">
                <div className="w-full rounded-t overflow-hidden flex flex-col-reverse"
                  style={{ height: `${Math.max(h, 4)}%` }}>
                  <div className="bg-sky-500" style={{ height: `${rajalH}%` }} />
                  <div className="bg-rose-500" style={{ height: `${igdH}%` }} />
                  <div className="bg-violet-500" style={{ height: `${ranapH}%` }} />
                </div>
                <div className="text-[10px] text-slate-500 mt-2 -rotate-45 origin-top-left whitespace-nowrap">{b.bulan}</div>
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded p-1.5 text-[10px] opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                  <div className="font-semibold">{b.bulan}</div>
                  <div className="text-sky-400">Rajal: {fmt(b.rajal)}</div>
                  <div className="text-rose-400">IGD: {fmt(b.igd)}</div>
                  <div className="text-violet-400">Ranap: {fmt(b.ranap)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TopList title="Top 10 Diagnosa (90 hari)"  items={data.top_diagnosa}   color="blue" />
        <TopList title="Top 10 Obat (30 hari)"      items={data.top_obat}       color="emerald" />
        <TopList title="Top 10 Tindakan (30 hari)"  items={data.top_tindakan}   color="violet" />
        <TopList title="Pelayanan per Poli (30 hari)" items={data.pelayanan_poli} color="amber" />
      </div>

      {/* BOR per bangsal */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
        <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold mb-3">BOR per Bangsal (Top 20)</p>
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-200">
            <tr>
              <th className="text-left py-2">Bangsal</th>
              <th className="text-right py-2 w-24">Kapasitas</th>
              <th className="text-right py-2 w-20">Terisi</th>
              <th className="text-right py-2 w-32">BOR %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.bor_bangsal.map((b, i) => {
              const isHigh = b.bor_pct >= 85;
              const isMed  = b.bor_pct >= 70 && b.bor_pct < 85;
              const barColor = isHigh ? "bg-rose-500" : isMed ? "bg-amber-500" : "bg-emerald-500";
              return (
                <tr key={i}>
                  <td className="py-2 text-slate-700">{b.nm_bangsal}</td>
                  <td className="py-2 text-right text-slate-400 tabular-nums">{b.kapasitas}</td>
                  <td className="py-2 text-right text-amber-700 font-bold tabular-nums">{b.terisi}</td>
                  <td className="py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor}`} style={{ width: `${Math.min(b.bor_pct, 100)}%` }} />
                      </div>
                      <span className="text-xs text-slate-700 w-12 text-right tabular-nums">{b.bor_pct.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
