"use client";

// SIDOMU — Sistem Dokumen Mutu (Komite Mutu RSCB). Katalog SOP/dokumen mutu
// (sumber Google Drive) + embed folder. CRUD admin.

import { useEffect, useState, useCallback } from "react";
import {
  getSidomu, getSidomuMeta, saveSidomu, delSidomu, uploadSidomuFile,
  SidomuSop, SidomuMeta,
} from "@/lib/api";

const JENIS = ["docx", "pdf", "pptx", "xlsx", "lain"];
const KATEGORI = ["Mutu", "Farmasi", "Gudang", "Pelayanan", "Pendaftaran", "Sarpras", "PPI", "Keselamatan Pasien", "Lainnya"];
const badgeJenis: Record<string, string> = {
  pdf: "bg-rose-100 text-rose-700", docx: "bg-blue-100 text-blue-700",
  pptx: "bg-orange-100 text-orange-700", xlsx: "bg-emerald-100 text-emerald-700",
};
const EMPTY: Partial<SidomuSop> = { nama: "", kategori: "Mutu", jenis: "docx", link: "", keterangan: "", urutan: 0 };

export default function SidomuPage() {
  const [rows, setRows] = useState<SidomuSop[]>([]);
  const [meta, setMeta] = useState<SidomuMeta | null>(null);
  const [q, setQ] = useState("");
  const [fKat, setFKat] = useState("");
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<SidomuSop> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [showDrive, setShowDrive] = useState(false);
  const [logoOk, setLogoOk] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getSidomu({ q, kategori: fKat }).then(r => setRows(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [q, fKat]);
  useEffect(() => { getSidomuMeta().then(r => setMeta(r.data)).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function simpan() {
    if (!edit?.nama?.trim()) { setMsg({ ok: false, t: "Nama dokumen wajib diisi" }); return; }
    setSaving(true); setMsg(null);
    try {
      await saveSidomu(edit);
      setMsg({ ok: true, t: "Tersimpan." }); setEdit(null); load();
      getSidomuMeta().then(r => setMeta(r.data)).catch(() => {});
    } catch { setMsg({ ok: false, t: "Gagal menyimpan (hanya admin)." }); }
    finally { setSaving(false); }
  }
  async function unggah(file: File) {
    if (!edit) return;
    setUploading(true); setMsg(null);
    try {
      const r = await uploadSidomuFile(file);
      setEdit(e => ({ ...e, link: r.data.link, jenis: r.data.jenis, nama: e?.nama?.trim() ? e.nama : r.data.nama }));
      setMsg({ ok: true, t: "File terunggah. Klik Simpan untuk menyimpan katalog." });
    } catch { setMsg({ ok: false, t: "Gagal mengunggah (hanya admin / file terlalu besar)." }); }
    finally { setUploading(false); }
  }
  async function hapus(r: SidomuSop) {
    if (!confirm(`Hapus dokumen "${r.nama}"?`)) return;
    try { await delSidomu(r.id); load(); getSidomuMeta().then(x => setMeta(x.data)); }
    catch { setMsg({ ok: false, t: "Gagal hapus (hanya admin)." }); }
  }

  // kelompokkan per kategori
  const groups = rows.reduce<Record<string, SidomuSop[]>>((a, r) => {
    const k = r.kategori || "Lainnya"; (a[k] ??= []).push(r); return a;
  }, {});
  const folderUrl = meta ? `https://drive.google.com/drive/folders/${meta.folder_id}` : "#";
  const embedUrl = meta ? `https://drive.google.com/embeddedfolderview?id=${meta.folder_id}#grid` : "";

  return (
    <div className="p-6 space-y-5">
      {/* Header + logo */}
      <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-white border border-sky-100 shadow-sm p-5 flex items-center gap-4 flex-wrap">
        {logoOk ? (
          <img src="/sidomu/logo.png" alt="SIDOMU" className="w-20 h-20 object-contain shrink-0" onError={() => setLogoOk(false)} />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-sky-500 text-white grid place-items-center font-black text-lg shrink-0">SIDO<br />MU</div>
        )}
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-2xl font-black text-sky-600 tracking-wide">SIDOMU</h1>
          <p className="text-sm text-slate-600">Sistem Dokumen Mutu — <b>Komite Mutu RSCB</b>. Kumpulan SOP & dokumen mutu rumah sakit.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowDrive(v => !v)} className="px-3 py-2 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg">
            {showDrive ? "Sembunyikan Folder" : "▤ Lihat Folder Drive"}
          </button>
          <a href={folderUrl} target="_blank" rel="noreferrer" className="px-3 py-2 text-sm font-medium text-sky-700 border border-sky-300 hover:bg-sky-50 rounded-lg">Buka di Drive ↗</a>
          <button onClick={() => { setEdit({ ...EMPTY }); setMsg(null); }} className="px-3 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg">+ Tambah Dokumen</button>
        </div>
      </div>

      {/* Embed folder Drive */}
      {showDrive && meta && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <iframe src={embedUrl} className="w-full" style={{ height: 480, border: 0 }} title="Folder SOP" />
        </div>
      )}

      {/* Filter */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-slate-500 block mb-1">Cari dokumen</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ketik nama SOP / kategori…"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <div className="min-w-[160px]">
          <label className="text-xs text-slate-500 block mb-1">Kategori</label>
          <select value={fKat} onChange={e => setFKat(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500">
            <option value="">Semua</option>
            {(meta?.kategori ?? []).map(k => <option key={k.k} value={k.k}>{k.k} ({k.v})</option>)}
          </select>
        </div>
        {(q || fKat) && <button onClick={() => { setQ(""); setFKat(""); }} className="px-3 py-2 text-sm text-slate-500 border border-slate-300 hover:bg-slate-50 rounded-lg">Reset</button>}
      </div>

      {msg && <div className={`text-sm px-4 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.t}</div>}

      {/* Tanpa filter & katalog besar → tampilkan chip kategori dulu */}
      {!q && !fKat && meta && meta.total > 60 ? (
        <div>
          <p className="text-sm text-slate-500 mb-3">{meta.total} dokumen dalam {meta.kategori.length} kategori — pilih kategori atau ketik pencarian di atas.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {meta.kategori.map(k => (
              <button key={k.k} onClick={() => setFKat(k.k)}
                className="flex items-center justify-between gap-2 text-left px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-sky-300 hover:shadow-sm transition">
                <span className="text-sm font-medium text-slate-700 truncate">{k.k}</span>
                <span className="text-xs bg-sky-100 text-sky-700 rounded-full px-2 py-0.5 shrink-0">{k.v}</span>
              </button>
            ))}
          </div>
        </div>
      ) : loading ? (
        <div className="text-slate-400 py-10 text-center">Memuat…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-6 text-center space-y-1">
          <p className="text-sm font-medium text-slate-700">Katalog belum berisi dokumen.</p>
          <p className="text-xs text-slate-500">Dokumen SOP asli ada di <b>folder Drive Komite Mutu</b> di atas (per bagian: Komite, Umum, Keuangan, Kepegawaian, Penunjang Medis, Pelayanan Medis).</p>
          <p className="text-xs text-slate-500">Untuk mengaitkan sebuah SOP ke EP akreditasi, klik <b>“+ Tambah Dokumen”</b> lalu tempel judul & tautan Drive-nya.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(groups).map(([kat, list]) => (
            <div key={kat}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="font-bold text-slate-700">{kat}</h2>
                <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{list.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {list.map(r => (
                  <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition flex flex-col">
                    <div className="flex items-start gap-2">
                      <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 uppercase shrink-0 ${badgeJenis[r.jenis] ?? "bg-slate-100 text-slate-500"}`}>{r.jenis || "dok"}</span>
                      <h3 className="font-semibold text-slate-800 text-sm leading-snug flex-1">{r.nama}</h3>
                    </div>
                    {r.keterangan && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.keterangan}</p>}
                    {r.eps && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {r.eps.split(",").filter(Boolean).slice(0, 6).map(e => (
                          <span key={e} className="text-[10px] font-mono bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5">{e}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
                      {r.link ? <a href={r.link} target="_blank" rel="noreferrer" className="font-medium text-sky-700 hover:underline">Buka ↗</a>
                        : <span className="text-slate-300">tanpa tautan</span>}
                      <button onClick={() => { setEdit({ ...r }); setMsg(null); }} className="text-slate-500 hover:underline ml-auto">Edit</button>
                      <button onClick={() => hapus(r)} className="text-rose-500 hover:underline">Hapus</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {edit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">{edit.id ? "Edit Dokumen" : "Tambah Dokumen"}</h2>
            <div className="space-y-3">
              <Fld label="Nama Dokumen *" v={edit.nama} on={v => setEdit({ ...edit, nama: v })} />
              <div className="grid grid-cols-2 gap-3">
                <SelF label="Kategori" v={edit.kategori} on={v => setEdit({ ...edit, kategori: v })} opts={KATEGORI} />
                <SelF label="Jenis" v={edit.jenis} on={v => setEdit({ ...edit, jenis: v })} opts={JENIS} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Unggah File ke server RSCB (PDF/DOC/dll)</label>
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
                  onChange={e => { const f = e.target.files?.[0]; if (f) unggah(f); }}
                  className="w-full text-sm text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-sky-600 file:text-white file:text-sm file:font-medium hover:file:bg-sky-700" />
                {uploading && <p className="text-xs text-sky-600 mt-1">Mengunggah…</p>}
              </div>
              <Fld label="Tautan (otomatis terisi bila unggah file)" v={edit.link} on={v => setEdit({ ...edit, link: v })} ph="/api/sidomu/file/… atau tautan Drive" />
              <Fld label="Keterangan" v={edit.keterangan} on={v => setEdit({ ...edit, keterangan: v })} />
              <p className="text-xs text-slate-400">Pengaitan ke EP akreditasi dilakukan di halaman EP masing-masing (tab “SOP / SIDOMU”).</p>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setEdit(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg">Batal</button>
              <button onClick={simpan} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg">{saving ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Fld({ label, v, on, ph }: { label: string; v?: string; on: (v: string) => void; ph?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
      <input value={v ?? ""} onChange={e => on(e.target.value)} placeholder={ph}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500" />
    </div>
  );
}
function SelF({ label, v, on, opts }: { label: string; v?: string; on: (v: string) => void; opts: string[] }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
      <select value={v ?? ""} onChange={e => on(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500">
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
