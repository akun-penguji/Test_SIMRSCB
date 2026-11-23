"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getPasienList, getPasienDetail, getPoliList, getDokterList, getPenjabList, buatRegistrasi,
  Pasien, Poli, Dokter, Penjab,
} from "@/lib/api";
import { hasPerm } from "@/lib/auth";

function todayStr() {
  return new Date().toLocaleDateString("en-CA");
}

function formatTgl(val: string) {
  if (!val) return "";
  const p = val.split("-");
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : val;
}

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className="relative flex items-center border border-slate-300 rounded-xl bg-white cursor-pointer h-10"
      onClick={() => ref.current?.showPicker?.()}
    >
      <svg className="w-4 h-4 text-slate-400 ml-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className="px-3 text-sm text-slate-700 select-none">{formatTgl(value) || "Pilih tanggal"}</span>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full cursor-pointer"
        tabIndex={-1}
      />
    </div>
  );
}

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value ? value.split(":") : ["", "", ""];
  const jam = parts[0] ?? "";
  const menit = parts[1] ?? "";
  const detik = parts[2] ?? "";

  function update(j: string, m: string, d: string) {
    if (!j && !m && !d) { onChange(""); return; }
    onChange(`${j.padStart(2, "0")}:${m.padStart(2, "0")}:${d.padStart(2, "0")}`);
  }

  const selectCls = "border border-slate-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white";

  return (
    <div className="flex items-center gap-1.5">
      <select value={jam} onChange={(e) => update(e.target.value, menit, detik)} className={selectCls + " w-16"}>
        <option value="">Jam</option>
        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-slate-400 font-bold">:</span>
      <select value={menit} onChange={(e) => update(jam, e.target.value, detik)} className={selectCls + " w-16"}>
        <option value="">Menit</option>
        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <span className="text-slate-400 font-bold">:</span>
      <select value={detik} onChange={(e) => update(jam, menit, e.target.value)} className={selectCls + " w-16"}>
        <option value="">Detik</option>
        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{children}</label>;
}

function inputCls(hasErr?: boolean) {
  return `w-full border ${hasErr ? "border-red-400 bg-red-50" : "border-slate-300"} rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent`;
}

