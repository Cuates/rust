---
title: "ADR 0002: Decentralize Project Documentation"
status: "Accepted"
last_updated: 2026-07-02
---

# 2. Decentralize Project Documentation

Date: 2026-06-27

## Status

Accepted

## Context

The `MKV-Filter-Metadata` project previously contained a monolithic, 400-line `README.md` at the project root. While this was acceptable for human readers using a Table of Contents, it presented an issue for AI agents acting on the repository. Providing large context chunks containing irrelevant domain information (e.g., providing Svelte UI details to an agent working on a Rust transcode bug) increases API token usage, introduces noise into RAG (Retrieval-Augmented Generation) pipelines, and can negatively impact LLM accuracy and focus.

## Decision

We will adopt a decentralized documentation structure, mirroring the architecture of the sibling `MKV-Subtitle-Converter` project. The structure is implemented as follows:

1. **Root `README.md`**: Condenses into an executive summary and serves as a directory hub linking to specific domain documentation.
2. **`docs/` Directory**: Contains overarching architectural documentation broken into logical chunks (`architecture.md`, `scaffolding.md`, `distribution.md`, `troubleshooting.md`).
3. **Workspace Specific READMEs**: 
   - `frontend/README.md`: Contains Svelte, Vite, and UI-specific documentation.
   - `backend/README.md`: Contains Tauri, Rust, and pipeline execution documentation.

## Consequences

- **Positive:** Improved AI agent context ingestion by allowing agents to read targeted domain knowledge instead of parsing a monolithic file.
- **Positive:** Better separation of concerns. Frontend developers and agents can focus on `frontend/README.md`.
- **Negative:** Increased initial effort to maintain links between multiple markdown files (mitigated by our `.agents/skills/sync_docs` skill).
