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

            // Install a panic hook that logs the panic info before crashing.
            std::panic::set_hook(Box::new({
                let handle = handle.clone();
                move |info| {
                    tracing::error!("FATAL PANIC: {}", info);
                    crate::process::append_log(&handle, format!("  | [FATAL] PANIC: {}", info));
                    crate::process::flush_log_writer(&handle);
                }
            }));

            // Initialize the SQLite history database.
            let state = handle.state::<AppState>();
            match crate::history::init_db(&handle) {
                Ok(conn) => {
                    *state.db.blocking_lock() = Some(conn);
                }
                Err(e) => {
                    tracing::error!("Failed to initialize history database: {:?}", e);
                    let _ = handle.emit(crate::constants::EVENT_DB_INIT_FAILED, e.to_string());
                }
            }

            Ok(())
        })
        // Fix C-1: handle close on the event thread without blocking sleep.
        // The async cleanup is spawned to avoid freezing the native event loop.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();

                let window_clone = window.clone();
                tauri::async_runtime::spawn(async move {
                    // Signal cancellation.
                    if let Some(state) = window_clone.try_state::<AppState>() {
                        let mut session = state.process.lock().await;
                        session.cancel.cancel();
                        // Kill any running children.
                        for (_, child) in session.children.drain() {
                            let _ = child.kill();
                        }
                        // Clean up session files.
                        for path in session.session_output_files.drain(..) {
                            if path.exists() {
                                let _ = std::fs::remove_file(&path);
                            }
                        }
                    }

                    // Short async sleep — does NOT block the event thread.
                    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                    let _ = window_clone.destroy();
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::process_mkv_directory,
            commands::abort_mkv_directory_processing,
            commands::show_item_in_folder,
            commands::check_folder_reports,
            commands::get_directory_stats,
            commands::get_sidecar_version,
            commands::initialize_session_log,
            commands::check_session_log,
            commands::read_session_log,
            commands::save_log_file,
            commands::log_message,
            commands::clear_processing_history,
            commands::open_folder,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to launch application");
}
