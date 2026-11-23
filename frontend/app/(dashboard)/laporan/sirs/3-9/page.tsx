"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { getSirsRl39, updateSirsRl39, cetakSirsRl39, Rl39Resp, Rl39Entry } from "@/lib/api";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Rl39Page() {
  const [bulan, setBulan]     = useState(thisMonth());
  const [data, setData]       = useState<Rl39Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [edits, setEdits]     = useState<Record<number, Rl39Entry>>({});

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl39(bulan).then(r => { setData(r.data); setEdits({}); })
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => { reload(); }, [reload]);

  const updateNum = (id: number, value: number) => {
    setEdits(es => {
      const base = es[id] || data?.entries.find(e => e.id === id);
      if (!base) return es;
      return { ...es, [id]: { ...base, jumlah: value } };
    });
  };

  const save = async (e: Rl39Entry) => {
    if (!e.id) return;
    setErrMsg(""); setOkMsg("");
    try {
      await updateSirsRl39(e.id, e);
      setOkMsg(`✔ ${e.jenis_kode} tersimpan`);
      setEdits(es => { const c = { ...es }; delete c[e.id!]; return c; });
      setTimeout(() => setOkMsg(""), 2500);
      reload();
    } catch { setErrMsg("Gagal menyimpan"); }
  };

  const dirty = (id: number) => !!edits[id];
  const cur = (id: number) => edits[id] || data?.entries.find(e => e.id === id)!;

  const sugesti = useMemo(() => {
    const m = new Map<string, { count: number; sumber: string }>();
    data?.khanza.sugesti_per_row.forEach(r => m.set(r.jenis_kode, { count: r.count, sumber: r.sumber }));
    return m;
  }, [data]);

  const totalManual = useMemo(() => {
    if (!data) return 0;
    return data.entries.filter(e => e.is_parent === 0).reduce((s, e) => {
      const c = edits[e.id!] || e;
      return s + (c.jumlah || 0);
    }, 0);
  }, [data, edits]);

  const applyAllSugesti = async () => {
    if (!data) return;
    const leaves = data.entries.filter(e => e.is_parent === 0);
    let saved = 0;
    for (const e of leaves) {
      const s = sugesti.get(e.jenis_kode);
      if (!s) continue;
      if (e.jumlah === s.count) continue;
      try {
        await updateSirsRl39(e.id!, { ...e, jumlah: s.count });
        saved++;
      } catch {/* skip */}
    }
    setOkMsg(`✔ Sugesti diterapkan untuk ${saved} baris`);
    setTimeout(() => setOkMsg(""), 3000);
    reload();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <nav className="text-sm mb-4">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 3.9 — Pelayanan Radiologi</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode bulanan · 4 section (Radiodiagnostik / Radioterapi / Kedokteran Nuklir / Imaging) · Auto-klasifikasi dari <code>periksa_radiologi</code>.
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
        <button onClick={applyAllSugesti}
          className="bg-amber-500 hover:bg-amber-600 text-white text-sm px-4 py-2 rounded">⚡ Terapkan Sugesti Khanza</button>
        <button onClick={() => cetakSirsRl39(bulan)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">🖨️ Cetak HTML</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}
      {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded p-3 mb-3">{okMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-sm rounded p-3 mb-4">
            📡 <strong>Khanza periksa_radiologi {data.bulan}</strong>: total <strong>{data.khanza.total_periksa_radiologi}</strong> pemeriksaan / <strong>{data.khanza.total_pasien}</strong> pasien.
            Manual RL 3.9 total: <strong>{totalManual}</strong>.
          </div>

          <details className="bg-slate-50 border border-slate-200 rounded p-3 mb-4 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-900">📊 Top 15 jenis pemeriksaan Khanza {data.bulan}</summary>
            <table className="w-full mt-3 border border-slate-300">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">#</th>
                  <th className="border border-slate-300 px-2 py-1 text-left text-slate-900">Nama Pemeriksaan</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {data.khanza.top_jenis.slice(0, 15).map((t, i) => (
                  <tr key={i}>
                    <td className="border border-slate-300 px-2 py-1 text-slate-900">{i+1}</td>
                    <td className="border border-slate-300 px-2 py-1 text-slate-900">{t.nm_perawatan || "-"}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums font-semibold">{t.jumlah}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <table className="w-full text-sm border border-slate-300">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-2 w-16 text-slate-900">No</th>
                <th className="border border-slate-300 px-3 py-2 text-left text-slate-900">Jenis Kegiatan</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900">Jumlah</th>
                <th className="border border-slate-300 px-3 py-2 bg-amber-100 text-slate-900">Sugesti Khanza</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map(e => {
                if (e.is_parent === 1) {
                  return (
                    <tr key={e.id} className="bg-blue-50 font-bold">
                      <td className="border border-slate-300 px-3 py-2 text-center text-slate-900">{e.jenis_kode}</td>
                      <td colSpan={4} className="border border-slate-300 px-3 py-2 text-slate-900">{e.jenis_nama}</td>
                    </tr>
                  );
                }
                const c = cur(e.id!);
                const s = sugesti.get(e.jenis_kode);
                return (
                  <tr key={e.id} className={dirty(e.id!) ? "bg-amber-50" : ""}>
                    <td className="border border-slate-300 px-3 py-2 text-center text-slate-900">{e.jenis_kode}</td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-900">{e.jenis_nama}</td>
                    <td className="border border-slate-300 p-0">
                      <input type="number" min={0}
                        className="w-full px-3 py-2 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                        value={c.jumlah ?? 0}
                        onChange={ev => updateNum(e.id!, Math.max(0, parseInt(ev.target.value) || 0))} />
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-right bg-amber-50" title={s?.sumber || "tidak ada mapping"}>
                      {s ? <span className="font-semibold text-amber-700 tabular-nums">{s.count}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-center">
                      {dirty(e.id!) ? (
                        <button onClick={() => save(c)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded">Simpan</button>
                      ) : <span className="text-slate-400 text-xs">-</span>}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-blue-100 font-bold">
                <td className="border border-slate-300 px-3 py-2 text-center text-slate-900">99</td>
                <td className="border border-slate-300 px-3 py-2 text-slate-900">TOTAL</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{totalManual}</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-amber-700 tabular-nums">{data.khanza.sugesti_per_row.reduce((s, r) => s + r.count, 0)}</td>
                <td className="border border-slate-300 px-3 py-2"></td>
              </tr>
            </tbody>
          </table>

          <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded p-3 mt-4">
            <strong>Klasifikasi auto:</strong> 1.6 CT (nm LIKE 'CT%'), 1.5 Gigi (Gigi/Dental/Panoramic), 1.4 Flouroskopi, 1.7 Lympho, 1.8 Angio, 1.2 Kontras (Contrast/Kontras/IVP/Barium/Colon-in-loop), 4.1 USG, 4.2 MRI, 1.1 Foto X-ray standar (sisanya). Tombol "Terapkan Sugesti" akan menulis semua angka sugesti ke field manual sekaligus.
          </div>
        </>
      ) : null}
    </div>
  );
}
