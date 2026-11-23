"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { getSirsRl312, updateSirsRl312, cetakSirsRl312, Rl312Resp, Rl312Entry } from "@/lib/api";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const NUM_FIELDS: (keyof Rl312Entry)[] = ["khusus", "besar", "sedang", "kecil"];

export default function Rl312Page() {
  const [bulan, setBulan]     = useState(thisMonth());
  const [data, setData]       = useState<Rl312Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [edits, setEdits]     = useState<Record<number, Rl312Entry>>({});

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl312(bulan).then(r => { setData(r.data); setEdits({}); })
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => { reload(); }, [reload]);

  const update = (id: number, field: keyof Rl312Entry, value: number) => {
    setEdits(es => {
      const base = es[id] || data?.entries.find(e => e.id === id);
      if (!base) return es;
      return { ...es, [id]: { ...base, [field]: value } };
    });
  };

  const save = async (e: Rl312Entry) => {
    if (!e.id) return;
    setErrMsg(""); setOkMsg("");
    try {
      await updateSirsRl312(e.id, e);
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

  const totals = useMemo(() => {
    if (!data) return { khusus: 0, besar: 0, sedang: 0, kecil: 0, total: 0 };
    const t = { khusus: 0, besar: 0, sedang: 0, kecil: 0, total: 0 };
    for (const e of data.entries) {
      const c = edits[e.id!] || e;
      t.khusus += c.khusus || 0; t.besar += c.besar || 0;
      t.sedang += c.sedang || 0; t.kecil += c.kecil || 0;
    }
    t.total = t.khusus + t.besar + t.sedang + t.kecil;
    return t;
  }, [data, edits]);

  const totalSugesti = useMemo(() =>
    (data?.khanza.sugesti_per_row || []).reduce((s, r) => s + r.count, 0)
  , [data]);

  return (
    <div className="p-4 max-w-[1300px] mx-auto">
      <nav className="text-sm mb-4">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 3.12 — Pelayanan Pembedahan</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode bulanan · 16 spesialisasi × 4 golongan (Khusus/Besar/Sedang/Kecil) · Sumber Khanza: <code>prosedur_pasien × icd9</code> (status=Ranap).
          Klasifikasi K/B/S/K = manual sesuai kebijakan RS.
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
        <button onClick={() => cetakSirsRl312(bulan)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">🖨️ Cetak HTML</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}
      {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded p-3 mb-3">{okMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-sm rounded p-3 mb-4">
            🔪 <strong>Khanza prosedur_pasien {data.bulan}</strong>: Ranap = <strong>{data.khanza.total_prosedur_ranap}</strong>
            · Ralan = <strong>{data.khanza.total_prosedur_ralan}</strong>
            · Manual RL 3.12 total = <strong>{totals.total}</strong>
            · Sugesti total = <strong>{totalSugesti}</strong>
          </div>

          <details className="bg-slate-50 border border-slate-200 rounded p-3 mb-4 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-900">📊 Top 15 prosedur Khanza {data.bulan} (status=Ranap)</summary>
            <table className="w-full mt-3 border border-slate-300">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">#</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">ICD-9</th>
                  <th className="border border-slate-300 px-2 py-1 text-left text-slate-900">Deskripsi</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {data.khanza.top_prosedur.slice(0, 15).map((t, i) => (
                  <tr key={i}>
                    <td className="border border-slate-300 px-2 py-1 text-slate-900">{i+1}</td>
                    <td className="border border-slate-300 px-2 py-1 font-mono text-slate-900">{t.kode || "-"}</td>
                    <td className="border border-slate-300 px-2 py-1 text-slate-900">{t.deskripsi || "-"}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums font-semibold">{t.jumlah}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <table className="w-full text-sm border border-slate-300">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-2 w-12 text-slate-900">No</th>
                <th className="border border-slate-300 px-3 py-2 text-left text-slate-900">Spesialisasi</th>
                <th className="border border-slate-300 px-2 py-2 text-slate-900">Khusus</th>
                <th className="border border-slate-300 px-2 py-2 text-slate-900">Besar</th>
                <th className="border border-slate-300 px-2 py-2 text-slate-900">Sedang</th>
                <th className="border border-slate-300 px-2 py-2 text-slate-900">Kecil</th>
                <th className="border border-slate-300 px-2 py-2 text-slate-900">Total</th>
                <th className="border border-slate-300 px-2 py-2 bg-amber-100 text-slate-900">Sugesti<br/>Khanza</th>
                <th className="border border-slate-300 px-2 py-2 text-slate-900">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map(e => {
                const c = cur(e.id!);
                const total = (c.khusus||0) + (c.besar||0) + (c.sedang||0) + (c.kecil||0);
                const s = sugesti.get(e.jenis_kode);
                return (
                  <tr key={e.id} className={dirty(e.id!) ? "bg-amber-50" : ""}>
                    <td className="border border-slate-300 px-2 py-1 text-center text-slate-900">{e.jenis_kode}</td>
                    <td className="border border-slate-300 px-3 py-1 text-slate-900">{e.jenis_nama}</td>
                    {NUM_FIELDS.map(f => (
                      <td key={f} className="border border-slate-300 p-0">
                        <input type="number" min={0}
                          className="w-16 px-2 py-1 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                          value={(c[f] as number | null) ?? 0}
                          onChange={ev => update(e.id!, f, Math.max(0, parseInt(ev.target.value) || 0))} />
                      </td>
                    ))}
                    <td className="border border-slate-300 px-2 py-1 text-right font-semibold text-slate-900 tabular-nums">{total}</td>
                    <td className="border border-slate-300 px-2 py-1 text-center bg-amber-50" title={s?.sumber || "tidak ada mapping"}>
                      {s && s.count > 0 ? <span className="font-semibold text-amber-700 tabular-nums">{s.count}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center">
                      {dirty(e.id!) ? (
                        <button onClick={() => save(c)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded">Simpan</button>
                      ) : <span className="text-slate-400 text-xs">-</span>}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-blue-100 font-bold">
                <td className="border border-slate-300 px-2 py-1 text-center text-slate-900">99</td>
                <td className="border border-slate-300 px-3 py-1 text-slate-900">TOTAL</td>
                <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.khusus}</td>
                <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.besar}</td>
                <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.sedang}</td>
                <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.kecil}</td>
                <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.total}</td>
                <td className="border border-slate-300 px-2 py-1 text-right text-amber-700 tabular-nums">{totalSugesti}</td>
                <td className="border border-slate-300"></td>
              </tr>
            </tbody>
          </table>

          <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded p-3 mt-4">
            <strong>Sugesti spesialisasi via ICD-9 chapter</strong> (klasifikasi K/B/S/K diisi manual sesuai kebijakan RS):
            01-05 Saraf · 08-16 Mata · 18-22, 25-29 THT · 23-24 Gigi · 30-34 Thoraks · 35-39 Kardiovaskular · 00.5 Kardiovaskular ·
            40-41, 85-86 Bedah · 42-54 Digestif · 55-63 Urologi · 64 Kulit · 65-71 Ginekologi · 72-75 Obstetri · 76-84 Orthopedi.
            <strong>Tidak ada mapping ICD-9</strong>: Bedah Anak (mapped manual via umur), Bedah Saraf Stroke, Kanker (manual via dx ICD-10).
          </div>
        </>
      ) : null}
    </div>
  );
}
