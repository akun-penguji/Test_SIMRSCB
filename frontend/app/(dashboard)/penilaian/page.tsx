"use client";

// Penilaian Mandiri Akreditasi (Self-Assessment) — per Event × EP STARKES.

import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import {
  getAkrEvents, createAkrEvent, deleteAkrEvent, getAkrSkor, upsertAkrSkor, getAkrRekap,
  createPps, AkrEvent, AkrSkor, AkrRekap,
} from "@/lib/api";

const KELOMPOK: Record<number, string> = { 1: "Kel. 1 — Tata Kelola", 2: "Kel. 2 — Pelayanan Pasien", 3: "Kel. 3 — PMKP", 4: "Kel. 4 — SKP", 5: "Kel. 5" };

const BAB = ["AKP", "HPK", "PP", "PAP", "PAB", "PKPO", "KE", "SKP", "PPI", "PROGNAS", "PPK", "TKRS", "KPS", "MFK", "MRMIK", "PMKP"];

export default function PenilaianPage() {
  const isEdit = hasPerm("akreditasi_edit");
  const [sel, setSel] = useState<number | null>(null);
  if (sel) return <EventDetail id={sel} isEdit={isEdit} onBack={() => setSel(null)} />;
  return <EventList isEdit={isEdit} onOpen={setSel} />;
}

