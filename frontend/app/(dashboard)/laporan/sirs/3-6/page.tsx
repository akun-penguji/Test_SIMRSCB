"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { getSirsRl36, updateSirsRl36, cetakSirsRl36, Rl36Resp, Rl36Entry } from "@/lib/api";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const NUM_FIELDS: (keyof Rl36Entry)[] = [
  "rm_rs", "rm_bidan", "rm_puskes", "rm_faskes_lain",
  "rm_hidup", "rm_mati",
  "rnm_hidup", "rnm_mati",
  "nr_hidup", "nr_mati",
  "dirujuk",
];

export default function Rl36Page() {
  const [bulan, setBulan]     = useState(thisMonth());
  const [data, setData]       = useState<Rl36Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [edits, setEdits]     = useState<Record<number, Rl36Entry>>({});

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl36(bulan).then(r => { setData(r.data); setEdits({}); })
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => { reload(); }, [reload]);

  const updateNum = (id: number, field: keyof Rl36Entry, value: number) => {
    setEdits(es => {
      const base = es[id] || data?.entries.find(e => e.id === id);
      if (!base) return es;
      return { ...es, [id]: { ...base, [field]: value } };
    });
  };

  const save = async (e: Rl36Entry) => {
    if (!e.id) return;
    setErrMsg(""); setOkMsg("");
    try {
      await updateSirsRl36(e.id, e);
      setOkMsg(`✔ ${e.jenis_kode} tersimpan`);
      setEdits(es => { const c = { ...es }; delete c[e.id!]; return c; });
      setTimeout(() => setOkMsg(""), 2500);
      reload();
    } catch { setErrMsg("Gagal menyimpan"); }
  };

  const dirty = (id: number) => !!edits[id];
  const cur = (id: number) => edits[id] || data?.entries.find(e => e.id === id)!;

  const sumOf = (e: Rl36Entry, fields: (keyof Rl36Entry)[]) =>
    fields.reduce((s, f) => s + ((e[f] as number | null) || 0), 0);

  const sugesti = useMemo(() => {
    const m = new Map<string, { count: number; sumber: string }>();
    data?.khanza.per_row.forEach(r => m.set(r.jenis_kode, { count: r.count, sumber: r.sumber }));
    return m;
  }, [data]);

  return (
    <div className="p-4 max-w-[1500px] mx-auto">
      <nav className="text-sm mb-4">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 3.6 — Pelayanan Kebidanan</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode bulanan · 29 leaf + 5 parent · 11 angka per leaf (Rujukan Medis · Rujukan Non Medis · Non Rujukan · Dirujuk).
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
        <button onClick={() => cetakSirsRl36(bulan)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">🖨️ Cetak HTML</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}
      {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded p-3 mb-3">{okMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-xs rounded p-3 mb-3 grid grid-cols-3 md:grid-cols-6 gap-2">
            <div>🔍 catatan_persalinan: <strong>{data.khanza.persalinan_khanza}</strong></div>
            <div>obstetri ralan: <strong>{data.khanza.obstetri_ralan}</strong></div>
            <div>obstetri ranap: <strong>{data.khanza.obstetri_ranap}</strong></div>
            <div>reg_periksa OBG: <strong>{data.khanza.kunjungan_obg}</strong></div>
            <div>bayi baru lahir: <strong>{data.khanza.bayi_baru_lahir}</strong></div>
            <div>ibu nifas: <strong>{data.khanza.ibu_nifas}</strong></div>
          </div>

          <div className="bg-rose-50 border-l-4 border-rose-400 text-rose-900 text-xs rounded p-3 mb-4 grid grid-cols-3 gap-2">
            <div>💀 <strong>Maternal mortality</strong> (pasien_mati × ♀ 15-49 thn): total <strong>{data.khanza.mortality.maternal_total}</strong></div>
            <div>dengan ICD O00-O99: <strong>{data.khanza.mortality.maternal_icd_o}</strong></div>
            <div>DOA (Lain-lain/Doa): <strong>{data.khanza.mortality.doa_perempuan}</strong></div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border border-slate-300 min-w-[1300px]">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 w-10 text-slate-900">No</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-left text-slate-900 min-w-[200px]">Jenis Kegiatan</th>
                  <th colSpan={7} className="border border-slate-300 px-1 py-1 bg-blue-100 text-slate-900">Rujukan Medis</th>
                  <th colSpan={3} className="border border-slate-300 px-1 py-1 bg-purple-100 text-slate-900">Rujukan Non Medis</th>
                  <th colSpan={3} className="border border-slate-300 px-1 py-1 bg-emerald-100 text-slate-900">Non Rujukan</th>
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 text-slate-900">Dirujuk</th>
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 bg-amber-100 text-slate-900" title="Sugesti dari diagnosa_pasien + prosedur_pasien">Sugesti<br/>Khanza</th>
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 text-slate-900">Aksi</th>
                </tr>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">RS</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Bidan</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Pusk</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Faskes</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Hidup</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Mati</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900 bg-blue-50">Tot</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Hidup</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Mati</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900 bg-purple-50">Tot</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Hidup</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900">Mati</th>
                  <th className="border border-slate-300 px-1 py-1 text-slate-900 bg-emerald-50">Tot</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map(e => {
                  if (e.is_parent === 1) {
                    return (
                      <tr key={e.id} className="bg-blue-50 font-bold">
                        <td className="border border-slate-300 px-1 py-1 text-center text-slate-900">{e.jenis_kode}</td>
                        <td colSpan={16} className="border border-slate-300 px-2 py-1 text-slate-900">{e.jenis_nama}</td>
                      </tr>
                    );
                  }
                  const c = cur(e.id!);
                  const rmTot = sumOf(c, ["rm_hidup","rm_mati"]);
                  const rnmTot = sumOf(c, ["rnm_hidup","rnm_mati"]);
                  const nrTot = sumOf(c, ["nr_hidup","nr_mati"]);
                  const rmSrc = sumOf(c, ["rm_rs","rm_bidan","rm_puskes","rm_faskes_lain"]);
                  const inconsistent = rmSrc !== rmTot;
                  return (
                    <tr key={e.id} className={dirty(e.id!) ? "bg-amber-50" : (inconsistent ? "bg-rose-50" : "")}>
                      <td className="border border-slate-300 px-1 py-1 text-center text-slate-900">{e.jenis_kode}</td>
                      <td className="border border-slate-300 px-2 py-1 text-slate-900">{e.jenis_nama}</td>
                      {NUM_FIELDS.slice(0, 6).map(f => (
                        <td key={f} className="border border-slate-300 p-0">
                          <input type="number" min={0}
                            className="w-12 px-1 py-0.5 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                            value={(c[f] as number | null) ?? 0}
                            onChange={ev => updateNum(e.id!, f, Math.max(0, parseInt(ev.target.value) || 0))} />
                        </td>
                      ))}
                      <td className={`border border-slate-300 px-1 py-1 text-right font-semibold tabular-nums ${inconsistent ? "text-rose-600" : "text-slate-900"}`}>{rmTot}</td>
                      {NUM_FIELDS.slice(6, 8).map(f => (
                        <td key={f} className="border border-slate-300 p-0">
                          <input type="number" min={0}
                            className="w-12 px-1 py-0.5 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                            value={(c[f] as number | null) ?? 0}
                            onChange={ev => updateNum(e.id!, f, Math.max(0, parseInt(ev.target.value) || 0))} />
                        </td>
                      ))}
                      <td className="border border-slate-300 px-1 py-1 text-right font-semibold text-slate-900 tabular-nums">{rnmTot}</td>
                      {NUM_FIELDS.slice(8, 10).map(f => (
                        <td key={f} className="border border-slate-300 p-0">
                          <input type="number" min={0}
                            className="w-12 px-1 py-0.5 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                            value={(c[f] as number | null) ?? 0}
                            onChange={ev => updateNum(e.id!, f, Math.max(0, parseInt(ev.target.value) || 0))} />
                        </td>
                      ))}
                      <td className="border border-slate-300 px-1 py-1 text-right font-semibold text-slate-900 tabular-nums">{nrTot}</td>
                      <td className="border border-slate-300 p-0">
                        <input type="number" min={0}
                          className="w-12 px-1 py-0.5 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                          value={c.dirujuk ?? 0}
                          onChange={ev => updateNum(e.id!, "dirujuk", Math.max(0, parseInt(ev.target.value) || 0))} />
                      </td>
                      {(() => {
                        const s = sugesti.get(e.jenis_kode);
                        return (
                          <td className="border border-slate-300 px-1 py-1 text-center bg-amber-50" title={s?.sumber || "tidak ada mapping ICD"}>
                            {s ? <span className="font-semibold text-amber-700 tabular-nums">{s.count}</span> : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })()}
                      <td className="border border-slate-300 px-1 py-1 text-center">
                        {dirty(e.id!) ? (
                          <button onClick={() => save(c)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-2 py-0.5 rounded">Simpan</button>
                        ) : <span className="text-slate-400 text-[10px]">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded p-3 mt-4 space-y-2">
            <div><strong>Validasi JUKNIS rule 32:</strong> Jumlah pasien Rujukan Medis (RS+Bidan+Puskes+Faskes lainnya) harus sama dengan Hidup+Mati pada kolom RM. Baris yang tidak konsisten ditandai <span className="bg-rose-50 px-1">merah muda</span>.</div>
            <div><strong>Kolom Sugesti Khanza:</strong> hitungan otomatis distinct no_rawat di Khanza yang punya diagnosa/prosedur sesuai mapping ICD (lihat tooltip per cell). Pakai sebagai patokan, tidak otomatis di-input. Maternal komplikasi non-obstetri (7.x) di-strict ke kode O98/O99/O24 (sesuai JUKNIS "pada ibu hamil/bersalin/nifas").</div>
          </div>
        </>
      ) : null}
    </div>
  );
}
