"use client";

// Halaman verifikasi publik dokumen ber-TTE. Dibuka dari QR pada dokumen,
// tanpa login.
//
// Dua cara memeriksa, dan keduanya disediakan karena kekuatannya berbeda:
//   - QR hanya membuktikan bahwa dokumen bernomor itu pernah ditandatangani.
//   - Pencocokan sidik membuktikan bahwa berkas yang ada di tangan pemeriksa
//     PERSIS berkas tersebut — ini yang menutup celah dokumen asli diunduh
//     lalu diubah isinya sambil mempertahankan QR-nya.
//
// Sidik dihitung di peramban dengan Web Crypto, jadi dokumennya sendiri tidak
// pernah diunggah ke server.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { verifikasiTteSop, cocokkanTteSop, TteVerifikasi } from "@/lib/api";

function Hasil({ d }: { d: TteVerifikasi }) {
  const dicabut = d.status === "dicabut";
  const warna = d.valid
    ? "border-emerald-300 bg-emerald-50"
    : dicabut ? "border-amber-300 bg-amber-50" : "border-rose-300 bg-rose-50";
  const judul = d.valid ? "Dokumen Terverifikasi" : dicabut ? "Dokumen Sudah Dicabut" : "Tidak Ditemukan";
  const ikon = d.valid ? "✓" : dicabut ? "!" : "✕";
  const warnaIkon = d.valid ? "bg-emerald-600" : dicabut ? "bg-amber-500" : "bg-rose-600";

  return (
    <div className={`rounded-2xl border-2 ${warna} p-5 md:p-6`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full ${warnaIkon} text-white grid place-items-center text-xl font-bold`}>
          {ikon}
        </div>
        <h2 className="text-lg font-bold text-slate-800">{judul}</h2>
      </div>

      <p className="text-sm text-slate-700 mb-4">{d.pesan}</p>

      {d.nomor && (
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm mb-4">
          <dt className="text-slate-500">Nomor</dt>
          <dd className="sm:col-span-2 font-medium text-slate-800">{d.nomor}</dd>
          <dt className="text-slate-500">Judul</dt>
          <dd className="sm:col-span-2 text-slate-800">{d.judul}</dd>
          <dt className="text-slate-500">Penandatangan</dt>
          <dd className="sm:col-span-2 text-slate-800">{d.penandatangan || "—"}</dd>
          <dt className="text-slate-500">Waktu</dt>
          <dd className="sm:col-span-2 text-slate-800">
            {d.ditandatangani_pada?.replace("T", " ").slice(0, 16) ?? "—"}
          </dd>
          {d.hash && (
            <>
              <dt className="text-slate-500">Sidik dokumen</dt>
              <dd className="sm:col-span-2">
                <code className="text-xs break-all text-slate-600">{d.hash}</code>
              </dd>
            </>
          )}
          {d.alasan_cabut && (
            <>
              <dt className="text-slate-500">Alasan dicabut</dt>
              <dd className="sm:col-span-2 text-amber-900">{d.alasan_cabut}</dd>
            </>
          )}
        </dl>
      )}

      {d.catatan_tte && (
        <p className="text-xs text-slate-600 border-t border-slate-200 pt-3 leading-relaxed">
          {d.catatan_tte}
        </p>
      )}
    </div>
  );
}

function Isi() {
  const sp = useSearchParams();
  const id = sp.get("id");

  const [hasil, setHasil] = useState<TteVerifikasi | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [cocokLoading, setCocokLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true); setErr("");
    verifikasiTteSop(id)
      .then(r => setHasil(r.data))
      .catch(e => setErr(e?.response?.data?.error || "Token tidak dapat dibaca."))
      .finally(() => setLoading(false));
  }, [id]);

  const cocokkanBerkas = useCallback(async (f: File | null) => {
    if (!f) return;
    setCocokLoading(true); setErr(""); setHasil(null);
    try {
      const buf = await f.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const hex = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, "0")).join("");
      const r = await cocokkanTteSop(hex);
      setHasil(r.data);
    } catch (e) {
      const x = e as { response?: { data?: { error?: string } } };
      setErr(x.response?.data?.error || "Gagal memeriksa berkas.");
    } finally { setCocokLoading(false); }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-800">Verifikasi Dokumen Elektronik</h1>
          <p className="text-sm text-slate-500">RSUD Cabang Bungin</p>
        </header>

        {loading && (
          <div className="text-center text-slate-400 py-10 text-sm">Memeriksa…</div>
        )}

        {err && !loading && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 mb-6">
            {err}
          </div>
        )}

        {hasil && !loading && <div className="mb-6"><Hasil d={hasil} /></div>}

        {!id && !hasil && !loading && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 mb-6">
            Pindai QR pada dokumen, atau periksa berkasnya langsung di bawah ini.
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-1">Cocokkan berkas PDF</h3>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Pemeriksaan terkuat: membuktikan berkas yang Anda pegang persis dokumen
            yang terdaftar. Sidik dokumen dihitung di peramban Anda — berkasnya tidak
            dikirim ke mana pun.
          </p>
          <input type="file" accept="application/pdf"
            onChange={e => cocokkanBerkas(e.target.files?.[0] ?? null)}
            className="w-full text-sm" />
          {cocokLoading && <p className="text-xs text-slate-400 mt-2">Menghitung sidik dokumen…</p>}
        </div>
      </div>
    </div>
  );
}

export default function VerifySopPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-slate-400 text-sm">Memuat…</div>}>
      <Isi />
    </Suspense>
  );
}
