"use client";

// Shell aplikasi mobile eIT (tim/teknisi IT). Pola sama dengan e-Nakes:
// guard login, auto-logout idle, container mobile max-w-md, plus bottom nav
// Beranda / Tiket / Kinerja. Isi: Lapor IT + Kinerja IT (reuse API web).

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

const NAV = [
  { href: "/eit", label: "Beranda", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/eit/tiket", label: "Tiket", icon: "M3 7h18M3 12h18M3 17h18" },
  { href: "/eit/kinerja", label: "Kinerja", icon: "M4 19V5m4 14V9m4 10V7m4 12v-8m4 8V11" },
];

export default function EitLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("simrscb_token") : null;
    if (!token) { router.replace(`/login?next=${encodeURIComponent("/eit")}`); return; }
    setReady(true);
  }, [pathname, router]);

  // Auto-logout 10 menit idle — keamanan (sama seperti e-Nakes).
  useEffect(() => {
    if (!ready) return;
    const TIMEOUT = 10 * 60 * 1000;
    let t: ReturnType<typeof setTimeout>;
    const doLogout = () => {
      try { localStorage.removeItem("simrscb_token"); } catch {}
      router.replace(`/login?next=${encodeURIComponent("/eit")}&idle=1`);
    };
    const reset = () => { clearTimeout(t); t = setTimeout(doLogout, TIMEOUT); };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(t); events.forEach(e => window.removeEventListener(e, reset)); };
  }, [ready, pathname, router]);

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">Memuat…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto w-full max-w-md bg-slate-50 min-h-screen shadow-sm flex flex-col">
        <div className="flex-1 pb-16">{children}</div>
        <nav className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md bg-white border-t border-slate-200 flex">
          {NAV.map(n => {
            const active = n.href === "/eit" ? pathname === "/eit" : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href}
                className={`flex-1 flex flex-col items-center py-2 text-[11px] ${active ? "text-indigo-600" : "text-slate-400"}`}>
                <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={n.icon} />
                </svg>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
