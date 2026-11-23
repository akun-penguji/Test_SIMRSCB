"use client";

import { useState } from "react";

const COLS = [
  "Kode Aset","Nama Aset","Merk / Type","Serial Number","Lokasi / Ruangan",
  "Tgl.Perolehan","Harga Perolehan","Kondisi","Status","Penanggung Jawab","Keterangan",
];

export default function AsetPage() {
  const [cari, setCari] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [kondisi, setKondisi] = useState("Semua");

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Aset</h1>
          <p className="text-sm text-slate-500 mt-0.5">Daftar aset RS, pemeliharaan & status kondisi</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-green-800 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Aset
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Kondisi</label>
            <select value={kondisi} onChange={e => setKondisi(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {["Semua","Baik","Rusak Ringan","Rusak Berat","Tidak Digunakan"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="block text-xs text-slate-500 mb-1">Lokasi / Ruangan</label>
            <input type="text" value={lokasi} onChange={e => setLokasi(e.target.value)}
              placeholder="Semua lokasi..."
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1">Cari</label>
            <input type="text" value={cari} onChange={e => setCari(e.target.value)}
              placeholder="Kode / Nama Aset / Serial Number..."
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <button className="bg-green-700 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-green-800 transition-colors">Cari</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">#</th>
                {COLS.map(c => <th key={c} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{c}</th>)}
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={COLS.length + 2} className="px-4 py-10 text-center text-sm text-slate-400">Belum ada data — backend dalam pengembangan</td></tr>
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">0 data ditemukan</div>
      </div>
    </div>
  );
}
