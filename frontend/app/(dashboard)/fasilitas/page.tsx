"use client";

// Fasilitas (MFK/Kesling) — port tabel Khanza: Limbah B3, Pemeliharaan Alat & Gedung.

import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import MicButton from "@/components/MicButton";
import {
  fasLimbahList, fasLimbahSave, fasLimbahHapus,
  fasPmAlatList, fasPmAlatSave, fasPmAlatHapus,
  fasPmGedungList, fasPmGedungSave, fasPmGedungHapus,
  fasPcraList, fasPcraSave, fasPcraHapus,
  FasLimbah, FasPmAlat, FasPmGedung, FasPcra,
} from "@/lib/api";

const nowY = new Date().getFullYear();
const nowLocal = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const todayISO = () => new Date().toISOString().slice(0, 10);
const PELAKSANA = ["", "Teknisi Rumah Sakit", "Teknisi Rujukan", "Pihak ke III"];
const JENIS_PM = ["", "Running Maintenance", "Shut Down Maintenance", "Emergency Maintenance"];

function TInput({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <label className="text-xs text-slate-500 block">{label}<input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800" /></label>;
}
function TSel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return <label className="text-xs text-slate-500 block">{label}<select value={value} onChange={e => onChange(e.target.value)} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800 bg-white">{options.map(o => <option key={o} value={o}>{o || "—"}</option>)}</select></label>;
}
function TArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="text-xs text-slate-500 block col-span-2">{label}<div className="relative mt-0.5"><textarea value={value} onChange={e => onChange(e.target.value)} rows={2} className="block w-full border border-slate-300 rounded-lg px-2 py-1.5 pr-8 text-sm text-slate-800" /><MicButton value={value} onChange={onChange} className="absolute right-1.5 bottom-1.5" /></div></label>;
}

export default function FasilitasPage() {
  const isEdit = hasPerm("mfk_edit") || hasPerm("kesling_edit") || hasPerm("akreditasi_edit");
  const [tab, setTab] = useState<"limbah" | "alat" | "gedung" | "pcra">("limbah");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">🧰 Fasilitas — Limbah B3 & Pemeliharaan</h1>
        <p className="text-sm text-slate-500">Logbook limbah B3 medis, pemeliharaan alat & gedung (data tersimpan di tabel Khanza).</p>
      </div>
      <div className="flex gap-1 border-b border-slate-200">
        {([["limbah", "Limbah B3 Medis"], ["alat", "Pemeliharaan Alat"], ["gedung", "Pemeliharaan Gedung"], ["pcra", "ICRA/PCRA Konstruksi"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
        ))}
      </div>
      {tab === "limbah" && <TabLimbah isEdit={isEdit} />}
      {tab === "alat" && <TabAlat isEdit={isEdit} />}
      {tab === "gedung" && <TabGedung isEdit={isEdit} />}
      {tab === "pcra" && <TabPcra isEdit={isEdit} />}
    </div>
  );
}

