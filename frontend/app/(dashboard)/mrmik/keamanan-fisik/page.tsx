"use client";
import { useCallback, useEffect, useState } from "react";
import { hasPerm } from "@/lib/auth";
import {
  mrmikSuhuList, mrmikSuhuCreate, mrmikSuhuDelete,
  mrmikAparList, mrmikAparCreate, mrmikAparDelete,
  mrmikCctvList, mrmikCctvCreate, mrmikCctvDelete,
  MrmikSuhu, MrmikApar, MrmikCctv,
} from "@/lib/api";

function thisMonth() { return new Date().toISOString().slice(0, 7); }
function today() { return new Date().toISOString().slice(0, 10); }
function nowHM() { return new Date().toTimeString().slice(0, 5); }
type Seksi = "suhu" | "apar" | "cctv";

export default function MrmikKeamananPage() {
  const isEdit = hasPerm("mrmik_edit") || hasPerm("rekam_medis") || hasPerm("akreditasi_edit");
  const [seksi, setSeksi] = useState<Seksi>("suhu");
  const [bulan, setBulan] = useState(thisMonth());

  return (
    <div className="space-y-4 p-1">
      <div className="hidden print:block text-center mb-3">
        <div className="font-bold text-lg">MONITORING KEAMANAN FISIK RUANG REKAM MEDIS (MRMIK 2.2)</div>
        <div className="text-sm">RSUD Cabangbungin — Periode {bulan}</div>
      </div>
      <div className="flex flex-wrap items-center gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Keamanan Fisik Ruang RM</h1>
          <p className="text-sm text-slate-500">Suhu &amp; kelembaban, APAR, CCTV — MRMIK 2.2 EP 1</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} className="border rounded-lg px-2 py-1 text-sm" />
          <button onClick={() => window.print()} className="text-sm font-semibold bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-3 py-1.5">🖨 PDF</button>
        </div>
      </div>
      <div className="inline-flex rounded-lg border overflow-hidden text-sm no-print">
        {(["suhu", "apar", "cctv"] as Seksi[]).map((s) => (
          <button key={s} onClick={() => setSeksi(s)} className={`px-4 py-1.5 ${seksi === s ? "bg-teal-600 text-white" : "bg-white text-slate-600"}`}>
            {s === "suhu" ? "Suhu & Kelembaban" : s === "apar" ? "APAR" : "CCTV"}
          </button>
        ))}
      </div>

      {seksi === "suhu" && <SuhuSeksi bulan={bulan} isEdit={isEdit} />}
      {seksi === "apar" && <AparSeksi bulan={bulan} isEdit={isEdit} />}
      {seksi === "cctv" && <CctvSeksi bulan={bulan} isEdit={isEdit} />}
    </div>
  );
}

const badgeOK = (ok: boolean) => `inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${ok ? "bg-teal-100 text-teal-700 border-teal-200" : "bg-rose-100 text-rose-700 border-rose-200"}`;

