use std::fs;
use std::path::Path;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::ShellExt;

use crate::error::AppError;
use crate::models::{AppState, ConversionMode, DirectoryStats, FileStat, VideoPipelinePayload};
use crate::process::{
    FfmpegJobConfig, ReencodeConfig, SubtitleCodec, append_log, build_ffmpeg_args,
    flush_log_writer, get_matching_subtitle_maps, parse_comma_list, run_sidecar_command,
    stderr_indicates_subtitle_incompatibility,
};

#[tauri::command]
pub async fn get_directory_stats(
    dir_path: String,
    file_extensions: String,
) -> Result<DirectoryStats, AppError> {
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&dir_path);
        if !path.exists() || !path.is_dir() {
            return DirectoryStats {
                exists: false,
                file_count: 0,
                total_size_bytes: 0,
                files: Vec::new(),
            };
        }

        let extensions = parse_comma_list(&file_extensions);
        let mut file_count = 0;
        let mut total_size_bytes = 0;
        let mut files = Vec::new();

        for entry in walkdir::WalkDir::new(path)
            .max_depth(1)
            .into_iter()
            .flatten()
        {
            let p = entry.path();
            if p.is_file()
                && let Some(ext) = p.extension().and_then(|e| e.to_str())
                && extensions.contains(&ext.to_lowercase())
            {
                file_count += 1;
                let mut size_bytes = 0;
                if let Ok(meta) = entry.metadata() {
                    size_bytes = meta.len();
                    total_size_bytes += size_bytes;
                }
                let name = entry.file_name().to_string_lossy().into_owned();
                files.push(FileStat { name, size_bytes });
            }
        }

        DirectoryStats {
            exists: true,
            file_count,
            total_size_bytes,
            files,
        }
    })
    .await
    .map_err(|e| AppError::Process(format!("Task join error: {}", e)))
}

fn validate_preset_codec_compat(codec: &crate::models::VideoCodec, preset: &crate::models::Preset) -> Result<(), AppError> {
    use crate::models::{Preset, VideoCodec};
    match codec {
        VideoCodec::Libx264 | VideoCodec::Libx265 => match preset {
            Preset::Ultrafast | Preset::Superfast | Preset::Veryfast | Preset::Faster
            | Preset::Fast | Preset::Medium | Preset::Slow | Preset::Slower | Preset::Veryslow => Ok(()),
            _ => Err(AppError::Process(format!("Preset '{}' is not compatible with software encoder '{}'", preset, codec))),
        },
        VideoCodec::HevcNvenc | VideoCodec::H264Nvenc | VideoCodec::Av1Nvenc => match preset {
            Preset::P1 | Preset::P2 | Preset::P3 | Preset::P4 | Preset::P5 | Preset::P6 | Preset::P7 => Ok(()),
            _ => Err(AppError::Process(format!("Preset '{}' is not compatible with NVENC encoder '{}'", preset, codec))),
        },
        VideoCodec::HevcAmf | VideoCodec::H264Amf | VideoCodec::Av1Amf => match preset {
            Preset::Speed | Preset::Balanced | Preset::Quality => Ok(()),
            _ => Err(AppError::Process(format!("Preset '{}' is not compatible with AMF encoder '{}'", preset, codec))),
        },
        VideoCodec::HevcVideotoolbox | VideoCodec::H264Videotoolbox
        | VideoCodec::HevcQsv | VideoCodec::H264Qsv | VideoCodec::Av1Qsv => match preset {
            Preset::Default => Ok(()),
            _ => Err(AppError::Process(format!("Preset '{}' is not compatible with hardware encoder '{}'. Use 'default'.", preset, codec))),
        },
    }
}

fn validate_ext_list(raw: &str) -> Result<(), AppError> {
    for ext in parse_comma_list(raw) {
        if !ext.chars().all(|c| c.is_ascii_alphanumeric()) {
            return Err(AppError::Process(format!("Invalid file extension: '{}'", ext)));
        }
    }
    Ok(())
}

fn validate_subtitle_tracks(raw: &str) -> Result<(), AppError> {
    for track in parse_comma_list(raw) {
        if !track.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
            return Err(AppError::Process(format!("Invalid subtitle track: '{}'", track)));
        }
    }
    Ok(())
}

