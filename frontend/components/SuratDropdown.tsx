"use client";

// Dropdown "Surat" per-baris — menu grup flyout ala DlgReg.
// Dipakai bersama oleh halaman Registrasi & IGD agar menunya identik.

import { useState, useEffect, useRef } from "react";

const PERNYATAAN_KEYS = new Set([
  "persetujuan_umum","hak_kewajiban","masuk_unit","jaminan_pasien",
  "jaminan_umum","titip_kelas","jamkesda","bersedia_igd",
  "persetujuan_penolakan","pulang_aps",
]);

interface SuratItem {
  label: string;
  key: string;
}
interface SuratGroup {
  group: string;
  items: SuratItem[];
}

const SURAT_MENU: SuratGroup[] = [
  {
    group: "Surat Keterangan",
    items: [
      { key: "kontrol",          label: "Surat Kontrol" },
      { key: "lihat_kontrol",    label: "Lihat Surat Kontrol Sebelumnya" },
      { key: "sehat1",           label: "Surat Keterangan Sehat 1" },
      { key: "sehat2",           label: "Surat Keterangan Sehat 2" },
      { key: "sehat3",           label: "Surat Keterangan Sehat 3" },
      { key: "sakit",            label: "Surat Cuti Sakit" },
      { key: "sakit_pihak2",     label: "Surat Cuti Sakit Pihak Ke 2" },
      { key: "rawat_inap",       label: "Surat Keterangan Rawat Inap" },
      { key: "hamil",            label: "Surat Keterangan Hamil/Tidak Hamil" },
      { key: "cuti_hamil",       label: "Surat Cuti Hamil" },
      { key: "bebas_narkoba",    label: "Surat Keterangan Bebas Narkoba" },
      { key: "bebas_tbc",        label: "Surat Keterangan Bebas TBC" },
      { key: "buta_warna",       label: "Surat Buta Warna" },
      { key: "bebas_tato",       label: "Surat Bebas Tato" },
      { key: "kewaspadaan",      label: "Surat Kewaspadaan Kesehatan" },
      { key: "covid",            label: "Surat Keterangan Covid" },
    ],
  },
  {
    group: "Edukasi",
    items: [
      { key: "edukasi_terintegrasi", label: "Edukasi Pasien & Keluarga Terintegrasi" },
      { key: "materi_edukasi",       label: "Materi Edukasi Pasien & Keluarga" },
    ],
  },
  {
    group: "Persetujuan & Pernyataan",
    items: [
      { key: "persetujuan_umum",         label: "Persetujuan Umum" },
      { key: "hak_kewajiban",            label: "Hak dan Kewajiban Pasien" },
      { key: "masuk_unit",               label: "Pernyataan Masuk Unit" },
      { key: "jaminan_pasien",           label: "Surat Pernyataan Jaminan Pasien" },
      { key: "jaminan_umum",             label: "Pernyataan Jaminan Umum" },
      { key: "titip_kelas",              label: "Pernyataan Titip Kelas" },
      { key: "jamkesda",                 label: "Pernyataan Jamkesda" },
      { key: "bersedia_igd",             label: "Pernyataan Bersedia di IGD" },
      { key: "persetujuan_penolakan",    label: "Persetujuan/Penolakan Tindakan" },
      { key: "pulang_aps",               label: "Pulang Atas Permintaan Sendiri" },
    ],
  },
  {
    group: "Administrasi",
    items: [
      { key: "bukti_pelayanan_ralan",  label: "Surat Jaminan & Bukti Pelayanan Ralan" },
      { key: "sbpk1",                  label: "Surat Bukti Pelayanan Kesehatan (SBPK) 1" },
      { key: "sbpk2",                  label: "Surat Bukti Pelayanan Kesehatan (SBPK) 2" },
      { key: "sbt",                    label: "Surat Bukti Tindakan" },
      { key: "jkra",                   label: "Surat Jaminan Kesehatan Nasional (JKRA) Rawat Jalan" },
      { key: "jaminan_bpjs",           label: "Surat Jaminan Pelayanan BPJS" },
    ],
  },
];

