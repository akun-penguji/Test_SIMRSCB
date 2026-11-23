"use client";

// TV Display Antrian Farmasi — full-screen page untuk TV ruang tunggu apotek.
// Panggilan dipicu tombol Penyerahan di DlgDaftarPermintaanResep (Java) yang
// POST ke /api/anjungan/farmasi/call; page ini subscribe via SSE.
//
// URL params (semua opsional):
//   ?title=ANTRIAN+FARMASI      — judul utama (default: nama RS dari setting)
//   ?subtitle=Instalasi+Farmasi — subtitle kecil
//   ?theme=dark|light           — default dark
//   ?tts=on|off                 — TTS Bahasa Indonesia (default on)
//   ?loket=Loket+Farmasi        — nama loket yang disebut TTS (default "loket farmasi")
//   ?ticker=Custom+text         — text scroll di bawah
//   ?youtube=LINK_ATAU_ID       — video YouTube di kiri (terima link utuh
//                                 youtube.com/watch?v=… / youtu.be/… atau ID 11 karakter)
//   ?layout=split|full          — split (default, video kiri kalau ?youtube= di-set)
//
// Pasang di kiosk Windows TV:
//   chrome --kiosk --autoplay-policy=no-user-gesture-required ^
//     http://localhost:3000/display/farmasi

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getDisplayFarmasi, getFarmasiDisplayConfig, getSetting, DisplayFarmasi, FarmasiDisplayConfig, PanggilanFarmasi, SettingRS, FARMASI_STREAM_URL } from "@/lib/api";

const POLL_INTERVAL_MS = 15000; // fallback polling — push utama via SSE
const DEFAULT_MARQUEE =
  "SELAMAT DATANG DI INSTALASI FARMASI — Mohon menunggu nama Anda dipanggil. " +
  "Pastikan identitas obat sesuai sebelum meninggalkan loket. " +
  "Tanyakan kepada petugas apabila ada aturan pakai yang belum jelas. " +
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

// Gelar singkatan Khanza → ucapan TTS
const GELAR_UCAP: Record<string, string> = {
  TN: "Tuan", NY: "Nyonya", AN: "Anak", NN: "Nona", BY: "Bayi",
  SDR: "Saudara", SDRI: "Saudari", H: "Haji", HJ: "Hajah", KH: "Kiai Haji",
};

// Pisahkan gelar depan (bisa bertingkat, mis. "BY. NY. WARSIH") dari nama
function pisahGelar(nama: string): { gelar: string[]; kata: string[] } {
  const words = nama.trim().split(/\s+/);
  const gelar: string[] = [];
  while (words.length > 1 && GELAR_UCAP[words[0].replace(/\./g, "").toUpperCase()]) {
    gelar.push(words.shift()!);
  }
  return { gelar, kata: words };
}

