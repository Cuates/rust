# File Finder Rust (Tauri + Svelte)

## Project Overview
A cross-platform desktop evolution of the `file_finder.py` script.
It provides a high-performance GUI for recursive file searching with structured JSON exports.

## Tech Stack
- **Backend:** Rust (Tauri 2.0) for high-performance file system traversal.
- **Frontend:** Svelte 5 + TypeScript for a reactive, lightweight UI using Runes.
- **Styling:** SCSS (External) for modular, maintainable CSS.
- **Package Manager:** `pnpm`.

## Project Structure
```text
file-finder-rust/
├── src/                        # Frontend source code
│   ├── routes/                 # SvelteKit routing & pages
│   │   ├── +layout.svelte      # Global app shell & theme provider
│   │   ├── +layout.ts          # Disables SSR for Tauri compatibility
│   │   └── +page.svelte        # Main UI: search logic, state, and event listeners
│   ├── styles/
│   │   └── app.scss            # Modular SCSS: animations, themes, and layouts
│   └── lib/                    # Shared frontend utilities/components
├── src-tauri/                  # Rust backend source code
│   ├── src/
│   │   ├── lib.rs              # Logic Hub: search commands, streaming, and state
│   │   └── main.rs             # Entry point: minimal wrapper for the Tauri app
│   ├── capabilities/           # Security: defines plugin & window permissions
│   │   └── default.json        # Configures access to dialogs and filesystem
│   ├── Cargo.toml              # Rust manifest: defines crates like walkdir & serde
│   └── tauri.conf.json         # Tauri config: window specs, icons, and bundles
├── package.json                # Project scripts and Node.js dependencies
├── PROJECT_LOG.md              # Historical log of development and bug fixes
└── README.md                   # Project documentation and architectural overview
```

## Data Flow & Architecture (Enterprise Streaming)

The application utilizes a memory-efficient "Direct-to-Disk" streaming architecture:

1. **Input Phase**: User enters a directory path (Browse or Paste). Frontend trims whitespace and clears previous results.
2. **Save Intent Phase**: Unlike standard apps, the Save Dialog triggers **before** the scan. Svelte captures the target path.
3. **Traversal & Stream Phase**:
* Rust spawns a `WalkDir` iterator.
* **Streaming Writer**: Rust opens a `BufWriter` directly to the disk path.
* As files are found, they are organized in memory, but the final write bypasses the JavaScript string limits.
* Rust "emits" a `search-progress` event every 100 entries for the UI monitor.

4. **Completion Phase**:
* Rust finishes writing the file and returns **only** the `Metadata` object to Svelte.
* This prevents the frontend from crashing when handling datasets with millions of files.

## Key Features (Legacy Parity)

* [x] **Streaming Writes**: Handles millions of files without RAM exhaustion using `serde_json::to_writer_pretty`.
* [x] **High Speed**: Significantly faster than Python `rglob`.
* [x] **Path Validation**: Detects and displays invalid/missing directories immediately.
* [x] **Live Monitor**: Visual indeterminate progress and real-time file counters.
* [x] **Custom Filters**: Extension-based filtering and glob-pattern exclusions.
* [x] **Deterministic Output**: JSON keys and files are sorted alphanumerically for consistent diffing.
* [x] **Dynamic Theming**: Fully integrated Light/Dark mode including OS-level Title Bar synchronization and text visibility across all sections.

## Developer Commands

* `pnpm tauri dev`: Start development environment.
* `pnpm tauri build`: Generate cross-platform binaries.

## Update Log: 2026-05-09

### Architectural Refactor

* **Lib-Centric Design**: Migrated all core logic from `main.rs` to `lib.rs` to adhere to Tauri 2.0 modular standards and resolve "multiple definition" errors.
* **Save-First Workflow**: Finalized the architecture where the save location is determined before scanning begins, ensuring disk availability.

### UI & UX Refinement

* **Theme Persistence**: Fixed a bug where live monitor text remained dark in Dark Mode.
* **Title Bar Sync**: Integrated `set_window_theme` in the Rust backend to ensure the OS window frame switches along with the UI.
* **Visual Alignment**: Corrected the vertical alignment of emojis and count values in the status bar using flexbox centering.

### RAM Optimization

* Reduced Frontend memory footprint by returning only Metadata to the UI.
* The UI no longer holds a copy of the massive file tree, allowing for scans of entire server drives.