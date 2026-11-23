"use client";

// Laporan Kinerja IT — dirancang untuk dibagikan layar saat zoom weekly report
// Senin. Beda dari halaman kinerja-it: rentang tanggal bebas (bukan per tahun),
// angka berukuran besar agar terbaca lewat share screen, dan setiap metrik
// dibandingkan dengan periode sebelumnya supaya punya konteks.

import { useCallback, useEffect, useRef, useState } from "react";
import { getKinerjaLaporan, KinerjaLaporan } from "@/lib/api";

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/** Senin pada minggu yang memuat `d`. */
function senin(d: Date) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const iso = (d: Date) => {
  // Jangan pakai toISOString(): itu menggeser ke UTC dan bisa memundurkan
  // tanggal satu hari untuk zona WIB.
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const tambahHari = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function tglIndo(s?: string) {
  if (!s) return "-";
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${d} ${BLN[m - 1]} ${y}`;
}

/** Selisih terhadap periode sebelumnya. null = tidak ada pembanding yang bermakna. */
function delta(kini: number, lalu: number): { teks: string; arah: "naik" | "turun" | "sama" } | null {
  if (kini === lalu) return { teks: "sama dengan periode lalu", arah: "sama" };
  if (lalu === 0) return { teks: `+${kini} dari 0`, arah: "naik" };
  const p = Math.round(((kini - lalu) / lalu) * 100);
  return { teks: `${p > 0 ? "+" : ""}${p}% vs periode lalu`, arah: p > 0 ? "naik" : "turun" };
}

export default function LaporanKinerjaItPage() {
  const awal = senin(tambahHari(new Date(), -7));        // default: minggu lalu penuh
  const [dari, setDari] = useState(iso(awal));
  const [sampai, setSampai] = useState(iso(tambahHari(awal, 6)));
  const [data, setData] = useState<KinerjaLaporan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const layar = useRef<HTMLDivElement>(null);

  const muat = useCallback(() => {
    setLoading(true); setError(null);
    getKinerjaLaporan(dari, sampai)
      .then(r => setData(r.data))
      .catch((e) => setError(e?.response?.data?.error || e?.message || "Gagal memuat laporan."))
      .finally(() => setLoading(false));
  }, [dari, sampai]);

  useEffect(() => { muat(); }, [muat]);

  function preset(jenis: "minggu_ini" | "minggu_lalu" | "30hari" | "bulan_ini") {
    const now = new Date();
    if (jenis === "minggu_ini")  { const s = senin(now);                 setDari(iso(s)); setSampai(iso(tambahHari(s, 6))); }
    if (jenis === "minggu_lalu") { const s = senin(tambahHari(now, -7)); setDari(iso(s)); setSampai(iso(tambahHari(s, 6))); }
    if (jenis === "30hari")      { setDari(iso(tambahHari(now, -29)));   setSampai(iso(now)); }
    if (jenis === "bulan_ini")   { setDari(iso(new Date(now.getFullYear(), now.getMonth(), 1))); setSampai(iso(now)); }
  }

  const layarPenuh = () => {
    const el = layar.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <div ref={layar} className="bg-slate-50 min-h-screen overflow-auto">
      <div className="max-w-[1500px] mx-auto p-6 space-y-5">

        {/* ── Kendali (disembunyikan saat dicetak) ───────────────────────── */}
        <div className="print:hidden flex flex-wrap items-end gap-2 bg-white rounded-xl border border-slate-200 p-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Dari</label>
            <input type="date" value={dari} onChange={(e) => setDari(e.target.value)}
                   className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Sampai</label>
            <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)}
                   className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-1.5 ml-1">
            {([["minggu_lalu", "Minggu lalu"], ["minggu_ini", "Minggu ini"],
               ["30hari", "30 hari"], ["bulan_ini", "Bulan ini"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => preset(k)}
                      className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100">
                {l}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button onClick={layarPenuh}
                  className="px-4 py-2 text-sm rounded-lg bg-slate-800 text-white hover:bg-slate-700">
            Layar penuh
          </button>
          <button onClick={() => window.print()}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100">
            Cetak PDF
          </button>
        </div>

        {/* ── Judul ──────────────────────────────────────────────────────── */}
        <div className="text-center py-2">
          <h1 className="text-3xl font-bold text-slate-800">Laporan Kinerja Unit SIRS / IT</h1>
          <p className="text-lg text-slate-500 mt-1">
            {tglIndo(dari)} – {tglIndo(sampai)}
            {data && <span className="text-slate-400"> · {data.periode.hari} hari</span>}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
        )}
        {loading && <div className="text-center text-slate-400 py-10">Memuat…</div>}

        {data && !loading && (
          <>
            <Kpi data={data} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Tren data={data} dari={dari} sampai={sampai} />
              <PerPetugas data={data} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Batang judul="Aktivitas per kategori"
                      baris={data.aktivitas_per_kategori.map(r => ({ label: r.k || "-", nilai: r.total }))} />
              <Batang judul="Tiket per unit pelapor"
                      baris={data.tiket_per_unit.map(r => ({ label: r.k || "(tanpa unit)", nilai: r.total }))} />
            </div>
            <Rincian data={data} />
          </>
        )}
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { background: #fff; }
        }
      `}</style>
    </div>
  );
}

