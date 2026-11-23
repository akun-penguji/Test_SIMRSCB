"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { getSirsRl310, updateSirsRl310, cetakSirsRl310, Rl310Resp, Rl310Entry } from "@/lib/api";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const NUM_FIELDS: (keyof Rl310Entry)[] = [
  "rm_in_pus", "rm_in_rs", "rm_in_faskes",
  "rm_out_pus", "rm_out_rs", "rm_out_faskes",
  "rk_pasien_rujukan", "rk_pasien_datang_sendiri", "rk_diterima_kembali",
];

export default function Rl310Page() {
  const [bulan, setBulan]     = useState(thisMonth());
  const [data, setData]       = useState<Rl310Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [edits, setEdits]     = useState<Record<number, Rl310Entry>>({});

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl310(bulan).then(r => { setData(r.data); setEdits({}); })
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => { reload(); }, [reload]);

  const update = (id: number, field: keyof Rl310Entry, value: number) => {
    setEdits(es => {
      const base = es[id] || data?.entries.find(e => e.id === id);
      if (!base) return es;
      return { ...es, [id]: { ...base, [field]: value } };
    });
  };

  const save = async (e: Rl310Entry) => {
    if (!e.id) return;
    setErrMsg(""); setOkMsg("");
    try {
      await updateSirsRl310(e.id, e);
      setOkMsg(`✔ ${e.jenis_kode} tersimpan`);
      setEdits(es => { const c = { ...es }; delete c[e.id!]; return c; });
      setTimeout(() => setOkMsg(""), 2500);
      reload();
    } catch { setErrMsg("Gagal menyimpan"); }
  };

  const dirty = (id: number) => !!edits[id];
  const cur = (id: number) => edits[id] || data?.entries.find(e => e.id === id)!;

  const sugesti = useMemo(() => {
    const m = new Map<string, { rm_in_total: number; rm_in_pus: number; rm_in_rs: number; rm_in_faskes: number; rk_total: number }>();
    data?.khanza.per_spesialisasi.forEach(s => m.set(s.jenis_kode, {
      rm_in_total: s.rm_in_total,
      rm_in_pus: s.rm_in_pus_pattern,
      rm_in_rs: s.rm_in_rs_pattern,
      rm_in_faskes: s.rm_in_faskes_other,
      rk_total: s.rk_total,
    }));
    return m;
  }, [data]);

  const totals = useMemo(() => {
    if (!data) return { in_pus: 0, in_rs: 0, in_fk: 0, in_tot: 0, out_pus: 0, out_rs: 0, out_fk: 0, out_tot: 0, rk_ruj: 0, rk_sen: 0, rk_tot: 0, rk_kbl: 0 };
    const t = { in_pus: 0, in_rs: 0, in_fk: 0, in_tot: 0, out_pus: 0, out_rs: 0, out_fk: 0, out_tot: 0, rk_ruj: 0, rk_sen: 0, rk_tot: 0, rk_kbl: 0 };
    for (const e of data.entries) {
      const c = edits[e.id!] || e;
      t.in_pus += c.rm_in_pus || 0; t.in_rs += c.rm_in_rs || 0; t.in_fk += c.rm_in_faskes || 0;
      t.out_pus += c.rm_out_pus || 0; t.out_rs += c.rm_out_rs || 0; t.out_fk += c.rm_out_faskes || 0;
      t.rk_ruj += c.rk_pasien_rujukan || 0; t.rk_sen += c.rk_pasien_datang_sendiri || 0;
      t.rk_kbl += c.rk_diterima_kembali || 0;
    }
    t.in_tot = t.in_pus + t.in_rs + t.in_fk;
    t.out_tot = t.out_pus + t.out_rs + t.out_fk;
    t.rk_tot = t.rk_ruj + t.rk_sen;
    return t;
  }, [data, edits]);

  const applySugesti = async () => {
    if (!data) return;
    let saved = 0;
    for (const e of data.entries) {
      const s = sugesti.get(e.jenis_kode);
      if (!s) continue;
      // hanya isi RM Diterima Dari (in_pus, in_rs, in_faskes) — RM Dikembalikan & Dirujuk Keluar manual
      if (s.rm_in_pus === (e.rm_in_pus || 0) && s.rm_in_rs === (e.rm_in_rs || 0) && s.rm_in_faskes === (e.rm_in_faskes || 0)) continue;
      try {
        await updateSirsRl310(e.id!, { ...e, rm_in_pus: s.rm_in_pus, rm_in_rs: s.rm_in_rs, rm_in_faskes: s.rm_in_faskes });
        saved++;
      } catch { /* skip */ }
    }
    setOkMsg(`✔ Sugesti RM Diterima diterapkan ke ${saved} baris`);
    setTimeout(() => setOkMsg(""), 3000);
    reload();
  };

  return (
    <div className="p-4 max-w-[1500px] mx-auto">
      <nav className="text-sm mb-4">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 3.10 — Pelayanan Rujukan</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode bulanan · 20 spesialisasi × (RM Diterima 3 + RM Dikembalikan 3 + Dirujuk Keluar 3) · Sumber Khanza: <code>rujuk_masuk × reg_periksa.kd_poli</code>.
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
        <button onClick={applySugesti}
          className="bg-amber-500 hover:bg-amber-600 text-white text-sm px-4 py-2 rounded">⚡ Terapkan Sugesti RM Diterima</button>
        <button onClick={() => cetakSirsRl310(bulan)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">🖨️ Cetak HTML</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}
      {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded p-3 mb-3">{okMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-xs rounded p-3 mb-4">
            🔄 <strong>Khanza rujukan {data.bulan}</strong>:
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-2">
              <div>rujuk_masuk total: <strong>{data.khanza.rujuk_masuk_total}</strong></div>
              <div>Pus pattern: <strong>{data.khanza.rujuk_masuk_pus_pattern}</strong></div>
              <div>RS pattern: <strong>{data.khanza.rujuk_masuk_rs_pattern}</strong></div>
              <div>Faskes lain: <strong>{data.khanza.rujuk_masuk_faskes_other}</strong></div>
              <div>perujuk kosong: <strong>{data.khanza.rujuk_masuk_kosong}</strong></div>
              <div>rujuk (keluar): <strong>{data.khanza.rujuk_keluar_total}</strong></div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border border-slate-300 min-w-[1500px]">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 w-12 text-slate-900">No</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-left text-slate-900 min-w-[160px]">Spesialisasi</th>
                  <th colSpan={4} className="border border-slate-300 px-1 py-1 bg-blue-100 text-slate-900">RM Diterima Dari</th>
                  <th colSpan={4} className="border border-slate-300 px-1 py-1 bg-purple-100 text-slate-900">RM Dikembalikan ke</th>
                  <th colSpan={4} className="border border-slate-300 px-1 py-1 bg-pink-100 text-slate-900">Dirujuk Keluar</th>
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 bg-amber-100 text-slate-900">Sugesti<br/>RM</th>
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 text-slate-900">Aksi</th>
                </tr>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Pus</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">RS</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Faskes</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900 bg-blue-50">Tot</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Pus</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">RS Asal</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Faskes</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900 bg-purple-50">Tot</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Pas. Ruj</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Pas. Sndr</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900 bg-pink-50">Tot</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Dit. Kbl</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map(e => {
                  const c = cur(e.id!);
                  const in_tot = (c.rm_in_pus||0) + (c.rm_in_rs||0) + (c.rm_in_faskes||0);
                  const out_tot = (c.rm_out_pus||0) + (c.rm_out_rs||0) + (c.rm_out_faskes||0);
                  const rk_tot = (c.rk_pasien_rujukan||0) + (c.rk_pasien_datang_sendiri||0);
                  const out_invalid = out_tot > in_tot;
                  const kbl_invalid = (c.rk_diterima_kembali||0) > rk_tot;
                  const s = sugesti.get(e.jenis_kode);
                  return (
                    <tr key={e.id} className={dirty(e.id!) ? "bg-amber-50" : ((out_invalid || kbl_invalid) ? "bg-rose-50" : "")}>
                      <td className="border border-slate-300 px-1 py-1 text-center text-slate-900">{e.jenis_kode}</td>
                      <td className="border border-slate-300 px-2 py-1 text-slate-900">{e.jenis_nama}</td>
                      {NUM_FIELDS.slice(0, 3).map(f => (
                        <td key={f} className="border border-slate-300 p-0">
                          <input type="number" min={0}
                            className="w-12 px-1 py-0.5 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                            value={(c[f] as number | null) ?? 0}
                            onChange={ev => update(e.id!, f, Math.max(0, parseInt(ev.target.value) || 0))} />
                        </td>
                      ))}
                      <td className="border border-slate-300 px-1 py-1 text-right font-semibold text-slate-900 tabular-nums">{in_tot}</td>
                      {NUM_FIELDS.slice(3, 6).map(f => (
                        <td key={f} className="border border-slate-300 p-0">
                          <input type="number" min={0}
                            className="w-12 px-1 py-0.5 text-right text-slate-900 tabular-nums bg-transparent focus:bg-purple-50 outline-none"
                            value={(c[f] as number | null) ?? 0}
                            onChange={ev => update(e.id!, f, Math.max(0, parseInt(ev.target.value) || 0))} />
                        </td>
                      ))}
                      <td className={`border border-slate-300 px-1 py-1 text-right font-semibold tabular-nums ${out_invalid ? "text-rose-600" : "text-slate-900"}`}>{out_tot}</td>
                      {NUM_FIELDS.slice(6, 8).map(f => (
                        <td key={f} className="border border-slate-300 p-0">
                          <input type="number" min={0}
                            className="w-12 px-1 py-0.5 text-right text-slate-900 tabular-nums bg-transparent focus:bg-pink-50 outline-none"
                            value={(c[f] as number | null) ?? 0}
                            onChange={ev => update(e.id!, f, Math.max(0, parseInt(ev.target.value) || 0))} />
                        </td>
                      ))}
                      <td className="border border-slate-300 px-1 py-1 text-right font-semibold text-slate-900 tabular-nums">{rk_tot}</td>
                      <td className="border border-slate-300 p-0">
                        <input type="number" min={0}
                          className={`w-12 px-1 py-0.5 text-right tabular-nums bg-transparent focus:bg-pink-50 outline-none ${kbl_invalid ? "text-rose-600" : "text-slate-900"}`}
                          value={c.rk_diterima_kembali ?? 0}
                          onChange={ev => update(e.id!, "rk_diterima_kembali", Math.max(0, parseInt(ev.target.value) || 0))} />
                      </td>
                      <td className="border border-slate-300 px-1 py-1 text-center bg-amber-50 text-amber-700 tabular-nums" title={s ? `RM total=${s.rm_in_total} (P=${s.rm_in_pus} R=${s.rm_in_rs} F=${s.rm_in_faskes}) · RK=${s.rk_total}` : "tidak ada mapping"}>
                        {s ? <span className="font-semibold">{s.rm_in_total}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="border border-slate-300 px-1 py-1 text-center">
                        {dirty(e.id!) ? (
                          <button onClick={() => save(c)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-2 py-0.5 rounded">Simpan</button>
                        ) : <span className="text-slate-400 text-[10px]">-</span>}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-blue-100 font-bold">
                  <td className="border border-slate-300 px-1 py-1 text-center text-slate-900">99</td>
                  <td className="border border-slate-300 px-2 py-1 text-slate-900">TOTAL</td>
                  <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums">{totals.in_pus}</td>
                  <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums">{totals.in_rs}</td>
                  <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums">{totals.in_fk}</td>
                  <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums">{totals.in_tot}</td>
                  <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums">{totals.out_pus}</td>
                  <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums">{totals.out_rs}</td>
                  <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums">{totals.out_fk}</td>
                  <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums">{totals.out_tot}</td>
                  <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums">{totals.rk_ruj}</td>
                  <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums">{totals.rk_sen}</td>
                  <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums">{totals.rk_tot}</td>
                  <td className="border border-slate-300 px-1 py-1 text-right text-slate-900 tabular-nums">{totals.rk_kbl}</td>
                  <td className="border border-slate-300 px-1 py-1 text-right text-amber-700 tabular-nums">{data.khanza.rujuk_masuk_total}</td>
                  <td className="border border-slate-300"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded p-3 mt-4">
            <strong>Validasi JUKNIS:</strong> RM Dikembalikan Total ≤ RM Diterima Total · Diterima Kembali ≤ Dirujuk Keluar Total. Baris tidak valid ditandai <span className="bg-rose-50 px-1">merah muda</span>.
            Klasifikasi spesialisasi via reg_periksa.kd_poli (mis. INT→1 Penyakit Dalam, BDH→2 Bedah, OBG→5 Obstetri).
          </div>
        </>
      ) : null}
    </div>
  );
}
