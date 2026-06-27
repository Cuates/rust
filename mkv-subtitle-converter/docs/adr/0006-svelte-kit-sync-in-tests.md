# 6. SvelteKit Sync in Isolated Testing

Date: 2026-06-27

## Status

Accepted

## Context

During continuous integration (CI) test runs, the `pnpm -F frontend test:unit` script executes `vitest` without first running the standard `build` or `dev` commands. This isolation causes a warning: `Cannot find base config file "./.svelte-kit/tsconfig.json"`. 

SvelteKit dynamically scaffolds type declarations and the `.svelte-kit` directory containing base `tsconfig.json` configurations. Without generating this folder prior to running tests, the TypeScript compiler falls back and warns that it lacks type context.

## Decision

We will explicitly prefix our testing commands (both `test:unit` and `coverage`) with `svelte-kit sync` in the `frontend/package.json` file.

```json
"test:unit": "svelte-kit sync && vitest --passWithNoTests",
"coverage": "svelte-kit sync && vitest run --coverage --passWithNoTests"
```

## Consequences

### Positive
- **Clean CI Logs:** Silences the distracting compiler warnings that bloat CI/CD logs.
- **Accurate Typings:** Ensures that Vitest correctly resolves types when running Svelte component unit tests that depend on the generated base config, preventing false positive type errors during the testing phase.

### Negative
- Adds a very marginal overhead (~0.5 - 1.5 seconds) to the test startup phase as SvelteKit regenerates the static types. This is considered acceptable for the benefit of type safety.
