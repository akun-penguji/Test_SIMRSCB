"use client";

// Dashboard Inventaris — ringkasan kondisi, kalibrasi, nilai, sebaran.

import { useEffect, useState } from "react";
import InventarisNav from "@/app/(dashboard)/inventaris/InventarisNav";
import Link from "next/link";
import { getInvDashboard, InvDashboard, InvKV } from "@/lib/api";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const fmtRp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
const KOND_COLOR: Record<string, string> = { "Baik": "#059669", "Rusak Ringan": "#f59e0b", "Rusak Berat": "#e11d48" };

export default function InvDashboardPage() {
  const [d, setD] = useState<InvDashboard | null>(null);
  useEffect(() => { getInvDashboard().then(r => setD(r.data)).catch(() => {}); }, []);
  if (!d) return <div className="p-6 text-slate-400">Memuat…</div>;

  const k = d.kalibrasi;
  return (
    <div className="p-6 space-y-5">
      <InventarisNav />
      <h1 className="text-xl font-bold text-slate-800">Dashboard Inventaris</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total Aset" value={fmt(d.total)} />
        <Stat label="Laik" value={fmt(d.laik)} color="text-emerald-700" />
        <Stat label="Tidak Laik" value={fmt(d.tidak_laik)} color="text-rose-700" danger={d.tidak_laik > 0} />
        <Stat label="Nilai Aset" value={d.nilai_total > 0 ? fmtRp(d.nilai_total) : "—"} />
      </div>

      {/* Kalibrasi EWS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Status Kalibrasi ({fmt(k.wajib)} aset wajib)</p>
          <Link href="/inventaris/kalibrasi" className="text-xs text-green-700 hover:underline">Lihat jadwal →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Mini label="Jatuh Tempo" v={k.overdue} cls="bg-rose-50 text-rose-700 border-rose-200" />
          <Mini label="Segera (≤30 hr)" v={k.due30} cls="bg-amber-50 text-amber-700 border-amber-200" />
          <Mini label="Terjadwal" v={k.terjadwal} cls="bg-emerald-50 text-emerald-700 border-emerald-200" />
          <Mini label="Belum Terjadwal" v={k.belum} cls="bg-slate-50 text-slate-600 border-slate-200" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Kondisi donut */}
        <Panel title="Kondisi Aset">
          <div className="flex items-center gap-5">
            <StackDonut data={d.per_kondisi} colorMap={KOND_COLOR} total={d.total} />
            <div className="space-y-1.5 text-sm flex-1">
              {d.per_kondisi.map(c => (
                <Legend key={c.k} color={KOND_COLOR[c.k] || "#94a3b8"} label={c.k} v={c.v} total={d.total} />
              ))}
            </div>
          </div>
        </Panel>

        {/* Nilai per kategori */}
        <Panel title="Nilai per Kategori">
          <Bars data={d.nilai_per_kategori} fmtV={fmtRp} />
        </Panel>

        {/* Kategori */}
        <Panel title="Jumlah per Kategori"><Bars data={d.per_kategori} fmtV={fmt} /></Panel>

        {/* Top ruangan */}
        <Panel title="Aset per Ruangan (Top 12)"><Bars data={d.top_ruangan} fmtV={fmt} /></Panel>
      </div>

      {/* Sebaran tahun */}
      {d.per_tahun.length > 0 && (
        <Panel title="Sebaran Tahun Perolehan"><Bars data={[...d.per_tahun].reverse()} fmtV={fmt} /></Panel>
      )}
    </div>
  );
}

function Stat({ label, value, color = "text-slate-800", danger }: { label: string; value: string; color?: string; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${danger ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}>
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</p>
      <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
    </div>
  );
}
function Mini({ label, v, cls }: { label: string; v: number; cls: string }) {
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <p className="text-2xl font-black">{fmt(v)}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3">{title}</p>
      {children}
    </div>
  );
}
function Bars({ data, fmtV }: { data: InvKV[]; fmtV: (n: number) => string }) {
  const max = Math.max(1, ...data.map(x => x.v));
  return (
    <div className="space-y-2">
      {data.map(x => (
        <div key={x.k} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 text-slate-600 truncate" title={x.k}>{x.k}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div className="bg-green-600 h-full rounded-full" style={{ width: `${(x.v / max) * 100}%` }} />
          </div>
          <span className="w-24 text-right tabular-nums text-slate-500 text-xs">{fmtV(x.v)}</span>
        </div>
      ))}
      {data.length === 0 && <p className="text-sm text-slate-400">Belum ada data.</p>}
    </div>
  );
}
function StackDonut({ data, colorMap, total }: { data: InvKV[]; colorMap: Record<string, string>; total: number }) {
  const R = 34, C = 2 * Math.PI * R;
  const t = Math.max(1, total);
  let off = 0;
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
      <circle cx="48" cy="48" r={R} fill="none" stroke="#f1f5f9" strokeWidth="14" />
      {data.map((a, i) => {
        const dash = (a.v / t) * C;
        const el = <circle key={i} cx="48" cy="48" r={R} fill="none" stroke={colorMap[a.k] || "#94a3b8"} strokeWidth="14"
          strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-off} transform="rotate(-90 48 48)" />;
        off += dash; return el;
      })}
      <text x="48" y="45" textAnchor="middle" className="fill-slate-800" style={{ fontSize: 18, fontWeight: 800 }}>{total}</text>
      <text x="48" y="60" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 9 }}>ASET</text>
    </svg>
  );
}
function Legend({ color, label, v, total }: { color: string; label: string; v: number; total: number }) {
  const pct = total ? Math.round((v / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      <span className="text-slate-600 flex-1">{label}</span>
      <span className="font-semibold text-slate-800 tabular-nums">{fmt(v)}</span>
      <span className="text-slate-400 text-xs">({pct}%)</span>
    </div>
  );
}
