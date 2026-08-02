---
title: "Strict IPC Type Generation"
last_updated: 2026-08-02
---

# 13. Strict IPC Type Generation

Date: 2026-08-02

## Status

Accepted

## Context

The application utilizes a Tauri v2 architecture where a Rust backend communicates heavily with a Svelte 5 frontend via asynchronous Inter-Process Communication (IPC). Previously, TypeScript payload types (such as settings shapes, video codecs, progress updates, and file metadata) were maintained manually on the frontend to match the Rust structs on the backend. This created a significant maintenance burden and a frequent source of silent failure; if a Rust struct field was renamed, added, or changed in type, the frontend TS interface would fall out of sync, leading to runtime failures that were not caught by `svelte-check` or `cargo check`.

## Decision

We have implemented an automated type generation pipeline using `specta` and `specta-zod`.

1. **Rust Derivation**: All backend domain structs involved in IPC communication are now decorated with `#[derive(Type)]` from the `specta` crate.
2. **Export Binary**: We introduced a custom Rust binary script (`backend/src/bin/export_zod.rs`) that scrapes these types at compile time.
3. **Generation**: Running `pnpm generate:types` executes the `export_zod.rs` binary, which automatically generates strict Zod schemas and TypeScript interfaces into `frontend/src/lib/types.ts`.
4. **Validation**: The frontend now imports and utilizes these auto-generated Zod schemas to validate all payloads crossing the IPC bridge.

## Consequences

- **Pros**: Complete type safety across the IPC boundary. The compiler enforces consistency, entirely eliminating a class of runtime bugs caused by mismatched struct fields or enums. No manual typing of shared data structures is required.
- **Cons**: Adds a new dependency (`specta`, `specta-zod`) to the backend and slightly complicates the developer workflow (developers must remember to run `pnpm generate:types` when modifying Rust structs). We mitigate this by documenting the command prominently.
