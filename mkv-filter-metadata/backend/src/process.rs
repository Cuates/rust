use std::path::Path;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;

use crate::error::AppError;
use crate::models::AppState;

/// Writes a log message to disk and emits it to the frontend.
pub fn append_log(app: &AppHandle, message: impl AsRef<str>) {
    let msg = message.as_ref();
    let _ = app.emit("process-log", msg);
    if let Ok(log_dir) = app.path().app_log_dir() {
        if !log_dir.exists() {
            let _ = std::fs::create_dir_all(&log_dir);
        }
        let log_file = log_dir.join("session.log");
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_file)
        {
            use std::io::Write;
            let _ = writeln!(file, "{}", msg);
        }
    }
}

/// Maps generic presets to NVENC-specific hardware presets (p1-p7)
pub fn get_ffmpeg_preset(codec: &str, preset: &str) -> String {
    if codec.contains("nvenc") {
        match preset {
            "ultrafast" => "p1".to_string(),
            "veryfast" => "p2".to_string(),
            "fast" => "p3".to_string(),
            "faster" => "p4".to_string(),
            "medium" => "p4".to_string(),
            "slow" => "p5".to_string(),
            "slower" => "p6".to_string(),
            "veryslow" => "p7".to_string(),
            _ => "p4".to_string(), // Default safe fallback
        }
    } else if codec.contains("amf") {
        match preset {
            "ultrafast" | "superfast" | "veryfast" | "faster" => "speed".to_string(),
            "medium" | "fast" => "balanced".to_string(),
            "slow" | "slower" | "veryslow" => "quality".to_string(),
            _ => "balanced".to_string(),
        }
    } else {
        preset.to_string()
    }
}

/// Generic parser used to break comma-separated strings (like extensions or languages) into arrays
pub fn parse_comma_list(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Inspects collected stderr lines from an FFmpeg run and determines whether the failure
/// was caused by a subtitle codec being incompatible with the target container.
pub fn stderr_indicates_subtitle_incompatibility(logs: &[String]) -> bool {
    logs.iter().any(|l| {
        let l = l.to_lowercase();
        (l.contains("subtitle codec") && l.contains("not supported"))
            || l.contains("could not write header")
            || (l.contains("function not implemented") && !l.contains("vf#"))
    })
}

#[derive(Debug, PartialEq)]
pub enum ConversionMode {
    Remux,
    Reencode,
}

#[derive(Debug, PartialEq)]
pub enum SubtitleCodec {
    Copy,
    Ass,
}

#[derive(Debug)]
pub struct ReencodeConfig<'a> {
    pub video_codec: &'a str,
    pub preset: &'a str,
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
    let mut args = vec![
        "-y".to_string(),
        "-i".to_string(),
        config.input.to_string_lossy().into_owned(),
        "-map".to_string(),
        "0:V?".to_string(), // map all video safely (Capital V ignores cover arts)
        "-map".to_string(),
        "0:a?".to_string(), // map all audio safely
        "-map".to_string(),
        "0:t?".to_string(), // Keep attachments (fonts)
    ];

    // Explicitly map exactly the subtitle IDs discovered by ffprobe
    for map in config.subtitle_maps {
        args.push("-map".to_string());
        args.push(map.clone());
    }

    match config.mode {
        ConversionMode::Reencode => {
            if let Some(reencode) = &config.reencode {
                let mut reencode_args = vec!["-c:v".to_string(), reencode.video_codec.to_string()];

                if reencode.video_codec.contains("nvenc") {
                    reencode_args.extend([
                        "-preset".to_string(),
                        reencode.preset.to_string(),
                        "-cq".to_string(),
                        reencode.crf.to_string(),
                        "-b:v".to_string(),
                        "0".to_string(),
                    ]);
                } else if reencode.video_codec.contains("amf") {
                    reencode_args.extend([
                        "-usage".to_string(),
                        "transcoding".to_string(),
                        "-quality".to_string(),
                        reencode.preset.to_string(),
                        "-rc".to_string(),
                        "cqp".to_string(),
                        "-qp_i".to_string(),
                        reencode.crf.to_string(),
                        "-qp_p".to_string(),
                        reencode.crf.to_string(),
                    ]);
                } else if reencode.video_codec.contains("qsv") {
                    reencode_args.extend([
                        "-preset".to_string(),
                        reencode.preset.to_string(),
                        "-q".to_string(),
                        reencode.crf.to_string(),
                    ]);
                } else if reencode.video_codec.contains("videotoolbox") {
                    reencode_args.extend(["-q:v".to_string(), reencode.crf.to_string()]);
                } else {
                    reencode_args.extend([
                        "-preset".to_string(),
                        reencode.preset.to_string(),
                        "-crf".to_string(),
                        reencode.crf.to_string(),
                    ]);
                }

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
            parts[1].trim().to_lowercase()
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

    let cmd = shell
        .sidecar(binary_name)
        .map_err(|e| AppError::Sidecar(format!("Failed generating sidecar configurations: {e}")))?
        .args(args);

    let (mut rx, child) = cmd.spawn().map_err(|e| {
        AppError::Sidecar(format!(
            "Failed allocating processing thread instance context: {e}"
        ))
    })?;

    {
        let mut session = state.process.lock().await;
        session.child = Some(child);
    }

    let mut aborted_mid_stream = false;
    let mut file_success = false;
    let mut collected_stderr: Vec<String> = Vec::new();
    let mut total_duration_secs: Option<f64> = None;
    let mut video_fps: Option<f64> = None;

    while let Some(event) = rx.recv().await {
        if state.is_aborted.load(Ordering::SeqCst) {
            aborted_mid_stream = true;
            break;
        }

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

                        if total_duration_secs.is_none() && t.starts_with("Duration:") {
                            if let Some(dur_str) = t
                                .strip_prefix("Duration:")
                                .map(|s| s.trim())
                                .and_then(|s| s.split(',').next())
                            {
                                total_duration_secs = parse_ffmpeg_time(dur_str);
                            }
                        }

                        if video_fps.is_none() && t.starts_with("Stream #") && t.contains("Video:")
                        {
                            if let Some(fps_idx) = t.find(" fps") {
                                let substr = &t[..fps_idx];
                                if let Some(fps_str) = substr.split(',').next_back().map(|s| s.trim()) {
                                    if let Ok(fps) = fps_str.parse::<f64>() {
                                        video_fps = Some(fps);
                                    }
                                }
                            }
                        }

                        if let Some(total_secs) = total_duration_secs {
                            let mut current_secs: Option<f64> = None;

                            if let Some(time_idx) = t.find("time=") {
                                let time_sub = &t[time_idx + 5..];
                                if let Some(time_str) = time_sub.split_whitespace().next() {
                                    if time_str != "N/A" {
                                        current_secs = parse_ffmpeg_time(time_str);
                                    }
                                }
                            }

                            // Fallback to frame= if time=N/A
                            if current_secs.is_none() {
                                if let (Some(frame_idx), Some(fps)) = (t.find("frame="), video_fps)
                                {
                                    let frame_sub = &t[frame_idx + 6..];
                                    if let Some(frame_str) = frame_sub.split_whitespace().next() {
                                        if let Ok(frames) = frame_str.parse::<f64>() {
                                            if fps > 0.0 {
                                                current_secs = Some(frames / fps);
                                            }
                                        }
                                    }
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

    if aborted_mid_stream || state.is_aborted.load(Ordering::SeqCst) {
        return Err(AppError::Aborted);
    }

    Ok((file_success, collected_stderr))
}
