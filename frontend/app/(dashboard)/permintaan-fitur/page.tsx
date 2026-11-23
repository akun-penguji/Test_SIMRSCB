"use client";

// Permintaan Fitur SIMRS — usulan pengembangan dari unit + voting + kelola tim.

import { useCallback, useEffect, useState } from "react";
import { hasPerm, getSession } from "@/lib/auth";
import {
  getFitur, getFiturRekap, createFitur, updateFitur, deleteFitur, voteFitur,
  uploadLaporFoto, importWaFitur, PermintaanFitur, FiturRekap, WaParsed,
} from "@/lib/api";

const MODUL = ["Pendaftaran", "Rekam Medis", "Farmasi", "Kasir/Billing", "Laporan", "BPJS/Bridging", "Laboratorium", "Radiologi", "Rawat Jalan", "Rawat Inap", "IGD", "lainnya"];
const PRIORITAS = ["rendah", "sedang", "tinggi"];
const STATUS = ["baru", "ditinjau", "disetujui", "dikerjakan", "selesai", "ditolak"];
const badgeStatus: Record<string, string> = {
  baru: "bg-amber-100 text-amber-700", ditinjau: "bg-sky-100 text-sky-700",
  disetujui: "bg-indigo-100 text-indigo-700", dikerjakan: "bg-blue-100 text-blue-700",
  selesai: "bg-green-100 text-green-700", ditolak: "bg-slate-200 text-slate-600",
};

