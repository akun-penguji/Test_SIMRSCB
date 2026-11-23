"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  listSirsRl12, toggleSirsRl12, cetakSirsRl12,
  Rl12Pelayanan,
} from "@/lib/api";

export default function Rl12Page() {
  const [items, setItems] = useState<Rl12Pelayanan[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [search, setSearch] = useState("");
  const [filterAda, setFilterAda] = useState<"all" | "ada" | "tidak">("all");

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    listSirsRl12().then(r => setItems(r.data))
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleToggle = async (item: Rl12Pelayanan) => {
    const newAda = !(item.ada !== 0);
    setItems(it => it.map(x => x.id === item.id ? { ...x, ada: newAda ? 1 : 0 } : x));
    try {
      await toggleSirsRl12(item.id, newAda);
    } catch {
      setItems(it => it.map(x => x.id === item.id ? { ...x, ada: item.ada } : x));
      setErrMsg("Gagal update");
    }
  };

  const handleCetak = async () => {
    try { await cetakSirsRl12(); }
    catch { setErrMsg("Gagal membuka pratinjau cetak"); }
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter(it => {
      if (filterAda === "ada"   && it.ada === 0) return false;
      if (filterAda === "tidak" && it.ada !== 0) return false;
      if (!s) return true;
      return it.sub_name.toLowerCase().includes(s) || it.kat_name.toLowerCase().includes(s);
    });
  }, [items, search, filterAda]);

  const grouped = useMemo(() => {
    const map = new Map<number, { kat_name: string; items: Rl12Pelayanan[] }>();
    for (const it of filtered) {
      const cur = map.get(it.kat_no);
      if (cur) cur.items.push(it);
      else map.set(it.kat_no, { kat_name: it.kat_name, items: [it] });
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const totalAda = items.filter(it => it.ada !== 0).length;
  const total = items.length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <Link href="/laporan/sirs" className="text-xs text-slate-500 hover:text-green-700">
          ← Laporan SIRS 6.3
        </Link>
        <div className="flex items-start gap-3 mt-2">
          <span className="font-mono text-lg font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded">
            RL 1.2
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800 leading-tight">Ketersediaan Pelayanan</h1>
            <p className="text-xs text-slate-500 mt-1">
              RL 1 · RS Online · Periode: <span className="font-medium">Update saat ada perubahan</span> ·
              <span className="ml-2 inline-block bg-emerald-600 text-white px-2 py-0.5 rounded font-bold">{totalAda}/{total}</span> pelayanan ada
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
      {okMsg  && <div className="mb-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-green-800 text-sm">{okMsg}</div>}

      {/* Search + filter */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[250px]">
          <label className="text-xs text-slate-500 block mb-1">Cari pelayanan / kategori</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="mis. mata, jantung, farmasi..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Status</label>
          <select value={filterAda} onChange={(e) => setFilterAda(e.target.value as typeof filterAda)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="all">Semua</option>
            <option value="ada">Tersedia ({totalAda})</option>
            <option value="tidak">Belum tersedia ({total - totalAda})</option>
          </select>
        </div>
      </div>

      {/* List per kategori */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center text-slate-400 text-sm py-6">Memuat...</div>
        ) : grouped.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-6">Tidak ada hasil.</div>
        ) : grouped.map(([katNo, { kat_name, items: it }]) => {
          const adaCount = it.filter(x => x.ada !== 0).length;
          return (
            <details key={katNo} className="bg-white border border-slate-200 rounded-2xl overflow-hidden" open={!!search}>
              <summary className="cursor-pointer px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                    {katNo}
                  </span>
                  <span className="font-semibold text-slate-800 text-sm">{kat_name}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded font-medium ${adaCount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {adaCount} / {it.length}
                </span>
              </summary>
              <div className="px-4 py-2 divide-y divide-slate-100">
                {it.map(p => (
                  <label key={p.id}
                    className={`flex items-center gap-3 py-2 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded ${p.ada !== 0 ? "bg-emerald-50/40" : ""}`}>
                    <input type="checkbox" checked={p.ada !== 0}
                      onChange={() => handleToggle(p)} className="accent-emerald-700 w-4 h-4" />
                    <span className="font-mono text-xs text-slate-400 w-7 text-right">{p.sub_no}.</span>
                    <span className="text-sm text-slate-800 flex-1">{p.sub_name}</span>
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] text-slate-400 italic">
        Centang/uncheck pelayanan tersimpan otomatis. Setelah perubahan, klik Cetak untuk export ke PDF/print sesuai format JUKNIS.
      </p>
    </div>
  );
}
