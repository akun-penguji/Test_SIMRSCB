"use client";

// Kinerja IT — dashboard (tarik dari tiket & fitur) + aktivitas manual + impor WA + gambar.

import { useCallback, useEffect, useState } from "react";
import { hasPerm, getSession } from "@/lib/auth";
import {
  getKinerjaDashboard, getKinerjaList, createKinerja, updateKinerja, deleteKinerja, importWaKinerja,
  kinerjaExportCsvUrl, uploadLaporFoto, KinerjaDashboard, KinerjaAktivitas, KinerjaFilter, WaParsed,
  cariPegawaiKinerja, PegawaiRingkas,
} from "@/lib/api";

// Kategori diselaraskan dengan yang dipakai data & dashboard (hasil impor WA):
// konfigurasi/pengembangan/pemeliharaan/perbaikan + instalasi/jaringan/pelatihan/lainnya.
// Dulu dropdown pakai dialek campur (maintenance/kunjungan/backup) yang tidak
// nyambung dengan agregasi dashboard.
const KATEGORI = ["konfigurasi", "pengembangan", "pemeliharaan", "perbaikan", "instalasi", "jaringan", "pelatihan", "lainnya"];
const KATEGORI_DEFAULT = "pemeliharaan";
const BULAN = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export default function KinerjaItPage() {
  const isKelola = hasPerm("lapor_it_kelola");
  const [tab, setTab] = useState<"dashboard" | "aktivitas">("dashboard");
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const nowY = new Date().getFullYear();
  const tahunOpts = Array.from({ length: nowY - 2022 }, (_, i) => nowY - i);
  const [dash, setDash] = useState<KinerjaDashboard | null>(null);
  const [rows, setRows] = useState<KinerjaAktivitas[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [editRow, setEditRow] = useState<KinerjaAktivitas | null>(null);
  const [openImport, setOpenImport] = useState(false);
  // Filter khusus tab Aktivitas (bulan/kategori/petugas/cari). Tahun dipakai bersama dashboard.
  const [fBulan, setFBulan] = useState("");
  const [fKategori, setFKategori] = useState("");
  const [fPetugas, setFPetugas] = useState("");
  const [fQ, setFQ] = useState("");

  const filter: KinerjaFilter = {
    tahun,
    bulan: fBulan ? Number(fBulan) : undefined,
    kategori: fKategori || undefined,
    petugas: fPetugas || undefined,
    q: fQ || undefined,
  };

  const loadDash = useCallback(() => { getKinerjaDashboard(tahun).then(r => setDash(r.data)).catch(() => {}); }, [tahun]);
  const loadList = useCallback(() => {
    getKinerjaList({ tahun, bulan: fBulan ? Number(fBulan) : undefined, kategori: fKategori || undefined, petugas: fPetugas || undefined, q: fQ || undefined })
      .then(r => setRows(r.data)).catch(() => {});
  }, [tahun, fBulan, fKategori, fPetugas, fQ]);
  useEffect(() => { loadDash(); }, [loadDash]);
  useEffect(() => { loadList(); }, [loadList]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">📊 Kinerja IT</h1>
          <p className="text-sm text-slate-500">Performa tim IT — otomatis dari tiket & usulan fitur, plus catatan aktivitas manual.</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={tahun} onChange={e => setTahun(Number(e.target.value))} className="border border-slate-300 rounded-lg px-2 py-2 text-sm">
            {tahunOpts.map(y => <option key={y} value={y}>Tahun {y}</option>)}
          </select>
          <a href="/kinerja-it/laporan" className="px-3 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700">📈 Laporan Mingguan</a>
          <button onClick={() => cetakKinerja(dash, rows, tahun)} className="px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">🖨️ Cetak</button>
          {isKelola && <>
            <button onClick={() => setOpenImport(true)} className="px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">📥 Impor WA</button>
            <button onClick={() => setOpenForm(true)} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700">+ Aktivitas</button>
          </>}
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(["dashboard", "aktivitas"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t === "dashboard" ? "Dashboard" : "Aktivitas Manual"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && dash && <Dashboard d={dash} />}
      {tab === "aktivitas" && (
        <Aktivitas
          rows={rows} isKelola={isKelola}
          filter={{ fBulan, fKategori, fPetugas, fQ }}
          setFilter={{ setFBulan, setFKategori, setFPetugas, setFQ }}
          exportUrl={kinerjaExportCsvUrl(filter)}
          onEdit={r => setEditRow(r)}
          onChanged={() => { loadList(); loadDash(); }}
        />
      )}

      {openForm && <FormAktivitas onClose={() => setOpenForm(false)} onSaved={() => { setOpenForm(false); loadList(); loadDash(); }} />}
      {editRow && <FormAktivitas edit={editRow} onClose={() => setEditRow(null)} onSaved={() => { setEditRow(null); loadList(); loadDash(); }} />}
      {openImport && <ImportModal onClose={() => setOpenImport(false)} onDone={() => { setOpenImport(false); loadList(); loadDash(); }} />}
    </div>
  );
}

function Card({ l, v, c }: { l: string; v: number | string; c?: string }) {
  return <div className="bg-white border border-slate-200 rounded-xl p-3">
    <div className="text-xs text-slate-500">{l}</div><div className={`text-2xl font-bold ${c || "text-slate-700"}`}>{v}</div>
  </div>;
}

function Dashboard({ d }: { d: KinerjaDashboard }) {
  const maxBulan = Math.max(1, ...d.tiket_per_bulan.map(b => b.masuk));
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-semibold text-slate-500 mb-2">TIKET LAPOR IT</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Card l="Total tiket" v={d.tiket.total} />
          <Card l="Selesai" v={d.tiket.selesai} c="text-green-600" />
          <Card l="Diproses" v={d.tiket.diproses} c="text-blue-600" />
          <Card l="Baru" v={d.tiket.baru} c="text-amber-600" />
          <Card l="Rata2 selesai (jam)" v={Math.round(d.tiket.avg_jam)} />
          <Card l={`SLA ≤${d.sla_jam}j`}
            v={d.tiket.sla_total > 0 ? `${Math.round(d.tiket.sla_persen)}%` : "–"}
            c={d.tiket.sla_total === 0 ? "text-slate-400" : d.tiket.sla_persen >= 80 ? "text-green-600" : "text-amber-600"} />
        </div>
        {d.tiket.sla_total > 0 && (
          <div className="text-xs text-slate-400 mt-1">{d.tiket.sla_tepat} dari {d.tiket.sla_total} tiket selesai dalam ≤{d.sla_jam} jam.</div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-slate-700 mb-2">Tiket ditangani per petugas IT</div>
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-left text-xs"><tr><th className="py-1">Petugas</th><th>Ditangani</th><th>Selesai</th><th>Avg tanggap (mnt)</th><th>Avg selesai (jam)</th></tr></thead>
            <tbody>
              {d.tiket_per_pic.map((p, i) => (
                <tr key={i} className="border-t border-slate-100"><td className="py-1">{p.pic || "-"}</td><td>{p.ditangani}</td><td>{p.selesai}</td><td>{Math.round(p.avg_menit_tanggap || 0)}</td><td>{Math.round(p.avg_jam || 0)}</td></tr>
              ))}
              {d.tiket_per_pic.length === 0 && <tr><td colSpan={4} className="text-slate-400 py-3 text-center">Belum ada tiket dengan PIC.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-slate-700 mb-2">Tren bulanan (masuk vs selesai)</div>
          <div className="space-y-1">
            {d.tiket_per_bulan.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-8 text-slate-500">{BULAN[b.bulan]}</span>
                <div className="flex-1 bg-slate-100 rounded h-4 relative overflow-hidden">
                  <div className="bg-blue-400 h-4 absolute" style={{ width: `${(b.masuk / maxBulan) * 100}%` }} />
                  <div className="bg-green-500 h-4 absolute" style={{ width: `${(b.selesai / maxBulan) * 100}%` }} />
                </div>
                <span className="w-16 text-right text-slate-500">{b.selesai}/{b.masuk}</span>
              </div>
            ))}
            {d.tiket_per_bulan.length === 0 && <div className="text-slate-400 text-center py-3 text-sm">Belum ada data.</div>}
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-500 mb-2">AKTIVITAS MANUAL & PENGEMBANGAN</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card l="Aktivitas" v={d.aktivitas.total} />
          <Card l="Total jam" v={Math.round(d.aktivitas.total_menit / 60)} />
          <Card l="Usulan fitur" v={d.fitur.total} />
          <Card l="Fitur dikerjakan" v={d.fitur.dikerjakan} c="text-blue-600" />
          <Card l="Fitur selesai" v={d.fitur.selesai} c="text-green-600" />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="text-sm font-semibold text-slate-700 mb-2">Aktivitas per bulan (jumlah kegiatan)</div>
        <div className="flex items-end gap-1 h-28">
          {(() => {
            const maxAkt = Math.max(1, ...d.aktivitas_per_bulan.map(b => b.jumlah));
            return Array.from({ length: 12 }, (_, i) => {
              const b = d.aktivitas_per_bulan.find(x => x.bulan === i + 1);
              const n = b?.jumlah || 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${BULAN[i + 1]}: ${n} kegiatan${b?.menit ? ` · ${Math.round(b.menit / 60 * 10) / 10} jam` : ""}`}>
                  <span className="text-[10px] text-slate-400">{n || ""}</span>
                  <div className="w-full bg-green-400 rounded-t" style={{ height: `${(n / maxAkt) * 100}%`, minHeight: n > 0 ? 2 : 0 }} />
                  <span className="text-[10px] text-slate-400">{BULAN[i + 1]}</span>
                </div>
              );
            });
          })()}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-slate-700 mb-2">Aktivitas per petugas</div>
          <table className="w-full text-sm"><thead className="text-slate-400 text-left text-xs"><tr><th className="py-1">Petugas</th><th>Jumlah</th><th>Jam</th></tr></thead>
            <tbody>{d.aktivitas_per_petugas.map((p, i) => (<tr key={i} className="border-t border-slate-100"><td className="py-1">{p.petugas || "-"}</td><td>{p.jumlah}</td><td>{Math.round((p.menit || 0) / 60)}</td></tr>))}
              {d.aktivitas_per_petugas.length === 0 && <tr><td colSpan={3} className="text-slate-400 py-3 text-center">Belum ada aktivitas.</td></tr>}</tbody></table>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-slate-700 mb-2">Aktivitas per kategori</div>
          <table className="w-full text-sm"><thead className="text-slate-400 text-left text-xs"><tr><th className="py-1">Kategori</th><th>Jumlah</th></tr></thead>
            <tbody>{d.aktivitas_per_kategori.map((p, i) => (<tr key={i} className="border-t border-slate-100"><td className="py-1">{p.k}</td><td>{p.total}</td></tr>))}
              {d.aktivitas_per_kategori.length === 0 && <tr><td colSpan={2} className="text-slate-400 py-3 text-center">Belum ada aktivitas.</td></tr>}</tbody></table>
        </div>
      </div>
    </div>
  );
}

type AktFilter = { fBulan: string; fKategori: string; fPetugas: string; fQ: string };
type AktSetFilter = {
  setFBulan: (v: string) => void; setFKategori: (v: string) => void;
  setFPetugas: (v: string) => void; setFQ: (v: string) => void;
};
function Aktivitas({ rows, isKelola, filter, setFilter, exportUrl, onEdit, onChanged }: {
  rows: KinerjaAktivitas[]; isKelola: boolean;
  filter: AktFilter; setFilter: AktSetFilter; exportUrl: string;
  onEdit: (r: KinerjaAktivitas) => void; onChanged: () => void;
}) {
  async function hapus(id: number) { if (!confirm("Hapus aktivitas ini?")) return; try { await deleteKinerja(id); onChanged(); } catch { /* */ } }
  const totalMenit = rows.reduce((s, r) => s + (r.durasi_menit || 0), 0);
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <input value={filter.fQ} onChange={e => setFilter.setFQ(e.target.value)} placeholder="Cari kegiatan / petugas…"
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[180px]" />
        <select value={filter.fBulan} onChange={e => setFilter.setFBulan(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Semua bulan</option>
          {BULAN.slice(1).map((b, i) => <option key={i} value={i + 1}>{b}</option>)}
        </select>
        <select value={filter.fKategori} onChange={e => setFilter.setFKategori(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Semua kategori</option>
          {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <input value={filter.fPetugas} onChange={e => setFilter.setFPetugas(e.target.value)} placeholder="Petugas (persis)"
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-36" />
        <a href={exportUrl} className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">⬇ Ekspor CSV</a>
      </div>
      <div className="text-xs text-slate-500">{rows.length} kegiatan{totalMenit > 0 ? ` · ${Math.round(totalMenit / 60 * 10) / 10} jam` : ""}</div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left"><tr>
            <th className="px-3 py-2">Tanggal</th><th className="px-3 py-2">Petugas</th><th className="px-3 py-2">Kategori</th>
            <th className="px-3 py-2">Kegiatan</th><th className="px-3 py-2">Durasi</th><th className="px-3 py-2">Foto</th>{isKelola && <th></th>}
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2 whitespace-nowrap text-slate-500">{r.tanggal?.slice(0, 16)}</td>
                <td className="px-3 py-2">{r.petugas || "-"}</td>
                <td className="px-3 py-2">{r.kategori}{r.sumber === "wa_import" && <span className="ml-1 text-[10px] text-green-600">WA</span>}</td>
                <td className="px-3 py-2"><div className="font-medium">{r.judul}</div>{r.deskripsi && <div className="text-xs text-slate-500 line-clamp-2">{r.deskripsi}</div>}</td>
                <td className="px-3 py-2 text-slate-500">{r.durasi_menit ? `${r.durasi_menit}m` : "-"}</td>
                <td className="px-3 py-2">{r.foto && r.foto.split(",").filter(Boolean).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="w-9 h-9 object-cover rounded inline-block mr-1 border border-slate-200" /></a>)}</td>
                {isKelola && <td className="px-3 py-2 whitespace-nowrap text-xs space-x-2">
                  <button onClick={() => onEdit(r)} className="text-green-700 hover:underline">edit</button>
                  <button onClick={() => hapus(r.id)} className="text-slate-400 hover:text-red-600">hapus</button>
                </td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={isKelola ? 7 : 6} className="px-3 py-8 text-center text-slate-400">Belum ada aktivitas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mt-10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function FormAktivitas({ edit, onClose, onSaved }: { edit?: KinerjaAktivitas; onClose: () => void; onSaved: () => void }) {
  const nama = getSession()?.nama || "";
  const [f, setF] = useState({
    // datetime-local minta "YYYY-MM-DDTHH:mm"; data dari API "YYYY-MM-DD HH:mm:ss".
    tanggal: edit?.tanggal ? edit.tanggal.slice(0, 16).replace(" ", "T") : "",
    petugas: edit?.petugas ?? nama,
    kategori: edit?.kategori ?? KATEGORI_DEFAULT,
    judul: edit?.judul ?? "",
    deskripsi: edit?.deskripsi ?? "",
    durasi_menit: edit?.durasi_menit != null ? String(edit.durasi_menit) : "",
  });
  const [fotos, setFotos] = useState<string[]>(edit?.foto ? edit.foto.split(",").filter(Boolean) : []);
  const [uploading, setUploading] = useState(false);
  // Petugas boleh dicari dari tabel pegawai: kegiatan sering dicatatkan oleh
  // satu orang untuk rekan lain, jadi memaksa nama akun yang login membuat
  // laporan per petugas tidak mencerminkan siapa yang benar-benar mengerjakan.
  const [usulPegawai, setUsulPegawai] = useState<PegawaiRingkas[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  // Isi durasi lewat jam+menit lebih alami bagi tim IT daripada total menit.
  const jam = f.durasi_menit ? Math.floor(Number(f.durasi_menit) / 60) : 0;
  const menit = f.durasi_menit ? Number(f.durasi_menit) % 60 : 0;
  const setDurasi = (j: number, m: number) => set("durasi_menit", String(j * 60 + m) === "0" ? "" : String(j * 60 + m));
  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setUploading(true);
    try { const urls: string[] = []; for (const file of files) { const r = await uploadLaporFoto(file); urls.push(r.data.url); } setFotos(p => [...p, ...urls]); }
    catch { setErr("Gagal upload gambar."); } finally { setUploading(false); e.target.value = ""; }
  }
  async function simpan() {
    if (!f.judul.trim()) { setErr("Judul kegiatan wajib diisi."); return; }
    setBusy(true); setErr("");
    const payload = { ...f, durasi_menit: f.durasi_menit ? Number(f.durasi_menit) : undefined, foto: fotos.join(",") };
    try {
      if (edit) await updateKinerja(edit.id, payload);
      else await createKinerja(payload);
      onSaved();
    } catch { setErr("Gagal menyimpan."); } finally { setBusy(false); }
  }
  return (
    <Modal title={edit ? "Edit Aktivitas Kinerja IT" : "Catat Aktivitas Kinerja IT"} onClose={onClose}>
      <div className="space-y-3">
        {err && <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{err}</div>}
        <input value={f.judul} onChange={e => set("judul", e.target.value)} placeholder="Kegiatan (wajib), mis. Maintenance server & backup DB"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <textarea value={f.deskripsi} onChange={e => set("deskripsi", e.target.value)} rows={3} placeholder="Rincian kegiatan…"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <input type="datetime-local" value={f.tanggal} onChange={e => set("tanggal", e.target.value.replace("T", " ") + ":00")}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <select value={f.kategori} onChange={e => set("kategori", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            {KATEGORI.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div>
            <input value={f.petugas} list="usul-pegawai" placeholder="Petugas — ketik untuk mencari"
              title="Terisi dari akun yang login; ketik untuk memilih pegawai lain"
              onChange={e => {
                const v = e.target.value;
                set("petugas", v);
                if (v.trim().length >= 2) cariPegawaiKinerja(v.trim()).then(r => setUsulPegawai(r.data)).catch(() => {});
                else setUsulPegawai([]);
              }}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
            <datalist id="usul-pegawai">
              {usulPegawai.map(p => <option key={p.nik} value={p.nama} />)}
            </datalist>
          </div>
          <div className="flex gap-1 items-center">
            <input value={jam || ""} onChange={e => setDurasi(Number(e.target.value) || 0, menit)} placeholder="0" type="number" min={0}
              className="border border-slate-300 rounded-lg px-2 py-2 text-sm w-full" />
            <span className="text-xs text-slate-400">jam</span>
            <input value={menit || ""} onChange={e => setDurasi(jam, Number(e.target.value) || 0)} placeholder="0" type="number" min={0} max={59}
              className="border border-slate-300 rounded-lg px-2 py-2 text-sm w-full" />
            <span className="text-xs text-slate-400">mnt</span>
          </div>
        </div>
        <div>
          <label className="text-sm text-slate-600">Foto / bukti (opsional)</label>
          <input type="file" accept="image/*" multiple onChange={onFiles} className="mt-1 block w-full text-sm" />
          {uploading && <div className="text-xs text-slate-400 mt-1">Mengunggah…</div>}
          {fotos.length > 0 && <div className="flex gap-2 flex-wrap mt-2">{fotos.map((u, i) => (
            <div key={i} className="relative"><img src={u} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
              <button type="button" onClick={() => setFotos(p => p.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs leading-none">×</button></div>))}</div>}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-slate-100 text-slate-600">Batal</button>
          <button onClick={simpan} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">{busy ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState(""); const [kategori, setKategori] = useState("lainnya");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState<WaParsed[] | null>(null);
  function onFile(e: React.ChangeEvent<HTMLInputElement>) { const fl = e.target.files?.[0]; if (fl) fl.text().then(setText); }
  async function run(apply: boolean) {
    if (!text.trim()) { setMsg("Tempel teks / pilih file .txt dulu."); return; }
    setBusy(true); setMsg("");
    try {
      const r = await importWaKinerja(text, apply, kategori);
      if (apply) { setMsg(`Impor selesai — ${r.data.baru} baru, ${r.data.dilewati_duplikat} dilewati.`); onDone(); }
      else { setPreview(r.data.contoh || []); setMsg(`${r.data.terdeteksi} pesan terdeteksi. Klik Impor & Simpan.`); }
    } catch { setMsg("Gagal memproses."); } finally { setBusy(false); }
  }
  return (
    <Modal title="Impor Aktivitas dari WhatsApp" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="text-xs text-slate-500">Ekspor chat grup WA (⋮ → Export chat → Without media), lalu pilih file .txt atau tempel isinya.</div>
        {msg && <div className="rounded px-3 py-2 bg-slate-50 text-slate-600">{msg}</div>}
        <div className="flex gap-2 items-center">
          <input type="file" accept=".txt,text/plain" onChange={onFile} className="text-sm flex-1" />
          <select value={kategori} onChange={e => setKategori(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
            {KATEGORI.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="…atau tempel isi ekspor chat"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono" />
        <div className="flex gap-2">
          <button onClick={() => run(false)} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 disabled:opacity-50">Pratinjau</button>
          <button onClick={() => run(true)} disabled={busy || !preview} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50">Impor & Simpan</button>
        </div>
        {preview && preview.length > 0 && (
          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg text-xs">
            {preview.map((m, i) => <div key={i} className="px-2 py-1 border-b border-slate-100"><b>{m.pelapor}</b> · {m.tanggal?.slice(0, 16)}<br />{m.deskripsi}</div>)}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Cetak ────────────────────────────────────────────────────────────────────
const esc = (s?: string) => (s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
function cetakKinerja(d: KinerjaDashboard | null, rows: KinerjaAktivitas[], tahun: number) {
  const w = window.open("", "_blank", "width=900,height=650"); if (!w || !d) return;
  const pic = d.tiket_per_pic.map(p => `<tr><td>${esc(p.pic || "-")}</td><td style="text-align:center">${p.ditangani}</td><td style="text-align:center">${p.selesai}</td><td style="text-align:center">${Math.round(p.avg_jam || 0)}</td></tr>`).join("");
  const akt = rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.tanggal?.slice(0, 16))}</td><td>${esc(r.petugas)}</td><td>${esc(r.kategori)}</td><td>${esc(r.judul)}</td><td style="text-align:center">${r.durasi_menit || ""}</td></tr>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Kinerja IT ${tahun}</title>
    <style>body{font-family:Arial;margin:24px;font-size:12px;color:#111}h2{font-size:16px;margin:0}h3{font-size:13px;margin:14px 0 4px}
    table{border-collapse:collapse;width:100%;margin-top:4px}th,td{border:1px solid #999;padding:4px 6px;font-size:11px;text-align:left}th{background:#f0f0f0}
    .kop{text-align:center;border-bottom:3px double #222;padding-bottom:8px;margin-bottom:12px}@media print{.noprint{display:none}}</style></head><body>
    <div class="kop"><div>PEMERINTAH KABUPATEN BEKASI &middot; DINAS KESEHATAN</div><div style="font-size:19px;font-weight:bold">RSUD CABANGBUNGIN</div></div>
    <h2>LAPORAN KINERJA IT — TAHUN ${tahun}</h2>
    <h3>Ringkasan Tiket</h3>
    <table><tr><th>Total</th><th>Selesai</th><th>Diproses</th><th>Baru</th><th>Rata2 jam</th></tr>
      <tr><td>${d.tiket.total}</td><td>${d.tiket.selesai}</td><td>${d.tiket.diproses}</td><td>${d.tiket.baru}</td><td>${Math.round(d.tiket.avg_jam)}</td></tr></table>
    <h3>Tiket per Petugas IT</h3>
    <table><thead><tr><th>Petugas</th><th>Ditangani</th><th>Selesai</th><th>Avg jam</th></tr></thead><tbody>${pic || '<tr><td colspan=4 style="text-align:center">-</td></tr>'}</tbody></table>
    <h3>Aktivitas Manual (${d.aktivitas.total} kegiatan &middot; ${Math.round(d.aktivitas.total_menit / 60)} jam)</h3>
    <table><thead><tr><th>No</th><th>Tanggal</th><th>Petugas</th><th>Kategori</th><th>Kegiatan</th><th>Menit</th></tr></thead><tbody>${akt || '<tr><td colspan=6 style="text-align:center">-</td></tr>'}</tbody></table>
    <div style="margin-top:36px;text-align:right">Cabangbungin, ................................<br><br><br>Koordinator IT<br><br><br>( ............................... )</div>
    <div class="noprint" style="text-align:center;margin-top:12px"><button onclick="window.print()">🖨️ Cetak</button></div>
    <script>setTimeout(function(){window.print()},400)<\/script></body></html>`);
  w.document.close();
}
