"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getIgdList, IgdRow,
  igdCariPasien, igdListDokter, igdListPenjab, igdRegistrasi, igdEdit, igdHapus,
  IgdPasien,
} from "@/lib/api";
import SuratDropdown from "@/components/SuratDropdown";

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
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function StatusBadge({ v }: { v?: string }) {
  const color =
    v === "Sudah"   ? "bg-green-100 text-green-700" :
    v === "Belum"   ? "bg-amber-100 text-amber-700"  :
    v === "Batal"   ? "bg-red-100 text-red-700"      :
    v === "Dirawat" ? "bg-blue-100 text-blue-700"    :
    v === "Meninggal" ? "bg-slate-700 text-white"    : "bg-slate-100 text-slate-500";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{v || "-"}</span>;
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

export default function IGDPage() {
  const router = useRouter();
  const navigate = (path: string) => router.push(path);
  const today = new Date().toLocaleDateString("en-CA");
  const [tglAwal, setTglAwal]   = useState(today);
  const [tglAkhir, setTglAkhir] = useState(today);
  const [cari, setCari]     = useState("");
  const [status, setStatus] = useState("Semua");
  const [data, setData]     = useState<IgdRow[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast]   = useState<{ t: "ok" | "err"; m: string } | null>(null);

  // lookups
  const [dokterList, setDokterList] = useState<{ kd_dokter: string; nm_dokter: string }[]>([]);
  const [penjabList, setPenjabList] = useState<{ kd_pj: string; png_jawab: string }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getIgdList({ tgl_awal: tglAwal, tgl_akhir: tglAkhir, cari, status, size: 100 });
      setData(r.data.data); setTotal(r.data.total);
    } catch { setData([]); setTotal(0); }
    finally { setLoading(false); }
  }, [tglAwal, tglAkhir, cari, status]);
  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    igdListDokter().then(r => setDokterList(r.data)).catch(() => {});
    igdListPenjab().then(r => setPenjabList(r.data)).catch(() => {});
  }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  // ── Modal state ──
  const [modal, setModal] = useState<null | "reg" | "edit">(null);
  const [editNoRawat, setEditNoRawat] = useState<string | null>(null);
  const [pasien, setPasien] = useState<IgdPasien | null>(null);
  const [cariPasien, setCariPasien] = useState("");
  const [hasilPasien, setHasilPasien] = useState<IgdPasien[]>([]);
  const [kdDokter, setKdDokter] = useState("");
  const [kdPj, setKdPj] = useState("");
  const [pJawab, setPJawab] = useState("");
  const [almtPj, setAlmtPj] = useState("");
  const [hubPj, setHubPj] = useState("");
  const [tglReg, setTglReg] = useState(today);
  const [jamReg, setJamReg] = useState(nowTime());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cariPasien.trim().length < 2) { setHasilPasien([]); return; }
    const t = setTimeout(() => {
      igdCariPasien(cariPasien.trim()).then(r => setHasilPasien(r.data.data)).catch(() => setHasilPasien([]));
    }, 250);
    return () => clearTimeout(t);
  }, [cariPasien]);

  const bukaReg = () => {
    setModal("reg"); setEditNoRawat(null);
    setPasien(null); setCariPasien(""); setHasilPasien([]);
    setKdDokter(""); setKdPj(""); setPJawab(""); setAlmtPj(""); setHubPj("");
    setTglReg(today); setJamReg(nowTime());
  };
  const bukaEdit = (row: IgdRow) => {
    setModal("edit"); setEditNoRawat(row.no_rawat);
    setPasien({ no_rm: row.no_rm, nm_pasien: row.nm_pasien ?? "", jk: row.jk, tgl_lahir: row.tgl_lahir });
    setKdDokter(row.kd_dokter ?? ""); setKdPj(row.kd_pj ?? "");
    setPJawab(row.png_jawab ?? ""); setAlmtPj(""); setHubPj(row.hubunganpj ?? "");
  };
  const pilihPasien = (p: IgdPasien) => {
    setPasien(p); setCariPasien(""); setHasilPasien([]);
    setPJawab(p.nama_pj ?? ""); setHubPj(p.hub_pj ?? "");
    setAlmtPj(p.alamat ?? ""); setKdPj(p.kd_pj_default ?? "");
  };

  const simpan = async () => {
    if (!pasien) { setToast({ t: "err", m: "Pilih pasien dulu" }); return; }
    if (!kdDokter) { setToast({ t: "err", m: "Pilih dokter" }); return; }
    if (!kdPj) { setToast({ t: "err", m: "Pilih penjamin" }); return; }
    setSaving(true);
    try {
      if (modal === "edit" && editNoRawat) {
        await igdEdit({ no_rawat: editNoRawat, kd_dokter: kdDokter, kd_pj: kdPj, p_jawab: pJawab, almt_pj: almtPj, hubunganpj: hubPj });
        setToast({ t: "ok", m: "Registrasi IGD diperbarui" });
      } else {
        const r = await igdRegistrasi({
          no_rm: pasien.no_rm, kd_dokter: kdDokter, kd_pj: kdPj,
          p_jawab: pJawab, almt_pj: almtPj, hubunganpj: hubPj, tgl_registrasi: tglReg, jam_reg: jamReg,
        });
        setToast({ t: "ok", m: `Terdaftar — No.Rawat ${r.data.no_rawat}, No.Reg ${r.data.no_reg}` });
      }
      setModal(null); fetchData();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setToast({ t: "err", m: err.response?.data?.error ?? "Gagal menyimpan" });
    } finally { setSaving(false); }
  };

  const hapus = async (row: IgdRow) => {
    if (!confirm(`Hapus registrasi IGD ${row.nm_pasien ?? row.no_rm} (${row.no_rawat})?`)) return;
    try {
      await igdHapus(row.no_rawat);
      setToast({ t: "ok", m: "Registrasi dihapus" }); fetchData();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setToast({ t: "err", m: err.response?.data?.error ?? "Gagal menghapus" });
    }
  };

  return (
    <div className="p-3 md:p-5 lg:p-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm shadow-lg ${toast.t === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.m}
        </div>
      )}

      <div className="mb-3 md:mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-800">IGD</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">Instalasi Gawat Darurat</p>
        </div>
        <button onClick={bukaReg} className="inline-flex items-center gap-1.5 md:gap-2 bg-green-700 text-white text-xs md:text-sm font-medium px-3 md:px-4 py-2 rounded-xl hover:bg-green-800 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Registrasi IGD</span>
          <span className="sm:hidden">Registrasi</span>
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
            <label className="block text-xs text-slate-500 mb-1">Status Rawat</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {["Semua","Baru","Lama","Selesai","Dirujuk","Meninggal","Dirawat","Pulang Paksa"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2 md:flex-1">
            <label className="block text-xs text-slate-500 mb-1">Cari</label>
            <input value={cari} onChange={e => setCari(e.target.value)} placeholder="No.RM / Nama Pasien / No.Rawat..."
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
          <table className="w-full text-sm text-black">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">#</th>
                {["No.Reg","No.Rawat","Tanggal","Jam","No.RM","Pasien","Aksi","J.K.","Umur","Dokter","P.Jawab","Hub PJ","Jaminan","Status","Stts Daftar","Stts Bayar"].map(c => (
                  <th key={c} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={17} className="px-4 py-10 text-center text-sm text-slate-400">Memuat data...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={17} className="px-4 py-10 text-center text-sm text-slate-400">Tidak ada data IGD</td></tr>
              ) : data.map((row, i) => (
                <tr key={row.no_rawat} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs text-black">{i + 1}</td>
                  <td className="px-3 py-2 text-xs">{row.no_reg || "-"}</td>
                  <td className="px-3 py-2 text-xs font-mono">{row.no_rawat}</td>
                  <td className="px-3 py-2 text-xs">{formatTgl(row.tgl_registrasi)}</td>
                  <td className="px-3 py-2 text-xs">{(row.jam_reg || "").slice(0, 5)}</td>
                  <td className="px-3 py-2 text-xs font-mono">{row.no_rm}</td>
                  <td className="px-3 py-2 text-xs font-medium">{row.nm_pasien || "-"}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <SuratDropdown reg={row} onNavigate={navigate} />
                      <button onClick={() => navigate(`/catatan-keperawatan?no_rawat=${encodeURIComponent(row.no_rawat)}&jenis=ralan`)} className="text-sky-600 hover:underline">Catatan Kep.</button>
                      <button onClick={() => bukaEdit(row)} className="text-indigo-600 hover:underline">Edit</button>
                      <button onClick={() => hapus(row)} className="text-red-500 hover:underline">Hapus</button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">{row.jk === "L" ? "L" : row.jk === "P" ? "P" : "-"}</td>
                  <td className="px-3 py-2 text-xs">{hitungUsia(row.tgl_lahir)}</td>
                  <td className="px-3 py-2 text-xs">{row.nm_dokter || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.png_jawab || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.hubunganpj || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.penjab_nama || row.kd_pj || "-"}</td>
                  <td className="px-3 py-2"><StatusBadge v={row.stts} /></td>
                  <td className="px-3 py-2 text-xs">{row.stts_daftar || "-"}</td>
                  <td className="px-3 py-2 text-xs">{row.status_bayar || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
          {loading ? "Memuat..." : `${total.toLocaleString("id-ID")} data ditemukan`}
        </div>
      </div>

      {/* ── Modal Registrasi / Edit ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">{modal === "edit" ? "Edit Registrasi IGD" : "Registrasi IGD Baru"}</h2>

            {/* Pasien */}
            {modal === "reg" && !pasien && (
              <div className="relative mb-3">
                <label className="block text-xs text-slate-500 mb-1">Cari Pasien (nama / No.RM / KTP)</label>
                <input value={cariPasien} onChange={e => setCariPasien(e.target.value)} autoFocus
                  placeholder="Ketik min 2 huruf…" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                {hasilPasien.length > 0 && (
                  <div className="absolute z-10 bg-white border border-slate-200 rounded-lg mt-1 w-full max-h-56 overflow-y-auto shadow-lg">
                    {hasilPasien.map(p => (
                      <button key={p.no_rm} onClick={() => pilihPasien(p)} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                        <span className="font-mono text-xs text-slate-400">{p.no_rm}</span> {p.nm_pasien}
                        <span className="text-xs text-slate-400 ml-1">{p.jk} · {hitungUsia(p.tgl_lahir ?? undefined)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {pasien && (
              <div className="mb-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-medium text-slate-800">{pasien.nm_pasien} <span className="font-mono text-xs text-slate-400">{pasien.no_rm}</span></div>
                  <div className="text-xs text-slate-500">{pasien.jk === "L" ? "Laki-laki" : pasien.jk === "P" ? "Perempuan" : "-"} · {hitungUsia(pasien.tgl_lahir ?? undefined)}</div>
                </div>
                {modal === "reg" && <button onClick={() => setPasien(null)} className="text-xs text-red-500">ganti</button>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm col-span-2">
                <span className="block text-slate-500 mb-1">Dokter IGD</span>
                <select value={kdDokter} onChange={e => setKdDokter(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">— pilih dokter —</option>
                  {dokterList.map(d => <option key={d.kd_dokter} value={d.kd_dokter}>{d.nm_dokter}</option>)}
                </select>
              </label>
              <label className="text-sm col-span-2">
                <span className="block text-slate-500 mb-1">Penjamin / Cara Bayar</span>
                <select value={kdPj} onChange={e => setKdPj(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">— pilih penjamin —</option>
                  {penjabList.map(p => <option key={p.kd_pj} value={p.kd_pj}>{p.png_jawab}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-slate-500 mb-1">Penanggung Jawab</span>
                <input value={pJawab} onChange={e => setPJawab(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <span className="block text-slate-500 mb-1">Hubungan PJ</span>
                <input value={hubPj} onChange={e => setHubPj(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="mis. Diri Sendiri" />
              </label>
              <label className="text-sm col-span-2">
                <span className="block text-slate-500 mb-1">Alamat PJ</span>
                <input value={almtPj} onChange={e => setAlmtPj(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </label>
              {modal === "reg" && (
                <>
                  <label className="text-sm">
                    <span className="block text-slate-500 mb-1">Tanggal</span>
                    <input type="date" value={tglReg} onChange={e => setTglReg(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </label>
                  <label className="text-sm">
                    <span className="block text-slate-500 mb-1">Jam</span>
                    <input type="time" step={1} value={jamReg} onChange={e => setJamReg(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </label>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
              <button onClick={simpan} disabled={saving} className="px-5 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50">
                {saving ? "Menyimpan…" : modal === "edit" ? "Simpan Perubahan" : "Daftar IGD"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
