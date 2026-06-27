use indexmap::IndexMap;
use serde_json::json;
use std::collections::{HashMap, HashSet};
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
use crate::process::{
    FileOutcome, append_log, discover_mkv_files, flush_log_writer, process_one_mkv_file,
};

// =============================================================================
// PRIMARY PROCESSING COMMAND
// =============================================================================

type FolderResultsMap = HashMap<String, (Vec<SubtitleMetadata>, Vec<crate::models::FailedFile>)>;

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

    // Fetch sidecar versions concurrently (L-2)
    let (ffmpeg_res, ffprobe_res) = tokio::join!(
        get_sidecar_version(app.clone(), "ffmpeg".to_string()),
        get_sidecar_version(app.clone(), "ffprobe".to_string())
    );

    for (binary, res) in [("ffmpeg", ffmpeg_res), ("ffprobe", ffprobe_res)] {
        match res {
            Ok(ver) => append_log(&app, format!("📦 Sidecar {}: {}", binary, ver)),
            Err(_) => append_log(&app, format!("📦 Sidecar {}: Unknown", binary)),
        }
    }

    // --- Discover MKV files (C-3: Wrap in spawn_blocking) ---
    let paths_clone = paths.clone();
    let all_files =
        tokio::task::spawn_blocking(move || discover_mkv_files(&paths_clone, recursive))
            .await
            .unwrap_or_default();

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

        // M-2: Removed redundant Finished emit
        return Ok(empty_payload);
    }

    if total_count > 300 {
        let _ = app.emit(EVENT_LARGE_BATCH_WARNING, total_count);
    }

    // --- History Cache (P-4) ---
    let history_cache = tokio::task::spawn_blocking({
        let app_clone = app.clone();
        move || {
            let st = app_clone.state::<AppState>();
            let guard = st.db.blocking_lock();
            if let Some(db) = guard.as_ref() {
                crate::history::load_cache(db).unwrap_or_default()
            } else {
                HashSet::new()
            }
        }
    })
    .await
    .unwrap_or_default();

    let history_cache = Arc::new(history_cache);
    let new_history_records = Arc::new(tokio::sync::Mutex::new(HashSet::new()));

    // --- Shared counters ---
    let files_processed = Arc::new(AtomicUsize::new(0));
    let tracks_converted = Arc::new(AtomicUsize::new(0));
    let files_success = Arc::new(AtomicUsize::new(0));
    let files_failed = Arc::new(AtomicUsize::new(0));
    let files_skipped = Arc::new(AtomicUsize::new(0));
    let files_no_tracks = Arc::new(AtomicUsize::new(0));

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
    let mut announced_folders = HashSet::new(); // H-4: Deduplicate FolderStatusUpdate

    for path_str in &paths {
        for (file_path, folder_path) in all_files.iter().filter(|(_, f)| f == path_str) {
            if cancel_token.is_cancelled() {
                break;
            }

            let permit = match sem.clone().acquire_owned().await {
                Ok(p) => p,
                Err(_) => break,
            };

            // H-4: Only announce folder processing once
            if !announced_folders.contains(folder_path) {
                announced_folders.insert(folder_path.clone());
                let _ = on_progress.send(ProgressPayload {
                    event: "FolderStatusUpdate".into(),
                    data: json!({
                        "folder": folder_path,
                        "status": "processing"
                    }),
                });
            }

            let app_clone = app.clone();
            let cancel_clone = cancel_token.clone();
            let on_progress_clone = on_progress.clone();
            let results_clone = results.clone();
            let fp_clone = files_processed.clone();
            let tc_clone = tracks_converted.clone();
            let fs_clone = files_success.clone();
            let ff_clone = files_failed.clone();
            let fsk_clone = files_skipped.clone();
            let fnt_clone = files_no_tracks.clone();
            let history_cache_clone = history_cache.clone();
            let new_history_records_clone = new_history_records.clone();
            let folder_owned = folder_path.clone();
            let file_owned = file_path.clone();

            join_set.spawn(async move {
                let _permit = permit;

                if cancel_clone.is_cancelled() {
                    return folder_owned;
                }

                match process_one_mkv_file(crate::process::ProcessContext {
                    app: &app_clone,
                    file_path: &file_owned,
                    root_dir: &folder_owned,
                    cancel_token: &cancel_clone,
                    on_progress: &on_progress_clone,
                    files_processed: &fp_clone,
                    tracks_converted: &tc_clone,
                    history_cache: &history_cache_clone,
                    new_history_records: &new_history_records_clone,
                })
                .await
                {
                    Ok((convs, fails, outcome)) => {
                        match classify_result(&convs, &fails, outcome) {
                            FileCategory::HistorySkipped => {
                                fsk_clone.fetch_add(1, Ordering::Relaxed);
                            }
                            FileCategory::NoTracks => {
                                fnt_clone.fetch_add(1, Ordering::Relaxed);
                            }
                            FileCategory::Failed => {
                                ff_clone.fetch_add(1, Ordering::Relaxed);
                            }
                            FileCategory::Success => {
                                fs_clone.fetch_add(1, Ordering::Relaxed);
                            }
                            FileCategory::Ghost => {
                                fsk_clone.fetch_add(1, Ordering::Relaxed);
                            } // Treat ghost files as skipped
                        }

                        let mut r = results_clone.lock().await;
                        if let Some(entry) = r.get_mut(&folder_owned) {
                            entry.0.extend(convs);
                            entry.1.extend(fails);
                        }
                    }
                    Err(AppError::Aborted) => {}
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
                    conv_list.sort_by(sort_natural);

                    let mut report = IndexMap::new();
                    report.insert("target_folder", json!(folder_path));
                    report.insert(
                        "timestamp",
                        json!(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()),
                    );
                    report.insert("files", json!(conv_list));

                    tokio::fs::write(
                        root_path.join("converted_files.json"),
                        serde_json::to_string_pretty(&report).unwrap_or_default(),
                    )
                    .await
                    .ok();
                    if any_success_dir.is_empty() {
                        any_success_dir = folder_path.clone();
                    }
                }

                if !fail_list.is_empty() {
                    fail_list.sort_by(|a, b| a.path.cmp(&b.path));

                    let mut report = IndexMap::new();
                    report.insert("target_folder", json!(folder_path));
                    report.insert(
                        "timestamp",
                        json!(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()),
                    );
                    report.insert("failed_files", json!(fail_list));

                    tokio::fs::write(
                        root_path.join("failed_files.json"),
                        serde_json::to_string_pretty(&report).unwrap_or_default(),
                    )
                    .await
                    .ok();
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

    // --- Flush history cache (P-4) ---
    {
        let new_records = new_history_records.lock().await.clone();
        if !new_records.is_empty() {
            tokio::task::spawn_blocking({
                let app_clone = app.clone();
                move || {
                    let st = app_clone.state::<AppState>();
                    let mut guard = st.db.blocking_lock();
                    if let Some(db) = guard.as_mut() {
                        let _ = crate::history::flush_cache(db, &new_records);
                    }
                }
            })
            .await
            .unwrap_or_default();
        }
    }

    // --- Post-processing ---
    if cancel_token.is_cancelled() {
        {
            let mut session = state.process.lock().await;
            for path in session.session_output_files.drain(..) {
                if path.exists() {
                    let _ = std::fs::remove_file(&path);
                }
            }
            for path_str in &session.active_paths.clone() {
                let dir = Path::new(path_str);
                let _ = std::fs::remove_file(dir.join("converted_files.json"));
                let _ = std::fs::remove_file(dir.join("failed_files.json"));
            }
            session.active_paths.clear();
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
        let f_no_tracks = files_no_tracks.load(Ordering::Relaxed);

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
                "Conversion Complete!\nFiles: {} Succeeded, {} Failed, {} Skipped, {} No Tracks.\nTracks: {} Converted, {} Failed.\nSession finished at: {}\nTotal Conversion Time: {}",
                f_success,
                f_failed,
                f_skipped,
                f_no_tracks,
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
            "folder_statuses": folder_statuses,
            "succeeded_files": f_success, // L-1 / U-1 breakdown
            "failed_files": f_failed,
            "skipped_files": f_skipped,
            "no_tracks_files": f_no_tracks,
        });

        // M-2: Removed redundant Finished emit. Frontend uses invoke result.

        {
            let mut session = state.process.lock().await;
            session.active_paths.clear();
        }

        return Ok(final_payload);
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
// DIRECTORY STATS & REPORTS
// =============================================================================

#[tauri::command]
pub async fn read_report_file(dir_path: String, report_type: String) -> Result<String, AppError> {
    let filename = if report_type == "success" {
        "converted_files.json"
    } else {
        "failed_files.json"
    };
    let path = Path::new(&dir_path).join(filename);
    tokio::fs::read_to_string(path).await.map_err(AppError::Io)
}
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

pub fn parse_sidecar_version(stdout: &[u8]) -> String {
    std::str::from_utf8(stdout)
        .unwrap_or("")
        .lines()
        .next()
        .unwrap_or("Unknown")
        .to_string()
}

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

    Ok(parse_sidecar_version(&output.stdout))
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
pub async fn check_session_log<R: tauri::Runtime>(app: AppHandle<R>) -> Result<bool, AppError> {
    if let Ok(log_dir) = app.path().app_log_dir() {
        Ok(tokio::fs::try_exists(log_dir.join("session.log"))
            .await
            .unwrap_or(false))
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn read_session_log<R: tauri::Runtime>(app: AppHandle<R>) -> Result<String, AppError> {
    flush_log_writer(&app);
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|e| AppError::Process(format!("Failed to resolve log directory: {}", e)))?;
    let log_path = log_dir.join("session.log");
    tokio::fs::read_to_string(&log_path)
        .await
        .map_err(AppError::Io)
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

    let mut final_content = String::new();

    // Read rotated logs in chronological order
    let rotations = ["session.2.log", "session.1.log", "session.log"];
    for rot in rotations {
        let rot_path = log_dir.join(rot);
        if let Ok(content) = tokio::fs::read_to_string(&rot_path).await {
            final_content.push_str(&content);
            if !final_content.ends_with('\n') {
                final_content.push('\n');
            }
        }
    }

    tokio::fs::write(Path::new(&path), final_content)
        .await
        .map_err(AppError::Io)?;

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
pub async fn get_history_count<R: tauri::Runtime>(app: AppHandle<R>) -> Result<usize, AppError> {
    tokio::task::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let db_mutex = state.db.blocking_lock();
        if let Some(db) = db_mutex.as_ref() {
            crate::history::get_history_count(db)
        } else {
            Ok(0)
        }
    })
    .await
    .map_err(|e| AppError::Process(format!("Task join error: {}", e)))?
}

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

#[derive(Debug, PartialEq, Eq)]
pub enum FileCategory {
    HistorySkipped,
    NoTracks,
    Failed,
    Success,
    Ghost,
}

pub fn classify_result(
    convs: &[SubtitleMetadata],
    fails: &[crate::models::FailedFile],
    outcome: FileOutcome,
) -> FileCategory {
    match outcome {
        FileOutcome::HistorySkipped => FileCategory::HistorySkipped,
        FileOutcome::NoTracks => FileCategory::NoTracks,
        FileOutcome::Processed => {
            if convs.is_empty() && !fails.is_empty() {
                FileCategory::Failed
            } else if !convs.is_empty() {
                FileCategory::Success
            } else {
                FileCategory::Ghost
            }
        }
    }
}

#[derive(PartialEq, Eq, PartialOrd, Ord)]
enum Token<'a> {
    Str(&'a str),
    Num(u64),
}

fn tokenize(s: &str) -> Vec<Token<'_>> {
    let mut tokens = Vec::new();
    let mut start = 0;
    let mut is_digit = false;

    for (i, c) in s.char_indices() {
        let current_is_digit = c.is_ascii_digit();
        if i == 0 {
            is_digit = current_is_digit;
        } else if is_digit != current_is_digit {
            let slice = &s[start..i];
            if is_digit {
                tokens.push(Token::Num(slice.parse().unwrap_or(0)));
            } else {
                tokens.push(Token::Str(slice));
            }
            start = i;
            is_digit = current_is_digit;
        }
    }
    if start < s.len() {
        let slice = &s[start..];
        if is_digit {
            tokens.push(Token::Num(slice.parse().unwrap_or(0)));
        } else {
            tokens.push(Token::Str(slice));
        }
    }
    tokens
}

pub fn sort_natural(a: &SubtitleMetadata, b: &SubtitleMetadata) -> std::cmp::Ordering {
    tokenize(&a.file).cmp(&tokenize(&b.file))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_result() {
        assert_eq!(
            classify_result(&[], &[], FileOutcome::HistorySkipped),
            FileCategory::HistorySkipped
        );
        assert_eq!(
            classify_result(&[], &[], FileOutcome::NoTracks),
            FileCategory::NoTracks
        );

        // Ghost file (processed, but 0 conversions and 0 failures)
        assert_eq!(
            classify_result(&[], &[], FileOutcome::Processed),
            FileCategory::Ghost
        );

        // Success
        let md = SubtitleMetadata {
            file: "test".into(),
            language: String::new(),
            track_name: String::new(),
            codec: String::new(),
            source_file: String::new(),
        };
        assert_eq!(
            classify_result(&[md.clone()], &[], FileOutcome::Processed),
            FileCategory::Success
        );

        // Success with some failures (still counts as file success in logic)
        assert_eq!(
            classify_result(
                &[md],
                &[crate::models::FailedFile {
                    path: "test".into(),
                    reason: "fail".into()
                }],
                FileOutcome::Processed
            ),
            FileCategory::Success
        );

        // Failed
        assert_eq!(
            classify_result(
                &[],
                &[crate::models::FailedFile {
                    path: "test".into(),
                    reason: "fail".into()
                }],
                FileOutcome::Processed
            ),
            FileCategory::Failed
        );
    }

    #[test]
    fn test_sort_natural() {
        let mut items = vec![
            SubtitleMetadata {
                file: "Track 10".into(),
                language: String::new(),
                track_name: String::new(),
                codec: String::new(),
                source_file: String::new(),
            },
            SubtitleMetadata {
                file: "Track 2".into(),
                language: String::new(),
                track_name: String::new(),
                codec: String::new(),
                source_file: String::new(),
            },
            SubtitleMetadata {
                file: "Track 1".into(),
                language: String::new(),
                track_name: String::new(),
                codec: String::new(),
                source_file: String::new(),
            },
        ];
        items.sort_by(sort_natural);
        assert_eq!(items[0].file, "Track 1");
        assert_eq!(items[1].file, "Track 2");
        assert_eq!(items[2].file, "Track 10");
    }

    #[tokio::test]
    async fn test_get_directory_stats_command() {
        use std::fs::File;

        let temp = tempfile::tempdir().unwrap();
        let mkv1 = temp.path().join("test1.mkv");
        let txt1 = temp.path().join("test1.txt");

        File::create(&mkv1).unwrap();
        File::create(&txt1).unwrap();

        let stats = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            get_directory_stats(temp.path().to_string_lossy().into_owned(), false),
        )
        .await
        .expect("test timed out")
        .unwrap();

        assert!(stats.exists);
        assert_eq!(stats.file_count, 1);
        assert_eq!(stats.files.len(), 1);
        assert_eq!(stats.files[0].name, "test1.mkv");
    }

    #[tokio::test]
    async fn test_check_folder_reports_command() {
        let temp = tempfile::tempdir().unwrap();
        let path_str = temp.path().to_string_lossy().into_owned();

        // wrap the synchronous function in spawn_blocking
        let mut reports = tokio::task::spawn_blocking({
            let path_str = path_str.clone();
            move || check_folder_reports(vec![path_str]).unwrap()
        })
        .await
        .unwrap();
        let status = reports.remove(&path_str).unwrap();
        assert!(!status.has_success);
        assert!(!status.has_failure);

        std::fs::File::create(temp.path().join("converted_files.json")).unwrap();
        std::fs::File::create(temp.path().join("failed_files.json")).unwrap();

        let mut reports = tokio::task::spawn_blocking({
            let path_str = path_str.clone();
            move || check_folder_reports(vec![path_str]).unwrap()
        })
        .await
        .unwrap();
        let status = reports.remove(&path_str).unwrap();
        assert!(status.has_success);
        assert!(status.has_failure);
    }

    #[test]
    fn test_parse_sidecar_version() {
        assert_eq!(
            parse_sidecar_version(b"ffmpeg version 5.1.2\nbuilt with gcc\n"),
            "ffmpeg version 5.1.2"
        );
        assert_eq!(parse_sidecar_version(b""), "Unknown");
        assert_eq!(parse_sidecar_version(&[255, 255, 255]), "Unknown");
    }

    #[tokio::test]
    #[cfg(not(target_os = "windows"))] // Fix Windows headless WebView2 issues
    async fn test_abort_mkv_directory_processing() {
        let builder = tauri::test::mock_builder();
        let app = crate::app_builder(builder)
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();

        let state = app.state::<crate::models::AppState>();

        abort_mkv_directory_processing(state.clone()).await.unwrap();

        // Verify token is cancelled
        let session = state.process.lock().await;
        assert!(session.cancel.is_cancelled());
    }

    #[tokio::test]
    #[cfg(not(target_os = "windows"))]
    async fn test_history_commands() {
        let builder = tauri::test::mock_builder();
        let app = crate::app_builder(builder)
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();

        let handle = app.app_handle();
        let state = handle.state::<crate::models::AppState>();

        // Setup db
        let conn = crate::history::init_db(handle).unwrap();
        crate::history::mark_file_processed(&conn, "/dummy/path.mkv", 12345, 67890).unwrap();
        *state.db.lock().await = Some(conn);

        let count = get_history_count(handle.clone()).await.unwrap();
        assert_eq!(count, 1);

        clear_processing_history(handle.clone()).await.unwrap();
        let count_after = get_history_count(handle.clone()).await.unwrap();
        assert_eq!(count_after, 0);
    }

    #[tokio::test]
    #[cfg(not(target_os = "windows"))]
    async fn test_session_logs() {
        let builder = tauri::test::mock_builder();
        let app = crate::app_builder(builder)
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();

        let handle = app.app_handle();

        // initialize the log
        initialize_session_log(handle.clone()).unwrap();

        // log a message
        log_message(handle.clone(), "test log message".to_string());

        // check log exists
        let exists = check_session_log(handle.clone()).await.unwrap();
        assert!(exists);

        // read the log
        let content = read_session_log(handle.clone()).await.unwrap();
        assert!(content.contains("test log message"));

        // test save log file
        let temp_dir = tempfile::tempdir().unwrap();
        let save_path = temp_dir.path().join("saved.log");
        save_log_file(handle.clone(), save_path.to_string_lossy().into_owned())
            .await
            .unwrap();

        let saved_content = tokio::fs::read_to_string(&save_path).await.unwrap();
        assert!(saved_content.contains("test log message"));
    }
}
