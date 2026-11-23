"use client";

// Manajemen Risiko / FMEA. Register risiko + FMEA (Severity x Occurrence x
// Detectability = RPN) + RPN residual (pasca-mitigasi) + rencana mitigasi
// (Program/Kegiatan/PIC/Target/Status) per risiko.

import { useCallback, useEffect, useState } from "react";
import {
  listManajemenRisiko, detailManajemenRisiko, simpanManajemenRisiko, hapusManajemenRisiko,
  simpanMitigasiRisiko, hapusMitigasiRisiko,
  RisikoRow, MitigasiRow, ManajemenRisikoResp, RisikoInput,
} from "@/lib/api";

const KATEGORI = ["Klinis", "Operasional", "Keuangan", "Kepatuhan/Hukum", "Reputasi", "Strategis", "K3/Fasilitas"];
const STATUS_RISIKO = ["Identifikasi", "Analisa", "Mitigasi", "Dipantau", "Selesai"];
const STATUS_MIT = ["Rencana", "Proses", "Selesai", "Tertunda"];
const SOD = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function gradeColor(g: string | null) {
  switch (g) {
    case "Sangat Tinggi": return "bg-red-100 text-red-700 border-red-300";
    case "Tinggi": return "bg-orange-100 text-orange-700 border-orange-300";
    case "Sedang": return "bg-amber-100 text-amber-700 border-amber-300";
    case "Rendah": return "bg-emerald-100 text-emerald-700 border-emerald-300";
    default: return "bg-slate-100 text-slate-500 border-slate-200";
  }
}
function gradeOf(rpn: number) {
  return rpn >= 200 ? "Sangat Tinggi" : rpn >= 100 ? "Tinggi" : rpn >= 40 ? "Sedang" : "Rendah";
}
function toDMY(iso?: string | null) { if (!iso) return ""; const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}-${m}-${y}`; }

const EMPTY: RisikoInput = {
  tahun: new Date().getFullYear(), unit: "", kategori: "Operasional", proses: "",
  modus_kegagalan: "", penyebab: "", dampak: "",
  severity: 1, occurrence: 1, detectability: 1,
  severity_residu: null, occurrence_residu: null, detectability_residu: null,
  pic: "", target_tanggal: "", status: "Identifikasi", tanggal_identifikasi: "", keterangan: "",
};

export default function ManajemenRisikoPage() {
  const [tahun, setTahun] = useState<number>(new Date().getFullYear());
  const [q, setQ] = useState("");
  const [resp, setResp] = useState<ManajemenRisikoResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<RisikoInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [expand, setExpand] = useState<number | null>(null);
  const [mits, setMits] = useState<MitigasiRow[]>([]);
  const [mitForm, setMitForm] = useState<(Partial<MitigasiRow> & { id_risiko: number }) | null>(null);
  const [mitSaving, setMitSaving] = useState(false);

  const muat = useCallback(() => {
    setLoading(true); setExpand(null);
    listManajemenRisiko({ tahun, q })
      .then(r => setResp(r.data))
      .catch(() => setResp(null))
      .finally(() => setLoading(false));
  }, [tahun, q]);
  useEffect(() => { muat(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const set = (k: keyof RisikoInput, v: unknown) => setForm(f => f ? { ...f, [k]: v } : f);
  const rpnLive = (form?.severity ?? 1) * (form?.occurrence ?? 1) * (form?.detectability ?? 1);
  const hasResidu = form?.severity_residu && form?.occurrence_residu && form?.detectability_residu;
  const rpnResiduLive = hasResidu ? (form!.severity_residu! * form!.occurrence_residu! * form!.detectability_residu!) : null;

  async function simpanRisiko() {
    if (!form) return;
    if (!(form.proses || "").trim() && !(form.modus_kegagalan || "").trim()) { alert("Isi minimal Proses atau Modus Kegagalan"); return; }
    setSaving(true);
    try { await simpanManajemenRisiko(form); setForm(null); muat(); }
    catch { alert("Gagal menyimpan risiko"); }
    finally { setSaving(false); }
  }
  async function hapusRisiko(r: RisikoRow) {
    if (!window.confirm(`Hapus risiko "${r.proses || r.modus_kegagalan}" beserta mitigasinya?`)) return;
    try { await hapusManajemenRisiko(r.id); muat(); } catch { alert("Gagal menghapus"); }
  }
  async function bukaMitigasi(r: RisikoRow) {
    if (expand === r.id) { setExpand(null); return; }
    setExpand(r.id); setMits([]); setMitForm(null);
    try { const d = await detailManajemenRisiko(r.id); setMits(d.data.mitigasi); } catch { setMits([]); }
  }
  async function simpanMit() {
    if (!mitForm) return;
    setMitSaving(true);
    try {
      await simpanMitigasiRisiko(mitForm);
      const d = await detailManajemenRisiko(mitForm.id_risiko);
      setMits(d.data.mitigasi); setMitForm(null);
      muat();
    } catch { alert("Gagal menyimpan mitigasi"); }
    finally { setMitSaving(false); }
  }
  async function hapusMit(m: MitigasiRow, idRisiko: number) {
    if (!window.confirm("Hapus baris mitigasi ini?")) return;
    try { await hapusMitigasiRisiko(m.id); const d = await detailManajemenRisiko(idRisiko); setMits(d.data.mitigasi); muat(); }
    catch { alert("Gagal menghapus"); }
  }

  const inp = "border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm";
  const th = "px-2 py-2 text-xs font-bold text-slate-600 border-b border-slate-200 text-left whitespace-nowrap";
  const td = "px-2 py-1.5 text-sm border-b border-slate-100 align-top";
  const ring = resp?.ringkasan;
  const rows = resp?.data ?? [];
  const tahunList = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <div className="no-print flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-800">🛡️ Manajemen Risiko / FMEA</h1>
          <p className="text-xs text-slate-500">Register risiko + FMEA (Severity × Occurrence × Detectability = RPN) + rencana mitigasi.</p>
        </div>
        <button onClick={() => setForm({ ...EMPTY, tahun })}
          className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg px-4 py-2 shrink-0">+ Risiko Baru</button>
      </div>

      <div className="no-print flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Tahun</span>
          <select value={tahun} onChange={e => setTahun(Number(e.target.value))} className={inp}>
            {tahunList.map(y => <option key={y} value={y}>{y}</option>)}
          </select></label>
        <label className="flex flex-col gap-1 flex-1 min-w-[180px]"><span className="text-[11px] font-semibold text-slate-500">Cari (unit/proses/modus)</span>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && muat()} className={inp} placeholder="ketik lalu Enter…" /></label>
        <button onClick={muat} className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Tampilkan</button>
        <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg px-4 py-2">Cetak</button>
      </div>

      <div className="hidden print:block text-center mb-1">
        <div className="text-base font-bold">Register Risiko / FMEA — Tahun {tahun}</div>
      </div>

      {ring && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-[11px] text-slate-500">Total Risiko</div><div className="text-xl font-bold text-slate-800 tabular-nums">{ring.total}</div></div>
          <div className="bg-white border border-red-200 rounded-xl p-3"><div className="text-[11px] text-red-600">Sangat Tinggi</div><div className="text-xl font-bold text-red-700 tabular-nums">{ring.sangat_tinggi}</div></div>
          <div className="bg-white border border-orange-200 rounded-xl p-3"><div className="text-[11px] text-orange-600">Tinggi</div><div className="text-xl font-bold text-orange-700 tabular-nums">{ring.tinggi}</div></div>
          <div className="bg-white border border-amber-200 rounded-xl p-3"><div className="text-[11px] text-amber-600">Sedang</div><div className="text-xl font-bold text-amber-700 tabular-nums">{ring.sedang}</div></div>
          <div className="bg-white border border-emerald-200 rounded-xl p-3"><div className="text-[11px] text-emerald-600">Rendah</div><div className="text-xl font-bold text-emerald-700 tabular-nums">{ring.rendah}</div></div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50"><tr>
            <th className={th}>Unit / Proses</th><th className={th}>Modus Kegagalan</th><th className={th}>Dampak</th>
            <th className={`${th} text-center`}>S</th><th className={`${th} text-center`}>O</th><th className={`${th} text-center`}>D</th>
            <th className={`${th} text-center`}>RPN</th><th className={`${th} text-center`}>RPN Residu</th>
            <th className={th}>Status</th><th className={`${th} text-center no-print`}>Aksi</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center text-slate-400 text-sm py-8">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="text-center text-slate-400 text-sm py-8">Belum ada data risiko. Klik “+ Risiko Baru”.</td></tr>
            ) : rows.map(r => (
              <RiskRowView key={r.id} r={r} td={td}
                expanded={expand === r.id} mits={mits} mitForm={mitForm} mitSaving={mitSaving}
                onToggle={() => bukaMitigasi(r)} onEdit={() => setForm({ ...r })} onDelete={() => hapusRisiko(r)}
                onAddMit={() => setMitForm({ id_risiko: r.id, program: "", kegiatan: "", pic: "", target: "", status: "Rencana", progres: "", urut: mits.length })}
                onEditMit={(m) => setMitForm({ ...m, id_risiko: r.id })}
                onDelMit={(m) => hapusMit(m, r.id)}
                setMitForm={setMitForm} simpanMit={simpanMit} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-slate-400 no-print">
        RPN = S × O × D (masing-masing 1–10). Band: <b className="text-red-600">≥200 Sangat Tinggi</b>, <b className="text-orange-600">100–199 Tinggi</b>, <b className="text-amber-600">40–99 Sedang</b>, <b className="text-emerald-600">&lt;40 Rendah</b>. RPN Residu = penilaian ulang setelah mitigasi.
      </div>

      {/* ── Form Risiko (modal) ── */}
      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4 no-print">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 className="font-bold text-slate-800">{form.id ? "Edit Risiko" : "Risiko Baru"}</h2>
              <button onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <L label="Tahun"><input type="number" value={form.tahun ?? ""} onChange={e => set("tahun", Number(e.target.value))} className={inp + " w-full"} /></L>
                <L label="Unit / Bagian"><input value={form.unit ?? ""} onChange={e => set("unit", e.target.value)} className={inp + " w-full"} /></L>
                <L label="Kategori"><select value={form.kategori ?? ""} onChange={e => set("kategori", e.target.value)} className={inp + " w-full"}>{KATEGORI.map(k => <option key={k}>{k}</option>)}</select></L>
                <L label="Status"><select value={form.status ?? ""} onChange={e => set("status", e.target.value)} className={inp + " w-full"}>{STATUS_RISIKO.map(k => <option key={k}>{k}</option>)}</select></L>
              </div>
              <L label="Proses / Kegiatan"><input value={form.proses ?? ""} onChange={e => set("proses", e.target.value)} className={inp + " w-full"} placeholder="mis. Pengelolaan stok obat" /></L>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <L label="Modus Kegagalan / Risiko"><textarea value={form.modus_kegagalan ?? ""} onChange={e => set("modus_kegagalan", e.target.value)} rows={2} className={inp + " w-full"} /></L>
                <L label="Penyebab"><textarea value={form.penyebab ?? ""} onChange={e => set("penyebab", e.target.value)} rows={2} className={inp + " w-full"} /></L>
                <L label="Dampak / Efek"><textarea value={form.dampak ?? ""} onChange={e => set("dampak", e.target.value)} rows={2} className={inp + " w-full"} /></L>
              </div>
              {/* FMEA scoring */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-xs font-bold text-slate-600 mb-2">Penilaian FMEA (awal)</div>
                <div className="flex flex-wrap items-end gap-3">
                  <L label="Severity (S)"><select value={form.severity ?? 1} onChange={e => set("severity", Number(e.target.value))} className={inp}>{SOD.map(n => <option key={n}>{n}</option>)}</select></L>
                  <L label="Occurrence (O)"><select value={form.occurrence ?? 1} onChange={e => set("occurrence", Number(e.target.value))} className={inp}>{SOD.map(n => <option key={n}>{n}</option>)}</select></L>
                  <L label="Detectability (D)"><select value={form.detectability ?? 1} onChange={e => set("detectability", Number(e.target.value))} className={inp}>{SOD.map(n => <option key={n}>{n}</option>)}</select></L>
                  <div className="ml-auto text-right">
                    <div className="text-[11px] text-slate-500">RPN = S×O×D</div>
                    <div className={`inline-block px-3 py-1 rounded-lg border font-bold tabular-nums ${gradeColor(gradeOf(rpnLive))}`}>{rpnLive} · {gradeOf(rpnLive)}</div>
                  </div>
                </div>
              </div>
              {/* Residual */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-xs font-bold text-slate-600 mb-2">Penilaian ulang setelah mitigasi (RPN residu) — opsional</div>
                <div className="flex flex-wrap items-end gap-3">
                  <L label="S residu"><select value={form.severity_residu ?? ""} onChange={e => set("severity_residu", e.target.value ? Number(e.target.value) : null)} className={inp}><option value="">—</option>{SOD.map(n => <option key={n}>{n}</option>)}</select></L>
                  <L label="O residu"><select value={form.occurrence_residu ?? ""} onChange={e => set("occurrence_residu", e.target.value ? Number(e.target.value) : null)} className={inp}><option value="">—</option>{SOD.map(n => <option key={n}>{n}</option>)}</select></L>
                  <L label="D residu"><select value={form.detectability_residu ?? ""} onChange={e => set("detectability_residu", e.target.value ? Number(e.target.value) : null)} className={inp}><option value="">—</option>{SOD.map(n => <option key={n}>{n}</option>)}</select></L>
                  <div className="ml-auto text-right">
                    <div className="text-[11px] text-slate-500">RPN residu</div>
                    <div className={`inline-block px-3 py-1 rounded-lg border font-bold tabular-nums ${rpnResiduLive ? gradeColor(gradeOf(rpnResiduLive)) : "bg-slate-100 text-slate-400 border-slate-200"}`}>{rpnResiduLive ? `${rpnResiduLive} · ${gradeOf(rpnResiduLive)}` : "—"}</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <L label="PIC / Penanggung Jawab"><input value={form.pic ?? ""} onChange={e => set("pic", e.target.value)} className={inp + " w-full"} /></L>
                <L label="Tgl Identifikasi"><input type="date" value={(form.tanggal_identifikasi ?? "").slice(0, 10)} onChange={e => set("tanggal_identifikasi", e.target.value)} className={inp + " w-full"} /></L>
                <L label="Target Selesai"><input type="date" value={(form.target_tanggal ?? "").slice(0, 10)} onChange={e => set("target_tanggal", e.target.value)} className={inp + " w-full"} /></L>
              </div>
              <L label="Keterangan"><textarea value={form.keterangan ?? ""} onChange={e => set("keterangan", e.target.value)} rows={2} className={inp + " w-full"} /></L>
            </div>
            <div className="flex gap-2 px-4 py-3 border-t border-slate-200">
              <button onClick={simpanRisiko} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">{saving ? "Menyimpan…" : "Simpan Risiko"}</button>
              <button onClick={() => setForm(null)} className="px-4 bg-white border border-slate-300 text-slate-600 text-sm font-semibold rounded-lg py-2">Batal</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`@media print { .no-print { display: none !important; } @page { size: A4 landscape; margin: 8mm; } }`}</style>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">{label}</span>{children}</label>;
}

function RiskRowView(props: {
  r: RisikoRow; td: string; expanded: boolean; mits: MitigasiRow[];
  mitForm: (Partial<MitigasiRow> & { id_risiko: number }) | null; mitSaving: boolean;
  onToggle: () => void; onEdit: () => void; onDelete: () => void;
  onAddMit: () => void; onEditMit: (m: MitigasiRow) => void; onDelMit: (m: MitigasiRow) => void;
  setMitForm: (f: (Partial<MitigasiRow> & { id_risiko: number }) | null) => void; simpanMit: () => void;
}) {
  const { r, td, expanded, mits, mitForm, mitSaving } = props;
  const inp = "border border-slate-300 rounded px-2 py-1 text-xs";
  return (
    <>
      <tr className="hover:bg-slate-50/60">
        <td className={td}>
          <button onClick={props.onToggle} className="text-left">
            <div className="font-semibold text-slate-700">{r.unit || <span className="text-slate-300">—</span>}</div>
            <div className="text-xs text-slate-500">{r.proses}</div>
            <div className="text-[10px] text-teal-600 no-print">{expanded ? "▾" : "▸"} {r.jml_mitigasi} mitigasi</div>
          </button>
        </td>
        <td className={`${td} text-xs max-w-[220px]`}>{r.modus_kegagalan}{r.penyebab && <div className="text-[10px] text-slate-400">Penyebab: {r.penyebab}</div>}</td>
        <td className={`${td} text-xs max-w-[180px]`}>{r.dampak}</td>
        <td className={`${td} text-center tabular-nums`}>{r.severity}</td>
        <td className={`${td} text-center tabular-nums`}>{r.occurrence}</td>
        <td className={`${td} text-center tabular-nums`}>{r.detectability}</td>
        <td className={`${td} text-center`}><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border tabular-nums ${gradeColor(r.grading)}`}>{r.rpn}</span></td>
        <td className={`${td} text-center`}>{r.rpn_residu != null ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border tabular-nums ${gradeColor(r.grading_residu)}`}>{r.rpn_residu}</span> : <span className="text-slate-300">—</span>}</td>
        <td className={`${td} text-xs`}>{r.status}{r.pic && <div className="text-[10px] text-slate-400">{r.pic}</div>}{r.target_tanggal && <div className="text-[10px] text-slate-400">Target: {toDMY(r.target_tanggal)}</div>}</td>
        <td className={`${td} text-center no-print whitespace-nowrap`}>
          <button onClick={props.onEdit} className="text-teal-600 hover:text-teal-800 text-xs font-semibold">Edit</button>
          <button onClick={props.onDelete} className="text-red-500 hover:text-red-700 text-xs font-semibold ml-2">Hapus</button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={10} className="bg-slate-50 border-b border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-slate-600">Rencana Mitigasi Risiko</div>
              <button onClick={props.onAddMit} className="no-print bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded px-3 py-1">+ Mitigasi</button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full border-collapse">
                <thead className="bg-slate-100"><tr>
                  <th className="px-2 py-1.5 text-[11px] font-bold text-slate-500 text-left">Program</th>
                  <th className="px-2 py-1.5 text-[11px] font-bold text-slate-500 text-left">Kegiatan</th>
                  <th className="px-2 py-1.5 text-[11px] font-bold text-slate-500 text-left">PIC</th>
                  <th className="px-2 py-1.5 text-[11px] font-bold text-slate-500 text-left">Target</th>
                  <th className="px-2 py-1.5 text-[11px] font-bold text-slate-500 text-left">Status</th>
                  <th className="px-2 py-1.5 text-[11px] font-bold text-slate-500 text-left">Progres</th>
                  <th className="px-2 py-1.5 text-[11px] font-bold text-slate-500 text-center no-print">Aksi</th>
                </tr></thead>
                <tbody>
                  {mits.length === 0 && !mitForm ? (
                    <tr><td colSpan={7} className="text-center text-slate-400 text-xs py-4">Belum ada rencana mitigasi.</td></tr>
                  ) : mits.map(m => (
                    <tr key={m.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 text-xs">{m.program}</td>
                      <td className="px-2 py-1.5 text-xs max-w-[260px]">{m.kegiatan}</td>
                      <td className="px-2 py-1.5 text-xs">{m.pic}</td>
                      <td className="px-2 py-1.5 text-xs">{m.target}</td>
                      <td className="px-2 py-1.5 text-xs">{m.status}</td>
                      <td className="px-2 py-1.5 text-xs">{m.progres}</td>
                      <td className="px-2 py-1.5 text-center no-print whitespace-nowrap">
                        <button onClick={() => props.onEditMit(m)} className="text-teal-600 hover:text-teal-800 text-[11px] font-semibold">Edit</button>
                        <button onClick={() => props.onDelMit(m)} className="text-red-500 hover:text-red-700 text-[11px] font-semibold ml-2">Hapus</button>
                      </td>
                    </tr>
                  ))}
                  {mitForm && mitForm.id_risiko === r.id && (
                    <tr className="border-t border-slate-200 bg-teal-50/40 no-print">
                      <td className="px-2 py-1.5"><input value={mitForm.program ?? ""} onChange={e => props.setMitForm({ ...mitForm, program: e.target.value })} className={inp + " w-full"} placeholder="Program" /></td>
                      <td className="px-2 py-1.5"><input value={mitForm.kegiatan ?? ""} onChange={e => props.setMitForm({ ...mitForm, kegiatan: e.target.value })} className={inp + " w-full"} placeholder="Kegiatan" /></td>
                      <td className="px-2 py-1.5"><input value={mitForm.pic ?? ""} onChange={e => props.setMitForm({ ...mitForm, pic: e.target.value })} className={inp + " w-full"} placeholder="PIC" /></td>
                      <td className="px-2 py-1.5"><input value={mitForm.target ?? ""} onChange={e => props.setMitForm({ ...mitForm, target: e.target.value })} className={inp + " w-full"} placeholder="Bulanan…" /></td>
                      <td className="px-2 py-1.5"><select value={mitForm.status ?? "Rencana"} onChange={e => props.setMitForm({ ...mitForm, status: e.target.value })} className={inp + " w-full"}>{STATUS_MIT.map(s => <option key={s}>{s}</option>)}</select></td>
                      <td className="px-2 py-1.5"><input value={mitForm.progres ?? ""} onChange={e => props.setMitForm({ ...mitForm, progres: e.target.value })} className={inp + " w-full"} placeholder="Progres" /></td>
                      <td className="px-2 py-1.5 text-center whitespace-nowrap">
                        <button onClick={props.simpanMit} disabled={mitSaving} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[11px] font-semibold rounded px-2 py-1">{mitSaving ? "…" : "Simpan"}</button>
                        <button onClick={() => props.setMitForm(null)} className="text-slate-500 text-[11px] ml-2">Batal</button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {r.keterangan && <div className="mt-2 text-[11px] text-slate-500">Keterangan: {r.keterangan}</div>}
          </td>
        </tr>
      )}
    </>
  );
}
