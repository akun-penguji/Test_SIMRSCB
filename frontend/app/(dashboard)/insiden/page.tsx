"use client";

// PMKP — Pelaporan Insiden Keselamatan Pasien (IKP). Register + grading matriks + dashboard.

import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import MicButton from "@/components/MicButton";
import { insidenList, insidenCreate, insidenUpdate, insidenDelete, insidenRekap, Insiden, InsidenRekap } from "@/lib/api";

const nowY = new Date().getFullYear();
const todayISO = () => new Date().toISOString().slice(0, 10);
const JENIS = ["KPC", "KNC", "KTC", "KTD", "Sentinel"];
const JENIS_LABEL: Record<string, string> = { KPC: "KPC — Kondisi Potensial Cedera", KNC: "KNC — Nyaris Cedera", KTC: "KTC — Tidak Cedera", KTD: "KTD — Tidak Diharapkan", Sentinel: "Sentinel" };
const DAMPAK = ["", "Tidak Signifikan", "Minor", "Moderat", "Mayor", "Katastropik"];
const STATUS = ["Lapor", "Investigasi", "Selesai", "Ditutup"];
const METODE = ["", "Investigasi Sederhana", "RCA"];
const SKALA = ["", "1", "2", "3", "4", "5"];

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
function gradingBand(p: number, d: number): string {
  const s = p * d; if (!p || !d) return ""; if (s >= 15) return "Merah"; if (s >= 8) return "Kuning"; if (s >= 4) return "Hijau"; return "Biru";
}
function GradingPill({ g }: { g?: string }) {
  const c: Record<string, string> = { Merah: "bg-red-100 text-red-700", Kuning: "bg-amber-100 text-amber-700", Hijau: "bg-emerald-100 text-emerald-700", Biru: "bg-sky-100 text-sky-700" };
  if (!g) return <span className="text-slate-300">—</span>;
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${c[g] ?? "bg-slate-100 text-slate-600"}`}>{g}</span>;
}
function StatusPill({ s }: { s: string }) {
  const c: Record<string, string> = { Selesai: "bg-emerald-100 text-emerald-700", Ditutup: "bg-slate-200 text-slate-600", Investigasi: "bg-sky-100 text-sky-700", Lapor: "bg-amber-100 text-amber-700" };
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${c[s] ?? "bg-slate-100 text-slate-600"}`}>{s}</span>;
}

function emptyForm(): Partial<Insiden> { return { tanggal_lapor: todayISO(), tanggal_insiden: todayISO(), jenis_insiden: "KNC", status: "Lapor" }; }

