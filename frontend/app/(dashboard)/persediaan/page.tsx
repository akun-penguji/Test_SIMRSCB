"use client";

// Pengendalian Persediaan — 7 program mitigasi FMEA keterlambatan stok:
// Early Warning + Reorder Point + Buffer (1,2,7), Forecasting (3), Lead Time (4),
// Evaluasi Supplier (5), Stock Opname (6).

import { useCallback, useEffect, useState } from "react";
import {
  earlyWarning, setReorder, setKritis, forecasting, leadTime, setTerima, supplierEval,
  opnameList, opnameCreate, opnameDetail, opnameSaveItem, opnameFinalize, opnameHapus,
  barangBangsal, EarlyWarnRow, ForecastRow, LeadRow, SupplierRow, OpnameHdr, OpnameDet, Bangsal,
} from "@/lib/api";

type Tab = "early" | "forecast" | "lead" | "supplier" | "opname";
const TABS: [Tab, string][] = [
  ["early", "① Early Warning & Reorder"], ["forecast", "③ Forecasting"],
  ["lead", "④ Lead Time"], ["supplier", "⑤ Evaluasi Supplier"], ["opname", "⑥ Stock Opname"],
];
const inp = "border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm";
const th = "px-2 py-2 text-xs font-bold text-slate-600 border-b border-slate-200 text-left whitespace-nowrap";
const td = "px-2 py-1.5 text-sm border-b border-slate-100";
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function awalTahun() { return `${new Date().getFullYear()}-01-01`; }
function rp(n: number) { return "Rp " + Math.round(n).toLocaleString("id-ID"); }

export default function PersediaanPage() {
  const [tab, setTab] = useState<Tab>("early");
  const [bangsal, setBangsal] = useState<Bangsal[]>([]);
  useEffect(() => { barangBangsal().then(r => setBangsal(r.data.data)).catch(() => setBangsal([])); }, []);
  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-800">📊 Pengendalian Persediaan</h1>
        <p className="text-xs text-slate-500">Program mitigasi risiko keterlambatan stok (FMEA): reorder point, early warning, forecasting, lead time, evaluasi supplier, stock opname.</p>
      </div>
      <div className="flex gap-1 flex-wrap border-b border-slate-200">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm font-semibold rounded-t-lg -mb-px border-b-2 ${tab === k ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
        ))}
      </div>
      {tab === "early" && <EarlyTab bangsal={bangsal} />}
      {tab === "forecast" && <ForecastTab />}
      {tab === "lead" && <LeadTab />}
      {tab === "supplier" && <SupplierTab />}
      {tab === "opname" && <OpnameTab bangsal={bangsal} />}
    </div>
  );
}

