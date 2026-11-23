"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getEdukasiPasien, simpanEdukasiPasien, getRegistrasiDetail, getPasienDetail, getSetting, EdukasiPasienData, Registrasi, PasienDetail, SettingRS } from "@/lib/api";
import { getSession } from "@/lib/auth";

type YT = "Ya" | "Tidak";

interface State {
  // header
  tanggal: string;
  nip: string;
  nama_petugas: string;
  // identitas pasien (tampilan saja)
  no_rm: string; nm_pasien: string; tgl_lahir: string; ruangan: string;
  // data
  tinggal_bersama: string;
  hambatan: YT;
  hambatan_pendengaran: YT; hambatan_emosi: YT; hambatan_penglihatan: YT; hambatan_bicara: YT;
  motivasi_kurang: YT; memori_hilang: YT; fisik_lemah: YT; alkoholik: YT;
  tidak_mampu_belajar: YT; perokok: YT;
  edukasi_kepada: string;
  kemampuan_bahasa: string; bahasa_daerah: string; bahasa_asing: string;
  perlu_penerjemah: YT; baca_tulis: "Bisa" | "Tidak";
  // kepercayaan
  kep_status: "Ada" | "Tidak";
  kep_ket: string;   // isi text bebas saat status Ada (PDF: "Ada : ............")
  // kesediaan & cara
  kesediaan_menerima_edukasi: YT;
  cara_edukasi: "Lisan" | "Tulisan";
  // kebutuhan
  keb_partisipasi: YT; keb_penunjang: YT; keb_kondisi: YT; keb_informed_concent: YT;
  keb_diet: YT; keb_obat: YT; keb_alat_medis: YT; keb_nyeri: YT;
  keb_rehabilitasi: YT; keb_cuci_tangan: YT; keb_merokok: YT; keb_rujukan: YT;
  keb_lain_lain: string;
}

const init: State = {
  tanggal: new Date().toISOString().slice(0,16),
  nip: "", nama_petugas: "",
  no_rm: "", nm_pasien: "", tgl_lahir: "", ruangan: "",
  tinggal_bersama: "",
  hambatan: "Tidak",
  hambatan_pendengaran: "Tidak", hambatan_emosi: "Tidak", hambatan_penglihatan: "Tidak", hambatan_bicara: "Tidak",
  motivasi_kurang: "Tidak", memori_hilang: "Tidak", fisik_lemah: "Tidak", alkoholik: "Tidak",
  tidak_mampu_belajar: "Tidak", perokok: "Tidak",
  edukasi_kepada: "",
  kemampuan_bahasa: "Indonesia", bahasa_daerah: "", bahasa_asing: "",
  perlu_penerjemah: "Tidak", baca_tulis: "Bisa",
  kep_status: "Tidak",
  kep_ket: "",
  kesediaan_menerima_edukasi: "Ya",
  cara_edukasi: "Lisan",
  keb_partisipasi: "Tidak", keb_penunjang: "Tidak", keb_kondisi: "Tidak", keb_informed_concent: "Tidak",
  keb_diet: "Tidak", keb_obat: "Tidak", keb_alat_medis: "Tidak", keb_nyeri: "Tidak",
  keb_rehabilitasi: "Tidak", keb_cuci_tangan: "Tidak", keb_merokok: "Tidak", keb_rujukan: "Tidak",
  keb_lain_lain: "",
};

function Chk({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-900 select-none">
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5 accent-green-700" />
      <span>{label}</span>
    </label>
  );
}

function Inp({ value, onChange, placeholder = "", className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className={`border-b border-slate-300 bg-transparent text-sm py-0.5 text-slate-900 focus:outline-none focus:border-green-600 ${className}`} />
  );
}

