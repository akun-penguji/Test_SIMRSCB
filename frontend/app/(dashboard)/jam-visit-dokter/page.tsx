"use client";

// Laporan Jam Visit Dokter (rawat inap). Sumber: pemeriksaan_ranap.jam_rawat untuk
// SOAP oleh dokter (nip = kode dokter). "Visit pertama" = jam SOAP dokter paling awal
// per pasien per hari. Filter periode + spesialisasi + jam target -> % ketepatan.

import { useEffect, useState, useCallback } from "react";
import { jamVisitDokter, jamVisitSpesialis, JamVisitRow } from "@/lib/api";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toDMY(iso: string) { if (!iso) return ""; const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}-${m}-${y}`; }

export default function JamVisitDokterPage() {
  const [tglAwal, setTglAwal] = useState(todayISO());
  const [tglAkhir, setTglAkhir] = useState(todayISO());
  const [kdSps, setKdSps] = useState("");
  const [jamTarget, setJamTarget] = useState("14:00");
  const [spsOpts, setSpsOpts] = useState<{ kd_sps: string; nm_sps: string }[]>([]);
  const [rows, setRows] = useState<JamVisitRow[]>([]);
  const [ring, setRing] = useState<{ total: number; tepat: number; tidak_tepat: number; persen_tepat: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { jamVisitSpesialis().then(r => setSpsOpts(r.data.data)).catch(() => {}); }, []);

  const muat = useCallback(() => {
    setLoading(true);
    jamVisitDokter({ tgl_awal: tglAwal, tgl_akhir: tglAkhir, kd_sps: kdSps || undefined, jam_target: jamTarget })
      .then(r => { setRows(r.data.data); setRing(r.data.ringkasan); })
      .catch(() => { setRows([]); setRing(null); })
      .finally(() => setLoading(false));
  }, [tglAwal, tglAkhir, kdSps, jamTarget]);

  useEffect(() => { muat(); /* muat awal */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inp = "border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm";
  const th = "px-2 py-2 text-xs font-bold text-slate-600 border-b border-slate-200 text-left whitespace-nowrap";
  const td = "px-2 py-1.5 text-sm border-b border-slate-100";
  const namaSps = kdSps ? (spsOpts.find(s => s.kd_sps === kdSps)?.nm_sps ?? "") : "Semua Spesialisasi";

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div className="no-print">
        <h1 className="text-lg font-bold text-slate-800">Laporan Jam Visit Dokter</h1>
        <p className="text-xs text-slate-500">Visit pertama = jam SOAP dokter paling awal per pasien/hari (rawat inap). Sumber: pemeriksaan_ranap.</p>
      </div>

      {/* Filter */}
      <div className="no-print flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Tgl Awal</span>
          <input type="date" value={tglAwal} onChange={e => setTglAwal(e.target.value)} className={inp} /></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Tgl Akhir</span>
          <input type="date" value={tglAkhir} onChange={e => setTglAkhir(e.target.value)} className={inp} /></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Spesialisasi</span>
          <select value={kdSps} onChange={e => setKdSps(e.target.value)} className={inp}>
            <option value="">Semua</option>
            {spsOpts.map(s => <option key={s.kd_sps} value={s.kd_sps}>{s.nm_sps}</option>)}
          </select></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Jam target (≤)</span>
          <input type="time" value={jamTarget} onChange={e => setJamTarget(e.target.value)} className={inp} /></label>
        <button onClick={muat} className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Tampilkan</button>
        <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg px-4 py-2">Cetak</button>
      </div>

      {/* Judul cetak */}
      <div className="hidden print:block text-center mb-1">
        <div className="text-base font-bold">Laporan Jam Visit Dokter</div>
        <div className="text-sm">{namaSps} · {toDMY(tglAwal)} s/d {toDMY(tglAkhir)} · Target ≤ {jamTarget}</div>
      </div>

      {/* Ringkasan */}
      {ring && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-[11px] text-slate-500">Total visit</div><div className="text-xl font-bold text-slate-800 tabular-nums">{ring.total}</div></div>
          <div className="bg-white border border-emerald-200 rounded-xl p-3"><div className="text-[11px] text-emerald-600">Tepat (≤ {jamTarget})</div><div className="text-xl font-bold text-emerald-700 tabular-nums">{ring.tepat}</div></div>
          <div className="bg-white border border-red-200 rounded-xl p-3"><div className="text-[11px] text-red-600">Terlambat</div><div className="text-xl font-bold text-red-700 tabular-nums">{ring.tidak_tepat}</div></div>
          <div className="bg-white border border-teal-200 rounded-xl p-3"><div className="text-[11px] text-teal-600">% Ketepatan</div><div className="text-xl font-bold text-teal-700 tabular-nums">{ring.persen_tepat}%</div></div>
        </div>
      )}

      {/* Tabel */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50"><tr>
            <th className={th}>Tanggal</th><th className={th}>No. Rawat</th><th className={th}>Pasien</th>
            <th className={th}>Kamar</th><th className={th}>Dokter</th><th className={th}>Spesialisasi</th>
            <th className={`${th} text-center`}>Visit Pertama</th><th className={`${th} text-center`}>Status</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center text-slate-400 text-sm py-8">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-slate-400 text-sm py-8">Tidak ada data pada rentang ini.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className={r.tepat ? "" : "bg-red-50/50"}>
                <td className={`${td} whitespace-nowrap`}>{toDMY(r.tgl_perawatan)}</td>
                <td className={`${td} whitespace-nowrap text-xs text-slate-500`}>{r.no_rawat}</td>
                <td className={td}>{r.nm_pasien} <span className="text-[11px] text-slate-400">({r.no_rkm_medis})</span></td>
                <td className={td}>{r.kamar || "-"}</td>
                <td className={td}>{r.nm_dokter}</td>
                <td className={`${td} text-xs`}>{r.spesialisasi || "-"}</td>
                <td className={`${td} text-center font-bold tabular-nums`}>{(r.visit_pertama || "").slice(0, 5)}</td>
                <td className={`${td} text-center`}>
                  <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border ${r.tepat ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                    {r.tepat ? "Tepat" : "Terlambat"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400 no-print">
        Catatan: jam visit = jam SOAP dokter di-input ke SIMRS. Akurat sebagai jam visite hanya bila dokter input real-time di samping pasien.
      </p>

      <style jsx global>{`
        @media print { .no-print { display: none !important; } @page { size: A4 landscape; margin: 12mm; } }
      `}</style>
    </div>
  );
}
