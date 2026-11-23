"use client";

import { useCallback, useEffect, useState } from "react";
import { getSetting, SettingRS, ambilTiketAntrian, getStatusAntrian, RekapLayanan,
  anjunganCariPasien, anjunganListPoli, anjunganListDokter, anjunganDaftarWalkIn,
  AnjunganPasien, AnjunganPoli, AnjunganDokter, AnjunganDaftarResp,
  anjunganBpjsCekPeserta, anjunganBpjsListRujukan, anjunganBpjsCariLokal, anjunganBpjsMapingPoli,
  anjunganBpjsCreateSep,
  anjunganBpjsCekSuratKontrol, anjunganBpjsCreateSepKontrol,
  anjunganBpjsCekMobileJkn, anjunganBpjsCheckinMobileJkn,
  anjunganBpjsPrepareMobileJkn, PrepareSepResp,
  anjunganDaftarWalkIn as anjunganDaftarBPJS, // reuse: daftar logic sama, kd_pj BPJS via backend
  AnjunganBpjsPeserta, AnjunganBpjsRujukan,
  CreateSepResp, SuratKontrolInfo, SuratKontrolMapping, SepAsal,
  MobileJknBooking, MobileJknMapping,
  helperInfo, helperFinger, helperFrista, HelperInfo,
  getAnjunganConfig, AnjunganConfig,
} from "@/lib/api";
import { OnScreenKeyboardProvider, useKbInput } from "@/components/OnScreenKeyboard";
import IdleResetWatcher from "@/components/IdleResetWatcher";

// ── Jam digital ──────────────────────────────────────────────────────────────
function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const jam  = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const tgl  = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="text-center select-none">
      <div className="text-5xl font-mono font-bold text-white tracking-widest drop-shadow-lg">{jam}</div>
      <div className="text-sm text-white/80 mt-1 capitalize">{tgl}</div>
    </div>
  );
}

