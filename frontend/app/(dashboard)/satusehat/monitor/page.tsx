"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getSatuSehatLogs, getSatuSehatConfig,
  triggerSatuSehatSync, clearSatuSehatLogs,
  SatuSehatLog, SatuSehatConfig,
} from "@/lib/api";
import { getSession } from "@/lib/auth";

const LEVEL_CLASS: Record<string, string> = {
  info:    "text-sky-300",
  success: "text-emerald-400",
  error:   "text-rose-400",
  warning: "text-amber-400",
};

const RESOURCES: [string, string][] = [
  ["encounter", "Encounter"], ["condition", "Diagnosis"], ["procedure", "Prosedur"],
  ["ttv", "TTV"], ["medication", "Obat (master)"], ["obat", "Resep Obat"], ["obat_racikan", "Resep Racikan"],
  ["dispense", "Penyerahan Obat"], ["lab", "Lab PK"], ["radiologi", "Radiologi"],
  ["alergi", "Alergi"], ["clinical_impression", "Asesmen"], ["careplan", "Rencana"],
];

export default function SatuSehatMonitorPage() {
  const [logs, setLogs]       = useState<SatuSehatLog[]>([]);
  const [cfg, setCfg]         = useState<SatuSehatConfig | null>(null);
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const [sel, setSel]         = useState<Set<string>>(new Set());
  const [tglAwal, setTglAwal] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); });
  const [tglAkhir, setTglAkhir] = useState(() => new Date().toISOString().slice(0, 10));
  const [onlyErr, setOnlyErr] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef     = useRef<EventSource | null>(null);

  const reload = useCallback(() => {
    Promise.all([getSatuSehatLogs(), getSatuSehatConfig()])
      .then(([l, c]) => { setLogs(l.data); setCfg(c.data); })
      .catch(() => setErrMsg("Gagal memuat data awal"));
  }, []);

  useEffect(() => {
    reload();
    const session = getSession();
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
    // EventSource tak bisa kirim header Authorization → token via query param.
    const es = new EventSource(`${apiBase}/satusehat/stream?token=${encodeURIComponent(session?.token || "")}`);
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const entry: SatuSehatLog = JSON.parse(ev.data);
        setLogs(prev => [...prev.slice(-999), entry]);
      } catch {/* ignore */}
    };
    return () => { es.close(); };
  }, [reload]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const toggle = (k: string) => setSel(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const handleSync = async () => {
    setSyncing(true); setErrMsg(""); setOkMsg("");
    try {
      const r = await triggerSatuSehatSync({
        resources: Array.from(sel),
        tgl_awal: tglAwal || undefined,
        tgl_akhir: tglAkhir || undefined,
      });
      setOkMsg(r.data.message || "Sync dimulai");
    } catch { setErrMsg("Gagal memulai sync"); }
    finally { setSyncing(false); setTimeout(() => setOkMsg(""), 3500); }
  };

  const handleClear = async () => {
    if (!confirm("Hapus semua log SatuSehat?")) return;
    try { await clearSatuSehatLogs(); setLogs([]); setOkMsg("Log dikosongkan"); setTimeout(() => setOkMsg(""), 2500); }
    catch { setErrMsg("Gagal menghapus log"); }
  };

  const jadwal = cfg?.jadwal ?? "(menunggu config)";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 -m-6 p-6">
      <nav className="text-xs mb-4">
        <Link href="/bpjs" className="text-sky-400 hover:underline">← BPJS &amp; Bridging</Link>
      </nav>

      <header className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold">SIMRSCB · SatuSehat (RME)</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Autorun otomatis: Encounter lalu semua resource RME (1 tahun ke belakang) · Jadwal: <span className="text-slate-200">{jadwal}</span>
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
          <span>FHIR: <span className="text-slate-300 break-all">{cfg.fhir_url}</span></span>
          <span>Org ID: <span className="text-slate-300">{cfg.org_id || "-"}</span></span>
          <span>Interval: <span className="text-slate-300">{cfg.interval_min} menit</span></span>
          <span>Window: <span className="text-slate-300">{cfg.window_days} hari</span></span>
          <span>Total log: <span className="text-slate-300">{logs.length}</span></span>
          <span>Gagal: <span className="text-rose-400">{logs.filter(l => l.level === "error").length}</span></span>
          <button onClick={() => setOnlyErr(v => !v)}
            className={`text-[11px] px-2 py-0.5 rounded border ${onlyErr ? "border-rose-500 text-rose-300" : "border-slate-700 text-slate-400 hover:text-slate-200"}`}>
            {onlyErr ? "● Hanya error/peringatan" : "Filter: hanya error/peringatan"}
          </button>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded px-4 py-3 mb-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-slate-400">Pilih resource (kosong = semua):</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSel(new Set())} className="text-[11px] px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-slate-200">Semua</button>
            <button onClick={() => setSel(new Set(RESOURCES.map(r => r[0])))} className="text-[11px] px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-slate-200">Pilih semua</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RESOURCES.map(([k, l]) => (
            <button key={k} onClick={() => toggle(k)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition ${sel.has(k) ? "border-blue-500 bg-blue-600/30 text-blue-200" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-xs text-slate-400">Rentang tanggal (opsional):</span>
          <input type="date" value={tglAwal} onChange={e => setTglAwal(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
          <span className="text-xs text-slate-500">s/d</span>
          <input type="date" value={tglAkhir} onChange={e => setTglAkhir(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
          <span className="text-[11px] text-slate-500">{(tglAwal || tglAkhir) ? "(pakai rentang ini)" : `(default: ${cfg?.window_days ?? 7} hari terakhir)`}</span>
        </div>
      </div>

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
              {(onlyErr ? logs.filter(l => l.level === "error" || l.level === "warning") : logs).map((l, i) => (
                <div key={l.id ?? i} className="flex gap-3 leading-6">
                  <span className="text-slate-600 shrink-0 w-44">{l.waktu}</span>
                  <span className={`shrink-0 w-16 ${LEVEL_CLASS[l.level] ?? "text-slate-400"}`}>[{l.level}]</span>
                  <span className="text-slate-200 break-all">{l.message}</span>
                </div>
              ))}
              {onlyErr && logs.filter(l => l.level === "error" || l.level === "warning").length === 0 &&
                <p className="text-slate-600">Tidak ada error/peringatan. 🎉</p>}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
