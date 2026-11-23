"use client";

// Self Security Assessment — penilaian mandiri keamanan SI untuk kredensialing
// BPJS (kriteria Sistem poin d). Daftar penilaian per periode + buat baru.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasPerm } from "@/lib/auth";
import { getSsaList, createSsa, SsaRow } from "@/lib/api";

const TINGKAT_WARNA: Record<string, string> = {
  "Baik": "bg-green-100 text-green-700",
  "Cukup": "bg-amber-100 text-amber-700",
  "Perlu Perbaikan": "bg-red-100 text-red-700",
};

export default function SsaPage() {
  const router = useRouter();
  const isEdit = hasPerm("ssa_edit");
  const [rows, setRows] = useState<SsaRow[]>([]);
  const [tambah, setTambah] = useState(false);

  const load = useCallback(() => { getSsaList().then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">🛡️ Self Security Assessment</h1>
        <p className="text-sm text-slate-500">Security Self-Assessment SIM Faskes sesuai form resmi BPJS (SPPTI-SEC-FORM-001 v1.1) — 15 aspek (10 Frontend + 5 Backend) untuk kredensialing/integrasi bridging.</p>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 text-xs text-indigo-800">
        Nilai tiap aspek PASS / Sebagian / NOT PASS / N/A dengan bukti; skor kesiapan terhitung otomatis (PASS=2, Sebagian=1, NOT PASS=0). Untuk arsip tertanda tangan, cetak hasilnya dari layar detail.
      </div>

      <div className="flex justify-end">
        {isEdit && <button onClick={() => setTambah(true)} className="px-4 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">+ Penilaian Baru</button>}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left"><tr>
            <th className="px-3 py-2">Tanggal</th><th className="px-3 py-2">Periode</th><th className="px-3 py-2">Metode</th>
            <th className="px-3 py-2">PJ</th><th className="px-3 py-2 text-center">Skor</th><th className="px-3 py-2">Tingkat</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={`/security-assessment/${r.id}`} className="text-indigo-700 hover:underline font-medium">
                    {new Date(r.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-600">{r.periode || "-"}</td>
                <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded bg-slate-100">{r.metode}</span></td>
                <td className="px-3 py-2 text-slate-500">{r.penanggung_jawab || "-"}</td>
                <td className="px-3 py-2 text-center tabular-nums font-semibold">{r.skor_total != null ? `${r.skor_total.toFixed(0)}%` : "-"}</td>
                <td className="px-3 py-2">{r.tingkat ? <span className={`text-xs px-2 py-0.5 rounded ${TINGKAT_WARNA[r.tingkat] || "bg-slate-100"}`}>{r.tingkat}</span> : <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">Belum ada penilaian.</td></tr>}
          </tbody>
        </table>
      </div>

      {tambah && <FormBaru onClose={() => setTambah(false)} onSaved={(id) => { setTambah(false); router.push(`/security-assessment/${id}`); }} />}
    </div>
  );
}

function FormBaru({ onClose, onSaved }: { onClose: () => void; onSaved: (id: number) => void }) {
  const now = new Date();
  const [f, setF] = useState({ tahun: now.getFullYear(), tanggal: now.toISOString().slice(0, 10), periode: "", metode: "Internal", penanggung_jawab: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function simpan() {
    setBusy(true); setErr("");
    try { const r = await createSsa(f); onSaved(r.data.id); }
    catch (e) { setErr(e instanceof Error ? e.message : "Gagal."); setBusy(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mt-10" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between px-5 py-3 border-b border-slate-200"><h3 className="font-semibold">Penilaian Baru</h3><button onClick={onClose} className="text-slate-400 text-xl">×</button></div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-slate-400">Tahun</label><input type="number" value={f.tahun} onChange={e => setF(p => ({ ...p, tahun: Number(e.target.value) }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs text-slate-400">Tanggal</label><input type="date" value={f.tanggal} onChange={e => setF(p => ({ ...p, tanggal: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div><label className="text-xs text-slate-400">Periode (opsional)</label><input value={f.periode} onChange={e => setF(p => ({ ...p, periode: e.target.value }))} placeholder="mis. Triwulan I / Semester 1" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="text-xs text-slate-400">Metode</label><select value={f.metode} onChange={e => setF(p => ({ ...p, metode: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">{["Internal", "Pihak Ketiga", "Gabungan"].map(m => <option key={m}>{m}</option>)}</select></div>
          <div><label className="text-xs text-slate-400">Penanggung jawab</label><input value={f.penanggung_jawab} onChange={e => setF(p => ({ ...p, penanggung_jawab: e.target.value }))} placeholder="Tim IT / SIMRS / SPI" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <p className="text-xs text-slate-400">15 aspek BPJS (10 Frontend + 5 Backend) akan dibuat otomatis, tinggal dinilai.</p>
          <div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-slate-100">Batal</button><button onClick={simpan} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white disabled:opacity-50">{busy ? "…" : "Buat"}</button></div>
        </div>
      </div>
    </div>
  );
}
