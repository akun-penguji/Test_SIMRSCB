"use client";

// Dashboard Ketersediaan Tempat Tidur (BPJS Aplicare).
//
// Angka di sini LIVE dari tabel `kamar` dengan rumus yang sama persis dengan
// yang dikirim sync ke BPJS (statusdata='1', status='KOSONG'), jadi apa yang
// tampak di layar = apa yang dilihat BPJS setelah sync terakhir.
//
// Bentuk visual dipilih menurut tugas datanya: angka utama = hero figure,
// empat angka ringkas = KPI tile, rasio terhadap kapasitas = meter (bukan pie
// atau bar kategorikal), dan daftar ruang yang panjang = tabel.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getAplicareBed, triggerAplicareSync, AplicareBed, BedRuang } from "@/lib/api";

const REFRESH_MS = 60000;

// Nama kelas Aplicare (kode 3 huruf dari BPJS) → label yang terbaca orang.
const LABEL_KELAS: Record<string, string> = {
  KL1: "Kelas 1", KL2: "Kelas 2", KL3: "Kelas 3",
  ICU: "ICU", HCU: "HCU", NIC: "NICU", PIC: "PICU",
  VIP: "VIP", VVIP: "VVIP", UTM: "Kelas Utama",
};
const namaKelas = (k: string) => LABEL_KELAS[k] ?? k;

