"use client";

// PPI — Surveilans HAIs, Audit Kepatuhan, Denominator hari-alat (STARKES PPI).

import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import MicButton from "@/components/MicButton";
import {
  ppiSurvList, ppiSurvCreate, ppiSurvUpdate, ppiSurvDelete,
  ppiAuditList, ppiAuditCreate, ppiAuditUpdate, ppiAuditDelete,
  ppiDenomList, ppiDenomUpsert, ppiDenomDelete, ppiRekap,
  PpiSurv, PpiAudit, PpiDenom, PpiRekap,
} from "@/lib/api";

const nowY = new Date().getFullYear();
const todayISO = () => new Date().toISOString().slice(0, 10);
const BLN = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HAIS = ["ILO", "ISK", "IADP", "PLABSI", "VAP", "Phlebitis", "Lainnya"];
const JENIS_AUDIT = ["Kebersihan Tangan", "APD", "Penyuntikan Aman", "Dekontaminasi Alat", "Pengelolaan Limbah", "Lainnya"];
const ALAT = ["Kateter Urin", "Ventilator", "CVC", "Infus Perifer"];

function TInput({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <label className="text-xs text-slate-500 block">{label}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800" /></label>;
}
function TSel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return <label className="text-xs text-slate-500 block">{label}
    <select value={value} onChange={e => onChange(e.target.value)} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800 bg-white">
      {options.map(o => <option key={o} value={o}>{o || "—"}</option>)}</select></label>;
}
function TArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="text-xs text-slate-500 block col-span-2">{label}
    <div className="relative mt-0.5"><textarea value={value} onChange={e => onChange(e.target.value)} rows={2}
      className="block w-full border border-slate-300 rounded-lg px-2 py-1.5 pr-8 text-sm text-slate-800" />
      <MicButton value={value} onChange={onChange} className="absolute right-1.5 bottom-1.5" /></div></label>;
}
function Stat({ label, value, color = "blue" }: { label: string; value: string | number; color?: string }) {
  const c: Record<string, string> = { blue: "bg-blue-50 border-blue-200 text-blue-700", emerald: "bg-emerald-50 border-emerald-200 text-emerald-700", amber: "bg-amber-50 border-amber-200 text-amber-700", rose: "bg-rose-50 border-rose-200 text-rose-700" };
  return <div className={`rounded-lg border p-3 ${c[color]}`}><div className="text-xs">{label}</div><div className="text-2xl font-bold text-slate-900">{value}</div></div>;
}

export default function PpiPage() {
  const isEdit = hasPerm("ppi_edit") || hasPerm("mutu_edit") || hasPerm("akreditasi_edit");
  const [tab, setTab] = useState<"surveilans" | "audit" | "denominator">("surveilans");
  const [rekap, setRekap] = useState<PpiRekap | null>(null);
  useEffect(() => { ppiRekap(nowY).then(r => setRekap(r.data)).catch(() => {}); }, [tab]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">🦠 PPI — Surveilans & Audit Kepatuhan</h1>
        <p className="text-sm text-slate-500">Surveilans HAIs (ILO/ISK/IADP/VAP/Phlebitis), audit kebersihan tangan/APD, rate per 1000 hari-alat.</p>
      </div>
      {rekap && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Stat label={`Kasus HAIs ${nowY}`} value={rekap.total_kasus} color="rose" />
          {rekap.rate.slice(0, 4).map(r => (
            <Stat key={r.jenis} label={`${r.jenis} /1000 alat`} value={r.rate_per_1000 != null ? r.rate_per_1000.toFixed(2) : "—"} color="amber" />
          ))}
        </div>
      )}
      {rekap && rekap.audit.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-xs font-semibold text-emerald-700 mb-1">Kepatuhan (audit {nowY})</div>
          <div className="flex flex-wrap gap-2">
            {rekap.audit.map(a => <span key={a.jenis} className="text-xs bg-white border border-emerald-200 rounded-full px-3 py-1"><b>{a.jenis}</b>: {a.kepatuhan != null ? `${a.kepatuhan.toFixed(0)}%` : "—"} <span className="text-slate-400">({a.patuh}/{a.kesempatan})</span></span>)}
          </div>
        </div>
      )}
      <div className="flex gap-1 border-b border-slate-200">
        {([["surveilans", "Surveilans HAIs"], ["audit", "Audit Kepatuhan"], ["denominator", "Hari-Alat (Denominator)"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
        ))}
      </div>
      {tab === "surveilans" && <TabSurv isEdit={isEdit} />}
      {tab === "audit" && <TabAudit isEdit={isEdit} />}
      {tab === "denominator" && <TabDenom isEdit={isEdit} />}
    </div>
  );
}

