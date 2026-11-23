"use client";

// Navigasi modul Inventaris — meniru menu SIMGPS (grup + dropdown), konsisten
// di semua sub-halaman.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

type Item = { href: string; label: string };
type Group = { label: string; href?: string; items?: Item[] };

const GROUPS: Group[] = [
  { label: "Dashboard", href: "/inventaris/dashboard" },
  { label: "Inventaris", items: [
    { href: "/inventaris", label: "Semua Aset" },
    { href: "/inventaris?kategori=Medis", label: "Medis" },
    { href: "/inventaris?kategori=Non-Medis/IT", label: "Non-Medis / IT" },
    { href: "/inventaris?kategori=Sparepart", label: "Sparepart & Disposible" },
    { href: "/inventaris?kategori=Tools", label: "Tools & Meter" },
  ] },
  { label: "Opname", href: "/inventaris/opname" },
  { label: "Kalibrasi", items: [
    { href: "/inventaris/riwayat?jenis=Kalibrasi", label: "Riwayat Kalibrasi" },
    { href: "/inventaris/kalibrasi", label: "Penjadwalan Kalibrasi" },
  ] },
  { label: "Maintenance", href: "/inventaris/riwayat?jenis=Maintenance" },
  { label: "Inspeksi", href: "/inventaris/riwayat?jenis=Inspeksi" },
  { label: "Mutasi", href: "/inventaris/riwayat?jenis=Mutasi" },
  { label: "Complain", href: "/inventaris/riwayat?jenis=Complain" },
  { label: "Kondisi", href: "/inventaris/kondisi" },
  { label: "Master", href: "/inventaris/master" },
  { label: "SIMGPS", href: "/inventaris/simgps" },
  { label: "Scan", href: "/inventaris/scan" },
  { label: "Cetak QR", href: "/inventaris/qr" },
  { label: "Laporan", href: "/inventaris/laporan" },
  { label: "Booklet", href: "/inventaris/booklet" },
  { label: "Panduan", href: "/inventaris/panduan" },
];

function Nav() {
  const path = usePathname();
  const sp = useSearchParams();
  const jenis = sp.get("jenis") || "";
  const kategori = sp.get("kategori") || "";
  const [open, setOpen] = useState<number | null>(null);

  const cur = path + (jenis ? `?jenis=${jenis}` : kategori ? `?kategori=${kategori}` : "");
  const itemActive = (href: string) => {
    if (href.includes("?jenis=")) return path === "/inventaris/riwayat" && href.endsWith(`?jenis=${jenis}`);
    if (href.includes("?kategori=")) return path === "/inventaris" && href.endsWith(`?kategori=${kategori}`);
    if (href === "/inventaris") return path === "/inventaris" && !kategori;
    return path === href || path.startsWith(href + "/");
  };
  const groupActive = (g: Group) => g.href ? itemActive(g.href)
    : (g.items?.some(it => itemActive(it.href)) ?? false)
    || (g.label === "Inventaris" && /^\/inventaris\/\d+$/.test(path));

  return (
    <div className="border-b border-slate-200 -mx-6 px-6">
      <div className="flex items-center gap-0.5 flex-wrap">
        <span className="text-sm font-bold text-green-700 mr-2 py-2">📦 Inventaris</span>
        {GROUPS.map((g, i) => {
          const a = groupActive(g);
          const base = `px-3 py-2 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${a ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`;
          if (!g.items) return <Link key={i} href={g.href!} className={base}>{g.label}</Link>;
          return (
            <div key={i} className="relative" onMouseEnter={() => setOpen(i)} onMouseLeave={() => setOpen(null)}>
              <button className={base}>{g.label} ▾</button>
              {open === i && (
                <div className="absolute left-0 top-full z-30 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[200px]">
                  {g.items.map((it, j) => (
                    <Link key={j} href={it.href} onClick={() => setOpen(null)}
                      className={`block px-4 py-2 text-sm ${itemActive(it.href) ? "bg-green-50 text-green-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`}>
                      {it.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function InventarisNav() {
  return <Suspense fallback={<div className="h-10 border-b border-slate-200 -mx-6" />}><Nav /></Suspense>;
}
