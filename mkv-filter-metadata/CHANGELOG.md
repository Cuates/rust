# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-12

### Added
- **Parallel file processing** (JoinSet + Semaphore, configurable concurrency).
- **SQLite-backed processing history** with WAL mode + schema versioning.
- **Settings page** for shortcuts, performance/concurrency tuning, and reset-to-defaults.
- **Configurable keyboard shortcuts** (default `Shift+Enter` / `Escape`).
- **Recursive directory scanning toggle**.
- **Stale queued-directory detection** and auto-removal on launch.
- **Multi-directory processing queue** with drag-and-drop reorder and per-row status indicators.
- **Dual conversion modes:** Remux (stream copy) and Reencode (full transcode).
- **Hardware-accelerated encoder detection** — auto-detects NVENC, AMF, QSV, and VideoToolbox at startup.
- **Dynamic encoder presets** — preset dropdowns adapt per-encoder (p1–p7, speed/balanced/quality, ultrafast–veryslow).
- **Subtitle track filtering** via FFprobe stream inspection with BCP-47 language code matching.
- **Self-healing fallback** — auto-retries with ASS subtitle conversion on container incompatibility.
- **Real-time pipeline telemetry** — overall progress bar, per-file progress bar, running timer, and ETA estimation.
- **Storage savings metrics** — displays original vs. output size with percentage saved after completion.
- **Streaming terminal log** — live FFmpeg output with auto-scroll, copy-to-clipboard, and save-to-file.
- **Session resumption** — skips files whose output already exists from a prior aborted run.
- **Output filename deduplication** — prevents silent overwrites when inputs map to the same output name.
- **Per-row "Open Output Folder" button** — opens `processed_files/` directory in the file explorer.
- **OS desktop notifications** on pipeline completion via `tauri-plugin-notification`.
- **Toast notification system** with severity levels, auto-dismiss, and XSS-safe rendering.
- **Dark/light theme toggle** with system preference detection, localStorage persistence, and smooth CSS transitions.
- **Directory stats tooltips** — hover to see file counts, names, and total sizes.
- **Abort & cleanup protocol** — kills FFmpeg processes, scrubs partial outputs and empty directories.
- **Drag-and-drop directory import** — drop folders onto the window to add to queue.
- **Session logging** — all pipeline output persisted to a structured log file for post-run analysis.
- **Structured Rust logging** via `tracing` with environment-configurable log levels.
- **Zod runtime validation** — frontend validates all backend responses with typed schemas.
- **Vitest** frontend tests and **cargo test** backend tests.
- **ARIA accessibility** — `aria-live` regions on terminal and metrics panels for screen readers.
- **Tauri updater boilerplate** — plugin configuration for future auto-update support.
- **GitHub Actions CI pipeline** (`mkv-filter-metadata-ci.yml`) for automated building, linting, and testing.
- **CHANGELOG.md**, **CONTRIBUTING.md**, and **LICENSE** (MIT).

### Changed
- Migrated Rust backend to **Edition 2024**.
- Migrated state management to **Svelte 5 runes** (`$state`, `$derived`, `$effect`) — no legacy stores.
- Refactored backend into modular files: `commands.rs`, `process.rs`, `models.rs`, `error.rs`.
- Vite `customLogger` suppresses noisy Tauri-injected script warnings.
- Root `package.json` scripts unified: `pnpm fix`, `pnpm audit`, `pnpm test:coverage`.
- ETA display hides automatically when pipeline is not actively processing.
- Time values use monospace `tabular-nums` font to prevent layout jitter.

### Fixed
- Backend `Preset`, `ConversionMode`, and `VideoCodec` converted from fragile strings to type-safe Rust enums.
- Prevented identical filenames in input directories from overwriting a single output file.
- Prevented XSS vector in toast component `{@html}` tags.
- Fixed ETA dropping to "0ms" between file transitions by resetting intra-file progress on index change.
- Fixed `formatDuration` producing decimal milliseconds (e.g., `763.887ms`) by applying `Math.floor()`.
- Fixed "Open Folder" failing due to missing `tauri-plugin-opener` initialization and scope restrictions.
- Fixed time label/value vertical alignment misalignment in MetricsPanel.
