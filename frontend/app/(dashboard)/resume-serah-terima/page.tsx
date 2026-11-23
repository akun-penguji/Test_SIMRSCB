"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getResumeSerahTerimaMonitor, ResumeSerahTerimaMonitor, ResumePulangRow } from "@/lib/api";

const nf = (n: number) => n.toLocaleString("id-ID");
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysAgoStr(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
type Stat = "tanpa_resume" | "belum_serah" | "sebagian" | "lengkap";
function statusOf(p: ResumePulangRow): Stat {
  if (p.ada_resume !== 1) return "tanpa_resume";
  if (p.ada_foto === 1 && p.ada_ttd === 1) return "lengkap";
  if (p.ada_foto === 1 || p.ada_ttd === 1 || p.diserahkan_ke) return "sebagian";
  return "belum_serah";
}
const badge: Record<Stat, { txt: string; cls: string }> = {
  tanpa_resume: { txt: "Belum ada resume", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  belum_serah: { txt: "Belum serah terima", cls: "bg-rose-100 text-rose-700 border-rose-200" },
  sebagian: { txt: "Sebagian", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  lengkap: { txt: "Lengkap", cls: "bg-teal-100 text-teal-700 border-teal-200" },
};

export default function ResumeSerahTerimaPage() {
  const [data, setData] = useState<ResumeSerahTerimaMonitor | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [dari, setDari] = useState(daysAgoStr(7));
  const [sampai, setSampai] = useState(todayStr());
  const [hanyaPerhatian, setHanyaPerhatian] = useState(false);
  const [cari, setCari] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await getResumeSerahTerimaMonitor({ dari, sampai });
      setData(r.data);
    } catch {
      setErr("Gagal memuat data."); setData(null);
    } finally { setLoading(false); }
  }, [dari, sampai]);

  useEffect(() => { load(); }, [load]);

  const r = data?.ringkasan;
  const rows = useMemo(() => {
    if (!data) return [];
    const q = cari.trim().toLowerCase();
    return data.pasien.filter((p) => {
      const st = statusOf(p);
      if (hanyaPerhatian && (st === "lengkap")) return false;
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
        <div className="font-bold text-lg">KEPATUHAN SERAH TERIMA RESUME PULANG</div>
        <div className="text-sm">RSUD Cabangbungin — {dari} s/d {sampai}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Serah Terima Resume Pulang</h1>
          <p className="text-sm text-slate-500">Bukti resume diserahkan ke dokter keluarga/berikutnya — AKP 4</p>
        </div>
        <div className="flex items-end gap-2 ml-auto flex-wrap">
          <label className="text-xs text-slate-500">Dari
            <input type="date" value={dari} onChange={(e) => setDari(e.target.value)}
              className="block border rounded-lg px-2 py-1 text-sm" />
          </label>
          <label className="text-xs text-slate-500">Sampai
            <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)}
              className="block border rounded-lg px-2 py-1 text-sm" />
          </label>
          <button onClick={() => load()} disabled={loading}
            className="text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
            {loading ? "Memuat…" : "Terapkan"}
          </button>
          <button onClick={() => window.print()}
            className="text-sm font-semibold bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-3 py-1.5">Cetak</button>
        </div>
      </div>

      {err && <div className="text-center text-rose-500 py-4">{err}</div>}

      {r && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Pasien Pulang" value={nf(r.total_pulang)} sub={`${dari} → ${sampai}`} />
            <Card label="Sudah Ada Resume" value={nf(r.ada_resume)} sub={`${r.tanpa_resume} belum ada resume`} tone="slate" />
            <Card label="Serah Terima Lengkap" value={nf(r.serah_terima_lengkap)} sub="resume + foto + TTD" tone="teal" />
            <Card label="Belum Serah Terima" value={nf(r.belum_serah_terima)} sub="resume ada, bukti belum lengkap" tone="rose" />
          </div>

          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm font-semibold text-slate-700">Daftar Pasien Pulang</div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 ml-auto">
                <input type="checkbox" checked={hanyaPerhatian} onChange={(e) => setHanyaPerhatian(e.target.checked)} />
                Hanya belum lengkap
              </label>
              <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama / RM / bangsal…"
                className="border rounded-lg px-2 py-1 text-sm w-48" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b">
                    <th className="py-2 pr-3">Pasien</th>
                    <th className="py-2 px-3">Bangsal</th>
                    <th className="py-2 px-3">Tgl Pulang</th>
                    <th className="py-2 px-3 text-center">Resume</th>
                    <th className="py-2 px-3">Diserahkan ke</th>
                    <th className="py-2 px-3 text-center">Foto</th>
                    <th className="py-2 px-3 text-center">TTD</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-slate-400 py-8">Tidak ada data.</td></tr>
                  )}
                  {rows.map((p) => {
                    const st = statusOf(p); const b = badge[st];
                    return (
                      <tr key={p.no_rawat} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-700">{p.nm_pasien || "–"}</div>
                          <div className="text-[11px] text-slate-400">{p.no_rkm_medis} · {p.no_rawat}</div>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{p.nm_bangsal || "–"}</td>
                        <td className="py-2 px-3 text-slate-600 tabular-nums">{p.tgl_keluar || "–"}</td>
                        <td className="py-2 px-3 text-center">{p.ada_resume === 1 ? "✓" : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 px-3 text-slate-600">
                          {p.diserahkan_ke || <span className="text-slate-400">–</span>}
                          {p.nama_penerima && <div className="text-[11px] text-slate-400">{p.nama_penerima}</div>}
                        </td>
                        <td className="py-2 px-3 text-center">{p.ada_foto === 1 ? "✓" : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 px-3 text-center">{p.ada_ttd === 1 ? "✓" : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${b.cls}`}>{b.txt}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-[11px] text-slate-400">
              Bukti serah terima (foto + TTD + tujuan penyerahan) diisi petugas di E-Dokter/E-Nakes tab &quot;Serah Terima Resume&quot; per pasien.
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
