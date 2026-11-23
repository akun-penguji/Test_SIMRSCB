use crate::AppState;
use axum::{extract::{Path, State}, http::StatusCode, Json};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::MySqlPool;

// ─────────────────────────────────────────────────────────────
// Pola 2: hardcoded handler per form simrscb (whitelist eksplisit)
// Tiap form punya fungsi fetch_xxx() yang return Vec<BuktiSample>
// ─────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct BuktiSample {
    pub primary_key: String,        // no_surat atau no_rawat
    pub no_rawat:    String,
    pub label:       String,        // judul utama (nama pasien / pengobatan_kepada)
    pub tanggal:     String,
    pub extra:       Option<String>,
}

#[derive(Serialize)]
pub struct BuktiFormDetail {
    pub nama_form:           String,
    pub tabel_asal:          String,
    pub endpoint_api:        String,
    pub drill_url_template:  String,  // mis. "/rekam-medis/{no_rawat}/hak-kewajiban"
    pub total_records:       i64,
    pub records_30_hari:     i64,
    pub sample:              Vec<BuktiSample>,
}

#[derive(Serialize)]
pub struct BuktiEpResp {
    pub kd_ep: String,
    pub forms: Vec<BuktiFormDetail>,
}

pub async fn bukti_simrs_for_ep(
    State(state): State<AppState>,
    Path(kd_ep):  Path<String>,
) -> Result<Json<BuktiEpResp>, (StatusCode, Json<Value>)> {
    // Ambil semua nama_form yang ter-tag ke EP ini
    let forms: Vec<(String,)> = sqlx::query_as(
        "SELECT nama_form FROM form_ep_map WHERE kd_ep = ?"
    )
    .bind(&kd_ep)
    .fetch_all(&state.pool).await
    .map_err(db_err)?;

    let mut result = Vec::new();
    for (nama,) in forms {
        if let Some(detail) = fetch_bukti(&state.pool, &nama).await {
            result.push(detail);
        }
    }

    Ok(Json(BuktiEpResp { kd_ep, forms: result }))
}

// Dispatch ke handler per form (whitelist!)
async fn fetch_bukti(pool: &MySqlPool, nama_form: &str) -> Option<BuktiFormDetail> {
    match nama_form {
        "hak_kewajiban_pasien"   => Some(fetch_hak_kewajiban(pool).await),
        "persetujuan_umum"       => Some(fetch_persetujuan_umum(pool).await),
        "pernyataan_jaminan"     => Some(fetch_pernyataan_jaminan(pool).await),
        "persetujuan_satusehat"  => Some(fetch_persetujuan_satusehat(pool).await),
        "edukasi_pasien"         => Some(fetch_edukasi_pasien(pool).await),
        "materi_edukasi"         => Some(fetch_materi_edukasi(pool).await),
        "klpcm_audit"            => Some(fetch_klpcm_audit(pool).await),
        "simrs_downtime"         => Some(fetch_simrs_downtime(pool).await),
        "rm_pemusnahan"          => Some(fetch_rm_pemusnahan(pool).await),
        "laporan_rl"             => Some(fetch_laporan_rl(pool).await),
        _ => None,
    }
}

// Pintasan ke Laporan SIRS 6.3 (RL 1–5) — pelaporan RS ke Kemenkes.
// Bukan tabel tunggal; tampilkan sebagai satu entri berlink ke /laporan/sirs.
async fn fetch_laporan_rl(_pool: &MySqlPool) -> BuktiFormDetail {
    BuktiFormDetail {
        nama_form:    "Laporan SIRS 6.3 (RL) — Kemenkes".into(),
        tabel_asal:   "Laporan agregat RL 1.1 – 5".into(),
        endpoint_api: "/laporan/sirs".into(),
        drill_url_template: "/laporan/sirs".into(),
        total_records: 0, records_30_hari: 0,
        sample: vec![BuktiSample {
            primary_key: String::new(),
            no_rawat:    String::new(),
            label:       "Buka Laporan SIRS (RL 1.1 – 5) — pelaporan berkala ke Kemenkes".into(),
            tanggal:     String::new(),
            extra:       None,
        }],
    }
}

