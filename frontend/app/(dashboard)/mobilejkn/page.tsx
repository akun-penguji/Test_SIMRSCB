"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getMobileJknLog, sendMobileJknEvent,
  MobileJknEvent, MobileJknLogRow, MOBILEJKN_STREAM_URL,
} from "@/lib/api";
import { getSession } from "@/lib/auth";

const TASK_LABEL: Record<string, string> = {
  "1":  "Admisi mulai (loket)",
  "2":  "Admisi dilayani (loket)",
  "3":  "Mulai tunggu poli",
  "4":  "Mulai dilayani poli",
  "5":  "Selesai dilayani",
  "6":  "Minta resep",
  "7":  "Validasi resep",
  "99": "Batal",
};

const STATUS_CLASS: Record<string, string> = {
  sukses: "text-emerald-400",
  gagal:  "text-rose-400",
  skip:   "text-amber-400",
};

function taskName(id: string) {
  return TASK_LABEL[id] ? `${id} · ${TASK_LABEL[id]}` : id;
}

export default function MobileJknPage() {
  const [events, setEvents]   = useState<MobileJknEvent[]>([]);
  const [log, setLog]         = useState<MobileJknLogRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [errMsg, setErrMsg]   = useState("");
  const [okMsg, setOkMsg]     = useState("");
  const esRef = useRef<EventSource | null>(null);

  // form tes manual
  const [fNoRawat, setFNoRawat] = useState("");
  const [fTaskid, setFTaskid]   = useState("3");
  const [fWaktu, setFWaktu]     = useState("");
  const [fBooking, setFBooking] = useState("");
  const [sending, setSending]   = useState(false);

  const reloadLog = useCallback(() => {
    getMobileJknLog()
      .then(r => setLog(r.data.data))
      .catch(() => setErrMsg("Gagal memuat riwayat log"));
  }, []);

  useEffect(() => {
    reloadLog();

    const session = getSession();
    if (session?.token) {
      document.cookie = `token=${session.token}; path=/; SameSite=Lax`;
    }
    const es = new EventSource(MOBILEJKN_STREAM_URL, { withCredentials: true });
    esRef.current = es;
    es.onopen  = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const evt: MobileJknEvent = JSON.parse(ev.data);
        setEvents(prev => [evt, ...prev].slice(0, 200));
      } catch {/* ignore */}
    };
    return () => { es.close(); };
  }, [reloadLog]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fNoRawat.trim()) { setErrMsg("no_rawat wajib diisi"); return; }
    setSending(true); setErrMsg(""); setOkMsg("");
    try {
      const r = await sendMobileJknEvent({
        no_rawat: fNoRawat.trim(),
        taskid:   fTaskid,
        waktu:    fWaktu.trim() || undefined,
        kodebooking: fBooking.trim() || undefined,
        source:   "web-tes",
      });
      setOkMsg(`Terkirim: ${r.data.status} · code ${r.data.code} · ${r.data.message}`);
      reloadLog();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErrMsg(msg || "Gagal mengirim event");
    } finally {
      setSending(false);
      setTimeout(() => setOkMsg(""), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 -m-6 p-6">
      <nav className="text-xs mb-4">
        <Link href="/bpjs" className="text-sky-400 hover:underline">← BPJS &amp; Bridging</Link>
      </nav>

      <header className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold">SIMRSCB · Antrean Mobile JKN</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Pengiriman task-id real-time ke BPJS (updatewaktu) · dipicu event dari Khanza/web
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border ${connected ? "border-emerald-500 text-emerald-400" : "border-rose-500 text-rose-400"}`}>
          {connected ? "● Live" : "○ Offline"}
        </span>
      </header>

      {errMsg && <div className="mb-3 bg-rose-900/40 border border-rose-700 text-rose-200 text-sm rounded p-3">{errMsg}</div>}
      {okMsg && <div className="mb-3 bg-emerald-900/40 border border-emerald-700 text-emerald-200 text-sm rounded p-3">{okMsg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live feed */}
        <section className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Live feed</h2>
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 font-mono text-xs min-h-[300px] max-h-[calc(100vh-320px)] overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-slate-600">Menunggu event… kirim task-id dari Khanza atau pakai form tes di samping.</p>
            ) : events.map((e, i) => (
              <div key={i} className="flex gap-3 leading-6 border-b border-slate-800/60 py-0.5">
                <span className="text-slate-600 shrink-0 w-32">{e.jam?.slice(11) || e.jam}</span>
                <span className={`shrink-0 w-14 ${STATUS_CLASS[e.status] ?? "text-slate-400"}`}>{e.status}</span>
                <span className="text-sky-300 shrink-0 w-40">{taskName(e.taskid)}</span>
                <span className="text-slate-300 break-all">
                  {e.kodebooking} · {e.no_rawat}{e.nama ? ` · ${e.nama}` : ""}
                  <span className="text-slate-500"> — [{e.code}] {e.message}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Form tes manual */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Tes kirim manual</h2>
          <form onSubmit={handleSend} className="bg-slate-900 rounded-lg border border-slate-800 p-4 space-y-3 text-sm">
            <div>
              <label className="block text-xs text-slate-400 mb-1">No. Rawat</label>
              <input value={fNoRawat} onChange={e => setFNoRawat(e.target.value)}
                placeholder="2026/07/05/000001"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-100 focus:border-sky-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Task</label>
              <select value={fTaskid} onChange={e => setFTaskid(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-100 focus:border-sky-500 outline-none">
                {Object.keys(TASK_LABEL).map(id => (
                  <option key={id} value={id}>{taskName(id)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Waktu <span className="text-slate-600">(kosong = sekarang)</span></label>
              <input value={fWaktu} onChange={e => setFWaktu(e.target.value)}
                placeholder="2026-07-05 09:30:00"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-100 focus:border-sky-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Kodebooking <span className="text-slate-600">(kosong = auto)</span></label>
              <input value={fBooking} onChange={e => setFBooking(e.target.value)}
                placeholder="auto dari referensi_mobilejkn_bpjs / no_rawat"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-100 focus:border-sky-500 outline-none" />
            </div>
            <button type="submit" disabled={sending}
              className="w-full text-sm px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium transition">
              {sending ? "Mengirim…" : "Kirim task-id ke BPJS"}
            </button>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Kirim event ke <code className="text-slate-400">/api/mobilejkn/event</code>. Kodebooking auto:
              Mobile JKN → <code className="text-slate-400">nobooking</code>; onsite → <code className="text-slate-400">no_rawat</code>.
            </p>
          </form>
        </section>
      </div>

      {/* Riwayat log */}
      <section className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-300">Riwayat pengiriman (log_add_antrian)</h2>
          <button onClick={reloadLog} className="text-xs px-3 py-1 rounded border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-400 transition">
            Muat ulang
          </button>
        </div>
        <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-400 border-b border-slate-800">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Waktu</th>
                <th className="text-left px-3 py-2 font-medium">Task</th>
                <th className="text-left px-3 py-2 font-medium">Kodebooking</th>
                <th className="text-left px-3 py-2 font-medium">No. Rawat</th>
                <th className="text-left px-3 py-2 font-medium">Nama</th>
                <th className="text-left px-3 py-2 font-medium">Poli</th>
                <th className="text-left px-3 py-2 font-medium">Code</th>
                <th className="text-left px-3 py-2 font-medium">Petugas</th>
              </tr>
            </thead>
            <tbody>
              {log.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-600">Belum ada riwayat.</td></tr>
              ) : log.map((r, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-3 py-1.5 text-slate-500">{r.waktu}</td>
                  <td className="px-3 py-1.5 text-sky-300">{taskName(r.taskid || "")}</td>
                  <td className="px-3 py-1.5 text-slate-300">{r.kd_booking}</td>
                  <td className="px-3 py-1.5 text-slate-400">{r.no_rawat}</td>
                  <td className="px-3 py-1.5 text-slate-300">{r.nama}</td>
                  <td className="px-3 py-1.5 text-slate-400">{r.poli}</td>
                  <td className={`px-3 py-1.5 ${r.kode_respon === "200" ? "text-emerald-400" : "text-rose-400"}`}>{r.kode_respon}</td>
                  <td className="px-3 py-1.5 text-slate-500">{r.petugas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
