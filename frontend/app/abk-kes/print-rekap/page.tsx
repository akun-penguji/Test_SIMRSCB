"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getAbkUnits, getAbkSummary, AbkUnit, AbkSummary } from "@/lib/abk";
import { getSetting, SettingRS } from "@/lib/api";

const fmt = (n: number | null | undefined, d = 2) => {
  if (n == null || isNaN(n)) return "0";
  return Number(n).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
};

function CetakRekapContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tahunParam = Number(searchParams.get("tahun")) || new Date().getFullYear();

  const [units, setUnits] = useState<AbkUnit[]>([]);
  const [summary, setSummary] = useState<AbkSummary | null>(null);
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
    Promise.all([
      getAbkUnits({ tahun: tahunParam }),
      getAbkSummary(tahunParam),
      getSetting().then((r) => r.data).catch(() => null),
    ])
      .then(([u, s, set]) => {
        const validUnits = Array.isArray(u) ? u : ((u as any)?.data || []);
        const validSummary = (s as any)?.data || s;
        setUnits(validUnits);
        setSummary(validSummary);
        if (set) setSetting(set);
      })
      .catch((e: unknown) => {
        setErr(e instanceof Error ? e.message : "Gagal memuat rekapitulasi");
      })
      .finally(() => setLoading(false));
  }, [tahunParam]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-800 font-sans">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <div className="font-semibold text-base">Menyiapkan Laporan Rekapitulasi ABK-Kes...</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-800 font-sans text-center">
        <div className="text-4xl mb-2">⚠️</div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">{err}</h2>
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

  const totalSdmEksisting = units.reduce((acc, u) => acc + (u.jumlah_sdm_saat_ini || 0), 0);
  const totalKebutuhan = units.reduce((acc, u) => acc + (u.kebutuhan_sdm_abk || 0), 0);
  const totalPembulatan = Math.round(totalKebutuhan);
  const totalSelisih = Math.round((totalKebutuhan - totalSdmEksisting) * 100) / 100;

  return (
    <div className="min-h-screen bg-slate-200 py-6 px-4 print:py-0 print:px-0 print:bg-white text-black font-sans">
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm 8mm 10mm 8mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 9.5pt;
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
      <div className="no-print max-w-6xl mx-auto mb-4 bg-slate-900 text-white p-4 rounded-xl shadow-lg flex items-center justify-between">
        <div>
          <h2 className="font-bold text-sm">
            Rekapitulasi Analisa Beban Kerja SDM Kesehatan (Tahun {tahunParam})
          </h2>
          <p className="text-xs text-slate-400">Pedoman Permenkes RI No. 33 Tahun 2015</p>
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
            🖨️ Cetak Laporan Rekap
          </button>
        </div>
      </div>

      {/* Landscape Paper Sheet */}
      <div className="max-w-6xl mx-auto bg-white p-8 rounded-xl shadow-xl print:shadow-none print:p-0 print:rounded-none border border-slate-300 print:border-none">
        {/* Kop Surat RS */}
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h1 className="text-lg font-bold tracking-wide uppercase text-black">{rsName}</h1>
          {rsAlamat && <p className="text-xs text-gray-700 mt-0.5">{rsAlamat}</p>}
          {rsKontak && <p className="text-xs text-gray-600">{rsKontak}</p>}
        </div>

        {/* Title */}
        <div className="text-center mb-5">
          <h2 className="text-sm font-bold uppercase underline">
            REKAPITULASI HASIL ANALISA BEBAN KERJA KESEHATAN (ABK-KES)
          </h2>
          <p className="text-xs text-gray-700 font-semibold mt-0.5">
            PERENCANAAN KEBUTUHAN SDM TAHUN {tahunParam} (PMK RI NO. 33/2015)
          </p>
        </div>

        {/* KPI Mini Summary */}
        <div className="grid grid-cols-4 gap-3 text-center text-xs mb-5">
          <div className="border border-black p-2 bg-gray-50">
            <div className="text-gray-600 font-medium">Unit Kerja Dianalisa</div>
            <div className="text-base font-bold text-black mt-0.5">{units.length}</div>
            <div className="text-[10px] text-gray-500">Unit / Instalasi</div>
          </div>
          <div className="border border-black p-2 bg-gray-50">
            <div className="text-gray-600 font-medium">SDM Saat Ini (Eksisting)</div>
            <div className="text-base font-bold text-black mt-0.5">{totalSdmEksisting}</div>
            <div className="text-[10px] text-gray-500">Orang</div>
          </div>
          <div className="border border-black p-2 bg-blue-50">
            <div className="text-blue-900 font-medium">Kebutuhan SDM (ABK)</div>
            <div className="text-base font-bold text-blue-950 mt-0.5">{fmt(totalKebutuhan, 2)}</div>
            <div className="text-[10px] text-blue-800">Orang (Bulat: {totalPembulatan})</div>
          </div>
          <div
            className={`border border-black p-2 ${
              totalSelisih > 0 ? "bg-red-50 text-red-950" : "bg-emerald-50 text-emerald-950"
            }`}
          >
            <div className="font-medium">
              {totalSelisih > 0 ? "Total Kekurangan" : "Total Surplus"}
            </div>
            <div className="text-base font-bold mt-0.5">{fmt(Math.abs(totalSelisih), 2)}</div>
            <div className="text-[10px]">Orang ({totalSelisih > 0 ? "Defisit" : "Surplus"})</div>
          </div>
        </div>

        {/* Tabel Rekap Seluruh Unit */}
        <table className="w-full text-xs border border-black border-collapse mb-6">
          <thead>
            <tr className="bg-gray-100 text-center font-bold">
              <th className="border border-black p-1 w-8">No</th>
              <th className="border border-black p-1 text-left">Unit Kerja / Instalasi</th>
              <th className="border border-black p-1 text-left">Kategori SDM / Jabatan</th>
              <th className="border border-black p-1 w-20">WKT (Jam/Th)</th>
              <th className="border border-black p-1 w-16">Kegiatan</th>
              <th className="border border-black p-1 w-20">SDM Kini</th>
              <th className="border border-black p-1 w-24">Kebutuhan ABK</th>
              <th className="border border-black p-1 w-20">Bulat</th>
              <th className="border border-black p-1 w-24">Kesenjangan</th>
              <th className="border border-black p-1 w-24">Status</th>
            </tr>
          </thead>
          <tbody>
            {units.length === 0 ? (
              <tr>
                <td colSpan={10} className="border border-black p-4 text-center text-gray-500 italic">
                  Belum ada data analisa beban kerja untuk tahun {tahunParam}.
                </td>
              </tr>
            ) : (
              units.map((u, idx) => {
                const wkt = u.wkt || 0;
                const kebutuhan = Number(u.kebutuhan_sdm_abk) || 0;
                const pembulatan = Math.round(kebutuhan);
                const sdmKini = Number(u.jumlah_sdm_saat_ini) || 0;
                const selisih = Math.round((kebutuhan - sdmKini) * 100) / 100;
                const isKurang = selisih > 0;
                const isSurplus = selisih < 0;

                return (
                  <tr key={u.id || idx}>
                    <td className="border border-black p-1 text-center">{idx + 1}</td>
                    <td className="border border-black p-1 font-semibold">{u.unit}</td>
                    <td className="border border-black p-1">{u.kategori_sdm}</td>
                    <td className="border border-black p-1 text-center font-mono">{fmt(wkt, 1)}</td>
                    <td className="border border-black p-1 text-center">{u.beban_kerja?.length || "-"}</td>
                    <td className="border border-black p-1 text-center font-semibold">{sdmKini}</td>
                    <td className="border border-black p-1 text-center font-bold text-blue-900">
                      {fmt(kebutuhan, 2)}
                    </td>
                    <td className="border border-black p-1 text-center font-bold">{pembulatan}</td>
                    <td
                      className={`border border-black p-1 text-center font-bold ${
                        isKurang ? "text-red-700" : isSurplus ? "text-emerald-700" : "text-gray-700"
                      }`}
                    >
                      {isKurang ? `+${fmt(selisih, 2)}` : isSurplus ? `-${fmt(Math.abs(selisih), 2)}` : "0"}
                    </td>
                    <td
                      className={`border border-black p-1 text-center font-semibold text-[10px] ${
                        isKurang ? "text-red-800" : isSurplus ? "text-emerald-800" : "text-gray-700"
                      }`}
                    >
                      {isKurang ? "KURANG" : isSurplus ? "SURPLUS" : "SESUAI"}
                    </td>
                  </tr>
                );
              })
            )}

            {/* Total Row */}
            <tr className="bg-gray-100 font-bold">
              <td colSpan={5} className="border border-black p-1.5 text-right uppercase">
                TOTAL REKAPITULASI :
              </td>
              <td className="border border-black p-1.5 text-center text-sm">{totalSdmEksisting}</td>
              <td className="border border-black p-1.5 text-center text-blue-900 text-sm">
                {fmt(totalKebutuhan, 2)}
              </td>
              <td className="border border-black p-1.5 text-center text-sm">{totalPembulatan}</td>
              <td
                className={`border border-black p-1.5 text-center text-sm ${
                  totalSelisih > 0 ? "text-red-700" : "text-emerald-700"
                }`}
              >
                {totalSelisih > 0 ? `+${fmt(totalSelisih, 2)}` : fmt(totalSelisih, 2)}
              </td>
              <td
                className={`border border-black p-1.5 text-center text-xs ${
                  totalSelisih > 0 ? "text-red-800" : "text-emerald-800"
                }`}
              >
                {totalSelisih > 0 ? "DEFISIT" : "SURPLUS"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Lembar Pengesahan */}
        <div className="mt-8 pt-4 text-xs break-inside-avoid">
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
              <p className="font-semibold mb-16">Penanggung Jawab Perencanaan SDM,<br />Kepala Bagian Kepegawaian / SDM</p>
              <p className="font-bold underline uppercase">( .................................................... )</p>
              <p className="text-gray-600">NIP / NRP: .......................................</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CetakRekapPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans text-slate-800">
          Memuat...
        </div>
      }
    >
      <CetakRekapContent />
    </Suspense>
  );
}
