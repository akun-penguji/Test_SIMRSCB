"use client";

import { useState, useEffect } from "react";
import { getSirsBotStatus, saveSirsBotConfig, sirsBotLogin, sirsBotRefreshToken, getSimrscbConfig, saveSimrscbConfig, getFarmasiDisplayConfig, putFarmasiDisplayConfig, getPendaftaranDisplayConfig, putPendaftaranDisplayConfig, getPoliList, getPoliDisplayMap, putPoliDisplayMap, Poli, PoliDisplayMap } from "@/lib/api";
import MicButton from "@/components/MicButton";

// ── Teks PHP companion script ─────────────────────────────────────────────────
const PHP_SCRIPT = `<?php
/**
 * simrscb_upload.php
 * Letakkan file ini di folder webappsrscb di server PHP:
 *   /var/www/html/webappsrscb/simrscb_upload.php
 *
 * Di pengaturan SIMRS CB, isi URL dengan:
 *   http://[ip-server-php]/webappsrscb/simrscb_upload.php
 */

$SECRET = 'GANTI_DENGAN_SECRET_ANDA'; // harus sama dengan di pengaturan

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); exit;
}
if (($_POST['secret'] ?? '') !== $SECRET) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']); exit;
}

$folder   = basename($_POST['folder']   ?? '');
$type     = $_POST['type']     ?? '';
$filename = $_POST['filename'] ?? '';
$b64      = $_POST['base64']   ?? '';

if (!in_array($type, ['foto', 'ttd'])) {
    http_response_code(400);
    echo json_encode(['error' => 'type harus foto atau ttd']); exit;
}
$filename = preg_replace('/[^a-zA-Z0-9_\\-]/', '_', $filename);
if (!$folder || !$filename || !$b64) {
    http_response_code(400);
    echo json_encode(['error' => 'Parameter tidak lengkap']); exit;
}

$dir = __DIR__ . '/' . $folder . '/' . $type . '/';
if (!is_dir($dir)) { mkdir($dir, 0755, true); }

$bytes = base64_decode($b64);
$path  = $dir . $filename . '.jpg';
if (file_put_contents($path, $bytes) === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Gagal menulis file']); exit;
}

header('Content-Type: application/json');
echo json_encode(['message' => 'OK', 'path' => $folder.'/'.$type.'/'.$filename.'.jpg']);
`;

