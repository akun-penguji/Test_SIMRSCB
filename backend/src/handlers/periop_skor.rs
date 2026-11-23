// Skor pemulihan pasca-anestesi (perioperatif) — port dari DlgBookingOperasi Java:
//   Aldrette (skor_aldrette_pasca_anestesi), Steward (skor_steward_pasca_anestesi),
//   Bromage (skor_bromage_pasca_anestesi).
// Tiap tabel: PK (no_rawat, tanggal), kolom penilaian_skala{i}/penilaian_nilai{i}
// (nilai = index opsi enum, 0-based), penilaian_totalnilai (kecuali Bromage),
// keluar, instruksi, kd_dokter, nip. Kepemilikan lewat `nip` = kode user.
// Backend otoritatif: nilai & total dihitung dari index opsi terpilih.

use crate::{auth::middleware::AuthUser, AppState};
use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB periop_skor: {}", e);
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}

struct SkalaDef { label: &'static str, options: &'static [&'static str] }
struct SkorDef { table: &'static str, label: &'static str, has_total: bool, skala: &'static [SkalaDef] }

fn skor_def(section: &str) -> Option<SkorDef> {
    Some(match section {
        "aldrette" => SkorDef {
            table: "skor_aldrette_pasca_anestesi", label: "Skor Aldrette Pasca Anestesi", has_total: true,
            skala: &[
                SkalaDef { label: "Aktivitas (Gerakan)", options: &["Tidak Sanggup Menggerakan Satupun Anggota Gerak","Sanggup Gerak 2 Anggota Tubuh","Sanggup Gerak 4 Anggota Tubuh"] },
                SkalaDef { label: "Respirasi", options: &["Apnea Atau Napas Tidak Adekuat","Sesak Atau Pernapasan Sedikit Terbatas","Sanggup Bernafas Dalam Serta Disuruh Batuk"] },
                SkalaDef { label: "Sirkulasi (Tekanan Darah)", options: &["± 50% Tekanan Darah Pra Anestesi","± 20% - 50% Tekanan Darah Pra Anestesi","± 20% Tekanan Darah Pra Anestesi"] },
                SkalaDef { label: "Kesadaran", options: &["Tidak Ada Respon","Respon Terhadap Panggilan","Sadar Penuh"] },
                SkalaDef { label: "Warna Kulit", options: &["Cianosis","Pucat","Kemerahan / Normal"] },
            ],
        },
        "steward" => SkorDef {
            table: "skor_steward_pasca_anestesi", label: "Skor Steward Pasca Anestesi", has_total: true,
            skala: &[
                SkalaDef { label: "Kesadaran", options: &["Belum Respon","Bangun Jika Dipanggil","Sadar Penuh"] },
                SkalaDef { label: "Respirasi", options: &["Perlu Bantuan Bernafas","Berusaha Bernafas","Batuk / Menangis"] },
                SkalaDef { label: "Motorik", options: &["Tidak Bergerak","Gerakan Tanpa Tujuan","Gerakan Beraturan"] },
            ],
        },
        "bromage" => SkorDef {
            table: "skor_bromage_pasca_anestesi", label: "Skor Bromage Pasca Anestesi", has_total: false,
            skala: &[
                SkalaDef { label: "Blokade Motorik Tungkai", options: &["Gerakan Penuh Dari Tungkai","Tidak Mampu Extensi Tungkai","Tidak Mampu Flexi Lutut","Tidak Mampu Flexi Pergelangan Kaki"] },
            ],
        },
        _ => return None,
    })
}

const SECTIONS: &[&str] = &["aldrette", "steward", "bromage"];

// Config untuk frontend merender dropdown skala.
pub async fn skor_config(_u: AuthUser, State(_s): State<AppState>) -> Json<Value> {
    let secs: Vec<Value> = SECTIONS.iter().filter_map(|k| skor_def(k).map(|d| json!({
        "key": k, "label": d.label, "has_total": d.has_total,
        "skala": d.skala.iter().map(|s| json!({"label": s.label, "options": s.options})).collect::<Vec<_>>(),
    }))).collect();
    Json(json!({"sections": secs}))
}

#[derive(Deserialize)]
pub struct SkorListQ { pub section: String, pub no_rawat: String }
#[derive(sqlx::FromRow)]
struct SkorRingkas { tanggal: Option<String>, ringkas: String, petugas: String, milik: i64 }

pub async fn skor_list(user: AuthUser, State(s): State<AppState>, Query(q): Query<SkorListQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let def = skor_def(&q.section).ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"seksi tidak dikenal"}))))?;
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    // ringkas: Total (bila ada) atau nilai skala1 utk Bromage.
    let ringkas_expr = if def.has_total {
        "CONCAT('Total: ', IFNULL(t.penilaian_totalnilai,0))".to_string()
    } else {
        "CONCAT('Bromage ', IFNULL(t.penilaian_nilai1,0), ' — ', IFNULL(t.penilaian_skala1,'-'))".to_string()
    };
    let sql = format!(
        "SELECT CAST(t.tanggal AS CHAR) tanggal, {ringkas_expr} ringkas, \
                IFNULL(pg.nama, t.nip) petugas, (t.nip = ? OR ? = 1) milik \
         FROM {} t LEFT JOIN pegawai pg ON pg.nik = t.nip \
         WHERE t.no_rawat = ? ORDER BY t.tanggal DESC LIMIT 100", def.table);
    let rows = sqlx::query_as::<_, SkorRingkas>(&sql)
        .bind(&user.0.kode).bind(admin).bind(&q.no_rawat).fetch_all(&s.pool).await.map_err(db_err)?;
    let list: Vec<Value> = rows.iter().map(|r| json!({
        "tanggal": r.tanggal, "ringkas": r.ringkas, "petugas": r.petugas, "milik": r.milik,
    })).collect();
    Ok(Json(json!(list)))
}

