// Form perioperatif berbasis field (generik & schema-driven) — port DlgBookingOperasi.
// Tiap section = satu tabel. Kolom insert/detail dan (opsional) konfigurasi field
// di-derive dari information_schema, sehingga menambah form cukup mendaftarkan
// (section, tabel, kolom ringkas, owner). Empty string → NULL untuk kolom
// enum/date/numerik agar tidak menabrak strict mode.
//   edukasi_anestesi / sia_general / sia_regional / konversi_anestesi  (owner nip, field manual)
//   penilaian_pre_operasi / checklist_post_operasi / monitoring_anestesi (schema-derived)

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB periop_form: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}

struct FieldDef { k: &'static str, label: &'static str, typ: &'static str, opts: &'static [&'static str] }
struct FormDef {
    table: &'static str, label: &'static str, ringkas_col: &'static str,
    owner: Option<&'static str>,        // kolom pemilik (nip). None → edit terbuka utk user berwenang.
    fields: &'static [FieldDef],        // kosong → field diturunkan dari skema tabel.
    single: bool,                        // true → 1 baris per no_rawat (PK no_rawat), pakai REPLACE.
}

const T: &str = "text"; const A: &str = "area"; const S: &str = "sel";

fn form_def(section: &str) -> Option<FormDef> {
    Some(match section {
        "edukasi_anestesi" => FormDef {
            table: "edukasi_anestesi_rscb", label: "Edukasi Anestesi", ringkas_col: "jenis_anestesia", owner: Some("nip"),
            fields: &[
                FieldDef { k: "ruangan", label: "Ruangan", typ: T, opts: &[] },
                FieldDef { k: "nama_penandatangan", label: "Nama Penerima Edukasi", typ: T, opts: &[] },
                FieldDef { k: "tgl_lahir_jk", label: "Tgl Lahir / JK", typ: T, opts: &[] },
                FieldDef { k: "alamat", label: "Alamat", typ: A, opts: &[] },
                FieldDef { k: "no_telp", label: "No. Telp", typ: T, opts: &[] },
                FieldDef { k: "diagnosa", label: "Diagnosa", typ: A, opts: &[] },
                FieldDef { k: "rencana_tindakan", label: "Rencana Tindakan", typ: A, opts: &[] },
                FieldDef { k: "jenis_anestesia", label: "Jenis Anestesia", typ: T, opts: &[] },
                FieldDef { k: "kd_dokter", label: "Kode Dokter", typ: T, opts: &[] },
            ], single: false,
        },
        "konversi_anestesi" => FormDef {
            table: "konversi_anestesi_rscb", label: "Konversi Anestesi", ringkas_col: "konversi_ke", owner: Some("nip"),
            fields: &[
                FieldDef { k: "ruangan", label: "Ruangan", typ: T, opts: &[] },
                FieldDef { k: "perubahan_rencana", label: "Ada Perubahan Rencana?", typ: S, opts: &["", "Ya", "Tidak"] },
                FieldDef { k: "anestesi_awal", label: "Anestesi Awal", typ: T, opts: &[] },
                FieldDef { k: "jam_awal", label: "Jam Awal (HH:MM)", typ: T, opts: &[] },
                FieldDef { k: "konversi_ke", label: "Konversi Ke", typ: T, opts: &[] },
                FieldDef { k: "jam_konversi", label: "Jam Konversi (HH:MM)", typ: T, opts: &[] },
                FieldDef { k: "obat_lokal", label: "Obat Lokal", typ: A, opts: &[] },
                FieldDef { k: "obat_regional", label: "Obat Regional", typ: A, opts: &[] },
                FieldDef { k: "obat_epidural", label: "Obat Epidural", typ: A, opts: &[] },
                FieldDef { k: "obat_tiva", label: "Obat TIVA", typ: A, opts: &[] },
                FieldDef { k: "obat_inhalasi", label: "Obat Inhalasi", typ: A, opts: &[] },
                FieldDef { k: "obat_analgetik", label: "Obat Analgetik", typ: A, opts: &[] },
                FieldDef { k: "tehnik_jalan_napas", label: "Teknik Jalan Napas", typ: T, opts: &[] },
                FieldDef { k: "kd_dokter", label: "Kode Dokter", typ: T, opts: &[] },
            ], single: false,
        },
        "sia_general" => FormDef { table: "sia_general_rscb", label: "SIA General Anestesi", ringkas_col: "tindakan_kedokteran", owner: Some("nip"), fields: SIA_FIELDS_GENERAL, single: false },
        "sia_regional" => FormDef { table: "sia_regional_rscb", label: "SIA Regional Anestesi", ringkas_col: "tindakan_kedokteran", owner: Some("nip"), fields: SIA_FIELDS_REGIONAL, single: false },
        // Schema-derived (fields kosong): label & tipe diturunkan dari kolom tabel.
        "penilaian_pre_operasi" => FormDef { table: "penilaian_pre_operasi", label: "Penilaian Pre Operasi", ringkas_col: "diagnosa_pre_operasi", owner: None, fields: &[], single: false },
        "checklist_post_operasi" => FormDef { table: "checklist_post_operasi", label: "Checklist Post Operasi", ringkas_col: "tindakan", owner: None, fields: &[], single: false },
        "monitoring_anestesi" => FormDef { table: "catatan_anestesi_sedasi", label: "Monitoring Anestesi / Sedasi", ringkas_col: "tindakan_jenis_pembedahan", owner: None, fields: &[], single: false },
        // Satu tabel dengan form Java RMLaporanOperasi (laporan_operasi_casemix) supaya
        // data operasi yang diinput di e-Nakes tampil di Khanza desktop, dan sebaliknya.
        "laporan_operasi" => FormDef { table: "laporan_operasi_casemix", label: "Laporan Operasi", ringkas_col: "diagnosapascabedah", owner: None, fields: &[], single: false },
        "form_robson" => FormDef { table: "form_robson_klasifikasi", label: "Form Robson (Klasifikasi SC)", ringkas_col: "kelompok_robson", owner: None, fields: &[], single: true },
        // PORT tabel Khanza kosong (schema-derived), owner nip
        "reaksi_transfusi" => FormDef { table: "dugaan_reaksi_transfusi_rscb", label: "Dugaan Reaksi Transfusi", ringkas_col: "kategori_reaksi", owner: Some("nip"), fields: &[], single: false },
        "restrain" => FormDef { table: "pengkajian_restrain", label: "Pengkajian Restrain", ringkas_col: "hasil_observasi", owner: Some("nip"), fields: &[], single: true },
        "mpp_skrining" => FormDef { table: "mpp_skrining", label: "MPP — Skrining", ringkas_col: "param1", owner: Some("nip"), fields: &[], single: false },
        "mpp_evaluasi" => FormDef { table: "mpp_evaluasi", label: "MPP — Evaluasi", ringkas_col: "diagnosis", owner: Some("nip"), fields: &[], single: false },
        "orientasi_ranap" => FormDef { table: "orientasi_pasien_ranap_rscb", label: "Penerimaan & Orientasi Pasien Baru Rawat Inap", ringkas_col: "diagnosa_masuk", owner: Some("nip"), fields: &[], single: false },
        "discharge_screening" => FormDef { table: "skrining_discharge_planning_rscb", label: "Skrining Perencanaan Pulang (Discharge Planning Awal)", ringkas_col: "perlu_discharge_planning", owner: Some("nip"), fields: &[], single: false },
        "second_opinion" => FormDef { table: "permohonan_second_opinion_rscb", label: "Permohonan Pendapat Kedua (Second Opinion)", ringkas_col: "status", owner: Some("nip"), fields: &[], single: false },
        "rekonsiliasi_obat" => FormDef { table: "rekonsiliasi_obat_rscb", label: "Rekonsiliasi Obat", ringkas_col: "dilanjutkan", owner: Some("nip"), fields: &[], single: false },
        // "pto" tidak lagi di sini — Pemantauan Terapi Obat punya form khusus
        // (handlers::pto) karena punya 3 tabel detail berulang.
        "meso" => FormDef { table: "meso_rscb", label: "MESO — Monitoring Efek Samping Obat (Formulir Kuning)", ringkas_col: "obat_diduga", owner: Some("nip"), fields: &[], single: false },
        "hitung_kassa" => FormDef { table: "hitung_kassa_instrumen_rscb", label: "Hitung Kassa & Instrumen Bedah", ringkas_col: "jumlah_sesuai", owner: Some("nip"), fields: &[], single: false },
        _ => return None,
    })
}

macro_rules! sia_common {
    ($id_field:expr) => { &[
        FieldDef { k: "kd_dokter_pelaksana", label: "Kode Dokter Pelaksana", typ: T, opts: &[] },
        FieldDef { k: "kd_dokter_pemberi", label: "Kode Dokter Pemberi Info", typ: T, opts: &[] },
        FieldDef { k: "penerima_informasi", label: "Penerima Informasi", typ: T, opts: &[] },
        FieldDef { k: "diagnosis", label: "Diagnosis", typ: A, opts: &[] },
        FieldDef { k: "dasar_diagnosis", label: "Dasar Diagnosis", typ: A, opts: &[] },
        FieldDef { k: "tindakan_kedokteran", label: "Tindakan Kedokteran", typ: T, opts: &[] },
        FieldDef { k: "indikasi", label: "Indikasi", typ: A, opts: &[] },
        FieldDef { k: "tujuan", label: "Tujuan", typ: A, opts: &[] },
        FieldDef { k: "resiko", label: "Risiko", typ: A, opts: &[] },
        FieldDef { k: "komplikasi", label: "Komplikasi", typ: A, opts: &[] },
        FieldDef { k: "prognosis", label: "Prognosis", typ: T, opts: &[] },
        FieldDef { k: "alternatif", label: "Alternatif", typ: T, opts: &[] },
        FieldDef { k: "lain_lain", label: "Lain-lain", typ: A, opts: &[] },
        FieldDef { k: "persetujuan", label: "Persetujuan", typ: S, opts: &["", "Setuju", "Tolak"] },
        FieldDef { k: "nama_penyatakan", label: "Nama yang Menyatakan", typ: T, opts: &[] },
        FieldDef { k: $id_field.0, label: $id_field.1, typ: T, opts: &[] },
        FieldDef { k: "alamat", label: "Alamat", typ: A, opts: &[] },
        FieldDef { k: "hubungan", label: "Hubungan", typ: T, opts: &[] },
        FieldDef { k: "kd_dokter_anestesi", label: "Kode Dokter Anestesi", typ: T, opts: &[] },
        FieldDef { k: "nama_saksi", label: "Nama Saksi", typ: T, opts: &[] },
    ] };
}
const SIA_FIELDS_GENERAL: &[FieldDef] = sia_common!(("umur_jk", "Umur / JK"));
const SIA_FIELDS_REGIONAL: &[FieldDef] = sia_common!(("tgl_lahir_jk", "Tgl Lahir / JK"));

const SECTIONS: &[&str] = &["edukasi_anestesi", "konversi_anestesi", "sia_general", "sia_regional",
    "penilaian_pre_operasi", "checklist_post_operasi", "monitoring_anestesi", "laporan_operasi", "form_robson",
    "reaksi_transfusi", "restrain", "mpp_skrining", "mpp_evaluasi", "orientasi_ranap", "discharge_screening", "second_opinion",
    "rekonsiliasi_obat", "meso", "hitung_kassa"];

// Metadata kolom dari information_schema.
#[derive(sqlx::FromRow)]
struct ColMeta { name: String, data_type: String, column_type: String, is_nullable: String, has_default: i64 }
async fn cols_meta(s: &AppState, table: &str) -> Result<Vec<ColMeta>, (StatusCode, Json<Value>)> {
    let rows: Vec<ColMeta> = sqlx::query_as(
        "SELECT COLUMN_NAME name, DATA_TYPE data_type, COLUMN_TYPE column_type, IS_NULLABLE is_nullable, \
                (COLUMN_DEFAULT IS NOT NULL OR EXTRA LIKE '%auto_increment%') has_default \
         FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? \
           AND COLUMN_NAME NOT IN ('no_rawat','tanggal') ORDER BY ORDINAL_POSITION")
        .bind(table).fetch_all(&s.pool).await.map_err(db_err)?;
    Ok(rows)
}
fn is_stringy(dt: &str) -> bool { matches!(dt, "varchar" | "char" | "text" | "tinytext" | "mediumtext" | "longtext") }
fn humanize(col: &str) -> String {
    col.split('_').map(|w| { let mut c = w.chars(); match c.next() { Some(f) => f.to_uppercase().collect::<String>() + c.as_str(), None => String::new() } }).collect::<Vec<_>>().join(" ")
}
fn enum_opts(column_type: &str) -> Vec<String> {
    // "enum('a','b','c')" → ["","a","b","c"]
    if let (Some(a), Some(b)) = (column_type.find('('), column_type.rfind(')')) {
        let inner = &column_type[a + 1..b];
        let mut v = vec![String::new()];
        v.extend(inner.split(',').map(|x| x.trim().trim_matches('\'').replace("''", "'")));
        return v;
    }
    vec![String::new()]
}

pub async fn form_config(_u: AuthUser, State(s): State<AppState>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut secs: Vec<Value> = Vec::new();
    for k in SECTIONS {
        let Some(d) = form_def(k) else { continue };
        let fields: Vec<Value> = if !d.fields.is_empty() {
            d.fields.iter().map(|f| json!({"k": f.k, "label": f.label, "typ": f.typ, "opts": f.opts})).collect()
        } else {
            // derive dari skema
            let metas = cols_meta(&s, d.table).await?;
            metas.iter().filter(|m| Some(m.name.as_str()) != d.owner).map(|m| {
                let (typ, opts): (&str, Vec<String>) = if m.data_type == "enum" {
                    (S, enum_opts(&m.column_type))
                } else if m.data_type == "text" || m.column_type.contains("varchar(500)") || m.column_type.contains("varchar(200)") {
                    (A, vec![])
                } else { (T, vec![]) };
                json!({"k": m.name, "label": humanize(&m.name), "typ": typ, "opts": opts})
            }).collect()
        };
        secs.push(json!({"key": k, "label": d.label, "fields": fields}));
    }
    Ok(Json(json!({"sections": secs})))
}

#[derive(sqlx::FromRow)]
struct FormRingkas { tanggal: Option<String>, ringkas: String, petugas: String, milik: i64 }
#[derive(Deserialize)]
pub struct FormListQ { pub section: String, pub no_rawat: String }
pub async fn form_list(user: AuthUser, State(s): State<AppState>, Query(q): Query<FormListQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let def = form_def(&q.section).ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"seksi tidak dikenal"}))))?;
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let (petugas_sel, milik_sel, join) = match def.owner {
        Some(oc) => (
            format!("IFNULL(pg.nama, t.{oc})"),
            format!("(t.{oc} = ? OR ? = 1)"),
            "LEFT JOIN pegawai pg ON pg.nik = t.".to_string() + oc,
        ),
        None => ("''".to_string(), "1".to_string(), String::new()),
    };
    let sql = format!(
        "SELECT CAST(t.tanggal AS CHAR) tanggal, IFNULL(LEFT(t.{},60),'') ringkas, {petugas_sel} petugas, {milik_sel} milik \
         FROM {} t {join} WHERE t.no_rawat = ? ORDER BY t.tanggal DESC LIMIT 100", def.ringkas_col, def.table);
    let mut query = sqlx::query_as::<_, FormRingkas>(&sql);
    if def.owner.is_some() { query = query.bind(&user.0.kode).bind(admin); }
    let rows = query.bind(&q.no_rawat).fetch_all(&s.pool).await.map_err(db_err)?;
    let list: Vec<Value> = rows.iter().map(|r| json!({"tanggal": r.tanggal, "ringkas": r.ringkas, "petugas": r.petugas, "milik": r.milik})).collect();
    Ok(Json(json!(list)))
}

