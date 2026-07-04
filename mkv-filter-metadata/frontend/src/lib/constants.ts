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
  PILL_FILES_SUFFIX: ' files'
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
