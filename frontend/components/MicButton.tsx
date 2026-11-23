"use client";

// Tombol dikte suara (Web Speech API, Bahasa Indonesia) untuk textbox / textarea.
// Menyisipkan hasil pengenalan suara ke field. Pakai valueRef agar segmen kalimat
// berikutnya menempel ke teks TERBARU (bukan nilai saat mulai merekam).
//
// Pemakaian:
//   <div className="relative">
//     <textarea value={x} onChange={e => setX(e.target.value)} className="... pr-8" />
//     <MicButton value={x} onChange={setX} className="absolute right-1.5 bottom-1.5" />
//   </div>

import { useEffect, useRef, useState } from "react";

export function appendDikte(cur: string, seg: string): string {
  const s = seg.trim();
  if (!s) return cur;
  if (!cur) return s;
  return /\s$/.test(cur) ? cur + s : cur + " " + s;
}

export default function MicButton({ value, onChange, className = "", title }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  title?: string;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) setSupported(false);
    return () => { try { recRef.current?.stop(); } catch { /* noop */ } };
  }, []);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { try { recRef.current?.stop(); } catch { /* noop */ } return; }
    const rec = new SR();
    rec.lang = "id-ID";
    rec.continuous = true;
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (ev: any) => {
      let seg = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) seg += ev.results[i][0].transcript;
      }
      seg = seg.trim();
      if (!seg) return;
      const next = appendDikte(valueRef.current || "", seg);
      valueRef.current = next;
      onChange(next);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }

  if (!supported) return null;
  return (
    <button type="button" onClick={toggle} tabIndex={-1}
      title={title ?? (listening ? "Berhenti merekam suara" : "Dikte suara (Bahasa Indonesia)")}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors shrink-0
        ${listening ? "bg-red-500 text-white animate-pulse" : "text-slate-400 hover:text-green-600 hover:bg-green-50"} ${className}`}>
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 1.75a2.75 2.75 0 00-2.75 2.75v6a2.75 2.75 0 105.5 0v-6A2.75 2.75 0 0012 1.75z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 10.5a6.5 6.5 0 0013 0M12 17v4.25M8.75 21.25h6.5" />
      </svg>
    </button>
  );
}
