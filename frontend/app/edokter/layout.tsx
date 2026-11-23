"use client";

// Shell aplikasi web dokter (mobile-first, ≥6 inci). Tidak memakai sidebar
// dashboard desktop. Guard: kalau belum login, arahkan ke /login?next=/edokter.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function EdokterLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("simrscb_token") : null;
    if (!token) {
      const next = pathname || "/edokter";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setReady(true);
  }, [pathname, router]);

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
