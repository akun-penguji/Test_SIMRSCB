"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getAplicareLogs, getAplicareConfig, getAplicareStatus,
  triggerAplicareSync, clearAplicareLogs,
  AplicareLog, AplicareConfig,
} from "@/lib/api";
import { getSession } from "@/lib/auth";

const LEVEL_CLASS: Record<string, string> = {
  info:    "text-sky-300",
  success: "text-emerald-400",
  error:   "text-rose-400",
  warning: "text-amber-400",
};

function mask(s: string | null | undefined) {
  if (!s) return "—";
  if (s.length <= 2) return "●●";
  return s.slice(0, 2) + "●".repeat(Math.max(0, s.length - 2));
}

export default function AplicareMonitorPage() {
  const [logs, setLogs]       = useState<AplicareLog[]>([]);
  const [cfg, setCfg]         = useState<AplicareConfig | null>(null);
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef     = useRef<EventSource | null>(null);

  // ── Initial load + SSE subscribe ──────────────────────────────────────────
  const reload = useCallback(() => {
    Promise.all([getAplicareLogs(), getAplicareConfig()])
      .then(([l, c]) => { setLogs(l.data); setCfg(c.data); })
      .catch(() => setErrMsg("Gagal memuat data awal"));
  }, []);

  useEffect(() => {
    reload();

    // SSE via EventSource — JWT diteruskan via querystring (EventSource tidak support
    // custom headers). Backend kita sudah cek token dari header OR cookie; supaya
    // EventSource auth bisa jalan, simpan token sementara di localStorage dan kirim
    // di URL? Simpler: pass token via query, parse di backend? Tapi backend kita
    // pakai header Authorization. Workaround: pakai cookie.
    // Token sudah disimpan di localStorage; saat halaman dimuat, set juga sebagai
    // cookie supaya EventSource (yang ikutkan cookie default) bisa auth.
    const session = getSession();
    if (session?.token) {
      // Simple cookie (path=/, SameSite=Lax) berlaku selama tab terbuka
      document.cookie = `token=${session.token}; path=/; SameSite=Lax`;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
    const url = `${apiBase}/aplicare/stream`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const entry: AplicareLog = JSON.parse(ev.data);
        setLogs(prev => [...prev.slice(-999), entry]);
      } catch {/* ignore parse error */}
    };

    return () => { es.close(); };
  }, [reload]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleSync = async () => {
    setSyncing(true); setErrMsg(""); setOkMsg("");
    try {
      const r = await triggerAplicareSync();
      setOkMsg(r.data.message || "Sync dimulai");
    } catch {
      setErrMsg("Gagal memulai sync");
    } finally {
      setSyncing(false);
      setTimeout(() => setOkMsg(""), 2500);
    }
  };

  const handleClear = async () => {
    if (!confirm("Hapus semua log Aplicare?")) return;
    try {
      await clearAplicareLogs();
      setLogs([]);
      setOkMsg("Log dikosongkan");
      setTimeout(() => setOkMsg(""), 2500);
    } catch {
      setErrMsg("Gagal menghapus log");
    }
  };

  const jadwal = cfg?.jadwal ?? "(menunggu config)";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 -m-6 p-6">
      <nav className="text-xs mb-4">
        <Link href="/bpjs" className="text-sky-400 hover:underline">← BPJS &amp; Bridging</Link>
      </nav>

      <header className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold">SIMRSCB · BPJS Aplicare</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Sync ketersediaan kamar rawat inap ke BPJS Aplicare · Jadwal: <span className="text-slate-200">{jadwal}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full border ${connected ? "border-emerald-500 text-emerald-400" : "border-rose-500 text-rose-400"}`}>
            {connected ? "● Live" : "○ Offline"}
          </span>
          <button onClick={handleClear}
            className="text-xs px-3 py-1.5 rounded border border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200 transition">
            Bersihkan Log
          </button>
          <button onClick={handleSync} disabled={syncing}
            className="text-sm px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition">
            {syncing ? "Memproses..." : "Sync Manual"}
          </button>
        </div>
      </header>

      {cfg && (
        <div className="bg-slate-900 border border-slate-800 rounded px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500 mb-3">
          <span>URL: <span className="text-slate-300 break-all">{cfg.aplicare_url || "(belum di-set)"}</span></span>
          <span>ConsID: <span className="text-slate-300">{mask(cfg.cons_id)}</span></span>
          <span>PPK: <span className="text-slate-300">{mask(cfg.kode_ppk)}</span></span>
          <span>Total log: <span className="text-slate-300">{logs.length}</span></span>
        </div>
      )}

      {errMsg && <div className="mb-3 bg-rose-900/40 border border-rose-700 text-rose-200 text-sm rounded p-3">{errMsg}</div>}
      {okMsg && <div className="mb-3 bg-emerald-900/40 border border-emerald-700 text-emerald-200 text-sm rounded p-3">{okMsg}</div>}

      <main className="flex-1">
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 font-mono text-sm min-h-[400px] max-h-[calc(100vh-260px)] overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-slate-600">
              Belum ada log. Sync otomatis berjalan setiap interval ({jadwal}) atau tekan <strong>Sync Manual</strong>.
            </p>
          ) : (
            <>
              {logs.map((l, i) => (
                <div key={l.id ?? i} className="flex gap-3 leading-6">
                  <span className="text-slate-600 shrink-0 w-44">{l.waktu}</span>
                  <span className={`shrink-0 w-16 ${LEVEL_CLASS[l.level] ?? "text-slate-400"}`}>[{l.level}]</span>
                  <span className="text-slate-200 break-all">{l.message}</span>
                </div>
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
