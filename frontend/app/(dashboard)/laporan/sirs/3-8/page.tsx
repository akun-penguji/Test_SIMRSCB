"use client";

import { Fragment, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { getSirsRl38, updateSirsRl38, cetakSirsRl38, Rl38Resp, Rl38Entry } from "@/lib/api";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const SECTION_LABEL: Record<string, string> = {
  A: "A. PATOLOGI KLINIK",
  B: "B. MIKROBIOLOGI KLINIK",
  C: "C. PARASITOLOGI KLINIK",
  D: "D. PATOLOGI ANATOMI",
};

export default function Rl38Page() {
  const [bulan, setBulan]     = useState(thisMonth());
  const [data, setData]       = useState<Rl38Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [edits, setEdits]     = useState<Record<number, Rl38Entry>>({});
  const [showFilter, setShowFilter] = useState<string>("ALL");

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl38(bulan).then(r => { setData(r.data); setEdits({}); })
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => { reload(); }, [reload]);

  const update = (id: number, field: keyof Rl38Entry, value: number) => {
    setEdits(es => {
      const base = es[id] || data?.entries.find(e => e.id === id);
      if (!base) return es;
      return { ...es, [id]: { ...base, [field]: value } };
    });
  };

  const save = async (e: Rl38Entry) => {
    if (!e.id) return;
    setErrMsg(""); setOkMsg("");
    try {
      await updateSirsRl38(e.id, e);
      setOkMsg(`✔ ${e.jenis_kode} tersimpan`);
      setEdits(es => { const c = { ...es }; delete c[e.id!]; return c; });
      setTimeout(() => setOkMsg(""), 2500);
      reload();
    } catch { setErrMsg("Gagal menyimpan"); }
  };

  const dirty = (id: number) => !!edits[id];
  const cur = (id: number) => edits[id] || data?.entries.find(e => e.id === id)!;

  const visibleEntries = useMemo(() => {
    if (!data) return [];
    return showFilter === "ALL"
      ? data.entries
      : data.entries.filter(e => e.section === showFilter);
  }, [data, showFilter]);

  // Group rows by section then render with headers
  const rowsBySection = useMemo(() => {
    const out: { section: string; rows: Rl38Entry[] }[] = [];
    let cur_section: string | null = null;
    let bucket: Rl38Entry[] = [];
    for (const e of visibleEntries) {
      if (e.section !== cur_section) {
        if (bucket.length) out.push({ section: cur_section!, rows: bucket });
        cur_section = e.section;
        bucket = [e];
      } else {
        bucket.push(e);
      }
    }
    if (bucket.length) out.push({ section: cur_section!, rows: bucket });
    return out;
  }, [visibleEntries]);

  return (
    <div className="p-4 max-w-[1400px] mx-auto">
      <nav className="text-sm mb-4">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 3.8 — Pelayanan Laboratorium</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode bulanan · 155 parameter JUKNIS (4 section: A PK, B MB, C Parasit, D PA) · Sumber Khanza: <code>periksa_lab × jns_perawatan_lab</code>.
        </p>
      </header>

      <div className="flex items-end gap-3 mb-5 flex-wrap">
        <div>
          <label className="block text-xs text-slate-900 mb-1">Bulan Pelaporan</label>
          <input type="month" value={bulan} onChange={e => setBulan(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
        </div>
        <div>
          <label className="block text-xs text-slate-900 mb-1">Filter Section</label>
          <select value={showFilter} onChange={e => setShowFilter(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm text-slate-900">
            <option value="ALL">Semua Section</option>
            <option value="A">A · PATOLOGI KLINIK</option>
            <option value="B">B · MIKROBIOLOGI KLINIK</option>
            <option value="C">C · PARASITOLOGI KLINIK</option>
            <option value="D">D · PATOLOGI ANATOMI</option>
          </select>
        </div>
        <button onClick={reload}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 py-2 rounded border border-slate-300">🔄 Refresh</button>
        <button onClick={() => cetakSirsRl38(bulan)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">🖨️ Cetak HTML</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}
      {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded p-3 mb-3">{okMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-xs rounded p-3 mb-4">
            🔬 <strong>Khanza periksa_lab {data.bulan}</strong>: total <strong>{data.khanza.total_pemeriksaan}</strong> pemeriksaan / <strong>{data.khanza.total_pasien}</strong> pasien
            <div className="flex gap-3 mt-2 flex-wrap">
              {data.khanza.per_kategori.map(k => (
                <span key={k.kategori || "x"} className="bg-white px-2 py-1 rounded border border-amber-200">
                  <strong>{k.kategori || "-"}</strong>: {k.jml} ({k.jml_l}L+{k.jml_p}P · {k.pasien} px)
                </span>
              ))}
            </div>
          </div>

          <details className="bg-slate-50 border border-slate-200 rounded p-3 mb-4 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-900">📊 Top 15 jenis pemeriksaan Khanza periode {data.bulan}</summary>
            <table className="w-full mt-3 border border-slate-300">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">#</th>
                  <th className="border border-slate-300 px-2 py-1 text-left text-slate-900">Nama Pemeriksaan</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Total</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">L</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">P</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Kategori</th>
                </tr>
              </thead>
              <tbody>
                {data.khanza.top_jenis.slice(0, 15).map((t, i) => (
                  <tr key={i}>
                    <td className="border border-slate-300 px-2 py-1 text-slate-900">{i+1}</td>
                    <td className="border border-slate-300 px-2 py-1 text-slate-900">{t.nm_perawatan || "-"}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums font-semibold">{t.jml}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{t.jml_l}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{t.jml_p}</td>
                    <td className="border border-slate-300 px-2 py-1 text-slate-900">{t.kategori || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-300">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 w-16 text-slate-900">No</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-left text-slate-900">Pemeriksaan</th>
                  <th colSpan={2} className="border border-slate-300 px-2 py-1 bg-blue-100 text-slate-900">Jumlah Pemeriksaan</th>
                  <th colSpan={2} className="border border-slate-300 px-2 py-1 bg-emerald-100 text-slate-900">Nilai Rata-Rata Pemeriksaan</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-slate-900">Aksi</th>
                </tr>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">L</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">P</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">L</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">P</th>
                </tr>
              </thead>
              <tbody>
                {rowsBySection.map(({ section, rows }) => (
                  <Fragment key={`sec-${section}`}>
                    <tr className="bg-indigo-800 text-white font-bold tracking-wide">
                      <td className="border border-slate-300 px-2 py-1 text-center">{section}</td>
                      <td colSpan={6} className="border border-slate-300 px-2 py-1">{SECTION_LABEL[section] || section}</td>
                    </tr>
                    {rows.map(e => {
                      if (e.is_parent === 1) {
                        return (
                          <tr key={e.id} className="bg-blue-50 font-bold">
                            <td className="border border-slate-300 px-2 py-1 text-center text-slate-900">{e.jenis_kode}</td>
                            <td colSpan={6} className="border border-slate-300 px-2 py-1 text-slate-900">{e.jenis_nama}</td>
                          </tr>
                        );
                      }
                      const c = cur(e.id!);
                      return (
                        <tr key={e.id} className={dirty(e.id!) ? "bg-amber-50" : ""}>
                          <td className="border border-slate-300 px-2 py-1 text-center text-slate-900">{e.jenis_kode}</td>
                          <td className="border border-slate-300 px-2 py-1 text-slate-900">{e.jenis_nama}</td>
                          <td className="border border-slate-300 p-0">
                            <input type="number" min={0}
                              className="w-16 px-1 py-0.5 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                              value={c.jml_l ?? 0}
                              onChange={ev => update(e.id!, "jml_l", Math.max(0, parseInt(ev.target.value) || 0))} />
                          </td>
                          <td className="border border-slate-300 p-0">
                            <input type="number" min={0}
                              className="w-16 px-1 py-0.5 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                              value={c.jml_p ?? 0}
                              onChange={ev => update(e.id!, "jml_p", Math.max(0, parseInt(ev.target.value) || 0))} />
                          </td>
                          <td className="border border-slate-300 p-0">
                            <input type="number" min={0} step="0.01"
                              className="w-16 px-1 py-0.5 text-right text-slate-900 tabular-nums bg-transparent focus:bg-emerald-50 outline-none"
                              value={c.rata_l ?? 0}
                              onChange={ev => update(e.id!, "rata_l", Math.max(0, parseFloat(ev.target.value) || 0))} />
                          </td>
                          <td className="border border-slate-300 p-0">
                            <input type="number" min={0} step="0.01"
                              className="w-16 px-1 py-0.5 text-right text-slate-900 tabular-nums bg-transparent focus:bg-emerald-50 outline-none"
                              value={c.rata_p ?? 0}
                              onChange={ev => update(e.id!, "rata_p", Math.max(0, parseFloat(ev.target.value) || 0))} />
                          </td>
                          <td className="border border-slate-300 px-2 py-1 text-center">
                            {dirty(e.id!) ? (
                              <button onClick={() => save(c)}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-2 py-0.5 rounded">Simpan</button>
                            ) : <span className="text-slate-400 text-[10px]">-</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded p-3 mt-4">
            <strong>Catatan:</strong> Khanza Mei 2026 hanya kategori PK (Patologi Klinik) — modul MB/PA/Parasit belum diaktifkan. Gunakan filter Section untuk mempercepat input. Nilai Rata-Rata Pemeriksaan = jumlah angka hasil / jumlah pasien yang diperiksa (dihitung dari <code>detail_periksa_lab</code> oleh petugas lab).
          </div>
        </>
      ) : null}
    </div>
  );
}
