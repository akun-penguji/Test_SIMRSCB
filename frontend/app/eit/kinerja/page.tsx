"use client";

// eIT · Kinerja — catat aktivitas kerja IT dari lapangan (+ foto) dan lihat
// riwayat aktivitas sendiri. Petugas otomatis dari akun login.

import { useCallback, useEffect, useState } from "react";
import { getSession } from "@/lib/auth";
import { getKinerjaList, createKinerja, uploadLaporFoto, KinerjaAktivitas } from "@/lib/api";

const KATEGORI = ["konfigurasi", "pengembangan", "pemeliharaan", "perbaikan", "instalasi", "jaringan", "pelatihan", "lainnya"];

export default function EitKinerja() {
  const nama = getSession()?.nama || "";
  const [rows, setRows] = useState<KinerjaAktivitas[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const now = new Date();
    getKinerjaList({ tahun: now.getFullYear(), petugas: nama })
      .then(r => setRows(r.data)).catch(() => setRows([])).finally(() => setLoading(false));
  }, [nama]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <header className="bg-indigo-600 text-white px-4 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs opacity-80">eIT · Kinerja</div>
          <div className="font-bold">Aktivitas Saya</div>
        </div>
        <button onClick={() => setOpen(true)} className="bg-white/15 rounded-lg px-3 py-1.5 text-sm hover:bg-white/25">+ Catat</button>
      </header>

      <div className="p-3 space-y-2">
        {loading && <div className="text-center text-slate-400 text-sm py-8">Memuat…</div>}
        {!loading && rows.length === 0 && <div className="text-center text-slate-400 text-sm py-8">Belum ada aktivitas tahun ini.</div>}
        {rows.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-slate-800 text-sm">{r.judul}</div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 whitespace-nowrap">{r.kategori}</span>
            </div>
            {r.deskripsi && <div className="text-xs text-slate-500 mt-1">{r.deskripsi}</div>}
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
              <span>{r.tanggal?.slice(0, 16).replace("T", " ")}</span>
              {r.durasi_menit ? <span>· {Math.floor(r.durasi_menit / 60)}j {r.durasi_menit % 60}m</span> : null}
            </div>
            {r.foto && <div className="flex gap-1.5 mt-2 flex-wrap">{r.foto.split(",").filter(Boolean).map((u, i) =>
              <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="w-14 h-14 object-cover rounded-lg border border-slate-200" /></a>)}</div>}
          </div>
        ))}
      </div>

      {open && <FormCatat nama={nama} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function FormCatat({ nama, onClose, onSaved }: { nama: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ judul: "", deskripsi: "", kategori: "pemeliharaan", jam: "", menit: "" });
  const [fotos, setFotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setUploading(true);
    try { const urls: string[] = []; for (const file of files) { const r = await uploadLaporFoto(file); urls.push(r.data.url); } setFotos(p => [...p, ...urls]); }
    catch { setErr("Gagal unggah foto."); } finally { setUploading(false); e.target.value = ""; }
  }
  async function simpan() {
    if (!f.judul.trim()) { setErr("Kegiatan wajib diisi."); return; }
    const durasi = (Number(f.jam) || 0) * 60 + (Number(f.menit) || 0);
    setBusy(true); setErr("");
    try {
      await createKinerja({ judul: f.judul, deskripsi: f.deskripsi, kategori: f.kategori, petugas: nama,
        durasi_menit: durasi || undefined, foto: fotos.join(",") });
      onSaved();
    } catch { setErr("Gagal menyimpan."); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div className="w-full max-w-md mx-auto bg-white rounded-t-2xl p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Catat Aktivitas</h3>
          <button onClick={onClose} className="text-slate-400 text-xl">×</button>
        </div>
        {err && <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{err}</div>}
        <input value={f.judul} onChange={e => set("judul", e.target.value)} placeholder="Kegiatan (wajib)"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <textarea value={f.deskripsi} onChange={e => set("deskripsi", e.target.value)} rows={3} placeholder="Rincian…"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <select value={f.kategori} onChange={e => set("kategori", e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
          {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <div className="flex gap-2 items-center">
          <input value={f.jam} onChange={e => set("jam", e.target.value)} type="number" min={0} placeholder="0" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
          <span className="text-xs text-slate-400">jam</span>
          <input value={f.menit} onChange={e => set("menit", e.target.value)} type="number" min={0} max={59} placeholder="0" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
          <span className="text-xs text-slate-400">mnt</span>
        </div>
        <div>
          <label className="text-sm text-slate-600">Foto bukti (boleh beberapa)</label>
          <input type="file" accept="image/*" capture="environment" multiple onChange={onFiles} className="mt-1 block w-full text-sm" />
          {uploading && <div className="text-xs text-slate-400 mt-1">Mengunggah…</div>}
          {fotos.length > 0 && <div className="flex gap-2 flex-wrap mt-2">{fotos.map((u, i) => (
            <div key={i} className="relative"><img src={u} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
              <button type="button" onClick={() => setFotos(p => p.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs leading-none">×</button></div>))}</div>}
        </div>
        <button onClick={simpan} disabled={busy} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50">{busy ? "Menyimpan…" : "Simpan"}</button>
        <div className="text-[11px] text-slate-400 text-center">Tercatat atas nama <b>{nama}</b></div>
      </div>
    </div>
  );
}