function SuhuSeksi({ bulan, isEdit }: { bulan: string; isEdit: boolean }) {
  const [data, setData] = useState<MrmikSuhu[]>([]);
  const [rk, setRk] = useState({ total: 0, baik: 0, perlu_tindakan: 0 });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ tanggal: today(), jam: nowHM(), suhu: "", kelembaban: "", keterangan: "" });
  const load = useCallback(async () => {
    const r = await mrmikSuhuList(bulan); setData(r.data.data); setRk(r.data.ringkasan);
  }, [bulan]);
  useEffect(() => { load().catch(() => { setData([]); }); }, [load]);
  async function simpan() {
    const suhu = parseFloat(f.suhu), rh = parseFloat(f.kelembaban);
    const status = (suhu >= 18 && suhu <= 28 && rh >= 40 && rh <= 60) ? "Baik" : "Perlu Tindakan";
    await mrmikSuhuCreate({ tanggal: f.tanggal, jam: f.jam, suhu: isNaN(suhu) ? undefined : suhu, kelembaban: isNaN(rh) ? undefined : rh, status, keterangan: f.keterangan });
    setOpen(false); setF({ tanggal: today(), jam: nowHM(), suhu: "", kelembaban: "", keterangan: "" }); load();
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Card label="Hari Tercatat" value={String(rk.total)} sub="entri bulan ini" />
        <Card label="Dalam Standar (Baik)" value={String(rk.baik)} tone="teal" sub="18–28 °C / 40–60 %RH" />
        <Card label="Perlu Tindakan" value={String(rk.perlu_tindakan)} tone={rk.perlu_tindakan > 0 ? "rose" : "teal"} />
      </div>
      {isEdit && (
        <div className="no-print">
          {!open ? <button onClick={() => setOpen(true)} className="text-sm font-semibold bg-teal-600 text-white rounded-lg px-3 py-1.5">+ Catat</button> : (
            <div className="bg-white rounded-xl border p-4 grid md:grid-cols-3 gap-3">
              <label className="text-xs font-semibold text-slate-600">Tanggal<input type="date" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" /></label>
              <label className="text-xs font-semibold text-slate-600">Jam<input type="time" value={f.jam} onChange={(e) => setF({ ...f, jam: e.target.value })} className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" /></label>
              <label className="text-xs font-semibold text-slate-600">Suhu (°C)<input type="number" step="0.1" value={f.suhu} onChange={(e) => setF({ ...f, suhu: e.target.value })} className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" /></label>
              <label className="text-xs font-semibold text-slate-600">Kelembaban (%RH)<input type="number" step="0.1" value={f.kelembaban} onChange={(e) => setF({ ...f, kelembaban: e.target.value })} className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" /></label>
              <label className="text-xs font-semibold text-slate-600 md:col-span-2">Keterangan<input value={f.keterangan} onChange={(e) => setF({ ...f, keterangan: e.target.value })} className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" /></label>
              <div className="md:col-span-3 flex gap-2"><button onClick={simpan} className="text-sm font-semibold bg-teal-600 text-white rounded-lg px-4 py-1.5">Simpan</button><button onClick={() => setOpen(false)} className="text-sm text-slate-500">Batal</button></div>
            </div>
          )}
        </div>
      )}
      <div className="bg-white rounded-xl border p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b"><th className="py-2 pr-3">Tanggal</th><th className="py-2 px-3">Jam</th><th className="py-2 px-3 text-right">Suhu (°C)</th><th className="py-2 px-3 text-right">Kelembaban (%RH)</th><th className="py-2 px-3">Status</th><th className="py-2 px-3">Petugas</th>{isEdit && <th className="no-print"></th>}</tr></thead>
          <tbody>
            {data.length === 0 && <tr><td colSpan={isEdit ? 7 : 6} className="text-center text-slate-400 py-6">Belum ada data.</td></tr>}
            {data.map((d) => (
              <tr key={d.id} className="border-b last:border-0">
                <td className="py-2 pr-3 tabular-nums">{d.tanggal}</td><td className="py-2 px-3 tabular-nums">{d.jam}</td>
                <td className="py-2 px-3 text-right tabular-nums">{d.suhu ?? "–"}</td><td className="py-2 px-3 text-right tabular-nums">{d.kelembaban ?? "–"}</td>
                <td className="py-2 px-3"><span className={badgeOK(d.status === "Baik")}>{d.status}</span></td>
                <td className="py-2 px-3 text-xs text-slate-500">{d.nama_petugas || "–"}</td>
                {isEdit && <td className="no-print py-2"><button onClick={() => mrmikSuhuDelete(d.id).then(load)} className="text-xs text-rose-600 hover:underline">Hapus</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AparSeksi({ bulan, isEdit }: { bulan: string; isEdit: boolean }) {
  const [data, setData] = useState<MrmikApar[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ tanggal: today(), jam: nowHM(), lokasi: "", jenis: "Powder ABC", tekanan: "Hijau", segel: "Baik", selang: "Baik", kondisi_isi: "Terisi", tgl_kadaluarsa: "", keterangan: "" });
  const load = useCallback(async () => { const r = await mrmikAparList(bulan); setData(r.data.data); }, [bulan]);
  useEffect(() => { load().catch(() => setData([])); }, [load]);
  async function simpan() { await mrmikAparCreate(f); setOpen(false); setF({ ...f, lokasi: "", keterangan: "" }); load(); }
  const sel = (v: string, on: (x: string) => void, opts: string[]) => <select value={v} onChange={(e) => on(e.target.value)} className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal">{opts.map(o => <option key={o}>{o}</option>)}</select>;
  return (
    <div className="space-y-3">
      {isEdit && (
        <div className="no-print">
          {!open ? <button onClick={() => setOpen(true)} className="text-sm font-semibold bg-teal-600 text-white rounded-lg px-3 py-1.5">+ Pemeriksaan APAR</button> : (
            <div className="bg-white rounded-xl border p-4 grid md:grid-cols-3 gap-3">
              <label className="text-xs font-semibold text-slate-600">Tanggal<input type="date" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" /></label>
              <label className="text-xs font-semibold text-slate-600">Jam<input type="time" value={f.jam} onChange={(e) => setF({ ...f, jam: e.target.value })} className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" /></label>
              <label className="text-xs font-semibold text-slate-600">Lokasi<input value={f.lokasi} onChange={(e) => setF({ ...f, lokasi: e.target.value })} placeholder="mis. Depan Ruang RM" className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" /></label>
              <label className="text-xs font-semibold text-slate-600">Jenis{sel(f.jenis, v => setF({ ...f, jenis: v }), ["Powder ABC", "CO2", "Foam", "Air"])}</label>
              <label className="text-xs font-semibold text-slate-600">Tekanan{sel(f.tekanan, v => setF({ ...f, tekanan: v }), ["Hijau", "Kuning", "Merah"])}</label>
              <label className="text-xs font-semibold text-slate-600">Kondisi Isi{sel(f.kondisi_isi, v => setF({ ...f, kondisi_isi: v }), ["Terisi", "Kosong"])}</label>
              <label className="text-xs font-semibold text-slate-600">Segel{sel(f.segel, v => setF({ ...f, segel: v }), ["Baik", "Rusak"])}</label>
              <label className="text-xs font-semibold text-slate-600">Selang{sel(f.selang, v => setF({ ...f, selang: v }), ["Baik", "Rusak"])}</label>
              <label className="text-xs font-semibold text-slate-600">Tgl Kadaluarsa<input type="date" value={f.tgl_kadaluarsa} onChange={(e) => setF({ ...f, tgl_kadaluarsa: e.target.value })} className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" /></label>
              <label className="text-xs font-semibold text-slate-600 md:col-span-3">Keterangan<input value={f.keterangan} onChange={(e) => setF({ ...f, keterangan: e.target.value })} className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" /></label>
              <div className="md:col-span-3 flex gap-2"><button onClick={simpan} className="text-sm font-semibold bg-teal-600 text-white rounded-lg px-4 py-1.5">Simpan</button><button onClick={() => setOpen(false)} className="text-sm text-slate-500">Batal</button></div>
            </div>
          )}
        </div>
      )}
      <div className="bg-white rounded-xl border p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b"><th className="py-2 pr-3">Tanggal</th><th className="py-2 px-3">Jam</th><th className="py-2 px-3">Lokasi</th><th className="py-2 px-3">Jenis</th><th className="py-2 px-3">Tekanan</th><th className="py-2 px-3">Isi</th><th className="py-2 px-3">Segel</th><th className="py-2 px-3">Selang</th><th className="py-2 px-3">Kadaluarsa</th><th className="py-2 px-3">Petugas</th>{isEdit && <th className="no-print"></th>}</tr></thead>
          <tbody>
            {data.length === 0 && <tr><td colSpan={isEdit ? 11 : 10} className="text-center text-slate-400 py-6">Belum ada data.</td></tr>}
            {data.map((d) => (
              <tr key={d.id} className="border-b last:border-0">
                <td className="py-2 pr-3 tabular-nums">{d.tanggal}</td><td className="py-2 px-3 tabular-nums">{d.jam ?? "–"}</td><td className="py-2 px-3">{d.lokasi}</td><td className="py-2 px-3">{d.jenis}</td>
                <td className="py-2 px-3"><span className={badgeOK(d.tekanan === "Hijau")}>{d.tekanan}</span></td>
                <td className="py-2 px-3"><span className={badgeOK(d.kondisi_isi === "Terisi")}>{d.kondisi_isi}</span></td>
                <td className="py-2 px-3"><span className={badgeOK(d.segel === "Baik")}>{d.segel}</span></td>
                <td className="py-2 px-3"><span className={badgeOK(d.selang === "Baik")}>{d.selang}</span></td>
                <td className="py-2 px-3 tabular-nums text-slate-600">{d.tgl_kadaluarsa || "–"}</td><td className="py-2 px-3 text-xs text-slate-500">{d.nama_petugas || "–"}</td>
                {isEdit && <td className="no-print py-2"><button onClick={() => mrmikAparDelete(d.id).then(load)} className="text-xs text-rose-600 hover:underline">Hapus</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CctvSeksi({ bulan, isEdit }: { bulan: string; isEdit: boolean }) {
  const [data, setData] = useState<MrmikCctv[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ tanggal: today(), jam: nowHM(), lokasi: "", berfungsi: "Ya", kualitas: "Baik", durasi_rekaman_hari: "30", keterangan: "" });
  const load = useCallback(async () => { const r = await mrmikCctvList(bulan); setData(r.data.data); }, [bulan]);
  useEffect(() => { load().catch(() => setData([])); }, [load]);
  async function simpan() { await mrmikCctvCreate({ ...f, durasi_rekaman_hari: parseInt(f.durasi_rekaman_hari) || undefined }); setOpen(false); setF({ ...f, lokasi: "", keterangan: "" }); load(); }
  const sel = (v: string, on: (x: string) => void, opts: string[]) => <select value={v} onChange={(e) => on(e.target.value)} className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal">{opts.map(o => <option key={o}>{o}</option>)}</select>;
  return (
    <div className="space-y-3">
      {isEdit && (
        <div className="no-print">
          {!open ? <button onClick={() => setOpen(true)} className="text-sm font-semibold bg-teal-600 text-white rounded-lg px-3 py-1.5">+ Pemeriksaan CCTV</button> : (
            <div className="bg-white rounded-xl border p-4 grid md:grid-cols-3 gap-3">
              <label className="text-xs font-semibold text-slate-600">Tanggal<input type="date" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" /></label>
              <label className="text-xs font-semibold text-slate-600">Jam<input type="time" value={f.jam} onChange={(e) => setF({ ...f, jam: e.target.value })} className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" /></label>
              <label className="text-xs font-semibold text-slate-600">Lokasi<input value={f.lokasi} onChange={(e) => setF({ ...f, lokasi: e.target.value })} placeholder="mis. Pintu Masuk RM" className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" /></label>
              <label className="text-xs font-semibold text-slate-600">Berfungsi{sel(f.berfungsi, v => setF({ ...f, berfungsi: v }), ["Ya", "Tidak"])}</label>
              <label className="text-xs font-semibold text-slate-600">Kualitas{sel(f.kualitas, v => setF({ ...f, kualitas: v }), ["Baik", "Cukup", "Buruk"])}</label>
              <label className="text-xs font-semibold text-slate-600">Durasi Rekaman (hari)<input type="number" value={f.durasi_rekaman_hari} onChange={(e) => setF({ ...f, durasi_rekaman_hari: e.target.value })} className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" /></label>
              <label className="text-xs font-semibold text-slate-600 md:col-span-3">Keterangan<input value={f.keterangan} onChange={(e) => setF({ ...f, keterangan: e.target.value })} className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" /></label>
              <div className="md:col-span-3 flex gap-2"><button onClick={simpan} className="text-sm font-semibold bg-teal-600 text-white rounded-lg px-4 py-1.5">Simpan</button><button onClick={() => setOpen(false)} className="text-sm text-slate-500">Batal</button></div>
            </div>
          )}
        </div>
      )}
      <div className="bg-white rounded-xl border p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b"><th className="py-2 pr-3">Tanggal</th><th className="py-2 px-3">Jam</th><th className="py-2 px-3">Lokasi</th><th className="py-2 px-3">Berfungsi</th><th className="py-2 px-3">Kualitas</th><th className="py-2 px-3 text-right">Rekaman (hari)</th><th className="py-2 px-3">Petugas</th>{isEdit && <th className="no-print"></th>}</tr></thead>
          <tbody>
            {data.length === 0 && <tr><td colSpan={isEdit ? 8 : 7} className="text-center text-slate-400 py-6">Belum ada data.</td></tr>}
            {data.map((d) => (
              <tr key={d.id} className="border-b last:border-0">
                <td className="py-2 pr-3 tabular-nums">{d.tanggal}</td><td className="py-2 px-3 tabular-nums">{d.jam ?? "–"}</td><td className="py-2 px-3">{d.lokasi}</td>
                <td className="py-2 px-3"><span className={badgeOK(d.berfungsi === "Ya")}>{d.berfungsi}</span></td>
                <td className="py-2 px-3"><span className={badgeOK(d.kualitas === "Baik")}>{d.kualitas}</span></td>
                <td className="py-2 px-3 text-right tabular-nums">{d.durasi_rekaman_hari ?? "–"}</td>
                <td className="py-2 px-3 text-xs text-slate-500">{d.nama_petugas || "–"}</td>
                {isEdit && <td className="no-print py-2"><button onClick={() => mrmikCctvDelete(d.id).then(load)} className="text-xs text-rose-600 hover:underline">Hapus</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: string }) {
  const ring: Record<string, string> = { default: "border-slate-200", teal: "border-teal-200", rose: "border-rose-200" };
  const val: Record<string, string> = { default: "text-slate-800", teal: "text-teal-700", rose: "text-rose-700" };
  return (
    <div className={`bg-white rounded-xl border ${ring[tone]} p-4`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${val[tone]}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}
