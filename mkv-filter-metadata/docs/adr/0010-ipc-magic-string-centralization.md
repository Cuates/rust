---
date: 2026-07-04
status: "accepted"
author: "AI Assistant"
---

# 10. IPC Magic String Centralization

## Context

As the Tauri application grew, IPC command names (e.g., `"process_mkv_directory"`) and event listener strings (e.g., `"LogMessage"`) were heavily hardcoded as "magic strings" across various Svelte components and Rust files. This scattered approach increased the risk of silent communication failures, as a simple typo in a string would cause a silent failure across the Tauri IPC bridge without any compile-time warnings.

## Decision

We decided to fully eliminate magic strings across the monorepo by centralizing them into dedicated constant modules: `backend/src/constants.rs` for Rust and `frontend/src/lib/constants.ts` for SvelteKit. All Tauri `invoke` calls, event listeners, and backend event emissions must now reference these strictly defined constants.

## Consequences

- **Positive:** Greatly increases IPC robustness. Typographical errors are now caught immediately by the TypeScript and Rust compilers. Renaming an event or command now only requires changing a single source of truth.
- **Negative:** Introduces slight boilerplate overhead. Developers must remember to declare new commands in the constant files rather than simply typing the string inline during rapid prototyping.
