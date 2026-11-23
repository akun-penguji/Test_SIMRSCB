"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getPasienList, Pasien } from "@/lib/api";

function formatTgl(tgl?: string): string {
  if (!tgl) return "-";
  const parts = tgl.split("-");
  if (parts.length !== 3) return tgl;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function hitungUsia(tgl?: string): string {
  if (!tgl) return "-";
  const diff = Date.now() - new Date(tgl).getTime();
  const age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return `${age} thn`;
}

export default function PasienPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Pasien[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string, pg: number) => {
    setLoading(true);
    try {
      const res = await getPasienList(q, pg, 20);
      setData(res.data.data);
      setTotal(res.data.total);
      setSearched(true);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    doSearch(search, 1);
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-3 md:p-5 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 md:mb-5">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-800">Data Pasien</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">Cari dan kelola data pasien</p>
        </div>
        <button
          onClick={() => router.push("/pasien/baru")}
          className="flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white text-xs md:text-sm font-medium px-3 md:px-4 py-2 md:py-2.5 rounded-xl shadow-sm transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Pasien Baru</span>
          <span className="sm:hidden">Baru</span>
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-3 md:mb-5">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, No. RM, atau No. KTP..."
            className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                       placeholder:text-slate-400 shadow-sm"
          />
        </div>
        <button
          type="submit"
          className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          Cari
        </button>
      </form>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Memuat data...
        </div>
      )}

      {/* Empty */}
      {!loading && searched && data.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">Pasien tidak ditemukan</p>
        </div>
      )}

      {/* Prompt awal */}
      {!loading && !searched && (
        <div className="text-center py-16 text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm">Masukkan kata kunci untuk mencari pasien</p>
        </div>
      )}

      {/* Tabel */}
      {data.length > 0 && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Info bar */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-xs text-slate-500">
                Menampilkan <span className="font-semibold text-slate-700">{data.length}</span> dari{" "}
                <span className="font-semibold text-slate-700">{total}</span> pasien
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">No. RM</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Nama Pasien</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tgl Lahir</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">JK</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">No. KTP</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((p) => (
                  <tr key={p.no_rm} className="hover:bg-green-50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500 bg-slate-50/50">{p.no_rm}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{p.nm_pasien}</td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {p.tgl_lahir ? (
                        <span>
                          {formatTgl(p.tgl_lahir)}
                          <span className="ml-1.5 text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                            {hitungUsia(p.tgl_lahir)}
                          </span>
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-5 py-3.5">
                      {p.jk ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.jk === "L" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"
                        }`}>
                          {p.jk === "L" ? "Laki-laki" : "Perempuan"}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs font-mono">{p.no_ktp ?? "-"}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => router.push(`/pasien/${p.no_rm}`)}
                        className="text-xs font-medium text-green-700 hover:text-green-900 hover:underline"
                      >
                        Lihat Detail →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-slate-500">
              Halaman <span className="font-medium text-slate-700">{page}</span> dari{" "}
              <span className="font-medium text-slate-700">{totalPages}</span>
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => { const p = page - 1; setPage(p); doSearch(search, p); }}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => { const p = page + 1; setPage(p); doSearch(search, p); }}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
