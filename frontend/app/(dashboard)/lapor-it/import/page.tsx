"use client";

// Impor riwayat Lapor IT dari ekspor chat grup WhatsApp (.txt).

import { useEffect, useState } from "react";
import Link from "next/link";
import { hasPerm } from "@/lib/auth";
import { importWaLaporIt, WaParsed, getWaConfig, setWaConfig, WaConfig } from "@/lib/api";

export default function ImportWaPage() {
  const isIt = hasPerm("lapor_it_kelola");
  const [text, setText] = useState("");
  const [unit, setUnit] = useState("");
  const [status, setStatus] = useState("selesai");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [preview, setPreview] = useState<{ terdeteksi: number; contoh?: WaParsed[] } | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    file.text().then(setText);
  }
  async function jalankan(apply: boolean) {
    if (!text.trim()) { setMsg({ ok: false, t: "Tempel teks ekspor WA atau pilih file .txt dulu." }); return; }
    setBusy(true); setMsg(null); if (!apply) setPreview(null);
    try {
      const r = await importWaLaporIt(text, apply, status, unit);
      if (apply) {
        setMsg({ ok: true, t: `Impor selesai — ${r.data.baru} laporan baru, ${r.data.dilewati_duplikat} dilewati (duplikat). Total terdeteksi ${r.data.terdeteksi}.` });
        setPreview(null);
      } else {
        setPreview({ terdeteksi: r.data.terdeteksi, contoh: r.data.contoh });
        setMsg({ ok: true, t: `${r.data.terdeteksi} pesan terdeteksi. Periksa contoh di bawah, lalu klik “Impor & Simpan”.` });
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ ok: false, t: err.response?.data?.error || "Gagal memproses." });
    } finally { setBusy(false); }
  }

  if (!isIt) return <div className="text-slate-500">Hanya tim IT (izin <code>lapor_it_kelola</code>) yang bisa mengimpor.</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">📥 Impor dari Chat WhatsApp</h1>
        <Link href="/lapor-it" className="text-sm text-blue-600 hover:underline">← Kembali</Link>
      </div>

      <RealtimeSection />

      <div className="border-t border-slate-200 pt-4">
        <h2 className="text-lg font-semibold text-slate-700">Impor Riwayat (Export Chat manual)</h2>
        <p className="text-sm text-slate-500">Untuk memasukkan chat lama yang sudah ada di grup (backlog) sekali jalan.</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-slate-600 space-y-1">
        <div className="font-semibold text-slate-700">Cara ambil file dari WhatsApp:</div>
        <ol className="list-decimal pl-5 space-y-0.5">
          <li>Buka grup WA laporan IT → menu (⋮) → <b>More / Lainnya</b> → <b>Export chat</b>.</li>
          <li>Pilih <b>Without media / Tanpa media</b> (lebih cepat & cukup untuk teks).</li>
          <li>Simpan/kirim file <code>.txt</code>-nya, lalu pilih di bawah <b>atau</b> tempel isinya.</li>
        </ol>
      </div>

      {msg && <div className={`text-sm rounded-lg px-4 py-2 ${msg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg.t}</div>}

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-slate-600">File ekspor (.txt)</span>
            <input type="file" accept=".txt,text/plain" onChange={onFile} className="mt-1 block w-full text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-sm text-slate-600">Status data lama</span>
              <select value={status} onChange={e => setStatus(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm">
                <option value="selesai">selesai (arsip)</option>
                <option value="baru">baru</option>
                <option value="diproses">diproses</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-slate-600">Unit (opsional)</span>
              <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="kosongkan bila campuran"
                className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" />
            </label>
          </div>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={8}
          placeholder="…atau tempel isi ekspor chat di sini"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono" />
        <div className="flex gap-2">
          <button onClick={() => jalankan(false)} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">
            {busy ? "Memproses…" : "Pratinjau"}
          </button>
          <button onClick={() => jalankan(true)} disabled={busy || !preview} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Menyimpan…" : "Impor & Simpan"}
          </button>
        </div>
        <p className="text-xs text-slate-400">Setiap pesan chat = 1 laporan. Notifikasi sistem WA dilewati; kategori dideteksi otomatis dari kata kunci; duplikat (tanggal+pelapor+judul sama) tidak diimpor ulang.</p>
      </div>

      {preview?.contoh && preview.contoh.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-50">Contoh 15 pesan pertama (dari {preview.terdeteksi})</div>
          <table className="w-full text-xs">
            <thead className="text-slate-500 text-left"><tr><th className="px-3 py-1.5">Tanggal</th><th className="px-3 py-1.5">Pelapor</th><th className="px-3 py-1.5">Kategori</th><th className="px-3 py-1.5">Isi</th></tr></thead>
            <tbody>
              {preview.contoh.map((m, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 whitespace-nowrap text-slate-500">{m.tanggal?.slice(0, 16)}</td>
                  <td className="px-3 py-1.5">{m.pelapor}</td>
                  <td className="px-3 py-1.5">{m.kategori}{m.ada_media && " 📎"}</td>
                  <td className="px-3 py-1.5 max-w-[360px] truncate">{m.deskripsi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RealtimeSection() {
  const [cfg, setCfg] = useState<WaConfig | null>(null);
  const [group, setGroup] = useState("");
  const [secret, setSecret] = useState("");
  const [statusDef, setStatusDef] = useState("baru");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => getWaConfig().then(r => { setCfg(r.data); setGroup(r.data.group); setStatusDef(r.data.status_default || "baru"); }).catch(() => setCfg(null));
  useEffect(() => { load(); }, []);

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = cfg ? `${base}${cfg.webhook_path}` : "";

  async function simpan() {
    setBusy(true); setMsg(null);
    try { await setWaConfig({ group, status_default: statusDef, ...(secret ? { secret } : {}) }); setSecret(""); setMsg({ ok: true, t: "Konfigurasi disimpan." }); load(); }
    catch (e) { const err = e as { response?: { data?: { error?: string } } }; setMsg({ ok: false, t: err.response?.data?.error || "Gagal (hanya admin)." }); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <h2 className="text-lg font-semibold text-slate-700">⚡ Sinkron Otomatis Realtime (opsional)</h2>
      <p className="text-sm text-slate-500">
        Pakai <a className="text-blue-600 underline" href="https://github.com/aldinokemal/go-whatsapp-web-multidevice" target="_blank" rel="noreferrer">go-whatsapp-web-multidevice</a> (WhatsApp Web multidevice).
        Sekali di-link ke nomor WA yang ada di grup, setiap pesan baru langsung jadi tiket — tanpa export manual.
      </p>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600 space-y-1">
        <div className="font-semibold text-slate-700">Langkah pasang (dilakukan tim IT di server):</div>
        <ol className="list-decimal pl-5 space-y-0.5">
          <li>Jalankan servisnya (Docker): <code className="text-xs">docker run -d -p 3000:3000 --name wa aldinokemal2104/go-whatsapp-web-multidevice rest --webhook=&quot;URL di bawah&quot; --webhook-secret=&quot;secret di bawah&quot;</code></li>
          <li>Buka <code>http://server:3000</code> → scan QR pakai nomor WA yang jadi anggota grup laporan IT.</li>
          <li>Ambil <b>JID grup</b> via <code>GET /chats</code> (format diakhiri <code>@g.us</code>), isikan di bawah.</li>
        </ol>
      </div>

      {msg && <div className={`text-sm rounded-lg px-3 py-2 ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.t}</div>}

      <label className="block">
        <span className="text-sm text-slate-600">URL Webhook (masukkan ke <code>--webhook</code> go-whatsapp)</span>
        <input readOnly value={webhookUrl} onFocus={e => e.currentTarget.select()}
          className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono bg-slate-50" />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-sm text-slate-600">JID Grup dipantau (pisah koma bila &gt;1)</span>
          <input value={group} onChange={e => setGroup(e.target.value)} placeholder="1203630xxxx@g.us"
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Status tiket masuk</span>
          <select value={statusDef} onChange={e => setStatusDef(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm">
            <option value="baru">baru</option><option value="diproses">diproses</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-sm text-slate-600">Secret webhook {cfg?.has_secret && "(tersimpan — kosongkan bila tidak diganti)"}</span>
        <input value={secret} onChange={e => setSecret(e.target.value)} type="password"
          placeholder={cfg?.has_secret ? "••••••••" : "buat secret acak, samakan dgn --webhook-secret"}
          className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
      </label>
      <div className="flex items-center gap-3">
        <button onClick={simpan} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
          {busy ? "Menyimpan…" : "Simpan Konfigurasi"}
        </button>
        {cfg && <span className="text-xs text-slate-500">{cfg.has_secret ? "✅ secret aktif — webhook siap menerima" : "⚠️ secret belum diatur — webhook menolak semua"}</span>}
      </div>
    </div>
  );
}
