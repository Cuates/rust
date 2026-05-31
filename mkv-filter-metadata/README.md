# Tauri 2.0 + SvelteKit Monorepo Architecture Guide

Welcome to the definitive guide for this project's architecture. This document outlines the start-to-finish journey of setting up a strict Monorepo workspace separating a modern Svelte 5 (Frontend) environment from a Rust/Tauri 2.0 (Backend) native application layer, complete with bundled native sidecar executables.

Whether you are onboarding a new developer or rebuilding from scratch, follow these categorized steps carefully.

---

## Table of Contents

1. [Prerequisites](https://www.google.com/search?q=%231-prerequisites)
2. [Tree Structure](https://www.google.com/search?q=%232-tree-structure)
3. [Monorepo Root Configurations](https://www.google.com/search?q=%233-monorepo-root-configurations)
4. [Developer Commands](https://www.google.com/search?q=%234-developer-commands)
5. [Base Directory Configuration](https://www.google.com/search?q=%235-base-directory-configuration)
6. [Running the Scaffolder](https://www.google.com/search?q=%236-running-the-scaffolder)
7. [Rearranging into a Monorepo Workspace Split](https://www.google.com/search?q=%237-rearranging-into-a-monorepo-workspace-split)
8. [Embedding Native Sidecars (FFmpeg & MKVMerge)](https://www.google.com/search?q=%238-embedding-native-sidecars-ffmpeg--mkvmerge)
9. [Initializing the Root Workspace Files](https://www.google.com/search?q=%239-initializing-the-root-workspace-files)
10. [Fixing Workspace Filtering](https://www.google.com/search?q=%2310-fixing-workspace-filtering)
11. [Injecting the Global Tauri CLI & Approving Builds](https://www.google.com/search?q=%2311-injecting-the-global-tauri-cli--approving-builds)
12. [Injecting Dependencies into the Frontend Package](https://www.google.com/search?q=%2312-injecting-dependencies-into-the-frontend-package)
13. [Injecting Dependencies into the Backend Package](https://www.google.com/search?q=%2313-injecting-dependencies-into-the-backend-package)
14. [Update Project Build Paths](https://www.google.com/search?q=%2314-update-project-build-paths)
15. [Frontend Layout Layer (SvelteKit, Svelte 5 & Vite)](https://www.google.com/search?q=%2315-frontend-layout-layer)
16. [Backend Native Layer (Tauri 2.0 & Rust)](https://www.google.com/search?q=%2316-backend-native-layer)
17. [Building for Production / Distribution](https://www.google.com/search?q=%2317-building-for-production--distribution)
18. [Troubleshooting & Common Pitfalls](https://www.google.com/search?q=%2318-troubleshooting--common-pitfalls)
19. [Run the Clean Suite](https://www.google.com/search?q=%2319-run-the-clean-suite)

---

## 1. Prerequisites

Before beginning, ensure your system has the required tooling installed:

* **Node.js** (v18+ recommended)
* **pnpm** (Required package manager for this workspace)
* **Rust & Cargo** (Installed via `rustup`)
* **OS-Specific Build Tools**:
* *Windows*: Visual Studio C++ Build Tools.
* *macOS*: Xcode Command Line Tools.
* *Linux*: `build-essential`, `curl`, `wget`, `file`, `libssl-dev`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`

## 2. Tree Structure

By the end of this guide, your project will strictly adhere to the following architecture:

```text
my-tauri-app/
├── package.json             # Root commands and devDependencies
├── pnpm-workspace.yaml      # Monorepo boundary definitions
├── frontend/                # Svelte 5 + Vite Web Layer
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
└── backend/                 # Rust + Tauri Native Layer
    ├── bin/                 # Sidecar Binaries (FFmpeg/MKVMerge)
    ├── Cargo.toml
    ├── tauri.conf.json
    └── src/
```

## 3. Monorepo Root Configurations

The root directory acts purely as an orchestrator. It does not contain application code. It holds the workspace configuration (`pnpm-workspace.yaml`) and a root `package.json` that provides unified developer commands to spin up both the frontend and backend simultaneously.

## 4. Developer Commands

Once setup is complete, you will run the entire stack from the root directory using these commands:

* `pnpm dev` - Spins up the Vite dev server and the Tauri native window simultaneously.
* `pnpm build` - Compiles the SvelteKit frontend and builds the Rust production binaries.
* `pnpm clean` - Purges all `node_modules` and Rust `target` directories.

## 5. Base Directory Configuration

Start by creating the shell for the project:

```bash
mkdir my-tauri-app
cd my-tauri-app
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

In your project root, create a file named `pnpm-workspace.yaml` to tell `pnpm` how to link the packages:

```yaml
packages:
  - "frontend"
  - "backend"
```

Next, create a root `package.json`:

```bash
pnpm init
```

*(Remove the generic `main` and `scripts` generated by default, we will add workspace scripts shortly).*

## 10. Fixing Workspace Filtering

Now that packages are split, standard commands won't work. We must use `pnpm`'s filtering flag (`-F` or `--filter`) to target specific folders.
In your root `package.json`, add your orchestrator scripts:

```json
"scripts": {
  "dev": "tauri dev",
  "build": "tauri build",
  "frontend:install": "pnpm -F frontend install",
  "backend:audit": "pnpm -F backend cargo check"
}
```

## 11. Injecting the Global Tauri CLI & Approving Builds

Tauri requires its CLI to orchestrate the dev servers and Rust compilation. Install it at the workspace root:

```bash
pnpm add -D @tauri-apps/cli -w
```

*(The `-w` flag tells pnpm to install it in the root workspace, making the `tauri` command available to our root scripts).*

## 12. Injecting Dependencies into the Frontend Package

Navigate to (or filter) the `frontend` directory to update Svelte and Tauri API bindings.

```bash
pnpm -F frontend add @tauri-apps/api @tauri-apps/plugin-dialog
pnpm -F frontend add -D svelte@next # If upgrading to Svelte 5
```

Ensure your `frontend/package.json` names the package correctly (e.g., `"name": "frontend"`).

## 13. Injecting Dependencies into the Backend Package

Your backend relies on `Cargo`. Navigate to the `backend` directory and ensure your `Cargo.toml` has the necessary Tauri 2.0 plugins.

```toml
[dependencies]
tauri = { version = "2.0.0", features = [] }
tauri-plugin-shell = "2.0.0"
tauri-plugin-dialog = "2.0.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

## 14. Update Project Build Paths

Because we moved folders, Tauri is now "blind". We must fix the paths in `backend/tauri.conf.json`.
Update the `build` object to point to the frontend:

```json
"build": {
  "beforeDevCommand": "pnpm -F frontend dev",
  "beforeBuildCommand": "pnpm -F frontend build",
  "devUrl": "http://localhost:1420",
  "frontendDist": "../frontend/build"
}
```

*(Note: Change `../frontend/build` to `../frontend/dist` depending on your Vite adapter).*

## 15. Frontend Layout Layer (SvelteKit, Svelte 5 & Vite)

The `frontend` folder handles 100% of the UI. It uses Svelte 5 runes (`$state`, `$derived`) for reactivity.

* To communicate with Rust, import Tauri APIs in your `.svelte` or `.ts` files:
`import { invoke } from '@tauri-apps/api/core';`
* Keep all CSS and layout concerns strictly within this folder.

## 16. Backend Native Layer (Tauri 2.0 & Rust)

The `backend` folder handles hardware access, sidecars (FFmpeg/MKVMerge), and the filesystem.

* The entry point is `backend/src/main.rs`.
* Heavy logic is placed in `backend/src/lib.rs`.
* We use Tauri commands (`#[tauri::command]`) to expose Rust functions to the Svelte frontend.

## 17. Building for Production / Distribution

To compile a standalone binary/installer for your OS:

1. Ensure your `tauri.conf.json` has a unique `identifier` (e.g., `com.my-app.dev`).
2. From the root directory, run:

```bash
pnpm build
```

Tauri will automatically build the Svelte frontend, compile the Rust backend, bind the external sidecars, and bundle them into `.exe`, `.dmg`, or `.AppImage` files located in `backend/target/release/bundle/`.

## 18. Troubleshooting & Common Pitfalls

* **"Cannot find module '@tauri-apps/api'"**: You forgot to install it in the `frontend` workspace. Run `pnpm -F frontend add @tauri-apps/api`.
* **"CommandNotFound" error when invoking Rust**: You forgot to register your command in `lib.rs` inside `.invoke_handler(tauri::generate_handler![...])`.
* **Vite Port Collisions**: Ensure `vite.config.ts` enforces `strictPort: true` so it doesn't randomly jump to `1421` while Tauri looks for `1420`.
* **"Sidecar not found"**: Double-check that your executable suffix perfectly matches your OS's target triple, and that the path in `tauri.conf.json` is strictly `bin/executable_name`.

## 19. Run the Clean Suite

If you encounter weird caching issues, ghost errors, or need to free up hard drive space, you must clean both the node environment and the Rust environment.
Add this script to your root `package.json`:

```json
"scripts": {
  "clean": "pnpm -r exec rm -rf node_modules && pnpm -F backend exec cargo clean"
}
```

Run `pnpm clean` to purge all dependencies and build artifacts safely. (On Windows, you may need to use `rimraf` or manually delete the folders).
