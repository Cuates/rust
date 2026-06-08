# Contributing to MKV Filter Metadata

Thank you for considering contributing to MKV Filter Metadata!

## Development Setup

1. Ensure you have the required tools installed (see [Prerequisites](README.md#prerequisites)):
   - **Node.js** v18+, **pnpm** v9+, **Rust** 1.85+ with `clippy` and `rustfmt`
2. Clone the repository:
   ```bash
   git clone <repo-url>
   cd mkv-filter-metadata
   ```
3. Install Node dependencies:
   ```bash
   pnpm install
   ```
4. Download sidecar binaries (FFmpeg, FFprobe, MKVMerge):
   ```bash
   pnpm prebuild
   ```
5. Launch the dev environment:
   ```bash
   pnpm dev
   ```

## Code Quality Checks

Before submitting changes, run the full verification suite from the workspace root:

```bash
# Type-check frontend (svelte-check) and backend (cargo check)
pnpm check

# Auto-fix lint + format issues across both layers
pnpm fix

# Run all tests (Vitest + cargo test)
pnpm test
```

## Pull Request Process

1. Run `pnpm check` and `pnpm fix` to ensure your code is well-typed and formatted.
2. Run `pnpm test` to verify frontend and backend tests pass.
3. Update `CHANGELOG.md` with notes describing your changes under `[Unreleased]`.
4. Open a Pull Request on GitHub. We will review it as soon as possible.

## Project Structure

- **Frontend** (`frontend/`): Svelte 5 with SvelteKit, Vite, TypeScript, and Zod. State management uses Svelte 5 runes (`$state`, `$derived`, `$effect`).
- **Backend** (`backend/`): Rust with Tauri v2. Modularized into `commands.rs` (IPC handlers), `process.rs` (FFmpeg pipeline logic), `models.rs` (type definitions), and `error.rs` (error types).
- **Root**: Workspace orchestrator only — no application code. All scripts route to the appropriate layer.
