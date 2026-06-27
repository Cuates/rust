# 5. Composite Action CI/CD Environment Management

Date: 2026-06-27

## Status

Accepted

## Context

Our GitHub Actions Continuous Integration (CI) pipeline requires specific environment dependencies across all execution runners (Ubuntu, macOS, Windows). These include:
- Operating System specific system packages (Tauri OS dependencies like `libwebkit2gtk-4.1-dev` for Linux).
- Node.js and the `pnpm` package manager (tied to a specific lockfile version).
- Rust toolchain with specific formatting and linting components (`dtolnay/rust-toolchain`).
- Rust caching strategies (`Swatinem/rust-cache`).
- Application-specific native sidecar binaries caching.

Previously, these configuration steps were manually duplicated across every job (`lint`, `test`, `build`, `test-windows`, `test-macos`). This repetition violated DRY principles, caused excessive maintenance overhead when bumping engine versions (like Node 24 or pnpm 11), and led to pipeline drift. Furthermore, having sequential job constraints (e.g. `needs: [lint]`) artificially increased the total build time by preventing valid concurrent executions of targets.

## Decision

We are introducing a **GitHub Composite Action** at `.github/actions/mkv-subtitle-converter-setup/action.yml` to centralize all foundational CI environment bootstrapping.

- All CI jobs will invoke this unified Composite Action rather than reimplementing dependency resolution logic.
- The monolithic job constraints (`needs: [lint]`) have been removed from the main workflow (`.github/workflows/mkv-subtitle-converter-ci.yml`) to allow parallel execution of jobs.
- We switched our primary Rust test coverage action from `cargo-tarpaulin` to `cargo-llvm-cov` to align frontend and backend coverage commands locally in the `package.json` while maintaining CI pipeline efficiency.

## Consequences

### Positive
- **Maintainability:** A single source of truth for Node, Rust, and caching versions. Upgrading pnpm or Node.js only requires modifying one step.
- **Speed:** By removing sequential job locks, the macOS, Windows, and Ubuntu tests can immediately start running in parallel, significantly reducing overall CI duration.
- **Readability:** The primary workflow YAML is dramatically shorter and easier to interpret, strictly outlining *what* commands are run rather than *how* the runner gets provisioned.

### Negative
- **Debugging Abstraction:** Errors occurring deep within the environment setup are now abstracted into a secondary file, slightly increasing cognitive load during pipeline failure forensics for developers unfamiliar with composite actions.
- **Working Directory Coupling:** Composite Actions execute at the repository root by default. Step definitions that interact with `package.json` must be explicitly bound to `working-directory: mkv-subtitle-converter` to prevent monorepo pathing failures.
