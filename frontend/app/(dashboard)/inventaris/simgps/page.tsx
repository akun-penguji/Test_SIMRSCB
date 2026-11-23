"use client";

// Integrasi SIMGPS — konfigurasi token API H2H vendor, tes koneksi,
// tarik (pull) data aset non-medis/sparepart/tools, dan info kirim (push).
// Semua aksi admin-only (backend memvalidasi).

import { useEffect, useState } from "react";
import InventarisNav from "@/app/(dashboard)/inventaris/InventarisNav";
import {
  getSimgpsConfig, setSimgpsConfig, testSimgps, pullSimgps, loginSimgps,
  SimgpsConfig,
} from "@/lib/api";

type Msg = { ok: boolean; t: string } | null;

export default function SimgpsPage() {
  const [cfg, setCfg] = useState<SimgpsConfig | null>(null);
  const [base, setBase] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [pullRes, setPullRes] = useState<Record<string, unknown> | null>(null);

  const load = () => getSimgpsConfig().then(r => { setCfg(r.data); setBase(r.data.base); setEmail(r.data.email); }).catch(() => {});
  useEffect(() => { load(); }, []);

  async function simpanCfg() {
    setBusy("cfg"); setMsg(null);
    try {
      await setSimgpsConfig({ base, email, ...(password ? { password } : {}) });
      setPassword("");
      setMsg({ ok: true, t: "Konfigurasi disimpan." });
      load();
    } catch { setMsg({ ok: false, t: "Gagal menyimpan (hanya admin)." }); }
    finally { setBusy(null); }
  }
  async function doLogin() {
    setBusy("login"); setMsg(null);
    try {
      const r = await loginSimgps();
      setMsg({ ok: true, t: `Login berhasil${r.data.user_name ? ` sebagai ${r.data.user_name}` : ""} — token tersimpan.` });
      load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ ok: false, t: err.response?.data?.error || "Login gagal." });
    } finally { setBusy(null); }
  }
  async function tes() {
    setBusy("test"); setMsg(null);
    try {
      const r = await testSimgps();
      setMsg({ ok: true, t: `Koneksi OK — ${r.data.jumlah_ruangan ?? 0} ruangan terbaca. ${r.data.message ?? ""}` });
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ ok: false, t: err.response?.data?.error || "Gagal terhubung ke SIMGPS." });
    } finally { setBusy(null); }
  }
  async function tarik(apply: boolean) {
    setBusy(apply ? "apply" : "preview"); setMsg(null); setPullRes(null);
    try {
      const r = await pullSimgps(apply);
      setPullRes(r.data as unknown as Record<string, unknown>);
      setMsg({ ok: true, t: apply
        ? `Sinkron selesai — ${r.data.baru} aset baru, ${r.data.diperbarui} diperbarui.`
        : "Pratinjau selesai. Klik “Tarik & Simpan” untuk menerapkan." });
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ ok: false, t: err.response?.data?.error || "Gagal menarik data." });
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <InventarisNav />
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">🔗 Integrasi SIMGPS</h1>
          <p className="text-sm text-slate-500 mt-1">
            Jembatan Host-to-Host ke sistem inventaris vendor (gps-inventory.com) via API resmi.
            Ganti mekanisme scraping lama.
          </p>
        </div>

        {msg && (
          <div className={`text-sm rounded-lg px-4 py-2 ${msg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {msg.t}
          </div>
        )}

        {/* Konfigurasi + Login */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-slate-700">1. Akun &amp; Login</h2>
          <div className="text-xs text-slate-500 -mt-2">
            Masukkan email &amp; password akun SIMGPS, klik <b>Login</b> untuk mengambil token otomatis.
            {cfg && (cfg.has_token
              ? <span className="ml-1 text-green-600 font-medium">Token aktif: {cfg.token_preview}</span>
              : <span className="ml-1 text-amber-600 font-medium">Belum login.</span>)}
          </div>
          <label className="block">
            <span className="text-sm text-slate-600">Base URL API</span>
            <input value={base} onChange={e => setBase(e.target.value)}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-slate-600">Email</span>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                placeholder="super.user@gmail.com"
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-sm text-slate-600">Password {cfg?.has_password && "(kosongkan bila tidak diganti)"}</span>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                placeholder={cfg?.has_password ? "••••••••" : "password"}
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={simpanCfg} disabled={busy === "cfg"}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-50">
              {busy === "cfg" ? "Menyimpan…" : "Simpan Akun"}
            </button>
            <button onClick={doLogin} disabled={busy === "login" || !cfg?.email || !cfg?.has_password}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
              {busy === "login" ? "Login…" : "Login & Ambil Token"}
            </button>
            <button onClick={tes} disabled={busy === "test" || !cfg?.has_token}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-50">
              {busy === "test" ? "Menguji…" : "Tes Koneksi"}
            </button>
          </div>
          <p className="text-xs text-slate-400">Simpan akun dulu, baru klik Login. Token akan otomatis diperbarui bila kadaluarsa saat menarik/mengirim data.</p>
        </section>

        {/* Tarik */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-slate-700">2. Tarik Data (Pull)</h2>
          <p className="text-xs text-slate-500 -mt-2">
            Menarik aset <b>Non-Medis/IT</b>, <b>Sparepart & Disposible</b>, dan <b>Tools & Meter</b> dari SIMGPS,
            lalu menyinkron ke tabel inventaris (dicocokkan via <code>simgps_id</code> / barcode).
            <br />Catatan: SIMGPS tidak menyediakan daftar aset medis via API — hanya master + 3 kategori di atas.
          </p>
          <div className="flex gap-2">
            <button onClick={() => tarik(false)} disabled={busy !== null || !cfg?.has_token}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-50">
              {busy === "preview" ? "Memuat…" : "Pratinjau"}
            </button>
            <button onClick={() => tarik(true)} disabled={busy !== null || !cfg?.has_token}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {busy === "apply" ? "Menyinkron…" : "Tarik & Simpan"}
            </button>
          </div>
          {pullRes != null && (
            <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto">
              {JSON.stringify(pullRes, null, 2)}
            </pre>
          )}
        </section>

        {/* Kirim */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <h2 className="font-semibold text-slate-700">3. Kirim Data (Push)</h2>
          <p className="text-xs text-slate-500">
            Kirim aset dari halaman detail inventaris (tombol “Kirim ke SIMGPS”), atau via endpoint
            <code> POST /simgps/push/&#123;resource&#125;</code> untuk kalibrasi, complain, dan mutasi.
            Pengiriman aset otomatis memetakan ruangan &amp; nama alat ke master SIMGPS; bila belum ada,
            buat master-nya dulu di SIMGPS.
          </p>
          <ul className="text-xs text-slate-500 list-disc pl-5 space-y-0.5">
            <li><code>asset</code> — tambah/perbarui inventori</li>
            <li><code>kalibrasi</code> — catatan kalibrasi (record/store)</li>
            <li><code>complain</code> / <code>response</code> — laporan &amp; tanggapan perbaikan</li>
            <li><code>mutasi</code> / <code>mutasi-approve</code> — mutasi antar ruangan</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
