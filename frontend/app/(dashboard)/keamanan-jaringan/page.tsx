"use client";

// Pemeliharaan Keamanan Jaringan & Pembaruan Anti-Malware Perangkat.
// Register/log keamanan informasi (MRMIK): kegiatan jaringan (firewall, monitoring,
// patch, backup) + pembaruan anti-malware per perangkat (versi definisi, hasil scan).

import { useCallback, useEffect, useState } from "react";
import {
  listKeamananJaringan, createKeamananJaringan, updateKeamananJaringan, deleteKeamananJaringan,
  getKeamananJaringanLaporan, KeamananJaringan, KeamananJaringanLaporan,
} from "@/lib/api";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tglID = (s: string | null | undefined) => {
  if (!s) return "-";
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return m >= 1 && m <= 12 ? `${d} ${BULAN[m - 1]} ${y}` : s;
};
const kosong: Partial<KeamananJaringan> = { jenis: "Jaringan", status: "Selesai", tanggal: new Date().toISOString().slice(0, 10) };

export default function KeamananJaringanPage() {
  const now = new Date();
  const [tahun, setTahun] = useState(2025);
  const [jenis, setJenis] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<KeamananJaringan[]>([]);
  const [lap, setLap] = useState<KeamananJaringanLaporan | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [form, setForm] = useState<Partial<KeamananJaringan> | null>(null);
  const [saving, setSaving] = useState(false);

  const muat = useCallback(() => {
    setLoading(true); setErr("");
    Promise.all([
      listKeamananJaringan({ tahun, jenis: jenis || undefined, q: q || undefined }),
      getKeamananJaringanLaporan(tahun),
    ]).then(([r, l]) => { setRows(r.data); setLap(l.data); })
      .catch(() => setErr("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [tahun, jenis, q]);
  useEffect(() => { muat(); }, [muat]);

  const simpan = async () => {
    if (!form?.tanggal || !form?.kegiatan) { setErr("Tanggal & Kegiatan wajib diisi"); return; }
    setSaving(true); setErr("");
    try {
      if (form.id) await updateKeamananJaringan(form.id, form);
      else await createKeamananJaringan(form);
      setForm(null); muat();
    } catch { setErr("Gagal menyimpan"); } finally { setSaving(false); }
  };
  const hapus = async (id: number) => {
    if (!confirm("Hapus catatan ini?")) return;
    try { await deleteKeamananJaringan(id); muat(); } catch { setErr("Gagal menghapus"); }
  };

  const set = (k: keyof KeamananJaringan, v: string) => setForm(f => ({ ...f, [k]: v }));
  const isAM = form?.jenis === "Anti-Malware";

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h1 className="text-xl font-bold text-slate-800 mr-2">Keamanan Jaringan & Anti-Malware</h1>
        <select value={tahun} onChange={e => setTahun(+e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm">
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={jenis} onChange={e => setJenis(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm">
          <option value="">Semua Jenis</option>
          <option value="Jaringan">Keamanan Jaringan</option>
          <option value="Anti-Malware">Anti-Malware</option>
          <option value="Fisik & Backup">Fisik Server & Backup</option>
          <option value="Server & Koneksi">Server/VM & Koneksi</option>
          <option value="Patch & Update">Patch & Update Aplikasi</option>
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari kegiatan/perangkat…" className="border border-slate-300 rounded px-2 py-1 text-sm w-52" />
        <button onClick={() => setForm({ ...kosong })} className="bg-emerald-600 text-white text-sm font-semibold rounded px-3 py-1.5 ml-auto">+ Tambah</button>
      </div>

      {/* Ringkasan */}
      {lap && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="bg-white border border-slate-200 rounded-lg p-3"><div className="text-2xl font-bold text-slate-800">{lap.total}</div><div className="text-xs text-slate-500">Total kegiatan {lap.tahun}</div></div>
          {lap.per_jenis.map(j => (
            <div key={j.jenis} className="bg-white border border-slate-200 rounded-lg p-3"><div className="text-2xl font-bold text-sky-700">{j.jumlah}</div><div className="text-xs text-slate-500">{j.jenis}</div></div>
          ))}
          <div className="bg-white border border-slate-200 rounded-lg p-3"><div className="text-2xl font-bold text-amber-600">{lap.ada_temuan}</div><div className="text-xs text-slate-500">Ada temuan</div></div>
        </div>
      )}

      {err && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-2.5 mb-3">{err}</div>}

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 whitespace-nowrap">Tanggal</th>
              <th className="text-left px-3 py-2">Jenis</th>
              <th className="text-left px-3 py-2">Kegiatan</th>
              <th className="text-left px-3 py-2">Perangkat / Antivirus</th>
              <th className="text-left px-3 py-2">Hasil / Temuan</th>
              <th className="text-left px-3 py-2">Petugas</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="text-center text-slate-400 py-6">Memuat…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada data untuk {tahun}.</td></tr>
              : rows.map(r => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{tglID(r.tanggal)}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs rounded px-1.5 py-0.5 whitespace-nowrap ${r.jenis === "Anti-Malware" ? "bg-violet-100 text-violet-700" : r.jenis === "Fisik & Backup" ? "bg-emerald-100 text-emerald-700" : r.jenis === "Server & Koneksi" ? "bg-indigo-100 text-indigo-700" : r.jenis === "Patch & Update" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>{r.jenis}</span>
                    {r.jenis === "Patch & Update" && r.temuan && <span className="block mt-1 text-xs rounded px-1.5 py-0.5 bg-rose-100 text-rose-700 font-semibold whitespace-nowrap">🔒 Patch Keamanan</span>}
                  </td>
                  <td className="px-3 py-2">{r.kegiatan}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {r.perangkat && <div>{r.perangkat}{r.ip_address ? ` (${r.ip_address})` : ""}</div>}
                    {r.antivirus && <div>{r.antivirus}{r.versi_definisi ? ` · def ${r.versi_definisi}` : ""}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.hasil && <div className="text-slate-700">{r.hasil}</div>}
                    {r.temuan && <div className="text-amber-700">⚠ {r.temuan}</div>}
                    {r.tindak_lanjut && <div className="text-slate-500">↳ {r.tindak_lanjut}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.petugas || "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <button onClick={() => setForm(r)} className="text-sky-600 text-xs mr-2">Edit</button>
                    <button onClick={() => hapus(r.id)} className="text-rose-500 text-xs">Hapus</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Form modal */}
      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={() => setForm(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg my-8" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">{form.id ? "Edit" : "Tambah"} Catatan Keamanan</div>
            <div className="p-4 grid grid-cols-2 gap-3 text-sm">
              <label className="flex flex-col gap-1">Tanggal *
                <input type="date" value={form.tanggal || ""} onChange={e => set("tanggal", e.target.value)} className="border border-slate-300 rounded px-2 py-1" /></label>
              <label className="flex flex-col gap-1">Jenis
                <select value={form.jenis || "Jaringan"} onChange={e => set("jenis", e.target.value)} className="border border-slate-300 rounded px-2 py-1">
                  <option value="Jaringan">Keamanan Jaringan</option>
                  <option value="Anti-Malware">Anti-Malware</option>
                  <option value="Fisik & Backup">Fisik Server & Backup</option>
                  <option value="Server & Koneksi">Server/VM & Koneksi</option>
                  <option value="Patch & Update">Patch & Update Aplikasi</option>
                </select></label>
              <label className="flex flex-col gap-1 col-span-2">Kegiatan *
                <input value={form.kegiatan || ""} onChange={e => set("kegiatan", e.target.value)} placeholder={isAM ? "mis. Pembaruan definisi & full scan" : "mis. Pemeriksaan firewall & monitoring trafik"} className="border border-slate-300 rounded px-2 py-1" /></label>
              <label className="flex flex-col gap-1">Perangkat {isAM && "*"}
                <input value={form.perangkat || ""} onChange={e => set("perangkat", e.target.value)} placeholder="mis. Server SIMRS / PC Pendaftaran" className="border border-slate-300 rounded px-2 py-1" /></label>
              <label className="flex flex-col gap-1">IP Address
                <input value={form.ip_address || ""} onChange={e => set("ip_address", e.target.value)} placeholder="192.168.8.x" className="border border-slate-300 rounded px-2 py-1" /></label>
              <label className="flex flex-col gap-1">Antivirus / Anti-Malware
                <input value={form.antivirus || ""} onChange={e => set("antivirus", e.target.value)} placeholder="mis. Windows Defender / Smadav" className="border border-slate-300 rounded px-2 py-1" /></label>
              <label className="flex flex-col gap-1">Versi Definisi
                <input value={form.versi_definisi || ""} onChange={e => set("versi_definisi", e.target.value)} placeholder="mis. 1.415.28.0 / 2025-06-14" className="border border-slate-300 rounded px-2 py-1" /></label>
              <label className="flex flex-col gap-1 col-span-2">Hasil
                <textarea value={form.hasil || ""} onChange={e => set("hasil", e.target.value)} rows={2} placeholder="mis. Bersih, tidak ditemukan malware / Firewall normal" className="border border-slate-300 rounded px-2 py-1" /></label>
              <label className="flex flex-col gap-1 col-span-2">Temuan (jika ada)
                <textarea value={form.temuan || ""} onChange={e => set("temuan", e.target.value)} rows={2} className="border border-slate-300 rounded px-2 py-1" /></label>
              <label className="flex flex-col gap-1 col-span-2">Tindak Lanjut
                <textarea value={form.tindak_lanjut || ""} onChange={e => set("tindak_lanjut", e.target.value)} rows={2} className="border border-slate-300 rounded px-2 py-1" /></label>
              <label className="flex flex-col gap-1">Status
                <select value={form.status || "Selesai"} onChange={e => set("status", e.target.value)} className="border border-slate-300 rounded px-2 py-1">
                  <option value="Selesai">Selesai</option><option value="Proses">Proses</option>
                </select></label>
              <label className="flex flex-col gap-1">Petugas
                <input list="petugas-it" value={form.petugas || ""} onChange={e => set("petugas", e.target.value)} placeholder="Nama petugas IT" className="border border-slate-300 rounded px-2 py-1" />
                <datalist id="petugas-it"><option value="Galih" /><option value="Irfan" /><option value="Rifda" /></datalist></label>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setForm(null)} className="text-slate-600 text-sm px-3 py-1.5">Batal</button>
              <button onClick={simpan} disabled={saving} className="bg-emerald-600 text-white text-sm font-semibold rounded px-4 py-1.5 disabled:opacity-50">{saving ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
