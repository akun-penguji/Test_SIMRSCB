"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { getSirsRl35, updateSirsRl35, cetakSirsRl35, Rl35Resp, Rl35Entry } from "@/lib/api";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Rl35Page() {
  const [bulan, setBulan]     = useState(thisMonth());
  const [data, setData]       = useState<Rl35Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [edits, setEdits]     = useState<Record<number, Rl35Entry>>({});

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl35(bulan).then(r => {
      setData(r.data); setEdits({});
    }).catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => { reload(); }, [reload]);

  const updateNum = (id: number, field: keyof Rl35Entry, value: number) => {
    setEdits(es => {
      const base = es[id] || data?.entries.find(e => e.id === id);
      if (!base) return es;
      return { ...es, [id]: { ...base, [field]: value } };
    });
  };

  const save = async (e: Rl35Entry) => {
    if (!e.id) return;
    setErrMsg(""); setOkMsg("");
    try {
      await updateSirsRl35(e.id, e);
      setOkMsg(`✔ ${e.jenis_kode} ${e.jenis_nama} tersimpan`);
      setEdits(es => { const c = { ...es }; delete c[e.id!]; return c; });
      setTimeout(() => setOkMsg(""), 2500);
      reload();
    } catch { setErrMsg("Gagal menyimpan"); }
  };

  const dirty = (id: number) => !!edits[id];
  const cur = (id: number) => edits[id] || data?.entries.find(e => e.id === id)!;

  const totals = useMemo(() => {
    if (!data) return { dl: 0, dp: 0, ll: 0, lp: 0, tot: 0 };
    let dl = 0, dp = 0, ll = 0, lp = 0;
    for (const e of data.entries.filter(x => x.is_stat === 0)) {
      const c = edits[e.id!] || e;
      dl += c.dalam_l || 0; dp += c.dalam_p || 0;
      ll += c.luar_l  || 0; lp += c.luar_p  || 0;
    }
    return { dl, dp, ll, lp, tot: dl + dp + ll + lp };
  }, [data, edits]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <nav className="text-sm mb-4">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 3.5 — Rekapitulasi Kunjungan</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode bulanan · Input manual per jenis kegiatan (34 spesialisasi) · Sanity check dari Khanza <code>reg_periksa × pasien × kabupaten</code>.
        </p>
      </header>

      <div className="flex items-end gap-3 mb-5 flex-wrap">
        <div>
          <label className="block text-xs text-slate-900 mb-1">Bulan Pelaporan</label>
          <input type="month" value={bulan} onChange={e => setBulan(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
        </div>
        <button onClick={reload}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 py-2 rounded border border-slate-300">
          🔄 Refresh
        </button>
        <button onClick={() => cetakSirsRl35(bulan)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">
          🖨️ Cetak HTML
        </button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}
      {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded p-3 mb-3">{okMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-sm rounded p-4 mb-4">
            🔍 <strong>Sanity Khanza</strong> ({data.khanza.kab_kota_rs}): total realtime <strong>{data.khanza.total.toLocaleString()}</strong>
            (Dalam {data.khanza.total_dalam_l}L+{data.khanza.total_dalam_p}P · Luar {data.khanza.total_luar_l}L+{data.khanza.total_luar_p}P).
            Total manual RL 3.5 = <strong>{totals.tot.toLocaleString()}</strong>.
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-300">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 w-12 text-slate-900">No</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-left text-slate-900">Jenis Kegiatan</th>
                  <th colSpan={2} className="border border-slate-300 px-2 py-1 text-slate-900">Dalam Kab/Kota</th>
                  <th colSpan={2} className="border border-slate-300 px-2 py-1 text-slate-900">Luar Kab/Kota</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-slate-900">Total</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-slate-900">Aksi</th>
                </tr>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">L</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">P</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">L</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">P</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.filter(e => e.is_stat === 0).map(e => {
                  const c = cur(e.id!);
                  const total = (c.dalam_l||0)+(c.dalam_p||0)+(c.luar_l||0)+(c.luar_p||0);
                  return (
                    <tr key={e.id} className={dirty(e.id!) ? "bg-amber-50" : ""}>
                      <td className="border border-slate-300 px-2 py-1 text-center text-slate-900">{e.jenis_kode}</td>
                      <td className="border border-slate-300 px-2 py-1 text-slate-900">{e.jenis_nama}</td>
                      {(["dalam_l","dalam_p","luar_l","luar_p"] as const).map(f => (
                        <td key={f} className="border border-slate-300 p-0">
                          <input type="number" min={0}
                            className="w-full px-2 py-1 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                            value={c[f] ?? 0}
                            onChange={ev => updateNum(e.id!, f, Math.max(0, parseInt(ev.target.value) || 0))}
                          />
                        </td>
                      ))}
                      <td className="border border-slate-300 px-2 py-1 text-right font-semibold text-slate-900 tabular-nums">{total}</td>
                      <td className="border border-slate-300 px-2 py-1 text-center">
                        {dirty(e.id!) ? (
                          <button onClick={() => save(c)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded">Simpan</button>
                        ) : <span className="text-slate-400 text-xs">-</span>}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-blue-50 font-bold">
                  <td className="border border-slate-300 px-2 py-1 text-center text-slate-900">99</td>
                  <td className="border border-slate-300 px-2 py-1 text-slate-900">TOTAL</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.dl}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.dp}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.ll}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.lp}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.tot}</td>
                  <td className="border border-slate-300 px-2 py-1"></td>
                </tr>
                {data.entries.filter(e => e.is_stat === 1).map(e => {
                  const c = cur(e.id!);
                  return (
                    <tr key={e.id} className={`bg-amber-50 ${dirty(e.id!) ? "ring-2 ring-amber-300" : ""}`}>
                      <td className="border border-slate-300 px-2 py-1 text-center text-slate-900">{e.jenis_kode}</td>
                      <td className="border border-slate-300 px-2 py-1 italic text-slate-900">{e.jenis_nama}</td>
                      <td colSpan={4} className="border border-slate-300 p-0">
                        <input type="number" min={0} step="0.01"
                          className="w-full px-2 py-1 text-right text-slate-900 tabular-nums bg-transparent focus:bg-white outline-none"
                          value={c.stat_value ?? 0}
                          onChange={ev => updateNum(e.id!, "stat_value", parseFloat(ev.target.value) || 0)}
                        />
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-right font-semibold text-slate-900 tabular-nums">
                        {(c.stat_value ?? 0).toFixed(2)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-center">
                        {dirty(e.id!) ? (
                          <button onClick={() => save(c)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded">Simpan</button>
                        ) : <span className="text-slate-400 text-xs">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <details className="mt-5 bg-slate-50 border border-slate-200 rounded p-4">
            <summary className="cursor-pointer font-semibold text-slate-900">🔍 Khanza sanity per kd_poli (klik untuk buka)</summary>
            <table className="w-full text-xs mt-3 border border-slate-300">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-300 px-2 py-1 text-left text-slate-900">kd_poli</th>
                  <th className="border border-slate-300 px-2 py-1 text-left text-slate-900">nm_poli</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Dalam L</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Dalam P</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Luar L</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Luar P</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.khanza.per_poli.map(p => (
                  <tr key={p.kd_poli || "x"}>
                    <td className="border border-slate-300 px-2 py-1 text-slate-900">{p.kd_poli || "-"}</td>
                    <td className="border border-slate-300 px-2 py-1 text-slate-900">{p.nm_poli || "-"}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{p.dalam_l}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{p.dalam_p}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{p.luar_l}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{p.luar_p}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right font-semibold text-slate-900 tabular-nums">{p.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : null}
    </div>
  );
}