// Title Case: "NALIM" → "Nalim" agar TTS membaca sebagai kata, bukan dieja
// per huruf (nama all-caps 1 kata sering dibaca engine seperti akronim).
function titleCase(s: string): string {
  return s.toLowerCase().replace(/\p{L}[\p{L}']*/gu, w => w.charAt(0).toUpperCase() + w.slice(1));
}

// TTS: gelar dibaca lengkap ("AN." → "Anak"), nama di-Title-Case agar tidak dieja
function namaUntukTTS(nama: string): string {
  const { gelar, kata } = pisahGelar(nama);
  const ucapGelar = gelar.map(g => GELAR_UCAP[g.replace(/\./g, "").toUpperCase()]);
  const kataUcap = kata.map(w => titleCase(w));
  return [...ucapGelar, ...kataUcap].join(" ");
}

// Display: gelar tampil penuh, semua kata nama disensor jadi huruf pertama ("AN. A*** F*** R***")
function sensorNama(nama: string): string {
  const { gelar, kata } = pisahGelar(nama);
  const masked = kata.map(w => (w ? w.charAt(0) + "***" : ""));
  return [...gelar, ...masked].join(" ");
}

// Nomor antrian farmasi = 4 digit terakhir no_resep (20260710RJ0124 → 124)
function nomorAntrian(noResep: string): string {
  const n = parseInt(noResep.slice(-4), 10);
  return isNaN(n) ? noResep : String(n);
}

// Terima link YouTube utuh (watch?v=, youtu.be/, shorts/, embed/) atau ID polos
function youtubeId(input: string): string {
  if (!input) return "";
  if (/^[\w-]{11}$/.test(input)) return input;
  const m = input.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : "";
}

// Angka → terbilang Bahasa Indonesia (agar TTS membaca utuh, tidak dieja per digit)
function terbilang(n: number): string {
  if (isNaN(n)) return "";
  if (n === 0) return "nol";
  if (n < 0) return "minus " + terbilang(-n);
  const sat = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
  if (n < 12) return sat[n];
  if (n < 20) return terbilang(n - 10) + " belas";
  if (n < 100) return terbilang(Math.floor(n / 10)) + " puluh" + (n % 10 ? " " + terbilang(n % 10) : "");
  if (n < 200) return "seratus" + (n % 100 ? " " + terbilang(n % 100) : "");
  if (n < 1000) return terbilang(Math.floor(n / 100)) + " ratus" + (n % 100 ? " " + terbilang(n % 100) : "");
  if (n < 2000) return "seribu" + (n % 1000 ? " " + terbilang(n % 1000) : "");
  if (n < 1000000) return terbilang(Math.floor(n / 1000)) + " ribu" + (n % 1000 ? " " + terbilang(n % 1000) : "");
  return String(n);
}

function ucapkan(nomor: string, nama: string, loket: string, enabled: boolean, racikan?: number) {
  if (!enabled) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const nomorUcap = terbilang(parseInt(nomor, 10)) || nomor; // baca utuh, bukan dieja
  const jenisResep = racikan ? "resep racikan" : "resep non racikan";
  const teks = `Panggilan farmasi. Nomor antrian, ${nomorUcap}. ${jenisResep}. Atas nama, ${namaUntukTTS(nama)}. Obat sudah siap, silakan ambil di ${loket}`;

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

export default function DisplayFarmasiPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 text-white flex items-center justify-center text-2xl">Memuat...</div>}>
      <DisplayInner />
    </Suspense>
  );
}

function DisplayInner() {
  const params = useSearchParams();
  const titleParam    = params.get("title");
  const subtitleParam = params.get("subtitle");
  const themeParam    = params.get("theme") === "light" ? "light" : "dark";
  const ttsEnabled    = params.get("tts") !== "off";
  const layoutMode    = params.get("layout") === "full" ? "full" : "split";

  const [data, setData]       = useState<DisplayFarmasi | null>(null);
  const [setting, setSetting] = useState<SettingRS | null>(null);
  const [cfg, setCfg]         = useState<FarmasiDisplayConfig | null>(null);

  // Prioritas: URL param > pengaturan server (menu Pengaturan) > default
  const loketParam  = params.get("loket") ?? (cfg?.loket?.trim() ? cfg.loket : "loket farmasi");
  const tickerParam = params.get("ticker") ?? (cfg?.ticker?.trim() ? cfg.ticker : DEFAULT_MARQUEE);
  const ytId        = youtubeId(params.get("youtube") ?? cfg?.youtube ?? "");
  const [sseConnected, setSseConnected] = useState(false);
  const [flashing, setFlashing] = useState(false);
  // Optimis: anggap audio langsung aktif (kiosk dengan
  // --autoplay-policy=no-user-gesture-required tidak butuh klik). Overlay
  // klik hanya muncul kalau browser menolak (error "not-allowed").
  const [audioUnlocked, setAudioUnlocked] = useState(true);
  const lastKeyRef = useRef<string>("");
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getSetting().then(r => setSetting(r.data)).catch(() => {});
  }, []);

  // Preload voices (Chrome butuh trigger pertama) + auto-unlock audio:
  // coba utterance senyap saat halaman dibuka; kalau browser menolak
  // ("not-allowed"), baru tampilkan overlay klik. Gesture apa pun
  // (sentuh/tombol) juga langsung meng-unlock sebagai cadangan.
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

  // Polling fallback (recovery jika SSE drop) + ambil daftar awal + config
  // (config ikut di-poll supaya ganti link video dari menu Pengaturan
  // terpakai tanpa reload TV)
  useEffect(() => {
    let stop = false;
    const refresh = async () => {
      try {
        const r = await getDisplayFarmasi();
        if (stop) return;
        setData(r.data);
        const s = r.data.sekarang;
        if (s) lastKeyRef.current = `${s.no_resep}|${s.jam}`;
      } catch { /* skip */ }
      try {
        const c = await getFarmasiDisplayConfig();
        if (!stop) setCfg(c.data);
      } catch { /* skip */ }
    };
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => { stop = true; clearInterval(id); };
  }, []);

  // SSE push real-time — terima panggilan baru, langsung TTS + animasi flash
  useEffect(() => {
    let unmounted = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (unmounted) return;
      es = new EventSource(FARMASI_STREAM_URL);

      es.onopen = () => setSseConnected(true);

      es.onmessage = (ev) => {
        try {
          const evt = JSON.parse(ev.data) as PanggilanFarmasi;

          // Event validasi: pasien masuk daftar "sedang disiapkan" tanpa TTS.
          // Kalau operator batal simpan, polling 15 detik akan mengoreksi.
          if (evt.jenis === "validasi") {
            setData(prev => ({
              sekarang:      prev?.sekarang ?? null,
              riwayat:       prev?.riwayat ?? [],
              menunggu:      (prev?.menunggu ?? 0) + 1,
              menunggu_list: [
                ...(prev?.menunggu_list ?? []).filter(m => m.no_resep !== evt.no_resep),
                evt,
              ].slice(0, 30),
            }));
            return;
          }

          const key = `${evt.no_resep}|${evt.jam}`;
          if (lastKeyRef.current !== key) {
            lastKeyRef.current = key;
            ucapkan(nomorAntrian(evt.no_resep), evt.nama, loketParam, ttsEnabled, evt.racikan);

            // Animasi flash 3 detik
            setFlashing(true);
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            flashTimerRef.current = setTimeout(() => setFlashing(false), 3000);

            setData(prev => {
              const sebelumnya = prev?.sekarang;
              const riwayatBaru = sebelumnya
                ? [sebelumnya, ...(prev?.riwayat ?? [])].slice(0, 4)
                : (prev?.riwayat ?? []);
              return {
                sekarang: evt,
                riwayat:  riwayatBaru,
                menunggu: Math.max((prev?.menunggu ?? 1) - 1, 0),
                menunggu_list: (prev?.menunggu_list ?? []).filter(m => m.no_resep !== evt.no_resep),
              };
            });
          }
        } catch {/* skip parse error */}
      };

      es.onerror = () => {
        setSseConnected(false);
        es?.close();
        es = null;
        // Auto-reconnect 5 detik
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
  }, [ttsEnabled, loketParam]);

  const namaRS   = titleParam ?? `ANTRIAN FARMASI — ${setting?.nama_instansi ?? "Rumah Sakit"}`;
  const alamatRS = subtitleParam ?? setting?.alamat_instansi ?? "";
  const sekarang     = data?.sekarang;
  const riwayat      = data?.riwayat ?? [];
  const menungguList = data?.menunggu_list ?? [];
  const menungguNon     = menungguList.filter(p => !p.racikan);
  const menungguRacikan = menungguList.filter(p => p.racikan);

  // Theme styling
  const isDark = themeParam === "dark";
  const showVideo = layoutMode === "split" && ytId.length > 0;
  const themeBg = isDark
    ? "from-teal-900 via-emerald-800 to-green-900 text-white"
    : "from-blue-50 via-white to-blue-50 text-slate-900";
  const cardBg = isDark ? "bg-white/10 border-white/15" : "bg-white border-slate-300";

  // Unlock audio — Web Speech API butuh user gesture pertama di sebagian browser
  const unlockAudio = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
    setAudioUnlocked(true);
  };

  // Panel daftar tunggu (dua kolom Non-Racikan & Racikan) — dipakai di bawah video / di kanan
  const menungguCols = (
    <div className="grid grid-cols-2 gap-3 min-h-0 flex-1">
      {([
        { judul: "Non-Racikan", list: menungguNon, warna: isDark ? "text-sky-300" : "text-sky-700", chip: "bg-sky-600" },
        { judul: "Racikan", list: menungguRacikan, warna: isDark ? "text-amber-300" : "text-amber-700", chip: "bg-amber-500" },
      ] as const).map((col, ci) => (
        <div key={ci} className={`${cardBg} border rounded-2xl p-4 flex flex-col min-h-0`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-bold uppercase tracking-wide ${col.warna}`}>Sedang Disiapkan — {col.judul}</span>
            <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 text-white ${col.chip}`}>{col.list.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {col.list.length === 0 ? (
              <div className={`${isDark ? "text-white/40" : "text-slate-400"} text-sm italic`}>Tidak ada</div>
            ) : (
              col.list.map((p, i) => (
                <div key={i} className={`flex items-center gap-3 ${isDark ? "bg-white/5" : "bg-slate-50"} rounded-lg px-3 py-2`}>
                  <span className="text-3xl font-bold font-mono shrink-0">{nomorAntrian(p.no_resep)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xl font-bold truncate">{sensorNama(p.nama)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
  const riwayatCol = (
    <div className={`${cardBg} border rounded-2xl p-4 flex flex-col min-h-0`}>
      <div className={`text-xs uppercase tracking-widest ${isDark ? "text-white/70" : "text-slate-600"} mb-2`}>Panggilan Sebelumnya</div>
      <div className="flex-1 overflow-y-auto space-y-1.5">
        {riwayat.length === 0 ? (
          <div className={`${isDark ? "text-white/40" : "text-slate-400"} text-sm italic`}>Belum ada panggilan</div>
        ) : (
          riwayat.map((p, i) => (
            <div key={i} className={`${isDark ? "bg-white/5" : "bg-slate-50"} rounded-lg px-3 py-2`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold font-mono shrink-0">{nomorAntrian(p.no_resep)}</span>
                <span className="text-lg font-bold flex-1 truncate">{sensorNama(p.nama)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className={`h-screen w-screen bg-gradient-to-br ${themeBg} flex flex-col overflow-hidden select-none`}>

      {/* Header */}
      <header className={`flex items-center justify-between px-8 py-3 border-b ${isDark ? "border-white/10" : "border-slate-200"} shrink-0`}>
        <div>
          <h1 className="text-2xl font-bold">{namaRS}</h1>
          {alamatRS && <p className={`text-xs ${isDark ? "text-white/60" : "text-slate-600"}`}>{alamatRS}</p>}
        </div>
        <div className="flex items-center gap-4">
          {/* Status indicator real-time */}
          <div className="flex items-center gap-2 text-xs opacity-70">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${sseConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`}></span>
            <span>{sseConnected ? "Real-time" : "Reconnecting..."}</span>
          </div>
          <Clock />
        </div>
      </header>

      {/* Audio unlock prompt — kalau TTS aktif tapi belum di-click */}
      {ttsEnabled && !audioUnlocked && (
        <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center cursor-pointer"
             onClick={unlockAudio}>
          <div className="text-center text-white">
            <div className="text-8xl mb-4">🔊</div>
            <p className="text-3xl font-bold mb-2">Sentuh / klik untuk aktifkan suara</p>
            <p className="text-lg opacity-80">Sistem akan memanggil nama pasien via suara</p>
          </div>
        </div>
      )}

      {/* Body */}
      <main className={`flex-1 grid ${showVideo ? "grid-cols-5" : "grid-cols-1"} min-h-0`}>
        {/* Video kiri kalau ?youtube= di-set */}
        {showVideo && (
          <section className="col-span-3 flex flex-col min-h-0 gap-3 pb-3">
            {/* Video setengah tinggi */}
            <div className="relative bg-black shrink-0" style={{ height: "50%" }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&controls=0&modestbranding=1&playsinline=1&rel=0&playlist=${ytId}`}
                title="Video Display"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
            {/* Daftar tunggu di bawah video */}
            <div className="flex-1 min-h-0 px-3 flex flex-col">{menungguCols}</div>
          </section>
        )}

        {/* Panel antrian */}
        <section className={showVideo
          ? `col-span-2 flex flex-col gap-3 p-4 min-h-0 ${isDark ? "bg-black/30 backdrop-blur" : "bg-blue-100/50"}`
          : "flex flex-col items-center justify-center p-6 gap-6 min-h-0"}>

        {/* Pasien sedang dipanggil */}
        <div className={`${isDark ? "bg-white text-slate-800" : "bg-emerald-600 text-white"} rounded-2xl shadow-2xl ${showVideo ? "p-5" : "p-12"} text-center relative overflow-hidden w-full ${!showVideo ? "max-w-5xl" : ""}`}>
          {/* Flash overlay */}
          {flashing && (
            <span className="absolute inset-0 bg-emerald-400/40 animate-pulse pointer-events-none"></span>
          )}
          <div className={`text-sm uppercase tracking-widest ${isDark ? "text-slate-500" : "text-emerald-100"}`}>Obat Siap — Nomor Antrian</div>
          {sekarang && (
            <div className={`inline-block text-lg font-bold rounded-full px-4 py-1 mt-1 ${sekarang.racikan ? "bg-amber-500 text-white" : "bg-sky-600 text-white"}`}>
              {sekarang.racikan ? "RACIKAN" : "NON-RACIKAN"}
            </div>
          )}
          <div className={`font-black ${isDark ? "text-emerald-700" : "text-white"} leading-none my-2 font-mono`}
               style={{ fontSize: showVideo ? "min(16vh, 9vw)" : "min(28vh, 20vw)" }}>
            {sekarang ? nomorAntrian(sekarang.no_resep) : "—"}
          </div>
          <div className={`font-bold ${isDark ? "text-slate-700" : "text-emerald-50"} break-words`}
               style={{ fontSize: showVideo ? "min(4vh, 2.2vw)" : "min(6vh, 4.5vw)" }}>
            {sekarang ? sensorNama(sekarang.nama) : "Menunggu panggilan..."}
          </div>
          <div className={`${showVideo ? "text-sm" : "text-xl"} font-semibold mt-2 ${isDark ? "text-slate-500" : "text-emerald-100"}`}>
            {sekarang ? `No. RM ${sekarang.no_rkm_medis} • Resep ${sekarang.no_resep}` : ""}
          </div>
        </div>

        {showVideo ? (
          /* Ada video: daftar tunggu sudah di bawah video → kanan cukup riwayat */
          <div className="w-full flex-1 min-h-0 flex flex-col">
            {riwayatCol}
          </div>
        ) : (
          <div className="w-full max-w-5xl grid grid-cols-3 gap-4 flex-1 min-h-0">
            <div className="col-span-2 flex flex-col min-h-0">{menungguCols}</div>
            {riwayatCol}
          </div>
        )}
        </section>
      </main>

      {/* Marquee footer */}
      <footer className={`shrink-0 ${isDark ? "bg-emerald-950/80 border-white/10 text-white" : "bg-emerald-100 border-slate-200 text-emerald-900"} border-t py-3 overflow-hidden`}>
        <div className="whitespace-nowrap animate-marquee text-lg font-medium">
          {tickerParam} &nbsp;&nbsp;•&nbsp;&nbsp; {tickerParam}
        </div>
      </footer>

    </div>
  );
}
