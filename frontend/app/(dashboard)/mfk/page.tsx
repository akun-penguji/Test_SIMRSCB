"use client";

// MFK — Manajemen Fasilitas & Keselamatan: K3RS, Code Blue, APAR, Utilitas, HVA.

import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import MicButton from "@/components/MicButton";
import {
  mfkK3List, mfkK3Create, mfkK3Update, mfkK3Delete,
  mfkCbList, mfkCbCreate, mfkCbUpdate, mfkCbDelete,
  mfkAparList, mfkAparCreate, mfkAparUpdate, mfkAparDelete,
  mfkUtilList, mfkUtilCreate, mfkUtilUpdate, mfkUtilDelete,
  mfkHvaList, mfkHvaCreate, mfkHvaUpdate, mfkHvaDelete, mfkRekap,
  MfkK3, MfkCb, MfkApar, MfkUtil, MfkHva, MfkRekap,
} from "@/lib/api";

const nowY = new Date().getFullYear();
const todayISO = () => new Date().toISOString().slice(0, 10);

function TInput({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <label className="text-xs text-slate-500 block">{label}<input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800" /></label>;
}
function TSel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return <label className="text-xs text-slate-500 block">{label}<select value={value} onChange={e => onChange(e.target.value)} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800 bg-white">{options.map(o => <option key={o} value={o}>{o || "—"}</option>)}</select></label>;
}
function TArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="text-xs text-slate-500 block col-span-2">{label}<div className="relative mt-0.5"><textarea value={value} onChange={e => onChange(e.target.value)} rows={2} className="block w-full border border-slate-300 rounded-lg px-2 py-1.5 pr-8 text-sm text-slate-800" /><MicButton value={value} onChange={onChange} className="absolute right-1.5 bottom-1.5" /></div></label>;
}
function Chk({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4" />{label}</label>;
}
function Stat({ label, value, color = "blue" }: { label: string; value: string | number; color?: string }) {
  const c: Record<string, string> = { blue: "bg-blue-50 border-blue-200 text-blue-700", rose: "bg-rose-50 border-rose-200 text-rose-700", amber: "bg-amber-50 border-amber-200 text-amber-700", emerald: "bg-emerald-50 border-emerald-200 text-emerald-700" };
  return <div className={`rounded-lg border p-3 ${c[color]}`}><div className="text-xs">{label}</div><div className="text-2xl font-bold text-slate-900">{value}</div></div>;
}

export default function MfkPage() {
  const isEdit = hasPerm("mfk_edit") || hasPerm("mutu_edit") || hasPerm("akreditasi_edit");
  const [tab, setTab] = useState<"k3rs" | "code_blue" | "apar" | "utilitas" | "hva">("k3rs");
  const [rekap, setRekap] = useState<MfkRekap | null>(null);
  useEffect(() => { mfkRekap(nowY).then(r => setRekap(r.data)).catch(() => {}); }, [tab]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">🏗️ MFK — Manajemen Fasilitas & Keselamatan</h1>
        <p className="text-sm text-slate-500">K3RS, Code Blue, Inspeksi APAR, Monitoring Utilitas, HVA/Bencana (STARKES MFK).</p>
      </div>
      {rekap && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Stat label={`K3RS Insiden ${nowY}`} value={rekap.k3rs_insiden} color="rose" />
          <Stat label={`Code Blue ${nowY}`} value={rekap.code_blue} color="blue" />
          <Stat label="Avg Respons CB (mnt)" value={rekap.code_blue_avg_response != null ? rekap.code_blue_avg_response.toFixed(1) : "—"} color="amber" />
          <Stat label="APAR bermasalah" value={rekap.apar_bermasalah} color="amber" />
          <Stat label={`Utilitas gangguan ${nowY}`} value={rekap.utilitas_gangguan} color="rose" />
        </div>
      )}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {([["k3rs", "K3RS Insiden"], ["code_blue", "Code Blue"], ["apar", "APAR / Hidran"], ["utilitas", "Utilitas"], ["hva", "HVA / Bencana"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
        ))}
      </div>
      {tab === "k3rs" && <TabK3 isEdit={isEdit} />}
      {tab === "code_blue" && <TabCb isEdit={isEdit} />}
      {tab === "apar" && <TabApar isEdit={isEdit} />}
      {tab === "utilitas" && <TabUtil isEdit={isEdit} />}
      {tab === "hva" && <TabHva isEdit={isEdit} />}
    </div>
  );
}

const JENIS_PERISTIWA = ["", "Tertusuk Jarum", "Pajanan Cairan Tubuh", "Kecelakaan Kerja", "Terpapar B3", "Terjatuh/Terpeleset", "Terpapar Radiasi", "Kekerasan di Tempat Kerja", "Lainnya"];
function TabK3({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<MfkK3[]>([]); const [f, setF] = useState<Partial<MfkK3> | null>(null);
  const load = useCallback(() => { mfkK3List({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof MfkK3, v: string) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f) return; try { if (f.id) await mfkK3Update(f.id, f); else await mfkK3Create(f); setF(null); load(); } catch { alert("Gagal"); } }
  async function hapus(id: number) { if (confirm("Hapus?")) { await mfkK3Delete(id); load(); } }
  return <div className="space-y-3">
    {isEdit && !f && <button onClick={() => setF({ tanggal: todayISO(), status: "Lapor" })} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Insiden K3RS</button>}
    {f && <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2"><div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Insiden K3RS (pajanan/kecelakaan kerja)</div>
      <div className="grid grid-cols-2 gap-2">
        <TInput label="Tanggal" type="date" value={f.tanggal ?? ""} onChange={v => set("tanggal", v)} />
        <TSel label="Jenis Peristiwa" value={f.jenis_peristiwa ?? ""} onChange={v => set("jenis_peristiwa", v)} options={JENIS_PERISTIWA} />
        <TInput label="Nama Pegawai" value={f.nama_pegawai ?? ""} onChange={v => set("nama_pegawai", v)} />
        <TInput label="NIP" value={f.nip ?? ""} onChange={v => set("nip", v)} />
        <TInput label="Unit" value={f.unit ?? ""} onChange={v => set("unit", v)} />
        <TInput label="Lokasi Kejadian" value={f.lokasi_kejadian ?? ""} onChange={v => set("lokasi_kejadian", v)} />
        <TInput label="Jenis Cidera" value={f.jenis_cidera ?? ""} onChange={v => set("jenis_cidera", v)} />
        <TInput label="Bagian Tubuh" value={f.bagian_tubuh ?? ""} onChange={v => set("bagian_tubuh", v)} />
        <TInput label="Penyebab" value={f.penyebab ?? ""} onChange={v => set("penyebab", v)} />
        <TSel label="Status" value={f.status ?? "Lapor"} onChange={v => set("status", v)} options={["Lapor", "Proses", "Selesai"]} />
        <TArea label="Kronologi" value={f.kronologi ?? ""} onChange={v => set("kronologi", v)} />
        <TArea label="Tindakan (P3K/PEP)" value={f.tindakan ?? ""} onChange={v => set("tindakan", v)} />
        <TArea label="Tindak Lanjut" value={f.tindak_lanjut ?? ""} onChange={v => set("tindak_lanjut", v)} />
      </div>
      <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button><button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div></div>}
    <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Tgl</th><th className="px-3 py-2 text-left">Pegawai</th><th className="px-3 py-2 text-left">Peristiwa</th><th className="px-3 py-2 text-left">Cidera</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2"></th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> : rows.map(r => <tr key={r.id} className="hover:bg-slate-50"><td className="px-3 py-2 whitespace-nowrap">{r.tanggal}</td><td className="px-3 py-2">{r.nama_pegawai ?? "-"}<div className="text-[11px] text-slate-400">{r.unit}</div></td><td className="px-3 py-2 text-xs">{r.jenis_peristiwa ?? "-"}</td><td className="px-3 py-2 text-xs">{r.jenis_cidera ?? "-"}</td><td className="px-3 py-2 text-xs">{r.status}</td><td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td></tr>)}</tbody></table></div>
  </div>;
}

function TabCb({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<MfkCb[]>([]); const [f, setF] = useState<Partial<MfkCb> | null>(null);
  const load = useCallback(() => { mfkCbList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof MfkCb, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f) return; try { if (f.id) await mfkCbUpdate(f.id, f); else await mfkCbCreate(f); setF(null); load(); } catch { alert("Gagal"); } }
  async function hapus(id: number) { if (confirm("Hapus?")) { await mfkCbDelete(id); load(); } }
  return <div className="space-y-3">
    {isEdit && !f && <button onClick={() => setF({ tanggal: todayISO() })} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Aktivasi Code Blue</button>}
    {f && <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2"><div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Code Blue</div>
      <div className="grid grid-cols-2 gap-2">
        <TInput label="Tanggal" type="date" value={f.tanggal ?? ""} onChange={v => set("tanggal", v)} />
        <TInput label="Lokasi" value={f.lokasi ?? ""} onChange={v => set("lokasi", v)} />
        <TInput label="Jam Aktivasi" value={f.jam_aktivasi ?? ""} onChange={v => set("jam_aktivasi", v)} placeholder="HH:MM" />
        <TInput label="Jam Tim Datang" value={f.jam_tim_datang ?? ""} onChange={v => set("jam_tim_datang", v)} placeholder="HH:MM" />
        <TInput label="Respons (menit)" type="number" value={String(f.response_menit ?? "")} onChange={v => set("response_menit", Number(v) || 0)} />
        <TInput label="Nama Pasien" value={f.nama_pasien ?? ""} onChange={v => set("nama_pasien", v)} />
        <TInput label="No. Rawat" value={f.no_rawat ?? ""} onChange={v => set("no_rawat", v)} />
        <TInput label="Kondisi Awal" value={f.kondisi_awal ?? ""} onChange={v => set("kondisi_awal", v)} placeholder="Henti jantung/napas" />
        <TSel label="Hasil" value={f.hasil ?? ""} onChange={v => set("hasil", v)} options={["", "ROSC", "Stabil", "Rujuk ICU", "Meninggal"]} />
        <TInput label="Ketua Tim" value={f.ketua_tim ?? ""} onChange={v => set("ketua_tim", v)} />
        <TArea label="Tindakan (RJP/defibrilasi/obat)" value={f.tindakan ?? ""} onChange={v => set("tindakan", v)} />
        <TArea label="Catatan" value={f.catatan ?? ""} onChange={v => set("catatan", v)} />
      </div>
      <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button><button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div></div>}
    <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Tgl</th><th className="px-3 py-2 text-left">Lokasi</th><th className="px-3 py-2 text-left">Pasien</th><th className="px-3 py-2 text-right">Respons</th><th className="px-3 py-2 text-left">Hasil</th><th className="px-3 py-2"></th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> : rows.map(r => <tr key={r.id} className="hover:bg-slate-50"><td className="px-3 py-2 whitespace-nowrap">{r.tanggal} {r.jam_aktivasi}</td><td className="px-3 py-2 text-xs">{r.lokasi ?? "-"}</td><td className="px-3 py-2">{r.nama_pasien ?? "-"}</td><td className="px-3 py-2 text-right tabular-nums">{r.response_menit != null ? `${r.response_menit} mnt` : "-"}</td><td className="px-3 py-2 text-xs">{r.hasil ?? "-"}</td><td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td></tr>)}</tbody></table></div>
  </div>;
}

function TabApar({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<MfkApar[]>([]); const [f, setF] = useState<Partial<MfkApar> | null>(null);
  const load = useCallback(() => { mfkAparList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof MfkApar, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f) return; try { if (f.id) await mfkAparUpdate(f.id, f); else await mfkAparCreate(f); setF(null); load(); } catch { alert("Gagal"); } }
  async function hapus(id: number) { if (confirm("Hapus?")) { await mfkAparDelete(id); load(); } }
  return <div className="space-y-3">
    {isEdit && !f && <button onClick={() => setF({ tanggal_inspeksi: todayISO(), kondisi: "Baik", tekanan_ok: 1, segel_ok: 1, selang_ok: 1 })} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Inspeksi APAR</button>}
    {f && <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2"><div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Inspeksi APAR/Hidran</div>
      <div className="grid grid-cols-2 gap-2">
        <TInput label="Tanggal Inspeksi" type="date" value={f.tanggal_inspeksi ?? ""} onChange={v => set("tanggal_inspeksi", v)} />
        <TInput label="No. APAR" value={f.no_apar ?? ""} onChange={v => set("no_apar", v)} />
        <TInput label="Lokasi" value={f.lokasi ?? ""} onChange={v => set("lokasi", v)} />
        <TSel label="Jenis" value={f.jenis ?? ""} onChange={v => set("jenis", v)} options={["", "Powder", "CO2", "Foam", "Hidran"]} />
        <TInput label="Tgl Kadaluarsa" type="date" value={f.tgl_kadaluarsa ?? ""} onChange={v => set("tgl_kadaluarsa", v)} />
        <TSel label="Kondisi" value={f.kondisi ?? "Baik"} onChange={v => set("kondisi", v)} options={["Baik", "Perlu Isi Ulang", "Rusak"]} />
      </div>
      <div className="flex flex-wrap gap-4 bg-slate-50 rounded-lg p-2">
        <Chk label="Tekanan OK" checked={!!f.tekanan_ok} onChange={v => set("tekanan_ok", v ? 1 : 0)} />
        <Chk label="Segel OK" checked={!!f.segel_ok} onChange={v => set("segel_ok", v ? 1 : 0)} />
        <Chk label="Selang OK" checked={!!f.selang_ok} onChange={v => set("selang_ok", v ? 1 : 0)} />
      </div>
      <div className="grid grid-cols-2 gap-2"><TArea label="Tindak Lanjut" value={f.tindak_lanjut ?? ""} onChange={v => set("tindak_lanjut", v)} /></div>
      <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button><button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div></div>}
    <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Tgl</th><th className="px-3 py-2 text-left">No/Lokasi</th><th className="px-3 py-2 text-left">Jenis</th><th className="px-3 py-2 text-left">Kadaluarsa</th><th className="px-3 py-2 text-left">Kondisi</th><th className="px-3 py-2"></th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> : rows.map(r => <tr key={r.id} className="hover:bg-slate-50"><td className="px-3 py-2 whitespace-nowrap">{r.tanggal_inspeksi}</td><td className="px-3 py-2 text-xs">{r.no_apar} · {r.lokasi}</td><td className="px-3 py-2 text-xs">{r.jenis ?? "-"}</td><td className="px-3 py-2 text-xs">{r.tgl_kadaluarsa ?? "-"}</td><td className="px-3 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${r.kondisi === "Baik" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{r.kondisi}</span></td><td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td></tr>)}</tbody></table></div>
  </div>;
}

function TabUtil({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<MfkUtil[]>([]); const [f, setF] = useState<Partial<MfkUtil> | null>(null);
  const load = useCallback(() => { mfkUtilList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof MfkUtil, v: string) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f) return; try { if (f.id) await mfkUtilUpdate(f.id, f); else await mfkUtilCreate(f); setF(null); load(); } catch { alert("Gagal"); } }
  async function hapus(id: number) { if (confirm("Hapus?")) { await mfkUtilDelete(id); load(); } }
  return <div className="space-y-3">
    {isEdit && !f && <button onClick={() => setF({ tanggal: todayISO(), jenis_utilitas: "Genset", status: "Normal" })} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Monitoring Utilitas</button>}
    {f && <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2"><div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Monitoring Utilitas</div>
      <div className="grid grid-cols-2 gap-2">
        <TInput label="Tanggal" type="date" value={f.tanggal ?? ""} onChange={v => set("tanggal", v)} />
        <TInput label="Jam" value={f.jam ?? ""} onChange={v => set("jam", v)} placeholder="HH:MM" />
        <TSel label="Jenis Utilitas" value={f.jenis_utilitas ?? "Genset"} onChange={v => set("jenis_utilitas", v)} options={["Genset", "Listrik PLN", "Air", "Gas Medis", "Suction", "Boiler", "AC Sentral"]} />
        <TInput label="Parameter" value={f.parameter ?? ""} onChange={v => set("parameter", v)} placeholder="Tegangan/Tekanan O2/dll" />
        <TInput label="Nilai" value={f.nilai ?? ""} onChange={v => set("nilai", v)} />
        <TInput label="Satuan" value={f.satuan ?? ""} onChange={v => set("satuan", v)} />
        <TSel label="Status" value={f.status ?? "Normal"} onChange={v => set("status", v)} options={["Normal", "Gangguan"]} />
        <TArea label="Keterangan" value={f.keterangan ?? ""} onChange={v => set("keterangan", v)} />
      </div>
      <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button><button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div></div>}
    <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Tgl/Jam</th><th className="px-3 py-2 text-left">Utilitas</th><th className="px-3 py-2 text-left">Parameter</th><th className="px-3 py-2 text-left">Nilai</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2"></th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> : rows.map(r => <tr key={r.id} className="hover:bg-slate-50"><td className="px-3 py-2 whitespace-nowrap">{r.tanggal} {r.jam}</td><td className="px-3 py-2">{r.jenis_utilitas}</td><td className="px-3 py-2 text-xs">{r.parameter ?? "-"}</td><td className="px-3 py-2 text-xs">{r.nilai} {r.satuan}</td><td className="px-3 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${r.status === "Normal" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{r.status}</span></td><td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td></tr>)}</tbody></table></div>
  </div>;
}

const SKALA03 = ["0", "1", "2", "3"];
function TabHva({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<MfkHva[]>([]); const [f, setF] = useState<Partial<MfkHva> | null>(null);
  const load = useCallback(() => { mfkHvaList(nowY).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof MfkHva, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f || !f.jenis_bahaya?.trim()) { alert("Jenis bahaya wajib"); return; } try { if (f.id) await mfkHvaUpdate(f.id, f); else await mfkHvaCreate(f); setF(null); load(); } catch { alert("Gagal"); } }
  async function hapus(id: number) { if (confirm("Hapus?")) { await mfkHvaDelete(id); load(); } }
  return <div className="space-y-3">
    <div className="text-xs text-slate-500">HVA (Hazard Vulnerability Analysis) — penilaian kerentanan bencana tahunan. Skala 0-3. Skor risiko relatif tertinggi jadi prioritas mitigasi.</div>
    {isEdit && !f && <button onClick={() => setF({ tahun: nowY, jenis_bahaya: "", probabilitas: 0, dampak_manusia: 0, dampak_properti: 0, dampak_bisnis: 0, kesiapan: 0 })} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Bahaya (HVA)</button>}
    {f && <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2"><div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} HVA</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <TInput label="Jenis Bahaya" value={f.jenis_bahaya ?? ""} onChange={v => set("jenis_bahaya", v)} placeholder="Kebakaran/Gempa/Banjir/Wabah" />
        <TSel label="Kategori" value={f.kategori ?? ""} onChange={v => set("kategori", v)} options={["", "Alam", "Teknologi", "Manusia", "Bahan Berbahaya"]} />
        <TSel label="Probabilitas (0-3)" value={String(f.probabilitas ?? 0)} onChange={v => set("probabilitas", Number(v))} options={SKALA03} />
        <TSel label="Kesiapan (0-3)" value={String(f.kesiapan ?? 0)} onChange={v => set("kesiapan", Number(v))} options={SKALA03} />
        <TSel label="Dampak Manusia" value={String(f.dampak_manusia ?? 0)} onChange={v => set("dampak_manusia", Number(v))} options={SKALA03} />
        <TSel label="Dampak Properti" value={String(f.dampak_properti ?? 0)} onChange={v => set("dampak_properti", Number(v))} options={SKALA03} />
        <TSel label="Dampak Bisnis" value={String(f.dampak_bisnis ?? 0)} onChange={v => set("dampak_bisnis", Number(v))} options={SKALA03} />
      </div>
      <div className="grid grid-cols-2 gap-2"><TArea label="Rencana Mitigasi" value={f.mitigasi ?? ""} onChange={v => set("mitigasi", v)} /></div>
      <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button><button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div></div>}
    <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Bahaya</th><th className="px-3 py-2 text-left">Kategori</th><th className="px-3 py-2 text-center">Prob</th><th className="px-3 py-2 text-center">Dampak (M/P/B)</th><th className="px-3 py-2 text-right">Skor Risiko</th><th className="px-3 py-2"></th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> : rows.map((r, i) => <tr key={r.id} className="hover:bg-slate-50"><td className="px-3 py-2 font-bold text-slate-400">{i + 1}</td><td className="px-3 py-2 font-medium">{r.jenis_bahaya}</td><td className="px-3 py-2 text-xs">{r.kategori ?? "-"}</td><td className="px-3 py-2 text-center">{r.probabilitas}</td><td className="px-3 py-2 text-center text-xs">{r.dampak_manusia}/{r.dampak_properti}/{r.dampak_bisnis}</td><td className={`px-3 py-2 text-right font-bold tabular-nums ${(r.skor ?? 0) >= 50 ? "text-rose-700" : (r.skor ?? 0) >= 25 ? "text-amber-700" : "text-emerald-700"}`}>{r.skor != null ? `${r.skor.toFixed(0)}%` : "—"}</td><td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td></tr>)}</tbody></table></div>
  </div>;
}
