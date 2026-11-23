"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { getLabList, LabRow } from "@/lib/api";

function formatTgl(tgl?: string) {
  if (!tgl) return "-";
  const p = tgl.split("-");
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : tgl;
}

function hitungUsia(tgl?: string) {
  if (!tgl) return "-";
  const age = Math.floor((Date.now() - new Date(tgl + "T00:00:00").getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return `${age} th`;
}

function StatusBadge({ v }: { v?: string }) {
  const color =
    v === "Sudah"  ? "bg-green-100 text-green-700" :
    v === "Belum"  ? "bg-amber-100 text-amber-700"  :
    v === "Batal"  ? "bg-red-100 text-red-700"      : "bg-slate-100 text-slate-500";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{v || "-"}</span>;
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

export default function LaboratoriumPage() {
  const today = new Date().toLocaleDateString("en-CA");
  const [tglAwal, setTglAwal]   = useState(today);
  const [tglAkhir, setTglAkhir] = useState(today);
  const [cari, setCari]         = useState("");
  const [jenis, setJenis]       = useState("Semua");
  const [data, setData]         = useState<LabRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getLabList({ tgl_awal: tglAwal, tgl_akhir: tglAkhir, cari, jenis, size: 100 });
      setData(r.data.data);
      setTotal(r.data.total);
    } catch { setData([]); setTotal(0); }
    finally { setLoading(false); }
  }, [tglAwal, tglAkhir, cari, jenis]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="p-3 md:p-5 lg:p-6">
      <div className="mb-3 md:mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-800">Laboratorium</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">Pemeriksaan & hasil laboratorium</p>
        </div>
        <button className="inline-flex items-center gap-1.5 bg-green-700 text-white text-xs md:text-sm font-medium px-3 md:px-4 py-2 rounded-xl hover:bg-green-800 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Input Pemeriksaan</span>
          <span className="sm:hidden">Input</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 md:p-4 mb-3 md:mb-4">
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3 md:items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Dari Tanggal</label>
            <DatePicker value={tglAwal} onChange={setTglAwal} label="Dari Tanggal" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Sampai Tanggal</label>
            <DatePicker value={tglAkhir} onChange={setTglAkhir} label="Sampai Tanggal" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs text-slate-500 mb-1">Jenis Pasien</label>
            <select value={jenis} onChange={e => setJenis(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {["Semua","Rawat Jalan","Rawat Inap","IGD"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2 md:flex-1">
            <label className="block text-xs text-slate-500 mb-1">Cari</label>
            <input type="text" value={cari} onChange={e => setCari(e.target.value)}
              placeholder="No.RM / Nama Pasien / No.Rawat..."
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              onKeyDown={e => e.key === "Enter" && fetchData()} />
          </div>
          <button onClick={fetchData} className="col-span-2 md:col-span-1 w-full md:w-auto bg-green-700 text-white text-sm px-4 py-2 md:py-1.5 rounded-lg hover:bg-green-800 transition-colors">
            {loading ? "..." : "Cari"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">#</th>
                {["No.Rawat","No.RM","Nama Pasien","Umur","J.K.","Tanggal","Jam","Dokter PJ","Perujuk","Jaminan","Status","Stts Lanjut"].map(c => (
                  <th key={c} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-slate-400">Memuat data...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-slate-400">Tidak ada data laboratorium</td></tr>
              ) : data.map((row, i) => (
                <tr key={`${row.no_rawat}-${i}`} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 text-xs font-mono">{row.no_rawat}</td>
                  <td className="px-3 py-2 text-xs font-mono">{row.no_rm}</td>
                  <td className="px-3 py-2 text-xs font-medium">{row.nm_pasien || "-"}</td>
                  <td className="px-3 py-2 text-xs">{hitungUsia(row.tgl_lahir)}</td>
                  <td className="px-3 py-2 text-xs">{row.jk === "L" ? "L" : row.jk === "P" ? "P" : "-"}</td>
                  <td className="px-3 py-2 text-xs">{formatTgl(row.tgl_periksa)}</td>
                  <td className="px-3 py-2 text-xs">{(row.jam_periksa || "").slice(0, 5) || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.nm_dokter || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.dokter_pengirim || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.png_jawab || row.kd_pj || "-"}</td>
                  <td className="px-3 py-2"><StatusBadge v={row.status} /></td>
                  <td className="px-3 py-2 text-xs">{row.status_lanjut || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
          {loading ? "Memuat..." : `${total.toLocaleString("id-ID")} data ditemukan`}
        </div>
      </div>
    </div>
  );
}
