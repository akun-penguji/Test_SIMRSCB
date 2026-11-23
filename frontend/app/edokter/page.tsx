"use client";

// Beranda edokter: identitas dokter + tab Rawat Jalan / IGD / Rawat Inap +
// daftar pasien yang ditangani dokter tsb (di-key ke kd_dokter server-side).
// Panel bawah: filter tanggal (dd-mm-yyyy) + kotak keyword pencarian pasien.

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { edokterMe, edokterPasien, enakesOperasi, EdokterMe, EdokterPasien, EnakesOperasi } from "@/lib/api";
import { clearSession, getSession } from "@/lib/auth";

type Jenis = "ralan" | "igd" | "ranap" | "operasi";
const TABS: { key: Jenis; label: string }[] = [
  { key: "ralan", label: "Rawat Jalan" },
  { key: "igd",   label: "IGD" },
  { key: "ranap", label: "Rawat Inap" },
  { key: "operasi", label: "Operasi" },
];

// Warna badge status jadwal operasi
function statusColorOp(s: string) {
  return s === "Selesai" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : s === "Proses Operasi" ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-slate-50 text-slate-600 border-slate-200";
}

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
// yyyy-mm-dd → dd-mm-yyyy
function toDMY(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export default function EdokterHome() {
  const router = useRouter();
  const [me, setMe] = useState<EdokterMe | null>(null);
  const [meErr, setMeErr] = useState<string>("");
  const [jenis, setJenis] = useState<Jenis>("ralan");
  const [cari, setCari] = useState("");
  const [tgl, setTgl] = useState<string>(todayISO()); // yyyy-mm-dd
  const [list, setList] = useState<EdokterPasien[]>([]);
  const [opList, setOpList] = useState<EnakesOperasi[]>([]);
  const [loading, setLoading] = useState(false);
  // Mode uji admin: admin utama boleh impersonasi dokter via kode
  const [isAdmin, setIsAdmin] = useState(false);
  const [kdDokter, setKdDokter] = useState("");

  useEffect(() => {
    setIsAdmin(getSession()?.is_admin === true);
  }, []);

  const muatMe = useCallback(() => {
    edokterMe(isAdmin ? kdDokter : undefined)
      .then(r => { setMe(r.data); setMeErr(""); })
      .catch(e => setMeErr(e?.response?.data?.error ?? "Gagal memuat data dokter"));
  }, [isAdmin, kdDokter]);

  useEffect(() => { muatMe(); }, [muatMe]);

  // Admin ATAU dokter dengan hak "akses dokter lain" boleh melihat/menyaring pasien dokter lain.
  // Sesuai perilaku Khanza (flag = lihat SEMUA pasien): default Filter Dr. kosong = semua dokter;
  // isi kode dokter untuk menyaring ke satu dokter (mis. pasien sendiri).
  const bolehLain = isAdmin || me?.boleh_dokter_lain === true;

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      if (jenis === "operasi") {
        const r = await enakesOperasi({ tgl, cari });
        setOpList(r.data);
      } else {
        const r = await edokterPasien({ jenis, cari, tgl_awal: tgl, tgl_akhir: tgl, kd_dokter: bolehLain ? kdDokter : undefined });
        setList(r.data);
      }
    } catch {
      if (jenis === "operasi") setOpList([]); else setList([]);
    } finally {
      setLoading(false);
    }
  }, [jenis, cari, tgl, bolehLain, kdDokter]);

  // Muat ulang saat tab / tanggal / dokter (admin) berubah; keyword via Cari/Enter
  useEffect(() => {
    if (me) muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, jenis, tgl, kdDokter]);

  function logout() {
    clearSession();
    router.replace("/login?next=/edokter");
  }

  const isRanap = jenis === "ranap";
  const isOperasi = jenis === "operasi";

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header + tab (satu blok sticky) */}
      <div className="sticky top-0 z-20 shadow-md">
        <header className="bg-gradient-to-br from-teal-700 to-emerald-800 text-white px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-white/70">Dokter</div>
              <div className="text-lg font-bold leading-tight truncate">{me?.nm_dokter ?? "…"}</div>
              <div className="text-xs text-white/80 truncate">
                {me?.nm_sps ? me.nm_sps : "Umum"} · {me?.kd_dokter ?? ""}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {/* TTE berkas klaim — dipisah dari daftar pasien karena
                  pekerjaannya memang terpisah: dokter membukanya untuk
                  menyelesaikan tumpukan tanda tangan, bukan saat sedang
                  memeriksa satu pasien tertentu. */}
              <button onClick={() => router.push("/edokter/tte")}
                className="text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 transition-colors">
                Tanda Tangan
              </button>
              <button onClick={logout}
                className="text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 transition-colors">
                Keluar
              </button>
            </div>
          </div>
        </header>

        {/* Tab jenis rawat */}
        <nav className="bg-slate-50 border-b border-slate-200 flex">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setJenis(t.key)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                jenis === t.key
                  ? "text-emerald-700 border-b-2 border-emerald-600 bg-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Daftar pasien — pb besar agar tidak tertutup panel bawah */}
      <main className="flex-1 p-3 space-y-2.5 pb-40">
        {meErr && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">
            {meErr}
          </div>
        )}

        {loading ? (
          <div className="text-center text-slate-400 text-sm py-10">Memuat {isOperasi ? "jadwal operasi" : "pasien"}…</div>
        ) : isOperasi ? (
          opList.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-10">Tidak ada jadwal operasi pada {toDMY(tgl)}.</div>
          ) : (
            opList.map(o => (
              <button
                key={o.no_rawat + o.jam_mulai}
                onClick={() => router.push(`/edokter/pasien?no_rawat=${encodeURIComponent(o.no_rawat)}&jenis=${o.jenis}&ctx=operasi&nm=${encodeURIComponent(o.nm_pasien ?? "")}`)}
                className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.99] transition-transform p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">{o.nm_pasien}</div>
                    <div className="text-xs text-slate-500 mt-0.5">RM {o.no_rm} · {o.jk} · {o.umur}</div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 border ${statusColorOp(o.status)}`}>{o.status || "Menunggu"}</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-teal-700 leading-snug">🔪 {o.paket || "—"}</div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span className="truncate">🏥 {o.ruang || "-"}{o.poli ? ` · ${o.poli}` : ""}</span>
                  <span className="shrink-0 font-mono">🕐 {o.jam_mulai || "--:--"}{o.jam_selesai ? `–${o.jam_selesai}` : ""}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-400 truncate">{toDMY((o.tanggal ?? "").slice(0, 10))}</span>
                  {o.dokter && <span className="text-teal-600 truncate shrink-0">👨‍⚕️ {o.dokter}</span>}
                </div>
              </button>
            ))
          )
        ) : list.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-10">
            Tidak ada pasien{isRanap ? " yang sedang dirawat" : ` pada ${toDMY(tgl)}`}.
          </div>
        ) : (
          list.map(p => (
            <button
              key={p.no_rawat}
              onClick={() => router.push(`/edokter/pasien?no_rawat=${encodeURIComponent(p.no_rawat)}&jenis=${jenis}&nm=${encodeURIComponent(p.nm_pasien ?? "")}`)}
              className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.99] transition-transform p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 truncate">{p.nm_pasien}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    RM {p.no_rm} · {p.jk} · {p.umur}
                  </div>
                </div>
                {p.status && (
                  <span className="shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {p.status}
                  </span>
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

      {/* Panel bawah: filter tanggal + keyword */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] px-3 pt-2.5 pb-3 space-y-2">
        {/* Admin / dokter berakses "dokter lain": default SEMUA pasien; isi kode dokter untuk saring 1 dokter */}
        {bolehLain && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-amber-600 w-14 shrink-0">Filter Dr.</label>
            <input
              value={kdDokter}
              onChange={e => setKdDokter(e.target.value.trim())}
              placeholder="Kosongkan = semua pasien · isi kode dokter untuk saring"
              className="flex-1 rounded-xl border border-amber-300 bg-amber-50 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        )}
        {/* Tanggal (disembunyikan untuk Rawat Inap — menampilkan yang sedang dirawat) */}
        {!isRanap && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 w-14 shrink-0">Tanggal</label>
            <div className="relative flex-1">
              <input
                type="date"
                value={tgl}
                onChange={e => setTgl(e.target.value || todayISO())}
                className="w-full rounded-xl border border-slate-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <span className="text-xs font-mono text-slate-500 w-24 text-right shrink-0">{toDMY(tgl)}</span>
          </div>
        )}

        {/* Keyword */}
        <div className="flex items-center gap-2">
          <input
            value={cari}
            onChange={e => setCari(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") muat(); }}
            placeholder="Cari nama / no. RM / no. rawat…"
            className="flex-1 rounded-xl border border-slate-300 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            onClick={muat}
            className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors"
          >
            Cari
          </button>
        </div>
      </div>
    </div>
  );
}
