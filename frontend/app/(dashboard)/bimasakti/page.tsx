"use client";

// BIMASAKTI — BMS (Body, Mind & Soul) Index. Dashboard + input + pengaturan.
// BMS = Body×w + Mind×w + Soul×w (skala 0–100). Soul = ZI organisasi.

import { useCallback, useEffect, useState } from "react";
import {
  bmsListPeriode, bmsCreatePeriode, bmsHapusPeriode, bmsDashboard, bmsDashboardUnit, bmsHitung,
  bmsInput, bmsUpsertBody, bmsUpsertMind, bmsUpsertSoul, bmsGetConfig, bmsPutConfig,
  bmsListIntervensi, bmsSaveIntervensi, bmsHapusIntervensi, bmsRekomendasiAi,
  BmsPeriode, BmsDashboard, BmsIndexRow, BmsInputRow, BmsConfig, BmsIntervensi,
} from "@/lib/api";
import { getSession } from "@/lib/auth";
import MicButton from "@/components/MicButton";

type Tab = "dashboard" | "input" | "intervensi" | "pengaturan";

function warnaKategori(idx?: number) {
  if (idx == null) return "bg-slate-300";
  if (idx >= 80) return "bg-emerald-500";
  if (idx >= 60) return "bg-lime-500";
  if (idx >= 40) return "bg-amber-500";
  return "bg-rose-500";
}
function fmt(n?: number) { return n == null ? "–" : n.toFixed(2); }

export default function BimasaktiPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [periodeList, setPeriodeList] = useState<BmsPeriode[]>([]);
  const [kp, setKp] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => { setIsAdmin(getSession()?.is_admin === true); }, []);

  const muatPeriode = useCallback(async () => {
    const r = await bmsListPeriode();
    setPeriodeList(r.data);
    if (r.data.length && kp == null) setKp(r.data[0].kd_periode);
  }, [kp]);
  useEffect(() => { muatPeriode(); }, [muatPeriode]);

  async function hapusPeriode() {
    if (kp == null) return;
    const nm = periodeList.find(p => p.kd_periode === kp)?.nama ?? "";
    if (!confirm(`Hapus periode "${nm}" beserta SEMUA data BMS di dalamnya? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await bmsHapusPeriode(kp);
      const r = await bmsListPeriode();
      setPeriodeList(r.data);
      setKp(r.data.length ? r.data[0].kd_periode : null);
    } catch {/* */}
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800">BIMASAKTI — BMS Index</h1>
          <p className="text-sm text-slate-500 mt-0.5">Body · Mind · Soul — indeks budaya kerja pegawai</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={kp ?? ""}
            onChange={e => setKp(Number(e.target.value))}
            className="rounded-lg border border-slate-300 text-sm px-3 py-2 bg-white"
          >
            {periodeList.length === 0 && <option value="">— belum ada periode —</option>}
            {periodeList.map(p => (
              <option key={p.kd_periode} value={p.kd_periode}>{p.nama}</option>
            ))}
          </select>
          {isAdmin && <TambahPeriode onDone={muatPeriode} />}
          {isAdmin && kp != null && (
            <button onClick={hapusPeriode} title="Hapus periode ini"
              className="text-sm font-semibold text-rose-600 border border-rose-300 hover:bg-rose-50 rounded-lg px-3 py-2">
              Hapus
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-4">
        {([["dashboard", "Dashboard"], ["input", "Input Data"], ["intervensi", "Intervensi"], ...(isAdmin ? [["pengaturan", "Pengaturan"]] : [])] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${
              tab === k ? "text-emerald-700 border-b-2 border-emerald-600 -mb-px" : "text-slate-500 hover:text-slate-700"
            }`}>{l}</button>
        ))}
      </div>

      {kp == null ? (
        <div className="text-center text-slate-400 py-16 text-sm">
          Belum ada periode penilaian. {isAdmin ? "Tambahkan periode dulu di kanan atas." : "Hubungi admin."}
        </div>
      ) : tab === "dashboard" ? (
        <DashboardTab kp={kp} isAdmin={isAdmin} />
      ) : tab === "input" ? (
        <InputTab kp={kp} isAdmin={isAdmin} />
      ) : tab === "intervensi" ? (
        <IntervensiTab kp={kp} isAdmin={isAdmin} />
      ) : (
        <PengaturanTab />
      )}
    </div>
  );
}

