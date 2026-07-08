export const TAURI_COMMANDS = {
  ABORT_VIDEO_PIPELINE: 'abort_video_pipeline',
  GET_ENCODER_CAPABILITIES: 'get_encoder_capabilities',
  GET_DIRECTORY_STATS: 'get_directory_stats',
  GET_SIDECAR_VERSION: 'get_sidecar_version',
  PROCESS_VIDEO_PIPELINE: 'process_video_pipeline',
  SAVE_LOG_FILE: 'save_log_file',
  READ_SESSION_LOG: 'read_session_log',
  CHECK_SESSION_LOG: 'check_session_log',
  INITIALIZE_SESSION_LOG: 'initialize_session_log',
  LOG_MESSAGE: 'log_message',
  OPEN_FOLDER: 'open_folder',
  CLEAR_PROCESSING_HISTORY: 'clear_processing_history',
  GET_HISTORY_COUNT: 'get_history_count'
} as const;

export const RESERVED_SHORTCUTS = {
  COMMAND_PALETTE: 'Ctrl+K'
} as const;

export const TAURI_EVENTS = {
  PROCESS_LOG: 'process-log',
  PROCESS_PROGRESS: 'process-progress',
  LARGE_BATCH_WARNING: 'large-batch-warning',
  DB_INIT_FAILED: 'db-init-failed',
  DRAG_ENTER: 'tauri://drag-enter',
  DRAG_LEAVE: 'tauri://drag-leave',
  DRAG_DROP: 'tauri://drag-drop',
  RESOURCE_THROTTLE: 'resource-throttle'
} as const;

export const STORE_FILENAMES = {
  CONFIG: 'config.json',
  PRESETS: 'presets.json',
  SHORTCUTS: 'shortcuts.json'
} as const;

export const UI_STRINGS = {
  DIRECTORY_NOT_FOUND: 'Directory not found',
  NO_MATCHED_FILES: 'No matched files',
  RECORDING_SHORTCUT: 'Recording...',
  PILL_FILES_SUFFIX: ' files',
  RESOURCES_RELEASED: 'Resources released. System ready.',
  CLEAR_HISTORY_CONFIRMATION:
    'Are you sure you want to clear the processing history database?\n\nThis will cause any previously completed files to be re-processed if they are queued again.',
  NO_SESSION_LOG: 'No session log found on disk to copy.',
  COPY_LOGS_FAILED: 'Failed to copy logs:',
  NO_ACTIVE_SESSION_LOG: 'No active session log found to save.',
  LOG_FILE_PREFIX: 'mkv_filter_metadata_',
  SAVE_LOG_FAILED: 'Failed to save log:',
  REALTIME_OUTPUT_LOG_TITLE: 'Real-time Output Pipeline Log',
  LOGS_WILL_APPEAR: 'Logs will appear here once processing begins...',
  SAVED: 'Saved!',
  EXPORT_LOGS: 'Export logs',
  COPIED: 'Copied!',
  COPY_LOGS: 'Copy logs',
  SCROLL_TO_TOP: 'Scroll to top',
  SCROLL_TO_LATEST: 'Scroll to latest log entry',
  ABORTING_EXECUTION: 'Aborting execution and cleaning up...',
  ADD_TARGET_DIR: 'Please add at least one target directory.',
  PIPELINE_INITIALIZATION_AUTH: 'Pipeline initialization request authenticated...',
  SESSION_STARTED_AT: 'Session started at:',
  PIPELINE_COMPLETED: 'Pipeline completed processing files.',
  PIPELINE_EXECUTION_FAILED: 'Pipeline execution failed:',
  PIPELINE_EXECUTION_COMPLETE: 'Pipeline execution complete!',
  SESSION_FINISHED_AT: 'Session finished at:',
  TOTAL_CONVERSION_TIME: 'Total Conversion Time:',
  HALT_INSTRUCTION_ISSUED: 'Halt instruction issued. Awaiting resource release.',
  CLEAR_HISTORY_SUCCESS: '✅ Processing history cleared successfully.',
  CLEAR_HISTORY_FAILED: '❌ Failed to clear history:',
  TOTAL_SCANNED: 'Total Scanned:',
  OVERALL_PROGRESS: 'Overall Progress:',
  TOTAL_SIZE: 'Total Size:',
  PROCESSING: 'Processing:',
  ETA: 'ETA:',
  LAST_RUN: 'Last Run',
  FILES_PROCESSED: 'Files processed',
  DURATION: 'Duration',
  STORAGE_DELTA: 'Storage delta',
  IDLE_READY: 'Ready — run history will appear here.'
} as const;

export const UI_CONSTANTS = {
  TOOLTIP_HIDE_DELAY_MS: 150,
  TOOLTIP_OFFSET_PX: 8,
  TOOLTIP_BOUNDARY_MARGIN: 10,
  DEFAULT_LOGICAL_CORES: 8
} as const;

export const KEY_OVERRIDES = {
  CTRL: 'Ctrl',
  SHIFT: 'Shift',
  ALT: 'Alt',
  META: 'Meta',
  SPACE: 'Space'
} as const;

export const INTERNAL_IDENTIFIERS = {
  START_PIPELINE: 'startPipeline',
  ABORT_PIPELINE: 'abortPipeline'
} as const;

export const DOM_EVENTS = {
  MOUSE_ENTER: 'mouseenter',
  MOUSE_LEAVE: 'mouseleave'
} as const;

export const LOG_MESSAGES = {
  WINDOW_CLOSE_MID_EXECUTION: '⚠️ Window close requested mid-execution. Cleaning up...',
  QUERYING_SIDECAR: '--- Querying Embedded Sidecar Binary Configurations ---',
  SIDECAR_ASSET: '[Sidecar Asset]',
  DASH_SEPARATOR: '--------------------------------------------------------',
  ERR_NO_TARGET_DIR:
    '❌ Error: Please add at least one target directory to the queue before running processing tasks.',
  PIPELINE_FAILURE: '❌ Pipeline execution failure:',
  HALT_TERMINATING: '🛑 Halt instruction issued. Terminating processes and waiting for release...',
  PROCESSING_STOPPED: '🛑 Processing execution stopped.',
  ERR_TERMINATING_WORKERS: 'Error safely terminating workers:',
  TIMER_TICK_ERROR: 'Timer tick error:',
  TRIMMED_ENTRIES: (overflow: number) => `— [${overflow} entries trimmed – see saved session.log] —`
} as const;