function TabLimbah({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<FasLimbah[]>([]); const [f, setF] = useState<(Partial<FasLimbah> & { orig_tanggal?: string }) | null>(null);
  const load = useCallback(() => { fasLimbahList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f) return; try { await fasLimbahSave({ tanggal: f.tanggal ?? nowLocal(), jmllimbah: f.jmllimbah, tujuan_penyerahan: f.tujuan_penyerahan, bukti_dokumen: f.bukti_dokumen, sisa_di_tps: f.sisa_di_tps, keterangan: f.keterangan, orig_tanggal: f.orig_tanggal }); setF(null); load(); } catch { alert("Gagal"); } }
  async function hapus(r: FasLimbah) { if (confirm("Hapus?")) { await fasLimbahHapus({ nip: r.nip, tanggal: r.tanggal }); load(); } }
  return <div className="space-y-3">
    {isEdit && !f && <button onClick={() => setF({ tanggal: nowLocal() })} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Limbah B3</button>}
    {f && <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2"><div className="text-sm font-bold text-slate-800">{f.orig_tanggal ? "Ubah" : "Tambah"} Limbah B3 Medis</div>
      <div className="grid grid-cols-2 gap-2">
        <TInput label="Tanggal & Jam" type="datetime-local" value={(f.tanggal ?? "").slice(0, 16).replace(" ", "T")} onChange={v => set("tanggal", v)} />
        <TInput label="Jumlah Limbah (kg)" type="number" value={String(f.jmllimbah ?? "")} onChange={v => set("jmllimbah", Number(v) || 0)} />
        <TInput label="Tujuan Penyerahan" value={f.tujuan_penyerahan ?? ""} onChange={v => set("tujuan_penyerahan", v)} placeholder="Pihak ke-3 pengangkut" />
        <TInput label="Bukti Dokumen (manifest)" value={f.bukti_dokumen ?? ""} onChange={v => set("bukti_dokumen", v)} />
        <TInput label="Sisa di TPS (kg)" type="number" value={String(f.sisa_di_tps ?? "")} onChange={v => set("sisa_di_tps", Number(v) || 0)} />
        <TArea label="Keterangan" value={f.keterangan ?? ""} onChange={v => set("keterangan", v)} />
      </div>
      <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button><button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div></div>}
    <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Tanggal</th><th className="px-3 py-2 text-right">Jumlah (kg)</th><th className="px-3 py-2 text-left">Tujuan</th><th className="px-3 py-2 text-right">Sisa TPS</th><th className="px-3 py-2 text-left">Petugas</th><th className="px-3 py-2"></th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> : rows.map((r, i) => <tr key={i} className="hover:bg-slate-50"><td className="px-3 py-2 whitespace-nowrap">{(r.tanggal ?? "").slice(0, 16)}</td><td className="px-3 py-2 text-right tabular-nums">{r.jmllimbah ?? "-"}</td><td className="px-3 py-2 text-xs">{r.tujuan_penyerahan ?? "-"}</td><td className="px-3 py-2 text-right tabular-nums">{r.sisa_di_tps ?? "-"}</td><td className="px-3 py-2 text-xs">{r.nama ?? r.nip}</td><td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF({ ...r, orig_tanggal: r.tanggal })} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td></tr>)}</tbody></table></div>
  </div>;
}