#[derive(Deserialize)]
pub struct FormDetailQ { pub section: String, pub no_rawat: String, pub tanggal: String }
pub async fn form_detail(user: AuthUser, State(s): State<AppState>, Query(q): Query<FormDetailQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let def = form_def(&q.section).ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"seksi tidak dikenal"}))))?;
    let metas = cols_meta(&s, def.table).await?;
    if metas.is_empty() { return Ok(Json(Value::Null)); }
    let sel = metas.iter().map(|c| format!("IFNULL(CAST(`{0}` AS CHAR),'') AS `{0}`", c.name)).collect::<Vec<_>>().join(", ");
    let sql = if def.single {
        format!("SELECT {sel} FROM `{}` WHERE no_rawat=? LIMIT 1", def.table)
    } else {
        format!("SELECT {sel} FROM `{}` WHERE no_rawat=? AND tanggal=? LIMIT 1", def.table)
    };
    let mut dq = sqlx::query(&sql).bind(&q.no_rawat);
    if !def.single { dq = dq.bind(&q.tanggal); }
    let row = dq.fetch_optional(&s.pool).await.map_err(db_err)?;
    let Some(row) = row else { return Ok(Json(Value::Null)); };
    use sqlx::Row;
    let mut values = serde_json::Map::new();
    for c in &metas {
        let v: String = row.try_get(c.name.as_str()).unwrap_or_default();
        values.insert(c.name.clone(), Value::String(v));
    }
    let dapat_edit = match def.owner {
        Some(oc) => user.0.is_admin || values.get(oc).and_then(|v| v.as_str()).unwrap_or("") == user.0.kode,
        None => true,
    };
    Ok(Json(json!({"values": values, "dapat_edit": dapat_edit})))
}

