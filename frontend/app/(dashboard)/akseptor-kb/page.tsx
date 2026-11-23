"use client";
import MicButton from "@/components/MicButton";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  listKbPelayanan, createKbPelayanan, updateKbPelayanan, deleteKbPelayanan,
  lookupPasienKb, KbPelayananRow, KbMetode, KbJenisPelayanan, KbPasienLookup,
} from "@/lib/api";

function todayIso() { return new Date().toISOString().slice(0, 10); }
function thisYear() { return String(new Date().getFullYear()); }
function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

const METODE_LIST: KbMetode[] = ["Tubektomi","Vasektomi","Implan","IUD","Suntik","Pil","Kondom","MAL"];
const JENIS_LIST:  KbJenisPelayanan[] = ["Pasca Persalinan","Pasca Keguguran","Interval"];

const empty: KbPelayananRow = {
  id: null, no_rawat: null, no_rkm_medis: "", nama_pasien: null,
  tanggal: todayIso(), jam: null,
  metode: "IUD", jenis_pelayanan: "Interval",
  komplikasi: 0, ket_komplikasi: null,
  kegagalan: 0, ket_kegagalan: null,
  efek_samping: 0, ket_efek_samping: null,
  drop_out: 0, ket_drop_out: null,
  catatan: null, nip: null,
  created_at: null, updated_at: null, updated_by: null,
};