#[derive(Deserialize)]
pub struct SkorDetailQ { pub section: String, pub no_rawat: String, pub tanggal: String }
pub async fn skor_detail(user: AuthUser, State(s): State<AppState>, Query(q): Query<SkorDetailQ>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let def = skor_def(&q.section).ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"seksi tidak dikenal"}))))?;
    let mut sel: Vec<String> = Vec::new();
    for i in 1..=def.skala.len() { sel.push(format!("IFNULL(penilaian_skala{i},'') skala{i}")); }
    sel.push("IFNULL(keluar,'') keluar".into());
    sel.push("IFNULL(instruksi,'') instruksi".into());
    sel.push("IFNULL(nip,'') nip".into());
    let sql = format!("SELECT {} FROM {} WHERE no_rawat=? AND tanggal=? LIMIT 1", sel.join(", "), def.table);
    let row = sqlx::query(&sql).bind(&q.no_rawat).bind(&q.tanggal).fetch_optional(&s.pool).await.map_err(db_err)?;
    let Some(row) = row else { return Ok(Json(Value::Null)); };
    use sqlx::Row;
    let mut values = serde_json::Map::new();
    for i in 1..=def.skala.len() {
        let v: String = row.try_get(format!("skala{i}").as_str()).unwrap_or_default();
        values.insert(format!("skala{i}"), Value::String(v));
    }
    for k in ["keluar", "instruksi"] {
        let v: String = row.try_get(k).unwrap_or_default();
        values.insert(k.to_string(), Value::String(v));
    }
    let owner: String = row.try_get("nip").unwrap_or_default();
    let dapat_edit = user.0.is_admin || owner == user.0.kode;
    Ok(Json(json!({"values": values, "dapat_edit": dapat_edit})))
}