fn validate_payload(payload: &VideoPipelinePayload) -> Result<(), AppError> {
    validate_ext_list(&payload.file_extensions)?;
    validate_subtitle_tracks(&payload.subtitle_tracks)?;

    if payload.conversion_mode == crate::models::ConversionMode::Reencode {
        validate_preset_codec_compat(&payload.video_codec, &payload.preset)?;

        let crf: u32 = payload
            .crf
            .parse()
            .map_err(|_| AppError::Process("Invalid CRF value. Must be a number.".into()))?;
        if crf > 51 {
            return Err(AppError::Process("CRF must be between 0 and 51".into()));
        }
    }

    if payload.output_extension.is_empty() {
        return Err(AppError::Process("Output extension is required".into()));
    }
    if payload.output_extension.contains('/') || payload.output_extension.contains('\\') {
        return Err(AppError::Process(
            "Invalid output extension: Path separators not allowed".into(),
        ));
    }

    Ok(())
}

#[derive(serde::Serialize)]
pub struct PipelineSummary {
    pub message: String,
    pub original_size_bytes: u64,
    pub output_size_bytes: u64,
}

#[tauri::command]
pub async fn process_video_pipeline(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    payload: VideoPipelinePayload,
) -> Result<PipelineSummary, AppError> {
    validate_payload(&payload)?;

    state.is_aborted.store(false, Ordering::SeqCst);
    let cancel_token;
    {
        let mut session = state.process.lock().await;
        session.cancel = tokio_util::sync::CancellationToken::new();
        cancel_token = session.cancel.clone();
        session.child = None;
        session.output_path = None;
        session.output_files.clear();
        session.completed_files.clear();
        session.output_dirs.clear();
    }

    append_log(&app, "Analyzing targets and indexing directories...");

    let extensions = parse_comma_list(&payload.file_extensions);
    let sub_langs = parse_comma_list(&payload.subtitle_tracks);
    let input_directories = payload.input_directories.clone();
    let recursive = payload.recursive;
    let app_clone = app.clone();

    let cancel_token_clone = cancel_token.clone();
    let target_files = tokio::task::spawn_blocking(move || {
        let mut target_files = Vec::new();
        let state = app_clone.state::<AppState>();

        for dir_path in &input_directories {
            if state.is_aborted.load(Ordering::SeqCst) || cancel_token_clone.is_cancelled() {
                return Err(AppError::Aborted);
            }

            let mut walker = walkdir::WalkDir::new(dir_path);
            if !recursive {
                walker = walker.max_depth(1);
            }

            for entry in walker.into_iter().flatten() {
                let path = entry.path();
                if path.is_file()
                    && let Some(ext) = path.extension().and_then(|e| e.to_str())
                    && extensions.contains(&ext.to_lowercase())
                {
                    target_files.push((dir_path.clone(), path.to_path_buf()));
                }
            }
        }
        Ok(target_files)
    })
    .await
    .map_err(|e| AppError::Process(format!("Task join error: {}", e)))??;

    let total_files = target_files.len();
    append_log(&app, format!("Scanned file total: {}", total_files));

    if total_files == 0 {
        return Ok(PipelineSummary {
            message: "Pipeline terminated: No valid files matched filter parameters.".to_string(),
            original_size_bytes: 0,
            output_size_bytes: 0,
        });
    }

    let mut successful_files = 0;
    let mut failed_files = 0;
    let mut ffmpeg_fallback_failures = 0;
    let mut reencode_subtitle_retry_attempts = 0;
    let mut reencode_subtitle_retry_successes = 0;
    let mut total_original_bytes: u64 = 0;
    let mut total_output_bytes: u64 = 0;

    for (index, (queue_dir, file_path)) in target_files.iter().enumerate() {
        if state.is_aborted.load(Ordering::SeqCst) || cancel_token.is_cancelled() {
            return Err(AppError::Aborted);
        }

        let file_name = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown");
        let current_index = index + 1;

        append_log(
            &app,
            format!(
                "[{}/{}] Processing file: {}",
                current_index, total_files, file_name
            ),
        );

        let current_progress = ((index as f32 / total_files as f32) * 100.0) as u32;
        let _ = app.emit(
            "process-progress",
            serde_json::json!({
                "progress": current_progress,
                "current_index": current_index,
                "total_files": total_files,
                "active_directory": queue_dir,
                "current_filename": file_name
            }),
        );

        let parent_dir = file_path.parent().ok_or_else(|| {
            AppError::Process("Unable to resolve parent path contextual tracking.".to_string())
        })?;
        let processed_dir_path = parent_dir.join("processed_files");

        if !processed_dir_path.exists() {
            std::fs::create_dir_all(&processed_dir_path).map_err(|e| {
                AppError::Process(format!(
                    "Failed to instantiate target subfolder workspace directory: {e}"
                ))
            })?;
        }

        let file_stub = file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("output");
        let formatted_ext = if payload.output_extension.starts_with('.') {
            payload.output_extension.clone()
        } else {
            format!(".{}", payload.output_extension)
        };

        let output_file_path;
        {
            let mut session = state.process.lock().await;
            // Track the output directory for cleanup on abort
            if !session.output_dirs.contains(&processed_dir_path) {
                session.output_dirs.push(processed_dir_path.clone());
            }

            // Deduplicate output filenames to prevent silent overwrites when multiple
            // input files map to the same output name (e.g., movie.mkv and movie.avi → movie.mkv)
            let base_candidate = processed_dir_path.join(format!("{}{}", file_stub, formatted_ext));
            let mut candidate = base_candidate.clone();
            let mut dedup_counter = 1u32;
            while session.output_files.contains(&candidate) {
                candidate = processed_dir_path
                    .join(format!("{}_{}{}", file_stub, dedup_counter, formatted_ext));
                dedup_counter += 1;
            }
            output_file_path = candidate;

            session.output_path = Some(output_file_path.clone());
            session.output_files.push(output_file_path.clone());
        }

        // M9: Session Resumption logic
        // If the file already exists on disk, assume it was successfully completed in a prior aborted run and skip.
        if output_file_path.exists() {
            append_log(
                &app,
                format!(
                    "  | [INFO] ⏭️ Skipping file - output already exists: {}",
                    output_file_path.display()
                ),
            );
            successful_files += 1;
            continue;
        }

        // Run ffprobe to get exact stream IDs for matching subtitles before building ffmpeg command
        let subtitle_maps = get_matching_subtitle_maps(&app, file_path, &sub_langs).await.unwrap_or_else(|e| {
            append_log(&app, format!("  | [ERROR] ⚠️ FFprobe parsing error, defaulting to no subtitles. Error: {}", e));
            Vec::new()
        });

        let mut file_success;

        // Routing Logic: Reencode vs Remux Fallback Protocol
        if payload.conversion_mode == ConversionMode::Reencode {
            // First attempt: try copying subtitles as-is
            let ffmpeg_args = build_ffmpeg_args(&FfmpegJobConfig {
                input: file_path,
                output: &output_file_path,
                subtitle_maps: &subtitle_maps,
                mode: ConversionMode::Reencode,
                subtitle_codec: SubtitleCodec::Copy,
                reencode: Some(ReencodeConfig {
                    video_codec: &payload.video_codec,
                    preset: &payload.preset,
                    crf: &payload.crf,
                }),
            });

            let (success, stderr_lines) =
                run_sidecar_command(&app, &state, "ffmpeg", ffmpeg_args).await?;
            file_success = success;

            // If the copy failed due to a subtitle codec incompatible with the container,
            // retry automatically with ASS conversion. No codec list needed — FFmpeg tells us.
            if !file_success && stderr_indicates_subtitle_incompatibility(&stderr_lines) {
                reencode_subtitle_retry_attempts += 1;
                append_log(
                    &app,
                    "  | [ERROR] ⚠️ Subtitle codec incompatible with container. Retrying with ASS conversion...",
                );

                if output_file_path.exists() {
                    let _ = std::fs::remove_file(&output_file_path);
                }

                let retry_args = build_ffmpeg_args(&FfmpegJobConfig {
                    input: file_path,
                    output: &output_file_path,
                    subtitle_maps: &subtitle_maps,
                    mode: ConversionMode::Reencode,
                    subtitle_codec: SubtitleCodec::Ass,
                    reencode: Some(ReencodeConfig {
                        video_codec: &payload.video_codec,
                        preset: &payload.preset,
                        crf: &payload.crf,
                    }),
                });

                let (retry_success, _) =
                    run_sidecar_command(&app, &state, "ffmpeg", retry_args).await?;
                file_success = retry_success;

                if file_success {
                    reencode_subtitle_retry_successes += 1;
                } else {
                    append_log(
                        &app,
                        "  | [ERROR] ⚠️ ASS conversion retry also failed. Subtitle codec may be undecodable (e.g. WebVTT/none). File marked as failed.",
                    );
                }
            }
        } else {
            // Remux protocol
            append_log(
                &app,
                "  | [INFO] Initializing primary stream copy protocol (FFmpeg)...",
            );

            // First attempt: try copying subtitles as-is
            let ffmpeg_copy_args = build_ffmpeg_args(&FfmpegJobConfig {
                input: file_path,
                output: &output_file_path,
                subtitle_maps: &subtitle_maps,
                mode: ConversionMode::Remux,
                subtitle_codec: SubtitleCodec::Copy,
                reencode: None,
            });

            let (success, stderr_lines) =
                run_sidecar_command(&app, &state, "ffmpeg", ffmpeg_copy_args).await?;
            file_success = success;

            // Same subtitle incompatibility retry as reencode path
            if !file_success && stderr_indicates_subtitle_incompatibility(&stderr_lines) {
                append_log(
                    &app,
                    "  | [ERROR] ⚠️ Subtitle codec incompatible with container. Retrying with ASS conversion...",
                );

                if output_file_path.exists() {
                    let _ = std::fs::remove_file(&output_file_path);
                }

                let retry_copy_args = build_ffmpeg_args(&FfmpegJobConfig {
                    input: file_path,
                    output: &output_file_path,
                    subtitle_maps: &subtitle_maps,
                    mode: ConversionMode::Remux,
                    subtitle_codec: SubtitleCodec::Ass,
                    reencode: None,
                });

                let (retry_success, retry_stderr) =
                    run_sidecar_command(&app, &state, "ffmpeg", retry_copy_args).await?;
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
                append_log(
                    &app,
                    "  | [ERROR] ⚠️ FFmpeg stream copy failed. Initiating fallback to MKVMerge...",
                );

                if output_file_path.exists() {
                    let _ = std::fs::remove_file(&output_file_path);
                }

                let mut mkvmerge_args = vec![
                    "-o".to_string(),
                    output_file_path.to_string_lossy().into_owned(),
                ];

                // Append MKVMerge specific subtitle tracking rules
                if !sub_langs.is_empty() {
                    mkvmerge_args.push("--subtitle-tracks".to_string());
                    mkvmerge_args.push(sub_langs.join(","));
                } else {
                    // Drop all subtitles if array is blank
                    mkvmerge_args.push("--no-subtitles".to_string());
                }

                // Clear the title metadata, matching the Python script's mkvmerge command:
                // `--title ""`
                mkvmerge_args.push("--title".to_string());
                mkvmerge_args.push(String::new());

                mkvmerge_args.push(file_path.to_string_lossy().into_owned());

                let (mkvmerge_success, _) =
                    run_sidecar_command(&app, &state, "mkvmerge", mkvmerge_args).await?;
                file_success = mkvmerge_success;
            }
        }

        // Tally results and sizes
        if file_success {
            successful_files += 1;
            // Get original size
            if let Ok(metadata) = std::fs::metadata(file_path) {
                total_original_bytes += metadata.len();
            }
            // Get output size
            if let Ok(metadata) = std::fs::metadata(&output_file_path) {
                total_output_bytes += metadata.len();
            }
            {
                let mut session = state.process.lock().await;
                if let Some(pos) = session.output_files.iter().position(|p| p == &output_file_path) {
                    let path = session.output_files.remove(pos);
                    session.completed_files.push(path);
                }
            }
        } else {
            failed_files += 1;
        }
    }

    {
        let mut session = state.process.lock().await;
        session.output_path = None;
    }

    let _ = app.emit(
        "process-progress",
        serde_json::json!({
            "progress": 100,
            "current_index": total_files,
            "total_files": total_files
        }),
    );

    // Explicitly output the total ffmpeg stream copy failures to the Real-time Log ONLY if failures exist
    if payload.conversion_mode != ConversionMode::Reencode && ffmpeg_fallback_failures > 0 {
        append_log(
            &app,
            format!(
                "📊 Session Metrics -> Primary FFmpeg Stream Copy Failures resolved via fallback: {}",
                ffmpeg_fallback_failures
            ),
        );
    }

    if payload.conversion_mode == ConversionMode::Reencode && reencode_subtitle_retry_attempts > 0 {
        let reencode_subtitle_retry_failures =
            reencode_subtitle_retry_attempts - reencode_subtitle_retry_successes;
        append_log(
            &app,
            format!(
                "📊 Session Metrics -> Reencode Subtitle Codec Retries: {} triggered, {} resolved via ASS conversion, {} still failed.",
                reencode_subtitle_retry_attempts,
                reencode_subtitle_retry_successes,
                reencode_subtitle_retry_failures,
            ),
        );
    }

    let final_summary = if failed_files == 0 {
        format!(
            "✅ Success! All {} active queue pipelines executed to completion.",
            successful_files
        )
    } else {
        format!(
            "⚠️ Execution Finished: {} Succeeded, {} Failed.",
            successful_files, failed_files
        )
    };

    flush_log_writer(&app);
    Ok(PipelineSummary {
        message: final_summary,
        original_size_bytes: total_original_bytes,
        output_size_bytes: total_output_bytes,
    })
}

