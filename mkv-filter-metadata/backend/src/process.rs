use std::path::Path;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;

use crate::error::AppError;
use crate::models::{AppState, ConversionMode, VideoCodec};

/// Writes a log message to the cached writer and emits it to the frontend.
/// The writer must be initialized via `initialize_session_log` before disk writes take effect.
pub fn append_log(app: &AppHandle, message: impl AsRef<str>) {
    let msg = message.as_ref();
    if msg.contains("[ERROR]") || msg.contains("[FATAL]") || msg.contains("❌") || msg.contains("Error:") {
        tracing::error!("{}", msg);
    } else if msg.starts_with("---") || msg.starts_with("[") || msg.contains("Pipeline") || msg.contains("Session") || msg.contains("Scanned file total:") {
        tracing::info!("{}", msg);
    } else {
        tracing::trace!("{}", msg);
    }
    let _ = app.emit("process-log", msg);
    let state = app.state::<AppState>();
    if let Ok(mut guard) = state.log_writer.lock() {
        let mut rotate = false;
        if let Some(log) = guard.as_mut() {
            use std::io::Write;
            let line_len = msg.len() + 1; // +1 for \n
            if log.bytes_written + line_len > 10 * 1024 * 1024 {
                let _ = log.writer.flush();
                rotate = true;
            } else {
                let _ = writeln!(log.writer, "{}", msg);
                log.bytes_written += line_len;
            }
        }

        if rotate {
            drop(guard.take()); // Close the file handle
            if let Ok(log_dir) = app.path().app_log_dir() {
                let log_file = log_dir.join("session.log");
                let rot1 = log_dir.join("session.1.log");
                let rot2 = log_dir.join("session.2.log");
                let _ = std::fs::remove_file(&rot2);
                let _ = std::fs::rename(&rot1, &rot2);
                let _ = std::fs::rename(&log_file, &rot1);

                if let Ok(file) = std::fs::OpenOptions::new()
                    .create(true)
                    .write(true)
                    .truncate(true)
                    .open(&log_file)
                {
                    use std::io::Write;
                    let mut new_log = crate::models::SessionLog {
                        writer: std::io::BufWriter::new(file),
                        bytes_written: 0,
                    };
                    let _ = writeln!(new_log.writer, "--- LOG ROTATED ---");
                    let _ = writeln!(new_log.writer, "{}", msg);
                    new_log.bytes_written += 20 + msg.len() + 1;
                    *guard = Some(new_log);
                }
            }
        }
    }
}

/// Flushes the cached log writer to ensure all buffered data is written to disk.
/// Must be called before reading the log file directly.
pub fn flush_log_writer(app: &AppHandle) {
    let state = app.state::<AppState>();
    if let Ok(mut guard) = state.log_writer.lock()
        && let Some(log) = guard.as_mut()
    {
        use std::io::Write;
        let _ = log.writer.flush();
    };
}

impl VideoCodec {

    pub fn map_preset(&self, preset: &crate::models::Preset) -> String {
        match preset {
            crate::models::Preset::Ultrafast => "ultrafast".to_string(),
            crate::models::Preset::Superfast => "superfast".to_string(),
            crate::models::Preset::Veryfast => "veryfast".to_string(),
            crate::models::Preset::Faster => "faster".to_string(),
            crate::models::Preset::Fast => "fast".to_string(),
            crate::models::Preset::Medium => "medium".to_string(),
            crate::models::Preset::Slow => "slow".to_string(),
            crate::models::Preset::Slower => "slower".to_string(),
            crate::models::Preset::Veryslow => "veryslow".to_string(),
            crate::models::Preset::P1 => "p1".to_string(),
            crate::models::Preset::P2 => "p2".to_string(),
            crate::models::Preset::P3 => "p3".to_string(),
            crate::models::Preset::P4 => "p4".to_string(),
            crate::models::Preset::P5 => "p5".to_string(),
            crate::models::Preset::P6 => "p6".to_string(),
            crate::models::Preset::P7 => "p7".to_string(),
            crate::models::Preset::Speed => "speed".to_string(),
            crate::models::Preset::Balanced => "balanced".to_string(),
            crate::models::Preset::Quality => "quality".to_string(),
            crate::models::Preset::Default => "default".to_string(),
        }
    }