#[derive(Deserialize)]
pub struct SkorSaveBody {
    pub section: String, pub no_rawat: String,
    #[serde(default)] pub tanggal: String,
    #[serde(default)] pub kd_dokter: String,
    #[serde(default)] pub skala: Vec<String>,   // teks opsi terpilih per skala (urut)
    #[serde(default)] pub keluar: String,
    #[serde(default)] pub instruksi: String,
    #[serde(default)] pub edit: bool,
    #[serde(default)] pub orig_tanggal: String,
}
enum Bind { S(String), I(i32) }
pub async fn skor_save(user: AuthUser, State(s): State<AppState>, Json(b): Json<SkorSaveBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let def = skor_def(&b.section).ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"seksi tidak dikenal"}))))?;
    if b.no_rawat.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"no_rawat wajib"}))));
    }
    // Edit-in-place: hapus baris lama milik user, lalu INSERT ulang (key tgl dipertahankan bila tak diubah).
    if b.edit && !b.orig_tanggal.trim().is_empty() {
        let admin: i64 = if user.0.is_admin { 1 } else { 0 };
        let res = sqlx::query(&format!("DELETE FROM {} WHERE no_rawat=? AND tanggal=? AND (nip=? OR ?=1)", def.table))
            .bind(&b.no_rawat).bind(&b.orig_tanggal).bind(&user.0.kode).bind(admin)
            .execute(&s.pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat mengubah"}))));
        }
    }
    // tanggal kejadian dari input; kosong → NOW()
    let tanggal: String = match norm_dt(&b.tanggal) {
        Some(t) => t,
        None => sqlx::query_scalar("SELECT DATE_FORMAT(NOW(),'%Y-%m-%d %H:%i:%s')").fetch_one(&s.pool).await.map_err(db_err)?,
    };
    // hitung nilai per skala (index opsi) + total
    let n = def.skala.len();
    let mut cols: Vec<String> = vec!["no_rawat".into(), "tanggal".into()];
    let mut binds: Vec<Bind> = vec![Bind::S(b.no_rawat.clone()), Bind::S(tanggal.clone())];
    let mut total: i32 = 0;
    for i in 0..n {
        let picked = b.skala.get(i).map(|x| x.trim()).unwrap_or("");
        let nilai = def.skala[i].options.iter().position(|o| *o == picked).map(|p| p as i32).unwrap_or(0);
        total += nilai;
        cols.push(format!("penilaian_skala{}", i + 1));
        cols.push(format!("penilaian_nilai{}", i + 1));
        binds.push(Bind::S(picked.to_string()));
        binds.push(Bind::I(nilai));
    }
    if def.has_total { cols.push("penilaian_totalnilai".into()); binds.push(Bind::I(total)); }
    for (c, v) in [("keluar", &b.keluar), ("instruksi", &b.instruksi), ("kd_dokter", &b.kd_dokter)] {
        cols.push(c.into()); binds.push(Bind::S(v.trim().to_string()));
    }
    cols.push("nip".into()); binds.push(Bind::S(user.0.kode.clone()));

    let placeholders = vec!["?"; cols.len()].join(",");
    let sql = format!("INSERT INTO {} ({}) VALUES ({})", def.table, cols.join(","), placeholders);
    let mut q = sqlx::query(&sql);
    for bnd in &binds { q = match bnd { Bind::S(s) => q.bind(s), Bind::I(i) => q.bind(i) }; }
    q.execute(&s.pool).await.map_err(db_err)?;
    Ok(Json(json!({"ok": true, "total": total})))
}

#[derive(Deserialize)]
pub struct SkorDelBody { pub section: String, pub no_rawat: String, pub tanggal: String }
pub async fn skor_hapus(user: AuthUser, State(s): State<AppState>, Json(b): Json<SkorDelBody>)
  -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let def = skor_def(&b.section).ok_or((StatusCode::BAD_REQUEST, Json(json!({"error":"seksi tidak dikenal"}))))?;
    let admin: i64 = if user.0.is_admin { 1 } else { 0 };
    let res = sqlx::query(&format!("DELETE FROM {} WHERE no_rawat=? AND tanggal=? AND (nip=? OR ?=1)", def.table))
        .bind(&b.no_rawat).bind(&b.tanggal).bind(&user.0.kode).bind(admin)
        .execute(&s.pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error":"Hanya pembuat (atau Admin) yang dapat menghapus"}))));
    }
    Ok(Json(json!({"ok": true})))
}

// 'YYYY-MM-DDTHH:MM' / 'YYYY-MM-DD HH:MM[:SS]' → 'YYYY-MM-DD HH:MM:SS'; kosong → None.
fn norm_dt(s: &str) -> Option<String> {
    let s = s.trim();
    if s.is_empty() { return None; }
    let s = s.replace('T', " ");
    let s = if s.len() == 16 { format!("{}:00", s) } else { s };
    Some(s)
}
