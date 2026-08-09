# 9. Specta IPC Type Generation

Date: 2026-08-09

## Status

Accepted

## Context

Communication between the SvelteKit frontend and Tauri backend relies on Inter-Process Communication (IPC) channels. The data payloads (structs) passed back and forth are defined in Rust (`backend/src/models.rs`). Initially, the TypeScript counterparts in the frontend were manually maintained or loosely typed using `any`. This manual maintenance introduces a high risk of type drift, where a change in a Rust struct is not reflected in the frontend, leading to runtime serialization/deserialization errors that are hard to trace.

## Decision

We are implementing an automated type generation pipeline using `specta` and `specta-zod`.

- **Source of Truth**: Rust structs in `models.rs` annotated with `#[derive(specta::Type)]` act as the single source of truth for IPC schemas.
- **Generator**: A new CLI binary at `backend/src/bin/export_zod.rs` is responsible for building a Specta type registry and outputting TypeScript Zod schemas.
- **Output**: The generated file is placed at `frontend/src/lib/types/ipc.ts`. This file is marked as read-only for developers.
- **Command Integration**: We mapped a unified root command `pnpm run generate:types` to execute the generator.
- **CI Enforcement**: The GitHub Actions CI pipeline now includes a step in the `Lint & Check` job that runs `generate:types` and strictly checks for uncommitted changes using `git diff --exit-code`. This blocks any pull request where a developer changed a Rust model but forgot to sync the IPC types.

## Consequences

### Positive

- **Type Safety**: End-to-end type safety between Rust and TypeScript. We eliminate silent IPC payload mismatch errors.
- **Developer Experience**: Zod schemas are generated automatically, allowing frontend developers to use robust runtime validation and inferred static types without writing boilerplate.
- **CI Reliability**: The pipeline guarantees that the main branch never has out-of-sync types.

### Negative

- **Compilation Overhead**: Adding `specta` and its macro derivations slightly increases the Rust compile time for the backend.
- **Tooling Complexity**: Developers must remember to run `pnpm run generate:types` when modifying structs, although the CI gate prevents this from becoming a permanent issue.
