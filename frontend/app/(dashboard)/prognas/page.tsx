"use client";

// Prognas — Program Nasional (PONEK/TB/HIV/Stunting/Geriatri/KB). Register kasus + rekap.

import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import MicButton from "@/components/MicButton";
import { prognasList, prognasCreate, prognasUpdate, prognasDelete, prognasRekap, Prognas, PrognasRekap } from "@/lib/api";

const nowY = new Date().getFullYear();
const todayISO = () => new Date().toISOString().slice(0, 10);
const PROGRAM = ["PONEK", "TB", "HIV", "Stunting", "Geriatri", "KB", "Lainnya"];
// Contoh status per program (bebas diketik juga).
const STATUS_HINT: Record<string, string[]> = {
  TB: ["Terkonfirmasi Bakteriologis", "Terdiagnosis Klinis", "TB RO", "Sembuh", "Pengobatan Lengkap", "Putus Obat"],
  HIV: ["Reaktif", "Non-Reaktif", "ARV", "PPIA", "Rujuk"],
  Stunting: ["Stunting", "Wasting", "Gizi Buruk", "Gizi Kurang", "Perbaikan"],
  PONEK: ["Ibu — Persalinan Normal", "Ibu — SC", "Ibu — Rujuk", "Bayi — Sehat", "Bayi — Asfiksia", "Bayi — BBLR", "Bayi — Rujuk"],
  Geriatri: ["Mandiri", "Ketergantungan Ringan", "Ketergantungan Sedang", "Ketergantungan Berat"],
  KB: ["IUD", "Implan", "Suntik", "Pil", "MOW", "MOP", "Kondom"],
};

function TInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <label className="text-xs text-slate-500 block">{label}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800" /></label>;
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
function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-bold text-slate-900">{value}</div></div>;
}

function emptyForm(): Partial<Prognas> { return { tanggal: todayISO(), program: "TB" }; }

export default function PrognasPage() {
  const isEdit = hasPerm("prognas_edit") || hasPerm("mutu_edit") || hasPerm("akreditasi_edit");
  const [rekap, setRekap] = useState<PrognasRekap | null>(null);
  const [rows, setRows] = useState<Prognas[]>([]);
  const [fProgram, setFProgram] = useState("");
  const [f, setF] = useState<Partial<Prognas> | null>(null);
  const load = useCallback(() => {
    prognasRekap(nowY).then(r => setRekap(r.data)).catch(() => {});
    prognasList({ tahun: nowY, program: fProgram || undefined }).then(r => setRows(r.data)).catch(() => setRows([]));
  }, [fProgram]);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof Prognas, v: string) => setF(p => ({ ...(p || {}), [k]: v }));
  const statusOpts = f?.program && STATUS_HINT[f.program] ? ["", ...STATUS_HINT[f.program]] : [];
  async function save() { if (!f) return; try { if (f.id) await prognasUpdate(f.id, f); else await prognasCreate(f); setF(null); load(); } catch { alert("Gagal menyimpan"); } }
  async function hapus(id: number) { if (confirm("Hapus kasus ini?")) { await prognasDelete(id); load(); } }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">🏥 Prognas — Program Nasional</h1>
        <p className="text-sm text-slate-500">Register kasus PONEK, TB, HIV, Stunting, Geriatri, KB — untuk laporan program & akreditasi.</p>
      </div>
      {rekap && (
        <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
          <Stat label={`Total ${nowY}`} value={rekap.total} />
          {PROGRAM.slice(0, 6).map(pg => <Stat key={pg} label={pg} value={rekap.per_program.find(x => x.label === pg)?.total ?? 0} />)}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {isEdit && !f && <button onClick={() => setF(emptyForm())} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Kasus Prognas</button>}
        <TSel label="" value={fProgram} onChange={setFProgram} options={["", ...PROGRAM]} />
      </div>
      {f && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Kasus Prognas</div>
          <div className="grid grid-cols-2 gap-2">
            <TInput label="Tanggal" type="date" value={f.tanggal ?? ""} onChange={v => set("tanggal", v)} />
            <TSel label="Program" value={f.program ?? "TB"} onChange={v => set("program", v)} options={PROGRAM} />
            <TInput label="No. RM" value={f.no_rkm_medis ?? ""} onChange={v => set("no_rkm_medis", v)} />
            <TInput label="Nama Pasien" value={f.nama_pasien ?? ""} onChange={v => set("nama_pasien", v)} />
            <TInput label="Umur" value={f.umur ?? ""} onChange={v => set("umur", v)} />
            <TSel label="Jenis Kelamin" value={f.jenis_kelamin ?? ""} onChange={v => set("jenis_kelamin", v)} options={["", "L", "P"]} />
            <TInput label="Unit" value={f.unit ?? ""} onChange={v => set("unit", v)} />
            <TInput label="Diagnosa" value={f.diagnosa ?? ""} onChange={v => set("diagnosa", v)} />
            {statusOpts.length > 0
              ? <TSel label="Status Kasus" value={f.status_kasus ?? ""} onChange={v => set("status_kasus", v)} options={statusOpts} />
              : <TInput label="Status Kasus" value={f.status_kasus ?? ""} onChange={v => set("status_kasus", v)} />}
            <TArea label="Tindakan" value={f.tindakan ?? ""} onChange={v => set("tindakan", v)} />
            <TArea label="Hasil" value={f.hasil ?? ""} onChange={v => set("hasil", v)} />
            <TArea label="Keterangan" value={f.keterangan ?? ""} onChange={v => set("keterangan", v)} />
          </div>
          <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button>
            <button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Tgl</th><th className="px-3 py-2 text-left">Program</th><th className="px-3 py-2 text-left">Pasien</th><th className="px-3 py-2 text-left">Diagnosa</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada kasus.</td></tr> :
              rows.map(r => <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">{r.tanggal}</td><td className="px-3 py-2 font-semibold">{r.program}</td>
                <td className="px-3 py-2">{r.nama_pasien ?? "-"}<div className="text-[11px] text-slate-400">{r.umur} {r.jenis_kelamin}</div></td>
                <td className="px-3 py-2 text-xs">{r.diagnosa ?? "-"}</td><td className="px-3 py-2 text-xs">{r.status_kasus ?? "-"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
