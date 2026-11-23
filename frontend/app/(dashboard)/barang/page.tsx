"use client";

// Master Data Barang (databarang) — port DlgBarang.java (tanpa harga & barcode).
// List + cari + filter jenis/status + tambah/edit + nonaktif.

import { useCallback, useEffect, useState } from "react";
import {
  listBarang, getBarang, barangMasters, simpanBarang, hapusBarang,
  BarangRow, BarangMasters, BarangInput,
} from "@/lib/api";

const EMPTY: BarangInput = {
  kode_brng: "", is_new: true, nama_brng: "", kode_satbesar: "", kode_sat: "",
  letak_barang: "", stokminimal: 0, kdjns: "", isi: 1, kapasitas: 1,
  kode_industri: "", kode_kategori: "", kode_golongan: "",
};

export default function BarangPage() {
  const [q, setQ] = useState("");
  const [jenis, setJenis] = useState("");
  const [status, setStatus] = useState("1");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<BarangRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [masters, setMasters] = useState<BarangMasters | null>(null);
  const [form, setForm] = useState<BarangInput | null>(null);
  const [saving, setSaving] = useState(false);
  const limit = 50;

  useEffect(() => { barangMasters().then(r => setMasters(r.data)).catch(() => setMasters(null)); }, []);
  const muat = useCallback((p = page) => {
    setLoading(true);
    listBarang({ q, jenis, status, page: p, limit })
      .then(r => { setRows(r.data.data); setTotal(r.data.total); setPage(r.data.page); })
      .catch(() => { setRows([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [q, jenis, status, page]);
  useEffect(() => { muat(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const cari = () => { setPage(1); muat(1); };
  const set = (k: keyof BarangInput, v: unknown) => setForm(f => f ? { ...f, [k]: v } : f);

  async function buka(r?: BarangRow) {
    if (!r) { setForm({ ...EMPTY }); return; }
    try {
      const d = await getBarang(r.kode_brng);
      const b = d.data;
      setForm({
        kode_brng: b.kode_brng, is_new: false, nama_brng: b.nama_brng, kode_satbesar: b.kode_satbesar,
        kode_sat: b.kode_sat, letak_barang: b.letak_barang, stokminimal: b.stokminimal, kdjns: b.kdjns,
        isi: b.isi, kapasitas: b.kapasitas, kode_industri: b.kode_industri, kode_kategori: b.kode_kategori, kode_golongan: b.kode_golongan,
      });
    } catch { alert("Gagal memuat detail barang"); }
  }
  async function simpan() {
    if (!form) return;
    if (!form.kode_brng.trim() || !form.nama_brng.trim() || !form.kode_satbesar) { alert("Kode, Nama, dan Satuan Besar wajib diisi"); return; }
    setSaving(true);
    try { await simpanBarang(form); setForm(null); muat(); }
    catch (e) { const ex = e as { response?: { data?: { error?: string } } }; alert(ex.response?.data?.error ?? "Gagal menyimpan"); }
    finally { setSaving(false); }
  }
  async function nonaktif(r: BarangRow) {
    if (!window.confirm(`Nonaktifkan barang "${r.nama_brng}"?`)) return;
    try { await hapusBarang(r.kode_brng); muat(); } catch { alert("Gagal menonaktifkan"); }
  }

  const inp = "border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm";
  const th = "px-2 py-2 text-xs font-bold text-slate-600 border-b border-slate-200 text-left whitespace-nowrap";
  const td = "px-2 py-1.5 text-sm border-b border-slate-100";
  const totPage = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-800">📦 Master Data Barang</h1>
          <p className="text-xs text-slate-500">Obat / BHP / Alkes (databarang). Harga & barcode dikelola di aplikasi Khanza.</p>
        </div>
        <button onClick={() => buka()} className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg px-4 py-2 shrink-0">+ Barang Baru</button>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <label className="flex flex-col gap-1 flex-1 min-w-[180px]"><span className="text-[11px] font-semibold text-slate-500">Cari (kode / nama)</span>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && cari()} className={inp} placeholder="ketik lalu Enter…" /></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Jenis</span>
          <select value={jenis} onChange={e => setJenis(e.target.value)} className={inp}>
            <option value="">Semua</option>
            {masters?.jenis.map(j => <option key={j.kode} value={j.kode}>{j.nama}</option>)}
          </select></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Status</span>
          <select value={status} onChange={e => setStatus(e.target.value)} className={inp}>
            <option value="1">Aktif</option><option value="0">Non-aktif</option><option value="">Semua</option>
          </select></label>
        <button onClick={cari} className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Cari</button>
        <div className="ml-auto text-sm text-slate-500 self-center tabular-nums">{total} barang</div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50"><tr>
            <th className={th}>Kode</th><th className={th}>Nama Barang</th><th className={th}>Jenis</th>
            <th className={th}>Satuan</th><th className={th}>Letak</th>
            <th className={`${th} text-center`}>Stok Min</th><th className={`${th} text-center`}>Stok</th>
            <th className={`${th} text-center`}>Status</th><th className={`${th} text-center`}>Aksi</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center text-slate-400 text-sm py-8">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-slate-400 text-sm py-8">Tidak ada barang.</td></tr>
            ) : rows.map(r => (
              <tr key={r.kode_brng} className="hover:bg-slate-50/60">
                <td className={`${td} text-xs text-slate-500 whitespace-nowrap`}>{r.kode_brng}</td>
                <td className={td}>{r.nama_brng}{r.kategori && <div className="text-[10px] text-slate-400">{r.kategori}{r.golongan ? ` · ${r.golongan}` : ""}</div>}</td>
                <td className={`${td} text-xs text-slate-500`}>{r.jenis}</td>
                <td className={`${td} text-xs`}>{r.satuan || r.satbesar}</td>
                <td className={`${td} text-xs text-slate-500`}>{r.letak_barang}</td>
                <td className={`${td} text-center tabular-nums`}>{r.stokminimal}</td>
                <td className={`${td} text-center tabular-nums ${r.stok < r.stokminimal && r.stokminimal > 0 ? "text-red-600 font-semibold" : ""}`}>{r.stok}</td>
                <td className={`${td} text-center`}>{r.status === "1" ? <span className="text-emerald-600 text-xs">Aktif</span> : <span className="text-slate-400 text-xs">Non</span>}</td>
                <td className={`${td} text-center whitespace-nowrap`}>
                  <button onClick={() => buka(r)} className="text-teal-600 hover:text-teal-800 text-xs font-semibold">Edit</button>
                  {r.status === "1" && <button onClick={() => nonaktif(r)} className="text-red-500 hover:text-red-700 text-xs font-semibold ml-2">Nonaktif</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => muat(page - 1)} className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40">‹ Sebelumnya</button>
          <span className="text-slate-500 tabular-nums">Hal {page} / {totPage}</span>
          <button disabled={page >= totPage} onClick={() => muat(page + 1)} className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40">Berikutnya ›</button>
        </div>
      )}

      {/* Form modal */}
      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 className="font-bold text-slate-800">{form.is_new ? "Barang Baru" : `Edit — ${form.kode_brng}`}</h2>
              <button onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <L label="Kode Barang">
                <input value={form.kode_brng} onChange={e => set("kode_brng", e.target.value)} disabled={!form.is_new}
                  className={inp + " w-full disabled:bg-slate-100"} />
              </L>
              <L label="Nama Barang"><input value={form.nama_brng} onChange={e => set("nama_brng", e.target.value)} className={inp + " w-full"} /></L>
              <L label="Satuan Besar"><SatuanSel v={form.kode_satbesar} onCh={v => set("kode_satbesar", v)} masters={masters} /></L>
              <L label="Satuan Kecil"><SatuanSel v={form.kode_sat} onCh={v => set("kode_sat", v)} masters={masters} allowEmpty /></L>
              <L label="Isi (per satuan besar)"><input type="number" value={form.isi} onChange={e => set("isi", Number(e.target.value))} className={inp + " w-full"} /></L>
              <L label="Kapasitas"><input type="number" value={form.kapasitas} onChange={e => set("kapasitas", Number(e.target.value))} className={inp + " w-full"} /></L>
              <L label="Jenis"><Sel v={form.kdjns} onCh={v => set("kdjns", v)} opts={masters?.jenis} /></L>
              <L label="Kategori"><Sel v={form.kode_kategori} onCh={v => set("kode_kategori", v)} opts={masters?.kategori} /></L>
              <L label="Golongan"><Sel v={form.kode_golongan} onCh={v => set("kode_golongan", v)} opts={masters?.golongan} /></L>
              <L label="Industri / Pabrik"><Sel v={form.kode_industri} onCh={v => set("kode_industri", v)} opts={masters?.industri} /></L>
              <L label="Letak Barang"><input value={form.letak_barang} onChange={e => set("letak_barang", e.target.value)} className={inp + " w-full"} /></L>
              <L label="Stok Minimal"><input type="number" value={form.stokminimal} onChange={e => set("stokminimal", Number(e.target.value))} className={inp + " w-full"} /></L>
            </div>
            <div className="px-4 pb-2 text-[11px] text-slate-400">Harga & barcode tidak diubah dari sini (dikelola di Khanza). Pada barang baru, semua harga diset 0.</div>
            <div className="flex gap-2 px-4 py-3 border-t border-slate-200">
              <button onClick={simpan} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">{saving ? "Menyimpan…" : "Simpan"}</button>
              <button onClick={() => setForm(null)} className="px-4 bg-white border border-slate-300 text-slate-600 text-sm font-semibold rounded-lg py-2">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">{label}</span>{children}</label>;
}
function Sel({ v, onCh, opts }: { v: string; onCh: (v: string) => void; opts?: { kode: string; nama: string }[] }) {
  return (
    <select value={v} onChange={e => onCh(e.target.value)} className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm w-full">
      <option value="">— pilih —</option>
      {opts?.map(o => <option key={o.kode} value={o.kode}>{o.nama}</option>)}
    </select>
  );
}
function SatuanSel({ v, onCh, masters, allowEmpty }: { v: string; onCh: (v: string) => void; masters: BarangMasters | null; allowEmpty?: boolean }) {
  return (
    <select value={v} onChange={e => onCh(e.target.value)} className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm w-full">
      <option value="">{allowEmpty ? "— (opsional) —" : "— pilih —"}</option>
      {masters?.satuan.map(o => <option key={o.kode} value={o.kode}>{o.nama}</option>)}
    </select>
  );
}
