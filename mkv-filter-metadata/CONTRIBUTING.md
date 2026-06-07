# Contributing to MKV Filter Metadata

First off, thank you for considering contributing to MKV Filter Metadata! 

## Development Setup

1. Make sure you have `pnpm` and `Rust 1.85.0+` installed.
2. Clone the repository.
3. Install node dependencies:
   ```bash
   pnpm install
   ```
4. Fetch sidecar binaries (FFmpeg/MKVMerge):
   ```bash
   pnpm prebuild
   ```
5. Run the dev environment:
   ```bash
   pnpm dev
   ```

## Pull Request Process

1. Run `pnpm check` and `pnpm lint` to ensure your frontend code is well-typed and formatted.
2. Run `cargo clippy -- -D warnings` and `cargo test` to ensure backend correctness.
3. Update the `CHANGELOG.md` with notes of your changes.
4. Open a Pull Request on GitHub. We will review it as soon as possible.
