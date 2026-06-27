---
title: "AI Agent Guidelines"
scope: "project"
---

# MKV Subtitle Converter: Agent Rules

When assisting with this project, adhere to the following rules:

## Technology Stack
- **Frontend**: SvelteKit, Svelte 5 (Runes), SCSS, Vite. Located entirely in `frontend/`.
- **Backend**: Tauri 2.0, Rust, Tokio. Located entirely in `backend/`.

## Command Execution
- Always use pnpm workspace filters when running commands from the root:
  - Example: `pnpm --filter frontend add <package>`
  - Example: `cargo add <crate> --manifest-path backend/Cargo.toml`
- Core scripts (`pnpm dev`, `pnpm build`) are mapped in the root `package.json`.

## Documentation Maintenance
- Use the `docs/adr/` directory for any new Architecture Decision Records.
- Update `START_HERE.md` or `plan.md` if significant architectural or roadmap changes occur.
