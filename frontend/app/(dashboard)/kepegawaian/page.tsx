"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { getPegawaiList, getJadwalList, PegawaiRow, JadwalRow } from "@/lib/api";

function formatTgl(tgl?: string) {
  if (!tgl) return "-";
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

const TABS = ["Data Pegawai","Jadwal Jaga"];

export default function KepegawaianPage() {
  const today = new Date().toLocaleDateString("en-CA");
  const [activeTab, setActiveTab] = useState(0);
  const [cari, setCari]           = useState("");
  const [tgl, setTgl]             = useState(today);
  const [statusAktif, setStatusAktif] = useState("Semua");

  const [pegawai, setPegawai]   = useState<PegawaiRow[]>([]);
  const [jadwal, setJadwal]     = useState<JadwalRow[]>([]);
  const [totalPeg, setTotalPeg] = useState(0);
  const [totalJdw, setTotalJdw] = useState(0);
  const [loading, setLoading]   = useState(false);

  const fetchPegawai = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getPegawaiList({ cari, status_aktif: statusAktif === "Semua" ? "" : statusAktif, size: 100 });
      setPegawai(r.data.data);
      setTotalPeg(r.data.total);
    } catch { setPegawai([]); setTotalPeg(0); }
    finally { setLoading(false); }
  }, [cari, statusAktif]);

  const fetchJadwal = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getJadwalList({ tgl, cari });
      setJadwal(r.data.data);
      setTotalJdw(r.data.total);
    } catch { setJadwal([]); setTotalJdw(0); }
    finally { setLoading(false); }
  }, [tgl, cari]);

  useEffect(() => {
    if (activeTab === 0) fetchPegawai();
    else fetchJadwal();
  }, [activeTab, fetchPegawai, fetchJadwal]);

  const handleCari = () => {
    if (activeTab === 0) fetchPegawai();
    else fetchJadwal();
  };

  const total = activeTab === 0 ? totalPeg : totalJdw;

  return (
    <div className="p-3 md:p-5 lg:p-6">
      <div className="mb-3 md:mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-800">Kepegawaian / SDM</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">Data pegawai & jadwal jaga</p>
        </div>
        <button className="inline-flex items-center gap-1.5 bg-green-700 text-white text-xs md:text-sm font-medium px-3 md:px-4 py-2 rounded-xl hover:bg-green-800 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Tambah Pegawai</span>
          <span className="sm:hidden">Tambah</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => { setActiveTab(i); setCari(""); }}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors
                ${activeTab === i ? "border-b-2 border-green-700 text-green-700 bg-green-50" : "text-slate-500 hover:text-slate-700"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="p-3 md:p-4 border-b border-slate-100">
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3 md:items-end">
            {activeTab === 1 && (
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs text-slate-500 mb-1">Tanggal</label>
                <DatePicker value={tgl} onChange={setTgl} label="Tanggal" />
              </div>
            )}
            {activeTab === 0 && (
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs text-slate-500 mb-1">Status Aktif</label>
                <select value={statusAktif} onChange={e => setStatusAktif(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {["Semua","Aktif","Tidak Aktif","Kontrak"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div className="col-span-2 md:flex-1">
              <label className="block text-xs text-slate-500 mb-1">Cari</label>
              <input type="text" value={cari} onChange={e => setCari(e.target.value)}
                placeholder="NIP / Nama Pegawai / Jabatan..."
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                onKeyDown={e => e.key === "Enter" && handleCari()} />
            </div>
            <button onClick={handleCari} className="col-span-2 md:col-span-1 w-full md:w-auto bg-green-700 text-white text-sm px-4 py-2 md:py-1.5 rounded-lg hover:bg-green-800 transition-colors">
              {loading ? "..." : "Cari"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">#</th>
                {activeTab === 0
                  ? ["NIP","Nama","J.K.","Jabatan","Bagian","Tmp.Lahir","Tgl.Lahir","Mulai Kerja","No.KTP","Pendidikan","No.Telp","Stts Aktif"].map(c => (
                      <th key={c} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{c}</th>
                    ))
                  : ["NIP","Nama","Bagian","Tanggal","Jam Masuk","Jam Keluar","Keterangan"].map(c => (
                      <th key={c} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{c}</th>
                    ))
                }
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-slate-400">Memuat data...</td></tr>
              ) : activeTab === 0 ? (
                pegawai.length === 0
                  ? <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-slate-400">Tidak ada data pegawai</td></tr>
                  : pegawai.map((row, i) => (
                    <tr key={row.nip || i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 text-xs font-mono">{row.nip || "-"}</td>
                      <td className="px-3 py-2 text-xs font-medium">{row.nama || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.jenis_kelamin || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.jabatan || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.bagian || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.tmp_lahir || "-"}</td>
                      <td className="px-3 py-2 text-xs">{formatTgl(row.tgl_lahir)}</td>
                      <td className="px-3 py-2 text-xs">{formatTgl(row.tgl_masuk)}</td>
                      <td className="px-3 py-2 text-xs font-mono">{row.no_ktp || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.pendidikan_terakhir || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.no_tlp || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.status_aktif || "-"}</td>
                    </tr>
                  ))
              ) : (
                jadwal.length === 0
                  ? <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">Tidak ada data jadwal</td></tr>
                  : jadwal.map((row, i) => (
                    <tr key={`${row.nip}-${i}`} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 text-xs font-mono">{row.nip || "-"}</td>
                      <td className="px-3 py-2 text-xs font-medium">{row.nama || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.bagian || "-"}</td>
                      <td className="px-3 py-2 text-xs">{formatTgl(row.tgl_kerja)}</td>
                      <td className="px-3 py-2 text-xs">{(row.jam_masuk || "").slice(0, 5) || "-"}</td>
                      <td className="px-3 py-2 text-xs">{(row.jam_keluar || "").slice(0, 5) || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.keterangan || "-"}</td>
                    </tr>
                  ))
              )}
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