export default function RegistrasiBaruPage() {
  const router = useRouter();
  const [canAccess, setCanAccess] = useState<boolean | null>(null);

  // Pasien
  const [searchPasien, setSearchPasien] = useState("");
  const [searchAlamat, setSearchAlamat] = useState("");
  const [pasienList, setPasienList] = useState<Pasien[]>([]);
  const [selectedPasien, setSelectedPasien] = useState<Pasien | null>(null);
  const [searchingPasien, setSearchingPasien] = useState(false);

  // Master data
  const [poliList, setPoliList] = useState<Poli[]>([]);
  const [dokterList, setDokterList] = useState<Dokter[]>([]);
  const [penjabList, setPenjabList] = useState<Penjab[]>([]);

  // Form
  const [form, setForm] = useState({
    tgl_registrasi: todayStr(),
    jam_reg: "",
    kd_poli: "",
    kd_dokter: "",
    stts_daftar: "Baru" as "Baru" | "Lama",
    kd_pj: "",
    p_jawab: "",
    almt_pj: "",
    hubunganpj: "",
  });

  const [jamOtomatis, setJamOtomatis] = useState(true);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check akses
  useEffect(() => {
    setCanAccess(hasPerm("registrasi"));
  }, []);

  // Load master data
  useEffect(() => {
    getPoliList().then((r) => setPoliList(r.data)).catch(() => {});
    getPenjabList().then((r) => setPenjabList(r.data)).catch(() => {});
  }, []);

  // Load dokter when poli changes
  useEffect(() => {
    if (form.kd_poli) {
      getDokterList(form.kd_poli).then((r) => setDokterList(r.data)).catch(() => {});
    } else {
      setDokterList([]);
    }
    setForm((f) => ({ ...f, kd_dokter: "" }));
  }, [form.kd_poli]);

  const handleSearchPasien = useCallback(async () => {
    if (!searchPasien.trim() && !searchAlamat.trim()) return;
    setSearchingPasien(true);
    try {
      const res = await getPasienList(searchPasien, 1, 10, searchAlamat);
      setPasienList(res.data.data);
    } catch {
      setPasienList([]);
    } finally {
      setSearchingPasien(false);
    }
  }, [searchPasien, searchAlamat]);

  async function handlePilihPasien(p: Pasien) {
    setSelectedPasien(p);
    setPasienList([]);
    setFieldErr((e) => ({ ...e, pasien: "" }));

    try {
      const detail = (await getPasienDetail(p.no_rm)).data;

      // Status Daftar: Baru jika tgl_daftar = hari ini, Lama jika sebelumnya
      if (detail.tgl_daftar) {
        const tglDaftar = detail.tgl_daftar.split("T")[0];
        const stts = tglDaftar === todayStr() ? "Baru" : "Lama";
        setForm((f) => ({ ...f, stts_daftar: stts }));
      }

      // Jaminan dari data pasien
      if (detail.kd_pj) {
        setForm((f) => ({ ...f, kd_pj: detail.kd_pj! }));
      }

      // Nama & hubungan PJ
      const namaPj = detail.nama_pj ?? "";
      const hubPj  = detail.hub_pj  ?? "";

      // Alamat PJ = alamat + kelurahan + kecamatan + kabupaten pasien
      const bagianAlamat = [detail.alamat, detail.nm_kel, detail.nm_kec, detail.nm_kab]
        .filter(Boolean).join(", ");

      setForm((f) => ({
        ...f,
        p_jawab:    namaPj,
        hubunganpj: hubPj,
        almt_pj:    bagianAlamat,
      }));
    } catch {
      // Gagal fetch detail — biarkan user isi manual
    }
  }

  function setField<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: val }));
    if (fieldErr[key]) setFieldErr((e) => ({ ...e, [key]: "" }));
  }

  function validate() {
    const err: Record<string, string> = {};
    if (!selectedPasien) err.pasien = "Pasien harus dipilih";
    if (!form.kd_poli) err.kd_poli = "Poli harus dipilih";
    if (!form.kd_dokter) err.kd_dokter = "Dokter harus dipilih";
    if (!form.kd_pj) err.kd_pj = "Jaminan harus dipilih";
    if (!form.stts_daftar) err.stts_daftar = "Status daftar harus dipilih";
    setFieldErr(err);
    return Object.keys(err).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setError("");
    setLoading(true);
    try {
      const now = new Date();
      const jamSekarang = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
      const res = await buatRegistrasi({
        no_rm: selectedPasien!.no_rm,
        tgl_registrasi: form.tgl_registrasi,
        jam_reg: jamOtomatis ? jamSekarang : (form.jam_reg || undefined),
        kd_poli: form.kd_poli,
        kd_dokter: form.kd_dokter,
        stts_daftar: form.stts_daftar,
        kd_pj: form.kd_pj,
        p_jawab: form.p_jawab || undefined,
        almt_pj: form.almt_pj || undefined,
        hubunganpj: form.hubunganpj || undefined,
      });
      const noRawat = (res.data as { no_rawat?: string }).no_rawat;
      router.push(`/registrasi?saved=${encodeURIComponent(noRawat ?? "")}`);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal menyimpan registrasi"
      );
    } finally {
      setLoading(false);
    }
  }

  // Loading akses check
  if (canAccess === null) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Memeriksa hak akses...</div>
    );
  }

  // Akses ditolak
  if (!canAccess) {
    return (
      <div className="p-6 max-w-lg">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <h2 className="text-base font-bold text-red-700 mb-1">Akses Ditolak</h2>
          <p className="text-sm text-red-600 mb-4">
            Hak akses Anda tidak mencakup <strong>Registrasi</strong>. Silahkan konfirmasi kepada Admin.
          </p>
          <button
            onClick={() => router.push("/registrasi")}
            className="text-sm text-red-700 underline hover:no-underline"
          >
            ← Kembali ke Daftar Registrasi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-5 lg:p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Kembali
        </button>
        <div className="h-4 w-px bg-slate-300" />
        <div>
          <h1 className="text-lg font-bold text-slate-800">Registrasi Baru</h1>
          <p className="text-xs text-slate-500">Rawat Jalan</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* === SECTION 1: Data Pasien === */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-green-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-sm font-semibold text-white">Data Pasien</span>
          </div>
          <div className="p-3 md:p-5">
            {/* Search pasien */}
            <div className="space-y-2 mb-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    value={searchPasien}
                    onChange={(e) => setSearchPasien(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearchPasien())}
                    placeholder="Nama / No. RM / No. Peserta / No. KTP"
                    className={inputCls(!!fieldErr.pasien)}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchPasien}
                  disabled={searchingPasien}
                  className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 rounded-xl transition-colors disabled:opacity-60 shrink-0"
                >
                  {searchingPasien ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                  Cari
                </button>
              </div>
              <input
                value={searchAlamat}
                onChange={(e) => setSearchAlamat(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearchPasien())}
                placeholder="Alamat"
                className={inputCls()}
              />
            </div>
            {fieldErr.pasien && <p className="text-xs text-red-600 mb-2">{fieldErr.pasien}</p>}

            {/* Selected pasien */}
            {selectedPasien && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-green-800 text-sm">{selectedPasien.nm_pasien}</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    No. RM: {selectedPasien.no_rm}
                    {selectedPasien.tgl_lahir ? ` • ${formatTgl(selectedPasien.tgl_lahir)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedPasien(null); setPasienList([]); }}
                  className="text-green-400 hover:text-green-600 ml-4"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Daftar hasil pencarian */}
            {!selectedPasien && pasienList.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {pasienList.map((p) => (
                  <button
                    type="button"
                    key={p.no_rm}
                    onClick={() => handlePilihPasien(p)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 transition-colors flex justify-between items-start"
                  >
                    <div>
                      <span className="font-medium text-slate-800">{p.nm_pasien}</span>
                      {p.jk && (
                        <span className="ml-2 text-xs text-slate-500">({p.jk})</span>
                      )}
                      {p.alamat && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{p.alamat}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 font-mono shrink-0 ml-2">{p.no_rm}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* === SECTION 2: Data Kunjungan === */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-green-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-sm font-semibold text-white">Data Kunjungan</span>
          </div>
          <div className="p-3 md:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {/* Tanggal */}
            <div>
              <Label>Tanggal Registrasi</Label>
              <DatePicker value={form.tgl_registrasi} onChange={(v) => setField("tgl_registrasi", v)} />
            </div>

            {/* Jam */}
            <div>
              <Label>Jam</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                  <input
                    type="checkbox"
                    checked={jamOtomatis}
                    onChange={(e) => setJamOtomatis(e.target.checked)}
                    className="w-4 h-4 accent-green-700 rounded"
                  />
                  <span className="text-sm text-slate-600">Otomatis (jam saat simpan)</span>
                </label>
                {!jamOtomatis && (
                  <TimePicker value={form.jam_reg} onChange={(v) => setField("jam_reg", v)} />
                )}
              </div>
            </div>

            {/* Status Daftar */}
            <div>
              <Label>Status Daftar</Label>
              <div className="flex gap-2">
                {(["Baru", "Lama"] as const).map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setField("stts_daftar", s)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      form.stts_daftar === s
                        ? "bg-green-700 text-white border-green-700"
                        : "bg-white text-slate-600 border-slate-300 hover:border-green-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Poli */}
            <div>
              <Label>Poliklinik *</Label>
              <select
                value={form.kd_poli}
                onChange={(e) => setField("kd_poli", e.target.value)}
                className={inputCls(!!fieldErr.kd_poli)}
              >
                <option value="">-- Pilih Poli --</option>
                {poliList.map((p) => (
                  <option key={p.kd_poli} value={p.kd_poli}>{p.nm_poli}</option>
                ))}
              </select>
              {fieldErr.kd_poli && <p className="text-xs text-red-600 mt-1">{fieldErr.kd_poli}</p>}
            </div>

            {/* Dokter */}
            <div className="col-span-2">
              <Label>Dokter *</Label>
              <select
                value={form.kd_dokter}
                onChange={(e) => setField("kd_dokter", e.target.value)}
                disabled={!form.kd_poli}
                className={inputCls(!!fieldErr.kd_dokter) + " disabled:bg-slate-50 disabled:text-slate-400"}
              >
                <option value="">-- Pilih Dokter --</option>
                {dokterList.map((d) => (
                  <option key={d.kd_dokter} value={d.kd_dokter}>{d.nm_dokter}</option>
                ))}
              </select>
              {!form.kd_poli && (
                <p className="text-xs text-slate-400 mt-1">Pilih poli terlebih dahulu</p>
              )}
              {fieldErr.kd_dokter && <p className="text-xs text-red-600 mt-1">{fieldErr.kd_dokter}</p>}
            </div>

            {/* Jaminan */}
            <div className="col-span-2">
              <Label>Jaminan / Cara Bayar *</Label>
              <select
                value={form.kd_pj}
                onChange={(e) => setField("kd_pj", e.target.value)}
                className={inputCls(!!fieldErr.kd_pj)}
              >
                <option value="">-- Pilih Jaminan --</option>
                {penjabList.map((pj) => (
                  <option key={pj.kd_pj} value={pj.kd_pj}>{pj.png_jawab}</option>
                ))}
              </select>
              {fieldErr.kd_pj && <p className="text-xs text-red-600 mt-1">{fieldErr.kd_pj}</p>}
            </div>
          </div>
        </div>

        {/* === SECTION 3: Data Penanggung Jawab === */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-sm font-semibold text-slate-600">Data Penanggung Jawab</span>
            <span className="text-xs text-slate-400">(opsional)</span>
          </div>
          <div className="p-3 md:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <Label>Nama Penanggung Jawab</Label>
              <input
                value={form.p_jawab}
                onChange={(e) => setField("p_jawab", e.target.value)}
                placeholder="Nama penanggung jawab..."
                className={inputCls()}
              />
            </div>
            <div>
              <Label>Hubungan</Label>
              <select
                value={form.hubunganpj}
                onChange={(e) => setField("hubunganpj", e.target.value)}
                className={inputCls()}
              >
                <option value="">-- Pilih --</option>
                {["Suami","Istri","Ayah","Ibu","Anak","Saudara","Lainnya"].map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <Label>Alamat Penanggung Jawab</Label>
              <input
                value={form.almt_pj}
                onChange={(e) => setField("almt_pj", e.target.value)}
                placeholder="Alamat penanggung jawab..."
                className={inputCls()}
              />
            </div>
          </div>
        </div>

        {/* Error global */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-green-700 hover:bg-green-800 disabled:bg-green-400 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
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
                Simpan Registrasi
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
