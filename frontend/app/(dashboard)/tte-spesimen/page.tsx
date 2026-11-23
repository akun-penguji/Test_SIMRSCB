"use client";

// Master spesimen TTE — gambar tanda tangan pejabat, stempel RS, dan logo yang
// dipasang di tengah QR.
//
// Halaman ini terpisah dari alur penandatanganan karena isinya aset paling
// sensitif di seluruh modul: gambar tanda tangan tidak bisa dirotasi kalau
// bocor, tidak seperti passphrase. Gambar disimpan terenkripsi di database,
// bukan sebagai berkas, dan tidak pernah ikut dalam daftar — hanya ditarik
// satu per satu saat pratinjau.

import { useEffect, useState, useCallback } from "react";
import {
  getTteSpesimen, simpanTteSpesimen, delTteSpesimen, tteSpesimenGambarUrl,
  TteSpesimen,
} from "@/lib/api";

const JENIS: { v: "ttd" | "stempel" | "logo"; label: string; info: string }[] = [
  { v: "ttd", label: "Tanda Tangan", info: "Dipakai saat metode 'tempel', atau metode BSrE bergaya gambar." },
  { v: "stempel", label: "Stempel RS", info: "Ditempel di posisi penanda ${stempel}." },
  { v: "logo", label: "Logo QR", info: "Dipasang di tengah QR verifikasi, seperti tampilan di aplikasi desktop." },
];

const hariIni = () => new Date().toISOString().slice(0, 10);

type Form = {
  jenis: "ttd" | "stempel" | "logo";
  nik: string; nama: string; jabatan: string;
  mulai: string; selesai: string; tinggi_mm: number;
  file: File | null; previewUrl: string;
};
const KOSONG: Form = {
  jenis: "ttd", nik: "", nama: "", jabatan: "",
  mulai: hariIni(), selesai: "", tinggi_mm: 16, file: null, previewUrl: "",
};

