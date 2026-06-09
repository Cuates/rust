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

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum Preset {
    #[serde(rename = "ultrafast")]
    Ultrafast,
    #[serde(rename = "superfast")]
    Superfast,
    #[serde(rename = "veryfast")]
    Veryfast,
    #[serde(rename = "faster")]
    Faster,
    #[serde(rename = "fast")]
    Fast,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "slow")]
    Slow,
    #[serde(rename = "slower")]
    Slower,
    #[serde(rename = "veryslow")]
    Veryslow,
    #[serde(rename = "p1")]
    P1,
    #[serde(rename = "p2")]
    P2,
    #[serde(rename = "p3")]
    P3,
    #[serde(rename = "p4")]
    P4,
    #[serde(rename = "p5")]
    P5,
    #[serde(rename = "p6")]
    P6,
    #[serde(rename = "p7")]
    P7,
    #[serde(rename = "speed")]
    Speed,
    #[serde(rename = "balanced")]
    Balanced,
    #[serde(rename = "quality")]
    Quality,
    #[serde(rename = "default")]
    Default,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoPipelinePayload {
    pub input_directories: Vec<String>,
    pub file_extensions: String,
    pub subtitle_tracks: String,
    pub output_extension: String,
    pub conversion_mode: ConversionMode,
    pub video_codec: VideoCodec,
    pub preset: Preset,
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

pub struct SessionLog {
    pub writer: std::io::BufWriter<std::fs::File>,
    pub bytes_written: usize,
}

pub struct AppState {
    pub is_aborted: AtomicBool,
    pub process: tokio::sync::Mutex<ProcessSession>,
    pub log_writer: std::sync::Mutex<Option<SessionLog>>,
}

pub struct ProcessSession {
    pub cancel: tokio_util::sync::CancellationToken,
    pub child: Option<tauri_plugin_shell::process::CommandChild>,
    pub output_path: Option<PathBuf>,
    pub output_files: Vec<PathBuf>, // In-progress files
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
                completed_files: Vec::new(),
                output_dirs: Vec::new(),
            }),
            log_writer: std::sync::Mutex::new(None),
        }
    }
}
