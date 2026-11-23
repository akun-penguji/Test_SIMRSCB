"use client";

// Indikator Mutu — INM nasional + IMP-RS + IMP-Unit. Master + input capaian + rekap.

import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import {
  getIndikator, createIndikator, updateIndikator, deleteIndikator,
  getCapaian, upsertCapaian, getMutuRekap,
  getMutuAutoDaftar, hitungMutuAuto,
  getMutuChecklist, addMutuChecklist, deleteMutuChecklist, rekapMutuChecklist,
  getMutuLapor, tandaiMutuLapor,
  MutuIndikator, MutuCapaian, MutuRekap, MutuAutoDef, MutuAutoHasil, MutuChecklistRow, MutuLaporRow,
} from "@/lib/api";

const BULAN = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const JENIS: Record<string, string> = { inm: "INM Nasional", imp_rs: "IMP-RS", imp_unit: "IMP-Unit" };

export default function MutuPage() {
  const isEdit = hasPerm("akreditasi_edit") || hasPerm("mutu_edit");
  const [tab, setTab] = useState<"unit" | "rekap" | "auto" | "ceklis" | "input" | "lapor" | "profil" | "indikator">("unit");
  return (
    <div className="space-y-4">
      <div className="no-print">
        <h1 className="text-xl font-bold text-slate-800">📈 Indikator Mutu</h1>
        <p className="text-sm text-slate-500">INM Nasional, IMP-RS, & IMP-Unit — input capaian bulanan, rekap & tren.</p>
      </div>
      <div className="flex gap-1 border-b border-slate-200 no-print">
        {([["unit", "📊 Dashboard Unit"], ["rekap", "Rekap & Tren"], ["auto", "⚡ Auto-Hitung"], ["ceklis", "☑ Input Ceklis"], ["input", "Input Capaian"], ["lapor", "📤 Lapor ke Portal"], ["profil", "📋 Profil Indikator"], ["indikator", "Master Indikator"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
        ))}
      </div>
      {tab === "lapor" && <TabLapor isEdit={isEdit} />}
      {tab === "profil" && <TabProfil isEdit={isEdit} />}
      {tab === "unit" && <TabDashboardUnit />}
      {tab === "rekap" && <TabRekap />}
      {tab === "auto" && <TabAuto isEdit={isEdit} />}
      {tab === "ceklis" && <TabCeklis isEdit={isEdit} />}
      {tab === "input" && <TabInput isEdit={isEdit} />}
      {tab === "indikator" && <TabIndikator isEdit={isEdit} />}
    </div>
  );
}

// ── Tab Auto-Hitung: hitung capaian langsung dari data Khanza ─────────────────
function TabAuto({ isEdit }: { isEdit: boolean }) {
  const now = new Date();
  const [tahun, setTahun] = useState(now.getFullYear());
  const [bulan, setBulan] = useState(now.getMonth() + 1); // bulan berjalan
  const [defs, setDefs] = useState<MutuAutoDef[]>([]);
  const [hasil, setHasil] = useState<MutuAutoHasil[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const nowY = now.getFullYear();

  useEffect(() => { getMutuAutoDaftar().then(r => setDefs(r.data.indikator)).catch(() => {}); }, []);

  async function hitung() {
    if (!isEdit) return;
    setLoading(true); setMsg("");
    try {
      const r = await hitungMutuAuto({ tahun, bulan });
      setHasil(r.data.hasil);
      setMsg(`Berhasil menghitung ${r.data.hasil.length} indikator untuk ${BULAN[bulan]} ${tahun} dari data Khanza. Capaian tersimpan — analisa & RTL bisa dilengkapi di tab Input Capaian.`);
    } catch (e: unknown) {
      setMsg(`Gagal: ${e instanceof Error ? e.message : "error"}`);
    } finally { setLoading(false); }
  }

  // Arah target: RI-* (APS/NDR/GDR) & satuan menit → makin kecil makin baik; sisanya makin besar.
  const kecilBaikOf = (h: { kode: string; satuan: string }) => h.kode.startsWith("RI-") || h.satuan === "menit";
  const badge = (h: MutuAutoHasil) => {
    if (h.capaian == null) return { txt: "—", cls: "bg-slate-100 text-slate-500" };
    const ok = kecilBaikOf(h) ? h.capaian <= h.target : h.capaian >= h.target;
    const txt = h.satuan === "menit" ? `${h.capaian.toFixed(1)} mnt` : `${h.capaian.toFixed(h.satuan === "‰" ? 2 : 1)}${h.satuan}`;
    return { txt, cls: ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700" };
  };
  const targetTxt = (d: MutuAutoDef) =>
    d.satuan === "menit" ? `≤${d.target} mnt` : d.satuan === "‰" ? `≤${d.target}‰` : (d.kode.startsWith("RI-") ? `≤${d.target}%` : `≥${d.target}%`);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-300 bg-sky-50 p-4 text-sm text-sky-800">
        <div className="font-semibold mb-1">⚡ Auto-Hitung dari data Khanza</div>
        Numerator & denominator dihitung langsung dari transaksi Khanza (tanpa input manual) untuk indikator di bawah,
        lalu disimpan sebagai capaian bulan terpilih. <strong>Analisa &amp; RTL tetap diisi manual</strong> di tab Input Capaian dan tidak akan tertimpa.
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">Tahun
          <select value={tahun} onChange={e => setTahun(Number(e.target.value))} className="block border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
            {[nowY, nowY - 1, nowY - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">Bulan
          <select value={bulan} onChange={e => setBulan(Number(e.target.value))} className="block border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
            {BULAN.slice(1).map((b, i) => <option key={i} value={i + 1}>{b}</option>)}
          </select>
        </label>
        <button onClick={hitung} disabled={!isEdit || loading}
          className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
          {loading ? "Menghitung…" : "⚡ Hitung Sekarang"}
        </button>
        {!isEdit && <span className="text-xs text-amber-600">Perlu izin mutu_edit / akreditasi_edit.</span>}
      </div>

      {msg && <div className="text-sm rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2">{msg}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Kode</th>
              <th className="px-3 py-2 text-left">Indikator</th>
              <th className="px-3 py-2 text-left">Unit</th>
              <th className="px-3 py-2 text-right">Numerator</th>
              <th className="px-3 py-2 text-right">Denominator</th>
              <th className="px-3 py-2 text-right">Target</th>
              <th className="px-3 py-2 text-right">Capaian</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {defs.map(d => {
              const h = hasil.find(x => x.kode === d.kode);
              const b = h ? badge(h) : null;
              return (
                <tr key={d.kode} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{d.kode}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{d.judul}</div>
                    <div className="text-xs text-slate-400">{d.definisi}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{d.unit}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{h ? h.numerator : "–"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{h ? h.denominator : "–"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{targetTxt(d)}</td>
                  <td className="px-3 py-2 text-right">
                    {b ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${b.cls}`}>{b.txt}</span> : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabRekap() {
  const nowY = new Date().getFullYear();
  const [tahun, setTahun] = useState(nowY);
  const [jenis, setJenis] = useState("");
  const [d, setD] = useState<MutuRekap | null>(null);
  useEffect(() => { getMutuRekap({ tahun, jenis }).then(r => setD(r.data)).catch(() => {}); }, [tahun, jenis]);
  const capOf = (id: number, bln: number) => d?.bulanan.find(x => x.indikator_id === id && x.bulan === bln)?.capaian;
  const warna = (cap?: number, target?: number) => {
    if (cap == null || target == null) return "";
    return cap >= target ? "text-green-700 font-semibold" : "text-red-600 font-semibold";
  };
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select value={tahun} onChange={e => setTahun(Number(e.target.value))} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          {Array.from({ length: nowY - 2023 }, (_, i) => nowY - i).map(y => <option key={y} value={y}>Tahun {y}</option>)}
        </select>
        <select value={jenis} onChange={e => setJenis(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Semua jenis</option>{Object.entries(JENIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500"><tr>
            <th className="px-2 py-2 text-left sticky left-0 bg-slate-50">Indikator</th>
            <th className="px-2 py-2">Target</th>
            {BULAN.slice(1).map((b, i) => <th key={i} className="px-2 py-2">{b}</th>)}
            <th className="px-2 py-2">Rata²</th>
          </tr></thead>
          <tbody>
            {d?.indikator.map(ind => (
              <tr key={ind.id} className="border-t border-slate-100">
                <td className="px-2 py-1.5 text-left sticky left-0 bg-white max-w-[240px] truncate" title={ind.judul}>
                  <span className="text-slate-400 font-mono">{ind.kode}</span> {ind.judul}</td>
                <td className="px-2 py-1.5 text-center text-slate-500">{ind.target ?? "-"}{ind.satuan}</td>
                {BULAN.slice(1).map((_, i) => {
                  const c = capOf(ind.id, i + 1);
                  return <td key={i} className={`px-2 py-1.5 text-center tabular-nums ${warna(c, ind.target)}`}>{c != null ? c.toFixed(1) : "·"}</td>;
                })}
                <td className={`px-2 py-1.5 text-center tabular-nums ${warna(ind.rata, ind.target)}`}>{ind.rata != null ? ind.rata.toFixed(1) : "-"}</td>
              </tr>
            ))}
            {(!d || d.indikator.length === 0) && <tr><td colSpan={15} className="px-3 py-8 text-center text-slate-400">Belum ada data.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Hijau = capai target, merah = di bawah target. Klik tab “Input Capaian” untuk mengisi.</p>
    </div>
  );
}

// ── Dashboard per unit: kartu indikator unit + auto-analisis status/tren ──────
type RekapInd = MutuRekap["indikator"][number];
type RekapBln = MutuRekap["bulanan"][number];

function analisaIndikator(ind: RekapInd, bulanan: RekapBln[]) {
  const series = bulanan.filter(b => b.indikator_id === ind.id && b.capaian != null).sort((a, b) => a.bulan - b.bulan);
  const kecilBaik = (ind.kode ?? "").startsWith("RI-") || ind.satuan === "menit" || ind.satuan === "‰";
  const fmt = (v: number) => ind.satuan === "menit" ? `${v.toFixed(1)} mnt` : `${v.toFixed(ind.satuan === "‰" ? 2 : 1)}${ind.satuan}`;
  const tgtTxt = ind.target == null ? "" : `${kecilBaik ? "≤" : "≥"}${ind.target}${ind.satuan === "menit" ? " mnt" : ind.satuan}`;
  if (!series.length) {
    return { latest: null as number | null, bulan: 0, tercapai: null as boolean | null, tren: "—", delta: 0, kecilBaik, series, tgtTxt, narasi: "Belum ada data capaian tahun ini. Isi via Input Ceklis / Auto-Hitung / Input Capaian." };
  }
  const last = series[series.length - 1];
  const prev = series.length >= 2 ? series[series.length - 2] : null;
  const tercapai = ind.target == null ? null : (kecilBaik ? last.capaian! <= ind.target : last.capaian! >= ind.target);
  let tren = "—"; let delta = 0;
  if (prev && prev.capaian != null) {
    delta = last.capaian! - prev.capaian;
    tren = Math.abs(delta) < 0.05 ? "stabil" : ((kecilBaik ? delta < 0 : delta > 0) ? "membaik" : "menurun");
  }
  let narasi = `Capaian ${BULAN[last.bulan]}: ${fmt(last.capaian!)} (target ${tgtTxt}). `;
  narasi += tercapai == null ? "" : tercapai ? "TERCAPAI. " : "BELUM tercapai. ";
  if (tren !== "—") narasi += `Tren ${tren} (${delta >= 0 ? "+" : ""}${delta.toFixed(1)} vs ${BULAN[prev!.bulan]}). `;
  narasi += tercapai === false ? "RTL: analisis akar masalah & tetapkan perbaikan, pantau bulan berikutnya."
    : tren === "menurun" ? "RTL: waspadai penurunan, pertahankan kepatuhan." : "Pertahankan capaian.";
  return { latest: last.capaian!, bulan: last.bulan, tercapai, tren, delta, kecilBaik, series, tgtTxt, narasi };
}

function Sparkline({ series, target }: { series: RekapBln[]; target?: number }) {
  const vals = series.filter(p => p.capaian != null);
  if (vals.length < 2) return <div className="text-xs text-slate-400 py-3">tren belum cukup data</div>;
  const w = 200, h = 44, pad = 5;
  const nums = vals.map(v => v.capaian!);
  const min = Math.min(...nums, ...(target != null ? [target] : []));
  const max = Math.max(...nums, ...(target != null ? [target] : []));
  const span = max - min || 1;
  const x = (i: number) => pad + i * (w - 2 * pad) / (vals.length - 1);
  const y = (v: number) => h - pad - (v - min) / span * (h - 2 * pad);
  const d = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v.capaian!).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      {target != null && <line x1={pad} x2={w - pad} y1={y(target)} y2={y(target)} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} />}
      <path d={d} fill="none" stroke="#16a34a" strokeWidth={1.8} />
      {vals.map((v, i) => <circle key={i} cx={x(i)} cy={y(v.capaian!)} r={2} fill="#16a34a" />)}
    </svg>
  );
}

function TabDashboardUnit() {
  const now = new Date();
  const [tahun, setTahun] = useState(now.getFullYear());
  const [data, setData] = useState<MutuRekap | null>(null);
  const [unit, setUnit] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getMutuRekap({ tahun }).then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [tahun]);

  const units = Array.from(new Set((data?.indikator ?? []).map(i => (i.unit ?? "").trim()).filter(Boolean))).sort();
  useEffect(() => { if (units.length && !units.includes(unit)) setUnit(units[0]); }, [units.join(","), unit]);

  const inds = (data?.indikator ?? []).filter(i => (i.unit ?? "") === unit);
  const bulanan = data?.bulanan ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs text-slate-500">Unit
          <select value={unit} onChange={e => setUnit(e.target.value)} className="block border border-slate-300 rounded-lg px-2 py-1.5 text-sm min-w-[180px]">
            {units.length === 0 && <option value="">(tidak ada unit)</option>}
            {units.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">Tahun
          <select value={tahun} onChange={e => setTahun(Number(e.target.value))} className="block border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
            {[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <p className="text-xs text-slate-400 max-w-md">Menampilkan indikator milik unit (IMP-Unit) beserta status & tren otomatis. Indikator INM nasional lihat di tab Rekap & Tren.</p>
      </div>

      {loading && <div className="text-sm text-slate-400">Memuat…</div>}
      {!loading && inds.length === 0 && <div className="text-sm text-slate-400 py-8 text-center">Belum ada indikator untuk unit ini.</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {inds.map(ind => {
          const a = analisaIndikator(ind, bulanan);
          const badge = a.tercapai == null ? "bg-slate-100 text-slate-500"
            : a.tercapai ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
          const trenIcon = a.tren === "membaik" ? "▲" : a.tren === "menurun" ? "▼" : a.tren === "stabil" ? "▬" : "";
          const trenCls = a.tren === "membaik" ? "text-green-600" : a.tren === "menurun" ? "text-red-600" : "text-slate-400";
          return (
            <div key={ind.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  {ind.kode && <div className="text-[11px] font-mono text-slate-400">{ind.kode}</div>}
                  <div className="text-sm font-semibold text-slate-800 leading-tight">{ind.judul}</div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${badge}`}>
                  {a.tercapai == null ? "—" : a.tercapai ? "Tercapai" : "Belum"}
                </span>
              </div>
              <div className="flex items-end gap-2">
                <div className="text-2xl font-bold tabular-nums text-slate-800">
                  {a.latest == null ? "–" : (ind.satuan === "menit" ? a.latest.toFixed(1) : a.latest.toFixed(ind.satuan === "‰" ? 2 : 1))}
                  <span className="text-sm font-normal text-slate-400 ml-0.5">{ind.satuan === "menit" ? "mnt" : ind.satuan}</span>
                </div>
                <div className="text-xs text-slate-400 mb-1">target {a.tgtTxt}</div>
                {trenIcon && <div className={`text-xs mb-1 ${trenCls}`}>{trenIcon} {a.tren}</div>}
              </div>
              <Sparkline series={a.series} target={ind.target ?? undefined} />
              <p className="text-xs text-slate-500 leading-snug">{a.narasi}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab Input Ceklis: observasi patuh/tidak per sampel → auto numerator/denominator ──
function TabCeklis({ isEdit }: { isEdit: boolean }) {
  const now = new Date();
  const [inds, setInds] = useState<MutuIndikator[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [unit, setUnit] = useState("");
  const [tgl, setTgl] = useState(now.toISOString().slice(0, 10));
  const [sampel, setSampel] = useState("");
  const [ket, setKet] = useState("");
  const [rows, setRows] = useState<MutuChecklistRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { getIndikator().then(r => { setInds(r.data); if (r.data[0]) setSel(r.data[0].id); }).catch(() => {}); }, []);
  const load = useCallback(() => {
    if (!sel) return;
    getMutuChecklist(sel, tahun, bulan, unit || undefined).then(r => setRows(r.data)).catch(() => setRows([]));
  }, [sel, tahun, bulan, unit]);
  useEffect(() => { load(); }, [load]);

  const patuh = rows.filter(r => r.patuh).length;
  const total = rows.length;
  const cap = total ? (patuh / total * 100) : 0;

  const tambah = async (p: number) => {
    if (!sel || !isEdit) return;
    setBusy(true); setMsg("");
    try {
      await addMutuChecklist({ indikator_id: sel, unit: unit || undefined, tanggal: tgl, items: [{ patuh: p, sampel: sampel || undefined, keterangan: ket || undefined }] });
      setSampel(""); setKet(""); load();
    } catch { setMsg("Gagal menyimpan observasi."); }
    setBusy(false);
  };
  const hapus = async (id: number) => {
    if (!isEdit) return;
    try { await deleteMutuChecklist(id); load(); } catch { /* ignore */ }
  };
  const rekap = async () => {
    if (!sel || !isEdit) return;
    setBusy(true); setMsg("");
    try {
      const r = await rekapMutuChecklist({ indikator_id: sel, tahun, bulan, unit: unit || undefined });
      setMsg(`Rekap tersimpan ke capaian: ${r.data.numerator}/${r.data.denominator} = ${r.data.capaian.toFixed(1)}%. Lihat di tab Rekap & Tren / Input Capaian.`);
    } catch (e) { setMsg((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal rekap."); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Input observasi kepatuhan per sampel (mis. cuci tangan, APD, identifikasi, risiko jatuh). Tiap klik <b>Patuh</b>/<b>Tidak</b> menambah 1 sampel.
        Numerator = jumlah Patuh, Denominator = jumlah observasi. Klik <b>Rekap ke Capaian</b> untuk menyimpan hasil bulan ini.
      </p>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs text-slate-500">Indikator
          <select value={sel ?? ""} onChange={e => setSel(Number(e.target.value))} className="block border border-slate-300 rounded-lg px-2 py-1.5 text-sm min-w-[260px]">
            {inds.map(i => <option key={i.id} value={i.id}>{i.kode ? `${i.kode} — ` : ""}{i.judul}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">Tahun
          <select value={tahun} onChange={e => setTahun(Number(e.target.value))} className="block border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
            {[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">Bulan
          <select value={bulan} onChange={e => setBulan(Number(e.target.value))} className="block border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
            {BULAN.slice(1).map((b, i) => <option key={i + 1} value={i + 1}>{b}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">Unit
          <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="(opsional)" className="block border border-slate-300 rounded-lg px-2 py-1.5 text-sm w-36" />
        </label>
      </div>

      {isEdit && (
        <div className="flex flex-wrap gap-2 items-end p-3 rounded-lg bg-slate-50 border border-slate-200">
          <label className="text-xs text-slate-500">Tgl observasi
            <input type="date" value={tgl} onChange={e => setTgl(e.target.value)} className="block border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-slate-500">Sampel/identitas
            <input value={sampel} onChange={e => setSampel(e.target.value)} placeholder="mis. Perawat A / Bed 3" className="block border border-slate-300 rounded-lg px-2 py-1.5 text-sm w-44" />
          </label>
          <label className="text-xs text-slate-500">Keterangan
            <input value={ket} onChange={e => setKet(e.target.value)} placeholder="(opsional)" className="block border border-slate-300 rounded-lg px-2 py-1.5 text-sm w-40" />
          </label>
          <button onClick={() => tambah(1)} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">✓ Patuh</button>
          <button onClick={() => tambah(0)} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">✗ Tidak Patuh</button>
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-center">
        <div className="text-sm">Observasi: <b>{total}</b> · Patuh: <b className="text-green-700">{patuh}</b> · Tidak: <b className="text-red-600">{total - patuh}</b></div>
        <div className="text-sm">Capaian bulan ini: <b className={cap >= 85 ? "text-green-700" : "text-amber-600"}>{total ? cap.toFixed(1) : "–"}%</b></div>
        {isEdit && <button onClick={rekap} disabled={busy || !total} className="px-4 py-1.5 text-sm rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50">Rekap ke Capaian →</button>}
      </div>
      {msg && <div className="text-sm text-slate-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</div>}

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr>
            <th className="px-3 py-2 text-left">Tgl</th><th className="px-3 py-2 text-left">Hasil</th>
            <th className="px-3 py-2 text-left">Sampel</th><th className="px-3 py-2 text-left">Keterangan</th>
            <th className="px-3 py-2 text-left">Observer</th>{isEdit && <th className="px-3 py-2"></th>}
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Belum ada observasi.</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 whitespace-nowrap">{r.tanggal}</td>
                <td className="px-3 py-2">{r.patuh ? <span className="text-green-700 font-medium">✓ Patuh</span> : <span className="text-red-600 font-medium">✗ Tidak</span>}</td>
                <td className="px-3 py-2">{r.sampel ?? "–"}</td>
                <td className="px-3 py-2">{r.keterangan ?? "–"}</td>
                <td className="px-3 py-2 text-slate-500">{r.observer ?? "–"}</td>
                {isEdit && <td className="px-3 py-2 text-right"><button onClick={() => hapus(r.id)} className="text-slate-400 hover:text-red-600 text-xs">hapus</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabInput({ isEdit }: { isEdit: boolean }) {
  const nowY = new Date().getFullYear();
  const [inds, setInds] = useState<MutuIndikator[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [tahun, setTahun] = useState(nowY);
  const [unit, setUnit] = useState("");
  const [caps, setCaps] = useState<Record<number, MutuCapaian>>({});
  const [msg, setMsg] = useState("");
  useEffect(() => { getIndikator().then(r => { setInds(r.data); if (r.data[0]) setSel(r.data[0].id); }).catch(() => {}); }, []);
  const load = useCallback(() => {
    if (!sel) return;
    getCapaian(sel, tahun, unit || undefined).then(r => {
      const m: Record<number, MutuCapaian> = {}; r.data.forEach(c => { m[c.bulan] = c; }); setCaps(m);
    }).catch(() => {});
  }, [sel, tahun, unit]);
  useEffect(() => { load(); }, [load]);
  const indObj = inds.find(i => i.id === sel);

  async function save(bulan: number, num: string, den: string, analisa: string, rtl: string) {
    if (!sel) return;
    setMsg("");
    try {
      const r = await upsertCapaian({ indikator_id: sel, unit: unit || undefined, tahun, bulan,
        numerator: num === "" ? undefined : Number(num), denominator: den === "" ? undefined : Number(den), analisa, rtl });
      setCaps(p => ({ ...p, [bulan]: { ...(p[bulan] || {}), bulan, numerator: num === "" ? undefined : Number(num), denominator: den === "" ? undefined : Number(den), capaian: r.data.capaian ?? undefined, analisa, rtl } as MutuCapaian }));
      setMsg(`Bulan ${BULAN[bulan]} tersimpan.`);
    } catch { setMsg("Gagal simpan."); }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <select value={sel ?? ""} onChange={e => setSel(Number(e.target.value))} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[240px]">
          {inds.map(i => <option key={i.id} value={i.id}>{i.kode ? `${i.kode} — ` : ""}{i.judul}</option>)}
        </select>
        <select value={tahun} onChange={e => setTahun(Number(e.target.value))} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          {Array.from({ length: nowY - 2023 }, (_, i) => nowY - i).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unit (kosong=RS)" className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm w-40" />
      </div>
      {indObj && <div className="text-xs text-slate-500">Target: <b>{indObj.target ?? "-"}{indObj.satuan}</b> · Numerator: {indObj.numerator_def || "-"} / Denominator: {indObj.denominator_def || "-"}</div>}
      {msg && <div className="text-xs text-green-700">{msg}</div>}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left"><tr>
            <th className="px-3 py-2">Bulan</th><th className="px-3 py-2">Numerator</th><th className="px-3 py-2">Denominator</th>
            <th className="px-3 py-2">Capaian</th><th className="px-3 py-2">Analisa / RTL</th>{isEdit && <th></th>}
          </tr></thead>
          <tbody>
            {BULAN.slice(1).map((b, i) => <RowInput key={i} bulan={i + 1} label={b} cap={caps[i + 1]} satuan={indObj?.satuan || "%"} target={indObj?.target} isEdit={isEdit} onSave={save} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowInput({ bulan, label, cap, satuan, target, isEdit, onSave }: {
  bulan: number; label: string; cap?: MutuCapaian; satuan: string; target?: number; isEdit: boolean;
  onSave: (bulan: number, num: string, den: string, analisa: string, rtl: string) => void;
}) {
  const [num, setNum] = useState(cap?.numerator != null ? String(cap.numerator) : "");
  const [den, setDen] = useState(cap?.denominator != null ? String(cap.denominator) : "");
  const [analisa, setAnalisa] = useState(cap?.analisa || "");
  const [rtl, setRtl] = useState(cap?.rtl || "");
  useEffect(() => {
    setNum(cap?.numerator != null ? String(cap.numerator) : ""); setDen(cap?.denominator != null ? String(cap.denominator) : "");
    setAnalisa(cap?.analisa || ""); setRtl(cap?.rtl || "");
  }, [cap]);
  const capaian = cap?.capaian;
  const ok = capaian != null && target != null ? capaian >= target : null;
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-3 py-2 font-medium">{label}</td>
      <td className="px-3 py-2"><input type="number" value={num} onChange={e => setNum(e.target.value)} disabled={!isEdit} className="w-24 border border-slate-300 rounded px-2 py-1 text-sm" /></td>
      <td className="px-3 py-2"><input type="number" value={den} onChange={e => setDen(e.target.value)} disabled={!isEdit} className="w-24 border border-slate-300 rounded px-2 py-1 text-sm" /></td>
      <td className={`px-3 py-2 tabular-nums font-semibold ${ok == null ? "text-slate-400" : ok ? "text-green-700" : "text-red-600"}`}>{capaian != null ? `${capaian.toFixed(1)}${satuan}` : "-"}</td>
      <td className="px-3 py-2">
        <input value={analisa} onChange={e => setAnalisa(e.target.value)} disabled={!isEdit} placeholder="Analisa" className="w-full border border-slate-300 rounded px-2 py-1 text-xs mb-1" />
        <input value={rtl} onChange={e => setRtl(e.target.value)} disabled={!isEdit} placeholder="Rencana tindak lanjut" className="w-full border border-slate-300 rounded px-2 py-1 text-xs" />
      </td>
      {isEdit && <td className="px-3 py-2"><button onClick={() => onSave(bulan, num, den, analisa, rtl)} className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700">Simpan</button></td>}
    </tr>
  );
}

// ── Tab Lapor ke Portal regmutufasyankes ─────────────────────────────────────
// Portal Kemenkes tidak punya API, jadi petugas tetap mengetik di websitenya.
// Yang bisa kita bantu: siapkan bahannya supaya tinggal tempel, ingatkan batas
// tanggal 10, dan catat bulan mana yang sudah dikirim.

/** Batas lapor = tanggal 10 bulan BERIKUTNYA pukul 23.59 (Juknis SIMAR). */
function batasLapor(tahun: number, bulan: number) {
  return new Date(bulan === 12 ? tahun + 1 : tahun, bulan === 12 ? 0 : bulan, 10, 23, 59, 59);
}
function salin(teks: string, setMsg: (s: string) => void, label: string) {
  navigator.clipboard.writeText(teks)
    .then(() => setMsg(`${label} disalin.`))
    .catch(() => setMsg("Gagal menyalin — browser menolak akses clipboard."));
}

function TabLapor({ isEdit }: { isEdit: boolean }) {
  const now = new Date();
  // Bulan laporan yang wajar dibuka = bulan LALU, karena itu yang sedang jatuh tempo.
  const lalu = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [tahun, setTahun] = useState(lalu.getFullYear());
  const [bulan, setBulan] = useState(lalu.getMonth() + 1);
  const [rows, setRows] = useState<MutuLaporRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    getMutuLapor(tahun, bulan).then(r => setRows(r.data)).catch(() => setRows([]));
  }, [tahun, bulan]);
  useEffect(() => { load(); }, [load]);

  const batas = batasLapor(tahun, bulan);
  const sisaHari = Math.ceil((batas.getTime() - now.getTime()) / 86400000);
  // INM13 hanya dilaporkan semester — di portal cuma muncul bulan 6 & 12.
  const wajib = rows.filter(r => (r.frekuensi === "semesteran" ? bulan === 6 || bulan === 12 : true));
  const terkirim = wajib.filter(r => r.lapor_status === "Terkirim").length;
  const siap = wajib.filter(r => r.numerator != null && r.denominator != null && r.analisa && r.rtl).length;

  async function tandai(r: MutuLaporRow, terkirim: boolean) {
    setBusy(true);
    try { await tandaiMutuLapor({ indikator_id: r.indikator_id, tahun, bulan, terkirim }); load(); setMsg(""); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Gagal menandai."); }
    finally { setBusy(false); }
  }

  /** Masalah yang bikin ditolak/salah di portal — ditampilkan sebelum dikirim. */
  function masalah(r: MutuLaporRow): string[] {
    const m: string[] = [];
    const semester = r.frekuensi === "semesteran";
    if (semester && bulan !== 6 && bulan !== 12) return ["Semesteran — di portal hanya muncul bulan 6 & 12"];
    if (r.numerator == null || r.denominator == null) m.push("Numerator/denominator belum diisi");
    if (!r.analisa) m.push("Analisa Capaian wajib diisi");
    if (!r.rtl) m.push("Rencana Tindak Lanjut wajib diisi");
    if (r.kode === "INM01" && r.denominator != null && r.denominator <= 200)
      m.push(`Denominator kebersihan tangan harus >200, sekarang ${r.denominator}`);
    return m;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <select value={bulan} onChange={e => setBulan(Number(e.target.value))} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          {BULAN.slice(1).map((b, i) => <option key={i} value={i + 1}>{b}</option>)}
        </select>
        <input type="number" value={tahun} onChange={e => setTahun(Number(e.target.value))} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm w-24" />
        <span className="text-sm text-slate-500">Terkirim {terkirim}/{wajib.length} · siap kirim {siap}/{wajib.length}</span>
        <div className="flex-1" />
        <a href="https://mutufasyankes.kemkes.go.id" target="_blank" rel="noopener noreferrer"
           className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700">Buka portal ↗</a>
      </div>

      {/* Pengingat batas tanggal 10 */}
      <div className={`rounded-xl px-4 py-3 text-sm border ${
        terkirim === wajib.length && wajib.length > 0 ? "bg-green-50 border-green-200 text-green-800"
        : sisaHari < 0 ? "bg-red-50 border-red-200 text-red-800"
        : sisaHari <= 3 ? "bg-amber-50 border-amber-200 text-amber-800"
        : "bg-slate-50 border-slate-200 text-slate-600"}`}>
        <b>Batas lapor {BULAN[bulan]} {tahun}: {batas.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} pukul 23.59.</b>{" "}
        {terkirim === wajib.length && wajib.length > 0 ? "Semua sudah ditandai terkirim."
          : sisaHari < 0 ? `TERLAMBAT ${Math.abs(sisaHari)} hari — segera kirim.`
          : sisaHari === 0 ? "Jatuh tempo HARI INI."
          : `Tersisa ${sisaHari} hari.`}
        <span className="block text-xs mt-1 opacity-80">
          Pastikan di portal statusnya sudah &ldquo;terkirim&rdquo;, bukan sekadar tersimpan. Bulan tanpa kasus tetap dilaporkan dengan angka 0 disertai keterangan di Analisa Capaian.
        </span>
      </div>
      {msg && <div className="text-sm px-3 py-2 rounded-lg bg-slate-100 text-slate-700">{msg}</div>}

      <div className="space-y-2">
        {rows.map(r => {
          const m = masalah(r);
          const kirim = r.lapor_status === "Terkirim";
          const lewati = r.frekuensi === "semesteran" && bulan !== 6 && bulan !== 12;
          return (
            <div key={r.indikator_id} className={`bg-white border rounded-xl p-3 ${kirim ? "border-green-300" : lewati ? "border-slate-200 opacity-60" : "border-slate-200"}`}>
              <div className="flex items-start gap-2 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <div className="text-xs font-mono text-slate-400">{r.kode}</div>
                  <div className="font-medium text-slate-800 text-sm">{r.judul}</div>
                </div>
                <div className="text-sm tabular-nums text-slate-600">
                  {r.numerator ?? "—"} / {r.denominator ?? "—"}
                  <span className="mx-2 text-slate-300">→</span>
                  <b className="text-slate-800">{r.capaian != null ? `${r.capaian.toFixed(2)}${r.satuan}` : "—"}</b>
                  <span className="text-slate-400 text-xs ml-1">(target {r.target ?? "—"}{r.satuan})</span>
                </div>
                {kirim
                  ? <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">✓ Terkirim{r.lapor_waktu ? ` · ${r.lapor_waktu}` : ""}</span>
                  : lewati ? <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-500">semesteran</span>
                  : <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600">Belum</span>}
              </div>

              {m.length > 0 && !lewati && (
                <ul className="mt-2 text-xs text-amber-700 list-disc list-inside">{m.map((x, i) => <li key={i}>{x}</li>)}</ul>
              )}

              {!lewati && (
                <div className="mt-2 flex gap-1.5 flex-wrap items-center">
                  <span className="text-xs text-slate-400 mr-1">Salin:</span>
                  <BtnSalin label="Numerator" nilai={r.numerator} setMsg={setMsg} />
                  <BtnSalin label="Denumerator" nilai={r.denominator} setMsg={setMsg} />
                  <BtnSalin label="Analisa" nilai={r.analisa} setMsg={setMsg} />
                  <BtnSalin label="RTL" nilai={r.rtl} setMsg={setMsg} />
                  <button
                    onClick={() => salin(
                      `${r.kode} — ${r.judul}\nNumerator: ${r.numerator ?? ""}\nDenumerator: ${r.denominator ?? ""}\nAnalisa Capaian: ${r.analisa ?? ""}\nRencana Tindak Lanjut: ${r.rtl ?? ""}`,
                      setMsg, "Semua bidang")}
                    className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50">Semua</button>
                  <div className="flex-1" />
                  {isEdit && (
                    <button onClick={() => tandai(r, !kirim)} disabled={busy || (!kirim && m.length > 0)}
                      title={!kirim && m.length > 0 ? "Lengkapi dulu yang kurang di atas" : ""}
                      className={`px-3 py-1 text-xs rounded-lg disabled:opacity-40 ${kirim ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-green-600 text-white hover:bg-green-700"}`}>
                      {kirim ? "Batalkan penandaan" : "Tandai sudah dikirim"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">Tidak ada indikator INM aktif.</div>}
      </div>
    </div>
  );
}
function BtnSalin({ label, nilai, setMsg }: { label: string; nilai?: number | string | null; setMsg: (s: string) => void }) {
  const kosong = nilai == null || nilai === "";
  return (
    <button onClick={() => salin(String(nilai), setMsg, label)} disabled={kosong}
      className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40">
      {label}
    </button>
  );
}

// ── Tab Profil Indikator ─────────────────────────────────────────────────────
// Kamus indikator: definisi operasional, numerator, denominator, formula,
// target, dimensi, frekuensi. Dibutuhkan surveior akreditasi dan jadi acuan
// petugas saat mengisi laporan ke regmutufasyankes. Bisa dicetak.
function TabProfil({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<MutuIndikator[]>([]);
  const [jenis, setJenis] = useState("inm");
  const [sel, setSel] = useState<number | null>(null);
  const [edit, setEdit] = useState<Partial<MutuIndikator> | null>(null);
  const load = useCallback(() => {
    getIndikator({ jenis }).then(r => {
      setRows(r.data);
      setSel(p => (p && r.data.some(x => x.id === p)) ? p : (r.data[0]?.id ?? null));
    }).catch(() => {});
  }, [jenis]);
  useEffect(() => { load(); }, [load]);
  const p = rows.find(r => r.id === sel) || null;
  // Lengkap = keenam kolom profil terisi. Yang belum ditandai supaya kelihatan.
  const lengkap = (r: MutuIndikator) =>
    !!(r.definisi && r.numerator_def && r.denominator_def && r.formula && r.dimensi && r.frekuensi);
  const belum = rows.filter(r => !lengkap(r)).length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center no-print">
        <select value={jenis} onChange={e => setJenis(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          {Object.entries(JENIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {belum > 0
          ? <span className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">{belum} indikator profilnya belum lengkap</span>
          : <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200">Profil lengkap semua</span>}
        <div className="flex-1" />
        {p && <button onClick={() => window.print()} className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 hover:bg-slate-200">🖨 Cetak</button>}
        {p && isEdit && <button onClick={() => setEdit(p)} className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700">Lengkapi / Ubah</button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden self-start no-print">
          {rows.map(r => (
            <button key={r.id} onClick={() => setSel(r.id)}
              className={`w-full text-left px-3 py-2 text-sm border-b border-slate-100 last:border-0 ${sel === r.id ? "bg-green-50 text-green-800" : "hover:bg-slate-50"}`}>
              <span className="font-mono text-xs text-slate-400 mr-2">{r.kode || "—"}</span>
              {r.judul}
              {!lengkap(r) && <span className="ml-1 text-amber-500" title="Profil belum lengkap">•</span>}
            </button>
          ))}
          {rows.length === 0 && <div className="px-3 py-6 text-sm text-slate-400 text-center">Tidak ada indikator.</div>}
        </div>

        {p ? (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <div className="text-xs text-slate-400 font-mono">{p.kode || "—"} · {JENIS[p.jenis] || p.jenis}{p.unit ? ` · ${p.unit}` : ""}</div>
              <h2 className="text-lg font-bold text-slate-800">{p.judul}</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kotak label="Target" nilai={p.target != null ? `${p.target}${p.satuan}` : "—"} />
              <Kotak label="Satuan" nilai={p.satuan} />
              <Kotak label="Frekuensi" nilai={p.frekuensi || "—"} />
              <Kotak label="Dimensi Mutu" nilai={p.dimensi || "—"} />
            </div>
            <Bagian judul="Definisi Operasional" isi={p.definisi} />
            <Bagian judul="Numerator" isi={p.numerator_def} />
            <Bagian judul="Denominator" isi={p.denominator_def} />
            <Bagian judul="Formula" isi={p.formula} mono />
            <Bagian judul="Metode & Ketentuan" isi={p.standar} />
          </div>
        ) : <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">Pilih indikator di sebelah kiri.</div>}
      </div>
      {edit && <FormIndikator init={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}
function Kotak({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-medium text-slate-800">{nilai}</div>
    </div>
  );
}
function Bagian({ judul, isi, mono }: { judul: string; isi?: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{judul}</div>
      {isi
        ? <p className={`text-sm text-slate-700 whitespace-pre-wrap ${mono ? "font-mono" : ""}`}>{isi}</p>
        : <p className="text-sm text-amber-600 italic">Belum diisi</p>}
    </div>
  );
}

function TabIndikator({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<MutuIndikator[]>([]);
  const [jenis, setJenis] = useState(""); const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Partial<MutuIndikator> | null>(null);
  const load = useCallback(() => { getIndikator({ jenis, q }).then(r => setRows(r.data)).catch(() => {}); }, [jenis, q]);
  useEffect(() => { load(); }, [load]);
  async function hapus(id: number) { if (!confirm("Hapus indikator ini (beserta capaiannya)?")) return; await deleteIndikator(id); load(); }
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari indikator…" className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px]" />
        <select value={jenis} onChange={e => setJenis(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Semua jenis</option>{Object.entries(JENIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {isEdit && <button onClick={() => setEdit({ jenis: "imp_unit", satuan: "%", status: "aktif" })} className="px-4 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700">+ Indikator</button>}
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left"><tr>
            <th className="px-3 py-2">Kode</th><th className="px-3 py-2">Judul</th><th className="px-3 py-2">Jenis</th>
            <th className="px-3 py-2">Unit</th><th className="px-3 py-2">Target</th>{isEdit && <th></th>}
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{r.kode}</td>
                <td className="px-3 py-2 max-w-[320px]">{r.judul}</td>
                <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded bg-slate-100">{JENIS[r.jenis] || r.jenis}</span></td>
                <td className="px-3 py-2 text-slate-500">{r.unit || "-"}</td>
                <td className="px-3 py-2 tabular-nums">{r.target ?? "-"}{r.satuan}</td>
                {isEdit && <td className="px-3 py-2 whitespace-nowrap text-xs space-x-2"><button onClick={() => setEdit(r)} className="text-green-700 hover:underline">edit</button><button onClick={() => hapus(r.id)} className="text-slate-400 hover:text-red-600">hapus</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <FormIndikator init={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function FormIndikator({ init, onClose, onSaved }: { init: Partial<MutuIndikator>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<MutuIndikator>>(init);
  const set = (k: keyof MutuIndikator, v: string | number) => setF(p => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);
  async function simpan() {
    if (!f.judul?.trim()) return;
    setBusy(true);
    try { if (f.id) await updateIndikator(f.id, f); else await createIndikator(f); onSaved(); } catch { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mt-8 mb-8" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between px-5 py-3 border-b border-slate-200"><h3 className="font-semibold">{f.id ? "Edit" : "Tambah"} Indikator</h3><button onClick={onClose} className="text-slate-400 text-xl">×</button></div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={f.kode || ""} onChange={e => set("kode", e.target.value)} placeholder="Kode" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <select value={f.jenis} onChange={e => set("jenis", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">{Object.entries(JENIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </div>
          <input value={f.judul || ""} onChange={e => set("judul", e.target.value)} placeholder="Judul indikator (wajib)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-3 gap-2">
            <input value={f.unit || ""} onChange={e => set("unit", e.target.value)} placeholder="Unit" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <select value={f.satuan} onChange={e => set("satuan", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm"><option value="%">%</option><option value="‰">‰</option><option value="menit">menit</option></select>
            <input type="number" value={f.target ?? ""} onChange={e => set("target", Number(e.target.value))} placeholder="Target" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={f.frekuensi || "bulanan"} onChange={e => set("frekuensi", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              {["harian", "mingguan", "bulanan", "triwulanan", "semesteran", "tahunan"].map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <input value={f.dimensi || ""} onChange={e => set("dimensi", e.target.value)} placeholder="Dimensi mutu" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <textarea value={f.definisi || ""} onChange={e => set("definisi", e.target.value)} rows={3} placeholder="Definisi operasional" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <textarea value={f.numerator_def || ""} onChange={e => set("numerator_def", e.target.value)} rows={2} placeholder="Numerator — apa yang dihitung di pembilang" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <textarea value={f.denominator_def || ""} onChange={e => set("denominator_def", e.target.value)} rows={2} placeholder="Denominator — apa yang dihitung di penyebut" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={f.formula || ""} onChange={e => set("formula", e.target.value)} placeholder="Formula, mis. (Numerator / Denominator) x 100%" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <textarea value={f.standar || ""} onChange={e => set("standar", e.target.value)} rows={2} placeholder="Metode & ketentuan khusus (mis. metode observasi, denominator minimal 200)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-slate-100">Batal</button><button onClick={simpan} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white">{busy ? "…" : "Simpan"}</button></div>
        </div>
      </div>
    </div>
  );
}
