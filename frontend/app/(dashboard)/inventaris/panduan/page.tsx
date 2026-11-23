"use client";

// Panduan penggunaan modul Inventaris / Aset.

import Link from "next/link";

import InventarisNav from "@/app/(dashboard)/inventaris/InventarisNav";
export default function PanduanPage() {
  return (
    <div className="p-6 max-w-3xl space-y-6">
      <InventarisNav />
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Panduan Modul Inventaris / Aset</h1>
        <p className="text-sm text-slate-500 mt-1">Cara memakai seluruh fitur pencatatan & pemeliharaan aset RS.</p>
      </div>

      <Sec n="1" title="Daftar Aset" href="/inventaris">
        <p>Halaman utama berisi seluruh aset RS (hasil migrasi dari SIMGPS).</p>
        <ul>
          <li><B>Cari & Filter:</B> ketik nama/barcode/merk/seri, atau saring per Ruangan, Merk, Kategori.</li>
          <li><B>Foto:</B> klik thumbnail untuk memperbesar.</li>
          <li><B>Tambah / Edit / Hapus:</B> hanya untuk pengguna <B>admin</B>. Klik “+ Tambah Aset” atau tombol Edit di baris.</li>
          <li><B>Export CSV:</B> unduh data yang sedang tampil (bisa dibuka di Excel).</li>
          <li>Klik <B>nama aset</B> atau “Riwayat” untuk membuka halaman detail.</li>
        </ul>
      </Sec>

      <Sec n="2" title="Detail Aset & Riwayat" href="/inventaris">
        <p>Buka lewat nama aset di daftar. Menampilkan foto, data lengkap, QR, dan <B>riwayat kegiatan</B>.</p>
        <ul>
          <li>Tombol <B>+ Tambah Riwayat</B> untuk mencatat: <B>Kalibrasi, Maintenance, Inspeksi, Mutasi, Complain</B>.</li>
          <li>Untuk <B>Kalibrasi/Maintenance</B> isi juga <B>Jadwal Berikutnya</B> agar muncul di pengingat.</li>
          <li><B>Mutasi</B> (pindah ruangan): isi ruangan tujuan — ruangan aset otomatis diperbarui.</li>
        </ul>
      </Sec>

      <Sec n="3" title="Jadwal Kalibrasi" href="/inventaris/kalibrasi">
        <p>Daftar alat yang <B>wajib kalibrasi</B> beserta status jatuh tempo (Early Warning):</p>
        <ul>
          <li><Badge c="bg-rose-100 text-rose-700">Jatuh Tempo</Badge> sudah lewat tanggal — segera kalibrasi.</li>
          <li><Badge c="bg-amber-100 text-amber-700">Segera</Badge> ≤ 30 hari lagi.</li>
          <li><Badge c="bg-emerald-100 text-emerald-700">Terjadwal</Badge> masih aman.</li>
          <li><Badge c="bg-slate-100 text-slate-500">Belum Terjadwal</Badge> belum pernah dicatat kalibrasinya.</li>
        </ul>
        <p>Klik “Catat Kalibrasi” untuk langsung menambah riwayat kalibrasi aset.</p>
      </Sec>

      <Sec n="4" title="Scan Barcode" href="/inventaris/scan">
        <p>Untuk cek cepat sebuah alat. Arahkan <B>scanner USB</B> ke barcode, atau ketik kode lalu Enter — sistem langsung membuka detail asetnya.</p>
      </Sec>

      <Sec n="5" title="Cetak Label QR" href="/inventaris/qr">
        <p>Membuat label tempel ber-QR untuk aset.</p>
        <ul>
          <li>Saring & centang aset yang ingin dibuatkan label, lalu klik <B>Cetak</B>.</li>
          <li>QR berisi <B>barcode</B> aset — bisa dipindai scanner USB maupun kamera HP di menu Scan.</li>
          <li>Di dialog cetak, pilih printer atau “Simpan sebagai PDF”.</li>
        </ul>
      </Sec>

      <Sec n="6" title="Stok Opname" href="/inventaris/opname">
        <p>Audit fisik aset per ruangan.</p>
        <ol>
          <li>Pilih <B>Ruangan</B> dan isi <B>Petugas</B>.</li>
          <li>Scan barcode tiap alat yang ditemukan (atau centang manual). Yang ketemu jadi hijau “Ada”.</li>
          <li>Klik <B>Simpan Opname</B> — sistem mencatat mana yang <B>Ada</B> dan <B>Tidak Ditemukan</B>.</li>
          <li>Riwayat opname tampil di bawah (tanggal, ruangan, jumlah ada/tidak).</li>
        </ol>
      </Sec>

      <Sec n="7" title="Master Ruangan & Merk" href="/inventaris/master">
        <p>Merapikan penamaan. Klik <B>Ganti Nama</B> untuk mengubah sebuah ruangan/merk — <B>semua aset</B> terkait ikut diperbarui. Khusus admin.</p>
      </Sec>

      <Sec n="8" title="Dashboard" href="/inventaris/dashboard">
        <p>Ringkasan grafik: kondisi aset, status kalibrasi, nilai & jumlah per kategori, sebaran ruangan dan tahun.</p>
      </Sec>

      <Sec n="9" title="Laporan" href="/inventaris/laporan">
        <p>Cetak laporan resmi (kop RSUD + kolom tanda tangan): <B>Jadwal Kalibrasi</B>, <B>Daftar Aset</B>, atau <B>Kondisi Aset</B>, bisa disaring per ruangan. Klik <B>Cetak / Simpan PDF</B>.</p>
      </Sec>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <B>Catatan hak akses:</B> menambah, mengubah, menghapus, mutasi, opname, dan ganti master hanya bisa dilakukan pengguna <B>admin</B>. Pengguna biasa dapat melihat, mencari, mencetak label & laporan.
      </div>
    </div>
  );
}

function Sec({ n, title, href, children }: { n: string; title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="w-6 h-6 shrink-0 rounded-full bg-green-700 text-white text-xs font-bold grid place-items-center">{n}</span>
          {title}
        </h2>
        <Link href={href} className="text-xs text-green-700 hover:underline whitespace-nowrap">Buka →</Link>
      </div>
      <div className="text-sm text-slate-600 space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_ul]:space-y-0.5 [&_ol]:space-y-0.5">
        {children}
      </div>
    </section>
  );
}
function B({ children }: { children: React.ReactNode }) { return <span className="font-semibold text-slate-800">{children}</span>; }
function Badge({ c, children }: { c: string; children: React.ReactNode }) {
  return <span className={`inline-block text-xs font-semibold rounded px-2 py-0.5 ${c}`}>{children}</span>;
}
