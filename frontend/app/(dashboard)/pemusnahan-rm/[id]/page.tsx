"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  pemusnahanGetBatch, pemusnahanUpdateBatch, pemusnahanListDetail,
  pemusnahanAddDetail, pemusnahanUpdateDetail, pemusnahanDeleteDetail,
  pemusnahanSugesti,
  PemusnahanBatch, PemusnahanDetail, PemusnahanStatus, StatusBerkas, JenisBerkas,
} from "@/lib/api";

const STATUS_BATCH_COLOR: Record<PemusnahanStatus, string> = {
  draft:        "bg-slate-100 text-slate-700",
  usulan:       "bg-sky-100 text-sky-800",
  disetujui:    "bg-amber-100 text-amber-800",
  dilaksanakan: "bg-indigo-100 text-indigo-800",
  selesai:      "bg-emerald-100 text-emerald-800",
};
const STATUS_BERKAS_COLOR: Record<StatusBerkas, string> = {
  akan_dimusnahkan:  "bg-rose-100 text-rose-800 border-rose-300",
  disimpan_lanjutan: "bg-amber-100 text-amber-800 border-amber-300",
  dimusnahkan:       "bg-emerald-100 text-emerald-800 border-emerald-300",
  batal:             "bg-slate-100 text-slate-600 border-slate-300",
};

