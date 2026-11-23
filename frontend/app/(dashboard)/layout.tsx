"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getSession, clearSession, hasPerm } from "@/lib/auth";
import { getSetting, SettingRS } from "@/lib/api";

// ── Top menu bar (dropdown) ────────────────────────────────────────────────────
const TOP_MENU = [
  {
    label: "Program",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    items: [
      { label: "Dashboard",        href: "/dashboard" },
      { label: "Inventaris / Aset", href: "/inventaris" },
      { label: "Tentang SIMRS CB", href: "/tentang" },
    ],
  },
  {
    label: "Kepegawaian",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197",
    items: [
      { label: "Data Pegawai",         href: "/kepegawaian" },
      { label: "Jadwal Jaga",          href: "/kepegawaian" },
      { label: "Presensi",             href: "/kepegawaian" },
      { label: "Log Kinerja Harian",   href: "/log-kinerja" },
      { label: "Rekap Log Kinerja",    href: "/log-kinerja/rekap" },
      { label: "BIMASAKTI (BMS Index)", href: "/bimasakti" },
      { label: "Analisis Beban Kerja (ABK)", href: "/abk-kes" },
    ],
  },
  {
    label: "BPJS & Bridging",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    items: [
      { label: "SEP & Klaim",        href: "/bpjs" },
      { label: "Bridging VCLAIM",    href: "/bpjs" },
      { label: "Antrian Online BPJS",href: "/bpjs" },
      { label: "Tempat Tidur (Aplicare)", href: "/aplicare", requires: "aplicare_view" },
      { label: "Monitor Aplicare",   href: "/aplicare/monitor", requires: "aplicare_view" },
      { label: "Antrean Mobile JKN",  href: "/mobilejkn", requires: "mobilejkn_view" },
      { label: "Monitor SIRANAP",     href: "/siranap/monitor", requires: "siranap_view" },
      { label: "SatuSehat (RME)",     href: "/satusehat/monitor", requires: "satusehat_view" },
    ],
  },
  {
    label: "Rekam Medis",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    items: [
      { label: "Berkas Rawat",      href: "/rekam-medis" },
      { label: "Berkas Klaim BPJS", href: "/rekam-medis" },
      { label: "Sensus Harian",     href: "/rekam-medis" },
      { label: "Daftar Singkatan & Simbol", href: "/singkatan" },
      { label: "Persetujuan Umum Tersimpan", href: "/persetujuan-umum", requires: "consent_view" },
      { label: "Edukasi Tersimpan",          href: "/edukasi-tersimpan", requires: "consent_view" },
      { label: "Hak & Kewajiban Tersimpan",  href: "/hak-kewajiban-tersimpan", requires: "consent_view" },
      { label: "Surat Pernyataan Tersimpan", href: "/pernyataan-jaminan-tersimpan", requires: "consent_view" },
    ],
  },
  {
    label: "Laporan",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    items: [
      { label: "Kunjungan & Pelayanan",   href: "/laporan" },
      { label: "Farmasi — Stok Minimum",  href: "/laporan/farmasi/stok-minimum" },
      { label: "Laporan SIRS 6.3 (RL)",   href: "/laporan/sirs", requires: "sirs_view" },
      { label: "Laporan Morbiditas",      href: "/laporan" },
      { label: "Indikator BOR/ALOS/BTO",  href: "/laporan" },
    ],
  },
  {
    label: "Akreditasi",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    groups: [
      { title: "Akreditasi", items: [
        { label: "Dashboard Akreditasi", href: "/akreditasi" },
        { label: "Daftar EP STARKES",    href: "/akreditasi/ep" },
        { label: "Penilaian Mandiri (Self-Assessment)", href: "/penilaian" },
        { label: "Eviden / Bukti Folder", href: "/akreditasi/eviden" },
        { label: "PPS (Perbaikan Strategis)", href: "/pps" },
        { label: "HSI (Safety Index)", href: "/hsi" },
      ] },
      { title: "Mutu & Indikator", items: [
        { label: "SIDOMU (Dokumen Mutu)", href: "/sidomu" },
        { label: "Generator Dokumen (SK/SPO)", href: "/dokumen-mutu" },
        { label: "TTE Dokumen & SOP", href: "/tte-sop" },
        { label: "Master Spesimen TTE", href: "/tte-spesimen" },
        { label: "Indikator Mutu (INM/IMP)", href: "/mutu" },
        { label: "Insiden Keselamatan (IKP)", href: "/insiden" },
        { label: "PPI (Surveilans & Audit)", href: "/ppi" },
        { label: "SKP (6 Sasaran)", href: "/skp" },
        { label: "Prognas (Program Nasional)", href: "/prognas" },
        { label: "MFK (Fasilitas & Keselamatan)", href: "/mfk" },
        { label: "Fasilitas (Limbah B3 & Pemeliharaan)", href: "/fasilitas" },
        { label: "Manajemen (Kepuasan/Orientasi/Vendor)", href: "/manajemen-mutu" },
        { label: "Skoring Prioritas (HR/HV/PP)", href: "/mutu-prioritas" },
        { label: "Evaluasi Pendaftaran (AKP)", href: "/evaluasi-pendaftaran", requires: "evaluasi_pendaftaran_view" },
        { label: "Kendala Pendaftaran (Laporan)", href: "/kendala-pendaftaran", requires: "evaluasi_pendaftaran_view" },
        { label: "Pengelolaan Alur Pasien (AKP)", href: "/alur-pasien" },
        { label: "Info Terintegrasi Berkala (AKP)", href: "/info-terintegrasi" },
        { label: "Serah Terima Resume Pulang (AKP)", href: "/resume-serah-terima" },
        { label: "Rekap Pasien Pulang APS (AKP)", href: "/aps-rekap" },
        { label: "Waktu Tunggu Lab (PP 3)", href: "/waktu-tunggu-lab" },
        { label: "Laporan Jam Visit Dokter", href: "/jam-visit-dokter" },
        { label: "Rekap Risiko Jatuh", href: "/risiko-jatuh" },
        { label: "Kepatuhan Clinical Pathway", href: "/kepatuhan-cp" },
        { label: "Audit Edukasi Terintegrasi", href: "/audit-edukasi" },
        { label: "Dokumentasi Rapat", href: "/rapat", requires: "rapat_view" },
        { label: "Manajemen Risiko (FMEA)", href: "/manajemen-risiko" },
      ] },
      { title: "Rekam Medis & Audit", items: [
        { label: "KLPCM (Audit RM)",     href: "/klpcm" },
        { label: "Pemusnahan RM",        href: "/pemusnahan-rm" },
        { label: "MRMIK (Register RM)",  href: "/mrmik" },
        { label: "MRMIK — Keamanan Fisik RM", href: "/mrmik/keamanan-fisik" },
        { label: "MRMIK 2 — Laporan Integrasi Data", href: "/mrmik/integrasi" },
        { label: "IKP — Laporan Evaluasi Insiden", href: "/mrmik/ikp" },
        { label: "Keamanan Jaringan & Anti-Malware", href: "/keamanan-jaringan" },
        { label: "Self Security Assessment (Kredensialing)", href: "/security-assessment", requires: "ssa_view" },
        { label: "KPS (Kredensial & Diklat)", href: "/kps" },
      ] },
      { title: "PPRA", items: [
        { label: "PPRA — Dashboard",     href: "/ppra", requires: "ppra_view" },
        { label: "PPRA — Kuantitatif",   href: "/ppra/kuantitatif", requires: "ppra_view" },
        { label: "PPRA — Gyssens (Audit)", href: "/ppra/gyssens", requires: "ppra_view" },
        { label: "PPRA — Referensi ATC", href: "/ppra/atc", requires: "ppra_view" },
        { label: "PPRA — Mapping Obat",  href: "/ppra/mapping", requires: "ppra_view" },
      ] },
      { title: "IT / SIMRS", items: [
        { label: "Downtime SIMRS",       href: "/downtime" },
        { label: "Lapor IT / Helpdesk",  href: "/lapor-it" },
        { label: "Permintaan Fitur SIMRS", href: "/permintaan-fitur" },
        { label: "Kinerja IT", href: "/kinerja-it" },
        { label: "Monev SIMRS (WBK)",    href: "/monev" },
      ] },
    ],
  },
  {
    label: "Pengaturan",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    items: [
      { label: "Master Data",         href: "/pengaturan" },
      { label: "User & Hak Akses",    href: "/pengaturan" },
      { label: "Permission Web",      href: "/pengaturan/permissions", requires: "__admin_only" },
      { label: "Setting Rumah Sakit", href: "/pengaturan" },
      { label: "Konfigurasi Web",     href: "/pengaturan" },
    ],
  },
];