export default function AkseptorKbPage() {
  const [tahun, setTahun] = useState(thisYear());
  const [bulan, setBulan] = useState("");
  const [metodeFilter, setMetodeFilter] = useState("");
  const [rows, setRows] = useState<KbPelayananRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg]   = useState("");

  // form state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KbPelayananRow>(empty);

  // lookup pasien
  const [lookupQ, setLookupQ] = useState("");
  const [lookupRes, setLookupRes] = useState<KbPasienLookup[]>([]);
  const [lookupOpen, setLookupOpen] = useState(false);

  const reload = useCallback(() => {
    setLoading(true); setErrMsg("");
    listKbPelayanan({
      tahun: bulan ? undefined : tahun,
      bulan: bulan || undefined,
      metode: metodeFilter || undefined,
    })
      .then(r => setRows(r.data.data))
      .catch(() => setErrMsg("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [tahun, bulan, metodeFilter]);

  useEffect(() => { reload(); }, [reload]);

  // Debounced lookup
  useEffect(() => {
    if (lookupQ.trim().length < 2) { setLookupRes([]); return; }
    const t = setTimeout(() => {
      lookupPasienKb(lookupQ).then(r => setLookupRes(r.data.data)).catch(() => setLookupRes([]));
    }, 300);
    return () => clearTimeout(t);
  }, [lookupQ]);

  const openNew = () => {
    setEditing({ ...empty, tanggal: todayIso() });
    setLookupQ(""); setLookupOpen(false);
    setShowForm(true);
  };
  const openEdit = (r: KbPelayananRow) => {
    setEditing({ ...r });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setErrMsg(""); };

  const save = async () => {
    if (!editing.no_rkm_medis.trim()) { setErrMsg("No. RM wajib diisi"); return; }
    setErrMsg(""); setOkMsg("");
    try {
      if (editing.id) {
        await updateKbPelayanan(editing.id, editing);
        setOkMsg(`✔ Data ${editing.no_rkm_medis} diperbarui`);
      } else {
        await createKbPelayanan(editing);
        setOkMsg(`✔ Data baru tersimpan`);
      }
      setShowForm(false);
      setTimeout(() => setOkMsg(""), 3000);
      reload();
    } catch (e: any) {
      setErrMsg(e?.response?.data?.error || "Gagal menyimpan");
    }
  };

  const del = async (r: KbPelayananRow) => {
    if (!r.id) return;
    if (!confirm(`Hapus data KB ${r.nama_pasien || r.no_rkm_medis} tanggal ${r.tanggal}?`)) return;
    try {
      await deleteKbPelayanan(r.id);
      setOkMsg("✔ Dihapus"); setTimeout(() => setOkMsg(""), 2500);
      reload();
    } catch { setErrMsg("Gagal hapus"); }
  };

  const stats = useMemo(() => {
    const s = { total: rows.length,
                pp: 0, pk: 0, iv: 0,
                kpl: 0, kg: 0, es: 0, dop: 0,
                per_metode: {} as Record<string, number> };
    for (const r of rows) {
      if (r.jenis_pelayanan === "Pasca Persalinan") s.pp++;
      else if (r.jenis_pelayanan === "Pasca Keguguran") s.pk++;
      else s.iv++;
      s.kpl += r.komplikasi;
      s.kg  += r.kegagalan;
      s.es  += r.efek_samping;
      s.dop += r.drop_out;
      s.per_metode[r.metode] = (s.per_metode[r.metode] || 0) + 1;
    }
    return s;
  }, [rows]);

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <nav className="text-sm mb-4 flex gap-3">
        <Link href="/rawat-jalan" className="text-indigo-600 hover:underline">← Rawat Jalan</Link>
        <span className="text-slate-400">·</span>
        <Link href="/laporan/sirs/3-16" className="text-indigo-600 hover:underline">RL 3.16 (Rekap Tahunan)</Link>
      </nav>

      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Akseptor Keluarga Berencana</h1>
          <p className="text-sm text-slate-600 mt-1">
            Input transaksional per-pasien. Data ini otomatis di-agregat ke RL 3.16 (rekap KB tahunan).
          </p>
        </div>
        <button onClick={openNew}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded">➕ Tambah Akseptor</button>
      </header>

      <div className="flex items-end gap-3 mb-5 flex-wrap">
        <div>
          <label className="block text-xs text-slate-900 mb-1">Tahun</label>
          <input type="number" min={2019} max={2099} value={tahun}
            onChange={e => { setTahun(e.target.value); setBulan(""); }}
            className="w-28 border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
        </div>
        <div>
          <label className="block text-xs text-slate-900 mb-1">atau Bulan (override)</label>
          <input type="month" value={bulan} onChange={e => setBulan(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
        </div>
        <div>
          <label className="block text-xs text-slate-900 mb-1">Metode</label>
          <select value={metodeFilter} onChange={e => setMetodeFilter(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm text-slate-900">
            <option value="">Semua metode</option>
            {METODE_LIST.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <button onClick={reload}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 py-2 rounded border border-slate-300">🔄 Refresh</button>
      </div>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}
      {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded p-3 mb-3">{okMsg}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="text-xs text-blue-700">Total Akseptor</div>
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
          <div className="text-xs text-emerald-700">Pasca Persalinan / Keguguran / Interval</div>
          <div className="text-lg font-bold text-slate-900">{stats.pp} / {stats.pk} / {stats.iv}</div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded p-3">
          <div className="text-xs text-rose-700">Komplikasi / Kegagalan</div>
          <div className="text-lg font-bold text-slate-900">{stats.kpl} / {stats.kg}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded p-3">
          <div className="text-xs text-amber-700">Efek Samping / Drop Out</div>
          <div className="text-lg font-bold text-slate-900">{stats.es} / {stats.dop}</div>
        </div>
      </div>

      {/* List */}
      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-300">
            <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-300 px-2 py-1 text-slate-900">Tanggal</th>
                <th className="border border-slate-300 px-2 py-1 text-slate-900">Jam</th>
                <th className="border border-slate-300 px-2 py-1 text-left text-slate-900">No. RM</th>
                <th className="border border-slate-300 px-2 py-1 text-left text-slate-900">Nama Pasien</th>
                <th className="border border-slate-300 px-2 py-1 text-slate-900">Metode</th>
                <th className="border border-slate-300 px-2 py-1 text-slate-900">Jenis</th>
                <th className="border border-slate-300 px-2 py-1 text-slate-900">Komp / Gagal / ES / DO</th>
                <th className="border border-slate-300 px-2 py-1 text-slate-900">Catatan</th>
                <th className="border border-slate-300 px-2 py-1 text-slate-900">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="border border-slate-300 px-3 py-4 text-center text-slate-400">Tidak ada data</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-2 py-1 text-slate-900 whitespace-nowrap">{r.tanggal}</td>
                  <td className="border border-slate-300 px-2 py-1 text-slate-900 whitespace-nowrap">{r.jam || "-"}</td>
                  <td className="border border-slate-300 px-2 py-1 font-mono text-slate-900">{r.no_rkm_medis}</td>
                  <td className="border border-slate-300 px-2 py-1 text-slate-900">{r.nama_pasien || "-"}</td>
                  <td className="border border-slate-300 px-2 py-1 text-slate-900">
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">{r.metode}</span>
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-slate-900 text-xs">{r.jenis_pelayanan}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center text-slate-900 text-xs">
                    {r.komplikasi ? "K" : "·"} / {r.kegagalan ? "G" : "·"} / {r.efek_samping ? "E" : "·"} / {r.drop_out ? "D" : "·"}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-slate-700 text-xs max-w-[200px] truncate" title={r.catatan || ""}>{r.catatan || "-"}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center whitespace-nowrap">
                    <button onClick={() => openEdit(r)} className="text-blue-600 hover:underline text-xs mr-2">Edit</button>
                    <button onClick={() => del(r)} className="text-rose-600 hover:underline text-xs">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{editing.id ? "Edit Akseptor KB" : "Tambah Akseptor KB"}</h2>
              <button onClick={closeForm} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Lookup pasien */}
              <div className="relative">
                <label className="block text-xs text-slate-900 mb-1 font-semibold">Cari Pasien (RM / Nama)</label>
                <input type="text" value={lookupQ}
                  placeholder="Ketik min. 2 karakter — contoh: 018832 atau Siti"
                  onChange={e => { setLookupQ(e.target.value); setLookupOpen(true); }}
                  onFocus={() => setLookupOpen(true)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
                {lookupOpen && lookupRes.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-300 rounded shadow-lg max-h-60 overflow-y-auto">
                    {lookupRes.map(p => (
                      <button key={p.no_rkm_medis} type="button"
                        onClick={() => {
                          setEditing(prev => ({ ...prev, no_rkm_medis: p.no_rkm_medis, nama_pasien: p.nm_pasien }));
                          setLookupQ(`${p.no_rkm_medis} - ${p.nm_pasien || ""}`);
                          setLookupOpen(false);
                        }}
                        className="block w-full text-left px-3 py-2 hover:bg-slate-100 text-sm text-slate-900 border-b border-slate-100">
                        <span className="font-mono">{p.no_rkm_medis}</span> · {p.nm_pasien || "-"} · {p.jk || "-"} · {p.tgl_lahir || "-"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-900 mb-1 font-semibold">No. RM <span className="text-rose-600">*</span></label>
                  <input type="text" value={editing.no_rkm_medis}
                    onChange={e => setEditing(p => ({ ...p, no_rkm_medis: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-mono text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs text-slate-900 mb-1 font-semibold">Nama Pasien</label>
                  <input type="text" value={editing.nama_pasien || ""}
                    onChange={e => setEditing(p => ({ ...p, nama_pasien: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs text-slate-900 mb-1 font-semibold">No. Rawat (opsional)</label>
                  <input type="text" value={editing.no_rawat || ""}
                    onChange={e => setEditing(p => ({ ...p, no_rawat: e.target.value || null }))}
                    placeholder="2026/05/01/000001"
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-mono text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs text-slate-900 mb-1 font-semibold">Petugas (NIP)</label>
                  <input type="text" value={editing.nip || ""}
                    onChange={e => setEditing(p => ({ ...p, nip: e.target.value || null }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs text-slate-900 mb-1 font-semibold">Tanggal <span className="text-rose-600">*</span></label>
                  <input type="date" value={editing.tanggal}
                    onChange={e => setEditing(p => ({ ...p, tanggal: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs text-slate-900 mb-1 font-semibold">Jam</label>
                  <input type="time" value={editing.jam || ""}
                    onChange={e => setEditing(p => ({ ...p, jam: e.target.value || null }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs text-slate-900 mb-1 font-semibold">Metode KB <span className="text-rose-600">*</span></label>
                  <select value={editing.metode}
                    onChange={e => setEditing(p => ({ ...p, metode: e.target.value as KbMetode }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900">
                    {METODE_LIST.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-900 mb-1 font-semibold">Jenis Pelayanan <span className="text-rose-600">*</span></label>
                  <select value={editing.jenis_pelayanan}
                    onChange={e => setEditing(p => ({ ...p, jenis_pelayanan: e.target.value as KbJenisPelayanan }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900">
                    {JENIS_LIST.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
              </div>

              {/* Efek (checkboxes + keterangan) */}
              <div className="border border-slate-200 rounded p-3 bg-slate-50">
                <div className="text-xs font-semibold text-slate-900 mb-2">Status Akseptor (centang yang relevan)</div>
                <div className="space-y-2">
                  {([
                    { key: "komplikasi",   ketKey: "ket_komplikasi",   label: "Komplikasi KB" },
                    { key: "kegagalan",    ketKey: "ket_kegagalan",    label: "Kegagalan KB" },
                    { key: "efek_samping", ketKey: "ket_efek_samping", label: "Efek Samping" },
                    { key: "drop_out",     ketKey: "ket_drop_out",     label: "Drop Out" },
                  ] as const).map(({ key, ketKey, label }) => {
                    const checked = ((editing as any)[key] as number) === 1;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-900 w-44">
                          <input type="checkbox" checked={checked}
                            onChange={e => setEditing(p => ({ ...p, [key]: e.target.checked ? 1 : 0 } as any))} />
                          {label}
                        </label>
                        {checked && (
                          <input type="text" placeholder="Keterangan"
                            value={(editing as any)[ketKey] || ""}
                            onChange={e => setEditing(p => ({ ...p, [ketKey]: e.target.value || null } as any))}
                            className="flex-1 border border-slate-300 rounded px-3 py-1 text-sm text-slate-900" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-900 mb-1 font-semibold">Catatan</label>
                <div className="relative">
                  <textarea rows={3} value={editing.catatan || ""}
                    onChange={e => setEditing(p => ({ ...p, catatan: e.target.value || null }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 pr-8 text-sm text-slate-900" />
                  <MicButton value={editing.catatan || ""} onChange={v => setEditing(p => ({ ...p, catatan: v || null }))} className="absolute right-1.5 bottom-1.5" />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={closeForm}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 py-2 rounded border border-slate-300">Batal</button>
              <button onClick={save}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded">
                {editing.id ? "Simpan Perubahan" : "Tambah Akseptor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
