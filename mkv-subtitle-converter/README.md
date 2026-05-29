```markdown
# 🎬 MKV Subtitle Converter (Tauri v2 + SvelteKit Workspace)

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
* **Node.js:** v20 LTS or higher recommended.
* **pnpm:** v8 or higher (Global installation: `npm install -g pnpm`).
* **Rust Toolchain:** Stable channel version via `rustup` (Includes `rustc`, `cargo`, and `cargo-clippy`).

### Operating System Build Pillars
* **Windows 11 / 10:** Install the **Visual Studio C++ Build Tools** through the official installer. Ensure the "Desktop development with C++" workload is selected.
* **macOS (Intel & Silicon):** Install the official command line development environment by executing `xcode-select --install` inside your terminal application.
* **Linux (*nix Distros):** System-wide C-compilers and developer system packages for WebKit are mandatory. For Debian/Ubuntu distributions, execute the following block:
  ```bash
  sudo apt-get update && sudo apt-get install -y build-essential curl wget libssl-dev libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev textlive-fonts-recommended

```

---

## 2. Tree Structure

The architectural layout of this project relies on a highly decoupled **pnpm workspace split**. The web panel lives completely isolated from the system-level Rust compilation environment under the global `packages/` workspace scope.

```text
mkv-subtitle-converter/
├── package.json                   # Root package manager orchestration layout
├── pnpm-workspace.yaml            # PNPM monorepo multi-package descriptor
├── packages/
│   ├── frontend/                  # Decoupled Webview Client (SvelteKit / Svelte 5)
│   │   ├── package.json
│   │   ├── svelte.config.js       # Outfitted with Adapter-Static constraints
│   │   ├── tsconfig.json          # TypeScript compiler configuration
│   │   ├── vite.config.js         # Vite bundler configurations
│   │   ├── static/                # Uncompiled raw static assets
│   │   │   ├── favicon.png
│   │   │   ├── svelte.svg
│   │   │   ├── tauri.svg
│   │   │   └── vite.svg
│   │   └── src/
│   │       ├── styles/            # Global SCSS styling architecture
│   │       │   ├── _variables.scss
│   │       │   └── app.scss
│   │       └── routes/            # UI components and Tauri async IPC invocations
│   │           ├── +layout.svelte # Root layout shell
│   │           ├── +layout.ts     # Static pre-rendering enforcer (SSR false)
│   │           └── +page.svelte   # Primary application interaction view
│   └── backend/                   # Decoupled Native Desktop Layer (Tauri v2 + Rust)
│       ├── Cargo.toml             # System crate workspace dependencies
│       ├── tauri.conf.json        # Main Tauri application layout and compilation schema
│       ├── capabilities/
│       │   └── default.json       # Security layer access token configuration
│       ├── binaries/              # Embedded cross-platform system sidecars
│       │   ├── ffmpeg-x86_64-pc-windows-msvc.exe
│       │   ├── ffprobe-x86_64-pc-windows-msvc.exe
│       │   ├── ffmpeg-x86_64-apple-darwin
│       │   ├── ffprobe-x86_64-apple-darwin
│       │   ├── ffmpeg-aarch64-apple-darwin
│       │   ├── ffprobe-aarch64-apple-darwin
│       │   ├── ffmpeg-x86_64-unknown-linux-gnu
│       │   └── ffprobe-x86_64-unknown-linux-gnu
│       └── src/
│           ├── main.rs            # Application execution root entryway
│           └── lib.rs             # Transcoding logic, sidecar streaming, and IPC definitions

```

---

## 3. Monorepo Root Configurations

To prevent system module dependency leakage and to allow the root profile to manage individual package lifecycles cleanly, two files map the orchestration foundation.

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'

```

### Root `package.json`

```json
{
  "name": "mkv-subtitle-converter-root",
  "private": true,
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "clean": "pnpm -r exec rm -rf node_modules build .svelte-kit target && pnpm install"
  },
  "devDependencies": {
    "@tauri-apps/cli": "latest"
  }
}

```

---

## 4. Developer Commands

All administrative, runtime development, and pipeline compilation configurations must be invoked exclusively from the **root terminal directory**.

