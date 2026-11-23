"use client";

// TTE Dokumen & SOP — unggah draft, pratinjau, lalu tanda tangan.
//
// Alur: penyusun mengunggah .docx/.pdf yang sudah diberi penanda ${ttd}
// (dan opsional ${stempel}, ${qr}), lalu Direktur membuka pratinjau dan
// menandatangani di sini.
//
// Pratinjau bukan hiasan: gambar tanda tangan dipasang terpusat pada penanda,
// jadi kalau penanda tidak berdiri di barisnya sendiri, tanda tangan akan
// menimpa teks di sekitarnya. Lebih baik ketahuan sebelum ditandatangani.

import { useEffect, useState, useCallback } from "react";
import {
  getTteDokumen, unggahTteDokumen, tandatanganiTte, cabutTte, tteBerkasUrl,
  getTteSpesimen, TteDokumen, TteSpesimen,
} from "@/lib/api";

const badge: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  ditandatangani: "bg-emerald-100 text-emerald-800",
  dicabut: "bg-rose-100 text-rose-800",
};

const hariIni = () => new Date().toISOString().slice(0, 10);
const aktif = (r: TteSpesimen) => {
  const h = hariIni();
  return r.mulai <= h && (!r.selesai || r.selesai >= h);
};

export default function TteSopPage() {
  const [rows, setRows] = useState<TteDokumen[]>([]);
  const [spesimen, setSpesimen] = useState<TteSpesimen[]>([]);
  const [fStatus, setFStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const [unggah, setUnggah] = useState<{ nomor: string; judul: string; file: File | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ttd, setTtd] = useState<TteDokumen | null>(null);

  // Pilihan penandatanganan
  const [metode, setMetode] = useState<"bsre" | "tempel">("bsre");
  const [gaya, setGaya] = useState<"qr" | "gambar">("qr");
  const [nik, setNik] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [spTtd, setSpTtd] = useState<number | "">("");
  const [spStempel, setSpStempel] = useState<number | "">("");
  const [qrSudut, setQrSudut] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getTteDokumen(fStatus).then(r => setRows(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [fStatus]);
  useEffect(load, [load]);
  useEffect(() => { getTteSpesimen().then(r => setSpesimen(r.data)).catch(() => {}); }, []);

  const spTtdAktif = spesimen.filter(s => s.jenis === "ttd" && aktif(s));
  const spStempelAktif = spesimen.filter(s => s.jenis === "stempel" && aktif(s));

  async function kirimUnggahan() {
    if (!unggah?.file) { setMsg({ ok: false, t: "Pilih berkas dulu." }); return; }
    if (!unggah.nomor.trim() || !unggah.judul.trim()) {
      setMsg({ ok: false, t: "Nomor dan judul wajib diisi." }); return;
    }
    setBusy(true); setMsg(null);
    try {
      const r = await unggahTteDokumen({ nomor: unggah.nomor, judul: unggah.judul, file: unggah.file });
      setMsg({ ok: true, t: `Draft tersimpan. ${r.data.catatan}` });
      setUnggah(null); load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ ok: false, t: err.response?.data?.error || "Gagal mengunggah." });
    } finally { setBusy(false); }
  }

  function bukaTtd(r: TteDokumen) {
    setTtd(r); setMsg(null);
    setMetode("bsre"); setGaya("qr"); setPassphrase(""); setQrSudut(true);
    setSpTtd(spTtdAktif[0]?.id ?? "");
    setSpStempel(spStempelAktif[0]?.id ?? "");
    setNik(spTtdAktif[0]?.pejabat_nik ?? "");
  }

  async function kirimTandaTangan() {
    if (!ttd) return;
    const pakaiGambar = metode === "tempel" || gaya === "gambar";
    if (pakaiGambar && !spTtd) {
      setMsg({ ok: false, t: "Pilih spesimen tanda tangan dulu." }); return;
    }
    if (metode === "bsre") {
      if (!passphrase.trim()) { setMsg({ ok: false, t: "Passphrase BSrE wajib diisi." }); return; }
      if (gaya === "qr" && !/^\d{16}$/.test(nik)) {
        setMsg({ ok: false, t: "NIK penandatangan harus 16 digit." }); return;
      }
    }
    setBusy(true); setMsg(null);
    try {
      const r = await tandatanganiTte(ttd.id, {
        metode,
        passphrase: metode === "bsre" ? passphrase : undefined,
        gaya_ttd: metode === "bsre" ? gaya : undefined,
        nik: metode === "bsre" && gaya === "qr" ? nik : undefined,
        spesimen_ttd_id: pakaiGambar ? Number(spTtd) : undefined,
        spesimen_stempel_id: spStempel ? Number(spStempel) : undefined,
        qr_di_sudut: qrSudut,
      });
      setMsg({ ok: true, t: `${r.data.nomor} ditandatangani. ${r.data.catatan}` });
      setTtd(null); setPassphrase(""); load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ ok: false, t: err.response?.data?.error || "Gagal menandatangani." });
    } finally { setBusy(false); setPassphrase(""); }
  }

  async function cabut(r: TteDokumen) {
    const alasan = prompt(`Alasan pencabutan ${r.nomor}:`, "Diganti revisi terbaru");
    if (!alasan?.trim()) return;
    try { await cabutTte(r.id, alasan); setMsg({ ok: true, t: "Dokumen dicabut." }); load(); }
    catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ ok: false, t: err.response?.data?.error || "Gagal mencabut." });
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Tanda Tangan Elektronik — Dokumen & SOP</h1>
          <p className="text-sm text-slate-500 mt-1">
            Unggah draft bertanda <code className="bg-slate-100 px-1 rounded">{"${ttd}"}</code>, lalu tanda tangani.
          </p>
        </div>
        <button onClick={() => { setUnggah({ nomor: "", judul: "", file: null }); setMsg(null); }}
          className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg">
          + Unggah Draft
        </button>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          {msg.t}
        </div>
      )}

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 mb-4">
        <b>Cara memberi penanda di Word.</b> Tulis <code className="bg-white px-1 rounded">{"${ttd}"}</code> di
        tempat tanda tangan, <code className="bg-white px-1 rounded">{"${stempel}"}</code> untuk stempel, dan
        <code className="bg-white px-1 rounded"> {"${qr}"}</code> untuk QR. Ukuran bisa ditentukan sendiri:
        <code className="bg-white px-1 rounded"> {"${ttd:20}"}</code> berarti tinggi 20 mm.
        Penanda <code className="bg-white px-1 rounded">{"${ttd}"}</code> harus berdiri di barisnya sendiri
        dengan ruang kosong di atas-bawahnya, supaya tanda tangan tidak menimpa teks.
        Unggah <b>.docx</b> bila bisa — PDF hasil pindai tidak punya lapisan teks, jadi penandanya tidak akan ditemukan.
      </div>

      <div className="flex gap-2 mb-3">
        {[["", "Semua"], ["draft", "Menunggu TTD"], ["ditandatangani", "Ditandatangani"], ["dicabut", "Dicabut"]].map(([v, l]) => (
          <button key={v} onClick={() => setFStatus(v)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${fStatus === v ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm py-10 text-center">Memuat…</div>
      ) : rows.length === 0 ? (
        <div className="text-slate-400 text-sm py-10 text-center border border-dashed rounded-xl">
          Belum ada dokumen.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Nomor / Judul</th>
                <th className="text-left px-3 py-2 font-semibold">Status</th>
                <th className="text-left px-3 py-2 font-semibold">Penandatangan</th>
                <th className="text-left px-3 py-2 font-semibold">Sidik dokumen</th>
                <th className="text-right px-3 py-2 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{r.nomor}</div>
                    <div className="text-xs text-slate-500">{r.judul}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${badge[r.status] ?? "bg-slate-100"}`}>
                      {r.status === "draft" ? "menunggu TTD" : r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-slate-700">{r.penandatangan_nama || "—"}</div>
                    <div className="text-xs text-slate-500">{r.ditandatangani_pada?.replace("T", " ").slice(0, 16) ?? ""}</div>
                  </td>
                  <td className="px-3 py-2">
                    <code className="text-xs text-slate-500">{r.hash_hasil ? r.hash_hasil.slice(0, 16) + "…" : "—"}</code>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <a href={tteBerkasUrl(r.id)} target="_blank" rel="noreferrer"
                      className="text-sky-600 hover:underline text-xs mr-3">
                      {r.status === "draft" ? "Pratinjau" : "Buka PDF"}
                    </a>
                    {r.status === "draft" && (
                      <button onClick={() => bukaTtd(r)} className="text-emerald-600 hover:underline text-xs mr-3 font-semibold">
                        Tanda Tangani
                      </button>
                    )}
                    {r.status === "ditandatangani" && (
                      <button onClick={() => cabut(r)} className="text-rose-600 hover:underline text-xs">Cabut</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Unggah draft */}
      {unggah && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-5 max-w-lg w-full">
            <h3 className="font-bold text-slate-800 mb-4">Unggah Draft</h3>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nomor dokumen</label>
            <input value={unggah.nomor} onChange={e => setUnggah(s => s && ({ ...s, nomor: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-3"
              placeholder="SOP/KEP/014" />
            <label className="block text-xs font-semibold text-slate-600 mb-1">Judul</label>
            <input value={unggah.judul} onChange={e => setUnggah(s => s && ({ ...s, judul: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-3"
              placeholder="Pemasangan Kateter Urin" />
            <label className="block text-xs font-semibold text-slate-600 mb-1">Berkas (.docx disarankan)</label>
            <input type="file" accept=".docx,.doc,.pdf"
              onChange={e => setUnggah(s => s && ({ ...s, file: e.target.files?.[0] ?? null }))}
              className="w-full text-sm mb-4" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setUnggah(null)}
                className="px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button>
              <button onClick={kirimUnggahan} disabled={busy}
                className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50">
                {busy ? "Memproses…" : "Unggah & Deteksi Penanda"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tanda tangani */}
      {ttd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-5 max-w-2xl w-full my-8">
            <h3 className="font-bold text-slate-800">Tanda Tangani</h3>
            <p className="text-sm text-slate-500 mb-1">{ttd.nomor} — {ttd.judul}</p>
            <a href={tteBerkasUrl(ttd.id)} target="_blank" rel="noreferrer"
              className="text-sky-600 hover:underline text-xs">Buka pratinjau draft ↗</a>

            <div className="mt-4 mb-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Metode</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMetode("bsre")}
                  className={`px-3 py-2 text-sm rounded-lg border text-left ${metode === "bsre" ? "bg-sky-600 text-white border-sky-600" : "bg-white border-slate-300 hover:bg-slate-50"}`}>
                  <div className="font-semibold">BSrE</div>
                  <div className={`text-xs ${metode === "bsre" ? "text-sky-100" : "text-slate-500"}`}>
                    Terbaca panel tanda tangan Adobe Reader
                  </div>
                </button>
                <button type="button" onClick={() => setMetode("tempel")}
                  className={`px-3 py-2 text-sm rounded-lg border text-left ${metode === "tempel" ? "bg-slate-700 text-white border-slate-700" : "bg-white border-slate-300 hover:bg-slate-50"}`}>
                  <div className="font-semibold">Tempel saja</div>
                  <div className={`text-xs ${metode === "tempel" ? "text-slate-200" : "text-slate-500"}`}>
                    Tanpa sertifikat — Adobe tidak mendeteksi
                  </div>
                </button>
              </div>
            </div>

            {metode === "tempel" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 mb-3">
                Dokumen tidak akan punya tanda tangan kriptografis. Panel tanda tangan Adobe
                Reader tetap kosong, dan keasliannya hanya bisa diperiksa lewat QR dan
                pencocokan sidik dokumen di halaman verifikasi.
              </div>
            )}

            {metode === "bsre" && (
              <>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Yang tampak sebagai tanda tangan</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setGaya("qr")}
                      className={`px-3 py-2 text-sm rounded-lg border ${gaya === "qr" ? "bg-sky-600 text-white border-sky-600" : "bg-white border-slate-300 hover:bg-slate-50"}`}>
                      QR berlogo <span className="text-xs opacity-80">(seperti surat dinas)</span>
                    </button>
                    <button type="button" onClick={() => setGaya("gambar")}
                      className={`px-3 py-2 text-sm rounded-lg border ${gaya === "gambar" ? "bg-sky-600 text-white border-sky-600" : "bg-white border-slate-300 hover:bg-slate-50"}`}>
                      Gambar tanda tangan
                    </button>
                  </div>
                </div>
                {gaya === "qr" && (
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">NIK penandatangan</label>
                    <input value={nik} inputMode="numeric" maxLength={16}
                      onChange={e => setNik(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      placeholder="16 digit, sesuai sertifikat BSrE" />
                  </div>
                )}
              </>
            )}

            {(metode === "tempel" || gaya === "gambar") && (
              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Spesimen tanda tangan</label>
                <select value={spTtd} onChange={e => setSpTtd(e.target.value ? Number(e.target.value) : "")}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="">— pilih —</option>
                  {spTtdAktif.map(s => (
                    <option key={s.id} value={s.id}>{s.pejabat_nama || s.pejabat_nik} — {s.jabatan}</option>
                  ))}
                </select>
                {spTtdAktif.length === 0 && (
                  <p className="text-xs text-rose-600 mt-1">
                    Belum ada spesimen tanda tangan yang berlaku. Tambahkan di menu Master Spesimen TTE.
                  </p>
                )}
              </div>
            )}

            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Stempel (opsional)</label>
              <select value={spStempel} onChange={e => setSpStempel(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">— tanpa stempel —</option>
                {spStempelAktif.map(s => <option key={s.id} value={s.id}>{s.pejabat_nama || "Stempel RS"}</option>)}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 mb-3">
              <input type="checkbox" checked={qrSudut} onChange={e => setQrSudut(e.target.checked)} />
              Taruh QR di sudut kanan-bawah bila dokumen tidak punya penanda <code className="bg-slate-100 px-1 rounded">{"${qr}"}</code>
            </label>

            {metode === "bsre" && (
              <div className="mb-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Passphrase BSrE</label>
                <input type="password" value={passphrase} autoComplete="off"
                  onChange={e => setPassphrase(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Passphrase sertifikat Anda" />
                <p className="text-xs text-slate-500 mt-1">
                  Hanya pemilik sertifikat yang tahu passphrase ini — karena itu ia sekaligus
                  menjadi pengesahan ulang, bukan sekadar sesi login yang kebetulan terbuka.
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => { setTtd(null); setPassphrase(""); }}
                className="px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button>
              <button onClick={kirimTandaTangan} disabled={busy}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
                {busy ? "Menandatangani…" : "Tanda Tangani"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