#[tauri::command]
pub async fn get_sidecar_version(app: AppHandle, binary_name: String) -> Result<String, AppError> {
    let shell = app.shell();
    let args = if binary_name == "mkvmerge" {
        vec!["--version".to_string()]
    } else {
        vec!["-version".to_string()]
    };

    let cmd = shell
        .sidecar(&binary_name)
        .map_err(|e| AppError::Sidecar(format!("Failed to initialize sidecar configuration: {e}")))?
        .args(args);

    let output = cmd
        .output()
        .await
        .map_err(|e| AppError::Sidecar(format!("Binary execution error: {e}")))?;

    if output.status.success() {
        let stdout_str = String::from_utf8_lossy(&output.stdout);
        if let Some(first_line) = stdout_str.lines().next() {
            return Ok(first_line.to_string());
        }
        Ok(stdout_str.into_owned())
    } else {
        let stderr_str = String::from_utf8_lossy(&output.stderr);
        Err(AppError::Sidecar(format!(
            "Sidecar diagnostic failure: {}",
            stderr_str
        )))
    }
}

#[tauri::command]
pub async fn get_encoder_capabilities(app: AppHandle) -> crate::models::EncoderCapabilities {
    let state = app.state::<AppState>();
    if let Some(caps) = state.encoder_caps.get() {
        return caps.clone();
    }

    let mut caps = crate::models::EncoderCapabilities {
        nvenc: false,
        amf: false,
        qsv: false,
        videotoolbox: false,
    };

    let shell = app.shell();
    if let Ok(cmd) = shell.sidecar("ffmpeg")
        && let Ok(output) = cmd.args(["-encoders"]).output().await
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        
        let has_nvenc = stdout.contains("_nvenc");
        let has_amf = stdout.contains("_amf");
        let has_qsv = stdout.contains("_qsv");
        let has_videotoolbox = stdout.contains("_videotoolbox");

        let test_codec = |app: AppHandle, codec: &'static str| async move {
            if let Ok(test_cmd) = app.shell().sidecar("ffmpeg")
                && let Ok(test_out) = test_cmd
                    .args([
                        "-f", "lavfi",
                        "-i", "nullsrc=s=256x256:d=0.1",
                        "-c:v", codec,
                        "-f", "null",
                        "-"
                    ])
                    .output()
                    .await
            {
                return test_out.status.success();
            }
            false
        };

        let (nvenc, amf, qsv, videotoolbox) = tokio::join!(
            async { if has_nvenc { test_codec(app.clone(), "hevc_nvenc").await } else { false } },
            async { if has_amf { test_codec(app.clone(), "hevc_amf").await } else { false } },
            async { if has_qsv { test_codec(app.clone(), "hevc_qsv").await } else { false } },
            async { if has_videotoolbox { test_codec(app.clone(), "hevc_videotoolbox").await } else { false } }
        );

        caps.nvenc = nvenc;
        caps.amf = amf;
        caps.qsv = qsv;
        caps.videotoolbox = videotoolbox;
    }
    
    let _ = state.encoder_caps.set(caps.clone());
    caps
}

