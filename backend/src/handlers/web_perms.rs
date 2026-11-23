// Permission system web (di luar permission Khanza di tabel `user`).
// Disimpan di `simrscb_user_permissions` (key-value per NIP).

use crate::{auth::middleware::AuthUser, AppState};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))
}

// ── Registry ─────────────────────────────────────────────────────────────────
// (key, label, kategori)
pub const WEB_PERMISSIONS: &[(&str, &str, &str)] = &[
    // Laporan SIRS 6.3
    ("sirs_view",            "Lihat Laporan SIRS",                       "SIRS"),
    ("sirs_edit",            "Edit Form SIRS Manual",                    "SIRS"),
    // Akseptor KB transaksional
    ("kb_pelayanan_view",    "Lihat Daftar Akseptor KB",                 "KB"),
    ("kb_pelayanan_edit",    "Input / Edit Akseptor KB",                 "KB"),
    // Akreditasi
    ("akreditasi_view",      "Lihat Modul Akreditasi",                   "Akreditasi"),
    ("akreditasi_edit",      "Edit Elemen Akreditasi (semua bab)",       "Akreditasi"),
    // Evaluasi Pendaftaran (AKP 2b)
    ("evaluasi_pendaftaran_view", "Lihat Evaluasi Pendaftaran",              "Evaluasi Pendaftaran"),
    ("evaluasi_pendaftaran_edit", "Isi/Simpan Catatan Evaluasi Pendaftaran", "Evaluasi Pendaftaran"),
    // Log Kinerja Pegawai
    ("log_kinerja_view_all", "Lihat Log Kinerja Semua Pegawai (HRD/atasan)", "Log Kinerja"),
    // BPJS Aplicare bed sync
    ("aplicare_view",        "Lihat Monitor BPJS Aplicare",                 "BPJS Aplicare"),
    ("aplicare_sync",        "Trigger Sync / Clear Log Aplicare",           "BPJS Aplicare"),
    // Antrean Mobile JKN (kirim task-id)
    ("mobilejkn_view",       "Lihat Dashboard Antrean Mobile JKN",          "Antrean Mobile JKN"),
    ("mobilejkn_send",       "Kirim task-id manual ke BPJS (Antrean)",      "Antrean Mobile JKN"),
    // SIRANAP (ketersediaan TT ke RS Online v3)
    ("siranap_view",         "Lihat Monitor SIRANAP (Ketersediaan TT)",     "SIRANAP"),
    ("siranap_sync",         "Trigger Sync / Clear Log SIRANAP",            "SIRANAP"),
    // SatuSehat (FHIR RME)
    ("satusehat_view",       "Lihat Monitor SatuSehat (RME)",               "SatuSehat"),
    ("satusehat_sync",       "Trigger Sync / Clear Log SatuSehat",          "SatuSehat"),
    // KLPCM (Audit Kelengkapan RM)
    ("klpcm_view",           "Lihat KLPCM Audit RM (komite RM)",            "KLPCM (Audit RM)"),
    ("klpcm_audit",          "Sampling / Edit / Finalisasi Audit RM",       "KLPCM (Audit RM)"),
    // Downtime SIMRS (MRMIK 13.1)
    ("downtime_view",        "Lihat Log Downtime SIMRS",                    "Downtime SIMRS"),
    ("downtime_edit",        "Input / Edit / Hapus Log Downtime",           "Downtime SIMRS"),
    // Retensi & Pemusnahan RM (MRMIK 11.b/c)
    ("pemusnahan_rm_view",   "Lihat Daftar Pemusnahan RM",                  "Pemusnahan RM"),
    ("pemusnahan_rm_edit",   "Buat / Edit / Hapus Batch Pemusnahan RM",     "Pemusnahan RM"),
    // Pendaftaran & Pasien
    ("pasien_view",          "Lihat Data Pasien",                           "Pasien & Registrasi"),
    ("pasien_edit",          "Tambah / Edit Pasien",                        "Pasien & Registrasi"),
    ("registrasi_view",      "Lihat Registrasi",                            "Pasien & Registrasi"),
    ("registrasi_edit",      "Buat / Edit Registrasi",                      "Pasien & Registrasi"),
    // Dashboard Direktur / Eksekutif (keuangan, BPJS, operasional, SDM)
    ("direktur_view",        "Lihat Dashboard Direktur/Eksekutif",          "Direktur"),
    // Surat & Persetujuan Pasien
    ("consent_view",         "Lihat Surat & Persetujuan Pasien",            "Surat & Persetujuan"),
    ("consent_edit",         "Buat / Edit Surat & Persetujuan Pasien",      "Surat & Persetujuan"),
    ("surat_keterangan_sehat","Surat Keterangan Sehat / Rohani",            "Surat & Persetujuan"),
    ("surat_bebas_narkoba",  "Surat Keterangan Bebas Narkoba",              "Surat & Persetujuan"),
    // PPRA — Surveilans Antimikroba (Prognas 6)
    ("ppra_view",            "Lihat Surveilans PPRA (Antimikroba)",         "PPRA"),
    ("ppra_edit",            "Kelola Mapping / ATC / Audit Gyssens PPRA",   "PPRA"),
    // Monev SIMRS (WBK)
    ("monev_view",           "Lihat Monev SIMRS",                           "Monev (WBK)"),
    ("monev_edit",           "Input / Edit Monev SIMRS",                    "Monev (WBK)"),
    // Dokumentasi Rapat (bukti pertemuan lintas komite/unit)
    ("rapat_view",           "Lihat Dokumentasi Rapat",                     "Dokumentasi Rapat"),
    ("rapat_edit",           "Input / Edit Dokumentasi Rapat",              "Dokumentasi Rapat"),
    ("ssa_view",             "Lihat Self Security Assessment",              "Keamanan Informasi"),
    ("ssa_edit",             "Isi / Edit Self Security Assessment",         "Keamanan Informasi"),
];

