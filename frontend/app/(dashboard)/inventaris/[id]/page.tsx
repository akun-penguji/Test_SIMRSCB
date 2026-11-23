"use client";

// Detail aset + riwayat transaksi (Kalibrasi/Maintenance/Inspeksi/Mutasi/Complain).

import { useEffect, useState, useCallback } from "react";
import InventarisNav from "@/app/(dashboard)/inventaris/InventarisNav";
import { useParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  getInventarisDetail, getInvTransaksi, saveInvTransaksi, delInvTransaksi,
  Inventaris, InvTransaksi,
} from "@/lib/api";

const JENIS = ["Kalibrasi", "Maintenance", "Inspeksi", "Mutasi", "Complain"];
const HASIL: Record<string, string[]> = {
  Kalibrasi: ["Laik", "Tidak Laik"],
  Maintenance: ["Selesai", "Perlu Sparepart", "Dalam Proses"],
  Inspeksi: ["Baik", "Perlu Perbaikan", "Rusak"],
  Mutasi: ["Selesai"],
  Complain: ["Baru", "Dalam Proses", "Selesai", "Tidak Dapat Diperbaiki"],
};
const badgeJenis: Record<string, string> = {
  Kalibrasi: "bg-amber-100 text-amber-700", Maintenance: "bg-blue-100 text-blue-700",
  Inspeksi: "bg-indigo-100 text-indigo-700", Mutasi: "bg-purple-100 text-purple-700",
  Complain: "bg-rose-100 text-rose-700",
};
const fmtRp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));

const emptyTx = (id: number): Partial<InvTransaksi> => ({
  inventaris_id: id, jenis: "Kalibrasi", tanggal: new Date().toISOString().slice(0, 10),
  tanggal_berikut: null, hasil: "Laik", keterangan: "", ruangan_asal: "", ruangan_tujuan: "",
  biaya: 0, vendor: "", petugas: "",
});

