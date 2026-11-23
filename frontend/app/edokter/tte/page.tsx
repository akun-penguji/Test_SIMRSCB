"use client";

// TTE Berkas Klaim di eDokter — dokter menandatangani dari HP/tablet.
//
// Padanan web dari DlgBerkasKlaim. Bedanya alur desktop memproses seluruh
// penanda tangan sekaligus di satu komputer, sedangkan di sini tiap dokter
// menandatangani bagiannya sendiri, kapan pun, dari perangkatnya sendiri.
//
// Dirancang untuk layar sempit lebih dulu: satu berkas per kartu, pratinjau
// dibuka di tab baru (bukan iframe yang mengecil jadi tak terbaca di HP), dan
// passphrase diminta di lembar yang menutupi layar supaya tidak salah ketuk.

import { useCallback, useEffect, useState } from "react";
import {
  edokterTteDaftar, edokterTteBerkasUrl, edokterTteTandatangani,
  EdokterTteBerkas,
} from "@/lib/api";

const tglSingkat = (s: string | null) =>
  s ? s.replace("T", " ").slice(0, 16) : "—";

export default function EdokterTtePage() {
  const [rows, setRows] = useState<EdokterTteBerkas[]>([]);
  const [loading, setLoading] = useState(true);
  const [tampilkan, setTampilkan] = useState<"menunggu" | "semua">("menunggu");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const [pilih, setPilih] = useState<EdokterTteBerkas | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [proses, setProses] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    edokterTteDaftar({ tampilkan })
      .then(r => setRows(r.data))
      .catch(e => setMsg({ ok: false, t: e?.response?.data?.error ?? "Gagal memuat daftar." }))
      .finally(() => setLoading(false));
  }, [tampilkan]);
  useEffect(load, [load]);

  async function tandatangani() {
    if (!pilih) return;
    if (!passphrase.trim()) { setMsg({ ok: false, t: "Passphrase BSrE wajib diisi." }); return; }
    setProses(true); setMsg(null);
    try {
      const r = await edokterTteTandatangani({ no_rawat: pilih.no_rawat, passphrase });
      setMsg({ ok: true, t: r.data.catatan });
      setPilih(null);
      load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ ok: false, t: err.response?.data?.error ?? "Gagal menandatangani." });
    } finally {
      // Passphrase dibuang apa pun hasilnya — tidak ada alasan menahannya di
      // memori setelah permintaan selesai, apalagi di perangkat bersama.
      setProses(false); setPassphrase("");
    }
  }

  return (
    <div className="p-3 sm:p-5 max-w-3xl mx-auto pb-24">
      <header className="mb-4">
        <h1 className="text-lg font-bold text-slate-800">Tanda Tangan Berkas Klaim</h1>
        <p className="text-sm text-slate-500">
          Berkas yang mencantumkan Anda sebagai penanda tangan.
        </p>
      </header>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${msg.ok
          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
          : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          {msg.t}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {([["menunggu", "Menunggu saya"], ["semua", "Semua"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTampilkan(v)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${tampilkan === v
              ? "bg-sky-600 text-white border-sky-600"
              : "bg-white text-slate-600 border-slate-300"}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-slate-400 text-sm py-10">Memuat…</p>
      ) : rows.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-12 border border-dashed rounded-xl">
          {tampilkan === "menunggu"
            ? "Tidak ada berkas yang menunggu tanda tangan Anda."
            : "Belum ada berkas."}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map(r => {
            const sisa = r.penandatangan.filter(p => !p.sudah);
            return (
              <li key={r.no_rawat} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{r.nm_pasien}</p>
                    <p className="text-xs text-slate-500">
                      {r.no_rkm_medis} · {r.no_rawat}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      diunggah {tglSingkat(r.tgl_upload)}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-semibold ${
                    r.status === "SUDAH_TTD"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-800"}`}>
                    {r.status === "SUDAH_TTD" ? "lengkap" : "menunggu"}
                  </span>
                </div>

                {/* Siapa saja yang harus menandatangani, dan siapa yang sudah.
                    Tanpa ini dokter tidak punya cara tahu ia menunggu siapa. */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.penandatangan.map(p => (
                    <span key={p.kode}
                      title={p.sudah ? `Sudah menandatangani ${tglSingkat(p.pada)}` : "Belum menandatangani"}
                      className={`px-2 py-0.5 rounded text-xs border ${p.sudah
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                      {p.sudah ? "✓ " : "○ "}{p.nama}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <a href={edokterTteBerkasUrl(r.no_rawat)} target="_blank" rel="noreferrer"
                    className="flex-1 text-center px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700">
                    Lihat Berkas
                  </a>
                  {r.penandatangan.some(p => !p.sudah) && (
                    <button onClick={() => { setPilih(r); setPassphrase(""); setMsg(null); }}
                      className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white">
                      Tanda Tangani
                    </button>
                  )}
                </div>
                {sisa.length > 0 && r.status !== "SUDAH_TTD" && (
                  <p className="mt-2 text-xs text-slate-400">
                    Menunggu {sisa.length} penanda tangan.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Lembar passphrase — menutupi layar agar tidak salah ketuk di HP */}
      {pilih && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5">
            <h3 className="font-bold text-slate-800">Tanda Tangani Berkas</h3>
            <p className="text-sm text-slate-500 mt-0.5">{pilih.nm_pasien}</p>
            <p className="text-xs text-slate-400">{pilih.no_rawat}</p>

            <a href={edokterTteBerkasUrl(pilih.no_rawat)} target="_blank" rel="noreferrer"
              className="inline-block mt-3 text-sm text-sky-600 underline">
              Periksa isinya dulu ↗
            </a>

            <label className="block text-xs font-semibold text-slate-600 mt-4 mb-1">
              Passphrase BSrE
            </label>
            <input type="password" value={passphrase} autoComplete="off"
              onChange={e => setPassphrase(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base"
              placeholder="Passphrase sertifikat Anda" />
            <p className="text-xs text-slate-500 mt-1.5">
              Hanya Anda yang mengetahuinya. Passphrase tidak disimpan di mana pun —
              ia diteruskan ke BSrE lalu dibuang.
            </p>

            <div className="flex gap-2 mt-5">
              <button onClick={() => { setPilih(null); setPassphrase(""); }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-slate-100 rounded-lg">
                Batal
              </button>
              <button onClick={tandatangani} disabled={proses}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg disabled:opacity-50">
                {proses ? "Menandatangani…" : "Tanda Tangani"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
