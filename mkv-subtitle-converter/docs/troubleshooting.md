# Troubleshooting & Common Pitfalls

## ❌ Issue: Build warns "Overwriting dist\index.html with fallback page"

- **Cause:** SvelteKit successfully generated a static homepage from your root route, but then overwrote it with the Single Page Application (SPA) `fallback: 'index.html'` file we configured in `svelte.config.js`.
- **Resolution:** **Ignore this warning.** For a Tauri application, this overwrite is intended behavior and ensures the WebView can handle internal SPA routing correctly.

## ❌ Issue: App opens to a white screen / "asset not found: index.html"

- **Cause:** The `tauri.conf.json` is looking for `index.html` as its entry point, but `svelte.config.js` generated a different fallback file name, or `frontendDist` is misconfigured.
- **Resolution:** Ensure `fallback: 'index.html'` is explicitly set in `svelte.config.js`. Ensure `frontendDist` in `tauri.conf.json` points to the `build` folder (`"../frontend/build"`), not a specific file.

## ❌ Issue: System terminal output UI reports old engine versions after file upgrades

- **Cause:** Cargo optimizes compilation performance by aggressively caching system binary assets.
- **Resolution:** Wipe the internal target cache cleanly before restarting your development environment:

```bash
cd backend
cargo clean
cd ../..
pnpm dev
```

## ❌ Issue: macOS crashes or reports the sidecar binary file is "damaged" or untrusted

- **Cause:** Apple Gatekeeper automatically appends an extended quarantine metadata attribute flag (`com.apple.quarantine`) onto executables downloaded via browsers.
- **Resolution:** Strip the security metadata quarantine flag manually via terminal:

```bash
xattr -dr com.apple.quarantine backend/sidecars/ffmpeg-aarch64-apple-darwin
xattr -dr com.apple.quarantine backend/sidecars/ffprobe-aarch64-apple-darwin
```

## Run the Clean Suite

If your development workspace ever exhibits strange UI rendering states, out-of-sync type files, or locked dependency trees, perform a deep, total workspace purge to restore compilation stability.

From the repository root workspace room, run:

```bash
pnpm clean
```

Once completed, boot standard local execution safely:

```bash
pnpm dev
```
