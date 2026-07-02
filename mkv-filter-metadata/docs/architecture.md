---
title: "Architecture & Tree Structure"
last_updated: 2026-07-02
---

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
│   └── skills/
│       └── sync_docs/            # Sync documentation skill
│           └── SKILL.md
├── .github/                      # GitHub Actions CI/CD workflows
│   ├── actions/
│   │   └── mkv-filter-metadata-setup/ # Composite CI environment setup action
│   └── workflows/
│       └── mkv-filter-metadata-ci.yml # Main CI pipeline (multi-platform)
├── docs/                         # Project documentation and architecture records
│   ├── KNOWLEDGE_GRAPH.md        # Mermaid diagrams of system data flow
│   ├── architecture.md           # Architecture overview and tree structure
│   ├── distribution.md           # Production build and distribution guide
│   ├── scaffolding.md            # Prerequisites and setup instructions
│   ├── troubleshooting.md        # Common pitfalls and issues
│   └── adr/                      # Architecture Decision Records
│       ├── 0001-record-architecture-decisions.md
│       ├── 0002-split-documentation.md
│       ├── 0003-initial-tech-stack.md
│       ├── 0004-embedded-binary-sidecars.md
│       ├── 0005-sqlite-history-cache.md
│       ├── 0006-centralized-ci-setup.md
│       ├── 0007-adaptive-throttling-and-storage-concurrency.md
│       └── 0008-encoder-aware-concurrency.md
├── scripts/                      # Build helper scripts
│   ├── README.md                 # Script documentation
│   ├── download-sidecars.mjs     # Fetches sidecars and validates checksums
│   └── generate-hashes.mjs       # Generates SHA-256 checksums for new binary releases
├── .gitignore                    # Git ignore rules
├── CHANGELOG.md                  # Version history
├── CONTRIBUTING.md               # Contribution guidelines
├── LICENSE                       # MIT License
├── README.md                     # Monorepo root README
├── START_HERE.md                 # Project quick start and architecture overview
├── TESTING.md                    # Testing strategy and guidelines
├── package.json                  # Root workspace orchestrator scripts
├── plan.md                       # High-level roadmap and workflow sandbox
├── pnpm-lock.yaml                # PNPM lockfile
└── pnpm-workspace.yaml           # Monorepo boundary (frontend only)

frontend/                         # Svelte 5 + SvelteKit + Vite UI Layer
├── src/
│   ├── lib/
│   │   ├── components/           # Svelte UI components and their tests
│   │   │   ├── AboutModal.svelte
│   │   │   ├── ConfigPanel.svelte
│   │   │   ├── ConfirmationModal.svelte
│   │   │   ├── DirectoryQueue.svelte
│   │   │   ├── MetricsPanel.svelte
│   │   │   ├── TerminalLog.svelte
│   │   │   ├── TestWrapper.svelte
│   │   │   └── ToastContainer.svelte
│   │   ├── stores/               # Svelte 5 Runes state management
│   │   │   ├── config.svelte.ts
│   │   │   ├── pipeline.svelte.ts
│   │   │   ├── shortcuts.svelte.ts
│   │   │   └── toast.svelte.ts
│   │   ├── utils/                # Utility functions and tests
│   │   │   ├── formatters.ts
│   │   │   └── logClassifier.ts
│   │   ├── constants.ts          # Shared frontend constants
│   │   └── types.ts              # Zod schemas & TypeScript type definitions
│   ├── routes/
│   │   ├── guide/                # "How To Use" documentation page
│   │   │   └── +page.svelte
│   │   ├── settings/             # Configuration, performance, and history management
│   │   │   └── +page.svelte
│   │   ├── +layout.svelte        # Global layout wrapper and font imports
│   │   ├── +layout.ts
│   │   └── +page.svelte          # Main application view & event orchestration
│   ├── styles/
│   │   └── app.scss              # Global styles, theming, CSS variables
│   ├── app.html                  # HTML template
│   └── env.d.ts                  # Environment types
├── static/                       # Static assets (favicons, logos)
├── .prettierrc                   # Prettier formatting rules
├── check_output.txt              # Build/check output logs (ignored)
├── eslint.config.js              # ESLint flat config (Svelte + TS)
├── package.json                  # UI deps, test/lint/format scripts
├── svelte.config.js              # SvelteKit adapter configuration
├── tsconfig.json                 # TypeScript compiler options
├── vite.config.ts                # Vite bundler with custom logger
└── vitest-setup.js               # Vitest environment setup

backend/                          # Rust + Tauri v2 Native System Layer
├── capabilities/
│   └── default.json              # Tauri v2 permission scopes
├── icons/                        # Application icons across platforms
├── sidecars/                     # Target-suffixed binaries (FFmpeg/FFprobe/MKVMerge)
├── src/
│   ├── commands.rs               # All #[tauri::command] IPC handlers
│   ├── constants.rs              # Shared IPC and event strings
│   ├── error.rs                  # Custom error types with thiserror
│   ├── history.rs                # SQLite processing database operations
│   ├── lib.rs                    # Plugin registration & invoke handler setup
│   ├── main.rs                   # Tauri application entry point
│   ├── models.rs                 # Rust type definitions (enums, structs, state)
│   └── process.rs                # FFmpeg pipeline, codec logic, arg builders
├── .gitignore                    # Backend git ignore rules
├── build.rs                      # Tauri build script
├── Cargo.lock                    # Rust dependencies lockfile
├── Cargo.toml                    # Rust dependencies (rusqlite, sysinfo, etc.)
├── README.md                     # Backend layer documentation
└── tauri.conf.json               # Window, plugins, bundle, security config
```
