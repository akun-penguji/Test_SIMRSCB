"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { getSirsRl317, updateSirsRl317, cetakSirsRl317, Rl317Resp, Rl317Entry } from "@/lib/api";

function thisYear() { return String(new Date().getFullYear()); }

export default function Rl317Page() {
  const [tahun, setTahun]     = useState(thisYear());
  const [data, setData]       = useState<Rl317Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [edits, setEdits]     = useState<Record<number, Rl317Entry>>({});

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl317(tahun).then(r => { setData(r.data); setEdits({}); })
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [tahun]);

  useEffect(() => { reload(); }, [reload]);

  const update = (id: number, field: "jumlah_item" | "jumlah_tersedia", value: number) => {
    setEdits(es => {
      const base = es[id] || data?.entries.find(e => e.id === id);
      if (!base) return es;
      return { ...es, [id]: { ...base, [field]: value } };
    });
  };

  const save = async (e: Rl317Entry) => {
    if (!e.id) return;
    setErrMsg(""); setOkMsg("");
    try {
      await updateSirsRl317(e.id, e);
      setOkMsg(`✔ ${e.jenis_kode} tersimpan`);
      setEdits(es => { const c = { ...es }; delete c[e.id!]; return c; });
      setTimeout(() => setOkMsg(""), 2500);
      reload();
    } catch { setErrMsg("Gagal menyimpan"); }
  };

  const dirty = (id: number) => !!edits[id];
  const cur = (id: number) => edits[id] || data?.entries.find(e => e.id === id)!;

  const totals = useMemo(() => {
    if (!data) return { item: 0, tersedia: 0 };
    let item = 0, tersedia = 0;
    for (const e of data.entries) {
      const c = edits[e.id!] || e;
      item += c.jumlah_item || 0;
      tersedia += c.jumlah_tersedia || 0;
    }
    return { item, tersedia };
  }, [data, edits]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <nav className="text-sm mb-4">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 3.17 — Farmasi RS Pengadaan Obat</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode <strong>tahunan</strong> · 4 golongan obat × 2 kolom (Jumlah Item + Jumlah Tersedia).
          Generik/Non Generik di-sanity dari Khanza <code>databarang.kode_kategori</code> (K01/K02).
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
        <button onClick={() => cetakSirsRl317(tahun)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">🖨️ Cetak HTML</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}
      {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded p-3 mb-3">{okMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-sm rounded p-3 mb-4">
            💊 <strong>Khanza databarang aktif {data.tahun}</strong> (excl. Alkes/BMHP/Suplemen/Jamu/Herbal):
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
              <div>Generik: <strong>{data.khanza.generik_total}</strong></div>
              <div>Non Generik: <strong>{data.khanza.non_generik_total}</strong></div>
              <div>Tanpa kategori: <strong>{data.khanza.tanpa_kategori}</strong></div>
              <div>Total: <strong>{data.khanza.total_obat_aktif}</strong></div>
            </div>
            <div className="mt-2 text-xs">
              Konsistensi: jumlah baris 1+2 (Generik) ≈ <strong>{data.khanza.generik_total}</strong>;
              jumlah baris 3+4 (Non Generik) ≈ <strong>{data.khanza.non_generik_total}</strong>.
              Petugas Farmasi memecah Fornas/Non Fornas berdasarkan daftar Kemenkes.
            </div>
          </div>

          <table className="w-full text-sm border border-slate-300">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-2 w-16 text-slate-900">No</th>
                <th className="border border-slate-300 px-3 py-2 text-left text-slate-900">Golongan Obat</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900">Jumlah Item Obat</th>
                <th className="border border-slate-300 px-3 py-2 text-slate-900">Jumlah Item Obat<br/>Tersedia di RS</th>
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
                    <td className="border border-slate-300 p-0">
                      <input type="number" min={0}
                        className="w-full px-3 py-2 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                        value={c.jumlah_item ?? 0}
                        onChange={ev => update(e.id!, "jumlah_item", Math.max(0, parseInt(ev.target.value) || 0))} />
                    </td>
                    <td className="border border-slate-300 p-0">
                      <input type="number" min={0}
                        className="w-full px-3 py-2 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                        value={c.jumlah_tersedia ?? 0}
                        onChange={ev => update(e.id!, "jumlah_tersedia", Math.max(0, parseInt(ev.target.value) || 0))} />
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
                <td className="border border-slate-300 px-3 py-2 text-slate-900">Total</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{totals.item}</td>
                <td className="border border-slate-300 px-3 py-2 text-right text-slate-900 tabular-nums">{totals.tersedia}</td>
                <td className="border border-slate-300"></td>
              </tr>
            </tbody>
          </table>

          <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded p-3 mt-4">
            <strong>Catatan JUKNIS:</strong>
            <ol className="list-decimal ml-6 mt-1 space-y-1">
              <li><strong>Jumlah Item Obat</strong>: jumlah item obat sesuai kebutuhan RS.</li>
              <li><strong>Jumlah Tersedia di RS</strong>: jumlah item obat di akhir tahun (saat laporan dibuat) yang masih jadi stok.</li>
              <li><strong>Generik Fornas</strong>: obat generik tercantum di Formularium Nasional Kemenkes.</li>
              <li><strong>Non Generik Fornas</strong>: obat paten tercantum di Fornas.</li>
              <li>Item obat = nama/merk + kekuatan + satuan + sediaan. Misal: <em>Amoksisilin 100 mg/ml drops</em>.</li>
            </ol>
          </div>
        </>
      ) : null}
    </div>
  );
}
