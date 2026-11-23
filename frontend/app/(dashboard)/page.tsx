"use client";

import { getSession } from "@/lib/auth";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [nama, setNama] = useState("");

  useEffect(() => {
    const s = getSession();
    if (s) setNama(s.nama);
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-slate-800 mb-1">
        Selamat datang, {nama || "..."}
      </h2>
      <p className="text-slate-500 text-sm mb-6">
        {new Date().toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      <div className="grid grid-cols-2 gap-4 max-w-lg">
        <Link
          href="/pasien"
          className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-2">👤</div>
          <div className="font-medium text-slate-700">Data Pasien</div>
          <div className="text-xs text-slate-400 mt-1">Cari & kelola data pasien</div>
        </Link>

        <Link
          href="/registrasi"
          className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-2">📋</div>
          <div className="font-medium text-slate-700">Registrasi</div>
          <div className="text-xs text-slate-400 mt-1">Daftar & buat kunjungan</div>
        </Link>
      </div>
    </div>
  );
}
