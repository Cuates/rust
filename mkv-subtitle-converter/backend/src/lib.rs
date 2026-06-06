use chrono::Local;
use indexmap::IndexMap;
use serde::Serialize;
use serde_json::json;
use std::fs::{self, File};
use std::io::{self, BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use tauri::ipc::Channel;
use tauri::Manager;
use tauri::State;

// Import the correct Tauri Shell Extensions for Sidecars
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

// -----------------------------------------------------------------------------
// Data Structs & Layout Specifications
// -----------------------------------------------------------------------------

pub struct AppCancellationState {
    pub is_cancelled: Arc<AtomicBool>,
}

pub struct ActivePathsState {
    pub paths: Arc<Mutex<Vec<String>>>,
}

#[derive(Clone, Serialize)]
pub struct ProgressPayload {
    pub event: String,
    pub data: serde_json::Value,
}

#[derive(serde::Serialize)]
pub struct FolderReportStatus {
    #[serde(rename = "hasSuccess")]
    pub has_success: bool,
    #[serde(rename = "hasFailure")]
    pub has_failure: bool,
}

#[derive(Serialize, Debug)]
struct SubtitleMetadata {
    file: String,
    language: String,
    #[serde(rename = "track_name")]
    track_name: String,
    codec: String,
}

// -----------------------------------------------------------------------------
// Pure-Rust Subtitle Transcoding Engines (Old subtitle_convrs Logic)
// -----------------------------------------------------------------------------

fn convert_srt_to_ass(input_path: &Path, output_path: &Path) -> io::Result<()> {
    let file = File::open(input_path)?;
    let reader = BufReader::new(file);

    let mut ass_file = File::create(output_path)?;

    writeln!(ass_file, "[Script Info]")?;
    writeln!(ass_file, "ScriptType: v4.00+")?;
    writeln!(ass_file, "WrapStyle: 0")?;
    writeln!(ass_file, "ScaledBorderAndShadow: yes")?;
    writeln!(ass_file)?;
    writeln!(ass_file, "[V4+ Styles]")?;
    writeln!(ass_file, "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding")?;
    writeln!(
        ass_file,
        "Style: CustomTrebuchet,Trebuchet MS,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1.0,1.0,2,10,10,10,1"
    )?;
    writeln!(ass_file)?;
    writeln!(ass_file, "[Events]")?;
    writeln!(
        ass_file,
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    )?;

    let mut lines = reader.lines().map_while(Result::ok).peekable();
    while let Some(line) = lines.next() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if trimmed.parse::<u32>().is_ok() {
            if let Some(time_line) = lines.next() {
                if time_line.contains("-->") {
                    let parts: Vec<&str> = time_line.split("-->").collect();
                    if parts.len() == 2 {
                        let start = parts[0].trim().replace(',', ".");
                        let end = parts[1].trim().replace(',', ".");

                        let clean_start = format_srt_time_to_ass(&start);
                        let clean_end = format_srt_time_to_ass(&end);

                        let mut text = String::new();
                        while let Some(next_line) = lines.peek() {
                            if next_line.trim().is_empty()
                                || next_line.trim().parse::<u32>().is_ok()
                            {
                                break;
                            }
                            if let Some(actual_line) = lines.next() {
                                if !text.is_empty() {
                                    text.push_str("\\N");
                                }
                                text.push_str(&actual_line);
                            }
                        }
                        writeln!(
                            ass_file,
                            "Dialogue: 0,{},{},CustomTrebuchet,,0,0,0,,{}",
                            clean_start, clean_end, text
                        )?;
                    }
                }
            }
        }
    }

    Ok(())
}

fn format_srt_time_to_ass(srt_time: &str) -> String {
    if srt_time.len() >= 11 {
        let clean_hours = srt_time[1..8].to_string();
        let ms = &srt_time[9..11];
        format!("{}{}", clean_hours, ms)
    } else {
        srt_time.to_string()
    }
}

// -----------------------------------------------------------------------------
// Housekeeping Routines
// -----------------------------------------------------------------------------

