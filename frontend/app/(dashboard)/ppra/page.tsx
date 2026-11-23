"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ppraKuantitatif, ppraTren, ppraStats, ppraValidasi,
  PpraKuantitatif, PpraTren, PpraStats,
} from "@/lib/api";

const nf = (v: number, d = 1) => v.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const AWARE_COLOR: Record<string, string> = {
  access: "#10b981", watch: "#f59e0b", reserve: "#ef4444", not_recommended: "#94a3b8",
};

export default function PpraDashboardPage() {
  const [kuant, setKuant] = useState<PpraKuantitatif | null>(null);
  const [tren, setTren] = useState<PpraTren | null>(null);
  const [stats, setStats] = useState<PpraStats | null>(null);
  const [unmapped, setUnmapped] = useState<number>(0);

  useEffect(() => {
    ppraKuantitatif({ jenis: "ranap" }).then(r => setKuant(r.data)).catch(() => {});
    ppraTren({ jenis: "ranap", bulan: 6 }).then(r => setTren(r.data)).catch(() => {});
    ppraStats().then(r => setStats(r.data)).catch(() => {});
    ppraValidasi().then(r => setUnmapped(r.data.v2_belum_dimapping.jumlah)).catch(() => {});
  }, []);

  const aware = kuant?.ringkasan.aware;
  const total = aware?.total ?? 0;
  const seg = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  // conic-gradient donut
  const donut = aware
    ? (() => {
        let acc = 0;
        const stops: string[] = [];
        (["access", "watch", "reserve", "not_recommended"] as const).forEach(k => {
          const p = seg(aware[k] as number);
          if (p > 0) { stops.push(`${AWARE_COLOR[k]} ${acc}% ${acc + p}%`); acc += p; }
        });
        return stops.length ? `conic-gradient(${stops.join(",")})` : "conic-gradient(#e2e8f0 0 100%)";
      })()
    : "conic-gradient(#e2e8f0 0 100%)";

  const maxRasio = Math.max(1, ...(tren?.data.map(d => d.rasio) ?? [1]));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Dashboard PPRA</h1>
      <p className="text-sm text-slate-500 mb-4">Surveilans penggunaan antibiotik (ranap, triwulan berjalan).</p>

      {unmapped > 0 && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded-lg px-4 py-2 mb-4">
          ⚠ {unmapped} item terindikasi antibiotik belum dimapping — angka bisa belum lengkap.
          <Link href="/ppra/mapping" className="underline ml-1">Lengkapi mapping</Link>.
        </div>
      )}

      {/* kartu utama */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card label="AWaRe Access" value={`${nf(aware?.access_persen ?? 0)}%`}
          sub={`target ${nf(aware?.target_persen ?? 60, 0)}%`} ok={aware?.memenuhi_target} bad={aware && !aware.memenuhi_target} big />
        <Card label="DDD / 100 patient-days" value={nf(kuant?.ringkasan.rasio ?? 0, 2)} sub="rawat inap" accent />
        <Card label="Total DDD" value={nf(kuant?.ringkasan.total_ddd ?? 0, 0)} sub="periode berjalan" />
        <Card label="Antibiotik dimapping" value={String(stats?.mapping_aktif ?? "—")} sub={`${stats?.atc_ref ?? "—"} ref ATC`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Donut AWaRe */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Distribusi AWaRe (Total DDD)</h2>
          {total > 0 ? (
            <div className="flex items-center gap-5">
              <div className="w-32 h-32 rounded-full shrink-0" style={{ background: donut }}>
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-20 h-20 bg-white rounded-full flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-slate-800">{nf(total, 0)}</span>
                    <span className="text-[10px] text-slate-400">DDD</span>
                  </div>
                </div>
              </div>
              <div className="text-sm space-y-1">
                {(["access", "watch", "reserve", "not_recommended"] as const).map(k => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm" style={{ background: AWARE_COLOR[k] }} />
                    <span className="capitalize text-slate-600">{k.replace("_", " ")}</span>
                    <span className="ml-auto font-mono text-slate-500">{nf(seg(aware![k] as number))}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-slate-400 py-8 text-center">Belum ada data konsumsi.</p>}
        </div>

        {/* Tren DDD/100 bulanan */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Tren DDD/100 patient-days (6 bulan)</h2>
          {tren && tren.data.length > 0 ? (
            <div className="flex items-end gap-2 h-36">
              {tren.data.map(d => (
                <div key={d.bulan} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <span className="text-[10px] font-mono text-slate-500">{nf(d.rasio)}</span>
                  <div className="w-full bg-indigo-500 rounded-t" style={{ height: `${(d.rasio / maxRasio) * 100}%`, minHeight: d.rasio > 0 ? "3px" : "0" }} title={`${d.bulan}: ${nf(d.rasio, 2)}`} />
                  <span className="text-[10px] text-slate-400">{d.bulan.slice(5)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400 py-8 text-center">Belum ada data tren.</p>}
        </div>
      </div>

      {/* pintasan */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { href: "/ppra/kuantitatif", label: "Kuantitatif", icon: "📊" },
          { href: "/ppra/gyssens", label: "Gyssens", icon: "🩺" },
          { href: "/ppra/mapping", label: "Mapping", icon: "🔗" },
          { href: "/ppra/atc", label: "Referensi ATC", icon: "📖" },
          { href: "/ppra/laporan", label: "Laporan/Cetak", icon: "🖨" },
        ].map(s => (
          <Link key={s.href} href={s.href} className="bg-white border border-slate-200 rounded-lg p-3 text-center hover:border-indigo-300 hover:bg-indigo-50/40">
            <div className="text-2xl">{s.icon}</div>
            <div className="text-sm text-slate-700 mt-1">{s.label}</div>
          </Link>
        ))}
      </div>

      {kuant && <p className="text-xs text-slate-400 mt-4">{kuant.disclaimer}</p>}
    </div>
  );
}

function Card({ label, value, sub, accent, ok, bad, big }: {
  label: string; value: string; sub?: string; accent?: boolean; ok?: boolean; bad?: boolean; big?: boolean;
}) {
  const tone = ok ? "text-emerald-600" : bad ? "text-red-600" : accent ? "text-indigo-600" : "text-slate-800";
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`${big ? "text-3xl" : "text-2xl"} font-bold ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
