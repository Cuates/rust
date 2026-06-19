# Contributing to MKV Subtitle Converter

First off, thanks for taking the time to contribute! 🎉

## Development Workflow

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Node.js](https://nodejs.org/) (latest LTS)
- [pnpm](https://pnpm.io/installation) (recommended package manager)
- [Tauri Dependencies](https://tauri.app/v1/guides/getting-started/prerequisites) (platform-specific C++ build tools)

### Quick Start
```bash
# Install frontend dependencies
pnpm install

# Start the development server (runs Vite + Tauri side-by-side)
pnpm tauri dev
```

### Code Style & Guidelines

#### Frontend (SvelteKit + TypeScript)
- **Svelte 5 Runes**: Use runes (`$state`, `$derived`, `$effect`, `$props`) instead of old Svelte 4 reactivity syntax (`export let`, `$:`) wherever possible.
- **Formatting**: We use Prettier. Run `pnpm format` before committing.
- **Linting**: Run `pnpm lint` to check for TypeScript and ESLint errors.
- **Strict Types**: Validate all IPC payloads crossing the Rust boundary using Zod schemas located in `frontend/src/lib/types.ts`.

#### Backend (Rust)
- **Error Handling**: Do not use `.unwrap()` or `.expect()` in command handlers unless absolutely necessary (e.g. a static `Regex` compilation). Use the custom `AppError` type and the `?` operator.
- **Async Execution**: Tauri commands that do I/O or heavy compute must be `async`. CPU-bound blocking tasks (e.g. SQLite queries) should be wrapped in `tokio::task::spawn_blocking`.
- **Sidecar Management**: Any `CommandChild` process spawned via the `tauri-plugin-shell` must be registered in the `AppState`'s process session tracker to ensure they are cleaned up on abort or window close.
- **Formatting**: Run `cargo fmt` before committing.
- **Linting**: Run `cargo clippy -- -D warnings` to check for common issues.

## Submitting Pull Requests
1. Fork the repo and create your branch from `main`.
2. Add tests for any new logic or components.
3. Update `CHANGELOG.md` with your changes.
4. Ensure all tests pass (`pnpm test:unit`).
5. Open a PR with a descriptive title and detailed summary.
