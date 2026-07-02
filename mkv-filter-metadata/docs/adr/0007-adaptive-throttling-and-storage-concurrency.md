---
title: "7. Adaptive Throttling and Storage Concurrency"
date: "2026-07-01"
---

# 7. Adaptive Throttling and Storage Concurrency

Date: 2026-07-01

## Status

Accepted

## Context

During batch processing of large numbers of MKV files on mechanical hard drives (HDDs), users experienced severe system freezing and stuttering. The physical read/write head of the HDD was thrashing due to concurrent high-speed stream copying (remuxing).

Additionally, long-running batch conversions were consuming nearly all available CPU and RAM resources, starving the host operating system of resources and causing overall system unresponsiveness, especially on lower-end hardware.

## Decision

To resolve these resource exhaustion issues, we implemented two distinct protective layers in version 1.2.2:

1. **Adaptive System Throttling (Global Layer):** 
   We introduced the `sysinfo` crate in the Rust backend to continuously monitor global CPU and RAM usage. 
   - If CPU usage spikes above 90% or available memory falls below 15%, the processing pipeline automatically pauses spawning new tasks. 
   - Once resources fall back below these thresholds, processing gracefully resumes.
   - The user is notified of this pause/resume cycle via global Toast notifications.

2. **Storage-Aware Concurrency (Pipeline Layer):** 
   We decoupled `remux_concurrency` from `reencode_concurrency` restrictions on HDDs.
   - **Remuxing (Stream Copy):** When `HDD` is selected as the Target Drive Type, Remux concurrency is aggressively clamped to `1` in both the UI and Backend validation. This prevents physical head thrashing since stream copying is purely IO-bound.
   - **Re-encoding:** When re-encoding, the HDD constraint is completely ignored. Re-encoding is a slow, CPU/GPU-bound process. The slow write cadence acts as a natural buffer, allowing the HDD to comfortably handle the writes. Users can now maximize their GPU concurrency even when targeting mechanical drives.

## Consequences

### Positive
- System responsiveness is preserved during massive batch operations, as the pipeline yields to the OS under heavy load.
- Users utilizing mechanical hard drives no longer suffer from complete system lockups during Remuxing.
- Users utilizing GPUs can now utilize their hardware's full capabilities (e.g. 4+ concurrent NVENC transcodes) even when writing the output to a slow mechanical drive.

### Negative
- Polling system telemetry every second introduces a negligible but non-zero background CPU cost (approx ~0.1% CPU).
- The `sysinfo` crate increases the compiled binary size by approximately 1MB due to cross-platform OS-level telemetry hooks.
