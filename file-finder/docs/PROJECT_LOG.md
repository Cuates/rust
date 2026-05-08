# File Finder Rust - Project Log

## Context
Migration of `file_finder.py` to a high-performance Rust/Svelte desktop app.

## Project Goals
- Replicate the recursive file search and JSON metadata generation of `file_finder.py`.
- Provide a modern GUI using Tauri 2.0 and Svelte 5.
- Handle massive file systems (Millions of files) without memory crashes.

## Project Creation & Setup
Steps taken to initialize the environment and dependencies:
1. `cd .\path\to\project`
2. `npm install -g pnpm`
3. `pnpm create tauri-app@latest`
* ✔ Choose which language to use for your frontend · TypeScript / JavaScript - (pnpm, yarn, npm, deno, bun)
* ✔ Choose your package manager · pnpm
* ✔ Choose your UI template · Svelte - (https://svelte.dev/)
* ✔ Choose your UI flavor · TypeScript
4. `pnpm add -D sass-embedded`
5. `pnpm approve-builds`
6. `pnpm add @tauri-apps/plugin-dialog @tauri-apps/plugin-opener @tauri-apps/api`
7. `pnpm tauri dev`

## Workspace Configuration
To prevent `node_modules`, `package.json`, and lockfiles from leaking into the user home directory, a `pnpm-workspace.yaml` was created in the root:
```yaml
packages:
  - '.'
allowBuilds:
  esbuild: true
```

## Technical Parity

* **Search Logic**: Implemented recursive `WalkDir` with `glob` pattern matching to mirror Python's `fnmatch` behavior.
* **Data Structure**: Matches the `DirectoryResult` and `Metadata` JSON format precisely.
* **Configuration**: Supports custom extensions and exclusion patterns originally handled via CLI arguments.

## Architectural Decisions

* **Backend**: Rust (Tauri 2.0). Modular plugins enabled for `dialog` and `opener`.
* **Streaming Architecture**: Implemented `BufWriter` to stream JSON results directly to disk. This prevents the "String Length Limit" and "Out of Memory" errors common in JavaScript-heavy file managers.
* **Frontend**: Svelte 5. Using Runes (`$state`) for more efficient reactivity.
* **IPC Strategy**: Reduced IPC payload by 99% for large scans by returning only `Metadata` from Rust instead of the entire file tree.
* **Package Manager**: pnpm. Strict dependency resolution and approved builds for `@parcel/watcher`.

## Current Status

* **Backend**: Rust (Tauri 2.0) using `walkdir`, `serde_json` streaming, and `BTreeMap` for ordered results.
* **Frontend**: Svelte 5 with "Save-First" workflow to support backend streaming. Fully responsive Dark/Light mode theme integration.
* **Parity**: Successfully replicated and improved upon `DirectoryResult` and `Metadata` structures.

## Build Instructions

1. `pnpm install`
2. `pnpm approve-builds`
3. `pnpm tauri dev`

## Remove and Clean Instructions

* Move into your apps root directory

1. `rm -r -Force node_modules, pnpm-lock.yaml`
2. `pnpm store prune`
3. `cd .\src-tauri\`
4. `cargo clean`
5. `cd ..`
6. `pnpm install`

## Completed Features

* **Recursive Search**: Implemented via Rust's `walkdir` crate.
* **Direct-to-Disk Streaming**: Rust writes the JSON file directly using a buffered stream, bypassing Svelte/JavaScript memory limits.
* **Ordered JSON**: Migrated from `HashMap` to `BTreeMap` for alphanumeric subdirectory sorting; implemented recursive case-insensitive file sorting.
* **Exclusion Logic**: Supports wildcard glob patterns for directory and file exclusion.
* **Dark Mode UI**: High-contrast theme (#2D2D2D background) with dynamic text coloring for results.
* **Input Validation**: Backend validation checks if paths exist and are directories, returning descriptive errors to the UI.
* **Live Activity Monitor**: Real-time feedback showing "Directories Scanned" and "Files Matched" during execution using Tauri Emitters.
* **Global Theme Engine**: Moved theme classes out of component scopes into the global SCSS layer to ensure 100% readability across all UI states (Search, Idle, Error).
* **Icon & Label Alignment**: Optimized the monitor bar layout using `align-items: center` to ensure icons and dynamic numbers share a perfectly horizontal baseline.

## Technical Maintenance

* Replaced `HashMap` with `BTreeMap` in `main.rs` to guarantee alphanumeric JSON keys.
* Implemented `sort_all_files` post-processing to ensure alphanumeric file order.
* Implemented event-throttling (modulo 100) in Rust to prevent UI lag during high-frequency progress updates.
* **Memory Management**: Fixed potential memory leaks by ensuring Svelte doesn't proxy the entire directory result tree.
* **CSS Refactor**: Migrated nested theme styles to a global hierarchy to prevent inheritance issues during Dark Mode toggle.

## Evolution

* Migrated `file_finder.py` logic to Rust/Svelte.
* Replaced Python `tqdm` with a custom Svelte Indeterminate Activity Monitor.
* Optimized for "Millions of Files" by moving the save operation into the Rust backend during the scan phase.