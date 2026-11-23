"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  listSirsRl13, createSirsRl13, updateSirsRl13, deleteSirsRl13, cetakSirsRl13,
  Rl13Tt,
} from "@/lib/api";

const KELAS_TT_OPTS = [
  "VVIP/Super VIP",
  "VIP",
  "Kelas I",
  "Kelas II",
  "Kelas III",
  "ICU dengan ventilator",
  "ICU tanpa ventilator",
  "HCU",
  "ICCU/ICVCU dengan ventilator",
  "ICCU/ICVCU tanpa ventilator",
  "RICU dengan ventilator",
  "RICU tanpa ventilator",
  "NICU dengan ventilator",
  "NICU tanpa ventilator",
  "PICU dengan ventilator",
  "PICU tanpa ventilator",
  "Isolasi",
  "Perinatologi",
  "VK (bu Melahirkan) Non Covid",
  "Intermediate Ward (IGD)",
] as const;

const EMPTY: Rl13Tt = {
  kelas_tt: "", ruangan: "", jml_tersedia: 0, jml_terpakai: 0, catatan: "",
};

export default function Rl13Page() {
  const [rows, setRows] = useState<Rl13Tt[]>([]);
  const [form, setForm] = useState<Rl13Tt>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    listSirsRl13().then(r => setRows(r.data))
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const reset = () => { setForm(EMPTY); setEditId(null); };
  const loadEdit = (r: Rl13Tt) => {
    setForm({ ...EMPTY, ...r });
    setEditId(r.id || null);
  };

  const handleSave = async () => {
    if (!form.kelas_tt.trim() || !form.ruangan.trim()) {
      setErrMsg("Kelas TT & ruangan wajib"); return;
    }
    if (form.jml_terpakai > form.jml_tersedia) {
      setErrMsg("Terpakai tidak boleh melebihi tersedia"); return;
    }
    setSaving(true); setErrMsg("");
    try {
      if (editId) await updateSirsRl13(editId, form);
      else await createSirsRl13(form);
      reset();
      reload();
      setOkMsg("Tersimpan");
      setTimeout(() => setOkMsg(""), 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal simpan";
      setErrMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus baris TT ini?")) return;
    try {
      await deleteSirsRl13(id);
      reload();
    } catch { setErrMsg("Gagal hapus"); }
  };

  const handleCetak = async () => {
    try { await cetakSirsRl13(); }
    catch { setErrMsg("Gagal membuka pratinjau cetak"); }
  };

  const totals = useMemo(() => {
    const ts = rows.reduce((a, r) => a + r.jml_tersedia, 0);
    const tp = rows.reduce((a, r) => a + r.jml_terpakai, 0);
    return { ts, tp, kosong: ts - tp, bor: ts > 0 ? (tp / ts) * 100 : 0 };
  }, [rows]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <Link href="/laporan/sirs" className="text-xs text-slate-500 hover:text-green-700">
          ← Laporan SIRS 6.3
        </Link>
        <div className="flex items-start gap-3 mt-2">
          <span className="font-mono text-lg font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded">
            RL 1.3
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800 leading-tight">Ketersediaan dan Keterpakaian Tempat Tidur</h1>
            <p className="text-xs text-slate-500 mt-1">
              RL 1 · RS Online · Update <span className="font-medium">minimal 2x sehari</span>
            </p>
          </div>
          <button onClick={handleCetak}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Cetak
          </button>
        </div>
      </div>

      {errMsg && <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm">{errMsg}</div>}
      {okMsg  && <div className="mb-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-green-800 text-sm">{okMsg}</div>}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Total Tersedia" value={String(totals.ts)} color="text-blue-700" />
        <Stat label="Terpakai" value={String(totals.tp)} color="text-amber-700" />
        <Stat label="Kosong" value={String(totals.kosong)} color="text-emerald-700" />
        <Stat label="BOR Saat Ini" value={`${totals.bor.toFixed(1)}%`} color="text-indigo-700" />
      </div>

      {/* Form add/edit */}
      <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-slate-700 mb-3">
          {editId ? `✏️ Edit baris #${editId}` : "➕ Tambah baris baru"}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          <Field label="Kelas Tempat Tidur">
            <select value={form.kelas_tt}
              onChange={(e) => setForm(f => ({ ...f, kelas_tt: e.target.value }))}
              className="inp">
              <option value="">— pilih kelas —</option>
              {KELAS_TT_OPTS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
          <Field label="Ruangan">
            <input value={form.ruangan}
              onChange={(e) => setForm(f => ({ ...f, ruangan: e.target.value }))}
              placeholder="mis. Ruang Anggrek" className="inp" />
          </Field>
          <Field label="Jumlah TT Tersedia">
            <input type="number" min={0} value={form.jml_tersedia}
              onChange={(e) => setForm(f => ({ ...f, jml_tersedia: parseInt(e.target.value || "0", 10) }))}
              className="inp" />
          </Field>
          <Field label="Jumlah TT Terpakai">
            <input type="number" min={0} max={form.jml_tersedia} value={form.jml_terpakai}
              onChange={(e) => setForm(f => ({ ...f, jml_terpakai: parseInt(e.target.value || "0", 10) }))}
              className="inp" />
            {form.jml_terpakai > form.jml_tersedia && (
              <p className="text-[11px] text-red-600 mt-0.5">⚠️ Tidak boleh melebihi tersedia</p>
            )}
          </Field>
          <Field label="Catatan (opsional)" span>
            <input value={form.catatan ?? ""}
              onChange={(e) => setForm(f => ({ ...f, catatan: e.target.value }))}
              placeholder="mis. 1 TT renovasi, 2 isolasi covid" className="inp" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          {editId && (
            <button onClick={reset}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm text-slate-700">
              Batal
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 text-white text-sm font-medium">
            {saving ? "Menyimpan..." : editId ? "Update" : "Tambah"}
          </button>
        </div>
      </div>

      {/* Table existing rows */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-slate-400 text-sm">Memuat...</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm italic">Belum ada data tempat tidur.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="text-left p-3 border-b">Kelas TT</th>
                  <th className="text-left p-3 border-b">Ruangan</th>
                  <th className="text-right p-3 border-b">Tersedia</th>
                  <th className="text-right p-3 border-b">Terpakai</th>
                  <th className="text-right p-3 border-b">Kosong</th>
                  <th className="text-right p-3 border-b">BOR%</th>
                  <th className="text-left p-3 border-b">Catatan</th>
                  <th className="text-left p-3 border-b">Update</th>
                  <th className="p-3 border-b"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const kosong = r.jml_tersedia - r.jml_terpakai;
                  const bor = r.jml_tersedia > 0 ? (r.jml_terpakai / r.jml_tersedia) * 100 : 0;
                  const borCls = bor >= 80 ? "text-red-700 font-bold"
                              : bor >= 60 ? "text-amber-700 font-medium"
                              : "text-emerald-700";
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-3 border-b text-slate-900 font-medium">{r.kelas_tt}</td>
                      <td className="p-3 border-b text-slate-700">{r.ruangan}</td>
                      <td className="p-3 border-b text-right tabular-nums">{r.jml_tersedia}</td>
                      <td className="p-3 border-b text-right tabular-nums">{r.jml_terpakai}</td>
                      <td className="p-3 border-b text-right tabular-nums text-slate-500">{kosong}</td>
                      <td className={`p-3 border-b text-right tabular-nums ${borCls}`}>{bor.toFixed(1)}%</td>
                      <td className="p-3 border-b text-slate-600 text-xs">{r.catatan || "-"}</td>
                      <td className="p-3 border-b text-[11px] text-slate-500">
                        {r.updated_at}<br/>
                        <span className="font-mono">{r.updated_by || "-"}</span>
                      </td>
                      <td className="p-3 border-b text-right whitespace-nowrap">
                        <button onClick={() => loadEdit(r)}
                          className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 mr-1">Edit</button>
                        <button onClick={() => r.id && handleDelete(r.id)}
                          className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50">Hapus</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold">
                <tr>
                  <td className="p-3 text-right" colSpan={2}>TOTAL</td>
                  <td className="p-3 text-right tabular-nums">{totals.ts}</td>
                  <td className="p-3 text-right tabular-nums">{totals.tp}</td>
                  <td className="p-3 text-right tabular-nums">{totals.kosong}</td>
                  <td className="p-3 text-right tabular-nums">{totals.bor.toFixed(1)}%</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-[11px] text-slate-400 italic">
        BOR (Bed Occupancy Rate) = TT Terpakai / TT Tersedia. Indikator: hijau &lt;60%, kuning 60-80%, merah ≥80%.
      </p>

      <style jsx>{`
        :global(.inp) {
          width: 100%;
          border: 1px solid rgb(226 232 240);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: rgb(15 23 42);
          background: white;
        }
        :global(.inp:focus) { outline: none; border-color: rgb(16 185 129); box-shadow: 0 0 0 1px rgb(16 185 129); }
      `}</style>
    </div>
  );
}

function Field({ label, children, span = false }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? "md:col-span-2" : ""}>
      <label className="text-xs text-slate-600 font-semibold block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
