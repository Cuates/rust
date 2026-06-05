use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Sidecar error: {0}")]
    Sidecar(String),
    #[error("Pipeline aborted by user")]
    Aborted,
    #[error("FFprobe failure: {0}")]
    FfprobeFailed(String),
    #[error("Process error: {0}")]
    Process(String),
}

// Serialize the error as a standard string for the Tauri frontend
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
