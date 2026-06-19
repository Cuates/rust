use indexmap::IndexMap;
use serde_json::json;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Semaphore;
use tokio::task::JoinSet;

use crate::constants::*;
use crate::error::AppError;
use crate::models::{
    AppState, DirectoryStats, FileStat, FolderReportStatus, ProgressPayload, SubtitleMetadata,
};
use crate::process::{append_log, discover_mkv_files, flush_log_writer, process_one_mkv_file};

// =============================================================================
// PRIMARY PROCESSING COMMAND
// =============================================================================

type FolderResultsMap = HashMap<String, (Vec<SubtitleMetadata>, Vec<String>)>;

#[tauri::command]
pub async fn process_mkv_directory<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    paths: Vec<String>,
    recursive: bool,
    concurrency: usize,
    on_progress: Channel<ProgressPayload>,
) -> Result<serde_json::Value, AppError> {
    // --- Reset session state ---
    let cancel_token = {
        let mut session = state.process.lock().await;
        session.cancel = tokio_util::sync::CancellationToken::new();
        session.active_paths = paths.clone();
        session.session_output_files.clear();
        session.children.clear();
        session.cancel.clone()
    };

    // --- Startup log messages ---
    append_log(
        &app,
        format!(
            "Session started at: {}",
            chrono::Local::now().format("%-m/%-d/%Y, %-I:%M:%S %p")
        ),
    );
    append_log(&app, "🚀 Initializing Core Engine Components...");

    for binary in &["ffmpeg", "ffprobe"] {
        match get_sidecar_version(app.clone(), binary.to_string()).await {
            Ok(ver) => append_log(&app, format!("📦 Sidecar {}: {}", binary, ver)),
            Err(_) => append_log(&app, format!("📦 Sidecar {}: Unknown", binary)),
        }
    }

    // --- Discover MKV files ---
    let all_files = discover_mkv_files(&paths, recursive);
    let total_count = all_files.len();

    let mut folder_counts = HashMap::new();
    for (_, folder_path) in &all_files {
        *folder_counts.entry(folder_path.clone()).or_insert(0) += 1;
    }

    let _ = on_progress.send(ProgressPayload {
        event: "StartedScanned".into(),
        data: json!({
            "total_count": total_count,
            "folder_counts": folder_counts
        }),
    });
    append_log(
        &app,
        format!(
            "Analysis complete: Found {} MKV file(s) across {} folder(s).",
            total_count,
            paths.len()
        ),
    );

    if total_count == 0 {
        let empty_payload = json!({
            "success_file": "",
            "failure_file": "",
            "seconds": 0u64,
            "milliseconds": 0u32,
            "folder_statuses": {}
        });

        let _ = on_progress.send(ProgressPayload {
            event: "Finished".into(),
            data: empty_payload.clone(),
        });
        return Ok(empty_payload);
    }

    if total_count > 300 {
        let _ = app.emit(EVENT_LARGE_BATCH_WARNING, total_count);
    }

    // --- Shared counters ---
    let files_processed = Arc::new(AtomicUsize::new(0));
    let tracks_converted = Arc::new(AtomicUsize::new(0));
    let files_success = Arc::new(AtomicUsize::new(0));
    let files_failed = Arc::new(AtomicUsize::new(0));
    let files_skipped = Arc::new(AtomicUsize::new(0));

    // --- Per-folder result accumulator: folder_path → (successes, failures) ---
    let results: Arc<tokio::sync::Mutex<FolderResultsMap>> =
        Arc::new(tokio::sync::Mutex::new(HashMap::new()));
    {
        let mut r = results.lock().await;
        for path in &paths {
            r.insert(path.clone(), (Vec::new(), Vec::new()));
        }
    }

    let start_instant = std::time::Instant::now();

    // --- Concurrent processing via JoinSet + Semaphore (Per Folder) ---
    let actual_concurrency = if concurrency > 0 { concurrency } else { 1 };
    let sem = Arc::new(Semaphore::new(actual_concurrency));
    let mut join_set: JoinSet<String> = JoinSet::new();

    for path_str in &paths {
        for (file_path, folder_path) in all_files.iter().filter(|(_, f)| f == path_str) {
            if cancel_token.is_cancelled() {
                break;
            }

            let permit = match sem.clone().acquire_owned().await {
                Ok(p) => p,
                Err(_) => break,
            };

            let _ = on_progress.send(ProgressPayload {
                event: "FolderStatusUpdate".into(),
                data: json!({
                    "folder": folder_path,
                    "status": "processing"
                }),
            });

            let app_clone = app.clone();
            let cancel_clone = cancel_token.clone();
            let on_progress_clone = on_progress.clone();
            let results_clone = results.clone();
            let fp_clone = files_processed.clone();
            let tc_clone = tracks_converted.clone();
            let fs_clone = files_success.clone();
            let ff_clone = files_failed.clone();
            let fsk_clone = files_skipped.clone();
            let folder_owned = folder_path.clone();
            let file_owned = file_path.clone();

            join_set.spawn(async move {
                let _permit = permit; // Released when this task completes.

                if cancel_clone.is_cancelled() {
                    return folder_owned;
                }

                match process_one_mkv_file(
                    &app_clone,
                    &file_owned,
                    &folder_owned,
                    &cancel_clone,
                    &on_progress_clone,
                    &fp_clone,
                    &tc_clone,
                )
                .await
                {
                    Ok((convs, fails)) => {
                        if convs.is_empty() && fails.is_empty() {
                            fsk_clone.fetch_add(1, Ordering::Relaxed);
                        } else if convs.is_empty() && !fails.is_empty() {
                            ff_clone.fetch_add(1, Ordering::Relaxed);
                        } else {
                            fs_clone.fetch_add(1, Ordering::Relaxed);
                        }

                        let mut r = results_clone.lock().await;
                        if let Some(entry) = r.get_mut(&folder_owned) {
                            entry.0.extend(convs);
                            entry.1.extend(fails);
                        }
                    }
                    Err(AppError::Aborted) => {} // Expected on cancel.
                    Err(e) => {
                        ff_clone.fetch_add(1, Ordering::Relaxed);
                        append_log(
                            &app_clone,
                            format!("  | [ERROR] Unexpected file error: {}", e),
                        );
                    }
                }
                folder_owned
            });
        }
    }

    let mut completed_per_folder = HashMap::new();
    let mut any_success_dir = String::new();
    let mut any_failure_dir = String::new();
    let mut folder_statuses = IndexMap::new();

    // Handle folders with 0 files immediately
    for path_str in &paths {
        if folder_counts.get(path_str).unwrap_or(&0) == &0 {
            folder_statuses.insert(path_str.clone(), "skipped");
            let _ = on_progress.send(ProgressPayload {
                event: "FolderStatusUpdate".into(),
                data: json!({
                    "folder": path_str,
                    "status": "skipped"
                }),
            });
        }
    }

    static RE: std::sync::LazyLock<regex::Regex> =
        std::sync::LazyLock::new(|| regex::Regex::new(r"(\d+)").unwrap());

    while let Some(res) = join_set.join_next().await {
        if let Ok(folder_path) = res {
            let count = completed_per_folder.entry(folder_path.clone()).or_insert(0);
            *count += 1;

            if let Some(&total) = folder_counts.get(&folder_path)
                && *count == total
            {
                // Folder finished
                let mut status = "skipped";
                let root_path = Path::new(&folder_path);

                let mut conv_list = Vec::new();
                let mut fail_list = Vec::new();

                {
                    let results_map = results.lock().await;
                    if let Some((c, f)) = results_map.get(&folder_path) {
                        conv_list = c.clone();
                        fail_list = f.clone();
                    }
                }

                let success_count = conv_list.len();
                let fail_count = fail_list.len();

                if success_count > 0 && fail_count == 0 {
                    status = "done";
                } else if success_count == 0 && fail_count > 0 {
                    status = "error";
                } else if success_count > 0 && fail_count > 0 {
                    status = "warning";
                }

                if !conv_list.is_empty() {
                    conv_list.sort_by(|a, b| {
                        RE.split(&a.file)
                            .collect::<Vec<_>>()
                            .cmp(&RE.split(&b.file).collect::<Vec<_>>())
                    });

                    let mut report = IndexMap::new();
                    report.insert("target_folder", json!(folder_path));
                    report.insert(
                        "timestamp",
                        json!(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()),
                    );
                    report.insert("files", json!(conv_list));

                    let _ = std::fs::write(
                        root_path.join("converted_files.json"),
                        serde_json::to_string_pretty(&report).unwrap_or_default(),
                    );
                    if any_success_dir.is_empty() {
                        any_success_dir = folder_path.clone();
                    }
                }

                if !fail_list.is_empty() {
                    fail_list.sort();

                    let mut report = IndexMap::new();
                    report.insert("target_folder", json!(folder_path));
                    report.insert(
                        "timestamp",
                        json!(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()),
                    );
                    report.insert("failed_files", json!(fail_list));

                    let _ = std::fs::write(
                        root_path.join("failed_files.json"),
                        serde_json::to_string_pretty(&report).unwrap_or_default(),
                    );
                    if any_failure_dir.is_empty() {
                        any_failure_dir = folder_path.clone();
                    }
                }

                folder_statuses.insert(folder_path.clone(), status);

                let _ = on_progress.send(ProgressPayload {
                    event: "FolderStatusUpdate".into(),
                    data: json!({
                        "folder": folder_path,
                        "status": status
                    }),
                });
            }
        }
    }

    // --- Post-processing ---
    if cancel_token.is_cancelled() {
        // Clean up only files created during this session — no wildcard sweeps.
        {
            let mut session = state.process.lock().await;
            for path in session.session_output_files.drain(..) {
                if path.exists() {
                    let _ = std::fs::remove_file(&path);
                }
            }
            // Remove report files generated in this session.
            for path_str in &session.active_paths.clone() {
                let dir = Path::new(path_str);
                let _ = std::fs::remove_file(dir.join("converted_files.json"));
                let _ = std::fs::remove_file(dir.join("failed_files.json"));
            }
        }

        append_log(
            &app,
            "🛑 Processing aborted. Session files have been cleaned up.",
        );
        flush_log_writer(&app);

        let _ = on_progress.send(ProgressPayload {
            event: "Cancelled".into(),
            data: json!("Interrupted."),
        });
    } else {
        let delta = start_instant.elapsed();
        let results_map = results.lock().await;
        let total_tracks_success: usize = results_map.values().map(|(c, _)| c.len()).sum();
        let total_tracks_fails: usize = results_map.values().map(|(_, f)| f.len()).sum();

        let f_success = files_success.load(Ordering::Relaxed);
        let f_failed = files_failed.load(Ordering::Relaxed);
        let f_skipped = files_skipped.load(Ordering::Relaxed);

        let hours = delta.as_secs() / 3600;
        let minutes = (delta.as_secs() % 3600) / 60;
        let seconds = delta.as_secs() % 60;
        let millis = delta.subsec_millis();

        let mut time_parts = Vec::new();
        if hours > 0 {
            time_parts.push(format!("{}h", hours));
        }
        if minutes > 0 {
            time_parts.push(format!("{}m", minutes));
        }
        if seconds > 0 {
            time_parts.push(format!("{}s", seconds));
        }
        time_parts.push(format!("{}ms", millis));

        append_log(
            &app,
            format!(
                "Conversion Complete!\nFiles: {} Succeeded, {} Failed, {} Skipped.\nTracks: {} Converted, {} Failed.\nSession finished at: {}\nTotal Conversion Time: {}",
                f_success,
                f_failed,
                f_skipped,
                total_tracks_success,
                total_tracks_fails,
                chrono::Local::now().format("%-m/%-d/%Y, %-I:%M:%S %p"),
                time_parts.join(" ")
            ),
        );
        flush_log_writer(&app);

        let final_payload = json!({
            "success_file": any_success_dir,
            "failure_file": any_failure_dir,
            "seconds": delta.as_secs(),
            "milliseconds": delta.subsec_millis(),
            "folder_statuses": folder_statuses
        });

        let _ = on_progress.send(ProgressPayload {
            event: "Finished".into(),
            data: final_payload.clone(),
        });

        // Clear session tracking.
        {
            let mut session = state.process.lock().await;
            session.active_paths.clear();
        }

        return Ok(final_payload);
    }

    // Clear session tracking.
    {
        let mut session = state.process.lock().await;
        session.active_paths.clear();
    }

    Ok(json!(""))
}

