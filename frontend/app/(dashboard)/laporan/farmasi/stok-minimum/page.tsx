"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLaporanStokMinimum, getDepoList, StokMinimumResp, DepoRow, StokRow } from "@/lib/api";

export default function StokMinimumPage() {
  const [data, setData]   = useState<StokMinimumResp | null>(null);
  const [depos, setDepos] = useState<DepoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kdDepo, setKdDepo]   = useState("");
  const [ratio, setRatio]     = useState(1.5);
  const [search, setSearch]   = useState("");
  const [showAll, setShowAll] = useState<"all" | "critical" | "warning">("all");

  useEffect(() => {
    getDepoList().then(r => setDepos(r.data)).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await getLaporanStokMinimum({ kd_bangsal: kdDepo, ratio, search });
      setData(r.data);
    } catch {
      setData({ critical: [], warning: [], total_critical: 0, total_warning: 0 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [kdDepo, ratio]);

  const allRows: StokRow[] =
    showAll === "all"      ? [...(data?.critical ?? []), ...(data?.warning ?? [])] :
    showAll === "critical" ? (data?.critical ?? []) :
                             (data?.warning ?? []);

  function exportCsv() {
    if (!data) return;
    const rows = [...data.critical, ...data.warning];
    const csv = [
      "Kode,Nama,Satuan,Jenis,Depo,Minimal,Stok Saat Ini,Selisih,Status",
      ...rows.map(r => [
        r.kode_brng, `"${r.nama_brng.replace(/"/g, '""')}"`, r.satuan, r.jenis,
        `"${r.nm_bangsal}"`,
        r.stok_minimal, r.stok_saat_ini, r.selisih,
        r.stok_saat_ini <= r.stok_minimal ? "CRITICAL" : "WARNING",
      ].join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `stok-minimum-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/laporan" className="text-xs text-slate-500 hover:text-green-700">
            ← Laporan
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 mt-1">📦 Stok Minimum Obat</h1>
          <p className="text-sm text-slate-500 mt-1">
            Obat yang stoknya sudah mendekati atau di bawah batas minimum, per depo.
          </p>
        </div>
        <button onClick={exportCsv}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition">
          ⬇ Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-700 uppercase font-semibold">🔴 Critical (≤ minimal)</p>
          <p className="text-3xl font-black text-red-700 mt-1">
            {loading ? "..." : data?.total_critical ?? 0}
          </p>
          <p className="text-xs text-red-600 mt-1">obat sudah mentok minimum</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-700 uppercase font-semibold">🟡 Warning (mendekati)</p>
          <p className="text-3xl font-black text-amber-700 mt-1">
            {loading ? "..." : data?.total_warning ?? 0}
          </p>
          <p className="text-xs text-amber-600 mt-1">stok masih di atas minimum tapi mendekati</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-700 uppercase font-semibold">📊 Total Alert</p>
          <p className="text-3xl font-black text-blue-700 mt-1">
            {loading ? "..." : (data?.total_critical ?? 0) + (data?.total_warning ?? 0)}
          </p>
          <p className="text-xs text-blue-600 mt-1">perlu perhatian gudang</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Depo</label>
          <select value={kdDepo} onChange={e => setKdDepo(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
            <option value="">— Semua Depo —</option>
            {depos.map(d => <option key={d.kd_bangsal} value={d.kd_bangsal}>{d.nm_bangsal}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            Threshold ratio ({ratio}×)
          </label>
          <input type="range" min={1.0} max={3.0} step={0.1} value={ratio}
            onChange={e => setRatio(Number(e.target.value))}
            className="w-full" />
          <p className="text-[10px] text-slate-400 mt-0.5">
            1.0× = critical only, 1.5× = +50% buffer, 2.0× = +100% buffer
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Tampilan</label>
          <select value={showAll} onChange={e => setShowAll(e.target.value as "all" | "critical" | "warning")}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
            <option value="all">Semua (Critical + Warning)</option>
            <option value="critical">🔴 Critical saja</option>
            <option value="warning">🟡 Warning saja</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Pencarian Obat</label>
          <form onSubmit={e => { e.preventDefault(); load(); }} className="flex gap-2">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="kode / nama..."
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <button type="submit" className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm">
              Cari
            </button>
          </form>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Memuat...</div>
      ) : allRows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-1">✅ Tidak ada obat yang mendekati stok minimum dengan filter ini.</p>
          <p className="text-xs text-slate-400">Coba naikkan ratio threshold atau ubah filter depo.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Kode</th>
                  <th className="px-3 py-2 text-left">Nama Obat</th>
                  <th className="px-3 py-2 text-left">Satuan</th>
                  <th className="px-3 py-2 text-left">Jenis</th>
                  <th className="px-3 py-2 text-left">Depo</th>
                  <th className="px-3 py-2 text-right">Minimal</th>
                  <th className="px-3 py-2 text-right">Stok Saat Ini</th>
                  <th className="px-3 py-2 text-right">Selisih</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allRows.map((r, idx) => {
                  const isCritical = r.stok_saat_ini <= r.stok_minimal;
                  return (
                    <tr key={`${r.kode_brng}-${r.kd_bangsal}-${idx}`}
                      className={`hover:bg-slate-50 ${isCritical ? "bg-red-50/40" : ""}`}>
                      <td className="px-3 py-2 font-mono text-slate-600">{r.kode_brng}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{r.nama_brng}</td>
                      <td className="px-3 py-2 text-slate-600">{r.satuan}</td>
                      <td className="px-3 py-2 text-slate-600">{r.jenis}</td>
                      <td className="px-3 py-2 text-slate-700">{r.nm_bangsal}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.stok_minimal.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-bold ${isCritical ? "text-red-700" : "text-amber-700"}`}>
                        {r.stok_saat_ini.toFixed(2)}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${r.selisih < 0 ? "text-red-700 font-bold" : "text-slate-600"}`}>
                        {r.selisih >= 0 ? "+" : ""}{r.selisih.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isCritical ? (
                          <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">
                            🔴 CRITICAL
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">
                            🟡 WARNING
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 text-xs text-slate-500">
            Menampilkan {allRows.length} dari {(data?.total_critical ?? 0) + (data?.total_warning ?? 0)} item alert.
          </div>
        </div>
      )}
    </div>
  );
}
