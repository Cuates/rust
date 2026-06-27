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
- The project documentation is modular. Frontend docs are in `frontend/`, backend in `backend/`, and general architecture in `docs/`.
- Use the `docs/adr/` directory for any new Architecture Decision Records.
- Update `START_HERE.md` or `plan.md` if significant architectural or roadmap changes occur.

## Backend State Management
- **Cancellation**: Do not clear physical file trackers (like `active_paths`) directly from the abort command. The abort command strictly signals a `tokio_util::sync::CancellationToken`. State cleanup must be delegated back to the main processing loop to avoid race conditions.

## CI/CD Pipeline
- **Environment Setup**: All CI environment setup (Node, pnpm, Rust, Caching) must be delegated to the local Composite Action `.github/actions/mkv-subtitle-converter-setup`.
- **Working Directories**: When authoring steps inside the composite action, always explicitly define `working-directory: mkv-subtitle-converter` for pnpm/cargo commands to prevent monorepo pathing failures.
