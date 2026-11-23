"use client";

// Laporan Inventaris — pilih jenis + ruangan, lalu Cetak (print-to-PDF browser).

import { useEffect, useState, useCallback } from "react";
import InventarisNav from "@/app/(dashboard)/inventaris/InventarisNav";
import Link from "next/link";
import {
  getInventaris, getInventarisFilters, getJadwalKalibrasi,
  Inventaris, InventarisFilters, JadwalKalibrasi,
} from "@/lib/api";

type Jenis = "kalibrasi" | "aset" | "kondisi";
const fmtRp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
const today = () => new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

function statusKal(j: JadwalKalibrasi) {
  if (j.berikut == null) return "Belum Terjadwal";
  const s = j.sisa_hari ?? 0;
  if (s < 0) return `Jatuh Tempo (${-s} hr)`;
  if (s <= 30) return `Segera (${s} hr)`;
  return `Terjadwal (${s} hr)`;
}

export default function LaporanPage() {
  const [jenis, setJenis] = useState<Jenis>("kalibrasi");
  const [ruangan, setRuangan] = useState("");
  const [filters, setFilters] = useState<InventarisFilters | null>(null);
  const [aset, setAset] = useState<Inventaris[]>([]);
  const [kal, setKal] = useState<JadwalKalibrasi[]>([]);

  useEffect(() => { getInventarisFilters().then(r => setFilters(r.data)).catch(() => {}); }, []);
  const load = useCallback(() => {
    if (jenis === "kalibrasi") getJadwalKalibrasi().then(r => setKal(r.data)).catch(() => {});
    else getInventaris({ ruangan }).then(r => setAset(r.data)).catch(() => {});
  }, [jenis, ruangan]);
  useEffect(() => { load(); }, [load]);

  const judul = jenis === "kalibrasi" ? "Laporan Jadwal Kalibrasi Alat Medis"
    : jenis === "kondisi" ? "Laporan Kondisi Aset" : "Laporan Daftar Aset";
  const kalF = kal.filter(k => !ruangan || k.ruangan === ruangan);

  return (
    <div className="p-6 space-y-5">
      {/* Kontrol (sembunyi saat cetak) */}
      <div className="print:hidden space-y-5">
        <InventarisNav />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-slate-800">Laporan Inventaris</h1>
          <button onClick={() => window.print()} className="px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg">🖶 Cetak / Simpan PDF</button>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Jenis Laporan</label>
            <select value={jenis} onChange={e => setJenis(e.target.value as Jenis)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="kalibrasi">Jadwal Kalibrasi</option>
              <option value="aset">Daftar Aset</option>
              <option value="kondisi">Kondisi Aset</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Ruangan</label>
            <select value={ruangan} onChange={e => setRuangan(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Semua Ruangan</option>
              {(filters?.ruangan ?? []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Area laporan */}
      <div className="laporan bg-white border border-slate-200 rounded-2xl shadow-sm p-8 print:border-0 print:shadow-none print:p-0">
        <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
          <h2 className="text-lg font-bold text-slate-800">RSUD CABANGBUNGIN</h2>
          <p className="text-sm text-slate-600">{judul}{ruangan ? ` — Ruangan ${ruangan}` : ""}</p>
          <p className="text-xs text-slate-500 mt-1">Dicetak: {today()}</p>
        </div>

        {jenis === "kalibrasi" ? (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <Th>No</Th><Th>Nama Alat</Th><Th>Barcode</Th><Th>Ruangan</Th><Th>Kalibrasi Terakhir</Th><Th>Jadwal Berikut</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {kalF.map((k, i) => (
                <tr key={k.id}>
                  <Td>{i + 1}</Td><Td>{k.nama_alat}</Td><Td mono>{k.barcode || "-"}</Td><Td>{k.ruangan || "-"}</Td>
                  <Td>{k.terakhir ?? "—"}</Td><Td>{k.berikut ?? "—"}</Td><Td>{statusKal(k)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <Th>No</Th><Th>Nama Alat</Th><Th>Barcode</Th><Th>Merk/Model</Th><Th>Ruangan</Th><Th>Kategori</Th>
                {jenis === "kondisi" ? <><Th>Kondisi</Th><Th>Status</Th></> : <Th>Nilai</Th>}
              </tr>
            </thead>
            <tbody>
              {aset.map((r, i) => (
                <tr key={r.id}>
                  <Td>{i + 1}</Td><Td>{r.nama_alat}</Td><Td mono>{r.barcode || "-"}</Td>
                  <Td>{[r.merk, r.model].filter(x => x && x !== "-").join(" ")}</Td><Td>{r.ruangan || "-"}</Td><Td>{r.kategori}</Td>
                  {jenis === "kondisi" ? <><Td>{r.kondisi || "-"}</Td><Td>{r.status_laik || "-"}</Td></> : <Td>{r.nilai > 0 ? fmtRp(r.nilai) : "-"}</Td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-2 text-xs text-slate-600">Total: {jenis === "kalibrasi" ? kalF.length : aset.length} aset</div>

        {/* Tanda tangan */}
        <div className="mt-10 flex justify-end print:mt-16">
          <div className="text-center text-xs text-slate-700">
            <p>Cabangbungin, {today()}</p>
            <p>Petugas Inventaris,</p>
            <div className="h-16" />
            <p className="border-t border-slate-500 pt-1 px-6">(………………………………)</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden; }
          .laporan, .laporan * { visibility: visible; }
          .laporan { position: absolute; left: 0; top: 0; width: 100%; }
        }
        .laporan table th, .laporan table td { border: 1px solid #94a3b8; padding: 3px 5px; text-align: left; }
      `}</style>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th className="font-semibold text-slate-700">{children}</th>; }
function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={mono ? "font-mono" : ""}>{children}</td>;
}