// ── Menu shortcuts di navbar ───────────────────────────────────────────────────
const NAV_SHORTCUTS = [
  { href: "/dashboard",    label: "Dashboard",   color: "text-slate-300",   icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/registrasi",   label: "Registrasi",  color: "text-blue-300",    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { href: "/igd",          label: "IGD/UGD",     color: "text-red-300",     icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
  { href: "/rawat-jalan",  label: "Rawat Jalan", color: "text-sky-300",     icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { href: "/rawat-inap",   label: "Rawat Inap",  color: "text-indigo-300",  icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { href: "/kamar-operasi",label: "Operasi",     color: "text-violet-300",  icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" },
  { href: "/laboratorium", label: "Laborat",     color: "text-amber-300",   icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" },
  { href: "/radiologi",    label: "Radiologi",   color: "text-orange-300",  icon: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" },
  { href: "/farmasi",      label: "Farmasi",     color: "text-emerald-300", icon: "M9 3h6l1 2H8L9 3zM4 5h16v2H4V5zM5 7h14l-1 13H6L5 7zm5 3v7m4-7v7" },
  { href: "/kasir-ralan",  label: "Kasir Ralan", color: "text-yellow-300",  icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
  { href: "/kasir-ranap",  label: "Kasir Ranap", color: "text-teal-300",    icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
];

// ── Sidebar full menu (frmUtama structure) ────────────────────────────────────
const SIDEBAR_MENU = [
  {
    label: "Pendaftaran & Registrasi", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    items: [
      { label: "Registrasi Pasien", href: "/registrasi", requires: "registrasi_view" },
      { label: "Registrasi Baru", href: "/registrasi/baru", requires: "registrasi_edit" },
      { label: "Data Pasien", href: "/pasien", requires: "pasien_view" },
      { label: "Pasien Baru", href: "/pasien/baru", requires: "pasien_edit" },
    ],
  },
  {
    label: "IGD / Gawat Darurat", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
    items: [
      { label: "Antrean & Triase IGD", href: "/igd" },
      { label: "Asesmen Awal IGD", href: "/igd" },
      { label: "Monitoring Tanda Vital", href: "/igd" },
    ],
  },
  {
    label: "Rawat Jalan", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    items: [
      { label: "Kunjungan Rawat Jalan", href: "/rawat-jalan" },
      { label: "SOAP & Diagnosa", href: "/rawat-jalan" },
      { label: "Resep & Tindakan", href: "/rawat-jalan" },
      { label: "Akseptor KB (RL 3.16)", href: "/akseptor-kb", requires: "kb_pelayanan_view" },
    ],
  },
  {
    label: "Rawat Inap", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5",
    items: [
      { label: "Pasien Rawat Inap", href: "/rawat-inap" },
      { label: "Kamar & Tempat Tidur", href: "/rawat-inap" },
      { label: "Catatan Perawat", href: "/rawat-inap" },
    ],
  },
  {
    label: "Kamar Operasi", icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18",
    items: [
      { label: "Booking Operasi", href: "/kamar-operasi" },
      { label: "Asesmen Pra Anestesi", href: "/kamar-operasi" },
      { label: "Status Anestesi", href: "/kamar-operasi" },
      { label: "Laporan Operasi", href: "/kamar-operasi" },
    ],
  },
  {
    label: "Laboratorium", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547",
    items: [
      { label: "Order Laborat", href: "/laboratorium" },
      { label: "Hasil Pemeriksaan", href: "/laboratorium" },
      { label: "Master Pemeriksaan", href: "/laboratorium" },
    ],
  },
  {
    label: "Radiologi", icon: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2",
    items: [
      { label: "Order Radiologi", href: "/radiologi" },
      { label: "Hasil Radiologi", href: "/radiologi" },
    ],
  },
  {
    label: "Farmasi & Apotek", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517",
    items: [
      { label: "Resep & Obat", href: "/farmasi" },
      { label: "Stok Apotek", href: "/farmasi" },
      { label: "Penyerahan Obat", href: "/farmasi" },
    ],
  },
  {
    label: "Kasir & Billing", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2",
    items: [
      { label: "Kasir Rawat Jalan", href: "/kasir-ralan" },
      { label: "Kasir Rawat Inap", href: "/kasir-ranap" },
      { label: "Tagihan & Piutang", href: "/tagihan" },
    ],
  },
  {
    label: "BPJS & Bridging", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944",
    items: [
      { label: "SEP & Klaim", href: "/bpjs" },
      { label: "Bridging VCLAIM", href: "/bpjs" },
      { label: "Antrian Online BPJS", href: "/bpjs" },
    ],
  },
  {
    label: "Inventory & Gudang", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10",
    items: [
      { label: "Master Data Barang", href: "/barang" },
      { label: "Pengendalian Persediaan", href: "/persediaan" },
      { label: "Darurat Stok (Stok Kritis)", href: "/darurat-stok" },
      { label: "Stok Barang", href: "/inventory" },
      { label: "Penerimaan Barang", href: "/inventory" },
      { label: "Permintaan Barang", href: "/inventory" },
      { label: "Master Supplier", href: "/inventory" },
    ],
  },
  {
    label: "Gizi & Dapur", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17",
    items: [
      { label: "Order Diet", href: "/gizi" },
      { label: "Jadwal Makan", href: "/gizi" },
    ],
  },
  {
    label: "Rekam Medis", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5",
    items: [
      { label: "Berkas Rawat", href: "/rekam-medis" },
      { label: "Berkas Klaim BPJS", href: "/rekam-medis" },
      { label: "Sensus Harian", href: "/rekam-medis" },
      { label: "Daftar Singkatan & Simbol", href: "/singkatan" },
    ],
  },
  {
    label: "Kepegawaian / SDM", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197",
    items: [
      { label: "Data Pegawai", href: "/kepegawaian" },
      { label: "Jadwal Jaga", href: "/kepegawaian" },
      { label: "Kehadiran", href: "/kepegawaian" },
      { label: "Analisis Beban Kerja (ABK)", href: "/abk-kes" },
    ],
  },
  {
    label: "Laporan & Analisa", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2",
    items: [
      { label: "Kunjungan & Pelayanan", href: "/laporan" },
      { label: "Farmasi — Stok Minimum", href: "/laporan/farmasi/stok-minimum" },
      { label: "Laporan SIRS 6.3 (RL)", href: "/laporan/sirs", requires: "sirs_view" },
      { label: "Laporan Morbiditas", href: "/laporan" },
      { label: "Indikator BOR/ALOS/BTO", href: "/laporan" },
    ],
  },
  {
    label: "Akreditasi STARKES", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    groups: [
      { title: "Akreditasi", items: [
        { label: "Dashboard Akreditasi", href: "/akreditasi", requires: "akreditasi_view" },
        { label: "Daftar EP (1128/2022)", href: "/akreditasi/ep", requires: "akreditasi_view" },
        { label: "Penilaian Mandiri", href: "/penilaian", requires: "akreditasi_view" },
        { label: "Eviden / Bukti Folder",  href: "/akreditasi/eviden", requires: "akreditasi_view" },
        { label: "PPS (Perbaikan Strategis)", href: "/pps" },
        { label: "HSI (Safety Index)", href: "/hsi" },
      ] },
      { title: "Mutu & Indikator", items: [
        { label: "Generator Dokumen (SK/SPO)", href: "/dokumen-mutu" },
        { label: "Indikator Mutu (INM/IMP)", href: "/mutu" },
        { label: "Insiden Keselamatan (IKP)", href: "/insiden" },
        { label: "PPI (Surveilans & Audit)", href: "/ppi" },
        { label: "SKP (6 Sasaran)", href: "/skp" },
        { label: "Prognas (Program Nasional)", href: "/prognas" },
        { label: "MFK (Fasilitas & Keselamatan)", href: "/mfk" },
        { label: "Fasilitas (Limbah B3 & Pemeliharaan)", href: "/fasilitas" },
        { label: "Manajemen (Kepuasan/Orientasi/Vendor)", href: "/manajemen-mutu" },
        { label: "Skoring Prioritas (HR/HV/PP)", href: "/mutu-prioritas" },
        { label: "Evaluasi Pendaftaran (AKP)", href: "/evaluasi-pendaftaran", requires: "evaluasi_pendaftaran_view" },
        { label: "Kendala Pendaftaran (Laporan)", href: "/kendala-pendaftaran", requires: "evaluasi_pendaftaran_view" },
        { label: "Pengelolaan Alur Pasien (AKP)", href: "/alur-pasien" },
        { label: "Info Terintegrasi Berkala (AKP)", href: "/info-terintegrasi" },
        { label: "Serah Terima Resume Pulang (AKP)", href: "/resume-serah-terima" },
        { label: "Rekap Pasien Pulang APS (AKP)", href: "/aps-rekap" },
        { label: "Waktu Tunggu Lab (PP 3)", href: "/waktu-tunggu-lab" },
        { label: "Laporan Jam Visit Dokter", href: "/jam-visit-dokter" },
        { label: "Rekap Risiko Jatuh", href: "/risiko-jatuh" },
        { label: "Kepatuhan Clinical Pathway", href: "/kepatuhan-cp" },
        { label: "Audit Edukasi Terintegrasi", href: "/audit-edukasi" },
        { label: "Dokumentasi Rapat", href: "/rapat", requires: "rapat_view" },
        { label: "Manajemen Risiko (FMEA)", href: "/manajemen-risiko" },
      ] },
      { title: "Rekam Medis & Audit", items: [
        { label: "KLPCM (Audit RM)",      href: "/klpcm", requires: "klpcm_view" },
        { label: "Pemusnahan RM",         href: "/pemusnahan-rm", requires: "pemusnahan_rm_view" },
        { label: "MRMIK (Register RM)",   href: "/mrmik" },
        { label: "MRMIK — Keamanan Fisik RM", href: "/mrmik/keamanan-fisik" },
        { label: "MRMIK 2 — Laporan Integrasi Data", href: "/mrmik/integrasi" },
        { label: "IKP — Laporan Evaluasi Insiden", href: "/mrmik/ikp" },
        { label: "Keamanan Jaringan & Anti-Malware", href: "/keamanan-jaringan" },
        { label: "Self Security Assessment (Kredensialing)", href: "/security-assessment", requires: "ssa_view" },
        { label: "KPS (Kredensial & Diklat)", href: "/kps" },
      ] },
      { title: "IT / SIMRS", items: [
        { label: "Downtime SIMRS",        href: "/downtime", requires: "downtime_view" },
        { label: "Lapor IT / Helpdesk",   href: "/lapor-it" },
        { label: "Permintaan Fitur SIMRS", href: "/permintaan-fitur" },
        { label: "Kinerja IT", href: "/kinerja-it" },
        { label: "Monev SIMRS (WBK)",     href: "/monev", requires: "monev_view" },
      ] },
    ],
  },
  {
    label: "Pengaturan Sistem", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066",
    items: [
      { label: "Master Data", href: "/pengaturan" },
      { label: "User & Hak Akses", href: "/pengaturan" },
      { label: "Setting Rumah Sakit", href: "/pengaturan" },
    ],
  },
];

// Menu bisa berupa daftar datar (`items`) atau dikelompokkan (`groups`).
function allItems(sec: any): any[] {
  return sec.groups ? sec.groups.flatMap((g: any) => g.items) : (sec.items ?? []);
}
function menuGroups(sec: any): any[] {
  return sec.groups ? sec.groups : [{ title: null, items: sec.items ?? [] }];
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]         = useState<{ nama: string; kode: string } | null>(null);
  const [setting, setSetting]   = useState<SettingRS | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSection, setOpenSection]   = useState<string | null>(null);
  const [openTopMenu, setOpenTopMenu]   = useState<string | null>(null);
  const topMenuRef = useRef<HTMLDivElement>(null);

  // Tutup dropdown top menu saat klik di luar
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (topMenuRef.current && !topMenuRef.current.contains(e.target as Node)) {
        setOpenTopMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.replace("/login"); return; }
    setUser({ nama: s.nama, kode: s.kode });
  }, [router]);

  useEffect(() => {
    getSetting().then(r => setSetting(r.data)).catch(() => {});
  }, []);

  // Auto-open section matching current path
  useEffect(() => {
    for (const sec of SIDEBAR_MENU) {
      if (allItems(sec).some((i: any) => pathname.startsWith(i.href))) {
        setOpenSection(sec.label);
        break;
      }
    }
  }, [pathname]);

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  if (!user) return null;

  const namaRS = setting?.nama_instansi || "Rumah Sakit";
  const kabupaten = setting?.kabupaten ? `DINAS KESEHATAN ${setting.kabupaten.toUpperCase()}` : "";

  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden print:h-auto print:overflow-visible print:block">
      {/* ── Navbar dua baris ── */}
      <div className="bg-green-800 text-white shrink-0 print:hidden">

        {/* Baris 1: Top menu bar */}
        <div className="flex items-stretch h-9 border-b border-green-900" ref={topMenuRef}>
          {/* RS name */}
          <div className="flex items-center gap-2 px-3 border-r border-green-700 shrink-0">
            <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="hidden sm:block leading-tight">
              {kabupaten && <div className="text-[8px] text-green-400 leading-none">{kabupaten}</div>}
              <div className="text-[11px] font-bold leading-tight">{namaRS}</div>
            </div>
          </div>

          {/* Dropdown menu items */}
          <div className="flex items-stretch flex-1 justify-center">
            {TOP_MENU.map((menu) => (
              <div key={menu.label} className="relative">
                <button
                  onClick={() => setOpenTopMenu(openTopMenu === menu.label ? null : menu.label)}
                  className={`flex items-center gap-1.5 px-3 h-full text-xs font-medium transition-colors border-r border-green-700/50
                    ${openTopMenu === menu.label ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-700 hover:text-white"}`}>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menu.icon} />
                  </svg>
                  <span className="hidden sm:inline">{menu.label}</span>
                  <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openTopMenu === menu.label && (() => {
                  const grps = menuGroups(menu)
                    .map((g: any) => ({ ...g, items: g.items.filter((it: any) => !it.requires || hasPerm(it.requires)) }))
                    .filter((g: any) => g.items.length > 0);
                  const grouped = (menu as any).groups && grps.length > 1;
                  const linkOf = (item: any) => (
                    <Link key={item.label} href={item.href}
                      onClick={() => setOpenTopMenu(null)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-green-50 hover:text-green-700 transition-colors">
                      <span className="w-1 h-1 rounded-full bg-green-500 shrink-0" />
                      {item.label}
                    </Link>
                  );
                  return (
                    <div className={`absolute top-full left-0 z-50 bg-white text-slate-700 shadow-xl rounded-b-lg border border-slate-200 max-h-[80vh] overflow-y-auto ${grouped ? "p-3" : "min-w-[200px] py-1"}`}>
                      {grouped ? (
                        <div className="flex flex-wrap gap-x-6 gap-y-3 max-w-[760px]">
                          {grps.map((g: any) => (
                            <div key={g.title} className="min-w-[180px]">
                              <div className="px-2 pb-1 mb-1 text-[10px] font-bold uppercase tracking-wide text-green-700 border-b border-slate-100">{g.title}</div>
                              {g.items.map(linkOf)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        grps[0]?.items.map(linkOf)
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>

          {/* Tombol Direktur (Executive View) */}
          <Link href="/direktur"
            className="flex items-center gap-1.5 px-3 h-full text-xs font-bold text-white
              hover:bg-green-700 transition-colors border-l border-green-700/50 shrink-0
              bg-green-700/30">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 21v-2a4 4 0 014-4h10a4 4 0 014 4v2M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="hidden sm:inline">Direktur</span>
          </Link>

          {/* Tombol Anjungan */}
          <a href="/anjungan" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 h-full text-xs font-medium text-green-200
              hover:bg-green-700 hover:text-white transition-colors border-l border-green-700/50 shrink-0">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">Anjungan</span>
          </a>

          {/* User + logout */}
          <div className="flex items-center gap-3 px-3 shrink-0 border-l border-green-700">
            <div className="flex items-center gap-1.5 text-green-200">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs hidden sm:inline">{user.nama}</span>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-green-200 hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-xs hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>

        {/* Baris 2: Shortcuts icons */}
        <div className="flex items-stretch bg-green-700">
          {/* Menu toggle */}
          <button onClick={() => setMenuOpen(v => !v)}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-w-[52px] border-r border-green-600 transition-colors shrink-0
              ${menuOpen ? "bg-white/20 text-white" : "text-green-200 hover:bg-green-600 hover:text-white"}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[9px] font-medium">Menu</span>
          </button>

          {/* Shortcuts */}
          <div className="flex-1 overflow-x-auto">
            <div className="flex items-stretch justify-center min-w-max h-full">
              {NAV_SHORTCUTS.map((item) => {
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-w-[64px] text-center border-b-2 transition-colors
                      ${active
                        ? "border-b-white bg-white/20 text-white"
                        : "border-b-transparent text-green-100 hover:bg-green-600 hover:text-white"}`}>
                    <svg className={`w-5 h-5 ${active ? "text-white" : item.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    <span className="text-[10px] font-medium leading-tight whitespace-nowrap">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 overflow-hidden print:overflow-visible print:block">
        {/* Sidebar */}
        {menuOpen && (
          <aside className="w-60 bg-white border-r border-slate-200 overflow-y-auto shrink-0 print:hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Menu</span>
              <button onClick={() => setMenuOpen(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
            <div className="p-2">
              {SIDEBAR_MENU.map((sec) => {
                const isOpen = openSection === sec.label;
                const hasActive = allItems(sec).some((i: any) => pathname.startsWith(i.href));
                return (
                  <div key={sec.label} className="mb-0.5">
                    <button
                      onClick={() => setOpenSection(isOpen ? null : sec.label)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-medium transition-colors
                        ${hasActive ? "bg-green-50 text-green-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"}`}>
                      <svg className={`w-3.5 h-3.5 shrink-0 ${hasActive ? "text-green-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sec.icon} />
                      </svg>
                      <span className="flex-1 leading-tight">{sec.label}</span>
                      <svg className={`w-3 h-3 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="ml-4 mt-0.5 border-l border-slate-100 pl-2 space-y-0.5">
                        {menuGroups(sec).map((g: any, gi: number) => {
                          const its = g.items.filter((item: any) => !item.requires || hasPerm(item.requires));
                          if (its.length === 0) return null;
                          return (
                            <div key={g.title ?? gi} className="mb-1">
                              {g.title && <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{g.title}</div>}
                              {its.map((item: any) => {
                                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                                return (
                                  <Link key={item.label} href={item.href}
                                    className={`block px-2 py-1.5 rounded text-xs transition-colors
                                      ${active ? "bg-green-100 text-green-700 font-medium" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}>
                                    {item.label}
                                  </Link>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* Content */}
        <main className="flex-1 overflow-auto print:overflow-visible print:h-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
