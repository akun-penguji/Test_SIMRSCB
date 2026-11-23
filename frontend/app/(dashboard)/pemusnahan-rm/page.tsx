"use client";
import MicButton from "@/components/MicButton";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  pemusnahanListBatch, pemusnahanCreateBatch, pemusnahanDeleteBatch, pemusnahanLaporan,
  PemusnahanBatch, PemusnahanUpsertBatchBody, PemusnahanLaporan, PemusnahanStatus,
} from "@/lib/api";

const STATUS_COLOR: Record<PemusnahanStatus, string> = {
  draft:        "bg-slate-100 text-slate-700 border-slate-300",
  usulan:       "bg-sky-100 text-sky-800 border-sky-300",
  disetujui:    "bg-amber-100 text-amber-800 border-amber-300",
  dilaksanakan: "bg-indigo-100 text-indigo-800 border-indigo-300",
  selesai:      "bg-emerald-100 text-emerald-800 border-emerald-300",
};

const BLANK: PemusnahanUpsertBatchBody = {
  no_batch: "", tahun_pelaksanaan: new Date().getFullYear(),
  tanggal_berita_acara: null, no_berita_acara: null,
  retensi_thn_aktif: 5, retensi_thn_inaktif: 2, retensi_thn_rme: 25,
  cara_pemusnahan: "dicacah", judul: "", catatan: null, status: "draft",
};

