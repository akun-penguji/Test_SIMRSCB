"use client";

// TV Display Antrian Masuk Poli — full-screen untuk TV ruang tunggu.
// Panggilan dipicu menu "Antrian Masuk Poli" di DlgKasirRalan (Java) yang
// POST ke /api/anjungan/poli/call; page ini subscribe SSE dan hanya bereaksi
// pada event dengan kd_poli yang termasuk di display ini.
//
// SATU DISPLAY BISA >1 POLI. Dua cara:
//  1. Mapping terpusat (Pengaturan → Display Antrian Poli): buat display,
//     pilih poli-polinya, lalu buka /display/poli/<id-display>.
//  2. Langsung via URL: kode poli dipisah koma.
//       /display/poli/ANA          → 1 display 1 poli
//       /display/poli/ANA,UMUM,INT → 1 display 3 poli (antrian digabung)
//     (kd_poli sesuai tabel poliklinik Khanza)
//
// URL params (semua opsional):
//   ?title=…            — judul utama (default: ANTRIAN <nama poli-poli>)
//   ?theme=dark|light   — default dark
//   ?tts=on|off         — TTS Bahasa Indonesia (default on)
//   ?ticker=…           — text scroll di bawah
//   ?youtube=LINK/ID    — video YouTube di kiri
//   ?layout=split|full  — split (default)
//
// Pasang di kiosk Windows TV:
//   chrome --kiosk --autoplay-policy=no-user-gesture-required ^
//     http://localhost:3000/display/poli/ANA,UMUM

import { use, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getDisplayPoli, getPoliDisplayMap, getSetting, getJadwalDokterDisplay, DisplayPoli, PanggilanPoli, SettingRS, JadwalDokterRow, POLI_STREAM_URL } from "@/lib/api";

const POLL_INTERVAL_MS = 15000; // fallback polling — push utama via SSE
const DEFAULT_MARQUEE =
  "SELAMAT DATANG — Mohon menunggu nomor antrian Anda dipanggil masuk ke ruang periksa. " +
  "Siapkan kartu berobat dan dokumen yang diperlukan. " +
  "Terima kasih atas kepercayaan Anda.";

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const jam = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const tgl = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="text-right">
      <div className="text-3xl font-mono font-bold text-white tracking-widest">{jam}</div>
      <div className="text-sm text-white/80 capitalize">{tgl}</div>
    </div>
  );
}

