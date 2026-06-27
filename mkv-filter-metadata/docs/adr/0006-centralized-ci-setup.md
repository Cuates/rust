---
title: "0006. Centralized CI Setup via Composite Action"
date: 2026-06-27
status: accepted
---

# 6. Centralized CI Setup via Composite Action

Date: 2026-06-27

## Status

Accepted

## Context

Our GitHub Actions CI pipeline (`mkv-filter-metadata-ci.yml`) originally duplicated the environment setup steps (installing Tauri OS dependencies, setting up pnpm, configuring Node.js, setting up the Rust toolchain, caching Rust dependencies, and downloading sidecars) across all individual jobs (lint, test, build). This repetition bloated the workflow file to nearly 200 lines and made maintenance difficult. Additionally, as we prepared to introduce macOS and Windows testing, the cache keys for our sidecar binaries did not differentiate between operating systems or architectures, risking cross-platform cache collisions.

## Decision

We decided to mimic the CI optimization pattern established in the `mkv-subtitle-converter` project:
1. Extract all environment setup steps into a single GitHub Composite Action located at `.github/actions/mkv-filter-metadata-setup/action.yml`.
2. Refactor all existing and future CI jobs to use this composite action, significantly reducing boilerplate.
3. Update the sidecar cache key to dynamically include `${{ runner.os }}` and `${{ runner.arch }}` to securely isolate cached binaries per platform.
4. Expand the CI test matrix to include `test-windows` and `test-macos` jobs, ensuring cross-platform stability for the Tauri backend.

## Consequences

### Positive
* **Maintainability:** The main CI workflow file is drastically simplified. Updates to the environment setup only need to be made in one location.
* **Cache Integrity:** Sidecar binaries are correctly cached per OS and architecture, preventing corrupted or mismatched binaries from breaking jobs on different runners.
* **Coverage:** We now have automated testing on Windows and macOS in addition to Linux.

### Negative
* **Complexity:** The CI pipeline is now split across multiple files, requiring contributors to understand how composite actions work when debugging setup failures.
