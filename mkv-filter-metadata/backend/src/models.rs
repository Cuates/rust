use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, strum::Display)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
pub enum VideoCodec {
    Libx265,
    Libx264,
    HevcNvenc,
    H264Nvenc,
    Av1Nvenc,
    HevcAmf,
    H264Amf,
    Av1Amf,
    HevcQsv,
    H264Qsv,
    Av1Qsv,
    HevcVideotoolbox,
    H264Videotoolbox,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConversionMode {
    Remux,
    Reencode,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, strum::Display)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
pub enum Preset {
    Ultrafast,
    Superfast,
    Veryfast,
    Faster,
    Fast,
    Medium,
    Slow,
    Slower,
    Veryslow,
    P1,
    P2,
    P3,
    P4,
    P5,
    P6,
    P7,
    Speed,
    Balanced,
    Quality,
    Default,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoPipelinePayload {
    pub input_directories: Vec<String>,
    pub file_extensions: String,
    pub recursive: bool,
    pub subtitle_tracks: String,
    pub output_extension: String,
    pub conversion_mode: ConversionMode,
    pub video_codec: VideoCodec,
    pub preset: Preset,
    pub crf: String,
}

#[derive(Serialize, Clone)]
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

pub struct SessionLog {
    pub writer: std::io::BufWriter<std::fs::File>,
    pub bytes_written: usize,
}

pub struct AppState {
    pub is_aborted: AtomicBool,
    pub process: tokio::sync::Mutex<ProcessSession>,
    pub log_writer: std::sync::Mutex<Option<SessionLog>>,
    pub encoder_caps: tokio::sync::OnceCell<EncoderCapabilities>,
}

pub struct ProcessSession {
    pub cancel: tokio_util::sync::CancellationToken,
    pub child: Option<tauri_plugin_shell::process::CommandChild>,
    pub output_path: Option<PathBuf>,
    pub output_files: Vec<PathBuf>, // In-progress files
    pub output_set: std::collections::HashSet<PathBuf>, // For fast dedup
    pub completed_files: Vec<PathBuf>, // Completed files, safe from abort
    pub output_dirs: Vec<PathBuf>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            is_aborted: AtomicBool::new(false),
            process: tokio::sync::Mutex::new(ProcessSession {
                cancel: tokio_util::sync::CancellationToken::new(),
                child: None,
                output_path: None,
                output_files: Vec::new(),
                output_set: std::collections::HashSet::new(),
                completed_files: Vec::new(),
                output_dirs: Vec::new(),
            }),
            log_writer: std::sync::Mutex::new(None),
            encoder_caps: tokio::sync::OnceCell::new(),
        }
    }
}
