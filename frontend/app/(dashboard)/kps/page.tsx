"use client";

// KPS — Kredensial & Kewenangan Klinis (RKK/SPK) + Diklat Staf (STARKES KPS).

import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import MicButton from "@/components/MicButton";
import {
  kredList, kredCreate, kredUpdate, kredDelete,
  diklatList, diklatCreate, diklatUpdate, diklatDelete, kpsRekap,
  kinerjaList, kinerjaCreate, kinerjaUpdate, kinerjaDelete,
  Kredensial, Diklat, KpsRekap, Kinerja,
} from "@/lib/api";

const nowY = new Date().getFullYear();
const todayISO = () => new Date().toISOString().slice(0, 10);
const PROFESI = ["Dokter", "Dokter Spesialis", "Perawat", "Bidan", "Apoteker", "Nakes Lain"];
const REKOM = ["", "Disetujui", "Dengan Supervisi", "Ditolak"];

function TInput({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <label className="text-xs text-slate-500 block">{label}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800" /></label>;
}
function TSel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return <label className="text-xs text-slate-500 block">{label}
    <select value={value} onChange={e => onChange(e.target.value)} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800 bg-white">
      {options.map(o => <option key={o} value={o}>{o || "—"}</option>)}</select></label>;
}
function TArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="text-xs text-slate-500 block col-span-2">{label}
    <div className="relative mt-0.5"><textarea value={value} onChange={e => onChange(e.target.value)} rows={2}
      className="block w-full border border-slate-300 rounded-lg px-2 py-1.5 pr-8 text-sm text-slate-800" />
      <MicButton value={value} onChange={onChange} className="absolute right-1.5 bottom-1.5" /></div></label>;
}
function Stat({ label, value, color = "blue" }: { label: string; value: string | number; color?: string }) {
  const c: Record<string, string> = { blue: "bg-blue-50 border-blue-200 text-blue-700", amber: "bg-amber-50 border-amber-200 text-amber-700", rose: "bg-rose-50 border-rose-200 text-rose-700", emerald: "bg-emerald-50 border-emerald-200 text-emerald-700" };
  return <div className={`rounded-lg border p-3 ${c[color]}`}><div className="text-xs">{label}</div><div className="text-2xl font-bold text-slate-900">{value}</div></div>;
}
// Badge tanggal berlaku: merah bila lewat, amber bila ≤90 hari.
function ExpiryCell({ tgl }: { tgl?: string }) {
  if (!tgl) return <span className="text-slate-300">—</span>;
  const d = new Date(tgl).getTime(); const now = Date.now(); const days = (d - now) / 86400000;
  const cls = days < 0 ? "text-rose-700 font-semibold" : days <= 90 ? "text-amber-700 font-semibold" : "text-slate-600";
  return <span className={cls}>{tgl}{days < 0 ? " ⚠️" : days <= 90 ? " ⏳" : ""}</span>;
}

export default function KpsPage() {
  const isEdit = hasPerm("kps_edit") || hasPerm("kepegawaian_edit") || hasPerm("akreditasi_edit");
  const [tab, setTab] = useState<"kredensial" | "diklat" | "kinerja">("kredensial");
  const [rekap, setRekap] = useState<KpsRekap | null>(null);
  useEffect(() => { kpsRekap().then(r => setRekap(r.data)).catch(() => {}); }, [tab]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">🎓 KPS — Kredensial & Diklat Staf</h1>
        <p className="text-sm text-slate-500">Kredensial/RKK/SPK, masa berlaku STR & SIP, dan riwayat pelatihan staf.</p>
      </div>
      {rekap && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <Stat label="Total Kredensial" value={rekap.total_kredensial} color="blue" />
          <Stat label="STR ≤90 hari" value={rekap.str_segera_habis} color="amber" />
          <Stat label="STR Kedaluwarsa" value={rekap.str_kedaluwarsa} color="rose" />
          <Stat label="SIP ≤90 hari" value={rekap.sip_segera_habis} color="amber" />
          <Stat label={`Diklat ${rekap.tahun}`} value={rekap.diklat_tahun} color="emerald" />
          <Stat label={`Total JPL ${rekap.tahun}`} value={rekap.jpl_tahun} color="emerald" />
        </div>
      )}
      <div className="flex gap-1 border-b border-slate-200">
        {([["kredensial", "Kredensial & RKK"], ["diklat", "Diklat / Pelatihan"], ["kinerja", "Penilaian Kinerja (OPPE)"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
        ))}
      </div>
      {tab === "kredensial" ? <TabKred isEdit={isEdit} /> : tab === "diklat" ? <TabDiklat isEdit={isEdit} /> : <TabKinerja isEdit={isEdit} />}
    </div>
  );
}