async fn fetch_rm_pemusnahan(pool: &MySqlPool) -> BuktiFormDetail {
    let total = count(pool, "SELECT COUNT(*) FROM simrscb_rm_pemusnahan").await;
    let r30   = count(pool, "SELECT COUNT(*) FROM simrscb_rm_pemusnahan WHERE tanggal_berita_acara >= DATE_SUB(NOW(), INTERVAL 30 DAY)").await;
    let sample: Vec<(i32, String, String, Option<String>, String)> = sqlx::query_as(
        "SELECT id, no_batch, judul,
                DATE_FORMAT(tanggal_berita_acara,'%Y-%m-%d') AS tgl,
                status
         FROM simrscb_rm_pemusnahan
         ORDER BY tahun_pelaksanaan DESC, id DESC LIMIT 10"
    ).fetch_all(pool).await.unwrap_or_default();

    BuktiFormDetail {
        nama_form:    "Pemusnahan RM — Berita Acara".into(),
        tabel_asal:   "simrscb_rm_pemusnahan".into(),
        endpoint_api: "/api/pemusnahan-rm/{id}".into(),
        drill_url_template: "/pemusnahan-rm/{id}".into(),
        total_records: total, records_30_hari: r30,
        sample: sample.into_iter().map(|(id, no_batch, judul, tgl, status)| BuktiSample {
            primary_key: id.to_string(),
            no_rawat:    String::new(),
            label:       format!("{} — {}", no_batch, judul),
            tanggal:     tgl.unwrap_or_else(|| "—".into()),
            extra:       Some(status),
        }).collect(),
    }
}

async fn fetch_simrs_downtime(pool: &MySqlPool) -> BuktiFormDetail {
    let total = count(pool, "SELECT COUNT(*) FROM simrscb_simrs_downtime").await;
    let r30   = count(pool, "SELECT COUNT(*) FROM simrscb_simrs_downtime WHERE tanggal_mulai >= DATE_SUB(NOW(), INTERVAL 30 DAY)").await;
    let sample: Vec<(i32, String, String, String, Option<i32>)> = sqlx::query_as(
        "SELECT id, judul, jenis,
                DATE_FORMAT(tanggal_mulai,'%Y-%m-%d %H:%i') AS tgl,
                durasi_menit
         FROM simrscb_simrs_downtime
         ORDER BY tanggal_mulai DESC, id DESC LIMIT 10"
    ).fetch_all(pool).await.unwrap_or_default();

    BuktiFormDetail {
        nama_form:    "Downtime SIMRS — Log Waktu Henti".into(),
        tabel_asal:   "simrscb_simrs_downtime".into(),
        endpoint_api: "/api/downtime/{id}".into(),
        drill_url_template: "/downtime".into(),
        total_records: total, records_30_hari: r30,
        sample: sample.into_iter().map(|(id, judul, jenis, tgl, durasi)| BuktiSample {
            primary_key: id.to_string(),
            no_rawat:    String::new(),
            label:       judul,
            tanggal:     tgl,
            extra:       Some(format!("{} · {} menit", jenis, durasi.unwrap_or(0))),
        }).collect(),
    }
}

