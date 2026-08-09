# 10. Vitest Coverage Thresholds

Date: 2026-08-09

## Status

Accepted

## Context

We use `vitest` for frontend unit testing and rely on its coverage provider (V8) to track test completeness. Enforcing coverage thresholds is a standard practice to prevent technical debt and ensure regressions aren't introduced by untested code. However, our frontend framework, Svelte 5 (with its new Runes system), compiles `.svelte` files in a way that introduces significant hidden branching logic (e.g., reactivity invalidations, getters/setters, lifecycle hooks) into the output artifacts that are evaluated by the coverage engine.

This compilation artifact issue artificially inflates the number of "branches" in our codebase, making it practically impossible to achieve 100% branch coverage without writing excessive, brittle tests that solely target compiler-generated code rather than our actual business logic.

## Decision

We are implementing explicit coverage thresholds in `frontend/vite.config.ts` but intentionally relaxing the branch threshold:

- **Statements**: 90%
- **Functions**: 90%
- **Lines**: 90%
- **Branches**: 70%

## Consequences

### Positive

- **Realistic Standards**: Developers are not forced to write fragile tests to cover Svelte's internal reactivity engine.
- **High Confidence**: The strict 90% requirement for statements, lines, and functions ensures that almost all actual developer-written code is executed during the test suite.

### Negative

- **Coverage Blindspots**: By lowering branch coverage to 70%, it is possible that genuine edge cases in complex `if/else` statements within our business logic might slip through untested. We mitigate this through careful code review and prioritizing logic abstraction into pure functions (tested separately) rather than burying it inside Svelte component templates.