function emptySurv(): Partial<PpiSurv> { return { tanggal: todayISO(), jenis_hais: "Phlebitis" }; }
function TabSurv({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<PpiSurv[]>([]);
  const [f, setF] = useState<Partial<PpiSurv> | null>(null);
  const load = useCallback(() => { ppiSurvList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof PpiSurv, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f) return; try { if (f.id) await ppiSurvUpdate(f.id, f); else await ppiSurvCreate(f); setF(null); load(); } catch { alert("Gagal menyimpan"); } }
  async function hapus(id: number) { if (confirm("Hapus kasus ini?")) { await ppiSurvDelete(id); load(); } }
  return (
    <div className="space-y-3">
      {isEdit && !f && <button onClick={() => setF(emptySurv())} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Kasus HAIs</button>}
      {f && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Kasus HAIs</div>
          <div className="grid grid-cols-2 gap-2">
            <TInput label="Tanggal Temuan" type="date" value={f.tanggal ?? ""} onChange={v => set("tanggal", v)} />
            <TSel label="Jenis HAIs" value={f.jenis_hais ?? "Phlebitis"} onChange={v => set("jenis_hais", v)} options={HAIS} />
            <TInput label="No. Rawat" value={f.no_rawat ?? ""} onChange={v => set("no_rawat", v)} />
            <TInput label="Nama Pasien" value={f.nama_pasien ?? ""} onChange={v => set("nama_pasien", v)} />
            <TInput label="Unit" value={f.unit ?? ""} onChange={v => set("unit", v)} />
            <TInput label="Lama Pakai Alat (hari)" type="number" value={String(f.lama_pakai ?? "")} onChange={v => set("lama_pakai", Number(v) || 0)} />
            <TInput label="Tgl Pasang Alat" type="date" value={f.tanggal_pasang ?? ""} onChange={v => set("tanggal_pasang", v)} />
            <TInput label="Tgl Infeksi" type="date" value={f.tanggal_infeksi ?? ""} onChange={v => set("tanggal_infeksi", v)} />
            <TInput label="Mikroorganisme" value={f.mikroorganisme ?? ""} onChange={v => set("mikroorganisme", v)} />
            <TArea label="Gejala" value={f.gejala ?? ""} onChange={v => set("gejala", v)} />
            <TArea label="Tindakan" value={f.tindakan ?? ""} onChange={v => set("tindakan", v)} />
          </div>
          <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button>
            <button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Tgl</th><th className="px-3 py-2 text-left">Jenis</th><th className="px-3 py-2 text-left">Pasien</th><th className="px-3 py-2 text-left">Unit</th><th className="px-3 py-2 text-left">Mikroorganisme</th><th className="px-3 py-2"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada kasus.</td></tr> :
              rows.map(r => <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">{r.tanggal}</td><td className="px-3 py-2 font-semibold">{r.jenis_hais}</td>
                <td className="px-3 py-2">{r.nama_pasien ?? "-"}<div className="text-[11px] text-slate-400 font-mono">{r.no_rawat}</div></td>
                <td className="px-3 py-2 text-xs">{r.unit ?? "-"}</td><td className="px-3 py-2 text-xs">{r.mikroorganisme ?? "-"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function emptyAud(): Partial<PpiAudit> { return { tanggal: todayISO(), jenis_audit: "Kebersihan Tangan", jml_kesempatan: 0, jml_patuh: 0 }; }
function TabAudit({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<PpiAudit[]>([]);
  const [f, setF] = useState<Partial<PpiAudit> | null>(null);
  const load = useCallback(() => { ppiAuditList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof PpiAudit, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  const pct = f && (f.jml_kesempatan ?? 0) > 0 ? ((f.jml_patuh ?? 0) * 100 / (f.jml_kesempatan ?? 1)) : null;
  async function save() { if (!f) return; try { if (f.id) await ppiAuditUpdate(f.id, f); else await ppiAuditCreate(f); setF(null); load(); } catch { alert("Gagal menyimpan"); } }
  async function hapus(id: number) { if (confirm("Hapus audit ini?")) { await ppiAuditDelete(id); load(); } }
  return (
    <div className="space-y-3">
      {isEdit && !f && <button onClick={() => setF(emptyAud())} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Audit Kepatuhan</button>}
      {f && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Audit Kepatuhan</div>
          <div className="grid grid-cols-2 gap-2">
            <TInput label="Tanggal" type="date" value={f.tanggal ?? ""} onChange={v => set("tanggal", v)} />
            <TSel label="Jenis Audit" value={f.jenis_audit ?? "Kebersihan Tangan"} onChange={v => set("jenis_audit", v)} options={JENIS_AUDIT} />
            <TInput label="Unit" value={f.unit ?? ""} onChange={v => set("unit", v)} />
            <TSel label="Profesi" value={f.profesi ?? ""} onChange={v => set("profesi", v)} options={["", "Dokter", "Perawat", "Bidan", "Nakes Lain", "Semua"]} />
            <TInput label="Jml Kesempatan (opportunities)" type="number" value={String(f.jml_kesempatan ?? 0)} onChange={v => set("jml_kesempatan", Number(v) || 0)} />
            <TInput label="Jml Patuh" type="number" value={String(f.jml_patuh ?? 0)} onChange={v => set("jml_patuh", Number(v) || 0)} />
            <TInput label="Auditor" value={f.auditor ?? ""} onChange={v => set("auditor", v)} />
            <div className="text-sm self-end">Kepatuhan: <b className="text-emerald-700">{pct != null ? `${pct.toFixed(1)}%` : "—"}</b></div>
            <TArea label="Catatan" value={f.catatan ?? ""} onChange={v => set("catatan", v)} />
          </div>
          <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button>
            <button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Tgl</th><th className="px-3 py-2 text-left">Jenis</th><th className="px-3 py-2 text-left">Unit</th><th className="px-3 py-2 text-left">Profesi</th><th className="px-3 py-2 text-right">Patuh/Kesempatan</th><th className="px-3 py-2 text-right">Kepatuhan</th><th className="px-3 py-2"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada audit.</td></tr> :
              rows.map(r => <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">{r.tanggal}</td><td className="px-3 py-2">{r.jenis_audit}</td><td className="px-3 py-2 text-xs">{r.unit ?? "-"}</td><td className="px-3 py-2 text-xs">{r.profesi ?? "-"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.jml_patuh}/{r.jml_kesempatan}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums">{r.kepatuhan != null ? `${r.kepatuhan.toFixed(0)}%` : "—"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabDenom({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<PpiDenom[]>([]);
  const [f, setF] = useState<Partial<PpiDenom> | null>(null);
  const load = useCallback(() => { ppiDenomList(nowY).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof PpiDenom, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f || !f.jenis_alat || !f.bulan) { alert("Bulan & jenis alat wajib"); return; } try { await ppiDenomUpsert({ ...f, tahun: nowY }); setF(null); load(); } catch { alert("Gagal menyimpan"); } }
  async function hapus(id: number) { if (confirm("Hapus data ini?")) { await ppiDenomDelete(id); load(); } }
  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">Input hari-alat (device-days) per bulan/unit/jenis alat — untuk menghitung rate HAIs per 1000 hari-alat.</div>
      {isEdit && !f && <button onClick={() => setF({ tahun: nowY, bulan: new Date().getMonth() + 1, jenis_alat: "Kateter Urin", hari_alat: 0, hari_rawat: 0 })} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Hari-Alat</button>}
      {f && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <TSel label="Bulan" value={String(f.bulan ?? "")} onChange={v => set("bulan", Number(v))} options={BLN.slice(1).map((_, i) => String(i + 1))} />
            <TInput label="Unit" value={f.unit ?? ""} onChange={v => set("unit", v)} />
            <TSel label="Jenis Alat" value={f.jenis_alat ?? "Kateter Urin"} onChange={v => set("jenis_alat", v)} options={ALAT} />
            <TInput label="Hari Alat (device-days)" type="number" value={String(f.hari_alat ?? 0)} onChange={v => set("hari_alat", Number(v) || 0)} />
            <TInput label="Hari Rawat (patient-days)" type="number" value={String(f.hari_rawat ?? 0)} onChange={v => set("hari_rawat", Number(v) || 0)} />
          </div>
          <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button>
            <button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Bulan</th><th className="px-3 py-2 text-left">Unit</th><th className="px-3 py-2 text-left">Jenis Alat</th><th className="px-3 py-2 text-right">Hari-Alat</th><th className="px-3 py-2 text-right">Hari-Rawat</th><th className="px-3 py-2"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> :
              rows.map(r => <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">{BLN[r.bulan]}</td><td className="px-3 py-2 text-xs">{r.unit || "-"}</td><td className="px-3 py-2">{r.jenis_alat}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.hari_alat}</td><td className="px-3 py-2 text-right tabular-nums">{r.hari_rawat}</td>
                <td className="px-3 py-2 text-right">{isEdit && <button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button>}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
