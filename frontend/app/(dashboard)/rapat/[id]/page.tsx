"use client";

// Detail satu rapat — info & agenda, daftar hadir, tindak lanjut, lampiran.

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { hasPerm } from "@/lib/auth";
import {
  getRapatDetail, updateRapat, deleteRapat,
  addRapatPeserta, deleteRapatPeserta,
  addRapatTindakLanjut, updateRapatTindakLanjut, deleteRapatTindakLanjut,
  uploadRapatLampiran, deleteRapatLampiran, rapatLampiranFileUrl,
  RapatDetail, RapatInput,
} from "@/lib/api";

const JENIS_OPSI = ["Rutin", "Insidentil", "Rapat Tinjauan Manajemen", "Evaluasi", "Lainnya"];
const STATUS_OPSI = ["Terjadwal", "Selesai", "Dibatalkan"];
const HADIR_OPSI = ["Hadir", "Tidak Hadir", "Izin"];
const TL_STATUS_OPSI = ["Belum", "Proses", "Selesai"];
const LAMPIRAN_JENIS_OPSI = ["Undangan", "Daftar Hadir", "Notulen", "Dokumentasi Foto", "Lainnya"];

export default function RapatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const isEdit = hasPerm("rapat_edit");

  const [d, setD] = useState<RapatDetail | null>(null);
  const [tab, setTab] = useState<"info" | "hadir" | "tindak" | "lampiran">("info");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getRapatDetail(id).then(r => setD(r.data)).catch(() => setD(null)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  if (loading) return <div className="text-sm text-slate-400">Memuat…</div>;
  if (!d) return <div className="text-sm text-red-600">Rapat tidak ditemukan. <Link href="/rapat" className="underline">Kembali ke daftar</Link></div>;

  async function hapusRapat() {
    if (!confirm(`Hapus rapat "${d!.judul}" beserta daftar hadir, tindak lanjut, dan lampirannya?`)) return;
    await deleteRapat(id);
    router.push("/rapat");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href="/rapat" className="text-xs text-slate-400 hover:underline">← Dokumentasi Rapat</Link>
          <h1 className="text-xl font-bold text-slate-800">{d.judul}</h1>
          <p className="text-sm text-slate-500">{d.unit} · {new Date(d.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}</p>
        </div>
        {isEdit && <button onClick={hapusRapat} className="px-3 py-1.5 text-sm rounded-lg bg-red-50 text-red-600 hover:bg-red-100">Hapus Rapat</button>}
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {([
          ["info", "Info & Agenda"],
          ["hadir", `Daftar Hadir (${d.peserta.length})`],
          ["tindak", `Tindak Lanjut (${d.tindak_lanjut.length})`],
          ["lampiran", `Lampiran (${d.lampiran.length})`],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
        ))}
      </div>

      {tab === "info" && <TabInfo d={d} isEdit={isEdit} onSaved={load} />}
      {tab === "hadir" && <TabHadir id={id} d={d} isEdit={isEdit} onChanged={load} />}
      {tab === "tindak" && <TabTindak id={id} d={d} isEdit={isEdit} onChanged={load} />}
      {tab === "lampiran" && <TabLampiran id={id} d={d} isEdit={isEdit} onChanged={load} />}
    </div>
  );
}

// ── Tab Info & Agenda ─────────────────────────────────────────────────────────
function TabInfo({ d, isEdit, onSaved }: { d: RapatDetail; isEdit: boolean; onSaved: () => void }) {
  const [f, setF] = useState<RapatInput>({
    judul: d.judul, unit: d.unit, jenis: d.jenis, tanggal: d.tanggal.slice(0, 10),
    jam_mulai: d.jam_mulai?.slice(0, 5) || "", jam_selesai: d.jam_selesai?.slice(0, 5) || "",
    tempat: d.tempat || "", pemimpin_rapat: d.pemimpin_rapat || "", notulis: d.notulis || "",
    agenda: d.agenda || "", notulen: d.notulen || "", kesimpulan: d.kesimpulan || "", status: d.status,
  });
  const set = (k: keyof RapatInput, v: string) => setF(p => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function simpan() {
    setBusy(true); setMsg("");
    try { await updateRapat(d.id, f); setMsg("Tersimpan."); onSaved(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Gagal menyimpan."); }
    finally { setBusy(false); }
  }

  const ro = !isEdit;
  const inp = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500";
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 max-w-2xl">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-slate-400">Judul</label>
          <input disabled={ro} value={f.judul} onChange={e => set("judul", e.target.value)} className={inp} /></div>
        <div><label className="text-xs text-slate-400">Unit / Komite</label>
          <input disabled={ro} value={f.unit} onChange={e => set("unit", e.target.value)} className={inp} /></div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div><label className="text-xs text-slate-400">Jenis</label>
          <select disabled={ro} value={f.jenis} onChange={e => set("jenis", e.target.value)} className={inp}>
            {JENIS_OPSI.map(j => <option key={j} value={j}>{j}</option>)}
          </select></div>
        <div><label className="text-xs text-slate-400">Tanggal</label>
          <input disabled={ro} type="date" value={f.tanggal} onChange={e => set("tanggal", e.target.value)} className={inp} /></div>
        <div><label className="text-xs text-slate-400">Jam Mulai</label>
          <input disabled={ro} type="time" value={f.jam_mulai} onChange={e => set("jam_mulai", e.target.value)} className={inp} /></div>
        <div><label className="text-xs text-slate-400">Jam Selesai</label>
          <input disabled={ro} type="time" value={f.jam_selesai} onChange={e => set("jam_selesai", e.target.value)} className={inp} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-xs text-slate-400">Tempat</label>
          <input disabled={ro} value={f.tempat} onChange={e => set("tempat", e.target.value)} className={inp} /></div>
        <div><label className="text-xs text-slate-400">Pemimpin Rapat</label>
          <input disabled={ro} value={f.pemimpin_rapat} onChange={e => set("pemimpin_rapat", e.target.value)} className={inp} /></div>
        <div><label className="text-xs text-slate-400">Notulis</label>
          <input disabled={ro} value={f.notulis} onChange={e => set("notulis", e.target.value)} className={inp} /></div>
      </div>
      <div><label className="text-xs text-slate-400">Agenda</label>
        <textarea disabled={ro} value={f.agenda} onChange={e => set("agenda", e.target.value)} rows={3} className={inp} /></div>
      <div><label className="text-xs text-slate-400">Notulen (ringkasan jalannya rapat)</label>
        <textarea disabled={ro} value={f.notulen} onChange={e => set("notulen", e.target.value)} rows={4} className={inp} /></div>
      <div><label className="text-xs text-slate-400">Kesimpulan</label>
        <textarea disabled={ro} value={f.kesimpulan} onChange={e => set("kesimpulan", e.target.value)} rows={2} className={inp} /></div>
      <div><label className="text-xs text-slate-400">Status</label>
        <select disabled={ro} value={f.status} onChange={e => set("status", e.target.value)} className={inp + " max-w-[200px]"}>
          {STATUS_OPSI.map(s => <option key={s} value={s}>{s}</option>)}
        </select></div>
      {isEdit && (
        <div className="flex items-center gap-3 pt-2">
          <button onClick={simpan} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white disabled:opacity-50">{busy ? "…" : "Simpan Perubahan"}</button>
          {msg && <span className="text-sm text-slate-500">{msg}</span>}
        </div>
      )}
    </div>
  );
}

// ── Tab Daftar Hadir ──────────────────────────────────────────────────────────
function TabHadir({ id, d, isEdit, onChanged }: { id: number; d: RapatDetail; isEdit: boolean; onChanged: () => void }) {
  const [nama, setNama] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [statusHadir, setStatusHadir] = useState("Hadir");
  const [busy, setBusy] = useState(false);

  async function tambah() {
    if (!nama.trim()) return;
    setBusy(true);
    try {
      await addRapatPeserta(id, { nama: nama.trim(), jabatan_unit: jabatan.trim() || undefined, status_hadir: statusHadir });
      setNama(""); setJabatan(""); setStatusHadir("Hadir"); onChanged();
    } finally { setBusy(false); }
  }
  async function hapus(pid: number) { await deleteRapatPeserta(pid); onChanged(); }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-w-3xl">
      {isEdit && (
        <div className="p-4 border-b border-slate-100 flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[160px]"><label className="text-xs text-slate-400">Nama</label>
            <input value={nama} onChange={e => setNama(e.target.value)} onKeyDown={e => e.key === "Enter" && tambah()}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" /></div>
          <div className="flex-1 min-w-[160px]"><label className="text-xs text-slate-400">Jabatan / Unit</label>
            <input value={jabatan} onChange={e => setJabatan(e.target.value)} onKeyDown={e => e.key === "Enter" && tambah()}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" /></div>
          <div><label className="text-xs text-slate-400">Status</label>
            <select value={statusHadir} onChange={e => setStatusHadir(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
              {HADIR_OPSI.map(h => <option key={h} value={h}>{h}</option>)}
            </select></div>
          <button onClick={tambah} disabled={busy || !nama.trim()} className="px-4 py-1.5 text-sm rounded-lg bg-green-600 text-white disabled:opacity-50">+ Tambah</button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-left"><tr>
          <th className="px-3 py-2">Nama</th><th className="px-3 py-2">Jabatan / Unit</th><th className="px-3 py-2">Status</th>{isEdit && <th></th>}
        </tr></thead>
        <tbody>
          {d.peserta.map(p => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="px-3 py-2">{p.nama}</td>
              <td className="px-3 py-2 text-slate-500">{p.jabatan_unit || "-"}</td>
              <td className="px-3 py-2">
                <span className={`text-xs px-2 py-0.5 rounded ${p.status_hadir === "Hadir" ? "bg-green-100 text-green-700" : p.status_hadir === "Izin" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{p.status_hadir}</span>
              </td>
              {isEdit && <td className="px-3 py-2 text-right"><button onClick={() => hapus(p.id)} className="text-xs text-slate-400 hover:text-red-600">hapus</button></td>}
            </tr>
          ))}
          {d.peserta.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Belum ada peserta tercatat.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab Tindak Lanjut ─────────────────────────────────────────────────────────
function TabTindak({ id, d, isEdit, onChanged }: { id: number; d: RapatDetail; isEdit: boolean; onChanged: () => void }) {
  const [uraian, setUraian] = useState("");
  const [pj, setPj] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  async function tambah() {
    if (!uraian.trim()) return;
    setBusy(true);
    try {
      await addRapatTindakLanjut(id, { uraian: uraian.trim(), penanggung_jawab: pj.trim() || undefined, target_selesai: target || undefined });
      setUraian(""); setPj(""); setTarget(""); onChanged();
    } finally { setBusy(false); }
  }
  async function gantiStatus(t: RapatDetail["tindak_lanjut"][number], status: string) {
    await updateRapatTindakLanjut(t.id, { uraian: t.uraian, penanggung_jawab: t.penanggung_jawab || undefined, target_selesai: t.target_selesai || undefined, status, keterangan: t.keterangan || undefined });
    onChanged();
  }
  async function hapus(tid: number) { await deleteRapatTindakLanjut(tid); onChanged(); }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-w-3xl">
      {isEdit && (
        <div className="p-4 border-b border-slate-100 space-y-2">
          <textarea value={uraian} onChange={e => setUraian(e.target.value)} rows={2} placeholder="Uraian tindak lanjut"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2 flex-wrap items-end">
            <div className="flex-1 min-w-[160px]"><label className="text-xs text-slate-400">Penanggung Jawab</label>
              <input value={pj} onChange={e => setPj(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" /></div>
            <div><label className="text-xs text-slate-400">Target Selesai</label>
              <input type="date" value={target} onChange={e => setTarget(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" /></div>
            <button onClick={tambah} disabled={busy || !uraian.trim()} className="px-4 py-1.5 text-sm rounded-lg bg-green-600 text-white disabled:opacity-50">+ Tambah</button>
          </div>
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-left"><tr>
          <th className="px-3 py-2">Uraian</th><th className="px-3 py-2">PJ</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">Status</th>{isEdit && <th></th>}
        </tr></thead>
        <tbody>
          {d.tindak_lanjut.map(t => (
            <tr key={t.id} className="border-t border-slate-100">
              <td className="px-3 py-2 max-w-[280px]">{t.uraian}</td>
              <td className="px-3 py-2 text-slate-500">{t.penanggung_jawab || "-"}</td>
              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{t.target_selesai ? new Date(t.target_selesai).toLocaleDateString("id-ID") : "-"}</td>
              <td className="px-3 py-2">
                {isEdit ? (
                  <select value={t.status} onChange={e => gantiStatus(t, e.target.value)}
                    className={`text-xs px-2 py-1 rounded border-0 ${t.status === "Selesai" ? "bg-green-100 text-green-700" : t.status === "Proses" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                    {TL_STATUS_OPSI.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <span className={`text-xs px-2 py-0.5 rounded ${t.status === "Selesai" ? "bg-green-100 text-green-700" : t.status === "Proses" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{t.status}</span>
                )}
              </td>
              {isEdit && <td className="px-3 py-2 text-right"><button onClick={() => hapus(t.id)} className="text-xs text-slate-400 hover:text-red-600">hapus</button></td>}
            </tr>
          ))}
          {d.tindak_lanjut.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Belum ada tindak lanjut.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab Lampiran ──────────────────────────────────────────────────────────────
function TabLampiran({ id, d, isEdit, onChanged }: { id: number; d: RapatDetail; isEdit: boolean; onChanged: () => void }) {
  const [jenis, setJenis] = useState("Dokumentasi Foto");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [msg, setMsg] = useState("");

  // Unggah beberapa file sekaligus: dikirim satu per satu ke endpoint per-file
  // yang sudah ada. Kalau ada yang gagal (mis. kebesaran), sisanya tetap jalan
  // dan nama file yang gagal dilaporkan supaya bisa diulang.
  async function unggah() {
    if (files.length === 0) return;
    setBusy(true); setMsg(""); setProgress("");
    const gagal: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setProgress(`Mengunggah ${i + 1}/${files.length}: ${files[i].name}`);
      try { await uploadRapatLampiran(id, jenis, files[i]); }
      catch (e) { gagal.push(`${files[i].name} (${e instanceof Error ? e.message : "gagal"})`); }
    }
    setFiles([]); setProgress("");
    setMsg(gagal.length === 0 ? "" : `Sebagian gagal: ${gagal.join(", ")}`);
    onChanged();
    setBusy(false);
  }
  async function hapus(lid: number) { if (!confirm("Hapus lampiran ini?")) return; await deleteRapatLampiran(lid); onChanged(); }

  return (
    <div className="space-y-3 max-w-3xl">
      {isEdit && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-2 flex-wrap items-end">
          <div><label className="text-xs text-slate-400">Jenis</label>
            <select value={jenis} onChange={e => setJenis(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
              {LAMPIRAN_JENIS_OPSI.map(j => <option key={j} value={j}>{j}</option>)}
            </select></div>
          <div className="flex-1 min-w-[200px]"><label className="text-xs text-slate-400">File (bisa pilih beberapa)</label>
            <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={e => setFiles(Array.from(e.target.files || []))} className="w-full text-sm" /></div>
          <button onClick={unggah} disabled={busy || files.length === 0} className="px-4 py-1.5 text-sm rounded-lg bg-green-600 text-white disabled:opacity-50">
            {busy ? "…" : `Unggah${files.length > 1 ? ` (${files.length})` : ""}`}
          </button>
          {files.length > 0 && !busy && <p className="text-xs text-slate-500 w-full">{files.length} file dipilih: {files.map(f => f.name).join(", ")}</p>}
          {busy && progress && <p className="text-xs text-blue-600 w-full">{progress}</p>}
          {msg && <p className="text-sm text-red-600 w-full">{msg}</p>}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {d.lampiran.map(l => {
          const isGambar = /\.(jpg|jpeg|png|webp)$/i.test(l.stored_name);
          const url = rapatLampiranFileUrl(l.stored_name);
          return (
            <div key={l.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <a href={url} target="_blank" rel="noopener noreferrer" className="block aspect-video bg-slate-50 flex items-center justify-center">
                {isGambar
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={url} alt={l.nama || "lampiran"} className="w-full h-full object-cover" />
                  : <span className="text-3xl">📄</span>}
              </a>
              <div className="p-2">
                <div className="text-xs px-1.5 py-0.5 rounded bg-slate-100 inline-block mb-1">{l.jenis}</div>
                <div className="text-sm truncate" title={l.nama || ""}>{l.nama || l.stored_name}</div>
                {isEdit && <button onClick={() => hapus(l.id)} className="text-xs text-slate-400 hover:text-red-600 mt-1">hapus</button>}
              </div>
            </div>
          );
        })}
        {d.lampiran.length === 0 && <div className="col-span-full text-center text-slate-400 py-8 text-sm">Belum ada lampiran.</div>}
      </div>
    </div>
  );
}
