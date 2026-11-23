"use client";
import { useCallback, useEffect, useState } from "react";
import { getWaktuTungguLab, WtLab, WtLabCell } from "@/lib/api";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const nf = (n: number) => n.toLocaleString("id-ID");
const pctCls = (p: number) => p >= 90 ? "text-teal-700" : p >= 75 ? "text-amber-600" : "text-rose-600";

export default function WaktuTungguLabPage() {
  const nowYear = new Date().getFullYear();
  const [tahun, setTahun] = useState(nowYear);
  const [d, setD] = useState<WtLab | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { setD((await getWaktuTungguLab(tahun)).data); }
    catch { setErr("Gagal memuat (pastikan tabel prioritas sudah dibuat)."); setD(null); }
    finally { setLoading(false); }
  }, [tahun]);
  useEffect(() => { load(); }, [load]);

  const yearOpts = [nowYear, nowYear - 1, nowYear - 2];

  return (
    <div className="space-y-4 p-1">
      <div className="hidden print:block text-center mb-3">
        <div className="font-bold text-lg">WAKTU TUNGGU HASIL LABORATORIUM</div>
        <div className="text-sm">RSUD Cabangbungin — Tahun {tahun}</div>
      </div>
      <div className="flex flex-wrap items-center gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Waktu Tunggu Hasil Lab</h1>
          <p className="text-sm text-slate-500">Reguler vs Cito — turnaround time (PP 3)</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))} className="border rounded-lg px-2 py-1 text-sm">
            {yearOpts.map(y => <option key={y} value={y}>Tahun {y}</option>)}
          </select>
          <button onClick={() => load()} disabled={loading} className="text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">{loading ? "Memuat…" : "Segarkan"}</button>
          <button onClick={() => window.print()} className="text-sm font-semibold bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-3 py-1.5">🖨 PDF</button>
        </div>
      </div>

      {err && <div className="text-center text-rose-500 py-4">{err}</div>}

      {d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Cito — Total Hasil" value={nf(d.ringkasan.cito.total)} sub={`target ≤ ${d.target.cito} menit`} />
            <Card label="Cito — Tepat Waktu" value={`${d.ringkasan.cito.pct.toFixed(1)}%`} sub={`${nf(d.ringkasan.cito.ontarget)} dari ${nf(d.ringkasan.cito.total)}`} valCls={pctCls(d.ringkasan.cito.pct)} />
            <Card label="Reguler — Total Hasil" value={nf(d.ringkasan.rutin.total)} sub={`target ≤ ${d.target.rutin} menit`} />
            <Card label="Reguler — Tepat Waktu" value={`${d.ringkasan.rutin.pct.toFixed(1)}%`} sub={`${nf(d.ringkasan.rutin.ontarget)} dari ${nf(d.ringkasan.rutin.total)}`} valCls={pctCls(d.ringkasan.rutin.pct)} />
          </div>

          <MatrixTable judul={`Cito (target ≤ ${d.target.cito} menit)`} bulan={d.bulan_cito} />
          <MatrixTable judul={`Reguler (target ≤ ${d.target.rutin} menit)`} bulan={d.bulan_rutin} />
          <div className="text-[11px] text-slate-400">Waktu tunggu = selisih menit dari jam permintaan sampai jam hasil keluar. Prioritas Cito ditandai dokter saat membuat permintaan; tanpa tanda = Reguler.</div>
        </>
      )}
    </div>
  );
}

function MatrixTable({ judul, bulan }: { judul: string; bulan: WtLabCell[] }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="text-sm font-semibold text-slate-700 mb-3">{judul}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b">
              <th className="text-left py-2 pr-3">Metrik</th>
              {BULAN.map(b => <th key={b} className="px-2 py-2 text-right">{b}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2 pr-3 text-slate-600">Jumlah hasil</td>
              {bulan.map((c, i) => <td key={i} className={`px-2 py-2 text-right tabular-nums ${c.total === 0 ? "text-slate-300" : "text-slate-700"}`}>{c.total === 0 ? "–" : nf(c.total)}</td>)}
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-3 text-slate-600">Rata-rata (menit)</td>
              {bulan.map((c, i) => <td key={i} className={`px-2 py-2 text-right tabular-nums ${c.total === 0 ? "text-slate-300" : "text-slate-700"}`}>{c.total === 0 ? "–" : c.avg_menit.toFixed(0)}</td>)}
            </tr>
            <tr>
              <td className="py-2 pr-3 text-slate-600">% tepat waktu</td>
              {bulan.map((c, i) => <td key={i} className={`px-2 py-2 text-right tabular-nums font-semibold ${c.total === 0 ? "text-slate-300" : pctCls(c.pct)}`}>{c.total === 0 ? "–" : `${c.pct.toFixed(0)}%`}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, sub, valCls = "text-slate-800" }: { label: string; value: string; sub?: string; valCls?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${valCls}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}
