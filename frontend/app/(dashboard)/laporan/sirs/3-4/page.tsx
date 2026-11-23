"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getSirsRl34, cetakSirsRl34, Rl34Resp } from "@/lib/api";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Rl34Page() {
  const [bulan, setBulan]     = useState(thisMonth());
  const [data, setData]       = useState<Rl34Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl34(bulan)
      .then(r => setData(r.data))
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <nav className="text-sm mb-4">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 3.4 — Rekapitulasi Pengunjung</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode bulanan · Realtime compute dari Khanza <code>reg_periksa × pasien</code> (first-ever-visit per no_rkm_medis).
        </p>
      </header>

      <div className="flex items-end gap-3 mb-5 flex-wrap">
        <div>
          <label className="block text-xs text-slate-900 mb-1">Bulan Pelaporan</label>
          <input
            type="month" value={bulan}
            onChange={e => setBulan(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm text-slate-900"
          />
        </div>
        <button
          onClick={reload}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 py-2 rounded border border-slate-300"
        >🔄 Refresh</button>
        <button
          onClick={() => cetakSirsRl34(bulan)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto"
        >🖨️ Cetak HTML</button>
      </div>

      {errMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-4">{errMsg}</div>
      )}

      {loading ? (
        <div className="text-slate-500 text-sm">Memuat...</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <div className="text-xs text-blue-700 mb-1">Total Pengunjung Baru</div>
              <div className="text-2xl font-bold text-slate-900">{data.total_baru.toLocaleString()}</div>
              <div className="text-xs text-slate-600 mt-1">{data.pengunjung_baru_l} L · {data.pengunjung_baru_p} P</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-4">
              <div className="text-xs text-amber-700 mb-1">Total Pengunjung Lama</div>
              <div className="text-2xl font-bold text-slate-900">{data.total_lama.toLocaleString()}</div>
              <div className="text-xs text-slate-600 mt-1">{data.pengunjung_lama_l} L · {data.pengunjung_lama_p} P</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded p-4">
              <div className="text-xs text-emerald-700 mb-1">TOTAL Pengunjung</div>
              <div className="text-2xl font-bold text-slate-900">{data.total.toLocaleString()}</div>
              <div className="text-xs text-slate-600 mt-1">orang (DISTINCT no_rkm_medis)</div>
            </div>
          </div>

          <table className="w-full text-sm border border-slate-300">
            <thead>
              <tr className="bg-slate-100">
                <th rowSpan={2} className="border border-slate-300 px-3 py-2 w-12 text-slate-900">No</th>
                <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-left text-slate-900">Jenis Pengunjung</th>
                <th colSpan={2} className="border border-slate-300 px-3 py-2 text-slate-900">Jenis Kelamin</th>
                <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-slate-900">Jumlah</th>
              </tr>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-2 text-slate-900">Laki-laki</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900">Perempuan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 px-3 py-2 text-center text-slate-900">1</td>
                <td className="border border-slate-300 px-3 py-2 text-slate-900">Pengunjung Baru</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{data.pengunjung_baru_l.toLocaleString()}</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{data.pengunjung_baru_p.toLocaleString()}</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums font-semibold">{data.total_baru.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-2 text-center text-slate-900">2</td>
                <td className="border border-slate-300 px-3 py-2 text-slate-900">Pengunjung Lama</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{data.pengunjung_lama_l.toLocaleString()}</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{data.pengunjung_lama_p.toLocaleString()}</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums font-semibold">{data.total_lama.toLocaleString()}</td>
              </tr>
              <tr className="bg-blue-50 font-bold">
                <td className="border border-slate-300 px-3 py-2 text-center text-slate-900">99</td>
                <td className="border border-slate-300 px-3 py-2 text-slate-900">TOTAL</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{(data.pengunjung_baru_l + data.pengunjung_lama_l).toLocaleString()}</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{(data.pengunjung_baru_p + data.pengunjung_lama_p).toLocaleString()}</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{data.total.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-sm rounded p-4 mt-5">
            <strong>📌 Definisi (JUKNIS SIRS 6.3):</strong>
            <ol className="list-decimal ml-6 mt-2 space-y-1">
              <li><strong>Pengunjung Baru</strong> — pengunjung yang baru pertama kali datang ke RS dan mendapatkan nomor rekam medis baru. Nomor RM diberikan hanya sekali seumur hidup.</li>
              <li><strong>Pengunjung Lama</strong> — pengunjung yang datang untuk kedua kali dan seterusnya, baik ke poli yang sama atau berbeda. Tidak dapat nomor RM baru.</li>
              <li>Jika 1 pasien datang beberapa kali dalam 1 bulan → dihitung 1 pengunjung (DISTINCT no_rkm_medis).</li>
            </ol>
          </div>
        </>
      ) : null}
    </div>
  );
}
