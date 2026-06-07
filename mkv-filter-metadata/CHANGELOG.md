# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added structural logging (tracing).
- Added Vitest and Rust tests.
- Per-row "Open Output Folder" buttons.
- ETA tracking and Storage Saved metrics.
- Svelte 5 runes for state management.
- Fully dynamic and typed Video Encoder capabilities.

### Changed
- Migrated Rust backend to Edition 2024.
- Handled SvelteKit `vite` warning correctly using `customLogger`.
- Dark/light mode theme toggling with smooth transitions.

### Fixed
- Re-architectured backend `Preset` and `ConversionMode` strings to proper type-safe Rust Enums.
- Prevented identical file names in input directories from overwriting the single output file.
- Prevented XSS vector in toast component `{@html}` tags.
