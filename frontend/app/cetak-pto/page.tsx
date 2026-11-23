"use client";

// Cetak lembar PTO (Pemantauan Terapi Obat) — tata letak mengikuti form fisik
// RM, halaman print bersih, auto-print.

import { useEffect, useState } from "react";
import { ptoCetak, PtoCetak } from "@/lib/api";

const tglId = (s?: string) => {
  if (!s) return "";
  const [tgl, jam] = s.split(/[ T]/);
  const [y, m, d] = tgl.split("-");
  if (!y || !m || !d) return s;
  return `${d}-${m}-${y}${jam ? ` ${jam.slice(0, 5)}` : ""}`;
};

export default function CetakPtoPage() {
  const [d, setD] = useState<PtoCetak | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const no = p.get("no_rawat") || "";
    const tgl = p.get("tanggal") || "";
    if (!no || !tgl) { setErr("no_rawat / tanggal kosong"); return; }
    ptoCetak(no, tgl).then(r => setD(r.data)).catch(e => setErr(e instanceof Error ? e.message : "Gagal memuat"));
  }, []);
  useEffect(() => {
    if (d) { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t); }
  }, [d]);

  if (err) return <div style={{ padding: 24, fontFamily: "sans-serif", color: "#b00" }}>Gagal: {err}</div>;
  if (!d) return <div style={{ padding: 24, fontFamily: "sans-serif" }}>Memuat…</div>;

  const { rs, pasien: pas, header: h } = d;
  const sel: React.CSSProperties = { border: "1px solid #333", padding: "3px 5px", verticalAlign: "top" };
  const kepala: React.CSSProperties = { ...sel, background: "#f0f0dc", fontWeight: "bold", textAlign: "center" };

  return (
    <div style={{ fontFamily: "Tahoma, Arial, sans-serif", fontSize: 10.5, color: "#000", padding: "14px 20px", maxWidth: 900, margin: "0 auto" }}>
      <style>{`@media print { .noprint { display:none } @page { size: A4 portrait; margin: 10mm } }
        table { border-collapse: collapse; width: 100% } .blok { page-break-inside: avoid }`}</style>

      {/* Kop RS */}
      <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: "bold" }}>{rs?.nama ?? "RUMAH SAKIT"}</div>
        <div style={{ fontSize: 9 }}>{rs?.alamat}{rs?.kabupaten ? `, ${rs.kabupaten}` : ""}{rs?.propinsi ? `, ${rs.propinsi}` : ""}</div>
        <div style={{ fontSize: 9 }}>{rs?.kontak}{rs?.email ? ` · ${rs.email}` : ""}</div>
      </div>
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 12, background: "#e8e8e8", border: "1px solid #333", padding: "3px 0", marginBottom: 6 }}>
        PEMANTAUAN TERAPI OBAT
      </div>

      {/* Deskripsi pasien */}
      <div style={{ fontWeight: "bold", marginBottom: 2 }}>Deskripsi Pasien</div>
      <table className="blok" style={{ marginBottom: 6 }}>
        <tbody>
          <tr>
            <td style={{ ...sel, width: "16%" }}>No. RM</td><td style={{ ...sel, width: "34%" }}>{pas?.no_rkm_medis ?? "-"}</td>
            <td style={{ ...sel, width: "16%" }}>Tgl Lahir</td><td style={sel}>{pas?.tgl_lahir ?? "-"}</td>
          </tr>
          <tr>
            <td style={sel}>Nama Pasien</td><td style={sel}>{pas?.nama ?? "-"}</td>
            <td style={sel}>Jenis Kelamin</td><td style={sel}>{pas?.jk ?? "-"}</td>
          </tr>
          <tr>
            <td style={sel}>Ruangan</td><td style={sel}>{h.ruangan || "-"}</td>
            <td style={sel}>BB / TB</td><td style={sel}>{[h.bb && `${h.bb} kg`, h.tb && `${h.tb} cm`].filter(Boolean).join(" / ") || "-"}</td>
          </tr>
          <tr>
            <td style={sel}>Tgl Masuk</td><td style={sel}>{tglId(h.tgl_masuk) || "-"}</td>
            <td style={sel}>Alergi Obat</td><td style={sel}>{h.alergi_obat || "-"}</td>
          </tr>
          <tr>
            <td style={sel}>DPJP</td><td style={sel}>{h.dpjp || "-"}</td>
            <td style={sel}>Apoteker</td><td style={sel}>{h.apoteker || d.petugas || "-"}</td>
          </tr>
          <tr>
            <td style={sel}>Tanggal Pemantauan</td><td style={sel}>{tglId(h.tanggal)}</td>
            <td style={sel}>No. Rawat</td><td style={sel}>{d.no_rawat}</td>
          </tr>
        </tbody>
      </table>

      {[["Keluhan Utama", h.keluhan_utama],
        ["Riwayat Penyakit Sekarang", h.riwayat_penyakit_sekarang],
        ["Riwayat Penyakit Terdahulu", h.riwayat_penyakit_terdahulu],
        ["Riwayat Keluarga", h.riwayat_keluarga],
        ["Riwayat Sosial", h.riwayat_sosial]].map(([judul, isi]) => (
        <table key={judul} className="blok" style={{ marginBottom: 5 }}>
          <tbody>
            <tr><td style={{ ...sel, fontWeight: "bold", background: "#f7f7f0" }}>{judul}</td></tr>
            <tr><td style={{ ...sel, height: 34, whiteSpace: "pre-wrap" }}>{isi || ""}</td></tr>
          </tbody>
        </table>
      ))}

      {/* Riwayat penggunaan obat */}
      <div style={{ fontWeight: "bold", margin: "6px 0 2px" }}>Riwayat Penggunaan Obat</div>
      <table className="blok" style={{ marginBottom: 6 }}>
        <thead>
          <tr><th style={kepala}>Nama Obat</th><th style={{ ...kepala, width: "20%" }}>Rejimen Dosis</th>
            <th style={{ ...kepala, width: "15%" }}>Rute</th><th style={{ ...kepala, width: "20%" }}>Waktu Mulai</th></tr>
        </thead>
        <tbody>
          {(d.riwayat_obat.length ? d.riwayat_obat : [{ nama_obat: "", rejimen_dosis: "", rute: "", waktu_mulai: "" }]).map((r, i) => (
            <tr key={i}><td style={sel}>{r.nama_obat}</td><td style={sel}>{r.rejimen_dosis}</td>
              <td style={sel}>{r.rute}</td><td style={sel}>{r.waktu_mulai}</td></tr>
          ))}
        </tbody>
      </table>

      {/* Hasil pemeriksaan penunjang */}
      <div style={{ fontWeight: "bold", margin: "6px 0 2px" }}>Hasil Pemeriksaan Penunjang</div>
      <table className="blok" style={{ marginBottom: 6 }}>
        <thead>
          <tr><th style={{ ...kepala, width: "15%" }}>Tgl Pemeriksaan</th><th style={kepala}>Nama Pemeriksaan</th>
            <th style={{ ...kepala, width: "14%" }}>Hasil</th><th style={{ ...kepala, width: "12%" }}>Satuan</th>
            <th style={{ ...kepala, width: "20%" }}>Nilai Rujukan</th></tr>
        </thead>
        <tbody>
          {(d.penunjang.length ? d.penunjang : [{ tgl_pemeriksaan: "", nama_pemeriksaan: "", hasil: "", satuan: "", nilai_rujukan: "" }]).map((p, i) => (
            <tr key={i}><td style={sel}>{tglId(p.tgl_pemeriksaan)}</td><td style={sel}>{p.nama_pemeriksaan}</td>
              <td style={sel}>{p.hasil}</td><td style={sel}>{p.satuan}</td><td style={sel}>{p.nilai_rujukan}</td></tr>
          ))}
        </tbody>
      </table>

      {/* Penggunaan obat saat ini */}
      <div style={{ fontWeight: "bold", margin: "6px 0 2px" }}>Penggunaan Obat Saat Ini</div>
      <table className="blok" style={{ marginBottom: 6 }}>
        <thead>
          <tr><th style={{ ...kepala, width: "5%" }}>No</th><th style={{ ...kepala, width: "15%" }}>Tgl Mulai Terapi</th>
            <th style={kepala}>Nama Obat</th><th style={{ ...kepala, width: "22%" }}>Rejimen</th>
            <th style={{ ...kepala, width: "24%" }}>Indikasi</th></tr>
        </thead>
        <tbody>
          {(d.obat_saat_ini.length ? d.obat_saat_ini : [{ tgl_mulai_terapi: "", nama_obat: "", rejimen: "", indikasi: "" }]).map((o, i) => (
            <tr key={i}><td style={{ ...sel, textAlign: "center" }}>{o.nama_obat ? i + 1 : ""}</td>
              <td style={sel}>{tglId(o.tgl_mulai_terapi)}</td><td style={sel}>{o.nama_obat}</td>
              <td style={sel}>{o.rejimen}</td><td style={sel}>{o.indikasi}</td></tr>
          ))}
        </tbody>
      </table>

      {/* SOAP */}
      <div style={{ fontWeight: "bold", margin: "6px 0 2px" }}>SOAP</div>
      <table className="blok" style={{ marginBottom: 8 }}>
        <tbody>
          {([["S", h.soap_s], ["O", h.soap_o], ["A", h.soap_a], ["P", h.soap_p]] as [string, string][]).map(([k, v]) => (
            <tr key={k}>
              <td style={{ ...sel, width: 22, fontWeight: "bold", textAlign: "center" }}>{k}</td>
              <td style={{ ...sel, height: 44, whiteSpace: "pre-wrap" }}>{v || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Tanda tangan apoteker */}
      <div className="blok" style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <div style={{ textAlign: "center", width: 220 }}>
          <div>Apoteker</div>
          <div style={{ height: 52 }} />
          <div style={{ borderTop: "1px solid #000", paddingTop: 2 }}>{h.apoteker || d.petugas || ""}</div>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 9, textAlign: "right" }}>Dicetak: {new Date().toLocaleString("id-ID")}</div>
      <div className="noprint" style={{ marginTop: 16, textAlign: "center" }}>
        <button onClick={() => window.print()} style={{ padding: "8px 18px", fontSize: 13, cursor: "pointer" }}>🖨️ Cetak</button>
      </div>
    </div>
  );
}
