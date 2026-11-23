"use client";

// eIT · Tiket — daftar tiket Lapor IT untuk ditangani teknisi di lapangan:
// ambil (jadi PIC + diproses), lalu selesaikan dengan tindakan + foto bukti.

import { useCallback, useEffect, useState } from "react";
import { getSession } from "@/lib/auth";
import { getLaporIt, updateLaporIt, uploadLaporFoto, LaporIt } from "@/lib/api";

const STATUS_WARNA: Record<string, string> = {
  baru: "bg-amber-100 text-amber-700",
  diproses: "bg-blue-100 text-blue-700",
  selesai: "bg-green-100 text-green-700",
};
const PRIO_WARNA: Record<string, string> = {
  kritis: "bg-red-100 text-red-700", tinggi: "bg-orange-100 text-orange-700",
  sedang: "bg-slate-100 text-slate-600", rendah: "bg-slate-100 text-slate-500",
};

export default function EitTiket() {
  const s = getSession();
  const [filter, setFilter] = useState<"terbuka" | "semua">("terbuka");
  const [rows, setRows] = useState<LaporIt[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<LaporIt | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const tahun = new Date().getFullYear();
    if (filter === "semua") {
      getLaporIt({ tahun }).then(r => setRows(r.data)).catch(() => setRows([])).finally(() => setLoading(false));
    } else {
      Promise.all([getLaporIt({ tahun, status: "baru" }), getLaporIt({ tahun, status: "diproses" })])
        .then(([a, b]) => setRows([...a.data, ...b.data].sort((x, y) => (y.tanggal_lapor || "").localeCompare(x.tanggal_lapor || ""))))
        .catch(() => setRows([])).finally(() => setLoading(false));
    }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <header className="bg-indigo-600 text-white px-4 py-4">
        <div className="text-xs opacity-80">eIT · Tiket</div>
        <div className="font-bold">Lapor IT / Helpdesk</div>
      </header>

      <div className="p-3 flex gap-2">
        {(["terbuka", "semua"] as const).map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm ${filter === t ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
            {t === "terbuka" ? "Terbuka" : "Semua"}
          </button>
        ))}
      </div>

      <div className="px-3 space-y-2">
        {loading && <div className="text-center text-slate-400 text-sm py-8">Memuat…</div>}
        {!loading && rows.length === 0 && <div className="text-center text-slate-400 text-sm py-8">Tidak ada tiket.</div>}
        {rows.map(r => (
          <button key={r.id} onClick={() => setDetail(r)} className="w-full text-left bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-slate-800 text-sm">{r.judul}</div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${STATUS_WARNA[r.status] || "bg-slate-100"}`}>{r.status}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[11px] text-slate-400">
              {r.unit && <span>{r.unit}</span>}
              <span className={`px-1.5 py-0.5 rounded ${PRIO_WARNA[r.prioritas] || "bg-slate-100"}`}>{r.prioritas}</span>
              <span>· {r.tanggal_lapor?.slice(0, 10)}</span>
              {r.pic_nama && <span>· PIC: {r.pic_nama}</span>}
            </div>
          </button>
        ))}
      </div>

      {detail && <DetailTiket t={detail} me={s?.nama || ""} onClose={() => setDetail(null)} onSaved={() => { setDetail(null); load(); }} />}
    </div>
  );
}

function DetailTiket({ t, me, onClose, onSaved }: { t: LaporIt; me: string; onClose: () => void; onSaved: () => void }) {
  const [tindakan, setTindakan] = useState(t.tindakan || "");
  const [fotos, setFotos] = useState<string[]>(t.foto_tindakan ? t.foto_tindakan.split(",").filter(Boolean) : []);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setUploading(true);
    try { const urls: string[] = []; for (const file of files) { const r = await uploadLaporFoto(file); urls.push(r.data.url); } setFotos(p => [...p, ...urls]); }
    catch { setErr("Gagal unggah foto."); } finally { setUploading(false); e.target.value = ""; }
  }
  async function simpan(status: string) {
    setBusy(true); setErr("");
    try {
      await updateLaporIt(t.id, {
        status,
        pic_nama: t.pic_nama || me,
        tindakan: tindakan || undefined,
        foto_tindakan: fotos.join(","),
      });
      onSaved();
    } catch { setErr("Gagal menyimpan."); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div className="w-full max-w-md mx-auto bg-white rounded-t-2xl p-4 space-y-3 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-800">{t.judul}</h3>
            <div className="text-[11px] text-slate-400">{t.unit} · {t.prioritas} · {t.tanggal_lapor?.slice(0, 16).replace("T", " ")}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 text-xl">×</button>
        </div>
        {t.deskripsi && <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-2">{t.deskripsi}</div>}
        {t.foto && <div className="flex gap-1.5 flex-wrap">{t.foto.split(",").filter(Boolean).map((u, i) =>
          <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200" /></a>)}</div>}

        {err && <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{err}</div>}

        <div>
          <label className="text-sm text-slate-600">Tindakan penanganan</label>
          <textarea value={tindakan} onChange={e => setTindakan(e.target.value)} rows={3} placeholder="Apa yang dilakukan…"
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm text-slate-600">Foto hasil / bukti</label>
          <input type="file" accept="image/*" capture="environment" multiple onChange={onFiles} className="mt-1 block w-full text-sm" />
          {uploading && <div className="text-xs text-slate-400 mt-1">Mengunggah…</div>}
          {fotos.length > 0 && <div className="flex gap-2 flex-wrap mt-2">{fotos.map((u, i) => (
            <div key={i} className="relative"><img src={u} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
              <button type="button" onClick={() => setFotos(p => p.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs leading-none">×</button></div>))}</div>}
        </div>

        <div className="flex gap-2 pt-1">
          {t.status === "baru" && (
            <button onClick={() => simpan("diproses")} disabled={busy} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50">Ambil (proses)</button>
          )}
          <button onClick={() => simpan("selesai")} disabled={busy} className="flex-1 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium disabled:opacity-50">{busy ? "…" : "Tandai Selesai"}</button>
        </div>
        <div className="text-[11px] text-slate-400 text-center">PIC akan tercatat: <b>{t.pic_nama || me}</b></div>
      </div>
    </div>
  );
}
