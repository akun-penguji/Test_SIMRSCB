"use client";

// Audit Edukasi Terintegrasi PPA (per pasien/NORM).
// 6 item audit: Lembar terisi, Teach-Back/Pemahaman, TTD Pasien&Nakes,
// Edukasi Transfer, Edukasi Rujukan, Catatan Auditor (input baru).
// Sumber: materi_edukasi_pasien_keluarga_rscb, edukasi_pasien_keluarga_rscb,
// edukasipasien_ttd, transfer_pasien_antar_ruang, audit_edukasi_terintegrasi_rscb.

import { useEffect, useState, useCallback } from "react";
import { rekapAuditEdukasi, simpanCatatanAuditEdukasi, AuditEdukasiRow, AuditEdukasiResp } from "@/lib/api";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function bulanIni() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }
function toDMY(iso: string) { if (!iso) return ""; const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}-${m}-${y}`; }

function Badge({ v }: { v: string }) {
  const c = v === "Ya" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : v === "Tidak" ? "bg-red-50 text-red-700 border-red-200"
    : "bg-slate-100 text-slate-500 border-slate-200"; // NA
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${c}`}>{v}</span>;
}

export default function AuditEdukasiPage() {
  const [tglAwal, setTglAwal] = useState(bulanIni());
  const [tglAkhir, setTglAkhir] = useState(todayISO());
  const [data, setData] = useState<AuditEdukasiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [editNo, setEditNo] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);

  const muat = useCallback(() => {
    setLoading(true); setEditNo(null);
    rekapAuditEdukasi({ tgl_awal: tglAwal, tgl_akhir: tglAkhir })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [tglAwal, tglAkhir]);

  useEffect(() => { muat(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function simpanCatatan(r: AuditEdukasiRow) {
    setSaving(true);
    try {
      await simpanCatatanAuditEdukasi({ no_rawat: r.no_rawat, catatan: editVal });
      setData(d => d ? { ...d, detail: d.detail.map(x => x.no_rawat === r.no_rawat ? { ...x, catatan_auditor: editVal } : x) } : d);
      setEditNo(null);
    } catch {
      alert("Gagal menyimpan catatan auditor");
    } finally { setSaving(false); }
  }

  const inp = "border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm";
  const th = "px-2 py-2 text-xs font-bold text-slate-600 border-b border-slate-200 text-left whitespace-nowrap";
  const td = "px-2 py-1.5 text-sm border-b border-slate-100 align-top";
  const ring = data?.ringkasan;
  const rows = data?.detail ?? [];

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div className="no-print">
        <h1 className="text-lg font-bold text-slate-800">Audit Edukasi Terintegrasi PPA</h1>
        <p className="text-xs text-slate-500">Kelengkapan lembar edukasi terintegrasi per pasien/NORM. Sumber: modul Edukasi Pasien &amp; Keluarga (RSCB).</p>
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
        <div className="text-base font-bold">Audit Edukasi Terintegrasi PPA</div>
        <div className="text-sm">{toDMY(tglAwal)} s/d {toDMY(tglAkhir)}</div>
      </div>

      {ring && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-[11px] text-slate-500">Pasien</div><div className="text-xl font-bold text-slate-800 tabular-nums">{ring.pasien}</div></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-[11px] text-slate-500">Lembar terisi</div><div className="text-xl font-bold text-slate-800 tabular-nums">{ring.lembar_ya}/{ring.pasien}</div></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-[11px] text-slate-500">Teach-Back</div><div className="text-xl font-bold text-slate-800 tabular-nums">{ring.teach_ya}/{ring.pasien}</div></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-[11px] text-slate-500">TTD lengkap</div><div className="text-xl font-bold text-slate-800 tabular-nums">{ring.ttd_ya}/{ring.pasien}</div></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-[11px] text-slate-500">Edukasi transfer</div><div className="text-xl font-bold text-slate-800 tabular-nums">{ring.transfer_ya}/{ring.transfer_dari}</div></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-[11px] text-slate-500">Edukasi rujukan</div><div className="text-xl font-bold text-slate-800 tabular-nums">{ring.rujukan_ya}/{ring.rujukan_dari}</div></div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50"><tr>
            <th className={th}>Tgl</th><th className={th}>NORM</th><th className={th}>Pasien</th>
            <th className={`${th} text-center`}>1. Lembar</th>
            <th className={`${th} text-center`}>2. Teach-Back</th>
            <th className={`${th} text-center`}>3. TTD</th>
            <th className={`${th} text-center`}>4. Transfer</th>
            <th className={`${th} text-center`}>5. Rujukan</th>
            <th className={th}>6. Catatan Auditor</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center text-slate-400 text-sm py-8">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-slate-400 text-sm py-8">Tidak ada data edukasi pada rentang ini.</td></tr>
            ) : rows.map(r => (
              <tr key={r.no_rawat}>
                <td className={`${td} whitespace-nowrap text-xs`}>{toDMY(r.tgl)}</td>
                <td className={`${td} text-xs text-slate-500 whitespace-nowrap`}>{r.norm}</td>
                <td className={td}>{r.nm_pasien}<div className="text-[10px] text-slate-400">{r.no_rawat}</div></td>
                <td className={`${td} text-center`}><Badge v={r.lembar_terisi} /></td>
                <td className={`${td} text-center`}><Badge v={r.teach_back} /></td>
                <td className={`${td} text-center`}><Badge v={r.ttd_lengkap} /></td>
                <td className={`${td} text-center`}><Badge v={r.edukasi_transfer} /></td>
                <td className={`${td} text-center`}><Badge v={r.edukasi_rujukan} /></td>
                <td className={`${td} min-w-[220px]`}>
                  {editNo === r.no_rawat ? (
                    <div className="flex flex-col gap-1 no-print">
                      <textarea value={editVal} onChange={e => setEditVal(e.target.value)} rows={2}
                        className="border border-slate-300 rounded-lg px-2 py-1 text-sm w-full" placeholder="Catatan auditor klinis…" />
                      <div className="flex gap-2">
                        <button onClick={() => simpanCatatan(r)} disabled={saving}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold rounded px-3 py-1">
                          {saving ? "Menyimpan…" : "Simpan"}</button>
                        <button onClick={() => setEditNo(null)} className="text-slate-500 text-xs px-2">Batal</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm text-slate-700 whitespace-pre-wrap">{r.catatan_auditor || <span className="text-slate-300">—</span>}</span>
                      <button onClick={() => { setEditNo(r.no_rawat); setEditVal(r.catatan_auditor); }}
                        className="no-print text-teal-600 hover:text-teal-800 text-xs font-semibold shrink-0">Isi</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-slate-400 no-print space-y-0.5">
        <p><b>Keterangan kolom:</b></p>
        <p>1. Lembar = ada baris edukasi terintegrasi PPA · 2. Teach-Back = hasil verifikasi pemahaman terisi di semua baris · 3. TTD = ada TTD pasien + petugas (NIP) terisi.</p>
        <p>4. Transfer: <b>NA</b> bila pasien tidak pernah transfer antar ruang; <b>Ya/Tidak</b> = ada/tidaknya materi edukasi yang menyebut "transfer".</p>
        <p>5. Rujukan: diambil dari flag kebutuhan edukasi rujukan (header pengkajian); <b>NA</b> bila pengkajian edukasi belum diisi.</p>
      </div>

      <style jsx global>{`
        @media print { .no-print { display: none !important; } @page { size: A4 landscape; margin: 10mm; } }
      `}</style>
    </div>
  );
}
