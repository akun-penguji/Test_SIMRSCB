"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { getRegistrasiDetail, getPasienDetail, getSetting, SettingRS, Registrasi, PasienDetail, uploadSuratMedia, getPersetujuanSatusehat, simpanPersetujuanSatusehat, getPersetujuanUmum, simpanPersetujuanUmum, cetakPersetujuanUmum, getPenjabList, getPernyataanJaminan, simpanPernyataanJaminan, cetakPernyataanJaminan, getHakKewajiban, simpanHakKewajiban, cetakHakKewajiban, getSuratPernyataan, simpanSuratPernyataan } from "@/lib/api";
import { hasPerm, getSession } from "@/lib/auth";
import { QRCodeSVG } from "qrcode.react";
import MicButton from "@/components/MicButton";

// ── Konfigurasi judul per jenis surat ──────────────────────────────────────
const JUDUL: Record<string, string> = {
  persetujuan_umum:       "PERSETUJUAN UMUM (GENERAL CONSENT)",
  hak_kewajiban:          "HAK DAN KEWAJIBAN PASIEN",
  masuk_unit:             "FORMULIR PERNYATAAN MASUK UNIT",
  jaminan_pasien:         "SURAT PERNYATAAN JAMINAN PASIEN",
  jaminan_umum:           "SURAT PERNYATAAN PASIEN UMUM",
  titip_kelas:            "SURAT PERNYATAAN TITIP KELAS",
  jamkesda:               "SURAT PERNYATAAN PERSYARATAN JAMKESDA",
  bersedia_igd:           "SURAT PERNYATAAN BERSEDIA DI IGD",
  persetujuan_penolakan:  "SURAT PERSETUJUAN / PENOLAKAN TINDAKAN KEDOKTERAN",
  pulang_aps:             "SURAT PULANG ATAS PERMINTAAN SENDIRI (APS)",
};

function hitungUmur(tgl?: string): string {
  if (!tgl) return "";
  const diff = Date.now() - new Date(tgl).getTime();
  return String(Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)));
}

function todayFmt(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
}

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

function fmtTgl(tgl?: string): string {
  if (!tgl) return "";
  const p = tgl.split("-");
  if (p.length !== 3) return tgl;
  const bln = ["","Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember"];
  return `${p[2]} ${bln[Number(p[1])]} ${p[0]}`;
}

const HUB_OPTIONS = ["Pasien Sendiri","Diri Sendiri","Suami","Istri","Ayah","Ibu","Anak","Saudara","Teman","Lainnya"];
const JK_OPTIONS  = ["Laki-laki","Perempuan"];
const BERTINDAK_OPTIONS = ["Pasien Sendiri","Suami/Istri","Orang Tua","Anak","Saudara","Kerabat","Wali"];

// Jenis surat yang memakai simpan GENERIK (JSON) + cetak via window.print.
// (persetujuan_umum, jaminan_pasien, hak_kewajiban punya simpan+cetak sendiri.)
const GENERIC_JENIS = new Set([
  "masuk_unit", "jaminan_umum", "titip_kelas", "jamkesda",
  "bersedia_igd", "persetujuan_penolakan", "pulang_aps",
]);