    pub fn get_hwaccel_api(&self) -> &'static str {
        match self {
            VideoCodec::HevcNvenc | VideoCodec::H264Nvenc | VideoCodec::Av1Nvenc => "cuda",
            VideoCodec::HevcAmf | VideoCodec::H264Amf | VideoCodec::Av1Amf => "d3d11va",
            VideoCodec::HevcQsv | VideoCodec::H264Qsv | VideoCodec::Av1Qsv => "qsv",
            VideoCodec::HevcVideotoolbox | VideoCodec::H264Videotoolbox => "videotoolbox",
            // Software encoders don't strictly need hardware decode, but auto is a safe fallback
            VideoCodec::Libx264 | VideoCodec::Libx265 => "auto",
        }
    }

    pub fn get_hardware_args(&self, preset: &crate::models::Preset, crf: &str) -> Vec<String> {
        let mapped_preset = self.map_preset(preset);
        let mut args = vec!["-c:v".to_string(), self.to_string()];

        match self {
            VideoCodec::HevcNvenc | VideoCodec::H264Nvenc | VideoCodec::Av1Nvenc => {
                args.extend([
                    "-preset".to_string(),
                    mapped_preset,
                    "-cq".to_string(),
                    crf.to_string(),
                    "-b:v".to_string(),
                    "0".to_string(),
                ]);
            }
            VideoCodec::HevcAmf | VideoCodec::H264Amf | VideoCodec::Av1Amf => {
                args.extend([
                    "-usage".to_string(),
                    "transcoding".to_string(),
                    "-quality".to_string(),
                    mapped_preset,
                    "-rc".to_string(),
                    "cqp".to_string(),
                    "-qp_i".to_string(),
                    crf.to_string(),
                    "-qp_p".to_string(),
                    crf.to_string(),
                ]);
            }
            VideoCodec::HevcQsv | VideoCodec::H264Qsv | VideoCodec::Av1Qsv => {
                args.extend([
                    "-preset".to_string(),
                    mapped_preset,
                    "-q".to_string(),
                    crf.to_string(),
                ]);
            }
            VideoCodec::HevcVideotoolbox | VideoCodec::H264Videotoolbox => {
                args.extend(["-q:v".to_string(), crf.to_string()]);
            }
            VideoCodec::Libx264 | VideoCodec::Libx265 => {
                args.extend([
                    "-preset".to_string(),
                    mapped_preset,
                    "-crf".to_string(),
                    crf.to_string(),
                ]);
            }
        }
        args
    }
}

/// Generic parser used to break comma-separated strings (like extensions or languages) into arrays
pub fn parse_comma_list(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Normalizes common ISO 639-1 language codes into their 3-letter ISO 639-2 equivalents.
pub fn normalize_lang(tag: &str) -> &str {
    match tag.to_lowercase().as_str() {
        "en" => "eng", "ja" => "jpn", "zh" => "zho",
        "fr" => "fra", "de" => "deu", "es" => "spa",
        "ru" => "rus", "it" => "ita", "pt" => "por",
        "ko" => "kor", "ar" => "ara", "hi" => "hin",
        "bn" => "ben", "pa" => "pan", "te" => "tel",
        "sv" => "swe", "nl" => "nld", "pl" => "pol",
        "tr" => "tur", "vi" => "vie", "th" => "tha",
        "id" => "ind", "ms" => "msa", "el" => "ell",
        "cs" => "ces", "da" => "dan", "fi" => "fin",
        "hu" => "hun", "no" => "nor", "ro" => "ron",
        "sk" => "slk", "uk" => "ukr", "he" => "heb",
        _ => tag,
    }
}

/// Inspects collected stderr lines from an FFmpeg run and determines whether the failure
/// was caused by a subtitle codec being incompatible with the target container.
pub fn stderr_indicates_subtitle_incompatibility(logs: &[String]) -> bool {
    logs.iter().any(|l| {
        let l = l.to_lowercase();
        (l.contains("subtitle codec") && l.contains("not supported"))
            || (l.contains("could not write header") 
                && (l.contains("subtitle") || l.contains("codec") || l.contains("muxer")))
            || (l.contains("function not implemented") && !l.contains("vf#"))
    })
}

#[derive(Debug, PartialEq)]
pub enum SubtitleCodec {
    Copy,
    Ass,
}

#[derive(Debug)]
pub struct ReencodeConfig<'a> {
    pub video_codec: &'a VideoCodec,
    pub preset: &'a crate::models::Preset,
    pub crf: &'a str,
}

