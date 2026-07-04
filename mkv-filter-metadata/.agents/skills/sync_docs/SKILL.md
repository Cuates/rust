---
name: sync_docs
description: Synchronizes documentation metadata and checks for stale ADRs or missing frontmatter in markdown files.
last_updated: 2026-07-04
---

# Sync Docs Skill

This skill allows agents to scan the documentation directories and ensure they conform to our standards.

## Usage Guidelines

1. **Triggering**: The agent can trigger this logic automatically when instructed to "audit docs" or "sync docs".
2. **Checks Performed**:
   - Verify every markdown file in `docs/` and `.agents/` has valid YAML frontmatter.
   - Verify that `START_HERE.md`, `plan.md`, `frontend/README.md`, and `backend/README.md` exist.
   - Ensure new ADRs (like `0007-adaptive-throttling-and-storage-concurrency.md` and `0008-encoder-aware-concurrency.md`) are properly indexed in `docs/architecture.md`.
3. **Actions**: 
   - Add missing YAML frontmatter.
   - Update `last_updated` dates if significant changes were found in Git history.
