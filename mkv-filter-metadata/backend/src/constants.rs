pub const EVENT_PROCESS_LOG: &str = "process-log";
pub const EVENT_PROCESS_PROGRESS: &str = "process-progress";
pub const EVENT_LARGE_BATCH_WARNING: &str = "large-batch-warning";
pub const EVENT_DB_INIT_FAILED: &str = "db-init-failed";
pub const EVENT_RESOURCE_THROTTLE: &str = "resource-throttle";

pub const BINARY_FFMPEG: &str = "ffmpeg";
pub const BINARY_FFPROBE: &str = "ffprobe";
pub const BINARY_MKVMERGE: &str = "mkvmerge";

pub const LOG_MSG_PIPELINE_ABORTED: &str = "Pipeline aborted by user";
pub const LOG_MSG_PIPELINE_ERROR: &str = "Pipeline encountered an error";
pub const LOG_MSG_COMPLETED: &str = "completed successfully";
pub const LOG_MSG_SYSTEM_GUARD_PAUSE: &str = "  | [SYSTEM GUARD] System congested (CPU: {:.1}%, Mem Avail: {:.1}%). Pausing pipeline to protect OS...";
pub const LOG_MSG_SYSTEM_GUARD_RESUME: &str = "  | [SYSTEM GUARD] Resources freed. Resuming pipeline operations (CPU: {:.1}%, Mem Avail: {:.1}%)...";
pub const LOG_MSG_GRACEFUL_SHUTDOWN: &str =
    "Graceful shutdown initiated. Waiting for sidecars to terminate...";

pub const DIR_PROCESSED_FILES: &str = "processed_files";

pub const FFMPEG_ARG_ANALYZEDURATION: &str = "-analyzeduration";
pub const FFMPEG_ARG_PROBESIZE: &str = "-probesize";
pub const FFMPEG_ARG_100M: &str = "100M";
pub const FFMPEG_ARG_MAX_MUXING_QUEUE_SIZE: &str = "-max_muxing_queue_size";
pub const FFMPEG_ARG_4096: &str = "4096";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_guard_logging_constants() {
        assert!(LOG_MSG_SYSTEM_GUARD_PAUSE.contains("[SYSTEM GUARD]"));
        assert!(LOG_MSG_SYSTEM_GUARD_PAUSE.contains("Pausing pipeline"));
        assert!(LOG_MSG_SYSTEM_GUARD_RESUME.contains("[SYSTEM GUARD]"));
        assert!(LOG_MSG_SYSTEM_GUARD_RESUME.contains("Resuming pipeline"));
    }

    #[test]
    fn test_graceful_shutdown_constant() {
        assert!(LOG_MSG_GRACEFUL_SHUTDOWN.contains("Graceful shutdown"));
    }

    #[test]
    fn test_ffmpeg_args() {
        assert_eq!(FFMPEG_ARG_ANALYZEDURATION, "-analyzeduration");
        assert_eq!(FFMPEG_ARG_PROBESIZE, "-probesize");
        assert_eq!(FFMPEG_ARG_100M, "100M");
    }
}
