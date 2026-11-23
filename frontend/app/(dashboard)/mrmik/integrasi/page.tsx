"use client";

// Laporan Integrasi Data & Informasi Klinis/Non-Klinis — MRMIK 2 EP 2.
// Auto-agregasi lintas modul (RL 3.1, kunjungan, 10 besar, Mutu, IKP, PPI, K3RS,
// Kepuasan) per triwulan. Bagian III (pemanfaatan/keputusan) editable + tersimpan
// di DATABASE (tabel simrscb_laporan_editan, jenis "mrmik2_keputusan") per-periode
// sehingga bisa diakses lintas perangkat/pengguna, dan ikut tercetak. Tombol Cetak → PDF.

import { useCallback, useEffect, useRef, useState } from "react";
import { getMrmikIntegrasi, MrmikIntegrasi, getSetting, SettingRS, getLaporanEditan, saveLaporanEditan } from "@/lib/api";

const n1 = (x: number | null | undefined) => (x == null ? "-" : x.toLocaleString("id-ID", { maximumFractionDigits: 1 }));
const int = (x: number | null | undefined) => (x == null ? "-" : x.toLocaleString("id-ID"));
const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
// "YYYY-MM-DD" → "DD Bulan YYYY" (format tanggal-bulan-tahun)
const tgl = (s: string | null | undefined) => {
  if (!s) return "-";
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return m >= 1 && m <= 12 ? `${d} ${BULAN_ID[m - 1]} ${y}` : s;
};

type BarisIII = { data: string; forum: string; keputusan: string };

