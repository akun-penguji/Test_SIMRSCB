"use client";

// Catatan Keperawatan (CPPT keperawatan) per pasien — dibuka dari IGD/Rawat Jalan/Rawat Inap.
// Query: ?no_rawat=...&jenis=ralan|ranap

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import MicButton from "@/components/MicButton";
import { ckList, ckCreate, ckUpdate, ckHapus, ckCetak, CatatanKeperawatan, CkCetak } from "@/lib/api";

export default function CatatanKeperawatanPage() {
  const [noRawat, setNoRawat] = useState("");
  const [jenis, setJenis] = useState("ralan");
  const [header, setHeader] = useState<CkCetak | null>(null);
  const [rows, setRows] = useState<CatatanKeperawatan[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [editKey, setEditKey] = useState<{ tanggal: string; jam: string } | null>(null);
  const [f, setF] = useState({ tanggal: "", jam: "", td: "", nadi: "", rr: "", suhu: "", spo2: "", uraian: "" });
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setNoRawat(p.get("no_rawat") || "");
    setJenis(p.get("jenis") === "ranap" ? "ranap" : "ralan");
  }, []);

  const load = useCallback(() => {
    if (!noRawat) return;
    ckList(jenis, noRawat).then(r => setRows(r.data)).catch(() => setRows([]));
    ckCetak(jenis, noRawat).then(r => setHeader(r.data)).catch(() => {});
  }, [jenis, noRawat, reload]);
  useEffect(() => { load(); }, [load]);

  function resetForm() {
    const d = new Date(); const p = (n: number) => String(n).padStart(2, "0");
    setF({ tanggal: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, jam: `${p(d.getHours())}:${p(d.getMinutes())}`, td: "", nadi: "", rr: "", suhu: "", spo2: "", uraian: "" });
    setEditKey(null); setErr("");
  }
  function startEdit(r: CatatanKeperawatan) {
    setF({ tanggal: r.tanggal ?? "", jam: (r.jam ?? "").slice(0, 5), td: r.td ?? "", nadi: r.nadi ?? "", rr: r.rr ?? "", suhu: r.suhu ?? "", spo2: r.spo2 ?? "", uraian: r.uraian ?? "" });
    setEditKey({ tanggal: r.tanggal ?? "", jam: r.jam ?? "" }); setErr(""); setOpen(true);
  }
  async function simpan() {
    setSaving(true); setErr("");
    try {
      const jamFull = f.jam.length === 5 ? f.jam + ":00" : f.jam;
      if (editKey) await ckUpdate({ jenis, no_rawat: noRawat, tanggal: f.tanggal, jam: jamFull, td: f.td, nadi: f.nadi, rr: f.rr, suhu: f.suhu, spo2: f.spo2, uraian: f.uraian, orig_tanggal: editKey.tanggal, orig_jam: editKey.jam });
      else await ckCreate({ jenis, no_rawat: noRawat, tanggal: f.tanggal, jam: jamFull, td: f.td, nadi: f.nadi, rr: f.rr, suhu: f.suhu, spo2: f.spo2, uraian: f.uraian });
      setOpen(false); setEditKey(null); setReload(x => x + 1);
    } catch (e) { setErr((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Gagal menyimpan"); }
    finally { setSaving(false); }
  }
  async function hapus(r: CatatanKeperawatan) {
    if (!confirm("Hapus catatan ini?")) return;
    try { await ckHapus({ jenis, no_rawat: noRawat, tanggal: r.tanggal ?? "", jam: r.jam ?? "" }); setReload(x => x + 1); }
    catch (e) { alert((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Gagal menghapus"); }
  }
  function cetak() { window.open(`/cetak-keperawatan?jenis=${jenis}&no_rawat=${encodeURIComponent(noRawat)}`, "_blank"); }

  const pas = header?.pasien;
  return (
    <div className="p-3 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-800">📝 Catatan Keperawatan {jenis === "ranap" ? "Rawat Inap" : "Rawat Jalan / IGD"}</h1>
          <div className="text-xs text-slate-500 mt-0.5">
            {pas ? <>{pas.nama} · RM {pas.no_rkm_medis} · {pas.umur} {pas.jk}</> : "No. Rawat: "}<span className="font-mono">{noRawat}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={cetak} className="text-sm bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg px-3 py-1.5">🖨️ Cetak</button>
        </div>
      </div>

      {!noRawat && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">Buka halaman ini dari daftar pasien IGD / Rawat Jalan / Rawat Inap (klik "Catatan Kep.").</div>}

      {noRawat && (open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5 max-w-3xl">
          <div className="text-sm font-bold text-slate-800">{editKey ? "Ubah" : "Tambah"} Catatan Keperawatan</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500 block">Tanggal<input type="date" value={f.tanggal} onChange={e => set("tanggal", e.target.value)} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-slate-500 block">Jam<input type="time" value={f.jam} onChange={e => set("jam", e.target.value)} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" /></label>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {([["td", "TD"], ["nadi", "Nadi"], ["rr", "RR"], ["suhu", "Suhu"], ["spo2", "SpO2"]] as const).map(([k, l]) => (
              <label key={k} className="text-xs text-slate-500 block">{l}<input value={f[k]} onChange={e => set(k, e.target.value)} placeholder={k === "td" ? "120/80" : ""} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" /></label>
            ))}
          </div>
          <label className="text-xs text-slate-500 block">Uraian / Tindakan Keperawatan
            <div className="relative mt-0.5"><textarea value={f.uraian} onChange={e => set("uraian", e.target.value)} rows={3} className="block w-full border border-slate-300 rounded-lg px-2 py-1.5 pr-8 text-sm" /><MicButton value={f.uraian} onChange={v => set("uraian", v)} className="absolute right-1.5 bottom-1.5" /></div>
          </label>
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving} className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2">{saving ? "Menyimpan…" : "Simpan"}</button>
            <button onClick={() => { setOpen(false); setEditKey(null); setErr(""); }} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { resetForm(); setOpen(true); }} className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm">+ Catatan Keperawatan</button>
      ))}

      {noRawat && (rows === null ? <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
        : rows.length === 0 ? <div className="text-center text-slate-400 text-sm py-6">Belum ada catatan keperawatan.</div>
        : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs"><tr>
                <th className="px-2 py-2 text-left">Tgl/Jam</th><th className="px-2 py-2 text-left">TD</th><th className="px-2 py-2 text-left">N</th><th className="px-2 py-2 text-left">RR</th><th className="px-2 py-2 text-left">S</th><th className="px-2 py-2 text-left">SpO2</th><th className="px-2 py-2 text-left">Uraian</th><th className="px-2 py-2 text-left">Petugas</th><th className="px-2 py-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 align-top">
                    <td className="px-2 py-2 whitespace-nowrap text-xs">{r.tanggal}<br />{(r.jam ?? "").slice(0, 5)}</td>
                    <td className="px-2 py-2 text-xs">{r.td || "-"}</td><td className="px-2 py-2 text-xs">{r.nadi || "-"}</td><td className="px-2 py-2 text-xs">{r.rr || "-"}</td><td className="px-2 py-2 text-xs">{r.suhu || "-"}</td><td className="px-2 py-2 text-xs">{r.spo2 || "-"}</td>
                    <td className="px-2 py-2 text-xs max-w-[360px] whitespace-pre-wrap">{r.uraian || "-"}</td>
                    <td className="px-2 py-2 text-[11px] text-rose-600">{r.petugas || "-"}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">{r.milik === 1 && <><button onClick={() => startEdit(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      <div><Link href={jenis === "ranap" ? "/rawat-inap" : "/rawat-jalan"} className="text-xs text-indigo-600 hover:underline">← Kembali ke daftar pasien</Link></div>
    </div>
  );
}
