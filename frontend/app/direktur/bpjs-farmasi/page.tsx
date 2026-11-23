"use client";

// Dashboard BPJS & Klaim + Farmasi — Direktur.

import { useEffect, useState } from "react";
import Link from "next/link";
import { direkturBpjsFarmasi, DirekturBpjsFarmasi } from "@/lib/api";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const fmtRp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
const fmtRpJt = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n / 1_000_000)) + " jt";

function Stat({ label, value, sub, color = "slate", danger }: {
  label: string; value: string; sub?: string; color?: string; danger?: boolean;
}) {
  const ring = danger ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white";
  return (
    <div className={`rounded-2xl border ${ring} p-5 shadow-sm`}>
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</p>
      <p className={`text-2xl font-black mt-1 ${danger ? "text-rose-700" : "text-slate-800"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function TopTable({ title, rows, satuan, warna }: {
  title: string; rows: { kode: string; nama: string; jumlah: number }[]; satuan: string; warna: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-700 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400 italic">Belum ada data bulan ini.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={r.kode} className="flex items-center gap-3 text-sm">
              <span className="w-5 text-slate-400 text-xs tabular-nums">{i + 1}.</span>
              <span className="flex-1 text-slate-700 truncate" title={r.nama}>{r.nama}</span>
              <span className={`font-bold tabular-nums ${warna}`}>{fmt(r.jumlah)}</span>
              <span className="text-[10px] text-slate-400 w-10">{satuan}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DirekturBpjsFarmasiPage() {
  const [d, setD] = useState<DirekturBpjsFarmasi | null>(null);

  useEffect(() => {
    const load = () => direkturBpjsFarmasi().then(r => setD(r.data)).catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  if (!d) return <div className="text-center text-slate-500 py-20">Memuat data BPJS & Farmasi...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/direktur" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">BPJS & Klaim + Farmasi</h1>
          <p className="text-sm text-slate-500">Piutang BPJS, SEP, dan kondisi persediaan · auto-refresh 1 menit.</p>
        </div>
      </div>

      {/* BPJS & Klaim */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">BPJS & Klaim</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="SEP Bulan Ini" value={fmt(d.bpjs.sep_mtd)} sub={`Hari ini: ${fmt(d.bpjs.sep_today)}`} />
          <Stat label="SEP Hari Ini" value={fmt(d.bpjs.sep_today)} sub="Terbit hari ini" />
          <Stat label="Piutang BPJS" value={fmtRpJt(d.bpjs.piutang_bpjs)} sub={fmtRp(d.bpjs.piutang_bpjs)}
            danger={d.bpjs.piutang_bpjs > 0} />
          <Stat label="Piutang Total" value={fmtRpJt(d.bpjs.piutang_total)} sub="Semua penjamin" />
        </div>
      </section>

      {/* Farmasi ringkas */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Farmasi — Persediaan</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Nilai Persediaan" value={fmtRpJt(d.farmasi.nilai_persediaan)} sub={fmtRp(d.farmasi.nilai_persediaan)} />
          <Stat label="Total Item Aktif" value={fmt(d.farmasi.jml_item)} sub="Obat & BHP" />
          <Stat label="Stok Kosong" value={fmt(d.farmasi.kosong)} sub="Item tanpa stok" danger={d.farmasi.kosong > 0} />
          <Stat label="Hampir Habis" value={fmt(d.farmasi.hampir_habis)} sub="≤ stok minimum" danger={d.farmasi.hampir_habis > 0} />
        </div>
      </section>

      {/* Fast / Slow moving */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopTable title="🔥 Fast Moving (bulan ini)" rows={d.farmasi.fast_moving} satuan="keluar" warna="text-emerald-700" />
        <TopTable title="🐌 Slow Moving (stok besar, tak keluar)" rows={d.farmasi.slow_moving} satuan="stok" warna="text-amber-700" />
      </section>

      <p className="text-xs text-slate-400 text-center">
        Obat <em>expired</em> belum ditampilkan — tabel stok belum menyimpan tanggal kadaluarsa per batch.
      </p>
    </div>
  );
}
