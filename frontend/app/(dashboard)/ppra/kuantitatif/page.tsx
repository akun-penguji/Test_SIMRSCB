"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ppraKuantitatif, ppraEksporKuantitatifCsv, PpraKuantitatif } from "@/lib/api";

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function quarterStart(): string {
  const n = new Date();
  return fmt(new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1));
}

const AWARE_COLOR: Record<string, string> = {
  access: "bg-emerald-500", watch: "bg-amber-500", reserve: "bg-red-500", not_recommended: "bg-slate-400",
};
const AWARE_BADGE: Record<string, string> = {
  Access: "bg-emerald-100 text-emerald-800", Watch: "bg-amber-100 text-amber-800",
  Reserve: "bg-red-100 text-red-800", Not_recommended: "bg-slate-200 text-slate-700",
};
const nf = (v: number, d = 2) => v.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function PpraKuantitatifPage() {
  const [jenis, setJenis] = useState<"ranap" | "ralan">("ranap");
  const [tglAwal, setTglAwal] = useState(quarterStart());
  const [tglAkhir, setTglAkhir] = useState(fmt(new Date()));
  const [data, setData] = useState<PpraKuantitatif | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    ppraKuantitatif({ tgl_awal: tglAwal, tgl_akhir: tglAkhir, jenis })
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.error ?? "Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [tglAwal, tglAkhir, jenis]);
  useEffect(() => { load(); }, [load]);

  const perAb = useMemo(
    () => [...(data?.per_antibiotik ?? [])].sort((a, b) => b.total_ddd - a.total_ddd),
    [data]);

  const aware = data?.ringkasan.aware;
  const total = aware?.total ?? 0;
  const seg = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/klpcm" className="text-slate-400 hover:text-slate-600">‹</Link>
        <h1 className="text-2xl font-bold text-slate-800">Surveilans Kuantitatif Antibiotik</h1>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        DDD/100 patient-days (ranap) &amp; DDD/1000 populations (ralan), AWaRe, DU90%.
        <Link href="/ppra/mapping" className="text-indigo-600 hover:underline ml-1">→ Mapping</Link>
      </p>

      {/* Filter */}
      <div className="flex flex-wrap items-end gap-3 mb-4 bg-white border border-slate-200 rounded-lg p-3">
        <label className="text-sm">
          <span className="block text-slate-500 mb-1">Dari</span>
          <input type="date" value={tglAwal} onChange={e => setTglAwal(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
        </label>
        <label className="text-sm">
          <span className="block text-slate-500 mb-1">Sampai</span>
          <input type="date" value={tglAkhir} onChange={e => setTglAkhir(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
        </label>
        <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-sm">
          {(["ranap", "ralan"] as const).map(j => (
            <button key={j} onClick={() => setJenis(j)}
              className={`px-4 py-1.5 ${jenis === j ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              {j === "ranap" ? "Rawat Inap" : "Rawat Jalan"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => ppraEksporKuantitatifCsv({ tgl_awal: tglAwal, tgl_akhir: tglAkhir, jenis }).catch(() => {})}
            className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg px-4 py-1.5 hover:bg-slate-50">⬇ CSV</button>
          <Link href={`/ppra/laporan?jenis=${jenis}&tgl_awal=${tglAwal}&tgl_akhir=${tglAkhir}`}
            className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg px-4 py-1.5 hover:bg-slate-50">🖨 Laporan</Link>
          <button onClick={load} className="bg-slate-800 text-white text-sm rounded-lg px-4 py-1.5 hover:bg-slate-900">Terapkan</button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-3">{error}</div>}
      {loading ? (
        <div className="text-center text-slate-400 py-12">Memuat…</div>
      ) : !data ? null : (
        <>
          {/* Kartu ringkasan */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card label="Total DDD" value={nf(data.ringkasan.total_ddd)} />
            <Card label={data.denominator.label === "hari_rawat" ? "Hari Rawat" : "Kunjungan"} value={nf(data.denominator.nilai, 0)} />
            <Card label={data.denominator.label === "hari_rawat" ? "DDD / 100 patient-days" : "DDD / 1000 populasi"}
              value={nf(data.ringkasan.rasio)} accent />
            <Card label={`AWaRe Access (target ${nf(aware?.target_persen ?? 60, 0)}%)`}
              value={`${nf(aware?.access_persen ?? 0, 1)}%`}
              ok={aware?.memenuhi_target} bad={!aware?.memenuhi_target} />
          </div>

          {/* AWaRe breakdown */}
          {total > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Distribusi AWaRe (berdasarkan Total DDD)</h2>
              <div className="flex h-5 rounded overflow-hidden mb-2">
                {(["access", "watch", "reserve", "not_recommended"] as const).map(k => {
                  const v = aware ? (aware[k] as number) : 0;
                  return seg(v) > 0 ? <div key={k} className={AWARE_COLOR[k]} style={{ width: `${seg(v)}%` }} title={`${k}: ${nf(v)} DDD`} /> : null;
                })}
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                {(["access", "watch", "reserve", "not_recommended"] as const).map(k => (
                  <span key={k} className="inline-flex items-center gap-1">
                    <span className={`w-3 h-3 rounded-sm ${AWARE_COLOR[k]}`} />
                    {k === "not_recommended" ? "Not recommended" : k[0].toUpperCase() + k.slice(1)}: {nf(aware ? (aware[k] as number) : 0)} ({nf(seg(aware ? (aware[k] as number) : 0), 1)}%)
                  </span>
                ))}
              </div>
            </div>
          )}

          {perAb.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3 mb-4">
              Tidak ada konsumsi antibiotik pada periode ini — atau obat belum dimapping.
              <Link href="/ppra/mapping" className="underline ml-1">Cek mapping</Link>.
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Tabel DDD per antibiotik */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 text-sm font-semibold text-slate-700 border-b border-slate-100">
                  {data.denominator.label === "hari_rawat" ? "Tabel B — DDD/100 patient-days" : "Tabel C — DDD/1000 populasi"}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-left">
                      <tr><th className="px-3 py-2">Antibiotik</th><th className="px-3 py-2">AWaRe</th>
                        <th className="px-3 py-2 text-right">Konsumsi</th><th className="px-3 py-2 text-right">Total DDD</th></tr>
                    </thead>
                    <tbody>
                      {perAb.map(a => (
                        <tr key={`${a.atc_code}-${a.adm_route}`} className="border-t border-slate-100">
                          <td className="px-3 py-1.5">{a.nama_generik}<span className="text-xs text-slate-400 ml-1">{a.atc_code}/{a.adm_route}</span></td>
                          <td className="px-3 py-1.5"><span className={`text-xs px-2 py-0.5 rounded ${AWARE_BADGE[a.aware_kategori] ?? ""}`}>{a.aware_kategori}</span></td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs">{nf(a.konsumsi)}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{nf(a.total_ddd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DU90% */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 text-sm font-semibold text-slate-700 border-b border-slate-100">
                  DU90% — {data.du90.filter(d => d.dalam_du90).length} antibiotik menyumbang 90% pemakaian
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-left">
                      <tr><th className="px-3 py-2">Antibiotik</th><th className="px-3 py-2 w-1/3">%</th>
                        <th className="px-3 py-2 text-right">Kumulatif</th></tr>
                    </thead>
                    <tbody>
                      {data.du90.map(d => (
                        <tr key={`${d.atc_code}-${d.adm_route}`} className={`border-t border-slate-100 ${d.dalam_du90 ? "" : "opacity-50"}`}>
                          <td className="px-3 py-1.5">{d.nama_generik}</td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded"><div className={`h-2 rounded ${d.dalam_du90 ? "bg-indigo-500" : "bg-slate-300"}`} style={{ width: `${Math.min(d.persen, 100)}%` }} /></div>
                              <span className="text-xs font-mono text-slate-500 w-12 text-right">{nf(d.persen, 1)}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs">{nf(d.kumulatif_persen, 1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400 mt-4 border-t border-slate-100 pt-3">{data.disclaimer}</p>
        </>
      )}
    </div>
  );
}

function Card({ label, value, accent, ok, bad }: { label: string; value: string; accent?: boolean; ok?: boolean; bad?: boolean }) {
  const tone = ok ? "text-emerald-600" : bad ? "text-red-600" : accent ? "text-indigo-600" : "text-slate-800";
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}
