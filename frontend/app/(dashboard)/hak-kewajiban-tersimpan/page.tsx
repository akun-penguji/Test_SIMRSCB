"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getHakKewajibanList, cetakHakKewajiban, SuratTersimpanRow } from "@/lib/api";

export default function HakKewajibanTersimpanPage() {
  const [rows, setRows] = useState<SuratTersimpanRow[]>([]);
  const [q, setQ] = useState("");
  const [tglAwal, setTglAwal] = useState("");
  const [tglAkhir, setTglAkhir] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getHakKewajibanList({ q, tgl_awal: tglAwal, tgl_akhir: tglAkhir })
      .then(r => setRows(r.data.data)).catch(() => setRows([])).finally(() => setLoading(false));
  }, [q, tglAwal, tglAkhir]);
  useEffect(() => { load(); }, [load]);

  const cetak = async (no_rawat: string) => {
    setMsg(null);
    try { await cetakHakKewajiban(no_rawat); } catch { setMsg("Gagal membuka cetakan"); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto text-black">
      <h1 className="text-2xl font-bold text-black mb-1">Hak &amp; Kewajiban Tersimpan</h1>
      <p className="text-sm text-black mb-4">Telusuri data hak &amp; kewajiban pasien yang sudah tersimpan, lalu buka atau cetak.</p>

      {msg && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-3">{msg}</div>}

      <div className="flex flex-wrap items-end gap-2 mb-3 bg-white border border-slate-200 rounded-lg p-3">
        <label className="text-sm"><span className="block text-black mb-1">Cari</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="No. Rawat / No. Surat / Nama / RM" className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-72 text-black" /></label>
        <label className="text-sm"><span className="block text-black mb-1">Dari</span>
          <input type="date" value={tglAwal} onChange={e => setTglAwal(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-black" /></label>
        <label className="text-sm"><span className="block text-black mb-1">Sampai</span>
          <input type="date" value={tglAkhir} onChange={e => setTglAkhir(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-black" /></label>
        <button onClick={load} className="bg-slate-800 text-white text-sm rounded-lg px-4 py-1.5 hover:bg-slate-900">Cari</button>
        <span className="text-xs text-slate-500 ml-auto">{rows.length} data</span>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
        <table className="w-full text-sm text-black">
          <thead className="bg-slate-50 text-black text-left">
            <tr>
              <th className="px-3 py-2">Tanggal</th><th className="px-3 py-2">No. Surat</th>
              <th className="px-3 py-2">No. Rawat</th><th className="px-3 py-2">RM</th>
              <th className="px-3 py-2">Nama Pasien</th><th className="px-3 py-2">Penanggung Jawab</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Belum ada data tersimpan.</td></tr>
            ) : rows.map(r => (
              <tr key={r.no_surat} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">{r.tanggal ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.no_surat}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.no_rawat}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.no_rkm_medis ?? "—"}</td>
                <td className="px-3 py-2">{r.nm_pasien ?? "—"}</td>
                <td className="px-3 py-2">{r.nama_pj ?? "—"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Link href={`/surat/hak_kewajiban?no_rawat=${encodeURIComponent(r.no_rawat)}`} className="text-indigo-600 hover:underline mr-3">Buka</Link>
                  <button onClick={() => cetak(r.no_rawat)} className="text-emerald-600 hover:underline">Cetak</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
