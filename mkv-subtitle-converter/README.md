# 🎬 MKV Subtitle Converter (Tauri v2 + SvelteKit Workspace)

[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/Cuates/rust/graphs/commit-activity)
[![CI Pipeline](https://github.com/Cuates/rust/actions/workflows/mkv-subtitle-converter-ci.yml/badge.svg)](https://github.com/Cuates/rust/actions/workflows/mkv-subtitle-converter-ci.yml)
[![Version](https://img.shields.io/badge/version-1.9.3-blue.svg)](https://github.com/Cuates/rust/tree/main/mkv-subtitle-converter)
[![Made with Rust](https://img.shields.io/badge/Made%20with-Rust-1f425f.svg)](https://www.rust-lang.org/)
[![Made with Svelte](https://img.shields.io/badge/Made%20with-Svelte-ff3e00.svg)](https://svelte.dev/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-24c8db.svg)](https://tauri.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A professional-grade, high-performance desktop utility designed to scan local directories, parse layout tracks inside multi-stream MKV video containers, and batch-extract embedded SubRip (SRT) files into highly formatted, custom-styled Advanced SubStation Alpha (ASS) subtitles.

Built on top of a highly optimized **pnpm monorepo workspace architecture**, the app cleanly splits its responsibilities across a reactive **Svelte 5 / SvelteKit** web-view frontend layout layer and a native **Tauri v2 / Rust** system execution backend layer. Crucially, the app ships completely self-contained by embedding cross-platform, static **FFmpeg** and **FFprobe** architecture sidecars, completely removing the requirement for users to have global dependencies installed on their operating systems.

---

## 📖 Documentation Directory

For in-depth documentation, please refer to the specific files below:

- [**Architecture & Tree Structure**](docs/architecture.md): Overview of the monorepo layout and workspace configurations.
- [**Frontend Layer (SvelteKit)**](frontend/README.md): Details on the reactive Svelte 5 frontend and IPC communication.
- [**Backend Layer (Rust)**](backend/README.md): Details on the Tauri backend and native operations.
- [**Building for Distribution**](docs/distribution.md): Instructions for compiling production releases.
- [**Troubleshooting**](docs/troubleshooting.md): Solutions to common errors and how to run the clean suite.
- [**Scaffolding Guide**](docs/scaffolding.md): A historical guide on how this workspace was initially configured from scratch.

---

## 1. Prerequisites

Before attempting to compile or run the application locally, ensure your developer machine fulfills the mandatory runtime environments and toolchain compilers required for Tauri v2 and Rust.

### Global Software Requirements

- **Node.js:** v20 LTS or higher recommended.
- **pnpm:** v8 or higher (Global installation: `npm install -g pnpm`).
- **Rust Toolchain:** Stable channel version via `rustup` (Includes `rustc`, `cargo`, and `cargo-clippy`).

### Operating System Build Pillars

- **Windows 11 / 10:** Install the **Visual Studio C++ Build Tools** through the official installer. Ensure the "Desktop development with C++" workload is selected.
- **macOS (Intel & Silicon):** Install the official command line development environment by executing `xcode-select --install` inside your terminal application.
- **Linux (\*nix Distros):** System-wide C-compilers and developer system packages for WebKit are mandatory. For Debian/Ubuntu distributions, execute the following block:

```bash
  sudo apt-get update && sudo apt-get install -y build-essential curl wget libssl-dev libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev textlive-fonts-recommended
```

---

## 2. Developer Commands

All administrative, runtime development, and pipeline compilation configurations must be invoked exclusively from the **root terminal directory**.

| Execution Command | Scope Strategy | Pipeline Processing Action                                                                                                       |
| ----------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`    | Workspace Root | Parses multi-package configuration trees and securely symlinks workspace dependencies.                                           |
| `pnpm dev`        | Workspace Root | Orchestrates the Svelte web views via Vite, handles Hot Module Reloading, and mounts the native Rust shell.                      |
| `pnpm build`      | Workspace Root | Enforces strict generation rules on frontend distributions, builds static structures, and compiles standalone platform binaries. |
| `pnpm clean`      | Workspace Root | Invokes atomic filesystem purges across all workspace scopes, wiping artifacts, caches, and modules cleanly.                     |
