"use client";

// Laporan Hasil Evaluasi Insiden Keselamatan Pasien (IKP) — reproduksi format
// laporan Komite Mutu per triwulan dari modul PMKP Insiden (simrscb_insiden):
// rekap per jenis/grading/tipe/bulan/unit, ketepatan lapor ≤2x24 jam, line-list.
// Bagian rekomendasi/tindak lanjut editable + tersimpan DB. Tombol Cetak → PDF.

import { useCallback, useEffect, useRef, useState } from "react";
import { getMrmikIkp, MrmikIkp, getSetting, SettingRS, getLaporanEditan, saveLaporanEditan } from "@/lib/api";

const int = (x: number | null | undefined) => (x == null ? "-" : x.toLocaleString("id-ID"));
const pct = (x: number | null | undefined) => (x == null ? "-" : x.toLocaleString("id-ID", { maximumFractionDigits: 1 }));
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const bulanLabel = (ym: string) => { const m = +ym.slice(5, 7); return m >= 1 && m <= 12 ? `${BULAN[m - 1]} ${ym.slice(0, 4)}` : ym; };
// "YYYY-MM-DD" → "DD Bulan YYYY" (format tanggal-bulan-tahun)
const tgl = (s: string | null | undefined) => {
  if (!s) return "-";
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return m >= 1 && m <= 12 ? `${d} ${BULAN_ID[m - 1]} ${y}` : s;
};
// versi ringkas utk tabel: "DD Bul YYYY"
const tglShort = (s: string | null | undefined) => {
  if (!s) return "-";
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return m >= 1 && m <= 12 ? `${d} ${BULAN[m - 1]} ${y}` : s;
};