export default function FiturPage() {
  const isKelola = hasPerm("lapor_it_kelola");
  const [rows, setRows] = useState<PermintaanFitur[]>([]);
  const [rekap, setRekap] = useState<FiturRekap | null>(null);
  const [fStatus, setFStatus] = useState(""); const [fModul, setFModul] = useState("");
  const [q, setQ] = useState(""); const [sort, setSort] = useState("populer");
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const nowY = new Date().getFullYear();
  const tahunOpts = Array.from({ length: nowY - 2024 }, (_, i) => nowY - i);
  const [openForm, setOpenForm] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [sel, setSel] = useState<PermintaanFitur | null>(null);

  const load = useCallback(() => {
    getFitur({ status: fStatus, modul: fModul, q, sort, tahun }).then(r => setRows(r.data)).catch(() => {});
    getFiturRekap(tahun).then(r => setRekap(r.data)).catch(() => {});
  }, [fStatus, fModul, q, sort, tahun]);
  useEffect(() => { load(); }, [load]);

  async function doVote(r: PermintaanFitur, e: React.MouseEvent) {
    e.stopPropagation();
    try { const res = await voteFitur(r.id); setRows(p => p.map(x => x.id === r.id ? { ...x, vote_count: res.data.vote_count, sudah_vote: res.data.voted ? 1 : 0 } : x)); }
    catch { /* ignore */ }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">💡 Permintaan Fitur SIMRS</h1>
          <p className="text-sm text-slate-500">Usulkan fitur/pengembangan SIMRS. Dukung usulan yang menurut Anda penting.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => cetakDaftar(rows, rekap, tahun)} className="px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">🖨️ Cetak</button>
          {isKelola && <button onClick={() => setOpenImport(true)} className="px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">📥 Impor WA</button>}
          <button onClick={() => setOpenForm(true)} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700">+ Usulkan Fitur</button>
        </div>
      </div>

      {rekap && (
        <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
          {[
            { l: "Total", v: rekap.ringkasan.total }, { l: "Baru", v: rekap.ringkasan.baru },
            { l: "Ditinjau", v: rekap.ringkasan.ditinjau }, { l: "Disetujui", v: rekap.ringkasan.disetujui },
            { l: "Dikerjakan", v: rekap.ringkasan.dikerjakan }, { l: "Selesai", v: rekap.ringkasan.selesai },
            { l: "Ditolak", v: rekap.ringkasan.ditolak },
          ].map((k, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-2 text-center">
              <div className="text-[11px] text-slate-500">{k.l}</div>
              <div className="text-xl font-bold text-slate-700">{k.v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari usulan…"
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[180px]" />
        <select value={sort} onChange={e => setSort(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="populer">Terpopuler</option><option value="terbaru">Terbaru</option>
        </select>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Semua status</option>{STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fModul} onChange={e => setFModul(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Semua modul</option>{MODUL.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={tahun} onChange={e => setTahun(Number(e.target.value))} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          {tahunOpts.map(y => <option key={y} value={y}>Tahun {y}</option>)}
        </select>
      </div>

      <div className="grid gap-2">
        {rows.map(r => (
          <div key={r.id} onClick={() => setSel(r)} className="bg-white border border-slate-200 rounded-xl p-3 flex gap-3 items-start hover:border-slate-300 cursor-pointer">
            <button onClick={e => doVote(r, e)}
              className={`flex flex-col items-center justify-center rounded-lg border w-14 py-1.5 shrink-0 ${r.sudah_vote ? "bg-green-50 border-green-400 text-green-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              <span className="text-lg leading-none">▲</span>
              <span className="text-sm font-bold">{r.vote_count}</span>
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-slate-400">{r.no_tiket || `#${r.id}`}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${badgeStatus[r.status] || ""}`}>{r.status}</span>
                <span className="text-xs text-slate-400">{r.modul}</span>
              </div>
              <div className="font-semibold text-slate-800 truncate">{r.judul}</div>
              {r.deskripsi && <div className="text-sm text-slate-500 line-clamp-2">{r.deskripsi}</div>}
              <div className="text-xs text-slate-400 mt-0.5">{r.pengusul} {r.unit && `· ${r.unit}`} · {r.tanggal?.slice(0, 10)}</div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-center text-slate-400 py-10">Belum ada usulan.</div>}
      </div>

      {openForm && <FormFitur onClose={() => setOpenForm(false)} onSaved={() => { setOpenForm(false); load(); }} />}
      {openImport && <ImportFiturModal onClose={() => setOpenImport(false)} onDone={() => { setOpenImport(false); load(); }} />}
      {sel && <DetailFitur row={sel} isKelola={isKelola} onClose={() => setSel(null)} onChanged={() => { setSel(null); load(); }} onVote={doVote} />}
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

function FormFitur({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const nama = getSession()?.nama || "";
  const [f, setF] = useState({ modul: "", judul: "", deskripsi: "", manfaat: "", prioritas: "sedang", pengusul: nama, unit: "", kontak: "" });
  const [fotos, setFotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setUploading(true); setErr("");
    try { const urls: string[] = []; for (const file of files) { const r = await uploadLaporFoto(file); urls.push(r.data.url); } setFotos(p => [...p, ...urls]); }
    catch { setErr("Gagal upload gambar."); } finally { setUploading(false); e.target.value = ""; }
  }
  async function simpan() {
    if (!f.judul.trim()) { setErr("Judul wajib diisi."); return; }
    setBusy(true); setErr("");
    try { await createFitur({ ...f, foto: fotos.join(",") }); onSaved(); }
    catch { setErr("Gagal menyimpan usulan."); } finally { setBusy(false); }
  }
  return (
    <Modal title="Usulkan Fitur SIMRS" onClose={onClose}>
      <div className="space-y-3">
        {err && <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{err}</div>}
        <input value={f.judul} onChange={e => set("judul", e.target.value)} placeholder="Judul fitur yang diusulkan (wajib)"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <select value={f.modul} onChange={e => set("modul", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Pilih modul</option>{MODUL.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={f.prioritas} onChange={e => set("prioritas", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            {PRIORITAS.map(s => <option key={s} value={s}>Prioritas usulan: {s}</option>)}
          </select>
        </div>
        <textarea value={f.deskripsi} onChange={e => set("deskripsi", e.target.value)} rows={3} placeholder="Deskripsi kebutuhan / cara kerja fitur…"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <textarea value={f.manfaat} onChange={e => set("manfaat", e.target.value)} rows={2} placeholder="Manfaat / alasan kenapa fitur ini dibutuhkan…"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <input value={f.unit} onChange={e => set("unit", e.target.value)} placeholder="Unit pengusul"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={f.kontak} onChange={e => set("kontak", e.target.value)} placeholder="Kontak (opsional)"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <input value={f.pengusul} onChange={e => set("pengusul", e.target.value)} placeholder="Nama pengusul"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <div>
          <label className="text-sm text-slate-600">Gambar / mockup (opsional)</label>
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
            {busy ? "Menyimpan…" : "Kirim Usulan"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DetailFitur({ row, isKelola, onClose, onChanged, onVote }: {
  row: PermintaanFitur; isKelola: boolean; onClose: () => void; onChanged: () => void; onVote: (r: PermintaanFitur, e: React.MouseEvent) => void;
}) {
  const nama = getSession()?.nama || "";
  const [status, setStatus] = useState(row.status);
  const [prioritas, setPrioritas] = useState(row.prioritas);
  const [modul, setModul] = useState(row.modul);
  const [tanggapan, setTanggapan] = useState(row.tanggapan || "");
  const [target, setTarget] = useState(row.target || "");
  const [busy, setBusy] = useState(false);
  async function simpan() {
    setBusy(true);
    try { await updateFitur(row.id, { status, prioritas, modul, tanggapan, target, pic_nama: nama }); onChanged(); }
    catch { setBusy(false); }
  }
  async function hapus() {
    if (!confirm("Hapus usulan ini?")) return;
    setBusy(true);
    try { await deleteFitur(row.id); onChanged(); } catch { setBusy(false); }
  }
  return (
    <Modal title={row.no_tiket || `Usulan #${row.id}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-3">
          <button onClick={e => onVote(row, e)}
            className={`flex flex-col items-center justify-center rounded-lg border w-14 py-1.5 shrink-0 ${row.sudah_vote ? "bg-green-50 border-green-400 text-green-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
            <span className="text-lg leading-none">▲</span><span className="text-sm font-bold">{row.vote_count}</span>
          </button>
          <div>
            <div className="font-semibold text-slate-800">{row.judul}</div>
            <div className="text-xs text-slate-400">{row.modul} · <span className={`px-1.5 py-0.5 rounded ${badgeStatus[row.status] || ""}`}>{row.status}</span> · prioritas {row.prioritas}</div>
            <div className="text-xs text-slate-400 mt-0.5">{row.pengusul} {row.unit && `(${row.unit})`} · {row.tanggal}</div>
          </div>
        </div>
        {row.deskripsi && <div className="text-slate-600 whitespace-pre-wrap bg-slate-50 rounded p-3">{row.deskripsi}</div>}
        {row.manfaat && <div className="text-slate-600"><span className="text-slate-400">Manfaat:</span> {row.manfaat}</div>}
        {row.foto && (
          <div className="flex gap-2 flex-wrap">
            {row.foto.split(",").filter(Boolean).map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="w-24 h-24 object-cover rounded-lg border border-slate-200" /></a>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <button onClick={() => cetakUsulan(row)} className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">🖨️ Cetak</button>
        </div>

        {isKelola ? (
          <div className="border-t border-slate-200 pt-3 space-y-3">
            <div className="text-xs font-semibold text-slate-500">TINDAK LANJUT PENGELOLA</div>
            <div className="grid grid-cols-3 gap-2">
              <select value={status} onChange={e => setStatus(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
                {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={prioritas} onChange={e => setPrioritas(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
                {PRIORITAS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={modul} onChange={e => setModul(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
                {MODUL.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Target / estimasi (mis. Q3 2026)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <textarea value={tanggapan} onChange={e => setTanggapan(e.target.value)} rows={3} placeholder="Tanggapan / catatan pengembang…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <div className="flex justify-between">
              <button onClick={hapus} disabled={busy} className="px-3 py-2 text-sm rounded-lg text-red-600 hover:bg-red-50">Hapus</button>
              <button onClick={simpan} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                {busy ? "Menyimpan…" : "Simpan Tindak Lanjut"}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-slate-200 pt-3 space-y-1">
            <div><span className="text-slate-400">Status:</span> <span className={`px-2 py-0.5 rounded text-xs ${badgeStatus[row.status] || ""}`}>{row.status}</span></div>
            {row.target && <div><span className="text-slate-400">Target:</span> {row.target}</div>}
            {row.tanggapan && <div><span className="text-slate-400">Tanggapan:</span> {row.tanggapan}</div>}
            {row.pic_nama && <div><span className="text-slate-400">Ditangani:</span> {row.pic_nama}</div>}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ImportFiturModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState(""); const [modul, setModul] = useState("lainnya");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState<WaParsed[] | null>(null);
  function onFile(e: React.ChangeEvent<HTMLInputElement>) { const fl = e.target.files?.[0]; if (fl) fl.text().then(setText); }
  async function run(apply: boolean) {
    if (!text.trim()) { setMsg("Tempel teks / pilih file .txt dulu."); return; }
    setBusy(true); setMsg("");
    try {
      const r = await importWaFitur(text, apply, modul);
      if (apply) { setMsg(`Impor selesai — ${r.data.baru} baru, ${r.data.dilewati_duplikat} dilewati.`); onDone(); }
      else { setPreview(r.data.contoh || []); setMsg(`${r.data.terdeteksi} pesan terdeteksi. Klik Impor & Simpan.`); }
    } catch { setMsg("Gagal memproses (hanya pengelola)."); } finally { setBusy(false); }
  }
  return (
    <Modal title="Impor Usulan dari WhatsApp" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="text-xs text-slate-500">Ekspor chat grup WA (⋮ → Export chat → Without media), lalu pilih file .txt atau tempel isinya. Tiap pesan jadi 1 usulan.</div>
        {msg && <div className="rounded px-3 py-2 bg-slate-50 text-slate-600">{msg}</div>}
        <div className="flex gap-2 items-center">
          <input type="file" accept=".txt,text/plain" onChange={onFile} className="text-sm flex-1" />
          <select value={modul} onChange={e => setModul(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
            {MODUL.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="…atau tempel isi ekspor chat"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono" />
        <div className="flex gap-2">
          <button onClick={() => run(false)} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 disabled:opacity-50">Pratinjau</button>
          <button onClick={() => run(true)} disabled={busy || !preview} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50">Impor & Simpan</button>
        </div>
        {preview && preview.length > 0 && (
          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg text-xs">
            {preview.map((m, i) => <div key={i} className="px-2 py-1 border-b border-slate-100"><b>{m.pelapor}</b> · {m.tanggal?.slice(0, 16)}<br />{m.deskripsi}</div>)}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Cetak ────────────────────────────────────────────────────────────────────
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
    <style>body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12px}
      h2{margin:0 0 2px;font-size:16px} table{border-collapse:collapse;width:100%;margin-top:8px}
      th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top;font-size:11px}
      th{background:#f0f0f0} .muted{color:#555} img{max-width:180px;max-height:180px;margin:4px;border:1px solid #ccc}
      @media print{.noprint{display:none}}</style></head><body>${KOP}${inner}
    <div class="noprint" style="margin-top:16px;text-align:center"><button onclick="window.print()" style="padding:8px 20px">🖨️ Cetak</button></div>
    <script>setTimeout(function(){window.print()},400)<\/script></body></html>`);
  w.document.close();
}
function cetakUsulan(r: PermintaanFitur) {
  const foto = r.foto ? `<div>${r.foto.split(",").filter(Boolean).map(u => `<img src="${esc(u)}">`).join("")}</div>` : "";
  printHtml(`Usulan ${r.no_tiket || r.id}`, `
    <h2>USULAN PENGEMBANGAN FITUR SIMRS</h2>
    <div class="muted">No: <b>${esc(r.no_tiket || String(r.id))}</b> &middot; Dukungan: <b>${r.vote_count}</b></div>
    <table>
      <tr><th style="width:150px">Tanggal</th><td>${esc(r.tanggal)}</td></tr>
      <tr><th>Pengusul</th><td>${esc(r.pengusul)} ${r.unit ? "(" + esc(r.unit) + ")" : ""}</td></tr>
      <tr><th>Modul</th><td>${esc(r.modul)}</td></tr>
      <tr><th>Prioritas</th><td>${esc(r.prioritas)}</td></tr>
      <tr><th>Status</th><td>${esc(r.status)}</td></tr>
      <tr><th>Judul Fitur</th><td><b>${esc(r.judul)}</b></td></tr>
      <tr><th>Deskripsi</th><td>${esc(r.deskripsi).replace(/\n/g, "<br>")}</td></tr>
      <tr><th>Manfaat</th><td>${esc(r.manfaat).replace(/\n/g, "<br>") || "-"}</td></tr>
      <tr><th>Target/Estimasi</th><td>${esc(r.target) || "-"}</td></tr>
      <tr><th>Tanggapan</th><td>${esc(r.tanggapan).replace(/\n/g, "<br>") || "-"}</td></tr>
    </table>${foto}
    <div style="margin-top:40px;display:flex;justify-content:space-around;text-align:center">
      <div>Pengusul<br><br><br>( ${esc(r.pengusul) || "..............."} )</div>
      <div>Pengelola SIMRS<br><br><br>( ${esc(r.pic_nama) || "..............."} )</div>
    </div>`);
}
function cetakDaftar(rows: PermintaanFitur[], rekap: FiturRekap | null, tahun: number) {
  const body = rows.map((r, i) => `<tr>
    <td>${i + 1}</td><td>${esc(r.no_tiket || String(r.id))}</td><td style="text-align:center">${r.vote_count}</td>
    <td>${esc(r.judul)}</td><td>${esc(r.modul)}</td><td>${esc(r.pengusul)}<br><span class="muted">${esc(r.unit)}</span></td>
    <td>${esc(r.prioritas)}</td><td>${esc(r.status)}</td><td>${esc(r.tanggapan)}</td></tr>`).join("");
  printHtml(`Daftar Usulan Fitur ${tahun}`, `
    <h2>DAFTAR USULAN PENGEMBANGAN FITUR SIMRS — ${tahun}</h2>
    <div class="muted">Total: ${rekap?.ringkasan.total ?? rows.length} &middot; ditampilkan: ${rows.length}</div>
    <table><thead><tr><th>No</th><th>No. Usulan</th><th>Dukungan</th><th>Judul Fitur</th><th>Modul</th><th>Pengusul</th><th>Prioritas</th><th>Status</th><th>Tanggapan</th></tr></thead>
    <tbody>${body || '<tr><td colspan="9" style="text-align:center">Tidak ada data</td></tr>'}</tbody></table>
    <div style="margin-top:36px;text-align:right">Cabangbungin, ................................<br><br><br>Pengelola SIMRS<br><br><br>( ............................... )</div>`);
}
