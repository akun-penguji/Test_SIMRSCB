"use client";

// Anjungan Admin — toggle pause + activity log + statistik.
// Hanya bisa diakses admin (kunci di backend via forbidden_if_not_admin).

import { useEffect, useState, useCallback } from "react";
import {
  getAnjunganConfig, putAnjunganConfig, AnjunganConfig,
  listAnjunganLog, getAnjunganLogStats, AnjunganLogRow, AnjunganLogStats,
} from "@/lib/api";

export default function AnjunganAdminPage() {
  const [config, setConfig]     = useState<AnjunganConfig | null>(null);
  const [stats, setStats]       = useState<AnjunganLogStats | null>(null);
  const [logs, setLogs]         = useState<AnjunganLogRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [tgl, setTgl]           = useState(() => new Date().toISOString().slice(0, 10));
  const [filterModul, setFilterModul]   = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "sukses" | "gagal">("");
  const [q, setQ]               = useState("");
  const [savingPause, setSavingPause]     = useState(false);
  const [maintMsg, setMaintMsg] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, st, lg] = await Promise.all([
        getAnjunganConfig().catch(() => ({ data: null as AnjunganConfig | null })),
        getAnjunganLogStats(tgl).catch(() => ({ data: null as AnjunganLogStats | null })),
        listAnjunganLog({
          tgl,
          modul:  filterModul || undefined,
          action: filterAction || undefined,
          sukses: filterStatus === "sukses" ? true : filterStatus === "gagal" ? false : undefined,
          q:      q || undefined,
          limit:  500,
        }).catch(() => ({ data: [] as AnjunganLogRow[] })),
      ]);
      if (cfg.data) {
        setConfig(cfg.data);
        setMaintMsg(cfg.data.maintenance_msg || "");
      }
      setStats(st.data);
      setLogs(lg.data);
    } finally {
      setLoading(false);
    }
  }, [tgl, filterModul, filterAction, filterStatus, q]);

  useEffect(() => { reload(); }, [reload]);

  const togglePause = async () => {
    if (!config) return;
    const next = !config.aktif;
    setSavingPause(true);
    try {
      await putAnjunganConfig({ aktif: next });
      setConfig({ ...config, aktif: next });
    } catch (e: any) {
      alert("Gagal: " + (e.message || e));
    } finally {
      setSavingPause(false);
    }
  };

  const saveMaintMsg = async () => {
    if (!config) return;
    try {
      await putAnjunganConfig({ maintenance_msg: maintMsg });
      setConfig({ ...config, maintenance_msg: maintMsg });
      alert("Pesan maintenance disimpan.");
    } catch (e: any) {
      alert("Gagal: " + (e.message || e));
    }
  };

  const aktif = config?.aktif ?? true;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Anjungan Mandiri</h1>
            <p className="text-slate-500">Kelola status kiosk + lihat activity log</p>
          </div>
          <a href="/anjungan" className="text-sm text-blue-600 hover:underline">← ke Anjungan</a>
        </header>

        {/* Pause toggle */}
        <section className="bg-white rounded-2xl shadow p-6 border">
          <h2 className="text-xl font-bold mb-4">Status Kiosk</h2>
          <div className="flex items-center gap-6">
            <button
              onClick={togglePause}
              disabled={savingPause}
              className={`px-8 py-4 rounded-xl font-bold text-xl transition shadow-lg ${
                aktif
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "bg-amber-500 hover:bg-amber-600 text-white"
              } ${savingPause ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {savingPause ? "Menyimpan..." : aktif ? "✓ KIOSK AKTIF (klik untuk Pause)" : "⏸ KIOSK DI-PAUSE (klik untuk Aktifkan)"}
            </button>
            <div className="flex-1">
              <p className="text-sm text-slate-600">
                Saat kiosk di-pause, halaman <code className="bg-slate-100 px-1 rounded">/anjungan</code> akan menampilkan
                layar maintenance dengan pesan yang Anda atur di bawah.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Status di-poll oleh kiosk tiap 30 detik secara otomatis.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Pesan Maintenance</label>
            <textarea
              value={maintMsg}
              onChange={e => setMaintMsg(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Mohon maaf, kiosk anjungan sementara tidak tersedia. Silakan menuju loket pendaftaran."
            />
            <button onClick={saveMaintMsg}
                    className="mt-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">
              Simpan Pesan
            </button>
          </div>
        </section>

        {/* Statistik */}
        <section className="bg-white rounded-2xl shadow p-6 border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Activity Log — Statistik</h2>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Tanggal:</label>
              <input type="date" value={tgl} onChange={e => setTgl(e.target.value)}
                     className="px-3 py-1.5 border rounded-lg text-sm" />
            </div>
          </div>

          {stats ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs uppercase tracking-widest text-blue-700">Total Aktivitas</p>
                <p className="text-3xl font-bold text-blue-900 tabular-nums">{stats.total}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-xs uppercase tracking-widest text-emerald-700">Sukses</p>
                <p className="text-3xl font-bold text-emerald-900 tabular-nums">{stats.sukses}</p>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                <p className="text-xs uppercase tracking-widest text-rose-700">Gagal</p>
                <p className="text-3xl font-bold text-rose-900 tabular-nums">{stats.gagal}</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 italic">Memuat statistik...</p>
          )}

          {stats && stats.per_jam.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-slate-700 mb-2">Aktivitas Per Jam</p>
              <div className="flex gap-1 items-end h-32">
                {Array.from({ length: 24 }, (_, h) => {
                  const item = stats.per_jam.find(p => p.jam === h);
                  const total = item?.total ?? 0;
                  const max = Math.max(...stats.per_jam.map(p => p.total), 1);
                  return (
                    <div key={h} className="flex-1 flex flex-col items-center" title={`Jam ${h}: ${total}`}>
                      <div className="w-full bg-blue-400 rounded-t" style={{ height: `${(total / max) * 100}%` }} />
                      <span className="text-xs text-slate-500 mt-1">{h}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats && stats.per_modul.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Per Modul</p>
                <table className="w-full text-sm">
                  <tbody>
                    {stats.per_modul.map(b => (
                      <tr key={b.name} className="border-b last:border-0">
                        <td className="py-1.5">{b.name}</td>
                        <td className="py-1.5 text-right font-mono">{b.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Per Action</p>
                <table className="w-full text-sm">
                  <tbody>
                    {stats.per_action.map(b => (
                      <tr key={b.name} className="border-b last:border-0">
                        <td className="py-1.5">{b.name}</td>
                        <td className="py-1.5 text-right font-mono">{b.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Filter */}
        <section className="bg-white rounded-2xl shadow p-6 border">
          <h2 className="text-xl font-bold mb-4">Activity Log — Detail</h2>
          <div className="grid grid-cols-5 gap-3 mb-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Modul</label>
              <select value={filterModul} onChange={e => setFilterModul(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded text-sm">
                <option value="">Semua</option>
                <option value="walkin">walkin</option>
                <option value="bpjs-rujukan">bpjs-rujukan</option>
                <option value="bpjs-kontrol">bpjs-kontrol</option>
                <option value="bpjs-mobilejkn">bpjs-mobilejkn</option>
                <option value="antrian">antrian</option>
                <option value="config">config</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Action</label>
              <input value={filterAction} onChange={e => setFilterAction(e.target.value)}
                     placeholder="sep, daftar, checkin..."
                     className="w-full px-3 py-1.5 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
                      className="w-full px-3 py-1.5 border rounded text-sm">
                <option value="">Semua</option>
                <option value="sukses">Sukses</option>
                <option value="gagal">Gagal</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Cari (NIK / No Kartu / No RM)</label>
              <input value={q} onChange={e => setQ(e.target.value)}
                     placeholder="cari..."
                     className="w-full px-3 py-1.5 border rounded text-sm" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">Waktu</th>
                  <th className="px-3 py-2 text-left">Modul</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">No RM / NIK</th>
                  <th className="px-3 py-2 text-left">No Rawat / SEP</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-left">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="py-4 text-center text-slate-400">Memuat...</td></tr>
                )}
                {!loading && logs.length === 0 && (
                  <tr><td colSpan={7} className="py-4 text-center text-slate-400 italic">Tidak ada data</td></tr>
                )}
                {logs.map(l => (
                  <tr key={l.id} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs">{l.waktu}</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-xs bg-indigo-100 text-indigo-800">{l.modul}</span></td>
                    <td className="px-3 py-2 font-semibold">{l.action}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {l.no_rkm_medis && <div>{l.no_rkm_medis}</div>}
                      {l.nik && <div className="text-slate-400">NIK: {l.nik}</div>}
                      {l.no_kartu && <div className="text-slate-400">BPJS: {l.no_kartu}</div>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {l.no_rawat && <div>{l.no_rawat}</div>}
                      {l.no_sep && <div className="text-emerald-700">SEP: {l.no_sep}</div>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {l.sukses ? (
                        <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-800">✓ OK</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs bg-rose-100 text-rose-800">✗ GAGAL</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 max-w-md truncate" title={l.error_message ?? ""}>
                      {l.error_message ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">Menampilkan {logs.length} baris (max 500). Pakai filter untuk drill-down.</p>
        </section>

      </div>
    </div>
  );
}
