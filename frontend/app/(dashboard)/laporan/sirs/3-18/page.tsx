"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { getSirsRl318, updateSirsRl318, cetakSirsRl318, Rl318Resp, Rl318Entry } from "@/lib/api";

function thisYear() { return String(new Date().getFullYear()); }

export default function Rl318Page() {
  const [tahun, setTahun]     = useState(thisYear());
  const [data, setData]       = useState<Rl318Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [edits, setEdits]     = useState<Record<number, Rl318Entry>>({});

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl318(tahun).then(r => { setData(r.data); setEdits({}); })
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [tahun]);

  useEffect(() => { reload(); }, [reload]);

  const update = (id: number, field: "rawat_jalan" | "igd" | "rawat_inap", value: number) => {
    setEdits(es => {
      const base = es[id] || data?.entries.find(e => e.id === id);
      if (!base) return es;
      return { ...es, [id]: { ...base, [field]: value } };
    });
  };

  const save = async (e: Rl318Entry) => {
    if (!e.id) return;
    setErrMsg(""); setOkMsg("");
    try {
      await updateSirsRl318(e.id, e);
      setOkMsg(`✔ ${e.jenis_kode} tersimpan`);
      setEdits(es => { const c = { ...es }; delete c[e.id!]; return c; });
      setTimeout(() => setOkMsg(""), 2500);
      reload();
    } catch { setErrMsg("Gagal menyimpan"); }
  };

  const dirty = (id: number) => !!edits[id];
  const cur = (id: number) => edits[id] || data?.entries.find(e => e.id === id)!;

  const totals = useMemo(() => {
    if (!data) return { rj: 0, ig: 0, ri: 0 };
    let rj = 0, ig = 0, ri = 0;
    for (const e of data.entries) {
      const c = edits[e.id!] || e;
      rj += c.rawat_jalan || 0;
      ig += c.igd || 0;
      ri += c.rawat_inap || 0;
    }
    return { rj, ig, ri };
  }, [data, edits]);

  const pivot = (lok: string, kat: string) =>
    data?.khanza.per_lokasi_kategori.find(r => r.lokasi === lok && r.kategori === kat)?.jml || 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <nav className="text-sm mb-4">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 3.18 — Farmasi RS Resep</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode <strong>tahunan</strong> · 4 golongan obat × 3 lokasi (Rawat Jalan / IGD / Rawat Inap).
          Sumber Khanza: <code>resep_obat × resep_dokter × databarang × kategori_barang × reg_periksa</code>.
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
        <button onClick={() => cetakSirsRl318(tahun)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">🖨️ Cetak HTML</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}
      {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded p-3 mb-3">{okMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-sm rounded p-3 mb-4">
            💊 <strong>Khanza R/ items {data.tahun}</strong>: total <strong>{data.khanza.total_resep_items.toLocaleString()}</strong>
            <table className="w-full mt-2 text-xs border border-amber-200">
              <thead className="bg-amber-100">
                <tr>
                  <th className="border border-amber-200 px-2 py-1">Lokasi</th>
                  <th className="border border-amber-200 px-2 py-1">Generik</th>
                  <th className="border border-amber-200 px-2 py-1">Non Generik</th>
                  <th className="border border-amber-200 px-2 py-1">Tanpa kategori</th>
                </tr>
              </thead>
              <tbody>
                {[["Ralan","Rawat Jalan"],["IGD","IGD"],["Ranap","Rawat Inap"]].map(([key, label]) => (
                  <tr key={key}>
                    <td className="border border-amber-200 px-2 py-1 font-semibold">{label}</td>
                    <td className="border border-amber-200 px-2 py-1 text-right tabular-nums">{pivot(key, "GENERIK").toLocaleString()}</td>
                    <td className="border border-amber-200 px-2 py-1 text-right tabular-nums">{pivot(key, "NON GENERIK").toLocaleString()}</td>
                    <td className="border border-amber-200 px-2 py-1 text-right tabular-nums">{(data.khanza.per_lokasi_kategori.find(r => r.lokasi === key && !r.kategori)?.jml || pivot(key, "-")).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <table className="w-full text-sm border border-slate-300">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-2 w-16 text-slate-900">No</th>
                <th className="border border-slate-300 px-3 py-2 text-left text-slate-900">Golongan Obat</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900">Rawat Jalan</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900">IGD</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900">Rawat Inap</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map(e => {
                const c = cur(e.id!);
                return (
                  <tr key={e.id} className={dirty(e.id!) ? "bg-amber-50" : ""}>
                    <td className="border border-slate-300 px-3 py-2 text-center text-slate-900">{e.jenis_kode}</td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-900">{e.jenis_nama}</td>
                    {(["rawat_jalan","igd","rawat_inap"] as const).map(f => (
                      <td key={f} className="border border-slate-300 p-0">
                        <input type="number" min={0}
                          className="w-full px-3 py-2 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                          value={c[f] ?? 0}
                          onChange={ev => update(e.id!, f, Math.max(0, parseInt(ev.target.value) || 0))} />
                      </td>
                    ))}
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
                <td className="border border-slate-300 px-3 py-2 text-slate-900">Total</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{totals.rj.toLocaleString()}</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{totals.ig.toLocaleString()}</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{totals.ri.toLocaleString()}</td>
                <td className="border border-slate-300"></td>
              </tr>
            </tbody>
          </table>

          <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded p-3 mt-4">
            <strong>Catatan JUKNIS:</strong> jumlah R/ (1 R/ = 1 item obat dalam resep). Petugas farmasi memecah <strong>Generik</strong> (Khanza ≈ {(pivot("Ralan","GENERIK")+pivot("IGD","GENERIK")+pivot("Ranap","GENERIK")).toLocaleString()}) menjadi baris 1+2 dan <strong>Non Generik</strong> (≈ {(pivot("Ralan","NON GENERIK")+pivot("IGD","NON GENERIK")+pivot("Ranap","NON GENERIK")).toLocaleString()}) menjadi baris 3+4 sesuai daftar Formularium Nasional Kemenkes.
          </div>
        </>
      ) : null}
    </div>
  );
}
