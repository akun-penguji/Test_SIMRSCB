"use client";

import { useState, useRef, useCallback } from "react";
import { getLaporanKunjunganRalan, getLaporanKunjunganIgd, LaporanKunjungan } from "@/lib/api";

const LAPORAN_GROUPS = [
  {
    label: "Kunjungan & Pelayanan",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    items: ["Kunjungan Rawat Jalan","Kunjungan IGD"],
  },
  {
    label: "Penyakit (Morbiditas)",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    items: ["Frekuensi Penyakit Rawat Jalan","Frekuensi Penyakit Rawat Inap","Penyakit Menular Rawat Jalan","Penyakit Menular Rawat Inap"],
  },
  {
    label: "Indikator Rawat Inap",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    items: ["Hitung BOR (Bed Occupancy Ratio)","Hitung ALOS (Avg Length of Stay)","Hitung BTO (Bed Turn Over)"],
  },
  {
    label: "Laporan RL (Kemenkes)",
    icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
    items: ["RL 1 — Data Dasar","RL 2 — Data Ketenagaan","RL 3.1 — Rawat Inap","RL 3.2 — Rawat Darurat","RL 4 — Morbiditas","RL 5 — Pengunjung RS"],
  },
];

const SUPPORTED = new Set(["Kunjungan Rawat Jalan","Kunjungan IGD"]);

function formatTgl(tgl?: string) {
  if (!tgl) return "-";
  const p = tgl.split("-");
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : tgl;
}

function fmtNum(n: number) { return n.toLocaleString("id-ID"); }

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

function KunjunganTable({ laporan }: { laporan: LaporanKunjungan }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-slate-600 mb-2">Per Hari</p>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["Tanggal","Pasien Baru","Pasien Lama","Total","Sudah","Batal"].map(c => (
                  <th key={c} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {laporan.per_hari.map(r => (
                <tr key={r.tgl} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-3 py-1.5">{formatTgl(r.tgl)}</td>
                  <td className="px-3 py-1.5 text-right">{fmtNum(r.baru)}</td>
                  <td className="px-3 py-1.5 text-right">{fmtNum(r.lama)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{fmtNum(r.total)}</td>
                  <td className="px-3 py-1.5 text-right text-green-600">{fmtNum(r.sudah)}</td>
                  <td className="px-3 py-1.5 text-right text-red-500">{fmtNum(r.batal)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{fmtNum(laporan.per_hari.reduce((s, r) => s + r.baru, 0))}</td>
                <td className="px-3 py-2 text-right">{fmtNum(laporan.per_hari.reduce((s, r) => s + r.lama, 0))}</td>
                <td className="px-3 py-2 text-right">{fmtNum(laporan.grand_total)}</td>
                <td className="px-3 py-2 text-right text-green-600">{fmtNum(laporan.per_hari.reduce((s, r) => s + r.sudah, 0))}</td>
                <td className="px-3 py-2 text-right text-red-500">{fmtNum(laporan.per_hari.reduce((s, r) => s + r.batal, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">Per Poli / Unit</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Nama Poli","Baru","Lama","Total"].map(c => (
                    <th key={c} className="px-3 py-2 text-left font-semibold text-slate-500">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {laporan.per_poli.map(r => (
                  <tr key={r.nm_poli} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-1.5">{r.nm_poli}</td>
                    <td className="px-3 py-1.5 text-right">{fmtNum(r.baru)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtNum(r.lama)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{fmtNum(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">Per Jaminan</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Jaminan","Baru","Lama","Total"].map(c => (
                    <th key={c} className="px-3 py-2 text-left font-semibold text-slate-500">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {laporan.per_jaminan.map(r => (
                  <tr key={r.png_jawab} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-1.5">{r.png_jawab}</td>
                    <td className="px-3 py-1.5 text-right">{fmtNum(r.baru)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtNum(r.lama)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{fmtNum(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LaporanPage() {
  const today = new Date().toLocaleDateString("en-CA");
  const firstDay = today.slice(0, 8) + "01";
  const [selected, setSelected] = useState<string | null>(null);
  const [tglAwal, setTglAwal]   = useState(firstDay);
  const [tglAkhir, setTglAkhir] = useState(today);
  const [laporan, setLaporan]   = useState<LaporanKunjungan | null>(null);
  const [loading, setLoading]   = useState(false);

  const fetchLaporan = useCallback(async () => {
    if (!selected || !SUPPORTED.has(selected)) return;
    setLoading(true);
    setLaporan(null);
    try {
      const fn = selected === "Kunjungan Rawat Jalan" ? getLaporanKunjunganRalan : getLaporanKunjunganIgd;
      const r = await fn({ tgl_awal: tglAwal, tgl_akhir: tglAkhir });
      setLaporan(r.data);
    } catch { setLaporan(null); }
    finally { setLoading(false); }
  }, [selected, tglAwal, tglAkhir]);

  return (
    <div className="p-3 md:p-5 lg:p-6">
      <div className="mb-3 md:mb-5">
        <h1 className="text-lg md:text-xl font-bold text-slate-800">Laporan</h1>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">Laporan kunjungan, morbiditas, RL & indikator mutu RS</p>
      </div>

      {selected ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => { setSelected(null); setLaporan(null); }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-sm font-semibold text-slate-700">{selected}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3 md:items-end mb-4 md:mb-5">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Dari Tanggal</label>
              <DatePicker value={tglAwal} onChange={setTglAwal} label="Dari Tanggal" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Sampai Tanggal</label>
              <DatePicker value={tglAkhir} onChange={setTglAkhir} label="Sampai Tanggal" />
            </div>
            <button onClick={fetchLaporan}
              className="col-span-2 md:col-span-1 w-full md:w-auto bg-green-700 text-white text-sm px-4 py-2 md:py-1.5 rounded-lg hover:bg-green-800 transition-colors">
              {loading ? "..." : "Tampilkan"}
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">Memuat data laporan...</div>
          ) : laporan ? (
            <KunjunganTable laporan={laporan} />
          ) : SUPPORTED.has(selected) ? (
            <div className="py-10 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Klik Tampilkan untuk memuat laporan
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Laporan ini dalam pengembangan
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {LAPORAN_GROUPS.map(group => (
            <div key={group.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={group.icon} />
                </svg>
                <h2 className="text-xs font-semibold text-slate-700">{group.label}</h2>
              </div>
              <div className="p-2">
                {group.items.map(item => (
                  <button key={item} onClick={() => setSelected(item)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-green-50 hover:text-green-700 rounded-lg transition-colors flex items-center justify-between">
                    <span>{item}</span>
                    {SUPPORTED.has(item) && (
                      <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-medium">Live</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
