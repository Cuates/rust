---
id: 2
title: "Tauri v2 and SvelteKit Decoupled Monorepo"
status: accepted
date: 2026-06-26
deciders: [cuates]
tags: [architecture, svelte, rust, tauri]
---

# Tauri v2 and SvelteKit Decoupled Monorepo

## Context and Problem Statement
The MKV Subtitle Converter requires a high-performance system-level execution engine to parse large video files, but also needs a reactive, modern UI layout. The standard Tauri scaffold wraps the web view directly over the `src-tauri` workspace, which can lead to dependency leakage and monolithic configuration issues.

## Decision
We chose a decoupled pnpm workspace setup:
1. **Frontend**: SvelteKit (SPA mode with `adapter-static`) + Svelte 5 Runes.
2. **Backend**: Tauri 2.0 + Rust + Tokio for async operations.
3. **Monorepo**: A `pnpm-workspace.yaml` splitting the packages into `frontend/` and `backend/`.

## Consequences
* **Good**: Complete isolation of Node/Vite dependencies from the Rust compilation environment.
* **Good**: Svelte 5 provides a highly reactive UI. Rust provides memory-safe, ultra-fast file parsing.
* **Bad**: Requires explicit workspace filters (e.g., `pnpm --filter frontend`) for command execution.
* **Bad**: Requires a more complex root configuration to unify developer commands (`pnpm dev`, `pnpm build`).
