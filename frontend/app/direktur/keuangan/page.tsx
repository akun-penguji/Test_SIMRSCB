"use client";

import { useEffect, useState } from "react";
import { direkturKeuangan, DirekturKeuangan } from "@/lib/api";

const fmtRp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));

export default function DirekturKeuanganPage() {
  const [data, setData] = useState<DirekturKeuangan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    direkturKeuangan().then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-slate-500 py-20">Memuat...</div>;
  if (!data)   return <div className="text-center text-rose-600 py-20">Gagal memuat.</div>;

  const totalLayanan = data.pendapatan_per_layanan.reduce((a, x) => a + x.jumlah, 0);
  const totalPenjamin = data.pendapatan_per_penjamin.reduce((a, x) => a + x.jumlah, 0);
  const totalPiutang  = data.piutang_per_penjamin.reduce((a, x) => a + x.jumlah, 0);
  const maxTrend = Math.max(1, ...data.trend_pendapatan_30_hari.map(x => x.pendapatan));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-green-700 font-semibold">Keuangan</p>
        <h1 className="text-2xl font-bold text-slate-800">Pendapatan, Klaim & Piutang</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-700/10 border border-emerald-500/30 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-widest text-emerald-700 mb-2">Total Pendapatan MTD</p>
          <p className="text-3xl font-black text-slate-800">{fmtRp(totalLayanan)}</p>
          <p className="text-xs text-emerald-700 mt-1">Bulan berjalan</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-700/10 border border-blue-500/30 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-widest text-blue-700 mb-2">Pendapatan per Penjamin</p>
          <p className="text-3xl font-black text-slate-800">{fmtRp(totalPenjamin)}</p>
          <p className="text-xs text-blue-700 mt-1">Tagihan terbayar MTD</p>
        </div>
        <div className="bg-gradient-to-br from-rose-500/20 to-rose-700/10 border border-rose-500/30 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-widest text-rose-700 mb-2">Total Piutang Outstanding</p>
          <p className="text-3xl font-black text-slate-800">{fmtRp(totalPiutang)}</p>
          <p className="text-xs text-rose-700 mt-1">Belum lunas</p>
        </div>
      </div>

      {/* Trend 30 hari (simple bar chart) */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
        <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold mb-4">Trend Pendapatan Rajal 30 Hari</p>
        <div className="flex items-end gap-1 h-40">
          {data.trend_pendapatan_30_hari.map((d, i) => {
            const h = (d.pendapatan / maxTrend) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t hover:from-amber-500 hover:to-amber-300 transition cursor-pointer"
                  style={{ height: `${Math.max(h, 2)}%` }}>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-amber-700 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                    {fmtRp(d.pendapatan)} <br /> {d.tanggal.slice(5)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-500 mt-2 text-center">
          {data.trend_pendapatan_30_hari[0]?.tanggal} → {data.trend_pendapatan_30_hari[data.trend_pendapatan_30_hari.length-1]?.tanggal}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Per Layanan */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold mb-3">Pendapatan per Layanan (MTD)</p>
          {data.pendapatan_per_layanan.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Tidak ada data.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {data.pendapatan_per_layanan.map((r, i) => (
                  <tr key={i}>
                    <td className="py-2 text-slate-700">{r.kategori}</td>
                    <td className="py-2 text-right font-bold text-emerald-700">{fmtRp(r.jumlah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Per Penjamin */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold mb-3">Pendapatan per Penjamin (MTD)</p>
          {data.pendapatan_per_penjamin.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Tidak ada data.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {data.pendapatan_per_penjamin.map((r, i) => (
                  <tr key={i}>
                    <td className="py-2 text-slate-700">{r.kategori}</td>
                    <td className="py-2 text-right font-bold text-blue-700">{fmtRp(r.jumlah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Piutang */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
        <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold mb-3">Piutang Outstanding per Penjamin</p>
        {data.piutang_per_penjamin.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Tidak ada piutang outstanding.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-200">
              <tr><th className="text-left py-2">Penjamin</th><th className="text-right py-2">Total Piutang</th><th className="text-right py-2 w-32">% Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.piutang_per_penjamin.map((r, i) => {
                const pct = totalPiutang > 0 ? (r.jumlah / totalPiutang) * 100 : 0;
                return (
                  <tr key={i}>
                    <td className="py-2 text-slate-700">{r.kategori}</td>
                    <td className="py-2 text-right font-bold text-rose-700">{fmtRp(r.jumlah)}</td>
                    <td className="py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