export default function PemusnahanRmPage() {
  const thisYear = new Date().getFullYear();
  const [tahun, setTahun]     = useState(thisYear);
  const [filterStatus, setFilterStatus] = useState("");
  const [rows, setRows]       = useState<PemusnahanBatch[]>([]);
  const [lap, setLap]         = useState<PemusnahanLaporan | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState<PemusnahanUpsertBatchBody>(BLANK);
  const [modalOpen, setModalOpen] = useState(false);
  const [msg, setMsg]         = useState<{ t: "ok"|"err"; m: string } | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      pemusnahanListBatch({ tahun, status: filterStatus }),
      pemusnahanLaporan(tahun),
    ])
      .then(([a, b]) => { setRows(a.data); setLap(b.data); })
      .catch(() => setMsg({ t: "err", m: "Gagal memuat data" }))
      .finally(() => setLoading(false));
  }, [tahun, filterStatus]);

  useEffect(() => { reload(); }, [reload]);

  const openNew = () => {
    const seq = String(rows.length + 1).padStart(2, "0");
    setForm({ ...BLANK, tahun_pelaksanaan: tahun, no_batch: `BATCH-${tahun}-${seq}` });
    setModalOpen(true);
  };

  const save = async () => {
    try {
      const r = await pemusnahanCreateBatch(form);
      setMsg({ t: "ok", m: `✓ Batch dibuat (id=${r.data.id})` });
      setModalOpen(false);
      reload();
    } catch (e) { setMsg({ t: "err", m: `Gagal: ${(e as Error).message}` }); }
  };

  const handleDelete = async (r: PemusnahanBatch) => {
    if (!confirm(`Hapus batch "${r.no_batch}"?\nSemua detail (${r.jumlah_berkas} berkas) juga akan terhapus.`)) return;
    try { await pemusnahanDeleteBatch(r.id); reload(); }
    catch { setMsg({ t: "err", m: "Gagal hapus" }); }
  };

  const r = lap?.ringkasan;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <nav className="text-xs mb-4"><Link href="/akreditasi" className="text-indigo-600 hover:underline">← Akreditasi</Link></nav>

      <header className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pemusnahan Rekam Medis</h1>
          <p className="text-sm text-slate-600 mt-1">
            Berita acara pemusnahan RM per Permenkes 269/2008 (retensi minimum 5 thn aktif + 2 thn inaktif).
            Bukti untuk <strong>MRMIK 11.b/c</strong> STARKES.
          </p>
        </div>
        <button onClick={openNew}
          className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded">
          + Batch Pemusnahan Baru
        </button>
      </header>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded text-sm border ${
          msg.t === "ok" ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
        }`}>{msg.m}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-purple-50 border border-purple-200 rounded p-3">
          <div className="text-xs text-purple-700">Total batch {tahun}</div>
          <div className="text-2xl font-bold text-slate-900">{r?.total_batch ?? 0}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="text-xs text-blue-700">Total berkas terdaftar</div>
          <div className="text-2xl font-bold text-slate-900">{r?.total_berkas ?? 0}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
          <div className="text-xs text-emerald-700">Sudah dimusnahkan</div>
          <div className="text-2xl font-bold text-slate-900">{r?.total_dimusnahkan ?? 0}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded p-3">
          <div className="text-xs text-amber-700">Disimpan lanjutan (medikolegal/dll)</div>
          <div className="text-2xl font-bold text-slate-900">{r?.total_disimpan_lanjutan ?? 0}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded p-3 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-700 mb-1">Tahun</label>
          <input type="number" value={tahun} onChange={e => setTahun(Number(e.target.value) || thisYear)}
            className="w-24 border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
        </div>
        <div>
          <label className="block text-xs text-slate-700 mb-1">Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm text-slate-900">
            <option value="">Semua</option>
            <option value="draft">Draft</option>
            <option value="usulan">Usulan</option>
            <option value="disetujui">Disetujui</option>
            <option value="dilaksanakan">Dilaksanakan</option>
            <option value="selesai">Selesai</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Memuat...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-3 py-2 text-slate-700">No Batch</th>
                <th className="text-left px-3 py-2 text-slate-700">Judul</th>
                <th className="text-left px-3 py-2 text-slate-700">Berita Acara</th>
                <th className="text-left px-3 py-2 text-slate-700">Cara</th>
                <th className="text-right px-3 py-2 text-slate-700">Jumlah Berkas</th>
                <th className="text-center px-3 py-2 text-slate-700">Status</th>
                <th className="text-right px-3 py-2 text-slate-700">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-slate-400 py-8">
                  Belum ada batch. Klik <strong>+ Batch Pemusnahan Baru</strong>.
                </td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-900 font-mono text-xs">{r.no_batch}</td>
                  <td className="px-3 py-2 text-slate-900">{r.judul}</td>
                  <td className="px-3 py-2 text-slate-700 text-xs">
                    {r.no_berita_acara ?? "-"}<br/>
                    <span className="text-slate-500">{r.tanggal_berita_acara ?? "(belum tgl)"}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-700 text-xs capitalize">{r.cara_pemusnahan.replace("_"," ")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.jumlah_berkas}
                    {r.jumlah_dimusnahkan > 0 && <span className="text-xs text-emerald-700"> · {r.jumlah_dimusnahkan} ✓</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLOR[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Link href={`/pemusnahan-rm/${r.id}`} className="text-blue-600 hover:underline text-xs mr-3">Kelola</Link>
                    <button onClick={() => handleDelete(r)} className="text-rose-600 hover:underline text-xs">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal create */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">Batch Pemusnahan Baru</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 mb-1">No Batch *</label>
                  <input type="text" required value={form.no_batch}
                    onChange={e => setForm({ ...form, no_batch: e.target.value })}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 font-mono" />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Tahun Pelaksanaan *</label>
                  <input type="number" required value={form.tahun_pelaksanaan}
                    onChange={e => setForm({ ...form, tahun_pelaksanaan: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-700 mb-1">Judul *</label>
                <input type="text" required value={form.judul}
                  onChange={e => setForm({ ...form, judul: e.target.value })}
                  placeholder="Mis. Pemusnahan RM inactive ≥ 2020"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Tanggal Berita Acara</label>
                  <input type="date" value={form.tanggal_berita_acara ?? ""}
                    onChange={e => setForm({ ...form, tanggal_berita_acara: e.target.value || null })}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1">No Berita Acara</label>
                  <input type="text" value={form.no_berita_acara ?? ""}
                    onChange={e => setForm({ ...form, no_berita_acara: e.target.value || null })}
                    placeholder="001/BA-RM/RSCB/VI/2026"
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 mb-1" title="Permenkes 269/2008">
                    Retensi RM Fisik Aktif (thn)
                  </label>
                  <input type="number" value={form.retensi_thn_aktif ?? 5}
                    onChange={e => setForm({ ...form, retensi_thn_aktif: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Retensi RM Fisik Inaktif (thn)</label>
                  <input type="number" value={form.retensi_thn_inaktif ?? 2}
                    onChange={e => setForm({ ...form, retensi_thn_inaktif: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1" title="Permenkes 24/2022 Pasal 30">
                    Retensi RME (thn) <span className="text-rose-600">*</span>
                  </label>
                  <input type="number" value={form.retensi_thn_rme ?? 25}
                    onChange={e => setForm({ ...form, retensi_thn_rme: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
                </div>
              </div>
              <div className="text-[11px] text-slate-500 -mt-1">
                💡 RME minimum 25 tahun per Permenkes 24/2022. RM fisik minimum 5+2 tahun per Permenkes 269/2008.
              </div>
              <div>
                <label className="block text-xs text-slate-700 mb-1">Cara Pemusnahan</label>
                <select value={form.cara_pemusnahan ?? "dicacah"}
                  onChange={e => setForm({ ...form, cara_pemusnahan: e.target.value as PemusnahanUpsertBatchBody["cara_pemusnahan"] })}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900">
                  <option value="dicacah">Dicacah</option>
                  <option value="dibakar">Dibakar</option>
                  <option value="elektronik">Elektronik (delete RME)</option>
                  <option value="alih_media">Alih media (scan/microfilm)</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-700 mb-1">Catatan</label>
                <div className="relative">
                  <textarea rows={2} value={form.catatan ?? ""}
                    onChange={e => setForm({ ...form, catatan: e.target.value || null })}
                    className="w-full border border-slate-300 rounded px-3 py-2 pr-8 text-sm text-slate-900" />
                  <MicButton value={form.catatan ?? ""} onChange={v => setForm({ ...form, catatan: v || null })} className="absolute right-1.5 bottom-1.5" />
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm">Batal</button>
              <button onClick={save} disabled={!form.no_batch || !form.judul}
                className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50">
                Buat Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