// ── Form Display Antrian Farmasi ──────────────────────────────────────────────
function FormDisplayFarmasi({ onBack }: { onBack: () => void }) {
  const [youtube, setYoutube] = useState("");
  const [ticker,  setTicker]  = useState("");
  const [loket,   setLoket]   = useState("");
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    getFarmasiDisplayConfig()
      .then(r => {
        setYoutube(r.data.youtube || "");
        setTicker(r.data.ticker || "");
        setLoket(r.data.loket || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await putFarmasiDisplayConfig({ youtube, ticker, loket });
      setMsg({ ok: true, text: "Pengaturan display farmasi tersimpan. TV akan memakainya dalam ±15 detik tanpa reload." });
    } catch {
      setMsg({ ok: false, text: "Gagal menyimpan (hanya admin yang bisa mengubah pengaturan ini)." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-sm font-semibold text-slate-700">Display Antrian Farmasi</h2>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 py-6 text-center">Memuat...</div>
      ) : (
        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Link Video YouTube</label>
            <input type="text" value={youtube} onChange={e => setYoutube(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=… (kosongkan untuk tanpa video)"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <p className="text-xs text-slate-400 mt-1">
              Terima link utuh (youtube.com/watch?v=…, youtu.be/…) atau ID video 11 karakter.
              Video tampil di sisi kiri display, panel antrian di kanan.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Teks Berjalan (Ticker)</label>
            <div className="relative">
              <textarea value={ticker} onChange={e => setTicker(e.target.value)} rows={3}
                placeholder="Kosongkan untuk teks bawaan"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 pr-8" />
              <MicButton value={ticker} onChange={v => setTicker(v)} className="absolute right-1.5 bottom-1.5" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Nama Loket (disebut suara panggilan)</label>
            <input type="text" value={loket} onChange={e => setLoket(e.target.value)}
              placeholder="loket farmasi"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <p className="text-xs text-slate-400 mt-1">
              Contoh TTS: &quot;Panggilan farmasi. Nomor antrian 124. Atas nama Anak Adya. Obat sudah siap, silakan ambil di <strong>{loket.trim() || "loket farmasi"}</strong>&quot;
            </p>
          </div>

          {msg && (
            <div className={`text-xs px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {msg.text}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors">
              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </button>
            <a href="/display/farmasi" target="_blank" rel="noreferrer"
              className="px-4 py-2 text-sm font-semibold text-green-700 border border-green-600 hover:bg-green-50 rounded-lg transition-colors">
              Buka Display ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Form Display Antrian Pendaftaran (loket) ──────────────────────────────────
function FormDisplayPendaftaran({ onBack }: { onBack: () => void }) {
  const [youtube, setYoutube] = useState("");
  const [ticker,  setTicker]  = useState("");
  const [loket,   setLoket]   = useState("");
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    getPendaftaranDisplayConfig()
      .then(r => {
        setYoutube(r.data.youtube || "");
        setTicker(r.data.ticker || "");
        setLoket(r.data.loket || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await putPendaftaranDisplayConfig({ youtube, ticker, loket });
      setMsg({ ok: true, text: "Pengaturan display pendaftaran tersimpan. TV memakainya dalam ±15 detik tanpa reload." });
    } catch {
      setMsg({ ok: false, text: "Gagal menyimpan (hanya admin yang bisa mengubah pengaturan ini)." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-sm font-semibold text-slate-700">Display Antrian Pendaftaran</h2>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 py-6 text-center">Memuat...</div>
      ) : (
        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Link Video YouTube</label>
            <input type="text" value={youtube} onChange={e => setYoutube(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=… (kosongkan untuk tanpa video)"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <p className="text-xs text-slate-400 mt-1">
              Terima link utuh (youtube.com/watch?v=…, youtu.be/…) atau ID video 11 karakter.
              Video tampil di sisi kiri display, panel antrian di kanan.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Teks Berjalan (Ticker)</label>
            <div className="relative">
              <textarea value={ticker} onChange={e => setTicker(e.target.value)} rows={3}
                placeholder="Kosongkan untuk teks bawaan"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 pr-8" />
              <MicButton value={ticker} onChange={v => setTicker(v)} className="absolute right-1.5 bottom-1.5" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Keterangan Loket</label>
            <div className="relative">
              <textarea value={loket} onChange={e => setLoket(e.target.value)} rows={3}
                placeholder={"1:Pendaftaran Pasien Baru|2:Pendaftaran Pasien Rawat Jalan|3:Pendaftaran Pasien Poli Rawat Inap"}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 pr-8" />
              <MicButton value={loket} onChange={v => setLoket(v)} className="absolute right-1.5 bottom-1.5" />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Format: <code>nomor:keterangan</code> dipisah tanda <code>|</code>. Contoh:
              <br /><code>1:Pendaftaran Pasien Baru|2:Rawat Jalan|3:Poli Rawat Inap</code>
              <br />Kosongkan untuk memakai 3 loket bawaan.
            </p>
          </div>

          {msg && (
            <div className={`text-xs px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {msg.text}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors">
              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </button>
            <a href="/display" target="_blank" rel="noreferrer"
              className="px-4 py-2 text-sm font-semibold text-green-700 border border-green-600 hover:bg-green-50 rounded-lg transition-colors">
              Buka Display ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Form Mapping Display Antrian Poli ─────────────────────────────────────────
function FormDisplayPoli({ onBack }: { onBack: () => void }) {
  const [maps, setMaps]       = useState<PoliDisplayMap[]>([]);
  const [poliList, setPoliList] = useState<Poli[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    Promise.all([getPoliDisplayMap(), getPoliList()])
      .then(([m, p]) => { setMaps(m.data || []); setPoliList(p.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function tambahDisplay() {
    const nextId = String(
      Math.max(0, ...maps.map(m => parseInt(m.id, 10)).filter(n => !isNaN(n))) + 1
    );
    setMaps([...maps, { id: nextId, nama: "", poli: [], youtube: "", ticker: "" }]);
  }
  function hapusDisplay(idx: number) {
    setMaps(maps.filter((_, i) => i !== idx));
  }
  function ubah(idx: number, patch: Partial<PoliDisplayMap>) {
    setMaps(maps.map((m, i) => i === idx ? { ...m, ...patch } : m));
  }
  function togglePoli(idx: number, kd: string) {
    const m = maps[idx];
    const has = m.poli.includes(kd);
    ubah(idx, { poli: has ? m.poli.filter(x => x !== kd) : [...m.poli, kd] });
  }

  async function handleSave() {
    // Validasi ringan: id unik & tidak kosong
    const ids = maps.map(m => m.id.trim());
    if (ids.some(x => !x)) { setMsg({ ok: false, text: "ID display tidak boleh kosong." }); return; }
    if (new Set(ids).size !== ids.length) { setMsg({ ok: false, text: "ID display harus unik." }); return; }
    setSaving(true); setMsg(null);
    try {
      await putPoliDisplayMap(maps);
      setMsg({ ok: true, text: "Mapping display poli tersimpan. TV akan memakainya dalam ±15 detik." });
    } catch {
      setMsg({ ok: false, text: "Gagal menyimpan (hanya admin yang bisa mengubah pengaturan ini)." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-sm font-semibold text-slate-700">Display Antrian Poli</h2>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 py-6 text-center">Memuat...</div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Buat satu atau beberapa display. Tiap display bisa mencakup satu atau beberapa poli.
            Buka di TV lewat <code className="bg-slate-100 px-1 rounded">/display/poli/&lt;id&gt;</code>.
          </p>

          {maps.length === 0 && (
            <div className="py-6 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Belum ada display. Klik &quot;Tambah Display&quot; di bawah.
            </div>
          )}

          {maps.map((m, idx) => (
            <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-20">
                  <label className="text-[10px] font-medium text-slate-500 block mb-1">ID</label>
                  <input type="text" value={m.id} onChange={e => ubah(idx, { id: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-medium text-slate-500 block mb-1">Nama Display</label>
                  <input type="text" value={m.nama} onChange={e => ubah(idx, { nama: e.target.value })}
                    placeholder="mis. Display Lantai 1"
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg" />
                </div>
                <button onClick={() => hapusDisplay(idx)}
                  className="mt-4 p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Hapus display">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div>
                <label className="text-[10px] font-medium text-slate-500 block mb-1">Poli yang ditampilkan ({m.poli.length})</label>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                  {poliList.map(p => {
                    const on = m.poli.includes(p.kd_poli);
                    return (
                      <button key={p.kd_poli} onClick={() => togglePoli(idx, p.kd_poli)}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${on
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-white text-slate-600 border-slate-300 hover:border-green-400"}`}>
                        {p.nm_poli}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-slate-500 block mb-1">Link YouTube (opsional)</label>
                  <input type="text" value={m.youtube ?? ""} onChange={e => ubah(idx, { youtube: e.target.value })}
                    placeholder="youtube.com/watch?v=…"
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 block mb-1">Teks berjalan (opsional)</label>
                  <input type="text" value={m.ticker ?? ""} onChange={e => ubah(idx, { ticker: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  URL: <code className="bg-slate-100 px-1 rounded">/display/poli/{m.id || "?"}</code>
                </span>
                {m.id && (
                  <a href={`/display/poli/${m.id}`} target="_blank" rel="noreferrer"
                    className="text-xs font-semibold text-green-700 hover:underline">Buka Display ↗</a>
                )}
              </div>
            </div>
          ))}

          <button onClick={tambahDisplay}
            className="w-full py-2 text-sm font-medium text-green-700 border border-dashed border-green-400 hover:bg-green-50 rounded-lg transition-colors">
            + Tambah Display
          </button>

          {msg && (
            <div className={`text-xs px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {msg.text}
            </div>
          )}

          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors">
            {saving ? "Menyimpan..." : "Simpan Semua"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Form Konfigurasi Hybrid Web ───────────────────────────────────────────────

// ── Form Pengaturan SIRS 6.3 Bot Engine ──────────────────────────────────────
function FormSirsBot({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("rsud.cabangbungin@gmail.com");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [kodeRs, setKodeRs] = useState("3216444");
  const [namaRs, setNamaRs] = useState("RS Umum Daerah Cabangbungin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusData, setStatusData] = useState<any>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cfClearance, setCfClearance] = useState("");
  const [xsrfToken, setXsrfToken] = useState("");

  const loadStatus = () => {
    getSirsBotStatus()
      .then(r => {
        const d = r.data.data;
        setStatusData(d);
        if (d.email) setEmail(d.email);
        if (d.kode_rs) setKodeRs(d.kode_rs);
        if (d.nama_rs) setNamaRs(d.nama_rs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSave = async (andLogin: boolean) => {
    setSaving(true);
    setMsg(null);
    try {
      const payload: Record<string, any> = {
        email,
        kode_rs: kodeRs,
        nama_rs: namaRs,
      };
      if (password) {
        payload.password = password;
      }
      if (cfClearance.trim()) payload.cf_clearance = cfClearance.trim();
      if (xsrfToken.trim()) payload.xsrf_token = xsrfToken.trim();
      await saveSirsBotConfig(payload);
      if (andLogin) {
        const res = await sirsBotLogin(email, password || undefined);
        setMsg({ ok: true, text: res.data.message || "Kredensial disimpan & Login SSO Kemenkes berhasil!" });
      } else {
        setMsg({ ok: true, text: "Konfigurasi kredensial SIRS 6.3 berhasil disimpan." });
      }
      loadStatus();
    } catch (err: any) {
      setMsg({ ok: false, text: err?.response?.data?.message || err.message || "Gagal menyimpan konfigurasi" });
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await sirsBotRefreshToken();
      setMsg({ ok: true, text: res.data.message || "Token sesi SIRS berhasil diperbarui!" });
      loadStatus();
    } catch (err: any) {
      setMsg({ ok: false, text: err?.response?.data?.message || err.message || "Gagal refresh token" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>Integrasi SIRS Online 6.3 (Kemenkes RI)</span>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Native Bot</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pengaturan akun SSO Yankes dan bridging pelaporan RL 3, 4, 5 langsung ke server Kemenkes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={saving || loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors font-medium"
          >
            Perbarui Token
          </button>
        </div>
      </div>

      {msg && (
        <div className={msg.ok ? "mb-5 p-3 rounded-xl text-xs font-medium border bg-emerald-50 border-emerald-200 text-emerald-800" : "mb-5 p-3 rounded-xl text-xs font-medium border bg-red-50 border-red-200 text-red-800"}>
          {msg.text}
        </div>
      )}

      {/* Card Status Koneksi */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status Koneksi SIRS</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={statusData?.has_token ? "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" : "w-2.5 h-2.5 rounded-full bg-amber-500"}></span>
              <span className="text-sm font-bold text-slate-800">
                {statusData?.has_token ? "Terhubung ke SIRS Kemenkes" : "Belum Terhubung (Token Kosong)"}
              </span>
            </div>
            {statusData?.has_token && (
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Token Sesi: {statusData?.token_preview}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm disabled:opacity-50 transition-colors"
          >
            {saving ? "Memproses..." : "Test Login SSO Sekarang"}
          </button>
        </div>
      </div>

      <form onSubmit={e => { e.preventDefault(); handleSave(false); }} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Email Akun Yankes (SSO Kemenkes)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="rsud.cabangbungin@gmail.com"
              required
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Password SSO Yankes {statusData?.has_token && <span className="text-slate-400 font-normal">(kosongkan bila tidak berubah)</span>}
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs pr-10 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Kode Rumah Sakit (Kemenkes)</label>
            <input
              type="text"
              value={kodeRs}
              onChange={e => setKodeRs(e.target.value)}
              placeholder="3216444"
              required
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Nama Rumah Sakit</label>
            <input
              type="text"
              value={namaRs}
              onChange={e => setNamaRs(e.target.value)}
              placeholder="RS Umum Daerah Cabangbungin"
              required
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Cookie Cloudflare (cf_clearance) & XSRF-TOKEN */}
        <div className="pt-2">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-slate-600">
            <div className="font-semibold text-amber-800">Cookie Sesi Cloudflare (perlu diperbarui berkala)</div>
            <p className="text-[11px] text-amber-800/80">
              SIRS Kemenkes dilindungi Cloudflare. Bila muncul error <strong>403 Forbidden</strong> saat Kirim SIRS,
              cookie <code>cf_clearance</code> sudah kadaluarsa. Buka <code>https://sirs6.kemkes.go.id/v3/</code> di
              browser (login), tekan F12 → Application → Cookies → <code>sirs6.kemkes.go.id</code>, salin nilai
              <code>cf_clearance</code> dan <code>XSRF-TOKEN</code>, tempel di sini lalu Simpan.
              <br /><span className="font-semibold">Catatan:</span> ambil dari perangkat yang keluar internet lewat IP publik yang sama dengan server bot, karena cf_clearance terikat IP.
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">cf_clearance</label>
              <textarea
                value={cfClearance}
                onChange={e => setCfClearance(e.target.value)}
                rows={2}
                placeholder="Tempel nilai cookie cf_clearance di sini (kosongkan bila tidak diubah)"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-[11px] font-mono break-all focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">XSRF-TOKEN</label>
              <textarea
                value={xsrfToken}
                onChange={e => setXsrfToken(e.target.value)}
                rows={2}
                placeholder="Tempel nilai cookie XSRF-TOKEN di sini (kosongkan bila tidak diubah)"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-[11px] font-mono break-all focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Informasi Endpoint & SIMRS Java */}
        <div className="pt-2">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-slate-600">
            <div className="font-semibold text-slate-700">Integrasi Desktop SIMRS Khanza Java:</div>
            <p className="text-[11px]">
              Agar tombol <strong>"Kirim SIRS"</strong> di SIMRS Khanza Java langsung terhubung ke bot ini, pastikan di <code>setting/database.xml</code> client terisi:
            </p>
            <div className="bg-white p-2 rounded-lg border border-slate-200 font-mono text-[11px] text-emerald-800 select-all">
              &lt;entry key="URLSIRS6BOT"&gt;http://localhost:8080/api/sirs/bot&lt;/entry&gt;
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Kembali
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm disabled:opacity-50 transition-colors"
          >
            {saving ? "Menyimpan..." : "Simpan Kredensial"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormHosthybridweb({ onBack }: { onBack: () => void }) {
  const [hwType,   setHwType]   = useState<"local"|"remote">("local");
  const [hwVal,    setHwVal]    = useState("/var/www/html/webappsrscb/");
  const [hwSecret, setHwSecret] = useState("");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [showPhp,  setShowPhp]  = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied]     = useState(false);

  useEffect(() => {
    getSimrscbConfig()
      .then(r => {
        setHwType((r.data.hosthybridweb_type as "local"|"remote") || "local");
        setHwVal(r.data.hosthybridweb || "/var/www/html/webappsrscb/");
        setHwSecret(r.data.hosthybridweb_secret || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await saveSimrscbConfig({
        hosthybridweb_type:   hwType,
        hosthybridweb:        hwVal,
        hosthybridweb_secret: hwSecret,
      });
      setMsg({ ok: true, text: "Konfigurasi berhasil disimpan." });
    } catch {
      setMsg({ ok: false, text: "Gagal menyimpan konfigurasi." });
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(PHP_SCRIPT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-sm font-semibold text-slate-700">Path Hybrid Web (HOSTHYBRIDWEB)</h2>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 py-6 text-center">Memuat...</div>
      ) : (
        <div className="space-y-5">

          {/* Pilihan tipe server */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">Lokasi Server Penyimpanan</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Lokal */}
              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors
                ${hwType === "local"
                  ? "border-green-600 bg-green-50"
                  : "border-slate-200 hover:border-slate-300"}`}>
                <input type="radio" className="mt-0.5 accent-green-700" name="hw_type"
                  value="local" checked={hwType === "local"}
                  onChange={() => { setHwType("local"); setHwVal("/var/www/html/webappsrscb/"); }} />
                <div>
                  <p className="text-sm font-semibold text-slate-700">Server yang Sama</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Backend Rust dan server PHP (webappsrscb) berada di <strong>satu mesin</strong>.
                    File ditulis langsung ke filesystem lokal.
                  </p>
                </div>
              </label>

              {/* Remote */}
              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors
                ${hwType === "remote"
                  ? "border-blue-600 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300"}`}>
                <input type="radio" className="mt-0.5 accent-blue-600" name="hw_type"
                  value="remote" checked={hwType === "remote"}
                  onChange={() => { setHwType("remote"); setHwVal(""); }} />
                <div>
                  <p className="text-sm font-semibold text-slate-700">Server Berbeda</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Backend Rust dan server PHP berada di <strong>mesin yang berbeda</strong>.
                    File dikirim via HTTP ke PHP companion script.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Form lokal */}
          {hwType === "local" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Path Folder Lokal (absolut)
              </label>
              <input type="text" value={hwVal} onChange={e => setHwVal(e.target.value)}
                placeholder="/var/www/html/webappsrscb/"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" />
              <p className="text-[11px] text-slate-400 mt-1">
                Diakhiri <code>/</code>. Pastikan user yang menjalankan backend Rust memiliki izin tulis ke folder ini.
              </p>
              {/* Contoh struktur */}
              <div className="mt-3 bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
                <p className="font-medium text-slate-600 mb-1">Contoh file yang akan disimpan:</p>
                <code className="block">{hwVal || "/var/www/html/webappsrscb/"}persetujuanumum/foto/2026_01_15_00001.jpg</code>
                <code className="block">{hwVal || "/var/www/html/webappsrscb/"}persetujuanumum/ttd/2026_01_15_00001.jpg</code>
              </div>
            </div>
          )}

          {/* Form remote */}
          {hwType === "remote" && (
            <div className="space-y-4">
              {/* Penjelasan */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-2">
                <p className="font-semibold">Cara pengaturan server berbeda:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Salin PHP companion script di bawah</li>
                  <li>Simpan sebagai <code className="bg-blue-100 px-1 rounded">simrscb_upload.php</code> di folder <code className="bg-blue-100 px-1 rounded">webappsrscb/</code> di server PHP</li>
                  <li>Isi <strong>Secret Key</strong> yang sama di script PHP dan di form ini</li>
                  <li>Isi URL endpoint sesuai alamat Tailscale / IP server PHP</li>
                </ol>
              </div>

              {/* URL endpoint */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  URL PHP Companion Script
                </label>
                <input type="text" value={hwVal} onChange={e => setHwVal(e.target.value)}
                  placeholder="http://100.x.x.x/webappsrscb/simrscb_upload.php"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                <p className="text-[11px] text-slate-400 mt-1">
                  Bisa menggunakan IP Tailscale (contoh: <code>http://100.64.x.x/webappsrscb/simrscb_upload.php</code>)
                </p>
              </div>

              {/* Secret key */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Secret Key
                </label>
                <input type="text" value={hwSecret} onChange={e => setHwSecret(e.target.value)}
                  placeholder="Masukkan secret key (bebas, min 12 karakter)"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                <p className="text-[11px] text-slate-400 mt-1">
                  Isi dengan string acak yang sama di sini dan di variabel <code>$SECRET</code> pada script PHP.
                </p>
              </div>

              {/* PHP companion script */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setShowPhp(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    PHP Companion Script (simrscb_upload.php)
                  </span>
                  <svg className={`w-4 h-4 transition-transform ${showPhp ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showPhp && (
                  <div className="border-t border-slate-200">
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50">
                      <span className="text-[11px] text-slate-500">
                        Simpan sebagai <code>webappsrscb/simrscb_upload.php</code> di server PHP
                      </span>
                      <button onClick={handleCopy}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-lg
                                   bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {copied ? "Tersalin!" : "Salin"}
                      </button>
                    </div>
                    <pre className="text-[11px] text-slate-700 bg-slate-900 text-green-300 p-4 overflow-x-auto leading-relaxed max-h-72 overflow-y-auto font-mono">
                      {PHP_SCRIPT}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pesan */}
          {msg && (
            <div className={`rounded-lg px-4 py-2.5 text-sm ${msg.ok
              ? "bg-green-50 text-green-700 border border-green-100"
              : "bg-red-50 text-red-700 border border-red-100"}`}>
              {msg.text}
            </div>
          )}

          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-green-700 hover:bg-green-800 disabled:bg-green-400 text-white text-sm font-medium rounded-lg transition-colors">
            {saving ? "Menyimpan..." : "Simpan Konfigurasi"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Grup menu pengaturan ──────────────────────────────────────────────────────
const SETTING_GROUPS = [
  {
    label: "Profil Rumah Sakit",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    items: ["Identitas RS","Logo & Wallpaper","Kode PPK BPJS","Kontak & Email"],
  },
  {
    label: "Master Data",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
    items: ["Master Poli / Klinik","Master Dokter","Master Petugas","Master Kamar & Bangsal","Master Ruang Operasi","Master Diet","Master Penjamin / Jaminan","Master Tarif Tindakan","Master Harga Kamar","Master Harga Obat"],
  },
  {
    label: "Manajemen Pengguna",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    items: ["Data Admin","Data User & Hak Akses","Log / Audit Pengguna"],
  },
  {
    label: "Konfigurasi Sistem",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    items: ["Nomor Urut & Nota","Pengaturan Kasir","Closing Kasir","Pengaturan Input Parsial","Pengaturan Keterlambatan","Running Text Display"],
  },
  {
    label: "Integrasi & Bridging",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    items: ["SIRS Online 6.3 (Kemenkes)","Password & Konfigurasi BPJS","Satu Sehat (Kemenkes)","PCare BPJS","iCare"],
  },
  {
    label: "Konfigurasi Web (SIMRS CB)",
    icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
    items: ["Path Hybrid Web (HOSTHYBRIDWEB)","Display Antrian Pendaftaran","Display Antrian Farmasi","Display Antrian Poli"],
  },
  {
    label: "Utilitas",
    icon: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01",
    items: ["Backup Database","Optimasi / Vacuum DB","Informasi Sistem"],
  },
];

// ── Halaman utama ─────────────────────────────────────────────────────────────
export default function PengaturanPage() {
  const [selected, setSelected] = useState<string | null>(null);

  function renderForm(item: string) {
    if (item === "SIRS Online 6.3 (Kemenkes)") {
      return <FormSirsBot onBack={() => setSelected(null)} />;
    }
    if (item === "Path Hybrid Web (HOSTHYBRIDWEB)") {
      return <FormHosthybridweb onBack={() => setSelected(null)} />;
    }
    if (item === "Display Antrian Pendaftaran") {
      return <FormDisplayPendaftaran onBack={() => setSelected(null)} />;
    }
    if (item === "Display Antrian Farmasi") {
      return <FormDisplayFarmasi onBack={() => setSelected(null)} />;
    }
    if (item === "Display Antrian Poli") {
      return <FormDisplayPoli onBack={() => setSelected(null)} />;
    }
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setSelected(null)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-sm font-semibold text-slate-700">{item}</h2>
        </div>
        <div className="py-10 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
          Form pengaturan <strong>{item}</strong> dalam pengembangan
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Pengaturan</h1>
        <p className="text-sm text-slate-500 mt-0.5">Konfigurasi sistem, master data & manajemen pengguna</p>
      </div>

      {selected ? renderForm(selected) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {SETTING_GROUPS.map(group => (
            <div key={group.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={group.icon} />
                </svg>
                <h2 className="text-xs font-semibold text-slate-700">{group.label}</h2>
              </div>
              <div className="p-2">
                {group.items.map(item => (
                  <button key={item} onClick={() => setSelected(item)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-green-50 hover:text-green-700 rounded-lg transition-colors">
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
