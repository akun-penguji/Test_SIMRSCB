"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { getSirsRl316, updateSirsRl316, cetakSirsRl316, Rl316Resp, Rl316Entry } from "@/lib/api";

function thisYear() {
  return String(new Date().getFullYear());
}

const NUM_FIELDS: (keyof Rl316Entry)[] = [
  "pasca_persalinan", "pasca_keguguran", "interval_kb",
  "komplikasi", "kegagalan", "efek_samping", "drop_out",
];

export default function Rl316Page() {
  const [tahun, setTahun]     = useState(thisYear());
  const [data, setData]       = useState<Rl316Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [edits, setEdits]     = useState<Record<number, Rl316Entry>>({});

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl316(tahun).then(r => { setData(r.data); setEdits({}); })
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [tahun]);

  useEffect(() => { reload(); }, [reload]);

  const update = (id: number, field: keyof Rl316Entry, value: number) => {
    setEdits(es => {
      const base = es[id] || data?.entries.find(e => e.id === id);
      if (!base) return es;
      return { ...es, [id]: { ...base, [field]: value } };
    });
  };

  const save = async (e: Rl316Entry) => {
    if (!e.id) return;
    setErrMsg(""); setOkMsg("");
    try {
      await updateSirsRl316(e.id, e);
      setOkMsg(`✔ ${e.jenis_kode} tersimpan`);
      setEdits(es => { const c = { ...es }; delete c[e.id!]; return c; });
      setTimeout(() => setOkMsg(""), 2500);
      reload();
    } catch { setErrMsg("Gagal menyimpan"); }
  };

  const dirty = (id: number) => !!edits[id];
  const cur = (id: number) => edits[id] || data?.entries.find(e => e.id === id)!;

  const applyAutoAgregat = async () => {
    if (!data) return;
    const map = new Map<string, typeof data.khanza.akseptor_per_metode[number]>();
    data.khanza.akseptor_per_metode.forEach(r => map.set(r.metode, r));
    // metode JUKNIS kode → metode label di simrscb_kb_pelayanan
    const kodeToMetode: Record<string, string> = {
      "1": "Tubektomi", "2": "Vasektomi", "3": "Implan", "4": "IUD",
      "5": "Suntik", "6": "Pil", "7": "Kondom", "8": "MAL",
    };
    let saved = 0;
    for (const e of data.entries) {
      const m = kodeToMetode[e.jenis_kode];
      const row = m ? map.get(m) : undefined;
      if (!row) continue;
      const next: Rl316Entry = {
        ...e,
        pasca_persalinan: row.pasca_persalinan,
        pasca_keguguran:  row.pasca_keguguran,
        interval_kb:      row.interval_kb,
        komplikasi:       row.komplikasi,
        kegagalan:        row.kegagalan,
        efek_samping:     row.efek_samping,
        drop_out:         row.drop_out,
      };
      try { await updateSirsRl316(e.id!, next); saved++; } catch {/* skip */}
    }
    setOkMsg(`✔ Auto-agregat diterapkan untuk ${saved} metode dari Akseptor KB`);
    setTimeout(() => setOkMsg(""), 3000);
    reload();
  };

  const totals = useMemo(() => {
    if (!data) return { pp: 0, pk: 0, iv: 0, tot: 0, kpl: 0, kg: 0, es: 0, dop: 0 };
    const t = { pp: 0, pk: 0, iv: 0, tot: 0, kpl: 0, kg: 0, es: 0, dop: 0 };
    for (const e of data.entries) {
      const c = edits[e.id!] || e;
      t.pp += c.pasca_persalinan || 0;
      t.pk += c.pasca_keguguran || 0;
      t.iv += c.interval_kb || 0;
      t.kpl += c.komplikasi || 0;
      t.kg += c.kegagalan || 0;
      t.es += c.efek_samping || 0;
      t.dop += c.drop_out || 0;
    }
    t.tot = t.pp + t.pk + t.iv;
    return t;
  }, [data, edits]);

  return (
    <div className="p-4 max-w-[1400px] mx-auto">
      <nav className="text-sm mb-4">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 3.16 — Pelayanan Keluarga Berencana</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode <strong>tahunan</strong> · 8 metode × 7 kolom (Pelayanan: Pasca Persalinan/Keguguran/Interval + Komplikasi/Kegagalan/Efek Samping/Drop Out).
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
        <button onClick={applyAutoAgregat}
          className="bg-amber-500 hover:bg-amber-600 text-white text-sm px-4 py-2 rounded">⚡ Terapkan Auto-Agregat (Akseptor KB)</button>
        <Link href="/akseptor-kb"
          className="bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm px-4 py-2 rounded border border-blue-300">➜ Buka Input Transaksional</Link>
        <button onClick={() => cetakSirsRl316(tahun)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">🖨️ Cetak HTML</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}
      {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded p-3 mb-3">{okMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-900 text-sm rounded p-3 mb-3">
            📋 <strong>Modul Akseptor KB (transactional)</strong> tahun {data.tahun}: total <strong>{data.khanza.akseptor_total}</strong> akseptor terinput · pecah per metode:
            {data.khanza.akseptor_per_metode.length === 0 ? (
              <span className="ml-2 text-blue-700/70">— belum ada data.</span>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                {data.khanza.akseptor_per_metode.map(m => (
                  <div key={m.metode}><strong>{m.metode}</strong>: PP {m.pasca_persalinan} · PK {m.pasca_keguguran} · Int {m.interval_kb} (efek: {m.komplikasi}/{m.kegagalan}/{m.efek_samping}/{m.drop_out})</div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-xs rounded p-3 mb-4">
            💑 <strong>Khanza sanity {data.tahun}</strong>:
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
              <div>dx Z30 (kontrasepsi): <strong>{data.khanza.dx_z30_total}</strong></div>
              <div>Tubektomi (66.2/66.3): <strong>{data.khanza.prosedur_tubektomi}</strong></div>
              <div>Vasektomi (63.7): <strong>{data.khanza.prosedur_vasektomi}</strong></div>
              <div>IUD (69.7): <strong>{data.khanza.prosedur_iud}</strong></div>
              <div>Implan (99.23): <strong>{data.khanza.prosedur_implan}</strong></div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-300">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 w-12 text-slate-900">No</th>
                  <th rowSpan={2} className="border border-slate-300 px-3 py-1 text-left text-slate-900 min-w-[240px]">Jenis Pelayanan KB</th>
                  <th colSpan={4} className="border border-slate-300 px-2 py-1 bg-blue-100 text-slate-900">Pelayanan KB</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-slate-900">Komplikasi</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-slate-900">Kegagalan</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-slate-900">Efek Samping</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-slate-900">Drop Out</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-slate-900">Aksi</th>
                </tr>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Pasca Persalinan</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Pasca Keguguran</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Interval</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900 bg-blue-50">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map(e => {
                  const c = cur(e.id!);
                  const total = (c.pasca_persalinan||0) + (c.pasca_keguguran||0) + (c.interval_kb||0);
                  return (
                    <tr key={e.id} className={dirty(e.id!) ? "bg-amber-50" : ""}>
                      <td className="border border-slate-300 px-2 py-1 text-center text-slate-900">{e.jenis_kode}</td>
                      <td className="border border-slate-300 px-3 py-1 text-slate-900">{e.jenis_nama}</td>
                      {NUM_FIELDS.slice(0, 3).map(f => (
                        <td key={f} className="border border-slate-300 p-0">
                          <input type="number" min={0}
                            className="w-16 px-2 py-1 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                            value={(c[f] as number | null) ?? 0}
                            onChange={ev => update(e.id!, f, Math.max(0, parseInt(ev.target.value) || 0))} />
                        </td>
                      ))}
                      <td className="border border-slate-300 px-2 py-1 text-right font-semibold text-slate-900 tabular-nums">{total}</td>
                      {NUM_FIELDS.slice(3).map(f => (
                        <td key={f} className="border border-slate-300 p-0">
                          <input type="number" min={0}
                            className="w-16 px-2 py-1 text-right text-slate-900 tabular-nums bg-transparent focus:bg-rose-50 outline-none"
                            value={(c[f] as number | null) ?? 0}
                            onChange={ev => update(e.id!, f, Math.max(0, parseInt(ev.target.value) || 0))} />
                        </td>
                      ))}
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
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.pp}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.pk}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.iv}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.tot}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.kpl}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.kg}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.es}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.dop}</td>
                  <td className="border border-slate-300"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded p-3 mt-4">
            <strong>Catatan JUKNIS:</strong>
            <ol className="list-decimal ml-6 mt-1 space-y-1">
              <li><strong>Pasca Persalinan</strong>: 0-42 hari pasca melahirkan, semua metode modern.</li>
              <li><strong>Pasca Keguguran</strong>: 0-14 hari pasca keguguran.</li>
              <li><strong>Interval</strong>: KB interval untuk akseptor KB rutin.</li>
              <li>Total Pelayanan = Pasca Persalinan + Pasca Keguguran + Interval.</li>
              <li><strong>Komplikasi/Kegagalan/Efek Samping/Drop Out</strong>: jumlah Akseptor KB yang mengalaminya, per metode.</li>
            </ol>
            Modul KB Khanza belum aktif (dx Z30=0, prosedur KB=0). Input manual oleh petugas poli Kebidanan/KB/KIA.
          </div>
        </>
      ) : null}
    </div>
  );
}