export default function TteSpesimenPage() {
  const [rows, setRows] = useState<TteSpesimen[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [lihat, setLihat] = useState<TteSpesimen | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getTteSpesimen().then(r => setRows(r.data))
      .catch(() => setMsg({ ok: false, t: "Gagal memuat (halaman ini hanya untuk admin)." }))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  function pilihBerkas(f: File | null) {
    if (!f) return;
    // Validasi tipe dilakukan juga di server; di sini supaya salahnya ketahuan
    // sebelum berkas dikirim.
    if (!f.type.includes("png")) {
      setMsg({ ok: false, t: "Harus PNG. JPG tidak punya kanal transparansi — tanda tangan akan tercetak sebagai kotak putih yang menutupi teks di bawahnya." });
      return;
    }
    setMsg(null);
    setForm(s => s && ({ ...s, file: f, previewUrl: URL.createObjectURL(f) }));
  }

  async function simpan() {
    if (!form) return;
    if (!form.file) { setMsg({ ok: false, t: "Pilih berkas PNG dulu." }); return; }
    if (form.jenis === "ttd" && !/^\d{16}$/.test(form.nik)) {
      setMsg({ ok: false, t: "NIK wajib 16 digit untuk spesimen tanda tangan (dipakai BSrE)." });
      return;
    }
    setSaving(true); setMsg(null);
    try {
      await simpanTteSpesimen({
        jenis: form.jenis, nik: form.nik, nama: form.nama, jabatan: form.jabatan,
        mulai: form.mulai, selesai: form.selesai || undefined,
        tinggi_mm: form.tinggi_mm, file: form.file,
      });
      setMsg({ ok: true, t: "Spesimen tersimpan (terenkripsi)." });
      setForm(null); load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ ok: false, t: err.response?.data?.error || "Gagal menyimpan." });
    } finally { setSaving(false); }
  }

  async function hapus(r: TteSpesimen) {
    if (!confirm(`Hapus spesimen ${JENIS.find(j => j.v === r.jenis)?.label} ${r.pejabat_nama || ""}?`)) return;
    try { await delTteSpesimen(r.id); setMsg({ ok: true, t: "Terhapus." }); load(); }
    catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ ok: false, t: err.response?.data?.error || "Gagal menghapus." });
    }
  }

  const aktif = (r: TteSpesimen) => {
    const h = hariIni();
    return r.mulai <= h && (!r.selesai || r.selesai >= h);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Master Spesimen TTE</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tanda tangan pejabat, stempel RS, dan logo QR. Gambar disimpan terenkripsi di database.
          </p>
        </div>
        <button onClick={() => { setForm({ ...KOSONG }); setMsg(null); }}
          className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg">
          + Spesimen Baru
        </button>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          {msg.t}
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-4">
        <b>Gambar tanda tangan tidak bisa diganti kalau bocor</b>, tidak seperti passphrase.
        Karena itu spesimen disimpan terenkripsi dengan kunci tersendiri dan dibatasi
        masa berlakunya. Saat pejabat berganti, isi <i>tanggal selesai</i> pada spesimen
        lama — jangan dihapus, karena dokumen yang sudah ditandatangani masih menunjuk padanya.
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm py-10 text-center">Memuat…</div>
      ) : rows.length === 0 ? (
        <div className="text-slate-400 text-sm py-10 text-center border border-dashed rounded-xl">
          Belum ada spesimen. Tambahkan minimal satu tanda tangan sebelum menandatangani dokumen.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Jenis</th>
                <th className="text-left px-3 py-2 font-semibold">Pejabat</th>
                <th className="text-left px-3 py-2 font-semibold">Berlaku</th>
                <th className="text-left px-3 py-2 font-semibold">Ukuran</th>
                <th className="text-right px-3 py-2 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                      {JENIS.find(j => j.v === r.jenis)?.label ?? r.jenis}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{r.pejabat_nama || "—"}</div>
                    <div className="text-xs text-slate-500">{r.jabatan}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-slate-700">{r.mulai} → {r.selesai || "sekarang"}</div>
                    <span className={`text-xs font-semibold ${aktif(r) ? "text-emerald-600" : "text-slate-400"}`}>
                      {aktif(r) ? "aktif" : "tidak berlaku"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-xs">
                    {r.lebar_px}×{r.tinggi_px} px · cetak {r.tinggi_mm} mm
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => setLihat(r)} className="text-sky-600 hover:underline text-xs mr-3">Pratinjau</button>
                    <button onClick={() => hapus(r)} className="text-rose-600 hover:underline text-xs">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pratinjau — latar kotak-kotak supaya transparansi benar-benar terlihat */}
      {lihat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setLihat(null)}>
          <div className="bg-white rounded-xl p-4 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 mb-1">
              {JENIS.find(j => j.v === lihat.jenis)?.label} — {lihat.pejabat_nama || "—"}
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Latar kotak-kotak di bawah ini bukan bagian gambar. Kalau ada area putih padat,
              berarti PNG-nya tidak benar-benar transparan.
            </p>
            <div className="rounded-lg border p-4 flex items-center justify-center min-h-[160px]"
              style={{
                backgroundImage:
                  "linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0,0 8px,8px -8px,-8px 0px",
              }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tteSpesimenGambarUrl(lihat.id)} alt="spesimen" className="max-h-48 object-contain" />
            </div>
            <button onClick={() => setLihat(null)}
              className="mt-4 w-full px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg">
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Form tambah */}
      {form && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-5 max-w-xl w-full my-8">
            <h3 className="font-bold text-slate-800 mb-4">Spesimen Baru</h3>

            <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis</label>
            <div className="grid grid-cols-3 gap-2 mb-1">
              {JENIS.map(j => (
                <button key={j.v} type="button"
                  onClick={() => setForm(s => s && ({ ...s, jenis: j.v, tinggi_mm: j.v === "stempel" ? 22 : j.v === "logo" ? 10 : 16 }))}
                  className={`px-3 py-2 text-sm rounded-lg border ${form.jenis === j.v ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}>
                  {j.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mb-4">{JENIS.find(j => j.v === form.jenis)?.info}</p>

            {form.jenis === "ttd" && (
              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  NIK penandatangan (16 digit) <span className="text-rose-500">*</span>
                </label>
                <input value={form.nik} inputMode="numeric" maxLength={16}
                  onChange={e => setForm(s => s && ({ ...s, nik: e.target.value.replace(/\D/g, "") }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="NIK yang terdaftar di BSrE" />
                <p className="text-xs text-slate-500 mt-1">
                  Harus NIK yang sama dengan yang terdaftar sertifikatnya di BSrE.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama pejabat</label>
                <input value={form.nama} onChange={e => setForm(s => s && ({ ...s, nama: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="dr. ... , M.Kes" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jabatan</label>
                <input value={form.jabatan} onChange={e => setForm(s => s && ({ ...s, jabatan: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Direktur RSUD Cabang Bungin" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Mulai berlaku</label>
                <input type="date" value={form.mulai}
                  onChange={e => setForm(s => s && ({ ...s, mulai: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Selesai (opsional)</label>
                <input type="date" value={form.selesai}
                  onChange={e => setForm(s => s && ({ ...s, selesai: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tinggi cetak (mm)</label>
                <input type="number" min={5} max={60} value={form.tinggi_mm}
                  onChange={e => setForm(s => s && ({ ...s, tinggi_mm: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>

            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Berkas PNG transparan <span className="text-rose-500">*</span>
            </label>
            <input type="file" accept="image/png"
              onChange={e => pilihBerkas(e.target.files?.[0] ?? null)}
              className="w-full text-sm mb-2" />
            {form.previewUrl && (
              <div className="rounded-lg border p-3 flex items-center justify-center mb-3"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)",
                  backgroundSize: "16px 16px",
                  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0px",
                }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.previewUrl} alt="pratinjau" className="max-h-40 object-contain" />
              </div>
            )}

            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setForm(null)}
                className="px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg">
                Batal
              </button>
              <button onClick={simpan} disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50">
                {saving ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