/* ── Kartu angka utama ──────────────────────────────────────────────────── */
function Kpi({ data }: { data: KinerjaLaporan }) {
  const t = data.tiket, a = data.aktivitas;
  // tanggal_selesai kosong di seluruh tiket impor WA -> SLA tak terhitung.
  // Tampilkan "belum tersedia", bukan 0%, agar tidak terbaca sebagai kinerja buruk.
  const slaAda = t.sla_total > 0;
  const tanggapAda = t.avg_menit_tanggap > 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Kartu label="Tiket masuk" nilai={t.masuk} d={delta(t.masuk, t.masuk_sebelumnya)} warna="text-sky-700" />
      <Kartu label="Tiket selesai" nilai={t.selesai} d={delta(t.selesai, t.selesai_sebelumnya)} warna="text-emerald-700" />
      <Kartu label="Kegiatan dicatat" nilai={a.total} d={delta(a.total, a.total_sebelumnya)} warna="text-violet-700" />
      <Kartu
        label={tanggapAda ? "Rata-rata waktu tanggap" : "Waktu tanggap"}
        nilai={tanggapAda ? Math.round(t.avg_menit_tanggap) : null}
        satuan="menit"
        catatan={tanggapAda ? undefined : "belum tercatat"}
        warna="text-amber-700"
      />
      {!slaAda && (
        <div className="col-span-2 lg:col-span-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
          SLA penyelesaian belum bisa dihitung untuk periode ini: tiket lama hasil impor WhatsApp
          tidak menyimpan waktu selesai. Tiket yang ditutup lewat aplikasi akan terhitung otomatis.
        </div>
      )}
      {slaAda && (
        <div className="col-span-2 lg:col-span-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm text-emerald-900">
          <b>{t.sla_tepat}</b> dari <b>{t.sla_total}</b> tiket selesai dalam ≤ {t.sla_jam} jam
          <span className="font-semibold"> ({Math.round(t.sla_persen)}%)</span>
          {t.avg_jam > 0 && <> · rata-rata penyelesaian {Math.round(t.avg_jam)} jam</>}
        </div>
      )}
    </div>
  );
}

function Kartu({ label, nilai, satuan, catatan, d, warna }: {
  label: string; nilai: number | null; satuan?: string; catatan?: string;
  d?: { teks: string; arah: "naik" | "turun" | "sama" } | null; warna: string;
}) {
  const arahWarna = d?.arah === "naik" ? "text-emerald-600" : d?.arah === "turun" ? "text-rose-600" : "text-slate-400";
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="text-sm text-slate-500">{label}</div>
      {nilai === null ? (
        <div className="text-2xl font-semibold text-slate-300 mt-2">{catatan}</div>
      ) : (
        <div className={`text-5xl font-bold mt-1 ${warna}`}>
          {nilai}{satuan && <span className="text-xl font-medium text-slate-400 ml-1.5">{satuan}</span>}
        </div>
      )}
      {d && <div className={`text-xs mt-2 ${arahWarna}`}>{d.teks}</div>}
    </div>
  );
}