fn purge_all_generated_assets(folder_path: &str) {
    let dir = Path::new(folder_path);
    if !dir.is_dir() {
        return;
    }

    let _ = fs::remove_file(dir.join("converted_files.json"));
    let _ = fs::remove_file(dir.join("failed_files.json"));

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let filename_str = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                if filename_str.ends_with(".srt")
                    || filename_str.contains("_extracted.srt")
                    || filename_str.ends_with(".ass")
                {
                    let _ = fs::remove_file(path);
                }
            }
        }
    }
}

// -----------------------------------------------------------------------------
// Tauri Interactive Command Sets
// -----------------------------------------------------------------------------

#[tauri::command]
async fn process_mkv_directory(
    app_handle: tauri::AppHandle,
    paths: Vec<String>,
    on_progress: Channel<ProgressPayload>,
    state: State<'_, AppCancellationState>,
    paths_state: State<'_, ActivePathsState>,
) -> Result<(), String> {
    state.is_cancelled.store(false, Ordering::SeqCst);
    let cancel_token = state.is_cancelled.clone();
    let paths_clone = paths.clone();

    if let Ok(mut active_paths) = paths_state.paths.lock() {
        *active_paths = paths.clone();
    }

    let paths_state_clone = paths_state.paths.clone();

    tokio::spawn(async move {
        let start_instant = std::time::Instant::now();

        // ─── PART 0: DISCOVER BINARY VERSIONS AND LOG TO TERMINAL UI ───
        let mut ffmpeg_version = "Unknown Version".to_string();
        let mut ffprobe_version = "Unknown Version".to_string();

        // Query FFmpeg Version
        if let Ok(sidecar_ffmpeg) = app_handle.shell().sidecar("ffmpeg") {
            if let Ok(output) = sidecar_ffmpeg.arg("-version").output().await {
                if let Ok(stdout_str) = std::str::from_utf8(&output.stdout) {
                    if let Some(first_line) = stdout_str.lines().next() {
                        ffmpeg_version = first_line.to_string();
                    }
                }
            }
        }

        // Query FFprobe Version
        if let Ok(sidecar_ffprobe) = app_handle.shell().sidecar("ffprobe") {
            if let Ok(output) = sidecar_ffprobe.arg("-version").output().await {
                if let Ok(stdout_str) = std::str::from_utf8(&output.stdout) {
                    if let Some(first_line) = stdout_str.lines().next() {
                        ffprobe_version = first_line.to_string();
                    }
                }
            }
        }

        // Send version information directly to the UI Console
        let _ = on_progress.send(ProgressPayload {
            event: "LogMessage".to_string(),
            data: json!(format!("🚀 Initializing Core Engine Components...")),
        });
        let _ = on_progress.send(ProgressPayload {
            event: "LogMessage".to_string(),
            data: json!(format!("📦 Sidecar FFmpeg: {}", ffmpeg_version)),
        });
        let _ = on_progress.send(ProgressPayload {
            event: "LogMessage".to_string(),
            data: json!(format!("📦 Sidecar FFprobe: {}", ffprobe_version)),
        });

        // ─── CONTINUING MAIN FOLDER WORK MATRIX ───
        let mut all_files = Vec::new();
        let mut session_temporary_srts = Vec::new();

        for path_str in &paths_clone {
            if let Ok(entries) = fs::read_dir(Path::new(path_str)) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("mkv") {
                        all_files.push((path, path_str.clone()));
                    }
                }
            }
        }

        let total_count = all_files.len();
        let _ = on_progress.send(ProgressPayload {
            event: "StartedScanned".to_string(),
            data: json!(total_count),
        });

        let mut files_processed = 0;
        let mut total_tracks_converted = 0;
        let mut tracking_loop_aborted = false;

        let re = regex::Regex::new(r"(\d+)").unwrap();

        'folder_loop: for folder_path in &paths_clone {
            let root_path = Path::new(folder_path);
            let mut local_conv_list: Vec<SubtitleMetadata> = Vec::new();
            let mut local_fail_list = Vec::new();

            let folder_files: Vec<_> = all_files
                .iter()
                .filter(|(_, parent)| parent == folder_path)
                .map(|(p, _)| p.clone())
                .collect();

            for file_path in folder_files {
                if cancel_token.load(Ordering::SeqCst) {
                    tracking_loop_aborted = true;
                    break 'folder_loop;
                }

                files_processed += 1;

                let file_stem = file_path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("video");
                let file_name_with_ext = file_path
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("video.mkv");
                let output_dir = file_path.parent().unwrap_or_else(|| Path::new("."));

                let mut subtitle_streams = Vec::new();

                // ─── PART 1: USING THE FFPROBE SIDECAR ───
                let probe_file_arg = file_path.to_string_lossy().to_string();
                if let Ok(sidecar_probe) = app_handle.shell().sidecar("ffprobe") {
                    let output = sidecar_probe
                        .args([
                            "-v", "error",
                            "-select_streams", "s",
                            "-show_entries", "stream=index,codec_name:stream_tags=language,title:disposition=default,forced",
                            "-of", "json",
                            &probe_file_arg
                        ])
                        .output()
                        .await;

                    if let Ok(probe_output) = output {
                        if let Ok(parsed_json) =
                            serde_json::from_slice::<serde_json::Value>(&probe_output.stdout)
                        {
                            if let Some(streams_array) = parsed_json["streams"].as_array() {
                                for stream in streams_array {
                                    if let Some(idx) = stream["index"].as_u64() {
                                        let codec = stream["codec_name"]
                                            .as_str()
                                            .unwrap_or("subrip")
                                            .to_string();
                                        let mut lang = stream["tags"]["language"]
                                            .as_str()
                                            .unwrap_or("und")
                                            .to_string();
                                        if lang.trim().is_empty() {
                                            lang = "und".to_string();
                                        }
                                        let title = stream["tags"]["title"]
                                            .as_str()
                                            .unwrap_or("")
                                            .to_string();
                                        let default_flag =
                                            stream["disposition"]["default"].as_i64().unwrap_or(0);
                                        let forced_flag =
                                            stream["disposition"]["forced"].as_i64().unwrap_or(0);

                                        subtitle_streams.push((
                                            idx as u32,
                                            codec,
                                            lang,
                                            title,
                                            default_flag,
                                            forced_flag,
                                        ));
                                    }
                                }
                            }
                        }
                    }
                }

                let supported_codecs = ["subrip"];
                let valid_tracks: Vec<_> = subtitle_streams
                    .iter()
                    .filter(|(_, codec, _, _, _, _)| supported_codecs.contains(&codec.as_str()))
                    .cloned()
                    .collect();

                for (stream_index, detected_codec, _, _, _, _) in &subtitle_streams {
                    if !supported_codecs.contains(&detected_codec.as_str()) {
                        let _ = on_progress.send(ProgressPayload {
                            event: "LogMessage".to_string(),
                            data: json!(format!(
                                "ℹ Skipping unsupported stream {} [codec: {}] inside {}",
                                stream_index, detected_codec, file_name_with_ext
                            )),
                        });
                    }
                }

                if valid_tracks.is_empty() {
                    if subtitle_streams.is_empty() {
                        let _ = on_progress.send(ProgressPayload {
                            event: "LogMessage".to_string(),
                            data: json!(format!(
                                "ℹ No internal subtitle tracks discovered inside {}",
                                file_name_with_ext
                            )),
                        });
                    }

                    let _ = on_progress.send(ProgressPayload {
                        event: "FileProcessed".to_string(),
                        data: json!({ "processed": files_processed, "converted": total_tracks_converted }),
                    });
                    continue;
                }

                for (stream_index, detected_codec, language, title, default_flag, forced_flag) in
                    valid_tracks
                {
                    if cancel_token.load(Ordering::SeqCst) {
                        tracking_loop_aborted = true;
                        break 'folder_loop;
                    }

                    let sanitized_title = if title.trim().is_empty() {
                        "unnamed".to_string()
                    } else {
                        title
                            .replace(|c: char| !c.is_alphanumeric() && c != '_', "_")
                            .replace(" ", "_")
                    };

                    let base_formatted_string = format!(
                        "{}_track{}_{}_default{}_forced{}",
                        file_stem, stream_index, sanitized_title, default_flag, forced_flag
                    );

                    let srt_filename = format!("{}_extracted.srt", base_formatted_string);
                    let tmp_srt_path = output_dir.join(&srt_filename);

                    let ass_filename = format!("{}.{}.ass", base_formatted_string, language);
                    let final_ass_path = output_dir.join(&ass_filename);

                    let created_tracks_paths = vec![tmp_srt_path.clone(), final_ass_path.clone()];
                    session_temporary_srts.push(tmp_srt_path.clone());

                    // ─── PART 2: USING THE FFMPEG SIDECAR WITH ASYNC EVENT SPAWN ───
                    let input_mkv_arg = file_path.to_string_lossy().to_string();
                    let output_srt_arg = tmp_srt_path.to_string_lossy().to_string();
                    let map_track_arg = format!("0:{}", stream_index);

                    let mut operation_success = false;

                    if let Ok(sidecar_ffmpeg) = app_handle.shell().sidecar("ffmpeg") {
                        if let Ok((mut rx, _child)) = sidecar_ffmpeg
                            .args([
                                "-y",
                                "-i",
                                &input_mkv_arg,
                                "-map",
                                &map_track_arg,
                                &output_srt_arg,
                            ])
                            .spawn()
                        {
                            while let Some(event) = rx.recv().await {
                                if cancel_token.load(Ordering::SeqCst) {
                                    tracking_loop_aborted = true;
                                    break;
                                }
                                if let CommandEvent::Terminated(payload) = event {
                                    if payload.code == Some(0) {
                                        operation_success = true;
                                    }
                                    break;
                                }
                            }
                        }
                    }

                    if tracking_loop_aborted {
                        for path in &created_tracks_paths {
                            if path.exists() {
                                let _ = fs::remove_file(path);
                            }
                        }
                        break 'folder_loop;
                    }

                    if operation_success && !cancel_token.load(Ordering::SeqCst) {
                        if convert_srt_to_ass(&tmp_srt_path, &final_ass_path).is_ok() {
                            total_tracks_converted += 1;
                            local_conv_list.push(SubtitleMetadata {
                                file: ass_filename.clone(),
                                language: language.clone(),
                                track_name: if title.is_empty() {
                                    format!("Track Index {}", stream_index)
                                } else {
                                    title.clone()
                                },
                                codec: detected_codec.clone(),
                            });

                            let _ = on_progress.send(ProgressPayload {
                                event: "LogMessage".to_string(),
                                data: json!(format!(
                                    "✓ Extracted SRT: stream {} [lang: {}] -> {}",
                                    stream_index, language, ass_filename
                                )),
                            });

                            let _ = on_progress.send(ProgressPayload {
                                event: "FileProcessed".to_string(),
                                data: json!({ "processed": files_processed, "converted": total_tracks_converted }),
                            });
                        } else {
                            local_fail_list.push(format!(
                                "Conversion failed on stream {}: {}",
                                stream_index, file_name_with_ext
                            ));
                        }
                    } else if !cancel_token.load(Ordering::SeqCst) {
                        local_fail_list.push(format!(
                            "FFmpeg sidecar extraction skipped stream {}: {}",
                            stream_index, file_name_with_ext
                        ));
                    }

                    if tmp_srt_path.exists() {
                        let _ = fs::remove_file(&tmp_srt_path);
                    }
                }
            }

            if !local_conv_list.is_empty() {
                local_conv_list.sort_by(|a, b| {
                    let a_parts = re.split(&a.file).collect::<Vec<_>>();
                    let b_parts = re.split(&b.file).collect::<Vec<_>>();
                    a_parts.cmp(&b_parts)
                });

                let mut report = IndexMap::new();
                report.insert("target_folder", json!(folder_path));
                report.insert(
                    "timestamp",
                    json!(Local::now().format("%Y-%m-%d %H:%M:%S").to_string()),
                );
                report.insert("files", json!(local_conv_list));

                let report_path = root_path.join("converted_files.json");
                let _ = fs::write(
                    report_path,
                    serde_json::to_string_pretty(&report).unwrap_or_default(),
                );
            }

            if !local_fail_list.is_empty() {
                local_fail_list.sort();
                let mut report = IndexMap::new();
                report.insert("target_folder", json!(folder_path));
                report.insert(
                    "timestamp",
                    json!(Local::now().format("%Y-%m-%d %H:%M:%S").to_string()),
                );
                report.insert("failed_files", json!(local_fail_list));

                let report_path = root_path.join("failed_files.json");
                let _ = fs::write(
                    report_path,
                    serde_json::to_string_pretty(&report).unwrap_or_default(),
                );
            }
        }

        if cancel_token.load(Ordering::SeqCst) || tracking_loop_aborted {
            let _ = on_progress.send(ProgressPayload {
                event: "Cancelled".to_string(),
                data: json!("Interrupted."),
            });

            tokio::time::sleep(std::time::Duration::from_millis(350)).await;

            for srt_path in &session_temporary_srts {
                if srt_path.exists() {
                    let _ = fs::remove_file(srt_path);
                }
            }
            for path_str in &paths_clone {
                purge_all_generated_assets(path_str);
            }
        } else {
            let mut final_success_dir = "".to_string();
            let mut final_failure_dir = "".to_string();
            if let Some(first_path) = paths_clone.first() {
                if Path::new(first_path).join("converted_files.json").exists() {
                    final_success_dir = first_path.clone();
                }
                if Path::new(first_path).join("failed_files.json").exists() {
                    final_failure_dir = first_path.clone();
                }
            }

            let delta = start_instant.elapsed();
            let _ = on_progress.send(ProgressPayload {
                event: "Finished".to_string(),
                data: json!({
                    "success_file": final_success_dir,
                    "failure_file": final_failure_dir,
                    "seconds": delta.as_secs(),
                    "milliseconds": delta.subsec_millis()
                }),
            });
        }

        if let Ok(mut active_paths) = paths_state_clone.lock() {
            active_paths.clear();
        }
    });

    Ok(())
}

