-- ============================================================================
--  047 :: Modul Surveilans PPRA (DDD/AWaRe + Gyssens) — STRUKTUR TABEL SAJA
-- ----------------------------------------------------------------------------
--  Konvensi simrscb (Opsi 2): tabel ppra_* hidup DI DB Khanza yang sama,
--  satu pool. Read-only Khanza dijaga di level kode (hanya SELECT tabel klinis;
--  tulis hanya ke ppra_*). Charset latin1_swedish_ci agar kode_brng/no_rawat/nip
--  cocok collation saat JOIN lintas tabel Khanza.
--
--  DATA (referensi ATC/DDD + mapping) TIDAK di-seed di sini — diisi operator
--  (import CSV di halaman /atc, atau load manual seed/ppra_seed_starter.sql).
--  DDD WHO = CONTOH → WAJIB verifikasi https://atcddd.fhi.no sebelum laporan resmi.
-- ============================================================================

SET NAMES latin1;

-- ── 4.1 ppra_atc_ref :: Referensi WHO ATC/DDD + AWaRe ───────────────────────
CREATE TABLE IF NOT EXISTS ppra_atc_ref (
  atc_code       VARCHAR(10)   NOT NULL                       COMMENT 'Kode ATC WHO, mis. J01DD04',
  adm_route      ENUM('O','P','R','Inhal','Instill','other')
                 NOT NULL DEFAULT 'P'                         COMMENT 'Rute WHO: O=oral, P=parenteral',
  nama_generik   VARCHAR(120)  NOT NULL                       COMMENT 'Nama zat aktif (generik)',
  ddd            DECIMAL(12,4) NOT NULL                       COMMENT 'Nilai DDD WHO untuk rute ini',
  ddd_satuan     ENUM('g','mg','MU','TU','U','ml')
                 NOT NULL DEFAULT 'g'                         COMMENT 'Satuan DDD (mayoritas gram)',
  aware_kategori ENUM('Access','Watch','Reserve','Not_recommended')
                 NOT NULL                                     COMMENT 'Klasifikasi AWaRe WHO 2023',
  who_edisi      SMALLINT      NOT NULL DEFAULT 2025          COMMENT 'Tahun edisi WHO ATC/DDD Index',
  keterangan     VARCHAR(255)  DEFAULT NULL,
  PRIMARY KEY (atc_code, adm_route),
  KEY idx_aware   (aware_kategori),
  KEY idx_generik (nama_generik)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci
  COMMENT='PPRA: Referensi WHO ATC/DDD + AWaRe';

-- ── 4.2 ppra_map_obat :: Mapping item obat Khanza -> ATC ────────────────────
--  ATURAN: isi_satuan HARUS = ddd_satuan baris ATC-nya (lihat validasi V1).
CREATE TABLE IF NOT EXISTS ppra_map_obat (
  kode_brng      VARCHAR(15)   NOT NULL                       COMMENT 'FK logis -> databarang.kode_brng',
  atc_code       VARCHAR(10)   NOT NULL,
  adm_route      ENUM('O','P','R','Inhal','Instill','other')
                 NOT NULL DEFAULT 'P',
  isi_zat_aktif  DECIMAL(12,4) NOT NULL                       COMMENT 'Kandungan zat aktif per 1 satuan jual, dlm satuan DDD',
  isi_satuan     ENUM('g','mg','MU','TU','U','ml')
                 NOT NULL DEFAULT 'g'                         COMMENT 'Wajib = ddd_satuan pada ppra_atc_ref',
  is_antibiotik  TINYINT(1)    NOT NULL DEFAULT 1             COMMENT '1=antibiotik (masuk surveilans)',
  aktif          TINYINT(1)    NOT NULL DEFAULT 1,
  updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  keterangan     VARCHAR(255)  DEFAULT NULL,
  PRIMARY KEY (kode_brng),
  KEY idx_atc (atc_code, adm_route),
  CONSTRAINT fk_map_atc FOREIGN KEY (atc_code, adm_route)
    REFERENCES ppra_atc_ref (atc_code, adm_route)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci
  COMMENT='PPRA: Mapping obat Khanza ke WHO ATC/DDD';

-- ── 4.3 ppra_gyssens_audit :: Header audit kualitatif ───────────────────────
CREATE TABLE IF NOT EXISTS ppra_gyssens_audit (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  no_rawat      VARCHAR(17)   NOT NULL                        COMMENT 'FK logis -> reg_periksa.no_rawat',
  no_rkm_medis  VARCHAR(15)   DEFAULT NULL,
  tgl_audit     DATE          NOT NULL,
  auditor_nip   VARCHAR(20)   DEFAULT NULL                    COMMENT 'FK logis -> pegawai/petugas.nip',
  diagnosis     VARCHAR(255)  DEFAULT NULL,
  unit_smf      VARCHAR(80)   DEFAULT NULL                    COMMENT 'Unit/SMF (bangsal/instalasi)',
  catatan       TEXT          DEFAULT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_norawat (no_rawat),
  KEY idx_tgl     (tgl_audit)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci
  COMMENT='PPRA: Header audit Gyssens';

-- ── 4.4 ppra_gyssens_detail :: Hasil per antibiotik ─────────────────────────
CREATE TABLE IF NOT EXISTS ppra_gyssens_detail (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  audit_id          INT UNSIGNED NOT NULL,
  kode_brng         VARCHAR(15)  DEFAULT NULL,
  atc_code          VARCHAR(10)  DEFAULT NULL,
  adm_route         ENUM('O','P','R','Inhal','Instill','other') DEFAULT NULL,
  dosis             VARCHAR(60)  DEFAULT NULL,
  `interval`        VARCHAR(60)  DEFAULT NULL,
  durasi_hari       SMALLINT     DEFAULT NULL,
  ada_kultur        TINYINT(1)   NOT NULL DEFAULT 0,
  hasil_kultur      VARCHAR(255) DEFAULT NULL,
  kategori_gyssens  ENUM('0','I','IIA','IIB','IIC','IIIA','IIIB','IVA','IVB','IVC','IVD','V','VI')
                    NOT NULL                                  COMMENT 'Kategori Gyssens 0..VI (0=rasional)',
  catatan           VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_audit (audit_id),
  KEY idx_kat   (kategori_gyssens),
  CONSTRAINT fk_gyssens_audit FOREIGN KEY (audit_id)
    REFERENCES ppra_gyssens_audit (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci
  COMMENT='PPRA: Detail hasil audit Gyssens per antibiotik';

-- ── 4.5 ppra_config :: Parameter periode & pelaporan ────────────────────────
--  (spec: key/value; dinamai cfg_key/cfg_value krn 'key'/'value' reserved word)
CREATE TABLE IF NOT EXISTS ppra_config (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cfg_key    VARCHAR(60)  NOT NULL,
  cfg_value  VARCHAR(255) DEFAULT NULL,
  keterangan VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_key (cfg_key)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci
  COMMENT='PPRA: Konfigurasi periode & pelaporan';
