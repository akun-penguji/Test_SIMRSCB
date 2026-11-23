"use client";

// SKP — Dashboard & Audit 6 Sasaran Keselamatan Pasien (STARKES SKP).

import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import MicButton from "@/components/MicButton";
import { skpList, skpCreate, skpUpdate, skpDelete, skpRekap, SkpAudit, SkpRekap } from "@/lib/api";

const nowY = new Date().getFullYear();
const todayISO = () => new Date().toISOString().slice(0, 10);
const SASARAN = [
  { n: 1, nama: "Identifikasi Pasien" }, { n: 2, nama: "Komunikasi Efektif (TBaK/SBAR)" },
  { n: 3, nama: "Keamanan Obat High Alert" }, { n: 4, nama: "Tepat Lokasi-Prosedur-Pasien Operasi" },
  { n: 5, nama: "Kebersihan Tangan" }, { n: 6, nama: "Pengurangan Risiko Jatuh" },
];

function TInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <label className="text-xs text-slate-500 block">{label}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800" /></label>;
}
function TSel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return <label className="text-xs text-slate-500 block">{label}
    <select value={value} onChange={e => onChange(e.target.value)} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800 bg-white">
      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select></label>;
}
function TArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="text-xs text-slate-500 block col-span-2">{label}
    <div className="relative mt-0.5"><textarea value={value} onChange={e => onChange(e.target.value)} rows={2}
      className="block w-full border border-slate-300 rounded-lg px-2 py-1.5 pr-8 text-sm text-slate-800" />
      <MicButton value={value} onChange={onChange} className="absolute right-1.5 bottom-1.5" /></div></label>;
}
function pctColor(p?: number | null) { if (p == null) return "text-slate-400"; if (p >= 85) return "text-emerald-700"; if (p >= 70) return "text-amber-700"; return "text-rose-700"; }

function emptyForm(): Partial<SkpAudit> { return { tanggal: todayISO(), sasaran: 1, jml_kesempatan: 0, jml_patuh: 0 }; }

export default function SkpPage() {
  const isEdit = hasPerm("skp_edit") || hasPerm("mutu_edit") || hasPerm("akreditasi_edit");
  const [rekap, setRekap] = useState<SkpRekap | null>(null);
  const [rows, setRows] = useState<SkpAudit[]>([]);
  const [fSasaran, setFSasaran] = useState("");
  const [f, setF] = useState<Partial<SkpAudit> | null>(null);
  const load = useCallback(() => {
    skpRekap(nowY).then(r => setRekap(r.data)).catch(() => {});
    skpList({ tahun: nowY, sasaran: fSasaran ? Number(fSasaran) : undefined }).then(r => setRows(r.data)).catch(() => setRows([]));
  }, [fSasaran]);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof SkpAudit, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  const pct = f && (f.jml_kesempatan ?? 0) > 0 ? ((f.jml_patuh ?? 0) * 100 / (f.jml_kesempatan ?? 1)) : null;
  async function save() { if (!f) return; try { if (f.id) await skpUpdate(f.id, f); else await skpCreate(f); setF(null); load(); } catch { alert("Gagal menyimpan"); } }
  async function hapus(id: number) { if (confirm("Hapus audit ini?")) { await skpDelete(id); load(); } }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">🎯 SKP — Sasaran Keselamatan Pasien</h1>
        <p className="text-sm text-slate-500">Dashboard kepatuhan 6 sasaran (SKP5 Kebersihan Tangan otomatis termasuk data audit PPI).</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {(rekap?.per_sasaran ?? SASARAN.map(s => ({ sasaran: s.n, nama: s.nama, kesempatan: 0, patuh: 0, kepatuhan: undefined as number | undefined }))).map(s => (
          <div key={s.sasaran} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">SKP {s.sasaran}</div>
              <div className={`text-2xl font-bold tabular-nums ${pctColor(s.kepatuhan)}`}>{s.kepatuhan != null ? `${s.kepatuhan.toFixed(0)}%` : "—"}</div>
            </div>
            <div className="text-sm font-semibold text-slate-800">{s.nama}</div>
            <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${(s.kepatuhan ?? 0) >= 85 ? "bg-emerald-500" : (s.kepatuhan ?? 0) >= 70 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(100, s.kepatuhan ?? 0)}%` }} />
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{s.patuh}/{s.kesempatan} kepatuhan</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isEdit && !f && <button onClick={() => setF(emptyForm())} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Audit SKP</button>}
        <TSel label="" value={fSasaran} onChange={setFSasaran} options={[{ v: "", l: "Semua Sasaran" }, ...SASARAN.map(s => ({ v: String(s.n), l: `SKP ${s.n}` }))]} />
      </div>

      {f && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Audit SKP</div>
          <div className="grid grid-cols-2 gap-2">
            <TInput label="Tanggal" type="date" value={f.tanggal ?? ""} onChange={v => set("tanggal", v)} />
            <TSel label="Sasaran" value={String(f.sasaran ?? 1)} onChange={v => set("sasaran", Number(v))} options={SASARAN.map(s => ({ v: String(s.n), l: `SKP ${s.n} — ${s.nama}` }))} />
            <TInput label="Indikator / Momen" value={f.indikator ?? ""} onChange={v => set("indikator", v)} />
            <TInput label="Unit" value={f.unit ?? ""} onChange={v => set("unit", v)} />
            <TInput label="Jml Kesempatan" type="number" value={String(f.jml_kesempatan ?? 0)} onChange={v => set("jml_kesempatan", Number(v) || 0)} />
            <TInput label="Jml Patuh" type="number" value={String(f.jml_patuh ?? 0)} onChange={v => set("jml_patuh", Number(v) || 0)} />
            <TInput label="Auditor" value={f.auditor ?? ""} onChange={v => set("auditor", v)} />
            <div className="text-sm self-end">Kepatuhan: <b className={pctColor(pct)}>{pct != null ? `${pct.toFixed(1)}%` : "—"}</b></div>
            <TArea label="Catatan" value={f.catatan ?? ""} onChange={v => set("catatan", v)} />
          </div>
          <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button>
            <button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Tgl</th><th className="px-3 py-2 text-left">SKP</th><th className="px-3 py-2 text-left">Indikator</th><th className="px-3 py-2 text-left">Unit</th><th className="px-3 py-2 text-right">Patuh/Kesempatan</th><th className="px-3 py-2 text-right">Kepatuhan</th><th className="px-3 py-2"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada audit.</td></tr> :
              rows.map(r => <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">{r.tanggal}</td><td className="px-3 py-2 font-semibold">SKP {r.sasaran}</td>
                <td className="px-3 py-2 text-xs">{r.indikator ?? "-"}</td><td className="px-3 py-2 text-xs">{r.unit ?? "-"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.jml_patuh}/{r.jml_kesempatan}</td>
                <td className={`px-3 py-2 text-right font-bold tabular-nums ${pctColor(r.kepatuhan)}`}>{r.kepatuhan != null ? `${r.kepatuhan.toFixed(0)}%` : "—"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
