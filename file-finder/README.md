# File Finder Rust (Tauri + Svelte)

## Project Overview
A cross-platform desktop evolution of the `file_finder.py.txt` script.
It provides a GUI for recursive file searching with JSON exports.

## Tech Stack
- **Backend:** Rust (Tauri) for high-performance file system traversal.
- **Frontend:** Svelte + TypeScript for a reactive, lightweight UI.
- **Styling:** SCSS (External) for modular, maintainable CSS.
- **Package Manager:** `pnpm`.

## Key Features (Legacy Parity)
- [x] Custom file type filtering.
- [x] Pattern-based exclusions (glob).
- [x] Real-time progress updates (replacing `tqdm`).
- [x] Tree-structured JSON output with alphanumeric sorting.

## Design Decisions
- **Rust Backend**: Replaces Python's `tqdm` and `pathlib` with `walkdir` and `BTreeMap` for near-instant, ordered traversal.
- **Svelte UI**: Replaces CLI arguments with reactive inputs and a native file picker.
- **Dark Mode Schema**: Uses #2D2D2D for input backgrounds and #FFFFFF for text to optimize readability and contrast.
- **JSON Structure**: Matches the schema defined in `file_finder.py.txt`, now with deterministic sorting for files and folders.

## Developer Commands
- `pnpm tauri dev`: Start development environment.
- `pnpm tauri build`: Generate cross-platform binaries.

## Update Log: 2026-05-03

### Alphanumeric Result Sorting
- Switched `DirectoryResult` from `HashMap` to `BTreeMap` to ensure subdirectories are sorted alphanumerically.
- Added a recursive file sorting function to ensure all matching file lists are ordered case-insensitively.

### UI & Theming Improvements
- Implemented high-contrast dark mode schema for all input fields (Path, Extensions, Exclusions).
- Added dynamic CSS classes (`dark-theme-text` vs `light-theme-text`) to ensure result labels remain readable across themes.
- Refined UI reset logic: results now clear specifically when search inputs change, preventing premature UI clearing during active searches.

### Performance & Parity
- Rust's `WalkDir` continues to provide significantly faster traversal than Python's `pathlib.rglob`.
- Maintained exact JSON parity with `file_finder.py.txt` metadata while adding improved timestamp formatting.