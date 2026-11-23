"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AbkUnit,
  AbkBebanKerja,
  AbkSummary,
  CreateUnitPayload,
  CreateBebanPayload,
  getAbkSummary,
  getAbkUnits,
  getAbkUnitDetail,
  createAbkUnit,
  updateAbkUnit,
  deleteAbkUnit,
  getAbkBebanKerja,
  createAbkBebanKerja,
  updateAbkBebanKerja,
  deleteAbkBebanKerja,
} from "@/lib/abk";

// Format helper
const fmt = (n: number | null | undefined, d = 2) => {
  if (n == null || isNaN(n)) return "0";
  return Number(n).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
};

const hitungWKT = (u: Partial<AbkUnit>) => {
  const hariKerja = u.hari_kerja ?? 312;
  const cuti = u.cuti_hari ?? 12;
  const diklat = u.diklat_hari ?? 6;
  const libur = u.libur_nasional_hari ?? 19;
  const ketidakhadiran = u.ketidakhadiran_hari ?? 10;
  const jamKerja = u.jam_kerja_hari ?? 6;

  const efektif = hariKerja - cuti - diklat - libur - ketidakhadiran;
  return Math.max(0, efektif) * jamKerja;
};

// ===================== MODAL UNIT =====================
const DEFAULT_UNIT: CreateUnitPayload = {
  unit: "",
  kategori_sdm: "",
  tahun: new Date().getFullYear(),
  jumlah_sdm_saat_ini: 0,
  hari_kerja: 312,
  cuti_hari: 12,
  diklat_hari: 6,
  libur_nasional_hari: 19,
  ketidakhadiran_hari: 10,
  jam_kerja_hari: 6,
  ftp: 1,
  keterangan: "",
};