export default function EdukasiPage() {
  const params = useParams();
  const router = useRouter();
  const no_rawat = decodeURIComponent(params.no_rawat as string);
  const [f, setF] = useState<State>({ ...init });
  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [setting, setSetting] = useState<SettingRS | null>(null);

  const upd = useCallback(<K extends keyof State>(k: K, v: State[K]) => {
    setF(prev => ({ ...prev, [k]: v }));
  }, []);

  const toggleYT = useCallback((k: keyof State) => {
    setF(prev => ({ ...prev, [k]: (prev[k] === "Ya" ? "Tidak" : "Ya") as never }));
  }, []);

  // Prefill
  useEffect(() => {
    const sess = getSession();
    setF(prev => ({
      ...prev,
      nip:          sess?.kode || "",
      nama_petugas: sess?.nama || "",
    }));

    getSetting().then(r => setSetting(r.data)).catch(() => {});

    Promise.all([
      getRegistrasiDetail(no_rawat).catch(() => null),
      getEdukasiPasien(no_rawat).catch(() => null),
    ]).then(([reg, edu]) => {
      const r: Registrasi | null = reg?.data ?? null;
      const d: EdukasiPasienData | null | undefined = edu?.data?.data;

      setF(prev => ({
        ...prev,
        no_rm:       r?.no_rm || prev.no_rm,
        nm_pasien:   r?.nm_pasien    || prev.nm_pasien,
        ruangan:     r?.nm_poli      || prev.ruangan,
        ...(d ? loadFromData(d) : {}),
      }));

      if (r?.no_rm) {
        getPasienDetail(r.no_rm).then(rp => {
          const pas: PasienDetail | null = rp?.data ?? null;
          if (pas?.tgl_lahir) setF(prev => ({ ...prev, tgl_lahir: pas.tgl_lahir! }));
        }).catch(() => {});
      }
    });
  }, [no_rawat]);

  const handleSimpan = async () => {
    setErrMsg(""); setOkMsg("");
    if (!f.nip.trim()) {
      setErrMsg("NIP Petugas wajib (cek session login)");
      return;
    }
    setSaving(true);
    try {
      const r = await simpanEdukasiPasien({
        no_rawat,
        tanggal: f.tanggal,
        nip: f.nip,
        tinggal_bersama: f.tinggal_bersama,
        hambatan: f.hambatan,
        hambatan_pendengaran: f.hambatan_pendengaran,
        hambatan_emosi: f.hambatan_emosi,
        hambatan_penglihatan: f.hambatan_penglihatan,
        hambatan_bicara: f.hambatan_bicara,
        motivasi_kurang: f.motivasi_kurang,
        memori_hilang: f.memori_hilang,
        fisik_lemah: f.fisik_lemah,
        alkoholik: f.alkoholik,
        tidak_mampu_belajar: f.tidak_mampu_belajar,
        perokok: f.perokok,
        edukasi_kepada: f.edukasi_kepada,
        kemampuan_bahasa: f.kemampuan_bahasa,
        bahasa_daerah: f.bahasa_daerah,
        bahasa_asing: f.bahasa_asing,
        perlu_penerjemah: f.perlu_penerjemah,
        baca_tulis: f.baca_tulis,
        kepercayaan_lainnya: f.kep_status === "Ada" ? f.kep_ket : "",
        kesediaan_menerima_edukasi: f.kesediaan_menerima_edukasi,
        cara_edukasi: f.cara_edukasi,
        keb_partisipasi: f.keb_partisipasi,
        keb_penunjang: f.keb_penunjang,
        keb_kondisi: f.keb_kondisi,
        keb_informed_concent: f.keb_informed_concent,
        keb_diet: f.keb_diet,
        keb_obat: f.keb_obat,
        keb_alat_medis: f.keb_alat_medis,
        keb_nyeri: f.keb_nyeri,
        keb_rehabilitasi: f.keb_rehabilitasi,
        keb_cuci_tangan: f.keb_cuci_tangan,
        keb_merokok: f.keb_merokok,
        keb_lain_lain: f.keb_lain_lain,
        keb_rujukan: f.keb_rujukan,
      });
      setSaving(false);
      if (r.data?.success) {
        setOkMsg("Formulir edukasi tersimpan");
        setTimeout(() => setOkMsg(""), 5000);
      }
    } catch (e: unknown) {
      setSaving(false);
      const ax = e as { response?: { data?: { error?: string } } };
      const msg = ax.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal menyimpan");
      setErrMsg(msg);
    }
  };

  const namaRS  = setting?.nama_instansi || "Rumah Sakit";
  const kabRS   = setting?.kabupaten ? `PEMERINTAH ${setting.kabupaten.toUpperCase().replace(/\bKAB\.?\b/g, "KABUPATEN")}` : "";
  const alamatRS = [
    setting?.alamat_instansi,
    setting?.kontak ? `Telp. ${setting.kontak}` : undefined,
    setting?.email  ? `Email: ${setting.email}` : undefined,
  ].filter(Boolean).join(" — ") || "";

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-4 no-print">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h1 className="flex-1 text-base font-bold text-slate-700">FORMULIR EDUKASI PADA PASIEN DAN KELUARGA TERINTEGRASI</h1>
      </div>

      {errMsg && <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm">{errMsg}</div>}
      {okMsg  && <div className="mb-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-green-800 text-sm">{okMsg}</div>}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-5 print:shadow-none print:border-0 print:rounded-none">
        {/* Kop Surat */}
        <div className="border-b-2 border-slate-800 pb-3 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-daerah.png" alt="Logo Daerah"
            className="h-16 w-16 aspect-square object-contain shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div className="flex-1 text-center leading-tight">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-800">{kabRS}</p>
            <p className="text-lg font-extrabold uppercase text-slate-900">{namaRS}</p>
            <p className="text-[11px] text-slate-700">{alamatRS}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-rs.png" alt="Logo RS"
            className="h-16 w-16 aspect-square object-contain shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>

        {/* Judul + kode form */}
        <div className="flex items-stretch border border-slate-300 -mt-2">
          <div className="flex-1 flex items-center justify-center px-4 py-2 border-r border-slate-300">
            <p className="font-bold uppercase text-slate-800 text-sm text-center">Formulir Edukasi pada Pasien dan Keluarga Terintegrasi</p>
          </div>
          <div className="w-48 flex items-center justify-center px-3 py-2 text-xs text-slate-700">
            RM.ADM.05.001.A.2019
          </div>
        </div>

        {/* Identitas */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
          <div className="flex"><span className="w-32 text-slate-500">No. RM</span><span className="text-slate-400">:</span><span className="ml-2 text-slate-900 font-mono">{f.no_rm || "-"}</span></div>
          <div className="flex"><span className="w-32 text-slate-500">No. Rawat</span><span className="text-slate-400">:</span><span className="ml-2 text-slate-900 font-mono">{no_rawat}</span></div>
          <div className="flex col-span-2"><span className="w-32 text-slate-500">Nama</span><span className="text-slate-400">:</span><span className="ml-2 text-slate-900 font-semibold">{f.nm_pasien || "-"}</span></div>
          <div className="flex"><span className="w-32 text-slate-500">Tanggal Lahir</span><span className="text-slate-400">:</span><span className="ml-2 text-slate-900">{f.tgl_lahir || "-"}</span></div>
          <div className="flex"><span className="w-32 text-slate-500">Ruangan</span><span className="text-slate-400">:</span><span className="ml-2 text-slate-900">{f.ruangan || "-"}</span></div>
          <div className="flex"><span className="w-32 text-slate-500">Tanggal</span><span className="text-slate-400">:</span>
            <input type="datetime-local" value={f.tanggal} onChange={(e) => upd("tanggal", e.target.value)}
              className="ml-2 border-b border-slate-300 bg-transparent text-sm py-0.5 text-slate-900 focus:outline-none focus:border-green-600" />
          </div>
          <div className="flex"><span className="w-32 text-slate-500">Petugas</span><span className="text-slate-400">:</span><span className="ml-2 text-slate-900">{f.nama_petugas} ({f.nip})</span></div>
        </div>

        <hr/>

        <div className="bg-slate-100 border-l-4 border-blue-700 px-3 py-2">
          <p className="font-semibold text-slate-800">A. ASSESMEN KEBUTUHAN EDUKASI</p>
        </div>

        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-600 border-b border-slate-200 pb-1 -mb-2">
          Data Pasien
        </div>

        {/* Tinggal Bersama */}
        <div className="grid grid-cols-[180px_1fr] gap-x-4 gap-y-2 text-xs">
          <div className="text-slate-700 pt-1">Tinggal Bersama :</div>
          <div className="flex flex-wrap gap-4">
            {["Anak","Orang Tua","Sendiri","Suami/Istri"].map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer text-slate-900">
                <input type="radio" name="tinggal" value={opt}
                  checked={f.tinggal_bersama === opt}
                  onChange={() => upd("tinggal_bersama", opt)}
                  className="accent-green-700" />
                <span>{opt}</span>
              </label>
            ))}
          </div>

          {/* Hambatan */}
          <div className="text-slate-700 pt-1">Hambatan :</div>
          <div className="flex flex-wrap gap-4">
            {(["Ada","Tidak"] as const).map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer text-slate-900">
                <input type="radio" name="hambatan" value={opt}
                  checked={f.hambatan === opt}
                  onChange={() => upd("hambatan", opt as YT)}
                  className="accent-green-700" />
                <span>{opt}</span>
              </label>
            ))}
          </div>

          <div className="text-slate-500 pt-1 col-span-2 text-[11px] italic">(Jika Ada, pilih satu atau lebih:)</div>
          <div className="col-span-2 grid grid-cols-2 md:grid-cols-4 gap-y-1 gap-x-3 pl-2">
            <Chk checked={f.hambatan_pendengaran === "Ya"} onToggle={() => toggleYT("hambatan_pendengaran")} label="Gangguan Pendengaran" />
            <Chk checked={f.hambatan_emosi === "Ya"}        onToggle={() => toggleYT("hambatan_emosi")}        label="Gangguan Emosi" />
            <Chk checked={f.hambatan_penglihatan === "Ya"}  onToggle={() => toggleYT("hambatan_penglihatan")}  label="Gangguan Penglihatan" />
            <Chk checked={f.hambatan_bicara === "Ya"}       onToggle={() => toggleYT("hambatan_bicara")}       label="Gangguan Bicara" />
            <Chk checked={f.motivasi_kurang === "Ya"}       onToggle={() => toggleYT("motivasi_kurang")}       label="Motivasi kurang/buruk" />
            <Chk checked={f.memori_hilang === "Ya"}         onToggle={() => toggleYT("memori_hilang")}         label="Memori hilang" />
            <Chk checked={f.fisik_lemah === "Ya"}           onToggle={() => toggleYT("fisik_lemah")}           label="Fisik Lemah" />
            <Chk checked={f.alkoholik === "Ya"}             onToggle={() => toggleYT("alkoholik")}             label="Alkoholik" />
            <Chk checked={f.tidak_mampu_belajar === "Ya"}   onToggle={() => toggleYT("tidak_mampu_belajar")}   label="Secara fisiologis tidak mampu belajar" />
            <Chk checked={f.perokok === "Ya"}               onToggle={() => toggleYT("perokok")}               label="Perokok aktif/pasif *)" />
          </div>

          {/* Edukasi kepada */}
          <div className="text-slate-700 pt-1">Edukasi diberikan kepada :</div>
          <div className="flex flex-wrap gap-4">
            {["Pasien","Orang Tua (Ayah/Ibu) **)","Keluarga (Suami/Istri/Kakak/Adik) **)"].map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer text-slate-900">
                <input type="radio" name="ed_kepada" value={opt}
                  checked={f.edukasi_kepada === opt}
                  onChange={() => upd("edukasi_kepada", opt)}
                  className="accent-green-700" />
                <span>{opt}</span>
              </label>
            ))}
          </div>

          {/* Bahasa */}
          <div className="text-slate-700 pt-1">Kemampuan Bahasa :</div>
          <div className="flex flex-wrap gap-4 items-center">
            {["Indonesia","Daerah","Asing"].map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer text-slate-900">
                <input type="radio" name="bahasa" value={opt}
                  checked={f.kemampuan_bahasa === opt}
                  onChange={() => upd("kemampuan_bahasa", opt)}
                  className="accent-green-700" />
                <span>{opt}</span>
              </label>
            ))}
            <Inp value={f.bahasa_daerah} onChange={(v) => upd("bahasa_daerah", v)} placeholder="bahasa daerah" className="w-28" />
            <Inp value={f.bahasa_asing}  onChange={(v) => upd("bahasa_asing",  v)} placeholder="bahasa asing"  className="w-28" />
          </div>

          {/* Penerjemah & Baca Tulis */}
          <div className="text-slate-700 pt-1">Perlu Penerjemah :</div>
          <div className="flex flex-wrap gap-4">
            {(["Ya","Tidak"] as const).map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer text-slate-900">
                <input type="radio" name="penerjemah" value={opt}
                  checked={f.perlu_penerjemah === opt}
                  onChange={() => upd("perlu_penerjemah", opt as YT)}
                  className="accent-green-700" />
                <span>{opt}</span>
              </label>
            ))}
          </div>

          <div className="text-slate-700 pt-1">Baca & Tulis :</div>
          <div className="flex flex-wrap gap-4">
            {(["Bisa","Tidak"] as const).map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer text-slate-900">
                <input type="radio" name="bacatulis" value={opt}
                  checked={f.baca_tulis === opt}
                  onChange={() => upd("baca_tulis", opt)}
                  className="accent-green-700" />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Kepercayaan Lainnya */}
        <div className="grid grid-cols-[180px_1fr] gap-x-4 gap-y-2 text-xs">
          <div className="text-slate-700 pt-1">Kepercayaan Lainnya :</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {(["Ada","Tidak"] as const).map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer text-slate-900">
                <input type="radio" name="kep_status" value={opt}
                  checked={f.kep_status === opt}
                  onChange={() => upd("kep_status", opt)}
                  className="accent-green-700" />
                <span>{opt}</span>
              </label>
            ))}
            {f.kep_status === "Ada" && (
              <Inp value={f.kep_ket} onChange={(v) => upd("kep_ket", v)} placeholder="sebutkan..." className="flex-1 min-w-[200px]" />
            )}
          </div>
        </div>

        {/* Kesediaan & Cara */}
        <div className="grid grid-cols-[180px_1fr] gap-x-4 gap-y-2 text-xs">
          <div className="text-slate-700 pt-1">Kesediaan Menerima Edukasi :</div>
          <div className="flex flex-wrap gap-4">
            {(["Ya","Tidak"] as const).map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer text-slate-900">
                <input type="radio" name="kesediaan" value={opt}
                  checked={f.kesediaan_menerima_edukasi === opt}
                  onChange={() => upd("kesediaan_menerima_edukasi", opt as YT)}
                  className="accent-green-700" />
                <span>{opt}</span>
              </label>
            ))}
          </div>

          <div className="text-slate-700 pt-1">Cara Edukasi :</div>
          <div className="flex flex-wrap gap-4">
            {(["Lisan","Tulisan"] as const).map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer text-slate-900">
                <input type="radio" name="cara" value={opt}
                  checked={f.cara_edukasi === opt}
                  onChange={() => upd("cara_edukasi", opt)}
                  className="accent-green-700" />
                <span>{opt}</span>
              </label>
            ))}
          </div>

          {/* Kebutuhan */}
          <div className="text-slate-700 pt-1">Kebutuhan Edukasi :</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-3 text-xs">
            <Chk checked={f.keb_partisipasi === "Ya"}     onToggle={() => toggleYT("keb_partisipasi")}     label="Hak Untuk Berpartisipasi Pada Proses Pelayanan" />
            <Chk checked={f.keb_penunjang === "Ya"}       onToggle={() => toggleYT("keb_penunjang")}       label="Proses Pemeriksaan Penunjang" />
            <Chk checked={f.keb_kondisi === "Ya"}         onToggle={() => toggleYT("keb_kondisi")}         label="Kondisi Kesehatan, Diagnosis Pasti dan Penatalaksanaannya" />
            <Chk checked={f.keb_informed_concent === "Ya"} onToggle={() => toggleYT("keb_informed_concent")} label="Proses Pemberian Informed Concent" />
            <Chk checked={f.keb_diet === "Ya"}            onToggle={() => toggleYT("keb_diet")}            label="Diet dan Nutrisi" />
            <Chk checked={f.keb_obat === "Ya"}            onToggle={() => toggleYT("keb_obat")}            label="Penggunaan Obat Secara Efektif dan Aman, Efek Samping Serta Interaksinya" />
            <Chk checked={f.keb_alat_medis === "Ya"}      onToggle={() => toggleYT("keb_alat_medis")}      label="Penggunaan Alat Medis yang aman" />
            <Chk checked={f.keb_nyeri === "Ya"}           onToggle={() => toggleYT("keb_nyeri")}           label="Manajemen Nyeri" />
            <Chk checked={f.keb_rehabilitasi === "Ya"}    onToggle={() => toggleYT("keb_rehabilitasi")}    label="Teknik Rehabilitasi" />
            <Chk checked={f.keb_cuci_tangan === "Ya"}     onToggle={() => toggleYT("keb_cuci_tangan")}     label="Cuci Tangan Yang Benar" />
            <Chk checked={f.keb_merokok === "Ya"}         onToggle={() => toggleYT("keb_merokok")}         label="Bahaya Merokok" />
            <Chk checked={f.keb_rujukan === "Ya"}         onToggle={() => toggleYT("keb_rujukan")}         label="Rujukan Edukasi" />
            <div className="flex items-center gap-2 col-span-full">
              <span className="text-slate-900">Lain-lain :</span>
              <Inp value={f.keb_lain_lain} onChange={(v) => upd("keb_lain_lain", v)} className="flex-1" />
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 pt-2 border-t">
          *) Coret yang tidak perlu &nbsp;&nbsp; **) Lingkari yang dipilih
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-3">
        <button
          onClick={() => router.push(`/edukasi/${encodeURIComponent(no_rawat)}/materi`)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          Lanjut ke Materi Edukasi
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        </button>
        <button
          onClick={handleSimpan} disabled={saving}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:bg-slate-400
                     disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5
                     rounded-xl shadow-sm transition-colors"
        >
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}

