pub mod commands;
pub mod error;
pub mod models;
pub mod process;

use crate::models::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("error")),
        )
        .init();

    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::abort_video_pipeline,
            commands::get_encoder_capabilities,
            commands::get_directory_stats,
            commands::get_sidecar_version,
            commands::process_video_pipeline,
            commands::save_log_file,
            commands::read_session_log,
            commands::check_session_log,
            commands::initialize_session_log,
            commands::log_message,
            commands::open_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
