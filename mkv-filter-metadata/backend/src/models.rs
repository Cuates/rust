use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum VideoCodec {
    #[serde(rename = "libx265")]
    Libx265,
    #[serde(rename = "libx264")]
    Libx264,
    #[serde(rename = "hevc_nvenc")]
    HevcNvenc,
    #[serde(rename = "h264_nvenc")]
    H264Nvenc,
    #[serde(rename = "av1_nvenc")]
    Av1Nvenc,
    #[serde(rename = "hevc_amf")]
    HevcAmf,
    #[serde(rename = "h264_amf")]
    H264Amf,
    #[serde(rename = "av1_amf")]
    Av1Amf,
    #[serde(rename = "hevc_qsv")]
    HevcQsv,
    #[serde(rename = "h264_qsv")]
    H264Qsv,
    #[serde(rename = "av1_qsv")]
    Av1Qsv,
    #[serde(rename = "hevc_videotoolbox")]
    HevcVideotoolbox,
    #[serde(rename = "h264_videotoolbox")]
    H264Videotoolbox,
    #[serde(rename = "av1_videotoolbox")]
    Av1Videotoolbox,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ConversionMode {
    #[serde(rename = "remux")]
    Remux,
    #[serde(rename = "reencode")]
    Reencode,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoPipelinePayload {
    pub input_directories: Vec<String>,
    pub file_extensions: String,
    pub subtitle_tracks: String,
    pub output_extension: String,
    pub conversion_mode: ConversionMode,
    pub video_codec: VideoCodec,
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
    pub log_writer: std::sync::Mutex<Option<std::io::BufWriter<std::fs::File>>>,
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
            log_writer: std::sync::Mutex::new(None),
        }
    }
}
