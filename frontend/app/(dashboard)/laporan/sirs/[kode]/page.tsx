"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { findForm, RL_FORMS } from "@/lib/sirs";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function thisYear() { return String(new Date().getFullYear()); }

const STATUS_NOTE: Record<string, string> = {
  siap: "Tabel sumber data sudah tersedia di Khanza DB. Tinggal menulis query agregasi sesuai format Kemenkes.",
  perlu_field_tambahan: "Sebagian field yg diminta JUKNIS belum ada di Khanza DB — perlu tabel atau kolom tambahan.",
  belum_pasti: "Belum dicek apakah tabel sumber data ada di Khanza atau perlu di-create.",
};

export default function LaporanSirsDetail() {
  const params = useParams<{ kode: string }>();
  const form = findForm(params.kode);

  const [bulan, setBulan] = useState(thisMonth());
  const [tahun, setTahun] = useState(thisYear());

  if (!form) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <p className="text-red-600">Formulir RL <code>{params.kode}</code> tidak ditemukan.</p>
        <Link href="/laporan/sirs" className="text-sm text-green-700 hover:underline mt-3 inline-block">
          ← Kembali ke daftar SIRS
        </Link>
      </div>
    );
  }

  // Cari adjacent forms untuk navigasi prev/next
  const idx = RL_FORMS.findIndex(f => f.kode === form.kode);
  const prev = idx > 0 ? RL_FORMS[idx - 1] : null;
  const next = idx < RL_FORMS.length - 1 ? RL_FORMS[idx + 1] : null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <Link href="/laporan/sirs" className="text-xs text-slate-500 hover:text-green-700">
          ← Laporan SIRS 6.3
        </Link>
        <div className="flex items-start gap-3 mt-2">
          <span className="font-mono text-lg font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded">
            {form.display}
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800 leading-tight">{form.judul}</h1>
            <p className="text-xs text-slate-500 mt-1">
              {form.grup} · {form.sistem} · Periode: <span className="font-medium text-slate-700">{form.periode}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Status badge + sumber data */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Info label="Periode pelaporan" value={form.periode} />
          <Info label="Sistem" value={form.sistem} />
          <Info label="Status implementasi"
            value={form.status === "siap" ? "Sumber data siap" : form.status === "perlu_field_tambahan" ? "Perlu field tambahan" : "Sumber belum pasti"}
            colorClass={form.status === "siap" ? "text-green-700" : form.status === "perlu_field_tambahan" ? "text-amber-700" : "text-slate-500"} />
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500 uppercase mb-1">Sumber Data (Khanza DB)</p>
          <p className="text-sm font-mono text-slate-800 bg-slate-50 inline-block px-2 py-1 rounded">{form.sumber}</p>
          <p className="text-xs text-slate-500 mt-2">{STATUS_NOTE[form.status] || ""}</p>
        </div>
      </div>

      {/* Filter periode */}
      {form.periode !== "Update" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
          <p className="text-sm font-semibold text-slate-800 mb-3">Pilih periode pelaporan</p>
          {form.periode === "Bulanan" ? (
            <div>
              <label className="text-xs text-slate-500 block mb-1">Bulan (YYYY-MM)</label>
              <input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <p className="text-[11px] text-slate-400 mt-1">
                Deadline pelaporan: tanggal 10 bulan berikutnya.
              </p>
            </div>
          ) : (
            <div>
              <label className="text-xs text-slate-500 block mb-1">Tahun</label>
              <input type="number" min={2020} max={2099} value={tahun}
                onChange={(e) => setTahun(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-32" />
              <p className="text-[11px] text-slate-400 mt-1">
                Deadline pelaporan: 31 Maret tahun berikutnya.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Placeholder content per RL */}
      <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center">
        <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm text-slate-500 font-medium">Tabel laporan {form.display} akan tampil di sini</p>
        <p className="text-[11px] text-slate-400 mt-1">
          Belum di-implementasi — placeholder. Klik edit untuk mulai mengimplementasikan formulir ini.
        </p>
        <button disabled
          className="mt-4 px-5 py-2.5 rounded-xl bg-slate-200 text-slate-400 text-sm font-medium cursor-not-allowed">
          Generate Laporan (coming soon)
        </button>
      </div>

      {/* Prev/Next navigation */}
      <div className="mt-6 flex items-center justify-between gap-3">
        {prev ? (
          <Link href={`/laporan/sirs/${prev.kode}`}
            className="flex-1 max-w-xs bg-white border border-slate-200 rounded-xl p-3 hover:bg-slate-50 transition">
            <p className="text-[11px] text-slate-400 uppercase">Sebelumnya</p>
            <p className="text-sm font-mono font-bold text-slate-700">{prev.display}</p>
            <p className="text-xs text-slate-500 truncate">{prev.judul}</p>
          </Link>
        ) : <div className="flex-1" />}
        {next ? (
          <Link href={`/laporan/sirs/${next.kode}`}
            className="flex-1 max-w-xs bg-white border border-slate-200 rounded-xl p-3 hover:bg-slate-50 transition text-right">
            <p className="text-[11px] text-slate-400 uppercase">Berikutnya</p>
            <p className="text-sm font-mono font-bold text-slate-700">{next.display}</p>
            <p className="text-xs text-slate-500 truncate">{next.judul}</p>
          </Link>
        ) : <div className="flex-1" />}
      </div>
    </div>
  );
}

function Info({ label, value, colorClass = "text-slate-800" }: { label: string; value: string; colorClass?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase">{label}</p>
      <p className={`text-sm font-medium mt-1 ${colorClass}`}>{value}</p>
    </div>
  );
}
