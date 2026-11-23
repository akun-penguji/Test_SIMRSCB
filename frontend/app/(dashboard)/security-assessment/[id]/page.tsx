"use client";

// Detail Self Security Assessment: info + checklist kontrol per area dengan
// penilaian (Ada/Sebagian/Belum/N/A) + bukti, skor otomatis, kesimpulan, cetak.

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { hasPerm } from "@/lib/auth";
import { getSsaDetail, updateSsa, updateSsaItem, deleteSsa, SsaDetail, SsaItem } from "@/lib/api";

const STATUS = [
  { v: "ada", l: "PASS", c: "bg-green-100 text-green-700" },
  { v: "sebagian", l: "Sebagian", c: "bg-amber-100 text-amber-700" },
  { v: "belum", l: "NOT PASS", c: "bg-red-100 text-red-700" },
  { v: "na", l: "N/A", c: "bg-slate-100 text-slate-500" },
];

export default function SsaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const isEdit = hasPerm("ssa_edit");
  const [d, setD] = useState<SsaDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => { getSsaDetail(id).then(r => setD(r.data)).catch(() => setD(null)).finally(() => setLoading(false)); }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  if (loading) return <div className="text-sm text-slate-400">Memuat…</div>;
  if (!d) return <div className="text-sm text-red-600">Tidak ditemukan. <Link href="/security-assessment" className="underline">Kembali</Link></div>;

  const areas = Array.from(new Set(d.items.map(i => i.area)));

  async function setItem(it: SsaItem, status: string, bukti?: string) {
    await updateSsaItem(id, it.id, { status, bukti: bukti ?? it.bukti });
    load();
  }
  async function hapus() {
    if (!confirm("Hapus penilaian ini?")) return;
    await deleteSsa(id); router.push("/security-assessment");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap no-print">
        <div>
          <Link href="/security-assessment" className="text-xs text-slate-400 hover:underline">← Self Security Assessment</Link>
          <h1 className="text-xl font-bold text-slate-800">Penilaian {d.periode || ""} {d.tahun}</h1>
          <p className="text-sm text-slate-500">{new Date(d.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} · {d.metode}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 hover:bg-slate-200">🖨 Cetak</button>
          {isEdit && <button onClick={hapus} className="px-3 py-1.5 text-sm rounded-lg bg-red-50 text-red-600 hover:bg-red-100">Hapus</button>}
        </div>
      </div>

      {/* Skor ringkas */}
      <div className="grid grid-cols-3 gap-3">
        <KartuSkor d={d} />
      </div>

      <HeaderForm d={d} isEdit={isEdit} onSaved={load} />

      {areas.map(area => {
        const items = d.items.filter(i => i.area === area);
        return (
          <div key={area} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 font-semibold text-sm text-slate-700">{area}</div>
            <table className="w-full text-sm">
              <tbody>
                {items.map(it => (
                  <tr key={it.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 w-10 text-slate-400 font-mono text-xs">{it.kode}</td>
                    <td className="px-3 py-2">{it.kontrol}</td>
                    <td className="px-3 py-2 w-[260px]">
                      {isEdit ? (
                        <div className="flex gap-1 flex-wrap">
                          {STATUS.map(s => (
                            <button key={s.v} onClick={() => setItem(it, s.v)}
                              className={`text-xs px-2 py-0.5 rounded ${it.status === s.v ? s.c + " ring-1 ring-current" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`}>{s.l}</button>
                          ))}
                        </div>
                      ) : <span className={`text-xs px-2 py-0.5 rounded ${STATUS.find(s => s.v === it.status)?.c || "bg-slate-100"}`}>{STATUS.find(s => s.v === it.status)?.l}</span>}
                      <BuktiInput it={it} isEdit={isEdit} onSave={(b) => setItem(it, it.status, b)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      <KesimpulanForm d={d} isEdit={isEdit} onSaved={load} />
    </div>
  );
}

function KartuSkor({ d }: { d: SsaDetail }) {
  const w: Record<string, string> = { "Baik": "text-green-600", "Cukup": "text-amber-600", "Perlu Perbaikan": "text-red-600" };
  const terisi = d.items.filter(i => i.status !== "belum").length;
  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="text-xs text-slate-400">Skor Total</div>
        <div className={`text-2xl font-bold ${w[d.tingkat] || "text-slate-800"}`}>{d.skor_total != null ? `${d.skor_total.toFixed(0)}%` : "–"}</div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="text-xs text-slate-400">Tingkat</div>
        <div className={`text-lg font-bold ${w[d.tingkat] || "text-slate-400"}`}>{d.tingkat || "–"}</div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="text-xs text-slate-400">Kontrol dinilai</div>
        <div className="text-2xl font-bold text-slate-800">{terisi}<span className="text-sm text-slate-400">/{d.items.length}</span></div>
      </div>
    </>
  );
}

function BuktiInput({ it, isEdit, onSave }: { it: SsaItem; isEdit: boolean; onSave: (b: string) => void }) {
  const [v, setV] = useState(it.bukti || "");
  useEffect(() => { setV(it.bukti || ""); }, [it.bukti]);
  if (!isEdit) return it.bukti ? <div className="text-xs text-slate-400 mt-1">{it.bukti}</div> : null;
  return (
    <input value={v} onChange={e => setV(e.target.value)} onBlur={() => { if (v !== (it.bukti || "")) onSave(v); }}
      placeholder="Bukti / keterangan…" className="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-xs" />
  );
}

function HeaderForm({ d, isEdit, onSaved }: { d: SsaDetail; isEdit: boolean; onSaved: () => void }) {
  const [f, setF] = useState({ periode: d.periode || "", metode: d.metode, pihak_ketiga: d.pihak_ketiga || "", penanggung_jawab: d.penanggung_jawab || "" });
  const [msg, setMsg] = useState("");
  async function simpan() { await updateSsa(d.id, f); setMsg("Tersimpan."); onSaved(); }
  if (!isEdit) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 gap-2 items-end no-print">
      <div><label className="text-xs text-slate-400">Periode</label><input value={f.periode} onChange={e => setF(p => ({ ...p, periode: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" /></div>
      <div><label className="text-xs text-slate-400">Metode</label><select value={f.metode} onChange={e => setF(p => ({ ...p, metode: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm">{["Internal", "Pihak Ketiga", "Gabungan"].map(m => <option key={m}>{m}</option>)}</select></div>
      <div><label className="text-xs text-slate-400">Pihak ke-3</label><input value={f.pihak_ketiga} onChange={e => setF(p => ({ ...p, pihak_ketiga: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" /></div>
      <div className="flex gap-2 items-end">
        <div className="flex-1"><label className="text-xs text-slate-400">PJ</label><input value={f.penanggung_jawab} onChange={e => setF(p => ({ ...p, penanggung_jawab: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" /></div>
        <button onClick={simpan} className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white">Simpan</button>
      </div>
      {msg && <span className="text-xs text-green-600">{msg}</span>}
    </div>
  );
}

function KesimpulanForm({ d, isEdit, onSaved }: { d: SsaDetail; isEdit: boolean; onSaved: () => void }) {
  const [v, setV] = useState(d.kesimpulan || "");
  const [msg, setMsg] = useState("");
  async function simpan() { await updateSsa(d.id, { kesimpulan: v }); setMsg("Tersimpan."); onSaved(); }
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-sm font-semibold text-slate-700 mb-1">Kesimpulan & Rencana Tindak Lanjut</div>
      {isEdit ? (
        <>
          <textarea value={v} onChange={e => setV(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Ringkasan hasil + rencana perbaikan…" />
          <div className="flex items-center gap-2 mt-1 no-print"><button onClick={simpan} className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white">Simpan</button>{msg && <span className="text-xs text-green-600">{msg}</span>}</div>
        </>
      ) : <p className="text-sm text-slate-600 whitespace-pre-wrap">{d.kesimpulan || "—"}</p>}
    </div>
  );
}
