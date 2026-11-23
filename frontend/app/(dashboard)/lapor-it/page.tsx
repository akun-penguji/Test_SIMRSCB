"use client";

// Lapor IT / Helpdesk — pelaporan gangguan IT oleh unit + penanganan tim IT.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { hasPerm, getSession } from "@/lib/auth";
import {
  getLaporIt, getLaporItRekap, createLaporIt, updateLaporIt, deleteLaporIt,
  uploadLaporFoto, LaporIt, LaporItRekap,
} from "@/lib/api";

const KATEGORI = ["hardware", "jaringan", "aplikasi", "printer", "lainnya"];
const PRIORITAS = ["rendah", "sedang", "tinggi"];
const STATUS = ["baru", "diproses", "selesai", "ditolak"];

const badgeStatus: Record<string, string> = {
  baru: "bg-amber-100 text-amber-700",
  diproses: "bg-blue-100 text-blue-700",
  selesai: "bg-green-100 text-green-700",
  ditolak: "bg-slate-200 text-slate-600",
};
function fmtTanggap(menit?: number) {
  if (menit == null) return <span className="text-slate-300">—</span>;
  const t = menit < 60 ? `${menit} mnt` : menit < 1440 ? `${(menit / 60).toFixed(1)} jam` : `${Math.round(menit / 1440)} hr`;
  const c = menit <= 15 ? "text-green-600" : menit <= 60 ? "text-amber-600" : "text-red-600";
  return <span className={`font-semibold ${c}`}>{t}</span>;
}
const badgePrioritas: Record<string, string> = {
  tinggi: "bg-red-100 text-red-700",
  sedang: "bg-amber-100 text-amber-700",
  rendah: "bg-slate-100 text-slate-600",
};