// ── Helper Input ─────────────────────────────────────────────────────────────
function Row({ label, children, span = false }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={`flex gap-2 items-start ${span ? "col-span-2" : ""}`}>
      <span className="text-xs text-slate-500 w-44 shrink-0 pt-2">{label}</span>
      <span className="text-xs text-slate-400 pt-2">:</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Inp({ value, onChange, placeholder = "", type = "text", className = "" }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; className?: string;
}) {
  const mic = type === "text"; // mic hanya untuk textbox teks (bukan tanggal/angka)
  return (
    <div className="relative flex items-center">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border-b border-slate-300 bg-transparent text-sm py-1 px-0 text-slate-900
                    focus:outline-none focus:border-green-600 placeholder:text-slate-300 ${mic ? "pr-7" : ""} ${className}`}
      />
      {mic && <MicButton value={value} onChange={onChange} className="absolute right-0 top-1/2 -translate-y-1/2" />}
    </div>
  );
}

function Sel({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border-b border-slate-300 bg-transparent text-sm py-1 text-slate-900 focus:outline-none focus:border-green-600"
    >
      <option value="">-- Pilih --</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Txta({ value, onChange, rows = 2, placeholder = "" }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded bg-white text-sm p-1.5 pr-8 resize-none text-slate-900
                   focus:outline-none focus:ring-1 focus:ring-green-500 placeholder:text-slate-300"
      />
      <MicButton value={value} onChange={onChange} className="absolute right-1.5 bottom-1.5" />
    </div>
  );
}

// ── Checklist Ya/Tidak (Nilai & Keyakinan, Permintaan Privasi) ───────────────
type ChkDef = { k: string; label: string; detail?: boolean };
const NILAI_ITEMS: ChkDef[] = [
  { k: "pulang_hari", label: "Pasien tidak mau pulang hari Sabtu, atau hari tertentu", detail: true },
  { k: "vegetarian", label: "Pasien vegetarian", detail: true },
  { k: "makanan_tertentu", label: "Pasien tidak bisa makan makanan tertentu", detail: true },
  { k: "tolak_transfusi", label: "Pasien menolak dilakukan transfusi darah", detail: true },
  { k: "tolak_babi", label: "Pasien menolak obat dengan kecurigaan mengandung unsur babi" },
  { k: "bayi_no_imunisasi", label: "Kepada bayi baru lahir tidak dilakukan imunisasi", detail: true },
  { k: "tolak_asuhan_gender", label: "Pasien menolak dilakukan asuhan oleh laki-laki/perempuan", detail: true },
  { k: "tolak_tindakan_hari", label: "Pasien menolak dilakukan tindakan pada hari tertentu", detail: true },
  { k: "tolak_kamar_angka", label: "Pasien menolak dirawat dalam kamar dengan angka", detail: true },
  { k: "ibu_pasca_menolak", label: "Ibu pasca melahirkan menolak untuk", detail: true },
  { k: "meninggal_ditinggal", label: "Bila pasien meninggal, akan ditinggal di rumah sakit" },
  { k: "pelayanan_nyeri", label: "Terkait dengan pelayanan nyeri", detail: true },
  { k: "lain_lain", label: "Lain-lain", detail: true },
];
const PRIVASI_ITEMS: ChkDef[] = [
  { k: "tidak_diketahui", label: "Pasien tidak mau diketahui keberadaannya di rumah sakit" },
  { k: "tidak_dikunjungi", label: "Pasien tidak mau dikunjungi" },
  { k: "tidak_izin_penjelasan", label: "Pasien tidak mengijinkan penjelasan kondisi kesehatannya kepada keluarga/orang lain tanpa ijin" },
  { k: "hanya_izin_kepada", label: "Pasien hanya mengijinkan penjelasan kondisi kesehatannya kepada (sebutkan nama & hubungan)", detail: true },
];
type ChkVal = { k: string; label: string; ya: boolean; d: string };
function parseChk(json: string, defs: ChkDef[]): ChkVal[] {
  let saved: { k?: string; ya?: boolean; d?: string }[] = [];
  try { saved = JSON.parse(json || "[]"); } catch { /* ignore */ }
  return defs.map((def) => {
    const s = saved.find((x) => x.k === def.k);
    return { k: def.k, label: def.label, ya: !!s?.ya, d: s?.d ?? "" };
  });
}
function Checklist({ defs, value, onChange }: { defs: ChkDef[]; value: string; onChange: (json: string) => void }) {
  const items = parseChk(value, defs);
  const update = (k: string, patch: Partial<ChkVal>) => {
    const next = items.map((it) => (it.k === k ? { ...it, ...patch } : it));
    onChange(JSON.stringify(next.map(({ k, label, ya, d }) => ({ k, label, ya, d }))));
  };
  const defMap = Object.fromEntries(defs.map((d) => [d.k, d]));
  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5">
      {items.map((it) => (
        <div key={it.k} className="flex items-start gap-2">
          <div className="flex gap-1 shrink-0 pt-0.5">
            <button type="button" onClick={() => update(it.k, { ya: true })}
              className={`text-[11px] px-2 py-0.5 rounded border ${it.ya ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-500 border-slate-300"}`}>Ya</button>
            <button type="button" onClick={() => update(it.k, { ya: false })}
              className={`text-[11px] px-2 py-0.5 rounded border ${!it.ya ? "bg-slate-600 text-white border-slate-600" : "bg-white text-slate-500 border-slate-300"}`}>Tidak</button>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-slate-700">{it.label}</span>
            {defMap[it.k]?.detail && it.ya && (
              <Inp value={it.d} onChange={(v) => update(it.k, { d: v })} placeholder="keterangan" className="mt-1" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Komponen tanda tangan ────────────────────────────────────────────────────
function TandaTangan({ label, nama = "" }: { label: string; nama?: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-slate-600 mb-1">{label}</p>
      <div className="border border-dashed border-slate-300 rounded h-16 w-32 mx-auto mb-1" />
      <div className="border-b border-slate-400 w-32 mx-auto" />
      <p className="text-xs text-slate-600 mt-0.5">{nama || "( .......................... )"}</p>
    </div>
  );
}

// ── Komponen TTD versi QR code (untuk Petugas RS) ────────────────────────────
function TandaTanganQR({
  label, nip = "", nama = "", tanggal = "",
}: { label: string; nip?: string; nama?: string; tanggal?: string }) {
  const payload = nip || nama
    ? `NIP:${nip || "-"}|Nama:${nama || "-"}|Tgl:${tanggal || todayIso()}`
    : "";
  return (
    <div className="text-center">
      <p className="text-xs text-slate-600 mb-1">{label}</p>
      <div className="h-16 w-32 mx-auto mb-1 flex items-center justify-center">
        {payload
          ? <QRCodeSVG value={payload} size={64} level="M" includeMargin={false} />
          : <div className="border border-dashed border-slate-300 rounded h-16 w-16" />}
      </div>
      <div className="border-b border-slate-400 w-32 mx-auto" />
      <p className="text-xs text-slate-600 mt-0.5">{nama || "( .......................... )"}</p>
      {nip && <p className="text-[10px] text-slate-500">NIP. {nip}</p>}
    </div>
  );
}

// ── Bagian identitas pasien (shared) ─────────────────────────────────────────
function SeksiPasien({ f, s, showJam = false }: { f: FormState; s: (k: keyof FormState, v: string) => void; showJam?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-4">
      <Row label="No. Pernyataan">
        <Inp value={f.no_surat} onChange={(v) => s("no_surat", v)} placeholder="Otomatis" />
      </Row>
      <Row label="Tanggal">
        <Inp value={f.tanggal} onChange={(v) => s("tanggal", v)} type="date" />
      </Row>
      {showJam && (
        <Row label="Jam TTD Pasien">
          <Inp value={f.jam} onChange={(v) => s("jam", v)} type="time" />
        </Row>
      )}
      <Row label="No. Rekam Medis">
        <span className="text-sm font-mono text-slate-900">{f.no_rm}</span>
      </Row>
      <Row label="No. Rawat">
        <span className="text-sm font-mono text-slate-900">{f.no_rawat}</span>
      </Row>
      <Row label="Nama Pasien" span>
        <span className="text-sm font-semibold text-slate-900">{f.nm_pasien}</span>
      </Row>
      <Row label="Tanggal Lahir">
        <span className="text-sm text-slate-900">{fmtTgl(f.tgl_lahir)}</span>
      </Row>
      <Row label="Umur">
        <span className="text-sm text-slate-900">{f.umur} tahun</span>
      </Row>
      <Row label="Jenis Kelamin">
        <span className="text-sm text-slate-900">{f.jk === "L" ? "Laki-laki" : f.jk === "P" ? "Perempuan" : "-"}</span>
      </Row>
    </div>
  );
}

// ── Bagian penanggung jawab (shared) ─────────────────────────────────────────
function SeksiPJ({ f, s }: { f: FormState; s: (k: keyof FormState, v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-4">
      <Row label="Yang bertindak atas" span>
        <Sel value={f.bertindak_atas} onChange={(v) => s("bertindak_atas", v)} options={BERTINDAK_OPTIONS} />
      </Row>
      <Row label="Nama Penanggung Jawab" span>
        <Inp value={f.nama_pj} onChange={(v) => s("nama_pj", v)} />
      </Row>
      <Row label="Hubungan dengan Pasien">
        <Sel value={f.hub_pj} onChange={(v) => s("hub_pj", v)} options={HUB_OPTIONS} />
      </Row>
      <Row label="Jenis Kelamin PJ">
        <Sel value={f.jk_pj} onChange={(v) => s("jk_pj", v)} options={JK_OPTIONS} />
      </Row>
      <Row label="Tempat Lahir PJ">
        <Inp value={f.tmp_lahir_pj} onChange={(v) => s("tmp_lahir_pj", v)} />
      </Row>
      <Row label="Umur PJ">
        <Inp value={f.umur_pj} onChange={(v) => s("umur_pj", v)} placeholder="tahun" />
      </Row>
      <Row label="No. KTP PJ">
        <Inp value={f.no_ktp_pj} onChange={(v) => s("no_ktp_pj", v)} />
      </Row>
      <Row label="No. Telp/HP PJ">
        <Inp value={f.no_tlp_pj} onChange={(v) => s("no_tlp_pj", v)} />
      </Row>
      <Row label="Alamat PJ" span>
        <Inp value={f.alamat_pj} onChange={(v) => s("alamat_pj", v)} />
      </Row>
    </div>
  );
}

// ── Bagian petugas (shared) ───────────────────────────────────────────────────
function SeksiPetugas({ f, s }: { f: FormState; s: (k: keyof FormState, v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-4">
      <Row label="NIP/Kode Petugas">
        <Inp value={f.nip_petugas} onChange={(v) => s("nip_petugas", v)} />
      </Row>
      <Row label="Nama Petugas">
        <Inp value={f.nama_petugas} onChange={(v) => s("nama_petugas", v)} />
      </Row>
    </div>
  );
}

// ── FormState ────────────────────────────────────────────────────────────────
interface FormState {
  no_surat: string; tanggal: string; jam: string;
  no_rm: string; no_rawat: string; nm_pasien: string;
  tgl_lahir: string; umur: string; jk: string;
  bertindak_atas: string;
  nama_pj: string; hub_pj: string; jk_pj: string;
  tmp_lahir_pj: string; umur_pj: string;
  no_ktp_pj: string; no_tlp_pj: string; alamat_pj: string;
  nip_petugas: string; nama_petugas: string;
  // Khusus
  penyakit: string;
  kd_pj: string; jenis_bayar: string;
  titip_kelas: string; hak_kelas: string;
  ruang: string; kelas: string; tgl_rawat: string; alasan: string;
  pilihan: string; saksi_keluarga: string;
  // Persetujuan/Penolakan Tindakan
  diagnosa: string; dasar_diagnosa: string; tindakan: string;
  indikasi: string; tujuan: string; risiko: string;
  komplikasi: string; prognosis: string; alternatif: string;
  lain_lain: string;
  penerima_info: string; alasan_diwakilkan: string;
  alamat_penerima: string; no_hp_penerima: string;
  hub_penerima: string;
  jenis_persetujuan: string; // "Setuju" | "Menolak"
  saksi_perawat: string;
  nm_dokter: string;
  // Extra PJ fields
  tgl_lahir_pj: string; nip_pj: string; sebagai_pj: string;
  status_jaminan: string; jenis_jaminan: string; status_jaminan_lain: string;
  // Persetujuan Umum — Point 1: 3 keluarga yg diberi wewenang
  nama_keluarga_a: string; hubungan_pasien_a: string;
  nama_keluarga_b: string; hubungan_pasien_b: string;
  nama_keluarga_c: string; hubungan_pasien_c: string;
  // Point 2: 3 keluarga penerima informasi (hubungan_keluarga_X = Nama, detail_hubungan_X = Hubungan dgn pasien)
  hubungan_keluarga_a: string; detail_hubungan_a: string;
  hubungan_keluarga_b: string; detail_hubungan_b: string;
  hubungan_keluarga_c: string; detail_hubungan_c: string;
  pilihan_lepas_info: string; // "Memberikan" | "Tidak Memberikan"
  pilihan_akses_kunjungan: string; nama_tidak_diizinkan: string;
  preferensi_perawat: string; preferensi_dokter: string;
  nilai_keyakinan: string; permintaan_privasi: string; // JSON [{k,label,ya,d}]
  nilai_kepercayaan: string; saksi_pasien: string; pelayanan_rohani: string;
  kelas_perawatan: string; biaya_perkiraan_tindakan: string;
  biaya_administrasi: string; biaya_pemeriksaan_penunjang: string;
  biaya_farmasi: string; biaya_lain_lain: string;
  persetujuan_satu_sehat: string;
  pengobatan_kepada: string;
}

const initForm: FormState = {
  no_surat: "", tanggal: todayIso(), jam: new Date().toTimeString().slice(0, 5),
  no_rm: "", no_rawat: "", nm_pasien: "",
  tgl_lahir: "", umur: "", jk: "",
  bertindak_atas: "Pasien Sendiri",
  nama_pj: "", hub_pj: "", jk_pj: "",
  tmp_lahir_pj: "", umur_pj: "",
  no_ktp_pj: "", no_tlp_pj: "", alamat_pj: "",
  nip_petugas: "", nama_petugas: "",
  penyakit: "", kd_pj: "", jenis_bayar: "",
  titip_kelas: "", hak_kelas: "",
  ruang: "", kelas: "", tgl_rawat: "", alasan: "",
  pilihan: "", saksi_keluarga: "",
  diagnosa: "", dasar_diagnosa: "", tindakan: "",
  indikasi: "", tujuan: "", risiko: "",
  komplikasi: "", prognosis: "", alternatif: "", lain_lain: "",
  penerima_info: "", alasan_diwakilkan: "",
  alamat_penerima: "", no_hp_penerima: "",
  hub_penerima: "",
  jenis_persetujuan: "Setuju",
  saksi_perawat: "", nm_dokter: "",
  tgl_lahir_pj: "", nip_pj: "", sebagai_pj: "",
  status_jaminan: "", jenis_jaminan: "", status_jaminan_lain: "",
  nama_keluarga_a: "", hubungan_pasien_a: "",
  nama_keluarga_b: "", hubungan_pasien_b: "",
  nama_keluarga_c: "", hubungan_pasien_c: "",
  hubungan_keluarga_a: "", detail_hubungan_a: "",
  hubungan_keluarga_b: "", detail_hubungan_b: "",
  hubungan_keluarga_c: "", detail_hubungan_c: "",
  pilihan_lepas_info: "Memberikan",
  pilihan_akses_kunjungan: "", nama_tidak_diizinkan: "",
  preferensi_perawat: "", preferensi_dokter: "", nilai_keyakinan: "", permintaan_privasi: "", nilai_kepercayaan: "", saksi_pasien: "", pelayanan_rohani: "",
  kelas_perawatan: "", biaya_perkiraan_tindakan: "",
  biaya_administrasi: "", biaya_pemeriksaan_penunjang: "",
  biaya_farmasi: "", biaya_lain_lain: "",
  persetujuan_satu_sehat: "Setuju",
  pengobatan_kepada: "",
};

// ── Konten khusus per jenis ───────────────────────────────────────────────────
function KontenKhusus({ jenis, f, s, namaRS, penjabList }: {
  jenis: string;
  f: FormState;
  s: (k: keyof FormState, v: string) => void;
  namaRS: string;
  penjabList: { kd_pj: string; png_jawab: string }[];
}) {
  switch (jenis) {
    case "persetujuan_umum":
      return (
        <div className="space-y-4 text-xs text-slate-700">
          {/* 1. Persetujuan Perawatan */}
          <div>
            <div className="bg-slate-100 border-l-4 border-blue-700 px-3 py-2 mb-2">
              <p className="font-semibold text-slate-800">1. PERSETUJUAN UNTUK PERAWATAN DAN PENGOBATAN</p>
            </div>
            <div className="border border-slate-200 rounded p-3 bg-white leading-relaxed space-y-2">
              <p>Saya menyetujui untuk perawatan di {namaRS} sebagai pasien Rawat Jalan atau Rawat Inap tergantung kepada kebutuhan medis. Pengobatan dapat meliputi pemeriksaan x-ray/radiologi, tes darah, perawatan rutin dan prosedur seperti cairan infus atau suntikan dan evaluasi (contohnya wawancara dan pemeriksaan fisik). Persetujuan ini juga termasuk pemeriksaan Skrining Hipotiroid Kongenital (SHK) pada setiap bayi baru lahir. Persetujuan yang saya berikan tidak termasuk persetujuan untuk prosedur/tindakan invasif (misalnya operasi) atau tindakan yang mempunyai risiko tinggi. Jika saya memutuskan untuk menghentikan perawatan medis untuk diri saya sendiri, saya memahami dan menyadari bahwa {namaRS} atau dokter tidak bertanggungjawab atas hasil yang merugikan saya.</p>
              <p>Saya memberikan wewenang kepada rumah sakit untuk memberikan kewenangan untuk terlibat dalam pengambilan keputusan mengenai perawatan saya, data dan informasi mengenai diri saya, dan keadaan kesehatan saya termasuk dalam situasi tertentu, misalnya keadaan kritis dll, kepada keluarga saya, yaitu:</p>
              <div className="bg-slate-50 border border-slate-200 rounded p-3 mt-2">
                <div className="grid grid-cols-[24px_1fr_1fr] gap-x-3 gap-y-2 items-center">
                  <p className="font-semibold col-start-2">Nama</p>
                  <p className="font-semibold">Hubungan dengan Pasien</p>
                  <p className="font-semibold text-slate-500">a.</p>
                  <Inp value={f.nama_keluarga_a}  onChange={(v) => s("nama_keluarga_a",  v)} placeholder="Nama keluarga" />
                  <Inp value={f.hubungan_pasien_a} onChange={(v) => s("hubungan_pasien_a", v)} placeholder="Istri / Anak / Suami / dll" />
                  <p className="font-semibold text-slate-500">b.</p>
                  <Inp value={f.nama_keluarga_b}  onChange={(v) => s("nama_keluarga_b",  v)} />
                  <Inp value={f.hubungan_pasien_b} onChange={(v) => s("hubungan_pasien_b", v)} />
                  <p className="font-semibold text-slate-500">c.</p>
                  <Inp value={f.nama_keluarga_c}  onChange={(v) => s("nama_keluarga_c",  v)} />
                  <Inp value={f.hubungan_pasien_c} onChange={(v) => s("hubungan_pasien_c", v)} />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Pelepasan Informasi */}
          <div>
            <div className="bg-slate-100 border-l-4 border-blue-700 px-3 py-2 mb-2">
              <p className="font-semibold text-slate-800">2. PERSETUJUAN PELEPASAN INFORMASI</p>
            </div>
            <div className="border border-slate-200 rounded p-3 bg-white leading-relaxed space-y-2">
              <p>Saya memahami informasi yang ada di dalam diri saya, termasuk diagnosis, hasil laboratorium dan hasil tes diagnostik yang akan digunakan untuk perawatan medis, {namaRS} akan menjamin kerahasiaannya. Saya memberi wewenang kepada rumah sakit untuk memberikan informasi tentang rahasia kedokteran saya bila diperlukan untuk memproses klaim asuransi termasuk namun tidak terbatas pada BPJS, asuransi kesehatan lainnya, jamkesda, pihak pembayar, perusahaan dan atau lembaga pemerintah lainnya. Saya{" "}
                <span className="font-semibold">
                  {f.pilihan_lepas_info === "Tidak Memberikan" ? (
                    <><span>tidak memberikan</span> / <span className="line-through text-slate-400">memberikan</span></>
                  ) : (
                    <><span className="line-through text-slate-400">tidak memberikan</span> / <span>memberikan</span></>
                  )}
                </span>
                {" "}wewenang kepada rumah sakit untuk memberikan tentang data dan informasi kesehatan saya kepada keluarga terdekat saya, yaitu:
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded p-3 mt-2">
                <Row label="Pilihan Pelepasan Informasi">
                  <Sel value={f.pilihan_lepas_info} onChange={(v) => s("pilihan_lepas_info", v)}
                       options={["Memberikan", "Tidak Memberikan"]} />
                </Row>
                <div className="grid grid-cols-[24px_1fr_1fr] gap-x-3 gap-y-2 items-center mt-3">
                  <p className="font-semibold col-start-2">Nama</p>
                  <p className="font-semibold">Hubungan dengan Pasien</p>
                  <p className="font-semibold text-slate-500">a.</p>
                  <Inp value={f.hubungan_keluarga_a} onChange={(v) => s("hubungan_keluarga_a", v)} placeholder="Nama keluarga" />
                  <Inp value={f.detail_hubungan_a}    onChange={(v) => s("detail_hubungan_a",   v)} placeholder="Istri / Anak / dll" />
                  <p className="font-semibold text-slate-500">b.</p>
                  <Inp value={f.hubungan_keluarga_b} onChange={(v) => s("hubungan_keluarga_b", v)} />
                  <Inp value={f.detail_hubungan_b}    onChange={(v) => s("detail_hubungan_b",   v)} />
                  <p className="font-semibold text-slate-500">c.</p>
                  <Inp value={f.hubungan_keluarga_c} onChange={(v) => s("hubungan_keluarga_c", v)} />
                  <Inp value={f.detail_hubungan_c}    onChange={(v) => s("detail_hubungan_c",   v)} />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Hak dan Tanggung Jawab */}
          <div>
            <div className="bg-slate-100 border-l-4 border-blue-700 px-3 py-2 mb-2">
              <p className="font-semibold text-slate-800">3. HAK DAN TANGGUNG JAWAB PASIEN</p>
            </div>
            <div className="border border-slate-200 rounded p-3 bg-white leading-relaxed space-y-2">
              <p>Saya memiliki hak untuk mengambil bagian dalam keputusan mengenai penyakit saya dan dalam hal perawatan medis dan rencana pengobatan. Saya telah mendapat informasi tentang &ldquo;Hak dan tanggung jawab pasien&rdquo; di {namaRS} melalui banner dan formulir yang disediakan oleh petugas. Saya memahami bahwa {namaRS} tidak bertanggung jawab atas kehilangan barang pribadi dan barang berharga yang dibawa ke Rumah Sakit.</p>
              <p>Saya berhak menyampaikan preferensi jenis kelamin dokter (DPJP), perawat dan bidan yang merawat saya, dan Rumah Sakit akan berupaya memenuhinya sepanjang memungkinkan sesuai ketersediaan tenaga dan kondisi pelayanan.</p>
              <div className="bg-slate-50 border border-slate-200 rounded p-3">
                <div className="grid grid-cols-2 gap-3">
                  <Row label="Preferensi jenis kelamin dokter (DPJP)">
                    <Sel value={f.preferensi_dokter} onChange={(v) => s("preferensi_dokter", v)}
                      options={["Tidak keberatan","Laki-laki","Perempuan"]} />
                  </Row>
                  <Row label="Preferensi jenis kelamin perawat & bidan">
                    <Sel value={f.preferensi_perawat} onChange={(v) => s("preferensi_perawat", v)}
                      options={["Tidak keberatan","Laki-laki","Perempuan"]} />
                  </Row>
                  <Row label="Nilai kepercayaan yang perlu dihormati">
                    <Inp value={f.nilai_kepercayaan} onChange={(v) => s("nilai_kepercayaan", v)}
                      placeholder="cth pantangan agama/budaya, dll" />
                  </Row>
                </div>
              </div>
              <p className="font-semibold text-slate-700 mt-2">HAK PASIEN TERKAIT NILAI DAN KEYAKINAN</p>
              <p className="text-slate-400 text-xs -mt-1">Yang dipilih &ldquo;Ya&rdquo; yang akan muncul di cetakan.</p>
              <Checklist defs={NILAI_ITEMS} value={f.nilai_keyakinan} onChange={(v) => s("nilai_keyakinan", v)} />
            </div>
          </div>

          {/* 4. Informasi Rawat Inap */}
          <div>
            <div className="bg-slate-100 border-l-4 border-blue-700 px-3 py-2 mb-2">
              <p className="font-semibold text-slate-800">4. INFORMASI RAWAT INAP</p>
            </div>
            <div className="border border-slate-200 rounded p-3 bg-white leading-relaxed space-y-2">
              <p>Saya telah memahami bahwa rumah sakit tidak bertanggung jawab atas semua kehilangan barang-barang milik saya dan saya secara pribadi bertanggung jawab atas barang-barang berharga yang saya miliki termasuk namun tidak terbatas pada uang, perhiasan, buku cek, kartu kredit, handphone atau barang lainnya. <b>Dan apabila saya membutuhkan maka saya dapat menitipkan barang-barang tersebut kepada rumah sakit.</b> Saya juga mengerti bahwa saya harus memberitahu/menitipkan pada rumah sakit jika saya memiliki gigi palsu, kacamata, lensa kontak, prostetik atau barang lainnya yang saya butuhkan untuk diamankan.</p>
              <p>Saya telah menerima informasi tentang peraturan yang diberlakukan oleh rumah sakit dan saya beserta keluarga bersedia untuk mematuhinya, termasuk akan mematuhi jam berkunjung pasien sesuai dengan aturan di rumah sakit. Anggota keluarga saya akan menunggu saya dan bersedia untuk selalu memakai tanda pengenal khusus yang diberikan oleh rumah sakit, dan demi keamanan seluruh pasien setiap keluarga dan siapapun yang akan mengunjungi saya di luar jam berkunjung, bersedia untuk diminta/diperiksa identitasnya dan memakai identitias yang diberikan oleh rumah sakit.</p>
            </div>
          </div>

          {/* 5. Privasi */}
          <div>
            <div className="bg-slate-100 border-l-4 border-blue-700 px-3 py-2 mb-2">
              <p className="font-semibold text-slate-800">5. PRIVASI</p>
            </div>
            <div className="border border-slate-200 rounded p-3 bg-white leading-relaxed space-y-2">
              <p>Saya{" "}
                <span className="font-semibold">
                  {f.pilihan_akses_kunjungan === "Tidak Mengizinkan" ? (
                    <><span className="line-through text-slate-400">mengizinkan</span> / <span>tidak mengizinkan</span></>
                  ) : (
                    <><span>mengizinkan</span> / <span className="line-through text-slate-400">tidak mengizinkan</span></>
                  )}
                </span>
                <span className="text-slate-400">*</span>{" "}Rumah Sakit memberi akses bagi keluarga dan orang &ndash; orang yang akan menjenguk saya <span className="italic">(sebutkan nama bila ada permintaan khusus yang tidak diizinkan)</span> :
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded p-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <Row label="Pilihan Akses Kunjungan">
                    <Sel value={f.pilihan_akses_kunjungan} onChange={(v) => s("pilihan_akses_kunjungan", v)}
                      options={["Mengizinkan","Tidak Mengizinkan"]} />
                  </Row>
                  <Row label="Nama yang tidak diizinkan">
                    <Txta value={f.nama_tidak_diizinkan} onChange={(v) => s("nama_tidak_diizinkan", v)}
                      placeholder="Kosongkan jika semua diizinkan" rows={2} />
                  </Row>
                </div>
                <p className="text-slate-400 mt-1">*coret salah satu</p>
              </div>
              <p className="font-semibold text-slate-700 mt-2">PERMINTAAN PRIVASI</p>
              <p className="text-slate-400 text-xs -mt-1">Yang dipilih &ldquo;Ya&rdquo; yang akan muncul di cetakan.</p>
              <Checklist defs={PRIVASI_ITEMS} value={f.permintaan_privasi} onChange={(v) => s("permintaan_privasi", v)} />
            </div>
          </div>

          {/* 6. Informasi Biaya */}
          <div>
            <div className="bg-slate-100 border-l-4 border-blue-700 px-3 py-2 mb-2">
              <p className="font-semibold text-slate-800">6. INFORMASI BIAYA</p>
            </div>
            <div className="border border-slate-200 rounded p-3 bg-white leading-relaxed space-y-2">
              <p>Saya memahami tentang informasi biaya kamar inap per malam sesuai kelas perawatan (rincian tarif pada tabel di bawah), belum termasuk biaya pengobatan, biaya tindakan, dan jasa dokter, sedangkan bagi pengguna BPJS &ldquo;Gratis&rdquo;, yang dijelaskan oleh petugas rumah sakit. Bila pasien sudah dinyatakan boleh pulang oleh DPJP maka pasien/keluarga pasien menyelesaikan transaksi pembayaran keuangan melaui kasir, sedangkan untuk pasien BPJS harus sudah menyelesaikan administrasi sesuai peraturan BPJS. Setelah transaksi keuangan selesai diberi toleransi waktu 2 jam untuk persiapan pulang. Bila melewati waktu yang sudah ditentukan, maka akan dikenakan tambahan biaya kamar.</p>
              <table className="w-full text-sm border border-slate-300 my-2">
                <thead><tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1 text-left">Kelas Perawatan</th>
                  <th className="border border-slate-300 px-2 py-1 text-right">Tarif Kamar / Malam</th>
                </tr></thead>
                <tbody>
                  {[["Kelas I", "300.000"], ["Kelas II", "280.000"], ["Kelas III", "150.000"], ["HCU", "450.000"], ["ICU", "1.050.000"]].map(([k, v]) => (
                    <tr key={k}>
                      <td className="border border-slate-300 px-2 py-1">{k}</td>
                      <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">Rp {v},00</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>Saya memahami tentang informasi biaya yang telah dijelaskan oleh petugas rumah sakit sesuai dengan perencanaan:</p>
              <div className="bg-slate-50 border border-slate-200 rounded p-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <Row label="a. Kelas perawatan"><Inp value={f.kelas_perawatan} onChange={(v) => s("kelas_perawatan", v)} placeholder="Kelas 1 / 2 / 3 / VIP" /></Row>
                  <Row label="b. Biaya perkiraan tindakan"><Inp value={f.biaya_perkiraan_tindakan} onChange={(v) => s("biaya_perkiraan_tindakan", v)} placeholder="Rp" /></Row>
                  <Row label="c. Biaya administrasi"><Inp value={f.biaya_administrasi} onChange={(v) => s("biaya_administrasi", v)} placeholder="Rp" /></Row>
                  <Row label="d. Biaya pemeriksaan penunjang sesuai dengan kebutuhan"><Inp value={f.biaya_pemeriksaan_penunjang} onChange={(v) => s("biaya_pemeriksaan_penunjang", v)} placeholder="Sesuai kebutuhan" /></Row>
                  <Row label="e. Biaya farmasi"><Inp value={f.biaya_farmasi} onChange={(v) => s("biaya_farmasi", v)} placeholder="Sesuai kebutuhan obat" /></Row>
                  <Row label="f. Biaya lain &ndash; lain"><Inp value={f.biaya_lain_lain} onChange={(v) => s("biaya_lain_lain", v)} placeholder="Jika ada" /></Row>
                </div>
              </div>
              <p className="mt-2">Bila pasien sudah dinyatakan boleh pulang oleh DPJP maka pasien/keluarga pasien menyelesaikan transaksi pembayaran keuangan melaui kasir, Setelah transaksi keuangan selesai diberi toleransi waktu 2 jam untuk persiapan pulang. Bila melewati waktu yang sudah ditentukan, maka akan dikenakan tambahan biaya kamar.</p>
            </div>
          </div>

          {/* 7. Pelayanan Rohani */}
          <div>
            <div className="bg-slate-100 border-l-4 border-blue-700 px-3 py-2 mb-2">
              <p className="font-semibold text-slate-800">7. PELAYANAN ROHANI</p>
            </div>
            <div className="border border-slate-200 rounded p-3 bg-white leading-relaxed space-y-2">
              <p>Saya memahami bahwa Rumah Sakit menyediakan pelayanan Rohani sesuai agama dan kepercayaan pasien apabila diperlukan.</p>
              <div className="flex flex-col gap-1.5 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="pelayanan_rohani" checked={f.pelayanan_rohani === "Bersedia"} onChange={() => s("pelayanan_rohani", "Bersedia")} />
                  Saya bersedia mendapatkan pelayanan rohani
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="pelayanan_rohani" checked={f.pelayanan_rohani === "Tidak Bersedia"} onChange={() => s("pelayanan_rohani", "Tidak Bersedia")} />
                  Saya tidak bersedia mendapatkan pelayanan rohani
                </label>
              </div>
            </div>
          </div>

          {/* 8. Persetujuan Integrasi SATUSEHAT */}
          <div>
            <div className="bg-slate-100 border-l-4 border-blue-700 px-3 py-2 mb-2">
              <p className="font-semibold text-slate-800">8. PERSETUJUAN INTEGRASI DATA KE PLATFORM SATUSEHAT</p>
            </div>
            <div className="border border-slate-200 rounded p-3 bg-white leading-relaxed space-y-2">
              <p>Sesuai dengan <span className="italic">Keputusan Menteri Kesehatan Nomor HK.01.07/MENKES/1423/2022</span> jo. <span className="italic">KMK Nomor HK.01.07/MENKES/133/2023</span> tentang Integrasi Data Kesehatan Nasional melalui Platform SATUSEHAT, serta <span className="italic">Undang-Undang Nomor 17 Tahun 2023 tentang Kesehatan</span> dan <span className="italic">Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi</span>, {namaRS} sebagai fasilitas pelayanan kesehatan diwajibkan untuk mengirimkan data pelayanan pasien ke Platform SATUSEHAT yang dikelola oleh Kementerian Kesehatan Republik Indonesia.</p>
              <p className="font-semibold mt-2">Saya memahami bahwa data yang akan dikirim meliputi (namun tidak terbatas pada):</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Identitas pasien (NIK, nama, tanggal lahir, alamat, jenis kelamin, kontak)</li>
                <li>Data kunjungan dan rekam medis elektronik (diagnosis, anamnesis, pemeriksaan fisik)</li>
                <li>Hasil pemeriksaan penunjang (laboratorium, radiologi, patologi)</li>
                <li>Tindakan medis, prosedur, resep dan pemberian obat</li>
                <li>Riwayat imunisasi/vaksinasi serta data alergi</li>
                <li>Resume medis dan kondisi pulang</li>
              </ul>
              <p className="font-semibold mt-2">Tujuan pengiriman data:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Pelayanan kesehatan, rujukan, dan kesinambungan perawatan antar fasyankes (interoperabilitas).</li>
                <li>Surveilans kesehatan, kewaspadaan dini, dan pengendalian penyakit.</li>
                <li>Pengembangan ilmu pengetahuan, teknologi, dan pembuatan kebijakan bidang kesehatan.</li>
              </ul>
              <p className="mt-2">Kementerian Kesehatan dan {namaRS} menjamin kerahasiaan, keutuhan, dan keamanan data pribadi pasien melalui enkripsi sistem kriptografi, pembatasan akses sesuai kewenangan, serta hak pasien untuk mengakses, mengoreksi, dan mencabut persetujuan atas data pribadinya melalui aplikasi SATUSEHAT Mobile, kecuali data yang wajib disimpan berdasarkan ketentuan peraturan perundang-undangan.</p>
              <div className="bg-slate-50 border border-slate-200 rounded p-3 mt-2">
                <Row label="Persetujuan Pengiriman Data ke SATUSEHAT">
                  <Sel value={f.persetujuan_satu_sehat} onChange={(v) => s("persetujuan_satu_sehat", v)}
                    options={["Setuju","Tidak Setuju"]} />
                </Row>
                <p className="text-slate-500 mt-1 italic">Dengan menandatangani formulir ini, saya menyatakan {f.persetujuan_satu_sehat === "Tidak Setuju" ? "TIDAK MEMBERIKAN" : "MEMBERIKAN"} persetujuan kepada {namaRS} untuk mengirimkan data pelayanan saya ke Platform SATUSEHAT sebagaimana diuraikan di atas.</p>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded p-3 bg-white">
            <p className="font-semibold">Demikian pernyataan ini saya buat dengan sesungguhnya untuk diketahui dan digunakan sebagaimana perlunya.</p>
          </div>
        </div>
      );

    case "hak_kewajiban":
      return (
        <div className="space-y-4 text-xs text-slate-700">
          <div className="border border-slate-200 rounded p-2 bg-slate-50 text-[11px] text-slate-600 italic">
            Berdasarkan Pasal 276 dan Pasal 277 Undang-Undang Nomor 17 Tahun 2023 tentang Kesehatan
            jo. Peraturan Pemerintah Nomor 28 Tahun 2024 tentang Peraturan Pelaksanaan UU Kesehatan.
          </div>
          <div className="border border-blue-200 rounded-lg bg-blue-50">
            <div className="bg-blue-700 text-white px-3 py-2 rounded-t-lg">
              <p className="font-semibold">HAK PASIEN</p>
              <p className="text-[10px] font-normal opacity-90">Pasal 276 UU No. 17 Tahun 2023</p>
            </div>
            <div className="p-3">
              <p className="mb-1">Setiap pasien berhak untuk:</p>
              <ol className="list-decimal pl-4 space-y-1 leading-relaxed">
                <li>Mendapatkan informasi mengenai kesehatan dirinya.</li>
                <li>Mendapatkan penjelasan yang memadai mengenai pelayanan kesehatan yang diterima.</li>
                <li>Mendapatkan pelayanan kesehatan sesuai dengan kebutuhan medis, standar profesi, dan pelayanan kesehatan yang bermutu.</li>
                <li>Menyetujui atau menolak sebagian atau seluruh tindakan medis yang akan dilakukan setelah menerima dan memahami informasi mengenai tindakan tersebut secara lengkap, kecuali tindakan medis yang wajib dilakukan dalam rangka pencegahan penyakit dan penanganan Kejadian Luar Biasa dan/atau wabah.</li>
                <li>Mendapatkan akses terhadap informasi yang terdapat di dalam rekam medis.</li>
                <li>Meminta pendapat Tenaga Medis atau Tenaga Kesehatan lain (second opinion).</li>
                <li>Mendapatkan hak lain sesuai dengan ketentuan peraturan perundang-undangan.</li>
              </ol>
            </div>
          </div>
          <div className="border border-amber-200 rounded-lg bg-amber-50">
            <div className="bg-amber-600 text-white px-3 py-2 rounded-t-lg">
              <p className="font-semibold">KEWAJIBAN PASIEN</p>
              <p className="text-[10px] font-normal opacity-90">Pasal 277 UU No. 17 Tahun 2023</p>
            </div>
            <div className="p-3">
              <p className="mb-1">Setiap pasien berkewajiban untuk:</p>
              <ol className="list-decimal pl-4 space-y-1 leading-relaxed">
                <li>Memberikan informasi yang lengkap dan jujur tentang masalah kesehatannya.</li>
                <li>Mematuhi nasihat dan petunjuk Tenaga Medis dan Tenaga Kesehatan.</li>
                <li>Mematuhi ketentuan yang berlaku pada Fasilitas Pelayanan Kesehatan ({namaRS}).</li>
                <li>Memberikan imbalan jasa atas pelayanan yang diterima.</li>
              </ol>
            </div>
          </div>
          <div className="border border-green-200 rounded p-3 bg-green-50 text-xs text-slate-700">
            <p>Dengan ini menyatakan telah memahami dan benar telah mendapatkan penjelasan mengenai hak dan kewajiban pasien dan diberikan kesempatan untuk bertanya.</p>
          </div>
        </div>
      );

    case "masuk_unit":
      return (
        <div className="space-y-3 text-xs text-slate-700">
          <div className="border border-slate-200 rounded p-3 bg-white leading-relaxed">
            <p className="font-semibold mb-2">Menyatakan bersedia masuk unit perawatan {namaRS} dengan ketentuan sebagai berikut:</p>
            <ol className="list-decimal pl-4 space-y-2">
              <li>Saya bersedia masuk unit perawatan {namaRS} dan akan mengikuti semua prosedur dan tata tertib yang berlaku di {namaRS}.</li>
              <li>Saya bersedia untuk menyelesaikan seluruh persyaratan administrasi BPJS Kesehatan sesuai dengan ketentuan yang berlaku, dan apabila terdapat berkas atau persyaratan yang belum terpenuhi akan saya penuhi dalam jangka waktu yang ditetapkan oleh rumah sakit.</li>
              <li>Apabila dalam proses perawatan terdapat perbedaan kelas perawatan atau terdapat biaya tambahan yang tidak ditanggung oleh BPJS Kesehatan, saya bersedia untuk membayar selisih biaya tersebut.</li>
              <li>Saya memahami dan menyetujui bahwa apabila saya tidak mengikuti aturan dari BPJS Kesehatan, saya siap untuk menyelesaikan Administrasi Keuangan secara Mandiri.</li>
            </ol>
          </div>
          <div className="border border-green-200 rounded p-3 bg-green-50">
            <p className="font-semibold text-green-800">Demikian pernyataan ini saya buat dengan sesungguhnya dan tanpa paksaan dari pihak manapun.</p>
          </div>
        </div>
      );

    case "jaminan_pasien":
      return (
        <div className="space-y-4 text-xs text-slate-700">
          <div className="bg-slate-100 border-l-4 border-blue-700 px-3 py-2">
            <p className="font-semibold text-slate-800">DATA PEMBUAT PERNYATAAN</p>
          </div>
          <div className="border border-slate-200 rounded p-3 bg-white">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <Row label="Nama"><Inp value={f.nama_pj} onChange={(v) => s("nama_pj", v)} /></Row>
              <Row label="No. KTP"><Inp value={f.no_ktp_pj} onChange={(v) => s("no_ktp_pj", v)} /></Row>
              <Row label="Tempat Lahir"><Inp value={f.tmp_lahir_pj} onChange={(v) => s("tmp_lahir_pj", v)} /></Row>
              <Row label="Tanggal Lahir"><Inp value={f.tgl_lahir_pj} onChange={(v) => s("tgl_lahir_pj", v)} type="date" /></Row>
              <Row label="Jenis Kelamin">
                <Sel value={f.jk_pj} onChange={(v) => s("jk_pj", v)} options={JK_OPTIONS} />
              </Row>
              <Row label="No. Telepon"><Inp value={f.no_tlp_pj} onChange={(v) => s("no_tlp_pj", v)} /></Row>
              <Row label="Hubungan dengan Pasien">
                <Sel value={f.hub_pj} onChange={(v) => s("hub_pj", v)} options={HUB_OPTIONS} />
              </Row>
              <Row label="Alamat Tempat Tinggal" span>
                <Txta value={f.alamat_pj} onChange={(v) => s("alamat_pj", v)} rows={2} />
              </Row>
              <Row label="Penyakit yang Diderita" span>
                <Inp value={f.penyakit} onChange={(v) => s("penyakit", v)} />
              </Row>
            </div>
          </div>
          <div className="border border-slate-200 rounded p-3 bg-white leading-relaxed space-y-3">
            <p>Dengan ini menyatakan bahwa pasien tersebut diatas menjadi tanggung jawab saya dan semua biaya yang dibebankan pada pasien selama mendapatkan pelayanan kesehatan di {namaRS} seluruh akan dibayar secara :</p>
            <div className="bg-slate-50 border border-slate-200 rounded p-3">
              <Row label="Cara Bayar">
                <select
                  value={f.kd_pj}
                  onChange={(e) => s("kd_pj", e.target.value)}
                  className="w-full border border-slate-200 rounded bg-white text-sm p-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="">-- pilih cara bayar --</option>
                  {penjabList.map(pj => (
                    <option key={pj.kd_pj} value={pj.kd_pj}>{pj.png_jawab}</option>
                  ))}
                </select>
              </Row>
            </div>
            <p>Demikian pernyataan ini dibuat dengan sebenarnya dalam keadaan sadar tidak dalam tekanan. Apabila dikemudian hari terjadi pelanggaran dalam pembayaran akibat ketidak sesuaian dengan pernyataan yang tertulis dalam surat pernyataan ini, maka sebagai penanggung jawab, saya bersedia diproses sesuai hukum yang berlaku.</p>
          </div>
        </div>
      );

    case "jaminan_umum":
      return (
        <div className="space-y-4 text-xs text-slate-700">
          <div className="bg-slate-100 border-l-4 border-blue-700 px-3 py-2">
            <p className="font-semibold text-slate-800">YANG BERTANDA TANGAN DI BAWAH INI</p>
          </div>
          <div className="border border-slate-200 rounded p-3 bg-white">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <Row label="Nama"><Inp value={f.nama_pj} onChange={(v) => s("nama_pj", v)} /></Row>
              <Row label="No. KTP"><Inp value={f.no_ktp_pj} onChange={(v) => s("no_ktp_pj", v)} /></Row>
              <Row label="Tempat Lahir"><Inp value={f.tmp_lahir_pj} onChange={(v) => s("tmp_lahir_pj", v)} /></Row>
              <Row label="Tanggal Lahir"><Inp value={f.tgl_lahir_pj} onChange={(v) => s("tgl_lahir_pj", v)} type="date" /></Row>
              <Row label="Jenis Kelamin">
                <Sel value={f.jk_pj} onChange={(v) => s("jk_pj", v)} options={JK_OPTIONS} />
              </Row>
              <Row label="No. Telepon"><Inp value={f.no_tlp_pj} onChange={(v) => s("no_tlp_pj", v)} /></Row>
              <Row label="Hubungan dengan Pasien">
                <Sel value={f.hub_pj} onChange={(v) => s("hub_pj", v)} options={HUB_OPTIONS} />
              </Row>
              <Row label="Alamat" span>
                <Txta value={f.alamat_pj} onChange={(v) => s("alamat_pj", v)} rows={2} />
              </Row>
            </div>
          </div>
          <div className="border border-slate-200 rounded p-3 bg-white leading-relaxed space-y-3">
            <p>
              Memang benar&nbsp;
              <select value={f.status_jaminan} onChange={e => s("status_jaminan", e.target.value)}
                className="border-b border-slate-400 bg-transparent text-sm text-slate-900 focus:outline-none focus:border-green-600 mx-1">
                <option value="">-- pilih --</option>
                {["Tidak Memiliki","Tidak Menggunakan","Memiliki","Menggunakan"].map(o => <option key={o}>{o}</option>)}
              </select>
              &nbsp;jaminan kesehatan&nbsp;
              <select value={f.jenis_jaminan} onChange={e => s("jenis_jaminan", e.target.value)}
                className="border-b border-slate-400 bg-transparent text-sm text-slate-900 focus:outline-none focus:border-green-600 mx-1">
                <option value="">-- pilih --</option>
                {["Tunai (Pribadi)","Akses Sosial/PNS","KIS/BPJS","Jaminan Perusahaan","Lain-lain"].map(o => <option key={o}>{o}</option>)}
              </select>
              {f.jenis_jaminan === "Lain-lain" && (
                <input value={f.status_jaminan_lain} onChange={e => s("status_jaminan_lain", e.target.value)}
                  placeholder="Sebutkan jaminan lainnya"
                  className="border-b border-slate-400 bg-transparent text-sm text-slate-900 focus:outline-none focus:border-green-600 mx-1 w-48" />
              )}
            </p>
            <p>Dengan ini menyatakan sanggup dan bertanggung jawab atas semua biaya perawatan dan pengobatan pasien tersebut di atas, serta bersedia membayar biaya perawatan sesuai tarif yang berlaku di {namaRS}. Apabila pada saat pasien pulang biaya yang timbul tidak dapat dilunasi, maka saya bersedia memberikan jaminan berupa identitas diri yang sah.</p>
            <p className="font-semibold">Demikian surat pernyataan ini saya buat dengan sadar dan tanpa paksaan dan dapat dipergunakan sebagai mestinya.</p>
          </div>
        </div>
      );

    case "titip_kelas":
      return (
        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
          <Row label="Dititip di Kelas">
            <Inp value={f.titip_kelas} onChange={(v) => s("titip_kelas", v)} placeholder="Contoh: Kelas II" />
          </Row>
          <Row label="Hak Kelas Pasien">
            <Inp value={f.hak_kelas} onChange={(v) => s("hak_kelas", v)} placeholder="Contoh: Kelas III" />
          </Row>
          <div className="col-span-2 border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs text-slate-600 mt-2">
            <p>Dengan ini menyatakan bersedia untuk ditempatkan di kelas perawatan yang disebutkan
               di atas karena keterbatasan tempat, dan bersedia menanggung selisih biaya yang
               timbul akibat perbedaan kelas tersebut.</p>
          </div>
        </div>
      );

    case "jamkesda":
      return (
        <div className="space-y-4 text-xs text-slate-700">
          <div className="bg-slate-100 border-l-4 border-blue-700 px-3 py-2">
            <p className="font-semibold text-slate-800">YANG BERTANDA TANGAN DI BAWAH INI</p>
          </div>
          <div className="border border-slate-200 rounded p-3 bg-white">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <Row label="Nama"><Inp value={f.nama_pj} onChange={(v) => s("nama_pj", v)} /></Row>
              <Row label="No. KTP"><Inp value={f.no_ktp_pj} onChange={(v) => s("no_ktp_pj", v)} /></Row>
              <Row label="Tempat Lahir"><Inp value={f.tmp_lahir_pj} onChange={(v) => s("tmp_lahir_pj", v)} /></Row>
              <Row label="Tanggal Lahir"><Inp value={f.tgl_lahir_pj} onChange={(v) => s("tgl_lahir_pj", v)} type="date" /></Row>
              <Row label="Jenis Kelamin">
                <Sel value={f.jk_pj} onChange={(v) => s("jk_pj", v)} options={JK_OPTIONS} />
              </Row>
              <Row label="No. Telepon"><Inp value={f.no_tlp_pj} onChange={(v) => s("no_tlp_pj", v)} /></Row>
              <Row label="Hubungan dengan Pasien">
                <Sel value={f.hub_pj} onChange={(v) => s("hub_pj", v)} options={HUB_OPTIONS} />
              </Row>
              <Row label="NIP (jika ada)"><Inp value={f.nip_pj} onChange={(v) => s("nip_pj", v)} /></Row>
              <Row label="Bertindak sebagai" span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 shrink-0">adalah sebagai</span>
                  <Inp value={f.sebagai_pj} onChange={(v) => s("sebagai_pj", v)} placeholder="Suami / Anak / dll" />
                  <span className="text-slate-500 shrink-0">dari pasien</span>
                </div>
              </Row>
              <Row label="Alamat" span>
                <Txta value={f.alamat_pj} onChange={(v) => s("alamat_pj", v)} rows={2} />
              </Row>
            </div>
          </div>
          <div className="bg-slate-100 border-l-4 border-blue-700 px-3 py-2">
            <p className="font-semibold text-slate-800">DATA PASIEN YANG DIRAWAT</p>
          </div>
          <div className="border border-slate-200 rounded p-3 bg-white">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <Row label="Ruang Perawatan"><Inp value={f.ruang} onChange={(v) => s("ruang", v)} /></Row>
              <Row label="Kelas"><Inp value={f.kelas} onChange={(v) => s("kelas", v)} /></Row>
              <Row label="Tgl. Mulai Rawat"><Inp value={f.tgl_rawat} onChange={(v) => s("tgl_rawat", v)} type="date" /></Row>
            </div>
          </div>
          <div className="border border-slate-200 rounded p-3 bg-white leading-relaxed space-y-2">
            <p>Dengan ini berjanji akan melengkapi persyaratan JAMKESDA dalam waktu <strong>3 (tiga) hari kerja</strong> terhitung sejak tanggal masuk rawat.</p>
            <p>Alasan belum dapat melengkapi persyaratan:</p>
            <Txta value={f.alasan} onChange={(v) => s("alasan", v)} rows={3} placeholder="Tuliskan alasan belum dapat melengkapi persyaratan..." />
            <p className="mt-2">Apabila dalam jangka waktu tersebut persyaratan tidak dapat dipenuhi, maka saya bersedia untuk menyelesaikan biaya perawatan secara mandiri/umum sesuai tarif yang berlaku di {namaRS}.</p>
            <p>Saya memahami dan menyetujui bahwa dokter dan petugas {namaRS} akan melakukan verifikasi terhadap kelengkapan persyaratan JAMKESDA yang saya serahkan.</p>
            <p className="font-semibold">Demikian perjanjian ini saya buat dengan sesungguhnya dan tanpa paksaan dari pihak manapun.</p>
          </div>
        </div>
      );

    case "bersedia_igd":
      return (
        <div className="space-y-3 text-xs text-slate-700">
          <div className="bg-slate-100 border-l-4 border-red-600 px-3 py-2">
            <p className="font-semibold text-slate-800">PERNYATAAN BERSEDIA MENUNGGU DI IGD</p>
          </div>
          <div className="border border-slate-200 rounded p-3 bg-white leading-relaxed">
            <p className="mb-2">Dengan ini menyatakan:</p>
            <ol className="list-decimal pl-4 space-y-2">
              <li>Bersedia menunggu di ruang Instalasi Gawat Darurat (IGD) {namaRS} karena pada saat ini bangsal/ruang rawat inap yang dituju belum/tidak tersedia tempat, dan tidak akan memaksa petugas untuk segera mendapatkan kamar atau ruang perawatan.</li>
              <li>Menyetujui bahwa apabila kondisi pasien memburuk selama menunggu di IGD, dokter berhak untuk melakukan tindakan resusitasi / intubasi yang diperlukan demi keselamatan pasien.</li>
              <li>Telah mendapat penjelasan tentang kondisi pasien saat ini dan memahami risiko yang mungkin timbul selama menunggu di IGD, serta menerima kondisi tersebut dengan lapang dada.</li>
            </ol>
          </div>
          <div className="border border-slate-200 rounded p-3 bg-white">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <Row label="Saksi Pihak Keluarga">
                <Inp value={f.saksi_keluarga} onChange={(v) => s("saksi_keluarga", v)} />
              </Row>
            </div>
          </div>
          <div className="border border-green-200 rounded p-3 bg-green-50">
            <p className="font-semibold text-green-800">Demikian pernyataan ini saya buat dengan sesungguhnya dan tanpa paksaan dari pihak manapun.</p>
          </div>
        </div>
      );

    case "pulang_aps":
      return (
        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
          <Row label="Alasan Pulang APS" span>
            <Txta value={f.pilihan} onChange={(v) => s("pilihan", v)} rows={2}
              placeholder="Alasan meminta pulang sebelum dinyatakan sembuh..." />
          </Row>
          <Row label="Saksi Pihak Keluarga">
            <Inp value={f.saksi_keluarga} onChange={(v) => s("saksi_keluarga", v)} />
          </Row>
          <div className="col-span-2 border border-slate-200 rounded-lg p-3 bg-amber-50 text-xs text-slate-600 mt-2">
            <p className="font-semibold text-amber-700 mb-1">PERNYATAAN PENTING</p>
            <p>Saya menyadari bahwa kepulangan saya/pasien sebelum dinyatakan sembuh oleh dokter
               adalah atas permintaan sendiri dan bukan atas anjuran dokter. Saya bertanggung jawab
               penuh atas segala risiko yang terjadi akibat keputusan ini.</p>
          </div>
        </div>
      );

    case "persetujuan_penolakan":
      return (
        <div className="space-y-4">
          {/* Bagian A - Informasi Medis */}
          <div className="border border-slate-200 rounded-lg p-4">
            <p className="text-xs font-bold text-slate-700 mb-3 border-b pb-2">
              BAGIAN A — INFORMASI DARI DOKTER
            </p>
            <div className="grid grid-cols-1 gap-2">
              {([
                ["diagnosa",        "Diagnosa"],
                ["dasar_diagnosa",  "Dasar Diagnosa"],
                ["tindakan",        "Tindakan Kedokteran yang Diusulkan"],
                ["indikasi",        "Indikasi Tindakan"],
                ["tujuan",          "Tujuan Tindakan"],
                ["risiko",          "Risiko Jika Tidak Dilakukan"],
                ["komplikasi",      "Kemungkinan Komplikasi"],
                ["prognosis",       "Prognosis"],
                ["alternatif",      "Alternatif & Risikonya"],
                ["lain_lain",       "Lain-lain"],
              ] as [keyof FormState, string][]).map(([key, lbl]) => (
                <Row key={key} label={lbl} span>
                  <Txta value={f[key] as string} onChange={(v) => s(key, v)} rows={1} />
                </Row>
              ))}
              <Row label="Dokter yang Memberikan Informasi">
                <Inp value={f.nm_dokter} onChange={(v) => s("nm_dokter", v)} />
              </Row>
            </div>
          </div>

          {/* Bagian B - Penerima Informasi */}
          <div className="border border-slate-200 rounded-lg p-4">
            <p className="text-xs font-bold text-slate-700 mb-3 border-b pb-2">
              BAGIAN B — PENERIMA INFORMASI / PEMBERI PERSETUJUAN
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              <Row label="Nama Penerima Informasi" span>
                <Inp value={f.penerima_info} onChange={(v) => s("penerima_info", v)} />
              </Row>
              <Row label="Hubungan dengan Pasien">
                <Sel value={f.hub_penerima} onChange={(v) => s("hub_penerima", v)} options={HUB_OPTIONS} />
              </Row>
              <Row label="No. HP">
                <Inp value={f.no_hp_penerima} onChange={(v) => s("no_hp_penerima", v)} />
              </Row>
              <Row label="Alamat" span>
                <Inp value={f.alamat_penerima} onChange={(v) => s("alamat_penerima", v)} />
              </Row>
              <Row label="Alasan jika Diwakilkan" span>
                <Txta value={f.alasan_diwakilkan} onChange={(v) => s("alasan_diwakilkan", v)} rows={1} />
              </Row>
            </div>
          </div>

          {/* Bagian C - Keputusan */}
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <p className="text-xs font-bold text-slate-700 mb-3 border-b pb-2">
              BAGIAN C — KEPUTUSAN
            </p>
            <div className="flex gap-6 mb-3">
              {["Setuju", "Menolak"].map((v) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="jenis_persetujuan"
                    value={v}
                    checked={f.jenis_persetujuan === v}
                    onChange={() => s("jenis_persetujuan", v)}
                    className="accent-green-700 w-4 h-4"
                  />
                  <span className={`text-sm font-semibold ${v === "Menolak" ? "text-red-600" : "text-green-700"}`}>{v}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              <Row label="Saksi Perawat/Petugas">
                <Inp value={f.saksi_perawat} onChange={(v) => s("saksi_perawat", v)} />
              </Row>
              <Row label="Saksi Pihak Keluarga">
                <Inp value={f.saksi_keluarga} onChange={(v) => s("saksi_keluarga", v)} />
              </Row>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ── Kamera ────────────────────────────────────────────────────────────────────
function KameraCapture({ onCapture, label = "📷 Foto Pembuat Pernyataan" }: { onCapture: (dataUrl: string) => void; label?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [errCam, setErrCam] = useState("");
  const streamRef = useRef<MediaStream | null>(null);

  async function startCamera() {
    setErrCam("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = s;
      setStreaming(true);   // mount <video> dulu; useEffect di bawah attach stream-nya
    } catch { setErrCam("Kamera tidak dapat diakses. Pastikan izin kamera diberikan."); }
  }

  // Pasang stream ke <video> setelah element di-mount (saat streaming=true)
  useEffect(() => {
    if (!streaming || !videoRef.current || !streamRef.current) return;
    const v = videoRef.current;
    v.srcObject = streamRef.current;
    v.play().catch(() => {});
    return () => { v.srcObject = null; };
  }, [streaming]);

  // Pastikan stream dihentikan saat komponen di-unmount
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
      setErrCam("Kamera belum siap, tunggu sebentar lalu coba lagi.");
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
      <p className="text-xs font-semibold text-slate-700 mb-2">{label}</p>
      {errCam && <p className="text-xs text-red-500 mb-2">{errCam}</p>}
      {streaming ? (
        <div>
          <video ref={videoRef} className="w-full rounded border border-slate-200" style={{ maxHeight: 220 }} playsInline muted />
          <div className="flex gap-2 mt-2 justify-center">
            <button type="button" onClick={takeSnapshot}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-4 py-1.5 rounded-lg transition-colors">
              Ambil Foto
            </button>
            <button type="button" onClick={stopCamera}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-4 py-1.5 rounded-lg transition-colors">
              Batal
            </button>
          </div>
        </div>
      ) : captured ? (
        <div>
          <img src={captured} alt="Foto" className="w-full rounded border border-slate-200" style={{ maxHeight: 220, objectFit: "cover" }} />
          <div className="flex gap-2 mt-2 justify-center">
            <button type="button" onClick={() => { setCaptured(null); onCapture(""); startCamera(); }}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-4 py-1.5 rounded-lg transition-colors">
              Ulang
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg h-40 text-slate-400 text-xs cursor-pointer"
          onClick={startCamera}>
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

// ── Tanda Tangan Canvas ────────────────────────────────────────────────────────
function SignaturePad({ onSave, label = "✍️ Tanda Tangan Digital" }: { onSave: (dataUrl: string) => void; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const c = canvasRef.current; if (!c) return;
    setIsDrawing(true);
    lastPos.current = getPos(e, c);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!isDrawing) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const pos = getPos(e, c);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    lastPos.current = pos;
    setHasSigned(true);
  }

  function endDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    setIsDrawing(false);
    lastPos.current = null;
  }

  function clearPad() {
    const c = canvasRef.current; if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setHasSigned(false);
    onSave("");
  }

  function savePad() {
    const c = canvasRef.current; if (!c) return;
    onSave(c.toDataURL("image/png"));
  }

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <p className="text-xs font-semibold text-slate-700 mb-2">{label}</p>
      <canvas ref={canvasRef} width={400} height={180}
        className="w-full border-2 border-dashed border-blue-300 rounded cursor-crosshair touch-none"
        style={{ height: 180 }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
      <div className="flex gap-2 mt-2 justify-center">
        <button type="button" onClick={clearPad}
          className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-4 py-1.5 rounded-lg transition-colors">
          Hapus
        </button>
        <button type="button" onClick={savePad} disabled={!hasSigned}
          className="bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white text-xs px-4 py-1.5 rounded-lg transition-colors">
          Simpan Tanda Tangan
        </button>
      </div>
    </div>
  );
}

// ── Halaman utama ─────────────────────────────────────────────────────────────
function SuratInner() {
  const params        = useParams();
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const [fotoPJ, setFotoPJ] = useState("");
  const [ttdPJ, setTtdPJ]   = useState("");
  const [fotoSaksi, setFotoSaksi] = useState("");
  const [ttdSaksi, setTtdSaksi]   = useState("");

  function handleFotoCapture(dataUrl: string) {
    setFotoPJ(dataUrl);
    if (dataUrl && form.no_rawat) {
      uploadSuratMedia({ jenis, no_rawat: form.no_rawat, no_surat: form.no_surat || undefined, foto_base64: dataUrl }).catch(() => {});
    }
  }
  function handleFotoSaksiCapture(dataUrl: string) {
    setFotoSaksi(dataUrl);
    if (dataUrl && form.no_rawat) {
      uploadSuratMedia({ jenis, no_rawat: form.no_rawat, no_surat: form.no_surat || undefined, foto_saksi_base64: dataUrl }).catch(() => {});
    }
  }
  async function handleTtdSaksiSave(dataUrl: string) {
    setTtdSaksi(dataUrl);
    if (!dataUrl || !form.no_rawat) return;
    try {
      await uploadSuratMedia({ jenis, no_rawat: form.no_rawat, no_surat: form.no_surat || undefined, ttd_saksi_base64: dataUrl });
      setOkMsg("Tanda tangan saksi tersimpan");
      setTimeout(() => setOkMsg(prev => prev === "Tanda tangan saksi tersimpan" ? "" : prev), 3000);
    } catch { setErrMsg("Gagal menyimpan tanda tangan saksi"); }
  }

  async function handleTtdSave(dataUrl: string) {
    setTtdPJ(dataUrl);
    setErrMsg("");
    if (!dataUrl || !form.no_rawat) return;
    try {
      await uploadSuratMedia({
        jenis,
        no_rawat: form.no_rawat,
        no_surat: form.no_surat || undefined,
        ttd_base64: dataUrl,
      });
      setOkMsg("Tanda tangan tersimpan");
      setTimeout(() => setOkMsg(prev => prev === "Tanda tangan tersimpan" ? "" : prev), 3000);
    } catch {
      setErrMsg("Gagal menyimpan tanda tangan");
    }
  }

  const jenis    = params.jenis as string;
  const no_rawat = decodeURIComponent(searchParams.get("no_rawat") ?? "");

  // isCek: persetujuan_umum → surat_persetujuan_umum; lainnya → surat_pernyataan_pasien_umum
  const permKey  = jenis === "persetujuan_umum" ? "surat_persetujuan_umum" : "surat_pernyataan_pasien_umum";
  const aksesOk  = hasPerm(permKey);

  const [form, setForm]       = useState<FormState>({ ...initForm, no_rawat });
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [okMsg, setOkMsg]     = useState("");
  const [setting, setSetting] = useState<SettingRS | null>(null);
  const [penjabList, setPenjabList] = useState<{ kd_pj: string; png_jawab: string }[]>([]);

  useEffect(() => {
    getSetting().then(r => setSetting(r.data)).catch(() => {});
    getPenjabList().then(r => {
      const arr = (r.data || []).map((p: { kd_pj: string; png_jawab: string }) =>
        ({ kd_pj: p.kd_pj, png_jawab: p.png_jawab }));
      setPenjabList(arr);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const sess = getSession();
    if (!sess) return;
    setForm((prev) => ({
      ...prev,
      nip_petugas:  prev.nip_petugas  || sess.kode || "",
      nama_petugas: prev.nama_petugas || sess.nama || "",
    }));
  }, []);

  useEffect(() => {
    if (jenis !== "persetujuan_umum" || !no_rawat) return;
    getPersetujuanSatusehat(no_rawat)
      .then(r => {
        const d = r.data?.data;
        if (d?.persetujuan) {
          setForm((prev) => ({ ...prev, persetujuan_satu_sehat: d.persetujuan }));
        }
      })
      .catch(() => {});
  }, [jenis, no_rawat]);

  // Prefill dari surat_persetujuan_umum (+ _tambahan) kalau sudah pernah diisi
  useEffect(() => {
    if (jenis !== "persetujuan_umum" || !no_rawat) return;
    getPersetujuanUmum(no_rawat)
      .then(r => {
        const d = r.data?.data;
        if (!d) return;
        setForm((prev) => ({
          ...prev,
          no_surat:        d.no_surat ?? prev.no_surat,
          tanggal:         d.tanggal  ?? prev.tanggal,
          jam:             d.jam      ?? prev.jam,
          bertindak_atas:  d.bertindak_atas ?? prev.bertindak_atas,
          nama_pj:         prev.nama_pj || (d.nama_pj  ?? ""),
          umur_pj:         prev.umur_pj || (d.umur_pj  ?? ""),
          no_ktp_pj:       prev.no_ktp_pj || (d.no_ktppj ?? ""),
          jk_pj:           prev.jk_pj   || (d.jkpj === "P" ? "Perempuan" : d.jkpj === "L" ? "Laki-laki" : ""),
          no_tlp_pj:       prev.no_tlp_pj || (d.no_telp ?? ""),
          nip_petugas:     prev.nip_petugas  || (d.nip ?? ""),
          // tambahan
          nama_keluarga_a:           d.nama_keluarga_a       ?? prev.nama_keluarga_a,
          hubungan_pasien_a:         d.hubungan_pasien_a     ?? prev.hubungan_pasien_a,
          nama_keluarga_b:           d.nama_keluarga_b       ?? prev.nama_keluarga_b,
          hubungan_pasien_b:         d.hubungan_pasien_b     ?? prev.hubungan_pasien_b,
          nama_keluarga_c:           d.nama_keluarga_c       ?? prev.nama_keluarga_c,
          hubungan_pasien_c:         d.hubungan_pasien_c     ?? prev.hubungan_pasien_c,
          hubungan_keluarga_a:       d.hubungan_keluarga_a   ?? prev.hubungan_keluarga_a,
          detail_hubungan_a:         d.detail_hubungan_a     ?? prev.detail_hubungan_a,
          hubungan_keluarga_b:       d.hubungan_keluarga_b   ?? prev.hubungan_keluarga_b,
          detail_hubungan_b:         d.detail_hubungan_b     ?? prev.detail_hubungan_b,
          hubungan_keluarga_c:       d.hubungan_keluarga_c   ?? prev.hubungan_keluarga_c,
          detail_hubungan_c:         d.detail_hubungan_c     ?? prev.detail_hubungan_c,
          pilihan_akses_kunjungan:   d.pilihan_akses_kunjungan ?? prev.pilihan_akses_kunjungan,
          nama_tidak_diizinkan:      d.nama_tidak_diizinkan  ?? prev.nama_tidak_diizinkan,
          preferensi_perawat:        d.preferensi_perawat ?? prev.preferensi_perawat,
          preferensi_dokter:         d.preferensi_dokter  ?? prev.preferensi_dokter,
          nilai_keyakinan:           d.nilai_keyakinan    ?? prev.nilai_keyakinan,
          permintaan_privasi:        d.permintaan_privasi ?? prev.permintaan_privasi,
          nilai_kepercayaan:         d.nilai_kepercayaan  ?? prev.nilai_kepercayaan,
          saksi_pasien:              d.saksi_pasien       ?? prev.saksi_pasien,
          pelayanan_rohani:          d.pelayanan_rohani   ?? prev.pelayanan_rohani,
          pilihan_lepas_info:        d.pelepasan_informasi ?? prev.pilihan_lepas_info,
          kelas_perawatan:           d.kelas_perawatan       ?? prev.kelas_perawatan,
          biaya_perkiraan_tindakan:  d.biaya_perkiraan_tindakan ?? prev.biaya_perkiraan_tindakan,
          biaya_administrasi:        d.biaya_administrasi    ?? prev.biaya_administrasi,
          biaya_pemeriksaan_penunjang: d.biaya_pemeriksaan_penunjang ?? prev.biaya_pemeriksaan_penunjang,
          biaya_farmasi:             d.biaya_farmasi         ?? prev.biaya_farmasi,
          biaya_lain_lain:           d.biaya_lain_lain       ?? prev.biaya_lain_lain,
        }));
      })
      .catch(() => {});
  }, [jenis, no_rawat]);

  // Prefill hak_kewajiban dari DB Khanza
  useEffect(() => {
    if (jenis !== "hak_kewajiban" || !no_rawat) return;
    getHakKewajiban(no_rawat)
      .then(r => {
        const d = r.data?.data;
        if (!d) return;
        setForm((prev) => ({
          ...prev,
          no_surat:        d.no_surat ?? prev.no_surat,
          tanggal:         d.tanggal  ?? prev.tanggal,
          jam:             d.jam      ?? prev.jam,
          pengobatan_kepada: d.pengobatan_kepada ?? prev.pengobatan_kepada,
          bertindak_atas:  d.bertindak_atas ?? prev.bertindak_atas,
          nama_pj:         prev.nama_pj   || (d.nama_pj  ?? ""),
          umur_pj:         prev.umur_pj   || (d.umur_pj  ?? ""),
          no_ktp_pj:       prev.no_ktp_pj || (d.no_ktppj ?? ""),
          jk_pj:           prev.jk_pj     || (d.jkpj === "P" ? "Perempuan" : d.jkpj === "L" ? "Laki-laki" : ""),
          no_tlp_pj:       prev.no_tlp_pj || (d.no_telp ?? ""),
          nip_petugas:     prev.nip_petugas  || (d.nip ?? ""),
        }));
      })
      .catch(() => {});
  }, [jenis, no_rawat]);

  // Prefill jaminan_pasien dari DB Khanza
  useEffect(() => {
    if (jenis !== "jaminan_pasien" || !no_rawat) return;
    getPernyataanJaminan(no_rawat)
      .then(r => {
        const d = r.data?.data;
        if (!d) return;
        setForm((prev) => ({
          ...prev,
          no_surat:       d.no_surat ?? prev.no_surat,
          tanggal:        d.tanggal  ?? prev.tanggal,
          nama_pj:        prev.nama_pj   || (d.nama_pj  ?? ""),
          no_ktp_pj:      prev.no_ktp_pj || (d.no_ktppj ?? ""),
          tmp_lahir_pj:   prev.tmp_lahir_pj || (d.tempat_lahirpj ?? ""),
          tgl_lahir_pj:   prev.tgl_lahir_pj || (d.lahirpj ?? ""),
          jk_pj:          prev.jk_pj   || (d.jkpj === "P" ? "Perempuan" : d.jkpj === "L" ? "Laki-laki" : ""),
          alamat_pj:      prev.alamat_pj || (d.alamatpj ?? ""),
          hub_pj:         prev.hub_pj  || (d.hubungan ?? ""),
          no_tlp_pj:      prev.no_tlp_pj || (d.no_telp ?? ""),
          nip_petugas:    prev.nip_petugas || (d.nip ?? ""),
          kd_pj:          d.kd_pj    ?? prev.kd_pj,
          penyakit:       d.penyakit_diderita ?? prev.penyakit,
        }));
      })
      .catch(() => {});
  }, [jenis, no_rawat]);

  // Prefill surat pernyataan generik (7 jenis) dari data JSON tersimpan
  useEffect(() => {
    if (!GENERIC_JENIS.has(jenis) || !no_rawat) return;
    getSuratPernyataan(no_rawat, jenis)
      .then(r => {
        if (!r.data?.data) return;
        let saved: Partial<FormState> = {};
        try { saved = JSON.parse(r.data.data) as Partial<FormState>; } catch { return; }
        setForm((prev) => ({
          ...prev, ...saved,
          no_rawat,
          no_surat: r.data.no_surat ?? saved.no_surat ?? prev.no_surat,
          tanggal:  r.data.tanggal  ?? saved.tanggal  ?? prev.tanggal,
        }));
      })
      .catch(() => {});
  }, [jenis, no_rawat]);

  // Inject print CSS
  useEffect(() => {
    const id = "surat-print-style";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `@media print{body *{visibility:hidden}#print-area,#print-area *{visibility:visible}#print-area{position:absolute;left:0;top:0;width:100%}.no-print{display:none!important}}`;
    document.head.appendChild(el);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  const setF = useCallback((k: keyof FormState, v: string) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  }, []);

  // Cetak: dokumen sudah dirender lengkap + print CSS → cukup window.print.
  const handleCetak = () => window.print();

  // Simpan generik (7 jenis): kirim seluruh FormState sebagai JSON.
  const handleSimpanPernyataan = async () => {
    setErrMsg(""); setOkMsg("");
    if (!form.no_rawat) { setErrMsg("No. rawat tidak ada"); return; }
    setSaving(true);
    try {
      const r = await simpanSuratPernyataan({
        no_rawat: form.no_rawat,
        jenis,
        tanggal:  form.tanggal || undefined,
        no_surat: form.no_surat || undefined,
        data:     JSON.stringify(form),
      });
      if (r.data?.no_surat) setForm(prev => ({ ...prev, no_surat: r.data.no_surat }));
      setOkMsg(`Surat tersimpan${r.data?.no_surat ? ` (No. ${r.data.no_surat})` : ""}.`);
      setTimeout(() => setOkMsg(""), 5000);
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setErrMsg(err.response?.data?.error ?? "Gagal menyimpan surat");
    } finally { setSaving(false); }
  };

  useEffect(() => {
    if (!no_rawat) { setLoading(false); return; }

    getRegistrasiDetail(no_rawat)
      .then(async (r) => {
        const reg = r.data;
        const no_rm = reg.no_rm;
        let umur = "";
        let tgl_lahir = "";
        let jkPasien = "";
        let nm_pj = "";
        let hub_pj = "";
        let alamat_pj = "";
        let no_tlp_pj = "";
        let kd_pj = "";
        let nm_dokter = reg.nm_dokter ?? "";

        try {
          const pd = await getPasienDetail(no_rm);
          const p: PasienDetail = pd.data;
          umur      = hitungUmur(p.tgl_lahir);
          tgl_lahir = p.tgl_lahir ?? "";
          jkPasien  = p.jk ?? "";
          nm_pj     = p.nama_pj ?? "";
          hub_pj    = p.hub_pj ?? "";
          kd_pj     = p.kd_pj ?? "";
          no_tlp_pj = p.no_tlp ?? "";
          const parts = [p.alamat, p.nm_kel, p.nm_kec, p.nm_kab].filter(Boolean);
          alamat_pj = parts.join(", ");
        } catch { /* ignore */ }

        setForm((prev) => ({
          ...prev,
          no_rm,
          no_rawat,
          nm_pasien: reg.nm_pasien ?? "",
          jk:        jkPasien || prev.jk,
          tgl_lahir,
          umur,
          nama_pj:   nm_pj,
          hub_pj:    hub_pj || "Pasien Sendiri",
          alamat_pj,
          no_tlp_pj,
          kd_pj,
          jenis_bayar: kd_pj,
          nm_dokter,
        }));
      })
      .catch(() => setErrMsg("Gagal memuat data registrasi"))
      .finally(() => setLoading(false));
  }, [no_rawat]);

  const judul   = JUDUL[jenis] ?? "SURAT KETERANGAN";
  const namaRS  = setting?.nama_instansi  || "Rumah Sakit";
  const kabRS   = setting?.kabupaten      ? `PEMERINTAH ${setting.kabupaten.toUpperCase().replace(/\bKAB\.?\b/g, "KABUPATEN")}` : "";
  const alamatRS = [
    setting?.alamat_instansi,
    setting?.kontak ? `Telp. ${setting.kontak}` : undefined,
  ].filter(Boolean).join(" — ") || "";

  // Simpan persetujuan umum + persetujuan SATUSEHAT ke DB
  const handleSimpan = async () => {
    setErrMsg(""); setOkMsg("");
    if (jenis !== "persetujuan_umum" || !form.no_rawat) {
      setErrMsg("Hanya tersedia untuk persetujuan umum");
      return;
    }
    if (!form.nama_pj.trim() && !form.nm_pasien.trim()) {
      setErrMsg("Nama Penanggung Jawab atau Nama Pasien wajib diisi");
      return;
    }
    if (!form.no_ktp_pj.trim()) {
      setErrMsg("No. KTP Penanggung Jawab wajib diisi");
      return;
    }
    if (!form.nip_petugas.trim()) {
      setErrMsg("NIP Petugas wajib diisi (cek session login)");
      return;
    }

    setSaving(true);
    try {
      const jkpj1 = (form.jk_pj || "L").trim().charAt(0).toUpperCase();
      const r = await simpanPersetujuanUmum({
        no_surat:        form.no_surat || undefined,
        no_rawat:        form.no_rawat,
        tanggal:         form.tanggal || undefined,
        jam:             form.jam || undefined,
        bertindak_atas:  form.bertindak_atas || "-",
        nama_pj:         form.nama_pj   || form.nm_pasien,
        umur_pj:         (form.umur_pj  || form.umur || "").slice(0, 7),
        no_ktppj:        form.no_ktp_pj,
        jkpj:            jkpj1 === "P" ? "P" : "L",
        no_telp:         form.no_tlp_pj || "",
        nip:             form.nip_petugas,
        nama_keluarga_a:     form.nama_keluarga_a       || undefined,
        hubungan_pasien_a:   form.hubungan_pasien_a     || undefined,
        nama_keluarga_b:     form.nama_keluarga_b       || undefined,
        hubungan_pasien_b:   form.hubungan_pasien_b     || undefined,
        nama_keluarga_c:     form.nama_keluarga_c       || undefined,
        hubungan_pasien_c:   form.hubungan_pasien_c     || undefined,
        hubungan_keluarga_a: form.hubungan_keluarga_a   || undefined,
        detail_hubungan_a:   form.detail_hubungan_a     || undefined,
        hubungan_keluarga_b: form.hubungan_keluarga_b   || undefined,
        detail_hubungan_b:   form.detail_hubungan_b     || undefined,
        hubungan_keluarga_c: form.hubungan_keluarga_c   || undefined,
        detail_hubungan_c:   form.detail_hubungan_c     || undefined,
        pilihan_akses_kunjungan:  form.pilihan_akses_kunjungan || undefined,
        nama_tidak_diizinkan:     form.nama_tidak_diizinkan    || undefined,
        preferensi_perawat:       form.preferensi_perawat || undefined,
        preferensi_dokter:        form.preferensi_dokter  || undefined,
        nilai_keyakinan:          form.nilai_keyakinan    || undefined,
        permintaan_privasi:       form.permintaan_privasi || undefined,
        nilai_kepercayaan:        form.nilai_kepercayaan  || undefined,
        saksi_pasien:             form.saksi_pasien       || undefined,
        pelayanan_rohani:         form.pelayanan_rohani   || undefined,
        pelepasan_informasi:      form.pilihan_lepas_info || undefined,
        kelas_perawatan:          form.kelas_perawatan         || undefined,
        biaya_perkiraan_tindakan: form.biaya_perkiraan_tindakan || undefined,
        biaya_administrasi:       form.biaya_administrasi      || undefined,
        biaya_pemeriksaan_penunjang: form.biaya_pemeriksaan_penunjang || undefined,
        biaya_farmasi:            form.biaya_farmasi           || undefined,
        biaya_lain_lain:          form.biaya_lain_lain         || undefined,
      });
      const noSurat = r.data?.no_surat || form.no_surat;
      if (r.data?.no_surat) {
        setForm(prev => ({ ...prev, no_surat: r.data.no_surat }));
      }

      // Re-link foto & TTD ke DB (kalau user ambil foto SEBELUM Simpan,
      // no_surat masih kosong saat pertama kali upload sehingga path tidak
      // tersambung ke surat_persetujuan_umum_pembuat_pernyataan / _tambahan).
      // AWAIT supaya pratinjau cetak setelah ini sudah melihat path-nya di DB.
      if (noSurat && (fotoPJ || ttdPJ)) {
        const uploads: Promise<unknown>[] = [];
        if (fotoPJ) uploads.push(uploadSuratMedia({ jenis, no_rawat: form.no_rawat, no_surat: noSurat, foto_base64: fotoPJ }));
        if (ttdPJ)  uploads.push(uploadSuratMedia({ jenis, no_rawat: form.no_rawat, no_surat: noSurat, ttd_base64: ttdPJ }));
        await Promise.allSettled(uploads);
      }

      // Persetujuan SATUSEHAT — best effort, jangan blok kalau gagal
      const p = form.persetujuan_satu_sehat === "Tidak Setuju" ? "Tidak Setuju" : "Setuju";
      simpanPersetujuanSatusehat({
        no_rawat:     form.no_rawat,
        persetujuan:  p,
        nip_petugas:  form.nip_petugas,
        nama_petugas: form.nama_petugas,
      }).catch(() => {});

      setSaving(false);
      setOkMsg(`Persetujuan umum tersimpan${noSurat ? ` (No. Surat: ${noSurat})` : ""} — membuka pratinjau cetak…`);
      setTimeout(() => setOkMsg(""), 6000);
      // Buka HTML pratinjau (data ambil ulang dari DB → bukti benar2 tersimpan)
      try {
        await cetakPersetujuanUmum(form.no_rawat);
      } catch (e) {
        // tab popup mungkin diblokir; tampilkan link cadangan
        const token = typeof window !== "undefined" ? localStorage.getItem("simrscb_token") : null;
        if (token) {
          setOkMsg(prev => prev + " — popup diblokir, simpan tetap berhasil.");
        }
      }
    } catch (e: unknown) {
      setSaving(false);
      const ax = e as { response?: { data?: { error?: string } } };
      const msg = ax.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal menyimpan persetujuan umum");
      setErrMsg(msg);
    }
  };

  // Simpan Surat Pernyataan Jaminan Pasien — multi-tabel + buka pratinjau
  const handleSimpanJaminan = async () => {
    setErrMsg(""); setOkMsg("");
    if (jenis !== "jaminan_pasien" || !form.no_rawat) {
      setErrMsg("Hanya tersedia untuk surat pernyataan jaminan");
      return;
    }
    if (!form.nama_pj.trim()) {
      setErrMsg("Nama Penanggung Jawab wajib diisi");
      return;
    }
    if (!form.kd_pj.trim()) {
      setErrMsg("Cara Bayar wajib dipilih");
      return;
    }
    if (!form.nip_petugas.trim()) {
      setErrMsg("NIP Petugas wajib diisi (cek session login)");
      return;
    }

    setSaving(true);
    try {
      const jkpj1 = (form.jk_pj || "L").trim().charAt(0).toUpperCase();
      const r = await simpanPernyataanJaminan({
        no_surat:          form.no_surat || undefined,
        no_rawat:          form.no_rawat,
        tanggal:           form.tanggal || undefined,
        nama_pj:           form.nama_pj,
        no_ktppj:          form.no_ktp_pj || "",
        tempat_lahirpj:    form.tmp_lahir_pj || "",
        lahirpj:           form.tgl_lahir_pj || "1970-01-01",
        jkpj:              jkpj1 === "P" ? "P" : "L",
        alamatpj:          form.alamat_pj || "",
        hubungan:          form.hub_pj || "Saudara",
        no_telp:           form.no_tlp_pj || "",
        nip:               form.nip_petugas,
        kd_pj:             form.kd_pj,
        penyakit_diderita: form.penyakit || undefined,
      });
      const noSurat = r.data?.no_surat || form.no_surat;
      if (r.data?.no_surat) {
        setForm(prev => ({ ...prev, no_surat: r.data.no_surat }));
      }

      // Re-link foto & TTD ke DB (sama pola dgn persetujuan_umum & hak_kewajiban)
      if (noSurat && (fotoPJ || ttdPJ)) {
        const uploads: Promise<unknown>[] = [];
        if (fotoPJ) uploads.push(uploadSuratMedia({ jenis, no_rawat: form.no_rawat, no_surat: noSurat, foto_base64: fotoPJ }));
        if (ttdPJ)  uploads.push(uploadSuratMedia({ jenis, no_rawat: form.no_rawat, no_surat: noSurat, ttd_base64: ttdPJ }));
        await Promise.allSettled(uploads);
      }

      setSaving(false);
      setOkMsg(`Surat pernyataan jaminan tersimpan${noSurat ? ` (No. Surat: ${noSurat})` : ""} — membuka pratinjau cetak…`);
      setTimeout(() => setOkMsg(""), 6000);
      try {
        await cetakPernyataanJaminan(form.no_rawat);
      } catch {
        setOkMsg(prev => prev + " — popup mungkin diblokir, simpan tetap berhasil.");
      }
    } catch (e: unknown) {
      setSaving(false);
      const ax = e as { response?: { data?: { error?: string } } };
      const msg = ax.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal menyimpan surat pernyataan jaminan");
      setErrMsg(msg);
    }
  };

  // Simpan Hak & Kewajiban Pasien + buka pratinjau cetak
  const handleSimpanHakKewajiban = async () => {
    setErrMsg(""); setOkMsg("");
    if (jenis !== "hak_kewajiban" || !form.no_rawat) {
      setErrMsg("Hanya tersedia untuk hak_kewajiban");
      return;
    }
    if (!form.nama_pj.trim() && !form.nm_pasien.trim()) {
      setErrMsg("Nama Penanggung Jawab atau Nama Pasien wajib diisi");
      return;
    }
    if (!form.nip_petugas.trim()) {
      setErrMsg("NIP Petugas wajib (cek session login)");
      return;
    }

    setSaving(true);
    try {
      const jkpj1 = (form.jk_pj || "L").trim().charAt(0).toUpperCase();
      const r = await simpanHakKewajiban({
        no_surat:        form.no_surat || undefined,
        no_rawat:        form.no_rawat,
        tanggal:         form.tanggal || undefined,
        jam:             form.jam || undefined,
        pengobatan_kepada: form.pengobatan_kepada || "-",
        nama_pj:         form.nama_pj   || form.nm_pasien,
        umur_pj:         (form.umur_pj  || form.umur || "").slice(0, 7),
        no_ktppj:        form.no_ktp_pj || "",
        jkpj:            jkpj1 === "P" ? "P" : "L",
        bertindak_atas:  form.bertindak_atas || "Diri Sendiri",
        no_telp:         form.no_tlp_pj || "",
        nip:             form.nip_petugas,
      });
      const noSurat = r.data?.no_surat || form.no_surat;
      if (r.data?.no_surat) {
        setForm(prev => ({ ...prev, no_surat: r.data.no_surat }));
      }

      // Re-link foto & TTD ke DB (sama seperti persetujuan_umum)
      if (noSurat && (fotoPJ || ttdPJ)) {
        const uploads: Promise<unknown>[] = [];
        if (fotoPJ) uploads.push(uploadSuratMedia({ jenis, no_rawat: form.no_rawat, no_surat: noSurat, foto_base64: fotoPJ }));
        if (ttdPJ)  uploads.push(uploadSuratMedia({ jenis, no_rawat: form.no_rawat, no_surat: noSurat, ttd_base64: ttdPJ }));
        await Promise.allSettled(uploads);
      }

      setSaving(false);
      setOkMsg(`Hak & Kewajiban tersimpan${noSurat ? ` (No. Surat: ${noSurat})` : ""} — membuka pratinjau cetak…`);
      setTimeout(() => setOkMsg(""), 6000);
      try { await cetakHakKewajiban(form.no_rawat); }
      catch { setOkMsg(prev => prev + " — popup mungkin diblokir, simpan tetap berhasil."); }
    } catch (e: unknown) {
      setSaving(false);
      const ax = e as { response?: { data?: { error?: string } } };
      const msg = ax.response?.data?.error ?? (e instanceof Error ? e.message : "Gagal menyimpan hak & kewajiban");
      setErrMsg(msg);
    }
  };

  if (!aksesOk) return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
      <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <p className="text-base font-semibold text-slate-700">Tidak Ada Akses</p>
      <p className="text-sm text-slate-500">Anda tidak memiliki hak akses untuk formulir ini.</p>
    </div>
  );

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-500 text-sm py-20 justify-center">
      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Memuat data...
    </div>
  );

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 no-print">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-bold text-slate-700">{judul}</h1>
      </div>

      {errMsg && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm no-print">
          {errMsg}
        </div>
      )}

      {okMsg && (
        <div className="mb-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-green-800 text-sm no-print flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{okMsg}</span>
        </div>
      )}

      {/* Dokumen */}
      <div
        id="print-area"
        className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 print:p-6 print:shadow-none print:border-0 print:rounded-none"
      >
        {/* Kop Surat */}
        <div className="border-b-2 border-slate-800 pb-3 mb-5 flex items-center gap-4">
          {/* Logo kiri — lambang daerah */}
          <img
            src="/logo-daerah.png"
            alt="Logo Daerah"
            className="h-16 w-16 aspect-square object-contain shrink-0 print:h-14 print:w-14"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          {/* Teks kop — tengah */}
          <div className="flex-1 text-center">
            {kabRS && <p className="text-sm font-bold uppercase tracking-wide">{kabRS}</p>}
            <p className="text-xl font-extrabold uppercase">{namaRS}</p>
            {alamatRS && <p className="text-xs text-slate-600">{alamatRS}</p>}
            <p className="text-base font-bold mt-2 uppercase tracking-widest">{judul}</p>
          </div>
          {/* Logo kanan — logo RS */}
          <img
            src="/logo-rs.png"
            alt="Logo RS"
            className="h-16 w-16 aspect-square object-contain shrink-0 print:h-14 print:w-14"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        {/* Identitas Pasien */}
        <div className="mb-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 border-b border-slate-100 pb-1">
            Data Pasien
          </p>
          <SeksiPasien f={form} s={setF} showJam={jenis === "persetujuan_umum" || jenis === "hak_kewajiban"} />
        </div>

        {/* PJ — tidak ditampilkan untuk persetujuan_penolakan (punya section sendiri) */}
        {jenis !== "persetujuan_penolakan" && (
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 border-b border-slate-100 pb-1">
              Penanggung Jawab
            </p>
            <SeksiPJ f={form} s={setF} />
          </div>
        )}

        {/* Isi Khusus */}
        <div className="mb-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 border-b border-slate-100 pb-1">
            Isi Pernyataan
          </p>
          <KontenKhusus jenis={jenis} f={form} s={setF} namaRS={namaRS} penjabList={penjabList} />
        </div>

        {/* Petugas */}
        <div className="mb-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 border-b border-slate-100 pb-1">
            Petugas Pendamping
          </p>
          <SeksiPetugas f={form} s={setF} />
        </div>

        {/* Tanda Tangan */}
        <div className="mt-8">
          <p className="text-xs text-slate-500 text-right mb-4">
            Bekasi, {fmtTgl(form.tanggal) || todayFmt()}
          </p>
          <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 border-b border-slate-100 pb-1 no-print">
                Foto &amp; Tanda Tangan Digital
              </p>
              <div className="grid grid-cols-2 gap-4 no-print mb-6">
                <KameraCapture onCapture={handleFotoCapture} />
                <SignaturePad onSave={handleTtdSave} />
              </div>
              {jenis === "persetujuan_umum" && (
                <div className="no-print mb-6 border-t border-slate-100 pt-4">
                  <div className="mb-2 max-w-sm">
                    <Row label="Nama Saksi Pasien">
                      <Inp value={form.saksi_pasien} onChange={(v) => setForm(prev => ({ ...prev, saksi_pasien: v }))} placeholder="Nama saksi dari pihak pasien" />
                    </Row>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <KameraCapture onCapture={handleFotoSaksiCapture} label="📷 Foto Saksi Pasien" />
                    <SignaturePad onSave={handleTtdSaksiSave} label="✍️ Tanda Tangan Saksi Pasien" />
                  </div>
                </div>
              )}
              <div className={`flex justify-around mt-2 ${jenis === "persetujuan_penolakan" ? "justify-between" : ""}`}>
                <div className="text-center">
                  {fotoPJ
                    ? <img src={fotoPJ} alt="Foto PJ" className="w-24 h-24 object-cover rounded border mx-auto mb-1" />
                    : <div className="border border-dashed border-slate-300 rounded h-20 w-24 mx-auto mb-1" />}
                  <TandaTangan label="Yang Menyatakan" nama={form.nama_pj || form.nm_pasien} />
                  {(jenis === "persetujuan_umum" || jenis === "hak_kewajiban") && form.jam && (
                    <p className="text-xs text-slate-600 mt-0.5">Jam: {form.jam}</p>
                  )}
                </div>
                {jenis === "persetujuan_umum" && (
                  <div className="text-center">
                    {fotoSaksi
                      ? <img src={fotoSaksi} alt="Foto Saksi" className="w-24 h-24 object-cover rounded border mx-auto mb-1" />
                      : <div className="border border-dashed border-slate-300 rounded h-20 w-24 mx-auto mb-1" />}
                    <TandaTangan label="Saksi Pasien" nama={form.saksi_pasien} />
                  </div>
                )}
                <TandaTanganQR label="Petugas RS" nip={form.nip_petugas} nama={form.nama_petugas} tanggal={form.tanggal} />
                {(jenis === "bersedia_igd" || jenis === "pulang_aps") && (
                  <TandaTangan label="Saksi Keluarga" nama={form.saksi_keluarga} />
                )}
                {jenis === "persetujuan_penolakan" && (
                  <>
                    <TandaTangan label="Saksi Perawat" nama={form.saksi_perawat} />
                    <TandaTangan label="Saksi Keluarga" nama={form.saksi_keluarga} />
                  </>
                )}
              </div>
            </div>
        </div>
      </div>

      {/* Tombol Simpan — persetujuan_umum, jaminan_pasien, hak_kewajiban, hidden saat cetak */}
      {(jenis === "persetujuan_umum" || jenis === "jaminan_pasien" || jenis === "hak_kewajiban") && (
        <div className="mt-5 flex justify-end no-print">
          <button
            onClick={jenis === "jaminan_pasien" ? handleSimpanJaminan
                   : jenis === "hak_kewajiban"  ? handleSimpanHakKewajiban
                   : handleSimpan}
            disabled={saving}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:bg-slate-400
                       disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5
                       rounded-xl shadow-sm transition-colors"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Menyimpan...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 13l4 4L19 7" />
                </svg>
                Simpan
              </>
            )}
          </button>
        </div>
      )}

      {/* Tombol Simpan + Cetak — 7 surat generik, hidden saat cetak */}
      {GENERIC_JENIS.has(jenis) && (
        <div className="mt-5 flex justify-end gap-3 no-print">
          <button
            onClick={handleCetak}
            className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-700
                       text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 001 1zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Cetak
          </button>
          <button
            onClick={handleSimpanPernyataan}
            disabled={saving}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:bg-slate-400
                       disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5
                       rounded-xl shadow-sm transition-colors"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Menyimpan...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Simpan
              </>
            )}
          </button>
        </div>
      )}

    </div>
  );
}

export default function SuratPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center gap-2 text-slate-500 text-sm py-20 justify-center">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Memuat...
      </div>
    }>
      <SuratInner />
    </Suspense>
  );
}
