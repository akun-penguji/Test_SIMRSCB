-- MRMIK 2.2 EP 1: bukti perlindungan/keamanan fisik ruang penyimpanan RM.
-- 3 register: monitoring suhu & kelembaban, pemeriksaan APAR, dan pemeriksaan CCTV.
CREATE TABLE IF NOT EXISTS mrmik_suhu_kelembaban (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tanggal     DATE NOT NULL,
  jam         TIME NOT NULL DEFAULT '08:00:00',
  suhu        DECIMAL(4,1) DEFAULT NULL,
  kelembaban  DECIMAL(4,1) DEFAULT NULL,
  status      ENUM('Baik','Perlu Tindakan') NOT NULL DEFAULT 'Baik',
  keterangan  VARCHAR(200) DEFAULT NULL,
  nip         VARCHAR(20) DEFAULT NULL,
  created_at  DATETIME DEFAULT NOW(),
  KEY idx_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS mrmik_apar (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tanggal       DATE NOT NULL,
  lokasi        VARCHAR(100) NOT NULL,
  jenis         ENUM('Powder ABC','CO2','Foam','Air') NOT NULL DEFAULT 'Powder ABC',
  tekanan       ENUM('Hijau','Kuning','Merah') NOT NULL DEFAULT 'Hijau',
  segel         ENUM('Baik','Rusak') NOT NULL DEFAULT 'Baik',
  selang        ENUM('Baik','Rusak') NOT NULL DEFAULT 'Baik',
  kondisi_isi   ENUM('Terisi','Kosong') NOT NULL DEFAULT 'Terisi',
  tgl_kadaluarsa DATE DEFAULT NULL,
  keterangan    VARCHAR(200) DEFAULT NULL,
  nip           VARCHAR(20) DEFAULT NULL,
  created_at    DATETIME DEFAULT NOW(),
  KEY idx_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS mrmik_cctv (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  tanggal             DATE NOT NULL,
  lokasi              VARCHAR(100) NOT NULL,
  berfungsi           ENUM('Ya','Tidak') NOT NULL DEFAULT 'Ya',
  kualitas            ENUM('Baik','Cukup','Buruk') NOT NULL DEFAULT 'Baik',
  durasi_rekaman_hari INT DEFAULT NULL,
  keterangan          VARCHAR(200) DEFAULT NULL,
  nip                 VARCHAR(20) DEFAULT NULL,
  created_at          DATETIME DEFAULT NOW(),
  KEY idx_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