// =============================================================================
// ABORT COMMAND
// =============================================================================

#[tauri::command]
pub async fn abort_mkv_directory_processing(state: tauri::State<'_, AppState>) -> Result<(), ()> {
    let mut session = state.process.lock().await;
    session.cancel.cancel();

    // Kill all running sidecar child processes immediately.
    for (_, child) in session.children.drain() {
        let _ = child.kill();
    }

    Ok(())
}

// =============================================================================
// FILE REVEAL COMMAND
// =============================================================================

#[tauri::command]
pub fn show_item_in_folder(path: String) -> Result<(), AppError> {
    let path_buf = std::path::PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(AppError::Process(format!(
            "The target path does not exist: {}",
            path
        )));
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let win_path = path_buf.to_string_lossy().replace('/', "\\");
        std::process::Command::new("explorer.exe")
            .raw_arg(format!("/select,\"{}\"", win_path))
            .spawn()
            .map_err(|e| AppError::Process(format!("Windows Explorer failed: {}", e)))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path_buf.to_string_lossy()])
            .spawn()
            .map_err(|e| AppError::Process(e.to_string()))?;
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        if let Some(parent) = path_buf.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent.to_string_lossy().as_ref())
                .spawn()
                .map_err(|e| AppError::Process(e.to_string()))?;
        }
    }

    Ok(())
}

