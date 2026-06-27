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
