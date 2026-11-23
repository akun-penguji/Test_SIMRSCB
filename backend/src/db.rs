use sqlx::mysql::MySqlPoolOptions;
use sqlx::{Executor, MySqlPool};

pub async fn create_pool(database_url: &str) -> anyhow::Result<MySqlPool> {
    let pool = MySqlPoolOptions::new()
        .max_connections(10)
        // Paksa zona waktu sesi ke WIB (+07:00). Tanpa ini, sqlx memakai UTC sehingga
        // CURDATE()/NOW()/CURTIME() mundur ~7 jam — dini hari WIB (00:00–07:00) query
        // "hari ini" (booking Mobile JKN, guard SEP, kuota, dll) jadi mengambil tanggal
        // kemarin dan gagal menemukan data. WIB tak ber-DST jadi offset tetap aman.
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                conn.execute("SET time_zone = '+07:00'").await?;
                Ok(())
            })
        })
        .connect(database_url)
        .await?;
    tracing::info!("Database pool berhasil dibuat (session time_zone = +07:00 WIB)");
    Ok(pool)
}
