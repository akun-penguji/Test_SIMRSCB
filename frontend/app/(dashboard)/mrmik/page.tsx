"use client";

// MRMIK — register digital bab Manajemen Rekam Medik & Informasi Kesehatan (STARKES).
// 5 register: Pelepasan Informasi (MRMIK 10), Reviu RM Kualitatif (12/7/5),
// Koreksi RME (8), Formulir RM (6/7), Audit Akses (2.1).

import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import MicButton from "@/components/MicButton";
import {
  mrmikPelepasanList, mrmikPelepasanCreate, mrmikPelepasanUpdate, mrmikPelepasanDelete, mrmikPelepasanRekap,
  mrmikReviuList, mrmikReviuCreate, mrmikReviuUpdate, mrmikReviuDelete, mrmikReviuRekap,
  mrmikKoreksiList, mrmikKoreksiCreate, mrmikKoreksiUpdate, mrmikKoreksiDelete,
  mrmikFormulirList, mrmikFormulirCreate, mrmikFormulirUpdate, mrmikFormulirDelete,
  mrmikAksesLogin, mrmikAksesHak,
  MrmikPelepasan, MrmikReviu, MrmikKoreksi, MrmikFormulir, MrmikLoginRow, MrmikHakRow, MrmikPelRekap, MrmikReviuRekap,
} from "@/lib/api";

const nowY = new Date().getFullYear();
const todayISO = () => new Date().toISOString().slice(0, 10);

// ── field helpers ────────────────────────────────────────────────────────────
function TInput({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="text-xs text-slate-500 block">{label}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800" />
    </label>
  );
}
function TSel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="text-xs text-slate-500 block">{label}
      <select value={value} onChange={e => onChange(e.target.value)}
        className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-800 bg-white">
        {options.map(o => <option key={o} value={o}>{o || "—"}</option>)}
      </select>
    </label>
  );
}
function TArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-xs text-slate-500 block col-span-2">{label}
      <div className="relative mt-0.5">
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={2}
          className="block w-full border border-slate-300 rounded-lg px-2 py-1.5 pr-8 text-sm text-slate-800" />
        <MicButton value={value} onChange={onChange} className="absolute right-1.5 bottom-1.5" />
      </div>
    </label>
  );
}
function Chk({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}

export default function MrmikPage() {
  const isEdit = hasPerm("mrmik_edit") || hasPerm("rekam_medis") || hasPerm("akreditasi_edit");
  const [tab, setTab] = useState<"pelepasan" | "reviu" | "koreksi" | "formulir" | "akses">("pelepasan");
  const TABS: [typeof tab, string][] = [
    ["pelepasan", "Pelepasan Informasi"], ["reviu", "Reviu RM Kualitatif"],
    ["koreksi", "Koreksi RME"], ["formulir", "Formulir RM"], ["akses", "Audit Akses"],
  ];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">📁 MRMIK — Rekam Medik & Informasi Kesehatan</h1>
        <p className="text-sm text-slate-500">Register digital untuk bukti akreditasi bab MRMIK (STARKES).</p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
        ))}
      </div>
      {tab === "pelepasan" && <TabPelepasan isEdit={isEdit} />}
      {tab === "reviu" && <TabReviu isEdit={isEdit} />}
      {tab === "koreksi" && <TabKoreksi isEdit={isEdit} />}
      {tab === "formulir" && <TabFormulir isEdit={isEdit} />}
      {tab === "akses" && <TabAkses />}
    </div>
  );
}

