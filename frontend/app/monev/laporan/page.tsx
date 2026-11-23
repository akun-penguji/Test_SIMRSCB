"use client";

// Laporan Monev SIMRS — printable A4 untuk bukti dukung WBK ZI.
// URL: /monev/laporan?dari=YYYY-MM-DD&sampai=YYYY-MM-DD
// Auto-print friendly (Ctrl+P → Save as PDF).

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  listMonev, getMonevStats, listMonevRapat, getSetting,
  MonevRow, MonevStats, MonevRapat, SettingRS,
} from "@/lib/api";

function fmtTglID(s: string | null | undefined): string {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch { return s; }
}

function fmtPeriodeID(dari: string, sampai: string): string {
  return `${fmtTglID(dari)} – ${fmtTglID(sampai)}`;
}

function LaporanInner() {
  const params = useSearchParams();
  const dari   = params.get("dari")   || "2025-07-01";
  const sampai = params.get("sampai") || "2026-06-30";

  const [setting, setSetting] = useState<SettingRS | null>(null);
  const [rows, setRows]       = useState<MonevRow[]>([]);
  const [stats, setStats]     = useState<MonevStats | null>(null);
  const [rapat, setRapat]     = useState<MonevRapat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSetting().catch(() => ({ data: null })),
      listMonev({ dari, sampai, limit: 1000 }).catch(() => ({ data: { items: [], total: 0, limit: 1000, offset: 0 } })),
      getMonevStats(dari, sampai).catch(() => ({ data: null })),
      listMonevRapat(dari, sampai).catch(() => ({ data: [] })),
    ]).then(([s, l, st, r]) => {
      if (s.data) setSetting(s.data);
      setRows(l.data.items || []);
      setStats(st.data);
      setRapat(r.data || []);
      setLoading(false);
    });
  }, [dari, sampai]);

  const namaRS  = setting?.nama_instansi || "Rumah Sakit";
  const alamatRS = setting?.alamat_instansi || "";
  const kabRS   = setting?.kabupaten ? `Kabupaten ${setting.kabupaten}` : "";

  const sortedRows = [...rows].sort((a, b) =>
    (a.tanggal_lapor || "").localeCompare(b.tanggal_lapor || "")
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Memuat laporan...</div>;
  }

  return (
    <div className="bg-white text-slate-900">
      <style jsx global>{`
        @page { size: A4; margin: 1.5cm; }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          table { page-break-inside: auto; }
          tr    { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
        .report-table th { background: #e5e7eb; }
        .report-table th, .report-table td {
          border: 1px solid #94a3b8; padding: 4px 6px;
          font-size: 9pt; vertical-align: top;
        }
      `}</style>

      {/* Toolbar (hidden saat print) */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2 bg-white shadow-lg rounded-lg p-2 border">
        <button onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold">
          🖨 Print / Save PDF
        </button>
        <a href="/monev" className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded">← Kembali</a>
      </div>

      <div className="max-w-[21cm] mx-auto p-8 text-sm">

        {/* ── KOP RS ── */}
        <header className="border-b-4 border-slate-900 pb-3 mb-4">
          <div className="flex items-center gap-4">
            <img src="/logo-daerah.png" alt="" className="h-20 w-20 object-contain"
                 onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div className="flex-1 text-center">
              {kabRS && <p className="font-semibold uppercase">{kabRS}</p>}
              <p className="text-lg font-bold uppercase">{namaRS}</p>
              {alamatRS && <p className="text-xs">{alamatRS}</p>}
            </div>
            <img src="/logo-rs.png" alt="" className="h-20 w-20 object-contain"
                 onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        </header>

        {/* ── Identitas Laporan ── */}
        <section className="text-center mb-4">
          <h1 className="text-base font-bold uppercase">Laporan Monitoring & Evaluasi</h1>
          <h2 className="text-base font-bold uppercase">Sistem Informasi Manajemen Rumah Sakit (SIMRS)</h2>
          <p className="text-sm mt-1">Periode: <strong>{fmtPeriodeID(dari, sampai)}</strong></p>
          <p className="text-xs text-slate-600 mt-1">Dokumen pendukung Zona Integritas Menuju WBK</p>
        </section>

        {/* ── I. Pendahuluan ── */}
        <section className="mb-4">
          <h3 className="font-bold mb-1">I. Pendahuluan</h3>
          <p className="text-justify leading-relaxed">
            Sebagai bagian dari komitmen pembangunan Zona Integritas Menuju Wilayah Bebas dari Korupsi (WBK) dan
            peningkatan mutu pelayanan, {namaRS} melakukan monitoring dan evaluasi terhadap Sistem Informasi
            Manajemen Rumah Sakit (SIMRS) secara berkala. Laporan ini berisi rekapitulasi temuan, tindak lanjut,
            dan verifikasi hasil perbaikan SIMRS selama periode <strong>{fmtPeriodeID(dari, sampai)}</strong>.
          </p>
        </section>

        {/* ── II. Ruang Lingkup ── */}
        <section className="mb-4">
          <h3 className="font-bold mb-1">II. Ruang Lingkup</h3>
          <p className="text-justify leading-relaxed">
            Monev mencakup seluruh modul SIMRS yang aktif digunakan di {namaRS}, meliputi pendaftaran rawat
            jalan/inap/IGD, rekam medis elektronik, farmasi, laboratorium, radiologi, kasir, integrasi BPJS
            (VClaim, Aplicare, Mobile JKN), integrasi SATUSEHAT (Kemenkes), serta modul akreditasi
            (KLPCM, Downtime, Pemusnahan RM, dan modul ini sendiri).
          </p>
        </section>

        {/* ── III. Mekanisme Monev ── */}
        <section className="mb-4">
          <h3 className="font-bold mb-1">III. Mekanisme Monitoring & Evaluasi</h3>
          <p className="mb-1 text-justify">Sumber data temuan yang dikelola dalam siklus monev:</p>
          <ol className="list-decimal list-inside ml-4 space-y-0.5 text-justify">
            <li><strong>Helpdesk / aduan pengguna</strong> &mdash; tiket masuk dari unit operasional (rawat jalan, IGD, apotek, dll.)</li>
            <li><strong>Log Git repository</strong> &mdash; histori perbaikan kode SIMRS (commit dengan tag fix/feat/perf/refactor)</li>
            <li><strong>Log bridging SATUSEHAT</strong> &mdash; alert otomatis bila pengiriman bundel ke Kemenkes gagal</li>
            <li><strong>Monitoring sistem</strong> &mdash; downtime aplikasi/server, slow query, kapasitas storage</li>
            <li><strong>Rapat evaluasi</strong> &mdash; pertemuan tim IT + manajemen, baik terjadwal (triwulan) maupun insidental</li>
          </ol>
          <p className="mt-2 text-justify">
            Setiap temuan masuk ke siklus tertutup: <em>temuan &rarr; analisis akar masalah &rarr; tindakan
            perbaikan &rarr; verifikasi ulang &rarr; ditutup</em>. Status hanya boleh berubah menjadi
            "selesai" apabila tindakan perbaikan telah diverifikasi hasilnya.
          </p>
        </section>

        {/* ── IV. Rekapitulasi (Stats) ── */}
        {stats && (
          <section className="mb-4">
            <h3 className="font-bold mb-1">IV. Rekapitulasi</h3>
            <table className="report-table w-full">
              <tbody>
                <tr><td className="w-1/3 font-semibold">Total temuan</td><td>{stats.total}</td></tr>
                <tr><td className="font-semibold">Telah diselesaikan</td><td>{stats.selesai} ({stats.pct_selesai}%)</td></tr>
                <tr><td className="font-semibold">Dalam proses</td><td>{stats.proses}</td></tr>
                <tr><td className="font-semibold">Baru / belum ditangani</td><td>{stats.baru}</td></tr>
                <tr><td className="font-semibold">Ditutup (duplikat / tidak relevan)</td><td>{stats.ditutup}</td></tr>
                <tr><td className="font-semibold">Jumlah rapat evaluasi dalam periode</td><td>{stats.jumlah_rapat}</td></tr>
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <p className="font-semibold text-xs mt-2">Distribusi per kategori:</p>
                <table className="report-table w-full">
                  <thead><tr><th>Kategori</th><th>Jumlah</th></tr></thead>
                  <tbody>
                    {stats.per_kategori.map(b => (
                      <tr key={b.name}><td>{b.name}</td><td className="text-right">{b.total}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="font-semibold text-xs mt-2">Distribusi per prioritas:</p>
                <table className="report-table w-full">
                  <thead><tr><th>Prioritas</th><th>Jumlah</th></tr></thead>
                  <tbody>
                    {stats.per_prioritas.map(b => (
                      <tr key={b.name}><td>{b.name}</td><td className="text-right">{b.total}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ── V. Tabel Hasil Monitoring ── */}
        <section className="mb-4 page-break">
          <h3 className="font-bold mb-1">V. Hasil Monitoring (Daftar Temuan)</h3>
          <table className="report-table w-full">
            <thead>
              <tr>
                <th style={{width:"3%"}}>No</th>
                <th style={{width:"10%"}}>Tanggal</th>
                <th style={{width:"10%"}}>Kode</th>
                <th style={{width:"10%"}}>Sumber</th>
                <th style={{width:"35%"}}>Uraian Temuan</th>
                <th style={{width:"15%"}}>Unit Terdampak</th>
                <th style={{width:"7%"}}>Prioritas</th>
                <th style={{width:"10%"}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr><td colSpan={8} className="text-center italic text-slate-500 py-4">(Tidak ada temuan pada periode ini)</td></tr>
              )}
              {sortedRows.map((r, i) => (
                <tr key={r.id}>
                  <td className="text-center">{i + 1}</td>
                  <td>{r.tanggal_lapor}</td>
                  <td className="font-mono">{r.kode}</td>
                  <td>{r.sumber}</td>
                  <td>{r.deskripsi_masalah}</td>
                  <td>{r.unit_terdampak || "-"}</td>
                  <td className="text-center capitalize">{r.prioritas}</td>
                  <td className="text-center capitalize">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ── VI. Tabel Tindak Lanjut & Verifikasi (Closed Loop) ── */}
        <section className="mb-4 page-break">
          <h3 className="font-bold mb-1">VI. Tindak Lanjut & Verifikasi (Closed Loop)</h3>
          <table className="report-table w-full">
            <thead>
              <tr>
                <th style={{width:"3%"}}>No</th>
                <th style={{width:"10%"}}>Kode</th>
                <th style={{width:"20%"}}>Temuan / Masalah</th>
                <th style={{width:"15%"}}>Akar Masalah</th>
                <th style={{width:"20%"}}>Tindakan Perbaikan</th>
                <th style={{width:"8%"}}>Tgl Selesai</th>
                <th style={{width:"15%"}}>Verifikasi Ulang (Hasil)</th>
                <th style={{width:"9%"}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr><td colSpan={8} className="text-center italic text-slate-500 py-4">(Tidak ada temuan pada periode ini)</td></tr>
              )}
              {sortedRows.map((r, i) => (
                <tr key={r.id}>
                  <td className="text-center">{i + 1}</td>
                  <td className="font-mono">{r.kode}</td>
                  <td>{r.deskripsi_masalah}</td>
                  <td>{r.akar_masalah || "-"}</td>
                  <td>{r.tindakan_perbaikan || "-"}</td>
                  <td className="text-center">{r.tanggal_selesai || "-"}</td>
                  <td>{r.hasil_verifikasi || "-"}</td>
                  <td className="text-center capitalize">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ── VII. Rapat Evaluasi ── */}
        {rapat.length > 0 && (
          <section className="mb-4">
            <h3 className="font-bold mb-1">VII. Rapat Evaluasi</h3>
            <table className="report-table w-full">
              <thead>
                <tr>
                  <th style={{width:"3%"}}>No</th>
                  <th style={{width:"12%"}}>Tanggal</th>
                  <th style={{width:"30%"}}>Judul</th>
                  <th>Ringkasan</th>
                </tr>
              </thead>
              <tbody>
                {rapat.map((r, i) => (
                  <tr key={r.id}>
                    <td className="text-center">{i + 1}</td>
                    <td>{r.tanggal}</td>
                    <td>{r.judul}</td>
                    <td>{r.ringkasan || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── VIII. Penutup ── */}
        <section className="mb-4">
          <h3 className="font-bold mb-1">VIII. Penutup</h3>
          <p className="text-justify leading-relaxed">
            Laporan monitoring dan evaluasi SIMRS periode <strong>{fmtPeriodeID(dari, sampai)}</strong> ini disusun
            sebagai bentuk pertanggungjawaban dan bukti komitmen {namaRS} dalam membangun Zona Integritas Menuju
            WBK. Seluruh temuan telah didokumentasikan, dianalisis akar masalahnya, ditindaklanjuti, dan
            diverifikasi hasilnya sehingga membentuk siklus perbaikan berkelanjutan.
          </p>
        </section>

        {/* ── Lembar Pengesahan ── */}
        <section className="mt-12 grid grid-cols-2 gap-8 text-center">
          <div>
            <p>Diketahui oleh,</p>
            <p>Direktur {namaRS}</p>
            <div className="h-24"></div>
            <p className="border-t border-slate-900 pt-1">__________________________</p>
            <p className="text-xs">NIP. ___________________________</p>
          </div>
          <div>
            <p>Dilaporkan oleh,</p>
            <p>Koordinator IT / SIMRS</p>
            <div className="h-24"></div>
            <p className="border-t border-slate-900 pt-1">__________________________</p>
            <p className="text-xs">NIP. ___________________________</p>
          </div>
        </section>

      </div>
    </div>
  );
}

export default function LaporanMonevPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Memuat laporan...</div>}>
      <LaporanInner />
    </Suspense>
  );
}
