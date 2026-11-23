//! Modul Surveilans PPRA (DDD/AWaRe + Gyssens).
//!
//! - `surveilans`  : engine perhitungan murni (DDD, AWaRe, DU90%) + unit test.
//! - `kuantitatif` : query konsumsi Khanza (read-only) + endpoint kuantitatif.
//! - `validasi`    : V1/V2/V3 mapping (banner peringatan sebelum generate laporan).
//! - `master`      : CRUD ppra_atc_ref & ppra_map_obat + autocomplete + import CSV.
//! - `gyssens`     : audit kualitatif Gyssens (CRUD + rekap + lookup pasien).
//!
//! Konvensi: baca tabel klinis Khanza read-only (SELECT), tulis hanya ke ppra_*.

pub mod gyssens;
pub mod kuantitatif;
pub mod laporan;
pub mod master;
pub mod surveilans;
pub mod validasi;
