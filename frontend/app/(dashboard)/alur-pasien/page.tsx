"use client";
import { useCallback, useEffect, useState } from "react";
import { getAlurPasienStatus, AlurPasienStatus } from "@/lib/api";

const nf = (n: number) => n.toLocaleString("id-ID");
const pct = (isi: number, total: number) => (total > 0 ? (isi * 100) / total : 0);
function nowStr() {
  const d = new Date();
  return d.toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AlurPasienPage() {
  const [data, setData] = useState<AlurPasienStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [updated, setUpdated] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await getAlurPasienStatus();
      setData(r.data);
      setUpdated(nowStr());
    } catch {
      setErr("Gagal memuat data alur pasien.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // segarkan tiap 60 dtk
    return () => clearInterval(t);
  }, [load]);

  const r = data?.ringkasan;

  return (
    <div className="space-y-4 p-1">
      <div className="hidden print:block text-center mb-3">
        <div className="font-bold text-lg">PENGELOLAAN ALUR PASIEN</div>
        <div className="text-sm">RSUD Cabangbungin — {new Date().toLocaleDateString("id-ID")}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Pengelolaan Alur Pasien</h1>
          <p className="text-sm text-slate-500">Ketersediaan tempat tidur &amp; pencegahan penumpukan — AKP 2.1</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {updated && <span className="text-xs text-slate-400">Diperbarui {updated}</span>}
          <button onClick={() => load()} disabled={loading}
            className="text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
            {loading ? "Memuat…" : "Segarkan"}
          </button>
          <button onClick={() => window.print()}
            className="text-sm font-semibold bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-3 py-1.5">Cetak</button>
        </div>
      </div>

      {err && <div className="text-center text-rose-500 py-4">{err}</div>}

      {r && (
        <>
          {/* Kartu ringkasan */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Total Tempat Tidur" value={nf(r.total_tt)} sub="TT aktif" />
            <Card label="Terpakai" value={nf(r.terpakai)} sub={`BOR ${r.bor_persen.toFixed(1)}%`}
              tone={r.bor_persen >= 85 ? "rose" : r.bor_persen >= 70 ? "amber" : "teal"} />
            <Card label="Tersedia" value={nf(r.tersedia)} sub="TT kosong siap pakai" tone="teal" />
            <Card label="Sensus Ranap Aktif" value={nf(r.ranap_aktif)} sub="pasien dirawat" tone="slate" />
            <Card label="Kunjungan IGD Hari Ini" value={nf(r.igd_hari_ini)} sub="registrasi IGD" tone="slate" />
            <Card label="IGD Menunggu TT" value={nf(r.igd_menunggu_tt)}
              sub={r.igd_menunggu_tt > 0 ? "perlu perhatian MPP" : "tidak ada boarding"}
              tone={r.igd_menunggu_tt > 0 ? "rose" : "teal"} />
          </div>

          {/* BOR keseluruhan */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-slate-700">Keterisian Keseluruhan (BOR)</div>
              <div className="text-sm font-bold tabular-nums text-slate-700">{r.bor_persen.toFixed(1)}%</div>
            </div>
            <div className="flex h-6 rounded-lg overflow-hidden bg-slate-100">
              <div className={`h-full ${r.bor_persen >= 85 ? "bg-rose-500" : r.bor_persen >= 70 ? "bg-amber-500" : "bg-teal-500"}`}
                style={{ width: `${r.bor_persen}%` }} title={`Terpakai ${nf(r.terpakai)} dari ${nf(r.total_tt)}`} />
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Ambang: ≥85% padat (merah), 70–85% waspada (kuning).</div>
          </div>

          {/* Per kelas */}
          <div className="bg-white rounded-xl border p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">Ketersediaan per Kelas</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data!.per_kelas.map((k, i) => {
                const p = pct(k.isi, k.total);
                return (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">{k.kelas || "–"}</span>
                      <span className="text-xs tabular-nums text-slate-500">{p.toFixed(0)}%</span>
                    </div>
                    <div className="flex h-3 rounded overflow-hidden bg-slate-100 mt-1.5">
                      <div className={`h-full ${p >= 85 ? "bg-rose-500" : p >= 70 ? "bg-amber-500" : "bg-teal-500"}`}
                        style={{ width: `${p}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 mt-1.5 tabular-nums">
                      <span>Isi {nf(k.isi)}</span>
                      <span className="font-semibold text-teal-700">Kosong {nf(k.kosong)}</span>
                      <span>Total {nf(k.total)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail per bangsal */}
          <div className="bg-white rounded-xl border p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">Detail per Bangsal</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b">
                    <th className="py-2 pr-3">Bangsal</th>
                    <th className="py-2 px-3">Kelas</th>
                    <th className="py-2 px-3 text-right">Total</th>
                    <th className="py-2 px-3 text-right">Isi</th>
                    <th className="py-2 px-3 text-right">Kosong</th>
                    <th className="py-2 pl-3 w-40">Keterisian</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.bangsal.map((b, i) => {
                    const p = pct(b.isi, b.total);
                    return (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium text-slate-700">{b.nm_bangsal}</td>
                        <td className="py-2 px-3 text-slate-600">{b.kelas || "–"}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{nf(b.total)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{nf(b.isi)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums font-semibold ${b.kosong === 0 ? "text-rose-600" : "text-teal-700"}`}>{nf(b.kosong)}</td>
                        <td className="py-2 pl-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2.5 rounded bg-slate-100 overflow-hidden">
                              <div className={`h-full ${p >= 85 ? "bg-rose-500" : p >= 70 ? "bg-amber-500" : "bg-teal-500"}`} style={{ width: `${p}%` }} />
                            </div>
                            <span className="text-[11px] tabular-nums text-slate-500 w-9 text-right">{p.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: string }) {
  const ring: Record<string, string> = {
    default: "border-slate-200", teal: "border-teal-200", amber: "border-amber-200", slate: "border-slate-200", rose: "border-rose-200",
  };
  const val: Record<string, string> = {
    default: "text-slate-800", teal: "text-teal-700", amber: "text-amber-700", slate: "text-slate-800", rose: "text-rose-700",
  };
  return (
    <div className={`bg-white rounded-xl border ${ring[tone]} p-4`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${val[tone]}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}
