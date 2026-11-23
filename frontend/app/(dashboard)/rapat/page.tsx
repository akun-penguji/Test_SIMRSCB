"use client";

// Dokumentasi Rapat — bukti pertemuan lintas komite/unit (PMKP, PPI, K3RS,
// SKP, Komite Medik, dst). Daftar + buat rapat baru; detail (daftar hadir,
// tindak lanjut, lampiran) ada di /rapat/[id].

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasPerm } from "@/lib/auth";
import { getRapatList, createRapat, getRapatStats, RapatRow, RapatInput, RapatStats } from "@/lib/api";

const JENIS_OPSI = ["Rutin", "Insidentil", "Rapat Tinjauan Manajemen", "Evaluasi", "Lainnya"];
const STATUS_OPSI = ["Terjadwal", "Selesai", "Dibatalkan"];
const STATUS_WARNA: Record<string, string> = {
  Terjadwal: "bg-blue-100 text-blue-700",
  Selesai: "bg-green-100 text-green-700",
  Dibatalkan: "bg-slate-100 text-slate-500",
};

export default function RapatPage() {
  const router = useRouter();
  const isEdit = hasPerm("rapat_edit");
  const [rows, setRows] = useState<RapatRow[]>([]);
  const [stats, setStats] = useState<RapatStats | null>(null);
  const [unit, setUnit] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [tambah, setTambah] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getRapatList({ unit, status, q })
      .then(r => setRows(r.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [unit, status, q]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { getRapatStats().then(r => setStats(r.data)).catch(() => {}); }, []);

  const unitList = Array.from(new Set(rows.map(r => r.unit))).sort();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">📝 Dokumentasi Rapat</h1>
        <p className="text-sm text-slate-500">Undangan, daftar hadir, notulen & tindak lanjut — bukti pertemuan tiap komite/unit untuk akreditasi.</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Kartu label="Total Rapat" nilai={stats.total_rapat} />
          <Kartu label="Tindak Lanjut Belum Selesai" nilai={stats.tindak_lanjut_belum_selesai}
            warna={stats.tindak_lanjut_belum_selesai > 0 ? "text-amber-600" : "text-green-600"} />
          <Kartu label="Unit/Komite Aktif" nilai={stats.per_unit.length} />
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari judul / unit…"
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px]" />
        <select value={unit} onChange={e => setUnit(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Semua unit</option>
          {unitList.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Semua status</option>
          {STATUS_OPSI.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {isEdit && <button onClick={() => setTambah(true)} className="px-4 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700">+ Rapat Baru</button>}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left"><tr>
            <th className="px-3 py-2">Tanggal</th>
            <th className="px-3 py-2">Judul</th>
            <th className="px-3 py-2">Unit</th>
            <th className="px-3 py-2">Jenis</th>
            <th className="px-3 py-2 text-center">Hadir</th>
            <th className="px-3 py-2 text-center">Tindak Lanjut</th>
            <th className="px-3 py-2 text-center">Lampiran</th>
            <th className="px-3 py-2">Status</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(r.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                  {r.jam_mulai && <div className="text-xs text-slate-400">{r.jam_mulai.slice(0, 5)}{r.jam_selesai ? `–${r.jam_selesai.slice(0, 5)}` : ""}</div>}
                </td>
                <td className="px-3 py-2 max-w-[280px]">
                  <Link href={`/rapat/${r.id}`} className="text-green-700 hover:underline font-medium">{r.judul}</Link>
                  {r.tempat && <div className="text-xs text-slate-400">{r.tempat}</div>}
                </td>
                <td className="px-3 py-2 text-slate-600">{r.unit}</td>
                <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded bg-slate-100">{r.jenis}</span></td>
                <td className="px-3 py-2 text-center tabular-nums">{r.jumlah_hadir}/{r.jumlah_peserta}</td>
                <td className="px-3 py-2 text-center">
                  {r.jumlah_tindak_lanjut === 0 ? <span className="text-slate-300">—</span> : (
                    <span className={`text-xs px-2 py-0.5 rounded ${r.jumlah_tl_belum > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                      {r.jumlah_tindak_lanjut - r.jumlah_tl_belum}/{r.jumlah_tindak_lanjut}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center tabular-nums text-slate-500">{r.jumlah_lampiran || "—"}</td>
                <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_WARNA[r.status] || "bg-slate-100"}`}>{r.status}</span></td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">Belum ada rapat tercatat.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {tambah && <FormRapatBaru onClose={() => setTambah(false)} onSaved={(id) => { setTambah(false); router.push(`/rapat/${id}`); }} />}
    </div>
  );
}

function Kartu({ label, nilai, warna }: { label: string; nilai: number; warna?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-2xl font-bold ${warna || "text-slate-800"}`}>{nilai}</div>
    </div>
  );
}

function FormRapatBaru({ onClose, onSaved }: { onClose: () => void; onSaved: (id: number) => void }) {
  const [f, setF] = useState<RapatInput>({ judul: "", unit: "", jenis: "Rutin", tanggal: new Date().toISOString().slice(0, 10), status: "Terjadwal" });
  const set = (k: keyof RapatInput, v: string) => setF(p => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function simpan() {
    if (!f.judul.trim() || !f.unit.trim() || !f.tanggal) { setErr("Judul, unit, dan tanggal wajib diisi."); return; }
    setBusy(true); setErr("");
    try {
      const r = await createRapat(f);
      onSaved(r.data.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan rapat.");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mt-8 mb-8" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="font-semibold">Rapat Baru</h3>
          <button onClick={onClose} className="text-slate-400 text-xl">×</button>
        </div>
        <div className="p-5 space-y-3">
          <input value={f.judul} onChange={e => set("judul", e.target.value)} placeholder="Judul rapat (wajib)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={f.unit} onChange={e => set("unit", e.target.value)} placeholder="Unit / komite penyelenggara (wajib)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={f.jenis} onChange={e => set("jenis", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              {JENIS_OPSI.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
            <input type="date" value={f.tanggal} onChange={e => set("tanggal", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="time" value={f.jam_mulai || ""} onChange={e => set("jam_mulai", e.target.value)} placeholder="Jam mulai" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <input type="time" value={f.jam_selesai || ""} onChange={e => set("jam_selesai", e.target.value)} placeholder="Jam selesai" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <input value={f.tempat || ""} onChange={e => set("tempat", e.target.value)} placeholder="Tempat" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={f.pemimpin_rapat || ""} onChange={e => set("pemimpin_rapat", e.target.value)} placeholder="Pemimpin rapat" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <input value={f.notulis || ""} onChange={e => set("notulis", e.target.value)} placeholder="Notulis" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <textarea value={f.agenda || ""} onChange={e => set("agenda", e.target.value)} rows={3} placeholder="Agenda (satu poin per baris)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-slate-100">Batal</button>
            <button onClick={simpan} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white disabled:opacity-50">{busy ? "…" : "Simpan"}</button>
          </div>
          <p className="text-xs text-slate-400">Daftar hadir, tindak lanjut, dan lampiran bisa ditambahkan setelah rapat disimpan.</p>
        </div>
      </div>
    </div>
  );
}
