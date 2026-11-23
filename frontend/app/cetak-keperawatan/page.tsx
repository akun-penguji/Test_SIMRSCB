"use client";

// Cetak Catatan Keperawatan (ralan/IGD & ranap) — halaman print bersih, auto-print.

import { useEffect, useState } from "react";
import { ckCetak, CkCetak } from "@/lib/api";

export default function CetakKeperawatanPage() {
  const [d, setD] = useState<CkCetak | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const jenis = p.get("jenis") || "ralan";
    const no = p.get("no_rawat") || "";
    if (!no) { setErr("no_rawat kosong"); return; }
    ckCetak(jenis, no).then(r => setD(r.data)).catch(e => setErr(e instanceof Error ? e.message : "Gagal memuat"));
  }, []);
  useEffect(() => {
    if (d) { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t); }
  }, [d]);

  if (err) return <div style={{ padding: 24, fontFamily: "sans-serif", color: "#b00" }}>Gagal: {err}</div>;
  if (!d) return <div style={{ padding: 24, fontFamily: "sans-serif" }}>Memuat…</div>;

  const rs = d.rs; const pas = d.pasien;
  const judul = d.jenis === "ranap" ? "DATA CATATAN KEPERAWATAN RAWAT INAP" : "DATA CATATAN KEPERAWATAN RAWAT JALAN";
  return (
    <div style={{ fontFamily: "Tahoma, Arial, sans-serif", fontSize: 11, color: "#000", padding: "16px 24px", maxWidth: 1000, margin: "0 auto" }}>
      <style>{`@media print { .noprint { display:none } @page { size: A4 landscape; margin: 10mm } } table{border-collapse:collapse;width:100%} th,td{border:1px solid #333;padding:3px 5px;vertical-align:top} th{background:#f0f0dc}`}</style>

      {/* Kop RS */}
      <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 6, marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: "bold" }}>{rs?.nama ?? "RUMAH SAKIT"}</div>
        <div style={{ fontSize: 10 }}>{rs?.alamat}{rs?.kabupaten ? `, ${rs.kabupaten}` : ""}{rs?.propinsi ? `, ${rs.propinsi}` : ""}</div>
        <div style={{ fontSize: 10 }}>{rs?.kontak}{rs?.email ? ` · ${rs.email}` : ""}</div>
      </div>
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 12, margin: "6px 0" }}>{judul}</div>

      {/* Identitas pasien */}
      <table style={{ marginBottom: 8, border: "none" }}>
        <tbody>
          <tr style={{ border: "none" }}>
            <td style={{ border: "none", width: 110 }}>No. Rawat</td><td style={{ border: "none" }}>: {d.no_rawat}</td>
            <td style={{ border: "none", width: 90 }}>No. RM</td><td style={{ border: "none" }}>: {pas?.no_rkm_medis ?? "-"}</td>
          </tr>
          <tr style={{ border: "none" }}>
            <td style={{ border: "none" }}>Nama Pasien</td><td style={{ border: "none" }}>: {pas?.nama ?? "-"}</td>
            <td style={{ border: "none" }}>Umur / JK</td><td style={{ border: "none" }}>: {pas?.umur ?? "-"} / {pas?.jk ?? "-"}</td>
          </tr>
          <tr style={{ border: "none" }}>
            <td style={{ border: "none" }}>Tgl. Lahir</td><td style={{ border: "none" }}>: {pas?.tgl_lahir ?? "-"}</td>
            <td style={{ border: "none" }}></td><td style={{ border: "none" }}></td>
          </tr>
        </tbody>
      </table>

      {/* Tabel catatan */}
      <table>
        <thead>
          <tr>
            <th style={{ width: 70 }}>Tanggal</th><th style={{ width: 42 }}>Jam</th>
            <th style={{ width: 52 }}>TD</th><th style={{ width: 34 }}>N</th><th style={{ width: 34 }}>RR</th><th style={{ width: 38 }}>S</th><th style={{ width: 42 }}>SpO2</th>
            <th>Uraian / Tindakan Keperawatan</th><th style={{ width: 150 }}>Perawat/Petugas</th>
          </tr>
        </thead>
        <tbody>
          {d.entries.length === 0 ? (
            <tr><td colSpan={9} style={{ textAlign: "center", color: "#777" }}>Belum ada catatan.</td></tr>
          ) : d.entries.map((e, i) => (
            <tr key={i}>
              <td>{e.tanggal}</td><td>{e.jam}</td>
              <td>{e.td}</td><td>{e.nadi}</td><td>{e.rr}</td><td>{e.suhu}</td><td>{e.spo2}</td>
              <td style={{ whiteSpace: "pre-wrap" }}>{e.uraian}</td><td>{e.petugas}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 10, fontSize: 10, textAlign: "right" }}>Dicetak: {new Date().toLocaleString("id-ID")}</div>
      <div className="noprint" style={{ marginTop: 16, textAlign: "center" }}>
        <button onClick={() => window.print()} style={{ padding: "8px 20px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>🖨️ Cetak Ulang</button>
      </div>
    </div>
  );
}
