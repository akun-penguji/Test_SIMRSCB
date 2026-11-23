"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  akreditasiGetEp, evidenByEp, buktiSimrsForEp,
  getSidomuByEp, getSidomu, linkSidomuEp, unlinkSidomuEp,
  getEpDokumen, addEpDokumenLink, uploadEpDokumen, delEpDokumen,
  AkreditasiEp, EvidenFolder, BuktiEpResp, SidomuSop, AkreditasiDokumen,
} from "@/lib/api";

type Tab = "info" | "eviden" | "bukti" | "sop" | "dokumen";

const PRIORITAS_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: "P1 Critical", color: "bg-red-100 text-red-700" },
  2: { label: "P2 High",     color: "bg-orange-100 text-orange-700" },
  3: { label: "P3 Medium",   color: "bg-amber-100 text-amber-700" },
  4: { label: "P4 Low",      color: "bg-slate-100 text-slate-600" },
  5: { label: "P5 Trivial",  color: "bg-slate-100 text-slate-500" },
};

const JENIS_BUKTI_LABEL: Record<string, string> = {
  R: "Regulasi (SK/Pedoman/SPO)",
  D: "Dokumen pelaksanaan",
  O: "Observasi langsung",
  S: "Simulasi staf",
  W: "Wawancara staf/pasien",
};

