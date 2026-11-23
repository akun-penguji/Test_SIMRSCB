"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getMateriEdukasi, simpanMateriEdukasi, hapusMateriEdukasi, cetakMateriEdukasi,
  MateriEdukasiRow, MateriEdukasiTtd,
  getRegistrasiDetail, Registrasi,
  uploadSuratMedia,
} from "@/lib/api";
import { getSession } from "@/lib/auth";
import MicButton from "@/components/MicButton";

type Profesi = "" | "Dokter" | "Perawat/Bidan" | "Apoteker" | "Ahli Gizi" | "Lainnya";

const MATERI_TEMPLATES: Record<Exclude<Profesi, "" | "Lainnya">, string[]> = {
  "Dokter": [
    "Penjelasan tentang hasil pengkajian, diagnosis dan rencana asuhan",
    "Hasil Pemeriksaan",
    "Tindakan medis",
    "Perkiraan hari rawat",
    "Penjelasan Komplikasi yang mungkin terjadi",
    "Hasil pengobatan termasuk hasil pengobatan yang tidak diharapkan",
    "Penjelasan tentang Inform Consent",
    "Penjelasan tentang informasi kemungkinan hasil tidak dapat diantisipasi dari terapi dan perawatan",
  ],
  "Perawat/Bidan": [
    "Hasil pengkajian termasuk masalah keperawatan/kebidanan, diagnose serta rencana asuhan",
    "Hasil Asuhan Perawatan",
    "Asuhan lanjutan di rumah: penanganan & cara perawatan",
    "Perawatan luka",
    "Alat-alat perlu disiapkan di rumah",
    "Persiapan pasien pulang",
    "Penggunaan peralatan medis yang aman (infus, syringe pump, tempat tidur)",
  ],
  "Apoteker": [
    "Nama obat & kegunaannya",
    "Penggunaan obat yang aman",
    "Aturan pemakaian obat & dosis obat",
    "Kontraindikasi obat & efek samping obat",
    "Aturan & cara pemakaian obat high alert",
    "Potensi interaksi obat dengan obat",
    "Potensi interaksi obat dengan makanan",
  ],
  "Ahli Gizi": [
    "Diet dan nutrisi",
    "Konsultasi gizi rawat inap",
    "Konsultasi gizi rawat jalan",
    "Diet selama perawatan",
    "Diet untuk di rumah",
    "Alergi makanan",
  ],
};

function parseMateri(raw: string | null | undefined): { profesi: string; body: string } {
  if (!raw) return { profesi: "", body: "" };
  const m = raw.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
  if (m) return { profesi: m[1].trim(), body: m[2].trim() };
  return { profesi: "", body: raw };
}

interface FormState {
  tanggal: string;          // YYYY-MM-DD
  jam: string;              // HH:MM:SS
  profesi: Profesi;
  materi_checks: boolean[];
  diberikan_pada: "Pasien" | "Keluarga" | "Lain-lain";
  penerima_edukasi: string;
  materi_edukasi: string;   // catatan tambahan (free text)
  kode_leaflet: string;
  lama_edukasi: string;
  hasil_verifikasi: "Sudah Mengerti" | "Re - Edukasi" | "Re - Demonstrasi" | "";
  nip: string;
  nama_petugas: string;
}

function nowDateJam(): { tanggal: string; jam: string } {
  const d = new Date();
  const tanggal = d.toISOString().slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  const jam = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return { tanggal, jam };
}

const initForm = (): FormState => {
  const { tanggal, jam } = nowDateJam();
  return {
    tanggal, jam,
    profesi: "",
    materi_checks: [],
    diberikan_pada: "Pasien",
    penerima_edukasi: "",
    materi_edukasi: "",
    kode_leaflet: "",
    lama_edukasi: "",
    hasil_verifikasi: "",
    nip: "",
    nama_petugas: "",
  };
};

function buildMateriString(profesi: Profesi, checks: boolean[], freeText: string): string {
  const items = (profesi && profesi !== "Lainnya")
    ? (MATERI_TEMPLATES[profesi] || []).filter((_, i) => checks[i])
    : [];
  const checkedJoined = items.join("; ");
  const note = freeText.trim();
  return [checkedJoined, note].filter(Boolean).join(" | ");
}

