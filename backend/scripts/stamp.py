#!/usr/bin/env python3
"""
Penempel stempel & QR ke PDF berdasarkan penanda teks, untuk TTE SOP.

Dipanggil backend Rust seperti `soffice`: spesifikasi JSON lewat stdin, hasil
JSON lewat stdout. Gambar stempel dikirim base64 di dalam spesifikasi dan tidak
pernah ditulis ke disk oleh skrip ini.

PEMBAGIAN TUGAS -- penting, dan urutannya tidak boleh dibalik:

    1. skrip ini  : tutup semua penanda, tempel stempel + QR
    2. BSrE       : tempel gambar tanda tangan di koordinat #TTD# + tanda
                    tangan kriptografis PAdES

Area #TTD# sengaja hanya ditutup (dikosongkan), tidak diisi: yang menggambar
tanda tangan di situ adalah BSrE. Dan stempel/QR WAJIB ditempel lebih dulu --
mengubah PDF setelah BSrE menandatangani, bahkan sekadar menambah gambar, akan
membuat Adobe Reader menampilkan tanda tangan sebagai tidak sah.

Penanda yang dikenali: #TTD#, #STEMPEL#, #QR#, masing-masing boleh membawa
tinggi cetaknya sendiri dalam milimeter -- #TTD:20# berarti tinggi 20mm.

Mode:
    --mode deteksi : laporkan koordinat penanda. Tidak mengubah apa pun.
    --mode tempel  : tutup penanda, tempel stempel + QR, tulis PDF hasil.
"""
import argparse
import base64
import io
import json
import re
import sys

import pdfplumber
import qrcode
from PIL import Image, ImageDraw
from pypdf import PdfReader, PdfWriter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

MM = 72.0 / 25.4
PENANDA = ("#TTD#", "#STEMPEL#", "#QR#")

# Dua gaya penanda dikenali untuk tiap slot:
#   #TTD#  dan  ${ttd}
# Gaya ${...} dipakai karena template surat RS yang sudah berjalan memakainya
# (lihat Surat Permohonan Uji Bridging TTE), jadi penyusun dokumen tidak perlu
# menghafal konvensi baru. Angka opsional adalah tinggi cetak dalam milimeter:
# "#TTD:20#" atau "${ttd:20}" berarti 20mm.
def _pola(nama):
    n = nama.strip("#").lower()
    return re.compile(r"#" + n + r"(?::(\d{1,3}))?#|\$\{" + n + r"(?::(\d{1,3}))?\}",
                      re.IGNORECASE)

POLA = {p: _pola(p) for p in PENANDA}


def cari_penanda(path):
    """Semua penanda beserta kotak batasnya.

    pdfplumber memakai sumbu-y dari ATAS (seperti PDFTextStripper.getYDirAdj()
    di PDFBox), sedangkan reportlab dan BSrE menggambar dari BAWAH. Konversi
    dilakukan di sini, sekali, supaya pemanggil tidak perlu memikirkannya lagi.
    """
    hasil = {p: [] for p in PENANDA}
    with pdfplumber.open(path) as pdf:
        for idx, page in enumerate(pdf.pages):
            tinggi_hal = float(page.height)
            for nama, pola in POLA.items():
                for m in page.search(pola, regex=True):
                    tinggi_mm = None
                    grup = pola.search(m["text"])
                    if grup:
                        # grup 1 = gaya #TTD:20#, grup 2 = gaya ${ttd:20}
                        angka = grup.group(1) or grup.group(2)
                        if angka:
                            tinggi_mm = int(angka)
                    hasil[nama].append({
                        "halaman": idx,
                        "x": round(m["x0"], 2),
                        "y_atas": round(m["top"], 2),
                        "lebar": round(m["x1"] - m["x0"], 2),
                        "tinggi": round(m["bottom"] - m["top"], 2),
                        "y_bawah": round(tinggi_hal - m["bottom"], 2),
                        "lebar_halaman": round(float(page.width), 2),
                        "tinggi_halaman": round(tinggi_hal, 2),
                        "tinggi_mm": tinggi_mm,
                    })
    return hasil


