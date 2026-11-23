"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  klpcmDetail, klpcmUpdateTemuan, klpcmUpdateAudit, klpcmAutoCheck,
  KlpcmDetail, KlpcmKategori, KlpcmStatus,
} from "@/lib/api";

const KAT_LABEL: Record<KlpcmKategori, string> = {
  identitas:  "🪪 Identitas Pasien",
  anamnesa:   "📝 Anamnesa & Riwayat",
  pengkajian: "🩺 Pengkajian Awal",
  dpjp:       "👨‍⚕️ DPJP",
  resume:     "📄 Resume Pulang",
  informed_consent: "📋 Informed Consent (Kamus F.5)",
};

const KAT_COLOR: Record<KlpcmKategori, string> = {
  identitas:  "border-blue-300 bg-blue-50",
  anamnesa:   "border-purple-300 bg-purple-50",
  pengkajian: "border-emerald-300 bg-emerald-50",
  dpjp:       "border-amber-300 bg-amber-50",
  resume:     "border-rose-300 bg-rose-50",
  informed_consent: "border-teal-300 bg-teal-50",
};

function scoreClass(s: number) {
  if (s >= 80) return "text-emerald-700";
  if (s >= 60) return "text-amber-700";
  return "text-rose-700";
}

export default function KlpcmAuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const auditId = Number(id);
  const router = useRouter();
  const [data, setData] = useState<KlpcmDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ type: "ok"|"err"; text: string } | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    klpcmDetail(auditId)
      .then(r => setData(r.data))
      .catch(() => setMsg({ type: "err", text: "Gagal memuat audit" }))
      .finally(() => setLoading(false));
  }, [auditId]);

  useEffect(() => { reload(); }, [reload]);

  const toggle = async (tid: number, lengkap: number, catatan: string | null) => {
    setSavingId(tid);
    try {
      await klpcmUpdateTemuan(auditId, tid, { lengkap, catatan });
      reload();
    } catch { setMsg({ type: "err", text: "Gagal simpan" }); }
    finally { setSavingId(null); }
  };

  const updateStatus = async (status: KlpcmStatus) => {
    try {
      await klpcmUpdateAudit(auditId, { status });
      setMsg({ type: "ok", text: `Status diubah ke ${status}` });
      reload();
    } catch { setMsg({ type: "err", text: "Gagal update status" }); }
  };

  const runAutoCheck = async () => {
    if (!confirm("Re-scan Khanza untuk auto-deteksi item RM? Hanya item yang BELUM diisi manual atau sudah ber-label (auto:) yang akan diupdate.")) return;
    try {
      const r = await klpcmAutoCheck(auditId);
      setMsg({ type: "ok", text: `✓ Auto-check: ${r.data.items_ok}/${r.data.items_total} item terdeteksi (${r.data.items_updated} diupdate)` });
      reload();
    } catch { setMsg({ type: "err", text: "Gagal auto-check" }); }
  };

  if (loading || !data) {
    return <div className="p-6 text-slate-500 text-sm">Memuat...</div>;
  }

  const { audit, temuan } = data;
  const groups: Record<KlpcmKategori, typeof temuan> = {
    identitas: [], anamnesa: [], pengkajian: [], dpjp: [], resume: [], informed_consent: [],
  };
  temuan.forEach(t => { (groups[t.kategori] ?? (groups[t.kategori] = [])).push(t); });

  // Informed Consent tidak punya kolom skor tersendiri (Kamus F.5, di luar skor total F.2)
  // → dihitung dari kelengkapan itemnya sendiri.
  const icItems = groups.informed_consent;
  const icScore = icItems.length > 0
    ? (icItems.filter(t => t.lengkap === 1).length * 100) / icItems.length
    : 0;

  const scorePerKat: Record<KlpcmKategori, number> = {
    identitas:  audit.score_identitas,
    anamnesa:   audit.score_anamnesa,
    pengkajian: audit.score_pengkajian,
    dpjp:       audit.score_dpjp,
    resume:     audit.score_resume,
    informed_consent: icScore,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <nav className="text-xs mb-4 flex gap-2 items-center">
        <Link href="/klpcm" className="text-indigo-600 hover:underline">← Daftar Audit</Link>
        <span className="text-slate-400">·</span>
        <Link href={`/rekam-medis/${encodeURIComponent(audit.no_rawat)}`}
          className="text-indigo-600 hover:underline">🔎 Buka RM Pasien</Link>
      </nav>

      <header className="bg-white border border-slate-200 rounded p-4 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Audit RM: {audit.nama_pasien ?? "-"}</h1>
            <div className="text-xs text-slate-600 mt-1 space-y-0.5">
              <div>No. RM: <span className="font-mono">{audit.no_rkm_medis ?? "-"}</span> · No. Rawat: <span className="font-mono">{audit.no_rawat}</span></div>
              <div>Masuk: {audit.tgl_masuk ?? "-"} · Keluar: {audit.tgl_keluar ?? "-"} · Bangsal: {audit.bangsal ?? "-"}</div>
              <div>DPJP: {audit.dpjp ?? "-"}</div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${scoreClass(audit.score_total)}`}>{audit.score_total.toFixed(1)}%</div>
            <div className="text-xs text-slate-600">Skor total (target ≥ 80%)</div>
            <div className="mt-2 flex gap-2 justify-end flex-wrap">
              <button onClick={runAutoCheck}
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-3 py-1.5 rounded"
                title="Re-scan Khanza untuk auto-deteksi item RM elektronik">
                🔄 Auto-Check Khanza
              </button>
              {audit.status === "draft" && (
                <button onClick={() => updateStatus("final")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded">
                  ✓ Tandai Final
                </button>
              )}
              {audit.status === "final" && (
                <button onClick={() => updateStatus("revisi")}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded">
                  Revisi
                </button>
              )}
              <span className="text-xs px-2 py-1.5 bg-slate-100 rounded text-slate-700">Status: <strong>{audit.status}</strong></span>
            </div>
          </div>
        </div>
      </header>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
          msg.type === "ok"
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : "bg-rose-50 text-rose-700 border-rose-200"
        }`}>{msg.text}</div>
      )}

      {/* Per kategori */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(KAT_LABEL) as KlpcmKategori[]).filter(kat => groups[kat].length > 0).map(kat => (
          <div key={kat} className={`border-2 rounded ${KAT_COLOR[kat]}`}>
            <div className="px-4 py-2 border-b border-current/20 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{KAT_LABEL[kat]}</h3>
              <span className={`text-sm font-bold tabular-nums ${scoreClass(scorePerKat[kat])}`}>
                {scorePerKat[kat].toFixed(0)}%
              </span>
            </div>
            <ul className="p-3 space-y-2 bg-white/70">
              {groups[kat].map(t => {
                const isAuto = !!t.catatan && t.catatan.startsWith("(auto:");
                return (
                  <li key={t.id} className="flex gap-2 items-start">
                    <input type="checkbox" checked={t.lengkap === 1}
                      disabled={savingId === t.id}
                      onChange={e => toggle(t.id, e.target.checked ? 1 : 0, isAuto ? null : t.catatan)}
                      className="mt-1 h-4 w-4 cursor-pointer" />
                    <div className="flex-1">
                      <div className={`text-sm ${t.lengkap === 1 ? "text-slate-900" : "text-slate-600"} flex items-center gap-2 flex-wrap`}>
                        <span>{t.item}</span>
                        {isAuto && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded border border-sky-200 font-mono">
                            🤖 auto
                          </span>
                        )}
                      </div>
                      {isAuto && (
                        <div className="text-[11px] text-sky-700 font-mono mt-0.5">{t.catatan}</div>
                      )}
                      {t.lengkap === 0 && !isAuto && (
                        <input type="text" placeholder="Catatan / alasan tidak lengkap..."
                          defaultValue={t.catatan ?? ""}
                          onBlur={e => {
                            const newVal = e.target.value || null;
                            if (newVal !== t.catatan) toggle(t.id, t.lengkap, newVal);
                          }}
                          className="mt-1 w-full text-xs border border-slate-300 rounded px-2 py-1 bg-white" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Catatan + meta */}
      <div className="mt-4 bg-white border border-slate-200 rounded p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Catatan Audit</h3>
        <textarea rows={3} defaultValue={audit.catatan ?? ""}
          onBlur={async e => {
            const v = e.target.value || null;
            if (v !== audit.catatan) {
              await klpcmUpdateAudit(auditId, { catatan: v });
              reload();
            }
          }}
          placeholder="Temuan keseluruhan, rekomendasi perbaikan, dst..."
          className="w-full border border-slate-300 rounded p-2 text-sm text-slate-900" />
        <div className="text-xs text-slate-500 mt-2">
          Tgl audit: {audit.tanggal_audit} · Auditor NIP: {audit.auditor_nip ?? "(simrs)"} · Updated by: {audit.updated_by ?? "-"}
        </div>
      </div>
    </div>
  );
}
