"use client";

import { useEffect, useState } from "react";
import { direkturSdm, DirekturSdm } from "@/lib/api";

function CompList({ title, items, color = "amber" }: {
  title: string;
  items: { kategori: string; jumlah: number }[];
  color?: string;
}) {
  const total = items.reduce((a, x) => a + x.jumlah, 0);
  const colorMap: Record<string, string> = {
    amber: "bg-amber-500", blue: "bg-blue-500", emerald: "bg-emerald-500", violet: "bg-violet-500",
  };
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
      <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold mb-3">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 italic">Tidak ada data.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => {
            const pct = total > 0 ? (it.jumlah / total) * 100 : 0;
            return (
              <li key={i} className="text-sm">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-slate-700 truncate flex-1">{it.kategori}</span>
                  <span className="text-amber-700 font-bold tabular-nums">{it.jumlah}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full ${colorMap[color]}`} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function DirekturSdmPage() {
  const [data, setData] = useState<DirekturSdm | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    direkturSdm().then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-slate-500 py-20">Memuat...</div>;
  if (!data)   return <div className="text-center text-rose-600 py-20">Gagal memuat.</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-green-700 font-semibold">Sumber Daya Manusia</p>
        <h1 className="text-2xl font-bold text-slate-800">Komposisi Pegawai & Tenaga Kesehatan</h1>
      </div>

      <div className="bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-amber-500/30 rounded-2xl p-6">
        <p className="text-[10px] uppercase tracking-widest text-amber-700 font-semibold mb-1">Total Pegawai Aktif</p>
        <p className="text-5xl font-black text-slate-800">{data.total_aktif}</p>
        <p className="text-xs text-slate-500 mt-1">Seluruh karyawan dengan status aktif</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CompList title="Komposisi per Jabatan"     items={data.per_jabatan}          color="amber" />
        <CompList title="Komposisi per Pendidikan"  items={data.per_pendidikan}       color="blue" />
        <CompList title="Dokter per Spesialisasi"   items={data.dokter_per_spesialis} color="violet" />
      </div>
    </div>
  );
}
