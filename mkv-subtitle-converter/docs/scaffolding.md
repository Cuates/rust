# Scaffolding Guide

This document outlines the exact steps taken to scaffold the monorepo from scratch. This is primarily for historical reference and understanding the project's foundation. If you are just trying to build or run the app, please refer to the main [README.md](../README.md).

## Base Directory Configuration

To build out or recreate this exact platform layout safely without conflict parameters, prepare a clean filesystem parent context container and transition your terminal environment context:

```bash
mkdir mkv-subtitle-converter
cd mkv-subtitle-converter
```

## Running the Scaffolder

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

## Rearranging into a Monorepo Workspace Split

The standard scaffolding configuration outputs a monolithic block where your web views wrap directly over the `src-tauri` workspace. To transform this setup into a decoupled multi-package repository model, process the following sequence:

1. Move the entire SvelteKit structure into a new location under `frontend/`.
2. Relocate the native backend folder structure entirely under `backend/`.

## Initializing the Root Workspace Files

Once the directory migration completes, configure the multi-package registry states. Create a root `pnpm-workspace.yaml` file using the code provided in the Architecture document. Next, update individual descriptor parameters so the package engine can build an unambiguous mapping index.

Modify **`frontend/package.json`**:

```json
{
  "name": "frontend",
  "private": true,
  "version": "1.10.0"
}
```

Modify **`backend/package.json`**:

```json
{
  "name": "backend",
  "private": true,
  "version": "1.10.0"
}
```

## Fixing Workspace Filtering

By decoupling packages into `frontend` and `backend`, we prevent system configuration files from polluting competing scopes. When executing specific package actions, always utilize `pnpm` workspace filters to ensure precision execution targets:

```bash
# Example of explicit scoped installation filtering
pnpm --filter frontend add <package-name>
```

## Injecting the Global Tauri CLI & Approving Builds

The main administrative orchestration runtime of Tauri v2 must exist at the workspace system root to allow unified execution mappings. Inject the developer CLI directly into the root context with workspace-wide tracking clearance:

```bash
pnpm add -D @tauri-apps/cli -w
```

This enables running commands like `pnpm dev` at the global root level, allowing the CLI to find individual configurations located deeper within the workspace structure.

## Injecting Dependencies into the Frontend Package

The web panel layout layer requires dedicated API interfaces to talk through the Tauri system bridges safely. Navigate to your client layer and install the core framework interfaces and the static compilation adapter:

```bash
cd frontend
pnpm add @tauri-apps/api
pnpm add -D @sveltejs/adapter-static
pnpm add -D sass
```

## Injecting Dependencies into the Backend Package

The desktop application utilizes modular plugin crates to implement system sandboxing. Navigate to the core compilation layer and inject the official system plugins alongside standard utility engines via Cargo:

```bash
cd backend
cargo add tauri-plugin-fs
cargo add tauri-plugin-dialog
cargo add tauri-plugin-opener
cargo add tauri-plugin-shell
cargo add indexmap serde serde_json chrono tokio regex rusqlite
```

## Update Project Build Paths

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
