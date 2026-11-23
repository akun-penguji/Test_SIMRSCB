"use client";

// Monev SIMRS — Halaman utama
// Closed-loop tracking perbaikan SIMRS untuk bukti dukung Zona Integritas WBK.
//
// Fitur:
// - Filter periode (default 1 Jul 2025 – 30 Jun 2026 untuk audit aktif)
// - Filter status / kategori / prioritas / sumber + search
// - Tabel list dengan action: edit / hapus
// - Modal form CRUD
// - Tombol cetak laporan A4 (→ /monev/laporan)
// - Tombol export CSV
// - Statistik singkat di header

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  listMonev, createMonev, updateMonev, deleteMonev, getMonevStats, exportMonevCsv,
  MonevRow, MonevStats, MonevSumber, MonevKategori, MonevPrioritas, MonevStatus,
} from "@/lib/api";
import MicButton from "@/components/MicButton";

const SUMBER:    MonevSumber[]    = ["helpdesk","user","rapat","log_bridging","git","monitoring"];
const KATEGORI:  MonevKategori[]  = ["bug","performa","integrasi","fitur","data","lainnya"];
const PRIORITAS: MonevPrioritas[] = ["rendah","sedang","tinggi","kritis"];
const STATUS:    MonevStatus[]    = ["baru","proses","selesai","ditutup"];

// Periode audit WBK default
const PERIODE_DEFAULT = { dari: "2025-07-01", sampai: "2026-06-30" };

const statusBadge = (s: MonevStatus) => {
  const m: Record<MonevStatus, string> = {
    baru:    "bg-blue-100 text-blue-800",
    proses:  "bg-amber-100 text-amber-800",
    selesai: "bg-emerald-100 text-emerald-800",
    ditutup: "bg-slate-200 text-slate-700",
  };
  return m[s];
};

const prioritasBadge = (p: MonevPrioritas) => {
  const m: Record<MonevPrioritas, string> = {
    rendah: "bg-slate-100 text-slate-700",
    sedang: "bg-blue-100 text-blue-700",
    tinggi: "bg-orange-100 text-orange-800",
    kritis: "bg-rose-100 text-rose-800",
  };
  return m[p];
};