#[derive(Debug)]
pub struct FfmpegJobConfig<'a> {
    pub input: &'a Path,
    pub output: &'a Path,
    pub subtitle_maps: &'a [String],
    pub mode: ConversionMode,
    pub subtitle_codec: SubtitleCodec,
    pub reencode: Option<ReencodeConfig<'a>>,
}

/// Builds the base ffmpeg arg list (maps + codec flags) for either reencode or remux mode.
pub fn build_ffmpeg_args(config: &FfmpegJobConfig) -> Vec<String> {
    let mut args = vec!["-y".to_string()];

    // Dynamically inject the exact hardware acceleration framework needed for decoding
    if let ConversionMode::Reencode = config.mode
        && let Some(reencode) = &config.reencode
    {
        args.extend([
            "-hwaccel".to_string(),
            reencode.video_codec.get_hwaccel_api().to_string(),
        ]);
    }

    args.extend([
        "-i".to_string(),
        config.input.to_string_lossy().into_owned(),
        "-map".to_string(),
        "0:V?".to_string(), // map all video safely (Capital V ignores cover arts)
        "-map".to_string(),
        "0:a?".to_string(), // map all audio safely
        "-map".to_string(),
        "0:t?".to_string(), // Keep attachments (fonts)
    ]);

    // Explicitly map exactly the subtitle IDs discovered by ffprobe
    for map in config.subtitle_maps {
        args.push("-map".to_string());
        args.push(map.clone());
    }

    match config.mode {
        ConversionMode::Reencode => {
            if let Some(reencode) = &config.reencode {
                let mut reencode_args = reencode
                    .video_codec
                    .get_hardware_args(reencode.preset, reencode.crf);
                reencode_args.extend(["-c:a".to_string(), "copy".to_string()]);
                args.extend(reencode_args);
            }
        }
        ConversionMode::Remux => {
            // Remux: explicitly copy video and audio streams only.
            args.extend([
                "-c:v".to_string(),
                "copy".to_string(),
                "-c:a".to_string(),
                "copy".to_string(),
            ]);
        }
    }

    let sub_codec_str = match config.subtitle_codec {
        SubtitleCodec::Copy => "copy",
        SubtitleCodec::Ass => "ass",
    };
    args.extend(["-c:s".to_string(), sub_codec_str.to_string()]);

    // Clear the title metadata from the output file, matching the Python script's
    args.extend(["-metadata".to_string(), "title=".to_string()]);

    args.push(config.output.to_string_lossy().into_owned());
    args
}

/// Mimics the Python script's `get_matching_subtitle_maps` to extract exact numeric stream IDs using ffprobe
pub async fn get_matching_subtitle_maps(
    app: &AppHandle,
    file_path: &Path,
    allowed_langs: &[String],
) -> Result<Vec<String>, AppError> {
    let shell = app.shell();
    let cmd = shell
        .sidecar("ffprobe")
        .map_err(|e| {
            AppError::Sidecar(format!(
                "Failed to initialize ffprobe sidecar configuration: {}",
                e
            ))
        })?
        .args([
            "-v",
            "error",
            "-select_streams",
            "s",
            "-show_entries",
            "stream=index:stream_tags=language",
            "-of",
            "csv=p=0",
            &file_path.to_string_lossy(),
        ]);

    let output = cmd
        .output()
        .await
        .map_err(|e| AppError::Sidecar(format!("ffprobe execution error: {}", e)))?;

    if !output.status.success() {
        let stderr_str = String::from_utf8_lossy(&output.stderr);
        let stderr_sanitized = stderr_str
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect::<Vec<_>>()
            .join(" | ");
        return Err(AppError::FfprobeFailed(format!(
            "ffprobe diagnostic failure: {}",
            stderr_sanitized
        )));
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let mut maps = Vec::new();

    for line in stdout_str.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split(',').collect();
        if parts.is_empty() {
            continue;
        }

        let index = parts[0].trim();

        // Treat missing language tag as 'und' (undetermined) just like the Python script
        let lang = if parts.len() > 1 {
            normalize_lang(parts[1].trim()).to_lowercase()
        } else {
            "und".to_string()
        };

        if allowed_langs.iter().any(|l| l == &lang) {
            maps.push(format!("0:{}", index));
        }
    }

    Ok(maps)
}