| Execution Command | Scope Strategy | Pipeline Processing Action |
| --- | --- | --- |
| `pnpm install` | Workspace Root | Parses multi-package configuration trees and securely symlinks workspace dependencies. |
| `pnpm dev` | Workspace Root | Orchestrates the Svelte web views via Vite, handles Hot Module Reloading, and mounts the native Rust shell. |
| `pnpm build` | Workspace Root | Enforces strict generation rules on frontend distributions, builds static structures, and compiles standalone platform binaries. |
| `pnpm clean` | Workspace Root | Invokes atomic filesystem purges across all workspace scopes, wiping artifacts, caches, and modules cleanly. |

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

* **Project Name:** `mkv-subtitle-converter`
* **Frontend Language:** `TypeScript`
* **UI Framework Layout:** `Svelte`
* **Meta-Framework Blueprint:** `SvelteKit`
* **Package Manager Engine:** `pnpm`

---

## 7. Rearranging into a Monorepo Workspace Split

The standard scaffolding configuration outputs a monolithic block where your web views wrap directly over the `src-tauri` workspace. To transform this setup into a decoupled multi-package repository model, process the following sequence:

1. Create a physical directory named `packages` inside your root project space:
```bash
mkdir packages

```


2. Move the entire SvelteKit structure into a new location under `packages/frontend/`.
3. Relocate the native backend folder structure entirely under `packages/backend/`.

---

## 8. Initializing the Root Workspace Files

Once the directory migration completes, configure the multi-package registry states. Create a root `pnpm-workspace.yaml` file using the code provided in Step 3. Next, update individual descriptor parameters so the package engine can build an unambiguous mapping index.

Modify **`packages/frontend/package.json`**:

```json
{
  "name": "@app/frontend",
  "private": true,
  "version": "2.0.0"
}

```

Modify **`packages/backend/package.json`**:

```json
{
  "name": "@app/backend",
  "private": true,
  "version": "2.0.0"
}

```

---

## 9. Fixing Workspace Filtering

By decoupling packages into `@app/frontend` and `@app/backend`, we prevent system configuration files from polluting competing scopes. When executing specific package actions, always utilize `pnpm` workspace filters to ensure precision execution targets:

```bash
# Example of explicit scoped installation filtering
pnpm --filter @app/frontend add <package-name>

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
cd packages/frontend
pnpm add @tauri-apps/api
pnpm add -D @sveltejs/adapter-static
pnpm add -D sass

```

---

## 12. Injecting Dependencies into the Backend Package

The desktop application utilizes modular plugin crates to implement system sandboxing. Navigate to the core compilation layer and inject the official system plugins alongside standard utility engines via Cargo:

```bash
cd packages/backend
cargo add tauri-plugin-fs
cargo add tauri-plugin-dialog
cargo add tauri-plugin-opener
cargo add tauri-plugin-shell
cargo add indexmap serde serde_json chrono tokio regex

```

---

## 13. Update Project Build Paths

Because we restructured the directory layout, the core Tauri orchestration configuration file must be modified to locate the static web panels.

Update **`packages/backend/tauri.conf.json`**:

```json
"build": {
  "beforeDevCommand": "pnpm --filter @app/frontend dev",
  "beforeBuildCommand": "pnpm --filter @app/frontend build",
  "devUrl": "http://localhost:5173",
  "frontendDist": "../frontend/build"
}

```

Simultaneously, enforce static generation rules on your client configuration so it produces individual asset documents instead of node system server scripts.

Update **`packages/frontend/svelte.config.js`**:

```javascript
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: true
    })
  }
};

export default config;

```

---

## 14. Frontend Layout Layer (SvelteKit, Svelte 5 & Vite)

The application front interface relies on a combination of SCSS stylesheets, static assets, and reactive **Svelte 5 Runes** (`$state`, `$derived`, `$effect`) to build a cohesive desktop UI.

### Static Assets & Global Styling

* **`static/`**: Houses all uncompiled raw assets (`favicon.png`, `vite.svg`, `tauri.svg`, `svelte.svg`). Vite serves these directly to the compiled HTML.
* **`src/styles/`**: Centralized SCSS architecture. Uses `_variables.scss` for standardized color theming and `app.scss` for global resets and core application stylesheets.

### Desktop Routing Shell

Tauri requires SvelteKit to operate as a pure Single-Page Application (SPA) without a Node.js server backbone.

* **`+layout.ts`**: Explicitly disables Server-Side Rendering (SSR) and enforces static prerendering.
```typescript
export const prerender = true;
export const ssr = false;

```


* **`+layout.svelte`**: The persistent application shell that imports the global `app.scss` stylesheet and wraps the main `<slot />`.
* **`+page.svelte`**: The interactive interface orchestrating file dropzones and progress logs.

