"use client";

// Manajemen & Mutu — Kepuasan Pasien, Orientasi Pegawai, Kontrak & Evaluasi Vendor.

import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import MicButton from "@/components/MicButton";
import {
  mjKepList, mjKepCreate, mjKepUpdate, mjKepDelete,
  mjOriList, mjOriCreate, mjOriUpdate, mjOriDelete,
  mjKonList, mjKonCreate, mjKonUpdate, mjKonDelete,
  MjKepuasan, MjOrientasi, MjKontrak,
} from "@/lib/api";

const nowY = new Date().getFullYear();
const todayISO = () => new Date().toISOString().slice(0, 10);

function TInput({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <label className="text-xs text-slate-500 block">{label}<input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800" /></label>;
}
function TSel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return <label className="text-xs text-slate-500 block">{label}<select value={value} onChange={e => onChange(e.target.value)} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800 bg-white">{options.map(o => <option key={o} value={o}>{o || "—"}</option>)}</select></label>;
}
function TArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="text-xs text-slate-500 block col-span-2">{label}<div className="relative mt-0.5"><textarea value={value} onChange={e => onChange(e.target.value)} rows={2} className="block w-full border border-slate-300 rounded-lg px-2 py-1.5 pr-8 text-sm text-slate-800" /><MicButton value={value} onChange={onChange} className="absolute right-1.5 bottom-1.5" /></div></label>;
}
// Badge tanggal berakhir kontrak
function ExpiryCell({ tgl }: { tgl?: string }) {
  if (!tgl) return <span className="text-slate-300">—</span>;
  const days = (new Date(tgl).getTime() - Date.now()) / 86400000;
  const cls = days < 0 ? "text-rose-700 font-semibold" : days <= 90 ? "text-amber-700 font-semibold" : "text-slate-600";
  return <span className={cls}>{tgl}{days < 0 ? " ⚠️" : days <= 90 ? " ⏳" : ""}</span>;
}

export default function ManajemenMutuPage() {
  const isEdit = hasPerm("manajemen_edit") || hasPerm("mutu_edit") || hasPerm("akreditasi_edit") || hasPerm("kepegawaian_edit");
  const [tab, setTab] = useState<"kepuasan" | "orientasi" | "kontrak">("kepuasan");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">📋 Manajemen & Mutu</h1>
        <p className="text-sm text-slate-500">Survei Kepuasan Pasien (INM13), Orientasi Pegawai (KPS), Kontrak & Evaluasi Vendor (TKRS/MFK).</p>
      </div>
      <div className="flex gap-1 border-b border-slate-200">
        {([["kepuasan", "Kepuasan Pasien"], ["orientasi", "Orientasi Pegawai"], ["kontrak", "Kontrak & Vendor"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
        ))}
      </div>
      {tab === "kepuasan" && <TabKep isEdit={isEdit} />}
      {tab === "orientasi" && <TabOri isEdit={isEdit} />}
      {tab === "kontrak" && <TabKon isEdit={isEdit} />}
    </div>
  );
}

