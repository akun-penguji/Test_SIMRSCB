"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ppraGyssensList, ppraGyssensSave, ppraGyssensDelete, ppraGyssensRekap,
  ppraGyssensPasien, ppraGyssensDetail,
  GyssensAudit, GyssensDetail, GyssensRekap, KategoriGyssens,
} from "@/lib/api";

const KATEGORI: { k: KategoriGyssens; label: string }[] = [
  { k: "0", label: "0 — Rasional (tepat)" },
  { k: "I", label: "I — Waktu pemberian tidak tepat" },
  { k: "IIA", label: "IIA — Dosis tidak tepat" },
  { k: "IIB", label: "IIB — Interval tidak tepat" },
  { k: "IIC", label: "IIC — Rute tidak tepat" },
  { k: "IIIA", label: "IIIA — Durasi terlalu lama" },
  { k: "IIIB", label: "IIIB — Durasi terlalu singkat" },
  { k: "IVA", label: "IVA — Ada alternatif lebih efektif" },
  { k: "IVB", label: "IVB — Ada alternatif kurang toksik" },
  { k: "IVC", label: "IVC — Ada alternatif lebih murah" },
  { k: "IVD", label: "IVD — Ada alternatif spektrum lebih sempit" },
  { k: "V", label: "V — Tidak ada indikasi antibiotik" },
  { k: "VI", label: "VI — Data tidak lengkap" },
];
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Row = GyssensDetail & { _nama?: string };

