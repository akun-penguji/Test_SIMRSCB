"use client";

// Layar TV Ketersediaan Tempat Tidur — halaman penuh untuk televisi lobi/IGD.
// Tanpa menu SIMRS dan tanpa login: memakai endpoint publik /display/tempat-tidur
// yang hanya berisi hitungan kamar (tidak ada data pasien sama sekali).
//
// Angkanya identik dengan yang dilaporkan ke BPJS Aplicare.
//
// Parameter URL (semua opsional):
//   ?theme=dark|light   — default dark
//   ?title=...          — judul utama (default: nama RS dari setting)
//   ?subtitle=...       — baris kecil di bawah judul
//   ?ticker=...         — teks berjalan di bawah
//   ?refresh=30         — detik antar pembaruan (default 30)
//
// Pasang di kiosk: chrome --kiosk http://localhost:3000/display/tempat-tidur

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getDisplayBed, getSetting, DisplayBed, BedKelas, BedRuang, SettingRS } from "@/lib/api";

const DEFAULT_TICKER =
  "Informasi ketersediaan tempat tidur diperbarui otomatis. " +
  "Untuk pendaftaran rawat inap silakan hubungi petugas admisi. " +
  "Terima kasih atas kepercayaan Anda.";

const LABEL_KELAS: Record<string, string> = {
  KL1: "Kelas 1", KL2: "Kelas 2", KL3: "Kelas 3",
  ICU: "ICU", HCU: "HCU", NIC: "NICU", PIC: "PICU",
  VIP: "VIP", VVIP: "VVIP", UTM: "Kelas Utama",
};
const namaKelas = (k: string) => LABEL_KELAS[k] ?? k;