// ── ① Early Warning + Reorder + Buffer ───────────────────────────────────────
function EarlyTab({ bangsal }: { bangsal: Bangsal[] }) {
  const [depo, setDepo] = useState("");
  const [rows, setRows] = useState<EarlyWarnRow[]>([]);
  const [ring, setRing] = useState<{ total: number; kritis: number; perlu_pesan: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<EarlyWarnRow | null>(null);
  const muat = useCallback(() => {
    setLoading(true);
    earlyWarning(depo || undefined).then(r => { setRows(r.data.data); setRing(r.data.ringkasan); })
      .catch(() => { setRows([]); setRing(null); }).finally(() => setLoading(false));
  }, [depo]);
  useEffect(() => { muat(); /* eslint-disable-next-line */ }, []);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Depo</span>
          <select value={depo} onChange={e => setDepo(e.target.value)} className={inp}>
            <option value="">— Semua depo —</option>{bangsal.map(b => <option key={b.kd_bangsal} value={b.kd_bangsal}>{b.nm_bangsal}</option>)}
          </select></label>
        <button onClick={muat} className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Tampilkan</button>
        {ring && <div className="ml-auto flex gap-2 text-xs self-center">
          <span className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">Kritis {ring.kritis}</span>
          <span className="px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">Perlu pesan {ring.perlu_pesan}</span>
        </div>}
      </div>
      <p className="text-[11px] text-slate-400">Reorder Point (ROP) = pemakaian rata²/periode × lead time + stok minimal. Atur nilainya per depo lewat tombol “Atur”. Tandai barang kritis + buffer stok.</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50"><tr>
            <th className={th}>Barang</th><th className={`${th} text-center`}>Stok</th><th className={`${th} text-center`}>Min</th>
            <th className={`${th} text-center`}>ROP</th><th className={`${th} text-center`}>Buffer</th>
            <th className={`${th} text-center`}>Usul Pesan</th><th className={`${th} text-center`}>Status</th><th className={`${th} text-center`}>Aksi</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="text-center text-slate-400 py-8 text-sm">Memuat…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={8} className="text-center text-emerald-600 py-8 text-sm">✓ Semua di atas reorder point.</td></tr>
                : rows.map(r => (
                  <tr key={r.kode_brng} className={r.status === "Kritis" ? "bg-red-50/50" : ""}>
                    <td className={td}>{r.nama_brng}{r.kritis && <span className="ml-1 text-[10px] text-red-600 font-bold">●KRITIS</span>}<div className="text-[10px] text-slate-400">{r.kode_brng} · {r.satuan}</div></td>
                    <td className={`${td} text-center tabular-nums font-semibold ${r.stok <= 0 ? "text-red-600" : ""}`}>{r.stok}</td>
                    <td className={`${td} text-center tabular-nums`}>{r.stok_minimal}</td>
                    <td className={`${td} text-center tabular-nums`}>{r.reorder_point}</td>
                    <td className={`${td} text-center tabular-nums`}>{r.buffer_stock || "-"}</td>
                    <td className={`${td} text-center tabular-nums font-bold text-teal-700`}>{r.usul_pesan}</td>
                    <td className={`${td} text-center`}><span className={`text-xs font-semibold ${r.status === "Kritis" ? "text-red-600" : "text-amber-600"}`}>{r.status}</span></td>
                    <td className={`${td} text-center`}><button onClick={() => setEdit(r)} className="text-teal-600 hover:text-teal-800 text-xs font-semibold">Atur</button></td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {edit && <ReorderModal r={edit} kd_bangsal={depo} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); muat(); }} />}
    </div>
  );
}

