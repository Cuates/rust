# 🎬 MKV Filter Metadata

[![Maintained? yes](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://GitHub.com/Cuates/rust/graphs/commit-activity)
[![MKV Filter Metadata CI](https://github.com/Cuates/rust/actions/workflows/mkv-filter-metadata-ci.yml/badge.svg)](https://github.com/Cuates/rust/actions/workflows/mkv-filter-metadata-ci.yml)
[![Version](https://img.shields.io/badge/version-1.2.2-blue.svg)](https://github.com/Cuates/rust)
[![Made with Rust](https://img.shields.io/badge/Made%20with-Rust-1f425f.svg)](https://www.rust-lang.org/)
[![Made with Svelte](https://img.shields.io/badge/Made%20with-Svelte-FF3E00.svg)](https://svelte.dev/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8D8.svg)](https://tauri.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A powerful batch-processing desktop application for filtering MKV metadata, stripping unwanted subtitle/audio tracks, and optionally re-encoding video files with hardware-accelerated codecs. Built with **Tauri v2**, **Svelte 5**, and **Rust**.

Built on top of a highly optimized **pnpm monorepo workspace architecture**, the app cleanly splits its responsibilities across a reactive **Svelte 5 / SvelteKit** web-view frontend layout layer and a native **Tauri v2 / Rust** system execution backend layer. Crucially, the app ships completely self-contained by embedding cross-platform, static **FFmpeg**, **FFprobe**, and **MKVMerge** architecture sidecars, completely removing the requirement for users to have global dependencies installed on their operating systems.

The processing pipeline features **Adaptive System Throttling** to monitor host CPU/RAM resources in real-time, preventing freezes during massive workloads, alongside **Storage-Aware Concurrency Constraints** that protect mechanical hard drives (HDDs) from physical read/write head thrashing during stream copies while still allowing maximum GPU parallelization during re-encodes.

---

## 📖 Documentation Directory

For in-depth documentation, please refer to the specific files below:

- [**Architecture & Tree Structure**](docs/architecture.md): Overview of the monorepo layout and workspace configurations.
- [**Frontend Layer (SvelteKit)**](frontend/README.md): Details on the reactive Svelte 5 frontend and IPC communication.
- [**Backend Layer (Rust)**](backend/README.md): Details on the Tauri backend and native operations.
- [**Scaffolding & Setup**](docs/scaffolding.md): Prerequisites and instructions on getting started.
- [**Building for Distribution**](docs/distribution.md): Instructions for compiling production releases.
- [**Troubleshooting**](docs/troubleshooting.md): Solutions to common errors and pitfalls.

---

## Developer Commands

All commands are run from the workspace root:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Launch Vite dev server + Tauri window in parallel |
| `pnpm build` | Production build (frontend bundle + Rust release binary) |
| `pnpm check` | Type-check both Svelte (svelte-check) and Rust (cargo check) |
| `pnpm fix` | Auto-fix lint + format issues across both frontend and backend |
| `pnpm test` | Run Vitest (frontend) and cargo test (backend) |
| `pnpm test:coverage` | Generate coverage reports for both layers |
| `pnpm audit` | Security audit for npm and Cargo dependencies |
| `pnpm clean` | Deep clean: wipe node_modules, Cargo target, then reinstall |
| `pnpm prebuild` | Download sidecar binaries for your platform |
| `pnpm app-info` | Print Tauri environment diagnostics |

---

## License

This project is licensed under the [MIT License](LICENSE).