export default function DetailAsetPage() {
  const params = useParams();
  const id = Number(params.id);
  const [aset, setAset] = useState<Inventaris | null>(null);
  const [tx, setTx] = useState<InvTransaksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<InvTransaksi> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const loadTx = useCallback(() => {
    getInvTransaksi(id).then(r => setTx(r.data)).catch(() => {});
  }, [id]);

  useEffect(() => {
    setLoading(true);
    getInventarisDetail(id).then(r => setAset(r.data)).catch(() => {}).finally(() => setLoading(false));
    loadTx();
  }, [id, loadTx]);

  async function simpan() {
    if (!edit) return;
    setSaving(true); setMsg(null);
    try {
      await saveInvTransaksi(edit);
      setMsg({ ok: true, t: "Riwayat tersimpan." });
      setEdit(null); loadTx();
      getInventarisDetail(id).then(r => setAset(r.data)).catch(() => {});
    } catch { setMsg({ ok: false, t: "Gagal menyimpan (hanya admin)." }); }
    finally { setSaving(false); }
  }
  async function hapus(t: InvTransaksi) {
    if (!confirm(`Hapus riwayat ${t.jenis} ${t.tanggal ?? ""}?`)) return;
    try { await delInvTransaksi(t.id); loadTx(); }
    catch { setMsg({ ok: false, t: "Gagal hapus (hanya admin)." }); }
  }

  if (loading) return <div className="p-6 text-slate-400">Memuat…</div>;
  if (!aset) return <div className="p-6 text-slate-400">Aset tidak ditemukan. <Link href="/inventaris" className="text-green-700 underline">Kembali</Link></div>;

  return (
    <div className="p-6 space-y-5">
      <InventarisNav />

      {/* Info aset */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex gap-5 flex-wrap">
        {aset.foto ? (
          <a href={aset.foto} target="_blank" rel="noreferrer">
            <img src={aset.foto} alt={aset.nama_alat} className="w-40 h-40 object-cover rounded-xl border border-slate-200" />
          </a>
        ) : (
          <div className="w-40 h-40 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300">Tidak ada foto</div>
        )}
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800">{aset.nama_alat}</h1>
            <span className={`text-xs font-semibold rounded px-2 py-0.5 ${aset.status_laik === "Laik" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{aset.status_laik || "-"}</span>
            {aset.wajib_kalibrasi === 1 && <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 bg-amber-100 text-amber-700">Wajib Kalibrasi</span>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 mt-3 text-sm">
            <Info k="Barcode" v={aset.barcode} mono />
            <Info k="No. Label" v={aset.no_label} mono />
            <Info k="Nomor Seri" v={aset.no_seri} mono />
            <Info k="Merk / Model" v={[aset.merk, aset.model].filter(x => x && x !== "-").join(" · ")} />
            <Info k="Kategori" v={aset.kategori} />
            <Info k="Ruangan" v={aset.ruangan} />
            <Info k="Gedung" v={aset.gedung} />
            <Info k="Vendor" v={aset.vendor} />
            <Info k="Tahun" v={aset.tahun} />
            <Info k="Kondisi" v={aset.kondisi} />
            {aset.nilai > 0 && <Info k="Nilai" v={fmtRp(aset.nilai)} />}
          </div>
        </div>
        {/* QR label */}
        <div className="flex flex-col items-center gap-1 border-l border-slate-100 pl-5">
          <QRCodeSVG value={aset.barcode || aset.no_label || String(aset.id)} size={96} level="M" />
          <span className="text-[10px] font-mono text-slate-500">{aset.barcode || aset.no_label || aset.id}</span>
          <Link href="/inventaris/qr" className="text-xs text-green-700 hover:underline">Cetak Label</Link>
        </div>
      </div>

      {msg && <div className={`text-sm px-4 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.t}</div>}

      {/* Riwayat */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-800">Riwayat ({tx.length})</h2>
        <button onClick={() => { setEdit(emptyTx(id)); setMsg(null); }}
          className="px-3 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg">+ Tambah Riwayat</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5 text-left">Jenis</th>
                <th className="px-3 py-2.5 text-left">Tanggal</th>
                <th className="px-3 py-2.5 text-left">Berikutnya</th>
                <th className="px-3 py-2.5 text-left">Hasil</th>
                <th className="px-3 py-2.5 text-left">Keterangan</th>
                <th className="px-3 py-2.5 text-right">Biaya</th>
                <th className="px-3 py-2.5 text-left">Vendor/Petugas</th>
                <th className="px-3 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tx.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400">Belum ada riwayat.</td></tr>
              ) : tx.map(t => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2"><span className={`text-xs font-semibold rounded px-2 py-0.5 ${badgeJenis[t.jenis] ?? "bg-slate-100 text-slate-600"}`}>{t.jenis}</span></td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{t.tanggal ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{t.tanggal_berikut ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{t.hasil || "-"}{t.jenis === "Mutasi" && t.ruangan_tujuan ? ` → ${t.ruangan_tujuan}` : ""}</td>
                  <td className="px-3 py-2 text-slate-600 max-w-[240px]">{t.keterangan || "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{t.biaya > 0 ? fmtRp(t.biaya) : "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{[t.vendor, t.petugas].filter(Boolean).join(" / ") || "-"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => { setEdit({ ...t }); setMsg(null); }} className="text-xs text-green-700 hover:underline mr-3">Edit</button>
                    <button onClick={() => hapus(t)} className="text-xs text-rose-600 hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal transaksi */}
      {edit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">{edit.id ? "Edit Riwayat" : "Tambah Riwayat"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SelF label="Jenis" v={edit.jenis} on={v => setEdit({ ...edit, jenis: v, hasil: (HASIL[v] ?? [""])[0] })} opts={JENIS} />
              <SelF label="Hasil / Status" v={edit.hasil} on={v => setEdit({ ...edit, hasil: v })} opts={HASIL[edit.jenis ?? "Kalibrasi"] ?? [""]} />
              <Fld label="Tanggal" type="date" v={edit.tanggal ?? ""} on={v => setEdit({ ...edit, tanggal: v })} />
              {(edit.jenis === "Kalibrasi" || edit.jenis === "Maintenance") &&
                <Fld label="Jadwal Berikutnya" type="date" v={edit.tanggal_berikut ?? ""} on={v => setEdit({ ...edit, tanggal_berikut: v })} />}
              {edit.jenis === "Mutasi" && <>
                <Fld label="Ruangan Asal" v={edit.ruangan_asal} on={v => setEdit({ ...edit, ruangan_asal: v })} />
                <Fld label="Ruangan Tujuan" v={edit.ruangan_tujuan} on={v => setEdit({ ...edit, ruangan_tujuan: v })} />
              </>}
              <Fld label="Biaya (Rp)" type="number" v={String(edit.biaya ?? 0)} on={v => setEdit({ ...edit, biaya: Number(v) || 0 })} />
              <Fld label="Vendor" v={edit.vendor} on={v => setEdit({ ...edit, vendor: v })} />
              <Fld label="Petugas" v={edit.petugas} on={v => setEdit({ ...edit, petugas: v })} />
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-slate-600 block mb-1">Keterangan</label>
                <textarea value={edit.keterangan ?? ""} onChange={e => setEdit({ ...edit, keterangan: e.target.value })} rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            {edit.jenis === "Mutasi" && <p className="text-xs text-slate-400 mt-2">Menyimpan mutasi akan memperbarui ruangan aset ke ruangan tujuan.</p>}
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setEdit(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg">Batal</button>
              <button onClick={simpan} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-50 rounded-lg">{saving ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ k, v, mono }: { k: string; v?: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wide text-slate-400 block">{k}</span>
      <span className={`text-slate-700 ${mono ? "font-mono text-xs" : ""}`}>{v && v !== "-" ? v : "—"}</span>
    </div>
  );
}
function Fld({ label, v, on, type = "text" }: { label: string; v?: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
      <input type={type} value={v ?? ""} onChange={e => on(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
    </div>
  );
}
function SelF({ label, v, on, opts }: { label: string; v?: string; on: (v: string) => void; opts: string[] }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
      <select value={v ?? ""} onChange={e => on(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
