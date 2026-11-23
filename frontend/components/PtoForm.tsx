"use client";

// Formulir PTO — Pemantauan Terapi Obat (apoteker), mengikuti form fisik RM:
// deskripsi pasien, keluhan utama, riwayat penyakit sekarang/terdahulu/keluarga/
// sosial, riwayat penggunaan obat, hasil pemeriksaan penunjang, penggunaan obat
// saat ini, dan SOAP.
//
// Lembar baru otomatis ditarik dari data Khanza (identitas, ruangan, DPJP,
// BB/TB, alergi, resep berjalan, hasil lab) lewat /pto/awal — apoteker tinggal
// mengoreksi. Edit/hapus hanya oleh pembuat lembar (owner-only).

import { useCallback, useEffect, useState } from "react";
import MicButton from "@/components/MicButton";
import {
  ptoAwal, ptoList, ptoDetail, ptoSimpan, ptoHapus,
  PtoRingkas, PtoRiwayatObat, PtoPenunjang, PtoObatSaatIni, PtoPasien,
} from "@/lib/api";

type Head = {
  ruangan: string; tgl_masuk: string; dpjp: string; bb: string; tb: string;
  alergi_obat: string; apoteker: string; keluhan_utama: string;
  riwayat_penyakit_sekarang: string; riwayat_penyakit_terdahulu: string;
  riwayat_keluarga: string; riwayat_sosial: string;
  soap_s: string; soap_o: string; soap_a: string; soap_p: string;
};
const HEAD_KOSONG: Head = {
  ruangan: "", tgl_masuk: "", dpjp: "", bb: "", tb: "", alergi_obat: "", apoteker: "",
  keluhan_utama: "", riwayat_penyakit_sekarang: "", riwayat_penyakit_terdahulu: "",
  riwayat_keluarga: "", riwayat_sosial: "", soap_s: "", soap_o: "", soap_a: "", soap_p: "",
};
const RIWAYAT_KOSONG: PtoRiwayatObat = { nama_obat: "", rejimen_dosis: "", rute: "", waktu_mulai: "" };
const PENUNJANG_KOSONG: PtoPenunjang = { tgl_pemeriksaan: "", nama_pemeriksaan: "", hasil: "", satuan: "", nilai_rujukan: "" };
const OBAT_KOSONG: PtoObatSaatIni = { tgl_mulai_terapi: "", nama_obat: "", rejimen: "", indikasi: "" };

// "2026-08-09 13:00:00" ⇄ "2026-08-09T13:00" (nilai input datetime-local)
const keInput = (dt: string) => (dt ? dt.replace(" ", "T").slice(0, 16) : "");
const sekarang = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const tglId = (s: string) => {
  if (!s) return "-";
  const [tgl, jam] = s.split(/[ T]/);
  const [y, m, d] = tgl.split("-");
  return `${d}-${m}-${y}${jam ? ` ${jam.slice(0, 5)}` : ""}`;
};