// ── Menu utama kiosk ──────────────────────────────────────────────────────────
const MENU_KIOSK = [
  {
    id:    "antrian",
    label: "Tiket Antrian\nLoket",
    warna: "from-blue-500 to-blue-700",
    warnaHover: "hover:from-blue-400 hover:to-blue-600",
    shadow: "shadow-blue-900/50",
    icon: (
      <svg className="w-20 h-20 mb-4 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    ),
  },
  {
    id:    "daftar-umum",
    label: "Pendaftaran\nUmum",
    warna: "from-emerald-500 to-emerald-700",
    warnaHover: "hover:from-emerald-400 hover:to-emerald-600",
    shadow: "shadow-emerald-900/50",
    icon: (
      <svg className="w-20 h-20 mb-4 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    id:    "daftar-bpjs",
    label: "Pendaftaran\nBPJS",
    warna: "from-violet-500 to-violet-700",
    warnaHover: "hover:from-violet-400 hover:to-violet-600",
    shadow: "shadow-violet-900/50",
    icon: (
      <svg className="w-20 h-20 mb-4 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    id:    "informasi",
    label: "Informasi\nRumah Sakit",
    warna: "from-amber-500 to-orange-600",
    warnaHover: "hover:from-amber-400 hover:to-orange-500",
    shadow: "shadow-orange-900/50",
    icon: (
      <svg className="w-20 h-20 mb-4 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
  },
];

// ── Halaman per menu ──────────────────────────────────────────────────────────
/**
 * Stempel waktu task admisi Mobile JKN.
 *
 * BPJS hanya menerima updatewaktu kalau kodebooking sudah ada, sedangkan
 * kodebooking baru lahir saat SEP dibuat. Jadi waktunya direkam di sini saat
 * kejadian lalu dikirim bersama request create SEP.
 *   task 1 = pasien memasukkan nomor kartu
 *   task 2 = lembar SEP terbuka
 * Semantik sama dengan fungsi.TaskAdmisi di APMSEPDuaPrinter.
 */
const waktuTask = {
  t1: 0,
  t2: 0,
  mulaiSesi() { this.t1 = Date.now(); this.t2 = 0; },
  bukaFormSep() { this.t2 = Date.now(); },
};

const LOKET_ANTRIAN = "Antrian Pendaftaran/Admisi";

/** Layanan anjungan → prefix antrian. Harus sama dengan DlgAntrian di APMSEPDuaPrinter. */
const LAYANAN_ANTRIAN = [
  { prefix: "A", nama: "Pendaftaran Pasien Baru" },
  { prefix: "B", nama: "Pendaftaran Pasien Rawat Jalan" },
  { prefix: "C", nama: "Pendaftaran Poli Rawat Inap" },
];

/** Format tampil/cetak: prefix + nomor 3 digit, mis. "A001". */
function formatNomorTiket(prefix: string, nomor: string): string {
  const n = Number(nomor);
  return `${prefix}${Number.isFinite(n) ? String(n).padStart(3, "0") : nomor}`;
}

function HalamanAntrian({ onKembali, namaRS }: { onKembali: () => void; namaRS: string }) {
  const [tiket, setTiket] = useState<{ prefix: string; nomor: string; jam: string; layanan: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [rekap, setRekap]     = useState<RekapLayanan[]>([]);

  // Nomor terakhir per layanan, supaya pasien tahu antrean sudah sampai mana.
  useEffect(() => {
    getStatusAntrian()
      .then(r => setRekap(r.data.per_layanan ?? []))
      .catch(() => {});
  }, []);

  const ambilTiket = async (prefix: string, layanan: string) => {
    setLoading(prefix);
    setError(null);
    try {
      const r = await ambilTiketAntrian(prefix);
      setTiket({ prefix: r.data.prefix || prefix, nomor: r.data.nomor, jam: r.data.jam, layanan });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal mengambil tiket";
      setError(msg);
    } finally {
      setLoading(null);
    }
  };

  // Setelah tiket muncul: tampilkan nomor sebentar, auto-cetak, lalu balik ke menu utama
  useEffect(() => {
    if (!tiket) return;
    const t = setTimeout(() => {
      window.print();
      onKembali();
    }, 1500);
    return () => clearTimeout(t);
  }, [tiket, onKembali]);

  const tglCetak = tiket ? new Date(tiket.jam.replace(" ", "T")) : null;
  const nomorTampil = tiket ? formatNomorTiket(tiket.prefix, tiket.nomor) : "";

  return (
    <>
    <div className="flex flex-col items-center justify-center h-full gap-8 px-8 print:hidden">
      <h2 className="text-3xl font-bold text-white drop-shadow">Tiket Antrian</h2>

      {!tiket ? (
        <>
          <p className="text-white/80 text-lg text-center max-w-2xl">
            Silakan pilih layanan yang Anda butuhkan.
          </p>
          {error && (
            <p className="text-red-200 bg-red-900/30 border border-red-300/30 px-4 py-2 rounded-lg text-sm">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
            {LAYANAN_ANTRIAN.map(l => (
              <button
                key={l.prefix}
                disabled={loading !== null}
                onClick={() => ambilTiket(l.prefix, l.nama)}
                className="flex flex-col items-center gap-3 px-6 py-10 rounded-2xl bg-white text-blue-700
                  font-bold shadow-lg hover:bg-blue-50 transition
                  disabled:opacity-40 disabled:cursor-not-allowed">
                <span className="text-6xl font-black leading-none">{l.prefix}</span>
                <span className="text-lg text-center leading-snug">{l.nama}</span>
                <span className="text-xs text-slate-500">
                  Terakhir: {formatNomorTiket(
                    l.prefix,
                    String(rekap.find(r => r.prefix === l.prefix)?.nomor_terakhir ?? 0)
                  )}
                </span>
                <span className="text-sm font-medium text-blue-500">
                  {loading === l.prefix ? "Memproses..." : "Ambil Tiket"}
                </span>
              </button>
            ))}
          </div>
          <button onClick={onKembali}
            className="px-8 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">
            ← Kembali
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-6">
          <div className="bg-white rounded-3xl px-16 py-10 text-center shadow-2xl">
            <p className="text-slate-500 text-sm uppercase tracking-widest mb-2">Nomor Antrian</p>
            <p className="text-8xl font-black text-blue-700 leading-none">{nomorTampil}</p>
            <p className="text-slate-600 mt-4 font-medium">{tiket.layanan}</p>
            <p className="text-slate-400 text-sm mt-1">
              {new Date().toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
              {" • "}
              {new Date(tiket.jam.replace(" ", "T")).toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" })}
            </p>
          </div>
          <p className="text-white/70 text-sm">Mencetak tiket — mohon menunggu...</p>
        </div>
      )}
    </div>

    {/* Print view — thermal 80mm, hitam putih (sibling di luar container print:hidden) */}
    {tiket && tglCetak && (
      <div id="tiket-print" className="hidden print:block">
        <div className="text-center">
          <div className="font-bold text-base uppercase">{namaRS}</div>
          <div className="text-xs mt-1">Tiket Antrian</div>
          <div className="text-xs font-semibold">{tiket.layanan}</div>
          <hr className="my-2 border-t border-dashed border-black" />
          <div className="text-xs">Nomor Antrian</div>
          <div className="font-black leading-none my-1" style={{ fontSize: "56pt" }}>{nomorTampil}</div>
          <hr className="my-2 border-t border-dashed border-black" />
          <div className="text-xs">
            {tglCetak.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="text-xs">
            Pukul {tglCetak.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div className="text-[10px] mt-2 italic">Mohon menunggu nomor Anda dipanggil</div>
        </div>
      </div>
    )}
    </>
  );
}

// ── Reusable input dengan On-Screen Keyboard ────────────────────────────────
function KbNikInput({ value, setValue, onEnter }: {
  value: string; setValue: (v: string) => void; onEnter?: () => void;
}) {
  const kb = useKbInput({ mode: "numeric", value, setValue, maxLength: 16, onEnter });
  return (
    <input type="text" inputMode="numeric" maxLength={16} value={value}
      onChange={e => setValue(e.target.value.replace(/\D/g, ""))}
      onFocus={kb.onFocus}
      placeholder="1234567890123456"
      className="w-full px-5 py-4 rounded-2xl text-xl text-slate-800 bg-white/95 outline-none
        focus:ring-4 focus:ring-white/50 placeholder:text-slate-400 tracking-widest font-mono" />
  );
}

function KbKartuInput({ value, setValue, onEnter }: {
  value: string; setValue: (v: string) => void; onEnter?: () => void;
}) {
  const kb = useKbInput({ mode: "numeric", value, setValue, maxLength: 13, onEnter });
  return (
    <input type="text" inputMode="numeric" maxLength={13} value={value}
      onChange={e => setValue(e.target.value.replace(/\D/g, ""))}
      onFocus={kb.onFocus}
      placeholder="0001234567890"
      className="w-full px-5 py-4 rounded-2xl text-xl text-slate-800 bg-white/95 outline-none
        focus:ring-4 focus:ring-white/50 placeholder:text-slate-400 tracking-widest font-mono" />
  );
}

function KbRmInput({ value, setValue, onEnter }: {
  value: string; setValue: (v: string) => void; onEnter?: () => void;
}) {
  const sanitize = (s: string) => s.replace(/[^0-9A-Za-z]/g, "");
  const kb = useKbInput({ mode: "alphanumeric", value, setValue, maxLength: 15, onEnter, sanitize });
  return (
    <input type="text" maxLength={15} value={value}
      onChange={e => setValue(sanitize(e.target.value))}
      onFocus={kb.onFocus}
      placeholder="000000"
      className="w-full px-5 py-4 rounded-2xl text-xl text-slate-800 bg-white/95 outline-none
        focus:ring-4 focus:ring-white/50 placeholder:text-slate-400 tracking-widest font-mono" />
  );
}

function KbSuratInput({ value, setValue, onEnter, placeholder }: {
  value: string; setValue: (v: string) => void; onEnter?: () => void; placeholder?: string;
}) {
  // No surat kontrol — alphanumeric uppercase (mis. 0132R0800526K000363)
  const sanitize = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const kb = useKbInput({ mode: "alphanumeric", value, setValue, maxLength: 40, onEnter, sanitize });
  return (
    <input type="text" value={value}
      onChange={e => setValue(sanitize(e.target.value))}
      onFocus={kb.onFocus}
      placeholder={placeholder ?? "0132R0800526K000363"}
      className="w-full px-5 py-4 rounded-2xl text-xl text-slate-800 bg-white/95 outline-none
        focus:ring-4 focus:ring-white/50 placeholder:text-slate-400 tracking-wider font-mono" />
  );
}

function KbCatatanInput({ value, setValue, placeholder }: {
  value: string; setValue: (v: string) => void; placeholder?: string;
}) {
  // Catatan — full alphanumeric + space
  const kb = useKbInput({ mode: "alphanumeric", value, setValue, maxLength: 100 });
  return (
    <input type="text" maxLength={100} value={value}
      onChange={e => setValue(e.target.value)}
      onFocus={kb.onFocus}
      placeholder={placeholder ?? ""}
      className="w-full px-4 py-2 rounded-lg text-sm text-slate-800 bg-white/95 outline-none
        focus:ring-2 focus:ring-white/50 placeholder:text-slate-400" />
  );
}

// ── Pendaftaran Walk-In (Non BPJS / Umum) ────────────────────────────────────
type StepDaftar = "cari" | "pilih-poli" | "pilih-dokter" | "konfirmasi" | "selesai";

function HalamanDaftar({ jenis, onKembali, namaRS }:
  { jenis: "umum" | "bpjs"; onKembali: () => void; namaRS: string }) {

  const warnaBg   = jenis === "umum" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-violet-600 hover:bg-violet-500";
  const warnaTeks = jenis === "umum" ? "text-emerald-300" : "text-violet-300";

  if (jenis === "bpjs") {
    return <HalamanDaftarBPJSEntry onKembali={onKembali} namaRS={namaRS} />;
  }

  const [step, setStep] = useState<StepDaftar>("cari");
  const [modeCari, setModeCari] = useState<"nik" | "rm">("nik");
  const [nik, setNik]   = useState("");
  const [noRm, setNoRm] = useState("");
  const [pasien, setPasien] = useState<AnjunganPasien | null>(null);
  const [poliList, setPoliList] = useState<AnjunganPoli[]>([]);
  const [poliPilih, setPoliPilih] = useState<AnjunganPoli | null>(null);
  const [dokterList, setDokterList] = useState<AnjunganDokter[]>([]);
  const [dokterPilih, setDokterPilih] = useState<AnjunganDokter | null>(null);
  const [hasilDaftar, setHasilDaftar] = useState<AnjunganDaftarResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // STEP 1 → cari NIK atau No. RM
  const handleCari = async () => {
    setLoading(true); setError(null);
    try {
      const q = modeCari === "rm" ? { no_rkm_medis: noRm.trim() } : { no_ktp: nik.trim() };
      const r = await anjunganCariPasien(q);
      if (!r.data.found || !r.data.pasien) {
        setError(r.data.message ?? "Pasien tidak ditemukan");
        return;
      }
      setPasien(r.data.pasien);
      // Pre-load list poli untuk step berikutnya
      const p = await anjunganListPoli();
      setPoliList(p.data);
      setStep("pilih-poli");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal mencari data");
    } finally { setLoading(false); }
  };

  // STEP 2 → pilih poli → load dokter
  const pickPoli = async (p: AnjunganPoli) => {
    setLoading(true); setError(null);
    setPoliPilih(p);
    try {
      const d = await anjunganListDokter(p.kd_poli);
      setDokterList(d.data);
      setStep("pilih-dokter");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat dokter");
    } finally { setLoading(false); }
  };

  // STEP 3 → pilih dokter → konfirmasi
  const pickDokter = (d: AnjunganDokter) => {
    setDokterPilih(d);
    // Task 2 Mobile JKN: lembar SEP (konfirmasi) terbuka.
    waktuTask.bukaFormSep();
    setStep("konfirmasi");
  };

  // STEP 4 → submit daftar
  const handleDaftar = async () => {
    if (!pasien || !poliPilih || !dokterPilih) return;
    setLoading(true); setError(null);
    try {
      const r = await anjunganDaftarWalkIn({
        no_rkm_medis: pasien.no_rkm_medis,
        kd_poli: poliPilih.kd_poli,
        kd_dokter: dokterPilih.kd_dokter,
      });
      setHasilDaftar(r.data);
      setStep("selesai");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal daftar"));
    } finally { setLoading(false); }
  };

  // STEP 5 (selesai) → auto print
  useEffect(() => {
    if (step !== "selesai" || !hasilDaftar) return;
    const t = setTimeout(() => window.print(), 1200);
    return () => clearTimeout(t);
  }, [step, hasilDaftar]);

  return (
    <>
    <div className="flex flex-col items-center justify-start h-full gap-5 px-8 max-w-3xl mx-auto w-full overflow-y-auto print:hidden">
      <h2 className="text-3xl font-bold text-white drop-shadow">Pendaftaran Umum</h2>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs text-white/60">
        {["NIK","Pilih Poli","Pilih Dokter","Konfirmasi","Selesai"].map((label,i) => {
          const idx = ["cari","pilih-poli","pilih-dokter","konfirmasi","selesai"].indexOf(step);
          const active = i <= idx;
          return (
            <div key={label} className="flex items-center">
              <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                active ? "bg-emerald-500 text-white" : "bg-white/10 text-white/40"
              }`}>{i+1}</span>
              <span className={`ml-1 ${active ? "text-white" : ""}`}>{label}</span>
              {i < 4 && <span className="mx-2 text-white/30">›</span>}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-red-200 bg-red-900/30 border border-red-300/30 px-4 py-2 rounded-lg text-sm w-full text-center">
          {error}
        </p>
      )}

      {/* STEP 1: CARI (toggle NIK / No. RM) */}
      {step === "cari" && (
        <>
          <p className="text-white/70 text-center">Cari data pasien berdasarkan NIK atau Nomor Rekam Medis</p>

          {/* Toggle mode */}
          <div className="inline-flex bg-white/10 border border-white/20 rounded-full p-1 gap-1">
            <button onClick={() => { setModeCari("nik"); setError(null); }}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition ${
                modeCari === "nik" ? "bg-white text-emerald-700 shadow" : "text-white/70 hover:text-white"
              }`}>
              🆔 NIK (KTP)
            </button>
            <button onClick={() => { setModeCari("rm"); setError(null); }}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition ${
                modeCari === "rm" ? "bg-white text-emerald-700 shadow" : "text-white/70 hover:text-white"
              }`}>
              🩺 No. Rekam Medis
            </button>
          </div>

          <div className="w-full max-w-md">
            <label className={`text-xs font-semibold uppercase tracking-widest ${warnaTeks} mb-1 block`}>
              {modeCari === "nik" ? "Nomor KTP (16 digit)" : "Nomor Rekam Medis"}
            </label>
            {modeCari === "nik" ? (
              <KbNikInput value={nik} setValue={setNik} onEnter={() => nik.length >= 13 && handleCari()} />
            ) : (
              <KbRmInput value={noRm} setValue={setNoRm} onEnter={() => noRm.length >= 1 && handleCari()} />
            )}
            {modeCari === "rm" && (
              <p className="text-white/50 text-xs mt-2 text-center">
                Lihat di kartu pasien atau struk kunjungan sebelumnya
              </p>
            )}
          </div>

          <div className="flex gap-4 mt-3">
            <button onClick={onKembali}
              className="px-8 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">
              ← Kembali
            </button>
            <button disabled={loading || (modeCari === "nik" ? nik.length < 13 : noRm.length < 1)} onClick={handleCari}
              className={`px-8 py-3 rounded-xl text-white font-bold text-base transition shadow-lg
                disabled:opacity-40 disabled:cursor-not-allowed ${warnaBg}`}>
              {loading ? "Mencari..." : "Cari Data →"}
            </button>
          </div>
        </>
      )}

      {/* STEP 2: PILIH POLI */}
      {step === "pilih-poli" && pasien && (
        <>
          <div className="bg-white/10 border border-white/20 rounded-xl p-4 w-full text-sm">
            <span className={`text-xs uppercase font-semibold ${warnaTeks}`}>Pasien:</span>{" "}
            <span className="text-white font-semibold">{pasien.nm_pasien}</span>{" "}
            <span className="text-white/60">· No. RM: <span className="font-mono">{pasien.no_rkm_medis}</span></span>
          </div>
          <p className="text-white/70">Pilih Poliklinik yang dituju:</p>
          {poliList.length === 0 ? (
            <div className="bg-amber-500/20 border border-amber-300/40 rounded-xl p-4 text-amber-100 text-sm text-center w-full">
              Tidak ada poli yang buka hari ini. Silakan kembali pada jadwal hari kerja.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 w-full">
              {poliList.map(p => (
                <button key={p.kd_poli} onClick={() => pickPoli(p)} disabled={loading}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-4 text-left text-white transition disabled:opacity-50">
                  <div className="font-semibold">{p.nm_poli}</div>
                  <div className="text-xs text-white/60 mt-1 font-mono">{p.kd_poli}</div>
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setStep("cari")}
            className="px-8 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">
            ← Ubah NIK
          </button>
        </>
      )}

      {/* STEP 3: PILIH DOKTER */}
      {step === "pilih-dokter" && poliPilih && (
        <>
          <div className="bg-white/10 border border-white/20 rounded-xl p-3 w-full text-sm">
            <span className="text-white/60">Poli:</span>{" "}
            <span className="text-white font-semibold">{poliPilih.nm_poli}</span>
          </div>
          <p className="text-white/70">Pilih Dokter:</p>
          {dokterList.length === 0 ? (
            <div className="bg-amber-500/20 border border-amber-300/40 rounded-xl p-4 text-amber-100 text-sm text-center w-full">
              Tidak ada dokter yang praktek di poli ini hari ini.
            </div>
          ) : (
            <div className="w-full space-y-2">
              {dokterList.map(d => {
                const penuh = d.terisi >= d.kuota;
                return (
                  <button key={d.kd_dokter} onClick={() => !penuh && pickDokter(d)} disabled={penuh}
                    className={`w-full text-left p-4 rounded-xl border transition ${
                      penuh ? "bg-red-500/10 border-red-300/30 text-red-200 cursor-not-allowed"
                            : "bg-white/10 hover:bg-white/20 border-white/20 text-white"
                    }`}>
                    <div className="font-semibold">{d.nm_dokter}</div>
                    <div className="text-xs mt-1 flex gap-3 text-white/70">
                      <span>⏰ {d.jam_mulai}–{d.jam_selesai}</span>
                      <span>Kuota: {d.terisi}/{d.kuota} {penuh && "(PENUH)"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <button onClick={() => setStep("pilih-poli")}
            className="px-8 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">
            ← Ubah Poli
          </button>
        </>
      )}

      {/* STEP 4: KONFIRMASI */}
      {step === "konfirmasi" && pasien && poliPilih && dokterPilih && (
        <>
          <div className="bg-white/10 border border-white/20 rounded-2xl p-6 w-full space-y-2">
            <p className={`text-xs uppercase tracking-widest font-semibold ${warnaTeks}`}>Konfirmasi Pendaftaran</p>
            <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm text-white">
              <span className="text-white/60">Nama</span>           <span className="font-semibold">{pasien.nm_pasien}</span>
              <span className="text-white/60">No. RM</span>         <span className="font-mono">{pasien.no_rkm_medis}</span>
              <span className="text-white/60">NIK</span>            <span className="font-mono text-xs">{pasien.no_ktp}</span>
              <span className="text-white/60">Tgl. Lahir</span>     <span>{pasien.tgl_lahir ?? "-"}</span>
              <span className="text-white/60">Jenis Kelamin</span>  <span>{pasien.jk === "L" ? "Laki-laki" : "Perempuan"}</span>
              <span className="text-white/60">Alamat</span>         <span className="text-xs">{pasien.alamat ?? "-"}</span>
              <div className="col-span-2 border-t border-white/20 my-2" />
              <span className="text-white/60">Poli Tujuan</span>    <span className="font-semibold">{poliPilih.nm_poli}</span>
              <span className="text-white/60">Dokter</span>         <span className="font-semibold">{dokterPilih.nm_dokter}</span>
              <span className="text-white/60">Jam Praktek</span>    <span>{dokterPilih.jam_mulai}–{dokterPilih.jam_selesai}</span>
              <span className="text-white/60">Cara Bayar</span>     <span>UMUM (Non BPJS)</span>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setStep("pilih-dokter")}
              className="px-8 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">
              ← Ubah
            </button>
            <button onClick={handleDaftar} disabled={loading}
              className={`px-8 py-3 rounded-xl text-white font-bold text-base transition shadow-lg disabled:opacity-50 ${warnaBg}`}>
              {loading ? "Memproses..." : "✓ Daftar Sekarang"}
            </button>
          </div>
        </>
      )}

      {/* STEP 5: SELESAI */}
      {step === "selesai" && hasilDaftar && (
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">Pendaftaran Berhasil!</p>
            <p className="text-white/70 mt-2">Silakan menunggu di ruang tunggu poli yang dituju</p>
          </div>
          <div className="bg-white rounded-3xl px-10 py-6 text-center shadow-2xl">
            <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Nomor Antrian Poli</p>
            <p className="text-7xl font-black text-emerald-700 leading-none">{hasilDaftar.no_reg}</p>
            <p className="text-slate-600 mt-3 font-semibold">{hasilDaftar.nm_poli}</p>
            <p className="text-slate-500 text-xs">No. Rawat: <span className="font-mono">{hasilDaftar.no_rawat}</span></p>
          </div>
          <button onClick={onKembali}
            className="px-10 py-3 rounded-xl bg-white text-slate-800 font-bold text-base hover:bg-slate-100 transition shadow-lg">
            Selesai — Kembali ke Menu
          </button>
        </div>
      )}
    </div>

    {/* PRINT VIEW (thermal 80mm) */}
    {step === "selesai" && hasilDaftar && (
      <div id="karcis-print" className="hidden print:block">
        <div className="text-center">
          <div className="font-bold text-base uppercase">{namaRS}</div>
          <div className="text-xs mt-1">Karcis Pendaftaran Umum</div>
          <hr className="my-2 border-t border-dashed border-black" />
          <div className="text-xs">No. Antrian Poli</div>
          <div className="font-black leading-none my-1" style={{ fontSize: "48pt" }}>{hasilDaftar.no_reg}</div>
          <hr className="my-2 border-t border-dashed border-black" />
          <div className="text-xs text-left">
            <div><strong>Nama:</strong> {hasilDaftar.nama_pasien}</div>
            <div><strong>No. RM:</strong> {hasilDaftar.no_rkm_medis}</div>
            <div><strong>Poli:</strong> {hasilDaftar.nm_poli}</div>
            <div><strong>Dokter:</strong> {hasilDaftar.nm_dokter}</div>
            <div><strong>No. Rawat:</strong> {hasilDaftar.no_rawat}</div>
            <div><strong>Tanggal:</strong> {hasilDaftar.tanggal} {hasilDaftar.jam}</div>
            <div><strong>Cara Bayar:</strong> UMUM</div>
          </div>
          <hr className="my-2 border-t border-dashed border-black" />
          <div className="text-[10px] italic">Bayar di kasir sebelum mendapat pelayanan</div>
        </div>
      </div>
    )}
    </>
  );
}

// ── Entry point BPJS: pilih Rujukan Baru / Kontrol ─────────────────────────
function HalamanDaftarBPJSEntry({ onKembali, namaRS }:
  { onKembali: () => void; namaRS: string }) {
  const [mode, setMode] = useState<"pilih" | "rujukan-baru" | "kontrol" | "mobile-jkn">("pilih");

  if (mode === "rujukan-baru")
    return <HalamanDaftarBPJS onKembali={() => setMode("pilih")} namaRS={namaRS} />;
  if (mode === "kontrol")
    return <HalamanDaftarBPJSKontrol onKembali={() => setMode("pilih")} namaRS={namaRS} />;
  if (mode === "mobile-jkn")
    return <HalamanCheckinMobileJKN onKembali={() => setMode("pilih")} namaRS={namaRS} />;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-8 max-w-4xl mx-auto w-full">
      <h2 className="text-3xl font-bold text-white drop-shadow">Pendaftaran BPJS</h2>
      <p className="text-white/70 text-center text-lg">
        Pilih jenis pendaftaran sesuai dokumen / cara booking Anda:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
        <button onClick={() => setMode("rujukan-baru")}
          className="bg-gradient-to-b from-violet-500 to-violet-700 hover:from-violet-400 hover:to-violet-600
            shadow-2xl shadow-violet-900/50 rounded-3xl p-6
            flex flex-col items-center text-white font-bold text-center
            transition-all duration-200 active:scale-95 hover:scale-105
            min-h-[220px] border border-white/10">
          <svg className="w-16 h-16 mb-3 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="text-lg mb-2">Rujukan Baru</div>
          <div className="text-xs font-normal text-white/80">
            Dari Faskes 1 (Puskesmas / dokter keluarga)
          </div>
        </button>

        <button onClick={() => setMode("kontrol")}
          className="bg-gradient-to-b from-pink-500 to-pink-700 hover:from-pink-400 hover:to-pink-600
            shadow-2xl shadow-pink-900/50 rounded-3xl p-6
            flex flex-col items-center text-white font-bold text-center
            transition-all duration-200 active:scale-95 hover:scale-105
            min-h-[220px] border border-white/10">
          <svg className="w-16 h-16 mb-3 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <div className="text-lg mb-2">Kontrol Ulang</div>
          <div className="text-xs font-normal text-white/80">
            Bawa Surat Kontrol dari kunjungan sebelumnya
          </div>
        </button>

        <button onClick={() => setMode("mobile-jkn")}
          className="bg-gradient-to-b from-cyan-500 to-cyan-700 hover:from-cyan-400 hover:to-cyan-600
            shadow-2xl shadow-cyan-900/50 rounded-3xl p-6
            flex flex-col items-center text-white font-bold text-center
            transition-all duration-200 active:scale-95 hover:scale-105
            min-h-[220px] border border-white/10">
          <svg className="w-16 h-16 mb-3 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <div className="text-lg mb-2">Mobile JKN</div>
          <div className="text-xs font-normal text-white/80">
            Sudah booking lewat aplikasi Mobile JKN
          </div>
        </button>
      </div>

      <button onClick={onKembali}
        className="px-10 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">
        ← Kembali ke Menu
      </button>
    </div>
  );
}

// ── Pendaftaran BPJS Rujukan Baru (port APMSEPDuaPrinter Menu 2) ─────────────
type StepBPJS = "cari" | "rujukan" | "dokter" | "konfirmasi" | "selesai";

function HalamanDaftarBPJS({ onKembali, namaRS }: { onKembali: () => void; namaRS: string }) {
  const [step, setStep] = useState<StepBPJS>("cari");
  const [modeCari, setModeCari] = useState<"nik" | "nokartu">("nokartu");
  const [nik, setNik] = useState("");
  const [nokartu, setNokartu] = useState("");
  const [peserta, setPeserta] = useState<AnjunganBpjsPeserta | null>(null);
  const [rujukanList, setRujukanList] = useState<AnjunganBpjsRujukan[]>([]);
  const [rujukanPilih, setRujukanPilih] = useState<AnjunganBpjsRujukan | null>(null);
  const [kdPoliRS, setKdPoliRS] = useState<string>("");
  const [nmPoliRS, setNmPoliRS] = useState<string>("");
  const [dokterList, setDokterList] = useState<AnjunganDokter[]>([]);
  const [dokterPilih, setDokterPilih] = useState<AnjunganDokter | null>(null);
  const [noRkmLokal, setNoRkmLokal] = useState<string>("");
  const [hasilDaftar, setHasilDaftar] = useState<AnjunganDaftarResp | null>(null);
  const [hasilSep, setHasilSep] = useState<CreateSepResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Helper agent biometrik
  const [helper, setHelper] = useState<HelperInfo | null>(null);
  const [biometrikMsg, setBiometrikMsg] = useState<{ t: "ok" | "warn"; m: string } | null>(null);
  // Detect helper agent on mount
  useEffect(() => {
    helperInfo().then(setHelper).catch(() => setHelper(null));
  }, []);

  const launchBiometrik = async (mode: "finger" | "frista") => {
    if (!peserta) return;
    setBiometrikMsg(null);
    try {
      const fn = mode === "finger" ? helperFinger : helperFrista;
      const r = await fn(peserta.noKartu, peserta.nik);
      setBiometrikMsg({ t: "ok", m: r.message ?? `${mode} terbuka — verifikasi di window aplikasi` });
    } catch (e) {
      const err = e as { data?: { error?: string } };
      setBiometrikMsg({ t: "warn", m: err.data?.error ?? (e instanceof Error ? e.message : "Gagal launch") });
    }
  };

  // STEP 1: cari peserta BPJS + sekaligus cari di Khanza lokal
  const handleCari = async () => {
    setLoading(true); setError(null);
    // Task 1 Mobile JKN: pasien memasukkan nomor kartu / NIK.
    waktuTask.mulaiSesi();
    try {
      const q = modeCari === "nik" ? { nik } : { nokartu };
      const r = await anjunganBpjsCekPeserta(q);
      const p = r.data?.peserta?.peserta;
      if (!p) {
        setError("Peserta tidak ditemukan di sistem BPJS");
        return;
      }
      setPeserta(p);
      // Cari pasien di Khanza lokal (kalau belum ada → harus daftar di loket)
      const lokal = await anjunganBpjsCariLokal({ no_kartu: p.noKartu });
      if (!lokal.data.found) {
        setError(lokal.data.message ?? "Pasien belum terdaftar di Khanza, harus daftar di loket dulu");
        return;
      }
      setNoRkmLokal(lokal.data.no_rkm_medis!);
      // List rujukan
      const ruj = await anjunganBpjsListRujukan(p.noKartu);
      const raw = ruj.data?.rujukan?.rujukan;
      const arr: AnjunganBpjsRujukan[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
      setRujukanList(arr);
      setStep("rujukan");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal cek peserta"));
    } finally { setLoading(false); }
  };

  // STEP 2 → pilih rujukan → cari mapping poli → load dokter
  const pickRujukan = async (r: AnjunganBpjsRujukan) => {
    setLoading(true); setError(null);
    setRujukanPilih(r);
    try {
      const poliBPJS = r.poliRujukan?.kode || "";
      if (!poliBPJS) {
        setError("Rujukan tidak memiliki kode poli BPJS");
        return;
      }
      const m = await anjunganBpjsMapingPoli(poliBPJS);
      if (!m.data.found || !m.data.kd_poli_rs) {
        setError(`Poli BPJS '${poliBPJS}' belum ada mapping ke poli RS. Hubungi admin.`);
        return;
      }
      setKdPoliRS(m.data.kd_poli_rs);
      setNmPoliRS(m.data.nm_poli ?? "");
      const d = await anjunganListDokter(m.data.kd_poli_rs);
      setDokterList(d.data);
      setStep("dokter");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal load dokter"));
    } finally { setLoading(false); }
  };

  const pickDokter = (d: AnjunganDokter) => {
    setDokterPilih(d);
    // Task 2 Mobile JKN: lembar SEP (konfirmasi) terbuka.
    waktuTask.bukaFormSep();
    setStep("konfirmasi");
  };

  const handleDaftar = async () => {
    if (!peserta || !rujukanPilih || !dokterPilih || !noRkmLokal) return;
    setLoading(true); setError(null);
    try {
      // 1. INSERT reg_periksa (kd_pj BPJS, dinormalkan backend)
      const r = await anjunganDaftarBPJS({
        no_rkm_medis: noRkmLokal,
        kd_poli: kdPoliRS,
        kd_dokter: dokterPilih.kd_dokter,
        kd_pj: "BPJ",
      });
      setHasilDaftar(r.data);

      // 2. CREATE SEP via BPJS API
      try {
        const sep = await anjunganBpjsCreateSep({
          waktu_task1: waktuTask.t1 || undefined,
          waktu_task2: waktuTask.t2 || undefined,
          no_rawat:       r.data.no_rawat,
          no_kartu:       peserta.noKartu,
          no_rkm_medis:   noRkmLokal,
          nama_pasien:    peserta.nama,
          tgl_lahir:      peserta.tglLahir,
          jk:             peserta.sex,
          no_telp:        peserta.mr?.noTelepon,
          peserta:        peserta.jenisPeserta?.keterangan,
          hak_kelas:      peserta.hakKelas?.kode,
          asal_rujukan:   "1",
          tgl_rujukan:    rujukanPilih.tglKunjungan ?? r.data.tanggal,
          no_rujukan:     rujukanPilih.noKunjungan,
          kd_ppk_rujukan: rujukanPilih.provPerujuk?.kode ?? "",
          nm_ppk_rujukan: rujukanPilih.provPerujuk?.nama ?? "",
          diag_kode:      rujukanPilih.diagnosa?.kode,
          diag_nama:      rujukanPilih.diagnosa?.nama,
          kd_poli_bpjs:   rujukanPilih.poliRujukan?.kode ?? "",
          nm_poli_bpjs:   rujukanPilih.poliRujukan?.nama ?? "",
          kd_poli_rs:     kdPoliRS,
          kd_dokter_rs:   dokterPilih.kd_dokter,
          jns_pelayanan:  "2", // Rawat Jalan
          // catatan: default "Anjungan Mandiri" di backend kalau kosong (penanda asal SEP)
        });
        setHasilSep(sep.data);
      } catch (sepErr) {
        // SEP gagal tapi reg_periksa sudah ter-insert → flag warning, lanjut ke selesai
        const ee = sepErr as { response?: { data?: { error?: string } } };
        const msg = ee.response?.data?.error ?? (sepErr instanceof Error ? sepErr.message : "SEP gagal dibuat");
        setError(`Pendaftaran tersimpan tapi SEP gagal dibuat: ${msg}\nPetugas loket BPJS akan buat manual.`);
      }

      setStep("selesai");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal daftar"));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (step !== "selesai" || !hasilDaftar) return;
    const t = setTimeout(() => window.print(), 1200);
    return () => clearTimeout(t);
  }, [step, hasilDaftar]);

  const STATUS_BPJS_COLOR = (kode: string) => kode === "0" ? "bg-emerald-500" : "bg-rose-500";

  return (
    <>
    <div className="flex flex-col items-center justify-start h-full gap-5 px-8 max-w-4xl mx-auto w-full overflow-y-auto print:hidden">
      <h2 className="text-3xl font-bold text-white drop-shadow">Pendaftaran BPJS (Rujukan Baru)</h2>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs text-white/60">
        {["Cek Peserta","Pilih Rujukan","Pilih Dokter","Konfirmasi","Selesai"].map((label,i) => {
          const idx = ["cari","rujukan","dokter","konfirmasi","selesai"].indexOf(step);
          const active = i <= idx;
          return (
            <div key={label} className="flex items-center">
              <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                active ? "bg-violet-500 text-white" : "bg-white/10 text-white/40"
              }`}>{i+1}</span>
              <span className={`ml-1 ${active ? "text-white" : ""}`}>{label}</span>
              {i < 4 && <span className="mx-2 text-white/30">›</span>}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-red-200 bg-red-900/30 border border-red-300/30 px-4 py-2 rounded-lg text-sm w-full text-center">
          {error}
        </p>
      )}

      {/* STEP 1: CARI */}
      {step === "cari" && (
        <>
          <p className="text-white/70 text-center">Cari peserta BPJS via Nomor Kartu atau NIK</p>
          <div className="inline-flex bg-white/10 border border-white/20 rounded-full p-1 gap-1">
            <button onClick={() => { setModeCari("nokartu"); setError(null); }}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition ${
                modeCari === "nokartu" ? "bg-white text-violet-700 shadow" : "text-white/70 hover:text-white"
              }`}>
              🆔 Nomor Kartu BPJS
            </button>
            <button onClick={() => { setModeCari("nik"); setError(null); }}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition ${
                modeCari === "nik" ? "bg-white text-violet-700 shadow" : "text-white/70 hover:text-white"
              }`}>
              🪪 NIK (KTP)
            </button>
          </div>
          <div className="w-full max-w-md">
            <label className="text-xs font-semibold uppercase tracking-widest text-violet-300 mb-1 block">
              {modeCari === "nokartu" ? "Nomor Kartu BPJS (13 digit)" : "Nomor KTP (16 digit)"}
            </label>
            {modeCari === "nokartu" ? (
              <KbKartuInput value={nokartu} setValue={setNokartu} onEnter={() => nokartu.length === 13 && handleCari()} />
            ) : (
              <KbNikInput value={nik} setValue={setNik} onEnter={() => nik.length >= 13 && handleCari()} />
            )}
          </div>
          <div className="flex gap-4 mt-3">
            <button onClick={onKembali}
              className="px-8 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">
              ← Kembali
            </button>
            <button disabled={loading || (modeCari === "nokartu" ? nokartu.length !== 13 : nik.length < 13)} onClick={handleCari}
              className="px-8 py-3 rounded-xl text-white font-bold text-base transition shadow-lg
                disabled:opacity-40 disabled:cursor-not-allowed bg-violet-600 hover:bg-violet-500">
              {loading ? "Mengecek BPJS..." : "Cek Peserta →"}
            </button>
          </div>
        </>
      )}

      {/* STEP 2: PILIH RUJUKAN */}
      {step === "rujukan" && peserta && (
        <>
          {/* Card peserta */}
          <div className="bg-white/10 border border-white/20 rounded-xl p-4 w-full">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="text-xs uppercase font-semibold text-violet-300">Peserta BPJS</div>
                <div className="text-xl font-bold text-white">{peserta.nama}</div>
                <div className="text-xs text-white/70 mt-1 space-y-0.5 font-mono">
                  <div>No. Kartu: {peserta.noKartu} · NIK: {peserta.nik}</div>
                  <div>No. RM Khanza: {noRkmLokal}</div>
                  <div>{peserta.jenisPeserta?.keterangan} · {peserta.hakKelas?.keterangan}</div>
                  <div>Faskes 1: {peserta.provUmum?.nmProvider} ({peserta.provUmum?.kdProvider})</div>
                </div>
              </div>
              <div className={`px-3 py-1.5 rounded-full text-white text-xs font-bold ${STATUS_BPJS_COLOR(peserta.statusPeserta?.kode || "")}`}>
                {peserta.statusPeserta?.keterangan ?? "?"}
              </div>
            </div>
          </div>

          <p className="text-white/70">Pilih rujukan yang akan dipakai:</p>
          {rujukanList.length === 0 ? (
            <div className="bg-amber-500/20 border border-amber-300/40 rounded-xl p-4 text-amber-100 text-sm text-center w-full">
              Tidak ada rujukan aktif dari Faskes 1 untuk peserta ini.
            </div>
          ) : (
            <div className="w-full space-y-2">
              {rujukanList.map(r => (
                <button key={r.noKunjungan} onClick={() => pickRujukan(r)} disabled={loading}
                  className="w-full text-left p-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition disabled:opacity-50">
                  <div className="font-semibold">{r.diagnosa?.nama}</div>
                  <div className="text-xs text-white/70 mt-1 space-y-0.5">
                    <div>Dx: <span className="font-mono">{r.diagnosa?.kode}</span> · No. Rujukan: <span className="font-mono">{r.noKunjungan}</span></div>
                    <div>Poli BPJS: <strong>{r.poliRujukan?.nama ?? "-"}</strong> ({r.poliRujukan?.kode})</div>
                    {r.keluhan && <div className="italic">Keluhan: {r.keluhan}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setStep("cari")}
            className="px-8 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">
            ← Cek Peserta Lain
          </button>
        </>
      )}

      {/* STEP 3: PILIH DOKTER */}
      {step === "dokter" && rujukanPilih && (
        <>
          <div className="bg-white/10 border border-white/20 rounded-xl p-3 w-full text-sm">
            <span className="text-white/60">Rujukan:</span>{" "}
            <span className="text-white font-mono">{rujukanPilih.diagnosa?.kode}</span>{" "}
            <span className="text-white">{rujukanPilih.diagnosa?.nama}</span>{" — "}
            <span className="text-white font-semibold">Poli RS: {nmPoliRS}</span>
          </div>
          <p className="text-white/70">Pilih Dokter (kuota terisi BPJS+Umum):</p>
          {dokterList.length === 0 ? (
            <div className="bg-amber-500/20 border border-amber-300/40 rounded-xl p-4 text-amber-100 text-sm text-center w-full">
              Tidak ada dokter praktek di poli {nmPoliRS} hari ini.
            </div>
          ) : (
            <div className="w-full space-y-2">
              {dokterList.map(d => {
                const penuh = d.terisi >= d.kuota;
                return (
                  <button key={d.kd_dokter} onClick={() => !penuh && pickDokter(d)} disabled={penuh}
                    className={`w-full text-left p-4 rounded-xl border transition ${
                      penuh ? "bg-red-500/10 border-red-300/30 text-red-200 cursor-not-allowed"
                            : "bg-white/10 hover:bg-white/20 border-white/20 text-white"
                    }`}>
                    <div className="font-semibold">{d.nm_dokter}</div>
                    <div className="text-xs mt-1 flex gap-3 text-white/70">
                      <span>⏰ {d.jam_mulai}–{d.jam_selesai}</span>
                      <span>Kuota: {d.terisi}/{d.kuota} {penuh && "(PENUH)"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <button onClick={() => setStep("rujukan")}
            className="px-8 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">
            ← Ubah Rujukan
          </button>
        </>
      )}

      {/* STEP 4: KONFIRMASI */}
      {step === "konfirmasi" && peserta && rujukanPilih && dokterPilih && (
        <>
          <div className="bg-white/10 border border-white/20 rounded-2xl p-6 w-full space-y-2">
            <p className="text-xs uppercase tracking-widest font-semibold text-violet-300">Konfirmasi Pendaftaran BPJS</p>
            <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm text-white">
              <span className="text-white/60">Nama</span>            <span className="font-semibold">{peserta.nama}</span>
              <span className="text-white/60">No. Kartu BPJS</span>  <span className="font-mono">{peserta.noKartu}</span>
              <span className="text-white/60">NIK</span>             <span className="font-mono text-xs">{peserta.nik}</span>
              <span className="text-white/60">No. RM Khanza</span>   <span className="font-mono">{noRkmLokal}</span>
              <span className="text-white/60">Hak Kelas</span>       <span>{peserta.hakKelas?.keterangan}</span>
              <span className="text-white/60">Jenis Peserta</span>   <span>{peserta.jenisPeserta?.keterangan}</span>
              <div className="col-span-2 border-t border-white/20 my-1" />
              <span className="text-white/60">No. Rujukan</span>     <span className="font-mono">{rujukanPilih.noKunjungan}</span>
              <span className="text-white/60">Diagnosa Rujukan</span><span><span className="font-mono">{rujukanPilih.diagnosa?.kode}</span> — {rujukanPilih.diagnosa?.nama}</span>
              <span className="text-white/60">Poli BPJS</span>       <span>{rujukanPilih.poliRujukan?.nama}</span>
              <span className="text-white/60">Poli RS</span>         <span className="font-semibold">{nmPoliRS}</span>
              <span className="text-white/60">Dokter</span>          <span className="font-semibold">{dokterPilih.nm_dokter}</span>
              <span className="text-white/60">Cara Bayar</span>      <span>BPJS</span>
            </div>
          </div>

          {/* Biometrik — selalu tampil, button disabled kalau helper / aplikasi tidak ada */}
          <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3">
            <p className="text-xs uppercase tracking-widest font-semibold text-violet-300 mb-2">
              🔐 Verifikasi Biometrik (Opsional)
            </p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => launchBiometrik("finger")}
                disabled={!helper?.ok || !helper.finger.available}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm
                  disabled:opacity-40 disabled:cursor-not-allowed transition"
                title={
                  !helper ? "Helper Agent tidak terdeteksi di komputer ini"
                  : !helper.finger.available ? "Aplikasi sidik jari tidak terdeteksi"
                  : "Launch Aplikasi Sidik Jari BPJS"
                }>
                🔐 Sidik Jari BPJS
              </button>
              <button onClick={() => launchBiometrik("frista")}
                disabled={!helper?.ok || !helper.frista.available}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm
                  disabled:opacity-40 disabled:cursor-not-allowed transition"
                title={
                  !helper ? "Helper Agent tidak terdeteksi di komputer ini"
                  : !helper.frista.available ? "Aplikasi Frista tidak terdeteksi"
                  : "Launch Frista (Wajah)"
                }>
                📷 Frista (Wajah)
              </button>
            </div>
            {biometrikMsg && (
              <p className={`text-xs mt-2 ${biometrikMsg.t === "ok" ? "text-emerald-300" : "text-amber-300"}`}>
                {biometrikMsg.m}
              </p>
            )}
            {!helper && (
              <p className="text-amber-300/70 text-xs mt-2">
                ⚠️ Helper Agent biometrik tidak terdeteksi — verifikasi sidik jari/wajah di Loket BPJS
              </p>
            )}
            {helper?.ok && !helper.finger.available && !helper.frista.available && (
              <p className="text-amber-300/70 text-xs mt-2">
                ℹ️ Helper Agent jalan, tapi aplikasi BPJS tidak terdeteksi. Set path di
                <code className="font-mono"> helper.toml</code>.
              </p>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={() => setStep("dokter")}
              className="px-8 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">
              ← Ubah
            </button>
            <button onClick={handleDaftar} disabled={loading}
              className="px-8 py-3 rounded-xl text-white font-bold text-base transition shadow-lg disabled:opacity-50 bg-violet-600 hover:bg-violet-500">
              {loading ? "Membuat SEP..." : "✓ Daftar + Buat SEP"}
            </button>
          </div>
          <p className="text-emerald-200/80 text-xs text-center max-w-lg">
            🔐 SEP akan dibuat otomatis via BPJS VClaim API. Nomor rujukan {rujukanPilih.noKunjungan} dipakai.
          </p>
        </>
      )}

      {/* STEP 5: SELESAI */}
      {step === "selesai" && hasilDaftar && (
        <div className="flex flex-col items-center gap-5 text-center w-full max-w-lg">
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">Pendaftaran BPJS Berhasil!</p>
            {hasilSep ? (
              <p className="text-emerald-300 mt-2 font-semibold">✓ SEP otomatis dibuat — langsung ke ruang tunggu poli</p>
            ) : (
              <p className="text-amber-200 mt-2 font-semibold">⚠ SEP gagal otomatis — silakan ke Loket BPJS</p>
            )}
          </div>
          <div className="bg-white rounded-3xl px-10 py-6 text-center shadow-2xl w-full">
            <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Nomor Antrian Poli</p>
            <p className="text-7xl font-black text-violet-700 leading-none">{hasilDaftar.no_reg}</p>
            <p className="text-slate-600 mt-3 font-semibold">{hasilDaftar.nm_poli}</p>
            <p className="text-slate-500 text-xs">No. Rawat: <span className="font-mono">{hasilDaftar.no_rawat}</span></p>
            {hasilSep && (
              <div className="mt-4 pt-3 border-t border-slate-200">
                <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">No. SEP BPJS</p>
                <p className="text-2xl font-bold text-emerald-700 font-mono">{hasilSep.no_sep}</p>
              </div>
            )}
          </div>
          <button onClick={onKembali}
            className="px-10 py-3 rounded-xl bg-white text-slate-800 font-bold text-base hover:bg-slate-100 transition shadow-lg">
            Selesai — Kembali ke Menu
          </button>
        </div>
      )}
    </div>

    {/* PRINT THERMAL 80mm */}
    {step === "selesai" && hasilDaftar && peserta && rujukanPilih && (
      <div className="hidden print:block">
        <div className="text-center">
          <div className="font-bold text-base uppercase">{namaRS}</div>
          <div className="text-xs mt-1">Karcis Pendaftaran BPJS</div>
          <hr className="my-2 border-t border-dashed border-black" />
          <div className="text-xs">No. Antrian Poli</div>
          <div className="font-black leading-none my-1" style={{ fontSize: "48pt" }}>{hasilDaftar.no_reg}</div>
          <hr className="my-2 border-t border-dashed border-black" />
          <div className="text-xs text-left">
            <div><strong>Nama:</strong> {peserta.nama}</div>
            <div><strong>No. RM:</strong> {hasilDaftar.no_rkm_medis}</div>
            <div><strong>No. Kartu BPJS:</strong> {peserta.noKartu}</div>
            <div><strong>Hak Kelas:</strong> {peserta.hakKelas?.keterangan}</div>
            <div><strong>Poli:</strong> {hasilDaftar.nm_poli}</div>
            <div><strong>Dokter:</strong> {hasilDaftar.nm_dokter}</div>
            <div><strong>No. Rawat:</strong> {hasilDaftar.no_rawat}</div>
            <div><strong>No. Rujukan:</strong> {rujukanPilih.noKunjungan}</div>
            <div><strong>Dx Rujukan:</strong> {rujukanPilih.diagnosa?.kode} {rujukanPilih.diagnosa?.nama}</div>
            <div><strong>Tanggal:</strong> {hasilDaftar.tanggal} {hasilDaftar.jam}</div>
            {hasilSep && (
              <>
                <hr className="my-1 border-t border-dotted border-black" />
                <div><strong>No. SEP:</strong> <span className="font-mono">{hasilSep.no_sep}</span></div>
                <div className="text-[10px]">SEP otomatis tervalidasi BPJS</div>
              </>
            )}
          </div>
          <hr className="my-2 border-t border-dashed border-black" />
          <div className="text-[10px] italic">
            {hasilSep ? "Langsung ke ruang tunggu poli" : "Buat SEP dulu di Loket BPJS sebelum mendapat pelayanan"}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ── Pendaftaran BPJS Kontrol Ulang (Surat Kontrol RS / SKDP) ─────────────────
// Port dari APMSEPDuaPrinter DlgCekSKDPKontrol — pasien dengan surat kontrol
// dari kunjungan sebelumnya. Lebih cepat: tidak perlu cek peserta dari awal,
// langsung lookup surat kontrol di Khanza bridging_surat_kontrol_bpjs.
type StepKontrol = "cari" | "konfirmasi" | "selesai";

function HalamanDaftarBPJSKontrol({ onKembali, namaRS }:
  { onKembali: () => void; namaRS: string }) {
  const [step, setStep] = useState<StepKontrol>("cari");
  const [modeCari, setModeCari] = useState<"surat" | "kartu" | "rm" | "nik">("surat");
  const [noSurat, setNoSurat] = useState("");
  const [noKartu, setNoKartu] = useState("");
  const [noRm, setNoRm] = useState("");
  const [nik, setNik] = useState("");
  const [surat, setSurat] = useState<SuratKontrolInfo | null>(null);
  const [mapping, setMapping] = useState<SuratKontrolMapping | null>(null);
  const [sepAsal, setSepAsal] = useState<SepAsal | null>(null);
  const [tujuanKunj, setTujuanKunj] = useState<"1" | "2">("2");
  const [hasilDaftar, setHasilDaftar] = useState<AnjunganDaftarResp | null>(null);
  const [hasilSep, setHasilSep] = useState<CreateSepResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper agent (sama dengan rujukan baru)
  const [helper, setHelper] = useState<HelperInfo | null>(null);
  const [biometrikMsg, setBiometrikMsg] = useState<{ t: "ok" | "warn"; m: string } | null>(null);
  useEffect(() => { helperInfo().then(setHelper).catch(() => setHelper(null)); }, []);

  const launchBiometrik = async (mode: "finger" | "frista") => {
    if (!sepAsal?.no_kartu) return;
    setBiometrikMsg(null);
    try {
      const fn = mode === "finger" ? helperFinger : helperFrista;
      const r = await fn(sepAsal.no_kartu, undefined);
      setBiometrikMsg({ t: "ok", m: r.message ?? `${mode} terbuka — verifikasi di window aplikasi` });
    } catch (e) {
      const err = e as { data?: { error?: string } };
      setBiometrikMsg({ t: "warn", m: err.data?.error ?? (e instanceof Error ? e.message : "Gagal launch") });
    }
  };

  // STEP 1: cari surat kontrol (4 mode: surat, kartu, rm, nik)
  const handleCari = async () => {
    setLoading(true); setError(null);
    // Task 1 Mobile JKN: pasien memasukkan nomor kartu / NIK.
    waktuTask.mulaiSesi();
    try {
      const q: { no_surat?: string; no_kartu?: string; no_rkm_medis?: string; nik?: string } =
        modeCari === "surat" ? { no_surat: noSurat.trim() }
        : modeCari === "kartu" ? { no_kartu: noKartu.trim() }
        : modeCari === "rm"    ? { no_rkm_medis: noRm.trim() }
        : { nik: nik.trim() };
      const r = await anjunganBpjsCekSuratKontrol(q);
      setSurat(r.data.surat_kontrol);
      setMapping(r.data.mapping);
      setSepAsal(r.data.sep_asal);
      if (!r.data.mapping.kd_dokter_rs || !r.data.mapping.kd_poli_rs) {
        setError("Mapping dokter atau poli BPJS belum lengkap di sistem. Hubungi loket.");
        return;
      }
      if (!r.data.sep_asal) {
        setError("Data SEP asal tidak ditemukan untuk surat kontrol ini.");
        return;
      }
      setStep("konfirmasi");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; tgl_rencana?: string } } };
      setError(err.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal cek surat kontrol"));
    } finally { setLoading(false); }
  };

  // STEP 2: daftar + create SEP kontrol
  const handleDaftar = async () => {
    if (!surat || !mapping || !sepAsal || !mapping.kd_dokter_rs || !mapping.kd_poli_rs) return;
    setLoading(true); setError(null);
    try {
      // 1. INSERT reg_periksa
      const r = await anjunganDaftarBPJS({
        no_rkm_medis: sepAsal.no_rkm_medis ?? "",
        kd_poli:      mapping.kd_poli_rs,
        kd_dokter:    mapping.kd_dokter_rs,
        kd_pj:        "BPJ",
      });
      setHasilDaftar(r.data);

      // 2. Create SEP Kontrol
      try {
        const sep = await anjunganBpjsCreateSepKontrol({
          waktu_task1: waktuTask.t1 || undefined,
          waktu_task2: waktuTask.t2 || undefined,
          no_rawat:       r.data.no_rawat,
          no_surat:       surat.no_surat,
          no_kartu:       sepAsal.no_kartu ?? "",
          no_rkm_medis:   sepAsal.no_rkm_medis ?? "",
          nama_pasien:    sepAsal.nama_pasien ?? "",
          no_telp:        sepAsal.no_telp ?? "",
          peserta:        sepAsal.peserta ?? "",
          hak_kelas:      "3", // default kalau tidak tersedia
          tgl_surat:      surat.tgl_surat ?? r.data.tanggal,
          diag_kode:      sepAsal.diag_kode,
          diag_nama:      sepAsal.diag_nama,
          kd_poli_bpjs:   surat.kd_poli_bpjs,
          nm_poli_bpjs:   surat.nm_poli_bpjs,
          kd_poli_rs:     mapping.kd_poli_rs,
          kd_dokter_rs:   mapping.kd_dokter_rs,
          kd_dokter_bpjs: surat.kd_dokter_bpjs,
          tujuan_kunjungan: tujuanKunj,
          // catatan: default "Anjungan Mandiri" di backend kalau kosong
        });
        setHasilSep(sep.data);
      } catch (sepErr) {
        const ee = sepErr as { response?: { data?: { error?: string } } };
        const msg = ee.response?.data?.error ?? (sepErr instanceof Error ? sepErr.message : "SEP Kontrol gagal");
        setError(`Pendaftaran tersimpan tapi SEP Kontrol gagal: ${msg}\nPetugas loket BPJS akan buat manual.`);
      }

      setStep("selesai");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal daftar"));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (step !== "selesai" || !hasilDaftar) return;
    const t = setTimeout(() => window.print(), 1200);
    return () => clearTimeout(t);
  }, [step, hasilDaftar]);

  return (
    <>
    <div className="flex flex-col items-center justify-start h-full gap-5 px-8 max-w-3xl mx-auto w-full overflow-y-auto print:hidden">
      <h2 className="text-3xl font-bold text-white drop-shadow">Pendaftaran BPJS Kontrol</h2>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs text-white/60">
        {["Surat Kontrol","Konfirmasi","Selesai"].map((label,i) => {
          const idx = ["cari","konfirmasi","selesai"].indexOf(step);
          const active = i <= idx;
          return (
            <div key={label} className="flex items-center">
              <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                active ? "bg-pink-500 text-white" : "bg-white/10 text-white/40"
              }`}>{i+1}</span>
              <span className={`ml-1 ${active ? "text-white" : ""}`}>{label}</span>
              {i < 2 && <span className="mx-2 text-white/30">›</span>}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-red-200 bg-red-900/30 border border-red-300/30 px-4 py-2 rounded-lg text-sm w-full text-center whitespace-pre-line">
          {error}
        </p>
      )}

      {/* STEP 1: Cari surat (4 mode) */}
      {step === "cari" && (
        <>
          <p className="text-white/70 text-center">Cari surat kontrol berdasarkan:</p>

          {/* Toggle 4 mode */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full max-w-2xl">
            {([
              { key: "surat", label: "📄 No. Surat Kontrol" },
              { key: "kartu", label: "🆔 No. Kartu BPJS" },
              { key: "rm",    label: "🏥 No. Rekam Medis" },
              { key: "nik",   label: "🪪 NIK (KTP)" },
            ] as const).map(m => (
              <button key={m.key}
                onClick={() => { setModeCari(m.key); setError(null); }}
                className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                  modeCari === m.key
                    ? "bg-white text-pink-700 shadow"
                    : "bg-white/10 text-white/70 hover:text-white hover:bg-white/20 border border-white/20"
                }`}>
                {m.label}
              </button>
            ))}
          </div>

          <div className="w-full max-w-md">
            <label className="text-xs font-semibold uppercase tracking-widest text-pink-300 mb-1 block">
              {modeCari === "surat" ? "Nomor Surat Kontrol"
                : modeCari === "kartu" ? "Nomor Kartu BPJS (13 digit)"
                : modeCari === "rm" ? "Nomor Rekam Medis"
                : "Nomor KTP (NIK, 16 digit)"}
            </label>
            {modeCari === "surat" && (
              <KbSuratInput value={noSurat} setValue={setNoSurat}
                onEnter={() => noSurat.trim() && handleCari()} />
            )}
            {modeCari === "kartu" && (
              <KbKartuInput value={noKartu} setValue={setNoKartu}
                onEnter={() => noKartu.length === 13 && handleCari()} />
            )}
            {modeCari === "rm" && (
              <KbRmInput value={noRm} setValue={setNoRm}
                onEnter={() => noRm.trim() !== "" && handleCari()} />
            )}
            {modeCari === "nik" && (
              <KbNikInput value={nik} setValue={setNik}
                onEnter={() => nik.length === 16 && handleCari()} />
            )}
            <p className="text-white/50 text-xs mt-2 text-center">
              {modeCari === "surat"
                ? "Sistem cari surat kontrol persis dengan nomor ini"
                : "Sistem cari otomatis surat kontrol valid terbaru milik pasien"}
            </p>
          </div>
          <div className="flex gap-4 mt-3">
            <button onClick={onKembali}
              className="px-8 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">
              ← Kembali
            </button>
            <button
              disabled={loading || (
                modeCari === "surat" ? !noSurat.trim()
                : modeCari === "kartu" ? noKartu.length !== 13
                : modeCari === "rm" ? !noRm.trim()
                : nik.length !== 16
              )}
              onClick={handleCari}
              className="px-8 py-3 rounded-xl text-white font-bold text-base transition shadow-lg
                disabled:opacity-40 disabled:cursor-not-allowed bg-pink-600 hover:bg-pink-500">
              {loading ? "Mengecek..." : "Cari Surat Kontrol →"}
            </button>
          </div>
        </>
      )}

      {/* STEP 2: Konfirmasi */}
      {step === "konfirmasi" && surat && mapping && sepAsal && (
        <>
          <div className="bg-white/10 border border-white/20 rounded-2xl p-6 w-full space-y-2">
            <p className="text-xs uppercase tracking-widest font-semibold text-pink-300">Konfirmasi Kontrol Ulang</p>
            <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm text-white">
              <span className="text-white/60">Nama</span>             <span className="font-semibold">{sepAsal.nama_pasien}</span>
              <span className="text-white/60">No. RM</span>           <span className="font-mono">{sepAsal.no_rkm_medis}</span>
              <span className="text-white/60">No. Kartu BPJS</span>   <span className="font-mono">{sepAsal.no_kartu}</span>
              <span className="text-white/60">Jenis Peserta</span>    <span>{sepAsal.peserta}</span>
              <div className="col-span-2 border-t border-white/20 my-1" />
              <span className="text-white/60">No. Surat Kontrol</span><span className="font-mono">{surat.no_surat}</span>
              <span className="text-white/60">SEP Asal</span>         <span className="font-mono text-xs">{surat.no_sep_asal}</span>
              <span className="text-white/60">Tgl Rencana</span>      <span>{surat.tgl_rencana}</span>
              <span className="text-white/60">Tgl Surat Dibuat</span> <span>{surat.tgl_surat}</span>
              <span className="text-white/60">Diagnosa</span>         <span><span className="font-mono">{sepAsal.diag_kode}</span> — {sepAsal.diag_nama}</span>
              <div className="col-span-2 border-t border-white/20 my-1" />
              <span className="text-white/60">Poli RS</span>          <span className="font-semibold">{mapping.nm_poli_rs}</span>
              <span className="text-white/60">Dokter DPJP</span>      <span className="font-semibold">{mapping.nm_dokter_rs}</span>
              <span className="text-white/60">Cara Bayar</span>       <span>BPJS</span>
            </div>
          </div>

          {/* Tujuan Kunjungan */}
          <div className="w-full">
            <label className="text-xs uppercase tracking-widest font-semibold text-pink-300 mb-1 block">
              Tujuan Kunjungan
            </label>
            <div className="flex gap-2">
              <button onClick={() => setTujuanKunj("2")}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                  tujuanKunj === "2" ? "bg-pink-600 text-white" : "bg-white/10 text-white/80 hover:bg-white/20 border border-white/20"
                }`}>
                💬 Konsul Dokter (default)
              </button>
              <button onClick={() => setTujuanKunj("1")}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                  tujuanKunj === "1" ? "bg-pink-600 text-white" : "bg-white/10 text-white/80 hover:bg-white/20 border border-white/20"
                }`}>
                🔬 Prosedur Lanjutan
              </button>
            </div>
          </div>

          {/* Biometrik — selalu tampil */}
          <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3">
            <p className="text-xs uppercase tracking-widest font-semibold text-pink-300 mb-2">
              🔐 Verifikasi Biometrik (Opsional)
            </p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => launchBiometrik("finger")}
                disabled={!helper?.ok || !helper.finger.available}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm
                  disabled:opacity-40 disabled:cursor-not-allowed transition"
                title={
                  !helper ? "Helper Agent tidak terdeteksi di komputer ini"
                  : !helper.finger.available ? "Aplikasi sidik jari tidak terdeteksi"
                  : "Launch Aplikasi Sidik Jari BPJS"
                }>
                🔐 Sidik Jari BPJS
              </button>
              <button onClick={() => launchBiometrik("frista")}
                disabled={!helper?.ok || !helper.frista.available}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm
                  disabled:opacity-40 disabled:cursor-not-allowed transition"
                title={
                  !helper ? "Helper Agent tidak terdeteksi di komputer ini"
                  : !helper.frista.available ? "Aplikasi Frista tidak terdeteksi"
                  : "Launch Frista (Wajah)"
                }>
                📷 Frista (Wajah)
              </button>
            </div>
            {biometrikMsg && (
              <p className={`text-xs mt-2 ${biometrikMsg.t === "ok" ? "text-emerald-300" : "text-amber-300"}`}>
                {biometrikMsg.m}
              </p>
            )}
            {!helper && (
              <p className="text-amber-300/70 text-xs mt-2">
                ⚠️ Helper Agent biometrik tidak terdeteksi — verifikasi di Loket BPJS
              </p>
            )}
            {helper?.ok && !helper.finger.available && !helper.frista.available && (
              <p className="text-amber-300/70 text-xs mt-2">
                ℹ️ Helper Agent jalan, tapi aplikasi BPJS tidak terdeteksi. Set path di
                <code className="font-mono"> helper.toml</code>.
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <button onClick={() => setStep("cari")}
              className="px-8 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">
              ← Ubah
            </button>
            <button onClick={handleDaftar} disabled={loading}
              className="px-8 py-3 rounded-xl text-white font-bold text-base transition shadow-lg disabled:opacity-50 bg-pink-600 hover:bg-pink-500">
              {loading ? "Membuat SEP..." : "✓ Daftar + Buat SEP Kontrol"}
            </button>
          </div>
        </>
      )}

      {/* STEP 3: Selesai */}
      {step === "selesai" && hasilDaftar && (
        <div className="flex flex-col items-center gap-5 text-center w-full max-w-lg">
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">Pendaftaran Kontrol Berhasil!</p>
            {hasilSep ? (
              <p className="text-emerald-300 mt-2 font-semibold">✓ SEP Kontrol otomatis dibuat — langsung ke ruang tunggu poli</p>
            ) : (
              <p className="text-amber-200 mt-2 font-semibold">⚠ SEP gagal otomatis — silakan ke Loket BPJS</p>
            )}
          </div>
          <div className="bg-white rounded-3xl px-10 py-6 text-center shadow-2xl w-full">
            <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Nomor Antrian Poli</p>
            <p className="text-7xl font-black text-pink-700 leading-none">{hasilDaftar.no_reg}</p>
            <p className="text-slate-600 mt-3 font-semibold">{hasilDaftar.nm_poli}</p>
            <p className="text-slate-500 text-xs">No. Rawat: <span className="font-mono">{hasilDaftar.no_rawat}</span></p>
            {hasilSep && (
              <div className="mt-4 pt-3 border-t border-slate-200">
                <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">No. SEP BPJS</p>
                <p className="text-2xl font-bold text-emerald-700 font-mono">{hasilSep.no_sep}</p>
              </div>
            )}
          </div>
          <button onClick={onKembali}
            className="px-10 py-3 rounded-xl bg-white text-slate-800 font-bold text-base hover:bg-slate-100 transition shadow-lg">
            Selesai
          </button>
        </div>
      )}
    </div>

    {/* PRINT THERMAL 80mm */}
    {step === "selesai" && hasilDaftar && surat && sepAsal && (
      <div className="hidden print:block">
        <div className="text-center">
          <div className="font-bold text-base uppercase">{namaRS}</div>
          <div className="text-xs mt-1">Karcis Kontrol Ulang BPJS</div>
          <hr className="my-2 border-t border-dashed border-black" />
          <div className="text-xs">No. Antrian Poli</div>
          <div className="font-black leading-none my-1" style={{ fontSize: "48pt" }}>{hasilDaftar.no_reg}</div>
          <hr className="my-2 border-t border-dashed border-black" />
          <div className="text-xs text-left">
            <div><strong>Nama:</strong> {sepAsal.nama_pasien}</div>
            <div><strong>No. RM:</strong> {hasilDaftar.no_rkm_medis}</div>
            <div><strong>No. Kartu BPJS:</strong> {sepAsal.no_kartu}</div>
            <div><strong>Poli:</strong> {hasilDaftar.nm_poli}</div>
            <div><strong>Dokter:</strong> {hasilDaftar.nm_dokter}</div>
            <div><strong>No. Rawat:</strong> {hasilDaftar.no_rawat}</div>
            <div><strong>No. Surat Kontrol:</strong> {surat.no_surat}</div>
            <div><strong>Dx:</strong> {sepAsal.diag_kode} {sepAsal.diag_nama}</div>
            <div><strong>Tanggal:</strong> {hasilDaftar.tanggal} {hasilDaftar.jam}</div>
            {hasilSep && (
              <>
                <hr className="my-1 border-t border-dotted border-black" />
                <div><strong>No. SEP:</strong> <span className="font-mono">{hasilSep.no_sep}</span></div>
                <div className="text-[10px]">SEP Kontrol otomatis tervalidasi BPJS</div>
              </>
            )}
          </div>
          <hr className="my-2 border-t border-dashed border-black" />
          <div className="text-[10px] italic">
            {hasilSep ? "Langsung ke ruang tunggu poli" : "Buat SEP di Loket BPJS dulu"}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ── Pendaftaran BPJS Mobile JKN Check-in (port APMSEPDuaPrinter Menu 4) ─────
// Pasien yang sudah booking via aplikasi Mobile JKN HP — kiosk hanya check-in
// (UPDATE status booking → 'Checkin'). SEP / reg_periksa dibuat di loket
// pendaftaran.
type StepMobileJkn = "cari" | "konfirmasi" | "form-sep" | "selesai";
type ModeMobileJkn = "kartu" | "rm" | "nik";
type JenisLabel = { [k: string]: string };
const JENIS_KUNJUNGAN_LABEL: JenisLabel = {
  "1": "Rujukan FKTP",
  "2": "Rujukan Internal",
  "3": "Kontrol",
  "4": "Rujukan Antar RS",
};

function HalamanCheckinMobileJKN({ onKembali, namaRS }: { onKembali: () => void; namaRS: string }) {
  const [step, setStep] = useState<StepMobileJkn>("cari");
  const [modeCari, setModeCari] = useState<ModeMobileJkn>("kartu");
  const [noKartu, setNoKartu] = useState("");
  const [noRm, setNoRm] = useState("");
  const [nik, setNik] = useState("");
  const [booking, setBooking] = useState<MobileJknBooking | null>(null);
  const [mapping, setMapping] = useState<MobileJknMapping | null>(null);
  const [sudahDaftar, setSudahDaftar] = useState(false);
  const [hasilCheckin, setHasilCheckin] = useState<{
    nobooking: string; norm: string;
    no_rawat?: string; no_reg?: string;
    nm_poli?: string; nm_dokter?: string;
    no_sep?: string | null;
    sep_error?: string | null;
    auto_sep: boolean;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form SEP (setelah prepare)
  const [prep, setPrep] = useState<PrepareSepResp | null>(null);
  const [dokterPilih, setDokterPilih] = useState("");          // kd_dokter_rs terpilih
  const [tujuanKunj, setTujuanKunj] = useState<"1" | "2">("2"); // 2=Konsul 1=Prosedur (kontrol)
  const [catatanSep, setCatatanSep] = useState("");

  // Helper agent biometrik
  const [helper, setHelper] = useState<HelperInfo | null>(null);
  const [biometrikMsg, setBiometrikMsg] = useState<{ t: "ok" | "warn"; m: string } | null>(null);
  useEffect(() => { helperInfo().then(setHelper).catch(() => setHelper(null)); }, []);

  const launchBiometrik = async (mode: "finger" | "frista") => {
    if (!booking?.nomorkartu) return;
    setBiometrikMsg(null);
    try {
      const fn = mode === "finger" ? helperFinger : helperFrista;
      const r = await fn(booking.nomorkartu, booking.nik ?? undefined);
      setBiometrikMsg({ t: "ok", m: r.message ?? `${mode} terbuka — verifikasi di window aplikasi` });
    } catch (e) {
      const err = e as { data?: { error?: string } };
      setBiometrikMsg({ t: "warn", m: err.data?.error ?? (e instanceof Error ? e.message : "Gagal launch") });
    }
  };

  const handleCari = async () => {
    setLoading(true); setError(null);
    // Task 1 Mobile JKN: pasien memasukkan nomor kartu / NIK.
    waktuTask.mulaiSesi();
    try {
      const q: { no_kartu?: string; no_rkm_medis?: string; nik?: string } =
        modeCari === "kartu" ? { no_kartu: noKartu.trim() }
        : modeCari === "rm" ? { no_rkm_medis: noRm.trim() }
        : { nik: nik.trim() };
      const r = await anjunganBpjsCekMobileJkn(q);
      setBooking(r.data.booking);
      setMapping(r.data.mapping);
      setSudahDaftar(r.data.sudah_daftar_hari_ini);
      setStep("konfirmasi");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal cek booking"));
    } finally { setLoading(false); }
  };

  // Langkah 1: check-in (tandai) + siapkan data form SEP — BELUM buat reg_periksa/SEP.
  const handlePrepare = async () => {
    if (!booking || !mapping?.kd_poli_rs) return;
    setLoading(true); setError(null);
    try {
      const r = await anjunganBpjsPrepareMobileJkn({
        nobooking:      booking.nobooking,
        nomorkartu:     booking.nomorkartu,
        norm:           booking.norm,
        kd_poli_rs:     mapping.kd_poli_rs,
        jeniskunjungan: booking.jeniskunjungan,
        nomorreferensi: booking.nomorreferensi ?? undefined,
      });
      setPrep(r.data);
      const list = r.data.daftar_dokter ?? [];
      const def = list.find(d => d.kd_dokter === mapping.kd_dokter_rs)?.kd_dokter
        ?? list[0]?.kd_dokter ?? mapping.kd_dokter_rs ?? "";
      setDokterPilih(def);
      setTujuanKunj("2");
      setCatatanSep("");
      setStep("form-sep");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal siapkan form SEP"));
    } finally { setLoading(false); }
  };

  // Langkah 2: dari form SEP -> buat reg_periksa + SEP + task.
  const handleBuatSep = async () => {
    if (!booking || !prep || !dokterPilih) return;
    setLoading(true); setError(null);
    try {
      const dok = prep.daftar_dokter.find(d => d.kd_dokter === dokterPilih);
      const kodeDokterBpjs = dok?.kd_dokter_bpjs ?? booking.kodedokter;
      const isKontrol = booking.jeniskunjungan.startsWith("3");
      const r = await anjunganBpjsCheckinMobileJkn({
        waktu_task2: waktuTask.t2 || undefined,
        nobooking:        booking.nobooking,
        norm:             booking.norm,
        nomorkartu:       booking.nomorkartu,
        kd_poli_rs:       prep.kd_poli_rs,
        kd_dokter_rs:     dokterPilih,
        kode_poli_bpjs:   booking.kodepoli,
        kode_dokter_bpjs: kodeDokterBpjs ?? "",
        jeniskunjungan:   booking.jeniskunjungan,
        nomorreferensi:   booking.nomorreferensi ?? undefined,
        catatan:          catatanSep.trim() || undefined,
        tujuan_kunjungan: isKontrol ? tujuanKunj : undefined,
        auto_sep:         true,
      });
      setHasilCheckin({
        nobooking: r.data.nobooking,
        norm:      r.data.norm ?? booking.norm,
        no_rawat:  r.data.no_rawat,
        no_reg:    r.data.no_reg,
        nm_poli:   r.data.nm_poli,
        nm_dokter: r.data.nm_dokter,
        no_sep:    r.data.no_sep,
        sep_error: r.data.sep_error,
        auto_sep:  r.data.auto_sep,
        message:   r.data.message,
      });
      setStep("selesai");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal buat SEP"));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (step !== "selesai" || !hasilCheckin) return;
    const t = setTimeout(() => window.print(), 1200);
    return () => clearTimeout(t);
  }, [step, hasilCheckin]);

  return (
    <>
    <div className="flex flex-col items-center justify-start h-full gap-5 px-8 max-w-3xl mx-auto w-full overflow-y-auto print:hidden">
      <h2 className="text-3xl font-bold text-white drop-shadow">Check-in Mobile JKN</h2>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs text-white/60">
        {["Cari Booking","Konfirmasi","Form SEP","Selesai"].map((label, i) => {
          const idx = ["cari","konfirmasi","form-sep","selesai"].indexOf(step);
          const active = i <= idx;
          return (
            <div key={label} className="flex items-center">
              <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                active ? "bg-cyan-500 text-white" : "bg-white/10 text-white/40"
              }`}>{i + 1}</span>
              <span className={`ml-1 ${active ? "text-white" : ""}`}>{label}</span>
              {i < 3 && <span className="mx-2 text-white/30">›</span>}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-red-200 bg-red-900/30 border border-red-300/30 px-4 py-2 rounded-lg text-sm w-full text-center whitespace-pre-line">
          {error}
        </p>
      )}

      {/* STEP 1: cari booking */}
      {step === "cari" && (
        <>
          <p className="text-white/70 text-center">Cari booking yang sudah dibuat via aplikasi Mobile JKN HP:</p>

          <div className="grid grid-cols-3 gap-2 w-full max-w-xl">
            {([
              { key: "kartu", label: "🆔 No. Kartu BPJS" },
              { key: "rm",    label: "🏥 No. Rekam Medis" },
              { key: "nik",   label: "🪪 NIK (KTP)" },
            ] as const).map(m => (
              <button key={m.key} onClick={() => { setModeCari(m.key); setError(null); }}
                className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                  modeCari === m.key
                    ? "bg-white text-cyan-700 shadow"
                    : "bg-white/10 text-white/70 hover:bg-white/20 border border-white/20"
                }`}>{m.label}</button>
            ))}
          </div>

          <div className="w-full max-w-md">
            <label className="text-xs font-semibold uppercase tracking-widest text-cyan-300 mb-1 block">
              {modeCari === "kartu" ? "Nomor Kartu BPJS (13 digit)"
                : modeCari === "rm" ? "Nomor Rekam Medis"
                : "Nomor KTP (NIK, 16 digit)"}
            </label>
            {modeCari === "kartu" && (
              <KbKartuInput value={noKartu} setValue={setNoKartu}
                onEnter={() => noKartu.length === 13 && handleCari()} />
            )}
            {modeCari === "rm" && (
              <KbRmInput value={noRm} setValue={setNoRm}
                onEnter={() => noRm.trim() !== "" && handleCari()} />
            )}
            {modeCari === "nik" && (
              <KbNikInput value={nik} setValue={setNik}
                onEnter={() => nik.length === 16 && handleCari()} />
            )}
            <p className="text-white/50 text-xs mt-2 text-center">
              Sistem cari booking aktif hari ini di RSCB
            </p>
          </div>
          <div className="flex gap-4 mt-3">
            <button onClick={onKembali}
              className="px-8 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">
              ← Kembali
            </button>
            <button
              disabled={loading || (
                modeCari === "kartu" ? noKartu.length !== 13
                : modeCari === "rm" ? !noRm.trim()
                : nik.length !== 16
              )}
              onClick={handleCari}
              className="px-8 py-3 rounded-xl text-white font-bold text-base transition shadow-lg
                disabled:opacity-40 disabled:cursor-not-allowed bg-cyan-600 hover:bg-cyan-500">
              {loading ? "Mengecek..." : "Cari Booking →"}
            </button>
          </div>
        </>
      )}

      {/* STEP 2: konfirmasi check-in */}
      {step === "konfirmasi" && booking && mapping && (
        <>
          <div className="bg-white/10 border border-white/20 rounded-2xl p-6 w-full space-y-2">
            <div className="flex items-start justify-between">
              <p className="text-xs uppercase tracking-widest font-semibold text-cyan-300">Booking Mobile JKN Ditemukan</p>
              <span className={`text-xs px-2 py-1 rounded-full ${
                booking.status === "Belum" ? "bg-amber-500/30 text-amber-100"
                : booking.status === "Checkin" ? "bg-emerald-500/30 text-emerald-100"
                : "bg-slate-500/30 text-slate-100"
              }`}>
                Status: {booking.status}
              </span>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm text-white">
              <span className="text-white/60">No. Booking</span>     <span className="font-mono">{booking.nobooking}</span>
              <span className="text-white/60">Nama</span>            <span className="font-semibold">{booking.nama_pasien ?? "(tidak ada)"}</span>
              <span className="text-white/60">No. RM</span>          <span className="font-mono">{booking.norm}</span>
              <span className="text-white/60">No. Kartu BPJS</span>  <span className="font-mono">{booking.nomorkartu}</span>
              <span className="text-white/60">No. HP</span>          <span>{booking.nohp ?? "-"}</span>
              <div className="col-span-2 border-t border-white/20 my-1" />
              <span className="text-white/60">Tgl Periksa</span>     <span>{booking.tanggalperiksa}</span>
              <span className="text-white/60">Jam Praktek</span>     <span>{booking.jampraktek}</span>
              <span className="text-white/60">Jenis Kunjungan</span> <span>{JENIS_KUNJUNGAN_LABEL[booking.jeniskunjungan] ?? booking.jeniskunjungan}</span>
              {booking.nomorreferensi && (
                <>
                  <span className="text-white/60">No. Rujukan/Kontrol</span>
                  <span className="font-mono">{booking.nomorreferensi}</span>
                </>
              )}
              <div className="col-span-2 border-t border-white/20 my-1" />
              <span className="text-white/60">Poli</span>            <span className="font-semibold">{mapping.nm_poli_rs ?? "(mapping belum ada)"}</span>
              <span className="text-white/60">Dokter</span>          <span className="font-semibold">{mapping.nm_dokter_rs ?? "(mapping belum ada)"}</span>
              <div className="col-span-2 border-t border-white/20 my-1" />
              <span className="text-white/60">No. Antrean BPJS</span><span className="font-mono">{booking.nomorantrean ?? "-"}</span>
              <span className="text-white/60">Urutan</span>          <span className="font-mono">{booking.angkaantrean ?? "-"}</span>
              <span className="text-white/60">Estimasi Dilayani</span><span>{booking.estimasidilayani ?? "-"}</span>
            </div>
          </div>

          {sudahDaftar && (
            <p className="text-amber-200 bg-amber-900/30 border border-amber-300/30 px-4 py-2 rounded-lg text-sm w-full text-center">
              ⚠️ Pasien sudah daftar reg_periksa hari ini. Check-in tetap bisa, tapi reg_periksa tidak dibuat ulang.
            </p>
          )}

          {/* Biometrik — selalu tampil */}
          <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3">
            <p className="text-xs uppercase tracking-widest font-semibold text-cyan-300 mb-2">
              🔐 Verifikasi Biometrik (Opsional)
            </p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => launchBiometrik("finger")}
                disabled={!helper?.ok || !helper.finger.available}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm
                  disabled:opacity-40 disabled:cursor-not-allowed transition"
                title={
                  !helper ? "Helper Agent tidak terdeteksi"
                  : !helper.finger.available ? "Aplikasi sidik jari tidak terdeteksi"
                  : "Launch Aplikasi Sidik Jari BPJS"
                }>
                🔐 Sidik Jari BPJS
              </button>
              <button onClick={() => launchBiometrik("frista")}
                disabled={!helper?.ok || !helper.frista.available}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm
                  disabled:opacity-40 disabled:cursor-not-allowed transition"
                title={
                  !helper ? "Helper Agent tidak terdeteksi"
                  : !helper.frista.available ? "Aplikasi Frista tidak terdeteksi"
                  : "Launch Frista (Wajah)"
                }>
                📷 Frista (Wajah)
              </button>
            </div>
            {biometrikMsg && (
              <p className={`text-xs mt-2 ${biometrikMsg.t === "ok" ? "text-emerald-300" : "text-amber-300"}`}>
                {biometrikMsg.m}
              </p>
            )}
            {!helper && (
              <p className="text-amber-300/70 text-xs mt-2">
                ⚠️ Helper Agent biometrik tidak terdeteksi — verifikasi di Loket BPJS
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <button onClick={() => setStep("cari")}
              className="px-8 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">
              ← Ubah
            </button>
            <button onClick={handlePrepare} disabled={loading || !mapping.kd_poli_rs}
              className="px-8 py-3 rounded-xl text-white font-bold text-base transition shadow-lg disabled:opacity-50 bg-cyan-600 hover:bg-cyan-500">
              {loading ? "Memproses..." : "Lanjut ke Form SEP →"}
            </button>
          </div>
          <p className="text-cyan-200/70 text-xs text-center max-w-lg">
            ℹ️ Menandai booking &quot;Checkin&quot; lalu tampilkan Form SEP untuk diperiksa &amp; dibuat.
          </p>
        </>
      )}

      {/* STEP 3: FORM SEP (periksa sebelum buat) */}
      {step === "form-sep" && booking && prep && (
        <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
          <h3 className="text-xl font-bold text-white">Form SEP — Periksa &amp; Buat</h3>
          <div className="w-full bg-white/5 border border-white/15 rounded-2xl p-5 text-sm text-white/90 space-y-2 text-left">
            <div className="grid grid-cols-3 gap-2"><span className="text-white/50">Nama</span><span className="col-span-2 font-semibold">{prep.nama}</span></div>
            <div className="grid grid-cols-3 gap-2"><span className="text-white/50">No. Kartu</span><span className="col-span-2 font-mono">{booking.nomorkartu}</span></div>
            <div className="grid grid-cols-3 gap-2"><span className="text-white/50">Hak Kelas</span><span className="col-span-2">Kelas {prep.hak_kelas}</span></div>
            <div className="grid grid-cols-3 gap-2"><span className="text-white/50">Poli</span><span className="col-span-2 font-semibold">{prep.nm_poli_bpjs || "-"}</span></div>
            <div className="grid grid-cols-3 gap-2"><span className="text-white/50">Diagnosa</span><span className="col-span-2"><span className="font-mono">{prep.diag_kode || "-"}</span> {prep.diag_nama}</span></div>
            <div className="grid grid-cols-3 gap-2"><span className="text-white/50">No. {booking.jeniskunjungan.startsWith("3") ? "Surat Kontrol" : "Rujukan"}</span><span className="col-span-2 font-mono">{prep.nomorreferensi || "-"}</span></div>

            <div className="grid grid-cols-3 gap-2 items-center pt-2 border-t border-white/10">
              <span className="text-white/50">Dokter</span>
              <select value={dokterPilih} onChange={e => setDokterPilih(e.target.value)}
                className="col-span-2 bg-slate-800 text-white border border-white/20 rounded-lg px-3 py-2">
                {prep.daftar_dokter.length === 0 && <option value="">(tidak ada jadwal dokter hari ini)</option>}
                {prep.daftar_dokter.map(d => (
                  <option key={d.kd_dokter} value={d.kd_dokter}>
                    {d.nm_dokter}{d.jam_mulai ? ` (${d.jam_mulai}-${d.jam_selesai})` : ""} · {d.terisi}/{d.kuota}
                  </option>
                ))}
              </select>
            </div>

            {booking.jeniskunjungan.startsWith("3") && (
              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="text-white/50">Tujuan Kunjungan</span>
                <div className="col-span-2 flex gap-2">
                  <button onClick={() => setTujuanKunj("2")} className={`px-3 py-1.5 rounded-lg text-xs ${tujuanKunj === "2" ? "bg-cyan-600 text-white" : "bg-white/10 text-white/70 border border-white/20"}`}>Konsul Dokter</button>
                  <button onClick={() => setTujuanKunj("1")} className={`px-3 py-1.5 rounded-lg text-xs ${tujuanKunj === "1" ? "bg-cyan-600 text-white" : "bg-white/10 text-white/70 border border-white/20"}`}>Prosedur Lanjutan</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="text-white/50">Catatan</span>
              <input value={catatanSep} onChange={e => setCatatanSep(e.target.value)} placeholder="Anjungan Mandiri"
                className="col-span-2 bg-slate-800 text-white border border-white/20 rounded-lg px-3 py-2 placeholder:text-white/30" />
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={() => setStep("konfirmasi")}
              className="px-8 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">← Kembali</button>
            <button onClick={handleBuatSep} disabled={loading || !dokterPilih}
              className="px-8 py-3 rounded-xl text-white font-bold text-base transition shadow-lg disabled:opacity-50 bg-emerald-600 hover:bg-emerald-500">
              {loading ? "Membuat SEP..." : "✓ Buat SEP"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: selesai */}
      {step === "selesai" && hasilCheckin && booking && mapping && (
        <div className="flex flex-col items-center gap-5 text-center w-full max-w-lg">
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">Check-in Berhasil!</p>
            {hasilCheckin.no_sep ? (
              <p className="text-emerald-300 mt-2 font-semibold">✓ SEP otomatis dibuat — langsung ke ruang tunggu poli</p>
            ) : hasilCheckin.auto_sep ? (
              <p className="text-amber-200 mt-2 font-semibold">
                ⚠ Reg_periksa berhasil, tapi SEP gagal — lanjut ke Loket BPJS
              </p>
            ) : (
              <p className="text-white/70 mt-2">Tunjukkan karcis ini ke Loket Pendaftaran</p>
            )}
          </div>
          <div className="bg-white rounded-3xl px-10 py-6 text-center shadow-2xl w-full">
            <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">
              {hasilCheckin.no_reg ? "Nomor Antrean Poli" : "No. Antrean BPJS"}
            </p>
            <p className="text-5xl font-black text-cyan-700 leading-none font-mono">
              {hasilCheckin.no_reg ?? booking.nomorantrean ?? booking.angkaantrean ?? "-"}
            </p>
            <p className="text-slate-600 mt-3 font-semibold">{hasilCheckin.nm_poli ?? mapping.nm_poli_rs}</p>
            <p className="text-slate-500 text-xs">
              {hasilCheckin.no_rawat ? <>No. Rawat: <span className="font-mono">{hasilCheckin.no_rawat}</span></>
                : <>No. Booking: <span className="font-mono">{hasilCheckin.nobooking}</span></>}
            </p>
            {hasilCheckin.no_sep && (
              <div className="mt-4 pt-3 border-t border-slate-200">
                <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">No. SEP BPJS</p>
                <p className="text-2xl font-bold text-emerald-700 font-mono">{hasilCheckin.no_sep}</p>
              </div>
            )}
            {!hasilCheckin.no_sep && (
              <div className="mt-4 pt-3 border-t border-slate-200">
                <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Status</p>
                <p className="text-xl font-bold text-emerald-700">✓ Checkin</p>
              </div>
            )}
          </div>
          {hasilCheckin.sep_error && (
            <p className="text-amber-200/80 text-[11px] max-w-md text-center">
              ℹ️ {hasilCheckin.sep_error}
            </p>
          )}
          <button onClick={onKembali}
            className="px-10 py-3 rounded-xl bg-white text-slate-800 font-bold text-base hover:bg-slate-100 transition shadow-lg">
            Selesai
          </button>
        </div>
      )}
    </div>

    {/* PRINT thermal 80mm */}
    {step === "selesai" && hasilCheckin && booking && mapping && (
      <div className="hidden print:block">
        <div className="text-center">
          <div className="font-bold text-base uppercase">{namaRS}</div>
          <div className="text-xs mt-1">
            Karcis {hasilCheckin.no_sep ? "Pendaftaran" : "Check-in"} Mobile JKN
          </div>
          <hr className="my-2 border-t border-dashed border-black" />
          <div className="text-xs">
            {hasilCheckin.no_reg ? "No. Antrean Poli" : "No. Antrean BPJS"}
          </div>
          <div className="font-black leading-none my-1" style={{ fontSize: "42pt" }}>
            {hasilCheckin.no_reg ?? booking.nomorantrean ?? booking.angkaantrean ?? "-"}
          </div>
          <hr className="my-2 border-t border-dashed border-black" />
          <div className="text-xs text-left">
            <div><strong>Nama:</strong> {booking.nama_pasien}</div>
            <div><strong>No. RM:</strong> {booking.norm}</div>
            <div><strong>No. Kartu BPJS:</strong> {booking.nomorkartu}</div>
            <div><strong>Poli:</strong> {hasilCheckin.nm_poli ?? mapping.nm_poli_rs}</div>
            <div><strong>Dokter:</strong> {hasilCheckin.nm_dokter ?? mapping.nm_dokter_rs}</div>
            <div><strong>Jam Praktek:</strong> {booking.jampraktek}</div>
            <div><strong>Jenis:</strong> {JENIS_KUNJUNGAN_LABEL[booking.jeniskunjungan] ?? booking.jeniskunjungan}</div>
            {booking.nomorreferensi && (
              <div><strong>No. Ref:</strong> {booking.nomorreferensi}</div>
            )}
            <div><strong>No. Booking:</strong> <span className="font-mono">{hasilCheckin.nobooking}</span></div>
            {hasilCheckin.no_rawat && (
              <div><strong>No. Rawat:</strong> <span className="font-mono">{hasilCheckin.no_rawat}</span></div>
            )}
            <div><strong>Estimasi Dilayani:</strong> {booking.estimasidilayani ?? "-"}</div>
            {hasilCheckin.no_sep && (
              <>
                <hr className="my-1 border-t border-dotted border-black" />
                <div><strong>No. SEP:</strong> <span className="font-mono">{hasilCheckin.no_sep}</span></div>
                <div className="text-[10px]">SEP otomatis tervalidasi BPJS</div>
              </>
            )}
          </div>
          <hr className="my-2 border-t border-dashed border-black" />
          <div className="text-[10px] italic">
            {hasilCheckin.no_sep
              ? "Langsung ke ruang tunggu poli"
              : "Buat SEP di Loket BPJS dulu sebelum mendapat pelayanan"}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function HalamanInformasi({ onKembali, setting }: { onKembali: () => void; setting: SettingRS | null }) {
  const tabs = ["Jam Operasional", "Fasilitas & Poli", "Kontak & Lokasi"];
  const [tab, setTab] = useState(0);

  return (
    <div className="flex flex-col items-center h-full px-8 py-4 w-full max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold text-white drop-shadow mb-6">Informasi Rumah Sakit</h2>

      {/* Tab */}
      <div className="flex gap-2 mb-6">
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition
              ${tab === i ? "bg-white text-amber-700 shadow-lg" : "bg-white/10 text-white hover:bg-white/20 border border-white/20"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Konten tab */}
      <div className="bg-white/10 border border-white/20 rounded-2xl p-6 w-full text-white text-sm flex-1 overflow-y-auto">
        {tab === 0 && (
          <table className="w-full">
            <thead><tr className="text-white/60 text-xs uppercase tracking-widest border-b border-white/10">
              <th className="text-left pb-2">Unit Layanan</th>
              <th className="text-left pb-2">Hari</th>
              <th className="text-left pb-2">Jam</th>
            </tr></thead>
            <tbody className="divide-y divide-white/10">
              {[
                ["IGD / Gawat Darurat", "Senin — Minggu", "24 Jam"],
                ["Poli Umum",           "Senin — Sabtu",  "07:30 — 14:00"],
                ["Poli Gigi",           "Senin — Jumat",  "08:00 — 12:00"],
                ["Poli Anak",           "Senin — Jumat",  "08:00 — 13:00"],
                ["Poli Kandungan",      "Senin — Kamis",  "09:00 — 12:00"],
                ["Farmasi / Apotek",    "Senin — Sabtu",  "07:00 — 21:00"],
                ["Laboratorium",        "Senin — Sabtu",  "07:00 — 14:00"],
                ["Radiologi",           "Senin — Sabtu",  "07:30 — 14:00"],
              ].map(([unit, hari, jam]) => (
                <tr key={unit}>
                  <td className="py-2 font-medium">{unit}</td>
                  <td className="py-2 text-white/70">{hari}</td>
                  <td className="py-2 font-mono">{jam}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {["IGD / Gawat Darurat","Rawat Jalan","Rawat Inap","Kamar Operasi",
              "Laboratorium","Radiologi / Rontgen","Farmasi / Apotek","Fisioterapi",
              "Gizi & Dietetik","Rekam Medis","Klinik Gigi","USG & EKG"].map(f => (
              <div key={f} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        )}

        {tab === 2 && (
          <div className="space-y-4">
            {[
              { label: "Alamat",  nilai: [setting?.alamat_instansi, setting?.kabupaten, setting?.propinsi].filter(Boolean).join(", ") },
              { label: "Telepon", nilai: setting?.kontak },
              { label: "Email",   nilai: setting?.email },
              { label: "Website", nilai: setting?.website },
            ].filter(({ nilai }) => nilai && nilai.trim() !== "").map(({ label, nilai }) => (
              <div key={label} className="flex gap-4">
                <span className="text-white/60 w-24 shrink-0">{label}</span>
                <span className="font-medium">{nilai}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={onKembali}
        className="mt-5 px-8 py-3 rounded-xl bg-white/10 text-white border border-white/30 hover:bg-white/20 transition text-base">
        ← Kembali ke Menu
      </button>
    </div>
  );
}

// ── Halaman utama Anjungan ────────────────────────────────────────────────────
export default function AnjunganPage() {
  const [setting, setSetting]   = useState<SettingRS | null>(null);
  const [aktif, setAktif]       = useState<string | null>(null);
  // Auto-reset versi — increment saat idle timeout untuk force remount sub-component
  // sehingga state internal (NIK, no kartu, hasilSep, dst.) ter-reset bersih.
  const [resetSeq, setResetSeq] = useState(0);

  // Pause mode — kalau aktif=false, kiosk diblokir dengan layar maintenance
  const [config, setConfig] = useState<AnjunganConfig | null>(null);

  // Mode Lansia — toggle font 1.5x + kontras tinggi. Persist via localStorage.
  const [modeLansia, setModeLansia] = useState(false);

  // Help overlay
  const [showHelp, setShowHelp] = useState(false);

  // ── Tes alat biometrik (finger / frista) via helper agent lokal ──────────────
  const [testMsg, setTestMsg] = useState<{ t: "ok" | "err" | "info"; m: string } | null>(null);
  const [testBusy, setTestBusy] = useState<"" | "finger" | "frista" | "info">("");
  const tesBiometrik = useCallback(async (mode: "finger" | "frista") => {
    setTestBusy(mode); setTestMsg(null);
    try {
      const fn = mode === "finger" ? helperFinger : helperFrista;
      const r = await fn("0000000000000"); // no_kartu dummy — hanya untuk uji panggil aplikasi
      setTestMsg({ t: "ok", m: `${mode.toUpperCase()} terpanggil: ${r.message ?? r.exe ?? "OK"}` });
    } catch (e) {
      const err = e as { data?: { error?: string } };
      setTestMsg({ t: "err", m: `${mode.toUpperCase()} gagal: ${err.data?.error ?? (e instanceof Error ? e.message : "helper tidak merespon (pastikan helper agent jalan di :9999)")}` });
    } finally { setTestBusy(""); }
  }, []);
  const cekHelper = useCallback(async () => {
    setTestBusy("info"); setTestMsg(null);
    try {
      const r = await helperInfo();
      setTestMsg({ t: "info", m: `Helper v${r.version} — Finger: ${r.finger.available ? "✓ siap" : "✗ tidak ada"} · Frista: ${r.frista.available ? "✓ siap" : "✗ tidak ada"}` });
    } catch {
      setTestMsg({ t: "err", m: "Helper tidak terdeteksi di http://127.0.0.1:9999 — pastikan aplikasi helper agent berjalan di komputer kiosk." });
    } finally { setTestBusy(""); }
  }, []);

  useEffect(() => {
    getSetting().then(r => setSetting(r.data)).catch(() => {});
    getAnjunganConfig().then(r => setConfig(r.data)).catch(() => setConfig({ aktif: true, maintenance_msg: "" }));
    // Polling status pause tiap 30 detik (kalau petugas IT toggle, kiosk update otomatis)
    const t = setInterval(() => {
      getAnjunganConfig().then(r => setConfig(r.data)).catch(() => {});
    }, 30_000);
    // Load mode lansia dari localStorage
    try {
      const saved = localStorage.getItem("anjungan-mode-lansia");
      if (saved === "1") setModeLansia(true);
    } catch {}
    return () => clearInterval(t);
  }, []);

  const toggleModeLansia = useCallback(() => {
    setModeLansia(v => {
      const next = !v;
      try { localStorage.setItem("anjungan-mode-lansia", next ? "1" : "0"); } catch {}
      return next;
    });
  }, []);

  const namaRS   = setting?.nama_instansi  || "Rumah Sakit";
  const kabRS    = setting?.kabupaten ? `DINAS KESEHATAN ${setting.kabupaten.toUpperCase()}` : "";
  const alamatRS = setting?.alamat_instansi || "";

  // Idle threshold — di menu utama tidak perlu watcher (default state).
  // Di sub-menu (BPJS, walk-in, dst.) aktif 60 detik (kiosk hospital best practice).
  const handleIdleReset = useCallback(() => {
    setAktif(null);
    setResetSeq(s => s + 1);
  }, []);

  // ── Pause mode — layar maintenance ─────────────────────────────────────────
  if (config && !config.aktif) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-900 via-orange-900 to-red-900 flex items-center justify-center text-white select-none px-8">
        <div className="text-center max-w-3xl">
          <div className="text-9xl mb-8">🚧</div>
          <h1 className="text-5xl font-bold mb-6">Sementara Tidak Tersedia</h1>
          <p className="text-3xl leading-relaxed opacity-90">
            {config.maintenance_msg || "Kiosk anjungan sementara tidak tersedia. Silakan menuju loket pendaftaran."}
          </p>
          <p className="mt-12 text-lg opacity-50">Mohon maaf atas ketidaknyamanannya — {namaRS}</p>
        </div>
      </div>
    );
  }

  return (
    <OnScreenKeyboardProvider>
    <IdleResetWatcher enabled={aktif !== null} idleMs={60_000} warningMs={10_000} onReset={handleIdleReset} />
    <div className={`min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-teal-900 flex flex-col select-none overflow-hidden ${modeLansia ? "text-[1.5rem]" : ""}`}
         style={modeLansia ? { fontSize: "1.25rem" } : undefined}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <img src="/logo-daerah.png" alt="Logo Daerah"
            className="h-14 w-14 object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div className="leading-tight">
            {kabRS && <p className="text-green-300 text-xs font-semibold uppercase tracking-widest">{kabRS}</p>}
            <p className="text-white text-xl font-bold">{namaRS}</p>
            {alamatRS && <p className="text-white/60 text-xs">{alamatRS}</p>}
          </div>
        </div>

        <Clock />

        <div className="flex items-center gap-4">
          <img src="/logo-rs.png" alt="Logo RS"
            className="h-14 w-14 object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <button onClick={toggleModeLansia}
            className={`text-sm px-3 py-1.5 rounded-lg transition border ${
              modeLansia
                ? "bg-yellow-400 text-amber-900 border-yellow-300 font-bold"
                : "bg-white/5 text-white/70 border-white/20 hover:bg-white/10"
            }`}
            title="Toggle Mode Lansia (font lebih besar + kontras tinggi)">
            {modeLansia ? "👵 Mode Lansia Aktif" : "👵 Mode Lansia"}
          </button>
          <button onClick={() => setShowHelp(true)}
            className="text-sm px-3 py-1.5 rounded-lg bg-blue-500/30 text-white border border-blue-300/50 hover:bg-blue-500/50 transition"
            title="Bantuan penggunaan">
            ❓ Bantuan
          </button>
          <a href="/login"
            className="text-xs text-white/30 hover:text-white/70 transition ml-2 underline underline-offset-2">
            Petugas
          </a>
        </div>
      </header>

      {/* Help overlay */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center px-6 print:hidden"
             onClick={() => setShowHelp(false)}>
          <div className="bg-white text-slate-800 rounded-3xl max-w-3xl w-full p-8 shadow-2xl"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold flex items-center gap-3">❓ Cara Menggunakan Kiosk Anjungan</h2>
              <button onClick={() => setShowHelp(false)}
                      className="text-3xl text-slate-400 hover:text-slate-700 px-3">×</button>
            </div>

            <div className="space-y-5 text-lg">
              <div>
                <p className="font-bold text-2xl mb-2">1. Ambil Tiket Antrian Loket</p>
                <p className="opacity-80">Pasien BARU yang belum punya nomor rekam medis — pilih menu <strong>"Ambil Tiket Antrian"</strong>. Bawa karcis ke loket pendaftaran.</p>
              </div>
              <div>
                <p className="font-bold text-2xl mb-2">2. Pendaftaran Umum (Tanpa BPJS)</p>
                <p className="opacity-80">Bayar sendiri / pakai asuransi lain — pilih menu <strong>"Pendaftaran Umum"</strong>. Input NIK atau nomor rekam medis, pilih poli & dokter.</p>
              </div>
              <div>
                <p className="font-bold text-2xl mb-2">3. Pendaftaran BPJS</p>
                <p className="opacity-80">Punya BPJS Kesehatan — pilih menu <strong>"Pendaftaran BPJS"</strong>. Pilih jenis: <em>Rujukan Baru</em> (dari FKTP), <em>Kontrol Ulang</em> (Surat Kontrol/SPRI), atau <em>Mobile JKN</em> (sudah booking via app).</p>
              </div>
              <div>
                <p className="font-bold text-2xl mb-2">4. Informasi Layanan</p>
                <p className="opacity-80">Pilih menu <strong>"Informasi"</strong> untuk lihat jadwal dokter, jenis layanan, dan info umum lainnya.</p>
              </div>
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 mt-4">
                <p className="font-bold text-amber-800">💡 Tips</p>
                <p className="text-amber-900 text-base mt-1">Bawa: KTP, Kartu BPJS (jika BPJS), Surat Kontrol/Rujukan (jika ada). Untuk lansia / penglihatan kurang, aktifkan <strong>👵 Mode Lansia</strong> di kanan atas.</p>
              </div>
            </div>

            <button onClick={() => setShowHelp(false)}
                    className="mt-8 w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold">
              Mengerti, tutup
            </button>
          </div>
        </div>
      )}

      {/* ── Konten ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-6">

        {/* Menu utama */}
        {!aktif && (
          <>
            <p className="text-white/70 text-lg mb-8 text-center">
              Selamat datang — Silakan pilih layanan yang Anda butuhkan
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-5xl">
              {MENU_KIOSK.map(menu => (
                <button key={menu.id} onClick={() => setAktif(menu.id)}
                  className={`bg-gradient-to-b ${menu.warna} ${menu.warnaHover}
                    ${menu.shadow} shadow-2xl rounded-3xl p-8
                    flex flex-col items-center justify-center
                    text-white font-bold text-xl text-center leading-tight
                    transition-all duration-200 active:scale-95 hover:scale-105
                    min-h-[220px] border border-white/10`}>
                  {menu.icon}
                  <span className="whitespace-pre-line text-xl">{menu.label}</span>
                </button>
              ))}
            </div>

            {/* Panel tes alat biometrik (finger / frista) */}
            <div className="mt-10 w-full max-w-3xl">
              <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex flex-wrap items-center justify-center gap-3">
                <span className="text-white/50 text-sm mr-1">🔧 Tes Alat Biometrik:</span>
                <button onClick={() => tesBiometrik("finger")} disabled={testBusy !== ""}
                  className="px-4 py-2 rounded-xl bg-blue-500/30 text-white border border-blue-300/50 hover:bg-blue-500/50 disabled:opacity-40 transition text-sm font-medium">
                  {testBusy === "finger" ? "Memanggil…" : "🖐️ Ambil Finger"}
                </button>
                <button onClick={() => tesBiometrik("frista")} disabled={testBusy !== ""}
                  className="px-4 py-2 rounded-xl bg-violet-500/30 text-white border border-violet-300/50 hover:bg-violet-500/50 disabled:opacity-40 transition text-sm font-medium">
                  {testBusy === "frista" ? "Memanggil…" : "📷 Ambil Frista"}
                </button>
                <button onClick={cekHelper} disabled={testBusy !== ""}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white/80 border border-white/20 hover:bg-white/20 disabled:opacity-40 transition text-sm">
                  {testBusy === "info" ? "Cek…" : "ℹ️ Cek Helper"}
                </button>
              </div>
              {testMsg && (
                <div className={`mt-3 text-center text-sm px-4 py-2 rounded-xl border ${
                  testMsg.t === "ok"   ? "bg-emerald-500/20 border-emerald-300/40 text-emerald-100" :
                  testMsg.t === "info" ? "bg-blue-500/20 border-blue-300/40 text-blue-100" :
                                         "bg-red-500/20 border-red-300/40 text-red-100"
                }`}>
                  {testMsg.m}
                </div>
              )}
            </div>
          </>
        )}

        {/* Sub-halaman */}
        {aktif === "antrian"     && <HalamanAntrian   key={`antri-${resetSeq}`}    onKembali={() => setAktif(null)} namaRS={namaRS} />}
        {aktif === "daftar-umum" && <HalamanDaftar    key={`umum-${resetSeq}`}     jenis="umum"  onKembali={() => setAktif(null)} namaRS={namaRS} />}
        {aktif === "daftar-bpjs" && <HalamanDaftar    key={`bpjs-${resetSeq}`}     jenis="bpjs"  onKembali={() => setAktif(null)} namaRS={namaRS} />}
        {aktif === "informasi"   && <HalamanInformasi key={`info-${resetSeq}`}     onKembali={() => setAktif(null)} setting={setting} />}

      </div>

      {/* ── Footer ── */}
      <footer className="text-center py-3 text-white/30 text-xs border-t border-white/10 shrink-0">
        SIMRS CB — Anjungan Mandiri &nbsp;•&nbsp; {namaRS}
      </footer>
    </div>
    </OnScreenKeyboardProvider>
  );
}
