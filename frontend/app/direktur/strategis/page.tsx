"use client";

// Dashboard Strategis Direktur — KPI dalam bentuk Gauge/Speedometer.
// Realisasi otomatis (BOR, pendapatan) + realisasi manual (kepuasan, akreditasi,
// inovasi) dari Setelan Target. Dalam 5 detik Direktur tahu kondisi RS.

import { useEffect, useState } from "react";
import Link from "next/link";
import { direkturDashboard, getDirekturTarget, DirekturDashboard, DirekturTarget } from "@/lib/api";

const fmtRp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));

// ── Gauge setengah lingkaran ──────────────────────────────────────────────
type Zone = { upTo: number; color: string };
function pt(cx: number, cy: number, r: number, frac: number) {
  const ang = Math.PI * (1 - Math.min(Math.max(frac, 0), 1)); // 0→kiri(π), 1→kanan(0)
  return [cx + r * Math.cos(ang), cy - r * Math.sin(ang)];
}
function arc(cx: number, cy: number, r: number, f0: number, f1: number) {
  const [x0, y0] = pt(cx, cy, r, f0);
  const [x1, y1] = pt(cx, cy, r, f1);
  return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
}
function Gauge({ value, max, zones, big, sub, satuan }: {
  value: number; max: number; zones: Zone[]; big: string; sub: string; satuan?: string;
}) {
  const cx = 100, cy = 100, r = 78;
  const frac = max > 0 ? Math.min(value / max, 1) : 0;
  const [nx, ny] = pt(cx, cy, r - 6, frac);
  // warna nilai saat ini (zona yang mencakup value)
  const zoneColor = (() => {
    const pctVal = max > 0 ? (value / max) * 100 : 0;
    for (const z of zones) if (pctVal <= z.upTo) return z.color;
    return zones[zones.length - 1]?.color ?? "#10b981";
  })();
  let prev = 0;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col items-center">
      <svg viewBox="0 0 200 118" className="w-full max-w-[240px]">
        {/* track */}
        <path d={arc(cx, cy, r, 0, 1)} fill="none" stroke="#eef2f5" strokeWidth={14} strokeLinecap="round" />
        {/* zona berwarna */}
        {zones.map((z, i) => {
          const f0 = prev / 100, f1 = z.upTo / 100; prev = z.upTo;
          return <path key={i} d={arc(cx, cy, r, f0, f1)} fill="none" stroke={z.color} strokeWidth={14} strokeLinecap="butt" opacity={0.85} />;
        })}
        {/* jarum */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#334155" strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill="#334155" />
        {/* nilai besar */}
        <text x={cx} y={cy - 22} textAnchor="middle" className="fill-slate-800" style={{ fontSize: 26, fontWeight: 800 }}>{big}</text>
        {satuan && <text x={cx} y={cy - 6} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>{satuan}</text>}
      </svg>
      <div className="flex items-center gap-2 -mt-1">
        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: zoneColor }}></span>
        <p className="text-sm font-semibold text-slate-700 text-center">{sub}</p>
      </div>
    </div>
  );
}

// zona standar "pencapaian target" (0–100% dari target)
const ZONA_CAPAI: Zone[] = [
  { upTo: 66, color: "#f43f5e" },   // < 2/3 target: merah
  { upTo: 83, color: "#f59e0b" },   // kuning
  { upTo: 100, color: "#10b981" },  // hijau
];

