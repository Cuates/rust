pub mod commands;
pub mod error;
pub mod models;
pub mod process;

use crate::commands::{
    abort_video_pipeline, check_nvenc_support, get_directory_stats, get_sidecar_version,
    process_video_pipeline, save_log_file,
};
use crate::models::AppState;

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
            check_nvenc_support,
            save_log_file,
            get_directory_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
