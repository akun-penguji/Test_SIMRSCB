"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { getSirsRl311, updateSirsRl311, cetakSirsRl311, Rl311Resp, Rl311Entry } from "@/lib/api";

function thisYear() {
  return String(new Date().getFullYear());
}

export default function Rl311Page() {
  const [tahun, setTahun]     = useState(thisYear());
  const [data, setData]       = useState<Rl311Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [edits, setEdits]     = useState<Record<number, Rl311Entry>>({});

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl311(tahun).then(r => { setData(r.data); setEdits({}); })
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [tahun]);

  useEffect(() => { reload(); }, [reload]);

  const updateNum = (id: number, value: number) => {
    setEdits(es => {
      const base = es[id] || data?.entries.find(e => e.id === id);
      if (!base) return es;
      return { ...es, [id]: { ...base, jumlah: value } };
    });
  };

  const save = async (e: Rl311Entry) => {
    if (!e.id) return;
    setErrMsg(""); setOkMsg("");
    try {
      await updateSirsRl311(e.id, e);
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
    return data.entries.reduce((s, e) => s + ((edits[e.id!] || e).jumlah || 0), 0);
  }, [data, edits]);

  const totalSugesti = useMemo(() => {
    return (data?.khanza.sugesti_per_row || []).reduce((s, r) => s + r.count, 0);
  }, [data]);

  const applyAllSugesti = async () => {
    if (!data) return;
    let saved = 0;
    for (const e of data.entries) {
      const s = sugesti.get(e.jenis_kode);
      if (!s) continue;
      if (e.jumlah === s.count) continue;
      try { await updateSirsRl311(e.id!, { ...e, jumlah: s.count }); saved++; } catch {/* skip */}
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
        <h1 className="text-2xl font-bold text-slate-900">RL 3.11 — Pelayanan Gigi dan Mulut</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode <strong>tahunan</strong> · 16 jenis kegiatan · Sumber Khanza: <code>rawat_jl_dr + rawat_jl_drpr × jns_perawatan</code> filter kd_poli='GIG'.
        </p>
      </header>

      <div className="flex items-end gap-3 mb-5 flex-wrap">
        <div>
          <label className="block text-xs text-slate-900 mb-1">Tahun Pelaporan</label>
          <input type="number" min={2019} max={2099} value={tahun}
            onChange={e => setTahun(e.target.value)}
            className="w-32 border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
        </div>
        <button onClick={reload}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 py-2 rounded border border-slate-300">🔄 Refresh</button>
        <button onClick={applyAllSugesti}
          className="bg-amber-500 hover:bg-amber-600 text-white text-sm px-4 py-2 rounded">⚡ Terapkan Sugesti Khanza</button>
        <button onClick={() => cetakSirsRl311(tahun)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">🖨️ Cetak HTML</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}
      {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded p-3 mb-3">{okMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-sm rounded p-3 mb-4">
            🦷 <strong>Khanza poli GIG tahun {data.tahun}</strong>: kunjungan = <strong>{data.khanza.kunjungan_poli_gig}</strong>
            · total tindakan = <strong>{data.khanza.total_tindakan}</strong>.
            Manual RL 3.11 total: <strong>{totalManual}</strong> · Sugesti total: <strong>{totalSugesti}</strong>.
          </div>

          <details className="bg-slate-50 border border-slate-200 rounded p-3 mb-4 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-900">📊 Top 15 tindakan poli GIG Khanza {data.tahun}</summary>
            <table className="w-full mt-3 border border-slate-300">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">#</th>
                  <th className="border border-slate-300 px-2 py-1 text-left text-slate-900">Nama Tindakan</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {data.khanza.top_tindakan.slice(0, 15).map((t, i) => (
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
                <td className="border border-slate-300 px-3 py-2 text-right text-amber-700 tabular-nums">{totalSugesti}</td>
                <td className="border border-slate-300"></td>
              </tr>
            </tbody>
          </table>

          <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded p-3 mt-4">
            <strong>Klasifikasi auto:</strong> 1 Tumpatan Tetap (Tambalan/Komposit/GI exclude sementara), 2 Sulung (Tambalan Sulung), 3 Pulpa (Pulpa/Endo/RCT/Pulp Cap), 4 Ekstraksi Tetap, 5 Ekstraksi Sulung/Susu, 6 Periodontal/Kuretasi/Root Planning, 7 Abses/Insisi, 8 Skeling/Karang, 9 GT Penuh, 10 GT Lepasan (exclude Penuh), 11 GT Cekat/Inlay, 12 Ortho/Braket, 13 Crown/Bridge/Mahkota, 14 Odontectomy/Alveolectomy/Bedah Mulut, 15 Implan. 16 Penyakit Mulut tidak dipetakan otomatis.
          </div>
        </>
      ) : null}
    </div>
  );
}
