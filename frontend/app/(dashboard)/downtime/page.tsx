"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  downtimeList, downtimeCreate, downtimeUpdate, downtimeDelete, downtimeLaporan,
  DowntimeRow, DowntimeUpsertBody, DowntimeLaporan,
  DowntimeJenis, DowntimeKategori, DowntimeStatus,
} from "@/lib/api";
import MicButton from "@/components/MicButton";

const KATEGORI_LIST: DowntimeKategori[] = ["jaringan","listrik","aplikasi","server","database","perangkat_keras","lainnya"];
const STATUS_COLOR: Record<DowntimeStatus, string> = {
  aktif:      "bg-rose-100 text-rose-800 border-rose-300",
  selesai:    "bg-amber-100 text-amber-800 border-amber-300",
  dievaluasi: "bg-emerald-100 text-emerald-800 border-emerald-300",
};
const JENIS_COLOR: Record<DowntimeJenis, string> = {
  planned:  "bg-sky-100 text-sky-800 border-sky-300",
  incident: "bg-rose-100 text-rose-800 border-rose-300",
};

const BLANK: DowntimeUpsertBody = {
  tanggal_mulai:   "", tanggal_selesai: null,
  jenis:           "incident", kategori: "lainnya",
  unit_terdampak:  null, judul: "", dampak: null,
  prosedur_manual: null, root_cause: null, tindakan: null, evaluasi_pasca: null,
  rca_complete:    0,  staf_terlatih: 0, status: "aktif",
};

function fmtMenit(m: number | null) {
  if (m == null || m < 0) return "-";
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60); const mm = m % 60;
  return `${h}j ${mm}m`;
}

