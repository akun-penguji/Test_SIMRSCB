"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getSirsRl31, cetakSirsRl31, Rl31Resp, Rl31Row } from "@/lib/api";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Ideal ranges per JUKNIS
const IDEAL: Record<string, [string, (v: number) => "good" | "warn" | "bad" | "neutral"]> = {
  bor:  ["60-85%",        (v) => v === 0 ? "neutral" : (v >= 60 && v <= 85 ? "good" : v >= 50 && v <= 90 ? "warn" : "bad")],
  alos: ["6-9 hari",      (v) => v === 0 ? "neutral" : (v >= 6  && v <= 9  ? "good" : v >= 4  && v <= 12 ? "warn" : "bad")],
  bto:  ["40-50 /tahun",  () => "neutral"],
  toi:  ["1-3 hari",      (v) => v === 0 ? "neutral" : (v >= 1  && v <= 3  ? "good" : v <= 5 ? "warn" : "bad")],
  ndr:  ["<25 ‰",         (v) => v === 0 ? "neutral" : (v < 25  ? "good" : v < 50  ? "warn" : "bad")],
  gdr:  ["<45 ‰",         (v) => v === 0 ? "neutral" : (v < 45  ? "good" : v < 70  ? "warn" : "bad")],
};

function colorOf(s: ReturnType<typeof IDEAL["bor"][1]>): string {
  return s === "good" ? "text-emerald-700 font-semibold"
       : s === "warn" ? "text-amber-700 font-medium"
       : s === "bad"  ? "text-red-700 font-bold"
       : "text-slate-400";
}

