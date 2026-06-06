use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoPipelinePayload {
    pub input_directories: Vec<String>,
    pub file_extensions: String,
    pub subtitle_tracks: String,
    pub output_extension: String,
    pub conversion_mode: String,
    pub video_codec: String,
    pub preset: String,
    pub crf: String,
}

#[derive(Serialize)]
pub struct EncoderCapabilities {
    pub nvenc: bool,
    pub amf: bool,
    pub videotoolbox: bool,
    pub qsv: bool,
}

#[derive(Serialize)]
pub struct FileStat {
    pub name: String,
    pub size_bytes: u64,
}

#[derive(Serialize)]
pub struct DirectoryStats {
    pub exists: bool,
    pub file_count: usize,
    pub total_size_bytes: u64,
    pub files: Vec<FileStat>,
}

pub struct AppState {
    pub is_aborted: AtomicBool,
    pub process: tokio::sync::Mutex<ProcessSession>,
}

#[derive(Default)]
pub struct ProcessSession {
    pub child: Option<tauri_plugin_shell::process::CommandChild>,
    pub output_path: Option<PathBuf>,
    pub output_files: Vec<PathBuf>,
    pub output_dirs: Vec<PathBuf>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            is_aborted: AtomicBool::new(false),
            process: tokio::sync::Mutex::new(ProcessSession::default()),
        }
    }
}