function ModalUnit({
  show,
  onClose,
  onSave,
  initial,
}: {
  show: boolean;
  onClose: () => void;
  onSave: (payload: CreateUnitPayload) => Promise<void>;
  initial: AbkUnit | null;
}) {
  const [form, setForm] = useState<CreateUnitPayload>(DEFAULT_UNIT);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (initial) {
      setForm({
        unit: initial.unit,
        kategori_sdm: initial.kategori_sdm,
        tahun: initial.tahun,
        jumlah_sdm_saat_ini: initial.jumlah_sdm_saat_ini,
        hari_kerja: initial.hari_kerja,
        cuti_hari: initial.cuti_hari,
        diklat_hari: initial.diklat_hari,
        libur_nasional_hari: initial.libur_nasional_hari,
        ketidakhadiran_hari: initial.ketidakhadiran_hari,
        jam_kerja_hari: initial.jam_kerja_hari,
        ftp: initial.ftp,
        keterangan: initial.keterangan,
      });
    } else {
      setForm(DEFAULT_UNIT);
    }
    setErr("");
  }, [initial, show]);

  if (!show) return null;

  const wkt = hitungWKT(form);
  const set = (k: keyof CreateUnitPayload, v: string | number) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.unit.trim() || !form.kategori_sdm.trim()) {
      setErr("Unit dan Kategori SDM wajib diisi");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await onSave(form);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan data unit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] text-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold text-lg">
            {initial ? "Edit" : "Tambah"} Analisa Unit
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-4">
          {err && (
            <div className="p-3 rounded-lg bg-red-950/70 border border-red-800 text-red-200 text-sm">
              {err}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-slate-400 mb-1 block">
                Unit / Instalasi <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="mis. Instalasi Gawat Darurat"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400 mb-1 block">
                Kategori SDM / Profesi <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.kategori_sdm}
                onChange={(e) => set("kategori_sdm", e.target.value)}
                placeholder="mis. Perawat Pelaksana IGD"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Tahun</label>
              <input
                type="number"
                value={form.tahun ?? ""}
                onChange={(e) => set("tahun", parseInt(e.target.value) || 2026)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                Jumlah SDM Saat Ini (Eksisting)
              </label>
              <input
                type="number"
                value={form.jumlah_sdm_saat_ini ?? 0}
                onChange={(e) =>
                  set("jumlah_sdm_saat_ini", parseInt(e.target.value) || 0)
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* WKT Box */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-400 text-sm font-semibold">
                ⓘ Komponen Waktu Kerja Tersedia (WKT) — PMK 33/2015
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Hari kerja/th (A)
                </label>
                <input
                  type="number"
                  value={form.hari_kerja ?? 312}
                  onChange={(e) =>
                    set("hari_kerja", parseInt(e.target.value) || 0)
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Cuti (B) — hari
                </label>
                <input
                  type="number"
                  value={form.cuti_hari ?? 12}
                  onChange={(e) =>
                    set("cuti_hari", parseInt(e.target.value) || 0)
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Diklat (C) — hari
                </label>
                <input
                  type="number"
                  value={form.diklat_hari ?? 6}
                  onChange={(e) =>
                    set("diklat_hari", parseInt(e.target.value) || 0)
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Libur Nasional (D) — hari
                </label>
                <input
                  type="number"
                  value={form.libur_nasional_hari ?? 19}
                  onChange={(e) =>
                    set("libur_nasional_hari", parseInt(e.target.value) || 0)
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Ketidakhadiran (E) — hari
                </label>
                <input
                  type="number"
                  value={form.ketidakhadiran_hari ?? 10}
                  onChange={(e) =>
                    set("ketidakhadiran_hari", parseInt(e.target.value) || 0)
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Jam kerja/hari (F)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={form.jam_kerja_hari ?? 6}
                  onChange={(e) =>
                    set("jam_kerja_hari", parseFloat(e.target.value) || 0)
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Faktor Tugas Penunjang / FTP (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form.ftp ?? 1}
                  onChange={(e) => set("ftp", parseFloat(e.target.value) || 0)}
                  className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Hasil WKT =</div>
                <div className="text-xl font-bold text-emerald-400">
                  {fmt(wkt)}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    jam/tahun
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  ({form.hari_kerja} - {form.cuti_hari} - {form.diklat_hari} -{" "}
                  {form.libur_nasional_hari} - {form.ketidakhadiran_hari}) ×{" "}
                  {form.jam_kerja_hari} jam
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Keterangan
            </label>
            <textarea
              value={form.keterangan ?? ""}
              onChange={(e) => set("keterangan", e.target.value)}
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "💾 Simpan Unit"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== MODAL BEBAN KERJA =====================
const DEFAULT_BEBAN: CreateBebanPayload = {
  nama_kegiatan: "",
  waktu_rata2_menit: 30,
  total_kegiatan: 0,
  keterangan: "",
};

function ModalBebanKerja({
  show,
  onClose,
  onSave,
  initial,
  unit,
  wkt,
}: {
  show: boolean;
  onClose: () => void;
  onSave: (payload: CreateBebanPayload) => Promise<void>;
  initial: AbkBebanKerja | null;
  unit: AbkUnit | null;
  wkt: number;
}) {
  const [form, setForm] = useState<CreateBebanPayload>(DEFAULT_BEBAN);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (initial) {
      setForm({
        nama_kegiatan: initial.nama_kegiatan,
        waktu_rata2_menit: initial.waktu_rata2_menit,
        total_kegiatan: initial.total_kegiatan,
        keterangan: initial.keterangan,
      });
    } else {
      setForm(DEFAULT_BEBAN);
    }
    setErr("");
  }, [initial, show]);

  if (!show) return null;

  const set = (k: keyof CreateBebanPayload, v: string | number) =>
    setForm((p) => ({ ...p, [k]: v }));

  const waktuMenit = form.waktu_rata2_menit ?? 30;
  const totalKegiatan = form.total_kegiatan ?? 0;
  const sbk = wkt > 0 && waktuMenit > 0 ? wkt / (waktuMenit / 60) : 0;
  const kebutuhan = sbk > 0 ? totalKegiatan / sbk : 0;

  const handleSave = async () => {
    if (!form.nama_kegiatan.trim()) {
      setErr("Nama kegiatan pokok wajib diisi");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await onSave(form);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan kegiatan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg text-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-white font-semibold text-lg">
              {initial ? "Edit" : "Tambah"} Kegiatan Pokok
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {unit?.unit} — {unit?.kategori_sdm}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {err && (
            <div className="p-3 rounded-lg bg-red-950/70 border border-red-800 text-red-200 text-sm">
              {err}
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Nama Kegiatan Pokok <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.nama_kegiatan}
              onChange={(e) => set("nama_kegiatan", e.target.value)}
              placeholder="mis. Triase & Pemeriksaan Awal Pasien IGD"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                Rata-rata Waktu (menit)
              </label>
              <input
                type="number"
                step="1"
                value={form.waktu_rata2_menit ?? 30}
                onChange={(e) =>
                  set("waktu_rata2_menit", parseFloat(e.target.value) || 0)
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                Total Kegiatan / Tahun
              </label>
              <input
                type="number"
                value={form.total_kegiatan ?? 0}
                onChange={(e) =>
                  set("total_kegiatan", parseInt(e.target.value) || 0)
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Kalkulasi Preview */}
          <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800 grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="text-xs text-slate-400">
                Standar Beban Kerja (SBK)
              </div>
              <div className="text-base font-bold text-sky-400">
                {fmt(sbk, 1)}
              </div>
              <div className="text-[11px] text-slate-500">
                kegiatan/orang/th
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Kebutuhan SDM</div>
              <div className="text-base font-bold text-amber-400">
                {fmt(kebutuhan, 3)}
              </div>
              <div className="text-[11px] text-slate-500">orang</div>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Keterangan
            </label>
            <input
              type="text"
              value={form.keterangan ?? ""}
              onChange={(e) => set("keterangan", e.target.value)}
              placeholder="Catatan tambahan..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "💾 Simpan Kegiatan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== DETAIL UNIT PANEL =====================
function DetailPanel({
  unit,
  onClose,
  onEditUnit,
  onRefresh,
}: {
  unit: AbkUnit;
  onClose: () => void;
  onEditUnit: () => void;
  onRefresh: () => void;
}) {
  const [bebanList, setBebanList] = useState<AbkBebanKerja[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBebanModal, setShowBebanModal] = useState(false);
  const [editBeban, setEditBeban] = useState<AbkBebanKerja | null>(null);

  const loadBeban = useCallback(async () => {
    if (!unit) return;
    setLoading(true);
    try {
      const data = await getAbkBebanKerja(unit.id);
      setBebanList(data || []);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [unit]);

  useEffect(() => {
    loadBeban();
  }, [loadBeban]);

  const wkt = unit.wkt || hitungWKT(unit);
  const totalKebutuhan = bebanList.reduce(
    (s, b) => s + (b.kebutuhan_sdm || 0),
    0
  );
  const ftpPersen = unit.ftp || 1;
  const kebutuhanABK = totalKebutuhan * (1 + ftpPersen / 100);
  const kekurangan = kebutuhanABK - (unit.jumlah_sdm_saat_ini || 0);

  const handleSaveBeban = async (payload: CreateBebanPayload) => {
    if (editBeban) {
      await updateAbkBebanKerja(editBeban.id, payload);
    } else {
      await createAbkBebanKerja(unit.id, payload);
    }
    loadBeban();
    onRefresh();
  };

  const handleDeleteBeban = async (id: number) => {
    if (!confirm("Hapus kegiatan pokok ini?")) return;
    await deleteAbkBebanKerja(id);
    loadBeban();
    onRefresh();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden text-slate-200">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
        <div>
          <h3 className="text-white font-semibold text-lg">{unit.unit}</h3>
          <p className="text-sm text-slate-400">
            {unit.kategori_sdm} · Tahun {unit.tahun}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Link
            href={`/abk-kes/print/${unit.id}`}
            target="_blank"
            className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition flex items-center gap-1 font-medium shadow-sm"
          >
            🖨️ Cetak PDF
          </Link>
          <button
            onClick={onEditUnit}
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium"
          >
            ✏️ Edit
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none px-2"
          >
            ×
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-slate-800 text-center bg-slate-950/40">
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
          <div className="text-xs text-slate-400">WKT</div>
          <div className="text-lg font-bold text-emerald-400">{fmt(wkt)}</div>
          <div className="text-[11px] text-slate-500">jam/tahun</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
          <div className="text-xs text-slate-400">Kebutuhan SDM</div>
          <div className="text-lg font-bold text-sky-400">
            {fmt(kebutuhanABK, 2)}
          </div>
          <div className="text-[11px] text-slate-500">
            orang (Bulat: {Math.round(kebutuhanABK)})
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
          <div className="text-xs text-slate-400">SDM Saat Ini</div>
          <div className="text-lg font-bold text-white">
            {unit.jumlah_sdm_saat_ini}
          </div>
          <div className="text-[11px] text-slate-500">orang eksisting</div>
        </div>
        <div
          className={`rounded-xl p-3 border ${
            kekurangan > 0
              ? "bg-red-950/40 border-red-900/60"
              : "bg-emerald-950/30 border-emerald-900/60"
          }`}
        >
          <div className="text-xs text-slate-400">
            {kekurangan > 0 ? "Kekurangan" : "Surplus"}
          </div>
          <div
            className={`text-lg font-bold ${
              kekurangan > 0 ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {kekurangan > 0
              ? `+${fmt(kekurangan, 2)}`
              : fmt(Math.abs(kekurangan), 2)}
          </div>
          <div className="text-[11px] text-slate-500">
            {kekurangan > 0 ? "butuh tambahan" : "tercukupi"}
          </div>
        </div>
      </div>

      {/* Beban Kerja List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-200">
            Kegiatan Pokok & Beban Kerja ({bebanList.length})
          </h4>
          <button
            onClick={() => {
              setEditBeban(null);
              setShowBebanModal(true);
            }}
            className="text-xs px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition flex items-center gap-1 font-medium shadow-sm"
          >
            + Tambah Kegiatan
          </button>
        </div>

        {loading ? (
          <div className="text-center text-slate-500 py-8">Memuat data...</div>
        ) : bebanList.length === 0 ? (
          <div className="text-center text-slate-500 py-10 text-sm border border-dashed border-slate-800 rounded-xl">
            Belum ada kegiatan pokok dianalisa.
            <br />
            <span className="text-slate-600 text-xs">
              Klik &quot;+ Tambah Kegiatan&quot; untuk menginput beban kerja unit.
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {bebanList.map((b, i) => (
              <div
                key={b.id}
                className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 hover:border-slate-600 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm text-white font-medium">
                      {i + 1}. {b.nama_kegiatan}
                    </div>
                    {b.keterangan && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        {b.keterangan}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 ml-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditBeban(b);
                        setShowBebanModal(true);
                      }}
                      className="text-xs px-2.5 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded-md transition"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteBeban(b.id)}
                      className="text-xs px-2.5 py-1 bg-red-800 hover:bg-red-700 text-white rounded-md transition"
                    >
                      🗑
                    </button>
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
                    <div className="text-slate-400">Rata² Waktu</div>
                    <div className="text-white font-medium mt-0.5">
                      {b.waktu_rata2_menit} mnt
                    </div>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
                    <div className="text-slate-400">Volume/Tahun</div>
                    <div className="text-white font-medium mt-0.5">
                      {fmt(b.total_kegiatan, 0)}
                    </div>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
                    <div className="text-slate-400">SBK</div>
                    <div className="text-sky-300 font-medium mt-0.5">
                      {fmt(b.sbk, 1)}
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-right">
                  <span className="text-xs text-slate-400">
                    Kebutuhan SDM:{" "}
                  </span>
                  <span className="text-sm font-bold text-amber-400">
                    {fmt(b.kebutuhan_sdm, 3)}
                  </span>
                  <span className="text-xs text-slate-400"> orang</span>
                </div>
              </div>
            ))}

            {/* Total Kalkulasi Box */}
            <div className="bg-slate-950/70 rounded-xl p-3.5 border border-slate-800 space-y-1.5 mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Total Kebutuhan Pokok</span>
                <span className="text-amber-400 font-bold">
                  {fmt(totalKebutuhan, 3)} orang
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  + Faktor Tugas Penunjang / FTP ({ftpPersen}%)
                </span>
                <span className="text-slate-300">
                  {fmt(totalKebutuhan * (ftpPersen / 100), 3)} orang
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-slate-800">
                <span className="text-white">= Kebutuhan SDM ABK</span>
                <span className="text-emerald-400 text-base font-bold">
                  {fmt(kebutuhanABK, 2)} orang
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <ModalBebanKerja
        show={showBebanModal}
        onClose={() => {
          setShowBebanModal(false);
          setEditBeban(null);
        }}
        onSave={handleSaveBeban}
        initial={editBeban}
        unit={unit}
        wkt={wkt}
      />
    </div>
  );
}

// ===================== MAIN PAGE =====================
export default function AbkKesPage() {
  const currentYear = new Date().getFullYear();
  const [tahun, setTahun] = useState<string>(currentYear.toString());
  const [keyword, setKeyword] = useState<string>("");

  const [summary, setSummary] = useState<AbkSummary>({
    total_unit: 0,
    kebutuhan_sdm_abk: 0,
    sdm_saat_ini: 0,
    kekurangan: 0,
  });
  const [units, setUnits] = useState<AbkUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<AbkUnit | null>(null);
  const [loading, setLoading] = useState(false);

  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editUnit, setEditUnit] = useState<AbkUnit | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const t = parseInt(tahun) || undefined;
      const [sumRes, unitsRes] = await Promise.all([
        getAbkSummary(t),
        getAbkUnits({ tahun: t, keyword }),
      ]);
      const validSummary = ((sumRes as any)?.data !== undefined ? (sumRes as any).data : sumRes) || {
        total_unit: 0,
        kebutuhan_sdm_abk: 0,
        sdm_saat_ini: 0,
        kekurangan: 0,
      };
      const rawUnits = (unitsRes as any)?.data !== undefined ? (unitsRes as any).data : unitsRes;
      const validUnits: AbkUnit[] = Array.isArray(rawUnits) ? rawUnits : [];
      setSummary(validSummary);
      setUnits(validUnits);

      if (selectedUnit) {
        const refreshed = validUnits.find((u) => u.id === selectedUnit.id);
        if (refreshed) {
          // get full detail with beban kerja
          const d = await getAbkUnitDetail(refreshed.id);
          const validD = (d as any)?.data !== undefined ? (d as any).data : d;
          setSelectedUnit(validD);
        }
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [tahun, keyword, selectedUnit]);

  useEffect(() => {
    loadData();
  }, [tahun]);

  const handleSelectUnit = async (u: AbkUnit) => {
    if (selectedUnit?.id === u.id) {
      setSelectedUnit(null);
      return;
    }
    try {
      const d = await getAbkUnitDetail(u.id);
      setSelectedUnit(d);
    } catch {
      setSelectedUnit(u);
    }
  };

  const handleSaveUnit = async (payload: CreateUnitPayload) => {
    if (editUnit) {
      await updateAbkUnit(editUnit.id, payload);
    } else {
      await createAbkUnit(payload);
    }
    await loadData();
  };

  const handleDeleteUnit = async (id: number) => {
    if (
      !confirm(
        "Hapus analisa unit ini beserta seluruh data kegiatan pokok di dalamnya?"
      )
    )
      return;
    await deleteAbkUnit(id);
    if (selectedUnit?.id === id) setSelectedUnit(null);
    await loadData();
  };

  const kekurangan = summary.kekurangan || 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>📊</span> Analisa Beban Kerja Kesehatan (ABK-Kes)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Perhitungan perencanaan kebutuhan SDM kesehatan berdasarkan Permenkes
            RI No. 33 Tahun 2015
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/abk-kes/print-rekap?tahun=${tahun || currentYear}`}
            target="_blank"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm flex items-center gap-2 transition font-medium shadow-sm"
          >
            🖨️ Cetak Rekap (PDF)
          </Link>
          <button
            onClick={() => {
              setEditUnit(null);
              setShowUnitModal(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm flex items-center gap-2 transition font-medium shadow-sm"
          >
            + Tambah Analisa Unit
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <span className="text-3xl">🏥</span>
          <div>
            <div className="text-2xl font-bold text-white">
              {summary.total_unit}
            </div>
            <div className="text-xs text-slate-400">Unit Dianalisa</div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <span className="text-3xl">📊</span>
          <div>
            <div className="text-2xl font-bold text-sky-400">
              {fmt(summary.kebutuhan_sdm_abk, 2)}
            </div>
            <div className="text-xs text-slate-400">Kebutuhan SDM (ABK)</div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <span className="text-3xl">👥</span>
          <div>
            <div className="text-2xl font-bold text-emerald-400">
              {summary.sdm_saat_ini}
            </div>
            <div className="text-xs text-slate-400">SDM Saat Ini (Eksisting)</div>
          </div>
        </div>
        <div
          className={`border rounded-2xl p-4 flex items-center gap-4 ${
            kekurangan > 0
              ? "bg-red-950/30 border-red-900/50"
              : "bg-emerald-950/30 border-emerald-900/50"
          }`}
        >
          <span className="text-3xl">{kekurangan > 0 ? "⚠️" : "✅"}</span>
          <div>
            <div
              className={`text-2xl font-bold ${
                kekurangan > 0 ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {kekurangan > 0
                ? `+${fmt(kekurangan, 2)}`
                : fmt(Math.abs(kekurangan), 2)}
            </div>
            <div className="text-xs text-slate-400">
              {kekurangan > 0 ? "Total Kekurangan" : "Total Surplus"}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Cari unit / jabatan / profesi..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") loadData();
          }}
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-72"
        />
        <input
          type="number"
          placeholder="Tahun"
          value={tahun}
          onChange={(e) => setTahun(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-32"
        />
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition"
        >
          🔍 Cari
        </button>
      </div>

      {/* Grid Content: List & Details */}
      <div
        className={`grid gap-6 ${
          selectedUnit ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {/* Unit Cards List */}
        <div className="space-y-3">
          {loading && (
            <div className="text-center text-slate-400 py-10">
              Memuat data unit analisa...
            </div>
          )}
          {!loading && units.length === 0 && (
            <div className="text-center text-slate-500 py-16 bg-slate-900/40 rounded-2xl border border-slate-800">
              Belum ada analisa beban kerja untuk tahun {tahun || currentYear}.
              <br />
              <span className="text-slate-600 text-sm">
                Klik &quot;+ Tambah Analisa Unit&quot; untuk memulai.
              </span>
            </div>
          )}
          {(Array.isArray(units) ? units : []).map((u) => {
            const isSelected = selectedUnit?.id === u.id;
            const wkt = u.wkt || hitungWKT(u);
            const kekur = u.kekurangan ?? 0;
            return (
              <div
                key={u.id}
                onClick={() => handleSelectUnit(u)}
                className={`bg-slate-900 border rounded-2xl p-4 cursor-pointer transition group ${
                  isSelected
                    ? "border-sky-500 ring-1 ring-sky-500/40 shadow-lg shadow-sky-950/20"
                    : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/80"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-base">
                        {u.unit}
                      </span>
                      <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-0.5 rounded-full font-mono">
                        {u.tahun}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400 mt-0.5">
                      {u.kategori_sdm}
                    </div>
                  </div>
                  <div
                    className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link
                      href={`/abk-kes/print/${u.id}`}
                      target="_blank"
                      title="Cetak Formulir ABK ke PDF"
                      className="text-xs px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg transition"
                    >
                      🖨️
                    </Link>
                    <button
                      onClick={() => {
                        setEditUnit(u);
                        setShowUnitModal(true);
                      }}
                      title="Edit Unit"
                      className="text-xs px-2.5 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteUnit(u.id)}
                      title="Hapus Unit"
                      className="text-xs px-2.5 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded-lg transition"
                    >
                      🗑
                    </button>
                  </div>
                </div>

                <div className="mt-3.5 grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-slate-950/60 rounded-xl p-2 border border-slate-800">
                    <div className="text-slate-400">WKT</div>
                    <div className="text-emerald-400 font-bold mt-0.5">
                      {fmt(wkt)}
                    </div>
                    <div className="text-[10px] text-slate-500">jam/th</div>
                  </div>
                  <div className="bg-slate-950/60 rounded-xl p-2 border border-slate-800">
                    <div className="text-slate-400">Kebutuhan</div>
                    <div className="text-sky-400 font-bold mt-0.5">
                      {fmt(u.kebutuhan_sdm_abk, 2)}
                    </div>
                    <div className="text-[10px] text-slate-500">orang</div>
                  </div>
                  <div className="bg-slate-950/60 rounded-xl p-2 border border-slate-800">
                    <div className="text-slate-400">SDM Kini</div>
                    <div className="text-white font-bold mt-0.5">
                      {u.jumlah_sdm_saat_ini}
                    </div>
                    <div className="text-[10px] text-slate-500">orang</div>
                  </div>
                  <div
                    className={`rounded-xl p-2 border ${
                      kekur > 0
                        ? "bg-red-950/30 border-red-900/40"
                        : "bg-emerald-950/20 border-emerald-900/40"
                    }`}
                  >
                    <div className="text-slate-400">
                      {kekur > 0 ? "Kurang" : "Surplus"}
                    </div>
                    <div
                      className={`font-bold mt-0.5 ${
                        kekur > 0 ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {kekur > 0 ? `+${fmt(kekur, 2)}` : fmt(Math.abs(kekur), 2)}
                    </div>
                    <div className="text-[10px] text-slate-500">orang</div>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
                  <span>{u.beban_kerja?.length || 0} kegiatan pokok</span>
                  <span className="text-sky-400 font-medium">
                    {isSelected
                      ? "▲ Sembunyikan detail"
                      : "▼ Lihat rincian & kegiatan"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Unit Detail Panel */}
        {selectedUnit && (
          <DetailPanel
            unit={selectedUnit}
            onClose={() => setSelectedUnit(null)}
            onEditUnit={() => {
              setEditUnit(selectedUnit);
              setShowUnitModal(true);
            }}
            onRefresh={loadData}
          />
        )}
      </div>

      <ModalUnit
        show={showUnitModal}
        onClose={() => {
          setShowUnitModal(false);
          setEditUnit(null);
        }}
        onSave={handleSaveUnit}
        initial={editUnit}
      />
    </div>
  );
}
