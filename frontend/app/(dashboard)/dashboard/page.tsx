"use client";

import { useEffect, useState } from "react";
import { getDashboardStats, DashboardStats } from "@/lib/api";

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string;
  color: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function BarChart({ data }: { data: { tgl: string; jumlah: number }[] }) {
  if (!data.length) return <div className="py-8 text-center text-xs text-slate-400">Tidak ada data</div>;
  const W = 420, H = 120, pad = { t: 8, b: 28, l: 8, r: 8 };
  const chartW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;
  const maxN   = Math.max(...data.map(d => d.jumlah), 1);
  const barW   = chartW / data.length;
  const DAYS   = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = pad.t + chartH * (1 - f);
        return <line key={f} x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />;
      })}
      {data.map((d, i) => {
        const bh  = (d.jumlah / maxN) * chartH;
        const x   = pad.l + i * barW + barW * 0.2;
        const bw  = barW * 0.6;
        const y   = pad.t + chartH - bh;
        const day = DAYS[new Date(d.tgl + "T00:00:00").getDay()];
        const isLast = i === data.length - 1;
        return (
          <g key={d.tgl}>
            <rect x={x} y={y} width={bw} height={bh} rx={3} fill={isLast ? "#16a34a" : "#86efac"} />
            <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize={10} fill="#64748b">{day}</text>
            <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize={9} fill="#475569" fontWeight="600">{d.jumlah}</text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ data }: { data: { png_jawab: string; jumlah: number }[] }) {
  if (!data.length) return <div className="py-8 text-center text-xs text-slate-400">Tidak ada data</div>;
  const COLORS = ["#22c55e","#3b82f6","#f59e0b","#a855f7","#ec4899","#06b6d4","#f97316","#84cc16"];
  const total  = data.reduce((s, d) => s + d.jumlah, 0);
  const R = 52, r = 32, cx = 70, cy = 68;
  let startAngle = -Math.PI / 2;
  const slices = data.slice(0, 6).map((d, idx) => {
    const angle = (d.jumlah / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    startAngle += angle;
    const x2 = cx + R * Math.cos(startAngle);
    const y2 = cy + R * Math.sin(startAngle);
    const xi1 = cx + r * Math.cos(startAngle - angle);
    const yi1 = cy + r * Math.sin(startAngle - angle);
    const xi2 = cx + r * Math.cos(startAngle);
    const yi2 = cy + r * Math.sin(startAngle);
    const large = angle > Math.PI ? 1 : 0;
    const path = [`M ${x1} ${y1}`,`A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`,
      `L ${xi2} ${yi2}`,`A ${r} ${r} 0 ${large} 0 ${xi1} ${yi1}`,"Z"].join(" ");
    return { ...d, path, color: COLORS[idx % COLORS.length], pct: Math.round((d.jumlah / total) * 100) };
  });
  return (
    <svg viewBox="0 0 200 140" className="w-full" style={{ height: 140 }}>
      {slices.map(s => <path key={s.png_jawab} d={s.path} fill={s.color} />)}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={11} fill="#475569" fontWeight="700">{total}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="#94a3b8">pasien</text>
      {slices.map((d, i) => (
        <g key={d.png_jawab} transform={`translate(140, ${16 + i * 20})`}>
          <rect width={10} height={10} rx={2} fill={d.color} />
          <text x={14} y={9} fontSize={9} fill="#475569">{(d.png_jawab || "?").slice(0, 14)}</text>
          <text x={70} y={9} fontSize={9} fill="#1e293b" fontWeight="700" textAnchor="end">{d.pct}%</text>
        </g>
      ))}
    </svg>
  );
}

export default function DashboardPage() {
  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const dateStr = today.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  useEffect(() => {
    getDashboardStats()
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n?: number) => loading ? "..." : (n?.toLocaleString("id-ID") ?? "—");

  return (
    <div className="p-3 md:p-5 lg:p-6">
      <div className="mb-4 md:mb-6">
        <h1 className="text-lg md:text-xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">{dateStr}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        <StatCard label="Kunjungan Hari Ini" value={fmt(stats?.kunjungan_hari_ini)} sub="Rawat Jalan" color="bg-green-100 text-green-700"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} />
        <StatCard label="Pasien Baru" value={fmt(stats?.pasien_baru)} sub="Hari ini" color="bg-blue-100 text-blue-700"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>} />
        <StatCard label="Total Pasien" value={fmt(stats?.total_pasien)} sub="Terdaftar" color="bg-purple-100 text-purple-700"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
        <StatCard label="Pasien Rawat Inap" value={fmt(stats?.pasien_ranap)} sub="Saat ini" color="bg-amber-100 text-amber-700"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} />
      </div>

      {/* Row 2: Bar chart + Donut */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-3 md:mb-4">
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Kunjungan 7 Hari Terakhir</h2>
            <span className="text-xs text-slate-400">Rawat Jalan</span>
          </div>
          <div className="px-4 pt-3 pb-4">
            <BarChart data={stats?.kunjungan_7_hari ?? []} />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Jaminan Pasien</h2>
            <span className="text-xs text-slate-400">Hari ini</span>
          </div>
          <div className="px-3 pt-2 pb-3">
            <DonutChart data={stats?.jaminan ?? []} />
          </div>
        </div>
      </div>

      {/* Row 3: Kunjungan per poli */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Kunjungan per Poli — Hari Ini</h2>
          <span className="text-xs text-slate-400">{loading ? "Memuat..." : `${stats?.kunjungan_per_poli.length ?? 0} poli`}</span>
        </div>
        <div className="p-5">
          {(stats?.kunjungan_per_poli ?? []).length === 0 && !loading ? (
            <p className="text-sm text-slate-400 text-center py-4">Tidak ada kunjungan hari ini</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(stats?.kunjungan_per_poli ?? []).map(({ nm_poli, jumlah }) => {
                const max = Math.max(...(stats?.kunjungan_per_poli ?? []).map(p => p.jumlah), 1);
                return (
                  <div key={nm_poli}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-600">{nm_poli}</span>
                      <span className="text-xs font-semibold text-slate-700">{jumlah}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${(jumlah / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
