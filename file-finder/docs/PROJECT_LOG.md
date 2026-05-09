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

## OS-Specific Prerequisites & Build Guide

### 🪟 Windows

1. **System Requirements**: Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) and ensure "Desktop development with C++" is checked.
2. **Rust**: Install via [rustup.rs](https://rustup.rs/).
3. **Node**: Install Node.js and `npm install -g pnpm`.
4. **Build**:

* `pnpm install`
* `pnpm tauri build`

### 🍎 macOS

1. **System Requirements**: Install CLTools via `xcode-select --install`.
2. **Rust**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`.
3. **Build**:

* `pnpm install`
* `pnpm tauri build`

### 🐧 Linux (*nix)

1. **System Requirements**: Install system dependencies (Ubuntu/Debian example):
`sudo apt update && sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`
2. **Rust**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`.
3. **Build**:

* `pnpm install`
* `pnpm tauri build`

---

## Technical Parity

* **Search Logic**: Implemented recursive `WalkDir` with `glob` pattern matching to mirror Python's `fnmatch` behavior.
* **Data Structure**: Matches the `DirectoryResult` and `Metadata` JSON format precisely.
* **Configuration**: Supports custom extensions and exclusion patterns.

## Architectural Decisions

* **Backend Logic Hub**: Consolidated all commands and traversal logic into `lib.rs`. `main.rs` is now a minimal entry point.
* **Streaming Architecture**: Implemented `BufWriter` to stream JSON results directly to disk.
* **Frontend**: Svelte 5. Using Runes (`$state`) for more efficient reactivity.
* **IPC Strategy**: Reduced IPC payload by 99% for large scans by returning only `Metadata` from Rust.

## Current Status

* **Backend**: Rust (Tauri 2.0) using `walkdir`, `serde_json` streaming, and `BTreeMap` for ordered results.
* **Frontend**: Svelte 5 with "Save-First" workflow. Fully responsive Dark/Light mode theme integration.
* **Release**: Production build successful (2026-05-09). Refactored library structure to resolve linker conflicts.

## Build Instructions

### Development Mode

1. `pnpm install`
2. `pnpm approve-builds`
3. `pnpm tauri dev`

### Production Build (Current Environment: Windows)

1. `pnpm tauri build`
2. Binary located in: `src-tauri/target/release/`
3. Installers located in: `src-tauri/target/release/bundle/`

## Deployment Notes

* **Vite Configuration**: Successfully building SSR bundle for production.
* **Wix/Candle**: MSI bundling successfully configured and executed.
* **NSIS**: Setup.exe bundling successfully configured and executed.

## Remove and Clean Instructions

1. `rm -r -Force node_modules, pnpm-lock.yaml`
2. `pnpm store prune`
* *Note*: If `pnpm store prune` fails with `EPERM`, close VS Code and run the terminal as Administrator.
3. `cd .\src-tauri\`
4. `cargo clean`
5. `cd ..`
6. `pnpm install`

## Completed Features

* **Recursive Search**: Implemented via Rust's `walkdir` crate.
* **Direct-to-Disk Streaming**: Rust writes the JSON file directly using a buffered stream.
* **Ordered JSON**: Migrated from `HashMap` to `BTreeMap` for alphanumeric subdirectory sorting.
* **Exclusion Logic**: Supports wildcard glob patterns.
* **OS-Level Theme Sync**: Title bar follows UI theme changes (Light/Dark).
* **Live Activity Monitor**: Real-time feedback showing "Directories Scanned" and "Files Matched".

## Technical Maintenance

* **Linker Resolution**: Moved core logic and command definitions to `src-tauri/src/lib.rs` to fix `pnpm tauri dev` compilation failure caused by multiple symbol definitions.
* **Deterministic Sorting**: Replaced `HashMap` with `BTreeMap` in the Rust backend to guarantee alphanumeric JSON keys.
* **Memory Management**: Fixed potential memory leaks by ensuring Svelte doesn't proxy the entire directory result tree.

## Evolution

* Migrated `file_finder.py` logic to Rust/Svelte.
* Replaced Python `tqdm` with a custom Svelte Indeterminate Activity Monitor.
* Optimized for "Millions of Files" by moving the save operation into the Rust backend.