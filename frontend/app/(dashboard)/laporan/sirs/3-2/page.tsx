"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getSirsRl32, cetakSirsRl32, Rl32Resp, sirsBotSubmit } from "@/lib/api";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Rl32Page() {
  const [bulan, setBulan] = useState(thisMonth());
  const [data, setData] = useState<Rl32Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleKirimSirs = async () => {
    if (!data || data.rows.length === 0) return;
    if (!confirm(`Kirim laporan RL 3.2 untuk periode ${bulan} ke SIRS Online Kemenkes RI?\nData akan divalidasi dengan aturan Juknis 6.3.`)) {
      return;
    }
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const payload = {
        tahun: parseInt(bulan.substring(0, 4)),
        bulan: parseInt(bulan.substring(5, 7)),
        tahunDanBulan: `${bulan}-01`,
        data: data.rows.map((r, idx) => ({
          jenis_pelayanan_id: idx + 1,
          alokasi_tempat_tidur: 0,
          pasien_awal_bulan: 0,
          pasien_masuk: r.pasien_masuk,
          pasien_pindahan: 0,
          pasien_dipindahkan: r.pasien_dipindahkan,
          pasien_keluar_hidup: r.pasien_keluar_hidup,
          pasien_keluar_mati_kurang_48_l: r.pasien_l_mati_lt48,
          pasien_keluar_mati_lebih_48_l: r.pasien_l_mati_ge48,
          pasien_keluar_mati_kurang_48_p: r.pasien_p_mati_lt48,
          pasien_keluar_mati_lebih_48_p: r.pasien_p_mati_ge48,
          pasien_akhir_bulan: 0,
          jumlah_lama_dirawat: r.lama_dirawat,
          jumlah_hari_perawatan: r.hari_perawatan,
          rincian_hari_perawatan_vvip: 0,
          rincian_hari_perawatan_vip: r.hari_kelas_utama,
          rincian_hari_perawatan_1: r.hari_kelas_1,
          rincian_hari_perawatan_2: r.hari_kelas_2,
          rincian_hari_perawatan_3: r.hari_kelas_3,
          rincian_hari_perawatan_khusus: 0,
        })),
      };
      const res = await sirsBotSubmit("rl32", payload);
      setSubmitResult({ success: true, message: res.data.message || "Laporan berhasil terkirim ke Kemenkes RI!" });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || "Pengiriman ditolak oleh server Kemenkes";
      setSubmitResult({ success: false, message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl32(bulan).then(r => setData(r.data))
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => { reload(); }, [reload]);

  const handleCetak = async () => {
    try { await cetakSirsRl32(bulan); }
    catch { setErrMsg("Gagal cetak"); }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-4">
        <Link href="/laporan/sirs" className="text-xs text-slate-500 hover:text-green-700">
          ← Laporan SIRS 6.3
        </Link>
        <div className="flex items-start gap-3 mt-2">
          <span className="font-mono text-lg font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded">
            RL 3.2
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800 leading-tight">Rekapitulasi Kegiatan Pelayanan Rawat Inap</h1>
            <p className="text-xs text-slate-500 mt-1">
              SIRS Online · Bulanan · Sumber: <span className="font-medium">kamar_inap × kamar × bangsal × pasien Khanza</span>
            </p>
          </div>
          <button onClick={handleCetak}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Cetak
          </button>
          <button onClick={handleKirimSirs} disabled={submitting || !data || data.rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium shadow-sm transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {submitting ? "Mengirim ke SIRS..." : "Kirim ke SIRS Online"}
          </button>
        </div>
      </div>

      {errMsg && <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm">{errMsg}</div>}
      {submitResult && (
        <div className={`mb-3 border rounded-xl px-4 py-3 text-sm whitespace-pre-line ${
          submitResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-900"
        }`}>
          <div className="font-semibold">{submitResult.success ? "✓ Berhasil Dikirim ke SIRS Online" : "⚠ Perhatian / Validasi Juknis 6.3"}</div>
          <div className="mt-1 text-xs">{submitResult.message}</div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-xs text-slate-900 font-semibold block mb-1">Bulan pelaporan</label>
          <input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900" />
        </div>
        {data && (
          <div className="text-xs text-slate-500">
            Periode: <span className="font-mono">{data.bulan_dari}</span> s/d <span className="font-mono">{data.bulan_sampai}</span>
            ({data.hari_periode} hari)
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat...</div>
      ) : !data || data.rows.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6 italic">Tidak ada aktivitas rawat inap di periode ini.</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <Stat label="Total Masuk" value={data.total.pasien_masuk} color="text-blue-700" />
            <Stat label="Keluar Hidup" value={data.total.pasien_keluar_hidup} color="text-emerald-700" />
            <Stat label="Mati Total" value={data.total.total_mati} color="text-red-700" />
            <Stat label="Pindah Kamar" value={data.total.pasien_dipindahkan} color="text-amber-700" />
            <Stat label="Hari Perawatan" value={data.total.hari_perawatan} color="text-indigo-700" />
          </div>

          {/* Big table — scroll x */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-900 uppercase font-bold">
                <tr className="border-b border-slate-300">
                  <th rowSpan={2} className="text-left p-2 border-r whitespace-nowrap">No</th>
                  <th rowSpan={2} className="text-left p-2 border-r whitespace-nowrap sticky left-0 bg-slate-50 z-10">Jenis Pelayanan (Bangsal)</th>
                  <th rowSpan={2} className="text-right p-2 border-r whitespace-nowrap">Pasien Masuk</th>
                  <th rowSpan={2} className="text-right p-2 border-r whitespace-nowrap">Pindah Kamar</th>
                  <th rowSpan={2} className="text-right p-2 border-r whitespace-nowrap">Keluar Hidup</th>
                  <th colSpan={2} className="text-center p-2 border-r border-b bg-blue-100">L Mati</th>
                  <th colSpan={2} className="text-center p-2 border-r border-b bg-pink-100">P Mati</th>
                  <th rowSpan={2} className="text-right p-2 border-r whitespace-nowrap">Lama Dirawat</th>
                  <th rowSpan={2} className="text-right p-2 border-r whitespace-nowrap">Hari Rwt</th>
                  <th colSpan={4} className="text-center p-2 border-b bg-emerald-100">Hari Perawatan per Kelas</th>
                </tr>
                <tr>
                  <th className="text-right p-2 border-r bg-blue-50 whitespace-nowrap">&lt;48 jam</th>
                  <th className="text-right p-2 border-r bg-blue-50 whitespace-nowrap">≥48 jam</th>
                  <th className="text-right p-2 border-r bg-pink-50 whitespace-nowrap">&lt;48 jam</th>
                  <th className="text-right p-2 border-r bg-pink-50 whitespace-nowrap">≥48 jam</th>
                  <th className="text-right p-2 border-r bg-emerald-50 whitespace-nowrap">Utama</th>
                  <th className="text-right p-2 border-r bg-emerald-50 whitespace-nowrap">Kls 1</th>
                  <th className="text-right p-2 border-r bg-emerald-50 whitespace-nowrap">Kls 2</th>
                  <th className="text-right p-2 bg-emerald-50 whitespace-nowrap">Kls 3</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={r.jenis_pelayanan} className="hover:bg-slate-50 border-b border-slate-100">
                    <td className="p-2 border-r text-slate-900 font-mono">{i + 1}</td>
                    <td className="p-2 border-r font-medium text-slate-900 sticky left-0 bg-white">{r.jenis_pelayanan}</td>
                    <td className="p-2 border-r text-right tabular-nums text-slate-900 font-semibold">{r.pasien_masuk}</td>
                    <td className="p-2 border-r text-right tabular-nums text-slate-900">{r.pasien_dipindahkan}</td>
                    <td className="p-2 border-r text-right tabular-nums text-slate-900 font-semibold">{r.pasien_keluar_hidup}</td>
                    <td className="p-2 border-r text-right tabular-nums text-slate-900">{r.pasien_l_mati_lt48 || ""}</td>
                    <td className="p-2 border-r text-right tabular-nums text-slate-900">{r.pasien_l_mati_ge48 || ""}</td>
                    <td className="p-2 border-r text-right tabular-nums text-slate-900">{r.pasien_p_mati_lt48 || ""}</td>
                    <td className="p-2 border-r text-right tabular-nums text-slate-900">{r.pasien_p_mati_ge48 || ""}</td>
                    <td className="p-2 border-r text-right tabular-nums text-slate-900 font-semibold">{r.lama_dirawat}</td>
                    <td className="p-2 border-r text-right tabular-nums text-slate-900 font-semibold">{r.hari_perawatan}</td>
                    <td className="p-2 border-r text-right tabular-nums text-slate-900">{r.hari_kelas_utama || ""}</td>
                    <td className="p-2 border-r text-right tabular-nums text-slate-900">{r.hari_kelas_1 || ""}</td>
                    <td className="p-2 border-r text-right tabular-nums text-slate-900">{r.hari_kelas_2 || ""}</td>
                    <td className="p-2 text-right tabular-nums text-slate-900">{r.hari_kelas_3 || ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-blue-50 font-bold text-slate-900">
                <tr>
                  <td className="p-2 border-r">99</td>
                  <td className="p-2 border-r sticky left-0 bg-blue-50">TOTAL</td>
                  <td className="p-2 border-r text-right tabular-nums">{data.total.pasien_masuk}</td>
                  <td className="p-2 border-r text-right tabular-nums">{data.total.pasien_dipindahkan}</td>
                  <td className="p-2 border-r text-right tabular-nums">{data.total.pasien_keluar_hidup}</td>
                  <td className="p-2 border-r text-right tabular-nums">{data.total.pasien_l_mati_lt48}</td>
                  <td className="p-2 border-r text-right tabular-nums">{data.total.pasien_l_mati_ge48}</td>
                  <td className="p-2 border-r text-right tabular-nums">{data.total.pasien_p_mati_lt48}</td>
                  <td className="p-2 border-r text-right tabular-nums">{data.total.pasien_p_mati_ge48}</td>
                  <td className="p-2 border-r text-right tabular-nums">{data.total.lama_dirawat}</td>
                  <td className="p-2 border-r text-right tabular-nums">{data.total.hari_perawatan}</td>
                  <td className="p-2 border-r text-right tabular-nums">{data.total.hari_kelas_utama}</td>
                  <td className="p-2 border-r text-right tabular-nums">{data.total.hari_kelas_1}</td>
                  <td className="p-2 border-r text-right tabular-nums">{data.total.hari_kelas_2}</td>
                  <td className="p-2 text-right tabular-nums">{data.total.hari_kelas_3}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4 text-xs text-amber-900">
            <p className="font-semibold mb-1">📝 Catatan implementasi</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>Kolom <strong>Pasien Awal Bulan</strong>, <strong>Pasien Akhir Bulan</strong>, <strong>Pasien Pindahan (incoming)</strong>, dan <strong>Jumlah Alokasi TT Awal</strong> per JUKNIS belum termasuk — perlu query lebih kompleks atau override manual.</li>
              <li>Kelas Khanza: <strong>Utama / Kelas 1 / Kelas 2 / Kelas 3</strong>. Per JUKNIS ada <em>VVIP / VIP / I / II / III / Khusus</em>. Mapping default: Utama → VIP. Sesuaikan internal RS.</li>
              <li>Jenis Pelayanan diambil dari <strong>nm_bangsal</strong> (asumsi: 1 bangsal = 1 jenis pelayanan). Bangsal tanpa aktivitas di periode tidak ditampilkan.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
