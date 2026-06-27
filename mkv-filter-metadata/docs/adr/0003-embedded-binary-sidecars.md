---
date: 2026-06-26
status: "accepted"
author: "AI Assistant"
---

# 3. Embedded Binary Sidecars

## Context

The core functionality of `mkv-filter-metadata` requires deep inspection and manipulation of MKV containers (filtering metadata, stripping tracks, and hardware-accelerated re-encoding). 

We could interact with video files by:
1. Dynamically linking against FFmpeg libraries (e.g., `libavcodec` via Rust bindings).
2. Requiring the user to have FFmpeg/MKVToolNix installed globally on their system path.
3. Bundling the pre-compiled command-line binaries within the application installer.

## Decision

We decided to bundle **FFmpeg**, **FFprobe**, and **MKVMerge** as Tauri **Sidecars**. The Rust backend spawns them as asynchronous subprocesses and parses their `stderr`/`stdout` streams.

## Consequences

- **Positive:** Zero-dependency installation for the end user. The application works out of the box regardless of their system configuration.
- **Positive:** Avoids licensing and linking complexities associated with compiling C-bindings for FFmpeg across Windows, macOS, and Linux.
- **Positive:** Ensures we are always running a tested, known version of the binaries, preventing bugs caused by a user having an outdated global FFmpeg installation.
- **Negative:** The application installer size is significantly larger because it contains multiple full executables.
- **Negative:** Parsing text from `stderr` for progress tracking is slightly more fragile than interacting with a direct C-API.
