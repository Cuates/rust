#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use glob::Pattern;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Instant;
use walkdir::WalkDir;
use chrono::Local;

#[derive(Debug, Serialize, Deserialize, Default)]
struct DirectoryResult {
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub matching_files: Vec<String>,

    // BTreeMap handles the alphanumeric sorting of directory names automatically
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub subdirectories: BTreeMap<String, DirectoryResult>,
}

// Post-processing function to sort all file vectors in the tree
fn sort_all_files(node: &mut DirectoryResult) {
    // Sort files in the current directory (case-insensitive)
    node.matching_files.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));

    // Recursively sort files in all subdirectories
    for sub_node in node.subdirectories.values_mut() {
        sort_all_files(sub_node);
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct Metadata {
    start_time: String,
    end_time: String,
    execution_time_seconds: f64,
    execution_time_formatted: String,
    root_directory: String,
    file_types_searched: Vec<String>,
    exclusion_patterns: Vec<String>,
    total_directories_processed: usize,
    total_matching_files: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct OutputData {
    metadata: Metadata,
    results: DirectoryResult,
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
async fn search_files(
    root_dir: String,
    file_types: Vec<String>,
    exclude_patterns: Vec<String>,
    save_path: Option<String>,
) -> Result<OutputData, String> {
    let start_instant = Instant::now();
    let start_time_local = Local::now().format("%Y-%m-%dT%H:%M:%S%.6f").to_string();

    let root_path = PathBuf::from(&root_dir);
    let mut total_files = 0;
    let mut total_dirs = 0;
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
    }

    // NEW: Sort all file lists alphanumerically after the scan is complete
    sort_all_files(&mut root_result);

    let duration = start_instant.elapsed();
    let end_time_local = Local::now().format("%Y-%m-%dT%H:%M:%S%.6f").to_string();

    let output = OutputData {
        metadata: Metadata {
            start_time: start_time_local,
            end_time: end_time_local,
            execution_time_seconds: duration.as_secs_f64(),
            execution_time_formatted: format_duration_consistent(duration),
            root_directory: root_dir,
            file_types_searched: file_types,
            exclusion_patterns: exclude_patterns,
            total_directories_processed: total_dirs,
            total_matching_files: total_files,
        },
        results: root_result,
    };

    if let Some(path) = save_path {
        let json = serde_json::to_string_pretty(&output).map_err(|e| e.to_string())?;
        let mut file = File::create(path).map_err(|e| e.to_string())?;
        file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    }

    Ok(output)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![search_files])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}