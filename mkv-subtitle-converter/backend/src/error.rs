use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Sidecar '{binary}' error: {message}")]
    Sidecar { binary: String, message: String },
    #[error("Pipeline aborted by user")]
    Aborted,
    #[error("FFprobe failure for '{file}': {message}")]
    FfprobeFailed { file: String, message: String },
    #[error("Process error: {message}")]
    Process { message: String },
}

/// Serialize the error as a plain string for the Tauri frontend IPC layer.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_serialization() {
        let err = AppError::Aborted;
        assert_eq!(
            serde_json::to_string(&err).unwrap(),
            "\"Pipeline aborted by user\""
        );

        let err2 = AppError::Sidecar {
            binary: "ffmpeg".into(),
            message: "failed".into(),
        };
        assert_eq!(
            serde_json::to_string(&err2).unwrap(),
            "\"Sidecar 'ffmpeg' error: failed\""
        );

        let err3 = AppError::FfprobeFailed {
            file: "test.mkv".into(),
            message: "broken".into(),
        };
        assert_eq!(
            serde_json::to_string(&err3).unwrap(),
            "\"FFprobe failure for 'test.mkv': broken\""
        );

        let err4 = AppError::Process {
            message: "err".into(),
        };
        assert_eq!(
            serde_json::to_string(&err4).unwrap(),
            "\"Process error: err\""
        );

        let err5 = AppError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "not found",
        ));
        assert_eq!(
            serde_json::to_string(&err5).unwrap(),
            "\"IO error: not found\""
        );
    }
}
