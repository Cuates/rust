---
title: "Start Here"
last_updated: 2026-06-27
audience: "Contributors"
---

# 🎬 MKV Subtitle Converter: Quick Start

Welcome to the **MKV Subtitle Converter** project! This is a high-performance desktop utility that extracts embedded SubRip (SRT) files from MKV containers and formats them into Advanced SubStation Alpha (ASS) subtitles.

## 🏗️ Architecture at a Glance
This project is a highly decoupled **pnpm monorepo**:
- **Frontend (`/frontend`)**: SvelteKit (SPA mode), Svelte 5 Runes, Vite.
- **Backend (`/backend`)**: Tauri 2.0, Rust, and Tokio (utilizing robust `CancellationToken` state management).
- **Sidecars (`/backend/sidecars`)**: Embedded FFmpeg and FFprobe binaries for native processing without global system dependencies.

## 🛠️ Prerequisites
- **Node.js**: v20 LTS+
- **pnpm**: v8+
- **Rust Toolchain**: Stable channel
- **OS Build Tools**: Visual Studio C++ Build Tools (Windows), Xcode (macOS), or essential C-compilers (Linux).

## 🚀 Core Developer Commands
Run these from the **workspace root**:

- `pnpm install`: Installs and symlinks workspace dependencies.
- `pnpm dev`: Starts the Svelte web views via Vite and mounts the native Rust shell.
- `pnpm build`: Compiles standalone platform binaries for production.
- `pnpm clean`: Purges workspace artifacts, caches, and modules cleanly.

## 📚 Dive Deeper
- See the comprehensive [README.md](./README.md) and the `docs/` directory for full architecture and setup details.
- See the [Knowledge Graph](./docs/KNOWLEDGE_GRAPH.md) for data flow diagrams.
- See the [Architecture Decision Records](./docs/adr) for historical tech choices.
