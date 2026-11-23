"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { getSirsRl33, updateSirsRl33, cetakSirsRl33, Rl33Resp, Rl33Entry, sirsBotSubmit } from "@/lib/api";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const NUM_FIELDS: (keyof Rl33Entry)[] = [
  "rujukan", "non_rujukan", "dirawat", "dirujuk", "pulang",
  "mati_l", "mati_p", "doa_l", "doa_p", "luka_l", "luka_p", "false_emergency",
];

export default function Rl33Page() {
  const [bulan, setBulan] = useState(thisMonth());
  const [data, setData]   = useState<Rl33Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [edits, setEdits]     = useState<Record<number, Rl33Entry>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleKirimSirs = async () => {
    if (!data || data.entries.length === 0) return;
    if (!confirm(`Kirim laporan RL 3.3 untuk periode ${bulan} ke SIRS Online Kemenkes RI?\nData akan divalidasi dengan aturan Juknis 6.3.`)) {
      return;
    }
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const payload = {
        tahun: parseInt(bulan.substring(0, 4)),
        bulan: parseInt(bulan.substring(5, 7)),
        tahunDanBulan: `${bulan}-01`,
        data: data.entries.map((e, idx) => ({
          jenis_pelayanan_id: idx + 1,
          total_pasien_rujukan: e.rujukan,
          total_pasien_non_rujukan: e.non_rujukan,
          tindak_lanjut_dirawat: e.dirawat,
          tindak_lanjut_dirujuk: e.dirujuk,
          tindak_lanjut_pulang: e.pulang,
          mati_di_igd: e.mati_l + e.mati_p,
          doa: e.doa_l + e.doa_p,
          luka_luka: e.luka_l + e.luka_p,
          false_emergency: e.false_emergency,
        })),
      };
      const res = await sirsBotSubmit("rl33", payload);
      setSubmitResult({ success: true, message: res.data.message || "Laporan RL 3.3 berhasil terkirim ke Kemenkes RI!" });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || "Pengiriman ditolak oleh server Kemenkes";
      setSubmitResult({ success: false, message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl33(bulan).then(r => {
      setData(r.data);
      setEdits({});
    }).catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => { reload(); }, [reload]);

  const updateField = (id: number, field: keyof Rl33Entry, value: number) => {
    setEdits(es => {
      const base = es[id] || data?.entries.find(e => e.id === id);
      if (!base) return es;
      return { ...es, [id]: { ...base, [field]: value } };
    });
  };

  const handleSaveRow = async (id: number) => {
    const row = edits[id];
    if (!row) return;
    try {
      await updateSirsRl33(id, row);
      setOkMsg(`Baris #${id} tersimpan`);
      setTimeout(() => setOkMsg(""), 2500);
      setEdits(es => { const r = { ...es }; delete r[id]; return r; });
      reload();
    } catch { setErrMsg("Gagal simpan"); }
  };

  const handleCetak = async () => {
    try { await cetakSirsRl33(bulan); }
    catch { setErrMsg("Gagal cetak"); }
  };

  // Group entries: parent 1 (Bedah), parent 2 (Non Bedah), standalone (3-7)
  const grouped = useMemo(() => {
    const ent = data?.entries || [];
    return {
      bedah:    ent.filter(e => e.parent_kode === "1"),
      nonBedah: ent.filter(e => e.parent_kode === "2"),
      lain:     ent.filter(e => !e.parent_kode),
    };
  }, [data]);

  // Compute parent sub-totals
  const sumGroup = (rows: Rl33Entry[]) => NUM_FIELDS.reduce((acc, k) => {
    acc[k] = rows.reduce((a, r) => a + ((r[k] as number) || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  const subBedah    = useMemo(() => sumGroup(grouped.bedah),    [grouped.bedah]);
  const subNonBedah = useMemo(() => sumGroup(grouped.nonBedah), [grouped.nonBedah]);
  const total       = useMemo(() => sumGroup([...grouped.bedah, ...grouped.nonBedah, ...grouped.lain]),
                              [grouped.bedah, grouped.nonBedah, grouped.lain]);

  const totalPasien = (data?.entries || []).reduce((a, e) => a + e.rujukan + e.non_rujukan, 0);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-4">
        <Link href="/laporan/sirs" className="text-xs text-slate-500 hover:text-green-700">
          ← Laporan SIRS 6.3
        </Link>
        <div className="flex items-start gap-3 mt-2">
          <span className="font-mono text-lg font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded">
            RL 3.3
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800 leading-tight">Rekap Kegiatan Pelayanan Rawat Darurat (IGD)</h1>
            <p className="text-xs text-slate-500 mt-1">SIRS Online · Bulanan · Manual entry + sanity check Khanza</p>
          </div>
          <button onClick={handleCetak}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Cetak
          </button>
          <button onClick={handleKirimSirs} disabled={submitting || !data || data.entries.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium shadow-sm transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {submitting ? "Mengirim ke SIRS..." : "Kirim ke SIRS Online"}
          </button>
        </div>
      </div>

      {errMsg && <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm">{errMsg}</div>}
      {submitResult && (
        <div className={`mb-3 border rounded-xl px-4 py-3 text-sm whitespace-pre-line ${
          submitResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-900"
        }`}>
          <div className="font-semibold">{submitResult.success ? "✓ Berhasil Dikirim ke SIRS Online" : "⚠ Perhatian / Validasi Juknis 6.3"}</div>
          <div className="mt-1 text-xs">{submitResult.message}</div>
        </div>
      )}
      {okMsg  && <div className="mb-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-green-800 text-sm">{okMsg}</div>}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-xs text-slate-900 font-semibold block mb-1">Bulan pelaporan</label>
          <input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900" />
        </div>
        {data && (
          <div className="text-xs text-slate-500">
            Periode: <span className="font-mono">{data.bulan_dari}</span> s/d <span className="font-mono">{data.bulan_sampai}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat...</div>
      ) : !data ? (
        <div className="text-center text-slate-400 text-sm py-6">Data kosong.</div>
      ) : (
        <>
          {/* Sanity check Khanza */}
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-4">
            <p className="text-xs font-bold text-amber-900 uppercase tracking-wide mb-2">🔍 Sanity Check — Khanza Realtime</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-3">
              <KhanzaStat label="Total kunjungan IGD" value={data.khanza.total_igd} />
              <KhanzaStat label="Laki-laki"           value={data.khanza.l} />
              <KhanzaStat label="Perempuan"           value={data.khanza.p} />
              <KhanzaStat label="Pengunjung Baru"     value={data.khanza.baru} />
              <KhanzaStat label="Pengunjung Lama"     value={data.khanza.lama} />
            </div>
            {data.khanza_per_kategori.length > 0 && (
              <div>
                <p className="text-[11px] text-amber-900 font-medium mb-1">Per macam kasus (data_triase_igd × master_triase_macam_kasus):</p>
                <table className="w-full text-xs">
                  <thead className="text-amber-900 uppercase">
                    <tr className="border-b border-amber-300">
                      <th className="text-left py-1">Kode</th>
                      <th className="text-left py-1">Macam Kasus</th>
                      <th className="text-right py-1">Total</th>
                      <th className="text-right py-1">Rujukan</th>
                      <th className="text-right py-1">Non Rujukan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.khanza_per_kategori.map((k, i) => (
                      <tr key={i} className="border-b border-amber-100 last:border-b-0">
                        <td className="py-1 font-mono text-slate-900">{k.kode_kasus || "—"}</td>
                        <td className="py-1 text-slate-900">{k.macam_kasus || "—"}</td>
                        <td className="py-1 text-right tabular-nums text-slate-900 font-semibold">{k.jml}</td>
                        <td className="py-1 text-right tabular-nums text-slate-900">{k.rujukan}</td>
                        <td className="py-1 text-right tabular-nums text-slate-900">{k.non_rujukan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-amber-700 mt-2 italic">
              Total entry RL 3.3 (Rujukan + Non Rujukan): <strong className="text-amber-900">{totalPasien}</strong>
              {Math.abs(totalPasien - data.khanza.total_igd) > 30 && (
                <span className="text-red-700 font-semibold"> · ⚠️ Selisih cukup besar vs Khanza</span>
              )}
            </p>
          </div>

          {/* Main table — manual entry */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-900 uppercase font-bold">
                <tr className="border-b border-slate-300">
                  <th rowSpan={2} className="text-left p-2 border-r whitespace-nowrap">Kode</th>
                  <th rowSpan={2} className="text-left p-2 border-r whitespace-nowrap sticky left-0 bg-slate-50 z-10">Jenis Pelayanan</th>
                  <th colSpan={2} className="text-center p-2 border-r border-b bg-blue-100">Total Pasien</th>
                  <th colSpan={3} className="text-center p-2 border-r border-b bg-emerald-100">Tindak Lanjut</th>
                  <th colSpan={2} className="text-center p-2 border-r border-b bg-red-100">Mati di IGD</th>
                  <th colSpan={2} className="text-center p-2 border-r border-b bg-red-100">DOA</th>
                  <th colSpan={2} className="text-center p-2 border-r border-b bg-amber-100">Luka-luka</th>
                  <th rowSpan={2} className="text-right p-2 border-r whitespace-nowrap">False Emerg</th>
                  <th rowSpan={2} className="p-2 whitespace-nowrap"></th>
                </tr>
                <tr>
                  <th className="text-right p-2 border-r bg-blue-50">Rujukan</th>
                  <th className="text-right p-2 border-r bg-blue-50">Non Rj</th>
                  <th className="text-right p-2 border-r bg-emerald-50">Dirawat</th>
                  <th className="text-right p-2 border-r bg-emerald-50">Dirujuk</th>
                  <th className="text-right p-2 border-r bg-emerald-50">Pulang</th>
                  <th className="text-right p-2 border-r bg-red-50">L</th>
                  <th className="text-right p-2 border-r bg-red-50">P</th>
                  <th className="text-right p-2 border-r bg-red-50">L</th>
                  <th className="text-right p-2 border-r bg-red-50">P</th>
                  <th className="text-right p-2 border-r bg-amber-50">L</th>
                  <th className="text-right p-2 border-r bg-amber-50">P</th>
                </tr>
              </thead>
              <tbody>
                {/* 1. Bedah parent */}
                <tr className="bg-blue-50 font-bold">
                  <td className="p-2 border-r font-mono text-slate-900">1</td>
                  <td className="p-2 border-r text-slate-900 sticky left-0 bg-blue-50">Bedah di Instalasi Gawat Darurat</td>
                  {NUM_FIELDS.map(k => (
                    <td key={k} className="p-2 border-r text-right tabular-nums text-slate-900">{subBedah[k] || ""}</td>
                  ))}
                  <td className="p-2"></td>
                </tr>
                {grouped.bedah.map(e => renderRow(e, edits, updateField, handleSaveRow))}

                {/* 2. Non Bedah parent */}
                <tr className="bg-blue-50 font-bold">
                  <td className="p-2 border-r font-mono text-slate-900">2</td>
                  <td className="p-2 border-r text-slate-900 sticky left-0 bg-blue-50">Non Bedah</td>
                  {NUM_FIELDS.map(k => (
                    <td key={k} className="p-2 border-r text-right tabular-nums text-slate-900">{subNonBedah[k] || ""}</td>
                  ))}
                  <td className="p-2"></td>
                </tr>
                {grouped.nonBedah.map(e => renderRow(e, edits, updateField, handleSaveRow))}

                {/* Standalone (3-7) */}
                {grouped.lain.map(e => renderRow(e, edits, updateField, handleSaveRow))}
              </tbody>
              <tfoot className="bg-blue-100 font-bold text-slate-900">
                <tr>
                  <td className="p-2 border-r">99</td>
                  <td className="p-2 border-r sticky left-0 bg-blue-100">TOTAL</td>
                  {NUM_FIELDS.map(k => (
                    <td key={k} className="p-2 border-r text-right tabular-nums">{total[k]}</td>
                  ))}
                  <td className="p-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-3 text-[11px] text-slate-500 italic">
            Klik angka untuk edit, lalu tombol 💾 di kolom paling kanan untuk simpan. Sub-total Bedah (1) dan Non Bedah (2) di-compute otomatis dari sub-entry.
          </p>
        </>
      )}

      <style jsx>{`
        :global(.cell-input) {
          width: 56px;
          text-align: right;
          border: 1px solid transparent;
          background: transparent;
          padding: 2px 4px;
          font-variant-numeric: tabular-nums;
          color: rgb(15 23 42);
          border-radius: 3px;
        }
        :global(.cell-input:hover) { background: rgb(241 245 249); }
        :global(.cell-input:focus) {
          outline: none;
          border-color: rgb(16 185 129);
          background: white;
          box-shadow: 0 0 0 1px rgb(16 185 129);
        }
        :global(.cell-input.dirty) { background: rgb(254 252 232); border-color: rgb(250 204 21); }
      `}</style>
    </div>
  );
}

function renderRow(
  e: Rl33Entry,
  edits: Record<number, Rl33Entry>,
  updateField: (id: number, field: keyof Rl33Entry, value: number) => void,
  saveRow: (id: number) => void,
) {
  if (!e.id) return null;
  const cur = edits[e.id] || e;
  const isDirty = !!edits[e.id];
  return (
    <tr key={e.id} className="hover:bg-slate-50 border-b border-slate-100">
      <td className="p-2 border-r font-mono text-slate-900">{e.jenis_kode}</td>
      <td className="p-2 border-r text-slate-900 sticky left-0 bg-white">{e.jenis_nama}</td>
      {NUM_FIELDS.map(k => (
        <td key={k} className="p-2 border-r text-right">
          <input type="number" min={0} value={(cur[k] as number) ?? 0}
            onChange={(ev) => updateField(e.id!, k, parseInt(ev.target.value || "0", 10))}
            className={`cell-input ${isDirty ? "dirty" : ""}`} />
        </td>
      ))}
      <td className="p-2 text-center">
        {isDirty && (
          <button onClick={() => saveRow(e.id!)}
            className="text-emerald-700 hover:bg-emerald-50 text-base px-1.5 py-0.5 rounded" title="Simpan">💾</button>
        )}
      </td>
    </tr>
  );
}

function KhanzaStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-amber-200 rounded-lg p-2">
      <p className="text-[10px] text-amber-700 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-amber-900 tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