#[tauri::command]
fn abort_mkv_directory_processing(
    state: State<'_, AppCancellationState>,
    paths_state: State<'_, ActivePathsState>,
) {
    state.is_cancelled.store(true, Ordering::SeqCst);
    if let Ok(active_paths) = paths_state.paths.lock() {
        for path in active_paths.iter() {
            purge_all_generated_assets(path);
        }
    }
}

#[tauri::command]
fn show_item_in_folder(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!(
            "The target report item path does not exist: {}",
            path
        ));
    }

    #[cfg(target_os = "windows")]
    {
        let win_path = path_buf.to_string_lossy().replace("/", "\\");
        std::process::Command::new("explorer.exe")
            .arg(format!("/select,{}", win_path))
            .spawn()
            .map_err(|e| format!("Windows Explorer failed to initialize: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path_buf.to_string_lossy()])
            .status()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        if let Some(parent) = path_buf.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent.to_string_lossy().as_ref())
                .status()
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn check_folder_reports(
    paths: Vec<String>,
) -> Result<std::collections::HashMap<String, FolderReportStatus>, String> {
    let mut results = std::collections::HashMap::new();
    for path_str in paths {
        let base_path = Path::new(&path_str);
        results.insert(
            path_str.clone(),
            FolderReportStatus {
                has_success: base_path.join("converted_files.json").exists(),
                has_failure: base_path.join("failed_files.json").exists(),
            },
        );
    }
    Ok(results)
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppCancellationState {
            is_cancelled: Arc::new(AtomicBool::new(false)),
        })
        .manage(ActivePathsState {
            paths: Arc::new(Mutex::new(Vec::new())),
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init()) // ← Added the Shell initialization plugin here
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();

                if let Some(state) = window.try_state::<AppCancellationState>() {
                    state.is_cancelled.store(true, Ordering::SeqCst);
                }

                std::thread::sleep(std::time::Duration::from_millis(350));

                if let Some(paths_state) = window.try_state::<ActivePathsState>() {
                    if let Ok(active_paths) = paths_state.paths.lock() {
                        for path in active_paths.iter() {
                            purge_all_generated_assets(path);
                        }
                    }
                }

                window.destroy().unwrap();
            }
        })
        .invoke_handler(tauri::generate_handler![
            process_mkv_directory,
            abort_mkv_directory_processing,
            show_item_in_folder,
            check_folder_reports
        ])
        .run(tauri::generate_context!())
        .expect("Failed to launch application");
}
