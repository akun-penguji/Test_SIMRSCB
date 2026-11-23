"use client";

// Booklet / Manual Alat (gaya SIMGPS). Dokumen manual dikelola di SIDOMU.

import Link from "next/link";
import InventarisNav from "@/app/(dashboard)/inventaris/InventarisNav";

export default function BookletPage() {
  return (
    <div className="p-6 space-y-5">
      <InventarisNav />
      <h1 className="text-xl font-bold text-slate-800">Booklet / Manual Alat</h1>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center space-y-3">
        <div className="text-4xl">📘</div>
        <p className="text-slate-600">Belum ada booklet/manual alat yang diunggah.</p>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Manual & dokumen mutu alat dapat dikelola terpusat di modul <b>SIDOMU</b> (Sistem Dokumen Mutu),
          lalu dikaitkan ke aset terkait.
        </p>
        <Link href="/sidomu" className="inline-block px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg">Buka SIDOMU →</Link>
      </div>
    </div>
  );
}