function TabAlat({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<FasPmAlat[]>([]); const [f, setF] = useState<(Partial<FasPmAlat> & { orig_no?: string; orig_tanggal?: string }) | null>(null);
  const load = useCallback(() => { fasPmAlatList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f || !f.no_inventaris?.trim()) { alert("No. inventaris wajib"); return; } try { await fasPmAlatSave({ no_inventaris: f.no_inventaris!, tanggal: f.tanggal ?? todayISO(), uraian_kegiatan: f.uraian_kegiatan, pelaksana: f.pelaksana, biaya: f.biaya, jenis_pemeliharaan: f.jenis_pemeliharaan, orig_no: f.orig_no, orig_tanggal: f.orig_tanggal }); setF(null); load(); } catch { alert("Gagal"); } }
  async function hapus(r: FasPmAlat) { if (confirm("Hapus?")) { await fasPmAlatHapus({ no_inventaris: r.no_inventaris, tanggal: r.tanggal }); load(); } }
  return <div className="space-y-3">
    {isEdit && !f && <button onClick={() => setF({ tanggal: todayISO() })} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Pemeliharaan Alat</button>}
    {f && <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2"><div className="text-sm font-bold text-slate-800">{f.orig_no ? "Ubah" : "Tambah"} Pemeliharaan Alat</div>
      <div className="grid grid-cols-2 gap-2">
        <TInput label="No. Inventaris" value={f.no_inventaris ?? ""} onChange={v => set("no_inventaris", v)} />
        <TInput label="Tanggal" type="date" value={(f.tanggal ?? "").slice(0, 10)} onChange={v => set("tanggal", v)} />
        <TSel label="Pelaksana" value={f.pelaksana ?? ""} onChange={v => set("pelaksana", v)} options={PELAKSANA} />
        <TSel label="Jenis Pemeliharaan" value={f.jenis_pemeliharaan ?? ""} onChange={v => set("jenis_pemeliharaan", v)} options={JENIS_PM} />
        <TInput label="Biaya (Rp)" type="number" value={String(f.biaya ?? "")} onChange={v => set("biaya", Number(v) || 0)} />
        <TArea label="Uraian Kegiatan" value={f.uraian_kegiatan ?? ""} onChange={v => set("uraian_kegiatan", v)} />
      </div>
      <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button><button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div></div>}
    <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">No. Inventaris</th><th className="px-3 py-2 text-left">Tanggal</th><th className="px-3 py-2 text-left">Kegiatan</th><th className="px-3 py-2 text-left">Jenis</th><th className="px-3 py-2 text-right">Biaya</th><th className="px-3 py-2"></th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> : rows.map((r, i) => <tr key={i} className="hover:bg-slate-50"><td className="px-3 py-2 font-mono text-xs">{r.no_inventaris}</td><td className="px-3 py-2 whitespace-nowrap">{(r.tanggal ?? "").slice(0, 10)}</td><td className="px-3 py-2 text-xs">{r.uraian_kegiatan ?? "-"}</td><td className="px-3 py-2 text-xs">{r.jenis_pemeliharaan ?? "-"}</td><td className="px-3 py-2 text-right tabular-nums">{r.biaya != null ? r.biaya.toLocaleString("id") : "-"}</td><td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF({ ...r, orig_no: r.no_inventaris, orig_tanggal: (r.tanggal ?? "").slice(0, 10) })} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td></tr>)}</tbody></table></div>
  </div>;
}

function TabGedung({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<FasPmGedung[]>([]); const [f, setF] = useState<Partial<FasPmGedung> | null>(null);
  const load = useCallback(() => { fasPmGedungList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f || !f.no_pemeliharaan?.trim()) { alert("No. pemeliharaan wajib"); return; } try { await fasPmGedungSave({ no_pemeliharaan: f.no_pemeliharaan!, tanggal: f.tanggal, uraian_kegiatan: f.uraian_kegiatan, pelaksana: f.pelaksana, biaya: f.biaya, jenis_pemeliharaan: f.jenis_pemeliharaan, tindak_lanjut: f.tindak_lanjut }); setF(null); load(); } catch { alert("Gagal"); } }
  async function hapus(r: FasPmGedung) { if (confirm("Hapus?")) { await fasPmGedungHapus({ no_pemeliharaan: r.no_pemeliharaan }); load(); } }
  return <div className="space-y-3">
    {isEdit && !f && <button onClick={() => setF({ tanggal: todayISO() })} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Pemeliharaan Gedung</button>}
    {f && <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2"><div className="text-sm font-bold text-slate-800">{f.no_pemeliharaan && rows.some(x => x.no_pemeliharaan === f.no_pemeliharaan) ? "Ubah" : "Tambah"} Pemeliharaan Gedung</div>
      <div className="grid grid-cols-2 gap-2">
        <TInput label="No. Pemeliharaan" value={f.no_pemeliharaan ?? ""} onChange={v => set("no_pemeliharaan", v)} />
        <TInput label="Tanggal" type="date" value={(f.tanggal ?? "").slice(0, 10)} onChange={v => set("tanggal", v)} />
        <TSel label="Pelaksana" value={f.pelaksana ?? ""} onChange={v => set("pelaksana", v)} options={["", "Teknisi Rumah Sakit", "Pihak ke III"]} />
        <TSel label="Jenis Pemeliharaan" value={f.jenis_pemeliharaan ?? ""} onChange={v => set("jenis_pemeliharaan", v)} options={JENIS_PM} />
        <TInput label="Biaya (Rp)" type="number" value={String(f.biaya ?? "")} onChange={v => set("biaya", Number(v) || 0)} />
        <TInput label="Tindak Lanjut" value={f.tindak_lanjut ?? ""} onChange={v => set("tindak_lanjut", v)} />
        <TArea label="Uraian Kegiatan" value={f.uraian_kegiatan ?? ""} onChange={v => set("uraian_kegiatan", v)} />
      </div>
      <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button><button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div></div>}
    <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">No.</th><th className="px-3 py-2 text-left">Tanggal</th><th className="px-3 py-2 text-left">Kegiatan</th><th className="px-3 py-2 text-left">Jenis</th><th className="px-3 py-2 text-right">Biaya</th><th className="px-3 py-2"></th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> : rows.map((r, i) => <tr key={i} className="hover:bg-slate-50"><td className="px-3 py-2 font-mono text-xs">{r.no_pemeliharaan}</td><td className="px-3 py-2 whitespace-nowrap">{(r.tanggal ?? "").slice(0, 10)}</td><td className="px-3 py-2 text-xs">{r.uraian_kegiatan ?? "-"}</td><td className="px-3 py-2 text-xs">{r.jenis_pemeliharaan ?? "-"}</td><td className="px-3 py-2 text-right tabular-nums">{r.biaya != null ? r.biaya.toLocaleString("id") : "-"}</td><td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td></tr>)}</tbody></table></div>
  </div>;
}

function TabPcra({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<FasPcra[]>([]); const [f, setF] = useState<(Partial<FasPcra> & { _edit?: boolean }) | null>(null);
  const load = useCallback(() => { fasPcraList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: string) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f || !f.no_pcra?.trim()) { alert("No. PCRA wajib"); return; } try { await fasPcraSave(f); setF(null); load(); } catch { alert("Gagal"); } }
  async function hapus(r: FasPcra) { if (confirm("Hapus?")) { await fasPcraHapus({ no_pcra: r.no_pcra }); load(); } }
  return <div className="space-y-3">
    <div className="text-xs text-slate-500">Pengkajian Risiko Pra-Konstruksi (ICRA/PCRA) — MFK 6/PPI. Renovasi/konstruksi.</div>
    {isEdit && !f && <button onClick={() => setF({ tanggal_pengkajian: nowLocal(), dibutuhkan_icra: "Tidak" })} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Pengkajian ICRA/PCRA</button>}
    {f && <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2"><div className="text-sm font-bold text-slate-800">{f._edit ? "Ubah" : "Tambah"} ICRA/PCRA</div>
      <div className="grid grid-cols-2 gap-2">
        <TInput label="No. PCRA" value={f.no_pcra ?? ""} onChange={v => set("no_pcra", v)} />
        <TInput label="No. Proyek" value={f.no_proyek ?? ""} onChange={v => set("no_proyek", v)} />
        <TInput label="Nama Proyek" value={f.nama_proyek ?? ""} onChange={v => set("nama_proyek", v)} />
        <TInput label="Lokasi Proyek" value={f.lokasi_proyek ?? ""} onChange={v => set("lokasi_proyek", v)} />
        <TInput label="Mulai" type="date" value={(f.mulai_proyek ?? "").slice(0, 10)} onChange={v => set("mulai_proyek", v)} />
        <TInput label="Perkiraan Selesai" type="date" value={(f.perkiraan_selesai ?? "").slice(0, 10)} onChange={v => set("perkiraan_selesai", v)} />
        <TInput label="Penanggung Jawab" value={f.penangung_jawab_proyek ?? ""} onChange={v => set("penangung_jawab_proyek", v)} />
        <TInput label="Pelaksana" value={f.pelaksana_proyek ?? ""} onChange={v => set("pelaksana_proyek", v)} />
        <TSel label="Butuh ICRA?" value={f.dibutuhkan_icra ?? "Tidak"} onChange={v => set("dibutuhkan_icra", v)} options={["Tidak", "Ya"]} />
        <TInput label="Tanggal Pengkajian" type="datetime-local" value={(f.tanggal_pengkajian ?? "").slice(0, 16).replace(" ", "T")} onChange={v => set("tanggal_pengkajian", v)} />
        <TArea label="Deskripsi Pekerjaan" value={f.deskripsi_pekerjaan ?? ""} onChange={v => set("deskripsi_pekerjaan", v)} />
        <TArea label="Deskripsi Lokasi (area terdampak)" value={f.deskripsi_lokasi_proyek ?? ""} onChange={v => set("deskripsi_lokasi_proyek", v)} />
        <TArea label="Rekomendasi Selama Pengerjaan" value={f.rekomendasi_selama_pengerjaan ?? ""} onChange={v => set("rekomendasi_selama_pengerjaan", v)} />
        <TArea label="Rekomendasi Setelah Pengerjaan" value={f.rekomendasi_setelah_pengerjaan ?? ""} onChange={v => set("rekomendasi_setelah_pengerjaan", v)} />
        <TArea label="Hal yang Perlu Dimonitor" value={f.hal_yang_perlu_dimonitor ?? ""} onChange={v => set("hal_yang_perlu_dimonitor", v)} />
        <TArea label="Catatan Tim PPI/K3" value={f.catatan_tim_ppi_k3_lainnya ?? ""} onChange={v => set("catatan_tim_ppi_k3_lainnya", v)} />
      </div>
      <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button><button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div></div>}
    <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">No. PCRA</th><th className="px-3 py-2 text-left">Proyek</th><th className="px-3 py-2 text-left">Lokasi</th><th className="px-3 py-2 text-center">Butuh ICRA</th><th className="px-3 py-2 text-left">Tgl Kaji</th><th className="px-3 py-2"></th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> : rows.map((r, i) => <tr key={i} className="hover:bg-slate-50"><td className="px-3 py-2 font-mono text-xs">{r.no_pcra}</td><td className="px-3 py-2">{r.nama_proyek ?? "-"}</td><td className="px-3 py-2 text-xs">{r.lokasi_proyek ?? "-"}</td><td className="px-3 py-2 text-center"><span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${r.dibutuhkan_icra === "Ya" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{r.dibutuhkan_icra ?? "-"}</span></td><td className="px-3 py-2 text-xs">{(r.tanggal_pengkajian ?? "").slice(0, 10)}</td><td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF({ ...r, _edit: true })} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td></tr>)}</tbody></table></div>
  </div>;
}
