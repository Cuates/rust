# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.3] - 2026-06-26

### Fixed

- **Dependencies**: Resolved vulnerabilities by updating the pnpm devEngines requirement.
- **CI Pipeline**: Separated test execution in `mkv-subtitle-converter-ci.yml` on macOS to fix `--nocapture` routing issue.
- **Backend Refactoring & Tests**: Extracted pure logic (like JSON and version string parsing) into testable functions (`parse_ffprobe_output` and `parse_sidecar_version`), decoupled from Tauri commands. Implemented state and integration tests using mocked Tauri setup to improve test coverage to ~21%. Fixed a macOS CI compilation error by updating `tauri::test::mock_context()` to conform to the new Tauri v2 API signature (passing a single `NoopAsset` argument instead of four arguments).

## [1.8.2] - 2026-06-25

### Fixed

- **CI Pipeline**: Added runner architecture to cache keys for macOS sidecars to prevent cache conflicts between Intel and ARM runners. Added a 20-minute timeout for macOS test runners. Removed `macos-13` (Intel) runner from the matrix due to excessive queue times on GitHub's free tier, relying on Apple Silicon (`macos-latest`) for macOS validations.
- **Testing**: Wrapped Rust integration tests with `tokio::time::timeout` and `tokio::task::spawn_blocking` to prevent test deadlocks and hanging.

## [1.8.1] - 2026-06-24

### Fixed

- **Testing**: Reverted Tauri `mock_builder` application instantiation in integration tests to prevent `WebView2Loader.dll` entrypoint load failures (`STATUS_ENTRYPOINT_NOT_FOUND`) on local Windows test runners.

## [1.8.0] - 2026-06-24

### Changed

- **Continuous Integration**: Added Windows and macOS testing jobs to the GitHub Actions CI pipeline.
- **Automated Testing**: Integrated `proptest` for property-based testing and added Tauri command integration tests.
- **Frontend Refinements**: Refactored component state reactivity and test assertions for improved stability.

## [1.7.1] - 2026-06-23

### Fixed

- **Performance**: Optimized the frontend app theme initialization which fixes the brief white flash that occurs on startup for OS users utilizing a light theme.
- **State Hygiene**: Added state guard against stale file sizes when the parent queue component rapidly unmounts or deletes queue items.
- **Accessibility**: Replaced deprecated `autofocus` attribute within modals and added semantic `aria-labelledby` attributes to report dialogs to ensure accurate context for screen readers. Restored focus properly on close to prevent users from losing their place in the queue list.
- **Test Coverage**: Added test coverage assertions for the "No Tracks" breakdown box within the metrics panel suite.

## [1.7.0] - 2026-06-22

### Added

- **Configurable Keyboard Shortcuts**: The keyboard shortcuts for moving folders up and down the queue (`Alt+ArrowUp` / `Alt+ArrowDown`) are now fully configurable via the Settings page.

### Changed

- **Smart Idempotent Retries**: Removed the "Retry Failed" button. Instead, clicking the main "Start Conversion" button now intelligently references the internal processing cache. It will automatically skip any files that were already successfully processed in the past, and seamlessly retry any new or previously failed files without manual selection.

## [1.6.0] - 2026-06-22

### Added

- **In-App Report Previews**: The successful file reports now list embedded metadata alongside filenames (Subtitle Language, Codec, and Track Name).
- **Per-Folder Progress Tracking**: A live `[ M / N files ]` badge now updates dynamically on folders as they process.
- **Retry Failed Files**: Added a "Retry Failed" button to queue items that failed, which seamlessly extracts the failed files and pushes them back into the active queue for a quick retry.

### Fixed

- **Paginated Log Export**: Fixed log exporting to properly capture and concatenate full session history (`session.2.log`, `session.1.log`, `session.log`).
- **SRT Parser Integrity**: Fixed an edge case where standalone numbers in subtitles were incorrectly parsed as timestamps, silently dropping dialogue lines.
- **Memory Accumulation**: Fixed an unbounded memory leak by ensuring `CommandChild` subprocess entries are actively removed from the tracker once they complete.

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
- **Overly Aggressive File Cleanup**: Changed the wildcard `.ass` deletion on cancellation to specifically track and remove only the output files created during the _current active session_.
- **Regex Panic Bug**: Extracted heavily used Regex compilation to a `std::sync::LazyLock` to avoid recompiling it hundreds of times per second and panicking.
- **Time String Parsing**: Fixed byte-index panics when parsing non-standard SRT timestamps by switching to semantic string splitting.
- **HTML Tag Leaking**: Automatically strips unsupported SRT HTML formatting tags (e.g. `<font>`) to prevent ASS rendering issues.
