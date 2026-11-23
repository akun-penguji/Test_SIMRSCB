# SIMRS CB — Web Edition

Sistem Informasi Manajemen Rumah Sakit versi web untuk **RSUD Cabang Bungin**, berjalan bersamaan dengan aplikasi desktop SIMRS yang sudah ada, berbagi database MariaDB yang sama tanpa mengubah skema.

---

## Arsitektur

```
┌─────────────────────────────────────────────────────┐
│                  Server Lokal RS                     │
│                                                      │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │  Desktop     │    │  SIMRS CB (Web)           │   │
│  │  SIMRS CB    │    │                           │   │
│  │  Java Swing  │    │  Frontend  :3001 (Next.js)│   │
│  └──────┬───────┘    │  Backend   :8080 (Rust)   │   │
│         │            └──────────────┬─────────────┘  │
│         └──────────────────┐        │                │
│                    ┌───────▼────────▼──────┐         │
│                    │  MariaDB :3306         │         │
│                    │  (database: sikrscb)  │         │
│                    └───────────────────────┘         │
│                                                      │
│  Nginx (reverse proxy)                               │
│    /api/*  →  :8080 (Rust backend)                  │
│    /*      →  :3001 (Next.js frontend)               │
└─────────────────────────────────────────────────────┘
         ↑
   Tailscale VPN
         ↑
   Client (PC kasir, poli, dll)
```

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Backend | Rust, Axum 0.7, SQLx 0.7 |
| Database | MariaDB (shared dengan aplikasi desktop) |
| Auth | JWT (disimpan di localStorage) |
| Network | Tailscale (tidak expose ke internet publik) |

---

## Struktur Folder

```
simrscb/
├── backend/                    # Rust Axum API
│   ├── Cargo.toml
│   ├── .env                    # DB_URL, JWT_SECRET, HOST, PORT
│   └── src/
│       ├── main.rs             # AppState, router, bind addr
│       ├── audit.rs            # Audit trail (tracker, trackersql)
│       ├── auth/
│       │   ├── jwt.rs          # Encode/decode JWT
│       │   └── middleware.rs   # AuthUser extractor
│       ├── handlers/
│       │   ├── auth.rs         # Login (tabel admin + user)
│       │   ├── pasien.rs       # CRUD pasien
│       │   ├── registrasi.rs   # Registrasi + master poli/dokter
│       │   └── simrscb.rs      # Config HOSTHYBRIDWEB + upload surat
│       ├── models/
│       │   ├── auth.rs
│       │   ├── pasien.rs
│       │   └── registrasi.rs
│       └── routes/mod.rs       # Semua endpoint /api/*
│
└── frontend/                   # Next.js App
    ├── app/
    │   ├── login/              # Halaman login
    │   └── (dashboard)/
    │       ├── layout.tsx      # Navbar 2 baris + sidebar
    │       ├── pasien/         # List & detail pasien
    │       ├── registrasi/     # List & form registrasi baru
    │       ├── surat/[jenis]/  # Form surat persetujuan/pernyataan
    │       ├── pengaturan/     # Setting RS + konfigurasi web
    │       └── [modul]/        # IGD, Rawat Jalan, Ranap, dll (skeleton)
    ├── lib/
    │   ├── api.ts              # Axios instance + semua fungsi API
    │   └── auth.ts             # Session (JWT localStorage) + hasPerm()
    └── public/
        ├── logo-rs.png         # Logo rumah sakit (kanan kop surat)
        └── logo-daerah.png     # Logo pemerintah daerah (kiri kop surat)
```

---

## Autentikasi

Login menggunakan tabel yang sudah ada tanpa mengubah skema:

```sql
-- Admin utama
SELECT * FROM admin
WHERE usere = AES_ENCRYPT(?, 'nur')
  AND passworde = AES_ENCRYPT(?, 'windi')

-- User biasa (dengan permissions)
SELECT * FROM user
WHERE id_user = AES_ENCRYPT(?, 'nur')
  AND password = AES_ENCRYPT(?, 'windi')
```

JWT payload:
```json
{
  "sub": "id_user",
  "kode": "kode_petugas",
  "nama": "Nama Lengkap",
  "is_admin": false,
  "permissions": {
    "registrasi": true,
    "kasir_ralan": false,
    "surat_persetujuan_umum": true,
    "surat_pernyataan_pasien_umum": true
  },
  "exp": 1234567890
}
```

