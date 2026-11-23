"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getRawatInapList, RanapRow } from "@/lib/api";

const COLS = [
  "No.Rawat","No.RM","Nama Pasien","Umur","Kamar","Bangsal","Kelas",
  "Tgl.Masuk","Jam","Tgl.Keluar","Jam Klr","Lama",
  "Diagnosa Awal","Dokter P.J.","Jenis Bayar","Status Bayar","Stts.Pulang",
];
const STATUS_PULANG = [
  "Masih Dirawat","Semua","Sehat","Sembuh","Membaik",
  "Atas Persetujuan Dokter","Atas Permintaan Sendiri","Meninggal","Dirujuk","Pindah Kamar","Pulang Paksa",
];

function formatTgl(tgl?: string): string {
  if (!tgl) return "-";
  const p = tgl.split("-");
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : tgl;
}
function StttsPulangBadge({ v }: { v?: string }) {
  const dirawat = v === "-" || !v;
  const color = dirawat ? "bg-blue-100 text-blue-700"
    : v === "Meninggal" ? "bg-slate-700 text-white"
    : v === "Dirujuk" ? "bg-purple-100 text-purple-700"
    : v?.includes("Sendiri") || v === "Pulang Paksa" ? "bg-amber-100 text-amber-800"
    : "bg-green-100 text-green-700";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{dirawat ? "Masih Dirawat" : v}</span>;
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

export default function RawatInapPage() {
  const today = new Date().toLocaleDateString("en-CA");
  const [tglAwal, setTglAwal] = useState(today);
  const [tglAkhir, setTglAkhir] = useState(today);
  const [cari, setCari] = useState("");
  const [statusBayar, setStatusBayar] = useState("Semua");
  const [statusPulang, setStatusPulang] = useState("Masih Dirawat");
  const [bangsal, setBangsal] = useState("");
  const [data, setData] = useState<RanapRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const dirawat = statusPulang === "Masih Dirawat";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getRawatInapList({
        tgl_awal: tglAwal, tgl_akhir: tglAkhir, status_bayar: statusBayar,
        status_pulang: statusPulang, bangsal, cari, size: 300,
      });
      setData(r.data.data); setTotal(r.data.total);
    } catch { setData([]); setTotal(0); }
    finally { setLoading(false); }
  }, [tglAwal, tglAkhir, statusBayar, statusPulang, bangsal, cari]);
  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="p-6 text-black">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Rawat Inap</h1>
          <p className="text-sm text-slate-500 mt-0.5">Daftar pasien rawat inap (adopsi Kamar Inap)</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-green-800 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Input Rawat Inap
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status Pulang</label>
            <select value={statusPulang} onChange={e => setStatusPulang(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {STATUS_PULANG.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className={dirawat ? "opacity-40 pointer-events-none" : ""}>
            <label className="block text-xs text-slate-500 mb-1">Dari Tgl Masuk</label>
            <DatePicker value={tglAwal} onChange={setTglAwal} label="Dari" />
          </div>
          <div className={dirawat ? "opacity-40 pointer-events-none" : ""}>
            <label className="block text-xs text-slate-500 mb-1">Sampai</label>
            <DatePicker value={tglAkhir} onChange={setTglAkhir} label="Sampai" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status Bayar</label>
            <select value={statusBayar} onChange={e => setStatusBayar(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {["Semua","Sudah Bayar","Belum Bayar"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Bangsal</label>
            <input value={bangsal} onChange={e => setBangsal(e.target.value)} placeholder="Semua bangsal"
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1">Cari</label>
            <input type="text" value={cari} onChange={e => setCari(e.target.value)}
              placeholder="No.RM / Nama / No.Rawat / Kamar / Dokter..."
              onKeyDown={e => e.key === "Enter" && fetchData()}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <button onClick={fetchData} className="bg-green-700 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-green-800 transition-colors">
            {loading ? "..." : "Cari"}
          </button>
        </div>
        {dirawat && <p className="text-[11px] text-slate-400 mt-2">Mode &quot;Masih Dirawat&quot; menampilkan semua pasien yang belum pulang (filter tanggal diabaikan).</p>}
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
                <tr><td colSpan={COLS.length + 1} className="px-4 py-10 text-center text-sm text-slate-400">Tidak ada data rawat inap</td></tr>
              ) : data.map((row, i) => (
                <tr key={row.no_rawat} className={`border-b border-slate-50 hover:bg-slate-100 ${row.status_bayar === "Sudah Bayar" ? "bg-emerald-50/60" : ""}`}>
                  <td className="px-3 py-2 text-xs text-black">{i + 1}</td>
                  <td className="px-3 py-2 text-xs font-mono">{row.no_rawat}</td>
                  <td className="px-3 py-2 text-xs font-mono">{row.no_rm || "-"}</td>
                  <td className="px-3 py-2 text-xs font-medium">{row.nm_pasien || "-"}
                    <a href={`/catatan-keperawatan?no_rawat=${encodeURIComponent(row.no_rawat)}&jenis=ranap`} className="ml-2 text-[11px] text-sky-600 hover:underline whitespace-nowrap">📝 Catatan Kep.</a>
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{(row.umur || "").trim() || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.kd_kamar || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.nm_bangsal || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.kelas || "-"}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{formatTgl(row.tgl_masuk)}</td>
                  <td className="px-3 py-2 text-xs">{(row.jam_masuk || "").slice(0, 5)}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{row.tgl_keluar ? formatTgl(row.tgl_keluar) : "-"}</td>
                  <td className="px-3 py-2 text-xs">{(row.jam_keluar || "").slice(0, 5) || "-"}</td>
                  <td className="px-3 py-2 text-xs text-right">{row.lama ?? 0} hr</td>
                  <td className="px-3 py-2 text-xs max-w-[220px] truncate" title={row.diagnosa_awal || ""}>{row.diagnosa_awal || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.nm_dokter || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.png_jawab || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.status_bayar || "-"}</td>
                  <td className="px-3 py-2"><StttsPulangBadge v={row.stts_pulang} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          {loading ? "Memuat..." : `${total.toLocaleString("id-ID")} pasien`}
        </div>
      </div>
    </div>
  );
}