/// Retries file deletion with backoff to handle Windows process exit delays
/// where killed child processes may still hold file locks briefly.
async fn retry_remove_file(path: &std::path::Path) -> std::io::Result<()> {
    let mut last_err = std::io::Error::other("no attempts made");
    for attempt in 0..8u32 {
        match std::fs::remove_file(path) {
            Ok(_) => return Ok(()),
            Err(e) => {
                last_err = e;
                if attempt < 7 {
                    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                }
            }
        }
    }
    Err(last_err)
}

#[tauri::command]
pub async fn abort_video_pipeline(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    state.is_aborted.store(true, Ordering::SeqCst);

    let (opt_child, target_cleanup_path, files_to_delete, dirs_to_check) = {
        let mut session = state.process.lock().await;

        session.cancel.cancel(); // Trigger CancellationToken

        let child = session.child.take();
        let path = session.output_path.take();
        let files = session.output_files.clone();
        let dirs = session.output_dirs.clone();

        session.output_files.clear();
        // Do NOT clear completed_files here, they should be preserved!
        session.output_dirs.clear();

        (child, path, files, dirs)
    };

    if let Some(child) = opt_child {
        let _ = child.kill();
        // Removed sleep hack since cancellation token provides cooperative shutdown
    }

    // Use retry logic for all file deletions to handle Windows file locking
    // where killed processes may briefly retain write locks on output files.
    if let Some(path) = target_cleanup_path
        && path.exists()
    {
        let _ = retry_remove_file(&path).await;
    }

    for file in files_to_delete {
        if file.exists() {
            match retry_remove_file(&file).await {
                Ok(_) => {
                    append_log(
                        &app,
                        format!(
                            "Cleaned up session file safely: \"{}\"",
                            file.to_string_lossy()
                        ),
                    );
                }
                Err(e) => {
                    append_log(
                        &app,
                        format!("❌ Failed to delete rollback file {:?}: {}", file, e),
                    );
                }
            }
        }
    }

    for dir in dirs_to_check {
        if dir.exists()
            && dir.is_dir()
            && let Ok(mut entries) = fs::read_dir(&dir)
            && entries.next().is_none()
        {
            if let Err(e) = fs::remove_dir(&dir) {
                append_log(
                    &app,
                    format!("❌ Failed to remove empty processed_files directory: {}", e),
                );
            } else {
                append_log(
                    &app,
                    format!(
                        "Cleaned up empty workspace folder safely: \"{}\"",
                        dir.to_string_lossy()
                    ),
                );
            }
        }
    }

    flush_log_writer(&app);
    Ok(())
}