export default function MrmikIkpPage() {
  const now = new Date();
  const [tahun, setTahun] = useState(now.getFullYear());
  const [tw, setTw] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [d, setD] = useState<MrmikIkp | null>(null);
  const [rs, setRs] = useState<SettingRS | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [analisa, setAnalisa] = useState("");
  const [rekom, setRekom] = useState("");
  const [saving, setSaving] = useState<"" | "menyimpan" | "tersimpan" | "gagal">("");
  const simpanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const muat = useCallback(() => {
    setLoading(true); setErr("");
    getMrmikIkp(tahun, tw)
      .then(r => setD(r.data))
      .catch(() => setErr("Gagal memuat data IKP"))
      .finally(() => setLoading(false));
  }, [tahun, tw]);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => { getSetting().then(r => setRs(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    setSaving("");
    getLaporanEditan("ikp_evaluasi", tahun, tw)
      .then(r => { const k = r.data?.konten as { analisa?: string; rekomendasi?: string } | null;
        setAnalisa(k?.analisa || ""); setRekom(k?.rekomendasi || ""); })
      .catch(() => { setAnalisa(""); setRekom(""); });
  }, [tahun, tw]);
  const simpan = (a: string, r: string) => {
    setSaving("menyimpan");
    if (simpanTimer.current) clearTimeout(simpanTimer.current);
    simpanTimer.current = setTimeout(() => {
      saveLaporanEditan("ikp_evaluasi", tahun, tw, { analisa: a, rekomendasi: r })
        .then(() => setSaving("tersimpan")).catch(() => setSaving("gagal"));
    }, 700);
  };

  const twLabel = ["I", "II", "III", "IV"][tw - 1];
  const gradeColor = (g: string): string => {
    const s = g.toLowerCase();
    if (s.includes("merah")) return "#dc2626";
    if (s.includes("kuning")) return "#ca8a04";
    if (s.includes("biru")) return "#2563eb";
    if (s.includes("hijau")) return "#16a34a";
    return "#64748b";
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

      <div className="no-print flex flex-wrap items-center gap-2 mb-4">
        <h1 className="text-xl font-bold text-slate-800 mr-2">Laporan Evaluasi Insiden (IKP)</h1>
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
            <div className="text-sm font-bold uppercase">Laporan Hasil Evaluasi Insiden Keselamatan Pasien (IKP)</div>
            <div className="text-xs mt-1">Periode: Triwulan {twLabel} Tahun {d.periode.tahun}</div>
            <div className="text-[11px] text-slate-500">({tgl(d.periode.tgl_awal)} s/d {tgl(d.periode.tgl_akhir)})</div>
          </div>

          <h2>I. PENDAHULUAN</h2>
          <p className="text-xs text-justify leading-relaxed">
            Insiden Keselamatan Pasien (IKP) merupakan setiap kejadian yang tidak disengaja dan kondisi yang mengakibatkan
            atau berpotensi mengakibatkan cedera yang dapat dicegah pada pasien. Laporan ini merekapitulasi seluruh insiden
            yang dilaporkan pada periode berjalan sebagai bahan analisis dan tindak lanjut perbaikan mutu &amp; keselamatan pasien.
          </p>

          <h2>II. REKAPITULASI INSIDEN</h2>
          <div className="text-xs mb-2">Jumlah insiden dilaporkan pada periode ini: <b>{int(d.jumlah_laporan)}</b> laporan ·
            Ketepatan lapor ≤ 2×24 jam: <b>{pct(d.ketepatan_2x24)}%</b></div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold mb-1">A. Menurut Jenis Insiden</div>
              <table>
                <thead><tr><th>Jenis</th><th style={{ width: 60 }}>Jumlah</th></tr></thead>
                <tbody>
                  {d.per_jenis.length ? d.per_jenis.map((x, i) => <tr key={i}><td>{x.label}</td><td>{x.jumlah}</td></tr>)
                    : <tr><td colSpan={2} className="text-center text-slate-400">Nihil</td></tr>}
                </tbody>
              </table>
            </div>
            <div>
              <div className="text-xs font-semibold mb-1">B. Menurut Grading Risiko</div>
              <table>
                <thead><tr><th>Grading</th><th style={{ width: 60 }}>Jumlah</th></tr></thead>
                <tbody>
                  {d.per_grading.length ? d.per_grading.map((x, i) => (
                    <tr key={i}><td><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: gradeColor(x.label), marginRight: 5 }} />{x.label}</td><td>{x.jumlah}</td></tr>
                  )) : <tr><td colSpan={2} className="text-center text-slate-400">Nihil</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <div className="text-xs font-semibold mb-1">C. Menurut Tipe Insiden</div>
              <table>
                <thead><tr><th>Tipe</th><th style={{ width: 60 }}>Jumlah</th></tr></thead>
                <tbody>
                  {d.per_tipe.length ? d.per_tipe.map((x, i) => <tr key={i}><td>{x.label}</td><td>{x.jumlah}</td></tr>)
                    : <tr><td colSpan={2} className="text-center text-slate-400">Nihil</td></tr>}
                </tbody>
              </table>
            </div>
            <div>
              <div className="text-xs font-semibold mb-1">D. Menurut Bulan</div>
              <table>
                <thead><tr><th>Bulan</th><th style={{ width: 60 }}>Jumlah</th></tr></thead>
                <tbody>
                  {d.per_bulan.length ? d.per_bulan.map((x, i) => <tr key={i}><td>{bulanLabel(x.label)}</td><td>{x.jumlah}</td></tr>)
                    : <tr><td colSpan={2} className="text-center text-slate-400">Nihil</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-xs font-semibold mt-3 mb-1">E. Menurut Unit Terjadi</div>
          <table>
            <thead><tr><th>Unit</th><th style={{ width: 80 }}>Jumlah</th></tr></thead>
            <tbody>
              {d.per_unit.length ? d.per_unit.map((x, i) => <tr key={i}><td>{x.label}</td><td>{x.jumlah}</td></tr>)
                : <tr><td colSpan={2} className="text-center text-slate-400">Nihil</td></tr>}
            </tbody>
          </table>

          <h2>III. DAFTAR INSIDEN (LINE-LIST)</h2>
          <table>
            <thead><tr><th style={{ width: 24 }}>No</th><th style={{ width: 78 }}>Tanggal</th><th>Jenis</th><th>Tipe</th><th>Uraian</th><th style={{ width: 64 }}>Grading</th></tr></thead>
            <tbody>
              {d.linelist.length ? d.linelist.map((x, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{tglShort(x.tanggal)}</td>
                  <td>{x.jenis}</td>
                  <td>{x.tipe}</td>
                  <td>{x.judul || x.kronologi}</td>
                  <td><span style={{ color: gradeColor(x.grading), fontWeight: 700 }}>{x.grading}</span></td>
                </tr>
              )) : <tr><td colSpan={6} className="text-center text-slate-400">Tidak ada insiden pada periode ini.</td></tr>}
            </tbody>
          </table>

          <div className="flex items-center justify-between mt-4">
            <h2 className="!mb-0">IV. ANALISIS &amp; TINDAK LANJUT</h2>
            <div className="no-print flex items-center gap-2">
              {saving === "menyimpan" && <span className="text-xs text-slate-400">menyimpan…</span>}
              {saving === "tersimpan" && <span className="text-xs text-emerald-600">✓ tersimpan</span>}
              {saving === "gagal" && <span className="text-xs text-rose-600">gagal simpan</span>}
            </div>
          </div>
          <div className="text-xs font-semibold mt-1 mb-1">Analisis</div>
          <div className="text-xs whitespace-pre-wrap print:block hidden border border-slate-300 p-2 min-h-[48px]">{analisa || "-"}</div>
          <textarea className="no-print w-full text-xs border border-slate-300 rounded p-2" rows={3}
            placeholder="Analisis tren insiden, akar masalah, dsb." value={analisa}
            onChange={e => { setAnalisa(e.target.value); simpan(e.target.value, rekom); }} />
          <div className="text-xs font-semibold mt-2 mb-1">Rekomendasi / Tindak Lanjut</div>
          <div className="text-xs whitespace-pre-wrap print:block hidden border border-slate-300 p-2 min-h-[48px]">{rekom || "-"}</div>
          <textarea className="no-print w-full text-xs border border-slate-300 rounded p-2" rows={3}
            placeholder="Rekomendasi perbaikan & rencana tindak lanjut." value={rekom}
            onChange={e => { setRekom(e.target.value); simpan(analisa, e.target.value); }} />

          <div className="grid grid-cols-2 gap-8 mt-10 text-center text-xs">
            <div>
              <div>Mengetahui,</div><div>Direktur</div>
              <div className="h-[4cm] flex items-end justify-center"><img src="/ttd-direktur.png" alt="Stempel & TTD Direktur" className="w-[4cm] h-[4cm] object-contain" /></div>
              <div className="font-bold underline">dr. Hj. Erni Herdiani, M.H., MARS</div>
            </div>
            <div>
              <div>{(rs?.kabupaten || "Cabangbungin")}, {tgl(d.periode.tgl_akhir)}</div>
              <div>Ketua Komite Mutu / Sub-Komite Keselamatan Pasien</div>
              <div className="h-[4cm]" />
              <div className="font-bold underline">.................................</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