// ── Slideshow Jadwal Praktek Dokter (pengganti video di panel kiri) ──────────
const HARI_URUT = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU", "AKHAD"];
const HARI_LABEL: Record<string, string> = {
  SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu", AKHAD: "Minggu",
};
function hariIniKhanza(): string {
  return ["AKHAD", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"][new Date().getDay()];
}
type SlideDokter = { nm_dokter: string; jadwal: { hari: string; jam: string }[] };
type SlidePoli = { nm_poli: string; dokter: SlideDokter[] };

function buildSlides(rows: JadwalDokterRow[]): SlidePoli[] {
  const byPoli = new Map<string, Map<string, { hari: string; jam: string }[]>>();
  for (const r of rows) {
    if (!byPoli.has(r.nm_poli)) byPoli.set(r.nm_poli, new Map());
    const dk = byPoli.get(r.nm_poli)!;
    if (!dk.has(r.nm_dokter)) dk.set(r.nm_dokter, []);
    const jam = r.jam_mulai && r.jam_selesai ? `${r.jam_mulai}–${r.jam_selesai}` : "—";
    dk.get(r.nm_dokter)!.push({ hari: r.hari_kerja, jam });
  }
  const slides: SlidePoli[] = [];
  for (const [nm_poli, dk] of byPoli) {
    const dokter: SlideDokter[] = [];
    for (const [nm_dokter, js] of dk) {
      js.sort((a, b) => HARI_URUT.indexOf(a.hari) - HARI_URUT.indexOf(b.hari));
      dokter.push({ nm_dokter, jadwal: js });
    }
    slides.push({ nm_poli, dokter });
  }
  return slides;
}

function JadwalSlideshow({ rows, isDark }: { rows: JadwalDokterRow[]; isDark: boolean }) {
  const slides = buildSlides(rows);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), 12000);
    return () => clearInterval(t);
  }, [slides.length]);
  if (slides.length === 0) return null;
  const cur = slides[Math.min(idx, slides.length - 1)];
  const hariIni = hariIniKhanza();
  return (
    <div className="absolute inset-0 flex flex-col p-6 text-white overflow-hidden">
      <div className="text-center shrink-0">
        <div className="text-3xl font-extrabold tracking-wide">JADWAL PRAKTEK DOKTER</div>
        <div className="mt-2 inline-block px-5 py-1.5 rounded-full bg-white/20 text-2xl font-bold">{cur.nm_poli}</div>
      </div>
      <div className="flex-1 mt-5 overflow-hidden">
        <div className="grid gap-3">
          {cur.dokter.slice(0, 6).map((d, i) => (
            <div key={i} className="bg-white/10 rounded-2xl px-5 py-3 border border-white/15">
              <div className="text-2xl font-bold mb-1.5">{d.nm_dokter}</div>
              <div className="flex flex-wrap gap-2">
                {d.jadwal.map((j, k) => {
                  const today = j.hari === hariIni;
                  return (
                    <span key={k} className={`text-lg font-semibold rounded-lg px-3 py-1 ${today ? "bg-amber-400 text-slate-900" : "bg-white/15 text-white"}`}>
                      {HARI_LABEL[j.hari] ?? j.hari} {j.jam}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="flex justify-center gap-2 shrink-0 pt-2">
          {slides.map((_, i) => (
            <span key={i} className={`w-2.5 h-2.5 rounded-full ${i === idx ? "bg-amber-400" : "bg-white/30"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// Gelar singkatan Khanza → ucapan TTS
const GELAR_UCAP: Record<string, string> = {
  TN: "Tuan", NY: "Nyonya", AN: "Anak", NN: "Nona", BY: "Bayi",
  SDR: "Saudara", SDRI: "Saudari", H: "Haji", HJ: "Hajah", KH: "Kiai Haji",
};

function pisahGelar(nama: string): { gelar: string[]; kata: string[] } {
  const words = nama.trim().split(/\s+/);
  const gelar: string[] = [];
  while (words.length > 1 && GELAR_UCAP[words[0].replace(/\./g, "").toUpperCase()]) {
    gelar.push(words.shift()!);
  }
  return { gelar, kata: words };
}

// Nama di Khanza tersimpan HURUF KAPITAL. TTS membaca satu kata kapital sebagai
// akronim (dieja huruf per huruf). Ubah ke Title Case agar dibaca sebagai kata.
function titleCase(w: string): string {
  return w.replace(/[A-Za-zÀ-ÿ]+/g, s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
}
function namaUntukTTS(nama: string): string {
  const { gelar, kata } = pisahGelar(nama);
  const ucapGelar = gelar.map(g => GELAR_UCAP[g.replace(/\./g, "").toUpperCase()]);
  return [...ucapGelar, ...kata.map(titleCase)].join(" ");
}

// Display: gelar tampil, tiap kata nama hanya huruf depan ("AN. A*** F*** R***")
function sensorNama(nama: string): string {
  const { gelar, kata } = pisahGelar(nama);
  const masked = kata.map(w => (w ? w.charAt(0) + "***" : w));
  return [...gelar, ...masked].join(" ");
}

// Nomor urut reg_periksa ("005" → 5)
function nomorUrut(noReg: string): string {
  const n = parseInt(noReg, 10);
  return isNaN(n) ? noReg : String(n);
}

// Terima link YouTube utuh atau ID polos
function youtubeId(input: string): string {
  if (!input) return "";
  if (/^[\w-]{11}$/.test(input)) return input;
  const m = input.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : "";
}

function ucapkan(nomor: string, nama: string, poli: string, enabled: boolean) {
  if (!enabled) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const tujuan = poli?.trim() ? poli : "ruang periksa";
  const teks = `Nomor antrian, ${nomor}. Atas nama, ${namaUntukTTS(nama)}. Silakan masuk ke ${tujuan}`;

  // Bersihkan antrean suara, ucapkan SEKALI saja.
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(teks);
  u.lang = "id-ID";
  u.rate = 0.9;
  u.pitch = 1.0;
  u.volume = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const id = voices.find(v => v.lang.startsWith("id"));
  if (id) u.voice = id;
  window.speechSynthesis.speak(u);
}

export default function DisplayPoliPage({ params }: { params: Promise<{ kd_poli: string }> }) {
  const { kd_poli } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 text-white flex items-center justify-center text-2xl">Memuat...</div>}>
      <DisplayInner segment={decodeURIComponent(kd_poli)} />
    </Suspense>
  );
}

function DisplayInner({ segment }: { segment: string }) {
  // Segmen bisa: (a) id display dari mapping Pengaturan, atau
  // (b) daftar kode poli dipisah koma (dipakai bila tak ada mapping cocok).
  const segmentCodes = segment.split(",").map(s => s.trim()).filter(Boolean);
  const [poliCodes, setPoliCodes] = useState<string[]>(segmentCodes);
  // youtube/ticker dari mapping (dipakai bila URL param tidak set)
  const [mapYoutube, setMapYoutube] = useState<string>("");
  const [mapTicker, setMapTicker]   = useState<string>("");
  const multi = poliCodes.length > 1;
  const codesKey = poliCodes.join(",");
  const params = useSearchParams();
  const titleParam  = params.get("title");
  const themeParam  = params.get("theme") === "light" ? "light" : "dark";
  const ttsEnabled  = params.get("tts") !== "off";
  // Prioritas: URL param > mapping Pengaturan > default
  const tickerParam = params.get("ticker") ?? (mapTicker.trim() ? mapTicker : DEFAULT_MARQUEE);
  const ytId        = youtubeId(params.get("youtube") ?? mapYoutube ?? "");
  const layoutMode  = params.get("layout") === "full" ? "full" : "split";

  // Hasil per kode poli (key = kd_poli)
  const [results, setResults] = useState<Record<string, DisplayPoli>>({});
  const [setting, setSetting] = useState<SettingRS | null>(null);
  const [jadwal, setJadwal] = useState<JadwalDokterRow[]>([]);
  const [sekarang, setSekarang] = useState<{ no_reg: string; nama: string; no_rkm_medis: string; nm_poli: string } | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(true);
  const lastKeyRef = useRef<string>("");
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getSetting().then(r => setSetting(r.data)).catch(() => {});
  }, []);

  // Jadwal praktek dokter untuk slideshow panel kiri (refresh tiap 10 menit).
  useEffect(() => {
    const load = () => getJadwalDokterDisplay().then(r => setJadwal(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 600000);
    return () => clearInterval(t);
  }, []);

  // Resolve segmen terhadap mapping display (Pengaturan). Kalau segmen cocok
  // dengan id sebuah display, pakai daftar poli + youtube/ticker-nya. Kalau
  // tidak, biarkan segmen diperlakukan sebagai daftar kode poli langsung.
  useEffect(() => {
    let stop = false;
    getPoliDisplayMap()
      .then(r => {
        if (stop) return;
        const entry = r.data.find(d => d.id === segment);
        if (entry && Array.isArray(entry.poli) && entry.poli.length > 0) {
          setPoliCodes(entry.poli);
          setMapYoutube(entry.youtube ?? "");
          setMapTicker(entry.ticker ?? "");
        }
      })
      .catch(() => {});
    return () => { stop = true; };
  }, [segment]);

  // Preload voices + auto-unlock audio (overlay hanya bila browser menolak)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.getVoices();
    if (!ttsEnabled) return;

    const test = new SpeechSynthesisUtterance(" ");
    test.volume = 0;
    test.onerror = (e: SpeechSynthesisErrorEvent) => {
      if (e.error === "not-allowed") setAudioUnlocked(false);
    };
    window.speechSynthesis.speak(test);

    const gestureUnlock = () => {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
      setAudioUnlocked(true);
    };
    window.addEventListener("pointerdown", gestureUnlock, { once: true });
    window.addEventListener("keydown", gestureUnlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", gestureUnlock);
      window.removeEventListener("keydown", gestureUnlock);
    };
  }, [ttsEnabled]);

  // Polling fallback + data awal (satu request per kode poli)
  useEffect(() => {
    let stop = false;
    const refresh = async () => {
      const settled = await Promise.allSettled(poliCodes.map(c => getDisplayPoli(c)));
      if (stop) return;
      const next: Record<string, DisplayPoli> = {};
      settled.forEach((s, i) => {
        if (s.status === "fulfilled") next[poliCodes[i]] = s.value.data;
      });
      setResults(next);
      // Seed "sekarang" awal dari poli pertama yang punya panggilan aktif
      setSekarang(prev => {
        if (prev) return prev;
        for (const c of poliCodes) {
          const d = next[c];
          if (d?.sekarang) return { ...d.sekarang, nm_poli: d.nm_poli };
        }
        return prev;
      });
    };
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => { stop = true; clearInterval(id); };
  }, [codesKey]);

  // SSE push real-time — hanya bereaksi pada event poli ini
  useEffect(() => {
    let unmounted = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (unmounted) return;
      es = new EventSource(POLI_STREAM_URL);

      es.onopen = () => setSseConnected(true);

      es.onmessage = (ev) => {
        try {
          const evt = JSON.parse(ev.data) as PanggilanPoli;
          // Hanya bereaksi pada poli yang termasuk display ini
          if (!poliCodes.includes(evt.kd_poli)) return;

          const key = `${evt.no_rawat}|${evt.jam}`;
          if (lastKeyRef.current !== key) {
            lastKeyRef.current = key;
            ucapkan(nomorUrut(evt.no_reg), evt.nama, evt.nm_poli, ttsEnabled);

            setFlashing(true);
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            flashTimerRef.current = setTimeout(() => setFlashing(false), 3000);

            setSekarang({ no_reg: evt.no_reg, nama: evt.nama, no_rkm_medis: evt.no_rkm_medis, nm_poli: evt.nm_poli });
            // Hapus pasien dari daftar menunggu poli terkait
            setResults(prev => {
              const d = prev[evt.kd_poli];
              if (!d) return prev;
              return {
                ...prev,
                [evt.kd_poli]: {
                  ...d,
                  menunggu: Math.max(d.menunggu - 1, 0),
                  menunggu_list: d.menunggu_list.filter(m => m.no_rawat !== evt.no_rawat),
                },
              };
            });
          }
        } catch {/* skip parse error */}
      };

      es.onerror = () => {
        setSseConnected(false);
        es?.close();
        es = null;
        if (!unmounted) {
          reconnectTimer = setTimeout(connect, 5000);
        }
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [ttsEnabled, codesKey]);

  // Nama poli-poli (urut sesuai codes), gabung untuk judul
  const namaPoliList = poliCodes.map(c => results[c]?.nm_poli || c);
  const namaPoli   = namaPoliList.join(" & ");
  // Judul: pakai param bila ada; kalau poli banyak (>3) ringkas jadi generik
  // supaya header tidak penuh; selebihnya sebut nama poli-nya.
  const judul = titleParam
    ?? (poliCodes.length > 3 ? "ANTRIAN POLIKLINIK RAWAT JALAN" : `ANTRIAN ${namaPoli.toUpperCase()}`);
  const alamatRS   = setting?.nama_instansi ?? "";
  // Daftar menunggu gabungan lintas poli (bawa nm_poli untuk badge saat multi)
  const menungguList = poliCodes.flatMap(c => {
    const d = results[c];
    if (!d) return [];
    return d.menunggu_list.map(m => ({ ...m, nm_poli: d.nm_poli }));
  });
  const totalMenunggu = poliCodes.reduce((sum, c) => sum + (results[c]?.menunggu ?? 0), 0);

  const isDark = themeParam === "dark";
  // Panel kiri: slideshow Jadwal Praktek Dokter (utama), video YouTube (fallback bila jadwal kosong).
  const showSlide = layoutMode === "split" && jadwal.length > 0;
  const showVideo = layoutMode === "split" && jadwal.length === 0 && ytId.length > 0;
  const showLeft = showSlide || showVideo;
  const themeBg = isDark
    ? "from-sky-900 via-blue-800 to-indigo-900 text-white"
    : "from-blue-50 via-white to-blue-50 text-slate-900";
  const cardBg = isDark ? "bg-white/10 border-white/15" : "bg-white border-slate-300";

  const unlockAudio = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
    setAudioUnlocked(true);
  };

  return (
    <div className={`h-screen w-screen bg-gradient-to-br ${themeBg} flex flex-col overflow-hidden select-none`}>

      {/* Header */}
      <header className={`flex items-center justify-between px-8 py-3 border-b ${isDark ? "border-white/10" : "border-slate-200"} shrink-0`}>
        <div>
          <h1 className="text-2xl font-bold">{judul}</h1>
          {alamatRS && <p className={`text-xs ${isDark ? "text-white/60" : "text-slate-600"}`}>{alamatRS}</p>}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs opacity-70">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${sseConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`}></span>
            <span>{sseConnected ? "Real-time" : "Reconnecting..."}</span>
          </div>
          <Clock />
        </div>
      </header>

      {/* Audio unlock prompt */}
      {ttsEnabled && !audioUnlocked && (
        <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center cursor-pointer"
             onClick={unlockAudio}>
          <div className="text-center text-white">
            <div className="text-8xl mb-4">🔊</div>
            <p className="text-3xl font-bold mb-2">Sentuh / klik untuk aktifkan suara</p>
            <p className="text-lg opacity-80">Sistem akan memanggil nomor antrian via suara</p>
          </div>
        </div>
      )}

      {/* Body */}
      <main className={`flex-1 grid ${showLeft ? "grid-cols-5" : "grid-cols-1"} min-h-0`}>
        {showSlide ? (
          <section className="col-span-3 relative bg-gradient-to-br from-sky-800 via-blue-800 to-indigo-900">
            <JadwalSlideshow rows={jadwal} isDark={isDark} />
          </section>
        ) : showVideo && (
          <section className="col-span-3 bg-black relative">
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&controls=0&modestbranding=1&playsinline=1&rel=0&playlist=${ytId}`}
              title="Video Display"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </section>
        )}

        <section className={showLeft
          ? `col-span-2 flex flex-col gap-3 p-4 min-h-0 ${isDark ? "bg-black/30 backdrop-blur" : "bg-blue-100/50"}`
          : "flex flex-col items-center justify-center p-6 gap-6 min-h-0"}>

        {/* Pasien sedang dipanggil masuk */}
        <div className={`${isDark ? "bg-white text-slate-800" : "bg-blue-600 text-white"} rounded-2xl shadow-2xl ${showLeft ? "p-5" : "p-12"} text-center relative overflow-hidden w-full ${!showLeft ? "max-w-5xl" : ""}`}>
          {flashing && (
            <span className="absolute inset-0 bg-sky-400/40 animate-pulse pointer-events-none"></span>
          )}
          <div className={`text-sm uppercase tracking-widest ${isDark ? "text-slate-500" : "text-blue-100"}`}>Silakan Masuk — Nomor Antrian</div>
          <div className={`font-black ${isDark ? "text-blue-700" : "text-white"} leading-none my-2 font-mono`}
               style={{ fontSize: showLeft ? "min(16vh, 9vw)" : "min(28vh, 20vw)" }}>
            {sekarang ? nomorUrut(sekarang.no_reg) : "—"}
          </div>
          <div className={`font-bold ${isDark ? "text-slate-700" : "text-blue-50"} break-words`}
               style={{ fontSize: showLeft ? "min(4vh, 2.2vw)" : "min(6vh, 4.5vw)" }}>
            {sekarang ? sensorNama(sekarang.nama) : "Menunggu panggilan..."}
          </div>
          <div className={`${showLeft ? "text-sm" : "text-xl"} font-semibold mt-2 ${isDark ? "text-slate-500" : "text-blue-100"}`}>
            {sekarang ? `${multi ? sekarang.nm_poli + " • " : ""}No. RM ${sekarang.no_rkm_medis}` : ""}
          </div>
        </div>

        {/* Daftar menunggu */}
        <div className={`${cardBg} border rounded-2xl p-4 w-full ${!showLeft ? "max-w-5xl" : ""} flex-1 flex flex-col min-h-0`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs uppercase tracking-widest ${isDark ? "text-white/70" : "text-slate-600"}`}>Menunggu Panggilan</span>
            <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${isDark ? "bg-white/15" : "bg-slate-200"}`}>{totalMenunggu}</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {menungguList.length === 0 ? (
              <div className={`${isDark ? "text-white/40" : "text-slate-400"} text-sm italic`}>Tidak ada antrian menunggu</div>
            ) : (
              menungguList.map((p, i) => (
                <div key={i} className={`flex items-center justify-between gap-3 ${isDark ? "bg-white/5" : "bg-slate-50"} rounded-lg px-4 py-2`}>
                  <span className="text-3xl font-bold font-mono shrink-0">{nomorUrut(p.no_reg)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-2xl font-bold truncate">{sensorNama(p.nama)}</div>
                    {multi && <div className={`text-xs ${isDark ? "text-white/60" : "text-slate-500"} truncate`}>{p.nm_poli}</div>}
                  </div>
                  <span className={`text-sm font-mono shrink-0 ${isDark ? "text-white/70" : "text-slate-600"}`}>{p.no_rkm_medis}</span>
                </div>
              ))
            )}
          </div>
        </div>
        </section>
      </main>

      {/* Marquee footer */}
      <footer className={`shrink-0 ${isDark ? "bg-blue-950/80 border-white/10 text-white" : "bg-blue-100 border-slate-200 text-blue-900"} border-t py-3 overflow-hidden`}>
        <div className="whitespace-nowrap animate-marquee text-lg font-medium">
          {tickerParam} &nbsp;&nbsp;•&nbsp;&nbsp; {tickerParam}
        </div>
      </footer>

    </div>
  );
}
