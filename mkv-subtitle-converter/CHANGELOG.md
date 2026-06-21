# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.1] - 2026-06-21

### Fixed
- **Performance**: Optimized the frontend's logging system, which drastically reduced the memory overhead and CPU usage that previously caused the UI testing suite to timeout during operations that emit high volume logs.

## [1.5.0] - 2026-06-20

### Added
- **Taskbar Progress Indicator**: The application now seamlessly mirrors the overall conversion progress directly to your OS taskbar/dock icon across Windows, macOS, and supported Linux environments. 

### Fixed
- **Timer Migration**: Moved the execution timer logic from local component state to the global pipeline store. The "Total Conversion Time" and "ETA" now properly persist in the background when navigating away from the queue page while a job is running.

## [1.3.0] - 2026-06-19

### Changed
- **Monorepo Synchronization**: Standardized configurations (SvelteKit, Vite, Prettier, ESLint, TSConfig) with the sibling `mkv-filter-metadata` project.
- **CI Pipeline**: Added `.github/workflows/mkv-subtitle-converter-ci.yml` for automated testing and linting across the monorepo.
- **Sidecar Scripts**: Aligned `download-sidecars.mjs` and `generate-hashes.mjs` with the metadata project, strictly isolating ffmpeg and ffprobe.
- **UI Architecture & Theming**: Pinned headers in the Dashboard, Settings, and Guide pages for independent content scrolling. Swapped tooltip colors to match the active UI theme and added dynamic text confirmations ("Copied!", "Saved!") to terminal actions with bounded edge alignments. 
- **Metrics Accuracy**: The Elapsed Time display now formally tracks and renders precise processing milliseconds instead of fuzzy rounding, utilizing a reactive font scaler to ensure long time sequences gracefully fit on a single line.

## [1.1.0] - 2026-06-19
### Added
- **Multi-folder Processing Queue**: Drag and drop or browse to add multiple folders for sequential batch processing.
- **Concurrent Processing System**: Extractor now processes up to 3 MKV files in parallel using Tokio's `JoinSet` and `Semaphore` for a massive performance boost.
- **Structured SQLite History**: Added `rusqlite` processing history to persist state across sessions and safely skip already converted files.
- **Detailed JSON Reports**: Generates per-folder `converted_files.json` and `failed_files.json` reports locally on completion for easy auditing.
- **Disk Logging**: Added `tracing` subscriber to persist a running `session.log` up to 10MB across restarts.
- **Recursive Scanning Option**: Users can optionally toggle scanning within all sub-directories.
- **Keyboard Shortcuts Registry**: Full keyboard navigation support (Ctrl+O, Ctrl+Enter, Esc, F1).
- **Zod IPC Payload Validation**: Added strong runtime validation to all Rust-to-Frontend events.
- **About Modal Enhancements**: Expanded modal to include app details, versioning, GitHub/Changelog/License links, and sidecar FFmpeg versions.
- **How To Use Guide**: Added a dedicated in-app guide page to walk users through directory management, queue persistence, and the SRT extraction process.

### Changed
- **Tauri Architecture Update**: Fully migrated backend commands and app setup to follow Tauri 2.x best practices with strict module separation (`commands.rs`, `process.rs`, `models.rs`, `history.rs`).
- **UI Rewrite**: Completely rewrote SvelteKit frontend using Svelte 5 Runes for highly responsive UI state management.
- **Terminal Log Interface**: Improved the terminal logs to feature a pinned header layout with quick-access export and copy log functions.
- **Keyboard Shortcuts Interface**: Updated the layout to use list-based rows with bottom borders and descriptions to match the main settings.
- **Window Management**: Implemented `visible: false` on startup and immediate `win.show()` to eliminate white-screen flashing.

### Fixed
- **Critical Resource Leak**: Sidecar processes are now explicitly tracked in memory and forcefully killed via `kill()` upon cancellation, preventing orphaned FFmpeg processes.
- **Event Loop Blocking**: Rewrote the window close handler to run asynchronously, fixing the issue where closing the application would freeze the OS native title bar.
- **Overly Aggressive File Cleanup**: Changed the wildcard `.ass` deletion on cancellation to specifically track and remove only the output files created during the *current active session*.
- **Regex Panic Bug**: Extracted heavily used Regex compilation to a `std::sync::LazyLock` to avoid recompiling it hundreds of times per second and panicking.
- **Time String Parsing**: Fixed byte-index panics when parsing non-standard SRT timestamps by switching to semantic string splitting.
- **HTML Tag Leaking**: Automatically strips unsupported SRT HTML formatting tags (e.g. `<font>`) to prevent ASS rendering issues.
