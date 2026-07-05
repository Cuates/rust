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
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<AppState>();
                let guard = state.process.blocking_lock();
                if !guard.cancel.is_cancelled() {
                    api.prevent_close();
                    guard.cancel.cancel();

                    let window_clone = window.clone();
                    tauri::async_runtime::spawn(async move {
                        tracing::info!("{}", crate::constants::LOG_MSG_GRACEFUL_SHUTDOWN);
                        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                        let _ = window_clone.close();
                    });
                }
            }
        })
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();

            std::panic::set_hook(Box::new({
                let handle = handle.clone();
                move |info| {
                    tracing::error!("FATAL PANIC: {}", info);
                    crate::process::append_log(&handle, format!("  | [FATAL] PANIC: {}", info));
                    crate::process::flush_log_writer(&handle);
                }
            }));

            let state = handle.state::<AppState>();

            let (log_tx, mut log_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
            if let Ok(mut guard) = state.log_tx.lock() {
                *guard = Some(log_tx);
            }
            let app_handle_for_log = handle.clone();
            tauri::async_runtime::spawn(async move {
                let mut batch = Vec::new();
                let mut interval = tokio::time::interval(std::time::Duration::from_millis(200));
                loop {
                    tokio::select! {
                        _ = interval.tick() => {
                            if !batch.is_empty() {
                                if let Err(e) = app_handle_for_log.emit(crate::constants::EVENT_PROCESS_LOG, &batch) {
                                    tracing::warn!("Failed to emit EVENT_PROCESS_LOG batch: {}", e);
                                }
                                batch.clear();
                            }
                        }
                        msg = log_rx.recv() => {
                            match msg {
                                Some(m) => {
                                    batch.push(m);
                                    if batch.len() >= 100 {
                                        if let Err(e) = app_handle_for_log.emit(crate::constants::EVENT_PROCESS_LOG, &batch) {
                                            tracing::warn!("Failed to emit EVENT_PROCESS_LOG batch: {}", e);
                                        }
                                        batch.clear();
                                        interval.reset();
                                    }
                                }
                                None => break,
                            }
                        }
                    }
                }
            });

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
            commands::clear_processing_history,
            commands::get_history_count
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_graceful_exit_cancel_token() {
        let state = AppState::default();
        let guard = state.process.blocking_lock();

        // Ensure token starts un-cancelled
        assert!(!guard.cancel.is_cancelled());

        // Simulate window close firing the token
        guard.cancel.cancel();

        // Ensure token is now cancelled
        assert!(guard.cancel.is_cancelled());
    }
}
