"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
export type KbMode = "numeric" | "alphanumeric";

interface ActiveInput {
  id:        string;
  mode:      KbMode;
  value:     string;
  maxLength: number;
  setValue:  (v: string) => void;
  onEnter?:  () => void;
  /** Sanitizer optional. Default numeric → digit only. */
  sanitize?: (raw: string) => string;
}

interface KbCtx {
  active:    ActiveInput | null;
  setActive: (i: ActiveInput | null) => void;
}

const KeyboardCtx = createContext<KbCtx | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────
export function OnScreenKeyboardProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveInput | null>(null);
  return (
    <KeyboardCtx.Provider value={{ active, setActive }}>
      {children}
      <OnScreenKeyboardPanel />
    </KeyboardCtx.Provider>
  );
}

// ── Hook untuk register input ──────────────────────────────────────────────
export function useKbInput(opts: {
  mode: KbMode;
  value: string;
  setValue: (v: string) => void;
  maxLength?: number;
  onEnter?: () => void;
  sanitize?: (raw: string) => string;
}) {
  const id  = useId();
  const ctx = useContext(KeyboardCtx);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const handleFocus = useCallback(() => {
    if (!ctx) return;
    ctx.setActive({
      id, mode: optsRef.current.mode,
      value: optsRef.current.value,
      maxLength: optsRef.current.maxLength ?? 100,
      setValue: optsRef.current.setValue,
      onEnter:  optsRef.current.onEnter,
      sanitize: optsRef.current.sanitize,
    });
  }, [ctx, id]);

  // Saat value berubah dari external (mis. clear), sync ke active state
  useEffect(() => {
    if (!ctx?.active || ctx.active.id !== id) return;
    if (ctx.active.value !== opts.value) {
      ctx.setActive({ ...ctx.active, value: opts.value });
    }
  }, [ctx, id, opts.value]);

  return { onFocus: handleFocus };
}

// ── Default sanitizer ──────────────────────────────────────────────────────
const sanitizeNumeric  = (s: string) => s.replace(/\D/g, "");
const sanitizePassThru = (s: string) => s;

// ── Panel (UI) ─────────────────────────────────────────────────────────────
function OnScreenKeyboardPanel() {
  const ctx = useContext(KeyboardCtx);
  const [shift, setShift] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (!ctx?.active || hidden) {
    return ctx?.active ? (
      <button onClick={() => setHidden(false)}
        className="fixed bottom-4 right-4 z-50 bg-slate-800/90 hover:bg-slate-700 text-white
          rounded-full w-14 h-14 flex items-center justify-center shadow-2xl border border-white/20"
        aria-label="Tampilkan keyboard">
        ⌨️
      </button>
    ) : null;
  }

  const { active } = ctx;
  const sanitize = active.sanitize ??
    (active.mode === "numeric" ? sanitizeNumeric : sanitizePassThru);

  const setVal = (raw: string) => {
    const clean = sanitize(raw).slice(0, active.maxLength);
    active.setValue(clean);
    ctx.setActive({ ...active, value: clean });
  };

  const append = (ch: string) => setVal(active.value + ch);
  const backspace = () => setVal(active.value.slice(0, -1));
  const clear     = () => setVal("");
  const submit    = () => {
    if (active.onEnter) {
      active.onEnter();
    }
    ctx.setActive(null); // close after enter
  };
  const close = () => ctx.setActive(null);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-white/20 shadow-2xl print:hidden">
      <div className="max-w-4xl mx-auto px-3 py-3">
        {/* Top bar: preview value + actions */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 px-3 py-2 bg-white rounded-lg text-slate-800 text-base font-mono tracking-wider truncate min-h-[36px]">
            {active.value || <span className="text-slate-400">(ketik di sini...)</span>}
          </div>
          <button onClick={clear}
            className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold whitespace-nowrap"
            title="Hapus semua">
            Clear
          </button>
          <button onClick={() => setHidden(true)}
            className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold whitespace-nowrap"
            title="Sembunyikan keyboard">
            ▼
          </button>
          <button onClick={close}
            className="px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-semibold whitespace-nowrap"
            title="Tutup">
            ✕
          </button>
        </div>

        {/* Layout */}
        {active.mode === "numeric" ? (
          <NumericLayout append={append} backspace={backspace} submit={submit} />
        ) : (
          <AlphaLayout shift={shift} setShift={setShift} append={append} backspace={backspace} submit={submit} />
        )}
      </div>
    </div>
  );
}

