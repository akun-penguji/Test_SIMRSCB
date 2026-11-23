"use client";

import { useState, useRef, useCallback } from "react";
import { getKasirRalanList, KasirRalan } from "@/lib/api";

function formatTgl(tgl?: string) {
  if (!tgl) return "-";
  const p = tgl.split("-");
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : tgl;
}

function BayarBadge({ v }: { v?: string }) {
  const color = v === "Sudah Bayar" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{v || "Belum Bayar"}</span>;
}

function DatePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative flex items-center border border-slate-200 rounded-xl bg-white shadow-sm cursor-pointer h-9"
      onClick={() => ref.current?.showPicker?.()}>
      <svg className="w-3.5 h-3.5 text-slate-400 ml-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className="px-2 text-sm text-slate-700 select-none whitespace-nowrap">
        {value ? formatTgl(value) : <span className="text-slate-400">{label}</span>}
      </span>
      <input ref={ref} type="date" value={value} onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full cursor-pointer" tabIndex={-1} />
    </div>
  );
}

export default function KasirRalanPage() {
  const today = new Date().toLocaleDateString("en-CA");
  const [tglAwal, setTglAwal]   = useState(today);
  const [tglAkhir, setTglAkhir] = useState(today);
  const [statusPeriksa, setStatusPeriksa] = useState("Semua");
  const [statusBayar, setStatusBayar]     = useState("Semua");
  const [poli, setPoli]     = useState("");
  const [dokter, setDokter] = useState("");
  const [cari, setCari]     = useState("");
  const [data, setData]     = useState<KasirRalan[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getKasirRalanList({
        tgl_awal: tglAwal, tgl_akhir: tglAkhir,
        status_periksa: statusPeriksa, status_bayar: statusBayar,
        poli, dokter, cari, size: 100,
      });
      setData(r.data.data);
      setTotal(r.data.total);
    } catch { setData([]); setTotal(0); }
    finally { setLoading(false); }
  }, [tglAwal, tglAkhir, statusPeriksa, statusBayar, poli, dokter, cari]);

  return (
    <div className="p-3 md:p-5 lg:p-6">
      <div className="mb-3 md:mb-5">
        <h1 className="text-lg md:text-xl font-bold text-slate-800">Kasir Rawat Jalan</h1>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">Pengelolaan pembayaran pasien rawat jalan</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 md:p-4 mb-3">
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3 md:items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Dari Tanggal</label>
            <DatePicker value={tglAwal} onChange={setTglAwal} label="Dari Tanggal" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Sampai Tanggal</label>
            <DatePicker value={tglAkhir} onChange={setTglAkhir} label="Sampai Tanggal" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status Periksa</label>
            <select value={statusPeriksa} onChange={e => setStatusPeriksa(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {["Semua","Belum","Sudah","Batal","Berkas Diterima","Dirujuk","Meninggal","Dirawat","Pulang Paksa"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status Bayar</label>
            <select value={statusBayar} onChange={e => setStatusBayar(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {["Semua","Sudah Bayar","Belum Bayar"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Dokter</label>
            <input value={dokter} onChange={e => setDokter(e.target.value)} placeholder="Semua dokter..."
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Poliklinik</label>
            <input value={poli} onChange={e => setPoli(e.target.value)} placeholder="Semua poli..."
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="col-span-2 md:flex-1">
            <label className="block text-xs text-slate-500 mb-1">Cari</label>
            <input value={cari} onChange={e => setCari(e.target.value)} placeholder="No.RM / Nama / No.Rawat..."
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
                {["No.Rawat","No.Reg","Tgl","Jam","No.RM","Pasien","No.Telp","Dokter","Poli","P.Jawab","Alamat PJ","Hub PJ","Biaya Reg","Jenis Bayar","Status","Status Bayar","Stts Poli"].map(c => (
                  <th key={c} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={18} className="px-4 py-10 text-center text-sm text-slate-400">Memuat data...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={18} className="px-4 py-10 text-center text-sm text-slate-400">Klik Cari untuk menampilkan data</td></tr>
              ) : data.map((row, i) => (
                <tr key={row.no_rawat} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 text-xs font-mono">{row.no_rawat}</td>
                  <td className="px-3 py-2 text-xs">{row.no_reg || "-"}</td>
                  <td className="px-3 py-2 text-xs">{formatTgl(row.tgl_registrasi)}</td>
                  <td className="px-3 py-2 text-xs">{(row.jam_reg || "").slice(0, 5)}</td>
                  <td className="px-3 py-2 text-xs font-mono">{row.no_rm}</td>
                  <td className="px-3 py-2 text-xs font-medium">{row.nm_pasien || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.no_tlp || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.nm_dokter || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.nm_poli || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.p_jawab || row.png_jawab || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.almt_pj || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.hubunganpj || "-"}</td>
                  <td className="px-3 py-2 text-xs text-right">{row.biaya_reg != null ? row.biaya_reg.toLocaleString("id-ID") : "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.png_jawab || row.kd_pj || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.stts || "-"}</td>
                  <td className="px-3 py-2"><BayarBadge v={row.status_bayar} /></td>
                  <td className="px-3 py-2 text-xs">{row.status_poli || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
          {loading ? "Memuat..." : `${total.toLocaleString("id-ID")} data`}
        </div>
      </div>
    </div>
  );
}