### Communication Implementation Model (`+page.svelte`)

Communication with the system layer uses asynchronous multi-channel IPC frameworks.

```typescript
import { invoke, Channel } from '@tauri-apps/api/core';

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
        case "FileProcessed":
            console.log(`Metrics Updated: Checked count: ${message.data.processed}`);
            break;
        case "Finished":
            console.log("Batch processing complete across folders.");
            break;
    }
};

async function triggerExtractionBatch(selectedFolders: string[]) {
    try {
        await invoke('process_mkv_directory', {
            paths: selectedFolders,
            onProgress: progressChannel
        });
    } catch (error) {
        console.error(`Native runtime error reported: ${error}`);
    }
}

```

---

## 15. Backend Native Layer (Tauri 2.0 & Rust)

The file system processing pipeline logic is fully managed inside `packages/backend/src/lib.rs`. It provides multi-threaded processing optimizations, safe cancel state handling, and a custom raw-text SubRip to ASS transcoding layout engine.

### Essential Operations Performed Natively

1. **Sidecar Verification Phase:** Fires asynchronous internal validation checks targeting embedded binary locations to extract structural runtime parameters (`ffmpeg -version`).
2. **Layout Parsing Structure:** Uses `ffprobe` sidecars with specific formatting configuration mappings to scan targets, fetch track maps, check metadata language tags, and isolate binary layout properties (`default_flag`, `forced_flag`).
3. **Async Subprocess Spawn:** Launches independent `ffmpeg` extraction sub-routines safely mapped inside Tokio task configurations to isolate raw target tracks into temporary filesystem locations.
4. **Rust Transcoding Core Engine:** Parses linear raw time markers out of SRT logs via standard buffers and structurally rewrites text elements using customized style blocks inside highly optimized Advanced SubStation Alpha (ASS) files.

---

## 16. Building for Production / Distribution

When you are ready to compile the application into a single, production-ready release package for distribution, invoke the global bundler.

Execute from the workspace root:

```bash
pnpm tauri build

```

### Packaging Actions Triggered:

1. The script triggers a production build across the SvelteKit frontend layout, performing tree-shaking, JavaScript optimization, and code compilation into static directory assets.
2. The Tauri compilation engine reads the target host operating system platform context.
3. Cargo optimizes and compiles the Rust code with full release optimizations flags (`-C opt-level=3`).
4. The system automatically fetches your embedded host architecture sidecars from `packages/backend/binaries/`, drops them cleanly inside the application payload container, and completely ignores the other unused architecture files.
5. **Output Path:** Completed installers (`.msi` / `.exe` on Windows, `.dmg` / `.app` on macOS, `.deb` / `.AppImage` on Linux) are written into:
`packages/backend/target/release/bundle/`

---

## 17. Troubleshooting & Common Pitfalls

### ❌ Issue: System terminal output UI reports old engine versions after file upgrades

* **Cause:** Cargo optimizes compilation performance by aggressively caching system binary assets inside its compilation folder structure. If you swap physical files on your drive, Cargo may fail to recognize the filesystem modifications.
* **Resolution:** Wipe the internal target cache cleanly before restarting your development environment:
```bash
cd packages/backend
cargo clean
cd ../..
pnpm dev

```



### ❌ Issue: IDE highlights permission blocks with "Value is not accepted" warnings

* **Cause:** The auto-generated security schema specification blueprint (`packages/backend/gen/schemas/desktop-schema.json`) is currently out of sync with your new custom Rust plugin definitions.
* **Resolution:** Ensure the dependency is explicitly registered inside `packages/backend/Cargo.toml`, then restart the dev pipeline to force schema generation:
```bash
cd packages/backend && cargo add tauri-plugin-shell
cd ../.. && pnpm tauri dev

```


*(If warnings linger in VS Code, execute `Developer: Reload Window` from your command palette to refresh internal schemas).*

### ❌ Issue: macOS crashes or reports the sidecar binary file is "damaged" or untrusted

* **Cause:** Apple Gatekeeper automatically appends an extended quarantine metadata attribute flag (`com.apple.quarantine`) onto raw executables downloaded via web browsers.
* **Resolution:** Strip the security metadata quarantine flag manually via your Mac terminal workspace layout space:
```bash
xattr -dr com.apple.quarantine packages/backend/binaries/ffmpeg-aarch64-apple-darwin
xattr -dr com.apple.quarantine packages/backend/binaries/ffprobe-aarch64-apple-darwin

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