/* ── Tren harian ────────────────────────────────────────────────────────── */
function Tren({ data, dari, sampai }: { data: KinerjaLaporan; dari: string; sampai: string }) {
  // Backend hanya mengirim hari yang ada kejadiannya; hari kosong diisi nol di
  // sini supaya sumbu waktu tidak bolong dan bentuk grafiknya jujur.
  const hari: { tgl: string; keg: number; tiket: number }[] = [];
  const d0 = new Date(dari + "T00:00:00"), d1 = new Date(sampai + "T00:00:00");
  for (let d = new Date(d0); d <= d1 && hari.length < 93; d.setDate(d.getDate() + 1)) {
    const k = iso(d);
    hari.push({
      tgl: k,
      keg:   data.aktivitas_per_hari.find(x => x.tanggal === k)?.jumlah ?? 0,
      tiket: data.tiket_per_hari.find(x => x.tanggal === k)?.masuk ?? 0,
    });
  }
  const maks = Math.max(1, ...hari.map(h => Math.max(h.keg, h.tiket)));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-slate-700">Sebaran harian</div>
        <div className="flex gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-sky-500 inline-block" />Tiket masuk</span>
          <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-violet-500 inline-block" />Kegiatan</span>
        </div>
      </div>
      {hari.length === 0 ? <Kosong /> : (
        <div className="flex items-end gap-1 h-44">
          {hari.map(h => {
            const tgl = new Date(h.tgl + "T00:00:00");
            return (
              <div key={h.tgl} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                <div className="w-full flex items-end justify-center gap-0.5 h-36">
                  <div className="w-1/2 bg-sky-500 rounded-t" style={{ height: `${(h.tiket / maks) * 100}%` }}
                       title={`${h.tiket} tiket`} />
                  <div className="w-1/2 bg-violet-500 rounded-t" style={{ height: `${(h.keg / maks) * 100}%` }}
                       title={`${h.keg} kegiatan`} />
                </div>
                <div className="text-[10px] text-slate-400 truncate w-full text-center">
                  {hari.length <= 31 ? `${HARI[tgl.getDay()]} ${tgl.getDate()}` : tgl.getDate()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Kontribusi per petugas ─────────────────────────────────────────────── */
function PerPetugas({ data }: { data: KinerjaLaporan }) {
  const pet = data.aktivitas_per_petugas;
  const pic = data.tiket_per_pic;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="font-semibold text-slate-700 mb-3">Kontribusi per petugas</div>
      {pet.length === 0 && pic.length === 0 ? <Kosong /> : (
        <div className="space-y-4">
          {pet.length > 0 && (
            <Batang polos judul="Kegiatan"
                    baris={pet.map(p => ({ label: p.petugas || "(tanpa nama)", nilai: p.jumlah }))} />
          )}
          {pic.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 mb-1.5">Tiket ditangani</div>
              <table className="w-full text-sm">
                <thead className="text-slate-400 text-xs">
                  <tr><th className="text-left font-medium pb-1">PIC</th>
                      <th className="text-right font-medium pb-1">Ditangani</th>
                      <th className="text-right font-medium pb-1">Selesai</th></tr>
                </thead>
                <tbody>
                  {pic.map((p, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-1.5">{p.pic || "-"}</td>
                      <td className="text-right">{p.ditangani}</td>
                      <td className="text-right text-emerald-700">{p.selesai}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Batang horizontal ──────────────────────────────────────────────────── */
function Batang({ judul, baris, polos }: {
  judul: string; baris: { label: string; nilai: number }[]; polos?: boolean;
}) {
  const maks = Math.max(1, ...baris.map(b => b.nilai));
  const isi = (
    <div className="space-y-1.5">
      {baris.length === 0 ? <Kosong /> : baris.slice(0, 10).map((b, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-40 text-sm text-slate-600 truncate shrink-0" title={b.label}>{b.label}</div>
          <div className="flex-1 bg-slate-100 rounded h-6 relative overflow-hidden">
            <div className="bg-sky-500 h-full rounded" style={{ width: `${(b.nilai / maks) * 100}%` }} />
          </div>
          <div className="w-10 text-right text-sm font-semibold text-slate-700 shrink-0">{b.nilai}</div>
        </div>
      ))}
    </div>
  );
  if (polos) return <div><div className="text-xs text-slate-500 mb-1.5">{judul}</div>{isi}</div>;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="font-semibold text-slate-700 mb-3">{judul}</div>
      {isi}
    </div>
  );
}

/* ── Rincian kegiatan & tiket tuntas ────────────────────────────────────── */
function Rincian({ data }: { data: KinerjaLaporan }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="font-semibold text-slate-700 mb-3">
        Rincian kegiatan <span className="text-slate-400 font-normal">({data.aktivitas_list.length})</span>
      </div>
      {data.aktivitas_list.length === 0 ? <Kosong /> : (
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-xs border-b border-slate-200">
            <tr>
              <th className="text-left font-medium pb-2 w-28">Tanggal</th>
              <th className="text-left font-medium pb-2 w-44">Petugas</th>
              <th className="text-left font-medium pb-2 w-32">Kategori</th>
              <th className="text-left font-medium pb-2">Kegiatan</th>
            </tr>
          </thead>
          <tbody>
            {data.aktivitas_list.map(r => (
              <tr key={r.id} className="border-b border-slate-50 align-top">
                <td className="py-1.5 text-slate-500 whitespace-nowrap">{tglIndo(r.tanggal)}</td>
                <td className="py-1.5">{r.petugas || "-"}</td>
                <td className="py-1.5"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs">{r.kategori}</span></td>
                <td className="py-1.5">{r.judul}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const Kosong = () => <div className="text-slate-400 text-sm py-6 text-center">Tidak ada data pada periode ini.</div>;