// Ikon per jenis ruang — dipilih supaya terbaca sekilas dari jauh.
function IkonKelas({ kode, className }: { kode: string; className?: string }) {
  const p = { className, fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.8 } as const;
  if (kode === "ICU" || kode === "HCU")
    return <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2-5 3 10 2.5-7 1.5 2h5" /></svg>;
  if (kode === "NIC" || kode === "PIC")
    return <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-4.35-7-9a4 4 0 017-2.65A4 4 0 0119 12c0 4.65-7 9-7 9z" /></svg>;
  // Kelas perawatan biasa — ikon ranjang
  return (
    <svg {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 18V7m0 6h18m0 5v-6a3 3 0 00-3-3h-8" />
      <circle cx="7.5" cy="10.5" r="1.8" />
    </svg>
  );
}

type Nada = { label: string; teks: string; isi: string; jalur: string; kartu: string };
// Warna teks dibedakan per tema: nada 300 terbaca di latar gelap tapi terlalu
// pucat di atas putih, jadi tema terang memakai nada 700.
function nada(tersedia: number, kapasitas: number, gelap: boolean): Nada {
  if (kapasitas === 0)
    return { label: "Tidak ada TT", teks: gelap ? "text-white/50" : "text-slate-500",
             isi: "bg-slate-400", jalur: gelap ? "bg-white/10" : "bg-slate-200",
             kartu: gelap ? "border-white/10" : "border-slate-200" };
  if (tersedia === 0)
    return { label: "PENUH", teks: gelap ? "text-rose-300" : "text-rose-700",
             isi: "bg-rose-500", jalur: gelap ? "bg-rose-500/20" : "bg-rose-100",
             kartu: gelap ? "border-rose-400/50" : "border-rose-300" };
  if (tersedia / kapasitas <= 0.25)
    return { label: "TERBATAS", teks: gelap ? "text-amber-300" : "text-amber-700",
             isi: "bg-amber-400", jalur: gelap ? "bg-amber-400/20" : "bg-amber-100",
             kartu: gelap ? "border-amber-300/50" : "border-amber-400" };
  return { label: "TERSEDIA", teks: gelap ? "text-emerald-300" : "text-emerald-700",
           isi: "bg-emerald-400", jalur: gelap ? "bg-emerald-400/20" : "bg-emerald-100",
           kartu: gelap ? "border-emerald-300/40" : "border-emerald-300" };
}

function Jam({ gelap }: { gelap: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <div className="text-right h-[52px]" />;
  return (
    <div className="text-right leading-tight">
      <div className={`text-4xl font-mono font-bold tracking-widest ${gelap ? "text-white" : "text-slate-900"}`}>
        {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div className={`text-sm capitalize ${gelap ? "text-white/70" : "text-slate-600"}`}>
        {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>
  );
}

export default function DisplayTempatTidurPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 text-white flex items-center justify-center text-2xl">Memuat…</div>}>
      <Isi />
    </Suspense>
  );
}

function Isi() {
  const params = useSearchParams();
  const gelap = params.get("theme") !== "light";
  const judulParam = params.get("title");
  const subJudulParam = params.get("subtitle");
  const ticker = params.get("ticker") ?? DEFAULT_TICKER;
  const refreshMs = Math.max(10, Number(params.get("refresh")) || 30) * 1000;

  const [d, setD] = useState<DisplayBed | null>(null);
  const [setting, setSetting] = useState<SettingRS | null>(null);
  const [err, setErr] = useState(false);
  const [jamMuat, setJamMuat] = useState("");
  const kolomRef = useRef<HTMLElement | null>(null);
  const kartuRef = useRef<HTMLDivElement | null>(null);
  const [sisaPx, setSisaPx] = useState(0);

  // Sisa tinggi untuk panel "Per Ruang" diukur dari kolom kanan dikurangi grid
  // kartu. Diukur di SINI (bukan di dalam panel) supaya tetap bisa dihitung
  // ulang walau panelnya sedang tidak ditampilkan.
  useEffect(() => {
    const ukur = () => {
      const kol = kolomRef.current, kar = kartuRef.current;
      if (!kol || !kar) return;
      setSisaPx(kol.clientHeight - kar.offsetHeight - 16);
    };
    const id = requestAnimationFrame(ukur);
    const t1 = setTimeout(ukur, 250), t2 = setTimeout(ukur, 1000);
    const ro = new ResizeObserver(ukur);
    if (kolomRef.current) ro.observe(kolomRef.current);
    if (kartuRef.current) ro.observe(kartuRef.current);
    window.addEventListener("resize", ukur);
    return () => { cancelAnimationFrame(id); clearTimeout(t1); clearTimeout(t2);
                   ro.disconnect(); window.removeEventListener("resize", ukur); };
  }, [d]);

  const muat = useCallback(() => {
    getDisplayBed()
      .then(r => { setD(r.data); setErr(false); setJamMuat(new Date().toLocaleTimeString("id-ID")); })
      .catch(() => setErr(true));
  }, []);

  useEffect(() => { getSetting().then(r => setSetting(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    muat();
    const t = setInterval(muat, refreshMs);
    return () => clearInterval(t);
  }, [muat, refreshMs]);

  const judul = judulParam ?? setting?.nama_instansi ?? "RUMAH SAKIT";
  const subJudul = subJudulParam ?? setting?.alamat_instansi ?? "";
  const bg = gelap
    ? "from-slate-900 via-teal-950 to-emerald-950 text-white"
    : "from-emerald-50 via-white to-teal-50 text-slate-900";
  const kartuBg = gelap ? "bg-white/[0.07] backdrop-blur" : "bg-white shadow-sm";

  const kapasitas = d?.kapasitas ?? 0;
  const tersedia = d?.tersedia ?? 0;
  const terisi = d?.terisi ?? 0;
  const nAll = nada(tersedia, kapasitas, gelap);

  return (
    <div className={`h-screen w-screen overflow-hidden bg-gradient-to-br ${bg} flex flex-col select-none`}>

      {/* Kop: logo + nama RS + jam */}
      <header className={`flex items-center justify-between gap-6 px-8 py-4 border-b ${gelap ? "border-white/10" : "border-slate-200"} shrink-0`}>
        <div className="flex items-center gap-4 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-rs.png" alt="" className="h-16 w-16 object-contain shrink-0"
               onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <div className="min-w-0">
            <h1 className="text-3xl font-bold leading-tight truncate">{judul}</h1>
            {subJudul && <p className={`text-sm truncate ${gelap ? "text-white/60" : "text-slate-600"}`}>{subJudul}</p>}
          </div>
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className={`hidden xl:block text-right ${gelap ? "text-white/70" : "text-slate-500"}`}>
            <div className="text-sm uppercase tracking-[0.2em]">Informasi</div>
            <div className="text-2xl font-semibold">Ketersediaan Tempat Tidur</div>
          </div>
          <Jam gelap={gelap} />
        </div>
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-12 gap-4 p-4">

        {/* Angka utama */}
        <section className={`col-span-12 lg:col-span-4 xl:col-span-3 ${kartuBg} border ${nAll.kartu} rounded-3xl p-6 flex flex-col justify-center items-center text-center`}>
          <div className={`text-lg font-semibold uppercase tracking-[0.2em] ${gelap ? "text-white/60" : "text-slate-500"}`}>
            Tempat Tidur Kosong
          </div>
          <div className="font-bold leading-none my-3" style={{ fontSize: "min(26vh, 16vw)" }}>{tersedia}</div>
          <div className={`text-3xl font-semibold ${gelap ? "text-white/80" : "text-slate-700"}`}>dari {kapasitas} tempat tidur</div>
          <div className={`mt-5 w-full h-4 rounded-full overflow-hidden ${nAll.jalur}`}>
            <div className={`h-full rounded-full ${nAll.isi}`}
                 style={{ width: `${kapasitas ? (terisi / kapasitas) * 100 : 0}%` }} />
          </div>
          <div className={`mt-2 text-xl ${gelap ? "text-white/60" : "text-slate-500"}`}>
            Terisi {terisi} · {kapasitas ? Math.round((terisi / kapasitas) * 100) : 0}%
          </div>
          <div className={`mt-4 inline-flex items-center gap-2 text-3xl font-bold ${nAll.teks}`}>
            <span className={`inline-block w-4 h-4 rounded-full ${nAll.isi}`} aria-hidden="true" />
            {nAll.label}
          </div>
        </section>

        {/* Kartu per kelas */}
        <section ref={kolomRef} className="col-span-12 lg:col-span-8 xl:col-span-9 min-h-0 flex flex-col gap-4">
          {err && (
            <div className="rounded-2xl bg-rose-500/20 border border-rose-400/50 px-5 py-3 text-lg font-semibold text-rose-200">
              Data sementara tidak dapat dimuat — mencoba lagi otomatis.
            </div>
          )}

          <div ref={kartuRef} className="grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-min shrink-0">
            {(d?.per_kelas ?? []).map((k: BedKelas) => {
              const n = nada(k.tersedia, k.kapasitas, gelap);
              const t = k.kapasitas - k.tersedia;
              return (
                <div key={k.kode_kelas} className={`${kartuBg} border ${n.kartu} rounded-3xl p-4 flex flex-col justify-between gap-2`}>
                  <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <IkonKelas kode={k.kode_kelas} className={`w-10 h-10 shrink-0 ${n.teks}`} />
                      <span className="text-4xl font-bold truncate">{namaKelas(k.kode_kelas)}</span>
                    </div>
                    <span className={`text-sm font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${n.jalur} ${n.teks}`}>
                      {n.label}
                    </span>
                  </div>
                  <div className="flex items-end gap-2 mt-2">
                    <span className="font-bold leading-none" style={{ fontSize: "min(9vh, 4.6vw)" }}>{k.tersedia}</span>
                    <span className={`text-3xl pb-1 ${gelap ? "text-white/60" : "text-slate-500"}`}>/ {k.kapasitas}</span>
                  </div>
                  <div className={`text-xl ${gelap ? "text-white/70" : "text-slate-600"}`}>
                    kosong · terisi {t} · {k.jml_ruang} ruang
                  </div>
                  </div>
                  <div className={`mt-3 h-2.5 rounded-full overflow-hidden ${n.jalur}`}>
                    <div className={`h-full rounded-full ${n.isi}`}
                         style={{ width: `${k.kapasitas ? (t / k.kapasitas) * 100 : 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ringkas per ruang. Di TV tidak ada yang menggulir, jadi kalau ruangnya
              tidak muat semua, daftarnya bergantian halaman sendiri. */}
          <PanelRuang ruang={d?.per_ruang ?? []} gelap={gelap} kartuBg={kartuBg} sisaPx={sisaPx} />
        </section>
      </main>

      {/* Kaki: keterangan warna + teks berjalan */}
      <footer className={`shrink-0 border-t ${gelap ? "border-white/10 bg-black/25" : "border-slate-200 bg-emerald-50"}`}>
        <div className="flex items-center gap-8 px-8 py-2 text-xl">
          {[["bg-emerald-400", "Tersedia"], ["bg-amber-400", "Terbatas"], ["bg-rose-500", "Penuh"]].map(([w, l]) => (
            <span key={l} className={`inline-flex items-center gap-2 ${gelap ? "text-white/70" : "text-slate-600"}`}>
              <span className={`inline-block w-4 h-4 rounded-full ${w}`} aria-hidden="true" />{l}
            </span>
          ))}
          <span className={`ml-auto ${gelap ? "text-white/50" : "text-slate-500"}`}>
            Diperbarui {jamMuat || "—"}
          </span>
        </div>
        <div className={`overflow-hidden py-1.5 border-t ${gelap ? "border-white/5" : "border-slate-200"}`}>
          <div className="whitespace-nowrap animate-marquee text-2xl font-medium px-4">
            {ticker} &nbsp;&nbsp;•&nbsp;&nbsp; {ticker}
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Daftar ruang yang otomatis berganti halaman bila tidak muat sekaligus.
 *  Jumlah per halaman diukur dari tinggi kotak & tinggi satu chip, jadi ikut
 *  menyesuaikan ukuran layar TV apa pun — tidak ada ruang yang tersembunyi. */
function PanelRuang({ ruang, gelap, kartuBg, sisaPx }: {
  ruang: BedRuang[]; gelap: boolean; kartuBg: string; sisaPx: number;
}) {
  const [halaman, setHalaman] = useState(0);

  // Tinggi chip & kepala panel sudah ditentukan kelasnya di bawah, jadi cukup
  // dihitung dari tetapan — tidak perlu mengukur elemen yang mungkin sedang
  // tidak ditampilkan (itu yang dulu bikin panel hilang permanen).
  const TINGGI_CHIP = 46, JARAK = 8, KEPALA = 30, PADDING = 24;
  const kolom = useKolom();
  const ruangIsi = Math.max(0, sisaPx - KEPALA - PADDING);
  const baris = Math.floor((ruangIsi + JARAK) / (TINGGI_CHIP + JARAK));
  const perHalaman = Math.max(kolom, kolom * baris);
  const jmlHalaman = Math.max(1, Math.ceil(ruang.length / perHalaman));

  useEffect(() => {
    if (jmlHalaman <= 1) { setHalaman(0); return; }
    const t = setInterval(() => setHalaman(h => (h + 1) % jmlHalaman), 8000);
    return () => clearInterval(t);
  }, [jmlHalaman]);

  // Tidak cukup untuk satu baris pun → jangan dirender sama sekali, supaya
  // tidak meninggalkan kotak kosong di layar.
  if (ruang.length === 0 || baris < 1) return null;

  const mulai = (halaman % jmlHalaman) * perHalaman;
  const tampil = ruang.slice(mulai, mulai + perHalaman);

  return (
    <div className={`${kartuBg} border ${gelap ? "border-white/10" : "border-slate-200"} rounded-3xl p-3 flex-1 min-h-0 overflow-hidden`}>
      <div className={`flex items-center justify-between mb-1.5 ${gelap ? "text-white/50" : "text-slate-500"}`}>
        <span className="text-base font-bold uppercase tracking-[0.2em]">Per Ruang</span>
        {jmlHalaman > 1 && (
          <span className="flex items-center gap-1.5" aria-label={`Halaman ${(halaman % jmlHalaman) + 1} dari ${jmlHalaman}`}>
            {Array.from({ length: jmlHalaman }).map((_, i) => (
              <span key={i} className={`inline-block w-1.5 h-1.5 rounded-full ${
                i === halaman % jmlHalaman ? (gelap ? "bg-white/80" : "bg-slate-600") : (gelap ? "bg-white/25" : "bg-slate-300")
              }`} />
            ))}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-5 gap-2">
        {tampil.map((r, i) => {
          const n = nada(r.tersedia, r.kapasitas, gelap);
          return (
            <div key={`${r.kd_bangsal}-${mulai + i}`}
                 className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${gelap ? "bg-white/5" : "bg-slate-50"}`}>
              <span className="text-lg font-semibold truncate">{r.nm_bangsal}</span>
              <span className={`text-2xl font-bold tabular-nums shrink-0 ${n.teks}`}>
                {r.tersedia}<span className={`text-sm font-normal ${gelap ? "text-white/40" : "text-slate-400"}`}>/{r.kapasitas}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Jumlah kolom chip mengikuti breakpoint Tailwind yang dipakai di grid. */
function useKolom() {
  const [kolom, setKolom] = useState(6);
  useEffect(() => {
    const hitung = () => setKolom(window.innerWidth >= 1536 ? 6 : window.innerWidth >= 768 ? 5 : 3);
    hitung();
    window.addEventListener("resize", hitung);
    return () => window.removeEventListener("resize", hitung);
  }, []);
  return kolom;
}
