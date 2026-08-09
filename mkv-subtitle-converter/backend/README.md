# Backend Native Layer (Tauri 2.0 & Rust)

The file system processing pipeline logic is fully managed inside `backend/src/lib.rs`. It provides multi-threaded processing optimizations, safe cancel state handling, and a custom raw-text SubRip to ASS transcoding layout engine.

## Essential Operations Performed Natively

1. **Sidecar Verification Phase:** Fires asynchronous internal validation checks targeting embedded binary locations to extract structural runtime parameters (`ffmpeg -version`).
2. **Layout Parsing Structure:** Uses `ffprobe` sidecars to scan targets, fetch track maps, and isolate binary layout properties (`default_flag`, `forced_flag`).
3. **Async Subprocess Spawn:** Launches independent `ffmpeg` extraction sub-routines mapped inside Tokio tasks.
4. **Rust Transcoding Core Engine:** Parses raw time markers out of SRT logs via standard buffers and structurally rewrites text elements using customized style blocks inside highly optimized Advanced SubStation Alpha (ASS) files.
5. **Session Logs and Local Database History:** Employs an embedded SQLite database (`rusqlite`) and session logs to persist file processing statuses, preventing redundant workloads across user sessions and providing accurate system outputs to the UI.

## Module Structure

| Module         | Responsibility                                                                          |
| -------------- | --------------------------------------------------------------------------------------- |
| `lib.rs`       | Tauri builder setup, plugin registration, and application lifecycle management.         |
| `commands.rs`  | All `#[tauri::command]` IPC definitions exposed to the frontend.                        |
| `process.rs`   | Core async MKV scanning, ffprobe/ffmpeg orchestration, and SRT → ASS transcoding logic. |
| `models.rs`    | Data structs and enums, all annotated with `#[derive(specta::Type)]` for type export.   |
| `history.rs`   | SQLite-backed processing history — tracks which files have already been converted.      |
| `error.rs`     | Unified `AppError` type using `thiserror`.                                              |

## IPC Type Generation

This backend exports its data models to the frontend as Zod schemas using [`specta`](https://github.com/oscartbeaumont/specta) + [`specta-zod`](https://crates.io/crates/specta-zod).

The generator binary lives at `backend/src/bin/export_zod.rs`. It is run via:

```bash
pnpm run generate:types
```

This writes `frontend/src/lib/types/ipc.ts`. **Never edit `ipc.ts` manually.** The CI pipeline enforces this by running `git diff --exit-code` after regeneration on every PR.

### Adding a New IPC Type

1. Define your struct in `backend/src/models.rs`.
2. Add `#[derive(serde::Serialize, serde::Deserialize, specta::Type)]` to the struct.
3. Register it in `export_zod.rs` via `builder.register_mut::<YourType>()`.
4. Run `pnpm run generate:types` and commit `frontend/src/lib/types/ipc.ts`.

## Key Dependencies

| Crate                  | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `tauri`                | Core desktop runtime, IPC bridge, and plugin system.           |
| `tokio`                | Async runtime (multi-thread, sync, time, fs subsystems only).  |
| `tokio-util`           | `CancellationToken` for cooperative task cancellation.         |
| `serde` / `serde_json` | Serialization for IPC payloads and JSON report files.          |
| `rusqlite`             | Bundled SQLite for persistent conversion history.              |
| `walkdir`              | Recursive filesystem directory traversal.                      |
| `regex`                | SRT timestamp and HTML tag parsing.                            |
| `tracing`              | Structured logging to session log files.                       |
| `thiserror`            | Ergonomic error type derivation.                               |
| `specta`               | Derive `Type` on models for cross-language type export.        |
| `specta-zod`           | Render `specta` type registry as Zod TypeScript schemas.       |
| `specta-serde`         | Serde format integration for `specta` schema rendering.        |