export default function SuratDropdown({
  reg,
  onNavigate,
}: {
  reg: { no_rawat: string };
  onNavigate: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const [subPos, setSubPos] = useState({ top: 0, right: 0 });
  const btnRef    = useRef<HTMLButtonElement>(null);
  const menuRef   = useRef<HTMLDivElement>(null);
  const subRef    = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Posisi dropdown utama (fixed, di bawah tombol)
  function openMenu() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const margin = 8;
    const estTinggi = SURAT_MENU.length * 42 + 12;
    let top = r.bottom + 4;
    if (top + estTinggi > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - estTinggi - margin);
    }
    setPos({ top, right: window.innerWidth - r.right });
    setOpen(true);
    setActiveGroup(null);
  }

  // Posisi sub-menu (fixed, flyout ke kiri). Jepit vertikal supaya tidak keluar
  // dari bawah layar saat baris ada di dekat tepi bawah (kalau tidak, flyout
  // yang tinggi ter-clip / tak kelihatan).
  function openGroup(grpKey: string) {
    setActiveGroup(grpKey);
    const btn = groupRefs.current[grpKey];
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const grp = SURAT_MENU.find((g) => g.group === grpKey);
    const margin = 8;
    const estTinggi = (grp?.items.length ?? 4) * 34 + 44; // estimasi tinggi flyout
    let top = r.top;
    if (top + estTinggi > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - estTinggi - margin);
    }
    // Tampil ke kiri dari menu utama
    setSubPos({ top, right: window.innerWidth - r.left + 4 });
  }

  // Tutup saat klik di luar
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      const inBtn  = btnRef.current?.contains(t);
      const inMenu = menuRef.current?.contains(t);
      const inSub  = subRef.current?.contains(t);
      if (!inBtn && !inMenu && !inSub) { setOpen(false); setActiveGroup(null); }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Tutup saat scroll
  useEffect(() => {
    if (open) {
      const close = () => { setOpen(false); setActiveGroup(null); };
      window.addEventListener("scroll", close, true);
      return () => window.removeEventListener("scroll", close, true);
    }
  }, [open]);

  function handleSelect(key: string) {
    setOpen(false);
    setActiveGroup(null);
    if (key === "edukasi_terintegrasi") {
      onNavigate(`/edukasi/${encodeURIComponent(reg.no_rawat)}`);
      return;
    }
    if (key === "materi_edukasi") {
      onNavigate(`/edukasi/${encodeURIComponent(reg.no_rawat)}/materi`);
      return;
    }
    if (PERNYATAAN_KEYS.has(key)) {
      onNavigate(`/surat/${key}?no_rawat=${encodeURIComponent(reg.no_rawat)}`);
    } else {
      alert(`[Belum tersedia]\nNo. Rawat: ${reg.no_rawat}`);
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => open ? (setOpen(false), setActiveGroup(null)) : openMenu()}
        className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-green-700
                   border border-slate-200 hover:border-green-300 bg-white hover:bg-green-50
                   px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Surat
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Menu utama — fixed agar keluar dari overflow container */}
      {open && (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999,
                   maxHeight: `calc(100vh - ${pos.top + 8}px)`, overflowY: "auto" }}
          className="bg-white border border-slate-200 rounded-xl shadow-xl min-w-52 py-1 text-sm"
        >
          {SURAT_MENU.map((grp) => (
            <button
              key={grp.group}
              ref={(el) => { groupRefs.current[grp.group] = el; }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left
                transition-colors ${activeGroup === grp.group
                  ? "bg-green-50 text-green-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"}`}
              onMouseEnter={() => openGroup(grp.group)}
            >
              <span>{grp.group}</span>
              <svg className="w-3 h-3 ml-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Sub-items — fixed, flyout ke kiri */}
      {open && activeGroup && (() => {
        const grp = SURAT_MENU.find((g) => g.group === activeGroup);
        if (!grp) return null;
        return (
          <div
            ref={subRef}
            style={{ position: "fixed", top: subPos.top, right: subPos.right, zIndex: 9999,
                     maxHeight: `calc(100vh - ${subPos.top + 8}px)`, overflowY: "auto" }}
            className="bg-white border border-slate-200 rounded-xl shadow-xl min-w-80 py-1 text-sm"
            onMouseLeave={() => setActiveGroup(null)}
          >
            <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 border-b border-slate-100 mb-1">
              {grp.group}
            </p>
            {grp.items.map((item) => (
              <button
                key={item.key}
                onClick={() => handleSelect(item.key)}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-green-50 hover:text-green-800
                           flex items-center gap-2 transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {item.label}
              </button>
            ))}
          </div>
        );
      })()}
    </>
  );
}
