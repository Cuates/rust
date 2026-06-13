pub mod commands;
pub mod constants;
pub mod error;
pub mod history;
pub mod models;
pub mod process;

use crate::models::AppState;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("error")),
        )
        .with_target(false)
        .with_thread_ids(false)
        .init();

    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let state = handle.state::<AppState>();
            match crate::history::init_db(&handle) {
                Ok(conn) => {
                    if let Ok(mut guard) = state.db.try_lock() {
                        *guard = Some(conn);
                    } else {
                        // blocking_lock is available on tokio::sync::Mutex
                        *state.db.blocking_lock() = Some(conn);
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to initialize history database: {:?}", e);
                    let _ = handle.emit(crate::constants::EVENT_DB_INIT_FAILED, e.to_string());
                }
            }
            Ok(())
        })
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
            commands::open_folder,
            commands::clear_processing_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
