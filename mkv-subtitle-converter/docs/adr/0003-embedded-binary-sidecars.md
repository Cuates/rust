---
id: 3
title: "Embed FFmpeg and FFprobe as Sidecars"
status: accepted
date: 2026-06-26
deciders: [cuates]
tags: [backend, media-processing, distribution]
---

# Embed FFmpeg and FFprobe as Sidecars

## Context and Problem Statement
Extracting SRT tracks from MKV files inherently requires media parsing tools like FFmpeg. Requiring end-users to manually download, install, and add FFmpeg to their global system PATH is a terrible user experience and highly error-prone.

## Decision
We chose to embed pre-compiled, static binaries for `ffmpeg` and `ffprobe` as Tauri Sidecars (`backend/sidecars/`). The Rust backend executes these sidecars directly.

## Consequences
* **Good**: The application ships completely self-contained. It works out-of-the-box on any supported OS.
* **Good**: We have guaranteed consistency regarding the FFmpeg version used.
* **Bad**: Increases the total size of the distributed application installer/binary.
* **Bad**: macOS Gatekeeper may quarantine these binaries on download, requiring users to manually run `xattr -dr com.apple.quarantine` on the sidecars if distributed outside the Mac App Store.
