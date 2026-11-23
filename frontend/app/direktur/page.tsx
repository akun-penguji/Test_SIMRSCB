"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { direkturDashboard, DirekturDashboard, getDirekturInputSummary, DirekturInputSummary } from "@/lib/api";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const fmtRp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));

type Status = "aman" | "perhatian" | "kritis";
const DOT: Record<Status, { c: string; t: string }> = {
  aman:      { c: "bg-emerald-500", t: "Aman" },
  perhatian: { c: "bg-amber-500",   t: "Perlu perhatian" },
  kritis:    { c: "bg-rose-500",     t: "Kritikal" },
};

function Kpi({ label, value, sub, icon, color = "green", status }: {
  label: string; value: string; sub?: string; icon: string; color?: string; status?: Status;
}) {
  const colorMap: Record<string, { bg: string; icon: string; ring: string }> = {
    green:   { bg: "from-green-50 to-emerald-50",   icon: "text-green-700",   ring: "border-green-200" },
    blue:    { bg: "from-blue-50 to-sky-50",         icon: "text-blue-700",    ring: "border-blue-200" },
    emerald: { bg: "from-emerald-50 to-teal-50",     icon: "text-emerald-700", ring: "border-emerald-200" },
    rose:    { bg: "from-rose-50 to-pink-50",        icon: "text-rose-700",    ring: "border-rose-200" },
    violet:  { bg: "from-violet-50 to-purple-50",    icon: "text-violet-700",  ring: "border-violet-200" },
    sky:     { bg: "from-sky-50 to-cyan-50",         icon: "text-sky-700",     ring: "border-sky-200" },
    amber:   { bg: "from-amber-50 to-orange-50",     icon: "text-amber-700",   ring: "border-amber-200" },
  };
  const c = colorMap[color] || colorMap.green;
  return (
    <div className={`bg-gradient-to-br ${c.bg} border ${c.ring} rounded-2xl p-5 shadow-sm relative`}>
      {status && (
        <span className="absolute top-3 right-3 flex items-center gap-1.5" title={DOT[status].t}>
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${DOT[status].c} ${status === "kritis" ? "animate-pulse" : ""}`}></span>
        </span>
      )}
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</p>
        <svg className={`w-5 h-5 ${c.icon} ${status ? "mr-4" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <p className="text-3xl font-black text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function DirekturDashboardPage() {
  const [data, setData] = useState<DirekturDashboard | null>(null);
  const [inp, setInp]   = useState<DirekturInputSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      direkturDashboard().then(r => setData(r.data)).finally(() => setLoading(false));
      getDirekturInputSummary().then(r => setInp(r.data)).catch(() => {});
    };
    load();
    const id = setInterval(load, 60000); // refresh tiap 1 menit
    return () => clearInterval(id);
  }, []);

  if (loading) return <div className="text-center text-slate-500 py-20">Memuat data eksekutif...</div>;
  if (!data)   return <div className="text-center text-rose-600 py-20">Gagal memuat data.</div>;

  const t = data.target;
  const bor = data.kamar.bor_pct;
  const statusBor: Status = bor > t.bor_max ? "kritis" : (bor > 0 && bor < t.bor_min ? "perhatian" : "aman");
  const statusPendHarian: Status = data.keuangan.pendapatan_today >= t.pendapatan_harian ? "aman" : "perhatian";
  const statusPiutang: Status = data.keuangan.piutang_total > t.piutang_max ? "kritis" : "aman";
  const statusAlos: Status = data.indikator.alos > t.alos_max && t.alos_max > 0 ? "perhatian" : "aman";
  const statusStok: Status = data.farmasi.stok_kosong >= 20 ? "kritis" : (data.farmasi.stok_kosong > 0 ? "perhatian" : "aman");

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-white border border-green-200 rounded-2xl p-6 shadow-sm flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-green-700 font-semibold mb-1">Executive Summary</p>
          <h1 className="text-2xl font-bold text-slate-800">Selamat Datang, Direktur</h1>
          <p className="text-sm text-slate-500 mt-1">Ringkasan kondisi rumah sakit terkini · auto-refresh 1 menit.</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <Link href="/direktur/strategis"
            className="text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg px-3 py-2 transition">
            📊 Dashboard Strategis
          </Link>
          <Link href="/direktur/target"
            className="text-xs font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg px-3 py-2 transition">
            ⚙ Setelan Target
          </Link>
        </div>
      </div>

      {/* Early Warning System */}
      <section className={`rounded-2xl p-5 shadow-sm border ${data.alerts.some(a => a.level === "merah") ? "bg-rose-50 border-rose-200" : data.alerts.length ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
        <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span>🚨</span> Early Warning System
        </h2>
        {data.alerts.length === 0 ? (
          <p className="text-sm text-emerald-700 flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            Semua indikator dalam batas aman.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 bg-white border ${a.level === "merah" ? "border-rose-200" : "border-amber-200"}`}>
                <span className={`mt-0.5 inline-block w-2.5 h-2.5 rounded-full shrink-0 ${a.level === "merah" ? "bg-rose-500 animate-pulse" : "bg-amber-500"}`}></span>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{a.kategori}</span>
                  <p className="text-sm text-slate-700 leading-snug">{a.pesan}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Row 1: Pelayanan Hari Ini */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Pelayanan Hari Ini</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Rawat Jalan" value={fmt(data.kunjungan.rajal_today)} sub={`MTD: ${fmt(data.kunjungan.rajal_mtd)}`}
            color="sky" icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          <Kpi label="IGD" value={fmt(data.kunjungan.igd_today)} sub={`MTD: ${fmt(data.kunjungan.igd_mtd)}`}
            color="rose" icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          <Kpi label="Rawat Inap" value={fmt(data.kunjungan.ranap_today)} sub={`MTD: ${fmt(data.kunjungan.ranap_mtd)}`}
            color="violet" icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          <Kpi label="Operasi Hari Ini" value={fmt(data.operasi_today)} sub="Booking OK"
            color="amber" icon="M9.5 14.5L3 21m0 0l6.5-6.5M3 21h4m-4 0v-4M14.121 9.879l5.657-5.657a2 2 0 00-2.828-2.829l-5.657 5.657m2.828 2.829l-2.828-2.829m2.828 2.829l-6.011 6.01a2 2 0 01-1.414.586H7v-1.172a2 2 0 01.586-1.414l6.01-6.01" />
        </div>
      </section>

      {/* Row 2: Hunian & Indikator Ranap */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Hunian & Indikator Ranap (bulan ini)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="BOR Realtime" value={`${bor.toFixed(1)}%`} sub={`${data.kamar.terisi}/${data.kamar.kapasitas} TT · target ${t.bor_min}–${t.bor_max}%`}
            color="blue" status={statusBor} icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          <Kpi label="ALOS" value={`${data.indikator.alos.toFixed(1)} hari`} sub={`Target ≤ ${t.alos_max} hari`}
            color="violet" status={statusAlos} icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          <Kpi label="TOI" value={`${data.indikator.toi.toFixed(1)} hari`} sub={`Target ≤ ${t.toi_max} hari`}
            color="sky" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          <Kpi label="BTO" value={`${data.indikator.bto.toFixed(1)}×`} sub="Bed Turn Over"
            color="emerald" icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </div>
      </section>

      {/* Row 3: Keuangan */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Keuangan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Pendapatan Hari Ini" value={fmtRp(data.keuangan.pendapatan_today)} sub={`Target ${fmtRp(t.pendapatan_harian)}`}
            color="emerald" status={statusPendHarian} icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <Kpi label="Pendapatan MTD" value={fmtRp(data.keuangan.pendapatan_mtd)} sub={`Target ${fmtRp(t.pendapatan_bulanan)}`}
            color="emerald" icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          <Kpi label="Piutang Outstanding" value={fmtRp(data.keuangan.piutang_total)} sub="Belum lunas"
            color="rose" status={statusPiutang} icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          <Kpi label="Obat/BHP Stok Kosong" value={fmt(data.farmasi.stok_kosong)} sub="Item aktif tanpa stok"
            color="amber" status={statusStok} icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </div>
      </section>

      {/* Pengadaan · Aset · BLUD (input manual) */}
      {inp && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Pengadaan · Aset · Belanja BLUD</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Paket Pengadaan" value={fmt(inp.pengadaan_paket)} sub={`Nilai ${fmtRp(inp.pengadaan_nilai)}`}
              color="sky" icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
            <Kpi label="Kontrak Hampir Habis" value={fmt(inp.kontrak_hampir_habis)} sub="≤ 30 hari"
              color="amber" status={inp.kontrak_hampir_habis > 0 ? "kritis" : "aman"}
              icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            <Kpi label="Kalibrasi Jatuh Tempo" value={fmt(inp.kalibrasi_due)} sub={`Total aset: ${fmt(inp.aset_total)}`}
              color="rose" status={inp.kalibrasi_due > 0 ? "perhatian" : "aman"}
              icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <Kpi label="Realisasi Belanja BLUD" value={inp.belanja_pagu > 0 ? `${(inp.belanja_realisasi / inp.belanja_pagu * 100).toFixed(0)}%` : "—"}
              sub={`${fmtRp(inp.belanja_realisasi)} / ${fmtRp(inp.belanja_pagu)}`}
              color="emerald" icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <Link href="/direktur/pengadaan" className="text-green-700 hover:text-green-800">→ Kelola Pengadaan</Link>
            <Link href="/direktur/aset" className="text-green-700 hover:text-green-800">→ Kelola Aset &amp; Kalibrasi</Link>
            <Link href="/direktur/belanja" className="text-green-700 hover:text-green-800">→ Kelola Belanja BLUD</Link>
          </div>
        </section>
      )}

      {/* Row 4: SDM & Akreditasi */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">SDM & Akreditasi</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Pegawai Aktif" value={fmt(data.pegawai.total_aktif)} sub={`Dokter: ${data.pegawai.dokter} • Perawat: ${data.pegawai.perawat}`}
            color="green" icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          <Kpi label="EP STARKES Aktif" value={fmt(data.akreditasi.total_ep)} sub={`Critical: ${data.akreditasi.critical}`}
            color="violet" icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          <Kpi label="Eviden Folder" value={fmt(data.akreditasi.eviden)} sub="Catalog Drive"
            color="violet" icon="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Quick Links</p>
            <Link href="/direktur/strategis" className="text-sm text-green-700 hover:text-green-800 transition">→ Dashboard Strategis (Gauge)</Link>
            <Link href="/direktur/bpjs-farmasi" className="text-sm text-green-700 hover:text-green-800 transition">→ BPJS & Klaim + Farmasi</Link>
            <Link href="/direktur/keuangan" className="text-sm text-green-700 hover:text-green-800 transition">→ Dashboard Keuangan</Link>
            <Link href="/akreditasi" className="text-sm text-green-700 hover:text-green-800 transition">→ Modul Akreditasi STARKES</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
