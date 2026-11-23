"use client";
import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import {
  getEvalPendaftaranRekap, getEvalPendaftaranCatatan, saveEvalPendaftaranCatatan,
  EvalPendaftaranRekap,
} from "@/lib/api";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
const nf = (n: number) => n.toLocaleString("id-ID");

export default function EvaluasiPendaftaranPage() {
  const isEdit = hasPerm("evaluasi_pendaftaran_edit") || hasPerm("akreditasi_edit");
  const [dari, setDari] = useState(monthStartStr());
  const [sampai, setSampai] = useState(todayStr());
  const [rekap, setRekap] = useState<EvalPendaftaranRekap | null>(null);
  const [loading, setLoading] = useState(false);
  const [analisa, setAnalisa] = useState("");
  const [kendala, setKendala] = useState("");
  const [tindak, setTindak] = useState("");
  const [pelapor, setPelapor] = useState<string | undefined>();
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const periode = dari.slice(0, 7);

  const load = useCallback(async () => {
    setLoading(true); setMsg("");
    try {
      const r = await getEvalPendaftaranRekap({ dari, sampai });
      setRekap(r.data);
      const c = await getEvalPendaftaranCatatan(dari.slice(0, 7));
      setAnalisa(c.data.analisa ?? "");
      setKendala(c.data.kendala ?? "");
      setTindak(c.data.tindak_lanjut ?? "");
      setPelapor(c.data.pelapor);
      setUpdatedAt(c.data.updated_at);
    } catch {
      setRekap(null);
    } finally {
      setLoading(false);
    }
  }, [dari, sampai]);

  useEffect(() => { load(); }, [load]);

  const simpan = async () => {
    if (!rekap) return;
    setSaving(true); setMsg("");
    try {
      await saveEvalPendaftaranCatatan({
        periode,
        jml_online: rekap.online,
        jml_offline: rekap.offline,
        waktu_tunggu: rekap.waktu_tunggu_avg,
        analisa, kendala, tindak_lanjut: tindak,
      });
      setMsg("Catatan evaluasi tersimpan.");
      const c = await getEvalPendaftaranCatatan(periode);
      setPelapor(c.data.pelapor); setUpdatedAt(c.data.updated_at);
    } catch {
      setMsg("Gagal menyimpan catatan.");
    } finally {
      setSaving(false);
    }
  };

  const maxTot = rekap ? Math.max(1, ...rekap.trend.map((t) => t.total)) : 1;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* Kop cetak */}
      <div className="hidden print:block text-center mb-3">
        <div className="font-bold text-lg">EVALUASI SISTEM PENDAFTARAN PASIEN</div>
        <div className="text-sm">RSUD Cabangbungin — Periode {periode}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Evaluasi Pendaftaran</h1>
          <p className="text-sm text-slate-500">Online vs offline &amp; waktu tunggu — AKP 2b</p>
        </div>
        <div className="flex items-end gap-2 ml-auto">
          <label className="text-xs text-slate-500">Dari
            <input type="date" value={dari} onChange={(e) => setDari(e.target.value)}
              className="block border rounded-lg px-2 py-1 text-sm" />
          </label>
          <label className="text-xs text-slate-500">Sampai
            <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)}
              className="block border rounded-lg px-2 py-1 text-sm" />
          </label>
          <button onClick={() => load()} disabled={loading}
            className="text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
            {loading ? "Memuat…" : "Terapkan"}
          </button>
          <button onClick={() => window.print()}
            className="text-sm font-semibold bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-3 py-1.5">Cetak</button>
        </div>
      </div>

      {!rekap && !loading && (
        <div className="text-center text-slate-400 py-16">Tidak ada data untuk rentang ini.</div>
      )}

      {rekap && (
        <>
          {/* Kartu ringkasan */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Total Pendaftaran" value={nf(rekap.total)} sub={`${dari} → ${sampai}`} />
            <Card label="Online (Mobile JKN)" value={nf(rekap.online)} sub={`${rekap.online_pct.toFixed(1)}% dari total`} tone="teal" />
            <Card label="Offline (Loket)" value={nf(rekap.offline)} sub={`${(100 - rekap.online_pct).toFixed(1)}% dari total`} tone="amber" />
            <Card label="Waktu Tunggu Rawat Jalan"
              value={rekap.waktu_tunggu_avg != null ? `${rekap.waktu_tunggu_avg.toFixed(0)} mnt` : "–"}
              sub={rekap.wt_le60_pct != null ? `${rekap.wt_le60_pct.toFixed(0)}% ≤ 60 mnt (n=${nf(rekap.wt_n)})` : "data belum ada"}
              tone="slate" />
          </div>

          {/* Proporsi online/offline + ralan/ranap */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border p-4">
              <div className="text-sm font-semibold text-slate-700 mb-2">Proporsi Online vs Offline</div>
              <div className="flex h-6 rounded-lg overflow-hidden bg-slate-100">
                <div className="bg-teal-500 h-full" style={{ width: `${rekap.online_pct}%` }} title={`Online ${nf(rekap.online)}`} />
                <div className="bg-amber-500 h-full" style={{ width: `${100 - rekap.online_pct}%` }} title={`Offline ${nf(rekap.offline)}`} />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span><span className="inline-block w-2.5 h-2.5 bg-teal-500 rounded-sm align-middle mr-1" />Online {nf(rekap.online)}</span>
                <span><span className="inline-block w-2.5 h-2.5 bg-amber-500 rounded-sm align-middle mr-1" />Offline {nf(rekap.offline)}</span>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="text-sm font-semibold text-slate-700 mb-2">Rawat Jalan vs Rawat Inap</div>
              <div className="flex items-end gap-4 h-16">
                <Bar label="Rawat Jalan" value={rekap.ralan} max={Math.max(rekap.ralan, rekap.ranap, 1)} color="bg-sky-500" />
                <Bar label="Rawat Inap" value={rekap.ranap} max={Math.max(rekap.ralan, rekap.ranap, 1)} color="bg-indigo-500" />
              </div>
            </div>
          </div>

          {/* Tren harian */}
          <div className="bg-white rounded-xl border p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">Tren Harian (online = teal, offline = amber)</div>
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1 h-40 min-w-full">
                {rekap.trend.length === 0 && <div className="text-sm text-slate-400">Tidak ada data.</div>}
                {rekap.trend.map((t) => (
                  <div key={t.tgl} className="flex flex-col items-center justify-end flex-1 min-w-[10px]" title={`${t.tgl}: total ${t.total}, online ${t.online}, offline ${t.offline}`}>
                    <div className="w-full flex flex-col justify-end" style={{ height: `${(t.total / maxTot) * 100}%` }}>
                      <div className="bg-amber-400 w-full" style={{ height: `${(t.offline / Math.max(t.total, 1)) * 100}%` }} />
                      <div className="bg-teal-500 w-full" style={{ height: `${(t.online / Math.max(t.total, 1)) * 100}%` }} />
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1 rotate-0">{t.tgl.slice(8)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Catatan evaluasi */}
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-slate-700">Analisis, Kendala &amp; Tindak Lanjut — Periode {periode}</div>
              {(pelapor || updatedAt) && (
                <span className="text-xs text-slate-400">terakhir: {pelapor ?? "-"} · {updatedAt ?? "-"}</span>
              )}
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Analisis" value={analisa} onChange={setAnalisa} disabled={!isEdit}
                placeholder="Mis. proporsi pendaftaran online naik…" />
              <Field label="Kendala" value={kendala} onChange={setKendala} disabled={!isEdit}
                placeholder="Mis. antrean loket menumpuk pagi hari…" />
              <Field label="Tindak Lanjut" value={tindak} onChange={setTindak} disabled={!isEdit}
                placeholder="Mis. tambah loket / sosialisasi Mobile JKN…" />
            </div>
            {isEdit && (
              <div className="flex items-center gap-3 no-print">
                <button onClick={simpan} disabled={saving}
                  className="text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
                  {saving ? "Menyimpan…" : "Simpan Catatan"}
                </button>
                {msg && <span className="text-sm text-slate-500">{msg}</span>}
              </div>
            )}
            {!isEdit && <div className="text-xs text-slate-400">Anda tidak memiliki izin mengisi catatan (perlu <code>evaluasi_pendaftaran_edit</code>).</div>}
          </div>
        </>
      )}
    </div>
  );
}

function Card({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: string }) {
  const ring: Record<string, string> = {
    default: "border-slate-200", teal: "border-teal-200", amber: "border-amber-200", slate: "border-slate-200",
  };
  const val: Record<string, string> = {
    default: "text-slate-800", teal: "text-teal-700", amber: "text-amber-700", slate: "text-slate-800",
  };
  return (
    <div className={`bg-white rounded-xl border ${ring[tone]} p-4`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${val[tone]}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex flex-col items-center justify-end flex-1">
      <div className="text-xs font-semibold text-slate-700 tabular-nums">{value.toLocaleString("id-ID")}</div>
      <div className={`w-8 ${color} rounded-t`} style={{ height: `${(value / max) * 100}%`, minHeight: "2px" }} />
      <div className="text-[10px] text-slate-500 mt-1 text-center">{label}</div>
    </div>
  );
}

function Field({ label, value, onChange, disabled, placeholder }:
  { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }) {
  return (
    <label className="text-xs font-semibold text-slate-600">{label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder}
        rows={4}
        className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal text-slate-700 disabled:bg-slate-50 disabled:text-slate-500" />
    </label>
  );
}
