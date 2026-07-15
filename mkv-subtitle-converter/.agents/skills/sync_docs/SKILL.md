---
name: sync_docs
description: "Updates project documentation against the latest codebase changes."
---

# Sync Documentation

Use this skill when the user asks you to "sync the docs", "update project documentation", or similar.

## Process
1. Read `START_HERE.md`, `plan.md`, `docs/KNOWLEDGE_GRAPH.md`, `.agents/AGENTS.md`, and the `docs/adr/` directory. Also review `docs/architecture.md`, `docs/distribution.md`, `frontend/README.md`, and `backend/README.md`.
2. Analyze the `frontend/` and `backend/` directories to understand any structural changes (e.g., new Svelte routes, new Rust IPC commands).
3. If the knowledge graph is outdated, rewrite the Mermaid diagram.
4. If the roadmap is completed, update the `plan.md` tasks to reflect the current state.
5. Create a `walkthrough.md` artifact summarizing what was updated.
