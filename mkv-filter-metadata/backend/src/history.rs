use crate::error::AppError;
use rusqlite::Connection;
use tauri::Manager;

pub fn init_db(app: &tauri::AppHandle) -> std::result::Result<Connection, AppError> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Process(format!("Failed to get app data dir: {}", e)))?;
    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir).map_err(AppError::Io)?;
    }
    let db_path = app_dir.join("history.db");

    let conn = Connection::open(&db_path)
        .map_err(|e| AppError::Process(format!("Failed to open database: {}", e)))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS processed_files (
            file_path TEXT PRIMARY KEY,
            original_size INTEGER,
            modified_timestamp INTEGER
        )",
        [],
    )
    .map_err(|e| AppError::Process(format!("Failed to create table: {}", e)))?;

    Ok(conn)
}

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
        .map_err(|e| AppError::Process(format!("DB prep error: {}", e)))?;

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

pub fn mark_file_processed(
    db: &Connection,
    path: &str,
    size: u64,
    modified: u64,
) -> std::result::Result<(), AppError> {
    db.execute(
        "INSERT OR REPLACE INTO processed_files (file_path, original_size, modified_timestamp) VALUES (?1, ?2, ?3)",
        rusqlite::params![path, size, modified],
    ).map_err(|e| AppError::Process(format!("DB insert error: {}", e)))?;
    Ok(())
}

pub fn clear_history(db: &Connection) -> std::result::Result<(), AppError> {
    db.execute("DELETE FROM processed_files", [])
        .map_err(|e| AppError::Process(format!("DB clear error: {}", e)))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS processed_files (
                file_path TEXT PRIMARY KEY,
                original_size INTEGER,
                modified_timestamp INTEGER
            )",
            [],
        )
        .unwrap();
        conn
    }

    #[test]
    fn test_mark_and_check_file_processed() {
        let db = setup_in_memory_db();
        let path = "/test/video.mkv";
        let size = 1024;
        let modified = 123456789;

        // Verify not processed initially
        let processed = is_file_processed(&db, path, size, modified).unwrap();
        assert!(!processed);

        // Mark as processed
        mark_file_processed(&db, path, size, modified).unwrap();

        // Verify processed
        let processed = is_file_processed(&db, path, size, modified).unwrap();
        assert!(processed);
    }

    #[test]
    fn test_clear_history() {
        let db = setup_in_memory_db();
        let path = "/test/video.mkv";
        let size = 1024;
        let modified = 123456789;

        mark_file_processed(&db, path, size, modified).unwrap();
        assert!(is_file_processed(&db, path, size, modified).unwrap());

        clear_history(&db).unwrap();

        // Verify history is cleared
        assert!(!is_file_processed(&db, path, size, modified).unwrap());
    }
}
