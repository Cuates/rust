# MKV Filter Metadata

[![Maintained? yes](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://GitHub.com/Cuates/rust/graphs/commit-activity)
[![MKV Filter Metadata CI](https://github.com/Cuates/rust/actions/workflows/mkv-filter-metadata-ci.yml/badge.svg)](https://github.com/Cuates/rust/actions/workflows/mkv-filter-metadata-ci.yml)
[![Version](https://img.shields.io/badge/version-1.1.11-blue.svg)](https://github.com/Cuates/rust)
[![Made with Rust](https://img.shields.io/badge/Made%20with-Rust-1f425f.svg)](https://www.rust-lang.org/)
[![Made with Svelte](https://img.shields.io/badge/Made%20with-Svelte-FF3E00.svg)](https://svelte.dev/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8D8.svg)](https://tauri.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A powerful batch-processing desktop application for filtering MKV metadata, stripping unwanted subtitle/audio tracks, and optionally re-encoding video files with hardware-accelerated codecs. Built with **Tauri v2**, **Svelte 5**, and **Rust**.

---

## Table of Contents

1. [Features](#features)
2. [Architecture Overview](#architecture-overview)
3. [Prerequisites](#prerequisites)
4. [Getting Started](#getting-started)
5. [Tree Structure](#tree-structure)
6. [Developer Commands](#developer-commands)
7. [Application Usage](#application-usage)
8. [Backend Pipeline Details](#backend-pipeline-details)
9. [Frontend Component Architecture](#frontend-component-architecture)
10. [Configuration & Capabilities](#configuration--capabilities)
11. [Building for Production](#building-for-production)
12. [Testing the CI Pipeline](#testing-the-ci-pipeline)
13. [Troubleshooting & Common Pitfalls](#troubleshooting--common-pitfalls)

---

## Features

### Processing Engine
- **Dual Conversion Modes:** Remux (stream copy — fast, lossless) or Reencode (full transcode with codec/preset/CRF control).
- **Hardware-Accelerated Encoding:** Auto-detects NVENC (NVIDIA), AMF (AMD), QSV (Intel), and VideoToolbox (macOS) at startup. The UI dynamically shows only available encoders.
- **Dynamic Encoder Presets:** Preset dropdowns adapt per-encoder (e.g., `p1`–`p7` for NVENC, `speed`/`balanced`/`quality` for AMF, `ultrafast`–`veryslow` for software x264/x265).
- **Subtitle Track Filtering:** Keep only specified subtitle languages (ISO 639 codes). FFprobe inspects each file's streams and maps only matching tracks.
- **Self-Healing Fallback:** If FFmpeg rejects subtitle codecs for a target container, the pipeline automatically retries with ASS subtitle conversion — no user intervention needed.
- **Output Deduplication:** Prevents silent overwrites when multiple input files would produce the same output filename.

### User Interface
- **Multi-Directory Processing Queue:** Drag-and-drop or browse to add multiple directories. Reorder via drag. Per-row status indicators (pending → processing → done/error).
- **Real-Time Pipeline Telemetry:** Live progress bars (overall + per-file), OS taskbar progress indicator, running timer, and ETA estimation.
- **Storage Savings Metrics:** After completion, displays original vs. output size with percentage saved.
- **Streaming Terminal Log:** Real-time FFmpeg output with auto-scroll, copy-to-clipboard, and save-to-file.
- **Session Resumption:** Tracks completed files in a local SQLite database (path, size, modified time) — re-running a batch skips unchanged files even across restarts, and re-processes any file that was modified. You can view the record count and clear the history from the Settings page.
- **UI Theme Configuration:** 3-way toggle (System/Light/Dark) with smooth CSS transitions, OS system preference tracking, and localStorage persistence.
- **Per-Row Open Output Folder:** One-click button to open the `processed_files` directory in your file explorer after processing.
- **OS Notifications:** Native desktop notification when the entire pipeline completes (can be disabled in Settings).
- **Toast Notification System:** In-app toast messages with auto-dismiss and severity levels (success, warning, error, info).
- **Abort & Cleanup:** Stop execution mid-pipeline. The backend kills active FFmpeg processes and scrubs partially written output files and empty directories.
- **Directory Stats Tooltips:** Hover over queued directories to see file counts, names, and total sizes.
- **About Modal:** Displays application version, commit hash, build date, and dependency versions with quick links to the repository and changelog.

### Code Quality
- **Type-Safe End-to-End:** Rust enums for `VideoCodec`, `ConversionMode`, and `Preset` serialize directly into Svelte via Zod runtime validation schemas.
- **Svelte 5 Runes:** Modern reactive state management with `$state`, `$derived`, and `$effect` — no legacy stores.
- **Structured Logging:** Rust `tracing` integration with environment-configurable log levels.
- **Session Logging:** All pipeline output is persisted to a structured log file for post-run analysis.
- **ARIA Accessibility:** Screen reader support with `aria-live` regions on the terminal and metrics panels.

---

## Architecture Overview

```text
┌────────────────────────────────────────────────────────────┐
│                    Tauri v2 Runtime                         │
│                                                            │
│  ┌─────────────────────┐    ┌────────────────────────────┐ │
│  │   Frontend (Svelte) │    │    Backend (Rust)           │ │
│  │                     │    │                            │ │
│  │  +page.svelte       │◄──►│  commands.rs (IPC handlers)│ │
│  │  DirectoryQueue     │    │  process.rs  (FFmpeg logic) │ │
│  │  ConfigPanel        │    │  models.rs   (Type defs)   │ │
│  │  MetricsPanel       │    │  error.rs    (Error types)  │ │
│  │  TerminalLog        │    │  lib.rs      (Plugin init) │ │
│  │  ToastContainer     │    │                            │ │
│  │                     │    │  Sidecars:                  │ │
│  │  Stores:            │    │    ffmpeg, ffprobe,         │ │
│  │    config.svelte.ts │    │    mkvmerge                 │ │
│  │    pipeline.svelte  │    │                            │ │
│  │    toast.svelte.ts  │    │  Capabilities:             │ │
│  │                     │    │    default.json             │ │
│  └─────────────────────┘    └────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

The frontend communicates with the backend exclusively through Tauri's `invoke` (request/response) and `emit`/`listen` (event streaming) IPC bridges. There are no HTTP APIs or WebSocket servers.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | v24+ | Required for Vite/SvelteKit |
| **pnpm** | v9+ | Workspace package manager |
| **Rust** | 1.85+ (Edition 2024) | Via `rustup` |
| **Rust Components** | `clippy`, `rustfmt` | `rustup component add clippy rustfmt` |
| **OS Build Tools** | — | See below |

**OS-Specific Build Tools:**
- **Windows:** Visual Studio C++ Build Tools
- **macOS:** Xcode Command Line Tools
- **Linux:** `build-essential`, `curl`, `wget`, `file`, `libssl-dev`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`

---

## Getting Started

```bash
# 1. Clone the repository
git clone <repo-url>
cd mkv-filter-metadata

# 2. Install Node dependencies
pnpm install

# 3. Download sidecar binaries (FFmpeg, FFprobe, MKVMerge)
pnpm prebuild

# 4. Launch the development environment
pnpm dev
```

This starts Vite's dev server on `http://localhost:1420` and compiles + launches the Tauri native window simultaneously.

---

## Tree Structure

```text
mkv-filter-metadata/
├── package.json                  # Root workspace orchestrator scripts
├── pnpm-workspace.yaml           # Monorepo boundary (frontend only)
├── README.md                     # This file
├── CHANGELOG.md                  # Version history
├── CONTRIBUTING.md               # Contribution guidelines
├── LICENSE                       # MIT License
├── TESTING.md                    # Testing strategy and guidelines
├── scripts/                      # Build helper scripts
│   ├── download-sidecars.mjs     # Fetches sidecars and validates checksums
│   └── generate-hashes.mjs       # Generates SHA-256 checksums for new binary releases
│
├── frontend/                     # Svelte 5 + SvelteKit + Vite UI Layer
│   ├── package.json              # UI deps, test/lint/format scripts
│   ├── svelte.config.js          # SvelteKit adapter configuration
│   ├── vite.config.js            # Vite bundler with custom logger
│   ├── tsconfig.json             # TypeScript compiler options
│   ├── eslint.config.js          # ESLint flat config (Svelte + TS)
│   ├── .prettierrc               # Prettier formatting rules
│   └── src/
│       ├── routes/
│       │   ├── +layout.svelte    # Global layout wrapper and font imports
│       │   ├── +page.svelte      # Main application view & event orchestration
│       │   ├── guide/
│       │   │   └── +page.svelte  # "How To Use" documentation page
│       │   └── settings/
│       │       └── +page.svelte  # Configuration, performance, and history management
│       ├── lib/
│       │   ├── types.ts          # Zod schemas & TypeScript type definitions
│       │   ├── components/
│       │   │   ├── AboutModal.svelte       # App version & dependency info modal
│       │   │   ├── ConfigPanel.svelte      # Encoder/preset/CRF controls
│       │   │   ├── ConfirmationModal.svelte# Accessible generic confirmation dialog
│       │   │   ├── DirectoryQueue.svelte   # Multi-dir queue with drag-reorder
│       │   │   ├── MetricsPanel.svelte     # Progress bars, timer, ETA, storage
│       │   │   ├── TerminalLog.svelte      # Streaming FFmpeg output log
│       │   │   └── ToastContainer.svelte   # Toast notification system
│       │   ├── stores/
│       │   │   ├── config.svelte.ts        # App config & UI state (runes)
│       │   │   ├── pipeline.svelte.ts      # Pipeline telemetry state (runes)
│       │   │   ├── shortcuts.svelte.ts     # Keyboard shortcuts state (runes)
│       │   │   └── toast.svelte.ts         # Toast queue state (runes)
│       │   └── utils/
│       │       └── formatters.ts           # Byte/duration formatting utilities
│       └── styles/
│           └── app.scss          # Global styles, theming, CSS variables
│
└── backend/                      # Rust + Tauri v2 Native System Layer
    ├── Cargo.toml                # Rust dependencies
    ├── tauri.conf.json           # Window, plugins, bundle, security config
    ├── capabilities/
    │   └── default.json          # Tauri v2 permission scopes
    ├── sidecars/                 # Target-suffixed binaries (FFmpeg/FFprobe/MKVMerge)
    └── src/
        ├── main.rs               # Tauri application entry point
        ├── lib.rs                # Plugin registration & invoke handler setup
        ├── commands.rs           # All #[tauri::command] IPC handlers
        ├── constants.rs          # Shared IPC and event strings
        ├── process.rs            # FFmpeg pipeline, codec logic, arg builders
        ├── history.rs            # SQLite processing database operations
        ├── models.rs             # Rust type definitions (enums, structs, state)
        └── error.rs              # Custom error types with thiserror
```

---

## Developer Commands

All commands are run from the workspace root:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Launch Vite dev server + Tauri window in parallel |
| `pnpm build` | Production build (frontend bundle + Rust release binary) |
| `pnpm check` | Type-check both Svelte (svelte-check) and Rust (cargo check) |
| `pnpm fix` | Auto-fix lint + format issues across both frontend and backend |
| `pnpm test` | Run Vitest (frontend) and cargo test (backend) |
| `pnpm test:coverage` | Generate coverage reports for both layers |
| `pnpm audit` | Security audit for npm and Cargo dependencies |
| `pnpm clean` | Deep clean: wipe node_modules, Cargo target, then reinstall |
| `pnpm prebuild` | Download sidecar binaries for your platform |
| `pnpm app-info` | Print Tauri environment diagnostics |

---

## Application Usage

1. **Add Directories:** Click "+ Add Folder to Queue" or drag-and-drop folders onto the window. Multiple directories can be queued and reordered.
2. **Configure Processing:**
   - **Conversion Mode:** Choose "Remux Processing" (fast stream copy) or "Reencode Processing" (full transcode).
   - **File Extensions Filter:** Comma-separated list of extensions to process (e.g., `mkv, mp4, mov, avi`).
   - **Subtitle Tracks to Keep:** Comma-separated ISO 639 language codes (e.g., `eng, spa, und`).
   - **Video Encoder:** Select from available hardware/software encoders (auto-detected at launch).
   - **Encoder Preset:** Quality/speed tradeoff (adapts to selected encoder).
   - **CRF:** Constant Rate Factor for quality control (0–51, lower = better quality).
3. **Start Processing:** Click "Start Processing". The pipeline scans all queued directories, filters files by extension, and processes files concurrently (configurable in Settings: 1-8 re-encode workers, 1-8 remux workers).
4. **Monitor Progress:** Watch real-time progress bars, ETA, and streaming FFmpeg output in the terminal log.
5. **Output Location:** Processed files are written to a `processed_files/` subdirectory within each source directory.
6. **Open Results:** After completion, click the folder icon on any queue row to open its output directory.

---

## Backend Pipeline Details

### Processing Flow

```
Input Directory
  → Walk directory tree (recursive)
  → Filter by file extension
  → For each file:
      → FFprobe: inspect streams, identify subtitle tracks by language
      → Build FFmpeg command (maps, codecs, presets)
      → Execute FFmpeg via sidecar
      → Stream stderr for progress parsing
      → On subtitle incompatibility → auto-retry with ASS conversion
      → On success → emit progress event to frontend
      → On failure → log error, continue to next file
  → Emit completion summary with storage metrics
```

### Abort & Cleanup Protocol

When the user clicks "Stop Execution" or closes the window mid-pipeline:
1. The `is_aborted` atomic flag is set.
2. The active FFmpeg child process is forcefully killed.
3. The partially written output file is deleted from disk.
4. Empty `processed_files/` directories are removed.

### Supported Video Encoders

| Encoder | Hardware | Presets |
|---------|----------|---------|
| `libx264` | CPU (Software) | ultrafast → veryslow |
| `libx265` | CPU (Software) | ultrafast → veryslow |
| `hevc_nvenc` | NVIDIA GPU | p1 → p7 |
| `h264_nvenc` | NVIDIA GPU | p1 → p7 |
| `av1_nvenc` | NVIDIA GPU | p1 → p7 |
| `hevc_amf` | AMD GPU | speed, balanced, quality |
| `h264_amf` | AMD GPU | speed, balanced, quality |
| `av1_amf` | AMD GPU | speed, balanced, quality |
| `hevc_qsv` | Intel iGPU | (default) |
| `h264_qsv` | Intel iGPU | (default) |
| `av1_qsv` | Intel iGPU | (default) |
| `hevc_videotoolbox` | Apple Silicon | (default) |
| `h264_videotoolbox` | Apple Silicon | (default) |
| `av1_videotoolbox` | Apple Silicon | (default) |

---

## Frontend Component Architecture

| Component | Responsibility |
|-----------|---------------|
| **`+page.svelte`** | Root orchestrator: mounts all components, manages Tauri event listeners, timer logic, theme toggling, and the processing lifecycle |
| **`DirectoryQueue.svelte`** | Multi-directory queue with drag-and-drop reorder, per-row status badges, directory stats tooltips, open-folder actions, and file-drop handling |
| **`ConfigPanel.svelte`** | Conversion mode, file extension filter, subtitle filter, encoder/preset/CRF selection with dynamic hardware detection |
| **`MetricsPanel.svelte`** | Overall progress bar, per-file progress bar, total conversion time, ETA, and storage savings display |
| **`TerminalLog.svelte`** | Streaming FFmpeg log output with auto-scroll, copy-to-clipboard, and save-to-file |
| **`ToastContainer.svelte`** | Stacked toast notifications with auto-dismiss, severity-based styling, and XSS-safe rendering |

### State Management (Svelte 5 Runes)

| Store | Purpose |
|-------|---------|
| `config.svelte.ts` | Input directories, encoder settings, UI state (theme, hardware capabilities) |
| `pipeline.svelte.ts` | Processing telemetry: progress, file index, timer, ETA, log buffer, directory statuses |
| `toast.svelte.ts` | Toast notification queue with add/dismiss helpers |

---

## Configuration & Capabilities

### `backend/tauri.conf.json`

Defines the application window, CSP security policy, sidecar binaries, bundle targets, and plugin configuration.

### `backend/capabilities/default.json`

Tauri v2's capability-based security model. The application requests only the permissions it needs:
- `core:default` — Basic Tauri runtime
- `dialog:allow-open`, `dialog:allow-save` — File/folder picker dialogs
- `shell:allow-execute` — Sidecar binary execution (FFmpeg, FFprobe, MKVMerge)
- `opener:default`, `opener:allow-open-path` — Open folders in file explorer
- `notification:default` — Native OS notifications
- `core:window:allow-close`, `core:window:allow-destroy`, `core:window:allow-set-theme` — Window management

---

## Building for Production

```bash
pnpm build
```

This will:
1. Bundle the Svelte frontend via Vite
2. Compile the Rust backend in release mode
3. Link sidecar binaries
4. Output platform-specific installers in `backend/target/release/bundle/`

Ensure your `tauri.conf.json` has a unique `identifier` (currently `com.cuates.mkv-filter-metadata-rust`).

> [!TIP]
> **CI / Slow Builds Note:** For faster CI/CD pipelines, set the environment variable `CARGO_PROFILE_RELEASE_LTO=false`. This disables Link-Time Optimization, sacrificing a small amount of binary performance for significantly faster compilation times during automated builds.

---

## Testing the CI Pipeline

Testing the GitHub Actions CI pipeline (`mkv-filter-metadata-ci.yml`) can be done in two ways:

### Method 1: Push to GitHub (Easiest)
1. Commit the new workflow file:
   ```bash
   git add .github/workflows/mkv-filter-metadata-ci.yml
   git commit -m "Add MKV Filter CI pipeline"
   ```
2. Push your changes to your remote repository (or open a Pull Request):
   ```bash
   git push origin main
   ```
3. Open your repository on GitHub in your browser and click on the **"Actions"** tab at the top to watch the workflow run.

### Method 2: Test Locally using `act` (Advanced/Faster)
If you don't want to push your code to GitHub, you can run GitHub Actions locally using [act](https://github.com/nektos/act) (Requires Docker Desktop to be running).

1. **Install `act`**:
   * Windows (Winget): `winget install nektos.act`
   * macOS (Homebrew): `brew install act`
2. Open your terminal in the root of your project directory (`mkv-filter-metadata`).
3. Run the pipeline by simulating a "push" event:
   ```bash
   act push
   ```
4. `act` will pull down a Docker container that mimics the `ubuntu-latest` GitHub runner and execute the `mkv-filter-metadata-ci.yml` steps locally.

---

## Troubleshooting & Common Pitfalls

| Problem | Solution |
|---------|----------|
| **"Cannot find project matching filter 'backend'"** | The backend is a Cargo crate, not a Node package. Use `--manifest-path backend/Cargo.toml` instead of `pnpm -F backend`. |
| **Vite port collision** | `strictPort: true` is set in `vite.config.js` to prevent silent port changes. Free port 1420 or update both Vite and `tauri.conf.json`. |
| **Sidecar execution failure** | Ensure binary filenames include your architecture triple (e.g., `ffmpeg-x86_64-pc-windows-msvc.exe`). |
| **`gen/schemas` showing as modified in git** | These are auto-generated by Tauri. Run `git rm --cached -r backend/gen/schemas` to untrack them. They are already in `.gitignore`. |
| **FFmpeg subtitle errors** | The self-healing fallback handles most cases automatically. If a container truly doesn't support any subtitle format, the file will be processed without subtitles. |
| **Package script name conflicts** | Root scripts avoid names that collide with pnpm internals (e.g., `app-info` instead of `info`). |
| **Silent crashes in production** | The release binary includes a panic hook. If the app spontaneously exits, check the bottom of `session.log` in your app data directory for a `[FATAL] PANIC:` message. |

---

## License

This project is licensed under the [MIT License](LICENSE).