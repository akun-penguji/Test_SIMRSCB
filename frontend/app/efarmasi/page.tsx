"use client";

// Beranda e-Farmasi: identitas petugas + tab Rawat Jalan / IGD / Rawat Inap +
// SEMUA pasien (farmasi melayani lintas dokter). Buka pasien → SOAPIE/Resep/Lab/Rad.

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { efarmasiMe, efarmasiPasien, EfarmasiMe, EdokterPasien } from "@/lib/api";
import { clearSession } from "@/lib/auth";

type Jenis = "ralan" | "igd" | "ranap";
const TABS: { key: Jenis; label: string }[] = [
  { key: "ralan", label: "Rawat Jalan" },
  { key: "igd", label: "IGD" },
  { key: "ranap", label: "Rawat Inap" },
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

export default function EfarmasiHome() {
  const router = useRouter();
  const [me, setMe] = useState<EfarmasiMe | null>(null);
  const [jenis, setJenis] = useState<Jenis>("ralan");
  const [cari, setCari] = useState("");
  const [tgl, setTgl] = useState<string>(todayISO());
  const [list, setList] = useState<EdokterPasien[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { efarmasiMe().then(r => setMe(r.data)).catch(() => {}); }, []);

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      const r = await efarmasiPasien({ jenis, cari, tgl_awal: tgl, tgl_akhir: tgl });
      setList(r.data);
    } catch { setList([]); }
    finally { setLoading(false); }
  }, [jenis, cari, tgl]);

  useEffect(() => { muat(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jenis, tgl]);

  function logout() {
    clearSession();
    router.replace("/login?next=/efarmasi");
  }

  const isRanap = jenis === "ranap";

  return (
    <div className="flex flex-col min-h-screen">
      <div className="sticky top-0 z-20 shadow-md">
        <header className="bg-gradient-to-br from-sky-700 to-blue-800 text-white px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-white/70">e-Farmasi · Petugas</div>
              <div className="text-lg font-bold leading-tight truncate">{me?.nama ?? "…"}</div>
              <div className="text-xs text-white/80 truncate">
                {me?.departemen || "Farmasi"}{me?.jabatan ? ` · ${me.jabatan}` : ""}
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
                jenis === t.key ? "text-sky-700 border-b-2 border-sky-600 bg-white" : "text-slate-500 hover:text-slate-700"
              }`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="flex-1 p-3 space-y-2.5 pb-32">
        {loading ? (
          <div className="text-center text-slate-400 text-sm py-10">Memuat pasien…</div>
        ) : list.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-10">
            Tidak ada pasien{isRanap ? " yang sedang dirawat" : ` pada ${toDMY(tgl)}`}.
          </div>
        ) : (
          list.map(p => (
            <button
              key={p.no_rawat}
              onClick={() => router.push(`/efarmasi/pasien?no_rawat=${encodeURIComponent(p.no_rawat)}&jenis=${jenis}&nm=${encodeURIComponent(p.nm_pasien ?? "")}`)}
              className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.99] transition-transform p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 truncate">{p.nm_pasien}</div>
                  <div className="text-xs text-slate-500 mt-0.5">RM {p.no_rm} · {p.jk} · {p.umur}</div>
                </div>
                {p.status && (
                  <span className="shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200">{p.status}</span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span className="truncate">{p.lokasi}</span>
                <span className="shrink-0">{toDMY((p.tgl ?? "").slice(0, 10))} {p.jam ? p.jam.slice(0, 5) : ""}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                {p.png_jawab && <span className="text-slate-400 truncate">{p.png_jawab}</span>}
                {p.dokter && <span className="text-sky-600 truncate shrink-0">👨‍⚕️ {p.dokter}</span>}
              </div>
            </button>
          ))
        )}
      </main>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] px-3 pt-2.5 pb-3 space-y-2">
        {!isRanap && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 w-14 shrink-0">Tanggal</label>
            <div className="relative flex-1">
              <input type="date" value={tgl} onChange={e => setTgl(e.target.value || todayISO())}
                className="w-full rounded-xl border border-slate-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400" />
            </div>
            <span className="text-xs font-mono text-slate-500 w-24 text-right shrink-0">{toDMY(tgl)}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input value={cari} onChange={e => setCari(e.target.value)} onKeyDown={e => { if (e.key === "Enter") muat(); }}
            placeholder="Cari nama / no. RM / no. rawat…"
            className="flex-1 rounded-xl border border-slate-300 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
          <button onClick={muat} className="shrink-0 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors">Cari</button>
        </div>
      </div>
    </div>
  );
}
