# File Finder Rust - Project Log

## Context
Migration of `file_finder.py.txt` to a high-performance Rust/Svelte desktop app.

## Project Goals
- Replicate the recursive file search and JSON metadata generation of `file_finder.py.txt`.
- Provide a modern GUI using Tauri 2.0 and Svelte 5.

## Technical Parity
- **Search Logic**: Implemented recursive `WalkDir` with `glob` pattern matching to mirror Python's `fnmatch` behavior.
- **Data Structure**: Matches the `DirectoryResult` and `Metadata` JSON format precisely.
- **Configuration**: Supports custom extensions and exclusion patterns originally handled via CLI arguments.

## Architectural Decisions
- **Backend**: Rust (Tauri 2.0). Modular plugins enabled for `dialog` and `opener`.
- **Frontend**: Svelte 5. Using Runes (`$state`) for more efficient reactivity than legacy Svelte 4 stores.
- **Styling**: SCSS (External). Modular variables for theming.
- **Package Manager**: pnpm. Strict dependency resolution and approved builds for `@parcel/watcher`.

## Current Status
- **Backend**: Rust (Tauri 2.0) using `walkdir` and `BTreeMap` for ordered results.
- **Frontend**: Svelte 5 with integrated dark mode toggle, path validation, and live progress monitoring.
- **Parity**: Successfully replicated and improved upon `DirectoryResult` and `Metadata` structures.

## Build Instructions
1. `pnpm install`
2. `pnpm approve-builds`
3. `pnpm tauri dev`

## Remove and Clean Instructions
- Move into your apps root directory
1. `rm -r -Force node_modules, pnpm-lock.yaml`
2. `pnpm store prune`
3. `pnpm install`

## Completed Features
- **Recursive Search**: Implemented via Rust's `walkdir` crate.
- **Ordered JSON**: Migrated from `HashMap` to `BTreeMap` for alphanumeric subdirectory sorting; implemented recursive case-insensitive file sorting.
- **Exclusion Logic**: Supports wildcard glob patterns for directory and file exclusion.
- **Dark Mode UI**: High-contrast theme (#2D2D2D background) for all input fields and dynamic text coloring for results.
- **Manual Path Entry**: Support for copy-pasting or typing directory paths with automatic whitespace trimming.
- **Input Validation**: Backend validation checks if paths exist and are directories, returning descriptive errors to the UI.
- **Live Activity Monitor**: Real-time feedback showing "Directories Scanned" and "Files Matched" during execution using Tauri Emitters.
- **Indeterminate Progress**: Visual CSS-based sliding bar to indicate active processing for long-running searches.

## Technical Maintenance
- Replaced `HashMap` with `BTreeMap` in `main.rs` to guarantee alphanumeric JSON keys.
- Implemented `sort_all_files` post-processing to ensure alphanumeric file order.
- Added `!important` CSS overrides to ensure theme persistence across all browser defaults.
- Implemented event-throttling (modulo 100) in Rust to prevent UI lag during high-frequency progress updates.

## Evolution
- Migrated `file_finder.py` logic to Rust/Svelte.
- Replaced Python `tqdm` with a custom Svelte Indeterminate Activity Monitor.
- Enhanced JSON output with deterministic alphanumeric sorting for better diffing and readability.
- Added robust error handling for "path not found" scenarios common with manual input.