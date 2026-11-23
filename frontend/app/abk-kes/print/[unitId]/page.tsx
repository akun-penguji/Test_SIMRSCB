"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAbkUnitDetail, AbkUnit, AbkBebanKerja } from "@/lib/abk";
import { getSetting, SettingRS } from "@/lib/api";

const fmt = (n: number | null | undefined, d = 2) => {
  if (n == null || isNaN(n)) return "0";
  return Number(n).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
};

export default function CetakAbkUnitPage() {
  const params = useParams();
  const router = useRouter();
  const unitId = params?.unitId ? Number(params.unitId) : null;

  const [unit, setUnit] = useState<AbkUnit | null>(null);
  const [setting, setSetting] = useState<SettingRS | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    // Reset background so screen is light
    const origBg = document.body.style.background;
    const origColor = document.body.style.color;
    document.body.style.background = "#f1f5f9";
    document.body.style.color = "#0f172a";
    return () => {
      document.body.style.background = origBg;
      document.body.style.color = origColor;
    };
  }, []);

  useEffect(() => {
    if (!unitId) {
      setErr("ID Unit tidak valid");
      setLoading(false);
      return;
    }

    Promise.all([
      getAbkUnitDetail(unitId),
      getSetting().then((r) => r.data).catch(() => null),
    ])
      .then(([u, s]) => {
        const validUnit = (u as any)?.data !== undefined ? (u as any).data : u;
        setUnit(validUnit);
        if (s) setSetting(s);
      })
      .catch((e: unknown) => {
        setErr(e instanceof Error ? e.message : "Gagal memuat data unit");
      })
      .finally(() => setLoading(false));
  }, [unitId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-800 font-sans">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <div className="font-semibold text-base">Menyiapkan Dokumen ABK-Kes...</div>
      </div>
    );
  }

  if (err || !unit) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-800 font-sans text-center">
        <div className="text-4xl mb-2">⚠️</div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">{err || "Data tidak ditemukan"}</h2>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium"
        >
          Kembali
        </button>
      </div>
    );
  }

  const rsName = setting?.nama_instansi || "RUMAH SAKIT";
  const rsAlamat = [setting?.alamat_instansi, setting?.kabupaten, setting?.propinsi]
    .filter(Boolean)
    .join(", ");
  const rsKontak = [setting?.kontak, setting?.email].filter(Boolean).join(" · ");

  const todayStr = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const bebanKerja: AbkBebanKerja[] = unit.beban_kerja || [];
  const totalBebanSdm = bebanKerja.reduce((acc, b) => acc + (b.kebutuhan_sdm || 0), 0);
  const ftpVal = unit.ftp || 1;
  const kebutuhanFinal = totalBebanSdm * (1 + ftpVal / 100);
  const pembulatan = Math.round(kebutuhanFinal);
  const sdmKini = unit.jumlah_sdm_saat_ini || 0;
  const selisih = Math.round((kebutuhanFinal - sdmKini) * 100) / 100;

  return (
    <div className="min-h-screen bg-slate-200 py-6 px-4 print:py-0 print:px-0 print:bg-white text-black font-sans">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 12mm 10mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 10pt;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          tr {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Screen Toolbar */}
      <div className="no-print max-w-4xl mx-auto mb-4 bg-slate-900 text-white p-4 rounded-xl shadow-lg flex items-center justify-between">
        <div>
          <h2 className="font-bold text-sm">Formulir ABK-Kes: {unit.unit}</h2>
          <p className="text-xs text-slate-400">Permenkes RI No. 33 Tahun 2015</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.back()}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700"
          >
            ← Kembali
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5"
          >
            🖨️ Cetak Formulir
          </button>
        </div>
      </div>

      {/* Sheet A4 Paper */}
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-xl print:shadow-none print:p-0 print:rounded-none border border-slate-300 print:border-none">
        {/* Kop Surat RS */}
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h1 className="text-lg font-bold tracking-wide uppercase text-black">{rsName}</h1>
          {rsAlamat && <p className="text-xs text-gray-700 mt-0.5">{rsAlamat}</p>}
          {rsKontak && <p className="text-xs text-gray-600">{rsKontak}</p>}
        </div>

        {/* Title */}
        <div className="text-center mb-5">
          <h2 className="text-sm font-bold uppercase underline">
            FORMULIR PERHITUNGAN KEBUTUHAN SDM KESEHATAN (ABK-KES)
          </h2>
          <p className="text-xs text-gray-600 mt-0.5">
            Berdasarkan Standar Permenkes RI Nomor 33 Tahun 2015
          </p>
        </div>

        {/* Info Unit */}
        <table className="w-full text-xs mb-4 border-collapse">
          <tbody>
            <tr>
              <td className="w-36 py-1 font-semibold text-gray-700">Unit / Instalasi</td>
              <td className="w-3 py-1">:</td>
              <td className="py-1 font-bold text-black">{unit.unit}</td>
              <td className="w-32 py-1 font-semibold text-gray-700">Tahun Analisa</td>
              <td className="w-3 py-1">:</td>
              <td className="py-1 font-bold text-black">{unit.tahun}</td>
            </tr>
            <tr>
              <td className="py-1 font-semibold text-gray-700">Kategori SDM / Jabatan</td>
              <td className="py-1">:</td>
              <td className="py-1 font-bold text-black">{unit.kategori_sdm}</td>
              <td className="py-1 font-semibold text-gray-700">SDM Eksisting</td>
              <td className="py-1">:</td>
              <td className="py-1 font-bold text-black">{sdmKini} Orang</td>
            </tr>
          </tbody>
        </table>

        {/* Section 1: WKT Breakdown */}
        <div className="mb-4">
          <div className="font-bold text-xs uppercase bg-gray-100 p-1.5 border border-black mb-1">
            I. WAKTU KERJA TERSEDIA (WKT)
          </div>
          <table className="w-full text-xs border border-black border-collapse">
            <thead>
              <tr className="bg-gray-50 text-center font-bold">
                <th className="border border-black p-1 w-12">Kode</th>
                <th className="border border-black p-1 text-left">Faktor Komponen Waktu Kerja</th>
                <th className="border border-black p-1 w-24">Jumlah</th>
                <th className="border border-black p-1 w-24">Satuan</th>
                <th className="border border-black p-1 text-left">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-1 text-center font-bold">A</td>
                <td className="border border-black p-1">Hari Kerja per Tahun</td>
                <td className="border border-black p-1 text-center font-bold">{unit.hari_kerja}</td>
                <td className="border border-black p-1 text-center">Hari/Tahun</td>
                <td className="border border-black p-1 text-gray-600">Hari operasional kerja kalender</td>
              </tr>
              <tr>
                <td className="border border-black p-1 text-center font-bold">B</td>
                <td className="border border-black p-1">Hak Cuti Tahunan</td>
                <td className="border border-black p-1 text-center font-bold">{unit.cuti_hari}</td>
                <td className="border border-black p-1 text-center">Hari/Tahun</td>
                <td className="border border-black p-1 text-gray-600">Sesuai ketentuan RS/kepegawaian</td>
              </tr>
              <tr>
                <td className="border border-black p-1 text-center font-bold">C</td>
                <td className="border border-black p-1">Pendidikan dan Pelatihan (Diklat)</td>
                <td className="border border-black p-1 text-center font-bold">{unit.diklat_hari}</td>
                <td className="border border-black p-1 text-center">Hari/Tahun</td>
                <td className="border border-black p-1 text-gray-600">Alokasi pengembangan kompetensi</td>
              </tr>
              <tr>
                <td className="border border-black p-1 text-center font-bold">D</td>
                <td className="border border-black p-1">Hari Libur Nasional & Cuti Bersama</td>
                <td className="border border-black p-1 text-center font-bold">{unit.libur_nasional_hari}</td>
                <td className="border border-black p-1 text-center">Hari/Tahun</td>
                <td className="border border-black p-1 text-gray-600">Berdasarkan SKB 3 Menteri</td>
              </tr>
              <tr>
                <td className="border border-black p-1 text-center font-bold">E</td>
                <td className="border border-black p-1">Ketidakhadiran Kerja (Sakit / Izin)</td>
                <td className="border border-black p-1 text-center font-bold">{unit.ketidakhadiran_hari}</td>
                <td className="border border-black p-1 text-center">Hari/Tahun</td>
                <td className="border border-black p-1 text-gray-600">Estimasi toleransi ketidakhadiran</td>
              </tr>
              <tr>
                <td className="border border-black p-1 text-center font-bold">F</td>
                <td className="border border-black p-1">Waktu Kerja Efektif per Hari</td>
                <td className="border border-black p-1 text-center font-bold">{unit.jam_kerja_hari}</td>
                <td className="border border-black p-1 text-center">Jam/Hari</td>
                <td className="border border-black p-1 text-gray-600">Jam kerja harian pegawai</td>
              </tr>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={2} className="border border-black p-1.5 text-right uppercase">
                  WAKTU KERJA TERSEDIA (WKT) = (A - (B + C + D + E)) × F :
                </td>
                <td className="border border-black p-1.5 text-center text-sm font-bold text-black">
                  {fmt(unit.wkt, 1)}
                </td>
                <td className="border border-black p-1.5 text-center">Jam/Tahun</td>
                <td className="border border-black p-1.5 text-xs">
                  = {fmt(unit.wkt * 60, 0)} Menit/Tahun
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Beban Kerja & SBK */}
        <div className="mb-4">
          <div className="font-bold text-xs uppercase bg-gray-100 p-1.5 border border-black mb-1">
            II. STANDAR BEBAN KERJA (SBK) & KEBUTUHAN SDM KEGIATAN POKOK
          </div>
          <table className="w-full text-xs border border-black border-collapse">
            <thead>
              <tr className="bg-gray-50 text-center font-bold">
                <th className="border border-black p-1 w-8">No</th>
                <th className="border border-black p-1 text-left">Uraian Tugas / Kegiatan Pokok</th>
                <th className="border border-black p-1 w-20">Rata² Waktu (Menit)</th>
                <th className="border border-black p-1 w-24">Beban Kerja / Thn</th>
                <th className="border border-black p-1 w-24">SBK (Kegiatan/Th)</th>
                <th className="border border-black p-1 w-24">Kebutuhan SDM</th>
              </tr>
            </thead>
            <tbody>
              {bebanKerja.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-black p-3 text-center text-gray-500 italic">
                    Belum ada rincian kegiatan pokok yang diinput.
                  </td>
                </tr>
              ) : (
                bebanKerja.map((b, i) => (
                  <tr key={b.id || i}>
                    <td className="border border-black p-1 text-center">{i + 1}</td>
                    <td className="border border-black p-1">
                      <div className="font-semibold">{b.nama_kegiatan}</div>
                      {b.keterangan && <div className="text-[10px] text-gray-500">{b.keterangan}</div>}
                    </td>
                    <td className="border border-black p-1 text-center font-mono">{b.waktu_rata2_menit}</td>
                    <td className="border border-black p-1 text-center font-mono">{fmt(b.total_kegiatan, 0)}</td>
                    <td className="border border-black p-1 text-center font-mono font-semibold">{fmt(b.sbk, 1)}</td>
                    <td className="border border-black p-1 text-center font-mono font-bold text-blue-900">
                      {fmt(b.kebutuhan_sdm, 3)}
                    </td>
                  </tr>
                ))
              )}
              <tr className="bg-gray-100 font-bold">
                <td colSpan={5} className="border border-black p-1.5 text-right uppercase">
                  TOTAL KEBUTUHAN SDM KEGIATAN POKOK (JKP) :
                </td>
                <td className="border border-black p-1.5 text-center text-sm font-mono text-blue-950">
                  {fmt(totalBebanSdm, 3)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 3: Rekap Kebutuhan Akhir */}
        <div className="mb-6">
          <div className="font-bold text-xs uppercase bg-gray-100 p-1.5 border border-black mb-1">
            III. STANDAR TUGAS PENUNJANG (STP) & KEBUTUHAN TOTAL SDM
          </div>
          <table className="w-full text-xs border border-black border-collapse">
            <tbody>
              <tr>
                <td className="border border-black p-1.5 w-2/3">Faktor Tugas Penunjang (FTP)</td>
                <td className="border border-black p-1.5 text-center font-bold w-1/3">{ftpVal}%</td>
              </tr>
              <tr>
                <td className="border border-black p-1.5">Standar Tugas Penunjang (STP) = (1 + FTP / 100)</td>
                <td className="border border-black p-1.5 text-center font-bold font-mono">
                  {fmt(1 + ftpVal / 100, 3)}
                </td>
              </tr>
              <tr className="bg-blue-50 font-bold">
                <td className="border border-black p-1.5 uppercase text-blue-950">
                  Total Kebutuhan SDM Kesehatan (JKP × STP)
                </td>
                <td className="border border-black p-1.5 text-center text-base font-bold font-mono text-blue-950">
                  {fmt(kebutuhanFinal, 2)} Orang
                </td>
              </tr>
              <tr className="bg-gray-100 font-bold">
                <td className="border border-black p-1.5 uppercase">
                  Pembulatan Kebutuhan SDM
                </td>
                <td className="border border-black p-1.5 text-center text-base font-bold font-mono">
                  {pembulatan} Orang
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1.5">Jumlah SDM Saat Ini (Eksisting)</td>
                <td className="border border-black p-1.5 text-center font-bold font-mono">{sdmKini} Orang</td>
              </tr>
              <tr className={`font-bold ${selisih > 0 ? "bg-red-50 text-red-950" : "bg-emerald-50 text-emerald-950"}`}>
                <td className="border border-black p-1.5 uppercase">
                  Kesenjangan SDM ({selisih > 0 ? "Kekurangan" : "Surplus / Sesuai"})
                </td>
                <td className="border border-black p-1.5 text-center text-sm font-bold font-mono">
                  {selisih > 0 ? `+${fmt(selisih, 2)} Orang (Kurang)` : `${fmt(selisih, 2)} Orang (Cukup/Surplus)`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tanda Tangan */}
        <div className="mt-8 pt-2 text-xs break-inside-avoid">
          <div className="text-right mb-4">
            <p>{setting?.kabupaten || "Bekasi"}, {todayStr}</p>
          </div>
          <div className="grid grid-cols-2 text-center gap-12">
            <div>
              <p className="font-semibold mb-16">Mengetahui,<br />Direktur Rumah Sakit</p>
              <p className="font-bold underline uppercase">( .................................................... )</p>
              <p className="text-gray-600">NIP / NRP: .......................................</p>
            </div>
            <div>
              <p className="font-semibold mb-16">Penyusun Analisa,<br />Kepala Unit / Instalasi</p>
              <p className="font-bold underline uppercase">( .................................................... )</p>
              <p className="text-gray-600">NIP / NRP: .......................................</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
