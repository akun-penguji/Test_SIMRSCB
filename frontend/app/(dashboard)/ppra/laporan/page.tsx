"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getSetting, ppraKuantitatif, ppraGyssensRekap,
  SettingRS, PpraKuantitatif, GyssensRekap,
} from "@/lib/api";

const nf = (v: number, d = 2) => v.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const KAT = ["0", "I", "IIA", "IIB", "IIC", "IIIA", "IIIB", "IVA", "IVB", "IVC", "IVD", "V", "VI"];

function LaporanInner() {
  const sp = useSearchParams();
  const jenis = (sp.get("jenis") === "ralan" ? "ralan" : "ranap") as "ranap" | "ralan";
  const tglAwal = sp.get("tgl_awal") ?? undefined;
  const tglAkhir = sp.get("tgl_akhir") ?? undefined;

  const [setting, setSetting] = useState<SettingRS | null>(null);
  const [kuant, setKuant] = useState<PpraKuantitatif | null>(null);
  const [rekap, setRekap] = useState<GyssensRekap | null>(null);

  useEffect(() => {
    getSetting().then(r => setSetting(r.data)).catch(() => {});
    ppraKuantitatif({ jenis, tgl_awal: tglAwal, tgl_akhir: tglAkhir }).then(r => setKuant(r.data)).catch(() => {});
    ppraGyssensRekap({ tgl_awal: tglAwal, tgl_akhir: tglAkhir }).then(r => setRekap(r.data)).catch(() => {});
  }, [jenis, tglAwal, tglAkhir]);

  const perAb = useMemo(() => [...(kuant?.per_antibiotik ?? [])].sort((a, b) => b.total_ddd - a.total_ddd), [kuant]);
  const aware = kuant?.ringkasan.aware;
  const tglCetak = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto mb-4 flex justify-end gap-2 no-print">
        <button onClick={() => window.print()} className="bg-indigo-600 text-white text-sm rounded-lg px-5 py-2 hover:bg-indigo-700">🖨 Cetak / Simpan PDF</button>
      </div>

      <div id="ppra-print" className="max-w-3xl mx-auto bg-white p-8 text-slate-900 text-sm">
        {/* KOP */}
        <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
          <div className="text-lg font-bold uppercase">{setting?.nama_instansi ?? "Rumah Sakit"}</div>
          <div className="text-xs">{setting?.alamat_instansi}{setting?.kabupaten ? `, ${setting.kabupaten}` : ""}{setting?.propinsi ? `, ${setting.propinsi}` : ""}</div>
          <div className="text-xs">{setting?.kontak} {setting?.email && `· ${setting.email}`}</div>
        </div>

        <h1 className="text-center text-base font-bold uppercase mb-1">Laporan Surveilans Penggunaan Antibiotik (PPRA)</h1>
        <p className="text-center text-xs mb-4">
          {jenis === "ranap" ? "Rawat Inap (DDD/100 patient-days)" : "Rawat Jalan (DDD/1000 populasi)"}
          {" · "}Periode {kuant?.periode.tgl_awal} s/d {kuant?.periode.tgl_akhir}
        </p>

        {/* A. Kuantitatif */}
        <h2 className="font-bold border-b border-slate-300 mb-2">A. Surveilans Kuantitatif (ATC/DDD & AWaRe)</h2>
        <table className="w-full mb-3 text-xs">
          <tbody>
            <tr><td className="py-0.5 w-1/2">Total DDD</td><td className="font-mono">{nf(kuant?.ringkasan.total_ddd ?? 0)}</td></tr>
            <tr><td className="py-0.5">{jenis === "ranap" ? "Total hari rawat" : "Total kunjungan"}</td><td className="font-mono">{nf(kuant?.denominator.nilai ?? 0, 0)}</td></tr>
            <tr><td className="py-0.5 font-semibold">{jenis === "ranap" ? "DDD / 100 patient-days" : "DDD / 1000 populasi"}</td><td className="font-mono font-semibold">{nf(kuant?.ringkasan.rasio ?? 0)}</td></tr>
            <tr><td className="py-0.5">Proporsi AWaRe Access</td><td className="font-mono">{nf(aware?.access_persen ?? 0)}% (target {nf(aware?.target_persen ?? 60, 0)}%) — {aware?.memenuhi_target ? "TERCAPAI" : "BELUM"}</td></tr>
            <tr><td className="py-0.5">Access / Watch / Reserve (DDD)</td><td className="font-mono">{nf(aware?.access ?? 0)} / {nf(aware?.watch ?? 0)} / {nf(aware?.reserve ?? 0)}</td></tr>
          </tbody>
        </table>

        <table className="w-full mb-4 text-xs border border-slate-300 border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-1 text-left">Antibiotik</th>
              <th className="border border-slate-300 px-2 py-1 text-left">ATC</th>
              <th className="border border-slate-300 px-2 py-1 text-left">AWaRe</th>
              <th className="border border-slate-300 px-2 py-1 text-right">Total DDD</th>
            </tr>
          </thead>
          <tbody>
            {perAb.length === 0 ? (
              <tr><td colSpan={4} className="border border-slate-300 px-2 py-2 text-center text-slate-400">Tidak ada data.</td></tr>
            ) : perAb.map(a => (
              <tr key={`${a.atc_code}-${a.adm_route}`}>
                <td className="border border-slate-300 px-2 py-0.5">{a.nama_generik}</td>
                <td className="border border-slate-300 px-2 py-0.5 font-mono">{a.atc_code}/{a.adm_route}</td>
                <td className="border border-slate-300 px-2 py-0.5">{a.aware_kategori}</td>
                <td className="border border-slate-300 px-2 py-0.5 text-right font-mono">{nf(a.total_ddd)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* B. Gyssens */}
        <h2 className="font-bold border-b border-slate-300 mb-2">B. Surveilans Kualitatif (Gyssens)</h2>
        {rekap && rekap.total_antibiotik > 0 ? (
          <>
            <p className="text-xs mb-1">
              Total antibiotik dinilai: <b>{rekap.total_antibiotik}</b> · Rasional (kat. 0): <b>{rekap.rasional}</b> ·
              Tidak rasional: <b>{rekap.tidak_rasional}</b> · <b>% Rasional: {nf(rekap.persen_rasional, 1)}%</b>
            </p>
            <table className="w-full mb-4 text-xs border border-slate-300 border-collapse">
              <thead><tr className="bg-slate-100">{KAT.map(k => <th key={k} className="border border-slate-300 px-1 py-1">{k}</th>)}</tr></thead>
              <tbody><tr>{KAT.map(k => <td key={k} className="border border-slate-300 px-1 py-0.5 text-center font-mono">{rekap.distribusi[k] ?? 0}</td>)}</tr></tbody>
            </table>
          </>
        ) : <p className="text-xs text-slate-500 mb-4">Belum ada audit Gyssens pada periode ini.</p>}

        <p className="text-[10px] text-slate-500 italic mb-6">{kuant?.disclaimer}</p>

        {/* TTD */}
        <div className="flex justify-between mt-8 text-xs text-center">
          <div className="w-2/5">
            <div>Mengetahui,</div>
            <div>Ketua Tim PPRA</div>
            <div className="h-16" />
            <div className="border-t border-slate-500 pt-1">(………………………………)</div>
            <div>NIP. ………………………</div>
          </div>
          <div className="w-2/5">
            <div>{setting?.kabupaten ?? "………"}, {tglCetak}</div>
            <div>Direktur {setting?.nama_instansi ?? ""}</div>
            <div className="h-16" />
            <div className="border-t border-slate-500 pt-1">(………………………………)</div>
            <div>NIP. ………………………</div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { visibility: hidden; }
          #ppra-print, #ppra-print * { visibility: visible; }
          #ppra-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .no-print { display: none !important; }
          @page { margin: 1.2cm; }
        }
      `}</style>
    </div>
  );
}

export default function PpraLaporanPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Memuat…</div>}>
      <LaporanInner />
    </Suspense>
  );
}