function emptyKred(): Partial<Kredensial> { return { nama: "", jenis: "Kredensial Awal", status: "Aktif", profesi: "Perawat" }; }
function TabKred({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<Kredensial[]>([]);
  const [f, setF] = useState<Partial<Kredensial> | null>(null);
  const [segera, setSegera] = useState(false);
  const load = useCallback(() => { kredList({ segera_habis: segera ? 1 : 0 }).then(r => setRows(r.data)).catch(() => setRows([])); }, [segera]);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof Kredensial, v: string) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f || !f.nama?.trim()) { alert("Nama wajib"); return; } try { if (f.id) await kredUpdate(f.id, f); else await kredCreate(f); setF(null); load(); } catch { alert("Gagal menyimpan"); } }
  async function hapus(id: number) { if (confirm("Hapus kredensial ini?")) { await kredDelete(id); load(); } }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {isEdit && !f && <button onClick={() => setF(emptyKred())} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Kredensial</button>}
        <label className="text-xs text-slate-600 flex items-center gap-1.5"><input type="checkbox" checked={segera} onChange={e => setSegera(e.target.checked)} className="h-4 w-4" /> Hanya STR/SIP ≤ 90 hari</label>
      </div>
      {f && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Kredensial</div>
          <div className="grid grid-cols-2 gap-2">
            <TInput label="NIP" value={f.nip ?? ""} onChange={v => set("nip", v)} />
            <TInput label="Nama *" value={f.nama ?? ""} onChange={v => set("nama", v)} />
            <TSel label="Profesi" value={f.profesi ?? "Perawat"} onChange={v => set("profesi", v)} options={PROFESI} />
            <TSel label="Jenis" value={f.jenis ?? "Kredensial Awal"} onChange={v => set("jenis", v)} options={["Kredensial Awal", "Rekredensial"]} />
            <TInput label="Tanggal Kredensial" type="date" value={f.tanggal_kredensial ?? ""} onChange={v => set("tanggal_kredensial", v)} />
            <TSel label="Rekomendasi" value={f.rekomendasi ?? ""} onChange={v => set("rekomendasi", v)} options={REKOM} />
            <TInput label="No. STR" value={f.str_nomor ?? ""} onChange={v => set("str_nomor", v)} />
            <TInput label="STR Berlaku s/d" type="date" value={f.str_berlaku ?? ""} onChange={v => set("str_berlaku", v)} />
            <TInput label="No. SIP" value={f.sip_nomor ?? ""} onChange={v => set("sip_nomor", v)} />
            <TInput label="SIP Berlaku s/d" type="date" value={f.sip_berlaku ?? ""} onChange={v => set("sip_berlaku", v)} />
            <TInput label="SPK Berlaku s/d" type="date" value={f.spk_berlaku ?? ""} onChange={v => set("spk_berlaku", v)} />
            <TSel label="Status" value={f.status ?? "Aktif"} onChange={v => set("status", v)} options={["Aktif", "Kedaluwarsa", "Dicabut"]} />
            <TArea label="Rincian Kewenangan Klinis (RKK)" value={f.rkk ?? ""} onChange={v => set("rkk", v)} />
            <TArea label="Catatan" value={f.catatan ?? ""} onChange={v => set("catatan", v)} />
          </div>
          <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button>
            <button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Nama</th><th className="px-3 py-2 text-left">Profesi</th><th className="px-3 py-2 text-left">Rekomendasi</th><th className="px-3 py-2 text-left">STR s/d</th><th className="px-3 py-2 text-left">SIP s/d</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> :
              rows.map(r => <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">{r.nama}<div className="text-[11px] text-slate-400 font-mono">{r.nip}</div></td>
                <td className="px-3 py-2 text-xs">{r.profesi ?? "-"}</td><td className="px-3 py-2 text-xs">{r.rekomendasi ?? "-"}</td>
                <td className="px-3 py-2 text-xs"><ExpiryCell tgl={r.str_berlaku} /></td><td className="px-3 py-2 text-xs"><ExpiryCell tgl={r.sip_berlaku} /></td>
                <td className="px-3 py-2 text-xs">{r.status}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function emptyDik(): Partial<Diklat> { return { nama: "", nama_pelatihan: "", jenis: "Internal", tanggal_mulai: todayISO() }; }
function TabDiklat({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<Diklat[]>([]);
  const [f, setF] = useState<Partial<Diklat> | null>(null);
  const load = useCallback(() => { diklatList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof Diklat, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f || !f.nama?.trim() || !f.nama_pelatihan?.trim()) { alert("Nama & pelatihan wajib"); return; } try { if (f.id) await diklatUpdate(f.id, f); else await diklatCreate(f); setF(null); load(); } catch { alert("Gagal menyimpan"); } }
  async function hapus(id: number) { if (confirm("Hapus diklat ini?")) { await diklatDelete(id); load(); } }
  return (
    <div className="space-y-3">
      {isEdit && !f && <button onClick={() => setF(emptyDik())} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Diklat</button>}
      {f && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Diklat / Pelatihan</div>
          <div className="grid grid-cols-2 gap-2">
            <TInput label="NIP" value={f.nip ?? ""} onChange={v => set("nip", v)} />
            <TInput label="Nama Staf *" value={f.nama ?? ""} onChange={v => set("nama", v)} />
            <TInput label="Nama Pelatihan *" value={f.nama_pelatihan ?? ""} onChange={v => set("nama_pelatihan", v)} />
            <TInput label="Penyelenggara" value={f.penyelenggara ?? ""} onChange={v => set("penyelenggara", v)} />
            <TSel label="Jenis" value={f.jenis ?? "Internal"} onChange={v => set("jenis", v)} options={["Internal", "Eksternal"]} />
            <TInput label="JPL (jam)" type="number" value={String(f.jpl ?? "")} onChange={v => set("jpl", Number(v) || 0)} />
            <TInput label="Tanggal Mulai" type="date" value={f.tanggal_mulai ?? ""} onChange={v => set("tanggal_mulai", v)} />
            <TInput label="Tanggal Selesai" type="date" value={f.tanggal_selesai ?? ""} onChange={v => set("tanggal_selesai", v)} />
            <TInput label="No. Sertifikat" value={f.sertifikat_no ?? ""} onChange={v => set("sertifikat_no", v)} />
            <TInput label="Berlaku s/d" type="date" value={f.berlaku_sampai ?? ""} onChange={v => set("berlaku_sampai", v)} />
            <TArea label="Catatan" value={f.catatan ?? ""} onChange={v => set("catatan", v)} />
          </div>
          <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button>
            <button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Tgl</th><th className="px-3 py-2 text-left">Staf</th><th className="px-3 py-2 text-left">Pelatihan</th><th className="px-3 py-2 text-left">Jenis</th><th className="px-3 py-2 text-right">JPL</th><th className="px-3 py-2"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> :
              rows.map(r => <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap text-xs">{r.tanggal_mulai}</td>
                <td className="px-3 py-2">{r.nama}<div className="text-[11px] text-slate-400 font-mono">{r.nip}</div></td>
                <td className="px-3 py-2">{r.nama_pelatihan}<div className="text-[11px] text-slate-400">{r.penyelenggara}</div></td>
                <td className="px-3 py-2 text-xs">{r.jenis}</td><td className="px-3 py-2 text-right tabular-nums">{r.jpl ?? "-"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const JENIS_KIN = ["OPPE", "FPPE", "Penilaian Kinerja"];
function catColor(k?: string) { if (k === "Baik Sekali") return "bg-emerald-100 text-emerald-700"; if (k === "Baik") return "bg-sky-100 text-sky-700"; if (k === "Cukup") return "bg-amber-100 text-amber-700"; if (k === "Kurang") return "bg-rose-100 text-rose-700"; return "bg-slate-100 text-slate-600"; }
function TabKinerja({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<Kinerja[]>([]);
  const [f, setF] = useState<Partial<Kinerja> | null>(null);
  const load = useCallback(() => { kinerjaList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof Kinerja, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f || !f.nama?.trim()) { alert("Nama wajib"); return; } try { if (f.id) await kinerjaUpdate(f.id, f); else await kinerjaCreate(f); setF(null); load(); } catch { alert("Gagal menyimpan"); } }
  async function hapus(id: number) { if (confirm("Hapus penilaian ini?")) { await kinerjaDelete(id); load(); } }
  return (
    <div className="space-y-3">
      {isEdit && !f && <button onClick={() => setF({ tanggal: todayISO(), jenis: "OPPE", profesi: "Dokter" })} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Penilaian Kinerja</button>}
      {f && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Penilaian Kinerja (OPPE/FPPE)</div>
          <div className="grid grid-cols-2 gap-2">
            <TInput label="Tanggal" type="date" value={f.tanggal ?? ""} onChange={v => set("tanggal", v)} />
            <TSel label="Jenis" value={f.jenis ?? "OPPE"} onChange={v => set("jenis", v)} options={JENIS_KIN} />
            <TInput label="Nama *" value={f.nama ?? ""} onChange={v => set("nama", v)} />
            <TInput label="NIP" value={f.nip ?? ""} onChange={v => set("nip", v)} />
            <TSel label="Profesi" value={f.profesi ?? "Dokter"} onChange={v => set("profesi", v)} options={PROFESI} />
            <TInput label="Periode" value={f.periode ?? ""} onChange={v => set("periode", v)} placeholder="2026-S1" />
            <TInput label="Nilai (0-100)" type="number" value={String(f.nilai ?? "")} onChange={v => set("nilai", Number(v) || 0)} />
            <TInput label="Penilai" value={f.penilai ?? ""} onChange={v => set("penilai", v)} />
            <TInput label="Rekomendasi" value={f.rekomendasi ?? ""} onChange={v => set("rekomendasi", v)} placeholder="Lanjut/Pembinaan/Kewenangan dikurangi" />
            <TArea label="Aspek yang Dinilai" value={f.aspek ?? ""} onChange={v => set("aspek", v)} />
            <TArea label="Catatan" value={f.catatan ?? ""} onChange={v => set("catatan", v)} />
          </div>
          <div className="text-xs text-slate-500">Kategori otomatis: Baik Sekali ≥85 · Baik ≥70 · Cukup ≥55 · Kurang &lt;55.</div>
          <div className="flex gap-2"><button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button>
            <button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button></div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Tgl</th><th className="px-3 py-2 text-left">Nama</th><th className="px-3 py-2 text-left">Jenis</th><th className="px-3 py-2 text-left">Periode</th><th className="px-3 py-2 text-right">Nilai</th><th className="px-3 py-2 text-center">Kategori</th><th className="px-3 py-2"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> :
              rows.map(r => <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">{r.tanggal}</td>
                <td className="px-3 py-2 font-medium">{r.nama}<div className="text-[11px] text-slate-400">{r.profesi}</div></td>
                <td className="px-3 py-2 text-xs">{r.jenis}</td><td className="px-3 py-2 text-xs">{r.periode ?? "-"}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums">{r.nilai != null ? r.nilai.toFixed(0) : "—"}</td>
                <td className="px-3 py-2 text-center"><span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${catColor(r.kategori)}`}>{r.kategori ?? "—"}</span></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
