# File Finder Rust (Tauri + Svelte)

## Project Overview
A cross-platform desktop evolution of the `file_finder.py.txt` script.
It provides a high-performance GUI for recursive file searching with structured JSON exports.

## Tech Stack
- **Backend:** Rust (Tauri 2.0) for high-performance file system traversal.
- **Frontend:** Svelte 5 + TypeScript for a reactive, lightweight UI using Runes.
- **Styling:** SCSS (External) for modular, maintainable CSS.
- **Package Manager:** `pnpm`.

## Data Flow & Architecture
The application utilizes an asynchronous bridge between the Rust Core and the Svelte Frontend:

1.  **Input Phase**: User enters a directory path (Browse or Paste). Frontend trims whitespace and clears previous results.
2.  **Request Phase**: Frontend invokes the `search_files` command. Rust validates if the path exists and is a directory.
3.  **Traversal Phase**:
    - Rust spawns a `WalkDir` iterator.
    - To prevent UI locking, Rust "emits" a `search-progress` event every 100 entries.
    - Svelte listens for these events to update the **Live Activity Monitor** stats.
4.  **Completion Phase**:
    - Rust returns the final `OutputData` structure.
    - Svelte triggers the native Save Dialog.
    - Rust writes the final JSON file only if a save path is provided.

## Key Features (Legacy Parity)
- [x] **High Speed**: Significantly faster than Python `rglob`.
- [x] **Path Validation**: Detects and displays invalid/missing directories immediately.
- [x] **Live Monitor**: Visual indeterminate progress and real-time file counters.
- [x] **Custom Filters**: Extension-based filtering and glob-pattern exclusions.
- [x] **Deterministic Output**: JSON keys and files are sorted alphanumerically for consistent diffing.

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