def qr_png(teks, logo_b64=None, px=600):
    """QR dengan logo di tengah, meniru `generateQRCodeWithLogoBase64` di
    `bridging/EsignServiceV2.java` supaya QR web dan desktop tampak seragam.

    Koreksi galat H (30%) bukan pilihan gaya: logo menutup bagian tengah kode,
    dan tanpa H yang tersisa tidak cukup untuk dipindai.
    """
    q = qrcode.QRCode(box_size=10, border=1,
                      error_correction=qrcode.constants.ERROR_CORRECT_H)
    q.add_data(teks)
    q.make(fit=True)
    img = q.make_image(fill_color="black", back_color="white").convert("RGBA")
    img = img.resize((px, px), Image.NEAREST)

    if logo_b64:
        logo = Image.open(io.BytesIO(base64.b64decode(logo_b64))).convert("RGBA")
        # 22% sisi QR, rasio aspek dijaga -- angka yang sama dengan versi Java.
        sisi = int(px * 0.22)
        lw, lh = logo.size
        if lw > lh:
            lw, lh = sisi, max(1, int(lh / lw * sisi))
        else:
            lw, lh = max(1, int(lw / lh * sisi)), sisi
        logo = logo.resize((lw, lh), Image.LANCZOS)

        lx, ly = (px - lw) // 2, (px - lh) // 2
        pad = max(4, int(px * 0.015))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([lx - pad, ly - pad, lx + lw + pad, ly + lh + pad],
                            radius=12, fill=(255, 255, 255, 255),
                            outline=(210, 210, 210, 255))
        img.alpha_composite(logo, (lx, ly))

    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def gambar_di(c, img_bytes, kotak, tinggi_mm):
    """Tempel gambar terpusat pada penanda, rasio aspek dijaga."""
    img = ImageReader(io.BytesIO(img_bytes))
    iw, ih = img.getSize()
    th = tinggi_mm * MM
    tw = th * iw / ih
    cx = kotak["x"] + kotak["lebar"] / 2
    cy = kotak["y_bawah"] + kotak["tinggi"] / 2
    c.drawImage(img, cx - tw / 2, cy - th / 2, width=tw, height=th, mask="auto")


