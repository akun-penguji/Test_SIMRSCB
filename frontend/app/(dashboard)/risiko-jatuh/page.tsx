"use client";

// Rekap Risiko Jatuh — dari isian awal keperawatan rawat inap (skor Morse/Sydney).
// Tingkat: Rendah / Sedang / Tinggi. Untuk indikator mutu risiko jatuh.

import { useEffect, useState, useCallback } from "react";
import { rekapRisikoJatuh, RisikoJatuhRow } from "@/lib/api";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function bulanIni() {
  const d = new Date();
  const a = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  return a;
}
function toDMY(iso: string) { if (!iso) return ""; const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}-${m}-${y}`; }

const badge: Record<string, string> = {
  Tinggi: "bg-red-50 text-red-700 border-red-200",
  Sedang: "bg-amber-50 text-amber-700 border-amber-200",
  Rendah: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function RisikoJatuhPage() {
  const [tglAwal, setTglAwal] = useState(bulanIni());
  const [tglAkhir, setTglAkhir] = useState(todayISO());
  const [rows, setRows] = useState<RisikoJatuhRow[]>([]);
  const [ring, setRing] = useState<{ total: number; rendah: number; sedang: number; tinggi: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const muat = useCallback(() => {
    setLoading(true);
    rekapRisikoJatuh({ tgl_awal: tglAwal, tgl_akhir: tglAkhir })
      .then(r => { setRows(r.data.data); setRing(r.data.ringkasan); })
      .catch(() => { setRows([]); setRing(null); })
      .finally(() => setLoading(false));
  }, [tglAwal, tglAkhir]);

  useEffect(() => { muat(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const inp = "border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm";
  const th = "px-2 py-2 text-xs font-bold text-slate-600 border-b border-slate-200 text-left whitespace-nowrap";
  const td = "px-2 py-1.5 text-sm border-b border-slate-100";

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="no-print">
        <h1 className="text-lg font-bold text-slate-800">Rekap Risiko Jatuh</h1>
        <p className="text-xs text-slate-500">Sumber: isian awal keperawatan rawat inap (skor Morse dewasa / Sydney geriatri). Rendah 0–24 · Sedang 25–44 · Tinggi ≥45 (Morse).</p>
      </div>

      <div className="no-print flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Tgl Awal</span>
          <input type="date" value={tglAwal} onChange={e => setTglAwal(e.target.value)} className={inp} /></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Tgl Akhir</span>
          <input type="date" value={tglAkhir} onChange={e => setTglAkhir(e.target.value)} className={inp} /></label>
        <button onClick={muat} className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Tampilkan</button>
        <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg px-4 py-2">Cetak</button>
      </div>

      <div className="hidden print:block text-center mb-1">
        <div className="text-base font-bold">Rekap Risiko Jatuh (Isian Awal Keperawatan Ranap)</div>
        <div className="text-sm">{toDMY(tglAwal)} s/d {toDMY(tglAkhir)}</div>
      </div>

      {ring && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-[11px] text-slate-500">Total dinilai</div><div className="text-xl font-bold text-slate-800 tabular-nums">{ring.total}</div></div>
          <div className="bg-white border border-emerald-200 rounded-xl p-3"><div className="text-[11px] text-emerald-600">Rendah</div><div className="text-xl font-bold text-emerald-700 tabular-nums">{ring.rendah}</div></div>
          <div className="bg-white border border-amber-200 rounded-xl p-3"><div className="text-[11px] text-amber-600">Sedang</div><div className="text-xl font-bold text-amber-700 tabular-nums">{ring.sedang}</div></div>
          <div className="bg-white border border-red-200 rounded-xl p-3"><div className="text-[11px] text-red-600">Tinggi</div><div className="text-xl font-bold text-red-700 tabular-nums">{ring.tinggi}</div></div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50"><tr>
            <th className={th}>Tanggal</th><th className={th}>No. Rawat</th><th className={th}>Pasien</th>
            <th className={th}>Kamar</th><th className={`${th} text-center`}>Skala</th>
            <th className={`${th} text-center`}>Skor</th><th className={`${th} text-center`}>Tingkat</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center text-slate-400 text-sm py-8">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-slate-400 text-sm py-8">Tidak ada data pada rentang ini.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i}>
                <td className={`${td} whitespace-nowrap`}>{toDMY(r.tanggal)}</td>
                <td className={`${td} whitespace-nowrap text-xs text-slate-500`}>{r.no_rawat}</td>
                <td className={td}>{r.nm_pasien} <span className="text-[11px] text-slate-400">({r.no_rkm_medis})</span></td>
                <td className={td}>{r.kamar || "-"}</td>
                <td className={`${td} text-center text-xs`}>{r.skala}</td>
                <td className={`${td} text-center font-bold tabular-nums`}>{r.skor}</td>
                <td className={`${td} text-center`}>
                  <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border ${badge[r.tingkat] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>{r.tingkat}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400 no-print">
        Catatan: skor 0 (Morse & Sydney) dihitung sebagai Rendah. Data diambil dari asesmen awal keperawatan ranap (penilaian_awal_keperawatan_ranap).
      </p>

      <style jsx global>{`
        @media print { .no-print { display: none !important; } @page { size: A4 portrait; margin: 12mm; } }
      `}</style>
    </div>
  );
}