export default function MrmikIntegrasiPage() {
  const now = new Date();
  const [tahun, setTahun] = useState(now.getFullYear());
  const [tw, setTw] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [d, setD] = useState<MrmikIntegrasi | null>(null);
  const [rs, setRs] = useState<SettingRS | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows3, setRows3] = useState<BarisIII[]>([]);
  const [savingIII, setSavingIII] = useState<"" | "menyimpan" | "tersimpan" | "gagal">("");
  const simpanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const muat = useCallback(() => {
    setLoading(true); setErr("");
    getMrmikIntegrasi(tahun, tw)
      .then(r => setD(r.data))
      .catch(() => setErr("Gagal memuat data integrasi"))
      .finally(() => setLoading(false));
  }, [tahun, tw]);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => { getSetting().then(r => setRs(r.data)).catch(() => {}); }, []);
  // Muat Bagian III dari DB per periode.
  useEffect(() => {
    setSavingIII("");
    getLaporanEditan("mrmik2_keputusan", tahun, tw)
      .then(r => { const k = r.data?.konten; setRows3(Array.isArray(k) ? k as BarisIII[] : []); })
      .catch(() => setRows3([]));
  }, [tahun, tw]);
  // Simpan Bagian III ke DB (debounce agar tak flood saat mengetik).
  const simpanRows3 = (rows: BarisIII[]) => {
    setRows3(rows);
    setSavingIII("menyimpan");
    if (simpanTimer.current) clearTimeout(simpanTimer.current);
    simpanTimer.current = setTimeout(() => {
      saveLaporanEditan("mrmik2_keputusan", tahun, tw, rows)
        .then(() => setSavingIII("tersimpan"))
        .catch(() => setSavingIII("gagal"));
    }, 700);
  };

  const twLabel = ["I", "II", "III", "IV"][tw - 1];
  const interp = (cap: number | null, target: string): string => {
    if (cap == null) return "-";
    const t = parseFloat((target || "").replace(/[^0-9.,]/g, "").replace(",", "."));
    if (isNaN(t)) return "-";
    return cap >= t ? "Tercapai" : "Belum tercapai";
  };

  return (
    <div className="p-4 print:p-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          .no-print { display: none !important; }
          .lap { box-shadow: none !important; border: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .lap table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .lap th, .lap td { border: 1px solid #94a3b8; padding: 4px 6px; text-align: left; vertical-align: top; }
        .lap th { background: #e2e8f0; font-weight: 700; }
        .lap h2 { font-size: 13px; font-weight: 700; margin: 14px 0 6px; }
      `}</style>

      {/* Kontrol (tidak dicetak) */}
      <div className="no-print flex flex-wrap items-center gap-2 mb-4">
        <h1 className="text-xl font-bold text-slate-800 mr-2">Laporan Integrasi Data — MRMIK 2 EP 2</h1>
        <select value={tahun} onChange={e => setTahun(+e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm">
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={tw} onChange={e => setTw(+e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm">
          {[1, 2, 3, 4].map(t => <option key={t} value={t}>Triwulan {["I", "II", "III", "IV"][t - 1]}</option>)}
        </select>
        <button onClick={muat} className="bg-slate-600 text-white text-sm rounded px-3 py-1.5">Muat</button>
        <button onClick={() => window.print()} className="bg-emerald-600 text-white text-sm font-semibold rounded px-3 py-1.5">🖨️ Cetak / PDF</button>
      </div>

      {err && <div className="no-print bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-2.5 mb-3">{err}</div>}
      {loading ? <div className="text-slate-400 text-sm">Memuat…</div> : d && (
        <div className="lap bg-white rounded-lg border border-slate-200 shadow-sm p-6 max-w-4xl mx-auto text-slate-900">
          {/* Kop surat resmi (logo Pemkab + RS) */}
          <div className="flex items-center gap-3 border-b-4 border-double border-slate-800 pb-2 mb-3">
            <img src="/logo-daerah.png" alt="Logo Kabupaten Bekasi" className="w-[70px] h-[70px] object-contain shrink-0" />
            <div className="flex-1 text-center leading-tight">
              <div className="text-xs font-semibold">PEMERINTAH KABUPATEN BEKASI</div>
              <div className="text-lg font-bold">{rs?.nama_instansi || "RUMAH SAKIT UMUM DAERAH CABANGBUNGIN"}</div>
              <div className="text-[10px]">{rs?.alamat_instansi || "Jl. Raya Cabangbungin, Kabupaten Bekasi, Jawa Barat"}</div>
              <div className="text-[10px]">{[rs?.kontak && `Telp. ${rs.kontak}`, rs?.email, rs?.website].filter(Boolean).join(" · ")}</div>
            </div>
            <img src="/logo-rs.png" alt="Logo RSUD Cabangbungin" className="w-[70px] h-[70px] object-contain shrink-0" />
            <img src="/logo-kars.png" alt="Terakreditasi Paripurna KARS" className="w-[70px] h-[70px] object-contain shrink-0" />
          </div>
          <div className="text-center mb-4">
            <div className="text-sm font-bold uppercase">Laporan Integrasi Data dan Informasi Klinis dan Non-Klinis</div>
            <div className="text-sm font-bold uppercase">untuk Mendukung Pengambilan Keputusan</div>
            <div className="text-xs mt-1">Periode: Triwulan {twLabel} Tahun {d.periode.tahun}</div>
            <div className="text-[11px] text-slate-500">({tgl(d.periode.tgl_awal)} s/d {tgl(d.periode.tgl_akhir)})</div>
          </div>

          <h2>I. PENDAHULUAN</h2>
          <p className="text-xs text-justify leading-relaxed">
            Rumah Sakit mengintegrasikan data dan informasi klinis maupun non-klinis melalui SIMRS. Data diolah menjadi
            informasi dan disajikan berkala kepada pimpinan dan kepala unit sebagai dasar pengambilan keputusan.
          </p>

          <h2>II. DASHBOARD DATA TERINTEGRASI</h2>
          <div className="text-xs font-semibold mt-2 mb-1">A. Indikator Pelayanan Rawat Inap</div>
          <table>
            <thead><tr><th>Indikator</th><th>Nilai</th><th>Standar</th><th>Interpretasi</th></tr></thead>
            <tbody>
              <tr><td>BOR</td><td>{n1(d.ranap.bor)} %</td><td>60 – 85 %</td><td>{d.ranap.bor >= 60 && d.ranap.bor <= 85 ? "Ideal" : d.ranap.bor > 85 ? "Tinggi" : "Rendah"}</td></tr>
              <tr><td>ALOS</td><td>{n1(d.ranap.alos)} hari</td><td>6 – 9 hari</td><td>{d.ranap.alos >= 6 && d.ranap.alos <= 9 ? "Ideal" : d.ranap.alos < 6 ? "Pendek" : "Panjang"}</td></tr>
              <tr><td>TOI</td><td>{n1(d.ranap.toi)} hari</td><td>1 – 3 hari</td><td>{d.ranap.toi >= 1 && d.ranap.toi <= 3 ? "Ideal" : "Perhatikan"}</td></tr>
              <tr><td>BTO</td><td>{n1(d.ranap.bto)} kali</td><td>40 – 50 kali/th</td><td>—</td></tr>
            </tbody>
          </table>
          <div className="text-[10px] text-slate-500 mt-0.5">TT aktif: {int(d.ranap.tt)} · Hari rawat: {int(d.ranap.hari_rawat)} · Pasien keluar: {int(d.ranap.pasien_keluar)}</div>

          <div className="text-xs font-semibold mt-3 mb-1">B. Kunjungan & 10 Besar Penyakit</div>
          <table>
            <tbody>
              <tr><th style={{ width: "40%" }}>Kunjungan Rawat Jalan</th><td>{int(d.kunjungan.ralan)}</td></tr>
              <tr><th>Kunjungan Gawat Darurat</th><td>{int(d.kunjungan.igd)}</td></tr>
              <tr><th>Kunjungan Rawat Inap</th><td>{int(d.kunjungan.ranap)}</td></tr>
              <tr><th>10 Besar Penyakit</th><td>{d.penyakit10.length ? d.penyakit10.map(p => `${p.nama} (${p.jumlah})`).join("; ") : "-"}</td></tr>
            </tbody>
          </table>

          <div className="text-xs font-semibold mt-3 mb-1">C. Capaian Indikator Mutu (INM & IMP)</div>
          <table>
            <thead><tr><th>Indikator</th><th>Jenis</th><th>Capaian</th><th>Target</th><th>Interpretasi</th></tr></thead>
            <tbody>
              {d.mutu.length ? d.mutu.map((m, i) => (
                <tr key={i}><td>{m.judul}</td><td>{m.jenis.toUpperCase()}</td>
                  <td>{n1(m.capaian)}{m.satuan}</td><td>{m.target}</td><td>{interp(m.capaian, m.target)}</td></tr>
              )) : <tr><td colSpan={5} className="text-center text-slate-400">Belum ada capaian mutu diinput untuk periode ini.</td></tr>}
            </tbody>
          </table>

          <div className="text-xs font-semibold mt-3 mb-1">D. Insiden Keselamatan Pasien (IKP)</div>
          <table>
            <thead><tr><th>Jenis Insiden</th><th>Jumlah</th></tr></thead>
            <tbody>
              {["KPC", "KNC", "KTC", "KTD", "Sentinel"].map(j => {
                const found = d.ikp.find(x => x.jenis.toUpperCase().includes(j.toUpperCase()));
                return <tr key={j}><td>{j}</td><td>{found ? found.jumlah : 0}</td></tr>;
              })}
            </tbody>
          </table>

          <div className="text-xs font-semibold mt-3 mb-1">E. Surveilans Infeksi (HAIs)</div>
          <table>
            <thead><tr><th>Indikator HAIs</th><th style={{ width: 70 }}>Kejadian</th><th style={{ width: 110 }}>Hari Alat</th><th style={{ width: 90 }}>Rate (‰)</th></tr></thead>
            <tbody>
              {d.hais.length ? d.hais.map((h, i) => (
                <tr key={i}>
                  <td>{h.jenis}</td>
                  <td>{int(h.jumlah)}</td>
                  <td>{h.denominator == null ? "—" : int(h.denominator)}</td>
                  <td>{h.rate == null ? "—" : `${n1(h.rate)} ‰`}</td>
                </tr>
              )) : <tr><td colSpan={4} className="text-center text-slate-400">Nihil / belum ada data surveilans.</td></tr>}
            </tbody>
          </table>
          <div className="text-[10px] text-slate-500 mt-0.5">Sumber: surveilans HAIs (data_HAIs) Khanza. Rate = jumlah kejadian ÷ hari pemakaian alat × 1000. HAP/IDO/Dekubitus tanpa denominator alat.</div>

          <div className="text-xs font-semibold mt-3 mb-1">F. Kesehatan & Keselamatan Kerja (K3RS)</div>
          <table>
            <thead><tr><th>Kejadian K3RS</th><th>Jumlah</th></tr></thead>
            <tbody>
              {d.k3rs.length ? d.k3rs.map((k, i) => <tr key={i}><td>{k.jenis}</td><td>{k.jumlah}</td></tr>)
                : <tr><td colSpan={2} className="text-center text-slate-400">Nihil / belum ada data K3RS.</td></tr>}
            </tbody>
          </table>
          <div className="text-[10px] text-slate-500 mt-1">Kepuasan Pasien (IKM): <b>{n1(d.kepuasan.nilai)}</b> ({int(d.kepuasan.responden)} responden)</div>

          {/* III — editable */}
          <div className="flex items-center justify-between mt-4">
            <h2 className="!mb-0">III. PEMANFAATAN DATA UNTUK PENGAMBILAN KEPUTUSAN</h2>
            <div className="no-print flex items-center gap-2">
              {savingIII === "menyimpan" && <span className="text-xs text-slate-400">menyimpan…</span>}
              {savingIII === "tersimpan" && <span className="text-xs text-emerald-600">✓ tersimpan</span>}
              {savingIII === "gagal" && <span className="text-xs text-rose-600">gagal simpan</span>}
              <button className="text-xs bg-sky-600 text-white rounded px-2 py-1"
                onClick={() => simpanRows3([...rows3, { data: "", forum: "", keputusan: "" }])}>+ Baris</button>
            </div>
          </div>
          <table>
            <thead><tr><th style={{ width: 28 }}>No</th><th>Data Terintegrasi</th><th>Forum / Rapat</th><th>Keputusan / Tindak Lanjut</th><th className="no-print" style={{ width: 40 }}></th></tr></thead>
            <tbody>
              {rows3.length ? rows3.map((r, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  {(["data", "forum", "keputusan"] as const).map(f => (
                    <td key={f}>
                      <span className="print:inline hidden">{r[f]}</span>
                      <textarea className="no-print w-full text-xs border-0 resize-none focus:outline-none" rows={2}
                        value={r[f]} onChange={e => { const nn = [...rows3]; nn[i] = { ...nn[i], [f]: e.target.value }; simpanRows3(nn); }} />
                    </td>
                  ))}
                  <td className="no-print"><button className="text-rose-500 text-xs" onClick={() => simpanRows3(rows3.filter((_, k) => k !== i))}>hapus</button></td>
                </tr>
              )) : <tr><td colSpan={5} className="text-center text-slate-400 no-print">Klik "+ Baris" untuk menambah keputusan rapat.</td></tr>}
            </tbody>
          </table>

          <h2>IV. KESIMPULAN</h2>
          <p className="text-xs text-justify leading-relaxed">
            Data klinis dan non-klinis telah diintegrasikan melalui SIMRS dan dimanfaatkan untuk pengambilan keputusan
            pimpinan maupun unit. Laporan disusun berkala (triwulanan) sebagai bagian pemantauan &amp; evaluasi pengelolaan informasi.
          </p>

          <div className="grid grid-cols-2 gap-8 mt-10 text-center text-xs">
            <div>
              <div>Mengetahui,</div><div>Direktur</div>
              <div className="h-[4cm] flex items-end justify-center"><img src="/ttd-direktur.png" alt="Stempel & TTD Direktur" className="w-[4cm] h-[4cm] object-contain" /></div>
              <div className="font-bold underline">dr. Hj. Erni Herdiani, M.H., MARS</div>
            </div>
            <div>
              <div>{(rs?.kabupaten || "Cabangbungin")}, {tgl(d.periode.tgl_akhir)}</div>
              <div>Kepala Unit Teknologi Informasi</div>
              <div className="h-[4cm] flex items-end justify-center"><img src="/ttd-salim.png" alt="TTD dr. Salim" className="h-[2.6cm] object-contain" /></div>
              <div className="font-bold underline">dr. Salim Mulyana, MM.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
