---
title: "Architecture & Data Flow"
tags: [tauri, svelte, rust, architecture, ffmpeg]
last_updated: 2026-07-04
---

# 🧠 Knowledge Graph

This graph illustrates the system architecture and data flow between the decoupled Svelte frontend and the Tauri Rust backend for the **MKV Filter Metadata** project.

## Processing Pipeline Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend as SvelteKit (Frontend)
    participant Backend as Tauri (Rust Backend)
    participant SQLite as rusqlite (History)
    participant FFprobe as FFprobe Sidecar
    participant FFmpeg as FFmpeg Sidecar
    participant MKVMerge as MKVMerge Sidecar

    %% Pre-flight Phase
    User->>Frontend: Click "Show matched files"
    Frontend->>Backend: invoke("get_directory_stats")
    Backend-->>Frontend: Return filtered file list & sizes
    Frontend-->>User: Display pre-flight summary ("Will process X files")

    User->>Frontend: Select Directory & Start
    Frontend->>Backend: invoke("process_mkv_directory")
    
    %% Idempotent Checks
    Backend->>SQLite: Query previously processed files
    SQLite-->>Backend: Return cached successes
    Backend->>Backend: Skip existing, filter remaining by extension
    
    %% Processing Phase
    Backend->>Backend: Check System Resources via sysinfo (CPU/RAM)<br/>Pause task spawning if >90% CPU or <15% RAM
    Backend->>FFprobe: Scan file streams (Identify subtitle languages)
    FFprobe-->>Backend: Return stream metadata (ISO 639 codes)
    Backend->>Backend: Build HW-accelerated FFmpeg command<br/>(Apply codec, preset, CRF, and track maps)
    Backend->>Backend: Enforce Storage-Aware Concurrency<br/>(Clamp Remux to 1 on HDD)
    Backend->>Backend: Enforce Encoder-Aware Concurrency<br/>(Clamp software encoders like libx264/libx265 to max 2)
    Backend->>FFmpeg: Spawn Async Subprocess (Remux/Reencode)
    Backend->>MKVMerge: (Optional) Spawn Subprocess for specific MKV muxing tasks
    
    %% Fallback & Progress
    alt Subtitle Codec Incompatible
        FFmpeg-->>Backend: Error
        Backend->>FFmpeg: Retry with ASS Subtitle Conversion
    else Success
        FFmpeg-->>Backend: Stream stderr (progress tracking)
        MKVMerge-->>Backend: Stream output (if utilized)
    end
    
    %% Completion
    Backend->>SQLite: Log successful conversions (path, size, mtime)
    Backend-->>Frontend: emit("LogMessage", ProgressPayload)
    Frontend-->>User: Display Progress UI, ETA, and Storage Savings
    
    %% Post-Processing
    User->>Frontend: Click "Open Folder" Icon
    Frontend->>Backend: invoke("open_processed_folder")
    Backend->>Backend: Resolve cross-platform output path
    Backend-->>User: Launch native OS file explorer
```