export default function DirekturStrategisPage() {
  const [d, setD] = useState<DirekturDashboard | null>(null);
  const [t, setT] = useState<DirekturTarget | null>(null);

  useEffect(() => {
    const load = () => Promise.all([direkturDashboard(), getDirekturTarget()])
      .then(([a, b]) => { setD(a.data); setT(b.data); }).catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  if (!d || !t) return <div className="text-center text-slate-500 py-20">Memuat KPI strategis...</div>;

  const pctHarian = t.pendapatan_harian > 0 ? (d.keuangan.pendapatan_today / t.pendapatan_harian) * 100 : 0;
  const pctBulanan = t.pendapatan_bulanan > 0 ? (d.keuangan.pendapatan_mtd / t.pendapatan_bulanan) * 100 : 0;
  const pctInovasi = t.inovasi_target > 0 ? (t.inovasi_real / t.inovasi_target) * 100 : 0;
  const pctSdm = t.sdm_target > 0 ? (d.pegawai.total_aktif / t.sdm_target) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/direktur" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Dashboard Strategis Direktur</h1>
          <p className="text-sm text-slate-500">Target vs realisasi dalam speedometer · auto-refresh 1 menit.</p>
        </div>
        <Link href="/direktur/target" className="shrink-0 text-xs font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg px-3 py-2 transition">⚙ Setelan Target</Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* BOR — zona ideal bor_min–bor_max */}
        <Gauge value={d.kamar.bor_pct} max={100}
          zones={[{ upTo: t.bor_min, color: "#f59e0b" }, { upTo: t.bor_max, color: "#10b981" }, { upTo: 100, color: "#f43f5e" }]}
          big={`${d.kamar.bor_pct.toFixed(0)}%`} satuan={`ideal ${t.bor_min}–${t.bor_max}%`} sub="BOR (Hunian)" />

        {/* Pendapatan Harian */}
        <Gauge value={pctHarian} max={100} zones={ZONA_CAPAI}
          big={`${pctHarian.toFixed(0)}%`} satuan={fmtRp(d.keuangan.pendapatan_today)} sub="Pendapatan Harian" />

        {/* Pendapatan Bulanan (BLUD) */}
        <Gauge value={pctBulanan} max={100} zones={ZONA_CAPAI}
          big={`${pctBulanan.toFixed(0)}%`} satuan={fmtRp(d.keuangan.pendapatan_mtd)} sub="Pendapatan BLUD (MTD)" />

        {/* Kepuasan Pasien (realisasi manual) */}
        <Gauge value={t.kepuasan_real} max={100}
          zones={[{ upTo: 70, color: "#f43f5e" }, { upTo: t.kepuasan, color: "#f59e0b" }, { upTo: 100, color: "#10b981" }]}
          big={`${t.kepuasan_real.toFixed(0)}%`} satuan={`target ${t.kepuasan}%`} sub="Kepuasan Pasien" />

        {/* Akreditasi (realisasi manual) */}
        <Gauge value={t.akreditasi_real} max={100}
          zones={[{ upTo: 60, color: "#f43f5e" }, { upTo: t.akreditasi, color: "#f59e0b" }, { upTo: 100, color: "#10b981" }]}
          big={`${t.akreditasi_real.toFixed(0)}%`} satuan={`target ${t.akreditasi}%`} sub="Akreditasi (Progres)" />

        {/* Inovasi (realisasi manual) */}
        <Gauge value={pctInovasi} max={100} zones={ZONA_CAPAI}
          big={`${t.inovasi_real.toFixed(0)}/${t.inovasi_target.toFixed(0)}`} satuan="inovasi tercapai" sub="Target Inovasi" />

        {/* SDM (pegawai vs target) */}
        <Gauge value={t.sdm_target > 0 ? Math.min(pctSdm, 100) : 0} max={100} zones={ZONA_CAPAI}
          big={`${d.pegawai.total_aktif}`} satuan={t.sdm_target > 0 ? `target ${t.sdm_target.toFixed(0)}` : "set target di setelan"} sub="SDM (Pegawai Aktif)" />

        {/* Keuangan sehat (komposit sederhana: pendapatan MTD % ) */}
        <Gauge value={Math.min(pctBulanan, 100)} max={100} zones={ZONA_CAPAI}
          big={`${Math.min(pctBulanan, 100).toFixed(0)}%`} satuan="capaian keuangan" sub="Kesehatan Keuangan" />
      </div>

      <p className="text-xs text-slate-400 text-center">
        Realisasi Kepuasan, Akreditasi, dan Inovasi diisi manual di <Link href="/direktur/target" className="text-green-700 hover:underline">Setelan Target</Link> (belum ada sumber data otomatis).
      </p>
    </div>
  );
}
