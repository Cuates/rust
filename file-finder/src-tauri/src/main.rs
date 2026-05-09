#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use glob::Pattern;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs::File;
use std::io::BufWriter;
use std::path::{Path, PathBuf};
use std::time::Instant;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use walkdir::WalkDir;
use chrono::Local;
use tauri::{State, Window, Emitter, Theme};

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
struct DirectoryResult {
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub matching_files: Vec<String>,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub subdirectories: BTreeMap<String, DirectoryResult>,
}

struct CancelState(Arc<AtomicBool>);

#[derive(Clone, Serialize)]
struct ProgressPayload {
    pub files_found: usize,
    pub dirs_scanned: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Metadata {
    pub start_time: String,
    pub end_time: String,
    pub execution_time_seconds: f64,
    pub execution_time_formatted: String,
    pub root_directory: String,
    pub file_types_searched: Vec<String>,
    pub exclusion_patterns: Vec<String>,
    pub total_directories_processed: usize,
    pub total_matching_files: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct OutputData {
    pub metadata: Metadata,
    pub results: DirectoryResult,
}

fn sort_all_files(node: &mut DirectoryResult) {
    node.matching_files.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    for sub_node in node.subdirectories.values_mut() {
        sort_all_files(sub_node);
    }
}

fn format_duration_consistent(duration: std::time::Duration) -> String {
    let secs = duration.as_secs();
    let millis = duration.subsec_millis();
    format!("{} seconds, {} milliseconds", secs, millis)
}

fn insert_into_tree(root: &mut DirectoryResult, relative_path: &Path, file_name: String) {
    let mut current_node = root;
    for component in relative_path.parent().unwrap_or(Path::new("")).components() {
        let dir_name = component.as_os_str().to_string_lossy().to_string();
        if dir_name.is_empty() || dir_name == "." { continue; }
        current_node = current_node.subdirectories.entry(dir_name).or_default();
    }
    current_node.matching_files.push(file_name);
}

#[tauri::command]
fn set_window_theme(window: Window, dark: bool) {
    let theme = if dark { Theme::Dark } else { Theme::Light };
    let _ = window.set_theme(Some(theme));
}

#[tauri::command]
fn cancel_search(state: State<'_, CancelState>) {
    state.0.store(true, Ordering::SeqCst);
}

#[tauri::command]
async fn search_files(
    window: Window,
    state: State<'_, CancelState>,
    root_dir: String,
    file_types: Vec<String>,
    exclude_patterns: Vec<String>,
    save_path: String,
) -> Result<Metadata, String> {
    state.0.store(false, Ordering::SeqCst);
    let start_instant = Instant::now();
    let start_time_local = Local::now().format("%Y-%m-%dT%H:%M:%S%.6f").to_string();

    let root_path = PathBuf::from(&root_dir);

    if !root_path.exists() {
        return Err(format!("Path does not exist: {}", root_dir));
    }
    if !root_path.is_dir() {
        return Err(format!("Path is not a directory: {}", root_dir));
    }

    let mut total_files = 0;
    let mut total_dirs = 0;
    let mut processed_count = 0;
    let mut root_result = DirectoryResult::default();

    let compiled_excludes: Vec<Pattern> = exclude_patterns
        .iter()
        .filter_map(|p| Pattern::new(p).ok())
        .collect();

    for entry in WalkDir::new(&root_path)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !compiled_excludes.iter().any(|p| p.matches(&name))
        })
    {
        if state.0.load(Ordering::SeqCst) {
            return Err("Operation cancelled by user".into());
        }

        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().is_dir() {
            total_dirs += 1;
        } else {
            let ext = format!(".{}", entry.path().extension().unwrap_or_default().to_string_lossy().to_lowercase());
            if file_types.iter().any(|t| t.to_lowercase() == ext) {
                total_files += 1;
                if let Ok(rel_path) = entry.path().strip_prefix(&root_path) {
                    insert_into_tree(&mut root_result, rel_path, entry.file_name().to_string_lossy().into());
                }
            }
        }

        processed_count += 1;
        if processed_count % 100 == 0 {
            let _ = window.emit("search-progress", ProgressPayload {
                files_found: total_files,
                dirs_scanned: total_dirs,
            });
        }
    }

    sort_all_files(&mut root_result);
    let duration = start_instant.elapsed();
    let end_time_local = Local::now().format("%Y-%m-%dT%H:%M:%S%.6f").to_string();

    let metadata = Metadata {
        start_time: start_time_local,
        end_time: end_time_local,
        execution_time_seconds: duration.as_secs_f64(),
        execution_time_formatted: format_duration_consistent(duration),
        root_directory: root_dir,
        file_types_searched: file_types,
        exclusion_patterns: exclude_patterns,
        total_directories_processed: total_dirs,
        total_matching_files: total_files,
    };

    let output = OutputData {
        metadata: metadata.clone(),
        results: root_result,
    };

    let file = File::create(&save_path).map_err(|e| format!("File creation failed: {}", e))?;
    let writer = BufWriter::new(file);
    serde_json::to_writer_pretty(writer, &output).map_err(|e| format!("JSON stream failed: {}", e))?;

    Ok(metadata)
}

fn main() {
    tauri::Builder::default()
        .manage(CancelState(Arc::new(AtomicBool::new(false))))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            search_files,
            cancel_search,
            set_window_theme
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}