#[derive(Deserialize)]
pub struct FormSaveBody {
    pub section: String, pub no_rawat: String,
    #[serde(default)] pub tanggal: String,
    #[serde(default)] pub kd_dokter: String,
    #[serde(default)] pub values: std::collections::HashMap<String, String>,
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub orig_tanggal: String,
}
enum Bind { S(String), N }
pub async fn form_save(user: AuthUser, State(s): State<AppState>, Json(b): Json<FormSaveBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let def = form_def(&b.section).ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"seksi tidak dikenal"}))))?;
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    // Edit-in-place: hapus baris lama lalu insert ulang. Untuk `single` (PK no_rawat)
    // dilewati — pakai REPLACE INTO di bawah.
    if !def.single && b.edit && !b.orig_tanggal.trim().is_empty() {
        let admin: i64 = if user.0.is_admin { 1 } else { 0 };
        let (owner_clause, bind_owner) = match def.owner {
            Some(oc) => (format!(" AND ({oc}=? OR ?=1)"), true),
            None => (String::new(), false),
        };
        let dsql = format!("DELETE FROM {} WHERE no_rawat=? AND tanggal=?{}", def.table, owner_clause);
        let mut dq = sqlx::query(&dsql).bind(&b.no_rawat).bind(&b.orig_tanggal);
        if bind_owner { dq = dq.bind(&user.0.kode).bind(admin); }
        let res = dq.execute(&s.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Data tidak ditemukan / bukan milik Anda"}))));
        }
    }
    let tanggal: String = match norm_dt(&b.tanggal) {
        Some(t) => t,
        None => sqlx::query_scalar("SELECT DATE_FORMAT(NOW(),'%Y-%m-%d %H:%i:%s')").fetch_one(&s.pool).await.map_err(db_err)?,
    };
    let metas = cols_meta(&s, def.table).await?;
    let mut names: Vec<String> = vec!["no_rawat".into(), "tanggal".into()];
    let mut binds: Vec<Bind> = vec![Bind::S(b.no_rawat.clone()), Bind::S(tanggal.clone())];
    for m in &metas {
        let val = if Some(m.name.as_str()) == def.owner {
            user.0.kode.clone()
        } else if m.name == "kd_dokter" {
            let mv = b.values.get(&m.name).map(|x| x.trim().to_string()).unwrap_or_default();
            if mv.is_empty() { b.kd_dokter.trim().to_string() } else { mv }
        } else {
            b.values.get(&m.name).map(|x| x.trim().to_string()).unwrap_or_default()
        };
        names.push(m.name.clone());
        // Kolom non-string (enum/date/int) yang kosong:
        //  - NOT NULL tanpa default → beri nilai default aman (datetime→tanggal,
        //    enum→opsi pertama, numerik→0) supaya tabel spt laporan_operasi_casemix
        //    (banyak kolom NOT NULL tanpa default) tidak melanggar strict mode.
        //  - selain itu → NULL.
        if val.is_empty() && !is_stringy(&m.data_type) {
            if m.is_nullable == "NO" && m.has_default == 0 {
                let d = match m.data_type.as_str() {
                    "datetime" | "timestamp" | "date" => tanggal.clone(),
                    "enum" => enum_opts(&m.column_type).into_iter().find(|x| !x.is_empty()).unwrap_or_default(),
                    _ => "0".to_string(),
                };
                binds.push(Bind::S(d));
            } else {
                binds.push(Bind::N);
            }
        } else { binds.push(Bind::S(val)); }
    }
    let placeholders = vec!["?"; names.len()].join(",");
    let verb = if def.single { "REPLACE" } else { "INSERT" };
    let sql = format!("{} INTO {} ({}) VALUES ({})", verb, def.table, names.join(","), placeholders);
    let mut qq = sqlx::query(&sql);
    for bnd in &binds { qq = match bnd { Bind::S(v) => qq.bind(v), Bind::N => qq.bind(Option::<String>::None) }; }
    qq.execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
