"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listLogKinerja, buatLogKinerja, LogKinerjaRow } from "@/lib/api";
import { getSession } from "@/lib/auth";
import MicButton from "@/components/MicButton";

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function nowHM() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface FormBaru {
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  judul: string;
  deskripsi: string;
  lokasi: string;
}

export default function LogKinerjaListPage() {
  const router = useRouter();
  const session = typeof window !== "undefined" ? getSession() : null;

  const [tanggal, setTanggal] = useState(todayStr());
  const [rows, setRows] = useState<LogKinerjaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormBaru>({
    tanggal: todayStr(),
    jam_mulai: nowHM(),
    jam_selesai: "",
    judul: "",
    deskripsi: "",
    lokasi: "",
  });

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    listLogKinerja({ tanggal })
      .then(r => setRows(r.data.data || []))
      .catch(() => setErrMsg("Gagal memuat log"))
      .finally(() => setLoading(false));
  }, [tanggal]);

  useEffect(() => { reload(); }, [reload]);

  const handleSimpan = async () => {
    setErrMsg("");
    if (!form.judul.trim()) { setErrMsg("Judul kegiatan wajib diisi"); return; }
    if (!form.jam_mulai)    { setErrMsg("Jam mulai wajib diisi"); return; }
    setSaving(true);
    try {
      const r = await buatLogKinerja({
        tanggal:     form.tanggal,
        jam_mulai:   form.jam_mulai,
        jam_selesai: form.jam_selesai || undefined,
        judul:       form.judul.trim(),
        deskripsi:   form.deskripsi.trim() || undefined,
        lokasi:      form.lokasi.trim() || undefined,
      });
      setSaving(false);
      setShowForm(false);
      // Langsung navigate ke detail untuk upload foto
      router.push(`/log-kinerja/${r.data.id}`);
    } catch (e: unknown) {
      setSaving(false);
      const msg = e instanceof Error ? e.message : "Gagal menyimpan";
      setErrMsg(msg);
    }
  };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Log Kinerja Harian</h1>
          <p className="text-xs text-slate-500">
            {session?.nama || "-"} <span className="font-mono">({session?.kode || "-"})</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/log-kinerja/rekap"
            className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-sm text-slate-700">
            Rekap Bulanan
          </Link>
          <button onClick={() => { setForm(f => ({ ...f, tanggal, jam_mulai: nowHM() })); setShowForm(true); }}
            className="px-4 py-2 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-medium">
            + Log Baru
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
        <label className="text-xs text-slate-500 block mb-1">Tanggal</label>
        <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
      </div>

      {errMsg && <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm">{errMsg}</div>}

      <div className="bg-white border border-slate-200 rounded-2xl">
        {loading ? (
          <div className="p-6 text-center text-slate-400 text-sm">Memuat...</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm italic">Belum ada log untuk tanggal ini.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map(r => (
              <li key={r.id} className="p-4 hover:bg-slate-50">
                <Link href={`/log-kinerja/${r.id}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{r.judul}</p>
                      {r.deskripsi && <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{r.deskripsi}</p>}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-500">
                        <span>🕐 {r.jam_mulai}{r.jam_selesai ? ` – ${r.jam_selesai}` : ""}</span>
                        {r.lokasi && <span>📍 {r.lokasi}</span>}
                        <span>📷 {r.foto_count} foto</span>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-slate-400 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal Form Baru */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !saving && setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-slate-800 mb-3">Log Kegiatan Baru</h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label="Tanggal">
                <input type="date" value={form.tanggal}
                  onChange={(e) => setForm(f => ({ ...f, tanggal: e.target.value }))} className="inp" />
              </Field>
              <Field label="Lokasi (opsional)">
                <input value={form.lokasi} onChange={(e) => setForm(f => ({ ...f, lokasi: e.target.value }))}
                  placeholder="Ruangan / unit" className="inp" />
              </Field>
              <Field label="Jam mulai">
                <input type="time" value={form.jam_mulai}
                  onChange={(e) => setForm(f => ({ ...f, jam_mulai: e.target.value }))} className="inp" />
              </Field>
              <Field label="Jam selesai (opsional)">
                <input type="time" value={form.jam_selesai}
                  onChange={(e) => setForm(f => ({ ...f, jam_selesai: e.target.value }))} className="inp" />
              </Field>
              <Field label="Judul kegiatan" span>
                <input value={form.judul} onChange={(e) => setForm(f => ({ ...f, judul: e.target.value }))}
                  placeholder="mis. Asuhan keperawatan pasien Ruang Mawar" className="inp" />
              </Field>
              <Field label="Deskripsi (opsional)" span>
                <div className="relative">
                  <textarea rows={3} value={form.deskripsi}
                    onChange={(e) => setForm(f => ({ ...f, deskripsi: e.target.value }))}
                    placeholder="Detail kegiatan, kondisi pasien, hasil, dll" className="inp pr-8" />
                  <MicButton value={form.deskripsi} onChange={v => setForm(f => ({ ...f, deskripsi: v }))} className="absolute right-1.5 bottom-1.5" />
                </div>
              </Field>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} disabled={saving}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm text-slate-700 hover:bg-slate-50">
                Batal
              </button>
              <button onClick={handleSimpan} disabled={saving}
                className="px-4 py-2 rounded-xl bg-green-700 hover:bg-green-800 disabled:bg-slate-400 text-white text-sm font-medium">
                {saving ? "Menyimpan..." : "Simpan & Upload Foto"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.inp) {
          width: 100%;
          border: 1px solid rgb(226 232 240);
          border-radius: 0.5rem;
          padding: 0.5rem 0.625rem;
          font-size: 0.75rem;
          color: rgb(15 23 42);
          background: white;
        }
        :global(.inp:focus) { outline: none; border-color: rgb(22 163 74); box-shadow: 0 0 0 1px rgb(22 163 74); }
      `}</style>
    </div>
  );
}

function Field({ label, children, span = false }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <label className="text-slate-500 block mb-0.5">{label}</label>
      {children}
    </div>
  );
}
