---
title: "Project Sandbox & Roadmap"
status: "Active"
version: "1.9.1"
---

# 🗺️ Project Plan & Sandbox

This document tracks current milestones, active tasks, and known edge-cases.

## ✅ Recently Completed
- Handled AI Audit Report findings (MP-1 and MP-2).
- Improved testing completeness and implemented safer history cancellation logic.
- Bumped application version to `1.9.1`.

## 🚧 Current Focus
- Maintain high testing coverage across the Rust and Svelte boundaries using Vitest and Cargo test.
- Optimize the Rust Transcoding Core Engine for parsing massive multi-GB MKV files more efficiently.

## 🐛 Known Edge Cases / Troubleshooting
- **SvelteKit SPA Overwrite Warning**: You may see `Overwriting dist\index.html with fallback page` during build. This is expected and required for Tauri routing. Ignore it.
- **Cached System Binaries**: If Rust UI outputs report old engine versions, run `cd backend && cargo clean` and restart `pnpm dev`.
- **macOS Quarantine**: If sidecars are marked as "damaged" on macOS, run `xattr -dr com.apple.quarantine backend/sidecars/<binary>`.

## 📅 Backlog & Future Ideas
- Add additional custom styling templates for ASS outputs.
- Expand runtime tracking to visualize Tokio thread metrics in the frontend UI.
