"use client";

// Shell aplikasi web e-Nakes (perawat/tenaga kesehatan, mobile-first).
// Guard login → /login?next=/enakes.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function EnakesLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("simrscb_token") : null;
    if (!token) {
      // Selalu kembali ke home e-Nakes (/enakes), bukan halaman detail /enakes/pasien
      // yang butuh query param (no_rawat/jenis) — tanpa param halaman itu kosong.
      router.replace(`/login?next=${encodeURIComponent("/enakes")}`);
      return;
    }
    setReady(true);
  }, [pathname, router]);

  // Auto-logout setelah 10 menit idle (tanpa aktivitas) — keamanan e-Nakes.
  useEffect(() => {
    if (!ready) return;
    const TIMEOUT = 10 * 60 * 1000;
    let t: ReturnType<typeof setTimeout>;
    const doLogout = () => {
      try { localStorage.removeItem("simrscb_token"); } catch {}
      router.replace(`/login?next=${encodeURIComponent("/enakes")}&idle=1`);
    };
    const reset = () => { clearTimeout(t); t = setTimeout(doLogout, TIMEOUT); };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(t); events.forEach(e => window.removeEventListener(e, reset)); };
  }, [ready, pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Memuat…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto w-full max-w-md bg-slate-50 min-h-screen shadow-sm">
        {children}
      </div>
    </div>
  );
}
