"use client";
import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import {
  getKendalaRekap, getKendalaList, getKendalaKategori, addKendala, editKendala, hapusKendala,
  getKendalaEvaluasi, saveKendalaEvaluasi,
  KendalaRekap, KendalaRow,
} from "@/lib/api";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const TW = ["TW-1 (Jan–Mar)", "TW-2 (Apr–Jun)", "TW-3 (Jul–Sep)", "TW-4 (Okt–Des)"];
const nf = (n: number) => n.toLocaleString("id-ID");
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function KendalaPendaftaranPage() {
  const isEdit = hasPerm("evaluasi_pendaftaran_edit") || hasPerm("akreditasi_edit");
  const nowYear = new Date().getFullYear();
  const [tahun, setTahun] = useState(nowYear);
  const [view, setView] = useState<"bulan" | "triwulan">("bulan");
  const [rekap, setRekap] = useState<KendalaRekap | null>(null);
  const [list, setList] = useState<KendalaRow[]>([]);
  const [kategori, setKategori] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, l] = await Promise.all([getKendalaRekap(tahun), getKendalaList(tahun)]);
      setRekap(r.data); setList(l.data.kendala);
    } catch { setRekap(null); setList([]); } finally { setLoading(false); }
  }, [tahun]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getKendalaKategori().then(r => setKategori(r.data.kategori)).catch(() => setKategori([])); }, []);

  // Evaluasi & Tindak Lanjut (per tahun)
  const [evaluasi, setEvaluasi] = useState("");
  const [evTindak, setEvTindak] = useState("");
  const [evKesimpulan, setEvKesimpulan] = useState("");
  const [evUpdated, setEvUpdated] = useState<string | null>(null);
  const [evSaving, setEvSaving] = useState(false);
  const [evMsg, setEvMsg] = useState("");
  useEffect(() => {
    getKendalaEvaluasi(tahun).then(r => {
      setEvaluasi(r.data.evaluasi); setEvTindak(r.data.tindak_lanjut);
      setEvKesimpulan(r.data.kesimpulan); setEvUpdated(r.data.updated_at);
    }).catch(() => { setEvaluasi(""); setEvTindak(""); setEvKesimpulan(""); setEvUpdated(null); });
  }, [tahun]);
  async function simpanEvaluasi() {
    setEvSaving(true); setEvMsg("");
    try {
      await saveKendalaEvaluasi({ tahun, evaluasi, tindak_lanjut: evTindak, kesimpulan: evKesimpulan });
      setEvMsg("Tersimpan."); getKendalaEvaluasi(tahun).then(r => setEvUpdated(r.data.updated_at)).catch(() => {});
    } catch { setEvMsg("Gagal menyimpan."); } finally { setEvSaving(false); }
  }

  // Form input / edit
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [fTgl, setFTgl] = useState(todayStr());
  const [fKat, setFKat] = useState("");
  const [fDesk, setFDesk] = useState("");
  const [fJml, setFJml] = useState("1");
  const [fDampak, setFDampak] = useState("");
  const [fTindak, setFTindak] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function resetForm() {
    setEditId(null); setFTgl(todayStr()); setFKat(""); setFDesk(""); setFJml("1"); setFDampak(""); setFTindak(""); setMsg("");
  }
  function mulaiEdit(k: KendalaRow) {
    setEditId(k.id); setFTgl(k.tanggal); setFKat(k.kategori); setFDesk(k.deskripsi ?? "");
    setFJml(String(k.jumlah_kasus)); setFDampak(k.dampak ?? ""); setFTindak(k.tindak_lanjut ?? "");
    setMsg(""); setOpen(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function simpan() {
    if (!fKat) { setMsg("Pilih kategori."); return; }
    setSaving(true); setMsg("");
    const body = {
      tanggal: fTgl, kategori: fKat, deskripsi: fDesk,
      jumlah_kasus: Number(fJml) || 1, dampak: fDampak, tindak_lanjut: fTindak,
    };
    try {
      if (editId != null) await editKendala(editId, body);
      else await addKendala(body);
      resetForm(); setOpen(false); load();
    } catch { setMsg("Gagal menyimpan."); } finally { setSaving(false); }
  }
  async function hapus(id: number) {
    if (!confirm("Hapus entri kendala ini?")) return;
    try { await hapusKendala(id); load(); } catch { alert("Gagal menghapus."); }
  }

  const yearOpts = [nowYear, nowYear - 1, nowYear - 2];

  return (
    <div className="space-y-4 p-1">
      <div className="hidden print:block text-center mb-3">
        <div className="font-bold text-lg">LAPORAN KENDALA PENDAFTARAN</div>
        <div className="text-sm">RSUD Cabangbungin — Tahun {tahun}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Laporan Kendala Pendaftaran</h1>
          <p className="text-sm text-slate-500">Kendala pendaftaran online/offline — rekap per bulan &amp; triwulan</p>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))}
            className="border rounded-lg px-2 py-1 text-sm">
            {yearOpts.map(y => <option key={y} value={y}>Tahun {y}</option>)}
          </select>
          <div className="inline-flex rounded-lg border overflow-hidden text-sm">
            <button onClick={() => setView("bulan")} className={`px-3 py-1 ${view === "bulan" ? "bg-teal-600 text-white" : "bg-white text-slate-600"}`}>Per Bulan</button>
            <button onClick={() => setView("triwulan")} className={`px-3 py-1 ${view === "triwulan" ? "bg-teal-600 text-white" : "bg-white text-slate-600"}`}>Per Triwulan</button>
          </div>
          {isEdit && (
            <button onClick={() => { if (open) { setOpen(false); resetForm(); } else { resetForm(); setOpen(true); } }}
              className="text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-1.5">
              {open ? "Tutup" : "+ Kendala"}
            </button>
          )}
          <button onClick={() => window.print()}
            className="text-sm font-semibold bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-3 py-1.5">🖨 Cetak / Simpan PDF</button>
        </div>
      </div>

      {/* Form input / edit */}
      {open && isEdit && (
        <div className="bg-white rounded-xl border p-4 grid md:grid-cols-2 gap-3 no-print">
          <div className="md:col-span-2 text-sm font-semibold text-slate-700">
            {editId != null ? "Edit Kendala" : "Tambah Kendala"}
          </div>
          <label className="text-xs font-semibold text-slate-600">Tanggal
            <input type="date" value={fTgl} onChange={(e) => setFTgl(e.target.value)}
              className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Kategori
            <select value={fKat} onChange={(e) => setFKat(e.target.value)}
              className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal">
              <option value="">— pilih —</option>
              {kategori.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Jumlah kasus
            <input type="number" min={1} value={fJml} onChange={(e) => setFJml(e.target.value)}
              className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Deskripsi
            <input value={fDesk} onChange={(e) => setFDesk(e.target.value)} placeholder="rincian kejadian"
              className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Dampak
            <input value={fDampak} onChange={(e) => setFDampak(e.target.value)} placeholder="mis. antrian menumpuk"
              className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Tindak lanjut
            <input value={fTindak} onChange={(e) => setFTindak(e.target.value)} placeholder="mis. daftar manual sementara"
              className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" />
          </label>
          <div className="md:col-span-2 flex items-center gap-3">
            <button onClick={simpan} disabled={saving}
              className="text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
              {saving ? "Menyimpan…" : editId != null ? "Perbarui" : "Simpan Kendala"}
            </button>
            {editId != null && (
              <button onClick={() => { resetForm(); setOpen(false); }} className="text-sm text-slate-500 hover:underline">Batal</button>
            )}
            {msg && <span className="text-sm text-slate-500">{msg}</span>}
          </div>
        </div>
      )}

      {!rekap && !loading && <div className="text-center text-slate-400 py-12">Tidak ada data.</div>}

      {rekap && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Total Kendala (tahun)" value={nf(rekap.grand_total)} sub={`Tahun ${rekap.tahun}`} />
            {rekap.total_triwulan.map((v, i) => (
              <Card key={i} label={`Triwulan ${i + 1}`} value={nf(v)} sub={TW[i].replace(/^TW-\d+ /, "")} tone="slate" />
            ))}
          </div>

          {/* Matriks rekap — layar: ikut toggle; cetak/PDF: tampilkan bulan & triwulan sekaligus */}
          <div className="print:hidden">
            <MatrixCard rekap={rekap} mode={view} />
          </div>
          <div className="hidden print:block space-y-4">
            <MatrixCard rekap={rekap} mode="bulan" />
            <MatrixCard rekap={rekap} mode="triwulan" />
          </div>

          {/* Daftar entri */}
          <div className="bg-white rounded-xl border p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">Rincian Kejadian {rekap.tahun}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b">
                    <th className="py-2 pr-3">Tanggal</th>
                    <th className="py-2 px-3">Kategori</th>
                    <th className="py-2 px-3 text-right">Kasus</th>
                    <th className="py-2 px-3">Deskripsi</th>
                    <th className="py-2 px-3">Dampak</th>
                    <th className="py-2 px-3">Tindak Lanjut</th>
                    <th className="py-2 px-3">Petugas</th>
                    {isEdit && <th className="py-2 pl-3 no-print"></th>}
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 && (
                    <tr><td colSpan={isEdit ? 8 : 7} className="text-center text-slate-400 py-8">Belum ada kendala dicatat.</td></tr>
                  )}
                  {list.map((k) => (
                    <tr key={k.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3 tabular-nums text-slate-600 whitespace-nowrap">{k.tanggal}</td>
                      <td className="py-2 px-3 text-slate-700">{k.kategori}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{nf(k.jumlah_kasus)}</td>
                      <td className="py-2 px-3 text-slate-600">{k.deskripsi || "–"}</td>
                      <td className="py-2 px-3 text-slate-600">{k.dampak || "–"}</td>
                      <td className="py-2 px-3 text-slate-600">{k.tindak_lanjut || "–"}</td>
                      <td className="py-2 px-3 text-slate-500 text-xs">{k.nama_petugas || "–"}</td>
                      {isEdit && (
                        <td className="py-2 pl-3 no-print whitespace-nowrap">
                          <button onClick={() => mulaiEdit(k)} className="text-xs text-teal-700 hover:underline mr-3">Edit</button>
                          <button onClick={() => hapus(k.id)} className="text-xs text-rose-600 hover:underline">Hapus</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Evaluasi & Tindak Lanjut (per tahun) — ikut tercetak di PDF */}
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-semibold text-slate-700">Evaluasi &amp; Tindak Lanjut — {rekap.tahun}</div>
              {evUpdated && <span className="text-xs text-slate-400">diperbarui {evUpdated}</span>}
            </div>
            <label className="block text-xs font-semibold text-slate-600">Evaluasi (analisa kendala pendaftaran)
              <textarea value={evaluasi} onChange={(e) => setEvaluasi(e.target.value)} disabled={!isEdit} rows={3}
                className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal text-slate-700 disabled:bg-slate-50" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Tindak Lanjut
              <textarea value={evTindak} onChange={(e) => setEvTindak(e.target.value)} disabled={!isEdit} rows={3}
                className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal text-slate-700 disabled:bg-slate-50" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Kesimpulan / Rekomendasi
              <textarea value={evKesimpulan} onChange={(e) => setEvKesimpulan(e.target.value)} disabled={!isEdit} rows={2}
                className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal text-slate-700 disabled:bg-slate-50" />
            </label>
            {isEdit && (
              <div className="flex items-center gap-3 no-print">
                <button onClick={simpanEvaluasi} disabled={evSaving}
                  className="text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
                  {evSaving ? "Menyimpan…" : "Simpan Evaluasi"}
                </button>
                <button onClick={() => { if (confirm("Kosongkan evaluasi & tindak lanjut tahun ini?")) { setEvaluasi(""); setEvTindak(""); setEvKesimpulan(""); saveKendalaEvaluasi({ tahun, evaluasi: "", tindak_lanjut: "", kesimpulan: "" }).then(() => setEvMsg("Dihapus.")).catch(() => setEvMsg("Gagal.")); } }}
                  className="text-sm text-rose-600 hover:underline">Hapus</button>
                {evMsg && <span className="text-sm text-slate-500">{evMsg}</span>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MatrixCard({ rekap, mode }: { rekap: KendalaRekap; mode: "bulan" | "triwulan" }) {
  const cols = mode === "bulan" ? BULAN : TW.map((_, i) => `TW-${i + 1}`);
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="text-sm font-semibold text-slate-700 mb-3">
        Rekap {mode === "bulan" ? "per Bulan" : "per Triwulan"} — {rekap.tahun}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b">
              <th className="text-left py-2 pr-3 sticky left-0 bg-white min-w-[220px]">Kategori Kendala</th>
              {cols.map((c) => <th key={c} className="px-2 py-2 text-right whitespace-nowrap">{c}</th>)}
              <th className="px-2 py-2 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rekap.per_kategori.map((k) => (
              <tr key={k.kategori} className="border-b last:border-0">
                <td className="py-2 pr-3 text-slate-700 sticky left-0 bg-white">{k.kategori}</td>
                {(mode === "bulan" ? k.bulan : k.triwulan).map((v, i) => (
                  <td key={i} className={`px-2 py-2 text-right tabular-nums ${v === 0 ? "text-slate-300" : "text-slate-700"}`}>{v === 0 ? "–" : nf(v)}</td>
                ))}
                <td className="px-2 py-2 text-right tabular-nums font-bold text-slate-800">{k.total === 0 ? "–" : nf(k.total)}</td>
              </tr>
            ))}
            <tr className="border-t-2 bg-slate-50 font-semibold">
              <td className="py-2 pr-3 sticky left-0 bg-slate-50">Total</td>
              {(mode === "bulan" ? rekap.total_bulan : rekap.total_triwulan).map((v, i) => (
                <td key={i} className="px-2 py-2 text-right tabular-nums">{v === 0 ? "–" : nf(v)}</td>
              ))}
              <td className="px-2 py-2 text-right tabular-nums text-teal-700">{nf(rekap.grand_total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: string }) {
  const ring: Record<string, string> = { default: "border-slate-200", slate: "border-slate-200" };
  const val: Record<string, string> = { default: "text-slate-800", slate: "text-slate-700" };
  return (
    <div className={`bg-white rounded-xl border ${ring[tone]} p-4`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${val[tone]}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}
