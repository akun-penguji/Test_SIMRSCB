pub mod alur_pasien;
pub mod info_terintegrasi;
pub mod resume_serah_terima;
pub mod kendala_pendaftaran;
pub mod aps_rekap;
pub mod mrmik_keamanan;
pub mod mrmik_integrasi;
pub mod mrmik_ikp;
pub mod keamanan_jaringan;
pub mod waktu_tunggu_lab;
pub mod auth;
pub mod bpjs;
pub mod dashboard;
pub mod farmasi;
pub mod edokter;
pub mod edokter_tte;
pub mod efarmasi;
pub mod enakes;
pub mod enakes_bundle;
pub mod enakes_surat_kontrol;
pub mod pengkajian_kep;
pub mod bms;
pub mod igd;
pub mod kasir_ralan;
pub mod kepegawaian;
pub mod laboratorium;
pub mod laporan;
pub mod pasien;
pub mod registrasi;
pub mod simrscb;
pub mod rawat_jalan;
pub mod rawat_inap;
pub mod operasi;
pub mod periop_skor;
pub mod periop_form;
pub mod pto;
pub mod mrmik;
pub mod insiden;
pub mod ppi;
pub mod kps;
pub mod skp;
pub mod prognas;
pub mod mfk;
pub mod manajemen_mutu;
 pub mod catatan_keperawatan;
pub mod fasilitas_khanza;
pub mod surat_rohani;
pub mod surat_sehat;
pub mod surat_pernyataan;
pub mod surat_skbn;
pub mod persetujuan_satusehat;
pub mod persetujuan_umum;
pub mod pernyataan_jaminan;
pub mod edukasi_pasien;
pub mod materi_edukasi;
pub mod hak_kewajiban;
pub mod antrian;
pub mod akreditasi;
pub mod eviden;
pub mod akreditasi_dokumen;
pub mod rapat;
pub mod ssa;
pub mod bukti_simrs;
pub mod laporan_farmasi;
pub mod direktur;
pub mod direktur_input;
pub mod inventaris;
pub mod sidomu;
pub mod tte_sop;
pub mod mutu_prioritas;
pub mod jam_visit;
pub mod risiko_jatuh;
pub mod kepatuhan_cp;
pub mod audit_edukasi;
pub mod manajemen_risiko;
pub mod barang;
pub mod persediaan;
pub mod singkatan;
pub mod ppra_bot;
pub mod simgps_api;
pub mod lapor_it;
pub mod permintaan_fitur;
pub mod kinerja_it;
pub mod dokumen_gen;
pub mod mutu;
pub mod evaluasi_pendaftaran;
pub mod pps;
pub mod hsi;
pub mod penilaian;
pub mod log_kinerja;
pub mod kb_pelayanan;
pub mod sirs;
pub mod web_perms;
pub mod aplicare;
pub mod klpcm;
pub mod downtime;
pub mod rm_pemusnahan;
pub mod anjungan_walkin;
pub mod anjungan_admin;
pub mod monev;
pub mod bridging_bpjs;
pub mod anjungan_bpjs;
pub mod ppra;
pub mod mobilejkn;
pub mod siranap;
pub mod satusehat;
pub mod sirs_bot;

/// Kode `penjab.kd_pj` untuk BPJS yang benar-benar ada di database.
///
/// Toleran terhadap migrasi kode `'A02'` → `'BPJ'`: dipilih yang eksis di tabel
/// `penjab`, `'BPJ'` diutamakan bila keduanya ada. Jangan hardcode kode BPJS di
/// handler — INSERT `reg_periksa` dengan kode yang tidak ada akan kena FK error.
pub async fn kd_pj_bpjs(pool: &sqlx::MySqlPool) -> String {
    sqlx::query_scalar::<_, String>(
        "SELECT kd_pj FROM penjab WHERE kd_pj IN ('BPJ','A02') \
         ORDER BY FIELD(kd_pj,'BPJ','A02') LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| "A02".to_string())
}
pub mod qr;
pub mod abk;
pub mod verify;

