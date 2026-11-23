"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getInfoTerintegrasiStatus, InfoTerintegrasiStatus, InfoTerintegrasiPasien } from "@/lib/api";

const nf = (n: number) => n.toLocaleString("id-ID");
function nowStr() {
  return new Date().toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
type Kelas = "belum" | "terlambat" | "terkini";
function klasifikasi(p: InfoTerintegrasiPasien, interval: number): Kelas {
  if (p.jam_sejak == null) return "belum";
  return p.jam_sejak > interval ? "terlambat" : "terkini";
}
const badge: Record<Kelas, { txt: string; cls: string }> = {
  belum: { txt: "Belum ada info", cls: "bg-rose-100 text-rose-700 border-rose-200" },
  terlambat: { txt: "Terlambat", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  terkini: { txt: "Terkini", cls: "bg-teal-100 text-teal-700 border-teal-200" },
};
function lamaJam(j: number | null): string {
  if (j == null) return "–";
  if (j < 24) return `${j} jam lalu`;
  return `${Math.floor(j / 24)} hr ${j % 24} jam lalu`;
}

export default function InfoTerintegrasiPage() {
  const [data, setData] = useState<InfoTerintegrasiStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [updated, setUpdated] = useState("");
  const [interval, setIntervalJam] = useState(24);
  const [hanyaPerhatian, setHanyaPerhatian] = useState(false);
  const [cari, setCari] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await getInfoTerintegrasiStatus(interval);
      setData(r.data);
      setUpdated(nowStr());
    } catch {
      setErr("Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, [interval]);

  useEffect(() => { load(); }, [load]);

  const r = data?.ringkasan;
  const rows = useMemo(() => {
    if (!data) return [];
    const q = cari.trim().toLowerCase();
    return data.pasien.filter((p) => {
      if (hanyaPerhatian && klasifikasi(p, data.interval_jam) === "terkini") return false;
      if (!q) return true;
      return (p.nm_pasien || "").toLowerCase().includes(q)
        || (p.no_rkm_medis || "").toLowerCase().includes(q)
        || p.no_rawat.toLowerCase().includes(q)
        || (p.nm_bangsal || "").toLowerCase().includes(q);
    });
  }, [data, hanyaPerhatian, cari]);

  return (
    <div className="space-y-4 p-1">
      <div className="hidden print:block text-center mb-3">
        <div className="font-bold text-lg">INFORMASI TERINTEGRASI BERKALA KE PASIEN</div>
        <div className="text-sm">RSUD Cabangbungin — {new Date().toLocaleDateString("id-ID")}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Info Terintegrasi Berkala</h1>
          <p className="text-sm text-slate-500">Pemberian info perencanaan &amp; pelayanan terintegrasi ke pasien-keluarga — AKP 3</p>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {updated && <span className="text-xs text-slate-400">Diperbarui {updated}</span>}
          <label className="text-xs text-slate-500">Interval berkala
            <select value={interval} onChange={(e) => setIntervalJam(Number(e.target.value))}
              className="block border rounded-lg px-2 py-1 text-sm">
              <option value={24}>24 jam (harian)</option>
              <option value={48}>48 jam</option>
              <option value={72}>72 jam</option>
            </select>
          </label>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Pasien Ranap Aktif" value={nf(r.total_ranap)} sub="total dirawat" />
            <Card label="Terkini" value={nf(r.terkini)} sub={`ada info ≤ ${data!.interval_jam} jam`} tone="teal" />
            <Card label="Terlambat" value={nf(r.terlambat)} sub={`> ${data!.interval_jam} jam sejak info terakhir`} tone="amber" />
            <Card label="Belum Ada Info" value={nf(r.belum_pernah)} sub="belum pernah diinfokan" tone="rose" />
          </div>

          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm font-semibold text-slate-700">Daftar Pasien Ranap</div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 ml-auto">
                <input type="checkbox" checked={hanyaPerhatian} onChange={(e) => setHanyaPerhatian(e.target.checked)} />
                Hanya perlu perhatian ({nf(r.perlu_perhatian)})
              </label>
              <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama / RM / bangsal…"
                className="border rounded-lg px-2 py-1 text-sm w-48" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b">
                    <th className="py-2 pr-3">Pasien</th>
                    <th className="py-2 px-3">Bangsal / Kamar</th>
                    <th className="py-2 px-3">DPJP</th>
                    <th className="py-2 px-3 text-right">Lama</th>
                    <th className="py-2 px-3 text-center">CPPT</th>
                    <th className="py-2 px-3 text-center">Info Edukasi</th>
                    <th className="py-2 px-3">Info Terakhir</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 pl-3 no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={9} className="text-center text-slate-400 py-8">Tidak ada data.</td></tr>
                  )}
                  {rows.map((p) => {
                    const k = klasifikasi(p, data!.interval_jam);
                    const b = badge[k];
                    return (
                      <tr key={p.no_rawat} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-700">{p.nm_pasien || "–"}</div>
                          <div className="text-[11px] text-slate-400">{p.no_rkm_medis} · {p.no_rawat}</div>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{p.nm_bangsal || "–"}<div className="text-[11px] text-slate-400">{p.kelas || ""} {p.kd_kamar || ""}</div></td>
                        <td className="py-2 px-3 text-slate-600">{p.dpjp || "–"}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-slate-600">{p.lama_hari != null ? `${p.lama_hari} hr` : "–"}</td>
                        <td className="py-2 px-3 text-center tabular-nums text-slate-600">{nf(p.jml_cppt)}</td>
                        <td className="py-2 px-3 text-center tabular-nums font-semibold text-slate-700">{nf(p.jml_edukasi)}</td>
                        <td className="py-2 px-3 text-slate-600">
                          {p.terakhir_edukasi ? <>{p.terakhir_edukasi}<div className="text-[11px] text-slate-400">{lamaJam(p.jam_sejak)}</div></> : <span className="text-slate-400">belum ada</span>}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${b.cls}`}>{b.txt}</span>
                        </td>
                        <td className="py-2 pl-3 no-print">
                          <Link href={`/edukasi/${encodeURIComponent(p.no_rawat)}`}
                            className="text-xs font-semibold text-teal-700 hover:underline whitespace-nowrap">+ Info</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-[11px] text-slate-400">
              Sumber: catatan info/edukasi terintegrasi (materi edukasi pasien-keluarga) &amp; CPPT ranap. &quot;Info Edukasi&quot; = jumlah pemberian informasi berkala; &quot;CPPT&quot; = catatan asuhan terintegrasi.
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
