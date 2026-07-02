---
title: "ADR 0008: Encoder-Aware Concurrency and CPU Throttling Constraints"
status: "Accepted"
last_updated: 2026-07-02
---

# 8. Encoder-Aware Concurrency and CPU Throttling Constraints

Date: 2026-07-02

## Status
Accepted

## Context
When performing video re-encoding, processing requirements scale heavily based on the chosen video encoder. Hardware-accelerated encoders (`hevc_nvenc`, `h264_amf`, `hevc_qsv`, `hevc_videotoolbox`) offload the vast majority of processing to dedicated silicon on the GPU. Because they are highly efficient, running these tasks in parallel across all system logical cores scales extremely well and rarely causes the entire operating system to lock up.

Conversely, software encoders (`libx264`, `libx265`) rely entirely on the CPU. Furthermore, these encoders are already internally optimized to massively multi-thread their operations—a single `libx265` encode will natively attempt to consume all available cores on the host machine to process frames as quickly as possible.

If the application attempts to spawn multiple parallel `libx265` encoding subprocesses (e.g., matching a system's 16 logical cores), it results in immediate and severe CPU starvation. The operating system becomes completely unresponsive (lacking the scheduler resources to paint the UI or handle interrupts), and the concurrent tasks thrash against each other, leading to slower overall batch times than if they were processed sequentially.

While our **Adaptive System Throttling** (`sysinfo` polling) acts as a safety net to pause the pipeline when CPU > 90%, allowing the user to select high concurrency limits for software encoders means they will constantly trigger this throttle, leading to a frustrating stop-and-go processing experience.

## Decision
We have introduced **Encoder-Aware Concurrency Limits** to automatically protect users from CPU starvation:

1. **Hardware Encoders**: Are permitted to scale up to the total number of system logical cores. They are bottlenecked by GPU capabilities rather than CPU scheduler lockups.
2. **Software Encoders**: Any encoder matching `libx264` or `libx265` is strictly clamped to a maximum concurrency of **2**. This allows for a small degree of task pipelining (keeping the CPU fed between file I/O boundaries) without overwhelming the host system's thread scheduler.

When the user selects a software encoder in the UI, the slider dynamically snaps to a maximum of 2.

## Consequences
- **Positive**: Eliminates the risk of catastrophic OS freezes when users naively push the concurrency slider to maximum while using software encoding.
- **Positive**: Provides a smoother user experience, as the pipeline relies less heavily on the emergency 90% CPU `sysinfo` throttle.
- **Negative**: Advanced users with ultra-high core-count workstations (e.g., 64+ core Threadrippers) might find a hardcoded limit of 2 for `libx265` too restrictive for their specific hardware. However, given the target audience of this desktop app, protecting standard consumer desktops from freezing takes priority.
