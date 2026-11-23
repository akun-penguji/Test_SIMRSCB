"use client";
import { useCallback, useEffect, useState } from "react";
import { getApsRekap, ApsRekap } from "@/lib/api";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const TW = ["TW-1", "TW-2", "TW-3", "TW-4"];
const nf = (n: number) => n.toLocaleString("id-ID");

export default function ApsRekapPage() {
  const nowYear = new Date().getFullYear();
  const [tahun, setTahun] = useState(nowYear);
  const [data, setData] = useState<ApsRekap | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { const r = await getApsRekap(tahun); setData(r.data); }
    catch { setErr("Gagal memuat data."); setData(null); }
    finally { setLoading(false); }
  }, [tahun]);
  useEffect(() => { load(); }, [load]);

  const r = data?.ringkasan;
  const yearOpts = [nowYear, nowYear - 1, nowYear - 2];

  return (
    <div className="space-y-4 p-1">
      <div className="hidden print:block text-center mb-3">
        <div className="font-bold text-lg">REKAPITULASI PASIEN PULANG ATAS PERMINTAAN SENDIRI (APS)</div>
        <div className="text-sm">RSUD Cabangbungin — Tahun {tahun}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Rekap Pasien Pulang APS</h1>
          <p className="text-sm text-slate-500">Pulang atas permintaan sendiri — rekap per bulan &amp; triwulan (AKP 5.1)</p>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))}
            className="border rounded-lg px-2 py-1 text-sm">
            {yearOpts.map(y => <option key={y} value={y}>Tahun {y}</option>)}
          </select>
          <button onClick={() => load()} disabled={loading}
            className="text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
            {loading ? "Memuat…" : "Segarkan"}
          </button>
          <button onClick={() => window.print()}
            className="text-sm font-semibold bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-3 py-1.5">🖨 Cetak / Simpan PDF</button>
        </div>
      </div>

      {err && <div className="text-center text-rose-500 py-4">{err}</div>}

      {r && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Total Pulang APS (tahun)" value={nf(r.total)} sub="status pulang paksa/APS" />
            <Card label="Ada Surat Pernyataan" value={nf(r.ada_surat)} sub={`${nf(r.tanpa_surat)} belum ada surat`} tone="slate" />
            <Card label="Bukti Lengkap" value={nf(r.bukti_lengkap)} tone="teal" sub="surat + TTD pasien & saksi" />
            <Card label="Belum Lengkap" value={nf(r.belum_lengkap)} tone="rose" sub="surat/TTD kurang" />
          </div>

          {/* Rekap per bulan & triwulan */}
          <div className="bg-white rounded-xl border p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">Rekap per Bulan &amp; Triwulan — {data.tahun}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b">
                    {BULAN.map(b => <th key={b} className="px-2 py-2 text-right">{b}</th>)}
                    <th className="px-2 py-2 text-right font-bold border-l">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {data.per_bulan.map((v, i) => (
                      <td key={i} className={`px-2 py-2 text-right tabular-nums ${v === 0 ? "text-slate-300" : "text-slate-700"}`}>{v === 0 ? "–" : nf(v)}</td>
                    ))}
                    <td className="px-2 py-2 text-right tabular-nums font-bold text-teal-700 border-l">{nf(r.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-4 gap-3 mt-3">
              {data.per_triwulan.map((v, i) => (
                <div key={i} className="border rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500">{TW[i]}</div>
                  <div className="text-xl font-bold tabular-nums text-slate-800">{nf(v)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Rincian */}
          <div className="bg-white rounded-xl border p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">Rincian Pasien Pulang APS {data.tahun}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b">
                    <th className="py-2 pr-3">Tgl Pulang</th>
                    <th className="py-2 px-3">Pasien</th>
                    <th className="py-2 px-3">Status Pulang</th>
                    <th className="py-2 px-3">Bangsal</th>
                    <th className="py-2 px-3">DPJP</th>
                    <th className="py-2 px-3 text-center">Surat</th>
                    <th className="py-2 px-3 text-center">TTD Pasien/PJ</th>
                    <th className="py-2 px-3 text-center">TTD Saksi</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pasien.length === 0 && (
                    <tr><td colSpan={9} className="text-center text-slate-400 py-8">Tidak ada data APS untuk tahun ini.</td></tr>
                  )}
                  {data.pasien.map((p) => {
                    const lengkap = p.ada_surat === 1 && p.ttd_pembuat === 1 && p.ttd_saksi === 1;
                    const status = p.ada_surat !== 1 ? { txt: "Belum ada surat", cls: "bg-rose-100 text-rose-700 border-rose-200" }
                      : lengkap ? { txt: "Lengkap", cls: "bg-teal-100 text-teal-700 border-teal-200" }
                      : { txt: "Sebagian", cls: "bg-amber-100 text-amber-700 border-amber-200" };
                    return (
                      <tr key={p.no_rawat} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-3 tabular-nums text-slate-600 whitespace-nowrap">{p.tgl_pulang || "–"}</td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-slate-700">{p.nm_pasien || "–"}</div>
                          <div className="text-[11px] text-slate-400">{p.no_rkm_medis} · {p.no_rawat}</div>
                        </td>
                        <td className="py-2 px-3 text-slate-600 text-xs">{p.stts_pulang || "–"}</td>
                        <td className="py-2 px-3 text-slate-600">{p.nm_bangsal || "–"}</td>
                        <td className="py-2 px-3 text-slate-600">{p.dpjp || "–"}</td>
                        <td className="py-2 px-3 text-center">{p.ada_surat === 1 ? "✓" : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 px-3 text-center">{p.ttd_pembuat === 1 ? "✓" : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 px-3 text-center">{p.ttd_saksi === 1 ? "✓" : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${status.cls}`}>{status.txt}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              Sumber: surat pernyataan pulang APS + bukti TTD pasien/PJ &amp; saksi keluarga. &quot;Lengkap&quot; = surat pernyataan ada dan kedua tanda tangan tercatat.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: string }) {
  const ring: Record<string, string> = { default: "border-slate-200", teal: "border-teal-200", rose: "border-rose-200", slate: "border-slate-200" };
  const val: Record<string, string> = { default: "text-slate-800", teal: "text-teal-700", rose: "text-rose-700", slate: "text-slate-700" };
  return (
    <div className={`bg-white rounded-xl border ${ring[tone]} p-4`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${val[tone]}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}