/// Determines whether a log line from FFmpeg or mkvmerge should be classified as [ERROR].
pub fn is_error_line(line: &str) -> bool {
    let message = if line.starts_with('[') {
        line.find(']')
            .map(|i| line[i + 1..].trim_start())
            .unwrap_or(line)
    } else {
        line
    };

    let ml = message.to_lowercase();
    ml.starts_with("error")
        || ml.starts_with("invalid")
        || ml.starts_with("failed")
        || ml.starts_with("conversion failed")
        || ml.starts_with("task finished with error")
        || ml.starts_with("error sending frames")
}

/// Helper function to parse FFmpeg time format (HH:MM:SS.xx) into seconds.
pub fn parse_ffmpeg_time(time_str: &str) -> Option<f64> {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() == 3 {
        let h: f64 = parts[0].parse().unwrap_or(0.0);
        let m: f64 = parts[1].parse().unwrap_or(0.0);
        let s: f64 = parts[2].parse().unwrap_or(0.0);
        Some(h * 3600.0 + m * 60.0 + s)
    } else {
        None
    }
}

/// Helper function to execute a sidecar command and handle its events.
pub async fn run_sidecar_command(
    app: &AppHandle,
    state: &tauri::State<'_, AppState>,
    binary_name: &str,
    args: Vec<String>,
) -> Result<(bool, Vec<String>), AppError> {
    let shell = app.shell();
    let is_mkvmerge = binary_name == "mkvmerge";
    static FPS_REGEX: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    let fps_regex = FPS_REGEX.get_or_init(|| regex::Regex::new(r"(\d+(?:\.\d+)?)\s+fps").unwrap());

    let cmd = shell
        .sidecar(binary_name)
        .map_err(|e| AppError::Sidecar(format!("Failed generating sidecar configurations: {e}")))?
        .args(args);

    let (mut rx, child) = cmd.spawn().map_err(|e| {
        AppError::Sidecar(format!(
            "Failed allocating processing thread instance context: {e}"
        ))
    })?;

    let cancel_token = {
        let mut session = state.process.lock().await;
        session.child = Some(child);
        session.cancel.clone()
    };

    let mut aborted_mid_stream = false;
    let mut file_success = false;
    let mut collected_stderr: Vec<String> = Vec::new();
    let mut total_duration_secs: Option<f64> = None;
    let mut video_fps: Option<f64> = None;

    loop {
        tokio::select! {
            _ = cancel_token.cancelled() => {
                aborted_mid_stream = true;
                break;
            }
            event_opt = rx.recv() => {
                let event = match event_opt {
                    Some(e) => e,
                    None => break,
                };

                match event {
            tauri_plugin_shell::process::CommandEvent::Stdout(line_bytes) => {
                let text = String::from_utf8_lossy(&line_bytes).into_owned();
                let mut sanitized = text.replace('\r', "\n");
                sanitized = sanitized.replace("100%The cue", "100%\nThe cue");

                for line in sanitized.lines() {
                    let t = line.trim();
                    if !t.is_empty() {
                        if is_error_line(t) {
                            append_log(app, format!("  | [ERROR] {}", t));
                        } else {
                            append_log(app, format!("  | [INFO] {}", t));
                        }
                    }
                }
            }
            tauri_plugin_shell::process::CommandEvent::Stderr(line_bytes) => {
                let text = String::from_utf8_lossy(&line_bytes).into_owned();
                let sanitized = text.replace('\r', "\n");

                for line in sanitized.lines() {
                    let t = line.trim();
                    if !t.is_empty() {
                        collected_stderr.push(t.to_string());

                        if total_duration_secs.is_none()
                            && t.starts_with("Duration:")
                            && let Some(dur_str) = t
                                .strip_prefix("Duration:")
                                .map(|s| s.trim())
                                .and_then(|s| s.split(',').next())
                        {
                            total_duration_secs = parse_ffmpeg_time(dur_str);
                        }

                        if video_fps.is_none()
                            && t.starts_with("Stream #")
                            && t.contains("Video:")
                            && let Some(caps) = fps_regex.captures(t)
                            && let Ok(fps) = caps[1].parse::<f64>()
                        {
                            // Handle 0 fps gracefully (disable intra-file progress instead of division by 0)
                            video_fps = Some(if fps > 0.0 { fps } else { -1.0 });
                        }

                        if let Some(total_secs) = total_duration_secs {
                            let mut current_secs: Option<f64> = None;

                            if let Some(time_idx) = t.find("time=") {
                                let time_sub = &t[time_idx + 5..];
                                if let Some(time_str) = time_sub.split_whitespace().next()
                                    && time_str != "N/A"
                                {
                                    current_secs = parse_ffmpeg_time(time_str);
                                }
                            }

                            // Fallback to frame= if time=N/A
                            if current_secs.is_none()
                                && let (Some(frame_idx), Some(fps)) = (t.find("frame="), video_fps)
                            {
                                let frame_sub = &t[frame_idx + 6..];
                                if let Some(frame_str) = frame_sub.split_whitespace().next()
                                    && let Ok(frames) = frame_str.parse::<f64>()
                                    && fps > 0.0
                                {
                                    current_secs = Some(frames / fps);
                                }
                            }

                            if let Some(secs) = current_secs {
                                let mut percent = (secs / total_secs) * 100.0;
                                if percent > 100.0 {
                                    percent = 100.0;
                                }
                                let _ = app.emit(
                                    "process-progress",
                                    serde_json::json!({
                                        "intra_progress": percent
                                    }),
                                );
                            }
                        }

                        if is_error_line(t) {
                            append_log(app, format!("  | [ERROR] {}", t));
                        } else {
                            append_log(app, format!("  | [INFO] {}", t));
                        }
                    }
                }
            }
            tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                let code = payload.code.unwrap_or(1);
                if code == 0 || (is_mkvmerge && code == 1) {
                    file_success = true;
                }
            }
            tauri_plugin_shell::process::CommandEvent::Error(err) => {
                append_log(app, format!("  | [FATAL] {}", err));
            }
            _ => {}
                }
            }
        }
    }

    if aborted_mid_stream || state.is_aborted.load(Ordering::SeqCst) || cancel_token.is_cancelled() {
        return Err(AppError::Aborted);
    }

    Ok((file_success, collected_stderr))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_comma_list() {
        assert_eq!(parse_comma_list("mkv, mp4, avi"), vec!["mkv", "mp4", "avi"]);
        assert_eq!(parse_comma_list(""), Vec::<String>::new());
        assert_eq!(parse_comma_list("MKV,,mp4"), vec!["mkv", "mp4"]);
    }

    #[test]
    fn test_parse_ffmpeg_time() {
        assert_eq!(parse_ffmpeg_time("00:00:00.00"), Some(0.0));
        assert_eq!(parse_ffmpeg_time("01:00:00.00"), Some(3600.0));
        assert_eq!(parse_ffmpeg_time("00:01:30.50"), Some(90.5));
        assert_eq!(parse_ffmpeg_time("invalid"), None);
    }

    #[test]
    fn test_stderr_indicates_subtitle_incompatibility() {
        let logs_ok = vec!["frame=123 fps=30".to_string()];
        assert!(!stderr_indicates_subtitle_incompatibility(&logs_ok));

        let logs_err = vec!["Subtitle codec not supported".to_string()];
        assert!(stderr_indicates_subtitle_incompatibility(&logs_err));

        let logs_err2 = vec!["could not write header for output file #0 (incorrect codec parameters ?)".to_string()];
        assert!(stderr_indicates_subtitle_incompatibility(&logs_err2));
    }
}
