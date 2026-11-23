"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSirsBotStatus, sirsBotRefreshToken, sirsBotLogin, saveSirsBotConfig, SirsBotStatus } from "@/lib/api";
import { RL_GROUPS, RL_FORMS, formsInGroup } from "@/lib/sirs";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  implemented:            { label: "✓ siap pakai",            cls: "bg-emerald-600 text-white border border-emerald-700 font-semibold" },
  siap:                   { label: "sumber siap",             cls: "bg-green-100 text-green-700 border border-green-200" },
  perlu_field_tambahan:   { label: "perlu field tambahan",    cls: "bg-amber-100 text-amber-700 border border-amber-200" },
  belum_pasti:            { label: "tabel sumber belum pasti", cls: "bg-slate-100 text-slate-600 border border-slate-200" },
};

export default function LaporanSirsLanding() {
  const [botStatus, setBotStatus] = useState<SirsBotStatus['data'] | null>(null);
  const [botLoading, setBotLoading] = useState(false);
  const [botMsg, setBotMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showCredModal, setShowCredModal] = useState(false);
  const [credEmail, setCredEmail] = useState("");
  const [credPass, setCredPass] = useState("");
  const [credKodeRs, setCredKodeRs] = useState("");
  const [credNamaRs, setCredNamaRs] = useState("");

  const loadBotStatus = () => {
    getSirsBotStatus()
      .then(res => setBotStatus(res.data.data))
      .catch(() => setBotStatus(null));
  };

  useEffect(() => {
    loadBotStatus();
  }, []);

  const handleRefresh = async () => {
    setBotLoading(true);
    setBotMsg(null);
    try {
      const res = await sirsBotRefreshToken();
      setBotMsg({ ok: true, text: res.data.message || "Token berhasil diperbarui!" });
      loadBotStatus();
    } catch (err: any) {
      setBotMsg({ ok: false, text: err?.response?.data?.message || err.message || "Gagal refresh token" });
    } finally {
      setBotLoading(false);
    }
  };

  const handleOpenCred = () => {
    setCredEmail(botStatus?.email || "");
    setCredKodeRs(botStatus?.kode_rs || "3216444");
    setCredNamaRs(botStatus?.nama_rs || "RS Umum Daerah Cabangbungin");
    setCredPass("");
    setShowCredModal(true);
  };

  const handleSaveCredentials = async (andLogin: boolean) => {
    setBotLoading(true);
    setBotMsg(null);
    try {
      const payload: Record<string, any> = {
        email: credEmail,
        kode_rs: credKodeRs,
        nama_rs: credNamaRs,
      };
      if (credPass) {
        payload.password = credPass;
      }
      await saveSirsBotConfig(payload);
      if (andLogin) {
        const res = await sirsBotLogin(credEmail, credPass || undefined);
        setBotMsg({ ok: true, text: res.data.message || "Kredensial disimpan & Login SSO Kemenkes berhasil!" });
      } else {
        setBotMsg({ ok: true, text: "Kredensial SSO Kemenkes berhasil diperbarui!" });
      }
      setShowCredModal(false);
      loadBotStatus();
    } catch (err: any) {
      setBotMsg({ ok: false, text: err?.response?.data?.message || err.message || "Gagal menyimpan kredensial" });
    } finally {
      setBotLoading(false);
    }
  };

  const handleLoginSSO = async () => {
    setBotLoading(true);
    setBotMsg(null);
    try {
      const res = await sirsBotLogin();
      setBotMsg({ ok: true, text: res.data.message || "Login SSO Kemenkes berhasil!" });
      loadBotStatus();
    } catch (err: any) {
      setBotMsg({ ok: false, text: err?.response?.data?.message || err.message || "Login SSO gagal" });
    } finally {
      setBotLoading(false);
    }
  };
  const totalImpl = RL_FORMS.filter(f => f.status === "implemented").length;
  const totalSiap = RL_FORMS.filter(f => f.status === "siap").length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Laporan SIRS 6.3</h1>
          <p className="text-sm text-slate-500 mt-1">
            Sistem Informasi Rumah Sakit Revisi 6.3 — JUKNIS Kemenkes 15 November 2024
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Dasar hukum: Permenkes No. 1171 Tahun 2011 tentang Sistem Informasi Rumah Sakit
          </p>
        </div>
        <div className="flex gap-2">
          <div className="bg-emerald-600 text-white rounded-xl p-3 text-right">
            <p className="text-[11px] uppercase tracking-wide opacity-90">Sudah dibuat</p>
            <p className="text-2xl font-bold">{totalImpl} / {RL_FORMS.length}</p>
            <p className="text-[10px] opacity-90">form siap pakai</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Sumber siap</p>
            <p className="text-2xl font-bold text-green-700">{totalSiap}</p>
            <p className="text-[10px] text-slate-400">menunggu dibangun</p>
          </div>
        </div>
      </div>

      {/* Info 2 sistem pelaporan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-700 uppercase">RS Online</p>
          <p className="text-sm text-slate-700 mt-1">
            Update setiap saat saat ada perubahan data. <span className="font-semibold">RL 1 + RL 2</span> (5 formulir).
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-emerald-700 uppercase">SIRS Online</p>
          <p className="text-sm text-slate-700 mt-1">
            Periodik — bulanan (deadline tgl 10) / tahunan (deadline 31 Mar). <span className="font-semibold">RL 3, 4, 5</span> (25 formulir).
          </p>
        </div>
      </div>

      {/* Card Status MedSync SIRS 6.3 Bot Engine */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="text-sm font-bold text-slate-800">MedSync SIRS 6.3 Bot Engine</h3>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Native Rust</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Otomasi pengiriman bridging langsung ke endpoint resmi SIRS Online Kemenkes RI (<code className="font-mono text-slate-600">/apisirs6v2</code>).
            </p>
            {botStatus && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
                <div>RS: <span className="font-semibold text-slate-800">{botStatus.nama_rs || "RSUD Cabangbungin"}</span></div>
                <div>Kode RS: <span className="font-mono font-medium">{botStatus.kode_rs || "3216444"}</span></div>
                <div>Status Token: {botStatus.has_token ? <span className="text-emerald-700 font-semibold">Aktif ({botStatus.token_preview})</span> : <span className="text-amber-700 font-semibold">Belum login</span>}</div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleOpenCred}
              disabled={botLoading}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <span>⚙</span>
              <span>Kredensial SSO</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={botLoading}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-50 transition-colors"
            >
              {botLoading ? "Memproses..." : "Perbarui Token"}
            </button>
            <button
              onClick={handleLoginSSO}
              disabled={botLoading}
              className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              {botLoading ? "Menghubungkan..." : "Login SSO Kemenkes"}
            </button>
          </div>
        </div>
        {botMsg && (
          <div className={`mt-3 p-2.5 rounded-lg text-xs font-medium border ${botMsg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            {botMsg.text}
          </div>
        )}
      </div>

      {/* 5 grup RL — list lengkap sub-formulir di tiap grup */}
      <div className="space-y-6">
        {RL_GROUPS.map(g => {
          const forms = formsInGroup(g.key);
          return (
            <div key={g.key} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className={`bg-gradient-to-r ${g.color} text-white p-4 flex items-start justify-between gap-3`}>
                <div>
                  <p className="text-xs uppercase tracking-widest opacity-90">{g.system}</p>
                  <h2 className="text-lg font-bold mt-0.5">{g.key} — {g.title}</h2>
                  <p className="text-xs mt-1 opacity-95">{g.deskripsi}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold">{forms.length}</p>
                  <p className="text-[10px] uppercase opacity-90">formulir</p>
                </div>
              </div>

              <ul className="divide-y divide-slate-100">
                {forms.map(f => (
                  <li key={f.kode}>
                    <Link href={`/laporan/sirs/${f.kode}`}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 transition">
                      <span className="font-mono font-bold text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded min-w-[58px] text-center">
                        {f.display}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 truncate font-medium">{f.judul}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {f.periode} · Sumber: <span className="font-mono">{f.sumber}</span>
                        </p>
                      </div>
                      <span className={`text-[11px] px-2 py-1 rounded-lg whitespace-nowrap ${STATUS_BADGE[f.status]?.cls || "bg-slate-100 text-slate-500"}`}>
                        {STATUS_BADGE[f.status]?.label || f.status}
                      </span>
                      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-[11px] text-slate-400 text-center">
        ⚠️ Semua formulir masih kerangka (dummy). Implementasi query SQL & format export akan dikerjakan satu per satu.
      </p>
    </div>
  );
}