// =============================================================================
// FOLDER REPORT STATUS
// =============================================================================

#[tauri::command]
pub fn check_folder_reports(
    paths: Vec<String>,
) -> Result<HashMap<String, FolderReportStatus>, AppError> {
    let mut results = HashMap::new();
    for path_str in paths {
        let base = Path::new(&path_str);
        results.insert(
            path_str.clone(),
            FolderReportStatus {
                has_success: base.join("converted_files.json").exists(),
                has_failure: base.join("failed_files.json").exists(),
            },
        );
    }
    Ok(results)
}

// =============================================================================
// DIRECTORY STATS
// =============================================================================

#[tauri::command]
pub async fn get_directory_stats(
    dir_path: String,
    recursive: bool,
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

        let mut walker = walkdir::WalkDir::new(path).follow_links(false);
        if !recursive {
            walker = walker.max_depth(1);
        }

        let mut file_count = 0usize;
        let mut total_size_bytes = 0u64;
        let mut files = Vec::new();

        for entry in walker.into_iter().flatten() {
            let p = entry.path();
            if p.is_file()
                && p.extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.eq_ignore_ascii_case("mkv"))
                    .unwrap_or(false)
            {
                file_count += 1;
                let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
                total_size_bytes += size_bytes;
                files.push(FileStat {
                    name: entry.file_name().to_string_lossy().into_owned(),
                    size_bytes,
                });
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

// =============================================================================
// SIDECAR VERSION
// =============================================================================

#[tauri::command]
pub async fn get_sidecar_version<R: tauri::Runtime>(
    app: AppHandle<R>,
    binary_name: String,
) -> Result<String, AppError> {
    use tauri_plugin_shell::ShellExt;
    let sidecar = app
        .shell()
        .sidecar(&binary_name)
        .map_err(|e| AppError::Sidecar(format!("Sidecar '{}' not found: {}", binary_name, e)))?;

    let output = sidecar
        .arg("-version")
        .output()
        .await
        .map_err(|e| AppError::Sidecar(e.to_string()))?;

    let version_line = std::str::from_utf8(&output.stdout)
        .unwrap_or("")
        .lines()
        .next()
        .unwrap_or("Unknown")
        .to_string();

    Ok(version_line)
}

// =============================================================================
// SESSION LOG COMMANDS
// =============================================================================

#[tauri::command]
pub fn initialize_session_log<R: tauri::Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|e| AppError::Process(format!("Failed to resolve log directory: {}", e)))?;

    if !log_dir.exists() {
        std::fs::create_dir_all(&log_dir).map_err(AppError::Io)?;
    }

    let log_file_path = log_dir.join("session.log");
    let file = std::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&log_file_path)
        .map_err(AppError::Io)?;

    let state = app.state::<AppState>();
    let mut guard = state
        .log_writer
        .lock()
        .map_err(|e| AppError::Process(e.to_string()))?;
    *guard = Some(crate::models::SessionLog {
        writer: std::io::BufWriter::new(file),
        bytes_written: 0,
    });

    Ok(())
}

