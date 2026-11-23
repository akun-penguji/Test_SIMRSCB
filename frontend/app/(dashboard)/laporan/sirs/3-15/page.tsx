"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { getSirsRl315, updateSirsRl315, cetakSirsRl315, Rl315Resp, Rl315Entry } from "@/lib/api";

function thisYear() {
  return String(new Date().getFullYear());
}

export default function Rl315Page() {
  const [tahun, setTahun]     = useState(thisYear());
  const [data, setData]       = useState<Rl315Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [edits, setEdits]     = useState<Record<number, Rl315Entry>>({});

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl315(tahun).then(r => { setData(r.data); setEdits({}); })
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [tahun]);

  useEffect(() => { reload(); }, [reload]);

  const update = (id: number, field: keyof Rl315Entry, value: number) => {
    setEdits(es => {
      const base = es[id] || data?.entries.find(e => e.id === id);
      if (!base) return es;
      return { ...es, [id]: { ...base, [field]: value } };
    });
  };

  const save = async (e: Rl315Entry) => {
    if (!e.id) return;
    setErrMsg(""); setOkMsg("");
    try {
      await updateSirsRl315(e.id, e);
      setOkMsg(`✔ ${e.jenis_kode} tersimpan`);
      setEdits(es => { const c = { ...es }; delete c[e.id!]; return c; });
      setTimeout(() => setOkMsg(""), 2500);
      reload();
    } catch { setErrMsg("Gagal menyimpan"); }
  };

  const dirty = (id: number) => !!edits[id];
  const cur = (id: number) => edits[id] || data?.entries.find(e => e.id === id)!;

  const totals = useMemo(() => {
    if (!data) return { l: 0, p: 0, total: 0 };
    let l = 0, p = 0;
    for (const e of data.entries) {
      const c = edits[e.id!] || e;
      l += c.jml_l || 0; p += c.jml_p || 0;
    }
    return { l, p, total: l + p };
  }, [data, edits]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <nav className="text-sm mb-4">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 3.15 — Pelayanan Kesehatan Jiwa</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode <strong>tahunan</strong> · 8 jenis kegiatan × Laki-laki + Perempuan (Jumlah = L + P) · Sumber sugesti Khanza: <code>diagnosa_pasien</code> F00-F99 × pasien.jk.
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
        <button onClick={() => cetakSirsRl315(tahun)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">🖨️ Cetak HTML</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}
      {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded p-3 mb-3">{okMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-sm rounded p-3 mb-4">
            🧠 <strong>Khanza diagnosa F (mental disorders) {data.tahun}</strong>:
            total = <strong>{data.khanza.dx_f_total}</strong> pasien (<strong>{data.khanza.dx_f_l}</strong> L · <strong>{data.khanza.dx_f_p}</strong> P).
            Sugesti untuk row 1 Pemeriksaan Psikiatri.
          </div>

          {data.khanza.top_dx_f.length > 0 && (
            <details className="bg-slate-50 border border-slate-200 rounded p-3 mb-4 text-xs">
              <summary className="cursor-pointer font-semibold text-slate-900">📊 Top diagnosa F (ICD-10 Mental & Behavioural) {data.tahun}</summary>
              <table className="w-full mt-3 border border-slate-300">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-300 px-2 py-1 text-slate-900">#</th>
                    <th className="border border-slate-300 px-2 py-1 text-slate-900">ICD</th>
                    <th className="border border-slate-300 px-2 py-1 text-left text-slate-900">Nama Penyakit</th>
                    <th className="border border-slate-300 px-2 py-1 text-slate-900">L</th>
                    <th className="border border-slate-300 px-2 py-1 text-slate-900">P</th>
                    <th className="border border-slate-300 px-2 py-1 text-slate-900">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.khanza.top_dx_f.map((t, i) => (
                    <tr key={i}>
                      <td className="border border-slate-300 px-2 py-1 text-slate-900">{i+1}</td>
                      <td className="border border-slate-300 px-2 py-1 font-mono text-slate-900">{t.kd_penyakit || "-"}</td>
                      <td className="border border-slate-300 px-2 py-1 text-slate-900">{t.nm_penyakit || "-"}</td>
                      <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{t.jml_l}</td>
                      <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{t.jml_p}</td>
                      <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums font-semibold">{t.jml}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          <table className="w-full text-sm border border-slate-300">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-2 w-16 text-slate-900">No</th>
                <th className="border border-slate-300 px-3 py-2 text-left text-slate-900">Jenis Kegiatan</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900">Laki-laki</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900">Perempuan</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900">Jumlah</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map(e => {
                const c = cur(e.id!);
                const total = (c.jml_l||0) + (c.jml_p||0);
                return (
                  <tr key={e.id} className={dirty(e.id!) ? "bg-amber-50" : ""}>
                    <td className="border border-slate-300 px-3 py-2 text-center text-slate-900">{e.jenis_kode}</td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-900">{e.jenis_nama}</td>
                    <td className="border border-slate-300 p-0">
                      <input type="number" min={0}
                        className="w-full px-3 py-2 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                        value={c.jml_l ?? 0}
                        onChange={ev => update(e.id!, "jml_l", Math.max(0, parseInt(ev.target.value) || 0))} />
                    </td>
                    <td className="border border-slate-300 p-0">
                      <input type="number" min={0}
                        className="w-full px-3 py-2 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                        value={c.jml_p ?? 0}
                        onChange={ev => update(e.id!, "jml_p", Math.max(0, parseInt(ev.target.value) || 0))} />
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-semibold text-slate-900 tabular-nums">{total}</td>
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
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{totals.l}</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{totals.p}</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{totals.total}</td>
                <td className="border border-slate-300"></td>
              </tr>
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}
