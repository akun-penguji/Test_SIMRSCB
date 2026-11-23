"use client";

// Jadwal Kalibrasi — aset wajib kalibrasi + status jatuh tempo (EWS alat medis).

import { useEffect, useState, useMemo } from "react";
import InventarisNav from "@/app/(dashboard)/inventaris/InventarisNav";
import Link from "next/link";
import { getJadwalKalibrasi, JadwalKalibrasi } from "@/lib/api";

function statusOf(j: JadwalKalibrasi): { t: string; cls: string; rank: number } {
  if (j.berikut == null) return { t: "Belum Terjadwal", cls: "bg-slate-100 text-slate-500", rank: 2 };
  const s = j.sisa_hari ?? 0;
  if (s < 0) return { t: `Jatuh Tempo (${-s} hr)`, cls: "bg-rose-100 text-rose-700", rank: 0 };
  if (s <= 30) return { t: `Segera (${s} hr)`, cls: "bg-amber-100 text-amber-700", rank: 1 };
  return { t: `Terjadwal (${s} hr)`, cls: "bg-emerald-100 text-emerald-700", rank: 3 };
}

export default function KalibrasiPage() {
  const [rows, setRows] = useState<JadwalKalibrasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    getJadwalKalibrasi().then(r => setRows(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const stat = useMemo(() => {
    let jt = 0, segera = 0, belum = 0;
    rows.forEach(r => { const s = statusOf(r); if (s.rank === 0) jt++; else if (s.rank === 1) segera++; else if (s.rank === 2) belum++; });
    return { jt, segera, belum, total: rows.length };
  }, [rows]);

  const filtered = rows.filter(r =>
    !q || r.nama_alat.toLowerCase().includes(q.toLowerCase()) || (r.barcode || "").includes(q) || (r.ruangan || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 space-y-5">
      <InventarisNav />
      <div>
        <h1 className="text-xl font-bold text-slate-800">Jadwal Kalibrasi Alat Medis</h1>
        <p className="text-sm text-slate-500">Aset wajib kalibrasi & status jatuh tempo. Catat kalibrasi lewat menu Riwayat tiap aset.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SCard label="Wajib Kalibrasi" value={stat.total} />
        <SCard label="Jatuh Tempo" value={stat.jt} color="text-rose-700" danger={stat.jt > 0} />
        <SCard label="Segera (≤30 hr)" value={stat.segera} color="text-amber-700" />
        <SCard label="Belum Terjadwal" value={stat.belum} color="text-slate-500" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama/barcode/ruangan…"
          className="w-full md:w-96 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5 text-left">Nama Alat</th>
                <th className="px-3 py-2.5 text-left">Barcode</th>
                <th className="px-3 py-2.5 text-left">Ruangan</th>
                <th className="px-3 py-2.5 text-left">Kalibrasi Terakhir</th>
                <th className="px-3 py-2.5 text-left">Jadwal Berikutnya</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Memuat…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Tidak ada data.</td></tr>
              ) : filtered.map(r => {
                const s = statusOf(r);
                return (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2"><Link href={`/inventaris/${r.id}`} className="font-semibold text-green-700 hover:underline">{r.nama_alat}</Link></td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.barcode || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.ruangan || "-"}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.terakhir ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.berikut ?? "—"}</td>
                    <td className="px-3 py-2 text-center"><span className={`text-xs font-semibold rounded px-2 py-0.5 whitespace-nowrap ${s.cls}`}>{s.t}</span></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap"><Link href={`/inventaris/${r.id}`} className="text-xs text-green-700 hover:underline">Catat Kalibrasi</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100">{filtered.length} aset</div>
      </div>
    </div>
  );
}

function SCard({ label, value, color = "text-slate-800", danger }: { label: string; value: number; color?: string; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${danger ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}>
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</p>
      <p className={`text-2xl font-black mt-1 ${color}`}>{new Intl.NumberFormat("id-ID").format(value)}</p>
    </div>
  );
}
