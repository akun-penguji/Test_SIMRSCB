"use client";

// Laporan Darurat Stok (port DlgDaruratStok.java). Barang aktif dengan total stok
// (gudangbarang) di bawah minimal. Filter per depo (bangsal) — minimal pakai override
// stok_minimal_bangsal bila ada, fallback databarang.stokminimal.

import { useCallback, useEffect, useState } from "react";
import { daruratStok, barangBangsal, DaruratRow, Bangsal } from "@/lib/api";

export default function DaruratStokPage() {
  const [depo, setDepo] = useState("");
  const [bangsal, setBangsal] = useState<Bangsal[]>([]);
  const [rows, setRows] = useState<DaruratRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { barangBangsal().then(r => setBangsal(r.data.data)).catch(() => setBangsal([])); }, []);
  const muat = useCallback(() => {
    setLoading(true);
    daruratStok(depo || undefined).then(r => setRows(r.data.data)).catch(() => setRows([])).finally(() => setLoading(false));
  }, [depo]);
  useEffect(() => { muat(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const inp = "border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm";
  const th = "px-2 py-2 text-xs font-bold text-slate-600 border-b border-slate-200 text-left whitespace-nowrap";
  const td = "px-2 py-1.5 text-sm border-b border-slate-100";
  const namaDepo = bangsal.find(b => b.kd_bangsal === depo)?.nm_bangsal;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="no-print">
        <h1 className="text-lg font-bold text-slate-800">⚠️ Darurat Stok — Obat / BHP / Alkes</h1>
        <p className="text-xs text-slate-500">Barang aktif dengan stok di bawah batas minimal. Sumber: databarang / gudangbarang.</p>
      </div>

      <div className="no-print flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Depo / Ruang</span>
          <select value={depo} onChange={e => setDepo(e.target.value)} className={inp}>
            <option value="">— Semua depo (total) —</option>
            {bangsal.map(b => <option key={b.kd_bangsal} value={b.kd_bangsal}>{b.nm_bangsal}</option>)}
          </select></label>
        <button onClick={muat} className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Tampilkan</button>
        <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg px-4 py-2">Cetak</button>
        <div className="ml-auto text-sm text-slate-500 self-center">Item di bawah minimal: <b className="text-red-600 tabular-nums">{rows.length}</b></div>
      </div>

      <div className="hidden print:block text-center mb-1">
        <div className="text-base font-bold">Laporan Darurat Stok — Obat/BHP/Alkes</div>
        <div className="text-sm">{namaDepo ? `Depo: ${namaDepo}` : "Semua Depo (Total)"}</div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50"><tr>
            <th className={`${th} text-center`}>No</th>
            <th className={th}>Kode</th><th className={th}>Nama Barang</th><th className={th}>Jenis</th><th className={th}>Satuan</th>
            <th className={`${th} text-center`}>Minimal</th><th className={`${th} text-center`}>Stok</th><th className={`${th} text-center`}>Kurang</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center text-slate-400 text-sm py-8">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-emerald-600 text-sm py-8">✓ Tidak ada barang di bawah minimal.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.kode_brng} className={r.stok <= 0 ? "bg-red-50/60" : ""}>
                <td className={`${td} text-center text-slate-400 tabular-nums`}>{i + 1}</td>
                <td className={`${td} text-xs text-slate-500 whitespace-nowrap`}>{r.kode_brng}</td>
                <td className={td}>{r.nama_brng}</td>
                <td className={`${td} text-xs text-slate-500`}>{r.jenis}</td>
                <td className={`${td} text-xs`}>{r.satuan}</td>
                <td className={`${td} text-center tabular-nums`}>{r.minimal}</td>
                <td className={`${td} text-center tabular-nums font-semibold ${r.stok <= 0 ? "text-red-600" : "text-amber-600"}`}>{r.stok}</td>
                <td className={`${td} text-center tabular-nums font-bold text-red-600`}>{r.kurang}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx global>{`@media print { .no-print { display: none !important; } @page { size: A4 portrait; margin: 12mm; } }`}</style>
    </div>
  );
}
