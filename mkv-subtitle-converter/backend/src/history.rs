use crate::error::AppError;
use rusqlite::Connection;
use tauri::Manager;

/// Initialize (or open) the SQLite history database stored in the app data directory.
/// Creates the `processed_files` table if it does not exist.
pub fn init_db<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> std::result::Result<Connection, AppError> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Process(format!("Failed to resolve app data directory: {}", e)))?;

    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir).map_err(AppError::Io)?;
    }

    let db_path = app_dir.join("history.db");
    let conn = Connection::open(&db_path)
        .map_err(|e| AppError::Process(format!("Failed to open history database: {}", e)))?;

    // Enable WAL mode for better concurrent read performance.
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")
        .map_err(|e| AppError::Process(format!("Failed to configure WAL mode: {}", e)))?;

    // Schema migration: version 0 → 1.
    let version: u32 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .unwrap_or(0);

    if version < 1 {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS processed_files (
                file_path          TEXT PRIMARY KEY,
                original_size      INTEGER NOT NULL,
                modified_timestamp INTEGER NOT NULL
            )",
            [],
        )
        .map_err(|e| AppError::Process(format!("Failed to create history table: {}", e)))?;

        conn.execute_batch("PRAGMA user_version = 1;")
            .map_err(|e| AppError::Process(format!("Failed to set schema version: {}", e)))?;
    }

    Ok(conn)
}

/// Returns `true` if the file at `path` with the given `size` and `modified` timestamp
/// has been previously recorded as successfully processed.
pub fn is_file_processed(
    db: &Connection,
    path: &str,
    size: u64,
    modified: u64,
) -> std::result::Result<bool, AppError> {
    let mut stmt = db
        .prepare(
            "SELECT original_size, modified_timestamp FROM processed_files WHERE file_path = ?1",
        )
        .map_err(|e| AppError::Process(format!("DB prepare error: {}", e)))?;

    let mut rows = stmt
        .query([path])
        .map_err(|e| AppError::Process(format!("DB query error: {}", e)))?;

    if let Some(row) = rows
        .next()
        .map_err(|e| AppError::Process(format!("DB row error: {}", e)))?
    {
        let saved_size: u64 = row.get(0).unwrap_or(0);
        let saved_modified: u64 = row.get(1).unwrap_or(0);
        if saved_size == size && saved_modified == modified {
            return Ok(true);
        }
    }

    Ok(false)
}

/// Records a file as successfully processed so it can be skipped on future runs.
pub fn mark_file_processed(
    db: &Connection,
    path: &str,
    size: u64,
    modified: u64,
) -> std::result::Result<(), AppError> {
    db.execute(
        "INSERT OR REPLACE INTO processed_files \
         (file_path, original_size, modified_timestamp) VALUES (?1, ?2, ?3)",
        rusqlite::params![path, size, modified],
    )
    .map_err(|e| AppError::Process(format!("DB insert error: {}", e)))?;
    Ok(())
}

/// Removes all history entries, forcing every file to be re-processed on the next run.
pub fn clear_history(db: &Connection) -> std::result::Result<(), AppError> {
    db.execute("DELETE FROM processed_files", [])
        .map_err(|e| AppError::Process(format!("DB clear error: {}", e)))?;
    Ok(())
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS processed_files (
                file_path TEXT PRIMARY KEY,
                original_size INTEGER NOT NULL,
                modified_timestamp INTEGER NOT NULL
            )",
            [],
        )
        .unwrap();
        conn
    }

    #[test]
    fn test_mark_and_check_processed() {
        let db = setup_in_memory_db();
        let path = "/test/video.mkv";
        let size = 1024_u64;
        let modified = 123_456_789_u64;

        assert!(!is_file_processed(&db, path, size, modified).unwrap());
        mark_file_processed(&db, path, size, modified).unwrap();
        assert!(is_file_processed(&db, path, size, modified).unwrap());
    }

    #[test]
    fn test_size_mismatch_not_processed() {
        let db = setup_in_memory_db();
        mark_file_processed(&db, "/test/video.mkv", 1024, 100).unwrap();
        // Different size → file has changed → not considered processed.
        assert!(!is_file_processed(&db, "/test/video.mkv", 2048, 100).unwrap());
    }

    #[test]
    fn test_clear_history() {
        let db = setup_in_memory_db();
        mark_file_processed(&db, "/test/video.mkv", 1024, 100).unwrap();
        assert!(is_file_processed(&db, "/test/video.mkv", 1024, 100).unwrap());

        clear_history(&db).unwrap();
        assert!(!is_file_processed(&db, "/test/video.mkv", 1024, 100).unwrap());
    }
}
