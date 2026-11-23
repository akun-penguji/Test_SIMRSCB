"use client";

// Generator Dokumen Mutu — SK Direktur & SPO/SOP. Isi terstruktur, TTD tempel,
// ekspor .docx/.pdf (LibreOffice), preview, kaitkan ke EP akreditasi.

import { useCallback, useEffect, useState } from "react";
import { hasPerm, getSession } from "@/lib/auth";
import {
  getDokList, getDok, createDok, updateDok, deleteDok, nextNomorDok,
  previewDok, exportDok, uploadLaporFoto, getOoConfig, DokGen,
} from "@/lib/api";

type Data = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : [""]);

function download(blob: Blob, filename: string) {
  const u = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
}

export default function DokumenMutuPage() {
  const isEdit = hasPerm("akreditasi_edit");
  const [rows, setRows] = useState<DokGen[]>([]);
  const [jenis, setJenis] = useState(""); const [q, setQ] = useState("");
  const [edit, setEdit] = useState<DokGen | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [ooId, setOoId] = useState<number | null>(null);

  const load = useCallback(() => { getDokList({ jenis, q }).then(r => setRows(r.data)).catch(() => {}); }, [jenis, q]);
  useEffect(() => { load(); }, [load]);

  function baru(j: "sk" | "spo") {
    const nama = getSession()?.nama || "";
    setEdit({ id: 0, jenis: j, judul: "", status: "draft", pejabat_jabatan: "Direktur RSUD Cabangbungin",
      pejabat_nama: "", no_revisi: j === "spo" ? "00" : undefined, data: {}, ttd_img: "", nomor: "", tanggal: "" });
    void nama;
  }
  async function buka(id: number) { const r = await getDok(id); setEdit(r.data); }
  async function preview(id: number) {
    const r = await previewDok(id);
    const origin = window.location.origin;
    setPreviewHtml((r.data as string).replace(/src="\/api\//g, `src="${origin}/api/`));
  }
  async function ekspor(id: number, f: "docx" | "pdf") {
    const r = await exportDok(id, f);
    const row = rows.find(x => x.id === id);
    download(r.data as Blob, `${(row?.jenis || "dok").toUpperCase()}-${(row?.nomor || id).toString().replace(/[/ \\]/g, "_")}.${f}`);
  }
  async function hapus(id: number) { if (!confirm("Hapus dokumen ini?")) return; await deleteDok(id); load(); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">📄 Generator Dokumen Mutu</h1>
          <p className="text-sm text-slate-500">Buat SK Direktur & SPO/SOP berformat baku, ekspor Word/PDF, lampirkan ke EP akreditasi.</p>
        </div>
        {isEdit && <div className="flex gap-2">
          <button onClick={() => baru("sk")} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">+ SK Direktur</button>
          <button onClick={() => baru("spo")} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700">+ SPO / SOP</button>
        </div>}
      </div>

      <div className="flex gap-2 flex-wrap">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari judul / nomor…" className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px]" />
        <select value={jenis} onChange={e => setJenis(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Semua jenis</option><option value="sk">SK Direktur</option><option value="spo">SPO / SOP</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left"><tr>
            <th className="px-3 py-2">Jenis</th><th className="px-3 py-2">Nomor</th><th className="px-3 py-2">Judul</th>
            <th className="px-3 py-2">Tanggal</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Aksi</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs ${r.jenis === "sk" ? "bg-indigo-100 text-indigo-700" : "bg-green-100 text-green-700"}`}>{r.jenis.toUpperCase()}</span></td>
                <td className="px-3 py-2 font-mono text-xs">{r.nomor || "-"}</td>
                <td className="px-3 py-2 max-w-[320px] truncate">{r.judul}</td>
                <td className="px-3 py-2 text-slate-500">{r.tanggal || "-"}</td>
                <td className="px-3 py-2 text-xs">{r.status}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs space-x-2">
                  <button onClick={() => preview(r.id)} className="text-slate-600 hover:underline">Pratinjau</button>
                  <button onClick={() => ekspor(r.id, "docx")} className="text-blue-600 hover:underline">Word</button>
                  <button onClick={() => ekspor(r.id, "pdf")} className="text-red-600 hover:underline">PDF</button>
                  {isEdit && <button onClick={() => setOoId(r.id)} className="text-indigo-600 hover:underline font-medium">Edit di Word</button>}
                  {isEdit && <button onClick={() => buka(r.id)} className="text-green-700 hover:underline">Edit Isi</button>}
                  {isEdit && <button onClick={() => hapus(r.id)} className="text-slate-400 hover:text-red-600">hapus</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">Belum ada dokumen.</td></tr>}
          </tbody>
        </table>
      </div>

      {edit && <Editor doc={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} onPreview={preview} />}
      {ooId !== null && <OnlyOfficeEditor id={ooId} onClose={() => { setOoId(null); load(); }} />}
      {previewHtml !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewHtml(null)}>
          <div className="bg-white rounded-xl w-full max-w-4xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-4 py-2 border-b border-slate-200">
              <span className="font-semibold text-slate-700">Pratinjau Dokumen</span>
              <button onClick={() => setPreviewHtml(null)} className="text-slate-400 text-xl">×</button>
            </div>
            <iframe srcDoc={previewHtml} className="flex-1 w-full rounded-b-xl" title="preview" />
          </div>
        </div>
      )}
    </div>
  );
}

