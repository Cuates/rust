# 🎬 MKV Subtitle Converter (Tauri v2 + SvelteKit Workspace)

[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/Cuates/rust/graphs/commit-activity)
[![CI Pipeline](https://github.com/Cuates/rust/actions/workflows/mkv-subtitle-converter-ci.yml/badge.svg)](https://github.com/Cuates/rust/actions/workflows/mkv-subtitle-converter-ci.yml)
[![Version](https://img.shields.io/badge/version-1.8.2-blue.svg)](https://github.com/Cuates/rust/tree/main/mkv-subtitle-converter)
[![Made with Rust](https://img.shields.io/badge/Made%20with-Rust-1f425f.svg)](https://www.rust-lang.org/)
[![Made with Svelte](https://img.shields.io/badge/Made%20with-Svelte-ff3e00.svg)](https://svelte.dev/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-24c8db.svg)](https://tauri.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A professional-grade, high-performance desktop utility designed to scan local directories, parse layout tracks inside multi-stream MKV video containers, and batch-extract embedded SubRip (SRT) files into highly formatted, custom-styled Advanced SubStation Alpha (ASS) subtitles.

Built on top of a highly optimized **pnpm monorepo workspace architecture**, the app cleanly splits its responsibilities across a reactive **Svelte 5 / SvelteKit** web-view frontend layout layer and a native **Tauri v2 / Rust** system execution backend layer. Crucially, the app ships completely self-contained by embedding cross-platform, static **FFmpeg** and **FFprobe** architecture sidecars, completely removing the requirement for users to have global dependencies installed on their operating systems.

---

## 📖 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Tree Structure](#2-tree-structure)
3. [Monorepo Root Configurations](#3-monorepo-root-configurations)
4. [Developer Commands](#4-developer-commands)
5. [Base Directory Configuration](#5-base-directory-configuration)
6. [Running the Scaffolder](#6-running-the-scaffolder)
7. [Rearranging into a Monorepo Workspace Split](#7-rearranging-into-a-monorepo-workspace-split)
8. [Initializing the Root Workspace Files](#8-initializing-the-root-workspace-files)
9. [Fixing Workspace Filtering](#9-fixing-workspace-filtering)
10. [Injecting the Global Tauri CLI & Approving Builds](#10-injecting-the-global-tauri-cli--approving-builds)
11. [Injecting Dependencies into the Frontend Package](#11-injecting-dependencies-into-the-frontend-package)
12. [Injecting Dependencies into the Backend Package](#12-injecting-dependencies-into-the-backend-package)
13. [Update Project Build Paths](#13-update-project-build-paths)
14. [Frontend Layout Layer (SvelteKit, Svelte 5 & Vite)](#14-frontend-layout-layer-sveltekit-svelte-5--vite)
15. [Backend Native Layer (Tauri 2.0 & Rust)](#15-backend-native-layer-tauri-20--rust)
16. [Building for Production / Distribution](#16-building-for-production--distribution)
17. [Troubleshooting & Common Pitfalls](#17-troubleshooting--common-pitfalls)
18. [Run the Clean Suite](#18-run-the-clean-suite)

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

## 2. Tree Structure

The architectural layout of this project relies on a highly decoupled **pnpm workspace split**. The web panel lives completely isolated from the system-level Rust compilation environment under the global `` workspace scope.

```text
rust-monorepo-root/
├── .github/                       # Monorepo-wide GitHub Actions workflows and CI pipelines
│   └── workflows/
│       └── mkv-subtitle-converter-ci.yml
└── mkv-subtitle-converter/
    ├── CHANGELOG.md                   # Version history and release notes
    ├── CONTRIBUTING.md                # Developer contribution guidelines
    ├── README.md                      # Architecture and setup documentation
    ├── TESTING.md                     # Testing suite documentation
    ├── package.json                   # Root package manager orchestration layout
    ├── pnpm-workspace.yaml            # PNPM monorepo multi-package descriptor
    ├── scripts/                       # Monorepo build and sidecar scripts
    │   ├── download-sidecars.mjs
    │   └── generate-hashes.mjs
    ├── frontend/                      # Decoupled Webview Client (SvelteKit / Svelte 5)
    │   ├── package.json
    │   ├── .prettierignore            # Formatter exclusion rules
    │   ├── .prettierrc                # Prettier formatting config
    │   ├── eslint.config.js           # Strict ESLint 9+ flat configuration
    │   ├── svelte.config.js           # Outfitted with Adapter-Static constraints (outputs to build/)
    │   ├── tsconfig.json              # TypeScript compiler configuration
    │   ├── vite.config.ts             # Vite bundler configurations
    │   ├── vitest-setup.js            # Vitest DOM and global mocking environment
    │   ├── static/                    # Uncompiled raw static assets
    │   │   ├── favicon.png
    │   │   ├── svelte.svg
    │   │   ├── tauri.svg
    │   │   └── vite.svg
    │   └── src/
    │       ├── lib/                   # Reusable UI components, stores, and utilities
    │       │   ├── components/
    │       │   ├── stores/
    │       │   ├── utils/
    │       │   ├── constants.ts       # Frontend constants
    │       │   └── types.ts           # Shared TypeScript interfaces
    │       ├── styles/                # Global SCSS styling architecture
    │       │   ├── _variables.scss
    │       │   └── app.scss
    │       └── routes/                # SvelteKit layout and page routing
    │           ├── +layout.svelte     # Root layout shell
    │           ├── +layout.ts         # Static pre-rendering enforcer (SSR false)
    │           ├── +page.svelte       # Primary application interaction view
    │           ├── guide/             # In-app user guide routes
    │           └── settings/          # Application settings routes
    └── backend/                       # Decoupled Native Desktop Layer (Tauri v2 + Rust)
        ├── Cargo.toml                 # System crate workspace dependencies
        ├── tauri.conf.json            # Main Tauri application layout and compilation schema (reads build/)
        ├── capabilities/
        │   └── default.json           # Security layer access token configuration
        ├── sidecars/                  # Embedded cross-platform system sidecars
        │   ├── ffmpeg-x86_64-pc-windows-msvc.exe
        │   ├── ffprobe-x86_64-pc-windows-msvc.exe
        │   └── ... (macOS & Linux sidecars)
        └── src/
            ├── main.rs                # Application execution root entryway
            ├── lib.rs                 # Application lib and main tauri builder
            ├── commands.rs            # IPC definitions and backend actions
            ├── process.rs             # Transcoding and streaming thread logic
            ├── models.rs              # Data models, structs, and payloads
            ├── history.rs             # Processing history report generator
            ├── constants.rs           # Static constants and configurations
            └── error.rs               # Application error structures
```

---

## 3. Monorepo Root Configurations

To prevent system module dependency leakage and to allow the root profile to manage individual package lifecycles cleanly, two files map the orchestration foundation.

### `pnpm-workspace.yaml`

```yaml
packages:
  - "*"
```

### Root `package.json`

```json
{
  "name": "mkv-subtitle-extractor-converter-rust",
  "version": "1.8.2",
  "description": "",
  "main": "index.js",
  "scripts": {
    "prebuild": "node scripts/download-sidecars.mjs",
    "build": "tauri build",
    "check": "pnpm -F frontend check && cargo check --manifest-path backend/Cargo.toml",
    "check:deadcode": "pnpm -F frontend exec knip && cargo clippy --manifest-path backend/Cargo.toml -- -D dead_code",
    "clean": "cargo clean --manifest-path backend/Cargo.toml && npx --yes rimraf node_modules frontend/node_modules && pnpm install",
    "dev": "tauri dev",
    "fix": "pnpm -F frontend format && pnpm -F frontend lint --fix && cargo fmt --manifest-path backend/Cargo.toml && cargo clippy --manifest-path backend/Cargo.toml --fix --allow-dirty --allow-staged -- -D warnings",
    "app-info": "tauri info",
    "audit": "pnpm audit && cargo audit --manifest-path backend/Cargo.toml",
    "test": "pnpm -F frontend test:unit --run && cargo test --manifest-path backend/Cargo.toml",
    "test:coverage": "pnpm -F frontend coverage && cargo tarpaulin --manifest-path backend/Cargo.toml --out Html"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "devEngines": {
    "packageManager": {
      "name": "pnpm",
      "version": "^11.3.0",
      "onFail": "download"
    }
  },
  "type": "module",
  "devDependencies": {
    "@tauri-apps/cli": "^2.11.3"
  }
}
```

---

## 4. Developer Commands

All administrative, runtime development, and pipeline compilation configurations must be invoked exclusively from the **root terminal directory**.

| Execution Command | Scope Strategy | Pipeline Processing Action                                                                                                       |
| ----------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`    | Workspace Root | Parses multi-package configuration trees and securely symlinks workspace dependencies.                                           |
| `pnpm dev`        | Workspace Root | Orchestrates the Svelte web views via Vite, handles Hot Module Reloading, and mounts the native Rust shell.                      |
| `pnpm build`      | Workspace Root | Enforces strict generation rules on frontend distributions, builds static structures, and compiles standalone platform binaries. |
| `pnpm clean`      | Workspace Root | Invokes atomic filesystem purges across all workspace scopes, wiping artifacts, caches, and modules cleanly.                     |

---

## 5. Base Directory Configuration

To build out or recreate this exact platform layout safely without conflict parameters, prepare a clean filesystem parent context container and transition your terminal environment context:

```bash
mkdir mkv-subtitle-converter
cd mkv-subtitle-converter
```

---

## 6. Running the Scaffolder

Bootstrap the foundational scaffolding footprint directly inside your active terminal directory using the interactive multi-platform generator:

```bash
pnpm create tauri-app .
```

When prompted by the automated deployment assistant, input the exact values specified below:

- **Project Name:** `mkv-subtitle-converter`
- **Frontend Language:** `TypeScript`
- **UI Framework Layout:** `Svelte`
- **Meta-Framework Blueprint:** `SvelteKit`
- **Package Manager Engine:** `pnpm`

---

## 7. Rearranging into a Monorepo Workspace Split

The standard scaffolding configuration outputs a monolithic block where your web views wrap directly over the `src-tauri` workspace. To transform this setup into a decoupled multi-package repository model, process the following sequence:

1. Create a physical directory named `packages` inside your root project space:

```bash
mkdir packages
```

2. Move the entire SvelteKit structure into a new location under `frontend/`.
3. Relocate the native backend folder structure entirely under `backend/`.

---

## 8. Initializing the Root Workspace Files

Once the directory migration completes, configure the multi-package registry states. Create a root `pnpm-workspace.yaml` file using the code provided in Step 3. Next, update individual descriptor parameters so the package engine can build an unambiguous mapping index.

Modify **`frontend/package.json`**:

```json
{
  "name": "frontend",
  "private": true,
  "version": "1.8.2"
}
```

Modify **`backend/package.json`**:

```json
{
  "name": "backend",
  "private": true,
  "version": "1.8.2"
}
```

---

## 9. Fixing Workspace Filtering

By decoupling packages into `frontend` and `backend`, we prevent system configuration files from polluting competing scopes. When executing specific package actions, always utilize `pnpm` workspace filters to ensure precision execution targets:

```bash
# Example of explicit scoped installation filtering
pnpm --filter frontend add <package-name>
```

---

## 10. Injecting the Global Tauri CLI & Approving Builds

The main administrative orchestration runtime of Tauri v2 must exist at the workspace system root to allow unified execution mappings. Inject the developer CLI directly into the root context with workspace-wide tracking clearance:

```bash
pnpm add -D @tauri-apps/cli -w
```

This enables running commands like `pnpm dev` at the global root level, allowing the CLI to find individual configurations located deeper within the workspace structure.

---

## 11. Injecting Dependencies into the Frontend Package

The web panel layout layer requires dedicated API interfaces to talk through the Tauri system bridges safely. Navigate to your client layer and install the core framework interfaces and the static compilation adapter:

```bash
cd frontend
pnpm add @tauri-apps/api
pnpm add -D @sveltejs/adapter-static
pnpm add -D sass
```

---

## 12. Injecting Dependencies into the Backend Package

The desktop application utilizes modular plugin crates to implement system sandboxing. Navigate to the core compilation layer and inject the official system plugins alongside standard utility engines via Cargo:

```bash
cd backend
cargo add tauri-plugin-fs
cargo add tauri-plugin-dialog
cargo add tauri-plugin-opener
cargo add tauri-plugin-shell
cargo add indexmap serde serde_json chrono tokio regex
```

---

## 13. Update Project Build Paths

Because we restructured the directory layout, the core Tauri orchestration configuration file must be modified to locate the static web panels.

Update **`backend/tauri.conf.json`**:

```json
"build": {
  "beforeDevCommand": "pnpm --filter frontend dev",
  "beforeBuildCommand": "pnpm --filter frontend build",
  "devUrl": "http://localhost:5173",
  "frontendDist": "../frontend/build"
}
```

Simultaneously, enforce static generation rules on your client configuration so it produces individual asset documents instead of node system server scripts, routing the compiler output straight into the standard `build` folder.

Update **`frontend/svelte.config.js`**:

```javascript
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "index.html", // Required for SPA. (Will throw a safe overwrite warning during build)
      precompress: false,
      strict: true,
    }),
    alias: {
      $lib: "./src/lib",
      "$lib/*": "./src/lib/*",
    },
  },
};

export default config;
```

---

## 14. Frontend Layout Layer (SvelteKit, Svelte 5 & Vite)

The application front interface relies on a combination of SCSS stylesheets, static assets, and reactive **Svelte 5 Runes** (`$state`, `$derived`, `$effect`) to build a cohesive desktop UI.

### Desktop Routing Shell

Tauri requires SvelteKit to operate as a pure Single-Page Application (SPA) without a Node.js server backbone.

- **`+layout.ts`**: Explicitly disables Server-Side Rendering (SSR) and enforces static prerendering.

```typescript
export const prerender = true;
export const ssr = false;
```

### Communication Implementation Model (`+page.svelte`)

Communication with the system layer uses asynchronous multi-channel IPC frameworks.

```typescript
import { invoke, Channel } from "@tauri-apps/api/core";

interface ProgressPayload {
  event: string;
  data: any;
}

const progressChannel = new Channel<ProgressPayload>();

progressChannel.onmessage = (message) => {
  switch (message.event) {
    case "LogMessage":
      console.log(`[Terminal Core UI Log] ${message.data}`);
      break;
  }
};

async function triggerExtractionBatch(selectedFolders: string[]) {
  try {
    await invoke("process_mkv_directory", {
      paths: selectedFolders,
      onProgress: progressChannel,
    });
  } catch (error) {
    console.error(`Native runtime error reported: ${error}`);
  }
}
```

---

## 15. Backend Native Layer (Tauri 2.0 & Rust)

The file system processing pipeline logic is fully managed inside `backend/src/lib.rs`. It provides multi-threaded processing optimizations, safe cancel state handling, and a custom raw-text SubRip to ASS transcoding layout engine.

### Essential Operations Performed Natively

1. **Sidecar Verification Phase:** Fires asynchronous internal validation checks targeting embedded binary locations to extract structural runtime parameters (`ffmpeg -version`).
2. **Layout Parsing Structure:** Uses `ffprobe` sidecars to scan targets, fetch track maps, and isolate binary layout properties (`default_flag`, `forced_flag`).
3. **Async Subprocess Spawn:** Launches independent `ffmpeg` extraction sub-routines mapped inside Tokio tasks.
4. **Rust Transcoding Core Engine:** Parses raw time markers out of SRT logs via standard buffers and structurally rewrites text elements using customized style blocks inside highly optimized Advanced SubStation Alpha (ASS) files.

---

## 16. For Developers: Building for Production / Distribution

_(Note: If you are an end user, you do not need to do this. You can simply download the pre-compiled application from the Releases page.)_

When developers are ready to compile the application from the source code into a single, production-ready release package, invoke the global bundler from the workspace root:

```bash
pnpm tauri build
```

This triggers the production build across the SvelteKit frontend layout, compiles the Rust code with full release optimization flags (`-C opt-level=3`), and resolves the sidecars. From here, developers have two distribution options:

### Option A: Standard System Installers

Tauri automatically wraps the application inside standard OS installers (`.msi` / `.exe` on Windows, `.dmg` / `.app` on macOS, `.deb` / `.AppImage` on Linux).

- **Location:** `backend/target/release/bundle/`
- **Use Case:** Best for standard end user distribution where the application needs to live in `Program Files` or the macOS `Applications` folder.

### Option B: Portable (No-Install) Application

Developers can completely bypass the installer and package a raw, portable folder that end users can run instantly on any machine without needing administrator privileges.

1. Navigate to the core compile directory: `backend/target/release/`
2. Locate the raw, compiled executable: `mkv-subtitle-converter.exe`
3. Locate the embedded host architecture sidecars that Tauri copied into this exact same folder (e.g., `ffmpeg-x86_64-pc-windows-msvc.exe`).
4. Create a new folder (e.g., `MKV-Converter-Portable`).
5. Move the `.exe` and the sidecar binaries into this folder together.
6. Zip the folder and distribute it. End users simply double-click the `.exe` to run.

---

## 17. Troubleshooting & Common Pitfalls

### ❌ Issue: Build warns "Overwriting dist\index.html with fallback page"

- **Cause:** SvelteKit successfully generated a static homepage from your root route, but then overwrote it with the Single Page Application (SPA) `fallback: 'index.html'` file we configured in `svelte.config.js`.
- **Resolution:** **Ignore this warning.** For a Tauri application, this overwrite is intended behavior and ensures the WebView can handle internal SPA routing correctly.

### ❌ Issue: App opens to a white screen / "asset not found: index.html"

- **Cause:** The `tauri.conf.json` is looking for `index.html` as its entry point, but `svelte.config.js` generated a different fallback file name, or `frontendDist` is misconfigured.
- **Resolution:** Ensure `fallback: 'index.html'` is explicitly set in `svelte.config.js`. Ensure `frontendDist` in `tauri.conf.json` points to the `build` folder (`"../frontend/build"`), not a specific file.

### ❌ Issue: System terminal output UI reports old engine versions after file upgrades

- **Cause:** Cargo optimizes compilation performance by aggressively caching system binary assets.
- **Resolution:** Wipe the internal target cache cleanly before restarting your development environment:

```bash
cd backend
cargo clean
cd ../..
pnpm dev
```

### ❌ Issue: macOS crashes or reports the sidecar binary file is "damaged" or untrusted

- **Cause:** Apple Gatekeeper automatically appends an extended quarantine metadata attribute flag (`com.apple.quarantine`) onto executables downloaded via browsers.
- **Resolution:** Strip the security metadata quarantine flag manually via terminal:

```bash
xattr -dr com.apple.quarantine backend/sidecars/ffmpeg-aarch64-apple-darwin
xattr -dr com.apple.quarantine backend/sidecars/ffprobe-aarch64-apple-darwin
```

---

## 18. Run the Clean Suite

If your development workspace ever exhibits strange UI rendering states, out-of-sync type files, or locked dependency trees, perform a deep, total workspace purge to restore compilation stability.

From the repository root workspace room, run:

```bash
pnpm clean
```

Once completed, boot standard local execution safely:

```bash
pnpm dev
```
