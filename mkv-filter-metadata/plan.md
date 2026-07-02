---
title: "Project Plan & Sandbox"
last_updated: 2026-07-02
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

## 💡 Sandbox Notes
*(Use this space to draft ideas, outline upcoming Epics, or sketch workflows before converting them into GitHub issues or ADRs)*

- **Idea**: Add an option to skip processing if the file size won't be meaningfully reduced.
- **Idea**: Expose more FFmpeg video filters (e.g., deinterlacing) if users request it.