export default function Rl31Page() {
  const [bulan, setBulan] = useState(thisMonth());
  const [data, setData] = useState<Rl31Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl31(bulan).then(r => setData(r.data))
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => { reload(); }, [reload]);

  const handleCetak = async () => {
    try { await cetakSirsRl31(bulan); }
    catch { setErrMsg("Gagal cetak"); }
  };

  const indikatorBadge = (key: keyof typeof IDEAL, value: number) => {
    const [_label, evalFn] = IDEAL[key]; void _label;
    return <span className={`tabular-nums ${colorOf(evalFn(value))}`}>
      {value.toFixed(2)}
    </span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4">
        <Link href="/laporan/sirs" className="text-xs text-slate-500 hover:text-green-700">
          ← Laporan SIRS 6.3
        </Link>
        <div className="flex items-start gap-3 mt-2">
          <span className="font-mono text-lg font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded">
            RL 3.1
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800 leading-tight">Indikator Pelayanan (BOR · ALOS · BTO · TOI · NDR · GDR)</h1>
            <p className="text-xs text-slate-500 mt-1">
              SIRS Online · Bulanan · Sumber: <span className="font-medium">kamar_inap Khanza realtime</span>
            </p>
          </div>
          <button onClick={handleCetak}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Cetak
          </button>
        </div>
      </div>

      {errMsg && <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm">{errMsg}</div>}

      {/* Periode picker */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-xs text-slate-900 font-semibold block mb-1">Bulan pelaporan</label>
          <input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900" />
        </div>
        {data && (
          <div className="text-xs text-slate-500">
            Periode: <span className="font-mono">{data.bulan_dari}</span> s/d <span className="font-mono">{data.bulan_sampai}</span>
            ({data.hari_periode} hari)
          </div>
        )}
        <div className="ml-auto text-[11px] text-slate-400 italic">
          Auto-compute dari kamar_inap × kamar × bangsal (klasifikasi by nama bangsal).
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat...</div>
      ) : !data ? (
        <div className="text-center text-slate-400 text-sm py-6">Data kosong.</div>
      ) : (
        <>
          {/* Main table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-900 text-xs uppercase font-bold">
                <tr>
                  <th className="text-left p-3 border-b">No</th>
                  <th className="text-left p-3 border-b">Jenis Pelayanan</th>
                  <th className="text-right p-3 border-b">TT</th>
                  <th className="text-right p-3 border-b">Hari Perawatan</th>
                  <th className="text-right p-3 border-b">Pasien Keluar</th>
                  <th className="text-right p-3 border-b">BOR (%)</th>
                  <th className="text-right p-3 border-b">ALOS</th>
                  <th className="text-right p-3 border-b">BTO</th>
                  <th className="text-right p-3 border-b">TOI</th>
                  <th className="text-right p-3 border-b">NDR (‰)</th>
                  <th className="text-right p-3 border-b">GDR (‰)</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r: Rl31Row, i) => (
                  <tr key={r.jenis} className="hover:bg-slate-50">
                    <td className="p-3 border-b text-slate-500 font-mono">{i + 1}</td>
                    <td className="p-3 border-b font-medium text-slate-900">{r.jenis}</td>
                    <td className="p-3 border-b text-right tabular-nums text-slate-900 font-semibold">{r.jml_tt}</td>
                    <td className="p-3 border-b text-right tabular-nums text-slate-900 font-semibold">{r.hari_perawatan}</td>
                    <td className="p-3 border-b text-right tabular-nums text-slate-900 font-semibold">{r.pasien_keluar}</td>
                    <td className="p-3 border-b text-right">{indikatorBadge("bor", r.bor)}</td>
                    <td className="p-3 border-b text-right">{indikatorBadge("alos", r.alos)}</td>
                    <td className="p-3 border-b text-right">{indikatorBadge("bto", r.bto)}</td>
                    <td className="p-3 border-b text-right">{indikatorBadge("toi", r.toi)}</td>
                    <td className="p-3 border-b text-right">{indikatorBadge("ndr", r.ndr)}</td>
                    <td className="p-3 border-b text-right">{indikatorBadge("gdr", r.gdr)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-blue-50 font-bold text-sm">
                <tr>
                  <td className="p-3 text-slate-500">77</td>
                  <td className="p-3 text-blue-900">Rata-rata</td>
                  <td colSpan={3}></td>
                  <td className="p-3 text-right">{indikatorBadge("bor", data.rata_rata.bor)}</td>
                  <td className="p-3 text-right">{indikatorBadge("alos", data.rata_rata.alos)}</td>
                  <td className="p-3 text-right">{indikatorBadge("bto", data.rata_rata.bto)}</td>
                  <td className="p-3 text-right">{indikatorBadge("toi", data.rata_rata.toi)}</td>
                  <td className="p-3 text-right">{indikatorBadge("ndr", data.rata_rata.ndr)}</td>
                  <td className="p-3 text-right">{indikatorBadge("gdr", data.rata_rata.gdr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Legend + formula */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-700">
            <p className="font-semibold text-slate-800 mb-2">📐 Formula Indikator & Range Ideal (JUKNIS SIRS 6.3)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
              <p>• <strong>BOR</strong> = (Hari Perawatan ÷ (TT × Hari Periode)) × 100% — ideal <span className="text-emerald-700 font-medium">60-85%</span></p>
              <p>• <strong>ALOS</strong> = Lama Dirawat ÷ Pasien Keluar — ideal <span className="text-emerald-700 font-medium">6-9 hari</span></p>
              <p>• <strong>BTO</strong> = Pasien Keluar ÷ TT — ideal <span className="text-emerald-700 font-medium">40-50 kali/tahun</span></p>
              <p>• <strong>TOI</strong> = ((TT × Hari Periode) − Hari Rawat) ÷ Keluar — ideal <span className="text-emerald-700 font-medium">1-3 hari</span></p>
              <p>• <strong>NDR</strong> = (Mati ≥48 jam ÷ Keluar) × 1000‰ — tolerir <span className="text-emerald-700 font-medium">&lt;25 per 1000</span></p>
              <p>• <strong>GDR</strong> = (Total Mati ÷ Keluar) × 1000‰ — tolerir <span className="text-emerald-700 font-medium">&lt;45 per 1000</span></p>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Warna: <span className="text-emerald-700 font-semibold">hijau</span> = dalam range ideal · <span className="text-amber-700">kuning</span> = di luar ideal tapi masih wajar · <span className="text-red-700 font-bold">merah</span> = perlu perhatian.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
