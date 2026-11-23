"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  klpcmListAudit, klpcmSampling, klpcmLaporan, klpcmDeleteAudit,
  KlpcmAudit, KlpcmLaporan, KlpcmStatus,
} from "@/lib/api";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_COLOR: Record<KlpcmStatus, string> = {
  draft:  "bg-amber-100 text-amber-800 border-amber-300",
  final:  "bg-emerald-100 text-emerald-800 border-emerald-300",
  revisi: "bg-sky-100 text-sky-800 border-sky-300",
};

function scoreClass(s: number) {
  if (s >= 80) return "text-emerald-700 font-bold";
  if (s >= 60) return "text-amber-700 font-semibold";
  return "text-rose-700 font-bold";
}

export default function KlpcmLandingPage() {
  const [bulan, setBulan]     = useState(thisMonth());
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [q, setQ]             = useState("");
  const [audits, setAudits]   = useState<KlpcmAudit[]>([]);
  const [laporan, setLaporan] = useState<KlpcmLaporan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [msg, setMsg]         = useState<{ type: "ok"|"err"; text: string } | null>(null);
  const [samplingN, setSamplingN] = useState(50);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      klpcmListAudit({ bulan, status: statusFilter, q }),
      klpcmLaporan(bulan),
    ])
      .then(([a, l]) => { setAudits(a.data); setLaporan(l.data); })
      .catch(() => setMsg({ type: "err", text: "Gagal memuat data" }))
      .finally(() => setLoading(false));
  }, [bulan, statusFilter, q]);

  useEffect(() => { reload(); }, [reload]);

  const handleSampling = async () => {
    if (!confirm(`Generate ${samplingN} sampel audit RM untuk bulan ${bulan}? (sampel yang sudah ada akan di-skip)`)) return;
    setBusy(true); setMsg(null);
    try {
      const r = await klpcmSampling(bulan, samplingN);
      setMsg({ type: "ok",
        text: `✓ ${r.data.inserted} audit baru dibuat, ${r.data.skipped} di-skip (sudah ada)${r.data.message ? " — " + r.data.message : ""}`});
      reload();
    } catch (e) {
      setMsg({ type: "err", text: `Gagal sampling: ${(e as Error).message}` });
    } finally { setBusy(false); }
  };

  const handleDelete = async (a: KlpcmAudit) => {
    if (!confirm(`Hapus audit RM ${a.no_rawat} (${a.nama_pasien ?? "-"})?`)) return;
    try {
      await klpcmDeleteAudit(a.id);
      reload();
    } catch { setMsg({ type: "err", text: "Gagal menghapus" }); }
  };

  const r = laporan?.ringkasan;
  const filledRate = useMemo(() => {
    if (!r || r.total_audit === 0) return 0;
    return (r.final / r.total_audit) * 100;
  }, [r]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <nav className="text-xs mb-4">
        <Link href="/akreditasi" className="text-indigo-600 hover:underline">← Akreditasi</Link>
      </nav>

      <header className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">KLPCM — Ketidaklengkapan Pengisian Catatan Medis</h1>
          <p className="text-sm text-slate-600 mt-1">
            Audit sampling rekam medis pasien pulang per bulan. Bukti untuk standar MRMIK 12.b / 12.c / 12.d & 8.d STARKES.
          </p>
        </div>
      </header>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
          msg.type === "ok"
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : "bg-rose-50 text-rose-700 border-rose-200"
        }`}>{msg.text}</div>
      )}

      {/* Indikator resmi Kamus Mutu Unit Kerja F.2 — Kelengkapan Pengisian RM 24 Jam */}
      <div className="mb-4 rounded-xl border border-teal-300 bg-teal-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-teal-700">Indikator Mutu RM — Kelengkapan Pengisian RM ≤ 24 Jam (Kamus Mutu F.2)</div>
            <div className="text-[11px] text-teal-600">% RM Lengkap = RM dengan SEMUA komponen lengkap ÷ RM disurvei. Target 100%.</div>
          </div>
          <div className="flex items-end gap-4">
            <div className="text-right">
              <div className="text-[11px] text-slate-500">RM Lengkap / Disurvei</div>
              <div className="text-lg font-bold text-slate-800 tabular-nums">{r?.rm_lengkap ?? 0} / {r?.total_audit ?? 0}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500">Capaian (target 100%)</div>
              <div className={`text-3xl font-bold tabular-nums ${(r?.pct_rm_lengkap ?? 0) >= 100 ? "text-emerald-600" : (r?.pct_rm_lengkap ?? 0) >= 80 ? "text-amber-600" : "text-red-600"}`}>
                {(r?.pct_rm_lengkap ?? 0).toFixed(1)}%
              </div>
            </div>
            <div className="text-right border-l border-teal-300 pl-4">
              <div className="text-[11px] text-slate-500">% Ketidaklengkapan (KLPCM)</div>
              <div className={`text-3xl font-bold tabular-nums ${(r?.pct_ketidaklengkapan ?? 0) <= 0 ? "text-emerald-600" : (r?.pct_ketidaklengkapan ?? 0) <= 20 ? "text-amber-600" : "text-red-600"}`}>
                {(r?.pct_ketidaklengkapan ?? 0).toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-400 tabular-nums">{r?.rm_tidak_lengkap ?? 0} RM tidak lengkap</div>
            </div>
          </div>
        </div>
      </div>

      {/* Indikator resmi Kamus Mutu Unit Kerja F.5 — Kelengkapan Informed Consent */}
      <div className="mb-5 rounded-xl border border-teal-300 bg-teal-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-teal-700">Indikator Mutu RM — Kelengkapan Informed Consent (Kamus Mutu F.5)</div>
            <div className="text-[11px] text-teal-600">% IC Lengkap = RM (dg tindakan) yang informed consent-nya lengkap ÷ RM disurvei yang memiliki komponen IC. Target 100%.</div>
          </div>
          <div className="flex items-end gap-4">
            <div className="text-right">
              <div className="text-[11px] text-slate-500">IC Lengkap / Disurvei</div>
              <div className="text-lg font-bold text-slate-800 tabular-nums">{r?.ic_lengkap ?? 0} / {r?.ic_audit ?? 0}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500">Capaian (target 100%)</div>
              <div className={`text-3xl font-bold tabular-nums ${(r?.pct_ic_lengkap ?? 0) >= 100 ? "text-emerald-600" : (r?.pct_ic_lengkap ?? 0) >= 80 ? "text-amber-600" : "text-red-600"}`}>
                {(r?.pct_ic_lengkap ?? 0).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat ringkasan bulan (analitik internal: rata-rata kelengkapan per komponen) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="text-xs text-blue-700">Total audit bulan ini</div>
          <div className="text-2xl font-bold text-slate-900">{r?.total_audit ?? 0}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
          <div className="text-xs text-emerald-700">Final</div>
          <div className="text-2xl font-bold text-slate-900">{r?.final ?? 0} <span className="text-xs text-slate-500">({filledRate.toFixed(0)}%)</span></div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded p-3">
          <div className="text-xs text-amber-700">Draft (belum selesai)</div>
          <div className="text-2xl font-bold text-slate-900">{r?.draft ?? 0}</div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded p-3">
          <div className="text-xs text-rose-700">Score &lt; 80% (target)</div>
          <div className="text-2xl font-bold text-slate-900">{r?.bawah_target_80 ?? 0}</div>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded p-3">
          <div className="text-xs text-indigo-700">Rata-rata skor total</div>
          <div className={`text-2xl tabular-nums ${scoreClass(r?.avg_total ?? 0)}`}>
            {(r?.avg_total ?? 0).toFixed(1)}%
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-600">Target Kemkes</div>
          <div className="text-2xl font-bold text-slate-700">≥ {r?.target_pct ?? 80}%</div>
        </div>
      </div>

      {/* Per kategori bar */}
      {r && r.total_audit > 0 && (
        <div className="bg-white border border-slate-200 rounded p-4 mb-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Rata-rata skor per kategori</h3>
          <div className="space-y-2">
            {[
              ["Identitas",  r.avg_identitas],
              ["Anamnesa",   r.avg_anamnesa],
              ["Pengkajian", r.avg_pengkajian],
              ["DPJP",       r.avg_dpjp],
              ["Resume",     r.avg_resume],
            ].map(([nama, sc]) => (
              <div key={nama as string} className="flex items-center gap-3 text-sm">
                <div className="w-24 text-slate-600">{nama}</div>
                <div className="flex-1 bg-slate-100 rounded h-5 overflow-hidden">
                  <div className={`h-full rounded ${(sc as number) >= 80 ? "bg-emerald-500" : (sc as number) >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${Math.min(100, sc as number)}%` }} />
                </div>
                <div className={`w-16 text-right tabular-nums ${scoreClass(sc as number)}`}>{(sc as number).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter + sampling */}
      <div className="bg-white border border-slate-200 rounded p-4 mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-700 mb-1">Bulan</label>
          <input type="month" value={bulan} onChange={e => setBulan(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
        </div>
        <div>
          <label className="block text-xs text-slate-700 mb-1">Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm text-slate-900">
            <option value="">Semua</option>
            <option value="draft">Draft</option>
            <option value="final">Final</option>
            <option value="revisi">Revisi</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-700 mb-1">Cari pasien / no_rawat</label>
          <input type="text" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Nama atau no_rawat..."
            className="w-56 border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
        </div>
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="block text-xs text-slate-700 mb-1">Jumlah sampel</label>
            <input type="number" min={1} max={500} value={samplingN}
              onChange={e => setSamplingN(Number(e.target.value) || 50)}
              className="w-20 border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 text-right" />
          </div>
          <button onClick={handleSampling} disabled={busy}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm px-4 py-2 rounded disabled:opacity-50">
            {busy ? "Memproses..." : "🎲 Generate Sampling"}
          </button>
        </div>
      </div>

      {/* List audit */}
      {loading ? (
        <div className="text-slate-500 text-sm">Memuat...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-3 py-2 text-slate-700">No RM / No Rawat</th>
                <th className="text-left px-3 py-2 text-slate-700">Pasien</th>
                <th className="text-left px-3 py-2 text-slate-700">Bangsal</th>
                <th className="text-left px-3 py-2 text-slate-700">DPJP</th>
                <th className="text-left px-3 py-2 text-slate-700">Keluar</th>
                <th className="text-right px-3 py-2 text-slate-700">Skor</th>
                <th className="text-center px-3 py-2 text-slate-700">Status</th>
                <th className="text-right px-3 py-2 text-slate-700">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {audits.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-slate-400 py-8">
                  Tidak ada audit. Klik <strong>🎲 Generate Sampling</strong> untuk membuat batch.
                </td></tr>
              ) : audits.map(a => (
                <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-900">
                    <div className="font-mono text-xs">{a.no_rkm_medis ?? "-"}</div>
                    <div className="font-mono text-xs text-slate-500">{a.no_rawat}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-900">{a.nama_pasien ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-700 text-xs">{a.bangsal ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-700 text-xs">{a.dpjp ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-700 text-xs">{a.tgl_keluar ?? "-"}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${scoreClass(a.score_total)}`}>
                    {a.score_total.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLOR[a.status]}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Link href={`/klpcm/audit/${a.id}`}
                      className="text-blue-600 hover:underline text-xs mr-3">Audit</Link>
                    <button onClick={() => handleDelete(a)}
                      className="text-rose-600 hover:underline text-xs">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {laporan && laporan.score_terendah.length > 0 && (
        <details className="mt-5 bg-rose-50 border border-rose-200 rounded p-3">
          <summary className="cursor-pointer text-sm font-semibold text-rose-800">
            🔻 10 audit dengan skor terendah bulan ini ({laporan.score_terendah.length})
          </summary>
          <ul className="mt-3 space-y-1 text-xs">
            {laporan.score_terendah.map(s => (
              <li key={s.id} className="flex items-center justify-between">
                <span>
                  <Link href={`/klpcm/audit/${s.id}`} className="text-rose-700 hover:underline font-mono">{s.no_rawat}</Link>
                  {" · "}{s.nama_pasien ?? "-"}{" · "}{s.bangsal ?? "-"}
                </span>
                <span className={scoreClass(s.score_total)}>{s.score_total.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