async fn fetch_klpcm_audit(pool: &MySqlPool) -> BuktiFormDetail {
    let total = count(pool, "SELECT COUNT(*) FROM simrscb_klpcm_audit").await;
    let r30   = count(pool, "SELECT COUNT(*) FROM simrscb_klpcm_audit WHERE tanggal_audit >= DATE_SUB(NOW(), INTERVAL 30 DAY)").await;
    let sample: Vec<(i32, String, Option<String>, String, f64, String)> = sqlx::query_as(
        "SELECT id, no_rawat, nama_pasien,
                DATE_FORMAT(tanggal_audit,'%Y-%m-%d') AS tgl,
                CAST(score_total AS DOUBLE) AS score,
                status
         FROM simrscb_klpcm_audit
         ORDER BY tanggal_audit DESC, id DESC LIMIT 10"
    ).fetch_all(pool).await.unwrap_or_default();

    BuktiFormDetail {
        nama_form:    "KLPCM — Audit Kelengkapan RM".into(),
        tabel_asal:   "simrscb_klpcm_audit".into(),
        endpoint_api: "/api/klpcm/audit/{id}".into(),
        drill_url_template: "/klpcm/audit/{id}".into(),
        total_records: total, records_30_hari: r30,
        sample: sample.into_iter().map(|(id, nr, nama, tgl, score, status)| BuktiSample {
            primary_key: id.to_string(),
            no_rawat:    nr,
            label:       format!("{} (score {:.1}%)", nama.unwrap_or_default(), score),
            tanggal:     tgl,
            extra:       Some(format!("status: {}", status)),
        }).collect(),
    }
}

// ─────────────────────────────────────────────────────────────
// Implementasi per form
// ─────────────────────────────────────────────────────────────

async fn fetch_hak_kewajiban(pool: &MySqlPool) -> BuktiFormDetail {
    let total = count(pool, "SELECT COUNT(*) FROM hak_kewajiban_pasien").await;
    let r30   = count(pool, "SELECT COUNT(*) FROM hak_kewajiban_pasien WHERE tanggal >= DATE_SUB(NOW(), INTERVAL 30 DAY)").await;
    let sample: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT no_surat, no_rawat, DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal, pengobatan_kepada \
         FROM hak_kewajiban_pasien ORDER BY tanggal DESC, no_surat DESC LIMIT 10"
    ).fetch_all(pool).await.unwrap_or_default();

    BuktiFormDetail {
        nama_form:    "Hak & Kewajiban Pasien".into(),
        tabel_asal:   "hak_kewajiban_pasien".into(),
        endpoint_api: "/api/hak-kewajiban/{no_rawat}".into(),
        drill_url_template: "/rekam-medis/{no_rawat}/hak-kewajiban".into(),
        total_records: total, records_30_hari: r30,
        sample: sample.into_iter().map(|(ns, nr, tgl, nama)| BuktiSample {
            primary_key: ns, no_rawat: nr, label: nama, tanggal: tgl, extra: None,
        }).collect(),
    }
}

async fn fetch_persetujuan_umum(pool: &MySqlPool) -> BuktiFormDetail {
    let total = count(pool, "SELECT COUNT(*) FROM surat_persetujuan_umum").await;
    let r30   = count(pool, "SELECT COUNT(*) FROM surat_persetujuan_umum WHERE tanggal >= DATE_SUB(NOW(), INTERVAL 30 DAY)").await;
    let sample: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT no_surat, no_rawat, DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal, pengobatan_kepada \
         FROM surat_persetujuan_umum ORDER BY tanggal DESC, no_surat DESC LIMIT 10"
    ).fetch_all(pool).await.unwrap_or_default();

    BuktiFormDetail {
        nama_form:    "Persetujuan Umum (General Consent)".into(),
        tabel_asal:   "surat_persetujuan_umum".into(),
        endpoint_api: "/api/persetujuan-umum/{no_rawat}".into(),
        drill_url_template: "/rekam-medis/{no_rawat}/persetujuan-umum".into(),
        total_records: total, records_30_hari: r30,
        sample: sample.into_iter().map(|(ns, nr, tgl, nama)| BuktiSample {
            primary_key: ns, no_rawat: nr, label: nama, tanggal: tgl, extra: None,
        }).collect(),
    }
}

