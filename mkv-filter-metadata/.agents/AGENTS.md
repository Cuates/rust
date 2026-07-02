---
title: "Agent Rules for MKV Filter Metadata"
audience: "AI Agents"
---

# Agent Guidelines

When operating within the `MKV-Filter-Metadata` workspace, adhere to the following rules:

1. **Frontend Architecture:**
   - Always use **Svelte 5 Runes** (`$state`, `$derived`, `$effect`, `$props`). Do not introduce legacy Svelte 4 stores unless explicitly asked.
   - The frontend is located in `/frontend`. Use standard web technologies (SCSS, Vite).

2. **Backend Architecture:**
   - The backend uses **Tauri v2** and **Rust**. 
   - All IPC communication must happen via Tauri's `invoke` and `emit` commands. Do not introduce HTTP or WebSocket servers.
   - Core FFmpeg processing logic lives in `backend/src/process.rs`.
   - Use `tauri-plugin-store` for persistent configuration state; do not write custom JSON files for settings.

3. **Type Safety & IPC:**
   - Ensure all IPC payloads are validated with **Zod** schemas on the frontend and match corresponding Rust structs on the backend.
   - Rust enums (e.g., VideoCodec, ConversionMode) must serialize consistently to the frontend.

4. **Dependency Management:**
   - This is a `pnpm` workspace. Always use `pnpm` commands from the root directory when adding or managing dependencies (e.g., `pnpm add -D <package> --filter frontend`).

4. **Documentation Maintenance:**
   - When making significant architectural changes, propose a new ADR in `docs/adr/`.
   - Ensure `docs/KNOWLEDGE_GRAPH.md` remains accurate if data flows change.
   - When updating UI features or dependencies, ensure `frontend/README.md` is updated.
   - When updating pipeline logic or Rust dependencies, ensure `backend/README.md` is updated.
   - Update overarching documentation files (`docs/architecture.md`, `docs/scaffolding.md`, `docs/distribution.md`, `docs/troubleshooting.md`) as needed.

5. **CI/CD Pipeline:**
   - **Environment Setup**: All CI environment setup (Node, pnpm, Rust, Caching) must be delegated to the local Composite Action `.github/actions/mkv-filter-metadata-setup`.
   - **Working Directories**: When authoring steps inside the composite action, always explicitly define `working-directory: mkv-filter-metadata` for pnpm/cargo commands to prevent monorepo pathing failures.
   - **Test Deduplication**: The Ubuntu runner (`Test Coverage`) executes strictly `pnpm run test:coverage` without a standard `pnpm test` step to prevent redundant double-execution of the test suites.

6. **Frontend Testing:**
   - **TypeScript & SvelteKit Sync**: During isolated testing routines (e.g. CI environments), ensure frontend testing scripts (`vitest`) are always prefixed with `svelte-kit sync`. This guarantees the `.svelte-kit` directory and base `tsconfig.json` are dynamically generated, preventing compiler resolution warnings.

7. **Storage & Concurrency:**
   - Always ensure `reencode_concurrency` remains fully decoupled from mechanical drive constraints. HDD thrashing only applies to streaming `Remux` writes, not slow CPU/GPU re-encodes.
   - When modifying backend concurrency logic, software encoders (`libx264`, `libx265`) must be strictly clamped to prevent OS CPU starvation, as they heavily parallelize internally.
   - When modifying pipeline execution, respect the `sysinfo` Adaptive Throttling safeguards to prevent total OS lockups.
