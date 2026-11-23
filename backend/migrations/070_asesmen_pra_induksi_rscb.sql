-- Asesmen Pra Induksi (RM.IBS.11.012.2026) — RSUD Cabang Bungin.
-- Terpisah dari asesmen_pra_anestesi_rscb (PAB 4: pra-anestesi & pra-induksi
-- dicatat terpisah). Field option disimpan sebagai varchar (bukan enum) agar
-- string kosong aman & konsisten dgn pola get/save berbasis string.
CREATE TABLE IF NOT EXISTS asesmen_pra_induksi_rscb (
  no_rawat varchar(17) NOT NULL,
  tanggal datetime NOT NULL,
  kd_dokter varchar(20) DEFAULT NULL,          -- dokter anestesi (penginput)
  kd_dokter_bedah varchar(20) DEFAULT NULL,    -- dokter bedah
  nip varchar(20) DEFAULT NULL,                -- petugas penginput (owner)
  diagnosa_prabedah varchar(200) NOT NULL DEFAULT '',
  tindakan_bedah varchar(200) NOT NULL DEFAULT '',
  asisten_bedah varchar(100) NOT NULL DEFAULT '',
  penata_anestesi varchar(100) NOT NULL DEFAULT '',
  alergi varchar(10) NOT NULL DEFAULT 'Tidak',
  alergi_ket varchar(200) NOT NULL DEFAULT '',
  kesulitan_jalan_nafas varchar(10) NOT NULL DEFAULT 'Tidak',
  kesulitan_jalan_nafas_ket varchar(200) NOT NULL DEFAULT '',
  resiko_perdarahan varchar(10) NOT NULL DEFAULT 'Tidak',
  sedia_darah varchar(10) NOT NULL DEFAULT 'Tidak',
  sedia_darah_jenis varchar(50) NOT NULL DEFAULT '',
  sedia_darah_ml varchar(20) NOT NULL DEFAULT '',
  mallampati varchar(5) NOT NULL DEFAULT '',
  buka_mulut varchar(20) NOT NULL DEFAULT '',
  pergerakan_leher varchar(10) NOT NULL DEFAULT '',  -- terbatas? Ya/Tidak
  asa varchar(5) NOT NULL DEFAULT '',
  rencana_ga varchar(200) NOT NULL DEFAULT '',
  rencana_ra varchar(200) NOT NULL DEFAULT '',
  puasa varchar(10) NOT NULL DEFAULT '',
  puasa_terakhir varchar(100) NOT NULL DEFAULT '',
  KEY no_rawat (no_rawat),
  KEY tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
