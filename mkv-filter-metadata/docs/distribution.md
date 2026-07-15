---
title: "Distribution & Deployment"
last_updated: 2026-07-14
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

---

## GitHub Releases

We use GitHub Actions to automatically build and bundle compiled binaries for Linux, macOS, and Windows. 

To trigger a new release build for the `mkv-filter-metadata` application, you must commit your version bumps and push a specific Git tag. Follow this exact sequence in your terminal:

**1. Stage and commit your changes:**
```bash
git add .
git commit -m "chore: bump version to 2.4.0"
```

**2. Create the Git tag:**
Use the `mkv-filter-metadata-v*` prefix convention to ensure the monorepo only builds the filter metadata project.
```bash
git tag mkv-filter-metadata-v2.4.0
```

**3. Push the commit to GitHub:**
```bash
git push origin main
```
*(This pushes the code changes and triggers the standard `mkv-filter-metadata-ci.yml` testing pipeline).*

**4. Push the tag to GitHub:**
```bash
git push origin mkv-filter-metadata-v2.4.0
```
*(This pushes the tag, which instantly triggers the `mkv-filter-metadata-release.yml` pipeline).*

The automated pipeline will compile the Tauri application in release mode, bundle native installers for each operating system (e.g., `.deb`, `.dmg`, `.msi`), and publish them as assets attached to a new GitHub Release.
