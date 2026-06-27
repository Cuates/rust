# Backend Native Layer (Tauri 2.0 & Rust)

The file system processing pipeline logic is fully managed inside `backend/src/lib.rs`. It provides multi-threaded processing optimizations, safe cancel state handling, and a custom raw-text SubRip to ASS transcoding layout engine.

## Essential Operations Performed Natively

1. **Sidecar Verification Phase:** Fires asynchronous internal validation checks targeting embedded binary locations to extract structural runtime parameters (`ffmpeg -version`).
2. **Layout Parsing Structure:** Uses `ffprobe` sidecars to scan targets, fetch track maps, and isolate binary layout properties (`default_flag`, `forced_flag`).
3. **Async Subprocess Spawn:** Launches independent `ffmpeg` extraction sub-routines mapped inside Tokio tasks.
4. **Rust Transcoding Core Engine:** Parses raw time markers out of SRT logs via standard buffers and structurally rewrites text elements using customized style blocks inside highly optimized Advanced SubStation Alpha (ASS) files.
5. **Session Logs and Local Database History:** Employs an embedded SQLite database (`rusqlite`) and session logs to persist file processing statuses, preventing redundant workloads across user sessions and providing accurate system outputs to the UI.
