"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPengadaan, savePengadaan, delPengadaan, Pengadaan } from "@/lib/api";

const STATUS_OPT = ["Proses", "Kontrak", "Selesai", "Batal"];

const rp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));

type FormState = {
  id?: number;
  paket: string;
  vendor: string;
  nilai_kontrak: number;
  realisasi: number;
  tgl_mulai: string;
  tgl_akhir: string;
  status: string;
  catatan: string;
};

const EMPTY: FormState = {
  paket: "", vendor: "", nilai_kontrak: 0, realisasi: 0,
  tgl_mulai: "", tgl_akhir: "", status: "Proses", catatan: "",
};

export default function PengadaanPage() {
  const [list, setList] = useState<Pengadaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const r = await getPengadaan();
      setList(r.data || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  // ── Ringkasan ──────────────────────────────────────────────
  const jumlahPaket = list.length;
  const totalNilai = list.reduce((s, p) => s + (p.nilai_kontrak || 0), 0);
  const totalReal = list.reduce((s, p) => s + (p.realisasi || 0), 0);
  const hampirHabis = list.filter(
    p => p.sisa_hari != null && p.sisa_hari >= 0 && p.sisa_hari <= 30 && p.status !== "Selesai"
  ).length;

  function bukaTambah() {
    setMsg(null);
    setForm({ ...EMPTY });
  }

  function bukaEdit(p: Pengadaan) {
    setMsg(null);
    setForm({
      id: p.id,
      paket: p.paket || "",
      vendor: p.vendor || "",
      nilai_kontrak: p.nilai_kontrak || 0,
      realisasi: p.realisasi || 0,
      tgl_mulai: p.tgl_mulai || "",
      tgl_akhir: p.tgl_akhir || "",
      status: p.status || "Proses",
      catatan: p.catatan || "",
    });
  }

  const setF = (k: keyof FormState, v: string | number) =>
    setForm(prev => (prev ? { ...prev, [k]: v } : prev));

  async function simpan() {
    if (!form) return;
    setSaving(true); setMsg(null);
    try {
      await savePengadaan({
        id: form.id,
        paket: form.paket,
        vendor: form.vendor,
        nilai_kontrak: form.nilai_kontrak,
        realisasi: form.realisasi,
        tgl_mulai: form.tgl_mulai || null,
        tgl_akhir: form.tgl_akhir || null,
        status: form.status,
        catatan: form.catatan,
      });
      setForm(null);
      await reload();
      setMsg({ ok: true, text: "Paket tersimpan." });
    } catch (e: any) {
      const code = e?.status ?? e?.response?.status;
      setMsg({
        ok: false,
        text: code === 403 ? "Hanya admin yang bisa mengubah data." : "Gagal menyimpan data.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function hapus(p: Pengadaan) {
    if (!confirm(`Hapus paket "${p.paket}"?`)) return;
    setMsg(null);
    try {
      await delPengadaan(p.id);
      await reload();
      setMsg({ ok: true, text: "Paket dihapus." });
    } catch (e: any) {
      const code = e?.status ?? e?.response?.status;
      setMsg({
        ok: false,
        text: code === 403 ? "Hanya admin yang bisa mengubah data." : "Gagal menghapus data.",
      });
    }
  }

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/direktur" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Pengadaan / Kontrak (PPK)</h1>
          <p className="text-sm text-slate-500">Input manual paket pengadaan &amp; kontrak vendor oleh Pejabat Pembuat Komitmen.</p>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Jumlah Paket" value={String(jumlahPaket)} />
        <Card label="Total Nilai Kontrak" value={rp(totalNilai)} />
        <Card label="Total Realisasi" value={rp(totalReal)} />
        <Card
          label="Kontrak Hampir Habis"
          value={String(hampirHabis)}
          hint="Sisa ≤ 30 hari, belum selesai"
          danger={hampirHabis > 0}
        />
      </div>

      {/* Tombol tambah */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">{loading ? "Memuat..." : `${list.length} paket`}</div>
        <button onClick={bukaTambah}
          className="px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-xl shadow-sm transition">
          + Tambah Paket
        </button>
      </div>

      {msg && (
        <div className={`text-sm px-4 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>
      )}

      {/* Form (modal) */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg w-full max-w-2xl p-6 mt-10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">{form.id ? "Edit Paket" : "Tambah Paket"}</h2>
              <button onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Paket" full>
                <input type="text" value={form.paket} onChange={e => setF("paket", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Vendor" full>
                <input type="text" value={form.vendor} onChange={e => setF("vendor", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Nilai Kontrak (Rp)">
                <input type="number" value={form.nilai_kontrak} onChange={e => setF("nilai_kontrak", Number(e.target.value) || 0)} className={inputCls + " tabular-nums"} />
              </Field>
              <Field label="Realisasi (Rp)">
                <input type="number" value={form.realisasi} onChange={e => setF("realisasi", Number(e.target.value) || 0)} className={inputCls + " tabular-nums"} />
              </Field>
              <Field label="Tgl Mulai">
                <input type="date" value={form.tgl_mulai} onChange={e => setF("tgl_mulai", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Tgl Akhir">
                <input type="date" value={form.tgl_akhir} onChange={e => setF("tgl_akhir", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={e => setF("status", e.target.value)} className={inputCls}>
                  {STATUS_OPT.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Catatan" full>
                <input type="text" value={form.catatan} onChange={e => setF("catatan", e.target.value)} className={inputCls} />
              </Field>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setForm(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition">
                Batal
              </button>
              <button onClick={simpan} disabled={saving || !form.paket.trim()}
                className="px-5 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-50 rounded-xl shadow-sm transition">
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3">Paket</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3 text-right">Nilai Kontrak</th>
                <th className="px-4 py-3 text-right">Realisasi</th>
                <th className="px-4 py-3 text-right">%</th>
                <th className="px-4 py-3">Periode</th>
                <th className="px-4 py-3 text-center">Sisa Hari</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {!loading && list.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">Belum ada paket pengadaan.</td></tr>
              )}
              {list.map(p => {
                const pct = p.nilai_kontrak > 0 ? (p.realisasi / p.nilai_kontrak) * 100 : 0;
                return (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {p.paket}
                      {p.catatan && <div className="text-[11px] text-slate-400 font-normal">{p.catatan}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.vendor || "-"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{rp(p.nilai_kontrak)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{rp(p.realisasi)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{pct.toFixed(0)}%</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {(p.tgl_mulai || "-")}<span className="text-slate-300"> – </span>{(p.tgl_akhir || "-")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <SisaBadge sisa={p.sisa_hari} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => bukaEdit(p)}
                          className="px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50 rounded-lg transition">
                          Edit
                        </button>
                        <button onClick={() => hapus(p)}
                          className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition">
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500";

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Card({ label, value, hint, danger }: { label: string; value: string; hint?: string; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${danger ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
      <div className={`text-xs font-medium ${danger ? "text-red-600" : "text-slate-500"}`}>{label}</div>
      <div className={`text-lg font-bold mt-1 tabular-nums ${danger ? "text-red-700" : "text-slate-800"}`}>{value}</div>
      {hint && <div className={`text-[11px] mt-0.5 ${danger ? "text-red-500" : "text-slate-400"}`}>{hint}</div>}
    </div>
  );
}

function SisaBadge({ sisa }: { sisa: number | null }) {
  if (sisa == null) {
    return <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-500">-</span>;
  }
  const cls = sisa <= 30 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700";
  return <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full tabular-nums ${cls}`}>{sisa} hari</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Proses: "bg-amber-100 text-amber-700",
    Kontrak: "bg-blue-100 text-blue-700",
    Selesai: "bg-green-100 text-green-700",
    Batal: "bg-slate-200 text-slate-600",
  };
  const cls = map[status] || "bg-slate-100 text-slate-600";
  return <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${cls}`}>{status || "-"}</span>;
}
