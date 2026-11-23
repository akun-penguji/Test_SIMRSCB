"use client";

// Daftar Singkatan, Simbol & Kode dalam Rekam Medis (read-only).
// Sumber: master_singkatan_rscb (SK Direktur No.400.7.31/112/RSUD-CB/2026).

import { useCallback, useEffect, useState } from "react";
import { listSingkatan, SingkatanRow } from "@/lib/api";

const KATEGORI = ["Semua", "Diperbolehkan", "Dilarang", "Simbol"];

export default function SingkatanPage() {
  const [q, setQ] = useState("");
  const [kategori, setKategori] = useState("Semua");
  const [rows, setRows] = useState<SingkatanRow[]>([]);
  const [loading, setLoading] = useState(false);

  const muat = useCallback(() => {
    setLoading(true);
    listSingkatan({ q, kategori: kategori === "Semua" ? "" : kategori })
      .then(r => setRows(r.data.data)).catch(() => setRows([])).finally(() => setLoading(false));
  }, [q, kategori]);
  useEffect(() => { const t = setTimeout(muat, 250); return () => clearTimeout(t); }, [muat]);

  const inp = "border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm";
  const th = "px-2 py-2 text-xs font-bold text-slate-600 border-b border-slate-200 text-left whitespace-nowrap";
  const td = "px-2 py-1.5 text-sm border-b border-slate-100 align-top";
  const adaDilarang = rows.some(r => r.kategori === "Dilarang");

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-800">📖 Daftar Singkatan & Simbol Rekam Medis</h1>
        <p className="text-xs text-slate-500">SK Direktur No.400.7.31/112/RSUD-CB/2026. Hanya singkatan/simbol terdaftar yang boleh dipakai; baris merah <b>dilarang</b>.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <label className="flex flex-col gap-1 flex-1 min-w-[200px]"><span className="text-[11px] font-semibold text-slate-500">Cari singkatan / keterangan</span>
          <input value={q} onChange={e => setQ(e.target.value)} className={inp} placeholder="mis. TTV, DPJP, subkutan…" autoFocus /></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Kategori</span>
          <select value={kategori} onChange={e => setKategori(e.target.value)} className={inp}>{KATEGORI.map(k => <option key={k}>{k}</option>)}</select></label>
        <div className="ml-auto text-sm text-slate-500 self-center tabular-nums">{rows.length} entri</div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50"><tr>
            <th className={th}>Kategori</th><th className={th}>Singkatan / Simbol</th><th className={th}>Keterangan / Maksud</th>
            {adaDilarang && <><th className={th}>Misinterpretasi</th><th className={th}>Wajib Gunakan</th></>}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={adaDilarang ? 5 : 3} className="text-center text-slate-400 text-sm py-8">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={adaDilarang ? 5 : 3} className="text-center text-slate-400 text-sm py-8">Tidak ada hasil.</td></tr>
            ) : rows.map((r, i) => {
              const dilarang = r.kategori === "Dilarang";
              const simbol = r.kategori === "Simbol";
              return (
                <tr key={i} className={dilarang ? "bg-red-50/70" : simbol ? "bg-sky-50/40" : ""}>
                  <td className={td}>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${dilarang ? "bg-red-100 text-red-700 border-red-300" : simbol ? "bg-sky-100 text-sky-700 border-sky-300" : "bg-emerald-100 text-emerald-700 border-emerald-300"}`}>{r.kategori}</span>
                  </td>
                  <td className={`${td} font-bold ${dilarang ? "text-red-700" : "text-slate-800"}`}>{r.singkatan}</td>
                  <td className={td}>{r.keterangan}</td>
                  {adaDilarang && <>
                    <td className={`${td} text-xs text-slate-500`}>{r.misinterpretasi}</td>
                    <td className={`${td} text-xs ${dilarang ? "text-red-600 font-medium" : "text-slate-500"}`}>{r.wajib_gunakan}</td>
                  </>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">Singkatan tidak boleh dipakai pada: informed consent, resume pulang, edukasi pemulangan, surat rujukan & keterangan medis (tulis lengkap).</p>
    </div>
  );
}