// Per-bab akreditasi: load dinamis dari tabel `starkes_bab` (kalau ada),
// keyformat = "akreditasi_bab_<kode_bab>"
pub fn akreditasi_bab_perm_key(kode_bab: &str) -> String {
    format!("akreditasi_bab_{}", kode_bab.to_lowercase().replace(' ', "_"))
}

// ── Helper: cek permission ──────────────────────────────────────────────────
// Pattern existing: user.0.permissions.get(KEY).copied().unwrap_or(false)
// is_admin selalu lolos.
pub fn has_perm(user: &AuthUser, key: &str) -> bool {
    user.0.is_admin || user.0.permissions.get(key).copied().unwrap_or(false)
}

pub fn require_perm(user: &AuthUser, key: &str) -> Result<(), (StatusCode, Json<Value>)> {
    if has_perm(user, key) {
        Ok(())
    } else {
        Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": format!("Permission '{}' tidak ada", key) })),
        ))
    }
}

/// Izin menyimpan surat/persetujuan pasien. Selaras dgn gate frontend: lolos bila
/// punya `consent_edit` (izin custom simrscb) ATAU izin menu surat Khanza
/// (`surat_persetujuan_umum` / `surat_pernyataan_pasien_umum`). Mencegah kasus
/// "form bisa dibuka tapi gagal simpan" akibat mismatch key. is_admin selalu lolos.
pub fn require_consent_edit(user: &AuthUser) -> Result<(), (StatusCode, Json<Value>)> {
    if has_perm(user, "consent_edit")
        || has_perm(user, "surat_persetujuan_umum")
        || has_perm(user, "surat_pernyataan_pasien_umum")
    {
        Ok(())
    } else {
        Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Tidak punya izin menyimpan surat/persetujuan (butuh akses menu Surat & Persetujuan atau izin consent_edit)" })),
        ))
    }
}

// ── Load web permissions dari DB untuk satu user (saat login) ───────────────
// Return map<key, bool>. Permission yang tidak ada di DB → false default.
pub async fn load_web_perms_for(
    pool: &sqlx::MySqlPool,
    nip: &str,
) -> std::collections::HashMap<String, bool> {
    let rows: Vec<(String, i8)> = sqlx::query_as(
        "SELECT perm_key, enabled FROM simrscb_user_permissions WHERE nip=?"
    )
    .bind(nip)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut map = std::collections::HashMap::new();
    for (k, v) in rows {
        map.insert(k, v == 1);
    }
    map
}

// ── Middleware helpers (untuk wrap router groups) ──────────────────────────
// Pattern: GET/HEAD = view; PUT/POST/PATCH/DELETE = edit.
// Bisa di-apply via `.route_layer(axum::middleware::from_fn(gate_sirs))`.

use axum::{
    body::Body,
    extract::Request,
    http::{Method, StatusCode as HttpStatus},
    middleware::Next,
    response::{IntoResponse, Response},
};

fn is_write(method: &Method) -> bool {
    matches!(*method, Method::PUT | Method::POST | Method::PATCH | Method::DELETE)
}

fn forbidden(msg: &str) -> Response {
    (HttpStatus::FORBIDDEN, Json(json!({ "error": msg }))).into_response()
}

pub async fn gate_sirs(user: AuthUser, req: Request<Body>, next: Next) -> Response {
    let key = if is_write(req.method()) { "sirs_edit" } else { "sirs_view" };
    if has_perm(&user, key) { next.run(req).await }
    else { forbidden(&format!("Permission '{}' diperlukan", key)) }
}

pub async fn gate_kb(user: AuthUser, req: Request<Body>, next: Next) -> Response {
    let key = if is_write(req.method()) { "kb_pelayanan_edit" } else { "kb_pelayanan_view" };
    if has_perm(&user, key) { next.run(req).await }
    else { forbidden(&format!("Permission '{}' diperlukan", key)) }
}

