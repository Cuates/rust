# Building for Production / Distribution

_(Note: If you are an end user, you do not need to do this. You can simply download the pre-compiled application from the Releases page.)_

When developers are ready to compile the application from the source code into a single, production-ready release package, invoke the global bundler from the workspace root:

```bash
pnpm tauri build
```

This triggers the production build across the SvelteKit frontend layout, compiles the Rust code with full release optimization flags (`-C opt-level=3`), and resolves the sidecars. From here, developers have two distribution options:

## Option A: Standard System Installers

Tauri automatically wraps the application inside standard OS installers (`.msi` / `.exe` on Windows, `.dmg` / `.app` on macOS, `.deb` / `.AppImage` on Linux).

- **Location:** `backend/target/release/bundle/`
- **Use Case:** Best for standard end user distribution where the application needs to live in `Program Files` or the macOS `Applications` folder.

## Option B: Portable (No-Install) Application

Developers can completely bypass the installer and package a raw, portable folder that end users can run instantly on any machine without needing administrator privileges.

1. Navigate to the core compile directory: `backend/target/release/`
2. Locate the raw, compiled executable: `mkv-subtitle-converter.exe`
3. Locate the embedded host architecture sidecars that Tauri copied into this exact same folder (e.g., `ffmpeg-x86_64-pc-windows-msvc.exe`).
4. Create a new folder (e.g., `MKV-Converter-Portable`).
5. Move the `.exe` and the sidecar binaries into this folder together.
6. Zip the folder and distribute it. End users simply double-click the `.exe` to run.

## GitHub Releases

We use GitHub Actions to automatically build and bundle compiled binaries and installers for Linux, macOS, and Windows.

To trigger a new release build for the `mkv-subtitle-converter` application, you must commit your version bumps and push a specific Git tag. Follow this exact sequence in your terminal:

> **Pre-flight checklist**: Before tagging, ensure the CI pipeline passes cleanly. The `Lint & Check` job now enforces a Dependency Audit (`pnpm audit` + `cargo audit`) and verifies that `frontend/src/lib/types/ipc.ts` is in sync with the Rust models (`pnpm run generate:types`). A failing audit or out-of-sync schema will block the release.

**1. Stage and commit your changes:**

```bash
git add .
git commit -m "chore: bump version to 1.11.0"
```

**2. Create the Git tag:**
Use the `mkv-subtitle-converter-v*` prefix convention to ensure the monorepo only builds the converter project.

```bash
git tag mkv-subtitle-converter-v1.11.0
```

**3. Push the commit to GitHub:**

```bash
git push origin main
```

*(This pushes the code changes and triggers the standard `mkv-subtitle-converter-ci.yml` testing pipeline)._

**4. Push the tag to GitHub:**

```bash
git push origin mkv-subtitle-converter-v1.11.0
```

*(This pushes the tag, which instantly triggers the `mkv-subtitle-converter-release.yml` pipeline)._

The automated pipeline will compile the binaries, gather the generated installers (such as `.msi`, `.exe`, `.dmg`, `.AppImage`, and `.deb`), and publish them directly as a GitHub Release.

### Re-triggering the Release Pipeline

To re-trigger the release pipeline, you'll need to push the fix to your main branch, delete the old tag that triggered the failed run, and push a fresh tag on your new commit.

Run these commands in your PowerShell terminal from the workspace root:

**1. Delete the old failing tag (locally and on GitHub):**

```powershell
git tag -d mkv-subtitle-converter-v1.11.0
git push origin --delete mkv-subtitle-converter-v1.11.0
```

**2. Create the tag again on your new commit and push it:**

```powershell
git tag mkv-subtitle-converter-v1.11.0
git push origin mkv-subtitle-converter-v1.11.0
```

Once you run that final command, if you check the **Actions** tab on your GitHub repository, you will see a brand new release pipeline starting up, and this time the Ubuntu runner should successfully bundle the `.AppImage` without cancelling your Windows build!
