"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { rekapLogKinerja, RekapHarianRow } from "@/lib/api";
import { getSession } from "@/lib/auth";

function thisMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtMenit(m: number | null): string {
  if (!m) return "-";
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min} mnt`;
  if (min === 0) return `${h} jam`;
  return `${h} jam ${min} mnt`;
}

interface Totals {
  totalLog: number;
  totalMenit: number;
  bulan: string;
  nip: string;
}

export default function RekapLogKinerjaPage() {
  const session = typeof window !== "undefined" ? getSession() : null;
  const [bulan, setBulan] = useState(thisMonthStr());
  const [rows, setRows] = useState<RekapHarianRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ totalLog: 0, totalMenit: 0, bulan: "", nip: "" });
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    rekapLogKinerja({ bulan })
      .then(r => {
        setRows(r.data.data || []);
        setTotals({
          totalLog:   r.data.total_log,
          totalMenit: r.data.total_menit,
          bulan:      r.data.bulan,
          nip:        r.data.nip,
        });
      })
      .catch(() => setErrMsg("Gagal memuat rekap"))
      .finally(() => setLoading(false));
  }, [bulan]);

  useEffect(() => { reload(); }, [reload]);

  const hariAktif = rows.length;
  const avgMenit  = hariAktif > 0 ? Math.round(totals.totalMenit / hariAktif) : 0;

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/log-kinerja" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </Link>
        <h1 className="flex-1 text-lg font-bold text-slate-800">Rekap Log Kinerja Bulanan</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Pegawai</label>
            <p className="text-sm text-slate-900 font-semibold">{session?.nama || "-"}</p>
            <p className="text-xs text-slate-500 font-mono">{session?.kode || "-"}</p>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Bulan</label>
            <input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
        </div>
      </div>

      {errMsg && <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm">{errMsg}</div>}

      {/* Kartu ringkasan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Hari Aktif"   value={`${hariAktif} hari`} />
        <StatCard label="Total Log"    value={`${totals.totalLog} kegiatan`} />
        <StatCard label="Total Jam"    value={fmtMenit(totals.totalMenit)} />
        <StatCard label="Rata2/Hari"   value={fmtMenit(avgMenit)} />
      </div>

      {/* Tabel rekap harian */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-slate-400 text-sm">Memuat...</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm italic">Belum ada log untuk bulan ini.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left p-3 border-b">Tanggal</th>
                  <th className="text-right p-3 border-b">Log</th>
                  <th className="text-right p-3 border-b">Total Jam</th>
                  <th className="text-left p-3 border-b">Kegiatan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.tanggal} className="hover:bg-slate-50 align-top border-b last:border-b-0">
                    <td className="p-3 text-slate-900 font-mono whitespace-nowrap">
                      <Link href={`/log-kinerja?tanggal=${r.tanggal}`} className="hover:underline">{r.tanggal}</Link>
                    </td>
                    <td className="p-3 text-slate-900 text-right">{r.jumlah_log}</td>
                    <td className="p-3 text-slate-700 text-right whitespace-nowrap">{fmtMenit(r.total_menit)}</td>
                    <td className="p-3 text-slate-700">{r.judul_list || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}
