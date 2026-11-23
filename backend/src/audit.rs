use sqlx::MySqlPool;

/// Quote + escape sebuah nilai untuk disisipkan ke SQL log `trackersql`
/// (meniru Khanza yang menyimpan query utuh). Selalu diquote — cukup untuk
/// keperluan audit; eksekusi query sebenarnya tetap parameterized/aman.
/// Contoh: `q("O'Brien")` -> `'O''Brien'`.
pub fn q<T: std::fmt::Display>(v: T) -> String {
    format!("'{}'", v.to_string().replace('\'', "''"))
}

/// Versi Option: NULL kalau None, selain itu quote.
pub fn qo<T: std::fmt::Display>(v: Option<T>) -> String {
    match v {
        Some(x) => q(x),
        None => "NULL".to_string(),
    }
}

/// Insert ke tabel `tracker` — dipanggil saat login berhasil
pub async fn log_login(pool: &MySqlPool, kode: &str) {
    let result = sqlx::query(
        "INSERT INTO tracker (nip, tgl_login, jam_login) VALUES (?, current_date(), current_time())"
    )
    .bind(kode)
    .execute(pool)
    .await;

    if let Err(e) = result {
        tracing::warn!("Gagal insert tracker: {}", e);
    }
}

/// Insert ke tabel `trackersql` — dipanggil setiap operasi INSERT/UPDATE/DELETE
pub async fn log_sql(pool: &MySqlPool, kode: &str, sql_desc: &str) {
    let result = sqlx::query(
        "INSERT INTO trackersql (tanggal, sqle, usere) VALUES (now(), ?, ?)"
    )
    .bind(sql_desc)
    .bind(kode)
    .execute(pool)
    .await;

    if let Err(e) = result {
        tracing::warn!("Gagal insert trackersql: {}", e);
    }
}
