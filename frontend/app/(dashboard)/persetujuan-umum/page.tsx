"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getPersetujuanUmumList, cetakPersetujuanUmum, hapusPersetujuanUmum, PersetujuanUmumListRow,
} from "@/lib/api";

export default function PersetujuanUmumTersimpanPage() {
  const [rows, setRows] = useState<PersetujuanUmumListRow[]>([]);
  const [q, setQ] = useState("");
  const [tglAwal, setTglAwal] = useState("");
  const [tglAkhir, setTglAkhir] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getPersetujuanUmumList({ q, tgl_awal: tglAwal, tgl_akhir: tglAkhir })
      .then(r => setRows(r.data.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [q, tglAwal, tglAkhir]);
  useEffect(() => { load(); }, [load]);

  const cetak = async (no_rawat: string) => {
    setMsg(null);
    try { await cetakPersetujuanUmum(no_rawat); }
    catch { setMsg("Gagal membuka cetakan"); }
  };

  const hapus = async (no_rawat: string, nama?: string | null) => {
    setMsg(null);
    if (!window.confirm(`Hapus Persetujuan Umum atas nama ${nama ?? no_rawat}? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await hapusPersetujuanUmum(no_rawat);
      load();
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setMsg(ex.response?.data?.error ?? "Gagal menghapus data");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto text-black">
      <h1 className="text-2xl font-bold text-black mb-1">Persetujuan Umum Tersimpan</h1>
      <p className="text-sm text-black mb-4">Telusuri data General Consent yang sudah tersimpan, lalu buka atau cetak.</p>

      {msg && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-3">{msg}</div>}

      <div className="flex flex-wrap items-end gap-2 mb-3 bg-white border border-slate-200 rounded-lg p-3">
        <label className="text-sm">
          <span className="block text-black mb-1">Cari</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="No. Rawat / No. Surat / Nama / RM"
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-72" />
        </label>
        <label className="text-sm">
          <span className="block text-black mb-1">Dari</span>
          <input type="date" value={tglAwal} onChange={e => setTglAwal(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
        </label>
        <label className="text-sm">
          <span className="block text-black mb-1">Sampai</span>
          <input type="date" value={tglAkhir} onChange={e => setTglAkhir(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
        </label>
        <button onClick={load} className="bg-slate-800 text-white text-sm rounded-lg px-4 py-1.5 hover:bg-slate-900">Cari</button>
        <span className="text-xs text-slate-400 ml-auto">{rows.length} data</span>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-black text-left">
            <tr>
              <th className="px-3 py-2">Tanggal</th><th className="px-3 py-2">No. Surat</th>
              <th className="px-3 py-2">No. Rawat</th><th className="px-3 py-2">RM</th>
              <th className="px-3 py-2">Nama Pasien</th><th className="px-3 py-2">Penanggung Jawab</th>
              <th className="px-3 py-2"></th>
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
                  <Link href={`/surat/persetujuan_umum?no_rawat=${encodeURIComponent(r.no_rawat)}`}
                    className="text-indigo-600 hover:underline mr-3">Edit</Link>
                  <button onClick={() => cetak(r.no_rawat)} className="text-emerald-600 hover:underline mr-3">Cetak</button>
                  <button onClick={() => hapus(r.no_rawat, r.nm_pasien)} className="text-red-600 hover:underline">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
