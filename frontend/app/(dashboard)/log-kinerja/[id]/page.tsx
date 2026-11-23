"use client";

import MicButton from "@/components/MicButton";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  detailLogKinerja, editLogKinerja, hapusLogKinerja,
  uploadLogKinerjaFoto, hapusLogKinerjaFoto,
  LogKinerjaRow, LogKinerjaFotoRow,
} from "@/lib/api";

const FOLDER = "logkinerjapegawai";
const MAX_FOTO = 10;

interface EditForm {
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  judul: string;
  deskripsi: string;
  lokasi: string;
}

// ── KameraCapture (sama pattern dgn materi edukasi) ─────────────────────────
function KameraCapture({ onCapture, disabled }: { onCapture: (dataUrl: string) => void; disabled: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [err, setErr] = useState("");
  const streamRef = useRef<MediaStream | null>(null);

  async function startCamera() {
    setErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, audio: false,
      });
      streamRef.current = s;
      setStreaming(true);
    } catch { setErr("Kamera tidak dapat diakses."); }
  }
  useEffect(() => {
    if (!streaming || !videoRef.current || !streamRef.current) return;
    const v = videoRef.current;
    v.srcObject = streamRef.current;
    v.play().catch(() => {});
    return () => { v.srcObject = null; };
  }, [streaming]);
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }
  function takeSnapshot() {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    if (v.readyState < 2 || !v.videoWidth) { setErr("Kamera belum siap."); return; }
    const c = canvasRef.current;
    c.width  = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const url = c.toDataURL("image/jpeg", 0.85);
    onCapture(url);
    stopCamera();
  }
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <p className="text-xs font-semibold text-slate-700 mb-2">📷 Ambil Foto dari Kamera</p>
      {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
      {streaming ? (
        <>
          <video ref={videoRef} className="w-full rounded border" style={{ maxHeight: 240 }} playsInline muted />
          <div className="flex gap-2 mt-2 justify-center">
            <button onClick={takeSnapshot} disabled={disabled}
              className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white text-xs px-4 py-1.5 rounded-lg">
              Ambil
            </button>
            <button onClick={stopCamera} disabled={disabled}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-4 py-1.5 rounded-lg">
              Tutup
            </button>
          </div>
        </>
      ) : (
        <button onClick={startCamera} disabled={disabled}
          className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg h-28 text-slate-400 text-xs disabled:opacity-40">
          <svg className="w-7 h-7 mb-1 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Buka kamera
        </button>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ── File picker yang convert ke dataURL ─────────────────────────────────────
function FilePicker({ onPick, disabled }: { onPick: (dataUrl: string) => void; disabled: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");

  function handle(files: FileList | null) {
    if (!files) return;
    setErr("");
    Array.from(files).forEach(file => {
      if (!file.type.startsWith("image/")) { setErr("File harus gambar"); return; }
      if (file.size > 5 * 1024 * 1024)     { setErr("Maks 5 MB per foto"); return; }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") onPick(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <p className="text-xs font-semibold text-slate-700 mb-2">📎 Pilih File dari Galeri / Disk</p>
      {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
      <button onClick={() => inputRef.current?.click()} disabled={disabled}
        className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg h-28 text-slate-400 text-xs disabled:opacity-40">
        <svg className="w-7 h-7 mb-1 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Pilih foto
      </button>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => handle(e.target.files)} />
    </div>
  );
}

export default function LogKinerjaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = parseInt(params.id as string, 10);

  const [log, setLog] = useState<LogKinerjaRow | null>(null);
  const [fotos, setFotos] = useState<LogKinerjaFotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [hwBase, setHwBase] = useState("");
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>({
    tanggal: "", jam_mulai: "", jam_selesai: "", judul: "", deskripsi: "", lokasi: "",
  });

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    detailLogKinerja(id)
      .then(r => {
        setLog(r.data.data);
        setFotos(r.data.fotos || []);
        const d = r.data.data;
        setForm({
          tanggal:     d.tanggal,
          jam_mulai:   d.jam_mulai,
          jam_selesai: d.jam_selesai || "",
          judul:       d.judul,
          deskripsi:   d.deskripsi || "",
          lokasi:      d.lokasi || "",
        });
      })
      .catch(() => setErrMsg("Gagal memuat detail log"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (isNaN(id)) { router.push("/log-kinerja"); return; }
    reload();
    // Ambil hwBase dari config simrscb
    fetch("/api/simrscb/config", {
      headers: { Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("simrscb_token") : ""}` },
    }).then(r => r.json()).then(c => {
      if (c?.hosthybridweb) {
        const v: string = c.hosthybridweb;
        setHwBase(v.startsWith("http")
          ? v.replace(/\/[^/]+\.php$/, "")
          : `/${v.replace(/^\/+|\/+$/g, "")}`);
      }
    }).catch(() => {});
  }, [id, reload, router]);

  const handleSimpanEdit = async () => {
    setErrMsg(""); setOkMsg("");
    if (!form.judul.trim()) { setErrMsg("Judul wajib"); return; }
    setBusy(true);
    try {
      await editLogKinerja(id, {
        tanggal:     form.tanggal,
        jam_mulai:   form.jam_mulai,
        jam_selesai: form.jam_selesai || undefined,
        judul:       form.judul.trim(),
        deskripsi:   form.deskripsi.trim() || undefined,
        lokasi:      form.lokasi.trim() || undefined,
      });
      setBusy(false); setEditing(false);
      setOkMsg("Log diperbarui");
      setTimeout(() => setOkMsg(""), 3000);
      reload();
    } catch (e: unknown) {
      setBusy(false);
      setErrMsg(e instanceof Error ? e.message : "Gagal simpan");
    }
  };

  const handleHapusLog = async () => {
    if (!confirm("Hapus log ini beserta semua fotonya?")) return;
    setBusy(true);
    try {
      await hapusLogKinerja(id);
      router.push("/log-kinerja");
    } catch {
      setBusy(false);
      setErrMsg("Gagal hapus");
    }
  };

  const handleUploadFoto = async (dataUrl: string) => {
    if (!dataUrl || !log) return;
    if (fotos.length >= MAX_FOTO) {
      setErrMsg(`Maksimal ${MAX_FOTO} foto per log`); return;
    }
    setBusy(true); setErrMsg("");
    try {
      await uploadLogKinerjaFoto(id, { foto_base64: dataUrl });
      setBusy(false);
      setOkMsg("Foto tersimpan");
      setTimeout(() => setOkMsg(""), 3000);
      reload();
    } catch (e: unknown) {
      setBusy(false);
      setErrMsg(e instanceof Error ? e.message : "Gagal upload foto");
    }
  };

  const handleHapusFoto = async (fotoId: number) => {
    if (!confirm("Hapus foto ini?")) return;
    setBusy(true);
    try {
      await hapusLogKinerjaFoto(id, fotoId);
      reload();
    } catch {
      setBusy(false);
      setErrMsg("Gagal hapus foto");
    }
  };

  if (loading) return <div className="p-6 text-center text-slate-400 text-sm">Memuat...</div>;
  if (!log)    return <div className="p-6 text-center text-red-500 text-sm">{errMsg || "Log tidak ditemukan"}</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/log-kinerja" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </Link>
        <h1 className="flex-1 text-base font-bold text-slate-700">Detail Log Kegiatan</h1>
        {!editing && (
          <>
            <button onClick={() => setEditing(true)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50">
              Edit
            </button>
            <button onClick={handleHapusLog} disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-red-300 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40">
              Hapus
            </button>
          </>
        )}
      </div>

      {errMsg && <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm">{errMsg}</div>}
      {okMsg  && <div className="mb-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-green-800 text-sm">{okMsg}</div>}

      {/* Detail / form edit */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
        {editing ? (
          <>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <FieldRow label="Tanggal">
                <input type="date" value={form.tanggal}
                  onChange={(e) => setForm(f => ({ ...f, tanggal: e.target.value }))} className="inp" />
              </FieldRow>
              <FieldRow label="Lokasi (opsional)">
                <input value={form.lokasi}
                  onChange={(e) => setForm(f => ({ ...f, lokasi: e.target.value }))} className="inp" />
              </FieldRow>
              <FieldRow label="Jam mulai">
                <input type="time" value={form.jam_mulai}
                  onChange={(e) => setForm(f => ({ ...f, jam_mulai: e.target.value }))} className="inp" />
              </FieldRow>
              <FieldRow label="Jam selesai (opsional)">
                <input type="time" value={form.jam_selesai}
                  onChange={(e) => setForm(f => ({ ...f, jam_selesai: e.target.value }))} className="inp" />
              </FieldRow>
              <FieldRow label="Judul" span>
                <input value={form.judul}
                  onChange={(e) => setForm(f => ({ ...f, judul: e.target.value }))} className="inp" />
              </FieldRow>
              <FieldRow label="Deskripsi" span>
                <div className="relative">
                  <textarea rows={3} value={form.deskripsi}
                    onChange={(e) => setForm(f => ({ ...f, deskripsi: e.target.value }))} className="inp pr-8" />
                  <MicButton value={form.deskripsi} onChange={v => setForm(f => ({ ...f, deskripsi: v }))} className="absolute right-1.5 bottom-1.5" />
                </div>
              </FieldRow>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => { setEditing(false); reload(); }} disabled={busy}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm text-slate-700 hover:bg-slate-50">
                Batal
              </button>
              <button onClick={handleSimpanEdit} disabled={busy}
                className="px-4 py-2 rounded-xl bg-green-700 hover:bg-green-800 disabled:bg-slate-400 text-white text-sm font-medium">
                {busy ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </>
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <Info label="Tanggal" value={log.tanggal} />
            <Info label="Lokasi"  value={log.lokasi || "-"} />
            <Info label="Jam"     value={`${log.jam_mulai}${log.jam_selesai ? ` – ${log.jam_selesai}` : ""}`} />
            <Info label="Pegawai" value={`${log.nama_pegawai || "-"} (${log.nip})`} />
            <Info label="Judul"   value={log.judul} span />
            <Info label="Deskripsi" value={log.deskripsi || "-"} span pre />
          </dl>
        )}
      </div>

      {/* Galeri foto */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-slate-800 text-sm">
            Foto Kegiatan ({fotos.length}/{MAX_FOTO})
          </p>
        </div>

        {fotos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
            {fotos.map(f => (
              <div key={f.id} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hwBase ? `${hwBase}/${FOLDER}/${f.url_image}` : ""}
                  alt={f.url_image} className="w-full h-32 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
                <button onClick={() => handleHapusFoto(f.id)} disabled={busy}
                  className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition">
                  ×
                </button>
                <div className="px-2 py-1 text-[10px] text-slate-500 truncate" title={f.url_image}>{f.url_image}</div>
              </div>
            ))}
          </div>
        )}

        {fotos.length < MAX_FOTO && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <KameraCapture onCapture={handleUploadFoto} disabled={busy} />
            <FilePicker onPick={handleUploadFoto} disabled={busy} />
          </div>
        )}
        {fotos.length >= MAX_FOTO && (
          <p className="text-xs text-slate-500 italic text-center py-3">
            Batas maksimal {MAX_FOTO} foto tercapai.
          </p>
        )}
      </div>

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

function FieldRow({ label, children, span = false }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <label className="text-slate-500 block mb-0.5">{label}</label>
      {children}
    </div>
  );
}
function Info({ label, value, span = false, pre = false }: { label: string; value: string; span?: boolean; pre?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-slate-900 ${pre ? "whitespace-pre-wrap" : ""}`}>{value}</dd>
    </div>
  );
}