export default function PemusnahanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const batchId = Number(id);
  const [batch, setBatch] = useState<PemusnahanBatch | null>(null);
  const [details, setDetails] = useState<PemusnahanDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [jenisSugesti, setJenisSugesti] = useState<JenisBerkas>("rm_fisik");
  const [batasTahun, setBatasTahun] = useState(new Date().getFullYear() - 5);
  const [limit, setLimit] = useState(100);
  const [msg, setMsg] = useState<{ t: "ok"|"err"; m: string } | null>(null);
  const [manualRm, setManualRm] = useState("");
  const [manualNama, setManualNama] = useState("");

  // Saat batch berubah atau jenis berubah, auto-sync batas_tahun ke retensi dari batch
  useEffect(() => {
    if (!batch) return;
    const y = new Date().getFullYear();
    const r = jenisSugesti === "rm_elektronik"
      ? (batch.retensi_thn_rme || 25)
      : (batch.retensi_thn_aktif || 5);
    setBatasTahun(y - r);
  }, [batch, jenisSugesti]);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([pemusnahanGetBatch(batchId), pemusnahanListDetail(batchId)])
      .then(([a, b]) => { setBatch(a.data); setDetails(b.data); })
      .catch(() => setMsg({ t: "err", m: "Gagal memuat" }))
      .finally(() => setLoading(false));
  }, [batchId]);
  useEffect(() => { reload(); }, [reload]);

  const autoFromKhanza = async () => {
    const label = jenisSugesti === "rm_elektronik" ? "RME (25 thn)" : "RM Fisik (5 thn)";
    if (!confirm(`Cari pasien ${label} dengan kunjungan terakhir ≤ ${batasTahun}, tambahkan max ${limit} ke batch ini?`)) return;
    try {
      const r = await pemusnahanSugesti({
        batch_id: batchId, jenis_berkas: jenisSugesti,
        batas_tahun: batasTahun, limit, auto_add: true,
      });
      setMsg({ t: "ok", m: `✓ ${r.data.added_to_batch} berkas ${jenisSugesti.replace("_"," ")} ditambahkan dari ${r.data.total_kandidat} kandidat (batas ≤ ${r.data.batas_tahun})` });
      reload();
    } catch { setMsg({ t: "err", m: "Gagal sugesti" }); }
  };

  const addManual = async () => {
    if (!manualRm.trim()) return;
    try {
      await pemusnahanAddDetail(batchId, { no_rkm_medis: manualRm.trim(), nama_pasien: manualNama || null });
      setManualRm(""); setManualNama("");
      reload();
    } catch { setMsg({ t: "err", m: "Gagal tambah manual" }); }
  };

  const updateStatusBerkas = async (d: PemusnahanDetail, status_berkas: StatusBerkas) => {
    try {
      await pemusnahanUpdateDetail(batchId, d.id, {
        no_rkm_medis: d.no_rkm_medis, status_berkas,
        alasan_disimpan: status_berkas === "disimpan_lanjutan" ? (d.alasan_disimpan || "") : null,
      });
      reload();
    } catch { setMsg({ t: "err", m: "Gagal update" }); }
  };

  const updateBatchStatus = async (status: PemusnahanStatus) => {
    if (!batch) return;
    try {
      await pemusnahanUpdateBatch(batchId, {
        no_batch: batch.no_batch, tahun_pelaksanaan: batch.tahun_pelaksanaan,
        tanggal_berita_acara: batch.tanggal_berita_acara, no_berita_acara: batch.no_berita_acara,
        judul: batch.judul, catatan: batch.catatan,
        status,
      });
      setMsg({ t: "ok", m: `Status diubah ke ${status}` });
      reload();
    } catch { setMsg({ t: "err", m: "Gagal" }); }
  };

  const deleteDetail = async (d: PemusnahanDetail) => {
    if (!confirm(`Hapus ${d.no_rkm_medis} dari batch?`)) return;
    try { await pemusnahanDeleteDetail(batchId, d.id); reload(); }
    catch { setMsg({ t: "err", m: "Gagal hapus" }); }
  };

  if (loading || !batch) return <div className="p-6 text-slate-500 text-sm">Memuat...</div>;

  const countByStatus = details.reduce<Record<string, number>>((m, d) => {
    m[d.status_berkas] = (m[d.status_berkas] || 0) + 1; return m;
  }, {});

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <nav className="text-xs mb-4">
        <Link href="/pemusnahan-rm" className="text-indigo-600 hover:underline">← Daftar Batch</Link>
      </nav>

      <header className="bg-white border border-slate-200 rounded p-4 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-slate-900">{batch.no_batch}</h1>
              <span className={`text-xs px-2 py-0.5 rounded ${STATUS_BATCH_COLOR[batch.status]}`}>{batch.status}</span>
            </div>
            <p className="text-sm text-slate-700">{batch.judul}</p>
            <div className="text-xs text-slate-600 mt-2 space-y-0.5">
              <div>Berita Acara: <strong>{batch.no_berita_acara ?? "—"}</strong> · Tgl: {batch.tanggal_berita_acara ?? "—"}</div>
              <div>
                Retensi: <strong>{batch.retensi_thn_aktif}+{batch.retensi_thn_inaktif} thn</strong> RM Fisik · <strong>{batch.retensi_thn_rme} thn</strong> RME · Cara: <span className="capitalize">{batch.cara_pemusnahan.replace("_"," ")}</span>
              </div>
              <div>Total berkas: <strong>{batch.jumlah_berkas}</strong> · Dimusnahkan: <strong>{batch.jumlah_dimusnahkan}</strong></div>
            </div>
          </div>
          <div className="text-right flex gap-2 flex-wrap">
            {batch.status === "draft" && (
              <button onClick={() => updateBatchStatus("usulan")} className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-3 py-1.5 rounded">→ Ajukan</button>
            )}
            {batch.status === "usulan" && (
              <button onClick={() => updateBatchStatus("disetujui")} className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded">✓ Disetujui</button>
            )}
            {batch.status === "disetujui" && (
              <button onClick={() => updateBatchStatus("dilaksanakan")} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded">→ Dilaksanakan</button>
            )}
            {batch.status === "dilaksanakan" && (
              <button onClick={() => updateBatchStatus("selesai")} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded">✓ Selesai</button>
            )}
          </div>
        </div>
      </header>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded text-sm border ${msg.t === "ok"
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "bg-rose-50 text-rose-700 border-rose-200"}`}>{msg.m}</div>
      )}

      {/* Sugesti + manual add */}
      <div className="bg-white border border-slate-200 rounded p-4 mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Tambah Berkas ke Batch</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-r border-slate-200 pr-4">
            <h4 className="text-xs font-semibold text-purple-700 mb-2">🔮 Sugesti dari Khanza (otomatis)</h4>
            <div className="mb-2 flex gap-2">
              <button onClick={() => setJenisSugesti("rm_fisik")}
                className={`flex-1 text-xs px-3 py-2 rounded border ${jenisSugesti === "rm_fisik"
                  ? "bg-purple-600 text-white border-purple-700"
                  : "bg-white text-slate-700 border-slate-300"}`}>
                📁 RM Fisik ({batch.retensi_thn_aktif} thn)
              </button>
              <button onClick={() => setJenisSugesti("rm_elektronik")}
                className={`flex-1 text-xs px-3 py-2 rounded border ${jenisSugesti === "rm_elektronik"
                  ? "bg-purple-600 text-white border-purple-700"
                  : "bg-white text-slate-700 border-slate-300"}`}>
                💻 RME ({batch.retensi_thn_rme} thn)
              </button>
            </div>
            <div className="flex gap-2 items-end mb-2">
              <div>
                <label className="block text-xs text-slate-700 mb-1">Batas tahun ≤</label>
                <input type="number" value={batasTahun} onChange={e => setBatasTahun(Number(e.target.value))}
                  className="w-24 border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-xs text-slate-700 mb-1">Limit</label>
                <input type="number" value={limit} onChange={e => setLimit(Number(e.target.value))}
                  className="w-24 border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
              </div>
              <button onClick={autoFromKhanza}
                className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded whitespace-nowrap">
                + Auto-Tambah
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {jenisSugesti === "rm_elektronik" ? (
                <>📜 <strong>RME min 25 thn</strong> per Permenkes 24/2022 Pasal 30. Ambil pasien dengan kunjungan terakhir ≤ {batasTahun}.</>
              ) : (
                <>📜 <strong>RM Fisik min 5 thn</strong> per Permenkes 269/2008. Ambil pasien dengan kunjungan terakhir ≤ {batasTahun}.</>
              )}
              {" "}Idempotent — yang sudah ada di-skip.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-700 mb-2">✍️ Tambah Manual</h4>
            <div className="flex gap-2">
              <input type="text" placeholder="No. RM" value={manualRm}
                onChange={e => setManualRm(e.target.value)}
                className="w-32 border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 font-mono" />
              <input type="text" placeholder="Nama (opsional)" value={manualNama}
                onChange={e => setManualNama(e.target.value)}
                className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
              <button onClick={addManual} disabled={!manualRm.trim()}
                className="bg-slate-700 hover:bg-slate-800 text-white text-sm px-4 py-2 rounded disabled:opacity-50">
                + Tambah
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stat status berkas */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {(["akan_dimusnahkan","dimusnahkan","disimpan_lanjutan","batal"] as StatusBerkas[]).map(s => (
          <div key={s} className="bg-white border border-slate-200 rounded p-3">
            <div className={`text-xs ${STATUS_BERKAS_COLOR[s].split(" ")[1]} capitalize`}>{s.replace("_"," ")}</div>
            <div className="text-xl font-bold text-slate-900">{countByStatus[s] ?? 0}</div>
          </div>
        ))}
      </div>

      {/* List detail */}
      <div className="bg-white border border-slate-200 rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left px-3 py-2 text-slate-700">No. RM</th>
              <th className="text-left px-3 py-2 text-slate-700">Nama</th>
              <th className="text-left px-3 py-2 text-slate-700">Kunjungan Terakhir</th>
              <th className="text-left px-3 py-2 text-slate-700">Tgl Lahir</th>
              <th className="text-left px-3 py-2 text-slate-700">Jenis</th>
              <th className="text-center px-3 py-2 text-slate-700">Status Berkas</th>
              <th className="text-right px-3 py-2 text-slate-700">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {details.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada berkas. Gunakan sugesti Khanza atau tambah manual.</td></tr>
            ) : details.map(d => (
              <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs text-slate-900">{d.no_rkm_medis}</td>
                <td className="px-3 py-2 text-slate-900">{d.nama_pasien ?? "-"}</td>
                <td className="px-3 py-2 text-slate-700 text-xs">{d.tgl_kunjungan_terakhir ?? "(tidak ada)"}</td>
                <td className="px-3 py-2 text-slate-700 text-xs">{d.tgl_lahir ?? "-"}</td>
                <td className="px-3 py-2 text-slate-700 text-xs capitalize">{d.jenis_berkas.replace("_"," ")}</td>
                <td className="px-3 py-2 text-center">
                  <select value={d.status_berkas}
                    onChange={e => updateStatusBerkas(d, e.target.value as StatusBerkas)}
                    className={`text-xs px-2 py-1 rounded border ${STATUS_BERKAS_COLOR[d.status_berkas]}`}>
                    <option value="akan_dimusnahkan">Akan Dimusnahkan</option>
                    <option value="dimusnahkan">Dimusnahkan ✓</option>
                    <option value="disimpan_lanjutan">Disimpan Lanjutan</option>
                    <option value="batal">Batal</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => deleteDetail(d)} className="text-rose-600 hover:underline text-xs">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
