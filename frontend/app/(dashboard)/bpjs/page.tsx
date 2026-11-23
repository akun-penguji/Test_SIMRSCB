"use client";

import { useState, useRef, useCallback } from "react";
import { getSepList, SepRow } from "@/lib/api";

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

export default function BPJSPage() {
  const today = new Date().toLocaleDateString("en-CA");
  const [activeTab, setActiveTab] = useState(0);
  const [tglAwal, setTglAwal]   = useState(today);
  const [tglAkhir, setTglAkhir] = useState(today);
  const [cari, setCari]         = useState("");
  const [data, setData]         = useState<SepRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);

  // Form Input SEP state
  const [noRujukan, setNoRujukan]           = useState("");
  const [tglRujuk, setTglRujuk]             = useState(today);
  const [tglSEP, setTglSEP]                 = useState(today);
  const [jenisPelayanan, setJenisPelayanan] = useState("2. Ralan");
  const [kelas, setKelas]                   = useState("1");
  const [naikKelas, setNaikKelas]           = useState("");
  const [lakaLantas, setLakaLantas]         = useState("0");
  const [asalRujukan, setAsalRujukan]       = useState("");
  const [noTelp, setNoTelp]                 = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getSepList({ tgl_awal: tglAwal, tgl_akhir: tglAkhir, cari, size: 100 });
      setData(r.data.data);
      setTotal(r.data.total);
    } catch { setData([]); setTotal(0); }
    finally { setLoading(false); }
  }, [tglAwal, tglAkhir, cari]);

  return (
    <div className="p-3 md:p-5 lg:p-6">
      <div className="mb-3 md:mb-5">
        <h1 className="text-lg md:text-xl font-bold text-slate-800">BPJS / Bridging</h1>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">SEP, pengajuan klaim & verifikasi BPJS Kesehatan</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          {["Input SEP","Data SEP"].map((t, i) => (
            <button key={t} onClick={() => setActiveTab(i)}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors
                ${activeTab === i ? "border-b-2 border-green-700 text-green-700 bg-green-50" : "text-slate-500 hover:text-slate-700"}`}>
              {t}
            </button>
          ))}
        </div>

        {activeTab === 0 ? (
          <div className="p-5 max-w-2xl">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Form Input SEP</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">No. Rujukan</label>
                <input type="text" value={noRujukan} onChange={e => setNoRujukan(e.target.value)}
                  placeholder="Nomor rujukan BPJS..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Tgl. Rujukan</label>
                <DatePicker value={tglRujuk} onChange={setTglRujuk} label="Tgl. Rujukan" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Tgl. SEP</label>
                <DatePicker value={tglSEP} onChange={setTglSEP} label="Tgl. SEP" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">No. Telepon Peserta</label>
                <input type="text" value={noTelp} onChange={e => setNoTelp(e.target.value)}
                  placeholder="No. HP peserta..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Asal Rujukan</label>
                <input type="text" value={asalRujukan} onChange={e => setAsalRujukan(e.target.value)}
                  placeholder="Nama fasilitas perujuk..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Jenis Pelayanan</label>
                <select value={jenisPelayanan} onChange={e => setJenisPelayanan(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option>1. Ranap</option><option>2. Ralan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Kelas Rawat</label>
                <select value={kelas} onChange={e => setKelas(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="1">Kelas 1</option><option value="2">Kelas 2</option><option value="3">Kelas 3</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Naik Kelas</label>
                <select value={naikKelas} onChange={e => setNaikKelas(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">Tidak</option>
                  <option value="1">Ya — Atas Permintaan Sendiri</option>
                  <option value="2">Ya — Perusahaan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Laka Lantas</label>
                <select value={lakaLantas} onChange={e => setLakaLantas(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="0">Tidak</option>
                  <option value="1">Ya — Lalu Lintas</option>
                  <option value="2">Ya — Kecelakaan Kerja</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="bg-green-700 text-white text-sm px-5 py-2 rounded-lg hover:bg-green-800 transition-colors">Simpan SEP</button>
              <button className="bg-slate-100 text-slate-600 text-sm px-5 py-2 rounded-lg hover:bg-slate-200 transition-colors">Batal</button>
            </div>
            <p className="text-xs text-slate-400 mt-3">Bridging ke server BPJS dalam pengembangan</p>
          </div>
        ) : (
          <div>
            <div className="p-3 md:p-4 border-b border-slate-100">
              <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3 md:items-end">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Dari Tanggal</label>
                  <DatePicker value={tglAwal} onChange={setTglAwal} label="Dari Tanggal" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Sampai Tanggal</label>
                  <DatePicker value={tglAkhir} onChange={setTglAkhir} label="Sampai Tanggal" />
                </div>
                <div className="col-span-2 md:flex-1">
                  <label className="block text-xs text-slate-500 mb-1">Cari</label>
                  <input type="text" value={cari} onChange={e => setCari(e.target.value)}
                    placeholder="No.SEP / No.RM / Nama / No.Kartu..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    onKeyDown={e => e.key === "Enter" && fetchData()} />
                </div>
                <button onClick={fetchData} className="col-span-2 md:col-span-1 w-full md:w-auto bg-green-700 text-white text-sm px-4 py-2 md:py-1.5 rounded-lg hover:bg-green-800 transition-colors">
                  {loading ? "..." : "Cari"}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">#</th>
                    {["No.SEP","No.Rawat","No.RM","Nama Pasien","Tgl.SEP","Tgl.Rujukan","No.Rujukan","PPK Rujukan","Jenis","Kelas","Kode Dx","Nama Diagnosa","Poli","No.Kartu","Peserta","DPJP","Tujuan","Status Pulang","Tgl.Pulang"].map(c => (
                      <th key={c} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={20} className="px-4 py-10 text-center text-sm text-slate-400">Memuat data...</td></tr>
                  ) : data.length === 0 ? (
                    <tr><td colSpan={20} className="px-4 py-10 text-center text-sm text-slate-400">Klik Cari untuk menampilkan data SEP</td></tr>
                  ) : data.map((row, i) => (
                    <tr key={row.no_rawat + i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 text-xs font-mono">{row.no_sep || "-"}</td>
                      <td className="px-3 py-2 text-xs font-mono">{row.no_rawat}</td>
                      <td className="px-3 py-2 text-xs font-mono">{row.no_rm || "-"}</td>
                      <td className="px-3 py-2 text-xs font-medium">{row.nm_pasien || "-"}</td>
                      <td className="px-3 py-2 text-xs">{formatTgl(row.tgl_sep)}</td>
                      <td className="px-3 py-2 text-xs">{formatTgl(row.tgl_rujuk)}</td>
                      <td className="px-3 py-2 text-xs">{row.no_rujukan || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.nm_ppk || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.jenis_rawat || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.kls_rawat || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.kd_diagnosa || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.nm_diagnosa || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.nm_poli || "-"}</td>
                      <td className="px-3 py-2 text-xs font-mono">{row.no_kartu || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.nm_peserta || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.nm_dpjp || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.tujuan_kunjungan || "-"}</td>
                      <td className="px-3 py-2 text-xs">{row.status_pulang || "-"}</td>
                      <td className="px-3 py-2 text-xs">{formatTgl(row.tgl_pulang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
              {loading ? "Memuat..." : `${total.toLocaleString("id-ID")} data ditemukan`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
