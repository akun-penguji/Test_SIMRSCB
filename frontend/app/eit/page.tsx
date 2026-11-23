"use client";

// Beranda eIT: identitas petugas IT (dari sesi login) + ringkasan (tiket
// terbuka, aktivitas saya bulan ini) + pintasan ke Tiket & Kinerja.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, clearSession } from "@/lib/auth";
import { getLaporIt, getKinerjaList } from "@/lib/api";

export default function EitHome() {
  const router = useRouter();
  const [nama, setNama] = useState("");
  const [tiketTerbuka, setTiketTerbuka] = useState<number | null>(null);
  const [aktivitasBulan, setAktivitasBulan] = useState<number | null>(null);

  useEffect(() => {
    const s = getSession();
    setNama(s?.nama || "");
    const now = new Date();
    const tahun = now.getFullYear();
    const bulan = now.getMonth() + 1;

    // Tiket yang belum selesai (baru + diproses)
    Promise.all([getLaporIt({ tahun, status: "baru" }), getLaporIt({ tahun, status: "diproses" })])
      .then(([a, b]) => setTiketTerbuka(a.data.length + b.data.length))
      .catch(() => setTiketTerbuka(0));

    // Aktivitas kinerja saya bulan ini
    getKinerjaList({ tahun, bulan, petugas: s?.nama })
      .then(r => setAktivitasBulan(r.data.length))
      .catch(() => setAktivitasBulan(0));
  }, []);

  function logout() {
    clearSession();
    router.replace("/login?next=/eit");
  }

  return (
    <div>
      <header className="bg-indigo-600 text-white px-4 pt-5 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs opacity-80">eIT · Tim IT RSUD Cabangbungin</div>
            <div className="text-lg font-bold">{nama || "Petugas IT"}</div>
          </div>
          <button onClick={logout} className="text-xs bg-white/15 rounded-lg px-3 py-1.5 hover:bg-white/25">Keluar</button>
        </div>
      </header>

      <div className="px-4 -mt-4 grid grid-cols-2 gap-3">
        <Link href="/eit/tiket" className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <div className="text-xs text-slate-400">Tiket terbuka</div>
          <div className="text-2xl font-bold text-amber-600">{tiketTerbuka ?? "…"}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">perlu ditangani</div>
        </Link>
        <Link href="/eit/kinerja" className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <div className="text-xs text-slate-400">Kinerja saya</div>
          <div className="text-2xl font-bold text-indigo-600">{aktivitasBulan ?? "…"}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">kegiatan bulan ini</div>
        </Link>
      </div>

      <div className="px-4 mt-5 space-y-2">
        <div className="text-xs font-semibold text-slate-500 px-1">MENU</div>
        <MenuItem href="/eit/tiket" title="Tiket Lapor IT" desc="Lihat & tangani laporan masalah dari unit" color="bg-amber-100 text-amber-700" icon="M3 7h18M3 12h18M3 17h18" />
        <MenuItem href="/eit/kinerja" title="Catat Kinerja" desc="Catat aktivitas kerja + foto dari lapangan" color="bg-indigo-100 text-indigo-700" icon="M12 4v16m8-8H4" />
      </div>

      <p className="text-center text-[11px] text-slate-400 mt-8 px-4">
        Tambahkan ke layar utama HP untuk akses cepat. Petugas tercatat otomatis dari akun yang login.
      </p>
    </div>
  );
}

function MenuItem({ href, title, desc, color, icon }: { href: string; title: string; desc: string; color: string; icon: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
      </div>
      <div className="flex-1">
        <div className="font-medium text-slate-800 text-sm">{title}</div>
        <div className="text-xs text-slate-400">{desc}</div>
      </div>
      <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
    </Link>
  );
}
