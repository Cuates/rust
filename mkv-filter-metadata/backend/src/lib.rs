use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;

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

#[derive(Default)]
pub struct AppState {
    pub is_aborted: AtomicBool,
    pub active_child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
    pub current_output_path: Mutex<Option<PathBuf>>,

    // --- NEW: Full Session Rollback Ledgers ---
    pub session_output_files: Mutex<Vec<PathBuf>>,
    pub session_output_dirs: Mutex<Vec<PathBuf>>,
}

/// Maps generic presets to NVENC-specific hardware presets (p1-p7)
fn get_ffmpeg_preset(codec: &str, preset: &str) -> String {
    if codec.contains("nvenc") {
        match preset {
            "ultrafast" => "p1".to_string(),
            "veryfast"  => "p2".to_string(),
            "fast"      => "p3".to_string(),
            "faster"    => "p4".to_string(),
            "medium"    => "p4".to_string(),
            "slow"      => "p5".to_string(),
            "slower"    => "p6".to_string(),
            "veryslow"  => "p7".to_string(),
            _           => "p4".to_string(), // Default safe fallback
        }
    } else {
        preset.to_string()
    }
}

/// Generic parser used to break comma-separated strings (like extensions or languages) into arrays
fn parse_comma_list(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Inspects collected stderr lines from an FFmpeg run and determines whether the failure
/// was caused by a subtitle codec being incompatible with the target container.
/// This approach lets FFmpeg itself be the source of truth — no hardcoded codec lists needed.
fn stderr_indicates_subtitle_incompatibility(logs: &[String]) -> bool {
    logs.iter().any(|l| {
        let l = l.to_lowercase();
        (l.contains("subtitle codec") && l.contains("not supported"))
            || l.contains("could not write header")
            || (l.contains("function not implemented") && !l.contains("vf#"))
    })
}

/// Builds the base ffmpeg arg list (maps + codec flags) for either reencode or remux mode,
/// with a caller-supplied subtitle codec string ("copy" or "ass").
fn build_ffmpeg_args(
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
        "-i".to_string(), file_path.to_string_lossy().into_owned(),
        "-map".to_string(), "0:V?".to_string(), // map all video safely (Capital V ignores cover arts)
        "-map".to_string(), "0:a?".to_string(), // map all audio safely
        "-map".to_string(), "0:t?".to_string(), // Keep attachments (fonts)
    ];

    // Explicitly map exactly the subtitle IDs discovered by ffprobe
    for map in subtitle_maps {
        args.push("-map".to_string());
        args.push(map.clone());
    }

    if mode == "reencode" {
        args.extend([
            "-c:v".to_string(), video_codec.to_string(),
            "-preset".to_string(), preset.to_string(),
            "-crf".to_string(), crf.to_string(),
            "-c:a".to_string(), "copy".to_string(),
        ]);
    } else {
        // Remux: explicitly copy video and audio streams only.
        // Avoid the global "-c copy" here because it conflicts with the "-c:s <codec>" that
        // follows, causing FFmpeg to emit a "Multiple -codec options specified" warning on
        // every subtitle stream. Setting -c:v and -c:a individually is unambiguous.
        args.extend([
            "-c:v".to_string(), "copy".to_string(),
            "-c:a".to_string(), "copy".to_string(),
        ]);
    }

    args.extend(["-c:s".to_string(), subtitle_codec.to_string()]);
    args.push(output_path.to_string_lossy().into_owned());
    args
}

