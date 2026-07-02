# Frontend Layer (SvelteKit)

This directory contains the reactive Svelte 5 / SvelteKit web-view frontend layout layer.

## Frontend Component Architecture

| Component                   | Responsibility                                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **`+page.svelte`**          | Root orchestrator: mounts all components, manages Tauri event listeners, timer logic, theme toggling, and the processing lifecycle             |
| **`DirectoryQueue.svelte`** | Multi-directory queue with drag-and-drop reorder, per-row status badges, directory stats tooltips, open-folder actions, and file-drop handling |
| **`ConfigPanel.svelte`**    | Conversion mode, file extension filter, subtitle filter, storage target drive, encoder/preset/CRF selection with dynamic hardware detection |
| **`MetricsPanel.svelte`**   | Overall progress bar, per-file progress bar, total conversion time, ETA, and storage savings display                                           |
| **`TerminalLog.svelte`**    | Streaming FFmpeg log output with auto-scroll, copy-to-clipboard, and save-to-file                                                              |
| **`ToastContainer.svelte`** | Stacked toast notifications with auto-dismiss, severity-based styling, and XSS-safe rendering. Also handles `sysinfo` throttling alerts        |

### State Management (Svelte 5 Runes)

| Store                | Purpose                                                                                |
| -------------------- | -------------------------------------------------------------------------------------- |
| `config.svelte.ts`   | Input directories, encoder settings, HDD/SSD config, UI state (theme, hardware capabilities) |
| `pipeline.svelte.ts` | Processing telemetry: progress, file index, timer, ETA, log buffer, directory statuses |
| `toast.svelte.ts`    | Toast notification queue with add/dismiss helpers                                      |

## Features (UI Layer)

- **Multi-Directory Processing Queue:** Drag-and-drop or browse to add multiple directories. Reorder via drag. Per-row status indicators.
- **Real-Time Pipeline Telemetry:** Live progress bars (overall + per-file), OS taskbar progress indicator, running timer, and ETA estimation.
- **Storage Savings Metrics:** After completion, displays original vs. output size with percentage saved.
- **Streaming Terminal Log:** Real-time FFmpeg output with auto-scroll, copy-to-clipboard, and save-to-file.
- **UI Theme Configuration:** 3-way toggle (System/Light/Dark) with smooth CSS transitions, OS system preference tracking, and localStorage persistence.
- **Directory Stats Tooltips:** Hover over queued directories to see file counts, names, and total sizes.