export default function LaporItPage() {
  const isIt = hasPerm("lapor_it_kelola");
  const [rows, setRows] = useState<LaporIt[]>([]);
  const [rekap, setRekap] = useState<LaporItRekap | null>(null);
  const [fStatus, setFStatus] = useState(""); const [fKat, setFKat] = useState("");
  const [fPrio, setFPrio] = useState(""); const [q, setQ] = useState("");
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const nowY = new Date().getFullYear();
  const tahunOpts = Array.from({ length: nowY - 2022 }, (_, i) => nowY - i); // nowY..2023
  const [openForm, setOpenForm] = useState(false);
  const [sel, setSel] = useState<LaporIt | null>(null);

  const load = useCallback(() => {
    getLaporIt({ status: fStatus, kategori: fKat, prioritas: fPrio, q, tahun }).then(r => setRows(r.data)).catch(() => {});
    getLaporItRekap(tahun).then(r => setRekap(r.data)).catch(() => {});
  }, [fStatus, fKat, fPrio, q, tahun]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">🛠️ Lapor IT / Helpdesk</h1>
          <p className="text-sm text-slate-500">Laporkan gangguan komputer, jaring, aplikasi SIMRS, atau printer ke tim IT.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => cetakDaftar(rows, rekap, tahun)} className="px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">🖨️ Cetak Laporan</button>
          {isIt && <Link href="/lapor-it/import" className="px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">📥 Impor dari WhatsApp</Link>}
          <button onClick={() => setOpenForm(true)} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700">+ Lapor Baru</button>
        </div>
      </div>

      {/* Ringkasan */}
      {rekap && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { l: "Total", v: rekap.ringkasan.total, c: "text-slate-700" },
            { l: "Baru", v: rekap.ringkasan.baru, c: "text-amber-600" },
            { l: "Diproses", v: rekap.ringkasan.diproses, c: "text-blue-600" },
            { l: "Selesai", v: rekap.ringkasan.selesai, c: "text-green-600" },
            { l: "Rata² tanggap (menit)", v: rekap.ringkasan.n_tanggap > 0 ? Math.round(rekap.ringkasan.avg_menit_tanggap) : "—", c: "text-slate-900" },
            { l: `SLA tanggap ≤${rekap.ringkasan.sla_menit}m`, v: rekap.ringkasan.n_tanggap > 0 ? `${Math.round(rekap.ringkasan.sla_persen)}%` : "—", c: rekap.ringkasan.n_tanggap === 0 ? "text-slate-400" : rekap.ringkasan.sla_persen >= 80 ? "text-green-600" : "text-red-600" },
          ].map((k, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-3">
              <div className="text-xs text-slate-500">{k.l}</div>
              <div className={`text-2xl font-bold ${k.c}`}>{k.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari judul / pelapor / no. tiket…"
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px]" />
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Semua status</option>{STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fKat} onChange={e => setFKat(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Semua kategori</option>{KATEGORI.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fPrio} onChange={e => setFPrio(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Semua prioritas</option>{PRIORITAS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={tahun} onChange={e => setTahun(Number(e.target.value))} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          {tahunOpts.map(y => <option key={y} value={y}>Tahun {y}</option>)}
        </select>
      </div>

      {/* Daftar */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-slate-800">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-2">No. Tiket</th><th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Judul</th><th className="px-3 py-2">Unit / Pelapor</th>
              <th className="px-3 py-2">Kategori</th><th className="px-3 py-2">Prioritas</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Tanggap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} onClick={() => setSel(r)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                <td className="px-3 py-2 font-mono text-xs">{r.no_tiket || `#${r.id}`}{r.sumber === "wa_import" && <span className="ml-1 text-[10px] text-green-600">WA</span>}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-500">{r.tanggal_lapor?.slice(0, 16)}</td>
                <td className="px-3 py-2 max-w-[280px] truncate">{r.judul}</td>
                <td className="px-3 py-2 text-slate-500">{r.unit || "-"}<br /><span className="text-xs">{r.pelapor}</span></td>
                <td className="px-3 py-2">{r.kategori}</td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs ${badgePrioritas[r.prioritas] || ""}`}>{r.prioritas}</span></td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs ${badgeStatus[r.status] || ""}`}>{r.status}</span></td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">{fmtTanggap(r.menit_tanggap)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">Belum ada laporan.</td></tr>}
          </tbody>
        </table>
      </div>

      {openForm && <FormLapor onClose={() => setOpenForm(false)} onSaved={() => { setOpenForm(false); load(); }} />}
      {sel && <DetailLapor row={sel} isIt={isIt} onClose={() => setSel(null)} onChanged={() => { setSel(null); load(); }} />}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mt-10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function FormLapor({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const nama = getSession()?.nama || "";
  const [f, setF] = useState({ unit: "", pelapor: nama, kontak: "", kategori: "", prioritas: "sedang", judul: "", deskripsi: "" });
  const [fotos, setFotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setUploading(true); setErr("");
    try {
      const urls: string[] = [];
      for (const file of files) { const r = await uploadLaporFoto(file); urls.push(r.data.url); }
      setFotos(p => [...p, ...urls]);
    } catch { setErr("Gagal upload gambar (hanya jpg/png/gif/webp, maks 8MB)."); }
    finally { setUploading(false); e.target.value = ""; }
  }
  async function simpan() {
    if (!f.judul.trim()) { setErr("Judul wajib diisi."); return; }
    setBusy(true); setErr("");
    try { await createLaporIt({ ...f, foto: fotos.join(",") }); onSaved(); }
    catch { setErr("Gagal menyimpan laporan."); } finally { setBusy(false); }
  }
  return (
    <Modal title="Lapor Gangguan IT" onClose={onClose}>
      <div className="space-y-3">
        {err && <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{err}</div>}
        <input value={f.judul} onChange={e => set("judul", e.target.value)} placeholder="Judul singkat masalah (wajib), mis. Printer poli anak tidak bisa cetak"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <textarea value={f.deskripsi} onChange={e => set("deskripsi", e.target.value)} rows={3} placeholder="Deskripsi detail…"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <input value={f.unit} onChange={e => set("unit", e.target.value)} placeholder="Unit / ruangan"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={f.kontak} onChange={e => set("kontak", e.target.value)} placeholder="Kontak (No. HP / ext)"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <select value={f.kategori} onChange={e => set("kategori", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Kategori (otomatis)</option>{KATEGORI.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={f.prioritas} onChange={e => set("prioritas", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            {PRIORITAS.map(s => <option key={s} value={s}>Prioritas: {s}</option>)}
          </select>
        </div>
        <input value={f.pelapor} onChange={e => set("pelapor", e.target.value)} placeholder="Nama pelapor"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <div>
          <label className="text-sm text-slate-600">Foto / lampiran gambar (opsional)</label>
          <input type="file" accept="image/*" multiple onChange={onFiles} className="mt-1 block w-full text-sm" />
          {uploading && <div className="text-xs text-slate-400 mt-1">Mengunggah…</div>}
          {fotos.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {fotos.map((u, i) => (
                <div key={i} className="relative">
                  <img src={u} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                  <button type="button" onClick={() => setFotos(p => p.filter((_, j) => j !== i))}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs leading-none">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-slate-100 text-slate-600">Batal</button>
          <button onClick={simpan} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
            {busy ? "Menyimpan…" : "Kirim Laporan"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DetailLapor({ row, isIt, onClose, onChanged }: { row: LaporIt; isIt: boolean; onClose: () => void; onChanged: () => void }) {
  const nama = getSession()?.nama || "";
  const [status, setStatus] = useState(row.status);
  const [prioritas, setPrioritas] = useState(row.prioritas);
  const [kategori, setKategori] = useState(row.kategori);
  const [tindakan, setTindakan] = useState(row.tindakan || "");
  const [fotoT, setFotoT] = useState<string[]>((row.foto_tindakan || "").split(",").filter(Boolean));
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  async function onFilesT(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setUploading(true);
    try { const urls: string[] = []; for (const file of files) { const r = await uploadLaporFoto(file); urls.push(r.data.url); } setFotoT(p => [...p, ...urls]); }
    catch { /* ignore */ } finally { setUploading(false); e.target.value = ""; }
  }
  async function simpan() {
    setBusy(true);
    try { await updateLaporIt(row.id, { status, prioritas, kategori, tindakan, pic_nama: nama, foto_tindakan: fotoT.join(",") }); onChanged(); }
    catch { setBusy(false); }
  }
  async function hapus() {
    if (!confirm("Hapus laporan ini?")) return;
    setBusy(true);
    try { await deleteLaporIt(row.id); onChanged(); } catch { setBusy(false); }
  }
  return (
    <Modal title={row.no_tiket || `Laporan #${row.id}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div><span className="text-slate-400">Tanggal:</span> {row.tanggal_lapor}</div>
        <div><span className="text-slate-400">Pelapor:</span> {row.pelapor || "-"} {row.unit && `(${row.unit})`} {row.kontak && `· ${row.kontak}`}</div>
        {row.tanggal_tanggap && (
          <div><span className="text-slate-400">Direspons:</span> {row.tanggal_tanggap} · waktu tanggap {fmtTanggap(row.menit_tanggap)}{row.pic_nama && ` · oleh ${row.pic_nama}`}</div>
        )}
        <div className="font-semibold text-slate-800">{row.judul}</div>
        {row.deskripsi && <div className="text-slate-600 whitespace-pre-wrap bg-slate-50 rounded p-3">{row.deskripsi}</div>}
        {row.foto && (
          <div className="flex gap-2 flex-wrap">
            {row.foto.split(",").filter(Boolean).map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer">
                <img src={u} alt="" className="w-24 h-24 object-cover rounded-lg border border-slate-200 hover:opacity-80" />
              </a>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <button onClick={() => cetakTiket(row)} className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">🖨️ Cetak Tiket</button>
        </div>

        {isIt ? (
          <div className="border-t border-slate-200 pt-3 space-y-3">
            <div className="text-xs font-semibold text-slate-500">PENANGANAN TIM IT</div>
            <div className="grid grid-cols-3 gap-2">
              <select value={status} onChange={e => setStatus(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
                {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={prioritas} onChange={e => setPrioritas(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
                {PRIORITAS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={kategori} onChange={e => setKategori(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
                {KATEGORI.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <textarea value={tindakan} onChange={e => setTindakan(e.target.value)} rows={3} placeholder="Tindakan / solusi yang dilakukan…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <div>
              <label className="text-xs text-slate-500">Foto tindakan / bukti perbaikan (opsional)</label>
              <input type="file" accept="image/*" multiple onChange={onFilesT} className="mt-1 block w-full text-sm" />
              {uploading && <div className="text-xs text-slate-400 mt-1">Mengunggah…</div>}
              {fotoT.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {fotoT.map((u, i) => (
                    <div key={i} className="relative">
                      <img src={u} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                      <button type="button" onClick={() => setFotoT(p => p.filter((_, j) => j !== i))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <button onClick={hapus} disabled={busy} className="px-3 py-2 text-sm rounded-lg text-red-600 hover:bg-red-50">Hapus</button>
              <button onClick={simpan} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                {busy ? "Menyimpan…" : "Simpan Penanganan"}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-slate-200 pt-3 space-y-1">
            <div><span className="text-slate-400">Status:</span> <span className={`px-2 py-0.5 rounded text-xs ${badgeStatus[row.status] || ""}`}>{row.status}</span></div>
            {row.tindakan && <div><span className="text-slate-400">Tindakan:</span> {row.tindakan}</div>}
            {row.pic_nama && <div><span className="text-slate-400">Ditangani:</span> {row.pic_nama}</div>}
            {row.foto_tindakan && (
              <div className="flex gap-2 flex-wrap pt-1">
                {row.foto_tindakan.split(",").filter(Boolean).map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200" /></a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Cetak (buka jendela baru + window.print) ────────────────────────────────
const esc = (s?: string) => (s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const KOP = `
  <div style="text-align:center;border-bottom:3px double #222;padding-bottom:8px;margin-bottom:14px">
    <div style="font-size:12px">PEMERINTAH KABUPATEN BEKASI &middot; DINAS KESEHATAN</div>
    <div style="font-size:19px;font-weight:bold">RSUD CABANGBUNGIN</div>
    <div style="font-size:11px">Jl. Raya Cabangbungin, Kabupaten Bekasi, Jawa Barat</div>
  </div>`;
function printHtml(title: string, inner: string) {
  const w = window.open("", "_blank", "width=900,height=650"); if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12px}
      h2{margin:0 0 2px;font-size:16px} table{border-collapse:collapse;width:100%;margin-top:8px}
      th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top;font-size:11px}
      th{background:#f0f0f0} .muted{color:#555} .r{border:1px solid #999;padding:6px;border-radius:4px}
      .grid{display:flex;gap:8px;margin:8px 0} .grid>div{flex:1;text-align:center;border:1px solid #999;padding:6px;border-radius:4px}
      .big{font-size:18px;font-weight:bold} img{max-width:180px;max-height:180px;margin:4px;border:1px solid #ccc}
      @media print{.noprint{display:none}}
    </style></head><body>${KOP}${inner}
    <div class="noprint" style="margin-top:16px;text-align:center">
      <button onclick="window.print()" style="padding:8px 20px;font-size:13px">🖨️ Cetak</button>
    </div>
    <script>setTimeout(function(){window.print()},400)<\/script>
    </body></html>`);
  w.document.close();
}
function cetakTiket(r: LaporIt) {
  const imgs = (v?: string) => (v || "").split(",").filter(Boolean).map(u => `<img src="${esc(u)}">`).join("");
  const fotoHtml = r.foto ? `<div style="margin-top:6px"><b>Foto laporan:</b><br>${imgs(r.foto)}</div>` : "";
  const fotoTHtml = r.foto_tindakan ? `<div style="margin-top:6px"><b>Foto tindakan / bukti perbaikan:</b><br>${imgs(r.foto_tindakan)}</div>` : "";
  printHtml(`Tiket ${r.no_tiket || r.id}`, `
    <h2>TIKET LAPORAN IT / HELPDESK</h2>
    <div class="muted">No. Tiket: <b>${esc(r.no_tiket || String(r.id))}</b></div>
    <table>
      <tr><th style="width:160px">Tanggal Lapor</th><td>${esc(r.tanggal_lapor)}</td></tr>
      <tr><th>Pelapor</th><td>${esc(r.pelapor)} ${r.unit ? "(" + esc(r.unit) + ")" : ""} ${r.kontak ? "&middot; " + esc(r.kontak) : ""}</td></tr>
      <tr><th>Kategori</th><td>${esc(r.kategori)}</td></tr>
      <tr><th>Prioritas</th><td>${esc(r.prioritas)}</td></tr>
      <tr><th>Status</th><td>${esc(r.status)}${r.tanggal_selesai ? " &middot; selesai " + esc(r.tanggal_selesai) : ""}</td></tr>
      <tr><th>Judul</th><td><b>${esc(r.judul)}</b></td></tr>
      <tr><th>Deskripsi</th><td>${esc(r.deskripsi).replace(/\n/g, "<br>")}</td></tr>
      <tr><th>Tindakan / Solusi</th><td>${esc(r.tindakan).replace(/\n/g, "<br>") || "-"}</td></tr>
      <tr><th>Ditangani oleh</th><td>${esc(r.pic_nama) || "-"}</td></tr>
    </table>
    ${fotoHtml}
    ${fotoTHtml}
    <div style="margin-top:40px;display:flex;justify-content:space-around;text-align:center">
      <div>Pelapor<br><br><br>( ${esc(r.pelapor) || "..............."} )</div>
      <div>Petugas IT<br><br><br>( ${esc(r.pic_nama) || "..............."} )</div>
    </div>`);
}
function cetakDaftar(rows: LaporIt[], rekap: LaporItRekap | null, tahun: number) {
  const rk = rekap?.ringkasan;
  const ring = rk ? `<div class="grid">
    <div><div class="big">${rk.total}</div>Total</div>
    <div><div class="big">${rk.baru}</div>Baru</div>
    <div><div class="big">${rk.diproses}</div>Diproses</div>
    <div><div class="big">${rk.selesai}</div>Selesai</div>
  </div>` : "";
  const body = rows.map((r, i) => `<tr>
    <td>${i + 1}</td><td>${esc(r.no_tiket || String(r.id))}</td>
    <td>${esc(r.tanggal_lapor?.slice(0, 16))}</td><td>${esc(r.judul)}</td>
    <td>${esc(r.unit)}<br><span class="muted">${esc(r.pelapor)}</span></td>
    <td>${esc(r.kategori)}</td><td>${esc(r.prioritas)}</td><td>${esc(r.status)}</td>
    <td>${esc(r.tindakan)}</td></tr>`).join("");
  printHtml(`Laporan IT ${tahun}`, `
    <h2>LAPORAN GANGGUAN IT / HELPDESK — TAHUN ${tahun}</h2>
    <div class="muted">Jumlah data tampil: ${rows.length}</div>
    ${ring}
    <table><thead><tr><th>No</th><th>No. Tiket</th><th>Tanggal</th><th>Judul</th><th>Unit / Pelapor</th><th>Kategori</th><th>Prioritas</th><th>Status</th><th>Tindakan</th></tr></thead>
    <tbody>${body || '<tr><td colspan="9" style="text-align:center">Tidak ada data</td></tr>'}</tbody></table>
    <div style="margin-top:36px;text-align:right">Cabangbungin, ................................<br><br><br>Petugas IT<br><br><br>( ............................... )</div>`);
}
