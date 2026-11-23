"use client";

// TV Display — JADWAL PRAKTEK DOKTER (grid mingguan).
// Menampilkan jadwal SEMUA hari (Sen–Minggu) per dokter, dikelompokkan per poli,
// kolom hari ini disorot — sehingga pasien tahu jadwal dokter di hari lain (BPJS).
//
// URL params (opsional): ?theme=dark|light  ?title=...  ?refresh=60 (detik)
//
// Kiosk TV: chrome --kiosk https://IP:8443/display/jadwal

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getJadwalDokterDisplay, getSetting, JadwalDokterRow, SettingRS } from "@/lib/api";

// Urutan & label hari. Enum DB: SENIN..SABTU, AKHAD(=Minggu).
const HARI: { key: string; lbl: string; jsDay: number }[] = [
  { key: "SENIN",  lbl: "SENIN",  jsDay: 1 },
  { key: "SELASA", lbl: "SELASA", jsDay: 2 },
  { key: "RABU",   lbl: "RABU",   jsDay: 3 },
  { key: "KAMIS",  lbl: "KAMIS",  jsDay: 4 },
  { key: "JUMAT",  lbl: "JUM'AT", jsDay: 5 },
  { key: "SABTU",  lbl: "SABTU",  jsDay: 6 },
  { key: "AKHAD",  lbl: "MINGGU", jsDay: 0 },
];

function LogoRS() {
  const [err, setErr] = useState(false);
  if (!err) {
    return <img src="/logo-rs.png" alt="Logo RSUD Cabangbungin" onError={() => setErr(true)}
      className="object-contain shrink-0 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]" style={{ height: 52, width: 52 }} />;
  }
  return (
    <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#d1fae5" strokeWidth="1.5" className="shrink-0">
      <path d="M12 2.6c2.2 1.8 4.6 2.5 7 2.5 0 6.7-2.4 11.4-7 13.9C7.4 16.5 5 11.8 5 5.1c2.4 0 4.8-.7 7-2.5Z" />
      <path d="M12 8.2v5.2M9.4 10.8h5.2" strokeWidth="1.8" />
    </svg>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const jam = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const tgl = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="text-right leading-tight">
      <div className="text-4xl font-mono font-bold tracking-widest tabular-nums text-white">{jam}</div>
      <div className="text-sm capitalize text-emerald-100/80">{tgl}</div>
    </div>
  );
}

type DocSched = { kd_dokter: string; nm_dokter: string; days: Record<string, string> };
type PoliGroup = { kd_poli: string; nm_poli: string; docs: DocSched[] };

function pivot(rows: JadwalDokterRow[]): PoliGroup[] {
  const order: string[] = [];
  const map: Record<string, { nm_poli: string; docs: Record<string, DocSched> }> = {};
  for (const r of rows) {
    if (!map[r.kd_poli]) { map[r.kd_poli] = { nm_poli: r.nm_poli, docs: {} }; order.push(r.kd_poli); }
    const g = map[r.kd_poli];
    if (!g.docs[r.kd_dokter]) g.docs[r.kd_dokter] = { kd_dokter: r.kd_dokter, nm_dokter: r.nm_dokter, days: {} };
    const jam = r.jam_mulai ? (r.jam_selesai ? `${r.jam_mulai}–${r.jam_selesai}` : `${r.jam_mulai}`) : "";
    if (jam) g.docs[r.kd_dokter].days[r.hari_kerja] = jam;
  }
  return order.map(kd => ({ kd_poli: kd, nm_poli: map[kd].nm_poli, docs: Object.values(map[kd].docs) }));
}

