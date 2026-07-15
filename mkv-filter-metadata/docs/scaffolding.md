---
title: "Scaffolding & Setup"
last_updated: 2026-07-14
---

# Scaffolding & Setup

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | v24+ | Required for Vite/SvelteKit |
| **pnpm** | v9+ | Workspace package manager |
| **Rust** | 1.85+ (Edition 2024) | Via `rustup` |
| **Rust Components** | `clippy`, `rustfmt` | `rustup component add clippy rustfmt` |
| **OS Build Tools** | — | See below |

**OS-Specific Build Tools & Sysinfo Hooks:**
- **Windows:** Visual Studio C++ Build Tools (Required for `sysinfo` CPU/RAM telemetry hooks and Tauri).
- **macOS:** Xcode Command Line Tools (Provides `sysinfo` access to `mach` kernel telemetry).
- **Linux:** `build-essential`, `curl`, `wget`, `file`, `libssl-dev`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev` (Provides `sysinfo` access to `/proc` stats).

---

## Getting Started

```bash
# 1. Clone the repository
git clone <repo-url>
cd mkv-filter-metadata

# 2. Install Node dependencies
pnpm install

# 3. Download sidecar binaries (FFmpeg, FFprobe, MKVMerge)
pnpm prebuild

# 4. Launch the development environment
pnpm dev
```

This starts Vite's dev server on `http://localhost:1420` and compiles + launches the Tauri native window simultaneously.

---

## Testing & Quality Assurance

The monorepo uses `vitest` for the SvelteKit frontend and `cargo test` for the Rust backend.
Code coverage is strictly enforced at **>89%** for the frontend (locked via `vite.config.ts`) and heavily tracked via `cargo-llvm-cov` for the backend.

```bash
# Run all unit tests (Frontend + Backend)
pnpm test

# Generate coverage reports (requires llvm-cov)
pnpm test:coverage
```
