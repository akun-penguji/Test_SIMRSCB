"use client";

// TV Display Antrian — full-screen page untuk dipasang di TV ruang tunggu.
//
// URL params (semua opsional):
//   ?title=ANTRIAN+PENDAFTARAN   — judul utama (default: nama RS dari setting)
//   ?subtitle=Loket+Pendaftaran  — subtitle kecil (default: alamat RS)
//   ?theme=dark|light            — default dark (hijau RSUD)
//   ?tts=on|off                  — TTS Bahasa Indonesia (default on)
//   ?ticker=Custom+text          — running text di bawah (kalau kosong, pakai default)
//   ?youtube=VIDEO_ID            — video YouTube di kiri (kalau kosong, panel antrian full-width)
//   ?layout=split|full           — split (default) atau full (panel saja, tanpa video)
//
// Pasang di kiosk Windows TV:
//   chrome --kiosk --autoplay-policy=no-user-gesture-required ^
//     http://localhost:3088/display?youtube=VIDEO_ID&title=ANTRIAN+PENDAFTARAN

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getDisplayAntrian, getSetting, getPendaftaranDisplayConfig, DisplayAntrian, SettingRS, PendaftaranDisplayConfig, DISPLAY_STREAM_URL } from "@/lib/api";

// Terima link YouTube utuh (youtube.com/watch?v=… / youtu.be/… / embed/…) atau ID 11 char.
function extractYoutubeId(input: string): string {
  if (!input) return "";
  if (/^[\w-]{11}$/.test(input)) return input;
  const m = input.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : "";
}

/** Label pendek layanan per prefix, dipakai di rincian "Sisa Menunggu". */
const NAMA_LAYANAN: Record<string, string> = {
  A: "Pasien Baru",
  B: "Rawat Jalan",
  C: "Poli Ranap",
};

const POLL_INTERVAL_MS = 15000; // fallback polling — push utama via SSE
const DEFAULT_MARQUEE =
  "SELAMAT DATANG DI RSUD CABANGBUNGIN — Mohon menunggu panggilan nomor antrian Anda dengan tertib. " +
  "Perhatikan nomor & loket yang dipanggil di layar. Jaga kebersihan dan ikuti arahan petugas. " +
  "Terima kasih atas kepercayaan Anda.";

// Keterangan loket (bawah layar). Default sesuai loket pendaftaran RSUD; bisa dioverride
// via param ?loket=1:Pendaftaran Pasien Baru|2:...|3:...
const DEFAULT_LOKET: { no: string; ket: string }[] = [
  { no: "1", ket: "Pendaftaran Pasien Baru" },
  { no: "2", ket: "Pendaftaran Pasien Rawat Jalan" },
  { no: "3", ket: "Pendaftaran Pasien Poli Rawat Inap" },
];
function parseLoket(raw: string | null): { no: string; ket: string }[] {
  if (!raw) return DEFAULT_LOKET;
  const items = raw.split("|").map(s => {
    const [no, ...rest] = s.split(":");
    return { no: (no ?? "").trim(), ket: rest.join(":").trim() };
  }).filter(x => x.no && x.ket);
  return items.length ? items : DEFAULT_LOKET;
}

function Clock({ light }: { light: boolean }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const jam = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const tgl = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="text-right leading-tight">
      <div className={`text-4xl font-mono font-bold tracking-widest tabular-nums ${light ? "text-slate-800" : "text-white"}`}>{jam}</div>
      <div className={`text-sm capitalize ${light ? "text-slate-500" : "text-emerald-100/80"}`}>{tgl}</div>
    </div>
  );
}