export default function InsidenPage() {
  const isEdit = hasPerm("insiden_edit") || hasPerm("mutu_edit") || hasPerm("akreditasi_edit");
  const [rows, setRows] = useState<Insiden[]>([]);
  const [rekap, setRekap] = useState<InsidenRekap | null>(null);
  const [f, setF] = useState<Partial<Insiden> | null>(null);
  const [fJenis, setFJenis] = useState(""); const [fStatus, setFStatus] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    insidenList({ tahun: nowY, jenis: fJenis || undefined, status: fStatus || undefined }).then(r => setRows(r.data)).catch(() => setRows([]));
    insidenRekap(nowY).then(r => setRekap(r.data)).catch(() => {});
  }, [fJenis, fStatus]);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof Insiden, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  const gPreview = f ? gradingBand(Number(f.probabilitas) || 0, Number(f.dampak_nilai) || 0) : "";

  async function save() {
    if (!f) return;
    try { if (f.id) await insidenUpdate(f.id, f); else await insidenCreate(f); setF(null); setMsg("Tersimpan."); load(); }
    catch (e) { setMsg((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Gagal menyimpan"); }
  }
  async function hapus(id: number) { if (confirm("Hapus laporan insiden ini?")) { await insidenDelete(id); load(); } }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">⚠️ Insiden Keselamatan Pasien (IKP)</h1>
        <p className="text-sm text-slate-500">Pelaporan & investigasi insiden — PMKP / KKP-RS (KPC, KNC, KTC, KTD, Sentinel).</p>
      </div>

      {rekap && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <Stat label={`Total ${nowY}`} value={rekap.total} color="blue" />
          <Stat label="Belum selesai" value={rekap.belum_selesai} color="amber" />
          {["Merah", "Kuning", "Hijau", "Biru"].map(g => {
            const n = rekap.per_grading.find(x => x.label === g)?.total ?? 0;
            const col = g === "Merah" ? "red" : g === "Kuning" ? "amber" : g === "Hijau" ? "emerald" : "sky";
            return <Stat key={g} label={`Grading ${g}`} value={n} color={col} />;
          })}
        </div>
      )}
      {rekap && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-semibold text-slate-500 mb-1">Per Jenis Insiden ({nowY})</div>
          <div className="flex flex-wrap gap-2">
            {JENIS.map(j => {
              const n = rekap.per_jenis.find(x => x.label === j)?.total ?? 0;
              return <span key={j} className="text-xs bg-slate-100 rounded-full px-3 py-1"><b>{j}</b>: {n}</span>;
            })}
          </div>
        </div>
      )}

      {msg && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{msg}</div>}

      <div className="flex flex-wrap items-center gap-2">
        {isEdit && !f && <button onClick={() => setF(emptyForm())} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Laporan Insiden</button>}
        <TSel label="" value={fJenis} onChange={setFJenis} options={["", ...JENIS]} />
        <TSel label="" value={fStatus} onChange={setFStatus} options={["", ...STATUS]} />
      </div>

      {f && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-sm font-bold text-slate-800">{f.id ? `Ubah Laporan ${f.no_laporan ?? ""}` : "Laporan Insiden Baru"}</div>
          <div className="grid grid-cols-2 gap-2">
            <TInput label="Tanggal Lapor" type="date" value={f.tanggal_lapor ?? ""} onChange={v => set("tanggal_lapor", v)} />
            <TSel label="Jenis Insiden" value={f.jenis_insiden ?? "KNC"} onChange={v => set("jenis_insiden", v)} options={JENIS} />
            <TInput label="Tanggal Insiden" type="date" value={f.tanggal_insiden ?? ""} onChange={v => set("tanggal_insiden", v)} />
            <TInput label="Jam Insiden" value={f.jam_insiden ?? ""} onChange={v => set("jam_insiden", v)} placeholder="HH:MM" />
            <TInput label="Judul / Insiden" value={f.judul ?? ""} onChange={v => set("judul", v)} />
            <TInput label="Tipe/Kategori" value={f.tipe_insiden ?? ""} onChange={v => set("tipe_insiden", v)} placeholder="Medikasi / Jatuh / dll" />
            <TInput label="Unit Terjadi" value={f.unit_terjadi ?? ""} onChange={v => set("unit_terjadi", v)} />
            <TInput label="Unit Pelapor" value={f.unit_pelapor ?? ""} onChange={v => set("unit_pelapor", v)} />
            <TInput label="No. RM (bila pasien)" value={f.no_rkm_medis ?? ""} onChange={v => set("no_rkm_medis", v)} />
            <TInput label="Nama Pasien" value={f.nama_pasien ?? ""} onChange={v => set("nama_pasien", v)} />
            <TArea label="Kronologi" value={f.kronologi ?? ""} onChange={v => set("kronologi", v)} />
            <TArea label="Tindakan Segera" value={f.tindakan_segera ?? ""} onChange={v => set("tindakan_segera", v)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50 rounded-lg p-2 items-end">
            <TSel label="Dampak Klinis" value={f.dampak ?? ""} onChange={v => set("dampak", v)} options={DAMPAK} />
            <TSel label="Dampak (1-5)" value={String(f.dampak_nilai ?? "")} onChange={v => set("dampak_nilai", Number(v) || 0)} options={SKALA} />
            <TSel label="Probabilitas (1-5)" value={String(f.probabilitas ?? "")} onChange={v => set("probabilitas", Number(v) || 0)} options={SKALA} />
            <div className="text-sm">Grading: <GradingPill g={gPreview} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TSel label="Metode Investigasi" value={f.metode_investigasi ?? ""} onChange={v => set("metode_investigasi", v)} options={METODE} />
            <TInput label="Penanggung Jawab" value={f.penanggung_jawab ?? ""} onChange={v => set("penanggung_jawab", v)} />
            <TInput label="Tgl Selesai Investigasi" type="date" value={f.tgl_selesai_investigasi ?? ""} onChange={v => set("tgl_selesai_investigasi", v)} />
            <TSel label="Status" value={f.status ?? "Lapor"} onChange={v => set("status", v)} options={STATUS} />
            <TArea label="Akar Masalah" value={f.akar_masalah ?? ""} onChange={v => set("akar_masalah", v)} />
            <TArea label="Hasil Investigasi" value={f.hasil_investigasi ?? ""} onChange={v => set("hasil_investigasi", v)} />
            <TArea label="Rekomendasi / RTL" value={f.rekomendasi ?? ""} onChange={v => set("rekomendasi", v)} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button>
            <button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr>
            <th className="px-3 py-2 text-left">No. Laporan</th><th className="px-3 py-2 text-left">Tgl</th><th className="px-3 py-2 text-left">Jenis</th>
            <th className="px-3 py-2 text-left">Insiden</th><th className="px-3 py-2 text-left">Unit</th><th className="px-3 py-2 text-center">Grading</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td colSpan={8} className="text-center text-slate-400 py-6">Belum ada laporan insiden.</td></tr> :
              rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{r.no_laporan ?? "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.tanggal_lapor}</td>
                  <td className="px-3 py-2"><span title={JENIS_LABEL[r.jenis_insiden]} className="font-semibold">{r.jenis_insiden}</span></td>
                  <td className="px-3 py-2">{r.judul ?? "-"}{r.nama_pasien ? <div className="text-[11px] text-slate-400">{r.nama_pasien}</div> : null}</td>
                  <td className="px-3 py-2 text-xs">{r.unit_terjadi ?? "-"}</td>
                  <td className="px-3 py-2 text-center"><GradingPill g={r.grading ?? undefined} /></td>
                  <td className="px-3 py-2"><StatusPill s={r.status} /></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button>
                    <button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  const c: Record<string, string> = { blue: "bg-blue-50 border-blue-200 text-blue-700", amber: "bg-amber-50 border-amber-200 text-amber-700", red: "bg-red-50 border-red-200 text-red-700", emerald: "bg-emerald-50 border-emerald-200 text-emerald-700", sky: "bg-sky-50 border-sky-200 text-sky-700" };
  return <div className={`rounded-lg border p-3 ${c[color] ?? c.blue}`}><div className="text-xs">{label}</div><div className="text-2xl font-bold text-slate-900">{value}</div></div>;
}
