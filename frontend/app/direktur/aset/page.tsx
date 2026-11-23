"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAset, saveAset, delAset, Aset } from "@/lib/api";

const rp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
const today = () => new Date().toISOString().slice(0, 10);

type FormState = {
  id?: number;
  nama: string;
  kategori: string;
  kondisi: string;
  nilai: number;
  perlu_kalibrasi: boolean;
  tgl_kalibrasi: string;
  tgl_kalibrasi_berikut: string;
  catatan: string;
};

const EMPTY: FormState = {
  nama: "", kategori: "", kondisi: "Baik", nilai: 0,
  perlu_kalibrasi: false, tgl_kalibrasi: "", tgl_kalibrasi_berikut: "", catatan: "",
};

const KONDISI = ["Baik", "Rusak Ringan", "Rusak Berat"];

function kondisiBadge(k: string) {
  if (k === "Baik") return "bg-green-100 text-green-700";
  if (k.startsWith("Rusak Ringan")) return "bg-amber-100 text-amber-700";
  if (k.startsWith("Rusak")) return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
}

export default function AsetPage() {
  const [list, setList] = useState<Aset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function reload() {
    setLoading(true);
    try { const r = await getAset(); setList(r.data); }
    catch { /* diamkan */ }
    finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, []);

  function bukaTambah() {
    setForm(EMPTY); setShowForm(true); setMsg(null);
  }

  function bukaEdit(a: Aset) {
    setForm({
      id: a.id,
      nama: a.nama ?? "",
      kategori: a.kategori ?? "",
      kondisi: a.kondisi || "Baik",
      nilai: a.nilai ?? 0,
      perlu_kalibrasi: a.perlu_kalibrasi === 1,
      tgl_kalibrasi: a.tgl_kalibrasi ?? "",
      tgl_kalibrasi_berikut: a.tgl_kalibrasi_berikut ?? "",
      catatan: a.catatan ?? "",
    });
    setShowForm(true); setMsg(null);
  }

  const errText = (e: any) =>
    e?.response?.status === 403
      ? "Hanya admin yang bisa mengubah data"
      : "Gagal menyimpan data";

  async function simpan() {
    if (!form.nama.trim()) { setMsg({ ok: false, text: "Nama aset wajib diisi" }); return; }
    setSaving(true); setMsg(null);
    try {
      await saveAset({
        ...(form.id ? { id: form.id } : {}),
        nama: form.nama.trim(),
        kategori: form.kategori.trim(),
        kondisi: form.kondisi,
        nilai: Number(form.nilai) || 0,
        perlu_kalibrasi: form.perlu_kalibrasi ? 1 : 0,
        tgl_kalibrasi: form.tgl_kalibrasi || null,
        tgl_kalibrasi_berikut: form.tgl_kalibrasi_berikut || null,
        catatan: form.catatan.trim(),
      });
      setShowForm(false);
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally { setSaving(false); }
  }

  async function hapus(a: Aset) {
    if (!confirm(`Hapus aset "${a.nama}"?`)) return;
    setMsg(null);
    try { await delAset(a.id); await reload(); }
    catch (e) { setMsg({ ok: false, text: errText(e) }); }
  }

  // ── Ringkasan ────────────────────────────────────────────────
  const t = today();
  const total = list.length;
  const baik = list.filter(a => a.kondisi === "Baik").length;
  const rusak = list.filter(a => (a.kondisi || "").startsWith("Rusak")).length;
  const due = list.filter(a =>
    a.perlu_kalibrasi === 1 &&
    (!a.tgl_kalibrasi_berikut || a.tgl_kalibrasi_berikut <= t)
  ).length;
  const nilaiTotal = list.reduce((s, a) => s + (a.nilai || 0), 0);

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/direktur" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Aset &amp; Kalibrasi</h1>
          <p className="text-sm text-slate-500">Input manual aset rumah sakit &amp; jadwal kalibrasi alat medis.</p>
        </div>
      </div>

      {/* Kartu ringkasan */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">Total Aset</p>
          <p className="text-2xl font-bold text-slate-800 tabular-nums">{total}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">Kondisi Baik</p>
          <p className="text-2xl font-bold text-green-600 tabular-nums">{baik}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">Rusak</p>
          <p className="text-2xl font-bold text-amber-600 tabular-nums">{rusak}</p>
        </div>
        <div className={`rounded-2xl p-4 shadow-sm border ${due > 0 ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
          <p className={`text-xs ${due > 0 ? "text-red-600" : "text-slate-500"}`}>Kalibrasi Jatuh Tempo</p>
          <p className={`text-2xl font-bold tabular-nums ${due > 0 ? "text-red-600" : "text-slate-800"}`}>{due}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm col-span-2 md:col-span-1">
          <p className="text-xs text-slate-500">Total Nilai Aset</p>
          <p className="text-lg font-bold text-slate-800 tabular-nums">{rp(nilaiTotal)}</p>
        </div>
      </div>

      {/* Tombol tambah */}
      <div className="flex items-center justify-between">
        <button onClick={bukaTambah}
          className="px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-xl shadow-sm transition">
          + Tambah Aset
        </button>
      </div>

      {msg && !showForm && (
        <div className={`text-sm px-4 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">{form.id ? "Edit Aset" : "Tambah Aset"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Nama Aset</label>
              <input type="text" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Kategori</label>
              <input type="text" value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}
                placeholder="mis. Alat Medis, Kendaraan, Meubelair"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Kondisi</label>
              <select value={form.kondisi} onChange={e => setForm({ ...form, kondisi: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                {KONDISI.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Nilai (Rp)</label>
              <input type="number" value={form.nilai} onChange={e => setForm({ ...form, nilai: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 tabular-nums" />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={form.perlu_kalibrasi}
                  onChange={e => setForm({ ...form, perlu_kalibrasi: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500" />
                Perlu Kalibrasi
              </label>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tgl Kalibrasi Terakhir</label>
              <input type="date" value={form.tgl_kalibrasi} onChange={e => setForm({ ...form, tgl_kalibrasi: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tgl Kalibrasi Berikut</label>
              <input type="date" value={form.tgl_kalibrasi_berikut} onChange={e => setForm({ ...form, tgl_kalibrasi_berikut: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Catatan</label>
              <input type="text" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          {msg && (
            <div className={`text-sm px-4 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setMsg(null); }}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition">
              Batal
            </button>
            <button onClick={simpan} disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-50 rounded-xl shadow-sm transition">
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 font-medium">Kondisi</th>
                <th className="px-4 py-3 font-medium text-right">Nilai</th>
                <th className="px-4 py-3 font-medium">Kalibrasi Berikut</th>
                <th className="px-4 py-3 font-medium">Sisa Hari</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Memuat data...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Belum ada data aset.</td></tr>
              ) : list.map(a => {
                const s = a.sisa_hari_kalibrasi;
                let sisaBadge = "bg-slate-100 text-slate-500";
                let sisaText = "-";
                if (a.perlu_kalibrasi === 1 && s !== null && s !== undefined) {
                  if (s <= 0) { sisaBadge = "bg-red-100 text-red-700"; sisaText = "jatuh tempo"; }
                  else if (s <= 30) { sisaBadge = "bg-amber-100 text-amber-700"; sisaText = `${s} hari`; }
                  else { sisaBadge = "bg-slate-100 text-slate-600"; sisaText = `${s} hari`; }
                }
                return (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{a.nama}</td>
                    <td className="px-4 py-3 text-slate-600">{a.kategori || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${kondisiBadge(a.kondisi)}`}>
                        {a.kondisi || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{rp(a.nilai)}</td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums">{a.tgl_kalibrasi_berikut || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${sisaBadge}`}>
                        {sisaText}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => bukaEdit(a)}
                          className="px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50 rounded-lg transition">
                          Edit
                        </button>
                        <button onClick={() => hapus(a)}
                          className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition">
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
