-- Prioritas (Rutin/Cito) permintaan lab — untuk waktu tunggu reguler vs cito (PP 3).
-- Tabel COMPANION (bukan ALTER permintaan_lab) → tidak memecah insert posisional
-- Java (permintaan_lab tetap 13 kolom). Baris tanpa entri = default 'Rutin'.
-- BELUM DIJALANKAN ke prod (menunggu keputusan; aman & additif).
CREATE TABLE IF NOT EXISTS permintaan_lab_prioritas (
  noorder    VARCHAR(20) NOT NULL PRIMARY KEY,
  prioritas  ENUM('Rutin','Cito') NOT NULL DEFAULT 'Rutin',
  nip        VARCHAR(20) DEFAULT NULL,
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