// ── Tambah Periode ──────────────────────────────────────────────────────────
function TambahPeriode({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [nama, setNama] = useState("");
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");
  const [err, setErr] = useState("");

  async function simpan() {
    setErr("");
    if (!nama || !mulai || !selesai) { setErr("Lengkapi semua isian"); return; }
    try {
      await bmsCreatePeriode({ nama, tgl_mulai: mulai, tgl_selesai: selesai });
      setOpen(false); setNama(""); setMulai(""); setSelesai("");
      onDone();
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal");
    }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-3 py-2">+ Periode</button>
  );
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-slate-800 mb-3">Tambah Periode</h3>
        <div className="space-y-2.5">
          <input value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama (mis. 2025 / 2025-Q3 / 2025-08)" className="w-full rounded-lg border border-slate-300 text-sm px-3 py-2" />
          <label className="block text-xs text-slate-500">Tanggal mulai
            <input type="date" value={mulai} onChange={e => setMulai(e.target.value)} className="w-full rounded-lg border border-slate-300 text-sm px-3 py-2 mt-1" /></label>
          <label className="block text-xs text-slate-500">Tanggal selesai
            <input type="date" value={selesai} onChange={e => setSelesai(e.target.value)} className="w-full rounded-lg border border-slate-300 text-sm px-3 py-2 mt-1" /></label>
          {err && <div className="text-xs text-rose-600">{err}</div>}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={simpan} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg py-2">Simpan</button>
          <button onClick={() => setOpen(false)} className="px-4 text-sm text-slate-500">Batal</button>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function DashboardTab({ kp, isAdmin }: { kp: number; isAdmin: boolean }) {
  const [d, setD] = useState<BmsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [hitungLoading, setHitungLoading] = useState(false);
  const [openDep, setOpenDep] = useState<string | null>(null);
  const [pegawai, setPegawai] = useState<BmsIndexRow[]>([]);

  const muat = useCallback(async () => {
    setLoading(true);
    try { setD((await bmsDashboard(kp)).data); } catch { setD(null); } finally { setLoading(false); }
  }, [kp]);
  useEffect(() => { muat(); setOpenDep(null); }, [muat]);

  async function hitung() {
    setHitungLoading(true);
    try { await bmsHitung(kp); await muat(); } catch {/* */} finally { setHitungLoading(false); }
  }
  async function toggleDep(dep: string) {
    if (openDep === dep) { setOpenDep(null); return; }
    setOpenDep(dep);
    try { setPegawai((await bmsDashboardUnit(kp, dep)).data); } catch { setPegawai([]); }
  }

  if (loading) return <div className="text-center text-slate-400 py-16 text-sm">Memuat…</div>;

  const org = d?.org;
  const trenData = d?.tren ?? [];
  const maxTren = Math.max(100, ...trenData.map(t => t.bms_index ?? 0));

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
          <div className="text-xs text-emerald-800">
            Input: <b>{d?.jml_input_body ?? 0}</b> Body · <b>{d?.jml_input_mind ?? 0}</b> Mind dari <b>{d?.jml_pegawai_aktif ?? 0}</b> pegawai aktif
          </div>
          <button onClick={hitung} disabled={hitungLoading}
            className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg px-3 py-1.5">
            {hitungLoading ? "Menghitung…" : "Hitung Ulang Index"}
          </button>
        </div>
      )}

      {!org ? (
        <div className="text-center text-slate-400 py-12 text-sm bg-white rounded-2xl border border-slate-200">
          Belum ada hasil perhitungan untuk periode ini.<br />
          {isAdmin ? "Isi data di tab Input, lalu klik “Hitung Ulang Index”." : "Menunggu admin menghitung index."}
        </div>
      ) : (
        <>
          {/* Kartu utama */}
          <div className="bg-gradient-to-br from-teal-700 to-emerald-800 text-white rounded-2xl p-5 shadow">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-white/70">BIMASAKTI Index</div>
                <div className="text-5xl font-black leading-none mt-1">{fmt(org.bms_index)}</div>
              </div>
              <span className="text-sm font-bold bg-white/20 rounded-full px-3 py-1">{org.kategori}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[["Body", org.skor_body, "30%"], ["Mind", org.skor_mind, "40%"], ["Soul", org.skor_soul, "30%"]].map(([l, v, w]) => (
                <div key={l as string} className="bg-white/10 rounded-xl px-3 py-2">
                  <div className="text-[11px] text-white/70">{l as string} · {w as string}</div>
                  <div className="text-xl font-bold">{fmt(v as number)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tren antar periode */}
          {trenData.length > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Tren Antar Periode</div>
              <div className="space-y-1.5">
                {trenData.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-20 shrink-0 truncate">{t.nama}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                      <div className={`h-full ${warnaKategori(t.bms_index)}`} style={{ width: `${((t.bms_index ?? 0) / maxTren) * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono text-slate-600 w-12 text-right shrink-0">{fmt(t.bms_index)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ranking unit */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Ranking Unit</div>
            {d!.units.length === 0 ? (
              <div className="text-sm text-slate-400 italic">Belum ada data unit.</div>
            ) : (
              <div className="space-y-1.5">
                {d!.units.map(u => (
                  <div key={u.ref_id}>
                    <button onClick={() => toggleDep(u.ref_id)} className="w-full flex items-center gap-2 py-1 hover:bg-slate-50 rounded-lg px-1">
                      <span className="text-xs text-slate-600 w-28 shrink-0 truncate text-left">{u.nama ?? u.ref_id}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                        <div className={`h-full ${warnaKategori(u.bms_index)}`} style={{ width: `${Math.min(100, u.bms_index ?? 0)}%` }} />
                      </div>
                      <span className="text-xs font-mono text-slate-600 w-12 text-right shrink-0">{fmt(u.bms_index)}</span>
                    </button>
                    {openDep === u.ref_id && (
                      <div className="ml-2 my-1 border-l-2 border-emerald-200 pl-3 space-y-1">
                        {pegawai.length === 0 ? (
                          <div className="text-xs text-slate-400 italic py-1">Belum ada data pegawai.</div>
                        ) : pegawai.map(p => (
                          <div key={p.ref_id} className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-slate-600 truncate">{p.nama}</span>
                            <span className="font-mono text-slate-500 shrink-0 ml-2">
                              B{fmt(p.skor_body)} · M{fmt(p.skor_mind)} · <b className="text-slate-700">{fmt(p.bms_index)}</b>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Input Data ──────────────────────────────────────────────────────────────
function InputTab({ kp, isAdmin }: { kp: number; isAdmin: boolean }) {
  const [rows, setRows] = useState<BmsInputRow[]>([]);
  const [soulZi, setSoulZi] = useState<string>("");
  const [soulCat, setSoulCat] = useState<string>("");
  const [cari, setCari] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      const r = await bmsInput(kp, cari);
      setRows(r.data.rows);
      setSoulZi(r.data.soul_zi != null ? String(r.data.soul_zi) : "");
      setSoulCat(r.data.soul_catatan ?? "");
    } catch {/* */} finally { setLoading(false); }
  }, [kp, cari]);
  useEffect(() => { muat(); }, [kp]); // eslint-disable-line react-hooks/exhaustive-deps

  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(""), 1500); }

  async function saveBody(nik: string, val: string) {
    const bmi = parseFloat(val);
    if (isNaN(bmi)) return;
    try { const r = await bmsUpsertBody({ kd_periode: kp, nik, bmi });
      setRows(rs => rs.map(x => x.nik === nik ? { ...x, bmi, body_index: r.data.body_index } : x)); flash("Tersimpan"); } catch {/* */}
  }
  async function saveMind(nik: string, val: string) {
    const e = parseFloat(val);
    if (isNaN(e)) return;
    try { await bmsUpsertMind({ kd_periode: kp, nik, e_kinerja: e });
      setRows(rs => rs.map(x => x.nik === nik ? { ...x, e_kinerja: e } : x)); flash("Tersimpan"); } catch {/* */}
  }
  async function saveSoul() {
    const zi = parseFloat(soulZi);
    if (isNaN(zi)) return;
    try { await bmsUpsertSoul({ kd_periode: kp, zi_index: zi, catatan: soulCat }); flash("Soul (ZI) tersimpan"); } catch {/* */}
  }

  if (!isAdmin) return <div className="text-center text-slate-400 py-16 text-sm">Hanya admin yang bisa mengisi data.</div>;

  return (
    <div className="space-y-4">
      {msg && <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-xs px-3 py-2 rounded-lg shadow">{msg}</div>}

      {/* Soul ZI (organisasi) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Soul — Self Assessment ZI (organisasi)</div>
        <div className="flex items-end gap-2 flex-wrap">
          <label className="text-xs text-slate-500">Nilai ZI (0–100)
            <input type="number" step="0.01" min="0" max="100" value={soulZi} onChange={e => setSoulZi(e.target.value)}
              className="block w-28 rounded-lg border border-slate-300 text-sm px-3 py-2 mt-1" /></label>
          <input value={soulCat} onChange={e => setSoulCat(e.target.value)} placeholder="Catatan (opsional)"
            className="flex-1 min-w-[160px] rounded-lg border border-slate-300 text-sm px-3 py-2" />
          <button onClick={saveSoul} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Simpan ZI</button>
        </div>
      </div>

      {/* Body & Mind per pegawai */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Body (BMI) &amp; Mind (E-Kinerja) per Pegawai</div>
          <input value={cari} onChange={e => setCari(e.target.value)} onKeyDown={e => { if (e.key === "Enter") muat(); }}
            placeholder="Cari nama / NIK…" className="rounded-lg border border-slate-300 text-sm px-3 py-1.5 w-48" />
        </div>
        {loading ? <div className="text-center text-slate-400 py-8 text-sm">Memuat…</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-2">Nama / Unit</th>
                  <th className="py-2 px-2 w-24">BMI</th>
                  <th className="py-2 px-2 w-20">Body Idx</th>
                  <th className="py-2 px-2 w-28">E-Kinerja</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.nik} className="border-b border-slate-50">
                    <td className="py-1.5 pr-2">
                      <div className="font-medium text-slate-700 truncate max-w-[220px]">{r.nama}</div>
                      <div className="text-[11px] text-slate-400">{r.nm_dep ?? r.departemen ?? "-"}</div>
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" step="0.1" defaultValue={r.bmi ?? ""} onBlur={e => saveBody(r.nik, e.target.value)}
                        className="w-20 rounded border border-slate-300 text-sm px-2 py-1" />
                    </td>
                    <td className="py-1.5 px-2 font-mono text-slate-500">{fmt(r.body_index)}</td>
                    <td className="py-1.5 px-2">
                      <input type="number" step="0.01" min="0" max="100" defaultValue={r.e_kinerja ?? ""} onBlur={e => saveMind(r.nik, e.target.value)}
                        className="w-24 rounded border border-slate-300 text-sm px-2 py-1" />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={4} className="text-center text-slate-400 py-6 text-sm">Tidak ada pegawai.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Intervensi / Improvement Cycle (PDCA) ───────────────────────────────────
const KOSONG = (kp: number): BmsIntervensi => ({
  kd_periode: kp, scope: "ORG", ref_id: "", temuan: "", pdca_plan: "", pdca_do: "",
  pdca_check: "", pdca_act: "", status: "rencana", rekomendasi_ai: "", tgl: "",
});

function IntervensiTab({ kp, isAdmin }: { kp: number; isAdmin: boolean }) {
  const [list, setList] = useState<BmsIntervensi[]>([]);
  const [form, setForm] = useState<BmsIntervensi | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const muat = useCallback(async () => {
    setLoading(true);
    try { setList((await bmsListIntervensi(kp)).data); } catch { setList([]); } finally { setLoading(false); }
  }, [kp]);
  useEffect(() => { muat(); setForm(null); }, [muat]);

  const set = (patch: Partial<BmsIntervensi>) => setForm(f => f ? { ...f, ...patch } : f);

  async function simpan() {
    if (!form) return;
    try { await bmsSaveIntervensi(form); setForm(null); setMsg({ ok: true, text: "Tersimpan" }); muat(); }
    catch { setMsg({ ok: false, text: "Gagal menyimpan" }); }
    setTimeout(() => setMsg(null), 2000);
  }
  async function hapus(id?: number) {
    if (!id || !confirm("Hapus intervensi ini?")) return;
    try { await bmsHapusIntervensi(id); muat(); } catch {/* */}
  }
  async function mintaAi() {
    if (!form) return;
    setAiLoading(true); setMsg(null);
    try {
      const r = await bmsRekomendasiAi({ kd_periode: kp, scope: form.scope, ref_id: form.ref_id });
      set({ rekomendasi_ai: r.data.rekomendasi });
      setMsg({ ok: true, text: `Rekomendasi dari ${r.data.provider}/${r.data.model}` });
    } catch (e: unknown) {
      setMsg({ ok: false, text: (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal minta rekomendasi AI" });
    } finally { setAiLoading(false); setTimeout(() => setMsg(null), 4000); }
  }

  return (
    <div className="space-y-4">
      {msg && <div className={`text-xs px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}

      {isAdmin && !form && (
        <button onClick={() => setForm(KOSONG(kp))} className="text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg px-4 py-2">+ Intervensi Baru</button>
      )}

      {/* Form */}
      {form && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">Cakupan
              <select value={form.scope} onChange={e => set({ scope: e.target.value })} className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 mt-1">
                <option value="ORG">Organisasi</option><option value="UNIT">Unit</option><option value="PEGAWAI">Pegawai</option>
              </select></label>
            <label className="text-xs text-slate-500">Ref (kode unit / NIK)
              <input value={form.ref_id ?? ""} onChange={e => set({ ref_id: e.target.value })} placeholder="kosong utk organisasi" className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 mt-1" /></label>
          </div>
          <label className="block text-xs text-slate-500">Temuan
            <div className="relative">
            <textarea value={form.temuan ?? ""} onChange={e => set({ temuan: e.target.value })} rows={2} className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 pr-8 mt-1" />
            <MicButton value={form.temuan ?? ""} onChange={v => set({ temuan: v })} className="absolute right-1.5 bottom-1.5" />
            </div></label>
          <div className="grid grid-cols-2 gap-2">
            {([["pdca_plan", "Plan"], ["pdca_do", "Do"], ["pdca_check", "Check"], ["pdca_act", "Act"]] as const).map(([k, l]) => (
              <label key={k} className="block text-xs text-slate-500">{l}
                <div className="relative">
                <textarea value={(form[k] as string) ?? ""} onChange={e => set({ [k]: e.target.value })} rows={2} className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 pr-8 mt-1" />
                <MicButton value={(form[k] as string) ?? ""} onChange={v => set({ [k]: v })} className="absolute right-1.5 bottom-1.5" />
                </div></label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">Status
              <select value={form.status} onChange={e => set({ status: e.target.value })} className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 mt-1">
                <option value="rencana">Rencana</option><option value="proses">Proses</option><option value="selesai">Selesai</option>
              </select></label>
            <label className="text-xs text-slate-500">Tanggal
              <input type="date" value={form.tgl ?? ""} onChange={e => set({ tgl: e.target.value })} className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 mt-1" /></label>
          </div>

          {/* Rekomendasi AI */}
          <div className="border border-dashed border-emerald-300 rounded-xl p-3 bg-emerald-50/40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-emerald-700">Rekomendasi AI</span>
              <button onClick={mintaAi} disabled={aiLoading} className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg px-3 py-1">
                {aiLoading ? "Meminta…" : "Minta Rekomendasi AI"}
              </button>
            </div>
            <div className="relative">
            <textarea value={form.rekomendasi_ai ?? ""} onChange={e => set({ rekomendasi_ai: e.target.value })} rows={5}
              placeholder="Klik “Minta Rekomendasi AI” untuk mengisi berdasarkan skor BMS periode ini." className="block w-full rounded-lg border border-emerald-200 text-sm px-2 py-1.5 pr-8 bg-white" />
            <MicButton value={form.rekomendasi_ai ?? ""} onChange={v => set({ rekomendasi_ai: v })} className="absolute right-1.5 bottom-1.5" />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={simpan} className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Simpan</button>
            <button onClick={() => setForm(null)} className="px-4 text-sm text-slate-500">Batal</button>
          </div>
        </div>
      )}

      {/* Daftar */}
      {loading ? <div className="text-center text-slate-400 py-8 text-sm">Memuat…</div> : list.length === 0 ? (
        <div className="text-center text-slate-400 py-10 text-sm">Belum ada intervensi untuk periode ini.</div>
      ) : list.map(it => (
        <div key={it.id} className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-slate-700">{it.scope === "ORG" ? "Organisasi" : `${it.scope}: ${it.nama_ref ?? it.ref_id}`}</span>
              <span className={`ml-2 text-[10px] font-semibold rounded-full px-2 py-0.5 ${it.status === "selesai" ? "bg-emerald-100 text-emerald-700" : it.status === "proses" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{it.status}</span>
              {it.tgl && <span className="ml-2 text-[11px] text-slate-400">{it.tgl}</span>}
            </div>
            {isAdmin && (
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setForm(it)} className="text-xs text-emerald-700 font-semibold">Edit</button>
                <button onClick={() => hapus(it.id)} className="text-xs text-rose-600 font-semibold">Hapus</button>
              </div>
            )}
          </div>
          {it.temuan && <p className="text-sm text-slate-600 mt-1.5">{it.temuan}</p>}
          {(it.pdca_plan || it.pdca_do || it.pdca_check || it.pdca_act) && (
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
              {([["Plan", it.pdca_plan], ["Do", it.pdca_do], ["Check", it.pdca_check], ["Act", it.pdca_act]] as const).map(([l, v]) => v ? (
                <div key={l} className="bg-slate-50 rounded-lg px-2 py-1.5"><span className="font-semibold text-slate-500">{l}: </span><span className="text-slate-600">{v}</span></div>
              ) : null)}
            </div>
          )}
          {it.rekomendasi_ai && (
            <div className="mt-2 text-xs bg-emerald-50 text-emerald-800 rounded-lg px-2.5 py-2 whitespace-pre-wrap">🤖 {it.rekomendasi_ai}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Pengaturan (admin) ──────────────────────────────────────────────────────
function PengaturanTab() {
  const [cfg, setCfg] = useState<BmsConfig | null>(null);
  const [aiKey, setAiKey] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { bmsGetConfig().then(r => setCfg(r.data)).catch(() => {}); }, []);
  if (!cfg) return <div className="text-center text-slate-400 py-16 text-sm">Memuat…</div>;

  const set = (k: keyof BmsConfig, v: number) => setCfg({ ...cfg, [k]: v });
  const setS = (k: keyof BmsConfig, v: string) => setCfg({ ...cfg, [k]: v });
  async function simpan() {
    try {
      await bmsPutConfig({
        w_body: cfg!.w_body, w_mind: cfg!.w_mind, w_soul: cfg!.w_soul,
        bmi_ideal: cfg!.bmi_ideal, bmi_k: cfg!.bmi_k,
        ai_provider: cfg!.ai_provider, ai_model: cfg!.ai_model, ai_base_url: cfg!.ai_base_url,
        ai_api_key: aiKey || undefined,
      });
      setAiKey("");
      setMsg("Tersimpan. Hitung ulang index agar berlaku.");
      setTimeout(() => setMsg(""), 2500);
      bmsGetConfig().then(r => setCfg(r.data)).catch(() => {});
    } catch {/* */}
  }
  const totalW = cfg.w_body + cfg.w_mind + cfg.w_soul;
  const prov = cfg.ai_provider ?? "claude";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-md space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Bobot Dimensi</div>
        <div className="grid grid-cols-3 gap-2">
          {(["w_body", "w_mind", "w_soul"] as const).map(k => (
            <label key={k} className="text-xs text-slate-500">{k.replace("w_", "").toUpperCase()}
              <input type="number" step="0.05" min="0" max="1" value={cfg[k]} onChange={e => set(k, parseFloat(e.target.value) || 0)}
                className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 mt-1" /></label>
          ))}
        </div>
        <div className={`text-xs mt-1 ${Math.abs(totalW - 1) < 0.001 ? "text-slate-400" : "text-rose-600"}`}>Total bobot: {totalW.toFixed(2)} (idealnya 1.00)</div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Konversi BMI → Skor</div>
        <p className="text-[11px] text-slate-400 mb-2">skor = 100 − |BMI − ideal| × k (dibatasi 0–100)</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-500">BMI ideal
            <input type="number" step="0.5" value={cfg.bmi_ideal} onChange={e => set("bmi_ideal", parseFloat(e.target.value) || 0)}
              className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 mt-1" /></label>
          <label className="text-xs text-slate-500">Faktor k
            <input type="number" step="0.5" value={cfg.bmi_k} onChange={e => set("bmi_k", parseFloat(e.target.value) || 0)}
              className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 mt-1" /></label>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Layer AI (Rekomendasi)</span>
          <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${cfg.ai_enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {cfg.ai_enabled ? "Siap" : "Belum aktif"}
          </span>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-slate-500 block">Penyedia
            <select value={prov} onChange={e => setS("ai_provider", e.target.value)}
              className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 mt-1">
              <option value="ollama">Ollama (lokal, mis. Gemma)</option>
              <option value="gemini">Google Gemini</option>
              <option value="claude">Anthropic Claude</option>
            </select></label>
          <label className="text-xs text-slate-500 block">Model
            <input value={cfg.ai_model ?? ""} onChange={e => setS("ai_model", e.target.value)}
              placeholder={prov === "gemini" ? "gemini-2.0-flash" : prov === "ollama" ? "gemma4:latest" : "claude-opus-4-8"}
              className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 mt-1" /></label>
          {prov === "ollama" ? (
            <label className="text-xs text-slate-500 block">Base URL Ollama
              <input value={cfg.ai_base_url ?? ""} onChange={e => setS("ai_base_url", e.target.value)}
                placeholder="http://100.83.62.11:11434"
                className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 mt-1" /></label>
          ) : (
            <label className="text-xs text-slate-500 block">API Key {prov === "gemini" ? "Gemini" : "Claude"}
              <input type="password" value={aiKey} onChange={e => setAiKey(e.target.value)}
                placeholder={cfg.ai_enabled ? "•••• (biarkan kosong utk tetap)" : "tempel API key"}
                className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 mt-1" /></label>
          )}
          <p className="text-[11px] text-slate-400">Dipakai tombol “Minta Rekomendasi AI” di tab Intervensi. API key tidak pernah ditampilkan kembali.</p>
        </div>
      </div>

      {msg && <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{msg}</div>}
      <button onClick={simpan} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg px-4 py-2">Simpan Pengaturan</button>
    </div>
  );
}
