# Architecture

## Tree Structure

The architectural layout of this project relies on a highly decoupled **pnpm workspace split**. The web panel lives completely isolated from the system-level Rust compilation environment under the global `` workspace scope.

```text
rust-monorepo-root/
├── .github/                       # Monorepo-wide GitHub Actions workflows and CI pipelines
│   ├── actions/
│   │   └── mkv-subtitle-converter-setup/
│   │       └── action.yml
│   └── workflows/
│       └── mkv-subtitle-converter-ci.yml
└── mkv-subtitle-converter/
    ├── .agents/                       # AI configuration and workspace rules
    │   ├── AGENTS.md                  # Project-scoped AI guidelines
    │   └── skills/
    │       └── sync_docs/SKILL.md     # Custom documentation sync AI skill
    ├── docs/                          # In-depth architectural knowledge
    │   ├── architecture.md            # Monorepo architecture and tree structure
    │   ├── distribution.md            # Production build and distribution guide
    │   ├── KNOWLEDGE_GRAPH.md         # Mermaid data flow architecture maps
    │   ├── scaffolding.md             # Historical setup instructions
    │   ├── troubleshooting.md         # Common pitfalls and clean suite instructions
    │   └── adr/                       # Architecture Decision Records
    │       ├── 0001-record-architecture-decisions.md
    │       ├── 0002-initial-tech-stack-selection.md
    │       ├── 0003-embedded-binary-sidecars.md
    │       ├── 0004-cancellation-state-management.md
    │       ├── 0005-composite-action-ci-cd.md
    │       ├── 0006-svelte-kit-sync-in-tests.md
    │       └── 0007-ci-test-deduplication.md
    ├── CHANGELOG.md                   # Version history and release notes
    ├── CONTRIBUTING.md                # Developer contribution guidelines
    ├── README.md                      # Architecture and setup documentation
    ├── START_HERE.md                  # Quick-start executive summary
    ├── TESTING.md                     # Testing suite documentation
    ├── plan.md                        # Active tasks, roadmap, and sandbox
    ├── package.json                   # Root package manager orchestration layout
    ├── pnpm-workspace.yaml            # PNPM monorepo multi-package descriptor
    ├── scripts/                       # Monorepo build and sidecar scripts
    │   ├── download-sidecars.mjs
    │   └── generate-hashes.mjs
    ├── frontend/                      # Decoupled Webview Client (SvelteKit / Svelte 5)
    │   ├── README.md                  # Frontend layer documentation
    │   ├── package.json
    │   ├── .prettierignore            # Formatter exclusion rules
    │   ├── .prettierrc                # Prettier formatting config
    │   ├── eslint.config.js           # Strict ESLint 9+ flat configuration
    │   ├── svelte.config.js           # Outfitted with Adapter-Static constraints (outputs to build/)
    │   ├── tsconfig.json              # TypeScript compiler configuration
    │   ├── vite.config.ts             # Vite bundler configurations
    │   ├── vitest-setup.js            # Vitest DOM and global mocking environment
    │   ├── static/                    # Uncompiled raw static assets
    │   │   ├── favicon.png
    │   │   ├── svelte.svg
    │   │   ├── tauri.svg
    │   │   └── vite.svg
    │   └── src/
    │       ├── lib/                   # Reusable UI components, stores, and utilities
    │       │   ├── components/
    │       │   ├── stores/
    │       │   ├── utils/
    │       │   ├── constants.ts       # Frontend constants
    │       │   └── types.ts           # Shared TypeScript interfaces
    │       ├── styles/                # Global SCSS styling architecture
    │       │   ├── _variables.scss
    │       │   └── app.scss
    │       └── routes/                # SvelteKit layout and page routing
    │           ├── +layout.svelte     # Root layout shell
    │           ├── +layout.ts         # Static pre-rendering enforcer (SSR false)
    │           ├── +page.svelte       # Primary application interaction view
    │           ├── guide/             # In-app user guide routes
    │           └── settings/          # Application settings routes
    └── backend/                       # Decoupled Native Desktop Layer (Tauri v2 + Rust)
        ├── README.md                  # Backend layer documentation
        ├── Cargo.toml                 # System crate workspace dependencies
        ├── tauri.conf.json            # Main Tauri application layout and compilation schema (reads build/)
        ├── capabilities/
        │   └── default.json           # Security layer access token configuration
        ├── sidecars/                  # Embedded cross-platform system sidecars
        │   ├── ffmpeg-x86_64-pc-windows-msvc.exe
        │   ├── ffprobe-x86_64-pc-windows-msvc.exe
        │   └── ... (macOS & Linux sidecars)
        └── src/
            ├── main.rs                # Application execution root entryway
            ├── lib.rs                 # Application lib and main tauri builder
            ├── commands.rs            # IPC definitions and backend actions
            ├── process.rs             # Transcoding and streaming thread logic
            ├── models.rs              # Data models, structs, and payloads
            ├── history.rs             # Processing history report generator
            ├── constants.rs           # Static constants and configurations
            └── error.rs               # Application error structures
```

## Monorepo Root Configurations

To prevent system module dependency leakage and to allow the root profile to manage individual package lifecycles cleanly, two files map the orchestration foundation.

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'backend'
  - 'frontend'
```

### Root `package.json`

```json
{
  "name": "mkv-subtitle-extractor-converter-rust",
  "version": "1.9.3",
  "description": "",
  "main": "index.js",
  "scripts": {
    "prebuild": "node scripts/download-sidecars.mjs",
    "build": "tauri build",
    "check": "pnpm -F frontend check && cargo check --manifest-path backend/Cargo.toml",
    "check:deadcode": "pnpm -F frontend exec knip && cargo clippy --manifest-path backend/Cargo.toml -- -D dead_code",
    "clean": "cargo clean --manifest-path backend/Cargo.toml && pnpm dlx rimraf node_modules frontend/node_modules && pnpm install",
    "dev": "tauri dev",
    "fix": "pnpm -F frontend format && pnpm -F frontend lint --fix && cargo fmt --manifest-path backend/Cargo.toml && cargo clippy --manifest-path backend/Cargo.toml --fix --allow-dirty --allow-staged -- -D warnings",
    "app-info": "tauri info",
    "audit": "pnpm audit && cargo audit --manifest-path backend/Cargo.toml",
    "test": "pnpm -F frontend test:unit --run && cargo test --manifest-path backend/Cargo.toml",
    "test:coverage": "pnpm -F frontend coverage && cargo llvm-cov --manifest-path backend/Cargo.toml --all-features --workspace --lcov --output-path lcov.info"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "devEngines": {
    "packageManager": {
      "name": "pnpm",
      "version": "^11.7.0",
      "onFail": "download"
    }
  },
  "type": "module",
  "devDependencies": {
    "@tauri-apps/cli": "^2.11.3"
  }
}
```
