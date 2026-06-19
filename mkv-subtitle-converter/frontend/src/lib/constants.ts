// Tauri command names — keep in sync with backend src/commands.rs
export const CMD_PROCESS_MKV_DIRECTORY = 'process_mkv_directory';
export const CMD_ABORT_PROCESSING = 'abort_mkv_directory_processing';
export const CMD_SHOW_ITEM_IN_FOLDER = 'show_item_in_folder';
export const CMD_GET_SIDECAR_VERSION = 'get_sidecar_version';
export const CMD_INIT_SESSION_LOG = 'initialize_session_log';
export const CMD_CHECK_SESSION_LOG = 'check_session_log';
export const CMD_READ_SESSION_LOG = 'read_session_log';
export const CMD_SAVE_LOG_FILE = 'save_log_file';
export const CMD_CLEAR_PROCESSING_HISTORY = 'clear_processing_history';

// Tauri event names — keep in sync with backend src/constants.rs
export const EVENT_PROCESS_LOG = 'process-log';
export const EVENT_LARGE_BATCH_WARNING = 'large-batch-warning';
export const EVENT_DB_INIT_FAILED = 'db-init-failed';
