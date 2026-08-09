use serde::Serialize;
use std::path::PathBuf;

// -----------------------------------------------------------------------------
// IPC Payload Types
// -----------------------------------------------------------------------------

#[derive(Clone, Serialize, specta::Type)]
#[serde(tag = "type", content = "payload", rename_all = "camelCase")]
pub enum IpcPayloadData {
    StartedScanned {
        #[serde(rename = "totalCount")]
        total_count: usize,
        #[serde(rename = "folderCounts")]
        folder_counts: std::collections::HashMap<String, usize>,
    },
    FolderStatusUpdate {
        folder: String,
        status: String,
    },
    FileProcessed {
        processed: usize,
        converted: usize,
        #[serde(rename = "fileCompleted")]
        file_completed: Option<String>,
        #[serde(rename = "rootDirectory")]
        root_directory: Option<String>,
    },
    Cancelled(String),
}

// -----------------------------------------------------------------------------
// Report Types
// -----------------------------------------------------------------------------

/// Per-folder report status returned by `check_folder_reports`.
#[derive(Serialize, specta::Type)]
pub struct FolderReportStatus {
    #[serde(rename = "hasSuccess")]
    pub has_success: bool,
    #[serde(rename = "hasFailure")]
    pub has_failure: bool,
}

/// A structured failure entry for a file.
#[derive(Serialize, Debug, Clone, specta::Type)]
pub struct FailedFile {
    pub path: String,
    pub reason: String,
}

/// Metadata about a single successfully converted subtitle track.
#[derive(Serialize, Debug, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleMetadata {
    pub file: String,
    pub language: String,
    pub track_name: String,
    pub codec: String,
    pub source_file: String,
}

/// Summary returned by `get_directory_stats`.
#[derive(Serialize, Debug, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryStats {
    pub exists: bool,
    pub file_count: usize,
    pub total_size_bytes: u64,
    pub files: Vec<FileStat>,
}

/// A single file entry inside `DirectoryStats`.
#[derive(Serialize, Debug, Clone, specta::Type)]
#[serde(rename_all = "camelCase")]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ipc_payload_data_serialization() {
        // Test StartedScanned
        let mut folder_counts = std::collections::HashMap::new();
        folder_counts.insert("folder1".to_string(), 10);

        let payload = IpcPayloadData::StartedScanned {
            total_count: 10,
            folder_counts,
        };
        let json = serde_json::to_string(&payload).unwrap();
        // Check structural matching to TypeScript
        // Expected: {"type":"startedScanned","payload":{"totalCount":10,"folderCounts":{"folder1":10}}}
        assert!(json.contains(r#""type":"startedScanned""#));
        assert!(json.contains(r#""payload":{"totalCount":10,"folderCounts":{"folder1":10}}"#));

        // Test FolderStatusUpdate
        let payload = IpcPayloadData::FolderStatusUpdate {
            folder: "f1".to_string(),
            status: "processing".to_string(),
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains(r#""type":"folderStatusUpdate""#));
        assert!(json.contains(r#""payload":{"folder":"f1","status":"processing"}"#));

        // Test FileProcessed
        let payload = IpcPayloadData::FileProcessed {
            processed: 1,
            converted: 1,
            file_completed: Some("file.mkv".to_string()),
            root_directory: Some("root".to_string()),
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains(r#""type":"fileProcessed""#));
        assert!(json.contains(r#""payload":{"processed":1,"converted":1,"fileCompleted":"file.mkv","rootDirectory":"root"}"#));

        // Test Cancelled
        let payload = IpcPayloadData::Cancelled("aborted".to_string());
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains(r#""type":"cancelled""#));
        assert!(json.contains(r#""payload":"aborted""#));
    }
}
