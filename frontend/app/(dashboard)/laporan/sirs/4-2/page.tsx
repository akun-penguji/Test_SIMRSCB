"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getSirsRl42, cetakSirsRl42, Rl42Resp } from "@/lib/api";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Rl42Page() {
  const [bulan, setBulan]     = useState(thisMonth());
  const [data, setData]       = useState<Rl42Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl42(bulan).then(r => setData(r.data))
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <nav className="text-sm mb-4 flex gap-3">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
        <span className="text-slate-400">·</span>
        <Link href="/laporan/sirs/4-1" className="text-indigo-600 hover:underline">RL 4.1 (sumber)</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 4.2 — 10 Besar Penyakit Rawat Inap</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode bulanan · Realtime dari RL 4.1, diurut by total Pasien Keluar (Hidup+Mati).
          Exclude kode <strong>O80, O82, R, V, W, X, Y, Z</strong> (bukan kategori penyakit).
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
        <button onClick={() => cetakSirsRl42(bulan)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">🖨️ Cetak HTML</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-sm rounded p-3 mb-4">
            🏥 <strong>Periode {data.bulan}</strong>: total pasien rawat inap keluar = <strong>{data.total_pasien_keluar.toLocaleString()}</strong>
            · Pasien Keluar Mati = <strong>{data.total_pasien_mati.toLocaleString()}</strong>
          </div>

          <table className="w-full text-sm border border-slate-300">
            <thead>
              <tr className="bg-slate-100">
                <th rowSpan={2} className="border border-slate-300 px-3 py-2 w-12 text-slate-900">No</th>
                <th rowSpan={2} className="border border-slate-300 px-3 py-2 w-20 text-slate-900">Kelompok ICD-10</th>
                <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-left text-slate-900">Kelompok Diagnosis Penyakit</th>
                <th colSpan={3} className="border border-slate-300 px-3 py-2 bg-emerald-100 text-slate-900">Jumlah Pasien (Hidup+Mati)</th>
                <th colSpan={3} className="border border-slate-300 px-3 py-2 bg-rose-100 text-slate-900">Jumlah Pasien Keluar Mati</th>
              </tr>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-2 text-slate-900 bg-emerald-50">L</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900 bg-emerald-50">P</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900 bg-emerald-50">Total</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900 bg-rose-50">L</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900 bg-rose-50">P</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900 bg-rose-50">Total</th>
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
                  <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums bg-emerald-50">{r.total_l}</td>
                  <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums bg-emerald-50">{r.total_p}</td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-bold text-slate-900 tabular-nums bg-emerald-100">{r.total}</td>
                  <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums bg-rose-50">{r.mati_l > 0 ? r.mati_l : <span className="text-slate-300">·</span>}</td>
                  <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums bg-rose-50">{r.mati_p > 0 ? r.mati_p : <span className="text-slate-300">·</span>}</td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-bold text-slate-900 tabular-nums bg-rose-100">{r.total_mati > 0 ? r.total_mati : <span className="text-slate-300">·</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded p-3 mt-4">
            <strong>Catatan JUKNIS:</strong> Kelompok ICD-10 = prefix 3-digit (1 huruf + 2 angka, mis. A00, A01, C34). Kode yang di-EXCLUDE: O80 (single spontaneous delivery), O82 (cesarean), R (gejala/tanda tidak terklasifikasi di tempat lain), V/W/X/Y (cause of external injury), Z (faktor mempengaruhi status kesehatan).
          </div>
        </>
      ) : null}
    </div>
  );
}
