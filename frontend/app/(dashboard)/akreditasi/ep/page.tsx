"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { akreditasiListEp, AkreditasiEp } from "@/lib/api";

const BAB_OPTIONS = [
  { kode: "", label: "— Semua Bab —" },
  { kode: "TKRS", label: "TKRS — Tata Kelola RS" },
  { kode: "KPS", label: "KPS — Kualifikasi & Pendidikan Staf" },
  { kode: "MFK", label: "MFK — Manajemen Fasilitas" },
  { kode: "PMKP", label: "PMKP — Mutu & Keselamatan" },
  { kode: "PPI", label: "PPI — Pencegahan Infeksi" },
  { kode: "MRMIK", label: "MRMIK — Rekam Medis" },
  { kode: "AKP", label: "AKP — Akses Pelayanan" },
  { kode: "HPK", label: "HPK — Hak Pasien" },
  { kode: "PP", label: "PP — Pengkajian Pasien" },
  { kode: "PAP", label: "PAP — Pelayanan & Asuhan" },
  { kode: "PAB", label: "PAB — Anestesi & Bedah" },
  { kode: "PKPO", label: "PKPO — Kefarmasian" },
  { kode: "KE", label: "KE — Komunikasi & Edukasi" },
  { kode: "SKP", label: "SKP — Keselamatan Pasien" },
  { kode: "PN", label: "PN — Program Nasional" },
];

const PRIORITAS_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: "P1 Critical", color: "bg-red-100 text-red-700" },
  2: { label: "P2 High",     color: "bg-orange-100 text-orange-700" },
  3: { label: "P3 Medium",   color: "bg-amber-100 text-amber-700" },
  4: { label: "P4 Low",      color: "bg-slate-100 text-slate-600" },
  5: { label: "P5 Trivial",  color: "bg-slate-100 text-slate-500" },
};

function EpListContent() {
  const router = useRouter();
  const params = useSearchParams();

  const [eps, setEps] = useState<AkreditasiEp[]>([]);
  const [loading, setLoading] = useState(true);
  const [bab, setBab]       = useState(params.get("bab") || "");
  const [prio, setPrio]     = useState(params.get("prioritas") || "");
  const [search, setSearch] = useState(params.get("search") || "");

  async function load() {
    setLoading(true);
    try {
      const r = await akreditasiListEp({
        bab:       bab || undefined,
        prioritas: prio ? Number(prio) : undefined,
        search:    search || undefined,
        limit:     500,
      });
      setEps(r.data);
    } catch {
      setEps([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [bab, prio]);

  // Update URL saat filter berubah (shareable links)
  useEffect(() => {
    const sp = new URLSearchParams();
    if (bab)    sp.set("bab", bab);
    if (prio)   sp.set("prioritas", prio);
    if (search) sp.set("search", search);
    const url = sp.toString() ? `/akreditasi/ep?${sp.toString()}` : "/akreditasi/ep";
    router.replace(url, { scroll: false });
  }, [bab, prio, search, router]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    load();
  }

  // Group EP per (bab, standar) untuk readable list
  const grouped: Record<string, AkreditasiEp[]> = {};
  eps.forEach(ep => {
    const key = `${ep.standar} — ${ep.nama_standar || ""}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ep);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/akreditasi" className="text-xs text-slate-500 hover:text-green-700">
              ← Kembali ke Akreditasi
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Daftar Elemen Penilaian (EP)</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            STARKES Kepmenkes 1596/2024 + Kepdirjen 47104/2024
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-green-700">{eps.length}</p>
          <p className="text-xs text-slate-500">EP ditampilkan</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Bab</label>
          <select value={bab} onChange={e => setBab(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            {BAB_OPTIONS.map(o => <option key={o.kode} value={o.kode}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Prioritas</label>
          <select value={prio} onChange={e => setPrio(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">— Semua —</option>
            <option value="1">P1 Critical</option>
            <option value="2">P2 High</option>
            <option value="3">P3 Medium</option>
            <option value="4">P4 Low</option>
            <option value="5">P5 Trivial</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-600 mb-1 block">Pencarian (kode/deskripsi)</label>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="mis. 'persetujuan', 'HPK.5', 'site marking'..."
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <button type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
              Cari
            </button>
          </form>
        </div>
      </div>

      {/* List EP */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Memuat...</div>
      ) : eps.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-1">Tidak ada EP yang sesuai filter.</p>
          <p className="text-xs text-slate-400">Coba reset filter atau jalankan bootstrap dari halaman utama akreditasi.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([standar, items]) => (
            <div key={standar} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                <p className="text-sm font-semibold text-slate-700">
                  <span className="font-mono text-green-700">{standar.split(" — ")[0]}</span>
                  {standar.split(" — ")[1] && (
                    <span className="text-slate-600 font-normal"> — {standar.split(" — ")[1]}</span>
                  )}
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {items.map(ep => (
                  <Link href={`/akreditasi/ep/${encodeURIComponent(ep.kd_ep)}`} key={ep.kd_ep}
                    className="block px-4 py-3 hover:bg-green-50/50 transition cursor-pointer">
                    <div className="flex items-start gap-3">
                      <span className="font-mono text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded shrink-0 mt-0.5">
                        {ep.kd_ep}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 leading-relaxed">{ep.deskripsi}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {PRIORITAS_LABEL[ep.prioritas] && (
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${PRIORITAS_LABEL[ep.prioritas].color}`}>
                              {PRIORITAS_LABEL[ep.prioritas].label}
                            </span>
                          )}
                          {ep.kategori_bukti && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                              {ep.kategori_bukti}
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                            Bukti: {ep.jenis_bukti}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            bobot {ep.bobot}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AkreditasiEpListPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Memuat...</div>}>
      <EpListContent />
    </Suspense>
  );
}
