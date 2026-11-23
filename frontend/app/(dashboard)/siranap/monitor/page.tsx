"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getSiranapLogs, getSiranapConfig,
  triggerSiranapSync, clearSiranapLogs,
  SiranapLog, SiranapConfig,
} from "@/lib/api";
import { getSession } from "@/lib/auth";

const LEVEL_CLASS: Record<string, string> = {
  info:    "text-sky-300",
  success: "text-emerald-400",
  error:   "text-rose-400",
  warning: "text-amber-400",
};

export default function SiranapMonitorPage() {
  const [logs, setLogs]       = useState<SiranapLog[]>([]);
  const [cfg, setCfg]         = useState<SiranapConfig | null>(null);
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef     = useRef<EventSource | null>(null);

  const reload = useCallback(() => {
    Promise.all([getSiranapLogs(), getSiranapConfig()])
      .then(([l, c]) => { setLogs(l.data); setCfg(c.data); })
      .catch(() => setErrMsg("Gagal memuat data awal"));
  }, []);

  useEffect(() => {
    reload();
    const session = getSession();
    if (session?.token) {
      document.cookie = `token=${session.token}; path=/; SameSite=Lax`;
    }
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
    const es = new EventSource(`${apiBase}/siranap/stream`, { withCredentials: true });
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const entry: SiranapLog = JSON.parse(ev.data);
        setLogs(prev => [...prev.slice(-999), entry]);
      } catch {/* ignore */}
    };
    return () => { es.close(); };
  }, [reload]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleSync = async () => {
    setSyncing(true); setErrMsg(""); setOkMsg("");
    try {
      const r = await triggerSiranapSync();
      setOkMsg(r.data.message || "Sync dimulai");
    } catch {
      setErrMsg("Gagal memulai sync");
    } finally {
      setSyncing(false);
      setTimeout(() => setOkMsg(""), 2500);
    }
  };

  const handleClear = async () => {
    if (!confirm("Hapus semua log SIRANAP?")) return;
    try {
      await clearSiranapLogs();
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
          <h1 className="text-xl font-bold">SIMRSCB · SIRANAP (Ketersediaan TT)</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Kirim ketersediaan tempat tidur ke RS Online v3 Kemenkes · Jadwal: <span className="text-slate-200">{jadwal}</span>
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
          <span>URL: <span className="text-slate-300 break-all">{cfg.siranap_url || "(belum di-set)"}</span></span>
          <span>RS ID: <span className="text-slate-300">{cfg.rs_id || "-"}</span></span>
          <span>Interval: <span className="text-slate-300">{cfg.interval_min} menit</span></span>
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