// Logo RSUD Cabangbungin (dari /public/logo-rs.png). Fallback ke SVG palang medis
// kalau file logo gagal dimuat.
function LogoRS({ light }: { light: boolean }) {
  const [err, setErr] = useState(false);
  if (!err) {
    return (
      <img src="/logo-rs.png" alt="Logo RSUD Cabangbungin"
        onError={() => setErr(true)}
        className={`object-contain shrink-0 ${light ? "" : "drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]"}`}
        style={{ height: 52, width: 52 }} />
    );
  }
  const stroke = light ? "#0f5132" : "#d1fae5";
  return (
    <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" aria-hidden="true" className="shrink-0">
      <path d="M12 2.6c2.2 1.8 4.6 2.5 7 2.5 0 6.7-2.4 11.4-7 13.9C7.4 16.5 5 11.8 5 5.1c2.4 0 4.8-.7 7-2.5Z" />
      <path d="M12 8.2v5.2M9.4 10.8h5.2" strokeWidth="1.8" />
    </svg>
  );
}

/**
 * Format nomor tampil: prefix + nomor 3 digit, mis. "A001".
 * Data lama tanpa prefix tetap tampil apa adanya.
 */
function formatNomor(prefix: string | undefined, nomor: string): string {
  if (!nomor) return "";
  const n = Number(nomor);
  const angka = Number.isFinite(n) ? String(n).padStart(3, "0") : nomor;
  return `${(prefix ?? "").trim()}${angka}`;
}

/** Status suara terakhir, ditampilkan sebagai badge kecil di header. */
export type StatusSuara = "belum" | "ok" | "tanpa-suara-id" | "bisu";

/**
 * Pilih suara terbaik yang BENAR-BENAR tersedia di mesin ini.
 *
 * Penting: jangan pernah memasang `lang = "id-ID"` kalau tidak ada suara
 * Indonesia terpasang. PC Windows standar hanya punya SAPI berbahasa Inggris
 * (David/Zira); suara "Google Bahasa Indonesia" milik Chrome butuh internet,
 * yang sering tidak ada di TV ruang tunggu. Utterance ber-lang id-ID tanpa
 * suara padanan umumnya DIAM TANPA ERROR — bisu yang tidak meninggalkan jejak.
 */
function pilihSuara(): { voice: SpeechSynthesisVoice | null; adaIndonesia: boolean } {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return { voice: null, adaIndonesia: false };
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return { voice: null, adaIndonesia: false };
  const id = voices.find(v => v.lang.toLowerCase().startsWith("id"));
  if (id) return { voice: id, adaIndonesia: true };
  // Tidak ada suara Indonesia — pakai suara bawaan sistem. Teks Indonesia yang
  // dibaca suara Inggris masih terpahami ("Nomor antrian, A, satu"), dan itu
  // jauh lebih berguna daripada tidak bersuara sama sekali.
  return { voice: voices.find(v => v.default) ?? voices[0], adaIndonesia: false };
}

/** Nada pengganti bila TTS tidak tersedia, supaya panggilan tetap terdengar. */
function bunyikanNada() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const mulai = ctx.currentTime;
    [880, 1180].forEach((hz, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = hz;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, mulai + i * 0.26);
      gain.gain.exponentialRampToValueAtTime(0.35, mulai + i * 0.26 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, mulai + i * 0.26 + 0.24);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(mulai + i * 0.26);
      osc.stop(mulai + i * 0.26 + 0.26);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {/* audio tidak tersedia — sudah tidak ada yang bisa dilakukan */}
}