async fn fetch_pernyataan_jaminan(pool: &MySqlPool) -> BuktiFormDetail {
    let total = count(pool, "SELECT COUNT(*) FROM surat_pernyataan_jaminan_pasien").await;
    let r30   = count(pool, "SELECT COUNT(*) FROM surat_pernyataan_jaminan_pasien WHERE tanggal >= DATE_SUB(NOW(), INTERVAL 30 DAY)").await;
    let sample: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT no_surat, no_rawat, DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal, nama_pj \
         FROM surat_pernyataan_jaminan_pasien ORDER BY tanggal DESC, no_surat DESC LIMIT 10"
    ).fetch_all(pool).await.unwrap_or_default();

    BuktiFormDetail {
        nama_form:    "Pernyataan Biaya & Jaminan".into(),
        tabel_asal:   "surat_pernyataan_jaminan_pasien".into(),
        endpoint_api: "/api/pernyataan-jaminan/{no_rawat}".into(),
        drill_url_template: "/rekam-medis/{no_rawat}/pernyataan-jaminan".into(),
        total_records: total, records_30_hari: r30,
        sample: sample.into_iter().map(|(ns, nr, tgl, nama)| BuktiSample {
            primary_key: ns, no_rawat: nr, label: nama, tanggal: tgl, extra: None,
        }).collect(),
    }
}

async fn fetch_persetujuan_satusehat(pool: &MySqlPool) -> BuktiFormDetail {
    let total = count(pool, "SELECT COUNT(*) FROM simrscb_persetujuan_satusehat").await;
    let r30   = count(pool, "SELECT COUNT(*) FROM simrscb_persetujuan_satusehat WHERE tgl_persetujuan >= DATE_SUB(NOW(), INTERVAL 30 DAY)").await;
    let sample: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT no_rawat, no_rkm_medis, DATE_FORMAT(tgl_persetujuan,'%Y-%m-%d %H:%i') AS tgl, IFNULL(persetujuan,'') \
         FROM simrscb_persetujuan_satusehat ORDER BY tgl_persetujuan DESC LIMIT 10"
    ).fetch_all(pool).await.unwrap_or_default();

    BuktiFormDetail {
        nama_form:    "Persetujuan SATUSEHAT".into(),
        tabel_asal:   "simrscb_persetujuan_satusehat".into(),
        endpoint_api: "/api/persetujuan-satusehat/{no_rawat}".into(),
        drill_url_template: "/rekam-medis/{no_rawat}/persetujuan-satusehat".into(),
        total_records: total, records_30_hari: r30,
        sample: sample.into_iter().map(|(nr, rm, tgl, ps)| BuktiSample {
            primary_key: nr.clone(), no_rawat: nr, label: rm, tanggal: tgl, extra: Some(ps),
        }).collect(),
    }
}

async fn fetch_edukasi_pasien(pool: &MySqlPool) -> BuktiFormDetail {
    let total = count(pool, "SELECT COUNT(*) FROM edukasi_pasien_keluarga_rscb").await;
    let r30   = count(pool, "SELECT COUNT(*) FROM edukasi_pasien_keluarga_rscb WHERE tanggal >= DATE_SUB(NOW(), INTERVAL 30 DAY)").await;
    let sample: Vec<(String, String, Option<String>)> = sqlx::query_as(
        "SELECT e.no_rawat, DATE_FORMAT(e.tanggal,'%Y-%m-%d %H:%i') AS tanggal, IFNULL(p.nama, e.nip) \
         FROM edukasi_pasien_keluarga_rscb e \
         LEFT JOIN pegawai p ON p.nik = e.nip \
         ORDER BY e.tanggal DESC LIMIT 10"
    ).fetch_all(pool).await.unwrap_or_default();

    BuktiFormDetail {
        nama_form:    "Asesmen Edukasi Pasien & Keluarga".into(),
        tabel_asal:   "edukasi_pasien_keluarga_rscb".into(),
        endpoint_api: "/api/edukasi-pasien/{no_rawat}".into(),
        drill_url_template: "/rekam-medis/{no_rawat}/edukasi".into(),
        total_records: total, records_30_hari: r30,
        sample: sample.into_iter().map(|(nr, tgl, petugas)| BuktiSample {
            primary_key: nr.clone(),
            no_rawat: nr,
            label: petugas.unwrap_or_default(),
            tanggal: tgl,
            extra: Some("Petugas Edukasi".into()),
        }).collect(),
    }
}