function mutuBadge(m?: string) {
  const c: Record<string, string> = { A: "bg-emerald-100 text-emerald-700", B: "bg-sky-100 text-sky-700", C: "bg-amber-100 text-amber-700", D: "bg-rose-100 text-rose-700" };
  if (!m) return <span className="text-slate-300">—</span>;
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${c[m] ?? "bg-slate-100"}`}>{m}</span>;
}
function TabKep({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<MjKepuasan[]>([]); const [f, setF] = useState<Partial<MjKepuasan> | null>(null);
  const load = useCallback(() => { mjKepList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof MjKepuasan, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f) return; try { if (f.id) await mjKepUpdate(f.id, f); else await mjKepCreate(f); setF(null); load(); } catch { alert("Gagal"); } }
  async function hapus(id: number) { if (confirm("Hapus?")) { await mjKepDelete(id); load(); } }
  return <div className="space-y-3">
    {isEdit && !f && <button onClick={() => setF({ tanggal: todayISO(), jml_responden: 0 })} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Survei Kepuasan</button>}
    {f && <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2"><div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Survei Kepuasan (IKM)</div>
      <div className="grid grid-cols-2 gap-2">
        <TInput label="Tanggal" type="date" value={f.tanggal ?? ""} onChange={v => set("tanggal", v)} />
        <TInput label="Unit" value={f.unit ?? ""} onChange={v => set("unit", v)} />
        <TInput label="Periode" value={f.periode ?? ""} onChange={v => set("periode", v)} placeholder="2026-Q1 / Jan 2026" />
        <TSel label="Metode" value={f.metode ?? ""} onChange={v => set("metode", v)} options={["", "Kuesioner", "IKM", "Digital", "Kotak Saran"]} />
        <TInput label="Jml Responden" type="number" value={String(f.jml_responden ?? 0)} onChange={v => set("jml_responden", Number(v) || 0)} />
        <TInput label="Nilai IKM (%)" type="number" value={String(f.nilai_ikm ?? "")} onChange={v => set("nilai_ikm", Number(v) || 0)} />
        <TArea label="Keluhan Utama" value={f.keluhan_utama ?? ""} onChange={v => set("keluhan_utama", v)} />
        <TArea label="Tindak Lanjut" value={f.tindak_lanjut ?? ""} onChange={v => set("tindak_lanjut", v)} />
      </div>
      <div className="text-xs text-slate-500">Mutu otomatis: A ≥88,31 · B ≥76,61 · C ≥65 · D &lt;65 (PermenPANRB IKM).</div>
      <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button><button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div></div>}
    <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Tgl</th><th className="px-3 py-2 text-left">Unit</th><th className="px-3 py-2 text-left">Periode</th><th className="px-3 py-2 text-right">Responden</th><th className="px-3 py-2 text-right">IKM</th><th className="px-3 py-2 text-center">Mutu</th><th className="px-3 py-2"></th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> : rows.map(r => <tr key={r.id} className="hover:bg-slate-50"><td className="px-3 py-2 whitespace-nowrap">{r.tanggal}</td><td className="px-3 py-2 text-xs">{r.unit ?? "-"}</td><td className="px-3 py-2 text-xs">{r.periode ?? "-"}</td><td className="px-3 py-2 text-right tabular-nums">{r.jml_responden}</td><td className="px-3 py-2 text-right font-bold tabular-nums">{r.nilai_ikm != null ? `${r.nilai_ikm.toFixed(2)}` : "—"}</td><td className="px-3 py-2 text-center">{mutuBadge(r.mutu)}</td><td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td></tr>)}</tbody></table></div>
  </div>;
}

function TabOri({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<MjOrientasi[]>([]); const [f, setF] = useState<Partial<MjOrientasi> | null>(null);
  const load = useCallback(() => { mjOriList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof MjOrientasi, v: string) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f || !f.nama?.trim()) { alert("Nama wajib"); return; } try { if (f.id) await mjOriUpdate(f.id, f); else await mjOriCreate(f); setF(null); load(); } catch { alert("Gagal"); } }
  async function hapus(id: number) { if (confirm("Hapus?")) { await mjOriDelete(id); load(); } }
  return <div className="space-y-3">
    {isEdit && !f && <button onClick={() => setF({ nama: "", jenis: "Umum", tanggal_mulai: todayISO() })} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Orientasi Pegawai</button>}
    {f && <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2"><div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Orientasi Pegawai</div>
      <div className="grid grid-cols-2 gap-2">
        <TInput label="Nama *" value={f.nama ?? ""} onChange={v => set("nama", v)} />
        <TInput label="NIP" value={f.nip ?? ""} onChange={v => set("nip", v)} />
        <TSel label="Jenis" value={f.jenis ?? "Umum"} onChange={v => set("jenis", v)} options={["Umum", "Khusus Unit"]} />
        <TInput label="Unit" value={f.unit ?? ""} onChange={v => set("unit", v)} />
        <TInput label="Tanggal Mulai" type="date" value={f.tanggal_mulai ?? ""} onChange={v => set("tanggal_mulai", v)} />
        <TInput label="Tanggal Selesai" type="date" value={f.tanggal_selesai ?? ""} onChange={v => set("tanggal_selesai", v)} />
        <TSel label="Hasil" value={f.hasil ?? ""} onChange={v => set("hasil", v)} options={["", "Lulus", "Mengulang"]} />
        <TInput label="Nilai" value={f.nilai ?? ""} onChange={v => set("nilai", v)} />
        <TInput label="Pembimbing" value={f.pembimbing ?? ""} onChange={v => set("pembimbing", v)} />
        <TArea label="Materi" value={f.materi ?? ""} onChange={v => set("materi", v)} />
        <TArea label="Catatan" value={f.catatan ?? ""} onChange={v => set("catatan", v)} />
      </div>
      <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button><button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div></div>}
    <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Nama</th><th className="px-3 py-2 text-left">Jenis</th><th className="px-3 py-2 text-left">Unit</th><th className="px-3 py-2 text-left">Periode</th><th className="px-3 py-2 text-left">Hasil</th><th className="px-3 py-2"></th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> : rows.map(r => <tr key={r.id} className="hover:bg-slate-50"><td className="px-3 py-2 font-medium">{r.nama}<div className="text-[11px] text-slate-400 font-mono">{r.nip}</div></td><td className="px-3 py-2 text-xs">{r.jenis}</td><td className="px-3 py-2 text-xs">{r.unit ?? "-"}</td><td className="px-3 py-2 text-xs">{r.tanggal_mulai ?? "-"} s/d {r.tanggal_selesai ?? "-"}</td><td className="px-3 py-2 text-xs">{r.hasil ?? "-"}</td><td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td></tr>)}</tbody></table></div>
  </div>;
}

function TabKon({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<MjKontrak[]>([]); const [f, setF] = useState<Partial<MjKontrak> | null>(null); const [segera, setSegera] = useState(false);
  const load = useCallback(() => { mjKonList({ segera_habis: segera ? 1 : 0 }).then(r => setRows(r.data)).catch(() => setRows([])); }, [segera]);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof MjKontrak, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f || !f.nama_vendor?.trim()) { alert("Nama vendor wajib"); return; } try { if (f.id) await mjKonUpdate(f.id, f); else await mjKonCreate(f); setF(null); load(); } catch { alert("Gagal"); } }
  async function hapus(id: number) { if (confirm("Hapus?")) { await mjKonDelete(id); load(); } }
  return <div className="space-y-3">
    <div className="flex items-center gap-3">
      {isEdit && !f && <button onClick={() => setF({ nama_vendor: "", status: "Aktif" })} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Kontrak Vendor</button>}
      <label className="text-xs text-slate-600 flex items-center gap-1.5"><input type="checkbox" checked={segera} onChange={e => setSegera(e.target.checked)} className="h-4 w-4" /> Berakhir ≤ 90 hari</label>
    </div>
    {f && <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2"><div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Kontrak & Evaluasi Vendor</div>
      <div className="grid grid-cols-2 gap-2">
        <TInput label="No. Kontrak" value={f.no_kontrak ?? ""} onChange={v => set("no_kontrak", v)} />
        <TInput label="Nama Vendor *" value={f.nama_vendor ?? ""} onChange={v => set("nama_vendor", v)} />
        <TInput label="Jenis Layanan" value={f.jenis_layanan ?? ""} onChange={v => set("jenis_layanan", v)} placeholder="Cleaning/Katering/Alkes/dll" />
        <TSel label="Jenis Kontrak" value={f.jenis_kontrak ?? ""} onChange={v => set("jenis_kontrak", v)} options={["", "Klinis", "Manajemen"]} />
        <TInput label="Tanggal Mulai" type="date" value={f.tanggal_mulai ?? ""} onChange={v => set("tanggal_mulai", v)} />
        <TInput label="Tanggal Berakhir" type="date" value={f.tanggal_berakhir ?? ""} onChange={v => set("tanggal_berakhir", v)} />
        <TInput label="Nilai Kontrak (Rp)" type="number" value={String(f.nilai_kontrak ?? "")} onChange={v => set("nilai_kontrak", Number(v) || 0)} />
        <TSel label="Status" value={f.status ?? "Aktif"} onChange={v => set("status", v)} options={["Aktif", "Berakhir", "Perpanjangan", "Diputus"]} />
        <TInput label="Skor Evaluasi (%)" type="number" value={String(f.skor_evaluasi ?? "")} onChange={v => set("skor_evaluasi", Number(v) || 0)} />
        <TSel label="Rekomendasi" value={f.rekomendasi ?? ""} onChange={v => set("rekomendasi", v)} options={["", "Lanjut", "Perbaikan", "Putus"]} />
        <TInput label="PIC" value={f.pic ?? ""} onChange={v => set("pic", v)} />
        <TArea label="Hasil Evaluasi" value={f.evaluasi ?? ""} onChange={v => set("evaluasi", v)} />
      </div>
      <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button><button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div></div>}
    <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Vendor</th><th className="px-3 py-2 text-left">Layanan</th><th className="px-3 py-2 text-left">Berakhir</th><th className="px-3 py-2 text-right">Skor</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2"></th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> : rows.map(r => <tr key={r.id} className="hover:bg-slate-50"><td className="px-3 py-2 font-medium">{r.nama_vendor}<div className="text-[11px] text-slate-400">{r.no_kontrak}</div></td><td className="px-3 py-2 text-xs">{r.jenis_layanan ?? "-"}</td><td className="px-3 py-2 text-xs"><ExpiryCell tgl={r.tanggal_berakhir} /></td><td className="px-3 py-2 text-right tabular-nums">{r.skor_evaluasi != null ? `${r.skor_evaluasi.toFixed(0)}%` : "—"}</td><td className="px-3 py-2 text-xs">{r.status}</td><td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td></tr>)}</tbody></table></div>
  </div>;
}
