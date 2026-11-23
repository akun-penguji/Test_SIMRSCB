"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  FileText,
  UserCheck,
  Download,
  AlertCircle,
  Calendar,
  Lock,
  CheckCircle2,
  Building2,
  Stethoscope,
  Info,
  Loader2,
} from "lucide-react";

interface PasienVerifyInfo {
  nama_masked: string;
  no_rm_masked: string;
  lama_sakit?: string;
  periode?: string;
}

interface PenandatanganVerifyInfo {
  nama: string;
  sip: string;
  nik_masked: string;
  instansi: string;
  otoritas_sertifikat: string;
}

interface VerifyData {
  valid: boolean;
  tipe: string;
  judul: string;
  no_surat: string;
  no_rawat: string;
  tanggal: string;
  pasien: PasienVerifyInfo;
  penandatangan: PenandatanganVerifyInfo;
  keterangan?: string;
  status_tte: string;
  has_pdf: boolean;
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerifyData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form download state
  const [tglLahirInput, setTglLahirInput] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setErrorMsg("Parameter QR Code tidak valid atau token verifikasi tidak ditemukan.");
      return;
    }

    async function fetchVerify() {
      try {
        setLoading(true);
        setErrorMsg(null);
        // Menggunakan native fetch ke /api/verify agar tidak terkena auth interceptor
        const res = await fetch(`/api/verify?id=${encodeURIComponent(id || "")}`);
        const result = await res.json();

        if (!res.ok || !result.valid) {
          setErrorMsg(result.error || "Gagal memverifikasi dokumen. Token tidak sah.");
        } else {
          setData(result);
        }
      } catch (err: any) {
        setErrorMsg("Terjadi gangguan koneksi saat menghubungi server verifikasi.");
      } finally {
        setLoading(false);
      }
    }

    fetchVerify();
  }, [id]);

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !tglLahirInput.trim()) {
      setDownloadError("Silakan masukkan tanggal lahir pasien.");
      return;
    }

    try {
      setDownloading(true);
      setDownloadError(null);

      const res = await fetch("/api/verify/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          tgl_lahir: tglLahirInput.trim(),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setDownloadError(
          errJson.error || "Tanggal lahir tidak sesuai atau gagal mengunduh dokumen."
        );
        return;
      }

      // Berhasil, ambil blob PDF dan trigger download di browser
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cleanNomor = data?.no_surat?.replace(/[^a-zA-Z0-9]/g, "_") || "Surat_TTE";
      a.download = `${cleanNomor}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setDownloadError("Terjadi kesalahan jaringan saat mengunduh berkas.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Header Kop */}
      <header className="max-w-3xl mx-auto w-full mb-6">
        <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/60 rounded-2xl p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">
                RSUD CABANGBUNGIN
              </h1>
              <p className="text-xs text-slate-400">
                Pemerintah Kabupaten Bekasi — Sistem Verifikasi Dokumen TTE
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1.5 rounded-full text-emerald-300 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>BSrE - BSSN Certified</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto w-full flex-1">
        {loading ? (
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-12 text-center backdrop-blur-md flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
            <h2 className="text-base font-semibold text-white">Memverifikasi Tanda Tangan Elektronik...</h2>
            <p className="text-xs text-slate-400 mt-1">
              Menghubungkan ke layanan sertifikat elektronik BSrE dan pangkalan data RSUD Cabangbungin
            </p>
          </div>
        ) : errorMsg ? (
          <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-8 backdrop-blur-md text-center">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Verifikasi Dokumen Tidak Berhasil</h2>
            <p className="text-sm text-rose-200/90 max-w-md mx-auto">{errorMsg}</p>
            <div className="mt-6 pt-6 border-t border-rose-800/40 text-xs text-slate-400">
              Pastikan Anda memindai kode QR resmi yang tercetak pada dokumen fisik yang diterbitkan oleh RSUD Cabangbungin.
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Verification Banner */}
            <div className="bg-gradient-to-r from-emerald-950/80 to-slate-800/80 border border-emerald-500/50 rounded-2xl p-6 backdrop-blur-md shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Terverifikasi Asli
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1">
                    {data.judul}
                  </h2>
                  <p className="text-xs text-emerald-200/80 mt-1">
                    {data.status_tte}
                  </p>
                </div>
              </div>
            </div>

            {/* Document Details Card */}
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-6 backdrop-blur-md shadow-xl space-y-6">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-slate-700/60 pb-3">
                <FileText className="w-4 h-4 text-emerald-400" />
                Informasi Dokumen
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3.5">
                  <span className="text-slate-400 block text-xs">Nomor Surat</span>
                  <span className="font-semibold text-white tracking-wide">{data.no_surat}</span>
                </div>
                <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3.5">
                  <span className="text-slate-400 block text-xs">Tanggal Registrasi / Terbit</span>
                  <span className="font-semibold text-white">{data.tanggal}</span>
                </div>
                <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3.5">
                  <span className="text-slate-400 block text-xs">Nama Pasien</span>
                  <span className="font-semibold text-white tracking-wide">{data.pasien.nama_masked}</span>
                </div>
                <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3.5">
                  <span className="text-slate-400 block text-xs">No. Rekam Medis</span>
                  <span className="font-semibold text-white">{data.pasien.no_rm_masked}</span>
                </div>
                {data.pasien.lama_sakit && (
                  <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3.5 sm:col-span-2">
                    <span className="text-slate-400 block text-xs">Masa Istirahat Sakit</span>
                    <span className="font-semibold text-emerald-400">
                      {data.pasien.lama_sakit} ({data.pasien.periode})
                    </span>
                  </div>
                )}
              </div>

              {/* Signer Info */}
              <div className="mt-6 pt-4 border-t border-slate-700/60">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <Stethoscope className="w-4 h-4 text-emerald-400" />
                  Penandatangan Elektronik (DPJP)
                </h3>
                <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-sm">
                    <span className="font-bold text-white text-base">{data.penandatangan.nama}</span>
                    <span className="text-xs text-slate-400">SIP: {data.penandatangan.sip}</span>
                  </div>
                  <div className="text-xs text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{data.penandatangan.instansi}</span>
                  </div>
                  <div className="text-xs text-emerald-300 flex items-center gap-1.5 pt-1 border-t border-slate-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Otoritas Sertifikasi: {data.penandatangan.otoritas_sertifikat}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Download Original PDF Form (Protected by Birth Date) */}
            <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-emerald-500/40 rounded-2xl p-6 backdrop-blur-md shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Unduh Salinan Dokumen Asli (PDF)</h3>
                  <p className="text-xs text-slate-400">
                    Diproteksi keamanan data pribadi rekam medis pasien sesuai ketentuan perundang-undangan.
                  </p>
                </div>
              </div>

              <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-200/90 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Untuk membuka dan mengunduh salinan resmi dokumen PDF hasil TTE BSrE, silakan masukkan <strong>Tanggal Lahir Pasien</strong> yang bersangkutan.
                </span>
              </div>

              <form onSubmit={handleDownload} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Tanggal Lahir Pasien
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Contoh: 17-10-1980 atau 17101980"
                      value={tglLahirInput}
                      onChange={(e) => setTglLahirInput(e.target.value)}
                      className="w-full bg-slate-900/80 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition"
                    />
                    <Calendar className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                  </div>
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Bisa format: DD-MM-YYYY (contoh: 17-10-1980) atau 8 digit (17101980).
                  </span>
                </div>

                {downloadError && (
                  <div className="bg-rose-950/50 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{downloadError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={downloading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 text-sm transition duration-150 cursor-pointer"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memverifikasi & Mengunduh Berkas...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Verifikasi & Unduh Dokumen Asli PDF</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto w-full mt-8 text-center text-xs text-slate-500">
        <p>© 2026 RSUD Cabangbungin Kab. Bekasi. Terintegrasi SIMRS Khanza & BSrE BSSN.</p>
        <p className="mt-1 text-[11px] text-slate-600">
          Dokumen ini telah ditandatangani secara elektronik menggunakan sertifikat elektronik yang diterbitkan oleh Balai Besar Sertifikasi Elektronik (BSrE), Badan Siber dan Sandi Negara.
        </p>
      </footer>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
