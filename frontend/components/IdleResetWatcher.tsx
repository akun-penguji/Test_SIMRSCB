"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface IdleResetWatcherProps {
  /** Total idle threshold sebelum auto-reset (default 60 detik). */
  idleMs?:    number;
  /** Berapa detik sebelum reset, modal warning muncul (default 10 detik). */
  warningMs?: number;
  /** Callback saat auto-reset (mis. setAktif(null) → balik ke menu utama). */
  onReset:    () => void;
  /** Aktif/tidak — kalau false, watcher tidak memantau (mis. di menu utama). */
  enabled?:   boolean;
  /**
   * Optional override label. Default: "Tidak ada aktivitas terdeteksi.
   * Kiosk akan kembali ke menu dalam N detik."
   */
  warningTitle?:    string;
  warningSubtitle?: string;
}

/**
 * Auto-reset watcher untuk kiosk publik /anjungan.
 *
 * - Menghitung idle time berdasar event: mousedown, touchstart, keydown, scroll
 * - Saat idle ≥ (idleMs - warningMs), tampilkan modal countdown
 * - Saat idle ≥ idleMs, panggil onReset() → reset ke menu utama
 * - User bisa tap modal untuk batalkan dan extend timer
 */
export default function IdleResetWatcher({
  idleMs    = 60_000,   // default 60 detik (hospital kiosk best practice)
  warningMs = 10_000,   // warning muncul 10 detik sebelum reset
  onReset,
  enabled   = true,
  warningTitle    = "Tidak ada aktivitas terdeteksi",
  warningSubtitle = "Kiosk akan kembali ke menu dalam",
}: IdleResetWatcherProps) {
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(warningMs / 1000));
  const idleTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAll = useCallback(() => {
    if (idleTimerRef.current)    { clearTimeout(idleTimerRef.current);    idleTimerRef.current    = null; }
    if (warningTimerRef.current) { clearTimeout(warningTimerRef.current); warningTimerRef.current = null; }
    if (countdownRef.current)    { clearInterval(countdownRef.current);   countdownRef.current    = null; }
  }, []);

  const startTimers = useCallback(() => {
    clearAll();
    setWarningOpen(false);
    setSecondsLeft(Math.ceil(warningMs / 1000));

    // Warning muncul (idleMs - warningMs) detik dari sekarang
    warningTimerRef.current = setTimeout(() => {
      setWarningOpen(true);
      setSecondsLeft(Math.ceil(warningMs / 1000));
      // Countdown per detik
      countdownRef.current = setInterval(() => {
        setSecondsLeft(s => Math.max(0, s - 1));
      }, 1000);
    }, Math.max(0, idleMs - warningMs));

    // Reset di idleMs detik
    idleTimerRef.current = setTimeout(() => {
      clearAll();
      setWarningOpen(false);
      onReset();
    }, idleMs);
  }, [idleMs, warningMs, onReset, clearAll]);

  const handleActivity = useCallback(() => {
    if (!enabled) return;
    // Kalau modal warning lagi tampil, sentuhan apapun → cancel + restart timer
    // Kalau belum, juga restart timer (debounce activity)
    startTimers();
  }, [enabled, startTimers]);

  useEffect(() => {
    if (!enabled) {
      clearAll();
      setWarningOpen(false);
      return;
    }
    startTimers();

    const events: (keyof WindowEventMap)[] = [
      "mousedown", "touchstart", "keydown", "scroll", "wheel", "mousemove",
    ];
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    return () => {
      clearAll();
      events.forEach(e => window.removeEventListener(e, handleActivity));
    };
  }, [enabled, startTimers, handleActivity, clearAll]);

  if (!warningOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm
        flex items-center justify-center p-6 print:hidden"
      onClick={handleActivity}
      onTouchStart={handleActivity}
      role="alertdialog"
      aria-modal="true"
    >
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl
        shadow-2xl p-8 max-w-md w-full text-white text-center
        animate-pulse pointer-events-none select-none">
        <div className="text-6xl mb-3">⏱️</div>
        <h2 className="text-2xl font-bold mb-2">{warningTitle}</h2>
        <p className="text-white/90 mb-4">{warningSubtitle}</p>
        <div className="text-7xl font-black tabular-nums mb-4">
          {secondsLeft}
        </div>
        <p className="text-white/95 font-semibold text-lg">
          👆 Sentuh layar untuk lanjut
        </p>
      </div>
    </div>
  );
}
