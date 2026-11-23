-- MFK — Manajemen Fasilitas & Keselamatan (STARKES): register yang belum ada di Khanza.
-- K3RS insiden, Code Blue/Kode Darurat, Inspeksi APAR/Hidran, Monitoring Utilitas, HVA/Bencana.

CREATE TABLE IF NOT EXISTS simrscb_k3rs_insiden (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  tanggal        DATE NOT NULL,
  nip            VARCHAR(20) NULL,
  nama_pegawai   VARCHAR(100) NULL,
  unit           VARCHAR(80) NULL,
  jenis_peristiwa VARCHAR(60) NULL,          -- Tertusuk Jarum/Pajanan Cairan Tubuh/Kecelakaan Kerja/Terpapar B3/dll
  lokasi_kejadian VARCHAR(80) NULL,
  jenis_cidera   VARCHAR(80) NULL,
  bagian_tubuh   VARCHAR(80) NULL,
  penyebab       VARCHAR(120) NULL,
  kronologi      TEXT NULL,
  tindakan       TEXT NULL,                  -- P3K/PEP/dll
  tindak_lanjut  TEXT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'Lapor', -- Lapor/Proses/Selesai
  pelapor_nip    VARCHAR(20) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NULL,
  KEY idx_k3_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simrscb_code_blue (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  tanggal        DATE NOT NULL,
  jam_aktivasi   VARCHAR(8) NULL,
  lokasi         VARCHAR(80) NULL,
  no_rawat       VARCHAR(17) NULL,
  no_rkm_medis   VARCHAR(15) NULL,
  nama_pasien    VARCHAR(100) NULL,
  jam_tim_datang VARCHAR(8) NULL,
  response_menit INT NULL,                   -- selisih aktivasi → tim datang
  kondisi_awal   VARCHAR(120) NULL,          -- henti jantung/henti napas/penurunan kesadaran
  tindakan       TEXT NULL,                  -- RJP/defibrilasi/obat
  hasil          VARCHAR(30) NULL,           -- ROSC/Meninggal/Rujuk ICU/Stabil
  ketua_tim      VARCHAR(100) NULL,
  catatan        TEXT NULL,
  petugas_nip    VARCHAR(20) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_cb_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simrscb_apar (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  tanggal_inspeksi DATE NOT NULL,
  no_apar        VARCHAR(30) NULL,
  lokasi         VARCHAR(80) NULL,
  jenis          VARCHAR(30) NULL,           -- Powder/CO2/Foam/Hidran
  tekanan_ok     TINYINT NOT NULL DEFAULT 1,
  segel_ok       TINYINT NOT NULL DEFAULT 1,
  selang_ok      TINYINT NOT NULL DEFAULT 1,
  tgl_kadaluarsa DATE NULL,
  kondisi        VARCHAR(20) NOT NULL DEFAULT 'Baik', -- Baik/Perlu Isi Ulang/Rusak
  tindak_lanjut  TEXT NULL,
  petugas_nip    VARCHAR(20) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_apar_tanggal (tanggal_inspeksi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simrscb_utilitas (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  tanggal        DATE NOT NULL,
  jam            VARCHAR(8) NULL,
  jenis_utilitas VARCHAR(40) NOT NULL DEFAULT 'Genset', -- Genset/Listrik PLN/Air/Gas Medis/Suction/Boiler/AC Sentral
  parameter      VARCHAR(80) NULL,           -- mis. Tegangan/Solar/Tekanan O2
  nilai          VARCHAR(40) NULL,
  satuan         VARCHAR(20) NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'Normal', -- Normal/Gangguan
  keterangan     TEXT NULL,
  petugas_nip    VARCHAR(20) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_util_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- HVA — Hazard Vulnerability Analysis (penilaian kerentanan bencana tahunan).
CREATE TABLE IF NOT EXISTS simrscb_hva (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  tahun          INT NOT NULL,
  jenis_bahaya   VARCHAR(80) NOT NULL,       -- Kebakaran/Gempa/Banjir/Wabah/Ancaman Bom/Kegagalan Listrik/dll
  kategori       VARCHAR(30) NULL,           -- Alam/Teknologi/Manusia/Bahan Berbahaya
  probabilitas   TINYINT NOT NULL DEFAULT 0, -- 0..3
  dampak_manusia TINYINT NOT NULL DEFAULT 0, -- 0..3
  dampak_properti TINYINT NOT NULL DEFAULT 0,
  dampak_bisnis  TINYINT NOT NULL DEFAULT 0,
  kesiapan       TINYINT NOT NULL DEFAULT 0, -- 0..3 (makin siap makin kecil risiko relatif)
  skor           DOUBLE NULL,                -- skor risiko relatif (%)
  peringkat      INT NULL,
  mitigasi       TEXT NULL,
  petugas_nip    VARCHAR(20) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NULL,
  KEY idx_hva_tahun (tahun)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
