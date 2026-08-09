---
title: "Start Here"
last_updated: 2026-08-09
audience: "Contributors"
---

# 🎬 MKV Subtitle Converter: Quick Start

Welcome to the **MKV Subtitle Converter** project! This is a high-performance desktop utility that extracts embedded SubRip (SRT) files from MKV containers and formats them into Advanced SubStation Alpha (ASS) subtitles.

## 🏗️ Architecture at a Glance

This project is a highly decoupled **pnpm monorepo**:

- **Frontend (`/frontend`)**: SvelteKit (SPA mode), Svelte 5 Runes, Vite. IPC payload types are consumed from `src/lib/types/ipc.ts` (auto-generated — do not edit manually).
- **Backend (`/backend`)**: Tauri 2.0, Rust, and Tokio (utilizing robust `CancellationToken` state management). Structs in `models.rs` carry `#[derive(specta::Type)]` so they can be exported to TypeScript via `pnpm run generate:types`.
- **Sidecars (`/backend/sidecars`)**: Embedded FFmpeg and FFprobe binaries for native processing without global system dependencies.
- **IPC Type Pipeline**: `backend/src/bin/export_zod.rs` generates `frontend/src/lib/types/ipc.ts` from Rust structs. Run `pnpm run generate:types` after any model change. CI blocks PRs where this file is out of sync.
- **CI/CD (`/.github`)**: Centralized environment bootstrapping uses our custom Composite Action (`mkv-subtitle-converter-setup`), alongside automated parallel test suites, dependency audit gate, IPC sync verification, and a cross-platform GitHub Actions Release Pipeline.

## 🛠️ Prerequisites

- **Node.js**: v20 LTS+
- **pnpm**: v8+
- **Rust Toolchain**: Stable channel
- **OS Build Tools**: Visual Studio C++ Build Tools (Windows), Xcode (macOS), or essential C-compilers (Linux).

## 🚀 Core Developer Commands

Run these from the **workspace root**:

- `pnpm install`: Installs and symlinks workspace dependencies.
- `pnpm test`: Runs the standard un-instrumented test suite across the frontend and backend (fastest for local dev).
- `pnpm run test:coverage`: Runs the fully instrumented test suite (Vitest coverage + `cargo llvm-cov`) to generate metrics for CI.
- `pnpm run generate:types`: Regenerates `frontend/src/lib/types/ipc.ts` from Rust structs — run after any `models.rs` change.
- `pnpm run check`: Runs `svelte-check` (TypeScript) and `cargo check` across both layers.
- `pnpm run check:deadcode`: Runs `knip` (frontend) and `cargo clippy -D dead_code` (backend).
- `pnpm run fix`: Auto-formats and lints the full workspace (Prettier, ESLint, `cargo fmt`, `cargo clippy --fix`).
- `pnpm run audit`: Runs `pnpm audit` + `cargo audit` to detect known vulnerabilities.
- `pnpm dev`: Starts the Svelte web views via Vite and mounts the native Rust shell.
- `pnpm build`: Compiles standalone platform binaries for production.
- `pnpm clean`: Purges workspace artifacts, caches, and modules cleanly.

## 📚 Dive Deeper

- See the comprehensive [README.md](./README.md) and the `docs/` directory for full architecture and setup details.
- See the [TESTING.md](./TESTING.md) for frontend and backend testing strategies and coverage thresholds.
- See the [Knowledge Graph](./docs/KNOWLEDGE_GRAPH.md) for data flow diagrams.
- See the [Troubleshooting Guide](./docs/troubleshooting.md) for common errors including IPC drift and audit failures.
- See the [Architecture Decision Records](./docs/adr) for historical tech choices.