// ── #1 Pelepasan Informasi Medis ─────────────────────────────────────────────
const TUJUAN = ["", "Asuransi", "Hukum", "BPJS", "Visum", "Klaim", "Pasien", "Lainnya"];
const CARA = ["", "Fotokopi", "Elektronik", "Lihat di Tempat"];
const STATUS_PEL = ["Diajukan", "Disetujui", "Ditolak", "Selesai"];
function emptyPel(): Partial<MrmikPelepasan> { return { tanggal: todayISO(), status: "Diajukan", tujuan: "", hubungan: "Pasien Sendiri", cara_pemberian: "" }; }
function TabPelepasan({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<MrmikPelepasan[]>([]);
  const [rekap, setRekap] = useState<MrmikPelRekap | null>(null);
  const [f, setF] = useState<Partial<MrmikPelepasan> | null>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => {
    mrmikPelepasanList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([]));
    mrmikPelepasanRekap(nowY).then(r => setRekap(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof MrmikPelepasan, v: string) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() {
    if (!f) return;
    try {
      if (f.id) await mrmikPelepasanUpdate(f.id, f); else await mrmikPelepasanCreate(f);
      setF(null); setMsg("Tersimpan."); load();
    } catch (e) { setMsg((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Gagal menyimpan"); }
  }
  async function hapus(id: number) { if (confirm("Hapus data pelepasan ini?")) { await mrmikPelepasanDelete(id); load(); } }

  return (
    <div className="space-y-3">
      {rekap && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatCard label={`Total ${nowY}`} value={rekap.total} color="blue" />
          {rekap.per_status.slice(0, 3).map(s => <StatCard key={s.label} label={s.label ?? "-"} value={s.total} color="slate" />)}
        </div>
      )}
      {msg && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{msg}</div>}
      {isEdit && !f && <button onClick={() => setF(emptyPel())} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Pelepasan Informasi</button>}

      {f && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Pelepasan Informasi Medis</div>
          <div className="grid grid-cols-2 gap-2">
            <TInput label="Tanggal" type="date" value={f.tanggal ?? ""} onChange={v => set("tanggal", v)} />
            <TSel label="Status" value={f.status ?? "Diajukan"} onChange={v => set("status", v)} options={STATUS_PEL} />
            <TInput label="No. RM" value={f.no_rkm_medis ?? ""} onChange={v => set("no_rkm_medis", v)} />
            <TInput label="Nama Pasien" value={f.nama_pasien ?? ""} onChange={v => set("nama_pasien", v)} />
            <TInput label="Pemohon" value={f.pemohon ?? ""} onChange={v => set("pemohon", v)} />
            <TSel label="Hubungan" value={f.hubungan ?? ""} onChange={v => set("hubungan", v)} options={["Pasien Sendiri", "Keluarga", "Instansi", "Kuasa Hukum"]} />
            <TInput label="Instansi (bila ada)" value={f.instansi ?? ""} onChange={v => set("instansi", v)} />
            <TSel label="Tujuan" value={f.tujuan ?? ""} onChange={v => set("tujuan", v)} options={TUJUAN} />
            <TInput label="Jenis Dokumen" value={f.jenis_dokumen ?? ""} onChange={v => set("jenis_dokumen", v)} placeholder="Resume / RM Lengkap / Hasil Penunjang" />
            <TSel label="Cara Pemberian" value={f.cara_pemberian ?? ""} onChange={v => set("cara_pemberian", v)} options={CARA} />
            <TInput label="Disetujui Oleh" value={f.disetujui_oleh ?? ""} onChange={v => set("disetujui_oleh", v)} />
            <TInput label="Tgl Selesai" type="date" value={f.tgl_selesai ?? ""} onChange={v => set("tgl_selesai", v)} />
            <TArea label="Catatan" value={f.catatan ?? ""} onChange={v => set("catatan", v)} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button>
            <button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr>
            <th className="px-3 py-2 text-left">Tgl</th><th className="px-3 py-2 text-left">Pasien</th><th className="px-3 py-2 text-left">Pemohon</th>
            <th className="px-3 py-2 text-left">Tujuan</th><th className="px-3 py-2 text-left">Dokumen</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> :
              rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap">{r.tanggal}</td>
                  <td className="px-3 py-2"><div className="font-medium text-slate-800">{r.nama_pasien ?? "-"}</div><div className="text-[11px] text-slate-400 font-mono">{r.no_rkm_medis}</div></td>
                  <td className="px-3 py-2">{r.pemohon ?? "-"}<div className="text-[11px] text-slate-400">{r.hubungan}{r.instansi ? ` · ${r.instansi}` : ""}</div></td>
                  <td className="px-3 py-2">{r.tujuan ?? "-"}</td>
                  <td className="px-3 py-2 text-xs">{r.jenis_dokumen ?? "-"}<div className="text-[11px] text-slate-400">{r.cara_pemberian}</div></td>
                  <td className="px-3 py-2"><StatusPill s={r.status} /></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button>
                    <button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── #2 Reviu RM Kualitatif ───────────────────────────────────────────────────
function emptyRev(): Partial<MrmikReviu> { return { tanggal: todayISO(), jenis_reviu: "Tertutup", ketepatan_waktu: 0, keterbacaan: 0, kelengkapan: 0, kesesuaian_isi: 0 }; }
function TabReviu({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<MrmikReviu[]>([]);
  const [rekap, setRekap] = useState<MrmikReviuRekap | null>(null);
  const [f, setF] = useState<Partial<MrmikReviu> | null>(null);
  const load = useCallback(() => {
    mrmikReviuList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([]));
    mrmikReviuRekap(nowY).then(r => setRekap(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof MrmikReviu, v: string | number) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f) return; try { if (f.id) await mrmikReviuUpdate(f.id, f); else await mrmikReviuCreate(f); setF(null); load(); } catch { alert("Gagal menyimpan"); } }
  async function hapus(id: number) { if (confirm("Hapus reviu ini?")) { await mrmikReviuDelete(id); load(); } }
  const b = (n: number) => n ? 1 : 0;

  return (
    <div className="space-y-3">
      {rekap && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <StatCard label={`Reviu ${nowY}`} value={rekap.total} color="blue" />
          <StatCard label="Rata Skor" value={rekap.avg_skor != null ? `${rekap.avg_skor.toFixed(0)}%` : "—"} color="emerald" />
          <StatCard label="Ketepatan Waktu" value={rekap.pct_ketepatan_waktu != null ? `${rekap.pct_ketepatan_waktu.toFixed(0)}%` : "—"} color="slate" />
          <StatCard label="Keterbacaan" value={rekap.pct_keterbacaan != null ? `${rekap.pct_keterbacaan.toFixed(0)}%` : "—"} color="slate" />
          <StatCard label="Kelengkapan" value={rekap.pct_kelengkapan != null ? `${rekap.pct_kelengkapan.toFixed(0)}%` : "—"} color="slate" />
        </div>
      )}
      {isEdit && !f && <button onClick={() => setF(emptyRev())} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Reviu RM</button>}
      {f && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Reviu RM Kualitatif</div>
          <div className="grid grid-cols-2 gap-2">
            <TInput label="Tanggal" type="date" value={f.tanggal ?? ""} onChange={v => set("tanggal", v)} />
            <TSel label="Jenis Reviu" value={f.jenis_reviu ?? "Tertutup"} onChange={v => set("jenis_reviu", v)} options={["Tertutup", "Terbuka"]} />
            <TInput label="No. Rawat" value={f.no_rawat ?? ""} onChange={v => set("no_rawat", v)} />
            <TInput label="Nama Pasien" value={f.nama_pasien ?? ""} onChange={v => set("nama_pasien", v)} />
          </div>
          <div className="grid grid-cols-2 gap-1.5 bg-slate-50 rounded-lg p-2">
            <Chk label="Ketepatan waktu pengisian" checked={!!f.ketepatan_waktu} onChange={v => set("ketepatan_waktu", v ? 1 : 0)} />
            <Chk label="Keterbacaan" checked={!!f.keterbacaan} onChange={v => set("keterbacaan", v ? 1 : 0)} />
            <Chk label="Kelengkapan RM" checked={!!f.kelengkapan} onChange={v => set("kelengkapan", v ? 1 : 0)} />
            <Chk label="Kesesuaian isi" checked={!!f.kesesuaian_isi} onChange={v => set("kesesuaian_isi", v ? 1 : 0)} />
          </div>
          <div className="text-sm font-bold text-rose-700">Skor: {((b(f.ketepatan_waktu ?? 0) + b(f.keterbacaan ?? 0) + b(f.kelengkapan ?? 0) + b(f.kesesuaian_isi ?? 0)) / 4 * 100).toFixed(0)}%</div>
          <div className="grid grid-cols-2 gap-2">
            <TInput label="Reviewer" value={f.reviewer ?? ""} onChange={v => set("reviewer", v)} />
            <TArea label="Catatan" value={f.catatan ?? ""} onChange={v => set("catatan", v)} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button>
            <button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr>
            <th className="px-3 py-2 text-left">Tgl</th><th className="px-3 py-2 text-left">Pasien</th><th className="px-3 py-2 text-left">Jenis</th>
            <th className="px-3 py-2 text-center">Tepat Waktu</th><th className="px-3 py-2 text-center">Terbaca</th><th className="px-3 py-2 text-center">Lengkap</th><th className="px-3 py-2 text-center">Sesuai</th>
            <th className="px-3 py-2 text-right">Skor</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td colSpan={9} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> :
              rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap">{r.tanggal}</td>
                  <td className="px-3 py-2">{r.nama_pasien ?? "-"}<div className="text-[11px] text-slate-400 font-mono">{r.no_rawat}</div></td>
                  <td className="px-3 py-2">{r.jenis_reviu}</td>
                  {[r.ketepatan_waktu, r.keterbacaan, r.kelengkapan, r.kesesuaian_isi].map((v, i) => <td key={i} className="px-3 py-2 text-center">{v ? "✓" : "—"}</td>)}
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{r.skor != null ? `${r.skor.toFixed(0)}%` : "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button>
                    <button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── #3 Koreksi RME ───────────────────────────────────────────────────────────
function emptyKor(): Partial<MrmikKoreksi> { return { tanggal: todayISO(), jenis_rm: "Elektronik" }; }
function TabKoreksi({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<MrmikKoreksi[]>([]);
  const [f, setF] = useState<Partial<MrmikKoreksi> | null>(null);
  const load = useCallback(() => { mrmikKoreksiList({ tahun: nowY }).then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof MrmikKoreksi, v: string) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f) return; try { if (f.id) await mrmikKoreksiUpdate(f.id, f); else await mrmikKoreksiCreate(f); setF(null); load(); } catch { alert("Gagal menyimpan"); } }
  async function hapus(id: number) { if (confirm("Hapus koreksi ini?")) { await mrmikKoreksiDelete(id); load(); } }
  return (
    <div className="space-y-3">
      {isEdit && !f && <button onClick={() => setF(emptyKor())} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Koreksi RME</button>}
      {f && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Koreksi Penulisan RME</div>
          <div className="grid grid-cols-2 gap-2">
            <TInput label="Tanggal" type="date" value={f.tanggal ?? ""} onChange={v => set("tanggal", v)} />
            <TSel label="Jenis RM" value={f.jenis_rm ?? "Elektronik"} onChange={v => set("jenis_rm", v)} options={["Elektronik", "Non-Elektronik"]} />
            <TInput label="No. Rawat" value={f.no_rawat ?? ""} onChange={v => set("no_rawat", v)} />
            <TInput label="Nama Pasien" value={f.nama_pasien ?? ""} onChange={v => set("nama_pasien", v)} />
            <TInput label="Formulir / Bagian" value={f.formulir ?? ""} onChange={v => set("formulir", v)} />
            <TInput label="Dikoreksi Oleh (PPA)" value={f.dikoreksi_oleh ?? ""} onChange={v => set("dikoreksi_oleh", v)} />
            <TArea label="Isi Lama" value={f.isi_lama ?? ""} onChange={v => set("isi_lama", v)} />
            <TArea label="Isi Baru" value={f.isi_baru ?? ""} onChange={v => set("isi_baru", v)} />
            <TArea label="Alasan Koreksi" value={f.alasan ?? ""} onChange={v => set("alasan", v)} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button>
            <button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr>
            <th className="px-3 py-2 text-left">Tgl</th><th className="px-3 py-2 text-left">Pasien</th><th className="px-3 py-2 text-left">Jenis</th>
            <th className="px-3 py-2 text-left">Formulir</th><th className="px-3 py-2 text-left">Lama → Baru</th><th className="px-3 py-2 text-left">PPA</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> :
              rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{r.tanggal}</td>
                  <td className="px-3 py-2">{r.nama_pasien ?? "-"}<div className="text-[11px] text-slate-400 font-mono">{r.no_rawat}</div></td>
                  <td className="px-3 py-2 text-xs">{r.jenis_rm}</td>
                  <td className="px-3 py-2 text-xs">{r.formulir ?? "-"}</td>
                  <td className="px-3 py-2 text-xs"><span className="text-rose-600 line-through">{r.isi_lama ?? ""}</span> → <span className="text-emerald-700">{r.isi_baru ?? ""}</span></td>
                  <td className="px-3 py-2 text-xs">{r.dikoreksi_oleh ?? "-"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button>
                    <button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── #4 Formulir RM ───────────────────────────────────────────────────────────
const STATUS_FRM = ["Aktif", "Revisi", "Tidak Berlaku"];
function emptyFrm(): Partial<MrmikFormulir> { return { nama_form: "", status: "Aktif" }; }
function TabFormulir({ isEdit }: { isEdit: boolean }) {
  const [rows, setRows] = useState<MrmikFormulir[]>([]);
  const [f, setF] = useState<Partial<MrmikFormulir> | null>(null);
  const load = useCallback(() => { mrmikFormulirList().then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof MrmikFormulir, v: string) => setF(p => ({ ...(p || {}), [k]: v }));
  async function save() { if (!f || !f.nama_form?.trim()) { alert("Nama formulir wajib"); return; } try { if (f.id) await mrmikFormulirUpdate(f.id, f); else await mrmikFormulirCreate(f); setF(null); load(); } catch { alert("Gagal menyimpan"); } }
  async function hapus(id: number) { if (confirm("Hapus formulir ini?")) { await mrmikFormulirDelete(id); load(); } }
  return (
    <div className="space-y-3">
      {isEdit && !f && <button onClick={() => setF(emptyFrm())} className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-xl">+ Formulir RM</button>}
      {f && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-sm font-bold text-slate-800">{f.id ? "Ubah" : "Tambah"} Formulir RM</div>
          <div className="grid grid-cols-2 gap-2">
            <TInput label="Kode Formulir" value={f.kode_form ?? ""} onChange={v => set("kode_form", v)} />
            <TInput label="Nama Formulir *" value={f.nama_form ?? ""} onChange={v => set("nama_form", v)} />
            <TInput label="Unit" value={f.unit ?? ""} onChange={v => set("unit", v)} />
            <TInput label="Versi" value={f.versi ?? ""} onChange={v => set("versi", v)} />
            <TInput label="Tgl Terbit" type="date" value={f.tgl_terbit ?? ""} onChange={v => set("tgl_terbit", v)} />
            <TInput label="Tgl Reviu" type="date" value={f.tgl_reviu ?? ""} onChange={v => set("tgl_reviu", v)} />
            <TSel label="Status" value={f.status ?? "Aktif"} onChange={v => set("status", v)} options={STATUS_FRM} />
            <TInput label="Direview Oleh" value={f.direview_oleh ?? ""} onChange={v => set("direview_oleh", v)} />
            <TArea label="Hasil Evaluasi" value={f.hasil_evaluasi ?? ""} onChange={v => set("hasil_evaluasi", v)} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Simpan</button>
            <button onClick={() => setF(null)} className="border border-slate-300 text-slate-600 text-sm px-4 py-2 rounded-lg">Batal</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs"><tr>
            <th className="px-3 py-2 text-left">Kode</th><th className="px-3 py-2 text-left">Nama Formulir</th><th className="px-3 py-2 text-left">Unit</th>
            <th className="px-3 py-2 text-left">Versi</th><th className="px-3 py-2 text-left">Tgl Reviu</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada data.</td></tr> :
              rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{r.kode_form ?? "-"}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{r.nama_form}</td>
                  <td className="px-3 py-2 text-xs">{r.unit ?? "-"}</td>
                  <td className="px-3 py-2 text-xs">{r.versi ?? "-"}</td>
                  <td className="px-3 py-2 text-xs">{r.tgl_reviu ?? "-"}</td>
                  <td className="px-3 py-2"><StatusPill s={r.status} /></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {isEdit && <><button onClick={() => setF(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button>
                    <button onClick={() => hapus(r.id)} className="text-red-500 text-xs font-semibold">Hapus</button></>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── #5 Audit Akses ───────────────────────────────────────────────────────────
function TabAkses() {
  const [sub, setSub] = useState<"login" | "hak">("login");
  const [login, setLogin] = useState<MrmikLoginRow[]>([]);
  const [hak, setHak] = useState<MrmikHakRow[]>([]);
  const [nip, setNip] = useState(""); const [awal, setAwal] = useState(""); const [akhir, setAkhir] = useState("");
  const [err, setErr] = useState("");
  const loadLogin = useCallback(() => { mrmikAksesLogin({ tgl_awal: awal, tgl_akhir: akhir, nip }).then(r => { setLogin(r.data.login); setErr(""); }).catch(e => setErr((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Gagal memuat")); }, [awal, akhir, nip]);
  useEffect(() => { if (sub === "login") loadLogin(); else mrmikAksesHak().then(r => { setHak(r.data.users); setErr(""); }).catch(e => setErr((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Gagal memuat")); }, [sub, loadLogin]);
  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["login", "hak"] as const).map(k => (
          <button key={k} onClick={() => setSub(k)} className={`text-xs font-semibold rounded-full px-3 py-1 border ${sub === k ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"}`}>
            {k === "login" ? "Riwayat Login" : "Daftar Hak Akses"}
          </button>
        ))}
      </div>
      {err && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</div>}
      {sub === "login" ? (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <TInput label="Dari Tgl" type="date" value={awal} onChange={setAwal} />
            <TInput label="Sampai Tgl" type="date" value={akhir} onChange={setAkhir} />
            <TInput label="NIP" value={nip} onChange={setNip} />
            <button onClick={loadLogin} className="bg-slate-700 text-white text-sm px-4 py-2 rounded-lg">Cari</button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">Tanggal</th><th className="px-3 py-2 text-left">Jam</th><th className="px-3 py-2 text-left">NIP</th><th className="px-3 py-2 text-left">Nama</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {login.length === 0 ? <tr><td colSpan={4} className="text-center text-slate-400 py-6">Tidak ada data.</td></tr> :
                  login.map((r, i) => <tr key={i} className="hover:bg-slate-50"><td className="px-3 py-2">{r.tgl_login}</td><td className="px-3 py-2 tabular-nums">{r.jam_login}</td><td className="px-3 py-2 font-mono text-xs">{r.nip}</td><td className="px-3 py-2">{r.nama ?? "-"}</td></tr>)}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="px-3 py-2 text-left">NIP</th><th className="px-3 py-2 text-left">Nama</th><th className="px-3 py-2 text-right">Jml Izin Web Aktif</th><th className="px-3 py-2 text-left">Login Terakhir</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {hak.length === 0 ? <tr><td colSpan={4} className="text-center text-slate-400 py-6">Tidak ada data.</td></tr> :
                hak.map((r, i) => <tr key={i} className="hover:bg-slate-50"><td className="px-3 py-2 font-mono text-xs">{r.nip}</td><td className="px-3 py-2">{r.nama ?? "-"}</td><td className="px-3 py-2 text-right tabular-nums">{r.jml_izin}</td><td className="px-3 py-2">{r.login_terakhir ?? "—"}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── shared UI ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const c: Record<string, string> = { blue: "bg-blue-50 border-blue-200 text-blue-700", emerald: "bg-emerald-50 border-emerald-200 text-emerald-700", slate: "bg-slate-50 border-slate-200 text-slate-600" };
  return <div className={`rounded-lg border p-3 ${c[color] ?? c.slate}`}><div className="text-xs">{label}</div><div className="text-2xl font-bold text-slate-900">{value}</div></div>;
}
function StatusPill({ s }: { s: string }) {
  const c: Record<string, string> = { Selesai: "bg-emerald-100 text-emerald-700", Disetujui: "bg-sky-100 text-sky-700", Diajukan: "bg-amber-100 text-amber-700", Ditolak: "bg-rose-100 text-rose-700", Aktif: "bg-emerald-100 text-emerald-700", Revisi: "bg-amber-100 text-amber-700", "Tidak Berlaku": "bg-slate-200 text-slate-600" };
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${c[s] ?? "bg-slate-100 text-slate-600"}`}>{s}</span>;
}
