---
title: "ADR 0009: Responsive Layout and UX Enhancements"
status: "accepted"
date: "2026-07-03"
author: "Antigravity (AI Assistant)"
---

# ADR 0009: Responsive Layout and UX Enhancements

## Context
The previous user interface design functioned perfectly but lacked modern UI paradigms, dynamic responsive behaviour at intermediate window widths, and persistent component mounting. As the application handles heavy video transcoding workloads, the UI needs to reflect a robust, desktop-class experience. 

Specifically:
- The main window layout shifted abruptly at a single hardcoded media query.
- The `MetricsPanel` conditionally mounted/unmounted via Svelte `{#if}` blocks, causing jarring layout shifts when a transcoding pipeline started.
- Adding custom pipeline presets involved modifying the underlying JSON files or dealing with rigid configuration states.
- Power users requested a way to quickly execute application commands without relying solely on click navigation.

## Decision
We have overhauled the frontend architecture to utilize CSS Container Queries, persistent component states, and a command-palette pattern.

1. **Three-Tier Container Breakpoints:**
   - Instead of a single media query, the UI utilizes Container Queries (`@container`) anchored to a main content wrapper.
   - **Tier 1 (< 800px):** Single-column layout. Directory Queue, Config Panel, and Metrics stack vertically.
   - **Tier 2 (800px - 1400px):** Two-column layout. Left column houses the Directory Queue and Metrics Panel. Right column houses the Configuration Panel.
   - **Tier 3 (> 1400px):** Ultra-wide layout. The grid expands to allow deeper views into the Directory Queue and expands the Config Panel horizontally for quicker tuning.
2. **Persistent Metrics Panel:**
   - The `showMetricsPanel` derived store has been eliminated. The `MetricsPanel` is now statically mounted to the DOM at all times.
   - It leverages Svelte's transition API (`crossfade`, `in:receive`, `out:send`) to smoothly animate between three intrinsic states: **Idle** (placeholder), **Active** (progress bars), and **Last Run** (summary statistics).
3. **Command Palette (`Ctrl+K`):**
   - Implemented a decoupled `commands.svelte.ts` store registry for registering application-wide commands.
   - Built a `<CommandPalette>` component that overlays the UI, offering prefix-based fuzzy search and keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`/`Escape`).
4. **Configuration Presets (`presets.json`):**
   - Migrated the application configuration to support deep persistence via a new Tauri `plugin-store` instance (`presets.json`).
   - Personal/System state (like dark mode and input directories) is strictly segregated from encoding Presets to prevent theming conflicts when users swap presets.
5. **Pre-flight File Scanning:**
   - To increase transparency, users can now click a "Show matched files" button in the `DirectoryQueue` to invoke a backend directory scan (`get_directory_stats`), revealing exactly which files match their filters before starting the pipeline.
6. **Real-time Pipeline Output Logging:**
   - Replaced raw, unbounded terminal dumps with a clean `TerminalLog` component.
   - The primary mitigation for the severe memory leaks and CPU stuttering was shifting the log filtering to the backend. Instead of emitting every raw stdout/stderr line from FFmpeg and MKVMerge across the IPC bridge, the backend now silently parses those streams and only emits structured progress events, status updates, and errors. This drastically reduces IPC overhead and DOM thrashing. The frontend maintains a 1,000-line buffer for these cleaned events, with full raw logs saved strictly to disk (`session.log`).

## Consequences
- **Positive:** The UI is significantly more stable. Layout shifting during start/stop pipeline events is eliminated. The app feels like a premium, native desktop utility. Keyboard-centric power users have a path for future expansion (Command Palette).
- **Negative:** Increased CSS complexity due to heavy reliance on `container-type: inline-size`. Component internal state logic (like `MetricsPanel`) is slightly more intricate since it handles 3 phases instead of just a binary active/inactive state.
- **Testing Constraints:** Frontend tests had to be heavily rewritten to accommodate Svelte 5 `$derived` state updates (which cannot be mutated directly) and the new DOM accessibility structures.
