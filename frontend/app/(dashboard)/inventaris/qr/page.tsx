"use client";

// Cetak Label QR aset. QR meng-encode barcode (kompatibel scanner USB & halaman
// /inventaris/scan). Pilih aset → Cetak → grid label siap gunting/tempel.

import { useEffect, useState, useCallback } from "react";
import InventarisNav from "@/app/(dashboard)/inventaris/InventarisNav";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { getInventaris, getInventarisFilters, Inventaris, InventarisFilters } from "@/lib/api";

export default function QrLabelPage() {
  const [rows, setRows] = useState<Inventaris[]>([]);
  const [filters, setFilters] = useState<InventarisFilters | null>(null);
  const [q, setQ] = useState("");
  const [fRuangan, setFRuangan] = useState("");
  const [fKategori, setFKategori] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getInventaris({ q, ruangan: fRuangan, kategori: fKategori })
      .then(r => setRows(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [q, fRuangan, fKategori]);

  useEffect(() => { getInventarisFilters().then(r => setFilters(r.data)).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const toggle = (id: number) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShown = rows.length > 0 && rows.every(r => sel.has(r.id));
  const toggleAll = () => setSel(s => {
    const n = new Set(s);
    if (allShown) rows.forEach(r => n.delete(r.id)); else rows.forEach(r => n.add(r.id));
    return n;
  });

  const dipilih = rows.filter(r => sel.has(r.id));
  const kode = (r: Inventaris) => r.barcode || r.no_label || String(r.id);

  return (
    <div className="p-6 space-y-5">
      {/* Kontrol (disembunyikan saat cetak) */}
      <div className="print:hidden space-y-5">
        <InventarisNav />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Cetak Label QR</h1>
            <p className="text-sm text-slate-500">QR berisi barcode aset — bisa dipindai scanner USB maupun kamera HP di menu Scan.</p>
          </div>
          <button onClick={() => window.print()} disabled={dipilih.length === 0}
            className="px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-40 rounded-lg">
            🖶 Cetak {dipilih.length > 0 ? `(${dipilih.length})` : ""}
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-slate-500 block mb-1">Cari</label>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="nama / barcode / merk…"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <Sel label="Ruangan" value={fRuangan} onChange={setFRuangan} opts={filters?.ruangan ?? []} />
          <Sel label="Kategori" value={fKategori} onChange={setFKategori} opts={filters?.kategori ?? []} />
          <div className="text-sm text-slate-500 pb-2">{dipilih.length} dipilih</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 text-left w-10"><input type="checkbox" checked={allShown} onChange={toggleAll} /></th>
                  <th className="px-3 py-2.5 text-left">Nama Alat</th>
                  <th className="px-3 py-2.5 text-left">Barcode</th>
                  <th className="px-3 py-2.5 text-left">Ruangan</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Memuat…</td></tr>
                ) : rows.map(r => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => toggle(r.id)}>
                    <td className="px-3 py-2"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} onClick={e => e.stopPropagation()} /></td>
                    <td className="px-3 py-2 font-medium text-slate-800">{r.nama_alat}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{kode(r)}</td>
                    <td className="px-3 py-2 text-slate-600">{r.ruangan || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Area cetak label */}
      <div className="label-grid">
        {dipilih.map(r => (
          <div key={r.id} className="label-card">
            <QRCodeSVG value={kode(r)} size={92} level="M" includeMargin={false} />
            <div className="label-text">
              <div className="label-nama">{r.nama_alat}</div>
              <div className="label-kode">{kode(r)}</div>
              <div className="label-ruang">{r.ruangan || "-"} · RSUD Cabangbungin</div>
            </div>
          </div>
        ))}
      </div>

      {dipilih.length === 0 && (
        <div className="print:hidden text-center text-slate-400 text-sm py-8">Pilih aset di atas untuk membuat label.</div>
      )}

      <style jsx global>{`
        .label-grid { display: none; }
        @media screen {
          .label-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
          .label-card { display: flex; gap: 10px; align-items: center; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 10px; background: #fff; }
        }
        @media print {
          @page { margin: 8mm; }
          body * { visibility: hidden; }
          .label-grid, .label-grid * { visibility: visible; }
          .label-grid { display: grid; position: absolute; left: 0; top: 0; width: 100%;
            grid-template-columns: repeat(3, 1fr); gap: 4mm; }
          .label-card { display: flex; gap: 3mm; align-items: center; border: 1px solid #000;
            border-radius: 6px; padding: 3mm; break-inside: avoid; }
        }
        .label-text { min-width: 0; font-family: sans-serif; }
        .label-nama { font-weight: 700; font-size: 11px; line-height: 1.2; }
        .label-kode { font-family: monospace; font-size: 10px; margin-top: 2px; }
        .label-ruang { font-size: 9px; color: #475569; margin-top: 2px; }
      `}</style>
    </div>
  );
}

function Sel({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: string[] }) {
  return (
    <div className="min-w-[150px]">
      <label className="text-xs text-slate-500 block mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
        <option value="">Semua</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
