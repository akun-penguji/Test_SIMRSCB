"use client";

import MicButton from "@/components/MicButton";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  evidenList, evidenCreate, evidenUpdate, evidenDelete, evidenGet,
  EvidenFolder, EvidenInput, akreditasiListEp,
} from "@/lib/api";

const JENIS_OPTIONS = [
  { kode: "",            label: "— Semua —" },
  { kode: "eviden_bab",  label: "Eviden Bab" },
  { kode: "sk",          label: "SK Direktur" },
  { kode: "pedoman",     label: "Pedoman" },
  { kode: "panduan",     label: "Panduan" },
  { kode: "spo",         label: "SPO/SOP" },
  { kode: "laporan",     label: "Laporan" },
  { kode: "lainnya",     label: "Lainnya" },
];

const JENIS_BADGE: Record<string, string> = {
  eviden_bab: "bg-purple-100 text-purple-700",
  sk:         "bg-red-100 text-red-700",
  pedoman:    "bg-blue-100 text-blue-700",
  panduan:    "bg-sky-100 text-sky-700",
  spo:        "bg-emerald-100 text-emerald-700",
  laporan:    "bg-amber-100 text-amber-700",
  lainnya:    "bg-slate-100 text-slate-700",
};

const BAB_LIST = ["TKRS","KPS","MFK","PMKP","PPI","MRMIK","AKP","HPK","PP","PAP","PAB","PKPO","KE","SKP","PN"];