export default function PtoForm({ noRawat }: { noRawat: string }) {
  const [list, setList] = useState<PtoRingkas[] | null>(null);
  const [pasien, setPasien] = useState<PtoPasien | null>(null);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [tanggal, setTanggal] = useState("");
  const [origTanggal, setOrigTanggal] = useState("");   // kosong = lembar baru
  const [head, setHead] = useState<Head>(HEAD_KOSONG);
  const [riwayat, setRiwayat] = useState<PtoRiwayatObat[]>([RIWAYAT_KOSONG]);
  const [penunjang, setPenunjang] = useState<PtoPenunjang[]>([PENUNJANG_KOSONG]);
  const [obat, setObat] = useState<PtoObatSaatIni[]>([OBAT_KOSONG]);
  const [dapatEdit, setDapatEdit] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [err, setErr] = useState("");

  const muat = useCallback(() => {
    ptoList(noRawat).then(r => setList(r.data)).catch(() => setList([]));
  }, [noRawat]);
  useEffect(() => { muat(); }, [muat]);
  useEffect(() => { ptoAwal(noRawat).then(r => setPasien(r.data.pasien)).catch(() => { /* noop */ }); }, [noRawat]);

  const set = (k: keyof Head) => (v: string) => setHead(h => ({ ...h, [k]: v }));

  async function lembarBaru() {
    setErr(""); setSibuk(true);
    try {
      const { data } = await ptoAwal(noRawat);
      setPasien(data.pasien);
      setHead({
        ...HEAD_KOSONG, ruangan: data.ruangan, tgl_masuk: data.tgl_masuk, dpjp: data.dpjp,
        bb: data.bb, tb: data.tb, alergi_obat: data.alergi_obat, apoteker: data.apoteker,
      });
      // Resep berjalan & hasil lab ikut ditarik supaya tidak diketik ulang.
      setObat(data.obat_saat_ini.length
        ? data.obat_saat_ini.map(o => ({ ...o, indikasi: "" }))
        : [OBAT_KOSONG]);
      setPenunjang(data.penunjang.length ? data.penunjang : [PENUNJANG_KOSONG]);
      setRiwayat([RIWAYAT_KOSONG]);
      setTanggal(sekarang()); setOrigTanggal(""); setDapatEdit(true); setMode("form");
    } catch { setErr("Gagal menarik data awal pasien."); }
    finally { setSibuk(false); }
  }

  async function bukaLembar(t: string) {
    setErr(""); setSibuk(true);
    try {
      const { data } = await ptoDetail(noRawat, t);
      if (!data) { setErr("Lembar tidak ditemukan."); return; }
      const h = data.header;
      setHead({
        ruangan: h.ruangan, tgl_masuk: h.tgl_masuk, dpjp: h.dpjp, bb: h.bb, tb: h.tb,
        alergi_obat: h.alergi_obat, apoteker: h.apoteker, keluhan_utama: h.keluhan_utama,
        riwayat_penyakit_sekarang: h.riwayat_penyakit_sekarang,
        riwayat_penyakit_terdahulu: h.riwayat_penyakit_terdahulu,
        riwayat_keluarga: h.riwayat_keluarga, riwayat_sosial: h.riwayat_sosial,
        soap_s: h.soap_s, soap_o: h.soap_o, soap_a: h.soap_a, soap_p: h.soap_p,
      });
      setRiwayat(data.riwayat_obat.length ? data.riwayat_obat : [RIWAYAT_KOSONG]);
      setPenunjang(data.penunjang.length ? data.penunjang : [PENUNJANG_KOSONG]);
      setObat(data.obat_saat_ini.length ? data.obat_saat_ini : [OBAT_KOSONG]);
      setTanggal(keInput(h.tanggal)); setOrigTanggal(h.tanggal);
      setDapatEdit(data.dapat_edit); setMode("form");
    } catch { setErr("Gagal memuat lembar PTO."); }
    finally { setSibuk(false); }
  }

  async function simpan() {
    setErr(""); setSibuk(true);
    try {
      await ptoSimpan({
        no_rawat: noRawat, tanggal, ...head,
        edit: !!origTanggal, orig_tanggal: origTanggal,
        riwayat_obat: riwayat.filter(r => r.nama_obat.trim()),
        penunjang: penunjang.filter(p => p.nama_pemeriksaan.trim()),
        obat_saat_ini: obat.filter(o => o.nama_obat.trim()),
      });
      setMode("list"); muat();
    } catch (e) { setErr(e instanceof Error ? e.message : "Gagal menyimpan."); }
    finally { setSibuk(false); }
  }

  async function hapus() {
    if (!origTanggal || !confirm("Hapus lembar PTO ini beserta tabel detailnya?")) return;
    setSibuk(true);
    try { await ptoHapus({ no_rawat: noRawat, tanggal: origTanggal }); setMode("list"); muat(); }
    catch { setErr("Gagal menghapus (bukan milik Anda?)."); }
    finally { setSibuk(false); }
  }

  const cetak = (t: string) =>
    window.open(`/cetak-pto?no_rawat=${encodeURIComponent(noRawat)}&tanggal=${encodeURIComponent(t)}`, "_blank");

  // ── Daftar lembar ──────────────────────────────────────────────────────────
  if (mode === "list") {
    return (
      <div className="space-y-2.5">
        <button onClick={lembarBaru} disabled={sibuk}
          className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl py-2.5">
          {sibuk ? "Menyiapkan…" : "+ Lembar Pemantauan Baru"}
        </button>
        {err && <div className="text-xs text-red-600">{err}</div>}
        {list === null ? <div className="text-center text-slate-400 text-sm py-8">Memuat…</div>
          : list.length === 0 ? <div className="text-center text-slate-400 text-sm py-6">Belum ada lembar pemantauan terapi obat.</div>
            : list.map(r => (
              <div key={r.tanggal} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">{tglId(r.tanggal)}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => cetak(r.tanggal)}
                      className="text-[11px] border border-slate-300 text-slate-600 hover:bg-slate-50 font-semibold rounded-lg px-2 py-1">🖨️ Cetak</button>
                    <button onClick={() => bukaLembar(r.tanggal)}
                      className="text-[11px] bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg px-2.5 py-1">
                      {r.milik ? "Buka / Edit" : "Lihat"}
                    </button>
                  </div>
                </div>
                {r.ringkas && <div className="text-xs text-slate-500 mt-1">{r.ringkas}</div>}
                <div className="text-[10px] text-slate-400 mt-1">Apoteker: {r.petugas || "-"}</div>
              </div>
            ))}
      </div>
    );
  }

  // ── Form satu lembar ───────────────────────────────────────────────────────
  const ro = !dapatEdit;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => { setMode("list"); setErr(""); }} className="text-xs text-slate-500 hover:text-slate-700">← Daftar lembar</button>
        {origTanggal && <button onClick={() => cetak(origTanggal)} className="text-xs border border-slate-300 text-slate-600 hover:bg-slate-50 font-semibold rounded-lg px-2.5 py-1">🖨️ Cetak</button>}
      </div>

      {/* Deskripsi pasien */}
      <Kartu judul="Deskripsi Pasien">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
          <Info label="No. RM" nilai={pasien?.no_rkm_medis} />
          <Info label="Tgl Lahir" nilai={pasien?.tgl_lahir} />
          <Info label="Nama Pasien" nilai={pasien?.nama} />
          <Info label="Jenis Kelamin" nilai={pasien?.jk} />
          <Info label="Umur" nilai={pasien?.umur} />
          <Info label="No. Rawat" nilai={noRawat} />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Txt label="Ruangan" value={head.ruangan} onChange={set("ruangan")} ro={ro} />
          <Tgl label="Tgl Masuk" value={head.tgl_masuk} onChange={set("tgl_masuk")} ro={ro} />
          <Txt label="DPJP" value={head.dpjp} onChange={set("dpjp")} ro={ro} />
          <div>
            <Label>Tanggal Pemantauan</Label>
            <input type="datetime-local" value={tanggal} onChange={e => setTanggal(e.target.value)} disabled={ro}
              className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-2 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400" />
          </div>
          <Txt label="BB (kg)" value={head.bb} onChange={set("bb")} ro={ro} />
          <Txt label="TB (cm)" value={head.tb} onChange={set("tb")} ro={ro} />
          <Txt label="Alergi Obat" value={head.alergi_obat} onChange={set("alergi_obat")} ro={ro} />
          <Txt label="Apoteker" value={head.apoteker} onChange={set("apoteker")} ro={ro} />
        </div>
      </Kartu>

      {/* Anamnesis */}
      <Kartu judul="Anamnesis">
        <Area label="Keluhan Utama" value={head.keluhan_utama} onChange={set("keluhan_utama")} ro={ro} rows={2} />
        <Area label="Riwayat Penyakit Sekarang" value={head.riwayat_penyakit_sekarang} onChange={set("riwayat_penyakit_sekarang")} ro={ro} rows={3} />
        <Area label="Riwayat Penyakit Terdahulu" value={head.riwayat_penyakit_terdahulu} onChange={set("riwayat_penyakit_terdahulu")} ro={ro} rows={2} />
        <Area label="Riwayat Keluarga" value={head.riwayat_keluarga} onChange={set("riwayat_keluarga")} ro={ro} rows={2} />
        <Area label="Riwayat Sosial" value={head.riwayat_sosial} onChange={set("riwayat_sosial")} ro={ro} rows={2} />
      </Kartu>

      {/* Riwayat penggunaan obat */}
      <Baris judul="Riwayat Penggunaan Obat" rows={riwayat} setRows={setRiwayat} kosong={RIWAYAT_KOSONG} ro={ro}
        kolom={[
          ["nama_obat", "Nama Obat", "col-span-2"],
          ["rejimen_dosis", "Rejimen Dosis", ""],
          ["rute", "Rute", ""],
          ["waktu_mulai", "Waktu Mulai", "col-span-2"],
        ]} />

      {/* Hasil pemeriksaan penunjang */}
      <Baris judul="Hasil Pemeriksaan Penunjang" rows={penunjang} setRows={setPenunjang} kosong={PENUNJANG_KOSONG} ro={ro}
        catatan="Hasil lab pasien ikut ditarik otomatis saat lembar dibuat."
        kolom={[
          ["tgl_pemeriksaan", "Tgl Pemeriksaan", "", "date"],
          ["nama_pemeriksaan", "Nama Pemeriksaan", ""],
          ["hasil", "Hasil", ""],
          ["satuan", "Satuan", ""],
          ["nilai_rujukan", "Nilai Rujukan", "col-span-2"],
        ]} />

      {/* Penggunaan obat saat ini */}
      <Baris judul="Penggunaan Obat Saat Ini" rows={obat} setRows={setObat} kosong={OBAT_KOSONG} ro={ro}
        catatan="Resep yang berjalan ikut ditarik otomatis saat lembar dibuat."
        kolom={[
          ["tgl_mulai_terapi", "Tgl Mulai Terapi", "", "date"],
          ["nama_obat", "Nama Obat", ""],
          ["rejimen", "Rejimen", ""],
          ["indikasi", "Indikasi", ""],
        ]} />

      {/* SOAP */}
      <Kartu judul="SOAP">
        <Area label="S — Subjektif" value={head.soap_s} onChange={set("soap_s")} ro={ro} rows={2} />
        <Area label="O — Objektif" value={head.soap_o} onChange={set("soap_o")} ro={ro} rows={4} />
        <Area label="A — Assessment (DRP / interaksi obat)" value={head.soap_a} onChange={set("soap_a")} ro={ro} rows={4} />
        <Area label="P — Plan (rencana pemantauan)" value={head.soap_p} onChange={set("soap_p")} ro={ro} rows={3} />
      </Kartu>

      {err && <div className="text-xs text-red-600">{err}</div>}
      {ro && <div className="text-xs text-amber-600">Lembar ini milik apoteker lain — hanya bisa dilihat & dicetak.</div>}
      {!ro && (
        <div className="flex gap-2">
          <button onClick={simpan} disabled={sibuk}
            className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl py-2.5">
            {sibuk ? "Menyimpan…" : origTanggal ? "Perbarui Lembar" : "Simpan Lembar"}
          </button>
          {origTanggal && (
            <button onClick={hapus} disabled={sibuk}
              className="px-4 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl py-2.5">Hapus</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Potongan UI ──────────────────────────────────────────────────────────────
function Kartu({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{judul}</div>
      {children}
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] font-semibold text-slate-500">{children}</label>;
}
function Info({ label, nilai }: { label: string; nilai?: string }) {
  return <div><span className="text-slate-400">{label}:</span> <span className="font-semibold text-slate-700">{nilai || "-"}</span></div>;
}
function Txt({ label, value, onChange, ro }: { label: string; value: string; onChange: (v: string) => void; ro?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <input value={value} onChange={e => onChange(e.target.value)} disabled={ro}
          className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-2 pr-8 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400" />
        {!ro && <MicButton value={value} onChange={onChange} className="absolute right-1 top-1.5" />}
      </div>
    </div>
  );
}
function Tgl({ label, value, onChange, ro }: { label: string; value: string; onChange: (v: string) => void; ro?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <input type="date" value={value} onChange={e => onChange(e.target.value)} disabled={ro}
        className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-2 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400" />
    </div>
  );
}
function Area({ label, value, onChange, ro, rows }: { label: string; value: string; onChange: (v: string) => void; ro?: boolean; rows: number }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <textarea value={value} onChange={e => onChange(e.target.value)} disabled={ro} rows={rows}
          className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-2 pr-9 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400" />
        {!ro && <MicButton value={value} onChange={onChange} className="absolute right-1 bottom-1.5" />}
      </div>
    </div>
  );
}

// Tabel berulang (riwayat obat / penunjang / obat saat ini). Tiap baris jadi
// satu kartu supaya tetap terbaca di layar HP.
function Baris<T extends object>({ judul, catatan, rows, setRows, kosong, kolom, ro }: {
  judul: string; catatan?: string; rows: T[]; setRows: (r: T[]) => void; kosong: T; ro?: boolean;
  kolom: [keyof T & string, string, string, ("date" | "text")?][];
}) {
  const ubah = (i: number, k: keyof T & string, v: string) =>
    setRows(rows.map((r, j) => (j === i ? ({ ...r, [k]: v } as T) : r)));
  const nilai = (r: T, k: keyof T & string) => String(r[k] ?? "");
  return (
    <Kartu judul={judul}>
      {catatan && <div className="text-[10px] text-slate-400 -mt-1">{catatan}</div>}
      {rows.map((r, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400">#{i + 1}</span>
            {!ro && rows.length > 1 && (
              <button onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="text-[10px] text-red-500 hover:text-red-700">Hapus baris</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {kolom.map(([k, label, span, typ]) => (
              <div key={k} className={span}>
                <Label>{label}</Label>
                {typ === "date" ? (
                  <input type="date" value={nilai(r, k)} onChange={e => ubah(i, k, e.target.value)} disabled={ro}
                    className="w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400" />
                ) : (
                  <div className="relative">
                    <input value={nilai(r, k)} onChange={e => ubah(i, k, e.target.value)} disabled={ro}
                      className="w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 pr-7 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400" />
                    {!ro && <MicButton value={nilai(r, k)} onChange={v => ubah(i, k, v)} className="absolute right-0.5 top-1" />}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {!ro && (
        <button onClick={() => setRows([...rows, { ...kosong }])}
          className="w-full text-xs font-semibold text-sky-700 border border-dashed border-sky-300 rounded-lg py-1.5 hover:bg-sky-50">
          + Tambah baris
        </button>
      )}
    </Kartu>
  );
}