async fn fetch_materi_edukasi(pool: &MySqlPool) -> BuktiFormDetail {
    let total = count(pool, "SELECT COUNT(*) FROM materi_edukasi_pasien_keluarga_rscb").await;
    let r30   = count(pool, "SELECT COUNT(*) FROM materi_edukasi_pasien_keluarga_rscb WHERE tanggal >= DATE_SUB(NOW(), INTERVAL 30 DAY)").await;
    let sample: Vec<(String, String, String, Option<String>)> = sqlx::query_as(
        "SELECT no_rawat, DATE_FORMAT(tanggal,'%Y-%m-%d') AS tanggal, TIME_FORMAT(jam,'%H:%i') AS jam, IFNULL(diberikan_pada,'') \
         FROM materi_edukasi_pasien_keluarga_rscb ORDER BY tanggal DESC, jam DESC LIMIT 10"
    ).fetch_all(pool).await.unwrap_or_default();

    BuktiFormDetail {
        nama_form:    "Pelaksanaan Materi Edukasi".into(),
        tabel_asal:   "materi_edukasi_pasien_keluarga_rscb".into(),
        endpoint_api: "/api/edukasi-pasien/{no_rawat}/materi".into(),
        drill_url_template: "/rekam-medis/{no_rawat}/edukasi/materi".into(),
        total_records: total, records_30_hari: r30,
        sample: sample.into_iter().map(|(nr, tgl, jam, diberikan)| BuktiSample {
            primary_key: nr.clone(),
            no_rawat: nr,
            label: diberikan.unwrap_or_default(),
            tanggal: format!("{} {}", tgl, jam),
            extra: None,
        }).collect(),
    }
}

// Helper
async fn count(pool: &MySqlPool, sql: &str) -> i64 {
    let row: (i64,) = sqlx::query_as(sql).fetch_one(pool).await.unwrap_or((0,));
    row.0
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error bukti_simrs: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR,
     Json(json!({"error": "Database error", "detail": e.to_string()})))
}

// ─────────────────────────────────────────────────────────────
// Auto-seed form_ep_map dari starkes_ep keyword match
// ─────────────────────────────────────────────────────────────