export default function DowntimePage() {
  const thisYear = new Date().getFullYear();
  const [tahun, setTahun]       = useState(thisYear);
  const [rows, setRows]         = useState<DowntimeRow[]>([]);
  const [lap,  setLap]          = useState<DowntimeLaporan | null>(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState<DowntimeRow | null>(null);
  const [form, setForm]         = useState<DowntimeUpsertBody>(BLANK);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKategori, setFilterKategori] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ t: "ok"|"err"; m: string } | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      downtimeList({ tahun, status: filterStatus, kategori: filterKategori, q }),
      downtimeLaporan(tahun),
    ])
      .then(([a, b]) => { setRows(a.data); setLap(b.data); })
      .catch(() => setMsg({ t: "err", m: "Gagal memuat data" }))
      .finally(() => setLoading(false));
  }, [tahun, filterStatus, filterKategori, q]);

  useEffect(() => { reload(); }, [reload]);

  const openNew = () => {
    const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setForm({ ...BLANK, tanggal_mulai: now.toISOString().slice(0, 19).replace("T", " ") });
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (r: DowntimeRow) => {
    setForm({
      tanggal_mulai:   r.tanggal_mulai,
      tanggal_selesai: r.tanggal_selesai,
      jenis:           r.jenis,
      kategori:        r.kategori,
      unit_terdampak:  r.unit_terdampak,
      judul:           r.judul,
      dampak:          r.dampak,
      prosedur_manual: r.prosedur_manual,
      root_cause:      r.root_cause,
      tindakan:        r.tindakan,
      evaluasi_pasca:  r.evaluasi_pasca,
      rca_complete:    r.rca_complete,
      staf_terlatih:   r.staf_terlatih,
      status:          r.status,
      pic_nip:         r.pic_nip,
      pelapor_nip:     r.pelapor_nip,
    });
    setEditing(r);
    setModalOpen(true);
  };

  const save = async () => {
    try {
      if (editing) await downtimeUpdate(editing.id, form);
      else         await downtimeCreate(form);
      setMsg({ t: "ok", m: editing ? "✓ Diupdate" : "✓ Dibuat" });
      setModalOpen(false);
      reload();
    } catch (e) {
      setMsg({ t: "err", m: `Gagal: ${(e as Error).message}` });
    }
  };

  const handleDelete = async (r: DowntimeRow) => {
    if (!confirm(`Hapus log "${r.judul}"?`)) return;
    try { await downtimeDelete(r.id); reload(); }
    catch { setMsg({ t: "err", m: "Gagal hapus" }); }
  };

  const r = lap?.ringkasan;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <nav className="text-xs mb-4"><Link href="/akreditasi" className="text-indigo-600 hover:underline">← Akreditasi</Link></nav>

      <header className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Downtime SIMRS — Log Waktu Henti</h1>
          <p className="text-sm text-slate-600 mt-1">
            Catatan kejadian downtime SIMRS + RCA + evaluasi. Bukti untuk standar <strong>MRMIK 13.1</strong> STARKES.
          </p>
        </div>
        <button onClick={openNew}
          className="bg-rose-600 hover:bg-rose-700 text-white text-sm px-4 py-2 rounded">
          + Catat Downtime Baru
        </button>
      </header>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded text-sm border ${
          msg.t === "ok" ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
        }`}>{msg.m}</div>
      )}

      {/* Ringkasan tahun */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="text-xs text-blue-700">Total kejadian {tahun}</div>
          <div className="text-2xl font-bold text-slate-900">{r?.total_kejadian ?? 0}</div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded p-3">
          <div className="text-xs text-rose-700">Aktif (belum selesai)</div>
          <div className="text-2xl font-bold text-slate-900">{r?.aktif ?? 0}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded p-3">
          <div className="text-xs text-amber-700">Selesai (belum dievaluasi)</div>
          <div className="text-2xl font-bold text-slate-900">{r?.selesai ?? 0}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
          <div className="text-xs text-emerald-700">Dievaluasi (13.1.c)</div>
          <div className="text-2xl font-bold text-slate-900">{r?.dievaluasi ?? 0}</div>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded p-3">
          <div className="text-xs text-indigo-700">Total durasi</div>
          <div className="text-2xl font-bold text-slate-900">{fmtMenit(r?.total_menit ?? 0)}</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-600">Rata-rata / kejadian</div>
          <div className="text-2xl font-bold text-slate-700">{fmtMenit(Math.round(r?.avg_menit ?? 0))}</div>
        </div>
      </div>

      {/* Per kategori */}
      {lap && lap.per_kategori.length > 0 && (
        <div className="bg-white border border-slate-200 rounded p-4 mb-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Distribusi per kategori</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {lap.per_kategori.map(k => (
              <div key={k.kategori} className="bg-slate-50 border border-slate-200 rounded px-3 py-2 flex justify-between">
                <span className="text-slate-700 capitalize">{k.kategori.replace("_"," ")}</span>
                <span className="text-slate-900 font-semibold">{k.total} · {fmtMenit(k.total_menit ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
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
            <option value="aktif">Aktif</option>
            <option value="selesai">Selesai</option>
            <option value="dievaluasi">Dievaluasi</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-700 mb-1">Kategori</label>
          <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm text-slate-900">
            <option value="">Semua</option>
            {KATEGORI_LIST.map(k => <option key={k} value={k}>{k.replace("_"," ")}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-slate-700 mb-1">Cari judul / dampak / unit</label>
          <input type="text" value={q} onChange={e => setQ(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-slate-500 text-sm">Memuat...</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-3 py-2 text-slate-700">Mulai</th>
                <th className="text-left px-3 py-2 text-slate-700">Durasi</th>
                <th className="text-left px-3 py-2 text-slate-700">Jenis</th>
                <th className="text-left px-3 py-2 text-slate-700">Kategori</th>
                <th className="text-left px-3 py-2 text-slate-700">Judul</th>
                <th className="text-left px-3 py-2 text-slate-700">Unit Terdampak</th>
                <th className="text-center px-3 py-2 text-slate-700">RCA · Staf</th>
                <th className="text-center px-3 py-2 text-slate-700">Status</th>
                <th className="text-right px-3 py-2 text-slate-700">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-slate-400 py-8">
                  Belum ada catatan downtime. Klik <strong>+ Catat Downtime Baru</strong>.
                </td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-700 text-xs font-mono">{r.tanggal_mulai}</td>
                  <td className="px-3 py-2 text-slate-900 font-mono text-xs">{fmtMenit(r.durasi_menit)}</td>
                  <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded border ${JENIS_COLOR[r.jenis]}`}>{r.jenis}</span></td>
                  <td className="px-3 py-2 text-slate-700 text-xs capitalize">{r.kategori.replace("_"," ")}</td>
                  <td className="px-3 py-2 text-slate-900">{r.judul}</td>
                  <td className="px-3 py-2 text-slate-700 text-xs">{r.unit_terdampak ?? "-"}</td>
                  <td className="px-3 py-2 text-center text-xs">
                    <span title="RCA Complete">{r.rca_complete ? "✅" : "❌"}</span>
                    {" / "}
                    <span title="Staf Terlatih">{r.staf_terlatih ? "✅" : "❌"}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLOR[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(r)} className="text-blue-600 hover:underline text-xs mr-3">Edit</button>
                    <button onClick={() => handleDelete(r)} className="text-rose-600 hover:underline text-xs">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">
                {editing ? `Edit Downtime #${editing.id}` : "Catat Downtime Baru"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Tanggal/Jam Mulai *</label>
                  <input type="text" required value={form.tanggal_mulai}
                    onChange={e => setForm({ ...form, tanggal_mulai: e.target.value })}
                    placeholder="YYYY-MM-DD HH:mm:ss"
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 font-mono" />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Tanggal/Jam Selesai</label>
                  <input type="text" value={form.tanggal_selesai ?? ""}
                    onChange={e => setForm({ ...form, tanggal_selesai: e.target.value || null })}
                    placeholder="YYYY-MM-DD HH:mm:ss"
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 font-mono" />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Jenis *</label>
                  <select value={form.jenis} onChange={e => setForm({ ...form, jenis: e.target.value as DowntimeJenis })}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900">
                    <option value="incident">Incident (tidak direncanakan)</option>
                    <option value="planned">Planned (maintenance)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Kategori *</label>
                  <select value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value as DowntimeKategori })}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900">
                    {KATEGORI_LIST.map(k => <option key={k} value={k}>{k.replace("_"," ")}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-700 mb-1">Judul *</label>
                <input type="text" required value={form.judul}
                  onChange={e => setForm({ ...form, judul: e.target.value })}
                  placeholder="Mis. Switch core mati, database lambat, listrik padam"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
              </div>

              <div>
                <label className="block text-xs text-slate-700 mb-1">Unit Terdampak</label>
                <input type="text" value={form.unit_terdampak ?? ""}
                  onChange={e => setForm({ ...form, unit_terdampak: e.target.value || null })}
                  placeholder="Pendaftaran, Ranap, Lab, dst..."
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
              </div>

              <div>
                <label className="block text-xs text-slate-700 mb-1">Dampak pelayanan</label>
                <div className="relative">
                <textarea rows={2} value={form.dampak ?? ""}
                  onChange={e => setForm({ ...form, dampak: e.target.value || null })}
                  placeholder="Pelayanan apa yang terhenti / lambat..."
                  className="w-full border border-slate-300 rounded px-3 py-2 pr-8 text-sm text-slate-900" />
                <MicButton value={form.dampak ?? ""} onChange={v => setForm({ ...form, dampak: v || null })} className="absolute right-1.5 bottom-1.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-700 mb-1">Prosedur Manual (workaround selama downtime — 13.1.a)</label>
                <div className="relative">
                <textarea rows={2} value={form.prosedur_manual ?? ""}
                  onChange={e => setForm({ ...form, prosedur_manual: e.target.value || null })}
                  placeholder="Mis. pendaftaran kertas, antrian manual, dst."
                  className="w-full border border-slate-300 rounded px-3 py-2 pr-8 text-sm text-slate-900" />
                <MicButton value={form.prosedur_manual ?? ""} onChange={v => setForm({ ...form, prosedur_manual: v || null })} className="absolute right-1.5 bottom-1.5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Root Cause (RCA)</label>
                  <div className="relative">
                  <textarea rows={3} value={form.root_cause ?? ""}
                    onChange={e => setForm({ ...form, root_cause: e.target.value || null })}
                    className="w-full border border-slate-300 rounded px-3 py-2 pr-8 text-sm text-slate-900" />
                  <MicButton value={form.root_cause ?? ""} onChange={v => setForm({ ...form, root_cause: v || null })} className="absolute right-1.5 bottom-1.5" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Tindakan Perbaikan</label>
                  <div className="relative">
                  <textarea rows={3} value={form.tindakan ?? ""}
                    onChange={e => setForm({ ...form, tindakan: e.target.value || null })}
                    className="w-full border border-slate-300 rounded px-3 py-2 pr-8 text-sm text-slate-900" />
                  <MicButton value={form.tindakan ?? ""} onChange={v => setForm({ ...form, tindakan: v || null })} className="absolute right-1.5 bottom-1.5" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-700 mb-1">Evaluasi Pasca Downtime (13.1.c)</label>
                <div className="relative">
                <textarea rows={2} value={form.evaluasi_pasca ?? ""}
                  onChange={e => setForm({ ...form, evaluasi_pasca: e.target.value || null })}
                  placeholder="Pelajaran + rencana pencegahan ke depan..."
                  className="w-full border border-slate-300 rounded px-3 py-2 pr-8 text-sm text-slate-900" />
                <MicButton value={form.evaluasi_pasca ?? ""} onChange={v => setForm({ ...form, evaluasi_pasca: v || null })} className="absolute right-1.5 bottom-1.5" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.rca_complete === 1}
                    onChange={e => setForm({ ...form, rca_complete: e.target.checked ? 1 : 0 })} />
                  RCA selesai
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700" title="Bukti MRMIK 13.1.b">
                  <input type="checkbox" checked={form.staf_terlatih === 1}
                    onChange={e => setForm({ ...form, staf_terlatih: e.target.checked ? 1 : 0 })} />
                  Staf dilatih (13.1.b)
                </label>
                <div>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as DowntimeStatus })}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900">
                    <option value="aktif">aktif</option>
                    <option value="selesai">selesai</option>
                    <option value="dievaluasi">dievaluasi</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm">Batal</button>
              <button onClick={save}
                disabled={!form.tanggal_mulai || !form.judul}
                className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium disabled:opacity-50">
                {editing ? "Simpan Perubahan" : "Buat Log"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
