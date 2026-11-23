"use client";

// Kiosk self-service: Ambil Tiket Antrian Farmasi.
// Pasien memasukkan No. RM / No. KTP / No. BPJS → sistem mencari resep rawat
// jalan hari ini yang belum diserahkan → cetak tiket dengan nomor = 4 digit
// belakang no_resep (konsisten dengan pemanggilan penyerahan obat).
// Buka layar penuh (kiosk):  /anjungan/farmasi

import { useCallback, useEffect, useRef, useState } from "react";
import { getSetting, ambilTiketFarmasi, SettingRS, TiketFarmasi } from "@/lib/api";

type Jenis = "rm" | "ktp" | "bpjs";
const JENIS: { key: Jenis; label: string; hint: string }[] = [
  { key: "rm", label: "No. Rekam Medis", hint: "Masukkan Nomor Rekam Medis" },
  { key: "ktp", label: "No. KTP (NIK)", hint: "Masukkan 16 digit NIK" },
  { key: "bpjs", label: "No. BPJS", hint: "Masukkan Nomor Kartu BPJS" },
];

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="text-right leading-tight">
      <div className="text-2xl font-mono font-bold tracking-widest">{now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
      <div className="text-xs opacity-80 capitalize">{now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
    </div>
  );
}

// Cetak hitam-putih untuk printer thermal 80mm (area cetak ~76mm).
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .tiket-print, .tiket-print * { visibility: visible !important; }
  .tiket-print {
    position: absolute; left: 0; top: 0; width: 76mm;
    background: #fff !important; color: #000 !important;
    font-family: "Arial", sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .tiket-print * { color: #000 !important; background: transparent !important; box-shadow: none !important; border-color: #000 !important; }
  @page { size: 80mm auto; margin: 2mm; }
}`;

export default function AmbilTiketFarmasiPage() {
  const [setting, setSetting] = useState<SettingRS | null>(null);
  const [jenis, setJenis] = useState<Jenis>("rm");
  const [nilai, setNilai] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [tiket, setTiket] = useState<TiketFarmasi | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { getSetting().then(r => setSetting(r.data)).catch(() => {}); }, []);

  const reset = useCallback(() => {
    setTiket(null); setNilai(""); setErr(""); setJenis("rm");
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  // Begitu tiket muncul → langsung cetak, lalu auto kembali ke awal 30 detik.
  useEffect(() => {
    if (!tiket) return;
    const p = setTimeout(() => { try { window.print(); } catch { /* abaikan */ } }, 400);
    resetTimer.current = setTimeout(reset, 30000);
    return () => { clearTimeout(p); if (resetTimer.current) clearTimeout(resetTimer.current); };
  }, [tiket, reset]);

  const tekan = (d: string) => { setErr(""); setNilai(v => (v + d).slice(0, 20)); };
  const hapus = () => setNilai(v => v.slice(0, -1));
  const bersih = () => setNilai("");

  async function ambil() {
    if (!nilai.trim()) { setErr("Masukkan nomor terlebih dahulu."); return; }
    setLoading(true); setErr("");
    try {
      const r = await ambilTiketFarmasi(jenis, nilai.trim());
      setTiket(r.data);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(ex.response?.data?.error ?? "Gagal mengambil tiket. Coba lagi.");
    } finally { setLoading(false); }
  }

  const cur = JENIS.find(j => j.key === jenis)!;

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-emerald-900 via-teal-800 to-emerald-900 text-white flex flex-col overflow-hidden select-none">
      <style>{PRINT_CSS}</style>

      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-4xl">💊</div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Ambil Tiket Antrian Farmasi</h1>
            <p className="text-sm opacity-80">{setting?.nama_instansi ?? "Instalasi Farmasi"}</p>
          </div>
        </div>
        <Clock />
      </header>

      {!tiket ? (
        <main className="flex-1 flex items-center justify-center p-6 min-h-0">
          <div className="w-full max-w-2xl bg-white/10 rounded-3xl border border-white/15 p-8 backdrop-blur">
            {/* Pilih jenis */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {JENIS.map(j => (
                <button key={j.key} onClick={() => { setJenis(j.key); setErr(""); }}
                  className={`py-4 rounded-2xl text-lg font-bold transition-colors ${jenis === j.key ? "bg-amber-400 text-slate-900" : "bg-white/10 hover:bg-white/20"}`}>
                  {j.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="mb-2 text-center text-sm opacity-80">{cur.hint}</div>
            <div className="mb-5 h-20 rounded-2xl bg-white text-slate-900 flex items-center justify-center text-5xl font-mono font-bold tracking-wider overflow-hidden">
              {nilai || <span className="text-slate-300">— — —</span>}
            </div>

            {err && <div className="mb-4 text-center text-amber-300 font-semibold">{err}</div>}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(d => (
                <button key={d} onClick={() => tekan(d)}
                  className="py-5 rounded-2xl bg-white/15 hover:bg-white/25 text-3xl font-bold">{d}</button>
              ))}
              <button onClick={hapus} className="py-5 rounded-2xl bg-white/10 hover:bg-white/20 text-xl font-bold">⌫ Hapus</button>
              <button onClick={() => tekan("0")} className="py-5 rounded-2xl bg-white/15 hover:bg-white/25 text-3xl font-bold">0</button>
              <button onClick={bersih} className="py-5 rounded-2xl bg-white/10 hover:bg-white/20 text-xl font-bold">Bersih</button>
            </div>

            <button onClick={ambil} disabled={loading}
              className="mt-6 w-full py-6 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-900 text-2xl font-extrabold shadow-lg">
              {loading ? "Memproses…" : "AMBIL TIKET"}
            </button>
          </div>
        </main>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6 min-h-0">
          {/* Tiket (juga area cetak) */}
          <div className="tiket-print bg-white text-slate-900 rounded-3xl shadow-2xl px-10 py-8 text-center w-full max-w-md">
            <div className="text-lg font-bold">{setting?.nama_instansi ?? ""}</div>
            <div className="text-sm text-slate-500 mb-2">Antrian Penyerahan Obat (Farmasi)</div>
            <div className="border-t border-dashed border-slate-300 my-3" />
            <div className="text-sm uppercase tracking-widest text-slate-500">Nomor Antrian</div>
            <div className="text-8xl font-extrabold text-black leading-none my-2">{tiket.no_antrian}</div>
            <div className="text-2xl font-bold mt-2">{tiket.nama}</div>
            <div className="text-sm text-slate-600 mt-1">No. RM {tiket.no_rkm_medis}</div>
            <div className="border-t border-dashed border-slate-300 my-3" />
            <div className="text-sm text-slate-700">{tiket.nm_poli}{tiket.nm_dokter ? ` — ${tiket.nm_dokter}` : ""}</div>
            <div className="text-xs text-slate-500 mt-1">No. Resep {tiket.no_resep}</div>
            <div className="text-xs text-slate-500">{tiket.tanggal} {tiket.jam}</div>
            <div className="text-[11px] text-slate-400 mt-3">Mohon menunggu nomor Anda dipanggil di layar farmasi.</div>
          </div>

          <div className="flex gap-4 no-print">
            <button onClick={() => window.print()}
              className="px-8 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-900 text-xl font-bold">🖨️ Cetak Ulang</button>
            <button onClick={reset}
              className="px-8 py-4 rounded-2xl bg-white/15 hover:bg-white/25 text-xl font-bold">Selesai</button>
          </div>
        </main>
      )}
    </div>
  );
}