#[tauri::command]
pub fn check_session_log<R: tauri::Runtime>(app: AppHandle<R>) -> bool {
    if let Ok(log_dir) = app.path().app_log_dir() {
        log_dir.join("session.log").exists()
    } else {
        false
    }
}

#[tauri::command]
pub fn read_session_log<R: tauri::Runtime>(app: AppHandle<R>) -> Result<String, AppError> {
    flush_log_writer(&app);
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|e| AppError::Process(format!("Failed to resolve log directory: {}", e)))?;
    let log_path = log_dir.join("session.log");
    std::fs::read_to_string(&log_path).map_err(AppError::Io)
}

#[tauri::command]
pub async fn save_log_file<R: tauri::Runtime>(
    app: AppHandle<R>,
    path: String,
) -> Result<(), AppError> {
    flush_log_writer(&app);

    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|e| AppError::Process(format!("Failed to resolve log directory: {}", e)))?;
    let log_path = log_dir.join("session.log");
    let content = std::fs::read_to_string(&log_path).map_err(AppError::Io)?;

    std::fs::write(Path::new(&path), content).map_err(AppError::Io)?;

    Ok(())
}

#[tauri::command]
pub fn log_message<R: tauri::Runtime>(app: AppHandle<R>, message: String) {
    append_log(&app, &message);
}

// =============================================================================
// PROCESSING HISTORY
// =============================================================================

#[tauri::command]
pub async fn clear_processing_history<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let db_mutex = state.db.blocking_lock();
        if let Some(db) = db_mutex.as_ref() {
            crate::history::clear_history(db)
        } else {
            Ok(())
        }
    })
    .await
    .map_err(|e| AppError::Process(format!("Task join error: {}", e)))?
}

// =============================================================================
// OPEN FOLDER
// =============================================================================

#[tauri::command]
pub fn open_folder<R: tauri::Runtime>(app: AppHandle<R>, path: String) -> Result<(), AppError> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|e| AppError::Process(e.to_string()))
}
