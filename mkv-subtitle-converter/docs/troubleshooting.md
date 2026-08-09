# Troubleshooting & Common Pitfalls

## ❌ Issue: Vitest warns "Cannot find base config file ./.svelte-kit/tsconfig.json"

- **Cause:** SvelteKit dynamically generates the `.svelte-kit` directory containing base TypeScript configurations during the `build`, `dev`, or `sync` lifecycle. If you run testing directly (like in CI environments) without generating this folder first, Vitest will be unable to resolve your types.
- **Resolution:** Prefix your testing scripts with `svelte-kit sync`. Example: `"test:unit": "svelte-kit sync && vitest"`.

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

## ❌ Issue: CI fails with "Types are out of sync"

- **Cause:** A Rust struct in `backend/src/models.rs` was modified (field added, renamed, or removed) but `frontend/src/lib/types/ipc.ts` was not regenerated before committing. The CI `Verify IPC Types are in Sync` step detects the drift via `git diff --exit-code`.
- **Resolution:** Run the generator locally and commit the result:

```bash
pnpm run generate:types
git add frontend/src/lib/types/ipc.ts
git commit --amend --no-edit
```

## ❌ Issue: `pnpm run audit` or `cargo audit` fails in CI

- **Cause:** A dependency (direct or transitive) has a known published vulnerability. The CI `Dependency Audit` gate blocks PRs with unresolved advisories.
- **Resolution (frontend):** Run `pnpm update -r` to apply latest minor/patch bumps, or add a strict override at the root in `pnpm-workspace.yaml`:

```yaml
overrides:
  "vulnerable-package": "~safe-version"
```

*Note: As of pnpm v9+, overrides should be placed in `pnpm-workspace.yaml`, not `package.json`, to ensure they apply uniformly across the workspace and prevent nested dependency conflicts.*

- **Resolution (backend):** Run `cargo update` from `backend/` to pull the latest compatible patch versions. If a transitive dependency has no fix yet, add it to `backend/.cargo/audit.toml` as an ignored advisory with justification.

## ❌ Issue: `pnpm run check:deadcode` (knip) reports unexpected unused exports

- **Cause:** `knip` performs static analysis and may flag Svelte component props, store exports, or auto-generated files as "unused" if they are only consumed at runtime or via dynamic imports.
- **Resolution:** Add the false-positive path to `frontend/knip.json` under `ignore` or `ignoreDependencies`. For auto-generated files like `ipc.ts`, they are already covered by the existing `knip.json` ignore rules. Never suppress a real dead-code finding without investigation.

## ❌ Issue: `pnpm run lint:md` reports markdown errors

- **Cause:** A markdown file violates one of the active `markdownlint` rules not already disabled in `.markdownlint.json`.
- **Resolution:** Run `pnpm run lint:md:fix` to auto-fix most rule violations (line length, trailing spaces, blank lines). For complex tables or ASCII art trees that cannot be reformatted, wrap the block:

```markdown
<!-- markdownlint-disable -->
... complex content ...
<!-- markdownlint-enable -->
```

## ❌ Issue: Rust tests panic with "Cannot block the current thread from within a runtime"

- **Cause:** When mocking Tauri IPC payloads in backend Rust tests (e.g. `tauri::ipc::Channel::new`), using a blocking channel sender (`tx.blocking_send()`) inside an `async` Tokio runtime context causes a thread deadlock panic.
- **Resolution:** Swap the standard bounded `mpsc::channel` for an unbounded channel (`tokio::sync::mpsc::unbounded_channel()`). This allows you to use the non-blocking `tx.send(data)` method safely from within the synchronous IPC closure.
