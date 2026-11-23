"use client";

// Inventaris / Aset RS (migrasi dari SIMGPS). Tabel + filter + ringkasan + CRUD.

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import InventarisNav from "@/app/(dashboard)/inventaris/InventarisNav";
import {
  getInventaris, getInventarisSummary, getInventarisFilters, saveInventaris, delInventaris,
  Inventaris, InventarisSummary, InventarisFilters,
} from "@/lib/api";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const fmtRp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));

const KATEGORI = ["Medis", "Non-Medis/IT", "Tools", "Sparepart", "Lainnya"];
const KONDISI = ["Baik", "Rusak Ringan", "Rusak Berat"];
const STATUS = ["Laik", "Tidak Laik"];

const EMPTY: Partial<Inventaris> = {
  nama_alat: "", barcode: "", merk: "", model: "", ruangan: "", gedung: "RSUD Cabangbungin",
  kategori: "Medis", status_laik: "Laik", kondisi: "Baik", no_seri: "", tahun: "", nilai: 0,
  hasil_kalibrasi: "", catatan: "",
};

function InventarisInner() {
  const [rows, setRows] = useState<Inventaris[]>([]);
  const [sum, setSum] = useState<InventarisSummary | null>(null);
  const [filters, setFilters] = useState<InventarisFilters | null>(null);
  const [q, setQ] = useState("");
  const [fRuangan, setFRuangan] = useState("");
  const [fMerk, setFMerk] = useState("");
  const [fKategori, setFKategori] = useState("");
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Inventaris> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [view, setView] = useState<"kartu" | "tabel">("kartu");
  const sp = useSearchParams();
  useEffect(() => { const k = sp.get("kategori"); if (k) setFKategori(k); }, [sp]);

  const load = useCallback(() => {
    setLoading(true);
    getInventaris({ q, ruangan: fRuangan, merk: fMerk, kategori: fKategori })
      .then(r => setRows(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [q, fRuangan, fMerk, fKategori]);

  useEffect(() => {
    getInventarisSummary().then(r => setSum(r.data)).catch(() => {});
    getInventarisFilters().then(r => setFilters(r.data)).catch(() => {});
  }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function simpan() {
    if (!edit?.nama_alat?.trim()) { setMsg({ ok: false, t: "Nama alat wajib diisi" }); return; }
    setSaving(true); setMsg(null);
    try {
      await saveInventaris(edit);
      setMsg({ ok: true, t: "Tersimpan." });
      setEdit(null); load();
      getInventarisSummary().then(r => setSum(r.data)).catch(() => {});
    } catch {
      setMsg({ ok: false, t: "Gagal menyimpan (hanya admin yang bisa mengubah)." });
    } finally { setSaving(false); }
  }
  async function hapus(r: Inventaris) {
    if (!confirm(`Hapus aset "${r.nama_alat}"?`)) return;
    try { await delInventaris(r.id); load(); getInventarisSummary().then(x => setSum(x.data)); }
    catch { setMsg({ ok: false, t: "Gagal hapus (hanya admin)." }); }
  }
  function exportCsv() {
    const head = ["Nama Alat", "Barcode", "Merk", "Model", "Ruangan", "Gedung", "Kategori", "Status", "Kondisi", "No Seri"];
    const lines = [head.join(";")].concat(rows.map(r =>
      [r.nama_alat, r.barcode, r.merk, r.model, r.ruangan, r.gedung, r.kategori, r.status_laik, r.kondisi, r.no_seri]
        .map(x => `"${(x ?? "").toString().replace(/"/g, '""')}"`).join(";")));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `inventaris_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  return (
    <div className="p-6 space-y-5">
      <InventarisNav />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Daftar Aset</h1>
          <p className="text-sm text-slate-500">Data alat & aset RS (migrasi SIMGPS).</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCsv} className="px-3 py-2 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg">⬇ Export CSV</button>
          <button onClick={() => { setEdit({ ...EMPTY }); setMsg(null); }} className="px-3 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg">+ Tambah Aset</button>
        </div>
      </div>

      {/* Ringkasan */}
      {sum && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label="Total Aset" value={fmt(sum.total)} />
          <Card label="Laik" value={fmt(sum.laik)} color="text-emerald-700" />
          <Card label="Tidak Laik" value={fmt(sum.tidak_laik)} color="text-rose-700" danger={sum.tidak_laik > 0} />
          <Card label="Nilai Aset" value={sum.nilai_total > 0 ? fmtRp(sum.nilai_total) : "—"} />
        </div>
      )}

      {/* Donut kelaikan + breakdown kategori */}
      {sum && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-5">
            <Donut laik={sum.laik} tidak={sum.tidak_laik} lain={Math.max(0, sum.total - sum.laik - sum.tidak_laik)} />
            <div className="space-y-1.5 text-sm">
              <LegendRow color="#059669" label="Laik" v={sum.laik} total={sum.total} />
              <LegendRow color="#e11d48" label="Tidak Laik" v={sum.tidak_laik} total={sum.total} />
              <LegendRow color="#cbd5e1" label="Belum dinilai" v={Math.max(0, sum.total - sum.laik - sum.tidak_laik)} total={sum.total} />
            </div>
          </div>
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3">Aset per Kategori</p>
            <div className="space-y-2">
              {sum.per_kategori.slice(0, 6).map(k => (
                <div key={k.k} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-slate-600 truncate">{k.k}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-green-600 h-full rounded-full" style={{ width: `${sum.total ? (k.v / sum.total) * 100 : 0}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums text-slate-500">{fmt(k.v)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-slate-500 block mb-1">Cari (nama/barcode/merk/seri)</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ketik untuk mencari…"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <Sel label="Ruangan" value={fRuangan} onChange={setFRuangan} opts={filters?.ruangan ?? []} />
        <Sel label="Merk" value={fMerk} onChange={setFMerk} opts={filters?.merk ?? []} />
        <Sel label="Kategori" value={fKategori} onChange={setFKategori} opts={filters?.kategori ?? []} />
        {(q || fRuangan || fMerk || fKategori) && (
          <button onClick={() => { setQ(""); setFRuangan(""); setFMerk(""); setFKategori(""); }}
            className="px-3 py-2 text-sm text-slate-500 border border-slate-300 hover:bg-slate-50 rounded-lg">Reset</button>
        )}
      </div>

      {msg && <div className={`text-sm px-4 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.t}</div>}

      {/* Toggle tampilan */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rows.length} aset</p>
        <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-sm">
          <button onClick={() => setView("kartu")} className={`px-3 py-1.5 ${view === "kartu" ? "bg-green-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}>▦ Kartu</button>
          <button onClick={() => setView("tabel")} className={`px-3 py-1.5 border-l border-slate-300 ${view === "tabel" ? "bg-green-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}>≣ Tabel</button>
        </div>
      </div>

      {/* Kartu (gaya SIMGPS) */}
      {view === "kartu" && (
        loading ? <div className="text-center text-slate-400 py-12">Memuat…</div>
        : rows.length === 0 ? <div className="text-center text-slate-400 py-12">Tidak ada data.</div>
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {rows.map(r => <AsetCard key={r.id} r={r} onEdit={() => { setEdit({ ...r }); setMsg(null); }} onDel={() => hapus(r)} />)}
          </div>
      )}

      {/* Tabel */}
      {view === "tabel" && (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5 text-left">Foto</th>
                <th className="px-3 py-2.5 text-left">Nama Alat</th>
                <th className="px-3 py-2.5 text-left">Barcode</th>
                <th className="px-3 py-2.5 text-left">Merk / Model</th>
                <th className="px-3 py-2.5 text-left">Ruangan</th>
                <th className="px-3 py-2.5 text-left">Kategori</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400">Tidak ada data.</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    {r.foto ? (
                      <a href={r.foto} target="_blank" rel="noreferrer">
                        <img src={r.foto} alt={r.nama_alat} className="w-11 h-11 rounded-lg object-cover border border-slate-200" loading="lazy" />
                      </a>
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 text-xs">—</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/inventaris/${r.id}`} className="font-semibold text-green-700 hover:underline">{r.nama_alat}</Link>
                    {r.no_seri && <div className="text-[11px] text-slate-400">SN: {r.no_seri}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.barcode || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{r.merk}{r.model && r.model !== "-" ? ` · ${r.model}` : ""}</td>
                  <td className="px-3 py-2 text-slate-600">{r.ruangan || "-"}</td>
                  <td className="px-3 py-2"><span className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5">{r.kategori}</span></td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <span className={`text-xs font-semibold rounded px-2 py-0.5 ${r.status_laik === "Laik" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{r.status_laik || "-"}</span>
                    {r.wajib_kalibrasi === 1 && <span className="ml-1 text-[10px] font-semibold rounded px-1.5 py-0.5 bg-amber-100 text-amber-700">Wajib Kalibrasi</span>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Link href={`/inventaris/${r.id}`} className="text-xs text-slate-600 hover:underline mr-3">Riwayat</Link>
                    <button onClick={() => { setEdit({ ...r }); setMsg(null); }} className="text-xs text-green-700 hover:underline mr-3">Edit</button>
                    <button onClick={() => hapus(r)} className="text-xs text-rose-600 hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100">{rows.length} aset ditampilkan</div>
      </div>
      )}

      {/* Modal Add/Edit */}
      {edit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">{edit.id ? "Edit Aset" : "Tambah Aset"}</h2>
            {edit.foto && (
              <img src={edit.foto} alt={edit.nama_alat} className="w-40 h-40 object-cover rounded-xl border border-slate-200 mb-4" />
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Fld label="Nama Alat *" v={edit.nama_alat} on={v => setEdit({ ...edit, nama_alat: v })} />
              <Fld label="Barcode" v={edit.barcode} on={v => setEdit({ ...edit, barcode: v })} />
              <Fld label="Merk" v={edit.merk} on={v => setEdit({ ...edit, merk: v })} />
              <Fld label="Model" v={edit.model} on={v => setEdit({ ...edit, model: v })} />
              <Fld label="Nomor Seri" v={edit.no_seri} on={v => setEdit({ ...edit, no_seri: v })} />
              <Fld label="Ruangan" v={edit.ruangan} on={v => setEdit({ ...edit, ruangan: v })} />
              <Fld label="Gedung" v={edit.gedung} on={v => setEdit({ ...edit, gedung: v })} />
              <SelF label="Kategori" v={edit.kategori} on={v => setEdit({ ...edit, kategori: v })} opts={KATEGORI} />
              <SelF label="Kondisi" v={edit.kondisi} on={v => setEdit({ ...edit, kondisi: v })} opts={KONDISI} />
              <SelF label="Status Laik" v={edit.status_laik} on={v => setEdit({ ...edit, status_laik: v })} opts={STATUS} />
              <Fld label="Vendor" v={edit.vendor} on={v => setEdit({ ...edit, vendor: v })} />
              <Fld label="Tahun" v={edit.tahun} on={v => setEdit({ ...edit, tahun: v })} />
              <Fld label="Nilai (Rp)" v={String(edit.nilai ?? 0)} on={v => setEdit({ ...edit, nilai: Number(v) || 0 })} type="number" />
              <label className="flex items-center gap-2 text-sm text-slate-600 mt-6">
                <input type="checkbox" checked={edit.wajib_kalibrasi === 1}
                  onChange={e => setEdit({ ...edit, wajib_kalibrasi: e.target.checked ? 1 : 0 })} />
                Wajib Kalibrasi
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setEdit(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg">Batal</button>
              <button onClick={simpan} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-50 rounded-lg">{saving ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InventarisPage() {
  return <Suspense fallback={<div className="p-6 text-slate-400">Memuat…</div>}><InventarisInner /></Suspense>;
}

function AsetCard({ r, onEdit, onDel }: { r: Inventaris; onEdit: () => void; onDel: () => void }) {
  const kond = r.kondisi || "";
  const kondCls = kond === "Baik" ? "bg-emerald-400 text-emerald-950"
    : kond.startsWith("Rusak Ringan") ? "bg-amber-400 text-amber-950"
    : kond ? "bg-rose-400 text-rose-950" : "bg-slate-200 text-slate-500";
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition">
      <Link href={`/inventaris/${r.id}`} className="block relative bg-slate-100">
        {r.foto
          ? <img src={r.foto} alt={r.nama_alat} className="object-cover h-44 w-full" loading="lazy" />
          : <div className="h-44 w-full grid place-items-center text-slate-300 text-sm">Tanpa Foto</div>}
        {r.wajib_kalibrasi === 1 && <span className="absolute top-2 right-2 text-[10px] font-semibold rounded px-1.5 py-0.5 bg-amber-500 text-white shadow">Wajib Kalibrasi</span>}
      </Link>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <Link href={`/inventaris/${r.id}`} className="font-semibold text-slate-800 hover:text-green-700 leading-snug line-clamp-2" title={r.nama_alat}>{r.nama_alat}</Link>
        <div className="flex gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold rounded px-2 py-0.5 ${kondCls}`}>{kond || "—"}</span>
          <span className={`text-[10px] font-semibold rounded px-2 py-0.5 ${r.status_laik === "Laik" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{r.status_laik || "-"}</span>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs mt-0.5">
          <span className="text-slate-400">Barcode</span><span className="text-right font-mono text-slate-700 truncate" title={r.barcode}>{r.barcode || "-"}</span>
          <span className="text-slate-400">Merk</span><span className="text-right text-slate-700 truncate" title={r.merk}>{r.merk || "-"}</span>
          <span className="text-slate-400">Model</span><span className="text-right text-slate-700 truncate" title={r.model}>{r.model && r.model !== "-" ? r.model : "-"}</span>
          <span className="text-slate-400">Ruangan</span><span className="text-right text-slate-700 truncate" title={r.ruangan}>{r.ruangan || "-"}</span>
          <span className="text-slate-400">Kategori</span><span className="text-right text-slate-700 truncate">{r.kategori || "-"}</span>
          {r.no_seri && <><span className="text-slate-400">No. Seri</span><span className="text-right font-mono text-slate-700 truncate" title={r.no_seri}>{r.no_seri}</span></>}
        </div>
        <div className="flex items-center gap-3 mt-auto pt-2 border-t border-slate-100 text-xs">
          <Link href={`/inventaris/${r.id}`} className="text-green-700 hover:underline font-medium">Detail / Riwayat</Link>
          <button onClick={onEdit} className="text-slate-500 hover:underline ml-auto">Edit</button>
          <button onClick={onDel} className="text-rose-500 hover:underline">Hapus</button>
        </div>
      </div>
    </div>
  );
}
function Card({ label, value, color = "text-slate-800", danger }: { label: string; value: string; color?: string; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${danger ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}>
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</p>
      <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
    </div>
  );
}
function Donut({ laik, tidak, lain }: { laik: number; tidak: number; lain: number }) {
  const total = Math.max(1, laik + tidak + lain);
  const R = 34, C = 2 * Math.PI * R;
  const seg = (v: number) => (v / total) * C;
  let off = 0;
  const arcs = [
    { v: laik, c: "#059669" }, { v: tidak, c: "#e11d48" }, { v: lain, c: "#cbd5e1" },
  ];
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
      <circle cx="48" cy="48" r={R} fill="none" stroke="#f1f5f9" strokeWidth="14" />
      {arcs.map((a, i) => {
        const dash = seg(a.v);
        const el = (
          <circle key={i} cx="48" cy="48" r={R} fill="none" stroke={a.c} strokeWidth="14"
            strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-off} transform="rotate(-90 48 48)" />
        );
        off += dash; return el;
      })}
      <text x="48" y="45" textAnchor="middle" className="fill-slate-800" style={{ fontSize: 18, fontWeight: 800 }}>{laik + tidak + lain}</text>
      <text x="48" y="60" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 9 }}>ASET</text>
    </svg>
  );
}
function LegendRow({ color, label, v, total }: { color: string; label: string; v: number; total: number }) {
  const pct = total ? Math.round((v / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      <span className="text-slate-600 w-24">{label}</span>
      <span className="font-semibold text-slate-800 tabular-nums">{new Intl.NumberFormat("id-ID").format(v)}</span>
      <span className="text-slate-400 text-xs">({pct}%)</span>
    </div>
  );
}
function Sel({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: string[] }) {
  return (
    <div className="min-w-[140px]">
      <label className="text-xs text-slate-500 block mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
        <option value="">Semua</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function Fld({ label, v, on, type = "text" }: { label: string; v?: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
      <input type={type} value={v ?? ""} onChange={e => on(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
    </div>
  );
}
function SelF({ label, v, on, opts }: { label: string; v?: string; on: (v: string) => void; opts: string[] }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
      <select value={v ?? ""} onChange={e => on(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
