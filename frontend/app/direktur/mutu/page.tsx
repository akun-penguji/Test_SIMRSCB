"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { akreditasiStats, AkreditasiStats } from "@/lib/api";

export default function DirekturMutuPage() {
  const [stats, setStats] = useState<AkreditasiStats | null>(null);

  useEffect(() => {
    akreditasiStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  const totalCritical = stats?.per_bab.reduce((a, b) => a + b.critical, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-green-700 font-semibold">Mutu & Akreditasi</p>
        <h1 className="text-2xl font-bold text-slate-800">Status Mutu Rumah Sakit</h1>
      </div>

      {/* Akreditasi STARKES summary */}
      <div className="bg-gradient-to-br from-violet-500/20 to-violet-700/10 border border-violet-500/30 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-violet-700 font-semibold">Akreditasi STARKES</p>
            <p className="text-base text-slate-700 mt-1">Kepmenkes HK.01.07/MENKES/1128/2022</p>
          </div>
          <Link href="/akreditasi"
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition">
            Buka Modul →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-[10px] uppercase text-slate-500 mb-1">Total EP Aktif</p>
            <p className="text-3xl font-black text-slate-800">{stats?.total_ep ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">dari estimasi 890</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-[10px] uppercase text-slate-500 mb-1">Bab Ter-seed</p>
            <p className="text-3xl font-black text-slate-800">{stats?.per_bab.length ?? 0}<span className="text-base text-slate-500">/15</span></p>
            <p className="text-xs text-slate-500 mt-1">dari 16 bab Kepmenkes</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-[10px] uppercase text-slate-500 mb-1">EP Critical</p>
            <p className="text-3xl font-black text-rose-700">{totalCritical}</p>
            <p className="text-xs text-slate-500 mt-1">prioritas P1-P2</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-[10px] uppercase text-slate-500 mb-1">Status</p>
            <p className="text-base font-bold text-amber-700 mt-2">In Progress</p>
            <p className="text-xs text-slate-500 mt-1">persiapan survey</p>
          </div>
        </div>
      </div>

      {/* Breakdown per bab */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
        <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold mb-3">EP per Bab (yang sudah di-seed)</p>
        {(!stats || stats.per_bab.length === 0) ? (
          <p className="text-sm text-slate-400 italic">Belum ada bab yang di-seed.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left py-2 w-20">Bab</th>
                <th className="text-left py-2">Nama</th>
                <th className="text-center py-2 w-16">Klp</th>
                <th className="text-right py-2 w-24">Total EP</th>
                <th className="text-right py-2 w-24">Critical</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.per_bab.map(b => (
                <tr key={b.bab}>
                  <td className="py-2 font-mono font-bold text-violet-700">{b.bab}</td>
                  <td className="py-2 text-slate-700">{b.nama_bab}</td>
                  <td className="py-2 text-center text-slate-500">{b.kelompok}</td>
                  <td className="py-2 text-right text-amber-700 font-bold tabular-nums">{b.total_ep}</td>
                  <td className="py-2 text-right">
                    {b.critical > 0 ? (
                      <span className="text-rose-700 font-bold">{b.critical}</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 shadow-sm border-dashed rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">INM 13 Indikator (Coming Soon)</p>
          <p className="text-sm text-slate-500">
            Indikator Nasional Mutu — kepatuhan identifikasi, ERT IGD, waktu tunggu rajal, kepatuhan visite DPJP, dll.
            Akan auto-compute dari data Khanza.
          </p>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm border-dashed rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">IKP / Insiden (Coming Soon)</p>
          <p className="text-sm text-slate-500">
            Pelaporan Insiden Keselamatan Pasien — KPC/KNC/KTC/KTD/Sentinel + workflow investigasi + RCA + close-out.
          </p>
        </div>
      </div>
    </div>
  );
}
