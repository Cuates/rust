use serde::Serialize;
use std::path::PathBuf;

// -----------------------------------------------------------------------------
// IPC Payload Types
// -----------------------------------------------------------------------------

/// The payload sent over the Tauri IPC Channel for all progress events.
#[derive(Clone, Serialize)]
pub struct ProgressPayload {
    pub event: String,
    pub data: serde_json::Value,
}

// -----------------------------------------------------------------------------
// Report Types
// -----------------------------------------------------------------------------

/// Per-folder report status returned by `check_folder_reports`.
#[derive(Serialize)]
pub struct FolderReportStatus {
    #[serde(rename = "hasSuccess")]
    pub has_success: bool,
    #[serde(rename = "hasFailure")]
    pub has_failure: bool,
}

/// Metadata about a single successfully converted subtitle track.
#[derive(Serialize, Debug, Clone)]
pub struct SubtitleMetadata {
    pub file: String,
    pub language: String,
    #[serde(rename = "track_name")]
    pub track_name: String,
    pub codec: String,
}

/// Summary returned by `get_directory_stats`.
#[derive(Serialize, Debug, Clone)]
pub struct DirectoryStats {
    pub exists: bool,
    pub file_count: usize,
    pub total_size_bytes: u64,
    pub files: Vec<FileStat>,
}

/// A single file entry inside `DirectoryStats`.
#[derive(Serialize, Debug, Clone)]
pub struct FileStat {
    pub name: String,
    pub size_bytes: u64,
}

// -----------------------------------------------------------------------------
// Session Logging
// -----------------------------------------------------------------------------

/// A buffered file writer for the session log with rotation tracking.
pub struct SessionLog {
    pub writer: std::io::BufWriter<std::fs::File>,
    pub bytes_written: usize,
}

// -----------------------------------------------------------------------------
// Process Session (tracks in-flight work for cancellation and cleanup)
// -----------------------------------------------------------------------------

pub struct ProcessSession {
    /// `CancellationToken` — set on every new run, cancelled on abort.
    pub cancel: tokio_util::sync::CancellationToken,
    /// Running sidecar child processes keyed by their output file path.
    pub children: std::collections::HashMap<PathBuf, tauri_plugin_shell::process::CommandChild>,
    /// The input folder paths for the current run (used for cleanup on abort).
    pub active_paths: Vec<String>,
    /// Files created during the current session (deleted on abort; never a wildcard sweep).
    pub session_output_files: Vec<PathBuf>,
}

// -----------------------------------------------------------------------------
// Application State (managed by Tauri)
// -----------------------------------------------------------------------------

pub struct AppState {
    pub process: tokio::sync::Mutex<ProcessSession>,
    pub log_writer: std::sync::Mutex<Option<SessionLog>>,
    pub db: tokio::sync::Mutex<Option<rusqlite::Connection>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            process: tokio::sync::Mutex::new(ProcessSession {
                cancel: tokio_util::sync::CancellationToken::new(),
                children: std::collections::HashMap::new(),
                active_paths: Vec::new(),
                session_output_files: Vec::new(),
            }),
            log_writer: std::sync::Mutex::new(None),
            db: tokio::sync::Mutex::new(None),
        }
    }
}
