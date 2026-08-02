use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[serde(serialize_with = "serialize_io_error")] std::io::Error),
    #[error("Sidecar error: {0}")]
    Sidecar(String),
    #[error("Pipeline aborted by user")]
    Aborted,
    #[error("FFprobe failure: {0}")]
    FfprobeFailed(String),
    #[error("Process error: {0}")]
    Process(String),
}

fn serialize_io_error<S>(error: &std::io::Error, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_serialization() {
        let err = AppError::Aborted;
        assert_eq!(serde_json::to_string(&err).unwrap(), "\"Aborted\"");

        let err2 = AppError::Sidecar("failed".to_string());
        assert_eq!(
            serde_json::to_string(&err2).unwrap(),
            "{\"Sidecar\":\"failed\"}"
        );

        let err3 = AppError::FfprobeFailed("broken".to_string());
        assert_eq!(
            serde_json::to_string(&err3).unwrap(),
            "{\"FfprobeFailed\":\"broken\"}"
        );

        let err4 = AppError::Process("err".to_string());
        assert_eq!(
            serde_json::to_string(&err4).unwrap(),
            "{\"Process\":\"err\"}"
        );

        let err5 = AppError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "not found",
        ));
        assert_eq!(
            serde_json::to_string(&err5).unwrap(),
            "{\"Io\":\"not found\"}"
        );
    }
}