def overlay_halaman(spek, temuan_hal, ukuran):
    """Satu PDF transparan untuk satu halaman: white-out + stempel + QR."""
    lebar, tinggi = ukuran
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(lebar, tinggi))

    # 1) Tutup SEMUA penanda, termasuk #TTD#. Penanda di PDF hasil Word adalah
    #    teks sungguhan -- kalau hanya ditimpa gambar, ia akan nongol di
    #    sela-selanya. Area #TTD# dibiarkan kosong untuk diisi BSrE.
    pad = 1.5
    c.setFillColorRGB(1, 1, 1)
    for kotak in temuan_hal.values():
        for k in kotak:
            c.rect(k["x"] - pad, k["y_bawah"] - pad,
                   k["lebar"] + 2 * pad, k["tinggi"] + 2 * pad, stroke=0, fill=1)

    # 2) Tanda tangan -- HANYA pada metode 'tempel'. Pada metode 'bsre' kunci
    #    ini tidak dikirim sama sekali, dan areanya dibiarkan kosong untuk diisi
    #    BSrE beserta tanda tangan kriptografisnya.
    for k in temuan_hal.get("#TTD#", []):
        if spek.get("ttd_b64"):
            gambar_di(c, base64.b64decode(spek["ttd_b64"]), k,
                      k["tinggi_mm"] or spek.get("ttd_tinggi_mm", 16))

    # 3) Stempel RS.
    for k in temuan_hal.get("#STEMPEL#", []):
        if spek.get("stempel_b64"):
            gambar_di(c, base64.b64decode(spek["stempel_b64"]), k,
                      k["tinggi_mm"] or spek.get("stempel_tinggi_mm", 22))

    # 4) QR verifikasi.
    logo = spek.get("qr_logo_b64")
    if spek.get("qr_url"):
        kotak_qr = temuan_hal.get("#QR#", [])
        if kotak_qr:
            for k in kotak_qr:
                gambar_di(c, qr_png(spek["qr_url"], logo), k,
                          k["tinggi_mm"] or spek.get("qr_tinggi_mm", 20))
        elif spek.get("qr_sudut_bila_tanpa_penanda"):
            # Tanpa penanda #QR#, QR jatuh ke sudut kanan-bawah. Diberi margin
            # 12mm supaya tidak menimpa footer pada kebanyakan tata letak SOP.
            sisi = spek.get("qr_tinggi_mm", 20) * MM
            m = 12 * MM
            img = ImageReader(io.BytesIO(qr_png(spek["qr_url"], logo)))
            c.drawImage(img, lebar - m - sisi, m, width=sisi, height=sisi, mask="auto")

    # 5) Keterangan baku BSrE di kaki halaman yang memuat tanda tangan, dengan
    #    kalimat yang sama persis seperti surat dinas RS yang sudah berjalan.
    #    Hanya dipasang pada metode 'bsre' -- menempelkannya pada dokumen yang
    #    tidak benar-benar ditandatangani BSrE adalah klaim palsu.
    if spek.get("disclaimer_bssn") and temuan_hal.get("#TTD#"):
        baris = [
            "Dokumen ini telah ditandatangani secara elektronik menggunakan sertifikat elektronik",
            "yang diterbitkan oleh Balai Besar Sertifikasi Elektronik (BSrE), "
            "Badan Siber dan Sandi Negara (BSSN).",
        ]
        c.setFillColorRGB(0.25, 0.25, 0.25)
        c.setFont("Helvetica", 6.5)
        y = 10 * MM + (len(baris) - 1) * 8
        for t in baris:
            c.drawCentredString(lebar / 2, y, t)
            y -= 8

    c.showPage()
    c.save()
    buf.seek(0)
    return buf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", required=True, choices=["deteksi", "tempel", "qr", "tag"])
    args = ap.parse_args()

    spek = json.load(sys.stdin)

    # Mode tag: laporkan SEMUA tanda bergaya #XXX# beserta koordinatnya, tanpa
    # tahu lebih dulu tanda apa yang dicari. Dipakai TTE berkas klaim, yang
    # penanda tangannya berbeda-beda per dokumen; pemanggil yang memutuskan
    # tanda mana milik siapa. Urutan dipertahankan sesuai kemunculan di dokumen,
    # karena pada dokumen lama yang seluruh tandanya '#' urutan itulah satu-
    # satunya dasar untuk memetakan tanda ke penanda tangan.
    if args.mode == "tag":
        # Dua daftar dilaporkan terpisah:
        #
        #   "tag"    — tanda bernama seperti #D017# atau #SIGN_DOKTER_1#
        #   "polos"  — SETIAP kemunculan '#', termasuk yang menyusun tanda
        #              bernama di atas
        #
        # Dokumen klaim lama memakai '#' telanjang untuk semua penanda tangan,
        # sehingga satu-satunya dasar pemetaan adalah URUTAN kemunculan. Daftar
        # "polos" sengaja tidak disaring: pemanggil yang memutuskan, karena ia
        # yang tahu berapa penanda tangan dan urutannya.
        pola_tag = re.compile(r"#[A-Za-z0-9_:\-]{1,30}#")
        tag, polos = [], []

        def kotak(m, idx, page):
            tinggi_hal = float(page.height)
            return {
                "halaman": idx,
                "x": round(m["x0"], 2),
                "y_atas": round(m["top"], 2),
                "lebar": round(m["x1"] - m["x0"], 2),
                "tinggi": round(m["bottom"] - m["top"], 2),
                "y_bawah": round(tinggi_hal - m["bottom"], 2),
                "lebar_halaman": round(float(page.width), 2),
                "tinggi_halaman": round(tinggi_hal, 2),
            }

        with pdfplumber.open(spek["pdf_masuk"]) as pdf:
            for idx, page in enumerate(pdf.pages):
                for m in page.search(pola_tag, regex=True):
                    d = kotak(m, idx, page); d["tag"] = m["text"]; tag.append(d)
                for m in page.search("#", regex=False):
                    polos.append(kotak(m, idx, page))

        # Urutkan mengikuti alur baca dokumen: halaman, lalu atas ke bawah,
        # lalu kiri ke kanan. Tanpa ini urutan mengikuti aliran teks internal
        # PDF yang tidak selalu sama dengan tampilannya.
        kunci = lambda d: (d["halaman"], round(d["y_atas"], 1), d["x"])
        tag.sort(key=kunci); polos.sort(key=kunci)

        json.dump({"ok": True, "tag": tag, "polos": polos}, sys.stdout, ensure_ascii=False)
        return 0

    # Mode qr: hanya menghasilkan gambar QR, tanpa menyentuh PDF. Dipakai saat
    # BSrE yang menggambar tanda tangan -- supaya QR di dokumen dan QR yang
    # ditanam BSrE lahir dari satu implementasi yang sama.
    if args.mode == "qr":
        png = qr_png(spek["qr_url"], spek.get("qr_logo_b64"))
        json.dump({"ok": True, "png_b64": base64.b64encode(png).decode()},
                  sys.stdout, ensure_ascii=False)
        return 0

    temuan = cari_penanda(spek["pdf_masuk"])

    if args.mode == "deteksi":
        json.dump({"ok": True, "temuan": temuan}, sys.stdout, ensure_ascii=False)
        return 0

    # Ambiguitas ditolak, tidak ditebak. Dua #TTD# berarti dokumennya keliru,
    # dan memilih salah satu secara diam-diam akan menaruh tanda tangan Direktur
    # di tempat yang tak seorang pun memeriksa. Ini cacat yang masih ada di
    # SuratSakit.java, yang diam-diam jatuh ke koordinat cadangan.
    masalah = []
    for tok in spek.get("wajib", ["#TTD#"]):
        n = len(temuan.get(tok, []))
        if n == 0:
            masalah.append(f"penanda {tok} tidak ditemukan "
                           "(dokumen hasil pindai tidak punya lapisan teks)")
        elif n > 1:
            masalah.append(f"penanda {tok} ditemukan {n} kali, harus tepat satu")
    if masalah:
        json.dump({"ok": False, "error": "; ".join(masalah), "temuan": temuan},
                  sys.stdout, ensure_ascii=False)
        return 2

    reader = PdfReader(spek["pdf_masuk"])
    writer = PdfWriter()
    for idx, page in enumerate(reader.pages):
        per_hal = {k: [x for x in v if x["halaman"] == idx] for k, v in temuan.items()}
        if any(per_hal.values()):
            ukuran = (float(page.mediabox.width), float(page.mediabox.height))
            page.merge_page(PdfReader(overlay_halaman(spek, per_hal, ukuran)).pages[0])
        writer.add_page(page)

    with open(spek["pdf_keluar"], "wb") as f:
        writer.write(f)

    json.dump({"ok": True, "temuan": temuan, "pdf_keluar": spek["pdf_keluar"]},
              sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