export default function JadwalDokterDisplayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#08301f] text-white flex items-center justify-center text-2xl">Memuat...</div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useSearchParams();
  const light = params.get("theme") === "light";
  const titleParam = params.get("title");
  const refreshSec = Math.max(15, Number(params.get("refresh")) || 60);

  const [rows, setRows] = useState<JadwalDokterRow[]>([]);
  const [setting, setSetting] = useState<SettingRS | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [todayJsDay, setTodayJsDay] = useState<number>(-1);

  useEffect(() => { getSetting().then(r => setSetting(r.data)).catch(() => {}); }, []);
  useEffect(() => { setTodayJsDay(new Date().getDay()); }, []);

  useEffect(() => {
    let stop = false;
    const load = () => getJadwalDokterDisplay()
      .then(r => { if (!stop) { setRows(r.data); setLoaded(true); } })
      .catch(() => { if (!stop) setLoaded(true); });
    load();
    const id = setInterval(load, refreshSec * 1000);
    return () => { stop = true; clearInterval(id); };
  }, [refreshSec]);

  const groups = pivot(rows);
  // Ratakan jadi daftar per-dokter untuk slideshow (1 slide = 1 dokter)
  const slides = groups.flatMap(g => g.docs.map(d => ({ kd_poli: g.kd_poli, nm_poli: g.nm_poli, doc: d })));
  const namaRS = titleParam ?? setting?.nama_instansi ?? "RSUD Cabangbungin";
  const alamatRS = setting?.alamat_instansi ?? "";
  const todayKey = HARI.find(h => h.jsDay === todayJsDay)?.key ?? "";

  // ── Slideshow per dokter ──
  const slideSec = Math.max(4, Number(params.get("slide")) || 8);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), slideSec * 1000);
    return () => clearInterval(t);
  }, [slides.length, slideSec]);
  useEffect(() => { if (idx >= slides.length && slides.length > 0) setIdx(0); }, [slides.length, idx]);
  const cur = slides[Math.min(idx, Math.max(0, slides.length - 1))] ?? null;

  // ── Palet hijau RSUD / terang ──
  const pageBg = light
    ? "bg-[linear-gradient(135deg,#eef6f1_0%,#ffffff_50%,#e7f2ec_100%)] text-slate-900"
    : "bg-[linear-gradient(140deg,#062a1c_0%,#0b4a34_48%,#0a3f3d_100%)] text-white";
  const headBar = light ? "bg-white/70 border-emerald-200" : "bg-emerald-950/40 border-emerald-300/15";
  const thBg = light ? "bg-emerald-600 text-white" : "bg-emerald-800/80 text-emerald-50";
  const poliBand = light ? "bg-emerald-100 text-emerald-800" : "bg-emerald-500/20 text-emerald-100";
  const rowAlt = light ? "odd:bg-white even:bg-emerald-50/50 text-slate-800" : "odd:bg-white/[0.03] even:bg-white/[0.06]";
  const cellBorder = light ? "border-emerald-100" : "border-white/10";
  const todayCol = light ? "bg-amber-100" : "bg-emerald-400/20";
  const todayTh = light ? "bg-amber-400 text-emerald-900" : "bg-amber-400 text-emerald-950";

  return (
    <div className={`h-screen w-screen ${pageBg} flex flex-col overflow-hidden select-none`}>
      {/* Header */}
      <header className={`flex items-center justify-between px-8 py-3.5 border-b ${headBar} shrink-0`}>
        <div className="flex items-center gap-3.5">
          <LogoRS />
          <div className="leading-tight">
            <h1 className="text-2xl font-extrabold tracking-tight">{namaRS}</h1>
            {alamatRS && <p className={`text-xs ${light ? "text-slate-500" : "text-emerald-100/70"}`}>{alamatRS}</p>}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center leading-tight">
            <div className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-amber-300">Jadwal Praktek</div>
            <div className="text-xl font-black tracking-wide">DOKTER</div>
          </div>
          <Clock />
        </div>
      </header>

      {/* Slide per dokter (jadwal 1 minggu) */}
      <main className="flex-1 min-h-0 flex flex-col px-6 py-4">
        {!loaded ? (
          <div className="flex-1 flex items-center justify-center text-lg opacity-60">Memuat jadwal…</div>
        ) : slides.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-lg opacity-60">Belum ada data jadwal dokter.</div>
        ) : cur ? (
          <DoctorSlide key={idx} slide={cur} todayKey={todayKey} light={light}
            poliBand={poliBand} cellBorder={cellBorder} todayCol={todayCol} todayTh={todayTh} />
        ) : null}

        {/* Indikator slide */}
        {slides.length > 1 && (
          <div className="shrink-0 flex items-center justify-center gap-2 pt-3">
            {slides.map((_, i) => (
              <span key={i} className={`h-2.5 rounded-full transition-all ${i === idx ? "w-8 bg-amber-400" : `w-2.5 ${light ? "bg-emerald-300" : "bg-white/30"}`}`} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function DoctorSlide({ slide, todayKey, light, poliBand, cellBorder, todayCol, todayTh }: {
  slide: { kd_poli: string; nm_poli: string; doc: DocSched };
  todayKey: string; light: boolean; poliBand: string; cellBorder: string; todayCol: string; todayTh: string;
}) {
  const d = slide.doc;
  return (
    <div className="flex-1 min-h-0 flex flex-col animate-[fadein_0.5s_ease] gap-4">
      <style>{`@keyframes fadein{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
      {/* Identitas dokter */}
      <div className="text-center">
        <div className={`inline-block px-5 py-1.5 rounded-full text-lg font-black uppercase tracking-widest ${poliBand}`}>{slide.nm_poli}</div>
        <div className="mt-3 font-extrabold tracking-tight leading-none" style={{ fontSize: "min(9vh, 6vw)" }}>{d.nm_dokter}</div>
      </div>

      {/* Jadwal 1 minggu — 7 kartu hari */}
      <div className="flex-1 min-h-0 grid grid-cols-7 gap-3">
        {HARI.map(h => {
          const jam = d.days[h.key];
          const today = h.key === todayKey;
          return (
            <div key={h.key}
              className={`rounded-2xl border ${cellBorder} flex flex-col items-center justify-center text-center p-3 ${today ? todayCol : (light ? "bg-white/70" : "bg-white/[0.05]")}`}>
              <div className={`text-sm font-extrabold uppercase tracking-widest ${today ? todayTh + " px-3 py-0.5 rounded-full" : (light ? "text-emerald-700" : "text-emerald-200")}`}>
                {h.lbl}{today && <span className="block text-[0.55rem]">HARI INI</span>}
              </div>
              <div className="flex-1 flex items-center justify-center">
                {jam
                  ? <span className="font-black tabular-nums leading-tight break-words" style={{ fontSize: "min(4vh, 2.1vw)" }}>{jam}</span>
                  : <span className={`font-semibold ${light ? "text-slate-300" : "text-white/25"}`} style={{ fontSize: "min(3vh, 1.8vw)" }}>Libur</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
