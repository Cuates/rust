pub mod commands;
pub mod error;
pub mod models;
pub mod process;

use crate::models::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::abort_video_pipeline,
            commands::check_nvenc_support,
            commands::get_directory_stats,
            commands::get_sidecar_version,
            commands::process_video_pipeline,
            commands::save_log_file,
            commands::read_session_log,
            commands::check_session_log,
            commands::initialize_session_log,
            commands::log_message
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
