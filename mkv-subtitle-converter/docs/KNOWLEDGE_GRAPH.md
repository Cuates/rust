---
title: "Architecture & Data Flow"
tags: [tauri, svelte, rust, architecture]
---

# 🧠 Knowledge Graph

This graph illustrates the system architecture and data flow between the decoupled Svelte frontend and the Tauri Rust backend.

## Subtitle Processing Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend as SvelteKit (Frontend)
    participant Backend as Tauri (Rust Backend)
    participant SQLite as rusqlite (History)
    participant FFprobe as FFprobe Sidecar
    participant FFmpeg as FFmpeg Sidecar

    User->>Frontend: Select Directory & Start
    Frontend->>Backend: invoke("process_mkv_directory")
    
    %% Idempotent Checks
    Backend->>SQLite: Query previously converted files
    SQLite-->>Backend: Return cached successes
    Backend->>Backend: Skip existing, filter remaining
    
    %% Processing Phase
    Backend->>FFprobe: Scan remaining files for Layout Tracks
    FFprobe-->>Backend: Return Track Maps (default_flag, forced_flag)
    Backend->>FFmpeg: Spawn Async Subprocesses<br/>(Tokio JoinSet - Max 3 Concurrent)
    FFmpeg-->>Backend: Extract raw SRT streams
    Backend->>Backend: Transcode SRT to styled ASS
    
    %% Completion
    Backend->>SQLite: Log successful conversions
    Backend-->>Frontend: emit("LogMessage", ProgressPayload)
    Frontend-->>User: Display Progress UI
```

## CI/CD Pipeline

```mermaid
graph TD
    Push[Code Push / Pull Request] --> Dispatch(GitHub Actions)
    
    subgraph Composite Action [setup-environment]
        OSDeps[Install OS Deps]
        NodeSetup[Setup Node/pnpm]
        RustSetup[Setup Rust Toolchain & Cache]
        Deps[pnpm install & prebuild]
        
        OSDeps --> NodeSetup
        NodeSetup --> RustSetup
        RustSetup --> Deps
    end
    
    Dispatch --> Composite Action
    
    Composite Action --> Lint[Lint & Check]
    Composite Action --> TestUbuntu[Test & Coverage Ubuntu]
    Composite Action --> TestWin[Test Windows]
    Composite Action --> TestMac[Test macOS]
    Composite Action --> Build[Build Validation]
```
