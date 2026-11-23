"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getSession, clearSession } from "@/lib/auth";
import { getSetting, SettingRS } from "@/lib/api";

const MENU_DIREKTUR = [
  { href: "/direktur",             label: "Dashboard",   icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/direktur/keuangan",    label: "Keuangan",    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/direktur/operasional", label: "Operasional", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { href: "/direktur/sdm",         label: "SDM",         icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
  { href: "/direktur/mutu",        label: "Mutu",        icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { href: "/direktur/farmasi",     label: "Farmasi",     icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" },
];

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right">
      <div className="text-lg font-mono font-bold text-white tracking-wider">
        {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div className="text-xs text-green-200 capitalize">
        {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>
  );
}

export default function DirekturLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]       = useState<{ nama: string; kode: string } | null>(null);
  const [setting, setSetting] = useState<SettingRS | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.replace("/login"); return; }
    setUser({ nama: s.nama, kode: s.kode });
  }, [router]);

  useEffect(() => {
    getSetting().then(r => setSetting(r.data)).catch(() => {});
  }, []);

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  if (!user) return null;
  const namaRS = setting?.nama_instansi || "Rumah Sakit";

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ── Header hijau (matching SIMRSCB) ── */}
      <header className="bg-green-800 text-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-2a4 4 0 014-4h10a4 4 0 014 4v2M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-green-200 font-semibold">Executive Dashboard</div>
              <div className="text-base font-bold leading-tight">{namaRS}</div>
            </div>
          </div>
          <Clock />
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <div className="text-xs text-green-200">Login sebagai</div>
              <div className="text-sm font-semibold text-white">{user.nama}</div>
            </div>
            <Link href="/dashboard" title="Kembali ke SIMRS"
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs text-white font-medium border border-white/20 transition">
              ← SIMRS
            </Link>
            <button onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg bg-red-700/40 hover:bg-red-700/60 text-xs text-white font-medium border border-red-400/30 transition">
              Keluar
            </button>
          </div>
        </div>
        {/* Sub-nav tabs */}
        <nav className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto border-t border-green-700/50">
          {MENU_DIREKTUR.map(m => {
            const active = m.href === "/direktur" ? pathname === "/direktur" : pathname.startsWith(m.href);
            return (
              <Link key={m.href} href={m.href}
                className={`px-4 py-2.5 text-xs font-medium transition border-b-2 flex items-center gap-2 shrink-0 ${
                  active
                    ? "border-white text-white bg-green-700/50"
                    : "border-transparent text-green-200 hover:text-white hover:bg-green-700/30"
                }`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={m.icon} />
                </svg>
                {m.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {children}
      </main>

      <footer className="text-center py-4 text-xs text-slate-500 border-t border-slate-200">
        SIMRS CB — Executive View • {namaRS}
      </footer>
    </div>
  );
}
