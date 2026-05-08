# File Finder Rust (Tauri + Svelte)

## Project Overview
A cross-platform desktop evolution of the `file_finder.py.txt` script.
It provides a high-performance GUI for recursive file searching with structured JSON exports.

## Tech Stack
- **Backend:** Rust (Tauri 2.0) for high-performance file system traversal.
- **Frontend:** Svelte 5 + TypeScript for a reactive, lightweight UI using Runes.
- **Styling:** SCSS (External) for modular, maintainable CSS.
- **Package Manager:** `pnpm`.

## Key Features (Legacy Parity)
- [x] Custom file type filtering.
- [x] Pattern-based exclusions (glob).
- [x] Real-time progress updates (replacing `tqdm` with a live activity monitor).
- [x] Tree-structured JSON output with alphanumeric sorting.

## Design Decisions
- **Rust Backend**: Replaces Python's `tqdm` and `pathlib` with `walkdir` and `BTreeMap` for near-instant, ordered traversal.
- **Svelte UI**: Replaces CLI arguments with reactive inputs, a native file picker, and manual copy-paste path support.
- **Dark Mode Schema**: Uses #2D2D2D for input backgrounds and #FFFFFF for text to optimize readability and contrast.
- **Live Monitoring**: Uses Tauri's event emission system to stream "Folders Scanned" and "Files Found" counts to the UI without blocking the main search thread.

## Developer Commands
- `pnpm tauri dev`: Start development environment.
- `pnpm tauri build`: Generate cross-platform binaries.

## Update Log: 2026-05-08

### Path Validation & Manual Entry
- Added support for manual path entry (copy/paste).
- Implemented robust error catching for invalid or non-existent paths.
- Added `input-error` visual states to the UI to highlight validation failures.

### Indeterminate Activity Monitor
- Replaced the simple static spinner with a live monitor bar.
- Shows real-time counts of `Directories Scanned` and `Matching Files Found`.
- Added an indeterminate CSS animation to indicate the app is active during deep file system crawls.

### Performance & UI Polish
- Rust backend now throttles progress events to ensure the UI remains responsive even when scanning millions of files.
- Refined UI layout to accommodate live statistics below the primary action button.
- Cleaned up JSON export logic to handle cross-platform path delimiters (Windows/Unix) more gracefully when generating default filenames.