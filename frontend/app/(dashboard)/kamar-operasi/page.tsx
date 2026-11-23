"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getBookingOperasiList, BookingOpRow } from "@/lib/api";

const COLS = [
  "No.Rawat","Nama Pasien","Umur","J.K.","Tanggal","Mulai","Selesai",
  "Operasi","Operator","Ruang OK","Order","Status",
];

type FilterMode = "menunggu" | "jadwal" | "selesai" | "proses";

function StatusOpBadge({ v }: { v?: string }) {
  const color =
    v === "Menunggu" ? "bg-amber-100 text-amber-800" :
    v === "Proses Operasi" ? "bg-blue-100 text-blue-700" :
    v === "Selesai" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{v || "-"}</span>;
}

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

export default function KamarOperasiPage() {
  const today = new Date().toLocaleDateString("en-CA");
  const [mode, setMode] = useState<FilterMode>("menunggu");
  const [tglAwal, setTglAwal] = useState(today);
  const [tglAkhir, setTglAkhir] = useState(today);
  const [cari, setCari] = useState("");
  const [data, setData] = useState<BookingOpRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const modeLabels: Record<FilterMode, string> = {
    menunggu: "Menunggu",
    jadwal: "Jadwal (Rentang Tgl)",
    selesai: "Selesai",
    proses: "Proses Operasi",
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getBookingOperasiList({ mode, tgl_awal: tglAwal, tgl_akhir: tglAkhir, cari, size: 300 });
      setData(r.data.data); setTotal(r.data.total);
    } catch { setData([]); setTotal(0); }
    finally { setLoading(false); }
  }, [mode, tglAwal, tglAkhir, cari]);
  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Kamar Operasi</h1>
          <p className="text-sm text-slate-500 mt-0.5">Booking & manajemen jadwal operasi</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-green-800 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Booking Operasi
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex gap-4 mb-3 flex-wrap">
          {(Object.keys(modeLabels) as FilterMode[]).map(m => (
            <label key={m} className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
              <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)}
                className="accent-green-700" />
              {modeLabels[m]}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          {(mode === "jadwal" || mode === "selesai") && (
            <>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Dari Tanggal</label>
                <DatePicker value={tglAwal} onChange={setTglAwal} label="Dari Tanggal" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Sampai Tanggal</label>
                <DatePicker value={tglAkhir} onChange={setTglAkhir} label="Sampai Tanggal" />
              </div>
            </>
          )}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1">Cari</label>
            <input type="text" value={cari} onChange={e => setCari(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchData()}
              placeholder="No.Rawat / Nama Pasien / Jenis Operasi / Operator..."
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <button onClick={fetchData} className="bg-green-700 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-green-800 transition-colors">
            {loading ? "..." : "Cari"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-black">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">#</th>
                {COLS.map(c => (
                  <th key={c} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={COLS.length + 1} className="px-4 py-10 text-center text-sm text-slate-400">Memuat data...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={COLS.length + 1} className="px-4 py-10 text-center text-sm text-slate-400">Tidak ada data booking operasi</td></tr>
              ) : data.map((row, i) => (
                <tr key={`${row.no_rawat}-${i}`} className="border-b border-slate-50 hover:bg-slate-100">
                  <td className="px-3 py-2 text-xs text-black">{i + 1}</td>
                  <td className="px-3 py-2 text-xs font-mono">{row.no_rawat}</td>
                  <td className="px-3 py-2 text-xs font-medium">{row.nm_pasien || "-"}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{(row.umur || "").trim() || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.jk || "-"}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{formatTgl(row.tanggal || "")}</td>
                  <td className="px-3 py-2 text-xs">{(row.jam_mulai || "").slice(0, 5)}</td>
                  <td className="px-3 py-2 text-xs">{(row.jam_selesai || "").slice(0, 5)}</td>
                  <td className="px-3 py-2 text-xs max-w-[200px] truncate" title={row.operasi || ""}>{row.operasi || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.operator || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.ruang_ok || row.kd_ruang_ok || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.order_rawat || "-"}</td>
                  <td className="px-3 py-2"><StatusOpBadge v={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          {loading ? "Memuat..." : `${total.toLocaleString("id-ID")} booking`}
        </div>
      </div>
    </div>
  );
}