export default function MonevPage() {
  const [rows, setRows]       = useState<MonevRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [stats, setStats]     = useState<MonevStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [dari, setDari]       = useState(PERIODE_DEFAULT.dari);
  const [sampai, setSampai]   = useState(PERIODE_DEFAULT.sampai);
  const [fStatus, setFStatus]       = useState<MonevStatus | "">("");
  const [fKategori, setFKategori]   = useState<MonevKategori | "">("");
  const [fPrioritas, setFPrioritas] = useState<MonevPrioritas | "">("");
  const [fSumber, setFSumber]       = useState<MonevSumber | "">("");
  const [q, setQ]                   = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<MonevRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        listMonev({
          dari, sampai,
          status:    fStatus    || undefined,
          kategori:  fKategori  || undefined,
          prioritas: fPrioritas || undefined,
          sumber:    fSumber    || undefined,
          q:         q || undefined,
          limit:     500,
        }),
        getMonevStats(dari, sampai),
      ]);
      setRows(r.data.items);
      setTotal(r.data.total);
      setStats(s.data);
    } finally { setLoading(false); }
  }, [dari, sampai, fStatus, fKategori, fPrioritas, fSumber, q]);

  useEffect(() => { reload(); }, [reload]);

  const onHapus = async (r: MonevRow) => {
    if (!confirm(`Hapus monev ${r.kode}?`)) return;
    try { await deleteMonev(r.id); await reload(); }
    catch (e: any) { alert("Gagal hapus: " + (e.message || e)); }
  };

  const onSimpan = async (b: Partial<MonevRow>) => {
    try {
      if (editing) await updateMonev(editing.id, b);
      else await createMonev(b);
      setShowForm(false); setEditing(null);
      await reload();
    } catch (e: any) {
      alert("Gagal simpan: " + (e?.response?.data?.error || e.message || e));
    }
  };

  const csvUrl = useMemo(() => exportMonevCsv({
    dari, sampai, status: fStatus || undefined, kategori: fKategori || undefined,
    prioritas: fPrioritas || undefined, sumber: fSumber || undefined, q: q || undefined,
  }), [dari, sampai, fStatus, fKategori, fPrioritas, fSumber, q]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monev SIMRS</h1>
          <p className="text-sm text-slate-500">Closed-loop tracking perbaikan SIMRS untuk bukti dukung Zona Integritas WBK</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={csvUrl} target="_blank" rel="noreferrer"
             className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-sm font-semibold">
            ⬇ Export CSV
          </a>
          <Link href={`/monev/laporan?dari=${dari}&sampai=${sampai}`} target="_blank"
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold">
            🖨 Cetak Laporan A4
          </Link>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">
            + Tambah Temuan
          </button>
        </div>
      </header>

      {/* Stats ringkasan */}
      {stats && (
        <section className="grid grid-cols-5 gap-3">
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs uppercase tracking-widest text-slate-500">Total Temuan</p>
            <p className="text-3xl font-bold tabular-nums">{stats.total}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs uppercase tracking-widest text-emerald-700">Selesai</p>
            <p className="text-3xl font-bold tabular-nums text-emerald-900">{stats.selesai}</p>
            <p className="text-xs text-emerald-700 mt-1">{stats.pct_selesai}% closed loop</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs uppercase tracking-widest text-amber-700">Proses</p>
            <p className="text-3xl font-bold tabular-nums text-amber-900">{stats.proses}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs uppercase tracking-widest text-blue-700">Baru / Backlog</p>
            <p className="text-3xl font-bold tabular-nums text-blue-900">{stats.baru}</p>
          </div>
          <div className="bg-slate-100 border rounded-xl p-4">
            <p className="text-xs uppercase tracking-widest text-slate-600">Rapat Evaluasi</p>
            <p className="text-3xl font-bold tabular-nums">{stats.jumlah_rapat}</p>
          </div>
        </section>
      )}

      {/* Filter */}
      <section className="bg-white border rounded-xl p-4">
        <div className="grid grid-cols-7 gap-2">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Dari</label>
            <input type="date" value={dari} onChange={e => setDari(e.target.value)}
                   className="w-full px-2 py-1.5 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Sampai</label>
            <input type="date" value={sampai} onChange={e => setSampai(e.target.value)}
                   className="w-full px-2 py-1.5 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Status</label>
            <select value={fStatus} onChange={e => setFStatus(e.target.value as any)}
                    className="w-full px-2 py-1.5 border rounded text-sm">
              <option value="">Semua</option>
              {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Kategori</label>
            <select value={fKategori} onChange={e => setFKategori(e.target.value as any)}
                    className="w-full px-2 py-1.5 border rounded text-sm">
              <option value="">Semua</option>
              {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Prioritas</label>
            <select value={fPrioritas} onChange={e => setFPrioritas(e.target.value as any)}
                    className="w-full px-2 py-1.5 border rounded text-sm">
              <option value="">Semua</option>
              {PRIORITAS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Sumber</label>
            <select value={fSumber} onChange={e => setFSumber(e.target.value as any)}
                    className="w-full px-2 py-1.5 border rounded text-sm">
              <option value="">Semua</option>
              {SUMBER.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Cari</label>
            <input value={q} onChange={e => setQ(e.target.value)}
                   placeholder="kode/uraian/PIC..."
                   className="w-full px-2 py-1.5 border rounded text-sm" />
          </div>
        </div>
      </section>

      {/* Tabel */}
      <section className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-2 py-2 text-left">Kode</th>
              <th className="px-2 py-2 text-left">Tanggal</th>
              <th className="px-2 py-2 text-left">Sumber</th>
              <th className="px-2 py-2 text-left">Uraian</th>
              <th className="px-2 py-2 text-left">Unit</th>
              <th className="px-2 py-2 text-center">Prioritas</th>
              <th className="px-2 py-2 text-center">Status</th>
              <th className="px-2 py-2 text-left">PIC</th>
              <th className="px-2 py-2 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="py-6 text-center text-slate-400">Memuat...</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="py-6 text-center text-slate-400 italic">
                Tidak ada data. Klik "+ Tambah Temuan" atau import via CSV.
              </td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="border-t hover:bg-slate-50">
                <td className="px-2 py-2 font-mono text-xs">{r.kode}</td>
                <td className="px-2 py-2 font-mono text-xs">{r.tanggal_lapor}</td>
                <td className="px-2 py-2">
                  <span className="px-1.5 py-0.5 rounded text-xs bg-indigo-100 text-indigo-800">{r.sumber}</span>
                </td>
                <td className="px-2 py-2 max-w-md">
                  <div className="truncate" title={r.deskripsi_masalah}>{r.deskripsi_masalah}</div>
                  <div className="text-xs text-slate-400">{r.kategori}</div>
                </td>
                <td className="px-2 py-2 text-xs">{r.unit_terdampak || "-"}</td>
                <td className="px-2 py-2 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${prioritasBadge(r.prioritas)}`}>{r.prioritas}</span>
                </td>
                <td className="px-2 py-2 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${statusBadge(r.status)}`}>{r.status}</span>
                </td>
                <td className="px-2 py-2 text-xs">{r.pic || "-"}</td>
                <td className="px-2 py-2 text-center">
                  <button onClick={() => { setEditing(r); setShowForm(true); }}
                          className="text-blue-600 hover:underline text-xs mr-2">Edit</button>
                  <button onClick={() => onHapus(r)}
                          className="text-rose-600 hover:underline text-xs">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-3 py-2 text-xs text-slate-500 border-t bg-slate-50">
          {loading ? "..." : `${rows.length} dari ${total} temuan`}
        </p>
      </section>

      {showForm && (
        <FormModal
          existing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSimpan={onSimpan}
        />
      )}
    </div>
  );
}

function FormModal({
  existing, onClose, onSimpan
}: { existing: MonevRow | null; onClose: () => void; onSimpan: (b: Partial<MonevRow>) => void }) {
  const [f, setF] = useState<Partial<MonevRow>>(existing ?? {
    tanggal_lapor: new Date().toISOString().slice(0, 10),
    sumber:    "helpdesk",
    kategori:  "bug",
    prioritas: "sedang",
    status:    "baru",
  });

  const set = (k: keyof MonevRow, v: any) => setF(prev => ({ ...prev, [k]: v }));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-6 overflow-y-auto"
      style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-6 text-slate-900"
        style={{ backgroundColor: "#ffffff" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">{existing ? `Edit ${existing.kode}` : "Tambah Temuan Baru"}</h2>
          <button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-700 px-2">×</button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSimpan(f); }} className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Tanggal Lapor *</label>
              <input type="date" required value={f.tanggal_lapor || ""}
                     onChange={e => set("tanggal_lapor", e.target.value)}
                     className="w-full px-2 py-1.5 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Sumber *</label>
              <select required value={f.sumber || "helpdesk"} onChange={e => set("sumber", e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-sm">
                {SUMBER.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Kategori *</label>
              <select required value={f.kategori || "bug"} onChange={e => set("kategori", e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-sm">
                {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Prioritas *</label>
              <select required value={f.prioritas || "sedang"} onChange={e => set("prioritas", e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-sm">
                {PRIORITAS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Unit Terdampak</label>
              <input value={f.unit_terdampak || ""} onChange={e => set("unit_terdampak", e.target.value)}
                     placeholder="Rawat Jalan / IGD / Apotek / dll"
                     className="w-full px-2 py-1.5 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">PIC</label>
              <input value={f.pic || ""} onChange={e => set("pic", e.target.value)}
                     placeholder="Nama / kode pegawai IT"
                     className="w-full px-2 py-1.5 border rounded text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Deskripsi Masalah *</label>
            <div className="relative">
            <textarea required rows={2} value={f.deskripsi_masalah || ""}
                      onChange={e => set("deskripsi_masalah", e.target.value)}
                      className="w-full px-2 py-1.5 pr-8 border rounded text-sm" />
            <MicButton value={f.deskripsi_masalah || ""} onChange={v => set("deskripsi_masalah", v)} className="absolute right-1.5 bottom-1.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Akar Masalah</label>
            <div className="relative">
            <textarea rows={2} value={f.akar_masalah || ""}
                      onChange={e => set("akar_masalah", e.target.value)}
                      className="w-full px-2 py-1.5 pr-8 border rounded text-sm" />
            <MicButton value={f.akar_masalah || ""} onChange={v => set("akar_masalah", v)} className="absolute right-1.5 bottom-1.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Tindakan Perbaikan</label>
            <div className="relative">
            <textarea rows={2} value={f.tindakan_perbaikan || ""}
                      onChange={e => set("tindakan_perbaikan", e.target.value)}
                      className="w-full px-2 py-1.5 pr-8 border rounded text-sm" />
            <MicButton value={f.tindakan_perbaikan || ""} onChange={v => set("tindakan_perbaikan", v)} className="absolute right-1.5 bottom-1.5" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Tanggal Selesai</label>
              <input type="date" value={f.tanggal_selesai || ""}
                     onChange={e => set("tanggal_selesai", e.target.value)}
                     className="w-full px-2 py-1.5 border rounded text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1">Status *</label>
              <select required value={f.status || "baru"} onChange={e => set("status", e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-sm">
                {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {f.status === "selesai" && (
                <p className="text-xs text-amber-700 mt-1">
                  ⚠ Status "selesai" mewajibkan: <strong>tindakan perbaikan</strong>, <strong>hasil verifikasi</strong>, dan <strong>tanggal selesai</strong> (closed-loop WBK).
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              Hasil Verifikasi {f.status === "selesai" && <span className="text-rose-600">*</span>}
            </label>
            <div className="relative">
            <textarea rows={3} value={f.hasil_verifikasi || ""}
                      onChange={e => set("hasil_verifikasi", e.target.value)}
                      placeholder="Hasil retest setelah perbaikan (before/after, screenshot, ticket #ID, dll.)"
                      className="w-full px-2 py-1.5 pr-8 border rounded text-sm" />
            <MicButton value={f.hasil_verifikasi || ""} onChange={v => set("hasil_verifikasi", v)} className="absolute right-1.5 bottom-1.5" />
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <button type="submit" className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold">
              💾 Simpan
            </button>
            <button type="button" onClick={onClose}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg">
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