export default function EvidenListPage() {
  const [items, setItems]   = useState<EvidenFolder[]>([]);
  const [loading, setLoad]  = useState(true);
  const [search, setSearch] = useState("");
  const [babF, setBabF]     = useState("");
  const [jenisF, setJenisF] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  async function load() {
    setLoad(true);
    try {
      const r = await evidenList({ bab: babF, jenis: jenisF, search });
      setItems(r.data);
    } catch { setItems([]); }
    finally { setLoad(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [babF, jenisF]);

  async function handleHapus(id: number) {
    if (!confirm("Hapus folder eviden ini? Mapping ke EP juga akan ikut terhapus.")) return;
    try {
      await evidenDelete(id);
      load();
    } catch (e) {
      alert("Gagal menghapus: " + e);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <Link href="/akreditasi" className="text-xs text-slate-500 hover:text-green-700">← Akreditasi</Link>
          <h1 className="text-2xl font-bold text-slate-800 mt-1">Eviden / Bukti Akreditasi</h1>
          <p className="text-sm text-slate-500 mt-1">
            Catalog folder Google Drive berisi bukti dokumen STARKES.
          </p>
        </div>
        <button onClick={() => { setEditId(null); setShowForm(true); }}
          className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition shrink-0">
          + Tambah Folder
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Bab</label>
          <select value={babF} onChange={e => setBabF(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
            <option value="">— Semua Bab —</option>
            {BAB_LIST.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Jenis</label>
          <select value={jenisF} onChange={e => setJenisF(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
            {JENIS_OPTIONS.map(o => <option key={o.kode} value={o.kode}>{o.label}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-600 mb-1 block">Pencarian</label>
          <form onSubmit={e => { e.preventDefault(); load(); }} className="flex gap-2">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="cari judul / deskripsi..."
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Cari</button>
          </form>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Memuat...</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500">Belum ada folder eviden. Klik <strong>+ Tambah Folder</strong> untuk mulai.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(f => (
            <div key={f.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-slate-800 text-sm leading-tight flex-1">
                  📁 {f.judul}
                </h3>
                {f.bab && <span className="text-xs font-mono bg-green-50 text-green-700 px-2 py-0.5 rounded shrink-0">{f.bab}</span>}
              </div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${JENIS_BADGE[f.jenis] || JENIS_BADGE.lainnya}`}>
                  {f.jenis}
                </span>
                {f.tahun && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                    {f.tahun}
                  </span>
                )}
                {typeof f.ep_count === "number" && f.ep_count > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
                    🔗 {f.ep_count} EP
                  </span>
                )}
              </div>
              {f.deskripsi && (
                <p className="text-xs text-slate-600 mb-3 line-clamp-3 flex-1">{f.deskripsi}</p>
              )}
              <div className="flex gap-2 mt-auto pt-2 border-t border-slate-100">
                <a href={f.url_drive} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-center text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded font-medium transition">
                  🔗 Buka Drive
                </a>
                <button onClick={() => { setEditId(f.id); setShowForm(true); }}
                  className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-2 rounded font-medium">
                  ✏️
                </button>
                <button onClick={() => handleHapus(f.id)}
                  className="text-xs bg-red-50 text-red-700 hover:bg-red-100 px-3 py-2 rounded font-medium">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <EvidenFormModal
          id={editId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function EvidenFormModal({ id, onClose, onSaved }: {
  id: number | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<EvidenInput>({
    judul: "", url_drive: "", bab: null, jenis: "lainnya",
    tahun: null, deskripsi: "", pic_nik: "", kd_ep_list: [],
  });
  const [epOptions, setEpOptions] = useState<{ kd_ep: string; deskripsi: string; bab: string }[]>([]);
  const [epSearch, setEpSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load EP options (limit untuk performa)
    akreditasiListEp({ limit: 500 }).then(r => {
      setEpOptions(r.data.map(e => ({ kd_ep: e.kd_ep, deskripsi: e.deskripsi, bab: e.bab })));
    });

    if (id) {
      evidenGet(id).then(r => {
        const f = r.data.folder;
        setForm({
          judul: f.judul,
          url_drive: f.url_drive,
          bab: f.bab,
          jenis: f.jenis,
          tahun: f.tahun,
          deskripsi: f.deskripsi,
          pic_nik: f.pic_nik,
          kd_ep_list: r.data.ep_list.map(e => e.kd_ep),
        });
      });
    }
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (id) await evidenUpdate(id, form);
      else    await evidenCreate(form);
      onSaved();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string; detail?: string } } };
      setError(err.response?.data?.error || "Gagal simpan");
    } finally {
      setBusy(false);
    }
  }

  function toggleEp(kd: string) {
    setForm(f => {
      const list = f.kd_ep_list || [];
      return {
        ...f,
        kd_ep_list: list.includes(kd) ? list.filter(x => x !== kd) : [...list, kd],
      };
    });
  }

  const filteredEp = epOptions.filter(e =>
    !epSearch ||
    e.kd_ep.toLowerCase().includes(epSearch.toLowerCase()) ||
    e.deskripsi.toLowerCase().includes(epSearch.toLowerCase())
  ).slice(0, 50);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">{id ? "Edit" : "Tambah"} Folder Eviden</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 text-sm">{error}</div>}

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Judul *</label>
            <input type="text" required value={form.judul} onChange={e => setForm({ ...form, judul: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">URL Google Drive *</label>
            <input type="url" required value={form.url_drive} onChange={e => setForm({ ...form, url_drive: e.target.value })}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Bab Terkait</label>
              <select value={form.bab || ""} onChange={e => setForm({ ...form, bab: e.target.value || null })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="">— Lintas Bab —</option>
                {BAB_LIST.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Jenis</label>
              <select value={form.jenis || "lainnya"} onChange={e => setForm({ ...form, jenis: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                {JENIS_OPTIONS.filter(o => o.kode).map(o => (
                  <option key={o.kode} value={o.kode}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Tahun</label>
              <input type="number" min={2000} max={2100} value={form.tahun || ""}
                onChange={e => setForm({ ...form, tahun: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Deskripsi</label>
            <div className="relative">
              <textarea value={form.deskripsi || ""} onChange={e => setForm({ ...form, deskripsi: e.target.value })}
                rows={3} className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-lg text-sm" />
              <MicButton value={form.deskripsi || ""} onChange={v => setForm({ ...form, deskripsi: v })} className="absolute right-1.5 bottom-1.5" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">PIC (NIK)</label>
            <input type="text" value={form.pic_nik || ""} onChange={e => setForm({ ...form, pic_nik: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Tag ke EP ({form.kd_ep_list?.length || 0} dipilih)
            </label>
            <input type="text" value={epSearch} onChange={e => setEpSearch(e.target.value)}
              placeholder="cari EP (kd_ep atau deskripsi)..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-2" />
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50">
              {filteredEp.map(e => (
                <label key={e.kd_ep} className="flex items-start gap-2 cursor-pointer hover:bg-white p-1.5 rounded text-xs">
                  <input type="checkbox"
                    checked={form.kd_ep_list?.includes(e.kd_ep) || false}
                    onChange={() => toggleEp(e.kd_ep)}
                    className="mt-0.5" />
                  <span className="font-mono font-bold text-green-700">{e.kd_ep}</span>
                  <span className="text-slate-600 truncate">{e.deskripsi}</span>
                </label>
              ))}
              {filteredEp.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center p-2">Tidak ada hasil</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
          <button type="submit" disabled={busy}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