#[tauri::command]
pub fn save_log_file(app: AppHandle, path: String) -> Result<(), AppError> {
    flush_log_writer(&app);
    if let Ok(log_dir) = app.path().app_log_dir() {
        let mut target_file = std::fs::File::create(&path)
            .map_err(|e| AppError::Process(format!("Failed to create target file: {}", e)))?;
        
        let mut any_saved = false;
        for file_name in ["session.2.log", "session.1.log", "session.log"] {
            let log_file = log_dir.join(file_name);
            if log_file.exists()
                && let Ok(mut src) = std::fs::File::open(&log_file)
                && std::io::copy(&mut src, &mut target_file).is_ok()
            {
                any_saved = true;
            }
        }
        if any_saved {
            return Ok(());
        }
    }
    Err(AppError::Process(
        "No active session log found to save.".to_string(),
    ))
}

#[tauri::command]
pub fn read_session_log(app: AppHandle) -> Result<String, AppError> {
    flush_log_writer(&app);
    let mut content = String::new();
    if let Ok(log_dir) = app.path().app_log_dir() {
        for file_name in ["session.2.log", "session.1.log", "session.log"] {
            let log_file = log_dir.join(file_name);
            if log_file.exists()
                && let Ok(text) = std::fs::read_to_string(&log_file)
            {
                content.push_str(&text);
            }
        }
    }
    Ok(content)
}