function ucapkan(
  prefix: string | undefined, nomor: string, loket: string, enabled: boolean,
  lapor?: (s: StatusSuara) => void,
) {
  if (!enabled) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    bunyikanNada();
    lapor?.("bisu");
    return;
  }

  // Dieja huruf-per-huruf, tapi angka TANPA nol depan supaya tidak terdengar
  // "A kosong kosong satu" — cukup "A, satu".
  const huruf = (prefix ?? "").trim();
  const angka = String(Number(nomor));
  const ejaan = (huruf ? huruf + " , " : "") + angka.split("").join(" ");
  const teksLoket = loket?.trim() ? `, silakan menuju ${loket}` : "";
  const teks = `Nomor antrian, ${ejaan}${teksLoket}`;

  const { voice, adaIndonesia } = pilihSuara();

  // Bersihkan antrean suara supaya tidak menumpuk, lalu ucapkan SEKALI saja.
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(teks);
  u.rate = 0.9;
  u.pitch = 1.0;
  u.volume = 1.0;
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;   // ikuti suara yang ada, jangan paksakan id-ID
  }

  // Pengawas: kalau onstart tidak pernah datang, berarti Chrome menelan
  // utterance tanpa bersuara dan tanpa error. Bunyikan nada supaya panggilan
  // tetap terdengar, dan tandai di layar supaya tidak bisu diam-diam lagi.
  let mulai = false;
  u.onstart = () => { mulai = true; lapor?.(adaIndonesia ? "ok" : "tanpa-suara-id"); };
  u.onerror = () => { if (!mulai) { bunyikanNada(); lapor?.("bisu"); } };
  setTimeout(() => { if (!mulai) { bunyikanNada(); lapor?.("bisu"); } }, 1500);

  window.speechSynthesis.speak(u);
}

export default function DisplayAntrianPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#08301f] text-white flex items-center justify-center text-2xl">Memuat...</div>}>
      <DisplayInner />
    </Suspense>
  );
}

