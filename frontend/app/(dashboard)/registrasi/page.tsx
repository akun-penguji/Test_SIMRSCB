"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getRegistrasiList, Registrasi } from "@/lib/api";
import SuratDropdown from "@/components/SuratDropdown";

function todayStr() {
  return new Date().toLocaleDateString("en-CA");
}

function formatTgl(tgl?: string): string {
  if (!tgl) return "-";
  const parts = tgl.split("-");
  if (parts.length !== 3) return tgl;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function DatePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className="relative flex items-center border border-slate-200 rounded-xl bg-white shadow-sm cursor-pointer h-9"
      onClick={() => ref.current?.showPicker?.()}
      title={label}
    >
      <svg className="w-3.5 h-3.5 text-slate-400 ml-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className="px-2 text-sm text-slate-700 select-none whitespace-nowrap">
        {value ? formatTgl(value) : <span className="text-slate-400">{label}</span>}
      </span>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full cursor-pointer"
        tabIndex={-1}
      />
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  Sudah: "bg-green-100 text-green-700 border border-green-200",
  Belum: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  Batal: "bg-red-100 text-red-700 border border-red-200",
};

export default function RegistrasiPage() {
  const router = useRouter();
  const navigate = (path: string) => router.push(path);
  const [tglAwal, setTglAwal]       = useState(todayStr());
  const [tglAkhir, setTglAkhir]     = useState(todayStr());
  const [cariPoli, setCariPoli]     = useState("");
  const [cariDokter, setCariDokter] = useState("");
  const [cari, setCari]             = useState("");

  const [data, setData]       = useState<Registrasi[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRegistrasiList({
        tgl_awal: tglAwal, tgl_akhir: tglAkhir,
        poli: cariPoli, dokter: cariDokter, cari,
      });
      setData(res.data.data);
      setTotal(res.data.total);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [tglAwal, tglAkhir, cariPoli, cariDokter, cari]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-3 md:p-5 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 md:mb-5">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-800">Registrasi Kunjungan</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            {formatTgl(tglAwal)}{tglAwal !== tglAkhir ? ` — ${formatTgl(tglAkhir)}` : ""}
          </p>
        </div>
        <button
          onClick={() => router.push("/registrasi/baru")}
          className="flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white text-xs md:text-sm font-medium px-3 md:px-4 py-2 md:py-2.5 rounded-xl shadow-sm transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Registrasi Baru</span>
          <span className="sm:hidden">Baru</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 md:p-4 mb-3 md:mb-5">
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3 md:items-end">
          {/* Tanggal range */}
          <div className="col-span-2 md:col-span-1">
            <p className="text-xs text-slate-500 mb-1 font-medium">Tanggal</p>
            <div className="flex items-center gap-1.5">
              <DatePicker value={tglAwal}  onChange={setTglAwal}  label="Awal" />
              <span className="text-slate-400 text-sm">s/d</span>
              <DatePicker value={tglAkhir} onChange={setTglAkhir} label="Akhir" />
            </div>
          </div>

          {/* Cari Poli */}
          <div>
            <p className="text-xs text-slate-500 mb-1 font-medium">Poli</p>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <input
                value={cariPoli}
                onChange={(e) => setCariPoli(e.target.value)}
                placeholder="Cari poli..."
                className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm bg-white h-9
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Cari Dokter */}
          <div>
            <p className="text-xs text-slate-500 mb-1 font-medium">Dokter</p>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <input
                value={cariDokter}
                onChange={(e) => setCariDokter(e.target.value)}
                placeholder="Cari dokter..."
                className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm bg-white h-9
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Cari umum */}
          <div className="col-span-2 md:flex-1">
            <p className="text-xs text-slate-500 mb-1 font-medium">Cari</p>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="No. rawat, nama pasien, jaminan..."
                className="border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm bg-white h-9 w-full
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Badge total */}
          {!loading && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 rounded-xl h-9">
              <span className="text-base font-bold text-green-700">{total}</span>
              <span className="text-xs text-green-600">kunjungan</span>
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-12 justify-center">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Memuat data...
        </div>
      )}

      {/* Empty */}
      {!loading && data.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">Tidak ada data registrasi</p>
        </div>
      )}

      {/* Tabel */}
      {!loading && data.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-visible shadow-sm">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
            <span className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{data.length}</span> kunjungan ditampilkan
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-10">No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tgl</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">No. Rawat</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Nama Pasien</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Aksi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Poli</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Dokter</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Jaminan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((r, i) => (
                  <tr key={r.no_rawat} className="hover:bg-green-50/40 transition-colors">
                    <td className="px-4 py-3 text-center">
                      <span className="w-6 h-6 rounded-full bg-green-700 text-white text-xs font-bold inline-flex items-center justify-center">
                        {r.no_reg ?? String(i + 1).padStart(3, "0")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatTgl(r.tgl_registrasi)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{r.no_rawat}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{r.nm_pasien}</td>
                    <td className="px-4 py-3">
                      <SuratDropdown reg={r} onNavigate={navigate} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {r.nm_poli ?? "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{r.nm_dokter ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {r.png_jawab ?? r.kd_pj ?? "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap ${
                        STATUS_STYLE[r.stts ?? "Belum"] ?? "bg-slate-100 text-slate-600"
                      }`}>
                        {r.stts ?? "Belum"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
