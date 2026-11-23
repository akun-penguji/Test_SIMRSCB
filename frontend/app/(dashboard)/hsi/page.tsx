"use client";

// HSI — Hospital Safety Index. Sesi penilaian + input tingkat per item + index/klasifikasi.

import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import {
  getHsiPenilaian, createHsiPenilaian, deleteHsiPenilaian, getHsiDetail, upsertHsiNilai,
  getHsiItems, createHsiItem, deleteHsiItem, HsiPenilaian, HsiDetail, HsiItem,
} from "@/lib/api";

const MODUL: Record<number, string> = { 1: "Modul 1 — Struktural", 2: "Modul 2 — Non-Struktural", 3: "Modul 3 — Manajemen Kedaruratan & Bencana" };
const KLAS: Record<string, { t: string; c: string }> = {
  A: { t: "A — RS mampu berfungsi saat bencana", c: "bg-green-100 text-green-700" },
  B: { t: "B — Perlu intervensi", c: "bg-amber-100 text-amber-700" },
  C: { t: "C — Perlu intervensi mendesak", c: "bg-red-100 text-red-700" },
};

export default function HsiPage() {
  const isEdit = hasPerm("akreditasi_edit") || hasPerm("mutu_edit");
  const [sel, setSel] = useState<number | null>(null);
  const [kelolaItem, setKelolaItem] = useState(false);
  if (kelolaItem) return <ItemMaster isEdit={isEdit} onBack={() => setKelolaItem(false)} />;
  if (sel) return <Detail id={sel} isEdit={isEdit} onBack={() => setSel(null)} />;
  return <SesiList isEdit={isEdit} onOpen={setSel} onKelola={() => setKelolaItem(true)} />;
}

