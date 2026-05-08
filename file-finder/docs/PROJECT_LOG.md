# File Finder Rust - Project Log

## Context
Migration of `file_finder.py` to a high-performance Rust/Svelte desktop app.

## Project Goals
- Replicate the recursive file search and JSON metadata generation of `file_finder.py`.
- Provide a modern GUI using Tauri 2.0 and Svelte 5.
- Handle massive file systems (Millions of files) without memory crashes.

## Workspace Configuration
To prevent `node_modules`, `package.json`, and lockfiles from leaking into the user home directory, a `pnpm-workspace.yaml` was created in the root.

## Technical Parity
* **Search Logic**: Implemented recursive `WalkDir` with `glob` pattern matching to mirror Python's `fnmatch` behavior.
* **Data Structure**: Matches the `DirectoryResult` and `Metadata` JSON format precisely.
* **Configuration**: Supports custom extensions and exclusion patterns originally handled via CLI arguments.

## Architectural Decisions
* **Backend**: Rust (Tauri 2.0). Modular plugins enabled for `dialog` and `opener`.
* **Streaming Architecture**: Implemented `BufWriter` to stream JSON results directly to disk. This prevents the "String Length Limit" and "Out of Memory" errors common in JavaScript-heavy file managers.
* **Frontend**: Svelte 5. Using Runes (`$state`) for more efficient reactivity.
* **IPC Strategy**: Reduced IPC payload by 99% for large scans by returning only `Metadata` from Rust instead of the entire file tree.

## Current Status
* **Backend**: Rust (Tauri 2.0) using `walkdir`, `serde_json` streaming, and `BTreeMap` for ordered results.
* **Frontend**: Svelte 5 with "Save-First" workflow to support backend streaming. Fully responsive Dark/Light mode theme integration.

## Completed Features
* **Recursive Search**: Implemented via Rust's `walkdir` crate.
* **Direct-to-Disk Streaming**: Rust writes the JSON file directly using a buffered stream, bypassing Svelte/JavaScript memory limits.
* **Ordered JSON**: Migrated from `HashMap` to `BTreeMap` for alphanumeric subdirectory sorting; implemented recursive case-insensitive file sorting.
* **Exclusion Logic**: Supports wildcard glob patterns for directory and file exclusion.
* **Global Theme Engine**: Added a class-based theme switcher with `!important` color overrides to ensure text readability in both Light and Dark modes.
* **Live Activity Monitor**: Real-time feedback showing "Directories Scanned" and "Files Matched" with precise icon alignment and throttled progress updates.

## Technical Maintenance
* **Memory Management**: Ensured Svelte doesn't proxy the entire directory result tree; only metadata is kept in memory.
* **CSS Refactor**: Moved theme-specific text colors to the top level of `app.scss` to fix visibility issues in nested monitor components.
* **Event Throttling**: Rust emits progress every 100 entries (modulo 100) to ensure the UI remains responsive during high-speed scans.

## Evolution
* Migrated `file_finder.py` logic to Rust/Svelte.
* Optimized for "Millions of Files" by moving the save operation into the Rust backend during the scan phase.
* Enhanced the "Legacy Parity" by providing a visual progress bar and real-time statistics that were not available in the original CLI script.