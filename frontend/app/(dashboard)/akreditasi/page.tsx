"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { akreditasiStats, akreditasiBootstrap, AkreditasiStats,
         akreditasiFormEpMapOverview, akreditasiAutoSeedFormEpMap,
         AutoSeedResult, FormEpMapOverview } from "@/lib/api";

const KELOMPOK_LABEL: Record<number, string> = {
  1: "Manajemen Rumah Sakit",
  2: "Pelayanan Berfokus Pasien",
  3: "Sasaran Keselamatan Pasien",
  4: "Program Nasional",
};

const KELOMPOK_WARNA: Record<number, string> = {
  1: "from-blue-500/10 to-blue-600/20 border-blue-200 hover:border-blue-400",
  2: "from-emerald-500/10 to-emerald-600/20 border-emerald-200 hover:border-emerald-400",
  3: "from-rose-500/10 to-rose-600/20 border-rose-200 hover:border-rose-400",
  4: "from-amber-500/10 to-amber-600/20 border-amber-200 hover:border-amber-400",
};

// Daftar lengkap 16 bab STARKES — dipakai untuk tampil bab kosong juga
const BAB_LENGKAP: { bab: string; nama: string; kelompok: number }[] = [
  { bab: "TKRS",  nama: "Tata Kelola Rumah Sakit",                          kelompok: 1 },
  { bab: "KPS",   nama: "Kualifikasi dan Pendidikan Staf",                  kelompok: 1 },
  { bab: "MFK",   nama: "Manajemen Fasilitas dan Keselamatan",              kelompok: 1 },
  { bab: "PMKP",  nama: "Peningkatan Mutu dan Keselamatan Pasien",          kelompok: 1 },
  { bab: "PPI",   nama: "Pencegahan dan Pengendalian Infeksi",              kelompok: 1 },
  { bab: "MRMIK", nama: "Manajemen Rekam Medis & Informasi Kesehatan",      kelompok: 1 },
  { bab: "AKP",   nama: "Akses dan Kesinambungan Pelayanan",                kelompok: 2 },
  { bab: "HPK",   nama: "Hak Pasien dan Keluarga",                          kelompok: 2 },
  { bab: "PP",    nama: "Pengkajian Pasien",                                kelompok: 2 },
  { bab: "PAP",   nama: "Pelayanan dan Asuhan Pasien",                      kelompok: 2 },
  { bab: "PAB",   nama: "Pelayanan Anestesi dan Bedah",                     kelompok: 2 },
  { bab: "PKPO",  nama: "Pelayanan Kefarmasian dan Penggunaan Obat",        kelompok: 2 },
  { bab: "KE",    nama: "Komunikasi dan Edukasi",                           kelompok: 2 },
  { bab: "SKP",   nama: "Sasaran Keselamatan Pasien",                       kelompok: 3 },
  { bab: "PN",    nama: "Program Nasional",                                 kelompok: 4 },
];

