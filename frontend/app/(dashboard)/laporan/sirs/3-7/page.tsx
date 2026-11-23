"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { getSirsRl37, updateSirsRl37, cetakSirsRl37, Rl37Resp, Rl37Entry } from "@/lib/api";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const NUM_FIELDS: (keyof Rl37Entry)[] = [
  "rm_rs", "rm_bidan", "rm_puskes", "rm_faskes_lain",
  "rm_hidup", "rm_mati",
  "rnm_hidup", "rnm_mati",
  "nr_hidup", "nr_mati",
  "dirujuk",
];

export default function Rl37Page() {
  const [bulan, setBulan]     = useState(thisMonth());
  const [data, setData]       = useState<Rl37Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [edits, setEdits]     = useState<Record<number, Rl37Entry>>({});

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl37(bulan).then(r => { setData(r.data); setEdits({}); })
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => { reload(); }, [reload]);

  const updateNum = (id: number, field: keyof Rl37Entry, value: number) => {
    setEdits(es => {
      const base = es[id] || data?.entries.find(e => e.id === id);
      if (!base) return es;
      return { ...es, [id]: { ...base, [field]: value } };
    });
  };

  const save = async (e: Rl37Entry) => {
    if (!e.id) return;
    setErrMsg(""); setOkMsg("");
    try {
      await updateSirsRl37(e.id, e);
      setOkMsg(`✔ ${e.jenis_kode} tersimpan`);
      setEdits(es => { const c = { ...es }; delete c[e.id!]; return c; });
      setTimeout(() => setOkMsg(""), 2500);
      reload();
    } catch { setErrMsg("Gagal menyimpan"); }
  };

  const dirty = (id: number) => !!edits[id];
  const cur = (id: number) => edits[id] || data?.entries.find(e => e.id === id)!;
  const sumOf = (e: Rl37Entry, fields: (keyof Rl37Entry)[]) =>
    fields.reduce((s, f) => s + ((e[f] as number | null) || 0), 0);

  const sugesti = useMemo(() => {
    const m = new Map<string, { count: number; sumber: string }>();
    data?.khanza.per_row.forEach(r => m.set(r.jenis_kode, { count: r.count, sumber: r.sumber }));
    return m;
  }, [data]);

  // Group rows by section for rendering A/B header
  const rowsBySection = useMemo(() => {
    if (!data) return { A: [], B: [] as Rl37Entry[] };
    return data.entries.reduce<{ A: Rl37Entry[]; B: Rl37Entry[] }>((acc, e) => {
      if (e.section === "B") acc.B.push(e); else acc.A.push(e);
      return acc;
    }, { A: [], B: [] });
  }, [data]);

  const renderRow = (e: Rl37Entry) => {
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
    const s = sugesti.get(e.jenis_kode);
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
        <td className="border border-slate-300 px-1 py-1 text-center bg-amber-50" title={s?.sumber || "tidak ada mapping"}>
          {s ? <span className="font-semibold text-amber-700 tabular-nums">{s.count}</span> : <span className="text-slate-300">—</span>}
        </td>
        <td className="border border-slate-300 px-1 py-1 text-center">
          {dirty(e.id!) ? (
            <button onClick={() => save(c)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-2 py-0.5 rounded">Simpan</button>
          ) : <span className="text-slate-400 text-[10px]">-</span>}
        </td>
      </tr>
    );
  };

  return (
    <div className="p-4 max-w-[1500px] mx-auto">
      <nav className="text-sm mb-4">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 3.7 — Pelayanan Neonatal, Bayi, dan Balita</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode bulanan · Section A (Neonatal 0-28 hari) + Section B (Bayi 29h-11bl, Balita 12-59bl) · Patokan: <code>pasien_bayi</code> (lahir di RS).
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
        <button onClick={() => cetakSirsRl37(bulan)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">🖨️ Cetak HTML</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}
      {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded p-3 mb-3">{okMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <div className="bg-pink-50 border-l-4 border-pink-400 text-pink-900 text-xs rounded p-3 mb-2">
            <div className="font-semibold mb-1">🍼 Patokan utama: pasien_bayi (lahir di RS) bulan ini</div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <div>Total: <strong>{data.khanza.pasien_bayi_bulan_ini.total}</strong></div>
              <div>BBLR (1500-2500g): <strong>{data.khanza.pasien_bayi_bulan_ini.bblr_1500_2500}</strong></div>
              <div>BBLSR: <strong>{data.khanza.pasien_bayi_bulan_ini.bblsr_1000_1500}</strong></div>
              <div>BBLER: <strong>{data.khanza.pasien_bayi_bulan_ini.bbler_lt1000}</strong></div>
              <div>BBLN: <strong>{data.khanza.pasien_bayi_bulan_ini.bbln_2500_4000}</strong></div>
              <div>BBLL: <strong>{data.khanza.pasien_bayi_bulan_ini.bbll_ge4000}</strong></div>
              <div>Spontan: <strong>{data.khanza.pasien_bayi_bulan_ini.proses_spontan}</strong></div>
              <div>SC: <strong>{data.khanza.pasien_bayi_bulan_ini.proses_sc}</strong></div>
              <div>Vakum/Forceps: <strong>{data.khanza.pasien_bayi_bulan_ini.proses_vakum_forceps}</strong></div>
              <div>Asfiksia (Apgar 1' &lt;7): <strong>{data.khanza.pasien_bayi_bulan_ini.asfiksia_apgar1_lt7}</strong></div>
              <div className="col-span-2">Total pasien_bayi all-time: {data.khanza.pasien_bayi_total_all_time}</div>
            </div>
          </div>

          <div className="bg-rose-50 border-l-4 border-rose-400 text-rose-900 text-xs rounded p-3 mb-3">
            <div className="font-semibold mb-1">💀 Mortality dari pasien_mati × age</div>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              <div>Lahir Mati (P95/umur=0): <strong>{data.khanza.mortality.lahir_mati}</strong></div>
              <div>Neonatal Dini (0-7h): <strong>{data.khanza.mortality.neonatal_dini_0_7h}</strong></div>
              <div>Neonatal Lanjut (8-28h): <strong>{data.khanza.mortality.neonatal_lanjut_8_28h}</strong></div>
              <div>Bayi (29h-11bl) mati: <strong>{data.khanza.mortality.bayi_29h_11bl}</strong></div>
              <div>Balita (12-59bl) mati: <strong>{data.khanza.mortality.balita_12_59bl}</strong></div>
            </div>
          </div>

          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-xs rounded p-3 mb-4">
            <div className="font-semibold mb-1">Sanity sekunder (ICD + reg_periksa)</div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <div>Z38 (newborn): <strong>{data.khanza.livebirth_z38}</strong></div>
              <div>ralan_bayi: <strong>{data.khanza.kunjungan_ralan_bayi}</strong></div>
              <div>Prematur: <strong>{data.khanza.neonatus_prematur}</strong></div>
              <div>Kel. bawaan: <strong>{data.khanza.neonatus_kelainan_bawaan}</strong></div>
              <div>Age 0-28h: <strong>{data.khanza.bbl_0_28h}</strong></div>
              <div>29h-11bl: <strong>{data.khanza.bayi_29h_11bl}</strong></div>
              <div>12-59bl: <strong>{data.khanza.balita_12_59bl}</strong></div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border border-slate-300 min-w-[1400px]">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 w-12 text-slate-900">No</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-left text-slate-900 min-w-[220px]">Jenis Kegiatan</th>
                  <th colSpan={7} className="border border-slate-300 px-1 py-1 bg-blue-100 text-slate-900">Rujukan Medis</th>
                  <th colSpan={3} className="border border-slate-300 px-1 py-1 bg-purple-100 text-slate-900">Rujukan Non Medis</th>
                  <th colSpan={3} className="border border-slate-300 px-1 py-1 bg-emerald-100 text-slate-900">Non Rujukan</th>
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 text-slate-900">Dirujuk</th>
                  <th rowSpan={2} className="border border-slate-300 px-1 py-1 bg-amber-100 text-slate-900">Sugesti<br/>Khanza</th>
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
                <tr className="bg-indigo-800 text-white font-bold tracking-wide">
                  <td className="border border-slate-300 px-1 py-1 text-center">A</td>
                  <td colSpan={16} className="border border-slate-300 px-2 py-1">A. NEONATAL (0–28 hari)</td>
                </tr>
                {rowsBySection.A.map(renderRow)}
                <tr className="bg-indigo-800 text-white font-bold tracking-wide">
                  <td className="border border-slate-300 px-1 py-1 text-center">B</td>
                  <td colSpan={16} className="border border-slate-300 px-2 py-1">B. BAYI DAN ANAK BALITA</td>
                </tr>
                {rowsBySection.B.map(renderRow)}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded p-3 mt-4">
            <strong>Catatan:</strong> Modul <code>pasien_bayi</code> Khanza adalah patokan utama (yang lahir di RS) — saat ini berisi 1 row test total (modul belum aktif rutin). Begitu RS mulai input persalinan via modul ini, sugesti otomatis akan akurat. Sementara, gunakan sanity sekunder (Z38, ralan_bayi, ICD P/Q) sebagai cross-check. Baris RM tidak konsisten (rule-32) ditandai merah muda.
          </div>
        </>
      ) : null}
    </div>
  );
}