function DisplayInner() {
  const params = useSearchParams();
  const titleParam     = params.get("title");
  const subtitleParam  = params.get("subtitle");
  const themeParam     = params.get("theme") === "light" ? "light" : "dark";
  const ttsEnabled     = params.get("tts") !== "off";
  const layoutMode     = params.get("layout") === "full" ? "full" : "split";

  const [data, setData]       = useState<DisplayAntrian | null>(null);
  const [setting, setSetting] = useState<SettingRS | null>(null);
  const [cfg, setCfg]         = useState<PendaftaranDisplayConfig | null>(null);

  // Prioritas: URL param > pengaturan server (menu Pengaturan) > default
  const tickerParam = params.get("ticker") ?? (cfg?.ticker?.trim() ? cfg.ticker : DEFAULT_MARQUEE);
  const youtubeId   = extractYoutubeId(params.get("youtube") ?? cfg?.youtube ?? "");
  const loketInfo   = parseLoket(params.get("loket") ?? (cfg?.loket?.trim() ? cfg.loket : null));
  const [sseConnected, setSseConnected] = useState(false);
  const [flashing, setFlashing] = useState(false);
  // Optimis: anggap audio langsung aktif (kiosk dgn --autoplay-policy=no-user-gesture-required
  // tak butuh klik). Overlay klik hanya muncul kalau browser menolak (error "not-allowed").
  const [audioUnlocked, setAudioUnlocked] = useState(true);
  // Status suara + daftar voice yang benar-benar tersedia di mesin ini.
  // Ditampilkan di layar supaya kegagalan TTS tidak lagi bisu tanpa jejak —
  // sebelumnya satu-satunya gejala adalah "berkedip tapi tidak bersuara".
  const [statusSuara, setStatusSuara] = useState<StatusSuara>("belum");
  const [daftarSuara, setDaftarSuara] = useState<SpeechSynthesisVoice[]>([]);
  const [panelSuara, setPanelSuara] = useState(false);
  const lastKeyRef = useRef<string>("");
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getSetting().then(r => setSetting(r.data)).catch(() => {});
  }, []);

  // Config dari menu Pengaturan (youtube/ticker/loket) — refresh berkala agar
  // perubahan setelan langsung dipakai TV tanpa reload.
  useEffect(() => {
    const load = () => getPendaftaranDisplayConfig().then(r => setCfg(r.data)).catch(() => {});
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Preload voices + AUTO-UNLOCK audio: coba utterance senyap saat halaman dibuka.
  // Kalau browser menolak ("not-allowed"), baru tampilkan overlay klik. Gesture apa pun
  // (sentuh/tombol) juga langsung meng-unlock sebagai cadangan.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    // Chrome mengisi daftar suara secara asinkron — panggilan getVoices()
    // pertama hampir selalu kosong. Tanpa listener ini, panggilan pertama
    // setelah halaman dibuka bisa kehilangan suara.
    const muatSuara = () => setDaftarSuara(window.speechSynthesis.getVoices());
    muatSuara();
    window.speechSynthesis.addEventListener?.("voiceschanged", muatSuara);
    if (!ttsEnabled) {
      return () => window.speechSynthesis.removeEventListener?.("voiceschanged", muatSuara);
    }

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
      window.speechSynthesis.removeEventListener?.("voiceschanged", muatSuara);
      window.removeEventListener("pointerdown", gestureUnlock);
      window.removeEventListener("keydown", gestureUnlock);
    };
  }, [ttsEnabled]);

  // Polling fallback (recovery jika SSE drop) + ambil daftar awal
  useEffect(() => {
    let stop = false;
    const refresh = async () => {
      try {
        const r = await getDisplayAntrian();
        if (stop) return;
        setData(r.data);
        const s = r.data.sekarang;
        if (s) lastKeyRef.current = `${s.prefix ?? ""}|${s.nomor}|${s.loket}|${s.jam}`;
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
      es = new EventSource(DISPLAY_STREAM_URL);

      es.onopen = () => setSseConnected(true);

      es.onmessage = (ev) => {
        try {
          const evt = JSON.parse(ev.data) as { prefix?: string; nomor: string; loket: string; jam: string };
          const key = `${evt.prefix ?? ""}|${evt.nomor}|${evt.loket}|${evt.jam}`;
          if (lastKeyRef.current !== key) {
            lastKeyRef.current = key;
            ucapkan(evt.prefix, evt.nomor, evt.loket, ttsEnabled, setStatusSuara);

            // Animasi flash 4 detik
            setFlashing(true);
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            flashTimerRef.current = setTimeout(() => setFlashing(false), 4000);

            setData(prev => {
              const sebelumnya = prev?.sekarang;
              const riwayatBaru = sebelumnya
                ? [sebelumnya, ...(prev?.riwayat ?? [])].slice(0, 5)
                : (prev?.riwayat ?? []);
              // Kurangi hanya layanan yang barusan dipanggil; polling 15 dtk
              // tetap menyelaraskan angka kalau ada tiket baru dari anjungan.
              const perLayanan = (prev?.per_layanan ?? []).map(r =>
                r.prefix === (evt.prefix ?? "")
                  ? { ...r, menunggu: Math.max(r.menunggu - 1, 0) }
                  : r
              );
              return {
                sekarang: evt,
                riwayat:  riwayatBaru,
                menunggu: Math.max((prev?.menunggu ?? 1) - 1, 0),
                per_layanan: perLayanan,
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
  }, [ttsEnabled]);

  const namaRS   = titleParam ?? setting?.nama_instansi  ?? "RSUD Cabangbungin";
  const alamatRS = subtitleParam ?? setting?.alamat_instansi ?? "Loket Pendaftaran / Admisi";
  const sekarang = data?.sekarang;
  const riwayat  = data?.riwayat ?? [];
  const light    = themeParam === "light";
  const showVideo = layoutMode === "split" && youtubeId.length > 0;

  // Unlock audio — Web Speech API butuh user gesture pertama di sebagian browser
  const unlockAudio = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
    setAudioUnlocked(true);
  };

  // ── Palet: HIJAU khas RSUD Cabangbungin (default) / terang (light) ──
  const pageBg = light
    ? "bg-[linear-gradient(135deg,#eef6f1_0%,#ffffff_50%,#e7f2ec_100%)] text-slate-900"
    : "bg-[linear-gradient(140deg,#062a1c_0%,#0b4a34_48%,#0a3f3d_100%)] text-white";
  const headerBar = light
    ? "bg-white/70 border-emerald-200"
    : "bg-emerald-950/40 border-emerald-300/15";
  const panelBg = light ? "bg-emerald-50/70" : "bg-emerald-950/35";
  const histCard = light ? "bg-white border-emerald-200" : "bg-white/[0.06] border-white/10";
  const histRow  = light ? "bg-emerald-50" : "bg-white/[0.05]";
  const numFont  = showVideo ? "clamp(4.5rem, 11vw, 9.5rem)" : "min(42vh, 34vw)";

  return (
    <div className={`h-screen w-screen ${pageBg} flex flex-col overflow-hidden select-none`}>
      <style>{`
        @keyframes callpop { 0%{transform:scale(.82);opacity:.4} 55%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
        @keyframes ringglow {
          0%,100%{ box-shadow:0 0 0 0 rgba(16,185,129,.0), 0 25px 60px -15px rgba(0,0,0,.5) }
          50%{ box-shadow:0 0 0 14px rgba(16,185,129,.28), 0 25px 60px -15px rgba(0,0,0,.5) }
        }
        .call-anim { animation: callpop .5s cubic-bezier(.2,.9,.25,1.1) both, ringglow 1.1s ease-in-out 2; }
        @keyframes rowin { from{opacity:0; transform:translateY(-6px)} to{opacity:1; transform:translateY(0)} }
        .row-in { animation: rowin .35s ease both; }
      `}</style>

      {/* Header */}
      <header className={`flex items-center justify-between px-8 py-3.5 border-b ${headerBar} shrink-0`}>
        <div className="flex items-center gap-3.5">
          <LogoRS light={light} />
          <div className="leading-tight">
            <h1 className="text-2xl font-extrabold tracking-tight">{namaRS}</h1>
            {alamatRS && <p className={`text-xs ${light ? "text-slate-500" : "text-emerald-100/70"}`}>{alamatRS}</p>}
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className={`flex items-center gap-2 text-xs ${light ? "text-slate-500" : "text-emerald-100/70"}`}>
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${sseConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`}></span>
            <span>{sseConnected ? "Real-time" : "Menyambung..."}</span>
          </div>

          {/* Tes suara manual — tanpa ini, satu-satunya cara menguji audio
              adalah menunggu panggilan sungguhan dari loket. */}
          <button
            onClick={() => ucapkan("A", "1", loketInfo[0]?.ket ?? "LOKET 1", true, setStatusSuara)}
            className={`text-xs px-2.5 py-1 rounded-md border ${light
              ? "border-slate-300 text-slate-600 hover:bg-slate-100"
              : "border-emerald-100/30 text-emerald-100/80 hover:bg-white/10"}`}
            title="Ucapkan contoh panggilan untuk menguji suara">
            Tes Suara
          </button>

          {/* Status suara. Dulu kegagalan TTS tidak meninggalkan jejak apa pun
              di layar — gejalanya hanya "berkedip tapi bisu". */}
          <button
            onClick={() => setPanelSuara(v => !v)}
            className={`text-xs px-2.5 py-1 rounded-md border ${
              statusSuara === "bisu"
                ? "border-rose-400/60 text-rose-300 bg-rose-500/10"
                : statusSuara === "tanpa-suara-id"
                  ? "border-amber-400/60 text-amber-300 bg-amber-500/10"
                  : light ? "border-slate-300 text-slate-600" : "border-emerald-100/30 text-emerald-100/70"
            }`}
            title="Status suara — klik untuk rincian">
            {statusSuara === "bisu" ? "Suara gagal"
              : statusSuara === "tanpa-suara-id" ? "Tanpa suara ID"
              : statusSuara === "ok" ? "Suara OK"
              : `Suara: ${daftarSuara.length}`}
          </button>

          <Clock light={light} />
        </div>
      </header>

      {/* Rincian suara — untuk memeriksa langsung di TV tanpa membuka DevTools. */}
      {panelSuara && (
        <div className="absolute top-20 right-4 z-40 w-96 max-h-[60vh] overflow-y-auto rounded-xl bg-black/85 text-emerald-50 p-4 text-xs shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <b className="text-sm">Diagnostik Suara</b>
            <button onClick={() => setPanelSuara(false)} className="text-emerald-200/70 hover:text-white">tutup</button>
          </div>
          <p className="mb-1">Status terakhir: <b>{statusSuara}</b></p>
          <p className="mb-1">Web Speech API: <b>{typeof window !== "undefined" && "speechSynthesis" in window ? "ada" : "TIDAK ADA"}</b></p>
          <p className="mb-2">Suara terpasang: <b>{daftarSuara.length}</b>
            {" · "}Indonesia: <b>{daftarSuara.filter(v => v.lang.toLowerCase().startsWith("id")).length}</b></p>
          {daftarSuara.length === 0 ? (
            <p className="text-rose-300">
              Tidak ada suara sama sekali. Di Windows, pasang paket bahasa + Speech;
              di Linux pasang speech-dispatcher. Sementara itu panggilan tetap
              ditandai dengan nada.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {daftarSuara.map((v, i) => (
                <li key={i} className={v.lang.toLowerCase().startsWith("id") ? "text-emerald-300" : "text-emerald-50/70"}>
                  {v.name} <span className="opacity-60">({v.lang})</span>{v.default ? " ★" : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Audio unlock prompt */}
      {ttsEnabled && !audioUnlocked && (
        <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center cursor-pointer" onClick={unlockAudio}>
          <div className="text-center text-white">
            <div className="text-8xl mb-4">🔊</div>
            <p className="text-3xl font-bold mb-2">Sentuh / klik untuk aktifkan suara</p>
            <p className="text-lg opacity-80">Sistem akan memanggil nomor antrian via suara</p>
          </div>
        </div>
      )}

      {/* Body */}
      <main className={`flex-1 grid ${showVideo ? "grid-cols-4" : "grid-cols-1"} min-h-0`}>
        {/* Video kiri */}
        {showVideo && (
          <section className="col-span-3 bg-black relative">
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&controls=0&modestbranding=1&playsinline=1&rel=0&playlist=${youtubeId}`}
              title="Video Display"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </section>
        )}

        {/* Panel antrian kanan */}
        <section className={`col-span-1 flex flex-col p-5 gap-4 ${panelBg} ${!showVideo ? "items-center justify-center" : ""} ${light ? "" : "backdrop-blur-sm"}`}>

          {/* Kartu SEDANG DIPANGGIL */}
          <div className={`${!showVideo ? "w-full max-w-4xl" : ""}`}>
            <div key={`${sekarang?.prefix ?? ""}-${sekarang?.nomor}-${sekarang?.jam}`}
                 className={`relative overflow-hidden rounded-[1.75rem] bg-white text-center shadow-2xl ${showVideo ? "px-5 py-7" : "px-12 py-14"} ${flashing ? "call-anim" : ""}`}>
              <div className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-emerald-700">Sedang Dipanggil</div>
              <div className="font-black text-emerald-800 leading-[0.9] my-1 tabular-nums" style={{ fontSize: numFont }}>
                {sekarang ? formatNomor(sekarang.prefix, sekarang.nomor) : "—"}
              </div>
              {/* Loket badge */}
              {sekarang?.loket ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 shadow-lg">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-300 animate-pulse"></span>
                  <span className={`font-extrabold uppercase tracking-wide text-white ${showVideo ? "text-xl" : "text-3xl"}`}>
                    {sekarang.loket}
                  </span>
                </div>
              ) : (
                <div className={`font-semibold text-slate-400 ${showVideo ? "text-lg" : "text-2xl"}`}>Menunggu panggilan…</div>
              )}
            </div>
          </div>

          {/* Riwayat panggilan */}
          <div className={`${histCard} border rounded-2xl p-4 flex-1 flex flex-col min-h-0 ${!showVideo ? "w-full max-w-4xl" : ""}`}>
            <div className={`text-[0.7rem] font-bold uppercase tracking-[0.18em] ${light ? "text-slate-500" : "text-emerald-100/75"} mb-2.5`}>
              Panggilan Sebelumnya
            </div>
            <div className="flex-1 overflow-hidden space-y-2">
              {riwayat.length === 0 ? (
                <div className={`${light ? "text-slate-400" : "text-white/40"} text-sm italic`}>Belum ada panggilan sebelumnya</div>
              ) : (
                riwayat.map((p, i) => (
                  <div key={`${p.prefix ?? ""}-${p.nomor}-${p.jam}-${i}`}
                       className={`${histRow} ${i === 0 ? "row-in" : ""} flex items-center justify-between rounded-xl px-3.5 py-2.5`}>
                    <span className={`${showVideo ? "text-3xl" : "text-4xl"} font-black font-mono tabular-nums ${light ? "text-emerald-800" : "text-white"}`}>
                      {formatNomor(p.prefix, p.nomor)}
                    </span>
                    <span className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${light ? "bg-emerald-100 text-emerald-700" : "bg-emerald-500/20 text-emerald-200"}`}>
                      {p.loket || "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Antrian menunggu — rincian per layanan + total */}
          <div className={`rounded-xl px-4 py-3 ${light ? "bg-emerald-600 text-white" : "bg-emerald-500/15 border border-emerald-300/20"} ${!showVideo ? "w-full max-w-4xl" : ""}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wider ${light ? "text-emerald-50" : "text-emerald-100/80"}`}>Sisa Menunggu</span>
              <span className="text-3xl font-black tabular-nums">{data?.menunggu ?? 0}</span>
            </div>
            {(data?.per_layanan?.length ?? 0) > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {data!.per_layanan!.map(r => (
                  <div key={r.prefix}
                       className={`rounded-lg px-2 py-1.5 text-center ${light ? "bg-emerald-700/60" : "bg-emerald-400/10"}`}>
                    <div className={`text-[0.62rem] font-semibold uppercase tracking-wide ${light ? "text-emerald-50/90" : "text-emerald-100/70"}`}>
                      {r.prefix} · {NAMA_LAYANAN[r.prefix] ?? r.prefix}
                    </div>
                    <div className="text-xl font-black tabular-nums leading-tight">{r.menunggu}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Keterangan loket */}
      {loketInfo.length > 0 && (
        <div className={`shrink-0 grid ${light ? "bg-white border-emerald-200" : "bg-emerald-950/45 border-emerald-300/15"} border-t`}
             style={{ gridTemplateColumns: `repeat(${loketInfo.length}, minmax(0, 1fr))` }}>
          {loketInfo.map((l, i) => (
            <div key={l.no}
                 className={`flex items-center justify-center gap-3 px-4 py-2.5 ${i > 0 ? (light ? "border-l border-emerald-200" : "border-l border-emerald-300/15") : ""}`}>
              <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg font-black text-lg shrink-0 ${light ? "bg-emerald-600 text-white" : "bg-emerald-500 text-emerald-950"}`}>
                {l.no}
              </span>
              <div className="leading-tight">
                <div className={`text-[0.62rem] font-bold uppercase tracking-widest ${light ? "text-emerald-600" : "text-emerald-300/80"}`}>Loket {l.no}</div>
                <div className={`font-semibold ${light ? "text-slate-700" : "text-white"} text-sm md:text-base`}>{l.ket}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Marquee footer */}
      <footer className={`shrink-0 border-t py-2.5 overflow-hidden ${light ? "bg-emerald-600 border-emerald-700 text-white" : "bg-emerald-950/70 border-emerald-300/15 text-emerald-50"}`}>
        <div className="whitespace-nowrap animate-marquee text-lg font-medium tracking-wide">
          {tickerParam} &nbsp;&nbsp;•&nbsp;&nbsp; {tickerParam}
        </div>
      </footer>
    </div>
  );
}