/// Mimics the Python script's `get_matching_subtitle_maps` to extract exact numeric stream IDs using ffprobe
async fn get_matching_subtitle_maps(
    app: &AppHandle,
    file_path: &Path,
    allowed_langs: &[String],
) -> Result<Vec<String>, String> {
    let shell = app.shell();
    let cmd = shell
        .sidecar("ffprobe")
        .map_err(|e| format!("Failed to initialize ffprobe sidecar configuration: {}", e))?
        .args([
            "-v", "error",
            "-select_streams", "s",
            "-show_entries", "stream=index:stream_tags=language",
            "-of", "csv=p=0",
            &file_path.to_string_lossy().into_owned(),
        ]);

    let output = cmd.output().await.map_err(|e| format!("ffprobe execution error: {}", e))?;

    if !output.status.success() {
        let stderr_str = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffprobe diagnostic failure: {}", stderr_str));
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

#[tauri::command]
async fn get_sidecar_version(app: AppHandle, binary_name: String) -> Result<String, String> {
    let shell = app.shell();
    let args = if binary_name == "mkvmerge" {
        vec!["--version".to_string()]
    } else {
        vec!["-version".to_string()]
    };

    let cmd = shell
        .sidecar(&binary_name)
        .map_err(|e| format!("Failed to initialize sidecar configuration: {e}"))?
        .args(args);

    let output = cmd.output().await.map_err(|e| format!("Binary execution error: {e}"))?;

    if output.status.success() {
        let stdout_str = String::from_utf8_lossy(&output.stdout);
        if let Some(first_line) = stdout_str.lines().next() {
            return Ok(first_line.to_string());
        }
        Ok(stdout_str.into_owned())
    } else {
        let stderr_str = String::from_utf8_lossy(&output.stderr);
        Err(format!("Sidecar diagnostic failure: {}", stderr_str))
    }
}

#[tauri::command]
async fn check_nvenc_support(app: AppHandle) -> bool {
    let shell = app.shell();
    if let Ok(cmd) = shell.sidecar("ffmpeg") {
        if let Ok(output) = cmd.args(["-encoders"]).output().await {
            let stdout = String::from_utf8_lossy(&output.stdout);
            return stdout.contains("hevc_nvenc");
        }
    }
    false
}

#[tauri::command]
async fn abort_video_pipeline(app: AppHandle, state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.is_aborted.store(true, Ordering::SeqCst);

    let opt_child = {
        let mut lock = state.active_child.lock().map_err(|_| "Process lock exception")?;
        lock.take()
    };

    if let Some(child) = opt_child {
        let _ = child.kill();
        tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
    }

    let (files_to_delete, dirs_to_check) = {
        let mut files_lock = state.session_output_files.lock().map_err(|_| "Files tracking lock exception")?;
        let mut dirs_lock = state.session_output_dirs.lock().map_err(|_| "Dirs tracking lock exception")?;

        let files = files_lock.clone();
        let dirs = dirs_lock.clone();

        files_lock.clear();
        dirs_lock.clear();

        (files, dirs)
    };

    let target_cleanup_path = {
        let mut path_lock = state.current_output_path.lock().map_err(|_| "Path lock acquisition exception")?;
        path_lock.take()
    };

    if let Some(path) = target_cleanup_path {
        if path.exists() {
            let _ = fs::remove_file(&path);
        }
    }

    for file in files_to_delete {
        if file.exists() {
            if let Err(e) = fs::remove_file(&file) {
                let _ = app.emit("process-log", format!("❌ Failed to delete rollback file {:?}: {}", file, e));
            } else {
                let _ = app.emit("process-log", format!("Cleaned up session file safely: \"{}\"", file.to_string_lossy()));
            }
        }
    }

    for dir in dirs_to_check {
        if dir.exists() && dir.is_dir() {
            if let Ok(mut entries) = fs::read_dir(&dir) {
                if entries.next().is_none() {
                    if let Err(e) = fs::remove_dir(&dir) {
                        let _ = app.emit("process-log", format!("❌ Failed to remove empty processed_files directory: {}", e));
                    } else {
                        let _ = app.emit("process-log", format!("Cleaned up empty workspace folder safely: \"{}\"", dir.to_string_lossy()));
                    }
                }
            }
        }
    }

    Ok(())
}

/// Determines whether a log line from FFmpeg or mkvmerge should be classified as [ERROR].
///
/// Simple substring matching on the full line is unreliable because filenames can contain
/// words like "Terror" (which contains "error") or "Invalid" as part of a title. Instead,
/// we strip any leading bracketed context tag (e.g. "[muxer @ 0x...]") that FFmpeg prepends
/// and check whether the error keyword appears at the start of the actual message text.
/// This ensures only genuine tool error messages are promoted to [ERROR], not false positives
/// caused by keywords embedded in file paths or media titles.
fn is_error_line(line: &str) -> bool {
    // Strip optional leading FFmpeg bracket context: "[tag @ addr] " or "[tag] "
    let message = if line.starts_with('[') {
        // Find the closing bracket, then skip optional whitespace
        line.find(']').map(|i| line[i + 1..].trim_start()).unwrap_or(line)
    } else {
        line
    };

    // mkvmerge prefixes its own errors with "Error:"
    // FFmpeg genuine errors begin with the keyword directly after the bracket context
    let ml = message.to_lowercase();
    ml.starts_with("error") || ml.starts_with("invalid") || ml.starts_with("failed")
        || ml.starts_with("conversion failed")
        || ml.starts_with("task finished with error")
        || ml.starts_with("error sending frames")
}

/// Helper function to execute a sidecar command and handle its events.
/// Returns (success, collected_stderr_lines) so callers can inspect FFmpeg's error output.
async fn run_sidecar_command(
    app: &AppHandle,
    state: &tauri::State<'_, AppState>,
    binary_name: &str,
    args: Vec<String>,
) -> Result<(bool, Vec<String>), String> {
    let shell = app.shell();
    let is_mkvmerge = binary_name == "mkvmerge";

    let cmd = shell.sidecar(binary_name)
        .map_err(|e| format!("Failed generating sidecar configurations: {e}"))?
        .args(args);

    let (mut rx, child) = cmd.spawn()
        .map_err(|e| format!("Failed allocating processing thread instance context: {e}"))?;

    {
        let mut lock = state.active_child.lock().map_err(|_| "Process lock exception")?;
        *lock = Some(child);
    }

    let mut aborted_mid_stream = false;
    let mut file_success = false;
    let mut collected_stderr: Vec<String> = Vec::new();

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
                        // Collect all stderr lines so the caller can inspect them for
                        // subtitle incompatibility errors after the run completes
                        collected_stderr.push(t.to_string());

                        if is_error_line(t) {
                            let _ = app.emit("process-log", format!("  | [ERROR] {}", t));
                        } else {
                            // Treat standard progress and summary dumps as info
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

#[tauri::command]
async fn process_video_pipeline(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    payload: VideoPipelinePayload,
) -> Result<String, String> {
    state.is_aborted.store(false, Ordering::SeqCst);
    {
        let mut lock = state.active_child.lock().map_err(|_| "State init fault")?;
        *lock = None;
        let mut path_lock = state.current_output_path.lock().map_err(|_| "Output path tracking init fault")?;
        *path_lock = None;

        let mut files_lock = state.session_output_files.lock().unwrap();
        files_lock.clear();

        let mut dirs_lock = state.session_output_dirs.lock().unwrap();
        dirs_lock.clear();
    }

    let _ = app.emit("process-log", "Analyzing targets and indexing directories...");

    let extensions = parse_comma_list(&payload.file_extensions);
    let sub_langs = parse_comma_list(&payload.subtitle_tracks);
    let mut target_files = Vec::new();

    for dir_path in &payload.input_directories {
        if state.is_aborted.load(Ordering::SeqCst) {
            return Err("Pipeline execution aborted by user Request.".to_string());
        }

        if let Ok(entries) = std::fs::read_dir(dir_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        if extensions.contains(&ext.to_lowercase()) {
                            target_files.push(path);
                        }
                    }
                }
            }
        }
    }

    let total_files = target_files.len();
    let _ = app.emit("process-log", format!("Scanned file total: {}", total_files));

    if total_files == 0 {
        return Ok("Pipeline terminated: No valid files matched filter parameters.".to_string());
    }

    let mut successful_files = 0;
    let mut failed_files = 0;
    let mut ffmpeg_fallback_failures = 0;
    // FIX: Track retry attempts and retry successes separately for accurate metrics reporting.
    let mut reencode_subtitle_retry_attempts = 0;
    let mut reencode_subtitle_retry_successes = 0;

    for (index, file_path) in target_files.iter().enumerate() {
        if state.is_aborted.load(Ordering::SeqCst) {
            return Err("Pipeline execution aborted by user Request.".to_string());
        }

        let file_name = file_path.file_name().and_then(|n| n.to_str()).unwrap_or("Unknown");
        let current_index = index + 1;

        let _ = app.emit("process-log", format!("[{}/{}] Processing file: {}", current_index, total_files, file_name));

        let current_progress = ((index as f32 / total_files as f32) * 100.0) as u32;
        let _ = app.emit("process-progress", serde_json::json!({
            "progress": current_progress,
            "current_index": current_index,
            "total_files": total_files
        }));

        let parent_dir = file_path.parent().ok_or("Unable to resolve parent path contextual tracking.")?;
        let processed_dir_path = parent_dir.join("processed_files");

        if !processed_dir_path.exists() {
            std::fs::create_dir_all(&processed_dir_path)
                .map_err(|e| format!("Failed to instantiate target subfolder workspace directory: {e}"))?;
        }

        {
            let mut dirs_lock = state.session_output_dirs.lock().unwrap();
            if !dirs_lock.contains(&processed_dir_path) {
                dirs_lock.push(processed_dir_path.clone());
            }
        }

        let file_stub = file_path.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
        let formatted_ext = if payload.output_extension.starts_with('.') {
            payload.output_extension.clone()
        } else {
            format!(".{}", payload.output_extension)
        };

        let clean_output_filename = format!("{}{}", file_stub, formatted_ext);
        let output_file_path = processed_dir_path.join(clean_output_filename);

        {
            let mut path_lock = state.current_output_path.lock().map_err(|_| "Failed lock acquisition")?;
            *path_lock = Some(output_file_path.clone());

            let mut files_lock = state.session_output_files.lock().unwrap();
            files_lock.push(output_file_path.clone());
        }

        // Run ffprobe to get exact stream IDs for matching subtitles before building ffmpeg command
        let subtitle_maps = get_matching_subtitle_maps(&app, file_path, &sub_langs).await.unwrap_or_else(|e| {
            let _ = app.emit("process-log", format!("  | ⚠️ FFprobe parsing error, defaulting to no subtitles. Error: {}", e));
            Vec::new()
        });

        let mapped_preset = get_ffmpeg_preset(&payload.video_codec, &payload.preset);
        let mut file_success;

        // Routing Logic: Reencode vs Remux Fallback Protocol
        if payload.conversion_mode == "reencode" {
            // First attempt: try copying subtitles as-is
            let ffmpeg_args = build_ffmpeg_args(
                file_path,
                &output_file_path,
                &subtitle_maps,
                &payload.video_codec,
                &mapped_preset,
                &payload.crf,
                "reencode",
                "copy",
            );

            let (success, stderr_lines) = run_sidecar_command(&app, &state, "ffmpeg", ffmpeg_args).await?;
            file_success = success;

            // If the copy failed due to a subtitle codec incompatible with the container,
            // retry automatically with ASS conversion. No codec list needed — FFmpeg tells us.
            if !file_success && stderr_indicates_subtitle_incompatibility(&stderr_lines) {
                reencode_subtitle_retry_attempts += 1;
                let _ = app.emit("process-log", "  | [ERROR] ⚠️ Subtitle codec incompatible with container. Retrying with ASS conversion...");

                if output_file_path.exists() {
                    let _ = std::fs::remove_file(&output_file_path);
                }

                let retry_args = build_ffmpeg_args(
                    file_path,
                    &output_file_path,
                    &subtitle_maps,
                    &payload.video_codec,
                    &mapped_preset,
                    &payload.crf,
                    "reencode",
                    "ass",
                );

                let (retry_success, _) = run_sidecar_command(&app, &state, "ffmpeg", retry_args).await?;
                file_success = retry_success;

                // FIX: Emit a diagnostic if the ASS retry also failed, and track success separately.
                if file_success {
                    reencode_subtitle_retry_successes += 1;
                } else {
                    let _ = app.emit("process-log", "  | [ERROR] ⚠️ ASS conversion retry also failed. Subtitle codec may be undecodable (e.g. WebVTT/none). File marked as failed.");
                }
            }
        } else {
            // Remux protocol
            let _ = app.emit("process-log", "  | Initializing primary stream copy protocol (FFmpeg)...");

            // First attempt: try copying subtitles as-is
            let ffmpeg_copy_args = build_ffmpeg_args(
                file_path,
                &output_file_path,
                &subtitle_maps,
                "",
                "",
                "",
                "remux",
                "copy",
            );

            let (success, stderr_lines) = run_sidecar_command(&app, &state, "ffmpeg", ffmpeg_copy_args).await?;
            file_success = success;

            // Same subtitle incompatibility retry as reencode path
            if !file_success && stderr_indicates_subtitle_incompatibility(&stderr_lines) {
                let _ = app.emit("process-log", "  | [ERROR] ⚠️ Subtitle codec incompatible with container. Retrying with ASS conversion...");

                if output_file_path.exists() {
                    let _ = std::fs::remove_file(&output_file_path);
                }

                let retry_copy_args = build_ffmpeg_args(
                    file_path,
                    &output_file_path,
                    &subtitle_maps,
                    "",
                    "",
                    "",
                    "remux",
                    "ass",
                );

                let (retry_success, retry_stderr) = run_sidecar_command(&app, &state, "ffmpeg", retry_copy_args).await?;
                file_success = retry_success;

                // If the ASS retry also failed for a non-subtitle reason, propagate the
                // original failure so the mkvmerge fallback below can still trigger
                if !file_success && stderr_indicates_subtitle_incompatibility(&retry_stderr) {
                    file_success = false; // still failed, fall through to mkvmerge
                }
            }

            // If FFmpeg failed entirely (both copy and ASS retry), fall back to mkvmerge
            if !file_success {
                ffmpeg_fallback_failures += 1; // Increment conversion failure count
                let _ = app.emit("process-log", "  | ⚠️ FFmpeg stream copy failed. Initiating fallback to MKVMerge...");

                if output_file_path.exists() {
                    let _ = std::fs::remove_file(&output_file_path);
                }

                let mut mkvmerge_args = vec![
                    "-o".to_string(), output_file_path.to_string_lossy().into_owned(),
                ];

                // Append MKVMerge specific subtitle tracking rules
                if !sub_langs.is_empty() {
                    mkvmerge_args.push("--subtitle-tracks".to_string());
                    mkvmerge_args.push(sub_langs.join(","));
                } else {
                    // Drop all subtitles if array is blank
                    mkvmerge_args.push("--no-subtitles".to_string());
                }

                mkvmerge_args.push(file_path.to_string_lossy().into_owned());

                let (mkvmerge_success, _) = run_sidecar_command(&app, &state, "mkvmerge", mkvmerge_args).await?;
                file_success = mkvmerge_success;
            }
        }

        // Tally results
        if file_success {
            successful_files += 1;
        } else {
            failed_files += 1;
        }
    }

    {
        let mut path_lock = state.current_output_path.lock().unwrap();
        *path_lock = None;
    }

    let _ = app.emit("process-progress", serde_json::json!({
        "progress": 100,
        "current_index": total_files,
        "total_files": total_files
    }));

    // Explicitly output the total ffmpeg stream copy failures to the Real-time Log ONLY if failures exist
    if payload.conversion_mode != "reencode" && ffmpeg_fallback_failures > 0 {
        let _ = app.emit(
            "process-log",
            format!("📊 Session Metrics -> Primary FFmpeg Stream Copy Failures resolved via fallback: {}", ffmpeg_fallback_failures)
        );
    }

    // FIX: Report retry attempts vs successes separately so the metric is accurate.
    // e.g. "3 triggered, 1 resolved" rather than the misleading "3 resolved" from before.
    if payload.conversion_mode == "reencode" && reencode_subtitle_retry_attempts > 0 {
        let reencode_subtitle_retry_failures = reencode_subtitle_retry_attempts - reencode_subtitle_retry_successes;
        let _ = app.emit(
            "process-log",
            format!(
                "📊 Session Metrics -> Reencode Subtitle Codec Retries: {} triggered, {} resolved via ASS conversion, {} still failed.",
                reencode_subtitle_retry_attempts,
                reencode_subtitle_retry_successes,
                reencode_subtitle_retry_failures,
            )
        );
    }

    let final_summary = if failed_files == 0 {
        format!("✅ Success! All {} active queue pipelines executed to completion.", successful_files)
    } else {
        format!("⚠️ Execution Finished: {} Succeeded, {} Failed.", successful_files, failed_files)
    };

    Ok(final_summary)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            process_video_pipeline,
            abort_video_pipeline,
            get_sidecar_version,
            check_nvenc_support
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}