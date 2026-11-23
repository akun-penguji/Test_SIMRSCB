"use client";

// Beranda e-Nakes: identitas petugas (perawat/tenaga kesehatan) + tab Rawat Jalan
// / IGD / Rawat Inap + SEMUA pasien. Buka pasien → SOAPIE/Alergi/Resep/Lab/Rad.

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { enakesMe, enakesPasien, enakesOperasi, EnakesMe, EdokterPasien, EnakesOperasi } from "@/lib/api";
import { clearSession } from "@/lib/auth";

type Jenis = "ralan" | "igd" | "ranap" | "operasi";
const TABS: { key: Jenis; label: string }[] = [
  { key: "ralan", label: "Rawat Jalan" },
  { key: "igd", label: "IGD" },
  { key: "ranap", label: "Rawat Inap" },
  { key: "operasi", label: "Operasi" },
];

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function toDMY(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export default function EnakesHome() {
  const router = useRouter();
  const [me, setMe] = useState<EnakesMe | null>(null);
  const [jenis, setJenis] = useState<Jenis>(() => {
    if (typeof window !== "undefined") {
      try {
        const s = sessionStorage.getItem("enakes_jenis");
        if (s === "ralan" || s === "igd" || s === "ranap" || s === "operasi") return s;
      } catch { /* ignore */ }
    }
    return "ranap";
  });
  const [cari, setCari] = useState("");
  const [tgl, setTgl] = useState<string>(todayISO());
  const [list, setList] = useState<EdokterPasien[]>([]);
  const [opList, setOpList] = useState<EnakesOperasi[]>([]);
  const [loading, setLoading] = useState(false);
  const [lokFilter, setLokFilter] = useState("");   // Ranap: bangsal/kamar · Ralan/IGD: poli

  const isOperasi = jenis === "operasi";

  useEffect(() => { enakesMe().then(r => setMe(r.data)).catch(() => {}); }, []);
  useEffect(() => { setLokFilter(""); }, [jenis]);   // reset filter saat pindah tab
  // Ingat tab terpilih supaya kembali dari detail pasien tak reset ke Rawat Inap.
  useEffect(() => { try { sessionStorage.setItem("enakes_jenis", jenis); } catch { /* ignore */ } }, [jenis]);

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      if (jenis === "operasi") {
        const r = await enakesOperasi({ tgl, cari });
        setOpList(r.data);
      } else {
        const r = await enakesPasien({ jenis, cari, tgl_awal: tgl, tgl_akhir: tgl });
        setList(r.data);
      }
    } catch { setList([]); setOpList([]); }
    finally { setLoading(false); }
  }, [jenis, cari, tgl]);

  useEffect(() => { muat(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jenis, tgl]);

  function logout() {
    clearSession();
    router.replace("/login?next=/enakes");
  }

  const isRanap = jenis === "ranap";
  // Ranap → kelompokkan per bangsal (potong "Bangsal - Kamar"); Ralan/IGD → per poli (lokasi utuh)
  const lokKey = (p: EdokterPasien) => (isRanap ? (p.lokasi ?? "").split(" - ")[0] : (p.lokasi ?? "")).trim();
  const lokOptions = isOperasi
    ? Array.from(new Set(opList.map(o => o.ruang).filter(Boolean))).sort((a, b) => a.localeCompare(b))
    : Array.from(new Set(list.map(lokKey).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const shown = lokFilter ? list.filter(p => lokKey(p) === lokFilter) : list;
  const opShown = lokFilter ? opList.filter(o => o.ruang === lokFilter) : opList;

  const statusColor = (s: string) =>
    s === "Selesai" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : s === "Proses Operasi" ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-sky-50 text-sky-700 border-sky-200";

  return (
    <div className="flex flex-col min-h-screen">
      <div className="sticky top-0 z-20 shadow-md">
        <header className="bg-gradient-to-br from-rose-600 to-pink-700 text-white px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-white/70">e-Nakes · Tenaga Kesehatan</div>
              <div className="text-lg font-bold leading-tight truncate">{me?.nama ?? "…"}</div>
              <div className="text-xs text-white/80 truncate">
                {me?.departemen || "Keperawatan"}{me?.jabatan ? ` · ${me.jabatan}` : ""}
              </div>
            </div>
            <button onClick={logout}
              className="shrink-0 text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 transition-colors">
              Keluar
            </button>
          </div>
        </header>

        <nav className="bg-slate-50 border-b border-slate-200 flex">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setJenis(t.key)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                jenis === t.key ? "text-rose-700 border-b-2 border-rose-600 bg-white" : "text-slate-500 hover:text-slate-700"
              }`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="flex-1 p-3 space-y-2.5 pb-32">
        {loading ? (
          <div className="text-center text-slate-400 text-sm py-10">Memuat {isOperasi ? "jadwal operasi" : "pasien"}…</div>
        ) : isOperasi ? (
          opShown.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-10">
              {lokFilter ? `Tidak ada jadwal operasi di ${lokFilter}.` : `Tidak ada jadwal operasi pada ${toDMY(tgl)}.`}
            </div>
          ) : (
            opShown.map(o => (
              <button
                key={o.no_rawat + o.jam_mulai}
                onClick={() => router.push(`/enakes/pasien?no_rawat=${encodeURIComponent(o.no_rawat)}&jenis=${o.jenis}&ctx=operasi&nm=${encodeURIComponent(o.nm_pasien ?? "")}`)}
                className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.99] transition-transform p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">{o.nm_pasien}</div>
                    <div className="text-xs text-slate-500 mt-0.5">RM {o.no_rm} · {o.jk} · {o.umur}</div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 border ${statusColor(o.status)}`}>{o.status || "Menunggu"}</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-rose-700 leading-snug">🔪 {o.paket || "—"}</div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span className="truncate">🏥 {o.ruang || "-"}{o.poli ? ` · ${o.poli}` : ""}</span>
                  <span className="shrink-0 font-mono">🕐 {o.jam_mulai || "--:--"}{o.jam_selesai ? `–${o.jam_selesai}` : ""}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-400 truncate">{toDMY((o.tanggal ?? "").slice(0, 10))}</span>
                  {o.dokter && <span className="text-rose-600 truncate shrink-0">👨‍⚕️ {o.dokter}</span>}
                </div>
              </button>
            ))
          )
        ) : shown.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-10">
            {lokFilter ? `Tidak ada pasien di ${lokFilter}.` : `Tidak ada pasien${isRanap ? " yang sedang dirawat" : ` pada ${toDMY(tgl)}`}.`}
          </div>
        ) : (
          shown.map(p => (
            <button
              key={p.no_rawat}
              onClick={() => router.push(`/enakes/pasien?no_rawat=${encodeURIComponent(p.no_rawat)}&jenis=${jenis}&nm=${encodeURIComponent(p.nm_pasien ?? "")}`)}
              className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.99] transition-transform p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 truncate">{p.nm_pasien}</div>
                  <div className="text-xs text-slate-500 mt-0.5">RM {p.no_rm} · {p.jk} · {p.umur}</div>
                </div>
                {p.status && (
                  <span className="shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200">{p.status}</span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span className="truncate">{p.lokasi}</span>
                <span className="shrink-0">{toDMY((p.tgl ?? "").slice(0, 10))} {p.jam ? p.jam.slice(0, 5) : ""}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                {p.png_jawab && <span className="text-slate-400 truncate">{p.png_jawab}</span>}
                {p.dokter && <span className="text-rose-600 truncate shrink-0">👨‍⚕️ {p.dokter}</span>}
              </div>
            </button>
          ))
        )}
      </main>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] px-3 pt-2.5 pb-3 space-y-2">
        {lokOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 w-14 shrink-0">{isOperasi ? "Ruang" : isRanap ? "Kamar" : "Poli"}</label>
            <select value={lokFilter} onChange={e => setLokFilter(e.target.value)}
              className="flex-1 rounded-xl border border-slate-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400">
              <option value="">Semua {isOperasi ? "ruang OK" : isRanap ? "bangsal" : "poli"} ({isOperasi ? opList.length : list.length})</option>
              {lokOptions.map(o => (
                <option key={o} value={o}>{o} ({isOperasi ? opList.filter(x => x.ruang === o).length : list.filter(p => lokKey(p) === o).length})</option>
              ))}
            </select>
          </div>
        )}
        {!isRanap && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 w-14 shrink-0">Tanggal</label>
            <div className="relative flex-1">
              <input type="date" value={tgl} onChange={e => setTgl(e.target.value || todayISO())}
                className="w-full rounded-xl border border-slate-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400" />
            </div>
            <span className="text-xs font-mono text-slate-500 w-24 text-right shrink-0">{toDMY(tgl)}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input value={cari} onChange={e => setCari(e.target.value)} onKeyDown={e => { if (e.key === "Enter") muat(); }}
            placeholder="Cari nama / no. RM / no. rawat…"
            className="flex-1 rounded-xl border border-slate-300 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
          <button onClick={muat} className="shrink-0 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors">Cari</button>
        </div>
      </div>
    </div>
  );
}