// (nama_form, tabel_asal, endpoint_api, pk_kolom, list keyword)
fn form_keyword_rules() -> Vec<(&'static str, &'static str, &'static str, &'static str, Vec<&'static str>)> {
    vec![
        ("hak_kewajiban_pasien",
         "hak_kewajiban_pasien",
         "/api/hak-kewajiban/{no_rawat}",
         "no_rawat",
         vec![
            "hak pasien", "hak dan kewajiban", "hak-hak pasien", "hak dan tanggung jawab",
            "hak serta tanggung jawab", "tanggung jawab pasien",
        ]),
        ("persetujuan_umum",
         "surat_persetujuan_umum",
         "/api/persetujuan-umum/{no_rawat}",
         "no_rawat",
         vec![
            "persetujuan umum", "general consent",
        ]),
        ("pernyataan_jaminan",
         "surat_pernyataan_jaminan_pasien",
         "/api/pernyataan-jaminan/{no_rawat}",
         "no_rawat",
         vec![
            "pernyataan biaya", "jaminan biaya", "pernyataan jaminan",
            "informasi biaya", "perkiraan biaya",
        ]),
        ("persetujuan_satusehat",
         "simrscb_persetujuan_satusehat",
         "/api/persetujuan-satusehat/{no_rawat}",
         "no_rawat",
         vec![
            "satusehat", "satu sehat", "satu-sehat", "rekam medis elektronik",
        ]),
        ("edukasi_pasien",
         "edukasi_pasien_keluarga_rscb",
         "/api/edukasi-pasien/{no_rawat}",
         "no_rawat",
         vec![
            "asesmen edukasi", "kebutuhan edukasi", "edukasi pasien dan keluarga",
            "edukasi kepada pasien", "kemampuan dan kemauan belajar",
        ]),
        ("materi_edukasi",
         "materi_edukasi_pasien_keluarga_rscb",
         "/api/edukasi-pasien/{no_rawat}/materi",
         "no_rawat",
         vec![
            "materi edukasi", "media edukasi", "pemberian edukasi",
            "topik edukasi", "verifikasi edukasi",
        ]),
        ("klpcm_audit",
         "simrscb_klpcm_audit",
         "/api/klpcm/audit/{id}",
         "id",
         vec![
            "pengkajian rekam medis", "pengkajian rekam", "evaluasi rekam medis",
            "review rekam medis", "ketepatan waktu", "ketepatan terbaca",
            "kelengkapan", "evaluasi penulisan", "audit pengelolaan rekam",
            "evaluasi formulir rekam",
        ]),
        ("simrs_downtime",
         "simrscb_simrs_downtime",
         "/api/downtime/{id}",
         "id",
         vec![
            "waktu henti sistem", "waktu henti", "down time", "downtime",
            "sistem henti", "henti sistem", "prosedur penanganan waktu henti",
            "evaluasi pasca terjadinya waktu",
        ]),
        ("rm_pemusnahan",
         "simrscb_rm_pemusnahan",
         "/api/pemusnahan-rm/{id}",
         "id",
         vec![
            "pemusnahan rekam medis", "pemusnahan rekam", "pemusnahan berkas",
            "pemusnahan rm", "jangka waktu penyimpanan", "retensi rekam medis",
            "retensi berkas", "berita acara pemusnahan",
            "dokumen data informasi terkait pasien dimusnahkan",
        ]),
    ]
}

