# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.6] - 2026-06-15

### Changed
- Converted `vite.config.js` to TypeScript (`vite.config.ts`) to provide 100% type safety and eliminate `// @ts-nocheck` suppressions.

### Fixed
- Fixed an event bubbling bug where `onkeydown={(e) => e.stopPropagation()}` was incorrectly intercepting keyboard events in the modal card, breaking focus traps and keyboard dismissal.
- Implemented full WAI-ARIA compliance and keyboard accessibility (Tab focus trapping, Escape dismissal) for the Confirmation Modal, matching the About Modal.
- Added comprehensive unit tests for `ConfirmationModal.svelte` covering all keyboard navigation behaviors, restoring branch test coverage.

## [1.1.5] - 2026-06-15

### Changed
- Removed unused ESLint inline suppressions across Svelte components in favor of a single global rule.
- Cleaned up unused TypeScript suppressions (`@ts-expect-error`) in frontend test files.

## [1.1.4] - 2026-06-14

### Changed
- Resolved `clippy::too_many_arguments` warnings in backend `commands.rs` by refactoring function arguments into `ProcessFileContext` and `RetryAssContext` structs.

## [1.1.3] - 2026-06-14

### Added
- Added a production panic hook to the Rust backend that synchronously flushes fatal crash errors to `session.log` before the application aborts.

### Changed
- Disabled Link-Time Optimization (LTO) in the GitHub Actions CI pipeline via `CARGO_PROFILE_RELEASE_LTO=false` to significantly speed up remote builds.
- Refactored the CI workflow to chain the `test` and `build` jobs behind the `lint` job using `needs: [lint]`, preventing redundant job failures and saving runner minutes.

## [1.1.2] - 2026-06-14

### Changed
- Added comprehensive backend Rust optimizations including `opt-level = 3`, `lto = true`, and stripped release binaries for maximum execution speed and reduced bundle size.
- Configured Vite production builds to automatically drop all `console` and `debugger` outputs to keep frontend bundles lean.
- Completely restructured the GitHub Actions CI pipeline to run Lint, Test, and Build jobs in parallel, and added `Swatinem/rust-cache@v2` for drastically reduced compilation times.

## [1.1.1] - 2026-06-14

### Added
- Added a dedicated "How To Use" Guide page providing explicit instructions on queue management, conversion modes, and interpreting output logs.
- Added a Guide navigation help icon to the dashboard header.

### Changed
- Clarified UI descriptions in the Settings page regarding concurrency parameters and their impact on the dashboard.
- Refined Guide documentation to accurately reflect UI button verbiage and integrated matching SVG icons into the text for better user comprehension.
- Suppressed strict SvelteKit navigation linting rules and added comprehensive test cases to restore 100% component branch coverage.

## [1.1.0] - 2026-06-14

### Added
- Added an opt-in "Save Queue List Between Sessions" global application setting to persist target directories across reboots.

### Changed
- Relocated "Recursive Directory Scanning" and the new "Save Queue List Between Sessions" toggles out of the active conversion panel and into the dedicated Settings page for better UX organization.

## [1.0.2] - 2026-06-14

### Added
- Implemented CI caching for Sidecar binaries and PNPM dependencies to significantly improve build speeds.

### Changed
- Centralized `toggleTheme` functionality in the Svelte frontend to reduce redundancy.
- Improved frontend accessibility with focus trapping in the About Modal.
- Simplified backend codebase by removing the redundant `is_aborted` state flag in favor of relying entirely on `CancellationToken`.

### Fixed
- Fixed an issue where the About Modal would inaccurately display "(today)" for previous day builds. It now displays the exact build date.
- Fixed About Modal displaying "Loading..." instead of the exact version numbers for sidecar dependencies.
- Resolved Svelte strict compiler warnings for tabindex and click-events-have-key-events.

## [1.0.1] - 2026-06-13

### Fixed
- Fixed TerminalLog scrollbar visibility issue by constraining the terminal container height.
- Restored main window vertical scrollability.
- Fixed Storage Saved metric color coding to visually indicate positive/negative space savings dynamically.
- Removed deprecated WebdriverIO configurations from Knip.

## [1.0.0] - 2026-06-13

### Changed
- Promoted application to version 1.0.0.
- Updated main dashboard and settings page layouts to ensure fixed headers with scrollable content areas.
- Added About modal with version, dependency information, and dynamically configured GitHub links.
- Fixed dark mode and light mode contrast for top navigation icon buttons.

## [0.2.5] - 2026-06-13

### Refactored
- DRY refactoring across backend and frontend code to abstract `process_one_file` logic (validation, DB history, ASS retries, mkvmerge fallbacks) into independent, specialized helper functions.
- Centralized repetitive terminal auto-scrolling boilerplate in the Svelte components.

## [0.2.4] - 2026-06-13

### Changed
- Extracted magic strings (Tauri IPC commands and custom event names) into shared constants to improve maintainability and typo-resistance.

## [0.2.3] - 2026-06-13

### Removed
- Dead code cleanup: removed unused Tauri dependencies (`@tauri-apps/plugin-fs`, `@tauri-apps/plugin-opener`, `@tauri-apps/plugin-shell`) and `@eslint/compat` from frontend `package.json`.
- Dead code cleanup: removed unused exports and types in `types.ts`, `config.svelte.ts`, and `shortcuts.svelte.ts`.
- Added CI step and root script `check:deadcode` to automatically verify against frontend and backend dead code in future commits.

## [0.2.2] - 2026-06-13

### Documentation
- Updated `scripts/download-sidecars.mjs` to add explanatory comments for the `mkvmerge` universal binaries.
- Fortified `scripts/generate-hashes.mjs` to preserve the explanatory comments seamlessly during hash generation.

## [0.2.1] - 2026-06-13

### Fixed
- Enforced maximum concurrency limit of 2 in the UI when using software encoders (`libx264`, `libx265`).
- Resolved an `optimizeDeps` Vite development bug that caused `pnpm dev` to fail due to Svelte 5 syntax incompatible with old targets.

### Documentation
- Updated `download-sidecars.mjs` and added a `README.md` to `scripts/` detailing exactly how and when to update the checksum hashes.

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
