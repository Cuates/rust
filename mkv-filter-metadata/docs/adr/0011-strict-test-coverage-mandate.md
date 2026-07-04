---
date: 2026-07-04
status: "accepted"
author: "AI Assistant"
---

# 11. Strict Test Coverage Mandate

## Context

As the monorepo matured with complex UI interactions (drag-and-drop, theme toggles, grid layouts) and nuanced backend logic (adaptive system throttling, encoder concurrency clamping), the risk of regressions during rapid development became substantial. We needed a definitive standard for quality assurance across both the SvelteKit frontend and the Tauri backend to ensure release stability.

## Decision

We have mandated a **100% Code Coverage** requirement (Lines and Statements) for the `frontend` workspace via `vitest` and `@testing-library/svelte`. 

For the Rust `backend`, unit test coverage is aggressively expanded using `cargo-llvm-cov` to test core logic (configuration mapping, FFmpeg argument generation, string validation).

To realistically achieve 100% coverage on the frontend without writing redundant or impossible tests (e.g., catching errors from a mocked OS capability that can't fail in the wild), we established the standard of using explicit `/* v8 ignore next */` markers to intentionally exclude hardware-dependent or OS-specific branch states, ensuring the coverage reports accurately reflect meaningful code paths.

## Consequences

- **Positive:** Unprecedented confidence in code stability. Regressions in UI state or Svelte 5 Runes reactivity will be caught immediately in CI.
- **Negative:** Increased developer overhead. Writing isolated tests for Svelte components often requires complex `vi.mock()` configurations to emulate the Tauri `AppHandle` or native sidecar responses.
