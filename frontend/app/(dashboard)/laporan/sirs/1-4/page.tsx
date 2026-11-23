"use client";
import MicButton from "@/components/MicButton";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  getSirsRl14, editSirsRl14Meta,
  createSirsRl14Inv, updateSirsRl14Inv, deleteSirsRl14Inv,
  cetakSirsRl14,
  Rl14Meta, Rl14Inventaris,
} from "@/lib/api";

const EMPTY_INV: Rl14Inventaris = {
  kategori: "", nama_item: "", jumlah: 0,
  jml_baik: 0, jml_rusak_ringan: 0, jml_rusak_berat: 0,
  satuan: "unit", catatan: "",
};

export default function Rl14Page() {
  const [meta, setMeta] = useState<Rl14Meta | null>(null);
  const [inv, setInv]   = useState<Rl14Inventaris[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [invForm, setInvForm] = useState<Rl14Inventaris>(EMPTY_INV);
  const [invEditId, setInvEditId] = useState<number | null>(null);

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    getSirsRl14().then(r => {
      setMeta(r.data.meta);
      setInv(r.data.inventaris);
    }).catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const updateMeta = <K extends keyof Rl14Meta>(k: K, v: Rl14Meta[K]) =>
    setMeta(m => ({ ...(m || {}), [k]: v }));

  const handleSaveMeta = async () => {
    setSaving(true); setErrMsg("");
    try {
      await editSirsRl14Meta(meta || {});
      setOkMsg("Metadata tersimpan");
      setTimeout(() => setOkMsg(""), 2500);
      reload();
    } catch { setErrMsg("Gagal simpan meta"); }
    finally { setSaving(false); }
  };

  const invReset = () => { setInvForm(EMPTY_INV); setInvEditId(null); };
  const invLoadEdit = (it: Rl14Inventaris) => {
    setInvForm({ ...EMPTY_INV, ...it });
    setInvEditId(it.id || null);
  };
  const invSave = async () => {
    if (!invForm.kategori.trim() || !invForm.nama_item.trim()) {
      setErrMsg("Kategori & nama item wajib"); return;
    }
    if (invForm.jml_baik + invForm.jml_rusak_ringan + invForm.jml_rusak_berat > invForm.jumlah) {
      setErrMsg("Total baik+rusak melebihi jumlah"); return;
    }
    try {
      if (invEditId) await updateSirsRl14Inv(invEditId, invForm);
      else await createSirsRl14Inv(invForm);
      invReset();
      reload();
      setOkMsg("Item tersimpan");
      setTimeout(() => setOkMsg(""), 2500);
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : "Gagal simpan item");
    }
  };
  const invDel = async (id: number) => {
    if (!confirm("Hapus item ini?")) return;
    try { await deleteSirsRl14Inv(id); reload(); }
    catch { setErrMsg("Gagal hapus"); }
  };

  const handleCetak = async () => {
    try { await cetakSirsRl14(); }
    catch { setErrMsg("Gagal membuka pratinjau cetak"); }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Rl14Inventaris[]>();
    for (const it of inv) {
      const cur = map.get(it.kategori);
      if (cur) cur.push(it); else map.set(it.kategori, [it]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [inv]);

  const totals = useMemo(() => {
    const sum = inv.reduce((acc, it) => ({
      jumlah: acc.jumlah + it.jumlah,
      baik: acc.baik + it.jml_baik,
      rusak: acc.rusak + it.jml_rusak_ringan + it.jml_rusak_berat,
    }), { jumlah: 0, baik: 0, rusak: 0 });
    return sum;
  }, [inv]);

  if (loading) return <div className="p-6 text-center text-slate-400 text-sm">Memuat...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <Link href="/laporan/sirs" className="text-xs text-slate-500 hover:text-green-700">
          ← Laporan SIRS 6.3
        </Link>
        <div className="flex items-start gap-3 mt-2">
          <span className="font-mono text-lg font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded">
            RL 1.4
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800 leading-tight">Sarana Prasarana dan Alat Kesehatan</h1>
            <p className="text-xs text-slate-500 mt-1">
              RL 1 · Pelaporan via <span className="font-medium">ASPAK eksternal</span>
            </p>
          </div>
          <button onClick={handleCetak}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Cetak
          </button>
        </div>
      </div>

      {errMsg && <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm">{errMsg}</div>}
      {okMsg  && <div className="mb-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-green-800 text-sm">{okMsg}</div>}

      {/* ASPAK link box */}
      <div className="bg-amber-50 border-2 border-dashed border-amber-400 rounded-2xl p-5 mb-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl">🔗</span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-amber-900">Pelaporan via ASPAK</h2>
            <p className="text-sm text-amber-800 mt-1">
              Per JUKNIS SIRS 6.3, data Sarana, Prasarana, dan Alat Kesehatan dilaporkan melalui aplikasi
              <strong> ASPAK</strong> (Aplikasi Sarana, Prasarana, dan Alat Kesehatan).
            </p>
            <a href={meta?.aspak_url || "https://aspak.kemkes.go.id/aplikasi/"}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium">
              Buka ASPAK →
            </a>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="% Pemenuhan ASPAK"
          value={meta?.persen_pemenuhan != null ? `${meta.persen_pemenuhan.toFixed(2)}%` : "-"}
          color={meta?.persen_pemenuhan != null && meta.persen_pemenuhan >= 60 ? "text-emerald-700" : "text-amber-700"}
          hint="Min. 60% per akreditasi" />
        <Stat label="Total Alkes (ASPAK)" value={meta?.total_alkes != null ? String(meta.total_alkes) : "-"} color="text-blue-700" />
        <Stat label="Terkalibrasi" value={meta?.total_terkalibrasi != null ? String(meta.total_terkalibrasi) : "-"} color="text-indigo-700" />
        <Stat label="Inventaris Lokal" value={`${totals.jumlah} (${totals.baik} baik)`} color="text-slate-700" />
      </div>

      {/* Meta form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3">PIC & Sync ASPAK</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          <Field label="Nama PIC">
            <input value={meta?.pic_nama ?? ""} onChange={(e) => updateMeta("pic_nama", e.target.value)} className="inp" />
          </Field>
          <Field label="NIK PIC">
            <input value={meta?.pic_nik ?? ""} onChange={(e) => updateMeta("pic_nik", e.target.value)} className="inp" />
          </Field>
          <Field label="Email PIC">
            <input type="email" value={meta?.pic_email ?? ""} onChange={(e) => updateMeta("pic_email", e.target.value)} className="inp" />
          </Field>
          <Field label="Telp/WA PIC">
            <input value={meta?.pic_telp ?? ""} onChange={(e) => updateMeta("pic_telp", e.target.value)} className="inp" />
          </Field>
          <Field label="Jabatan PIC" span>
            <input value={meta?.pic_jabatan ?? ""} onChange={(e) => updateMeta("pic_jabatan", e.target.value)} className="inp" />
          </Field>
          <Field label="URL ASPAK">
            <input value={meta?.aspak_url ?? ""} onChange={(e) => updateMeta("aspak_url", e.target.value)} className="inp" />
          </Field>
          <Field label="Terakhir Sync ke ASPAK">
            <input type="date" value={meta?.terakhir_sync ?? ""} onChange={(e) => updateMeta("terakhir_sync", e.target.value)} className="inp" />
          </Field>
          <Field label="% Pemenuhan (0-100)">
            <input type="number" step="0.01" min={0} max={100}
              value={meta?.persen_pemenuhan ?? ""}
              onChange={(e) => updateMeta("persen_pemenuhan", e.target.value === "" ? null : parseFloat(e.target.value))}
              className="inp" />
          </Field>
          <Field label="Total Alkes (di ASPAK)">
            <input type="number" min={0} value={meta?.total_alkes ?? ""}
              onChange={(e) => updateMeta("total_alkes", e.target.value === "" ? null : parseInt(e.target.value, 10))}
              className="inp" />
          </Field>
          <Field label="Total Terkalibrasi">
            <input type="number" min={0} value={meta?.total_terkalibrasi ?? ""}
              onChange={(e) => updateMeta("total_terkalibrasi", e.target.value === "" ? null : parseInt(e.target.value, 10))}
              className="inp" />
          </Field>
          <Field label="Catatan" span>
            <div className="relative">
              <textarea rows={2} value={meta?.catatan ?? ""}
                onChange={(e) => updateMeta("catatan", e.target.value)} className="inp pr-8" />
              <MicButton value={meta?.catatan ?? ""} onChange={v => updateMeta("catatan", v)} className="absolute right-1.5 bottom-1.5" />
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-3 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-400 flex-1">
            {meta?.updated_at && `Terakhir diubah ${meta.updated_at}${meta.updated_by ? ` oleh ${meta.updated_by}` : ""}`}
          </p>
          <button onClick={handleSaveMeta} disabled={saving}
            className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 text-white text-sm font-medium">
            {saving ? "Menyimpan..." : "Simpan Metadata"}
          </button>
        </div>
      </div>

      {/* Inventaris ringkas */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <h3 className="text-sm font-bold text-slate-800 mb-1">Inventaris Ringkas (Monitoring Internal)</h3>
        <p className="text-[11px] text-slate-400 mb-3">
          Catatan: tabel ini hanya untuk monitoring internal RS. Pelaporan resmi tetap via ASPAK.
        </p>

        {/* Form add/edit */}
        <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-slate-700 mb-3">
            {invEditId ? `✏️ Edit item #${invEditId}` : "➕ Tambah item baru"}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
            <Field label="Kategori">
              <input value={invForm.kategori}
                onChange={(e) => setInvForm(f => ({ ...f, kategori: e.target.value }))}
                placeholder="mis. Alkes IGD, Prasarana" className="inp" />
            </Field>
            <Field label="Nama Item" span>
              <input value={invForm.nama_item}
                onChange={(e) => setInvForm(f => ({ ...f, nama_item: e.target.value }))}
                placeholder="mis. Defibrilator" className="inp" />
            </Field>
            <Field label="Jumlah">
              <input type="number" min={0} value={invForm.jumlah}
                onChange={(e) => setInvForm(f => ({ ...f, jumlah: parseInt(e.target.value || "0", 10) }))}
                className="inp" />
            </Field>
            <Field label="Baik">
              <input type="number" min={0} value={invForm.jml_baik}
                onChange={(e) => setInvForm(f => ({ ...f, jml_baik: parseInt(e.target.value || "0", 10) }))}
                className="inp" />
            </Field>
            <Field label="Rusak Ringan">
              <input type="number" min={0} value={invForm.jml_rusak_ringan}
                onChange={(e) => setInvForm(f => ({ ...f, jml_rusak_ringan: parseInt(e.target.value || "0", 10) }))}
                className="inp" />
            </Field>
            <Field label="Rusak Berat">
              <input type="number" min={0} value={invForm.jml_rusak_berat}
                onChange={(e) => setInvForm(f => ({ ...f, jml_rusak_berat: parseInt(e.target.value || "0", 10) }))}
                className="inp" />
            </Field>
            <Field label="Satuan">
              <input value={invForm.satuan ?? ""}
                onChange={(e) => setInvForm(f => ({ ...f, satuan: e.target.value }))}
                placeholder="unit" className="inp" />
            </Field>
            <Field label="Catatan" span>
              <input value={invForm.catatan ?? ""}
                onChange={(e) => setInvForm(f => ({ ...f, catatan: e.target.value }))}
                className="inp" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            {invEditId && (
              <button onClick={invReset}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm text-slate-700">Batal</button>
            )}
            <button onClick={invSave}
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium">
              {invEditId ? "Update" : "Tambah"}
            </button>
          </div>
        </div>

        {/* List per kategori */}
        <div className="space-y-3">
          {grouped.length === 0 ? (
            <p className="text-center text-slate-400 text-sm italic py-4">Belum ada inventaris.</p>
          ) : grouped.map(([kat, items]) => (
            <details key={kat} className="border border-slate-200 rounded-xl overflow-hidden" open>
              <summary className="cursor-pointer px-4 py-2 bg-slate-50 font-semibold text-sm text-slate-800 hover:bg-slate-100">
                {kat} ({items.length} item)
              </summary>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase">
                  <tr>
                    <th className="text-left p-2 border-b">Nama Item</th>
                    <th className="text-right p-2 border-b">Jumlah</th>
                    <th className="text-right p-2 border-b">Baik</th>
                    <th className="text-right p-2 border-b">Rusak (R/B)</th>
                    <th className="text-left p-2 border-b">Catatan</th>
                    <th className="p-2 border-b"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id} className="hover:bg-slate-50">
                      <td className="p-2 border-b text-slate-900">{it.nama_item}</td>
                      <td className="p-2 border-b text-right tabular-nums">{it.jumlah} {it.satuan}</td>
                      <td className="p-2 border-b text-right tabular-nums text-emerald-700">{it.jml_baik}</td>
                      <td className="p-2 border-b text-right tabular-nums text-amber-700">
                        {it.jml_rusak_ringan} / {it.jml_rusak_berat}
                      </td>
                      <td className="p-2 border-b text-slate-600">{it.catatan || "-"}</td>
                      <td className="p-2 border-b text-right whitespace-nowrap">
                        <button onClick={() => invLoadEdit(it)}
                          className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 mr-1">Edit</button>
                        <button onClick={() => it.id && invDel(it.id)}
                          className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      </div>

      <style jsx>{`
        :global(.inp) {
          width: 100%;
          border: 1px solid rgb(226 232 240);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: rgb(15 23 42);
          background: white;
        }
        :global(.inp:focus) { outline: none; border-color: rgb(16 185 129); box-shadow: 0 0 0 1px rgb(16 185 129); }
      `}</style>
    </div>
  );
}

function Field({ label, children, span = false }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? "md:col-span-2" : ""}>
      <label className="text-xs text-slate-600 font-semibold block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}