export default function PpraGyssensPage() {
  const [view, setView] = useState<"list" | "form">("list");
  const [rows, setRows] = useState<GyssensAudit[]>([]);
  const [rekap, setRekap] = useState<GyssensRekap | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);

  // form state
  const [editId, setEditId] = useState<number | null>(null);
  const [noRawat, setNoRawat] = useState("");
  const [noRm, setNoRm] = useState("");
  const [namaPasien, setNamaPasien] = useState("");
  const [tglAudit, setTglAudit] = useState(fmt(new Date()));
  const [auditorNip, setAuditorNip] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [unitSmf, setUnitSmf] = useState("");
  const [catatan, setCatatan] = useState("");
  const [details, setDetails] = useState<Row[]>([]);

  const reload = useCallback(() => {
    setLoading(true);
    ppraGyssensList({ q }).then(r => setRows(r.data.data)).catch(() => setRows([])).finally(() => setLoading(false));
    ppraGyssensRekap({}).then(r => setRekap(r.data)).catch(() => setRekap(null));
  }, [q]);
  useEffect(() => { reload(); }, [reload]);

  const resetForm = () => {
    setEditId(null); setNoRawat(""); setNoRm(""); setNamaPasien("");
    setTglAudit(fmt(new Date())); setAuditorNip(""); setDiagnosis(""); setUnitSmf(""); setCatatan("");
    setDetails([]);
  };
  const openNew = () => { resetForm(); setView("form"); };

  const openEdit = async (id: number) => {
    try {
      const r = await ppraGyssensDetail(id);
      const h = r.data.header;
      setEditId(h.id); setNoRawat(h.no_rawat); setNoRm(h.no_rkm_medis ?? "");
      setNamaPasien(""); setTglAudit(h.tgl_audit); setAuditorNip(h.auditor_nip ?? "");
      setDiagnosis(h.diagnosis ?? ""); setUnitSmf(h.unit_smf ?? ""); setCatatan("");
      setDetails(r.data.details.map(d => ({ ...d, ada_kultur: d.ada_kultur === 1 || d.ada_kultur === true })));
      setView("form");
    } catch (e) { setMsg({ t: "err", m: errMsg(e) }); }
  };

  const ambilPasien = async () => {
    if (!noRawat.trim()) return;
    try {
      const r = await ppraGyssensPasien(noRawat.trim());
      setNoRm(r.data.no_rkm_medis ?? ""); setNamaPasien(r.data.nm_pasien ?? "");
      // prefill detail rows dari antibiotik yang diberikan
      if (r.data.antibiotik.length > 0) {
        setDetails(r.data.antibiotik.map(a => ({
          kode_brng: a.kode_brng, atc_code: a.atc_code, adm_route: a.adm_route,
          _nama: a.nama_generik ?? a.nama_brng ?? a.kode_brng,
          dosis: "", interval: "", durasi_hari: null, ada_kultur: false,
          hasil_kultur: "", kategori_gyssens: "0" as KategoriGyssens, catatan: "",
        })));
        setMsg({ t: "ok", m: `${r.data.antibiotik.length} antibiotik ditemukan & diisi otomatis` });
      } else {
        setMsg({ t: "ok", m: "Pasien ditemukan — belum ada antibiotik ter-mapping. Tambah baris manual." });
      }
    } catch (e) { setMsg({ t: "err", m: errMsg(e) }); }
  };

  const addRow = () => setDetails(d => [...d, {
    kode_brng: "", atc_code: "", adm_route: "", dosis: "", interval: "", durasi_hari: null,
    ada_kultur: false, hasil_kultur: "", kategori_gyssens: "0", catatan: "", _nama: "",
  }]);
  const setRow = (i: number, patch: Partial<Row>) => setDetails(d => d.map((r, j) => j === i ? { ...r, ...patch } : r));
  const delRow = (i: number) => setDetails(d => d.filter((_, j) => j !== i));

  const simpan = async () => {
    if (!noRawat.trim()) { setMsg({ t: "err", m: "No. rawat wajib" }); return; }
    if (details.length === 0) { setMsg({ t: "err", m: "Minimal 1 antibiotik dinilai" }); return; }
    try {
      await ppraGyssensSave({
        id: editId ?? undefined, no_rawat: noRawat.trim(), no_rkm_medis: noRm || null,
        tgl_audit: tglAudit, auditor_nip: auditorNip || null, diagnosis: diagnosis || null,
        unit_smf: unitSmf || null, catatan: catatan || null,
        details: details.map(d => ({
          kode_brng: d.kode_brng || null, atc_code: d.atc_code || null, adm_route: d.adm_route || null,
          dosis: d.dosis || null, interval: d.interval || null,
          durasi_hari: d.durasi_hari ?? null, ada_kultur: !!d.ada_kultur,
          hasil_kultur: d.hasil_kultur || null, kategori_gyssens: d.kategori_gyssens, catatan: d.catatan || null,
        })),
      });
      setMsg({ t: "ok", m: "Audit tersimpan" }); setView("list"); reload();
    } catch (e) { setMsg({ t: "err", m: errMsg(e) }); }
  };

  const hapus = async (id: number) => {
    if (!confirm("Hapus audit ini?")) return;
    try { await ppraGyssensDelete(id); setMsg({ t: "ok", m: "Terhapus" }); reload(); }
    catch (e) { setMsg({ t: "err", m: errMsg(e) }); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/klpcm" className="text-slate-400 hover:text-slate-600">‹</Link>
        <h1 className="text-2xl font-bold text-slate-800">Audit Kualitatif Antibiotik (Gyssens)</h1>
      </div>
      <p className="text-sm text-slate-500 mb-4">Penilaian rasionalitas per pasien, kategori 0–VI.</p>

      {msg && (
        <div className={`text-sm rounded-lg px-4 py-2 mb-3 ${msg.t === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg.m}</div>
      )}

      {view === "list" ? (
        <>
          {/* Rekap */}
          {rekap && rekap.total_antibiotik > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
              <div className="flex flex-wrap items-center gap-6 mb-2">
                <div><div className="text-xs text-slate-500">Total dinilai</div><div className="text-xl font-bold text-slate-800">{rekap.total_antibiotik}</div></div>
                <div><div className="text-xs text-slate-500">Rasional (kat. 0)</div><div className="text-xl font-bold text-emerald-600">{rekap.rasional}</div></div>
                <div><div className="text-xs text-slate-500">Tidak rasional</div><div className="text-xl font-bold text-red-600">{rekap.tidak_rasional}</div></div>
                <div><div className="text-xs text-slate-500">% Rasional</div><div className="text-xl font-bold text-indigo-600">{rekap.persen_rasional.toFixed(1)}%</div></div>
              </div>
              <div className="flex flex-wrap gap-1">
                {KATEGORI.map(({ k }) => {
                  const n = rekap.distribusi[k] ?? 0;
                  return n > 0 ? (
                    <span key={k} className={`text-xs px-2 py-0.5 rounded border ${k === "0" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-700 border-slate-300"}`}>
                      {k}: {n}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari no.rawat / RM / diagnosis…"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-72" />
            <button onClick={openNew} className="bg-indigo-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-indigo-700">+ Audit Baru</button>
            <span className="text-xs text-slate-400 ml-auto">{rows.length} audit</span>
          </div>

          <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-left">
                <tr><th className="px-3 py-2">Tgl</th><th className="px-3 py-2">No. Rawat</th><th className="px-3 py-2">RM</th>
                  <th className="px-3 py-2">Diagnosis</th><th className="px-3 py-2">Unit/SMF</th>
                  <th className="px-3 py-2 text-center">AB / Rasional</th><th className="px-3 py-2"></th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Memuat…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Belum ada audit.</td></tr>
                ) : rows.map(r => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap">{r.tgl_audit}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.no_rawat}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.no_rkm_medis ?? "—"}</td>
                    <td className="px-3 py-2">{r.diagnosis ?? "—"}</td>
                    <td className="px-3 py-2">{r.unit_smf ?? "—"}</td>
                    <td className="px-3 py-2 text-center">{r.jml_antibiotik} / <span className="text-emerald-600">{r.jml_rasional}</span></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(r.id)} className="text-indigo-600 hover:underline mr-3">Edit</button>
                      <button onClick={() => hapus(r.id)} className="text-red-500 hover:underline">Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        // ── FORM ──
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">{editId ? "Edit" : "Audit Baru"} Gyssens</h2>
            <button onClick={() => setView("list")} className="text-sm text-slate-500 hover:text-slate-700">← Kembali</button>
          </div>

          <div className="grid md:grid-cols-3 gap-3 mb-3">
            <label className="text-sm md:col-span-2">
              <span className="block text-slate-500 mb-1">No. Rawat</span>
              <div className="flex gap-2">
                <input value={noRawat} disabled={!!editId} onChange={e => setNoRawat(e.target.value)} placeholder="2026/07/01/000001" className="input" />
                {!editId && <button onClick={ambilPasien} className="bg-slate-800 text-white text-sm rounded-lg px-3 whitespace-nowrap hover:bg-slate-900">Ambil data</button>}
              </div>
            </label>
            <label className="text-sm">
              <span className="block text-slate-500 mb-1">Tgl Audit</span>
              <input type="date" value={tglAudit} onChange={e => setTglAudit(e.target.value)} className="input" />
            </label>
            <Field label="No. RM"><input value={noRm} onChange={e => setNoRm(e.target.value)} className="input" /></Field>
            <Field label="Nama Pasien"><input value={namaPasien} readOnly className="input bg-slate-50" placeholder="(otomatis)" /></Field>
            <Field label="Auditor (NIP)"><input value={auditorNip} onChange={e => setAuditorNip(e.target.value)} className="input" /></Field>
            <Field label="Diagnosis"><input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} className="input" /></Field>
            <Field label="Unit / SMF"><input value={unitSmf} onChange={e => setUnitSmf(e.target.value)} className="input" /></Field>
            <Field label="Catatan"><input value={catatan} onChange={e => setCatatan(e.target.value)} className="input" /></Field>
          </div>

          <div className="flex items-center justify-between mt-4 mb-2">
            <h3 className="text-sm font-semibold text-slate-700">Penilaian per Antibiotik</h3>
            <button onClick={addRow} className="text-sm text-indigo-600 hover:underline">+ Tambah baris</button>
          </div>

          {details.length === 0 ? (
            <p className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg p-4 text-center">
              Belum ada antibiotik. Isi No. Rawat lalu &quot;Ambil data&quot;, atau tambah baris manual.
            </p>
          ) : (
            <div className="space-y-2">
              {details.map((d, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">
                      {d._nama || d.kode_brng || "Antibiotik"} {d.atc_code && <span className="text-xs text-slate-400 font-mono">{d.atc_code}/{d.adm_route}</span>}
                    </span>
                    <button onClick={() => delRow(i)} className="text-xs text-red-500 hover:underline">hapus</button>
                  </div>
                  <div className="grid md:grid-cols-4 gap-2">
                    {!d.kode_brng && <input value={d._nama ?? ""} onChange={e => setRow(i, { _nama: e.target.value })} placeholder="Nama antibiotik" className="input" />}
                    <input value={d.dosis ?? ""} onChange={e => setRow(i, { dosis: e.target.value })} placeholder="Dosis (mis. 2x1g)" className="input" />
                    <input value={d.interval ?? ""} onChange={e => setRow(i, { interval: e.target.value })} placeholder="Interval" className="input" />
                    <input type="number" value={d.durasi_hari ?? ""} onChange={e => setRow(i, { durasi_hari: e.target.value ? parseInt(e.target.value) : null })} placeholder="Durasi (hari)" className="input" />
                    <select value={d.kategori_gyssens} onChange={e => setRow(i, { kategori_gyssens: e.target.value as KategoriGyssens })}
                      className={`input md:col-span-2 ${d.kategori_gyssens === "0" ? "text-emerald-700" : "text-red-700"}`}>
                      {KATEGORI.map(o => <option key={o.k} value={o.k}>{o.label}</option>)}
                    </select>
                    <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={!!d.ada_kultur} onChange={e => setRow(i, { ada_kultur: e.target.checked })} /> Ada kultur</label>
                    <input value={d.hasil_kultur ?? ""} onChange={e => setRow(i, { hasil_kultur: e.target.value })} placeholder="Hasil kultur" className="input" />
                    <input value={d.catatan ?? ""} onChange={e => setRow(i, { catatan: e.target.value })} placeholder="Catatan" className="input md:col-span-4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setView("list")} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
            <button onClick={simpan} className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Simpan Audit</button>
          </div>
        </div>
      )}
      <style jsx>{`.input { border: 1px solid rgb(203 213 225); border-radius: 0.5rem; padding: 0.4rem 0.6rem; font-size: 0.875rem; width: 100%; }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm"><span className="block text-slate-500 mb-1">{label}</span>{children}</label>;
}
function errMsg(e: unknown): string {
  const err = e as { response?: { data?: { error?: string } } };
  return err.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal");
}
