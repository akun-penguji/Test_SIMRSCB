"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ppraAtcList, ppraAtcUpsert, ppraAtcDelete, ppraAtcImport,
  PpraAtc, AdmRoute, DddSatuan, AwareKategori,
} from "@/lib/api";

const ROUTES: AdmRoute[] = ["O", "P", "R", "Inhal", "Instill", "other"];
const SATUAN: DddSatuan[] = ["g", "mg", "MU", "TU", "U", "ml"];
const AWARE: AwareKategori[] = ["Access", "Watch", "Reserve", "Not_recommended"];

const AWARE_BADGE: Record<AwareKategori, string> = {
  Access: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Watch: "bg-amber-100 text-amber-800 border-amber-300",
  Reserve: "bg-red-100 text-red-800 border-red-300",
  Not_recommended: "bg-slate-200 text-slate-700 border-slate-300",
};

const BLANK: PpraAtc = {
  atc_code: "", adm_route: "P", nama_generik: "", ddd: 1,
  ddd_satuan: "g", aware_kategori: "Watch", who_edisi: 2025, keterangan: "",
};

export default function PpraAtcPage() {
  const [rows, setRows] = useState<PpraAtc[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PpraAtc>(BLANK);
  const [editing, setEditing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    setLoading(true);
    ppraAtcList(q).then(r => setRows(r.data.data)).catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [q]);
  useEffect(() => { reload(); }, [reload]);

  const openNew = () => { setForm(BLANK); setEditing(false); setModalOpen(true); };
  const openEdit = (r: PpraAtc) => { setForm({ ...r, keterangan: r.keterangan ?? "" }); setEditing(true); setModalOpen(true); };

  const simpan = async () => {
    try {
      await ppraAtcUpsert(form);
      setMsg({ t: "ok", m: "Referensi ATC tersimpan" });
      setModalOpen(false); reload();
    } catch (e) {
      setMsg({ t: "err", m: errMsg(e) });
    }
  };
  const hapus = async (r: PpraAtc) => {
    if (!confirm(`Hapus ${r.nama_generik} (${r.atc_code}/${r.adm_route})?`)) return;
    try { await ppraAtcDelete(r.atc_code, r.adm_route); setMsg({ t: "ok", m: "Terhapus" }); reload(); }
    catch (e) { setMsg({ t: "err", m: errMsg(e) }); }
  };
  const doImport = async (f: File) => {
    try {
      const r = await ppraAtcImport(f);
      setMsg({ t: "ok", m: `Import: ${r.data.masuk} masuk, ${r.data.dilewati} dilewati${r.data.errors.length ? ` — ${r.data.errors.length} error` : ""}` });
      reload();
    } catch (e) { setMsg({ t: "err", m: errMsg(e) }); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/klpcm" className="text-slate-400 hover:text-slate-600">‹</Link>
        <h1 className="text-2xl font-bold text-slate-800">Referensi WHO ATC/DDD + AWaRe</h1>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Master DDD &amp; klasifikasi AWaRe. <Link href="/ppra/mapping" className="text-indigo-600 hover:underline">→ Mapping obat</Link>
      </p>

      <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded-lg px-4 py-2 mb-4">
        ⚠ Nilai DDD wajib diverifikasi ke <a className="underline" href="https://atcddd.fhi.no" target="_blank" rel="noreferrer">atcddd.fhi.no</a> (edisi terbaru) sebelum dipakai laporan resmi / akreditasi.
      </div>

      {msg && (
        <div className={`text-sm rounded-lg px-4 py-2 mb-3 ${msg.t === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.m}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari kode ATC / nama generik…"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-64" />
        <button onClick={openNew} className="bg-indigo-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-indigo-700">+ Tambah</button>
        <button onClick={() => fileRef.current?.click()} className="bg-white border border-slate-300 text-sm rounded-lg px-4 py-2 hover:bg-slate-50">⬆ Import CSV</button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden"
          onChange={e => e.target.files?.[0] && doImport(e.target.files[0])} />
        <span className="text-xs text-slate-400 ml-auto">{rows.length} baris</span>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-2">ATC</th><th className="px-3 py-2">Rute</th>
              <th className="px-3 py-2">Generik</th><th className="px-3 py-2 text-right">DDD</th>
              <th className="px-3 py-2">AWaRe</th><th className="px-3 py-2">Edisi</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Belum ada data. Tambah atau import CSV.</td></tr>
            ) : rows.map(r => (
              <tr key={`${r.atc_code}-${r.adm_route}`} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono">{r.atc_code}</td>
                <td className="px-3 py-2">{r.adm_route}</td>
                <td className="px-3 py-2">{r.nama_generik}</td>
                <td className="px-3 py-2 text-right font-mono">{r.ddd} {r.ddd_satuan}</td>
                <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded border ${AWARE_BADGE[r.aware_kategori]}`}>{r.aware_kategori}</span></td>
                <td className="px-3 py-2 text-slate-500">{r.who_edisi}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(r)} className="text-indigo-600 hover:underline mr-3">Edit</button>
                  <button onClick={() => hapus(r)} className="text-red-500 hover:underline">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">{editing ? "Edit" : "Tambah"} Referensi ATC</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kode ATC">
                <input value={form.atc_code} disabled={editing} onChange={e => setForm({ ...form, atc_code: e.target.value.toUpperCase() })}
                  className="input" placeholder="J01DD04" />
              </Field>
              <Field label="Rute">
                <select value={form.adm_route} disabled={editing} onChange={e => setForm({ ...form, adm_route: e.target.value as AdmRoute })} className="input">
                  {ROUTES.map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Nama Generik" full>
                <input value={form.nama_generik} onChange={e => setForm({ ...form, nama_generik: e.target.value })} className="input" placeholder="Ceftriaxone" />
              </Field>
              <Field label="DDD">
                <input type="number" step="0.0001" value={form.ddd} onChange={e => setForm({ ...form, ddd: parseFloat(e.target.value) || 0 })} className="input" />
              </Field>
              <Field label="Satuan DDD">
                <select value={form.ddd_satuan} onChange={e => setForm({ ...form, ddd_satuan: e.target.value as DddSatuan })} className="input">
                  {SATUAN.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Kategori AWaRe">
                <select value={form.aware_kategori} onChange={e => setForm({ ...form, aware_kategori: e.target.value as AwareKategori })} className="input">
                  {AWARE.map(a => <option key={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Edisi WHO">
                <input type="number" value={form.who_edisi} onChange={e => setForm({ ...form, who_edisi: parseInt(e.target.value) || 2025 })} className="input" />
              </Field>
              <Field label="Keterangan" full>
                <input value={form.keterangan ?? ""} onChange={e => setForm({ ...form, keterangan: e.target.value })} className="input" />
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
              <button onClick={simpan} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Simpan</button>
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        .input { border: 1px solid rgb(203 213 225); border-radius: 0.5rem; padding: 0.4rem 0.6rem; font-size: 0.875rem; width: 100%; }
      `}</style>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`text-sm ${full ? "col-span-2" : ""}`}>
      <span className="block text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

function errMsg(e: unknown): string {
  const err = e as { response?: { data?: { error?: string } } };
  return err.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal");
}
