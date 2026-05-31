# Tauri 2.0 + SvelteKit Monorepo Architecture Guide

Welcome to the definitive guide for this project's architecture. This document outlines the start-to-finish journey of setting up a strict Monorepo workspace separating a modern Svelte 5 (Frontend) environment from a Rust/Tauri 2.0 (Backend) native application layer, complete with bundled native sidecar executables, strict code-quality tooling, and self-healing system processing.

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
11. [Injecting the Global Tauri CLI](#11-injecting-the-global-tauri-cli)
12. [Injecting Quality Tooling & Code Verification](#12-injecting-quality-tooling--code-verification)
13. [Frontend Layout & Strict Typing Standards](#13-frontend-layout--strict-typing-standards)
14. [Backend Native Layer & Self-Healing Workflows](#14-backend-native-layer--self-healing-workflows)
15. [Update Project Build Paths](#15-update-project-build-paths)
16. [Building for Production / Distribution](#16-building-for-production--distribution)
17. [Troubleshooting & Common Pitfalls](#17-troubleshooting--common-pitfalls)
18. [Run the Clean Suite](#18-run-the-clean-suite)

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
│   ├── eslint.config.js     # Linter flat-config rules (Svelte + Node integrations)
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
* `pnpm app-info` - Diagnostic telemetry reporting OS environment states and toolchain versions (renamed from `info` to avoid pnpm internal command conflicts).

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

## 7. Rearranging into a Monorepo Workspace Split

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

**Note on redundancy:** We execute `tauri build` directly instead of chaining frontend builds because `tauri.conf.json` natively handles pre-build commands.

Update the **root** `package.json` to reflect this optimized structure:

```json
{
  "name": "mkv-filter-metadata-rust",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "check": "pnpm -F frontend check && cargo check --manifest-path backend/Cargo.toml",
    "lint": "pnpm -F frontend lint && cargo clippy --manifest-path backend/Cargo.toml -- -D warnings",
    "format": "pnpm -F frontend format && cargo fmt --manifest-path backend/Cargo.toml",
    "test": "pnpm -F frontend test:unit --run && cargo test --manifest-path backend/Cargo.toml",
    "clean": "cargo clean --manifest-path backend/Cargo.toml && pnpm -r exec node -e \"require('fs').rmSync('node_modules', { recursive: true, force: true })\" && node -e \"require('fs').rmSync('node_modules', { recursive: true, force: true })\" && pnpm install",
    "app-info": "pnpm tauri info"
  },
  "license": "MIT",
  "devDependencies": {
    "@tauri-apps/cli": "^2.11.2"
  }
}
```

---

## 11. Injecting the Global Tauri CLI

Tauri requires its CLI to orchestrate the dev servers and Rust compilation. Install it at the workspace root:

```bash
pnpm add -D @tauri-apps/cli -w
```

---

## 12. Injecting Quality Tooling & Code Verification

To unlock advanced code safety features (linting, formatting, testing), install the core development dependencies directly inside the frontend package ecosystem:

```bash
pnpm -F frontend add -D vitest eslint eslint-plugin-svelte prettier prettier-plugin-svelte typescript-eslint globals @eslint/js
```

### Modern ESLint Flat Config (`frontend/eslint.config.js`)

We use the modern flat config setup, specifically configuring the parser to handle Svelte 5 and TypeScript features (preventing "Unexpected token as" errors), while mapping `globals.node` so Node-level files like `vite.config.ts` do not trigger "process is not defined" errors.

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginSvelte.configs['flat/recommended'],
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    ignores: ['build/', '.svelte-kit/', 'dist/']
  }
);
```

---

## 13. Frontend Layout & Strict Typing Standards

The `frontend` folder handles 100% of the UI. It uses Svelte 5 runes (`$state`, `$derived`, `$effect`) for modern state handling. To pass our strict linting requirements:

1. **Explicit Typing:** Avoid `any`. If referencing system objects like timers, use precise TS utility types (e.g., `let timerInterval: ReturnType<typeof setInterval> | undefined = undefined;`).
2. **Loop Identity:** All Svelte `{#each}` loops must declare explicit unique keys (e.g., `{#each array as item (item.id)}`) to optimize DOM diffing.
3. **Unused Variables:** Handled by either stripping them entirely or prefixing variables you plan to use later with an underscore (e.g., `catch (_e) {}`).

* Core interfaces talk directly to the system hardware via explicit core bridge invokes:

```ts
import { invoke } from '@tauri-apps/api/core';
```

---

## 14. Backend Native Layer & Self-Healing Workflows

The `backend` folder handles hardware access, sidecars (FFmpeg/MKVMerge), and the filesystem. Key features implemented in `lib.rs`:

* **NVENC Hardware Detection:** Rust queries the system environment to determine if NVIDIA encoding APIs are available and relays this to the frontend.
* **Self-Healing Fallback Strategy:** Rather than maintaining fragile, hardcoded lists of compatible or incompatible codecs, the application parses the actual `stderr` stream from FFmpeg natively. If it detects that a direct stream copy was rejected due to subtitle incompatibilities, it intercepts the failure, dynamically injects ASS subtitle conversion flags, and retries the file seamlessly.
* **Granular Telemetry:** The backend isolates processing failures and cleanly reports explicit metrics (e.g., "Retries Triggered vs Resolved") via Tauri event emitters back to the Svelte application log.
* **Session Rollbacks:** The state manager tracks generated outputs inside `Mutex<Vec<PathBuf>>`. If the application is closed or the user clicks "Abort", the system destroys active child processes and scrubs partially written files and empty directories from the drive.

---

## 15. Update Project Build Paths

Because folders are moved out of boilerplate definitions, Tauri must be directed to find your compiled assets via `backend/tauri.conf.json`. Update the `build` object:

```json
"build": {
  "beforeDevCommand": "pnpm -F frontend dev",
  "beforeBuildCommand": "pnpm -F frontend build",
  "devUrl": "http://localhost:1420",
  "frontendDist": "../frontend/build"
}
```

---

## 16. Building for Production / Distribution

To compile a standalone binary/installer for your current OS:

1. Ensure your `tauri.conf.json` has a unique `identifier` (e.g., `com.mkvfilter.app`).
2. From the root directory, run:

```bash
pnpm build
```

Tauri will compile the frontend, run Cargo code optimizations, link target sidecars, and output platform packages (`.exe`, `.dmg`, or `.deb`) inside `backend/target/release/bundle/`.

---

## 17. Troubleshooting & Common Pitfalls

* **"Cannot find project matching filter 'backend'"**: Occurs when trying to run `pnpm -F backend`. The backend is a Cargo container, not a Node package. Always target its files directly via path references (e.g., `--manifest-path backend/Cargo.toml`).
* **Vite Port Collisions**: Set `strictPort: true` inside `frontend/vite.config.ts` to prevent Vite from changing ports when the designated port is busy.
* **Sidecar Execution Failure**: Ensure your local binary filename accurately reflects your machine’s architecture triple (e.g. `ffmpeg-x86_64-pc-windows-msvc.exe` on Windows 64-bit systems).
* **Package Script Conflicts:** Do not name workspace scripts the same as native PM commands. For example, use `app-info` rather than `info` to avoid triggering `pnpm view`.

---

## 18. Run the Clean Suite

If you hit dependency cache corruption, cross-platform terminal errors, or lock file issues, execute the deep clean workspace pipeline:

```bash
pnpm clean
```

### Why this is safe across all platforms:

Rather than depending on native Unix commands like `rm -rf` (which fail on Windows environments), the workspace clean engine invokes inline Node filesystems scripts (`node -e "require('fs').rmSync(...)"`). This cleanly targets sub-package node folders, root modules, and resets Rust's `target/` binaries safely on Windows, macOS, and Linux systems.