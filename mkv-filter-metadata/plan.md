---
title: "Project Plan & Sandbox"
last_updated: 2026-07-14
status: "active"
---

# 📝 Workflow & Planning

This document serves as a high-level roadmap and sandbox for human and AI collaboration on the **MKV Filter Metadata** project.

## 🎯 Current Objectives
- [x] Decentralize monolithic README for improved AI agent ingestion.
- [x] Establish standard documentation (START_HERE, KNOWLEDGE_GRAPH, ADRs).
- [x] Refactor GitHub Actions CI/CD to use centralized setup and cross-platform jobs.
- [x] Implement system resource management (CPU/RAM telemetry) to prevent freezes.
- [x] Implement target drive type (HDD vs SSD) constraints to prevent IO thrashing.
- [x] Implement encoder-aware concurrency limits to protect OS CPU resources.
- [x] Monitor pipeline telemetry stability across platforms and expand Vitest coverage.
- [x] Synchronize all markdown documentation files to perfectly reflect the 1.3.0 release.
- [x] Bump application to version 1.3.1 and execute a full documentation sync and architecture tree refresh.
- [x] Bump application to version 1.4.0 and implement the "Open Processed Files Folder" cross-platform feature.
- [x] Execute major UI/UX redesign (Three-Tier Responsive Grid, Command Palette).
- [x] Integrate `tauri-plugin-window-state` for persistent session memory.
- [x] Implement clean, real-time pipeline output logging.
- [x] Bump application to major version 2.0.0 and sync all monorepo documentation.
- [x] Redesign Target Processing Queue UI with pill-based rows, file counts, aggregate sizes, and custom tooltips.
- [x] Expand backend Rust test coverage via `cargo-llvm-cov` and reach 100% test coverage for the SvelteKit frontend via `vitest`.
- [x] Bump application to version 2.1.0 and sync all monorepo documentation.
- [x] Implement 1.5s System Guard grace period to prevent false-positive resource congestion toasts at startup.
- [x] Lock in strict SvelteKit test thresholds (>99%) and resolve edge-case coverage gaps to reach `99.36%` branch coverage on core components.
- [x] Bump application to version 2.2.0 and sync all monorepo documentation.
- [x] Completely eliminate magic strings by migrating all DOM events, Tauri commands, and UI strings into a centralized `constants.ts` file.
- [x] Resolve all strict `any` and `unknown` TypeScript errors across frontend payloads.
- [x] Bump application to version 2.3.0 and sync all monorepo documentation.
- [x] Bump application to version 2.4.0 and implement GitHub Actions Release Pipeline.

## 💡 Sandbox Notes
*(Use this space to draft ideas, outline upcoming Epics, or sketch workflows before converting them into GitHub issues or ADRs)*

- **Idea**: Add an option to skip processing if the file size won't be meaningfully reduced.
- **Idea**: Expose more FFmpeg video filters (e.g., deinterlacing) if users request it.