export default function EpDetailPage() {
  const params = useParams<{ kd_ep: string }>();
  const kd_ep = decodeURIComponent(params.kd_ep);

  const [ep, setEp] = useState<AkreditasiEp | null>(null);
  const [eviden, setEviden] = useState<EvidenFolder[]>([]);
  const [bukti, setBukti] = useState<BuktiEpResp | null>(null);
  const [sop, setSop] = useState<SidomuSop[]>([]);
  const [dok, setDok] = useState<AkreditasiDokumen[]>([]);
  const [tab, setTab] = useState<Tab>("info");
  const [loading, setLoading] = useState(true);

  const loadSop = () => { getSidomuByEp(kd_ep).then(r => setSop(r.data)).catch(() => {}); };
  const loadDok = () => { getEpDokumen(kd_ep).then(r => setDok(r.data)).catch(() => {}); };
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [epR, evR, btR, spR, dkR] = await Promise.all([
          akreditasiGetEp(kd_ep).catch(() => null),
          evidenByEp(kd_ep).catch(() => null),
          buktiSimrsForEp(kd_ep).catch(() => null),
          getSidomuByEp(kd_ep).catch(() => null),
          getEpDokumen(kd_ep).catch(() => null),
        ]);
        if (epR) setEp(epR.data);
        if (evR) setEviden(evR.data);
        if (btR) setBukti(btR.data);
        if (spR) setSop(spR.data);
        if (dkR) setDok(dkR.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [kd_ep]);

  if (loading) return <div className="p-6 text-slate-500">Memuat...</div>;
  if (!ep)     return <div className="p-6 text-red-600">EP tidak ditemukan: {kd_ep}</div>;

  const jenisBuktiArr = ep.jenis_bukti.split(",").map(s => s.trim());

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <Link href="/akreditasi/ep" className="text-xs text-slate-500 hover:text-green-700">
          ← Daftar EP
        </Link>
        <div className="flex items-start gap-3 mt-2">
          <span className="font-mono text-lg font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded">
            {ep.kd_ep}
          </span>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800 leading-tight">
              {ep.nama_standar || "EP STARKES"}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Bab {ep.bab} — {ep.nama_bab} • Kelompok {ep.kelompok} • {ep.versi_kepmenkes}
            </p>
          </div>
          <Link href={`/akreditasi/ep/${encodeURIComponent(ep.kd_ep)}/edit`}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 whitespace-nowrap">
            ✏️ Edit
          </Link>
        </div>
        {ep.sumber_seed === "47104-parser" && (
          <p className="mt-2 text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg inline-block">
            ⚠️ EP ini dihasilkan dari parser otomatis PDF Kepdirjen 47104/2024 — masih perlu review manual (text deskripsi/kelengkapan bukti mungkin tercampur).
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-4 flex gap-1">
        {[
          { id: "info" as Tab,   label: "Info EP",                       count: null },
          { id: "eviden" as Tab, label: "Eviden Folder (Drive)",         count: eviden.length },
          { id: "bukti" as Tab,  label: "Bukti SIMRS (realtime)",        count: bukti?.forms.length || 0 },
          { id: "sop" as Tab,    label: "SOP / SIDOMU",                  count: sop.length },
          { id: "dokumen" as Tab, label: "Dokumen Bukti",               count: dok.length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === t.id ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {t.label}
            {t.count !== null && (
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                t.count > 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "info" && (
        <div className="space-y-4">
          {ep.maksud_tujuan && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500 uppercase mb-2">Maksud & Tujuan Standar {ep.standar}</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{ep.maksud_tujuan}</p>
            </div>
          )}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 uppercase mb-2">Deskripsi EP</p>
            <p className="text-sm text-slate-700 leading-relaxed">{ep.deskripsi}</p>
          </div>
          {ep.kelengkapan_bukti && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500 uppercase mb-2">Kelengkapan Bukti yang Harus Disiapkan RS</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{ep.kelengkapan_bukti}</p>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">Prioritas</p>
              <span className={`text-xs px-2 py-1 rounded font-medium ${PRIORITAS_LABEL[ep.prioritas]?.color}`}>
                {PRIORITAS_LABEL[ep.prioritas]?.label}
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">Bobot Skor</p>
              <p className="text-2xl font-bold text-slate-800">{ep.bobot}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">Kategori Bukti</p>
              <p className="text-sm font-medium text-slate-700">{ep.kategori_bukti || "—"}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">Status</p>
              <p className="text-sm font-medium text-green-700">{ep.status}</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 uppercase mb-2">Jenis Bukti yang Diminta Surveyor</p>
            <div className="flex flex-wrap gap-2">
              {jenisBuktiArr.map(j => (
                <div key={j} className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <span className="font-bold text-blue-700">{j}</span>
                  <span className="text-xs text-slate-600 ml-2">{JENIS_BUKTI_LABEL[j] || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "eviden" && (
        <div>
          {eviden.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <p className="text-slate-500">Belum ada folder eviden ter-tag ke EP ini.</p>
              <Link href="/akreditasi/eviden" className="text-sm text-green-700 hover:underline mt-2 inline-block">
                Kelola folder eviden →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {eviden.map(f => (
                <a key={f.id} href={f.url_drive} target="_blank" rel="noopener noreferrer"
                  className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-blue-300 transition flex items-start gap-3">
                  <span className="text-2xl">📁</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-slate-800">{f.judul}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {f.jenis} {f.tahun && `• ${f.tahun}`} {f.bab && `• Bab ${f.bab}`}
                    </p>
                    {f.deskripsi && <p className="text-xs text-slate-600 mt-2 line-clamp-2">{f.deskripsi}</p>}
                    <p className="text-xs text-blue-600 mt-2 font-medium">🔗 Buka di Google Drive →</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "bukti" && (
        <div>
          {!bukti || bukti.forms.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <p className="text-slate-500">Belum ada form SIMRS ter-tag ke EP ini.</p>
              <p className="text-xs text-slate-400 mt-1">
                Form mapping diatur di tabel <code className="bg-slate-100 px-1 rounded">form_ep_map</code>.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {bukti.forms.map(f => (
                <div key={f.tabel_asal} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-800">📋 {f.nama_form}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">{f.tabel_asal}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex gap-2 text-xs">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">
                          Total: {f.total_records}
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded font-medium">
                          30 hari: {f.records_30_hari}
                        </span>
                      </div>
                    </div>
                  </div>
                  {f.sample.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">Belum ada record</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left">No Rawat</th>
                          <th className="px-4 py-2 text-left">Tanggal</th>
                          <th className="px-4 py-2 text-left">Detail</th>
                          <th className="px-4 py-2 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {f.sample.map((s, idx) => {
                          const drillUrl = f.drill_url_template
                            .replace("{no_rawat}", encodeURIComponent(s.no_rawat));
                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-4 py-2 font-mono">{s.no_rawat}</td>
                              <td className="px-4 py-2">{s.tanggal}</td>
                              <td className="px-4 py-2">
                                {s.label}
                                {s.extra && (
                                  <span className="text-slate-400 ml-2">({s.extra})</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <Link href={drillUrl}
                                  className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-2 py-1 rounded font-medium">
                                  Buka →
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 text-xs text-slate-500">
                    Endpoint API: <code className="bg-white px-1 rounded">{f.endpoint_api}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "sop" && <SopTab kd_ep={kd_ep} sop={sop} reload={loadSop} />}
      {tab === "dokumen" && <DokumenTab kd_ep={kd_ep} dok={dok} reload={loadDok} />}
    </div>
  );
}

function DokumenTab({ kd_ep, dok, reload }: { kd_ep: string; dok: AkreditasiDokumen[]; reload: () => void }) {
  const [mode, setMode] = useState<"none" | "file" | "link">("none");
  const [nama, setNama] = useState("");
  const [link, setLink] = useState("");
  const [ket, setKet] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  function errMsg(e: unknown, aksi: string): string {
    const err = e as { response?: { status?: number; data?: { error?: string } } };
    if (err.response?.data?.error) return err.response.data.error;
    const st = err.response?.status;
    if (st === 401 || st === 403) return `${aksi} gagal: tidak punya izin (akreditasi_edit).`;
    if (!st || st === 502 || st === 503 || st === 504) return `${aksi} gagal: server sedang sibuk/restart. Coba lagi sebentar.`;
    return `${aksi} gagal (HTTP ${st}).`;
  }
  async function unggah(file: File) {
    setBusy(true); setMsg(null);
    try { await uploadEpDokumen(kd_ep, file, ket); setMsg({ ok: true, t: "File terunggah." }); setKet(""); setMode("none"); reload(); }
    catch (e) { setMsg({ ok: false, t: errMsg(e, "Unggah") }); }
    finally { setBusy(false); }
  }
  async function simpanLink() {
    if (!nama.trim() || !link.trim()) { setMsg({ ok: false, t: "Nama & link wajib diisi" }); return; }
    setBusy(true); setMsg(null);
    try { await addEpDokumenLink({ kd_ep, nama, link, keterangan: ket }); setMsg({ ok: true, t: "Tautan tersimpan." }); setNama(""); setLink(""); setKet(""); setMode("none"); reload(); }
    catch (e) { setMsg({ ok: false, t: errMsg(e, "Simpan tautan") }); }
    finally { setBusy(false); }
  }
  async function hapus(d: AkreditasiDokumen) {
    if (!confirm(`Hapus dokumen "${d.nama}"?`)) return;
    try { await delEpDokumen(d.id); reload(); }
    catch (e) { setMsg({ ok: false, t: errMsg(e, "Hapus") }); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => { setMode(mode === "file" ? "none" : "file"); setMsg(null); }}
          className={`px-3 py-2 text-sm font-semibold rounded-lg ${mode === "file" ? "bg-green-700 text-white" : "border border-green-300 text-green-700 hover:bg-green-50"}`}>⬆ Upload Dokumen</button>
        <button onClick={() => { setMode(mode === "link" ? "none" : "link"); setMsg(null); }}
          className={`px-3 py-2 text-sm font-semibold rounded-lg ${mode === "link" ? "bg-sky-700 text-white" : "border border-sky-300 text-sky-700 hover:bg-sky-50"}`}>🔗 Tautan Google Drive</button>
        <span className="text-xs text-slate-400">File tersimpan di server RS (webapps).</span>
      </div>

      {msg && <div className={`text-sm px-4 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.t}</div>}

      {mode === "file" && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <input value={ket} onChange={e => setKet(e.target.value)} placeholder="Keterangan (opsional)"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
            onChange={e => { const f = e.target.files?.[0]; if (f) unggah(f); }}
            className="w-full text-sm text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-green-700 file:text-white file:text-sm file:font-medium hover:file:bg-green-800" />
          {busy && <p className="text-xs text-green-600">Mengunggah…</p>}
        </div>
      )}
      {mode === "link" && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <input value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama dokumen"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500" />
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://drive.google.com/…"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500" />
          <input value={ket} onChange={e => setKet(e.target.value)} placeholder="Keterangan (opsional)"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500" />
          <button onClick={simpanLink} disabled={busy} className="px-4 py-2 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-50 rounded-lg">{busy ? "Menyimpan…" : "Simpan Tautan"}</button>
        </div>
      )}

      {dok.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 text-sm">Belum ada dokumen bukti untuk EP ini.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {dok.map(d => (
            <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
              <span className="text-2xl">{d.jenis === "file" ? "📄" : "📁"}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-slate-800 break-words">{d.nama}</h3>
                {d.keterangan && <p className="text-xs text-slate-500 mt-0.5">{d.keterangan}</p>}
                <p className="text-[11px] text-slate-400 mt-1">{d.jenis === "file" ? "File di server RS" : "Google Drive"} · {d.uploaded_at?.slice(0, 16) ?? ""}</p>
                <div className="flex gap-3 mt-2 text-xs">
                  <a href={d.link} target="_blank" rel="noreferrer" className="font-medium text-green-700 hover:underline">Buka ↗</a>
                  <button onClick={() => hapus(d)} className="text-rose-500 hover:underline">Hapus</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SopTab({ kd_ep, sop, reload }: { kd_ep: string; sop: SidomuSop[]; reload: () => void }) {
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<SidomuSop[]>([]);
  const [cari, setCari] = useState(false);
  const [busy, setBusy] = useState(false);
  const linkedIds = new Set(sop.map(s => s.id));

  async function search(term: string) {
    setQ(term);
    if (!term.trim()) { setHasil([]); return; }
    setCari(true);
    try { const r = await getSidomu({ q: term }); setHasil(r.data.filter(x => !linkedIds.has(x.id))); }
    catch { setHasil([]); } finally { setCari(false); }
  }
  async function kaitkan(s: SidomuSop) {
    setBusy(true);
    try { await linkSidomuEp(s.id, kd_ep); setHasil(h => h.filter(x => x.id !== s.id)); reload(); }
    catch { alert("Gagal mengaitkan (hanya admin)."); } finally { setBusy(false); }
  }
  async function lepas(s: SidomuSop) {
    if (!confirm(`Lepas kaitan SOP "${s.nama}" dari ${kd_ep}?`)) return;
    setBusy(true);
    try { await unlinkSidomuEp(s.id, kd_ep); reload(); }
    catch { alert("Gagal (hanya admin)."); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {/* SOP terkait */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-slate-500 uppercase">SOP Terkait (SIDOMU) — {sop.length}</p>
          <Link href="/sidomu" className="text-xs text-sky-600 hover:underline">Buka SIDOMU →</Link>
        </div>
        <p className="text-xs text-slate-400 mb-3">Otomatis menampilkan SOP unit yang sesuai bab EP ini, ditambah yang dikaitkan manual (bertanda 📌).</p>
        {sop.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada SOP untuk EP ini. Cari & kaitkan manual di bawah.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[460px] overflow-y-auto pr-1">
            {sop.map(s => (
              <div key={s.id} className="flex items-start gap-2 border border-slate-100 rounded-lg p-3">
                <span className="text-[10px] font-bold rounded px-1.5 py-0.5 uppercase bg-sky-100 text-sky-700 shrink-0">{s.jenis || "dok"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-snug">{s.eps ? "📌 " : ""}{s.nama}</p>
                  <p className="text-xs text-slate-400">{s.kategori}</p>
                  <div className="flex gap-3 mt-1 text-xs">
                    {s.link && <a href={s.link} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">Buka ↗</a>}
                    {s.eps
                      ? <button onClick={() => lepas(s)} disabled={busy} className="text-rose-500 hover:underline">Lepas</button>
                      : <span className="text-slate-300">otomatis (bab {s.bab})</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cari & kaitkan */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-xs font-medium text-slate-500 uppercase mb-2">Kaitkan SOP ke EP ini</p>
        <input value={q} onChange={e => search(e.target.value)} placeholder="Cari SOP di SIDOMU…"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500" />
        <div className="mt-2 space-y-1">
          {cari ? <p className="text-sm text-slate-400 py-2">Mencari…</p>
            : hasil.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-sm border-t border-slate-100 py-2">
                <span className="text-[10px] font-bold rounded px-1.5 py-0.5 uppercase bg-slate-100 text-slate-500 shrink-0">{s.jenis || "dok"}</span>
                <span className="flex-1 min-w-0 truncate text-slate-700">{s.nama} <span className="text-slate-400">· {s.kategori}</span></span>
                <button onClick={() => kaitkan(s)} disabled={busy} className="text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded px-2 py-1 shrink-0">+ Kaitkan</button>
              </div>
            ))}
          {!cari && q && hasil.length === 0 && <p className="text-sm text-slate-400 py-2">Tidak ada SOP cocok (atau sudah terkait).</p>}
        </div>
      </div>
    </div>
  );
}
