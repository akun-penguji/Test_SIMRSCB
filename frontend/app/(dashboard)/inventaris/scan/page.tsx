"use client";

// Scan / Cari Barcode — cocok untuk scanner USB (keyboard-wedge) maupun ketik manual.
// Enter → cari aset. Jika 1 hasil dgn barcode persis, langsung buka detailnya.

import { useEffect, useRef, useState } from "react";
import InventarisNav from "@/app/(dashboard)/inventaris/InventarisNav";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getInventaris, Inventaris } from "@/lib/api";

export default function ScanPage() {
  const router = useRouter();
  const inp = useRef<HTMLInputElement>(null);
  const [kode, setKode] = useState("");
  const [hasil, setHasil] = useState<Inventaris[] | null>(null);
  const [cari, setCari] = useState(false);

  useEffect(() => { inp.current?.focus(); }, []);

  async function scan() {
    const k = kode.trim();
    if (!k) return;
    setCari(true); setHasil(null);
    try {
      const r = await getInventaris({ q: k });
      const exact = r.data.find(x => x.barcode && x.barcode.toLowerCase() === k.toLowerCase());
      if (exact) { router.push(`/inventaris/${exact.id}`); return; }
      if (r.data.length === 1) { router.push(`/inventaris/${r.data[0].id}`); return; }
      setHasil(r.data);
    } catch { setHasil([]); }
    finally { setCari(false); }
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <InventarisNav />
      <div>
        <h1 className="text-xl font-bold text-slate-800">Scan Barcode Aset</h1>
        <p className="text-sm text-slate-500">Arahkan scanner ke barcode alat, atau ketik kode lalu tekan Enter.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex gap-3">
          <input ref={inp} value={kode} autoFocus
            onChange={e => setKode(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") scan(); }}
            placeholder="Scan / ketik barcode…"
            className="flex-1 px-4 py-3 text-lg font-mono border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500" />
          <button onClick={scan} disabled={cari}
            className="px-5 py-3 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-50 rounded-xl">
            {cari ? "Mencari…" : "Cari"}
          </button>
        </div>
      </div>

      {hasil && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {hasil.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400">Tidak ada aset dengan kode itu.</div>
          ) : (
            <>
              <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">{hasil.length} hasil — pilih satu:</div>
              <ul className="divide-y divide-slate-100">
                {hasil.map(r => (
                  <li key={r.id}>
                    <Link href={`/inventaris/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                      {r.foto
                        ? <img src={r.foto} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                        : <div className="w-10 h-10 rounded-lg bg-slate-100" />}
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{r.nama_alat}</div>
                        <div className="text-xs text-slate-400 font-mono">{r.barcode || "-"} · {r.ruangan || "-"}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
