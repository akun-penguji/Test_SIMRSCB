"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBelanja, saveBelanja, delBelanja, Belanja } from "@/lib/api";

const JENIS = ["Barang", "Modal", "Jasa"] as const;
type Jenis = (typeof JENIS)[number];

const rp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
const pct = (real: number, pagu: number) => (pagu > 0 ? (real / pagu) * 100 : 0);

const badgeCls: Record<string, string> = {
  Barang: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  Modal: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
  Jasa: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
};

function barColor(p: number) {
  if (p >= 90) return "bg-green-600";
  if (p >= 60) return "bg-green-500";
  if (p >= 30) return "bg-amber-500";
  return "bg-slate-400";
}

type FormState = { id?: number; jenis: Jenis; uraian: string; pagu: string; realisasi: string };
const emptyForm: FormState = { jenis: "Barang", uraian: "", pagu: "", realisasi: "" };

export default function BelanjaBludPage() {
  const [rows, setRows] = useState<Belanja[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const r = await getBelanja();
      setRows(r.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const totalPagu = rows.reduce((s, b) => s + (b.pagu || 0), 0);
  const totalReal = rows.reduce((s, b) => s + (b.realisasi || 0), 0);
  const totalPct = pct(totalReal, totalPagu);

  const perJenis = JENIS.map((j) => {
    const items = rows.filter((b) => b.jenis === j);
    return {
      jenis: j,
      pagu: items.reduce((s, b) => s + (b.pagu || 0), 0),
      realisasi: items.reduce((s, b) => s + (b.realisasi || 0), 0),
    };
  });

  function openTambah() {
    setForm(emptyForm);
    setShowForm(true);
    setMsg(null);
  }

  function openEdit(b: Belanja) {
    setForm({ id: b.id, jenis: (b.jenis as Jenis) || "Barang", uraian: b.uraian, pagu: String(b.pagu ?? ""), realisasi: String(b.realisasi ?? "") });
    setShowForm(true);
    setMsg(null);
  }

  function isForbidden(err: unknown): boolean {
    const e = err as { response?: { status?: number } };
    return e?.response?.status === 403;
  }

  async function simpan() {
    if (!form.uraian.trim()) {
      setMsg({ ok: false, text: "Uraian belanja wajib diisi." });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await saveBelanja({
        ...(form.id ? { id: form.id } : {}),
        jenis: form.jenis,
        uraian: form.uraian.trim(),
        pagu: Number(form.pagu) || 0,
        realisasi: Number(form.realisasi) || 0,
      });
      setShowForm(false);
      setForm(emptyForm);
      await reload();
    } catch (err) {
      setMsg({ ok: false, text: isForbidden(err) ? "Hanya admin yang bisa mengubah data." : "Gagal menyimpan data." });
    } finally {
      setSaving(false);
    }
  }

  async function hapus(b: Belanja) {
    if (!confirm(`Hapus belanja "${b.uraian}"?`)) return;
    setMsg(null);
    try {
      await delBelanja(b.id);
      await reload();
    } catch (err) {
      setMsg({ ok: false, text: isForbidden(err) ? "Hanya admin yang bisa mengubah data." : "Gagal menghapus data." });
    }
  }

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/direktur" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Belanja BLUD</h1>
          <p className="text-sm text-slate-500">Realisasi anggaran belanja Barang, Modal, dan Jasa (input manual).</p>
        </div>
        <button
          onClick={openTambah}
          className="px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-xl shadow-sm transition shrink-0"
        >
          + Tambah Belanja
        </button>
      </div>

      {/* Kartu ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Pagu</p>
          <p className="text-2xl font-bold text-slate-800 tabular-nums mt-1">{rp(totalPagu)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Realisasi</p>
          <p className="text-2xl font-bold text-green-700 tabular-nums mt-1">{rp(totalReal)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Persentase Realisasi</p>
          <p className="text-2xl font-bold text-slate-800 tabular-nums mt-1">{totalPct.toFixed(1)}%</p>
          <div className="mt-2 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${barColor(totalPct)} rounded-full transition-all`} style={{ width: `${Math.min(totalPct, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Rekap per jenis */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {perJenis.map((r) => {
          const p = pct(r.realisasi, r.pagu);
          return (
            <div key={r.jenis} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeCls[r.jenis]}`}>{r.jenis}</span>
                <span className="text-xs font-medium text-slate-500 tabular-nums">{p.toFixed(0)}%</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Pagu</span>
                  <span className="font-semibold text-slate-700 tabular-nums">{rp(r.pagu)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Realisasi</span>
                  <span className="font-semibold text-green-700 tabular-nums">{rp(r.realisasi)}</span>
                </div>
              </div>
              <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${barColor(p)} rounded-full`} style={{ width: `${Math.min(p, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {msg && (
        <div className={`text-sm px-4 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-green-200 rounded-2xl p-5 shadow-sm ring-1 ring-green-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">{form.id ? "Edit Belanja" : "Tambah Belanja"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Jenis</label>
              <select
                value={form.jenis}
                onChange={(e) => setForm({ ...form, jenis: e.target.value as Jenis })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                {JENIS.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Uraian</label>
              <input
                type="text"
                value={form.uraian}
                onChange={(e) => setForm({ ...form, uraian: e.target.value })}
                placeholder="mis. Belanja alat tulis kantor"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Pagu (Rp)</label>
              <input
                type="number"
                value={form.pagu}
                onChange={(e) => setForm({ ...form, pagu: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Realisasi (Rp)</label>
              <input
                type="number"
                value={form.realisasi}
                onChange={(e) => setForm({ ...form, realisasi: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 tabular-nums"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => { setShowForm(false); setForm(emptyForm); }}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Batal
            </button>
            <button
              onClick={simpan}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-50 rounded-xl shadow-sm transition"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-medium">Jenis</th>
                <th className="px-4 py-3 font-medium">Uraian</th>
                <th className="px-4 py-3 font-medium text-right">Pagu</th>
                <th className="px-4 py-3 font-medium text-right">Realisasi</th>
                <th className="px-4 py-3 font-medium w-40">%</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Memuat data...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Belum ada data belanja. Klik “+ Tambah Belanja”.</td></tr>
              ) : (
                rows.map((b) => {
                  const p = pct(b.realisasi, b.pagu);
                  return (
                    <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeCls[b.jenis] || "bg-slate-100 text-slate-600"}`}>{b.jenis}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{b.uraian}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{rp(b.pagu)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-700 font-medium">{rp(b.realisasi)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[48px]">
                            <div className={`h-full ${barColor(p)} rounded-full`} style={{ width: `${Math.min(p, 100)}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 tabular-nums w-10 text-right">{p.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(b)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => hapus(b)}
                            className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