function SesiList({ isEdit, onOpen, onKelola }: { isEdit: boolean; onOpen: (id: number) => void; onKelola: () => void }) {
  const [rows, setRows] = useState<HsiPenilaian[]>([]);
  const [nama, setNama] = useState(""); const [form, setForm] = useState(false);
  const load = () => getHsiPenilaian().then(r => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  async function buat() { if (!nama.trim()) return; await createHsiPenilaian({ nama }); setNama(""); setForm(false); load(); }
  async function hapus(id: number) { if (!confirm("Hapus sesi penilaian ini?")) return; await deleteHsiPenilaian(id); load(); }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-xl font-bold text-slate-800">🏥 Hospital Safety Index (HSI)</h1>
          <p className="text-sm text-slate-500">Penilaian keamanan RS terhadap bencana — index & klasifikasi A/B/C.</p></div>
        <div className="flex gap-2">
          {isEdit && <button onClick={onKelola} className="px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">Kelola Item</button>}
          {isEdit && <button onClick={() => setForm(true)} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700">+ Sesi Penilaian</button>}
        </div>
      </div>
      {form && <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-2">
        <input value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama penilaian (mis. HSI Semester 1 2026)" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <button onClick={buat} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white">Buat</button>
        <button onClick={() => setForm(false)} className="px-3 py-2 text-sm rounded-lg bg-slate-100">Batal</button>
      </div>}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-3 py-2">Nama</th><th className="px-3 py-2">Tanggal</th><th className="px-3 py-2">Penilai</th><th className="px-3 py-2">Index</th><th className="px-3 py-2">Klasifikasi</th><th></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{r.nama}</td><td className="px-3 py-2 text-slate-500">{r.tanggal}</td><td className="px-3 py-2 text-slate-500">{r.penilai}</td>
                <td className="px-3 py-2 tabular-nums">{r.indeks != null ? (r.indeks * 100).toFixed(0) + "%" : "-"}</td>
                <td className="px-3 py-2">{r.klasifikasi ? <span className={`px-2 py-0.5 rounded text-xs ${KLAS[r.klasifikasi]?.c || ""}`}>{r.klasifikasi}</span> : "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs space-x-2"><button onClick={() => onOpen(r.id)} className="text-green-700 hover:underline">buka</button>{isEdit && <button onClick={() => hapus(r.id)} className="text-slate-400 hover:text-red-600">hapus</button>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">Belum ada sesi penilaian.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Detail({ id, isEdit, onBack }: { id: number; isEdit: boolean; onBack: () => void }) {
  const [d, setD] = useState<HsiDetail | null>(null);
  const load = useCallback(() => { getHsiDetail(id).then(r => setD(r.data)).catch(() => {}); }, [id]);
  useEffect(() => { load(); }, [load]);
  async function setNilai(item_id: number, tingkat: string) { await upsertHsiNilai({ penilaian_id: id, item_id, tingkat }); load(); }
  if (!d) return <div className="text-slate-400">Memuat…</div>;
  const moduls = [1, 2, 3];
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-blue-600 hover:underline">← Daftar Sesi</button>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-slate-800">{d.penilaian.nama}</h1>
        <div className="flex items-center gap-3">
          <div className="text-right"><div className="text-xs text-slate-500">Safety Index</div><div className="text-2xl font-bold text-slate-800">{d.penilaian.indeks != null ? (d.penilaian.indeks * 100).toFixed(0) + "%" : "-"}</div></div>
          {d.penilaian.klasifikasi && <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${KLAS[d.penilaian.klasifikasi]?.c || ""}`}>{KLAS[d.penilaian.klasifikasi]?.t || d.penilaian.klasifikasi}</span>}
        </div>
      </div>
      {d.items.length === 0 && <div className="text-slate-400 text-sm">Belum ada item checklist. Tambahkan lewat “Kelola Item”.</div>}
      {moduls.map(m => {
        const items = d.items.filter(i => i.modul === m);
        if (items.length === 0) return null;
        return (
          <div key={m} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 font-semibold text-slate-700 text-sm">{MODUL[m]}</div>
            <table className="w-full text-sm">
              <tbody>
                {items.map(it => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{it.kode && <span className="font-mono text-xs text-slate-400 mr-1">{it.kode}</span>}{it.uraian}</td>
                    <td className="px-3 py-2 whitespace-nowrap w-56">
                      {(["rendah", "sedang", "tinggi"] as const).map(t => (
                        <button key={t} disabled={!isEdit} onClick={() => setNilai(it.id, t)}
                          className={`px-2 py-1 text-xs rounded mr-1 border ${it.tingkat === t ? (t === "tinggi" ? "bg-green-600 text-white border-green-600" : t === "sedang" ? "bg-amber-500 text-white border-amber-500" : "bg-red-500 text-white border-red-500") : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>{t}</button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <p className="text-xs text-slate-400">Tingkat: tinggi=aman (1), sedang (0.5), rendah=rentan (0). Index = rata² berbobot. A ≥66% · B 36–65% · C &lt;36%.</p>
    </div>
  );
}

function ItemMaster({ isEdit, onBack }: { isEdit: boolean; onBack: () => void }) {
  const [rows, setRows] = useState<HsiItem[]>([]);
  const [f, setF] = useState({ modul: 1, uraian: "", kode: "", bobot: 1 });
  const load = () => getHsiItems().then(r => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  async function tambah() { if (!f.uraian.trim()) return; await createHsiItem(f); setF({ ...f, uraian: "", kode: "" }); load(); }
  async function hapus(id: number) { if (!confirm("Hapus item?")) return; await deleteHsiItem(id); load(); }
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-blue-600 hover:underline">← Daftar Sesi</button>
      <h1 className="text-lg font-bold text-slate-800">Kelola Item HSI</h1>
      {isEdit && <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-2 flex-wrap items-end">
        <select value={f.modul} onChange={e => setF({ ...f, modul: Number(e.target.value) })} className="border border-slate-300 rounded-lg px-2 py-2 text-sm">{[1, 2, 3].map(m => <option key={m} value={m}>{MODUL[m]}</option>)}</select>
        <input value={f.kode} onChange={e => setF({ ...f, kode: e.target.value })} placeholder="Kode" className="border border-slate-300 rounded-lg px-2 py-2 text-sm w-24" />
        <input value={f.uraian} onChange={e => setF({ ...f, uraian: e.target.value })} placeholder="Uraian item" className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]" />
        <input type="number" value={f.bobot} onChange={e => setF({ ...f, bobot: Number(e.target.value) })} placeholder="Bobot" className="border border-slate-300 rounded-lg px-2 py-2 text-sm w-20" />
        <button onClick={tambah} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white">+ Item</button>
      </div>}
      {[1, 2, 3].map(m => {
        const items = rows.filter(i => i.modul === m);
        return (
          <div key={m} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 font-semibold text-slate-700 text-sm">{MODUL[m]} ({items.length})</div>
            {items.map(it => (
              <div key={it.id} className="px-4 py-2 border-t border-slate-100 flex items-center justify-between text-sm">
                <span>{it.kode && <span className="font-mono text-xs text-slate-400 mr-1">{it.kode}</span>}{it.uraian} <span className="text-xs text-slate-400">(bobot {it.bobot})</span></span>
                {isEdit && <button onClick={() => hapus(it.id)} className="text-slate-400 hover:text-red-600 text-xs">hapus</button>}
              </div>
            ))}
            {items.length === 0 && <div className="px-4 py-3 text-slate-400 text-sm">Belum ada item.</div>}
          </div>
        );
      })}
    </div>
  );
}