function ReorderModal({ r, kd_bangsal, onClose, onSaved }: { r: EarlyWarnRow; kd_bangsal: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ stok_minimal: r.stok_minimal, stok_maksimal: r.stok_maksimal, lead_time: r.lead_time, consumption_avg: r.consumption_avg });
  const [kritis, setKr] = useState(r.kritis);
  const [buffer, setBuffer] = useState(r.buffer_stock);
  const [alasan, setAlasan] = useState("");
  const [saving, setSaving] = useState(false);
  const rop = f.consumption_avg * f.lead_time + f.stok_minimal;
  async function simpan() {
    setSaving(true);
    try {
      if (kd_bangsal) await setReorder({ kode_brng: r.kode_brng, kd_bangsal, ...f });
      await setKritis(kritis ? { kode_brng: r.kode_brng, buffer_stock: buffer, alasan } : { kode_brng: r.kode_brng, hapus: true });
      onSaved();
    } catch { alert(kd_bangsal ? "Gagal menyimpan" : "Pilih depo dulu untuk mengatur reorder point per depo (barang kritis tetap tersimpan)."); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md my-8">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200"><h2 className="font-bold text-slate-800 text-sm">Reorder Point — {r.nama_brng}</h2><button onClick={onClose} className="text-slate-400 text-xl leading-none">×</button></div>
        <div className="p-4 space-y-3">
          {!kd_bangsal && <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">Pilih depo pada filter untuk menyimpan reorder point per depo. Tanpa depo, hanya penanda kritis & buffer yang tersimpan.</div>}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Stok Minimal (safety)</span><input type="number" value={f.stok_minimal} onChange={e => setF({ ...f, stok_minimal: Number(e.target.value) })} className={inp} /></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Stok Maksimal</span><input type="number" value={f.stok_maksimal} onChange={e => setF({ ...f, stok_maksimal: Number(e.target.value) })} className={inp} /></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Lead Time (periode)</span><input type="number" value={f.lead_time} onChange={e => setF({ ...f, lead_time: Number(e.target.value) })} className={inp} /></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Pemakaian rata²/periode</span><input type="number" value={f.consumption_avg} onChange={e => setF({ ...f, consumption_avg: Number(e.target.value) })} className={inp} /></label>
          </div>
          <div className="text-sm text-slate-600">Reorder Point = <b className="text-teal-700 tabular-nums">{rop}</b></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={kritis} onChange={e => setKr(e.target.checked)} /> Tandai <b>barang kritis / high-risk</b></label>
          {kritis && <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Buffer Stock</span><input type="number" value={buffer} onChange={e => setBuffer(Number(e.target.value))} className={inp} /></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Alasan</span><input value={alasan} onChange={e => setAlasan(e.target.value)} className={inp} /></label>
          </div>}
        </div>
        <div className="flex gap-2 px-4 py-3 border-t border-slate-200"><button onClick={simpan} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">{saving ? "Menyimpan…" : "Simpan"}</button><button onClick={onClose} className="px-4 border border-slate-300 text-slate-600 text-sm font-semibold rounded-lg py-2">Batal</button></div>
      </div>
    </div>
  );
}

// ── ③ Forecasting ────────────────────────────────────────────────────────────
function ForecastTab() {
  const [bulan, setBulan] = useState(6);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(false);
  const muat = useCallback(() => { setLoading(true); forecasting({ bulan, q }).then(r => setRows(r.data.data)).catch(() => setRows([])).finally(() => setLoading(false)); }, [bulan, q]);
  useEffect(() => { muat(); /* eslint-disable-next-line */ }, []);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Periode histori</span>
          <select value={bulan} onChange={e => setBulan(Number(e.target.value))} className={inp}>{[3, 6, 12, 24].map(n => <option key={n} value={n}>{n} bulan</option>)}</select></label>
        <label className="flex flex-col gap-1 flex-1 min-w-[160px]"><span className="text-[11px] font-semibold text-slate-500">Cari barang</span><input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && muat()} className={inp} /></label>
        <button onClick={muat} className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Tampilkan</button>
      </div>
      <p className="text-[11px] text-slate-400">Proyeksi dari histori pergerakan barang (mutasibarang). Rata²/bulan = total keluar ÷ periode. Usul pesan = proyeksi bulan depan − stok saat ini.</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50"><tr>
            <th className={th}>Barang</th><th className={`${th} text-center`}>Total Keluar</th><th className={`${th} text-center`}>Rata²/bln</th>
            <th className={`${th} text-center`}>Stok Kini</th><th className={`${th} text-center`}>Proyeksi Bln Depan</th><th className={`${th} text-center`}>Usul Pesan</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="text-center text-slate-400 py-8 text-sm">Memuat…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-8 text-sm">Tidak ada data pergerakan.</td></tr>
                : rows.map(r => (
                  <tr key={r.kode_brng}>
                    <td className={td}>{r.nama_brng}<div className="text-[10px] text-slate-400">{r.kode_brng} · {r.satuan}</div></td>
                    <td className={`${td} text-center tabular-nums`}>{r.total_keluar}</td>
                    <td className={`${td} text-center tabular-nums font-semibold`}>{r.rata_per_bulan}</td>
                    <td className={`${td} text-center tabular-nums`}>{r.stok}</td>
                    <td className={`${td} text-center tabular-nums`}>{r.proyeksi_bulan_depan}</td>
                    <td className={`${td} text-center tabular-nums font-bold ${r.usul_pesan > 0 ? "text-teal-700" : "text-slate-400"}`}>{r.usul_pesan}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── ④ Lead Time ──────────────────────────────────────────────────────────────
function LeadTab() {
  const [t1, setT1] = useState(awalTahun());
  const [t2, setT2] = useState(todayISO());
  const [target, setTarget] = useState(7);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [ring, setRing] = useState<{ total_po: number; dgn_terima: number; avg_lead: number; terlambat: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [terimaEdit, setTE] = useState<string | null>(null);
  const [tgl, setTgl] = useState("");
  const muat = useCallback(() => { setLoading(true); leadTime({ tgl_awal: t1, tgl_akhir: t2, target }).then(r => { setRows(r.data.data); setRing(r.data.ringkasan); }).catch(() => { setRows([]); setRing(null); }).finally(() => setLoading(false)); }, [t1, t2, target]);
  useEffect(() => { muat(); /* eslint-disable-next-line */ }, []);
  async function simpanTerima(no: string) { try { await setTerima({ no_faktur: no, tgl_terima: tgl }); setTE(null); muat(); } catch { alert("Gagal menyimpan"); } }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Tgl Pesan Awal</span><input type="date" value={t1} onChange={e => setT1(e.target.value)} className={inp} /></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Tgl Pesan Akhir</span><input type="date" value={t2} onChange={e => setT2(e.target.value)} className={inp} /></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Target (hari)</span><input type="number" value={target} onChange={e => setTarget(Number(e.target.value))} className={inp + " w-20"} /></label>
        <button onClick={muat} className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Tampilkan</button>
        {ring && <div className="ml-auto flex gap-2 text-xs self-center"><span className="px-2 py-1 rounded bg-slate-50 border">PO {ring.total_po}</span><span className="px-2 py-1 rounded bg-teal-50 border border-teal-200">Avg {ring.avg_lead} hr</span><span className="px-2 py-1 rounded bg-red-50 border border-red-200 text-red-700">Telat {ring.terlambat}</span></div>}
      </div>
      <p className="text-[11px] text-slate-400">Lead time = tgl terima − tgl pesan. Catat “Tgl Terima” tiap PO agar lead time & evaluasi supplier akurat (data pemesanan Khanza belum menyimpan tanggal terima).</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50"><tr>
            <th className={th}>No Faktur</th><th className={th}>Supplier</th><th className={`${th} text-center`}>Tgl Pesan</th>
            <th className={`${th} text-center`}>Tgl Terima</th><th className={`${th} text-center`}>Lead (hr)</th><th className={`${th} text-right`}>Tagihan</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="text-center text-slate-400 py-8 text-sm">Memuat…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-8 text-sm">Tidak ada PO.</td></tr>
                : rows.map(r => (
                  <tr key={r.no_faktur} className={r.terlambat ? "bg-red-50/50" : ""}>
                    <td className={`${td} text-xs`}>{r.no_faktur}</td>
                    <td className={`${td} text-xs`}>{r.nama_suplier}</td>
                    <td className={`${td} text-center text-xs`}>{r.tgl_pesan}</td>
                    <td className={`${td} text-center text-xs`}>
                      {terimaEdit === r.no_faktur ? (
                        <span className="flex items-center gap-1"><input type="date" value={tgl} onChange={e => setTgl(e.target.value)} className="border border-slate-300 rounded px-1 py-0.5 text-xs" /><button onClick={() => simpanTerima(r.no_faktur)} className="text-emerald-600 font-semibold">✓</button></span>
                      ) : r.tgl_terima ? <span className="text-slate-700">{r.tgl_terima}</span> : <button onClick={() => { setTE(r.no_faktur); setTgl(r.tgl_pesan?.slice(0, 10) || todayISO()); }} className="text-teal-600 text-[11px] font-semibold">+ catat</button>}
                    </td>
                    <td className={`${td} text-center tabular-nums font-semibold ${r.terlambat ? "text-red-600" : ""}`}>{r.ada_terima ? r.lead : "-"}</td>
                    <td className={`${td} text-right tabular-nums text-xs`}>{rp(r.tagihan)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── ⑤ Evaluasi Supplier ──────────────────────────────────────────────────────
function SupplierTab() {
  const [t1, setT1] = useState(awalTahun());
  const [t2, setT2] = useState(todayISO());
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(false);
  const muat = useCallback(() => { setLoading(true); supplierEval({ tgl_awal: t1, tgl_akhir: t2 }).then(r => setRows(r.data.data)).catch(() => setRows([])).finally(() => setLoading(false)); }, [t1, t2]);
  useEffect(() => { muat(); /* eslint-disable-next-line */ }, []);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Dari</span><input type="date" value={t1} onChange={e => setT1(e.target.value)} className={inp} /></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Sampai</span><input type="date" value={t2} onChange={e => setT2(e.target.value)} className={inp} /></label>
        <button onClick={muat} className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Tampilkan</button>
      </div>
      <p className="text-[11px] text-slate-400">Ketepatan = PO tepat waktu ÷ PO yang tercatat tanggal terimanya. Isi tanggal terima di tab Lead Time agar avg lead & ketepatan terhitung.</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50"><tr>
            <th className={th}>Supplier</th><th className={th}>Kota</th><th className={`${th} text-center`}>Jml PO</th>
            <th className={`${th} text-right`}>Total Nilai</th><th className={`${th} text-center`}>Avg Lead</th><th className={`${th} text-center`}>Ketepatan</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="text-center text-slate-400 py-8 text-sm">Memuat…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-8 text-sm">Tidak ada data.</td></tr>
                : rows.map(r => (
                  <tr key={r.kode_suplier}>
                    <td className={td}>{r.nama_suplier}</td>
                    <td className={`${td} text-xs text-slate-500`}>{r.kota}</td>
                    <td className={`${td} text-center tabular-nums`}>{r.jml_po}</td>
                    <td className={`${td} text-right tabular-nums text-xs`}>{rp(r.total_nilai)}</td>
                    <td className={`${td} text-center tabular-nums`}>{r.avg_lead != null ? `${r.avg_lead} hr` : "-"}</td>
                    <td className={`${td} text-center tabular-nums font-semibold ${r.ketepatan_persen == null ? "text-slate-400" : r.ketepatan_persen >= 80 ? "text-emerald-600" : "text-amber-600"}`}>{r.ketepatan_persen != null ? `${r.ketepatan_persen}%` : "-"}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── ⑥ Stock Opname ───────────────────────────────────────────────────────────
function OpnameTab({ bangsal }: { bangsal: Bangsal[] }) {
  const [list, setList] = useState<OpnameHdr[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [depo, setDepo] = useState("");
  const muat = useCallback(() => { setLoading(true); opnameList().then(r => setList(r.data.data)).catch(() => setList([])).finally(() => setLoading(false)); }, []);
  useEffect(() => { muat(); /* eslint-disable-next-line */ }, []);
  async function buat() { if (!depo) { alert("Pilih depo"); return; } setCreating(true); try { const r = await opnameCreate({ kd_bangsal: depo }); setCreating(false); setOpenId(r.data.id); muat(); } catch { setCreating(false); alert("Gagal membuat opname"); } }
  async function hapus(o: OpnameHdr) { if (!window.confirm("Hapus opname draft ini?")) return; try { await opnameHapus(o.id); muat(); } catch { alert("Gagal / sudah final"); } }
  if (openId) return <OpnameDetailView id={openId} onBack={() => { setOpenId(null); muat(); }} />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Depo untuk opname baru</span>
          <select value={depo} onChange={e => setDepo(e.target.value)} className={inp}><option value="">— pilih depo —</option>{bangsal.map(b => <option key={b.kd_bangsal} value={b.kd_bangsal}>{b.nm_bangsal}</option>)}</select></label>
        <button onClick={buat} disabled={creating} className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2">{creating ? "Membuat…" : "+ Mulai Opname"}</button>
      </div>
      <p className="text-[11px] text-slate-400">Opname memuat stok sistem depo, lalu Anda input stok fisik → selisih terhitung. Rekonsiliasi/penyesuaian stok tetap dilakukan di aplikasi Khanza.</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50"><tr><th className={th}>Tanggal</th><th className={th}>Depo</th><th className={`${th} text-center`}>Item</th><th className={`${th} text-center`}>Selisih</th><th className={`${th} text-center`}>Status</th><th className={`${th} text-center`}>Aksi</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="text-center text-slate-400 py-8 text-sm">Memuat…</td></tr>
              : list.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-8 text-sm">Belum ada opname.</td></tr>
                : list.map(o => (
                  <tr key={o.id}>
                    <td className={`${td} text-xs`}>{o.tanggal}</td><td className={td}>{o.nm_bangsal}{o.keterangan && <div className="text-[10px] text-slate-400">{o.keterangan}</div>}</td>
                    <td className={`${td} text-center tabular-nums`}>{o.jml_item}</td>
                    <td className={`${td} text-center tabular-nums font-semibold ${o.jml_selisih > 0 ? "text-amber-600" : "text-slate-400"}`}>{o.jml_selisih}</td>
                    <td className={`${td} text-center`}><span className={`text-xs font-semibold ${o.status === "Final" ? "text-emerald-600" : "text-slate-500"}`}>{o.status}</span></td>
                    <td className={`${td} text-center whitespace-nowrap`}><button onClick={() => setOpenId(o.id)} className="text-teal-600 hover:text-teal-800 text-xs font-semibold">Buka</button>{o.status !== "Final" && <button onClick={() => hapus(o)} className="text-red-500 hover:text-red-700 text-xs font-semibold ml-2">Hapus</button>}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpnameDetailView({ id, onBack }: { id: number; onBack: () => void }) {
  const [hdr, setHdr] = useState<{ nm_bangsal: string; status: string; tanggal: string } | null>(null);
  const [rows, setRows] = useState<OpnameDet[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const muat = useCallback(() => { setLoading(true); opnameDetail(id).then(r => { setHdr({ nm_bangsal: r.data.nm_bangsal, status: r.data.status, tanggal: r.data.tanggal }); setRows(r.data.data); }).catch(() => setRows([])).finally(() => setLoading(false)); }, [id]);
  useEffect(() => { muat(); /* eslint-disable-next-line */ }, []);
  const final = hdr?.status === "Final";
  async function simpanFisik(d: OpnameDet, v: number) {
    setRows(rs => rs.map(x => x.id === d.id ? { ...x, stok_fisik: v, selisih: v - x.stok_sistem } : x));
    try { await opnameSaveItem(id, { id_detail: d.id, stok_fisik: v }); } catch { /* silent */ }
  }
  async function finalize() { if (!window.confirm("Finalkan opname? Setelah final tidak bisa diubah.")) return; try { await opnameFinalize(id); muat(); } catch { alert("Gagal"); } }
  const shown = rows.filter(r => !q || r.nama_brng.toLowerCase().includes(q.toLowerCase()) || r.kode_brng.includes(q));
  const totSelisih = rows.filter(r => r.selisih !== 0).length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={onBack} className="text-sm text-teal-600 font-semibold">‹ Kembali</button>
        <div className="text-sm text-slate-600">Opname <b>{hdr?.nm_bangsal}</b> · {hdr?.tanggal} · <span className={final ? "text-emerald-600 font-semibold" : "text-slate-500"}>{hdr?.status}</span> · selisih: <b className="text-amber-600">{totSelisih}</b></div>
        {!final && <button onClick={finalize} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Finalkan</button>}
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari barang…" className={inp + " w-full max-w-xs"} />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50"><tr><th className={th}>Barang</th><th className={`${th} text-center`}>Stok Sistem</th><th className={`${th} text-center`}>Stok Fisik</th><th className={`${th} text-center`}>Selisih</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="text-center text-slate-400 py-8 text-sm">Memuat…</td></tr>
              : shown.length === 0 ? <tr><td colSpan={4} className="text-center text-slate-400 py-8 text-sm">Tidak ada item.</td></tr>
                : shown.map(r => (
                  <tr key={r.id} className={r.selisih !== 0 ? "bg-amber-50/40" : ""}>
                    <td className={td}>{r.nama_brng}<div className="text-[10px] text-slate-400">{r.kode_brng} · {r.satuan}</div></td>
                    <td className={`${td} text-center tabular-nums`}>{r.stok_sistem}</td>
                    <td className={`${td} text-center`}>{final ? <span className="tabular-nums">{r.stok_fisik}</span> : <input type="number" defaultValue={r.stok_fisik} onBlur={e => simpanFisik(r, Number(e.target.value))} className="border border-slate-300 rounded px-2 py-1 text-sm w-24 text-center" />}</td>
                    <td className={`${td} text-center tabular-nums font-semibold ${r.selisih < 0 ? "text-red-600" : r.selisih > 0 ? "text-emerald-600" : "text-slate-400"}`}>{r.selisih > 0 ? `+${r.selisih}` : r.selisih}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
