"use client";

import { useEffect, useState, useCallback, useMemo, Fragment } from "react";
import Link from "next/link";
import { getSirsRl51, cetakSirsRl51, Rl51Resp } from "@/lib/api";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Rl51Page() {
  const [bulan, setBulan]     = useState(thisMonth());
  const [data, setData]       = useState<Rl51Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [search, setSearch]   = useState("");

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl51(bulan).then(r => setData(r.data))
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => { reload(); }, [reload]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toUpperCase();
    if (!q) return data.rows;
    return data.rows.filter(r =>
      r.kd_penyakit.toUpperCase().includes(q) ||
      r.nm_penyakit.toUpperCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="p-4 max-w-[1900px] mx-auto">
      <nav className="text-sm mb-4">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 5.1 — Morbiditas Pasien Rawat Jalan</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode bulanan · <strong>Realtime auto-compute</strong> dari diagnosa_pasien (prioritas=1, status=Ralan) × reg_periksa × pasien × penyakit.
          25 kelompok umur × L/P. Cells = <strong>Kasus Baru</strong>; Total = Kasus Baru + Kunjungan.
        </p>
      </header>

      <div className="flex items-end gap-3 mb-5 flex-wrap">
        <div>
          <label className="block text-xs text-slate-900 mb-1">Bulan Pelaporan</label>
          <input type="month" value={bulan} onChange={e => setBulan(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
        </div>
        <div>
          <label className="block text-xs text-slate-900 mb-1">Cari ICD / Nama</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="K30, dyspepsia, dst."
            className="w-56 border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
        </div>
        <button onClick={reload}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 py-2 rounded border border-slate-300">🔄 Refresh</button>
        <button onClick={() => cetakSirsRl51(bulan)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">🖨️ Cetak HTML</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
              <div className="text-xs text-emerald-700">Total Kasus Baru</div>
              <div className="text-2xl font-bold text-slate-900">{data.total_kasus_baru.toLocaleString()}</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <div className="text-xs text-blue-700">Total Kunjungan</div>
              <div className="text-2xl font-bold text-slate-900">{data.total_kunjungan.toLocaleString()}</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <div className="text-xs text-amber-700">Distinct ICD-10 (3-digit)</div>
              <div className="text-2xl font-bold text-slate-900">{data.rows.length}</div>
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <div className="text-center text-slate-500 text-sm p-8">Tidak ada data untuk filter ini</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-[10px] border border-slate-300" style={{ minWidth: 2400 }}>
                <thead>
                  <tr>
                    <th rowSpan={3} className="sticky left-0 z-10 bg-slate-100 border border-slate-300 px-2 py-1 text-slate-900">ICD</th>
                    <th rowSpan={3} className="sticky left-12 z-10 bg-slate-100 border border-slate-300 px-2 py-1 text-left text-slate-900 min-w-[180px]">Diagnosa</th>
                    <th colSpan={50} className="border border-slate-300 px-1 py-1 bg-emerald-100 text-slate-900">Jumlah Kasus Baru × Umur × JK</th>
                    <th colSpan={3} className="border border-slate-300 px-1 py-1 bg-emerald-200 text-slate-900">Total Kasus Baru</th>
                    <th colSpan={3} className="border border-slate-300 px-1 py-1 bg-blue-200 text-slate-900">Total Kunjungan</th>
                  </tr>
                  <tr>
                    {data.umur_labels.map(l => (
                      <th key={l} colSpan={2} className="border border-slate-300 px-1 py-1 text-[9px] text-slate-900 bg-emerald-50">{l}</th>
                    ))}
                    <th rowSpan={2} className="border border-slate-300 px-1 py-1 text-slate-900 bg-emerald-100">L</th>
                    <th rowSpan={2} className="border border-slate-300 px-1 py-1 text-slate-900 bg-emerald-100">P</th>
                    <th rowSpan={2} className="border border-slate-300 px-1 py-1 text-slate-900 bg-emerald-200">Total</th>
                    <th rowSpan={2} className="border border-slate-300 px-1 py-1 text-slate-900 bg-blue-100">L</th>
                    <th rowSpan={2} className="border border-slate-300 px-1 py-1 text-slate-900 bg-blue-100">P</th>
                    <th rowSpan={2} className="border border-slate-300 px-1 py-1 text-slate-900 bg-blue-200">Total</th>
                  </tr>
                  <tr>
                    {data.umur_labels.map((_, i) => (
                      <Fragment key={`u${i}`}>
                        <th className="border border-slate-300 px-1 py-0 text-slate-900 bg-emerald-50">L</th>
                        <th className="border border-slate-300 px-1 py-0 text-slate-900 bg-emerald-50">P</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(r => (
                    <tr key={r.kd_penyakit} className="hover:bg-amber-50">
                      <td className="sticky left-0 bg-slate-50 border border-slate-300 px-2 py-1 font-mono font-bold text-slate-900">{r.kd_penyakit}</td>
                      <td className="sticky left-12 bg-white border border-slate-300 px-2 py-1 text-slate-900 max-w-[200px] truncate" title={r.nm_penyakit}>{r.nm_penyakit}</td>
                      {Array.from({length: 25}).map((_, i) => (
                        <Fragment key={`c${r.kd_penyakit}-${i}`}>
                          <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums">
                            {r.baru_l_per_umur[i] > 0 ? r.baru_l_per_umur[i] : <span className="text-slate-300">·</span>}
                          </td>
                          <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums">
                            {r.baru_p_per_umur[i] > 0 ? r.baru_p_per_umur[i] : <span className="text-slate-300">·</span>}
                          </td>
                        </Fragment>
                      ))}
                      <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums bg-emerald-50">{r.total_baru_l}</td>
                      <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums bg-emerald-50">{r.total_baru_p}</td>
                      <td className="border border-slate-300 px-1 py-1 text-right font-bold text-slate-900 tabular-nums bg-emerald-100">{r.total_baru}</td>
                      <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums bg-blue-50">{r.kunjungan_l}</td>
                      <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums bg-blue-50">{r.kunjungan_p}</td>
                      <td className="border border-slate-300 px-1 py-1 text-right font-bold text-slate-900 tabular-nums bg-blue-100">{r.kunjungan_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded p-3 mt-4">
            <strong>Catatan:</strong> Kasus baru = diagnosa_pasien.status_penyakit='Baru' (pertama kali pasien terdiagnosa ICD tersebut). Kunjungan = semua visit. Diurut by Total Kunjungan descending.
          </div>
        </>
      ) : null}
    </div>
  );
}
