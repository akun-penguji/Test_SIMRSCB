"use client";

import { useState } from "react";

export default function GiziPage() {
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [cari, setCari] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Gizi</h1>
        <p className="text-sm text-slate-500 mt-0.5">Master diet & pengelolaan gizi pasien rawat inap</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Form Input */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            {editId ? "Edit Diet" : "Tambah Diet"}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Kode Diet <span className="text-slate-300">(maks 3 karakter)</span></label>
              <input type="text" value={kode} onChange={e => setKode(e.target.value)} maxLength={3}
                placeholder="mis. D01"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nama Diet</label>
              <input type="text" value={nama} onChange={e => setNama(e.target.value)} maxLength={50}
                placeholder="Nama jenis diet..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="flex-1 bg-green-700 text-white text-sm py-2 rounded-lg hover:bg-green-800 transition-colors">
              Simpan
            </button>
            <button onClick={() => { setKode(""); setNama(""); setEditId(null); }}
              className="flex-1 bg-slate-100 text-slate-600 text-sm py-2 rounded-lg hover:bg-slate-200 transition-colors">
              Batal
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center">Backend dalam pengembangan</p>
        </div>

        {/* Daftar Diet */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
            <input type="text" value={cari} onChange={e => setCari(e.target.value)}
              placeholder="Cari kode / nama diet..."
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <button className="bg-green-700 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-green-800 transition-colors">
              Cari
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 w-32">Kode Diet</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Nama Diet</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 w-24">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-400">
                    Belum ada data — backend dalam pengembangan
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">0 data</div>
        </div>
      </div>
    </div>
  );
}