function EventList({ isEdit, onOpen }: { isEdit: boolean; onOpen: (id: number) => void }) {
  const [rows, setRows] = useState<AkrEvent[]>([]);
  const [form, setForm] = useState(false); const [nama, setNama] = useState(""); const [jenis, setJenis] = useState("mandiri");
  const load = () => getAkrEvents().then(r => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  async function buat() { if (!nama.trim()) return; await createAkrEvent({ nama, jenis }); setNama(""); setForm(false); load(); }
  async function hapus(id: number) { if (!confirm("Hapus event penilaian ini (beserta skornya)?")) return; await deleteAkrEvent(id); load(); }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-xl font-bold text-slate-800">✅ Penilaian Mandiri Akreditasi</h1>
          <p className="text-sm text-slate-500">Self-assessment per EP STARKES (skor 10/5/0/TDD) + capaian per bab.</p></div>
        {isEdit && <button onClick={() => setForm(true)} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700">+ Event Penilaian</button>}
      </div>
      {form && <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-2 flex-wrap">
        <input value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama (mis. Self-Assessment 2026 / Survei Simulasi)" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[220px]" />
        <select value={jenis} onChange={e => setJenis(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-2 text-sm"><option value="mandiri">Mandiri</option><option value="simulasi">Simulasi</option><option value="survei">Survei</option></select>
        <button onClick={buat} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white">Buat</button>
        <button onClick={() => setForm(false)} className="px-3 py-2 text-sm rounded-lg bg-slate-100">Batal</button>
      </div>}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-3 py-2">Nama</th><th className="px-3 py-2">Jenis</th><th className="px-3 py-2">Tanggal</th><th className="px-3 py-2">Status</th><th></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{r.nama}</td><td className="px-3 py-2 capitalize">{r.jenis}</td>
                <td className="px-3 py-2 text-slate-500">{r.tanggal}</td><td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs space-x-2"><button onClick={() => onOpen(r.id)} className="text-green-700 hover:underline">buka</button>{isEdit && <button onClick={() => hapus(r.id)} className="text-slate-400 hover:text-red-600">hapus</button>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Belum ada event penilaian.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventDetail({ id, isEdit, onBack }: { id: number; isEdit: boolean; onBack: () => void }) {
  const [rekap, setRekap] = useState<AkrRekap | null>(null);
  const [bab, setBab] = useState<string | null>(null);
  const loadRekap = useCallback(() => { getAkrRekap(id).then(r => setRekap(r.data)).catch(() => {}); }, [id]);
  useEffect(() => { loadRekap(); }, [loadRekap]);
  const warna = (c: number) => c >= 80 ? "bg-green-500" : c >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-blue-600 hover:underline">← Daftar Event</button>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-slate-800">Penilaian — capaian keseluruhan</h1>
        {rekap && <div className="text-right"><div className="text-xs text-slate-500">Capaian Total</div><div className={`text-2xl font-bold ${rekap.capaian_total >= 80 ? "text-green-600" : rekap.capaian_total >= 60 ? "text-amber-600" : "text-red-600"}`}>{rekap.capaian_total.toFixed(1)}%</div></div>}
      </div>

      {/* Dashboard capaian per KELOMPOK */}
      {rekap && (() => {
        const byKel: Record<number, { skor: number; maks: number }> = {};
        rekap.per_bab.forEach(b => {
          const k = b.kelompok || 0;
          if (!byKel[k]) byKel[k] = { skor: 0, maks: 0 };
          // rekonstruksi bobot dari capaian*total_ep tidak akurat; pakai rata2 tertimbang EP dinilai
          byKel[k].skor += b.capaian * (b.dinilai || 0); byKel[k].maks += 100 * (b.dinilai || 0);
        });
        const kels = Object.keys(byKel).map(Number).filter(k => k > 0).sort();
        if (kels.length === 0) return null;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kels.map(k => {
              const c = byKel[k].maks > 0 ? byKel[k].skor / byKel[k].maks * 100 : 0;
              return (
                <div key={k} className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-xs text-slate-500">{KELOMPOK[k] || `Kelompok ${k}`}</div>
                  <div className={`text-2xl font-bold ${c >= 80 ? "text-green-600" : c >= 60 ? "text-amber-600" : "text-red-600"}`}>{c.toFixed(0)}%</div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1"><div className={`h-1.5 rounded-full ${c >= 80 ? "bg-green-500" : c >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${c}%` }} /></div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Rekap per bab */}
      <div className="text-xs font-semibold text-slate-500">Capaian per Bab (klik untuk menilai)</div>
      <div className="grid md:grid-cols-2 gap-2">
        {rekap?.per_bab.map(b => (
          <button key={b.bab} onClick={() => setBab(b.bab || null)} className={`text-left bg-white border rounded-xl p-3 hover:border-green-400 ${bab === b.bab ? "border-green-500" : "border-slate-200"}`}>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-700">{b.bab} <span className="text-xs text-slate-400 font-normal">Kel. {b.kelompok}</span></span>
              <span className="text-sm font-bold tabular-nums">{b.capaian.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-1"><div className={`h-2 rounded-full ${warna(b.capaian)}`} style={{ width: `${b.capaian}%` }} /></div>
            <div className="text-xs text-slate-400 mt-1">{b.dinilai}/{b.total_ep} EP dinilai{b.tdd > 0 ? ` · ${b.tdd} TDD` : ""}</div>
          </button>
        ))}
      </div>

      {bab && <SkorTable eventId={id} bab={bab} isEdit={isEdit} onSaved={loadRekap} />}
    </div>
  );
}

function SkorTable({ eventId, bab, isEdit, onSaved }: { eventId: number; bab: string; isEdit: boolean; onSaved: () => void }) {
  const [rows, setRows] = useState<AkrSkor[]>([]);
  const load = useCallback(() => { getAkrSkor(eventId, bab).then(r => setRows(r.data)).catch(() => {}); }, [eventId, bab]);
  useEffect(() => { load(); }, [load]);
  async function setSkor(kd_ep: string, nilai: number | null, tdd: number) {
    await upsertAkrSkor({ event_id: eventId, kd_ep, nilai: nilai ?? undefined, tdd });
    setRows(p => p.map(r => r.kd_ep === kd_ep ? { ...r, nilai: nilai ?? undefined, tdd } : r)); onSaved();
  }
  async function setText(kd_ep: string, field: "fakta_analisa" | "rekomendasi", val: string) {
    await upsertAkrSkor({ event_id: eventId, kd_ep, [field]: val });
  }
  const [ppsMsg, setPpsMsg] = useState("");
  async function buatPps(r: AkrSkor) {
    try {
      await createPps({ kd_ep: r.kd_ep, bab, rekomendasi: r.rekomendasi || r.deskripsi, langkah_pemenuhan: r.fakta_analisa, status: "belum", progres: 0 });
      setPpsMsg(`PPS dibuat untuk ${r.kd_ep}. Buka menu PPS untuk melengkapi.`);
    } catch { setPpsMsg("Gagal membuat PPS (perlu izin akreditasi_edit)."); }
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2 bg-slate-50 font-semibold text-slate-700 text-sm flex justify-between items-center">
        <span>Bab {bab} — {rows.length} EP</span>
        {ppsMsg && <span className="text-xs text-green-700 font-normal">{ppsMsg}</span>}
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-400 text-left text-xs"><tr><th className="px-3 py-1.5">EP</th><th className="px-3 py-1.5">Skor</th><th className="px-3 py-1.5">Bukti</th><th className="px-3 py-1.5">Fakta/Analisa & Rekomendasi</th></tr></thead>
        <tbody>
          {rows.map(r => {
            const cur = r.tdd === 1 ? "TDD" : r.nilai;
            return (
              <tr key={r.kd_ep} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2 max-w-[340px]"><div className="font-mono text-xs text-slate-400">{r.kd_ep}</div><div className="text-xs">{r.deskripsi}</div></td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {([["10", 10, 0], ["5", 5, 0], ["0", 0, 0], ["TDD", null, 1]] as const).map(([lbl, n, t]) => (
                    <button key={lbl} disabled={!isEdit} onClick={() => setSkor(r.kd_ep, n, t)}
                      className={`px-2 py-1 text-xs rounded mr-1 mb-1 border ${cur === (t === 1 ? "TDD" : n) ? (lbl === "10" ? "bg-green-600 text-white border-green-600" : lbl === "5" ? "bg-amber-500 text-white border-amber-500" : lbl === "0" ? "bg-red-500 text-white border-red-500" : "bg-slate-500 text-white border-slate-500") : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}>{lbl}</button>
                  ))}
                </td>
                <td className="px-3 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded ${r.jml_bukti > 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}>{r.jml_bukti} dok</span></td>
                <td className="px-3 py-2">
                  <input defaultValue={r.fakta_analisa || ""} disabled={!isEdit} onBlur={e => setText(r.kd_ep, "fakta_analisa", e.target.value)} placeholder="Fakta & analisa" className="w-full border border-slate-300 rounded px-2 py-1 text-xs mb-1" />
                  <input defaultValue={r.rekomendasi || ""} disabled={!isEdit} onBlur={e => setText(r.kd_ep, "rekomendasi", e.target.value)} placeholder="Rekomendasi" className="w-full border border-slate-300 rounded px-2 py-1 text-xs" />
                  {isEdit && r.tdd !== 1 && r.nilai != null && r.nilai < 10 && (
                    <button onClick={() => buatPps(r)} className="mt-1 px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700 hover:bg-amber-200">→ Buat PPS (skor {r.nilai})</button>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Belum ada EP untuk bab ini.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