pub async fn gate_akreditasi(user: AuthUser, req: Request<Body>, next: Next) -> Response {
    let key = if is_write(req.method()) { "akreditasi_edit" } else { "akreditasi_view" };
    if has_perm(&user, key) { next.run(req).await }
    else { forbidden(&format!("Permission '{}' diperlukan", key)) }
}

// ── Admin endpoints ──────────────────────────────────────────────────────────
// Hanya Admin Utama yang bisa akses. Pattern: cek user.0.is_admin di sini.

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserPermRow {
    pub nip:        String,
    pub perm_key:   String,
    pub enabled:    i8,
    pub granted_at: Option<String>,
    pub granted_by: Option<String>,
}

// GET /api/admin/permissions/registry — daftar semua permission key + label
pub async fn list_registry(
    user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Hanya Admin Utama" }))));
    }

    // Static registry
    let mut entries: Vec<Value> = WEB_PERMISSIONS.iter().map(|(k, label, kat)| {
        json!({ "key": k, "label": label, "kategori": kat })
    }).collect();

    // Tambahkan akreditasi per-bab dari starkes_bab kalau ada
    let bab: Vec<(String, String)> = sqlx::query_as(
        "SELECT kode_bab, COALESCE(nama_bab, kode_bab) AS nama_bab FROM starkes_bab ORDER BY urutan"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    for (kd, nm) in bab {
        let key = akreditasi_bab_perm_key(&kd);
        entries.push(json!({
            "key": key,
            "label": format!("Edit Akreditasi Bab {}", nm),
            "kategori": "Akreditasi (per Bab)",
        }));
    }

    Ok(Json(json!({ "registry": entries })))
}

// GET /api/admin/permissions/users — daftar user (dari Khanza user + Admin Utama)
pub async fn list_users(
    user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Hanya Admin Utama" }))));
    }

    // Decrypt id_user → NIK pegawai
    let rows: Vec<(String, Option<String>)> = sqlx::query_as(
        "SELECT CAST(AES_DECRYPT(u.id_user, 'nur') AS CHAR) AS nik,
                p.nama AS nama
         FROM user u
         LEFT JOIN pegawai p ON p.nik = CAST(AES_DECRYPT(u.id_user, 'nur') AS CHAR)
         ORDER BY p.nama"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    let users: Vec<Value> = rows.into_iter()
        .filter(|(nik, _)| !nik.is_empty())
        .map(|(nik, nama)| json!({
            "nip": nik,
            "nama": nama.unwrap_or_default(),
        }))
        .collect();

    Ok(Json(json!({ "users": users })))
}

// GET /api/admin/permissions/user/:nip — permissions yang granted utk satu user
pub async fn list_user_perms(
    user: AuthUser,
    State(state): State<AppState>,
    Path(nip): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Hanya Admin Utama" }))));
    }

    let rows: Vec<UserPermRow> = sqlx::query_as(
        "SELECT nip, perm_key, enabled,
                DATE_FORMAT(granted_at, '%Y-%m-%d %H:%i:%s') AS granted_at,
                granted_by
         FROM simrscb_user_permissions
         WHERE nip = ?
         ORDER BY perm_key"
    )
    .bind(&nip)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    Ok(Json(json!({ "nip": nip, "perms": rows })))
}

// PUT /api/admin/permissions/user/:nip — bulk set (replace semua perms user)
#[derive(Debug, Deserialize)]
pub struct SetPermsBody {
    pub perms: std::collections::HashMap<String, bool>,
}

pub async fn set_user_perms(
    user: AuthUser,
    State(state): State<AppState>,
    Path(nip): Path<String>,
    Json(body): Json<SetPermsBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !user.0.is_admin {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "error": "Hanya Admin Utama" }))));
    }

    let mut tx = state.pool.begin().await.map_err(db_err)?;

    // Delete existing
    sqlx::query("DELETE FROM simrscb_user_permissions WHERE nip=?")
        .bind(&nip)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;

    // Insert new (only enabled=true entries; default false anyway)
    let granted_by = user.0.kode.clone();
    for (key, val) in &body.perms {
        if *val {
            sqlx::query(
                "INSERT INTO simrscb_user_permissions (nip, perm_key, enabled, granted_by)
                 VALUES (?, ?, 1, ?)"
            )
            .bind(&nip)
            .bind(key)
            .bind(&granted_by)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
        }
    }

    tx.commit().await.map_err(db_err)?;

    use crate::audit::q;
    crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
        "DELETE FROM simrscb_user_permissions WHERE nip={}", q(&nip)
    )).await;
    for (key, val) in &body.perms {
        if *val {
            crate::audit::log_sql(&state.pool, &user.0.kode, &format!(
                "INSERT INTO simrscb_user_permissions (nip, perm_key, enabled, granted_by) VALUES ({}, {}, 1, {})",
                q(&nip), q(key), q(&granted_by)
            )).await;
        }
    }

    Ok(Json(json!({ "success": true, "nip": nip, "count_enabled": body.perms.values().filter(|v| **v).count() })))
}
