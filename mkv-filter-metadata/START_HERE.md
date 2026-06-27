---
title: "Start Here"
last_updated: 2026-06-26
audience: "Contributors"
---

# 🎬 MKV Filter Metadata: Quick Start

Welcome to the **MKV Filter Metadata** project! This is a high-performance desktop utility that processes MKV files by filtering out unwanted metadata, stripping specific subtitle/audio tracks, and optionally re-encoding video files with hardware-accelerated codecs.

## 🏗️ Architecture at a Glance

This project is a highly decoupled **pnpm monorepo**:
- **Frontend (`/frontend`)**: SvelteKit (SPA mode), Svelte 5 Runes, Vite, and **Zod** for IPC payload validation.
- **Backend (`/backend`)**: Tauri 2.0 and Rust, using `tauri-plugin-store` for configuration state persistence.
- **Sidecars (`/backend/sidecars`)**: Embedded FFmpeg, FFprobe, and MKVMerge binaries for native processing without global system dependencies.
- **Database**: SQLite (via `rusqlite`) for caching processed files and maintaining history.

## 🛠️ Prerequisites

- **Node.js**: v24+
- **pnpm**: v9+
- **Rust Toolchain**: 1.85+ (Edition 2024)
- **OS Build Tools**: Visual Studio C++ Build Tools (Windows), Xcode Command Line Tools (macOS), or essential C-compilers (Linux).

## 🚀 Core Developer Commands

Run these from the **workspace root**:

- `pnpm install`: Installs and symlinks workspace dependencies.
- `pnpm prebuild`: Downloads required sidecar binaries (FFmpeg, FFprobe, MKVMerge).
- `pnpm dev`: Starts the Svelte web views via Vite and mounts the native Rust shell.
- `pnpm build`: Compiles standalone platform binaries for production.
- `pnpm clean`: Purges workspace artifacts, caches, and modules cleanly.

## 📚 Dive Deeper

- See the comprehensive [README.md](./README.md) for full application usage and feature details.
- See the [Knowledge Graph](./docs/KNOWLEDGE_GRAPH.md) for architecture diagrams and data flows.
- See the [Architecture Decision Records](./docs/adr) for historical tech choices.