// ── Numeric (3×4 grid) ─────────────────────────────────────────────────────
function NumericLayout({ append, backspace, submit }:
  { append: (ch: string) => void; backspace: () => void; submit: () => void }) {

  const numBtn = (ch: string) => (
    <button key={ch} onClick={() => append(ch)}
      className="aspect-[3/2] rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/40
        text-white text-3xl font-bold transition select-none touch-manipulation
        shadow-lg border border-white/10">
      {ch}
    </button>
  );

  return (
    <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
      {["1","2","3"].map(numBtn)}
      {["4","5","6"].map(numBtn)}
      {["7","8","9"].map(numBtn)}
      <button onClick={backspace}
        className="aspect-[3/2] rounded-xl bg-amber-700/60 hover:bg-amber-600/80 active:bg-amber-500
          text-white text-2xl font-bold transition shadow-lg border border-white/10 touch-manipulation">
        ⌫
      </button>
      {numBtn("0")}
      <button onClick={submit}
        className="aspect-[3/2] rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-400
          text-white text-2xl font-bold transition shadow-lg border border-white/10 touch-manipulation">
        ↵
      </button>
    </div>
  );
}

// ── Alphanumeric (QWERTY) ──────────────────────────────────────────────────
function AlphaLayout({ shift, setShift, append, backspace, submit }: {
  shift:    boolean;
  setShift: (b: boolean) => void;
  append:   (ch: string) => void;
  backspace: () => void;
  submit:   () => void;
}) {
  const row1 = ["1","2","3","4","5","6","7","8","9","0"];
  const row2 = ["q","w","e","r","t","y","u","i","o","p"];
  const row3 = ["a","s","d","f","g","h","j","k","l"];
  const row4 = ["z","x","c","v","b","n","m"];

  const showCh = (c: string) => shift ? c.toUpperCase() : c;

  const btn = (c: string, extra?: string) => (
    <button key={c} onClick={() => { append(showCh(c)); if (shift) setShift(false); }}
      className={`flex-1 min-w-0 h-12 sm:h-14 rounded-lg bg-white/15 hover:bg-white/25 active:bg-white/40
        text-white text-base sm:text-lg font-semibold transition shadow border border-white/10 touch-manipulation ${extra ?? ""}`}>
      {showCh(c)}
    </button>
  );

  return (
    <div className="space-y-1.5">
      {/* Row 1: numeric */}
      <div className="flex gap-1.5">{row1.map(c => btn(c))}
        <button onClick={backspace}
          className="px-3 h-12 sm:h-14 rounded-lg bg-amber-700/60 hover:bg-amber-600/80 active:bg-amber-500
            text-white text-xl font-bold transition shadow border border-white/10 touch-manipulation">
          ⌫
        </button>
      </div>
      <div className="flex gap-1.5">{row2.map(c => btn(c))}</div>
      <div className="flex gap-1.5 px-3">{row3.map(c => btn(c))}</div>
      <div className="flex gap-1.5">
        <button onClick={() => setShift(!shift)}
          className={`px-3 h-12 sm:h-14 rounded-lg text-white text-base font-semibold transition shadow border border-white/10 touch-manipulation
            ${shift ? "bg-cyan-600 hover:bg-cyan-500" : "bg-slate-600 hover:bg-slate-500"}`}>
          ⇧
        </button>
        {row4.map(c => btn(c))}
        <button onClick={() => append("-")}
          className="flex-1 h-12 sm:h-14 rounded-lg bg-white/15 hover:bg-white/25 text-white text-base font-semibold transition shadow border border-white/10 touch-manipulation">
          −
        </button>
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => append(" ")}
          className="flex-1 h-12 sm:h-14 rounded-lg bg-white/15 hover:bg-white/25 active:bg-white/40
            text-white text-sm font-semibold transition shadow border border-white/10 touch-manipulation">
          Space
        </button>
        <button onClick={() => append(".")}
          className="px-5 h-12 sm:h-14 rounded-lg bg-white/15 hover:bg-white/25 text-white text-lg font-bold transition shadow border border-white/10 touch-manipulation">
          .
        </button>
        <button onClick={() => append("/")}
          className="px-5 h-12 sm:h-14 rounded-lg bg-white/15 hover:bg-white/25 text-white text-lg font-bold transition shadow border border-white/10 touch-manipulation">
          /
        </button>
        <button onClick={submit}
          className="px-6 h-12 sm:h-14 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-400
            text-white text-lg font-bold transition shadow border border-white/10 touch-manipulation">
          ↵ Enter
        </button>
      </div>
    </div>
  );
}
