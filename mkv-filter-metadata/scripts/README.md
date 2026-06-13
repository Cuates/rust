# Sidecar Scripts

This directory contains scripts for fetching and verifying the external binary dependencies (FFmpeg, FFprobe, and MKVToolNix) needed by this project.

## Updating Sidecars

The sidecar binaries are fetched from GitHub Releases. If you release new versions of these binaries or change the release URL in `download-sidecars.mjs`, you **must** update the SHA-256 hashes to maintain production security.

1. Generate new hashes for all binaries (you can use `generate-hashes.mjs` if available).
2. Open `download-sidecars.mjs`.
3. Update `REPO_URL` if you created a new release tag.
4. Replace the old hashes in the `sidecars` map with the newly generated ones.
