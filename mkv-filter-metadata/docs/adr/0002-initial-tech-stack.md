---
date: 2026-06-26
status: "accepted"
author: "AI Assistant"
---

# 2. Initial Tech Stack Selection

## Context

When building a high-performance desktop application for batch-processing video files, we needed a stack that offered near-native performance, low resource overhead, and a modern, maintainable UI architecture. Historically, Electron has been the go-to for web-based desktop apps, but its memory footprint is high.

For the frontend, we needed a reactive framework that could handle high-frequency telemetry (like streaming FFmpeg logs and progress bars) without performance degradation.

## Decision

We chose to build the application as a highly decoupled monorepo using:
- **Tauri v2 (Rust)** for the backend.
- **Svelte 5 (with Runes)** and **Vite** for the frontend.
- **Zod** for strictly validating IPC payloads.

## Consequences

- **Positive:** Tauri significantly reduces the compiled binary size and RAM usage compared to Electron.
- **Positive:** Svelte 5 Runes (`$state`, `$derived`) provide granular reactivity, allowing us to update rapidly changing progress bars without re-rendering entire component trees or relying on clunky Svelte 4 stores.
- **Positive:** The strict boundary (IPC only, validated by Zod) enforces clean API contracts between the UI and system layers.
- **Negative:** Requires developers to be proficient in both Rust (system programming) and modern frontend tooling, raising the barrier to entry slightly compared to a pure JS stack.
