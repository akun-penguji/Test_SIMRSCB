"use client";

// Rekap Kepatuhan Clinical Pathway (item-based). Kepatuhan = item CP 'done' / total item.
// Sumber: cp_template / cp_eksekusi / cp_eksekusi_item.

import { useEffect, useState, useCallback } from "react";
import { rekapKepatuhanCp, CpRekapRow, CpDetailRow } from "@/lib/api";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function bulanIni() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }
function toDMY(iso: string) { if (!iso) return ""; const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}-${m}-${y}`; }
function warnaPersen(p: number) { return p >= 80 ? "text-emerald-700" : p >= 60 ? "text-amber-700" : "text-red-700"; }

export default function KepatuhanCpPage() {
  const [tglAwal, setTglAwal] = useState(bulanIni());
  const [tglAkhir, setTglAkhir] = useState(todayISO());
  const [perCp, setPerCp] = useState<CpRekapRow[]>([]);
  const [detail, setDetail] = useState<CpDetailRow[]>([]);
  const [ring, setRing] = useState<{ kasus: number; item_done: number; item_total: number; persen: number } | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [loading, setLoading] = useState(false);

  const muat = useCallback(() => {
    setLoading(true);
    rekapKepatuhanCp({ tgl_awal: tglAwal, tgl_akhir: tglAkhir })
      .then(r => { setPerCp(r.data.per_cp); setDetail(r.data.detail); setRing(r.data.ringkasan); })
      .catch(() => { setPerCp([]); setDetail([]); setRing(null); })
      .finally(() => setLoading(false));
  }, [tglAwal, tglAkhir]);

  useEffect(() => { muat(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const inp = "border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm";
  const th = "px-2 py-2 text-xs font-bold text-slate-600 border-b border-slate-200 text-left whitespace-nowrap";
  const td = "px-2 py-1.5 text-sm border-b border-slate-100";

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="no-print">
        <h1 className="text-lg font-bold text-slate-800">Rekap Kepatuhan Clinical Pathway</h1>
        <p className="text-xs text-slate-500">Kepatuhan = item CP dilakukan (done) ÷ total item, per CP/diagnosis. Sumber: modul Clinical Pathway.</p>
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
        <div className="text-base font-bold">Rekap Kepatuhan Clinical Pathway</div>
        <div className="text-sm">{toDMY(tglAwal)} s/d {toDMY(tglAkhir)}</div>
      </div>

      {ring && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-[11px] text-slate-500">Kasus CP</div><div className="text-xl font-bold text-slate-800 tabular-nums">{ring.kasus}</div></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-[11px] text-slate-500">Item dilakukan</div><div className="text-xl font-bold text-slate-800 tabular-nums">{ring.item_done}</div></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-[11px] text-slate-500">Total item</div><div className="text-xl font-bold text-slate-800 tabular-nums">{ring.item_total}</div></div>
          <div className="bg-white border border-teal-200 rounded-xl p-3"><div className="text-[11px] text-teal-600">% Kepatuhan</div><div className={`text-xl font-bold tabular-nums ${warnaPersen(ring.persen)}`}>{ring.persen}%</div></div>
        </div>
      )}

      {/* Per CP */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50"><tr>
            <th className={th}>Clinical Pathway</th><th className={th}>ICD-10</th>
            <th className={`${th} text-center`}>Kasus</th><th className={`${th} text-center`}>Item Done</th>
            <th className={`${th} text-center`}>Total Item</th><th className={`${th} text-center`}>% Kepatuhan</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center text-slate-400 text-sm py-8">Memuat…</td></tr>
            ) : perCp.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-400 text-sm py-8">Tidak ada pelaksanaan CP pada rentang ini.</td></tr>
            ) : perCp.map(r => (
              <tr key={r.id_template}>
                <td className={td}>{r.nama_cp}</td>
                <td className={`${td} text-xs text-slate-500`}>{r.kode_icd10 || "-"}</td>
                <td className={`${td} text-center tabular-nums`}>{r.kasus}</td>
                <td className={`${td} text-center tabular-nums`}>{r.item_done}</td>
                <td className={`${td} text-center tabular-nums`}>{r.item_total}</td>
                <td className={`${td} text-center font-bold tabular-nums ${warnaPersen(r.persen)}`}>{r.persen}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail per pasien */}
      {detail.length > 0 && (
        <div className="no-print">
          <button onClick={() => setShowDetail(v => !v)} className="text-sm font-semibold text-teal-700 hover:underline">
            {showDetail ? "▾ Sembunyikan" : "▸ Tampilkan"} detail per pasien ({detail.length})
          </button>
          {showDetail && (
            <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50"><tr>
                  <th className={th}>Tgl Mulai</th><th className={th}>No. Rawat</th><th className={th}>Pasien</th>
                  <th className={th}>Clinical Pathway</th><th className={`${th} text-center`}>Done/Total</th><th className={`${th} text-center`}>%</th>
                </tr></thead>
                <tbody>
                  {detail.map((d, i) => (
                    <tr key={i}>
                      <td className={`${td} whitespace-nowrap`}>{toDMY(d.tgl_mulai)}</td>
                      <td className={`${td} text-xs text-slate-500 whitespace-nowrap`}>{d.no_rawat}</td>
                      <td className={td}>{d.nm_pasien}</td>
                      <td className={`${td} text-xs`}>{d.nama_cp}</td>
                      <td className={`${td} text-center tabular-nums`}>{d.item_done}/{d.item_total}</td>
                      <td className={`${td} text-center font-bold tabular-nums ${warnaPersen(d.persen)}`}>{d.persen}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-slate-400 no-print">
        Catatan: item "pending" (termasuk hari yang belum tiba untuk pasien yang masih dirawat) dihitung belum dilakukan, sehingga % bisa lebih rendah untuk episode yang masih berjalan.
      </p>

      <style jsx global>{`
        @media print { .no-print { display: none !important; } @page { size: A4 portrait; margin: 12mm; } }
      `}</style>
    </div>
  );
}