function DynList({ label, items, onChange, ph }: { label: string; items: string[]; onChange: (v: string[]) => void; ph?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between"><label className="text-sm font-medium text-slate-600">{label}</label>
        <button type="button" onClick={() => onChange([...items, ""])} className="text-xs text-green-700 hover:underline">+ tambah</button></div>
      <div className="space-y-2 mt-1">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-xs text-slate-400 pt-2 w-5">{i + 1}.</span>
            <textarea value={it} onChange={e => { const n = [...items]; n[i] = e.target.value; onChange(n); }} rows={2} placeholder={ph}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
            {items.length > 1 && <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 px-1">×</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Editor({ doc, onClose, onSaved, onPreview }: { doc: DokGen; onClose: () => void; onSaved: () => void; onPreview: (id: number) => void }) {
  const isSpo = doc.jenis === "spo";
  const d0 = (doc.data || {}) as Data;
  const [f, setF] = useState({
    nomor: doc.nomor || "", judul: doc.judul || "", tanggal: doc.tanggal || "", no_revisi: doc.no_revisi || "00",
    unit: doc.unit || "", pejabat_nama: doc.pejabat_nama || "", pejabat_nip: doc.pejabat_nip || "",
    pejabat_jabatan: doc.pejabat_jabatan || (isSpo ? "Direktur RSUD Cabangbungin" : "DIREKTUR RUMAH SAKIT UMUM DAERAH CABANGBUNGIN KABUPATEN BEKASI"),
    ttd_img: doc.ttd_img || "", kd_ep: doc.kd_ep || "", status: doc.status || "draft",
  });
  const [dd, setDd] = useState<Data>({
    // SK
    menimbang: arr(d0.menimbang), mengingat: arr(d0.mengingat), menetapkan: s(d0.menetapkan),
    diktum: arr(d0.diktum), diktum_gaya: s(d0.diktum_gaya) || "kesatu", kota: s(d0.kota) || "Bekasi", lampiran: s(d0.lampiran),
    pejabat_pangkat: s(d0.pejabat_pangkat),
    // SPO
    pengertian: arr(d0.pengertian), tujuan: arr(d0.tujuan), kebijakan: s(d0.kebijakan),
    prosedur: arr(d0.prosedur), unit_terkait: s(d0.unit_terkait), spo_unit: s(d0.spo_unit) || "SIRS", spo_sub: s(d0.spo_sub) || "",
  });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const setD = (k: string, v: unknown) => setDd(p => ({ ...p, [k]: v }));

  async function autoNomor() {
    const extra: Record<string, string> = isSpo ? { unit: String(dd.spo_unit || "SIRS"), sub: String(dd.spo_sub || "UMUM") } : {};
    const r = await nextNomorDok(doc.jenis, extra); set("nomor", r.data.nomor);
  }
  async function onTtd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try { const r = await uploadLaporFoto(file); set("ttd_img", r.data.url); } catch { setErr("Gagal upload TTD."); }
    e.target.value = "";
  }
  function buildData(): Data {
    return isSpo
      ? { pengertian: dd.pengertian, tujuan: dd.tujuan, kebijakan: dd.kebijakan, prosedur: dd.prosedur, unit_terkait: dd.unit_terkait,
          pejabat_pangkat: dd.pejabat_pangkat, spo_unit: dd.spo_unit, spo_sub: dd.spo_sub }
      : { menimbang: dd.menimbang, mengingat: dd.mengingat, menetapkan: dd.menetapkan, diktum: dd.diktum, diktum_gaya: dd.diktum_gaya,
          kota: dd.kota, lampiran: dd.lampiran, pejabat_pangkat: dd.pejabat_pangkat };
  }
  async function simpan(): Promise<number | null> {
    if (!f.judul.trim()) { setErr(isSpo ? "Judul SPO wajib." : "Tentang (judul) wajib."); return null; }
    setBusy(true); setErr("");
    try {
      const payload = { ...doc, ...f, data: buildData() };
      if (doc.id) { await updateDok(doc.id, payload); return doc.id; }
      const r = await createDok(payload); return r.data.id;
    } catch { setErr("Gagal menyimpan."); return null; } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl">
          <h3 className="font-semibold text-slate-800">{doc.id ? "Edit" : "Buat"} {isSpo ? "SPO / SOP" : "SK Direktur"}</h3>
          <button onClick={onClose} className="text-slate-400 text-xl">×</button>
        </div>
        <div className="p-5 space-y-3">
          {err && <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{err}</div>}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-sm text-slate-600">Nomor Dokumen</label>
              <input value={f.nomor} onChange={e => set("nomor", e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
            {isSpo && <input value={String(dd.spo_unit)} onChange={e => setD("spo_unit", e.target.value)} placeholder="Unit (TU)" className="w-24 border border-slate-300 rounded-lg px-2 py-2 text-sm" />}
            {isSpo && <input value={String(dd.spo_sub)} onChange={e => setD("spo_sub", e.target.value)} placeholder="Sub (SIRS)" className="w-24 border border-slate-300 rounded-lg px-2 py-2 text-sm" />}
            <button type="button" onClick={autoNomor} className="px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">Auto</button>
          </div>

          <div><label className="text-sm text-slate-600">{isSpo ? "Judul SPO" : "Tentang (judul SK)"}</label>
            <textarea value={f.judul} onChange={e => set("judul", e.target.value)} rows={2} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></div>

          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-xs text-slate-500">Tanggal {isSpo ? "terbit" : "ditetapkan"}</label>
              <input type="date" value={f.tanggal} onChange={e => set("tanggal", e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" /></div>
            {isSpo ? <div><label className="text-xs text-slate-500">No. Revisi</label>
              <input value={f.no_revisi} onChange={e => set("no_revisi", e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" /></div>
              : <div><label className="text-xs text-slate-500">Kota</label>
                <input value={String(dd.kota)} onChange={e => setD("kota", e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" /></div>}
            <div><label className="text-xs text-slate-500">Kait EP (opsional)</label>
              <input value={f.kd_ep} onChange={e => set("kd_ep", e.target.value)} placeholder="MRMIK.1.a" className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" /></div>
          </div>

          {/* Field spesifik */}
          {isSpo ? (
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <DynList label="Pengertian" items={dd.pengertian as string[]} onChange={v => setD("pengertian", v)} />
              <DynList label="Tujuan" items={dd.tujuan as string[]} onChange={v => setD("tujuan", v)} />
              <div><label className="text-sm font-medium text-slate-600">Kebijakan</label>
                <textarea value={String(dd.kebijakan)} onChange={e => setD("kebijakan", e.target.value)} rows={2} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></div>
              <DynList label="Prosedur" items={dd.prosedur as string[]} onChange={v => setD("prosedur", v)} ph="Langkah…" />
              <div><label className="text-sm font-medium text-slate-600">Unit Terkait</label>
                <input value={String(dd.unit_terkait)} onChange={e => setD("unit_terkait", e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
          ) : (
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <DynList label="Menimbang (a, b, c…)" items={dd.menimbang as string[]} onChange={v => setD("menimbang", v)} />
              <DynList label="Mengingat (1, 2, 3…)" items={dd.mengingat as string[]} onChange={v => setD("mengingat", v)} />
              <div><label className="text-sm font-medium text-slate-600">Menetapkan</label>
                <textarea value={String(dd.menetapkan)} onChange={e => setD("menetapkan", e.target.value)} rows={2} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div className="flex items-center gap-2"><label className="text-sm font-medium text-slate-600">Diktum</label>
                <select value={String(dd.diktum_gaya)} onChange={e => setD("diktum_gaya", e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs">
                  <option value="kesatu">KESATU/KEDUA…</option><option value="pertama">PERTAMA/KEDUA…</option></select></div>
              <DynList label="" items={dd.diktum as string[]} onChange={v => setD("diktum", v)} ph="Isi diktum…" />
              <div><label className="text-sm font-medium text-slate-600">Lampiran (opsional)</label>
                <textarea value={String(dd.lampiran)} onChange={e => setD("lampiran", e.target.value)} rows={3} placeholder="Isi lampiran (tampil di halaman baru)…" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
          )}

          {/* Pejabat & TTD */}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <div className="text-xs font-semibold text-slate-500">PEJABAT PENANDATANGAN</div>
            <div className="grid grid-cols-2 gap-2">
              <input value={f.pejabat_nama} onChange={e => set("pejabat_nama", e.target.value)} placeholder="Nama (mis. dr. Hj. Erni Herdiani, M.H.)" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <input value={String(dd.pejabat_pangkat)} onChange={e => setD("pejabat_pangkat", e.target.value)} placeholder="Pangkat/Gol (Pembina IV.a)" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <input value={f.pejabat_nip} onChange={e => set("pejabat_nip", e.target.value)} placeholder="NIP" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <input value={f.pejabat_jabatan} onChange={e => set("pejabat_jabatan", e.target.value)} placeholder="Jabatan" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm text-slate-600">Gambar TTE + stempel (PNG transparan disarankan)</label>
              <input type="file" accept="image/*" onChange={onTtd} className="mt-1 block w-full text-sm" />
              {f.ttd_img && <img src={f.ttd_img} alt="ttd" className="mt-2 h-20 border border-slate-200 rounded" />}
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <select value={f.status} onChange={e => set("status", e.target.value)} className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
              <option value="draft">Draft</option><option value="final">Final</option>
            </select>
            <div className="flex gap-2">
              <button onClick={async () => { const id = await simpan(); if (id) onPreview(id); }} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">Simpan & Pratinjau</button>
              <button onClick={async () => { const id = await simpan(); if (id) onSaved(); }} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">{busy ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Editor Word (OnlyOffice) embed ───────────────────────────────────────────
function OnlyOfficeEditor({ id, onClose }: { id: number; onClose: () => void }) {
  const [err, setErr] = useState("");
  useEffect(() => {
    let editor: { destroyEditor?: () => void } | null = null;
    let cancelled = false;
    const host = window.location.hostname;
    const dsUrl = `https://${host}:8444`;
    type DocsApiWin = Window & { DocsAPI?: { DocEditor: new (el: string, cfg: unknown) => { destroyEditor?: () => void } } };
    const w = window as DocsApiWin;
    function init(cfg: Record<string, unknown>) {
      if (cancelled || !w.DocsAPI) return;
      editor = new w.DocsAPI.DocEditor("oo-container", {
        ...cfg, type: "desktop", width: "100%", height: "100%",
        events: { onError: (e: unknown) => setErr("Editor error: " + JSON.stringify(e)) },
      });
    }
    (async () => {
      try {
        const r = await getOoConfig(id);
        if (cancelled) return;
        if (w.DocsAPI) { init(r.data); return; }
        const scr = document.createElement("script");
        scr.src = `${dsUrl}/web-apps/apps/api/documents/api.js`;
        scr.onload = () => init(r.data);
        scr.onerror = () => setErr(`Gagal memuat editor dari ${dsUrl}. Buka ${dsUrl} sekali di tab baru untuk menerima sertifikat, lalu coba lagi.`);
        document.body.appendChild(scr);
      } catch (e) {
        const er = e as { response?: { data?: { error?: string } } };
        setErr(er.response?.data?.error || "Gagal memuat konfigurasi editor.");
      }
    })();
    return () => { cancelled = true; try { editor?.destroyEditor?.(); } catch { /* */ } };
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50">
        <span className="font-semibold text-slate-700">✏️ Edit Dokumen (Word) — perubahan otomatis tersimpan</span>
        <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg bg-slate-200 hover:bg-slate-300">Tutup</button>
      </div>
      {err && <div className="bg-red-50 text-red-700 text-sm px-4 py-2">{err}</div>}
      <div id="oo-container" className="flex-1" />
    </div>
  );
}
