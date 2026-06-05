use std::path::Path;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;

use crate::models::AppState;

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

/// Builds the base ffmpeg arg list (maps + codec flags) for either reencode or remux mode,
/// with a caller-supplied subtitle codec string ("copy" or "ass").
#[allow(clippy::too_many_arguments)]
pub fn build_ffmpeg_args(
    file_path: &Path,
    output_path: &Path,
    subtitle_maps: &[String],
    video_codec: &str,
    preset: &str,
    crf: &str,
    mode: &str,
    subtitle_codec: &str,
) -> Vec<String> {
    let mut args = vec![
        "-y".to_string(),
        "-i".to_string(),
        file_path.to_string_lossy().into_owned(),
        "-map".to_string(),
        "0:V?".to_string(), // map all video safely (Capital V ignores cover arts)
        "-map".to_string(),
        "0:a?".to_string(), // map all audio safely
        "-map".to_string(),
        "0:t?".to_string(), // Keep attachments (fonts)
    ];

    // Explicitly map exactly the subtitle IDs discovered by ffprobe
    for map in subtitle_maps {
        args.push("-map".to_string());
        args.push(map.clone());
    }

    if mode == "reencode" {
        args.extend([
            "-c:v".to_string(),
            video_codec.to_string(),
            "-preset".to_string(),
            preset.to_string(),
            "-crf".to_string(),
            crf.to_string(),
            "-c:a".to_string(),
            "copy".to_string(),
        ]);
    } else {
        // Remux: explicitly copy video and audio streams only.
        args.extend([
            "-c:v".to_string(),
            "copy".to_string(),
            "-c:a".to_string(),
            "copy".to_string(),
        ]);
    }

    args.extend(["-c:s".to_string(), subtitle_codec.to_string()]);

    // Clear the title metadata from the output file, matching the Python script's
    args.extend(["-metadata".to_string(), "title=".to_string()]);

    args.push(output_path.to_string_lossy().into_owned());
    args
}

/// Mimics the Python script's `get_matching_subtitle_maps` to extract exact numeric stream IDs using ffprobe
pub async fn get_matching_subtitle_maps(
    app: &AppHandle,
    file_path: &Path,
    allowed_langs: &[String],
) -> Result<Vec<String>, String> {
    let shell = app.shell();
    let cmd = shell
        .sidecar("ffprobe")
        .map_err(|e| format!("Failed to initialize ffprobe sidecar configuration: {}", e))?
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
        .map_err(|e| format!("ffprobe execution error: {}", e))?;

    if !output.status.success() {
        let stderr_str = String::from_utf8_lossy(&output.stderr);
        let stderr_sanitized = stderr_str
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect::<Vec<_>>()
            .join(" | ");
        return Err(format!("ffprobe diagnostic failure: {}", stderr_sanitized));
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
) -> Result<(bool, Vec<String>), String> {
    let shell = app.shell();
    let is_mkvmerge = binary_name == "mkvmerge";

    let cmd = shell
        .sidecar(binary_name)
        .map_err(|e| format!("Failed generating sidecar configurations: {e}"))?
        .args(args);

    let (mut rx, child) = cmd
        .spawn()
        .map_err(|e| format!("Failed allocating processing thread instance context: {e}"))?;

    {
        let mut session = state.process.lock().await;
        session.child = Some(child);
    }

    let mut aborted_mid_stream = false;
    let mut file_success = false;
    let mut collected_stderr: Vec<String> = Vec::new();
    let mut total_duration_secs: Option<f64> = None;

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
                            let _ = app.emit("process-log", format!("  | [ERROR] {}", t));
                        } else {
                            let _ = app.emit("process-log", format!("  | [INFO] {}", t));
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
                        } else if let Some(total_secs) = total_duration_secs {
                            if let Some(time_idx) = t.find("time=") {
                                let time_sub = &t[time_idx + 5..];
                                if let Some(time_str) = time_sub.split_whitespace().next() {
                                    if let Some(current_secs) = parse_ffmpeg_time(time_str) {
                                        let mut percent = (current_secs / total_secs) * 100.0;
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
                            }
                        }

                        if is_error_line(t) {
                            let _ = app.emit("process-log", format!("  | [ERROR] {}", t));
                        } else {
                            let _ = app.emit("process-log", format!("  | [INFO] {}", t));
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
                let _ = app.emit("process-log", format!("  | [FATAL] {}", err));
            }
            _ => {}
        }
    }

    if aborted_mid_stream || state.is_aborted.load(Ordering::SeqCst) {
        return Err("Pipeline execution aborted by user Request.".to_string());
    }

    Ok((file_success, collected_stderr))
}
