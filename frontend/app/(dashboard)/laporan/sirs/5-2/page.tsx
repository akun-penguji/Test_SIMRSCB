"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getSirsRl52, cetakSirsRl52, Rl52Resp } from "@/lib/api";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Rl52Page() {
  const [bulan, setBulan]     = useState(thisMonth());
  const [data, setData]       = useState<Rl52Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl52(bulan).then(r => setData(r.data))
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <nav className="text-sm mb-4 flex gap-3">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
        <span className="text-slate-400">·</span>
        <Link href="/laporan/sirs/5-1" className="text-indigo-600 hover:underline">RL 5.1 (sumber)</Link>
        <span className="text-slate-400">·</span>
        <Link href="/laporan/sirs/5-3" className="text-indigo-600 hover:underline">RL 5.3 (10 Besar Kunjungan)</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 5.2 — 10 Besar Kasus Baru Penyakit Rawat Jalan</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode bulanan · Realtime dari RL 5.1, diurut by Total Kasus Baru descending.
          Exclude <strong>O80, O82, R, V, W, X, Y, Z</strong> (bukan penyakit).
        </p>
      </header>

      <div className="flex items-end gap-3 mb-5 flex-wrap">
        <div>
          <label className="block text-xs text-slate-900 mb-1">Bulan Pelaporan</label>
          <input type="month" value={bulan} onChange={e => setBulan(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
        </div>
        <button onClick={reload}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 py-2 rounded border border-slate-300">🔄 Refresh</button>
        <button onClick={() => cetakSirsRl52(bulan)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">🖨️ Cetak HTML</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <div className="bg-emerald-50 border-l-4 border-emerald-400 text-emerald-900 text-sm rounded p-3 mb-4">
            🆕 <strong>Periode {data.bulan}</strong>: total kasus baru = <strong>{data.total_kasus_baru.toLocaleString()}</strong>
            · Total kunjungan = <strong>{data.total_kunjungan.toLocaleString()}</strong>
          </div>

          <table className="w-full text-sm border border-slate-300">
            <thead>
              <tr className="bg-slate-100">
                <th rowSpan={2} className="border border-slate-300 px-3 py-2 w-12 text-slate-900">No</th>
                <th rowSpan={2} className="border border-slate-300 px-3 py-2 w-20 text-slate-900">Kelompok ICD-10</th>
                <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-left text-slate-900">Kelompok Diagnosis Penyakit</th>
                <th colSpan={3} className="border border-slate-300 px-3 py-2 bg-emerald-100 text-slate-900">Jumlah Kasus Baru</th>
                <th colSpan={3} className="border border-slate-300 px-3 py-2 bg-blue-100 text-slate-900">Jumlah Kunjungan</th>
              </tr>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-2 text-slate-900 bg-emerald-50">L</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900 bg-emerald-50">P</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900 bg-emerald-50">Total</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900 bg-blue-50">L</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900 bg-blue-50">P</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900 bg-blue-50">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr><td colSpan={9} className="border border-slate-300 px-3 py-4 text-center text-slate-400">Tidak ada data</td></tr>
              ) : data.rows.map(r => (
                <tr key={r.kd_penyakit} className="hover:bg-amber-50">
                  <td className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-900">{r.no}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center font-mono font-bold text-slate-900">{r.kd_penyakit}</td>
                  <td className="border border-slate-300 px-3 py-2 text-slate-900">{r.nm_penyakit}</td>
                  <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums bg-emerald-50">{r.total_baru_l}</td>
                  <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums bg-emerald-50">{r.total_baru_p}</td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-bold text-slate-900 tabular-nums bg-emerald-100">{r.total_baru}</td>
                  <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums bg-blue-50">{r.kunjungan_l}</td>
                  <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums bg-blue-50">{r.kunjungan_p}</td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-bold text-slate-900 tabular-nums bg-blue-100">{r.kunjungan_total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}
