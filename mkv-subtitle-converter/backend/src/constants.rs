/// Tauri event emitted for each log line sent to the frontend terminal.
pub const EVENT_PROCESS_LOG: &str = "process-log";

/// Tauri event emitted when a large batch (>300 files) is detected.
pub const EVENT_LARGE_BATCH_WARNING: &str = "large-batch-warning";

/// Tauri event emitted when the SQLite history database fails to initialize.
pub const EVENT_DB_INIT_FAILED: &str = "db-init-failed";