function loadFromData(d: EdukasiPasienData): Partial<State> {
  return {
    tanggal: d.tanggal || new Date().toISOString().slice(0,16),
    tinggal_bersama: d.tinggal_bersama ?? "",
    hambatan:                (d.hambatan ?? "Tidak") as YT,
    hambatan_pendengaran:    (d.hambatan_pendengaran ?? "Tidak") as YT,
    hambatan_emosi:          (d.hambatan_emosi ?? "Tidak") as YT,
    hambatan_penglihatan:    (d.hambatan_penglihatan ?? "Tidak") as YT,
    hambatan_bicara:         (d.hambatan_bicara ?? "Tidak") as YT,
    motivasi_kurang:         (d.motivasi_kurang ?? "Tidak") as YT,
    memori_hilang:           (d.memori_hilang ?? "Tidak") as YT,
    fisik_lemah:             (d.fisik_lemah ?? "Tidak") as YT,
    alkoholik:               (d.alkoholik ?? "Tidak") as YT,
    tidak_mampu_belajar:     (d.tidak_mampu_belajar ?? "Tidak") as YT,
    perokok:                 (d.perokok ?? "Tidak") as YT,
    edukasi_kepada:          d.edukasi_kepada ?? "",
    kemampuan_bahasa:        d.kemampuan_bahasa ?? "Indonesia",
    bahasa_daerah:           d.bahasa_daerah ?? "",
    bahasa_asing:            d.bahasa_asing ?? "",
    perlu_penerjemah:        (d.perlu_penerjemah ?? "Tidak") as YT,
    baca_tulis:              (d.baca_tulis ?? "Bisa") as "Bisa" | "Tidak",
    kep_status: (() => {
      // Backward compat: kalau kepercayaan_lainnya = "Tidak" / "" → Tidak.
      //                  selain itu (text bebas) → Ada
      const v = d.kepercayaan_lainnya?.trim();
      return v && v.toLowerCase() !== "tidak" ? "Ada" : "Tidak";
    })(),
    kep_ket: (() => {
      const v = d.kepercayaan_lainnya?.trim();
      return v && v.toLowerCase() !== "tidak" ? v : "";
    })(),
    kesediaan_menerima_edukasi: (d.kesediaan_menerima_edukasi ?? "Ya") as YT,
    cara_edukasi:            (d.cara_edukasi ?? "Lisan") as "Lisan" | "Tulisan",
    keb_partisipasi:         (d.keb_partisipasi ?? "Tidak") as YT,
    keb_penunjang:           (d.keb_penunjang ?? "Tidak") as YT,
    keb_kondisi:             (d.keb_kondisi ?? "Tidak") as YT,
    keb_informed_concent:    (d.keb_informed_concent ?? "Tidak") as YT,
    keb_diet:                (d.keb_diet ?? "Tidak") as YT,
    keb_obat:                (d.keb_obat ?? "Tidak") as YT,
    keb_alat_medis:          (d.keb_alat_medis ?? "Tidak") as YT,
    keb_nyeri:               (d.keb_nyeri ?? "Tidak") as YT,
    keb_rehabilitasi:        (d.keb_rehabilitasi ?? "Tidak") as YT,
    keb_cuci_tangan:         (d.keb_cuci_tangan ?? "Tidak") as YT,
    keb_merokok:             (d.keb_merokok ?? "Tidak") as YT,
    keb_rujukan:             (d.keb_rujukan ?? "Tidak") as YT,
    keb_lain_lain:           d.keb_lain_lain ?? "",
  };
}
