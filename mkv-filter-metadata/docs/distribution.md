---
title: "Distribution & Deployment"
last_updated: 2026-07-07
---

# Distribution & Deployment

## Building for Production

```bash
pnpm build
```

This will:
1. Bundle the Svelte frontend via Vite
2. Compile the Rust backend in release mode
3. Link sidecar binaries
4. Output platform-specific installers in `backend/target/release/bundle/`

Ensure your `tauri.conf.json` has a unique `identifier` (currently `com.cuates.mkv-filter-metadata-rust`).

> [!TIP]
> **CI / Slow Builds Note:** For faster CI/CD pipelines, set the environment variable `CARGO_PROFILE_RELEASE_LTO=false`. This disables Link-Time Optimization, sacrificing a small amount of binary performance for significantly faster compilation times during automated builds.

---

## Testing the CI Pipeline

Testing the GitHub Actions CI pipeline (`mkv-filter-metadata-ci.yml`) can be done in two ways:

### Method 1: Push to GitHub (Easiest)
1. Commit the new workflow file:
   ```bash
   git add .github/workflows/mkv-filter-metadata-ci.yml
   git commit -m "Add MKV Filter CI pipeline"
   ```
2. Push your changes to your remote repository (or open a Pull Request):
   ```bash
   git push origin main
   ```
3. Open your repository on GitHub in your browser and click on the **"Actions"** tab at the top to watch the workflow run.

### Method 2: Test Locally using `act` (Advanced/Faster)
If you don't want to push your code to GitHub, you can run GitHub Actions locally using [act](https://github.com/nektos/act) (Requires Docker Desktop to be running).

1. **Install `act`**:
   * Windows (Winget): `winget install nektos.act`
   * macOS (Homebrew): `brew install act`
2. Open your terminal in the root of your project directory (`mkv-filter-metadata`).
3. Run the pipeline by simulating a "push" event:
   ```bash
   act push
   ```
4. `act` will pull down a Docker container that mimics the `ubuntu-latest` GitHub runner and execute the `mkv-filter-metadata-ci.yml` steps locally.