#[derive(Serialize)]
pub struct AutoSeedResult {
    pub mode:           String,            // "preview" | "applied"
    pub total_ep_scanned: i64,
    pub matched:        i64,
    pub inserted:       i64,
    pub already_mapped: i64,
    pub per_form:       std::collections::BTreeMap<String, i64>,  // nama_form → count
    pub samples:        Vec<AutoSeedSample>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct AutoSeedSample {
    pub kd_ep:        String,
    pub nama_form:    String,
    pub matched_kw:   String,
}

#[derive(serde::Deserialize, Default)]
pub struct AutoSeedQuery {
    /// dry_run=true → tidak commit, hanya hitung
    #[serde(default)]
    pub dry_run: bool,
}

pub async fn auto_seed_form_ep_map(
    user: crate::auth::middleware::AuthUser,
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<AutoSeedQuery>,
) -> Result<Json<AutoSeedResult>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Hanya admin"}))));
    }
    use std::collections::BTreeMap;

    // Ambil semua EP aktif dengan teks yang bisa di-scan
    #[derive(sqlx::FromRow)]
    struct EpRow {
        kd_ep:             String,
        deskripsi:         Option<String>,
        kelengkapan_bukti: Option<String>,
        nama_standar:      Option<String>,
    }
    let eps: Vec<EpRow> = sqlx::query_as(
        "SELECT kd_ep, deskripsi, kelengkapan_bukti, nama_standar
         FROM starkes_ep
         WHERE status='aktif' OR status IS NULL"
    ).fetch_all(&state.pool).await.map_err(db_err)?;

    // Ambil mapping yang sudah ada agar tidak duplikat
    let existing: Vec<(String, String)> = sqlx::query_as(
        "SELECT kd_ep, nama_form FROM form_ep_map"
    ).fetch_all(&state.pool).await.map_err(db_err)?;
    let existing_set: std::collections::HashSet<(String, String)> =
        existing.into_iter().collect();

    let rules = form_keyword_rules();
    let mut matched = 0i64;
    let mut inserted = 0i64;
    let mut already = 0i64;
    let mut per_form: BTreeMap<String, i64> = BTreeMap::new();
    let mut samples: Vec<AutoSeedSample> = Vec::new();

    for ep in &eps {
        // Concat teks yang bisa di-scan, lower-case
        let haystack = format!(
            "{} {} {}",
            ep.deskripsi.as_deref().unwrap_or(""),
            ep.kelengkapan_bukti.as_deref().unwrap_or(""),
            ep.nama_standar.as_deref().unwrap_or(""),
        ).to_lowercase();

        for (nama_form, tabel_asal, endpoint_api, pk_kolom, kws) in &rules {
            // Kalau sudah ter-mapping, skip
            let key = (ep.kd_ep.clone(), nama_form.to_string());
            if existing_set.contains(&key) {
                already += 1;
                continue;
            }
            // Cari keyword pertama yang match
            if let Some(hit) = kws.iter().find(|kw| haystack.contains(&kw.to_lowercase())) {
                matched += 1;
                *per_form.entry(nama_form.to_string()).or_insert(0) += 1;
                if samples.len() < 30 {
                    samples.push(AutoSeedSample {
                        kd_ep:      ep.kd_ep.clone(),
                        nama_form:  nama_form.to_string(),
                        matched_kw: hit.to_string(),
                    });
                }
                if !q.dry_run {
                    let r = sqlx::query(
                        "INSERT INTO form_ep_map (kd_ep, nama_form, tabel_asal, pk_kolom, endpoint_api, catatan)
                         VALUES (?, ?, ?, ?, ?, ?)"
                    )
                    .bind(&ep.kd_ep).bind(*nama_form).bind(*tabel_asal).bind(*pk_kolom).bind(*endpoint_api)
                    .bind(format!("auto-seed via keyword \"{}\"", hit))
                    .execute(&state.pool).await;
                    match r {
                        Ok(_) => {
                            inserted += 1;
                            let sql = format!(
                                "INSERT INTO form_ep_map (kd_ep, nama_form, tabel_asal, pk_kolom, endpoint_api, catatan) VALUES ({},{},{},{},{},{})",
                                crate::audit::q(&ep.kd_ep),
                                crate::audit::q(nama_form),
                                crate::audit::q(tabel_asal),
                                crate::audit::q(pk_kolom),
                                crate::audit::q(endpoint_api),
                                crate::audit::q(format!("auto-seed via keyword \"{}\"", hit)),
                            );
                            crate::audit::log_sql(&state.pool, "web", &sql).await;
                        }
                        Err(e) => {
                            tracing::warn!("Insert form_ep_map fail ({} → {}): {}", ep.kd_ep, nama_form, e);
                        }
                    }
                }
            }
        }
    }

    Ok(Json(AutoSeedResult {
        mode: if q.dry_run { "preview".into() } else { "applied".into() },
        total_ep_scanned: eps.len() as i64,
        matched, inserted, already_mapped: already,
        per_form, samples,
    }))
}

// GET overview: total mapping + per nama_form
pub async fn form_ep_map_overview(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT nama_form, COUNT(*) FROM form_ep_map GROUP BY nama_form ORDER BY nama_form"
    ).fetch_all(&state.pool).await.map_err(db_err)?;
    let total: i64 = rows.iter().map(|(_, c)| *c).sum();
    let per_form: std::collections::BTreeMap<String, i64> = rows.into_iter().collect();
    Ok(Json(json!({
        "total_mappings": total,
        "per_form": per_form,
    })))
}