---

## API Endpoints

### Auth
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| POST | `/api/auth/login` | Login admin/user |
| POST | `/api/auth/logout` | Logout |

### Pasien
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/pasien?q=&page=&size=` | List + search pasien |
| GET | `/api/pasien/:no_rm` | Detail pasien |
| POST | `/api/pasien` | Tambah pasien baru |
| PUT | `/api/pasien/:no_rm` | Edit pasien |

### Registrasi
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/registrasi?tgl=&poli=&page=` | List registrasi |
| GET | `/api/registrasi/:no_rawat` | Detail registrasi |
| POST | `/api/registrasi` | Buat registrasi baru |

### Master
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/master/poli` | List poli |
| GET | `/api/master/dokter?poli=` | List dokter |
| GET | `/api/master/penjab` | List penanggung jawab |
| GET | `/api/master/setting` | Data setting RS |

### Konfigurasi & Surat
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/simrscb/config` | Baca konfigurasi web |
| PUT | `/api/simrscb/config` | Simpan konfigurasi web |
| POST | `/api/surat/upload` | Upload foto/TTD surat ke filesystem |

---

## Fitur Surat

Form surat digital dengan foto pasien & tanda tangan elektronik, kompatibel dengan penyimpanan PHP webappsrscb yang sudah ada.

| Jenis (`/surat/[jenis]`) | Folder Penyimpanan |
|---|---|
| `persetujuan_umum` | `persetujuanumum/` |
| `hak_kewajiban` | `hakdankewajibanpasien/` |
| `jaminan_pasien` | `suratpernyataanjaminan/` |
| `masuk_unit` | `pernyataanmasukunit/` |
| `bersedia_igd` | `pernyataanbersediamenungguigd/` |
| `jamkesda` | `pernyataanjamkesda/` |
| `persetujuan_penolakan` | `persetujuantindakan/` |
| `jaminan_umum` | `pernyataanumum/` |

### HOSTHYBRIDWEB

Konfigurasi di menu **Pengaturan → Konfigurasi Web**:

- **Server yang Sama**: Rust menulis langsung ke path lokal (misal `/var/www/html/webappsrscb/`)
- **Server Berbeda**: Rust POST base64 ke PHP companion script di server lain, dilindungi secret key

---

## Menjalankan

### Backend (Rust)

```bash
cd backend
cp .env.example .env   # isi DB_URL, JWT_SECRET
cargo build --release
./target/release/simrscb-backend
```

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run build
npm start -- -p 3001
```

### Environment Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

### Environment Backend (`.env`)

```env
DATABASE_URL=mysql://user:password@localhost:3306/sikrscb
JWT_SECRET=ganti_dengan_secret_panjang_minimal_32_karakter
HOST=0.0.0.0
PORT=8080
```

---

## Logo RS

Taruh file berikut di folder `frontend/public/`:

| File | Keterangan |
|------|------------|
| `logo-rs.png` | Logo rumah sakit (tampil di kanan kop surat) |
| `logo-daerah.png` | Logo pemerintah daerah (tampil di kiri kop surat) |

Format: PNG, disarankan ukuran persegi (misal 200×200 px). Jika file tidak ada, logo otomatis disembunyikan.

---

## Fase Pengembangan

| Fase | Modul | Status |
|------|-------|--------|
| 1 | Auth + Pasien + Registrasi | Selesai |
| 2 | Surat Persetujuan & Pernyataan | Selesai |
| 3 | Rawat Jalan (SOAP, diagnosa, resep) | Planned |
| 4 | IGD / Gawat Darurat | Planned |
| 5 | Kasir & Billing | Planned |
| 6 | Rawat Inap | Planned |
| 7 | Inventory, BPJS, Laporan | Planned |

---

## Catatan Penting

- **Jangan ubah skema database** — aplikasi desktop masih berjalan di database yang sama
- Data setting kop surat diambil dari tabel `setting` (nama instansi, alamat, kabupaten, kontak)
- Semua perubahan data tercatat di tabel `tracker` dan `trackersql` (audit trail)
- Akses jaringan melalui Tailscale — tidak perlu port forwarding ke internet publik
