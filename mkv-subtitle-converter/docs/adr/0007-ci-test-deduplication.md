# 7. CI Pipeline Test Deduplication

Date: 2026-06-27

## Status

Accepted

## Context

In our `.github/workflows/mkv-subtitle-converter-ci.yml` pipeline, the `test` job running on `ubuntu-latest` was previously executing the complete test suite twice. It first ran the standard `pnpm test` step, followed immediately by the `pnpm run test:coverage` step. Because `test:coverage` inherently executes both the frontend (`vitest`) and backend (`cargo llvm-cov`) tests with instrumentation, the initial `pnpm test` step was completely redundant and needlessly consumed approximately 6 minutes of compute time.

## Decision

We have eliminated the standard `pnpm test` step from the Ubuntu runner. The `Test & Coverage` job now strictly executes `pnpm run test:coverage`.

The standard `pnpm test` script remains in `package.json` to support fast local testing and to serve the Windows and macOS CI runners, which intentionally run un-instrumented tests to bypass the overhead of generating OS-specific coverage maps.

## Consequences

### Positive
- **Reduced Pipeline Duration**: Drops the Ubuntu CI execution time from ~13 minutes to ~6-7 minutes.
- **Compute Efficiency**: Reduces billable GitHub Actions minutes by eliminating duplicate workflows.

### Negative
- None. Test coverage guarantees and cross-platform validations remain strictly enforced.