export default function AkreditasiLandingPage() {
  const [stats, setStats] = useState<AkreditasiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootMsg, setBootMsg] = useState<string | null>(null);
  const [bootBusy, setBootBusy] = useState(false);

  // Auto-seed Bukti SIMRS mapping
  const [feOverview, setFeOverview] = useState<FormEpMapOverview | null>(null);
  const [seedPreview, setSeedPreview] = useState<AutoSeedResult | null>(null);
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedModalOpen, setSeedModalOpen] = useState(false);

  async function loadFeOverview() {
    try {
      const r = await akreditasiFormEpMapOverview();
      setFeOverview(r.data);
    } catch { /* ignore */ }
  }
  async function openSeedModal() {
    setSeedModalOpen(true);
    setSeedPreview(null);
    setSeedBusy(true);
    try {
      const r = await akreditasiAutoSeedFormEpMap(true);
      setSeedPreview(r.data);
    } catch (e) {
      setBootMsg(`✗ Gagal preview seed: ${(e as Error).message}`);
    } finally { setSeedBusy(false); }
  }
  async function applySeed() {
    if (!confirm("Terapkan auto-seed mapping form↔EP ke database?")) return;
    setSeedBusy(true);
    try {
      const r = await akreditasiAutoSeedFormEpMap(false);
      setSeedPreview(r.data);
      setBootMsg(`✓ Auto-seed selesai: ${r.data.inserted} mapping baru disisipkan`);
      await loadFeOverview();
    } catch (e) {
      setBootMsg(`✗ Gagal apply seed: ${(e as Error).message}`);
    } finally { setSeedBusy(false); }
  }

  async function loadStats() {
    setLoading(true);
    try {
      const r = await akreditasiStats();
      setStats(r.data);
    } catch {
      setStats({ total_ep: 0, per_bab: [], per_kelompok: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStats(); loadFeOverview(); }, []);

  async function handleBootstrap() {
    if (!confirm("Jalankan bootstrap akreditasi? Ini akan membuat tabel + seed 51 EP starter STARKES (idempotent — aman dijalankan ulang).")) return;
    setBootBusy(true);
    setBootMsg(null);
    try {
      const r = await akreditasiBootstrap();
      setBootMsg(`✓ ${r.data.message}`);
      await loadStats();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string; detail?: string } } };
      setBootMsg(`✗ Gagal: ${err.response?.data?.error || "error"} — ${err.response?.data?.detail || ""}`);
    } finally {
      setBootBusy(false);
    }
  }

  // Build map per_bab → count
  const mapBab: Record<string, { total: number; critical: number }> = {};
  stats?.per_bab.forEach(b => { mapBab[b.bab] = { total: b.total_ep, critical: b.critical }; });

  // Group by kelompok
  const grouped: Record<number, typeof BAB_LENGKAP> = { 1: [], 2: [], 3: [], 4: [] };
  BAB_LENGKAP.forEach(b => grouped[b.kelompok].push(b));

  const totalKepmenkes = 800; // estimasi total EP di Kepmenkes 1596/2024 (per Kepdirjen 47104/2024)
  const persenSeed = stats?.total_ep ? Math.round((stats.total_ep / totalKepmenkes) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Akreditasi STARKES</h1>
          <p className="text-sm text-slate-500 mt-1">
            Standar Akreditasi Rumah Sakit — Kepmenkes HK.01.07/MENKES/1596/2024 + Kepdirjen 47104/2024
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/akreditasi/ep"
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition">
            📋 Daftar EP
          </Link>
          <Link href="/akreditasi/eviden"
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition">
            📁 Eviden Folder
          </Link>
          <button onClick={handleBootstrap} disabled={bootBusy}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
            {bootBusy ? "Memproses..." : "⚙️ Bootstrap Seed"}
          </button>
          <button onClick={openSeedModal}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition"
            title={feOverview ? `${feOverview.total_mappings} mapping aktif` : ""}>
            🔗 Auto-Seed Bukti SIMRS{feOverview && feOverview.total_mappings > 0 ? ` (${feOverview.total_mappings})` : ""}
          </button>
        </div>
      </div>

      {/* Auto-Seed Modal */}
      {seedModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Auto-Seed Mapping Bukti SIMRS</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scan teks EP (deskripsi + kelengkapan_bukti + nama_standar) dan tag otomatis ke form simrscb berdasar keyword.
                </p>
              </div>
              <button onClick={() => setSeedModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              {seedBusy && <div className="text-slate-500 text-sm">Memproses...</div>}

              {seedPreview && (
                <>
                  <div className={`p-3 rounded text-sm ${seedPreview.mode === "applied"
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                    : "bg-amber-50 border border-amber-200 text-amber-800"}`}>
                    <strong>Mode:</strong> {seedPreview.mode === "preview" ? "Preview (dry-run)" : "Sudah di-apply"}<br/>
                    EP di-scan: <strong>{seedPreview.total_ep_scanned}</strong> ·
                    Mapping match: <strong>{seedPreview.matched}</strong> ·
                    Sudah ada sebelumnya: <strong>{seedPreview.already_mapped}</strong>
                    {seedPreview.mode === "applied" && <> · Inserted: <strong>{seedPreview.inserted}</strong></>}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Per Form</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(seedPreview.per_form).map(([form, n]) => (
                        <div key={form} className="bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 flex justify-between">
                          <span>{form}</span>
                          <span className="font-bold text-amber-700">{n}</span>
                        </div>
                      ))}
                      {Object.keys(seedPreview.per_form).length === 0 && (
                        <div className="text-slate-400 text-xs col-span-2">Tidak ada mapping baru.</div>
                      )}
                    </div>
                  </div>

                  {seedPreview.samples.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">Sample match (max 30)</h3>
                      <div className="border border-slate-200 rounded max-h-60 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100 sticky top-0">
                            <tr>
                              <th className="px-2 py-1 text-left text-slate-700">kd_ep</th>
                              <th className="px-2 py-1 text-left text-slate-700">nama_form</th>
                              <th className="px-2 py-1 text-left text-slate-700">matched keyword</th>
                            </tr>
                          </thead>
                          <tbody>
                            {seedPreview.samples.map((s, i) => (
                              <tr key={i} className="border-t border-slate-100">
                                <td className="px-2 py-1 font-mono text-slate-800">{s.kd_ep}</td>
                                <td className="px-2 py-1 text-slate-800">{s.nama_form}</td>
                                <td className="px-2 py-1 text-amber-700 italic">"{s.matched_kw}"</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-5 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setSeedModalOpen(false)}
                className="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm">Tutup</button>
              {seedPreview && seedPreview.mode === "preview" && seedPreview.matched > 0 && (
                <button onClick={applySeed} disabled={seedBusy}
                  className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium disabled:opacity-50">
                  ✓ Apply {seedPreview.matched} mapping
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {bootMsg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
          bootMsg.startsWith("✓")
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {bootMsg}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Total EP Aktif</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">
            {loading ? "..." : stats?.total_ep ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            dari estimasi {totalKepmenkes} EP ({persenSeed}%)
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Bab Ter-seed</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">
            {loading ? "..." : `${stats?.per_bab.length ?? 0} / 15`}
          </p>
          <p className="text-xs text-slate-400 mt-1">bab dengan minimal 1 EP</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">EP Critical</p>
          <p className="text-3xl font-bold text-red-600 mt-1">
            {loading ? "..." : stats?.per_bab.reduce((acc, b) => acc + b.critical, 0) ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">prioritas 1-2 (high risk)</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Versi Kepmenkes</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">1596/2024</p>
          <p className="text-xs text-slate-400 mt-1">Edisi STARKES berlaku</p>
        </div>
      </div>

      {/* 4 kelompok */}
      {[1, 2, 3, 4].map(k => (
        <section key={k} className="mb-6">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs">Kelompok {k}</span>
            {KELOMPOK_LABEL[k]}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {grouped[k].map(b => {
              const counts = mapBab[b.bab] || { total: 0, critical: 0 };
              const isEmpty = counts.total === 0;
              return (
                <Link key={b.bab} href={`/akreditasi/ep?bab=${b.bab}`}
                  className={`bg-gradient-to-br ${KELOMPOK_WARNA[k]} border rounded-xl p-4 transition-all hover:shadow-md ${isEmpty ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-2xl font-black text-slate-800">{b.bab}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isEmpty ? "bg-slate-200 text-slate-500" : "bg-white/80 text-slate-700"}`}>
                      {counts.total} EP
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-tight font-medium">{b.nama}</p>
                  {counts.critical > 0 && (
                    <p className="text-[10px] text-red-600 mt-2 font-medium">
                      🔴 {counts.critical} critical
                    </p>
                  )}
                  {isEmpty && (
                    <p className="text-[10px] text-slate-400 mt-2 italic">belum di-seed</p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {/* Info footer */}
      <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700 mb-1">ℹ️ Catatan</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Seed starter berisi 51 EP prioritas (HPK, PP, PAP, KE, SKP, MRMIK, PPI, PKPO).</li>
          <li>Sisa ~840 EP perlu di-parse dari PDF Kepmenkes — lihat <code className="bg-white px-1 rounded">docs/seed/README.md</code>.</li>
          <li>Klik kartu bab untuk lihat daftar EP di bab tsb.</li>
        </ul>
      </div>
    </div>
  );
}
