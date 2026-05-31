# Tauri 2.0 + SvelteKit Monorepo Architecture Guide

Welcome to the definitive guide for this project's architecture. This document outlines the start-to-finish journey of setting up a strict Monorepo workspace separating a modern Svelte 5 (Frontend) environment from a Rust/Tauri 2.0 (Backend) native application layer, complete with bundled native sidecar executables.

Whether you are onboarding a new developer or rebuilding from scratch, follow these categorized steps carefully.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Tree Structure](#2-tree-structure)
3. [Monorepo Root Configurations](#3-monorepo-root-configurations)
4. [Developer Commands](#4-developer-commands)
5. [Base Directory Configuration](#5-base-directory-configuration)
6. [Running the Scaffolder](#6-running-the-scaffolder)
7. [Rearranging into a Monorepo Workspace Split](#7-rearranging-into-a-monorepo-workspace-split)
8. [Embedding Native Sidecars (FFmpeg & MKVMerge)](#8-embedding-native-sidecars-ffmpeg--mkvmerge)
9. [Initializing the Root Workspace Files](#9-initializing-the-root-workspace-files)
10. [Unified Workflow Orchestration](#10-unified-workflow-orchestration)
11. [Injecting the Global Tauri CLI & Approving Builds](#11-injecting-the-global-tauri-cli--approving-builds)
12. [Injecting Quality Tooling & Code Verification into Frontend](#12-injecting-quality-tooling--code-verification-into-frontend)
13. [Injecting Dependencies into the Backend Package](#13-injecting-dependencies-into-the-backend-package)
14. [Update Project Build Paths](#14-update-project-build-paths)
15. [Frontend Layout Layer (SvelteKit, Svelte 5 & Vite)](#15-frontend-layout-layer)
16. [Backend Native Layer (Tauri 2.0 & Rust)](#16-backend-native-layer)
17. [Building for Production / Distribution](#17-building-for-production--distribution)
18. [Troubleshooting & Common Pitfalls](#18-troubleshooting--common-pitfalls)
19. [Run the Clean Suite](#19-run-the-clean-suite)

---

## 1. Prerequisites

Before beginning, ensure your system has the required tooling installed:

* **Node.js** (v18+ recommended)
* **pnpm** (Required package manager for this workspace)
* **Rust & Cargo** (Installed via `rustup`)
* **Rust Components**: Ensure `clippy` and `rustfmt` are active:
  ```bash
  rustup component add clippy rustfmt
```

* **OS-Specific Build Tools**:
* *Windows*: Visual Studio C++ Build Tools.
* *macOS*: Xcode Command Line Tools.
* *Linux*: `build-essential`, `curl`, `wget`, `file`, `libssl-dev`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`

## 2. Tree Structure

This project strictly adheres to the following architecture:

```text
mkv-filter-metadata-rust/
├── package.json             # Root workspace engine commands
├── pnpm-workspace.yaml      # Monorepo boundary definition (Frontend UI only)
├── frontend/                # Svelte 5 + Vite Web UI Layer
│   ├── package.json         # UI scripts, dependencies, testing/lint configs
│   ├── eslint.config.js     # Linter rules
│   ├── .prettierrc          # Formatter configurations
│   ├── vite.config.ts
│   └── src/
└── backend/                 # Rust + Tauri Native System Layer
    ├── bin/                 # Target-suffixed Sidecar Binaries (FFmpeg/MKVMerge)
    ├── Cargo.toml           # Native definitions
    ├── tauri.conf.json      # Window, shell permissions, pathing parameters
    └── src/
```

## 3. Monorepo Root Configurations

The root directory acts purely as an orchestrator. It does not contain application code. It holds the workspace boundaries (`pnpm-workspace.yaml`) and a root `package.json` that provides unified developer commands to lint, typecheck, format, test, and spin up both environments simultaneously.

## 4. Developer Commands

The entire system stack can be managed using these high-level script controls from the workspace root:

* `pnpm dev` - Parallel execution spinning up Vite's server alongside Tauri's system window.
* `pnpm build` - Bundles production-optimized Svelte client assets and builds optimized binaries.
* `pnpm clean` - Cross-platform wipeout of local Cargo caches and node dependency trees.
* `pnpm check` - Full type safety verification across both Svelte and native Rust.
* `pnpm lint` - Evaluates code safety using ESLint and enforces strict Rust code standards.
* `pnpm format` - Auto-aligns all JS/TS/Svelte styling (Prettier) and Rust formatting standards (`cargo fmt`).
* `pnpm test` - Headless UI assertion runtime (Vitest) grouped with unit/integration tests (`cargo test`).
* `pnpm info` - Diagnostic telemetry reporting OS environment states and toolchain versions.

## 5. Base Directory Configuration

Start by creating the shell for the project:

```bash
mkdir mkv-filter-metadata-rust
cd mkv-filter-metadata-rust
git init
```

## 6. Running the Scaffolder

Rather than building everything from zero, we generate the base boilerplate. (Note: We will deconstruct this immediately after).

```bash
pnpm create tauri-app@latest
# Follow the prompts:
# - Choose your frontend (Svelte/SvelteKit)
# - Choose your package manager (pnpm)
```

## 7. Rearranging into a Monorepo Workspace Workspace Split

The default Tauri scaffolder mixes frontend and backend folders. We want a strict separation of concerns.

1. Create two folders in your root: `frontend` and `backend`.
2. Move all SvelteKit/Vite files (e.g., `src/`, `static/`, `vite.config.ts`, `svelte.config.js`) into the `frontend/` directory.
3. Move the `src-tauri/` folder contents entirely into the `backend/` directory.

---

## 8. Embedding Native Sidecars (FFmpeg & MKVMerge)

Because this application relies on external video processing tools, we must bundle them as "Sidecars" so the end-user does not have to install them globally.

### A. Sourcing and Naming the Binaries

1. Create a `bin/` directory inside your `backend/` folder (`backend/bin/`).
2. Download the standalone executables for FFmpeg and MKVMerge.
3. **CRITICAL:** Tauri requires sidecar binaries to be suffixed with the **Target Triple** of the host architecture. You cannot simply name the file `ffmpeg.exe`.
* *Windows Example:* Rename `ffmpeg.exe` to `ffmpeg-x86_64-pc-windows-msvc.exe`.
* *Windows Example:* Rename `mkvmerge.exe` to `mkvmerge-x86_64-pc-windows-msvc.exe`.
* *macOS (Silicon) Example:* Rename `ffmpeg` to `ffmpeg-aarch64-apple-darwin`.
* *Linux Example:* Rename `ffmpeg` to `ffmpeg-x86_64-unknown-linux-gnu`.

### B. Configuring `tauri.conf.json`

You must explicitly declare these binaries in your configuration file so the bundler knows to package them. Add the `externalBin` array inside the `bundle` object:

```json
"bundle": {
  "externalBin": [
    "bin/ffmpeg",
    "bin/mkvmerge"
  ]
}
```

*(Note: Do not include the target triple suffix in the JSON configuration; Tauri automatically resolves the correct suffix dynamically at build time).*

### C. Calling Sidecars via Rust

Once configured, your Rust backend leverages `tauri-plugin-shell` to spawn these sidecar processes. Instead of calling a system command, you specifically request the sidecar:

```rust
// Example of spawning a sidecar in lib.rs
let cmd = app.shell().sidecar("ffmpeg")
    .expect("Failed to initialize sidecar configuration")
    .args(["-encoders"]);
```

---

## 9. Initializing the Root Workspace Files

In your project root, create a file named `pnpm-workspace.yaml`. Because our backend is managed independently by Cargo, only the frontend is registered as a Node.js workspace module:

```yaml
packages:
  - 'frontend'
allowBuilds:
  '@parcel/watcher': true
  esbuild: true
```

Next, initialize the parent orchestrator `package.json`:

```bash
pnpm init
```

---

## 10. Unified Workflow Orchestration

Because the backend isn't managed within the Node workspace graph, root pipeline controls address `frontend` filtering specifically via `pnpm -F`, and route native parameters to `backend/Cargo.toml` manually using manifest path redirections.

Update the **root** `package.json` to reflect this structure:

```json
{
  "name": "mkv-filter-metadata-rust",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm -F frontend dev & pnpm tauri dev",
    "build": "pnpm -F frontend build && pnpm tauri build",
    "clean": "cargo clean --manifest-path backend/Cargo.toml && pnpm -r exec node -e \"require('fs').rmSync('node_modules', { recursive: true, force: true })\" && node -e \"require('fs').rmSync('node_modules', { recursive: true, force: true })\" && pnpm install",
    "tauri": "tauri",
    "check": "pnpm -F frontend check && cargo check --manifest-path backend/Cargo.toml",
    "lint": "pnpm -F frontend lint && cargo clippy --manifest-path backend/Cargo.toml -- -D warnings",
    "format": "pnpm -F frontend format && cargo fmt --manifest-path backend/Cargo.toml",
    "test": "pnpm -F frontend test:unit --run && cargo test --manifest-path backend/Cargo.toml",
    "info": "pnpm tauri info"
  },
  "license": "MIT",
  "devDependencies": {
    "@tauri-apps/cli": "^2.11.2"
  }
}
```

---

## 11. Injecting the Global Tauri CLI & Approving Builds

Tauri requires its CLI to orchestrate the dev servers and Rust compilation. Install it at the workspace root:

```bash
pnpm add -D @tauri-apps/cli -w
```

*(The `-w` flag tells pnpm to install it in the root workspace, making the `tauri` command available to our root scripts).*

---

## 12. Injecting Quality Tooling & Code Verification into Frontend

To unlock advanced code safety features (linting, formatting, testing), install the core development dependencies directly inside the frontend package ecosystem:

```bash
pnpm -F frontend add -D vitest eslint eslint-plugin-svelte prettier prettier-plugin-svelte typescript-eslint
```

Ensure your `frontend/package.json` matches this script architecture exactly:

```json
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test:unit": "vitest"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.11.0",
    "@tauri-apps/plugin-dialog": "^2.7.1",
    "@tauri-apps/plugin-opener": "^2.5.4"
  }
}
```

Ensure configuration targets exist inside the `frontend/` subdirectory:

* **`frontend/eslint.config.js`**: Integrates ESLint flat rule graphs with TypeScript and Svelte 5 compilers.
* **`frontend/.prettierrc`**: Integrates style parameters alongside `prettier-plugin-svelte`.

---

## 13. Injecting Dependencies into the Backend Package

Your backend relies on `Cargo`. The `backend/Cargo.toml` points to your required crate modules and system integration paths:

```toml
[package]
name = "mkv-filter-metadata-rust"
version = "0.1.0"
edition = "2021"

[lib]
name = "mkv_filter_metadata_rust_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.0.0" }

[dependencies]
tauri = { version = "2.0.0" }
tauri-plugin-dialog = "2.0.0"
tauri-plugin-shell = "2.0.0"
tauri-plugin-opener = "2.0.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.37", features = ["full"] }
```

---

## 14. Update Project Build Paths

Because folders are moved out of boilerplate definitions, Tauri must be directed to find your compiled assets via `backend/tauri.conf.json`. Update the `build` object:

```json
"build": {
  "beforeDevCommand": "pnpm -F frontend dev",
  "beforeBuildCommand": "pnpm -F frontend build",
  "devUrl": "http://localhost:5173",
  "frontendDist": "../frontend/build"
}
```

*(Note: Ensure your `devUrl` matches your Vite configuration port, and `frontendDist` points directly to your SvelteKit static build location).*

---

## 15. Frontend Layout Layer (SvelteKit, Svelte 5 & Vite)

The `frontend` folder handles 100% of the UI. It uses Svelte 5 runes (`$state`, `$derived`, `$effect`) for modern state handling.

* Core interfaces talk directly to the system hardware via explicit core bridge invokes:
```ts
import { invoke } from '@tauri-apps/api/core';
```

## 16. Backend Native Layer (Tauri 2.0 & Rust)

The `backend` folder handles hardware access, sidecars (FFmpeg/MKVMerge), and the filesystem.

* Heavy system processes belong encapsulated under custom cross-communicating command logic within `backend/src/lib.rs`.
* Expose commands to the frontend by adding them to your application builder's invoke handler array: `.invoke_handler(tauri::generate_handler![your_command])`.

---

## 17. Building for Production / Distribution

To compile a standalone binary/installer for your current OS:

1. Ensure your `tauri.conf.json` has a unique `identifier` (e.g., `com.mkvfilter.app`).
2. From the root directory, run:

```bash
pnpm build
```

Tauri will compile the frontend, run Cargo code optimizations, link target sidecars, and output platform packages (`.exe`, `.dmg`, or `.deb`) inside `backend/target/release/bundle/`.

---

## 18. Troubleshooting & Common Pitfalls

* **"Cannot find project matching filter 'backend'"**: Occurs when trying to run `pnpm -F backend`. The backend is a Cargo container, not a Node package. Always target its files directly via path references (e.g., `--manifest-path backend/Cargo.toml`).
* **Vite Port Collisions**: Set `strictPort: true` inside `frontend/vite.config.ts` to prevent Vite from changing ports when port `5173` is busy.
* **Sidecar Execution Failure**: Ensure your local binary filename accurately reflects your machine’s architecture triple (e.g. `ffmpeg-x86_64-pc-windows-msvc.exe` on Windows 64-bit systems).

---

## 19. Run the Clean Suite

If you hit dependency cache corruption, cross-platform terminal errors, or lock file issues, execute the deep clean workspace pipeline:

```bash
pnpm clean
```

### Why this is safe across all platforms:

Rather than depending on native Unix commands like `rm -rf` (which fail on Windows environments), the workspace clean engine invokes inline Node filesystems scripts (`node -e "require('fs').rmSync(...)"`). This cleanly targets sub-package node folders, root modules, and resets Rust's `target/` binaries safely on Windows, macOS, and Linux systems.