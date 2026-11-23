"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { getSirsRl319, updateSirsRl319, cetakSirsRl319, Rl319Resp, Rl319Entry, Rl319KhanzaSugesti } from "@/lib/api";

function thisYear() { return String(new Date().getFullYear()); }

const NUM_FIELDS: (keyof Rl319Entry)[] = [
  "pasien_keluar", "lama_dirawat", "ralan_lab", "ralan_rad", "ralan_lain",
];

export default function Rl319Page() {
  const [tahun, setTahun]     = useState(thisYear());
  const [data, setData]       = useState<Rl319Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [edits, setEdits]     = useState<Record<number, Rl319Entry>>({});

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl319(tahun).then(r => { setData(r.data); setEdits({}); })
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [tahun]);

  useEffect(() => { reload(); }, [reload]);

  const update = (id: number, field: keyof Rl319Entry, value: number) => {
    setEdits(es => {
      const base = es[id] || data?.entries.find(e => e.id === id);
      if (!base) return es;
      return { ...es, [id]: { ...base, [field]: value } };
    });
  };

  const save = async (e: Rl319Entry) => {
    if (!e.id) return;
    setErrMsg(""); setOkMsg("");
    try {
      await updateSirsRl319(e.id, e);
      setOkMsg(`✔ ${e.jenis_kode} tersimpan`);
      setEdits(es => { const c = { ...es }; delete c[e.id!]; return c; });
      setTimeout(() => setOkMsg(""), 2500);
      reload();
    } catch { setErrMsg("Gagal menyimpan"); }
  };

  const dirty = (id: number) => !!edits[id];
  const cur = (id: number) => edits[id] || data?.entries.find(e => e.id === id)!;

  const sugesti = useMemo(() => {
    const m = new Map<string, Rl319KhanzaSugesti>();
    data?.khanza.sugesti_per_row.forEach(s => m.set(s.jenis_kode, s));
    return m;
  }, [data]);

  const totals = useMemo(() => {
    if (!data) return { pk: 0, ld: 0, lab: 0, rad: 0, lain: 0, ralan_tot: 0 };
    const t = { pk: 0, ld: 0, lab: 0, rad: 0, lain: 0, ralan_tot: 0 };
    for (const e of data.entries) {
      if (e.is_parent === 1) continue;
      const c = edits[e.id!] || e;
      t.pk += c.pasien_keluar || 0;
      t.ld += c.lama_dirawat  || 0;
      t.lab += c.ralan_lab    || 0;
      t.rad += c.ralan_rad    || 0;
      t.lain += c.ralan_lain  || 0;
    }
    t.ralan_tot = t.lab + t.rad + t.lain;
    return t;
  }, [data, edits]);

  const applyAllSugesti = async () => {
    if (!data) return;
    let saved = 0;
    for (const e of data.entries) {
      if (e.is_parent === 1) continue;
      const s = sugesti.get(e.jenis_kode);
      if (!s) continue;
      try {
        await updateSirsRl319(e.id!, {
          ...e,
          pasien_keluar: s.pasien_keluar,
          lama_dirawat:  s.lama_dirawat,
          ralan_lab:     s.ralan_lab,
          ralan_rad:     s.ralan_rad,
          ralan_lain:    s.ralan_lain,
        });
        saved++;
      } catch {/* skip */}
    }
    setOkMsg(`✔ Sugesti Khanza diterapkan untuk ${saved} baris`);
    setTimeout(() => setOkMsg(""), 3000);
    reload();
  };

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <nav className="text-sm mb-4">
        <Link href="/laporan/sirs" className="text-indigo-600 hover:underline">← Daftar Formulir SIRS</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">RL 3.19 — Rekapitulasi Cara Bayar</h1>
        <p className="text-sm text-slate-600 mt-1">
          Periode <strong>tahunan</strong> · 11 baris × 5 angka (Ranap: keluar+lama; Ralan: lab+rad+lain).
          Sumber Khanza: <code>reg_periksa × penjab × kamar_inap × periksa_lab × periksa_radiologi</code>.
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
        <button onClick={() => cetakSirsRl319(tahun)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded ml-auto">🖨️ Cetak HTML</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}
      {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded p-3 mb-3">{okMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : data ? (
        <>
          <details className="bg-slate-50 border border-slate-200 rounded p-3 mb-4 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-900">🔍 Khanza raw breakdown per kd_pj {data.tahun} (klik untuk lihat)</summary>
            <table className="w-full mt-3 border border-slate-300">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">kd_pj</th>
                  <th className="border border-slate-300 px-2 py-1 text-left text-slate-900">Penjab</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Ranap Keluar</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Lama Dirawat</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Ralan Lab</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Ralan Rad</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Ralan Total</th>
                </tr>
              </thead>
              <tbody>
                {data.khanza.raw_per_kd_pj.map(r => (
                  <tr key={r.kd_pj || "x"}>
                    <td className="border border-slate-300 px-2 py-1 font-mono text-slate-900">{r.kd_pj || "-"}</td>
                    <td className="border border-slate-300 px-2 py-1 text-slate-900">{r.png_jawab || "-"}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{r.pasien_keluar.toLocaleString()}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{r.lama_dirawat.toLocaleString()}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{r.ralan_lab.toLocaleString()}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{r.ralan_rad.toLocaleString()}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums font-semibold">{r.ralan_total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-300">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 w-14 text-slate-900">No</th>
                  <th rowSpan={2} className="border border-slate-300 px-3 py-1 text-left text-slate-900 min-w-[260px]">Cara Pembayaran</th>
                  <th colSpan={2} className="border border-slate-300 px-2 py-1 bg-blue-100 text-slate-900">Pasien Rawat Inap</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-slate-900">Total<br/>Ralan</th>
                  <th colSpan={3} className="border border-slate-300 px-2 py-1 bg-emerald-100 text-slate-900">Jumlah Pasien Rawat Jalan</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 bg-amber-100 text-slate-900">Sugesti<br/>Khanza<br/>(PK·LD·Lab·Rad·Lain)</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-slate-900">Aksi</th>
                </tr>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Pasien Keluar</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Lama Dirawat</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Lab</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Rad</th>
                  <th className="border border-slate-300 px-2 py-1 text-slate-900">Lain-lain</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map(e => {
                  if (e.is_parent === 1) {
                    return (
                      <tr key={e.id} className="bg-blue-50 font-bold">
                        <td className="border border-slate-300 px-2 py-1 text-center text-slate-900">{e.jenis_kode}</td>
                        <td colSpan={9} className="border border-slate-300 px-3 py-1 text-slate-900">{e.jenis_nama}</td>
                      </tr>
                    );
                  }
                  const c = cur(e.id!);
                  const total_ralan = (c.ralan_lab||0) + (c.ralan_rad||0) + (c.ralan_lain||0);
                  const s = sugesti.get(e.jenis_kode);
                  return (
                    <tr key={e.id} className={dirty(e.id!) ? "bg-amber-50" : ""}>
                      <td className="border border-slate-300 px-2 py-1 text-center text-slate-900">{e.jenis_kode}</td>
                      <td className="border border-slate-300 px-3 py-1 text-slate-900">{e.jenis_nama}</td>
                      {NUM_FIELDS.slice(0, 2).map(f => (
                        <td key={f} className="border border-slate-300 p-0">
                          <input type="number" min={0}
                            className="w-20 px-2 py-1 text-right text-slate-900 tabular-nums bg-transparent focus:bg-blue-50 outline-none"
                            value={(c[f] as number | null) ?? 0}
                            onChange={ev => update(e.id!, f, Math.max(0, parseInt(ev.target.value) || 0))} />
                        </td>
                      ))}
                      <td className="border border-slate-300 px-2 py-1 text-right font-semibold text-slate-900 tabular-nums">{total_ralan}</td>
                      {NUM_FIELDS.slice(2).map(f => (
                        <td key={f} className="border border-slate-300 p-0">
                          <input type="number" min={0}
                            className="w-20 px-2 py-1 text-right text-slate-900 tabular-nums bg-transparent focus:bg-emerald-50 outline-none"
                            value={(c[f] as number | null) ?? 0}
                            onChange={ev => update(e.id!, f, Math.max(0, parseInt(ev.target.value) || 0))} />
                        </td>
                      ))}
                      <td className="border border-slate-300 px-2 py-1 text-right text-amber-700 text-xs tabular-nums bg-amber-50">
                        {s ? `${s.pasien_keluar}·${s.lama_dirawat}·${s.ralan_lab}·${s.ralan_rad}·${s.ralan_lain}` : "—"}
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
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.pk.toLocaleString()}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.ld.toLocaleString()}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.ralan_tot.toLocaleString()}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.lab.toLocaleString()}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.rad.toLocaleString()}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 tabular-nums">{totals.lain.toLocaleString()}</td>
                  <td colSpan={2} className="border border-slate-300"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded p-3 mt-4">
            <strong>Mapping kd_pj Khanza → JUKNIS:</strong> A01 UMUM→1 (Membayar Sendiri) · BPJS (A02/BPJ)→2.1 (JKN) · C03 JAMKESDA→2.2 · E01/JR (Polri/Jasa Raharja)→2.3 · F02/RPL (Asuransi swasta)→2.4 · D01/D02 KARYAWAN RSUD→3 (Keringanan) · C06 KARTU SEHAT→4.1 · SKTM→4.2 (manual) · FRE GRATIS→4.3.
          </div>
        </>
      ) : null}
    </div>
  );
}
