# Architecture

## Architecture Overview

```text
┌────────────────────────────────────────────────────────────┐
│                    Tauri v2 Runtime                         │
│                                                            │
│  ┌─────────────────────┐    ┌────────────────────────────┐ │
│  │   Frontend (Svelte) │    │    Backend (Rust)           │ │
│  │                     │    │                            │ │
│  │  +page.svelte       │◄──►│  commands.rs (IPC handlers)│ │
│  │  DirectoryQueue     │    │  process.rs  (FFmpeg logic) │ │
│  │  ConfigPanel        │    │  models.rs   (Type defs)   │ │
│  │  MetricsPanel       │    │  error.rs    (Error types)  │ │
│  │  TerminalLog        │    │  lib.rs      (Plugin init) │ │
│  │  ToastContainer     │    │                            │ │
│  │                     │    │  Sidecars:                  │ │
│  │  Stores:            │    │    ffmpeg, ffprobe,         │ │
│  │    config.svelte.ts │    │    mkvmerge                 │ │
│  │    pipeline.svelte  │    │                            │ │
│  │    toast.svelte.ts  │    │  Capabilities:             │ │
│  │                     │    │    default.json             │ │
│  └─────────────────────┘    └────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

The frontend communicates with the backend exclusively through Tauri's `invoke` (request/response) and `emit`/`listen` (event streaming) IPC bridges. There are no HTTP APIs or WebSocket servers.

---

## Tree Structure

```text
mkv-filter-metadata/
├── .agents/                      # AI assistant configuration and skills
│   ├── AGENTS.md                 # Agent behavior rules and architecture guidelines
│   └── skills/                   # Custom agent workflows
├── .github/                      # GitHub Actions CI/CD workflows
│   ├── actions/
│   │   └── mkv-filter-metadata-setup/ # Composite CI environment setup action
│   └── workflows/
│       └── mkv-filter-metadata-ci.yml # Main CI pipeline (multi-platform)
├── docs/                         # Project documentation and architecture records
│   ├── architecture.md           # Architecture overview and tree structure
│   ├── distribution.md           # Production build and distribution guide
│   ├── scaffolding.md            # Prerequisites and setup instructions
│   ├── troubleshooting.md        # Common pitfalls and issues
│   ├── KNOWLEDGE_GRAPH.md        # Mermaid diagrams of system data flow
│   └── adr/                      # Architecture Decision Records
│       ├── 0001-record-architecture-decisions.md
│       ├── 0002-split-documentation.md
│       ├── 0003-initial-tech-stack.md
│       ├── 0004-embedded-binary-sidecars.md
│       ├── 0005-sqlite-history-cache.md
│       ├── 0006-centralized-ci-setup.md
│       └── 0007-adaptive-throttling-and-storage-concurrency.md
├── package.json                  # Root workspace orchestrator scripts
├── pnpm-workspace.yaml           # Monorepo boundary (frontend only)
├── README.md                     # Monorepo root README
├── START_HERE.md                 # Project quick start and architecture overview
├── plan.md                       # High-level roadmap and workflow sandbox
├── CHANGELOG.md                  # Version history
├── CONTRIBUTING.md               # Contribution guidelines
├── LICENSE                       # MIT License
├── TESTING.md                    # Testing strategy and guidelines
├── scripts/                      # Build helper scripts
│   ├── download-sidecars.mjs     # Fetches sidecars and validates checksums
│   └── generate-hashes.mjs       # Generates SHA-256 checksums for new binary releases
│
├── frontend/                     # Svelte 5 + SvelteKit + Vite UI Layer
│   ├── README.md                 # Frontend layer documentation
│   ├── package.json              # UI deps, test/lint/format scripts
│   ├── svelte.config.js          # SvelteKit adapter configuration
│   ├── vite.config.js            # Vite bundler with custom logger
│   ├── tsconfig.json             # TypeScript compiler options
│   ├── eslint.config.js          # ESLint flat config (Svelte + TS)
│   ├── .prettierrc               # Prettier formatting rules
│   └── src/
│       ├── routes/
│       │   ├── +layout.svelte    # Global layout wrapper and font imports
│       │   ├── +page.svelte      # Main application view & event orchestration
│       │   ├── guide/
│       │   │   └── +page.svelte  # "How To Use" documentation page
│       │   └── settings/
│       │       └── +page.svelte  # Configuration, performance, and history management
│       ├── lib/
│       │   ├── types.ts          # Zod schemas & TypeScript type definitions
│       │   ├── components/
│       │   │   ├── AboutModal.svelte       # App version & dependency info modal
│       │   │   ├── ConfigPanel.svelte      # Encoder/preset/CRF controls
│       │   │   ├── ConfirmationModal.svelte# Accessible generic confirmation dialog
│       │   │   ├── DirectoryQueue.svelte   # Multi-dir queue with drag-reorder
│       │   │   ├── MetricsPanel.svelte     # Progress bars, timer, ETA, storage
│       │   │   ├── TerminalLog.svelte      # Streaming FFmpeg output log
│       │   │   └── ToastContainer.svelte   # Toast notification system
│       │   ├── stores/
│       │   │   ├── config.svelte.ts        # App config & UI state (runes)
│       │   │   ├── pipeline.svelte.ts      # Pipeline telemetry state (runes)
│       │   │   ├── shortcuts.svelte.ts     # Keyboard shortcuts state (runes)
│       │   │   └── toast.svelte.ts         # Toast queue state (runes)
│       │   └── utils/
│       │       └── formatters.ts           # Byte/duration formatting utilities
│       └── styles/
│           └── app.scss          # Global styles, theming, CSS variables
│
└── backend/                      # Rust + Tauri v2 Native System Layer
    ├── README.md                 # Backend layer documentation
    ├── Cargo.toml                # Rust dependencies (rusqlite, sysinfo, etc.)
    ├── tauri.conf.json           # Window, plugins, bundle, security config
    ├── capabilities/
    │   └── default.json          # Tauri v2 permission scopes
    ├── sidecars/                 # Target-suffixed binaries (FFmpeg/FFprobe/MKVMerge)
    └── src/
        ├── main.rs               # Tauri application entry point
        ├── lib.rs                # Plugin registration & invoke handler setup
        ├── commands.rs           # All #[tauri::command] IPC handlers
        ├── constants.rs          # Shared IPC and event strings
        ├── process.rs            # FFmpeg pipeline, codec logic, arg builders
        ├── history.rs            # SQLite processing database operations
        ├── models.rs             # Rust type definitions (enums, structs, state)
        └── error.rs              # Custom error types with thiserror
```
