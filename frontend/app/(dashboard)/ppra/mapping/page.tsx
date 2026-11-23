"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ppraMapList, ppraMapUpsert, ppraMapDelete, ppraDatabarangCari, ppraAtcList, ppraValidasi,
  PpraMap, PpraAtc, PpraBarang, PpraValidasi, AdmRoute, DddSatuan,
} from "@/lib/api";

export default function PpraMappingPage() {
  const [rows, setRows] = useState<PpraMap[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);
  const [validasi, setValidasi] = useState<PpraValidasi | null>(null);

  // form state
  const [kodeBrng, setKodeBrng] = useState("");
  const [namaBrng, setNamaBrng] = useState("");
  const [atc, setAtc] = useState<PpraAtc | null>(null);
  const [isi, setIsi] = useState(1);
  const [isiSatuan, setIsiSatuan] = useState<DddSatuan>("g");
  const [aktif, setAktif] = useState(true);
  const [isAntibiotik, setIsAntibiotik] = useState(true);
  const [editing, setEditing] = useState(false);

  // autocomplete
  const [cariBarang, setCariBarang] = useState("");
  const [hasilBarang, setHasilBarang] = useState<PpraBarang[]>([]);
  const [atcList, setAtcList] = useState<PpraAtc[]>([]);

  const reload = useCallback(() => {
    setLoading(true);
    ppraMapList(q).then(r => setRows(r.data.data)).catch(() => setRows([])).finally(() => setLoading(false));
    ppraValidasi().then(r => setValidasi(r.data)).catch(() => setValidasi(null));
  }, [q]);
  useEffect(() => { reload(); }, [reload]);

  // autocomplete databarang (debounce sederhana)
  useEffect(() => {
    if (cariBarang.trim().length < 2) { setHasilBarang([]); return; }
    const t = setTimeout(() => {
      ppraDatabarangCari(cariBarang.trim()).then(r => setHasilBarang(r.data.data)).catch(() => setHasilBarang([]));
    }, 250);
    return () => clearTimeout(t);
  }, [cariBarang]);

  const openNew = () => {
    setKodeBrng(""); setNamaBrng(""); setAtc(null); setIsi(1); setIsiSatuan("g");
    setAktif(true); setIsAntibiotik(true); setEditing(false); setCariBarang(""); setHasilBarang([]);
    ppraAtcList("").then(r => setAtcList(r.data.data)).catch(() => setAtcList([]));
    setModalOpen(true);
  };
  const openEdit = (r: PpraMap) => {
    setKodeBrng(r.kode_brng); setNamaBrng(r.nama_brng ?? "");
    setIsi(r.isi_zat_aktif); setIsiSatuan(r.isi_satuan);
    setAktif(r.aktif === 1); setIsAntibiotik(r.is_antibiotik === 1);
    setEditing(true); setCariBarang("");
    ppraAtcList("").then(res => {
      setAtcList(res.data.data);
      setAtc(res.data.data.find(a => a.atc_code === r.atc_code && a.adm_route === r.adm_route) ?? null);
    }).catch(() => setAtcList([]));
    setModalOpen(true);
  };

  const pilihBarang = (b: PpraBarang) => {
    setKodeBrng(b.kode_brng); setNamaBrng(b.nama_brng); setCariBarang(""); setHasilBarang([]);
  };
  const pilihAtc = (key: string) => {
    const a = atcList.find(x => `${x.atc_code}|${x.adm_route}` === key) ?? null;
    setAtc(a);
    if (a) setIsiSatuan(a.ddd_satuan); // auto-samakan satuan dgn DDD (aturan V1)
  };

  const simpan = async () => {
    if (!kodeBrng) { setMsg({ t: "err", m: "Pilih obat (databarang) dulu" }); return; }
    if (!atc) { setMsg({ t: "err", m: "Pilih referensi ATC dulu" }); return; }
    try {
      await ppraMapUpsert({
        kode_brng: kodeBrng, atc_code: atc.atc_code, adm_route: atc.adm_route as AdmRoute,
        isi_zat_aktif: isi, isi_satuan: isiSatuan, is_antibiotik: isAntibiotik, aktif,
      });
      setMsg({ t: "ok", m: "Mapping tersimpan" }); setModalOpen(false); reload();
    } catch (e) { setMsg({ t: "err", m: errMsg(e) }); }
  };
  const hapus = async (r: PpraMap) => {
    if (!confirm(`Hapus mapping ${r.nama_brng ?? r.kode_brng}?`)) return;
    try { await ppraMapDelete(r.kode_brng); setMsg({ t: "ok", m: "Terhapus" }); reload(); }
    catch (e) { setMsg({ t: "err", m: errMsg(e) }); }
  };

  const mismatch = atc && isiSatuan !== atc.ddd_satuan;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/ppra/atc" className="text-slate-400 hover:text-slate-600">‹</Link>
        <h1 className="text-2xl font-bold text-slate-800">Mapping Obat → ATC/DDD</h1>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Hubungkan item <code>databarang</code> Khanza ke referensi ATC. <Link href="/ppra/atc" className="text-indigo-600 hover:underline">→ Referensi ATC</Link>
      </p>

      {validasi && (validasi.v1_mismatch_satuan.jumlah > 0 || validasi.v2_belum_dimapping.jumlah > 0) && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded-lg px-4 py-2 mb-4 space-y-1">
          {validasi.v1_mismatch_satuan.jumlah > 0 && <div>⚠ {validasi.v1_mismatch_satuan.jumlah} mapping satuannya beda dengan DDD (hasil DDD salah).</div>}
          {validasi.v2_belum_dimapping.jumlah > 0 && <div>ℹ {validasi.v2_belum_dimapping.jumlah} item terindikasi antibiotik belum dimapping.</div>}
        </div>
      )}

      {msg && (
        <div className={`text-sm rounded-lg px-4 py-2 mb-3 ${msg.t === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg.m}</div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari kode/nama obat/ATC…"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-72" />
        <button onClick={openNew} className="bg-indigo-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-indigo-700">+ Mapping Baru</button>
        <span className="text-xs text-slate-400 ml-auto">{rows.length} mapping</span>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-2">Kode</th><th className="px-3 py-2">Nama Obat</th>
              <th className="px-3 py-2">ATC / Rute</th><th className="px-3 py-2">Generik</th>
              <th className="px-3 py-2 text-right">Isi zat aktif</th><th className="px-3 py-2">AB?</th>
              <th className="px-3 py-2">Aktif</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">Belum ada mapping.</td></tr>
            ) : rows.map(r => (
              <tr key={r.kode_brng} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">{r.kode_brng}</td>
                <td className="px-3 py-2">{r.nama_brng ?? <span className="text-red-400">(tak ada di databarang)</span>}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.atc_code} / {r.adm_route}</td>
                <td className="px-3 py-2 text-slate-600">{r.nama_generik ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono">{r.isi_zat_aktif} {r.isi_satuan}</td>
                <td className="px-3 py-2">{r.is_antibiotik === 1 ? "✓" : "—"}</td>
                <td className="px-3 py-2">{r.aktif === 1 ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(r)} className="text-indigo-600 hover:underline mr-3">Edit</button>
                  <button onClick={() => hapus(r)} className="text-red-500 hover:underline">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">{editing ? "Edit" : "Tambah"} Mapping</h2>

            {/* Obat */}
            <label className="text-sm block mb-3">
              <span className="block text-slate-500 mb-1">Obat (databarang)</span>
              {kodeBrng ? (
                <div className="flex items-center justify-between border border-slate-300 rounded-lg px-3 py-2">
                  <span><span className="font-mono text-xs text-slate-500">{kodeBrng}</span> — {namaBrng}</span>
                  {!editing && <button onClick={() => { setKodeBrng(""); setNamaBrng(""); }} className="text-xs text-red-500">ganti</button>}
                </div>
              ) : (
                <div className="relative">
                  <input value={cariBarang} onChange={e => setCariBarang(e.target.value)} placeholder="Ketik nama/kode obat (min 2 huruf)…"
                    className="input" />
                  {hasilBarang.length > 0 && (
                    <div className="absolute z-10 bg-white border border-slate-200 rounded-lg mt-1 w-full max-h-52 overflow-y-auto shadow-lg">
                      {hasilBarang.map(b => (
                        <button key={b.kode_brng} onClick={() => pilihBarang(b)}
                          className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                          <span className="font-mono text-xs text-slate-400">{b.kode_brng}</span> {b.nama_brng}
                          {b.sudah_dimapping === 1 && <span className="ml-2 text-xs text-amber-600">(sudah dimapping)</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </label>

            {/* ATC */}
            <label className="text-sm block mb-3">
              <span className="block text-slate-500 mb-1">Referensi ATC (pilih rute yang benar)</span>
              <select value={atc ? `${atc.atc_code}|${atc.adm_route}` : ""} onChange={e => pilihAtc(e.target.value)} className="input">
                <option value="">— pilih —</option>
                {atcList.map(a => (
                  <option key={`${a.atc_code}|${a.adm_route}`} value={`${a.atc_code}|${a.adm_route}`}>
                    {a.nama_generik} · {a.atc_code}/{a.adm_route} · DDD {a.ddd}{a.ddd_satuan} · {a.aware_kategori}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block text-slate-500 mb-1">Isi zat aktif / satuan jual</span>
                <input type="number" step="0.0001" value={isi} onChange={e => setIsi(parseFloat(e.target.value) || 0)} className="input" />
              </label>
              <label className="text-sm">
                <span className="block text-slate-500 mb-1">Satuan (wajib = DDD)</span>
                <select value={isiSatuan} onChange={e => setIsiSatuan(e.target.value as DddSatuan)} className="input">
                  {(["g", "mg", "MU", "TU", "U", "ml"] as DddSatuan[]).map(s => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
            {mismatch && (
              <p className="text-xs text-red-600 mt-1">⚠ Satuan ({isiSatuan}) beda dengan DDD ({atc?.ddd_satuan}) → hasil DDD akan salah.</p>
            )}

            <div className="flex gap-4 mt-3 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={isAntibiotik} onChange={e => setIsAntibiotik(e.target.checked)} /> Antibiotik (masuk surveilans)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={aktif} onChange={e => setAktif(e.target.checked)} /> Aktif</label>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
              <button onClick={simpan} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Simpan</button>
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        .input { border: 1px solid rgb(203 213 225); border-radius: 0.5rem; padding: 0.4rem 0.6rem; font-size: 0.875rem; width: 100%; }
      `}</style>
    </div>
  );
}

function errMsg(e: unknown): string {
  const err = e as { response?: { data?: { error?: string } } };
  return err.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal");
}