// ── Kamera capture ──────────────────────────────────────────────────────────
function KameraCapture({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const streamRef = useRef<MediaStream | null>(null);

  async function startCamera() {
    setErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
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
    if (v.readyState < 2 || !v.videoWidth) {
      setErr("Kamera belum siap.");
      return;
    }
    const c = canvasRef.current;
    c.width  = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const url = c.toDataURL("image/jpeg", 0.85);
    setCaptured(url);
    onCapture(url);
    stopCamera();
  }
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <p className="text-xs font-semibold text-slate-700 mb-2">📷 Foto Penerima Edukasi</p>
      {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
      {streaming ? (
        <>
          <video ref={videoRef} className="w-full rounded border" style={{ maxHeight: 220 }} playsInline muted />
          <div className="flex gap-2 mt-2 justify-center">
            <button onClick={takeSnapshot} className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-4 py-1.5 rounded-lg">Ambil Foto</button>
            <button onClick={stopCamera}   className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-4 py-1.5 rounded-lg">Batal</button>
          </div>
        </>
      ) : captured ? (
        <>
          <img src={captured} alt="Foto" className="w-full rounded border" style={{ maxHeight: 220, objectFit: "cover" }} />
          <div className="flex gap-2 mt-2 justify-center">
            <button onClick={() => { setCaptured(null); onCapture(""); startCamera(); }}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-4 py-1.5 rounded-lg">Ulang</button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg h-40 text-slate-400 text-xs cursor-pointer" onClick={startCamera}>
          <svg className="w-8 h-8 mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p>Klik untuk buka kamera</p>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ── Tanda Tangan ────────────────────────────────────────────────────────────
function SignaturePad({ onSave }: { onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    if ("touches" in e) { const t = e.touches[0]; return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy }; }
    const me = e as React.MouseEvent; return { x: (me.clientX - rect.left) * sx, y: (me.clientY - rect.top) * sy };
  }
  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const c = canvasRef.current; if (!c) return;
    setIsDrawing(true); lastPos.current = getPos(e, c);
  }
  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    e.preventDefault();
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const p = getPos(e, c);
    ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath();
    if (lastPos.current) ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    lastPos.current = p; setHasSigned(true);
  }
  function endDraw() { setIsDrawing(false); lastPos.current = null; }
  function clearPad() {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); ctx?.clearRect(0, 0, c.width, c.height);
    setHasSigned(false); onSave("");
  }
  function savePad() {
    const c = canvasRef.current; if (!c) return;
    onSave(c.toDataURL("image/png"));
  }
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <p className="text-xs font-semibold text-slate-700 mb-2">✍️ Tanda Tangan Pasien / Keluarga (Penerima Edukasi)</p>
      <canvas ref={canvasRef} width={400} height={180}
        className="w-full border-2 border-dashed border-blue-300 rounded cursor-crosshair touch-none" style={{ height: 180 }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
      <div className="flex gap-2 mt-2 justify-center">
        <button onClick={clearPad} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-4 py-1.5 rounded-lg">Hapus</button>
        <button onClick={savePad} disabled={!hasSigned}
          className="bg-green-700 hover:bg-green-800 disabled:bg-slate-300 text-white text-xs px-4 py-1.5 rounded-lg">
          Simpan Tanda Tangan
        </button>
      </div>
    </div>
  );
}

export default function MateriEdukasiPage() {
  const params = useParams();
  const router = useRouter();
  const no_rawat = decodeURIComponent(params.no_rawat as string);

  const [pasien, setPasien] = useState<Registrasi | null>(null);
  const [rows, setRows] = useState<MateriEdukasiRow[]>([]);
  const [ttds, setTtds] = useState<MateriEdukasiTtd[]>([]);
  const [f, setF] = useState<FormState>(initForm());
  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [hwBase, setHwBase] = useState("");

  const reload = useCallback(() => {
    getMateriEdukasi(no_rawat).then(r => {
      setRows(r.data.data || []);
      setTtds(r.data.ttd || []);
    }).catch(() => {});
  }, [no_rawat]);

  useEffect(() => {
    const sess = getSession();
    setF(prev => ({ ...prev, nip: sess?.kode || "", nama_petugas: sess?.nama || "" }));
    getRegistrasiDetail(no_rawat).then(r => setPasien(r.data)).catch(() => {});
    reload();
    // Ambil base URL media dari config (best-effort)
    fetch("/api/simrscb/config", { headers: { Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("simrscb_token") : ""}` }})
      .then(r => r.json()).then(c => {
        if (c?.hosthybridweb) {
          const v: string = c.hosthybridweb;
          setHwBase(v.startsWith("http")
            ? v.replace(/\/[^/]+\.php$/, "")
            : `/${v.replace(/^\/+|\/+$/g, "")}`);
        }
      }).catch(() => {});
  }, [no_rawat, reload]);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) => setF(prev => ({ ...prev, [k]: v }));

  const handleSimpan = async () => {
    setErrMsg(""); setOkMsg("");
    const materiString = buildMateriString(f.profesi, f.materi_checks, f.materi_edukasi);
    const anyChecked = f.materi_checks.some(Boolean);
    if (!materiString || (!anyChecked && !f.materi_edukasi.trim())) {
      setErrMsg("Pilih minimal satu materi atau isi catatan materi edukasi");
      return;
    }
    if (!f.penerima_edukasi.trim()) { setErrMsg("Penerima edukasi wajib diisi"); return; }
    if (!f.nip.trim()) { setErrMsg("NIP petugas wajib"); return; }
    setSaving(true);
    try {
      await simpanMateriEdukasi(no_rawat, {
        no_rawat,
        tanggal: f.tanggal, jam: f.jam,
        diberikan_pada: f.diberikan_pada,
        penerima_edukasi: f.penerima_edukasi,
        profesi: f.profesi || undefined,
        materi_edukasi: materiString,
        kode_leaflet: f.kode_leaflet,
        lama_edukasi: f.lama_edukasi,
        hasil_verifikasi: f.hasil_verifikasi || undefined,
        nip: f.nip,
      });
      setSaving(false);
      setOkMsg("Materi edukasi tersimpan");
      setTimeout(() => setOkMsg(""), 4000);
      // reset materi-related fields (profesi tetap dipertahankan utk row berikutnya)
      const { tanggal, jam } = nowDateJam();
      setF(prev => ({
        ...prev, tanggal, jam,
        materi_checks: prev.profesi && prev.profesi !== "Lainnya"
          ? new Array((MATERI_TEMPLATES[prev.profesi as Exclude<Profesi, "" | "Lainnya">] || []).length).fill(false)
          : [],
        materi_edukasi: "",
        kode_leaflet: "",
      }));
      reload();
    } catch (e: unknown) {
      setSaving(false);
      const msg = e instanceof Error ? e.message : "Gagal menyimpan";
      setErrMsg(msg);
    }
  };

  const setProfesi = (p: Profesi) => {
    setF(prev => ({
      ...prev,
      profesi: p,
      materi_checks: p && p !== "Lainnya"
        ? new Array((MATERI_TEMPLATES[p as Exclude<Profesi, "" | "Lainnya">] || []).length).fill(false)
        : [],
    }));
  };
  const toggleMateri = (idx: number) => {
    setF(prev => {
      const next = prev.materi_checks.slice();
      next[idx] = !next[idx];
      return { ...prev, materi_checks: next };
    });
  };

  const handleFoto = async (dataUrl: string) => {
    if (!dataUrl) return;
    try {
      await uploadSuratMedia({ jenis: "edukasi_pasien", no_rawat, foto_base64: dataUrl });
      setOkMsg("Foto tersimpan"); setTimeout(() => setOkMsg(""), 3000);
      reload();
    } catch { setErrMsg("Gagal upload foto"); }
  };
  const handleTtd = async (dataUrl: string) => {
    if (!dataUrl) return;
    try {
      await uploadSuratMedia({ jenis: "edukasi_pasien", no_rawat, ttd_base64: dataUrl });
      setOkMsg("Tanda tangan tersimpan"); setTimeout(() => setOkMsg(""), 3000);
      reload();
    } catch { setErrMsg("Gagal upload TTD"); }
  };

  const handleHapus = async (r: MateriEdukasiRow) => {
    if (!confirm(`Hapus materi tanggal ${r.tanggal} jam ${r.jam}?`)) return;
    try {
      await hapusMateriEdukasi(no_rawat, r.tanggal, r.jam);
      reload();
    } catch { setErrMsg("Gagal hapus"); }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h1 className="flex-1 text-base font-bold text-slate-700">PELAKSANAAN MATERI EDUKASI PASIEN & KELUARGA</h1>
        <button
          onClick={async () => {
            try { await cetakMateriEdukasi(no_rawat); }
            catch { setErrMsg("Gagal membuka pratinjau cetak"); }
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
          Cetak
        </button>
      </div>

      {/* Identitas */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 text-xs">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
          <div className="flex"><span className="w-32 text-slate-500">No. RM</span><span className="text-slate-400">:</span><span className="ml-2 text-slate-900 font-mono">{pasien?.no_rm || "-"}</span></div>
          <div className="flex"><span className="w-32 text-slate-500">No. Rawat</span><span className="text-slate-400">:</span><span className="ml-2 text-slate-900 font-mono">{no_rawat}</span></div>
          <div className="flex col-span-2"><span className="w-32 text-slate-500">Nama</span><span className="text-slate-400">:</span><span className="ml-2 text-slate-900 font-semibold">{pasien?.nm_pasien || "-"}</span></div>
        </div>
      </div>

      {errMsg && <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm">{errMsg}</div>}
      {okMsg  && <div className="mb-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-green-800 text-sm">{okMsg}</div>}

      {/* Form input materi */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-4">
        <p className="font-semibold text-slate-800 mb-3">Tambah / Edit Materi Edukasi</p>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <Field label="Tanggal">
            <input type="date" value={f.tanggal} onChange={(e) => upd("tanggal", e.target.value)} className="inp" />
          </Field>
          <Field label="Jam">
            <input type="time" step={1} value={f.jam.slice(0, 8)} onChange={(e) => upd("jam", e.target.value.length === 5 ? e.target.value + ":00" : e.target.value)} className="inp" />
          </Field>
          <Field label="Diberikan pada">
            <select value={f.diberikan_pada} onChange={(e) => upd("diberikan_pada", e.target.value as FormState["diberikan_pada"])} className="inp">
              <option value="Pasien">Pasien</option>
              <option value="Keluarga">Keluarga</option>
              <option value="Lain-lain">Lain-lain</option>
            </select>
          </Field>
          <Field label="Nama Penerima Edukasi">
            <input value={f.penerima_edukasi} onChange={(e) => upd("penerima_edukasi", e.target.value)} placeholder="Nama lengkap" className="inp" />
          </Field>
          <Field label="Profesi Pemberi Edukasi" span>
            <select value={f.profesi} onChange={(e) => setProfesi(e.target.value as Profesi)} className="inp">
              <option value="">— pilih profesi —</option>
              <option value="Dokter">Dokter</option>
              <option value="Perawat/Bidan">Perawat / Bidan</option>
              <option value="Apoteker">Apoteker</option>
              <option value="Ahli Gizi">Ahli Gizi</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </Field>
          {f.profesi && f.profesi !== "Lainnya" && (
            <div className="col-span-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
              <p className="text-[11px] font-semibold text-slate-700 mb-2">
                Materi edukasi {f.profesi} (centang yang diberikan):
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-3">
                {(MATERI_TEMPLATES[f.profesi as Exclude<Profesi, "" | "Lainnya">] || []).map((item, idx) => (
                  <label key={idx} className="flex items-start gap-2 cursor-pointer text-[11px] text-slate-900 select-none">
                    <input type="checkbox" checked={!!f.materi_checks[idx]} onChange={() => toggleMateri(idx)} className="mt-0.5 accent-green-700" />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <Field label={f.profesi && f.profesi !== "Lainnya" ? "Catatan / Lain-lain (opsional)" : "Materi Edukasi"} span>
            <div className="relative">
              <textarea rows={2} value={f.materi_edukasi} onChange={(e) => upd("materi_edukasi", e.target.value)}
                placeholder={f.profesi && f.profesi !== "Lainnya" ? "Tambahan/spesifik (mis. tindakan medis spesifik, dosis, dll)" : "Judul / topik materi"}
                className="inp pr-8" />
              <MicButton value={f.materi_edukasi} onChange={(v) => upd("materi_edukasi", v)} className="absolute right-1.5 bottom-1.5" />
            </div>
          </Field>
          <Field label="Kode Leaflet">
            <input value={f.kode_leaflet} onChange={(e) => upd("kode_leaflet", e.target.value)} className="inp" />
          </Field>
          <Field label="Lama Edukasi (menit)">
            <input value={f.lama_edukasi} onChange={(e) => upd("lama_edukasi", e.target.value)} className="inp" />
          </Field>
          <Field label="Hasil Verifikasi">
            <select value={f.hasil_verifikasi} onChange={(e) => upd("hasil_verifikasi", e.target.value as FormState["hasil_verifikasi"])} className="inp">
              <option value="">— pilih —</option>
              <option>Sudah Mengerti</option>
              <option>Re - Edukasi</option>
              <option>Re - Demonstrasi</option>
            </select>
          </Field>
          <Field label="Petugas (NIP - Nama)" span>
            <input value={`${f.nip} - ${f.nama_petugas}`} readOnly className="inp opacity-70" />
          </Field>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={handleSimpan} disabled={saving}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:bg-slate-400 text-white text-sm font-medium px-5 py-2.5 rounded-xl">
            {saving ? "Menyimpan..." : "Simpan Materi"}
          </button>
        </div>
      </div>

      {/* Foto + TTD penerima edukasi */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-4 text-xs">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-3 text-slate-600">
          <span>
            <span className="text-slate-500">Pemberi Edukasi (Petugas):</span>{" "}
            <span className="text-slate-900 font-semibold">{f.nama_petugas || "-"}</span>{" "}
            <span className="text-slate-500 font-mono">({f.nip || "-"})</span>
          </span>
          <span className="text-[11px] italic text-slate-400">
            TTD pemberi tercatat otomatis via NIP login
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KameraCapture onCapture={handleFoto} />
          <SignaturePad onSave={handleTtd} />
        </div>
      </div>

      {/* List materi tersimpan */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
        <p className="font-semibold text-slate-800 mb-3">Riwayat Materi Edukasi ({rows.length})</p>
        {rows.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Belum ada materi tersimpan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left p-2 border-b">Tanggal</th>
                  <th className="text-left p-2 border-b">Jam</th>
                  <th className="text-left p-2 border-b">Penerima</th>
                  <th className="text-left p-2 border-b">Profesi</th>
                  <th className="text-left p-2 border-b">Materi</th>
                  <th className="text-left p-2 border-b">Lama</th>
                  <th className="text-left p-2 border-b">Hasil</th>
                  <th className="text-left p-2 border-b">Petugas</th>
                  <th className="p-2 border-b"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  // Pakai kolom profesi baru kalau ada; kalau row lama (NULL), parse dari prefix
                  const parsed = parseMateri(r.materi_edukasi);
                  const profesi = (r.profesi && r.profesi.trim()) || parsed.profesi;
                  const body = r.profesi ? (r.materi_edukasi || "") : parsed.body;
                  return (
                  <tr key={`${r.tanggal}-${r.jam}`} className="hover:bg-slate-50 align-top">
                    <td className="p-2 border-b text-slate-900">{r.tanggal}</td>
                    <td className="p-2 border-b text-slate-900 font-mono">{r.jam}</td>
                    <td className="p-2 border-b text-slate-900">{r.penerima_edukasi}<br/><span className="text-slate-500">{r.diberikan_pada}</span></td>
                    <td className="p-2 border-b text-slate-900">{profesi || <span className="text-slate-400">-</span>}</td>
                    <td className="p-2 border-b text-slate-900">{body || r.materi_edukasi}<br/><span className="text-slate-500">{r.kode_leaflet}</span></td>
                    <td className="p-2 border-b text-slate-700">{r.lama_edukasi || "-"}</td>
                    <td className="p-2 border-b text-slate-700">{r.hasil_verifikasi || "-"}</td>
                    <td className="p-2 border-b text-slate-700">{r.nama_petugas}<br/><span className="text-slate-500 font-mono">{r.nip}</span></td>
                    <td className="p-2 border-b text-right">
                      <button onClick={() => handleHapus(r)} className="text-red-600 hover:underline text-xs">Hapus</button>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TTD/Foto Gallery */}
      {ttds.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mt-4">
          <p className="font-semibold text-slate-800 mb-3">Foto & Tanda Tangan Tersimpan ({ttds.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {ttds.map((t) => (
              <div key={t.url_image} className="border border-slate-200 rounded p-2 text-[10px]">
                {hwBase && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${hwBase}/pelaksanaanedukasi/${t.url_image}`} alt={t.url_image}
                    className="w-full h-24 object-contain bg-slate-50 mb-1"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
                )}
                <div className="text-slate-500">{t.tanggal} {t.jam}</div>
                <div className="text-slate-400 truncate" title={t.url_image}>{t.url_image}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.inp) {
          width: 100%;
          border: 1px solid rgb(226 232 240);
          border-radius: 0.375rem;
          padding: 0.375rem 0.5rem;
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
