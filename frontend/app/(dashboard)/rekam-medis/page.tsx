"use client";

import { useState, useRef } from "react";

const TABS = ["Berkas Rawat","Berkas Klaim BPJS","Sensus Harian","Data Alergi Pasien"];

const COLS_BERKAS = [
  "No.Rawat","No.RM","Nama Pasien","Tgl.Masuk","Tgl.Keluar","Jenis Layanan",
  "Dokter P.J.","Diagnosa Akhir","Jenis Bayar","Status Berkas","Lokasi Berkas",
];
const COLS_KLAIM = [
  "No.SEP","No.Rawat","No.RM","Nama Pasien","Tgl.Masuk","Tgl.Keluar",
  "Diagnosa","Tindakan","Kelas","Status Klaim","Keterangan",
];
const COLS_SENSUS = [
  "Tanggal","Bangsal","Jml.Masuk","Jml.Keluar","Jml.Meninggal","BOR","Jml.Hari Rawat","BTO","TOI","ALOS",
];
const COLS_ALERGI = [
  "No.Rawat","No.RM","Nama Pasien","J.K.","Umur","Tanggal","Kode Alergi",
  "Alergi","Kategori","Reaksi","Severity","Petugas",
];

const COL_MAP = [COLS_BERKAS, COLS_KLAIM, COLS_SENSUS, COLS_ALERGI];

function formatTgl(tgl: string): string {
  if (!tgl) return "";
  const p = tgl.split("-");
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : tgl;
}

function DatePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative flex items-center border border-slate-200 rounded-xl bg-white shadow-sm cursor-pointer h-9"
      onClick={() => ref.current?.showPicker?.()}>
      <svg className="w-3.5 h-3.5 text-slate-400 ml-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className="px-2 text-sm text-slate-700 select-none whitespace-nowrap">
        {value ? formatTgl(value) : <span className="text-slate-400">{label}</span>}
      </span>
      <input ref={ref} type="date" value={value} onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full cursor-pointer" tabIndex={-1} />
    </div>
  );
}

export default function RekamMedisPage() {
  const today = new Date().toLocaleDateString("en-CA");
  const [activeTab, setActiveTab] = useState(0);
  const [tglAwal, setTglAwal] = useState(today);
  const [tglAkhir, setTglAkhir] = useState(today);
  const [cari, setCari] = useState("");
  const [statusBerkas, setStatusBerkas] = useState("Semua");

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Rekam Medis</h1>
        <p className="text-sm text-slate-500 mt-0.5">Berkas RM, assembling, sensus & koding ICD</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setActiveTab(i)}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors
                ${activeTab === i ? "border-b-2 border-green-700 text-green-700 bg-green-50" : "text-slate-500 hover:text-slate-700"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="p-4 border-b border-slate-100">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Dari Tanggal</label>
              <DatePicker value={tglAwal} onChange={setTglAwal} label="Dari Tanggal" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Sampai Tanggal</label>
              <DatePicker value={tglAkhir} onChange={setTglAkhir} label="Sampai Tanggal" />
            </div>
            {activeTab === 0 && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Status Berkas</label>
                <select value={statusBerkas} onChange={e => setStatusBerkas(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {["Semua","Lengkap","Tidak Lengkap","Di Poli","Di Rawat Inap","Diarsipkan"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-slate-500 mb-1">Cari</label>
              <input type="text" value={cari} onChange={e => setCari(e.target.value)}
                placeholder="No.RM / No.Rawat / Nama Pasien..."
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <button className="bg-green-700 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-green-800 transition-colors">Cari</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">#</th>
                {COL_MAP[activeTab].map(c => <th key={c} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{c}</th>)}
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={20} className="px-4 py-10 text-center text-sm text-slate-400">Belum ada data — backend dalam pengembangan</td></tr>
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">0 data ditemukan</div>
      </div>
    </div>
  );
}
