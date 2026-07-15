---
title: 'Frontend Layer (SvelteKit)'
last_updated: 2026-07-14
---

# Frontend Layer (SvelteKit)

This directory contains the reactive Svelte 5 / SvelteKit web-view frontend layout layer.

## Frontend Component Architecture

| Component                   | Responsibility                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`+page.svelte`**          | Root orchestrator: mounts components, manages 3-tier responsive grid layout, theme toggling, and processing lifecycle                              |
| **`DirectoryQueue.svelte`** | Multi-directory queue with drag-and-drop reorder, pill-based rows, file counts, aggregate sizes, custom path hover tooltips (`mouseenter`), and open-folder actions     |
| **`ConfigPanel.svelte`**    | Conversion mode (toggle cards), file/subtitle filters, storage target drive toggle, and hardware-aware encoder selection (with CRF slider syncing) |
| **`MetricsPanel.svelte`**   | Persistently mounted 3-state component (Idle / Active / Last Run). Displays progress bars, ETA, live total size tracking, and color-coded storage delta analytics         |
| **`CommandPalette.svelte`** | Universal overlay (`Ctrl+K`) for quickly accessing settings, changing themes, clearing history, and jumping to documentation                       |
| **`TerminalLog.svelte`**    | Streaming FFmpeg log output with scroll-to-top/bottom controls, inline total sizes, separated final summary metrics, copy-to-clipboard, and save-to-file                                                                  |
| **`ToastContainer.svelte`** | Stacked toast notifications with auto-dismiss, severity-based styling, and XSS-safe rendering. Also handles `sysinfo` throttling alerts            |

### State Management (Svelte 5 Runes)

| Store                | Purpose                                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.svelte.ts`   | Input directories, encoder settings, HDD/SSD config, UI state (theme, hardware capabilities), and **Preset Persistence** (`presets.json` `plugin-store`) |
| `pipeline.svelte.ts` | Processing telemetry: progress, file index, timer, ETA, log buffer, directory statuses, and `lastRunSummary` object for post-processing reports          |
| `toast.svelte.ts`    | Toast notification queue with add/dismiss helpers                                                                                                        |
| `commands.svelte.ts` | Central registry for `CommandPalette` actions, decoupling application behaviors from deep UI layers                                                      |
| `constants.ts`       | Centralized repository for all "magic strings", including DOM events, Tauri IPC commands, UI labels, and error messages, ensuring strict type safety.    |

## Features (UI Layer)

- **Responsive 3-Tier Grid Layout:** Built using modern CSS Container Queries (`@container`), the interface shifts fluidly between a single column (Tier 1), split-column (Tier 2: 800px+), and an expanded ultra-wide view (Tier 3: 1400px+).
- **Multi-Directory Processing Queue:** Drag-and-drop or browse to add multiple directories. View matching files _before_ executing using the pre-flight inspector.
- **Persistent Metrics Panel:** Intelligently animates between an idle placeholder, live transcoding progress bars, and a "Last Run" analytics card summarizing storage bytes saved.
- **Configuration Presets:** Save custom encoder/CRF combinations as persistent presets via the new Configuration Settings page.
- **Command Palette:** Keyboard-driven navigation. Press `Ctrl+K` to search for and execute any registered application command instantly.
- **UI Theme Configuration:** 3-way toggle (System/Light/Dark) with smooth CSS transitions, OS system preference tracking, and localStorage persistence.