// Tingkat keterisian = status, jadi warnanya warna status dan SELALU didampingi
// teks — bukan warna saja.
type Tingkat = { teks: string; isi: string; jalur: string; tulisan: string };
function tingkat(terisi: number, kapasitas: number): Tingkat {
  const p = kapasitas > 0 ? (terisi / kapasitas) * 100 : 0;
  if (kapasitas === 0) return { teks: "Tidak ada TT", isi: "bg-slate-300", jalur: "bg-slate-100", tulisan: "text-slate-500" };
  if (p >= 100)        return { teks: "Penuh",        isi: "bg-rose-600",  jalur: "bg-rose-100",  tulisan: "text-rose-700" };
  if (p >= 85)         return { teks: "Hampir penuh", isi: "bg-amber-500", jalur: "bg-amber-100", tulisan: "text-amber-700" };
  return { teks: "Tersedia", isi: "bg-emerald-600", jalur: "bg-emerald-100", tulisan: "text-emerald-700" };
}
const persen = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function AplicareBedPage() {
  const [d, setD] = useState<AplicareBed | null>(null);
  const [err, setErr] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [dimuatPada, setDimuatPada] = useState<string>("");

  const muat = useCallback(() => {
    getAplicareBed()
      .then(r => { setD(r.data); setErr(""); setDimuatPada(new Date().toLocaleTimeString("id-ID")); })
      .catch(() => setErr("Gagal memuat data ketersediaan tempat tidur"));
  }, []);

  useEffect(() => {
    muat();
    const t = setInterval(muat, REFRESH_MS);
    return () => clearInterval(t);
  }, [muat]);

  async function sync() {
    setSyncing(true); setOkMsg(""); setErr("");
    try {
      await triggerAplicareSync();
      setOkMsg("Sync ke BPJS dijalankan — lihat Monitor Aplicare untuk lognya.");
      setTimeout(muat, 4000);
    } catch { setErr("Gagal menjalankan sync"); }
    finally { setSyncing(false); }
  }

  if (!d && !err) return <div className="p-6 text-sm text-slate-400">Memuat data tempat tidur…</div>;

  const terisi = d?.terisi ?? 0;
  const kapasitas = d?.kapasitas ?? 0;
  const tersedia = d?.tersedia ?? 0;
  const bor = persen(terisi, kapasitas);
  const st = tingkat(terisi, kapasitas);

  return (
    <div className="p-3 md:p-5 lg:p-6">
      {/* Judul + aksi */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-800">Ketersediaan Tempat Tidur</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Angka yang dilaporkan ke BPJS Aplicare · sync otomatis tiap {d?.interval_min ?? "—"} menit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/display/tempat-tidur" target="_blank" rel="noopener"
            className="text-xs md:text-sm border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium px-3 py-2 rounded-xl">
            🖥️ Layar TV
          </a>
          <Link href="/aplicare/monitor"
            className="text-xs md:text-sm border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium px-3 py-2 rounded-xl">
            Monitor &amp; Log
          </Link>
          <button onClick={sync} disabled={syncing}
            className="text-xs md:text-sm bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-medium px-4 py-2 rounded-xl">
            {syncing ? "Mengirim…" : "Sync Sekarang"}
          </button>
        </div>
      </div>

      {err && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</div>}
      {okMsg && <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">{okMsg}</div>}

      {d && (
        <>
          {/* Angka utama + KPI */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 mb-3 md:mb-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col justify-center">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tempat tidur kosong</div>
              <div className="text-6xl font-semibold text-slate-800 leading-none mt-1">{tersedia}</div>
              <div className="text-sm text-slate-500 mt-2">dari {kapasitas} tempat tidur aktif</div>
              <div className={`inline-flex items-center gap-1.5 mt-3 text-xs font-semibold ${st.tulisan}`}>
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${st.isi}`} aria-hidden="true" />
                {st.teks} · keterisian {bor}%
              </div>
            </div>

            <div className="lg:col-span-2 grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
              <Tile label="Kapasitas" nilai={kapasitas} ket="TT aktif terpetakan" />
              <Tile label="Terisi" nilai={terisi} ket={`${bor}% dari kapasitas`} />
              <Tile label="Kosong" nilai={tersedia} ket={`${100 - bor}% dari kapasitas`} />
              <Tile label="Ruang dilaporkan" nilai={d.per_ruang.length} ket={`${d.per_kelas.length} kelas Aplicare`} />
            </div>
          </div>

          {/* Meter per kelas — satu rasio terhadap kapasitas, per kelas */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 md:p-5 mb-3 md:mb-4">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-800">Keterisian per Kelas</h2>
              <span className="text-xs text-slate-400">terisi / kapasitas</span>
            </div>
            <div className="space-y-3">
              {d.per_kelas.map(k => {
                const t = k.kapasitas - k.tersedia;
                const s = tingkat(t, k.kapasitas);
                return (
                  <div key={k.kode_kelas}>
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <div className="text-sm font-semibold text-slate-700">
                        {namaKelas(k.kode_kelas)}
                        <span className="text-xs font-normal text-slate-400 ml-1.5">{k.jml_ruang} ruang</span>
                      </div>
                      <div className="text-sm text-slate-600 tabular-nums">
                        <span className="font-semibold text-slate-800">{t}</span>
                        <span className="text-slate-400"> / {k.kapasitas}</span>
                        <span className={`ml-2 text-xs font-semibold ${s.tulisan}`}>{k.tersedia} kosong</span>
                      </div>
                    </div>
                    <Meter terisi={t} kapasitas={k.kapasitas} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ruang yang belum dipetakan — status, dengan ikon + label, bukan warna saja */}
          {d.belum_dipetakan.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 md:p-5 mb-3 md:mb-4">
              <div className="flex items-start gap-2.5">
                <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-amber-900">
                    Peringatan · {d.kapasitas_belum_dipetakan} tempat tidur tidak dilaporkan ke BPJS
                  </div>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Bangsal/kelas berikut punya kamar aktif tapi belum ada di pemetaan
                    <code className="mx-1 bg-amber-100 px-1 rounded">aplicare_ketersediaan_kamar</code>
                    sehingga tidak pernah ikut terkirim.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {d.belum_dipetakan.map((b, i) => (
                      <li key={i} className="text-xs text-amber-900">
                        <span className="font-semibold">{b.nm_bangsal}</span>
                        <span className="text-amber-700"> ({b.kd_bangsal}) · {b.kelas} · {b.kapasitas} TT, {b.tersedia} kosong</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Rincian per ruang */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">Rincian per Ruang</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {["Kelas Aplicare", "Kode Ruang", "Nama Ruang", "Kelas Khanza", "Kapasitas", "Terisi", "Kosong", "Keterisian"].map(c => (
                      <th key={c} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.per_ruang.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">Belum ada ruang yang dipetakan ke Aplicare</td></tr>
                  ) : d.per_ruang.map((r: BedRuang, i) => {
                    const t = r.kapasitas - r.tersedia;
                    const s = tingkat(t, r.kapasitas);
                    return (
                      <tr key={`${r.kode_kelas}-${r.kd_bangsal}-${i}`} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-3 py-2 text-xs font-medium text-slate-700 whitespace-nowrap">{namaKelas(r.kode_kelas)}</td>
                        <td className="px-3 py-2 text-xs font-mono text-slate-500">{r.kd_bangsal}</td>
                        <td className="px-3 py-2 text-xs font-medium text-slate-800">{r.nm_bangsal}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{r.kelas}</td>
                        <td className="px-3 py-2 text-xs tabular-nums text-slate-700">{r.kapasitas}</td>
                        <td className="px-3 py-2 text-xs tabular-nums text-slate-700">{t}</td>
                        <td className="px-3 py-2 text-xs tabular-nums font-semibold text-slate-800">{r.tersedia}</td>
                        <td className="px-3 py-2 min-w-[160px]">
                          <div className="flex items-center gap-2">
                            <Meter terisi={t} kapasitas={r.kapasitas} tipis />
                            <span className={`text-xs font-semibold tabular-nums shrink-0 ${s.tulisan}`}>{persen(t, r.kapasitas)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span>Diperbarui {dimuatPada || "—"} (otomatis tiap {REFRESH_MS / 1000} detik)</span>
              {d.sync_terakhir && (
                <span>
                  Sync terakhir: {d.sync_terakhir.waktu}
                  <span className={d.sync_terakhir.level === "error" ? "text-rose-600 font-semibold" : "text-emerald-600 font-semibold"}>
                    {" "}{d.sync_terakhir.level === "error" ? "gagal" : "berhasil"}
                  </span>
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Potongan UI ──────────────────────────────────────────────────────────────
function Tile({ label, nilai, ket }: { label: string; nilai: number; ket: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-3xl font-semibold text-slate-800 leading-tight mt-1">{nilai}</div>
      <div className="text-xs text-slate-400 mt-0.5">{ket}</div>
    </div>
  );
}

/** Meter: satu rasio terhadap kapasitas. Isi = warna status, jalur = versi muda
 *  warna yang sama, supaya keadaannya terbaca di sepanjang bar. */
function Meter({ terisi, kapasitas, tipis }: { terisi: number; kapasitas: number; tipis?: boolean }) {
  const s = tingkat(terisi, kapasitas);
  const p = kapasitas > 0 ? Math.min(100, (terisi / kapasitas) * 100) : 0;
  return (
    <div className={`w-full ${tipis ? "h-2" : "h-3"} rounded-full overflow-hidden ${s.jalur}`}
      role="img" aria-label={`${terisi} dari ${kapasitas} tempat tidur terisi — ${s.teks}`}>
      <div className={`h-full rounded-full ${s.isi}`} style={{ width: `${p}%` }} />
    </div>
  );
}
