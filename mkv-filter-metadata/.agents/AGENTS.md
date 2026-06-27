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
   - Ensure the `KNOWLEDGE_GRAPH.md` remains accurate if data flows change.