pub struct FormDelBody { pub section: String, pub no_rawat: String, pub tanggal: String }
pub async fn form_hapus(user: AuthUser, State(s): State<AppState>, Json(b): Json<FormDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let def = form_def(&b.section).ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"seksi tidak dikenal"}))))?;
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let (owner_clause, bind_owner) = match def.owner {
        Some(oc) => (format!(" AND ({oc}=? OR ?=1)"), true),
        None => (String::new(), false),
    };
    let dsql = if def.single {
        format!("DELETE FROM {} WHERE no_rawat=?{}", def.table, owner_clause)
    } else {
        format!("DELETE FROM {} WHERE no_rawat=? AND tanggal=?{}", def.table, owner_clause)
    };
    let mut dq = sqlx::query(&dsql).bind(&b.no_rawat);
    if !def.single { dq = dq.bind(&b.tanggal); }
    if bind_owner { dq = dq.bind(&user.0.kode).bind(admin); }
    let res = dq.execute(&s.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Data tidak ditemukan / bukan milik Anda"}))));
    }
    Ok(Json(json!({"ok": true})))
}

fn norm_dt(s: &str) -> Option<String> {
    let s = s.trim();
    if s.is_empty() { return None; }
    let s = s.replace('T', " ");
    let s = if s.len() == 16 { format!("{}:00", s) } else { s };
    Some(s)
}
