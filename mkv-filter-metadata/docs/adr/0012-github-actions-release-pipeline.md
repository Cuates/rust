---
date: 2026-07-14
status: "accepted"
author: "AI Assistant"
---

# 12. GitHub Actions Release Pipeline

## Context

As the `mkv-filter-metadata` project grows within this monorepo, we need a reliable, automated way to build and distribute compiled release artifacts (such as `.AppImage`, `.deb`, `.dmg`, `.msi`, and `.exe` installers) for our Tauri desktop application. The monorepo structure introduces complexities around triggering releases without kicking off builds for unrelated sibling projects.

## Decision

We will implement a GitHub Actions workflow to automate the release process with the following architectural choices:

1.  **Community Action**: We will use `softprops/action-gh-release` to handle the creation of GitHub Releases and the uploading of assets, as it is the most widely adopted and stable community replacement.
2.  **Monorepo Tagging Convention**: To isolate the `mkv-filter-metadata` release lifecycle from other projects in this monorepo, the workflow will only trigger on tags matching the `mkv-filter-metadata-v*` pattern (e.g., `mkv-filter-metadata-v1.0.0`).
3.  **Target Architectures**: The build matrix will build for `ubuntu-latest`, `macos-latest`, and `windows-latest`, taking advantage of Tauri's built-in bundler to compile and package native installers for all major platforms.
4.  **Bundled Assets**: The Tauri bundler automatically places built installers in `backend/target/release/bundle/`. The pipeline will collect these native application installers (like `.msi` and `.dmg`) and upload them to the GitHub release.

## Consequences

*   **Positive**: Releases are fully automated, consistent, and strictly isolated per project within the monorepo. End users receive ready-to-install desktop application packages.
*   **Negative/Constraint**: Building native Tauri bundles across three platforms can be time-consuming. We must rely on GitHub's macOS and Windows runners, which use more action minutes than Linux runners.
