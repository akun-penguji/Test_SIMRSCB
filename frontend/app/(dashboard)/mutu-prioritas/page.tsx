"use client";

// Skoring Indikator Mutu Prioritas — metode High Risk (HR) / High Volume (HV) /
// Problem Prone (PP). Total = HR×50 + HV×30 + PP×20. Diurutkan menurun; N teratas
// jadi indikator prioritas. Skor HR/HV/PP (1-5) di-input manual Komite Mutu.

import { useEffect, useState, useCallback } from "react";
import {
  mutuPrioritasList, mutuPrioritasPeriode, mutuPrioritasSave, mutuPrioritasHapus,
  MutuPrioritasSkor,
} from "@/lib/api";

const BOBOT = { hr: 50, hv: 30, pp: 20 };
const TOP_N = 5;

function tahunIni() { return String(new Date().getFullYear()); }

export default function MutuPrioritasPage() {
  const [periode, setPeriode] = useState<string>(tahunIni());
  const [periodeOpts, setPeriodeOpts] = useState<string[]>([]);
  const [rows, setRows] = useState<MutuPrioritasSkor[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);

  // Baris tambah baru
  const [nInd, setNInd] = useState("");
  const [nHr, setNHr] = useState(0);
  const [nHv, setNHv] = useState(0);
  const [nPp, setNPp] = useState(0);
  const [nKet, setNKet] = useState("");

  const muat = useCallback(() => {
    setLoading(true);
    mutuPrioritasList(periode)
      .then(r => setRows(r.data.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [periode]);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => { mutuPrioritasPeriode().then(r => setPeriodeOpts(r.data.data)).catch(() => {}); }, []);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3000); return () => clearTimeout(t); } }, [msg]);

  const total = (hr: number, hv: number, pp: number) => hr * BOBOT.hr + hv * BOBOT.hv + pp * BOBOT.pp;

  async function simpanBaris(r: MutuPrioritasSkor) {
    try {
      await mutuPrioritasSave({ id: r.id, periode, indikator: r.indikator, hr: r.hr, hv: r.hv, pp: r.pp, keterangan: r.keterangan });
      setMsg({ t: "ok", m: "Tersimpan" });
      muat();
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setMsg({ t: "err", m: ex.response?.data?.error ?? "Gagal menyimpan" });
    }
  }

  async function tambah() {
    if (!nInd.trim()) { setMsg({ t: "err", m: "Nama indikator wajib diisi" }); return; }
    try {
      await mutuPrioritasSave({ periode, indikator: nInd.trim(), hr: nHr, hv: nHv, pp: nPp, keterangan: nKet });
      setNInd(""); setNHr(0); setNHv(0); setNPp(0); setNKet("");
      setMsg({ t: "ok", m: "Indikator ditambahkan" });
      muat();
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setMsg({ t: "err", m: ex.response?.data?.error ?? "Gagal menambah" });
    }
  }

  async function hapus(id: number, nama: string) {
    if (!window.confirm(`Hapus indikator "${nama}"?`)) return;
    try { await mutuPrioritasHapus(id); muat(); } catch { setMsg({ t: "err", m: "Gagal menghapus" }); }
  }

  // update satu field baris di state (belum tersimpan sampai klik Simpan)
  function setField(id: number, k: "indikator" | "hr" | "hv" | "pp" | "keterangan", v: string | number) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [k]: v } as MutuPrioritasSkor : r));
  }

  const numInp = "w-14 border border-slate-300 rounded px-1.5 py-1 text-sm text-center";
  const th = "px-2 py-2 text-xs font-bold text-slate-600 border-b border-slate-200 text-left";
  const td = "px-2 py-1.5 text-sm border-b border-slate-100 align-middle";

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Skoring Indikator Mutu Prioritas</h1>
          <p className="text-xs text-slate-500">Metode High Risk (×{BOBOT.hr}) · High Volume (×{BOBOT.hv}) · Problem Prone (×{BOBOT.pp}). Skor 0–5.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Periode</label>
          <input list="periodeList" value={periode} onChange={e => setPeriode(e.target.value.trim())}
            placeholder="mis. 2026 / 2026-TW1"
            className="w-36 border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm" />
          <datalist id="periodeList">{periodeOpts.map(p => <option key={p} value={p} />)}</datalist>
          <button onClick={() => window.print()}
            className="text-sm font-semibold bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-3 py-1.5">Cetak</button>
        </div>
      </div>

      {msg && (
        <div className={`no-print text-sm rounded-lg px-3 py-2 ${msg.t === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg.m}</div>
      )}

      {/* Judul cetak */}
      <div className="hidden print:block text-center mb-2">
        <div className="text-base font-bold">Hasil Skoring Indikator Mutu Prioritas</div>
        <div className="text-sm">Periode: {periode}</div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Rank</th>
              <th className={`${th} min-w-[180px]`}>Indikator</th>
              <th className={`${th} text-center`}>HR</th>
              <th className={`${th} text-center`}>HR×{BOBOT.hr}</th>
              <th className={`${th} text-center`}>HV</th>
              <th className={`${th} text-center`}>HV×{BOBOT.hv}</th>
              <th className={`${th} text-center`}>PP</th>
              <th className={`${th} text-center`}>PP×{BOBOT.pp}</th>
              <th className={`${th} text-center`}>Total</th>
              <th className={`${th} no-print`}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center text-slate-400 text-sm py-8">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="text-center text-slate-400 text-sm py-8">Belum ada indikator untuk periode {periode}.</td></tr>
            ) : rows.map((r, i) => {
              const t = total(r.hr, r.hv, r.pp);
              const top = i < TOP_N;
              return (
                <tr key={r.id} className={top ? "bg-amber-50/60" : ""}>
                  <td className={`${td} text-center font-bold ${top ? "text-amber-700" : "text-slate-400"}`}>{i + 1}</td>
                  <td className={td}>
                    <input value={r.indikator} onChange={e => setField(r.id, "indikator", e.target.value)}
                      className="w-full border border-transparent hover:border-slate-300 focus:border-slate-400 rounded px-1.5 py-1 text-sm" />
                    <input value={r.keterangan} onChange={e => setField(r.id, "keterangan", e.target.value)} placeholder="keterangan…"
                      className="mt-1 w-full border border-transparent hover:border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-500 no-print" />
                  </td>
                  <td className={`${td} text-center`}><input type="number" min={0} max={5} value={r.hr} onChange={e => setField(r.id, "hr", Math.max(0, Math.min(5, +e.target.value)))} className={numInp} /></td>
                  <td className={`${td} text-center tabular-nums text-slate-500`}>{r.hr * BOBOT.hr}</td>
                  <td className={`${td} text-center`}><input type="number" min={0} max={5} value={r.hv} onChange={e => setField(r.id, "hv", Math.max(0, Math.min(5, +e.target.value)))} className={numInp} /></td>
                  <td className={`${td} text-center tabular-nums text-slate-500`}>{r.hv * BOBOT.hv}</td>
                  <td className={`${td} text-center`}><input type="number" min={0} max={5} value={r.pp} onChange={e => setField(r.id, "pp", Math.max(0, Math.min(5, +e.target.value)))} className={numInp} /></td>
                  <td className={`${td} text-center tabular-nums text-slate-500`}>{r.pp * BOBOT.pp}</td>
                  <td className={`${td} text-center font-bold tabular-nums`}>{t}</td>
                  <td className={`${td} no-print whitespace-nowrap`}>
                    <button onClick={() => simpanBaris(r)} className="text-xs font-semibold text-emerald-700 hover:underline mr-2">Simpan</button>
                    <button onClick={() => hapus(r.id, r.indikator)} className="text-xs font-semibold text-red-600 hover:underline">Hapus</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Baris tambah */}
          <tfoot className="no-print">
            <tr className="bg-slate-50/70">
              <td className={`${td} text-center text-slate-300`}>+</td>
              <td className={td}>
                <input value={nInd} onChange={e => setNInd(e.target.value)} placeholder="Nama indikator baru…"
                  onKeyDown={e => { if (e.key === "Enter") tambah(); }}
                  className="w-full border border-slate-300 rounded px-1.5 py-1 text-sm" />
              </td>
              <td className={`${td} text-center`}><input type="number" min={0} max={5} value={nHr} onChange={e => setNHr(Math.max(0, Math.min(5, +e.target.value)))} className={numInp} /></td>
              <td className={`${td} text-center text-slate-400`}>{nHr * BOBOT.hr}</td>
              <td className={`${td} text-center`}><input type="number" min={0} max={5} value={nHv} onChange={e => setNHv(Math.max(0, Math.min(5, +e.target.value)))} className={numInp} /></td>
              <td className={`${td} text-center text-slate-400`}>{nHv * BOBOT.hv}</td>
              <td className={`${td} text-center`}><input type="number" min={0} max={5} value={nPp} onChange={e => setNPp(Math.max(0, Math.min(5, +e.target.value)))} className={numInp} /></td>
              <td className={`${td} text-center text-slate-400`}>{nPp * BOBOT.pp}</td>
              <td className={`${td} text-center font-bold text-slate-400`}>{total(nHr, nHv, nPp)}</td>
              <td className={`${td}`}><button onClick={tambah} className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2.5 py-1">Tambah</button></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[11px] text-slate-400 no-print">
        {TOP_N} baris teratas (disorot) adalah indikator prioritas terpilih. Total dihitung otomatis; ubah skor lalu klik <b>Simpan</b>.
        Skor HR/HV/PP dinilai manual oleh Komite Mutu (High Risk / High Volume / Problem Prone).
      </p>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 12mm; }
        }
      `}</style>
    </div>
  );
}