#[tauri::command]
pub fn initialize_session_log(app: AppHandle) -> Result<(), AppError> {
    if let Ok(log_dir) = app.path().app_log_dir() {
        if !log_dir.exists() {
            let _ = std::fs::create_dir_all(&log_dir);
        }
        let log_file = log_dir.join("session.log");

        // Release the file lock from the previous session before truncating
        let state = app.state::<AppState>();
        if let Ok(mut guard) = state.log_writer.lock() {
            *guard = None;
        }

        let file = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(log_file)
            .map_err(|e| AppError::Process(format!("Failed to initialize session log: {}", e)))?;

        if let Ok(mut guard) = state.log_writer.lock() {
            *guard = Some(crate::models::SessionLog {
                writer: std::io::BufWriter::new(file),
                bytes_written: 0,
            });
        };
    }
    Ok(())
}

#[tauri::command]
pub fn log_message(app: AppHandle, message: String) {
    crate::process::append_log(&app, message);
    flush_log_writer(&app);
}

#[tauri::command]
pub fn check_session_log(app: AppHandle) -> Result<bool, AppError> {
    flush_log_writer(&app);
    if let Ok(log_dir) = app.path().app_log_dir() {
        let log_file = log_dir.join("session.log");
        if let Ok(metadata) = std::fs::metadata(&log_file) {
            return Ok(metadata.is_file() && metadata.len() > 0);
        }
    }
    Ok(false)
}

#[tauri::command]
pub fn open_folder(app: AppHandle, path: String) -> Result<(), AppError> {
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| AppError::Process(format!("Failed to open folder: {}", e)))?;
    Ok(())
}
